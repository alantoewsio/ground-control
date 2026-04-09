"""Apply NetFlowConfiguration changes via Sophos XML API.

``sophosfirewall_python.APIClient.update`` indexes ``resp["Response"][xml_tag]`` with a fixed tag
name and runs ``_error_check`` on the Set response. Appliances may return ``NetflowConfiguration``
(casing) in GET responses, and Set responses may omit the entity block (login-only XML). This
module GETs with tag fallbacks, merges using the response's actual key, and submits via
``submit_xml`` so the Set response is validated like other Set operations.
"""

from __future__ import annotations

from typing import Any

import xmltodict
from sophosfirewall_python.api_client import SophosFirewallAPIError, SophosFirewallZeroRecords
from sophosfirewall_python.firewallapi import SophosFirewall


def _response_netflow_tag_and_block(parsed: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    r = parsed.get("Response") if isinstance(parsed, dict) else None
    if not isinstance(r, dict):
        return "NetFlowConfiguration", {}
    for k, v in r.items():
        if isinstance(k, str) and k.casefold() == "netflowconfiguration":
            if isinstance(v, dict):
                return k, dict(v)
            return k, {}
    return "NetFlowConfiguration", {}


def apply_netflow_configuration_set(fw: SophosFirewall, update_params: dict[str, Any]) -> dict:
    """
    Merge ``update_params`` into the current Netflow snapshot and ``Set operation="update"``.

    ``update_params`` is the task payload (typically ``Server`` list plus optional status keys).
    """
    last_err: SophosFirewallAPIError | None = None
    unparse_tag = "NetFlowConfiguration"
    base_block: dict[str, Any] = {}
    got = False
    saw_zero = False
    for tag in ("NetFlowConfiguration", "NetflowConfiguration"):
        try:
            parsed = fw.get_tag(tag)
        except SophosFirewallZeroRecords:
            saw_zero = True
            unparse_tag = tag
            base_block = {}
            continue
        except SophosFirewallAPIError as exc:
            last_err = exc
            continue
        unparse_tag, base_block = _response_netflow_tag_and_block(
            parsed if isinstance(parsed, dict) else {}
        )
        got = True
        break
    if not got:
        if saw_zero:
            base_block = {}
            got = True
        elif last_err is not None:
            raise last_err
        else:
            raise SophosFirewallAPIError("NetFlow configuration GET failed for all known XML tags.")

    merged_block: dict[str, Any] = {**base_block}
    for k, v in update_params.items():
        if str(k).startswith("@") or k == "__gc_op":
            continue
        merged_block[k] = v

    xml_update_body = xmltodict.unparse({unparse_tag: merged_block}, pretty=True).lstrip(
        '<?xml version="1.0" encoding="utf-8"?>'
    )
    return fw.submit_xml(xml_update_body, set_operation="update")
