"""Docker runtime: secrets hydration and persisted settings merge."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from app import docker_runtime
from app import security_settings


@pytest.fixture
def persist_tmp(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("GROUND_CONTROL_PERSIST_DIR", str(tmp_path))
    monkeypatch.setenv("GROUND_CONTROL_UNDER_PYTEST", "1")
    security_settings.invalidate_security_ui_state_cache()
    yield tmp_path
    security_settings.invalidate_security_ui_state_cache()


def test_bundle_fingerprint_triggers_security_merge(persist_tmp: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GROUND_CONTROL_APPLY_DOCKER_RUNTIME", "1")
    monkeypatch.setenv("GROUND_CONTROL_TLS_HOSTNAMES", "svc.example.test")
    monkeypatch.setenv("PORT", "9090")
    monkeypatch.delenv("GROUND_CONTROL_DOCKER", raising=False)
    docker_runtime.apply_docker_runtime_bundle_from_environment()
    st = security_settings.load_security_ui_state()
    assert "svc.example.test" in st.tls_hostnames
    assert st.http_port == 9090
    fp = (persist_tmp / ".gc_docker_runtime_fingerprint.json").read_text(encoding="utf-8")
    assert "sha256" in json.loads(fp)


def test_bundle_unchanged_skips_rewrite(persist_tmp: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GROUND_CONTROL_APPLY_DOCKER_RUNTIME", "1")
    monkeypatch.setenv("GROUND_CONTROL_TLS_HOSTNAMES", "a.example.test")
    docker_runtime.apply_docker_runtime_bundle_from_environment()
    p = persist_tmp / ".gc_security_state.json"
    m1 = p.stat().st_mtime
    docker_runtime.apply_docker_runtime_bundle_from_environment()
    m2 = p.stat().st_mtime
    assert m1 == m2


def test_hydrate_reads_run_secrets(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    secrets_dir = tmp_path / "secrets"
    secrets_dir.mkdir()
    (secrets_dir / "ground_control_http_port").write_text("7777\n", encoding="utf-8")
    monkeypatch.setattr("app.docker_secrets.RUN_SECRETS_DIR", secrets_dir)
    monkeypatch.delenv("PORT", raising=False)
    from app.docker_secrets import hydrate_docker_secrets_into_environ

    hydrate_docker_secrets_into_environ()
    assert os.environ.get("PORT") == "7777"


def test_hydrate_reads_postgres_password_secret(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    secrets_dir = tmp_path / "secrets"
    secrets_dir.mkdir()
    (secrets_dir / "ground_control_postgres_password").write_text("from_secret_file\n", encoding="utf-8")
    monkeypatch.setattr("app.docker_secrets.RUN_SECRETS_DIR", secrets_dir)
    monkeypatch.delenv("GROUND_CONTROL_POSTGRES_PASSWORD", raising=False)
    from app.docker_secrets import hydrate_docker_secrets_into_environ

    hydrate_docker_secrets_into_environ()
    assert os.environ.get("GROUND_CONTROL_POSTGRES_PASSWORD") == "from_secret_file"


def test_docker_postgres_password_value_reads_secret_file_without_hydrate(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    secrets_dir = tmp_path / "secrets"
    secrets_dir.mkdir()
    (secrets_dir / "ground_control_postgres_password").write_text("file_only\n", encoding="utf-8")
    monkeypatch.setattr("app.docker_secrets.RUN_SECRETS_DIR", secrets_dir)
    monkeypatch.delenv("GROUND_CONTROL_POSTGRES_PASSWORD", raising=False)
    from app.docker_secrets import docker_postgres_password_value

    assert docker_postgres_password_value() == "file_only"
