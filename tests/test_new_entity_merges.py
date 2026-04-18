"""Merge tests for the new entity types added in Phase 2:

- Unicast Route (``unicast_route``)
- Gateway (``gateway``)
- Custom Gateway / GatewayHost (``gateway_host``)
- Clientless User (``clientless_user``)
- Local Service ACL (``acl_rule``)

These tests cover the form-to-payload deep-merge contract used by the HS task
queue and the configuration-apply pipeline, including nested repeating groups
where applicable.
"""

from __future__ import annotations

from app.hs_flyout_merge import (
    merge_clientless_user_form,
    merge_gateway_form,
    merge_gateway_host_form,
    merge_local_service_acl_form,
    merge_unicast_route_form,
)


# ---------------------------------------------------------------------------
# Unicast Route
# ---------------------------------------------------------------------------


def test_unicast_route_merge_overlays_scalar_fields() -> None:
    base = {"DestinationIP": "10.0.0.0", "Netmask": "255.255.255.0", "Gateway": "10.0.0.1"}
    out = merge_unicast_route_form(
        base,
        {
            "DestinationIP": "10.1.0.0",
            "Netmask": "255.255.0.0",
            "Gateway": "10.1.0.1",
            "Interface": "PortB",
            "Distance": "10",
            "description": "south branch",
        },
    )
    assert out["DestinationIP"] == "10.1.0.0"
    assert out["Netmask"] == "255.255.0.0"
    assert out["Gateway"] == "10.1.0.1"
    assert out["Interface"] == "PortB"
    assert out["Distance"] == "10"
    assert out["Description"] == "south branch"


def test_unicast_route_merge_keeps_unmapped_keys_from_base() -> None:
    base = {"DestinationIP": "10.0.0.0", "Custom": "keep-me"}
    out = merge_unicast_route_form(base, {"Gateway": "10.0.0.99"})
    assert out["Custom"] == "keep-me"
    assert out["Gateway"] == "10.0.0.99"


# ---------------------------------------------------------------------------
# Gateway
# ---------------------------------------------------------------------------


def test_gateway_merge_overlays_scalars_and_failover_rules() -> None:
    base = {"Name": "WAN1", "IPAddress": "203.0.113.1"}
    out = merge_gateway_form(
        base,
        {
            "Name": "WAN1",
            "IPAddress": "203.0.113.5",
            "Weight": "10",
            "fail_over_rules": [
                {"Protocol": "Ping", "IPAddress": "8.8.8.8"},
                {"Protocol": "TCP", "IPAddress": "1.1.1.1", "Port": "443"},
            ],
        },
    )
    assert out["IPAddress"] == "203.0.113.5"
    assert out["Weight"] == "10"
    rules = out["FailOverRules"]
    assert isinstance(rules, dict) and "Rule" in rules
    items = rules["Rule"] if isinstance(rules["Rule"], list) else [rules["Rule"]]
    assert items[0]["Protocol"] == "Ping"
    assert items[1]["Port"] == "443"


def test_gateway_merge_clears_failover_when_empty_list() -> None:
    base = {"Name": "WAN1", "FailOverRules": {"Rule": [{"Protocol": "Ping"}]}}
    out = merge_gateway_form(base, {"fail_over_rules": []})
    assert out["FailOverRules"] is None


# ---------------------------------------------------------------------------
# Custom Gateway / GatewayHost
# ---------------------------------------------------------------------------


def test_gateway_host_merge_overlays_scalars_and_monitoring() -> None:
    base = {"Name": "GH-1", "GatewayIP": "10.10.0.1"}
    out = merge_gateway_host_form(
        base,
        {
            "Name": "GH-1",
            "GatewayIP": "10.10.0.99",
            "NetworkZone": "LAN",
            "monitoring_condition": [
                {"Protocol": "Ping", "IPAddress": "8.8.8.8"},
            ],
        },
    )
    assert out["GatewayIP"] == "10.10.0.99"
    assert out["NetworkZone"] == "LAN"
    mc = out["MonitoringCondition"]
    assert isinstance(mc, dict) and "Rule" in mc
    rule = mc["Rule"] if isinstance(mc["Rule"], dict) else mc["Rule"][0]
    assert rule["Protocol"] == "Ping"


# ---------------------------------------------------------------------------
# Clientless User
# ---------------------------------------------------------------------------


def test_clientless_user_merge_overlays_all_scalars() -> None:
    base = {"Name": "Alice", "UserName": "alice"}
    out = merge_clientless_user_form(
        base,
        {
            "Name": "Alice",
            "UserName": "alice",
            "IPAddress": "10.0.0.20",
            "ClientLessGroup": "Default Group",
            "Email": "alice@example.com",
            "Status": "Active",
            "QuarantineDigest": "ApplyGroupSettings",
            "QoSPolicy": "None",
            "description": "QA tester",
        },
    )
    assert out["IPAddress"] == "10.0.0.20"
    assert out["ClientLessGroup"] == "Default Group"
    assert out["Email"] == "alice@example.com"
    assert out["Status"] == "Active"
    assert out["QuarantineDigest"] == "ApplyGroupSettings"
    assert out["QoSPolicy"] == "None"
    assert out["Description"] == "QA tester"


def test_clientless_user_merge_accepts_alias_keys() -> None:
    out = merge_clientless_user_form(
        {"Name": "Bob"},
        {"username": "bob", "ip_address": "10.0.0.21", "clientless_group": "VPN"},
    )
    assert out["UserName"] == "bob"
    assert out["IPAddress"] == "10.0.0.21"
    assert out["ClientLessGroup"] == "VPN"


# ---------------------------------------------------------------------------
# Local Service ACL
# ---------------------------------------------------------------------------


def test_local_service_acl_merge_scalars_and_lists() -> None:
    base = {"RuleName": "Rule-A", "Action": "Accept"}
    out = merge_local_service_acl_form(
        base,
        {
            "RuleName": "Rule-A",
            "Action": "Drop",
            "IPFamily": "IPv4",
            "SourceZone": "WAN",
            "source_hosts": ["Host-A", "Host-B"],
            "dst_hosts": ["Host-C"],
            "services": ["HTTP", "HTTPS"],
            "description": "Block guest WAN",
        },
    )
    assert out["Action"] == "Drop"
    assert out["IPFamily"] == "IPv4"
    assert out["SourceZone"] == "WAN"
    assert out["Description"] == "Block guest WAN"
    hosts = out["Hosts"]
    assert isinstance(hosts, dict)
    assert hosts.get("Host") == ["Host-A", "Host-B"]
    assert hosts.get("DstHost") == "Host-C"
    services = out["Services"]
    assert services == {"Service": ["HTTP", "HTTPS"]}


def test_local_service_acl_merge_clears_lists_when_empty() -> None:
    base = {
        "RuleName": "Rule-X",
        "Hosts": {"Host": ["A", "B"]},
        "Services": {"Service": "HTTP"},
    }
    out = merge_local_service_acl_form(
        base,
        {"source_hosts": [], "dst_hosts": [], "services": []},
    )
    assert out["Hosts"] is None
    assert out["Services"] is None
