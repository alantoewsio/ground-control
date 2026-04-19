"""Smoke tests confirming ``firewall_rule`` is wired into every allowlist and
dispatch table the HS task queue, configuration apply pipeline and HTML routes
consult.

Mirrors the structure of ``test_dhcp_entity_allowlists.py``.  Guards against
silent regressions where adding firewall_rule to the UI bypasses the
queue/apply plumbing.
"""

from __future__ import annotations


_ENTITY = "firewall_rule"


def test_firewall_rule_in_main_hosts_services_allowlist() -> None:
    from app.main import HOSTS_SERVICES_ENTITY_TYPES

    assert _ENTITY in HOSTS_SERVICES_ENTITY_TYPES


def test_firewall_rule_registered_in_hs_pipeline() -> None:
    from app.task_queue_service import (
        HS_TASK_ENTITY_TYPES,
        HS_XML_TAG,
        _task_entity_supported_for_send,
        _task_entity_supports_create,
    )

    assert _ENTITY in HS_TASK_ENTITY_TYPES
    assert _ENTITY in HS_XML_TAG
    assert _task_entity_supported_for_send(_ENTITY)
    assert _task_entity_supports_create(_ENTITY)


def test_firewall_rule_xml_tag_uses_canonical_xml_root() -> None:
    from app.task_queue_service import HS_XML_TAG

    assert HS_XML_TAG[_ENTITY] == "FirewallRule"


def test_merge_dispatch_handles_firewall_rule() -> None:
    from app.task_queue_service import merge_hs_flyout_form

    merged = merge_hs_flyout_form(
        _ENTITY,
        {},
        {"name": "Allow-Web", "policy_type": "Network", "action": "Accept"},
    )
    assert isinstance(merged, dict)
    assert merged["Name"] == "Allow-Web"
    assert merged["NetworkPolicy"]["Action"] == "Accept"


def test_firewall_rule_present_in_sync_catalog() -> None:
    from app.firewall_config_sync import list_sync_entity_catalog

    catalog = list_sync_entity_catalog()
    ids = {item.get("id") for item in catalog}
    assert _ENTITY in ids


def test_firewall_rule_in_designer_navigation() -> None:
    import json
    from pathlib import Path

    here = Path(__file__).resolve().parents[1]
    nav_path = here / "data" / "designer_entity_type_navigation.json"
    data = json.loads(nav_path.read_text(encoding="utf-8"))
    entries = data.get("entries") or {}
    assert _ENTITY in entries
    spec = entries[_ENTITY]
    assert spec.get("nav_section") == "PROTECT"
    assert spec.get("nav_page") == "Firewall"


def test_firewall_rule_uses_name_as_external_identity() -> None:
    from app.task_queue_service import hs_entity_external_name, hs_entity_identity_label

    assert hs_entity_external_name(_ENTITY, {"Name": "Allow-Web"}) == "Allow-Web"
    assert hs_entity_identity_label(_ENTITY) == "Name"
