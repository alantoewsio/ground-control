"""Serialize Certbot subprocess runs (one at a time) and expose queue status for the UI."""

from __future__ import annotations

import queue
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, TypeVar

from app import letsencrypt_history

T = TypeVar("T")

_state_lock = threading.Lock()
_job_queue: queue.Queue[tuple | None] | None = None
_worker_thread: threading.Thread | None = None
_current: dict[str, Any] | None = None
_queued: list[dict[str, Any]] = []


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_worker() -> queue.Queue[tuple | None]:
    global _job_queue, _worker_thread
    if _job_queue is not None:
        return _job_queue
    with _state_lock:
        if _job_queue is not None:
            return _job_queue
        _job_queue = queue.Queue()

        def _loop() -> None:
            global _current
            assert _job_queue is not None
            while True:
                item = _job_queue.get()
                if item is None:
                    _job_queue.task_done()
                    break
                box, meta = item
                jid = meta["job_id"]
                try:
                    with _state_lock:
                        _queued[:] = [q for q in _queued if q.get("job_id") != jid]
                        _current = {
                            "job_id": jid,
                            "operation": meta["operation"],
                            "label": meta["label"],
                            "domains": meta["domains"],
                            "requested_by": meta["requested_by"],
                            "dry_run": meta.get("dry_run"),
                            "started_at": _iso_now(),
                            "state": "running",
                        }
                    result = box["fn"]()
                    box["result"] = result
                    box["exc"] = None
                except Exception as exc:
                    box["result"] = None
                    box["exc"] = exc
                finally:
                    with _state_lock:
                        _current = None
                    box["done_event"].set()
                    _job_queue.task_done()

        _worker_thread = threading.Thread(target=_loop, name="gc-certbot-queue", daemon=True)
        _worker_thread.start()
        return _job_queue


def queue_status() -> dict[str, Any]:
    with _state_lock:
        running = dict(_current) if _current else None
        queued = [dict(q) for q in _queued]
    return {"running": running, "queued": queued}


def _record_history(
    *,
    history_kind: str,
    domains: list[str],
    requested_by: str,
    result: Any,
    exc: BaseException | None,
) -> None:
    from app.letsencrypt_service import load_letsencrypt_settings

    st = load_letsencrypt_settings()
    vm = st.validation_method
    if exc is not None:
        letsencrypt_history.append_event(
            operation=history_kind,
            status="error",
            domains=domains,
            requested_by=requested_by,
            validation_method=vm,
            message=str(exc),
            log_excerpt="",
            extra={"error_type": type(exc).__name__},
        )
        return
    if history_kind == "dry_run":
        code, log = result
        ok = int(code) == 0
        letsencrypt_history.append_event(
            operation="dry_run",
            status="success" if ok else "failed",
            domains=domains,
            requested_by=requested_by,
            validation_method=vm,
            exit_code=int(code),
            message="Certbot dry run completed." if ok else f"Certbot exited with code {code}.",
            log_excerpt=log or "",
        )
    elif history_kind == "obtain_certificate":
        ok, msg = result
        success = bool(ok)
        letsencrypt_history.append_event(
            operation="obtain_certificate",
            status="success" if success else "failed",
            domains=domains,
            requested_by=requested_by,
            validation_method=vm,
            exit_code=None,
            message=(msg or "")[:4000],
            log_excerpt=msg if success else (msg or ""),
        )
    elif history_kind == "renew_certificate":
        ok, msg = result
        success = bool(ok)
        letsencrypt_history.append_event(
            operation="renew_certificate",
            status="success" if success else "failed",
            domains=domains,
            requested_by=requested_by,
            validation_method=vm,
            exit_code=None,
            message=(msg or "")[:4000],
            log_excerpt=msg if success else (msg or ""),
        )


def submit(
    fn: Callable[[], T],
    *,
    operation: str,
    label: str,
    domains: list[str],
    requested_by: str,
    history_kind: str,
    dry_run: bool | None = None,
) -> T:
    """Run ``fn`` on the single-worker queue; record history when finished."""
    jq = _ensure_worker()
    done_event = threading.Event()
    box: dict[str, Any] = {"fn": fn, "done_event": done_event, "result": None, "exc": None}
    job_id = str(uuid.uuid4())
    meta = {
        "job_id": job_id,
        "operation": operation,
        "label": label,
        "domains": domains,
        "requested_by": requested_by or "—",
        "dry_run": dry_run,
        "enqueued_at": _iso_now(),
        "state": "queued",
    }
    with _state_lock:
        _queued.append(dict(meta))

    jq.put((box, meta))
    done_event.wait()
    exc = box.get("exc")
    result = box.get("result")
    try:
        _record_history(
            history_kind=history_kind,
            domains=domains,
            requested_by=requested_by or "—",
            result=result,
            exc=exc,
        )
    except Exception:
        pass
    if exc is not None:
        raise exc
    return result  # type: ignore[return-value]
