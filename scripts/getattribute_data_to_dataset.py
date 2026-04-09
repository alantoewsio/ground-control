"""Replace el.getAttribute('data-*') with el.dataset.* (Sonar javascript:S7761).

Only handles string-literal data-* attribute names. Skips dynamic getAttribute(attrVar).
Run from repo root: uv run python scripts/getattribute_data_to_dataset.py
"""

from __future__ import annotations

import re
from pathlib import Path

# Receiver: simple identifier chains (cb, tr.dataset.foo not intended)
_RECEIVER = re.compile(
    r"([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.getAttribute\(\s*([\"'])(data-[a-z0-9-]+)\2\s*\)"
)


def _data_attr_to_dataset_prop(attr: str) -> str:
    if not attr.startswith("data-") or attr == "data-":
        raise ValueError(attr)
    parts = attr[5:].split("-")
    if not parts or not parts[0]:
        raise ValueError(attr)
    return parts[0] + "".join(p.capitalize() for p in parts[1:] if p)


def _transform_source(text: str) -> str:
    def repl(m: re.Match[str]) -> str:
        obj, _q, attr = m.group(1), m.group(2), m.group(3)
        prop = _data_attr_to_dataset_prop(attr)
        return f"{obj}.dataset.{prop}"

    return _RECEIVER.sub(repl, text)


def main() -> None:
    root = Path(__file__).resolve().parent.parent / "static"
    for path in sorted(root.glob("*.js")):
        orig = path.read_text(encoding="utf-8")
        out = _transform_source(orig)
        if out != orig:
            path.write_text(out, encoding="utf-8")
            print(path.name)


if __name__ == "__main__":
    main()
