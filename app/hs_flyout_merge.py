"""Merge Hosts & Services flyout forms into cached Sophos JSON payloads (dict)."""

from __future__ import annotations

import copy
import re
from typing import Any, Mapping

_SERVICE_UI_TO_TYPE = {
    "tcpudp": "TCPorUDP",
    "ip": "IP",
    "icmp": "ICMP",
    "icmpv6": "ICMPv6",
}


def _blank_desc(s: str) -> str | None:
    t = (s or "").strip()
    return None if t == "" else t


def _form_str(form: Mapping[str, Any], *keys: str) -> str:
    for k in keys:
        v = form.get(k)
        if v is None:
            continue
        s = str(v).strip()
        if s:
            return s
    return ""


def _overlay_description(out: dict[str, Any], form: Mapping[str, Any]) -> None:
    if "description" in form or "Description" in form:
        raw = form.get("description") if "description" in form else form.get("Description")
        out["Description"] = _blank_desc(str(raw or ""))


_SERVICE_TYPE_TO_UI = {v: k for k, v in _SERVICE_UI_TO_TYPE.items()}

_SVC_FLAT_DETAIL = re.compile(r"^ServiceDetails\.ServiceDetail\.(?:(\d+)\.)?(.+)$")


def _service_detail_rows_from_flat_form(form: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Rebuild flyout-style detail rows from table flatten_payload keys."""
    by_idx: dict[int, dict[str, str]] = {}
    for k, v in form.items():
        if not isinstance(k, str):
            continue
        m = _SVC_FLAT_DETAIL.match(k)
        if not m:
            continue
        idx_s, field = m.group(1), m.group(2)
        if "." in field:
            continue
        idx = int(idx_s) if idx_s is not None else 0
        by_idx.setdefault(idx, {})[field] = str(v) if v is not None else ""
    if not by_idx:
        return []
    rows: list[dict[str, Any]] = []
    for i in sorted(by_idx.keys()):
        d = by_idx[i]
        row: dict[str, Any] = {}
        if "Protocol" in d:
            row["protocol"] = str(d["Protocol"]).strip().lower()
        if "SourcePort" in d:
            row["source_port"] = d["SourcePort"]
        if "DestinationPort" in d:
            row["dest_port"] = d["DestinationPort"]
        if "ProtocolName" in d:
            row["protocol_name"] = d["ProtocolName"]
        if "ICMPType" in d:
            row["icmp_type"] = d["ICMPType"]
        if "ICMPCode" in d:
            row["icmp_code"] = d["ICMPCode"]
        if "ICMPv6Type" in d:
            row["icmp_type"] = d["ICMPv6Type"]
        if "ICMPv6Code" in d:
            row["icmp_code"] = d["ICMPv6Code"]
        rows.append(row)
    return rows


def _split_csv_field(form: Mapping[str, Any], dotted_key: str) -> list[str] | None:
    raw = form.get(dotted_key)
    if raw is None:
        return None
    return [p.strip() for p in str(raw).split(",") if p.strip()]


def merge_fqdn_host_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    fqdn = _form_str(form, "fqdn", "FQDN")
    if fqdn:
        out["FQDN"] = fqdn
    raw_g = form.get("fqdn_host_groups")
    if raw_g is None:
        raw_g = _split_csv_field(form, "FQDNHostGroupList.FQDNHostGroup")
    if raw_g is not None:
        if not isinstance(raw_g, list):
            raw_g = []
        cleaned = [str(x).strip() for x in raw_g if str(x).strip()]
        out.pop("FQDNHostGroupList", None)
        if len(cleaned) == 1:
            out["FQDNHostGroupList"] = {"FQDNHostGroup": cleaned[0]}
        elif len(cleaned) > 1:
            out["FQDNHostGroupList"] = {"FQDNHostGroup": cleaned}
        else:
            out["FQDNHostGroupList"] = None
    return out


def _service_detail_from_row(row: Mapping[str, Any]) -> dict[str, Any]:
    d: dict[str, Any] = {}
    proto = str(row.get("protocol") or "").strip().upper()
    if proto in ("TCP", "UDP"):
        d["Protocol"] = proto
        sp = str(row.get("source_port") or "").strip() or "1:65535"
        dp = str(row.get("dest_port") or "").strip()
        d["SourcePort"] = sp
        if dp:
            d["DestinationPort"] = dp
    return d


def _service_detail_ip_icmp(row: Mapping[str, Any], *, icmpv6: bool) -> dict[str, Any]:
    if icmpv6:
        t = str(row.get("icmp_type") or "").strip()
        c = str(row.get("icmp_code") or "").strip()
        d: dict[str, Any] = {}
        if t:
            d["ICMPType"] = t
        if c:
            d["ICMPCode"] = c
        return d
    pn = str(row.get("protocol_name") or "").strip()
    if pn:
        return {"ProtocolName": pn}
    t = str(row.get("icmp_type") or "").strip()
    c = str(row.get("icmp_code") or "").strip()
    d = {}
    if t:
        d["ICMPType"] = t
    if c:
        d["ICMPCode"] = c
    return d


def merge_service_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    ui = str(form.get("service_type_ui") or "").strip().lower()
    if not ui:
        st_flat = _form_str(form, "Type")
        ui = _SERVICE_TYPE_TO_UI.get(st_flat, "").lower()
    sophos_type = _SERVICE_UI_TO_TYPE.get(ui)
    if sophos_type:
        out["Type"] = sophos_type
    rows = form.get("service_detail_rows")
    if not isinstance(rows, list):
        rows = []
    if not rows:
        rows = _service_detail_rows_from_flat_form(form)
    st = str(out.get("Type") or "").strip()
    details: list[dict[str, Any]] = []
    if st == "TCPorUDP":
        for r in rows:
            if not isinstance(r, dict):
                continue
            one = _service_detail_from_row(r)
            if one:
                details.append(one)
        if not details:
            details.append(
                {"Protocol": "TCP", "SourcePort": "1:65535", "DestinationPort": ""}
            )
    elif st == "IP":
        for r in rows:
            if not isinstance(r, dict):
                continue
            pn = str(r.get("protocol_name") or "").strip()
            if pn:
                details.append({"ProtocolName": pn})
        if not details:
            details.append({"ProtocolName": ""})
    elif st == "ICMP":
        for r in rows:
            if isinstance(r, dict):
                d = _service_detail_ip_icmp(r, icmpv6=False)
                if d:
                    details.append(d)
        if not details:
            details.append({"ICMPType": "", "ICMPCode": "Any Code"})
    elif st == "ICMPv6":
        for r in rows:
            if isinstance(r, dict):
                d = _service_detail_ip_icmp(r, icmpv6=True)
                if d:
                    details.append(d)
        if not details:
            details.append({"ICMPType": "", "ICMPCode": ""})
    if details:
        if len(details) == 1:
            out["ServiceDetails"] = {"ServiceDetail": details[0]}
        else:
            out["ServiceDetails"] = {"ServiceDetail": details}
    return out


def merge_mac_host_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    ui = str(form.get("mac_host_type_ui") or "").strip().lower()
    if not ui:
        mt = _form_str(form, "Type")
        if mt == "MACAddress":
            ui = "macaddress"
        elif mt == "MACList":
            ui = "maclist"
    if ui == "macaddress":
        out["Type"] = "MACAddress"
        out.pop("MACList", None)
        mac = _form_str(form, "mac_address", "MACAddress")
        if mac:
            out["MACAddress"] = mac
        else:
            out.pop("MACAddress", None)
    elif ui == "maclist":
        out["Type"] = "MACList"
        out.pop("MACAddress", None)
        raw = str(form.get("mac_list") or "").replace("\n", ",")
        if not raw.strip():
            csv_m = _split_csv_field(form, "MACList.MAC")
            if csv_m is not None:
                raw = ",".join(csv_m)
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        if parts:
            if len(parts) == 1:
                out["MACList"] = {"MAC": parts[0]}
            else:
                out["MACList"] = {"MAC": parts}
        else:
            out["MACList"] = None
    return out


def merge_ip_hostgroup_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    raw_h = form.get("member_hosts")
    if raw_h is None:
        raw_h = _split_csv_field(form, "HostList.Host")
    if raw_h is not None:
        if not isinstance(raw_h, list):
            raw_h = []
        cleaned = [str(x).strip() for x in raw_h if str(x).strip()]
        out.pop("HostList", None)
        if len(cleaned) == 1:
            out["HostList"] = {"Host": cleaned[0]}
        elif len(cleaned) > 1:
            out["HostList"] = {"Host": cleaned}
    return out


def merge_fqdn_hostgroup_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    raw_h = form.get("member_hosts")
    if raw_h is None:
        raw_h = _split_csv_field(form, "FQDNHostList.FQDNHost")
    if raw_h is not None:
        if not isinstance(raw_h, list):
            raw_h = []
        cleaned = [str(x).strip() for x in raw_h if str(x).strip()]
        out.pop("FQDNHostList", None)
        if len(cleaned) == 1:
            out["FQDNHostList"] = {"FQDNHost": cleaned[0]}
        elif len(cleaned) > 1:
            out["FQDNHostList"] = {"FQDNHost": cleaned}
    return out


def merge_service_group_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    raw_h = form.get("member_services")
    if raw_h is None:
        raw_h = _split_csv_field(form, "ServiceList.Service")
    if raw_h is not None:
        if not isinstance(raw_h, list):
            raw_h = []
        cleaned = [str(x).strip() for x in raw_h if str(x).strip()]
        out.pop("ServiceList", None)
        if len(cleaned) == 1:
            out["ServiceList"] = {"Service": cleaned[0]}
        elif len(cleaned) > 1:
            out["ServiceList"] = {"Service": cleaned}
    return out


def merge_country_group_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")
    name = _form_str(form, "name", "Name")
    if name:
        out["Name"] = name
    _overlay_description(out, form)
    raw_c = form.get("countries")
    if raw_c is None:
        raw_c = _split_csv_field(form, "CountryList.Country")
    if raw_c is not None:
        if not isinstance(raw_c, list):
            raw_c = []
        cleaned = [str(x).strip() for x in raw_c if str(x).strip()]
        out.pop("CountryList", None)
        if len(cleaned) == 1:
            out["CountryList"] = {"Country": cleaned[0]}
        elif len(cleaned) > 1:
            out["CountryList"] = {"Country": cleaned}
    return out
