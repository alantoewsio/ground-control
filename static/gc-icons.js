/* ---------------------------------------------------------------------------
   Ground Control -- Google Material Symbols (Filled) helper
   Counterpart to templates/partials/_icons.html `icon()` macro.

   Project standard: every icon renders FILLED. The CSS already sets FILL=1
   on `.gc-icon`, so the `filled` option is a no-op alias kept for back-compat.

   Usage in JS-built markup:
     gcIcon("close")
     gcIcon("delete", { size: "sm", cls: "gc-icon--danger" })
     gcIcon("check_circle", { ariaLabel: "Saved" })

   Returns a string of HTML (so it can be concatenated into innerHTML / template
   literals just like the inline <svg> strings it replaces).

   For DOM-creation use gcIconEl(...) which returns an HTMLSpanElement.
   -------------------------------------------------------------------------- */
(function () {
  "use strict";

  var SIZES = { xs: true, sm: true, md: true, lg: true, xl: true };

  function escAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escText(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function buildClassList(opts) {
    var size = opts.size && SIZES[opts.size] ? opts.size : "md";
    var classes = ["gc-icon", "gc-icon--" + size];
    if (opts.bold) classes.push("gc-icon--bold");
    if (opts.cls) classes.push(opts.cls);
    return classes.join(" ");
  }

  /** Returns an HTML string for a (filled) Material Symbol. */
  function gcIcon(name, opts) {
    opts = opts || {};
    var classAttr = buildClassList(opts);
    var ariaAttrs = opts.ariaLabel
      ? 'role="img" aria-label="' + escAttr(opts.ariaLabel) + '"'
      : 'aria-hidden="true"';
    var extra = opts.attrs ? " " + opts.attrs : "";
    return (
      '<span class="' + classAttr + '" ' + ariaAttrs + extra + ">" +
      escText(name) +
      "</span>"
    );
  }

  /** Returns an HTMLSpanElement for a (filled) Material Symbol. */
  function gcIconEl(name, opts) {
    opts = opts || {};
    var span = document.createElement("span");
    span.className = buildClassList(opts);
    if (opts.ariaLabel) {
      span.setAttribute("role", "img");
      span.setAttribute("aria-label", opts.ariaLabel);
    } else {
      span.setAttribute("aria-hidden", "true");
    }
    span.textContent = String(name == null ? "" : name);
    return span;
  }

  window.gcIcon = gcIcon;
  window.gcIconEl = gcIconEl;
})();
