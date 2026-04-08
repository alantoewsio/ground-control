"""Track in-flight background work per signed-in user (sync jobs, task queue sends).

Used so the UI can restore a progress banner after navigation or full page refresh."""

from __future__ import annotations

from threading import Lock
from typing import Any

_lock = Lock()
_by_user: dict[str, dict[str, Any]] = {}

DEFAULT_MESSAGE = "Background sync in progress…"
MSG_CONFIG_SYNC = "Configuration cache sync in progress…"
MSG_TASK_QUEUE = "Task queue sync in progress…"


def register(uid: str, message: str | None = None) -> None:
    msg = (message or "").strip() or DEFAULT_MESSAGE
    with _lock:
        cur = _by_user.setdefault(uid, {"n": 0, "message": msg})
        cur["n"] = int(cur.get("n", 0)) + 1
        cur["message"] = msg


def unregister(uid: str) -> None:
    with _lock:
        cur = _by_user.get(uid)
        if not cur:
            return
        n = max(0, int(cur.get("n", 0)) - 1)
        if n == 0:
            del _by_user[uid]
        else:
            cur["n"] = n


def snapshot(uid: str) -> dict[str, Any]:
    with _lock:
        cur = _by_user.get(uid)
        if not cur or int(cur.get("n", 0)) <= 0:
            return {"active": False, "count": 0, "message": ""}
        n = int(cur["n"])
        msg = str(cur.get("message") or DEFAULT_MESSAGE)
        return {"active": True, "count": n, "message": msg}
