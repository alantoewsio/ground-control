"""Short-lived launch tokens that bind proxy access to a browser session click."""

from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass

from starlette.requests import HTTPConnection

from app.auth import SESSION_TRACKING_ID_KEY, session_user_id

TOKEN_QUERY_PARAM = "gc_launch"
DEFAULT_TOKEN_TTL_SECONDS = 90.0

_TOK_LOCK = threading.Lock()
_TOKENS: dict[str, "LaunchToken"] = {}


@dataclass
class LaunchToken:
    token: str
    session_tracking_id: str
    user_id: str
    firewall_id: int
    access_type: str
    issued_at: float
    expires_at: float


def _cleanup_expired(now: float) -> None:
    stale = [k for k, v in _TOKENS.items() if now >= v.expires_at]
    for k in stale:
        _TOKENS.pop(k, None)


def issue_launch_token(
    conn: HTTPConnection,
    *,
    firewall_id: int,
    access_type: str,
    ttl_seconds: float = DEFAULT_TOKEN_TTL_SECONDS,
) -> str:
    uid = (session_user_id(conn) or "").strip()
    if not uid:
        raise ValueError("missing authenticated user session")
    tracking_id = str(conn.session.get(SESSION_TRACKING_ID_KEY) or "").strip()
    if not tracking_id:
        raise ValueError("missing session tracking id")
    now = time.time()
    tok = secrets.token_urlsafe(24)
    row = LaunchToken(
        token=tok,
        session_tracking_id=tracking_id,
        user_id=uid,
        firewall_id=int(firewall_id),
        access_type=(access_type or "").strip().lower(),
        issued_at=now,
        expires_at=now + max(5.0, float(ttl_seconds)),
    )
    with _TOK_LOCK:
        _cleanup_expired(now)
        _TOKENS[tok] = row
    return tok


def validate_and_consume_launch_token(
    conn: HTTPConnection,
    *,
    token: str,
    firewall_id: int,
    access_type: str,
    require_session_match: bool = True,
) -> tuple[bool, str | None]:
    tok = (token or "").strip()
    if not tok:
        return False, "Missing launch token."
    now = time.time()
    uid = (session_user_id(conn) or "").strip()
    tracking_id = str(conn.session.get(SESSION_TRACKING_ID_KEY) or "").strip()
    expected_type = (access_type or "").strip().lower()
    with _TOK_LOCK:
        _cleanup_expired(now)
        row = _TOKENS.pop(tok, None)
    if row is None:
        return False, "Launch token is invalid or expired."
    if now >= row.expires_at:
        return False, "Launch token expired."
    if row.firewall_id != int(firewall_id) or row.access_type != expected_type:
        return False, "Launch token target mismatch."
    if require_session_match:
        if not uid or uid != row.user_id:
            return False, "Launch token user mismatch."
        if not tracking_id or tracking_id != row.session_tracking_id:
            return False, "Launch token session mismatch."
    return True, None
