  (function () {
    var SYNC_CATALOG = {{ sync_entity_catalog | tojson }};
    var LS_KEY_SYNC = "ground-control-fw-sync-entities-v1";
    var gcFwFlyoutSyncUrl = "";
    var GC_DELETE_BATCH_URL = {{ url_firewall_delete_batch | tojson }};
    var GC_CACHED_SYNC_TYPES_URL = {{ request.url_for('api_firewalls_cached_sync_entity_types') | tojson }};
    var COLS = [
      { id: "name", label: "Name" },
      { id: "description", label: "Description" },
      { id: "host", label: "Host" },
      { id: "port", label: "Port" },
      { id: "user", label: "User" },
      { id: "device_hostname", label: "Device hostname" },
      { id: "serial", label: "Serial number" },
      { id: "model", label: "Model" },
      { id: "firmware_version", label: "Firmware" },
      { id: "tls", label: "TLS verify" },
      { id: "monitor", label: "Monitor" },
      { id: "sync", label: "Sync", defaultHidden: true },
    ];
    var LS_KEY = "ground-control-fw-columns-v1";

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function loadColVis() {
      var d = {};
      COLS.forEach(function (c) {
        d[c.id] = c.defaultHidden ? false : true;
      });
      try {
        var raw = localStorage.getItem(LS_KEY);
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

    function persistColVis(vis) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(vis));
      } catch (e) {}
    }

    function applyColVis(vis) {
      COLS.forEach(function (c) {
        var on = !!vis[c.id];
        document.querySelectorAll('[data-gc-col="' + c.id + '"]').forEach(function (el) {
          el.classList.toggle("gc-col-hidden", !on);
        });
      });
    }

    function syncFilterEmptyColspan() {
      var table = document.getElementById("gc-fw-table");
      var cell = document.querySelector("#gc-fw-filter-empty td");
      var ph = document.querySelector(".gc-fw-placeholder-row td");
      if (!table) return;
      var n = table.querySelectorAll("thead th").length;
      if (cell) cell.setAttribute("colspan", String(n));
      if (ph) ph.setAttribute("colspan", String(n));
    }

    var colVis = loadColVis();
    applyColVis(colVis);
    syncFilterEmptyColspan();

    var filtersDrawerEl = document.getElementById("gc-fw-filters-drawer");

    function loadSyncEntityPrefs() {
      var d = {};
      (SYNC_CATALOG || []).forEach(function (x) {
        d[x.id] = true;
      });
      try {
        var raw = localStorage.getItem(LS_KEY_SYNC);
        if (raw) {
          var o = JSON.parse(raw);
          if (o && typeof o === "object") {
            (SYNC_CATALOG || []).forEach(function (x) {
              if (Object.prototype.hasOwnProperty.call(o, x.id)) d[x.id] = !!o[x.id];
            });
          }
        }
      } catch (e) {}
      return d;
    }

    function persistSyncEntityPrefs(prefs) {
      try {
        localStorage.setItem(LS_KEY_SYNC, JSON.stringify(prefs));
      } catch (e) {}
    }

    function getEnabledSyncEntityIds() {
      var p = loadSyncEntityPrefs();
      var out = [];
      (SYNC_CATALOG || []).forEach(function (x) {
        if (p[x.id]) out.push(x.id);
      });
      return out;
    }

    function mountGcFwSyncFacetBlock() {
      if (!filtersDrawerEl || !SYNC_CATALOG || !SYNC_CATALOG.length) return;
      var id = "gc-fw-sync-facet-block";
      var prev = document.getElementById(id);
      if (prev) prev.remove();
      var wrap = document.createElement("div");
      wrap.id = id;
      var showSearch = SYNC_CATALOG.length >= 8;
      var opts = (SYNC_CATALOG || [])
        .map(function (x) {
          return (
            '<label class="filter-opt" data-gc-facet-opt title="' +
            escapeHtml(x.label) +
            '"><input type="checkbox" data-gc-fw-sync-facet="' +
            escapeHtml(x.id) +
            '" /><span>' +
            escapeHtml(x.label) +
            "</span></label>"
          );
        })
        .join("");
      wrap.innerHTML =
        '<div class="filter-group" data-gc-fw-sync-facet-root>' +
        '<button type="button" class="filter-group__head" aria-expanded="false">' +
        "<span>Sync</span>" +
        '<span class="filter-group__chev" aria-hidden="true">▼</span>' +
        "</button>" +
        '<div class="filter-group__body">' +
        '<p class="gc-fw-sync-facet-hint muted">Matches the Sync column: types enabled in the edit panel (same list as the pill tags).</p>' +
        '<div class="filter-group__facet-search"' +
        (showSearch ? "" : " hidden") +
        '><input type="search" class="filter-group__facet-search-input" placeholder="Search types…" autocomplete="off" aria-label="Search sync types" id="gc-fw-sync-facet-search" /></div>' +
        opts +
        "</div></div>";
      filtersDrawerEl.insertBefore(wrap, filtersDrawerEl.firstChild);
      var root = wrap.querySelector("[data-gc-fw-sync-facet-root]");
      var head = root && root.querySelector(".filter-group__head");
      if (head && head.dataset.gcFwSyncFacetHeadBound !== "1") {
        head.dataset.gcFwSyncFacetHeadBound = "1";
        head.addEventListener("click", function () {
          var g = head.closest(".filter-group");
          if (!g) return;
          var open = g.classList.toggle("is-open");
          head.setAttribute("aria-expanded", open ? "true" : "false");
        });
      }
      var searchIn = document.getElementById("gc-fw-sync-facet-search");
      if (searchIn && searchIn.dataset.gcFwSyncFacetSearchBound !== "1") {
        searchIn.dataset.gcFwSyncFacetSearchBound = "1";
        searchIn.addEventListener("input", function () {
          var q = (searchIn.value || "").trim().toLowerCase();
          wrap.querySelectorAll("[data-gc-facet-opt]").forEach(function (lab) {
            var t = (lab.textContent || "").trim().toLowerCase();
            lab.style.display = !q || t.indexOf(q) !== -1 ? "" : "none";
          });
        });
      }
    }

    /** OR-match: row matches if its Sync column (enabled sync prefs) includes any checked facet type. */
    function syncColumnFacetRowMatches(tr) {
      var root = document.getElementById("gc-fw-sync-facet-block");
      if (!root) return true;
      var checked = root.querySelectorAll("input[data-gc-fw-sync-facet]:checked");
      if (!checked.length) return true;
      var prefs = loadSyncEntityPrefs();
      for (var i = 0; i < checked.length; i++) {
        var eid = checked[i].getAttribute("data-gc-fw-sync-facet");
        if (eid && prefs[eid]) return true;
      }
      return false;
    }

    function refreshInventorySyncColumn() {
      var prefs = loadSyncEntityPrefs();
      var extra = [];
      var labels = [];
      (SYNC_CATALOG || []).forEach(function (x) {
        if (prefs[x.id]) {
          labels.push(String(x.label));
          extra.push(String(x.label).toLowerCase());
          extra.push(String(x.id).toLowerCase());
        }
      });
      var extraStr = extra.join(" ");
      function syncPillHtml(t) {
        return '<span class="gc-sync-pill">' + escapeHtml(String(t)) + "</span>";
      }
      document.querySelectorAll("#gc-fw-tbody tr.gc-fw-data-row").forEach(function (tr) {
        var td = tr.querySelector('td[data-gc-col="sync"]');
        if (!td) return;
        if (
          labels.length >= 2 &&
          window.gcTableListCellPreviewHtml &&
          window.gcTableBindListCell
        ) {
          var fresh = document.createElement("td");
          fresh.setAttribute("data-gc-col", "sync");
          td.classList.forEach(function (cls) {
            fresh.classList.add(cls);
          });
          td.parentNode.replaceChild(fresh, td);
          td = fresh;
          td.classList.add("gc-fw-sync-pills");
          td.innerHTML = window.gcTableListCellPreviewHtml(labels, function (lab) {
            return syncPillHtml(lab);
          });
          window.gcTableBindListCell(td, labels.slice(), "Sync", function (lab) {
            return syncPillHtml(lab);
          });
          td.classList.add("gc-hs-multi-pills");
        } else {
          td.textContent = "";
          td.classList.remove("gc-table-cell--list", "gc-hs-multi-pills");
          td.removeAttribute("role");
          td.removeAttribute("tabindex");
          td.removeAttribute("aria-label");
          td.classList.add("gc-fw-sync-pills");
          (SYNC_CATALOG || []).forEach(function (x) {
            if (!prefs[x.id]) return;
            var span = document.createElement("span");
            span.className = "gc-sync-pill";
            span.textContent = x.label;
            td.appendChild(span);
          });
        }
        var base = tr.getAttribute("data-search-base") || "";
        tr.setAttribute("data-search", (base + " " + extraStr).trim().toLowerCase());
      });
    }

    function firewallRowFacetMap(tr) {
      return {
        name: (tr.getAttribute("data-fw-name") || "").trim(),
        description: (tr.getAttribute("data-fw-description") || "").trim(),
        host: (tr.getAttribute("data-fw-host") || "").trim(),
        port: String(tr.getAttribute("data-fw-port") || "").trim(),
        user: (tr.getAttribute("data-fw-username") || "").trim(),
        tls: tr.getAttribute("data-tls") || "",
        monitor: tr.getAttribute("data-fw-monitor") === "1" ? "yes" : "no",
      };
    }

    function rebuildFirewallFacets(done) {
      if (!filtersDrawerEl || !window.gcTableFacets) {
        if (typeof done === "function") done();
        return;
      }
      var facetCols = COLS.filter(function (c) {
        return c.id !== "sync";
      }).map(function (c) {
        var lab = c.label;
        if (typeof window.gcTableColumnDisplayLabel === "function") {
          lab = window.gcTableColumnDisplayLabel(lab);
        }
        return { id: c.id, label: lab };
      });
      var rowEls = Array.prototype.slice.call(document.querySelectorAll("#gc-fw-tbody tr.gc-fw-data-row"));
      var maps = rowEls.map(firewallRowFacetMap);
      function finishFirewallFacetRebuild() {
        window.gcTableFacets.rebuild(filtersDrawerEl, facetCols, maps, "gc-fw");
        mountGcFwSyncFacetBlock();
        if (typeof done === "function") done();
      }
      var lazy = window.gcTableLazy;
      if (!lazy || typeof lazy.forEachChunked !== "function" || rowEls.length <= lazy.DEFAULT_THRESHOLD) {
        rowEls.forEach(function (tr, i) {
          window.gcTableFacets.setRowFacets(tr, maps[i]);
        });
        finishFirewallFacetRebuild();
        return;
      }
      lazy.forEachChunked(
        rowEls,
        lazy.DEFAULT_CHUNK,
        function (tr, i) {
          window.gcTableFacets.setRowFacets(tr, maps[i]);
        },
        finishFirewallFacetRebuild,
      );
    }

    function facetAppliedCount() {
      var n = filtersDrawerEl && window.gcTableFacets ? window.gcTableFacets.appliedCount(filtersDrawerEl) : 0;
      var syncRoot = document.getElementById("gc-fw-sync-facet-block");
      if (syncRoot) {
        n += syncRoot.querySelectorAll("input[data-gc-fw-sync-facet]:checked").length;
      }
      return n;
    }

    function updateFacetChrome() {
      var n = facetAppliedCount();
      var head = document.getElementById("gc-fw-facet-head-actions");
      var countEl = document.getElementById("gc-fw-facet-count");
      var resetBtn = document.getElementById("gc-fw-facet-reset");
      if (!head || !countEl || !resetBtn) return;
      if (n > 0) {
        head.hidden = false;
        countEl.innerHTML = '<span class="filters__facet-count-num">' + n + "</span> applied";
        resetBtn.hidden = false;
      } else {
        head.hidden = true;
        countEl.textContent = "";
        resetBtn.hidden = true;
      }
    }

    function rowMatchesFacets(tr) {
      if (!tr.classList.contains("gc-fw-data-row")) return true;
      if (!filtersDrawerEl || !window.gcTableFacets) return true;
      if (!window.gcTableFacets.rowMatches(tr, filtersDrawerEl)) return false;
      return syncColumnFacetRowMatches(tr);
    }

    function rowMatchesSearch(tr, q) {
      if (!q) return true;
      if (!tr.classList.contains("gc-fw-data-row")) return true;
      var s = tr.getAttribute("data-search") || "";
      return s.indexOf(q) !== -1;
    }

    function visibleDataRows() {
      return Array.prototype.filter.call(document.querySelectorAll("#gc-fw-tbody tr.gc-fw-data-row"), function (tr) {
        return !tr.hidden;
      });
    }

    function getSelectedIds() {
      var ids = [];
      document.querySelectorAll(".gc-fw-row-select:checked").forEach(function (cb) {
        var id = parseInt(cb.value, 10);
        if (!isNaN(id)) ids.push(id);
      });
      return ids;
    }

    function updateSelectionChrome() {
      var n = getSelectedIds().length;
      var delBtn = document.getElementById("gc-fw-delete-selected");
      if (delBtn) delBtn.disabled = n < 1;
      var all = document.getElementById("gc-fw-select-all");
      if (!all) return;
      var vis = visibleDataRows();
      var visChecked = vis.filter(function (tr) {
        return tr.querySelector(".gc-fw-row-select") && tr.querySelector(".gc-fw-row-select").checked;
      }).length;
      if (vis.length === 0) {
        all.checked = false;
        all.indeterminate = false;
      } else if (visChecked === 0) {
        all.checked = false;
        all.indeterminate = false;
      } else if (visChecked === vis.length) {
        all.checked = true;
        all.indeterminate = false;
      } else {
        all.checked = false;
        all.indeterminate = true;
      }
    }

    function applyRowFilter() {
      var q = (document.getElementById("gc-fw-search") && document.getElementById("gc-fw-search").value || "")
        .trim()
        .toLowerCase();
      var rows = document.querySelectorAll("#gc-fw-tbody tr.gc-fw-data-row");
      var place = document.querySelector("#gc-fw-tbody tr.gc-fw-placeholder-row");
      var emptyFilter = document.getElementById("gc-fw-filter-empty");
      var visible = 0;
      var totalData = rows.length;
      rows.forEach(function (tr) {
        var ok = rowMatchesFacets(tr) && rowMatchesSearch(tr, q);
        tr.hidden = !ok;
        if (ok) visible++;
      });
      if (place) place.hidden = totalData > 0;
      if (emptyFilter) {
        emptyFilter.hidden = !(totalData > 0 && visible === 0);
        syncFilterEmptyColspan();
      }
      var countEl = document.getElementById("gc-fw-count");
      if (countEl) {
        if (totalData === 0) {
          countEl.textContent = "";
        } else if (visible === totalData) {
          countEl.textContent = visible === 1 ? "1 firewall" : visible + " firewalls";
        } else {
          countEl.textContent = "Showing " + visible + " of " + totalData + " firewalls";
        }
      }
      updateSelectionChrome();
    }

    function setFiltersAsideCollapsed(collapsed) {
      var aside = document.getElementById("gc-fw-filters-aside");
      var drawer = document.getElementById("gc-fw-filters-drawer");
      var btn = document.getElementById("gc-fw-filters-toggle");
      if (!aside || !drawer || !btn) return;
      aside.classList.toggle("filters--collapsed", collapsed);
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      if (collapsed) drawer.setAttribute("hidden", "");
      else drawer.removeAttribute("hidden");
    }

    document.getElementById("gc-fw-filters-toggle") &&
      document.getElementById("gc-fw-filters-toggle").addEventListener("click", function () {
        var aside = document.getElementById("gc-fw-filters-aside");
        var collapsed = aside && aside.classList.contains("filters--collapsed");
        setFiltersAsideCollapsed(!collapsed);
      });

    document.getElementById("gc-fw-facet-reset") &&
      document.getElementById("gc-fw-facet-reset").addEventListener("click", function () {
        if (filtersDrawerEl && window.gcTableFacets) window.gcTableFacets.reset(filtersDrawerEl, "gc-fw");
        var sroot = document.getElementById("gc-fw-sync-facet-block");
        if (sroot) {
          sroot.querySelectorAll("input[data-gc-fw-sync-facet]").forEach(function (cb) {
            cb.checked = false;
          });
        }
        updateFacetChrome();
        applyRowFilter();
      });

    var filtersAsideEl = document.getElementById("gc-fw-filters-aside");
    if (filtersAsideEl && window.gcTableFacets) {
      window.gcTableFacets.bindAside(
        filtersAsideEl,
        function () {
          updateFacetChrome();
          applyRowFilter();
        },
        "gc-fw",
      );
      filtersAsideEl.addEventListener("change", function (e) {
        var t = e.target;
        if (t && t.matches && t.matches("input[data-gc-fw-sync-facet]")) {
          var g = t.closest(".filter-group");
          if (g && t.checked) g.classList.add("is-open");
          updateFacetChrome();
          applyRowFilter();
        }
      });
    }

    var searchIn = document.getElementById("gc-fw-search");
    if (searchIn) {
      searchIn.addEventListener("input", applyRowFilter);
    }

    document.getElementById("gc-fw-select-all") &&
      document.getElementById("gc-fw-select-all").addEventListener("change", function () {
        var on = document.getElementById("gc-fw-select-all").checked;
        visibleDataRows().forEach(function (tr) {
          var cb = tr.querySelector(".gc-fw-row-select");
          if (cb) cb.checked = on;
        });
        updateSelectionChrome();
      });

    document.getElementById("gc-fw-tbody") &&
      document.getElementById("gc-fw-tbody").addEventListener("change", function (e) {
        if (e.target.classList && e.target.classList.contains("gc-fw-row-select")) updateSelectionChrome();
      });

    rebuildFirewallFacets(function () {
      refreshInventorySyncColumn();
      applyRowFilter();
      updateFacetChrome();
    });

    function filterColMenuList() {
      var q = (document.getElementById("gc-fw-cols-filter") && document.getElementById("gc-fw-cols-filter").value || "")
        .trim()
        .toLowerCase();
      var list = document.getElementById("gc-fw-cols-list");
      if (!list) return;
      list.querySelectorAll("li[data-col-label]").forEach(function (li) {
        var lab = (li.dataset.colLabel || "").toLowerCase();
        li.hidden = q !== "" && lab.indexOf(q) === -1;
      });
    }

    function buildColMenuList() {
      var list = document.getElementById("gc-fw-cols-list");
      if (!list) return;
      list.innerHTML = COLS.map(function (c) {
        return (
          '<li class="toolbar__cols-item" data-col-id="' +
          escapeHtml(c.id) +
          '" data-col-label="' +
          escapeHtml(c.label.toLowerCase()) +
          '">' +
          '<label class="toolbar__cols-label">' +
          '<input type="checkbox" data-gc-fw-col="' +
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

    function positionGcFwColsDropdown() {
      var btn = document.getElementById("gc-fw-cols-trigger");
      var panel = document.getElementById("gc-fw-cols-panel");
      var modal = document.getElementById("gc-fw-cols-modal");
      if (!btn || !panel || !modal || modal.hidden) return;
      panel.style.maxHeight = "";
      var r = btn.getBoundingClientRect();
      var gap = 6;
      var margin = 8;
      var pw = panel.offsetWidth || Math.min(380, window.innerWidth - 2 * margin);
      var left = r.left;
      if (left + pw > window.innerWidth - margin) left = window.innerWidth - margin - pw;
      left = Math.max(margin, left);
      var topBelow = r.bottom + gap;
      panel.style.left = left + "px";
      panel.style.top = topBelow + "px";
      var after = panel.getBoundingClientRect();
      if (after.bottom > window.innerHeight - margin) {
        var aboveTop = r.top - gap - after.height;
        if (aboveTop >= margin) panel.style.top = aboveTop + "px";
        else {
          panel.style.top = margin + "px";
          panel.style.maxHeight = Math.max(120, window.innerHeight - 2 * margin) + "px";
        }
      }
    }

    function setColPanelOpen(open) {
      var modal = document.getElementById("gc-fw-cols-modal");
      var btn = document.getElementById("gc-fw-cols-trigger");
      var panel = document.getElementById("gc-fw-cols-panel");
      if (!modal || !btn) return;
      modal.hidden = !open;
      modal.setAttribute("aria-hidden", open ? "false" : "true");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open && panel) {
        panel.style.top = "";
        panel.style.left = "";
        panel.style.maxHeight = "";
      }
      if (open) {
        requestAnimationFrame(function () {
          requestAnimationFrame(positionGcFwColsDropdown);
        });
      }
    }

    buildColMenuList();
    var colsTrigger = document.getElementById("gc-fw-cols-trigger");
    var colsModal = document.getElementById("gc-fw-cols-modal");
    var colsPanel = document.getElementById("gc-fw-cols-panel");
    var colsFilter = document.getElementById("gc-fw-cols-filter");
    var colsList = document.getElementById("gc-fw-cols-list");
    var colsClose = document.getElementById("gc-fw-cols-close");

    function openColsFromTrigger() {
      var willOpen = colsModal.hidden;
      setColPanelOpen(willOpen);
      if (willOpen) {
        buildColMenuList();
        colsFilter && colsFilter.focus();
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
    colsFilter &&
      colsFilter.addEventListener("input", function () {
        filterColMenuList();
      });
    colsClose &&
      colsClose.addEventListener("click", function () {
        setColPanelOpen(false);
        colsTrigger && colsTrigger.focus();
      });
    colsModal &&
      colsModal.querySelector(".fw-cols-modal__backdrop") &&
      colsModal.querySelector(".fw-cols-modal__backdrop").addEventListener("click", function () {
        setColPanelOpen(false);
        colsTrigger && colsTrigger.focus();
      });
    colsList &&
      colsList.addEventListener("change", function (e) {
        var cb = e.target.closest("input[data-gc-fw-col]");
        if (!cb) return;
        var id = cb.getAttribute("data-gc-fw-col");
        if (!id || !Object.prototype.hasOwnProperty.call(colVis, id)) return;
        colVis[id] = cb.checked;
        var n = 0;
        COLS.forEach(function (c) {
          if (colVis[c.id]) n++;
        });
        if (n < 1) {
          cb.checked = true;
          colVis[id] = true;
          return;
        }
        persistColVis(colVis);
        applyColVis(colVis);
        syncFilterEmptyColspan();
        applyRowFilter();
      });
    document.addEventListener("mousedown", function (e) {
      if (!colsModal || colsModal.hidden) return;
      if ((colsTrigger && colsTrigger.contains(e.target)) || (colsPanel && colsPanel.contains(e.target))) return;
      setColPanelOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && colsModal && !colsModal.hidden) {
        setColPanelOpen(false);
        colsTrigger && colsTrigger.focus();
      }
      if (e.key === "Escape" && editFlyout && !editFlyout.hidden) {
        closeEditFlyout();
      }
    });
    function repositionColsIfOpen() {
      if (colsModal && !colsModal.hidden) positionGcFwColsDropdown();
    }
    window.addEventListener("resize", repositionColsIfOpen);
    window.addEventListener("scroll", repositionColsIfOpen, true);

    var addModal = document.getElementById("add-firewall-modal");
    var addForm = document.getElementById("add-firewall-form");
    var openBtn = document.getElementById("open-add-firewall");
    var cancelBtn = document.getElementById("cancel-add-firewall");
    if (openBtn && addModal) {
      openBtn.addEventListener("click", function () {
        if (addForm) addForm.reset();
        var v = addForm && addForm.querySelector('input[name="verify_ssl"]');
        if (v) v.checked = true;
        var mon = addForm && addForm.querySelector('input[name="monitor_enabled"]');
        if (mon) mon.checked = true;
        var p = addForm && addForm.querySelector('input[name="port"]');
        if (p) p.value = "4444";
        addModal.showModal();
      });
    }
    if (cancelBtn && addModal) {
      cancelBtn.addEventListener("click", function () {
        addModal.close();
      });
    }
    if (addModal) {
      addModal.addEventListener("click", function (e) {
        if (e.target === addModal) addModal.close();
      });
    }

    var editFlyout = document.getElementById("gc-fw-edit-flyout");
    var editForm = document.getElementById("edit-firewall-form");
    var cancelEdit = document.getElementById("cancel-edit-firewall");
    var flyoutClose = document.getElementById("gc-fw-edit-flyout-close");
    var flyoutBackdrop = editFlyout && editFlyout.querySelector(".gc-if-flyout__backdrop");
    var flyoutPanel = editFlyout && editFlyout.querySelector(".gc-if-flyout__panel");

    function closeEditFlyout() {
      if (!editFlyout) return;
      editFlyout.hidden = true;
      editFlyout.setAttribute("aria-hidden", "true");
      gcFwFlyoutSyncUrl = "";
    }

    function openEditFlyout(tr) {
      if (!editFlyout || !editForm) return;
      var id = tr.getAttribute("data-fw-id");
      if (!id) return;
      gcFwFlyoutSyncUrl = tr.getAttribute("data-fw-sync-url") || "";
      var idField = document.getElementById("edit-fw-id");
      if (idField) idField.value = id;
      document.getElementById("edit-fw-name").value = tr.getAttribute("data-fw-name") || "";
      document.getElementById("edit-fw-description").value = tr.getAttribute("data-fw-description") || "";
      document.getElementById("edit-fw-host").value = tr.getAttribute("data-fw-host") || "";
      document.getElementById("edit-fw-port").value = tr.getAttribute("data-fw-port") || "4444";
      document.getElementById("edit-fw-username").value = tr.getAttribute("data-fw-username") || "";
      document.getElementById("edit-fw-password").value = "";
      document.getElementById("edit-fw-verify_ssl").checked = tr.getAttribute("data-fw-verify") === "1";
      var monEl = document.getElementById("edit-fw-monitor_enabled");
      if (monEl) monEl.checked = tr.getAttribute("data-fw-monitor") === "1";
      editFlyout.hidden = false;
      editFlyout.setAttribute("aria-hidden", "false");
      if (flyoutPanel) {
        try {
          flyoutPanel.focus();
        } catch (e2) {}
      }
    }

    function bindFwFlyoutResize(root) {
      var panel = root.querySelector(".gc-if-flyout__panel");
      var handle = root.querySelector(".gc-if-flyout__resize");
      if (!panel || !handle || handle.dataset.gcFwResizeBound === "1") return;
      handle.dataset.gcFwResizeBound = "1";
      handle.addEventListener("mousedown", function (e) {
        e.preventDefault();
        var startX = e.clientX;
        var startW = panel.getBoundingClientRect().width;
        var maxW = Math.min(720, window.innerWidth - 24);
        function onMove(e2) {
          var w = startW + (startX - e2.clientX);
          w = Math.max(280, Math.min(maxW, w));
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
    if (editFlyout) bindFwFlyoutResize(editFlyout);

    if (cancelEdit) {
      cancelEdit.addEventListener("click", closeEditFlyout);
    }
    if (flyoutClose) {
      flyoutClose.addEventListener("click", closeEditFlyout);
    }
    if (flyoutBackdrop) {
      flyoutBackdrop.addEventListener("click", closeEditFlyout);
    }

    function buildSyncToggleRows() {
      var root = document.getElementById("gc-fw-sync-toggles");
      if (!root || !SYNC_CATALOG || !SYNC_CATALOG.length) return;
      var prefs = loadSyncEntityPrefs();
      root.innerHTML = (SYNC_CATALOG || [])
        .map(function (x) {
          var on = !!prefs[x.id];
          return (
            '<div class="gc-if-flyout__field gc-if-flyout__field--toggle gc-fw-sync-toggles__row">' +
            '<label class="gc-if-flyout__toggle-label">' +
            '<input type="checkbox" class="gc-fw-sync-entity-cb" data-sync-entity-id="' +
            escapeHtml(x.id) +
            '" ' +
            (on ? "checked" : "") +
            " />" +
            "<span>" +
            escapeHtml(x.label) +
            "</span>" +
            "</label>" +
            "</div>"
          );
        })
        .join("");
      root.querySelectorAll(".gc-fw-sync-entity-cb").forEach(function (cb) {
        cb.addEventListener("change", function () {
          var pr = loadSyncEntityPrefs();
          var eid = cb.getAttribute("data-sync-entity-id");
          if (eid) pr[eid] = cb.checked;
          persistSyncEntityPrefs(pr);
          refreshInventorySyncColumn();
          applyRowFilter();
        });
      });
    }
    buildSyncToggleRows();

    function configSyncBannerMessage(res) {
      var body = res.body || {};
      if (res.status === 404) return { ok: false, text: "Firewall not found." };
      if (res.status === 202 && body.accepted) {
        return {
          ok: true,
          text:
            "Configuration sync started in the background. You can keep navigating; refresh this list when it finishes.",
        };
      }
      if (body.skipped) return { ok: false, text: body.message || "Nothing selected." };
      if (body.ok) {
        var a = body.added || 0;
        var c = body.changed || 0;
        var d = body.deleted || 0;
        if (a + c + d === 0) return { ok: true, text: "Sync finished — no changes." };
        return {
          ok: true,
          text: "Sync finished — " + a + " added, " + c + " updated, " + d + " removed.",
        };
      }
      return { ok: false, text: body.error || body.detail || "Sync failed." };
    }

    function gcDispatchConfigCacheSynced(fwId) {
      var n = parseInt(fwId, 10);
      if (isNaN(n) || n < 1) return;
      try {
        document.dispatchEvent(
          new CustomEvent("gc-config-cache-synced", { detail: { firewall_ids: [n] } }),
        );
      } catch (e) {}
    }

    function rebuildFwInventorySearchAfterSync(tr, cachedTypesArr) {
      var prefs = loadSyncEntityPrefs();
      var tls = tr.getAttribute("data-tls") || "no";
      var mon = tr.getAttribute("data-fw-monitor") === "1" ? "yes" : "no";
      var dev = (tr.getAttribute("data-fw-device-display") || "").trim();
      var cacheStr = (cachedTypesArr || []).join(" ");
      var base = [
        tr.getAttribute("data-fw-name") || "",
        tr.getAttribute("data-fw-description") || "",
        tr.getAttribute("data-fw-host") || "",
        String(tr.getAttribute("data-fw-port") || ""),
        tr.getAttribute("data-fw-username") || "",
        tls,
        mon,
        dev,
        cacheStr,
      ]
        .join(" ")
        .trim()
        .toLowerCase();
      tr.setAttribute("data-fw-sync-cached", cacheStr);
      tr.setAttribute("data-search-base", base);
      var extra = [];
      (SYNC_CATALOG || []).forEach(function (x) {
        if (prefs[x.id]) {
          extra.push(String(x.label).toLowerCase());
          extra.push(String(x.id).toLowerCase());
        }
      });
      tr.setAttribute("data-search", (base + " " + extra.join(" ")).trim().toLowerCase());
    }

    function refreshInventoryTableAfterCacheSync(ids) {
      if (!GC_CACHED_SYNC_TYPES_URL || !ids || !ids.length) return;
      var need = ids.filter(function (id) {
        return document.querySelector('#gc-fw-tbody tr.gc-fw-data-row[data-fw-id="' + id + '"]');
      });
      if (!need.length) return;
      var url = GC_CACHED_SYNC_TYPES_URL + "?firewall_ids=" + encodeURIComponent(need.join(","));
      fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (map) {
          need.forEach(function (fid) {
            var tr = document.querySelector('#gc-fw-tbody tr.gc-fw-data-row[data-fw-id="' + fid + '"]');
            if (!tr) return;
            var types = map[String(fid)] || [];
            rebuildFwInventorySearchAfterSync(tr, types);
          });
          refreshInventorySyncColumn();
          rebuildFirewallFacets(function () {
            applyRowFilter();
            updateFacetChrome();
          });
        })
        .catch(function () {});
    }

    function configSyncUseBatchApi() {
      return (
        typeof window.gcGlobalBannerSyncBegin === "function" &&
        typeof window.gcGlobalBannerSyncEnd === "function"
      );
    }

    var CONFIG_SYNC_PROGRESS_MSG = "Syncing configuration cache from the firewall…";

    function runConfigSync(syncUrl, busyBtn) {
      if (!syncUrl) return;
      var batch = configSyncUseBatchApi();
      var bid = batch ? window.gcGlobalBannerSyncBegin(CONFIG_SYNC_PROGRESS_MSG) : 0;
      var ids = getEnabledSyncEntityIds();
      if (ids.length < 1) {
        if (batch) window.gcGlobalBannerSyncEnd(bid, false, "Turn on at least one object type in the panel.");
        else if (typeof window.gcGlobalBannerShowResult === "function") {
          window.gcGlobalBannerShowResult(false, "Turn on at least one object type in the panel.");
        }
        return;
      }
      if (busyBtn) {
        busyBtn.disabled = true;
        if (busyBtn.classList.contains("btn-icon")) busyBtn.classList.add("btn-icon--busy");
      }
      fetch(syncUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "Ground-Control",
        },
        body: JSON.stringify({ entities: ids }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, status: r.status, body: j };
          });
        })
        .then(function (res) {
          if (busyBtn) {
            busyBtn.disabled = false;
            busyBtn.classList.remove("btn-icon--busy");
          }
          var msg = configSyncBannerMessage(res);
          var body = res.body || {};
          if (res.status === 202 && body.accepted) {
            if (typeof window.gcGlobalBannerTrackBackgroundSync === "function") {
              window.gcGlobalBannerTrackBackgroundSync(msg.text);
            } else if (batch) {
              window.gcGlobalBannerSyncEnd(bid, true, msg.text);
            } else if (typeof window.gcGlobalBannerShowResult === "function") {
              window.gcGlobalBannerShowResult(true, msg.text);
            }
          } else {
            if (batch) window.gcGlobalBannerSyncEnd(bid, msg.ok, msg.text);
            else if (typeof window.gcGlobalBannerShowResult === "function") {
              window.gcGlobalBannerShowResult(msg.ok, msg.text);
            }
            if (msg.ok && !body.skipped && res.status !== 202) {
              var ef = document.getElementById("edit-fw-id");
              if (ef && ef.value) gcDispatchConfigCacheSynced(ef.value);
            }
          }
        })
        .catch(function () {
          if (busyBtn) {
            busyBtn.disabled = false;
            busyBtn.classList.remove("btn-icon--busy");
          }
          if (batch) window.gcGlobalBannerSyncEnd(bid, false, "Request failed.");
          else if (typeof window.gcGlobalBannerShowResult === "function") {
            window.gcGlobalBannerShowResult(false, "Request failed.");
          }
        });
    }

    var flyoutSyncBtn = document.getElementById("gc-fw-flyout-sync-btn");
    if (flyoutSyncBtn) {
      flyoutSyncBtn.addEventListener("click", function () {
        runConfigSync(gcFwFlyoutSyncUrl, flyoutSyncBtn);
      });
    }

    if (editForm) {
      editForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var idField = document.getElementById("edit-fw-id");
        if (!idField || !String(idField.value || "").trim()) {
          alert("Missing firewall id. Close and open the panel again.");
          return;
        }
        var fd = new FormData(editForm);
        var submitBtn = editForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        fetch(editForm.getAttribute("action") || {{ url_firewall_update | tojson }}, {
          method: "POST",
          body: fd,
          credentials: "same-origin",
          headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
        })
          .then(function (r) {
            return r.text().then(function (text) {
              return { ok: r.ok, status: r.status, text: text };
            });
          })
          .then(function (res) {
            if (submitBtn) submitBtn.disabled = false;
            if (res.ok) {
              try {
                var j = JSON.parse(res.text);
                if (j && j.ok) {
                  closeEditFlyout();
                  window.location.reload();
                  return;
                }
              } catch (err) {}
              closeEditFlyout();
              window.location.reload();
              return;
            }
            var msg = res.text || "";
            try {
              var j2 = JSON.parse(res.text);
              if (j2.detail) msg = typeof j2.detail === "string" ? j2.detail : JSON.stringify(j2.detail);
            } catch (err2) {}
            alert("Could not save changes (" + res.status + "). " + (msg || "").slice(0, 400));
          })
          .catch(function () {
            if (submitBtn) submitBtn.disabled = false;
            alert("Could not save changes (network error).");
          });
      });
    }

    function openEditFromRow(tr) {
      openEditFlyout(tr);
    }

    document.querySelectorAll(".gc-fw-row--clickable").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        if (e.target.closest("input, button, a, label, .td-check, .gc-table-toggle")) return;
        openEditFromRow(tr);
      });
    });

    document.querySelectorAll(".test-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-id");
        var out = document.querySelector('[data-result-for="' + id + '"]');
        if (out) {
          out.hidden = false;
          out.textContent = "Testing…";
          out.className = "test-result";
        }
        var testUrl = btn.getAttribute("data-test-url");
        if (!testUrl) return;
        fetch(testUrl, { method: "POST", credentials: "same-origin" })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, body: j };
            });
          })
          .then(function (_ref) {
            if (!out) return;
            var body = _ref.body;
            var success = _ref.ok && body.ok;
            out.textContent = body.message || (success ? "OK" : "Failed");
            out.className = "test-result " + (success ? "ok" : "err");
          })
          .catch(function () {
            if (out) {
              out.textContent = "Request failed";
              out.className = "test-result err";
            }
          });
      });
    });

    document.querySelectorAll(".gc-fw-sync-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var row = btn.closest("tr.gc-fw-data-row");
        var syncUrl = (row && row.getAttribute("data-fw-sync-url")) || btn.getAttribute("data-sync-url");
        if (!syncUrl) return;
        var batch = configSyncUseBatchApi();
        var bid = batch ? window.gcGlobalBannerSyncBegin(CONFIG_SYNC_PROGRESS_MSG) : 0;
        var ids = getEnabledSyncEntityIds();
        if (ids.length < 1) {
          if (batch) {
            window.gcGlobalBannerSyncEnd(
              bid,
              false,
              "Open the firewall panel and enable at least one sync type.",
            );
          } else if (typeof window.gcGlobalBannerShowResult === "function") {
            window.gcGlobalBannerShowResult(false, "Open the firewall panel and enable at least one sync type.");
          }
          return;
        }
        btn.classList.add("btn-icon--busy");
        btn.disabled = true;
        fetch(syncUrl, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "Ground-Control",
          },
          body: JSON.stringify({ entities: ids }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, status: r.status, body: j };
            });
          })
          .then(function (res) {
            btn.classList.remove("btn-icon--busy");
            btn.disabled = false;
            var msg = configSyncBannerMessage(res);
            var body = res.body || {};
            if (res.status === 202 && body.accepted) {
              if (typeof window.gcGlobalBannerTrackBackgroundSync === "function") {
                window.gcGlobalBannerTrackBackgroundSync(msg.text);
              } else if (batch) {
                window.gcGlobalBannerSyncEnd(bid, true, msg.text);
              } else if (typeof window.gcGlobalBannerShowResult === "function") {
                window.gcGlobalBannerShowResult(true, msg.text);
              }
            } else {
              if (batch) window.gcGlobalBannerSyncEnd(bid, msg.ok, msg.text);
              else if (typeof window.gcGlobalBannerShowResult === "function") {
                window.gcGlobalBannerShowResult(msg.ok, msg.text);
              }
              if (msg.ok && !body.skipped && row && res.status !== 202) {
                gcDispatchConfigCacheSynced(row.getAttribute("data-fw-id"));
              }
            }
          })
          .catch(function () {
            btn.classList.remove("btn-icon--busy");
            btn.disabled = false;
            if (batch) window.gcGlobalBannerSyncEnd(bid, false, "Request failed.");
            else if (typeof window.gcGlobalBannerShowResult === "function") {
              window.gcGlobalBannerShowResult(false, "Request failed.");
            }
          });
      });
    });

    document.querySelectorAll(".td-check input, .gc-fw-row-select").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    });

    var delDialog = document.getElementById("gc-fw-delete-dialog");
    var delLead = document.getElementById("gc-fw-delete-dialog-lead");
    var delConfirm = document.getElementById("gc-fw-delete-dialog-confirm");
    var delCancel = document.getElementById("gc-fw-delete-dialog-cancel");
    var delToolbar = document.getElementById("gc-fw-delete-selected");

    function closeDelDialog() {
      if (delDialog) delDialog.close();
    }

    if (delCancel && delDialog) {
      delCancel.addEventListener("click", closeDelDialog);
    }
    if (delDialog) {
      delDialog.addEventListener("click", function (e) {
        if (e.target === delDialog) closeDelDialog();
      });
    }

    if (delToolbar && delDialog && delLead && delConfirm) {
      delToolbar.addEventListener("click", function () {
        var ids = getSelectedIds();
        if (ids.length < 1) return;
        delConfirm.disabled = false;
        var n = ids.length;
        delLead.textContent =
          "Are you sure you want to delete " + n + " firewall" + (n === 1 ? "" : "s") + "? This cannot be undone.";
        delConfirm.textContent = "Delete " + n + " firewall" + (n === 1 ? "" : "s");
        delDialog.showModal();
      });
    }

    if (delConfirm) {
      delConfirm.addEventListener("click", function () {
        var ids = getSelectedIds();
        if (ids.length < 1) {
          closeDelDialog();
          return;
        }
        delConfirm.disabled = true;
        fetch(GC_DELETE_BATCH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: ids }),
        })
          .then(function (r) {
            if (r.ok) location.reload();
            else {
              delConfirm.disabled = false;
              alert("Delete failed");
            }
          })
          .catch(function () {
            delConfirm.disabled = false;
            alert("Delete failed");
          });
      });
    }

    if (typeof window.gcRegisterConfigCacheTableRefresher === "function") {
      window.gcRegisterConfigCacheTableRefresher(refreshInventoryTableAfterCacheSync);
    }
  })();