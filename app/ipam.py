"""IP address management helpers (local prefix registry)."""

from __future__ import annotations

import ipaddress
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Firewall, IpamPrefix


class IpamDuplicateCidrError(ValueError):
    """Another saved row in ``ipam_prefixes`` already uses this (cidr, vrf_bucket)."""


def vrf_key(v: str | None) -> str:
    """Canonical VRF bucket (matches Address Management UI)."""
    s = (v or "").strip()
    return s if s else "default"


def normalize_ipam_prefix_vrf_label(vrf: str | None) -> str:
    """Non-empty stripped VRF label for persisted prefixes (API requirement)."""
    s = (vrf or "").strip()
    if not s:
        raise ValueError("VRF is required.")
    if len(s) > 128:
        raise ValueError("VRF must be at most 128 characters.")
    return s


def _ptype_cf(row: IpamPrefix) -> str:
    return (row.prefix_type or "").strip().casefold()


def find_most_specific_containing_pool(
    net: ipaddress.IPv4Network | ipaddress.IPv6Network,
    vrf_k: str,
    all_rows: list[IpamPrefix],
    *,
    exclude_prefix_id: int | None = None,
) -> IpamPrefix | None:
    """Smallest (most specific) pool in *vrf_k* that strictly contains *net*."""
    best: IpamPrefix | None = None
    best_pl = -1
    for r in all_rows:
        if exclude_prefix_id is not None and int(r.id) == exclude_prefix_id:
            continue
        if _ptype_cf(r) != "pool":
            continue
        if vrf_key(r.vrf) != vrf_k:
            continue
        try:
            pn = ipaddress.ip_network(r.cidr, strict=False)
        except ValueError:
            continue
        if pn.version != net.version:
            continue
        if net.subnet_of(pn) and net != pn:
            if pn.prefixlen > best_pl:
                best_pl = pn.prefixlen
                best = r
    return best


def find_most_specific_containing_assignment(
    net: ipaddress.IPv4Network | ipaddress.IPv6Network,
    vrf_k: str,
    all_rows: list[IpamPrefix],
    *,
    exclude_prefix_id: int | None = None,
    pool_scope_id: int | None = None,
) -> IpamPrefix | None:
    """Smallest assignment in *vrf_k* that strictly contains *net*, optionally scoped to a pool."""
    pool_net: ipaddress.IPv4Network | ipaddress.IPv6Network | None = None
    if pool_scope_id is not None:
        prow = next((x for x in all_rows if int(x.id) == int(pool_scope_id)), None)
        if prow is not None and _ptype_cf(prow) == "pool":
            try:
                pool_net = ipaddress.ip_network(prow.cidr, strict=False)
            except ValueError:
                pool_net = None
    best: IpamPrefix | None = None
    best_pl = -1
    for r in all_rows:
        if exclude_prefix_id is not None and int(r.id) == exclude_prefix_id:
            continue
        if _ptype_cf(r) != "assignment":
            continue
        if vrf_key(r.vrf) != vrf_k:
            continue
        try:
            an = ipaddress.ip_network(r.cidr, strict=False)
        except ValueError:
            continue
        if an.version != net.version:
            continue
        if pool_net is not None and not an.subnet_of(pool_net):
            continue
        if net.subnet_of(an) and net != an:
            if an.prefixlen > best_pl:
                best_pl = an.prefixlen
                best = r
    return best


def attach_parent_hierarchy_fields(
    payload: dict[str, Any], row: IpamPrefix, all_rows: list[IpamPrefix]
) -> None:
    """Set parent_pool_id and parent_assignment_id from CIDR containment."""
    try:
        net = ipaddress.ip_network(row.cidr, strict=False)
    except ValueError:
        payload["parent_pool_id"] = None
        payload["parent_assignment_id"] = None
        return
    vk = vrf_key(row.vrf)
    pt = _ptype_cf(row)
    if pt == "assignment":
        pp = find_most_specific_containing_pool(
            net, vk, all_rows, exclude_prefix_id=int(row.id)
        )
        payload["parent_pool_id"] = int(pp.id) if pp else None
        payload["parent_assignment_id"] = None
    elif pt == "host":
        pa = find_most_specific_containing_assignment(
            net, vk, all_rows, exclude_prefix_id=int(row.id)
        )
        payload["parent_assignment_id"] = int(pa.id) if pa else None
        payload["parent_pool_id"] = None
        if pa is not None:
            pan = ipaddress.ip_network(pa.cidr, strict=False)
            pp = find_most_specific_containing_pool(
                pan, vk, all_rows, exclude_prefix_id=int(pa.id)
            )
            payload["parent_pool_id"] = int(pp.id) if pp else None
    elif pt == "pool":
        ppool = find_most_specific_containing_pool(
            net, vk, all_rows, exclude_prefix_id=int(row.id)
        )
        payload["parent_pool_id"] = int(ppool.id) if ppool else None
        payload["parent_assignment_id"] = None
    else:
        payload["parent_pool_id"] = None
        payload["parent_assignment_id"] = None


def build_ipam_form_meta(db: Session) -> dict[str, Any]:
    from app.models import IpamVrf

    rows = db.query(IpamPrefix).all()
    unmanaged_pool_ids = {
        int(r.id)
        for r in rows
        if _ptype_cf(r) == "pool" and bool(getattr(r, "pool_unmanaged", False))
    }
    registered = [r.name for r in db.query(IpamVrf).order_by(IpamVrf.name)]
    from_prefixes = {vrf_key(r.vrf) for r in rows}
    names = sorted(set(registered) | from_prefixes, key=str.casefold)
    pools: list[dict[str, Any]] = []
    assignments: list[dict[str, Any]] = []
    for r in rows:
        if _ptype_cf(r) == "pool":
            if bool(getattr(r, "pool_unmanaged", False)):
                continue
            pools.append(
                {
                    "id": int(r.id),
                    "name": r.name or "",
                    "cidr": r.cidr,
                    "vrf_key": vrf_key(r.vrf),
                }
            )
        elif _ptype_cf(r) == "assignment":
            try:
                net = ipaddress.ip_network(r.cidr, strict=False)
            except ValueError:
                continue
            pp = find_most_specific_containing_pool(
                net, vrf_key(r.vrf), rows, exclude_prefix_id=int(r.id)
            )
            ppid = int(pp.id) if pp else None
            if ppid is not None and ppid in unmanaged_pool_ids:
                continue
            assignments.append(
                {
                    "id": int(r.id),
                    "name": r.name or "",
                    "cidr": r.cidr,
                    "vrf_key": vrf_key(r.vrf),
                    "parent_pool_id": ppid,
                }
            )
    pools.sort(key=lambda x: (x["vrf_key"].lower(), x["cidr"]))
    assignments.sort(key=lambda x: (x["vrf_key"].lower(), x["cidr"]))
    return {"vrf_names": names, "pools": pools, "assignments": assignments}


def _validate_ipam_write_parents(
    db: Session,
    *,
    net: ipaddress.IPv4Network | ipaddress.IPv6Network,
    vrf: str | None,
    ptype_raw: str,
    parent_pool_id: int | None,
    parent_assignment_id: int | None,
) -> None:
    vk = vrf_key(vrf)
    ptype = (ptype_raw or "assignment").strip().casefold()
    if ptype == "pool":
        return
    if ptype == "assignment":
        if parent_pool_id is None:
            raise ValueError("Parent pool is required for assignments.")
        pool = db.get(IpamPrefix, int(parent_pool_id))
        if pool is None or _ptype_cf(pool) != "pool":
            raise ValueError("Invalid parent pool.")
        if bool(getattr(pool, "pool_unmanaged", False)):
            raise ValueError("This pool is unmanaged and cannot be used as a parent for assignments.")
        if vrf_key(pool.vrf) != vk:
            raise ValueError("Parent pool must be in the selected VRF.")
        try:
            pn = ipaddress.ip_network(pool.cidr, strict=False)
        except ValueError as exc:
            raise ValueError("Invalid parent pool CIDR.") from exc
        if net.version != pn.version:
            raise ValueError("Prefix must be the same IP family as the parent pool.")
        if not net.subnet_of(pn) or net == pn:
            raise ValueError("Prefix must be a strict subnet of the parent pool.")
        return
    if ptype == "host":
        if parent_assignment_id is None:
            raise ValueError("Parent assignment is required for hosts.")
        asn = db.get(IpamPrefix, int(parent_assignment_id))
        if asn is None or _ptype_cf(asn) != "assignment":
            raise ValueError("Invalid parent assignment.")
        if vrf_key(asn.vrf) != vk:
            raise ValueError("Parent assignment must be in the selected VRF.")
        try:
            an = ipaddress.ip_network(asn.cidr, strict=False)
        except ValueError as exc:
            raise ValueError("Invalid parent assignment CIDR.") from exc
        if net.version != an.version:
            raise ValueError("Host prefix must match the IP family of the parent assignment.")
        if not net.subnet_of(an) or net == an:
            raise ValueError("Host prefix must be a strict subnet of the parent assignment.")
        all_rows_h = db.query(IpamPrefix).all()
        pp_host = find_most_specific_containing_pool(
            an, vrf_key(asn.vrf), all_rows_h, exclude_prefix_id=int(asn.id)
        )
        if pp_host is not None and bool(getattr(pp_host, "pool_unmanaged", False)):
            raise ValueError(
                "The parent assignment sits under an unmanaged pool; hosts cannot use it."
            )
        return


_MAX_SUBNETS_TO_SCAN_FOR_AUTO_ASSIGN = 65536


def suggest_next_assignment_cidr(
    db: Session,
    *,
    parent_pool_id: int,
    prefix_len: int,
    exclude_prefix_id: int | None = None,
) -> str:
    """Return the first free ``prefix_len`` subnet strictly inside the pool (IPv4 only).

    Considers any saved prefix in the same VRF that lies strictly inside the pool as
    consuming address space (assignments, nested pools, hosts, etc.).
    """
    pool = db.get(IpamPrefix, int(parent_pool_id))
    if pool is None or _ptype_cf(pool) != "pool":
        raise ValueError("Invalid parent pool.")
    if bool(getattr(pool, "pool_unmanaged", False)):
        raise ValueError("Automatic allocation is not available for unmanaged pools.")
    try:
        pool_net = ipaddress.ip_network(pool.cidr, strict=False)
    except ValueError as exc:
        raise ValueError("Invalid parent pool CIDR.") from exc
    pl = int(prefix_len)
    vk = vrf_key(pool.vrf)
    all_rows = db.query(IpamPrefix).all()

    if pool_net.version == 4:
        if pl <= pool_net.prefixlen or pl > 32:
            raise ValueError(
                "Prefix length must be longer than the pool and at most /32 for IPv4."
            )
        n_slots = 2 ** (pl - pool_net.prefixlen)
        if n_slots > _MAX_SUBNETS_TO_SCAN_FOR_AUTO_ASSIGN:
            raise ValueError(
                "This pool is too large to scan for a free block at that size; enter a CIDR manually."
            )
        occupied: list[ipaddress.IPv4Network] = []
        for r in all_rows:
            if exclude_prefix_id is not None and int(r.id) == int(exclude_prefix_id):
                continue
            if vrf_key(r.vrf) != vk:
                continue
            try:
                n = ipaddress.ip_network(r.cidr, strict=False)
            except ValueError:
                continue
            if n.version != 4:
                continue
            if n == pool_net:
                continue
            if n.subnet_of(pool_net):
                occupied.append(n)
        for subnet in pool_net.subnets(new_prefix=pl):
            if not any(subnet.overlaps(o) for o in occupied):
                return str(subnet)
        raise ValueError("No free block of this size remains in the pool.")

    if pool_net.version == 6:
        raise ValueError(
            "Automatic next-assignment CIDR is only supported for IPv4 pools."
        )

    raise ValueError("Unsupported address family for automatic assignment.")


def _strict_subordinates_of_pool(
    pool_net: ipaddress.IPv4Network | ipaddress.IPv6Network,
    all_rows: list[IpamPrefix],
    exclude_id: int,
) -> list[IpamPrefix]:
    """Other prefixes strictly contained in *pool_net* (same IP version only)."""
    out: list[IpamPrefix] = []
    for r in all_rows:
        if int(r.id) == exclude_id:
            continue
        try:
            n = ipaddress.ip_network(r.cidr, strict=False)
        except ValueError:
            continue
        if n.version != pool_net.version:
            continue
        if n != pool_net and n.subnet_of(pool_net):
            out.append(r)
    return out


def attach_ipam_delete_meta(
    payload: dict[str, Any],
    row: IpamPrefix,
    all_rows: list[IpamPrefix],
    fw_labels: dict[int, str],
) -> None:
    """Set delete_eligible, delete_allowed, delete_blocked_reason, ipam_delete_cascade_count."""
    ptype = (row.prefix_type or "").strip().casefold()
    payload["delete_eligible"] = ptype in ("pool", "assignment")
    payload["delete_allowed"] = False
    payload["delete_blocked_reason"] = None
    payload["ipam_delete_cascade_count"] = 0
    if not payload["delete_eligible"]:
        return
    if ptype == "assignment":
        if row.assigned_to_firewall_id is not None:
            payload["delete_blocked_reason"] = (
                "This assignment is linked to a managed firewall. "
                "Remove that link before deleting."
            )
        else:
            payload["delete_allowed"] = True
        return
    try:
        pool_net = ipaddress.ip_network(row.cidr, strict=False)
    except ValueError:
        payload["delete_blocked_reason"] = "Invalid pool CIDR."
        return
    subs = _strict_subordinates_of_pool(pool_net, all_rows, int(row.id))
    payload["ipam_delete_cascade_count"] = len(subs)
    blocked = [s for s in subs if s.assigned_to_firewall_id is not None]
    if blocked:
        labels: list[str] = []
        for s in blocked[:3]:
            fid = int(s.assigned_to_firewall_id or 0)
            labels.append(fw_labels.get(fid) or f"Firewall #{fid}")
        extra = ""
        if len(blocked) > 3:
            extra = f" (+{len(blocked) - 3} more)"
        payload["delete_blocked_reason"] = (
            "One or more prefixes inside this pool are assigned to a managed firewall "
            f"({', '.join(labels)}{extra}). Reassign or remove those links first."
        )
    else:
        payload["delete_allowed"] = True


def delete_ipam_prefix(db: Session, prefix_id: int) -> bool:
    """Delete a pool (and all contained prefixes) or a single assignment. Returns False if missing."""
    row = db.get(IpamPrefix, prefix_id)
    if row is None:
        return False
    all_rows = db.query(IpamPrefix).all()
    all_fw = {
        int(r.assigned_to_firewall_id)
        for r in all_rows
        if r.assigned_to_firewall_id is not None
    }
    fw_labels = _firewall_label_map(db, all_fw)
    scratch: dict[str, Any] = {}
    attach_ipam_delete_meta(scratch, row, all_rows, fw_labels)
    ptype = (row.prefix_type or "").strip().casefold()
    if ptype not in ("pool", "assignment"):
        raise ValueError("Only pool and assignment prefixes can be deleted with this action.")
    if not scratch.get("delete_allowed"):
        raise ValueError(scratch.get("delete_blocked_reason") or "Cannot delete this prefix.")
    if ptype == "assignment":
        db.delete(row)
        db.commit()
        return True
    pool_net = ipaddress.ip_network(row.cidr, strict=False)
    subs = _strict_subordinates_of_pool(pool_net, all_rows, int(row.id))
    for s in subs:
        db.delete(s)
    db.delete(row)
    db.commit()
    return True


def _normalize_cidr(raw: str) -> tuple[str, int]:
    s = (raw or "").strip()
    if not s:
        raise ValueError("Prefix is required")
    net = ipaddress.ip_network(s, strict=False)
    fam = 6 if net.version == 6 else 4
    return str(net), fam


def _normalize_name(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        raise ValueError("Name is required")
    if len(s) > 255:
        raise ValueError("Name must be at most 255 characters")
    return s


def _normalize_assignment(
    db: Session,
    prefix_type: str,
    assigned_to_firewall_id: int | None,
    assigned_to_custom: str | None,
) -> tuple[int | None, str | None]:
    """Persist assignment target only when prefix type is *assignment*."""
    ptype = (prefix_type or "assignment").strip().casefold()
    if ptype != "assignment":
        return None, None
    if assigned_to_firewall_id is not None:
        fid = int(assigned_to_firewall_id)
        if fid <= 0:
            raise ValueError("Invalid firewall id")
        if db.get(Firewall, fid) is None:
            raise ValueError("Firewall not found")
        return fid, None
    custom = (assigned_to_custom or "").strip()
    if len(custom) > 255:
        raise ValueError("Assigned-to label must be at most 255 characters")
    return None, custom or None


def _size_label(cidr: str) -> str:
    net = ipaddress.ip_network(cidr, strict=False)
    n = int(net.num_addresses)
    if net.version == 6 and net.prefixlen < 64:
        return "Large"
    if n <= 65_536:
        return f"{n:,}"
    if n < 10**9:
        return f"{n:,}"
    return "Large"


def _assigned_display(
    row: IpamPrefix, fw_labels: dict[int, str]
) -> str | None:
    if (row.prefix_type or "").strip().casefold() != "assignment":
        return None
    if row.assigned_to_firewall_id is not None:
        fid = int(row.assigned_to_firewall_id)
        return fw_labels.get(fid) or f"Firewall #{fid}"
    if row.assigned_to_custom:
        return row.assigned_to_custom.strip()
    return None


def ipam_prefix_to_dict(row: IpamPrefix, fw_labels: dict[int, str]) -> dict[str, Any]:
    disp = _assigned_display(row, fw_labels)
    pt = (row.prefix_type or "").strip().casefold()
    unmanaged = bool(getattr(row, "pool_unmanaged", False)) if pt == "pool" else False
    return {
        "id": row.id,
        "name": row.name or "",
        "cidr": row.cidr,
        "family": row.family,
        "vrf": row.vrf,
        "prefix_type": row.prefix_type,
        "pool_unmanaged": unmanaged,
        "assigned_to_firewall_id": row.assigned_to_firewall_id,
        "assigned_to_custom": row.assigned_to_custom,
        "assigned_to_display": disp,
        "description": row.description,
        "lease_hostname": (row.lease_hostname or "").strip() or None,
        "mac_address": (row.mac_address or "").strip() or None,
        "size_label": _size_label(row.cidr),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _ipam_sort_key(cidr: str) -> tuple[int, int, bytes]:
    net = ipaddress.ip_network(cidr, strict=False)
    packed = int(net.network_address).to_bytes(16 if net.version == 6 else 4, "big")
    return (net.version, net.prefixlen, packed)


def _firewall_label_map(db: Session, ids: set[int]) -> dict[int, str]:
    if not ids:
        return {}
    rows = db.query(Firewall).filter(Firewall.id.in_(sorted(ids))).all()
    return {
        int(f.id): ((f.name or f.host or str(f.id)).strip()) for f in rows
    }


def ipam_prefix_row_payload(db: Session, row: IpamPrefix) -> dict[str, Any]:
    all_rows = db.query(IpamPrefix).all()
    all_fw = {
        int(r.assigned_to_firewall_id)
        for r in all_rows
        if r.assigned_to_firewall_id is not None
    }
    if row.assigned_to_firewall_id is not None:
        all_fw.add(int(row.assigned_to_firewall_id))
    fw = _firewall_label_map(db, all_fw)
    d = ipam_prefix_to_dict(row, fw)
    attach_ipam_delete_meta(d, row, all_rows, fw)
    attach_parent_hierarchy_fields(d, row, all_rows)
    return d


def list_ipam_prefix_payloads(db: Session, q: str = "") -> list[dict[str, Any]]:
    rows = db.query(IpamPrefix).all()
    all_fw = {
        int(r.assigned_to_firewall_id)
        for r in rows
        if r.assigned_to_firewall_id is not None
    }
    fw_labels = _firewall_label_map(db, all_fw)
    needle = (q or "").strip().casefold()
    out_rows: list[IpamPrefix] = []
    for r in rows:
        if needle:
            disp = _assigned_display(r, fw_labels) or ""
            hay = " ".join(
                [
                    r.name or "",
                    r.cidr,
                    r.vrf or "",
                    r.description or "",
                    r.prefix_type or "",
                    disp,
                    r.lease_hostname or "",
                    r.mac_address or "",
                ]
            ).casefold()
            if needle not in hay:
                continue
        out_rows.append(r)
    out_rows.sort(key=lambda r: _ipam_sort_key(r.cidr))
    out: list[dict[str, Any]] = []
    for r in out_rows:
        d = ipam_prefix_to_dict(r, fw_labels)
        attach_ipam_delete_meta(d, r, rows, fw_labels)
        attach_parent_hierarchy_fields(d, r, rows)
        out.append(d)
    return out


def _existing_same_cidr_vrf(
    db: Session,
    *,
    cidr_norm: str,
    vrf_bucket: str,
    exclude_prefix_id: int | None,
) -> IpamPrefix | None:
    q = db.query(IpamPrefix).filter(
        IpamPrefix.cidr == cidr_norm,
        IpamPrefix.vrf_bucket == vrf_bucket,
    )
    if exclude_prefix_id is not None:
        q = q.filter(IpamPrefix.id != exclude_prefix_id)
    return q.first()


def _raise_if_cidr_vrf_taken(
    db: Session,
    *,
    cidr_norm: str,
    vrf_bucket: str,
    exclude_prefix_id: int | None,
) -> None:
    dup = _existing_same_cidr_vrf(
        db,
        cidr_norm=cidr_norm,
        vrf_bucket=vrf_bucket,
        exclude_prefix_id=exclude_prefix_id,
    )
    if dup is None:
        return
    pt = (dup.prefix_type or "assignment").strip() or "assignment"
    label = (dup.name or "").strip() or dup.cidr
    raise IpamDuplicateCidrError(
        f"This exact prefix is already in the saved address plan ({pt} «{label}», id {dup.id}). "
        "Discovered firewall interfaces are not part of the saved plan until you add or accept them "
        "— they do not reserve this CIDR. Remove or edit the conflicting saved row, or choose another CIDR."
    )


def _normalize_lease_hostname_mac(
    lease_hostname: str | None, mac_address: str | None
) -> tuple[str | None, str | None]:
    hn = (lease_hostname or "").strip() or None
    if hn and len(hn) > 255:
        raise ValueError("Host name must be at most 255 characters.")
    mac = (mac_address or "").strip() or None
    if mac and len(mac) > 32:
        raise ValueError("MAC address must be at most 32 characters.")
    return hn, mac


def create_ipam_prefix(
    db: Session,
    *,
    name: str,
    cidr: str,
    vrf: str | None,
    prefix_type: str,
    assigned_to_firewall_id: int | None,
    assigned_to_custom: str | None,
    description: str | None,
    parent_pool_id: int | None = None,
    parent_assignment_id: int | None = None,
    pool_unmanaged: bool = False,
    lease_hostname: str | None = None,
    mac_address: str | None = None,
) -> IpamPrefix:
    nm = _normalize_name(name)
    norm, fam = _normalize_cidr(cidr)
    ptype = (prefix_type or "assignment").strip() or "assignment"
    net = ipaddress.ip_network(norm, strict=False)
    _raise_if_cidr_vrf_taken(
        db,
        cidr_norm=norm,
        vrf_bucket=vrf_key(vrf),
        exclude_prefix_id=None,
    )
    _validate_ipam_write_parents(
        db,
        net=net,
        vrf=vrf,
        ptype_raw=ptype,
        parent_pool_id=parent_pool_id,
        parent_assignment_id=parent_assignment_id,
    )
    afw, acu = _normalize_assignment(
        db, ptype, assigned_to_firewall_id, assigned_to_custom
    )
    vrf_stored = normalize_ipam_prefix_vrf_label(vrf)
    unmanaged_flag = bool(pool_unmanaged) if ptype.casefold() == "pool" else False
    hn, mac = _normalize_lease_hostname_mac(lease_hostname, mac_address)
    row = IpamPrefix(
        name=nm,
        cidr=norm,
        family=fam,
        vrf=vrf_stored,
        vrf_bucket=vrf_key(vrf),
        prefix_type=ptype,
        assigned_to_firewall_id=afw,
        assigned_to_custom=acu,
        description=(description.strip() if description else None) or None,
        pool_unmanaged=unmanaged_flag,
        lease_hostname=hn,
        mac_address=mac,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(row)
    return row


def update_ipam_prefix(
    db: Session,
    prefix_id: int,
    *,
    name: str,
    cidr: str,
    vrf: str | None,
    prefix_type: str,
    assigned_to_firewall_id: int | None,
    assigned_to_custom: str | None,
    description: str | None,
    parent_pool_id: int | None = None,
    parent_assignment_id: int | None = None,
    pool_unmanaged: bool = False,
    lease_hostname: str | None = None,
    mac_address: str | None = None,
) -> IpamPrefix | None:
    row = db.get(IpamPrefix, prefix_id)
    if row is None:
        return None
    nm = _normalize_name(name)
    norm, fam = _normalize_cidr(cidr)
    ptype = (prefix_type or "assignment").strip() or "assignment"
    net = ipaddress.ip_network(norm, strict=False)
    _validate_ipam_write_parents(
        db,
        net=net,
        vrf=vrf,
        ptype_raw=ptype,
        parent_pool_id=parent_pool_id,
        parent_assignment_id=parent_assignment_id,
    )
    _raise_if_cidr_vrf_taken(
        db,
        cidr_norm=norm,
        vrf_bucket=vrf_key(vrf),
        exclude_prefix_id=prefix_id,
    )
    afw, acu = _normalize_assignment(
        db, ptype, assigned_to_firewall_id, assigned_to_custom
    )
    vrf_stored = normalize_ipam_prefix_vrf_label(vrf)
    row.name = nm
    row.cidr = norm
    row.family = fam
    row.vrf = vrf_stored
    row.vrf_bucket = vrf_key(vrf_stored)
    row.prefix_type = ptype
    row.assigned_to_firewall_id = afw
    row.assigned_to_custom = acu
    row.description = (description.strip() if description else None) or None
    row.pool_unmanaged = bool(pool_unmanaged) if ptype.casefold() == "pool" else False
    hn, mac = _normalize_lease_hostname_mac(lease_hostname, mac_address)
    row.lease_hostname = hn
    row.mac_address = mac
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(row)
    return row
