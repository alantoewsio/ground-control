"""Tests for ``app.auth``."""

from __future__ import annotations

import time
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.auth import (
    SESSION_LAST_ACTIVITY_KEY,
    SESSION_TRACKING_ID_KEY,
    SESSION_USER_ID_KEY,
    add_admin_chat_message,
    browser_websocket_origin_error,
    cancel_admin_logout_challenge,
    evaluate_session_idle,
    hash_password,
    list_admin_chats,
    list_admin_logout_challenges,
    list_active_admin_sessions,
    purge_invalidated_browser_session,
    register_authenticated_session,
    remember_invalidated_session_tracking_token,
    request_admin_logout_challenge,
    require_admin_user_id,
    require_authenticated_user_id,
    session_idle_timeout_seconds,
    session_user_id,
    start_admin_chat,
    touch_session_activity,
    validate_new_password,
    verify_password,
)


def _request_with_session(data: dict) -> MagicMock:
    req = MagicMock()
    req.session = data
    return req


def _ws_conn(origin: str | None) -> MagicMock:
    req = MagicMock()
    req.session = {
        SESSION_USER_ID_KEY: "u1",
        SESSION_TRACKING_ID_KEY: "trk-1",
    }
    req.headers = {"host": "testserver"}
    if origin is not None:
        req.headers["origin"] = origin
    req.url.scheme = "https"
    req.url.netloc = "testserver"
    req.client.host = "127.0.0.1"
    return req


def test_hash_verify_password():
    h = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", h) is True
    assert verify_password("wrong", h) is False
    assert verify_password("x", None) is False
    assert verify_password("x", "   ") is False


def test_validate_new_password():
    validate_new_password("1234567890")  # 10 chars
    with pytest.raises(HTTPException) as ei:
        validate_new_password("short")
    assert ei.value.status_code == 400
    with pytest.raises(HTTPException) as ei2:
        validate_new_password("x" * 257)
    assert ei2.value.status_code == 400


def test_session_user_id():
    assert session_user_id(_request_with_session({})) is None
    assert session_user_id(_request_with_session({SESSION_USER_ID_KEY: "  "})) is None
    assert session_user_id(_request_with_session({SESSION_USER_ID_KEY: "abc"})) == "abc"


def test_touch_and_evaluate_idle():
    req = _request_with_session({SESSION_LAST_ACTIVITY_KEY: time.time()})
    touch_session_activity(req)
    assert SESSION_LAST_ACTIVITY_KEY in req.session
    state, _ = evaluate_session_idle(req, 3600.0)
    assert state == "ok"


def test_list_active_admin_sessions_marks_current(monkeypatch, secrets_session):
    from app import users_service
    from app.secrets_models import AppUser

    users_service.ensure_default_admin_user(secrets_session)
    row = secrets_session.query(AppUser).one()
    row.password_hash = hash_password("password12345")
    row.role = "admin"
    secrets_session.commit()

    req = _request_with_session(
        {
            SESSION_USER_ID_KEY: row.id,
            SESSION_TRACKING_ID_KEY: "trk-current",
        }
    )
    req.headers = {}
    req.client.host = "127.0.0.1"
    register_authenticated_session(
        req,
        user_id=row.id,
        username=row.username,
        full_name=row.full_name,
        role=row.role,
    )
    monkeypatch.setattr(
        "app.users_service.get_app_user_by_id",
        lambda uid: secrets_session.get(AppUser, uid),
    )

    admins = list_active_admin_sessions(current_tracking_id="trk-current")

    assert len(admins) == 1
    assert admins[0]["is_current"] is True
    assert admins[0]["role"] == "admin"


def test_list_active_admin_sessions_includes_non_admin_roles(monkeypatch, secrets_session):
    from app import users_service
    from app.secrets_models import AppUser

    users_service.ensure_default_admin_user(secrets_session)
    row = secrets_session.query(AppUser).one()
    row.password_hash = hash_password("password12345")
    row.role = "ReadOnly"
    secrets_session.commit()

    req = _request_with_session(
        {
            SESSION_USER_ID_KEY: row.id,
            SESSION_TRACKING_ID_KEY: "trk-readonly",
        }
    )
    req.headers = {}
    req.client.host = "127.0.0.1"
    register_authenticated_session(
        req,
        user_id=row.id,
        username=row.username,
        full_name=row.full_name,
        role=row.role,
    )
    monkeypatch.setattr(
        "app.users_service.get_app_user_by_id",
        lambda uid: secrets_session.get(AppUser, uid),
    )

    sessions = list_active_admin_sessions(current_tracking_id="trk-readonly")

    current = [s for s in sessions if s.get("session_id") == "trk-readonly"]
    assert len(current) == 1
    assert current[0]["is_current"] is True
    assert current[0]["role"] == "ReadOnly"


def test_admin_chat_messages_and_unread(monkeypatch, secrets_session):
    from app import users_service
    from app.secrets_models import AppUser

    users_service.ensure_default_admin_user(secrets_session)
    row1 = secrets_session.query(AppUser).filter(AppUser.username == "admin").one()
    row1.password_hash = hash_password("password12345")
    row1.role = "admin"
    row2 = AppUser(
        id="chat-admin-2",
        username="admin2",
        role="admin",
        password_hash=hash_password("password12345"),
    )
    secrets_session.add(row2)
    secrets_session.commit()

    req1 = _request_with_session(
        {SESSION_USER_ID_KEY: row1.id, SESSION_TRACKING_ID_KEY: "trk-chat-1"}
    )
    req1.headers = {}
    req1.client.host = "127.0.0.1"
    req2 = _request_with_session(
        {SESSION_USER_ID_KEY: row2.id, SESSION_TRACKING_ID_KEY: "trk-chat-2"}
    )
    req2.headers = {}
    req2.client.host = "127.0.0.2"
    register_authenticated_session(req1, user_id=row1.id, username=row1.username, role=row1.role)
    register_authenticated_session(req2, user_id=row2.id, username=row2.username, role=row2.role)
    monkeypatch.setattr(
        "app.users_service.get_app_user_by_id",
        lambda uid: secrets_session.get(AppUser, uid),
    )

    started = start_admin_chat("trk-chat-1", "trk-chat-2")
    payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>'
    chat = add_admin_chat_message(
        "trk-chat-1",
        str(started["chat_id"]),
        payload,
    )

    assert chat["messages"][0]["is_mine"] is True
    peer_chats = list_admin_chats("trk-chat-2")
    assert peer_chats[0]["unread_count"] == 1
    assert peer_chats[0]["messages"][0]["body"] == payload
    secrets_session.delete(row2)
    secrets_session.commit()


def test_admin_logout_challenge_still_here_sends_chat(monkeypatch, secrets_session):
    from app import users_service
    from app.secrets_models import AppUser

    users_service.ensure_default_admin_user(secrets_session)
    row1 = secrets_session.query(AppUser).filter(AppUser.username == "admin").one()
    row1.password_hash = hash_password("password12345")
    row1.role = "admin"
    row2 = AppUser(
        id="logout-admin-2",
        username="logout_admin2",
        role="admin",
        password_hash=hash_password("password12345"),
    )
    secrets_session.add(row2)
    secrets_session.commit()
    req1 = _request_with_session(
        {SESSION_USER_ID_KEY: row1.id, SESSION_TRACKING_ID_KEY: "trk-logout-1"}
    )
    req1.headers = {}
    req1.client.host = "127.0.0.1"
    req2 = _request_with_session(
        {SESSION_USER_ID_KEY: row2.id, SESSION_TRACKING_ID_KEY: "trk-logout-2"}
    )
    req2.headers = {}
    req2.client.host = "127.0.0.2"
    register_authenticated_session(req1, user_id=row1.id, username=row1.username, role=row1.role)
    register_authenticated_session(req2, user_id=row2.id, username=row2.username, role=row2.role)
    monkeypatch.setattr(
        "app.users_service.get_app_user_by_id",
        lambda uid: secrets_session.get(AppUser, uid),
    )

    challenge = request_admin_logout_challenge("trk-logout-1", "trk-logout-2")
    assert list_admin_logout_challenges("trk-logout-2")[0]["id"] == challenge["id"]

    chat = cancel_admin_logout_challenge("trk-logout-2", str(challenge["id"]))

    assert chat["messages"][-1]["body"] == "I'm still here"
    assert list_admin_logout_challenges("trk-logout-2") == []
    requester_chats = list_admin_chats("trk-logout-1")
    assert requester_chats[0]["unread_count"] == 1
    assert requester_chats[0]["messages"][-1]["body"] == "I'm still here"
    secrets_session.delete(row2)
    secrets_session.commit()


def test_evaluate_idle_disabled():
    req = _request_with_session({SESSION_LAST_ACTIVITY_KEY: 0})
    state, _ = evaluate_session_idle(req, 0.0)
    assert state == "ok"


def test_evaluate_idle_expires():
    req = _request_with_session(
        {
            SESSION_USER_ID_KEY: "u1",
            SESSION_LAST_ACTIVITY_KEY: time.time() - 99999,
        }
    )
    state, uid = evaluate_session_idle(req, 60.0)
    assert state == "expired"
    assert uid == "u1"
    assert req.session == {}


def test_purge_invalidated_browser_session_clears_stale_cookie():
    req = _request_with_session(
        {
            SESSION_USER_ID_KEY: "u1",
            SESSION_TRACKING_ID_KEY: "tok-race",
            SESSION_LAST_ACTIVITY_KEY: time.time(),
        }
    )
    remember_invalidated_session_tracking_token("tok-race")
    assert purge_invalidated_browser_session(req) is True
    assert req.session == {}


def test_purge_invalidated_browser_session_skips_active_tracking():
    req = _request_with_session(
        {
            SESSION_USER_ID_KEY: "u1",
            SESSION_TRACKING_ID_KEY: "tok-active",
        }
    )
    assert purge_invalidated_browser_session(req) is False
    assert session_user_id(req) == "u1"


def test_evaluate_idle_expire_blocks_resurrected_cookie_with_same_tracking_id():
    req = _request_with_session(
        {
            SESSION_USER_ID_KEY: "u1",
            SESSION_TRACKING_ID_KEY: "tok-idle",
            SESSION_LAST_ACTIVITY_KEY: time.time() - 99999,
        }
    )
    state, _ = evaluate_session_idle(req, 60.0)
    assert state == "expired"
    stale = _request_with_session(
        {
            SESSION_USER_ID_KEY: "u1",
            SESSION_TRACKING_ID_KEY: "tok-idle",
            SESSION_LAST_ACTIVITY_KEY: time.time(),
        }
    )
    assert purge_invalidated_browser_session(stale) is True
    assert stale.session == {}


def test_session_idle_timeout_seconds(monkeypatch):
    monkeypatch.setenv("GROUND_CONTROL_SESSION_IDLE_MINUTES", "0")
    assert session_idle_timeout_seconds() == 0.0
    monkeypatch.setenv("GROUND_CONTROL_SESSION_IDLE_MINUTES", "2")
    assert session_idle_timeout_seconds() == 120.0


def test_require_authenticated_missing():
    with pytest.raises(HTTPException) as ei:
        require_authenticated_user_id(_request_with_session({}))
    assert ei.value.status_code == 401


def test_require_authenticated_ok(monkeypatch, secrets_session):
    from app import users_service
    from app.secrets_models import AppUser

    users_service.ensure_default_admin_user(secrets_session)
    row = secrets_session.query(AppUser).one()
    row.password_hash = hash_password("password12345")
    secrets_session.commit()

    req = _request_with_session({SESSION_USER_ID_KEY: row.id})
    monkeypatch.setattr(
        "app.users_service.get_app_user_by_id",
        lambda uid: secrets_session.get(AppUser, uid),
    )
    assert require_authenticated_user_id(req) == row.id


def test_require_admin_forbidden(monkeypatch, secrets_session):
    from app import users_service
    from app.secrets_models import AppUser

    users_service.ensure_default_admin_user(secrets_session)
    row = secrets_session.query(AppUser).one()
    row.password_hash = hash_password("password12345")
    row.role = "user"
    secrets_session.commit()
    req = _request_with_session({SESSION_USER_ID_KEY: row.id})
    monkeypatch.setattr(
        "app.users_service.get_app_user_by_id",
        lambda uid: secrets_session.get(AppUser, uid),
    )
    monkeypatch.setattr(
        "app.auth.require_authenticated_user_id",
        lambda r: row.id,
    )
    with pytest.raises(HTTPException) as ei:
        require_admin_user_id(req)
    assert ei.value.status_code == 403


def test_require_admin_ok(monkeypatch, secrets_session):
    from app import users_service
    from app.secrets_models import AppUser

    users_service.ensure_default_admin_user(secrets_session)
    row = secrets_session.query(AppUser).one()
    row.password_hash = hash_password("password12345")
    row.role = "admin"
    secrets_session.commit()
    req = _request_with_session({SESSION_USER_ID_KEY: row.id})
    monkeypatch.setattr(
        "app.users_service.get_app_user_by_id",
        lambda uid: secrets_session.get(AppUser, uid),
    )
    monkeypatch.setattr(
        "app.auth.require_authenticated_user_id",
        lambda r: row.id,
    )
    assert require_admin_user_id(req) == row.id


def test_update_app_user_username(secrets_session):
    import uuid

    from app import users_service
    from app.secrets_models import AppUser

    users_service.ensure_default_admin_user(secrets_session)
    row = secrets_session.query(AppUser).one()
    uid = row.id
    other = AppUser(
        id=str(uuid.uuid4()),
        username="otheruser",
        role="ReadOnly",
        password_hash=hash_password("password12345"),
    )
    secrets_session.add(other)
    secrets_session.commit()
    out = users_service.update_app_user_username(secrets_session, uid, "RenamedAdmin")
    assert out is not None
    assert out["username"] == "RenamedAdmin"
    secrets_session.refresh(row)
    assert row.username == "RenamedAdmin"
    with pytest.raises(ValueError, match="already taken"):
        users_service.update_app_user_username(secrets_session, uid, "otheruser")


def test_browser_websocket_origin_error_rejects_missing():
    req = _ws_conn(None)
    assert browser_websocket_origin_error(req) == "Missing WebSocket Origin."


def test_browser_websocket_origin_error_rejects_cross_origin():
    req = _ws_conn("https://evil.example")
    assert browser_websocket_origin_error(req) == "WebSocket Origin is not allowed."


def test_browser_websocket_origin_error_accepts_same_origin():
    req = _ws_conn("https://testserver")
    assert browser_websocket_origin_error(req) is None
