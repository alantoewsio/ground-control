"""Tests for ``app.models`` helpers."""

from __future__ import annotations

import json

from app.models import Configuration, Firewall


def test_firewall_tags_list_variants():
    fw = Firewall(
        host="h",
        username="u",
        tags_json="[]",
    )
    assert fw.tags_list() == []
    fw.tags_json = "not-json"
    assert fw.tags_list() == []
    fw.tags_json = json.dumps({})
    assert fw.tags_list() == []
    fw.tags_json = json.dumps([" a ", "", "b", {"name": " c "}, {"n": " d "}])
    out = fw.tags_list()
    assert "a" in out and "b" in out and "c" in out and "d" in out
    assert fw.tags_sorted() == sorted(out, key=str.casefold)


def test_configuration_tags_list():
    c = Configuration(tags_json=json.dumps(["z", "a"]))
    assert c.tags_list() == ["z", "a"]


def test_configuration_member_firewall_ids_list():
    c = Configuration(member_firewall_ids_json='[3, 1, 1, 99, 0, "x", null]')
    assert c.member_firewall_ids_list() == [1, 3, 99]
    assert c.member_assignment_tags_and_firewall_ids() == ([], [1, 3, 99])
    c.member_firewall_ids_json = "not-json"
    assert c.member_firewall_ids_list() == []


def test_configuration_member_assignment_object_and_effective():
    c = Configuration(
        member_firewall_ids_json='{"tags":["east","West"],"firewall_ids":[2]}'
    )
    tags, ids = c.member_assignment_tags_and_firewall_ids()
    assert tags == ["east", "West"]
    assert ids == [2]

    f1 = Firewall(host="a", username="u", tags_json=json.dumps(["East"]))
    f1.id = 1
    f2 = Firewall(host="b", username="u", tags_json="[]")
    f2.id = 2
    f3 = Firewall(host="c", username="u", tags_json=json.dumps(["other"]))
    f3.id = 3
    firewalls = [f1, f2, f3]

    eff = c.effective_member_firewall_ids(firewalls)
    assert eff == [1, 2]
