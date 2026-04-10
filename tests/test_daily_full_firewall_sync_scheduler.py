"""Daily scheduled full config-sync (parallel workers, non-test firewalls)."""

from __future__ import annotations

from unittest import mock

from app.models import Firewall
from app.monitor_scheduler import run_daily_full_firewall_config_sync_job


@mock.patch("app.monitor_scheduler.run_firewall_config_sync")
def test_daily_full_sync_skipped_under_pytest(mock_run) -> None:
    assert run_daily_full_firewall_config_sync_job() == 0
    mock_run.assert_not_called()


@mock.patch("app.monitor_scheduler.run_firewall_config_sync")
@mock.patch("app.monitor_scheduler.config.under_pytest", return_value=False)
@mock.patch("app.monitor_scheduler.config.daily_full_firewall_sync_enabled", return_value=False)
def test_daily_full_sync_disabled(mock_enabled, mock_pytest, mock_run) -> None:
    assert run_daily_full_firewall_config_sync_job() == 0
    mock_run.assert_not_called()


@mock.patch("app.monitor_scheduler.run_firewall_config_sync")
@mock.patch("app.monitor_scheduler.config.under_pytest", return_value=False)
@mock.patch("app.monitor_scheduler.config.daily_full_firewall_sync_max_workers", return_value=4)
def test_daily_full_sync_runs_for_each_non_test_firewall(
    mock_workers, mock_pytest, mock_run, main_session
) -> None:
    mock_run.return_value = {"ok": True}
    baseline = (
        main_session.query(Firewall)
        .filter(Firewall.is_test.is_(False))
        .count()
    )
    for i in range(3):
        main_session.add(
            Firewall(host=f"10.0.1.{i}", port=4444, username="u", is_test=False)
        )
    main_session.add(
        Firewall(host="10.0.9.1", port=4444, username="t", is_test=True)
    )
    main_session.commit()

    n = run_daily_full_firewall_config_sync_job()
    assert n == baseline + 3
    assert mock_run.call_count == baseline + 3
    for call in mock_run.call_args_list:
        kwargs = call.kwargs
        assert kwargs.get("entities_explicit") is True
        ent = kwargs.get("entities")
        assert isinstance(ent, list) and len(ent) > 3
