/**
 * Evaluates Designer · Data Controls · Layout wiring for the production object-edit flyout:
 * field order, visibility (logic + gates), initial control values from row data, and save payloads.
 * Mirrors static/gc-designer-data-controls-layout.js flow semantics without the canvas DOM.
 */
(function () {
  "use strict";

  function trimStr(x) {
    return String(x == null ? "" : x).replace(/^\s+|\s+$/g, "");
  }

  /** Designer "(None)" and unset types: no control node and no flyout row. */
  function isSkippableDataEntryType(detRaw) {
    var det = trimStr(detRaw).toLowerCase();
    return !det || det === "hidden" || det === "none";
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

  function slug(s) {
    return trimStr(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "value";
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

  function buildDefaultConnections(fields, nodeCatalog) {
    var edges = [];
    fields.forEach(function (f) {
      var fieldId = "field:" + String(f.id || "");
      var ctrlId = "ctrl:" + String(f.id || "");
      var fieldNode = nodeCatalog[fieldId];
      var ctrlNode = nodeCatalog[ctrlId];
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

  function normalizeLayout(layout) {
    var L = layout && typeof layout === "object" ? layout : {};
    return {
      node_positions: L.node_positions && typeof L.node_positions === "object" ? L.node_positions : {},
      connections: Array.isArray(L.connections) ? L.connections : [],
      logic_nodes: Array.isArray(L.logic_nodes) ? L.logic_nodes : [],
      control_add_only:
        L.control_add_only &&
        typeof L.control_add_only === "object" &&
        !Array.isArray(L.control_add_only)
          ? L.control_add_only
          : {},
    };
  }

  function buildNodeCatalog(fields, layout) {
    var L = normalizeLayout(layout);
    var out = {};
    var fieldY = 24;
    (fields || []).forEach(function (f) {
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
    L.logic_nodes.forEach(function (item, idx) {
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
          nodeKind === "if_value" ? ["input"] : op === "not" ? ["input"] : ["input_a", "input_b"],
        outputs: nodeKind === "if_value" ? ["value"] : ["gate"],
        true_value: trimStr(item.true_value),
        false_value: trimStr(item.false_value),
        x: 28,
        y: 24 + ((fields || []).length + idx) * 94,
      };
    });
    Object.keys(out).forEach(function (id) {
      var p = L.node_positions[id];
      if (!p || typeof p !== "object") return;
      out[id].x = Number(p.x) || 0;
      out[id].y = Number(p.y) || 0;
    });
    return out;
  }

  function effectiveConnections(layoutNorm, fields, nodeCatalog) {
    var con = layoutNorm.connections.slice();
    if (!con.length) return buildDefaultConnections(fields, nodeCatalog);
    return con;
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

  function fieldIdsParticipating(connections, fields) {
    var idSet = {};
    connections.forEach(function (edge) {
      [edge.source_node_id, edge.target_node_id].forEach(function (nid) {
        var m = /^(?:field|ctrl):(\d+)$/.exec(String(nid || ""));
        if (m) idSet[m[1]] = true;
      });
    });
    var ordered = [];
    (fields || []).forEach(function (f) {
      var fid = String(f.id || "");
      if (idSet[fid]) ordered.push(fid);
    });
    return ordered;
  }

  /** Flyout rows follow API field catalog order, not layout canvas Y positions. */
  function fieldsForParticipatingIdsInCatalogOrder(fields, participatingIds) {
    var want = {};
    (participatingIds || []).forEach(function (id) {
      want[String(id || "")] = true;
    });
    var out = [];
    (fields || []).forEach(function (f) {
      var fid = String(f.id || "");
      if (want[fid]) out.push(f);
    });
    return out;
  }

  function filterFlyoutRenderableFields(fields) {
    return (fields || []).filter(function (f) {
      return !isSkippableDataEntryType(f && f.data_entry_type);
    });
  }

  function gcDcLayoutOrderedFieldsForFlyout(fields, layout) {
    var L = normalizeLayout(layout);
    var catalog = buildNodeCatalog(fields, L);
    var conns = effectiveConnections(L, fields, catalog);
    var part = fieldIdsParticipating(conns, fields);
    if (!part.length) {
      return { fields: filterFlyoutRenderableFields(fields), connections: conns, nodeCatalog: catalog };
    }
    var ordered = fieldsForParticipatingIdsInCatalogOrder(fields, part);
    return { fields: filterFlyoutRenderableFields(ordered), connections: conns, nodeCatalog: catalog };
  }

  function computeFlowFromRow(nodeCatalog, connections, fields, row, controlOutputOverrides) {
    var values = {};
    var controlInputs = {};
    var visibilityByCtrl = {};
    var overrides =
      controlOutputOverrides &&
      typeof controlOutputOverrides === "object" &&
      !Array.isArray(controlOutputOverrides)
        ? controlOutputOverrides
        : null;
    var fieldById = {};
    (fields || []).forEach(function (f) {
      fieldById[String(f.id || "")] = f;
    });
    Object.keys(nodeCatalog).forEach(function (nodeId) {
      var node = nodeCatalog[nodeId];
      if (!node || node.kind !== "field") return;
      var fid = String(node.field_id || "");
      var fld = fieldById[fid];
      if (!fld) return;
      var prop = trimStr(fld.property_name);
      values[nodeId + "|loaded_value"] = valueForPropertyFromRow(row, prop);
    });

    function firstControlInput(ctrlId, name) {
      var key = ctrlId + "|" + name;
      return Object.prototype.hasOwnProperty.call(controlInputs, key) ? controlInputs[key] : "";
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
      connections.forEach(function (edge) {
        var srcKey = edge.source_node_id + "|" + edge.source_handle;
        var v = Object.prototype.hasOwnProperty.call(values, srcKey) ? values[srcKey] : "";
        var tgtNode = nodeCatalog[edge.target_node_id];
        if (!tgtNode || (tgtNode.kind !== "control" && tgtNode.kind !== "logic")) return;
        controlInputs[edge.target_node_id + "|" + edge.target_handle] = v;
      });

      Object.keys(nodeCatalog).forEach(function (nodeId) {
        var node = nodeCatalog[nodeId];
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
        var ovSelected =
          overrides && Object.prototype.hasOwnProperty.call(overrides, nodeId + "|selected")
            ? String(overrides[nodeId + "|selected"] == null ? "" : overrides[nodeId + "|selected"])
            : null;
        var ovValue =
          overrides && Object.prototype.hasOwnProperty.call(overrides, nodeId + "|value")
            ? String(overrides[nodeId + "|value"] == null ? "" : overrides[nodeId + "|value"])
            : null;
        var isVisible = visibleFromInput(nodeId);
        visibilityByCtrl[nodeId] = isVisible;
        var base = (ovValue != null ? ovValue : inValue) || (ovSelected != null ? ovSelected : inSelected) || inAddress || "";
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
          var picked = isVisible
            ? (ovSelected != null ? ovSelected : inSelected || base)
            : "";
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

  function applyFlowToObjectEditCatalog(flowState, fields) {
    var fs = flowState || {};
    var inputs = fs.inputsByControl || {};
    var outs = fs.outputs || {};
    var visMap = fs.visibilityByControl || {};
    var fieldMap = {};
    (fields || []).forEach(function (f) {
      fieldMap[String(f.id || "")] = f;
    });
    var host = document.getElementById("gc-designer-object-edit-catalog-fields");
    if (!host) return;
    var CF = (window.__gcDesignerControlsBridge || {}).catalogFieldUi || {};
    host.querySelectorAll(".gc-designer-object-edit-catalog-row").forEach(function (row) {
      var fid = trimStr(row.getAttribute("data-gc-catalog-field-id"));
      var f = fieldMap[fid];
      if (!f) return;
      var prop = trimStr(f.property_name);
      if (!prop) return;
      var ctrlId = "ctrl:" + fid;
      var visible = Object.prototype.hasOwnProperty.call(visMap, ctrlId) ? !!visMap[ctrlId] : true;
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
          } catch (e0) {}
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

      var dd = row.querySelector("[data-gc-designer-dd]");
      if (dd && inSelected != null && String(inSelected) !== "") {
        if (dd.classList.contains("gc-designer-dd--multi")) {
          if (typeof CF.ddSetMultiSelection === "function") {
            try {
              CF.ddSetMultiSelection(dd, String(inSelected).split("\x1e").filter(Boolean));
            } catch (eM) {}
          }
        } else if (typeof CF.ddSetSingleSelection === "function") {
          setTimeout(function () {
            try {
              CF.ddSetSingleSelection(dd, String(inSelected));
            } catch (eD) {}
          }, 120);
        }
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

  function collectDomControlValues(nodeCatalog, connections, fields, fieldsEl) {
    var values = {};
    var fieldById = {};
    (fields || []).forEach(function (f) {
      fieldById[String(f.id || "")] = f;
    });
    if (!fieldsEl) return values;
    fieldsEl.querySelectorAll(".gc-designer-object-edit-catalog-row").forEach(function (rowEl) {
      if (rowEl.hidden || rowEl.style.display === "none") return;
      var fid = trimStr(rowEl.getAttribute("data-gc-catalog-field-id"));
      var f = fieldById[fid];
      if (!f) return;
      var ctrlId = "ctrl:" + fid;
      var node = nodeCatalog[ctrlId];
      if (!node || node.kind !== "control") return;
      var det = trimStr(f.data_entry_type).toLowerCase();

      if (det === "ip-address" || det === "ip-ipv4" || det === "ip-ipv6") {
        var ipIn = rowEl.querySelector("input.gc-ip-field__input");
        var addr = ipIn ? trimStr(ipIn.value) : "";
        var ipOnly = addr;
        var prefix = "";
        if (addr.indexOf("/") >= 0) {
          ipOnly = addr.slice(0, addr.indexOf("/"));
          prefix = addr.slice(addr.indexOf("/") + 1);
        }
        values[ctrlId + "|ip_address"] = ipOnly;
        values[ctrlId + "|subnet"] = prefix;
        values[ctrlId + "|netmask"] = prefix;
        return;
      }
      if (det === "ip-list") {
        var wrap = rowEl.querySelector("[data-gc-ip-list]");
        var parts = [];
        if (wrap) {
          wrap.querySelectorAll(".gc-ip-list-field__item input.gc-ip-field__input").forEach(function (inp) {
            var t = trimStr(inp.value);
            if (t) parts.push(t);
          });
        }
        values[ctrlId + "|ip_list"] = parts.join(",");
        return;
      }
      var sel = rowEl.querySelector("[data-gc-option-selector]");
      if (sel && typeof globalThis.gcOptionSelectorGetSelectedLabel === "function") {
        var lab = globalThis.gcOptionSelectorGetSelectedLabel(sel);
        values[ctrlId + "|selected"] = lab != null ? String(lab) : "";
        if (det === "selector") {
          var pickedKey = "option_" + slug(values[ctrlId + "|selected"]);
          (Array.isArray(node.outputs) ? node.outputs : []).forEach(function (outHandle) {
            if (String(outHandle || "").indexOf("option_") !== 0) return;
            values[ctrlId + "|" + outHandle] = outHandle === pickedKey;
          });
        }
        return;
      }
      var dd = rowEl.querySelector("[data-gc-designer-dd]");
      if (dd) {
        if (dd.classList.contains("gc-designer-dd--multi")) {
          var vals = [];
          dd.querySelectorAll("li[role='option'] input[type='checkbox']:checked").forEach(function (cb) {
            var li = cb.closest("li");
            if (li) vals.push(li.getAttribute("data-value") || "");
          });
          values[ctrlId + "|selected"] = vals.join("\x1e");
        } else {
          var tr = dd.querySelector(".gc-designer-dd__trigger");
          values[ctrlId + "|selected"] = tr ? String(tr.getAttribute("data-gc-dd-value") || "") : "";
        }
        return;
      }
      var tagRoot = rowEl.querySelector("[data-gc-designer-tag-editor]");
      if (tagRoot && tagRoot._gcDesignerTagApi && tagRoot._gcDesignerTagApi.getTags) {
        var tags = tagRoot._gcDesignerTagApi.getTags() || [];
        values[ctrlId + "|value"] = tags.join("\x1e");
        return;
      }
      var ta = rowEl.querySelector("textarea.settings-form__input");
      if (ta) {
        values[ctrlId + "|value"] = trimStr(ta.value);
        return;
      }
      var inp2 = rowEl.querySelector("input.settings-form__input:not(.gc-ip-field__input):not([type='hidden'])");
      if (inp2 && inp2.type !== "checkbox" && inp2.type !== "radio") {
        values[ctrlId + "|value"] = trimStr(inp2.value);
        return;
      }
    });

    return values;
  }

  function buildSavePayload(nodeCatalog, connections, fields, fieldsEl) {
    var values = collectDomControlValues(nodeCatalog, connections, fields, fieldsEl);
    var fieldById = {};
    (fields || []).forEach(function (f) {
      fieldById[String(f.id || "")] = f;
    });
    var properties = {};
    connections.forEach(function (edge) {
      if (edge.target_handle !== "save_value") return;
      var m = /^field:(\d+)$/.exec(String(edge.target_node_id || ""));
      if (!m) return;
      var srcKey = edge.source_node_id + "|" + edge.source_handle;
      if (!Object.prototype.hasOwnProperty.call(values, srcKey)) return;
      var fld = fieldById[m[1]];
      if (!fld || !trimStr(fld.property_name)) return;
      properties[trimStr(fld.property_name)] = values[srcKey];
    });
    return { properties: properties };
  }

  function mergeDomControlValuesIntoFlowInputs(flow, domValues) {
    if (!flow || !domValues || typeof domValues !== "object") return;
    var ic = flow.inputsByControl;
    if (!ic || typeof ic !== "object") return;
    Object.keys(domValues).forEach(function (k) {
      if (k.indexOf("ctrl:") !== 0) return;
      ic[k] = domValues[k];
    });
  }

  function reevalObjectEditCatalogFromDom(nodeCatalog, connections, fields, row, fieldsEl) {
    var host =
      fieldsEl ||
      document.getElementById("gc-designer-object-edit-catalog-fields");
    if (!host) return { outputs: {}, inputsByControl: {}, visibilityByControl: {} };
    var overrides = collectDomControlValues(nodeCatalog, connections, fields, host);
    var flow = computeFlowFromRow(
      nodeCatalog,
      connections,
      fields,
      row && typeof row === "object" ? row : {},
      overrides,
    );
    mergeDomControlValuesIntoFlowInputs(flow, overrides);
    applyFlowToObjectEditCatalog(flow, fields);
    return flow;
  }

  globalThis.gcDcLayoutNormalize = normalizeLayout;
  globalThis.gcDcLayoutIsSkippableDataEntryType = isSkippableDataEntryType;
  globalThis.gcDcLayoutBuildNodeCatalog = buildNodeCatalog;
  globalThis.gcDcLayoutEffectiveConnections = effectiveConnections;
  globalThis.gcDcLayoutOrderedFieldsForFlyout = gcDcLayoutOrderedFieldsForFlyout;
  globalThis.gcDcLayoutComputeFlowFromRow = computeFlowFromRow;
  globalThis.gcDcLayoutApplyToObjectEditCatalog = applyFlowToObjectEditCatalog;
  globalThis.gcDcLayoutBuildSavePayload = buildSavePayload;
  globalThis.gcDcLayoutReevalObjectEditCatalogFromDom = reevalObjectEditCatalogFromDom;
})();
