"""Tests for data management settings API and policy persistence."""

from __future__ import annotations

import app.config as config
from app import data_management


def test_api_data_management_get_and_patch(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    data_management.clear_data_management_policy_cache()

    r = authed_client.get("/api/settings/data-management")
    assert r.status_code == 200
    body = r.json()
    cats = body["categories"]
    assert len(cats) == 4
    ids = {c["id"] for c in cats}
    assert ids == {
        "cache_updates",
        "task_queue_history",
        "sync_logs",
        "access_logs",
    }
    for c in cats:
        assert c["max_bytes"] == data_management.DEFAULT_MAX_BYTES
        assert c["max_age_days"] == data_management.DEFAULT_MAX_AGE_DAYS
        assert "record_count" in c
        assert "approx_bytes" in c
        assert "approx_storage" in c

    assert "firewall_cache_by_entity" in body
    assert isinstance(body["firewall_cache_by_entity"], list)
    tot = body["firewall_cache_totals"]
    assert isinstance(tot["managed_record_count"], int)
    assert isinstance(tot["orphaned_record_count"], int)

    patch = {
        "limits": {
            "cache_updates": {"max_bytes": 2 * 1024 * 1024, "max_age_days": 30},
            "sync_logs": {"max_age_days": 90},
        }
    }
    r2 = authed_client.patch("/api/settings/data-management", json=patch)
    assert r2.status_code == 200, r2.text
    updated = {c["id"]: c for c in r2.json()["categories"]}
    assert updated["cache_updates"]["max_bytes"] == 2 * 1024 * 1024
    assert updated["cache_updates"]["max_age_days"] == 30
    assert updated["sync_logs"]["max_age_days"] == 90
    assert updated["sync_logs"]["max_bytes"] == data_management.DEFAULT_MAX_BYTES

    data_management.clear_data_management_policy_cache()
    r3 = authed_client.get("/api/settings/data-management")
    assert r3.status_code == 200
    again = {c["id"]: c for c in r3.json()["categories"]}
    assert again["cache_updates"]["max_bytes"] == 2 * 1024 * 1024


def test_api_data_management_forbidden_for_non_admin(client, secrets_session):
    from app import users_service
    from app.auth import hash_password

    users_service.ensure_default_admin_user(secrets_session)
    users_service.insert_app_user(
        secrets_session,
        username="plainuser_dm",
        role="user",
        password_hash=hash_password("y" * 12),
    )
    client.post(
        "/api/auth/login",
        json={"username": "plainuser_dm", "password": "y" * 12},
    )
    r = client.get("/api/settings/data-management")
    assert r.status_code == 403


def test_api_data_management_patch_validation(authed_client, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    data_management.clear_data_management_policy_cache()
    r = authed_client.patch(
        "/api/settings/data-management",
        json={"limits": {"cache_updates": {"max_bytes": 1000}}},
    )
    assert r.status_code == 422


def test_history_storage_summary_empty_db(main_session):
    from app.models import (
        AccessSessionLog,
        FirewallConfigChangelogEntry,
        FirewallConfigSyncRun,
        TaskQueueCompleted,
    )

    data_management.clear_data_management_policy_cache()
    main_session.query(FirewallConfigChangelogEntry).delete(synchronize_session=False)
    main_session.query(FirewallConfigSyncRun).delete(synchronize_session=False)
    main_session.query(TaskQueueCompleted).delete(synchronize_session=False)
    main_session.query(AccessSessionLog).delete(synchronize_session=False)
    main_session.commit()
    rows = data_management.history_storage_summary(main_session)
    assert len(rows) == 4
    for row in rows:
        assert row["record_count"] == 0
        assert row["approx_bytes"] == 0
        assert row["oldest_record_age_days"] is None


def test_firewall_config_cache_managed_vs_orphan_and_cleanup(authed_client, main_session):
    from sqlalchemy import text

    from app.models import Firewall, FirewallConfigEntry

    def _zone_orphan_count(payload: dict) -> int:
        for x in payload.get("firewall_cache_by_entity") or []:
            if x.get("entity_type") == "zone":
                return int(x.get("orphaned_record_count") or 0)
        return 0

    data_management.clear_data_management_policy_cache()
    r0 = authed_client.get("/api/settings/data-management")
    assert r0.status_code == 200
    zone_orphans_before = _zone_orphan_count(r0.json())

    fw = Firewall(host="h", port=4444, username="u")
    main_session.add(fw)
    main_session.commit()
    main_session.refresh(fw)
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="zone",
            external_name="z1",
            payload_json="{}",
        )
    )
    main_session.commit()

    main_session.execute(text("PRAGMA foreign_keys=OFF"))
    main_session.execute(text("DELETE FROM firewalls WHERE id = :id"), {"id": fw.id})
    main_session.execute(text("PRAGMA foreign_keys=ON"))
    main_session.commit()

    r = authed_client.get("/api/settings/data-management")
    assert r.status_code == 200
    body = r.json()
    assert _zone_orphan_count(body) == zone_orphans_before + 1

    r2 = authed_client.post("/api/settings/data-management/cleanup-orphaned-firewall-cache")
    assert r2.status_code == 200
    out = r2.json()
    assert out["deleted"] >= 1
    assert out["firewall_cache_totals"]["orphaned_record_count"] == 0


def test_cleanup_orphaned_firewall_cache_forbidden_for_non_admin(client, secrets_session):
    from app import users_service
    from app.auth import hash_password

    users_service.ensure_default_admin_user(secrets_session)
    users_service.insert_app_user(
        secrets_session,
        username="plainuser_dm2",
        role="user",
        password_hash=hash_password("y" * 12),
    )
    client.post(
        "/api/auth/login",
        json={"username": "plainuser_dm2", "password": "y" * 12},
    )
    r = client.post("/api/settings/data-management/cleanup-orphaned-firewall-cache")
    assert r.status_code == 403
