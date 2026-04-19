"""Merge tests for ``nat_rule`` (Protect \u00b7 Firewall NAT add/edit/delete via HS pipeline).

Covers the form-to-payload deep-merge contract:

- Top-level scalars (Name, Description, IPFamily, Status, Translated*, etc.).
- The five list-of-strings members (OriginalSourceNetworks /
  OriginalDestinationNetworks / OriginalServices / InboundInterfaces /
  OutboundInterfaces).
- The repeating <InterfaceNATPolicyList><Override>...</Override></InterfaceNATPolicyList>
  block and its clear-by-empty-list semantics.
- Position semantics (Top / Bottom / After / Before) with canonical
  <After><Name> / <Before><Name> shapes.
- Unmapped XML keys preserved verbatim.

Mirrors the structure of ``test_dhcp_entity_merges.py``.
"""

from __future__ import annotations

from app.hs_flyout_merge import merge_nat_rule_form
from tests._ip_fixtures import ipv4

_LAN_NET = ipv4(192, 168, 1, 0)
_DMZ_NET = ipv4(10, 0, 0, 0)
_WEB_HOST = ipv4(203, 0, 113, 5)


def test_nat_rule_merge_overlays_top_level_scalars() -> None:
    out = merge_nat_rule_form(
        {"Name": "old"},
        {
            "name": "SNAT-Rule",
            "description": "Default outbound NAT",
            "ip_family": "IPv4",
            "status": "Enable",
            "translated_source": "MASQ",
            "translated_destination": "Original",
            "translated_service": "Original",
            "override_interface_nat_policy": "Disable",
        },
    )
    assert out["Name"] == "SNAT-Rule"
    assert out["Description"] == "Default outbound NAT"
    assert out["IPFamily"] == "IPv4"
    assert out["Status"] == "Enable"
    assert out["TranslatedSource"] == "MASQ"
    assert out["TranslatedDestination"] == "Original"
    assert out["TranslatedService"] == "Original"
    assert out["OverrideInterfaceNATPolicy"] == "Disable"


def test_nat_rule_merge_translates_position_top() -> None:
    out = merge_nat_rule_form(
        {"Name": "R1", "After": {"Name": "R0"}},
        {"name": "R1", "InsertPosition": "Top"},
    )
    assert out["Position"] == "Top"
    assert "After" not in out
    assert "Before" not in out


def test_nat_rule_merge_translates_position_after_with_target() -> None:
    out = merge_nat_rule_form(
        {"Name": "R5", "Position": "Top"},
        {"name": "R5", "InsertPosition": "After", "InsertAfterRule": "R3"},
    )
    assert out["Position"] == "After"
    assert out["After"] == {"Name": "R3"}


def test_nat_rule_merge_overlays_original_source_single_vs_many() -> None:
    out_one = merge_nat_rule_form(
        {"Name": "R1"},
        {"name": "R1", "original_source_networks": [_LAN_NET]},
    )
    assert out_one["OriginalSourceNetworks"] == {"Network": _LAN_NET}

    out_many = merge_nat_rule_form(
        {"Name": "R2"},
        {"name": "R2", "original_source_networks": [_LAN_NET, _DMZ_NET]},
    )
    assert out_many["OriginalSourceNetworks"] == {"Network": [_LAN_NET, _DMZ_NET]}


def test_nat_rule_merge_clears_original_dest_when_empty_list() -> None:
    base = {
        "Name": "R1",
        "OriginalDestinationNetworks": {"Network": _WEB_HOST},
    }
    out = merge_nat_rule_form(
        base,
        {"name": "R1", "original_destination_networks": []},
    )
    assert out["OriginalDestinationNetworks"] is None


def test_nat_rule_merge_overlays_original_services_and_interfaces() -> None:
    out = merge_nat_rule_form(
        {"Name": "R1"},
        {
            "name": "R1",
            "original_services": ["HTTP", "HTTPS"],
            "inbound_interfaces": ["Port1"],
            "outbound_interfaces": ["Port2", "Port3"],
        },
    )
    assert out["OriginalServices"] == {"Service": ["HTTP", "HTTPS"]}
    assert out["InboundInterfaces"] == {"Interface": "Port1"}
    assert out["OutboundInterfaces"] == {"Interface": ["Port2", "Port3"]}


def test_nat_rule_merge_overlays_interface_override_block_single_row() -> None:
    out = merge_nat_rule_form(
        {"Name": "R1"},
        {
            "name": "R1",
            "override_interface_nat_policy": "Enable",
            "interface_nat_policy_overrides": [
                {"specific_interface": "Port4", "specific_translatedsourceid": "MASQ"},
            ],
        },
    )
    assert out["OverrideInterfaceNATPolicy"] == "Enable"
    assert out["InterfaceNATPolicyList"] == {
        "Override": {"specific_interface": "Port4", "specific_translatedsourceid": "MASQ"},
    }


def test_nat_rule_merge_overlays_interface_override_block_multiple_rows() -> None:
    out = merge_nat_rule_form(
        {"Name": "R1"},
        {
            "name": "R1",
            "interface_nat_policy_overrides": [
                {"specific_interface": "Port4", "specific_translatedsourceid": "MASQ"},
                {"specific_interface": "Port5", "specific_translatedsourceid": "Original"},
            ],
        },
    )
    block = out["InterfaceNATPolicyList"]
    assert isinstance(block, dict) and isinstance(block["Override"], list)
    assert block["Override"][0]["specific_interface"] == "Port4"
    assert block["Override"][1]["specific_translatedsourceid"] == "Original"


def test_nat_rule_merge_clears_interface_override_when_empty_list() -> None:
    base = {
        "Name": "R1",
        "InterfaceNATPolicyList": {
            "Override": {"specific_interface": "Port4", "specific_translatedsourceid": "MASQ"},
        },
    }
    out = merge_nat_rule_form(base, {"name": "R1", "interface_nat_policy_overrides": []})
    assert out["InterfaceNATPolicyList"] is None


def test_nat_rule_merge_accepts_camelcase_override_keys() -> None:
    out = merge_nat_rule_form(
        {"Name": "R1"},
        {
            "name": "R1",
            "interface_nat_policy_overrides": [
                {"specificInterface": "Port4", "SpecificTranslatedSourceId": "MASQ"},
            ],
        },
    )
    assert out["InterfaceNATPolicyList"] == {
        "Override": {"specific_interface": "Port4", "specific_translatedsourceid": "MASQ"},
    }


def test_nat_rule_merge_overlays_linked_firewall_rule() -> None:
    out = merge_nat_rule_form(
        {"Name": "R1"},
        {"name": "R1", "linked_firewall_rule": "Allow-Web"},
    )
    assert out["LinkedFirewallrule"] == "Allow-Web"


def test_nat_rule_merge_keeps_unmapped_keys_from_base() -> None:
    base = {"Name": "R1", "Custom": "keep-me", "Description": "Unchanged"}
    out = merge_nat_rule_form(base, {"name": "R1", "translated_source": "MASQ"})
    assert out["Custom"] == "keep-me"
    assert out["Description"] == "Unchanged"
    assert out["TranslatedSource"] == "MASQ"


def test_nat_rule_merge_returns_deep_copy_not_mutating_base() -> None:
    base = {
        "Name": "R1",
        "OriginalSourceNetworks": {"Network": _LAN_NET},
    }
    snapshot = {
        "Name": "R1",
        "OriginalSourceNetworks": {"Network": _LAN_NET},
    }
    _ = merge_nat_rule_form(base, {"name": "R1", "original_source_networks": [_DMZ_NET]})
    assert base == snapshot


def test_nat_rule_merge_clears_description_on_blank() -> None:
    out = merge_nat_rule_form(
        {"Name": "R1", "Description": "old"},
        {"name": "R1", "description": "   "},
    )
    assert out["Description"] is None
