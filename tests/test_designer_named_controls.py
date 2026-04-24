"""Designer catalog / control id metadata."""

from app.designer_named_controls import (
    CATALOG_DATA_ENTRY_TYPE_ALLOWLIST,
    DESIGNER_NAMED_CONTROL_IDS,
    catalog_data_entry_type_dropdown_values,
)


def test_data_entry_table_in_named_controls() -> None:
    assert "data-entry-table" in DESIGNER_NAMED_CONTROL_IDS


def test_data_entry_table_column_types_in_catalog_allowlist() -> None:
    assert "data-entry-table-col-text" in CATALOG_DATA_ENTRY_TYPE_ALLOWLIST
    assert "data-entry-table-col-selection" in CATALOG_DATA_ENTRY_TYPE_ALLOWLIST
    assert "data-entry-table-col-time" in CATALOG_DATA_ENTRY_TYPE_ALLOWLIST
    assert "data-entry-table-col-toggle" in CATALOG_DATA_ENTRY_TYPE_ALLOWLIST


def test_catalog_dropdown_lists_table_types() -> None:
    vals = catalog_data_entry_type_dropdown_values()
    assert "data-entry-table" in vals
    assert "data-entry-table-col-text" in vals
    assert "data-entry-table-col-time" in vals
