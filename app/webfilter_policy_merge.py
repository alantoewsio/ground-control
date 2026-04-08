"""Build WebFilterPolicy task payloads (Sophos XML-shaped dicts) from client JSON."""

from __future__ import annotations

import copy
import json
from typing import Any

WFP_CATEGORY_TYPES = frozenset(
    {"WebCategory", "URLGroup", "UserActivity", "DynamicCategory", "FileType"}
)
WFP_HTTP_ACTIONS = frozenset({"Deny", "Allow", "Warn", "Log", "Quota"})
WFP_DEFAULT_ACTIONS = frozenset({"Allow", "Deny"})
WFP_REPORTING = frozenset({"Enable", "Disable"})


def _list_wrap(v: Any) -> list[Any]:
    if v is None:
        return []
    if isinstance(v, list):
        return v
    return [v]


def normalize_webfilter_policy_payload(raw: dict[str, Any]) -> dict[str, Any]:
    """Ensure RuleList.Rule and nested lists are JSON-friendly lists."""
    out = copy.deepcopy(raw) if isinstance(raw, dict) else {}
    if "@transactionid" in out:
        del out["@transactionid"]
    rl = out.get("RuleList")
    if not isinstance(rl, dict):
        out["RuleList"] = {"Rule": []}
        return out
    rule = rl.get("Rule")
    if rule is None:
        rl["Rule"] = []
    elif isinstance(rule, dict):
        rl["Rule"] = [rule]
    elif isinstance(rule, list):
        rl["Rule"] = [r for r in rule if isinstance(r, dict)]
    else:
        rl["Rule"] = []
    for r in rl["Rule"]:
        if not isinstance(r, dict):
            continue
        cl = r.get("CategoryList")
        if isinstance(cl, dict):
            cat = cl.get("Category")
            if cat is None:
                cl["Category"] = []
            elif isinstance(cat, dict):
                cl["Category"] = [cat]
            elif isinstance(cat, list):
                cl["Category"] = [c for c in cat if isinstance(c, dict)]
            else:
                cl["Category"] = []
        ul = r.get("UserList")
        if isinstance(ul, dict):
            u = ul.get("User")
            if u is None:
                ul["User"] = []
            elif isinstance(u, str):
                ul["User"] = [u] if u.strip() else []
            elif isinstance(u, list):
                ul["User"] = [str(x).strip() for x in u if str(x).strip()]
            else:
                ul["User"] = []
        ccl = r.get("CCLList")
        if isinstance(ccl, dict):
            c = ccl.get("CCL")
            if c is None:
                ccl["CCL"] = []
            elif isinstance(c, str):
                ccl["CCL"] = [c] if c.strip() else []
            elif isinstance(c, list):
                ccl["CCL"] = [str(x).strip() for x in c if str(x).strip()]
            else:
                ccl["CCL"] = []
        if "ExceptionList" not in r:
            r["ExceptionList"] = {"FileTypeCategory": None}
    return out


def _categories_for_rule(rule: dict[str, Any]) -> dict[str, Any]:
    cats_in = rule.get("categories")
    if not isinstance(cats_in, list):
        cats_in = []
    built: list[dict[str, str]] = []
    for c in cats_in:
        if not isinstance(c, dict):
            continue
        cid = str(c.get("id") or c.get("ID") or "").strip()
        if not cid:
            continue
        typ = str(c.get("type") or c.get("Type") or "WebCategory").strip()
        if typ not in WFP_CATEGORY_TYPES:
            typ = "WebCategory"
        built.append({"ID": cid, "type": typ})
    if not built:
        built.append({"ID": "General", "type": "WebCategory"})
    if len(built) == 1:
        return {"Category": built[0]}
    return {"Category": built}


def _user_list(rule: dict[str, Any]) -> dict[str, Any] | None:
    users = rule.get("users")
    if not isinstance(users, list):
        users = _list_wrap(users)
    names = [str(u).strip() for u in users if str(u).strip()]
    if not names:
        return None
    if len(names) == 1:
        return {"User": names[0]}
    return {"User": names}


def _ccl_list(rule: dict[str, Any]) -> dict[str, Any] | None:
    ccls = rule.get("ccls")
    if not isinstance(ccls, list):
        ccls = _list_wrap(ccls)
    names = [str(x).strip() for x in ccls if str(x).strip()]
    if not names:
        return None
    if len(names) == 1:
        return {"CCL": names[0]}
    return {"CCL": names}


def _coerce_rule(rule: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {
        "CategoryList": _categories_for_rule(rule),
        "HTTPAction": "Allow",
        "HTTPSAction": "Allow",
        "FollowHTTPAction": "1",
        "Schedule": "All The Time",
        "PolicyRuleEnabled": "1",
        "CCLRuleEnabled": "0",
        "ExceptionList": {"FileTypeCategory": None},
    }
    ha = str(rule.get("http_action") or rule.get("HTTPAction") or "Allow").strip()
    out["HTTPAction"] = ha if ha in WFP_HTTP_ACTIONS else "Allow"
    hsa = str(rule.get("https_action") or rule.get("HTTPSAction") or "Allow").strip()
    out["HTTPSAction"] = hsa if hsa in WFP_HTTP_ACTIONS else "Allow"
    fh = str(rule.get("follow_http_action") or rule.get("FollowHTTPAction") or "1").strip()
    out["FollowHTTPAction"] = "1" if fh in ("1", "true", "True", "yes") else "0"
    out["Schedule"] = str(rule.get("schedule") or rule.get("Schedule") or "All The Time").strip() or "All The Time"
    pe = str(rule.get("policy_rule_enabled") or rule.get("PolicyRuleEnabled") or "1").strip()
    out["PolicyRuleEnabled"] = "1" if pe not in ("0", "false", "False", "no", "disabled") else "0"
    ce = str(rule.get("ccl_rule_enabled") or rule.get("CCLRuleEnabled") or "0").strip()
    out["CCLRuleEnabled"] = "1" if ce in ("1", "true", "True", "yes", "enabled") else "0"
    ul = _user_list(rule)
    if ul:
        out["UserList"] = ul
    ccl = _ccl_list(rule)
    if ccl:
        out["CCLList"] = ccl
    return out


def _bin01(v: Any, default: str = "0") -> str:
    s = str(v if v is not None else "").strip().lower()
    if s in ("1", "true", "yes", "on", "enable", "enabled"):
        return "1"
    if s in ("0", "false", "no", "off", "disable", "disabled", ""):
        return "0"
    return default


def policy_from_client_dict(data: dict[str, Any]) -> dict[str, Any]:
    name = str(data.get("Name") or "").strip()
    if not name:
        raise ValueError("Policy name is required")
    desc = str(data.get("Description") or "").strip()
    da = str(data.get("DefaultAction") or "Allow").strip()
    if da not in WFP_DEFAULT_ACTIONS:
        da = "Allow"
    rep = str(data.get("EnableReporting") or "Enable").strip()
    if rep not in WFP_REPORTING:
        rep = "Enable"
    quota = str(data.get("QuotaLimit") or "60").strip()
    try:
        qn = int(quota, 10)
        qn = max(1, min(1440, qn))
        quota = str(qn)
    except ValueError:
        quota = "60"

    rules_in = data.get("rules")
    if not isinstance(rules_in, list) or not rules_in:
        rules_in = [{}]
    rules_out = [_coerce_rule(r) if isinstance(r, dict) else _coerce_rule({}) for r in rules_in]
    if not rules_out:
        rules_out = [_coerce_rule({})]

    out: dict[str, Any] = {
        "Name": name,
        "Description": desc,
        "DefaultAction": da,
        "EnableReporting": rep,
        "QuotaLimit": quota,
        "DownloadFileSizeRestrictionEnabled": _bin01(
            data.get("DownloadFileSizeRestrictionEnabled"), "0"
        ),
        "DownloadFileSizeRestriction": str(
            data.get("DownloadFileSizeRestriction") or "300"
        ).strip()
        or "300",
        "GoogAppDomainListEnabled": _bin01(data.get("GoogAppDomainListEnabled"), "0"),
        "GoogAppDomainList": str(data.get("GoogAppDomainList") or "").strip() or None,
        "YoutubeFilterEnabled": _bin01(data.get("YoutubeFilterEnabled"), "0"),
        "YoutubeFilterIsStrict": _bin01(data.get("YoutubeFilterIsStrict"), "0"),
        "EnforceSafeSearch": _bin01(data.get("EnforceSafeSearch"), "0"),
        "EnforceImageLicensing": _bin01(data.get("EnforceImageLicensing"), "0"),
        "XFFEnabled": _bin01(data.get("XFFEnabled"), "0"),
        "Office365Enabled": _bin01(data.get("Office365Enabled"), "0"),
        "Office365TenantsList": str(data.get("Office365TenantsList") or "").strip() or None,
        "Office365DirectoryId": str(data.get("Office365DirectoryId") or "").strip() or None,
        "RuleList": {"Rule": rules_out},
    }
    return normalize_webfilter_policy_payload(out)


def default_policy_for_create() -> dict[str, Any]:
    return normalize_webfilter_policy_payload(
        {
            "Name": "",
            "Description": "",
            "DefaultAction": "Allow",
            "EnableReporting": "Enable",
            "QuotaLimit": "60",
            "DownloadFileSizeRestrictionEnabled": "0",
            "DownloadFileSizeRestriction": "300",
            "GoogAppDomainListEnabled": "0",
            "YoutubeFilterEnabled": "0",
            "YoutubeFilterIsStrict": "0",
            "EnforceSafeSearch": "0",
            "EnforceImageLicensing": "0",
            "XFFEnabled": "0",
            "Office365Enabled": "0",
            "RuleList": {
                "Rule": [
                    {
                        "CategoryList": {"Category": {"ID": "General", "type": "WebCategory"}},
                        "HTTPAction": "Allow",
                        "HTTPSAction": "Allow",
                        "FollowHTTPAction": "1",
                        "Schedule": "All The Time",
                        "PolicyRuleEnabled": "1",
                        "CCLRuleEnabled": "0",
                        "ExceptionList": {"FileTypeCategory": None},
                    }
                ]
            },
        }
    )


def task_payload_for_wfp_update(entry_payload: dict[str, Any], client: dict[str, Any]) -> dict[str, Any]:
    built = policy_from_client_dict(client)
    base_name = str(entry_payload.get("Name") or "").strip()
    if base_name and str(built.get("Name") or "").strip() != base_name:
        built["Name"] = base_name
    return built


def wfp_canonical_json(pol: dict[str, Any]) -> str:
    """Stable JSON for drift compare (drops transaction id)."""
    n = normalize_webfilter_policy_payload(pol)
    return json.dumps(n, sort_keys=True, separators=(",", ":"), default=str)
