/**
 * Designer · Modals · object-edit-flyout: render payload catalog fields from
 * GET /api/designer/entity-payload-fields/{entity_type} (requires designer auth).
 */
(function () {
  "use strict";

  var ENTITY_TYPE_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
  var helpPopoverEl = null;
  var helpPopoverOpenBtn = null;

  function trimStr(x) {
    return String(x == null ? "" : x).replace(/^\s+|\s+$/g, "");
  }

  function parseBoolLike(v) {
    if (v === true || v === false) return v;
    if (v == null) return false;
    if (typeof v === "number") return v !== 0;
    var s = trimStr(String(v)).toLowerCase();
    if (!s) return false;
    return s === "1" || s === "true" || s === "yes" || s === "on";
  }

  function isSkippableDataEntryType(detRaw) {
    if (typeof globalThis.gcDcLayoutIsSkippableDataEntryType === "function") {
      return globalThis.gcDcLayoutIsSkippableDataEntryType(detRaw);
    }
    var det = trimStr(detRaw != null ? String(detRaw) : "").toLowerCase();
    return !det || det === "hidden" || det === "none";
  }

  function notifyObjectEditCatalogVisibleFieldCount(visibleFieldCount) {
    var n = typeof visibleFieldCount === "number" ? visibleFieldCount : 0;
    try {
      document.dispatchEvent(
        new CustomEvent("gc-designer-object-edit-catalog-rendered", {
          detail: { visibleFieldCount: n },
        }),
      );
    } catch (e0) {}
  }

  function countVisibleCatalogRows() {
    var host = document.getElementById("gc-designer-object-edit-catalog-fields");
    if (!host) return 0;
    var n = 0;
    host.querySelectorAll(".gc-designer-object-edit-catalog-row").forEach(function (row) {
      if (!row.hidden && row.style.display !== "none") n++;
    });
    return n;
  }

  function parsePropsJson(raw) {
    if (raw == null) return {};
    if (typeof raw === "object" && !Array.isArray(raw)) return raw;
    if (trimStr(String(raw)) === "") return {};
    try {
      var j = JSON.parse(String(raw));
      return j && typeof j === "object" ? j : {};
    } catch (e) {
      return {};
    }
  }

  function fillDataEntryTableColTimeSelect(sel, cellVal) {
    var opts =
      typeof globalThis.gcDataEntryTableQuarterHourTimeOptions === "function"
        ? globalThis.gcDataEntryTableQuarterHourTimeOptions()
        : [];
    if (!opts.length) {
      var pad2 = function (n) {
        var s = String(Number(n) || 0);
        return s.length >= 2 ? s : "0" + s;
      };
      var h;
      var m;
      for (h = 0; h < 24; h++) {
        for (m = 0; m < 60; m += 15) {
          opts.push(pad2(h) + ":" + pad2(m));
        }
      }
      if (opts.indexOf("23:59") === -1) opts.push("23:59");
    }
    var seen = {};
    opts.forEach(function (v) {
      seen[v] = true;
      var o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
    var cv = cellVal != null ? String(cellVal) : "";
    var cvt = trimStr(cv);
    if (cvt && !seen[cvt]) {
      var o0 = document.createElement("option");
      o0.value = cv;
      o0.textContent = cv;
      sel.appendChild(o0);
    }
    if (cvt) sel.value = cv;
  }

  function isObjectEditFlyoutAddMode() {
    var st = globalThis.__gcObjectEditFlyoutState;
    return !!(st && trimStr(String(st.mode || "")).toLowerCase() === "add");
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtmlText(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /** Valid entity_type strings from table fields ``data_source_entity_types`` (API-shaped). */
  function catalogDataSourceEntityTypes(field) {
    if (!field || !Array.isArray(field.data_source_entity_types)) return [];
    var out = [];
    var seen = {};
    field.data_source_entity_types.forEach(function (x) {
      var t = trimStr(x != null ? x : "");
      if (!t || !ENTITY_TYPE_RE.test(t) || seen[t]) return;
      seen[t] = true;
      out.push(t);
    });
    return out;
  }

  function mlCatalogEntityCheckboxesHtml(types) {
    var parts = [];
    types.forEach(function (et) {
      var v = escapeAttr(et);
      var lab = escapeHtmlText(et);
      parts.push(
        '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
          '<input type="checkbox" data-gc-ml-entity-type value="' +
          v +
          '" checked />' +
          '<span class="settings-form__label mono" style="margin:0">' +
          lab +
          "</span></label>",
      );
    });
    return parts.join("");
  }

  function ensureHelpPopover() {
    if (helpPopoverEl) return helpPopoverEl;
    helpPopoverEl = document.createElement("div");
    helpPopoverEl.className = "gc-object-edit-help-popover";
    helpPopoverEl.setAttribute("role", "tooltip");
    helpPopoverEl.hidden = true;
    document.body.appendChild(helpPopoverEl);
    document.addEventListener("click", function (e) {
      if (!helpPopoverEl || helpPopoverEl.hidden) return;
      var t = e.target;
      if (helpPopoverEl.contains(t)) return;
      if (t.closest && t.closest(".gc-object-edit-help-icon")) return;
      hideHelpPopover();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideHelpPopover();
    });
    return helpPopoverEl;
  }

  function hideHelpPopover() {
    if (helpPopoverEl) helpPopoverEl.hidden = true;
    if (helpPopoverOpenBtn) {
      helpPopoverOpenBtn.setAttribute("aria-expanded", "false");
      helpPopoverOpenBtn = null;
    }
  }

  function positionHelpPopover(anchor) {
    var pop = ensureHelpPopover();
    var r = anchor.getBoundingClientRect();
    var margin = 8;
    pop.style.left = Math.round(r.left + r.width / 2) + "px";
    pop.style.top = Math.round(r.top - margin) + "px";
    pop.style.transform = "translate(-50%, -100%)";
  }

  function wireHelpIcon(btn, helpText) {
    var text = trimStr(helpText);
    if (!text) return;
    btn.type = "button";
    btn.className = "gc-object-edit-help-icon";
    btn.setAttribute("aria-label", "Help: " + text.slice(0, 120));
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML =
      '<span class="gc-object-edit-help-icon__glyph" aria-hidden="true">i</span>';
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var pop = ensureHelpPopover();
      var opening = pop.hidden || helpPopoverOpenBtn !== btn;
      hideHelpPopover();
      if (!opening) return;
      pop.textContent = text;
      positionHelpPopover(btn);
      pop.hidden = false;
      helpPopoverOpenBtn = btn;
      btn.setAttribute("aria-expanded", "true");
    });
  }

  function buildLabelRow(labelText, helpText) {
    var wrap = document.createElement("div");
    wrap.className = "gc-designer-object-edit-catalog-label-row";
    var lab = document.createElement("span");
    lab.className = "settings-form__label";
    lab.textContent = labelText;
    wrap.appendChild(lab);
    if (trimStr(helpText)) {
      var hi = document.createElement("button");
      wireHelpIcon(hi, helpText);
      wrap.appendChild(hi);
    }
    return wrap;
  }

  function buildDefaultText(props) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "settings-form__input mono";
    inp.autocomplete = "off";
    if (props.value != null) inp.value = String(props.value);
    return inp;
  }

  function usesNewTextConstraints(props) {
    if (!props || typeof props !== "object") return false;
    if (props.constraintInteger === true) return true;
    if (props.constraintMin != null && trimStr(String(props.constraintMin)) !== "") return true;
    if (props.constraintMax != null && trimStr(String(props.constraintMax)) !== "") return true;
    return false;
  }

  function parseOptionalIntBound(raw, allowNegative) {
    var t = trimStr(raw != null ? String(raw) : "");
    if (!t) return { ok: true, v: null };
    var re = allowNegative ? /^-?\d+$/ : /^\d+$/;
    if (!re.test(t)) return { ok: false, v: null };
    var n = parseInt(t, 10);
    if (!allowNegative && n < 0) return { ok: false, v: null };
    return { ok: true, v: n };
  }

  function applyAndWireTextConstraints(el, props) {
    if (!el || !props || typeof props !== "object") return;
    var intOn = props.constraintInteger === true;
    var bMin = parseOptionalIntBound(props.constraintMin, intOn);
    var bMax = parseOptionalIntBound(props.constraintMax, intOn);
    var vmin = bMin.ok ? bMin.v : null;
    var vmax = bMax.ok ? bMax.v : null;
    if (vmin != null && vmax != null && vmin > vmax) {
      vmin = null;
      vmax = null;
    }
    el.setAttribute("data-gc-text-constraint", "1");
    el.setAttribute("data-gc-text-constraint-int", intOn ? "1" : "0");
    if (vmin != null) el.setAttribute("data-gc-text-constraint-min", String(vmin));
    else el.removeAttribute("data-gc-text-constraint-min");
    if (vmax != null) el.setAttribute("data-gc-text-constraint-max", String(vmax));
    else el.removeAttribute("data-gc-text-constraint-max");
    if (!intOn) {
      if (vmin != null && vmin >= 0) el.minLength = vmin;
      else el.removeAttribute("minLength");
      if (vmax != null && vmax >= 1) el.maxLength = vmax;
      else el.removeAttribute("maxLength");
    } else {
      el.removeAttribute("minLength");
      el.removeAttribute("maxLength");
    }
    function validateTextConstraint() {
      if (typeof el.setCustomValidity !== "function") return;
      var raw = "value" in el ? String(el.value != null ? el.value : "") : "";
      if (intOn) {
        var t = trimStr(raw);
        if (!t) {
          el.setCustomValidity("");
          return;
        }
        if (!/^-?\d+$/.test(t)) {
          el.setCustomValidity("Enter a whole number.");
          return;
        }
        var n = parseInt(t, 10);
        if (vmin != null && n < vmin) {
          el.setCustomValidity("Value must be at least " + vmin + ".");
          return;
        }
        if (vmax != null && n > vmax) {
          el.setCustomValidity("Value must be at most " + vmax + ".");
          return;
        }
      } else {
        var len = raw.length;
        if (vmin != null && len < vmin) {
          el.setCustomValidity("Enter at least " + vmin + " characters.");
          return;
        }
        if (vmax != null && len > vmax) {
          el.setCustomValidity("Enter at most " + vmax + " characters.");
          return;
        }
      }
      el.setCustomValidity("");
    }
    el.addEventListener("input", validateTextConstraint);
    el.addEventListener("blur", validateTextConstraint);
    validateTextConstraint();
  }

  function buildTextSingle(props) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "settings-form__input mono";
    inp.autocomplete = "off";
    if (props.value != null) inp.value = String(props.value);
    if (usesNewTextConstraints(props)) {
      applyAndWireTextConstraints(inp, props);
    } else {
      if (props.minLength != null) inp.minLength = Math.max(0, parseInt(props.minLength, 10) || 0);
      if (props.maxLength != null) inp.maxLength = Math.max(1, parseInt(props.maxLength, 10) || 1);
    }
    if (props.charset != null) inp.setAttribute("data-gc-text-charset", String(props.charset));
    return inp;
  }

  function buildTextConfig(props) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "settings-form__input mono";
    inp.autocomplete = "off";
    if (props.value != null) inp.value = String(props.value);
    if (props.minLengthSingle != null) inp.minLength = Math.max(0, parseInt(props.minLengthSingle, 10) || 0);
    if (props.maxLengthSingle != null) inp.maxLength = Math.max(1, parseInt(props.maxLengthSingle, 10) || 1);
    if (props.charset != null) inp.setAttribute("data-gc-text-charset", String(props.charset));
    return inp;
  }

  function buildTextMultiline(props) {
    var ta = document.createElement("textarea");
    ta.className = "settings-form__input mono";
    ta.rows = 4;
    if (props.value != null) ta.value = String(props.value);
    if (usesNewTextConstraints(props)) {
      applyAndWireTextConstraints(ta, props);
    } else if (props.maxLength != null) {
      ta.maxLength = Math.max(1, parseInt(props.maxLength, 10) || 1);
    }
    return ta;
  }

  function buildSelector(props, fieldId) {
    var grp = document.createElement("div");
    grp.className = "gc-option-selector";
    grp.setAttribute("role", "group");
    grp.setAttribute("aria-label", "Option selector");
    grp.setAttribute("data-gc-option-selector", "");
    grp.id = "gc-obj-edit-sel-" + fieldId;
    var CF = (window.__gcDesignerControlsBridge || {}).catalogFieldUi;
    var rebuild =
      CF && CF.selectorRebuild
        ? CF.selectorRebuild
        : typeof globalThis.gcOptionSelectorRebuild === "function"
          ? globalThis.gcOptionSelectorRebuild
          : null;
    if (rebuild) {
      var items = Array.isArray(props.items) ? props.items : [];
      rebuild(grp, items, {});
      var wantLabel =
        props.selectedLabel != null
          ? trimStr(props.selectedLabel)
          : props.label != null
            ? trimStr(props.label)
            : "";
      var idx = props.selectedIndex != null ? parseInt(props.selectedIndex, 10) : NaN;
      if (window.gcOptionSelectorSetSelection) {
        window.gcOptionSelectorSetSelection(grp, wantLabel, idx);
      }
      if (typeof globalThis.gcOptionSelectorSyncLayout === "function") {
        requestAnimationFrame(function () {
          globalThis.gcOptionSelectorSyncLayout(grp);
        });
      }
    }
    return grp;
  }

  function buildTagEditor(props, fieldId) {
    var root = document.createElement("div");
    root.className = "gc-designer-tags";
    root.setAttribute("data-gc-designer-tag-editor", "");
    root.id = "gc-obj-edit-tags-" + fieldId;
    root.innerHTML =
      '<input type="hidden" class="gc-designer-tags__hidden" value="[]" />' +
      '<div class="gc-designer-tags__combo">' +
      '<div class="gc-designer-tags__field" role="group">' +
      '<div class="gc-designer-tags__chips" aria-live="polite"></div>' +
      '<div class="gc-designer-tags__input-shell">' +
      '<div class="gc-designer-tags__mirror" aria-hidden="true">' +
      '<span class="gc-designer-tags__typed-mirror"></span><span class="gc-designer-tags__ghost"></span>' +
      "</div>" +
      '<input type="text" class="gc-designer-tags__input mono" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-expanded="false" placeholder="Add tag…" />' +
      "</div></div>" +
      '<ul class="gc-designer-tags__suggest" role="listbox" hidden></ul>' +
      "</div>";
    var tagBr = (window.__gcDesignerControlsBridge || {}).tags;
    if (tagBr && tagBr.initEditor) {
      tagBr.initEditor(root);
      var api = root._gcDesignerTagApi;
      if (api && api.setTags && Array.isArray(props.tags)) api.setTags(props.tags);
    }
    return root;
  }

  function catalogIpAutocorrectAttrEnabled(props) {
    if (!props || props.autocorrect === false) return false;
    var aa = props.appliedIpAttributes;
    if (aa && typeof aa === "object") {
      var raw = aa["data-gc-ip-autocorrect"];
      if (raw === "false" || raw === false || raw === "0") return false;
      if (raw === "true" || raw === true || raw === "1") return true;
    }
    return true;
  }

  function syncCatalogIpInputsAutocorrectAttr(inputs, props) {
    var on = catalogIpAutocorrectAttrEnabled(props);
    var list = Array.isArray(inputs) ? inputs : [inputs];
    list.forEach(function (inp) {
      if (!inp) return;
      if (on) inp.setAttribute("data-gc-ip-autocorrect", "true");
      else inp.removeAttribute("data-gc-ip-autocorrect");
    });
  }

  function buildIpField(props, family, fieldId) {
    var wrap = document.createElement("div");
    var uid = "gc-obj-edit-ip-" + family + "-" + fieldId;
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "settings-form__input mono gc-ip-field__input";
    inp.id = uid;
    inp.autocomplete = "off";
    inp.setAttribute("aria-invalid", "false");
    var pill = document.createElement("span");
    pill.className = "gc-ip-field__mask-pill";
    pill.hidden = true;
    pill.setAttribute("aria-hidden", "true");
    var ok = document.createElement("span");
    ok.className = "gc-ip-field__ok";
    ok.hidden = true;
    ok.setAttribute("aria-hidden", "true");
    ok.setAttribute("title", "Valid");
    ok.innerHTML = "&#10003;";
    var ipWrap = document.createElement("div");
    ipWrap.className = "gc-ip-field";
    ipWrap.appendChild(inp);
    ipWrap.appendChild(pill);
    ipWrap.appendChild(ok);
    var prev = document.createElement("p");
    prev.className = "settings-form__status gc-ip-correct-preview";
    prev.setAttribute("role", "status");
    prev.hidden = true;
    var err = document.createElement("p");
    err.className = "settings-form__status is-error";
    err.setAttribute("role", "alert");
    err.hidden = true;
    wrap.appendChild(ipWrap);
    wrap.appendChild(prev);
    wrap.appendChild(err);
    var ipB = (window.__gcDesignerControlsBridge || {}).ip;
    if (ipB) {
      if (props.clearAppliedIpAttributes) ipB.clearAllGcIpAttrs && ipB.clearAllGcIpAttrs(inp);
      else if (props.appliedIpAttributes) ipB.writeAllGcIpAttrs && ipB.writeAllGcIpAttrs(inp, props.appliedIpAttributes);
    }
    syncCatalogIpInputsAutocorrectAttr(inp, props);
    if (ipB) {
      if (props.value != null) inp.value = String(props.value);
      if (ipB.wireCatalogIpInput) {
        ipB.wireCatalogIpInput(inp, err, ok, prev, pill, family);
      }
      try {
        inp.dispatchEvent(new Event("blur"));
      } catch (eBl) {}
    }
    return wrap;
  }

  /**
   * Designer Controls · ip-address: IP family selector plus IPv4 and IPv6 panels (see
   * templates/partials/gc_designer_controls_main_demo.html).
   */
  function buildIpAddressControl(props, fieldId) {
    var ipB = (window.__gcDesignerControlsBridge || {}).ip;
    var root = document.createElement("div");
    root.className = "gc-obj-edit-ip-address-root";
    root.setAttribute("data-gc-obj-edit-ip-address", "1");

    var famField = document.createElement("label");
    famField.className = "settings-form__field";
    var famLab = document.createElement("span");
    famLab.className = "settings-form__label";
    var famSelId = "gc-obj-edit-ip-family-" + fieldId;
    famLab.setAttribute("for", famSelId);
    famLab.textContent = "IP family";
    var famSel = document.createElement("select");
    famSel.className = "settings-form__input gc-obj-edit-ip-address__family";
    famSel.id = famSelId;
    famSel.setAttribute("aria-label", "IP family");
    ["IPv4", "IPv6"].forEach(function (lab) {
      var opt = document.createElement("option");
      opt.value = lab;
      opt.textContent = lab;
      famSel.appendChild(opt);
    });
    famField.appendChild(famLab);
    famField.appendChild(famSel);
    root.appendChild(famField);
    if (props.useExternalIpFamilyRow) {
      famField.hidden = true;
      famField.style.display = "none";
      famField.setAttribute("aria-hidden", "true");
      famSel.setAttribute("tabindex", "-1");
      famLab.classList.add("gc-sr-only");
    }

    function makePanel(family) {
      var is4 = family === "ipv4";
      var panel = document.createElement("div");
      panel.className = "settings-form__field";
      panel.setAttribute("data-gc-obj-edit-ip-panel", family);
      var labEl = document.createElement("span");
      labEl.className = "settings-form__label";
      var labId = "gc-obj-edit-ip-addr-lab-" + family + "-" + fieldId;
      labEl.id = labId;
      labEl.textContent = is4 ? "IPv4 address" : "IPv6 address";
      if (props.suppressInnerIpPanelLabels) {
        labEl.classList.add("gc-sr-only");
      }
      var constr = document.createElement("span");
      constr.className = "gc-sr-only";
      var ipWrap = document.createElement("div");
      ipWrap.className = "gc-ip-field";
      var inp = document.createElement("input");
      inp.type = "text";
      inp.className = "settings-form__input mono gc-ip-field__input";
      inp.id = "gc-obj-edit-ip-" + family + "-" + fieldId;
      inp.autocomplete = "off";
      if (is4) inp.setAttribute("inputmode", "decimal");
      inp.placeholder = is4 ? "192.0.2.1" : "2001:db8::1";
      inp.setAttribute("aria-labelledby", labId);
      inp.setAttribute("aria-invalid", "false");
      var pill = document.createElement("span");
      pill.className = "gc-ip-field__mask-pill";
      pill.hidden = true;
      pill.setAttribute("aria-hidden", "true");
      var ok = document.createElement("span");
      ok.className = "gc-ip-field__ok";
      ok.hidden = true;
      ok.setAttribute("aria-hidden", "true");
      ok.setAttribute("title", "Valid");
      ok.innerHTML = "&#10003;";
      ipWrap.appendChild(inp);
      ipWrap.appendChild(pill);
      ipWrap.appendChild(ok);
      var prev = document.createElement("p");
      prev.className = "settings-form__status gc-ip-correct-preview";
      prev.setAttribute("role", "status");
      prev.hidden = true;
      var err = document.createElement("p");
      err.className = "settings-form__status is-error";
      err.setAttribute("role", "alert");
      err.hidden = true;
      panel.appendChild(labEl);
      panel.appendChild(constr);
      panel.appendChild(ipWrap);
      panel.appendChild(prev);
      panel.appendChild(err);
      return { panel: panel, inp: inp, err: err, ok: ok, prev: prev, pill: pill };
    }

    var v4 = makePanel("ipv4");
    var v6 = makePanel("ipv6");
    var v4w = document.createElement("div");
    v4w.className = "gc-obj-edit-ip-address-fields-v4";
    v4w.appendChild(v4.panel);
    var v6w = document.createElement("div");
    v6w.className = "gc-obj-edit-ip-address-fields-v6";
    v6w.appendChild(v6.panel);
    root.appendChild(v4w);
    root.appendChild(v6w);

    function syncFamilyPanels() {
      var is6 = famSel.value === "IPv6";
      v4w.hidden = is6;
      v6w.hidden = !is6;
    }

    if (ipB) {
      if (props.clearAppliedIpAttributes) {
        if (ipB.clearAllGcIpAttrs) {
          ipB.clearAllGcIpAttrs(v4.inp);
          ipB.clearAllGcIpAttrs(v6.inp);
        }
      } else if (props.appliedIpAttributes && ipB.writeAllGcIpAttrs) {
        ipB.writeAllGcIpAttrs(v4.inp, props.appliedIpAttributes);
        ipB.writeAllGcIpAttrs(v6.inp, props.appliedIpAttributes);
      }
    }
    syncCatalogIpInputsAutocorrectAttr([v4.inp, v6.inp], props);
    if (ipB && ipB.wireCatalogIpInput) {
      ipB.wireCatalogIpInput(v4.inp, v4.err, v4.ok, v4.prev, v4.pill, "ipv4");
      ipB.wireCatalogIpInput(v6.inp, v6.err, v6.ok, v6.prev, v6.pill, "ipv6");
    }

    famSel.value = ipFamilyFromProps(props) === "ipv6" ? "IPv6" : "IPv4";
    syncFamilyPanels();

    if (props.value != null) {
      var s = String(props.value);
      var tgt = s.indexOf(":") >= 0 ? v6.inp : v4.inp;
      if (s.indexOf(":") >= 0) {
        famSel.value = "IPv6";
        syncFamilyPanels();
      }
      tgt.value = s;
    }

    famSel.addEventListener("change", function () {
      syncFamilyPanels();
      var vis = famSel.value === "IPv6" ? v6.inp : v4.inp;
      if (vis) {
        try {
          vis.dispatchEvent(new Event("blur"));
        } catch (e0) {}
      }
    });

    if (ipB && ipB.wireCatalogIpInput) {
      try {
        (famSel.value === "IPv6" ? v6.inp : v4.inp).dispatchEvent(new Event("blur"));
      } catch (eBl) {}
    }

    return root;
  }

  function parseIpListCsv(raw) {
    return String(raw == null ? "" : raw)
      .split(",")
      .map(function (x) {
        return trimStr(x);
      })
      .filter(Boolean);
  }

  function ipFamilyFromProps(props) {
    var famRaw =
      props && props.IPFamily != null
        ? props.IPFamily
        : props && props.ipfamily != null
          ? props.ipfamily
          : "";
    return String(famRaw || "").trim().toLowerCase() === "ipv6" ? "ipv6" : "ipv4";
  }

  function isIpFamilyPropertyField(field) {
    var p = trimStr(field && field.property_name).toLowerCase().replace(/_/g, "");
    return p === "ipfamily";
  }

  function ipFamilyRowTypeRank(detRaw) {
    var d = trimStr(detRaw).toLowerCase();
    if (d === "selector") return 0;
    if (d === "dropdown-single") return 1;
    if (d === "dropdown-multi") return 2;
    return 3;
  }

  /** Multiple IPFamily rows in the catalog (e.g. ip_host) → keep one; prefer selector over dropdowns. */
  function dedupeIpFamilyCatalogFields(fields) {
    var list = fields || [];
    var idxs = [];
    list.forEach(function (f, i) {
      if (isIpFamilyPropertyField(f)) idxs.push(i);
    });
    if (idxs.length <= 1) return list;
    idxs.sort(function (a, b) {
      var ra = ipFamilyRowTypeRank(list[a].data_entry_type);
      var rb = ipFamilyRowTypeRank(list[b].data_entry_type);
      if (ra !== rb) return ra - rb;
      return a - b;
    });
    var drop = {};
    idxs.slice(1).forEach(function (i) {
      drop[i] = true;
    });
    return list.filter(function (_, i) {
      return !drop[i];
    });
  }

  function catalogFieldsHaveSeparateIpFamilyRow(fields) {
    return (fields || []).some(isIpFamilyPropertyField);
  }

  function ipListReadonlyFromProps(props) {
    if (!props || typeof props !== "object") return false;
    if (props.readonly == null) return false;
    return !!props.readonly;
  }

  function buildIpListField(props, fieldId) {
    var ipB = (window.__gcDesignerControlsBridge || {}).ip;
    var wrap = document.createElement("div");
    wrap.className = "gc-ip-list-field";
    wrap.setAttribute("data-gc-ip-list", "1");
    var list = document.createElement("div");
    list.className = "gc-ip-list-field__items";
    wrap.appendChild(list);
    var family = ipFamilyFromProps(props);
    var isReadonly = ipListReadonlyFromProps(props);
    var itemSeq = 0;

    function syncErrorIcon(errEl, iconEl) {
      if (!errEl || !iconEl) return;
      var msg = trimStr(errEl.textContent || "");
      var show = !errEl.hidden && !!msg;
      iconEl.hidden = !show;
      iconEl.setAttribute("title", show ? msg : "");
      iconEl.setAttribute("aria-label", show ? msg : "");
    }

    function enforceIpOnlyConstraintMode(inp) {
      if (!inp) return;
      var autocorrectOn = catalogIpAutocorrectAttrEnabled(props);
      if (ipB && ipB.readOptsFromInput && ipB.writeOptsToInput) {
        var cur = ipB.readOptsFromInput(inp) || {};
        ipB.writeOptsToInput(inp, {
          withinCidr: "",
          rangeLo: "",
          rangeHi: "",
          prefix: "",
          cidrPrefixMin: "",
          cidrPrefixMax: "",
          storedPrefix: "",
          requireNetwork: false,
          requireValueCidr: false,
          autocorrect: cur.autocorrect === true || autocorrectOn,
        });
        return;
      }
      [
        "data-gc-ip-within-cidr",
        "data-gc-ip-range-lo",
        "data-gc-ip-range-hi",
        "data-gc-ip-prefix",
        "data-gc-ip-cidr-prefix-min",
        "data-gc-ip-cidr-prefix-max",
        "data-gc-ip-prefix-length",
        "data-gc-ip-require-network",
        "data-gc-ip-require-value-cidr",
      ].forEach(function (attr) {
        inp.removeAttribute(attr);
      });
      syncCatalogIpInputsAutocorrectAttr(inp, props);
    }

    function observeErrorIconTooltip(errEl, iconEl) {
      if (!errEl || !iconEl || typeof MutationObserver !== "function") return;
      var mo = new MutationObserver(function () {
        syncErrorIcon(errEl, iconEl);
      });
      mo.observe(errEl, {
        attributes: true,
        attributeFilter: ["hidden"],
        characterData: true,
        childList: true,
        subtree: true,
      });
    }

    function allListInputsHaveNonEmptyValue() {
      var inputs = list.querySelectorAll(".gc-ip-list-field__item input.gc-ip-field__input");
      if (!inputs.length) return false;
      var all = true;
      Array.prototype.forEach.call(inputs, function (inp) {
        if (!trimStr(inp.value)) all = false;
      });
      return all;
    }

    function maybeExpandIfAllFilled() {
      if (isReadonly) return;
      if (!allListInputsHaveNonEmptyValue()) return;
      createItem("");
      syncValueCache();
    }

    function removeListItem(row) {
      if (isReadonly || !row || !list.contains(row)) return;
      row.remove();
      if (!list.querySelector(".gc-ip-list-field__item")) {
        createItem("");
      }
      syncValueCache();
      maybeExpandIfAllFilled();
    }

    function afterInputChange() {
      syncValueCache();
      maybeExpandIfAllFilled();
    }

    function createItem(value) {
      itemSeq += 1;
      var uid = itemSeq;
      var row = document.createElement("div");
      row.className = "gc-ip-list-field__item";
      var rowMain = document.createElement("div");
      rowMain.className = "gc-ip-list-field__item-row";
      var ipShell = document.createElement("div");
      ipShell.className = "gc-ip-list-field__ip-shell";
      var ipWrap = document.createElement("div");
      ipWrap.className = "gc-ip-field";
      var inp = document.createElement("input");
      inp.type = "text";
      inp.className = "settings-form__input mono gc-ip-field__input";
      inp.autocomplete = "off";
      inp.readOnly = isReadonly;
      inp.id = "gc-obj-edit-ip-list-" + fieldId + "-" + uid;
      inp.placeholder = family === "ipv6" ? "2001:db8::1" : "192.0.2.1";
      inp.setAttribute("aria-invalid", "false");
      if (value != null) inp.value = String(value);

      var pill = document.createElement("span");
      pill.className = "gc-ip-field__mask-pill";
      pill.hidden = true;
      pill.setAttribute("aria-hidden", "true");
      var ok = document.createElement("span");
      ok.className = "gc-ip-field__ok";
      ok.hidden = true;
      ok.setAttribute("aria-hidden", "true");
      ok.setAttribute("title", "Valid");
      ok.innerHTML = "&#10003;";
      var errIcon = document.createElement("span");
      errIcon.className = "gc-ip-field__error-icon";
      errIcon.hidden = true;
      errIcon.setAttribute("aria-hidden", "true");
      errIcon.textContent = "!";

      var prev = document.createElement("p");
      prev.className = "settings-form__status gc-ip-correct-preview gc-sr-only";
      prev.setAttribute("role", "status");
      prev.hidden = true;
      var err = document.createElement("p");
      err.className = "settings-form__status is-error gc-sr-only";
      err.setAttribute("role", "alert");
      err.hidden = true;

      ipWrap.appendChild(inp);
      ipWrap.appendChild(pill);
      ipWrap.appendChild(ok);
      ipWrap.appendChild(errIcon);
      ipShell.appendChild(ipWrap);
      rowMain.appendChild(ipShell);

      if (!isReadonly) {
        var rm = document.createElement("button");
        rm.type = "button";
        rm.className = "gc-ip-list-field__remove";
        rm.setAttribute("aria-label", "Remove this entry");
        rm.innerHTML = (window.gcIcon
          ? window.gcIcon("cancel", { size: "md", cls: "gc-ip-list-field__remove-icon" })
          : "");
        rm.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          removeListItem(row);
        });
        rowMain.appendChild(rm);
      }

      row.appendChild(rowMain);
      row.appendChild(prev);
      row.appendChild(err);
      list.appendChild(row);

      if (ipB && ipB.wireCatalogIpInput) {
        if (props.clearAppliedIpAttributes) ipB.clearAllGcIpAttrs && ipB.clearAllGcIpAttrs(inp);
        else if (props.appliedIpAttributes)
          ipB.writeAllGcIpAttrs && ipB.writeAllGcIpAttrs(inp, props.appliedIpAttributes);
        enforceIpOnlyConstraintMode(inp);
        ipB.wireCatalogIpInput(inp, err, ok, prev, pill, family);
        syncErrorIcon(err, errIcon);
        observeErrorIconTooltip(err, errIcon);
        inp.addEventListener("input", function () {
          syncErrorIcon(err, errIcon);
          afterInputChange();
        });
        inp.addEventListener("blur", function () {
          syncErrorIcon(err, errIcon);
          afterInputChange();
        });
      } else {
        enforceIpOnlyConstraintMode(inp);
        inp.addEventListener("input", afterInputChange);
        inp.addEventListener("blur", afterInputChange);
      }
    }

    function syncValueCache() {
      var values = [];
      list.querySelectorAll("input.gc-ip-field__input").forEach(function (inp) {
        var t = trimStr(inp.value);
        if (t) values.push(t);
      });
      wrap.dataset.gcIpListValue = values.join(",");
    }

    function setCsv(raw) {
      var values = parseIpListCsv(raw);
      list.innerHTML = "";
      itemSeq = 0;
      if (!values.length) values = [""];
      values.forEach(function (v) {
        createItem(v);
      });
      syncValueCache();
      list.querySelectorAll("input.gc-ip-field__input").forEach(function (inp) {
        try {
          inp.dispatchEvent(new Event("blur"));
        } catch (eBlur) {}
      });
      maybeExpandIfAllFilled();
    }

    wrap.gcGetIpListValue = function () {
      syncValueCache();
      return wrap.dataset.gcIpListValue || "";
    };
    wrap.gcSetIpListValue = function (raw) {
      setCsv(raw);
    };

    setCsv(props && props.value != null ? props.value : "");
    return wrap;
  }

  function ddSourceFieldsetHtml(uid, multi) {
    var etChecks =
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-entity-type value="ip_host" />' +
      '<span class="settings-form__label" style="margin:0">IP host</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-entity-type value="ip_hostgroup" />' +
      '<span class="settings-form__label" style="margin:0">IP host group</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-entity-type value="fqdn_host" />' +
      '<span class="settings-form__label" style="margin:0">FQDN host</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-entity-type value="mac_host" />' +
      '<span class="settings-form__label" style="margin:0">MAC host</span></label>';
    var colChecks =
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-list-col value="__firewall" />' +
      '<span class="settings-form__label" style="margin:0">Firewall / configuration</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-list-col value="entity_type" />' +
      '<span class="settings-form__label" style="margin:0">Entity type</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-list-col value="HostType" />' +
      '<span class="settings-form__label" style="margin:0">Host type</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-list-col value="Description" />' +
      '<span class="settings-form__label" style="margin:0">Description</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-list-col value="IPAddress" />' +
      '<span class="settings-form__label" style="margin:0">IP address</span></label>';
    return (
      '<fieldset class="settings-form gc-designer-dd__source gc-designer-object-edit-dd-source" id="' +
      escapeAttr(uid + "-source-fieldset") +
      '" aria-label="Dropdown data source" hidden>' +
      '<legend class="gc-sr-only">Data source</legend>' +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:10px 14px;align-items:flex-end">' +
      '<label class="settings-form__field" style="min-width:11rem">' +
      '<span class="settings-form__label">Scope</span>' +
      '<select class="settings-form__input" data-gc-dd-scope>' +
      '<option value="global">Global selector (top bar)</option>' +
      '<option value="custom">Custom IDs</option></select></label>' +
      '<label class="settings-form__field gc-designer-dd__custom-ids" style="min-width:10rem;flex:1" data-gc-dd-custom-wrap hidden>' +
      '<span class="settings-form__label">Firewall IDs</span>' +
      '<input type="text" class="settings-form__input mono" data-gc-dd-fw-ids autocomplete="off" /></label>' +
      '<label class="settings-form__field gc-designer-dd__custom-ids" style="min-width:10rem;flex:1" data-gc-dd-custom-wrap hidden>' +
      '<span class="settings-form__label">Configuration IDs</span>' +
      '<input type="text" class="settings-form__input mono" data-gc-dd-cfg-ids autocomplete="off" /></label></div>' +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:8px 16px;margin-top:8px">' +
      etChecks +
      "</div>" +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:8px 16px;margin-top:8px">' +
      colChecks +
      "</div>" +
      '<p class="settings-form__status" id="' +
      escapeAttr(uid + "-dd-status") +
      '" role="status" aria-live="polite"></p></fieldset>'
    );
  }

  function mlSourceFieldsetHtml(uid, multi, catalogEntityTypes) {
    var etChecks;
    if (catalogEntityTypes && catalogEntityTypes.length) {
      etChecks = mlCatalogEntityCheckboxesHtml(catalogEntityTypes);
    } else {
      etChecks =
        '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
        '<input type="checkbox" data-gc-ml-entity-type value="ip_host" checked />' +
        '<span class="settings-form__label" style="margin:0">IP host</span></label>' +
        '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
        '<input type="checkbox" data-gc-ml-entity-type value="ip_hostgroup" checked />' +
        '<span class="settings-form__label" style="margin:0">IP host group</span></label>' +
        '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
        '<input type="checkbox" data-gc-ml-entity-type value="fqdn_host" />' +
        '<span class="settings-form__label" style="margin:0">FQDN host</span></label>' +
        '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
        '<input type="checkbox" data-gc-ml-entity-type value="mac_host" />' +
        '<span class="settings-form__label" style="margin:0">MAC host</span></label>';
    }
    var colChecks =
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-ml-list-col value="__firewall" checked />' +
      '<span class="settings-form__label" style="margin:0">Firewall / configuration</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-ml-list-col value="entity_type" checked />' +
      '<span class="settings-form__label" style="margin:0">Entity type</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-ml-list-col value="HostType" />' +
      '<span class="settings-form__label" style="margin:0">Host type</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-ml-list-col value="Description" />' +
      '<span class="settings-form__label" style="margin:0">Description</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-ml-list-col value="IPAddress" />' +
      '<span class="settings-form__label" style="margin:0">IP address</span></label>';
    var modeName = escapeAttr(uid + "-ml-mode");
    var singleChecked = multi ? "" : " checked";
    var multiChecked = multi ? " checked" : "";
    return (
      '<fieldset class="settings-form gc-designer-dd__source gc-designer-object-edit-dd-source" id="' +
      escapeAttr(uid + "-source-fieldset") +
      '" aria-label="Member lookup data source" hidden>' +
      '<legend class="gc-sr-only">Member lookup source</legend>' +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:8px 16px;margin-bottom:8px">' +
      '<span class="settings-form__label" style="margin:0">Mode</span>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="radio" name="' +
      modeName +
      '" data-gc-ml-mode-single value="single"' +
      singleChecked +
      " />" +
      '<span class="settings-form__label" style="margin:0">Single</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="radio" name="' +
      modeName +
      '" data-gc-ml-mode-multi value="multi"' +
      multiChecked +
      " />" +
      '<span class="settings-form__label" style="margin:0">Multi</span></label></div>' +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:8px 16px;margin-top:8px">' +
      etChecks +
      "</div>" +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:8px 16px;margin-top:8px">' +
      colChecks +
      "</div>" +
      '<p class="settings-form__status" id="' +
      escapeAttr(uid + "-ml-status") +
      '" role="status" aria-live="polite"></p></fieldset>'
    );
  }

  function buildMemberLookup(props, fieldId, field) {
    var catalogTypes = catalogDataSourceEntityTypes(field);
    var uid = "gc-obj-edit-ml-" + fieldId;
    var multi = parseBoolLike(props && props.multi);
    if (props && props.source && props.source.multi != null) {
      multi = parseBoolLike(props.source.multi);
    }
    if (catalogTypes.length) {
      props = props && typeof props === "object" ? props : {};
      props.source = props.source && typeof props.source === "object" ? props.source : {};
      props.source.entity = catalogTypes.slice();
    }
    var wrap = document.createElement("div");
    wrap.className =
      "gc-designer-dd gc-designer-member-lookup" + (multi ? " gc-designer-dd--multi" : "");
    wrap.id = uid;
    wrap.setAttribute("data-gc-designer-dd", "");
    wrap.setAttribute("data-gc-designer-member-lookup", "1");
    wrap.setAttribute("data-gc-member-lookup-status-id", uid + "-ml-status");
    if (catalogTypes.length) {
      wrap.setAttribute("data-gc-ml-catalog-entity-types", JSON.stringify(catalogTypes));
    }
    wrap.innerHTML =
      '<div class="gc-designer-dd__shell">' +
      '<button type="button" class="settings-form__input gc-designer-dd__trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="Select cached objects">' +
      (multi ? "None selected" : "Choose…") +
      "</button>" +
      '<div class="gc-designer-dd__panel" hidden>' +
      '<div class="gc-designer-dd__search-wrap">' +
      '<input type="search" class="settings-form__input mono gc-designer-dd__search" placeholder="Filter…" autocomplete="off" aria-label="Filter member lookup" />' +
      "</div>" +
      '<div class="gc-designer-member-lookup__toolbar">' +
      '<button type="button" class="btn btn--text gc-designer-member-lookup__select-all">Select all shown</button>' +
      "</div>" +
      '<ul class="gc-designer-dd__list' +
      (multi ? " gc-designer-dd__list--multi" : "") +
      '" role="listbox" ' +
      (multi ? 'aria-multiselectable="true" ' : "") +
      'aria-label="Cached object names"></ul></div></div>' +
      '<p class="gc-designer-member-lookup__status settings-form__status" id="' +
      escapeAttr(uid + "-ml-status") +
      '" aria-live="polite"></p>';
    var RT = (window.__gcDesignerControlsBridge || {}).ddFieldRuntime;
    var CF = (window.__gcDesignerControlsBridge || {}).catalogFieldUi || {};
    if (RT) {
      var fs = RT.designerDdSourceFs(wrap);
      if (fs && props.source) RT.restoreMemberLookupSourceFsCatalog(fs, props.source);
      RT.wireSearchableDropdown(wrap);
      RT.bindMemberLookupAutoReload(wrap);
      setTimeout(function () {
        RT.loadMemberLookupFromCache(wrap, RT.memberLookupStatusElement(wrap), true);
        if (multi) {
          if (props.selection != null && typeof CF.ddSetMultiSelection === "function") {
            CF.ddSetMultiSelection(wrap, props.selection);
          }
        } else {
          if (props.selection && props.selection.value != null && typeof CF.ddSetSingleSelection === "function") {
            CF.ddSetSingleSelection(wrap, props.selection.value);
          } else if (props.selectedValue != null && typeof CF.ddSetSingleSelection === "function") {
            CF.ddSetSingleSelection(wrap, props.selectedValue);
          }
        }
      }, 0);
    }
    return wrap;
  }

  function buildDropdown(props, fieldId, multi, field) {
    var uid = "gc-obj-edit-dd-" + fieldId;
    var wrap = document.createElement("div");
    wrap.className = "gc-designer-dd" + (multi ? " gc-designer-dd--multi" : "");
    wrap.id = uid;
    wrap.setAttribute("data-gc-designer-dd", "");
    wrap.setAttribute("data-gc-object-edit-dd", "1");
    var etypes = field ? catalogDataSourceEntityTypes(field) : [];
    if (etypes.length) {
      wrap.setAttribute("data-gc-dd-entity-types", JSON.stringify(etypes));
    } else {
      wrap.setAttribute("data-gc-dd-entity-types", JSON.stringify(["ip_host"]));
    }
    var lblId = uid + "-ddl";
    wrap.innerHTML =
      '<span class="gc-sr-only" id="' +
      escapeAttr(lblId) +
      '">Cached objects</span>' +
      '<div class="gc-designer-dd__shell">' +
      '<button type="button" class="settings-form__input gc-designer-dd__trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="' +
      escapeAttr(lblId) +
      '">' +
      (multi ? "None selected" : "Choose…") +
      "</button>" +
      '<div class="gc-designer-dd__panel" hidden>' +
      '<div class="gc-designer-dd__search-wrap">' +
      '<input type="search" class="settings-form__input mono gc-designer-dd__search" placeholder="Filter…" autocomplete="off" aria-label="Filter options" />' +
      "</div>" +
      '<ul class="gc-designer-dd__list' +
      (multi ? " gc-designer-dd__list--multi" : "") +
      '" role="listbox" ' +
      (multi ? 'aria-multiselectable="true" ' : "") +
      'aria-label="Cached objects"></ul></div></div>' +
      '<p class="gc-sr-only" id="' +
      escapeAttr(uid + "-dd-status") +
      '" aria-live="polite"></p>';
    var RT = (window.__gcDesignerControlsBridge || {}).ddFieldRuntime;
    var CF = (window.__gcDesignerControlsBridge || {}).catalogFieldUi || {};
    if (RT) {
      var fs = RT.designerDdSourceFs(wrap);
      if (fs && props.source) RT.restoreDdSourceFs(fs, props.source);
      RT.wireSearchableDropdown(wrap);
      RT.bindDesignerDdAutoLoad(wrap, uid + "-dd-status");
      setTimeout(function () {
        RT.loadDesignerDdFromCache(wrap, document.getElementById(uid + "-dd-status"), true);
        if (multi) {
          if (props.selection != null && typeof CF.ddSetMultiSelection === "function") {
            CF.ddSetMultiSelection(wrap, props.selection);
          }
        } else {
          if (props.selection && props.selection.value != null && typeof CF.ddSetSingleSelection === "function") {
            CF.ddSetSingleSelection(wrap, props.selection.value);
          } else if (props.selectedValue != null && typeof CF.ddSetSingleSelection === "function") {
            CF.ddSetSingleSelection(wrap, props.selectedValue);
          }
        }
      }, 0);
    }
    return wrap;
  }

  function buildControlForType(detRaw, props, field) {
    if (isSkippableDataEntryType(detRaw)) return null;
    var det = trimStr(detRaw).toLowerCase();
    switch (det) {
      case "hidden":
        return null;
      case "text-single":
        return buildTextSingle(props);
      case "text-multiline":
        return buildTextMultiline(props);
      case "text-config":
        return buildTextConfig(props);
      case "selector":
        return buildSelector(props, field.id);
      case "tag-editor":
        return buildTagEditor(props, field.id);
      case "ip-address":
        return buildIpAddressControl(props, field.id);
      case "ip-list":
        return buildIpListField(props, field.id);
      case "ip-ipv4":
        return buildIpField(props, "ipv4", field.id);
      case "ip-ipv6":
        return buildIpField(props, "ipv6", field.id);
      case "dropdown-single":
        return buildDropdown(props, field.id, false, field);
      case "dropdown-multi":
        return buildDropdown(props, field.id, true, field);
      case "member-lookup":
        return buildMemberLookup(props, field.id, field);
      case "data-entry-table-col-text":
        return buildTextSingle(props);
      case "data-entry-table-col-selection": {
        var p2 = Object.assign({}, props);
        if (field.allowed_options && Array.isArray(field.allowed_options)) {
          var ao2 = [];
          field.allowed_options.forEach(function (x) {
            var t = String(x != null ? x : "").trim();
            if (t) ao2.push(t);
          });
          if (ao2.length) p2.items = ao2;
        }
        var selOnly = document.createElement("select");
        selOnly.className =
          "settings-form__input mono gc-if-flyout__input gc-if-flyout__select gc-bridge-flyout__member-select";
        var items = Array.isArray(p2.items) ? p2.items : [""];
        items.forEach(function (v) {
          var o = document.createElement("option");
          o.value = String(v);
          o.textContent = String(v) || "(empty)";
          selOnly.appendChild(o);
        });
        if (props.value != null && String(props.value) !== "") selOnly.value = String(props.value);
        return selOnly;
      }
      case "data-entry-table-col-time": {
        var selTime = document.createElement("select");
        selTime.className =
          "settings-form__input mono gc-if-flyout__input gc-if-flyout__select gc-bridge-flyout__member-select";
        fillDataEntryTableColTimeSelect(selTime, props.value);
        return selTime;
      }
      case "data-entry-table-col-toggle": {
        var cb2 = document.createElement("input");
        cb2.type = "checkbox";
        cb2.className = "settings-form__input";
        cb2.checked = parseBoolLike(props.value);
        return cb2;
      }
      case "data-entry-table":
      case "ip-constraint":
      case "edit-flyout":
      case "tag-save":
      case "dropdown-shared":
      default:
        return buildDefaultText(props);
    }
  }

  function buildRowValueLookup(catalogHydrateOpts) {
    var cells =
      catalogHydrateOpts &&
      catalogHydrateOpts.cells &&
      typeof catalogHydrateOpts.cells === "object"
        ? catalogHydrateOpts.cells
        : null;
    var flat =
      catalogHydrateOpts &&
      catalogHydrateOpts.flat &&
      typeof catalogHydrateOpts.flat === "object"
        ? catalogHydrateOpts.flat
        : null;
    return function valueForProperty(propertyName) {
      var p = trimStr(propertyName);
      if (!p) return null;
      function fromMap(map) {
        if (!map) return null;
        if (!Object.prototype.hasOwnProperty.call(map, p)) return null;
        var v = map[p];
        if (v == null) return null;
        return String(v);
      }
      var hit = fromMap(cells);
      if (hit != null) return hit;
      hit = fromMap(flat);
      if (hit != null) return hit;
      var leaf = p.indexOf(".") >= 0 ? p.slice(p.lastIndexOf(".") + 1) : p;
      if (leaf === "Name" || p === "Name") {
        if (cells && Object.prototype.hasOwnProperty.call(cells, "__name")) {
          var cn = cells.__name;
          if (cn != null) return String(cn);
        }
        if (flat && Object.prototype.hasOwnProperty.call(flat, "Name")) {
          var fn = flat.Name;
          if (fn != null) return String(fn);
        }
      }
      return null;
    };
  }

  function applyObjectEditCatalogRowValues(fieldsEl, valueForProperty) {
    if (!fieldsEl || typeof valueForProperty !== "function") return;
    var CF = (window.__gcDesignerControlsBridge || {}).catalogFieldUi;
    fieldsEl.querySelectorAll(".gc-designer-object-edit-catalog-row").forEach(function (rowEl) {
      var prop = rowEl.getAttribute("data-gc-catalog-property") || "";
      if (!trimStr(prop)) return;
      var val = valueForProperty(prop);
      if (val == null) return;
      var sval = String(val);

      var ipList = rowEl.querySelector("[data-gc-ip-list]");
      if (ipList && typeof ipList.gcSetIpListValue === "function") {
        ipList.gcSetIpListValue(sval);
        return;
      }

      var ipAddrRoot = rowEl.querySelector('[data-gc-obj-edit-ip-address="1"]');
      if (ipAddrRoot) {
        var famSel = ipAddrRoot.querySelector("select.gc-obj-edit-ip-address__family");
        var inp4 = ipAddrRoot.querySelector('[data-gc-obj-edit-ip-panel="ipv4"] input.gc-ip-field__input');
        var inp6 = ipAddrRoot.querySelector('[data-gc-obj-edit-ip-panel="ipv6"] input.gc-ip-field__input');
        var trimmed = trimStr(sval);
        var defFam = rowEl.getAttribute("data-gc-catalog-default-ip-family") || "IPv4";
        var use6 = trimmed.indexOf(":") >= 0;
        if (famSel) {
          if (!trimmed) {
            famSel.value = defFam === "IPv6" ? "IPv6" : "IPv4";
          } else {
            famSel.value = use6 ? "IPv6" : "IPv4";
          }
          var is6b = famSel.value === "IPv6";
          var v4w = ipAddrRoot.querySelector(".gc-obj-edit-ip-address-fields-v4");
          var v6w = ipAddrRoot.querySelector(".gc-obj-edit-ip-address-fields-v6");
          if (v4w) v4w.hidden = is6b;
          if (v6w) v6w.hidden = !is6b;
        }
        var tgt = famSel && famSel.value === "IPv6" ? inp6 : inp4;
        if (tgt) {
          tgt.value = sval;
          try {
            tgt.dispatchEvent(new Event("input", { bubbles: true }));
            tgt.dispatchEvent(new Event("blur"));
          } catch (eIp) {}
        }
        return;
      }

      var ipInp = rowEl.querySelector("input.gc-ip-field__input");
      if (ipInp) {
        ipInp.value = sval;
        try {
          ipInp.dispatchEvent(new Event("input", { bubbles: true }));
          ipInp.dispatchEvent(new Event("blur"));
        } catch (eIp2) {}
        return;
      }

      var ta = rowEl.querySelector("textarea.settings-form__input");
      if (ta) {
        ta.value = sval;
        return;
      }

      var ddEarly = rowEl.querySelector("[data-gc-designer-dd]");
      if (ddEarly && CF) {
        setTimeout(function () {
          try {
            if (
              ddEarly.classList.contains("gc-designer-dd--multi") &&
              typeof CF.ddSetMultiSelection === "function"
            ) {
              var pickedVals = sval
                .split(/\x1e|[;,]/)
                .map(function (x) {
                  return trimStr(x);
                })
                .filter(Boolean);
              CF.ddSetMultiSelection(ddEarly, pickedVals);
            } else if (typeof CF.ddSetSingleSelection === "function") {
              CF.ddSetSingleSelection(ddEarly, sval);
            }
          } catch (eDdEarly) {}
        }, 120);
        return;
      }

      var inp = rowEl.querySelector(
        "input.settings-form__input:not([type=\"hidden\"]):not(.gc-designer-dd__search)",
      );
      if (inp && inp.type !== "checkbox" && inp.type !== "radio") {
        inp.value = sval;
        return;
      }

      var optSel = rowEl.querySelector("[data-gc-option-selector]");
      if (optSel && window.gcOptionSelectorSetSelection) {
        window.gcOptionSelectorSetSelection(optSel, sval, NaN);
        if (typeof globalThis.gcOptionSelectorSyncLayout === "function") {
          globalThis.gcOptionSelectorSyncLayout(optSel);
        }
        return;
      }

      var tagRoot = rowEl.querySelector("[data-gc-designer-tag-editor]");
      if (tagRoot) {
        var api = tagRoot._gcDesignerTagApi;
        if (api && api.setTags) {
          var tags =
            sval.indexOf("\x1e") >= 0
              ? sval
                  .split("\x1e")
                  .map(function (x) {
                    return trimStr(x);
                  })
                  .filter(Boolean)
              : sval
                  .split(/[;,]/)
                  .map(function (x) {
                    return trimStr(x);
                  })
                  .filter(Boolean);
          if (tags.length) api.setTags(tags);
        }
        return;
      }
    });
  }

  function reevalLayoutFromDataEntryTable() {
    if (typeof reevalObjectEditLayoutFromCurrentInputs === "function") {
      reevalObjectEditLayoutFromCurrentInputs();
    }
  }

  function wireDataEntryTableEvents(root) {
    root.addEventListener("input", function (ev) {
      if (ev.isTrusted === false) return;
      if (!ev.target.closest || !ev.target.closest("[data-gc-det-table-root]")) return;
      reevalLayoutFromDataEntryTable();
    });
    root.addEventListener("change", function (ev) {
      if (ev.isTrusted === false) return;
      if (!ev.target.closest || !ev.target.closest("[data-gc-det-table-root]")) return;
      reevalLayoutFromDataEntryTable();
    });
  }

  function buildTableCellForColumn(colField, cellVal, isBlankTemplateRow) {
    var det = trimStr(colField.data_entry_type).toLowerCase();
    var props = parsePropsJson(colField.data_entry_properties);
    var wrap = document.createElement("div");
    wrap.className = "gc-data-entry-table__cell-inner";
    if (det === "data-entry-table-col-selection") {
      var sel = document.createElement("select");
      sel.className =
        "settings-form__input mono gc-if-flyout__input gc-if-flyout__select gc-bridge-flyout__member-select";
      sel.setAttribute(
        "aria-label",
        trimStr(colField.show_as) || trimStr(colField.property_name) || "Value",
      );
      var opts = [];
      if (colField.allowed_options && Array.isArray(colField.allowed_options)) {
        colField.allowed_options.forEach(function (x) {
          var t = String(x != null ? x : "").trim();
          if (t) opts.push(t);
        });
      }
      if (Array.isArray(props.items)) {
        props.items.forEach(function (x) {
          var t = trimStr(x != null ? String(x) : "");
          if (t) opts.push(t);
        });
      }
      if (!opts.length) opts.push("");
      opts.forEach(function (v) {
        var o = document.createElement("option");
        o.value = v;
        o.textContent = v || "(empty)";
        sel.appendChild(o);
      });
      if (cellVal != null && String(cellVal) !== "") sel.value = String(cellVal);
      wrap.appendChild(sel);
      return wrap;
    }
    if (det === "data-entry-table-col-time") {
      var selT = document.createElement("select");
      selT.className =
        "settings-form__input mono gc-if-flyout__input gc-if-flyout__select gc-bridge-flyout__member-select";
      selT.setAttribute(
        "aria-label",
        trimStr(colField.show_as) || trimStr(colField.property_name) || "Time",
      );
      fillDataEntryTableColTimeSelect(selT, cellVal);
      wrap.appendChild(selT);
      return wrap;
    }
    if (det === "data-entry-table-col-toggle") {
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "settings-form__input";
      cb.checked = parseBoolLike(cellVal);
      cb.setAttribute(
        "aria-label",
        trimStr(colField.show_as) || trimStr(colField.property_name) || "",
      );
      wrap.appendChild(cb);
      return wrap;
    }
    var textVal = cellVal != null ? String(cellVal) : "";
    if (
      det === "data-entry-table-col-text" &&
      !trimStr(textVal) &&
      isObjectEditFlyoutAddMode() &&
      !isBlankTemplateRow
    ) {
      var dvCol = props.defaultValue;
      if (dvCol != null && trimStr(String(dvCol)) !== "") {
        textVal = String(dvCol);
      }
    }
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "settings-form__input mono gc-if-flyout__input";
    inp.autocomplete = "off";
    inp.value = textVal;
    inp.setAttribute(
      "aria-label",
      trimStr(colField.show_as) || trimStr(colField.property_name) || "",
    );
    wrap.appendChild(inp);
    return wrap;
  }

  function appendDataEntryTableRow(tb, colFields, cells, isBlank) {
    var tr = document.createElement("tr");
    tr.setAttribute("data-gc-det-data-row", "1");
    if (isBlank) tr.setAttribute("data-gc-det-blank", "1");
    colFields.forEach(function (cf) {
      var fid = String(cf.id || "");
      var td = document.createElement("td");
      td.setAttribute("data-gc-det-col-field-id", fid);
      var v = cells && Object.prototype.hasOwnProperty.call(cells, fid) ? cells[fid] : "";
      td.appendChild(buildTableCellForColumn(cf, v, isBlank));
      tr.appendChild(td);
    });
    var tdAct = document.createElement("td");
    tdAct.className = "gc-bridge-flyout__members-actions-col";
    var rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn-icon gc-bridge-flyout__member-remove gc-data-entry-table__rm";
    rm.innerHTML = window.gcIcon
      ? window.gcIcon("delete", { size: "xs", cls: "gc-bridge-flyout__member-trash-svg" })
      : '<span aria-hidden="true">\u00d7</span>';
    rm.setAttribute("aria-label", isBlank ? "New row" : "Remove row");
    if (isBlank) {
      rm.disabled = true;
      rm.classList.add("gc-bridge-flyout__member-remove--blank");
    }
    tdAct.appendChild(rm);
    tr.appendChild(tdAct);
    tb.appendChild(tr);
  }

  function promoteBlankDataEntryRow(tr, tb, colFields) {
    tr.removeAttribute("data-gc-det-blank");
    var rm = tr.querySelector(".gc-data-entry-table__rm");
    if (rm) {
      rm.disabled = false;
      rm.classList.remove("gc-bridge-flyout__member-remove--blank");
      rm.setAttribute("aria-label", "Remove row");
    }
    appendDataEntryTableRow(tb, colFields, {}, true);
  }

  function bindDataEntryTableRowButtons(wrap, colFields) {
    var tb = wrap.querySelector(".gc-data-entry-table__table tbody");
    if (!tb) return;
    tb.addEventListener("click", function (ev) {
      var btn = ev.target.closest && ev.target.closest(".gc-data-entry-table__rm");
      if (!btn || !tb.contains(btn)) return;
      var tr = btn.closest("tr");
      if (!tr || tr.getAttribute("data-gc-det-blank") === "1") return;
      tr.remove();
      reevalLayoutFromDataEntryTable();
    });
    tb.addEventListener("input", function (ev) {
      if (ev.isTrusted === false) return;
      var inp = ev.target.closest && ev.target.closest("input");
      if (!inp || !tb.contains(inp)) return;
      var tr = inp.closest("tr");
      if (!tr || tr.getAttribute("data-gc-det-blank") !== "1") return;
      if (trimStr(inp.value) !== "") promoteBlankDataEntryRow(tr, tb, colFields);
    });
    tb.addEventListener("change", function (ev) {
      if (ev.isTrusted === false) return;
      var sel = ev.target.closest && ev.target.closest("select");
      if (!sel || !tb.contains(sel)) return;
      var tr = sel.closest("tr");
      if (!tr || tr.getAttribute("data-gc-det-blank") !== "1") return;
      if (trimStr(sel.value) !== "") promoteBlankDataEntryRow(tr, tb, colFields);
    });
  }

  function buildDataEntryTableControl(parentField, columnFields) {
    var wrap = document.createElement("div");
    wrap.className = "gc-data-entry-table";
    wrap.setAttribute("data-gc-det-table-root", "1");
    wrap.setAttribute("data-gc-catalog-field-id", String(parentField.id || ""));
    var inner = document.createElement("div");
    inner.className = "gc-bridge-flyout__members-table-wrap";
    var table = document.createElement("table");
    table.className =
      "gc-bridge-flyout__members-table gc-data-entry-table__table data-table data-table--dense";
    table.setAttribute(
      "aria-label",
      trimStr(parentField.show_as) || trimStr(parentField.property_name) || "Rows",
    );
    var cg = document.createElement("colgroup");
    columnFields.forEach(function () {
      var col = document.createElement("col");
      col.className = "gc-data-entry-table__col";
      cg.appendChild(col);
    });
    var cAct = document.createElement("col");
    cAct.className = "gc-data-entry-table__col-actions";
    cg.appendChild(cAct);
    table.appendChild(cg);
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    columnFields.forEach(function (cf) {
      var th = document.createElement("th");
      th.setAttribute("scope", "col");
      th.setAttribute("data-gc-det-col-field-id", String(cf.id || ""));
      th.textContent =
        trimStr(cf.show_as) !== ""
          ? trimStr(cf.show_as)
          : trimStr(cf.property_name) || "Column";
      hr.appendChild(th);
    });
    var tha = document.createElement("th");
    tha.className = "gc-bridge-flyout__members-actions-col";
    tha.setAttribute("scope", "col");
    hr.appendChild(tha);
    thead.appendChild(hr);
    table.appendChild(thead);
    var tb = document.createElement("tbody");
    table.appendChild(tb);
    inner.appendChild(table);
    wrap.appendChild(inner);
    var st = globalThis.__gcObjectEditFlyoutState;
    var rowData = st && st.row && typeof st.row === "object" ? st.row : {};
    var rows =
      typeof globalThis.gcDataEntryTableParseRowsFromFlat === "function"
        ? globalThis.gcDataEntryTableParseRowsFromFlat(rowData, parentField, columnFields)
        : [];
    if (!rows.length && !isObjectEditFlyoutAddMode()) {
      rows = [{ cells: {} }];
    }
    rows.forEach(function (r) {
      appendDataEntryTableRow(tb, columnFields, r.cells, false);
    });
    appendDataEntryTableRow(tb, columnFields, {}, true);
    bindDataEntryTableRowButtons(wrap, columnFields);
    wireDataEntryTableEvents(wrap);
    return wrap;
  }

  function renderFields(container, statusEl, fields) {
    container.innerHTML = "";
    var visible = 0;
    var fieldsForRender = dedupeIpFamilyCatalogFields(fields || []);
    var allFields =
      globalThis.__gcObjectEditFlyoutState && Array.isArray(globalThis.__gcObjectEditFlyoutState.allFields)
        ? globalThis.__gcObjectEditFlyoutState.allFields
        : fields || [];
    var hasSeparateIpFamily = catalogFieldsHaveSeparateIpFamilyRow(fieldsForRender);
    fieldsForRender.forEach(function (f) {
      var det = f.data_entry_type != null ? String(f.data_entry_type) : "";
      if (isSkippableDataEntryType(det)) return;
      if (
        typeof globalThis.gcDataEntryTableIsColumnField === "function" &&
        globalThis.gcDataEntryTableIsColumnField(f, allFields)
      ) {
        return;
      }
      var props = parsePropsJson(f.data_entry_properties);
      var detLower = trimStr(det).toLowerCase();
      if (
        detLower === "ip-address" ||
        detLower === "ip-ipv4" ||
        detLower === "ip-ipv6"
      ) {
        props = Object.assign({ autocorrect: true }, props);
      }
      if (detLower === "ip-address" && hasSeparateIpFamily) {
        props = Object.assign({}, props, { useExternalIpFamilyRow: true });
      }
      if (detLower === "ip-address") {
        props = Object.assign({}, props, { suppressInnerIpPanelLabels: true });
      }
      if (detLower === "selector" && f.allowed_options && Array.isArray(f.allowed_options)) {
        var ao = [];
        f.allowed_options.forEach(function (x) {
          var t = String(x != null ? x : "").trim();
          if (t) ao.push(t);
        });
        if (ao.length) props.items = ao;
      }
      if (
        isObjectEditFlyoutAddMode() &&
        (detLower === "text-single" ||
          detLower === "text-multiline" ||
          detLower === "data-entry-table-col-text")
      ) {
        var dvSeed = props.defaultValue;
        var curPv = props.value != null ? String(props.value) : "";
        if (dvSeed != null && trimStr(String(dvSeed)) !== "" && !trimStr(curPv)) {
          props = Object.assign({}, props, { value: String(dvSeed) });
        }
      }
      var label =
        f.show_as != null && trimStr(f.show_as) !== ""
          ? trimStr(f.show_as)
          : f.property_name != null
            ? String(f.property_name)
            : "Field";
      var help = f.help_text != null ? String(f.help_text) : "";
      var ctrl;
      if (detLower === "data-entry-table") {
        if (typeof globalThis.gcDataEntryTableColumnFieldsForParent !== "function") {
          ctrl = buildDefaultText(props);
        } else {
          var cols = globalThis.gcDataEntryTableColumnFieldsForParent(f, allFields).filter(function (c) {
            return !isSkippableDataEntryType(c && c.data_entry_type);
          });
          ctrl = buildDataEntryTableControl(f, cols);
        }
      } else {
        ctrl = buildControlForType(det, props, f);
      }
      if (!ctrl) return;
      var row = document.createElement("div");
      row.className = "settings-form__field gc-designer-object-edit-catalog-row";
      row.setAttribute("data-gc-catalog-property", f.property_name != null ? String(f.property_name) : "");
      row.setAttribute("data-gc-catalog-field-id", f.id != null ? String(f.id) : "");
      if (detLower === "ip-address") {
        row.setAttribute(
          "data-gc-catalog-default-ip-family",
          ipFamilyFromProps(props) === "ipv6" ? "IPv6" : "IPv4",
        );
      }
      if (detLower !== "member-lookup") {
        row.appendChild(buildLabelRow(label, help));
      } else if (trimStr(help)) {
        row.appendChild(buildLabelRow("", help));
      }
      row.appendChild(ctrl);
      container.appendChild(row);
      visible++;
    });
    if (statusEl) {
      if (!visible) {
        statusEl.textContent =
          "No visible fields for this type (all Hidden or empty catalog). Run config sync and use Designer · Layouts to map fields.";
        statusEl.hidden = false;
      } else {
        statusEl.textContent = "";
        statusEl.hidden = true;
      }
    }
    notifyObjectEditCatalogVisibleFieldCount(visible);
  }

  var hydrateObjectEditCatalogSeq = 0;
  var objectEditSelectorReevalWired = false;

  function truthyLayoutFlag(map, key) {
    if (!map || typeof map !== "object" || !key) return false;
    if (!Object.prototype.hasOwnProperty.call(map, key)) return false;
    var v = map[key];
    if (v === true) return true;
    if (v === false || v == null) return false;
    var s = trimStr(String(v)).toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on";
  }

  function applyObjectEditFlyoutControlLocks() {
    var st = globalThis.__gcObjectEditFlyoutState;
    var fieldsEl = document.getElementById("gc-designer-object-edit-catalog-fields");
    if (!st || !fieldsEl) return;
    var mode = trimStr(st.mode || "edit").toLowerCase() === "add" ? "add" : "edit";
    var cmap =
      st.layout && st.layout.control_add_only && typeof st.layout.control_add_only === "object"
        ? st.layout.control_add_only
        : {};

    function setLocked(el, on) {
      if (!el || el.nodeType !== 1) return;
      if (el.classList && el.classList.contains("gc-object-edit-help-icon")) return;
      var tag = el.tagName;
      if (on) {
        if (el.dataset.gcObjEditLocked === "1") return;
        el.dataset.gcObjEditPrevRo = el.readOnly ? "1" : "0";
        el.dataset.gcObjEditPrevDis = el.disabled ? "1" : "0";
        el.dataset.gcObjEditLocked = "1";
        if (tag === "SELECT") el.disabled = true;
        else if (tag === "BUTTON") el.disabled = true;
        else if (tag === "INPUT") {
          var t = String(el.type || "").toLowerCase();
          if (t === "checkbox" || t === "radio" || t === "button" || t === "submit" || t === "reset") {
            el.disabled = true;
          } else {
            el.readOnly = true;
          }
        } else if (tag === "TEXTAREA") el.readOnly = true;
      } else if (el.dataset.gcObjEditLocked === "1") {
        el.readOnly = el.dataset.gcObjEditPrevRo === "1";
        el.disabled = el.dataset.gcObjEditPrevDis === "1";
        delete el.dataset.gcObjEditLocked;
        delete el.dataset.gcObjEditPrevRo;
        delete el.dataset.gcObjEditPrevDis;
      }
    }

    fieldsEl.querySelectorAll(".gc-designer-object-edit-catalog-row").forEach(function (rowEl) {
      var fid = trimStr(rowEl.getAttribute("data-gc-catalog-field-id"));
      var ctrlId = fid ? "ctrl:" + fid : "";
      var hiddenRow = rowEl.hidden || rowEl.style.display === "none";
      var wantLock = !hiddenRow && mode === "edit" && ctrlId && truthyLayoutFlag(cmap, ctrlId);
      rowEl.classList.toggle("gc-object-edit-catalog-row--add-only-locked", wantLock);
      rowEl.querySelectorAll("input, textarea, select, button").forEach(function (el) {
        if (el.classList && el.classList.contains("gc-object-edit-help-icon")) return;
        if (el.closest && el.closest(".gc-object-edit-help-icon")) return;
        setLocked(el, wantLock);
      });
    });
  }

  function reevalObjectEditLayoutFromCurrentInputs() {
    var st = globalThis.__gcObjectEditFlyoutState;
    var fieldsEl = document.getElementById("gc-designer-object-edit-catalog-fields");
    if (
      !st ||
      !st.nodeCatalog ||
      !st.connections ||
      !fieldsEl ||
      typeof globalThis.gcDcLayoutReevalObjectEditCatalogFromDom !== "function"
    ) {
      return;
    }
    var fieldList = st.allFields && st.allFields.length ? st.allFields : st.fields;
    globalThis.gcDcLayoutReevalObjectEditCatalogFromDom(
      st.nodeCatalog,
      st.connections,
      fieldList,
      st.row && typeof st.row === "object" ? st.row : {},
      fieldsEl,
    );
    notifyObjectEditCatalogVisibleFieldCount(countVisibleCatalogRows());
    applyObjectEditFlyoutControlLocks();
  }

  function applyMemberLookupLayoutDataSourcesFromLayout(fieldsEl, layout) {
    if (!fieldsEl) return;
    var map =
      layout &&
      layout.member_lookup_data_source &&
      typeof layout.member_lookup_data_source === "object" &&
      !Array.isArray(layout.member_lookup_data_source)
        ? layout.member_lookup_data_source
        : {};
    fieldsEl.querySelectorAll("[data-gc-designer-member-lookup]").forEach(function (root) {
      var row = root.closest(".gc-designer-object-edit-catalog-row");
      var fid = row ? trimStr(row.getAttribute("data-gc-catalog-field-id")) : "";
      var ctrlId = fid ? "ctrl:" + fid : "";
      var srcEt = ctrlId && map[ctrlId] ? trimStr(map[ctrlId]) : "";
      if (srcEt && ENTITY_TYPE_RE.test(srcEt)) {
        root.setAttribute("data-gc-ml-layout-source-type", srcEt);
      } else {
        root.removeAttribute("data-gc-ml-layout-source-type");
      }
    });
  }

  function applyMemberLookupMultiFromLayout(fields, layout) {
    var map =
      layout &&
      layout.member_lookup_multi &&
      typeof layout.member_lookup_multi === "object" &&
      !Array.isArray(layout.member_lookup_multi)
        ? layout.member_lookup_multi
        : {};
    return (fields || []).map(function (field) {
      var f = field && typeof field === "object" ? field : {};
      var fid = trimStr(f.id);
      var ctrlId = fid ? "ctrl:" + fid : "";
      if (!ctrlId || !Object.prototype.hasOwnProperty.call(map, ctrlId)) return f;
      if (trimStr(f.data_entry_type).toLowerCase() !== "member-lookup") return f;
      var nextOn = parseBoolLike(map[ctrlId]);
      var props = parsePropsJson(f.data_entry_properties);
      props.multi = nextOn;
      props.source = props.source && typeof props.source === "object" ? props.source : {};
      props.source.multi = nextOn;
      return Object.assign({}, f, { data_entry_properties: JSON.stringify(props) });
    });
  }

  function wireObjectEditSelectorReeval() {
    if (objectEditSelectorReevalWired) return;
    objectEditSelectorReevalWired = true;

    document.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".gc-option-selector__btn") : null;
      if (!btn) return;
      var host = document.getElementById("gc-designer-object-edit-catalog-fields");
      if (!host || !host.contains(btn)) return;
      // Option selector pills are toggled by delegated document click handling;
      // run after that mutation so flow reads the latest selected pill.
      setTimeout(reevalObjectEditLayoutFromCurrentInputs, 0);
    });

    document.addEventListener("change", function (ev) {
      var sel =
        ev.target && ev.target.closest
          ? ev.target.closest("select.gc-option-selector__native")
          : null;
      if (!sel) return;
      var host = document.getElementById("gc-designer-object-edit-catalog-fields");
      if (!host || !host.contains(sel)) return;
      reevalObjectEditLayoutFromCurrentInputs();
    });
  }

  function hydrateObjectEditCatalogFields(entityTypeOverride, catalogHydrateOpts) {
    var host = document.getElementById("gc-designer-object-edit-catalog-host");
    var fieldsEl = document.getElementById("gc-designer-object-edit-catalog-fields");
    var statusEl = document.getElementById("gc-designer-object-edit-catalog-status");
    var etIn = document.getElementById("gc-designer-modals-prop-object-edit-entity-type");
    if (!host || !fieldsEl) return;
    var ov = trimStr(entityTypeOverride);
    var et = ov !== "" ? ov : etIn ? trimStr(etIn.value) : "";
    hideHelpPopover();
    if (!et) {
      host.hidden = true;
      fieldsEl.innerHTML = "";
      globalThis.__gcObjectEditFlyoutState = null;
      if (statusEl) {
        statusEl.textContent = "";
        statusEl.hidden = true;
      }
      notifyObjectEditCatalogVisibleFieldCount(0);
      return;
    }
    if (!ENTITY_TYPE_RE.test(et)) {
      host.hidden = false;
      fieldsEl.innerHTML = "";
      if (statusEl) {
        statusEl.textContent =
          "Object type must match API pattern (letter + up to 31 letters, digits, underscore) to load the catalog.";
        statusEl.hidden = false;
      }
      notifyObjectEditCatalogVisibleFieldCount(0);
      return;
    }
    host.hidden = false;
    fieldsEl.innerHTML = "";
    if (statusEl) {
      statusEl.textContent = "Loading table fields…";
      statusEl.hidden = false;
    }
    notifyObjectEditCatalogVisibleFieldCount(0);
    var seq = ++hydrateObjectEditCatalogSeq;
    var fieldsUrl = "/api/firewalls/config-ui/entity-payload-fields/" + encodeURIComponent(et);
    var layoutUrl = "/api/firewalls/config-ui/data-controls-layout/" + encodeURIComponent(et);
    function fetchJsonOk(url) {
      return fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .catch(function () {
          return { ok: false, j: {} };
        });
    }
    Promise.all([fetchJsonOk(fieldsUrl), fetchJsonOk(layoutUrl)])
      .then(function (pair) {
        if (seq !== hydrateObjectEditCatalogSeq) return;
        var xf = pair[0];
        var xl = pair[1];
        if (!xf.ok || !xf.j || !Array.isArray(xf.j.fields)) {
          if (statusEl) {
            var msg = "Could not load catalog for this type.";
            var d = xf.j && xf.j.detail;
            if (typeof d === "string") msg = d;
            else if (Array.isArray(d) && d[0] && d[0].msg) msg = String(d[0].msg);
            statusEl.textContent = msg;
            statusEl.hidden = false;
          }
          globalThis.__gcObjectEditFlyoutState = null;
          notifyObjectEditCatalogVisibleFieldCount(0);
          return;
        }
        var layoutJson =
          xl && xl.ok && xl.j && xl.j.layout && typeof xl.j.layout === "object" ? xl.j.layout : {};
        var catalogFieldsIn = dedupeIpFamilyCatalogFields(
          applyMemberLookupMultiFromLayout(xf.j.fields.slice(), layoutJson),
        );
        var pack =
          typeof globalThis.gcDcLayoutOrderedFieldsForFlyout === "function"
            ? globalThis.gcDcLayoutOrderedFieldsForFlyout(catalogFieldsIn, layoutJson)
            : {
                fields: catalogFieldsIn,
                connections: [],
                nodeCatalog: {},
              };
        var flyoutMode =
          catalogHydrateOpts && trimStr(catalogHydrateOpts.mode).toLowerCase() === "add" ? "add" : "edit";
        var rowForFlow =
          catalogHydrateOpts && catalogHydrateOpts.row && typeof catalogHydrateOpts.row === "object"
            ? catalogHydrateOpts.row
            : {};
        if (!rowForFlow.cells && !rowForFlow.flat && catalogHydrateOpts) {
          rowForFlow = {
            cells: catalogHydrateOpts.cells && typeof catalogHydrateOpts.cells === "object"
              ? catalogHydrateOpts.cells
              : {},
            flat: catalogHydrateOpts.flat && typeof catalogHydrateOpts.flat === "object"
              ? catalogHydrateOpts.flat
              : {},
          };
        }
        globalThis.__gcObjectEditFlyoutState = {
          entityType: et,
          mode: flyoutMode,
          fields: pack.fields,
          allFields: catalogFieldsIn,
          layout: layoutJson,
          connections: pack.connections,
          nodeCatalog: pack.nodeCatalog,
          row: rowForFlow,
        };
        renderFields(fieldsEl, statusEl, pack.fields);
        applyMemberLookupLayoutDataSourcesFromLayout(fieldsEl, layoutJson);
        function applyLayoutFlowFromRow() {
          if (
            typeof globalThis.gcDcLayoutApplyFlowFromDesignToObjectEditCatalog !== "function" ||
            !pack.nodeCatalog ||
            !Object.keys(pack.nodeCatalog).length
          ) {
            return;
          }
          globalThis.gcDcLayoutApplyFlowFromDesignToObjectEditCatalog(
            pack.nodeCatalog,
            layoutJson,
            catalogFieldsIn,
            rowForFlow,
          );
          notifyObjectEditCatalogVisibleFieldCount(countVisibleCatalogRows());
          applyObjectEditFlyoutControlLocks();
        }
        var skipEntityHydrate = flyoutMode === "add";
        if (
          !skipEntityHydrate &&
          catalogHydrateOpts &&
          (catalogHydrateOpts.cells || catalogHydrateOpts.flat)
        ) {
          var lookup = buildRowValueLookup(catalogHydrateOpts);
          applyObjectEditCatalogRowValues(fieldsEl, lookup);
          applyLayoutFlowFromRow();
          setTimeout(function () {
            if (seq !== hydrateObjectEditCatalogSeq) return;
            applyObjectEditCatalogRowValues(fieldsEl, lookup);
            applyLayoutFlowFromRow();
          }, 180);
        } else {
          applyLayoutFlowFromRow();
        }
      })
      .catch(function () {
        if (seq !== hydrateObjectEditCatalogSeq) return;
        if (statusEl) {
          statusEl.textContent = "Network error loading catalog.";
          statusEl.hidden = false;
        }
        globalThis.__gcObjectEditFlyoutState = null;
        notifyObjectEditCatalogVisibleFieldCount(0);
      });
  }

  globalThis.gcDesignerDedupeIpFamilyCatalogFields = dedupeIpFamilyCatalogFields;
  globalThis.gcDesignerHydrateObjectEditCatalogFields = hydrateObjectEditCatalogFields;
  globalThis.gcDesignerApplyObjectEditFlyoutControlLocks = applyObjectEditFlyoutControlLocks;
  wireObjectEditSelectorReeval();

  globalThis.gcDesignerValidateObjectEditCatalogConstraints = function () {
    var host = document.getElementById("gc-designer-object-edit-catalog-fields");
    if (!host) return true;
    var firstBad = null;
    host.querySelectorAll("[data-gc-text-constraint]").forEach(function (el) {
      if (firstBad) return;
      if (typeof el.checkValidity === "function" && !el.checkValidity()) firstBad = el;
    });
    if (firstBad && typeof firstBad.reportValidity === "function") {
      firstBad.reportValidity();
      return false;
    }
    return true;
  };

  globalThis.gcDesignerObjectEditFlyoutCollectSave = function () {
    var st = globalThis.__gcObjectEditFlyoutState;
    var fieldsEl = document.getElementById("gc-designer-object-edit-catalog-fields");
    if (
      !st ||
      !st.nodeCatalog ||
      !st.connections ||
      !fieldsEl ||
      typeof globalThis.gcDcLayoutBuildSavePayload !== "function"
    ) {
      return {
        entity_type: st && st.entityType ? st.entityType : "",
        properties: {},
        row: st && st.row ? st.row : null,
      };
    }
    var fieldList = st.allFields && st.allFields.length ? st.allFields : st.fields;
    var save = globalThis.gcDcLayoutBuildSavePayload(
      st.nodeCatalog,
      st.connections,
      fieldList,
      fieldsEl,
    );
    return {
      entity_type: st.entityType || "",
      mode: trimStr(st.mode || "edit").toLowerCase() === "add" ? "add" : "edit",
      properties: save.properties || {},
      row: st.row || null,
    };
  };
})();
