"""Tests for Certbot serialization queue and LE history persistence."""

from __future__ import annotations

import threading
import time
from types import SimpleNamespace

import pytest

import app.config as config
from app import letsencrypt_history
from app import letsencrypt_queue


@pytest.fixture
def noop_le_history(monkeypatch):
    monkeypatch.setattr("app.letsencrypt_queue.letsencrypt_history.append_event", lambda **k: None)
    monkeypatch.setattr(
        "app.letsencrypt_service.load_letsencrypt_settings",
        lambda: SimpleNamespace(validation_method="http", email="a@example.com", dns_plugin="cloudflare"),
    )


def test_certbot_queue_runs_jobs_sequentially(noop_le_history):
    order: list[str] = []
    lock = threading.Lock()

    def mk(name: str):
        def inner() -> str:
            with lock:
                order.append(f"{name}-enter")
            time.sleep(0.04)
            with lock:
                order.append(f"{name}-leave")
            return name

        return inner

    barrier = threading.Barrier(2)

    def run_tag(tag: str) -> None:
        barrier.wait()
        letsencrypt_queue.submit(
            mk(tag),
            operation="t",
            label=tag,
            domains=[f"{tag}.example.com"],
            requested_by="tester",
            history_kind="dry_run",
            dry_run=True,
        )

    t1 = threading.Thread(target=lambda: run_tag("a"))
    t2 = threading.Thread(target=lambda: run_tag("b"))
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    enter_a = order.index("a-enter")
    leave_a = order.index("a-leave")
    enter_b = order.index("b-enter")
    leave_b = order.index("b-leave")
    assert leave_a >= enter_a and leave_b >= enter_b
    assert enter_b > leave_a or enter_a > leave_b


def test_letsencrypt_history_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "BASE_DIR", tmp_path)
    from app import letsencrypt_service

    letsencrypt_service.invalidate_letsencrypt_cache()
    letsencrypt_history.append_event(
        operation="dry_run",
        status="success",
        domains=["x.example.com"],
        requested_by="alice",
        validation_method="http",
        exit_code=0,
        message="ok",
        log_excerpt="certbot output",
    )
    rows = letsencrypt_history.list_recent(limit=10)
    assert len(rows) == 1
    assert rows[0]["operation"] == "dry_run"
    assert rows[0]["status"] == "success"
    assert "x.example.com" in rows[0]["domains"]
