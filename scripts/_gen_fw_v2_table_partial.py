"""Generate templates/partials/fw_v2_object_data_table.html from designer_tables fragment."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = (ROOT / "templates" / "designer_tables.html").read_text(encoding="utf-8")
start = src.index("{% block content %}")
end = src.index("{{ net_cols_modal(", start)
chunk = src[start:end]
chunk = chunk.replace("{% block content %}", "{# Firewalls v2 object nav data table (generated from designer_tables fragment) #}")
chunk = chunk.replace("gc-designer-tables", "gc-fw-v2-obj")
chunk = chunk.replace(
    "{% if auth_client_state.user and (auth_client_state.user.role | default(\"\") | trim | lower) == \"designer\" %}",
    "{% set _r = (auth_client_state.user.role | default(\"\") | trim | lower) %}",
)
chunk = chunk.replace(
    "<span id=\"gc-fw-v2-obj-design-mode-marker\" hidden data-gc-designer-design-mode-eligible=\"1\"></span>\n    {% endif %}",
    "{% if _r in [\"designer\", \"superadmin\"] %}\n"
    "    <span id=\"gc-fw-v2-obj-design-mode-marker\" hidden data-gc-designer-design-mode-eligible=\"1\"></span>\n"
    "    {% endif %}",
)
chunk = chunk.replace(
    '<main class="layout single gc-designer" data-gc-designer-tables="1">',
    '<div class="gc-fw-v2-object-table-root gc-designer" data-gc-fw-v2-object-table="1">',
)
chunk = chunk.replace("</main>", "</div>")
chunk = chunk.replace("Table properties", "Table properties (this page)")
chunk = chunk.replace(
    "Open <strong>Data source &amp; properties</strong> to choose cached types, then use <strong>Save</strong> in the panel footer to persist settings and refresh the preview.",
    "Object types for this navigator page are fixed from the Object navigator. Use <strong>Save</strong> in the panel to persist column and display settings for this path.",
)
out = ROOT / "templates" / "partials" / "fw_v2_object_data_table.html"
out.write_text(
    "{% from \"partials/net_entity_table_macros.html\" import net_filters_aside, net_entity_table_wrap, net_cols_modal %}\n"
    + chunk
    + '{{ net_cols_modal("gc-fw-v2-obj") }}\n',
    encoding="utf-8",
)
print("wrote", out)
