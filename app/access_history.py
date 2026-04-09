from __future__ import annotations

import uuid

from sqlalchemy.orm import Session
from starlette.requests import HTTPConnection

from app.auth import session_user_id
from app.models import AccessSessionLog
from app.users_service import username_for_user_id

_WEBADMIN_SESSION_KEY = "gc_webadmin_access_session_ids"
# One "proxied-login" audit row per firewall per GC browser session (avoid duplicates after gate opens).
_WEBADMIN_PROXIED_LOGIN_AUDIT_KEY = "gc_webadmin_proxied_login_audit"


def should_log_webadmin_proxied_start(conn: HTTPConnection, firewall_id: int) -> bool:
    box = conn.session.get(_WEBADMIN_PROXIED_LOGIN_AUDIT_KEY)
    if not isinstance(box, dict):
        return True
    return not bool(box.get(str(int(firewall_id))))


def mark_webadmin_proxied_start_logged(conn: HTTPConnection, firewall_id: int) -> None:
    box = conn.session.get(_WEBADMIN_PROXIED_LOGIN_AUDIT_KEY)
    if not isinstance(box, dict):
        box = {}
    box[str(int(firewall_id))] = True
    conn.session[_WEBADMIN_PROXIED_LOGIN_AUDIT_KEY] = box


def request_client_ip(conn: HTTPConnection) -> str | None:
    xff = (conn.headers.get("x-forwarded-for") or "").strip()
    if xff:
        first = xff.split(",", 1)[0].strip()
        if first:
            return first
    xrip = (conn.headers.get("x-real-ip") or "").strip()
    if xrip:
        return xrip
    client = getattr(conn, "client", None)
    host = getattr(client, "host", None) if client is not None else None
    if host and str(host).strip():
        return str(host).strip()
    return None


def request_actor(conn: HTTPConnection) -> tuple[str | None, str | None]:
    uid = session_user_id(conn)
    if not uid:
        return None, None
    uname = username_for_user_id(uid).strip() or None
    return uid, uname


def create_access_log(
    db: Session,
    *,
    session_id: str,
    firewall_id: int | None,
    access_type: str,
    event_kind: str,
    connected_successfully: bool,
    initiated_by_user_id: str | None,
    initiated_by_username: str | None,
    client_ip: str | None,
    details: str | None = None,
) -> AccessSessionLog:
    row = AccessSessionLog(
        session_id=str(session_id).strip(),
        firewall_id=firewall_id,
        access_type=(access_type or "").strip().lower(),
        event_kind=(event_kind or "").strip().lower(),
        connected_successfully=bool(connected_successfully),
        initiated_by_user_id=(initiated_by_user_id or "").strip() or None,
        initiated_by_username=(initiated_by_username or "").strip() or None,
        client_ip=(client_ip or "").strip() or None,
        details=(details or "").strip() or None,
    )
    db.add(row)
    db.commit()
    return row


def get_or_create_webadmin_session_id(conn: HTTPConnection, firewall_id: int) -> str:
    box = conn.session.get(_WEBADMIN_SESSION_KEY)
    mapping = box if isinstance(box, dict) else {}
    key = str(int(firewall_id))
    sid = str(mapping.get(key) or "").strip()
    if sid:
        return sid
    sid = str(uuid.uuid4())
    mapping[key] = sid
    conn.session[_WEBADMIN_SESSION_KEY] = mapping
    return sid


def pop_webadmin_session_id(conn: HTTPConnection, firewall_id: int) -> str | None:
    box = conn.session.get(_WEBADMIN_SESSION_KEY)
    if not isinstance(box, dict):
        return None
    key = str(int(firewall_id))
    raw = box.pop(key, None)
    conn.session[_WEBADMIN_SESSION_KEY] = box
    sid = str(raw or "").strip()
    abox = conn.session.get(_WEBADMIN_PROXIED_LOGIN_AUDIT_KEY)
    if isinstance(abox, dict) and key in abox:
        abox.pop(key, None)
        conn.session[_WEBADMIN_PROXIED_LOGIN_AUDIT_KEY] = abox
    return sid or None


def has_webadmin_session_id(conn: HTTPConnection, firewall_id: int) -> bool:
    box = conn.session.get(_WEBADMIN_SESSION_KEY)
    if not isinstance(box, dict):
        return False
    key = str(int(firewall_id))
    return bool(str(box.get(key) or "").strip())
