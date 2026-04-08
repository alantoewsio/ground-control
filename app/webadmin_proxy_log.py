"""Append-only JSONL log of WebAdmin reverse-proxy traffic under ``./logs``."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app import config


def webadmin_proxy_log_dir() -> Path:
    raw = (os.environ.get("GROUND_CONTROL_WEBADMIN_PROXY_LOG_DIR") or "").strip()
    if raw:
        return Path(raw).expanduser()
    return config.BASE_DIR / "logs"


def webadmin_proxy_log_path() -> Path:
    return webadmin_proxy_log_dir() / "webadmin-proxy.jsonl"


def append_webadmin_proxy_record(record: dict[str, Any]) -> None:
    """Write one UTF-8 JSON line (no secrets: POST bodies are never logged)."""
    d = webadmin_proxy_log_dir()
    d.mkdir(parents=True, exist_ok=True)
    rec = dict(record)
    rec.setdefault("ts", datetime.now(timezone.utc).isoformat())
    path = webadmin_proxy_log_path()
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")


def summarize_outbound_headers(
    header_items: list[tuple[str, str]],
) -> dict[str, Any]:
    """Safe summary for logging (Set-Cookie values are not copied)."""
    loc: str | None = None
    ctype: str | None = None
    cookie_names: list[str] = []
    cookie_paths: list[str] = []
    for k, v in header_items:
        lk = k.lower()
        if lk == "location":
            loc = v[:2048] if v else v
        elif lk == "content-type":
            ctype = v[:256] if v else v
        elif lk == "set-cookie":
            name = (v.split("=", 1)[0].strip() if v else "")[:128]
            if name:
                cookie_names.append(name)
            attrs = v.split(";") if v else []
            for a in attrs[1:]:
                part = a.strip()
                if not part:
                    continue
                left, sep, right = part.partition("=")
                if sep and left.strip().lower() == "path":
                    p = right.strip().strip('"')
                    if p:
                        cookie_paths.append(p[:256])
                    break
    return {
        "response_content_type": ctype,
        "response_location": loc,
        "response_set_cookie_names": cookie_names,
        "response_set_cookie_paths": cookie_paths,
    }
