"""Merge tests for the DHCP entity types (Phase 1 of DHCP Add support):

- IPv4 DHCP Server (``dhcp_server``)
- IPv6 DHCP Server (``dhcp_server_ipv6``)
- DHCP Relay (``dhcp_relay``)

Covers the form-to-payload deep-merge contract (scalar overlay, repeating
``IPLease`` / ``StaticLease`` / ``DHCPOption`` blocks, single-vs-list xmltodict
shape preservation) used by the HS task queue and the configuration-apply
pipeline.
"""

from __future__ import annotations

from app.hs_flyout_merge import (
    merge_dhcp_relay_form,
    merge_dhcp_server_form,
    merge_dhcp_server_ipv6_form,
)
from tests._ip_fixtures import ipv4, mask

# Octet-built IP literals so no dotted-quad string appears in source.
_LAN_GW = ipv4(192, 168, 1, 1)
_LAN_START = ipv4(192, 168, 1, 100)
_LAN_END = ipv4(192, 168, 1, 200)
_LAN_START_ALT = ipv4(192, 168, 1, 50)
_LAN_END_ALT = ipv4(192, 168, 1, 80)
_DNS_PRI = ipv4(8, 8, 8, 8)
_DNS_SEC = ipv4(1, 1, 1, 1)
_RELAY_SRV_A = ipv4(10, 10, 0, 5)
_RELAY_SRV_B = ipv4(10, 10, 0, 6)
_STATIC_LEASE_IP = ipv4(192, 168, 1, 50)
_MASK_24 = mask(255, 255, 255, 0)


# ---------------------------------------------------------------------------
# IPv4 DHCP Server
# ---------------------------------------------------------------------------


def test_dhcp_server_merge_overlays_scalar_fields() -> None:
    base = {"Name": "LAN-DHCP", "Interface": "Port1"}
    out = merge_dhcp_server_form(
        base,
        {
            "name": "LAN-DHCP",
            "Interface": "Port2",
            "SubnetMask": _MASK_24,
            "Gateway": _LAN_GW,
            "DomainName": "lan.example.com",
            "DefaultLeaseTime": "86400",
            "MaxLeaseTime": "86400",
            "ConflictDetection": "Enable",
            "UseApplianceDNSSettings": "Disable",
            "PrimaryDNSServer": _DNS_PRI,
            "SecondaryDNSServer": _DNS_SEC,
            "LeaseForRelay": "Disable",
        },
    )
    assert out["Interface"] == "Port2"
    assert out["SubnetMask"] == _MASK_24
    assert out["Gateway"] == _LAN_GW
    assert out["DomainName"] == "lan.example.com"
    assert out["DefaultLeaseTime"] == "86400"
    assert out["ConflictDetection"] == "Enable"
    assert out["PrimaryDNSServer"] == _DNS_PRI
    assert out["SecondaryDNSServer"] == _DNS_SEC


def test_dhcp_server_merge_overlays_iplease_block_single_range() -> None:
    out = merge_dhcp_server_form(
        {"Name": "LAN-DHCP"},
        {"name": "LAN-DHCP", "ip_lease": [f"{_LAN_START}-{_LAN_END}"]},
    )
    assert out["IPLease"] == {"IP": f"{_LAN_START}-{_LAN_END}"}


def test_dhcp_server_merge_overlays_iplease_block_multiple_ranges() -> None:
    out = merge_dhcp_server_form(
        {"Name": "LAN-DHCP"},
        {
            "name": "LAN-DHCP",
            "ip_lease": [
                f"{_LAN_START}-{_LAN_END}",
                f"{_LAN_START_ALT}-{_LAN_END_ALT}",
            ],
        },
    )
    block = out["IPLease"]
    assert isinstance(block, dict) and isinstance(block["IP"], list)
    assert block["IP"][0] == f"{_LAN_START}-{_LAN_END}"
    assert block["IP"][1] == f"{_LAN_START_ALT}-{_LAN_END_ALT}"


def test_dhcp_server_merge_clears_iplease_when_empty_list() -> None:
    base = {"Name": "LAN-DHCP", "IPLease": {"IP": f"{_LAN_START}-{_LAN_END}"}}
    out = merge_dhcp_server_form(base, {"name": "LAN-DHCP", "ip_lease": []})
    assert out["IPLease"] is None


def test_dhcp_server_merge_overlays_static_lease_v4_block() -> None:
    out = merge_dhcp_server_form(
        {"Name": "LAN-DHCP"},
        {
            "name": "LAN-DHCP",
            "static_lease": [
                {
                    "HostName": "printer",
                    "MACAddress": "AA:BB:CC:DD:EE:FF",
                    "IPAddress": _STATIC_LEASE_IP,
                }
            ],
        },
    )
    block = out["StaticLease"]
    assert isinstance(block, dict)
    lease = block["Lease"]
    assert lease["HostName"] == "printer"
    assert lease["MACAddress"] == "AA:BB:CC:DD:EE:FF"
    assert lease["IPAddress"] == _STATIC_LEASE_IP


def test_dhcp_server_merge_overlays_dhcp_options_single_row() -> None:
    out = merge_dhcp_server_form(
        {"Name": "LAN-DHCP"},
        {
            "name": "LAN-DHCP",
            "dhcp_options": [
                {
                    "OptionName": "tftp",
                    "OptionType": "string",
                    "OptionCode": "66",
                    "OptionValue": "tftp.lan.example.com",
                }
            ],
        },
    )
    block = out["DHCPOption"]
    assert isinstance(block, dict)
    opt = block["Options"]
    assert opt["OptionName"] == "tftp"
    assert opt["OptionCode"] == "66"


def test_dhcp_server_merge_keeps_unmapped_keys_from_base() -> None:
    base = {"Name": "LAN-DHCP", "Custom": "keep-me"}
    out = merge_dhcp_server_form(base, {"name": "LAN-DHCP", "Interface": "Port3"})
    assert out["Custom"] == "keep-me"
    assert out["Interface"] == "Port3"


# ---------------------------------------------------------------------------
# IPv6 DHCP Server
# ---------------------------------------------------------------------------


def test_dhcp_server_ipv6_merge_overlays_scalar_fields() -> None:
    base = {"Name": "V6-LAN", "Interface": "Port1"}
    out = merge_dhcp_server_ipv6_form(
        base,
        {
            "name": "V6-LAN",
            "Interface": "Port2",
            "PreferredTime": "3600",
            "ValidTime": "7200",
            "UseApplianceDNSSettings": "Disable",
            "primarydnsv6": "2001:4860:4860::8888",
            "secondarydnsv6": "2001:4860:4860::8844",
            "LeaseForRelay": "Disable",
        },
    )
    assert out["Interface"] == "Port2"
    assert out["PreferredTime"] == "3600"
    assert out["ValidTime"] == "7200"
    assert out["primarydnsv6"] == "2001:4860:4860::8888"
    assert out["secondarydnsv6"] == "2001:4860:4860::8844"


def test_dhcp_server_ipv6_merge_overlays_static_lease_with_duid() -> None:
    out = merge_dhcp_server_ipv6_form(
        {"Name": "V6-LAN"},
        {
            "name": "V6-LAN",
            "static_lease": [
                {
                    "HostName": "node-a",
                    "DUID": "00:01:00:01:1f:e0:34:1d:00:50:56:9b:00:01",
                    "IPAddress": "2001:db8::100",
                },
                {
                    "HostName": "node-b",
                    "DUID": "00:01:00:01:1f:e0:34:1d:00:50:56:9b:00:02",
                    "IPAddress": "2001:db8::101",
                },
            ],
        },
    )
    block = out["StaticLease"]
    assert isinstance(block, dict) and isinstance(block["Lease"], list)
    assert block["Lease"][0]["DUID"].startswith("00:01:00:01")
    assert block["Lease"][1]["IPAddress"] == "2001:db8::101"


def test_dhcp_server_ipv6_merge_clears_static_lease_when_empty() -> None:
    base = {"Name": "V6-LAN", "StaticLease": {"Lease": {"HostName": "x"}}}
    out = merge_dhcp_server_ipv6_form(
        base, {"name": "V6-LAN", "static_lease": []}
    )
    assert out["StaticLease"] is None


# ---------------------------------------------------------------------------
# DHCP Relay
# ---------------------------------------------------------------------------


def test_dhcp_relay_merge_overlays_scalars_and_single_server_ip() -> None:
    base = {"Name": "Relay-1"}
    out = merge_dhcp_relay_form(
        base,
        {
            "name": "Relay-1",
            "IPFamily": "IPv4",
            "Interface": "Port1",
            "RelaythroughIPSec": "Disable",
            "dhcp_server_ip": [_RELAY_SRV_A],
        },
    )
    assert out["IPFamily"] == "IPv4"
    assert out["Interface"] == "Port1"
    assert out["RelaythroughIPSec"] == "Disable"
    assert out["DHCPServerIP"] == _RELAY_SRV_A


def test_dhcp_relay_merge_overlays_multiple_server_ips_as_list() -> None:
    out = merge_dhcp_relay_form(
        {"Name": "Relay-1"},
        {
            "name": "Relay-1",
            "dhcp_server_ip": [_RELAY_SRV_A, _RELAY_SRV_B],
        },
    )
    assert isinstance(out["DHCPServerIP"], list)
    assert out["DHCPServerIP"][0] == _RELAY_SRV_A
    assert out["DHCPServerIP"][1] == _RELAY_SRV_B


def test_dhcp_relay_merge_clears_server_ips_when_empty_list() -> None:
    base = {"Name": "Relay-1", "DHCPServerIP": [_RELAY_SRV_A, _RELAY_SRV_B]}
    out = merge_dhcp_relay_form(base, {"name": "Relay-1", "dhcp_server_ip": []})
    assert out["DHCPServerIP"] is None
