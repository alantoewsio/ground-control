"""Sync writer captures on-device order for ordered entities.

Sophos GET responses for ``firewall_rule`` / ``nat_rule`` come back in the
firewall's actual evaluation order but intentionally omit the
``Position`` / ``After`` directives (they are write-only).  Without a
captured index the table builder would always render the rules in
``ORDER BY external_name``, which would make drag-to-reorder + send +
sync look like a no-op in the UI even when the firewall correctly moved
the rule on-device.

These tests pin the contract that ``_sync_entity_type`` injects
``@gc_sync_index`` into the cached payload exactly when the spec is
``ordered=True``, and that the registered ``firewall_rule`` / ``nat_rule``
specs carry that flag.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from app.firewall_config_sync import (
    ENTITY_FIREWALL_RULE,
    ENTITY_NAT_RULE,
    SYNC_INDEX_KEY,
    _SYNC_ENTITY_SPECS,
    _sync_entity_type,
)
from app.models import Firewall, FirewallConfigEntry, FirewallConfigSyncRun

from tests._ip_fixtures import ipv4


def _spec_by_id(entity_type: str):
    return next(s for s in _SYNC_ENTITY_SPECS if s.id == entity_type)


def test_firewall_rule_spec_marked_ordered():
    assert _spec_by_id(ENTITY_FIREWALL_RULE).ordered is True


def test_nat_rule_spec_marked_ordered():
    assert _spec_by_id(ENTITY_NAT_RULE).ordered is True


def _new_sync_run(db, fw_id: int) -> str:
    sid = str(uuid.uuid4())
    db.add(
        FirewallConfigSyncRun(
            id=sid,
            firewall_id=fw_id,
            started_at=datetime.now(timezone.utc),
            finished_at=None,
            status="running",
            error_message=None,
        )
    )
    db.commit()
    return sid


def test_sync_entity_type_injects_sync_index_when_ordered(main_session):
    """Each persisted item gets a 1-based ``@gc_sync_index`` matching API order."""
    db = main_session
    fw = Firewall(name="FW Ord", host=ipv4(10, 9, 9, 1), port=4444, username="u", verify_ssl=False)
    db.add(fw)
    db.commit()

    sync_id = _new_sync_run(db, fw.id)
    counts: dict[str, int] = {"added": 0, "changed": 0, "deleted": 0}
    _sync_entity_type(
        db,
        sync_run_id=sync_id,
        firewall_id=fw.id,
        entity_type=ENTITY_FIREWALL_RULE,
        name_keys=("Name",),
        singleton=False,
        name_fn=None,
        items=[
            {"Name": "Rule A", "Status": "Enable"},
            {"Name": "Rule B", "Status": "Enable"},
            {"Name": "Rule C", "Status": "Enable"},
        ],
        counts=counts,
        ordered=True,
    )
    db.commit()

    rows = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == fw.id,
            FirewallConfigEntry.entity_type == ENTITY_FIREWALL_RULE,
        )
        .all()
    )
    by_name = {r.external_name: json.loads(r.payload_json) for r in rows}
    assert by_name["Rule A"][SYNC_INDEX_KEY] == 1
    assert by_name["Rule B"][SYNC_INDEX_KEY] == 2
    assert by_name["Rule C"][SYNC_INDEX_KEY] == 3
    assert counts["added"] == 3


def test_sync_entity_type_does_not_inject_when_not_ordered(main_session):
    """Non-ordered entities (e.g. ip_host) must not gain a sync index."""
    db = main_session
    fw = Firewall(name="FW Plain", host=ipv4(10, 9, 9, 2), port=4444, username="u", verify_ssl=False)
    db.add(fw)
    db.commit()

    sync_id = _new_sync_run(db, fw.id)
    counts: dict[str, int] = {"added": 0, "changed": 0, "deleted": 0}
    _sync_entity_type(
        db,
        sync_run_id=sync_id,
        firewall_id=fw.id,
        entity_type="ip_host",
        name_keys=("Name",),
        singleton=False,
        name_fn=None,
        items=[
            {"Name": "host-a", "IPAddress": ipv4(10, 0, 0, 1)},
            {"Name": "host-b", "IPAddress": ipv4(10, 0, 0, 2)},
        ],
        counts=counts,
    )
    db.commit()

    rows = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == fw.id,
            FirewallConfigEntry.entity_type == "ip_host",
        )
        .all()
    )
    for r in rows:
        body = json.loads(r.payload_json)
        assert SYNC_INDEX_KEY not in body


def test_sync_entity_type_skips_index_for_unnamed_items_when_ordered(main_session):
    """Items dropped because they lack a name must not consume an index slot.

    The 1-based numbering should reflect what's actually persisted, not the
    raw input list, so that the displayed positions stay contiguous.
    """
    db = main_session
    fw = Firewall(name="FW Skip", host=ipv4(10, 9, 9, 3), port=4444, username="u", verify_ssl=False)
    db.add(fw)
    db.commit()

    sync_id = _new_sync_run(db, fw.id)
    counts: dict[str, int] = {"added": 0, "changed": 0, "deleted": 0}
    _sync_entity_type(
        db,
        sync_run_id=sync_id,
        firewall_id=fw.id,
        entity_type=ENTITY_FIREWALL_RULE,
        name_keys=("Name",),
        singleton=False,
        name_fn=None,
        items=[
            {"Name": "Rule A", "Status": "Enable"},
            {"Status": "Enable"},  # no Name → dropped
            {"Name": "Rule C", "Status": "Enable"},
        ],
        counts=counts,
        ordered=True,
    )
    db.commit()

    rows = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == fw.id,
            FirewallConfigEntry.entity_type == ENTITY_FIREWALL_RULE,
        )
        .all()
    )
    by_name = {r.external_name: json.loads(r.payload_json) for r in rows}
    assert by_name["Rule A"][SYNC_INDEX_KEY] == 1
    assert by_name["Rule C"][SYNC_INDEX_KEY] == 2
