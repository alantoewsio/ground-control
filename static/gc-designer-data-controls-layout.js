(function () {
  "use strict";

  var tabButtons = document.querySelectorAll("[data-gc-dc-tab]");
  var tabPanels = document.querySelectorAll("[data-gc-dc-panel]");
  var layoutRoot = document.getElementById("gc-designer-data-controls-layout-root");
  var canvasEl = document.getElementById("gc-designer-data-controls-layout-canvas");
  var nodesEl = document.getElementById("gc-designer-data-controls-layout-nodes");
  var edgesSvg = document.getElementById("gc-designer-data-controls-layout-edges");
  var controlsEl = document.getElementById("gc-designer-data-controls-layout-controls");
  var statusEl = document.getElementById("gc-designer-data-controls-layout-status");
  var resetBtn = document.getElementById("gc-designer-data-controls-layout-reset");
  var testPickerEl = document.getElementById("gc-designer-data-controls-layout-test-picker");
  var testTriggerEl = document.getElementById("gc-designer-data-controls-layout-test-trigger");
  var testPanelEl = document.getElementById("gc-designer-data-controls-layout-test-panel");
  var testSearchEl = document.getElementById("gc-designer-data-controls-layout-test-search");
  var testOptionsEl = document.getElementById("gc-designer-data-controls-layout-test-options");
  var testBtn = document.getElementById("gc-designer-data-controls-layout-test-btn");
  var addAndBtn = document.getElementById("gc-designer-data-controls-layout-add-and");
  var addOrBtn = document.getElementById("gc-designer-data-controls-layout-add-or");
  var addNotBtn = document.getElementById("gc-designer-data-controls-layout-add-not");
  var addIfValueBtn = document.getElementById("gc-designer-data-controls-layout-add-if-value");
  if (!layoutRoot || !canvasEl || !nodesEl || !edgesSvg || !controlsEl) return;
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
    layout: { node_positions: {}, connections: [], logic_nodes: [], control_add_only: {} },
    nodeCatalog: {},
    selectedEdgeKey: "",
    activeDragConnection: null,
    tempEdge: null,
    draggingEdgeKey: "",
    pendingEdgeDrag: null,
    pendingAutoWireFieldId: "",
    testObjects: [],
    selectedTestObjectName: "",
    showTestValues: false,
    testValueByEdgeKey: {},
    lastSavedSignature: "",
    dragNode: null,
    saveTimer: 0,
    loadSeq: 0,
    saveSeq: 0,
  };

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

  function edgeKey(edge) {
    return [
      edge.source_node_id,
      edge.source_handle,
      edge.target_node_id,
      edge.target_handle,
    ].join("|");
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
        setActiveTab(btn.getAttribute("data-gc-dc-tab"));
      });
    });
  }

  function controlHandleSpec(field) {
    var det = trimStr(field.data_entry_type).toLowerCase();
    if (det === "ip-address" || det === "ip-ipv4" || det === "ip-ipv6") {
      return {
        inputs: ["address", "subnet", "netmask", "ipfamily", "visible"],
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

  function defaultControlInputForField(field) {
    var det = trimStr(field.data_entry_type).toLowerCase();
    if (det === "ip-address" || det === "ip-ipv4" || det === "ip-ipv6") return "address";
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
    if (det === "ip-address" || det === "ip-ipv4" || det === "ip-ipv6") return "ip_address";
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
    return t === "if_value" ? "if_value" : "gate";
  }

  function ensureLogicNodesArray() {
    if (!state.layout || typeof state.layout !== "object") {
      state.layout = { node_positions: {}, connections: [], logic_nodes: [], control_add_only: {} };
    }
    if (!Array.isArray(state.layout.logic_nodes)) state.layout.logic_nodes = [];
    return state.layout.logic_nodes;
  }

  function nextLogicNodeId(op, kind) {
    var list = ensureLogicNodesArray();
    var nodeKind = normalizeLogicKind(kind);
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

  function ensureControlAddOnlyMap() {
    if (!state.layout || typeof state.layout !== "object") {
      state.layout = { node_positions: {}, connections: [], logic_nodes: [], control_add_only: {} };
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

  function isControlAddOnly(nodeId) {
    var map = ensureControlAddOnlyMap();
    return !!map[String(nodeId || "")];
  }

  function isSkippableDataEntryType(detRaw) {
    var det = trimStr(detRaw).toLowerCase();
    return !det || det === "hidden" || det === "none";
  }

  function buildNodeCatalog() {
    var out = {};
    var fieldY = 24;
    state.fields.forEach(function (f) {
      var y = fieldY;
      var fieldId = "field:" + String(f.id || "");
      var fieldLabel = trimStr(f.show_as) || trimStr(f.property_name) || "Field";
      out[fieldId] = {
        id: fieldId,
        field_id: String(f.id || ""),
        data_entry_type: trimStr(f.data_entry_type),
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
      out[ctrlId] = {
        id: ctrlId,
        field_id: String(f.id || ""),
        data_entry_type: det,
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
        source_node_id: ctrlNodeId,
        source_handle: ctrlOut,
        target_node_id: fieldNodeId,
        target_handle: "save_value",
      });
    }
    return edges;
  }

  function replacePairWiresWithDefaults(fieldId) {
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
    state.layout = { node_positions: {}, connections: [], logic_nodes: [], control_add_only: {} };
    buildNodeCatalog();
    state.layout.connections = buildDefaultConnections();
    state.selectedEdgeKey = "";
    renderAll(true);
    saveLayoutSoon();
    setStatus("Layout reset to defaults.");
  }

  function nodeHtml(node) {
    function handlesHtml(list, io) {
      return list
        .map(function (h) {
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
        })
        .join("");
    }
    if (node.kind === "field") {
      return (
        '<div class="gc-designer-data-controls-layout__node gc-designer-data-controls-layout__node--field" data-node-id="' +
        esc(node.id) +
        '">' +
        '<div class="gc-designer-data-controls-layout__node-head">' +
        '<div class="gc-designer-data-controls-layout__node-head-main">' +
        '<span class="mono">' +
        esc(node.label) +
        "</span>" +
        dataEntryTypeSelectHtml(node) +
        "</div>" +
        "</div>" +
        '<div class="gc-designer-data-controls-layout__node-body gc-designer-data-controls-layout__node-body--field">' +
        '<div class="gc-designer-data-controls-layout__io gc-designer-data-controls-layout__io--field-right">' +
        handlesHtml(["loaded_value"], "out") +
        handlesHtml(["save_value"], "in") +
        "</div>" +
        "</div>" +
        "</div>"
      );
    }
    if (node.kind === "logic") {
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
        '<div class="gc-designer-data-controls-layout__node gc-designer-data-controls-layout__node--field gc-designer-data-controls-layout__node--logic gc-designer-data-controls-layout__node--addable" data-node-id="' +
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
      '<path d="M0,0 L8,3 L0,6 Z" fill="#f59e0b"></path>' +
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

  function edgePath(a, b) {
    var c1 = a.x + 90;
    var c2 = b.x - 90;
    return (
      "M " +
      a.x.toFixed(1) +
      " " +
      a.y.toFixed(1) +
      " C " +
      c1.toFixed(1) +
      " " +
      a.y.toFixed(1) +
      ", " +
      c2.toFixed(1) +
      " " +
      b.y.toFixed(1) +
      ", " +
      b.x.toFixed(1) +
      " " +
      b.y.toFixed(1)
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

  function fieldByIdMap() {
    var out = {};
    state.fields.forEach(function (f) {
      out[String(f.id || "")] = f;
    });
    return out;
  }

  function objectEditCatalogRowsByProperty() {
    var host = document.getElementById("gc-designer-object-edit-catalog-fields");
    var out = {};
    if (!host) return out;
    host.querySelectorAll(".gc-designer-object-edit-catalog-row").forEach(function (row) {
      var p = trimStr(row.getAttribute("data-gc-catalog-property"));
      if (p) out[p] = row;
    });
    return out;
  }

  function applyFlowToObjectEditFlyout(flowState) {
    var fs = flowState || {};
    var inputs = fs.inputsByControl || {};
    var outs = fs.outputs || {};
    var visMap = fs.visibilityByControl || {};
    var fieldMap = fieldByIdMap();
    var rowsByProp = objectEditCatalogRowsByProperty();
    Object.keys(fieldMap).forEach(function (fid) {
      var f = fieldMap[fid];
      var prop = trimStr(f.property_name);
      if (!prop) return;
      var row = rowsByProp[prop];
      if (!row) return;
      var ctrlId = "ctrl:" + fid;
      var visible = Object.prototype.hasOwnProperty.call(visMap, ctrlId)
        ? !!visMap[ctrlId]
        : true;
      row.hidden = !visible;
      row.style.display = visible ? "" : "none";
      if (!visible) return;

      var inValue = inputs[ctrlId + "|value"];
      var inSelected = inputs[ctrlId + "|selected"];
      var inAddress = inputs[ctrlId + "|address"];
      var inIpFamily = inputs[ctrlId + "|ipfamily"];

      var selector = row.querySelector("[data-gc-option-selector]");
      if (selector && typeof globalThis.gcOptionSelectorSetSelection === "function") {
        if (inSelected != null && String(inSelected) !== "") {
          globalThis.gcOptionSelectorSetSelection(selector, String(inSelected), NaN);
          if (typeof globalThis.gcOptionSelectorSyncLayout === "function") {
            globalThis.gcOptionSelectorSyncLayout(selector);
          }
        }
      }

      var detLower = trimStr(f.data_entry_type).toLowerCase();
      var isIpDet =
        detLower === "ip-address" || detLower === "ip-ipv4" || detLower === "ip-ipv6";
      var ipInput = row.querySelector("input.gc-ip-field__input");
      if (ipInput && !row.querySelector("[data-gc-ip-list]") && isIpDet) {
        var ipLine = "";
        if (inAddress != null && String(inAddress) !== "") ipLine = String(inAddress);
        else if (inValue != null && String(inValue) !== "") ipLine = String(inValue);
        else {
          var ipO = outs[ctrlId + "|ip_address"];
          var subO = outs[ctrlId + "|subnet"] || outs[ctrlId + "|netmask"];
          if (ipO != null && String(ipO) !== "") {
            ipLine = subO != null && String(subO) !== "" ? String(ipO) + "/" + String(subO) : String(ipO);
          }
        }
        if (ipLine !== "") {
          ipInput.value = ipLine;
          try {
            ipInput.dispatchEvent(new Event("input", { bubbles: true }));
            ipInput.dispatchEvent(new Event("blur"));
          } catch (e) {}
        }
      }

      var textInput = row.querySelector(
        "input.settings-form__input:not(.gc-ip-field__input):not([type='hidden'])",
      );
      if (textInput && inValue != null && String(inValue) !== "") {
        textInput.value = String(inValue);
        try {
          textInput.dispatchEvent(new Event("input", { bubbles: true }));
        } catch (e1) {}
      }

      var txtArea = row.querySelector("textarea.settings-form__input");
      if (txtArea && inValue != null && String(inValue) !== "") {
        txtArea.value = String(inValue);
      }

      if (inIpFamily != null && String(inIpFamily) !== "") {
        var det = trimStr(f.data_entry_type);
        var props = parseJsonObject(f.data_entry_properties);
        props.IPFamily = String(inIpFamily);
        if (typeof globalThis.gcDesignerControlsSetPropertiesFor === "function") {
          try {
            globalThis.gcDesignerControlsSetPropertiesFor(
              det || "ip-address",
              JSON.stringify(props),
              row,
            );
          } catch (e2) {}
        }
      }
    });
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
      var flow = computeFlowStateForTest(row);
      setTimeout(function () {
        applyFlowToObjectEditFlyout(flow);
      }, 220);
      setTimeout(function () {
        applyFlowToObjectEditFlyout(flow);
      }, 460);
    }
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
    state.layout.connections.forEach(function (edge) {
      var a = handleCenter(edge.source_node_id, edge.source_handle, "out");
      var b = handleCenter(edge.target_node_id, edge.target_handle, "in");
      if (!a || !b) return;
      var key = edgeKey(edge);
      var side = sourceSideForNode(edge.source_node_id);
      var sel = key === state.selectedEdgeKey;
      var cls =
        "gc-designer-data-controls-layout__edge gc-designer-data-controls-layout__edge--from-" +
        side +
        (sel ? " is-selected" : "");
      var markerId = sel
        ? "gc-dc-edge-arrow-selected"
        : side === "right"
          ? "gc-dc-edge-arrow-right"
          : "gc-dc-edge-arrow-left";
      html += drawPath(edgePath(a, b), cls, key, markerId);
      html += drawEdgeHandle(b.x.toFixed(1), b.y.toFixed(1), key, side, sel);
      if (state.showTestValues) {
        var lbl = edgeValueLabelText(edge, outputValues);
        if (lbl) {
          var mid = lineLabelAt(a, b);
          html +=
            '<text class="gc-designer-data-controls-layout__edge-value" x="' +
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
        html += drawPath(
          edgePath(ts, { x: state.tempEdge.x, y: state.tempEdge.y }),
          "gc-designer-data-controls-layout__edge gc-designer-data-controls-layout__edge--from-" +
            tempSide +
            " gc-designer-data-controls-layout__edge--temp",
          "",
          tempMarker,
        );
      }
    }
    edgesSvg.innerHTML = html;
  }

  function renderCanvasNodes() {
    var html = "";
    Object.keys(state.nodeCatalog).forEach(function (id) {
      var node = state.nodeCatalog[id];
      if (node.kind !== "field" && node.kind !== "logic") return;
      html += nodeHtml(node);
    });
    nodesEl.innerHTML = html;
    Object.keys(state.nodeCatalog).forEach(function (id) {
      var node = state.nodeCatalog[id];
      if (node.kind !== "field" && node.kind !== "logic") return;
      var el = nodesEl.querySelector(
        '.gc-designer-data-controls-layout__node[data-node-id="' + cssEscape(id) + '"]',
      );
      if (!el) return;
      el.style.transform = "translate(" + node.x + "px," + node.y + "px)";
    });
  }

  function renderControlsPanel() {
    var html = "";
    Object.keys(state.nodeCatalog).forEach(function (id) {
      var node = state.nodeCatalog[id];
      if (node.kind !== "control") return;
      html += nodeHtml(node);
    });
    if (!html) {
      controlsEl.innerHTML =
        '<p class="muted">No controls mapped yet. Choose a data entry type in Field catalog.</p>';
      return;
    }
    controlsEl.innerHTML = html;
    Object.keys(state.nodeCatalog).forEach(function (id) {
      var node = state.nodeCatalog[id];
      if (node.kind !== "control") return;
      var el = controlsEl.querySelector(
        '.gc-designer-data-controls-layout__node[data-node-id="' + cssEscape(id) + '"]',
      );
      if (!el) return;
      el.style.transform = "translate(" + node.x + "px," + node.y + "px)";
    });
  }

  function applyNodeTransformsForKind(kind) {
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
    nodesEl
      .querySelectorAll(".gc-designer-data-controls-layout__node[data-node-id]")
      .forEach(function (el) {
        var id = el.getAttribute("data-node-id") || "";
        var node = state.nodeCatalog[id];
        if (!node) return;
        var h = el.offsetHeight || 96;
        maxCanvas = Math.max(maxCanvas, (Number(node.y) || 0) + h + 24);
      });
    controlsEl
      .querySelectorAll(".gc-designer-data-controls-layout__node[data-node-id]")
      .forEach(function (el) {
        var id = el.getAttribute("data-node-id") || "";
        var node = state.nodeCatalog[id];
        if (!node) return;
        var h = el.offsetHeight || 96;
        maxPanel = Math.max(maxPanel, (Number(node.y) || 0) + h + 24);
      });
    canvasEl.style.height = String(maxCanvas) + "px";
    nodesEl.style.height = String(maxCanvas) + "px";
    controlsEl.style.minHeight = String(maxPanel) + "px";
  }

  function autoArrangeKindNoOverlap(kind) {
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

  function lineLabelAt(a, b) {
    var c1x = a.x + 90;
    var c1y = a.y;
    var c2x = b.x - 90;
    var c2y = b.y;
    var t = 0.5;
    var omt = 1 - t;
    return {
      x:
        omt * omt * omt * a.x +
        3 * omt * omt * t * c1x +
        3 * omt * t * t * c2x +
        t * t * t * b.x,
      y:
        omt * omt * omt * a.y +
        3 * omt * omt * t * c1y +
        3 * omt * t * t * c2y +
        t * t * t * b.y,
    };
  }

  function edgeValueLabelText(edge, outputValues) {
    var key = edge.source_node_id + "|" + edge.source_handle;
    var v = outputValues[key];
    if (v == null) return "";
    var s = String(v);
    return s.length > 40 ? s.slice(0, 37) + "..." : s;
  }

  function testButtonRefresh() {
    if (!testBtn) return;
    var hasObject = !!trimStr(state.selectedTestObjectName);
    testBtn.disabled = !hasObject;
    testBtn.textContent = state.showTestValues
      ? "Hide test values"
      : "Test connections";
  }

  function closeTestPanel() {
    if (!testPanelEl || !testTriggerEl) return;
    testPanelEl.hidden = true;
    testTriggerEl.setAttribute("aria-expanded", "false");
  }

  function setSelectedTestObject(name) {
    state.selectedTestObjectName = trimStr(name);
    if (testTriggerEl) {
      testTriggerEl.textContent = state.selectedTestObjectName || "Select test object…";
    }
    if (!state.selectedTestObjectName) state.showTestValues = false;
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
    if (!testPickerEl || !testTriggerEl || !testPanelEl || !testOptionsEl || !testBtn) return;
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
    testBtn.addEventListener("click", function () {
      if (!state.selectedTestObjectName) return;
      state.showTestValues = !state.showTestValues;
      testButtonRefresh();
      drawEdges();
      openObjectEditFlyoutForSelectedTest();
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

  function renderAll(autoArrangeOnLoad) {
    buildNodeCatalog();
    pruneControlAddOnlyMap();
    cleanConnections();
    renderCanvasNodes();
    renderControlsPanel();
    if (autoArrangeOnLoad) {
      autoArrangeNoOverlap();
    }
    syncLayoutHeights();
    drawEdges();
  }

  function normalizeLayoutShape(layout) {
    var src = layout && typeof layout === "object" ? layout : {};
    var out = { node_positions: {}, connections: [], logic_nodes: [], control_add_only: {} };
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
        out.connections.push({
          source_node_id: trimStr(edge.source_node_id),
          source_handle: trimStr(edge.source_handle),
          target_node_id: trimStr(edge.target_node_id),
          target_handle: trimStr(edge.target_handle),
        });
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
    return out;
  }

  function addLogicNode(op, kind) {
    if (!state.entityType) return;
    var logicNodes = ensureLogicNodesArray();
    var nodeKind = normalizeLogicKind(kind);
    var nodeOp = normalizeLogicOp(op);
    var id = nextLogicNodeId(nodeOp, nodeKind);
    var maxY = 24;
    Object.keys(state.nodeCatalog).forEach(function (nodeId) {
      var node = state.nodeCatalog[nodeId];
      if (!node || (node.kind !== "field" && node.kind !== "logic")) return;
      maxY = Math.max(maxY, (Number(node.y) || 0) + 120);
    });
    logicNodes.push({
      id: id,
      kind: nodeKind,
      op: nodeOp,
      true_value: "",
      false_value: "",
    });
    state.layout.node_positions[id] = { x: 28, y: maxY };
    buildNodeCatalog();
    renderAll();
    saveLayoutSoon();
    if (nodeKind === "if_value") {
      setStatus("Added Value block.");
      return;
    }
    setStatus(
      "Added " + (nodeOp === "or" ? "OR" : nodeOp === "not" ? "NOT" : "AND") + " block.",
    );
  }

  function removeLogicNode(logicId) {
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
    if (state.selectedEdgeKey && state.selectedEdgeKey.indexOf(id + "|") === 0) {
      state.selectedEdgeKey = "";
    }
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

  function saveLayoutSoon() {
    if (!state.entityType) return;
    if (state.saveTimer) window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(function () {
      state.saveTimer = 0;
      saveLayoutNow(false, false);
    }, 220);
  }

  function saveLayoutNow(keepalive, silent) {
    if (!state.entityType) return;
    var sig = state.entityType + "|" + JSON.stringify(state.layout);
    if (sig === state.lastSavedSignature) return;
    var seq = ++state.saveSeq;
    var url =
      "/api/designer/data-controls-layout/" + encodeURIComponent(state.entityType);
    fetch(url, {
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
            return { ok: r.ok, j: j };
          });
        })
        .then(function (res) {
          if (seq !== state.saveSeq) return;
          if (!res.ok || !res.j || !res.j.ok) {
            if (!silent) setStatus("Layout autosave failed.");
            return;
          }
          state.lastSavedSignature = sig;
          if (!silent) setStatus("Layout saved.");
        })
        .catch(function () {
          if (seq === state.saveSeq && !silent) setStatus("Layout autosave failed.");
        });
  }

  function loadLayoutForEntity(entityType) {
    var et = trimStr(entityType);
    state.entityType = et;
    state.selectedEdgeKey = "";
    state.showTestValues = false;
    testButtonRefresh();
    if (resetBtn) resetBtn.disabled = !et;
    loadTestObjectsForEntity();
    if (!et) {
      state.layout = { node_positions: {}, connections: [], logic_nodes: [], control_add_only: {} };
      renderAll(true);
      setStatus("Select a cached object type to design layout.");
      return;
    }
    setStatus("Loading saved layout…");
    var seq = ++state.loadSeq;
    fetch("/api/designer/data-controls-layout/" + encodeURIComponent(et), {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        if (seq !== state.loadSeq) return;
        if (!res.ok || !res.j || !res.j.ok) {
          state.layout = {
            node_positions: {},
            connections: [],
            logic_nodes: [],
            control_add_only: {},
          };
          buildNodeCatalog();
          applyDefaultConnectionsIfEmpty();
          renderAll(true);
          saveLayoutSoon();
          setStatus("No saved layout found; default wiring created.");
          return;
        }
        state.layout = normalizeLayoutShape(res.j.layout);
        buildNodeCatalog();
        if (applyDefaultConnectionsIfEmpty()) {
          saveLayoutSoon();
        }
        renderAll(true);
        setStatus("Layout ready.");
      })
      .catch(function () {
        if (seq !== state.loadSeq) return;
        state.layout = {
          node_positions: {},
          connections: [],
          logic_nodes: [],
          control_add_only: {},
        };
        buildNodeCatalog();
        applyDefaultConnectionsIfEmpty();
        renderAll(true);
        saveLayoutSoon();
        setStatus("Default wiring created.");
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
      if (replacePairWiresWithDefaults(pendingFieldId)) {
        renderAll();
        saveLayoutSoon();
        setStatus("Control updated and rewired.");
      }
    }
  }

  function removeSelectedEdge() {
    if (!state.selectedEdgeKey) return;
    state.layout.connections = state.layout.connections.filter(function (edge) {
      return edgeKey(edge) !== state.selectedEdgeKey;
    });
    state.selectedEdgeKey = "";
    drawEdges();
    saveLayoutSoon();
    setStatus("Connection deleted.");
  }

  function bindDeleteHotkey() {
    document.addEventListener("keydown", function (ev) {
      if (!state.selectedEdgeKey) return;
      if (ev.key !== "Delete" && ev.key !== "Backspace") return;
      removeSelectedEdge();
    });
  }

  function beginConnectionFromHandle(btn, ev) {
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
    var wasRetarget = !!state.draggingEdgeKey;
    if (!targetHandleBtn) {
      state.activeDragConnection = null;
      state.tempEdge = null;
      if (wasRetarget) {
        state.selectedEdgeKey = "";
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
    var key = edgeKey(edge);
    var exists = state.layout.connections.some(function (x) {
      return edgeKey(x) === key;
    });
    state.activeDragConnection = null;
    state.tempEdge = null;
    state.draggingEdgeKey = "";
    if (!exists) {
      state.layout.connections.push(edge);
      state.selectedEdgeKey = key;
      saveLayoutSoon();
      setStatus(wasRetarget ? "Connection updated." : "Connection added.");
    } else if (wasRetarget) {
      setStatus("Connection updated.");
    }
    drawEdges();
  }

  function beginEdgeRetarget(edgeKeyToMove, ev) {
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
    state.selectedEdgeKey = "";
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
    if (ev.target.closest(".gc-designer-data-controls-layout__handle")) return;
    if (ev.target.closest(".gc-designer-data-controls-layout__det-field")) return;
    if (ev.target.closest(".gc-designer-data-controls-layout__add-only-toggle")) return;
    var nodeId = nodeEl.getAttribute("data-node-id");
    var node = state.nodeCatalog[nodeId];
    if (!node) return;
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
      var delBtn = ev.target.closest(".gc-designer-data-controls-layout__node-delete");
      if (delBtn) return;
      if (ev.target.closest(".gc-designer-data-controls-layout__add-only-toggle")) return;
      var handleBtn = ev.target.closest(".gc-designer-data-controls-layout__handle");
      if (handleBtn && handleBtn.getAttribute("data-io") === "out") {
        beginConnectionFromHandle(handleBtn, ev);
        return;
      }
      var nodeEl = ev.target.closest(".gc-designer-data-controls-layout__node");
      if (nodeEl) beginNodeDrag(nodeEl, ev);
    });

    edgesSvg.addEventListener("click", function (ev) {
      var path = ev.target.closest("path[data-edge-key]");
      if (!path) return;
      state.selectedEdgeKey = path.getAttribute("data-edge-key") || "";
      drawEdges();
    });

    edgesSvg.addEventListener("mousedown", function (ev) {
      var endHandle = ev.target.closest("circle[data-edge-key]");
      if (!endHandle) return;
      ev.preventDefault();
      ev.stopPropagation();
      state.pendingEdgeDrag = {
        key: endHandle.getAttribute("data-edge-key") || "",
        start_x: ev.clientX,
        start_y: ev.clientY,
      };
    });

    document.addEventListener("mousemove", function (ev) {
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
        var root = layoutRoot.querySelector(
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
      }
    });

    document.addEventListener("mouseup", function (ev) {
      if (state.pendingEdgeDrag && !state.activeDragConnection) {
        state.selectedEdgeKey = state.pendingEdgeDrag.key;
        state.pendingEdgeDrag = null;
        drawEdges();
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
    nodesEl.addEventListener("click", function (ev) {
      var delBtn = ev.target.closest
        ? ev.target.closest(".gc-designer-data-controls-layout__node-delete")
        : null;
      if (!delBtn) return;
      var logicId = delBtn.getAttribute("data-node-id") || "";
      removeLogicNode(logicId);
    });
    nodesEl.addEventListener("input", function (ev) {
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

  document.addEventListener("gc-designer-data-controls-catalog-changed", function (ev) {
    captureCatalogState(ev && ev.detail ? ev.detail : null);
  });

  wireTabs();
  wirePointerLayer();
  wireLeftPaneDataEntryTypeSync();
  wireControlCardToggles();
  wireTestPickerUi();
  bindDeleteHotkey();
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (!state.entityType) return;
      resetLayoutToDefaults();
    });
    resetBtn.disabled = true;
  }
  if (addAndBtn) {
    addAndBtn.addEventListener("click", function () {
      addLogicNode("and", "gate");
    });
  }
  if (addOrBtn) {
    addOrBtn.addEventListener("click", function () {
      addLogicNode("or", "gate");
    });
  }
  if (addNotBtn) {
    addNotBtn.addEventListener("click", function () {
      addLogicNode("not", "gate");
    });
  }
  if (addIfValueBtn) {
    addIfValueBtn.addEventListener("click", function () {
      addLogicNode("and", "if_value");
    });
  }
  setActiveTab("catalog");

  if (window.__gcDesignerDataControlsCatalogState) {
    captureCatalogState(window.__gcDesignerDataControlsCatalogState);
  } else {
    setStatus("Select a cached object type to design layout.");
  }

  window.addEventListener("pagehide", function () {
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = 0;
    }
    saveLayoutNow(true, true);
  });
  window.addEventListener("beforeunload", function () {
    if (state.saveTimer) {
      window.clearTimeout(state.saveTimer);
      state.saveTimer = 0;
    }
    saveLayoutNow(true, true);
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
