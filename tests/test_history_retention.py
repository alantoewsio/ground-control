"""Tests for history retention sweeps (age + size limits)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import app.config as config
from app import data_management
from app.database import SessionLocal
from app.history_retention import run_history_retention_sweep
from app.models import (
    Firewall,
    FirewallConfigChangelogEntry,
    FirewallConfigSyncRun,
)


def test_retention_purges_changelog_older_than_max_age(main_session, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    data_management.clear_data_management_policy_cache()
    lim = data_management.default_limits()
    lim["cache_updates"] = {"max_bytes": 10**9, "max_age_days": 10}
    data_management.save_data_management_limits(lim)

    fw = Firewall(host="h", port=4444, username="u")
    main_session.add(fw)
    main_session.commit()
    main_session.refresh(fw)
    rid = str(uuid.uuid4())
    run = FirewallConfigSyncRun(
        id=rid,
        firewall_id=fw.id,
        started_at=datetime.now(timezone.utc).replace(tzinfo=None),
        status="ok",
    )
    main_session.add(run)
    main_session.commit()

    old = (datetime.now(timezone.utc) - timedelta(days=40)).replace(tzinfo=None)
    entry = FirewallConfigChangelogEntry(
        sync_run_id=rid,
        firewall_id=fw.id,
        entity_type="zone",
        external_name="z",
        action="add",
        new_payload_json="{}",
        created_at=old,
    )
    main_session.add(entry)
    main_session.commit()
    main_session.refresh(entry)
    entry_id = int(entry.id)

    counts = run_history_retention_sweep(main_session)
    assert counts["cache_updates"] >= 1

    with SessionLocal() as verify_db:
        assert verify_db.get(FirewallConfigChangelogEntry, entry_id) is None


def test_retention_purges_changelog_by_max_bytes(main_session, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    data_management.clear_data_management_policy_cache()
    lim = data_management.default_limits()
    # Must be >= 1 MiB to persist (same rule as API); row must exceed cap to trigger size purge.
    lim["cache_updates"] = {"max_bytes": 1_048_576, "max_age_days": 3650}
    data_management.save_data_management_limits(lim)

    fw = Firewall(host="h2", port=4444, username="u")
    main_session.add(fw)
    main_session.commit()
    main_session.refresh(fw)
    rid = str(uuid.uuid4())
    run = FirewallConfigSyncRun(
        id=rid,
        firewall_id=fw.id,
        started_at=datetime.now(timezone.utc).replace(tzinfo=None),
        status="ok",
    )
    main_session.add(run)
    main_session.commit()

    t0 = (datetime.now(timezone.utc) - timedelta(days=10)).replace(tzinfo=None)
    main_session.add(
        FirewallConfigChangelogEntry(
            sync_run_id=rid,
            firewall_id=fw.id,
            entity_type="zone",
            external_name="bigrow",
            action="add",
            new_payload_json="x" * 1_100_000,
            created_at=t0,
        )
    )
    main_session.commit()

    counts = run_history_retention_sweep(main_session)
    assert counts["cache_updates"] >= 1
    assert main_session.query(FirewallConfigChangelogEntry).count() == 0


def test_api_run_history_retention(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    data_management.clear_data_management_policy_cache()
    r = authed_client.post("/api/settings/data-management/run-history-retention")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "purged" in body
    assert "categories" in body


def test_api_run_history_retention_forbidden_for_non_admin(client, secrets_session):
    from app import users_service
    from app.auth import hash_password

    users_service.ensure_default_admin_user(secrets_session)
    users_service.insert_app_user(
        secrets_session,
        username="plainuser_hr",
        role="user",
        password_hash=hash_password("y" * 12),
    )
    client.post(
        "/api/auth/login",
        json={"username": "plainuser_hr", "password": "y" * 12},
    )
    r = client.post("/api/settings/data-management/run-history-retention")
    assert r.status_code == 403
