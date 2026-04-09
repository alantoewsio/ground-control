"""Daily scheduler hook: renew TLS before expiry (Let's Encrypt via Certbot renew; self-signed via regeneration)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app import config, security_settings

_log = logging.getLogger(__name__)


def certificate_not_after_utc(summary: dict[str, Any]) -> datetime | None:
    """Parse ``not_after`` ISO timestamp from :func:`security_settings.load_https_certificate_summary`."""
    na = summary.get("not_after")
    if not na or not isinstance(na, str):
        return None
    s = na.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def tls_certificate_expires_within(summary: dict[str, Any], *, within_days: int) -> bool:
    """True if the active HTTPS certificate expires within ``within_days`` (UTC)."""
    if not summary.get("present"):
        return False
    exp = certificate_not_after_utc(summary)
    if exp is None:
        return False
    now = datetime.now(timezone.utc)
    return exp <= now + timedelta(days=max(0, int(within_days)))


def run_tls_certificate_renewal_job() -> None:
    """Called from APScheduler (e.g. daily). No-op when disabled, under pytest, or HTTPS off."""
    if config.under_pytest():
        return
    if not config.tls_auto_renewal_enabled():
        return
    st = security_settings.load_security_ui_state()
    if not st.https_enabled:
        return
    summ = security_settings.load_https_certificate_summary()
    if not summ.get("present"):
        return
    days = config.tls_certificate_renew_within_days()
    if not tls_certificate_expires_within(summ, within_days=days):
        return

    if st.cert_source == "letsencrypt":
        from app import letsencrypt_service

        if not letsencrypt_service.is_letsencrypt_setup_complete():
            _log.warning("TLS auto-renew: Let's Encrypt is not fully configured; skipping.")
            return
        live = letsencrypt_service.certbot_config_dir() / "live" / letsencrypt_service.CERT_LINEAGE_NAME
        if not (live / "fullchain.pem").is_file():
            _log.warning("TLS auto-renew: no Certbot lineage on disk; skipping.")
            return
        ok, msg = letsencrypt_service.renew_letsencrypt_and_install(requested_by="TLS auto-renewal scheduler")
        if ok:
            _log.info("TLS auto-renew: Let's Encrypt renewal finished. %s", (msg or "")[:800])
            _log.info(
                "TLS auto-renew: uvicorn does not reload TLS files in-process; restart Ground Control if the served certificate is unchanged."
            )
        else:
            _log.warning("TLS auto-renew: Let's Encrypt renewal failed: %s", (msg or "")[:2000])
        return

    if st.cert_source == "self_signed":
        names = security_settings.parse_tls_hostnames_blob(st.tls_hostnames)
        if not names:
            names = ["localhost"]
        try:
            security_settings.generate_self_signed_certificate(names)
            _log.info("TLS auto-renew: regenerated self-signed certificate for %s.", ", ".join(names))
        except Exception:
            _log.exception("TLS auto-renew: self-signed regeneration failed.")
            return
        _log.info(
            "TLS auto-renew: uvicorn does not reload TLS files in-process; restart Ground Control if the served certificate is unchanged."
        )
        return

    _log.debug("TLS auto-renew: cert_source=%r not handled.", st.cert_source)
