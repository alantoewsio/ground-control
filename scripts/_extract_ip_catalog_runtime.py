from pathlib import Path

root = Path(__file__).resolve().parent.parent
p = root / "templates/partials/gc_designer_controls_scripts.html"
lines = p.read_text(encoding="utf-8").splitlines()
chunk_a = lines[206:1175]
chunk_b = lines[1695:1724]
header = '(function () {\n  "use strict";\n'
footer = """
  window.__gcDesignerControlsBridge = window.__gcDesignerControlsBridge || {};
  window.__gcDesignerControlsBridge.ip = {
    readAllGcIpAttrs: readAllGcIpAttrs,
    clearAllGcIpAttrs: clearAllGcIpAttrs,
    writeAllGcIpAttrs: writeAllGcIpAttrs,
    hasAppliedIpConstraints: hasAppliedIpConstraints,
    readOptsFromInput: readOptsFromInput,
    wireCatalogIpInput: function (input, errEl, okEl, previewEl, maskPillEl, family) {
      wireIpField(input, errEl, okEl, previewEl, maskPillEl, family, function () {
        return readOptsFromInput(input);
      });
    }
  };
})();
"""
out = root / "static/gc-ip-field-catalog-runtime.js"
prologue = (
    "/**\n"
    " * Shared IP validation + catalog wiring for object-edit flyout (Firewalls v2, etc.).\n"
    " * Extracted from templates/partials/gc_designer_controls_scripts.html; re-run:\n"
    " *   uv run python scripts/_extract_ip_catalog_runtime.py\n"
    " */\n"
)
out.write_text(prologue + header + "\n".join(chunk_a) + "\n" + "\n".join(chunk_b) + footer, encoding="utf-8")
print("wrote", out)
