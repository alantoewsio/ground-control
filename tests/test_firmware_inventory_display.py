from __future__ import annotations

import pytest

from app.firmware_inventory_display import firmware_inventory_cell


@pytest.mark.parametrize(
    ("raw", "text", "title"),
    [
        (None, "—", None),
        ("", "—", None),
        ("   ", "—", None),
        ("SFOS 22.0.0 GA-Build411", "22.0.0", "SFOS 22.0.0 GA-Build411"),
        ("21.5.123", "21.5.123", None),
        ("v21.5.123 beta", "21.5.123", "v21.5.123 beta"),
        ("SFOS 9", "SFOS 9", None),
        ("x" * 50, "x" * 40 + "…", "x" * 50),
    ],
)
def test_firmware_inventory_cell(raw: str | None, text: str, title: str | None) -> None:
    assert firmware_inventory_cell(raw) == (text, title)
