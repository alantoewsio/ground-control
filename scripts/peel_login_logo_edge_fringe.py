#!/usr/bin/env python3
"""Remove light/white anti-alias fringe from static/Design.png outer edge; refresh ICOs."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

NEIGH8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def _touches_transparent_void(alpha: np.ndarray, y: int, x: int) -> bool:
    h, w = alpha.shape[0], alpha.shape[1]
    if y == 0 or y == h - 1 or x == 0 or x == w - 1:
        return True
    for dy, dx in NEIGH8:
        ny, nx = y + dy, x + dx
        if ny < 0 or ny >= h or nx < 0 or nx >= w:
            return True
        if alpha[ny, nx] == 0:
            return True
    return False


def _is_light_outer_fringe(
    r: int,
    g: int,
    b: int,
    *,
    max_chroma: int,
    min_avg: int,
    min_all: int,
) -> bool:
    if min(r, g, b) >= min_all:
        return True
    hi, lo = max(r, g, b), min(r, g, b)
    chroma = hi - lo
    avg = (r + g + b) // 3
    return chroma <= max_chroma and avg >= min_avg


def _fringe_clear_coords_for_pass(
    alpha: np.ndarray,
    px: np.ndarray,
    *,
    max_chroma: int,
    min_avg: int,
    min_all: int,
) -> list[tuple[int, int]]:
    h, w = alpha.shape[0], alpha.shape[1]
    clear: list[tuple[int, int]] = []
    for y in range(h):
        for x in range(w):
            if alpha[y, x] == 0:
                continue
            if not _touches_transparent_void(alpha, y, x):
                continue
            r, g, b = int(px[y, x, 0]), int(px[y, x, 1]), int(px[y, x, 2])
            if not _is_light_outer_fringe(
                r, g, b, max_chroma=max_chroma, min_avg=min_avg, min_all=min_all
            ):
                continue
            clear.append((y, x))
    return clear


def peel_light_edge_fringe(
    px: np.ndarray,
    *,
    max_chroma: int = 38,
    min_avg: int = 125,
    min_all: int = 168,
) -> int:
    """Clear edge pixels that read as white/light gray. px is HxWx4 uint8, modified in place."""
    alpha = px[:, :, 3]
    removed = 0
    while True:
        clear = _fringe_clear_coords_for_pass(
            alpha, px, max_chroma=max_chroma, min_avg=min_avg, min_all=min_all
        )
        if not clear:
            break
        for cy, cx in clear:
            if alpha[cy, cx]:
                alpha[cy, cx] = 0
                removed += 1
    return removed


def _square_crop_and_maybe_upscale(im: Image.Image, target: int) -> Image.Image:
    w0, h0 = im.size
    if w0 != h0:
        side = min(w0, h0)
        left = (w0 - side) // 2
        top = (h0 - side) // 2
        im = im.crop((left, top, left + side, top + side))
    if max(im.size) < target:
        im = im.resize((target, target), Image.Resampling.LANCZOS)
    return im


def _write_favicons(repo: Path, png: Path) -> None:
    target = 256
    im = _square_crop_and_maybe_upscale(Image.open(png).convert("RGBA"), target)
    im.save(
        repo / "static" / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64)],
    )
    im2 = Image.open(png).convert("RGBA")
    w0, h0 = im2.size
    if w0 != h0:
        side = min(w0, h0)
        left = (w0 - side) // 2
        top = (h0 - side) // 2
        im2 = im2.crop((left, top, left + side, top + side))
    (repo / "assets").mkdir(parents=True, exist_ok=True)
    im2.save(
        repo / "assets" / "ground_control_launcher.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


def main() -> int:
    repo = Path(__file__).resolve().parent.parent
    png = repo / "static" / "Design.png"
    im = Image.open(png).convert("RGBA")
    px = np.asarray(im, dtype=np.uint8).copy()
    n = peel_light_edge_fringe(px)
    Image.fromarray(px, "RGBA").save(png, format="PNG", optimize=True)
    print(f"peel_login_logo_edge_fringe: removed {n} pixels -> {png}")
    _write_favicons(repo, png)
    print("favicon.ico and assets/ground_control_launcher.ico updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
