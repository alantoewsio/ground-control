"""Merge UI server rows into cached ``NetFlowConfiguration`` payloads (xml-api-docs NetflowConfiguration)."""

from __future__ import annotations

from typing import Any


def _text_scalar(raw: Any) -> str:
    if raw is None:
        return ""
    if isinstance(raw, dict):
        raw = raw.get("#text") if "#text" in raw else raw.get("text")
    return str(raw).strip()


def _as_list(v: Any) -> list[Any]:
    if v is None:
        return []
    if isinstance(v, list):
        return v
    return [v]


def _netflow_servers_from_server_children(root: dict[str, Any]) -> list[dict[str, str]]:
    s = root.get("Server")
    if s is None:
        return []
    if isinstance(s, dict):
        s = [s]
    if not isinstance(s, list):
        return []
    out: list[dict[str, str]] = []
    for row in s:
        if not isinstance(row, dict):
            continue
        name = _text_scalar(row.get("ServerName"))
        if not name:
            name = _text_scalar(row.get("Name"))
        host = _text_scalar(row.get("NetflowServer"))
        port = _text_scalar(row.get("NetflowServerPort"))
        out.append(
            {
                "ServerName": name,
                "NetflowServer": host,
                "NetflowServerPort": port or "2055",
            }
        )
    return out


def _netflow_servers_from_parallel_arrays(root: dict[str, Any]) -> list[dict[str, str]]:
    """
    Sophos docs list ``Name``, ``NetflowServer``, ``NetflowServerPort`` as ARRAY parameters on the
    entity; firmware may expose them as sibling elements instead of a ``Server`` list.
    """
    names = [_text_scalar(x) for x in _as_list(root.get("Name"))]
    hosts = [_text_scalar(x) for x in _as_list(root.get("NetflowServer"))]
    ports = [_text_scalar(x) for x in _as_list(root.get("NetflowServerPort"))]
    if not names and not hosts:
        return []
    n = max(len(names), len(hosts), len(ports) or 0)
    out: list[dict[str, str]] = []
    for i in range(n):
        name = names[i] if i < len(names) else ""
        host = hosts[i] if i < len(hosts) else ""
        port = (ports[i] if i < len(ports) else "") or "2055"
        if not name and not host:
            continue
        out.append(
            {
                "ServerName": name,
                "NetflowServer": host,
                "NetflowServerPort": port,
            }
        )
    return out


def netflow_servers_from_payload(root: dict[str, Any] | None) -> list[dict[str, str]]:
    """Normalize server rows from a cached NetFlowConfiguration dict (``Server`` list and/or ARRAY fields)."""
    if not root or not isinstance(root, dict):
        return []
    out = _netflow_servers_from_server_children(root)
    if out:
        return out
    return _netflow_servers_from_parallel_arrays(root)


def merge_netflow_configuration_payload(
    base: dict[str, Any],
    server_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Build full NetFlowConfiguration dict for queue + API update.

    ``server_rows`` items may use ServerName or Name; empty rows (no name and no host) are skipped.
    """
    merged: dict[str, Any] = dict(base) if isinstance(base, dict) else {}
    servers: list[dict[str, str]] = []
    for raw in server_rows:
        if not isinstance(raw, dict):
            continue
        name = _text_scalar(raw.get("ServerName") or raw.get("Name"))
        host = _text_scalar(raw.get("NetflowServer"))
        port = _text_scalar(raw.get("NetflowServerPort")) or "2055"
        if not name and not host:
            continue
        servers.append(
            {
                "ServerName": name,
                "NetflowServer": host,
                "NetflowServerPort": port,
            }
        )
    merged["Server"] = servers
    return merged
