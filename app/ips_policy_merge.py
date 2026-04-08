"""Build IPS policy task payloads (Sophos XML-shaped dicts) from client JSON."""

from __future__ import annotations

import copy
from typing import Any

from app.ips_policy_constants import (
    IPS_POLICY_ACTIONS,
    IPS_POLICY_RULE_TYPES,
    IPS_POLICY_SIGNATURE_SELECTION,
)
from app.ips_policy_table import normalize_ips_policy_payload


def _list_wrap(v: Any) -> list[Any]:
    if v is None:
        return []
    if isinstance(v, list):
        return v
    return [v]


def _coerce_rule(rule: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    rn = str(rule.get("RuleName") or rule.get("rule_name") or "").strip()
    if not rn:
        rn = "Rule 1"
    out["RuleName"] = rn
    rt = str(rule.get("RuleType") or rule.get("rule_type") or "Default Signature").strip()
    out["RuleType"] = rt if rt in IPS_POLICY_RULE_TYPES else "Default Signature"
    st = str(
        rule.get("SignaturSelectionType")
        or rule.get("signatur_selection_type")
        or rule.get("signature_selection_type")
        or "All Application"
    ).strip()
    out["SignaturSelectionType"] = (
        st if st in IPS_POLICY_SIGNATURE_SELECTION else "All Application"
    )
    act = str(rule.get("Action") or rule.get("action") or "Recommended").strip()
    out["Action"] = act if act in IPS_POLICY_ACTIONS else "Recommended"

    def multi(single_key: str, values: list[str]) -> dict[str, Any]:
        if len(values) == 1:
            return {single_key: values[0]}
        return {single_key: values}

    cats = [str(x).strip() for x in _list_wrap(rule.get("categories")) if str(x).strip()]
    if rule.get("categories_all") is True or (not cats) or cats == ["All"]:
        out["CategoryList"] = {"Category": "All"}
    else:
        out["CategoryList"] = multi("Category", cats)

    sevs = [str(x).strip() for x in _list_wrap(rule.get("severities")) if str(x).strip()]
    if rule.get("severities_all") is True or (not sevs) or sevs == ["All"]:
        out["SeverityList"] = {"Severity": "All"}
    else:
        out["SeverityList"] = multi("Severity", sevs)

    plats = [str(x).strip() for x in _list_wrap(rule.get("platforms")) if str(x).strip()]
    if rule.get("platforms_all") is True or (not plats) or plats == ["All"]:
        out["PlatformList"] = {"Platform": "All"}
    else:
        out["PlatformList"] = multi("Platform", plats)

    tgts = [str(x).strip() for x in _list_wrap(rule.get("targets")) if str(x).strip()]
    if rule.get("targets_all") is True or (not tgts) or tgts == ["All"]:
        out["TargetList"] = {"Target": "All"}
    else:
        out["TargetList"] = multi("Target", tgts)

    if out["SignaturSelectionType"] == "Individual Application":
        sigs = [str(x).strip() for x in _list_wrap(rule.get("signatures")) if str(x).strip()]
        if sigs:
            out["SignatureList"] = (
                {"Signature": sigs[0]} if len(sigs) == 1 else {"Signature": sigs}
            )
    return out


def policy_from_client_dict(data: dict[str, Any]) -> dict[str, Any]:
    """
    Client sends flattened rule fields (categories_all, categories[], …) per rule,
    plus Name, Description, Template.
    """
    name = str(data.get("Name") or "").strip()
    if not name:
        raise ValueError("Policy name is required")
    desc = str(data.get("Description") or "").strip()
    tmpl = str(data.get("Template") or "").strip()
    rules_in = data.get("rules")
    if not isinstance(rules_in, list) or not rules_in:
        rules_in = [{}]
    rules_out: list[dict[str, Any]] = []
    for r in rules_in:
        if not isinstance(r, dict):
            continue
        rules_out.append(_coerce_rule(r))
    if not rules_out:
        rules_out.append(_coerce_rule({}))
    out: dict[str, Any] = {
        "Name": name,
        "Description": desc,
        "RuleList": {"Rule": rules_out},
    }
    if tmpl:
        out["Template"] = tmpl
    return normalize_ips_policy_payload(out)


def default_policy_for_create(firewall_label: str = "") -> dict[str, Any]:
    _ = firewall_label
    return normalize_ips_policy_payload(
        {
            "Name": "",
            "Description": "",
            "Template": "",
            "RuleList": {
                "Rule": [
                    {
                        "RuleName": "Rule 1",
                        "RuleType": "Default Signature",
                        "SignaturSelectionType": "All Application",
                        "CategoryList": {"Category": "All"},
                        "SeverityList": {"Severity": "All"},
                        "PlatformList": {"Platform": "All"},
                        "TargetList": {"Target": "All"},
                        "Action": "Recommended",
                    }
                ]
            },
        }
    )


def task_payload_for_update(entry_payload: dict[str, Any], client: dict[str, Any]) -> dict[str, Any]:
    """Merge server cache with client policy; preserve Name from entry if client omits rename."""
    built = policy_from_client_dict(client)
    base_name = str(entry_payload.get("Name") or "").strip()
    if base_name and built.get("Name") != base_name:
        # Do not allow rename via this path (Sophos uses Name as key)
        built["Name"] = base_name
    return built


def strip_gc_fields(d: dict[str, Any]) -> dict[str, Any]:
    out = {k: v for k, v in d.items() if k != "__gc_op" and not str(k).startswith("@")}
    return copy.deepcopy(out)
