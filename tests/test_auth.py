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
    browser_websocket_origin_error,
    evaluate_session_idle,
    hash_password,
    require_admin_user_id,
    require_authenticated_user_id,
    session_idle_timeout_seconds,
    session_user_id,
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


def test_browser_websocket_origin_error_rejects_missing():
    req = _ws_conn(None)
    assert browser_websocket_origin_error(req) == "Missing WebSocket Origin."


def test_browser_websocket_origin_error_rejects_cross_origin():
    req = _ws_conn("https://evil.example")
    assert browser_websocket_origin_error(req) == "WebSocket Origin is not allowed."


def test_browser_websocket_origin_error_accepts_same_origin():
    req = _ws_conn("https://testserver")
    assert browser_websocket_origin_error(req) is None
