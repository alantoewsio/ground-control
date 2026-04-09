"""Session-backed UI authentication and password hashing (Sophos Central GUI parity)."""

from __future__ import annotations

import os
import secrets
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import urlparse

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException, Request
from starlette.requests import HTTPConnection

from app import config
from app.url_helpers import is_same_origin_value, request_is_https_session

SESSION_USER_ID_KEY = "user_id"
SESSION_LAST_ACTIVITY_KEY = "last_activity_at"
SESSION_TRACKING_ID_KEY = "session_tracking_id"

_active_session_lock = threading.Lock()
_active_sessions: dict[str, dict[str, object]] = {}

_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=64 * 1024,
    parallelism=2,
    hash_len=32,
    salt_len=16,
)


def get_session_secret() -> str:
    env = os.environ.get(config.SESSION_SECRET_ENV)
    if env and str(env).strip():
        return str(env).strip()
    path = config.session_secret_file()
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    raw = secrets.token_hex(32)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(raw, encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except (NotImplementedError, OSError, AttributeError):
        pass
    return raw


def hash_password(plain: str) -> str:
    return _password_hasher.hash(plain)


def verify_password(plain: str, stored_hash: str | None) -> bool:
    if not stored_hash or not str(stored_hash).strip():
        return False
    try:
        _password_hasher.verify(stored_hash, plain)
        if _password_hasher.check_needs_rehash(stored_hash):
            return True
        return True
    except VerifyMismatchError:
        return False


def validate_new_password(pw: str) -> None:
    if len(pw) < 10:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 10 characters.",
        )
    if len(pw) > 256:
        raise HTTPException(status_code=400, detail="Password is too long.")


def session_user_id(request: Request) -> str | None:
    sid = request.session.get(SESSION_USER_ID_KEY)
    if sid is None:
        return None
    s = str(sid).strip()
    return s or None


def _session_tracking_id(request: Request, *, create: bool) -> str | None:
    sid = request.session.get(SESSION_TRACKING_ID_KEY)
    tok = str(sid).strip() if sid is not None else ""
    if tok:
        return tok
    if not create:
        return None
    tok = uuid.uuid4().hex
    request.session[SESSION_TRACKING_ID_KEY] = tok
    return tok


def _request_client_ip(request: Request) -> str | None:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = str(xff).split(",")[0].strip()
        if first:
            return first
    xrip = request.headers.get("x-real-ip")
    if xrip and str(xrip).strip():
        return str(xrip).strip()
    client = getattr(request, "client", None)
    host = getattr(client, "host", None) if client is not None else None
    if host and str(host).strip():
        return str(host).strip()
    return None


def register_authenticated_session(
    request: Request,
    *,
    user_id: str,
    username: str | None = None,
    full_name: str | None = None,
    role: str | None = None,
) -> None:
    tok = _session_tracking_id(request, create=True)
    if not tok:
        return
    now = time.time()
    ip = _request_client_ip(request)
    with _active_session_lock:
        prev = _active_sessions.get(tok)
        logged_in_at = float(prev["logged_in_at"]) if prev and "logged_in_at" in prev else now
        _active_sessions[tok] = {
            "user_id": str(user_id).strip(),
            "username": (username or "").strip() or None,
            "full_name": (full_name or "").strip() or None,
            "role": (role or "").strip() or None,
            "client_ip": ip
            or (str(prev.get("client_ip", "")).strip() if prev else "")
            or None,
            "logged_in_at": logged_in_at,
            "last_activity_at": now,
        }


def unregister_authenticated_session(request: Request) -> None:
    tok = _session_tracking_id(request, create=False)
    if not tok:
        return
    with _active_session_lock:
        _active_sessions.pop(tok, None)


def touch_session_activity(request: Request) -> None:
    now = time.time()
    request.session[SESSION_LAST_ACTIVITY_KEY] = now
    uid = session_user_id(request)
    if not uid:
        return
    tok = _session_tracking_id(request, create=True)
    if not tok:
        return
    ip = _request_client_ip(request)
    with _active_session_lock:
        row = _active_sessions.get(tok)
        if row is None:
            _active_sessions[tok] = {
                "user_id": uid,
                "username": None,
                "full_name": None,
                "role": None,
                "client_ip": ip,
                "logged_in_at": now,
                "last_activity_at": now,
            }
            return
        row["last_activity_at"] = now
        if not row.get("user_id"):
            row["user_id"] = uid
        if ip:
            row["client_ip"] = ip


def evaluate_session_idle(
    request: Request, idle_timeout_seconds: float
) -> tuple[Literal["ok", "expired"], str | None]:
    if idle_timeout_seconds <= 0:
        return "ok", None
    last = request.session.get(SESSION_LAST_ACTIVITY_KEY)
    if last is None:
        return "ok", None
    if time.time() - float(last) > idle_timeout_seconds:
        expired_uid = session_user_id(request)
        unregister_authenticated_session(request)
        request.session.clear()
        return "expired", expired_uid
    return "ok", None


def require_authenticated_user_id(request: Request) -> str:
    uid = session_user_id(request)
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from app.users_service import app_user_has_password, get_app_user_by_id

    row = get_app_user_by_id(uid)
    if not row or not app_user_has_password(row):
        unregister_authenticated_session(request)
        request.session.clear()
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


def require_browser_json_session(request: Request) -> str:
    """Same rules as browser pages, but 401 JSON instead of redirect (for fetch/XHR)."""
    uid = require_authenticated_user_id(request)
    idle_sec = session_idle_timeout_seconds()
    idle_state, _ = evaluate_session_idle(request, idle_sec)
    if idle_state == "expired":
        request.session.clear()
        raise HTTPException(status_code=401, detail="Session expired.")
    touch_session_activity(request)
    return uid


def browser_websocket_session_error(request: HTTPConnection) -> str | None:
    """Return an error message if the browser session is invalid for a WebSocket; else None."""
    from app import users_service

    uid = session_user_id(request)
    if not uid:
        return "Not signed in."
    row = users_service.get_app_user_by_id(uid)
    if not row or not users_service.app_user_has_password(row):
        unregister_authenticated_session(request)
        request.session.clear()
        return "Not signed in."
    idle_sec = session_idle_timeout_seconds()
    idle_state, _ = evaluate_session_idle(request, idle_sec)
    if idle_state == "expired":
        return "Session expired. Sign in again."
    touch_session_activity(request)
    return None


def browser_websocket_origin_error(request: HTTPConnection) -> str | None:
    """Return an error message if WebSocket Origin is missing/mismatched; else None."""
    origin = (request.headers.get("origin") or "").strip()
    if not origin:
        return "Missing WebSocket Origin."
    u = urlparse(origin)
    if u.scheme not in ("http", "https") or not u.netloc:
        return "Invalid WebSocket Origin."
    if not is_same_origin_value(request, origin):
        return "WebSocket Origin is not allowed."
    if request_is_https_session(request) and u.scheme != "https":
        return "Insecure WebSocket Origin over HTTPS session."
    return None


def session_idle_timeout_seconds() -> float:
    m = config.session_idle_timeout_minutes()
    if m <= 0:
        return 0.0
    return float(m) * 60.0


def list_active_admin_sessions() -> list[dict[str, object]]:
    from app import users_service

    now = time.time()
    idle_sec = session_idle_timeout_seconds()
    keep: list[tuple[str, dict[str, object]]] = []
    out: list[dict[str, object]] = []
    with _active_session_lock:
        for tok, row in list(_active_sessions.items()):
            uid = str(row.get("user_id") or "").strip()
            if not uid:
                _active_sessions.pop(tok, None)
                continue
            last = float(row.get("last_activity_at") or 0.0)
            if idle_sec > 0 and last > 0 and now - last > idle_sec:
                _active_sessions.pop(tok, None)
                continue
            keep.append((tok, dict(row)))

    for _tok, row in keep:
        uid = str(row.get("user_id") or "").strip()
        user = users_service.get_app_user_by_id(uid)
        if not user or not users_service.app_user_has_password(user):
            continue
        if str(user.role).strip().lower() != "admin":
            continue
        logged_in_at = float(row.get("logged_in_at") or now)
        last_activity_at = float(row.get("last_activity_at") or logged_in_at)
        full_name = (user.full_name or "").strip()
        username = (user.username or "").strip()
        display_name = full_name or username or uid
        out.append(
            {
                "user_id": uid,
                "username": username,
                "display_name": display_name,
                "client_ip": str(row.get("client_ip") or "").strip() or None,
                "logged_in_at": datetime.fromtimestamp(
                    logged_in_at, tz=timezone.utc
                ).isoformat(),
                "last_activity_at": datetime.fromtimestamp(
                    last_activity_at, tz=timezone.utc
                ).isoformat(),
                "last_activity_seconds_ago": max(
                    0, int(round(now - last_activity_at))
                ),
            }
        )

    out.sort(key=lambda r: str(r.get("display_name") or "").casefold())
    return out


def require_admin_user_id(request: Request) -> str:
    from app.users_service import get_app_user_by_id

    uid = require_authenticated_user_id(request)
    row = get_app_user_by_id(uid)
    if not row or row.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return uid
