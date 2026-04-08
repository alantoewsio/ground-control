"""Merge IP Host flyout form into cached SFOS IPHost payload (dict)."""

from __future__ import annotations

import copy
from typing import Any, Mapping

_UI_TO_HOST_TYPE = {
    "ip": "IP",
    "network": "Network",
    "iprange": "IPRange",
    "iplist": "IPList",
}

_HOST_TYPE_TO_UI = {v: k for k, v in _UI_TO_HOST_TYPE.items()}


def _blank_to_none(s: str) -> str | None:
    t = (s or "").strip()
    return None if t == "" else t


def merge_ip_host_flyout_form(base: dict[str, Any], form: Mapping[str, Any]) -> dict[str, Any]:
    """
    Deep-copy ``base`` (cached GET) and overlay editable fields from ``form``.

    Form keys (from browser JSON):
      name, description, ip_family (IPv4|IPv6), host_type_ui (ip|network|iprange|iplist),
      ip_address, subnet, start_ip, end_ip, ip_list (comma/newline separated for IP list type),
      host_groups (list of IP host group names).
    """
    out = copy.deepcopy(base)
    if not isinstance(out, dict):
        raise ValueError("Invalid base payload")

    name = str(form.get("name") or form.get("Name") or "").strip()
    if name:
        out["Name"] = name

    if "description" in form or "Description" in form:
        raw_d = form.get("description") if "description" in form else form.get("Description")
        out["Description"] = _blank_to_none(str(raw_d or ""))

    ipfam = str(form.get("ip_family") or form.get("IPFamily") or "").strip()
    if ipfam in ("IPv4", "IPv6"):
        out["IPFamily"] = ipfam

    ui_kind = str(form.get("host_type_ui") or "").strip().lower()
    if not ui_kind:
        ht0 = str(form.get("HostType") or out.get("HostType") or "").strip()
        ui_kind = str(_HOST_TYPE_TO_UI.get(ht0, "") or "").lower()
    if ui_kind in _UI_TO_HOST_TYPE:
        host_type = _UI_TO_HOST_TYPE[ui_kind]
        out["HostType"] = host_type

        for k in ("IPAddress", "Subnet", "StartIPAddress", "EndIPAddress"):
            out.pop(k, None)

        if host_type == "IP":
            ip = str(form.get("ip_address") or form.get("IPAddress") or "").strip()
            if ip:
                out["IPAddress"] = ip
        elif host_type == "Network":
            ip = str(form.get("ip_address") or form.get("IPAddress") or "").strip()
            if ip:
                out["IPAddress"] = ip
            sub = str(form.get("subnet") or form.get("Subnet") or "").strip()
            if sub:
                out["Subnet"] = sub
        elif host_type == "IPRange":
            s_ip = str(
                form.get("start_ip") or form.get("StartIPAddress") or ""
            ).strip()
            e_ip = str(form.get("end_ip") or form.get("EndIPAddress") or "").strip()
            if s_ip:
                out["StartIPAddress"] = s_ip
            if e_ip:
                out["EndIPAddress"] = e_ip
        elif host_type == "IPList":
            raw = str(form.get("ip_list") or form.get("IPAddress") or "").replace(
                "\n", ","
            )
            parts = [p.strip() for p in raw.split(",") if p.strip()]
            if parts:
                out["IPAddress"] = ", ".join(parts)

    raw_hg = form.get("host_groups")
    if raw_hg is not None:
        if not isinstance(raw_hg, list):
            raw_hg = []
        cleaned = [str(x).strip() for x in raw_hg if str(x).strip()]
        out.pop("HostGroupList", None)
        if cleaned:
            out["HostGroupList"] = [{"HostGroup": n} for n in cleaned]
        elif base:
            # Updates merge into a GET-fetched object; omitting HostGroupList leaves old
            # memberships. Empty list must be sent to clear groups on the firewall.
            out["HostGroupList"] = []

    if (
        str(out.get("HostType") or form.get("HostType") or "").strip() == "System Host"
    ):
        raise ValueError("System host objects cannot be modified")

    return out
