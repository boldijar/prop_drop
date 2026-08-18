#!/usr/bin/env python3
"""Scrape Facebook group posts via Apify and store them in Upstash Redis."""

from __future__ import annotations

import json
import logging
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

from common import env_int, env_str

CONFIG_KEY = "prodrop:config"
POSTS_KEY = "prodrop:posts"
DEFAULT_ACTOR_ID = "apify/facebook-groups-scraper"
DEFAULT_RESULTS_LIMIT = 100
APIFY_BASE_URL = "https://api.apify.com/v2"
DEFAULT_SYNC_LOOKBACK_HOURS = 6

logger = logging.getLogger("prodrop.sync")
_SSL_CONTEXT: ssl.SSLContext | None = None


def ssl_context() -> ssl.SSLContext:
    global _SSL_CONTEXT
    if _SSL_CONTEXT is not None:
        return _SSL_CONTEXT

    context = ssl.create_default_context()
    candidates: list[str] = []

    if os.environ.get("SSL_CERT_FILE"):
        candidates.append(os.environ["SSL_CERT_FILE"])

    defaults = ssl.get_default_verify_paths()
    if defaults.cafile:
        candidates.append(defaults.cafile)
    if defaults.capath:
        candidates.append(defaults.capath)

    candidates.extend(
        [
            "/etc/ssl/cert.pem",
            "/private/etc/ssl/cert.pem",
            "/opt/homebrew/etc/openssl@3/cert.pem",
            "/usr/local/etc/openssl@3/cert.pem",
            "/etc/pki/tls/certs/ca-bundle.crt",
        ]
    )

    for path in candidates:
        if not path or not os.path.exists(path):
            continue
        try:
            if os.path.isdir(path):
                context.load_verify_locations(capath=path)
            else:
                context.load_verify_locations(cafile=path)
            logger.debug("Using SSL certificates from %s", path)
            _SSL_CONTEXT = context
            return context
        except ssl.SSLError:
            continue

    _SSL_CONTEXT = context
    return context


def setup_logging() -> None:
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-7s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: dict[str, Any] | list[Any] | None = None,
    timeout: int = 120,
) -> Any:
    payload = None
    req_headers = dict(headers or {})
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")

    request = urllib.request.Request(url, data=payload, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(
            request, timeout=timeout, context=ssl_context()
        ) as response:
            raw = response.read().decode("utf-8")
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} for {method} {url}: {detail}") from exc


class UpstashClient:
    def __init__(self, rest_url: str, rest_token: str) -> None:
        self.rest_url = rest_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {rest_token}"}

    def get(self, key: str) -> str | None:
        encoded_key = urllib.parse.quote(key, safe="")
        url = f"{self.rest_url}/get/{encoded_key}"
        data = http_json("GET", url, headers=self.headers)
        result = data.get("result") if isinstance(data, dict) else None
        if result is None:
            return None
        return str(result)

    def set(self, key: str, value: str) -> None:
        http_json(
            "POST",
            self.rest_url,
            headers=self.headers,
            body=["SET", key, value],
        )


class ApifyClient:
    def __init__(self, api_token: str) -> None:
        self.api_token = api_token
        self.headers = {"Authorization": f"Bearer {api_token}"}

    @staticmethod
    def _actor_path(actor_id: str) -> str:
        return urllib.parse.quote(actor_id.replace("/", "~"), safe="")

    def run_actor(self, actor_id: str, run_input: dict[str, Any]) -> dict[str, Any]:
        url = f"{APIFY_BASE_URL}/acts/{self._actor_path(actor_id)}/runs"
        response = http_json(
            "POST",
            url,
            headers=self.headers,
            body=run_input,
            timeout=60,
        )
        if not isinstance(response, dict) or "data" not in response:
            raise RuntimeError(f"Unexpected Apify run response: {response}")
        return response["data"]

    def wait_for_run(self, run_id: str, poll_seconds: int = 5) -> dict[str, Any]:
        url = f"{APIFY_BASE_URL}/actor-runs/{run_id}"
        while True:
            response = http_json("GET", url, headers=self.headers)
            run = response.get("data", response)
            status = run.get("status")
            logger.debug("Apify run %s status: %s", run_id, status)

            if status == "SUCCEEDED":
                return run
            if status in {"FAILED", "ABORTED", "TIMED-OUT"}:
                raise RuntimeError(f"Apify run {run_id} ended with status {status}")

            time.sleep(poll_seconds)

    def fetch_dataset_items(self, dataset_id: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        offset = 0
        limit = 1000

        while True:
            query = urllib.parse.urlencode(
                {
                    "format": "json",
                    "clean": "true",
                    "offset": offset,
                    "limit": limit,
                }
            )
            url = f"{APIFY_BASE_URL}/datasets/{dataset_id}/items?{query}"
            batch = http_json("GET", url, headers=self.headers)
            if not batch:
                break
            if not isinstance(batch, list):
                raise RuntimeError(f"Unexpected dataset response: {batch}")
            items.extend(batch)
            if len(batch) < limit:
                break
            offset += len(batch)

        return items

    def call_actor(self, actor_id: str, run_input: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        run = self.run_actor(actor_id, run_input)
        run_id = run["id"]
        logger.info("Started Apify run %s", run_id)
        finished = self.wait_for_run(run_id)
        dataset_id = finished["defaultDatasetId"]
        items = self.fetch_dataset_items(dataset_id)
        return finished, items


def parse_group_urls(raw: str) -> list[str]:
    urls = [url.strip() for url in raw.split(",") if url.strip()]
    if not urls:
        raise RuntimeError("FACEBOOK_GROUP_URLS must contain at least one URL")
    return urls


def normalize_group_url(url: str) -> str:
    return url.rstrip("/")


def parse_iso_datetime(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def to_iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def default_sync_date() -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=DEFAULT_SYNC_LOOKBACK_HOURS)


def load_config(redis: UpstashClient) -> dict[str, Any]:
    logger.info("Loading config from Upstash key %s", CONFIG_KEY)
    raw = redis.get(CONFIG_KEY)
    if not raw:
        logger.info("No existing config found, starting fresh")
        return {"groups": {}}
    config = json.loads(raw)
    if "groups" not in config or not isinstance(config["groups"], dict):
        config["groups"] = {}
    logger.info("Loaded config for %d group(s)", len(config["groups"]))
    return config


def save_config(redis: UpstashClient, config: dict[str, Any]) -> None:
    redis.set(CONFIG_KEY, json.dumps(config, separators=(",", ":")))
    logger.info("Saved config to %s", CONFIG_KEY)


def load_posts(redis: UpstashClient) -> list[dict[str, Any]]:
    logger.info("Loading posts from Upstash key %s", POSTS_KEY)
    raw = redis.get(POSTS_KEY)
    if not raw:
        logger.info("No existing posts found")
        return []
    posts = json.loads(raw)
    if not isinstance(posts, list):
        raise RuntimeError(f"{POSTS_KEY} must contain a JSON array")
    logger.info("Loaded %d existing post(s)", len(posts))
    return posts


def save_posts(redis: UpstashClient, posts: list[dict[str, Any]]) -> None:
    redis.set(POSTS_KEY, json.dumps(posts, separators=(",", ":")))
    logger.info("Saved %d post(s) to %s", len(posts), POSTS_KEY)


def get_group_last_sync(config: dict[str, Any], group_url: str) -> datetime:
    groups = config.get("groups", {})
    stored = groups.get(group_url)
    if not stored:
        default_date = default_sync_date()
        logger.info(
            "No last sync for %s, using default %s",
            group_url,
            to_iso_utc(default_date),
        )
        return default_date
    parsed = parse_iso_datetime(stored)
    logger.info("Last sync for %s: %s", group_url, to_iso_utc(parsed))
    return parsed


def post_timestamp(post: dict[str, Any]) -> datetime | None:
    raw_time = post.get("time")
    if not raw_time:
        return None
    try:
        return parse_iso_datetime(str(raw_time))
    except ValueError:
        return None


def post_id(post: dict[str, Any]) -> str | None:
    for key in ("id", "legacyId", "url"):
        value = post.get(key)
        if value:
            return str(value)
    return None


def actor_supports_date_range(actor_id: str) -> bool:
    return "simpleapi/facebook-groups-scraper" in actor_id


def run_actor_page(
    client: ApifyClient,
    actor_id: str,
    group_url: str,
    results_limit: int,
    only_posts_newer_than: datetime,
    only_posts_older_than: datetime | None = None,
) -> tuple[list[dict[str, Any]], str]:
    run_input: dict[str, Any] = {
        "startUrls": [{"url": group_url}],
        "resultsLimit": results_limit,
        "viewOption": "CHRONOLOGICAL",
        "onlyPostsNewerThan": to_iso_utc(only_posts_newer_than),
    }
    if only_posts_older_than is not None and actor_supports_date_range(actor_id):
        run_input["onlyPostsOlderThan"] = to_iso_utc(only_posts_older_than)

    started = time.monotonic()
    finished, items = client.call_actor(actor_id, run_input)
    run_id = finished.get("id", "unknown")
    elapsed = time.monotonic() - started

    logger.info(
        "Apify run %s finished in %.1fs, returned %d item(s)",
        run_id,
        elapsed,
        len(items),
    )
    logger.debug("Apify run input: %s", json.dumps(run_input))
    return items, run_id


def scrape_group_paginated(
    client: ApifyClient,
    actor_id: str,
    group_url: str,
    only_posts_newer_than: datetime,
    results_limit: int,
) -> list[dict[str, Any]]:
    logger.info(
        "Starting paginated scrape for %s (batch size %d)",
        group_url,
        results_limit,
    )

    collected: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    lower_bound = only_posts_newer_than
    upper_bound: datetime | None = None
    page = 0
    max_pages_per_group = env_int("MAX_PAGES_PER_GROUP", 500)
    use_date_range = actor_supports_date_range(actor_id)

    if use_date_range:
        logger.info("Actor supports date-range pagination (newest-first windows)")
    else:
        logger.info(
            "Using ascending cursor pagination via onlyPostsNewerThan "
            "(CHRONOLOGICAL batches)"
        )

    while page < max_pages_per_group:
        page += 1
        window_desc = (
            f"newer than {to_iso_utc(lower_bound)}"
            + (
                f", older than {to_iso_utc(upper_bound)}"
                if upper_bound is not None
                else ""
            )
        )
        logger.info("Group %s | page %d | window: %s", group_url, page, window_desc)

        batch, run_id = run_actor_page(
            client=client,
            actor_id=actor_id,
            group_url=group_url,
            results_limit=results_limit,
            only_posts_newer_than=lower_bound,
            only_posts_older_than=upper_bound,
        )

        new_in_batch = 0
        for post in batch:
            pid = post_id(post)
            if not pid or pid in seen_ids:
                continue
            seen_ids.add(pid)
            post["_groupUrl"] = group_url
            post["_scrapedAt"] = to_iso_utc(datetime.now(timezone.utc))
            post["_apifyRunId"] = run_id
            collected.append(post)
            new_in_batch += 1

        logger.info(
            "Group %s | page %d | batch=%d | new=%d | total=%d",
            group_url,
            page,
            len(batch),
            new_in_batch,
            len(collected),
        )

        if len(batch) < results_limit:
            logger.info(
                "Group %s | pagination complete (batch smaller than limit)",
                group_url,
            )
            break

        timestamps = [ts for post in batch if (ts := post_timestamp(post)) is not None]
        if not timestamps:
            logger.warning(
                "Group %s | page %d returned a full batch without timestamps, stopping",
                group_url,
                page,
            )
            break

        if new_in_batch == 0:
            logger.warning(
                "Group %s | page %d returned only duplicates, stopping",
                group_url,
                page,
            )
            break

        if use_date_range:
            previous_upper = upper_bound
            upper_bound = min(timestamps)
            if previous_upper is not None and upper_bound >= previous_upper:
                logger.warning(
                    "Group %s | upper bound did not advance (%s), stopping",
                    group_url,
                    to_iso_utc(upper_bound),
                )
                break
            if upper_bound <= lower_bound:
                logger.info(
                    "Group %s | reached lower bound %s, stopping",
                    group_url,
                    to_iso_utc(lower_bound),
                )
                break
            continue

        previous_lower = lower_bound
        lower_bound = max(timestamps)
        if lower_bound <= previous_lower:
            logger.warning(
                "Group %s | lower bound did not advance (%s), stopping",
                group_url,
                to_iso_utc(lower_bound),
            )
            break

    else:
        logger.warning(
            "Group %s | hit MAX_PAGES_PER_GROUP=%d, stopping early",
            group_url,
            max_pages_per_group,
        )

    if collected:
        timestamps = [ts for post in collected if (ts := post_timestamp(post)) is not None]
        if timestamps:
            logger.info(
                "Group %s | fetched %d post(s) across %d page(s) | range %s -> %s",
                group_url,
                len(collected),
                page,
                to_iso_utc(min(timestamps)),
                to_iso_utc(max(timestamps)),
            )
        else:
            logger.info(
                "Group %s | fetched %d post(s) across %d page(s) (no timestamps)",
                group_url,
                len(collected),
                page,
            )
    else:
        logger.info("Group %s | fetched 0 new post(s) across %d page(s)", group_url, page)

    return collected


def merge_posts(
    existing: list[dict[str, Any]], new_posts: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], int]:
    merged: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    existing_ids = {pid for post in existing if (pid := post_id(post))}

    for post in existing + new_posts:
        pid = post_id(post)
        if not pid:
            continue
        if pid not in merged:
            order.append(pid)
        merged[pid] = post

    added = sum(
        1
        for post in new_posts
        if (pid := post_id(post)) and pid not in existing_ids
    )
    return [merged[pid] for pid in order], added


def update_group_sync_date(
    config: dict[str, Any],
    group_url: str,
    posts: list[dict[str, Any]],
) -> datetime | None:
    timestamps = [ts for post in posts if (ts := post_timestamp(post)) is not None]
    if not timestamps:
        return None

    latest = max(timestamps)
    config.setdefault("groups", {})[group_url] = to_iso_utc(latest)
    return latest


def main() -> int:
    setup_logging()

    upstash = UpstashClient(
        require_env("UPSTASH_REDIS_REST_URL"),
        require_env("UPSTASH_REDIS_REST_TOKEN"),
    )
    apify = ApifyClient(require_env("APIFY_API_TOKEN"))
    group_urls = [
        normalize_group_url(url)
        for url in parse_group_urls(require_env("FACEBOOK_GROUP_URLS"))
    ]

    actor_id = env_str("APIFY_ACTOR_ID", DEFAULT_ACTOR_ID) or DEFAULT_ACTOR_ID
    results_limit = env_int("RESULTS_LIMIT", DEFAULT_RESULTS_LIMIT)

    logger.info("=== Prop Drop Facebook sync started ===")
    logger.info("Actor: %s", actor_id)
    logger.info("Batch size (RESULTS_LIMIT): %d", results_limit)
    logger.info("Groups to sync: %d", len(group_urls))

    config = load_config(upstash)
    existing_posts = load_posts(upstash)
    all_new_posts: list[dict[str, Any]] = []

    for index, group_url in enumerate(group_urls, start=1):
        logger.info("--- Group %d/%d: %s ---", index, len(group_urls), group_url)
        last_sync = get_group_last_sync(config, group_url)
        posts = scrape_group_paginated(
            client=apify,
            actor_id=actor_id,
            group_url=group_url,
            only_posts_newer_than=last_sync,
            results_limit=results_limit,
        )

        all_new_posts.extend(posts)
        latest = update_group_sync_date(config, group_url, posts)
        if latest:
            logger.info(
                "Updated last sync for %s -> %s",
                group_url,
                to_iso_utc(latest),
            )
        else:
            logger.info("No new posts for %s, last sync unchanged", group_url)

    logger.info("Merging %d scraped post(s) into Upstash", len(all_new_posts))
    merged_posts, added_count = merge_posts(existing_posts, all_new_posts)
    save_posts(upstash, merged_posts)
    save_config(upstash, config)

    logger.info("=== Sync complete ===")
    logger.info("New posts this run: %d", added_count)
    logger.info("Total posts stored: %d", len(merged_posts))
    logger.info("Groups synced: %d", len(group_urls))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        logger.exception("Sync failed: %s", exc)
        raise SystemExit(1) from exc
