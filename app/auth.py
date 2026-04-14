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

ADMIN_ROLE_KEYS = frozenset({"admin", "superadmin", "super admin"})
DESIGNER_ROLE_KEYS = frozenset({"designer", "superadmin", "super admin"})

_active_session_lock = threading.Lock()
_active_sessions: dict[str, dict[str, object]] = {}
_admin_chat_lock = threading.Lock()
_admin_chats: dict[str, dict[str, object]] = {}
_admin_logout_challenge_lock = threading.Lock()
_admin_logout_challenges: dict[str, dict[str, object]] = {}

# Signed session cookies can race: a request that started before logout/idle expiry may still
# refresh ``last_activity`` and emit Set-Cookie, reviving the session. Invalidate tracking ids
# server-side so concurrent stale-tab requests cannot resurrect ended sessions.
_invalidated_tracking_lock = threading.Lock()
_invalidated_session_tracking_ids: dict[str, float] = {}
_INVALIDATED_SESSION_TRACKING_TTL_SEC = 600.0


def _purge_stale_invalidated_session_tracking_unlocked(now: float | None = None) -> None:
    t = time.time() if now is None else now
    dead = [k for k, exp in _invalidated_session_tracking_ids.items() if exp <= t]
    for k in dead:
        _invalidated_session_tracking_ids.pop(k, None)


def remember_invalidated_session_tracking_token(token: str | None) -> None:
    """Reject further requests that still carry this session tracking id (same signed cookie)."""
    tok = str(token or "").strip()
    if not tok:
        return
    with _invalidated_tracking_lock:
        _purge_stale_invalidated_session_tracking_unlocked()
        _invalidated_session_tracking_ids[tok] = (
            time.time() + _INVALIDATED_SESSION_TRACKING_TTL_SEC
        )


def remember_invalidated_session_tracking_id(connection: HTTPConnection) -> None:
    remember_invalidated_session_tracking_token(
        _session_tracking_id(connection, create=False)
    )


def purge_invalidated_browser_session(connection: HTTPConnection) -> bool:
    """If the cookie's tracking id was invalidated, clear the session. Returns True if cleared."""
    tok = str(_session_tracking_id(connection, create=False) or "").strip()
    if not tok:
        return False
    with _invalidated_tracking_lock:
        _purge_stale_invalidated_session_tracking_unlocked()
        if tok not in _invalidated_session_tracking_ids:
            return False
    unregister_authenticated_session(connection)
    connection.session.clear()
    return True

_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=64 * 1024,
    parallelism=2,
    hash_len=32,
    salt_len=16,
)


def role_key(role: str | None) -> str:
    return str(role or "").strip().casefold()


def user_role_is_admin(role: str | None) -> bool:
    return role_key(role) in ADMIN_ROLE_KEYS


def user_role_can_use_designer(role: str | None) -> bool:
    return role_key(role) in DESIGNER_ROLE_KEYS


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


def _session_tracking_id(connection: HTTPConnection, *, create: bool) -> str | None:
    sid = connection.session.get(SESSION_TRACKING_ID_KEY)
    tok = str(sid).strip() if sid is not None else ""
    if tok:
        return tok
    if not create:
        return None
    tok = uuid.uuid4().hex
    connection.session[SESSION_TRACKING_ID_KEY] = tok
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
        logged_in_at = (
            float(prev["logged_in_at"]) if prev and "logged_in_at" in prev else now
        )
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


def unregister_authenticated_session(connection: HTTPConnection) -> None:
    tok = _session_tracking_id(connection, create=False)
    if not tok:
        return
    with _active_session_lock:
        _active_sessions.pop(tok, None)
    with _admin_logout_challenge_lock:
        for cid, challenge in list(_admin_logout_challenges.items()):
            if tok in {
                str(challenge.get("target_session_id") or ""),
                str(challenge.get("requester_session_id") or ""),
            }:
                _admin_logout_challenges.pop(cid, None)
    cleanup_admin_chats()


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
        remember_invalidated_session_tracking_id(request)
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
        remember_invalidated_session_tracking_id(request)
        unregister_authenticated_session(request)
        request.session.clear()
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


def require_browser_json_session(request: Request) -> str:
    """Same rules as browser pages, but 401 JSON instead of redirect (for fetch/XHR)."""
    purge_invalidated_browser_session(request)
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

    purge_invalidated_browser_session(request)
    uid = session_user_id(request)
    if not uid:
        return "Not signed in."
    row = users_service.get_app_user_by_id(uid)
    if not row or not users_service.app_user_has_password(row):
        remember_invalidated_session_tracking_id(request)
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


def list_active_admin_sessions(
    current_tracking_id: str | None = None,
) -> list[dict[str, object]]:
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

    current_tok = str(current_tracking_id or "").strip()
    for tok, row in keep:
        uid = str(row.get("user_id") or "").strip()
        user = users_service.get_app_user_by_id(uid)
        if not user or not users_service.app_user_has_password(user):
            continue
        logged_in_at = float(row.get("logged_in_at") or now)
        last_activity_at = float(row.get("last_activity_at") or logged_in_at)
        full_name = (user.full_name or "").strip()
        username = (user.username or "").strip()
        display_name = full_name or username or uid
        out.append(
            {
                "user_id": uid,
                "session_id": tok,
                "username": username,
                "display_name": display_name,
                "role": str(user.role or "").strip(),
                "client_ip": str(row.get("client_ip") or "").strip() or None,
                "is_current": bool(current_tok and tok == current_tok),
                "logged_in_at": datetime.fromtimestamp(
                    logged_in_at, tz=timezone.utc
                ).isoformat(),
                "last_activity_at": datetime.fromtimestamp(
                    last_activity_at, tz=timezone.utc
                ).isoformat(),
                "last_activity_seconds_ago": max(0, int(round(now - last_activity_at))),
            }
        )

    out.sort(key=lambda r: str(r.get("display_name") or "").casefold())
    return out


def _active_admin_session_rows_unlocked(now: float) -> dict[str, dict[str, object]]:
    from app import users_service

    idle_sec = session_idle_timeout_seconds()
    rows: dict[str, dict[str, object]] = {}
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
            rows[tok] = dict(row)

    valid: dict[str, dict[str, object]] = {}
    for tok, row in rows.items():
        uid = str(row.get("user_id") or "").strip()
        user = users_service.get_app_user_by_id(uid)
        if not user or not users_service.app_user_has_password(user):
            continue
        display_name = (user.full_name or "").strip() or (user.username or "").strip() or uid
        row["display_name"] = display_name
        row["username"] = (user.username or "").strip()
        row["role"] = str(user.role or "").strip()
        valid[tok] = row
    return valid


def _chat_id_for(a: str, b: str) -> str:
    left, right = sorted((a, b))
    return f"{left}:{right}"


def cleanup_admin_chats() -> None:
    now = time.time()
    active = _active_admin_session_rows_unlocked(now)
    active_tokens = set(active)
    with _admin_chat_lock:
        for cid, chat in list(_admin_chats.items()):
            participants = tuple(chat.get("participants") or ())
            if len(participants) != 2 or not set(participants).issubset(active_tokens):
                _admin_chats.pop(cid, None)


def _serialize_admin_chat(
    chat: dict[str, object],
    *,
    current_tracking_id: str,
    active: dict[str, dict[str, object]],
    include_messages: bool,
) -> dict[str, object] | None:
    participants = tuple(str(p) for p in (chat.get("participants") or ()))
    if len(participants) != 2 or current_tracking_id not in participants:
        return None
    peer = participants[0] if participants[1] == current_tracking_id else participants[1]
    peer_row = active.get(peer)
    if not peer_row:
        return None
    messages = list(chat.get("messages") or [])
    unread = sum(
        1
        for msg in messages
        if str(msg.get("sender_session_id") or "") != current_tracking_id
        and current_tracking_id not in set(msg.get("read_by") or [])
    )
    out: dict[str, object] = {
        "chat_id": str(chat.get("chat_id") or ""),
        "peer_session_id": peer,
        "peer_display_name": str(peer_row.get("display_name") or "Admin"),
        "unread_count": unread,
        "updated_at": datetime.fromtimestamp(
            float(chat.get("updated_at") or time.time()), tz=timezone.utc
        ).isoformat(),
    }
    if include_messages:
        out["messages"] = [
            {
                "id": str(msg.get("id") or ""),
                "sender_session_id": str(msg.get("sender_session_id") or ""),
                "sender_display_name": str(msg.get("sender_display_name") or "Admin"),
                "body": str(msg.get("body") or ""),
                "sent_at": datetime.fromtimestamp(
                    float(msg.get("sent_at") or time.time()), tz=timezone.utc
                ).isoformat(),
                "is_mine": str(msg.get("sender_session_id") or "") == current_tracking_id,
            }
            for msg in messages
        ]
    return out


def list_admin_chats(current_tracking_id: str) -> list[dict[str, object]]:
    current_tok = str(current_tracking_id or "").strip()
    if not current_tok:
        return []
    now = time.time()
    active = _active_admin_session_rows_unlocked(now)
    active_tokens = set(active)
    with _admin_chat_lock:
        for cid, chat in list(_admin_chats.items()):
            participants = tuple(str(p) for p in (chat.get("participants") or ()))
            if len(participants) != 2 or not set(participants).issubset(active_tokens):
                _admin_chats.pop(cid, None)
        chats = [
            _serialize_admin_chat(
                chat,
                current_tracking_id=current_tok,
                active=active,
                include_messages=True,
            )
            for chat in _admin_chats.values()
        ]
    return sorted(
        [c for c in chats if c is not None],
        key=lambda c: str(c.get("updated_at") or ""),
        reverse=True,
    )


def start_admin_chat(current_tracking_id: str, peer_tracking_id: str) -> dict[str, object]:
    current_tok = str(current_tracking_id or "").strip()
    peer_tok = str(peer_tracking_id or "").strip()
    if not current_tok or not peer_tok or current_tok == peer_tok:
        raise HTTPException(status_code=400, detail="Choose another active admin.")
    now = time.time()
    active = _active_admin_session_rows_unlocked(now)
    if current_tok not in active or peer_tok not in active:
        raise HTTPException(status_code=404, detail="That admin is no longer active.")
    cid = _chat_id_for(current_tok, peer_tok)
    with _admin_chat_lock:
        chat = _admin_chats.get(cid)
        if chat is None:
            chat = {
                "chat_id": cid,
                "participants": tuple(sorted((current_tok, peer_tok))),
                "messages": [],
                "created_at": now,
                "updated_at": now,
            }
            _admin_chats[cid] = chat
        out = _serialize_admin_chat(
            chat,
            current_tracking_id=current_tok,
            active=active,
            include_messages=True,
        )
    if out is None:
        raise HTTPException(status_code=404, detail="Chat is no longer active.")
    return out


def add_admin_chat_message(
    current_tracking_id: str,
    chat_id: str,
    body: str,
) -> dict[str, object]:
    current_tok = str(current_tracking_id or "").strip()
    cid = str(chat_id or "").strip()
    text = str(body or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="Message is too long.")
    now = time.time()
    active = _active_admin_session_rows_unlocked(now)
    if current_tok not in active:
        raise HTTPException(status_code=401, detail="Not authenticated")
    with _admin_chat_lock:
        chat = _admin_chats.get(cid)
        if chat is None:
            raise HTTPException(status_code=404, detail="Chat is no longer active.")
        participants = tuple(str(p) for p in (chat.get("participants") or ()))
        if current_tok not in participants or not set(participants).issubset(set(active)):
            _admin_chats.pop(cid, None)
            raise HTTPException(status_code=404, detail="Chat is no longer active.")
        messages = list(chat.get("messages") or [])
        messages.append(
            {
                "id": uuid.uuid4().hex,
                "sender_session_id": current_tok,
                "sender_display_name": str(active[current_tok].get("display_name") or "Admin"),
                "body": text,
                "sent_at": now,
                "read_by": {current_tok},
            }
        )
        chat["messages"] = messages[-200:]
        chat["updated_at"] = now
        out = _serialize_admin_chat(
            chat,
            current_tracking_id=current_tok,
            active=active,
            include_messages=True,
        )
    if out is None:
        raise HTTPException(status_code=404, detail="Chat is no longer active.")
    return out


def mark_admin_chat_read(current_tracking_id: str, chat_id: str) -> dict[str, object]:
    current_tok = str(current_tracking_id or "").strip()
    cid = str(chat_id or "").strip()
    now = time.time()
    active = _active_admin_session_rows_unlocked(now)
    with _admin_chat_lock:
        chat = _admin_chats.get(cid)
        if chat is None:
            raise HTTPException(status_code=404, detail="Chat is no longer active.")
        participants = tuple(str(p) for p in (chat.get("participants") or ()))
        if current_tok not in participants or not set(participants).issubset(set(active)):
            _admin_chats.pop(cid, None)
            raise HTTPException(status_code=404, detail="Chat is no longer active.")
        for msg in list(chat.get("messages") or []):
            read_by = set(msg.get("read_by") or [])
            read_by.add(current_tok)
            msg["read_by"] = read_by
        out = _serialize_admin_chat(
            chat,
            current_tracking_id=current_tok,
            active=active,
            include_messages=True,
        )
    if out is None:
        raise HTTPException(status_code=404, detail="Chat is no longer active.")
    return out


def _serialize_admin_logout_challenge(challenge: dict[str, object]) -> dict[str, object]:
    deadline = float(challenge.get("deadline_at") or time.time())
    return {
        "id": str(challenge.get("id") or ""),
        "requester_session_id": str(challenge.get("requester_session_id") or ""),
        "requester_display_name": str(challenge.get("requester_display_name") or "Admin"),
        "target_session_id": str(challenge.get("target_session_id") or ""),
        "target_display_name": str(challenge.get("target_display_name") or "Admin"),
        "deadline_at": datetime.fromtimestamp(deadline, tz=timezone.utc).isoformat(),
        "seconds_remaining": max(0, int(round(deadline - time.time()))),
    }


def apply_expired_admin_logout_challenge(request: Request) -> bool:
    tok = _session_tracking_id(request, create=False)
    current_tok = str(tok or "").strip()
    if not current_tok:
        return False
    now = time.time()
    expired = False
    with _admin_logout_challenge_lock:
        for cid, challenge in list(_admin_logout_challenges.items()):
            if str(challenge.get("target_session_id") or "") != current_tok:
                continue
            if float(challenge.get("deadline_at") or 0.0) <= now:
                _admin_logout_challenges.pop(cid, None)
                expired = True
    if not expired:
        return False
    with _active_session_lock:
        _active_sessions.pop(current_tok, None)
    remember_invalidated_session_tracking_token(current_tok)
    request.session.clear()
    cleanup_admin_chats()
    return True


def list_admin_logout_challenges(current_tracking_id: str) -> list[dict[str, object]]:
    current_tok = str(current_tracking_id or "").strip()
    if not current_tok:
        return []
    now = time.time()
    active = _active_admin_session_rows_unlocked(now)
    active_tokens = set(active)
    out: list[dict[str, object]] = []
    with _admin_logout_challenge_lock:
        for cid, challenge in list(_admin_logout_challenges.items()):
            target = str(challenge.get("target_session_id") or "")
            requester = str(challenge.get("requester_session_id") or "")
            deadline = float(challenge.get("deadline_at") or 0.0)
            if target not in active_tokens or requester not in active_tokens:
                _admin_logout_challenges.pop(cid, None)
                continue
            if deadline <= now:
                if target != current_tok:
                    _admin_logout_challenges.pop(cid, None)
                continue
            if target == current_tok:
                out.append(_serialize_admin_logout_challenge(challenge))
    return out


def request_admin_logout_challenge(
    current_tracking_id: str,
    target_tracking_id: str,
) -> dict[str, object]:
    current_tok = str(current_tracking_id or "").strip()
    target_tok = str(target_tracking_id or "").strip()
    if not current_tok or not target_tok or current_tok == target_tok:
        raise HTTPException(status_code=400, detail="Choose another active admin.")
    now = time.time()
    active = _active_admin_session_rows_unlocked(now)
    if current_tok not in active or target_tok not in active:
        raise HTTPException(status_code=404, detail="That admin is no longer active.")
    with _admin_logout_challenge_lock:
        for cid, challenge in list(_admin_logout_challenges.items()):
            if str(challenge.get("target_session_id") or "") == target_tok:
                _admin_logout_challenges.pop(cid, None)
        cid = uuid.uuid4().hex
        challenge = {
            "id": cid,
            "requester_session_id": current_tok,
            "requester_display_name": str(active[current_tok].get("display_name") or "Admin"),
            "target_session_id": target_tok,
            "target_display_name": str(active[target_tok].get("display_name") or "Admin"),
            "created_at": now,
            "deadline_at": now + 30.0,
        }
        _admin_logout_challenges[cid] = challenge
        return _serialize_admin_logout_challenge(challenge)


def cancel_admin_logout_challenge(
    current_tracking_id: str,
    challenge_id: str,
) -> dict[str, object]:
    current_tok = str(current_tracking_id or "").strip()
    cid = str(challenge_id or "").strip()
    with _admin_logout_challenge_lock:
        challenge = _admin_logout_challenges.get(cid)
        if not challenge or str(challenge.get("target_session_id") or "") != current_tok:
            raise HTTPException(status_code=404, detail="Logout request is no longer active.")
        requester = str(challenge.get("requester_session_id") or "")
        _admin_logout_challenges.pop(cid, None)
    chat = start_admin_chat(current_tok, requester)
    return add_admin_chat_message(current_tok, str(chat.get("chat_id") or ""), "I'm still here")


def complete_admin_logout_challenge(
    request: Request,
    challenge_id: str,
) -> None:
    current_tok = str(_session_tracking_id(request, create=False) or "").strip()
    cid = str(challenge_id or "").strip()
    with _admin_logout_challenge_lock:
        challenge = _admin_logout_challenges.get(cid)
        if not challenge or str(challenge.get("target_session_id") or "") != current_tok:
            raise HTTPException(status_code=404, detail="Logout request is no longer active.")
        _admin_logout_challenges.pop(cid, None)
    with _active_session_lock:
        _active_sessions.pop(current_tok, None)
    remember_invalidated_session_tracking_token(current_tok)
    request.session.clear()
    cleanup_admin_chats()


def require_admin_user_id(request: Request) -> str:
    from app.users_service import get_app_user_by_id

    uid = require_authenticated_user_id(request)
    row = get_app_user_by_id(uid)
    if not row or not user_role_is_admin(row.role):
        raise HTTPException(status_code=403, detail="Admin access required")
    return uid
