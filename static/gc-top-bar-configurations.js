(function () {
  "use strict";

  var configurationInventory = [];

  function tagKey(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  function normalizeInventoryRows(arr) {
    var out = [];
    if (!Array.isArray(arr)) return out;
    arr.forEach(function (row) {
      if (!row || row.id == null) return;
      var cid = parseInt(String(row.id), 10);
      if (isNaN(cid) || cid <= 0) return;
      var lbl = String(row.label != null ? row.label : "").trim() || String(cid);
      var tags = [];
      if (Array.isArray(row.tags)) {
        row.tags.forEach(function (t) {
          if (typeof t === "string" && t.trim()) tags.push(t.trim());
        });
      }
      out.push({ id: cid, label: lbl, tags: tags });
    });
    out.sort(function (a, b) {
      return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
    });
    return out;
  }

  function distinctOrderedTags(rows) {
    var seen = {};
    var collected = [];
    (rows || []).forEach(function (row) {
      (row.tags || []).forEach(function (t) {
        var k = tagKey(t);
        if (!k || seen[k]) return;
        seen[k] = true;
        collected.push(String(t).trim());
      });
    });
    collected.sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    return collected;
  }

  function computeEffectiveIds(rows, selectedIds, selectedTags) {
    var set = {};
    var tagWant = {};
    (selectedTags || []).forEach(function (t) {
      var k = tagKey(t);
      if (k) tagWant[k] = true;
    });
    (selectedIds || []).forEach(function (id) {
      var n = parseInt(String(id), 10);
      if (!isNaN(n) && n > 0) set[String(n)] = true;
    });
    (rows || []).forEach(function (row) {
      if (!row || row.id == null) return;
      var tags = row.tags || [];
      for (var i = 0; i < tags.length; i++) {
        if (tagWant[tagKey(tags[i])]) {
          var n = parseInt(String(row.id), 10);
          if (!isNaN(n) && n > 0) set[String(n)] = true;
          break;
        }
      }
    });
    return Object.keys(set)
      .map(function (k) {
        return parseInt(k, 10);
      })
      .filter(function (n) {
        return !isNaN(n);
      });
  }

  function readExplicitCfgIdsFromDom() {
    var root = document.getElementById("gc-net-cfg-multiselect");
    if (!root) return [];
    var msEl = root.querySelector("[data-gc-cfg-ms]");
    if (!msEl) return [];
    var ids = [];
    msEl.querySelectorAll(".gc-net-cfg-cb:checked").forEach(function (cb) {
      var v = parseInt(cb.value, 10);
      if (!isNaN(v)) ids.push(v);
    });
    return ids;
  }

  function readExplicitTagsFromDom() {
    var root = document.getElementById("gc-net-cfg-multiselect");
    if (!root) return [];
    var msEl = root.querySelector("[data-gc-cfg-ms]");
    if (!msEl) return [];
    var tags = [];
    msEl.querySelectorAll(".gc-net-cfg-tag-cb:checked").forEach(function (cb) {
      var v = String(cb.value || "").trim();
      if (v) tags.push(v);
    });
    return tags;
  }

  function getSelectedConfigurationIds() {
    return computeEffectiveIds(
      configurationInventory,
      readExplicitCfgIdsFromDom(),
      readExplicitTagsFromDom(),
    );
  }

  window.gcGetSelectedConfigurationIds = getSelectedConfigurationIds;

  window.gcGetConfigurationNavInventory = function () {
    return (configurationInventory || []).map(function (x) {
      return { id: x.id, label: x.label };
    });
  };

  var cfg = window.GC_TOP_BAR_CONFIGURATIONS;
  if (!cfg || !cfg.userId) return;

  function storageKey() {
    return (cfg.storageKey || "ground-control-network-cfg-filter-v2") + ":" + String(cfg.userId);
  }

  var root = document.getElementById("gc-net-cfg-multiselect");
  var ms = root ? root.querySelector("[data-gc-cfg-ms]") : null;
  var trigger = document.getElementById("gc-net-cfg-trigger");
  var dropdown = document.getElementById("gc-net-cfg-dropdown");
  var textEl = document.getElementById("gc-net-cfg-trigger-text");
  var search = document.getElementById("gc-net-cfg-search");
  var optsRoot = document.getElementById("gc-net-cfg-options");
  var emptyEl = document.getElementById("gc-net-cfg-empty");

  var ok = !!(root && ms && trigger && dropdown && textEl && optsRoot);

  function emitChange() {
    document.dispatchEvent(
      new CustomEvent("gc-configuration-selection-changed", {
        detail: {
          ids: getSelectedConfigurationIds(),
          configurationIds: readExplicitCfgIdsFromDom(),
          tags: readExplicitTagsFromDom(),
        },
      }),
    );
  }

  if (!ok) {
    setTimeout(emitChange, 0);
    return;
  }

  function persist() {
    var configurationIds = [];
    ms.querySelectorAll(".gc-net-cfg-cb:checked").forEach(function (cb) {
      var v = parseInt(cb.value, 10);
      if (!isNaN(v)) configurationIds.push(v);
    });
    var tags = [];
    ms.querySelectorAll(".gc-net-cfg-tag-cb:checked").forEach(function (cb) {
      tags.push(cb.value);
    });
    try {
      localStorage.setItem(
        storageKey(),
        JSON.stringify({ v: 2, configurationIds: configurationIds, tags: tags }),
      );
    } catch (e) {}
  }

  function loadFilterState() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.v === 2 && Array.isArray(o.configurationIds) && Array.isArray(o.tags)) {
          return o;
        }
      }
    } catch (e) {}
    return { v: 2, configurationIds: [], tags: [] };
  }

  function syncTriggerText() {
    var nCfg = ms.querySelectorAll(".gc-net-cfg-cb:checked").length;
    var nTag = ms.querySelectorAll(".gc-net-cfg-tag-cb:checked").length;
    var eff = getSelectedConfigurationIds().length;
    if (nCfg === 0 && nTag === 0) {
      textEl.textContent = "No configurations selected";
      return;
    }
    var parts = [];
    if (nTag) parts.push(nTag === 1 ? "1 tag" : nTag + " tags");
    if (nCfg) parts.push(nCfg === 1 ? "1 configuration" : nCfg + " configurations");
    var base = parts.join(" · ");
    if (nTag > 0) {
      textEl.textContent = base + " → " + eff + " configuration" + (eff === 1 ? "" : "s");
    } else {
      textEl.textContent = base;
    }
  }

  function onMsCheckboxChange() {
    syncTriggerText();
    persist();
    emitChange();
  }

  function renderMsOptions() {
    optsRoot.innerHTML = "";
    var tags = distinctOrderedTags(configurationInventory);
    if (tags.length > 0) {
      var sec = document.createElement("div");
      sec.className = "gc-top-bar-fw__section-label";
      sec.textContent = "Tags";
      optsRoot.appendChild(sec);
      tags.forEach(function (tag) {
        var lab = document.createElement("label");
        lab.className =
          "gc-multiselect__option gc-hs-ip-host-flyout__fw-option gc-top-bar-fw__tag-option";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "gc-net-cfg-tag-cb";
        cb.value = tag;
        cb.setAttribute("data-gc-cfg-tag", tag);
        cb.addEventListener("change", onMsCheckboxChange);
        var pill = document.createElement("span");
        pill.className = "gc-hs-ip-host-flyout__fw-pill";
        pill.textContent = tag;
        lab.appendChild(cb);
        lab.appendChild(pill);
        optsRoot.appendChild(lab);
      });
      var div = document.createElement("div");
      div.className = "gc-top-bar-fw__divider";
      div.setAttribute("role", "separator");
      optsRoot.appendChild(div);
      var secCfg = document.createElement("div");
      secCfg.className = "gc-top-bar-fw__section-label";
      secCfg.textContent = "Configurations";
      optsRoot.appendChild(secCfg);
    }
    configurationInventory.forEach(function (it) {
      var id = it.id;
      var label = String(it.label != null ? it.label : "").trim() || String(id);
      var lab = document.createElement("label");
      lab.className = "gc-multiselect__option gc-hs-ip-host-flyout__fw-option gc-top-bar-fw__fw-option";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "gc-net-cfg-cb";
      cb.value = String(id);
      cb.setAttribute("data-gc-cfg-id", String(id));
      cb.setAttribute("data-gc-cfg-label", label);
      cb.addEventListener("change", onMsCheckboxChange);
      var textWrap = document.createElement("span");
      textWrap.className = "gc-hs-ip-host-flyout__hg-opt-text";
      var nameEl = document.createElement("span");
      nameEl.className = "gc-hs-ip-host-flyout__hg-opt-name mono";
      nameEl.textContent = label;
      textWrap.appendChild(nameEl);
      lab.appendChild(cb);
      lab.appendChild(textWrap);
      optsRoot.appendChild(lab);
    });
    if (emptyEl) {
      var showEmpty = configurationInventory.length === 0;
      emptyEl.hidden = !showEmpty;
      if (showEmpty) {
        emptyEl.textContent = "No configurations yet.";
      }
    }
    syncTriggerText();
  }

  function restoreCheckboxesFromState(st) {
    var want = {};
    (st.configurationIds || []).forEach(function (x) {
      var n = parseInt(String(x), 10);
      if (!isNaN(n)) want[String(n)] = true;
    });
    var wantTag = {};
    (st.tags || []).forEach(function (t) {
      wantTag[tagKey(t)] = true;
    });
    ms.querySelectorAll(".gc-net-cfg-cb").forEach(function (cb) {
      cb.checked = !!want[String(cb.value)];
    });
    ms.querySelectorAll(".gc-net-cfg-tag-cb").forEach(function (cb) {
      cb.checked = !!wantTag[tagKey(cb.value)];
    });
  }

  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  function runCfgFilter() {
    var q = norm(search ? search.value : "");
    ms.querySelectorAll(".gc-top-bar-fw__tag-option").forEach(function (lab) {
      var cb = lab.querySelector("[data-gc-cfg-tag]");
      var tg = cb ? norm(cb.getAttribute("data-gc-cfg-tag") || "") : "";
      var match = !q || tg.indexOf(q) !== -1;
      lab.style.display = match ? "" : "none";
    });
    ms.querySelectorAll(".gc-top-bar-fw__fw-option").forEach(function (lab) {
      var cb = lab.querySelector("[data-gc-cfg-id]");
      var nm = cb ? norm(cb.getAttribute("data-gc-cfg-label") || "") : "";
      var idStr = cb ? norm(String(cb.getAttribute("data-gc-cfg-id") || "")) : "";
      var match = !q || nm.indexOf(q) !== -1 || idStr.indexOf(q) !== -1;
      lab.style.display = match ? "" : "none";
    });
  }

  function setOpen(open) {
    dropdown.hidden = !open;
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) scheduleInventoryRefresh();
  }

  var refreshTimer = null;
  var slowRefreshTimer = null;

  function scheduleInventoryRefresh() {
    if (!cfg.navRefreshUrl) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () {
      refreshTimer = null;
      doInventoryRefresh();
    }, 100);
  }

  function scheduleInventoryRefreshSlow() {
    if (!cfg.navRefreshUrl) return;
    if (slowRefreshTimer) clearTimeout(slowRefreshTimer);
    slowRefreshTimer = setTimeout(function () {
      slowRefreshTimer = null;
      doInventoryRefresh();
    }, 500);
  }

  function doInventoryRefresh() {
    if (!cfg || !cfg.navRefreshUrl) return;
    fetch(cfg.navRefreshUrl, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        return r.ok ? r.json() : Promise.reject();
      })
      .then(function (data) {
        applyConfigurationInventory(data);
      })
      .catch(function () {});
  }

  function sortedIdStr(ids) {
    return ids
      .slice()
      .sort(function (a, b) {
        return a - b;
      })
      .join(",");
  }

  function applyConfigurationInventory(raw) {
    var normalized = normalizeInventoryRows(raw);
    var st = {
      v: 2,
      configurationIds: readExplicitCfgIdsFromDom(),
      tags: readExplicitTagsFromDom(),
    };
    if (
      st.configurationIds.length === 0 &&
      st.tags.length === 0 &&
      ms.querySelectorAll(".gc-net-cfg-cb, .gc-net-cfg-tag-cb").length === 0
    ) {
      st = loadFilterState();
    }
    var beforeEff = sortedIdStr(
      computeEffectiveIds(configurationInventory, st.configurationIds, st.tags),
    );
    configurationInventory = normalized;
    try {
      window.gcNavConfigurationsJson = configurationInventory;
    } catch (e) {}
    renderMsOptions();
    restoreCheckboxesFromState(st);
    syncTriggerText();
    persist();
    var afterEff = sortedIdStr(getSelectedConfigurationIds());
    if (beforeEff !== afterEff) emitChange();
  }

  window.gcApplyNavConfigurationsJson = function (data) {
    applyConfigurationInventory(data);
  };

  trigger.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(dropdown.hidden);
    if (!dropdown.hidden && search) {
      try {
        search.focus();
      } catch (eF) {}
    }
  });

  dropdown.addEventListener("mousedown", function (e) {
    e.stopPropagation();
  });
  dropdown.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  if (search) {
    search.addEventListener("input", runCfgFilter);
    search.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!(t instanceof Node) || !root.contains(t)) setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    scheduleInventoryRefreshSlow();
  });

  document.addEventListener("gc-nav-configurations-refresh-requested", function () {
    doInventoryRefresh();
  });

  var initial = window.gcNavConfigurationsJson;
  configurationInventory = normalizeInventoryRows(Array.isArray(initial) ? initial : []);
  try {
    window.gcNavConfigurationsJson = configurationInventory;
  } catch (e2) {}
  renderMsOptions();
  restoreCheckboxesFromState(loadFilterState());
  syncTriggerText();
  runCfgFilter();

  setTimeout(function () {
    emitChange();
  }, 0);

  if (configurationInventory.length === 0 && cfg.navRefreshUrl) {
    doInventoryRefresh();
  }
})();
