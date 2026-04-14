"""Catalog of payload_json top-level keys per entity_type during firewall config sync."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from app.firewall_config_entity_payload_catalog import (
    apply_inferred_data_entry_types_where_unset,
    infer_default_data_entry_type_for_property,
    json_value_kind,
    record_entity_payload_field_rows,
)
from app.firewall_config_sync import ENTITY_NETFLOW_CONFIGURATION, _sync_entity_type
from app.models import (
    Firewall,
    FirewallConfigEntityPayloadField,
    FirewallConfigEntry,
    FirewallConfigSyncRun,
)


def test_infer_default_data_entry_type_for_property() -> None:
    assert infer_default_data_entry_type_for_property("Name") == "text-single"
    assert infer_default_data_entry_type_for_property("name") == "text-single"
    assert infer_default_data_entry_type_for_property("Zone.DisplayName") == "text-single"
    assert infer_default_data_entry_type_for_property("host_name") == "text-single"
    assert infer_default_data_entry_type_for_property("Description") == "text-multiline"
    assert infer_default_data_entry_type_for_property("description") == "text-multiline"
    assert infer_default_data_entry_type_for_property("X.Description") == "text-multiline"
    assert infer_default_data_entry_type_for_property("long_description") == "text-multiline"
    assert infer_default_data_entry_type_for_property("TransactionId") == "Hidden"
    assert infer_default_data_entry_type_for_property("transactionId") == "Hidden"
    assert infer_default_data_entry_type_for_property("@transactionid") == "Hidden"
    assert infer_default_data_entry_type_for_property("Scope.TransactionId") == "Hidden"
    assert infer_default_data_entry_type_for_property("x_transaction_id") == "Hidden"
    assert infer_default_data_entry_type_for_property("transaction_id") == "Hidden"
    assert infer_default_data_entry_type_for_property("Alpha") is None
    assert infer_default_data_entry_type_for_property("X") is None


def test_apply_inferred_data_entry_types_treats_blank_as_unset(main_session) -> None:
    et = "blank_det_t"
    main_session.query(FirewallConfigEntityPayloadField).filter(
        FirewallConfigEntityPayloadField.entity_type == et
    ).delete(synchronize_session=False)
    main_session.add_all(
        [
            FirewallConfigEntityPayloadField(
                entity_type=et,
                property_name="Name",
                json_value_kind="string",
                data_entry_type="",
            ),
            FirewallConfigEntityPayloadField(
                entity_type=et,
                property_name="Description",
                json_value_kind="string",
                data_entry_type="  ",
            ),
            FirewallConfigEntityPayloadField(
                entity_type=et,
                property_name="@transactionid",
                json_value_kind="string",
                data_entry_type=None,
            ),
            FirewallConfigEntityPayloadField(
                entity_type=et,
                property_name="Kept",
                json_value_kind="string",
                data_entry_type="selector",
            ),
        ]
    )
    main_session.commit()
    n = apply_inferred_data_entry_types_where_unset(main_session)
    main_session.commit()
    assert n >= 3
    rows = (
        main_session.query(FirewallConfigEntityPayloadField)
        .filter(FirewallConfigEntityPayloadField.entity_type == et)
        .all()
    )
    by_p = {r.property_name: r.data_entry_type for r in rows}
    assert by_p["Name"] == "text-single"
    assert by_p["Description"] == "text-multiline"
    assert by_p["@transactionid"] == "Hidden"
    assert by_p["Kept"] == "selector"


def test_json_value_kind_primitives() -> None:
    assert json_value_kind(None) == "null"
    assert json_value_kind(True) == "boolean"
    assert json_value_kind(1) == "integer"
    assert json_value_kind(1.5) == "number"
    assert json_value_kind("x") == "string"
    assert json_value_kind({}) == "object"
    assert json_value_kind([]) == "array"


def test_record_entity_payload_field_rows_inserts_catalog_rows(main_session) -> None:
    db = main_session
    et = "zone_cat_ins_t"
    record_entity_payload_field_rows(
        db,
        et,
        {"Name": "LAN", "Type": "NETWORK", "N": 1, "Description": "d", "LongDescription": "x"},
    )
    db.commit()
    rows = (
        db.query(FirewallConfigEntityPayloadField)
        .filter(FirewallConfigEntityPayloadField.entity_type == et)
        .order_by(FirewallConfigEntityPayloadField.property_name)
        .all()
    )
    by_prop = {r.property_name: r.json_value_kind for r in rows}
    assert by_prop == {
        "Description": "string",
        "LongDescription": "string",
        "N": "integer",
        "Name": "string",
        "Type": "string",
    }
    assert all(r.dependent_on is None for r in rows)
    by_det = {r.property_name: r.data_entry_type for r in rows}
    assert by_det["Name"] == "text-single"
    assert by_det["Description"] == "text-multiline"
    assert by_det["LongDescription"] == "text-multiline"
    assert by_det.get("Type") is None
    assert by_det.get("N") is None
    assert all(r.data_entry_properties is None for r in rows)
    by_order = {r.property_name: r.display_order for r in rows}
    assert by_order == {
        "Name": 1,
        "Type": 2,
        "N": 3,
        "Description": 4,
        "LongDescription": 5,
    }


def test_record_entity_payload_field_rows_mixed_kind(main_session) -> None:
    db = main_session
    record_entity_payload_field_rows(db, "t", {"X": "a"})
    db.commit()
    record_entity_payload_field_rows(db, "t", {"X": 1})
    db.commit()
    row = (
        db.query(FirewallConfigEntityPayloadField)
        .filter(
            FirewallConfigEntityPayloadField.entity_type == "t",
            FirewallConfigEntityPayloadField.property_name == "X",
        )
        .one()
    )
    assert row.json_value_kind == "mixed"


def test_sync_entity_type_updates_payload_field_catalog(main_session) -> None:
    db = main_session
    fw = Firewall(name="Cat", host="10.0.0.1", port=4444, username="u", verify_ssl=False)
    db.add(fw)
    db.commit()

    sync_id = str(uuid.uuid4())
    t0 = datetime.now(timezone.utc)
    db.add(
        FirewallConfigSyncRun(
            id=sync_id,
            firewall_id=fw.id,
            started_at=t0,
            finished_at=None,
            status="running",
            error_message=None,
        )
    )
    db.commit()

    counts: dict[str, int] = {"added": 0, "changed": 0, "deleted": 0}
    _sync_entity_type(
        db,
        sync_run_id=sync_id,
        firewall_id=fw.id,
        entity_type=ENTITY_NETFLOW_CONFIGURATION,
        name_keys=(),
        singleton=True,
        name_fn=None,
        items=[{"Server": []}],
        counts=counts,
    )
    db.commit()

    cat = (
        db.query(FirewallConfigEntityPayloadField)
        .filter(
            FirewallConfigEntityPayloadField.entity_type == ENTITY_NETFLOW_CONFIGURATION,
            FirewallConfigEntityPayloadField.property_name == "Server",
        )
        .one_or_none()
    )
    assert cat is not None
    assert cat.json_value_kind == "array"

    row = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.firewall_id == fw.id,
            FirewallConfigEntry.entity_type == ENTITY_NETFLOW_CONFIGURATION,
        )
        .one()
    )
    assert json.loads(row.payload_json).get("Server") == []
