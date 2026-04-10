"""Same-VRF assignment overlap detection (IPAM + discovered) and batch accept helpers."""

from __future__ import annotations

import ipaddress
from collections import defaultdict
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ipam import IpamDuplicateCidrError
from app.ipam_discovered import (
    _build_discovered_groups,
    _load_ipam_classification,
    accept_discovered_assignment,
    discovered_net_in_unmanaged_pool,
    list_discovered_assignment_payloads,
    sanitize_ipam_accept_name,
)
from app.models import IpamPrefix


def normalize_vrf_key(v: str | None) -> str:
    """Match Address Management UI tree key: empty/whitespace → 'default'."""
    s = (v or "").strip()
    return s if s else "default"


def _assignment_nets_conflict(
    a: ipaddress.IPv4Network | ipaddress.IPv6Network,
    b: ipaddress.IPv4Network | ipaddress.IPv6Network,
) -> bool:
    """True when two prefixes overlap in a conflicting way (not strict hierarchy)."""
    if a.version != b.version:
        return False
    if a == b:
        return True
    if not a.overlaps(b):
        return False
    if a.subnet_of(b) or b.subnet_of(a):
        return False
    return True


def vrf_assignment_conflict_maps(db: Session) -> tuple[set[int], set[str]]:
    """
    Rows that participate in a same-VRF assignment conflict.

    Compares IPAM assignment/host prefixes with each other and with discovered
    networks. Discovered VRF is taken from the encompassing pool's VRF when
    present; otherwise 'default'. Pools are excluded from the comparison set.
    """
    rows = db.query(IpamPrefix).all()
    pools_by_cidr: dict[str, IpamPrefix] = {}
    for r in rows:
        if (r.prefix_type or "").strip().casefold() == "pool":
            pools_by_cidr[r.cidr] = r

    ipam_entries: list[tuple[int, ipaddress.IPv4Network | ipaddress.IPv6Network, str]] = []
    for r in rows:
        pt = (r.prefix_type or "").strip().casefold()
        if pt not in ("assignment", "host"):
            continue
        try:
            net = ipaddress.ip_network(r.cidr, strict=False)
        except ValueError:
            continue
        ipam_entries.append((int(r.id), net, normalize_vrf_key(r.vrf)))

    disc_entries: list[tuple[str, ipaddress.IPv4Network | ipaddress.IPv6Network, str]] = []
    grouped = _build_discovered_groups(db, None)
    for (fw_id, cidr_s), _srcs in grouped.items():
        try:
            disc_net = ipaddress.ip_network(cidr_s, strict=False)
        except ValueError:
            continue
        if discovered_net_in_unmanaged_pool(db, disc_net):
            continue
        cls = _load_ipam_classification(db, disc_net)
        if cls["already_in_ipam"]:
            continue
        vrf_key = "default"
        enc = cls.get("encompassing_pool_cidr")
        if cls.get("has_encompassing_pool") and enc:
            pool_row = pools_by_cidr.get(str(enc))
            if pool_row is not None:
                vrf_key = normalize_vrf_key(pool_row.vrf)
        key = f"{int(fw_id)}:{cidr_s}"
        disc_entries.append((key, disc_net, vrf_key))

    from app.ipam_discovered import list_discovered_dhcp_host_payloads

    for dh in list_discovered_dhcp_host_payloads(db, q="", firewall_ids=None):
        if dh.get("already_in_ipam"):
            continue
        try:
            dnet = ipaddress.ip_network(dh["cidr"], strict=False)
        except ValueError:
            continue
        vk = str(dh.get("vrf_key") or "default").strip() or "default"
        disc_entries.append((str(dh.get("key") or ""), dnet, vk))

    buckets: dict[
        str, list[tuple[str, int | str, ipaddress.IPv4Network | ipaddress.IPv6Network]]
    ] = defaultdict(list)
    for iid, net, vk in ipam_entries:
        buckets[vk].append(("ipam", iid, net))
    for dkey, net, vk in disc_entries:
        buckets[vk].append(("disc", dkey, net))

    ipam_conflict: set[int] = set()
    disc_conflict: set[str] = set()
    for lst in buckets.values():
        for i in range(len(lst)):
            k1, id1, n1 = lst[i]
            for j in range(i + 1, len(lst)):
                k2, id2, n2 = lst[j]
                if not _assignment_nets_conflict(n1, n2):
                    continue
                if k1 == "ipam":
                    ipam_conflict.add(int(id1))
                else:
                    disc_conflict.add(str(id1))
                if k2 == "ipam":
                    ipam_conflict.add(int(id2))
                else:
                    disc_conflict.add(str(id2))
    return ipam_conflict, disc_conflict


def accept_all_eligible_discoveries(
    db: Session,
    *,
    firewall_ids: list[int] | None = None,
) -> dict[str, Any]:
    """
    Accept discovered assignments that already sit in an encompassing pool, are
    individually allowed, and have no same-VRF conflict. Processes one row per
    loop pass so the DB stays consistent.
    """
    accepted: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []
    failed_keys: set[str] = set()
    max_rounds = 500
    for _ in range(max_rounds):
        _, disc_conflict_keys = vrf_assignment_conflict_maps(db)
        payloads = list_discovered_assignment_payloads(
            db, q="", firewall_ids=firewall_ids
        )
        cand: dict[str, Any] | None = None
        for p in sorted(payloads, key=lambda x: (x["cidr"], x["key"])):
            if p["key"] in failed_keys:
                continue
            if not p["has_encompassing_pool"]:
                continue
            if not p["accept_allowed"]:
                continue
            if p["key"] in disc_conflict_keys:
                continue
            cand = p
            break
        if cand is None:
            break
        name = sanitize_ipam_accept_name(
            (cand.get("display_name") or cand.get("cidr") or ""),
            cidr=str(cand["cidr"]),
            srcs=list(cand.get("sources") or []),
        )
        try:
            row = accept_discovered_assignment(
                db,
                firewall_id=int(cand["firewall_id"]),
                cidr=str(cand["cidr"]),
                name=name,
                assigned_to_firewall_id=int(cand["firewall_id"]),
                assigned_to_custom=None,
                pool_cidr=None,
                pool_name=None,
                description=None,
            )
        except IpamDuplicateCidrError as exc:
            failed_keys.add(cand["key"])
            skipped.append({"key": cand["key"], "reason": str(exc)})
            continue
        except ValueError as exc:
            failed_keys.add(cand["key"])
            skipped.append({"key": cand["key"], "reason": str(exc)})
            continue
        except IntegrityError as exc:
            db.rollback()
            failed_keys.add(cand["key"])
            skipped.append({"key": cand["key"], "reason": str(exc)})
            continue
        accepted.append(
            {
                "id": int(row.id),
                "cidr": row.cidr,
                "key": cand["key"],
            }
        )
    return {
        "accepted": accepted,
        "skipped": skipped,
        "accepted_count": len(accepted),
    }
