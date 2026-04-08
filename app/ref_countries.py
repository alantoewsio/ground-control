"""ISO-style country codes for Country group UI, seeded from the ``All Countries`` built-in group."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import ConfigurationConfigEntry, FirewallConfigEntry, RefCountry

ALL_COUNTRIES_GROUP_NAME = "All Countries"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_all_countries_group_name(name: str | None) -> bool:
    if name is None:
        return False
    return name.strip().casefold() == ALL_COUNTRIES_GROUP_NAME.casefold()


def country_codes_from_group_payload(payload: dict[str, Any]) -> list[str]:
    """Extract country codes from a CountryGroup-shaped dict (cached API / form merge)."""
    cl = payload.get("CountryList")
    if not isinstance(cl, dict):
        return []
    raw = cl.get("Country")
    return _normalize_country_list_raw(raw)


def _normalize_country_list_raw(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        s = raw.strip()
        return [s] if s else []
    if isinstance(raw, list):
        out: list[str] = []
        seen: set[str] = set()
        for x in raw:
            t: str | None = None
            if isinstance(x, str):
                t = x.strip() if x.strip() else None
            elif isinstance(x, dict):
                t = _extract_scalar_from_country_node(x)
            if t and t not in seen:
                seen.add(t)
                out.append(t)
        return out
    if isinstance(raw, dict):
        t = _extract_scalar_from_country_node(raw)
        return [t] if t else []
    return []


def _extract_scalar_from_country_node(d: dict[str, Any]) -> str | None:
    for k in ("#text", "text", "Country"):
        v = d.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def pick_best_all_countries_item(items: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Prefer the ``All Countries`` group with the longest member list (most complete)."""
    best: dict[str, Any] | None = None
    best_len = -1
    for item in items:
        if not isinstance(item, dict):
            continue
        n = item.get("Name")
        if not isinstance(n, str) or not is_all_countries_group_name(n):
            continue
        codes = country_codes_from_group_payload(item)
        if len(codes) > best_len:
            best = item
            best_len = len(codes)
    return best


def replace_ref_countries(db: Session, codes: list[str]) -> None:
    """Replace the reference table with an ordered code list (e.g. from ``All Countries``)."""
    db.query(RefCountry).delete()
    for i, raw in enumerate(codes):
        c = str(raw).strip()
        if not c:
            continue
        db.add(
            RefCountry(
                code=c,
                sort_order=i,
                updated_at=_utc_now(),
            )
        )


def refresh_ref_countries_from_country_group_items(
    db: Session, items: list[dict[str, Any]] | None
) -> None:
    if not items:
        return
    best = pick_best_all_countries_item(items)
    if not best:
        return
    codes = country_codes_from_group_payload(best)
    if not codes:
        return
    replace_ref_countries(db, codes)


def refresh_ref_countries_from_payload(db: Session, payload: dict[str, Any]) -> None:
    codes = country_codes_from_group_payload(payload)
    if not codes:
        return
    replace_ref_countries(db, codes)


def try_seed_ref_countries_from_cache(db: Session) -> bool:
    """If ``ref_countries`` is empty, load from cached ``All Countries`` country group."""
    if db.query(RefCountry).count() > 0:
        return False
    ac = ALL_COUNTRIES_GROUP_NAME.casefold()
    row = (
        db.query(FirewallConfigEntry)
        .filter(
            FirewallConfigEntry.entity_type == "country_group",
            func.lower(FirewallConfigEntry.external_name) == ac,
        )
        .limit(1)
        .one_or_none()
    )
    if row is None:
        row = (
            db.query(ConfigurationConfigEntry)
            .filter(
                ConfigurationConfigEntry.entity_type == "country_group",
                func.lower(ConfigurationConfigEntry.external_name) == ac,
            )
            .limit(1)
            .one_or_none()
        )
    if row is None:
        return False
    try:
        data = json.loads(row.payload_json)
    except (json.JSONDecodeError, TypeError):
        return False
    if not isinstance(data, dict):
        return False
    codes = country_codes_from_group_payload(data)
    if not codes:
        return False
    replace_ref_countries(db, codes)
    return True


def list_ref_country_codes_payload(db: Session) -> list[dict[str, Any]]:
    rows = db.query(RefCountry).order_by(RefCountry.sort_order.asc(), RefCountry.code.asc()).all()
    return [{"code": r.code, "sort_order": r.sort_order} for r in rows]
