"""Discovered IPv4/IPv6 networks from synced firewall interface-like config cache."""

from __future__ import annotations

import ipaddress
import json
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.dhcp_server_table import iter_static_lease_dicts
from app.firewall_config_sync import ENTITY_DHCP_SERVER, ENTITY_TYPES_INTERFACES_TAB
from app.interface_table import flatten_payload, list_network_cidrs_from_flat
from app.ipam import (
    _ipam_sort_key,
    _normalize_name,
    create_ipam_prefix,
    find_most_specific_containing_pool,
    vrf_key,
)
from app.ipam_vrf import DEFAULT_IPAM_VRF_NAME
from app.models import Firewall, FirewallConfigEntry, IpamPrefix


def _dhcp_xml_text(node: Any) -> str:
    if node is None:
        return ""
    if isinstance(node, dict) and "#text" in node:
        return str(node["#text"]).strip()
    return str(node).strip()


def _ptype_cf_row(row: IpamPrefix) -> str:
    return (row.prefix_type or "").strip().casefold()


def _best_assignment_for_host_ip(
    db: Session, disc_net: ipaddress.IPv4Network | ipaddress.IPv6Network
) -> IpamPrefix | None:
    """Most specific saved assignment (any VRF) that strictly contains *disc_net*."""
    all_rows = db.query(IpamPrefix).all()
    best: IpamPrefix | None = None
    best_pl = -1
    for r in all_rows:
        if _ptype_cf_row(r) != "assignment":
            continue
        try:
            an = ipaddress.ip_network(r.cidr, strict=False)
        except ValueError:
            continue
        if an.version != disc_net.version:
            continue
        if disc_net.subnet_of(an) and disc_net != an:
            if an.prefixlen > best_pl:
                best_pl = an.prefixlen
                best = r
    return best


def _host_ip_already_in_ipam(
    db: Session, disc_net: ipaddress.IPv4Network | ipaddress.IPv6Network
) -> bool:
    for r in db.query(IpamPrefix).all():
        if _ptype_cf_row(r) not in ("assignment", "host"):
            continue
        try:
            an = ipaddress.ip_network(r.cidr, strict=False)
        except ValueError:
            continue
        if an == disc_net:
            return True
    return False


def list_discovered_dhcp_host_payloads(
    db: Session,
    q: str = "",
    firewall_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    """
    Discovered /32 host rows from cached IPv4 DHCP ``StaticLease`` entries
    (see xml-api-docs/Configure/Network/DHCPServer.md). Requires ``dhcp_server`` sync.
    """
    needle = (q or "").strip().casefold()
    fq = (
        db.query(FirewallConfigEntry, Firewall)
        .join(Firewall, FirewallConfigEntry.firewall_id == Firewall.id)
        .filter(FirewallConfigEntry.entity_type == ENTITY_DHCP_SERVER)
    )
    if firewall_ids:
        fq = fq.filter(Firewall.id.in_(firewall_ids))
    out: list[dict[str, Any]] = []
    for ent, fw in fq.all():
        try:
            data = json.loads(ent.payload_json or "{}")
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(data, dict):
            continue
        srv_name = _dhcp_xml_text(data.get("Name")) or (ent.external_name or "").strip()
        for lease in iter_static_lease_dicts(data):
            ip_s = _dhcp_xml_text(lease.get("IPAddress"))
            if not ip_s:
                continue
            try:
                addr = ipaddress.ip_address(ip_s.strip())
            except ValueError:
                continue
            if addr.version != 4:
                continue
            disc_net = ipaddress.ip_network(f"{addr}/32", strict=False)
            cidr_s = str(disc_net)
            if discovered_net_in_unmanaged_pool(db, disc_net):
                continue
            mac = _dhcp_xml_text(lease.get("MACAddress"))
            lhn = _dhcp_xml_text(lease.get("HostName"))
            key = f"dhcp:{int(fw.id)}:{srv_name}:{cidr_s}:{mac}:{lhn}"
            if _host_ip_already_in_ipam(db, disc_net):
                continue
            parent_asg = _best_assignment_for_host_ip(db, disc_net)
            vrf_k = vrf_key(parent_asg.vrf) if parent_asg is not None else "default"
            source_summary = f"DHCP server «{srv_name}» (static lease)"
            display_name = f"Discovered · {_fw_label(fw)} · {lhn or cidr_s}"
            hay = " ".join(
                [
                    display_name,
                    cidr_s,
                    srv_name,
                    lhn,
                    mac,
                    source_summary,
                    _fw_label(fw),
                ]
            ).casefold()
            if needle and needle not in hay:
                continue
            accept_allowed = parent_asg is not None
            out.append(
                {
                    "row_kind": "discovered_dhcp_host",
                    "key": key,
                    "cidr": cidr_s,
                    "family": 4,
                    "firewall_id": int(fw.id),
                    "firewall_label": _fw_label(fw),
                    "dhcp_server_name": srv_name,
                    "lease_hostname": lhn or None,
                    "mac_address": mac or None,
                    "suggested_parent_assignment_id": int(parent_asg.id)
                    if parent_asg is not None
                    else None,
                    "vrf_key": vrf_k,
                    "sources": [
                        {
                            "entity_type": ENTITY_DHCP_SERVER,
                            "external_name": srv_name,
                            "config_entry_id": ent.id,
                        }
                    ],
                    "source_summary": source_summary,
                    "display_name": display_name,
                    "size_label": "1",
                    "has_encompassing_pool": False,
                    "encompassing_pool_cidr": None,
                    "already_in_ipam": False,
                    "overlap_conflict": False,
                    "overlap_with_cidr": None,
                    "accept_allowed": accept_allowed,
                }
            )
    out.sort(key=lambda r: _ipam_sort_key(r["cidr"]))
    return out


def accept_discovered_dhcp_host(
    db: Session,
    *,
    firewall_id: int,
    cidr: str,
    name: str,
    parent_assignment_id: int,
    lease_hostname: str | None,
    mac_address: str | None,
    description: str | None,
) -> IpamPrefix:
    fw = db.get(Firewall, firewall_id)
    if fw is None:
        raise ValueError("Firewall not found")
    disc_net = ipaddress.ip_network(cidr.strip(), strict=False)
    if disc_net.version != 4 or disc_net.prefixlen != 32:
        raise ValueError("Only single IPv4 hosts (/32) can be accepted from DHCP static leases.")
    if discovered_net_in_unmanaged_pool(db, disc_net):
        raise ValueError(
            "This address falls inside an unmanaged pool and cannot be accepted into the address plan."
        )
    if _host_ip_already_in_ipam(db, disc_net):
        raise ValueError("This host address is already recorded in the address plan.")
    asn = db.get(IpamPrefix, int(parent_assignment_id))
    if asn is None or _ptype_cf_row(asn) != "assignment":
        raise ValueError("Invalid parent assignment.")
    try:
        an = ipaddress.ip_network(asn.cidr, strict=False)
    except ValueError as exc:
        raise ValueError("Invalid parent assignment CIDR.") from exc
    if disc_net.version != an.version or not disc_net.subnet_of(an) or disc_net == an:
        raise ValueError("Host must be a strict subnet of the parent assignment.")
    all_rows = db.query(IpamPrefix).all()
    pp = find_most_specific_containing_pool(
        an, vrf_key(asn.vrf), all_rows, exclude_prefix_id=int(asn.id)
    )
    pool_id = int(pp.id) if pp else None
    auto_desc = f"Accepted from DHCP static lease on synced firewall {_fw_label(fw)}."
    desc_final = (description or "").strip() or auto_desc
    name_final = sanitize_ipam_accept_name(name, cidr=str(disc_net), srcs=None)
    return create_ipam_prefix(
        db,
        name=name_final,
        cidr=str(disc_net),
        vrf=asn.vrf,
        prefix_type="host",
        assigned_to_firewall_id=None,
        assigned_to_custom=None,
        description=desc_final,
        parent_pool_id=pool_id,
        parent_assignment_id=int(asn.id),
        lease_hostname=lease_hostname,
        mac_address=mac_address,
    )


def _fw_label(fw: Firewall) -> str:
    return (fw.name or fw.host or str(fw.id)).strip()


def _entity_label(et: str) -> str:
    m = {
        "interface": "Interface",
        "vlan": "VLAN",
        "bridge_pair": "Bridge pair",
        "lag": "LAG",
        "alias": "Alias",
    }
    return m.get((et or "").lower(), et or "Network")


def _size_label_for_net(net: ipaddress.IPv4Network | ipaddress.IPv6Network) -> str:
    n = int(net.num_addresses)
    if net.version == 6 and net.prefixlen < 64:
        return "Large"
    if n <= 65_536:
        return f"{n:,}"
    if n < 10**9:
        return f"{n:,}"
    return "Large"


def _prefix_type_cf(row: IpamPrefix) -> str:
    return (row.prefix_type or "").strip().casefold()


def discovered_net_in_unmanaged_pool(
    db: Session, disc_net: ipaddress.IPv4Network | ipaddress.IPv6Network
) -> bool:
    """True when *disc_net* lies inside any pool marked unmanaged."""
    rows = db.query(IpamPrefix).all()
    for r in rows:
        if _prefix_type_cf(r) != "pool":
            continue
        if not bool(getattr(r, "pool_unmanaged", False)):
            continue
        try:
            pn = ipaddress.ip_network(r.cidr, strict=False)
        except ValueError:
            continue
        if disc_net.version != pn.version:
            continue
        if disc_net.subnet_of(pn):
            return True
    return False


def _load_ipam_classification(
    db: Session,
    disc_net: ipaddress.IPv4Network | ipaddress.IPv6Network,
) -> dict[str, Any]:
    rows = db.query(IpamPrefix).all()
    pools = [r for r in rows if _prefix_type_cf(r) == "pool"]
    assign_like = [r for r in rows if _prefix_type_cf(r) in ("assignment", "host")]
    already = False
    overlap = False
    overlap_cidr: str | None = None
    for a in assign_like:
        an = ipaddress.ip_network(a.cidr, strict=False)
        if an == disc_net:
            already = True
            break
    if not already:
        for a in assign_like:
            an = ipaddress.ip_network(a.cidr, strict=False)
            if an != disc_net and an.overlaps(disc_net):
                overlap = True
                overlap_cidr = a.cidr
                break
    enc: IpamPrefix | None = None
    for p in pools:
        if bool(getattr(p, "pool_unmanaged", False)):
            continue
        pn = ipaddress.ip_network(p.cidr, strict=False)
        if disc_net.version != pn.version:
            continue
        if disc_net.subnet_of(pn):
            enc = p
            break
    return {
        "already_in_ipam": already,
        "overlap_conflict": overlap,
        "overlap_with_cidr": overlap_cidr,
        "has_encompassing_pool": enc is not None,
        "encompassing_pool_cidr": enc.cidr if enc else None,
    }


def _build_discovered_groups(
    db: Session, firewall_ids: list[int] | None
) -> dict[tuple[int, str], list[dict[str, Any]]]:
    grouped: dict[tuple[int, str], list[dict[str, Any]]] = defaultdict(list)
    fq = (
        db.query(FirewallConfigEntry, Firewall)
        .join(Firewall, FirewallConfigEntry.firewall_id == Firewall.id)
        .filter(
            FirewallConfigEntry.entity_type.in_(list(ENTITY_TYPES_INTERFACES_TAB))
        )
    )
    if firewall_ids:
        fq = fq.filter(Firewall.id.in_(firewall_ids))
    for ent, fw in fq.all():
        try:
            data = json.loads(ent.payload_json or "{}")
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(data, dict):
            continue
        flat = flatten_payload(data)
        raw_cidrs = list_network_cidrs_from_flat(
            flat, entity_type=ent.entity_type or ""
        )
        for raw in raw_cidrs:
            try:
                net = ipaddress.ip_network(raw.strip(), strict=False)
            except ValueError:
                continue
            norm = str(net)
            grouped[(int(fw.id), norm)].append(
                {
                    "entity_type": ent.entity_type,
                    "external_name": ent.external_name,
                    "config_entry_id": ent.id,
                }
            )
    return grouped


def _default_accept_name_from_sources(srcs: list[dict[str, Any]], cidr: str) -> str:
    if not srcs:
        return (cidr or "").strip()
    s0 = srcs[0]
    et = _entity_label(str(s0.get("entity_type", "")))
    nm = str(s0.get("external_name", "") or "").strip()
    chunk = f"{et} {nm}".strip()
    return chunk or (cidr or "").strip()


def sanitize_ipam_accept_name(
    raw: str,
    *,
    cidr: str,
    srcs: list[dict[str, Any]] | None = None,
) -> str:
    """Avoid persisting the synthetic list label 'Discovered · …' as the assignment name."""
    t = (raw or "").strip()
    cf = t.casefold()
    if cf.startswith("discovered ·") or cf.startswith("discovered·"):
        return _normalize_name(_default_accept_name_from_sources(srcs or [], cidr))
    return _normalize_name(t)


def build_accept_description_for_discovered(
    fw_label: str, sources: list[dict[str, Any]]
) -> str:
    parts: list[str] = []
    for s in sources:
        et = _entity_label(str(s.get("entity_type", "")))
        nm = str(s.get("external_name", "") or "").strip()
        parts.append(f"{et} {nm}".strip())
    parts = [p for p in parts if p]
    tail = ", ".join(parts) if parts else "synced interface data"
    return f"Accepted from synced config ({fw_label}): {tail}"


def list_discovered_assignment_payloads(
    db: Session,
    q: str = "",
    firewall_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    needle = (q or "").strip().casefold()
    grouped = _build_discovered_groups(db, firewall_ids)
    out: list[dict[str, Any]] = []
    for (fw_id, cidr_s), srcs in grouped.items():
        fw = db.get(Firewall, fw_id)
        if fw is None:
            continue
        try:
            disc_net = ipaddress.ip_network(cidr_s, strict=False)
        except ValueError:
            continue
        if discovered_net_in_unmanaged_pool(db, disc_net):
            continue
        cls = _load_ipam_classification(db, disc_net)
        if cls["already_in_ipam"]:
            continue
        src_parts = [
            f"{_entity_label(s['entity_type'])} {s['external_name']}"
            for s in sorted(srcs, key=lambda x: (x["entity_type"], x["external_name"]))
        ]
        source_summary = ", ".join(src_parts)
        display_name = f"Discovered · {_fw_label(fw)}"
        hay = " ".join(
            [
                display_name,
                cidr_s,
                source_summary,
                _fw_label(fw),
            ]
        ).casefold()
        if needle and needle not in hay:
            continue
        accept_allowed = (
            not cls["already_in_ipam"]
            and not cls["overlap_conflict"]
        )
        out.append(
            {
                "row_kind": "discovered",
                "key": f"{fw_id}:{cidr_s}",
                "cidr": cidr_s,
                "family": 6 if disc_net.version == 6 else 4,
                "firewall_id": fw_id,
                "firewall_label": _fw_label(fw),
                "sources": srcs,
                "source_summary": source_summary,
                "display_name": display_name,
                "size_label": _size_label_for_net(disc_net),
                "has_encompassing_pool": cls["has_encompassing_pool"],
                "encompassing_pool_cidr": cls["encompassing_pool_cidr"],
                "already_in_ipam": cls["already_in_ipam"],
                "overlap_conflict": cls["overlap_conflict"],
                "overlap_with_cidr": cls["overlap_with_cidr"],
                "accept_allowed": accept_allowed,
            }
        )

    out.sort(key=lambda r: _ipam_sort_key(r["cidr"]))
    return out


def accept_discovered_assignment(
    db: Session,
    *,
    firewall_id: int,
    cidr: str,
    name: str,
    assigned_to_firewall_id: int | None,
    assigned_to_custom: str | None,
    pool_cidr: str | None,
    pool_name: str | None,
    description: str | None,
) -> IpamPrefix:
    fw = db.get(Firewall, firewall_id)
    if fw is None:
        raise ValueError("Firewall not found")
    disc_net = ipaddress.ip_network(cidr.strip(), strict=False)
    if discovered_net_in_unmanaged_pool(db, disc_net):
        raise ValueError(
            "This network falls inside an unmanaged pool and cannot be accepted into the address plan."
        )
    cls = _load_ipam_classification(db, disc_net)
    if cls["already_in_ipam"]:
        raise ValueError("This network is already recorded in the address plan.")
    if cls["overlap_conflict"]:
        oc = cls["overlap_with_cidr"] or "?"
        raise ValueError(
            f"This network overlaps an existing assignment ({oc}). "
            "Resolve the conflict before accepting."
        )
    from app.ipam_conflicts import vrf_assignment_conflict_maps

    _, disc_keys = vrf_assignment_conflict_maps(db)
    dkey = f"{int(firewall_id)}:{str(disc_net)}"
    if dkey in disc_keys:
        raise ValueError(
            "This network overlaps another assignment in the same VRF "
            "(including another discovered row). Resolve the conflict before accepting."
        )
    grouped = _build_discovered_groups(db, [firewall_id])
    srcs = grouped.get((firewall_id, str(disc_net)), [])
    auto_desc = build_accept_description_for_discovered(_fw_label(fw), srcs)
    desc_final = (description or "").strip() or auto_desc
    name_final = sanitize_ipam_accept_name(
        name, cidr=str(disc_net), srcs=srcs
    )

    if cls["has_encompassing_pool"]:
        if pool_cidr and str(pool_cidr).strip():
            pool_net = ipaddress.ip_network(pool_cidr.strip(), strict=False)
            if disc_net.version != pool_net.version:
                raise ValueError("Pool must be the same IP family as the assignment.")
            if not disc_net.subnet_of(pool_net):
                raise ValueError("Pool CIDR does not encompass this assignment.")
            pn_s = str(pool_net)
            pname = (pool_name or "").strip() or f"Pool {pn_s}"
            pool_row = _get_or_create_pool(db, pn_s, pname)
        else:
            enc_cidr = cls.get("encompassing_pool_cidr")
            if not enc_cidr:
                raise ValueError("No encompassing pool found for this prefix.")
            pool_row = (
                db.query(IpamPrefix)
                .filter(
                    IpamPrefix.cidr == str(enc_cidr),
                    IpamPrefix.prefix_type == "pool",
                )
                .first()
            )
            if pool_row is None:
                raise ValueError("Encompassing pool row is missing from the address plan.")
    else:
        if not pool_cidr or not str(pool_cidr).strip():
            raise ValueError(
                "POOL_REQUIRED: No encompassing pool exists. "
                "Create a pool that contains this network."
            )
        pool_net = ipaddress.ip_network(pool_cidr.strip(), strict=False)
        if disc_net.version != pool_net.version:
            raise ValueError("Pool must be the same IP family as the assignment.")
        if not disc_net.subnet_of(pool_net):
            raise ValueError("Pool CIDR does not encompass this assignment.")
        pn_s = str(pool_net)
        pname = (pool_name or "").strip() or f"Pool {pn_s}"
        pool_row = _get_or_create_pool(db, pn_s, pname)

    return create_ipam_prefix(
        db,
        name=name_final,
        cidr=str(disc_net),
        vrf=_pool_row_effective_vrf_label(pool_row),
        prefix_type="assignment",
        assigned_to_firewall_id=assigned_to_firewall_id,
        assigned_to_custom=assigned_to_custom,
        description=desc_final,
        parent_pool_id=int(pool_row.id),
        parent_assignment_id=None,
    )


def _pool_row_effective_vrf_label(row: IpamPrefix) -> str:
    s = (row.vrf or "").strip()
    return s if s else DEFAULT_IPAM_VRF_NAME


def _get_or_create_pool(
    db: Session,
    pool_cidr_norm: str,
    pool_name: str,
    *,
    vrf: str | None = None,
) -> IpamPrefix:
    existing = (
        db.query(IpamPrefix)
        .filter(
            IpamPrefix.cidr == pool_cidr_norm,
            IpamPrefix.prefix_type == "pool",
        )
        .first()
    )
    if existing:
        return existing
    vr = (vrf or "").strip() or DEFAULT_IPAM_VRF_NAME
    return create_ipam_prefix(
        db,
        name=pool_name,
        cidr=pool_cidr_norm,
        vrf=vr,
        prefix_type="pool",
        assigned_to_firewall_id=None,
        assigned_to_custom=None,
        description="Pool created when accepting a discovered assignment",
    )
