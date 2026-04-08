(function () {
  "use strict";

  var cfg = window.GC_TASK_QUEUE;
  if (!cfg) return;

  var tbody = document.getElementById("task-queue-tbody");
  var delBtn = document.getElementById("task-queue-delete-selected");
  var approveAllBtn = document.getElementById("task-queue-approve-all");
  var approveSelectedBtn = document.getElementById("task-queue-approve-selected");
  var selectAll = document.getElementById("task-queue-select-all");
  var compareRejectBtn = document.getElementById("task-queue-compare-reject");
  var compareApproveBtn = document.getElementById("task-queue-compare-approve");

  function bannerProgress(msg) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            source: "ground-control",
            type: "gc-global-banner",
            phase: "progress",
            message: msg || "",
          },
          window.location.origin,
        );
      }
    } catch (e) {}
    if (typeof window.gcGlobalBannerShowProgress === "function") {
      window.gcGlobalBannerShowProgress(msg);
    }
  }

  function bannerResult(ok, msg) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            source: "ground-control",
            type: "gc-global-banner",
            phase: "result",
            ok: ok,
            message: msg || "",
          },
          window.location.origin,
        );
      }
    } catch (e) {}
    if (typeof window.gcGlobalBannerShowResult === "function") {
      window.gcGlobalBannerShowResult(ok, msg);
    }
  }

  /** Persists across navigation via parent banner + server poll (embed posts to parent). */
  function bannerBackgroundTrack(msg) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            source: "ground-control",
            type: "gc-global-banner",
            phase: "background",
            message: msg || "",
          },
          window.location.origin,
        );
        return;
      }
    } catch (e) {}
    if (typeof window.gcGlobalBannerTrackBackgroundSync === "function") {
      window.gcGlobalBannerTrackBackgroundSync(msg);
    }
  }

  /** Always use this window's `confirm`. `parent.confirm` opens behind the task-queue dock (high z-index) and looks like a no-op. */
  function taskQueueConfirm(message) {
    return window.confirm(message);
  }

  function taskQueueDeleteUrl() {
    var u = cfg && cfg.deleteUrl;
    return u ? String(u) : "/api/task-queue/delete";
  }

  function notifyTaskQueueChanged() {
    document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
    try {
      if (
        window.parent &&
        window.parent !== window &&
        typeof window.parent.gcRefreshTaskQueueBadge === "function"
      ) {
        window.parent.gcRefreshTaskQueueBadge();
      }
    } catch (e1) {}
  }

  /** Update the row as soon as Approve is clicked so errored tasks do not look stuck during a long sync. */
  function patchTaskRowSyncStarted(row) {
    if (!row) return;
    var badge = row.querySelector(".task-queue-status-badge");
    if (badge) {
      badge.setAttribute("data-status", "sending");
      badge.textContent = "sending";
    }
    var errCell = row.querySelector('td[data-gc-col="error_message"]');
    if (errCell) errCell.textContent = "";
  }

  /** Summarize post-approval config sync (single-task object or batch array). */
  function postSyncStatusSuffix(j) {
    var ps = j && j.post_sync;
    if (ps == null) return "";
    var list = Array.isArray(ps) ? ps : [ps];
    if (!list.length) return "";
    var bad = list.filter(function (p) {
      return p && p.ok === false;
    });
    if (bad.length) return " Config cache refresh had errors.";
    return " Config cache updated.";
  }

  function firewallIdsFromPostSync(ps) {
    if (ps == null) return [];
    var list = Array.isArray(ps) ? ps : [ps];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || p.firewall_id == null) continue;
      if (p.ok !== true) continue;
      var n = parseInt(p.firewall_id, 10);
      if (!isNaN(n) && n > 0 && out.indexOf(n) === -1) out.push(n);
    }
    return out;
  }

  function scheduleTaskQueueBackgroundRefreshes() {
    [1800, 4500, 12000].forEach(function (ms) {
      setTimeout(function () {
        refreshTable();
      }, ms);
    });
  }

  function notifyConfigCacheSynced(j) {
    var ps = j && j.post_sync;
    if (ps == null) return;
    var list = Array.isArray(ps) ? ps : [ps];
    var anyOk = list.some(function (p) {
      return p && p.ok === true;
    });
    if (!anyOk) return;
    var fwIds = firewallIdsFromPostSync(ps);
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            source: "ground-control",
            type: "gc-config-cache-synced",
            firewall_ids: fwIds,
          },
          window.location.origin,
        );
      }
    } catch (e1) {}
    try {
      document.dispatchEvent(
        new CustomEvent("gc-config-cache-synced", {
          detail: { post_sync: j.post_sync, firewall_ids: fwIds },
        }),
      );
    } catch (e2) {}
  }

  function selectedIds() {
    var ids = [];
    document.querySelectorAll(".task-queue-row-cb:checked").forEach(function (cb) {
      var v = parseInt(cb.value, 10);
      if (!isNaN(v)) ids.push(v);
    });
    return ids;
  }

  function statusDisplay(status) {
    return status === "pending" ? "Pending Approval" : String(status == null ? "" : status);
  }

  function approveOrRetryLabel(status) {
    return status === "error" ? "Retry" : "Approve";
  }

  function recordActionLabel(action) {
    if (action === "add") return "Add";
    if (action === "delete") return "Delete";
    return "Edit";
  }

  function syncSelectionActionBtns() {
    var empty = selectedIds().length === 0;
    if (delBtn) delBtn.disabled = empty;
    if (approveSelectedBtn) approveSelectedBtn.disabled = empty;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  function firewallPillHtml(label) {
    var txt = String(label == null ? "" : label).trim();
    if (!txt) return "<span class=\"muted\">—</span>";
    if (typeof window.gcFirewallScopePillHtml === "function") {
      return window.gcFirewallScopePillHtml(txt);
    }
    return esc(txt);
  }

  function rowSearchText(t) {
    var st = t.status;
    var statusForSearch =
      st === "pending" ? "pending approval " + st + " unapproved" : st;
    var ra = t.record_action;
    var raLabel = recordActionLabel(ra);
    return [
      t.id,
      t.firewall_label,
      t.entity_type,
      t.external_name,
      ra,
      raLabel,
      t.created_by_username,
      statusForSearch,
      t.error_message,
      t.stored_payload_json,
      t.pending_payload_json,
      t.created_at,
    ]
      .map(function (x) {
        return String(x == null ? "" : x).toLowerCase();
      })
      .join(" ");
  }

  /** Facet map from API task; must stay aligned with `taskRowFacetMapFromTr` / `rowHtml`. */
  function taskFacetMapFromTask(t) {
    var statusDisp = statusDisplay(t.status);
    var userRaw = t.created_by_username != null ? String(t.created_by_username).trim() : "";
    return {
      id: String(t.id != null ? t.id : "").trim().replace(/\s+/g, " "),
      firewall_label: String(t.firewall_label != null ? t.firewall_label : "")
        .trim()
        .replace(/\s+/g, " "),
      entity_type: String(t.entity_type != null ? t.entity_type : "")
        .trim()
        .replace(/\s+/g, " "),
      external_name: String(t.external_name != null ? t.external_name : "")
        .trim()
        .replace(/\s+/g, " "),
      record_action: recordActionLabel(t.record_action),
      created_by_username: userRaw ? userRaw.replace(/\s+/g, " ") : "—",
      status: statusDisp.trim().replace(/\s+/g, " "),
      error_message: String(t.error_message != null ? t.error_message : "")
        .trim()
        .replace(/\s+/g, " "),
      created_at: String(t.created_at != null ? t.created_at : "")
        .trim()
        .replace(/\s+/g, " "),
    };
  }

  function rowHtml(t) {
    return (
      "<tr class=\"task-queue-row\" data-task-id=\"" +
      t.id +
      "\" data-firewall-id=\"" +
      escAttr(String(t.firewall_id != null ? t.firewall_id : "")) +
      "\" data-search=\"" +
      escAttr(rowSearchText(t)) +
      "\" title=\"Click row to compare stored vs queued payload\"><td><input type=\"checkbox\" class=\"task-queue-row-cb\" value=\"" +
      t.id +
      "\" aria-label=\"Select task " +
      t.id +
      "\" /></td>" +
      "<td class=\"mono\" data-gc-col=\"id\">" +
      t.id +
      "</td><td data-gc-col=\"firewall_label\">" +
      firewallPillHtml(t.firewall_label) +
      "</td><td data-gc-col=\"entity_type\">" +
      esc(t.entity_type) +
      "</td><td class=\"mono\" data-gc-col=\"external_name\">" +
      esc(t.external_name) +
      "</td><td data-gc-col=\"record_action\"><span class=\"task-queue-action-pill\" data-record-action=\"" +
      escAttr(t.record_action || "edit") +
      "\">" +
      esc(recordActionLabel(t.record_action)) +
      "</span></td><td data-gc-col=\"created_by_username\">" +
      esc(t.created_by_username || "—") +
      "</td><td data-gc-col=\"status\"><span class=\"task-queue-status-badge\" data-status=\"" +
      escAttr(t.status) +
      "\">" +
      esc(statusDisplay(t.status)) +
      "</span></td><td class=\"task-queue-error muted\" data-gc-col=\"error_message\">" +
      esc(t.error_message) +
      "</td><td class=\"mono muted\" data-gc-col=\"created_at\">" +
      esc(t.created_at) +
      "</td><td class=\"task-queue-actions-cell\"><button type=\"button\" class=\"btn task-queue-row-action-btn task-queue-row-action-btn--approve task-queue-approve\" data-task-id=\"" +
      t.id +
      "\">" +
      esc(approveOrRetryLabel(t.status)) +
      "</button><button type=\"button\" class=\"btn task-queue-row-action-btn task-queue-row-action-btn--reject task-queue-reject\" data-task-id=\"" +
      t.id +
      "\">Reject</button></td></tr>"
    );
  }

  var searchIn = document.getElementById("task-queue-search");
  var filtersDrawer = document.getElementById("task-queue-filters-drawer");
  var filtersAside = document.getElementById("task-queue-filters-aside");

  var TASK_FACET_COLS = [
    { id: "id", label: "ID" },
    { id: "firewall_label", label: "Firewall" },
    { id: "entity_type", label: "Type" },
    { id: "external_name", label: "Name" },
    { id: "record_action", label: "Action" },
    { id: "created_by_username", label: "User" },
    { id: "status", label: "Status" },
    { id: "error_message", label: "Error" },
    { id: "created_at", label: "Created" },
  ];

  function taskFacetColsForRebuild() {
    return TASK_FACET_COLS.map(function (c) {
      var lab = c.label;
      if (typeof window.gcTableColumnDisplayLabel === "function") {
        lab = window.gcTableColumnDisplayLabel(lab);
      }
      return { id: c.id, label: lab };
    });
  }

  function taskRowFacetMapFromTr(tr) {
    var m = {};
    tr.querySelectorAll("td[data-gc-col]").forEach(function (td) {
      var k = td.getAttribute("data-gc-col");
      if (!k) return;
      m[k] = (td.textContent || "").trim().replace(/\s+/g, " ");
    });
    return m;
  }

  function rebuildTaskQueueFacets(done) {
    if (!filtersDrawer || !window.gcTableFacets) {
      if (typeof done === "function") done();
      return;
    }
    var rowEls = Array.prototype.slice.call(document.querySelectorAll("#task-queue-tbody tr.task-queue-row"));
    var maps = rowEls.map(function (tr) {
      return taskRowFacetMapFromTr(tr);
    });
    function rebuildDrawer() {
      window.gcTableFacets.rebuild(filtersDrawer, taskFacetColsForRebuild(), maps, "task-queue");
      if (typeof done === "function") done();
    }
    var lazy = window.gcTableLazy;
    if (!lazy || typeof lazy.forEachChunked !== "function" || rowEls.length <= lazy.DEFAULT_THRESHOLD) {
      rowEls.forEach(function (tr, i) {
        window.gcTableFacets.setRowFacets(tr, maps[i]);
      });
      rebuildDrawer();
      return;
    }
    lazy.forEachChunked(
      rowEls,
      lazy.DEFAULT_CHUNK,
      function (tr, i) {
        window.gcTableFacets.setRowFacets(tr, maps[i]);
      },
      rebuildDrawer,
    );
  }

  function taskFacetAppliedCount() {
    if (!filtersDrawer || !window.gcTableFacets) return 0;
    return window.gcTableFacets.appliedCount(filtersDrawer);
  }

  function updateTaskFacetChrome() {
    var n = taskFacetAppliedCount();
    var head = document.getElementById("task-queue-facet-head-actions");
    var countEl = document.getElementById("task-queue-facet-count");
    var resetBtn = document.getElementById("task-queue-facet-reset");
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

  function setTaskFiltersAsideCollapsed(collapsed) {
    var aside = document.getElementById("task-queue-filters-aside");
    var drawer = document.getElementById("task-queue-filters-drawer");
    var btn = document.getElementById("task-queue-filters-toggle");
    if (!aside || !drawer || !btn) return;
    aside.classList.toggle("filters--collapsed", collapsed);
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (collapsed) drawer.setAttribute("hidden", "");
    else drawer.removeAttribute("hidden");
  }

  function visibleTaskRows() {
    return Array.prototype.filter.call(
      document.querySelectorAll("#task-queue-tbody tr.task-queue-row"),
      function (tr) {
        return !tr.hidden;
      },
    );
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
    if (ids.length === 0) return true;
    var fid = tr.getAttribute("data-firewall-id");
    if (fid == null || fid === "") return false;
    var n = parseInt(fid, 10);
    if (isNaN(n)) return false;
    return ids.indexOf(n) !== -1;
  }

  function applyTaskQueueFilter() {
    var q = (searchIn && searchIn.value ? searchIn.value : "").trim().toLowerCase();
    var rows = document.querySelectorAll("#task-queue-tbody tr.task-queue-row");
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
    var fe = document.getElementById("task-queue-filter-empty");
    if (fe) fe.hidden = !(total > 0 && visible === 0);
    if (selectAll) {
      var vis = visibleTaskRows();
      var visChecked = vis.filter(function (tr) {
        var cb = tr.querySelector(".task-queue-row-cb");
        return cb && cb.checked;
      }).length;
      if (vis.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
      } else if (visChecked === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
      } else if (visChecked === vis.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
      } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
      }
    }
    syncSelectionActionBtns();
  }

  function taskListUrl() {
    var base = cfg.listUrl || "";
    if (typeof window.gcGetSelectedFirewallIds !== "function") return base;
    var ids = window.gcGetSelectedFirewallIds();
    if (!ids || ids.length === 0) return base;
    var sep = base.indexOf("?") === -1 ? "?" : "&";
    return base + sep + "firewall_ids=" + encodeURIComponent(ids.join(","));
  }

  function taskListUrlPaged(offset, limit) {
    var base = taskListUrl();
    var sep = base.indexOf("?") === -1 ? "?" : "&";
    return (
      base +
      sep +
      "offset=" +
      encodeURIComponent(String(offset)) +
      "&limit=" +
      encodeURIComponent(String(limit))
    );
  }

  function ensureTaskQueueFilterEmptyRow() {
    if (!tbody) return null;
    var fe = document.getElementById("task-queue-filter-empty");
    if (fe && fe.parentElement === tbody) return fe;
    fe = document.createElement("tr");
    fe.id = "task-queue-filter-empty";
    fe.className = "task-queue-filter-empty";
    fe.hidden = true;
    fe.innerHTML = "<td colspan=\"11\" class=\"muted\">No tasks match your search or filters.</td>";
    tbody.appendChild(fe);
    return fe;
  }

  function mountTaskQueueRows(tasks, gen, done) {
    if (!tbody) {
      if (typeof done === "function") done();
      return;
    }
    var feTr = ensureTaskQueueFilterEmptyRow();
    var facetMaps = tasks.map(taskFacetMapFromTask);
    var wrap = document.createElement("tbody");
    wrap.innerHTML = tasks.map(rowHtml).join("");
    var dataRows = Array.prototype.slice.call(wrap.children);
    for (var ri = 0; ri < dataRows.length; ri++) {
      if (window.gcTableFacets) window.gcTableFacets.setRowFacets(dataRows[ri], facetMaps[ri]);
    }

    function mounted() {
      if (gen !== taskQueueRefreshGen) return;
      if (typeof done === "function") done();
    }

    var lazy = window.gcTableLazy;
    if (!lazy || typeof lazy.appendBefore !== "function" || dataRows.length <= lazy.DEFAULT_THRESHOLD) {
      dataRows.forEach(function (tr) {
        tbody.insertBefore(tr, feTr);
      });
      mounted();
      return;
    }
    lazy.appendBefore(tbody, dataRows, feTr, {
      isCancelled: function () {
        return gen !== taskQueueRefreshGen;
      },
      onProgress: function () {
        if (gen !== taskQueueRefreshGen) return;
        applyTaskQueueFilter();
      },
      onComplete: mounted,
    });
  }

  var taskQueueRefreshGen = 0;
  var taskQueueNextOffset = 0;
  var taskQueueHasMore = false;
  var taskQueueLoading = false;
  var taskQueueScrollTicking = false;
  var taskQueuePageSize = 200;
  var taskQueueScrollEl = document.getElementById("task-queue-scroll");
  if (!taskQueueScrollEl && tbody && typeof tbody.closest === "function") {
    taskQueueScrollEl = tbody.closest(".table-scroll");
  }

  function finishTaskQueueRefresh(tasksLoaded, gen) {
    if (gen !== taskQueueRefreshGen) return;
    var empty = document.getElementById("task-queue-empty");
    if (empty) empty.hidden = tasksLoaded > 0;
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
    updateTaskFacetChrome();
    applyTaskQueueFilter();
    notifyTaskQueueChanged();
    if (window.gcTableSort) window.gcTableSort.bindTable(document.getElementById("task-queue-table"));
  }

  function maybeLoadTaskQueueUntilScrollable(gen) {
    if (gen !== taskQueueRefreshGen || !taskQueueHasMore || taskQueueLoading || !taskQueueScrollEl) return;
    if (taskQueueScrollEl.scrollHeight <= taskQueueScrollEl.clientHeight + 24) {
      loadMoreTaskQueueRows(gen);
    }
  }

  function loadTaskQueueRows(gen, offset) {
    if (gen !== taskQueueRefreshGen || taskQueueLoading || !tbody) return;
    taskQueueLoading = true;
    fetch(taskListUrlPaged(offset, taskQueuePageSize), { credentials: "same-origin" })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (gen !== taskQueueRefreshGen) return;
        var tasks = (data && data.tasks) || [];
        var hasMore = !!(data && data.has_more);

        if (offset === 0) {
          tbody.innerHTML = "";
          ensureTaskQueueFilterEmptyRow();
          if (filtersDrawer && window.gcTableFacets) {
            window.gcTableFacets.rebuild(filtersDrawer, taskFacetColsForRebuild(), [], "task-queue");
          }
        }

        if (tasks.length === 0) {
          if (offset === 0) {
            taskQueueHasMore = false;
            taskQueueNextOffset = 0;
            finishTaskQueueRefresh(0, gen);
          } else {
            taskQueueHasMore = false;
          }
          return;
        }

        mountTaskQueueRows(tasks, gen, function () {
          if (gen !== taskQueueRefreshGen) return;
          taskQueueNextOffset = offset + tasks.length;
          taskQueueHasMore = hasMore;
          rebuildTaskQueueFacets(function () {
            finishTaskQueueRefresh(taskQueueNextOffset, gen);
            maybeLoadTaskQueueUntilScrollable(gen);
          });
        });
      })
      .catch(function () {
        if (gen !== taskQueueRefreshGen) return;
        bannerResult(false, "Could not refresh the task queue list.");
      })
      .finally(function () {
        if (gen === taskQueueRefreshGen) taskQueueLoading = false;
      });
  }

  function loadMoreTaskQueueRows(gen) {
    var g = gen == null ? taskQueueRefreshGen : gen;
    if (g !== taskQueueRefreshGen || !taskQueueHasMore || taskQueueLoading) return;
    loadTaskQueueRows(g, taskQueueNextOffset);
  }

  function onTaskQueueScroll() {
    if (!taskQueueHasMore || taskQueueLoading || !taskQueueScrollEl) return;
    if (taskQueueScrollTicking) return;
    taskQueueScrollTicking = true;
    requestAnimationFrame(function () {
      taskQueueScrollTicking = false;
      if (!taskQueueHasMore || taskQueueLoading || !taskQueueScrollEl) return;
      var remaining =
        taskQueueScrollEl.scrollHeight -
        (taskQueueScrollEl.scrollTop + taskQueueScrollEl.clientHeight);
      if (remaining <= 240) {
        loadMoreTaskQueueRows(taskQueueRefreshGen);
      }
    });
  }

  function refreshTable() {
    var gen = ++taskQueueRefreshGen;
    taskQueueNextOffset = 0;
    taskQueueHasMore = true;
    taskQueueLoading = false;
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
    loadTaskQueueRows(gen, 0);
  }

  var compareModal = document.getElementById("task-queue-compare-modal");
  var compareOpen = false;
  var compareLoadSeq = 0;
  var compareModalTaskId = null;

  /* Modal lives inside .app-main (overflow-y: auto) on the full task-queue page; fixed descendants can fail hit-testing. Host under document.body instead. */
  if (compareModal && compareModal.parentElement !== document.body) {
    document.body.appendChild(compareModal);
  }

  var comparePanel = document.getElementById("task-queue-compare-panel");
  var compareClose = document.getElementById("task-queue-compare-close");
  var compareBackdrop = compareModal && compareModal.querySelector(".task-queue-compare-modal__backdrop");
  var compareMeta = document.getElementById("task-queue-compare-meta");
  var compareMissing = document.getElementById("task-queue-compare-missing");
  var compareTbody = document.getElementById("task-queue-diff-tbody");
  var compareStatusWrap = document.getElementById("task-queue-compare-status-wrap");
  var compareStatusBadge = document.getElementById("task-queue-compare-status-badge");
  var compareErrorEl = document.getElementById("task-queue-compare-error");

  /* Match modal Approve: prefer live JS id (same as compareModalTaskId), then panel data attribute. */
  function compareModalResolvedTaskId() {
    if (compareModalTaskId != null && compareModalTaskId !== "") {
      var m = parseInt(String(compareModalTaskId), 10);
      if (!isNaN(m) && m > 0) return m;
    }
    if (comparePanel) {
      var raw = comparePanel.getAttribute("data-gc-task-id");
      if (raw != null && String(raw).trim() !== "") {
        var n = parseInt(String(raw), 10);
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return NaN;
  }

  function applyCompareModalSendingPreview(taskId) {
    if (
      !compareOpen ||
      compareModalTaskId !== taskId ||
      !compareStatusBadge ||
      !compareApproveBtn
    ) {
      return;
    }
    compareStatusBadge.setAttribute("data-status", "sending");
    compareStatusBadge.textContent = "sending";
    if (compareErrorEl) {
      compareErrorEl.textContent = "";
      compareErrorEl.hidden = true;
    }
    if (compareStatusWrap) compareStatusWrap.hidden = false;
    compareApproveBtn.disabled = true;
  }

  function setCompareModalStatusUi(j) {
    var st = j && j.status != null ? String(j.status) : "";
    if (compareStatusWrap && compareStatusBadge) {
      compareStatusBadge.setAttribute("data-status", st);
      compareStatusBadge.textContent = statusDisplay(st);
      if (compareErrorEl) {
        var err = j && j.error_message != null ? String(j.error_message).trim() : "";
        if (err) {
          compareErrorEl.textContent = err;
          compareErrorEl.hidden = false;
        } else {
          compareErrorEl.textContent = "";
          compareErrorEl.hidden = true;
        }
      }
      compareStatusWrap.hidden = false;
    }
    if (compareApproveBtn) {
      compareApproveBtn.disabled = st === "sending";
      if (st !== "sending") {
        compareApproveBtn.textContent = approveOrRetryLabel(st);
      }
    }
  }

  function hideCompareModalStatusUi() {
    if (compareStatusWrap) compareStatusWrap.hidden = true;
    if (compareApproveBtn) compareApproveBtn.disabled = true;
  }

  function sendTaskToFirewall(id, options) {
    options = options || {};
    var row = options.row;
    var approveBtnEls = options.approveBtnEls;
    if (row) patchTaskRowSyncStarted(row);
    if (approveBtnEls) {
      approveBtnEls.forEach(function (b) {
        if (b) b.disabled = true;
      });
    }
    applyCompareModalSendingPreview(id);
    bannerProgress("Syncing task " + id + " to the firewall…");
    return fetch("/api/task-queue/" + id + "/send", {
      method: "POST",
      credentials: "same-origin",
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, status: r.status, j: j };
        });
      })
      .then(function (x) {
        var j = x.j || {};
        if (x.status === 202 && j.accepted) {
          bannerBackgroundTrack(
            "Task " +
              id +
              " sync is running in the background. You can keep navigating; refresh the queue for the final status.",
          );
          notifyTaskQueueChanged();
          if (typeof options.onOk === "function") options.onOk(j);
          refreshTable();
          scheduleTaskQueueBackgroundRefreshes();
          return;
        }
        if (!x.ok) throw new Error((j && j.error) || "Sync failed");
        bannerResult(true, "Task " + id + " synced." + postSyncStatusSuffix(j));
        notifyConfigCacheSynced(j);
        if (typeof options.onOk === "function") options.onOk(j);
        refreshTable();
      })
      .catch(function (err) {
        bannerResult(false, err.message || "Sync failed.");
        if (typeof options.onCatch === "function") options.onCatch(err);
        refreshTable();
      })
      .finally(function () {
        if (approveBtnEls) {
          approveBtnEls.forEach(function (b) {
            if (b) b.disabled = false;
          });
        }
        if (typeof options.onFinally === "function") options.onFinally();
      });
  }

  /* Same shape as sendTaskToFirewall: in-flight UI, success closes modal via onOk, failure runs onCatch like Approve. */
  function rejectTaskFromQueue(id, options) {
    options = options || {};
    var affectModal = options.affectCompareModal !== false;
    var extraEls = options.disableElements;
    var toDisable = Array.isArray(extraEls)
      ? extraEls.filter(function (b) {
          return b;
        })
      : [];
    if (affectModal && compareApproveBtn) {
      compareApproveBtn.disabled = true;
    }
    toDisable.forEach(function (b) {
      b.disabled = true;
    });
    bannerProgress("Removing task from the queue…");
    return fetch(taskQueueDeleteUrl(), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        if (!x.ok) throw new Error((x.j && x.j.detail) || "Reject failed");
        bannerResult(true, "Task rejected and removed from the queue.");
        if (typeof options.onOk === "function") options.onOk();
        refreshTable();
      })
      .catch(function (err) {
        bannerResult(false, err.message || "Reject failed.");
        if (typeof options.onCatch === "function") options.onCatch(err);
        refreshTable();
      })
      .finally(function () {
        if (affectModal && compareApproveBtn) {
          compareApproveBtn.disabled = false;
        }
        toDisable.forEach(function (b) {
          b.disabled = false;
        });
        if (typeof options.onFinally === "function") options.onFinally();
      });
  }

  function renderComparePayload(j, taskId, seq) {
    if (seq !== compareLoadSeq) return;
    if (compareRejectBtn) compareRejectBtn.setAttribute("data-task-id", String(taskId));
    compareMeta.textContent =
      (j.entity_type || "") +
      " · " +
      (j.external_name || "") +
      " · task #" +
      (j.task_id != null ? j.task_id : taskId);
    setCompareModalStatusUi(j);
    if (compareMissing) compareMissing.hidden = !j.stored_missing;
    var rows = j.rows || [];
    var diffHtml = rows
      .map(function (row) {
        var lc = row.left_class || "eq";
        var rc = row.right_class || "eq";
        return (
          "<tr><td class=\"task-queue-diff__cell task-queue-diff__cell--" +
          esc(lc) +
          "\">" +
          cellContent(row.left != null ? row.left : "", lc) +
          "</td><td class=\"task-queue-diff__cell task-queue-diff__cell--" +
          esc(rc) +
          "\">" +
          cellContent(row.right != null ? row.right : "", rc) +
          "</td></tr>"
        );
      })
      .join("");
    function finishCompareDiffMount() {
      if (seq !== compareLoadSeq) return;
      if (window.gcTableSort && compareTbody) {
        var diffTable = compareTbody.closest("table");
        if (diffTable) window.gcTableSort.bindTable(diffTable);
      }
    }
    var wrapDiff = document.createElement("tbody");
    wrapDiff.innerHTML = diffHtml;
    var diffNodes = Array.prototype.slice.call(wrapDiff.children);
    compareTbody.innerHTML = "";
    var lazyDiff = window.gcTableLazy;
    if (!lazyDiff || typeof lazyDiff.appendBefore !== "function" || diffNodes.length <= lazyDiff.DEFAULT_THRESHOLD) {
      compareTbody.innerHTML = diffHtml;
      finishCompareDiffMount();
    } else {
      lazyDiff.appendBefore(compareTbody, diffNodes, null, { onComplete: finishCompareDiffMount });
    }
  }

  function refetchCompareModal(taskId) {
    var seq = ++compareLoadSeq;
    fetch("/api/task-queue/" + taskId + "/compare", { credentials: "same-origin" })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        if (seq !== compareLoadSeq || !compareOpen) return;
        if (!x.ok) {
          compareMeta.textContent = (x.j && x.j.detail) || "Could not refresh task details.";
          hideCompareModalStatusUi();
          if (compareApproveBtn) compareApproveBtn.disabled = false;
          return;
        }
        renderComparePayload(x.j || {}, taskId, seq);
      })
      .catch(function () {
        if (seq !== compareLoadSeq || !compareOpen) return;
        compareMeta.textContent = "Could not refresh task details.";
        hideCompareModalStatusUi();
        if (compareApproveBtn) compareApproveBtn.disabled = false;
      });
  }

  function cellContent(text, cellClass) {
    if (text !== "") return esc(text);
    if (cellClass === "empty") {
      return "<span class=\"task-queue-diff__placeholder\" aria-hidden=\"true\">·</span>";
    }
    return "";
  }

  function closeCompareModal() {
    if (!compareModal || !compareOpen) return;
    compareOpen = false;
    compareModalTaskId = null;
    compareLoadSeq++;
    compareModal.hidden = true;
    compareModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (comparePanel) comparePanel.setAttribute("data-gc-task-id", "");
    if (compareRejectBtn) compareRejectBtn.setAttribute("data-task-id", "");
    if (compareApproveBtn) compareApproveBtn.textContent = "Approve";
  }

  function openCompareModal(taskId) {
    if (
      window.parent &&
      window.parent !== window &&
      typeof window.parent.gcTaskQueueDockOpenCompareModal === "function"
    ) {
      window.parent.gcTaskQueueDockOpenCompareModal(taskId);
      return;
    }
    if (!compareModal || !compareTbody || !compareMeta) return;
    compareOpen = true;
    compareModalTaskId = taskId;
    if (comparePanel) comparePanel.setAttribute("data-gc-task-id", String(taskId));
    if (compareRejectBtn) compareRejectBtn.setAttribute("data-task-id", String(taskId));
    var seq = ++compareLoadSeq;
    compareModal.hidden = false;
    compareModal.setAttribute("aria-hidden", "false");
    compareTbody.innerHTML = "";
    compareMeta.textContent = "Loading…";
    hideCompareModalStatusUi();
    if (compareApproveBtn) compareApproveBtn.textContent = "Approve";
    if (compareMissing) compareMissing.hidden = true;
    document.body.style.overflow = "hidden";

    fetch("/api/task-queue/" + taskId + "/compare", { credentials: "same-origin" })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        if (seq !== compareLoadSeq) return;
        if (!x.ok) {
          compareMeta.textContent =
            (x.j && x.j.detail) || "Could not load comparison.";
          hideCompareModalStatusUi();
          return;
        }
        renderComparePayload(x.j || {}, taskId, seq);
      })
      .catch(function () {
        if (seq !== compareLoadSeq) return;
        compareMeta.textContent = "Could not load comparison.";
        hideCompareModalStatusUi();
      });
  }

  if (compareApproveBtn) {
    compareApproveBtn.addEventListener("click", function () {
      var id = compareModalResolvedTaskId();
      if (isNaN(id)) return;
      var row = document.querySelector('tr.task-queue-row[data-task-id="' + id + '"]');
      sendTaskToFirewall(id, {
        row: row,
        onOk: function () {
          closeCompareModal();
        },
        onCatch: function () {
          if (compareOpen && compareModalTaskId === id) refetchCompareModal(id);
        },
      });
    });
  }

  if (compareClose) {
    compareClose.addEventListener("click", closeCompareModal);
  }
  if (compareBackdrop) {
    compareBackdrop.addEventListener("click", closeCompareModal);
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && compareOpen) {
      closeCompareModal();
    }
  });

  if (tbody) {
    tbody.addEventListener("click", function (e) {
      if (e.target.closest("input, button, a, label")) return;
      var tr = e.target.closest("tr[data-task-id]");
      if (!tr) return;
      var id = parseInt(tr.getAttribute("data-task-id"), 10);
      if (isNaN(id)) return;
      openCompareModal(id);
    });
  }

  if (searchIn) {
    if (window.gcTableFacets && window.gcTableFacets.bindToolbarSearch) {
      window.gcTableFacets.bindToolbarSearch(searchIn, "task-queue", applyTaskQueueFilter);
    } else {
      searchIn.addEventListener("input", applyTaskQueueFilter);
    }
  }

  document.addEventListener("change", function (e) {
    if (e.target === selectAll) {
      visibleTaskRows().forEach(function (tr) {
        var cb = tr.querySelector(".task-queue-row-cb");
        if (cb) cb.checked = selectAll.checked;
      });
      syncSelectionActionBtns();
    } else if (
      e.target &&
      e.target.classList &&
      e.target.classList.contains("task-queue-row-cb")
    ) {
      syncSelectionActionBtns();
      if (selectAll) {
        var vis = visibleTaskRows();
        var visChecked = vis.filter(function (tr) {
          var cb = tr.querySelector(".task-queue-row-cb");
          return cb && cb.checked;
        }).length;
        if (vis.length === 0) {
          selectAll.checked = false;
          selectAll.indeterminate = false;
        } else if (visChecked === 0) {
          selectAll.checked = false;
          selectAll.indeterminate = false;
        } else if (visChecked === vis.length) {
          selectAll.checked = true;
          selectAll.indeterminate = false;
        } else {
          selectAll.checked = false;
          selectAll.indeterminate = true;
        }
      }
    }
  });

  if (delBtn) {
    delBtn.addEventListener("click", function () {
      var ids = selectedIds();
      if (!ids.length) return;
      if (!taskQueueConfirm("Reject " + ids.length + " task(s) and remove them from the queue?")) return;
      delBtn.disabled = true;
      if (approveSelectedBtn) approveSelectedBtn.disabled = true;
      if (approveAllBtn) approveAllBtn.disabled = true;
      bannerProgress("Removing tasks from the queue…");
      fetch(taskQueueDeleteUrl(), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          if (!x.ok) throw new Error((x.j && x.j.detail) || "Reject failed");
          bannerResult(true, "Rejected " + (x.j.deleted || ids.length) + " task(s).");
          refreshTable();
        })
        .catch(function (err) {
          bannerResult(false, err.message || "Reject failed.");
        })
        .finally(function () {
          if (approveAllBtn) approveAllBtn.disabled = false;
          syncSelectionActionBtns();
        });
    });
  }

  /* Same wiring as Reject Selected (delBtn): direct id + listener here, not with the compare modal block. */
  if (compareRejectBtn) {
    compareRejectBtn.addEventListener("click", function () {
      var id = parseInt(compareRejectBtn.getAttribute("data-task-id"), 10);
      if (isNaN(id)) return;
      /* No confirm here: same delete API as Reject Selected, but the user already opened this diff; confirm() also blocks headless/embedded tests. */
      compareRejectBtn.disabled = true;
      if (compareApproveBtn) compareApproveBtn.disabled = true;
      bannerProgress("Removing tasks from the queue…");
      fetch(taskQueueDeleteUrl(), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          if (!x.ok) throw new Error((x.j && x.j.detail) || "Reject failed");
          bannerResult(true, "Rejected " + (x.j.deleted != null ? x.j.deleted : 1) + " task(s).");
          if (compareOpen && compareModalTaskId === id) closeCompareModal();
          refreshTable();
        })
        .catch(function (err) {
          bannerResult(false, err.message || "Reject failed.");
          refreshTable();
          if (compareOpen && compareModalTaskId === id) refetchCompareModal(id);
        })
        .finally(function () {
          if (compareRejectBtn) compareRejectBtn.disabled = false;
          if (compareApproveBtn) compareApproveBtn.disabled = false;
        });
    });
  }

  if (approveAllBtn && cfg.sendAllUrl) {
    approveAllBtn.addEventListener("click", function () {
      if (
        !confirm(
          "Approve every task pending approval or failed with an error and sync to its firewall, in queue order? This may take a while.",
        )
      ) {
        return;
      }
      approveAllBtn.disabled = true;
      if (approveSelectedBtn) approveSelectedBtn.disabled = true;
      if (delBtn) delBtn.disabled = true;
      bannerProgress("Approving all tasks and syncing to firewalls…");
      var sendBody = "{}";
      if (typeof window.gcGetSelectedFirewallIds === "function") {
        var fwIds = window.gcGetSelectedFirewallIds() || [];
        if (fwIds.length) {
          sendBody = JSON.stringify({ firewall_ids: fwIds });
        }
      }
      fetch(cfg.sendAllUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: sendBody,
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, status: r.status, j: j };
          });
        })
        .then(function (x) {
          if (!x.ok) throw new Error((x.j && x.j.detail) || "Approve all failed");
          var j = x.j || {};
          if (x.status === 202 && j.accepted) {
            var q = j.queued != null ? j.queued : 0;
            if (q < 1) {
              bannerResult(true, "No tasks were queued.");
            } else {
              bannerBackgroundTrack(
                "Approving " +
                  q +
                  " task(s) in the background. You can keep navigating; refresh the queue for results.",
              );
            }
            notifyTaskQueueChanged();
            refreshTable();
            scheduleTaskQueueBackgroundRefreshes();
            return;
          }
          var msg =
            "Processed " +
            (j.processed != null ? j.processed : 0) +
            ": " +
            (j.succeeded != null ? j.succeeded : 0) +
            " synced";
          if (j.failed) msg += ", " + j.failed + " failed";
          msg += "." + postSyncStatusSuffix(j);
          var failedN = j.failed != null ? j.failed : 0;
          bannerResult(failedN === 0, msg);
          notifyConfigCacheSynced(j);
          refreshTable();
        })
        .catch(function (err) {
          bannerResult(false, err.message || "Approve all failed.");
          refreshTable();
        })
        .finally(function () {
          approveAllBtn.disabled = false;
          if (delBtn) delBtn.disabled = false;
          syncSelectionActionBtns();
        });
    });
  }

  if (approveSelectedBtn && cfg.sendSelectedUrl) {
    approveSelectedBtn.addEventListener("click", function () {
      var ids = selectedIds();
      if (!ids.length) return;
      if (
        !confirm(
          "Approve and sync " +
            ids.length +
            " selected task(s)? Tasks already syncing are skipped.",
        )
      ) {
        return;
      }
      approveSelectedBtn.disabled = true;
      if (approveAllBtn) approveAllBtn.disabled = true;
      if (delBtn) delBtn.disabled = true;
      bannerProgress("Approving selected tasks and syncing…");
      fetch(cfg.sendSelectedUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, status: r.status, j: j };
          });
        })
        .then(function (x) {
          if (!x.ok) throw new Error((x.j && x.j.detail) || "Approve selected failed");
          var j = x.j || {};
          if (x.status === 202 && j.accepted) {
            var q = j.queued != null ? j.queued : 0;
            if (q < 1) {
              bannerResult(true, "No selected tasks could be queued.");
            } else {
              bannerBackgroundTrack(
                "Approving " +
                  q +
                  " selected task(s) in the background. You can keep navigating; refresh the queue for results.",
              );
            }
            notifyTaskQueueChanged();
            refreshTable();
            scheduleTaskQueueBackgroundRefreshes();
            return;
          }
          var proc = j.processed != null ? j.processed : 0;
          var msg =
            proc === 0
              ? "No selected tasks could be approved (already syncing or removed)."
              : "Processed " +
                proc +
                ": " +
                (j.succeeded != null ? j.succeeded : 0) +
                " synced";
          if (proc > 0 && j.failed) msg += ", " + j.failed + " failed";
          msg += proc === 0 ? "" : "." + postSyncStatusSuffix(j);
          var failedN = j.failed != null ? j.failed : 0;
          bannerResult(proc > 0 && failedN === 0, msg);
          notifyConfigCacheSynced(j);
          refreshTable();
        })
        .catch(function (err) {
          bannerResult(false, err.message || "Approve selected failed.");
          refreshTable();
        })
        .finally(function () {
          if (approveAllBtn) approveAllBtn.disabled = false;
          if (delBtn) delBtn.disabled = false;
          syncSelectionActionBtns();
        });
    });
  }

  document.addEventListener("click", function (e) {
    var rej = e.target.closest(".task-queue-reject");
    if (rej) {
      var rid = parseInt(rej.getAttribute("data-task-id"), 10);
      if (isNaN(rid)) return;
      if (!taskQueueConfirm("Reject task " + rid + " and remove it from the queue?")) return;
      var rrow = rej.closest("tr.task-queue-row");
      var rApprove = rrow && rrow.querySelector(".task-queue-approve");
      rejectTaskFromQueue(rid, {
        affectCompareModal: false,
        disableElements: [rej, rApprove],
        onOk: function () {
          if (compareOpen && compareModalTaskId === rid) closeCompareModal();
        },
        onCatch: function () {
          if (compareOpen && compareModalTaskId === rid) refetchCompareModal(rid);
        },
      });
      return;
    }
    var btn = e.target.closest(".task-queue-approve");
    if (!btn) return;
    var id = parseInt(btn.getAttribute("data-task-id"), 10);
    if (isNaN(id)) return;
    if (!taskQueueConfirm("Approve task " + id + " and sync it to the firewall?")) return;
    var row = btn.closest("tr.task-queue-row");
    var rowReject = row && row.querySelector(".task-queue-reject");
    sendTaskToFirewall(id, {
      row: row,
      approveBtnEls: rowReject ? [btn, rowReject] : [btn],
      onCatch: function () {
        if (compareOpen && compareModalTaskId === id) refetchCompareModal(id);
      },
    });
  });

  document.getElementById("task-queue-filters-toggle") &&
    document.getElementById("task-queue-filters-toggle").addEventListener("click", function () {
      var aside = document.getElementById("task-queue-filters-aside");
      var collapsed = aside && aside.classList.contains("filters--collapsed");
      setTaskFiltersAsideCollapsed(!collapsed);
    });

  document.getElementById("task-queue-facet-reset") &&
    document.getElementById("task-queue-facet-reset").addEventListener("click", function () {
      if (filtersDrawer && window.gcTableFacets) window.gcTableFacets.reset(filtersDrawer, "task-queue");
      updateTaskFacetChrome();
      applyTaskQueueFilter();
    });

  if (filtersAside && window.gcTableFacets) {
    window.gcTableFacets.bindAside(
      filtersAside,
      function () {
        updateTaskFacetChrome();
        applyTaskQueueFilter();
      },
      "task-queue",
    );
  }

  if (taskQueueScrollEl) {
    taskQueueScrollEl.addEventListener("scroll", onTaskQueueScroll, { passive: true });
  }

  refreshTable();

  document.addEventListener("gc-firewall-selection-changed", function () {
    refreshTable();
  });
})();
