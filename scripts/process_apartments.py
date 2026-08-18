#!/usr/bin/env python3
"""Extract structured entities from Facebook posts using Gemini."""

from __future__ import annotations

import json
import logging
import os
import sys
import urllib.parse
from datetime import datetime, timezone
from typing import Any

from common import (
    UpstashClient,
    http_json,
    load_env_file,
    load_prodrop_config,
    require_env,
    send_telegram,
    setup_logging,
)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

logger = logging.getLogger("prodrop.process")


def post_id(post: dict[str, Any]) -> str | None:
    for key in ("id", "legacyId", "url"):
        value = post.get(key)
        if value:
            return str(value)
    return None


def first_from_post(post: dict[str, Any], sources: list[str]) -> str | None:
    for key in sources:
        value = post.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return None


def build_gemini_input(post: dict[str, Any], fields: list[dict[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for field in fields:
        name = field["name"]
        sources = field["sources"]
        if field.get("exact"):
            result[name] = post.get(sources[0])
        else:
            result[name] = first_from_post(post, sources)
    return result


def apply_passthrough(
    post: dict[str, Any],
    passthrough_fields: list[dict[str, Any]],
) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for field in passthrough_fields:
        name = field["name"]
        sources = field["sources"]
        if field.get("mergeArrays"):
            merged: list[Any] = []
            for source in sources:
                value = post.get(source)
                if value is None:
                    continue
                if isinstance(value, list):
                    merged.extend(value)
                else:
                    merged.append(value)
            result[name] = merged
        elif field.get("exact"):
            result[name] = post.get(sources[0])
        else:
            result[name] = first_from_post(post, sources)
    return result


def build_extraction_prompt(config: dict[str, Any]) -> str:
    extraction = config["extraction"]
    schema_lines = [
        f'  "{name}": {type_hint},'
        for name, type_hint in extraction["schema"].items()
    ]
    schema_block = "{\n" + "\n".join(schema_lines).rstrip(",") + "\n}"

    rules = "\n".join(f"- {rule}" for rule in extraction["rules"])
    return (
        f"{extraction['intro']}\n\n"
        f"REGULI:\n{rules}\n\n"
        f"SCHEMA pentru fiecare obiect:\n{schema_block}\n\n"
        f"{extraction['footer']}\n"
    )


def reserved_field_names(config: dict[str, Any]) -> set[str]:
    names = set(config.get("metadataFields", []))
    for field in config.get("passthroughFields", []):
        names.add(field["name"])
    return names


def load_posts(redis: UpstashClient, key: str) -> list[dict[str, Any]]:
    logger.info("Loading posts from %s", key)
    posts = redis.get_json(key, [])
    if not isinstance(posts, list):
        raise RuntimeError(f"{key} must contain a JSON array")
    logger.info("Found %d post(s) to process", len(posts))
    return posts


def load_entities(redis: UpstashClient, key: str) -> list[dict[str, Any]]:
    entities = redis.get_json(key, [])
    if not isinstance(entities, list):
        raise RuntimeError(f"{key} must contain a JSON array")
    return entities


def save_posts(redis: UpstashClient, key: str, posts: list[dict[str, Any]]) -> None:
    redis.set_json(key, posts)
    logger.info("Saved %d post(s) to %s", len(posts), key)


def save_entities(redis: UpstashClient, key: str, entities: list[dict[str, Any]]) -> None:
    redis.set_json(key, entities)
    logger.info("Saved %d item(s) to %s", len(entities), key)


def call_gemini(api_key: str, model: str, prompt: str) -> str:
    url = (
        f"{GEMINI_BASE_URL}/{urllib.parse.quote(model)}:"
        f"generateContent?key={urllib.parse.quote(api_key)}"
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }
    response = http_json("POST", url, body=body, timeout=180)
    candidates = response.get("candidates", [])
    if not candidates:
        raise RuntimeError(f"Gemini returned no candidates: {response}")

    parts = candidates[0].get("content", {}).get("parts", [])
    if not parts or "text" not in parts[0]:
        raise RuntimeError(f"Gemini returned empty content: {response}")

    return str(parts[0]["text"]).strip()


def parse_gemini_response(
    raw: str,
    expected_count: int,
    entity_id: str,
) -> list[dict[str, Any]]:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    data = json.loads(cleaned)
    if isinstance(data, dict) and entity_id in data:
        data = data[entity_id]
    if not isinstance(data, list):
        raise RuntimeError(f"Expected JSON array from Gemini, got: {type(data).__name__}")

    if len(data) != expected_count:
        raise RuntimeError(
            f"Expected {expected_count} items from Gemini, got {len(data)}"
        )

    return [item if isinstance(item, dict) else {} for item in data]


def enrich_entity(
    extracted: dict[str, Any],
    source_post: dict[str, Any],
    config: dict[str, Any],
) -> dict[str, Any]:
    reserved = reserved_field_names(config)
    clean = {k: v for k, v in extracted.items() if k not in reserved}
    passthrough = apply_passthrough(source_post, config["passthroughFields"])
    return {
        **clean,
        **passthrough,
        "postId": post_id(source_post),
        "processedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def merge_entities(
    existing: list[dict[str, Any]],
    new_items: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    by_id = {
        str(item.get("postId")): item
        for item in existing
        if item.get("postId")
    }
    added = 0
    for item in new_items:
        key = str(item.get("postId"))
        if not key:
            continue
        if key not in by_id:
            added += 1
        by_id[key] = item
    return list(by_id.values()), added


def process_batch(
    redis: UpstashClient,
    gemini_key: str,
    config: dict[str, Any],
    prompt_prefix: str,
    posts: list[dict[str, Any]],
    entities: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], int]:
    batch_size = int(config["processing"]["batchSize"])
    model = os.environ.get("GEMINI_MODEL", config["processing"]["geminiModel"]).strip()
    source_key = config["storage"]["sourceKey"]
    target_key = config["storage"]["targetKey"]
    entity_id = config["entity"]["id"]

    batch = posts[:batch_size]
    batch_ids = [pid for post in batch if (pid := post_id(post))]
    if len(batch_ids) != len(batch):
        raise RuntimeError("Batch contains posts without an id")

    minimal = [build_gemini_input(post, config["geminiInputFields"]) for post in batch]
    prompt = prompt_prefix + json.dumps(minimal, ensure_ascii=False, indent=2)

    logger.info(
        "Sending batch of %d post(s) to Gemini: %s",
        len(batch),
        ", ".join(batch_ids),
    )
    logger.debug("Gemini prompt:\n%s", prompt)

    raw_response = call_gemini(gemini_key, model, prompt)
    logger.debug("Gemini raw response:\n%s", raw_response)

    extracted = parse_gemini_response(raw_response, len(batch), entity_id)
    enriched = [enrich_entity(item, post, config) for item, post in zip(extracted, batch)]

    before_ids = {str(item.get("postId")) for item in entities if item.get("postId")}
    entities, added = merge_entities(entities, enriched)
    new_items = [
        item for item in enriched if str(item.get("postId")) not in before_ids
    ]
    remaining_posts = [post for post in posts if post_id(post) not in set(batch_ids)]

    save_entities(redis, target_key, entities)
    save_posts(redis, source_key, remaining_posts)

    logger.info(
        "Batch done: added %d item(s), %d post(s) remaining",
        added,
        len(remaining_posts),
    )
    return remaining_posts, entities, new_items, added


def numeric_values(items: list[dict[str, Any]], field: str) -> list[float]:
    values: list[float] = []
    for item in items:
        value = item.get(field)
        if isinstance(value, bool) or value is None:
            continue
        try:
            values.append(float(value))
        except (TypeError, ValueError):
            continue
    return values


def format_range(values: list[float], suffix: str = "") -> str | None:
    if not values:
        return None
    low = min(values)
    high = max(values)
    if low == high:
        return f"{low:,.0f}{suffix}".replace(",", ".")
    return f"{low:,.0f} - {high:,.0f}{suffix}".replace(",", ".")


def format_success_message(
    config: dict[str, Any],
    added_items: list[dict[str, Any]],
    total_count: int,
) -> str:
    label = config["entity"]["label"]
    price_field = config["telegram"]["priceField"]
    area_field = config["telegram"]["areaField"]
    count = len(added_items)

    if count == 0:
        return f"✅ {label}: nicio postare nouă procesată.\nTotal în DB: {total_count}"

    prices = numeric_values(added_items, price_field)
    areas = numeric_values(added_items, area_field)

    lines = [f"✅ {label}: {count} găsite în această rulare"]
    price_range = format_range(prices, " €")
    area_range = format_range(areas, " m²")
    if price_range:
        lines.append(f"Preț: {price_range}")
    if area_range:
        lines.append(f"Suprafață: {area_range}")
    lines.append(f"Total în DB: {total_count}")
    return "\n".join(lines)


def format_error_message(config: dict[str, Any], error: Exception) -> str:
    label = config["entity"]["label"]
    return f"❌ {label}: eroare\n\n{error}"


def main() -> int:
    setup_logging("prodrop.process")
    load_env_file()
    config = load_prodrop_config()
    label = config["entity"]["label"]
    batch_size = int(config["processing"]["batchSize"])
    prompt_prefix = build_extraction_prompt(config)

    redis = UpstashClient(
        require_env("UPSTASH_REDIS_REST_URL"),
        require_env("UPSTASH_REDIS_REST_TOKEN"),
    )
    gemini_key = require_env("GEMINI_API_KEY")
    model = os.environ.get("GEMINI_MODEL", config["processing"]["geminiModel"]).strip()

    logger.info("=== Prop Drop extraction started (%s) ===", label)
    logger.info("Config entity: %s", config["entity"]["id"])
    logger.info("Gemini model: %s", model)
    logger.info("Batch size: %d", batch_size)

    posts = load_posts(redis, config["storage"]["sourceKey"])
    entities = load_entities(redis, config["storage"]["targetKey"])
    added_items: list[dict[str, Any]] = []
    batches_ok = 0
    batches_failed = 0
    fatal_error: Exception | None = None

    try:
        if not posts:
            message = format_success_message(config, [], len(entities))
            logger.info(message.replace("\n", " | "))
            send_telegram(message)
            return 0

        while posts:
            try:
                posts, entities, batch_items, _added = process_batch(
                    redis, gemini_key, config, prompt_prefix, posts, entities
                )
                added_items.extend(batch_items)
                batches_ok += 1
            except Exception as exc:  # noqa: BLE001
                batches_failed += 1
                fatal_error = exc
                logger.error(
                    "Batch failed (%d post(s) left unprocessed, data NOT deleted): %s",
                    len(posts[:batch_size]),
                    exc,
                )
                logger.exception("Batch error details")
                break

        if fatal_error:
            send_telegram(format_error_message(config, fatal_error))
            return 1

        message = format_success_message(config, added_items, len(entities))
        logger.info("=== Extraction complete ===")
        logger.info(message.replace("\n", " | "))
        send_telegram(message)
        return 0

    except Exception as exc:  # noqa: BLE001
        logger.exception("Extraction failed: %s", exc)
        send_telegram(format_error_message(config, exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
