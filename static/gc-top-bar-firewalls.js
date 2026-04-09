(function () {
  "use strict";

  let firewallInventory = [];
  let configurationInventory = [];

  function normalizeConfigurationInventoryRows(arr) {
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

  function tagKey(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  function normalizeInventoryRows(arr) {
    let out = [];
    if (!Array.isArray(arr)) return out;
    arr.forEach(function (fw) {
      if (!fw || fw.id == null) return;
      let fid = parseInt(String(fw.id), 10);
      if (isNaN(fid) || fid <= 0) return;
      let lbl = String(fw.label != null ? fw.label : "").trim() || String(fid);
      let tags = [];
      if (Array.isArray(fw.tags)) {
        fw.tags.forEach(function (t) {
          if (typeof t === "string" && t.trim()) tags.push(t.trim());
        });
      }
      let desc = fw.description != null ? String(fw.description).trim() : "";
      let urls = null;
      if (fw.urls && typeof fw.urls === "object") {
        urls = {
          webadmin: String(fw.urls.webadmin || ""),
          ssh: String(fw.urls.ssh || ""),
          monitor: String(fw.urls.monitor || ""),
          sync: String(fw.urls.sync || ""),
          test: String(fw.urls.test || ""),
        };
      }
      out.push({
        id: fid,
        label: lbl,
        tags: tags,
        description: desc || null,
        online: fw.online === true,
        urls: urls,
      });
    });
    out.sort(function (a, b) {
      return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
    });
    return out;
  }

  function distinctOrderedTags(fws) {
    let seen = {};
    let collected = [];
    (fws || []).forEach(function (fw) {
      (fw.tags || []).forEach(function (t) {
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

  function computeEffectiveIds(fws, selectedFwIds, selectedTags) {
    let set = {};
    let tagWant = {};
    (selectedTags || []).forEach(function (t) {
      let k = tagKey(t);
      if (k) tagWant[k] = true;
    });
    (selectedFwIds || []).forEach(function (id) {
      let n = parseInt(String(id), 10);
      if (!isNaN(n) && n > 0) set[String(n)] = true;
    });
    (fws || []).forEach(function (fw) {
      if (!fw || fw.id == null) return;
      let tags = fw.tags || [];
      for (let i = 0; i < tags.length; i++) {
        if (tagWant[tagKey(tags[i])]) {
          let n = parseInt(String(fw.id), 10);
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

  function readExplicitFwIdsFromDom() {
    let root = document.getElementById("gc-net-fw-multiselect");
    if (!root) return [];
    let ids = [];
    /* Scope to top-bar root only — do not require [data-gc-fw-ms] (avoids empty reads if markup shifts). */
    root.querySelectorAll(".gc-net-fw-cb--fw:checked").forEach(function (cb) {
      let raw = String(cb.value || "");
      let n =
        raw.indexOf("f:") === 0 ? parseInt(raw.slice(2), 10) : parseInt(raw, 10);
      if (!isNaN(n)) ids.push(n);
    });
    return ids;
  }

  function readExplicitConfigurationIdsFromDom() {
    let root = document.getElementById("gc-net-fw-multiselect");
    if (!root) return [];
    let ids = [];
    root.querySelectorAll(".gc-net-fw-cb--cfg:checked").forEach(function (cb) {
      let raw = String(cb.value || "");
      let n =
        raw.indexOf("c:") === 0 ? parseInt(raw.slice(2), 10) : parseInt(raw, 10);
      if (!isNaN(n)) ids.push(n);
    });
    return ids;
  }

  function readExplicitTagsFromDom() {
    let root = document.getElementById("gc-net-fw-multiselect");
    if (!root) return [];
    let tags = [];
    root.querySelectorAll(".gc-net-fw-tag-cb:checked").forEach(function (cb) {
      let v = String(cb.value || "").trim();
      if (v) tags.push(v);
    });
    return tags;
  }

  function getSelectedFirewallIds() {
    return computeEffectiveIds(
      firewallInventory,
      readExplicitFwIdsFromDom(),
      readExplicitTagsFromDom(),
    );
  }

  globalThis.gcGetSelectedFirewallIds = getSelectedFirewallIds;

  function getSelectedConfigurationIds() {
    return readExplicitConfigurationIdsFromDom()
      .slice()
      .filter(function (n, i, a) {
        return a.indexOf(n) === i;
      });
  }

  globalThis.gcGetSelectedConfigurationIds = getSelectedConfigurationIds;

  function exclusiveViewStorageKeyForUser(uid) {
    return "ground-control-cfg-exclusive-view-v1:" + String(uid);
  }

  function readExclusiveConfigurationIdsFromLs(uid) {
    if (uid == null || uid === "") return [];
    try {
      let raw = localStorage.getItem(exclusiveViewStorageKeyForUser(uid));
      if (!raw) return [];
      let o = JSON.parse(raw);
      if (!o || o.v !== 1 || !Array.isArray(o.ids)) return [];
      let out = [];
      o.ids.forEach(function (x) {
        let n = parseInt(String(x), 10);
        if (!isNaN(n) && n > 0) out.push(n);
      });
      return out.filter(function (n, i, a) {
        return a.indexOf(n) === i;
      });
    } catch (e) {
      return [];
    }
  }

  function isGcDashboardPage() {
    try {
      return !!document.querySelector("[data-gc-dashboard-api]");
    } catch (e) {
      return false;
    }
  }

  globalThis.gcGetExclusiveConfigurationIds = function () {
    let c = globalThis.GC_TOP_BAR_FIREWALLS;
    if (!c || c.userId == null) return [];
    return readExclusiveConfigurationIdsFromLs(c.userId);
  };

  globalThis.gcGetEffectiveConfigurationIds = function () {
    let selFn = globalThis.gcGetSelectedConfigurationIds;
    let selected = typeof selFn === "function" ? selFn() || [] : [];
    if (!Array.isArray(selected)) selected = [];
    selected = selected.filter(function (n, i, a) {
      return a.indexOf(n) === i;
    });
    if (isGcDashboardPage()) return selected;
    let c = globalThis.GC_TOP_BAR_FIREWALLS;
    if (!c || c.userId == null) return selected;
    let excl = readExclusiveConfigurationIdsFromLs(c.userId);
    if (!excl.length) return selected;
    let want = {};
    excl.forEach(function (id) {
      want[String(id)] = true;
    });
    let filtered = selected.filter(function (id) {
      return want[String(id)];
    });
    /* Stale exclusive IDs (e.g. after changing checkbox selection) would hide all rows; fall back. */
    if (filtered.length === 0 && selected.length > 0) return selected;
    return filtered;
  };

  let ICON_CIRCLE_MINUS =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path fill="currentColor" d="M8 11.25h8v1.5H8z"/></svg>';

  let ICON_EYE_EXCLUSIVE =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';

  (function syncFirewallInventoryFromPageJson() {
    let fws = typeof globalThis !== "undefined" ? globalThis.gcNavFirewallsJson : null;
    let norm = normalizeInventoryRows(Array.isArray(fws) ? fws : []);
    firewallInventory = norm;
    try {
      globalThis.gcNavFirewallsJson = norm;
    } catch (eNav) {}
  })();

  (function syncConfigurationInventoryFromPageJson() {
    let cfgs =
      typeof globalThis !== "undefined" ? globalThis.gcNavConfigurationsJson : null;
    let norm = normalizeConfigurationInventoryRows(Array.isArray(cfgs) ? cfgs : []);
    configurationInventory = norm;
    try {
      globalThis.gcNavConfigurationsJson = norm;
    } catch (eCfg) {}
  })();

  globalThis.gcGetFirewallNavInventory = function () {
    return (firewallInventory || []).map(function (x) {
      return { id: x.id, label: x.label };
    });
  };

  globalThis.gcGetFirewallOnlineByLabel = function (label) {
    let want = String(label == null ? "" : label).trim().toLowerCase();
    if (!want) return null;
    for (let i = 0; i < firewallInventory.length; i++) {
      let fw = firewallInventory[i];
      if (!fw) continue;
      if (String(fw.label == null ? "" : fw.label).trim().toLowerCase() === want) {
        return fw.online === true;
      }
    }
    return null;
  };

  globalThis.gcSkipGlobalFirewallTableFilter = function () {
    let shell = document.getElementById("app-shell");
    return !!(shell && shell.hasAttribute("data-gc-skip-fw-table-filter"));
  };

  /* Compact action icons for “In scope” rows (inventory table uses 18px). */
  let ICON_WEBADMIN =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>';
  let ICON_SSH =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M4 5a2 2 0 012-2h12a2 2 0 012 2v4H4V5zm0 6h16v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8zm3.5 2.5l2 2-2 2 1.06 1.06L11.56 14 8.56 11l-1.06 1.06zm4.5 4.5h5v1.5h-5V14z"/></svg>';
  let ICON_MONITOR =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M3 17h2v-7H3v7zm4 0h2V7H7v10zm4 0h2v-4h-2v4zm4 0h2v-8h-2v8zm4 0h2V3h-2v14z"/></svg>';
  let ICON_CONFIG_VIEWER =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>';
  let ICON_SYNC =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 6V3L8 7l4 4V8c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>';
  let ICON_TEST =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>';
  /* Lucide "wrench" (stroke reads clearly at 18px; fill="none" avoids muddy blob). */
  let ICON_INVENTORY_WRENCH =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

  let LS_KEY_SYNC_ENTITIES = "ground-control-fw-sync-entities-v1";
  let CONFIG_SYNC_PROGRESS_MSG = "Syncing configuration cache from the firewall…";

  function getEnabledSyncEntityIdsForNav() {
    try {
      let raw = localStorage.getItem(LS_KEY_SYNC_ENTITIES);
      let p = raw ? JSON.parse(raw) : {};
      if (!p || typeof p !== "object") return [];
      let out = [];
      Object.keys(p).forEach(function (k) {
        if (p[k] && String(k).trim()) out.push(String(k).trim());
      });
      return out;
    } catch (e) {
      return [];
    }
  }

  function configSyncBannerMessageNav(res) {
    let body = res.body || {};
    if (res.status === 404) return { ok: false, text: "Firewall not found." };
    if (res.status === 202 && body.accepted) {
      return {
        ok: true,
        text:
          "Configuration sync started in the background. You can keep navigating; refresh when it finishes.",
      };
    }
    if (body.skipped) return { ok: false, text: body.message || "Nothing selected." };
    if (body.ok) {
      let a = body.added || 0;
      let c = body.changed || 0;
      let d = body.deleted || 0;
      if (a + c + d === 0) return { ok: true, text: "Sync finished — no changes." };
      return {
        ok: true,
        text: "Sync finished — " + a + " added, " + c + " updated, " + d + " removed.",
      };
    }
    return { ok: false, text: body.error || body.detail || "Sync failed." };
  }

  function navDispatchConfigCacheSynced(fwId) {
    let n = parseInt(fwId, 10);
    if (isNaN(n) || n < 1) return;
    try {
      document.dispatchEvent(
        new CustomEvent("gc-config-cache-synced", { detail: { firewall_ids: [n] } }),
      );
    } catch (e) {}
  }

  function fetchFirewallConfigSyncNav(syncUrl, entityIds) {
    return fetch(syncUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "Ground-Control",
      },
      body: JSON.stringify({ entities: entityIds }),
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, status: r.status, body: j };
      });
    });
  }

  function runNavConfigSync(btn) {
    let syncUrl = btn.dataset.gcNavFwSync;
    if (!syncUrl) return;
    let fwId = btn.dataset.gcNavFwId;
    let batch =
      typeof globalThis.gcGlobalBannerSyncBegin === "function" &&
      typeof globalThis.gcGlobalBannerSyncEnd === "function";
    let bid = batch ? globalThis.gcGlobalBannerSyncBegin(CONFIG_SYNC_PROGRESS_MSG) : 0;
    let ids = getEnabledSyncEntityIdsForNav();
    if (ids.length < 1) {
      let noTypes = "Open the firewall panel and enable at least one sync type.";
      if (batch) globalThis.gcGlobalBannerSyncEnd(bid, false, noTypes);
      else if (typeof globalThis.gcGlobalBannerShowResult === "function") {
        globalThis.gcGlobalBannerShowResult(false, noTypes);
      }
      return;
    }
    btn.classList.add("btn-icon--busy");
    btn.disabled = true;
    fetchFirewallConfigSyncNav(syncUrl, ids)
      .then(function (res) {
        btn.classList.remove("btn-icon--busy");
        btn.disabled = false;
        let msg = configSyncBannerMessageNav(res);
        let body = res.body || {};
        if (res.status === 202 && body.accepted) {
          if (typeof globalThis.gcGlobalBannerTrackBackgroundSync === "function") {
            globalThis.gcGlobalBannerTrackBackgroundSync(msg.text);
          } else if (batch) {
            globalThis.gcGlobalBannerSyncEnd(bid, true, msg.text);
          } else if (typeof globalThis.gcGlobalBannerShowResult === "function") {
            globalThis.gcGlobalBannerShowResult(true, msg.text);
          }
        } else {
          if (batch) globalThis.gcGlobalBannerSyncEnd(bid, msg.ok, msg.text);
          else if (typeof globalThis.gcGlobalBannerShowResult === "function") {
            globalThis.gcGlobalBannerShowResult(msg.ok, msg.text);
          }
          if (msg.ok && !body.skipped && fwId && res.status !== 202) {
            navDispatchConfigCacheSynced(fwId);
          }
        }
      })
      .catch(function () {
        btn.classList.remove("btn-icon--busy");
        btn.disabled = false;
        if (batch) globalThis.gcGlobalBannerSyncEnd(bid, false, "Request failed.");
        else if (typeof globalThis.gcGlobalBannerShowResult === "function") {
          globalThis.gcGlobalBannerShowResult(false, "Request failed.");
        }
      });
  }

  function runNavFirewallTest(btn, selectedPanelEl) {
    let testUrl = btn.dataset.gcNavFwTest;
    let fwId = btn.dataset.gcNavFwId;
    if (!testUrl || !selectedPanelEl || !fwId) return;
    let out = selectedPanelEl.querySelector('[data-gc-nav-fw-test-out="' + fwId + '"]');
    if (out) {
      out.hidden = false;
      out.textContent = "Testing…";
      out.className = "gc-net-fw-selected__test-msg";
    }
    fetch(testUrl, { method: "POST", credentials: "same-origin" })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, body: j };
        });
      })
      .then(function (_ref) {
        if (!out) return;
        let body = _ref.body || {};
        let success = _ref.ok && body.ok;
        out.textContent = body.message || (success ? "OK" : "Failed");
        out.className = "gc-net-fw-selected__test-msg " + (success ? "ok" : "err");
      })
      .catch(function () {
        if (out) {
          out.textContent = "Request failed";
          out.className = "gc-net-fw-selected__test-msg err";
        }
      });
  }

  let cfg = globalThis.GC_TOP_BAR_FIREWALLS;
  if (!cfg || !cfg.userId) return;

  function storageKey() {
    return (cfg.storageKey || "ground-control-network-fw-filter-v2") + ":" + String(cfg.userId);
  }

  function legacyStorageKey() {
    return "ground-control-network-fw-ids-v1:" + String(cfg.userId);
  }

  let root = document.getElementById("gc-net-fw-multiselect");
  let ms = root ? root.querySelector("[data-gc-fw-ms]") : null;
  let trigger = document.getElementById("gc-net-fw-trigger");
  let dropdown = document.getElementById("gc-net-fw-dropdown");
  let textEl = document.getElementById("gc-net-fw-trigger-text");
  let search = document.getElementById("gc-net-fw-search");
  let optsRoot = document.getElementById("gc-net-fw-options");
  let emptyEl = document.getElementById("gc-net-fw-empty");
  let selectedPanel = document.getElementById("gc-net-fw-selected-panel");

  let ok = !!(root && ms && trigger && dropdown && textEl && optsRoot);

  function persistExclusiveConfigurationIds(ids) {
    try {
      localStorage.setItem(
        exclusiveViewStorageKeyForUser(cfg.userId),
        JSON.stringify({ v: 1, ids: ids }),
      );
    } catch (e) {}
  }

  function loadExclusiveConfigurationIds() {
    return readExclusiveConfigurationIdsFromLs(cfg.userId);
  }

  function syncExclusiveToggleButtonStates() {
    if (!ms) return;
    let active = {};
    loadExclusiveConfigurationIds().forEach(function (id) {
      active[String(id)] = true;
    });
    ms.querySelectorAll("[data-gc-cfg-exclusive-toggle]").forEach(function (btn) {
      let id = btn.dataset.gcCfgExclusiveToggle;
      let on = !!active[String(id)];
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.classList.toggle("gc-top-bar-fw__cfg-exclusive--on", on);
      btn.title = on
        ? "Exclusive view on (data uses this configuration only among selections). Click to turn off."
        : "Exclusive view: narrow data to this configuration (selections stay the same).";
    });
  }

  function toggleExclusiveConfigurationId(cid) {
    let n = parseInt(String(cid), 10);
    if (isNaN(n) || n < 1) return;
    let cur = loadExclusiveConfigurationIds();
    let set = {};
    cur.forEach(function (x) {
      set[String(x)] = true;
    });
    if (set[String(n)]) delete set[String(n)];
    else set[String(n)] = true;
    let next = Object.keys(set)
      .map(function (k) {
        return parseInt(k, 10);
      })
      .filter(function (x) {
        return !isNaN(x) && x > 0;
      })
      .sort(function (a, b) {
        return a - b;
      });
    persistExclusiveConfigurationIds(next);
    syncExclusiveToggleButtonStates();
    try {
      document.dispatchEvent(
        new CustomEvent("gc-configuration-exclusive-view-changed", {
          detail: {
            exclusiveConfigurationIds: next.slice(),
            effectiveConfigurationIds:
              typeof globalThis.gcGetEffectiveConfigurationIds === "function"
                ? globalThis.gcGetEffectiveConfigurationIds()
                : getSelectedConfigurationIds(),
          },
        }),
      );
    } catch (eEv) {}
    emitChange();
  }

  function removeExplicitFirewallFromSelection(fwId) {
    let n = parseInt(String(fwId), 10);
    if (isNaN(n) || !ms) return;
    ms.querySelectorAll(".gc-net-fw-cb--fw").forEach(function (cb) {
      let raw = String(cb.value || "");
      let idStr = raw.indexOf("f:") === 0 ? raw.slice(2) : raw;
      if (parseInt(idStr, 10) === n) cb.checked = false;
    });
    onMsCheckboxChange();
  }

  function emitChange() {
    let effCfg =
      typeof globalThis.gcGetEffectiveConfigurationIds === "function"
        ? globalThis.gcGetEffectiveConfigurationIds()
        : getSelectedConfigurationIds();
    document.dispatchEvent(
      new CustomEvent("gc-firewall-selection-changed", {
        detail: {
          ids: getSelectedFirewallIds(),
          firewallIds: readExplicitFwIdsFromDom(),
          configurationIds: getSelectedConfigurationIds(),
          effectiveConfigurationIds: effCfg,
          exclusiveConfigurationIds: loadExclusiveConfigurationIds(),
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
    let firewallIds = [];
    let configurationIds = [];
    ms.querySelectorAll(".gc-net-fw-cb:checked").forEach(function (cb) {
      let raw = String(cb.value || "");
      if (raw.indexOf("c:") === 0) {
        let c = parseInt(raw.slice(2), 10);
        if (!isNaN(c)) configurationIds.push(c);
      } else {
        let f =
          raw.indexOf("f:") === 0 ? parseInt(raw.slice(2), 10) : parseInt(raw, 10);
        if (!isNaN(f)) firewallIds.push(f);
      }
    });
    let tags = [];
    ms.querySelectorAll(".gc-net-fw-tag-cb:checked").forEach(function (cb) {
      tags.push(cb.value);
    });
    try {
      localStorage.setItem(
        storageKey(),
        JSON.stringify({
          v: 3,
          firewallIds: firewallIds,
          configurationIds: configurationIds,
          tags: tags,
        }),
      );
    } catch (e) {}
  }

  function loadFilterState() {
    try {
      let raw = localStorage.getItem(storageKey());
      if (raw) {
        let o = JSON.parse(raw);
        if (o && o.v === 3 && Array.isArray(o.firewallIds) && Array.isArray(o.tags)) {
          if (!Array.isArray(o.configurationIds)) o.configurationIds = [];
          return o;
        }
        if (o && o.v === 2 && Array.isArray(o.firewallIds) && Array.isArray(o.tags)) {
          return {
            v: 3,
            firewallIds: o.firewallIds,
            configurationIds: [],
            tags: o.tags,
          };
        }
      }
      let leg = localStorage.getItem(legacyStorageKey());
      if (leg) {
        let ids = JSON.parse(leg);
        if (Array.isArray(ids))
          return { v: 3, firewallIds: ids, configurationIds: [], tags: [] };
      }
    } catch (e) {}
    return { v: 3, firewallIds: [], configurationIds: [], tags: [] };
  }

  function syncTriggerText() {
    let nFw = ms.querySelectorAll(".gc-net-fw-cb--fw:checked").length;
    let nCfg = ms.querySelectorAll(".gc-net-fw-cb--cfg:checked").length;
    let nTag = ms.querySelectorAll(".gc-net-fw-tag-cb:checked").length;
    let eff = getSelectedFirewallIds().length;
    let effCfg = getSelectedConfigurationIds().length;
    if (nFw === 0 && nTag === 0 && nCfg === 0) {
      textEl.textContent = "No scope selected";
      return;
    }
    let parts = [];
    if (nTag) parts.push(nTag === 1 ? "1 tag" : nTag + " tags");
    if (nCfg) parts.push(nCfg === 1 ? "1 configuration" : nCfg + " configurations");
    if (nFw) parts.push(nFw === 1 ? "1 firewall" : nFw + " firewalls");
    let base = parts.join(" · ");
    if (nTag > 0) {
      textEl.textContent =
        base +
        " → " +
        eff +
        " firewall" +
        (eff === 1 ? "" : "s") +
        (effCfg ? " · " + effCfg + " cfg" : "");
    } else {
      textEl.textContent = base;
    }
  }

  function onMsCheckboxChange() {
    syncTriggerText();
    persist();
    renderSelectedScopePanel();
    emitChange();
  }

  function renderSelectedScopePanel() {
    if (!selectedPanel) return;
    let ids = getSelectedFirewallIds()
      .slice()
      .sort(function (a, b) {
        return a - b;
      });
    let cfgIds = getSelectedConfigurationIds()
      .slice()
      .sort(function (a, b) {
        return a - b;
      });
    let map = {};
    firewallInventory.forEach(function (fw) {
      if (fw && fw.id != null) map[String(fw.id)] = fw;
    });
    let cmap = {};
    configurationInventory.forEach(function (c) {
      if (c && c.id != null) cmap[String(c.id)] = c;
    });
    let explicitFw = {};
    readExplicitFwIdsFromDom().forEach(function (fid) {
      explicitFw[String(fid)] = true;
    });
    let inner = document.createElement("div");
    inner.className = "gc-net-fw-selected__inner";
    let head = document.createElement("div");
    head.className = "gc-net-fw-selected__head";
    let sec = document.createElement("span");
    sec.className = "gc-top-bar-fw__section-label gc-net-fw-selected__head-title";
    sec.textContent = "In scope";
    head.appendChild(sec);
    let invUrl = cfg.inventoryUrl ? String(cfg.inventoryUrl).trim() : "";
    if (invUrl) {
      let inv = document.createElement("a");
      inv.className = "gc-net-fw-selected__inventory-link";
      inv.href = invUrl;
      inv.title = "Firewall inventory";
      inv.setAttribute("aria-label", "Open firewall inventory");
      inv.innerHTML = ICON_INVENTORY_WRENCH;
      head.appendChild(inv);
    }
    inner.appendChild(head);
    if (ids.length === 0 && cfgIds.length === 0) {
      let empty = document.createElement("p");
      empty.className = "gc-net-fw-selected__empty muted";
      empty.textContent = "Nothing in scope.";
      inner.appendChild(empty);
      selectedPanel.innerHTML = "";
      selectedPanel.appendChild(inner);
      return;
    }
    let list = document.createElement("div");
    list.className = "gc-net-fw-selected__list";
    cfgIds.forEach(function (cid) {
      let crow = cmap[String(cid)];
      let clabel = crow ? crow.label : "Configuration #" + cid;
      let row = document.createElement("div");
      row.className = "gc-net-fw-selected__row";
      row.setAttribute("data-gc-nav-cfg-id", String(cid));
      let rowHead = document.createElement("div");
      rowHead.className = "gc-net-fw-selected__row-head";
      let nameEl = document.createElement("span");
      nameEl.className = "gc-net-fw-selected__name mono";
      nameEl.textContent = clabel;
      rowHead.appendChild(nameEl);
      let kind = document.createElement("span");
      kind.className = "muted gc-net-fw-selected__cfg-badge";
      kind.textContent = "Configuration";
      rowHead.appendChild(kind);
      row.appendChild(rowHead);
      list.appendChild(row);
    });
    ids.forEach(function (id) {
      let fw = map[String(id)];
      let label = fw ? fw.label : "#" + id;
      let desc = fw && fw.description ? String(fw.description) : "";
      let urls = fw && fw.urls ? fw.urls : null;
      let row = document.createElement("div");
      row.className = "gc-net-fw-selected__row";
      row.setAttribute("data-gc-nav-fw-id", String(id));
      let rowHead = document.createElement("div");
      rowHead.className = "gc-net-fw-selected__row-head";
      if (explicitFw[String(id)]) {
        let rm = document.createElement("button");
        rm.type = "button";
        rm.className = "gc-top-bar-fw__explicit-remove";
        rm.setAttribute("data-gc-nav-fw-explicit-remove", String(id));
        rm.setAttribute("aria-label", "Remove firewall from selection");
        rm.title = "Remove from selection (direct picks only)";
        rm.innerHTML = ICON_CIRCLE_MINUS;
        rowHead.appendChild(rm);
      }
      let nameEl = document.createElement("span");
      nameEl.className = "gc-net-fw-selected__name mono";
      nameEl.textContent = label;
      if (desc) nameEl.title = desc;
      rowHead.appendChild(nameEl);
      let actions = document.createElement("div");
      actions.className = "gc-net-fw-selected__actions";
      if (urls && urls.webadmin) {
        let wa = document.createElement("a");
        wa.className = "btn-icon gc-net-fw-selected__action-icon";
        wa.href = urls.webadmin;
        wa.target = "_blank";
        wa.rel = "noopener noreferrer";
        wa.title = "Open WebAdmin";
        wa.setAttribute("aria-label", "Open WebAdmin in new tab");
        wa.innerHTML = ICON_WEBADMIN;
        actions.appendChild(wa);
      }
      if (urls && urls.ssh) {
        let sh = document.createElement("a");
        sh.className = "btn-icon gc-net-fw-selected__action-icon";
        sh.href = urls.ssh;
        sh.target = "_blank";
        sh.rel = "noopener noreferrer";
        sh.title = "Browser SSH (port 22; sign in interactively in the terminal)";
        sh.setAttribute("aria-label", "Open browser SSH in new tab");
        sh.innerHTML = ICON_SSH;
        actions.appendChild(sh);
      }
      if (urls && urls.monitor) {
        let mo = document.createElement("a");
        mo.className = "btn-icon gc-net-fw-selected__action-icon";
        mo.href = urls.monitor;
        mo.title = "Monitor history";
        mo.setAttribute("aria-label", "Monitor history");
        mo.innerHTML = ICON_MONITOR;
        actions.appendChild(mo);
      }
      let cv = document.createElement("button");
      cv.type = "button";
      cv.className = "btn-icon gc-config-viewer-open gc-net-fw-selected__action-icon";
      cv.title = "View cached configuration";
      cv.setAttribute("aria-label", "View cached configuration summary");
      cv.setAttribute("data-gc-cv-kind", "firewall");
      cv.setAttribute("data-gc-cv-scope-id", String(id));
      cv.setAttribute("data-gc-cv-label", label);
      cv.innerHTML = ICON_CONFIG_VIEWER;
      actions.appendChild(cv);
      if (urls && urls.sync) {
        let sy = document.createElement("button");
        sy.type = "button";
        sy.className = "btn-icon gc-net-fw-selected__action-icon";
        sy.setAttribute("data-gc-nav-fw-sync", urls.sync);
        sy.setAttribute("data-gc-nav-fw-id", String(id));
        sy.title = "Sync cached objects (types chosen in edit panel)";
        sy.setAttribute("aria-label", "Sync firewall configuration cache");
        sy.innerHTML = ICON_SYNC;
        actions.appendChild(sy);
      }
      if (urls && urls.test) {
        let te = document.createElement("button");
        te.type = "button";
        te.className = "btn-icon gc-net-fw-selected__action-icon";
        te.setAttribute("data-gc-nav-fw-test", urls.test);
        te.setAttribute("data-gc-nav-fw-id", String(id));
        te.title = "Test connection";
        te.setAttribute("aria-label", "Test connection");
        te.innerHTML = ICON_TEST;
        actions.appendChild(te);
      }
      rowHead.appendChild(actions);
      row.appendChild(rowHead);
      let testMsg = document.createElement("span");
      testMsg.className = "gc-net-fw-selected__test-msg";
      testMsg.hidden = true;
      testMsg.setAttribute("data-gc-nav-fw-test-out", String(id));
      row.appendChild(testMsg);
      list.appendChild(row);
    });
    inner.appendChild(list);
    selectedPanel.innerHTML = "";
    selectedPanel.appendChild(inner);
  }

  function renderMsOptions() {
    optsRoot.innerHTML = "";
    let tags = distinctOrderedTags(firewallInventory);
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
        cb.className = "gc-net-fw-tag-cb";
        cb.value = tag;
        cb.setAttribute("data-gc-fw-tag", tag);
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
    }
    if (configurationInventory.length > 0) {
      let secCfg = document.createElement("div");
      secCfg.className = "gc-top-bar-fw__section-label";
      secCfg.textContent = "Configurations";
      optsRoot.appendChild(secCfg);
      configurationInventory.forEach(function (it) {
        let cid = it.id;
        let label = String(it.label != null ? it.label : "").trim() || String(cid);
        let rowWrap = document.createElement("div");
        rowWrap.className = "gc-top-bar-fw__cfg-option-row";
        let eyeBtn = document.createElement("button");
        eyeBtn.type = "button";
        eyeBtn.className = "gc-top-bar-fw__cfg-exclusive";
        eyeBtn.setAttribute("data-gc-cfg-exclusive-toggle", String(cid));
        eyeBtn.setAttribute("aria-label", "Toggle exclusive view for this configuration");
        eyeBtn.setAttribute("aria-pressed", "false");
        eyeBtn.title =
          "Exclusive view: narrow data to this configuration (selections stay the same).";
        eyeBtn.innerHTML = ICON_EYE_EXCLUSIVE;
        rowWrap.appendChild(eyeBtn);
        let lab = document.createElement("label");
        lab.className =
          "gc-multiselect__option gc-hs-ip-host-flyout__fw-option gc-top-bar-fw__cfg-option";
        let cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "gc-net-fw-cb gc-net-fw-cb--cfg";
        cb.value = "c:" + String(cid);
        cb.setAttribute("data-gc-cfg-id", String(cid));
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
        rowWrap.appendChild(lab);
        optsRoot.appendChild(rowWrap);
      });
    }
    if (firewallInventory.length > 0) {
      if (tags.length > 0 || configurationInventory.length > 0) {
        let divFw = document.createElement("div");
        divFw.className = "gc-top-bar-fw__divider";
        divFw.setAttribute("role", "separator");
        optsRoot.appendChild(divFw);
      }
      if (tags.length > 0) {
        let secFw = document.createElement("div");
        secFw.className = "gc-top-bar-fw__section-label";
        secFw.textContent = "Firewalls";
        optsRoot.appendChild(secFw);
      }
      firewallInventory.forEach(function (it) {
        let id = it.id;
        let label = String(it.label != null ? it.label : "").trim() || String(id);
        let d = it.description != null ? String(it.description).trim() : "";
        let lab = document.createElement("label");
        lab.className = "gc-multiselect__option gc-hs-ip-host-flyout__fw-option gc-top-bar-fw__fw-option";
        let cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "gc-net-fw-cb gc-net-fw-cb--fw";
        cb.value = "f:" + String(id);
        cb.setAttribute("data-gc-fw-id", String(id));
        cb.setAttribute("data-gc-fw-label", label);
        if (d) cb.setAttribute("data-gc-fw-desc", d);
        cb.addEventListener("change", onMsCheckboxChange);
        let textWrap = document.createElement("span");
        textWrap.className = "gc-hs-ip-host-flyout__hg-opt-text";
        let nameEl = document.createElement("span");
        nameEl.className = "gc-hs-ip-host-flyout__hg-opt-name mono";
        nameEl.textContent = label;
        if (d) nameEl.title = d;
        textWrap.appendChild(nameEl);
        lab.appendChild(cb);
        lab.appendChild(textWrap);
        optsRoot.appendChild(lab);
      });
    }
    if (emptyEl) {
      let showEmpty =
        firewallInventory.length === 0 && configurationInventory.length === 0;
      emptyEl.hidden = !showEmpty;
      if (showEmpty) {
        emptyEl.textContent = "No firewalls or configurations.";
      }
    }
    syncExclusiveToggleButtonStates();
    syncTriggerText();
  }

  function restoreCheckboxesFromState(st) {
    let wantFw = {};
    (st.firewallIds || []).forEach(function (x) {
      let n = parseInt(String(x), 10);
      if (!isNaN(n)) wantFw[String(n)] = true;
    });
    let wantCfg = {};
    (st.configurationIds || []).forEach(function (x) {
      let n = parseInt(String(x), 10);
      if (!isNaN(n)) wantCfg[String(n)] = true;
    });
    let wantTag = {};
    (st.tags || []).forEach(function (t) {
      wantTag[tagKey(t)] = true;
    });
    ms.querySelectorAll(".gc-net-fw-cb--fw").forEach(function (cb) {
      let raw = String(cb.value || "");
      let idStr =
        raw.indexOf("f:") === 0 ? raw.slice(2) : raw;
      cb.checked = !!wantFw[idStr];
    });
    ms.querySelectorAll(".gc-net-fw-cb--cfg").forEach(function (cb) {
      let raw = String(cb.value || "");
      let idStr = raw.indexOf("c:") === 0 ? raw.slice(2) : raw;
      cb.checked = !!wantCfg[idStr];
    });
    ms.querySelectorAll(".gc-net-fw-tag-cb").forEach(function (cb) {
      cb.checked = !!wantTag[tagKey(cb.value)];
    });
  }

  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  function runFwFilter() {
    let q = norm(search ? search.value : "");
    ms.querySelectorAll(".gc-top-bar-fw__tag-option").forEach(function (lab) {
      let cb = lab.querySelector("[data-gc-fw-tag]");
      let tg = cb ? norm(cb.dataset.gcFwTag || "") : "";
      let match = !q || tg.indexOf(q) !== -1;
      lab.style.display = match ? "" : "none";
    });
    ms.querySelectorAll(".gc-top-bar-fw__fw-option").forEach(function (lab) {
      let cb = lab.querySelector("[data-gc-fw-id]");
      let nm = cb ? norm(cb.dataset.gcFwLabel || "") : "";
      let ds = cb ? norm(cb.dataset.gcFwDesc || "") : "";
      let idStr = cb ? norm(String(cb.dataset.gcFwId || "")) : "";
      let match =
        !q ||
        nm.indexOf(q) !== -1 ||
        idStr.indexOf(q) !== -1 ||
        (ds && ds.indexOf(q) !== -1);
      lab.style.display = match ? "" : "none";
    });
    ms.querySelectorAll(".gc-top-bar-fw__cfg-option-row").forEach(function (row) {
      let lab = row.querySelector(".gc-top-bar-fw__cfg-option");
      let cb = lab ? lab.querySelector("[data-gc-cfg-id]") : null;
      let nm = cb ? norm(cb.dataset.gcCfgLabel || "") : "";
      let idStr = cb ? norm(String(cb.dataset.gcCfgId || "")) : "";
      let match = !q || nm.indexOf(q) !== -1 || idStr.indexOf(q) !== -1;
      row.style.display = match ? "" : "none";
    });
  }

  function setOpen(open) {
    dropdown.hidden = !open;
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      renderSelectedScopePanel();
      scheduleInventoryRefresh();
    }
  }

  let refreshTimer = null;
  let slowRefreshTimer = null;

  function scheduleInventoryRefresh() {
    if (!cfg.navRefreshUrl && !cfg.navConfigurationsUrl) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function () {
      refreshTimer = null;
      doInventoryRefresh();
    }, 100);
  }

  function scheduleInventoryRefreshSlow() {
    if (!cfg.navRefreshUrl && !cfg.navConfigurationsUrl) return;
    if (slowRefreshTimer) clearTimeout(slowRefreshTimer);
    slowRefreshTimer = setTimeout(function () {
      slowRefreshTimer = null;
      doInventoryRefresh();
    }, 500);
  }

  function doInventoryRefresh() {
    if (!cfg || (!cfg.navRefreshUrl && !cfg.navConfigurationsUrl)) return;
    let pFw = cfg.navRefreshUrl
      ? fetch(cfg.navRefreshUrl, {
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "Ground-Control",
          },
        }).then(function (r) {
          return r.ok ? r.json() : Promise.reject();
        })
      : Promise.resolve(null);
    let pCfg = cfg.navConfigurationsUrl
      ? fetch(cfg.navConfigurationsUrl, {
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "Ground-Control",
          },
        }).then(function (r) {
          return r.ok ? r.json() : Promise.reject();
        })
      : Promise.resolve(null);
    Promise.all([pFw, pCfg])
      .then(function (pair) {
        applyNavInventories(pair[0], pair[1]);
      })
      .catch(function () {});
  }

  function sortedFirewallIdStr(ids) {
    return ids
      .slice()
      .sort(function (a, b) {
        return a - b;
      })
      .join(",");
  }

  function applyNavInventories(fwRaw, cfgRaw) {
    let st = {
      v: 3,
      firewallIds: readExplicitFwIdsFromDom(),
      configurationIds: readExplicitConfigurationIdsFromDom(),
      tags: readExplicitTagsFromDom(),
    };
    let rootNav = document.getElementById("gc-net-fw-multiselect");
    if (
      st.firewallIds.length === 0 &&
      st.configurationIds.length === 0 &&
      st.tags.length === 0 &&
      (!rootNav ||
        rootNav.querySelectorAll(".gc-net-fw-cb, .gc-net-fw-tag-cb").length === 0)
    ) {
      st = loadFilterState();
    }
    let beforeEff = sortedFirewallIdStr(
      computeEffectiveIds(firewallInventory, st.firewallIds, st.tags),
    );
    let beforeCfg = sortedFirewallIdStr(st.configurationIds || []);
    if (fwRaw != null) {
      let nextFw = normalizeInventoryRows(Array.isArray(fwRaw) ? fwRaw : []);
      /* Empty refresh must not wipe inventory: tag-based scope needs per-firewall tags to resolve. */
      if (nextFw.length === 0 && firewallInventory.length > 0) {
        /* keep firewallInventory + gcNavFirewallsJson */
      } else {
        firewallInventory = nextFw;
        try {
          globalThis.gcNavFirewallsJson = firewallInventory;
        } catch (e) {}
      }
    }
    if (cfgRaw != null) {
      let nextCfg = normalizeConfigurationInventoryRows(
        Array.isArray(cfgRaw) ? cfgRaw : [],
      );
      if (nextCfg.length === 0 && configurationInventory.length > 0) {
        /* keep configurationInventory */
      } else {
        configurationInventory = nextCfg;
        try {
          globalThis.gcNavConfigurationsJson = configurationInventory;
        } catch (e2) {}
      }
    }
    renderMsOptions();
    restoreCheckboxesFromState(st);
    syncTriggerText();
    renderSelectedScopePanel();
    persist();
    let afterEff = sortedFirewallIdStr(getSelectedFirewallIds());
    let afterCfg = sortedFirewallIdStr(getSelectedConfigurationIds());
    if (beforeEff !== afterEff || beforeCfg !== afterCfg) emitChange();
  }

  globalThis.gcApplyNavFirewallsJson = function (data) {
    applyNavInventories(data, null);
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
    search.addEventListener("input", runFwFilter);
    search.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  if (ms) {
    ms.addEventListener("click", function (e) {
      let t = e.target;
      if (!(t instanceof Element)) return;
      let eye = t.closest("[data-gc-cfg-exclusive-toggle]");
      if (eye) {
        e.preventDefault();
        e.stopPropagation();
        toggleExclusiveConfigurationId(eye.dataset.gcCfgExclusiveToggle);
      }
    });
  }

  if (selectedPanel) {
    selectedPanel.addEventListener("click", function (e) {
      let t = e.target;
      if (!(t instanceof Element)) return;
      let rmFw = t.closest("[data-gc-nav-fw-explicit-remove]");
      if (rmFw) {
        e.preventDefault();
        e.stopPropagation();
        removeExplicitFirewallFromSelection(rmFw.dataset.gcNavFwExplicitRemove);
        return;
      }
      let syncBtn = t.closest("[data-gc-nav-fw-sync]");
      if (syncBtn) {
        e.preventDefault();
        e.stopPropagation();
        runNavConfigSync(syncBtn);
        return;
      }
      let testBtn = t.closest("[data-gc-nav-fw-test]");
      if (testBtn) {
        e.preventDefault();
        e.stopPropagation();
        runNavFirewallTest(testBtn, selectedPanel);
      }
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

  document.addEventListener("gc-nav-firewalls-refresh-requested", function () {
    doInventoryRefresh();
  });

  let fws = globalThis.gcNavFirewallsJson;
  firewallInventory = normalizeInventoryRows(Array.isArray(fws) ? fws : []);
  try {
    globalThis.gcNavFirewallsJson = firewallInventory;
  } catch (e2) {}
  let cfgs0 = globalThis.gcNavConfigurationsJson;
  configurationInventory = normalizeConfigurationInventoryRows(
    Array.isArray(cfgs0) ? cfgs0 : [],
  );
  try {
    globalThis.gcNavConfigurationsJson = configurationInventory;
  } catch (e3) {}
  renderMsOptions();
  restoreCheckboxesFromState(loadFilterState());
  syncTriggerText();
  renderSelectedScopePanel();
  runFwFilter();

  setTimeout(function () {
    emitChange();
  }, 0);

  if (
    firewallInventory.length === 0 &&
    configurationInventory.length === 0 &&
    (cfg.navRefreshUrl || cfg.navConfigurationsUrl)
  ) {
    doInventoryRefresh();
  }
})();
