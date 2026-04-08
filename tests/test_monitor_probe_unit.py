"""Tests for ``app.monitor_probe``."""

from __future__ import annotations

from unittest.mock import patch

from app.monitor_probe import ProbeResult, tcp_connect_ms


def test_probe_result_dataclass():
    p = ProbeResult(1, 12.5, None)
    assert p.firewall_id == 1 and p.response_ms == 12.5


def test_tcp_connect_ms_success():
    from contextlib import contextmanager

    @contextmanager
    def fake_conn(*a, **kw):
        yield None

    with patch("socket.create_connection", fake_conn):
        ms, err = tcp_connect_ms("127.0.0.1", 443, timeout_sec=1.0)
        assert err is None
        assert ms is not None


def test_tcp_connect_ms_failure():
    with patch("socket.create_connection", side_effect=OSError("refused")):
        ms, err = tcp_connect_ms("127.0.0.1", 1, timeout_sec=0.1)
        assert ms is None
        assert err is not None
