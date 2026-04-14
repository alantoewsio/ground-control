#!/usr/bin/env python3
"""Build web favicon and launcher tray/exe icons from ``static/Design.png``.

Writes:

- ``static/favicon.ico`` — same artwork the web app uses; **PyInstaller uses this** for
  ``launcher.exe`` and the tray loads it when bundled.
- ``assets/ground_control_launcher.ico`` — multi-resolution fallback (e.g. older checkouts).

Used by ``scripts/build_launcher.ps1`` before PyInstaller. If ``Design.png`` is absent but the
launcher ICO already exists, exits successfully without changes (favicon unchanged).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

_FAVICON_ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64)]
_LAUNCHER_ICO_SIZES = [
    (16, 16),
    (24, 24),
    (32, 32),
    (48, 48),
    (64, 64),
    (128, 128),
    (256, 256),
]
_UPSCALE_SIDE = 256


def _square_crop_rgba(source: Path) -> Image.Image:
    im = Image.open(source).convert("RGBA")
    w, h = im.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        im = im.crop((left, top, left + side, top + side))
    return im


def _maybe_upscale_for_ico(im: Image.Image) -> Image.Image:
    if max(im.size) >= _UPSCALE_SIDE:
        return im
    return im.resize((_UPSCALE_SIDE, _UPSCALE_SIDE), Image.Resampling.LANCZOS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=None,
        help="PNG source (default: <repo>/static/Design.png)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output launcher .ico (default: <repo>/assets/ground_control_launcher.ico)",
    )
    parser.add_argument("--repo", type=Path, default=None, help="Repository root")
    args = parser.parse_args()
    repo = (args.repo or Path(__file__).resolve().parent.parent).resolve()
    source = (args.source or (repo / "static" / "Design.png")).resolve()
    output = (args.output or (repo / "assets" / "ground_control_launcher.ico")).resolve()
    favicon_out = (repo / "static" / "favicon.ico").resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    favicon_out.parent.mkdir(parents=True, exist_ok=True)

    if not source.is_file():
        if output.is_file():
            print(f"generate_launcher_brand_assets: keep existing {output} (no {source})")
            return 0
        print(
            f"generate_launcher_brand_assets: error: missing {source} and {output}",
            file=sys.stderr,
        )
        return 1

    im = _maybe_upscale_for_ico(_square_crop_rgba(source))
    im.save(favicon_out, format="ICO", sizes=_FAVICON_ICO_SIZES)
    im.save(output, format="ICO", sizes=_LAUNCHER_ICO_SIZES)
    print(f"generate_launcher_brand_assets: wrote {favicon_out}")
    print(f"generate_launcher_brand_assets: wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
