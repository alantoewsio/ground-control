"""One-off: restore a .gcbak into fresh SQLite DBs (for Docker/local smoke tests)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Run before importing app (docker_runtime touches persist dir).
persist = (os.environ.get("GROUND_CONTROL_PERSIST_DIR") or "").strip()
if persist:
    Path(persist).mkdir(parents=True, exist_ok=True)

from app.database import SessionLocal, init_db
from app.backup_restore import restore_backup_merge
from app.monitor_database import MonitorSessionLocal, init_monitor_db
from app.secrets_database import SecretsSessionLocal, init_secrets_db


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: smoke_restore_gcbak.py <path-to.gcbak> <backup-password>", file=sys.stderr)
        return 2
    gcbak = Path(sys.argv[1])
    pw = sys.argv[2]
    init_db()
    init_secrets_db()
    init_monitor_db()
    main_s = SessionLocal()
    sec_s = SecretsSessionLocal()
    mon_s = MonitorSessionLocal()
    try:
        raw = gcbak.read_bytes()
        out = restore_backup_merge(raw, main_s, sec_s, mon_s, backup_password=pw)
        print("restore_backup_merge:", out)
        return 0 if out.get("ok") else 1
    finally:
        main_s.close()
        sec_s.close()
        mon_s.close()


if __name__ == "__main__":
    raise SystemExit(main())
