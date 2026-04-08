from __future__ import annotations

from starlette.requests import Request

from app.access_launch_tokens import (
    issue_launch_token,
    validate_and_consume_launch_token,
)
from app.auth import SESSION_TRACKING_ID_KEY, SESSION_USER_ID_KEY


def _req(uid: str = "u1", tracking: str = "s1") -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "scheme": "https",
        "path": "/",
        "query_string": b"",
        "headers": [],
        "session": {
            SESSION_USER_ID_KEY: uid,
            SESSION_TRACKING_ID_KEY: tracking,
        },
        "client": ("127.0.0.1", 1234),
        "server": ("testserver", 443),
    }
    return Request(scope)


def test_launch_token_issue_and_consume_success():
    req = _req()
    tok = issue_launch_token(req, firewall_id=9, access_type="webadmin")
    ok, err = validate_and_consume_launch_token(
        req,
        token=tok,
        firewall_id=9,
        access_type="webadmin",
    )
    assert ok is True
    assert err is None


def test_launch_token_is_single_use():
    req = _req()
    tok = issue_launch_token(req, firewall_id=9, access_type="ssh_ws")
    ok1, _ = validate_and_consume_launch_token(
        req,
        token=tok,
        firewall_id=9,
        access_type="ssh_ws",
    )
    ok2, err2 = validate_and_consume_launch_token(
        req,
        token=tok,
        firewall_id=9,
        access_type="ssh_ws",
    )
    assert ok1 is True
    assert ok2 is False
    assert err2


def test_launch_token_rejects_user_or_session_mismatch():
    req_issuer = _req(uid="u1", tracking="trk-a")
    tok = issue_launch_token(req_issuer, firewall_id=5, access_type="ssh_page")
    req_other = _req(uid="u2", tracking="trk-b")
    ok, err = validate_and_consume_launch_token(
        req_other,
        token=tok,
        firewall_id=5,
        access_type="ssh_page",
    )
    assert ok is False
    assert err


def test_launch_token_can_skip_session_match_when_requested():
    req_issuer = _req(uid="u1", tracking="trk-a")
    tok = issue_launch_token(req_issuer, firewall_id=5, access_type="ssh_ws")
    req_other = _req(uid="u2", tracking="trk-b")
    ok, err = validate_and_consume_launch_token(
        req_other,
        token=tok,
        firewall_id=5,
        access_type="ssh_ws",
        require_session_match=False,
    )
    assert ok is True
    assert err is None
