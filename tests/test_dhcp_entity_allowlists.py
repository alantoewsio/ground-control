"""Smoke tests confirming the three DHCP entity types are wired into every
allowlist and dispatch table the HS task queue, configuration apply pipeline
and HTML routes consult.

Mirrors the structure of ``test_new_entity_allowlists.py``. Guards against
silent regressions where adding DHCP to the UI bypasses the queue/apply
plumbing.
"""

from __future__ import annotations

import pytest

from tests._ip_fixtures import ipv4

DHCP_ENTITY_TYPES: tuple[str, ...] = (
    "dhcp_server",
    "dhcp_server_ipv6",
    "dhcp_relay",
)

# Octet-built sample IPs so no dotted-quad string appears in source.
_LAN_GW = ipv4(192, 168, 1, 1)
_RELAY_SRV = ipv4(10, 10, 0, 5)


@pytest.mark.parametrize("et", DHCP_ENTITY_TYPES)
def test_dhcp_entity_in_main_hosts_services_allowlist(et: str) -> None:
    from app.main import HOSTS_SERVICES_ENTITY_TYPES

    assert et in HOSTS_SERVICES_ENTITY_TYPES


@pytest.mark.parametrize("et", DHCP_ENTITY_TYPES)
def test_dhcp_entity_registered_in_hs_pipeline(et: str) -> None:
    from app.task_queue_service import (
        HS_TASK_ENTITY_TYPES,
        HS_XML_TAG,
        _task_entity_supports_create,
        _task_entity_supports_send,
    )

    assert et in HS_TASK_ENTITY_TYPES
    assert et in HS_XML_TAG
    assert _task_entity_supports_send(et)
    assert _task_entity_supports_create(et)


def test_dhcp_xml_tag_mapping_uses_canonical_xml_root() -> None:
    from app.task_queue_service import HS_XML_TAG

    assert HS_XML_TAG["dhcp_server"] == "DHCPServer"
    assert HS_XML_TAG["dhcp_server_ipv6"] == "DHCPServerIpv6"
    assert HS_XML_TAG["dhcp_relay"] == "DHCPRelay"


def test_merge_dispatch_handles_each_dhcp_entity_type() -> None:
    from app.task_queue_service import merge_hs_flyout_form

    samples: dict[str, dict[str, object]] = {
        "dhcp_server": {
            "name": "LAN-DHCP",
            "Interface": "Port1",
            "Gateway": _LAN_GW,
        },
        "dhcp_server_ipv6": {
            "name": "V6-LAN",
            "Interface": "Port1",
            "PreferredTime": "3600",
        },
        "dhcp_relay": {
            "name": "Relay-1",
            "IPFamily": "IPv4",
            "Interface": "Port1",
            "dhcp_server_ip": [_RELAY_SRV],
        },
    }
    for et, form in samples.items():
        merged = merge_hs_flyout_form(et, {}, form)
        assert isinstance(merged, dict)
        assert merged.get("Name") == form["name"]


@pytest.mark.parametrize("et", DHCP_ENTITY_TYPES)
def test_dhcp_entity_present_in_sync_catalog(et: str) -> None:
    from app.firewall_config_sync import list_sync_entity_catalog

    catalog = list_sync_entity_catalog()
    ids = {item.get("id") for item in catalog}
    assert et in ids, f"{et} missing from sync catalog"


@pytest.mark.parametrize("et", DHCP_ENTITY_TYPES)
def test_dhcp_entity_in_designer_navigation(et: str) -> None:
    import json
    from pathlib import Path

    here = Path(__file__).resolve().parents[1]
    nav_path = here / "data" / "designer_entity_type_navigation.json"
    data = json.loads(nav_path.read_text(encoding="utf-8"))
    entries = data.get("entries") or {}
    assert et in entries, f"{et} not registered in designer navigation"
    spec = entries[et]
    assert spec.get("nav_page") == "Network"
    assert spec.get("tab") == "DHCP"


def test_dhcp_entity_uses_name_as_external_identity() -> None:
    from app.task_queue_service import hs_entity_external_name, hs_entity_identity_label

    assert hs_entity_external_name("dhcp_server", {"Name": "LAN-DHCP"}) == "LAN-DHCP"
    assert hs_entity_external_name("dhcp_server_ipv6", {"Name": "V6-LAN"}) == "V6-LAN"
    assert hs_entity_external_name("dhcp_relay", {"Name": "Relay-1"}) == "Relay-1"

    assert hs_entity_identity_label("dhcp_server") == "Name"
    assert hs_entity_identity_label("dhcp_server_ipv6") == "Name"
    assert hs_entity_identity_label("dhcp_relay") == "Name"
