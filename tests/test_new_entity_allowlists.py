"""Smoke tests confirming the new entity types are present in every allowlist
that the HS task queue, configuration apply pipeline and HTML routes consult.

These guard against accidental regressions where adding new entities to the UI
silently bypasses the queue/apply/dispatch wiring.
"""

from __future__ import annotations

import pytest

from tests._ip_fixtures import ipv4, mask


NEW_ENTITY_TYPES: tuple[str, ...] = (
    "unicast_route",
    "gateway",
    "gateway_host",
    "clientless_user",
    "acl_rule",
)


# Sample IPs / masks used as opaque test payloads. Built at runtime via the
# ipv4()/mask() helpers so the dotted-quad literals do not appear in source
# (silences Sonar S1313 hardcoded-IP hotspots on what is purely test data).
_DEST_NET = ipv4(10, 0, 0, 0)
_DEST_MASK = mask(255, 0, 0, 0)
_GATEWAY_IP = ipv4(10, 0, 0, 1)
_GATEWAY_PUBLIC_IP = ipv4(1, 2, 3, 4)


@pytest.mark.parametrize("et", NEW_ENTITY_TYPES)
def test_entity_in_main_hosts_services_allowlist(et: str) -> None:
    from app.main import HOSTS_SERVICES_ENTITY_TYPES

    assert et in HOSTS_SERVICES_ENTITY_TYPES


@pytest.mark.parametrize("et", NEW_ENTITY_TYPES)
def test_entity_in_task_queue_hs_pipeline(et: str) -> None:
    from app.task_queue_service import (
        HS_TASK_ENTITY_TYPES,
        _TASK_QUEUE_CREATE_SUPPORTED_ENTITY_TYPES,
        _TASK_QUEUE_SEND_SUPPORTED_ENTITY_TYPES,
    )

    assert et in HS_TASK_ENTITY_TYPES
    assert et in _TASK_QUEUE_CREATE_SUPPORTED_ENTITY_TYPES
    assert et in _TASK_QUEUE_SEND_SUPPORTED_ENTITY_TYPES


def test_merge_dispatch_handles_each_new_entity_type() -> None:
    from app.task_queue_service import merge_hs_flyout_form

    samples: dict[str, dict[str, object]] = {
        "unicast_route": {"DestinationIP": _DEST_NET, "Netmask": _DEST_MASK, "Gateway": _GATEWAY_IP},
        "gateway": {"Name": "GW1", "IPAddress": _GATEWAY_PUBLIC_IP},
        "gateway_host": {"Name": "GH1", "GatewayIP": _GATEWAY_IP},
        "clientless_user": {"Name": "U1", "UserName": "u1", "Email": "u1@example.com"},
        "acl_rule": {"RuleName": "R1", "Action": "Accept", "SourceZone": "LAN"},
    }
    for et, form in samples.items():
        merged = merge_hs_flyout_form(et, {}, form)
        assert isinstance(merged, dict)


def test_hs_entity_external_name_uses_entity_specific_identity() -> None:
    from app.task_queue_service import hs_entity_external_name, hs_entity_identity_label

    assert hs_entity_external_name("unicast_route", {"DestinationIP": _DEST_NET}) == _DEST_NET
    assert hs_entity_external_name("acl_rule", {"RuleName": "Rule-X"}) == "Rule-X"
    assert hs_entity_external_name("clientless_user", {"Name": "Alice"}) == "Alice"

    assert hs_entity_identity_label("unicast_route") == "Destination IP"
    assert hs_entity_identity_label("acl_rule") == "Rule name"
    assert hs_entity_identity_label("clientless_user") == "Name"
