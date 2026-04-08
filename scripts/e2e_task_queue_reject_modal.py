"""
E2E: open Queued change modal, click Reject, assert the task is removed (Playwright).

Isolated mode (default): temp DBs + uvicorn on 8765 + seeded task.
Live mode: use your running server (e.g. port 8000) and your password.

  uv run python scripts/e2e_task_queue_reject_modal.py
  uv run python scripts/e2e_task_queue_reject_modal.py --live --port 8000 --password "YOUR_PASSWORD"

Requires: uv pip install playwright httpx && uv run python -m playwright install chromium
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ISOLATED_PORT = 8765
BOOTSTRAP_PW = "E2eTestPassw0rd"


def _port_open(port: int, timeout: float = 0.5) -> bool:
    try:
        s = socket.create_connection(("127.0.0.1", port), timeout=timeout)
        s.close()
        return True
    except OSError:
        return False


def _wait_port(port: int, seconds: float = 45) -> bool:
    deadline = time.time() + seconds
    while time.time() < deadline:
        if _port_open(port):
            return True
        time.sleep(0.2)
    return False


def _isolated_env(main: Path, secrets: Path, monitor: Path) -> dict[str, str]:
    e = os.environ.copy()
    e.pop("VIRTUAL_ENV", None)
    e["GROUND_CONTROL_DATABASE_URL"] = f"sqlite:///{main.as_posix()}"
    e["GROUND_CONTROL_SECRETS_DATABASE_URL"] = f"sqlite:///{secrets.as_posix()}"
    e["GROUND_CONTROL_MONITOR_DATABASE_URL"] = f"sqlite:///{monitor.as_posix()}"
    return e


def _seed_task_queue(env: dict[str, str], main_p: Path, sec_p: Path, mon_p: Path) -> None:
    code = r"""
import os
os.environ["GROUND_CONTROL_DATABASE_URL"] = "sqlite:///" + os.environ["GC_MAIN_DB"]
os.environ["GROUND_CONTROL_SECRETS_DATABASE_URL"] = "sqlite:///" + os.environ["GC_SEC_DB"]
os.environ["GROUND_CONTROL_MONITOR_DATABASE_URL"] = "sqlite:///" + os.environ["GC_MON_DB"]
from app.database import SessionLocal
from app.models import Firewall, TaskQueue

db = SessionLocal()
fw = Firewall(
    name="E2E Firewall",
    host="10.254.0.1",
    port=4444,
    username="u",
    verify_ssl=False,
    monitor_enabled=False,
    monitor_interval_minutes=5,
    tags_json="[]",
)
db.add(fw)
db.commit()
db.refresh(fw)
tq = TaskQueue(
    firewall_id=fw.id,
    entity_type="interface",
    external_name="Port2",
    status="pending",
    payload_json='{"AutoNegotiation":"1"}',
)
db.add(tq)
db.commit()
print("ok", tq.id)
db.close()
"""
    env2 = dict(env)
    env2["GC_MAIN_DB"] = str(main_p).replace("\\", "/")
    env2["GC_SEC_DB"] = str(sec_p).replace("\\", "/")
    env2["GC_MON_DB"] = str(mon_p).replace("\\", "/")
    r = subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(ROOT),
        env=env2,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if r.returncode != 0:
        raise RuntimeError(f"seed failed: {r.stderr or r.stdout}")


def _run_playwright_flow(base: str, username: str, password: str) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(base_url=base)
        req = context.request
        r0 = req.post(
            f"{base}/api/auth/login",
            data=json.dumps({"username": username, "password": password}),
            headers={"Content-Type": "application/json"},
        )
        if not r0.ok:
            raise RuntimeError(f"login: {r0.status} {r0.text()}")

        rq = req.get(f"{base}/api/task-queue")
        if not rq.ok:
            raise RuntimeError(f"task-queue: {rq.status} {rq.text()}")
        tasks = rq.json().get("tasks") or []
        if not tasks:
            raise RuntimeError("No tasks in queue; add a task or use isolated mode.")
        task_id = tasks[0]["id"]
        print(f"Using task id={task_id}; opening /task-queue/embed and clicking Reject…")

        page = context.new_page()
        page.goto("/task-queue/embed", wait_until="networkidle", timeout=60000)
        page.wait_for_selector("#task-queue-tbody tr.task-queue-row:not([hidden])", timeout=20000)
        page.locator(f'tr.task-queue-row[data-task-id="{task_id}"] td').nth(2).click()
        page.locator("#task-queue-compare-modal").wait_for(state="visible", timeout=20000)
        page.locator("#task-queue-compare-reject").click()
        page.locator("#task-queue-compare-modal").wait_for(state="hidden", timeout=15000)

        rq2 = req.get(f"{base}/api/task-queue")
        if not rq2.ok:
            raise RuntimeError(f"task-queue after: {rq2.status} {rq2.text()}")
        after = rq2.json().get("tasks") or []
        if any(t.get("id") == task_id for t in after):
            raise RuntimeError(f"task {task_id} still present after Reject: {after}")

        print("PASS: Reject removed the task and closed the modal.")
        browser.close()


def main() -> int:
    try:
        import playwright  # noqa: F401
    except ImportError:
        print(
            "Missing Playwright. Run: uv pip install playwright httpx && uv run python -m playwright install chromium",
            file=sys.stderr,
        )
        return 1

    ap = argparse.ArgumentParser(description="E2E task queue modal Reject")
    ap.add_argument("--live", action="store_true", help="Use running server (no temp DB)")
    ap.add_argument("--port", type=int, default=8000, help="Live mode: server port (default 8000)")
    ap.add_argument("--base-url", default=None, help="Live mode: full origin, e.g. http://127.0.0.1:8000")
    ap.add_argument("--username", default="admin", help="Live mode login username")
    ap.add_argument(
        "--password",
        default=None,
        help="Live mode password (or set GROUND_CONTROL_E2E_PASSWORD)",
    )
    args = ap.parse_args()

    if args.live:
        base = (args.base_url or f"http://127.0.0.1:{args.port}").rstrip("/")
        pw = args.password or os.environ.get("GROUND_CONTROL_E2E_PASSWORD")
        if not pw:
            print("Live mode requires --password or GROUND_CONTROL_E2E_PASSWORD", file=sys.stderr)
            return 1
        if not _port_open(args.port):
            print(f"Nothing listening on 127.0.0.1:{args.port}; start the app first.", file=sys.stderr)
            return 1
        try:
            _run_playwright_flow(base, args.username, pw)
        except Exception as exc:
            print(f"FAIL: {exc}", file=sys.stderr)
            return 1
        return 0

    # —— isolated mode ——
    if _port_open(ISOLATED_PORT):
        print(f"Port {ISOLATED_PORT} is already in use; free it or use --live.", file=sys.stderr)
        return 1

    fd_m, p_m = tempfile.mkstemp(suffix="_e2e_main.db")
    fd_s, p_s = tempfile.mkstemp(suffix="_e2e_secrets.db")
    fd_o, p_o = tempfile.mkstemp(suffix="_e2e_monitor.db")
    for fd in (fd_m, fd_s, fd_o):
        os.close(fd)
    main_p = Path(p_m)
    sec_p = Path(p_s)
    mon_p = Path(p_o)

    env = _isolated_env(main_p, sec_p, mon_p)
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            f"--port={ISOLATED_PORT}",
        ],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{ISOLATED_PORT}"
    try:
        if not _wait_port(ISOLATED_PORT):
            raise RuntimeError("Server did not start")

        import httpx

        with httpx.Client(base_url=base, follow_redirects=True, timeout=30) as h:
            st = h.get("/api/auth/status").json()
            if not st.get("needs_admin_password_setup"):
                raise RuntimeError("Expected fresh secrets DB with needs_admin_password_setup")
            r = h.post(
                "/api/auth/setup-admin-password",
                json={"password": BOOTSTRAP_PW, "password_confirm": BOOTSTRAP_PW},
            )
            r.raise_for_status()

        _seed_task_queue(env, main_p, sec_p, mon_p)
        _run_playwright_flow(base, "admin", BOOTSTRAP_PW)
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()
        for p in (main_p, sec_p, mon_p):
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
