"""Config sync short-circuits when monitoring shows the firewall offline."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app import crypto
from app.firewall_config_sync import run_firewall_config_sync
from app.models import Firewall
from app.secrets_database import upsert_firewall_password_encrypted


@pytest.fixture
def _patch_fetch(monkeypatch: pytest.MonkeyPatch):
    calls: list[int] = []

    def _fake_fetch(*_a, **_k):
        calls.append(1)
        return None, "fetch should not run"

    import app.firewall_config_sync as fcs

    monkeypatch.setattr(fcs, "_fetch_remote_payloads", _fake_fetch)
    return calls


def test_config_sync_skips_offline_firewall_before_fetch(
    main_session,
    secrets_session,
    _patch_fetch: list[int],
) -> None:
    fw = Firewall(
        host="10.254.254.254",
        port=4444,
        username="admin",
        monitor_enabled=True,
        monitor_interval_minutes=5,
        last_online_at=None,
    )
    main_session.add(fw)
    main_session.commit()
    fid = int(fw.id)

    r = run_firewall_config_sync(
        main_session,
        secrets_session,
        fid,
        entities=["interface"],
        entities_explicit=True,
    )
    assert r.get("ok") is True
    assert r.get("skipped") is True
    assert "offline" in (r.get("message") or "").lower()
    assert _patch_fetch == []


def test_config_sync_reaches_fetch_when_monitor_disabled(
    main_session,
    secrets_session,
    _patch_fetch: list[int],
) -> None:
    fw = Firewall(
        host="10.254.254.254",
        port=4444,
        username="admin",
        monitor_enabled=False,
        monitor_interval_minutes=5,
        last_online_at=None,
    )
    main_session.add(fw)
    main_session.commit()
    fid = int(fw.id)
    upsert_firewall_password_encrypted(
        secrets_session, fid, crypto.encrypt_secret("x")
    )
    secrets_session.commit()

    r = run_firewall_config_sync(
        main_session,
        secrets_session,
        fid,
        entities=["interface"],
        entities_explicit=True,
    )
    assert r.get("ok") is False
    assert _patch_fetch == [1]


def test_config_sync_reaches_fetch_when_online(
    main_session,
    secrets_session,
    _patch_fetch: list[int],
) -> None:
    now = datetime.now(timezone.utc)
    fw = Firewall(
        host="10.254.254.254",
        port=4444,
        username="admin",
        monitor_enabled=True,
        monitor_interval_minutes=5,
        last_online_at=now,
    )
    main_session.add(fw)
    main_session.commit()
    fid = int(fw.id)
    upsert_firewall_password_encrypted(
        secrets_session, fid, crypto.encrypt_secret("x")
    )
    secrets_session.commit()

    r = run_firewall_config_sync(
        main_session,
        secrets_session,
        fid,
        entities=["interface"],
        entities_explicit=True,
    )
    assert r.get("ok") is False
    assert _patch_fetch == [1]


def test_config_sync_skips_stale_last_online(
    main_session,
    secrets_session,
    _patch_fetch: list[int],
) -> None:
    stale = datetime.now(timezone.utc) - timedelta(hours=48)
    fw = Firewall(
        host="10.254.254.254",
        port=4444,
        username="admin",
        monitor_enabled=True,
        monitor_interval_minutes=5,
        last_online_at=stale,
    )
    main_session.add(fw)
    main_session.commit()
    fid = int(fw.id)

    r = run_firewall_config_sync(
        main_session,
        secrets_session,
        fid,
        entities=["interface"],
        entities_explicit=True,
    )
    assert r.get("skipped") is True
    assert _patch_fetch == []
