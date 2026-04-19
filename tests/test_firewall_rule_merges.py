"""Merge tests for ``firewall_rule`` (Protect \u00b7 Firewall add/edit/delete via HS pipeline).

Covers the form-to-payload deep-merge contract for the three policy variants:

- User policy   -> body lives inside <UserPolicy>
- Network policy -> body lives inside <NetworkPolicy>
- HTTPBased (WAF) -> <HTTPBasedPolicy> preserved verbatim, only top-level
  Status / Position / Description / Section / IPFamily edits accepted.

Position semantics (Top / Bottom / After / Before) and the canonical
<After><Name> / <Before><Name> shape are exercised here too.

Mirrors the structure of ``test_dhcp_entity_merges.py``.
"""

from __future__ import annotations

from app.hs_flyout_merge import merge_firewall_rule_form


def test_firewall_rule_merge_overlays_top_level_scalars() -> None:
    out = merge_firewall_rule_form(
        {"Name": "old", "Status": "Disable", "PolicyType": "Network"},
        {
            "name": "Allow-Web",
            "status": "Enable",
            "ip_family": "IPv4",
            "policy_type": "Network",
            "section": "Local",
            "description": "  Allow web traffic  ",
        },
    )
    assert out["Name"] == "Allow-Web"
    assert out["Status"] == "Enable"
    assert out["IPFamily"] == "IPv4"
    assert out["PolicyType"] == "Network"
    assert out["Section"] == "Local"
    assert out["Description"] == "Allow web traffic"


def test_firewall_rule_merge_clears_description_on_blank() -> None:
    out = merge_firewall_rule_form(
        {"Name": "R1", "Description": "old", "PolicyType": "Network"},
        {"name": "R1", "policy_type": "Network", "description": "   "},
    )
    assert out["Description"] is None


def test_firewall_rule_merge_translates_position_top() -> None:
    out = merge_firewall_rule_form(
        {"Name": "R1", "After": {"Name": "R0"}, "PolicyType": "Network"},
        {"name": "R1", "policy_type": "Network", "InsertPosition": "Top"},
    )
    assert out["Position"] == "Top"
    assert "After" not in out
    assert "Before" not in out


def test_firewall_rule_merge_translates_position_after_with_target() -> None:
    out = merge_firewall_rule_form(
        {"Name": "R5", "Position": "Top", "PolicyType": "Network"},
        {
            "name": "R5",
            "policy_type": "Network",
            "InsertPosition": "After",
            "InsertAfterRule": "R3",
        },
    )
    assert out["Position"] == "After"
    assert out["After"] == {"Name": "R3"}
    assert "Before" not in out


def test_firewall_rule_merge_accepts_bulk_csv_position_shorthand() -> None:
    out = merge_firewall_rule_form(
        {"Name": "R1", "PolicyType": "Network"},
        {"name": "R1", "policy_type": "Network", "Position": "After:R3"},
    )
    assert out["Position"] == "After"
    assert out["After"] == {"Name": "R3"}


def test_firewall_rule_merge_writes_into_network_policy_block() -> None:
    out = merge_firewall_rule_form(
        {"Name": "R1", "PolicyType": "Network", "NetworkPolicy": {"Action": "Drop"}},
        {
            "name": "R1",
            "policy_type": "Network",
            "action": "Accept",
            "log_traffic": "Enable",
            "schedule": "All The Time",
            "scan_virus": "Enable",
        },
    )
    block = out["NetworkPolicy"]
    assert isinstance(block, dict)
    assert block["Action"] == "Accept"
    assert block["LogTraffic"] == "Enable"
    assert block["Schedule"] == "All The Time"
    assert block["ScanVirus"] == "Enable"


def test_firewall_rule_merge_writes_into_user_policy_block() -> None:
    out = merge_firewall_rule_form(
        {"Name": "R1", "PolicyType": "User"},
        {
            "name": "R1",
            "policy_type": "User",
            "action": "Accept",
            "match_identity": "Enable",
            "show_captive_portal": "Disable",
            "identity": ["alice", "bob", "engineering"],
        },
    )
    block = out["UserPolicy"]
    assert block["Action"] == "Accept"
    assert block["MatchIdentity"] == "Enable"
    assert block["ShowCaptivePortal"] == "Disable"
    assert block["Identity"] == {"Member": ["alice", "bob", "engineering"]}


def test_firewall_rule_merge_zone_list_single_vs_many() -> None:
    out_one = merge_firewall_rule_form(
        {"Name": "R1", "PolicyType": "Network"},
        {"name": "R1", "policy_type": "Network", "source_zones": ["LAN"]},
    )
    assert out_one["NetworkPolicy"]["SourceZones"] == {"Zone": "LAN"}

    out_many = merge_firewall_rule_form(
        {"Name": "R2", "PolicyType": "Network"},
        {"name": "R2", "policy_type": "Network", "source_zones": ["LAN", "VPN"]},
    )
    assert out_many["NetworkPolicy"]["SourceZones"] == {"Zone": ["LAN", "VPN"]}


def test_firewall_rule_merge_clears_zone_list_when_empty() -> None:
    base = {
        "Name": "R1",
        "PolicyType": "Network",
        "NetworkPolicy": {"SourceZones": {"Zone": ["LAN", "VPN"]}},
    }
    out = merge_firewall_rule_form(
        base,
        {"name": "R1", "policy_type": "Network", "source_zones": []},
    )
    assert out["NetworkPolicy"]["SourceZones"] is None


def test_firewall_rule_merge_overlays_destination_networks_and_services() -> None:
    out = merge_firewall_rule_form(
        {"Name": "R1", "PolicyType": "Network"},
        {
            "name": "R1",
            "policy_type": "Network",
            "destination_networks": ["WebServers"],
            "services": ["HTTP", "HTTPS"],
        },
    )
    block = out["NetworkPolicy"]
    assert block["DestinationNetworks"] == {"Network": "WebServers"}
    assert block["Services"] == {"Service": ["HTTP", "HTTPS"]}


def test_firewall_rule_merge_keeps_unmapped_top_level_keys_from_base() -> None:
    base = {
        "Name": "R1",
        "PolicyType": "Network",
        "Custom": "keep-me",
        "NetworkPolicy": {"Action": "Drop", "Custom": "keep-policy-too"},
    }
    out = merge_firewall_rule_form(
        base,
        {"name": "R1", "policy_type": "Network", "action": "Accept"},
    )
    assert out["Custom"] == "keep-me"
    assert out["NetworkPolicy"]["Action"] == "Accept"
    assert out["NetworkPolicy"]["Custom"] == "keep-policy-too"


def test_firewall_rule_merge_preserves_other_policy_block_when_switching_type() -> None:
    base = {
        "Name": "R1",
        "PolicyType": "Network",
        "NetworkPolicy": {"Action": "Accept", "Schedule": "All The Time"},
    }
    out = merge_firewall_rule_form(
        base,
        {
            "name": "R1",
            "policy_type": "User",
            "action": "Drop",
            "match_identity": "Enable",
        },
    )
    assert out["PolicyType"] == "User"
    assert out["UserPolicy"]["Action"] == "Drop"
    assert out["UserPolicy"]["MatchIdentity"] == "Enable"
    # Original NetworkPolicy block survives so a future flip back doesn't
    # silently lose the data.
    assert out["NetworkPolicy"] == {"Action": "Accept", "Schedule": "All The Time"}


def test_firewall_rule_merge_httpbased_preserves_payload_and_only_top_level_edits() -> None:
    base = {
        "Name": "WAF-1",
        "Status": "Disable",
        "PolicyType": "HTTPBased",
        "HTTPBasedPolicy": {"WebServer": "myapp", "AccessRule": {"AllowFromIP": "Any"}},
    }
    out = merge_firewall_rule_form(
        base,
        {
            "name": "WAF-1",
            "status": "Enable",
            "policy_type": "HTTPBased",
            "section": "Local",
            "description": "Now enabled",
            # The merger MUST ignore any attempt to overwrite the WAF body
            # via the generic policy fields.
            "action": "Drop",
            "scan_virus": "Disable",
            "source_zones": ["LAN"],
        },
    )
    assert out["Status"] == "Enable"
    assert out["Section"] == "Local"
    assert out["Description"] == "Now enabled"
    assert out["HTTPBasedPolicy"] == {
        "WebServer": "myapp",
        "AccessRule": {"AllowFromIP": "Any"},
    }
    # No NetworkPolicy / UserPolicy block should have been spuriously added.
    assert "NetworkPolicy" not in out
    assert "UserPolicy" not in out


def test_firewall_rule_merge_returns_deep_copy_not_mutating_base() -> None:
    base = {
        "Name": "R1",
        "PolicyType": "Network",
        "NetworkPolicy": {"Action": "Drop", "SourceZones": {"Zone": "LAN"}},
    }
    base_snapshot = {
        "Name": "R1",
        "PolicyType": "Network",
        "NetworkPolicy": {"Action": "Drop", "SourceZones": {"Zone": "LAN"}},
    }
    _ = merge_firewall_rule_form(
        base,
        {"name": "R1", "policy_type": "Network", "action": "Accept"},
    )
    assert base == base_snapshot


def test_firewall_rule_merge_leaves_policy_block_untouched_when_no_form_keys() -> None:
    base = {
        "Name": "R1",
        "PolicyType": "Network",
        "NetworkPolicy": {"Action": "Accept", "Schedule": "Office Hours"},
    }
    out = merge_firewall_rule_form(
        base,
        {"name": "R1", "status": "Enable"},
    )
    assert out["Status"] == "Enable"
    assert out["NetworkPolicy"] == {"Action": "Accept", "Schedule": "Office Hours"}
