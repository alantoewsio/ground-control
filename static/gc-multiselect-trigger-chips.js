/**
 * Renders selected multiselect values as removable pills inside a dropdown trigger
 * (same interaction model as designer tag pills: × visible on hover).
 */
(function (global) {
  "use strict";

  /**
   * @param {HTMLElement} chipsHost
   * @param {Array<{ label: string, removeLabel?: string, title?: string, onRemove: function(): void }>} items
   */
  function gcRenderMultiselectTriggerChips(chipsHost, items) {
    if (!chipsHost) return;
    chipsHost.innerHTML = "";
    (items || []).forEach(function (it) {
      if (!it || !it.label) return;
      var span = document.createElement("span");
      span.className = "gc-ms-trigger-chip";
      var t = document.createElement("span");
      t.className = "gc-ms-trigger-chip__text mono";
      t.textContent = it.label;
      if (it.title) t.title = it.title;
      span.appendChild(t);
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "gc-ms-trigger-chip__remove";
      rm.setAttribute("aria-label", it.removeLabel || "Remove " + it.label);
      rm.innerHTML = "\u00d7";
      rm.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
      rm.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        it.onRemove();
      });
      span.appendChild(rm);
      chipsHost.appendChild(span);
    });
  }

  global.gcRenderMultiselectTriggerChips = gcRenderMultiselectTriggerChips;
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof window !== "undefined"
      ? window
      : this
);
