"""Table builders for Local Service ACL (entity_type ``acl_rule``).

The cache identity is ``RuleName`` (saved as ``external_name`` during sync);
the generic flattener handles this automatically because the Name resolver in
``app.interface_table._name_value`` falls back to ``external_name`` when
``Name`` is absent in the payload.
"""

from __future__ import annotations

from typing import Any

from app.hosts_services_table import (
    build_hosts_services_table_rows,
    build_hs_table_rows_combined,
)

LOCAL_SERVICE_ACL_ENTITY_TYPE = "acl_rule"


def build_local_service_acl_table_rows(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
) -> dict[str, Any]:
    return build_hosts_services_table_rows(
        parsed, entity_type=LOCAL_SERVICE_ACL_ENTITY_TYPE
    )


def build_local_service_acl_table_rows_combined(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
    *,
    combine_by: str | None = None,
) -> dict[str, Any]:
    return build_hs_table_rows_combined(
        parsed, entity_type=LOCAL_SERVICE_ACL_ENTITY_TYPE, combine_by=combine_by
    )
