"""Firewall inventory table: firmware column — show triple numeric version when embedded in longer strings."""
from __future__ import annotations

import re

_TRIPLE_VERSION_RE = re.compile(r"\d+\.\d+\.\d+")


def firmware_inventory_cell(raw: str | None) -> tuple[str, str | None]:
    """Return ``(cell_text, title_or_none)``.

    If ``raw`` contains a ``major.minor.patch`` digit run (e.g. ``22.0.0``, ``21.5.123``),
    that substring is shown; when it differs from the full string, use the full string as tooltip.

    Otherwise show the full value, truncated past 40 characters with an ellipsis; tooltip when truncated.
    """
    if raw is None:
        return ("—", None)
    s = str(raw).strip()
    if not s:
        return ("—", None)
    m = _TRIPLE_VERSION_RE.search(s)
    if m:
        disp = m.group(0)
        return (disp, s if s != disp else None)
    max_len = 40
    if len(s) <= max_len:
        return (s, None)
    return (s[:max_len] + "…", s)
