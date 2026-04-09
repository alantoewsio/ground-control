"""Netflow configuration cache refresh when the appliance has no collectors."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from app.firewall_config_sync import (
    ENTITY_NETFLOW_CONFIGURATION,
    _coalesce_netflow_configuration_sync_items,
    _sync_entity_type,
)
from app.models import Firewall, FirewallConfigChangelogEntry, FirewallConfigEntry, FirewallConfigSyncRun


def test_coalesce_netflow_configuration_sync_items_empty_list():
    assert _coalesce_netflow_configuration_sync_items([]) == [{"Server": []}]


def test_coalesce_netflow_configuration_sync_items_placeholder_server():
    out = _coalesce_netflow_configuration_sync_items(
        [{"Server": {"ServerName": "", "NetflowServer": "", "NetflowServerPort": "2055"}}]
    )
    assert out == [{"Server": []}]


def test_coalesce_netflow_configuration_sync_items_preserves_real_server():
    payload = {
        "Server": [{"ServerName": "c1", "NetflowServer": "10.0.0.1", "NetflowServerPort": "2055"}]
    }
    assert _coalesce_netflow_configuration_sync_items([payload]) == [payload]


def test_sync_entity_type_netflow_empty_replaces_prior_cache(main_session):
    db = main_session
    fw = Firewall(name="Nf", host="10.0.0.1", port=4444, username="u", verify_ssl=False)
    db.add(fw)
    db.commit()

    old = {
        "Server": [
            {"ServerName": "old", "NetflowServer": "192.0.2.1", "NetflowServerPort": "2055"},
        ]
    }
    db.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=ENTITY_NETFLOW_CONFIGURATION,
            external_name="__config__",
            payload_json=json.dumps(old),
        )
    )
    db.commit()

    sync_id = str(uuid.uuid4())
    t0 = datetime.now(timezone.utc)
    db.add(
        FirewallConfigSyncRun(
            id=sync_id,
            firewall_id=fw.id,
            started_at=t0,
            finished_at=None,
            status="running",
            error_message=None,
        )
    )
    db.commit()

    counts: dict[str, int] = {"added": 0, "changed": 0, "deleted": 0}
    _sync_entity_type(
        db,
        sync_run_id=sync_id,
        firewall_id=fw.id,
        entity_type=ENTITY_NETFLOW_CONFIGURATION,
        name_keys=(),
        singleton=True,
        name_fn=None,
        items=[{"Server": []}],
        counts=counts,
    )
    db.commit()

    row = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == fw.id,
            FirewallConfigEntry.entity_type == ENTITY_NETFLOW_CONFIGURATION,
            FirewallConfigEntry.external_name == "__config__",
        )
        .one()
    )
    body = json.loads(row.payload_json)
    assert body.get("Server") == []
    assert counts["changed"] == 1
    assert counts["deleted"] == 0
    assert (
        db.query(FirewallConfigChangelogEntry)
        .filter(FirewallConfigChangelogEntry.sync_run_id == sync_id)
        .count()
        >= 1
    )
