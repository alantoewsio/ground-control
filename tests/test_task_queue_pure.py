"""Unit tests for pure helpers in ``app.task_queue_service`` (no firewall I/O)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app import task_queue_service as tq
from app.firewall_config_sync import (
    ENTITY_ACCESS_TIME_POLICY,
    ENTITY_ADMIN_PROFILE,
    ENTITY_ALIAS,
    ENTITY_BRIDGE_PAIR,
    ENTITY_DATA_TRANSFER_POLICY,
    ENTITY_DECRYPTION_PROFILE,
    ENTITY_DOS_BYPASS_RULE,
    ENTITY_DOS_SETTINGS,
    ENTITY_FIREWALL_RULE_GROUP,
    ENTITY_INTERFACE,
    ENTITY_IP_HOST,
    ENTITY_IP_HOSTGROUP,
    ENTITY_IPS_CUSTOM_SIGNATURE,
    ENTITY_IPS_FULL_SIGNATURE_PACK,
    ENTITY_IPS_POLICY,
    ENTITY_IPS_SWITCH,
    ENTITY_LAG,
    ENTITY_SCHEDULE,
    ENTITY_SPOOF_PREVENTION,
    ENTITY_SURFING_QUOTA_POLICY,
    ENTITY_TRUSTED_MAC,
    ENTITY_USER,
    ENTITY_USER_GROUP,
    ENTITY_VLAN,
    ENTITY_VPN_PROFILE,
    ENTITY_WEBFILTER_POLICY,
)
from app.models import TaskQueue, TaskQueueCompleted


@pytest.fixture(autouse=True)
def _empty_task_tables(main_session):
    """Task-queue helpers assume no rows unless the test creates them."""
    main_session.query(TaskQueue).delete(synchronize_session=False)
    main_session.query(TaskQueueCompleted).delete(synchronize_session=False)
    main_session.commit()
    yield


def test_prune_none_values():
    assert tq._prune_none_values(None) is None
    assert tq._prune_none_values({"a": None, "b": 1}) == {"b": 1}
    assert tq._prune_none_values([None, {"x": 1}, {}]) == [{"x": 1}]
    assert tq._prune_none_values("x") == "x"


def test_scalar_any():
    assert tq._scalar_any(None) == ""
    assert tq._scalar_any("  hi  ") == "hi"
    assert tq._scalar_any({"#text": " t "}) == "t"
    assert tq._scalar_any({"text": " u "}) == "u"


@pytest.mark.parametrize(
    "entity,expected",
    [
        (ENTITY_INTERFACE, ["interface"]),
        (ENTITY_VLAN, ["vlan"]),
        (ENTITY_BRIDGE_PAIR, ["bridge_pair"]),
        (ENTITY_LAG, ["lag"]),
        (ENTITY_ALIAS, ["alias"]),
        (ENTITY_IP_HOST, ["ip_host"]),
        (ENTITY_IP_HOSTGROUP, ["ip_hostgroup"]),
        (ENTITY_IPS_SWITCH, ["ips_switch"]),
        (ENTITY_IPS_POLICY, ["ips_policy"]),
        (ENTITY_WEBFILTER_POLICY, ["webfilterpolicy"]),
        (ENTITY_IPS_CUSTOM_SIGNATURE, ["ips_custom_signature"]),
        (ENTITY_TRUSTED_MAC, ["trusted_mac"]),
        (ENTITY_DOS_SETTINGS, ["dos_settings"]),
        (ENTITY_SPOOF_PREVENTION, ["spoof_prevention"]),
        (ENTITY_USER, ["user"]),
        (ENTITY_USER_GROUP, ["user_group"]),
        (ENTITY_ADMIN_PROFILE, ["admin_profile"]),
        (ENTITY_SCHEDULE, ["schedule"]),
        (ENTITY_ACCESS_TIME_POLICY, ["access_time_policy"]),
        (ENTITY_SURFING_QUOTA_POLICY, ["surfing_quota_policy"]),
        (ENTITY_DATA_TRANSFER_POLICY, ["data_transfer_policy"]),
        (ENTITY_DECRYPTION_PROFILE, ["decryption_profile"]),
        (ENTITY_VPN_PROFILE, ["vpn_profile"]),
        ("acl_rule", ["acl_rule"]),
        ("admin_authen", ["admin_authen"]),
        ("admin_settings", ["admin_settings"]),
        ("dns_forwarders", ["dns_forwarders"]),
        (ENTITY_DOS_BYPASS_RULE, ["dos_bypass_rule"]),
        (ENTITY_IPS_FULL_SIGNATURE_PACK, ["ips_full_signature_pack"]),
        ("firewall_rule", ["firewall_rule"]),
        (ENTITY_FIREWALL_RULE_GROUP, [ENTITY_FIREWALL_RULE_GROUP]),
        ("syslog_server", ["syslog_server"]),
        ("url_group", ["url_group"]),
        ("useractivity", ["useractivity"]),
        ("fqdn_host", ["fqdn_host"]),
        ("unknown_type_xyz", []),
    ],
)
def test_sync_catalog_ids_for_task_entity(entity, expected):
    assert tq.sync_catalog_ids_for_task_entity(entity) == expected


@pytest.mark.parametrize(
    "entity",
    [
        "acl_rule",
        "admin_authen",
        "admin_settings",
        "dns_forwarders",
        "firewall_rule",
        ENTITY_FIREWALL_RULE_GROUP,
        "syslog_server",
        "url_group",
        "useractivity",
        ENTITY_IPS_FULL_SIGNATURE_PACK,
        ENTITY_IPS_SWITCH,
        ENTITY_DOS_SETTINGS,
        ENTITY_SPOOF_PREVENTION,
    ],
)
def test_task_queue_supports_send_and_create_for_new_synced_entities(entity):
    assert tq._task_entity_supported_for_send(entity) is True
    assert tq._task_entity_supports_create(entity) is True


def test_firewall_rule_reorder_payload_first_rule_top():
    base = {"Name": "Rule A", "Position": "After", "After": {"Name": "Old"}, "Before": {"Name": "X"}}
    out = tq._firewall_rule_reorder_payload(base, after_rule_name=None)
    assert out["Position"] == "Top"
    assert "After" not in out
    assert "Before" not in out


def test_firewall_rule_reorder_payload_non_first_rule_after():
    base = {"Name": "Rule B", "Position": "Top"}
    out = tq._firewall_rule_reorder_payload(base, after_rule_name="Rule A")
    assert out["Position"] == "After"
    assert out["After"] == {"Name": "Rule A"}


def test_build_task_payload_diff_rows_no_stored():
    rows = tq.build_task_payload_diff_rows(None, '{"a":1}')
    assert len(rows) >= 1
    assert rows[0]["right_class"] == "ins"


def test_build_task_payload_diff_rows_empty_pending():
    rows = tq.build_task_payload_diff_rows(None, "")
    assert rows[-1]["left_class"] == "empty"


def test_build_task_payload_diff_rows_invalid_json_stored():
    rows = tq.build_task_payload_diff_rows("not-json", '{"a":1}')
    assert any(r.get("right_class") == "ins" for r in rows)


def test_build_task_payload_diff_rows_equal():
    j = '{"a":1}'
    rows = tq.build_task_payload_diff_rows(j, j)
    assert all(r["left_class"] == "eq" for r in rows)


def test_build_task_payload_diff_rows_replace():
    rows = tq.build_task_payload_diff_rows('{"a":1}', '{"b":2}')
    classes = {(r["left_class"], r["right_class"]) for r in rows}
    assert ("del", "ins") in classes or ("empty", "ins") in classes


def test_task_queue_badge_summary_empty(main_session):
    s = tq.task_queue_badge_summary(main_session)
    assert isinstance(s, dict)


def test_list_and_filter_sendable_empty(main_session):
    assert tq.list_sendable_task_ids(main_session) == []
    assert tq.filter_sendable_task_ids_in_order(main_session, [1, 2]) == []


def test_delete_tasks_empty(main_session):
    assert tq.delete_tasks(main_session, []) == 0


def test_task_queue_compare_missing(main_session):
    assert tq.task_queue_compare_payload(main_session, 99999) is None
    assert tq.completed_task_compare_payload(main_session, 99999) is None


def test_run_post_task_queue_syncs(monkeypatch, main_session, secrets_session):
    calls: list[tuple] = []

    def fake_sync(db, sdb, fw_id, *, entities, entities_explicit):
        calls.append((fw_id, tuple(entities), entities_explicit))
        return {"ok": True}

    monkeypatch.setattr(tq, "run_firewall_config_sync", fake_sync)
    out = tq.run_post_task_queue_syncs(
        main_session, secrets_session, {1: {"ip_host", "vlan"}, 2: set()}
    )
    assert len(out) == 1
    assert calls[0][0] == 1


def test_firewall_sync_run_details_invalid_uuid(main_session):
    assert tq.firewall_sync_run_details_payload(main_session, "not-a-uuid") is None


def test_firewall_changelog_compare_missing(main_session):
    assert tq.firewall_changelog_compare_payload(main_session, 99999) is None


def test_task_queue_history_summary_empty(main_session):
    assert isinstance(tq.task_queue_history_summary_counts(main_session, []), dict)


def test_list_tasks_with_firewall_empty(main_session):
    assert tq.list_tasks_with_firewall(main_session) == []


def test_list_tasks_with_firewall_includes_payloads_for_search(main_session):
    from app.models import Firewall, FirewallConfigEntry, TaskQueue

    fw = Firewall(host="fw.local", username="admin", port=4444, verify_ssl=False)
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=ENTITY_IP_HOST,
            external_name="HostA",
            payload_json='{"Name":"HostA","IPAddress":"10.0.0.1"}',
        )
    )
    main_session.add(
        TaskQueue(
            firewall_id=fw.id,
            entity_type=ENTITY_IP_HOST,
            external_name="HostA",
            status="pending",
            payload_json='{"Name":"HostA","IPAddress":"10.0.0.2"}',
            created_by_username="tester",
        )
    )
    main_session.commit()

    rows = tq.list_tasks_with_firewall(main_session)
    assert len(rows) == 1
    assert "10.0.0.1" in rows[0]["stored_payload_json"]
    assert "10.0.0.2" in rows[0]["pending_payload_json"]


def test_list_completed_tasks_empty(main_session):
    assert tq.list_completed_tasks_with_firewall(main_session) == []


def test_list_completed_tasks_search_blob_includes_original_and_new_values(main_session):
    from app.models import Firewall, FirewallConfigEntry, TaskQueueCompleted

    fw = Firewall(host="fw.local", username="admin", port=4444, verify_ssl=False)
    main_session.add(fw)
    main_session.flush()
    main_session.add(
        FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=ENTITY_IP_HOST,
            external_name="HostB",
            payload_json='{"Name":"HostB","IPAddress":"172.16.1.10"}',
        )
    )
    now = datetime.now(timezone.utc)
    main_session.add(
        TaskQueueCompleted(
            source_task_id=77,
            firewall_id=fw.id,
            entity_type=ENTITY_IP_HOST,
            external_name="HostB",
            payload_json='{"Name":"HostB","IPAddress":"172.16.1.22"}',
            created_at=now,
            completed_at=now,
            created_by_username="queued-user",
            completed_by_username="completed-user",
            outcome="sent",
        )
    )
    main_session.commit()

    rows = tq.list_completed_tasks_with_firewall(main_session)
    assert len(rows) == 1
    blob = rows[0]["search_blob"]
    assert "172.16.1.10" in blob
    assert "172.16.1.22" in blob


def test_list_completed_tasks_page_returns_has_more_and_offset_slice(main_session):
    from app.models import Firewall, TaskQueueCompleted

    existing = main_session.query(TaskQueueCompleted).count()
    fw = Firewall(host="fw.page.local", username="admin", port=4444, verify_ssl=False)
    main_session.add(fw)
    main_session.flush()
    now = datetime.now(timezone.utc)
    for idx in range(3):
        main_session.add(
            TaskQueueCompleted(
                source_task_id=100 + idx,
                firewall_id=fw.id,
                entity_type=ENTITY_IP_HOST,
                external_name=f"HostPage{idx}",
                payload_json=f'{{"Name":"HostPage{idx}"}}',
                created_at=now,
                completed_at=now,
                created_by_username="queued-user",
                completed_by_username="completed-user",
                outcome="sent",
            )
        )
    main_session.commit()

    rows1, has_more1 = tq.list_completed_tasks_with_firewall_page(
        main_session, limit=2, offset=0
    )
    assert len(rows1) == 2
    assert has_more1 is True

    total_rows = existing + 3
    remaining_after_offset = max(total_rows - 2, 0)
    expected_len_2 = min(2, remaining_after_offset)
    expected_has_more_2 = remaining_after_offset > 2
    rows2, has_more2 = tq.list_completed_tasks_with_firewall_page(
        main_session, limit=2, offset=2
    )
    assert len(rows2) == expected_len_2
    assert has_more2 is expected_has_more_2


def test_normalized_payload_helpers():
    d = tq._payload_dict_for_compare({"@x": 1, "y": 2})
    assert d == {"y": 2}
    assert isinstance(tq._normalized_payload_digest({"x": 1}), str)


def test_task_payload_matches_cache_false(main_session):
    from app.models import FirewallConfigEntry

    assert tq._task_payload_matches_cache(None, {"a": 1}) is False
    fake = FirewallConfigEntry(
        firewall_id=1,
        entity_type="x",
        external_name="n",
        payload_json="not json",
    )
    assert tq._task_payload_matches_cache(fake, {"a": 1}) is False


def test_submit_ip_host_add_uses_fw(monkeypatch):
    fw = MagicMock()
    fw.submit_xml.return_value = {"ok": True}
    tq._submit_ip_host_add(fw, {"Name": "h", "@x": 1, "Desc": None})
    assert fw.submit_xml.called


def test_submit_lag_add_bytes_decode(monkeypatch):
    fw = MagicMock()

    def fake_unparse(*a, **kw):
        return b"<LAG/>"

    monkeypatch.setattr(tq.xmltodict, "unparse", fake_unparse)
    tq._submit_lag_add(fw, {"Name": "L", "__gc_op": "add"})
    fw.submit_xml.assert_called_once()


def test_enqueue_ips_switch_update_bad_entry(main_session):
    with pytest.raises(ValueError, match="not found"):
        tq.enqueue_ips_switch_update(main_session, config_entry_id=99999, status="Enable")


def test_enqueue_dos_settings_update_no_cache(main_session):
    with pytest.raises(ValueError, match="DoS settings"):
        tq.enqueue_dos_settings_update(
            main_session,
            firewall_id=99999,
            settings_patch={},
            created_by_user_id=None,
        )
