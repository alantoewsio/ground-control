"""Import/export ``firewall_config_entity_payload_fields`` for versioned seed data in the repo."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app import config
from app.models import FirewallConfigEntityPayloadField

logger = logging.getLogger(__name__)

EXPORT_SCHEMA_VERSION = 1
# Under repo root; committed so new installs can hydrate an empty catalog.
ENTITY_PAYLOAD_FIELDS_EXPORT_RELATIVE = Path("data") / "firewall_config_entity_payload_fields.json"


def default_entity_payload_fields_export_path() -> Path:
    return (config.BASE_DIR / ENTITY_PAYLOAD_FIELDS_EXPORT_RELATIVE).resolve()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_export_payload(raw: dict[str, Any] | list[Any]) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if not isinstance(raw, dict):
        return []
    rows = raw.get("rows")
    if not isinstance(rows, list):
        return []
    return [x for x in rows if isinstance(x, dict)]


def _coerce_optional_str(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return s if s else None
    return str(v)


def _normalize_row_display_type(v: Any) -> str:
    s = (_coerce_optional_str(v) or "").strip().lower()
    if s in ("tag", "onoff", "hidden"):
        return s
    return "text"


def _coerce_optional_positive_int(v: Any) -> int | None:
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    return n if n >= 1 else None


def export_firewall_config_entity_payload_fields_to_file(
    db: Session, path: Path | None = None
) -> Path:
    """
    Write all catalog rows to ``data/firewall_config_entity_payload_fields.json`` (or ``path``).
    """
    out = path if path is not None else default_entity_payload_fields_export_path()
    out.parent.mkdir(parents=True, exist_ok=True)
    rows_db = (
        db.query(FirewallConfigEntityPayloadField)
        .order_by(
            FirewallConfigEntityPayloadField.entity_type,
            FirewallConfigEntityPayloadField.property_name,
        )
        .all()
    )
    rows_out: list[dict[str, Any]] = []
    for r in rows_db:
        rows_out.append(
            {
                "entity_type": r.entity_type,
                "property_name": r.property_name,
                "json_value_kind": r.json_value_kind,
                "dependent_on": r.dependent_on,
                "data_entry_type": r.data_entry_type,
                "data_entry_properties": r.data_entry_properties,
                "show_as": r.show_as,
                "display_type": _normalize_row_display_type(r.display_type),
                "display_order": r.display_order,
                "help_text": r.help_text,
                "allowed_options": r.allowed_options,
                "data_source_entity_types": r.data_source_entity_types,
            }
        )
    payload = {"version": EXPORT_SCHEMA_VERSION, "rows": rows_out}
    out.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    return out


def import_firewall_config_entity_payload_fields_from_file(
    db: Session, path: Path | None = None
) -> int:
    """
    Upsert rows from the export file. Returns the number of rows processed.

    Raises ``FileNotFoundError`` if the file is missing, ``ValueError`` on invalid JSON/shape.
    """
    src = path if path is not None else default_entity_payload_fields_export_path()
    if not src.is_file():
        raise FileNotFoundError(str(src))
    try:
        raw = json.loads(src.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {src}: {exc}") from exc
    dict_rows = _parse_export_payload(raw)
    n = 0
    for item in dict_rows:
        et = item.get("entity_type")
        pn = item.get("property_name")
        jk = item.get("json_value_kind")
        if not isinstance(et, str) or not et.strip():
            continue
        if not isinstance(pn, str) or not pn.strip():
            continue
        if not isinstance(jk, str) or not jk.strip():
            continue
        et_s = et.strip()[:32]
        pn_s = pn.strip()[:512]
        jk_s = jk.strip()[:32]
        dep = _coerce_optional_str(item.get("dependent_on"))
        det = _coerce_optional_str(item.get("data_entry_type"))
        dprops = _coerce_optional_str(item.get("data_entry_properties"))
        show_as = _coerce_optional_str(item.get("show_as"))
        if show_as is not None and len(show_as) > 512:
            show_as = show_as[:512]
        disp_ord = _coerce_optional_positive_int(item.get("display_order"))
        disp_type = _normalize_row_display_type(item.get("display_type"))
        help_t = _coerce_optional_str(item.get("help_text"))
        allow_opt = item.get("allowed_options")
        if allow_opt is None:
            allow_opt_s: str | None = None
        elif isinstance(allow_opt, str):
            allow_opt_s = allow_opt.strip() or None
        elif isinstance(allow_opt, list):
            norm: list[str] = []
            for x in allow_opt:
                t = str(x).strip() if x is not None else ""
                if t:
                    norm.append(t)
            allow_opt_s = json.dumps(norm) if norm else None
        else:
            allow_opt_s = None
        ds_ets = item.get("data_source_entity_types")
        if ds_ets is None:
            ds_ets_s: str | None = None
        elif isinstance(ds_ets, str):
            ds_ets_s = ds_ets.strip() or None
        elif isinstance(ds_ets, list):
            ds_norm: list[str] = []
            for x in ds_ets:
                t = str(x).strip() if x is not None else ""
                if t:
                    ds_norm.append(t)
            ds_ets_s = json.dumps(ds_norm) if ds_norm else None
        else:
            ds_ets_s = None
        row = (
            db.query(FirewallConfigEntityPayloadField)
            .filter(
                FirewallConfigEntityPayloadField.entity_type == et_s,
                FirewallConfigEntityPayloadField.property_name == pn_s,
            )
            .one_or_none()
        )
        if row is None:
            db.add(
                FirewallConfigEntityPayloadField(
                    entity_type=et_s,
                    property_name=pn_s,
                    json_value_kind=jk_s,
                    dependent_on=dep,
                    data_entry_type=det,
                    data_entry_properties=dprops,
                    show_as=show_as,
                    display_type=disp_type,
                    display_order=disp_ord,
                    help_text=help_t,
                    allowed_options=allow_opt_s,
                    data_source_entity_types=ds_ets_s,
                )
            )
        else:
            row.json_value_kind = jk_s
            row.dependent_on = dep
            row.data_entry_type = det
            row.data_entry_properties = dprops
            if "show_as" in item:
                row.show_as = show_as
            if "display_type" in item:
                row.display_type = disp_type
            if "display_order" in item:
                row.display_order = disp_ord
            if "help_text" in item:
                row.help_text = help_t
            if "allowed_options" in item:
                row.allowed_options = allow_opt_s
            if "data_source_entity_types" in item:
                row.data_source_entity_types = ds_ets_s
            row.updated_at = _utc_now()
        n += 1
    return n


def maybe_import_firewall_config_entity_payload_fields_seed(
    *, seed_path: Path | None = None
) -> None:
    """
    After migrations: if the catalog table is empty, load ``data/...json`` when present.

    Skipped under pytest so isolated DBs are not hydrated from the repo file.

    ``seed_path`` overrides the file location (for tests).
    """
    if config.under_pytest() and seed_path is None:
        return
    from sqlalchemy import inspect

    from app.database import SessionLocal, _engine

    path = seed_path if seed_path is not None else default_entity_payload_fields_export_path()
    if not path.is_file():
        return
    try:
        insp = inspect(_engine)
    except Exception:
        return
    if not insp.has_table("firewall_config_entity_payload_fields"):
        return
    db = SessionLocal()
    try:
        if db.query(FirewallConfigEntityPayloadField).count() > 0:
            return
        import_firewall_config_entity_payload_fields_from_file(db, path)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "Failed to seed firewall_config_entity_payload_fields from %s", path
        )
    finally:
        db.close()
