(function () {
  "use strict";

  var tabButtons = document.querySelectorAll("[data-gc-dc-tab]");
  var tabPanels = document.querySelectorAll("[data-gc-dc-panel]");
  var layoutRoot = document.getElementById("gc-designer-data-controls-layout-root");
  var canvasEl = document.getElementById("gc-designer-data-controls-layout-canvas");
  var nodesEl = document.getElementById("gc-designer-data-controls-layout-nodes");
  var edgesSvg = document.getElementById("gc-designer-data-controls-layout-edges");
  var logicEl = document.getElementById("gc-designer-data-controls-layout-logic");
  var controlsEl = document.getElementById("gc-designer-data-controls-layout-controls");
  var statusEl = document.getElementById("gc-designer-data-controls-layout-status");
  var resetBtn = document.getElementById("gc-designer-data-controls-layout-reset");
  var testPickerEl = document.getElementById("gc-designer-data-controls-layout-test-picker");
  var testTriggerEl = document.getElementById("gc-designer-data-controls-layout-test-trigger");
  var testPanelEl = document.getElementById("gc-designer-data-controls-layout-test-panel");
  var testSearchEl = document.getElementById("gc-designer-data-controls-layout-test-search");
  var testOptionsEl = document.getElementById("gc-designer-data-controls-layout-test-options");
  var traceBtn = document.getElementById("gc-designer-data-controls-layout-trace-btn");
  var showEditBtn = document.getElementById("gc-designer-data-controls-layout-show-edit-btn");
  var showAddBtn = document.getElementById("gc-designer-data-controls-layout-show-add-btn");
  var addAndBtn = document.getElementById("gc-designer-data-controls-layout-add-and");
  var addOrBtn = document.getElementById("gc-designer-data-controls-layout-add-or");
  var addNotBtn = document.getElementById("gc-designer-data-controls-layout-add-not");
  var addIfValueBtn = document.getElementById("gc-designer-data-controls-layout-add-if-value");
  var addCsvArrayBtn = document.getElementById("gc-designer-data-controls-layout-add-csv-array");
  var lockLayoutCb = document.getElementById("gc-designer-data-controls-layout-locked");
  if (!layoutRoot || !canvasEl || !nodesEl || !edgesSvg || !logicEl || !controlsEl) return;
  var dataEntryTypeOptions = [];
  (function hydrateDataEntryTypeOptions() {
    var src = document.getElementById("gc-designer-data-controls-entry-types");
    if (!src || !src.textContent) return;
    try {
      var j = JSON.parse(src.textContent);
      if (!Array.isArray(j)) return;
      dataEntryTypeOptions = j
        .map(function (x) {
          return trimStr(x);
        })
        .filter(Boolean);
    } catch (e) {}
  })();

  var state = {
    entityType: "",
    fields: [],
    layout: {
      node_positions: {},
      connections: [],
      logic_nodes: [],
      control_add_only: {},
      member_lookup_data_source: {},
      member_lookup_multi: {},
      layout_locked: false,
    },
    nodeCatalog: {},
    selectedEdgeKeys: {},
    connectorPointerDown: null,
    activeDragConnection: null,
    tempEdge: null,
    draggingEdgeKey: "",
    pendingEdgeDrag: null,
    pendingAutoWireFieldId: "",
    testObjects: [],
    selectedTestObjectName: "",
    showTestValues: false,
    /** Edge key (`data-edge-key`) for connection line highlight when hovering a test value label. */
    testValueHoverEdgeKey: "",
    lastSavedSignature: "",
    dragNode: null,
    saveTimer: 0,
    saveInFlight: false,
    savePending: false,
    fieldReorderDrag: null,
    controlReorderDrag: null,
  };

  var STORAGE_KEY_TEST_BY_ENTITY = "gc.designer.dataControls.testObjectByEntity";

  function readStoredTestObjectByEntityMap() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_TEST_BY_ENTITY);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (e) {
      return {};
    }
  }

  function persistSelectedTestObjectForEntity(name) {
    var et = trimStr(state.entityType);
    if (!et) return;
    var map = readStoredTestObjectByEntityMap();
    var n = trimStr(name);
    if (!n) delete map[et];
    else map[et] = n;
    try {
      localStorage.setItem(STORAGE_KEY_TEST_BY_ENTITY, JSON.stringify(map));
    } catch (e) {}
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function trimStr(x) {
    return String(x == null ? "" : x).replace(/^\s+|\s+$/g, "");
  }

  function escHtmlText(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function selectedFirewallIdsCsv() {
    if (typeof globalThis.gcGetSelectedFirewallIds !== "function") return "";
    var ids = globalThis.gcGetSelectedFirewallIds();
    if (!Array.isArray(ids) || !ids.length) return "";
    return ids
      .map(function (x) {
        var n = parseInt(String(x), 10);
        return isNaN(n) || n < 1 ? "" : String(n);
      })
      .filter(Boolean)
      .join(",");
  }

  function selectedConfigurationIdsCsv() {
    if (typeof globalThis.gcGetSelectedConfigurationIds !== "function") return "";
    var ids = globalThis.gcGetSelectedConfigurationIds();
    if (!Array.isArray(ids) || !ids.length) return "";
    return ids
      .map(function (x) {
        var n = parseInt(String(x), 10);
        return isNaN(n) || n < 1 ? "" : String(n);
      })
      .filter(Boolean)
      .join(",");
  }

  function rowName(row) {
    var cells = row && row.cells && typeof row.cells === "object" ? row.cells : {};
    var n = trimStr(cells.__name || row.external_name || "");
    return n;
  }

  function slug(s) {
    return trimStr(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "value";
  }

  function parseJsonObject(raw) {
    var s = trimStr(raw);
    if (!s) return {};
    try {
      var j = JSON.parse(s);
      return j && typeof j === "object" ? j : {};
    } catch (e) {
      return {};
    }
  }

  var EDGE_ID_RE = /^[a-zA-Z0-9_.:-]{1,128}$/;

  function edgeTupleKey(edge) {
    if (!edge || typeof edge !== "object") return "";
    return [
      trimStr(edge.source_node_id),
      trimStr(edge.source_handle),
      trimStr(edge.target_node_id),
      trimStr(edge.target_handle),
    ].join("|");
  }

  /** Stable per-wire id for SVG, selection, and retarget (not the same as endpoint tuple). */
  function edgeKey(edge) {
    var id = trimStr(edge && edge.edge_id);
    if (id && EDGE_ID_RE.test(id)) return id;
    return edgeTupleKey(edge);
  }

  function genEdgeId() {
    var id;
    var tries = 0;
    do {
      id = "gc_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
      tries++;
    } while (tries < 16 && (!id || !EDGE_ID_RE.test(id)));
    return id;
  }

  function ensureConnectionEdgeIds(conns) {
    if (!Array.isArray(conns)) return;
    var used = {};
    conns.forEach(function (e) {
      if (!e || typeof e !== "object") return;
      var id = trimStr(e.edge_id);
      if (id && EDGE_ID_RE.test(id)) used[id] = true;
    });
    conns.forEach(function (e) {
      if (!e || typeof e !== "object") return;
      var id = trimStr(e.edge_id);
      if (id && EDGE_ID_RE.test(id)) return;
      var nid;
      var guard = 0;
      do {
        nid = genEdgeId();
        guard++;
      } while (used[nid] && guard < 24);
      used[nid] = true;
      e.edge_id = nid;
    });
  }

  function clearSelectedEdges() {
    state.selectedEdgeKeys = {};
  }

  function setSelectedEdgeKeysFromList(keys) {
    state.selectedEdgeKeys = {};
    (keys || []).forEach(function (k) {
      var t = trimStr(k);
      if (t) state.selectedEdgeKeys[t] = true;
    });
  }

  function addSelectedEdgeKey(key) {
    var t = trimStr(key);
    if (t) state.selectedEdgeKeys[t] = true;
  }

  function isEdgeKeySelected(key) {
    return !!(key && state.selectedEdgeKeys[key]);
  }

  function countSelectedEdges() {
    return Object.keys(state.selectedEdgeKeys).length;
  }

  function selectEdgesForConnectorHandle(btn) {
    if (!btn) return;
    var nid = trimStr(btn.getAttribute("data-node-id"));
    var hid = trimStr(btn.getAttribute("data-handle-id"));
    var io = trimStr(btn.getAttribute("data-io"));
    if (!nid || !hid || !io) return;
    var keys = [];
    (state.layout.connections || []).forEach(function (edge) {
      if (!edge) return;
      if (io === "out" && edge.source_node_id === nid && edge.source_handle === hid) {
        keys.push(edgeKey(edge));
      } else if (io === "in" && edge.target_node_id === nid && edge.target_handle === hid) {
        keys.push(edgeKey(edge));
      }
    });
    setSelectedEdgeKeysFromList(keys);
  }

  function currentDataControlsTabId() {
    var b = document.querySelector("[data-gc-dc-tab].is-active");
    return b ? trimStr(b.getAttribute("data-gc-dc-tab")) : "";
  }

  function setActiveTab(tabId) {
    tabButtons.forEach(function (btn) {
      var active = btn.getAttribute("data-gc-dc-tab") === tabId;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    tabPanels.forEach(function (panel) {
      var active = panel.getAttribute("data-gc-dc-panel") === tabId;
      panel.hidden = !active;
      panel.setAttribute("aria-hidden", active ? "false" : "true");
    });
    drawEdges();
  }

  function wireTabs() {
    tabButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = trimStr(btn.getAttribute("data-gc-dc-tab"));
        var from = currentDataControlsTabId();
        if (target !== from && isLayoutDirty()) {
          var ok = globalThis.confirm(
            "You have unsaved layout changes. Switch tabs anyway? Unsaved changes stay in the page until you leave or reload.",
          );
          if (!ok) return;
        }
        setActiveTab(target);
      });
    });
  }

  function controlHandleSpec(field) {
    var det = trimStr(field.data_entry_type).toLowerCase();
    if (det === "ip-address" || det === "ip-ipv4" || det === "ip-ipv6") {
      return {
        inputs: [
          "address",
          "subnet",
          "netmask",
          "ipfamily",
          "visible",
          "constraint",
          "pool",
          "autocorrect",
        ],
        outputs: ["ip_address", "subnet", "netmask"],
      };
    }
    if (det === "ip-list") {
      return { inputs: ["ip_list", "ipfamily", "visible"], outputs: ["ip_list"] };
    }
    if (det === "selector") {
      var props = parseJsonObject(field.data_entry_properties);
      var opts = [];
      (Array.isArray(field.allowed_options) ? field.allowed_options : []).forEach(function (x) {
        var t = trimStr(x);
        if (t) opts.push("option_" + slug(t));
      });
      if (Array.isArray(props.items)) {
        props.items.forEach(function (x) {
          var t = trimStr(x);
          if (t) opts.push("option_" + slug(t));
        });
      }
      var unique = [];
      var seen = {};
      opts.forEach(function (x) {
        if (!seen[x]) {
          seen[x] = true;
          unique.push(x);
        }
      });
      return {
        inputs: ["selected", "visible"],
        outputs: ["selected"].concat(unique),
      };
    }
    if (
      det === "dropdown-single" ||
      det === "dropdown-multi" ||
      det === "dropdown-shared" ||
      det === "member-lookup"
    ) {
      return { inputs: ["selected", "visible"], outputs: ["selected"] };
    }
    if (det === "toggle-onoff" || det === "toggle-checkbox") {
      return { inputs: ["value", "visible"], outputs: ["on", "off"] };
    }
    return { inputs: ["value", "visible"], outputs: ["value"] };
  }

  function propertyNameLowerDc(field) {
    return trimStr(field && field.property_name).toLowerCase();
  }

  function defaultControlInputForField(field) {
    var det = trimStr(field.data_entry_type).toLowerCase();
    if (det === "ip-address" || det === "ip-ipv4" || det === "ip-ipv6") {
      var pnIn = propertyNameLowerDc(field);
      if (pnIn === "subnet") return "subnet";
      if (pnIn === "netmask") return "netmask";
      return "address";
    }
    if (det === "ip-list") return "ip_list";
    if (det === "selector") return "selected";
    if (
      det === "dropdown-single" ||
      det === "dropdown-multi" ||
      det === "dropdown-shared" ||
      det === "member-lookup"
    ) {
      return "selected";
    }
    return "value";
  }

  function defaultControlOutputForField(field) {
    var det = trimStr(field.data_entry_type).toLowerCase();
    if (det === "ip-address" || det === "ip-ipv4" || det === "ip-ipv6") {
      var pnOut = propertyNameLowerDc(field);
      if (pnOut === "subnet") return "subnet";
      if (pnOut === "netmask") return "netmask";
      return "ip_address";
    }
    if (det === "ip-list") return "ip_list";
    if (det === "selector") return "selected";
    if (
      det === "dropdown-single" ||
      det === "dropdown-multi" ||
      det === "dropdown-shared" ||
      det === "member-lookup"
    ) {
      return "selected";
    }
    if (det === "toggle-onoff" || det === "toggle-checkbox") return "on";
    return "value";
  }

  function normalizeLogicOp(op) {
    var t = trimStr(op).toLowerCase();
    if (t === "not") return "not";
    return t === "or" ? "or" : "and";
  }

  function normalizeLogicKind(kind) {
    var t = trimStr(kind).toLowerCase();
    if (t === "if_value") return "if_value";
    if (t === "csv_array") return "csv_array";
    return "gate";
  }

  function gcDcSplitCsvToParts(line) {
    var s = String(line == null ? "" : line);
    if (!trimStr(s)) return [];
    var out = [];
    var cur = "";
    var inQ = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (!inQ && ch === ",") {
        out.push(trimStr(cur));
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(trimStr(cur));
    return out.filter(function (x) {
      return x.length > 0;
    });
  }

  function gcDcCsvInToArrayOutStr(csvIn) {
    var raw = trimStr(String(csvIn != null ? csvIn : ""));
    if (!raw) return "";
    if (raw.charAt(0) === "[") {
      try {
        var arr0 = JSON.parse(raw);
        if (Array.isArray(arr0)) return JSON.stringify(arr0);
      } catch (e0) {}
    }
    return JSON.stringify(gcDcSplitCsvToParts(raw));
  }

  function gcDcEscapeCsvCell(x) {
    var t = String(x != null ? x : "");
    if (/[",\n\r]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
    return t;
  }

  function gcDcArrayInToCsvOutStr(arrayIn) {
    var raw = trimStr(String(arrayIn != null ? arrayIn : ""));
    if (!raw) return "";
    var parts = [];
    if (raw.charAt(0) === "[") {
      try {
        var j = JSON.parse(raw);
        if (Array.isArray(j)) {
          parts = j.map(function (x) {
            return String(x != null ? x : "");
          });
        }
      } catch (e1) {}
    } else if (raw.indexOf("\x1e") >= 0) {
      parts = raw.split("\x1e").map(trimStr).filter(Boolean);
    } else {
      parts = [raw];
    }
    return parts.map(gcDcEscapeCsvCell).join(",");
  }

  function ensureLogicNodesArray() {
    if (!state.layout || typeof state.layout !== "object") {
      state.layout = {
        node_positions: {},
        connections: [],
        logic_nodes: [],
        control_add_only: {},
        member_lookup_data_source: {},
        member_lookup_multi: {},
        layout_locked: false,
      };
    }
    if (!Array.isArray(state.layout.logic_nodes)) state.layout.logic_nodes = [];
    return state.layout.logic_nodes;
  }

  function nextLogicNodeId(op, kind) {
    var list = ensureLogicNodesArray();
    var nodeKind = normalizeLogicKind(kind);
    if (nodeKind === "csv_array") {
      var maxCsv = 0;
      list.forEach(function (item) {
        if (!item || typeof item !== "object") return;
        var id = trimStr(item.id);
        var mc = /^logic:csv_(\d+)$/.exec(id);
        if (!mc) return;
        var nc = parseInt(mc[1], 10);
        if (!isNaN(nc) && nc > maxCsv) maxCsv = nc;
      });
      return "logic:csv_" + String(maxCsv + 1);
    }
    var prefix = nodeKind === "if_value" ? "if" : normalizeLogicOp(op);
    var maxN = 0;
    list.forEach(function (item) {
      if (!item || typeof item !== "object") return;
      var id = trimStr(item.id);
      var m = /^logic:(?:and|or|not|if)_(\d+)$/.exec(id);
      if (!m) return;
      var n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    });
    return "logic:" + prefix + "_" + String(maxN + 1);
  }

  function parseBoolLike(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;
    if (typeof v === "number") return v !== 0;
    var s = trimStr(String(v)).toLowerCase();
    if (!s) return false;
    if (
      s === "false" ||
      s === "0" ||
      s === "off" ||
      s === "no" ||
      s === "none" ||
      s === "null"
    ) {
      return false;
    }
    if (s === "true" || s === "1" || s === "on" || s === "yes") return true;
    return true;
  }

  function isLayoutMapLocked() {
    return !!(state.layout && state.layout.layout_locked);
  }

  function syncLayoutLockCheckbox() {
    if (!lockLayoutCb) return;
    lockLayoutCb.checked = isLayoutMapLocked();
    lockLayoutCb.disabled = !trimStr(state.entityType);
  }

  function updateLayoutRootLockedClass() {
    if (!layoutRoot) return;
    if (isLayoutMapLocked()) {
      layoutRoot.classList.add("gc-designer-data-controls-layout--map-locked");
    } else {
      layoutRoot.classList.remove("gc-designer-data-controls-layout--map-locked");
    }
    applyLayoutLockToInteractiveControls();
  }

  function applyLayoutLockToInteractiveControls() {
    if (!layoutRoot) return;
    var locked = isLayoutMapLocked();
    var controls = layoutRoot.querySelectorAll("input, select, textarea, button");
    controls.forEach(function (el) {
      if (!el) return;
      if (locked) {
        if (!el.hasAttribute("data-gc-lock-prev-disabled")) {
          el.setAttribute("data-gc-lock-prev-disabled", el.disabled ? "1" : "0");
        }
        el.disabled = true;
        return;
      }
      if (!el.hasAttribute("data-gc-lock-prev-disabled")) return;
      var prev = String(el.getAttribute("data-gc-lock-prev-disabled") || "0") === "1";
      el.disabled = prev;
      el.removeAttribute("data-gc-lock-prev-disabled");
    });
  }

  function patchDesignerLayoutLocked(wantLocked) {
    var et = trimStr(state.entityType);
    if (!et) return Promise.resolve(false);
    var url =
      "/api/designer/data-controls-layout/" + encodeURIComponent(et) + "/layout-locked";
    return fetch(url, {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "Ground-Control",
      },
      body: JSON.stringify({ layout_locked: !!wantLocked }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok && j && j.ok, j: j || {} };
        });
      })
      .then(function (res) {
        if (!res.ok) return false;
        var lo = res.j.layout && typeof res.j.layout === "object" ? res.j.layout : {};
        if (Object.prototype.hasOwnProperty.call(lo, "layout_locked")) {
          state.layout.layout_locked = !!lo.layout_locked;
        } else {
          state.layout.layout_locked = !!wantLocked;
        }
        state.lastSavedSignature = et + "|" + JSON.stringify(state.layout);
        if (typeof globalThis.gcInvalidateDataControlsLayoutLocksCache === "function") {
          globalThis.gcInvalidateDataControlsLayoutLocksCache();
        }
        refreshLayoutDirtyState();
        syncLayoutLockCheckbox();
        updatePersistButtonsEnabled();
        updateLayoutRootLockedClass();
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function ensureControlAddOnlyMap() {
    if (!state.layout || typeof state.layout !== "object") {
      state.layout = {
        node_positions: {},
        connections: [],
        logic_nodes: [],
        control_add_only: {},
        member_lookup_data_source: {},
        member_lookup_multi: {},
        layout_locked: false,
      };
    }
    if (
      !state.layout.control_add_only ||
      typeof state.layout.control_add_only !== "object" ||
      Array.isArray(state.layout.control_add_only)
    ) {
      state.layout.control_add_only = {};
    }
    return state.layout.control_add_only;
  }

  function ensureMemberLookupDataSourceMap() {
    if (!state.layout || typeof state.layout !== "object") {
      state.layout = {
        node_positions: {},
        connections: [],
        logic_nodes: [],
        control_add_only: {},
        member_lookup_data_source: {},
        member_lookup_multi: {},
        layout_locked: false,
      };
    }
    if (
      !state.layout.member_lookup_data_source ||
      typeof state.layout.member_lookup_data_source !== "object" ||
      Array.isArray(state.layout.member_lookup_data_source)
    ) {
      state.layout.member_lookup_data_source = {};
    }
    return state.layout.member_lookup_data_source;
  }

  function ensureMemberLookupMultiMap() {
    if (!state.layout || typeof state.layout !== "object") {
      state.layout = {
        node_positions: {},
        connections: [],
        logic_nodes: [],
        control_add_only: {},
        member_lookup_data_source: {},
        member_lookup_multi: {},
        layout_locked: false,
      };
    }
    if (
      !state.layout.member_lookup_multi ||
      typeof state.layout.member_lookup_multi !== "object" ||
      Array.isArray(state.layout.member_lookup_multi)
    ) {
      state.layout.member_lookup_multi = {};
    }
    return state.layout.member_lookup_multi;
  }

  function isControlAddOnly(nodeId) {
    var map = ensureControlAddOnlyMap();
    return !!map[String(nodeId || "")];
  }

  function isSkippableDataEntryType(detRaw) {
    var det = trimStr(detRaw).toLowerCase();
    return !det || det === "hidden" || det === "none";
  }

  function memberLookupMultiFromDataEntryProperties(raw) {
    var props = parseJsonObject(raw);
    var source = props && typeof props.source === "object" ? props.source : null;
    if (source && source.multi != null) return parseBoolLike(source.multi);
    return parseBoolLike(props && props.multi);
  }

  function buildNodeCatalog() {
    var out = {};
    var fieldY = 24;
    var memberLookupMultiMap = ensureMemberLookupMultiMap();
    state.fields.forEach(function (f) {
      var y = fieldY;
      var fieldId = "field:" + String(f.id || "");
      var propName = trimStr(f.property_name);
      var showAs = trimStr(f.show_as);
      var fieldLabel = showAs || propName || "Field";
      out[fieldId] = {
        id: fieldId,
        field_id: String(f.id || ""),
        data_entry_type: trimStr(f.data_entry_type),
        json_value_kind: trimStr(f.json_value_kind),
        show_as: showAs,
        property_name: propName,
        label: fieldLabel,
        kind: "field",
        inputs: ["save_value"],
        outputs: ["loaded_value"],
        x: 28,
        y: y,
      };
      fieldY += 94;

      var det = trimStr(f.data_entry_type);
      if (isSkippableDataEntryType(f.data_entry_type)) return;
      var hs = controlHandleSpec(f);
      var ctrlId = "ctrl:" + String(f.id || "");
      var allowedOpts = Array.isArray(f.allowed_options) ? f.allowed_options : [];
      var memberLookupMulti = trimStr(det).toLowerCase() === "member-lookup"
        ? Object.prototype.hasOwnProperty.call(memberLookupMultiMap, ctrlId)
          ? parseBoolLike(memberLookupMultiMap[ctrlId])
          : memberLookupMultiFromDataEntryProperties(f.data_entry_properties)
        : false;
      out[ctrlId] = {
        id: ctrlId,
        field_id: String(f.id || ""),
        data_entry_type: det,
        show_as: showAs,
        property_name: propName,
        allowed_options: allowedOpts,
        member_lookup_multi: memberLookupMulti,
        label: fieldLabel + " (" + det + ")",
        kind: "control",
        inputs: hs.inputs,
        outputs: hs.outputs,
        x: 10,
        y: y,
      };
    });
    ensureLogicNodesArray().forEach(function (item, idx) {
      if (!item || typeof item !== "object") return;
      var id = trimStr(item.id);
      if (!id || id.indexOf("logic:") !== 0) return;
      var nodeKind = normalizeLogicKind(item.kind);
      var op = normalizeLogicOp(item.op);
      if (nodeKind === "csv_array") {
        out[id] = {
          id: id,
          field_id: "",
          data_entry_type: "",
          logic_kind: "csv_array",
          logic_op: op,
          label: "CSV ↔ Array",
          kind: "logic",
          inputs: ["csv_in", "array_in"],
          outputs: ["csv_out", "array_out"],
          true_value: "",
          false_value: "",
          x: 28,
          y: 24 + (state.fields.length + idx) * 94,
        };
        return;
      }
      out[id] = {
        id: id,
        field_id: "",
        data_entry_type: "",
        logic_kind: nodeKind,
        logic_op: op,
        label:
          nodeKind === "if_value"
            ? "Value block"
            : op === "or"
              ? "OR block"
              : op === "not"
                ? "NOT block"
                : "AND block",
        kind: "logic",
        inputs:
          nodeKind === "if_value"
            ? ["input"]
            : op === "not"
              ? ["input"]
              : ["input_a", "input_b"],
        outputs: nodeKind === "if_value" ? ["value"] : ["gate"],
        true_value: trimStr(item.true_value),
        false_value: trimStr(item.false_value),
        x: 28,
        y: 24 + (state.fields.length + idx) * 94,
      };
    });
    Object.keys(out).forEach(function (id) {
      var p = state.layout.node_positions[id];
      if (!p || typeof p !== "object") return;
      out[id].x = Number(p.x) || 0;
      out[id].y = Number(p.y) || 0;
    });
    state.nodeCatalog = out;
  }

  function dataEntryTypeSelectHtml(node) {
    var current = trimStr(node.data_entry_type);
    var optionsHtml = '<option value="">(None)</option>';
    var hasCurrent = !current;
    dataEntryTypeOptions.forEach(function (cid) {
      var selected = cid === current ? ' selected="selected"' : "";
      if (selected) hasCurrent = true;
      optionsHtml +=
        '<option value="' + esc(cid) + '"' + selected + ">" + esc(cid) + "</option>";
    });
    if (!hasCurrent && current) {
      optionsHtml +=
        '<option value="' +
        esc(current) +
        '" selected="selected">' +
        esc(current) +
        " (not in Controls)</option>";
    }
    return (
      '<label class="gc-designer-data-controls-layout__det-field">' +
      '<span class="gc-designer-data-controls-layout__det-label">Data entry type</span>' +
      '<select class="settings-form__input mono gc-designer-data-controls-layout__det-select" data-field-id="' +
      esc(node.field_id || "") +
      '">' +
      optionsHtml +
      "</select>" +
      "</label>"
    );
  }

  function displayHandleLabel(node, handleId, io) {
    if (node && node.kind === "control" && handleId === "value") {
      return io === "in" ? "loaded_value" : "save_value";
    }
    if (node && node.kind === "logic" && handleId === "gate" && io === "out") {
      return "output";
    }
    if (node && node.kind === "logic" && node.logic_kind === "csv_array") {
      if (handleId === "csv_in") return "CSV in";
      if (handleId === "csv_out") return "CSV out";
      if (handleId === "array_in") return "Array in";
      if (handleId === "array_out") return "Array out";
    }
    if (handleId === "ipfamily") return "IPFamily";
    if (handleId === "constraint") return "Constraint";
    if (handleId === "pool") return "Pool";
    if (handleId === "autocorrect") return "Autocorrect";
    return handleId;
  }

  function buildDefaultConnections() {
    var edges = [];
    state.fields.forEach(function (f) {
      var fieldId = "field:" + String(f.id || "");
      var ctrlId = "ctrl:" + String(f.id || "");
      var fieldNode = state.nodeCatalog[fieldId];
      var ctrlNode = state.nodeCatalog[ctrlId];
      if (!fieldNode || !ctrlNode) return;
      if (fieldNode.outputs.indexOf("loaded_value") === -1) return;
      var ctrlIn = defaultControlInputForField(f);
      if (ctrlNode.inputs.indexOf(ctrlIn) !== -1) {
        edges.push({
          edge_id: genEdgeId(),
          source_node_id: fieldId,
          source_handle: "loaded_value",
          target_node_id: ctrlId,
          target_handle: ctrlIn,
        });
      }
      var ctrlOut = defaultControlOutputForField(f);
      if (
        ctrlNode.outputs.indexOf(ctrlOut) !== -1 &&
        fieldNode.inputs.indexOf("save_value") !== -1
      ) {
        edges.push({
          edge_id: genEdgeId(),
          source_node_id: ctrlId,
          source_handle: ctrlOut,
          target_node_id: fieldId,
          target_handle: "save_value",
        });
      }
    });
    return edges;
  }

  function buildDefaultConnectionsForField(fieldId) {
    var fid = String(fieldId || "");
    if (!fid) return [];
    var field = null;
    state.fields.forEach(function (f) {
      if (String(f.id || "") === fid) field = f;
    });
    if (!field) return [];
    var fieldNodeId = "field:" + fid;
    var ctrlNodeId = "ctrl:" + fid;
    var fieldNode = state.nodeCatalog[fieldNodeId];
    var ctrlNode = state.nodeCatalog[ctrlNodeId];
    if (!fieldNode || !ctrlNode) return [];
    var edges = [];
    var ctrlIn = defaultControlInputForField(field);
    if (
      fieldNode.outputs.indexOf("loaded_value") !== -1 &&
      ctrlNode.inputs.indexOf(ctrlIn) !== -1
    ) {
      edges.push({
        edge_id: genEdgeId(),
        source_node_id: fieldNodeId,
        source_handle: "loaded_value",
        target_node_id: ctrlNodeId,
        target_handle: ctrlIn,
      });
    }
    var ctrlOut = defaultControlOutputForField(field);
    if (
      fieldNode.inputs.indexOf("save_value") !== -1 &&
      ctrlNode.outputs.indexOf(ctrlOut) !== -1
    ) {
      edges.push({
        edge_id: genEdgeId(),
        source_node_id: ctrlNodeId,
        source_handle: ctrlOut,
        target_node_id: fieldNodeId,
        target_handle: "save_value",
      });
    }
    return edges;
  }

  function replacePairWiresWithDefaults(fieldId) {
    if (isLayoutMapLocked()) return false;
    var fid = String(fieldId || "");
    if (!fid) return false;
    var fieldNodeId = "field:" + fid;
    var ctrlNodeId = "ctrl:" + fid;
    var before = state.layout.connections.length;
    state.layout.connections = state.layout.connections.filter(function (edge) {
      var betweenPair =
        (edge.source_node_id === fieldNodeId && edge.target_node_id === ctrlNodeId) ||
        (edge.source_node_id === ctrlNodeId && edge.target_node_id === fieldNodeId);
      return !betweenPair;
    });
    var defaults = buildDefaultConnectionsForField(fid);
    defaults.forEach(function (edge) {
      state.layout.connections.push(edge);
    });
    return state.layout.connections.length !== before || defaults.length > 0;
  }

  function applyDefaultConnectionsIfEmpty() {
    if (state.layout.connections.length) return false;
    var defaults = buildDefaultConnections();
    if (!defaults.length) return false;
    state.layout.connections = defaults;
    return true;
  }

  function resetLayoutToDefaults() {
    if (isLayoutMapLocked()) {
      setStatus("Layout map is locked. Turn off Layout locked to reset.");
      return;
    }
    state.layout = {
      node_positions: {},
      connections: [],
      logic_nodes: [],
      control_add_only: {},
      member_lookup_data_source: {},
      member_lookup_multi: {},
      layout_locked: false,
    };
    buildNodeCatalog();
    state.layout.connections = buildDefaultConnections();
    clearSelectedEdges();
    renderAll(true);
    saveLayoutSoon();
    setStatus("Layout reset to defaults.");
  }

  var HANDLES_PER_PANEL_COLUMN = 10;

  function nodeHtml(node, opts) {
    opts = opts || {};
    function handleButtonHtml(h, io) {
      var shown = displayHandleLabel(node, h, io);
      return (
        '<button type="button" class="gc-designer-data-controls-layout__handle" data-node-id="' +
        esc(node.id) +
        '" data-handle-id="' +
        esc(h) +
        '" data-io="' +
        io +
        '" title="' +
        esc(shown) +
        '">' +
        '<span class="gc-designer-data-controls-layout__dot" aria-hidden="true"></span>' +
        '<span class="gc-designer-data-controls-layout__handle-label mono">' +
        esc(shown) +
        "</span>" +
        "</button>"
      );
    }
    function handlesHtml(list, io, panelColumns) {
      var arr = list || [];
      var buttons = arr.map(function (h) {
        return handleButtonHtml(h, io);
      });
      if (!panelColumns || !buttons.length) {
        return buttons.join("");
      }
      var cols = [];
      for (var c = 0; c * HANDLES_PER_PANEL_COLUMN < buttons.length; c++) {
        var slice = buttons.slice(c * HANDLES_PER_PANEL_COLUMN, (c + 1) * HANDLES_PER_PANEL_COLUMN);
        cols.push(
          '<div class="gc-designer-data-controls-layout__io-column">' + slice.join("") + "</div>",
        );
      }
      return (
        '<div class="gc-designer-data-controls-layout__io-columns">' + cols.join("") + "</div>"
      );
    }
    if (node.kind === "field") {
      var propLabel = trimStr(node.property_name) || trimStr(node.label) || "Field";
      var jsonKind = trimStr(node.json_value_kind);
      var jsonKindTagHtml = jsonKind
        ? '<span class="gc-zone-pill gc-designer-data-controls-layout__json-kind-tag">' +
          esc(jsonKind) +
          "</span>"
        : "";
      var dragHandleHtml =
        opts && opts.fieldPanel
          ? '<button type="button" class="gc-designer-data-controls-layout__field-drag-handle" aria-label="Drag to reorder field" title="Drag to reorder">' +
            '<span class="gc-designer-data-controls-layout__field-drag-grip" aria-hidden="true"></span>' +
            "</button>"
          : "";
      return (
        '<div class="gc-designer-data-controls-layout__node gc-designer-data-controls-layout__node--field" data-node-id="' +
        esc(node.id) +
        '">' +
        '<div class="gc-designer-data-controls-layout__node-field-row">' +
        dragHandleHtml +
        '<div class="gc-designer-data-controls-layout__node-field-meta">' +
        '<div class="gc-designer-data-controls-layout__node-head-main">' +
        '<div class="gc-designer-data-controls-layout__field-name-row">' +
        '<span class="mono gc-designer-data-controls-layout__field-prop-name">' +
        esc(propLabel) +
        "</span>" +
        jsonKindTagHtml +
        "</div>" +
        dataEntryTypeSelectHtml(node) +
        "</div>" +
        "</div>" +
        '<div class="gc-designer-data-controls-layout__node-field-wires">' +
        '<div class="gc-designer-data-controls-layout__io gc-designer-data-controls-layout__io--field-right">' +
        handlesHtml(["loaded_value"], "out") +
        handlesHtml(["save_value"], "in") +
        "</div>" +
        "</div>" +
        "</div>" +
        "</div>"
      );
    }
    if (node.kind === "logic") {
      var logicClass =
        "gc-designer-data-controls-layout__node gc-designer-data-controls-layout__node--field gc-designer-data-controls-layout__node--logic gc-designer-data-controls-layout__node--addable";
      if (opts && opts.logicPanel) {
        logicClass += " gc-designer-data-controls-layout__node--in-panel";
      }
      if (node.logic_kind === "csv_array") {
        return (
          '<div class="' +
          logicClass +
          ' gc-designer-data-controls-layout__node--csv-array" data-node-id="' +
          esc(node.id) +
          '">' +
          '<div class="gc-designer-data-controls-layout__node-head">' +
          '<div class="gc-designer-data-controls-layout__node-head-main">' +
          '<span class="mono">' +
          esc(node.label) +
          "</span>" +
          "</div>" +
          '<button type="button" class="gc-designer-data-controls-layout__node-delete" data-node-id="' +
          esc(node.id) +
          '" title="Delete block" aria-label="Delete block">×</button>' +
          "</div>" +
          '<div class="gc-designer-data-controls-layout__node-body gc-designer-data-controls-layout__node-body--csv-array">' +
          '<div class="gc-designer-data-controls-layout__csv-array-col gc-designer-data-controls-layout__csv-array-col--left">' +
          handlesHtml(["csv_in"], "in") +
          handlesHtml(["csv_out"], "out") +
          "</div>" +
          '<div class="gc-designer-data-controls-layout__csv-array-col gc-designer-data-controls-layout__csv-array-col--right">' +
          handlesHtml(["array_out"], "out") +
          handlesHtml(["array_in"], "in") +
          "</div>" +
          "</div>" +
          "</div>"
        );
      }
      var valueFieldsHtml = "";
      if (node.logic_kind === "if_value") {
        valueFieldsHtml =
          '<div class="gc-designer-data-controls-layout__det-field">' +
          '<span class="gc-designer-data-controls-layout__det-label">True value</span>' +
          '<input type="text" class="settings-form__input mono gc-designer-data-controls-layout__logic-value" data-logic-id="' +
          esc(node.id) +
          '" data-value-side="true" value="' +
          esc(node.true_value || "") +
          '" />' +
          "</div>" +
          '<div class="gc-designer-data-controls-layout__det-field">' +
          '<span class="gc-designer-data-controls-layout__det-label">False value</span>' +
          '<input type="text" class="settings-form__input mono gc-designer-data-controls-layout__logic-value" data-logic-id="' +
          esc(node.id) +
          '" data-value-side="false" value="' +
          esc(node.false_value || "") +
          '" />' +
          "</div>";
      }
      return (
        '<div class="' +
        logicClass +
        '" data-node-id="' +
        esc(node.id) +
        '">' +
        '<div class="gc-designer-data-controls-layout__node-head">' +
        '<div class="gc-designer-data-controls-layout__node-head-main">' +
        '<span class="mono">' +
        esc(node.label) +
        "</span>" +
        "</div>" +
        '<button type="button" class="gc-designer-data-controls-layout__node-delete" data-node-id="' +
        esc(node.id) +
        '" title="Delete block" aria-label="Delete block">×</button>' +
        "</div>" +
        '<div class="gc-designer-data-controls-layout__node-body">' +
        valueFieldsHtml +
        '<div class="gc-designer-data-controls-layout__io gc-designer-data-controls-layout__io--in">' +
        handlesHtml(node.inputs, "in") +
        "</div>" +
        '<div class="gc-designer-data-controls-layout__io gc-designer-data-controls-layout__io--out">' +
        handlesHtml(node.outputs, "out") +
        "</div>" +
        "</div>" +
        "</div>"
      );
    }
    var addOnlyChecked = isControlAddOnly(node.id) ? ' checked="checked"' : "";
    var addOnlyToggleHtml =
      '<label class="gc-toolbar-combine gc-designer-data-controls-layout__add-only-toggle" title="Show this field only while adding an object">' +
      '<span class="gc-toolbar-combine__text">Add only</span>' +
      '<input type="checkbox" class="gc-toolbar-combine__input gc-designer-data-controls-layout__add-only-input" data-node-id="' +
      esc(node.id) +
      '"' +
      addOnlyChecked +
      " />" +
      '<span class="gc-toolbar-combine__track" aria-hidden="true"><span class="gc-toolbar-combine__thumb"></span></span>' +
      "</label>";
    if (node.kind === "control" && opts.controlPanel) {
      var showAsVal = esc(trimStr(node.show_as));
      var propPh = esc(trimStr(node.property_name) || "Property");
      var detHint = trimStr(node.data_entry_type);
      var detLower = detHint.toLowerCase();
      var aoArr = Array.isArray(node.allowed_options) ? node.allowed_options : [];
      var aoEditorText =
        aoArr.length > 0
          ? (function () {
              try {
                return JSON.stringify(aoArr);
              } catch (e0) {
                return "";
              }
            })()
          : "";
      var selectorAllowedHtml = "";
      if (detLower === "selector") {
        selectorAllowedHtml =
          '<label class="gc-designer-data-controls-layout__panel-allowed-field">' +
          '<span class="gc-designer-data-controls-layout__det-label">Allowed values</span>' +
          '<textarea class="settings-form__input mono gc-designer-data-controls-layout__panel-allowed-options-input" rows="2" data-field-id="' +
          esc(node.field_id || "") +
          '" placeholder="' +
          esc('["On","Off"]') +
          '" aria-label="Allowed selector options (JSON array)">' +
          escHtmlText(aoEditorText) +
          "</textarea>" +
          "</label>";
      }
      var mlSourceHtml = "";
      var mlMultiHtml = "";
      if (detLower === "member-lookup") {
        mlSourceHtml =
          '<label class="gc-designer-data-controls-layout__panel-ml-source-field">' +
          '<span class="gc-designer-data-controls-layout__det-label">Data source</span>' +
          '<select class="settings-form__input mono gc-designer-entity-nav-object-sel__select gc-designer-data-controls-layout__panel-ml-source-select" data-gc-designer-object-selector="object-selector" data-node-id="' +
          esc(node.id) +
          '" aria-label="Member lookup cached object type">' +
          '<option value="">Loading…</option>' +
          "</select>" +
          "</label>";
        mlMultiHtml =
          '<label class="gc-toolbar-combine gc-designer-data-controls-layout__panel-ml-multi-toggle" title="When on, this member lookup accepts multiple selected values in Object edit flyouts.">' +
          '<span class="gc-toolbar-combine__text">Multi-select</span>' +
          '<input type="checkbox" class="gc-toolbar-combine__input gc-designer-data-controls-layout__panel-ml-multi-input" data-field-id="' +
          esc(node.field_id || "") +
          '" data-node-id="' +
          esc(node.id || "") +
          '"' +
          (node.member_lookup_multi ? ' checked="checked"' : "") +
          " />" +
          '<span class="gc-toolbar-combine__track" aria-hidden="true"><span class="gc-toolbar-combine__thumb"></span></span>' +
          "</label>";
      }
      return (
        '<div class="gc-designer-data-controls-layout__node gc-designer-data-controls-layout__node--control gc-designer-data-controls-layout__node--in-panel" data-node-id="' +
        esc(node.id) +
        '">' +
        '<div class="gc-designer-data-controls-layout__panel-card-top">' +
        '<button type="button" class="gc-designer-data-controls-layout__panel-drag-handle" aria-label="Drag to reorder control" title="Drag to reorder">' +
        '<span class="gc-designer-data-controls-layout__panel-drag-grip" aria-hidden="true"></span>' +
        "</button>" +
        '<div class="gc-designer-data-controls-layout__panel-io-stack">' +
        '<div class="gc-designer-data-controls-layout__io gc-designer-data-controls-layout__io--in gc-designer-data-controls-layout__io--panel-col">' +
        handlesHtml(node.inputs, "in", true) +
        "</div>" +
        '<div class="gc-designer-data-controls-layout__io gc-designer-data-controls-layout__io--out gc-designer-data-controls-layout__io--panel-col">' +
        handlesHtml(node.outputs, "out", true) +
        "</div>" +
        "</div>" +
        '<div class="gc-designer-data-controls-layout__panel-card-meta">' +
        '<label class="gc-designer-data-controls-layout__panel-show-as-field">' +
        '<span class="gc-designer-data-controls-layout__det-label">Show as</span>' +
        '<input type="text" class="settings-form__input mono gc-designer-data-controls-layout__panel-show-as-input" data-field-id="' +
        esc(node.field_id || "") +
        '" value="' +
        showAsVal +
        '" placeholder="' +
        propPh +
        '" autocomplete="off" />' +
        "</label>" +
        (detHint
          ? '<span class="muted mono gc-designer-data-controls-layout__panel-card-type-hint">' +
            esc(detHint) +
            "</span>"
          : "") +
        selectorAllowedHtml +
        mlSourceHtml +
        mlMultiHtml +
        addOnlyToggleHtml +
        "</div>" +
        "</div>" +
        "</div>"
      );
    }
    return (
      '<div class="gc-designer-data-controls-layout__node ' +
      (node.kind === "control"
        ? "gc-designer-data-controls-layout__node--control"
        : "gc-designer-data-controls-layout__node--field") +
      '" data-node-id="' +
      esc(node.id) +
      '">' +
      '<div class="gc-designer-data-controls-layout__node-head">' +
      '<div class="gc-designer-data-controls-layout__node-head-main">' +
      '<span class="mono">' +
      esc(node.label) +
      "</span>" +
      (node.kind === "control" ? addOnlyToggleHtml : "") +
      "</div>" +
      "</div>" +
      '<div class="gc-designer-data-controls-layout__node-body">' +
      '<div class="gc-designer-data-controls-layout__io gc-designer-data-controls-layout__io--in">' +
      handlesHtml(node.inputs, "in") +
      "</div>" +
      '<div class="gc-designer-data-controls-layout__io gc-designer-data-controls-layout__io--out">' +
      handlesHtml(node.outputs, "out") +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function handleCenter(nodeId, handleId, io) {
    var sel =
      '.gc-designer-data-controls-layout__handle[data-node-id="' +
      cssEscape(nodeId) +
      '"][data-handle-id="' +
      cssEscape(handleId) +
      '"][data-io="' +
      cssEscape(io) +
      '"]';
    var el = layoutRoot.querySelector(sel);
    if (!el) return null;
    var dot = el.querySelector(".gc-designer-data-controls-layout__dot");
    var rootRect = layoutRoot.getBoundingClientRect();
    var r = (dot || el).getBoundingClientRect();
    return {
      x: r.left - rootRect.left + r.width / 2,
      y: r.top - rootRect.top + r.height / 2,
    };
  }

  function cssEscape(v) {
    return String(v || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function edgeArrowDefs() {
    return (
      '<defs>' +
      '<marker id="gc-dc-edge-arrow-left" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">' +
      '<path d="M0,0 L8,3 L0,6 Z" fill="#2f4fab"></path>' +
      "</marker>" +
      '<marker id="gc-dc-edge-arrow-right" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">' +
      '<path d="M0,0 L8,3 L0,6 Z" fill="#8a4fd1"></path>' +
      "</marker>" +
      '<marker id="gc-dc-edge-arrow-selected" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">' +
      '<path d="M0,0 L8,3 L0,6 Z" fill="#ea580c"></path>' +
      "</marker>" +
      "</defs>"
    );
  }

  function sourceSideForNode(sourceNodeId) {
    var src = state.nodeCatalog[sourceNodeId];
    return src && src.kind === "control" ? "right" : "left";
  }

  function drawPath(d, className, key, markerId) {
    return (
      '<path d="' +
      esc(d) +
      '" class="' +
      className +
      '" marker-end="url(#' +
      esc(markerId || "gc-dc-edge-arrow-left") +
      ')" data-edge-key="' +
      esc(key || "") +
      '"></path>'
    );
  }

  function drawEdgeHandle(x, y, key, side, selected) {
    var cls =
      "gc-designer-data-controls-layout__edge-handle gc-designer-data-controls-layout__edge-handle--from-" +
      (side || "left") +
      (selected ? " is-selected" : "");
    return (
      '<circle cx="' +
      String(x) +
      '" cy="' +
      String(y) +
      '" r="6" class="' +
      cls +
      '" data-edge-key="' +
      esc(key || "") +
      '"></circle>'
    );
  }

  /** Heuristic edge routing (not a full graph layout / orthogonal router). */
  function layoutNodeObstaclesAll() {
    if (!layoutRoot) return [];
    var rootRect = layoutRoot.getBoundingClientRect();
    var pad = 8;
    var list = [];
    var nodes = layoutRoot.querySelectorAll(
      ".gc-designer-data-controls-layout__node[data-node-id]",
    );
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var nid = el.getAttribute("data-node-id");
      if (!nid) continue;
      var br = el.getBoundingClientRect();
      list.push({
        nodeId: String(nid),
        left: br.left - rootRect.left - pad,
        right: br.right - rootRect.left + pad,
        top: br.top - rootRect.top - pad,
        bottom: br.bottom - rootRect.top + pad,
      });
    }
    return list;
  }

  function layoutObstaclesMinusNodes(allRects, excludeId1, excludeId2) {
    var ex = {};
    if (excludeId1) ex[String(excludeId1)] = true;
    if (excludeId2) ex[String(excludeId2)] = true;
    var out = [];
    for (var i = 0; i < allRects.length; i++) {
      var o = allRects[i];
      if (ex[o.nodeId]) continue;
      out.push({
        left: o.left,
        right: o.right,
        top: o.top,
        bottom: o.bottom,
      });
    }
    return out;
  }

  function edgeHorizontalArmPx(a, b) {
    var span = Math.abs(b.x - a.x);
    return Math.min(170, Math.max(44, Math.round(span * 0.35)));
  }

  /**
   * Cubic from handle a to handle b. ``laneY`` offsets only control-point Y so parallel /
   * obstacle lanes bulge in the middle without detaching M/C endpoints from the real dots.
   */
  function edgeBezierGeometryRaw(a, b, laneY) {
    var lane = Number(laneY) || 0;
    var ay = a.y;
    var by = b.y;
    var arm = edgeHorizontalArmPx(a, b);
    var c1x;
    var c2x;
    if (b.x >= a.x) {
      c1x = a.x + arm;
      c2x = b.x - arm;
    } else {
      c1x = a.x - arm;
      c2x = b.x + arm;
    }
    return {
      ax: a.x,
      ay: ay,
      bx: b.x,
      by: by,
      c1x: c1x,
      c1y: ay + lane,
      c2x: c2x,
      c2y: by + lane,
    };
  }

  function cubicBezierPoint(g, t) {
    var omt = 1 - t;
    var ax = g.ax;
    var ay = g.ay;
    var bx = g.bx;
    var by = g.by;
    var c1x = g.c1x;
    var c1y = g.c1y;
    var c2x = g.c2x;
    var c2y = g.c2y;
    return {
      x:
        omt * omt * omt * ax +
        3 * omt * omt * t * c1x +
        3 * omt * t * t * c2x +
        t * t * t * bx,
      y:
        omt * omt * omt * ay +
        3 * omt * omt * t * c1y +
        3 * omt * t * t * c2y +
        t * t * t * by,
    };
  }

  function countBezierObstacleHits(g, obstacles) {
    if (!obstacles || !obstacles.length) return 0;
    var ts = [0.12, 0.28, 0.5, 0.72, 0.88];
    var hits = 0;
    for (var i = 0; i < ts.length; i++) {
      var p = cubicBezierPoint(g, ts[i]);
      for (var j = 0; j < obstacles.length; j++) {
        var r = obstacles[j];
        if (
          p.x >= r.left &&
          p.x <= r.right &&
          p.y >= r.top &&
          p.y <= r.bottom
        ) {
          hits++;
          break;
        }
      }
    }
    return hits;
  }

  function pickLaneYOffset(a, b, baseBump, obstacles) {
    var base = Number(baseBump) || 0;
    if (!obstacles || !obstacles.length) return base;
    var candidates = [0, 20, -20, 40, -40, 60, -60, 80, -80];
    var bestExtra = 0;
    var bestHits = 1e9;
    for (var i = 0; i < candidates.length; i++) {
      var extra = candidates[i];
      var g = edgeBezierGeometryRaw(a, b, base + extra);
      var h = countBezierObstacleHits(g, obstacles);
      if (h < bestHits || (h === bestHits && Math.abs(extra) < Math.abs(bestExtra))) {
        bestHits = h;
        bestExtra = extra;
        if (bestHits === 0) break;
      }
    }
    return base + bestExtra;
  }

  function edgePathFromGeometry(g) {
    return (
      "M " +
      g.ax.toFixed(1) +
      " " +
      g.ay.toFixed(1) +
      " C " +
      g.c1x.toFixed(1) +
      " " +
      g.c1y.toFixed(1) +
      ", " +
      g.c2x.toFixed(1) +
      " " +
      g.c2y.toFixed(1) +
      ", " +
      g.bx.toFixed(1) +
      " " +
      g.by.toFixed(1)
    );
  }

  function computeFlowStateForTest(rowOverride) {
    var row = rowOverride || selectedTestObjectRow();
    if (!row) return {};
    var values = {};
    var controlInputs = {};
    var visibilityByCtrl = {};
    var fieldById = {};
    state.fields.forEach(function (f) {
      fieldById[String(f.id || "")] = f;
    });
    Object.keys(state.nodeCatalog).forEach(function (nodeId) {
      var node = state.nodeCatalog[nodeId];
      if (!node || node.kind !== "field") return;
      var fid = String(node.field_id || "");
      var fld = fieldById[fid];
      if (!fld) return;
      var prop = trimStr(fld.property_name);
      var loaded = valueForPropertyFromRow(row, prop);
      values[nodeId + "|loaded_value"] = loaded;
    });

    function firstControlInput(ctrlId, name) {
      var key = ctrlId + "|" + name;
      return Object.prototype.hasOwnProperty.call(controlInputs, key)
        ? controlInputs[key]
        : "";
    }

    function visibleFromInput(ctrlId) {
      var raw = firstControlInput(ctrlId, "visible");
      if (raw === "" || raw == null) return true;
      if (typeof raw === "boolean") return raw;
      var s = trimStr(String(raw)).toLowerCase();
      if (!s) return true;
      if (
        s === "false" ||
        s === "0" ||
        s === "off" ||
        s === "no" ||
        s === "none" ||
        s === "null"
      ) {
        return false;
      }
      if (s === "true" || s === "1" || s === "on" || s === "yes") return true;
      return !!s;
    }

    for (var iter = 0; iter < 10; iter++) {
      state.layout.connections.forEach(function (edge) {
        var srcKey = edge.source_node_id + "|" + edge.source_handle;
        var v = Object.prototype.hasOwnProperty.call(values, srcKey) ? values[srcKey] : "";
        var tgtNode = state.nodeCatalog[edge.target_node_id];
        if (!tgtNode || (tgtNode.kind !== "control" && tgtNode.kind !== "logic")) return;
        controlInputs[edge.target_node_id + "|" + edge.target_handle] = v;
      });

      Object.keys(state.nodeCatalog).forEach(function (nodeId) {
        var node = state.nodeCatalog[nodeId];
        if (!node || (node.kind !== "control" && node.kind !== "logic")) return;
        if (node.kind === "logic") {
          if (node.logic_kind === "csv_array") {
            var csvInFlow = firstControlInput(nodeId, "csv_in");
            var arrInFlow = firstControlInput(nodeId, "array_in");
            values[nodeId + "|array_out"] = gcDcCsvInToArrayOutStr(csvInFlow);
            values[nodeId + "|csv_out"] = gcDcArrayInToCsvOutStr(arrInFlow);
            return;
          }
          if (node.logic_kind === "if_value") {
            var cond = parseBoolLike(firstControlInput(nodeId, "input"));
            values[nodeId + "|value"] = cond ? node.true_value || "" : node.false_value || "";
            return;
          }
          if (node.logic_op === "not") {
            values[nodeId + "|gate"] = !parseBoolLike(firstControlInput(nodeId, "input"));
            return;
          }
          var inA = parseBoolLike(firstControlInput(nodeId, "input_a"));
          var inB = parseBoolLike(firstControlInput(nodeId, "input_b"));
          var op = normalizeLogicOp(node.logic_op);
          values[nodeId + "|gate"] = op === "or" ? inA || inB : inA && inB;
          return;
        }
        var det = trimStr(node.data_entry_type).toLowerCase();
        var inValue = firstControlInput(nodeId, "value");
        var inSelected = firstControlInput(nodeId, "selected");
        var inAddress = firstControlInput(nodeId, "address");
        var inSubnet = firstControlInput(nodeId, "subnet");
        var isVisible = visibleFromInput(nodeId);
        visibilityByCtrl[nodeId] = isVisible;
        var base = inValue || inSelected || inAddress || "";
        if (det === "ip-address" || det === "ip-ipv4" || det === "ip-ipv6") {
          var addr = inAddress || base;
          var ipOnly = addr;
          var prefix = inSubnet || "";
          if (addr.indexOf("/") >= 0) {
            ipOnly = addr.slice(0, addr.indexOf("/"));
            prefix = prefix || addr.slice(addr.indexOf("/") + 1);
          }
          values[nodeId + "|ip_address"] = isVisible ? ipOnly : "";
          values[nodeId + "|subnet"] = isVisible ? prefix : "";
          values[nodeId + "|netmask"] = isVisible ? prefix : "";
        } else if (det === "ip-list") {
          var inList = firstControlInput(nodeId, "ip_list") || base;
          var listNorm = String(inList || "")
            .split(",")
            .map(function (x) {
              return trimStr(x);
            })
            .filter(Boolean)
            .join(",");
          values[nodeId + "|ip_list"] = isVisible ? listNorm : "";
        } else if (
          det === "selector" ||
          det === "dropdown-single" ||
          det === "dropdown-multi" ||
          det === "dropdown-shared" ||
          det === "member-lookup"
        ) {
          var picked = isVisible ? inSelected || base : "";
          values[nodeId + "|selected"] = picked;
          if (det === "selector") {
            var pickedKey = "option_" + slug(picked);
            (Array.isArray(node.outputs) ? node.outputs : []).forEach(function (outHandle) {
              if (String(outHandle || "").indexOf("option_") !== 0) return;
              values[nodeId + "|" + outHandle] = isVisible && outHandle === pickedKey;
            });
            if (values[nodeId + "|option_ip_list"] === true) {
              values[nodeId + "|option_iplist"] = true;
            }
            if (values[nodeId + "|option_iplist"] === true) {
              values[nodeId + "|option_ip_list"] = true;
            }
          }
        } else if (det === "toggle-onoff" || det === "toggle-checkbox") {
          var truthy = isVisible && !!trimStr(base);
          values[nodeId + "|on"] = truthy ? "on" : "";
          values[nodeId + "|off"] = truthy ? "" : "off";
        } else {
          values[nodeId + "|value"] = isVisible ? base : "";
        }
      });
    }
    return { outputs: values, inputsByControl: controlInputs, visibilityByControl: visibilityByCtrl };
  }

  function computeOutputValuesForTest() {
    var fs = computeFlowStateForTest();
    return fs && fs.outputs ? fs.outputs : {};
  }

  function openObjectEditFlyoutForSelectedTest() {
    var row = selectedTestObjectRow();
    if (!row || !state.entityType) {
      setStatus("Select a test object first.");
      return;
    }
    var label = trimStr(state.selectedTestObjectName);
    if (typeof globalThis.gcDesignerOpenObjectEditFlyoutFromDataControls === "function") {
      globalThis.gcDesignerOpenObjectEditFlyoutFromDataControls({
        entityType: state.entityType,
        row: row,
        rowLabel: label,
      });
      function applyInMemoryLayoutToFlyoutCatalog() {
        buildNodeCatalog();
        if (typeof globalThis.gcDcLayoutApplyFlowFromDesignToObjectEditCatalog === "function") {
          globalThis.gcDcLayoutApplyFlowFromDesignToObjectEditCatalog(
            state.nodeCatalog,
            state.layout,
            state.fields,
            row,
          );
        }
      }
      setTimeout(applyInMemoryLayoutToFlyoutCatalog, 220);
      setTimeout(applyInMemoryLayoutToFlyoutCatalog, 460);
    } else {
      setStatus("Object edit flyout is not loaded. Reload the page.");
    }
  }

  function openObjectEditFlyoutForAddMode() {
    if (!trimStr(state.entityType)) {
      setStatus("Select a cached object type first.");
      return;
    }
    if (typeof globalThis.gcDesignerOpenObjectEditFlyoutFromDataControls !== "function") {
      setStatus("Object edit flyout is not loaded. Reload the page.");
      return;
    }
    globalThis.gcDesignerOpenObjectEditFlyoutFromDataControls({
      mode: "add",
      entityType: state.entityType,
      rowLabel: "",
      row: { cells: {}, flat: {} },
    });
  }

  function drawEdges() {
    var box = layoutRoot.getBoundingClientRect();
    var width = Math.max(320, Math.round(box.width));
    var height = Math.max(220, Math.round(box.height));
    edgesSvg.setAttribute("viewBox", "0 0 " + width + " " + height);
    edgesSvg.setAttribute("width", String(width));
    edgesSvg.setAttribute("height", String(height));
    var html = edgeArrowDefs();
    var outputValues = state.showTestValues ? computeOutputValuesForTest() : {};
    var tupleGroups = {};
    state.layout.connections.forEach(function (e) {
      if (!e || typeof e !== "object") return;
      var tk = edgeTupleKey(e);
      if (!tupleGroups[tk]) tupleGroups[tk] = [];
      tupleGroups[tk].push(e);
    });
    var parallelBumpByEdgeKey = {};
    Object.keys(tupleGroups).forEach(function (tk) {
      var arr = tupleGroups[tk];
      if (!arr || arr.length < 2) return;
      arr.forEach(function (e, idx) {
        parallelBumpByEdgeKey[edgeKey(e)] = (idx - (arr.length - 1) / 2) * 11;
      });
    });
    var allNodeObstacles = layoutNodeObstaclesAll();
    state.layout.connections.forEach(function (edge) {
      var a = handleCenter(edge.source_node_id, edge.source_handle, "out");
      var b = handleCenter(edge.target_node_id, edge.target_handle, "in");
      if (!a || !b) return;
      var key = edgeKey(edge);
      var baseBump = Object.hasOwn(parallelBumpByEdgeKey, key)
        ? parallelBumpByEdgeKey[key]
        : 0;
      var obstacles = layoutObstaclesMinusNodes(
        allNodeObstacles,
        edge.source_node_id,
        edge.target_node_id,
      );
      var yTotal = pickLaneYOffset(a, b, baseBump, obstacles);
      var geom = edgeBezierGeometryRaw(a, b, yTotal);
      var side = sourceSideForNode(edge.source_node_id);
      var sel = isEdgeKeySelected(key);
      var cls =
        "gc-designer-data-controls-layout__edge gc-designer-data-controls-layout__edge--from-" +
        side +
        (sel ? " is-selected" : "");
      var markerId = sel
        ? "gc-dc-edge-arrow-selected"
        : side === "right"
          ? "gc-dc-edge-arrow-right"
          : "gc-dc-edge-arrow-left";
      html += drawPath(edgePathFromGeometry(geom), cls, key, markerId);
      html += drawEdgeHandle(
        geom.bx.toFixed(1),
        geom.by.toFixed(1),
        key,
        side,
        sel,
      );
      if (state.showTestValues) {
        var lbl = edgeValueLabelText(edge, outputValues);
        if (lbl) {
          var mid = cubicBezierPoint(geom, 0.5);
          html +=
            '<text class="gc-designer-data-controls-layout__edge-value" data-edge-key="' +
            esc(key || "") +
            '" x="' +
            mid.x.toFixed(1) +
            '" y="' +
            (mid.y - 5).toFixed(1) +
            '">' +
            escHtmlText(lbl) +
            "</text>";
        }
      }
    });
    if (state.tempEdge) {
      var ts = handleCenter(
        state.tempEdge.source_node_id,
        state.tempEdge.source_handle,
        "out",
      );
      if (ts) {
        var tempSide = sourceSideForNode(state.tempEdge.source_node_id);
        var tempMarker =
          tempSide === "right"
            ? "gc-dc-edge-arrow-right"
            : "gc-dc-edge-arrow-left";
        var tempB = { x: state.tempEdge.x, y: state.tempEdge.y };
        var tempObs = layoutObstaclesMinusNodes(
          allNodeObstacles,
          state.tempEdge.source_node_id,
          "",
        );
        var tempY = pickLaneYOffset(ts, tempB, 0, tempObs);
        var tempGeom = edgeBezierGeometryRaw(ts, tempB, tempY);
        html += drawPath(
          edgePathFromGeometry(tempGeom),
          "gc-designer-data-controls-layout__edge gc-designer-data-controls-layout__edge--from-" +
            tempSide +
            " gc-designer-data-controls-layout__edge--temp",
          "",
          tempMarker,
        );
      }
    }
    edgesSvg.innerHTML = html;
    syncHandleConnectionStates();
    syncTestValueHoverEdgeClasses();
  }

  function setTestValueHoverEdgeKey(key) {
    var next = trimStr(key || "");
    if (state.testValueHoverEdgeKey === next) return;
    state.testValueHoverEdgeKey = next;
    syncTestValueHoverEdgeClasses();
  }

  function syncTestValueHoverEdgeClasses() {
    if (!edgesSvg) return;
    var hk = state.showTestValues ? trimStr(state.testValueHoverEdgeKey) : "";
    edgesSvg.querySelectorAll(".gc-designer-data-controls-layout__edge[data-edge-key]").forEach(function (p) {
      var k = trimStr(p.getAttribute("data-edge-key") || "");
      var on = !!hk && k === hk;
      p.classList.toggle("is-test-value-hover", on);
    });
    edgesSvg.querySelectorAll(".gc-designer-data-controls-layout__edge-handle[data-edge-key]").forEach(
      function (c) {
        var k = trimStr(c.getAttribute("data-edge-key") || "");
        var on = !!hk && k === hk;
        c.classList.toggle("is-test-value-hover", on);
      },
    );
  }

  function wireEdgeTestValueHover() {
    if (!edgesSvg) return;
    edgesSvg.addEventListener("pointerover", function (ev) {
      if (!state.showTestValues) return;
      var t = ev.target && ev.target.closest ? ev.target.closest(".gc-designer-data-controls-layout__edge-value") : null;
      if (!t || !edgesSvg.contains(t)) return;
      var k = trimStr(t.getAttribute("data-edge-key") || "");
      if (k) setTestValueHoverEdgeKey(k);
    });
    edgesSvg.addEventListener("pointerout", function (ev) {
      if (!state.showTestValues) return;
      var t = ev.target && ev.target.closest ? ev.target.closest(".gc-designer-data-controls-layout__edge-value") : null;
      if (!t || !edgesSvg.contains(t)) return;
      var rel = ev.relatedTarget;
      if (rel && t.contains(rel)) return;
      setTestValueHoverEdgeKey("");
    });
    edgesSvg.addEventListener("pointerleave", function (ev) {
      if (!state.showTestValues) return;
      var rel = ev.relatedTarget;
      if (rel && edgesSvg.contains(rel)) return;
      setTestValueHoverEdgeKey("");
    });
  }

  function syncHandleConnectionStates() {
    if (!layoutRoot) return;
    var handles = layoutRoot.querySelectorAll(".gc-designer-data-controls-layout__handle");
    Array.prototype.forEach.call(handles, function (btn) {
      btn.classList.remove("is-wired");
    });
    var conns =
      state.layout && Array.isArray(state.layout.connections) ? state.layout.connections : [];
    conns.forEach(function (edge) {
      if (!edge || typeof edge !== "object") return;
      var sid = trimStr(edge.source_node_id);
      var sh = trimStr(edge.source_handle);
      var tid = trimStr(edge.target_node_id);
      var th = trimStr(edge.target_handle);
      if (!sid || !sh || !tid || !th) return;
      var outSel =
        '.gc-designer-data-controls-layout__handle[data-node-id="' +
        cssEscape(sid) +
        '"][data-handle-id="' +
        cssEscape(sh) +
        '"][data-io="out"]';
      var inSel =
        '.gc-designer-data-controls-layout__handle[data-node-id="' +
        cssEscape(tid) +
        '"][data-handle-id="' +
        cssEscape(th) +
        '"][data-io="in"]';
      layoutRoot.querySelectorAll(outSel).forEach(function (el) {
        el.classList.add("is-wired");
      });
      layoutRoot.querySelectorAll(inSel).forEach(function (el) {
        el.classList.add("is-wired");
      });
    });
  }

  function renderCanvasNodes() {
    var fieldParts = [];
    var fieldIds = fieldNodeIdsOrdered();
    for (var i = 0; i < fieldIds.length; i++) {
      var fieldNode = state.nodeCatalog[fieldIds[i]];
      if (!fieldNode || fieldNode.kind !== "field") continue;
      fieldParts.push(
        '<li class="gc-designer-data-controls-layout__field-item" data-canvas-node-id="' +
          esc(fieldNode.id) +
          '">' +
          nodeHtml(fieldNode, { fieldPanel: true }) +
          "</li>",
      );
    }
    nodesEl.innerHTML =
      '<ol class="gc-designer-data-controls-layout__field-list" aria-label="Data field cards order">' +
      fieldParts.join("") +
      "</ol>";
  }

  function fieldRankByDisplayOrder(fieldId) {
    var fid = String(fieldId || "");
    var rank = 2147483647;
    state.fields.forEach(function (f) {
      if (String(f.id) !== fid) return;
      var n = parseInt(String(f.display_order || "").trim(), 10);
      if (!isNaN(n) && n >= 1) rank = n;
    });
    return rank;
  }

  function controlNodeIdsOrdered() {
    var ids = [];
    Object.keys(state.nodeCatalog).forEach(function (id) {
      var n = state.nodeCatalog[id];
      if (n && n.kind === "control") ids.push(id);
    });
    ids.sort(function (a, b) {
      var fa = state.nodeCatalog[a].field_id;
      var fb = state.nodeCatalog[b].field_id;
      var ra = fieldRankByDisplayOrder(fa);
      var rb = fieldRankByDisplayOrder(fb);
      if (ra !== rb) return ra - rb;
      var ya = Number(state.nodeCatalog[a].y) || 0;
      var yb = Number(state.nodeCatalog[b].y) || 0;
      if (ya !== yb) return ya - yb;
      return String(a).localeCompare(String(b));
    });
    return ids;
  }

  function fieldNodeIdsOrdered() {
    var ids = [];
    Object.keys(state.nodeCatalog).forEach(function (id) {
      var n = state.nodeCatalog[id];
      if (n && n.kind === "field") ids.push(id);
    });
    ids.sort(function (a, b) {
      var fa = state.nodeCatalog[a].field_id;
      var fb = state.nodeCatalog[b].field_id;
      var ra = fieldRankByDisplayOrder(fa);
      var rb = fieldRankByDisplayOrder(fb);
      if (ra !== rb) return ra - rb;
      var ya = Number(state.nodeCatalog[a].y) || 0;
      var yb = Number(state.nodeCatalog[b].y) || 0;
      if (ya !== yb) return ya - yb;
      return String(a).localeCompare(String(b));
    });
    return ids;
  }

  function logicNodeIdsOrdered() {
    var ids = [];
    Object.keys(state.nodeCatalog).forEach(function (id) {
      var n = state.nodeCatalog[id];
      if (n && n.kind === "logic") ids.push(id);
    });
    ids.sort(function (a, b) {
      var ya = Number(state.nodeCatalog[a].y) || 0;
      var yb = Number(state.nodeCatalog[b].y) || 0;
      if (ya !== yb) return ya - yb;
      return String(a).localeCompare(String(b));
    });
    return ids;
  }

  function nodeAnchorForLogicAutoArrange(nodeId, logicOrderMap, fieldOrderMap, controlOrderMap) {
    var n = state.nodeCatalog[nodeId];
    if (!n) return null;
    if (n.kind === "field") {
      return (fieldOrderMap[nodeId] || 0) * 160;
    }
    if (n.kind === "control") {
      return (controlOrderMap[nodeId] || 0) * 280;
    }
    if (n.kind === "logic") {
      if (logicOrderMap[nodeId] != null) return logicOrderMap[nodeId] * 190;
      return Number(n.y) || 0;
    }
    return null;
  }

  function autoArrangeLogicPanelFromConnections() {
    var ids = logicNodeIdsOrdered();
    if (!ids.length) return false;
    var fieldIds = fieldNodeIdsOrdered();
    var controlIds = controlNodeIdsOrdered();
    var fieldOrderMap = {};
    var controlOrderMap = {};
    var logicOrderMap = {};
    fieldIds.forEach(function (id, i) {
      fieldOrderMap[id] = i;
    });
    controlIds.forEach(function (id, i) {
      controlOrderMap[id] = i;
    });
    ids.forEach(function (id, i) {
      logicOrderMap[id] = i;
    });
    var anchor = {};
    ids.forEach(function (id) {
      var sum = 0;
      var n = 0;
      state.layout.connections.forEach(function (edge) {
        var other = "";
        if (edge.source_node_id === id) other = trimStr(edge.target_node_id);
        else if (edge.target_node_id === id) other = trimStr(edge.source_node_id);
        if (!other) return;
        var y = nodeAnchorForLogicAutoArrange(other, logicOrderMap, fieldOrderMap, controlOrderMap);
        if (y == null) return;
        sum += y;
        n += 1;
      });
      anchor[id] = n ? sum / n : Number(state.nodeCatalog[id].y) || logicOrderMap[id] * 190;
    });
    for (var pass = 0; pass < 2; pass++) {
      var next = {};
      ids.forEach(function (id) {
        var sum = anchor[id];
        var n = 1;
        state.layout.connections.forEach(function (edge) {
          var other = "";
          if (edge.source_node_id === id) other = trimStr(edge.target_node_id);
          else if (edge.target_node_id === id) other = trimStr(edge.source_node_id);
          if (!other) return;
          var on = state.nodeCatalog[other];
          if (!on || on.kind !== "logic") return;
          if (anchor[other] == null) return;
          sum += anchor[other];
          n += 1;
        });
        next[id] = sum / n;
      });
      anchor = next;
    }
    var sorted = ids.slice();
    sorted.sort(function (a, b) {
      var ay = Number(anchor[a]);
      var by = Number(anchor[b]);
      if (ay !== by) return ay - by;
      var ya = Number(state.nodeCatalog[a].y) || 0;
      var yb = Number(state.nodeCatalog[b].y) || 0;
      if (ya !== yb) return ya - yb;
      return String(a).localeCompare(String(b));
    });
    var changed = false;
    var step = 190;
    sorted.forEach(function (id, i) {
      var node = state.nodeCatalog[id];
      if (!node) return;
      var wantY = i * step;
      if ((Number(node.x) || 0) !== 0 || (Number(node.y) || 0) !== wantY) {
        changed = true;
        node.x = 0;
        node.y = wantY;
        storeNodePosition(id, node.x, node.y);
      }
    });
    return changed;
  }

  function renderLogicPanel() {
    var ids = logicNodeIdsOrdered();
    var parts = [];
    for (var i = 0; i < ids.length; i++) {
      var node = state.nodeCatalog[ids[i]];
      if (!node || node.kind !== "logic") continue;
      parts.push(
        '<li class="gc-designer-data-controls-layout__logic-item" data-logic-node-id="' +
          esc(node.id) +
          '">' +
          nodeHtml(node, { logicPanel: true }) +
          "</li>",
      );
    }
    if (!parts.length) {
      logicEl.innerHTML = '<p class="muted">No logic blocks yet. Add one from the toolbar.</p>';
      return;
    }
    logicEl.innerHTML =
      '<ol class="gc-designer-data-controls-layout__logic-list" aria-label="Logic blocks">' +
      parts.join("") +
      "</ol>";
  }

  function renderControlsPanel() {
    var ids = controlNodeIdsOrdered();
    var parts = [];
    for (var i = 0; i < ids.length; i++) {
      var node = state.nodeCatalog[ids[i]];
      if (!node) continue;
      parts.push(
        '<li class="gc-designer-data-controls-layout__control-item" data-panel-node-id="' +
          esc(node.id) +
          '">' +
          nodeHtml(node, { controlPanel: true }) +
          "</li>",
      );
    }
    if (!parts.length) {
      controlsEl.innerHTML =
        '<p class="muted">No controls mapped yet. Choose a data entry type in Field catalog.</p>';
      return;
    }
    controlsEl.innerHTML =
      '<ol class="gc-designer-data-controls-layout__control-list" aria-label="Display cards order">' +
      parts.join("") +
      "</ol>";
    hydrateMemberLookupDataSourceSelectorsInPanel();
  }

  function hydrateMemberLookupDataSourceSelectorsInPanel() {
    if (!controlsEl) return;
    var fn = globalThis.gcDesignerHydrateObjectSelectorDropdown;
    if (typeof fn !== "function") return;
    var map = ensureMemberLookupDataSourceMap();
    controlsEl
      .querySelectorAll(".gc-designer-data-controls-layout__panel-ml-source-select")
      .forEach(function (sel) {
        var nid = trimStr(sel.getAttribute("data-node-id"));
        var want = nid && map[nid] ? map[nid] : "";
        fn(sel, function (el) {
          if (want && el) {
            el.value = want;
            if (el.value !== want) el.value = "";
          }
        });
      });
  }

  function persistControlPanelOrderFromDom() {
    var orderedFieldIds = [];
    var listEl = controlsEl.querySelector(".gc-designer-data-controls-layout__control-list");
    if (!listEl) return orderedFieldIds;
    var items = listEl.querySelectorAll(".gc-designer-data-controls-layout__control-item");
    var step = 280;
    Array.prototype.forEach.call(items, function (li, i) {
      var row = li.querySelector(".gc-designer-data-controls-layout__node[data-node-id]");
      if (!row) return;
      var id = row.getAttribute("data-node-id") || "";
      var node = state.nodeCatalog[id];
      if (!node) return;
      var x = Number(node.x) || 10;
      node.x = x;
      node.y = i * step;
      storeNodePosition(id, x, node.y);
      var fid = trimStr(node.field_id);
      if (fid) orderedFieldIds.push(fid);
    });
    return orderedFieldIds;
  }

  function persistFieldPanelOrderFromDom() {
    var orderedFieldIds = [];
    var listEl = nodesEl.querySelector(".gc-designer-data-controls-layout__field-list");
    if (!listEl) return orderedFieldIds;
    var items = listEl.querySelectorAll(".gc-designer-data-controls-layout__field-item");
    var step = 160;
    Array.prototype.forEach.call(items, function (li, i) {
      var row = li.querySelector(".gc-designer-data-controls-layout__node[data-node-id]");
      if (!row) return;
      var id = row.getAttribute("data-node-id") || "";
      var node = state.nodeCatalog[id];
      if (!node || node.kind !== "field") return;
      node.x = 0;
      node.y = i * step;
      storeNodePosition(id, node.x, node.y);
      var fid = trimStr(node.field_id);
      if (fid) orderedFieldIds.push(fid);
    });
    return orderedFieldIds;
  }

  function controlListInsertBeforeForPointer(listEl, clientY) {
    var dragger = listEl.querySelector(
      ".gc-designer-data-controls-layout__control-item.is-panel-reorder-dragging",
    );
    var siblings = Array.prototype.filter.call(listEl.children, function (li) {
      return (
        li !== dragger &&
        li.classList &&
        li.classList.contains("gc-designer-data-controls-layout__control-item")
      );
    });
    var closest = { offset: Number.NEGATIVE_INFINITY, el: null };
    for (var i = 0; i < siblings.length; i++) {
      var box = siblings[i].getBoundingClientRect();
      var offset = clientY - (box.top + box.height / 2);
      if (offset < 0 && offset > closest.offset) {
        closest = { offset: offset, el: siblings[i] };
      }
    }
    return closest.el;
  }

  function fieldListInsertBeforeForPointer(listEl, clientY) {
    var dragger = listEl.querySelector(
      ".gc-designer-data-controls-layout__field-item.is-field-reorder-dragging",
    );
    var siblings = Array.prototype.filter.call(listEl.children, function (li) {
      return (
        li !== dragger &&
        li.classList &&
        li.classList.contains("gc-designer-data-controls-layout__field-item")
      );
    });
    var closest = { offset: Number.NEGATIVE_INFINITY, el: null };
    for (var i = 0; i < siblings.length; i++) {
      var box = siblings[i].getBoundingClientRect();
      var offset = clientY - (box.top + box.height / 2);
      if (offset < 0 && offset > closest.offset) {
        closest = { offset: offset, el: siblings[i] };
      }
    }
    return closest.el;
  }

  function beginFieldPanelReorder(ev, dragBtn) {
    if (isLayoutMapLocked()) return;
    ev.preventDefault();
    ev.stopPropagation();
    var li = dragBtn.closest(".gc-designer-data-controls-layout__field-item");
    var listEl = dragBtn.closest(".gc-designer-data-controls-layout__field-list");
    if (!li || !listEl || !nodesEl.contains(li)) return;
    li.classList.add("is-field-reorder-dragging");
    state.fieldReorderDrag = { listEl: listEl, draggingLi: li };
    try {
      document.body.style.userSelect = "none";
    } catch (e0) {}
  }

  function applyFieldReorderPointerMove(clientY) {
    var st = state.fieldReorderDrag;
    if (!st || !st.listEl || !st.draggingLi) return;
    var before = fieldListInsertBeforeForPointer(st.listEl, clientY);
    if (before == null) {
      st.listEl.appendChild(st.draggingLi);
    } else {
      st.listEl.insertBefore(st.draggingLi, before);
    }
    syncLayoutHeights();
    drawEdges();
  }

  function endFieldPanelReorder() {
    if (!state.fieldReorderDrag) return;
    if (state.fieldReorderDrag.draggingLi) {
      state.fieldReorderDrag.draggingLi.classList.remove("is-field-reorder-dragging");
    }
    state.fieldReorderDrag = null;
    try {
      document.body.style.userSelect = "";
    } catch (e1) {}
    var orderedFieldIds = persistFieldPanelOrderFromDom();
    saveLayoutSoon();
    drawEdges();
    if (
      orderedFieldIds.length &&
      typeof globalThis.gcDesignerDataControlsApplyDisplayOrdersFromPanel === "function"
    ) {
      globalThis.gcDesignerDataControlsApplyDisplayOrdersFromPanel(orderedFieldIds);
    }
  }

  function beginControlPanelReorder(ev, dragBtn) {
    if (isLayoutMapLocked()) return;
    ev.preventDefault();
    ev.stopPropagation();
    var li = dragBtn.closest(".gc-designer-data-controls-layout__control-item");
    var listEl = dragBtn.closest(".gc-designer-data-controls-layout__control-list");
    if (!li || !listEl || !controlsEl.contains(li)) return;
    li.classList.add("is-panel-reorder-dragging");
    state.controlReorderDrag = { listEl: listEl, draggingLi: li };
    try {
      document.body.style.userSelect = "none";
    } catch (e0) {}
  }

  function applyControlReorderPointerMove(clientY) {
    var st = state.controlReorderDrag;
    if (!st || !st.listEl || !st.draggingLi) return;
    var before = controlListInsertBeforeForPointer(st.listEl, clientY);
    if (before == null) {
      st.listEl.appendChild(st.draggingLi);
    } else {
      st.listEl.insertBefore(st.draggingLi, before);
    }
    syncLayoutHeights();
    drawEdges();
  }

  function endControlPanelReorder() {
    if (!state.controlReorderDrag) return;
    if (isLayoutMapLocked()) {
      if (state.controlReorderDrag.draggingLi) {
        state.controlReorderDrag.draggingLi.classList.remove("is-panel-reorder-dragging");
      }
      state.controlReorderDrag = null;
      try {
        document.body.style.userSelect = "";
      } catch (eAbort) {}
      return;
    }
    if (state.controlReorderDrag.draggingLi) {
      state.controlReorderDrag.draggingLi.classList.remove("is-panel-reorder-dragging");
    }
    state.controlReorderDrag = null;
    try {
      document.body.style.userSelect = "";
    } catch (e1) {}
    var orderedFieldIds = persistControlPanelOrderFromDom();
    saveLayoutSoon();
    drawEdges();
    if (
      orderedFieldIds.length &&
      typeof globalThis.gcDesignerDataControlsApplyDisplayOrdersFromPanel === "function"
    ) {
      globalThis.gcDesignerDataControlsApplyDisplayOrdersFromPanel(orderedFieldIds);
    }
  }

  function applyNodeTransformsForKind(kind) {
    if (kind === "control" || kind === "field" || kind === "logic") {
      return;
    }
    var host = kind === "field" || kind === "logic" ? nodesEl : controlsEl;
    Object.keys(state.nodeCatalog).forEach(function (id) {
      var node = state.nodeCatalog[id];
      if (!node || node.kind !== kind) return;
      var el = host.querySelector(
        '.gc-designer-data-controls-layout__node[data-node-id="' + cssEscape(id) + '"]',
      );
      if (!el) return;
      el.style.transform = "translate(" + node.x + "px," + node.y + "px)";
    });
  }

  function syncLayoutHeights() {
    var minContent = 420;
    var maxCanvas = minContent;
    var maxPanel = minContent;
    var fieldListEl = nodesEl.querySelector(".gc-designer-data-controls-layout__field-list");
    if (fieldListEl) {
      maxCanvas = Math.max(maxCanvas, (fieldListEl.offsetHeight || 0) + 32);
    }
    nodesEl
      .querySelectorAll(".gc-designer-data-controls-layout__node[data-node-id]")
      .forEach(function (el) {
        var id = el.getAttribute("data-node-id") || "";
        var node = state.nodeCatalog[id];
        if (!node || node.kind === "field") return;
        var h = el.offsetHeight || 96;
        maxCanvas = Math.max(maxCanvas, (Number(node.y) || 0) + h + 24);
      });
    var listOl = controlsEl.querySelector(".gc-designer-data-controls-layout__control-list");
    if (listOl) {
      var gap = 10;
      var sum = 0;
      listOl.querySelectorAll(".gc-designer-data-controls-layout__control-item").forEach(function (li) {
        sum += (li.offsetHeight || 96) + gap;
      });
      maxPanel = Math.max(maxPanel, sum + 32);
    } else {
      controlsEl
        .querySelectorAll(".gc-designer-data-controls-layout__node[data-node-id]")
        .forEach(function (el) {
          var id = el.getAttribute("data-node-id") || "";
          var node = state.nodeCatalog[id];
          if (!node) return;
          var h = el.offsetHeight || 96;
          maxPanel = Math.max(maxPanel, (Number(node.y) || 0) + h + 24);
        });
    }
    canvasEl.style.height = String(maxCanvas) + "px";
    nodesEl.style.height = String(maxCanvas) + "px";
    controlsEl.style.minHeight = String(maxPanel) + "px";
  }

  function autoArrangeKindNoOverlap(kind) {
    if (kind === "control" || kind === "field" || kind === "logic") {
      return false;
    }
    var host = kind === "field" || kind === "logic" ? nodesEl : controlsEl;
    var cards = [];
    host
      .querySelectorAll(".gc-designer-data-controls-layout__node[data-node-id]")
      .forEach(function (el) {
        var nodeId = el.getAttribute("data-node-id") || "";
        var node = state.nodeCatalog[nodeId];
        if (!node || node.kind !== kind) return;
        cards.push({
          id: nodeId,
          x: Number(node.x) || 0,
          y: Number(node.y) || 0,
          w: el.offsetWidth || 320,
          h: Math.max(1, Math.round(el.getBoundingClientRect().height)) || 96,
        });
      });
    cards.sort(function (a, b) {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    var gap = 12;
    var changed = false;
    var cursorY = cards.length ? cards[0].y : 0;
    cards.forEach(function (card) {
      var py = Math.max(card.y, cursorY);
      cursorY = py + card.h + gap;
      if (py !== card.y) {
        changed = true;
        state.nodeCatalog[card.id].y = py;
        storeNodePosition(card.id, state.nodeCatalog[card.id].x, py);
      }
    });
    return changed;
  }

  function autoArrangeNoOverlap() {
    var changedField = autoArrangeKindNoOverlap("field");
    var changedLogic = autoArrangeKindNoOverlap("logic");
    var changedControl = autoArrangeKindNoOverlap("control");
    if (changedField) applyNodeTransformsForKind("field");
    if (changedLogic) applyNodeTransformsForKind("logic");
    if (changedControl) applyNodeTransformsForKind("control");
    return changedField || changedLogic || changedControl;
  }

  function selectedTestObjectRow() {
    var want = trimStr(state.selectedTestObjectName).toLowerCase();
    if (!want) return null;
    for (var i = 0; i < state.testObjects.length; i++) {
      var r = state.testObjects[i];
      if (trimStr(r.name).toLowerCase() === want) return r.row || null;
    }
    return null;
  }

  function valueForPropertyFromRow(row, propertyName) {
    if (!row) return "";
    var p = trimStr(propertyName);
    if (!p) return "";
    var cells = row.cells && typeof row.cells === "object" ? row.cells : {};
    var flat = row.flat && typeof row.flat === "object" ? row.flat : {};
    if (Object.prototype.hasOwnProperty.call(cells, p) && cells[p] != null) {
      return String(cells[p]);
    }
    if (Object.prototype.hasOwnProperty.call(flat, p) && flat[p] != null) {
      return String(flat[p]);
    }
    var leaf = p.indexOf(".") >= 0 ? p.slice(p.lastIndexOf(".") + 1) : p;
    if (Object.prototype.hasOwnProperty.call(cells, leaf) && cells[leaf] != null) {
      return String(cells[leaf]);
    }
    if (Object.prototype.hasOwnProperty.call(flat, leaf) && flat[leaf] != null) {
      return String(flat[leaf]);
    }
    if (leaf === "Name" && cells.__name != null) return String(cells.__name);
    return "";
  }

  function edgeValueLabelText(edge, outputValues) {
    var key = edge.source_node_id + "|" + edge.source_handle;
    var v = outputValues[key];
    if (v == null) return "";
    var s = String(v);
    return s.length > 40 ? s.slice(0, 37) + "..." : s;
  }

  function testButtonRefresh() {
    if (!traceBtn && !showEditBtn && !showAddBtn) return;
    var hasObject = !!trimStr(state.selectedTestObjectName);
    if (traceBtn) {
      traceBtn.disabled = !hasObject;
      traceBtn.textContent = state.showTestValues ? "Hide Trace" : "Trace";
    }
    if (showEditBtn) showEditBtn.disabled = !hasObject;
    if (showAddBtn) showAddBtn.disabled = false;
  }

  function closeTestPanel() {
    if (!testPanelEl || !testTriggerEl) return;
    testPanelEl.hidden = true;
    testTriggerEl.setAttribute("aria-expanded", "false");
  }

  function setSelectedTestObject(name) {
    state.selectedTestObjectName = trimStr(name);
    persistSelectedTestObjectForEntity(state.selectedTestObjectName);
    if (testTriggerEl) {
      testTriggerEl.textContent = state.selectedTestObjectName || "Select test object…";
    }
    if (!state.selectedTestObjectName) {
      state.showTestValues = false;
      state.testValueHoverEdgeKey = "";
    }
    testButtonRefresh();
    drawEdges();
  }

  function renderTestOptions(filterText) {
    if (!testOptionsEl) return;
    var q = trimStr(filterText).toLowerCase();
    var html = "";
    state.testObjects.forEach(function (obj) {
      var nm = trimStr(obj.name);
      if (!nm) return;
      if (q && nm.toLowerCase().indexOf(q) === -1) return;
      html +=
        '<li class="gc-designer-data-controls__layout-test-opt" data-value="' +
        esc(nm) +
        '" role="option" aria-selected="' +
        (nm === state.selectedTestObjectName ? "true" : "false") +
        '">' +
        '<button type="button" class="gc-designer-data-controls__layout-test-opt-btn mono" data-value="' +
        esc(nm) +
        '">' +
        escHtmlText(nm) +
        "</button></li>";
    });
    if (!html) {
      html =
        '<li class="gc-designer-data-controls__layout-test-opt muted" role="presentation">No objects found.</li>';
    }
    testOptionsEl.innerHTML = html;
  }

  function loadTestObjectsForEntity() {
    if (!state.entityType) {
      state.testObjects = [];
      setSelectedTestObject("");
      renderTestOptions("");
      return;
    }
    var fw = selectedFirewallIdsCsv();
    var cfg = selectedConfigurationIdsCsv();
    if (!fw && !cfg) {
      state.testObjects = [];
      setSelectedTestObject("");
      renderTestOptions("");
      return;
    }
    var url =
      "/api/firewalls/hosts-services/table?entity_type=" +
      encodeURIComponent(state.entityType) +
      "&firewall_ids=" +
      encodeURIComponent(fw) +
      "&configuration_ids=" +
      encodeURIComponent(cfg) +
      "&combine=false&limit=800";
    fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        if (!res.ok || !res.j || !Array.isArray(res.j.rows)) {
          state.testObjects = [];
          setSelectedTestObject("");
          renderTestOptions("");
          return;
        }
        var seen = {};
        var out = [];
        res.j.rows.forEach(function (row) {
          var name = rowName(row);
          if (!name) return;
          var k = name.toLowerCase();
          if (seen[k]) return;
          seen[k] = true;
          out.push({ name: name, row: row });
        });
        out.sort(function (a, b) {
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        state.testObjects = out;
        if (state.selectedTestObjectName) {
          var keep = out.some(function (x) {
            return x.name === state.selectedTestObjectName;
          });
          if (!keep) setSelectedTestObject("");
        }
        if (!state.selectedTestObjectName) {
          var et = trimStr(state.entityType);
          var map = readStoredTestObjectByEntityMap();
          var stored = et ? trimStr(map[et] || "") : "";
          if (stored && out.some(function (x) { return x.name === stored; })) {
            setSelectedTestObject(stored);
          }
        }
        renderTestOptions(testSearchEl ? testSearchEl.value : "");
        testButtonRefresh();
      })
      .catch(function () {
        state.testObjects = [];
        setSelectedTestObject("");
        renderTestOptions("");
      });
  }

  function wireTestPickerUi() {
    if (
      !testPickerEl ||
      !testTriggerEl ||
      !testPanelEl ||
      !testOptionsEl ||
      !traceBtn ||
      !showEditBtn ||
      !showAddBtn
    ) {
      return;
    }
    testTriggerEl.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      var open = !testPanelEl.hidden;
      if (open) {
        closeTestPanel();
        return;
      }
      testPanelEl.hidden = false;
      testTriggerEl.setAttribute("aria-expanded", "true");
      if (testSearchEl) {
        testSearchEl.value = "";
        renderTestOptions("");
        try {
          testSearchEl.focus();
        } catch (e) {}
      } else {
        renderTestOptions("");
      }
    });
    if (testSearchEl) {
      testSearchEl.addEventListener("input", function () {
        renderTestOptions(testSearchEl.value);
      });
    }
    testOptionsEl.addEventListener("click", function (ev) {
      var btn = ev.target.closest
        ? ev.target.closest(".gc-designer-data-controls__layout-test-opt-btn")
        : null;
      if (!btn) return;
      setSelectedTestObject(btn.getAttribute("data-value") || "");
      closeTestPanel();
    });
    traceBtn.addEventListener("click", function () {
      if (!state.selectedTestObjectName) return;
      if (!state.showTestValues) {
        state.showTestValues = true;
        testButtonRefresh();
        drawEdges();
      } else {
        state.showTestValues = false;
        state.testValueHoverEdgeKey = "";
        testButtonRefresh();
        drawEdges();
      }
    });
    showEditBtn.addEventListener("click", function () {
      if (!state.selectedTestObjectName) return;
      openObjectEditFlyoutForSelectedTest();
    });
    showAddBtn.addEventListener("click", function () {
      openObjectEditFlyoutForAddMode();
    });
    document.addEventListener("mousedown", function (ev) {
      if (!testPickerEl.contains(ev.target)) closeTestPanel();
    });
    document.addEventListener("gc-firewall-selection-changed", function () {
      loadTestObjectsForEntity();
    });
    testButtonRefresh();
  }

  function validNodeIdsSet() {
    var s = {};
    Object.keys(state.nodeCatalog).forEach(function (id) {
      s[id] = true;
    });
    return s;
  }

  function cleanConnections() {
    if (!state.layout || !Array.isArray(state.layout.connections)) {
      state.layout = state.layout && typeof state.layout === "object" ? state.layout : {};
      state.layout.connections = [];
      return;
    }
    // Keep loaded edges intact until catalog nodes are hydrated; otherwise
    // an early render pass can prune valid edges and wipe them on autosave.
    if (!Object.keys(state.nodeCatalog).length) return;
    var okNodes = validNodeIdsSet();
    var dedupe = {};
    state.layout.connections = state.layout.connections.filter(function (edge) {
      if (!okNodes[edge.source_node_id] || !okNodes[edge.target_node_id]) return false;
      var sNode = state.nodeCatalog[edge.source_node_id];
      var tNode = state.nodeCatalog[edge.target_node_id];
      if (!sNode || !tNode) return false;
      if (sNode.outputs.indexOf(edge.source_handle) === -1) return false;
      if (tNode.inputs.indexOf(edge.target_handle) === -1) return false;
      var k = edgeKey(edge);
      if (dedupe[k]) return false;
      dedupe[k] = true;
      return true;
    });
  }

  function pruneControlAddOnlyMap() {
    var map = ensureControlAddOnlyMap();
    var keep = {};
    Object.keys(state.nodeCatalog).forEach(function (nodeId) {
      var node = state.nodeCatalog[nodeId];
      if (node && node.kind === "control") keep[nodeId] = true;
    });
    Object.keys(map).forEach(function (nodeId) {
      if (!keep[nodeId]) delete map[nodeId];
    });
  }

  function pruneMemberLookupDataSourceMap() {
    var map = ensureMemberLookupDataSourceMap();
    Object.keys(map).forEach(function (nodeId) {
      var node = state.nodeCatalog[nodeId];
      if (!node || node.kind !== "control") {
        delete map[nodeId];
        return;
      }
      if (trimStr(node.data_entry_type).toLowerCase() !== "member-lookup") {
        delete map[nodeId];
      }
    });
  }

  function renderAll(autoArrangeOnLoad) {
    buildNodeCatalog();
    ensureConnectionEdgeIds(state.layout.connections);
    pruneControlAddOnlyMap();
    pruneMemberLookupDataSourceMap();
    cleanConnections();
    autoArrangeLogicPanelFromConnections();
    renderCanvasNodes();
    renderLogicPanel();
    renderControlsPanel();
    if (autoArrangeOnLoad) {
      autoArrangeNoOverlap();
      autoArrangeLogicPanelFromConnections();
      renderLogicPanel();
    }
    syncLayoutHeights();
    drawEdges();
    refreshLayoutDirtyState();
    syncLayoutLockCheckbox();
    updateLayoutRootLockedClass();
  }

  function isValidLayoutEntityTypeToken(s) {
    var t = trimStr(s);
    return /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(t);
  }

  function normalizeLayoutShape(layout) {
    var src = layout && typeof layout === "object" ? layout : {};
    var out = {
      node_positions: {},
      connections: [],
      logic_nodes: [],
      control_add_only: {},
      member_lookup_data_source: {},
      member_lookup_multi: {},
      layout_locked: parseBoolLike(src.layout_locked),
    };
    if (src.node_positions && typeof src.node_positions === "object") {
      Object.keys(src.node_positions).forEach(function (id) {
        var p = src.node_positions[id];
        if (!p || typeof p !== "object") return;
        out.node_positions[id] = {
          x: Number(p.x) || 0,
          y: Number(p.y) || 0,
        };
      });
    }
    if (Array.isArray(src.connections)) {
      src.connections.forEach(function (edge) {
        if (!edge || typeof edge !== "object") return;
        var row = {
          source_node_id: trimStr(edge.source_node_id),
          source_handle: trimStr(edge.source_handle),
          target_node_id: trimStr(edge.target_node_id),
          target_handle: trimStr(edge.target_handle),
        };
        var eid = trimStr(edge.edge_id);
        if (eid && EDGE_ID_RE.test(eid)) row.edge_id = eid;
        out.connections.push(row);
      });
    }
    if (Array.isArray(src.logic_nodes)) {
      var seenLogic = {};
      src.logic_nodes.forEach(function (item) {
        if (!item || typeof item !== "object") return;
        var id = trimStr(item.id);
        if (!id || id.indexOf("logic:") !== 0 || seenLogic[id]) return;
        seenLogic[id] = true;
        out.logic_nodes.push({
          id: id,
          kind: normalizeLogicKind(item.kind),
          op: normalizeLogicOp(item.op),
          true_value: trimStr(item.true_value),
          false_value: trimStr(item.false_value),
        });
      });
    }
    if (
      src.control_add_only &&
      typeof src.control_add_only === "object" &&
      !Array.isArray(src.control_add_only)
    ) {
      Object.keys(src.control_add_only).forEach(function (nodeId) {
        var nid = trimStr(nodeId);
        if (!nid || nid.indexOf("ctrl:") !== 0) return;
        out.control_add_only[nid] = parseBoolLike(src.control_add_only[nodeId]);
      });
    }
    if (
      src.member_lookup_data_source &&
      typeof src.member_lookup_data_source === "object" &&
      !Array.isArray(src.member_lookup_data_source)
    ) {
      Object.keys(src.member_lookup_data_source).forEach(function (nodeId) {
        var nid = trimStr(nodeId);
        if (!nid || nid.indexOf("ctrl:") !== 0) return;
        var et = trimStr(src.member_lookup_data_source[nodeId]);
        if (!et || !isValidLayoutEntityTypeToken(et)) return;
        out.member_lookup_data_source[nid] = et;
      });
    }
    if (
      src.member_lookup_multi &&
      typeof src.member_lookup_multi === "object" &&
      !Array.isArray(src.member_lookup_multi)
    ) {
      Object.keys(src.member_lookup_multi).forEach(function (nodeId) {
        var nid = trimStr(nodeId);
        if (!nid || nid.indexOf("ctrl:") !== 0) return;
        out.member_lookup_multi[nid] = parseBoolLike(src.member_lookup_multi[nodeId]);
      });
    }
    return out;
  }

  function addLogicNode(op, kind) {
    if (!trimStr(state.entityType)) {
      setStatus("Select a cached object type first.");
      return;
    }
    if (isLayoutMapLocked()) {
      setStatus("Layout map is locked. Turn off Layout locked to edit.");
      return;
    }
    var logicNodes = ensureLogicNodesArray();
    var nodeKind = normalizeLogicKind(kind);
    var nodeOp = normalizeLogicOp(op);
    var id = nextLogicNodeId(nodeOp, nodeKind);
    var maxY = logicNodes.length * 190;
    logicNodes.push({
      id: id,
      kind: nodeKind,
      op: nodeOp,
      true_value: "",
      false_value: "",
    });
    state.layout.node_positions[id] = { x: 0, y: maxY };
    buildNodeCatalog();
    renderAll();
    saveLayoutSoon();
    if (nodeKind === "if_value") {
      setStatus("Added Value block.");
      return;
    }
    if (nodeKind === "csv_array") {
      setStatus("Added CSV ↔ Array block.");
      return;
    }
    setStatus(
      "Added " + (nodeOp === "or" ? "OR" : nodeOp === "not" ? "NOT" : "AND") + " block.",
    );
  }

  function removeLogicNode(logicId) {
    if (isLayoutMapLocked()) {
      setStatus("Layout map is locked. Turn off Layout locked to edit.");
      return;
    }
    var id = trimStr(logicId);
    if (!id || id.indexOf("logic:") !== 0) return;
    var beforeNodes = ensureLogicNodesArray().length;
    state.layout.logic_nodes = state.layout.logic_nodes.filter(function (item) {
      return String(item && item.id ? item.id : "") !== id;
    });
    if (state.layout.node_positions && typeof state.layout.node_positions === "object") {
      delete state.layout.node_positions[id];
    }
    state.layout.connections = state.layout.connections.filter(function (edge) {
      return edge.source_node_id !== id && edge.target_node_id !== id;
    });
    clearSelectedEdges();
    if (state.layout.logic_nodes.length === beforeNodes) return;
    buildNodeCatalog();
    renderAll();
    saveLayoutSoon();
    setStatus("Block deleted.");
  }

  function storeNodePosition(nodeId, x, y) {
    state.layout.node_positions[nodeId] = {
      x: Math.round(x),
      y: Math.round(y),
    };
  }

  function isLayoutDirty() {
    if (!trimStr(state.entityType)) return false;
    return trimStr(state.entityType) + "|" + JSON.stringify(state.layout) !== state.lastSavedSignature;
  }

  function refreshLayoutDirtyState() {
    var dirty = isLayoutDirty();
    ["gc-designer-data-controls-layout-dirty-catalog", "gc-designer-data-controls-layout-dirty-panel"].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = !dirty;
      },
    );
    /* Save / reload toolbar uses the same dirty signal; keep it in sync with the badges. */
    updatePersistButtonsEnabled();
  }

  function updatePersistButtonsEnabled() {
    var on = !!trimStr(state.entityType);
    var locked = isLayoutMapLocked();
    var dirty = isLayoutDirty();
    document.querySelectorAll(".gc-dc-layout-persist-btn.gc-dc-layout-save").forEach(function (b) {
      b.disabled = !on || !dirty;
    });
    document.querySelectorAll(".gc-dc-layout-persist-btn.gc-dc-layout-reload").forEach(function (b) {
      b.disabled = !on;
    });
    if (resetBtn) resetBtn.disabled = !on || locked;
    [addAndBtn, addOrBtn, addNotBtn, addIfValueBtn, addCsvArrayBtn].forEach(function (b) {
      if (b) b.disabled = !on || locked;
    });
    syncLayoutLockCheckbox();
    applyLayoutLockToInteractiveControls();
  }

  function countPayloadConnectionEdges(layoutObj) {
    var L = layoutObj && typeof layoutObj === "object" ? layoutObj : {};
    var c = L.connections;
    if (!Array.isArray(c)) return 0;
    var n = 0;
    for (var i = 0; i < c.length; i++) {
      var e = c[i];
      if (!e || typeof e !== "object") continue;
      if (trimStr(e.source_node_id) && trimStr(e.target_node_id)) n++;
    }
    return n;
  }

  function layoutLoadRetryDelayMs(zeroBasedStep) {
    if (zeroBasedStep <= 0) return 0;
    return 260 + zeroBasedStep * 400;
  }

  function fetchDesignerLayoutOnce(et) {
    return fetch("/api/designer/data-controls-layout/" + encodeURIComponent(et), {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        return r
          .json()
          .then(function (j) {
            return { httpOk: r.ok, j: j && typeof j === "object" ? j : {} };
          })
          .catch(function () {
            return { httpOk: r.ok, j: null, jsonError: true };
          });
      })
      .catch(function () {
        return { httpOk: false, j: null, networkError: true };
      });
  }

  /**
   * Fetches saved layout with retries if the request fails or if the server reports
   * connections that all disappear after normalize + cleanConnections (transient races).
   */
  function loadLayoutFromServerAndApply(fetchForEt, maxAttempts, statusRetryPrefix) {
    var cap = maxAttempts != null ? maxAttempts : 3;
    if (cap < 1) cap = 1;
    var retryLabel = trimStr(statusRetryPrefix) || "Layout load";

    function attempt(step) {
      if (trimStr(state.entityType) !== fetchForEt) {
        return Promise.resolve({ ok: false, reason: "entity-changed" });
      }
      var waitMs = layoutLoadRetryDelayMs(step);
      return new Promise(function (resolve) {
        window.setTimeout(resolve, waitMs);
      }).then(function () {
        if (trimStr(state.entityType) !== fetchForEt) {
          return { ok: false, reason: "entity-changed" };
        }
        return fetchDesignerLayoutOnce(fetchForEt);
      }).then(function (res) {
        if (trimStr(state.entityType) !== fetchForEt) {
          return { ok: false, reason: "entity-changed" };
        }
        var networkError = !!res.networkError;
        var jsonError = !!res.jsonError;
        var httpOk = !!res.httpOk;
        var j = res.j;
        var apiOk = httpOk && j && j.ok === true;
        var layoutObj = j && j.layout && typeof j.layout === "object" ? j.layout : {};
        var rawEdges = countPayloadConnectionEdges(layoutObj);

        if (networkError || jsonError || !apiOk) {
          if (step + 1 < cap) {
            setStatus(
              retryLabel +
                " failed — retrying (" +
                String(step + 2) +
                "/" +
                String(cap) +
                ")…",
            );
            return attempt(step + 1);
          }
          return { ok: false, reason: "fetch-failed", rawEdges: rawEdges, finalEdges: 0 };
        }

        applyLayoutFromServerPayload(layoutObj, fetchForEt);
        var finalEdges = state.layout.connections.length;

        if (rawEdges > 0 && finalEdges === 0 && step + 1 < cap) {
          setStatus(
            retryLabel +
              " dropped all edges — retrying (" +
              String(step + 2) +
              "/" +
              String(cap) +
              ")…",
          );
          return attempt(step + 1);
        }

        return {
          ok: true,
          reason: "",
          rawEdges: rawEdges,
          finalEdges: finalEdges,
          retried: step > 0,
        };
      });
    }

    return attempt(0);
  }

  function applyLayoutFromServerPayload(layoutObj, et) {
    state.layout = normalizeLayoutShape(layoutObj);
    buildNodeCatalog();
    var injectedDefaults = applyDefaultConnectionsIfEmpty();
    if (injectedDefaults && !isLayoutMapLocked()) {
      saveLayoutSoon();
    }
    renderAll(injectedDefaults);
    state.lastSavedSignature = et + "|" + JSON.stringify(state.layout);
    refreshLayoutDirtyState();
    updatePersistButtonsEnabled();
  }

  function waitLayoutSaveIdle() {
    return new Promise(function (resolve) {
      function tick() {
        if (!state.saveInFlight) {
          resolve();
          return;
        }
        window.setTimeout(tick, 40);
      }
      tick();
    });
  }

  function saveLayoutExplicit() {
    if (!trimStr(state.entityType)) {
      setStatus("Select an object type first.");
      return Promise.resolve(false);
    }
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = 0;
    }
    setStatus("Saving layout…");
    return waitLayoutSaveIdle().then(function () {
      return saveLayoutNow(false, false);
    });
  }

  function reloadLayoutFromServer() {
    var et = trimStr(state.entityType);
    if (!et) return Promise.resolve(false);
    if (isLayoutDirty()) {
      var go = globalThis.confirm(
        "Discard unsaved layout changes and reload the last saved layout from the server?",
      );
      if (!go) return Promise.resolve(false);
    }
    var fetchForEt = et;
    setStatus("Reloading saved layout…");
    return loadLayoutFromServerAndApply(fetchForEt, 3, "Reloading saved layout").then(function (result) {
      if (trimStr(state.entityType) !== fetchForEt) return false;
      if (!result || !result.ok) {
        if (result && result.reason === "entity-changed") return false;
        setStatus("Could not reload layout after retries.");
        refreshLayoutDirtyState();
        return false;
      }
      var edges = result.finalEdges;
      var suffix = result.retried ? " (after retry)." : ".";
      setStatus(
        edges ? "Reloaded saved layout" + suffix : "Reloaded layout (empty wiring)" + suffix,
      );
      return true;
    });
  }

  function saveLayoutSoon() {
    if (!state.entityType) return;
    if (state.saveTimer) window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(function () {
      state.saveTimer = 0;
      saveLayoutNow(false, false);
    }, 220);
    refreshLayoutDirtyState();
  }

  function saveLayoutNow(keepalive, silent) {
    if (!state.entityType) {
      refreshLayoutDirtyState();
      return Promise.resolve(true);
    }
    if (silent && keepalive && !trimStr(state.lastSavedSignature)) {
      refreshLayoutDirtyState();
      return Promise.resolve(true);
    }
    if (state.saveInFlight) {
      state.savePending = true;
      return Promise.resolve(false);
    }
    var et = state.entityType;
    var sig = et + "|" + JSON.stringify(state.layout);
    if (sig === state.lastSavedSignature) {
      state.savePending = false;
      refreshLayoutDirtyState();
      return Promise.resolve(true);
    }
    state.saveInFlight = true;
    state.savePending = false;
    var url = "/api/designer/data-controls-layout/" + encodeURIComponent(et);
    return fetch(url, {
      method: "PUT",
      credentials: "same-origin",
      keepalive: !!keepalive,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "Ground-Control",
      },
      body: JSON.stringify({ layout: state.layout }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { httpOk: r.ok, status: r.status, j: j };
        });
      })
      .then(function (res) {
        state.saveInFlight = false;
        var j = res.j && typeof res.j === "object" ? res.j : {};
        var ok = !!res.httpOk && j.ok === true;
        if (ok) {
          state.lastSavedSignature = sig;
          if (!silent) setStatus("Layout saved.");
        } else if (!silent) {
          if (res.status === 409) {
            setStatus(
              String(j.detail || "Layout map is locked. Unlock it before saving changes."),
            );
            if (typeof globalThis.gcInvalidateDataControlsLayoutLocksCache === "function") {
              globalThis.gcInvalidateDataControlsLayoutLocksCache();
            }
          } else {
            setStatus("Layout save failed.");
          }
        }
        var stillHere = et === state.entityType;
        var latestSig = stillHere ? et + "|" + JSON.stringify(state.layout) : "";
        var dirty = stillHere && latestSig !== state.lastSavedSignature;
        if (dirty) {
          saveLayoutSoon();
        } else if (state.savePending && stillHere) {
          state.savePending = false;
          return saveLayoutNow(keepalive, silent);
        }
        refreshLayoutDirtyState();
        return ok;
      })
      .catch(function () {
        state.saveInFlight = false;
        if (!silent) setStatus("Layout save failed.");
        var stillHere = et === state.entityType;
        if (stillHere && et + "|" + JSON.stringify(state.layout) !== state.lastSavedSignature) {
          saveLayoutSoon();
        }
        refreshLayoutDirtyState();
        return false;
      });
  }

  function loadLayoutForEntity(entityType) {
    var et = trimStr(entityType);
    state.entityType = et;
    clearSelectedEdges();
    state.showTestValues = false;
    state.testValueHoverEdgeKey = "";
    testButtonRefresh();
    if (resetBtn) resetBtn.disabled = !et;
    loadTestObjectsForEntity();
    if (!et) {
      state.layout = {
        node_positions: {},
        connections: [],
        logic_nodes: [],
        control_add_only: {},
        member_lookup_data_source: {},
        member_lookup_multi: {},
        layout_locked: false,
      };
      state.lastSavedSignature = "";
      renderAll(true);
      updatePersistButtonsEnabled();
      refreshLayoutDirtyState();
      setStatus("Select a cached object type to design layout.");
      return;
    }
    updatePersistButtonsEnabled();
    state.lastSavedSignature = "";
    setStatus("Loading saved layout…");
    var fetchForEt = et;
    loadLayoutFromServerAndApply(fetchForEt, 3, "Loading saved layout").then(function (result) {
      if (trimStr(state.entityType) !== fetchForEt) return;
      if (!result || !result.ok) {
        if (result && result.reason === "entity-changed") return;
        state.layout = {
          node_positions: {},
          connections: [],
          logic_nodes: [],
          control_add_only: {},
          member_lookup_data_source: {},
          member_lookup_multi: {},
          layout_locked: false,
        };
        buildNodeCatalog();
        renderAll(false);
        state.lastSavedSignature = "";
        refreshLayoutDirtyState();
        updatePersistButtonsEnabled();
        setStatus(
          "Could not load layout after retries (network or session). Nothing was written to disk.",
        );
        return;
      }
      if (result.retried) {
        setStatus("Layout ready (loaded after retry).");
      } else {
        setStatus("Layout ready.");
      }
    });
  }

  function captureCatalogState(payload) {
    var d = payload || {};
    state.fields = Array.isArray(d.fields) ? d.fields : [];
    var et = trimStr(d.entity_type);
    if (et !== state.entityType) {
      loadLayoutForEntity(et);
      return;
    }
    loadTestObjectsForEntity();
    renderAll();
    if (state.pendingAutoWireFieldId) {
      var pendingFieldId = state.pendingAutoWireFieldId;
      state.pendingAutoWireFieldId = "";
      if (!isLayoutMapLocked() && replacePairWiresWithDefaults(pendingFieldId)) {
        renderAll();
        saveLayoutSoon();
        setStatus("Control updated and rewired.");
      }
    }
  }

  function removeSelectedEdges() {
    if (isLayoutMapLocked()) {
      setStatus("Layout map is locked. Turn off Layout locked to edit.");
      return;
    }
    var drop = Object.assign({}, state.selectedEdgeKeys);
    var n = Object.keys(drop).length;
    if (!n) return;
    state.layout.connections = state.layout.connections.filter(function (edge) {
      return !drop[edgeKey(edge)];
    });
    clearSelectedEdges();
    drawEdges();
    saveLayoutSoon();
    setStatus(n > 1 ? n + " connections deleted." : "Connection deleted.");
  }

  function keyTargetIsTextField(t) {
    if (!t || !t.tagName) return false;
    var tag = String(t.tagName).toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    try {
      if (t.isContentEditable) return true;
    } catch (e0) {}
    return false;
  }

  function bindEdgeSelectionHotkeys() {
    document.addEventListener("keydown", function (ev) {
      if (!countSelectedEdges()) return;
      if (keyTargetIsTextField(ev.target)) return;
      if (ev.key === "Escape") {
        clearSelectedEdges();
        drawEdges();
        ev.preventDefault();
        return;
      }
      if (ev.key !== "Delete" && ev.key !== "Backspace") return;
      removeSelectedEdges();
    });
  }

  function beginConnectionFromHandle(btn, ev) {
    if (isLayoutMapLocked()) return;
    ev.preventDefault();
    ev.stopPropagation();
    state.pendingEdgeDrag = null;
    state.activeDragConnection = {
      source_node_id: btn.getAttribute("data-node-id"),
      source_handle: btn.getAttribute("data-handle-id"),
    };
    state.tempEdge = {
      source_node_id: state.activeDragConnection.source_node_id,
      source_handle: state.activeDragConnection.source_handle,
      x: 0,
      y: 0,
    };
    updateTempEdgeFromPointer(ev.clientX, ev.clientY);
    drawEdges();
  }

  function updateTempEdgeFromPointer(clientX, clientY) {
    if (!state.tempEdge) return;
    var rootRect = layoutRoot.getBoundingClientRect();
    state.tempEdge.x = clientX - rootRect.left;
    state.tempEdge.y = clientY - rootRect.top;
  }

  function finishConnection(targetHandleBtn) {
    if (!state.activeDragConnection) return;
    if (isLayoutMapLocked()) {
      state.activeDragConnection = null;
      state.tempEdge = null;
      state.draggingEdgeKey = "";
      drawEdges();
      return;
    }
    var wasRetarget = !!state.draggingEdgeKey;
    if (!targetHandleBtn) {
      state.activeDragConnection = null;
      state.tempEdge = null;
      if (wasRetarget) {
        clearSelectedEdges();
        state.draggingEdgeKey = "";
        saveLayoutSoon();
        setStatus("Connection deleted.");
      }
      drawEdges();
      return;
    }
    var edge = {
      source_node_id: state.activeDragConnection.source_node_id,
      source_handle: state.activeDragConnection.source_handle,
      target_node_id: targetHandleBtn.getAttribute("data-node-id"),
      target_handle: targetHandleBtn.getAttribute("data-handle-id"),
    };
    var tup = edgeTupleKey(edge);
    var exists = state.layout.connections.some(function (x) {
      return edgeTupleKey(x) === tup;
    });
    state.activeDragConnection = null;
    state.tempEdge = null;
    state.draggingEdgeKey = "";
    if (!exists) {
      edge.edge_id = genEdgeId();
      state.layout.connections.push(edge);
      setSelectedEdgeKeysFromList([edgeKey(edge)]);
      saveLayoutSoon();
      setStatus(wasRetarget ? "Connection updated." : "Connection added.");
    } else if (wasRetarget) {
      setStatus("Connection updated.");
    }
    drawEdges();
  }

  function beginEdgeRetarget(edgeKeyToMove, ev) {
    if (isLayoutMapLocked()) return;
    var oldEdge = null;
    state.layout.connections = state.layout.connections.filter(function (edge) {
      var k = edgeKey(edge);
      if (k === edgeKeyToMove) {
        oldEdge = edge;
        return false;
      }
      return true;
    });
    if (!oldEdge) return;
    state.pendingEdgeDrag = null;
    state.draggingEdgeKey = edgeKeyToMove;
    clearSelectedEdges();
    state.activeDragConnection = {
      source_node_id: oldEdge.source_node_id,
      source_handle: oldEdge.source_handle,
    };
    state.tempEdge = {
      source_node_id: oldEdge.source_node_id,
      source_handle: oldEdge.source_handle,
      x: 0,
      y: 0,
    };
    updateTempEdgeFromPointer(ev.clientX, ev.clientY);
    drawEdges();
  }

  function beginNodeDrag(nodeEl, ev) {
    if (isLayoutMapLocked()) return;
    if (ev.target.closest(".gc-designer-data-controls-layout__handle")) return;
    if (ev.target.closest(".gc-designer-data-controls-layout__field-drag-handle")) return;
    if (ev.target.closest(".gc-designer-data-controls-layout__det-field")) return;
    if (ev.target.closest(".gc-designer-data-controls-layout__add-only-toggle")) return;
    if (ev.target.closest(".gc-designer-data-controls-layout__panel-ml-multi-toggle")) return;
    var nodeId = nodeEl.getAttribute("data-node-id");
    var node = state.nodeCatalog[nodeId];
    if (!node) return;
    if (node.kind === "field" || node.kind === "logic") return;
    state.dragNode = {
      node_id: nodeId,
      pointer_x: ev.clientX,
      pointer_y: ev.clientY,
      start_x: node.x,
      start_y: node.y,
    };
  }

  function wirePointerLayer() {
    layoutRoot.addEventListener("mousedown", function (ev) {
      if (ev.button === 0) {
        var onHandle =
          ev.target.closest &&
          ev.target.closest(".gc-designer-data-controls-layout__handle");
        var onEdgePath =
          ev.target.closest && ev.target.closest("path[data-edge-key]");
        var onEdgeGrip =
          ev.target.closest && ev.target.closest("circle[data-edge-key]");
        if (!onHandle && !onEdgePath && !onEdgeGrip && countSelectedEdges()) {
          clearSelectedEdges();
          drawEdges();
        }
      }
      var delBtn = ev.target.closest(".gc-designer-data-controls-layout__node-delete");
      if (delBtn) return;
      if (ev.target.closest(".gc-designer-data-controls-layout__add-only-toggle")) return;
      if (ev.target.closest(".gc-designer-data-controls-layout__panel-ml-multi-toggle")) return;
      var fieldDragH = ev.target.closest(".gc-designer-data-controls-layout__field-drag-handle");
      if (fieldDragH && nodesEl.contains(fieldDragH)) {
        beginFieldPanelReorder(ev, fieldDragH);
        return;
      }
      var dragH = ev.target.closest(".gc-designer-data-controls-layout__panel-drag-handle");
      if (dragH && controlsEl.contains(dragH)) {
        beginControlPanelReorder(ev, dragH);
        return;
      }
      var handleBtn = ev.target.closest(".gc-designer-data-controls-layout__handle");
      if (handleBtn) {
        if (!isLayoutMapLocked()) {
          state.connectorPointerDown = {
            btn: handleBtn,
            clientX: ev.clientX,
            clientY: ev.clientY,
            io: trimStr(handleBtn.getAttribute("data-io") || ""),
          };
        }
        return;
      }
      var nodeEl = ev.target.closest(".gc-designer-data-controls-layout__node");
      if (nodeEl && controlsEl.contains(nodeEl)) {
        return;
      }
      if (nodeEl && logicEl.contains(nodeEl)) {
        return;
      }
      if (nodeEl) beginNodeDrag(nodeEl, ev);
    });

    edgesSvg.addEventListener("click", function (ev) {
      var path = ev.target.closest("path[data-edge-key]");
      if (!path) return;
      var ek = trimStr(path.getAttribute("data-edge-key") || "");
      if (!ek) return;
      setSelectedEdgeKeysFromList([ek]);
      drawEdges();
    });

    edgesSvg.addEventListener("mousedown", function (ev) {
      var endHandle = ev.target.closest("circle[data-edge-key]");
      if (!endHandle) return;
      if (isLayoutMapLocked()) return;
      ev.preventDefault();
      ev.stopPropagation();
      state.pendingEdgeDrag = {
        key: endHandle.getAttribute("data-edge-key") || "",
        start_x: ev.clientX,
        start_y: ev.clientY,
      };
    });

    document.addEventListener("mousemove", function (ev) {
      if (state.fieldReorderDrag) {
        applyFieldReorderPointerMove(ev.clientY);
        return;
      }
      if (state.controlReorderDrag) {
        applyControlReorderPointerMove(ev.clientY);
        return;
      }
      if (state.pendingEdgeDrag && !state.activeDragConnection) {
        var pdx = ev.clientX - state.pendingEdgeDrag.start_x;
        var pdy = ev.clientY - state.pendingEdgeDrag.start_y;
        if (Math.sqrt(pdx * pdx + pdy * pdy) >= 4) {
          beginEdgeRetarget(state.pendingEdgeDrag.key, ev);
        }
      }
      if (state.dragNode) {
        var dx = ev.clientX - state.dragNode.pointer_x;
        var dy = ev.clientY - state.dragNode.pointer_y;
        var node = state.nodeCatalog[state.dragNode.node_id];
        if (!node) return;
        node.x = state.dragNode.start_x + dx;
        node.y = state.dragNode.start_y + dy;
        storeNodePosition(node.id, node.x, node.y);
        var root = nodesEl.querySelector(
          '.gc-designer-data-controls-layout__node[data-node-id="' +
            cssEscape(node.id) +
            '"]',
        );
        if (root) {
          root.style.transform = "translate(" + node.x + "px," + node.y + "px)";
        }
        syncLayoutHeights();
        drawEdges();
        return;
      }
      if (state.activeDragConnection) {
        updateTempEdgeFromPointer(ev.clientX, ev.clientY);
        drawEdges();
        return;
      }
      var cpd = state.connectorPointerDown;
      if (cpd && cpd.io === "out") {
        var ddx = ev.clientX - cpd.clientX;
        var ddy = ev.clientY - cpd.clientY;
        if (ddx * ddx + ddy * ddy > 36) {
          beginConnectionFromHandle(cpd.btn, ev);
          state.connectorPointerDown = null;
        }
      }
    });

    document.addEventListener("mouseup", function (ev) {
      if (state.fieldReorderDrag) {
        endFieldPanelReorder();
        return;
      }
      if (state.controlReorderDrag) {
        endControlPanelReorder();
        return;
      }
      if (state.pendingEdgeDrag && !state.activeDragConnection) {
        var pdk = trimStr(state.pendingEdgeDrag.key || "");
        setSelectedEdgeKeysFromList(pdk ? [pdk] : []);
        state.pendingEdgeDrag = null;
        drawEdges();
        return;
      }
      if (state.connectorPointerDown && !state.activeDragConnection) {
        var inh =
          ev.target.closest &&
          ev.target.closest('.gc-designer-data-controls-layout__handle[data-io="in"]');
        var cpd = state.connectorPointerDown;
        if (cpd.io === "out" && inh) {
          state.activeDragConnection = {
            source_node_id: cpd.btn.getAttribute("data-node-id"),
            source_handle: cpd.btn.getAttribute("data-handle-id"),
          };
          finishConnection(inh);
        } else {
          selectEdgesForConnectorHandle(cpd.btn);
          drawEdges();
        }
        state.connectorPointerDown = null;
        return;
      }
      if (state.dragNode) {
        state.dragNode = null;
        saveLayoutSoon();
      }
      if (state.activeDragConnection) {
        var inHandle = ev.target.closest
          ? ev.target.closest(
              '.gc-designer-data-controls-layout__handle[data-io="in"]',
            )
          : null;
        finishConnection(inHandle || null);
      }
    });
  }

  function wireLeftPaneDataEntryTypeSync() {
    function bindLogicCardInteractions(hostEl) {
      if (!hostEl) return;
      hostEl.addEventListener("click", function (ev) {
        var delBtn = ev.target.closest
          ? ev.target.closest(".gc-designer-data-controls-layout__node-delete")
          : null;
        if (!delBtn) return;
        var logicId = delBtn.getAttribute("data-node-id") || "";
        removeLogicNode(logicId);
      });
      hostEl.addEventListener("input", function (ev) {
        if (isLayoutMapLocked()) return;
        var logicIn = ev.target.closest
          ? ev.target.closest(".gc-designer-data-controls-layout__logic-value")
          : null;
        if (!logicIn) return;
        var logicId = logicIn.getAttribute("data-logic-id") || "";
        var side = logicIn.getAttribute("data-value-side") || "";
        if (!logicId || (side !== "true" && side !== "false")) return;
        var list = ensureLogicNodesArray();
        list.forEach(function (item) {
          if (!item || String(item.id || "") !== logicId) return;
          if (side === "true") item.true_value = String(logicIn.value || "");
          else item.false_value = String(logicIn.value || "");
        });
        var node = state.nodeCatalog[logicId];
        if (node && node.kind === "logic") {
          if (side === "true") node.true_value = String(logicIn.value || "");
          else node.false_value = String(logicIn.value || "");
        }
        saveLayoutSoon();
      });
    }

    bindLogicCardInteractions(nodesEl);
    bindLogicCardInteractions(logicEl);

    nodesEl.addEventListener("change", function (ev) {
      var sel = ev.target.closest
        ? ev.target.closest(".gc-designer-data-controls-layout__det-select")
        : null;
      if (!sel) return;
      var fieldId = sel.getAttribute("data-field-id") || "";
      if (!fieldId) return;
      var nextVal = String(sel.value || "");
      state.pendingAutoWireFieldId = fieldId;
      if (typeof globalThis.gcDesignerDataControlsSetFieldDataEntryType === "function") {
        setStatus("Saving data entry type…");
        globalThis.gcDesignerDataControlsSetFieldDataEntryType(fieldId, nextVal)
          .then(function (ok) {
            if (!ok) {
              state.pendingAutoWireFieldId = "";
              setStatus("Could not save data entry type.");
            }
          })
          .catch(function () {
            state.pendingAutoWireFieldId = "";
            setStatus("Could not save data entry type.");
          });
      }
    });
  }

  function wireControlCardToggles() {
    controlsEl.addEventListener("change", function (ev) {
      if (isLayoutMapLocked()) return;
      var inp = ev.target.closest
        ? ev.target.closest(".gc-designer-data-controls-layout__add-only-input")
        : null;
      if (!inp) return;
      var nodeId = trimStr(inp.getAttribute("data-node-id"));
      if (!nodeId || nodeId.indexOf("ctrl:") !== 0) return;
      var map = ensureControlAddOnlyMap();
      if (inp.checked) map[nodeId] = true;
      else delete map[nodeId];
      saveLayoutSoon();
      setStatus("Saving layout…");
    });
  }

  function wireDisplayPanelShowAs() {
    controlsEl.addEventListener("change", function (ev) {
      var inp =
        ev.target &&
        ev.target.closest &&
        ev.target.closest(".gc-designer-data-controls-layout__panel-show-as-input");
      if (!inp || !controlsEl.contains(inp)) return;
      var fid = trimStr(inp.getAttribute("data-field-id"));
      if (!fid) return;
      if (typeof globalThis.gcDesignerDataControlsSetFieldShowAs !== "function") return;
      globalThis.gcDesignerDataControlsSetFieldShowAs(fid, inp.value).then(function (ok) {
        if (!ok) setStatus("Could not save Show as label.");
      });
    });
  }

  function wireDisplayPanelAllowedOptions() {
    controlsEl.addEventListener("change", function (ev) {
      var ta =
        ev.target &&
        ev.target.closest &&
        ev.target.closest(".gc-designer-data-controls-layout__panel-allowed-options-input");
      if (!ta || !controlsEl.contains(ta)) return;
      var fid = trimStr(ta.getAttribute("data-field-id"));
      if (!fid) return;
      if (typeof globalThis.gcDesignerDataControlsSetFieldAllowedOptions !== "function") return;
      globalThis.gcDesignerDataControlsSetFieldAllowedOptions(fid, ta.value).then(function (ok) {
        if (!ok) setStatus("Could not save allowed values.");
      });
    });
  }

  function wireMemberLookupLayoutSourceSelect() {
    controlsEl.addEventListener("change", function (ev) {
      if (isLayoutMapLocked()) return;
      var sel =
        ev.target &&
        ev.target.closest &&
        ev.target.closest(".gc-designer-data-controls-layout__panel-ml-source-select");
      if (!sel || !controlsEl.contains(sel)) return;
      var nodeId = trimStr(sel.getAttribute("data-node-id"));
      if (!nodeId || nodeId.indexOf("ctrl:") !== 0) return;
      var map = ensureMemberLookupDataSourceMap();
      var v = trimStr(sel.value);
      if (v && isValidLayoutEntityTypeToken(v)) map[nodeId] = v;
      else delete map[nodeId];
      saveLayoutSoon();
      setStatus("Saving layout…");
    });
  }

  function wireMemberLookupMultiToggle() {
    controlsEl.addEventListener("change", function (ev) {
      var inp =
        ev.target &&
        ev.target.closest &&
        ev.target.closest(".gc-designer-data-controls-layout__panel-ml-multi-input");
      if (!inp || !controlsEl.contains(inp)) return;
      var nodeId = trimStr(inp.getAttribute("data-node-id"));
      if (!nodeId || nodeId.indexOf("ctrl:") !== 0) {
        var fid = trimStr(inp.getAttribute("data-field-id"));
        if (!fid) return;
        nodeId = "ctrl:" + fid;
      }
      var map = ensureMemberLookupMultiMap();
      map[nodeId] = !!inp.checked;
      saveLayoutSoon();
      setStatus("Saving layout…");
    });
  }

  document.addEventListener("gc-designer-data-controls-catalog-changed", function (ev) {
    captureCatalogState(ev && ev.detail ? ev.detail : null);
  });

  document.querySelectorAll(".gc-dc-layout-save").forEach(function (btn) {
    btn.addEventListener("click", function () {
      saveLayoutExplicit();
    });
  });
  document.querySelectorAll(".gc-dc-layout-reload").forEach(function (btn) {
    btn.addEventListener("click", function () {
      reloadLayoutFromServer();
    });
  });

  if (lockLayoutCb) {
    lockLayoutCb.addEventListener("change", function () {
      var want = !!lockLayoutCb.checked;
      var et = trimStr(state.entityType);
      if (!et) {
        lockLayoutCb.checked = false;
        return;
      }
      if (want) {
        state.layout.layout_locked = true;
        refreshLayoutDirtyState();
        updatePersistButtonsEnabled();
        updateLayoutRootLockedClass();
        saveLayoutExplicit().then(function (ok) {
          if (!ok) {
            state.layout.layout_locked = false;
            lockLayoutCb.checked = false;
            updateLayoutRootLockedClass();
            updatePersistButtonsEnabled();
            setStatus("Could not save locked layout. Fix errors or reload, then try again.");
            return;
          }
          if (typeof globalThis.gcInvalidateDataControlsLayoutLocksCache === "function") {
            globalThis.gcInvalidateDataControlsLayoutLocksCache();
          }
          setStatus("Layout locked and saved.");
        });
        return;
      }
      patchDesignerLayoutLocked(false).then(function (ok2) {
        if (!ok2) {
          lockLayoutCb.checked = true;
          state.layout.layout_locked = true;
          updatePersistButtonsEnabled();
          updateLayoutRootLockedClass();
          setStatus("Could not unlock layout (network or session).");
          return;
        }
        setStatus("Layout unlocked. You can edit wiring again.");
      });
    });
  }

  globalThis.gcDesignerDcLayoutIsDirty = isLayoutDirty;
  globalThis.gcDesignerDcLayoutGetEntityType = function () {
    return state.entityType;
  };

  wireTabs();
  wirePointerLayer();
  wireLeftPaneDataEntryTypeSync();
  wireControlCardToggles();
  wireDisplayPanelShowAs();
  wireDisplayPanelAllowedOptions();
  wireMemberLookupLayoutSourceSelect();
  wireMemberLookupMultiToggle();
  wireTestPickerUi();
  wireEdgeTestValueHover();
  bindEdgeSelectionHotkeys();
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (!state.entityType) return;
      resetLayoutToDefaults();
    });
    resetBtn.disabled = true;
  }
  (function wireLogicToolboxAddButtons() {
    var host =
      layoutRoot && layoutRoot.querySelector
        ? layoutRoot.querySelector(".gc-designer-data-controls-layout__logic-toolbox")
        : null;
    if (!host) return;
    host.addEventListener("click", function (ev) {
      var t = ev.target;
      var btn = t && t.closest ? t.closest("button.gc-designer-data-controls-layout__logic-toolbox-btn") : null;
      if (!btn || !host.contains(btn)) return;
      var bid = trimStr(btn.id);
      if (bid === "gc-designer-data-controls-layout-add-and") {
        addLogicNode("and", "gate");
        return;
      }
      if (bid === "gc-designer-data-controls-layout-add-or") {
        addLogicNode("or", "gate");
        return;
      }
      if (bid === "gc-designer-data-controls-layout-add-not") {
        addLogicNode("not", "gate");
        return;
      }
      if (bid === "gc-designer-data-controls-layout-add-if-value") {
        addLogicNode("and", "if_value");
        return;
      }
      if (bid === "gc-designer-data-controls-layout-add-csv-array") {
        addLogicNode("and", "csv_array");
        return;
      }
    });
  })();
  setActiveTab("catalog");

  if (window.__gcDesignerDataControlsCatalogState) {
    captureCatalogState(window.__gcDesignerDataControlsCatalogState);
  } else {
    setStatus("Select a cached object type to design layout.");
  }

  window.addEventListener("blur", function () {
    if (state.fieldReorderDrag) endFieldPanelReorder();
    if (state.controlReorderDrag) endControlPanelReorder();
  });

  window.addEventListener("pagehide", function () {
    if (state.fieldReorderDrag) endFieldPanelReorder();
    if (state.controlReorderDrag) endControlPanelReorder();
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = 0;
    }
    saveLayoutNow(true, true);
  });
  window.addEventListener("beforeunload", function (e) {
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = 0;
    }
    if (isLayoutDirty()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "hidden") return;
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = 0;
    }
    saveLayoutNow(true, true);
  });
  window.addEventListener("resize", drawEdges);
})();
