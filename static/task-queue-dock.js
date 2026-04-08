(function () {
  "use strict";

  var STORAGE_H = "ground-control-task-queue-dock-height-px";
  var DEFAULT_H = 320;
  var MIN_H = 160;
  var EMBED_PATH = "/task-queue/embed";
  var SEND_ALL_URL = "/api/task-queue/send-all";
  var DELETE_URL = "/api/task-queue/delete";

  function qs(id) {
    return document.getElementById(id);
  }

  function bannerProgress(msg) {
    if (typeof window.gcGlobalBannerShowProgress === "function") {
      window.gcGlobalBannerShowProgress(msg);
    }
  }

  function bannerResult(ok, msg) {
    if (typeof window.gcGlobalBannerShowResult === "function") {
      window.gcGlobalBannerShowResult(ok, msg);
    }
  }

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

  function scheduleTaskQueueBackgroundRefreshes(loadIframe) {
    [1800, 4500, 12000].forEach(function (ms) {
      setTimeout(function () {
        loadIframe();
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
      document.dispatchEvent(
        new CustomEvent("gc-config-cache-synced", {
          detail: { post_sync: j.post_sync, firewall_ids: fwIds },
        }),
      );
    } catch (e) {}
  }

  function init() {
    var root = qs("gc-task-queue-dock");
    var bottomTab = qs("gc-task-queue-bottom-tab");
    var openBtn = qs("gc-task-queue-dock-open");
    var backdrop = root && root.querySelector(".gc-task-queue-dock__backdrop");
    var panel = root && root.querySelector(".gc-task-queue-dock__panel");
    var resizeEl = root && root.querySelector(".gc-task-queue-dock__resize");
    var closeBtn = root && root.querySelector(".gc-task-queue-dock__close");
    var fullHeightBtn = root && root.querySelector(".gc-task-queue-dock__full-height-btn");
    var iframe = qs("gc-task-queue-dock-iframe");
    var dockFiltersBtn = qs("gc-task-queue-dock-filters-toggle");
    var dockSearchIn = qs("gc-task-queue-dock-search");
    var dockApproveSelectedBtn = qs("gc-task-queue-dock-approve-selected");
    var dockRejectSelectedBtn = qs("gc-task-queue-dock-reject-selected");
    var approveBtns = document.querySelectorAll(".gc-task-queue-dock-approve-all");
    if (!root || !openBtn || !backdrop || !panel || !iframe) return;

    var iframeEverLoaded = false;
    var fullHeightOn = false;
    var heightBeforeFull = DEFAULT_H;
    var dockMirrorTimer = null;
    var compareModal = null;
    var compareTaskId = null;

    function getIframeDoc() {
      try {
        if (!iframe.contentWindow || !iframe.contentWindow.document) return null;
        return iframe.contentWindow.document;
      } catch (e) {
        return null;
      }
    }

    function syncDockHeaderControlsFromIframe() {
      var doc = getIframeDoc();
      if (!doc) return;
      var inSearch = doc.getElementById("task-queue-search");
      var inFilters = doc.getElementById("task-queue-filters-toggle");
      var inApproveSelected = doc.getElementById("task-queue-approve-selected");
      var inRejectSelected = doc.getElementById("task-queue-delete-selected");
      if (dockApproveSelectedBtn && inApproveSelected) {
        dockApproveSelectedBtn.disabled = !!inApproveSelected.disabled;
      }
      if (dockRejectSelectedBtn && inRejectSelected) {
        dockRejectSelectedBtn.disabled = !!inRejectSelected.disabled;
      }
      if (dockFiltersBtn && inFilters) {
        dockFiltersBtn.setAttribute(
          "aria-expanded",
          inFilters.getAttribute("aria-expanded") === "true" ? "true" : "false",
        );
      }
      if (
        dockSearchIn &&
        inSearch &&
        document.activeElement !== dockSearchIn &&
        typeof inSearch.value === "string"
      ) {
        dockSearchIn.value = inSearch.value;
      }
    }

    function startDockMirror() {
      if (dockMirrorTimer) return;
      dockMirrorTimer = setInterval(syncDockHeaderControlsFromIframe, 300);
      syncDockHeaderControlsFromIframe();
    }

    function stopDockMirror() {
      if (!dockMirrorTimer) return;
      clearInterval(dockMirrorTimer);
      dockMirrorTimer = null;
    }

    function readStoredHeight() {
      try {
        var v = localStorage.getItem(STORAGE_H);
        var n = v ? parseInt(v, 10) : NaN;
        if (Number.isFinite(n) && n >= MIN_H) return n;
      } catch (e) {}
      return DEFAULT_H;
    }

    function maxHeightPx() {
      var host = root.parentElement;
      var h = host && host.clientHeight ? host.clientHeight : window.innerHeight;
      return Math.max(MIN_H, Math.floor(h * 0.92));
    }

    function applyHeight(px) {
      var maxH = maxHeightPx();
      var clamped = fullHeightOn
        ? maxH
        : Math.min(Math.max(px, MIN_H), maxH);
      panel.style.height = clamped + "px";
      if (!fullHeightOn) {
        try {
          localStorage.setItem(STORAGE_H, String(clamped));
        } catch (e) {}
      }
    }

    function syncFullHeightChrome() {
      if (!fullHeightBtn) return;
      fullHeightBtn.setAttribute("aria-pressed", fullHeightOn ? "true" : "false");
      fullHeightBtn.setAttribute(
        "aria-label",
        fullHeightOn ? "Restore task queue panel height" : "Expand task queue panel to full height",
      );
      fullHeightBtn.title = fullHeightOn ? "Restore height" : "Expand to full height";
      var iconExpand = fullHeightBtn.querySelector("[data-gc-tq-expand]");
      var iconCollapse = fullHeightBtn.querySelector("[data-gc-tq-collapse]");
      if (iconExpand) iconExpand.hidden = fullHeightOn;
      if (iconCollapse) iconCollapse.hidden = !fullHeightOn;
    }

    function setFullHeight(on) {
      fullHeightOn = !!on;
      panel.classList.toggle("gc-task-queue-dock__panel--full-height", fullHeightOn);
      syncFullHeightChrome();
      if (fullHeightOn) {
        heightBeforeFull = parseInt(panel.style.height, 10) || readStoredHeight();
        applyHeight(maxHeightPx());
      } else {
        applyHeight(heightBeforeFull);
      }
    }

    applyHeight(readStoredHeight());
    syncFullHeightChrome();

    function loadIframe() {
      var base = window.location.origin + EMBED_PATH;
      if (!iframeEverLoaded) {
        iframe.src = base;
        iframeEverLoaded = true;
        return;
      }
      try {
        if (iframe.contentWindow && iframe.contentWindow.location) {
          iframe.contentWindow.location.reload();
        } else {
          iframe.src = base;
        }
      } catch (e) {
        iframe.src = base;
      }
    }

    function applyDockSearchToIframe() {
      if (!dockSearchIn) return;
      var doc = getIframeDoc();
      if (!doc) return;
      var inSearch = doc.getElementById("task-queue-search");
      if (!inSearch) return;
      inSearch.value = dockSearchIn.value || "";
      inSearch.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function compareStatusSuffix(j) {
      var ps = j && j.post_sync;
      if (ps == null) return "";
      var list = Array.isArray(ps) ? ps : [ps];
      var bad = list.filter(function (p) {
        return p && p.ok === false;
      });
      return bad.length ? " Config cache refresh had errors." : " Config cache updated.";
    }

    function createCompareModal() {
      if (compareModal) return compareModal;
      var wrap = document.createElement("div");
      wrap.id = "gc-task-queue-dock-compare-modal";
      wrap.className = "task-queue-compare-modal";
      wrap.setAttribute("aria-hidden", "true");
      wrap.hidden = true;
      wrap.innerHTML =
        '<div class="task-queue-compare-modal__backdrop" tabindex="-1" aria-hidden="true"></div>' +
        '<div class="task-queue-compare-modal__panel" role="dialog" aria-modal="true" aria-labelledby="gc-task-queue-dock-compare-title">' +
        '<div class="task-queue-compare-modal__header">' +
        '<h2 id="gc-task-queue-dock-compare-title" class="task-queue-compare-modal__title">Queued change</h2>' +
        '<div class="task-queue-compare-modal__header-actions">' +
        '<button type="button" class="btn destructive" data-gc-dock-cmp-reject>Reject</button>' +
        '<button type="button" class="btn primary" data-gc-dock-cmp-approve>Approve</button>' +
        '<button type="button" class="task-queue-compare-modal__close" data-gc-dock-cmp-close aria-label="Close" title="Close">×</button>' +
        "</div></div>" +
        '<div class="task-queue-compare-modal__status-wrap" data-gc-dock-cmp-status-wrap hidden>' +
        '<div class="task-queue-compare-modal__status-line">' +
        '<span class="task-queue-compare-modal__status-label muted">Status</span>' +
        '<span class="task-queue-status-badge" data-gc-dock-cmp-status></span>' +
        "</div>" +
        '<p class="task-queue-compare-modal__error muted" data-gc-dock-cmp-error hidden></p>' +
        "</div>" +
        '<p class="task-queue-compare-modal__meta muted" data-gc-dock-cmp-meta>Loading…</p>' +
        '<p class="task-queue-compare-modal__missing muted" data-gc-dock-cmp-missing hidden>' +
        "No matching row in the local config cache for this object. The right column shows the payload that will be sent; the left column has nothing to compare against until the firewall is synced." +
        "</p>" +
        '<div class="task-queue-compare-scroll">' +
        '<table class="task-queue-diff-table" role="grid" aria-label="Stored versus queued payload">' +
        "<thead><tr>" +
        '<th scope="col" class="task-queue-diff-table__th">Stored (local cache)</th>' +
        '<th scope="col" class="task-queue-diff-table__th">Queued (to send)</th>' +
        "</tr></thead>" +
        '<tbody data-gc-dock-cmp-body></tbody>' +
        "</table></div></div>";
      document.body.appendChild(wrap);
      compareModal = wrap;

      function closeCompareModal() {
        if (!compareModal) return;
        compareTaskId = null;
        compareModal.hidden = true;
        compareModal.setAttribute("aria-hidden", "true");
      }

      function rejectCompareTask() {
        if (!compareTaskId) return;
        var rid = compareTaskId;
        fetch(DELETE_URL, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [rid] }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, j: j };
            });
          })
          .then(function (x) {
            if (!x.ok) throw new Error((x.j && x.j.detail) || "Reject failed");
            bannerResult(true, "Task rejected and removed from the queue.");
            closeCompareModal();
            loadIframe();
            if (window.gcRefreshTaskQueueBadge) window.gcRefreshTaskQueueBadge();
          })
          .catch(function (e) {
            bannerResult(false, (e && e.message) || "Reject failed.");
          });
      }

      function approveCompareTask() {
        if (!compareTaskId) return;
        var aid = compareTaskId;
        fetch("/api/task-queue/" + aid + "/send", {
          method: "POST",
          credentials: "same-origin",
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, status: r.status, j: j };
            });
          })
          .then(function (x) {
            if (x.status === 202 && x.j && x.j.accepted) {
              if (typeof window.gcGlobalBannerTrackBackgroundSync === "function") {
                window.gcGlobalBannerTrackBackgroundSync(
                  "Task " +
                    aid +
                    " sync is running in the background. You can keep navigating; refresh the queue for the final status.",
                );
              }
              closeCompareModal();
              loadIframe();
              scheduleTaskQueueBackgroundRefreshes(loadIframe);
              if (window.gcRefreshTaskQueueBadge) window.gcRefreshTaskQueueBadge();
              return;
            }
            if (!x.ok) throw new Error((x.j && x.j.error) || "Sync failed");
            bannerResult(true, "Task " + aid + " synced." + compareStatusSuffix(x.j));
            closeCompareModal();
            loadIframe();
            if (window.gcRefreshTaskQueueBadge) window.gcRefreshTaskQueueBadge();
          })
          .catch(function (e) {
            bannerResult(false, (e && e.message) || "Sync failed.");
          });
      }

      wrap.addEventListener("click", function (e) {
        var t = e.target;
        if (
          t.closest("[data-gc-dock-cmp-close]") ||
          t.classList.contains("task-queue-compare-modal__backdrop")
        ) {
          closeCompareModal();
          return;
        }
        if (t.closest("[data-gc-dock-cmp-reject]")) {
          rejectCompareTask();
          return;
        }
        if (t.closest("[data-gc-dock-cmp-approve]")) {
          approveCompareTask();
        }
      });

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && compareModal && !compareModal.hidden) {
          closeCompareModal();
        }
      });
      return wrap;
    }

    function renderCompareRows(rows) {
      var body = compareModal && compareModal.querySelector("[data-gc-dock-cmp-body]");
      if (!body) return;
      var out = "";
      (rows || []).forEach(function (row) {
        var lc = row.left_class || "eq";
        var rc = row.right_class || "eq";
        var left = row.left != null ? String(row.left) : "";
        var right = row.right != null ? String(row.right) : "";
        out +=
          "<tr>" +
          '<td class="task-queue-diff__cell task-queue-diff__cell--' +
          lc +
          '">' +
          (left ? left.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "") +
          "</td>" +
          '<td class="task-queue-diff__cell task-queue-diff__cell--' +
          rc +
          '">' +
          (right ? right.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "") +
          "</td>" +
          "</tr>";
      });
      body.innerHTML = out;
    }

    function openDockCompareModal(taskId) {
      createCompareModal();
      compareTaskId = taskId;
      compareModal.hidden = false;
      compareModal.setAttribute("aria-hidden", "false");
      var meta = compareModal.querySelector("[data-gc-dock-cmp-meta]");
      var missing = compareModal.querySelector("[data-gc-dock-cmp-missing]");
      var statusWrap = compareModal.querySelector("[data-gc-dock-cmp-status-wrap]");
      var statusBadge = compareModal.querySelector("[data-gc-dock-cmp-status]");
      var errorEl = compareModal.querySelector("[data-gc-dock-cmp-error]");
      var approveBtn = compareModal.querySelector("[data-gc-dock-cmp-approve]");
      if (meta) meta.textContent = "Loading…";
      if (missing) missing.hidden = true;
      if (statusWrap) statusWrap.hidden = true;
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = "";
      }
      if (approveBtn) approveBtn.disabled = false;
      renderCompareRows([]);
      fetch("/api/task-queue/" + taskId + "/compare", { credentials: "same-origin" })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          if (!compareModal || compareTaskId !== taskId) return;
          if (!x.ok) {
            if (meta) meta.textContent = (x.j && x.j.detail) || "Could not load comparison.";
            return;
          }
          var j = x.j || {};
          if (meta) {
            meta.textContent =
              (j.entity_type || "") +
              " · " +
              (j.external_name || "") +
              " · task #" +
              (j.task_id != null ? j.task_id : taskId);
          }
          if (missing) missing.hidden = !j.stored_missing;
          if (statusWrap && statusBadge) {
            var st = j.status != null ? String(j.status) : "";
            statusWrap.hidden = false;
            statusBadge.setAttribute("data-status", st);
            statusBadge.textContent = st === "pending" ? "Pending Approval" : st;
            if (approveBtn) approveBtn.disabled = st === "sending";
            if (errorEl) {
              var err = j.error_message != null ? String(j.error_message).trim() : "";
              if (err) {
                errorEl.textContent = err;
                errorEl.hidden = false;
              }
            }
          }
          renderCompareRows(j.rows || []);
        })
        .catch(function () {
          if (meta) meta.textContent = "Could not load comparison.";
        });
    }

    function setBottomTabDockOpenHidden(dockOpen) {
      if (!bottomTab) return;
      if (dockOpen) {
        bottomTab.hidden = true;
        bottomTab.setAttribute("aria-hidden", "true");
      } else {
        var c = typeof window.gcTaskQueueBadgeCount === "number" ? window.gcTaskQueueBadgeCount : 0;
        if (c >= 1) {
          bottomTab.hidden = false;
          bottomTab.setAttribute("aria-hidden", "false");
        }
      }
    }

    function openDock() {
      root.hidden = false;
      root.setAttribute("aria-hidden", "false");
      openBtn.setAttribute("aria-expanded", "true");
      setBottomTabDockOpenHidden(true);
      loadIframe();
      startDockMirror();
      try {
        closeBtn.focus();
      } catch (e) {}
    }

    function closeDock() {
      root.hidden = true;
      root.setAttribute("aria-hidden", "true");
      openBtn.setAttribute("aria-expanded", "false");
      setBottomTabDockOpenHidden(false);
      if (fullHeightOn) {
        fullHeightOn = false;
        panel.classList.remove("gc-task-queue-dock__panel--full-height");
        syncFullHeightChrome();
        applyHeight(heightBeforeFull);
      }
      stopDockMirror();
      if (window.gcRefreshTaskQueueBadge) window.gcRefreshTaskQueueBadge();
    }

    function sendApproveAllBody() {
      /* Embed list is unscoped; parent top-bar firewall_ids would skip visible rows. */
      return "{}";
    }

    function runApproveAll() {
      var c = typeof window.gcTaskQueueBadgeCount === "number" ? window.gcTaskQueueBadgeCount : 0;
      if (c < 1) return;
      if (
        !confirm(
          "Approve every task pending approval or failed with an error and sync to its firewall, in queue order? This may take a while.",
        )
      ) {
        return;
      }
      approveBtns.forEach(function (b) {
        b.disabled = true;
      });
      bannerProgress("Approving all tasks and syncing to firewalls…");
      fetch(SEND_ALL_URL, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: sendApproveAllBody(),
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
            } else if (typeof window.gcGlobalBannerTrackBackgroundSync === "function") {
              window.gcGlobalBannerTrackBackgroundSync(
                "Approving " +
                  q +
                  " task(s) in the background. You can keep navigating; refresh the queue for results.",
              );
            } else {
              bannerResult(
                true,
                "Started approving " + q + " task(s) in the background. You can keep working.",
              );
            }
            document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
            loadIframe();
            scheduleTaskQueueBackgroundRefreshes(loadIframe);
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
          document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
          loadIframe();
        })
        .catch(function (err) {
          bannerResult(false, err.message || "Approve all failed.");
        })
        .finally(function () {
          approveBtns.forEach(function (b) {
            b.disabled = false;
          });
          if (window.gcRefreshTaskQueueBadge) window.gcRefreshTaskQueueBadge();
        });
    }

    approveBtns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        runApproveAll();
      });
    });

    if (dockSearchIn) {
      dockSearchIn.addEventListener("input", applyDockSearchToIframe);
    }

    if (dockFiltersBtn) {
      dockFiltersBtn.addEventListener("click", function () {
        var doc = getIframeDoc();
        if (!doc) return;
        var inFilters = doc.getElementById("task-queue-filters-toggle");
        if (inFilters) inFilters.click();
        syncDockHeaderControlsFromIframe();
      });
    }

    if (dockApproveSelectedBtn) {
      dockApproveSelectedBtn.addEventListener("click", function () {
        var doc = getIframeDoc();
        if (!doc) return;
        var inBtn = doc.getElementById("task-queue-approve-selected");
        if (inBtn && !inBtn.disabled) inBtn.click();
      });
    }

    if (dockRejectSelectedBtn) {
      dockRejectSelectedBtn.addEventListener("click", function () {
        var doc = getIframeDoc();
        if (!doc) return;
        var inBtn = doc.getElementById("task-queue-delete-selected");
        if (inBtn && !inBtn.disabled) inBtn.click();
      });
    }

    window.gcTaskQueueDockOpenCompareModal = function (taskId) {
      var n = parseInt(taskId, 10);
      if (isNaN(n) || n <= 0) return;
      openDockCompareModal(n);
    };

    openBtn.addEventListener("click", function () {
      if (root.hidden) {
        openDock();
      } else {
        loadIframe();
        try {
          iframe.contentWindow.focus();
        } catch (e) {}
      }
    });

    iframe.addEventListener("load", function () {
      applyDockSearchToIframe();
      syncDockHeaderControlsFromIframe();
    });

    backdrop.addEventListener("click", function () {
      closeDock();
    });

    closeBtn.addEventListener("click", function () {
      closeDock();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !root.hidden) {
        closeDock();
        openBtn.focus();
      }
    });

    window.addEventListener(
      "resize",
      function () {
        if (!root.hidden) {
          if (fullHeightOn) {
            applyHeight(maxHeightPx());
          } else {
            var cur = parseInt(panel.style.height, 10) || readStoredHeight();
            applyHeight(cur);
          }
        }
      },
      { passive: true },
    );

    if (fullHeightBtn) {
      fullHeightBtn.addEventListener("click", function () {
        setFullHeight(!fullHeightOn);
      });
    }

    if (resizeEl) {
      var dragging = false;
      var startY = 0;
      var startH = 0;

      resizeEl.addEventListener("mousedown", function (e) {
        e.preventDefault();
        if (fullHeightOn) {
          fullHeightOn = false;
          panel.classList.remove("gc-task-queue-dock__panel--full-height");
          syncFullHeightChrome();
        }
        dragging = true;
        startY = e.clientY;
        startH = panel.getBoundingClientRect().height;
        document.body.style.cursor = "ns-resize";
        document.body.style.userSelect = "none";
      });

      document.addEventListener("mousemove", function (e) {
        if (!dragging) return;
        var delta = startY - e.clientY;
        applyHeight(startH + delta);
      });

      document.addEventListener("mouseup", function () {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
