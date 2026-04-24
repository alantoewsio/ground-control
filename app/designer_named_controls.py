"""``data-gc-designer-control-id`` values on ``/designer/controls`` (``templates/designer_controls.html``)."""

from __future__ import annotations

DESIGNER_NAMED_CONTROL_IDS: frozenset[str] = frozenset(
    {
        "data-entry-table",
        "datetime",
        "dropdown-multi",
        "dropdown-shared",
        "dropdown-single",
        "member-lookup",
        "edit-flyout",
        "ip-constraint",
        "ip-address",
        "ip-list",
        "selector",
        "tag-editor",
        "tag-save",
        "text-config",
        "text-multiline",
        "text-single",
        "toggle-checkbox",
        "toggle-onoff",
    }
)

# Legacy catalog rows may still reference the old split IP types.
_LEGACY_CATALOG_IP_ENTRY_TYPES: frozenset[str] = frozenset({"ip-ipv4", "ip-ipv6"})

# Column types for ``data-entry-table`` object children (catalog / layout only).
_DATA_ENTRY_TABLE_COLUMN_ENTRY_TYPES: frozenset[str] = frozenset(
    {
        "data-entry-table-col-text",
        "data-entry-table-col-selection",
        "data-entry-table-col-time",
        "data-entry-table-col-toggle",
    }
)

# Catalog-only value (not a ``data-gc-designer-control-id`` on /designer/controls).
CATALOG_DATA_ENTRY_TYPE_ALLOWLIST: frozenset[str] = (
    DESIGNER_NAMED_CONTROL_IDS
    | frozenset({"Hidden"})
    | _LEGACY_CATALOG_IP_ENTRY_TYPES
    | _DATA_ENTRY_TABLE_COLUMN_ENTRY_TYPES
)


def designer_named_control_ids_sorted() -> list[str]:
    return sorted(DESIGNER_NAMED_CONTROL_IDS)


def catalog_data_entry_type_dropdown_values() -> list[str]:
    """Values for Data Controls · data entry type (``Hidden`` plus designer control ids)."""
    return ["Hidden"] + sorted(DESIGNER_NAMED_CONTROL_IDS | _DATA_ENTRY_TABLE_COLUMN_ENTRY_TYPES)
