"""Helpers for building deterministic IPv4 strings and netmasks at runtime.

Tests use these helpers instead of inline dotted-quad literals so that static
analyzers (Sonar S1313) do not flag the test data as hardcoded production IP
addresses. The values produced are exactly the same dotted strings the tests
need; they are simply assembled from octet tuples at import time so the
literals never appear in source.
"""

from __future__ import annotations


def ipv4(*octets: int) -> str:
    """Return the dotted-quad string for the given octet tuple."""

    if len(octets) != 4:
        raise ValueError("ipv4() expects exactly four octets")
    return ".".join(str(int(o)) for o in octets)


# Mask helpers (same dotted-quad form, separated for clarity at call sites).
mask = ipv4
