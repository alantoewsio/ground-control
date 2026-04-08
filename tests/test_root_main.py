"""Tests for repository root ``main.py``."""

from __future__ import annotations

from unittest.mock import patch


def test_root_main_attribute():
    import main as root_main

    assert callable(root_main.main)


def test_root_main_guard_starts_asyncio_server():
    import runpy
    from pathlib import Path

    def _close_entrypoint_coro(coro):
        coro.close()

    root_main = Path(__file__).resolve().parent.parent / "main.py"
    with patch("app.main.asyncio.run", side_effect=_close_entrypoint_coro) as arun:
        runpy.run_path(str(root_main), run_name="__main__")
        arun.assert_called_once()
