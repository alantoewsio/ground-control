(function () {
  "use strict";

  let configurationInventory = [];

  function tagKey(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  function normalizeInventoryRows(arr) {
    let out = [];
    if (!Array.isArray(arr)) return out;
    arr.forEach(function (row) {
      if (!row || row.id == null) return;
      let cid = parseInt(String(row.id), 10);
      if (isNaN(cid) || cid <= 0) return;
      let lbl = String(row.label != null ? row.label : "").trim() || String(cid);
      let tags = [];
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
    let seen = {};
    let collected = [];
    (rows || []).forEach(function (row) {
      (row.tags || []).forEach(function (t) {
        let k = tagKey(t);
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
    let set = {};
    let tagWant = {};
    (selectedTags || []).forEach(function (t) {
      let k = tagKey(t);
      if (k) tagWant[k] = true;
    });
    (selectedIds || []).forEach(function (id) {
      let n = parseInt(String(id), 10);
      if (!isNaN(n) && n > 0) set[String(n)] = true;
    });
    (rows || []).forEach(function (row) {
      if (!row || row.id == null) return;
      let tags = row.tags || [];
      for (let i = 0; i < tags.length; i++) {
        if (tagWant[tagKey(tags[i])]) {
          let n = parseInt(String(row.id), 10);
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
    let root = document.getElementById("gc-net-cfg-multiselect");
    if (!root) return [];
    let msEl = root.querySelector("[data-gc-cfg-ms]");
    if (!msEl) return [];
    let ids = [];
    msEl.querySelectorAll(".gc-net-cfg-cb:checked").forEach(function (cb) {
      let v = parseInt(cb.value, 10);
      if (!isNaN(v)) ids.push(v);
    });
    return ids;
  }

  function readExplicitTagsFromDom() {
    let root = document.getElementById("gc-net-cfg-multiselect");
    if (!root) return [];
    let msEl = root.querySelector("[data-gc-cfg-ms]");
    if (!msEl) return [];
    let tags = [];
    msEl.querySelectorAll(".gc-net-cfg-tag-cb:checked").forEach(function (cb) {
      let v = String(cb.value || "").trim();
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

  globalThis.gcGetSelectedConfigurationIds = getSelectedConfigurationIds;

  globalThis.gcGetConfigurationNavInventory = function () {
    return (configurationInventory || []).map(function (x) {
      return { id: x.id, label: x.label };
    });
  };

  let cfg = globalThis.GC_TOP_BAR_CONFIGURATIONS;
  if (!cfg || !cfg.userId) return;

  function storageKey() {
    return (cfg.storageKey || "ground-control-network-cfg-filter-v2") + ":" + String(cfg.userId);
  }

  let root = document.getElementById("gc-net-cfg-multiselect");
  let ms = root ? root.querySelector("[data-gc-cfg-ms]") : null;
  let trigger = document.getElementById("gc-net-cfg-trigger");
  let dropdown = document.getElementById("gc-net-cfg-dropdown");
  let textEl = document.getElementById("gc-net-cfg-trigger-text");
  let search = document.getElementById("gc-net-cfg-search");
  let optsRoot = document.getElementById("gc-net-cfg-options");
  let emptyEl = document.getElementById("gc-net-cfg-empty");

  let ok = !!(root && ms && trigger && dropdown && textEl && optsRoot);

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
    let configurationIds = [];
    ms.querySelectorAll(".gc-net-cfg-cb:checked").forEach(function (cb) {
      let v = parseInt(cb.value, 10);
      if (!isNaN(v)) configurationIds.push(v);
    });
    let tags = [];
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
      let raw = localStorage.getItem(storageKey());
      if (raw) {
        let o = JSON.parse(raw);
        if (o && o.v === 2 && Array.isArray(o.configurationIds) && Array.isArray(o.tags)) {
          return o;
        }
      }
    } catch (e) {}
    return { v: 2, configurationIds: [], tags: [] };
  }

  function syncTriggerText() {
    let nCfg = ms.querySelectorAll(".gc-net-cfg-cb:checked").length;
    let nTag = ms.querySelectorAll(".gc-net-cfg-tag-cb:checked").length;
    let eff = getSelectedConfigurationIds().length;
    if (nCfg === 0 && nTag === 0) {
      textEl.textContent = "No configurations selected";
      return;
    }
    let parts = [];
    if (nTag) parts.push(nTag === 1 ? "1 tag" : nTag + " tags");
    if (nCfg) parts.push(nCfg === 1 ? "1 configuration" : nCfg + " configurations");
    let base = parts.join(" · ");
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
    let tags = distinctOrderedTags(configurationInventory);
    if (tags.length > 0) {
      let sec = document.createElement("div");
      sec.className = "gc-top-bar-fw__section-label";
      sec.textContent = "Tags";
      optsRoot.appendChild(sec);
      tags.forEach(function (tag) {
        let lab = document.createElement("label");
        lab.className =
          "gc-multiselect__option gc-hs-ip-host-flyout__fw-option gc-top-bar-fw__tag-option";
        let cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "gc-net-cfg-tag-cb";
        cb.value = tag;
        cb.setAttribute("data-gc-cfg-tag", tag);
        cb.addEventListener("change", onMsCheckboxChange);
        let pill = document.createElement("span");
        pill.className = "gc-hs-ip-host-flyout__fw-pill";
        pill.textContent = tag;
        lab.appendChild(cb);
        lab.appendChild(pill);
        optsRoot.appendChild(lab);
      });
      let div = document.createElement("div");
      div.className = "gc-top-bar-fw__divider";
      div.setAttribute("role", "separator");
      optsRoot.appendChild(div);
      let secCfg = document.createElement("div");
      secCfg.className = "gc-top-bar-fw__section-label";
      secCfg.textContent = "Configurations";
      optsRoot.appendChild(secCfg);
    }
    configurationInventory.forEach(function (it) {
      let id = it.id;
      let label = String(it.label != null ? it.label : "").trim() || String(id);
      let lab = document.createElement("label");
      lab.className = "gc-multiselect__option gc-hs-ip-host-flyout__fw-option gc-top-bar-fw__fw-option";
      let cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "gc-net-cfg-cb";
      cb.value = String(id);
      cb.setAttribute("data-gc-cfg-id", String(id));
      cb.setAttribute("data-gc-cfg-label", label);
      cb.addEventListener("change", onMsCheckboxChange);
      let textWrap = document.createElement("span");
      textWrap.className = "gc-hs-ip-host-flyout__hg-opt-text";
      let nameEl = document.createElement("span");
      nameEl.className = "gc-hs-ip-host-flyout__hg-opt-name mono";
      nameEl.textContent = label;
      textWrap.appendChild(nameEl);
      lab.appendChild(cb);
      lab.appendChild(textWrap);
      optsRoot.appendChild(lab);
    });
    if (emptyEl) {
      let showEmpty = configurationInventory.length === 0;
      emptyEl.hidden = !showEmpty;
      if (showEmpty) {
        emptyEl.textContent = "No configurations yet.";
      }
    }
    syncTriggerText();
  }

  function restoreCheckboxesFromState(st) {
    let want = {};
    (st.configurationIds || []).forEach(function (x) {
      let n = parseInt(String(x), 10);
      if (!isNaN(n)) want[String(n)] = true;
    });
    let wantTag = {};
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
    let q = norm(search ? search.value : "");
    ms.querySelectorAll(".gc-top-bar-fw__tag-option").forEach(function (lab) {
      let cb = lab.querySelector("[data-gc-cfg-tag]");
      let tg = cb ? norm(cb.dataset.gcCfgTag || "") : "";
      let match = !q || tg.indexOf(q) !== -1;
      lab.style.display = match ? "" : "none";
    });
    ms.querySelectorAll(".gc-top-bar-fw__fw-option").forEach(function (lab) {
      let cb = lab.querySelector("[data-gc-cfg-id]");
      let nm = cb ? norm(cb.dataset.gcCfgLabel || "") : "";
      let idStr = cb ? norm(String(cb.dataset.gcCfgId || "")) : "";
      let match = !q || nm.indexOf(q) !== -1 || idStr.indexOf(q) !== -1;
      lab.style.display = match ? "" : "none";
    });
  }

  function setOpen(open) {
    dropdown.hidden = !open;
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) scheduleInventoryRefresh();
  }

  let refreshTimer = null;
  let slowRefreshTimer = null;

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
    let normalized = normalizeInventoryRows(raw);
    let st = {
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
    let beforeEff = sortedIdStr(
      computeEffectiveIds(configurationInventory, st.configurationIds, st.tags),
    );
    configurationInventory = normalized;
    try {
      globalThis.gcNavConfigurationsJson = configurationInventory;
    } catch (e) {}
    renderMsOptions();
    restoreCheckboxesFromState(st);
    syncTriggerText();
    persist();
    let afterEff = sortedIdStr(getSelectedConfigurationIds());
    if (beforeEff !== afterEff) emitChange();
  }

  globalThis.gcApplyNavConfigurationsJson = function (data) {
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
    let t = e.target;
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

  let initial = globalThis.gcNavConfigurationsJson;
  configurationInventory = normalizeInventoryRows(Array.isArray(initial) ? initial : []);
  try {
    globalThis.gcNavConfigurationsJson = configurationInventory;
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
