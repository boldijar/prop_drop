"""Shared HTTP and Upstash helpers (stdlib only)."""

from __future__ import annotations

import json
import logging
import os
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

logger = logging.getLogger("prodrop")
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


def setup_logging(name: str = "prodrop") -> None:
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-7s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logging.getLogger(name)


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

    def get_json(self, key: str, default: Any) -> Any:
        raw = self.get(key)
        if not raw:
            return default
        return json.loads(raw)

    def set_json(self, key: str, value: Any) -> None:
        self.set(key, json.dumps(value, separators=(",", ":")))


def send_telegram(message: str) -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        logger.debug("Telegram not configured, skipping notification")
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        http_json(
            "POST",
            url,
            body={"chat_id": chat_id, "text": message[:4096]},
            timeout=30,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to send Telegram message: %s", exc)


def load_prodrop_config(path: str | None = None) -> dict[str, Any]:
    config_path = path or os.environ.get("PRODROP_CONFIG", "").strip()
    if not config_path:
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        config_path = os.path.join(root, "prodrop.config")

    with open(config_path, encoding="utf-8") as handle:
        config = json.load(handle)

    if not isinstance(config, dict):
        raise RuntimeError(f"Invalid config file: {config_path}")
    return config
