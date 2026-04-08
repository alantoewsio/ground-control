"""IPAM pool resolution and commit for Network · Interface flyout (IPv4 static + pool)."""

from __future__ import annotations

import ipaddress
from typing import Any

from sqlalchemy.orm import Session

from app.interface_flyout_merge import netmask_display_to_api
from app.ipam import (
    _normalize_cidr,
    _ptype_cf,
    create_ipam_prefix,
    suggest_next_assignment_cidr,
    vrf_key,
)
from app.models import IpamPrefix


def resolve_ipv4_pool_address_for_interface(
    db: Session,
    *,
    parent_pool_id: int,
    prefix_len: int,
    firewall_id: int | None,
) -> dict[str, Any]:
    """
    Prefer an existing IPv4 assignment (or host) for *firewall_id* under *parent_pool_id*
    with prefix length *prefix_len*; otherwise return the next free subnet from the pool.

    Returns ``{"cidr": str, "source": "existing"|"suggested"}``.
    """
    pool = db.get(IpamPrefix, int(parent_pool_id))
    if pool is None or _ptype_cf(pool) != "pool":
        raise ValueError("Invalid parent pool.")
    if bool(getattr(pool, "pool_unmanaged", False)):
        raise ValueError("This pool does not support automatic allocation.")
    try:
        pool_net = ipaddress.ip_network(pool.cidr.strip(), strict=False)
    except ValueError as exc:
        raise ValueError("Invalid pool CIDR.") from exc
    if pool_net.version != 4:
        raise ValueError("Only IPv4 pools are supported for this action.")
    pl = int(prefix_len)
    if pl <= pool_net.prefixlen or pl > 32:
        raise ValueError(
            "Prefix length must be longer than the pool and at most /32 for IPv4."
        )
    vk = vrf_key(pool.vrf)

    if firewall_id is not None and int(firewall_id) > 0:
        all_rows = db.query(IpamPrefix).all()
        candidates: list[ipaddress.IPv4Network] = []
        for r in all_rows:
            if r.assigned_to_firewall_id is None:
                continue
            if int(r.assigned_to_firewall_id) != int(firewall_id):
                continue
            if _ptype_cf(r) not in ("assignment", "host"):
                continue
            if vrf_key(r.vrf) != vk:
                continue
            try:
                an = ipaddress.ip_network(r.cidr.strip(), strict=False)
            except ValueError:
                continue
            if an.version != 4 or an.prefixlen != pl:
                continue
            if not an.subnet_of(pool_net):
                continue
            candidates.append(an)
        if candidates:
            chosen = min(candidates, key=lambda n: int(n.network_address))
            return {"cidr": str(chosen), "source": "existing"}

    cidr = suggest_next_assignment_cidr(
        db, parent_pool_id=int(parent_pool_id), prefix_len=pl
    )
    return {"cidr": cidr, "source": "suggested"}


def commit_interface_static_to_ipam_pool(
    db: Session,
    *,
    firewall_id: int,
    parent_pool_id: int,
    ipv4_ip: str,
    ipv4_netmask: str,
) -> dict[str, Any]:
    """
    Ensure an IPAM assignment exists for the interface IPv4 network, assigned to *firewall_id*,
    under *parent_pool_id*. Creates the row if missing; no-op if already matches.
    """
    fw = int(firewall_id)
    if fw < 1:
        raise ValueError("Invalid firewall id.")
    pool = db.get(IpamPrefix, int(parent_pool_id))
    if pool is None or _ptype_cf(pool) != "pool":
        raise ValueError("Invalid parent pool.")
    if bool(getattr(pool, "pool_unmanaged", False)):
        raise ValueError("Cannot record assignments under an unmanaged pool.")

    ip_s = (ipv4_ip or "").strip()
    nm_api = netmask_display_to_api(str(ipv4_netmask or ""))
    if not ip_s or not nm_api:
        raise ValueError("IPv4 address and netmask are required.")
    try:
        iface = ipaddress.IPv4Interface(f"{ip_s}/{nm_api}")
    except ValueError as exc:
        raise ValueError("Invalid IPv4 address or netmask.") from exc
    net = iface.network
    try:
        pool_net = ipaddress.ip_network(pool.cidr.strip(), strict=False)
    except ValueError as exc:
        raise ValueError("Invalid pool CIDR.") from exc
    if pool_net.version != 4 or not net.subnet_of(pool_net):
        raise ValueError("Interface network is not inside the selected pool.")
    vk = vrf_key(pool.vrf)
    cidr_norm, _ = _normalize_cidr(str(net))
    existing = (
        db.query(IpamPrefix)
        .filter(
            IpamPrefix.cidr == cidr_norm,
            IpamPrefix.vrf_bucket == vk,
        )
        .first()
    )
    if existing is not None:
        if _ptype_cf(existing) not in ("assignment", "host"):
            raise ValueError("This subnet exists in IPAM with an incompatible type.")
        afw = existing.assigned_to_firewall_id
        if afw is not None and int(afw) != fw:
            raise ValueError(
                "This subnet is already recorded in IPAM for a different firewall."
            )
        if afw is None or int(afw) != fw:
            existing.assigned_to_firewall_id = fw
            db.commit()
        return {"ok": True, "created": False, "cidr": cidr_norm}

    nm = f"Interface {cidr_norm}"
    row = create_ipam_prefix(
        db,
        name=nm,
        cidr=cidr_norm,
        vrf=pool.vrf,
        prefix_type="assignment",
        assigned_to_firewall_id=fw,
        assigned_to_custom=None,
        description=None,
        parent_pool_id=int(parent_pool_id),
        parent_assignment_id=None,
    )
    return {"ok": True, "created": True, "cidr": row.cidr, "id": row.id}
