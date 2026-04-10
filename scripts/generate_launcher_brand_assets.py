#!/usr/bin/env python3
"""Build ``assets/ground_control_launcher.ico`` from ``static/Design.png`` (login page art).

Used by ``scripts/build_launcher.ps1`` before PyInstaller. If ``Design.png`` is absent but the
ICO already exists (e.g. checked into the repo), exits successfully without changes.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image


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
        help="Output .ico (default: <repo>/assets/ground_control_launcher.ico)",
    )
    parser.add_argument("--repo", type=Path, default=None, help="Repository root")
    args = parser.parse_args()
    repo = (args.repo or Path(__file__).resolve().parent.parent).resolve()
    source = (args.source or (repo / "static" / "Design.png")).resolve()
    output = (args.output or (repo / "assets" / "ground_control_launcher.ico")).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    if not source.is_file():
        if output.is_file():
            print(f"generate_launcher_brand_assets: keep existing {output} (no {source})")
            return 0
        print(
            f"generate_launcher_brand_assets: error: missing {source} and {output}",
            file=sys.stderr,
        )
        return 1

    im = Image.open(source).convert("RGBA")
    w, h = im.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        im = im.crop((left, top, left + side, top + side))

    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    im.save(output, format="ICO", sizes=sizes)
    print(f"generate_launcher_brand_assets: wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
