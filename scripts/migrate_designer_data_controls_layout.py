"""Import legacy monolithic ``data/designer_data_controls_layout.json`` into per-entity files.

Run from the repository root::

    python scripts/migrate_designer_data_controls_layout.py

Or with a custom path to the old JSON and optional ``--keep-legacy``::

    python scripts/migrate_designer_data_controls_layout.py --legacy path/to/old.json --keep-legacy
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from app.designer_data_controls_layout import (  # noqa: E402
    import_legacy_monolith_to_per_entity_layout_files,
    layout_dir,
    layout_file_path,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--legacy",
        type=Path,
        default=None,
        help="Path to monolithic designer_data_controls_layout.json (default: repo data path)",
    )
    parser.add_argument(
        "--keep-legacy",
        action="store_true",
        help="Do not delete the monolithic file after import (default: delete after success)",
    )
    args = parser.parse_args()
    legacy = args.legacy
    result = import_legacy_monolith_to_per_entity_layout_files(
        legacy,
        delete_legacy=not args.keep_legacy,
    )
    print(json.dumps(result, indent=2))
    if not result.get("ok"):
        return 1
    print(f"Layout directory: {layout_dir()}", file=sys.stderr)
    if legacy is None:
        print(f"Default legacy path was: {layout_file_path()}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
