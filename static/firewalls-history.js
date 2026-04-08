(function () {
  "use strict";

  var rootCfg = window.GC_FIREWALLS_HISTORY;
  if (!rootCfg || !rootCfg.tables || !rootCfg.tables.length) return;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initHistoryTable(cfg) {
    var table = document.getElementById(cfg.tableId);
    if (!table) return;

    var COLS = cfg.cols;
    var lsKey = cfg.lsKeyCols;
    var facetKey = cfg.facetStorageKey;
    var colInputSel = "input[" + cfg.colCheckboxAttr + "]";

    var filtersDrawer = document.getElementById(cfg.prefix + "-filters-drawer");
    var filtersAside = document.getElementById(cfg.prefix + "-filters-aside");
    var searchIn = document.getElementById(cfg.prefix + "-search");
    var filterEmpty = document.getElementById(cfg.filterEmptyRowId);
    var countEl = document.getElementById(cfg.countElId);
    var tbody = table.querySelector("tbody");
    var tableScroll = table.closest(".table-scroll");
    var isOutgoingHistory = cfg.prefix === "gc-hist-out";
    var outgoingListUrl = isOutgoingHistory ? (rootCfg.outgoingListUrl || "") : "";
    var outgoingPageSize = Math.max(
      1,
      parseInt(rootCfg.outgoingPageSize || 200, 10) || 200
    );
    var outgoingHasMore = isOutgoingHistory
      ? !!rootCfg.outgoingHasMore
      : false;
    var outgoingNextOffset = isOutgoingHistory
      ? parseInt(
          rootCfg.outgoingInitialCount || tbody.querySelectorAll("tr." + cfg.rowClass).length,
          10
        ) || 0
      : 0;
    var outgoingLoading = false;
    var outgoingScrollTicking = false;

    var facetCols = COLS.map(function (c) {
      var lab = c.label;
      if (typeof window.gcTableColumnDisplayLabel === "function") {
        lab = window.gcTableColumnDisplayLabel(lab);
      }
      return { id: c.id, label: lab };
    });

    function loadColVis() {
      var d = {};
      COLS.forEach(function (c) {
        d[c.id] = c.defaultHidden ? false : true;
      });
      try {
        var raw = localStorage.getItem(lsKey);
        if (raw) {
          var o = JSON.parse(raw);
          if (o && typeof o === "object") {
            COLS.forEach(function (c) {
              if (Object.prototype.hasOwnProperty.call(o, c.id)) d[c.id] = !!o[c.id];
            });
          }
        }
      } catch (e) {}
      var visible = 0;
      COLS.forEach(function (c) {
        if (d[c.id]) visible++;
      });
      if (visible < 1 && COLS.length) d[COLS[0].id] = true;
      return d;
    }

    var colVis = loadColVis();

    function persistColVis(vis) {
      try {
        localStorage.setItem(lsKey, JSON.stringify(vis));
      } catch (e) {}
    }

    function applyColVis(vis) {
      COLS.forEach(function (c) {
        var on = !!vis[c.id];
        table.querySelectorAll('[data-gc-col="' + c.id + '"]').forEach(function (el) {
          el.classList.toggle("gc-col-hidden", !on);
        });
      });
    }

    function syncFilterEmptyColspan() {
      var n = table.querySelectorAll("thead th").length;
      if (filterEmpty) {
        var td = filterEmpty.querySelector("td");
        if (td) td.setAttribute("colspan", String(n));
      }
      var ph = tbody && tbody.querySelector("." + cfg.placeholderRowClass);
      if (ph) {
        var ptd = ph.querySelector("td");
        if (ptd) ptd.setAttribute("colspan", String(n));
      }
    }

    applyColVis(colVis);
    syncFilterEmptyColspan();

    function rowFacetMapFromTr(tr) {
      var m = {};
      tr.querySelectorAll("td[data-gc-col]").forEach(function (td) {
        var k = td.getAttribute("data-gc-col");
        if (!k) return;
        m[k] = (td.textContent || "").trim().replace(/\s+/g, " ");
      });
      return m;
    }

    function rebuildFacets(done) {
      if (!filtersDrawer || !window.gcTableFacets) {
        if (typeof done === "function") done();
        return;
      }
      var rowEls = Array.prototype.slice.call(tbody.querySelectorAll("tr." + cfg.rowClass));
      var maps = rowEls.map(function (tr) {
        return rowFacetMapFromTr(tr);
      });
      function rebuildHistoryDrawer() {
        window.gcTableFacets.rebuild(filtersDrawer, facetCols, maps, facetKey);
        if (typeof done === "function") done();
      }
      var lazy = window.gcTableLazy;
      if (!lazy || typeof lazy.forEachChunked !== "function" || rowEls.length <= lazy.DEFAULT_THRESHOLD) {
        rowEls.forEach(function (tr, i) {
          window.gcTableFacets.setRowFacets(tr, maps[i]);
        });
        rebuildHistoryDrawer();
        return;
      }
      lazy.forEachChunked(
        rowEls,
        lazy.DEFAULT_CHUNK,
        function (tr, i) {
          window.gcTableFacets.setRowFacets(tr, maps[i]);
        },
        rebuildHistoryDrawer,
      );
    }

    function facetAppliedCount() {
      if (!filtersDrawer || !window.gcTableFacets) return 0;
      return window.gcTableFacets.appliedCount(filtersDrawer);
    }

    function updateFacetChrome() {
      var n = facetAppliedCount();
      var head = document.getElementById(cfg.prefix + "-facet-head-actions");
      var countElFacet = document.getElementById(cfg.prefix + "-facet-count");
      var resetBtn = document.getElementById(cfg.prefix + "-facet-reset");
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
      var btn = document.getElementById(cfg.prefix + "-filters-toggle");
      filtersAside.classList.toggle("filters--collapsed", collapsed);
      if (btn) btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      if (collapsed) filtersDrawer.setAttribute("hidden", "");
      else filtersDrawer.removeAttribute("hidden");
    }

    function globalFwRowOk(tr) {
      if (
        typeof window.gcSkipGlobalFirewallTableFilter === "function" &&
        window.gcSkipGlobalFirewallTableFilter()
      ) {
        return true;
      }
      if (typeof window.gcGetSelectedFirewallIds !== "function") return true;
      var ids = window.gcGetSelectedFirewallIds();
      if (ids.length === 0) return false;
      var fid = tr.getAttribute("data-firewall-id");
      if (fid == null || fid === "") return false;
      var n = parseInt(fid, 10);
      if (isNaN(n)) return false;
      return ids.indexOf(n) !== -1;
    }

    function applyRowFilter() {
      var q = (searchIn && searchIn.value ? searchIn.value : "").trim().toLowerCase();
      var rows = tbody.querySelectorAll("tr." + cfg.rowClass);
      var visible = 0;
      var total = rows.length;
      rows.forEach(function (tr) {
        var s = tr.getAttribute("data-search") || "";
        var facetOk =
          !filtersDrawer ||
          !window.gcTableFacets ||
          window.gcTableFacets.rowMatches(tr, filtersDrawer);
        var ok = (!q || s.indexOf(q) !== -1) && facetOk && globalFwRowOk(tr);
        tr.hidden = !ok;
        if (ok) visible++;
      });
      if (filterEmpty) filterEmpty.hidden = !(total > 0 && visible === 0);
      var ph = tbody.querySelector("." + cfg.placeholderRowClass);
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
      var label = row && row.firewall_label != null ? String(row.firewall_label) : "—";
      if (row && row.firewall_id != null && row.firewall_id !== "") {
        var online = !!row.firewall_online;
        return (
          '<span class="gc-zone-pill gc-firewall-pill">' +
          '<span class="gc-firewall-pill-status gc-firewall-pill-status--' +
          (online ? "online" : "offline") +
          '" role="img" aria-label="Firewall ' +
          (online ? "online" : "offline") +
          '">' +
          (online ? "✓" : "-") +
          "</span>" +
          '<span class="mono">' +
          escapeHtml(label) +
          "</span></span>"
        );
      }
      return '<span class="muted">' + escapeHtml(label) + "</span>";
    }

    function historyOutgoingRowHtml(row) {
      var rid = row && row.id != null ? String(row.id) : "";
      var sourceTask = row && row.source_task_id != null ? String(row.source_task_id) : "—";
      var sourceSort = row && row.source_task_id != null ? String(row.source_task_id) : "0";
      var firewallId =
        row && row.firewall_id != null && row.firewall_id !== "" ? String(row.firewall_id) : "";
      var outcome = row && row.outcome ? String(row.outcome) : "sent";
      var searchBlob = row && row.search_blob != null ? String(row.search_blob) : "";
      var entityType = row && row.entity_type != null ? String(row.entity_type) : "";
      var externalName = row && row.external_name != null ? String(row.external_name) : "";
      var queuedBy = row && row.created_by_username != null ? String(row.created_by_username) : "—";
      var completedBy =
        row && row.completed_by_username != null ? String(row.completed_by_username) : "—";
      var createdAt = row && row.created_at != null ? String(row.created_at) : "";
      var completedAt = row && row.completed_at != null ? String(row.completed_at) : "";
      var statusLabel = historyOutcomeLabel(outcome);
      var firewallHtml = historyFirewallCellHtml(row || {});
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
      var html = rows.map(historyOutgoingRowHtml).join("");
      var wrap = document.createElement("tbody");
      wrap.innerHTML = html;
      var nodes = Array.prototype.slice.call(wrap.children);
      nodes.forEach(function (tr) {
        if (filterEmpty && filterEmpty.parentElement === tbody) {
          tbody.insertBefore(tr, filterEmpty);
        } else {
          tbody.appendChild(tr);
        }
      });
      var ph = tbody.querySelector("." + cfg.placeholderRowClass);
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
      var sep = outgoingListUrl.indexOf("?") === -1 ? "?" : "&";
      var url =
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
          var rows = (payload && payload.rows) || [];
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
        var remaining =
          tableScroll.scrollHeight - (tableScroll.scrollTop + tableScroll.clientHeight);
        if (remaining <= 240) {
          loadMoreOutgoingRows();
        }
      });
    }

    var toggleBtn = document.getElementById(cfg.prefix + "-filters-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        var collapsed = filtersAside && filtersAside.classList.contains("filters--collapsed");
        setFiltersAsideCollapsed(!collapsed);
      });
    }

    var resetBtn = document.getElementById(cfg.prefix + "-facet-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (filtersDrawer && window.gcTableFacets) window.gcTableFacets.reset(filtersDrawer, facetKey);
        updateFacetChrome();
        applyRowFilter();
      });
    }

    if (filtersAside && window.gcTableFacets) {
      window.gcTableFacets.bindAside(
        filtersAside,
        function () {
          updateFacetChrome();
          applyRowFilter();
        },
        facetKey,
      );
    }

    if (searchIn) {
      if (window.gcTableFacets && window.gcTableFacets.bindToolbarSearch) {
        window.gcTableFacets.bindToolbarSearch(searchIn, facetKey, applyRowFilter);
      } else {
        searchIn.addEventListener("input", applyRowFilter);
      }
    }

    var modal = document.getElementById(cfg.prefix + "-cols-modal");
    var colsTrigger = document.getElementById(cfg.prefix + "-cols-trigger");
    var colsPanel = document.getElementById(cfg.prefix + "-cols-panel");
    var colsFilter = document.getElementById(cfg.prefix + "-cols-filter");
    var colsList = document.getElementById(cfg.prefix + "-cols-list");
    var colsClose = document.getElementById(cfg.prefix + "-cols-close");

    function filterColMenuList() {
      var q = (colsFilter && colsFilter.value ? colsFilter.value : "").trim().toLowerCase();
      if (!colsList) return;
      colsList.querySelectorAll("li[data-col-label]").forEach(function (li) {
        var lab = (li.dataset.colLabel || "").toLowerCase();
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
      var r = colsTrigger.getBoundingClientRect();
      var gap = 6;
      var margin = 8;
      var pw = colsPanel.offsetWidth || Math.min(380, window.innerWidth - 2 * margin);
      var left = r.left;
      if (left + pw > window.innerWidth - margin) left = window.innerWidth - margin - pw;
      left = Math.max(margin, left);
      var topBelow = r.bottom + gap;
      colsPanel.style.left = left + "px";
      colsPanel.style.top = topBelow + "px";
      var after = colsPanel.getBoundingClientRect();
      if (after.bottom > window.innerHeight - margin) {
        var aboveTop = r.top - gap - after.height;
        if (aboveTop >= margin) colsPanel.style.top = aboveTop + "px";
        else {
          colsPanel.style.top = margin + "px";
          colsPanel.style.maxHeight = Math.max(120, window.innerHeight - 2 * margin) + "px";
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
      var willOpen = modal.hidden;
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
      var bd = modal.querySelector(".fw-cols-modal__backdrop");
      if (bd) {
        bd.addEventListener("click", function () {
          setColPanelOpen(false);
          if (colsTrigger) colsTrigger.focus();
        });
      }
    }
    if (colsList) {
      colsList.addEventListener("change", function (e) {
        var cb = e.target.closest(colInputSel);
        if (!cb || cb.type !== "checkbox") return;
        var id = cb.getAttribute(cfg.colCheckboxAttr);
        if (!id || !Object.prototype.hasOwnProperty.call(colVis, id)) return;
        colVis[id] = cb.checked;
        var nOn = 0;
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
    window.addEventListener("resize", function () {
      if (modal && !modal.hidden) positionColsDropdown();
    });

    rebuildFacets(function () {
      applyRowFilter();
      updateFacetChrome();
      if (window.gcTableSort && typeof window.gcTableSort.bindTable === "function") {
        window.gcTableSort.bindTable(table);
      }
      maybeLoadOutgoingUntilScrollable();
    });

    document.addEventListener("gc-firewall-selection-changed", applyRowFilter);
    if (isOutgoingHistory && tableScroll) {
      tableScroll.addEventListener("scroll", onOutgoingHistoryScroll, { passive: true });
    }
  }

  rootCfg.tables.forEach(initHistoryTable);

  var TAB_LS = rootCfg.tabLsKey || "ground-control-firewalls-history-tab";
  var FILTER_ASIDE_IDS = rootCfg.filterAsideIds || [];

  function readSavedTab() {
    try {
      var raw = localStorage.getItem(TAB_LS);
      if (raw === "incoming" || raw === "outgoing" || raw === "sync" || raw === "access") return raw;
      if (raw === "changes") return "incoming";
    } catch (e) {}
    return "incoming";
  }

  function readTabFromHash() {
    var h = (window.location.hash || "").replace(/^#/, "").toLowerCase();
    if (h === "outgoing" || h === "incoming" || h === "sync" || h === "access") return h;
    return null;
  }

  var hashTab = readTabFromHash();
  var activeTab = hashTab || readSavedTab();
  if (activeTab !== "incoming" && activeTab !== "outgoing" && activeTab !== "sync" && activeTab !== "access") {
    activeTab = "incoming";
  }
  if (hashTab) {
    try {
      localStorage.setItem(TAB_LS, hashTab);
    } catch (e) {}
  }

  function syncFilterAsidesVisibility() {
    FILTER_ASIDE_IDS.forEach(function (item) {
      var el = document.getElementById(item.id);
      if (!el) return;
      el.hidden = item.tab !== activeTab;
    });
  }

  var tablist = document.getElementById("gc-fw-hist-tablist");
  var tabs = tablist ? tablist.querySelectorAll(":scope > .gc-tabs__tab[data-gc-tab]") : [];
  var panels = {
    incoming: document.getElementById("gc-fw-hist-panel-incoming"),
    outgoing: document.getElementById("gc-fw-hist-panel-outgoing"),
    sync: document.getElementById("gc-fw-hist-panel-sync"),
    access: document.getElementById("gc-fw-hist-panel-access"),
  };

  function applyTabPanels() {
    Object.keys(panels).forEach(function (key) {
      var p = panels[key];
      if (!p) return;
      var show = key === activeTab;
      p.classList.toggle("is-active", show);
      p.hidden = !show;
    });
  }

  function syncTabButtons() {
    tabs.forEach(function (t) {
      var tid = t.getAttribute("data-gc-tab");
      var on = tid === activeTab;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var id = tab.getAttribute("data-gc-tab");
      if (!id) return;
      activeTab = id;
      syncTabButtons();
      applyTabPanels();
      syncFilterAsidesVisibility();
      try {
        localStorage.setItem(TAB_LS, id);
      } catch (e) {}
      try {
        var tail = "#" + id;
        if (window.location.hash !== tail) {
          history.replaceState(null, "", window.location.pathname + window.location.search + tail);
        }
      } catch (e2) {}
    });
  });

  syncTabButtons();
  applyTabPanels();
  syncFilterAsidesVisibility();

  var chgCompareTpl = rootCfg.changelogCompareUrlTpl;
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

    var chgTableBody = document.querySelector("#gc-hist-chg-table tbody");
    var compareModal = document.getElementById("gc-hist-chg-compare-modal");
    var compareClose = document.getElementById("gc-hist-chg-compare-close");
    var compareBackdrop = compareModal && compareModal.querySelector(".task-queue-compare-modal__backdrop");
    var compareMeta = document.getElementById("gc-hist-chg-compare-meta");
    var compareMissing = document.getElementById("gc-hist-chg-compare-missing");
    var compareTbody = document.getElementById("gc-hist-chg-diff-tbody");
    var compareOpen = false;
    var compareLoadSeq = 0;

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
      var seq = ++compareLoadSeq;
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
          var j = x.j || {};
          compareMeta.textContent =
            (j.entity_type || "") +
            " · " +
            (j.external_name || "") +
            " · " +
            (j.action || "") +
            " · changelog #" +
            (j.changelog_id != null ? j.changelog_id : entryId);
          if (compareMissing) {
            var lm = !!j.left_missing;
            var rm = !!j.right_missing;
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
          var rows = j.rows || [];
          var histDiffHtml = rows
            .map(function (row) {
              var lc = row.left_class || "eq";
              var rc = row.right_class || "eq";
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
            if (window.gcTableSort && compareTbody) {
              var diffTable = compareTbody.closest("table");
              if (diffTable) window.gcTableSort.bindTable(diffTable);
            }
            if (compareClose) compareClose.focus();
          }
          var wrapHistDiff = document.createElement("tbody");
          wrapHistDiff.innerHTML = histDiffHtml;
          var histDiffNodes = Array.prototype.slice.call(wrapHistDiff.children);
          compareTbody.innerHTML = "";
          var lazyHistDiff = window.gcTableLazy;
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
        var tr = e.target.closest("tr[data-changelog-id]");
        if (!tr) return;
        var id = parseInt(tr.getAttribute("data-changelog-id"), 10);
        if (isNaN(id)) return;
        openChgCompareModal(id);
      });
    }
  }

  var outCompareTpl = rootCfg.completedCompareUrlTpl;
  if (outCompareTpl) {
    var outTableBody = document.querySelector("#gc-hist-out-table tbody");
    var outCompareModal = document.getElementById("gc-hist-out-compare-modal");
    var outCompareClose = document.getElementById("gc-hist-out-compare-close");
    var outCompareBackdrop =
      outCompareModal && outCompareModal.querySelector(".task-queue-compare-modal__backdrop");
    var outCompareMeta = document.getElementById("gc-hist-out-compare-meta");
    var outCompareMissing = document.getElementById("gc-hist-out-compare-missing");
    var outCompareOutcomeBanner = document.getElementById(
      "gc-hist-out-compare-outcome-banner"
    );
    var outCompareTbody = document.getElementById("gc-hist-out-diff-tbody");
    var outCompareTitle = document.getElementById("gc-hist-out-compare-title");
    var outDiffThLeft = document.getElementById("gc-hist-out-diff-th-left");
    var outDiffThRight = document.getElementById("gc-hist-out-diff-th-right");
    var outCompareOpen = false;
    var outCompareLoadSeq = 0;

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
      var seq = ++outCompareLoadSeq;
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
          var j = x.j || {};
          var meta =
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
          var rows = j.rows || [];
          var diffHtml = rows
            .map(function (row) {
              var lc = row.left_class || "eq";
              var rc = row.right_class || "eq";
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
            if (window.gcTableSort && outCompareTbody) {
              var diffTable = outCompareTbody.closest("table");
              if (diffTable) window.gcTableSort.bindTable(diffTable);
            }
            if (outCompareClose) outCompareClose.focus();
          }
          var wrapOut = document.createElement("tbody");
          wrapOut.innerHTML = diffHtml;
          var outNodes = Array.prototype.slice.call(wrapOut.children);
          outCompareTbody.innerHTML = "";
          var lazyOut = window.gcTableLazy;
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
        var tr = e.target.closest("tr[data-completed-id]");
        if (!tr) return;
        var id = parseInt(tr.getAttribute("data-completed-id"), 10);
        if (isNaN(id)) return;
        openOutCompareModal(id);
      });
    }
  }

  var syncDetailsTpl = rootCfg.syncRunDetailsUrlTpl;
  if (syncDetailsTpl) {
    function syncRunDetailsUrl(runId) {
      return syncDetailsTpl.split("__RUN_ID__").join(String(runId));
    }

    function groupSyncDetailByFirewall(items) {
      var buckets = [];
      var indexByFw = {};
      (items || []).forEach(function (it) {
        var fid = it.firewall_id;
        var k = String(fid);
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

    var syncTableBody = document.querySelector("#gc-hist-sync-table tbody");
    var syncDetailModal = document.getElementById("gc-hist-sync-detail-modal");
    var syncDetailClose = document.getElementById("gc-hist-sync-detail-close");
    var syncDetailBackdrop =
      syncDetailModal && syncDetailModal.querySelector(".task-queue-compare-modal__backdrop");
    var syncDetailMeta = document.getElementById("gc-hist-sync-detail-meta");
    var syncDetailBody = document.getElementById("gc-hist-sync-detail-body");
    var syncDetailOpen = false;
    var syncDetailLoadSeq = 0;

    function closeSyncDetailModal() {
      if (!syncDetailModal || !syncDetailOpen) return;
      syncDetailOpen = false;
      syncDetailModal.hidden = true;
      syncDetailModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function renderSyncDetailSections(byAction) {
      if (!syncDetailBody) return;
      var order = [
        { key: "added", title: "Added" },
        { key: "changed", title: "Changed" },
        { key: "deleted", title: "Deleted" },
      ];
      var parts = [];
      order.forEach(function (sec) {
        var items = (byAction && byAction[sec.key]) || [];
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
      var seq = ++syncDetailLoadSeq;
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
          var j = x.j || {};
          var r0 = j.run || {};
          var bits = [];
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
          var fws = j.firewalls || [];
          var ba = j.by_action || {};
          var detailTotal =
            (ba.added || []).length + (ba.changed || []).length + (ba.deleted || []).length;
          var note = "";
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
        var tr = e.target.closest("tr[data-sync-run-id]");
        if (!tr) return;
        var rid = (tr.getAttribute("data-sync-run-id") || "").trim();
        if (!rid) return;
        openSyncDetailModal(rid);
      });
    }
  }
})();
