"""Docker loopback → egress host mapping for firewall connections."""

from __future__ import annotations

import pytest

from app.docker_firewall_egress import docker_firewall_tcp_host


@pytest.fixture
def clear_docker_egress_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GROUND_CONTROL_DOCKER_EGRESS_HOST", raising=False)


def test_not_in_docker_no_substitution(
    monkeypatch: pytest.MonkeyPatch, clear_docker_egress_env
) -> None:
    monkeypatch.setattr(
        "app.docker_firewall_egress.config.in_docker_deployment", lambda: False
    )
    monkeypatch.setenv("GROUND_CONTROL_DOCKER_EGRESS_HOST", "host.docker.internal")
    assert docker_firewall_tcp_host("127.0.0.1") == "127.0.0.1"


def test_in_docker_substitutes_loopback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.docker_firewall_egress.config.in_docker_deployment", lambda: True
    )
    monkeypatch.setenv("GROUND_CONTROL_DOCKER_EGRESS_HOST", "host.docker.internal")
    assert docker_firewall_tcp_host("127.0.0.1") == "host.docker.internal"
    assert docker_firewall_tcp_host("localhost") == "host.docker.internal"
    assert docker_firewall_tcp_host("[::1]") == "host.docker.internal"
    assert docker_firewall_tcp_host("192.168.1.10") == "192.168.1.10"


def test_in_docker_without_egress_env_unchanged(
    monkeypatch: pytest.MonkeyPatch, clear_docker_egress_env
) -> None:
    monkeypatch.setattr(
        "app.docker_firewall_egress.config.in_docker_deployment", lambda: True
    )
    assert docker_firewall_tcp_host("127.0.0.1") == "127.0.0.1"
