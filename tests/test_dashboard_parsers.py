"""Tests for small parsers in ``app.dashboard_metrics``."""

from __future__ import annotations

from app.dashboard_metrics import parse_chart_timezone, parse_firewall_ids_query


def test_parse_firewall_ids_query():
    assert parse_firewall_ids_query(None) == []
    assert parse_firewall_ids_query("") == []
    assert parse_firewall_ids_query("3,1,2,x,-1") == [1, 2, 3]


def test_parse_chart_timezone():
    z, label = parse_chart_timezone(None)
    assert z is None and label == "UTC"
    z2, label2 = parse_chart_timezone("Europe/Berlin")
    assert z2 is not None and label2 == "Europe/Berlin"
    z3, label3 = parse_chart_timezone("Not/A/Real/Zone/Name/Here/Invalid")
    assert z3 is None and label3 == "UTC"
    z4, _ = parse_chart_timezone("x" * 200)
    assert z4 is None
