"""Immediate TCP monitor probe after firewall API test."""

from __future__ import annotations

from unittest.mock import patch

from app.models import Firewall
from app.monitor_probe import ProbeResult
from app.monitor_scheduler import run_immediate_firewall_webadmin_probe


def test_immediate_probe_updates_last_online_when_tcp_ok(main_session):
    fw = Firewall(host="10.0.0.1", port=4444, username="a", monitor_enabled=False)
    main_session.add(fw)
    main_session.commit()
    fid = int(fw.id)

    with patch("app.monitor_scheduler._probe_worker", return_value=ProbeResult(fid, 12.5, None)):
        assert run_immediate_firewall_webadmin_probe(fid) is True

    main_session.expire_all()
    row = main_session.get(Firewall, fid)
    assert row is not None
    assert row.last_online_at is not None


def test_immediate_probe_returns_false_when_tcp_fails(main_session):
    fw = Firewall(host="10.0.0.2", port=4444, username="a", monitor_enabled=False)
    main_session.add(fw)
    main_session.commit()
    fid = int(fw.id)

    with patch(
        "app.monitor_scheduler._probe_worker",
        return_value=ProbeResult(fid, None, "refused"),
    ):
        assert run_immediate_firewall_webadmin_probe(fid) is False

    main_session.expire_all()
    row = main_session.get(Firewall, fid)
    assert row is not None
    assert row.last_online_at is None


def test_immediate_probe_unknown_firewall():
    assert run_immediate_firewall_webadmin_probe(999_999_999) is None


def test_immediate_probe_writes_monitor_row_when_enabled(main_session):
    from app.monitor_database import MonitorSessionLocal, init_monitor_db
    from app.monitor_models import FirewallWebadminPing

    init_monitor_db()
    fw = Firewall(host="10.0.0.3", port=4444, username="a", monitor_enabled=True)
    main_session.add(fw)
    main_session.commit()
    fid = int(fw.id)

    with patch("app.monitor_scheduler._probe_worker", return_value=ProbeResult(fid, 8.0, None)):
        assert run_immediate_firewall_webadmin_probe(fid) is True

    with MonitorSessionLocal() as mdb:
        n = (
            mdb.query(FirewallWebadminPing)
            .filter(FirewallWebadminPing.firewall_id == fid)
            .count()
        )
        assert n == 1
