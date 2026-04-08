"""Browser SSH: WebSocket bridge to firewall SSH with interactive user login."""

from __future__ import annotations

import asyncio
import json
import logging
import re
import socket
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import asyncssh
from asyncssh.auth import KbdIntPrompts, KbdIntResponse
from asyncssh.misc import TerminalSizeChanged
from fastapi import WebSocket
from sqlalchemy.orm import Session
from starlette.requests import HTTPConnection
from starlette.websockets import WebSocketDisconnect

from app import crypto
from app.access_history import create_access_log, request_actor, request_client_ip
from app.auth import browser_websocket_origin_error, browser_websocket_session_error
from app.database import SessionLocal
from app.firewall_webadmin_info import refresh_firewall_webadmin_device_info
from app.models import Firewall
from app.secrets_database import SecretsSessionLocal, get_firewall_password_encrypted
from app.url_helpers import ssh_connect_host

log = logging.getLogger(__name__)

SSH_DEFAULT_PORT = 22
_FIREWALL_SSH_WS_STATS: dict[str, Any] = {
    "accept_count": 0,
    "last_accept_ts": None,
    "last_firewall_id": None,
    "last_client": None,
    "last_path": None,
    "last_phase": None,
    "last_error": None,
    "last_close_code": None,
    "last_close_reason": None,
}


def _mark_ssh_ws_stat(**fields: Any) -> None:
    _FIREWALL_SSH_WS_STATS.update(fields)


def get_firewall_ssh_ws_snapshot() -> dict[str, Any]:
    return dict(_FIREWALL_SSH_WS_STATS)


async def probe_tcp_connect(host: str, port: int, timeout: float = 4.0) -> dict[str, Any]:
    """Try TCP connect from this machine to host:port (for diagnostics)."""
    t0 = time.perf_counter()
    writer: asyncio.StreamWriter | None = None
    try:
        _reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout,
        )
        ms = round((time.perf_counter() - t0) * 1000.0, 2)
        return {"ok": True, "ms": ms, "error": None}
    except asyncio.TimeoutError:
        return {
            "ok": False,
            "ms": round((time.perf_counter() - t0) * 1000.0, 2),
            "error": "timeout",
        }
    except OSError as exc:
        return {
            "ok": False,
            "ms": round((time.perf_counter() - t0) * 1000.0, 2),
            "error": str(exc),
        }
    finally:
        if writer is not None:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass


async def resolve_host_for_diagnostics(host: str) -> dict[str, Any]:
    """DNS / getaddrinfo from the Ground Control host (executor)."""
    loop = asyncio.get_running_loop()

    def _resolve() -> list[str]:
        infos = socket.getaddrinfo(
            host,
            SSH_DEFAULT_PORT,
            type=socket.SOCK_STREAM,
        )
        return sorted({str(x[4][0]) for x in infos})

    try:
        addrs = await loop.run_in_executor(None, _resolve)
        return {"ok": True, "addresses": addrs[:8], "count": len(addrs)}
    except socket.gaierror as exc:
        return {"ok": False, "addresses": [], "error": str(exc)}


async def build_firewall_ssh_diagnostics(inventory_host: str) -> dict[str, Any]:
    raw = (inventory_host or "").strip()
    connect_host = ssh_connect_host(raw)
    dns = await resolve_host_for_diagnostics(connect_host)
    tcp = await probe_tcp_connect(connect_host, SSH_DEFAULT_PORT, 4.0)
    return {
        "inventory_host": raw,
        "ssh_connect_host": connect_host,
        "dns": dns,
        "tcp_port_22": tcp,
    }


_ANSI_ESCAPE_RE = re.compile(
    r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])"
)


def strip_ssh_terminal_escapes(text: str) -> str:
    return _ANSI_ESCAPE_RE.sub("", text)


def parse_sophos_ssh_main_menu_screen(text: str) -> dict[str, str | None]:
    """Parse firmware, model, and hostname from the SFOS text console main menu."""
    cleaned = strip_ssh_terminal_escapes(text)
    firmware_version: str | None = None
    model: str | None = None
    device_hostname: str | None = None
    for line in cleaned.splitlines():
        s = line.strip()
        if not s:
            continue
        low = s.lower()
        if low.startswith("sophos firmware version:"):
            firmware_version = s.split(":", 1)[1].strip()
        elif low.startswith("model:"):
            model = s.split(":", 1)[1].strip()
        elif low.startswith("hostname:"):
            device_hostname = s.split(":", 1)[1].strip()
    return {
        "firmware_version": firmware_version,
        "model": model,
        "device_hostname": device_hostname,
    }


_SSH_MENU_MARKER = b"Select Menu Number"


async def _read_ssh_tty_until_main_menu(
    process: Any,
    *,
    max_total_seconds: float = 45.0,
    max_bytes: int = 262144,
    chunk_timeout: float = 3.0,
) -> bytes:
    buf = bytearray()
    deadline = time.monotonic() + max_total_seconds
    while time.monotonic() < deadline and len(buf) < max_bytes:
        remaining = min(chunk_timeout, deadline - time.monotonic())
        if remaining <= 0:
            break
        try:
            chunk = await asyncio.wait_for(
                process.stdout.read(8192),
                timeout=remaining,
            )
        except asyncio.TimeoutError:
            if _SSH_MENU_MARKER in buf:
                break
            continue
        if not chunk:
            break
        buf.extend(chunk)
        if _SSH_MENU_MARKER in buf:
            break
    return bytes(buf)


async def collect_firewall_ssh_device_info(
    host: str,
    username: str,
    password: str,
    *,
    connect_timeout: float = 60.0,
    menu_read_timeout: float = 45.0,
) -> dict[str, Any]:
    """
    Silent SSH: password-auth TTY session, read until the SFOS main menu appears,
    parse firmware / model / hostname from the post-login banner, then send 0 to exit.
    """
    raw_host = (host or "").strip()
    user = (username or "").strip()
    if not raw_host:
        return {"ok": False, "error": "host is blank"}
    if not user:
        return {"ok": False, "error": "username is blank"}
    connect_h = ssh_connect_host(raw_host)
    conn: asyncssh.SSHClientConnection | None = None
    try:
        try:
            conn = await asyncio.wait_for(
                asyncssh.connect(
                    connect_h,
                    port=SSH_DEFAULT_PORT,
                    username=user,
                    password=password,
                    known_hosts=None,
                    client_keys=None,
                    agent_path=None,
                    login_timeout=int(min(max(connect_timeout, 1.0), 600.0)),
                ),
                timeout=connect_timeout,
            )
        except asyncio.TimeoutError:
            return {"ok": False, "error": "ssh connection timed out"}
        except (OSError, asyncssh.Error) as exc:
            return {"ok": False, "error": f"ssh connection failed: {exc}"}

        try:
            process = await conn.create_process(
                term_type="xterm",
                term_size=(80, 24),
                encoding=None,
            )
        except (OSError, asyncssh.Error) as exc:
            return {"ok": False, "error": f"ssh shell failed: {exc}"}

        async with process:
            data = await _read_ssh_tty_until_main_menu(
                process,
                max_total_seconds=menu_read_timeout,
            )
            text = data.decode("utf-8", errors="replace")
            parsed = parse_sophos_ssh_main_menu_screen(text)
            if not parsed.get("firmware_version") and not parsed.get("model"):
                tail = text[-1200:] if len(text) > 1200 else text
                return {
                    "ok": False,
                    "error": "main menu banner not recognized (missing firmware/model lines)",
                    "raw_tail": tail,
                }
            try:
                process.stdin.write(b"0\r\n")
                await process.stdin.drain()
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            except Exception:
                log.debug("ssh menu exit send failed", exc_info=True)
            await asyncio.sleep(0.25)

        return {
            "ok": True,
            "firmware_version": parsed.get("firmware_version"),
            "model": parsed.get("model"),
            "device_hostname": parsed.get("device_hostname"),
        }
    finally:
        if conn is not None:
            conn.close()
            await conn.wait_closed()


async def refresh_firewall_ssh_device_info(
    db: Session,
    sdb: Session,
    firewall_id: int,
    *,
    connect_timeout: float = 60.0,
    menu_read_timeout: float = 45.0,
) -> dict[str, Any]:
    """Load credentials from inventory + secrets, SSH silently, persist firmware/model/hostname."""
    row = db.get(Firewall, firewall_id)
    if not row:
        return {"ok": False, "error": "firewall not found", "firewall_id": firewall_id}
    username = (row.username or "").strip()
    if not username:
        return {
            "ok": False,
            "error": "firewall username is blank",
            "firewall_id": firewall_id,
        }
    enc = get_firewall_password_encrypted(sdb, firewall_id)
    if not enc:
        return {
            "ok": False,
            "error": "no stored firewall password in secrets",
            "firewall_id": firewall_id,
        }
    try:
        password = crypto.decrypt_secret(enc)
    except ValueError as exc:
        return {
            "ok": False,
            "error": f"password decrypt failed: {exc}",
            "firewall_id": firewall_id,
        }

    result = await collect_firewall_ssh_device_info(
        row.host,
        username,
        password,
        connect_timeout=connect_timeout,
        menu_read_timeout=menu_read_timeout,
    )
    out: dict[str, Any] = dict(result)
    out["firewall_id"] = firewall_id
    if not result.get("ok"):
        return out

    def _clip(val: str | None, max_len: int) -> str | None:
        if val is None:
            return None
        t = val.strip()
        if not t:
            return None
        return t if len(t) <= max_len else t[:max_len]

    fv = _clip(result.get("firmware_version"), 64)
    mo = _clip(result.get("model"), 128)
    dh = _clip(result.get("device_hostname"), 255)
    if fv is not None:
        row.firmware_version = fv
    if mo is not None:
        row.model = mo
    if dh is not None:
        row.device_hostname = dh
    db.add(row)
    db.commit()
    return out


SSH_DEVICE_INFO_UNKNOWN = "Unknown"


def _run_coroutine_blocking(coro: Any, *, timeout: float = 120.0) -> Any:
    """Run ``coro`` when the caller may already be inside an asyncio loop (e.g. FastAPI)."""

    def _runner() -> Any:
        return asyncio.run(coro)

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return _runner()
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(_runner).result(timeout=timeout)


async def _refresh_firewall_ssh_device_info_isolated_sessions(firewall_id: int) -> dict[str, Any]:
    """Run SSH refresh on fresh DB sessions (safe for ThreadPoolExecutor + asyncio.run)."""
    db2 = SessionLocal()
    sdb2 = SecretsSessionLocal()
    try:
        return await refresh_firewall_ssh_device_info(db2, sdb2, firewall_id)
    finally:
        sdb2.close()
        db2.close()


async def _refresh_firewall_webadmin_device_info_isolated_sessions(
    firewall_id: int,
) -> dict[str, Any]:
    """Run WebAdmin refresh on fresh DB sessions (safe for ThreadPoolExecutor + asyncio.run)."""
    db2 = SessionLocal()
    sdb2 = SecretsSessionLocal()
    try:
        return refresh_firewall_webadmin_device_info(db2, sdb2, firewall_id)
    finally:
        sdb2.close()
        db2.close()


def _set_firewall_ssh_device_info_all_unknown(row: Firewall) -> None:
    row.firmware_version = SSH_DEVICE_INFO_UNKNOWN
    row.model = SSH_DEVICE_INFO_UNKNOWN
    row.device_hostname = SSH_DEVICE_INFO_UNKNOWN
    row.serial_number = SSH_DEVICE_INFO_UNKNOWN
    row.license_info = SSH_DEVICE_INFO_UNKNOWN


def _normalize_blank_ssh_device_fields_to_unknown(row: Firewall) -> None:
    """After a successful SSH parse, treat missing/blank columns as Unknown."""
    if not (row.firmware_version or "").strip():
        row.firmware_version = SSH_DEVICE_INFO_UNKNOWN
    if not (row.model or "").strip():
        row.model = SSH_DEVICE_INFO_UNKNOWN
    if not (row.device_hostname or "").strip():
        row.device_hostname = SSH_DEVICE_INFO_UNKNOWN
    if not (row.serial_number or "").strip():
        row.serial_number = SSH_DEVICE_INFO_UNKNOWN
    if not (row.license_info or "").strip():
        row.license_info = SSH_DEVICE_INFO_UNKNOWN


def apply_firewall_ssh_device_info_after_full_sync(
    db: Session,
    sdb: Session,
    firewall_id: int,
) -> None:
    """
    Best-effort inventory refresh after a full config sync.

    Flow: WebAdmin index.jsp scrape first, then SSH banner parse as fallback when
    core fields (firmware/model/hostname) are still incomplete. Test firewalls skip
    remote calls and get Unknown placeholders. Errors are logged at debug only.
    """
    row = db.get(Firewall, firewall_id)
    if not row:
        return
    try:
        if row.is_test:
            _set_firewall_ssh_device_info_all_unknown(row)
            db.add(row)
            db.commit()
            return

        webadmin_result: dict[str, Any] = {"ok": False}
        try:
            webadmin_result = _run_coroutine_blocking(
                _refresh_firewall_webadmin_device_info_isolated_sessions(firewall_id),
                timeout=120.0,
            )
        except Exception:
            log.debug(
                "WebAdmin device info refresh failed after full sync (firewall_id=%s)",
                firewall_id,
                exc_info=True,
            )
            webadmin_result = {"ok": False}

        db.expire_all()
        row = db.get(Firewall, firewall_id)
        has_core_fields = bool(
            row
            and (row.firmware_version or "").strip()
            and (row.model or "").strip()
            and (row.device_hostname or "").strip()
        )
        if not (isinstance(webadmin_result, dict) and webadmin_result.get("ok") and has_core_fields):
            try:
                ssh_result = _run_coroutine_blocking(
                    _refresh_firewall_ssh_device_info_isolated_sessions(firewall_id),
                    timeout=120.0,
                )
            except Exception:
                log.debug(
                    "SSH device info refresh failed after full sync (firewall_id=%s)",
                    firewall_id,
                    exc_info=True,
                )
                ssh_result = {"ok": False}
            if not isinstance(ssh_result, dict) or not ssh_result.get("ok"):
                row = db.get(Firewall, firewall_id)
                if row:
                    _set_firewall_ssh_device_info_all_unknown(row)
                    db.add(row)
                    db.commit()
                return

        db.expire_all()
        row = db.get(Firewall, firewall_id)
        if row:
            _normalize_blank_ssh_device_fields_to_unknown(row)
            db.add(row)
            db.commit()
    except Exception:
        log.debug(
            "apply_firewall_ssh_device_info_after_full_sync failed (firewall_id=%s)",
            firewall_id,
            exc_info=True,
        )
        try:
            db.rollback()
        except Exception:
            pass
        try:
            row2 = db.get(Firewall, firewall_id)
            if row2:
                _set_firewall_ssh_device_info_all_unknown(row2)
                db.add(row2)
                db.commit()
        except Exception:
            log.debug(
                "could not persist Unknown SSH device info (firewall_id=%s)",
                firewall_id,
                exc_info=True,
            )


class _WsSshBridge:
    """Routes WebSocket input to SSH auth lines or shell stdin; serializes outbound bytes."""

    def __init__(self, websocket: WebSocket, *, firewall_id: int | None = None) -> None:
        self.ws = websocket
        self._firewall_id = firewall_id
        self.auth_mode = True
        self.process: Any = None
        self._closed = False
        self._shutdown = asyncio.Event()
        self._line_q: asyncio.Queue[str] = asyncio.Queue()
        self._acc = bytearray()
        self._stdin_buffer: list[bytes] = []
        self._send_lock = asyncio.Lock()
        self.diag_phase = "ws_bridge_started"

    def close(self) -> None:
        self._closed = True
        self._shutdown.set()

    def clear_auth_buffer(self) -> None:
        self._acc.clear()

    def set_process(self, process: Any) -> None:
        self.process = process
        for chunk in self._stdin_buffer:
            process.stdin.write(chunk)
        self._stdin_buffer.clear()

    async def send_bytes(self, data: bytes) -> None:
        if self._closed:
            return
        async with self._send_lock:
            await self.ws.send_bytes(data)

    async def send_gc_pong(self, ping_obj: dict[str, Any]) -> None:
        if self._closed:
            return
        payload = {
            "t": "gc_pong",
            "id": ping_obj.get("id"),
            "auth_mode": self.auth_mode,
            "shell_active": self.process is not None,
            "phase": self.diag_phase,
            "server_ts": time.time(),
        }
        async with self._send_lock:
            await self.ws.send_text(json.dumps(payload))

    async def next_auth_line(self) -> str | None:
        if self._shutdown.is_set():
            return None
        get_line = asyncio.create_task(self._line_q.get())
        wait_shutdown = asyncio.create_task(self._shutdown.wait())
        done, pending = await asyncio.wait(
            {get_line, wait_shutdown},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
        for t in pending:
            try:
                await t
            except asyncio.CancelledError:
                pass
        if wait_shutdown in done and self._shutdown.is_set():
            if not get_line.done():
                get_line.cancel()
                try:
                    await get_line
                except asyncio.CancelledError:
                    pass
            return None
        if get_line in done:
            return get_line.result()
        return None

    def _feed_auth_bytes(self, chunk: bytes) -> None:
        for b in chunk:
            if b in (13, 10):
                line = bytes(self._acc).decode("utf-8", errors="replace")
                self._acc.clear()
                self._line_q.put_nowait(line)
            else:
                self._acc.append(b)

    async def run_ws_reader(self) -> None:
        try:
            while not self._closed:
                msg: dict[str, Any] = await self.ws.receive()
                mtype = msg.get("type")
                if mtype == "websocket.disconnect":
                    _mark_ssh_ws_stat(
                        last_close_code=msg.get("code"),
                        last_close_reason="disconnect_frame",
                    )
                    log.info(
                        "SSH WS reader got disconnect firewall_id=%s code=%s",
                        self._firewall_id,
                        msg.get("code"),
                    )
                    self._shutdown.set()
                    break
                if mtype != "websocket.receive":
                    continue

                if "text" in msg and msg["text"] is not None:
                    text = msg["text"]
                    try:
                        o = json.loads(text)
                        if isinstance(o, dict):
                            if o.get("t") == "gc_ping":
                                await self.send_gc_pong(o)
                                continue
                            if o.get("t") == "resize":
                                if self.process is not None:
                                    c = int(o.get("cols", 80))
                                    r = int(o.get("rows", 24))
                                    self.process.feed_exception(
                                        TerminalSizeChanged(c, r, 0, 0)
                                    )
                                # Never treat resize JSON as SSH auth / shell input
                                continue
                    except (TypeError, ValueError, json.JSONDecodeError):
                        pass
                    chunk = text.encode("utf-8")
                elif "bytes" in msg and msg["bytes"] is not None:
                    b = msg["bytes"]
                    if isinstance(b, memoryview):
                        b = b.tobytes()
                    chunk = b
                else:
                    continue

                if self.auth_mode:
                    self._feed_auth_bytes(chunk)
                elif self.process is not None:
                    self.process.stdin.write(chunk)
                    await self.process.stdin.drain()
                else:
                    self._stdin_buffer.append(chunk)
        except WebSocketDisconnect as exc:
            _mark_ssh_ws_stat(last_close_code=exc.code, last_close_reason=exc.reason or "")
            log.info(
                "SSH WS reader WebSocketDisconnect firewall_id=%s code=%s reason=%r",
                self._firewall_id,
                exc.code,
                exc.reason,
            )
            self._shutdown.set()
        except Exception:
            _mark_ssh_ws_stat(last_error="ws_reader_exception")
            log.warning(
                "SSH WS run_ws_reader error firewall_id=%s",
                self._firewall_id,
                exc_info=True,
            )
            self._shutdown.set()


class _BrowserSshClient(asyncssh.SSHClient):
    def __init__(self, bridge: _WsSshBridge, *, saved_password: str | None) -> None:
        self._bridge = bridge
        self._saved_password = saved_password
        self._saved_password_used = False

    def auth_banner_received(self, msg: str, lang: str) -> None:
        del lang
        data = msg.encode("utf-8", errors="replace") + b"\r\n"
        asyncio.create_task(self._bridge.send_bytes(data))

    def kbdint_auth_requested(self) -> str:
        return ""

    async def password_auth_requested(self) -> str | None:
        # Use stored firewall password only once to avoid repeated automatic retries.
        if self._saved_password is not None and not self._saved_password_used:
            self._saved_password_used = True
            await self._bridge.send_bytes(b"\r\nTrying saved firewall password...\r\n")
            return self._saved_password

        # SSH "password" auth usually has no server-side text prompt, so show one.
        await self._bridge.send_bytes(b"\r\nPassword: ")
        line = await self._bridge.next_auth_line()
        return line

    async def kbdint_challenge_received(
        self,
        name: str,
        instructions: str,
        lang: str,
        prompts: KbdIntPrompts,
    ) -> KbdIntResponse | None:
        del lang
        if not prompts:
            return []
        if name:
            await self._bridge.send_bytes(name.encode("utf-8", errors="replace") + b"\r\n")
        if instructions:
            await self._bridge.send_bytes(
                instructions.encode("utf-8", errors="replace") + b"\r\n"
            )
        responses: list[str] = []
        for prompt, _echo in prompts:
            await self._bridge.send_bytes(prompt.encode("utf-8", errors="replace"))
            line = await self._bridge.next_auth_line()
            if line is None:
                return None
            responses.append(line)
        return responses


async def firewall_ssh_terminal_ws(websocket: WebSocket, firewall_id: int) -> None:
    scope = websocket.scope
    client = scope.get("client")
    path = scope.get("path", "")
    req = HTTPConnection(scope)
    oerr = browser_websocket_origin_error(req)
    if oerr:
        _mark_ssh_ws_stat(
            last_error=f"origin_rejected: {oerr}",
            last_close_code=4003,
            last_phase="origin_rejected",
        )
        try:
            await websocket.close(code=4003)
        except Exception:
            log.debug("SSH WS close after origin error failed", exc_info=True)
        return
    await websocket.accept()
    _mark_ssh_ws_stat(
        accept_count=int(_FIREWALL_SSH_WS_STATS.get("accept_count", 0)) + 1,
        last_accept_ts=time.time(),
        last_firewall_id=firewall_id,
        last_client=str(client),
        last_path=path,
        last_phase="ws_accepted",
        last_error=None,
    )
    log.info(
        "SSH WS accepted firewall_id=%s path=%s client=%s",
        firewall_id,
        path,
        client,
    )
    actor_uid, actor_username = request_actor(req)
    actor_ip = request_client_ip(req)
    access_session_id = str(uuid.uuid4())
    access_started_logged = False
    access_connected_successfully = False
    access_end_detail = "closed"
    err = browser_websocket_session_error(req)
    if err:
        _mark_ssh_ws_stat(
            last_error=f"session_rejected: {err}",
            last_close_code=4001,
            last_phase="session_rejected",
        )
        log.warning(
            "SSH WS session rejected firewall_id=%s: %s client=%s",
            firewall_id,
            err,
            client,
        )
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": err}))
        except Exception:
            log.debug("SSH WS failed to send session error", exc_info=True)
        try:
            await websocket.close(code=4001)
        except Exception:
            log.debug("SSH WS close after session error failed", exc_info=True)
        return

    db = SessionLocal()
    sdb = SecretsSessionLocal()
    try:
        fw_row = db.get(Firewall, firewall_id)
        if not fw_row:
            _mark_ssh_ws_stat(
                last_error="firewall_not_found",
                last_close_code=4004,
                last_phase="firewall_not_found",
            )
            await websocket.send_text(
                json.dumps({"type": "error", "message": "Firewall not found."})
            )
            await websocket.close(code=4004)
            return

        # Inventory "Host" column is Firewall.host; normalize for AsyncSSH (unwrap [::1] form).
        host = ssh_connect_host(fw_row.host)
        # SSH protocol still requires a username; auth itself remains interactive.
        username = (fw_row.username or "").strip()
        if not username:
            await websocket.send_text(
                json.dumps(
                    {
                        "type": "error",
                        "message": "Firewall username is blank. Set a username in inventory for browser SSH.",
                    }
                )
            )
            await websocket.close(code=4400)
            return

        saved_password: str | None = None
        enc = get_firewall_password_encrypted(sdb, firewall_id)
        if enc:
            try:
                saved_password = crypto.decrypt_secret(enc)
            except ValueError as exc:
                log.warning(
                    "Saved firewall password decrypt failed firewall_id=%s: %s",
                    firewall_id,
                    exc,
                )

        bridge = _WsSshBridge(websocket, firewall_id=firewall_id)
        reader_task = asyncio.create_task(bridge.run_ws_reader())
        conn: asyncssh.SSHClientConnection | None = None
        try:
            try:
                bridge.diag_phase = "ssh_connecting"
                _mark_ssh_ws_stat(last_phase="ssh_connecting")
                conn = await asyncio.wait_for(
                    asyncssh.connect(
                        host,
                        port=SSH_DEFAULT_PORT,
                        username=username,
                        client_factory=lambda: _BrowserSshClient(
                            bridge, saved_password=saved_password
                        ),
                        known_hosts=None,
                        # Keep browser SSH interactive: do not auto-try local keys/agent methods.
                        client_keys=None,
                        agent_path=None,
                        password=None,
                        host_based_auth=False,
                        public_key_auth=False,
                        password_auth=True,
                        kbdint_auth=False,
                        gss_auth=False,
                        gss_kex=False,
                        preferred_auth=["password"],
                        login_timeout=600,
                    ),
                    timeout=90.0,
                )
                bridge.diag_phase = "ssh_authenticated"
                _mark_ssh_ws_stat(last_phase="ssh_authenticated")
                access_connected_successfully = True
            except asyncio.TimeoutError:
                create_access_log(
                    db,
                    session_id=access_session_id,
                    firewall_id=firewall_id,
                    access_type="ssh",
                    event_kind="start",
                    connected_successfully=False,
                    initiated_by_user_id=actor_uid,
                    initiated_by_username=actor_username,
                    client_ip=actor_ip,
                    details="connect-timeout",
                )
                access_started_logged = True
                _mark_ssh_ws_stat(
                    last_error="ssh_connect_timeout",
                    last_close_code=4402,
                    last_phase="ssh_connect_timeout",
                )
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "message": "SSH connection or login timed out (90s).",
                        }
                    )
                )
                await websocket.close(code=4402)
                return
            except (OSError, asyncssh.Error) as exc:
                create_access_log(
                    db,
                    session_id=access_session_id,
                    firewall_id=firewall_id,
                    access_type="ssh",
                    event_kind="start",
                    connected_successfully=False,
                    initiated_by_user_id=actor_uid,
                    initiated_by_username=actor_username,
                    client_ip=actor_ip,
                    details=f"connect-failed: {type(exc).__name__}",
                )
                access_started_logged = True
                _mark_ssh_ws_stat(
                    last_error=f"ssh_connect_failed: {exc}",
                    last_close_code=4402,
                    last_phase="ssh_connect_failed",
                )
                log.info("SSH connect failed for firewall %s: %s", firewall_id, exc)
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "message": f"SSH connection failed: {exc}",
                        }
                    )
                )
                await websocket.close(code=4402)
                return
            except Exception as exc:
                create_access_log(
                    db,
                    session_id=access_session_id,
                    firewall_id=firewall_id,
                    access_type="ssh",
                    event_kind="start",
                    connected_successfully=False,
                    initiated_by_user_id=actor_uid,
                    initiated_by_username=actor_username,
                    client_ip=actor_ip,
                    details=f"connect-unexpected: {type(exc).__name__}",
                )
                access_started_logged = True
                _mark_ssh_ws_stat(
                    last_error=f"ssh_unexpected: {exc}",
                    last_close_code=4402,
                    last_phase="ssh_unexpected",
                )
                log.exception("SSH bridge unexpected error for firewall %s", firewall_id)
                try:
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "error",
                                "message": f"SSH error: {exc}",
                            }
                        )
                    )
                except Exception:
                    pass
                await websocket.close(code=4402)
                return

            bridge.auth_mode = False
            bridge.clear_auth_buffer()
            bridge.diag_phase = "ssh_opening_shell"
            _mark_ssh_ws_stat(last_phase="ssh_opening_shell")

            try:
                process = await conn.create_process(
                    term_type="xterm",
                    term_size=(80, 24),
                    encoding=None,
                )
            except (OSError, asyncssh.Error) as exc:
                _mark_ssh_ws_stat(
                    last_error=f"ssh_shell_failed: {exc}",
                    last_close_code=4402,
                    last_phase="ssh_shell_failed",
                )
                log.info("SSH shell failed for firewall %s: %s", firewall_id, exc)
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "error",
                            "message": f"SSH shell failed: {exc}",
                        }
                    )
                )
                await websocket.close(code=4402)
                return

            bridge.set_process(process)
            bridge.diag_phase = "ssh_shell_active"
            _mark_ssh_ws_stat(last_phase="ssh_shell_active")
            if not access_started_logged:
                create_access_log(
                    db,
                    session_id=access_session_id,
                    firewall_id=firewall_id,
                    access_type="ssh",
                    event_kind="start",
                    connected_successfully=True,
                    initiated_by_user_id=actor_uid,
                    initiated_by_username=actor_username,
                    client_ip=actor_ip,
                    details="shell-active",
                )
                access_started_logged = True

            async with process:

                async def pump_stdout() -> None:
                    try:
                        while True:
                            data = await process.stdout.read(65536)
                            if not data:
                                break
                            await bridge.send_bytes(data)
                    except Exception:
                        log.debug("pump_stdout ended", exc_info=True)

                out_task = asyncio.create_task(pump_stdout())
                try:
                    await out_task
                finally:
                    if not out_task.done():
                        out_task.cancel()
                        try:
                            await out_task
                        except asyncio.CancelledError:
                            pass
            bridge.process = None
            bridge.diag_phase = "ssh_shell_ended"
            _mark_ssh_ws_stat(last_phase="ssh_shell_ended")
            access_end_detail = "shell-ended"
        finally:
            bridge.diag_phase = "ws_closing"
            _mark_ssh_ws_stat(last_phase="ws_closing")
            bridge.close()
            reader_task.cancel()
            try:
                await reader_task
            except asyncio.CancelledError:
                pass
            if conn is not None:
                conn.close()
                await conn.wait_closed()
            if access_started_logged:
                create_access_log(
                    db,
                    session_id=access_session_id,
                    firewall_id=firewall_id,
                    access_type="ssh",
                    event_kind="end",
                    connected_successfully=access_connected_successfully,
                    initiated_by_user_id=actor_uid,
                    initiated_by_username=actor_username,
                    client_ip=actor_ip,
                    details=access_end_detail,
                )
    finally:
        db.close()
        sdb.close()

    try:
        await websocket.close()
        _mark_ssh_ws_stat(last_close_code=1000, last_close_reason="server_close")
        log.info("SSH WS handler finished firewall_id=%s client=%s", firewall_id, client)
    except Exception:
        log.debug("SSH WS final close failed firewall_id=%s", firewall_id, exc_info=True)
