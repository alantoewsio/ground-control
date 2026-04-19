"""Generic rule reorder helper covers firewall_rule + nat_rule.

The reorder helper translates a desired display order into a chain of
``Position=After`` (or ``Position=Top``) edits.  The same shape applies to
both ``<FirewallRule>`` and ``<NATRule>`` per the matching XML docs.
"""

from __future__ import annotations

import json

import pytest

from app.firewall_config_sync import ENTITY_FIREWALL_RULE, ENTITY_NAT_RULE
from app.models import Firewall, FirewallConfigEntry
from app.task_queue_service import (
    enqueue_firewall_rule_reorder_batch,
    enqueue_nat_rule_reorder_batch,
    enqueue_rule_reorder_batch,
)

from tests._ip_fixtures import ipv4


def _seed_rules(session, *, entity_type, rule_names, with_sync_index=False, host=ipv4(10, 5, 0, 1)):
    """Seed N rules. When ``with_sync_index`` is true, stamp each cached
    payload with ``@gc_sync_index`` (1..N) the same way ``_sync_entity_type``
    would on a fresh sync — required to exercise the minimal-set diff."""
    fw = Firewall(name=f"FW R {host}", host=host, port=4444, username="admin", verify_ssl=False)
    session.add(fw)
    session.flush()
    entries = []
    for idx, name in enumerate(rule_names, start=1):
        payload = {"Name": name, "Status": "Enable"}
        if with_sync_index:
            payload["@gc_sync_index"] = idx
        ent = FirewallConfigEntry(
            firewall_id=fw.id,
            entity_type=entity_type,
            external_name=name,
            payload_json=json.dumps(payload),
        )
        session.add(ent)
        entries.append(ent)
    session.commit()
    return fw, entries


def test_enqueue_rule_reorder_batch_chains_after_for_nat_rule(main_session):
    fw, entries = _seed_rules(
        main_session, entity_type=ENTITY_NAT_RULE, rule_names=["A", "B", "C"]
    )
    desired = [entries[2].id, entries[0].id, entries[1].id]

    tasks = enqueue_rule_reorder_batch(
        main_session,
        firewall_id=fw.id,
        entity_type=ENTITY_NAT_RULE,
        ordered_config_entry_ids=desired,
    )

    assert len(tasks) == 3
    assert all(t.entity_type == ENTITY_NAT_RULE for t in tasks)
    assert [t.external_name for t in tasks] == ["C", "A", "B"]

    payload_c = json.loads(tasks[0].payload_json)
    assert payload_c["Position"] == "Top"
    assert "After" not in payload_c

    payload_a = json.loads(tasks[1].payload_json)
    assert payload_a["Position"] == "After"
    assert payload_a["After"] == {"Name": "C"}

    payload_b = json.loads(tasks[2].payload_json)
    assert payload_b["After"] == {"Name": "A"}


def test_enqueue_firewall_rule_reorder_batch_back_compat_wrapper(main_session):
    fw, entries = _seed_rules(
        main_session, entity_type=ENTITY_FIREWALL_RULE, rule_names=["FwA", "FwB"]
    )
    tasks = enqueue_firewall_rule_reorder_batch(
        main_session,
        firewall_id=fw.id,
        ordered_config_entry_ids=[entries[1].id, entries[0].id],
    )
    assert [t.entity_type for t in tasks] == [ENTITY_FIREWALL_RULE, ENTITY_FIREWALL_RULE]
    assert [t.external_name for t in tasks] == ["FwB", "FwA"]


def test_enqueue_nat_rule_reorder_batch_thin_wrapper(main_session):
    fw, entries = _seed_rules(
        main_session, entity_type=ENTITY_NAT_RULE, rule_names=["NA", "NB"]
    )
    tasks = enqueue_nat_rule_reorder_batch(
        main_session,
        firewall_id=fw.id,
        ordered_config_entry_ids=[entries[0].id, entries[1].id],
    )
    assert all(t.entity_type == ENTITY_NAT_RULE for t in tasks)


def test_enqueue_rule_reorder_batch_rejects_unknown_entity_type(main_session):
    with pytest.raises(ValueError, match="rule reorder"):
        enqueue_rule_reorder_batch(
            main_session,
            firewall_id=1,
            entity_type="ip_host",
            ordered_config_entry_ids=[1, 2],
        )


def test_enqueue_rule_reorder_batch_rejects_unknown_firewall(main_session):
    with pytest.raises(ValueError, match="Firewall not found"):
        enqueue_rule_reorder_batch(
            main_session,
            firewall_id=99999,
            entity_type=ENTITY_NAT_RULE,
            ordered_config_entry_ids=[1],
        )


def test_enqueue_rule_reorder_batch_rejects_empty_id_list(main_session):
    fw, _ = _seed_rules(
        main_session, entity_type=ENTITY_NAT_RULE, rule_names=["X"]
    )
    with pytest.raises(ValueError, match="No rule entries"):
        enqueue_rule_reorder_batch(
            main_session,
            firewall_id=fw.id,
            entity_type=ENTITY_NAT_RULE,
            ordered_config_entry_ids=[],
        )


def test_enqueue_rule_reorder_batch_skips_when_payload_unchanged(main_session):
    """Position=Top + no After matches the cached payload of a top-of-chain rule.

    The first rule in the desired order may already be ``Position=Top`` on the
    firewall (cache); when so, the helper deliberately skips the no-op task.
    """
    fw = Firewall(
        name="FW Skip", host=ipv4(10, 5, 0, 2), port=4444, username="admin", verify_ssl=False
    )
    main_session.add(fw)
    main_session.flush()

    payload_already_top = {"Name": "Top", "Status": "Enable", "Position": "Top"}
    ent = FirewallConfigEntry(
        firewall_id=fw.id,
        entity_type=ENTITY_NAT_RULE,
        external_name="Top",
        payload_json=json.dumps(payload_already_top),
    )
    main_session.add(ent)
    main_session.commit()

    tasks = enqueue_rule_reorder_batch(
        main_session,
        firewall_id=fw.id,
        entity_type=ENTITY_NAT_RULE,
        ordered_config_entry_ids=[ent.id],
    )
    assert tasks == []


def test_enqueue_rule_reorder_batch_rejects_id_from_other_firewall(main_session):
    fw_a = Firewall(name="FW A", host=ipv4(10, 5, 0, 3), port=4444, username="admin", verify_ssl=False)
    fw_b = Firewall(name="FW B", host=ipv4(10, 5, 0, 4), port=4444, username="admin", verify_ssl=False)
    main_session.add_all([fw_a, fw_b])
    main_session.flush()
    ent_b = FirewallConfigEntry(
        firewall_id=fw_b.id,
        entity_type=ENTITY_NAT_RULE,
        external_name="X",
        payload_json=json.dumps({"Name": "X"}),
    )
    main_session.add(ent_b)
    main_session.commit()

    with pytest.raises(ValueError, match="not found for this firewall"):
        enqueue_rule_reorder_batch(
            main_session,
            firewall_id=fw_a.id,
            entity_type=ENTITY_NAT_RULE,
            ordered_config_entry_ids=[ent_b.id],
        )


# --- After-name-diff tests ----------------------------------------------
#
# Sophos persists ``Position`` / ``After.Name`` as real per-rule fields
# (verified against the firewall-config-viewer reference project, where
# ``useEditorState.js::normalizeRuleOrder`` rewrites every rule's
# ``Position``/``AfterName`` after any reorder).  The firewall does NOT
# implicitly shift neighbours when one rule is repositioned, so the correct
# task set is "every rule whose stored ``After.Name`` differs from what we'd
# need it to be in the new order".


def test_single_drag_emits_task_per_rule_whose_after_name_changed(main_session):
    """User drags X from #4 to #2 in [A,B,C,X,F].

    On-device After.Names before:   A=Top, B=A, C=B, X=C, F=X.
    On-device After.Names required: A=Top, X=A, B=X, C=B, F=C.

    Differences: X (C→A), B (A→X), F (X→C).  C is unchanged (still
    After=B).  So exactly three tasks should be enqueued — and that is the
    correct count, because Sophos does not auto-shift neighbours; each
    rule's stored ``After.Name`` must be made consistent with the new
    order or the next sync re-derives the original chain.
    """
    fw, entries = _seed_rules(
        main_session,
        entity_type=ENTITY_FIREWALL_RULE,
        rule_names=["A", "B", "C", "X", "F"],
        with_sync_index=True,
        host=ipv4(10, 5, 0, 10),
    )
    by_name = {e.external_name: e for e in entries}
    new_order = [
        by_name["A"].id,
        by_name["X"].id,
        by_name["B"].id,
        by_name["C"].id,
        by_name["F"].id,
    ]

    tasks = enqueue_rule_reorder_batch(
        main_session,
        firewall_id=fw.id,
        entity_type=ENTITY_FIREWALL_RULE,
        ordered_config_entry_ids=new_order,
    )
    by_task_name = {t.external_name: json.loads(t.payload_json) for t in tasks}
    assert set(by_task_name) == {"X", "B", "F"}
    assert by_task_name["X"]["Position"] == "After"
    assert by_task_name["X"]["After"] == {"Name": "A"}
    assert by_task_name["B"]["After"] == {"Name": "X"}
    assert by_task_name["F"]["After"] == {"Name": "C"}


def test_drag_to_top_promotes_rule_with_position_top(main_session):
    """Moving a rule to slot 1 sets ``Position=Top`` and pushes everyone
    affected onto a new ``After.Name``."""
    fw, entries = _seed_rules(
        main_session,
        entity_type=ENTITY_FIREWALL_RULE,
        rule_names=["A", "B", "X", "C"],
        with_sync_index=True,
        host=ipv4(10, 5, 0, 17),
    )
    by_name = {e.external_name: e for e in entries}
    new_order = [by_name["X"].id, by_name["A"].id, by_name["B"].id, by_name["C"].id]

    tasks = enqueue_rule_reorder_batch(
        main_session,
        firewall_id=fw.id,
        entity_type=ENTITY_FIREWALL_RULE,
        ordered_config_entry_ids=new_order,
    )
    by_task_name = {t.external_name: json.loads(t.payload_json) for t in tasks}
    # X was After=B → now Top.  A was Top → now After=X.  B unchanged
    # (After=A both before and after).  C was After=X → now After=B.
    assert set(by_task_name) == {"X", "A", "C"}
    assert by_task_name["X"]["Position"] == "Top"
    assert "After" not in by_task_name["X"]
    assert by_task_name["A"]["Position"] == "After"
    assert by_task_name["A"]["After"] == {"Name": "X"}
    assert by_task_name["C"]["After"] == {"Name": "B"}


def test_dirty_ids_field_is_accepted_but_does_not_narrow_results(main_session):
    """``dirty_config_entry_ids`` is accepted for forward-compat with older
    client builds but must NOT filter the resulting task set — narrowing
    would leave un-flagged rules with stale ``After.Name`` pointers on the
    firewall, causing the move to silently revert on the next sync."""
    fw, entries = _seed_rules(
        main_session,
        entity_type=ENTITY_FIREWALL_RULE,
        rule_names=["A", "B", "C", "X", "F"],
        with_sync_index=True,
        host=ipv4(10, 5, 0, 18),
    )
    by_name = {e.external_name: e for e in entries}
    new_order = [
        by_name["A"].id,
        by_name["X"].id,
        by_name["B"].id,
        by_name["C"].id,
        by_name["F"].id,
    ]

    tasks = enqueue_rule_reorder_batch(
        main_session,
        firewall_id=fw.id,
        entity_type=ENTITY_FIREWALL_RULE,
        ordered_config_entry_ids=new_order,
        dirty_config_entry_ids=[by_name["X"].id],
    )
    # Same three tasks as the no-dirty case — narrowing is intentionally
    # ignored to avoid stale-pointer corruption on the firewall.
    assert {t.external_name for t in tasks} == {"X", "B", "F"}


def test_drop_back_to_original_slot_emits_no_tasks(main_session):
    """If the user drags a rule but ends up with the same on-device order,
    every rule's required ``After.Name`` already matches what's stored, so
    we correctly emit zero tasks."""
    fw, entries = _seed_rules(
        main_session,
        entity_type=ENTITY_NAT_RULE,
        rule_names=["A", "B", "C"],
        with_sync_index=True,
        host=ipv4(10, 5, 0, 11),
    )
    same_order = [entries[0].id, entries[1].id, entries[2].id]

    tasks = enqueue_rule_reorder_batch(
        main_session,
        firewall_id=fw.id,
        entity_type=ENTITY_NAT_RULE,
        ordered_config_entry_ids=same_order,
    )
    assert tasks == []


def test_no_sync_index_falls_back_to_full_chain(main_session):
    """Caches predating ``@gc_sync_index`` injection: the safe fallback is
    to emit a task for every rule (we cannot prove what's currently stored
    on-device, so the conservative move is to assert the full new order)."""
    fw, entries = _seed_rules(
        main_session,
        entity_type=ENTITY_NAT_RULE,
        rule_names=["P", "Q", "R"],
        with_sync_index=False,
        host=ipv4(10, 5, 0, 13),
    )
    new_order = [entries[2].id, entries[0].id, entries[1].id]

    tasks = enqueue_rule_reorder_batch(
        main_session,
        firewall_id=fw.id,
        entity_type=ENTITY_NAT_RULE,
        ordered_config_entry_ids=new_order,
    )
    assert [t.external_name for t in tasks] == ["R", "P", "Q"]


def test_zero_or_missing_sync_index_disables_old_order_diff(main_session):
    """If even one rule in the batch lacks a usable ``@gc_sync_index``, we
    cannot prove the on-device After.Name for any rule, so the safe
    fallback is to emit a task for every rule."""
    fw = Firewall(name="FW MIX", host=ipv4(10, 5, 0, 15), port=4444, username="admin", verify_ssl=False)
    main_session.add(fw)
    main_session.flush()
    e_with = FirewallConfigEntry(
        firewall_id=fw.id,
        entity_type=ENTITY_NAT_RULE,
        external_name="HasIdx",
        payload_json=json.dumps({"Name": "HasIdx", "@gc_sync_index": 1}),
    )
    e_no = FirewallConfigEntry(
        firewall_id=fw.id,
        entity_type=ENTITY_NAT_RULE,
        external_name="NoIdx",
        payload_json=json.dumps({"Name": "NoIdx"}),
    )
    main_session.add_all([e_with, e_no])
    main_session.commit()

    tasks = enqueue_rule_reorder_batch(
        main_session,
        firewall_id=fw.id,
        entity_type=ENTITY_NAT_RULE,
        ordered_config_entry_ids=[e_with.id, e_no.id],
    )
    # Both should be enqueued (no After-diff possible without complete index).
    assert {t.external_name for t in tasks} == {"HasIdx", "NoIdx"}
