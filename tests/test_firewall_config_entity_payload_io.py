"""Import/export for firewall_config_entity_payload_fields seed file."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.firewall_config_entity_payload_io import (
    export_firewall_config_entity_payload_fields_to_file,
    import_firewall_config_entity_payload_fields_from_file,
    maybe_import_firewall_config_entity_payload_fields_seed,
)
from app.models import FirewallConfigEntityPayloadField


@pytest.fixture(autouse=True)
def _clear_entity_payload_fields(main_session):
    main_session.query(FirewallConfigEntityPayloadField).delete()
    main_session.commit()
    yield


def test_export_and_import_roundtrip(main_session, tmp_path: Path) -> None:
    db = main_session
    db.add(
        FirewallConfigEntityPayloadField(
            entity_type="zone",
            property_name="Name",
            json_value_kind="string",
            dependent_on=None,
            data_entry_type=None,
            data_entry_properties=None,
        )
    )
    db.commit()
    p = tmp_path / "seed.json"
    export_firewall_config_entity_payload_fields_to_file(db, p)
    db.query(FirewallConfigEntityPayloadField).delete()
    db.commit()
    assert db.query(FirewallConfigEntityPayloadField).count() == 0
    n = import_firewall_config_entity_payload_fields_from_file(db, p)
    db.commit()
    assert n == 1
    row = db.query(FirewallConfigEntityPayloadField).one()
    assert row.entity_type == "zone"
    assert row.property_name == "Name"
    assert row.json_value_kind == "string"


def test_export_import_data_source_entity_types_roundtrip(
    main_session, tmp_path: Path,
) -> None:
    db = main_session
    db.add(
        FirewallConfigEntityPayloadField(
            entity_type="service",
            property_name="X",
            json_value_kind="string",
            data_source_entity_types='["ip_host","zone"]',
        )
    )
    db.commit()
    p = tmp_path / "seed_ds.json"
    export_firewall_config_entity_payload_fields_to_file(db, p)
    db.query(FirewallConfigEntityPayloadField).delete()
    db.commit()
    n = import_firewall_config_entity_payload_fields_from_file(db, p)
    db.commit()
    assert n == 1
    row = db.query(FirewallConfigEntityPayloadField).one()
    assert row.data_source_entity_types == '["ip_host","zone"]'


def test_export_import_allowed_options_roundtrip(main_session, tmp_path: Path) -> None:
    db = main_session
    db.add(
        FirewallConfigEntityPayloadField(
            entity_type="zone",
            property_name="Tier",
            json_value_kind="string",
            data_entry_type="selector",
            allowed_options='["gold","silver"]',
        )
    )
    db.commit()
    p = tmp_path / "seed2.json"
    export_firewall_config_entity_payload_fields_to_file(db, p)
    db.query(FirewallConfigEntityPayloadField).delete()
    db.commit()
    n = import_firewall_config_entity_payload_fields_from_file(db, p)
    db.commit()
    assert n == 1
    row = db.query(FirewallConfigEntityPayloadField).one()
    assert row.allowed_options == '["gold","silver"]'


def test_import_legacy_top_level_array(main_session, tmp_path: Path) -> None:
    db = main_session
    p = tmp_path / "legacy.json"
    p.write_text(
        json.dumps(
            [
                {
                    "entity_type": "vlan",
                    "property_name": "VID",
                    "json_value_kind": "integer",
                }
            ]
        ),
        encoding="utf-8",
    )
    n = import_firewall_config_entity_payload_fields_from_file(db, p)
    db.commit()
    assert n == 1
    assert db.query(FirewallConfigEntityPayloadField).one().property_name == "VID"


def test_maybe_import_seed_respects_under_pytest(main_session, monkeypatch, tmp_path: Path) -> None:
    db = main_session
    p = tmp_path / "seed.json"
    p.write_text(
        json.dumps(
            {
                "version": 1,
                "rows": [
                    {
                        "entity_type": "x",
                        "property_name": "Y",
                        "json_value_kind": "string",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("GROUND_CONTROL_UNDER_PYTEST", "1")
    maybe_import_firewall_config_entity_payload_fields_seed()
    assert db.query(FirewallConfigEntityPayloadField).count() == 0
    maybe_import_firewall_config_entity_payload_fields_seed(seed_path=p)
    db.commit()
    assert db.query(FirewallConfigEntityPayloadField).count() == 1


def test_maybe_import_skips_when_catalog_nonempty(main_session, tmp_path: Path) -> None:
    db = main_session
    db.add(
        FirewallConfigEntityPayloadField(
            entity_type="a",
            property_name="b",
            json_value_kind="string",
        )
    )
    db.commit()
    p = tmp_path / "seed.json"
    p.write_text(
        json.dumps(
            {
                "version": 1,
                "rows": [
                    {
                        "entity_type": "z",
                        "property_name": "Z",
                        "json_value_kind": "string",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    maybe_import_firewall_config_entity_payload_fields_seed(seed_path=p)
    db.commit()
    assert db.query(FirewallConfigEntityPayloadField).count() == 1
    assert (
        db.query(FirewallConfigEntityPayloadField)
        .filter(FirewallConfigEntityPayloadField.entity_type == "z")
        .count()
        == 0
    )
