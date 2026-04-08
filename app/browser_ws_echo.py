"""Minimal authenticated WebSocket for browser ↔ Ground Control diagnostics (no SSH)."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from starlette.requests import HTTPConnection

from app.auth import browser_websocket_origin_error, browser_websocket_session_error

log = logging.getLogger(__name__)

_BROWSER_WS_ECHO_STATS: dict[str, Any] = {
    "accept_count": 0,
    "last_accept_ts": None,
    "last_client": None,
    "last_path": None,
    "last_error": None,
    "last_close_code": None,
    "last_close_reason": None,
}


def _mark_echo_stat(**fields: Any) -> None:
    _BROWSER_WS_ECHO_STATS.update(fields)


def get_browser_ws_echo_snapshot() -> dict[str, Any]:
    return dict(_BROWSER_WS_ECHO_STATS)


async def browser_ws_echo_handler(websocket: WebSocket) -> None:
    """
    Echo JSON/text and respond to {"t":"ping"} with {"t":"pong"}.
    Requires the same signed-in session cookie as other browser pages.
    """
    scope = websocket.scope
    client = scope.get("client")
    path = scope.get("path", "")
    req = HTTPConnection(scope)
    oerr = browser_websocket_origin_error(req)
    if oerr:
        _mark_echo_stat(last_error=f"origin_rejected: {oerr}", last_close_code=4003)
        try:
            await websocket.close(code=4003)
        except Exception:
            log.debug("browser_ws_echo failed close after origin error", exc_info=True)
        return
    err = browser_websocket_session_error(req)
    if err:
        await websocket.accept()
        _mark_echo_stat(last_error=f"session_rejected: {err}", last_close_code=4001)
        log.warning(
            "browser_ws_echo session rejected: %s path=%s client=%s",
            err,
            path,
            client,
        )
        try:
            await websocket.send_text(json.dumps({"t": "error", "message": err}))
        except Exception:
            log.debug("browser_ws_echo failed to send session error text", exc_info=True)
        try:
            await websocket.close(code=4001)
        except Exception:
            log.debug("browser_ws_echo failed close after session error", exc_info=True)
        return
    await websocket.accept()
    _mark_echo_stat(
        accept_count=int(_BROWSER_WS_ECHO_STATS.get("accept_count", 0)) + 1,
        last_accept_ts=time.time(),
        last_client=str(client),
        last_path=path,
        last_error=None,
    )
    log.info("browser_ws_echo accepted path=%s client=%s", path, client)

    try:
        await websocket.send_text(
            json.dumps(
                {
                    "t": "welcome",
                    "server_ts": time.time(),
                    "path": path,
                }
            )
        )
        while True:
            msg: dict[str, Any] = await websocket.receive()
            mtype = msg.get("type")
            if mtype == "websocket.disconnect":
                disc = msg.get("code", 0)
                _mark_echo_stat(last_close_code=disc, last_close_reason="disconnect_frame")
                log.info(
                    "browser_ws_echo disconnect frame path=%s client=%s code=%s",
                    path,
                    client,
                    disc,
                )
                break
            if mtype != "websocket.receive":
                continue
            if msg.get("text") is not None:
                text = msg["text"]
                try:
                    o = json.loads(text)
                    if isinstance(o, dict) and o.get("t") == "ping":
                        await websocket.send_text(
                            json.dumps(
                                {
                                    "t": "pong",
                                    "id": o.get("id"),
                                    "server_ts": time.time(),
                                }
                            )
                        )
                        continue
                    if isinstance(o, dict) and o.get("t") == "echo":
                        await websocket.send_text(
                            json.dumps(
                                {
                                    "t": "echo_reply",
                                    "id": o.get("id"),
                                    "payload": o.get("payload"),
                                    "server_ts": time.time(),
                                }
                            )
                        )
                        continue
                except (json.JSONDecodeError, TypeError, ValueError):
                    pass
                await websocket.send_text(
                    json.dumps(
                        {
                            "t": "echo_reply",
                            "payload": text,
                            "raw": True,
                            "server_ts": time.time(),
                        }
                    )
                )
            elif msg.get("bytes") is not None:
                b = msg["bytes"]
                if isinstance(b, memoryview):
                    b = b.tobytes()
                await websocket.send_bytes(b)
    except WebSocketDisconnect as exc:
        _mark_echo_stat(last_close_code=exc.code, last_close_reason=exc.reason or "")
        log.info(
            "browser_ws_echo WebSocketDisconnect path=%s client=%s code=%s reason=%r",
            path,
            client,
            exc.code,
            exc.reason,
        )
    except OSError as exc:
        _mark_echo_stat(last_error=f"OSError: {exc}")
        log.warning(
            "browser_ws_echo OSError path=%s client=%s: %s",
            path,
            client,
            exc,
        )
    except Exception:
        _mark_echo_stat(last_error="unexpected_exception")
        log.exception("browser_ws_echo unexpected error path=%s client=%s", path, client)
        raise
    finally:
        log.info("browser_ws_echo session ended path=%s client=%s", path, client)
