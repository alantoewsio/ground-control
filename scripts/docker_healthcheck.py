"""Container healthcheck: HTTP port from persisted security state (Docker secrets may override)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path


def _http_port() -> int:
    pr = (os.environ.get("GROUND_CONTROL_PERSIST_DIR") or "").strip() or "/data"
    sp = Path(pr) / ".gc_security_state.json"
    if sp.is_file():
        try:
            d = json.loads(sp.read_text(encoding="utf-8"))
            p = int(d.get("http_port") or 8000)
            if 1 <= p <= 65535:
                return p
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            pass
    for key in ("GROUND_CONTROL_HTTP_PORT", "PORT"):
        raw = (os.environ.get(key) or "").strip()
        if raw.isdigit():
            p = int(raw)
            if 1 <= p <= 65535:
                return p
    return 8000


def main() -> None:
    p = _http_port()
    urllib.request.urlopen(f"http://127.0.0.1:{p}/api/health", timeout=4)


if __name__ == "__main__":
    try:
        main()
    except (urllib.error.URLError, OSError):
        raise SystemExit(1)
