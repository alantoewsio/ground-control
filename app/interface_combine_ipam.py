"""IPAM pool resolution for interface static addresses (combined flyout)."""

from __future__ import annotations

import ipaddress
from typing import Any, Literal

from sqlalchemy.orm import Session

from app.interface_table import list_network_cidrs_from_flat
from app.ipam import _ptype_cf, attach_parent_hierarchy_fields, vrf_key
from app.models import IpamPrefix


def _load_all_ipam(db: Session) -> list[IpamPrefix]:
    return db.query(IpamPrefix).all()


def resolve_static_address_ipam(
    db: Session,
    *,
    firewall_id: int | None,
    flat: dict[str, str],
    entity_type: str,
    family: Literal[4, 6],
) -> dict[str, Any]:
    """
    For a firewall-scoped interface row, resolve IPAM pool context for static addressing.

    Returns:
        pool_id, pool_name: parent pool of the matching assignment for this firewall, if any.
        assignment_cidr: normalized assignment CIDR if found.
        pool_conflict: True when a static address is present but not under the resolved pool,
          or no assignment matches.
    """
    empty: dict[str, Any] = {
        "pool_id": None,
        "pool_name": "",
        "assignment_cidr": "",
        "pool_conflict": False,
    }
    if firewall_id is None or int(firewall_id) < 1:
        return empty

    et = (entity_type or "").strip().lower()
    cidrs = list_network_cidrs_from_flat(flat, entity_type=et)
    target: str | None = None
    for raw in cidrs:
        try:
            net = ipaddress.ip_network(raw.strip(), strict=False)
        except ValueError:
            continue
        if net.version == family:
            target = str(net)
            break
    if not target:
        return empty

    try:
        iface_net = ipaddress.ip_network(target, strict=False)
    except ValueError:
        return empty

    all_rows = _load_all_ipam(db)
    match: IpamPrefix | None = None
    for r in all_rows:
        if _ptype_cf(r) not in ("assignment", "host"):
            continue
        if r.assigned_to_firewall_id is None or int(r.assigned_to_firewall_id) != int(
            firewall_id
        ):
            continue
        try:
            an = ipaddress.ip_network(r.cidr.strip(), strict=False)
        except ValueError:
            continue
        if an.version != iface_net.version:
            continue
        if iface_net == an or iface_net.subnet_of(an):
            if match is None or an.prefixlen > ipaddress.ip_network(
                match.cidr, strict=False
            ).prefixlen:
                match = r

    if match is None:
        out = dict(empty)
        out["pool_conflict"] = True
        return out

    payload: dict[str, Any] = {}
    attach_parent_hierarchy_fields(payload, match, all_rows)
    pool_id = payload.get("parent_pool_id")
    pool_name = ""
    pool_net = None
    prow: IpamPrefix | None = None
    if pool_id is not None:
        prow = db.get(IpamPrefix, int(pool_id))
        if prow is not None and _ptype_cf(prow) == "pool":
            pool_name = (prow.name or "").strip() or (prow.cidr or "")
            try:
                pool_net = ipaddress.ip_network(prow.cidr, strict=False)
            except ValueError:
                pool_net = None

    conflict = False
    if pool_net is None:
        conflict = True
    else:
        if iface_net.version != pool_net.version or not iface_net.subnet_of(pool_net):
            conflict = True
        if vrf_key(match.vrf) != vrf_key(getattr(prow, "vrf", None)):
            conflict = True

    return {
        "pool_id": int(pool_id) if pool_id is not None else None,
        "pool_name": pool_name,
        "assignment_cidr": str(
            ipaddress.ip_network(match.cidr.strip(), strict=False)
        ),
        "pool_conflict": conflict,
    }


def enrich_combine_sources_with_ipam(
    db: Session, sources: list[dict[str, Any]]
) -> None:
    """Mutates each source dict with ``ipam_v4`` / ``ipam_v6`` keys (from :func:`resolve_static_address_ipam`)."""
    for s in sources:
        flat = s.get("flat")
        if not isinstance(flat, dict):
            flat = {}
        fw_id = s.get("firewall_id")
        et = str(s.get("entity_type") or "")
        s["ipam_v4"] = resolve_static_address_ipam(
            db, firewall_id=fw_id, flat=flat, entity_type=et, family=4
        )
        s["ipam_v6"] = resolve_static_address_ipam(
            db, firewall_id=fw_id, flat=flat, entity_type=et, family=6
        )


def enrich_interface_payload_combine_sources_ipam(
    db: Session, payload: dict[str, Any]
) -> None:
    for row in payload.get("rows") or []:
        srcs = row.get("if_combine_sources")
        if isinstance(srcs, list) and srcs:
            enrich_combine_sources_with_ipam(db, srcs)
