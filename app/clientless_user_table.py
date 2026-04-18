"""Table builders for the Clientless Users tab on the Authentication page."""

from __future__ import annotations

from typing import Any

from app.hosts_services_table import (
    build_hosts_services_table_rows,
    build_hs_table_rows_combined,
)

CLIENTLESS_USER_ENTITY_TYPE = "clientless_user"


def build_clientless_user_table_rows(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
) -> dict[str, Any]:
    return build_hosts_services_table_rows(
        parsed, entity_type=CLIENTLESS_USER_ENTITY_TYPE
    )


def build_clientless_user_table_rows_combined(
    parsed: list[tuple[Any, Any, dict[str, Any]]],
    *,
    combine_by: str | None = None,
) -> dict[str, Any]:
    return build_hs_table_rows_combined(
        parsed, entity_type=CLIENTLESS_USER_ENTITY_TYPE, combine_by=combine_by
    )
