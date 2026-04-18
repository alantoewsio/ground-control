(function () {
  "use strict";

  let rootCfg = globalThis.GC_FIREWALLS_HISTORY;
  if (!rootCfg || !rootCfg.tables || !rootCfg.tables.length) return;

  let historyTableRefreshRowUi = [];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initHistoryTable(cfg) {
    let table = document.getElementById(cfg.tableId);
    if (!table) return;

    let COLS = cfg.cols;
    let lsKey = cfg.lsKeyCols;
    let facetKey = cfg.facetStorageKey;
    let colInputSel = "input[" + cfg.colCheckboxAttr + "]";

    let filtersDrawer = document.getElementById(cfg.prefix + "-filters-drawer");
    let filtersAside = document.getElementById(cfg.prefix + "-filters-aside");
    let searchIn = document.getElementById(cfg.prefix + "-search");
    let filterEmpty = document.getElementById(cfg.filterEmptyRowId);
    let countEl = document.getElementById(cfg.countElId);
    let tbody = table.querySelector("tbody");
    let tableScroll = table.closest(".table-scroll");
    let isOutgoingHistory = cfg.prefix === "gc-hist-out";
    let outgoingListUrl = isOutgoingHistory ? (rootCfg.outgoingListUrl || "") : "";
    let outgoingPageSize = Math.max(
      1,
      parseInt(rootCfg.outgoingPageSize || 200, 10) || 200
    );
    let outgoingHasMore = isOutgoingHistory
      ? !!rootCfg.outgoingHasMore
      : false;
    let outgoingNextOffset = isOutgoingHistory
      ? parseInt(
          rootCfg.outgoingInitialCount || tbody.querySelectorAll("tr." + cfg.rowClass).length,
          10
        ) || 0
      : 0;
    let outgoingLoading = false;
    let outgoingScrollTicking = false;

    let facetCols = COLS.map(function (c) {
      let lab = c.label;
      if (typeof globalThis.gcTableColumnDisplayLabel === "function") {
        lab = globalThis.gcTableColumnDisplayLabel(lab);
      }
      return { id: c.id, label: lab };
    });

    function loadColVis() {
      let d = {};
      COLS.forEach(function (c) {
        d[c.id] = c.defaultHidden ? false : true;
      });
      try {
        let raw = localStorage.getItem(lsKey);
        if (raw) {
          let o = JSON.parse(raw);
          if (o && typeof o === "object") {
            COLS.forEach(function (c) {
              if (Object.prototype.hasOwnProperty.call(o, c.id)) d[c.id] = !!o[c.id];
            });
          }
        }
      } catch (e) {}
      let visible = 0;
      COLS.forEach(function (c) {
        if (d[c.id]) visible++;
      });
      if (visible < 1 && COLS.length) d[COLS[0].id] = true;
      return d;
    }

    let colVis = loadColVis();

    function persistColVis(vis) {
      try {
        localStorage.setItem(lsKey, JSON.stringify(vis));
      } catch (e) {}
    }

    function applyColVis(vis) {
      COLS.forEach(function (c) {
        let on = !!vis[c.id];
        table.querySelectorAll('[data-gc-col="' + c.id + '"]').forEach(function (el) {
          el.classList.toggle("gc-col-hidden", !on);
        });
      });
    }

    function syncFilterEmptyColspan() {
      let n = table.querySelectorAll("thead th").length;
      if (filterEmpty) {
        let td = filterEmpty.querySelector("td");
        if (td) td.setAttribute("colspan", String(n));
      }
      let ph = tbody && tbody.querySelector("." + cfg.placeholderRowClass);
      if (ph) {
        let ptd = ph.querySelector("td");
        if (ptd) ptd.setAttribute("colspan", String(n));
      }
    }

    applyColVis(colVis);
    syncFilterEmptyColspan();

    function rowFacetMapFromTr(tr) {
      let m = {};
      tr.querySelectorAll("td[data-gc-col]").forEach(function (td) {
        let k = td.dataset.gcCol;
        if (!k) return;
        m[k] = (td.textContent || "").trim().replace(/\s+/g, " ");
      });
      return m;
    }

    function rebuildFacets(done) {
      if (!filtersDrawer || !globalThis.gcTableFacets) {
        if (typeof done === "function") done();
        return;
      }
      let rowEls = Array.prototype.slice.call(tbody.querySelectorAll("tr." + cfg.rowClass));
      let maps = rowEls.map(function (tr) {
        return rowFacetMapFromTr(tr);
      });
      function rebuildHistoryDrawer() {
        globalThis.gcTableFacets.rebuild(filtersDrawer, facetCols, maps, facetKey);
        if (typeof done === "function") done();
      }
      let lazy = globalThis.gcTableLazy;
      if (!lazy || typeof lazy.forEachChunked !== "function" || rowEls.length <= lazy.DEFAULT_THRESHOLD) {
        rowEls.forEach(function (tr, i) {
          globalThis.gcTableFacets.setRowFacets(tr, maps[i]);
        });
        rebuildHistoryDrawer();
        return;
      }
      lazy.forEachChunked(
        rowEls,
        lazy.DEFAULT_CHUNK,
        function (tr, i) {
          globalThis.gcTableFacets.setRowFacets(tr, maps[i]);
        },
        rebuildHistoryDrawer,
      );
    }

    function facetAppliedCount() {
      if (!filtersDrawer || !globalThis.gcTableFacets) return 0;
      return globalThis.gcTableFacets.appliedCount(filtersDrawer);
    }

    function updateFacetChrome() {
      let n = facetAppliedCount();
      let head = document.getElementById(cfg.prefix + "-facet-head-actions");
      let countElFacet = document.getElementById(cfg.prefix + "-facet-count");
      let resetBtn = document.getElementById(cfg.prefix + "-facet-reset");
      if (!head || !countElFacet || !resetBtn) return;
      if (n > 0) {
        head.hidden = false;
        countElFacet.innerHTML = '<span class="filters__facet-count-num">' + n + "</span> applied";
        resetBtn.hidden = false;
      } else {
        head.hidden = true;
        countElFacet.textContent = "";
        resetBtn.hidden = true;
      }
    }

    function setFiltersAsideCollapsed(collapsed) {
      if (!filtersAside || !filtersDrawer) return;
      let btn = document.getElementById(cfg.prefix + "-filters-toggle");
      filtersAside.classList.toggle("filters--collapsed", collapsed);
      if (btn) btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      if (collapsed) filtersDrawer.setAttribute("hidden", "");
      else filtersDrawer.removeAttribute("hidden");
    }

    function globalFwRowOk(tr) {
      if (
        typeof globalThis.gcSkipGlobalFirewallTableFilter === "function" &&
        globalThis.gcSkipGlobalFirewallTableFilter()
      ) {
        return true;
      }
      if (typeof globalThis.gcGetSelectedFirewallIds !== "function") return true;
      let ids = globalThis.gcGetSelectedFirewallIds();
      if (ids.length === 0) return true;
      let fid = tr.dataset.firewallId;
      if (fid == null || fid === "") return true;
      let n = parseInt(fid, 10);
      if (isNaN(n) || n <= 0) return true;
      return ids.indexOf(n) !== -1;
    }

    function applyRowFilter() {
      let q = (searchIn && searchIn.value ? searchIn.value : "").trim().toLowerCase();
      let rows = tbody.querySelectorAll("tr." + cfg.rowClass);
      let visible = 0;
      let total = rows.length;
      rows.forEach(function (tr) {
        let s = tr.dataset.search || "";
        let facetOk =
          !filtersDrawer ||
          !globalThis.gcTableFacets ||
          globalThis.gcTableFacets.rowMatches(tr, filtersDrawer);
        let ok = (!q || s.indexOf(q) !== -1) && facetOk && globalFwRowOk(tr);
        tr.hidden = !ok;
        if (ok) visible++;
      });
      if (filterEmpty) filterEmpty.hidden = !(total > 0 && visible === 0);
      let ph = tbody.querySelector("." + cfg.placeholderRowClass);
      if (ph) ph.hidden = total > 0;
      if (countEl) {
        if (total === 0) countEl.textContent = "";
        else if (visible === total) {
          countEl.textContent = visible === 1 ? "1 row" : visible + " rows";
        } else {
          countEl.textContent = "Showing " + visible + " of " + total + " rows";
        }
      }
    }

    function historyOutcomeLabel(outcome) {
      return outcome === "removed_from_queue" ? "Rejected" : "Approved";
    }

    function historyOutcomeBadgeHtml(outcome, outcomeLabel) {
      if (outcome === "removed_from_queue") {
        return (
          '<span class="gc-hist-out-status gc-hist-out-status--removed" data-gc-hist-out-status="removed">' +
          escapeHtml(outcomeLabel || historyOutcomeLabel(outcome)) +
          "</span>"
        );
      }
      return (
        '<span class="gc-hist-out-status gc-hist-out-status--sent" data-gc-hist-out-status="sent">' +
        escapeHtml(outcomeLabel || historyOutcomeLabel(outcome)) +
        "</span>"
      );
    }

    function historyFirewallCellHtml(row) {
      let label = row && row.firewall_label != null ? String(row.firewall_label) : "—";
      if (row && row.firewall_id != null && row.firewall_id !== "") {
        let online = !!row.firewall_online;
        return (
          '<span class="gc-zone-pill gc-firewall-pill">' +
          '<span class="gc-icon gc-icon--xs gc-firewall-pill-status gc-firewall-pill-status--' +
          (online ? "online" : "offline") +
          '" role="img" aria-label="Firewall ' +
          (online ? "online" : "offline") +
          '">' +
          (online ? "check_circle" : "cancel") +
          "</span>" +
          '<span class="mono">' +
          escapeHtml(label) +
          "</span></span>"
        );
      }
      return '<span class="muted">' + escapeHtml(label) + "</span>";
    }

    function historyOutgoingRowHtml(row) {
      let rid = row && row.id != null ? String(row.id) : "";
      let sourceTask = row && row.source_task_id != null ? String(row.source_task_id) : "—";
      let sourceSort = row && row.source_task_id != null ? String(row.source_task_id) : "0";
      let firewallId =
        row && row.firewall_id != null && row.firewall_id !== "" ? String(row.firewall_id) : "";
      let outcome = row && row.outcome ? String(row.outcome) : "sent";
      let searchBlob = row && row.search_blob != null ? String(row.search_blob) : "";
      let entityType = row && row.entity_type != null ? String(row.entity_type) : "";
      let externalName = row && row.external_name != null ? String(row.external_name) : "";
      let queuedBy = row && row.created_by_username != null ? String(row.created_by_username) : "—";
      let completedBy =
        row && row.completed_by_username != null ? String(row.completed_by_username) : "—";
      let createdAt = row && row.created_at != null ? String(row.created_at) : "";
      let completedAt = row && row.completed_at != null ? String(row.completed_at) : "";
      let statusLabel = historyOutcomeLabel(outcome);
      let firewallHtml = historyFirewallCellHtml(row || {});
      return (
        '<tr class="gc-hist-out-row" data-firewall-id="' +
        escapeHtml(firewallId) +
        '" data-completed-id="' +
        escapeHtml(rid) +
        '" data-outcome="' +
        escapeHtml(outcome) +
        '" data-search="' +
        escapeHtml(searchBlob) +
        '" title="Click to view proposed change vs local cache">' +
        '<td class="mono" data-gc-col="id" data-sort-value="' +
        escapeHtml(rid) +
        '">' +
        escapeHtml(rid) +
        '</td><td class="mono muted gc-col-hidden" data-gc-col="source_task_id" data-sort-value="' +
        escapeHtml(sourceSort) +
        '">' +
        escapeHtml(sourceTask) +
        '</td><td data-gc-col="firewall_label" class="gc-net-firewall-pills">' +
        firewallHtml +
        "</td><td data-gc-col=\"entity_type\">" +
        escapeHtml(entityType) +
        '</td><td class="mono" data-gc-col="external_name">' +
        escapeHtml(externalName) +
        "</td><td data-gc-col=\"outcome_label\">" +
        historyOutcomeBadgeHtml(outcome, statusLabel) +
        "</td><td data-gc-col=\"created_by_username\">" +
        escapeHtml(queuedBy) +
        "</td><td data-gc-col=\"completed_by_username\">" +
        escapeHtml(completedBy) +
        '</td><td class="mono muted" data-gc-col="created_at" data-sort-value="' +
        escapeHtml(createdAt) +
        '">' +
        escapeHtml(createdAt) +
        '</td><td class="mono muted" data-gc-col="completed_at" data-sort-value="' +
        escapeHtml(completedAt) +
        '">' +
        escapeHtml(completedAt) +
        "</td></tr>"
      );
    }

    function appendOutgoingRows(rows) {
      if (!rows || !rows.length || !tbody) return;
      let html = rows.map(historyOutgoingRowHtml).join("");
      let wrap = document.createElement("tbody");
      wrap.innerHTML = html;
      let nodes = Array.prototype.slice.call(wrap.children);
      nodes.forEach(function (tr) {
        if (filterEmpty && filterEmpty.parentElement === tbody) {
          tbody.insertBefore(tr, filterEmpty);
        } else {
          tbody.appendChild(tr);
        }
      });
      let ph = tbody.querySelector("." + cfg.placeholderRowClass);
      if (ph) ph.remove();
      applyColVis(colVis);
      syncFilterEmptyColspan();
    }

    function maybeLoadOutgoingUntilScrollable() {
      if (
        !isOutgoingHistory ||
        !outgoingListUrl ||
        !tableScroll ||
        !outgoingHasMore ||
        outgoingLoading
      ) {
        return;
      }
      if (tableScroll.scrollHeight <= tableScroll.clientHeight + 24) {
        loadMoreOutgoingRows();
      }
    }

    function loadMoreOutgoingRows() {
      if (
        !isOutgoingHistory ||
        !outgoingListUrl ||
        !tableScroll ||
        !outgoingHasMore ||
        outgoingLoading
      ) {
        return;
      }
      outgoingLoading = true;
      let sep = outgoingListUrl.indexOf("?") === -1 ? "?" : "&";
      let url =
        outgoingListUrl +
        sep +
        "offset=" +
        encodeURIComponent(String(outgoingNextOffset)) +
        "&limit=" +
        encodeURIComponent(String(outgoingPageSize));
      fetch(url, { credentials: "same-origin" })
        .then(function (r) {
          return r.json();
        })
        .then(function (payload) {
          let rows = (payload && payload.rows) || [];
          appendOutgoingRows(rows);
          outgoingNextOffset += rows.length;
          outgoingHasMore = !!(payload && payload.has_more);
          rebuildFacets(function () {
            applyRowFilter();
            updateFacetChrome();
            maybeLoadOutgoingUntilScrollable();
          });
        })
        .catch(function () {
          outgoingHasMore = false;
        })
        .finally(function () {
          outgoingLoading = false;
        });
    }

    function onOutgoingHistoryScroll() {
      if (
        !isOutgoingHistory ||
        !outgoingHasMore ||
        outgoingLoading ||
        !tableScroll
      ) {
        return;
      }
      if (outgoingScrollTicking) return;
      outgoingScrollTicking = true;
      requestAnimationFrame(function () {
        outgoingScrollTicking = false;
        if (
          !isOutgoingHistory ||
          !outgoingHasMore ||
          outgoingLoading ||
          !tableScroll
        ) {
          return;
        }
        let remaining =
          tableScroll.scrollHeight - (tableScroll.scrollTop + tableScroll.clientHeight);
        if (remaining <= 240) {
          loadMoreOutgoingRows();
        }
      });
    }

    let toggleBtn = document.getElementById(cfg.prefix + "-filters-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        let collapsed = filtersAside && filtersAside.classList.contains("filters--collapsed");
        setFiltersAsideCollapsed(!collapsed);
      });
    }

    let resetBtn = document.getElementById(cfg.prefix + "-facet-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (filtersDrawer && globalThis.gcTableFacets) globalThis.gcTableFacets.reset(filtersDrawer, facetKey);
        updateFacetChrome();
        applyRowFilter();
      });
    }

    if (filtersAside && globalThis.gcTableFacets) {
      globalThis.gcTableFacets.bindAside(
        filtersAside,
        function () {
          updateFacetChrome();
          applyRowFilter();
        },
        facetKey,
      );
    }

    if (searchIn) {
      if (globalThis.gcTableFacets && globalThis.gcTableFacets.bindToolbarSearch) {
        globalThis.gcTableFacets.bindToolbarSearch(searchIn, facetKey, applyRowFilter);
      } else {
        searchIn.addEventListener("input", applyRowFilter);
      }
    }

    let modal = document.getElementById(cfg.prefix + "-cols-modal");
    let colsTrigger = document.getElementById(cfg.prefix + "-cols-trigger");
    let colsPanel = document.getElementById(cfg.prefix + "-cols-panel");
    let colsFilter = document.getElementById(cfg.prefix + "-cols-filter");
    let colsList = document.getElementById(cfg.prefix + "-cols-list");
    let colsClose = document.getElementById(cfg.prefix + "-cols-close");

    function filterColMenuList() {
      let q = (colsFilter && colsFilter.value ? colsFilter.value : "").trim().toLowerCase();
      if (!colsList) return;
      colsList.querySelectorAll("li[data-col-label]").forEach(function (li) {
        let lab = (li.dataset.colLabel || "").toLowerCase();
        li.hidden = q !== "" && lab.indexOf(q) === -1;
      });
    }

    function buildColMenuList() {
      if (!colsList) return;
      colsList.innerHTML = COLS.map(function (c) {
        return (
          '<li class="toolbar__cols-item" data-col-id="' +
          escapeHtml(c.id) +
          '" data-col-label="' +
          escapeHtml(c.label.toLowerCase()) +
          '">' +
          '<label class="toolbar__cols-label">' +
          "<input type=\"checkbox\" " +
          cfg.colCheckboxAttr +
          '="' +
          escapeHtml(c.id) +
          '" ' +
          (colVis[c.id] ? "checked" : "") +
          " />" +
          "<span>" +
          escapeHtml(c.label) +
          "</span>" +
          "</label>" +
          "</li>"
        );
      }).join("");
      filterColMenuList();
    }

    function positionColsDropdown() {
      if (!colsTrigger || !colsPanel || !modal || modal.hidden) return;
      colsPanel.style.maxHeight = "";
      let r = colsTrigger.getBoundingClientRect();
      let gap = 6;
      let margin = 8;
      let pw = colsPanel.offsetWidth || Math.min(380, globalThis.innerWidth - 2 * margin);
      let left = r.left;
      if (left + pw > globalThis.innerWidth - margin) left = globalThis.innerWidth - margin - pw;
      left = Math.max(margin, left);
      let topBelow = r.bottom + gap;
      colsPanel.style.left = left + "px";
      colsPanel.style.top = topBelow + "px";
      let after = colsPanel.getBoundingClientRect();
      if (after.bottom > globalThis.innerHeight - margin) {
        let aboveTop = r.top - gap - after.height;
        if (aboveTop >= margin) colsPanel.style.top = aboveTop + "px";
        else {
          colsPanel.style.top = margin + "px";
          colsPanel.style.maxHeight = Math.max(120, globalThis.innerHeight - 2 * margin) + "px";
        }
      }
    }

    function setColPanelOpen(open) {
      if (!modal || !colsTrigger) return;
      modal.hidden = !open;
      modal.setAttribute("aria-hidden", open ? "false" : "true");
      colsTrigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open && colsPanel) {
        colsPanel.style.top = "";
        colsPanel.style.left = "";
        colsPanel.style.maxHeight = "";
      }
      if (open) {
        requestAnimationFrame(function () {
          requestAnimationFrame(positionColsDropdown);
        });
      }
    }

    function openColsFromTrigger() {
      let willOpen = modal.hidden;
      setColPanelOpen(willOpen);
      if (willOpen) {
        buildColMenuList();
        if (colsFilter) colsFilter.focus();
      }
    }

    if (colsTrigger) {
      colsTrigger.addEventListener("click", function (e) {
        e.stopPropagation();
        openColsFromTrigger();
      });
      colsTrigger.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openColsFromTrigger();
        }
      });
    }
    if (colsFilter) colsFilter.addEventListener("input", filterColMenuList);
    if (colsClose) {
      colsClose.addEventListener("click", function () {
        setColPanelOpen(false);
        if (colsTrigger) colsTrigger.focus();
      });
    }
    if (modal) {
      let bd = modal.querySelector(".fw-cols-modal__backdrop");
      if (bd) {
        bd.addEventListener("click", function () {
          setColPanelOpen(false);
          if (colsTrigger) colsTrigger.focus();
        });
      }
    }
    if (colsList) {
      colsList.addEventListener("change", function (e) {
        let cb = e.target.closest(colInputSel);
        if (!cb || cb.type !== "checkbox") return;
        let id = cb.getAttribute(cfg.colCheckboxAttr);
        if (!id || !Object.prototype.hasOwnProperty.call(colVis, id)) return;
        colVis[id] = cb.checked;
        let nOn = 0;
        COLS.forEach(function (c) {
          if (colVis[c.id]) nOn++;
        });
        if (nOn < 1) {
          cb.checked = true;
          colVis[id] = true;
          return;
        }
        persistColVis(colVis);
        applyColVis(colVis);
        syncFilterEmptyColspan();
        applyRowFilter();
      });
    }

    document.addEventListener("mousedown", function (e) {
      if (!modal || modal.hidden) return;
      if ((colsTrigger && colsTrigger.contains(e.target)) || (colsPanel && colsPanel.contains(e.target))) return;
      setColPanelOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal && !modal.hidden) {
        setColPanelOpen(false);
        if (colsTrigger) colsTrigger.focus();
      }
    });
    globalThis.addEventListener("resize", function () {
      if (modal && !modal.hidden) positionColsDropdown();
    });

    historyTableRefreshRowUi.push(function () {
      applyRowFilter();
      updateFacetChrome();
    });

    rebuildFacets(function () {
      applyRowFilter();
      updateFacetChrome();
      if (globalThis.gcTableSort && typeof globalThis.gcTableSort.bindTable === "function") {
        globalThis.gcTableSort.bindTable(table);
      }
      maybeLoadOutgoingUntilScrollable();
    });

    document.addEventListener("gc-firewall-selection-changed", applyRowFilter);
    if (isOutgoingHistory && tableScroll) {
      tableScroll.addEventListener("scroll", onOutgoingHistoryScroll, { passive: true });
    }
  }

  let TAB_LS = rootCfg.tabLsKey || "ground-control-firewalls-history-tab";
  let FILTER_ASIDE_IDS = rootCfg.filterAsideIds || [];

  function readSavedTab() {
    try {
      let raw = localStorage.getItem(TAB_LS);
      if (
        raw === "incoming" ||
        raw === "outgoing" ||
        raw === "sync" ||
        raw === "access" ||
        raw === "letsencrypt"
      )
        return raw;
      if (raw === "changes") return "incoming";
    } catch (e) {}
    return "incoming";
  }

  function readTabFromHash() {
    let h = (globalThis.location.hash || "").replace(/^#/, "").toLowerCase();
    if (
      h === "outgoing" ||
      h === "incoming" ||
      h === "sync" ||
      h === "access" ||
      h === "letsencrypt"
    )
      return h;
    return null;
  }

  let hashTab = readTabFromHash();
  let activeTab = hashTab || readSavedTab();
  if (
    activeTab !== "incoming" &&
    activeTab !== "outgoing" &&
    activeTab !== "sync" &&
    activeTab !== "access" &&
    activeTab !== "letsencrypt"
  ) {
    activeTab = "incoming";
  }
  try {
    localStorage.setItem(TAB_LS, activeTab);
  } catch (e) {}
  try {
    let curHash = (globalThis.location.hash || "").replace(/^#/, "").toLowerCase();
    if (curHash !== activeTab) {
      if (!(activeTab === "incoming" && !curHash)) {
        history.replaceState(
          null,
          "",
          globalThis.location.pathname + globalThis.location.search + "#" + activeTab,
        );
      }
    }
  } catch (e2) {}

  function syncFilterAsidesVisibility() {
    FILTER_ASIDE_IDS.forEach(function (item) {
      let el = document.getElementById(item.id);
      if (!el) return;
      el.hidden = item.tab !== activeTab;
    });
  }

  let tablist = document.getElementById("gc-fw-hist-tablist");
  let tabs = tablist ? tablist.querySelectorAll(":scope > .gc-tabs__tab[data-gc-tab]") : [];
  let panels = {
    incoming: document.getElementById("gc-fw-hist-panel-incoming"),
    outgoing: document.getElementById("gc-fw-hist-panel-outgoing"),
    sync: document.getElementById("gc-fw-hist-panel-sync"),
    access: document.getElementById("gc-fw-hist-panel-access"),
    letsencrypt: document.getElementById("gc-fw-hist-panel-letsencrypt"),
  };

  function applyTabPanels() {
    Object.keys(panels).forEach(function (key) {
      let p = panels[key];
      if (!p) return;
      let show = key === activeTab;
      p.classList.toggle("is-active", show);
      p.hidden = !show;
    });
  }

  function syncTabButtons() {
    tabs.forEach(function (t) {
      let tid = t.dataset.gcTab;
      let on = tid === activeTab;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  syncTabButtons();
  applyTabPanels();
  syncFilterAsidesVisibility();

  rootCfg.tables.forEach(initHistoryTable);

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      let id = tab.dataset.gcTab;
      if (!id) return;
      activeTab = id;
      syncTabButtons();
      applyTabPanels();
      syncFilterAsidesVisibility();
      historyTableRefreshRowUi.forEach(function (fn) {
        fn();
      });
      try {
        localStorage.setItem(TAB_LS, id);
      } catch (e) {}
      try {
        let tail = "#" + id;
        if (globalThis.location.hash !== tail) {
          history.replaceState(null, "", globalThis.location.pathname + globalThis.location.search + tail);
        }
      } catch (e2) {}
    });
  });

  let chgCompareTpl = rootCfg.changelogCompareUrlTpl;
  if (chgCompareTpl) {
    function escChg(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function cellContentChg(text, cellClass) {
      if (text !== "") return escChg(text);
      if (cellClass === "empty") {
        return "<span class=\"task-queue-diff__placeholder\" aria-hidden=\"true\">·</span>";
      }
      return "";
    }

    let chgTableBody = document.querySelector("#gc-hist-chg-table tbody");
    let compareModal = document.getElementById("gc-hist-chg-compare-modal");
    let compareClose = document.getElementById("gc-hist-chg-compare-close");
    let compareBackdrop = compareModal && compareModal.querySelector(".task-queue-compare-modal__backdrop");
    let compareMeta = document.getElementById("gc-hist-chg-compare-meta");
    let compareMissing = document.getElementById("gc-hist-chg-compare-missing");
    let compareTbody = document.getElementById("gc-hist-chg-diff-tbody");
    let compareOpen = false;
    let compareLoadSeq = 0;

    function changelogCompareUrl(id) {
      return chgCompareTpl.split("__ID__").join(String(parseInt(id, 10)));
    }

    function closeChgCompareModal() {
      if (!compareModal || !compareOpen) return;
      compareOpen = false;
      compareModal.hidden = true;
      compareModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function openChgCompareModal(entryId) {
      if (!compareModal || !compareTbody || !compareMeta) return;
      compareOpen = true;
      let seq = ++compareLoadSeq;
      compareModal.hidden = false;
      compareModal.setAttribute("aria-hidden", "false");
      compareTbody.innerHTML = "";
      compareMeta.textContent = "Loading…";
      if (compareMissing) {
        compareMissing.textContent = "";
        compareMissing.hidden = true;
      }
      document.body.style.overflow = "hidden";

      fetch(changelogCompareUrl(entryId), { credentials: "same-origin" })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          if (seq !== compareLoadSeq) return;
          if (!x.ok) {
            compareMeta.textContent = (x.j && x.j.detail) || "Could not load comparison.";
            return;
          }
          let j = x.j || {};
          compareMeta.textContent =
            (j.entity_type || "") +
            " · " +
            (j.external_name || "") +
            " · " +
            (j.action || "") +
            " · changelog #" +
            (j.changelog_id != null ? j.changelog_id : entryId);
          if (compareMissing) {
            let lm = !!j.left_missing;
            let rm = !!j.right_missing;
            if (lm && rm) {
              compareMissing.textContent =
                "Neither a previous nor a new payload was recorded for this row.";
              compareMissing.hidden = false;
            } else if (lm) {
              compareMissing.textContent = "No previous payload (new object in this sync).";
              compareMissing.hidden = false;
            } else if (rm) {
              compareMissing.textContent = "No new payload (object removed in this sync).";
              compareMissing.hidden = false;
            } else {
              compareMissing.hidden = true;
            }
          }
          let rows = j.rows || [];
          let histDiffHtml = rows
            .map(function (row) {
              let lc = row.left_class || "eq";
              let rc = row.right_class || "eq";
              return (
                "<tr><td class=\"task-queue-diff__cell task-queue-diff__cell--" +
                escChg(lc) +
                "\">" +
                cellContentChg(row.left != null ? row.left : "", lc) +
                "</td><td class=\"task-queue-diff__cell task-queue-diff__cell--" +
                escChg(rc) +
                "\">" +
                cellContentChg(row.right != null ? row.right : "", rc) +
                "</td></tr>"
              );
            })
            .join("");
          function finishHistCompareDiffMount() {
            if (globalThis.gcTableSort && compareTbody) {
              let diffTable = compareTbody.closest("table");
              if (diffTable) globalThis.gcTableSort.bindTable(diffTable);
            }
            if (compareClose) compareClose.focus();
          }
          let wrapHistDiff = document.createElement("tbody");
          wrapHistDiff.innerHTML = histDiffHtml;
          let histDiffNodes = Array.prototype.slice.call(wrapHistDiff.children);
          compareTbody.innerHTML = "";
          let lazyHistDiff = globalThis.gcTableLazy;
          if (!lazyHistDiff || typeof lazyHistDiff.appendBefore !== "function" || histDiffNodes.length <= lazyHistDiff.DEFAULT_THRESHOLD) {
            compareTbody.innerHTML = histDiffHtml;
            finishHistCompareDiffMount();
          } else {
            lazyHistDiff.appendBefore(compareTbody, histDiffNodes, null, { onComplete: finishHistCompareDiffMount });
          }
        })
        .catch(function () {
          if (seq !== compareLoadSeq) return;
          compareMeta.textContent = "Could not load comparison.";
        });
    }

    if (compareClose) compareClose.addEventListener("click", closeChgCompareModal);
    if (compareBackdrop) compareBackdrop.addEventListener("click", closeChgCompareModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && compareOpen) closeChgCompareModal();
    });

    if (chgTableBody) {
      chgTableBody.addEventListener("click", function (e) {
        if (e.target.closest("input, button, a, label")) return;
        let tr = e.target.closest("tr[data-changelog-id]");
        if (!tr) return;
        let id = parseInt(tr.dataset.changelogId, 10);
        if (isNaN(id)) return;
        openChgCompareModal(id);
      });
    }
  }

  let outCompareTpl = rootCfg.completedCompareUrlTpl;
  if (outCompareTpl) {
    let outTableBody = document.querySelector("#gc-hist-out-table tbody");
    let outCompareModal = document.getElementById("gc-hist-out-compare-modal");
    let outCompareClose = document.getElementById("gc-hist-out-compare-close");
    let outCompareBackdrop =
      outCompareModal && outCompareModal.querySelector(".task-queue-compare-modal__backdrop");
    let outCompareMeta = document.getElementById("gc-hist-out-compare-meta");
    let outCompareMissing = document.getElementById("gc-hist-out-compare-missing");
    let outCompareOutcomeBanner = document.getElementById(
      "gc-hist-out-compare-outcome-banner"
    );
    let outCompareTbody = document.getElementById("gc-hist-out-diff-tbody");
    let outCompareTitle = document.getElementById("gc-hist-out-compare-title");
    let outDiffThLeft = document.getElementById("gc-hist-out-diff-th-left");
    let outDiffThRight = document.getElementById("gc-hist-out-diff-th-right");
    let outCompareOpen = false;
    let outCompareLoadSeq = 0;

    function escOut(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function cellContentOut(text, cellClass) {
      if (text !== "") return escOut(text);
      if (cellClass === "empty") {
        return "<span class=\"task-queue-diff__placeholder\" aria-hidden=\"true\">·</span>";
      }
      return "";
    }

    function completedCompareUrl(id) {
      return outCompareTpl.split("__ID__").join(String(parseInt(id, 10)));
    }

    function closeOutCompareModal() {
      if (!outCompareModal || !outCompareOpen) return;
      outCompareOpen = false;
      outCompareModal.hidden = true;
      outCompareModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function openOutCompareModal(completedId) {
      if (!outCompareModal || !outCompareTbody || !outCompareMeta) return;
      outCompareOpen = true;
      let seq = ++outCompareLoadSeq;
      outCompareModal.hidden = false;
      outCompareModal.setAttribute("aria-hidden", "false");
      outCompareTbody.innerHTML = "";
      outCompareMeta.textContent = "Loading…";
      if (outCompareMissing) {
        outCompareMissing.textContent = "";
        outCompareMissing.hidden = true;
      }
      if (outCompareOutcomeBanner) {
        outCompareOutcomeBanner.textContent = "";
        outCompareOutcomeBanner.hidden = true;
      }
      document.body.style.overflow = "hidden";

      fetch(completedCompareUrl(completedId), { credentials: "same-origin" })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          if (seq !== outCompareLoadSeq) return;
          if (!x.ok) {
            outCompareMeta.textContent = (x.j && x.j.detail) || "Could not load comparison.";
            return;
          }
          let j = x.j || {};
          let meta =
            (j.entity_type || "") +
            " · " +
            (j.external_name || "") +
            " · history #" +
            (j.completed_id != null ? j.completed_id : completedId);
          if (j.source_task_id != null) meta += " · queue #" + j.source_task_id;
          outCompareMeta.textContent = meta;
          if (outCompareTitle) {
            outCompareTitle.textContent = "Task queue entry";
          }
          if (outDiffThLeft) {
            outDiffThLeft.textContent = "Stored (local cache)";
          }
          if (outDiffThRight) {
            outDiffThRight.textContent = "Proposed change";
          }
          if (outCompareOutcomeBanner) {
            if (j.outcome === "removed_from_queue") {
              outCompareOutcomeBanner.textContent = "Rejected";
              outCompareOutcomeBanner.hidden = false;
            } else {
              outCompareOutcomeBanner.textContent = "";
              outCompareOutcomeBanner.hidden = true;
            }
          }
          if (outCompareMissing) {
            if (j.stored_missing) {
              outCompareMissing.textContent =
                "No matching row in the local config cache for this object. The right column shows the payload that was queued.";
              outCompareMissing.hidden = false;
            } else {
              outCompareMissing.hidden = true;
            }
          }
          let rows = j.rows || [];
          let diffHtml = rows
            .map(function (row) {
              let lc = row.left_class || "eq";
              let rc = row.right_class || "eq";
              return (
                "<tr><td class=\"task-queue-diff__cell task-queue-diff__cell--" +
                escOut(lc) +
                "\">" +
                cellContentOut(row.left != null ? row.left : "", lc) +
                "</td><td class=\"task-queue-diff__cell task-queue-diff__cell--" +
                escOut(rc) +
                "\">" +
                cellContentOut(row.right != null ? row.right : "", rc) +
                "</td></tr>"
              );
            })
            .join("");
          function finishOutCompareMount() {
            if (globalThis.gcTableSort && outCompareTbody) {
              let diffTable = outCompareTbody.closest("table");
              if (diffTable) globalThis.gcTableSort.bindTable(diffTable);
            }
            if (outCompareClose) outCompareClose.focus();
          }
          let wrapOut = document.createElement("tbody");
          wrapOut.innerHTML = diffHtml;
          let outNodes = Array.prototype.slice.call(wrapOut.children);
          outCompareTbody.innerHTML = "";
          let lazyOut = globalThis.gcTableLazy;
          if (!lazyOut || typeof lazyOut.appendBefore !== "function" || outNodes.length <= lazyOut.DEFAULT_THRESHOLD) {
            outCompareTbody.innerHTML = diffHtml;
            finishOutCompareMount();
          } else {
            lazyOut.appendBefore(outCompareTbody, outNodes, null, { onComplete: finishOutCompareMount });
          }
        })
        .catch(function () {
          if (seq !== outCompareLoadSeq) return;
          outCompareMeta.textContent = "Could not load comparison.";
        });
    }

    if (outCompareClose) outCompareClose.addEventListener("click", closeOutCompareModal);
    if (outCompareBackdrop) outCompareBackdrop.addEventListener("click", closeOutCompareModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && outCompareOpen) closeOutCompareModal();
    });

    if (outTableBody) {
      outTableBody.addEventListener("click", function (e) {
        if (e.target.closest("input, button, a, label")) return;
        let tr = e.target.closest("tr[data-completed-id]");
        if (!tr) return;
        let id = parseInt(tr.dataset.completedId, 10);
        if (isNaN(id)) return;
        openOutCompareModal(id);
      });
    }
  }

  let syncDetailsTpl = rootCfg.syncRunDetailsUrlTpl;
  if (syncDetailsTpl) {
    function syncRunDetailsUrl(runId) {
      return syncDetailsTpl.split("__RUN_ID__").join(String(runId));
    }

    function groupSyncDetailByFirewall(items) {
      let buckets = [];
      let indexByFw = {};
      (items || []).forEach(function (it) {
        let fid = it.firewall_id;
        let k = String(fid);
        if (!Object.prototype.hasOwnProperty.call(indexByFw, k)) {
          indexByFw[k] = buckets.length;
          buckets.push({
            firewall_label: it.firewall_label || k,
            items: [],
          });
        }
        buckets[indexByFw[k]].items.push(it);
      });
      return buckets;
    }

    let syncTableBody = document.querySelector("#gc-hist-sync-table tbody");
    let syncDetailModal = document.getElementById("gc-hist-sync-detail-modal");
    let syncDetailClose = document.getElementById("gc-hist-sync-detail-close");
    let syncDetailBackdrop =
      syncDetailModal && syncDetailModal.querySelector(".task-queue-compare-modal__backdrop");
    let syncDetailMeta = document.getElementById("gc-hist-sync-detail-meta");
    let syncDetailBody = document.getElementById("gc-hist-sync-detail-body");
    let syncDetailOpen = false;
    let syncDetailLoadSeq = 0;

    function closeSyncDetailModal() {
      if (!syncDetailModal || !syncDetailOpen) return;
      syncDetailOpen = false;
      syncDetailModal.hidden = true;
      syncDetailModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function renderSyncDetailSections(byAction) {
      if (!syncDetailBody) return;
      let order = [
        { key: "added", title: "Added" },
        { key: "changed", title: "Changed" },
        { key: "deleted", title: "Deleted" },
      ];
      let parts = [];
      order.forEach(function (sec) {
        let items = (byAction && byAction[sec.key]) || [];
        parts.push('<section class="gc-sync-run-detail-section">');
        parts.push(
          "<h3 class=\"gc-sync-run-detail-heading\">" +
            escapeHtml(sec.title) +
            " <span class=\"gc-sync-run-detail-count\">(" +
            items.length +
            ")</span></h3>",
        );
        if (!items.length) {
          parts.push('<p class="gc-sync-run-detail-empty">No items.</p>');
        } else {
          groupSyncDetailByFirewall(items).forEach(function (bucket) {
            parts.push(
              '<h4 class="gc-sync-run-detail-fw">' + escapeHtml(bucket.firewall_label) + "</h4>",
            );
            parts.push('<ul class="gc-sync-run-detail-list">');
            bucket.items.forEach(function (it) {
              parts.push(
                "<li><span class=\"mono\">" +
                  escapeHtml(it.entity_type || "") +
                  "</span> · <span class=\"mono\">" +
                  escapeHtml(it.external_name || "") +
                  "</span></li>",
              );
            });
            parts.push("</ul>");
          });
        }
        parts.push("</section>");
      });
      syncDetailBody.innerHTML = parts.join("");
    }

    function openSyncDetailModal(runId) {
      if (!syncDetailModal || !syncDetailBody || !syncDetailMeta) return;
      syncDetailOpen = true;
      let seq = ++syncDetailLoadSeq;
      syncDetailModal.hidden = false;
      syncDetailModal.setAttribute("aria-hidden", "false");
      syncDetailBody.innerHTML = "";
      syncDetailMeta.textContent = "Loading…";
      document.body.style.overflow = "hidden";

      fetch(syncRunDetailsUrl(runId), { credentials: "same-origin" })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          if (seq !== syncDetailLoadSeq) return;
          if (!x.ok) {
            syncDetailMeta.textContent = (x.j && x.j.detail) || "Could not load sync details.";
            return;
          }
          let j = x.j || {};
          let r0 = j.run || {};
          let bits = [];
          if (r0.firewall_label) bits.push(r0.firewall_label);
          if (r0.started_at) bits.push("started " + r0.started_at);
          if (r0.finished_at) bits.push("finished " + r0.finished_at);
          if (r0.status) bits.push(r0.status);
          if (r0.error_message) bits.push("error: " + r0.error_message);
          bits.push(
            "summary: added " +
              (r0.added_count != null ? r0.added_count : "—") +
              " · changed " +
              (r0.changed_count != null ? r0.changed_count : "—") +
              " · deleted " +
              (r0.deleted_count != null ? r0.deleted_count : "—"),
          );
          syncDetailMeta.textContent = bits.join(" · ");
          let fws = j.firewalls || [];
          let ba = j.by_action || {};
          let detailTotal =
            (ba.added || []).length + (ba.changed || []).length + (ba.deleted || []).length;
          let note = "";
          if (detailTotal === 0) {
            note =
              '<p class="gc-sync-run-detail-firewalls-note muted">No per-object changelog rows were recorded for this run.</p>';
          } else if (fws.length > 1) {
            note =
              '<p class="gc-sync-run-detail-firewalls-note muted">Firewalls in changelog: ' +
              fws
                .map(function (f) {
                  return escapeHtml(f.label || String(f.id));
                })
                .join(", ") +
              "</p>";
          }
          renderSyncDetailSections(ba);
          if (note && syncDetailBody) {
            syncDetailBody.insertAdjacentHTML("afterbegin", note);
          }
        })
        .catch(function () {
          if (seq !== syncDetailLoadSeq) return;
          syncDetailMeta.textContent = "Could not load sync details.";
        });
    }

    if (syncDetailClose) syncDetailClose.addEventListener("click", closeSyncDetailModal);
    if (syncDetailBackdrop) syncDetailBackdrop.addEventListener("click", closeSyncDetailModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && syncDetailOpen) closeSyncDetailModal();
    });

    if (syncTableBody) {
      syncTableBody.addEventListener("click", function (e) {
        if (e.target.closest("input, button, a, label")) return;
        let tr = e.target.closest("tr[data-sync-run-id]");
        if (!tr) return;
        let rid = (tr.dataset.syncRunId || "").trim();
        if (!rid) return;
        openSyncDetailModal(rid);
      });
    }
  }
})();
