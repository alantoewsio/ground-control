"""Unit tests for merge_zone_combined_payloads_cross_scope."""

from __future__ import annotations

from app.interface_table import (
    COL_ID_FIREWALLS,
    COL_ID_NAME,
    _zone_table_extra_column_label,
    merge_zone_combined_payloads_cross_scope,
)


def test_zone_column_label_dotted_key_uses_last_segment():
    assert _zone_table_extra_column_label("ApplianceAccess.AdminServices.HTTPS") == "HTTPS"
    assert _zone_table_extra_column_label("ApplianceAccess.Foo.Bar") == "Bar"
    assert _zone_table_extra_column_label("MemberPorts") == "Member ports"
    assert (
        _zone_table_extra_column_label("ApplianceAccess.AuthenticationServices.CaptivePortal")
        == "Captive Portal"
    )
    assert (
        _zone_table_extra_column_label("ApplianceAccess.AuthenticationServices.ClientAuthentication")
        == "Client Authentication"
    )


def _fw_payload_lan() -> dict:
    return {
        "columns": [COL_ID_NAME, COL_ID_FIREWALLS, "ApplianceAccess.Foo"],
        "column_labels": {
            COL_ID_NAME: "Name",
            COL_ID_FIREWALLS: "Firewalls",
            "ApplianceAccess.Foo": "Foo",
        },
        "columns_visible_by_default": [COL_ID_NAME, COL_ID_FIREWALLS],
        "rows": [
            {
                "cells": {
                    COL_ID_NAME: "LAN",
                    COL_ID_FIREWALLS: "FW-A",
                    "ApplianceAccess.Foo": "Yes",
                },
                "search": "lan fw-a yes",
                "flat": {"a": "1"},
                "firewall_labels": ["FW-A"],
                "firewall_ids": [10],
                "entity_type": "zone",
                "config_entry_id": 100,
                "firewall_id": 10,
                "access_conflict": False,
                "zone_edit_targets": [
                    {"firewall_id": 10, "config_entry_id": 100},
                ],
            }
        ],
        "zones_combine_conflicts": False,
        "zones_combined": True,
    }


def _cfg_payload_lan() -> dict:
    return {
        "columns": [COL_ID_NAME, COL_ID_FIREWALLS, "ApplianceAccess.Foo"],
        "column_labels": {
            COL_ID_NAME: "Name",
            COL_ID_FIREWALLS: "Configurations",
            "ApplianceAccess.Foo": "Foo",
        },
        "columns_visible_by_default": [COL_ID_NAME, COL_ID_FIREWALLS],
        "rows": [
            {
                "cells": {
                    COL_ID_NAME: "LAN",
                    COL_ID_FIREWALLS: "Virt-1",
                    "ApplianceAccess.Foo": "No",
                },
                "search": "lan virt-1 no",
                "flat": {"a": "2"},
                "configuration_labels": ["Virt-1"],
                "configuration_ids": [20],
                "entity_type": "zone",
                "config_entry_id": 200,
                "configuration_id": 20,
                "access_conflict": False,
                "zone_edit_targets": [
                    {"configuration_id": 20, "config_entry_id": 200},
                ],
            }
        ],
        "zones_combine_conflicts": False,
        "zones_combined": True,
    }


def test_merge_zone_cross_scope_one_row_per_name():
    out = merge_zone_combined_payloads_cross_scope(_fw_payload_lan(), _cfg_payload_lan())
    assert len(out["rows"]) == 1
    row = out["rows"][0]
    assert row["cells"][COL_ID_NAME] == "LAN"
    assert "FW-A" in row["cells"][COL_ID_FIREWALLS]
    assert "Virt-1" in row["cells"][COL_ID_FIREWALLS]
    assert row["firewall_ids"] == [10]
    assert row["configuration_ids"] == [20]
    assert len(row["zone_edit_targets"]) == 2
    assert out["column_labels"][COL_ID_FIREWALLS] == "Scope"
    assert row.get("access_conflict") is True
    ap = row.get("access_per_firewall") or {}
    assert "ApplianceAccess.Foo" in ap


def test_merge_zone_cross_scope_cfg_only_extra_zone():
    fw = _fw_payload_lan()
    cfg = _cfg_payload_lan()
    cfg["rows"].append(
        {
            "cells": {
                COL_ID_NAME: "DMZ",
                COL_ID_FIREWALLS: "Virt-1",
                "ApplianceAccess.Foo": "Yes",
            },
            "search": "dmz",
            "flat": {},
            "configuration_labels": ["Virt-1"],
            "configuration_ids": [20],
            "entity_type": "zone",
            "config_entry_id": 201,
            "configuration_id": 20,
            "access_conflict": False,
            "zone_edit_targets": [{"configuration_id": 20, "config_entry_id": 201}],
        }
    )
    out = merge_zone_combined_payloads_cross_scope(fw, cfg)
    names = [r["cells"][COL_ID_NAME] for r in out["rows"]]
    assert names == ["LAN", "DMZ"]


def test_merge_zone_cross_scope_empty_cfg_rows_returns_fw():
    fw = _fw_payload_lan()
    cfg = {
        "columns": [],
        "column_labels": {},
        "columns_visible_by_default": [],
        "rows": [],
        "zones_combined": True,
        "zones_combine_conflicts": False,
    }
    out = merge_zone_combined_payloads_cross_scope(fw, cfg)
    assert out["rows"] == fw["rows"]
