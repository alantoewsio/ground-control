/**
 * Page helper for the shared "Protect · Firewall" page (used by the
 * per-firewall and configuration-scope variants).
 *
 * Wires:
 *   - top tabs (Firewall rules / NAT rules) + sub-tabs (IPv4 / IPv6) with
 *     localStorage persistence
 *   - four `gcCreateNetworkEntityTable` instances (one per leaf), each with
 *     a client-side IPFamily filter
 *   - per-leaf Add / Bulk-add / Delete-selected buttons
 *   - row click → corresponding edit flyout (firewall_rule / nat_rule)
 *   - per-firewall reorder dock that follows the active leaf when
 *     `cfg.reorderEnabled` is true (firewall scope only)
 *
 * Public entry point: gcProtectFirewallPageInit(cfg). All cfg keys are
 * documented inline in the function below.
 */
(function () {
  "use strict";

  /** @typedef {{ entity:'firewall_rule'|'nat_rule', family:'ipv4'|'ipv6' }} LeafKey */

  const LEAVES = [
    { entity: "firewall_rule", family: "ipv4", top: "rules", sub: "ipv4" },
    { entity: "firewall_rule", family: "ipv6", top: "rules", sub: "ipv6" },
    { entity: "nat_rule", family: "ipv4", top: "nat", sub: "ipv4" },
    { entity: "nat_rule", family: "ipv6", top: "nat", sub: "ipv6" },
  ];

  function leafSlug(leaf) {
    return leaf.top + "-" + leaf.sub;
  }

  function ipFamilyValue(family) {
    return family === "ipv6" ? "IPv6" : "IPv4";
  }

  function bannerResult(ok, msg) {
    if (typeof window.gcGlobalBannerShowResult === "function") {
      window.gcGlobalBannerShowResult(ok, msg);
    } else if (typeof window.gcAlert === "function") {
      window.gcAlert(msg);
    } else {
      globalThis.alert(msg);
    }
  }

  function dispatchTaskQueueUpdated() {
    try {
      document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
    } catch (e) { /* no-op */ }
  }

  function postJson(url, payload) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "Ground-Control",
      },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    });
  }

  function arraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (Number(a[i]) !== Number(b[i])) return false;
    return true;
  }

  /**
   * Compute the *minimal* set of rules that the user actually moved between
   * ``baseline`` and ``current`` orderings, using the rules NOT in the
   * longest common subsequence (LCS).
   *
   * Naïve "any index that changed" marks every row between the source and
   * destination of a single drag as dirty (e.g. dragging rule #10 to the
   * top would highlight 10 rules); LCS-based diffing isolates just the rule
   * the user dragged.  See https://en.wikipedia.org/wiki/Longest_common_subsequence_problem.
   *
   * Returns rule IDs that are present in ``current`` but not in the LCS, so
   * highlights track only the dragged rule(s).  Inserted rules (present in
   * current but absent from baseline) are also reported as dirty.
   */
  function computeDirtyIds(baseline, current) {
    let base = (baseline || []).map(Number).filter(function (n) { return !!n; });
    let curr = (current || []).map(Number).filter(function (n) { return !!n; });
    if (!curr.length) return [];
    if (!base.length) return curr.slice();

    // Standard LCS DP table over IDs.
    let n = base.length;
    let m = curr.length;
    let dp = new Array(n + 1);
    for (let i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1);
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (base[i - 1] === curr[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = dp[i][j - 1] > dp[i - 1][j] ? dp[i][j - 1] : dp[i - 1][j];
      }
    }
    // Walk back to flag which IDs participate in the LCS.
    let inLcs = {};
    let i = n, j = m;
    while (i > 0 && j > 0) {
      if (base[i - 1] === curr[j - 1]) {
        inLcs[base[i - 1]] = true;
        i--; j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    let dirty = [];
    for (let k = 0; k < curr.length; k++) {
      if (!inLcs[curr[k]]) dirty.push(curr[k]);
    }
    return dirty;
  }

  // ── public entry point ─────────────────────────────────────────────────

  /**
   * @param {{
   *   prefix: string,
   *   target: 'firewall'|'configuration',
   *   urls: {
   *     firewallRulesTable: string,
   *     natRulesTable: string,
   *     enqueueFwRuleReorder?: string,
   *     enqueueNatRuleReorder?: string,
   *     enqueueDeletes?: string,
   *     applyDeletes?: string,
   *   },
   *   reorderEnabled: boolean,
   *   getSelectedFirewallIds: function(): number[],
   *   getSelectedConfigurationIds: function(): number[],
   *   onTablesCreated?: function(object): void,
   *   topLsKey?: string,
   *   subLsKeyPrefix?: string,
   *   syncFilterAsides?: function(string): void,
   * }} cfg
   */
  function gcProtectFirewallPageInit(cfg) {
    cfg = cfg || {};
    const prefix = String(cfg.prefix || "gc-fw");
    const target = cfg.target === "configuration" ? "configuration" : "firewall";
    const isCfg = target === "configuration";
    const urls = cfg.urls || {};
    const reorderEnabled = !!cfg.reorderEnabled;
    const topLsKey = cfg.topLsKey || ("ground-control-" + prefix + "-top-tab");
    const subLsPrefix = cfg.subLsKeyPrefix || ("ground-control-" + prefix + "-sub-tab-");

    function getSelectedFirewallIds() {
      let f = cfg.getSelectedFirewallIds;
      let arr = typeof f === "function" ? f() : [];
      return Array.isArray(arr) ? arr.slice() : [];
    }
    function getSelectedConfigurationIds() {
      let f = cfg.getSelectedConfigurationIds;
      let arr = typeof f === "function" ? f() : [];
      return Array.isArray(arr) ? arr.slice() : [];
    }

    // Activate the right entity-target hint for the flyouts.
    globalThis.gcProtectFirewallEntityTarget = target;

    // ── Tab state ────────────────────────────────────────────────────────
    let activeTop = "rules";
    let activeSub = { rules: "ipv4", nat: "ipv4" };

    function readSavedTopTab() {
      try {
        let raw = localStorage.getItem(topLsKey);
        if (raw === "rules" || raw === "nat") return raw;
      } catch (e) { /* ignore */ }
      return "rules";
    }

    function readSavedSubTab(top) {
      try {
        let raw = localStorage.getItem(subLsPrefix + top);
        if (raw === "ipv4" || raw === "ipv6") return raw;
      } catch (e) { /* ignore */ }
      return "ipv4";
    }

    activeTop = readSavedTopTab();
    activeSub.rules = readSavedSubTab("rules");
    activeSub.nat = readSavedSubTab("nat");

    function activeLeaf() {
      let sub = activeSub[activeTop] || "ipv4";
      let top = activeTop;
      return LEAVES.find(function (l) { return l.top === top && l.sub === sub; }) || LEAVES[0];
    }

    function applyTopTabUI() {
      let topList = document.getElementById(prefix + "-toptablist");
      if (topList) {
        Array.prototype.forEach.call(
          topList.querySelectorAll(".gc-tabs__tab"),
          function (btn) {
            let v = btn.getAttribute("data-gc-pf-top");
            let on = v === activeTop;
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-selected", on ? "true" : "false");
          }
        );
      }
      ["rules", "nat"].forEach(function (top) {
        let panel = document.getElementById(prefix + "-toppanel-" + top);
        if (panel) panel.hidden = top !== activeTop;
      });
    }

    function applySubTabUI(top) {
      let sub = activeSub[top] || "ipv4";
      let list = document.getElementById(prefix + "-" + top + "-subtablist");
      if (list) {
        Array.prototype.forEach.call(
          list.querySelectorAll(".gc-tabs__tab"),
          function (btn) {
            let v = btn.getAttribute("data-gc-pf-sub");
            let on = v === sub;
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-selected", on ? "true" : "false");
          }
        );
      }
      ["ipv4", "ipv6"].forEach(function (fam) {
        let panel = document.getElementById(prefix + "-" + top + "-panel-" + fam);
        if (panel) panel.hidden = fam !== sub;
      });
    }

    function defaultSyncFilterAsides(activeLeafSlugFull) {
      // The two page templates each render four ``<aside id="<prefix>-<top>-<sub>-filters-aside">``
      // elements (one per leaf); only the active leaf's aside should be visible.
      // Hiding the others avoids "ghost" filter chips bleeding across tabs.
      LEAVES.forEach(function (leaf) {
        const id = prefix + "-" + leaf.top + "-" + leaf.sub + "-filters-aside";
        const el = document.getElementById(id);
        if (!el) return;
        el.hidden = id !== activeLeafSlugFull;
      });
    }

    function syncFilterAsides() {
      const slug = prefix + "-" + activeLeaf().top + "-" + activeLeaf().sub;
      if (typeof cfg.syncFilterAsides === "function") {
        try { cfg.syncFilterAsides(slug); } catch (e) { /* ignore */ }
        return;
      }
      defaultSyncFilterAsides(slug);
    }

    function setActiveTop(next) {
      if (next !== "rules" && next !== "nat") return;
      activeTop = next;
      try { localStorage.setItem(topLsKey, next); } catch (e) { /* ignore */ }
      applyTopTabUI();
      syncFilterAsides();
      updateApplyDockChrome();
    }

    function setActiveSub(top, next) {
      if (next !== "ipv4" && next !== "ipv6") return;
      activeSub[top] = next;
      try { localStorage.setItem(subLsPrefix + top, next); } catch (e) { /* ignore */ }
      applySubTabUI(top);
      syncFilterAsides();
      updateApplyDockChrome();
    }

    // ── Table builders ───────────────────────────────────────────────────

    let tables = {};

    function tableUrlFor(leaf) {
      return leaf.entity === "nat_rule" ? urls.natRulesTable : urls.firewallRulesTable;
    }

    // When the page wires both entity types to a single generic
    // hosts-services endpoint (configuration scope), the underlying table
    // implementation needs `apiEntityType` to append ``entity_type=`` to
    // the query string so the back-end knows which payload to return.
    const useGenericHsEndpoint = !!cfg.useGenericHsEndpoint;

    function transformTablePayloadFor(family) {
      let want = ipFamilyValue(family);
      return function (data) {
        if (!data || !Array.isArray(data.rows)) return data;
        let rows = data.rows.filter(function (r) {
          if (!r) return false;
          // The cells.__ip_family column holds "IPv4"/"IPv6" — fall back to
          // r.flat.IPFamily when the column was suppressed.
          let raw =
            (r.cells && r.cells.__ip_family) ||
            (r.flat && r.flat.IPFamily) ||
            "";
          let s = String(raw).trim();
          if (!s) return want === "IPv4"; // unknowns belong to IPv4 by default
          return s.toLowerCase() === want.toLowerCase();
        });
        let out = {};
        Object.keys(data).forEach(function (k) { out[k] = data[k]; });
        out.rows = rows;
        return out;
      };
    }

    function makeOneTable(leaf) {
      let leafPrefix = prefix + "-" + leafSlug(leaf);
      let url = tableUrlFor(leaf);
      let lsKey = "ground-control-" + prefix + "-" + leafSlug(leaf) + "-cols-v1";
      let dataRowClass = leafPrefix + "-data-row";
      let opts = {
        prefix: leafPrefix,
        apiUrl: url,
        getSelectedIds: isCfg ? getSelectedConfigurationIds : getSelectedFirewallIds,
        idsQueryParam: isCfg ? "configuration_ids" : "firewall_ids",
        pageSyncFallbackEntities: [leaf.entity],
        rowPayloadOnly: true,
        apiEntityType: useGenericHsEndpoint ? leaf.entity : undefined,
        lsKey: lsKey,
        dataRowClass: dataRowClass,
        colPickerAttr: "data-" + leafPrefix + "-col",
        transformTablePayload: transformTablePayloadFor(leaf.family),
        labels: {
          countSingular: leaf.entity === "nat_rule" ? "NAT rule" : "rule",
          countPlural: leaf.entity === "nat_rule" ? "NAT rules" : "rules",
          emptyCache:
            "No " + (leaf.entity === "nat_rule" ? "NAT rules" : "firewall rules") +
            " in the cache for the selected " + (isCfg ? "configurations" : "firewalls") +
            ". Sync " + (leaf.entity === "nat_rule" ? "NAT rules" : "firewall rules") +
            " from Inventory.",
          emptyFilter: "No rows match the current search or filters.",
          loadError: "Could not load " +
            (leaf.entity === "nat_rule" ? "NAT rules" : "firewall rules") + ".",
        },
      };

      if (reorderEnabled) {
        opts.noBoolToggleColIds = ["__position"];
        opts.afterRenderFromApi = function (data) { afterLeafRender(leaf, data); };
      }

      // Click row → flyout
      opts.rowClickable = true;
      opts.skipListCellModalBind = true;
      opts.onRowClick = function (tr) {
        if (leaf.entity === "nat_rule") {
          if (globalThis.gcNatRuleFlyout && typeof globalThis.gcNatRuleFlyout.openEditFromTr === "function") {
            globalThis.gcNatRuleFlyout.openEditFromTr(tr);
          }
        } else {
          if (globalThis.gcFirewallRuleFlyout && typeof globalThis.gcFirewallRuleFlyout.openEditFromTr === "function") {
            globalThis.gcFirewallRuleFlyout.openEditFromTr(tr);
          }
        }
      };
      opts.rowAriaEntitySingular = leaf.entity === "nat_rule" ? "NAT rule" : "firewall rule";

      return gcCreateNetworkEntityTable(opts);
    }

    LEAVES.forEach(function (leaf) {
      tables[leafSlug(leaf)] = makeOneTable(leaf);
    });

    function refreshAllTables() {
      LEAVES.forEach(function (leaf) {
        let t = tables[leafSlug(leaf)];
        if (t && typeof t.refresh === "function") t.refresh();
      });
    }

    // ── Add / Bulk-add / Delete buttons per leaf ─────────────────────────

    function bindLeafButtons(leaf) {
      let leafPrefix = prefix + "-" + leafSlug(leaf);
      let addBtn = document.getElementById(leafPrefix + "-add");
      if (addBtn) {
        addBtn.addEventListener("click", function () {
          let presets = { IPFamily: ipFamilyValue(leaf.family) };
          if (leaf.entity === "nat_rule") {
            if (globalThis.gcNatRuleFlyout && typeof globalThis.gcNatRuleFlyout.openAdd === "function") {
              globalThis.gcNatRuleFlyout.openAdd(presets);
            }
          } else {
            if (globalThis.gcFirewallRuleFlyout && typeof globalThis.gcFirewallRuleFlyout.openAdd === "function") {
              globalThis.gcFirewallRuleFlyout.openAdd(presets);
            }
          }
        });
      }

      let bulkBtn = document.getElementById(leafPrefix + "-bulk-add");
      if (bulkBtn) {
        bulkBtn.addEventListener("click", function () {
          if (typeof globalThis.gcHsBulkAddOpen !== "function") {
            bannerResult(false, "Bulk-add module not loaded.");
            return;
          }
          let key = leaf.entity + "_" + leaf.family;
          globalThis.gcHsBulkAddOpen(key);
        });
      }

      let delBtn = document.getElementById(leafPrefix + "-delete-selected");
      if (delBtn) {
        delBtn.addEventListener("click", function () {
          let table = tables[leafSlug(leaf)];
          if (!table || typeof table.getDeleteConfigEntryIdsFromSelection !== "function") return;
          let ids = table.getDeleteConfigEntryIdsFromSelection();
          if (!ids.length) {
            bannerResult(false, "Select one or more rows to delete.");
            return;
          }
          let url = isCfg ? urls.applyDeletes : urls.enqueueDeletes;
          if (!url) {
            bannerResult(false, "Delete URL is not configured.");
            return;
          }
          let label = leaf.entity === "nat_rule" ? "NAT rule" : "firewall rule";
          let labelP = leaf.entity === "nat_rule" ? "NAT rules" : "firewall rules";
          let msg = isCfg
            ? "Apply deletion of " + ids.length + " " + (ids.length === 1 ? label : labelP) +
              " to the selected configurations? This will modify the cached configuration."
            : "Queue " + ids.length + " " + (ids.length === 1 ? label : labelP) +
              " delete task" + (ids.length === 1 ? "" : "s") + " for the selected firewalls?";
          let cf = window.gcConfirm ? window.gcConfirm(msg) : Promise.resolve(globalThis.confirm(msg));
          cf.then(function (ok) {
            if (!ok) return;
            delBtn.disabled = true;
            postJson(url, { config_entry_ids: ids }).then(function (x) {
              delBtn.disabled = false;
              if (!x.ok) {
                let err = (x.j && (x.j.detail || x.j.message)) || "Delete failed.";
                bannerResult(false, typeof err === "string" ? err : JSON.stringify(err));
                return;
              }
              bannerResult(true,
                isCfg
                  ? "Removed " + ids.length + " " + (ids.length === 1 ? label : labelP) + " from configuration cache."
                  : "Queued delete tasks for " + ids.length + " " + (ids.length === 1 ? label : labelP) + ".");
              if (isCfg) {
                document.dispatchEvent(new CustomEvent("gc-configuration-entries-updated"));
              } else {
                dispatchTaskQueueUpdated();
              }
              refreshAllTables();
            }).catch(function () {
              delBtn.disabled = false;
              bannerResult(false, "Network error during delete.");
            });
          });
        });
      }
    }

    LEAVES.forEach(bindLeafButtons);

    // ── Tab click handlers ───────────────────────────────────────────────

    let topList = document.getElementById(prefix + "-toptablist");
    if (topList) {
      Array.prototype.forEach.call(
        topList.querySelectorAll(".gc-tabs__tab"),
        function (btn) {
          btn.addEventListener("click", function () {
            let v = btn.getAttribute("data-gc-pf-top");
            if (v) setActiveTop(v);
          });
        }
      );
    }
    ["rules", "nat"].forEach(function (top) {
      let list = document.getElementById(prefix + "-" + top + "-subtablist");
      if (!list) return;
      Array.prototype.forEach.call(
        list.querySelectorAll(".gc-tabs__tab"),
        function (btn) {
          btn.addEventListener("click", function () {
            let v = btn.getAttribute("data-gc-pf-sub");
            if (v) setActiveSub(top, v);
          });
        }
      );
    });

    // ── Reorder dock (firewall scope only) ──────────────────────────────

    let dockEl = reorderEnabled ? document.getElementById(prefix + "-apply-dock") : null;
    let dockStatus = reorderEnabled ? document.getElementById(prefix + "-apply-status") : null;
    let dockApply = reorderEnabled ? document.getElementById(prefix + "-apply-btn") : null;
    let dockCancel = reorderEnabled ? document.getElementById(prefix + "-cancel-btn") : null;
    let reorderBusy = false;
    let dragActive = false;
    let dragFromIndex = -1;

    // state[entity][family][fwId] = { baseline, pending, dirty, awaiting }
    let state = {
      firewall_rule: { ipv4: {}, ipv6: {} },
      nat_rule: { ipv4: {}, ipv6: {} },
    };

    function selectedSingleFirewallId() {
      let ids = getSelectedFirewallIds();
      if (ids && ids.length === 1) return Number(ids[0]) || 0;
      // Fall back to "all registered firewalls" only when truly ambiguous;
      // the reorder dock requires exactly one firewall.
      return 0;
    }

    function leafState(leaf, fwId, init) {
      let bucket = state[leaf.entity][leaf.family];
      if (!bucket[fwId] && init) bucket[fwId] = { baseline: [], pending: null, dirty: [], awaiting: null };
      return bucket[fwId] || null;
    }

    function getDomRowsForLeaf(leaf) {
      let leafPrefix = prefix + "-" + leafSlug(leaf);
      return Array.prototype.slice.call(
        document.querySelectorAll("#" + leafPrefix + "-tbody tr." + leafPrefix + "-data-row")
      );
    }

    function getDomOrderIds(leaf) {
      return getDomRowsForLeaf(leaf).map(function (tr) {
        let row = tr._gcNetRow;
        let n = row && row.config_entry_id != null ? parseInt(String(row.config_entry_id), 10) : 0;
        return isNaN(n) ? 0 : n;
      }).filter(function (n) { return n > 0; });
    }

    function reorderDomToIds(leaf, orderIds) {
      let leafPrefix = prefix + "-" + leafSlug(leaf);
      let tbody = document.getElementById(leafPrefix + "-tbody");
      if (!tbody || !Array.isArray(orderIds) || !orderIds.length) return;
      let rowById = {};
      getDomRowsForLeaf(leaf).forEach(function (tr) {
        let row = tr._gcNetRow;
        let n = row && row.config_entry_id != null ? parseInt(String(row.config_entry_id), 10) : 0;
        if (!isNaN(n) && n > 0) rowById[n] = tr;
      });
      orderIds.forEach(function (rid) {
        let tr = rowById[Number(rid)];
        if (tr) tbody.appendChild(tr);
      });
    }

    function refreshDisplayedPositions(leaf) {
      getDomRowsForLeaf(leaf).forEach(function (tr, idx) {
        let td = tr.querySelector('td[data-gc-col="__position"]');
        if (!td) return;
        let label = td.querySelector(".gc-fw-rule-pos-label");
        if (label) label.textContent = String(idx + 1);
      });
    }

    function applyHighlight(leaf, fwId) {
      let st = leafState(leaf, fwId, false);
      let dirty = {};
      if (st && Array.isArray(st.dirty)) st.dirty.forEach(function (id) { dirty[Number(id)] = true; });
      if (st && st.awaiting && Array.isArray(st.awaiting.dirty_ids)) {
        st.awaiting.dirty_ids.forEach(function (id) { dirty[Number(id)] = true; });
      }
      getDomRowsForLeaf(leaf).forEach(function (tr) {
        let row = tr._gcNetRow;
        let n = row && row.config_entry_id != null ? parseInt(String(row.config_entry_id), 10) : 0;
        tr.classList.toggle("gc-fw-rule-row--pending", !!dirty[n]);
      });
    }

    function reorderUrlFor(leaf) {
      return leaf.entity === "nat_rule" ? urls.enqueueNatRuleReorder : urls.enqueueFwRuleReorder;
    }

    function updateApplyDockChrome() {
      if (!dockEl || !dockApply || !dockCancel || !dockStatus) return;
      let leaf = activeLeaf();
      let fwId = selectedSingleFirewallId();
      if (!fwId) {
        dockEl.hidden = true;
        dockApply.disabled = true;
        dockCancel.disabled = true;
        return;
      }
      if (!reorderUrlFor(leaf)) {
        // No reorder endpoint for this entity — hide the dock for that leaf.
        dockEl.hidden = true;
        dockApply.disabled = true;
        dockCancel.disabled = true;
        return;
      }
      let st = leafState(leaf, fwId, false);

      // Show the dock only when there's something to act on — either a queued
      // sync we're waiting on, or pending in-flight drags.  In its idle state
      // the dock is purely noise and the drag handles in the position column
      // already advertise that rules can be reordered.
      if (st && st.awaiting) {
        dockEl.hidden = false;
        dockApply.disabled = true;
        dockCancel.disabled = true;
        dockStatus.textContent = "Queued. Highlights clear after task send and rule cache sync.";
        return;
      }
      let dirtyCount = (st && Array.isArray(st.dirty)) ? st.dirty.length : 0;
      if (!st || !st.pending || dirtyCount < 1) {
        dockEl.hidden = true;
        dockApply.disabled = true;
        dockCancel.disabled = true;
        return;
      }
      dockEl.hidden = false;
      dockApply.disabled = reorderBusy;
      dockCancel.disabled = reorderBusy;
      dockStatus.textContent =
        dirtyCount === 1
          ? "1 rule moved. Click Apply to queue the reorder."
          : dirtyCount + " rules moved. Click Apply to queue the reorder.";
    }

    function setPendingFromDom(leaf) {
      let fwId = selectedSingleFirewallId();
      if (!fwId) return;
      let st = leafState(leaf, fwId, true);
      let current = getDomOrderIds(leaf);
      let baseline = st.baseline && st.baseline.length ? st.baseline : current.slice();
      st.pending = current.slice();
      st.dirty = computeDirtyIds(baseline, current);
      if (!st.dirty.length) st.pending = null;
      applyHighlight(leaf, fwId);
      updateApplyDockChrome();
    }

    function bindDragRows(leaf) {
      let leafPrefix = prefix + "-" + leafSlug(leaf);
      let tbody = document.getElementById(leafPrefix + "-tbody");
      if (!tbody) return;
      let fwId = selectedSingleFirewallId();
      let rows = getDomRowsForLeaf(leaf);

      rows.forEach(function (tr) {
        let td = tr.querySelector('td[data-gc-col="__position"]');
        if (!td) return;
        let old = td.querySelector(".gc-fw-rule-pos-wrap");
        if (old) old.remove();
        let n = (td.textContent || "").trim();
        td.textContent = "";
        if (!fwId) {
          td.textContent = n;
          tr.removeAttribute("draggable");
          return;
        }
        let wrap = document.createElement("span");
        wrap.className = "gc-fw-rule-pos-wrap";
        let handle = document.createElement("span");
        handle.className = "gc-fw-rule-grab-handle";
        handle.textContent = "⋮⋮";
        handle.setAttribute("draggable", "true");
        handle.setAttribute("title", "Drag to reorder");
        handle.setAttribute("aria-label", "Drag to reorder rule");
        let num = document.createElement("span");
        num.className = "gc-fw-rule-pos-label";
        num.textContent = n;
        wrap.appendChild(handle);
        wrap.appendChild(num);
        td.appendChild(wrap);

        handle.addEventListener("dragstart", function (e) {
          dragActive = true;
          dragFromIndex = rows.indexOf(tr);
          tr.classList.add("gc-fw-rule-row--dragging");
          try {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(dragFromIndex));
          } catch (e1) { /* ignore */ }
        });
        handle.addEventListener("dragend", function () {
          dragActive = false;
          dragFromIndex = -1;
          tr.classList.remove("gc-fw-rule-row--dragging");
          rows.forEach(function (r) { r.classList.remove("gc-fw-rule-row--dragging"); });
        });
        tr.addEventListener("dragover", function (e) {
          if (!dragActive) return;
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        });
        tr.addEventListener("drop", function (e) {
          if (!dragActive) return;
          e.preventDefault();
          e.stopPropagation();
          let from = dragFromIndex;
          let to = rows.indexOf(tr);
          if (from < 0 || to < 0 || from === to) return;
          let moving = rows[from];
          if (!moving) return;
          if (to > from) tbody.insertBefore(moving, rows[to].nextSibling);
          else tbody.insertBefore(moving, rows[to]);
          rows = getDomRowsForLeaf(leaf);
          refreshDisplayedPositions(leaf);
          setPendingFromDom(leaf);
        });
      });
    }

    function afterLeafRender(leaf, data) {
      if (!reorderEnabled) return;
      let fwId = selectedSingleFirewallId();
      if (fwId) {
        let idsFromApi = Array.isArray(data && data.rows)
          ? data.rows.map(function (r) {
              let n = r && r.config_entry_id != null ? parseInt(String(r.config_entry_id), 10) : 0;
              return isNaN(n) ? 0 : n;
            }).filter(function (n) { return n > 0; })
          : [];
        let st = leafState(leaf, fwId, true);
        if (st.awaiting && Array.isArray(st.awaiting.order_ids) &&
            arraysEqual(st.awaiting.order_ids, idsFromApi)) {
          st.awaiting = null;
          st.dirty = [];
          st.pending = null;
          st.baseline = idsFromApi.slice();
          bannerResult(true, "Rule reorder is now synced. Highlights cleared.");
        }
        if (!st.baseline || !st.baseline.length) st.baseline = idsFromApi.slice();
        if (st.pending && st.pending.length) reorderDomToIds(leaf, st.pending);
        refreshDisplayedPositions(leaf);
        applyHighlight(leaf, fwId);
      }
      bindDragRows(leaf);
      updateApplyDockChrome();
    }

    function applyPendingReorder() {
      let leaf = activeLeaf();
      let fwId = selectedSingleFirewallId();
      if (!fwId) return;
      let url = reorderUrlFor(leaf);
      if (!url) {
        bannerResult(false, "Reorder URL not configured for this rule type.");
        return;
      }
      let st = leafState(leaf, fwId, false);
      if (!st || !Array.isArray(st.pending) || !st.pending.length) return;
      if (reorderBusy) return;
      reorderBusy = true;
      updateApplyDockChrome();
      let orderIds = st.pending.slice();
      let dirtyIds = (st.dirty || []).slice();
      // Sophos persists After.Name as a per-rule field — so a single drag
      // typically requires multiple Update tasks (the moved rule + every
      // rule whose stored After.Name now differs from its on-device value).
      // The backend computes that diff itself against the cached
      // @gc_sync_index; we intentionally do NOT send dirty_config_entry_ids
      // because narrowing by the user's "I only moved one rule" hint would
      // leave un-flagged rules with stale After.Name pointers and the move
      // would silently revert on the next sync.
      postJson(url, {
        firewall_id: fwId,
        ordered_config_entry_ids: orderIds,
      }).then(function (x) {
        reorderBusy = false;
        if (!x.ok) {
          let err = (x.j && (x.j.detail || x.j.message)) || "Failed to queue rule reorder tasks.";
          bannerResult(false, typeof err === "string" ? err : JSON.stringify(err));
          updateApplyDockChrome();
          return;
        }
        let n = x.j && x.j.count != null ? parseInt(String(x.j.count), 10) : 0;
        let st2 = leafState(leaf, fwId, true);
        st2.awaiting = { order_ids: orderIds, dirty_ids: dirtyIds };
        st2.pending = null;
        if (n > 0) {
          let label = leaf.entity === "nat_rule" ? "NAT rule" : "firewall rule";
          bannerResult(true,
            n === 1
              ? "Queued 1 " + label + " reorder task. Highlight clears after sync."
              : "Queued " + n + " " + label + " reorder tasks. Highlight clears after sync.");
          dispatchTaskQueueUpdated();
        } else {
          bannerResult(true, "Nothing queued — rule order already matches cache.");
        }
        updateApplyDockChrome();
      }).catch(function () {
        reorderBusy = false;
        bannerResult(false, "Network error while queueing rule reorder tasks.");
        updateApplyDockChrome();
      });
    }

    function cancelPendingReorder() {
      let leaf = activeLeaf();
      let fwId = selectedSingleFirewallId();
      if (!fwId) return;
      let st = leafState(leaf, fwId, false);
      if (!st) return;
      if (Array.isArray(st.baseline) && st.baseline.length) {
        reorderDomToIds(leaf, st.baseline);
      } else {
        let t = tables[leafSlug(leaf)];
        if (t && typeof t.refresh === "function") t.refresh();
        return;
      }
      st.pending = null;
      st.dirty = [];
      refreshDisplayedPositions(leaf);
      applyHighlight(leaf, fwId);
      updateApplyDockChrome();
      bannerResult(true, "Reorder changes were cancelled and reset to cached order.");
    }

    if (dockApply) dockApply.addEventListener("click", applyPendingReorder);
    if (dockCancel) dockCancel.addEventListener("click", cancelPendingReorder);

    // ── Cache-refresh wiring ─────────────────────────────────────────────

    document.addEventListener("gc-firewall-selection-changed", refreshAllTables);
    document.addEventListener("gc-configuration-selection-changed", refreshAllTables);
    document.addEventListener("gc-configuration-exclusive-view-changed", refreshAllTables);
    document.addEventListener("gc-configuration-entries-updated", refreshAllTables);
    document.addEventListener("gc-firewall-rule-saved", refreshAllTables);
    document.addEventListener("gc-nat-rule-saved", refreshAllTables);

    function selectionHits(ids) {
      if (!ids || !ids.length) return false;
      let sel = isCfg ? getSelectedConfigurationIds() : getSelectedFirewallIds();
      if (!sel || !sel.length) return false;
      let set = {};
      sel.forEach(function (id) { set[Number(id)] = true; });
      return ids.some(function (id) { return set[id]; });
    }

    if (typeof window.gcRegisterConfigCacheTableRefresher === "function") {
      window.gcRegisterConfigCacheTableRefresher(function (ids) {
        if (!selectionHits(ids)) return;
        refreshAllTables();
      });
    }

    // ── Initial paint ────────────────────────────────────────────────────

    applyTopTabUI();
    applySubTabUI("rules");
    applySubTabUI("nat");
    syncFilterAsides();
    updateApplyDockChrome();

    if (typeof cfg.onTablesCreated === "function") {
      try { cfg.onTablesCreated(tables); } catch (e) { /* ignore */ }
    }

    // Kick off first refresh.
    refreshAllTables();

    return {
      refreshAllTables: refreshAllTables,
      tables: tables,
      getActiveLeaf: activeLeaf,
    };
  }

  globalThis.gcProtectFirewallPageInit = gcProtectFirewallPageInit;
})();
