"""``member_firewall_ids_json`` canonical form (tags + explicit firewall ids)."""

from __future__ import annotations

import json

from app.main import _canonical_member_firewall_ids_json
from app.models import Firewall


def test_canonical_member_json_dedupes_tags_and_filters_missing_fw(main_session):
    db = main_session
    fw = Firewall(host="h1", username="u")
    db.add(fw)
    db.commit()
    db.refresh(fw)

    raw = json.dumps(
        {"tags": ["  Z ", "z", "a"], "firewall_ids": [fw.id, 999, fw.id]}
    )
    out = json.loads(_canonical_member_firewall_ids_json(raw, db=db))
    assert out["tags"] == ["a", "Z"]
    assert out["firewall_ids"] == [fw.id]


def test_canonical_member_legacy_array_becomes_object(main_session):
    db = main_session
    fw = Firewall(host="h2", username="u")
    db.add(fw)
    db.commit()
    db.refresh(fw)

    out = json.loads(
        _canonical_member_firewall_ids_json(json.dumps([fw.id, 0]), db=db)
    )
    assert out["tags"] == []
    assert out["firewall_ids"] == [fw.id]
