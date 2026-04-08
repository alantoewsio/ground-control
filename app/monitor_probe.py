"""TCP connectivity probe for firewall web admin ports."""

from __future__ import annotations

import socket
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class ProbeResult:
    firewall_id: int
    response_ms: float | None
    error_message: str | None


def tcp_connect_ms(host: str, port: int, *, timeout_sec: float) -> tuple[float | None, str | None]:
    """
    Returns (elapsed_ms, None) on success, or (None, error text) on failure.
    """
    t0 = time.monotonic()
    try:
        with socket.create_connection((host, port), timeout=timeout_sec):
            pass
        elapsed_ms = (time.monotonic() - t0) * 1000.0
        return elapsed_ms, None
    except OSError as exc:
        return None, str(exc) or type(exc).__name__
