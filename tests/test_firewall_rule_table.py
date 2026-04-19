import json

from app.firewall_config_sync import ENTITY_FIREWALL_RULE, ENTITY_FIREWALL_RULE_GROUP
from app.firewall_rule_table import (
    _compute_rule_positions,
    _rule_after_name,
    _security_policy_names_from_group_payload,
    _sync_index_from_payload,
    build_firewall_rule_table_payload,
)
from app.models import Firewall, FirewallConfigEntry

from tests._ip_fixtures import ipv4


def test_compute_rule_positions_happy_path_chain():
    refs = [
        ("Rule A", ""),
        ("Rule C", "Rule B"),
        ("Rule B", "Rule A"),
    ]
    assert _compute_rule_positions(refs) == [1, 3, 2]


def test_compute_rule_positions_unknown_after_falls_back_to_root():
    refs = [
        ("Rule A", ""),
        ("Rule B", "NoSuchRule"),
        ("Rule C", "Rule B"),
    ]
    assert _compute_rule_positions(refs) == [1, 2, 3]


def test_rule_after_name_parses_dict_list_shapes():
    assert _rule_after_name({"After": {"Name": "Rule A"}}) == "Rule A"
    assert _rule_after_name({"After": [{"Name": "Rule B"}]}) == "Rule B"
    assert _rule_after_name({"After": ""}) == ""


def test_security_policy_names_from_group_payload_parses_list_shapes():
    payload = {
        "SecurityPolicyList": [{"SecurityPolicy": ["Rule A", "Rule B"]}],
        "SecurityPolicy": "Rule C",
    }
    assert _security_policy_names_from_group_payload(payload) == ["Rule C", "Rule A", "Rule B"]


def test_build_firewall_rule_table_payload_includes_group_cell(main_session):
    fw = Firewall(name="FW A", host=ipv4(10, 1, 1, 1), port=4444, username="admin", verify_ssl=False)
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=ENTITY_FIREWALL_RULE_GROUP,
            external_name="Group 1",
            payload_json=json.dumps(
                {
                    "Name": "Group 1",
                    "SecurityPolicyList": [{"SecurityPolicy": ["Allow LAN to WAN"]}],
                }
            ),
        )
    )
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=ENTITY_FIREWALL_RULE,
            external_name="Allow LAN to WAN",
            payload_json=json.dumps({"Name": "Allow LAN to WAN", "Status": "Enable"}),
        )
    )
    main_session.commit()

    payload = build_firewall_rule_table_payload(main_session, [fw.id])
    assert "__group" in payload["columns"]
    assert payload["column_labels"]["__group"] == "Group"
    assert payload["rows"][0]["cells"]["__group"] == "Group 1"


def test_sync_index_from_payload_parses_int_and_handles_garbage():
    assert _sync_index_from_payload({"@gc_sync_index": 3}) == 3
    assert _sync_index_from_payload({"@gc_sync_index": "7"}) == 7
    assert _sync_index_from_payload({"@gc_sync_index": 0}) is None
    assert _sync_index_from_payload({"@gc_sync_index": "x"}) is None
    assert _sync_index_from_payload({}) is None


def test_build_firewall_rule_table_payload_uses_sync_index_for_position(main_session):
    """Position must reflect the on-device order captured during sync.

    Rules are inserted in alphabetical-name order (the SQL ``order_by`` would
    show them as A→B→C), but the cached ``@gc_sync_index`` describes a
    different on-device order (B at #1, C at #2, A at #3).  The table builder
    must honour the sync index, otherwise drag-to-reorder + send + sync would
    appear to do nothing in the UI.
    """
    fw = Firewall(name="FW A", host=ipv4(10, 1, 2, 3), port=4444, username="admin", verify_ssl=False)
    main_session.add(fw)
    main_session.flush()
    for nm, idx in (("Rule A", 3), ("Rule B", 1), ("Rule C", 2)):
        main_session.add(
            FirewallConfigEntry(
                firewall_id=fw.id,
                entity_type=ENTITY_FIREWALL_RULE,
                external_name=nm,
                payload_json=json.dumps(
                    {"Name": nm, "Status": "Enable", "@gc_sync_index": idx}
                ),
            )
        )
    main_session.commit()

    payload = build_firewall_rule_table_payload(main_session, [fw.id])
    by_name = {r["cells"]["__name"]: r["cells"]["__position"] for r in payload["rows"]}
    assert by_name == {"Rule B": "1", "Rule C": "2", "Rule A": "3"}
    rendered_order = [r["cells"]["__name"] for r in payload["rows"]]
    assert rendered_order == ["Rule B", "Rule C", "Rule A"]


def test_build_firewall_rule_table_payload_falls_back_to_after_chain_when_index_missing(main_session):
    """Caches synced before @gc_sync_index existed must still render via After chain."""
    fw = Firewall(name="FW B", host=ipv4(10, 1, 2, 4), port=4444, username="admin", verify_ssl=False)
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=ENTITY_FIREWALL_RULE,
            external_name="Rule A",
            payload_json=json.dumps({"Name": "Rule A", "Status": "Enable"}),
        )
    )
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=ENTITY_FIREWALL_RULE,
            external_name="Rule B",
            payload_json=json.dumps(
                {"Name": "Rule B", "Status": "Enable", "After": {"Name": "Rule A"}}
            ),
        )
    )
    main_session.commit()

    payload = build_firewall_rule_table_payload(main_session, [fw.id])
    rendered = [(r["cells"]["__name"], r["cells"]["__position"]) for r in payload["rows"]]
    assert rendered == [("Rule A", "1"), ("Rule B", "2")]
