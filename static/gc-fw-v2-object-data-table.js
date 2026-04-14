/**
 * Firewalls v2 · object navigator: full designer sandbox table (facets, design mode, save).
 * Source: `templates/designer_tables.html` — regenerate with `scripts/_extract_fw_v2_table_js.py`,
 * then re-apply FW v2 edits (LOCKED_ENTITY_TYPES, GC_FW_V2_NAV_TABBED / loadDesignerEntityTypeList,
 * pencil/backdrop classes, lsKey: DESIGNER_TABLE_COL_LS_KEY for dirty/save parity with column_visibility).
 */
(function () {
  "use strict";

  var tablesDdRoots = [];

  var LOCKED_ENTITY_TYPES = Array.isArray(window.GC_FW_V2_LOCK_ENTITY_TYPES)
    ? window.GC_FW_V2_LOCK_ENTITY_TYPES.map(function (x) {
      return String(x || "").trim();
    }).filter(Boolean)
    : [];

  /** When true, allowed object types are exactly LOCKED_ENTITY_TYPES (may be empty); never fall back to all cache types. */
  var NAV_TABBED = !!window.GC_FW_V2_NAV_TABBED;

  var DESIGNER_TABLE_INSTANCE_ID =
    typeof window.GC_FW_V2_TABLE_INSTANCE_ID === "string"
      ? window.GC_FW_V2_TABLE_INSTANCE_ID
      : "fw_v2_o";
  var DESIGNER_TABLE_COL_LS_KEY = "gc-fw-v2-obj-cols-v1-" + DESIGNER_TABLE_INSTANCE_ID;
  var DESIGNER_TABLE_DESIGN_MODE_LS = "gc-fw-v2-obj-dm-" + DESIGNER_TABLE_INSTANCE_ID;
  var designerTablePropsSavedSnapshot = null;
  /** When true, the next table render (after async refresh) captures the dirty baseline. */
  var designerTablePersistBaselineAfterNextRender = false;
  var designerTablesLeaveNavHref = null;
  var designerTablePropsPending = null;
  var designerTablePropsUsePendingEntityTypes = false;
  var designerTablePropsDidHydrateColumns = false;

  function designerTablePropsApiUrl() {
    return "/api/designer/table-properties/" + encodeURIComponent(DESIGNER_TABLE_INSTANCE_ID);
  }

  function applyTableTitleFromInput() {
    var inp = document.getElementById("gc-fw-v2-obj-prop-title");
    var h = document.getElementById("gc-fw-v2-obj-table-title");
    if (!inp || !h) return;
    var t = String(inp.value || "").trim();
    h.textContent = t || "Preview table";
  }

  function getHiddenColumnIdsForSave() {
    var out = [];
    document.querySelectorAll("#gc-fw-v2-obj-hide-list input[type=checkbox]:checked").forEach(function (cb) {
      var v = String(cb.value || "").trim();
      if (v) out.push(v);
    });
    return out;
  }

  /** Stable order for API + dirty snapshots (DOM order varies when the hide list is rebuilt). */
  function getHiddenColumnIdsForSaveSorted() {
    return getHiddenColumnIdsForSave().slice().sort();
  }

  /** Full designer table settings (API shape); also returned by designerTableApi.getTablePropertiesJson(). */
  function collectDesignerTablePropsPayload() {
    var colVis = null;
    try {
      var raw = localStorage.getItem(DESIGNER_TABLE_COL_LS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") colVis = o;
      }
    } catch (eCv) { }
    return {
      title: (document.getElementById("gc-fw-v2-obj-prop-title") || {}).value,
      design_mode: !!(document.getElementById("gc-fw-v2-obj-design-mode") || {}).checked,
      entity_types: getSelectedEntityTypes(),
      secondary_filters: collectSecondaryFilterRules(),
      hidden_column_ids: getHiddenColumnIdsForSaveSorted(),
      column_order: (document.getElementById("gc-fw-v2-obj-col-order") || {}).value,
      column_overrides: (document.getElementById("gc-fw-v2-obj-col-overrides") || {}).value,
      opt_row_selectors: !!(document.getElementById("gc-fw-v2-obj-opt-row-selectors") || {}).checked,
      opt_add_btn: !!(document.getElementById("gc-fw-v2-obj-opt-add-btn") || {}).checked,
      opt_delete_btn: !!(document.getElementById("gc-fw-v2-obj-opt-delete-btn") || {}).checked,
      opt_read_only: !!(document.getElementById("gc-fw-v2-obj-opt-read-only") || {}).checked,
      opt_combine_view: !!(document.getElementById("gc-fw-v2-obj-combine") || {}).checked,
      combine_by_column: String(
        (document.getElementById("gc-fw-v2-obj-combine-by-column") || {}).value || "",
      ).trim(),
      column_visibility: colVis,
    };
  }

  function designerTableStableSnapshotJson(payload) {
    function ser(x) {
      if (x === null) return "null";
      var t = typeof x;
      if (t === "string") return JSON.stringify(x);
      if (t === "number" || t === "boolean") return JSON.stringify(x);
      if (Array.isArray(x)) return "[" + x.map(ser).join(",") + "]";
      if (t === "object") {
        var keys = Object.keys(x).sort();
        var parts = [];
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (!Object.prototype.hasOwnProperty.call(x, k)) continue;
          var v = x[k];
          if (v === undefined) continue;
          parts.push(JSON.stringify(k) + ":" + ser(v));
        }
        return "{" + parts.join(",") + "}";
      }
      return JSON.stringify(String(x));
    }
    return ser(payload);
  }

  function designerTablePropsSnapshotStable() {
    var p = null;
    if (designerTableApi && typeof designerTableApi.getTablePropertiesJson === "function") {
      p = designerTableApi.getTablePropertiesJson();
    } else {
      p = collectDesignerTablePropsPayload();
    }
    return designerTableStableSnapshotJson(p || {});
  }

  function markDesignerTablePropsSaved() {
    designerTablePropsSavedSnapshot = designerTablePropsSnapshotStable();
  }

  function designerTablePropsDirty() {
    if (designerTablePropsSavedSnapshot == null) return false;
    return designerTablePropsSnapshotStable() !== designerTablePropsSavedSnapshot;
  }

  function setDesignerTableSaveStatus(msg, isErr) {
    var el = document.getElementById("gc-fw-v2-obj-props-save-status");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = isErr ? "var(--danger, #b91c1c)" : "";
    if (el._gcSaveT) clearTimeout(el._gcSaveT);
    if (msg) {
      el._gcSaveT = setTimeout(function () {
        el.textContent = "";
      }, 5000);
    }
  }

  function rebuildSecondaryFiltersFromPending(filters) {
    var tb = document.getElementById("gc-fw-v2-obj-secondary-filters-tbody");
    if (!tb) return;
    tb.querySelectorAll("tr[data-gc-secondary-filter-row]").forEach(function (tr) {
      if (typeof tr._gcDismissTableFilterSuggest === "function") {
        try {
          tr._gcDismissTableFilterSuggest();
        } catch (eD) { }
      }
      tr.remove();
    });
    var list = Array.isArray(filters) ? filters : [];
    if (!list.length) {
      addSecondaryFilterRow();
      return;
    }
    list.forEach(function (f) {
      if (!f || typeof f !== "object") return;
      var tr = createSecondaryFilterRow();
      var op = String(f.op || "=").trim();
      var opSel = tr.querySelector(".gc-fw-v2-obj-f-op");
      var propSel = tr.querySelector(".gc-fw-v2-obj-f-prop");
      if (opSel) opSel.value = op;
      ensureFilterRowValueCell(tr, op);
      if (propSel) propSel.value = String(f.prop || "").trim();
      if (op === "in") {
        var api = tr._gcTagEditor;
        if (api && typeof api.setTags === "function") api.setTags(f.tags || []);
      } else {
        var inp = tr.querySelector(".gc-fw-v2-obj-f-scalar");
        if (inp) inp.value = f.scalar != null ? String(f.scalar) : "";
      }
      tb.appendChild(tr);
    });
  }

  function applyPendingHideColumnIds(ids) {
    if (!ids || !ids.length) return;
    var set = Object.create(null);
    ids.forEach(function (id) {
      var s = String(id || "").trim();
      if (s) set[s] = true;
    });
    document.querySelectorAll("#gc-fw-v2-obj-hide-list input[type=checkbox]").forEach(function (cb) {
      if (set[cb.value]) cb.checked = true;
    });
    var hideRoot = document.getElementById("gc-fw-v2-obj-hide-dd");
    if (hideRoot && hideRoot._gcTablesDdRefreshMultiLabel) hideRoot._gcTablesDdRefreshMultiLabel();
  }

  function applySecondaryFilterPropsFromPending(p) {
    if (!p || !Array.isArray(p.secondary_filters)) return;
    var tb = document.getElementById("gc-fw-v2-obj-secondary-filters-tbody");
    if (!tb) return;
    var rows = tb.querySelectorAll("tr[data-gc-secondary-filter-row]");
    var sf = p.secondary_filters;
    for (var i = 0; i < sf.length && i < rows.length; i++) {
      var tr = rows[i];
      var f = sf[i];
      if (!f || typeof f !== "object") continue;
      var propSel = tr.querySelector(".gc-fw-v2-obj-f-prop");
      if (propSel) propSel.value = String(f.prop || "").trim();
    }
  }

  function designerTablePropBool(v) {
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    if (typeof v === "string") {
      var t = v.trim().toLowerCase();
      if (t === "1" || t === "true" || t === "yes" || t === "on") return true;
      if (t === "0" || t === "false" || t === "no" || t === "off" || t === "") return false;
    }
    return !!v;
  }

  function applyLoadedDesignerTableProps(p, opts) {
    if (!p || typeof p !== "object") return;
    opts = opts || {};
    designerTablePropsPending = p;
    designerTablePropsUsePendingEntityTypes = Array.isArray(p.entity_types);
    designerTablePropsDidHydrateColumns = false;
    var titleInp = document.getElementById("gc-fw-v2-obj-prop-title");
    if (titleInp) titleInp.value = p.title != null ? String(p.title) : "";
    applyTableTitleFromInput();
    var co = document.getElementById("gc-fw-v2-obj-col-order");
    var ov = document.getElementById("gc-fw-v2-obj-col-overrides");
    if (opts.preserveColumnLayout) {
      designerTablePropsPending = Object.assign({}, p, {
        column_order: co ? String(co.value || "") : p.column_order != null ? String(p.column_order) : "",
        column_overrides: ov ? String(ov.value || "") : p.column_overrides != null ? String(p.column_overrides) : "",
      });
    } else {
      if (co) co.value = p.column_order != null ? String(p.column_order) : "";
      if (ov) ov.value = p.column_overrides != null ? String(p.column_overrides) : "";
    }
    function setOpt(id, v) {
      var el = document.getElementById(id);
      if (el) el.checked = designerTablePropBool(v);
    }
    function optWithDefault(v, defaultOn) {
      if (v === undefined || v === null) return !!defaultOn;
      return designerTablePropBool(v);
    }
    setOpt("gc-fw-v2-obj-opt-row-selectors", optWithDefault(p.opt_row_selectors, true));
    setOpt("gc-fw-v2-obj-opt-add-btn", optWithDefault(p.opt_add_btn, true));
    setOpt("gc-fw-v2-obj-opt-delete-btn", optWithDefault(p.opt_delete_btn, true));
    setOpt("gc-fw-v2-obj-opt-read-only", optWithDefault(p.opt_read_only, false));
    var combOn = p.opt_combine_view !== false;
    setOpt("gc-fw-v2-obj-combine", combOn);
    setOpt("gc-fw-v2-obj-opt-combine-view", combOn);
    try {
      localStorage.setItem(fwV2ObjCombineStorageKey(), combOn ? "1" : "0");
    } catch (eLscv) { }
    try {
      if (p.column_visibility && typeof p.column_visibility === "object") {
        localStorage.setItem(DESIGNER_TABLE_COL_LS_KEY, JSON.stringify(p.column_visibility));
      }
    } catch (eLs) { }
    var dmcEarly = document.getElementById("gc-fw-v2-obj-design-mode");
    if (dmcEarly && !opts.preserveDesignMode) {
      dmcEarly.checked = !!p.design_mode;
      try {
        sessionStorage.setItem(DESIGNER_TABLE_DESIGN_MODE_LS, dmcEarly.checked ? "1" : "0");
      } catch (eSs) { }
    }
    rebuildSecondaryFiltersFromPending(p.secondary_filters);
    if (typeof syncDesignerTableToolbarOpts === "function") syncDesignerTableToolbarOpts();
    if (typeof updateDesignerReadOnlyToolbarButtons === "function") updateDesignerReadOnlyToolbarButtons();
    if (typeof updateDesignerDesignModeChrome === "function") updateDesignerDesignModeChrome();
  }

  function wireTablesSearchableDropdown(root) {
    if (!root) return;
    var shell = root.querySelector(".gc-designer-dd__shell");
    var panel = root.querySelector(".gc-designer-dd__panel");
    var search = root.querySelector(".gc-designer-dd__search");
    var trigger = root.querySelector(".gc-designer-dd__trigger");
    var list = root.querySelector(".gc-designer-dd__list");
    if (!shell || !trigger || !list) return;

    tablesDdRoots.push(root);

    function setOpen(open) {
      if (panel) panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open && search) {
        search.value = "";
        filterList();
        try {
          search.focus();
        } catch (e1) { }
      }
    }

    function filterList() {
      var q = (search && search.value ? search.value : "").trim().toLowerCase();
      var items = list.querySelectorAll("li[role='option']");
      for (var i = 0; i < items.length; i++) {
        var li = items[i];
        var t = li.textContent.trim().toLowerCase();
        li.hidden = q && t.indexOf(q) === -1;
      }
    }

    root._gcTablesDdFilterList = filterList;
    if (search) search.addEventListener("input", filterList);

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var opening = panel ? panel.hidden : true;
      if (opening) {
        for (var j = 0; j < tablesDdRoots.length; j++) {
          var other = tablesDdRoots[j];
          if (other !== root && other._gcTablesDdSetOpen) other._gcTablesDdSetOpen(false);
        }
      }
      setOpen(opening);
    });

    function refreshMultiLabel() {
      var labels = [];
      var boxes = list.querySelectorAll("input[type='checkbox']");
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) {
          var li = boxes[i].closest("li");
          var pl = li ? li.getAttribute("data-gc-dd-primary") : "";
          if (pl) labels.push(pl);
        }
      }
      var emptyLabel = root.getAttribute("data-gc-dd-empty-label") || "None selected";
      trigger.textContent = labels.length ? labels.join(", ") : emptyLabel;
    }
    root._gcTablesDdRefreshMultiLabel = refreshMultiLabel;
    list.addEventListener("change", function (e) {
      if (e.target && e.target.matches && e.target.matches("input[type='checkbox']")) {
        var li = e.target.closest("li");
        if (li) li.setAttribute("aria-selected", e.target.checked ? "true" : "false");
        refreshMultiLabel();
      }
    });
    refreshMultiLabel();

    root._gcTablesDdSetOpen = setOpen;
    shell.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  document.addEventListener("click", function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest(".gc-designer-table-dd")) {
      return;
    }
    tablesDdRoots.forEach(function (el) {
      if (el && el._gcTablesDdSetOpen) el._gcTablesDdSetOpen(false);
    });
  });

  var designerTablesUniqueByCol = {};
  var designerTablesMergedLabels = {};
  var designerTablesMergedCols = [];
  var secondaryFilterSeq = 0;

  function reindexUniqueValues(merged) {
    designerTablesMergedCols = merged && merged.columns ? merged.columns.slice() : [];
    designerTablesMergedLabels = Object.assign({}, (merged && merged.column_labels) || {});
    var cols = designerTablesMergedCols;
    var map = Object.create(null);
    cols.forEach(function (c) {
      map[c] = Object.create(null);
    });
    (merged && merged.rows ? merged.rows : []).forEach(function (r) {
      var cells = r.cells || {};
      cols.forEach(function (c) {
        var v = cells[c];
        if (v == null || v === "") return;
        map[c][String(v)] = true;
      });
    });
    var out = Object.create(null);
    cols.forEach(function (c) {
      var keys = Object.keys(map[c] || {});
      keys.sort(function (a, b) {
        return a.localeCompare(b);
      });
      if (keys.length > 500) keys = keys.slice(0, 500);
      out[c] = keys;
    });
    designerTablesUniqueByCol = out;
  }

  function fillPropertySelect(sel, preserveValue) {
    if (!sel) return;
    var cols = designerTablesMergedCols || [];
    var labels = designerTablesMergedLabels || {};
    var prev = preserveValue ? sel.value : "";
    sel.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "(Property)";
    sel.appendChild(opt0);
    cols
      .slice()
      .sort(function (a, b) {
        var la = String(labels[a] != null ? labels[a] : a);
        var lb = String(labels[b] != null ? labels[b] : b);
        return la.localeCompare(lb);
      })
      .forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c;
        opt.textContent = String(labels[c] != null ? labels[c] : c);
        sel.appendChild(opt);
      });
    if (prev && cols.indexOf(prev) !== -1) sel.value = prev;
  }

  function syncAllSecondaryPropertySelects() {
    document.querySelectorAll("#gc-fw-v2-obj-secondary-filters-tbody .gc-fw-v2-obj-f-prop").forEach(function (sel) {
      fillPropertySelect(sel, true);
    });
  }

  function escapeRegexChar(ch) {
    if ("\\^$*+?.()|[]{}".indexOf(ch) !== -1) return "\\" + ch;
    return ch;
  }

  function globToRegExp(pattern) {
    var s = String(pattern);
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === "\\" && i + 1 < s.length) {
        out += escapeRegexChar(s[++i]);
        continue;
      }
      if (c === "*") {
        out += ".*";
        continue;
      }
      if (c === "?") {
        out += ".";
        continue;
      }
      out += escapeRegexChar(c);
    }
    try {
      return new RegExp("^" + out + "$", "i");
    } catch (eGlob) {
      return null;
    }
  }

  function parseComparableNumber(s) {
    var n = Number(String(s).trim());
    return isFinite(n) ? n : null;
  }

  function compareScalars(op, cellRaw, needleRaw) {
    var a = String(cellRaw == null ? "" : cellRaw).trim();
    var b = String(needleRaw == null ? "" : needleRaw).trim();
    var na = parseComparableNumber(a);
    var nb = parseComparableNumber(b);
    if (na !== null && nb !== null) {
      if (op === "=") return na === nb;
      if (op === "!=") return na !== nb;
      if (op === ">") return na > nb;
      if (op === ">=") return na >= nb;
      if (op === "<") return na < nb;
      if (op === "<=") return na <= nb;
    }
    if (op === "=") return a === b;
    if (op === "!=") return a !== b;
    if (op === ">") return a > b;
    if (op === ">=") return a >= b;
    if (op === "<") return a < b;
    if (op === "<=") return a <= b;
    return false;
  }

  function rowPassesSecondaryFilter(dataRow, rule) {
    var prop = rule.prop;
    var op = rule.op;
    var v = dataRow.cells && dataRow.cells[prop];
    var cellStr = String(v == null ? "" : v);
    if (op === "in") {
      if (!rule.tags || !rule.tags.length) return true;
      var set = Object.create(null);
      rule.tags.forEach(function (t) {
        set[String(t).toLowerCase()] = true;
      });
      return !!set[cellStr.toLowerCase()];
    }
    if (op === "~") {
      var pat = String(rule.scalar || "").trim();
      if (!pat) return true;
      var rx = globToRegExp(pat);
      return rx ? rx.test(cellStr) : false;
    }
    var needle = String(rule.scalar != null ? rule.scalar : "").trim();
    if (needle === "") {
      if (op === "=") return cellStr === "";
      if (op === "!=") return cellStr !== "";
      return true;
    }
    return compareScalars(op, cellStr, needle);
  }

  function collectSecondaryFilterRules() {
    var rules = [];
    document.querySelectorAll("#gc-fw-v2-obj-secondary-filters-tbody tr[data-gc-secondary-filter-row]").forEach(function (tr) {
      var propSel = tr.querySelector(".gc-fw-v2-obj-f-prop");
      var opSel = tr.querySelector(".gc-fw-v2-obj-f-op");
      if (!propSel || !opSel) return;
      var prop = String(propSel.value || "").trim();
      if (!prop) return;
      var op = String(opSel.value || "=").trim();
      if (op === "in") {
        var api = tr._gcTagEditor;
        var tags = api && typeof api.getTags === "function" ? api.getTags() : [];
        if (!tags.length) return;
        rules.push({ prop: prop, op: "in", tags: tags });
        return;
      }
      var inp = tr.querySelector(".gc-fw-v2-obj-f-scalar");
      var scalar = inp ? inp.value : "";
      var trimmed = String(scalar || "").trim();
      if (trimmed === "") {
        if (op === "=" || op === "!=") rules.push({ prop: prop, op: op, scalar: "" });
        return;
      }
      rules.push({ prop: prop, op: op, scalar: scalar });
    });
    return rules;
  }

  function applySecondaryFiltersToRows(rows, rules) {
    if (!rules.length) return rows.slice();
    return rows.filter(function (row) {
      for (var i = 0; i < rules.length; i++) {
        if (!rowPassesSecondaryFilter(row, rules[i])) return false;
      }
      return true;
    });
  }

  function bindTablesFilterTagEditor(tr, root) {
    if (!root || root.dataset.gcTablesFilterTagBound === "1") return;
    root.dataset.gcTablesFilterTagBound = "1";
    var hidden = root.querySelector(".gc-designer-tags__hidden");
    var field = root.querySelector(".gc-designer-tags__field");
    var chips = field ? field.querySelector(".gc-designer-tags__chips") : null;
    var input = field ? field.querySelector(".gc-designer-tags__input") : null;
    var suggest = root.querySelector(".gc-designer-tags__suggest");
    var mirrorTyped = root.querySelector(".gc-designer-tags__typed-mirror");
    var mirrorGhost = root.querySelector(".gc-designer-tags__ghost");
    var inputShell = root.querySelector(".gc-designer-tags__input-shell");
    var combo = root.querySelector(".gc-designer-tags__combo");
    if (!field || !chips || !input || !suggest || !combo) return;

    var state = { tags: [], highlightIdx: -1, focused: false };
    var suggestRelayoutAborter = null;
    var filtersScrollHost = root.closest(".gc-fw-v2-obj-secondary-filters__scroll");

    function tearDownSuggestRelayout() {
      if (suggestRelayoutAborter) {
        suggestRelayoutAborter.abort();
        suggestRelayoutAborter = null;
      }
    }

    function undockSuggestFromBody() {
      if (suggest.parentNode === document.body) combo.appendChild(suggest);
      suggest.classList.remove("gc-designer-tags__suggest--fixed-layer");
      suggest.removeAttribute("style");
    }

    function hideSuggestPanel() {
      tearDownSuggestRelayout();
      undockSuggestFromBody();
      suggest.hidden = true;
      input.setAttribute("aria-expanded", "false");
      state.highlightIdx = -1;
    }

    function layoutFixedSuggestGeometry() {
      if (suggest.hidden || !combo) return;
      var pad = 8;
      var gap = 4;
      var maxH = 200;
      var r = combo.getBoundingClientRect();
      var w = Math.min(r.width, window.innerWidth - 2 * pad);
      var left = r.left;
      if (left + w > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - pad - w);
      var below = window.innerHeight - r.bottom - gap - pad;
      var above = r.top - gap - pad;
      var openDown = below >= Math.min(120, maxH) || below >= above;
      suggest.style.position = "fixed";
      suggest.style.left = left + "px";
      suggest.style.width = w + "px";
      suggest.style.zIndex = "450";
      suggest.style.boxSizing = "border-box";
      suggest.classList.add("gc-designer-tags__suggest--fixed-layer");
      if (openDown) {
        var mh = Math.min(maxH, Math.max(72, below));
        suggest.style.top = r.bottom + gap + "px";
        suggest.style.bottom = "";
        suggest.style.maxHeight = mh + "px";
      } else {
        var mhUp = Math.min(maxH, Math.max(72, above));
        suggest.style.top = "";
        suggest.style.bottom = window.innerHeight - r.top + gap + "px";
        suggest.style.maxHeight = mhUp + "px";
      }
    }

    function wireSuggestRelayout() {
      tearDownSuggestRelayout();
      suggestRelayoutAborter = new AbortController();
      var sig = { signal: suggestRelayoutAborter.signal };
      var reflow = function () {
        if (!suggest.hidden) layoutFixedSuggestGeometry();
      };
      window.addEventListener("resize", reflow, sig);
      document.addEventListener("scroll", reflow, true, sig);
      if (filtersScrollHost) filtersScrollHost.addEventListener("scroll", reflow, sig);
    }

    function showSuggestPanel() {
      suggest.hidden = false;
      input.setAttribute("aria-expanded", "true");
      document.body.appendChild(suggest);
      layoutFixedSuggestGeometry();
      wireSuggestRelayout();
    }

    function propForRow() {
      var ps = tr.querySelector(".gc-fw-v2-obj-f-prop");
      return ps ? String(ps.value || "").trim() : "";
    }

    function tagSet() {
      var o = Object.create(null);
      state.tags.forEach(function (t) {
        o[String(t).toLowerCase()] = true;
      });
      return o;
    }

    if (!suggest.id) {
      secondaryFilterSeq += 1;
      suggest.id = "gc-dt-ft-sug-" + String(secondaryFilterSeq);
    }
    input.setAttribute("aria-controls", suggest.id);

    suggest.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });

    function syncHidden() {
      if (hidden) hidden.value = JSON.stringify(state.tags);
    }

    function poolList() {
      var p = propForRow();
      return (p && designerTablesUniqueByCol[p]) || [];
    }

    function filterCandidates(q) {
      var ql = (q || "").trim().toLowerCase();
      var have = tagSet();
      var pool = poolList();
      var out = pool.filter(function (t) {
        if (have[String(t).toLowerCase()]) return false;
        if (!ql) return true;
        return String(t).toLowerCase().indexOf(ql) !== -1;
      });
      out.sort(function (a, b) {
        var al = String(a).toLowerCase();
        var bl = String(b).toLowerCase();
        var ap = ql && al.indexOf(ql) === 0 ? 0 : 1;
        var bp = ql && bl.indexOf(ql) === 0 ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return al.localeCompare(bl);
      });
      return out;
    }

    function getGhostSuffix(typed, candidates) {
      var q = typed;
      if (!q || !candidates.length) return "";
      var first = candidates[0];
      if (first.toLowerCase().indexOf(q.toLowerCase()) !== 0) return "";
      return first.slice(q.length);
    }

    function updateMirrorAndSuggest() {
      var typed = input.value;
      var c = filterCandidates(typed);
      var ghost = getGhostSuffix(typed, c);
      if (mirrorTyped) mirrorTyped.textContent = typed;
      if (mirrorGhost) mirrorGhost.textContent = ghost;
      if (!state.focused) {
        hideSuggestPanel();
        return;
      }
      if (!c.length) {
        hideSuggestPanel();
        return;
      }
      var max = 12;
      var slice = c.slice(0, max);
      if (state.highlightIdx < 0 || state.highlightIdx >= slice.length) state.highlightIdx = 0;
      suggest.innerHTML = "";
      slice.forEach(function (tag, idx) {
        var li = document.createElement("li");
        li.setAttribute("role", "presentation");
        if (idx === state.highlightIdx) li.classList.add("is-active");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "gc-designer-tags__suggest-btn";
        btn.setAttribute("role", "option");
        btn.textContent = tag;
        btn.addEventListener("mousedown", function (e) {
          e.preventDefault();
        });
        btn.addEventListener("click", function () {
          addTag(tag);
        });
        li.appendChild(btn);
        suggest.appendChild(li);
      });
      showSuggestPanel();
    }

    function addTag(raw) {
      var t = String(raw || "").trim();
      if (!t) return;
      var k = t.toLowerCase();
      for (var i = 0; i < state.tags.length; i++) {
        if (String(state.tags[i]).toLowerCase() === k) return;
      }
      state.tags.push(t);
      input.value = "";
      state.highlightIdx = -1;
      syncHidden();
      render();
      updateMirrorAndSuggest();
      try {
        input.focus();
      } catch (eF2) { }
    }

    function removeTagIndex(i) {
      if (i < 0 || i >= state.tags.length) return;
      state.tags.splice(i, 1);
      syncHidden();
      render();
      updateMirrorAndSuggest();
    }

    function createPillNode(label, indexInTags) {
      var span = document.createElement("span");
      span.className = "gc-designer-tags__pill gc-designer-tags__pill--unsaved";
      span.setAttribute("data-tag", label);
      var t = document.createElement("span");
      t.className = "gc-designer-tags__pill-text";
      t.textContent = label;
      span.appendChild(t);
      if (indexInTags >= 0) {
        var rm = document.createElement("button");
        rm.type = "button";
        rm.className = "gc-designer-tags__pill-remove";
        rm.setAttribute("aria-label", "Remove " + label);
        rm.innerHTML = "\u00d7";
        rm.addEventListener("mousedown", function (e) {
          e.preventDefault();
        });
        rm.addEventListener("click", function (e) {
          e.stopPropagation();
          removeTagIndex(indexInTags);
        });
        span.appendChild(rm);
      }
      return span;
    }

    function render() {
      chips.innerHTML = "";
      state.tags.forEach(function (tg, i) {
        chips.appendChild(createPillNode(tg, i));
      });
    }

    var blurTimer = null;
    function queueBlurCollapse() {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(function () {
        blurTimer = null;
        state.focused = false;
        hideSuggestPanel();
      }, 130);
    }

    function cancelBlurCollapse() {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = null;
    }

    field.addEventListener("mousedown", function (e) {
      if (e.target.closest(".gc-designer-tags__pill-remove")) return;
      if (!inputShell.contains(e.target)) {
        e.preventDefault();
        input.focus();
      }
    });

    input.addEventListener("focus", function () {
      cancelBlurCollapse();
      state.focused = true;
      updateMirrorAndSuggest();
    });
    input.addEventListener("blur", function () {
      queueBlurCollapse();
    });
    input.addEventListener("input", function () {
      state.highlightIdx = -1;
      updateMirrorAndSuggest();
    });
    input.addEventListener("keydown", function (e) {
      var sl = suggest && !suggest.hidden;
      var opts = suggest ? suggest.querySelectorAll(".gc-designer-tags__suggest-btn") : [];
      if (e.key === "ArrowDown" && sl && opts.length) {
        e.preventDefault();
        state.highlightIdx = Math.min(state.highlightIdx + 1, opts.length - 1);
        updateMirrorAndSuggest();
        return;
      }
      if (e.key === "ArrowUp" && sl && opts.length) {
        e.preventDefault();
        state.highlightIdx = Math.max(state.highlightIdx - 1, 0);
        updateMirrorAndSuggest();
        return;
      }
      if (e.key === "Enter") {
        var typed = input.value.trim();
        var c = filterCandidates(typed);
        if (sl && state.highlightIdx >= 0 && opts[state.highlightIdx]) {
          e.preventDefault();
          addTag(opts[state.highlightIdx].textContent);
          return;
        }
        if (typed && c.length) {
          e.preventDefault();
          var exact = null;
          for (var ci = 0; ci < c.length; ci++) {
            if (String(c[ci]).toLowerCase() === typed.toLowerCase()) {
              exact = c[ci];
              break;
            }
          }
          if (exact) addTag(exact);
          else addTag(c[0]);
          return;
        }
        if (typed) {
          e.preventDefault();
          addTag(typed);
        }
      }
      if (e.key === "Escape") {
        if (suggest && !suggest.hidden) {
          e.preventDefault();
          hideSuggestPanel();
        }
      }
    });

    tr._gcTagEditor = {
      getTags: function () {
        return state.tags.slice();
      },
      setTags: function (arr) {
        state.tags = (arr || [])
          .map(function (x) {
            return String(x == null ? "" : x).trim();
          })
          .filter(Boolean);
        render();
        syncHidden();
      },
    };
    tr._gcDismissTableFilterSuggest = hideSuggestPanel;

    root.classList.remove("is-collapsed");
    render();
    syncHidden();
  }

  function ensureFilterRowValueCell(tr, op) {
    var td = tr.querySelector(".gc-fw-v2-obj-f-value-cell");
    if (!td) return;
    var wantTag = op === "in";
    var hasTag = !!td.querySelector("[data-gc-tables-filter-tags='1']");
    if (wantTag && hasTag) return;
    if (!wantTag && td.querySelector(".gc-fw-v2-obj-f-scalar")) return;
    if (typeof tr._gcDismissTableFilterSuggest === "function") {
      try {
        tr._gcDismissTableFilterSuggest();
      } catch (eD0) { }
    }
    tr._gcDismissTableFilterSuggest = null;
    tr._gcTagEditor = null;
    td.innerHTML = "";
    if (wantTag) {
      td.innerHTML =
        '<div class="gc-designer-tags gc-designer-tags--table-filter" data-gc-tables-filter-tags="1">' +
        '<input type="hidden" class="gc-designer-tags__hidden" value="[]" />' +
        '<div class="gc-designer-tags__combo">' +
        '<div class="gc-designer-tags__field" role="group" aria-label="Match values">' +
        '<div class="gc-designer-tags__chips" aria-live="polite"></div>' +
        '<div class="gc-designer-tags__input-shell">' +
        '<div class="gc-designer-tags__mirror" aria-hidden="true">' +
        '<span class="gc-designer-tags__typed-mirror"></span><span class="gc-designer-tags__ghost"></span>' +
        "</div>" +
        '<input type="text" class="gc-designer-tags__input mono settings-form__input" autocomplete="off" />' +
        "</div></div>" +
        '<ul class="gc-designer-tags__suggest" role="listbox" hidden></ul>' +
        "</div></div>";
      var tagRoot = td.querySelector("[data-gc-tables-filter-tags='1']");
      bindTablesFilterTagEditor(tr, tagRoot);
    } else {
      var ph = op === "~" ? "Pattern (*, ? wildcards)…" : "Value…";
      var inp = document.createElement("input");
      inp.type = "text";
      inp.className = "settings-form__input mono gc-fw-v2-obj-f-scalar";
      inp.setAttribute("autocomplete", "off");
      inp.setAttribute("aria-label", "Filter value");
      inp.placeholder = ph;
      td.appendChild(inp);
    }
  }

  function createSecondaryFilterRow() {
    var tr = document.createElement("tr");
    tr.setAttribute("data-gc-secondary-filter-row", "1");
    var tdP = document.createElement("td");
    var selP = document.createElement("select");
    selP.className = "settings-form__input mono gc-fw-v2-obj-f-prop";
    selP.setAttribute("aria-label", "Filter property");
    tdP.appendChild(selP);
    var tdO = document.createElement("td");
    var selO = document.createElement("select");
    selO.className = "settings-form__input mono gc-fw-v2-obj-f-op";
    selO.setAttribute("aria-label", "Filter operator");
    ["=", "!=", ">", ">=", "<", "<=", "~", "in"].forEach(function (sym) {
      var o = document.createElement("option");
      o.value = sym;
      o.textContent = sym === "in" ? "in" : sym;
      selO.appendChild(o);
    });
    tdO.appendChild(selO);
    var tdV = document.createElement("td");
    tdV.className = "gc-fw-v2-obj-f-value-cell";
    var tdR = document.createElement("td");
    var rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn btn--secondary icon-btn gc-fw-v2-obj-f-remove";
    rm.setAttribute("aria-label", "Remove filter row");
    rm.textContent = "\u00d7";
    tdR.appendChild(rm);
    tr.appendChild(tdP);
    tr.appendChild(tdO);
    tr.appendChild(tdV);
    tr.appendChild(tdR);
    fillPropertySelect(selP, false);
    ensureFilterRowValueCell(tr, "=");
    return tr;
  }

  function addSecondaryFilterRow() {
    var tb = document.getElementById("gc-fw-v2-obj-secondary-filters-tbody");
    if (!tb) return;
    tb.appendChild(createSecondaryFilterRow());
  }

  function onSecondaryFiltersTbodyChange(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var tr = t.closest("tr[data-gc-secondary-filter-row]");
    if (!tr) return;
    if (t.matches && t.matches(".gc-fw-v2-obj-f-op")) {
      ensureFilterRowValueCell(tr, t.value);
      return;
    }
    if (t.matches && t.matches(".gc-fw-v2-obj-f-prop")) {
      var op = (tr.querySelector(".gc-fw-v2-obj-f-op") || {}).value || "=";
      if (op === "in") ensureFilterRowValueCell(tr, "in");
    }
  }

  function wireSecondaryFiltersTable() {
    var tb = document.getElementById("gc-fw-v2-obj-secondary-filters-tbody");
    var addBtn = document.getElementById("gc-fw-v2-obj-secondary-add");
    if (!tb) return;
    tb.addEventListener("change", onSecondaryFiltersTbodyChange);
    tb.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest(".gc-fw-v2-obj-f-remove");
      if (!btn || !tb.contains(btn)) return;
      var tr = btn.closest("tr[data-gc-secondary-filter-row]");
      if (tr) {
        if (typeof tr._gcDismissTableFilterSuggest === "function") {
          try {
            tr._gcDismissTableFilterSuggest();
          } catch (eDs) { }
        }
        tr.remove();
      }
      if (!tb.querySelector("tr[data-gc-secondary-filter-row]")) {
        addSecondaryFilterRow();
      }
    });
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        addSecondaryFilterRow();
      });
    }
    tb.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter") return;
      var inp = ev.target;
      if (!inp || !inp.classList || !inp.classList.contains("gc-fw-v2-obj-f-scalar")) return;
      ev.preventDefault();
      var fn = tb._gcDesignerTableRefresh;
      if (typeof fn === "function") fn();
    });
    if (!tb.querySelector("tr[data-gc-secondary-filter-row]")) {
      addSecondaryFilterRow();
    }
  }

  function getSelectedEntityTypes() {
    return LOCKED_ENTITY_TYPES.slice();
  }

  function mergeHsCombineApiFlags(x, y) {
    var ca = !!(x && (x.hs_combine_conflicts || x.ip_hosts_combine_conflicts));
    var cb = !!(y && (y.hs_combine_conflicts || y.ip_hosts_combine_conflicts));
    var flatX = x && (x.hs_combined === false || x.ip_hosts_combined === false);
    var flatY = y && (y.hs_combined === false || y.ip_hosts_combined === false);
    return {
      hs_combine_conflicts: ca || cb,
      ip_hosts_combine_conflicts: ca || cb,
      hs_combined: !(flatX || flatY),
      ip_hosts_combined: !(flatX || flatY),
    };
  }

  function mergeTablePayloadsJs(a, b) {
    if (!a || typeof a !== "object") return b;
    if (!b || typeof b !== "object") return a;
    var rowsA = a.rows || [];
    var rowsB = b.rows || [];
    if (!rowsA.length) return b;
    if (!rowsB.length) return a;
    var colsA = a.columns || [];
    var colsB = b.columns || [];
    var colUnion = colsA.slice();
    colsB.forEach(function (c) {
      if (colUnion.indexOf(c) === -1) colUnion.push(c);
    });
    var clA = Object.assign({}, a.column_labels || {});
    var clB = Object.assign({}, b.column_labels || {});
    var column_labels = Object.assign({}, clB, clA);
    colUnion.forEach(function (c) {
      if (column_labels[c] == null || column_labels[c] === "") column_labels[c] = String(c);
    });
    function expandRows(rows) {
      return rows.map(function (r) {
        var cells = Object.assign({}, r.cells || {});
        colUnion.forEach(function (c) {
          if (cells[c] === undefined) cells[c] = "";
        });
        var nr = Object.assign({}, r);
        nr.cells = cells;
        return nr;
      });
    }
    var visA = a.columns_visible_by_default || [];
    var visB = b.columns_visible_by_default || [];
    var vis = visA.slice();
    visB.forEach(function (x) {
      if (vis.indexOf(x) === -1) vis.push(x);
    });
    var out = {
      columns: colUnion,
      column_labels: column_labels,
      columns_visible_by_default: vis,
      rows: expandRows(rowsA).concat(expandRows(rowsB)),
    };
    Object.assign(out, mergeHsCombineApiFlags(a, b));
    return out;
  }

  function designerTableFetchCtx() {
    var fw = [];
    var cf = [];
    if (typeof window.gcGetSelectedFirewallIds === "function") {
      try {
        fw = window.gcGetSelectedFirewallIds() || [];
      } catch (e0) { }
    }
    if (typeof window.gcGetSelectedConfigurationIds === "function") {
      try {
        cf = window.gcGetSelectedConfigurationIds() || [];
      } catch (e1) { }
    }
    if (fw.length) return { firewallIds: fw, configurationIds: cf, idsQueryParam: "firewall_ids" };
    if (cf.length) return { firewallIds: [], configurationIds: cf, idsQueryParam: "configuration_ids" };
    return { firewallIds: [], configurationIds: cf, idsQueryParam: "firewall_ids" };
  }

  function buildScopeQuery(ctx) {
    var param = ctx.idsQueryParam || "firewall_ids";
    var primaryIds = param === "configuration_ids" ? ctx.configurationIds || [] : ctx.firewallIds || [];
    var qs = param + "=" + encodeURIComponent(primaryIds.join(","));
    if (param !== "configuration_ids" && ctx.configurationIds && ctx.configurationIds.length) {
      qs += "&configuration_ids=" + encodeURIComponent(ctx.configurationIds.join(","));
    }
    return qs;
  }

  function isDesignerTableCombineOn() {
    var c = document.getElementById("gc-fw-v2-obj-combine");
    if (!c) return true;
    return !!c.checked;
  }

  function getDesignerTableCombineByColumnParam() {
    var sel = document.getElementById("gc-fw-v2-obj-combine-by-column");
    if (!sel) return "";
    return String(sel.value || "").trim();
  }

  function syncFwV2CombineByColumnOptions(cols, labels, preferredValue) {
    var sel = document.getElementById("gc-fw-v2-obj-combine-by-column");
    if (!sel) return;
    var pending =
      designerTablePropsPending && designerTablePropsPending.combine_by_column != null
        ? String(designerTablePropsPending.combine_by_column).trim()
        : "";
    var curSel = String(sel.value || "").trim();
    var prev =
      preferredValue !== undefined && preferredValue !== null
        ? String(preferredValue).trim()
        : curSel || pending;
    sel.innerHTML = "";
    var defOpt = document.createElement("option");
    defOpt.value = "";
    defOpt.textContent = "Name (default rules)";
    sel.appendChild(defOpt);
    var list = (cols || [])
      .map(function (x) {
        return String(x || "").trim();
      })
      .filter(function (id) {
        return id && id !== "__row_select";
      });
    var uniq = [];
    list.forEach(function (c) {
      if (uniq.indexOf(c) === -1) uniq.push(c);
    });
    uniq.sort(function (a, b) {
      var la = String(labels && labels[a] != null ? labels[a] : a);
      var lb = String(labels && labels[b] != null ? labels[b] : b);
      return la.localeCompare(lb);
    });
    uniq.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = String(labels && labels[c] != null ? labels[c] : c);
      sel.appendChild(opt);
    });
    if (prev && uniq.indexOf(prev) === -1) {
      var gh = document.createElement("option");
      gh.value = prev;
      gh.textContent =
        String(labels && labels[prev] != null ? labels[prev] : prev) + " \u2014 saved";
      sel.appendChild(gh);
    }
    sel.value = prev || "";
  }

  function fetchTableForEntityType(ctx, entityType, limit) {
    var q = buildScopeQuery(ctx);
    var cb = isDesignerTableCombineOn() ? getDesignerTableCombineByColumnParam() : "";
    var url =
      "/api/firewalls/hosts-services/table?entity_type=" +
      encodeURIComponent(entityType) +
      "&" +
      q +
      "&combine=" +
      (isDesignerTableCombineOn() ? "true" : "false") +
      (cb ? "&combine_by=" + encodeURIComponent(cb) : "") +
      "&limit=" +
      encodeURIComponent(String(limit == null ? 800 : limit));
    return fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, body: j };
      });
    });
  }

  function mergePayloadsForTypes(ctx, types, limit) {
    if (!types.length) {
      return Promise.resolve({
        columns: [],
        column_labels: {},
        columns_visible_by_default: [],
        rows: [],
      });
    }
    return Promise.all(
      types.map(function (et) {
        return fetchTableForEntityType(ctx, et, limit);
      })
    ).then(function (results) {
      for (var i = 0; i < results.length; i++) {
        if (!results[i].ok) throw new Error("fetch failed");
      }
      var merged = results[0].body;
      for (var j = 1; j < results.length; j++) {
        merged = mergeTablePayloadsJs(merged, results[j].body);
      }
      return merged;
    });
  }

  var probeTimer = null;
  function scheduleProbeColumns() {
    if (probeTimer) clearTimeout(probeTimer);
    probeTimer = setTimeout(function () {
      probeTimer = null;
      var types = getSelectedEntityTypes();
      if (!types.length) {
        populatePropertyDropdowns({ columns: [], column_labels: {} });
        return;
      }
      var ctx = designerTableFetchCtx();
      if (!ctx.firewallIds.length && !ctx.configurationIds.length) {
        populatePropertyDropdowns({ columns: [], column_labels: {} });
        return;
      }
      mergePayloadsForTypes(ctx, types, 1)
        .then(function (merged) {
          populatePropertyDropdowns(merged);
        })
        .catch(function () { });
    }, 300);
  }

  function populatePropertyDropdowns(merged) {
    var cols = (merged && merged.columns) || [];
    var labels = (merged && merged.column_labels) || {};
    reindexUniqueValues(merged);
    syncAllSecondaryPropertySelects();
    var hideList = document.getElementById("gc-fw-v2-obj-hide-list");
    var hiddenChecked = {};
    if (hideList) {
      hideList.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
        if (cb.checked) hiddenChecked[cb.value] = true;
      });
      hideList.innerHTML = "";
      cols.slice().sort(function (a, b) {
        var la = String(labels[a] != null ? labels[a] : a);
        var lb = String(labels[b] != null ? labels[b] : b);
        return la.localeCompare(lb);
      }).forEach(function (c) {
        var lab = String(labels[c] != null ? labels[c] : c);
        var li = document.createElement("li");
        li.className = "gc-designer-dd__row";
        li.setAttribute("role", "option");
        li.setAttribute("data-gc-dd-primary", lab);
        li.setAttribute("aria-selected", hiddenChecked[c] ? "true" : "false");
        var lb = document.createElement("label");
        lb.className = "gc-designer-dd__check";
        var inp = document.createElement("input");
        inp.type = "checkbox";
        inp.value = c;
        if (hiddenChecked[c]) inp.checked = true;
        var sp = document.createElement("span");
        sp.className = "mono";
        sp.textContent = c;
        lb.appendChild(inp);
        lb.appendChild(sp);
        li.appendChild(lb);
        hideList.appendChild(li);
      });
      var hideRoot = document.getElementById("gc-fw-v2-obj-hide-dd");
      if (hideRoot && hideRoot._gcTablesDdRefreshMultiLabel) hideRoot._gcTablesDdRefreshMultiLabel();
      if (hideRoot && hideRoot._gcTablesDdFilterList) hideRoot._gcTablesDdFilterList();
    }
    syncFwV2CombineByColumnOptions(cols, labels);
    if (designerTablePropsPending && !designerTablePropsDidHydrateColumns && cols.length) {
      applyPendingHideColumnIds(designerTablePropsPending.hidden_column_ids || []);
      syncAllSecondaryPropertySelects();
      applySecondaryFilterPropsFromPending(designerTablePropsPending);
      designerTablePropsDidHydrateColumns = true;
    }
  }

  function parseTokens(s) {
    return String(s || "")
      .split(/[\s,;\n\r]+/)
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean);
  }

  function parseOverrides(text) {
    var o = {};
    String(text || "").split("\n").forEach(function (line) {
      var t = line.trim();
      if (!t || t.charAt(0) === "#") return;
      var eq = t.indexOf(":");
      if (eq === -1) eq = t.indexOf("=");
      if (eq <= 0) return;
      var k = t.slice(0, eq).trim();
      var v = t.slice(eq + 1).trim();
      if (k) o[k] = v;
    });
    return o;
  }

  function formatOverrides(o) {
    var lines = [];
    Object.keys(o || {})
      .sort()
      .forEach(function (k) {
        var v = o[k];
        if (v != null && String(v).trim() !== "") lines.push(k + ": " + String(v).trim());
      });
    return lines.join("\n");
  }

  function searchFromCells(cells) {
    var keys = Object.keys(cells || {}).sort();
    var parts = [];
    keys.forEach(function (k) {
      var v = cells[k];
      parts.push(String(v == null ? "" : v));
    });
    return parts
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function getHiddenColumnSet() {
    var hiddenSet = {};
    document.querySelectorAll("#gc-fw-v2-obj-hide-list input[type=checkbox]:checked").forEach(function (cb) {
      var v = String(cb.value || "").trim();
      if (v) hiddenSet[v] = true;
    });
    return hiddenSet;
  }

  function applyColumnProperties(data) {
    if (!data || typeof data !== "object") return data;
    try {
      window.GC_DESIGNER_TABLES_BASE_LABELS = Object.assign({}, data.column_labels || {});
    } catch (eBl) { }
    var rules = collectSecondaryFilterRules();
    var rows = applySecondaryFiltersToRows(data.rows || [], rules);

    var dataFiltered = Object.assign({}, data, { rows: rows });

    var order = parseTokens(document.getElementById("gc-fw-v2-obj-col-order").value);
    var hiddenSet = getHiddenColumnSet();
    var ov = parseOverrides(document.getElementById("gc-fw-v2-obj-col-overrides").value);
    var cols0 = (dataFiltered.columns && dataFiltered.columns.slice) ? dataFiltered.columns.slice() : [];
    var labels = Object.assign({}, dataFiltered.column_labels || {}, ov);
    cols0 = cols0.filter(function (c) {
      return !hiddenSet[c];
    });
    if (order.length) {
      var ordered = [];
      order.forEach(function (id) {
        if (cols0.indexOf(id) !== -1 && ordered.indexOf(id) === -1) ordered.push(id);
      });
      cols0.forEach(function (c) {
        if (ordered.indexOf(c) === -1) ordered.push(c);
      });
      cols0 = ordered;
    }
    rows = (dataFiltered.rows || []).map(function (row) {
      var cells = Object.assign({}, row.cells || {});
      Object.keys(hiddenSet).forEach(function (h) {
        delete cells[h];
      });
      var nr = Object.assign({}, row);
      nr.cells = cells;
      nr.search = searchFromCells(cells);
      return nr;
    });
    var designModeOn = false;
    try {
      var dmc = document.getElementById("gc-fw-v2-obj-design-mode");
      designModeOn = !!(dmc && dmc.checked);
    } catch (eDmc) { }
    var vis = designModeOn
      ? cols0.slice()
      : (dataFiltered.columns_visible_by_default || []).filter(function (c) {
        return !hiddenSet[c];
      });
    return {
      columns: cols0,
      column_labels: labels,
      rows: rows,
      columns_visible_by_default: vis,
    };
  }

  function loadDesignerEntityTypeList() {
    var ctx = designerTableFetchCtx();
    var qs = [];
    if (ctx.firewallIds.length) {
      qs.push("firewall_ids=" + encodeURIComponent(ctx.firewallIds.join(",")));
    }
    if (ctx.configurationIds.length) {
      qs.push("configuration_ids=" + encodeURIComponent(ctx.configurationIds.join(",")));
    }
    var url =
      "/api/firewalls/config-cache/distinct-entity-types" + (qs.length ? "?" + qs.join("&") : "");
    var list = document.getElementById("gc-fw-v2-obj-entity-list");
    if (!list) return Promise.resolve();
    var prevChecked = {};
    list.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
      prevChecked[String(cb.value || "").trim()] = !!cb.checked;
    });
    return fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        if (!res.ok || !res.j || !Array.isArray(res.j.entity_types)) {
          list.innerHTML =
            '<li class="gc-designer-dd__row muted" role="status">Could not load entity types from the cache.</li>';
          var entRoot0 = document.getElementById("gc-fw-v2-obj-entity-dd");
          if (entRoot0 && entRoot0._gcTablesDdRefreshMultiLabel) entRoot0._gcTablesDdRefreshMultiLabel();
          if (designerTablePropsUsePendingEntityTypes) designerTablePropsUsePendingEntityTypes = false;
          return;
        }
        var allCacheTypes = res.j.entity_types.map(function (t) {
          return String(t || "").trim();
        }).filter(Boolean);
        var inCache = Object.create(null);
        allCacheTypes.forEach(function (t) {
          inCache[t] = true;
        });
        var lockedMode = NAV_TABBED || LOCKED_ENTITY_TYPES.length > 0;
        var types = lockedMode
          ? LOCKED_ENTITY_TYPES.filter(function (et) {
            return inCache[et];
          })
          : allCacheTypes.slice();
        list.innerHTML = "";
        if (!types.length && !lockedMode) {
          var emptyLi = document.createElement("li");
          emptyLi.className = "gc-designer-dd__row muted";
          emptyLi.setAttribute("role", "status");
          emptyLi.textContent =
            ctx.firewallIds.length || ctx.configurationIds.length
              ? "No config-cache rows for this scope yet — run sync, then refresh."
              : "Select firewalls or configurations in the top bar, or rely on the global cache list when none are selected.";
          list.appendChild(emptyLi);
          if (designerTablePropsUsePendingEntityTypes) designerTablePropsUsePendingEntityTypes = false;
        } else if (!types.length && lockedMode) {
          if (!LOCKED_ENTITY_TYPES.length) {
            var emptyLi = document.createElement("li");
            emptyLi.className = "gc-designer-dd__row muted";
            emptyLi.setAttribute("role", "status");
            emptyLi.textContent = "No object types are mapped to this tab.";
            list.appendChild(emptyLi);
          } else {
            LOCKED_ENTITY_TYPES.forEach(function (et) {
              var li = document.createElement("li");
              li.className = "gc-designer-dd__row muted";
              li.setAttribute("role", "status");
              var sp = document.createElement("span");
              sp.className = "mono";
              sp.textContent = et + " — not in cache for this scope (sync or widen selection).";
              li.appendChild(sp);
              list.appendChild(li);
            });
          }
          if (designerTablePropsUsePendingEntityTypes) designerTablePropsUsePendingEntityTypes = false;
        } else {
          var pendingEtSet = null;
          if (designerTablePropsUsePendingEntityTypes && designerTablePropsPending && Array.isArray(designerTablePropsPending.entity_types)) {
            pendingEtSet = Object.create(null);
            designerTablePropsPending.entity_types.forEach(function (x) {
              var s = String(x || "").trim();
              if (s) pendingEtSet[s] = true;
            });
          }
          types.forEach(function (et) {
            var primary = et.replace(/_/g, " ");
            var wasChecked = pendingEtSet
              ? !!pendingEtSet[et]
              : Object.prototype.hasOwnProperty.call(prevChecked, et)
                ? prevChecked[et]
                : lockedMode
                  ? true
                  : false;
            var li = document.createElement("li");
            li.className = "gc-designer-dd__row";
            li.setAttribute("role", "option");
            li.setAttribute("data-gc-dd-primary", primary);
            li.setAttribute("aria-selected", wasChecked ? "true" : "false");
            var lb = document.createElement("label");
            lb.className = "gc-designer-dd__check";
            var inp = document.createElement("input");
            inp.type = "checkbox";
            inp.value = et;
            if (wasChecked) inp.checked = true;
            if (lockedMode) {
              inp.checked = true;
              inp.disabled = true;
            }
            var sp = document.createElement("span");
            sp.className = "mono";
            sp.textContent = et;
            lb.appendChild(inp);
            lb.appendChild(sp);
            li.appendChild(lb);
            list.appendChild(li);
          });
          if (lockedMode) {
            LOCKED_ENTITY_TYPES.forEach(function (et) {
              if (inCache[et]) return;
              var li = document.createElement("li");
              li.className = "gc-designer-dd__row muted";
              li.setAttribute("role", "status");
              var sp = document.createElement("span");
              sp.className = "mono";
              sp.textContent = et + " — not in cache for this scope (sync or widen selection).";
              li.appendChild(sp);
              list.appendChild(li);
            });
          }
          if (designerTablePropsUsePendingEntityTypes) designerTablePropsUsePendingEntityTypes = false;
        }
        var entRoot = document.getElementById("gc-fw-v2-obj-entity-dd");
        if (entRoot && entRoot._gcTablesDdRefreshMultiLabel) entRoot._gcTablesDdRefreshMultiLabel();
        if (entRoot && entRoot._gcTablesDdFilterList) entRoot._gcTablesDdFilterList();
        if (designerTablePropsUsePendingEntityTypes) designerTablePropsUsePendingEntityTypes = false;
      })
      .catch(function () {
        list.innerHTML =
          '<li class="gc-designer-dd__row muted" role="status">Could not load entity types from the cache.</li>';
        var entRoot2 = document.getElementById("gc-fw-v2-obj-entity-dd");
        if (entRoot2 && entRoot2._gcTablesDdRefreshMultiLabel) entRoot2._gcTablesDdRefreshMultiLabel();
        if (designerTablePropsUsePendingEntityTypes) designerTablePropsUsePendingEntityTypes = false;
      });
  }

  var DESIGN_MODE_LS = DESIGNER_TABLE_DESIGN_MODE_LS;
  var designHeaderAborter = null;

  function designerTableDesignModeEligible() {
    return !!document.getElementById("gc-fw-v2-obj-design-mode-marker");
  }

  function isDesignerTableDesignModeOn() {
    var cb = document.getElementById("gc-fw-v2-obj-design-mode");
    return !!(cb && cb.checked);
  }

  function syncHideListFromColVis(vis) {
    if (!vis || typeof vis !== "object") return;
    var hideList = document.getElementById("gc-fw-v2-obj-hide-list");
    if (!hideList) return;
    hideList.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
      var id = String(cb.value || "").trim();
      if (!id || !Object.prototype.hasOwnProperty.call(vis, id)) return;
      cb.checked = !vis[id];
    });
    var hideRoot = document.getElementById("gc-fw-v2-obj-hide-dd");
    if (hideRoot && hideRoot._gcTablesDdRefreshMultiLabel) hideRoot._gcTablesDdRefreshMultiLabel();
  }

  var designerTablePropsFlyoutFocusReturn = null;
  var designerTablePropsFlyoutRequestDismiss = function () {
    designerTablePropsFlyoutClose();
  };

  function syncDesignerModalScrollLock() {
    var anyOpen = document.querySelector(".gc-designer-modal:not([hidden])");
    document.body.classList.toggle("gc-designer-modal-open", !!anyOpen);
  }

  function resetDesignerFlyoutScrollChurn() {
    try {
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
      var ab = document.querySelector(".app-body");
      if (ab) ab.scrollLeft = 0;
      var main = document.querySelector(".app-main");
      if (main) main.scrollLeft = 0;
    } catch (e) { }
  }

  function getDesignerTablePropsFlyout() {
    return document.getElementById("gc-fw-v2-obj-props-flyout");
  }

  function designerTablePropsFlyoutIsOpen() {
    var root = getDesignerTablePropsFlyout();
    return !!(root && !root.hidden);
  }

  function fetchAndApplyDesignerTableProps(opts) {
    return fetch(designerTablePropsApiUrl(), {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        if (res.ok && res.j && res.j.properties && designerTableApi) {
          designerTableApi.setTablePropertiesJson(res.j.properties, opts);
        }
      });
  }

  function designerTablePropsFlyoutOpen() {
    var root = getDesignerTablePropsFlyout();
    if (!root) return;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    syncDesignerModalScrollLock();
    resetDesignerFlyoutScrollChurn();
    fetchAndApplyDesignerTableProps({ preserveDesignMode: true, preserveColumnLayout: true })
      .then(function () {
        return loadDesignerEntityTypeList();
      })
      .then(function () {
        scheduleProbeColumns();
        syncDesignerTableToolbarOpts();
        updateDesignerReadOnlyToolbarButtons();
      });
    var saveFocus = document.getElementById("gc-fw-v2-obj-props-flyout-save");
    if (saveFocus) {
      try {
        saveFocus.focus();
      } catch (eF) { }
    }
  }

  function designerTablePropsFlyoutClose() {
    var root = getDesignerTablePropsFlyout();
    if (!root || root.hidden) return;
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    syncDesignerModalScrollLock();
    resetDesignerFlyoutScrollChurn();
    var ret = designerTablePropsFlyoutFocusReturn;
    designerTablePropsFlyoutFocusReturn = null;
    if (ret && ret.focus) {
      try {
        ret.focus();
      } catch (eR) { }
    }
  }

  function openDesignerTablePropsFlyoutFrom(el) {
    designerTablePropsFlyoutFocusReturn = el || null;
    designerTablePropsFlyoutOpen();
  }

  function wireDesignerTablePropsFlyout() {
    var root = getDesignerTablePropsFlyout();
    if (!root || root.dataset.gcPropsFlyoutWired) return;
    root.dataset.gcPropsFlyoutWired = "1";
    var backdrop = root.querySelector(".gc-designer-tables-props-flyout__backdrop");
    var closeBtn = document.getElementById("gc-fw-v2-obj-props-flyout-close");
    if (backdrop) {
      backdrop.addEventListener("click", function () {
        designerTablePropsFlyoutRequestDismiss();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        designerTablePropsFlyoutRequestDismiss();
      });
    }
    var secBtn = document.getElementById("gc-fw-v2-obj-props-flyout-open-section");
    if (secBtn) {
      secBtn.addEventListener("click", function () {
        openDesignerTablePropsFlyoutFrom(secBtn);
      });
    }
    bindDesignerTablesPropsFlyoutResize();
  }

  function bindDesignerTablesPropsFlyoutResize() {
    var root = getDesignerTablePropsFlyout();
    var panel = document.getElementById("gc-fw-v2-obj-props-flyout-primary");
    var handle = panel && panel.querySelector(".gc-designer-view-flyout__resize--primary");
    if (!root || !panel || !handle || root.dataset.gcTablesPropsResizeBound === "1") return;
    root.dataset.gcTablesPropsResizeBound = "1";
    var MIN_W = 280;
    handle.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      var startX = e.clientX;
      var startW = panel.getBoundingClientRect().width;
      function overlayWidth() {
        return root.getBoundingClientRect().width;
      }
      function onMove(e2) {
        var cap = overlayWidth();
        var w = startW + (startX - e2.clientX);
        w = Math.max(MIN_W, Math.min(cap, w));
        panel.style.width = w + "px";
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function mountDesignerDesignModeToggle() {
    if (!designerTableDesignModeEligible()) return;
    var slot = document.getElementById("gc-fw-v2-obj-head-end");
    if (!slot || document.getElementById("gc-fw-v2-obj-design-mode-wrap")) return;
    var wrap = document.createElement("div");
    wrap.id = "gc-fw-v2-obj-design-mode-wrap";
    wrap.className = "gc-designer-tables-design-mode-wrap gc-fw-v2-obj-design-mode-wrap";
    var lab = document.createElement("label");
    lab.className =
      "gc-toolbar-combine gc-designer-tables-design-mode-switch gc-fw-v2-obj-design-mode-switch";
    lab.setAttribute("title", "Reorder columns, rename headers, and sync column visibility to properties");
    var spTxt = document.createElement("span");
    spTxt.className = "gc-toolbar-combine__text";
    spTxt.textContent = "Design mode";
    var inp = document.createElement("input");
    inp.type = "checkbox";
    inp.className = "gc-toolbar-combine__input";
    inp.id = "gc-fw-v2-obj-design-mode";
    inp.setAttribute("aria-label", "Table design mode");
    inp.setAttribute("autocomplete", "off");
    try {
      inp.checked = sessionStorage.getItem(DESIGN_MODE_LS) === "1";
    } catch (eSs) { }
    var track = document.createElement("span");
    track.className = "gc-toolbar-combine__track";
    track.setAttribute("aria-hidden", "true");
    var thumb = document.createElement("span");
    thumb.className = "gc-toolbar-combine__thumb";
    track.appendChild(thumb);
    lab.appendChild(spTxt);
    lab.appendChild(inp);
    lab.appendChild(track);
    wrap.appendChild(lab);
    var pencil = document.createElement("button");
    pencil.type = "button";
    pencil.className = "gc-designer-tables-props-flyout-pencil gc-fw-v2-obj-props-flyout-pencil";
    pencil.id = "gc-fw-v2-obj-props-flyout-pencil";
    pencil.setAttribute("aria-label", "Edit data source and table properties");
    pencil.setAttribute("title", "Data source & table properties");
    pencil.hidden = true;
    pencil.disabled = true;
    pencil.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.41l-2.34-2.34a1.003 1.003 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    pencil.addEventListener("click", function (ev) {
      ev.preventDefault();
      if (!isDesignerTableDesignModeOn()) return;
      openDesignerTablePropsFlyoutFrom(pencil);
    });
    wrap.appendChild(pencil);
    slot.appendChild(wrap);
    inp.addEventListener("change", function () {
      try {
        sessionStorage.setItem(DESIGN_MODE_LS, inp.checked ? "1" : "0");
      } catch (eS2) { }
      updateDesignerDesignModeChrome();
      designerTableApi.refresh();
    });
    updateDesignerDesignModeChrome();
  }

  function designerTableWrapEl() {
    return document.querySelector(".gc-designer-data-table .table-wrap.gc-net-if-table-wrap");
  }

  function hideHeaderContextMenu() {
    var m = document.getElementById("gc-fw-v2-obj-header-ctx");
    if (m) {
      m.hidden = true;
      m.style.display = "none";
    }
  }

  function showHeaderContextMenu(x, y, colId) {
    var m = document.getElementById("gc-fw-v2-obj-header-ctx");
    if (!m) {
      m = document.createElement("div");
      m.id = "gc-fw-v2-obj-header-ctx";
      m.className = "gc-designer-tables-header-ctx gc-fw-v2-obj-header-ctx";
      m.setAttribute("role", "menu");
      m.hidden = true;
      document.body.appendChild(m);
    }
    m.dataset.gcColId = colId;
    var baseMap = window.GC_DESIGNER_TABLES_BASE_LABELS || {};
    var base = baseMap[colId] != null ? String(baseMap[colId]) : String(colId);
    var ov = parseOverrides(document.getElementById("gc-fw-v2-obj-col-overrides").value);
    var hasOv =
      Object.prototype.hasOwnProperty.call(ov, colId) && String(ov[colId] || "").trim() !== "";
    m.innerHTML =
      '<button type="button" class="gc-designer-tables-header-ctx__btn gc-fw-v2-obj-header-ctx__btn" role="menuitem" data-gc-action="rename">Rename…</button>' +
      (hasOv
        ? '<button type="button" class="gc-designer-tables-header-ctx__btn gc-fw-v2-obj-header-ctx__btn" role="menuitem" data-gc-action="revert">Revert name</button>'
        : "");
    m.hidden = false;
    m.style.display = "block";
    m.style.position = "fixed";
    m.style.left = x + "px";
    m.style.top = y + "px";
    m.style.zIndex = "400";
    m.querySelectorAll("[data-gc-action]").forEach(function (btn) {
      btn.onclick = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var act = btn.getAttribute("data-gc-action");
        hideHeaderContextMenu();
        if (act === "rename") {
          var ovn = parseOverrides(document.getElementById("gc-fw-v2-obj-col-overrides").value);
          var shown =
            ovn[colId] != null && String(ovn[colId]).trim() !== ""
              ? String(ovn[colId]).trim()
              : base;
          var nv = window.prompt("Column display name", shown);
          if (nv == null) return;
          nv = String(nv).trim();
          if (nv === "" || nv === base) delete ovn[colId];
          else ovn[colId] = nv;
          document.getElementById("gc-fw-v2-obj-col-overrides").value = formatOverrides(ovn);
          designerTableApi.refresh();
          scheduleDesignerTableLayoutAutosave();
        } else if (act === "revert") {
          var ovr = parseOverrides(document.getElementById("gc-fw-v2-obj-col-overrides").value);
          delete ovr[colId];
          document.getElementById("gc-fw-v2-obj-col-overrides").value = formatOverrides(ovr);
          designerTableApi.refresh();
          scheduleDesignerTableLayoutAutosave();
        }
      };
    });
  }

  function teardownDesignModeHeaderHandlers() {
    if (designHeaderAborter) {
      designHeaderAborter.abort();
      designHeaderAborter = null;
    }
  }

  function wireDesignModeTableHeaders(thead) {
    teardownDesignModeHeaderHandlers();
    if (!thead || !isDesignerTableDesignModeOn()) return;
    designHeaderAborter = new AbortController();
    var sig = { signal: designHeaderAborter.signal };
    var dragColId = null;
    thead.querySelectorAll("th[data-gc-col]").forEach(function (th) {
      var cid = th.getAttribute("data-gc-col");
      if (!cid || cid === "_placeholder") return;
      th.setAttribute("draggable", "true");
      th.classList.add("gc-fw-v2-obj-th--draggable");
    });
    thead.addEventListener(
      "dragstart",
      function (e) {
        var th = e.target && e.target.closest ? e.target.closest("th[data-gc-col]") : null;
        if (!th || !thead.contains(th)) return;
        dragColId = th.getAttribute("data-gc-col");
        if (!dragColId || dragColId === "_placeholder") {
          e.preventDefault();
          return;
        }
        try {
          e.dataTransfer.setData("text/plain", dragColId);
          e.dataTransfer.effectAllowed = "move";
        } catch (eDt) { }
      },
      sig,
    );
    thead.addEventListener(
      "dragover",
      function (e) {
        e.preventDefault();
        try {
          e.dataTransfer.dropEffect = "move";
        } catch (eD2) { }
      },
      sig,
    );
    thead.addEventListener(
      "drop",
      function (e) {
        e.preventDefault();
        var tgt = e.target && e.target.closest ? e.target.closest("th[data-gc-col]") : null;
        if (!tgt || !thead.contains(tgt)) return;
        var toId = tgt.getAttribute("data-gc-col");
        var fromId = dragColId;
        try {
          var fromDt = e.dataTransfer.getData("text/plain");
          if (fromDt) fromId = fromDt;
        } catch (eG) { }
        if (!fromId || !toId || fromId === toId || toId === "_placeholder") return;
        var row = thead.querySelector("tr");
        if (!row) return;
        var ths = row.querySelectorAll("th[data-gc-col]");
        var order = [];
        for (var i = 0; i < ths.length; i++) {
          var id = ths[i].getAttribute("data-gc-col");
          if (id && id !== "_placeholder") order.push(id);
        }
        var fi = order.indexOf(fromId);
        var ti = order.indexOf(toId);
        if (fi < 0 || ti < 0) return;
        order.splice(fi, 1);
        order.splice(ti, 0, fromId);
        document.getElementById("gc-fw-v2-obj-col-order").value = order.join(", ");
        dragColId = null;
        designerTableApi.refresh();
        scheduleDesignerTableLayoutAutosave();
      },
      sig,
    );
    thead.addEventListener(
      "dragend",
      function () {
        dragColId = null;
      },
      sig,
    );
    thead.addEventListener(
      "contextmenu",
      function (e) {
        if (!isDesignerTableDesignModeOn()) return;
        var th = e.target && e.target.closest ? e.target.closest("th[data-gc-col]") : null;
        if (!th || !thead.contains(th)) return;
        var cid = th.getAttribute("data-gc-col");
        if (!cid || cid === "_placeholder") return;
        e.preventDefault();
        showHeaderContextMenu(e.clientX, e.clientY, cid);
      },
      sig,
    );
  }

  function updateDesignerDesignModeChrome() {
    var tw = designerTableWrapEl();
    var on = isDesignerTableDesignModeOn();
    if (tw) tw.classList.toggle("gc-designer-table--design-mode", on);
    var pencil = document.getElementById("gc-fw-v2-obj-props-flyout-pencil");
    if (pencil) {
      pencil.hidden = !on;
      pencil.disabled = !on;
    }
    var thead = document.getElementById("gc-fw-v2-obj-thead");
    if (thead) {
      thead.querySelectorAll("th[data-gc-col]").forEach(function (th) {
        var cid = th.getAttribute("data-gc-col");
        if (!cid || cid === "_placeholder") {
          th.removeAttribute("draggable");
          th.classList.remove("gc-fw-v2-obj-th--draggable");
          return;
        }
        if (on) {
          th.setAttribute("draggable", "true");
          th.classList.add("gc-fw-v2-obj-th--draggable");
        } else {
          th.removeAttribute("draggable");
          th.classList.remove("gc-fw-v2-obj-th--draggable");
        }
      });
    }
    if (!on) {
      teardownDesignModeHeaderHandlers();
      hideHeaderContextMenu();
    } else if (thead) {
      wireDesignModeTableHeaders(thead);
    }
  }

  document.addEventListener("click", function (e) {
    var menu = document.getElementById("gc-fw-v2-obj-header-ctx");
    if (menu && !menu.hidden && e.target && menu.contains(e.target)) return;
    hideHeaderContextMenu();
  });
  function designerTableOptRowSelectorsOn() {
    var el = document.getElementById("gc-fw-v2-obj-opt-row-selectors");
    return !!(el && el.checked);
  }

  function designerTableOptAddBtnOn() {
    var el = document.getElementById("gc-fw-v2-obj-opt-add-btn");
    return !!(el && el.checked);
  }

  function designerTableOptDeleteBtnOn() {
    var el = document.getElementById("gc-fw-v2-obj-opt-delete-btn");
    return !!(el && el.checked);
  }

  function designerTableReadOnlyOn() {
    var el = document.getElementById("gc-fw-v2-obj-opt-read-only");
    return !!(el && el.checked);
  }

  function fwV2ObjectEditTrim(x) {
    return String(x == null ? "" : x).replace(/^\s+|\s+$/g, "");
  }

  function fwV2ObjectEditRowDisplayName(row) {
    if (!row || typeof row !== "object") return "";
    var cells = row.cells && typeof row.cells === "object" ? row.cells : {};
    var n =
      cells.__name != null
        ? String(cells.__name)
        : cells.name != null
          ? String(cells.name)
          : "";
    if (fwV2ObjectEditTrim(n)) return fwV2ObjectEditTrim(n);
    if (row.external_name != null && fwV2ObjectEditTrim(row.external_name))
      return fwV2ObjectEditTrim(row.external_name);
    return "";
  }

  function fwV2ObjectEditEntityTypeForRow(row) {
    if (row && row.entity_type != null) {
      var t = fwV2ObjectEditTrim(row.entity_type);
      if (t) return t;
    }
    var types = getSelectedEntityTypes();
    if (types.length === 1) return fwV2ObjectEditTrim(types[0]);
    return "";
  }

  function syncDesignerTableToolbarOpts() {
    var addB = document.getElementById("gc-fw-v2-obj-add");
    var delB = document.getElementById("gc-fw-v2-obj-delete-selected");
    var addOn = designerTableOptAddBtnOn();
    var delOn = designerTableOptDeleteBtnOn();
    if (addB) {
      addB.hidden = !addOn;
      if (addOn) addB.removeAttribute("hidden");
      else addB.setAttribute("hidden", "");
    }
    if (delB) {
      delB.hidden = !delOn;
      if (delOn) delB.removeAttribute("hidden");
      else delB.setAttribute("hidden", "");
    }
    if (typeof designerTableApi !== "undefined" && designerTableApi && typeof designerTableApi.syncIpHostSelectAllHeader === "function") {
      try {
        designerTableApi.syncIpHostSelectAllHeader();
      } catch (eTbSync) { }
    }
  }

  function updateDesignerReadOnlyToolbarButtons() {
    var ro = designerTableReadOnlyOn();
    var addB = document.getElementById("gc-fw-v2-obj-add");
    var delB = document.getElementById("gc-fw-v2-obj-delete-selected");
    if (addB && !addB.hidden) {
      addB.disabled = !!ro;
    }
    if (delB && !delB.hidden && ro) {
      delB.disabled = true;
    }
  }

  function designerPreviewSelectedRowCount() {
    var tb = document.getElementById("gc-fw-v2-obj-tbody");
    if (!tb) return 0;
    var n = 0;
    tb.querySelectorAll("tr.gc-fw-v2-obj-data-row input.gc-hs-row-select:checked").forEach(function (inp) {
      if (!inp.disabled) n++;
    });
    return n;
  }

  var lastFwV2ObjTablePayload = {};

  function fwV2ObjCombineStorageKey() {
    return "ground-control-fw-v2-obj-combine-v1:" + DESIGNER_TABLE_INSTANCE_ID;
  }

  function initFwV2ObjCombineToggleFromStorage() {
    var inp = document.getElementById("gc-fw-v2-obj-combine");
    var fly = document.getElementById("gc-fw-v2-obj-opt-combine-view");
    if (!inp) return;
    try {
      var v = localStorage.getItem(fwV2ObjCombineStorageKey());
      if (v === "0") {
        inp.checked = false;
        if (fly) fly.checked = false;
      } else if (v === "1") {
        inp.checked = true;
        if (fly) fly.checked = true;
      }
    } catch (eSt) { }
  }

  function updateFwV2CombineChrome(data) {
    var wrap = document.getElementById("gc-fw-v2-obj-combine-wrap");
    var inp = document.getElementById("gc-fw-v2-obj-combine");
    if (!wrap || !inp) return;
    var conflicts = !!(data && (data.hs_combine_conflicts || data.ip_hosts_combine_conflicts));
    var flat = !!(data && (data.hs_combined === false || data.ip_hosts_combined === false));
    wrap.classList.toggle("gc-toolbar-combine--warning", conflicts && !flat && inp.checked);
  }

  function escFwV2CombineModal(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function boolTriFwV2Modal(raw) {
    var t = String(raw == null ? "" : raw)
      .trim()
      .toLowerCase();
    if (t === "") return null;
    if (t === "1" || t === "true" || t === "yes" || t === "on" || t === "enabled" || t === "enable") return true;
    if (t === "0" || t === "false" || t === "no" || t === "off" || t === "disabled" || t === "disable") return false;
    return null;
  }

  function modalToggleHtmlFwV2(on) {
    var state = on ? "on" : "off";
    var lab = on ? "On" : "Off";
    return (
      '<span class="gc-table-toggle gc-table-toggle--static gc-table-toggle--' +
      state +
      '" role="img" aria-label="' +
      lab +
      '"><span class="gc-table-toggle__track" aria-hidden="true"><span class="gc-table-toggle__thumb"></span></span></span>'
    );
  }

  function modalValueCellFwV2(val) {
    var tri = boolTriFwV2Modal(val);
    if (tri !== null) return modalToggleHtmlFwV2(tri);
    var s0 = String(val == null ? "" : val);
    var s = s0.trim();
    if (s === "") return modalToggleHtmlFwV2(false);
    return '<span class="gc-net-zone-modal__scalar">' + escFwV2CombineModal(s) + "</span>";
  }

  function zoneHueFwV2Modal(name) {
    var h = 0;
    var str = String(name || "");
    for (var i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  }

  function fwPillModalFwV2(name) {
    var hue = zoneHueFwV2Modal(name);
    return (
      '<span class="gc-zone-pill" style="--gc-zone-h:' + hue + '">' + escFwV2CombineModal(name) + "</span>"
    );
  }

  function buildFwV2ObjCombineModalHtml(data) {
    var labels = (data && data.column_labels) || {};
    var rows = (data && data.rows) || [];
    var conflictRows = rows.filter(function (r) {
      if (!r) return false;
      var pf = r.hs_combine_per_field || r.ip_host_combine_per_field;
      var c = r.hs_combine_conflict || r.ip_host_combine_conflict;
      return c && pf;
    });
    if (!conflictRows.length) {
      return '<p class="muted">No differing field values for this selection.</p>';
    }
    return conflictRows
      .map(function (row) {
        var hname = (row.cells && row.cells.__name) || "";
        var pf = row.hs_combine_per_field || row.ip_host_combine_per_field || {};
        var colKeys = Object.keys(pf).sort();
        var parts =
          '<section class="gc-net-zone-modal__zone"><h3 class="gc-net-zone-modal__zn">' +
          escFwV2CombineModal(hname) +
          "</h3>";
        colKeys.forEach(function (colKey) {
          var lbl = labels[colKey] || colKey;
          parts +=
            '<h4 class="gc-net-zone-modal__col">' + escFwV2CombineModal(lbl).replace(/\n/g, "<br />") + "</h4>";
          parts += '<ul class="gc-net-zone-modal__fw-list">';
          var per = pf[colKey];
          Object.keys(per)
            .sort()
            .forEach(function (fw) {
              parts +=
                '<li class="gc-net-zone-modal__fw-row">' +
                fwPillModalFwV2(fw) +
                '<span class="gc-net-zone-modal__fw-val">' +
                modalValueCellFwV2(per[fw]) +
                "</span></li>";
            });
          parts += "</ul>";
        });
        parts += "</section>";
        return parts;
      })
      .join("");
  }

  var fwV2CombineModal = document.getElementById("gc-fw-v2-obj-combine-modal");
  var fwV2CombineModalBody = document.getElementById("gc-fw-v2-obj-combine-modal-body");
  var fwV2CombineModalClose = document.getElementById("gc-fw-v2-obj-combine-modal-close");
  var fwV2CombineModalDone = document.getElementById("gc-fw-v2-obj-combine-modal-done");

  function closeFwV2ObjCombineModal() {
    if (!fwV2CombineModal) return;
    fwV2CombineModal.hidden = true;
    fwV2CombineModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function openFwV2ObjCombineModal() {
    if (!fwV2CombineModalBody || !fwV2CombineModal) return;
    fwV2CombineModalBody.innerHTML = buildFwV2ObjCombineModalHtml(lastFwV2ObjTablePayload);
    fwV2CombineModal.hidden = false;
    fwV2CombineModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (fwV2CombineModalClose) fwV2CombineModalClose.focus();
  }

  function onFwV2CombineModalKeydown(e) {
    if (!fwV2CombineModal || fwV2CombineModal.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeFwV2ObjCombineModal();
    }
  }

  document.addEventListener("keydown", onFwV2CombineModalKeydown);

  if (fwV2CombineModal) {
    var fwV2Cb = fwV2CombineModal.querySelector(".gc-net-zone-combine-modal__backdrop");
    if (fwV2Cb) fwV2Cb.addEventListener("click", closeFwV2ObjCombineModal);
    if (fwV2CombineModalClose) fwV2CombineModalClose.addEventListener("click", closeFwV2ObjCombineModal);
    if (fwV2CombineModalDone) fwV2CombineModalDone.addEventListener("click", closeFwV2ObjCombineModal);
  }

  initFwV2ObjCombineToggleFromStorage();

  function afterDesignerTableRender() {
    mountDesignerDesignModeToggle();
    updateDesignerDesignModeChrome();
    syncDesignerTableToolbarOpts();
    updateDesignerReadOnlyToolbarButtons();
    var captureBaseline = designerTablePersistBaselineAfterNextRender;
    if (captureBaseline) designerTablePersistBaselineAfterNextRender = false;
    queueMicrotask(function () {
      syncDesignerTableToolbarOpts();
      updateDesignerReadOnlyToolbarButtons();
      if (captureBaseline) markDesignerTablePropsSaved();
    });
  }

  var designerTableApi = window.gcCreateNetworkEntityTable({
    prefix: "gc-fw-v2-obj",
    apiUrl: "",
    emptySelectionMessage: "Select one or more firewalls or configurations in the top bar.",
    lsKey: DESIGNER_TABLE_COL_LS_KEY,
    dataRowClass: "gc-fw-v2-obj-data-row",
    colPickerAttr: "data-gc-fw-v2-obj-col",
    /* Multi-value cells use gcTableBindListCell, which stops propagation — row clicks never reached onRowClick. */
    skipListCellModalBind: true,
    rowClickable: true,
    rowAriaEntitySingular: "object",
    onRowClick: function (tr) {
      if (designerTableReadOnlyOn()) return;
      var row = tr && tr._gcNetRow;
      if (!row || typeof row !== "object") return;
      if (typeof globalThis.gcDesignerOpenObjectEditFlyoutFromDataControls !== "function") return;
      var et = fwV2ObjectEditEntityTypeForRow(row);
      globalThis.gcDesignerOpenObjectEditFlyoutFromDataControls({
        entityType: et,
        rowLabel: fwV2ObjectEditRowDisplayName(row),
        row: row,
      });
    },
    combineQuery: { param: "combine" },
    getTablePropertiesJson: function () {
      return collectDesignerTablePropsPayload();
    },
    setTablePropertiesJson: function (p, opts) {
      applyLoadedDesignerTableProps(p, opts || {});
    },
    afterRenderFromApi: function (data) {
      lastFwV2ObjTablePayload = data && typeof data === "object" ? data : {};
      afterDesignerTableRender();
      updateFwV2CombineChrome(lastFwV2ObjTablePayload);
    },
    onColVisPersist: function (vis) {
      if (!isDesignerTableDesignModeOn()) return;
      syncHideListFromColVis(vis);
    },
    bulkRowSelect: function () {
      return designerTableOptRowSelectorsOn();
    },
    tableReadOnly: function () {
      return designerTableReadOnlyOn();
    },
    onBulkSelectionChange: function () {
      updateDesignerReadOnlyToolbarButtons();
    },
    fetchTablePayload: function (ctx) {
      var types = getSelectedEntityTypes();
      if (!types.length) {
        return Promise.resolve({
          columns: [],
          column_labels: {},
          columns_visible_by_default: [],
          rows: [],
        });
      }
      return mergePayloadsForTypes(ctx, types, 800).then(function (merged) {
        populatePropertyDropdowns(merged);
        return merged;
      });
    },
    transformTablePayload: applyColumnProperties,
    labels: {
      countSingular: "row",
      countPlural: "rows",
      emptyCache:
        "No rows in the cache for the current selection — widen the top-bar scope, pick object types in table properties, or run a config sync.",
      emptyFilter: "No rows match the current search or facet filters.",
      loadError: "Could not load table data.",
    },
  });

  syncDesignerTableToolbarOpts();
  updateDesignerReadOnlyToolbarButtons();

  wireDesignerTablePropsFlyout();
  wireTablesSearchableDropdown(document.getElementById("gc-fw-v2-obj-entity-dd"));
  wireTablesSearchableDropdown(document.getElementById("gc-fw-v2-obj-hide-dd"));

  var entityTypeListEl = document.getElementById("gc-fw-v2-obj-entity-list");
  if (entityTypeListEl) {
    entityTypeListEl.addEventListener("change", function (e) {
      if (e.target && e.target.matches("input[type=checkbox]")) {
        scheduleProbeColumns();
      }
    });
  }

  ["gc-fw-v2-obj-opt-row-selectors", "gc-fw-v2-obj-opt-add-btn", "gc-fw-v2-obj-opt-delete-btn", "gc-fw-v2-obj-opt-read-only", "gc-fw-v2-obj-opt-combine-view"].forEach(
    function (tid) {
      var tgl = document.getElementById(tid);
      if (!tgl) return;
      tgl.addEventListener("change", function () {
        if (tid === "gc-fw-v2-obj-opt-combine-view") {
          var bar = document.getElementById("gc-fw-v2-obj-combine");
          if (bar) bar.checked = !!tgl.checked;
          try {
            localStorage.setItem(fwV2ObjCombineStorageKey(), tgl.checked ? "1" : "0");
          } catch (eC0) { }
        }
        syncDesignerTableToolbarOpts();
        updateDesignerReadOnlyToolbarButtons();
        designerTableApi.refresh();
      });
    },
  );

  var combineByColSel = document.getElementById("gc-fw-v2-obj-combine-by-column");
  if (combineByColSel) {
    combineByColSel.addEventListener("change", function () {
      designerTableApi.refresh();
    });
  }

  var combineToolbarInp = document.getElementById("gc-fw-v2-obj-combine");
  if (combineToolbarInp) {
    combineToolbarInp.addEventListener("change", function () {
      var fly = document.getElementById("gc-fw-v2-obj-opt-combine-view");
      if (fly) fly.checked = !!combineToolbarInp.checked;
      try {
        localStorage.setItem(fwV2ObjCombineStorageKey(), combineToolbarInp.checked ? "1" : "0");
      } catch (eC1) { }
      designerTableApi.refresh();
    });
    combineToolbarInp.addEventListener("pointerdown", function (e) {
      var d = lastFwV2ObjTablePayload;
      var conflicts = !!(d && (d.hs_combine_conflicts || d.ip_hosts_combine_conflicts));
      if (!d || !conflicts || !combineToolbarInp.checked) return;
      if (e.shiftKey) return;
      var pt = e.pointerType;
      if (pt !== "mouse" && pt !== "pen" && pt !== "touch") return;
      if (pt === "mouse" && e.button !== 0) return;
      e.preventDefault();
      openFwV2ObjCombineModal();
    });
  }

  var addPreviewBtn = document.getElementById("gc-fw-v2-obj-add");
  if (addPreviewBtn) {
    addPreviewBtn.addEventListener("click", function () {
      if (designerTableReadOnlyOn()) return;
      window.alert("Add (designer preview — no data is changed).");
    });
  }
  var delPreviewBtn = document.getElementById("gc-fw-v2-obj-delete-selected");
  if (delPreviewBtn) {
    delPreviewBtn.addEventListener("click", function () {
      if (designerTableReadOnlyOn()) return;
      var n = designerPreviewSelectedRowCount();
      window.alert(
        n
          ? "Delete " + n + " selected row(s) (designer preview — no data is changed)."
          : "No rows selected.",
      );
    });
  }

  var secTb = document.getElementById("gc-fw-v2-obj-secondary-filters-tbody");
  if (secTb) {
    secTb._gcDesignerTableRefresh = function () {
      designerTableApi.refresh();
    };
  }

  document.addEventListener("gc-firewall-selection-changed", function () {
    loadDesignerEntityTypeList().then(function () {
      scheduleProbeColumns();
      designerTableApi.refresh();
    });
  });
  document.addEventListener("gc-configuration-exclusive-view-changed", function () {
    loadDesignerEntityTypeList().then(function () {
      scheduleProbeColumns();
      designerTableApi.refresh();
    });
  });
  document.addEventListener("gc-configuration-selection-changed", function () {
    loadDesignerEntityTypeList().then(function () {
      scheduleProbeColumns();
      designerTableApi.refresh();
    });
  });

  wireSecondaryFiltersTable();
  scheduleProbeColumns();

  var titleInpLive = document.getElementById("gc-fw-v2-obj-prop-title");
  if (titleInpLive) titleInpLive.addEventListener("input", applyTableTitleFromInput);

  var designerTableLayoutAutosaveTimer = null;
  var designerTableLayoutAutosaveInFlight = false;

  function scheduleDesignerTableLayoutAutosave() {
    if (!isDesignerTableDesignModeOn()) return;
    if (!designerTablePropsDirty()) return;
    if (designerTableLayoutAutosaveTimer) clearTimeout(designerTableLayoutAutosaveTimer);
    designerTableLayoutAutosaveTimer = setTimeout(function () {
      designerTableLayoutAutosaveTimer = null;
      if (!isDesignerTableDesignModeOn()) return;
      if (!designerTablePropsDirty()) return;
      if (designerTableLayoutAutosaveInFlight) {
        scheduleDesignerTableLayoutAutosave();
        return;
      }
      designerTableLayoutAutosaveInFlight = true;
      performDesignerTableSave({
        closeFlyout: false,
        saveButton: null,
        quiet: true,
      })
        .catch(function () { })
        .finally(function () {
          designerTableLayoutAutosaveInFlight = false;
        });
    }, 450);
  }

  function performDesignerTableSave(options) {
    options = options || {};
    applyTableTitleFromInput();
    var saveBtn = Object.prototype.hasOwnProperty.call(options, "saveButton")
      ? options.saveButton
      : document.getElementById("gc-fw-v2-obj-props-flyout-save");
    if (saveBtn) saveBtn.disabled = true;
    if (!options.quiet) setDesignerTableSaveStatus("Saving…", false);
    return fetch(designerTablePropsApiUrl(), {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "Ground-Control",
      },
      body: JSON.stringify(designerTableApi.getTablePropertiesJson() || {}),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (out) {
        if (out.ok && out.j && out.j.ok) {
          if (out.j.properties) designerTableApi.setTablePropertiesJson(out.j.properties);
          return loadDesignerEntityTypeList().then(function () {
            designerTablePersistBaselineAfterNextRender = true;
            designerTableApi.refresh();
            if (options.closeFlyout !== false) designerTablePropsFlyoutClose();
            if (!options.quiet) setDesignerTableSaveStatus("", false);
            return true;
          });
        }
        var det = out.j && out.j.detail;
        var msg =
          typeof det === "string"
            ? det
            : det
              ? JSON.stringify(det)
              : "Save failed";
        setDesignerTableSaveStatus(msg, true);
        return false;
      })
      .catch(function () {
        if (!options.quiet) setDesignerTableSaveStatus("Save failed", true);
        return false;
      })
      .finally(function () {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function performDesignerTableSaveThenRefresh() {
    setDesignerTableSaveStatus("Saving…", false);
    var saveBtn = document.getElementById("gc-fw-v2-obj-props-flyout-save");
    performDesignerTableSave({ saveButton: saveBtn, closeFlyout: true });
  }

  function designerTablePropsFlyoutCancel() {
    setDesignerTableSaveStatus("", false);
    fetchAndApplyDesignerTableProps()
      .catch(function () { })
      .then(function () {
        return loadDesignerEntityTypeList();
      })
      .then(function () {
        designerTablePersistBaselineAfterNextRender = true;
        designerTableApi.refresh();
      })
      .then(function () {
        designerTablePropsFlyoutClose();
      });
  }

  designerTablePropsFlyoutRequestDismiss = designerTablePropsFlyoutCancel;

  var cancelFlyoutBtn = document.getElementById("gc-fw-v2-obj-props-flyout-cancel");
  if (cancelFlyoutBtn) {
    cancelFlyoutBtn.addEventListener("click", function () {
      designerTablePropsFlyoutCancel();
    });
  }
  var saveFlyoutBtn = document.getElementById("gc-fw-v2-obj-props-flyout-save");
  if (saveFlyoutBtn) {
    saveFlyoutBtn.addEventListener("click", function () {
      performDesignerTableSaveThenRefresh();
    });
  }

  function designerTablesLeaveGuardIsOpen() {
    var root = document.getElementById("gc-fw-v2-obj-leave-guard");
    return !!(root && !root.hidden);
  }

  function designerTablesLeaveGuardClose() {
    var root = document.getElementById("gc-fw-v2-obj-leave-guard");
    if (root) {
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
    }
    designerTablesLeaveNavHref = null;
    syncDesignerModalScrollLock();
  }

  function designerTablesLeaveGuardOpen(href) {
    designerTablesLeaveNavHref = href || null;
    var root = document.getElementById("gc-fw-v2-obj-leave-guard");
    if (!root) return;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    syncDesignerModalScrollLock();
    var b = document.getElementById("gc-fw-v2-obj-leave-stay");
    if (b) {
      try {
        b.focus();
      } catch (eFs) { }
    }
  }

  function designerTablesLeaveGuardWire() {
    var root = document.getElementById("gc-fw-v2-obj-leave-guard");
    if (!root || root.dataset.gcLeaveGuardWired) return;
    root.dataset.gcLeaveGuardWired = "1";
    var stay = document.getElementById("gc-fw-v2-obj-leave-stay");
    var discard = document.getElementById("gc-fw-v2-obj-leave-discard");
    var saveG = document.getElementById("gc-fw-v2-obj-leave-save");
    var bd = document.getElementById("gc-fw-v2-obj-leave-guard-backdrop");
    function guardBtns() {
      return [stay, discard, saveG].filter(Boolean);
    }
    function setGuardBusy(busy) {
      guardBtns().forEach(function (b) {
        b.disabled = !!busy;
      });
    }
    function finishStay() {
      designerTablesLeaveGuardClose();
    }
    if (stay) stay.addEventListener("click", finishStay);
    if (bd) bd.addEventListener("click", finishStay);
    if (discard) {
      discard.addEventListener("click", function () {
        var href = designerTablesLeaveNavHref;
        designerTablesLeaveGuardClose();
        if (href) window.location.href = href;
      });
    }
    if (saveG) {
      saveG.addEventListener("click", function () {
        var href = designerTablesLeaveNavHref;
        setGuardBusy(true);
        setDesignerTableSaveStatus("Saving…", false);
        performDesignerTableSave({ closeFlyout: true, saveButton: null })
          .then(function (ok) {
            if (ok && href) {
              designerTablesLeaveGuardClose();
              window.location.href = href;
            }
          })
          .finally(function () {
            setGuardBusy(false);
          });
      });
    }
  }

  designerTablesLeaveGuardWire();

  document.addEventListener("click", function (e) {
    if (!designerTablePropsDirty()) return;
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || !a.getAttribute("href")) return;
    if (a.closest("#gc-fw-v2-obj-leave-guard")) return;
    if (a.target === "_blank") return;
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.hasAttribute("download")) return;
    var href = a.getAttribute("href");
    if (!href || href.indexOf("#") === 0 || href.indexOf("javascript:") === 0) return;
    var url;
    try {
      url = new URL(href, window.location.href);
    } catch (eUrl) {
      return;
    }
    if (url.origin !== window.location.origin) return;
    var navPath = url.pathname.replace(/\/+$/, "") || "/";
    var herePath = window.location.pathname.replace(/\/+$/, "") || "/";
    if (navPath === herePath) return;
    e.preventDefault();
    e.stopPropagation();
    designerTablesLeaveGuardOpen(url.href);
  }, true);

  window.addEventListener("beforeunload", function (e) {
    if (!designerTablePropsDirty()) return;
    e.preventDefault();
    e.returnValue = "";
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (designerTablesLeaveGuardIsOpen()) {
      e.preventDefault();
      designerTablesLeaveGuardClose();
      return;
    }
    if (designerTablePropsFlyoutIsOpen()) {
      e.preventDefault();
      designerTablePropsFlyoutCancel();
      return;
    }
    hideHeaderContextMenu();
  });

  function bootstrapDesignerTablePropsAndData() {
    fetchAndApplyDesignerTableProps()
      .catch(function () { })
      .then(function () {
        return loadDesignerEntityTypeList();
      })
      .catch(function () {
        return loadDesignerEntityTypeList();
      })
      .then(function () {
        designerTablePersistBaselineAfterNextRender = true;
        designerTableApi.refresh();
      });
  }

  bootstrapDesignerTablePropsAndData();
})();