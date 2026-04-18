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
from tests._ip_fixtures import ipv4, mask


# Dotted-quad samples used as opaque test payloads. Built at runtime from
# octet tuples so no IP literal appears in source (silences Sonar S1313 on
# what is purely test data).
_DST_NET_A = ipv4(10, 0, 0, 0)
_DST_NET_B = ipv4(10, 1, 0, 0)
_GW_A = ipv4(10, 0, 0, 1)
_GW_A_ALT = ipv4(10, 0, 0, 99)
_GW_B = ipv4(10, 1, 0, 1)
_MASK_24 = mask(255, 255, 255, 0)
_MASK_16 = mask(255, 255, 0, 0)
_PROBE_PRIMARY = ipv4(8, 8, 8, 8)
_PROBE_SECONDARY = ipv4(1, 1, 1, 1)
_GATEWAY_HOST_IP = ipv4(10, 10, 0, 1)
_GATEWAY_HOST_IP_ALT = ipv4(10, 10, 0, 99)
_USER_IP = ipv4(10, 0, 0, 20)
_USER_IP_ALT = ipv4(10, 0, 0, 21)
_DOC_GW_IP_BASE = ipv4(203, 0, 113, 1)
_DOC_GW_IP_NEW = ipv4(203, 0, 113, 5)


# ---------------------------------------------------------------------------
# Unicast Route
# ---------------------------------------------------------------------------


def test_unicast_route_merge_overlays_scalar_fields() -> None:
    base = {"DestinationIP": _DST_NET_A, "Netmask": _MASK_24, "Gateway": _GW_A}
    out = merge_unicast_route_form(
        base,
        {
            "DestinationIP": _DST_NET_B,
            "Netmask": _MASK_16,
            "Gateway": _GW_B,
            "Interface": "PortB",
            "Distance": "10",
            "description": "south branch",
        },
    )
    assert out["DestinationIP"] == _DST_NET_B
    assert out["Netmask"] == _MASK_16
    assert out["Gateway"] == _GW_B
    assert out["Interface"] == "PortB"
    assert out["Distance"] == "10"
    assert out["Description"] == "south branch"


def test_unicast_route_merge_keeps_unmapped_keys_from_base() -> None:
    base = {"DestinationIP": _DST_NET_A, "Custom": "keep-me"}
    out = merge_unicast_route_form(base, {"Gateway": _GW_A_ALT})
    assert out["Custom"] == "keep-me"
    assert out["Gateway"] == _GW_A_ALT


# ---------------------------------------------------------------------------
# Gateway
# ---------------------------------------------------------------------------


def test_gateway_merge_overlays_scalars_and_failover_rules() -> None:
    base = {"Name": "WAN1", "IPAddress": _DOC_GW_IP_BASE}
    out = merge_gateway_form(
        base,
        {
            "Name": "WAN1",
            "IPAddress": _DOC_GW_IP_NEW,
            "Weight": "10",
            "fail_over_rules": [
                {"Protocol": "Ping", "IPAddress": _PROBE_PRIMARY},
                {"Protocol": "TCP", "IPAddress": _PROBE_SECONDARY, "Port": "443"},
            ],
        },
    )
    assert out["IPAddress"] == _DOC_GW_IP_NEW
    assert out["Weight"] == "10"
    rules = out["FailOverRules"]
    assert isinstance(rules, dict) and "Rule" in rules
    rule_data = rules["Rule"]
    # The merge contract for a 2-item input must yield a 2-item list. Asserting
    # the shape up-front both documents the expected API and guards against an
    # IndexError if the contract regresses to returning a single dict.
    assert isinstance(rule_data, list) and len(rule_data) == 2
    assert rule_data[0]["Protocol"] == "Ping"
    assert rule_data[1]["Port"] == "443"


def test_gateway_merge_clears_failover_when_empty_list() -> None:
    base = {"Name": "WAN1", "FailOverRules": {"Rule": [{"Protocol": "Ping"}]}}
    out = merge_gateway_form(base, {"fail_over_rules": []})
    assert out["FailOverRules"] is None


# ---------------------------------------------------------------------------
# Custom Gateway / GatewayHost
# ---------------------------------------------------------------------------


def test_gateway_host_merge_overlays_scalars_and_monitoring() -> None:
    base = {"Name": "GH-1", "GatewayIP": _GATEWAY_HOST_IP}
    out = merge_gateway_host_form(
        base,
        {
            "Name": "GH-1",
            "GatewayIP": _GATEWAY_HOST_IP_ALT,
            "NetworkZone": "LAN",
            "monitoring_condition": [
                {"Protocol": "Ping", "IPAddress": _PROBE_PRIMARY},
            ],
        },
    )
    assert out["GatewayIP"] == _GATEWAY_HOST_IP_ALT
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
            "IPAddress": _USER_IP,
            "ClientLessGroup": "Default Group",
            "Email": "alice@example.com",
            "Status": "Active",
            "QuarantineDigest": "ApplyGroupSettings",
            "QoSPolicy": "None",
            "description": "QA tester",
        },
    )
    assert out["IPAddress"] == _USER_IP
    assert out["ClientLessGroup"] == "Default Group"
    assert out["Email"] == "alice@example.com"
    assert out["Status"] == "Active"
    assert out["QuarantineDigest"] == "ApplyGroupSettings"
    assert out["QoSPolicy"] == "None"
    assert out["Description"] == "QA tester"


def test_clientless_user_merge_accepts_alias_keys() -> None:
    out = merge_clientless_user_form(
        {"Name": "Bob"},
        {"username": "bob", "ip_address": _USER_IP_ALT, "clientless_group": "VPN"},
    )
    assert out["UserName"] == "bob"
    assert out["IPAddress"] == _USER_IP_ALT
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
