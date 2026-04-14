"""Export ``firewall_config_entity_payload_fields`` to ``data/firewall_config_entity_payload_fields.json``."""

from __future__ import annotations

import os
import sys
from pathlib import Path

persist = (os.environ.get("GROUND_CONTROL_PERSIST_DIR") or "").strip()
if persist:
    Path(persist).mkdir(parents=True, exist_ok=True)

from app.database import SessionLocal, init_db
from app.firewall_config_entity_payload_io import export_firewall_config_entity_payload_fields_to_file


def main() -> int:
    init_db()
    db = SessionLocal()
    try:
        out = export_firewall_config_entity_payload_fields_to_file(db)
        db.commit()
        print(out)
        return 0
    except Exception as exc:
        db.rollback()
        print(f"error: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
