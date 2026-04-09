#!/usr/bin/env python3
"""
Test TCP reachability from inside the Ground Control container (same network path as
monitoring, config sync, WebAdmin proxy, and SSH).

Usage (from project root, while stack is up):
  docker compose exec ground-control python scripts/docker_tcp_probe.py 192.168.1.50 4444
  docker compose exec ground-control python scripts/docker_tcp_probe.py my-fw.example.com 22

If this fails but Test-NetConnection (Windows) or nc from the host succeeds, the problem is
Docker/VPN/WSL routing or name resolution inside the container — not Ground Control logic.
"""

from __future__ import annotations

import argparse
import socket
import sys
import time


def _try_import_effective_host(host: str) -> str:
    try:
        from app.docker_firewall_egress import docker_firewall_tcp_host

        return docker_firewall_tcp_host(host)
    except Exception:
        return host


def main() -> int:
    p = argparse.ArgumentParser(description="TCP probe from container to firewall host:port")
    p.add_argument("host", help="Inventory hostname or IP (e.g. 192.168.1.10 or fw.lab)")
    p.add_argument("port", type=int, help="TCP port (e.g. 4444 web admin, 22 SSH)")
    p.add_argument(
        "--apply-docker-loopback-remap",
        action="store_true",
        help="Show/connect via GROUND_CONTROL_DOCKER_EGRESS_HOST for loopback inventory hosts",
    )
    args = p.parse_args()

    raw_host = (args.host or "").strip()
    port = int(args.port)
    if not raw_host:
        print("error: host is empty", file=sys.stderr)
        return 2

    connect_host = _try_import_effective_host(raw_host) if args.apply_docker_loopback_remap else raw_host
    if connect_host != raw_host:
        print(f"note: loopback remap active: {raw_host!r} -> {connect_host!r}")

    print(f"resolve: {connect_host!r} (port {port})")
    try:
        infos = socket.getaddrinfo(connect_host, port, type=socket.SOCK_STREAM)
        addrs = sorted({x[4][0] for x in infos})
        print(f"dns:     {addrs[:8]!r}{' …' if len(addrs) > 8 else ''}")
    except socket.gaierror as exc:
        print(f"dns:     FAILED ({exc})", file=sys.stderr)
        print(
            "hint:    use a literal IP in firewall inventory if this name only resolves on the host "
            "(e.g. mDNS .local, split-horizon DNS, or hosts-file-only names).",
            file=sys.stderr,
        )
        return 1

    t0 = time.perf_counter()
    try:
        with socket.create_connection((connect_host, port), timeout=10.0):
            pass
    except OSError as exc:
        ms = (time.perf_counter() - t0) * 1000.0
        print(f"tcp:     FAILED after {ms:.0f} ms — {exc}", file=sys.stderr)
        print(
            "hint:    Docker Desktop + VPN/WSL often blocks container-to-LAN traffic; try disconnecting "
            "VPN, use firewall IPs not host-only names, or on Linux try network_mode: host for the "
            "ground-control service (see comments in docker-compose.yml).",
            file=sys.stderr,
        )
        return 1

    ms = (time.perf_counter() - t0) * 1000.0
    print(f"tcp:     OK ({ms:.0f} ms)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
