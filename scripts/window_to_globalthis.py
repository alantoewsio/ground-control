"""One-off: prefer globalThis over window in static/*.js (Sonar javascript:S7764)."""

from __future__ import annotations

from pathlib import Path


def transform(t: str) -> str:
    o = t
    o = o.replace(
        'typeof window !== "undefined" ? window : this',
        'typeof globalThis !== "undefined" ? globalThis : this',
    )
    o = o.replace(
        "typeof window !== 'undefined' ? window : this",
        "typeof globalThis !== 'undefined' ? globalThis : this",
    )
    o = o.replace("typeof window", "typeof globalThis")
    o = o.replace("})(window);", "})(globalThis);")
    o = o.replace("})(window)", "})(globalThis)")
    o = o.replace("window.", "globalThis.")
    o = o.replace("window[", "globalThis[")
    o = o.replace("!== window", "!== globalThis")
    return o


def main() -> None:
    root = Path(__file__).resolve().parent.parent / "static"
    for path in sorted(root.glob("*.js")):
        text = path.read_text(encoding="utf-8")
        out = transform(text)
        if out != text:
            path.write_text(out, encoding="utf-8")
            print(path)


if __name__ == "__main__":
    main()
