import json

from app.firewall_config_sync import ENTITY_FIREWALL_RULE, ENTITY_FIREWALL_RULE_GROUP
from app.firewall_rule_table import (
    _compute_rule_positions,
    _rule_after_name,
    _security_policy_names_from_group_payload,
    build_firewall_rule_table_payload,
)
from app.models import Firewall, FirewallConfigEntry


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
    fw = Firewall(name="FW A", host="10.1.1.1", port=4444, username="admin", verify_ssl=False)
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
