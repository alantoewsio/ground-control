"""Merge client profile-entity flyout fields into cached API-shaped dicts (nested Phase1/Phase2)."""

from __future__ import annotations

import copy
from typing import Any


def merge_profile_entity_payload(base: dict[str, Any], client: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = copy.deepcopy(base) if isinstance(base, dict) else {}
    if not isinstance(client, dict):
        return out
    for k, v in client.items():
        sk = str(k)
        if sk.startswith("__"):
            continue
        if sk in out and isinstance(out[sk], dict) and isinstance(v, dict):
            out[sk] = merge_profile_entity_payload(out[sk], v)
        elif isinstance(v, dict):
            out[sk] = copy.deepcopy(v)
        else:
            out[sk] = v
    return out
