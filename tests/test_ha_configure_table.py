"""HA configuration table payload from cache."""

from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.firewall_config_sync import ENTITY_HA_CONFIGURE, ENTITY_INTERFACE
from app.ha_configure_table import build_ha_configure_table_payload, build_ha_form_model
from app.models import Firewall, FirewallConfigEntry


def _add_fw(db: Session, *, name: str, host: str) -> Firewall:
    f = Firewall(
        name=name,
        host=host,
        port=4444,
        username="u",
        verify_ssl=False,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def test_build_ha_configure_table_payload_parses_interactive(main_session, monkeypatch):
    sample = {
        "HA_Interactive": {
            "Device": "Active_Passive",
            "NodeName": "node-a",
            "ClusterID": "5",
            "DedicatedLink": "Port1",
            "MonitorPorts": {
                "Interface": ["Port1", "Port2"],
            },
            "PeerAdministrationList": {
                "PeerConfiguration": [
                    {
                        "Interface": "LAN",
                        "IPAddressV4": "1.2.3.4",
                        "IPAddressV6": "",
                        "ReserveBridgePort": "",
                    }
                ]
            },
            "KeepAlive_Interval": "300",
            "KeepAlive_Attempts": "20",
            "HostMAC": "Enable",
            "FallbackPrimaryDevice": "Enable",
        }
    }
    db = main_session
    fw = _add_fw(db, name="FW1", host="10.0.0.1")
    monkeypatch.setattr(
        "app.ha_configure_table.interface_names_by_firewall_id",
        lambda _db, _ids: {fw.id: ["Port1", "LAN"]},
    )
    db.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=ENTITY_HA_CONFIGURE,
            external_name="__config__",
            payload_json=json.dumps(sample),
        )
    )
    db.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=ENTITY_INTERFACE,
            external_name="Port1",
            payload_json=json.dumps({"Name": "Port1"}),
        )
    )
    db.commit()

    payload = build_ha_configure_table_payload(db, [fw.id])
    assert payload["rows"]
    row = payload["rows"][0]
    assert row["ha_in_cache"] is True
    assert row["cells"]["DedicatedLink"] == "Port1"
    assert row["cells"]["ClusterID"] == "5"
    assert "\x1e" in row["cells"]["MonitorPorts"]
    gch = row.get("gc_cell_html") or {}
    assert "MonitorPorts" in gch
    assert "gc-ha-if-pill-link" in gch["MonitorPorts"]
    assert "DedicatedLink" in gch
    fly = row["ha_flyout"]
    assert fly["monitor_ports"] == ["Port1", "Port2"]
    assert len(fly["peer_rows"]) == 1
    hf = row["ha_form"]
    assert hf["configuration_mode"] == "interactive"
    assert hf["device_normalized"] == "Active_Passive"


def test_build_ha_configure_table_empty_firewall_list(main_session):
    p = build_ha_configure_table_payload(main_session, [])
    assert p["rows"] == []


def test_build_ha_form_model_auxiliary_subblock() -> None:
    sample = {
        "HA_Interactive": {
            "Device": "Auxilliary",
            "NodeName": "Node2",
            "Auxilliary": {
                "DedicatedLink": "PortHA",
                "Passphrase": "sync-secret",
            },
        }
    }
    m = build_ha_form_model(sample)
    assert m["device_normalized"] == "Auxilliary"
    assert m["configuration_mode"] == "interactive"
    assert m["dedicated_ha_link"] == "PortHA"
    assert m["passphrase_copy"] == "sync-secret"


def test_build_ha_form_model_quick_ha() -> None:
    sample = {
        "HA_Quick": {
            "Device": "Active_Passive",
            "NodeName": "Node1",
            "DedicatedLink": "Port1",
            "Passphrase": "q-secret",
        }
    }
    m = build_ha_form_model(sample)
    assert m["configuration_mode"] == "quick"
    assert m["dedicated_ha_link"] == "Port1"
    assert m["passphrase_copy"] == "q-secret"
    assert m["device_normalized"] == "Active_Passive"


def test_build_ha_form_model_interactive_host_mac() -> None:
    sample = {
        "HA_Interactive": {
            "Device": "Active_Active",
            "NodeName": "A",
            "ClusterID": "3",
            "HostMAC": "Enable",
            "FallbackPrimaryDevice": "No preference",
            "KeepAlive_Interval": "300",
            "KeepAlive_Attempts": "18",
        }
    }
    m = build_ha_form_model(sample)
    assert m["use_hypervisor_mac"] is True
    assert m["cluster_id"] == "3"
    assert m["preferred_primary"] == "No preference"
    assert m["keepalive_interval"] == "300"
    assert m["keepalive_attempts"] == "18"
