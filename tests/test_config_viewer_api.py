"""Config viewer API: hierarchical tree + entry payload."""

from __future__ import annotations

import json

from app.models import (
    Configuration,
    ConfigurationConfigEntry,
    Firewall,
    FirewallConfigEntry,
)


def test_firewall_config_viewer_tree_groups_profiles(authed_client, main_session):
    fw = Firewall(
        name="Lab",
        host="10.0.0.1",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add_all(
        [
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type="schedule",
                external_name="Biz",
                payload_json="{}",
            ),
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type="zone",
                external_name="LAN",
                payload_json='{"Name": "LAN"}',
            ),
        ]
    )
    main_session.commit()

    r = authed_client.get(f"/api/firewalls/{fw.id}/config-viewer-tree")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total_count"] == 2
    assert data["scope"]["kind"] == "firewall"
    assert data["scope"]["id"] == fw.id
    assert data["scope"]["allow_delete"] is False
    assert "config_sync_url" in data["scope"]
    assert str(fw.id) in data["scope"]["config_sync_url"]
    sec_ids = [s["id"] for s in data["sections"]]
    assert "system" in sec_ids
    assert "configure" in sec_ids
    sys_sec = next(s for s in data["sections"] if s["id"] == "system")
    prof = next(g for g in sys_sec["groups"] if g["id"] == "profiles")
    tab = next(t for t in prof["tabs"] if t["id"] == "schedule")
    assert tab["count"] == 1
    assert tab["items"][0]["name"] == "Biz"


def test_firewall_config_entry_detail(authed_client, main_session):
    fw = Firewall(
        name="Lab",
        host="10.0.0.2",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    ent = FirewallConfigEntry(
        firewall_id=fw.id,
        entity_type="zone",
        external_name="WAN",
        payload_json=json.dumps({"Name": "WAN", "Z": 1}),
    )
    main_session.add(ent)
    main_session.commit()

    r = authed_client.get(f"/api/firewalls/{fw.id}/config-entries/{ent.id}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["entity_type"] == "zone"
    assert body["external_name"] == "WAN"
    assert body["payload"] == {"Name": "WAN", "Z": 1}


def test_firewall_config_viewer_tree_test_firewall_no_sync_url(authed_client, main_session):
    fw = Firewall(
        name="TestFW",
        host="10.0.0.9",
        port=4444,
        username="admin",
        verify_ssl=False,
        is_test=True,
    )
    main_session.add(fw)
    main_session.commit()
    r = authed_client.get(f"/api/firewalls/{fw.id}/config-viewer-tree")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["scope"]["allow_delete"] is True
    assert "config_sync_url" not in data["scope"]


def test_firewall_config_viewer_queue_deletes(authed_client, main_session):
    fw = Firewall(
        name="DelFW",
        host="10.0.0.3",
        port=4444,
        username="admin",
        verify_ssl=False,
        is_test=True,
    )
    main_session.add(fw)
    main_session.flush()
    ent = FirewallConfigEntry(
        firewall_id=fw.id,
        entity_type="schedule",
        external_name="S1",
        payload_json="{}",
    )
    main_session.add(ent)
    main_session.commit()

    r = authed_client.post(
        f"/api/firewalls/{fw.id}/config-viewer/queue-deletes",
        json={"config_entry_ids": [ent.id]},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True
    assert data["queued_count"] == 1
    assert len(data["task_ids"]) == 1
    assert data["skipped"] == []


def test_firewall_config_viewer_queue_deletes_forbidden_managed(authed_client, main_session):
    fw = Firewall(
        name="ProdFW",
        host="10.0.0.8",
        port=4444,
        username="admin",
        verify_ssl=False,
        is_test=False,
    )
    main_session.add(fw)
    main_session.flush()
    ent = FirewallConfigEntry(
        firewall_id=fw.id,
        entity_type="schedule",
        external_name="S",
        payload_json="{}",
    )
    main_session.add(ent)
    main_session.commit()
    r = authed_client.post(
        f"/api/firewalls/{fw.id}/config-viewer/queue-deletes",
        json={"config_entry_ids": [ent.id]},
    )
    assert r.status_code == 403


def test_firewall_config_viewer_queue_deletes_skips_zone(authed_client, main_session):
    fw = Firewall(
        name="ZFW",
        host="10.0.0.4",
        port=4444,
        username="admin",
        verify_ssl=False,
        is_test=True,
    )
    main_session.add(fw)
    main_session.flush()
    ent = FirewallConfigEntry(
        firewall_id=fw.id,
        entity_type="zone",
        external_name="LAN",
        payload_json="{}",
    )
    main_session.add(ent)
    main_session.commit()

    r = authed_client.post(
        f"/api/firewalls/{fw.id}/config-viewer/queue-deletes",
        json={"config_entry_ids": [ent.id]},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["queued_count"] == 0
    assert data["skipped"] and data["skipped"][0]["config_entry_id"] == ent.id


def test_configuration_config_viewer_queue_deletes(authed_client, main_session):
    cfg = Configuration(name="DelCfg")
    main_session.add(cfg)
    main_session.flush()
    ent = ConfigurationConfigEntry(
        configuration_id=cfg.id,
        entity_type="schedule",
        external_name="S2",
        payload_json="{}",
    )
    main_session.add(ent)
    main_session.commit()

    r = authed_client.post(
        f"/api/configurations/{cfg.id}/config-viewer/queue-deletes",
        json={"config_entry_ids": [ent.id]},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True
    assert data["queued_count"] == 1
    assert len(data["task_ids"]) == 1


def test_configuration_config_viewer_tree(authed_client, main_session):
    cfg = Configuration(name="Draft")
    main_session.add(cfg)
    main_session.flush()
    main_session.add(
        ConfigurationConfigEntry(
            configuration_id=cfg.id,
            entity_type="ip_host",
            external_name="h1",
            payload_json="{}",
        )
    )
    main_session.commit()

    r = authed_client.get(f"/api/configurations/{cfg.id}/config-viewer-tree")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["scope"]["kind"] == "configuration"
    assert data["scope"]["id"] == cfg.id
    assert data["scope"]["allow_delete"] is True
    assert "config_sync_url" not in data["scope"]
    assert data["total_count"] == 1
    sys_sec = next(s for s in data["sections"] if s["id"] == "system")
    hs = next(g for g in sys_sec["groups"] if g["id"] == "hosts_services")
    tab = next(t for t in hs["tabs"] if t["id"] == "ip_host")
    assert tab["count"] == 1


def test_configuration_config_viewer_tree_includes_zero_count_sections(authed_client, main_session):
    cfg = Configuration(name="EmptyDraft")
    main_session.add(cfg)
    main_session.commit()

    r = authed_client.get(f"/api/configurations/{cfg.id}/config-viewer-tree")
    assert r.status_code == 200, r.text
    data = r.json()

    sec_ids = [s["id"] for s in data["sections"]]
    assert "monitor" in sec_ids
    assert "protect" in sec_ids
    assert "configure" in sec_ids
    assert "system" in sec_ids

    configure_sec = next(s for s in data["sections"] if s["id"] == "configure")
    assert configure_sec["count"] == 0
    network_group = next(g for g in configure_sec["groups"] if g["id"] == "network")
    assert network_group["count"] == 0
    interfaces_tab = next(t for t in network_group["tabs"] if t["id"] == "interfaces")
    assert interfaces_tab["count"] == 0


def test_api_firewalls_config_cache_distinct_entity_types_scoped(authed_client, main_session):
    fw = Firewall(
        name="DistinctTypesFw",
        host="10.0.0.2",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add_all(
        [
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type="zone",
                external_name="A",
                payload_json="{}",
            ),
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type="zone",
                external_name="B",
                payload_json="{}",
            ),
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type="interface",
                external_name="eth0",
                payload_json="{}",
            ),
        ]
    )
    main_session.commit()

    r = authed_client.get(
        f"/api/firewalls/config-cache/distinct-entity-types?firewall_ids={fw.id}"
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["entity_types"] == ["interface", "zone"]

    r2 = authed_client.get("/api/firewalls/config-cache/distinct-entity-types")
    assert r2.status_code == 200, r2.text
    types_all = r2.json()["entity_types"]
    assert "interface" in types_all
    assert "zone" in types_all


def test_api_firewalls_config_cache_table_accepts_non_hs_entity_type(authed_client, main_session):
    """Firewalls v2 (and others) load any config-cache type via the flattened table API."""
    fw = Firewall(
        name="RulesFw",
        host="10.0.0.3",
        port=4444,
        username="admin",
        verify_ssl=False,
    )
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type="firewall_rule",
            external_name="r1",
            payload_json=json.dumps({"Name": "Allow LAN", "Status": "Enable"}),
        )
    )
    main_session.commit()

    r = authed_client.get(
        "/api/firewalls/hosts-services/table",
        params={
            "entity_type": "firewall_rule",
            "firewall_ids": str(fw.id),
            "combine": "false",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("rows")
    assert data["rows"][0].get("entity_type") == "firewall_rule"


def test_api_firewalls_config_cache_table_rejects_bad_entity_type(authed_client):
    r = authed_client.get(
        "/api/firewalls/hosts-services/table",
        params={"entity_type": "Bad-Type", "firewall_ids": "1", "combine": "false"},
    )
    assert r.status_code == 400
