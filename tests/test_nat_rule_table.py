"""Read-only NAT rules table builder tests.

Mirrors :mod:`tests.test_firewall_rule_table` for the ``nat_rule`` entity.
"""

from __future__ import annotations

import json

from app.firewall_config_sync import ENTITY_NAT_RULE
from app.models import Firewall, FirewallConfigEntry
from app.nat_rule_table import (
    _members_from_container,
    _string_join,
    build_nat_rule_table_payload,
)

from tests._ip_fixtures import ipv4


def test_string_join_handles_dict_with_repeating_child():
    """``xmltodict``-style ``{"Network": ["a", "b"]}`` flattens to ``"a, b"``."""
    assert _string_join({"Network": ["a", "b"]}) == "a, b"


def test_string_join_truncates_with_ellipsis():
    items = ["a", "b", "c", "d", "e", "f"]
    out = _string_join(items, max_items=3)
    assert out == "a, b, c +3 more"


def test_string_join_handles_single_string_value():
    assert _string_join("eth0") == "eth0"


def test_string_join_skips_blank_entries():
    assert _string_join(["", "  ", "lan"]) == "lan"


def test_string_join_returns_empty_for_none():
    assert _string_join(None) == ""


def test_members_from_container_unwraps_dict_shape():
    data = {"OriginalSourceNetworks": {"Network": ["LAN", "DMZ"]}}
    assert _members_from_container(data, "OriginalSourceNetworks", "Network") == ["LAN", "DMZ"]


def test_members_from_container_unwraps_list_of_dicts_shape():
    data = {"OriginalServices": [{"Service": "HTTP"}, {"Service": "HTTPS"}]}
    assert _members_from_container(data, "OriginalServices", "Service") == ["HTTP", "HTTPS"]


def test_members_from_container_returns_bare_list_unchanged():
    data = {"InboundInterfaces": ["PortA", "PortB"]}
    assert _members_from_container(data, "InboundInterfaces", "Interface") == ["PortA", "PortB"]


def test_members_from_container_returns_none_when_missing():
    assert _members_from_container({}, "OriginalSourceNetworks", "Network") is None


def test_build_nat_rule_table_payload_returns_empty_with_no_firewalls(main_session):
    payload = build_nat_rule_table_payload(main_session, [])
    assert payload["columns"]
    assert "__name" in payload["columns"]
    assert "__original_src" in payload["columns"]
    assert "__translated_src" in payload["columns"]
    assert payload["rows"] == []


def test_build_nat_rule_table_payload_renders_full_row(main_session):
    fw = Firewall(name="FW A", host=ipv4(10, 0, 0, 1), port=4444, username="admin", verify_ssl=False)
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=ENTITY_NAT_RULE,
            external_name="Outbound MASQ",
            payload_json=json.dumps(
                {
                    "Name": "Outbound MASQ",
                    "Description": "Default egress NAT",
                    "Status": "Enable",
                    "IPFamily": "IPv4",
                    "OriginalSourceNetworks": {"Network": ["LAN", "DMZ"]},
                    "OriginalDestinationNetworks": {"Network": "Any"},
                    "OriginalServices": {"Service": "Any"},
                    "TranslatedSource": "MASQ",
                    "TranslatedDestination": "Original",
                    "TranslatedService": "Original",
                    "InboundInterfaces": {"Interface": ["PortA"]},
                    "OutboundInterfaces": {"Interface": ["PortB", "PortC"]},
                    "LinkedFirewallrule": "Allow LAN to WAN",
                }
            ),
        )
    )
    main_session.commit()

    payload = build_nat_rule_table_payload(main_session, [fw.id])
    assert len(payload["rows"]) == 1
    row = payload["rows"][0]
    cells = row["cells"]
    assert cells["__name"] == "Outbound MASQ"
    assert cells["__description"] == "Default egress NAT"
    assert cells["__status"] == "Enable"
    assert cells["__ip_family"] == "IPv4"
    assert cells["__original_src"] == "LAN, DMZ"
    assert cells["__original_dst"] == "Any"
    assert cells["__original_service"] == "Any"
    assert cells["__translated_src"] == "MASQ"
    assert cells["__translated_dst"] == "Original"
    assert cells["__translated_service"] == "Original"
    assert cells["__inbound_if"] == "PortA"
    assert cells["__outbound_if"] == "PortB, PortC"
    assert cells["__linked_rule"] == "Allow LAN to WAN"
    assert cells["__firewall"] == "FW A"
    assert cells["__position"] == "1"
    assert "lan" in row["search"]
    assert row["entity_type"] == ENTITY_NAT_RULE


def test_build_nat_rule_table_payload_assigns_chained_positions(main_session):
    fw = Firewall(name="FW B", host=ipv4(10, 0, 0, 2), port=4444, username="admin", verify_ssl=False)
    main_session.add(fw)
    main_session.flush()
    main_session.add_all(
        [
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type=ENTITY_NAT_RULE,
                external_name="Rule A",
                payload_json=json.dumps({"Name": "Rule A", "Status": "Enable"}),
            ),
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type=ENTITY_NAT_RULE,
                external_name="Rule B",
                payload_json=json.dumps(
                    {"Name": "Rule B", "After": {"Name": "Rule A"}, "Status": "Enable"}
                ),
            ),
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type=ENTITY_NAT_RULE,
                external_name="Rule C",
                payload_json=json.dumps(
                    {"Name": "Rule C", "After": {"Name": "Rule B"}, "Status": "Enable"}
                ),
            ),
        ]
    )
    main_session.commit()

    payload = build_nat_rule_table_payload(main_session, [fw.id])
    positions = {r["cells"]["__name"]: r["cells"]["__position"] for r in payload["rows"]}
    assert positions == {"Rule A": "1", "Rule B": "2", "Rule C": "3"}


def test_build_nat_rule_table_payload_uses_external_name_as_fallback(main_session):
    fw = Firewall(name="FW C", host=ipv4(10, 0, 0, 3), port=4444, username="admin", verify_ssl=False)
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=ENTITY_NAT_RULE,
            external_name="Fallback NAT",
            payload_json=json.dumps({"Status": "Enable"}),
        )
    )
    main_session.commit()

    payload = build_nat_rule_table_payload(main_session, [fw.id])
    assert payload["rows"][0]["cells"]["__name"] == "Fallback NAT"


def test_build_nat_rule_table_payload_visible_defaults_subset_of_columns(main_session):
    """Every default-visible column must exist in the column list."""
    out = build_nat_rule_table_payload(main_session, [])
    assert set(out["columns_visible_by_default"]).issubset(set(out["columns"]))
    assert "__name" in out["columns_visible_by_default"]
    assert "__position" in out["columns_visible_by_default"]


def test_build_nat_rule_table_payload_uses_sync_index_for_position(main_session):
    """Mirror of the firewall_rule sync-index test for nat_rule.

    Without honouring ``@gc_sync_index`` here, drag-to-reorder for NAT rules
    would silently fail to surface in the UI even when the firewall actually
    moved the rule on-device.
    """
    fw = Firewall(name="FW NAT", host=ipv4(10, 0, 0, 4), port=4444, username="admin", verify_ssl=False)
    main_session.add(fw)
    main_session.flush()
    for nm, idx in (("NAT A", 3), ("NAT B", 1), ("NAT C", 2)):
        main_session.add(
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type=ENTITY_NAT_RULE,
                external_name=nm,
                payload_json=json.dumps(
                    {"Name": nm, "Status": "Enable", "@gc_sync_index": idx}
                ),
            )
        )
    main_session.commit()

    payload = build_nat_rule_table_payload(main_session, [fw.id])
    rendered = [(r["cells"]["__name"], r["cells"]["__position"]) for r in payload["rows"]]
    assert rendered == [("NAT B", "1"), ("NAT C", "2"), ("NAT A", "3")]
