from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app import config
from app.db_utils import enable_wal_mode, repair_postgresql_serials_to_max_id
from app.monitor_models import MonitorBase

_monitor_url = config.monitor_database_url()
_monitor_engine = create_engine(
    _monitor_url,
    connect_args={"check_same_thread": False}
    if _monitor_url.startswith("sqlite")
    else {},
)
enable_wal_mode(_monitor_engine)
MonitorSessionLocal = sessionmaker(
    bind=_monitor_engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
)


def init_monitor_db() -> None:
    MonitorBase.metadata.create_all(bind=_monitor_engine)
    repair_postgresql_serials_to_max_id(
        _monitor_engine,
        tables=("firewall_webadmin_pings", "firewall_connectivity_rollups"),
    )


def get_monitor_db() -> Generator[Session, None, None]:
    db = MonitorSessionLocal()
    try:
        yield db
    finally:
        db.close()
