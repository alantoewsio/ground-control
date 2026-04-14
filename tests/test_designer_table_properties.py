"""Designer table properties file + API."""

import json

import pytest

from app.designer_table_properties import (
    get_instance_props,
    merge_with_defaults,
    normalize_instance_props,
    save_instance_props,
)


def test_normalize_instance_props_defaults() -> None:
    n = normalize_instance_props({})
    assert n["title"] == "Preview table"
    assert n["entity_types"] == []
    assert n["secondary_filters"] == []
    assert n["opt_combine_view"] is True
    assert n["combine_by_column"] == ""
    assert n["opt_row_selectors"] is True
    assert n["opt_add_btn"] is True
    assert n["opt_delete_btn"] is True
    assert n["opt_read_only"] is False


def test_normalize_combine_by_column() -> None:
    assert normalize_instance_props({"combine_by_column": "Description"})["combine_by_column"] == "Description"
    assert normalize_instance_props({"combine_by_column": "__name"})["combine_by_column"] == ""
    assert normalize_instance_props({"combine_by_column": "bad;id"})["combine_by_column"] == ""


def test_merge_with_defaults() -> None:
    m = merge_with_defaults({"title": "T", "entity_types": ["zone"]})
    assert m["title"] == "T"
    assert m["entity_types"] == ["zone"]


def test_save_and_get_roundtrip(tmp_path, monkeypatch) -> None:
    from app import designer_table_properties as dtp

    monkeypatch.setattr(dtp, "properties_file_path", lambda: tmp_path / "designer_table_properties.json")
    save_instance_props(
        "sandbox_table",
        {
            "title": "My grid",
            "entity_types": ["ip_host"],
            "column_order": "a, b",
        },
    )
    got = get_instance_props("sandbox_table")
    assert got["title"] == "My grid"
    assert got["entity_types"] == ["ip_host"]
    assert got["column_order"] == "a, b"
    raw = json.loads((tmp_path / "designer_table_properties.json").read_text(encoding="utf-8"))
    assert "sandbox_table" in raw["instances"]
    assert "per_user" not in raw


def test_legacy_per_user_read_and_save_migrates(tmp_path, monkeypatch) -> None:
    from app import designer_table_properties as dtp

    p = tmp_path / "designer_table_properties.json"
    monkeypatch.setattr(dtp, "properties_file_path", lambda: p)
    p.write_text(
        json.dumps(
            {
                "version": 1,
                "instances": {},
                "per_user": {
                    "u1": {
                        "instances": {
                            "shared": {"title": "From per_user", "entity_types": ["zone"]},
                        }
                    }
                },
            }
        ),
        encoding="utf-8",
    )
    assert get_instance_props("shared")["title"] == "From per_user"
    save_instance_props("shared", {"title": "Now shared", "entity_types": ["ip_host"]})
    assert get_instance_props("shared")["title"] == "Now shared"
    raw = json.loads(p.read_text(encoding="utf-8"))
    assert "per_user" not in raw
    assert raw["instances"]["shared"]["title"] == "Now shared"


def test_api_designer_table_properties_forbidden(authed_client, secrets_session) -> None:
    from app.secrets_models import DEFAULT_ADMIN_USERNAME, AppUser

    row = secrets_session.query(AppUser).filter_by(username=DEFAULT_ADMIN_USERNAME).one()
    row.role = "admin"
    secrets_session.commit()
    r = authed_client.get("/api/designer/table-properties/gc-designer-tables")
    assert r.status_code == 403


def test_api_designer_table_properties_get_put(designer_client, tmp_path, monkeypatch) -> None:
    from app import designer_table_properties as dtp

    monkeypatch.setattr(dtp, "properties_file_path", lambda: tmp_path / "designer_table_properties.json")

    r = designer_client.get("/api/designer/table-properties/gc-designer-tables")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["properties"]["title"] == "Preview table"

    r2 = designer_client.put(
        "/api/designer/table-properties/gc-designer-tables",
        json={"title": "Committed title", "entity_types": ["vlan"]},
    )
    assert r2.status_code == 200
    assert r2.json()["properties"]["title"] == "Committed title"

    r3 = designer_client.get("/api/designer/table-properties/gc-designer-tables")
    assert r3.json()["properties"]["title"] == "Committed title"
    assert r3.json()["properties"]["entity_types"] == ["vlan"]

    raw = json.loads((tmp_path / "designer_table_properties.json").read_text(encoding="utf-8"))
    assert raw["instances"]["gc-designer-tables"]["title"] == "Committed title"
    assert "per_user" not in raw


def test_api_designer_table_properties_invalid_instance_id(designer_client) -> None:
    r = designer_client.get("/api/designer/table-properties/99bad")
    assert r.status_code == 400
