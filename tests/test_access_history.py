from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from starlette.requests import Request

from app.access_history import (
    create_access_log,
    get_or_create_webadmin_session_id,
    pop_webadmin_session_id,
    request_client_ip,
)
from app.models import AccessSessionLog, Base, Firewall


def _request_with_session(headers: list[tuple[bytes, bytes]] | None = None) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "scheme": "https",
        "server": ("testserver", 443),
        "path": "/",
        "query_string": b"",
        "headers": headers or [],
        "session": {},
    }
    return Request(scope)


def test_webadmin_session_id_create_and_pop_roundtrip():
    req = _request_with_session()
    sid = get_or_create_webadmin_session_id(req, 105)
    assert sid
    assert sid == get_or_create_webadmin_session_id(req, 105)
    popped = pop_webadmin_session_id(req, 105)
    assert popped == sid
    assert pop_webadmin_session_id(req, 105) is None


def test_request_client_ip_prefers_x_forwarded_for():
    req = _request_with_session(
        headers=[(b"x-forwarded-for", b"10.1.2.3, 127.0.0.1")]
    )
    assert request_client_ip(req) == "10.1.2.3"


def test_create_access_log_persists_row():
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        fw = Firewall(host="fw.example", port=4444, username="admin", verify_ssl=False)
        db.add(fw)
        db.commit()
        db.refresh(fw)

        create_access_log(
            db,
            session_id="sess-1",
            firewall_id=fw.id,
            access_type="ssh",
            event_kind="start",
            connected_successfully=True,
            initiated_by_user_id="u-1",
            initiated_by_username="alan",
            client_ip="127.0.0.1",
            details="shell-active",
        )
        row = db.query(AccessSessionLog).one()
        assert row.session_id == "sess-1"
        assert row.access_type == "ssh"
        assert row.event_kind == "start"
        assert row.connected_successfully is True
        assert row.initiated_by_username == "alan"
    finally:
        db.close()
