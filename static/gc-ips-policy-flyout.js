/**
 * IPS policy flyout: view/edit cached policies; queue create/update through the task API.
 */
(function () {
  "use strict";

  var root = null;
  var els = {};
  var DD = {
    categories: [],
    severities: [],
    platforms: [],
    targets: [],
    rule_types: [],
    signature_selection: [],
    actions: [],
  };
  var mode = "edit";
  var currentRow = null;
  var rulesModel = [];
  var editingRuleIndex = -1;
  var CREATE_URL = "";
  var UPDATE_URL = "";
  var ruleEditorSnapshot = null;
  var RULE_PANEL_MS = 280;
  var rulePanelTransitionTimer = null;

  function bannerResult(ok, msg) {
    if (typeof window.gcGlobalBannerShowResult === "function") {
      window.gcGlobalBannerShowResult(ok, msg);
    } else {
      alert(msg);
    }
  }

  function dispatchTaskQueueUpdated() {
    try {
      document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
    } catch (e0) {}
  }

  function textScalar(v) {
    if (v == null) return "";
    if (typeof v === "object" && v !== null && v["#text"] != null) {
      return String(v["#text"]).trim();
    }
    return String(v).trim();
  }

  function listValues(obj, key) {
    if (!obj || typeof obj !== "object") return [];
    var v = obj[key];
    if (v == null) return [];
    if (Array.isArray(v)) {
      return v.map(textScalar).filter(function (s) {
        return s !== "";
      });
    }
    var one = textScalar(v);
    return one ? [one] : [];
  }

  function dimState(values) {
    if (!values || !values.length) return { all: true, selected: [] };
    if (values.length === 1 && String(values[0]).toLowerCase() === "all") {
      return { all: true, selected: [] };
    }
    return { all: false, selected: values.slice() };
  }

  function parseRuleFromCache(r) {
    if (!r || typeof r !== "object") r = {};
    var cats = dimState(listValues(r.CategoryList, "Category"));
    var sevs = dimState(listValues(r.SeverityList, "Severity"));
    var plats = dimState(listValues(r.PlatformList, "Platform"));
    var tgts = dimState(listValues(r.TargetList, "Target"));
    var sigs = listValues(r.SignatureList, "Signature");
    return {
      RuleName: textScalar(r.RuleName) || "",
      RuleType: textScalar(r.RuleType) || "Default Signature",
      SignaturSelectionType: textScalar(r.SignaturSelectionType) || "All Application",
      Action: textScalar(r.Action) || "Recommended",
      categories_all: cats.all,
      categories: cats.selected,
      severities_all: sevs.all,
      severities: sevs.selected,
      platforms_all: plats.all,
      platforms: plats.selected,
      targets_all: tgts.all,
      targets: tgts.selected,
      signatures: sigs.slice(),
      _cachedSigs: sigs.slice(),
    };
  }

  function defaultRule() {
    return {
      RuleName: "Rule 1",
      RuleType: "Default Signature",
      SignaturSelectionType: "All Application",
      Action: "Recommended",
      categories_all: true,
      categories: [],
      severities_all: true,
      severities: [],
      platforms_all: true,
      platforms: [],
      targets_all: true,
      targets: [],
      signatures: [],
      _cachedSigs: [],
    };
  }

  function fillSelect(sel, options, current) {
    if (!sel) return;
    var cur = String(current || "").trim();
    sel.innerHTML = "";
    (options || []).forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      sel.appendChild(o);
    });
    if (cur && Array.prototype.some.call(sel.options, function (op) { return op.value === cur; })) {
      sel.value = cur;
    } else if (sel.options.length) sel.selectedIndex = 0;
  }

  function optionsForMulti(arr) {
    return (arr || []).filter(function (x) {
      return String(x) !== "All";
    });
  }

  function stashPropForDim(dim) {
    if (dim === "cat") return "_stashCategories";
    if (dim === "sev") return "_stashSeverities";
    if (dim === "plat") return "_stashPlatforms";
    if (dim === "tgt") return "_stashTargets";
    return "";
  }

  function fillChecklist(ul, options, selectedArr) {
    if (!ul) return;
    var set = {};
    (selectedArr || []).forEach(function (s) {
      set[String(s).trim()] = true;
    });
    ul.innerHTML = "";
    (options || []).forEach(function (opt) {
      var li = document.createElement("li");
      var lab = document.createElement("label");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = opt;
      cb.checked = !!set[opt];
      var span = document.createElement("span");
      span.textContent = opt;
      lab.appendChild(cb);
      lab.appendChild(span);
      li.appendChild(lab);
      ul.appendChild(li);
    });
  }

  function readChecklist(ul) {
    if (!ul) return [];
    return Array.prototype.map
      .call(ul.querySelectorAll('input[type="checkbox"]'), function (inp) {
        return inp.checked ? inp.value : null;
      })
      .filter(Boolean);
  }

  function onAllCheckboxChange(rule, spec) {
    if (!spec.allCb || !spec.wrap || !spec.ul || !rule) return;
    if (spec.allCb.checked) {
      var cur = readChecklist(spec.ul);
      var sk = stashPropForDim(spec.dim);
      if (sk) rule[sk] = cur.slice();
      spec.wrap.hidden = true;
      spec.wrap.setAttribute("aria-hidden", "true");
    } else {
      var sk2 = stashPropForDim(spec.dim);
      var restore =
        sk2 && rule[sk2] && rule[sk2].length
          ? rule[sk2].slice()
          : (rule[spec.selKey] || []).slice();
      fillChecklist(spec.ul, spec.getOptions(), restore);
      spec.wrap.hidden = false;
      spec.wrap.setAttribute("aria-hidden", "false");
      applySmartFilter();
    }
  }

  function applySmartFilter() {
    var q = (els.smartFilter && els.smartFilter.value || "").trim().toLowerCase();
    getDimSpecs().forEach(function (spec) {
      if (!spec.wrap || spec.wrap.hidden || !spec.ul || !spec.emptyEl) return;
      var vis = 0;
      spec.ul.querySelectorAll("li").forEach(function (li) {
        var inp = li.querySelector("input");
        var v = (inp && inp.value ? String(inp.value) : "").toLowerCase();
        var match = !q || v.indexOf(q) >= 0;
        li.hidden = !match;
        if (match) vis++;
      });
      spec.emptyEl.hidden = vis > 0;
    });
  }

  function getDimSpecs() {
    return [
      {
        dim: "cat",
        allCb: els.catAll,
        wrap: els.catWrap,
        ul: els.catChecklist,
        emptyEl: els.catFilterEmpty,
        allKey: "categories_all",
        selKey: "categories",
        getOptions: function () {
          return optionsForMulti(DD.categories);
        },
      },
      {
        dim: "sev",
        allCb: els.sevAll,
        wrap: els.sevWrap,
        ul: els.sevChecklist,
        emptyEl: els.sevFilterEmpty,
        allKey: "severities_all",
        selKey: "severities",
        getOptions: function () {
          return optionsForMulti(DD.severities);
        },
      },
      {
        dim: "plat",
        allCb: els.platAll,
        wrap: els.platWrap,
        ul: els.platChecklist,
        emptyEl: els.platFilterEmpty,
        allKey: "platforms_all",
        selKey: "platforms",
        getOptions: function () {
          return optionsForMulti(DD.platforms);
        },
      },
      {
        dim: "tgt",
        allCb: els.tgtAll,
        wrap: els.tgtWrap,
        ul: els.tgtChecklist,
        emptyEl: els.tgtFilterEmpty,
        allKey: "targets_all",
        selKey: "targets",
        getOptions: function () {
          return optionsForMulti(DD.targets);
        },
      },
    ];
  }

  function wireDimensionSpecs() {
    getDimSpecs().forEach(function (spec) {
      if (!spec.allCb || spec.allCb.dataset.gcIpsDimBound === "1") return;
      spec.allCb.dataset.gcIpsDimBound = "1";
      spec.allCb.addEventListener("change", function () {
        var rule = rulesModel[editingRuleIndex];
        if (!rule) return;
        onAllCheckboxChange(rule, spec);
      });
    });
  }

  function syncAllDimensionsFromRule(rule) {
    if (!rule) return;
    getDimSpecs().forEach(function (spec) {
      if (!spec.allCb || !spec.wrap || !spec.ul) return;
      var allOn = !!rule[spec.allKey];
      spec.allCb.checked = allOn;
      if (allOn) {
        spec.wrap.hidden = true;
        spec.wrap.setAttribute("aria-hidden", "true");
        fillChecklist(spec.ul, spec.getOptions(), []);
      } else {
        spec.wrap.hidden = false;
        spec.wrap.setAttribute("aria-hidden", "false");
        fillChecklist(spec.ul, spec.getOptions(), rule[spec.selKey] || []);
        var sk = stashPropForDim(spec.dim);
        if (sk) rule[sk] = (rule[spec.selKey] || []).slice();
      }
    });
    applySmartFilter();
  }

  function ruleEditorSigSelection() {
    var r = root && root.querySelector('input[name="gc-ips-pol-sigsel"]:checked');
    return r ? String(r.value) : "All Application";
  }

  function syncSigSection() {
    var sec = els.sigSection;
    var ul = els.sigReadonly;
    var ta = els.sigTa;
    if (!sec) return;
    var indiv = ruleEditorSigSelection() === "Individual Application";
    sec.hidden = !indiv;
    sec.setAttribute("aria-hidden", indiv ? "false" : "true");
    if (!indiv) return;
    var rule = rulesModel[editingRuleIndex];
    var cached = rule && rule._cachedSigs && rule._cachedSigs.length ? rule._cachedSigs : [];
    var hint = root.querySelector("#gc-ips-pol-sig-cache-hint");
    if (ul) {
      ul.innerHTML = "";
      if (cached.length) {
        ul.hidden = false;
        if (hint) hint.hidden = false;
        cached.forEach(function (s) {
          var li = document.createElement("li");
          li.textContent = s;
          ul.appendChild(li);
        });
      } else {
        ul.hidden = true;
        if (hint) hint.hidden = true;
      }
    }
    if (ta && rule) {
      var lines = (rule.signatures && rule.signatures.length ? rule.signatures : cached).join("\n");
      ta.value = lines;
    }
  }

  function readMultiValuesFromChecklists() {
    return {
      categories: readChecklist(els.catChecklist),
      severities: readChecklist(els.sevChecklist),
      platforms: readChecklist(els.platChecklist),
      targets: readChecklist(els.tgtChecklist),
    };
  }

  function cloneRuleSnapshot(rule) {
    try {
      return JSON.parse(JSON.stringify(rule));
    } catch (e) {
      return null;
    }
  }

  function finishCloseRulePanel() {
    if (!root || !els.rulePanel) return;
    els.rulePanel.setAttribute("aria-hidden", "true");
    if (els.collapsedStrip) {
      els.collapsedStrip.hidden = true;
      els.collapsedStrip.setAttribute("aria-hidden", "true");
    }
    rulePanelTransitionTimer = null;
  }

  function openRulePanel(on, animated) {
    if (!root) return;
    var useAnim = animated !== false;
    if (on) {
      if (rulePanelTransitionTimer) {
        clearTimeout(rulePanelTransitionTimer);
        rulePanelTransitionTimer = null;
      }
      root.classList.add("gc-ips-pol-flyout--rule-open");
      if (els.collapsedStrip) {
        els.collapsedStrip.hidden = false;
        els.collapsedStrip.setAttribute("aria-hidden", "false");
      }
      var policyName = (els.nameInp && els.nameInp.value.trim()) || "Policy";
      if (els.collapsedLabel) {
        els.collapsedLabel.textContent =
          policyName.length > 48 ? policyName.slice(0, 46) + "…" : policyName;
      }
      if (els.rulePanel) {
        els.rulePanel.setAttribute("aria-hidden", "false");
        if (useAnim) {
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              if (els.rulePanel) els.rulePanel.classList.remove("gc-ips-pol-subflyout--sheet--collapsed");
            });
          });
        } else {
          els.rulePanel.classList.remove("gc-ips-pol-subflyout--sheet--collapsed");
        }
      }
    } else {
      if (rulePanelTransitionTimer) {
        clearTimeout(rulePanelTransitionTimer);
        rulePanelTransitionTimer = null;
      }
      if (els.rulePanel) {
        els.rulePanel.classList.add("gc-ips-pol-subflyout--sheet--collapsed");
      }
      root.classList.remove("gc-ips-pol-flyout--rule-open");
      if (useAnim && els.rulePanel) {
        rulePanelTransitionTimer = setTimeout(finishCloseRulePanel, RULE_PANEL_MS);
      } else {
        finishCloseRulePanel();
      }
    }
  }

  function openRuleEditor(index) {
    editingRuleIndex = index;
    var rule = rulesModel[index];
    if (!rule) return;
    ruleEditorSnapshot = cloneRuleSnapshot(rule);
    if (els.smartFilter) els.smartFilter.value = "";
    if (els.ruleNameInp) els.ruleNameInp.value = rule.RuleName || "";
    fillSelect(els.ruleTypeSel, DD.rule_types, rule.RuleType);
    fillSelect(els.actionSel, DD.actions, rule.Action);
    root.querySelectorAll('input[name="gc-ips-pol-sigsel"]').forEach(function (inp) {
      inp.checked = inp.value === rule.SignaturSelectionType;
    });
    syncAllDimensionsFromRule(rule);
    syncSigSection();
    if (els.rulePanelTitle) {
      var rn = rule.RuleName || "Rule " + (index + 1);
      els.rulePanelTitle.textContent = "Edit rule · " + rn;
    }
    openRulePanel(true, true);
    if (els.ruleNameInp) {
      try {
        els.ruleNameInp.focus();
      } catch (e1) {}
    }
  }

  function cancelRuleEditor() {
    var idx = editingRuleIndex;
    if (idx >= 0 && ruleEditorSnapshot && rulesModel[idx]) {
      rulesModel[idx] = ruleEditorSnapshot;
    }
    ruleEditorSnapshot = null;
    openRulePanel(false, true);
    editingRuleIndex = -1;
  }

  function applyRuleFromForm() {
    var idx = editingRuleIndex;
    if (idx < 0 || !rulesModel[idx]) return;
    var r = rulesModel[idx];
    r.RuleName = els.ruleNameInp ? els.ruleNameInp.value.trim() : "";
    r.RuleType = els.ruleTypeSel ? els.ruleTypeSel.value : "Default Signature";
    r.Action = els.actionSel ? els.actionSel.value : "Recommended";
    r.SignaturSelectionType = ruleEditorSigSelection();
    r.categories_all = !!(els.catAll && els.catAll.checked);
    r.severities_all = !!(els.sevAll && els.sevAll.checked);
    r.platforms_all = !!(els.platAll && els.platAll.checked);
    r.targets_all = !!(els.tgtAll && els.tgtAll.checked);
    var chk = readMultiValuesFromChecklists();
    r.categories = r.categories_all ? [] : chk.categories;
    r.severities = r.severities_all ? [] : chk.severities;
    r.platforms = r.platforms_all ? [] : chk.platforms;
    r.targets = r.targets_all ? [] : chk.targets;
    if (r.SignaturSelectionType === "Individual Application") {
      var raw = els.sigTa ? els.sigTa.value : "";
      r.signatures = raw
        .split(/\r?\n/)
        .map(function (l) {
          return l.trim();
        })
        .filter(Boolean);
    } else {
      r.signatures = [];
    }
    renderRuleTable();
    ruleEditorSnapshot = null;
    openRulePanel(false, true);
    editingRuleIndex = -1;
  }

  function signaturesCellSummary(rule) {
    var st = rule.SignaturSelectionType || "All Application";
    if (st === "Individual Application") {
      var n = 0;
      if (rule.signatures && rule.signatures.length) n = rule.signatures.length;
      else if (rule._cachedSigs && rule._cachedSigs.length) n = rule._cachedSigs.length;
      return n ? "Individual (" + n + ")" : "Individual";
    }
    return "All";
  }

  function renderRuleTable() {
    var tb = els.ruleTbody;
    if (!tb) return;
    tb.innerHTML = "";
    if (!rulesModel.length) {
      var tr0 = document.createElement("tr");
      var td0 = document.createElement("td");
      td0.colSpan = 4;
      td0.className = "muted";
      td0.textContent = "No rules yet. Use Add rule.";
      tr0.appendChild(td0);
      tb.appendChild(tr0);
      return;
    }
    rulesModel.forEach(function (rule, i) {
      var tr = document.createElement("tr");
      tr.className = "gc-ips-pol-rules-table__row";
      tr.setAttribute("data-rule-index", String(i));
      tr.setAttribute("role", "button");
      tr.setAttribute("tabindex", "0");
      var name = rule.RuleName || "Rule " + (i + 1);
      tr.setAttribute(
        "aria-label",
        "Edit rule " + name + ", " + (rule.RuleType || "") + ", " + signaturesCellSummary(rule),
      );
      function addCell(text) {
        var td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      }
      addCell(name);
      addCell(rule.RuleType || "—");
      addCell(signaturesCellSummary(rule));
      addCell(rule.Action || "—");
      tb.appendChild(tr);
    });
  }

  function ruleToClientPayload(r) {
    var o = {
      RuleName: r.RuleName || "Rule 1",
      RuleType: r.RuleType || "Default Signature",
      SignaturSelectionType: r.SignaturSelectionType || "All Application",
      Action: r.Action || "Recommended",
      categories_all: !!r.categories_all,
      categories: r.categories_all ? [] : (r.categories || []).slice(),
      severities_all: !!r.severities_all,
      severities: r.severities_all ? [] : (r.severities || []).slice(),
      platforms_all: !!r.platforms_all,
      platforms: r.platforms_all ? [] : (r.platforms || []).slice(),
      targets_all: !!r.targets_all,
      targets: r.targets_all ? [] : (r.targets || []).slice(),
    };
    if (o.SignaturSelectionType === "Individual Application") {
      o.signatures = (r.signatures || []).slice();
    }
    return o;
  }

  function collectPolicyForSave() {
    return {
      Name: els.nameInp ? els.nameInp.value.trim() : "",
      Description: els.descTa ? els.descTa.value.trim() : "",
      Template: els.tmplInp ? els.tmplInp.value.trim() : "",
      rules: rulesModel.map(ruleToClientPayload),
    };
  }

  function openFlyout() {
    if (!root) return;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("gc-if-flyout--open");
    var panel = root.querySelector(".gc-if-flyout__panel");
    if (panel) {
      try {
        panel.focus();
      } catch (e2) {}
    }
  }

  function closeFlyout() {
    if (!root) return;
    ruleEditorSnapshot = null;
    openRulePanel(false, false);
    editingRuleIndex = -1;
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gc-if-flyout--open");
  }

  function bindPanelResize() {
    var panel = root.querySelector(".gc-if-flyout__panel");
    var handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset.gcIpsPolResizeBound === "1") return;
    handle.dataset.gcIpsPolResizeBound = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var startX = e.clientX;
      var startW = panel.getBoundingClientRect().width;
      var ruleOpen = root && root.classList.contains("gc-ips-pol-flyout--rule-open");
      var maxW = ruleOpen
        ? Math.min(1200, window.innerWidth - 24)
        : Math.min(720, window.innerWidth - 24);
      function onMove(e2) {
        var w = startW + (startX - e2.clientX);
        w = Math.max(320, Math.min(maxW, w));
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

  function polMainFormBody() {
    return root ? root.querySelector("#gc-ips-pol-flyout-main .gc-if-flyout__form-body") : null;
  }

  function collectPolFlyoutFirewallIds() {
    var slot = root.querySelector("#gc-ips-pol-fw-slot");
    if (!slot) return [];
    var ms = slot.querySelector("[data-gc-fw-ms]");
    if (!ms) return [];
    var out = [];
    ms.querySelectorAll('input[type="checkbox"][data-gc-fw-id]').forEach(function (cb) {
      if (!cb.checked) return;
      var n = parseInt(String(cb.getAttribute("data-gc-fw-id") || ""), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function setPolFwHint(mode) {
    var h = root && root.querySelector("#gc-ips-pol-fw-ms-hint");
    if (!h) return;
    h.textContent =
      mode === "create"
        ? "The policy is queued on every firewall you leave selected. Search to filter the list."
        : "Uncheck to skip queuing an update on that firewall. Newly checked firewalls get an add task when the name is not already cached there.";
  }

  function mountPolFwPicker(mode, row) {
    var slot = root.querySelector("#gc-ips-pol-fw-slot");
    var tmpl = root.querySelector("#gc-ips-pol-fw-ms-template");
    if (!slot || !tmpl) return;
    slot.innerHTML = "";
    slot.appendChild(tmpl.content.cloneNode(true));
    var ms = slot.querySelector("[data-gc-fw-ms]");
    if (!ms) return;
    var initial = [];
    var assigned = [];
    if (mode === "create") {
      ms.setAttribute("data-fw-picker-mode", "add");
      if (typeof window.gcGetSelectedFirewallIds === "function") {
        (window.gcGetSelectedFirewallIds() || []).forEach(function (x) {
          var n = parseInt(String(x), 10);
          if (!isNaN(n) && n > 0) initial.push(n);
        });
      }
    } else {
      ms.setAttribute("data-fw-picker-mode", "edit");
      collectIpsPolicyUpdateTargets(row || {}).forEach(function (t) {
        if (t && t.firewall_id != null) {
          var fid = parseInt(String(t.firewall_id), 10);
          if (!isNaN(fid) && fid > 0) initial.push(fid);
        }
      });
      assigned = initial.slice();
    }
    ms.setAttribute("data-fw-initial-selected", JSON.stringify(initial));
    ms.setAttribute("data-fw-assigned-ids", JSON.stringify(assigned));
    var body = polMainFormBody();
    if (body && typeof window.gcHsHydrateFlyoutFirewallPicker === "function") {
      window.gcHsHydrateFlyoutFirewallPicker(body, { row: row || {} });
    }
  }

  function collectIpsPolicyUpdateTargets(row) {
    var t = row && row.ips_policy_edit_targets;
    if (Array.isArray(t) && t.length) return t.slice();
    if (row && row.config_entry_id != null) {
      var one = { config_entry_id: row.config_entry_id };
      if (row.firewall_id != null) one.firewall_id = row.firewall_id;
      return [one];
    }
    return [];
  }

  function populateFromPolicy(pol, row) {
    pol = pol && typeof pol === "object" ? pol : {};
    var rl = pol.RuleList && pol.RuleList.Rule;
    var rawRules = Array.isArray(rl) ? rl : rl && typeof rl === "object" ? [rl] : [];
    rulesModel = rawRules.length ? rawRules.map(parseRuleFromCache) : [defaultRule()];
    if (els.nameInp) {
      els.nameInp.value = textScalar(pol.Name) || (row && row.cells && row.cells.__name) || "";
      els.nameInp.readOnly = mode === "edit";
      els.nameInp.classList.toggle("gc-if-flyout__input--readonly", mode === "edit");
    }
    if (els.descTa) els.descTa.value = textScalar(pol.Description) || "";
    if (els.tmplInp) els.tmplInp.value = textScalar(pol.Template) || "";
    setPolFwHint(mode);
    mountPolFwPicker(mode === "create" ? "create" : "edit", mode === "edit" ? row : null);
    if (els.title) {
      els.title.textContent = mode === "create" ? "Add IPS policy" : "IPS policy";
    }
    renderRuleTable();
    openRulePanel(false, false);
  }

  function cacheEls() {
    els = {
      title: root.querySelector("#gc-ips-pol-flyout-title"),
      main: root.querySelector("#gc-ips-pol-flyout-main"),
      rulePanel: root.querySelector("#gc-ips-pol-rule-panel"),
      form: root.querySelector("#gc-ips-pol-form"),
      nameInp: root.querySelector("#gc-ips-pol-name"),
      descTa: root.querySelector("#gc-ips-pol-desc"),
      tmplInp: root.querySelector("#gc-ips-pol-template"),
      ruleTbody: root.querySelector("#gc-ips-pol-rule-tbody"),
      collapsedStrip: root.querySelector("#gc-ips-pol-collapsed-strip"),
      collapsedLabel: root.querySelector("#gc-ips-pol-collapsed-label"),
      rulePanelTitle: root.querySelector("#gc-ips-pol-rule-panel-title"),
      saveBtn: root.querySelector("#gc-ips-pol-save"),
      cancelBtn: root.querySelector("#gc-ips-pol-cancel"),
      addRuleBtn: root.querySelector("#gc-ips-pol-add-rule"),
      ruleCancel: root.querySelector("#gc-ips-pol-rule-cancel"),
      ruleApply: root.querySelector("#gc-ips-pol-rule-apply"),
      ruleNameInp: root.querySelector("#gc-ips-pol-rule-name"),
      ruleTypeSel: root.querySelector("#gc-ips-pol-rule-type"),
      actionSel: root.querySelector("#gc-ips-pol-action"),
      smartFilter: root.querySelector("#gc-ips-pol-rule-smart-filter"),
      catAll: root.querySelector("#gc-ips-pol-cat-all"),
      catWrap: root.querySelector("#gc-ips-pol-cat-list-wrap"),
      catChecklist: root.querySelector("#gc-ips-pol-cat-checklist"),
      catFilterEmpty: root.querySelector("#gc-ips-pol-cat-filter-empty"),
      sevAll: root.querySelector("#gc-ips-pol-sev-all"),
      sevWrap: root.querySelector("#gc-ips-pol-sev-list-wrap"),
      sevChecklist: root.querySelector("#gc-ips-pol-sev-checklist"),
      sevFilterEmpty: root.querySelector("#gc-ips-pol-sev-filter-empty"),
      platAll: root.querySelector("#gc-ips-pol-plat-all"),
      platWrap: root.querySelector("#gc-ips-pol-plat-list-wrap"),
      platChecklist: root.querySelector("#gc-ips-pol-plat-checklist"),
      platFilterEmpty: root.querySelector("#gc-ips-pol-plat-filter-empty"),
      tgtAll: root.querySelector("#gc-ips-pol-tgt-all"),
      tgtWrap: root.querySelector("#gc-ips-pol-tgt-list-wrap"),
      tgtChecklist: root.querySelector("#gc-ips-pol-tgt-checklist"),
      tgtFilterEmpty: root.querySelector("#gc-ips-pol-tgt-filter-empty"),
      sigSection: root.querySelector("#gc-ips-pol-sig-section"),
      sigReadonly: root.querySelector("#gc-ips-pol-sig-readonly"),
      sigTa: root.querySelector("#gc-ips-pol-sig-ta"),
    };
  }

  function bindOnce() {
    if (!root || root.dataset.gcIpsPolFlyoutBound === "1") return;
    root.dataset.gcIpsPolFlyoutBound = "1";
    cacheEls();
    bindPanelResize();

    fillSelect(els.ruleTypeSel, DD.rule_types, "Default Signature");
    fillSelect(els.actionSel, DD.actions, "Recommended");

    wireDimensionSpecs();

    root.querySelectorAll('input[name="gc-ips-pol-sigsel"]').forEach(function (inp) {
      inp.addEventListener("change", syncSigSection);
    });

    if (els.smartFilter) {
      els.smartFilter.addEventListener("input", applySmartFilter);
    }
    if (els.ruleCancel) {
      els.ruleCancel.addEventListener("click", function () {
        cancelRuleEditor();
      });
    }
    if (els.ruleApply) {
      els.ruleApply.addEventListener("click", function () {
        applyRuleFromForm();
      });
    }
    if (els.addRuleBtn) {
      els.addRuleBtn.addEventListener("click", function () {
        var next = rulesModel.length + 1;
        rulesModel.push(defaultRule());
        rulesModel[rulesModel.length - 1].RuleName = "Rule " + next;
        renderRuleTable();
        openRuleEditor(rulesModel.length - 1);
      });
    }

    var rulesTable = root.querySelector("#gc-ips-pol-rules-table");
    if (rulesTable && rulesTable.dataset.gcIpsPolRuleClickBound !== "1") {
      rulesTable.dataset.gcIpsPolRuleClickBound = "1";
      rulesTable.addEventListener("click", function (ev) {
        var tr = ev.target.closest("tr[data-rule-index]");
        if (!tr || !rulesTable.contains(tr)) return;
        if (ev.target.closest("button, a, input")) return;
        var idx = parseInt(tr.getAttribute("data-rule-index"), 10);
        if (!isNaN(idx)) openRuleEditor(idx);
      });
      rulesTable.addEventListener("keydown", function (ev) {
        var tr = ev.target.closest("tr[data-rule-index]");
        if (!tr || !rulesTable.contains(tr)) return;
        if (ev.key !== "Enter" && ev.key !== " ") return;
        ev.preventDefault();
        var idx = parseInt(tr.getAttribute("data-rule-index"), 10);
        if (!isNaN(idx)) openRuleEditor(idx);
      });
    }
    if (els.nameInp) {
      els.nameInp.addEventListener("input", function () {
        if (!root.classList.contains("gc-ips-pol-flyout--rule-open")) return;
        var policyName = (els.nameInp.value || "").trim() || "Policy";
        if (els.collapsedLabel) {
          els.collapsedLabel.textContent =
            policyName.length > 48 ? policyName.slice(0, 46) + "…" : policyName;
        }
      });
    }

    if (els.cancelBtn) {
      els.cancelBtn.addEventListener("click", closeFlyout);
    }
    var backdrop = root.querySelector(".gc-if-flyout__backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", closeFlyout);
    }

    if (els.form && els.form.dataset.gcIpsPolFwPanelClose !== "1") {
      els.form.dataset.gcIpsPolFwPanelClose = "1";
      els.form.addEventListener("click", function (e) {
        if (!root || root.hidden) return;
        if (e.target.closest("[data-gc-fw-ms]")) return;
        var body = polMainFormBody();
        if (!body) return;
        body.querySelectorAll(".gc-hs-ip-host-flyout__fw-dropdown").forEach(function (d) {
          d.hidden = true;
        });
        body.querySelectorAll(".gc-hs-ip-host-flyout__fw-trigger").forEach(function (t) {
          t.setAttribute("aria-expanded", "false");
        });
      });
    }

    if (els.form) {
      els.form.addEventListener("submit", function (e) {
        e.preventDefault();
        var body = collectPolicyForSave();
        if (!body.Name) {
          bannerResult(false, "Policy name is required.");
          return;
        }
        if (mode === "create") {
          var createFwIds = collectPolFlyoutFirewallIds();
          if (!createFwIds.length) {
            bannerResult(false, "Select at least one firewall in the flyout.");
            return;
          }
          if (!CREATE_URL) {
            bannerResult(false, "Create URL is not configured.");
            return;
          }
          if (els.saveBtn) els.saveBtn.disabled = true;
          var cIdx = 0;
          var cQueued = 0;
          function finishPolCreate(errMsg) {
            if (els.saveBtn) els.saveBtn.disabled = false;
            if (errMsg) {
              bannerResult(false, errMsg);
              return;
            }
            if (cQueued === 0) {
              bannerResult(
                true,
                "Nothing queued — a policy with this name may already exist on every selected firewall.",
              );
            } else {
              bannerResult(
                true,
                cQueued === 1
                  ? "Added 1 policy task to the queue."
                  : "Added " + cQueued + " policy tasks to the queue.",
              );
              dispatchTaskQueueUpdated();
            }
            closeFlyout();
            if (typeof window.gcIpsPolicyTableRefresh === "function") {
              window.gcIpsPolicyTableRefresh();
            }
          }
          function stepPolCreate() {
            if (cIdx >= createFwIds.length) {
              finishPolCreate(null);
              return;
            }
            var fwId = createFwIds[cIdx];
            cIdx++;
            fetch(CREATE_URL, {
              method: "POST",
              credentials: "same-origin",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-Requested-With": "Ground-Control",
              },
              body: JSON.stringify({ firewall_id: fwId, policy: body }),
            })
              .then(function (r) {
                return r.json().then(function (j) {
                  return { ok: r.ok, j: j };
                });
              })
              .then(function (x) {
                if (!x.ok) {
                  var em = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
                  finishPolCreate(typeof em === "string" ? em : JSON.stringify(em));
                  return;
                }
                cQueued++;
                stepPolCreate();
              })
              .catch(function () {
                finishPolCreate("Network error.");
              });
          }
          stepPolCreate();
          return;
        }
        var allTargets = collectIpsPolicyUpdateTargets(currentRow);
        var byFw = {};
        allTargets.forEach(function (t) {
          if (t && t.firewall_id != null) byFw[t.firewall_id] = t;
        });
        var selectedFw = collectPolFlyoutFirewallIds();
        var toUpdate = [];
        var toCreateFw = [];
        selectedFw.forEach(function (fid) {
          if (byFw[fid]) toUpdate.push(byFw[fid]);
          else toCreateFw.push(fid);
        });
        if (!toUpdate.length && !toCreateFw.length) {
          bannerResult(false, "Select at least one firewall.");
          return;
        }
        if (toUpdate.length && !UPDATE_URL) {
          bannerResult(false, "Update URL is not configured.");
          return;
        }
        if (toCreateFw.length && !CREATE_URL) {
          bannerResult(false, "Create URL is not configured.");
          return;
        }
        if (els.saveBtn) els.saveBtn.disabled = true;
        var uIdx = 0;
        var queued = 0;
        function finishPolSave(errMsg) {
          if (els.saveBtn) els.saveBtn.disabled = false;
          if (errMsg) {
            bannerResult(false, errMsg);
            return;
          }
          if (queued === 0) {
            bannerResult(true, "Nothing queued — policies already match your edits in the cache.");
          } else {
            bannerResult(
              true,
              queued === 1
                ? "Added 1 policy task to the queue."
                : "Added " + queued + " policy tasks to the queue.",
            );
            dispatchTaskQueueUpdated();
          }
          closeFlyout();
          if (typeof window.gcIpsPolicyTableRefresh === "function") {
            window.gcIpsPolicyTableRefresh();
          }
        }
        function stepPolUpdate() {
          if (uIdx >= toUpdate.length) {
            stepPolCreateAfterUpdates();
            return;
          }
          var tid = toUpdate[uIdx].config_entry_id;
          uIdx++;
          fetch(UPDATE_URL, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ config_entry_id: tid, policy: body }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (!x.ok) {
                var em2 = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
                finishPolSave(typeof em2 === "string" ? em2 : JSON.stringify(em2));
                return;
              }
              if (x.j && x.j.task_id != null) queued++;
              stepPolUpdate();
            })
            .catch(function () {
              finishPolSave("Network error.");
            });
        }
        var crIdx = 0;
        function stepPolCreateAfterUpdates() {
          if (crIdx >= toCreateFw.length) {
            finishPolSave(null);
            return;
          }
          var fwId = toCreateFw[crIdx];
          crIdx++;
          fetch(CREATE_URL, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ firewall_id: fwId, policy: body }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (!x.ok) {
                var em3 = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
                finishPolSave(typeof em3 === "string" ? em3 : JSON.stringify(em3));
                return;
              }
              queued++;
              stepPolCreateAfterUpdates();
            })
            .catch(function () {
              finishPolSave("Network error.");
            });
        }
        if (toUpdate.length) stepPolUpdate();
        else stepPolCreateAfterUpdates();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (!root || root.hidden) return;
      if (e.key === "Escape") {
        if (root.classList.contains("gc-ips-pol-flyout--rule-open")) {
          cancelRuleEditor();
        } else {
          closeFlyout();
        }
      }
    });
  }

  function loadDropdowns() {
    var raw = window.GC_IPS_POLICY_DROPDOWNS;
    if (!raw || typeof raw !== "object") return;
    DD.categories = raw.categories || [];
    DD.severities = raw.severities || [];
    DD.platforms = raw.platforms || [];
    DD.targets = raw.targets || [];
    DD.rule_types = raw.rule_types || [];
    DD.signature_selection = raw.signature_selection || [];
    DD.actions = raw.actions || [];
  }

  window.gcIpsPolicyFlyoutInit = function () {
    root = document.getElementById("gc-ips-pol-flyout");
    CREATE_URL = typeof window.GC_IPS_POLICY_CREATE_URL === "string" ? window.GC_IPS_POLICY_CREATE_URL : "";
    UPDATE_URL = typeof window.GC_IPS_POLICY_UPDATE_URL === "string" ? window.GC_IPS_POLICY_UPDATE_URL : "";
    loadDropdowns();
    if (!root) return;
    bindOnce();
  };

  window.gcIpsPolicyFlyoutOpenFromTr = function (tr) {
    window.gcIpsPolicyFlyoutInit();
    var row = tr && tr._gcNetRow;
    if (!row || !root) return;
    mode = "edit";
    currentRow = row;
    populateFromPolicy(row.policy, row);
    openFlyout();
    var pBody = polMainFormBody();
    if (pBody && typeof window.gcCombineFlyoutApplyConflictChrome === "function") {
      window.gcCombineFlyoutApplyConflictChrome(pBody, row, {
        columnLabels: { __description: "Description", __policy_body: "Policy content" },
        fieldPickHandlers: {
          __policy_body: function (raw) {
            try {
              var o = JSON.parse(String(raw));
              populateFromPolicy(o, currentRow);
            } catch (ePol) {
              if (typeof window.gcGlobalBannerShowResult === "function") {
                window.gcGlobalBannerShowResult(false, "Could not parse stored policy JSON for that firewall.");
              } else {
                alert("Could not parse stored policy JSON for that firewall.");
              }
            }
          },
        },
      });
    }
  };

  window.gcIpsPolicyFlyoutOpenCreate = function () {
    window.gcIpsPolicyFlyoutInit();
    if (!root) return;
    mode = "create";
    currentRow = null;
    populateFromPolicy({}, null);
    if (els.nameInp) {
      els.nameInp.readOnly = false;
      els.nameInp.classList.remove("gc-if-flyout__input--readonly");
    }
    openFlyout();
  };
})();
