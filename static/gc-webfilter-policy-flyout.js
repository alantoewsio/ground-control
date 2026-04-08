/**
 * Web filter policy flyout: view/edit cached policies; queue create/update through the task API.
 */
(function () {
  "use strict";

  var root = null;
  var els = {};
  var HTTP_ACTIONS = ["Deny", "Allow", "Warn", "Log", "Quota"];
  var CATEGORY_TYPES = ["WebCategory", "URLGroup", "UserActivity", "DynamicCategory", "FileType"];
  var mode = "edit";
  var currentRow = null;
  var rulesModel = [];
  var editingRuleIndex = -1;
  var CREATE_URL = "";
  var UPDATE_URL = "";
  var ruleEditorSnapshot = null;
  var RULE_PANEL_MS = 280;
  var rulePanelTransitionTimer = null;
  var wfpRuleDnDActive = false;

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

  function binOn(v) {
    var s = String(v == null ? "" : v).trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on" || s === "enable" || s === "enabled";
  }

  function listCategoriesFromRule(r) {
    if (!r || typeof r !== "object") return [];
    var cl = r.CategoryList;
    if (!cl || typeof cl !== "object") return [];
    var c = cl.Category;
    if (c == null) return [];
    var arr = Array.isArray(c) ? c : [c];
    return arr
      .map(function (x) {
        if (!x || typeof x !== "object") return null;
        var id = textScalar(x.ID != null ? x.ID : x.id);
        var typ = textScalar(x.type != null ? x.type : x.Type) || "WebCategory";
        if (!id) return null;
        return { id: id, type: typ };
      })
      .filter(Boolean);
  }

  function listUsersFromRule(r) {
    if (!r || typeof r !== "object") return [];
    var ul = r.UserList;
    if (!ul || typeof ul !== "object") return [];
    var u = ul.User;
    if (u == null) return [];
    if (Array.isArray(u)) {
      return u.map(textScalar).filter(Boolean);
    }
    var one = textScalar(u);
    return one ? [one] : [];
  }

  function parseRuleFromPol(r) {
    if (!r || typeof r !== "object") r = {};
    var cats = listCategoriesFromRule(r);
    if (!cats.length) cats.push({ id: "General", type: "WebCategory" });
    return {
      categories: cats,
      http_action: textScalar(r.HTTPAction) || "Allow",
      https_action: textScalar(r.HTTPSAction) || "Allow",
      follow_http: binOn(r.FollowHTTPAction),
      schedule: textScalar(r.Schedule) || "All The Time",
      users: listUsersFromRule(r),
      enabled:
        r.PolicyRuleEnabled == null || r.PolicyRuleEnabled === ""
          ? true
          : binOn(r.PolicyRuleEnabled),
    };
  }

  function defaultRule() {
    return {
      categories: [{ id: "General", type: "WebCategory" }],
      http_action: "Allow",
      https_action: "Allow",
      follow_http: true,
      schedule: "All The Time",
      users: [],
      enabled: true,
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

  function catSummary(rule) {
    var c = (rule && rule.categories) || [];
    if (!c.length) return "—";
    return c
      .slice(0, 3)
      .map(function (x) {
        return x.id + (x.type && x.type !== "WebCategory" ? " (" + x.type + ")" : "");
      })
      .join(", ") + (c.length > 3 ? "…" : "");
  }

  function truncateSchedule(s, maxLen) {
    s = String(s || "").trim();
    var n = typeof maxLen === "number" ? maxLen : 28;
    if (s.length <= n) return s;
    return s.slice(0, n - 1) + "…";
  }

  function actionIconElement(action) {
    var a = String(action || "Allow").trim();
    var lower = a.toLowerCase();
    var span = document.createElement("span");
    span.className = "gc-wfp-act-icon";
    if (lower === "deny") {
      span.className += " gc-wfp-act-icon--deny";
      span.textContent = "✕";
      span.title = "Deny";
    } else if (lower === "warn") {
      span.className += " gc-wfp-act-icon--warn";
      span.textContent = "!";
      span.title = "Warn";
    } else if (lower === "allow") {
      span.className += " gc-wfp-act-icon--allow";
      span.textContent = "✓";
      span.title = "Allow";
    } else if (lower === "log") {
      span.className += " gc-wfp-act-icon--log";
      span.textContent = "Log";
      span.title = "Log";
    } else if (lower === "quota") {
      span.className += " gc-wfp-act-icon--quota";
      span.textContent = "Qt";
      span.title = "Quota";
    } else {
      span.className += " gc-wfp-act-icon--log";
      span.textContent = a.length > 4 ? a.slice(0, 3) + "…" : a;
      span.title = a;
    }
    span.setAttribute("aria-label", "HTTP action: " + a);
    return span;
  }

  function readOnlyStatusToggle(on) {
    var span = document.createElement("span");
    var state = on ? "on" : "off";
    var lab = on ? "On" : "Off";
    span.className = "gc-table-toggle gc-table-toggle--static gc-table-toggle--" + state;
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", "Rule status: " + lab);
    var track = document.createElement("span");
    track.className = "gc-table-toggle__track";
    track.setAttribute("aria-hidden", "true");
    var thumb = document.createElement("span");
    thumb.className = "gc-table-toggle__thumb";
    track.appendChild(thumb);
    span.appendChild(track);
    return span;
  }

  function moveRuleInList(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= rulesModel.length ||
      toIdx >= rulesModel.length
    ) {
      return;
    }
    var r = rulesModel.splice(fromIdx, 1)[0];
    var insertAt = fromIdx < toIdx ? toIdx - 1 : toIdx;
    rulesModel.splice(insertAt, 0, r);
  }

  function getSelectedRuleIndices() {
    var tb = els.ruleTbody;
    if (!tb) return [];
    var out = [];
    tb.querySelectorAll('tr[data-rule-index] input.gc-wfp-rule-row-select:checked').forEach(function (cb) {
      var tr = cb.closest("tr");
      if (!tr) return;
      var idx = parseInt(tr.getAttribute("data-rule-index"), 10);
      if (!isNaN(idx)) out.push(idx);
    });
    return out;
  }

  function syncWfpRuleToolbar() {
    var n = getSelectedRuleIndices().length;
    if (els.rulesCloneBtn) els.rulesCloneBtn.disabled = n < 1;
    if (els.rulesDeleteBtn) els.rulesDeleteBtn.disabled = n < 1;
  }

  function syncWfpRulesSelectAllHeader() {
    var selAll = document.getElementById("gc-wfp-rules-select-all");
    if (!selAll || !els.ruleTbody) return;
    var boxes = els.ruleTbody.querySelectorAll("tr[data-rule-index] input.gc-wfp-rule-row-select");
    var n = boxes.length;
    var c = 0;
    boxes.forEach(function (b) {
      if (b.checked) c++;
    });
    selAll.checked = n > 0 && c === n;
    selAll.indeterminate = c > 0 && c < n;
  }

  function cloneSelectedRules() {
    var sel = getSelectedRuleIndices().sort(function (a, b) {
      return b - a;
    });
    sel.forEach(function (idx) {
      try {
        rulesModel.splice(idx + 1, 0, JSON.parse(JSON.stringify(rulesModel[idx])));
      } catch (eC) {}
    });
    renderRuleTable();
  }

  function deleteSelectedRules() {
    var sel = getSelectedRuleIndices().sort(function (a, b) {
      return b - a;
    });
    sel.forEach(function (idx) {
      rulesModel.splice(idx, 1);
    });
    renderRuleTable();
  }

  function renderRuleTable() {
    var tb = els.ruleTbody;
    if (!tb) return;
    tb.innerHTML = "";
    var COL_COUNT = 8;
    if (!rulesModel.length) {
      var tr0 = document.createElement("tr");
      var td0 = document.createElement("td");
      td0.colSpan = COL_COUNT;
      td0.className = "muted";
      td0.textContent = "No rules yet. Click Add rule or save to apply a default rule.";
      tr0.appendChild(td0);
      tb.appendChild(tr0);
      syncWfpRulesSelectAllHeader();
      syncWfpRuleToolbar();
      return;
    }
    rulesModel.forEach(function (rule, i) {
      var tr = document.createElement("tr");
      tr.className = "gc-wfp-rules-table__row";
      tr.setAttribute("data-rule-index", String(i));
      tr.setAttribute("tabindex", "0");
      tr.setAttribute("aria-label", "Edit rule " + (i + 1) + ", " + catSummary(rule));

      var tdDrag = document.createElement("td");
      tdDrag.className = "gc-wfp-col-drag-cell gc-wfp-col-drag";
      var handle = document.createElement("span");
      handle.className = "gc-wfp-rule-grab-handle";
      handle.textContent = "⋮⋮";
      handle.setAttribute("draggable", "true");
      handle.setAttribute("title", "Drag to reorder");
      handle.setAttribute("aria-label", "Drag to reorder rule " + (i + 1));
      handle.addEventListener("dragstart", function (e) {
        e.stopPropagation();
        wfpRuleDnDActive = true;
        tr.classList.add("gc-wfp-rule-row--dragging");
        try {
          e.dataTransfer.setData("text/plain", String(i));
          e.dataTransfer.effectAllowed = "move";
        } catch (eT) {}
      });
      handle.addEventListener("dragend", function () {
        tr.classList.remove("gc-wfp-rule-row--dragging");
        setTimeout(function () {
          wfpRuleDnDActive = false;
        }, 50);
      });
      tdDrag.appendChild(handle);
      tr.appendChild(tdDrag);

      var tdSel = document.createElement("td");
      tdSel.className = "gc-wfp-col-select-cell gc-wfp-col-select";
      var cbRow = document.createElement("input");
      cbRow.type = "checkbox";
      cbRow.className = "gc-wfp-rule-row-select";
      cbRow.setAttribute("aria-label", "Select rule " + (i + 1));
      cbRow.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      tdSel.appendChild(cbRow);
      tr.appendChild(tdSel);

      tr.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      tr.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        var to = i;
        if (isNaN(from) || from === to) return;
        moveRuleInList(from, to);
        renderRuleTable();
      });

      var tdUsers = document.createElement("td");
      var users = rule.users || [];
      if (!users.length) {
        var spAny = document.createElement("span");
        spAny.className = "gc-wfp-rule-users-cell muted";
        var ic0 = document.createElement("span");
        ic0.className = "gc-wfp-rule-users-ic";
        ic0.setAttribute("aria-hidden", "true");
        ic0.textContent = "◯";
        spAny.appendChild(ic0);
        spAny.appendChild(document.createTextNode(" Anybody"));
        tdUsers.appendChild(spAny);
      } else {
        var spU = document.createElement("span");
        spU.className = "gc-wfp-rule-users-cell";
        var ic1 = document.createElement("span");
        ic1.className = "gc-wfp-rule-users-ic";
        ic1.setAttribute("aria-hidden", "true");
        ic1.textContent = "◯";
        spU.appendChild(ic1);
        var uTxt = users.length === 1 ? users[0] : users[0] + " +" + (users.length - 1);
        spU.appendChild(document.createTextNode(" " + uTxt));
        tdUsers.appendChild(spU);
      }
      tr.appendChild(tdUsers);

      var tdActivities = document.createElement("td");
      var wrapPills = document.createElement("div");
      wrapPills.className = "gc-wfp-rule-act-pills";
      (rule.categories || []).forEach(function (c) {
        var pill = document.createElement("span");
        pill.className = "gc-table-value-pill";
        pill.textContent = c.id || "—";
        pill.title = (c.type || "WebCategory") + ": " + (c.id || "");
        wrapPills.appendChild(pill);
      });
      if (!wrapPills.children.length) {
        var ph = document.createElement("span");
        ph.className = "muted";
        ph.textContent = "—";
        wrapPills.appendChild(ph);
      }
      tdActivities.appendChild(wrapPills);
      tr.appendChild(tdActivities);

      var tdAction = document.createElement("td");
      tdAction.appendChild(actionIconElement(rule.http_action));
      tr.appendChild(tdAction);

      var tdSched = document.createElement("td");
      var sch = rule.schedule || "All The Time";
      tdSched.textContent = truncateSchedule(sch, 28);
      tdSched.title = sch;
      tr.appendChild(tdSched);

      var tdSt = document.createElement("td");
      tdSt.className = "gc-wfp-rule-status";
      tdSt.appendChild(readOnlyStatusToggle(rule.enabled !== false));
      tr.appendChild(tdSt);

      tr.addEventListener("click", function (ev) {
        if (wfpRuleDnDActive) return;
        if (
          ev.target.closest &&
          ev.target.closest(
            ".gc-wfp-rule-grab-handle, .gc-wfp-rule-row-select, .gc-wfp-rule-status, button, a, label",
          )
        ) {
          return;
        }
        openRuleEditorFromModel(i);
      });
      tr.addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        if (ev.target.closest && ev.target.closest("button, input, .gc-wfp-rule-grab-handle")) return;
        ev.preventDefault();
        openRuleEditorFromModel(i);
      });

      tb.appendChild(tr);
    });
    syncWfpRulesSelectAllHeader();
    syncWfpRuleToolbar();
  }

  function clearCatEditor() {
    if (els.ruleCats) els.ruleCats.innerHTML = "";
  }

  function addCatRow(cat) {
    cat = cat || { id: "", type: "WebCategory" };
    var wrap = document.createElement("div");
    wrap.className = "gc-wfp-rule-cat-row gc-if-flyout__field";
    var idLab = document.createElement("label");
    idLab.className = "gc-if-flyout__label";
    idLab.textContent = "ID / name";
    var idInp = document.createElement("input");
    idInp.type = "text";
    idInp.className = "gc-if-flyout__input gc-wfp-rule-cat-id";
    idInp.value = cat.id || "";
    idInp.autocomplete = "off";
    var typeLab = document.createElement("label");
    typeLab.className = "gc-if-flyout__label";
    typeLab.textContent = "Type";
    var typeSel = document.createElement("select");
    typeSel.className = "gc-if-flyout__input gc-if-flyout__select gc-wfp-rule-cat-type";
    CATEGORY_TYPES.forEach(function (t) {
      var o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      typeSel.appendChild(o);
    });
    if (cat.type && CATEGORY_TYPES.indexOf(cat.type) >= 0) typeSel.value = cat.type;
    wrap.appendChild(idLab);
    wrap.appendChild(idInp);
    wrap.appendChild(typeLab);
    wrap.appendChild(typeSel);
    els.ruleCats.appendChild(wrap);
  }

  function readCategoriesFromEditor() {
    var out = [];
    if (!els.ruleCats) return out;
    els.ruleCats.querySelectorAll(".gc-wfp-rule-cat-row").forEach(function (row) {
      var idInp = row.querySelector(".gc-wfp-rule-cat-id");
      var typeSel = row.querySelector(".gc-wfp-rule-cat-type");
      var id = idInp ? idInp.value.trim() : "";
      var typ = typeSel ? typeSel.value : "WebCategory";
      if (id) out.push({ id: id, type: typ });
    });
    return out;
  }

  function openRuleEditorFromModel(index) {
    editingRuleIndex = index;
    var rule = rulesModel[index];
    if (!rule) return;
    ruleEditorSnapshot = (function () {
      try {
        return JSON.parse(JSON.stringify(rule));
      } catch (e) {
        return null;
      }
    })();
    clearCatEditor();
    (rule.categories || []).forEach(function (c) {
      addCatRow(c);
    });
    if (!els.ruleCats || !els.ruleCats.children.length) addCatRow({ id: "General", type: "WebCategory" });
    fillSelect(els.ruleHttp, HTTP_ACTIONS, rule.http_action);
    fillSelect(els.ruleHttps, HTTP_ACTIONS, rule.https_action);
    if (els.ruleFollow) els.ruleFollow.checked = !!rule.follow_http;
    if (els.ruleSchedule) els.ruleSchedule.value = rule.schedule || "";
    if (els.ruleUsers) els.ruleUsers.value = (rule.users || []).join("\n");
    if (els.ruleEnabled) els.ruleEnabled.checked = rule.enabled !== false;
    if (els.rulePanelTitle) {
      els.rulePanelTitle.textContent = "Edit rule · " + (index + 1);
    }
    openRulePanel(true, true);
  }

  function finishCloseRulePanel() {
    if (!root || !els.rulePanel) return;
    els.rulePanel.setAttribute("aria-hidden", "true");
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
      root.classList.add("gc-wfp-flyout--rule-open");
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
      root.classList.remove("gc-wfp-flyout--rule-open");
      if (useAnim && els.rulePanel) {
        rulePanelTransitionTimer = setTimeout(finishCloseRulePanel, RULE_PANEL_MS);
      } else {
        finishCloseRulePanel();
      }
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
    var cats = readCategoriesFromEditor();
    if (!cats.length) {
      bannerResult(false, "Add at least one category ID for the rule.");
      return;
    }
    var r = rulesModel[idx];
    r.categories = cats;
    r.http_action = els.ruleHttp ? els.ruleHttp.value : "Allow";
    r.https_action = els.ruleHttps ? els.ruleHttps.value : "Allow";
    r.follow_http = !!(els.ruleFollow && els.ruleFollow.checked);
    r.schedule = (els.ruleSchedule && els.ruleSchedule.value.trim()) || "All The Time";
    var rawU = els.ruleUsers ? els.ruleUsers.value : "";
    r.users = rawU
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    r.enabled = !!(els.ruleEnabled && els.ruleEnabled.checked);
    renderRuleTable();
    ruleEditorSnapshot = null;
    openRulePanel(false, true);
    editingRuleIndex = -1;
  }

  function ruleToClientPayload(r) {
    return {
      categories: (r.categories || []).map(function (c) {
        return { id: c.id, type: c.type || "WebCategory" };
      }),
      http_action: r.http_action || "Allow",
      https_action: r.https_action || "Allow",
      follow_http_action: r.follow_http ? "1" : "0",
      schedule: r.schedule || "All The Time",
      policy_rule_enabled: r.enabled !== false ? "1" : "0",
      users: (r.users || []).slice(),
    };
  }

  function collectPolicyForSave() {
    var qh = els.quotaH ? parseInt(String(els.quotaH.value || "0"), 10) : 0;
    var qmin = els.quotaM ? parseInt(String(els.quotaM.value || "0"), 10) : 0;
    if (isNaN(qh) || qh < 0) qh = 0;
    if (isNaN(qmin) || qmin < 0) qmin = 0;
    if (qh > 24) qh = 24;
    if (qmin > 59) qmin = 59;
    var q = qh * 60 + qmin;
    if (q < 1) q = 1;
    if (q > 1440) q = 1440;
    var dlMb = els.dlMb ? parseInt(String(els.dlMb.value || "300"), 10) : 300;
    if (isNaN(dlMb) || dlMb < 1) dlMb = 300;
    return {
      Name: els.nameInp ? els.nameInp.value.trim() : "",
      Description: els.descTa ? els.descTa.value.trim() : "",
      DefaultAction: els.defaultAct && els.defaultAct.value ? els.defaultAct.value : "Allow",
      EnableReporting: els.reporting && els.reporting.checked ? "Enable" : "Disable",
      QuotaLimit: String(q),
      DownloadFileSizeRestrictionEnabled: els.dlEn && els.dlEn.checked ? "1" : "0",
      DownloadFileSizeRestriction: String(dlMb),
      GoogAppDomainListEnabled: els.googEn && els.googEn.checked ? "1" : "0",
      GoogAppDomainList: els.googDom ? els.googDom.value.trim() : "",
      YoutubeFilterEnabled: els.ytEn && els.ytEn.checked ? "1" : "0",
      YoutubeFilterIsStrict: els.ytStrict && els.ytStrict.value === "1" ? "1" : "0",
      EnforceSafeSearch: els.safeSearch && els.safeSearch.checked ? "1" : "0",
      EnforceImageLicensing: els.imgLic && els.imgLic.checked ? "1" : "0",
      XFFEnabled: els.xff && els.xff.checked ? "1" : "0",
      Office365Enabled: els.o365En && els.o365En.checked ? "1" : "0",
      Office365TenantsList: els.o365Ten ? els.o365Ten.value.trim() : "",
      Office365DirectoryId: els.o365Dir ? els.o365Dir.value.trim() : "",
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
    if (!panel || !handle || handle.dataset.gcWfpResizeBound === "1") return;
    handle.dataset.gcWfpResizeBound = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var startX = e.clientX;
      var startW = panel.getBoundingClientRect().width;
      var ruleOpen = root && root.classList.contains("gc-wfp-flyout--rule-open");
      var maxW = ruleOpen
        ? Math.min(1200, window.innerWidth - 24)
        : Math.min(840, window.innerWidth - 24);
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

  function wfpMainFormBody() {
    return root ? root.querySelector("#gc-wfp-flyout-main .gc-if-flyout__form-body") : null;
  }

  function collectWfpFlyoutFirewallIds() {
    var slot = root.querySelector("#gc-wfp-fw-slot");
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

  function setWfpFwHint(m) {
    var h = root && root.querySelector("#gc-wfp-fw-ms-hint");
    if (!h) return;
    h.textContent =
      m === "create"
        ? "The policy is queued on every firewall you leave selected. Search to filter the list."
        : "Uncheck to skip queuing an update on that firewall. Newly checked firewalls get an add task when the name is not already cached there.";
  }

  function mountWfpFwPicker(m, row) {
    var slot = root.querySelector("#gc-wfp-fw-slot");
    var tmpl = root.querySelector("#gc-wfp-fw-ms-template");
    if (!slot || !tmpl) return;
    slot.innerHTML = "";
    slot.appendChild(tmpl.content.cloneNode(true));
    var ms = slot.querySelector("[data-gc-fw-ms]");
    if (!ms) return;
    var initial = [];
    var assigned = [];
    if (m === "create") {
      ms.setAttribute("data-fw-picker-mode", "add");
      if (typeof window.gcGetSelectedFirewallIds === "function") {
        (window.gcGetSelectedFirewallIds() || []).forEach(function (x) {
          var n = parseInt(String(x), 10);
          if (!isNaN(n) && n > 0) initial.push(n);
        });
      }
    } else {
      ms.setAttribute("data-fw-picker-mode", "edit");
      collectWfpUpdateTargets(row || {}).forEach(function (t) {
        if (t && t.firewall_id != null) {
          var fid = parseInt(String(t.firewall_id), 10);
          if (!isNaN(fid) && fid > 0) initial.push(fid);
        }
      });
      assigned = initial.slice();
    }
    ms.setAttribute("data-fw-initial-selected", JSON.stringify(initial));
    ms.setAttribute("data-fw-assigned-ids", JSON.stringify(assigned));
    var body = wfpMainFormBody();
    if (body && typeof window.gcHsHydrateFlyoutFirewallPicker === "function") {
      window.gcHsHydrateFlyoutFirewallPicker(body, { row: row || {} });
    }
  }

  function collectWfpUpdateTargets(row) {
    var t = row && row.wfp_edit_targets;
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
    rulesModel = rawRules.length ? rawRules.map(parseRuleFromPol) : [defaultRule()];
    if (els.nameInp) {
      els.nameInp.value = textScalar(pol.Name) || (row && row.cells && row.cells.__name) || "";
      els.nameInp.readOnly = mode === "edit";
      els.nameInp.classList.toggle("gc-if-flyout__input--readonly", mode === "edit");
    }
    if (els.descTa) els.descTa.value = textScalar(pol.Description) || "";
    if (els.defaultAct) {
      var da = textScalar(pol.DefaultAction) || "Allow";
      els.defaultAct.value = da === "Deny" ? "Deny" : "Allow";
    }
    if (els.reporting) {
      els.reporting.checked = textScalar(pol.EnableReporting).toLowerCase() !== "disable";
    }
    var qmTotal = parseInt(textScalar(pol.QuotaLimit) || "60", 10);
    if (isNaN(qmTotal) || qmTotal < 1) qmTotal = 60;
    if (qmTotal > 1440) qmTotal = 1440;
    if (els.quotaH) els.quotaH.value = String(Math.floor(qmTotal / 60));
    if (els.quotaM) els.quotaM.value = String(qmTotal % 60);
    if (els.safeSearch) els.safeSearch.checked = binOn(pol.EnforceSafeSearch);
    if (els.imgLic) els.imgLic.checked = binOn(pol.EnforceImageLicensing);
    if (els.ytEn) els.ytEn.checked = binOn(pol.YoutubeFilterEnabled);
    if (els.ytStrict) els.ytStrict.value = binOn(pol.YoutubeFilterIsStrict) ? "1" : "0";
    if (els.dlEn) els.dlEn.checked = binOn(pol.DownloadFileSizeRestrictionEnabled);
    if (els.dlMb) els.dlMb.value = textScalar(pol.DownloadFileSizeRestriction) || "300";
    if (els.xff) els.xff.checked = binOn(pol.XFFEnabled);
    if (els.googEn) els.googEn.checked = binOn(pol.GoogAppDomainListEnabled);
    if (els.googDom) els.googDom.value = textScalar(pol.GoogAppDomainList) || "";
    if (els.o365En) els.o365En.checked = binOn(pol.Office365Enabled);
    if (els.o365Ten) els.o365Ten.value = textScalar(pol.Office365TenantsList) || "";
    if (els.o365Dir) els.o365Dir.value = textScalar(pol.Office365DirectoryId) || "";
    setWfpFwHint(mode === "create" ? "create" : "edit");
    mountWfpFwPicker(mode === "create" ? "create" : "edit", mode === "edit" ? row : null);
    if (els.title) {
      els.title.textContent = mode === "create" ? "Add web policy" : "Edit web policy";
    }
    renderRuleTable();
    openRulePanel(false, false);
  }

  function cacheEls() {
    els = {
      title: root.querySelector("#gc-wfp-flyout-title"),
      main: root.querySelector("#gc-wfp-flyout-main"),
      rulePanel: root.querySelector("#gc-wfp-rule-panel"),
      form: root.querySelector("#gc-wfp-form"),
      nameInp: root.querySelector("#gc-wfp-name"),
      descTa: root.querySelector("#gc-wfp-desc"),
      defaultAct: root.querySelector("#gc-wfp-default-action"),
      reporting: root.querySelector("#gc-wfp-reporting"),
      quotaH: root.querySelector("#gc-wfp-quota-h"),
      quotaM: root.querySelector("#gc-wfp-quota-m"),
      flyoutClose: root.querySelector("#gc-wfp-flyout-close"),
      safeSearch: root.querySelector("#gc-wfp-safe-search"),
      imgLic: root.querySelector("#gc-wfp-image-licensing"),
      ytEn: root.querySelector("#gc-wfp-youtube"),
      ytStrict: root.querySelector("#gc-wfp-youtube-strict"),
      dlEn: root.querySelector("#gc-wfp-dl-limit-en"),
      dlMb: root.querySelector("#gc-wfp-dl-mb"),
      xff: root.querySelector("#gc-wfp-xff"),
      googEn: root.querySelector("#gc-wfp-google-domains-en"),
      googDom: root.querySelector("#gc-wfp-google-domains"),
      o365En: root.querySelector("#gc-wfp-o365-en"),
      o365Ten: root.querySelector("#gc-wfp-o365-tenants"),
      o365Dir: root.querySelector("#gc-wfp-o365-dir"),
      ruleTbody: root.querySelector("#gc-wfp-rules-tbody"),
      ruleCats: root.querySelector("#gc-wfp-rule-cats"),
      ruleHttp: root.querySelector("#gc-wfp-rule-http"),
      ruleHttps: root.querySelector("#gc-wfp-rule-https"),
      ruleFollow: root.querySelector("#gc-wfp-rule-follow"),
      ruleSchedule: root.querySelector("#gc-wfp-rule-schedule"),
      ruleUsers: root.querySelector("#gc-wfp-rule-users"),
      ruleEnabled: root.querySelector("#gc-wfp-rule-enabled"),
      rulePanelTitle: root.querySelector("#gc-wfp-rule-panel-title"),
      saveBtn: root.querySelector("#gc-wfp-save"),
      cancelBtn: root.querySelector("#gc-wfp-cancel"),
      rulesCloneBtn: root.querySelector("#gc-wfp-rules-clone"),
      rulesDeleteBtn: root.querySelector("#gc-wfp-rules-delete-selected"),
      addRuleBtn: root.querySelector("#gc-wfp-add-rule"),
      addCatBtn: root.querySelector("#gc-wfp-rule-add-cat"),
      ruleCancel: root.querySelector("#gc-wfp-rule-cancel"),
      ruleApply: root.querySelector("#gc-wfp-rule-apply"),
    };
  }

  function bindOnce() {
    if (!root || root.dataset.gcWfpFlyoutBound === "1") return;
    root.dataset.gcWfpFlyoutBound = "1";
    cacheEls();
    bindPanelResize();
    fillSelect(els.ruleHttp, HTTP_ACTIONS, "Allow");
    fillSelect(els.ruleHttps, HTTP_ACTIONS, "Allow");

    if (els.ruleCancel) {
      els.ruleCancel.addEventListener("click", cancelRuleEditor);
    }
    if (els.ruleApply) {
      els.ruleApply.addEventListener("click", applyRuleFromForm);
    }
    if (els.addCatBtn) {
      els.addCatBtn.addEventListener("click", function () {
        addCatRow({ id: "", type: "WebCategory" });
      });
    }
    if (els.addRuleBtn) {
      els.addRuleBtn.addEventListener("click", function () {
        rulesModel.push(defaultRule());
        renderRuleTable();
        openRuleEditorFromModel(rulesModel.length - 1);
      });
    }

    if (els.ruleTbody && els.ruleTbody.dataset.gcWfpRowSelectBound !== "1") {
      els.ruleTbody.dataset.gcWfpRowSelectBound = "1";
      els.ruleTbody.addEventListener("change", function (e) {
        if (!e.target || !e.target.classList.contains("gc-wfp-rule-row-select")) return;
        syncWfpRulesSelectAllHeader();
        syncWfpRuleToolbar();
      });
    }
    var selAllInp = document.getElementById("gc-wfp-rules-select-all");
    if (selAllInp && selAllInp.dataset.gcWfpBound !== "1") {
      selAllInp.dataset.gcWfpBound = "1";
      selAllInp.addEventListener("change", function () {
        var on = selAllInp.checked;
        if (els.ruleTbody) {
          els.ruleTbody.querySelectorAll(".gc-wfp-rule-row-select").forEach(function (cb) {
            cb.checked = on;
          });
        }
        syncWfpRuleToolbar();
      });
    }
    if (els.rulesCloneBtn) {
      els.rulesCloneBtn.addEventListener("click", function () {
        if (els.rulesCloneBtn.disabled) return;
        cloneSelectedRules();
      });
    }
    if (els.rulesDeleteBtn) {
      els.rulesDeleteBtn.addEventListener("click", function () {
        if (els.rulesDeleteBtn.disabled) return;
        var n = getSelectedRuleIndices().length;
        if (n < 1) return;
        if (
          !window.confirm(
            "Remove " + n + " selected rule" + (n === 1 ? "" : "s") + " from this policy?",
          )
        ) {
          return;
        }
        deleteSelectedRules();
      });
    }

    if (els.flyoutClose) {
      els.flyoutClose.addEventListener("click", closeFlyout);
    }
    if (els.cancelBtn) {
      els.cancelBtn.addEventListener("click", closeFlyout);
    }
    var backdrop = root.querySelector(".gc-if-flyout__backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", closeFlyout);
    }

    if (els.form && els.form.dataset.gcWfpFwPanelClose !== "1") {
      els.form.dataset.gcWfpFwPanelClose = "1";
      els.form.addEventListener("click", function (e) {
        if (!root || root.hidden) return;
        if (e.target.closest("[data-gc-fw-ms]")) return;
        var body = wfpMainFormBody();
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
          var createFwIds = collectWfpFlyoutFirewallIds();
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
          function finishCreate(errMsg) {
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
            if (typeof window.gcWebfilterPolicyTableRefresh === "function") {
              window.gcWebfilterPolicyTableRefresh();
            }
          }
          function stepCreate() {
            if (cIdx >= createFwIds.length) {
              finishCreate(null);
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
                  finishCreate(typeof em === "string" ? em : JSON.stringify(em));
                  return;
                }
                cQueued++;
                stepCreate();
              })
              .catch(function () {
                finishCreate("Network error.");
              });
          }
          stepCreate();
          return;
        }
        var allTargets = collectWfpUpdateTargets(currentRow);
        var byFw = {};
        allTargets.forEach(function (t) {
          if (t && t.firewall_id != null) byFw[t.firewall_id] = t;
        });
        var selectedFw = collectWfpFlyoutFirewallIds();
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
        function finishSave(errMsg) {
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
          if (typeof window.gcWebfilterPolicyTableRefresh === "function") {
            window.gcWebfilterPolicyTableRefresh();
          }
        }
        function stepUpdate() {
          if (uIdx >= toUpdate.length) {
            stepCreateAfterUpdates();
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
                finishSave(typeof em2 === "string" ? em2 : JSON.stringify(em2));
                return;
              }
              if (x.j && x.j.task_id != null) queued++;
              stepUpdate();
            })
            .catch(function () {
              finishSave("Network error.");
            });
        }
        var crIdx = 0;
        function stepCreateAfterUpdates() {
          if (crIdx >= toCreateFw.length) {
            finishSave(null);
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
                finishSave(typeof em3 === "string" ? em3 : JSON.stringify(em3));
                return;
              }
              queued++;
              stepCreateAfterUpdates();
            })
            .catch(function () {
              finishSave("Network error.");
            });
        }
        if (toUpdate.length) stepUpdate();
        else stepCreateAfterUpdates();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (!root || root.hidden) return;
      if (e.key === "Escape") {
        if (root.classList.contains("gc-wfp-flyout--rule-open")) {
          cancelRuleEditor();
        } else {
          closeFlyout();
        }
      }
    });
  }

  window.gcWebfilterPolicyFlyoutInit = function () {
    root = document.getElementById("gc-wfp-flyout");
    CREATE_URL =
      typeof window.GC_WEBFILTER_POLICY_CREATE_URL === "string"
        ? window.GC_WEBFILTER_POLICY_CREATE_URL
        : "";
    UPDATE_URL =
      typeof window.GC_WEBFILTER_POLICY_UPDATE_URL === "string"
        ? window.GC_WEBFILTER_POLICY_UPDATE_URL
        : "";
    if (!root) return;
    bindOnce();
  };

  window.gcWebfilterPolicyFlyoutOpenFromTr = function (tr) {
    window.gcWebfilterPolicyFlyoutInit();
    var row = tr && tr._gcNetRow;
    if (!row || !root) return;
    mode = "edit";
    currentRow = row;
    populateFromPolicy(row.policy, row);
    openFlyout();
    var wBody = wfpMainFormBody();
    if (wBody && typeof window.gcCombineFlyoutApplyConflictChrome === "function") {
      window.gcCombineFlyoutApplyConflictChrome(wBody, row, {
        columnLabels: { __description: "Description", __policy_body: "Policy content" },
        fieldPickHandlers: {
          __policy_body: function (raw) {
            try {
              var o = JSON.parse(String(raw));
              populateFromPolicy(o, currentRow);
            } catch (ePol) {
              bannerResult(false, "Could not parse stored policy JSON for that firewall.");
            }
          },
        },
      });
    }
  };

  window.gcWebfilterPolicyFlyoutOpenCreate = function () {
    window.gcWebfilterPolicyFlyoutInit();
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
