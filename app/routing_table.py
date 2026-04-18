"""Table builders for the Routing nav page (UnicastRoute, Gateway, GatewayHost).

These delegate to the generic hosts_services_table flattener so columns are
discovered automatically from the cached JSON payload.  We accept the same
``entity_type`` strings used by the cache and the merge dispatchers so the
existing /api/* routes can dispatch by entity_type.
"""

from __future__ import annotations

from typing import Any

from app.hosts_services_table import (
    build_hosts_services_table_rows,
    build_hs_table_rows_combined,
)

ROUTING_ENTITY_TYPES: frozenset[str] = frozenset(
    {"unicast_route", "gateway", "gateway_host"}
)


def is_routing_entity_type(entity_type: str) -> bool:
    return (entity_type or "").strip() in ROUTING_ENTITY_TYPES


def build_routing_table_rows(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
    *,
    entity_type: str,
) -> dict[str, Any]:
    """Per-firewall flattened table for one routing entity_type."""
    return build_hosts_services_table_rows(parsed, entity_type=entity_type)


def build_routing_table_rows_combined(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
    *,
    entity_type: str,
    combine_by: str | None = None,
) -> dict[str, Any]:
    """Combined / configuration view for one routing entity_type."""
    return build_hs_table_rows_combined(
        parsed, entity_type=entity_type, combine_by=combine_by
    )
