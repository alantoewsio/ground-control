"""One-off helper: extract designer_tables inline script to static/gc-fw-v2-object-data-table.js."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = (ROOT / "templates" / "designer_tables.html").read_text(encoding="utf-8")
marker = '<script src="/static/gc-network-entity.js"></script>'
i = src.index(marker) + len(marker)
s = src.index("\n<script>", i) + len("\n<script>")
e2 = src.index("})();", s)
# end of IIFE
end = e2 + len("})();")
js = src[s:end].strip()
if not js.startswith("(function"):
    raise SystemExit("unexpected script start")
js = js.replace("gc-designer-tables", "gc-fw-v2-obj")
js = js.replace(
    'typeof window.GC_DESIGNER_TABLE_INSTANCE_ID === "string"\n'
    "      ? window.GC_DESIGNER_TABLE_INSTANCE_ID\n"
    '      : "gc-fw-v2-obj";',
    'typeof window.GC_FW_V2_TABLE_INSTANCE_ID === "string"\n'
    "      ? window.GC_FW_V2_TABLE_INSTANCE_ID\n"
    '      : "fw_v2_o";',
)
js = js.replace(
    'var DESIGNER_TABLE_COL_LS_KEY = "gc-fw-v2-obj-cols-v1";',
    'var DESIGNER_TABLE_COL_LS_KEY = "gc-fw-v2-obj-cols-v1-" + DESIGNER_TABLE_INSTANCE_ID;',
)
js = js.replace(
    'var DESIGNER_TABLE_DESIGN_MODE_LS = "gc-fw-v2-obj-design-mode-on";',
    'var DESIGNER_TABLE_DESIGN_MODE_LS = "gc-fw-v2-obj-dm-" + DESIGNER_TABLE_INSTANCE_ID;',
)
needle = "  var tablesDdRoots = [];\n\n  var DESIGNER_TABLE_INSTANCE_ID"
ins = """  var tablesDdRoots = [];

  var LOCKED_ENTITY_TYPES = Array.isArray(window.GC_FW_V2_LOCK_ENTITY_TYPES)
    ? window.GC_FW_V2_LOCK_ENTITY_TYPES.map(function (x) {
        return String(x || "").trim();
      }).filter(Boolean)
    : [];

  var DESIGNER_TABLE_INSTANCE_ID"""
if needle not in js:
    raise SystemExit("needle missing for LOCKED insert")
js = js.replace(needle, ins, 1)
out = ROOT / "static" / "gc-fw-v2-object-data-table.js"
out.write_text(js, encoding="utf-8")
print("wrote", out, len(js), "chars")
