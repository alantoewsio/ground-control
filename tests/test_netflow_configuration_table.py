"""Netflow configuration table + merge helpers."""

from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest
from sophosfirewall_python.api_client import SophosFirewallAPIError, SophosFirewallZeroRecords

from app.firewall_config_sync import ENTITY_NETFLOW_CONFIGURATION, _spec_netflow_configuration_get
from app.models import Firewall, FirewallConfigEntry
from app.netflow_configuration_merge import merge_netflow_configuration_payload, netflow_servers_from_payload
from app.netflow_configuration_table import build_netflow_configuration_table_payload
from app.task_queue_service import enqueue_netflow_configuration_update


def test_netflow_servers_from_payload_list(main_session):
    root = {
        "Server": [
            {
                "ServerName": "n1",
                "NetflowServer": "10.0.0.1",
                "NetflowServerPort": "2055",
            },
            {
                "ServerName": "n2",
                "NetflowServer": "collector.example.com",
                "NetflowServerPort": "9996",
            },
        ]
    }
    rows = netflow_servers_from_payload(root)
    assert len(rows) == 2
    assert rows[0]["ServerName"] == "n1"
    assert rows[1]["NetflowServerPort"] == "9996"


def test_netflow_servers_from_payload_parallel_arrays():
    root = {
        "Name": ["c1", "c2"],
        "NetflowServer": ["10.0.0.1", "10.0.0.2"],
        "NetflowServerPort": ["2055", "9996"],
    }
    rows = netflow_servers_from_payload(root)
    assert len(rows) == 2
    assert rows[0]["ServerName"] == "c1"
    assert rows[0]["NetflowServer"] == "10.0.0.1"
    assert rows[1]["NetflowServerPort"] == "9996"


def test_netflow_servers_from_payload_parallel_scalars():
    root = {"Name": "single", "NetflowServer": "192.0.2.5", "NetflowServerPort": "4711"}
    rows = netflow_servers_from_payload(root)
    assert len(rows) == 1
    assert rows[0]["ServerName"] == "single"
    assert rows[0]["NetflowServer"] == "192.0.2.5"
    assert rows[0]["NetflowServerPort"] == "4711"


def test_merge_netflow_configuration_payload_skips_empty_rows():
    base = {"@status": "200", "Server": [{"ServerName": "old"}]}
    merged = merge_netflow_configuration_payload(
        base,
        [
            {"ServerName": "a", "NetflowServer": "1.1.1.1", "NetflowServerPort": ""},
            {"ServerName": "", "NetflowServer": "", "NetflowServerPort": "2055"},
        ],
    )
    assert len(merged["Server"]) == 1
    assert merged["Server"][0]["ServerName"] == "a"
    assert merged["Server"][0]["NetflowServerPort"] == "2055"
    assert merged["@status"] == "200"


def test_build_netflow_configuration_table_payload_all_firewalls_without_cache(main_session):
    """Every selected firewall gets a row even when no netflow cache entry exists yet."""
    db = main_session
    fw1 = Firewall(name="East", host="10.0.0.10", port=4444, username="u", verify_ssl=False)
    fw2 = Firewall(name="West", host="10.0.0.11", port=4444, username="u", verify_ssl=False)
    db.add(fw1)
    db.add(fw2)
    db.commit()

    out = build_netflow_configuration_table_payload(db, [fw1.id, fw2.id])
    assert len(out["rows"]) == 2
    for r in out["rows"]:
        assert r["config_entry_id"] is None
        assert r["cells"]["netflow_record_count"] == "0"
        assert r["netflow_servers"] == []


def test_build_netflow_configuration_table_payload_includes_firewalls_without_cache(main_session):
    db = main_session
    fw1 = Firewall(name="Alpha", host="10.0.0.1", port=4444, username="u", verify_ssl=False)
    fw2 = Firewall(name="Beta", host="10.0.0.2", port=4444, username="u", verify_ssl=False)
    db.add(fw1)
    db.add(fw2)
    db.commit()

    payload = {
        "Server": [
            {"ServerName": "s1", "NetflowServer": "10.1.1.1", "NetflowServerPort": "2055"},
        ]
    }
    db.add(
        FirewallConfigEntry(
            firewall_id=fw1.id,
            entity_type=ENTITY_NETFLOW_CONFIGURATION,
            external_name="__config__",
            payload_json=json.dumps(payload),
        )
    )
    db.commit()

    out = build_netflow_configuration_table_payload(db, [fw1.id, fw2.id])
    assert len(out["rows"]) == 2
    by_id = {r["firewall_id"]: r for r in out["rows"]}
    row1 = by_id[fw1.id]
    assert row1["config_entry_id"] is not None
    assert row1["cells"]["netflow_record_count"] == "1"
    assert "gc-zone-pill" in (row1.get("gc_cell_html") or {}).get("server_names", "")
    row2 = by_id[fw2.id]
    assert row2["config_entry_id"] is None
    assert row2["cells"]["netflow_record_count"] == "0"
    assert row2["netflow_servers"] == []


def test_spec_netflow_configuration_get_fallback_on_wrong_tag():
    fw = MagicMock()
    ok = {"Response": {"NetFlowConfiguration": {"Server": []}}}
    fw.client.get_tag.side_effect = [
        SophosFirewallAPIError("NetFlowConfiguration not in response"),
        ok,
    ]
    fn = _spec_netflow_configuration_get()
    assert fn(fw) == ok
    assert fw.client.get_tag.call_count == 2
    assert fw.client.get_tag.call_args_list[0][0][0] == "NetFlowConfiguration"
    assert fw.client.get_tag.call_args_list[1][0][0] == "NetflowConfiguration"


def test_spec_netflow_configuration_get_does_not_swallow_zero_records():
    fw = MagicMock()
    fw.client.get_tag.side_effect = SophosFirewallZeroRecords("Number of records Zero.")
    fn = _spec_netflow_configuration_get()
    with pytest.raises(SophosFirewallZeroRecords):
        fn(fw)
    assert fw.client.get_tag.call_count == 1


def test_enqueue_netflow_configuration_update_without_cache(main_session):
    db = main_session
    fw = Firewall(name="Gamma", host="10.0.0.3", port=4444, username="u", verify_ssl=False)
    db.add(fw)
    db.commit()
    task = enqueue_netflow_configuration_update(
        db,
        firewall_id=fw.id,
        server_rows=[
            {"ServerName": "n1", "NetflowServer": "192.0.2.1", "NetflowServerPort": "2055"},
        ],
    )
    assert task is not None
    assert task.firewall_id == fw.id
    assert task.external_name == "__config__"
    body = json.loads(task.payload_json)
    assert len(body.get("Server") or []) == 1
    assert body["Server"][0]["NetflowServer"] == "192.0.2.1"
