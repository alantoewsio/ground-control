"""Isolated Ground Control + seed for MCP browser UI checks. Do not rely on for production."""

from __future__ import annotations

import http.cookiejar
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 9777
# Meets validate_new_password; used for API bootstrap then browser login.
BOOTSTRAP_PW = "UiTestPass1234"


def _promote_bootstrap_user_for_designer(secrets_db: Path) -> None:
    """Designer routes require SuperAdmin or Designer role; default bootstrap user is admin."""
    con = sqlite3.connect(str(secrets_db))
    try:
        con.execute(
            "UPDATE app_users SET role = 'SuperAdmin' "
            "WHERE lower(username) = lower('admin')"
        )
        con.commit()
    finally:
        con.close()


def _bootstrap_admin_password(port: int) -> None:
    """First-run admin password (user role is still *admin* until we promote)."""
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    body = json.dumps(
        {"password": BOOTSTRAP_PW, "password_confirm": BOOTSTRAP_PW}
    ).encode()
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/api/auth/setup-admin-password",
        data=body,
        headers={"Content-Type": "application/json", "X-Requested-With": "Ground-Control"},
        method="POST",
    )
    with opener.open(req, timeout=30) as resp:
        if resp.status != 200:
            raise RuntimeError(f"setup-admin-password failed: HTTP {resp.status}")


def main() -> None:
    tmp = Path(tempfile.gettempdir())
    main_db = tmp / "gc_mcp_main.db"
    sec_db = tmp / "gc_mcp_sec.db"
    mon_db = tmp / "gc_mcp_mon.db"
    for p in (main_db, sec_db, mon_db):
        p.unlink(missing_ok=True)

    env = os.environ.copy()
    env.pop("VIRTUAL_ENV", None)
    # Skip HTTP→HTTPS redirect middleware so plain http://127.0.0.1 works for health + browser.
    env["GROUND_CONTROL_UNDER_PYTEST"] = "1"
    env["GROUND_CONTROL_DATABASE_URL"] = "sqlite:///" + main_db.as_posix()
    env["GROUND_CONTROL_SECRETS_DATABASE_URL"] = "sqlite:///" + sec_db.as_posix()
    env["GROUND_CONTROL_MONITOR_DATABASE_URL"] = "sqlite:///" + mon_db.as_posix()

    log_path = tmp / "gc_mcp_uvicorn.log"
    log = open(log_path, "w", encoding="utf-8")
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            f"--port={PORT}",
        ],
        cwd=str(ROOT),
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    (tmp / "gc_mcp_uvicorn.pid").write_text(str(proc.pid), encoding="utf-8")

    deadline = time.time() + 90
    while time.time() < deadline:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/health", timeout=1)
            break
        except OSError:
            time.sleep(0.25)
    else:
        proc.terminate()
        print("Server failed to start; see", log_path, file=sys.stderr)
        sys.exit(1)

    try:
        _bootstrap_admin_password(PORT)
    except Exception as exc:
        proc.terminate()
        print("Bootstrap failed:", exc, file=sys.stderr)
        sys.exit(1)

    _promote_bootstrap_user_for_designer(sec_db)

    seed_code = """
import json
from app.database import SessionLocal
from app.models import Firewall, FirewallConfigEntry

db = SessionLocal()
fw = Firewall(
    name="MCP UI FW",
    host="10.98.0.1",
    port=4444,
    username="u",
    verify_ssl=False,
    monitor_enabled=False,
    tags_json="[]",
)
db.add(fw)
db.commit()
db.refresh(fw)
pl = json.dumps(
    {"Name": "RowHost", "IPFamily": "IPv4", "IPAddress": "192.0.2.77"}
)
db.add(
    FirewallConfigEntry(
        firewall_id=fw.id,
        entity_type="ip_host",
        external_name="RowHost",
        payload_json=pl,
    )
)
db.commit()
fw_id = int(fw.id)
db.close()
print("ok", fw_id)
"""
    r = subprocess.run(
        [sys.executable, "-c", seed_code],
        cwd=str(ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )
    if r.returncode != 0:
        proc.terminate()
        print(r.stderr or r.stdout, file=sys.stderr)
        sys.exit(1)

    (tmp / "gc_mcp_base_url.txt").write_text(
        f"http://127.0.0.1:{PORT}", encoding="utf-8"
    )
    (tmp / "gc_mcp_login.txt").write_text(
        f"username=admin password={BOOTSTRAP_PW}\n", encoding="utf-8"
    )
    print(
        f"READY http://127.0.0.1:{PORT} (pid {proc.pid}) login admin / {BOOTSTRAP_PW}",
        flush=True,
    )
    proc.wait()


if __name__ == "__main__":
    main()
