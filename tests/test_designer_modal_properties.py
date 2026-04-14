"""Designer modal flyout title properties file + API."""

import json

import pytest

from app.designer_modal_properties import (
    get_modal_props,
    normalize_modal_props,
    save_modal_props,
)


def test_normalize_modal_props_defaults() -> None:
    n = normalize_modal_props({})
    assert n["view_flyout_title"] == ""
    assert n["edit_flyout_title"] == ""
    assert n["object_edit_flyout_title"] == ""
    assert n["object_edit_entity_type"] == ""


def test_normalize_modal_props_strips() -> None:
    n = normalize_modal_props(
        {
            "view_flyout_title": "  x  ",
            "edit_flyout_title": "y",
            "object_edit_entity_type": "  ip_host  ",
        }
    )
    assert n["view_flyout_title"] == "x"
    assert n["edit_flyout_title"] == "y"
    assert n["object_edit_entity_type"] == "ip_host"


def test_save_and_get_roundtrip(tmp_path, monkeypatch) -> None:
    from app import designer_modal_properties as dmp

    monkeypatch.setattr(dmp, "properties_file_path", lambda: tmp_path / "designer_modal_properties.json")
    save_modal_props({"view_flyout_title": "Host", "edit_flyout_title": "Service"})
    got = get_modal_props()
    assert got["view_flyout_title"] == "Host"
    assert got["edit_flyout_title"] == "Service"
    raw = json.loads((tmp_path / "designer_modal_properties.json").read_text(encoding="utf-8"))
    assert raw["view_flyout_title"] == "Host"


def test_api_designer_modal_properties_forbidden(authed_client) -> None:
    r = authed_client.get("/api/designer/modal-properties")
    assert r.status_code == 403


def test_api_designer_modal_properties_get_put(designer_client, tmp_path, monkeypatch) -> None:
    from app import designer_modal_properties as dmp

    monkeypatch.setattr(dmp, "properties_file_path", lambda: tmp_path / "designer_modal_properties.json")

    r = designer_client.get("/api/designer/modal-properties")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["properties"]["view_flyout_title"] == ""
    assert body["properties"]["edit_flyout_title"] == ""
    assert body["properties"]["object_edit_flyout_title"] == ""
    assert body["properties"]["object_edit_entity_type"] == ""

    r2 = designer_client.put(
        "/api/designer/modal-properties",
        json={
            "view_flyout_title": " VLAN ",
            "edit_flyout_title": "Zone",
            "object_edit_flyout_title": " Row ",
            "object_edit_entity_type": "service_group",
        },
    )
    assert r2.status_code == 200
    p = r2.json()["properties"]
    assert p["view_flyout_title"] == "VLAN"
    assert p["edit_flyout_title"] == "Zone"
    assert p["object_edit_flyout_title"] == "Row"
    assert p["object_edit_entity_type"] == "service_group"

    r3 = designer_client.get("/api/designer/modal-properties")
    assert r3.json()["properties"]["view_flyout_title"] == "VLAN"
    assert r3.json()["properties"]["object_edit_entity_type"] == "service_group"
