/**
 * Per-column facet filters: enum columns get checkboxes (with optional in-group search),
 * high-cardinality / long-text columns get a "contains" search field.
 *
 * Facet sections start collapsed unless the column has an active filter, the user opened
 * that section (sessionStorage, per-table storageKey), or a filter was just applied.
 *
 * Selected facet values (checkboxes + text contains) persist in sessionStorage per storageKey
 * so a full page refresh restores them after rebuild().
 */
(function (global) {
  "use strict";

  var MAX_ENUM_DISTINCT = 50;
  var ENUM_INNER_SEARCH_MIN = 8;
  var TEXT_MODE_MIN_MAXLEN = 80;
  var TEXT_MODE_DISTINCT_OVER = 55;
  var SS_PREFIX = "gc-facet-expanded:";
  var FILTER_VALUES_PREFIX = "gc-facet-values:";

  function ssKey(storageKey, colId) {
    return SS_PREFIX + storageKey + ":" + colId;
  }

  function groupHasActiveFilter(group) {
    if (!group) return false;
    if (group.querySelector("input[data-gc-facet-enum]:checked")) return true;
    var ti = group.querySelector("input[data-gc-facet-text]");
    return !!(ti && (ti.value || "").trim());
  }

  function setGroupOpen(group, open) {
    if (!group) return;
    var head = group.querySelector(".filter-group__head");
    if (open) {
      group.classList.add("is-open");
      if (head) head.setAttribute("aria-expanded", "true");
    } else {
      group.classList.remove("is-open");
      if (head) head.setAttribute("aria-expanded", "false");
    }
  }

  function applyFacetGroupOpenState(drawerEl, storageKey) {
    if (!drawerEl) return;
    drawerEl.querySelectorAll(".filter-group[data-gc-facet-for-col]").forEach(function (g) {
      var col = g.getAttribute("data-gc-facet-for-col");
      if (!col) return;
      var suppressAuto =
        g.getAttribute("data-gc-facet-suppress-auto-open") === "1";
      var wantOpen = !suppressAuto && groupHasActiveFilter(g);
      if (!wantOpen && storageKey) {
        try {
          wantOpen = sessionStorage.getItem(ssKey(storageKey, col)) === "1";
        } catch (e) {
          wantOpen = false;
        }
      }
      setGroupOpen(g, wantOpen);
    });
  }

  function expandFacetGroupForElement(el, storageKey) {
    if (!storageKey) return;
    var g = el.closest(".filter-group");
    if (!g) return;
    var col = g.getAttribute("data-gc-facet-for-col");
    if (!col) return;
    setGroupOpen(g, true);
    try {
      sessionStorage.setItem(ssKey(storageKey, col), "1");
    } catch (e) {}
  }

  function clearExpandedSessionForDrawer(drawerEl, storageKey) {
    if (!drawerEl || !storageKey) return;
    drawerEl.querySelectorAll(".filter-group[data-gc-facet-for-col]").forEach(function (g) {
      var col = g.getAttribute("data-gc-facet-for-col");
      if (!col) return;
      try {
        sessionStorage.removeItem(ssKey(storageKey, col));
      } catch (e) {}
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function facetEncodeValue(s) {
    return encodeURIComponent(String(s));
  }

  function facetDecodeValue(enc) {
    try {
      return decodeURIComponent(enc);
    } catch (e) {
      return "";
    }
  }

  function normCell(s) {
    return s == null ? "" : String(s);
  }

  function collectClassification(cellStrings) {
    var seen = Object.create(null);
    var distinctList = [];
    var maxLen = 0;
    for (var i = 0; i < cellStrings.length; i++) {
      var raw = normCell(cellStrings[i]);
      if (raw.length > maxLen) maxLen = raw.length;
      var t = raw.trim();
      var key = t === "" ? "\u0000" : t;
      if (!seen[key]) {
        seen[key] = true;
        distinctList.push(t);
      }
    }
    var n = distinctList.length;
    if (n === 0) return { kind: "empty" };
    if (maxLen >= TEXT_MODE_MIN_MAXLEN) return { kind: "text" };
    if (n > MAX_ENUM_DISTINCT || n > TEXT_MODE_DISTINCT_OVER) return { kind: "text" };
    distinctList.sort(function (a, b) {
      var ae = a === "" ? 1 : 0;
      var be = b === "" ? 1 : 0;
      if (ae !== be) return ae - be;
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    return { kind: "enum", options: distinctList };
  }

  function buildFilterGroup(colId, label, cls, suppressAutoOpen) {
    var safeCol = escapeHtml(colId);
    var safeLabel = escapeHtml(label);
    var suppressAttr =
      suppressAutoOpen ? ' data-gc-facet-suppress-auto-open="1"' : "";
    if (cls.kind === "empty") return "";
    if (cls.kind === "text") {
      return (
        '<div class="filter-group" data-gc-facet-group data-gc-facet-for-col="' +
        safeCol +
        '"' +
        suppressAttr +
        '>' +
        '<button type="button" class="filter-group__head" aria-expanded="false">' +
        "<span>" +
        safeLabel +
        "</span>" +
        '<span class="filter-group__chev" aria-hidden="true">▼</span>' +
        "</button>" +
        '<div class="filter-group__body">' +
        '<div class="filter-group__facet-text">' +
        '<input type="search" class="filter-group__facet-text-input" placeholder="Contains text…" autocomplete="off" aria-label="' +
        escapeHtml("Filter " + label) +
        '" data-gc-facet-text="' +
        safeCol +
        '" />' +
        "</div></div></div>"
      );
    }
    var opts = cls.options;
    var showSearch = opts.length >= ENUM_INNER_SEARCH_MIN;
    var parts = [];
    parts.push(
      '<div class="filter-group" data-gc-facet-group data-gc-facet-for-col="' +
        safeCol +
        '"' +
        suppressAttr +
        '>' +
        '<button type="button" class="filter-group__head" aria-expanded="false">' +
        "<span>" +
        safeLabel +
        '</span><span class="filter-group__chev" aria-hidden="true">▼</span></button><div class="filter-group__body">',
    );
    parts.push(
      '<div class="filter-group__facet-search"' +
        (showSearch ? "" : " hidden") +
        '><input type="search" class="filter-group__facet-search-input" placeholder="Search values…" autocomplete="off" aria-label="' +
        escapeHtml("Search " + label + " values") +
        '" data-gc-facet-search="' +
        safeCol +
        '" /></div>',
    );
    for (var j = 0; j < opts.length; j++) {
      var opt = opts[j];
      var enc = facetEncodeValue(opt);
      var display = opt.trim() === "" ? "(empty)" : opt;
      if (display.length > 72) display = display.slice(0, 69) + "…";
      var nameSlug = String(j) + "_" + String(colId).replace(/[^a-zA-Z0-9_-]/g, "_");
      parts.push(
        '<label class="filter-opt" data-gc-facet-opt title="' +
          escapeAttr(opt) +
          '"><input type="checkbox" name="gc-facet-' +
          escapeHtml(nameSlug) +
          '" value="' +
          escapeHtml(enc) +
          '" data-gc-facet-enum="' +
          safeCol +
          '" /><span>' +
          escapeHtml(display) +
          "</span></label>",
      );
    }
    parts.push("</div></div>");
    return parts.join("");
  }

  function filterValuesKey(storageKey) {
    return FILTER_VALUES_PREFIX + storageKey;
  }

  function serializeFilterDrawer(drawerEl) {
    var e = Object.create(null);
    drawerEl.querySelectorAll("input[data-gc-facet-enum]:checked").forEach(function (cb) {
      var cid = cb.getAttribute("data-gc-facet-enum");
      if (!cid) return;
      if (!e[cid]) e[cid] = [];
      e[cid].push(cb.value);
    });
    var t = Object.create(null);
    drawerEl.querySelectorAll("input[data-gc-facet-text]").forEach(function (inp) {
      var cid = inp.getAttribute("data-gc-facet-text");
      if (!cid) return;
      var v = (inp.value || "").trim();
      if (v) t[cid] = v;
    });
    var out = { v: 1 };
    if (Object.keys(e).length) out.e = e;
    if (Object.keys(t).length) out.t = t;
    return out;
  }

  function persistFilterState(drawerEl, storageKey) {
    if (!drawerEl || !storageKey) return;
    if (!drawerEl.querySelector(".filter-group[data-gc-facet-for-col]")) return;
    try {
      var o = serializeFilterDrawer(drawerEl);
      if (!o.e && !o.t) sessionStorage.removeItem(filterValuesKey(storageKey));
      else sessionStorage.setItem(filterValuesKey(storageKey), JSON.stringify(o));
    } catch (err) {}
  }

  function readFilterState(storageKey) {
    if (!storageKey) return null;
    try {
      var raw = sessionStorage.getItem(filterValuesKey(storageKey));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function clearFilterValuesState(storageKey) {
    if (!storageKey) return;
    try {
      sessionStorage.removeItem(filterValuesKey(storageKey));
    } catch (err) {}
  }

  function applyFilterDrawerState(drawerEl, state) {
    if (!drawerEl || !state || state.v !== 1) return;
    if (state.e && typeof state.e === "object") {
      Object.keys(state.e).forEach(function (cid) {
        var vals = state.e[cid];
        if (!Array.isArray(vals)) return;
        var want = Object.create(null);
        for (var i = 0; i < vals.length; i++) want[vals[i]] = true;
        drawerEl.querySelectorAll("input[data-gc-facet-enum]").forEach(function (cb) {
          if (cb.getAttribute("data-gc-facet-enum") !== cid) return;
          if (want[cb.value]) cb.checked = true;
        });
      });
    }
    if (state.t && typeof state.t === "object") {
      Object.keys(state.t).forEach(function (cid) {
        var v = state.t[cid];
        if (v == null) return;
        var s = String(v);
        drawerEl.querySelectorAll("input[data-gc-facet-text]").forEach(function (inp) {
          if (inp.getAttribute("data-gc-facet-text") === cid) inp.value = s;
        });
      });
    }
    drawerEl.querySelectorAll("input[data-gc-facet-search]").forEach(function (inp) {
      inp.value = "";
      var group = inp.closest(".filter-group");
      if (!group) return;
      group.querySelectorAll("[data-gc-facet-opt]").forEach(function (lab) {
        lab.style.display = "";
      });
    });
  }

  function attachFacetGroupListeners(root, storageKey) {
    if (!root) return;
    root.querySelectorAll("[data-gc-facet-search]").forEach(function (inp) {
      if (inp.dataset.gcFacetSearchBound === "1") return;
      inp.dataset.gcFacetSearchBound = "1";
      inp.addEventListener("input", function () {
        var q = (inp.value || "").trim().toLowerCase();
        var group = inp.closest(".filter-group");
        if (!group) return;
        group.querySelectorAll("[data-gc-facet-opt]").forEach(function (lab) {
          var t = (lab.textContent || "").trim().toLowerCase();
          lab.style.display = !q || t.indexOf(q) !== -1 ? "" : "none";
        });
      });
    });
    root.querySelectorAll(".filter-group__head").forEach(function (btn) {
      if (btn.dataset.gcFacetHeadBound === "1") return;
      btn.dataset.gcFacetHeadBound = "1";
      btn.addEventListener("click", function () {
        var g = btn.closest(".filter-group");
        if (!g) return;
        var open = g.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        var col = g.getAttribute("data-gc-facet-for-col");
        if (!storageKey || !col) return;
        try {
          if (open) sessionStorage.setItem(ssKey(storageKey, col), "1");
          else sessionStorage.removeItem(ssKey(storageKey, col));
        } catch (e) {}
      });
    });
  }

  global.gcTableFacets = {
    setRowFacets: function (tr, cellMap) {
      tr.setAttribute("data-gc-row-facets", JSON.stringify(cellMap));
    },

    rebuild: function (drawerEl, columns, rowCellMaps, storageKey) {
      if (!drawerEl) return;
      var html = "";
      for (var c = 0; c < columns.length; c++) {
        var col = columns[c];
        var id = col.id;
        var lab = col.label || id;
        var values = [];
        for (var r = 0; r < rowCellMaps.length; r++) {
          var m = rowCellMaps[r] || {};
          values.push(m[id] != null ? String(m[id]) : "");
        }
        var cls = collectClassification(values);
        if (cls.kind === "empty") continue;
        html += buildFilterGroup(id, lab, cls, col.facetSuppressAutoOpen === true);
      }
      drawerEl.innerHTML = html;
      attachFacetGroupListeners(drawerEl, storageKey);
      applyFilterDrawerState(drawerEl, readFilterState(storageKey));
      applyFacetGroupOpenState(drawerEl, storageKey);
    },

    appliedCount: function (drawerEl) {
      if (!drawerEl) return 0;
      var n = 0;
      drawerEl.querySelectorAll("input[data-gc-facet-enum]:checked").forEach(function () {
        n++;
      });
      drawerEl.querySelectorAll("input[data-gc-facet-text]").forEach(function (inp) {
        if ((inp.value || "").trim()) n++;
      });
      return n;
    },

    reset: function (drawerEl, storageKey) {
      if (!drawerEl) return;
      clearFilterValuesState(storageKey);
      clearExpandedSessionForDrawer(drawerEl, storageKey);
      drawerEl.querySelectorAll("input[data-gc-facet-enum]").forEach(function (cb) {
        if (cb.type === "checkbox") cb.checked = false;
      });
      drawerEl.querySelectorAll("input[data-gc-facet-text]").forEach(function (inp) {
        inp.value = "";
      });
      drawerEl.querySelectorAll("[data-gc-facet-opt]").forEach(function (lab) {
        lab.style.display = "";
      });
      applyFacetGroupOpenState(drawerEl, storageKey);
    },

    rowMatches: function (tr, drawerEl) {
      if (!drawerEl) return true;
      var raw = tr.getAttribute("data-gc-row-facets");
      var map;
      try {
        map = raw ? JSON.parse(raw) : {};
      } catch (e) {
        map = {};
      }
      var byColEnum = Object.create(null);
      drawerEl.querySelectorAll("input[data-gc-facet-enum]:checked").forEach(function (cb) {
        var cid = cb.getAttribute("data-gc-facet-enum");
        if (!cid) return;
        if (!byColEnum[cid]) byColEnum[cid] = [];
        byColEnum[cid].push(facetDecodeValue(cb.value));
      });
      var keys = Object.keys(byColEnum);
      for (var i = 0; i < keys.length; i++) {
        var col = keys[i];
        var selected = byColEnum[col];
        var cell = map[col] != null ? String(map[col]) : "";
        if (selected.indexOf(cell) === -1) return false;
      }
      var textInputs = drawerEl.querySelectorAll("input[data-gc-facet-text]");
      for (var t = 0; t < textInputs.length; t++) {
        var inp = textInputs[t];
        var q = (inp.value || "").trim().toLowerCase();
        if (!q) continue;
        var colId = inp.getAttribute("data-gc-facet-text");
        var hay = map[colId] != null ? String(map[colId]).toLowerCase() : "";
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    },

    bindAside: function (asideEl, onChange, storageKey) {
      if (!asideEl || asideEl.dataset.gcFacetAsideBound === "1") return;
      asideEl.dataset.gcFacetAsideBound = "1";
      function drawerFromAside() {
        return asideEl.querySelector(".filters__drawer");
      }
      function fire() {
        var dr = drawerFromAside();
        if (dr && storageKey) persistFilterState(dr, storageKey);
        if (typeof onChange === "function") onChange();
      }
      asideEl.addEventListener("change", function (e) {
        var t = e.target;
        if (t && t.matches && t.matches("input[data-gc-facet-enum]")) {
          if (t.checked) expandFacetGroupForElement(t, storageKey);
          fire();
        }
      });
      asideEl.addEventListener("input", function (e) {
        var t = e.target;
        if (t && t.matches && t.matches("input[data-gc-facet-text]")) {
          if ((t.value || "").trim()) expandFacetGroupForElement(t, storageKey);
          fire();
        }
      });
    },

    /**
     * Restore toolbar search from sessionStorage and keep it in sync (survives refresh).
     * @param {HTMLInputElement} inputEl
     * @param {string} storageKey - same namespace as facet storageKey for this table
     * @param {function(): void} [onApply] - e.g. applyRowFilter; called after restore and on each input
     */
    bindToolbarSearch: function (inputEl, storageKey, onApply) {
      if (!inputEl || !storageKey) return;
      var k = "gc-toolbar-search:" + storageKey;
      var hadStored = false;
      try {
        var v = sessionStorage.getItem(k);
        if (v != null && v !== "") {
          inputEl.value = v;
          hadStored = true;
        }
      } catch (e) {}
      if (hadStored && typeof onApply === "function") onApply();
      inputEl.addEventListener("input", function () {
        try {
          if ((inputEl.value || "") === "") sessionStorage.removeItem(k);
          else sessionStorage.setItem(k, inputEl.value);
        } catch (e2) {}
        if (typeof onApply === "function") onApply();
      });
    },

    clearToolbarSearchStorage: function (storageKey) {
      if (!storageKey) return;
      try {
        sessionStorage.removeItem("gc-toolbar-search:" + storageKey);
      } catch (e) {}
    },

    /** Persist checkbox/text facet state (call after programmatic input changes). */
    persistFilterDrawerState: function (drawerEl, storageKey) {
      persistFilterState(drawerEl, storageKey);
    },

    /** Bind accordion/search handlers on facet groups appended after rebuild() (e.g. custom filter blocks). */
    bindNewFacetGroups: function (root, storageKey) {
      attachFacetGroupListeners(root, storageKey);
    },

    /** Re-apply sessionStorage facet checkboxes/text after injecting extra filter groups. */
    reapplyPersistedFilters: function (drawerEl, storageKey) {
      if (!drawerEl || !storageKey) return;
      applyFilterDrawerState(drawerEl, readFilterState(storageKey));
      applyFacetGroupOpenState(drawerEl, storageKey);
    },

    /** Recompute open/closed state for facet accordions (e.g. after programmatic changes). */
    syncFacetGroupOpenState: function (drawerEl, storageKey) {
      applyFacetGroupOpenState(drawerEl, storageKey);
    },

    /** Decode a single enum checkbox value (encodeURIComponent form). */
    decodeFacetEnumValue: function (enc) {
      return facetDecodeValue(enc);
    },
  };
})(window);
