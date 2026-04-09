"""Inventory: last config-sync error per firewall (for row indicator)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.main import _firewall_last_sync_error_by_id
from app.models import Firewall, FirewallConfigSyncRun


def _rid() -> str:
    return str(uuid.uuid4())


def test_last_sync_error_map_empty_when_no_runs(main_session) -> None:
    fw = Firewall(host="10.0.0.1", port=4444, username="a")
    main_session.add(fw)
    main_session.commit()
    assert _firewall_last_sync_error_by_id(main_session, [int(fw.id)]) == {}


def test_last_sync_error_map_ignores_success_latest(main_session) -> None:
    fw = Firewall(host="10.0.0.2", port=4444, username="a")
    main_session.add(fw)
    main_session.commit()
    fid = int(fw.id)
    t0 = datetime.now(timezone.utc)
    main_session.add(
        FirewallConfigSyncRun(
            id=_rid(),
            firewall_id=fid,
            started_at=t0,
            finished_at=t0,
            status="error",
            error_message="old",
        )
    )
    main_session.commit()
    t1 = t0 + timedelta(seconds=2)
    main_session.add(
        FirewallConfigSyncRun(
            id=_rid(),
            firewall_id=fid,
            started_at=t1,
            finished_at=t1,
            status="success",
            error_message=None,
        )
    )
    main_session.commit()
    assert _firewall_last_sync_error_by_id(main_session, [fid]) == {}


def test_last_sync_error_map_uses_latest_finished_error(main_session) -> None:
    fw = Firewall(host="10.0.0.3", port=4444, username="a")
    main_session.add(fw)
    main_session.commit()
    fid = int(fw.id)
    t0 = datetime.now(timezone.utc)
    main_session.add(
        FirewallConfigSyncRun(
            id=_rid(),
            firewall_id=fid,
            started_at=t0,
            finished_at=t0,
            status="success",
            error_message=None,
        )
    )
    main_session.commit()
    t1 = t0 + timedelta(seconds=2)
    main_session.add(
        FirewallConfigSyncRun(
            id=_rid(),
            firewall_id=fid,
            started_at=t1,
            finished_at=t1,
            status="error",
            error_message="connection refused",
        )
    )
    main_session.commit()
    m = _firewall_last_sync_error_by_id(main_session, [fid])
    assert m == {fid: "connection refused"}
