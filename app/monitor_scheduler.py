from __future__ import annotations

import logging
import os
import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func

from app import config
from app.docker_firewall_egress import docker_firewall_tcp_host
from app.database import SessionLocal
from app.models import Firewall
from app.monitor_database import MonitorSessionLocal
from app.monitor_models import FirewallWebadminPing
from app.monitor_probe import ProbeResult, tcp_connect_ms
from app.monitor_rollup import (
    backfill_hourly_rollups,
    run_rollup_for_previous_complete_utc_hour,
    run_rollup_for_previous_utc_day,
)
from app.firewall_config_sync import list_sync_entity_catalog, run_firewall_config_sync
from app.secrets_database import SecretsSessionLocal
from app.tls_certificate_renewal import run_tls_certificate_renewal_job

_log = logging.getLogger(__name__)

_UTC = ZoneInfo("UTC")

_scheduler: BackgroundScheduler | None = None
_scheduler_lock = threading.Lock()

# Cap threads so very large deployments don't create unbounded OS threads.
_MAX_WORKERS_CAP = int(os.environ.get("GROUND_CONTROL_MONITOR_MAX_WORKERS", "512"))


@dataclass(frozen=True)
class _FirewallProbeTarget:
    firewall_id: int
    host: str
    port: int
    is_test: bool


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _firewall_ids_due_for_probe(
    *,
    firewall_rows: list[tuple[int, str, int, int, bool]],
    last_checked_at: dict[int, datetime | None],
    now: datetime,
) -> list[_FirewallProbeTarget]:
    """Return targets whose interval has elapsed since their last ping (or never probed)."""
    targets: list[_FirewallProbeTarget] = []
    for fid, host, port, interval_min, is_test in firewall_rows:
        interval = max(1, int(interval_min))
        last = _as_utc_aware(last_checked_at.get(int(fid)))
        if last is None or (now - last) >= timedelta(minutes=interval):
            targets.append(
                _FirewallProbeTarget(int(fid), str(host), int(port), bool(is_test))
            )
    return targets


def _probe_worker(
    target: _FirewallProbeTarget, *, timeout_sec: float
) -> ProbeResult:
    if target.is_test:
        # Simulate realistic but imperfect probe behavior for synthetic test firewalls.
        if random.random() < 0.2:
            return ProbeResult(target.firewall_id, None, "Simulated probe failure")
        return ProbeResult(target.firewall_id, float(random.randint(20, 200)), None)
    ms, err = tcp_connect_ms(
        docker_firewall_tcp_host(target.host), target.port, timeout_sec=timeout_sec
    )
    return ProbeResult(target.firewall_id, ms, err)


def run_immediate_firewall_webadmin_probe(firewall_id: int) -> bool | None:
    """
    One-off TCP probe for a single firewall (same path as the scheduled monitor).

    When monitoring is enabled, appends a ``FirewallWebadminPing`` row. On TCP success,
    updates ``Firewall.last_online_at`` so inventory online/offline reflects the result.

    Returns:
        ``True`` if TCP connect succeeded, ``False`` if it failed, ``None`` if no firewall row.
    """
    timeout_sec = config.monitor_tcp_timeout_seconds()
    with SessionLocal() as db:
        row = db.get(Firewall, int(firewall_id))
        if not row:
            return None
        target = _FirewallProbeTarget(
            int(row.id),
            str(row.host),
            int(row.port),
            bool(row.is_test),
        )
        monitor_on = bool(row.monitor_enabled)

    pr = _probe_worker(target, timeout_sec=timeout_sec)

    if monitor_on:
        with MonitorSessionLocal() as mdb:
            mdb.add(
                FirewallWebadminPing(
                    firewall_id=pr.firewall_id,
                    response_ms=pr.response_ms,
                    error_message=pr.error_message,
                )
            )
            mdb.commit()

    if pr.response_ms is not None:
        now = _utc_now()
        with SessionLocal() as db2:
            db2.query(Firewall).filter(Firewall.id == int(firewall_id)).update(
                {Firewall.last_online_at: now}, synchronize_session=False
            )
            db2.commit()
        return True
    return False


def _daily_full_sync_one_firewall(firewall_id: int, all_entity_ids: list[str]) -> None:
    db = None
    sdb = None
    try:
        db = SessionLocal()
        sdb = SecretsSessionLocal()
        result = run_firewall_config_sync(
            db,
            sdb,
            firewall_id,
            entities=all_entity_ids,
            entities_explicit=True,
        )
        if result.get("ok") or result.get("skipped"):
            return
        err = result.get("error") or result.get("detail") or result
        _log.warning(
            "Daily full firewall sync failed (firewall_id=%s): %s",
            firewall_id,
            err,
        )
    except Exception:
        _log.exception("Daily full firewall sync raised (firewall_id=%s)", firewall_id)
    finally:
        if sdb is not None:
            sdb.close()
        if db is not None:
            db.close()


def run_daily_full_firewall_config_sync_job() -> int:
    """
    Full catalog config-sync for each non-test firewall, in a thread pool (separate DB sessions per worker).

    Runs on a daily UTC cron. Skipped under pytest, when disabled via config, or when the catalog is empty.
    Returns the number of firewalls queued for sync.
    """
    if config.under_pytest():
        return 0
    if not config.daily_full_firewall_sync_enabled():
        return 0

    catalog = list_sync_entity_catalog()
    all_entity_ids = [x["id"] for x in catalog]
    if not all_entity_ids:
        _log.warning("Daily full firewall sync: empty entity catalog; skipping.")
        return 0

    with SessionLocal() as db:
        fw_ids = [
            int(r[0])
            for r in db.query(Firewall.id)
            .filter(Firewall.is_test.is_(False))
            .order_by(Firewall.id)
            .all()
        ]

    if not fw_ids:
        return 0

    n = len(fw_ids)
    cap = config.daily_full_firewall_sync_max_workers()
    max_workers = min(cap, n, _MAX_WORKERS_CAP)

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [
            pool.submit(_daily_full_sync_one_firewall, fid, all_entity_ids)
            for fid in fw_ids
        ]
        for fut in as_completed(futures):
            try:
                fut.result()
            except Exception:
                _log.exception("Daily full firewall sync worker future failed")

    _log.info(
        "Daily full firewall config sync completed for %s firewall(s) (max_workers=%s).",
        n,
        max_workers,
    )
    return n


def run_history_retention_job() -> None:
    """Daily trim of history tables per Data Management limits (see ``app.history_retention``)."""
    try:
        from app.database import SessionLocal
        from app.history_retention import run_history_retention_sweep

        with SessionLocal() as db:
            run_history_retention_sweep(db)
    except Exception:  # noqa: BLE001
        _log.exception("History retention sweep failed")


def run_webadmin_ping_round() -> int:
    """
    Load monitored firewalls from the app DB, probe TCP ports in a thread pool,
    append rows to the monitor DB. A 1-minute scheduler tick runs this; each
    firewall is probed only when its configured interval has elapsed since the
    last stored ping. Returns number of probes run.
    """
    timeout_sec = config.monitor_tcp_timeout_seconds()
    targets: list[_FirewallProbeTarget] = []
    firewall_rows: list[tuple[int, str, int, int, bool]] = []
    with SessionLocal() as db:
        rows = (
            db.query(
                Firewall.id,
                Firewall.host,
                Firewall.port,
                Firewall.monitor_interval_minutes,
                Firewall.is_test,
            )
            .filter(Firewall.monitor_enabled.is_(True))
            .all()
        )
        firewall_rows = [
            (int(r[0]), str(r[1]), int(r[2]), int(r[3] or 5), bool(r[4] or False))
            for r in rows
        ]

    if not firewall_rows:
        return 0

    last_by_fw: dict[int, datetime | None] = {int(r[0]): None for r in firewall_rows}
    with MonitorSessionLocal() as mdb:
        agg = (
            mdb.query(
                FirewallWebadminPing.firewall_id,
                func.max(FirewallWebadminPing.checked_at),
            )
            .filter(
                FirewallWebadminPing.firewall_id.in_(
                    [r[0] for r in firewall_rows]
                )
            )
            .group_by(FirewallWebadminPing.firewall_id)
            .all()
        )
        for fid, last_at in agg:
            last_by_fw[int(fid)] = last_at

    targets = _firewall_ids_due_for_probe(
        firewall_rows=firewall_rows,
        last_checked_at=last_by_fw,
        now=_utc_now(),
    )

    if not targets:
        return 0

    n = len(targets)
    max_workers = min(_MAX_WORKERS_CAP, max(4, n))
    results: list[ProbeResult] = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futs = {
            pool.submit(_probe_worker, t, timeout_sec=timeout_sec): t for t in targets
        }
        for fut in as_completed(futs):
            try:
                results.append(fut.result())
            except Exception as exc:  # noqa: BLE001
                t = futs[fut]
                results.append(
                    ProbeResult(t.firewall_id, None, f"probe error: {exc}")
                )

    with MonitorSessionLocal() as mdb:
        for pr in results:
            mdb.add(
                FirewallWebadminPing(
                    firewall_id=pr.firewall_id,
                    response_ms=pr.response_ms,
                    error_message=pr.error_message,
                )
            )
        mdb.commit()

    online_ids = [pr.firewall_id for pr in results if pr.response_ms is not None]
    if online_ids:
        from app.db_utils import chunked_ids

        now = _utc_now()
        with SessionLocal() as db:
            for chunk in chunked_ids(online_ids):
                db.query(Firewall).filter(Firewall.id.in_(chunk)).update(
                    {Firewall.last_online_at: now}, synchronize_session=False
                )
            db.commit()

    return len(results)


def start_monitor_scheduler() -> None:
    global _scheduler
    with _scheduler_lock:
        if _scheduler is not None:
            return
        sched = BackgroundScheduler()
        sched.add_job(
            run_webadmin_ping_round,
            "interval",
            minutes=1,
            id="firewall_webadmin_ping",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        sched.add_job(
            run_rollup_for_previous_complete_utc_hour,
            CronTrigger(minute=6, timezone=_UTC),
            id="monitor_rollup_hour",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        sched.add_job(
            run_rollup_for_previous_utc_day,
            CronTrigger(hour=0, minute=25, timezone=_UTC),
            id="monitor_rollup_day",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        sched.add_job(
            run_history_retention_job,
            CronTrigger(hour=4, minute=7, timezone=_UTC),
            id="history_retention_daily",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        sched.add_job(
            run_tls_certificate_renewal_job,
            CronTrigger(hour=3, minute=41, timezone=_UTC),
            id="tls_certificate_auto_renewal",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        _ds_h, _ds_m = config.daily_full_firewall_sync_at_utc()
        sched.add_job(
            run_daily_full_firewall_config_sync_job,
            CronTrigger(hour=_ds_h, minute=_ds_m, timezone=_UTC),
            id="daily_full_firewall_config_sync",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        sched.start()
        _scheduler = sched
        _log.info(
            "Firewall webadmin monitor scheduler started "
            "(1-minute tick; per-firewall probe interval from inventory; "
            "daily history retention at 04:07 UTC; TLS auto-renewal check at 03:41 UTC; "
            "daily full inventory sync at %02d:%02d UTC when enabled).",
            _ds_h,
            _ds_m,
        )

        def _backfill_rollups() -> None:
            try:
                backfill_hourly_rollups(72)
            except Exception:
                _log.exception("Monitor rollup backfill failed")

        threading.Thread(target=_backfill_rollups, daemon=True).start()


def stop_monitor_scheduler() -> None:
    global _scheduler
    with _scheduler_lock:
        if _scheduler is None:
            return
        _scheduler.shutdown(wait=False)
        _scheduler = None
        _log.info("Firewall webadmin monitor scheduler stopped.")
