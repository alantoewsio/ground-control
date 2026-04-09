(function () {
  "use strict";

  let RESULT_HOLD_MS = 20000;
  let ROLLUP_MS = 380;
  let hideTimer = null;
  let rollupTimer = null;

  let BG_STATUS_URL = "/api/background-sync-status";
  let BG_POLL_MS = 2500;
  let bgStatusPollTimer = null;
  let TASK_QUEUE_COUNT_URL = "/api/task-queue/count";

  // Client-side throughput estimate for task-queue background sends.
  // Uses queue-count deltas between polls: tasks/s ~= (prev_count - current_count) / dt.
  let tqRateState = {
    lastTsMs: 0,
    lastCount: null,
    emaRate: null,
  };

  /** Firewall ids to refresh in the UI after background config-sync completes (see trackBackgroundSync). */
  let pendingConfigCacheFwIdSet = {};

  /** Concurrent configuration syncs (firewall cache); task-queue progress resets this batch. */
  let syncBatchId = 0;
  let syncInFlight = 0;
  let syncOutcomes = [];
  let syncBaseMessage = "Syncing configuration cache from the firewall…";

  let CHECK_SVG =
    '<svg class="gc-global-banner__glyph" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
    '<path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

  let ERROR_SVG =
    '<svg class="gc-global-banner__glyph" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
    '<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';

  function root() {
    return document.getElementById("gc-global-banner");
  }

  let flyoutTopOffsetRaf = null;

  function syncAppFlyoutTopOffset() {
    let html = document.documentElement;
    let bar = document.querySelector(".app-shell > .top-bar");
    let topPx = bar ? bar.getBoundingClientRect().bottom : 44;
    let ban = root();
    if (ban && !ban.hasAttribute("hidden")) {
      let br = ban.getBoundingClientRect();
      if (br.height > 0.5 && br.bottom > topPx) {
        topPx = br.bottom;
      }
    }
    html.style.setProperty("--app-flyout-top-offset", topPx + "px");
  }

  function scheduleSyncAppFlyoutTopOffset() {
    if (flyoutTopOffsetRaf != null) return;
    flyoutTopOffsetRaf = requestAnimationFrame(function () {
      flyoutTopOffsetRaf = null;
      syncAppFlyoutTopOffset();
    });
  }

  function clearTimers() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (rollupTimer) {
      clearTimeout(rollupTimer);
      rollupTimer = null;
    }
  }

  function syncResetBatch() {
    syncBatchId++;
    syncInFlight = 0;
    syncOutcomes = [];
  }

  function resetRollupState(el) {
    el.classList.remove("gc-global-banner--rollup");
  }

  function setResultCloseVisible(el, visible) {
    let btn = el && el.querySelector(".gc-global-banner__close");
    if (btn) btn.hidden = !visible;
  }

  function dismissResultIfShowing() {
    let el = root();
    if (!el) return;
    let phase = el.dataset.gcBannerPhase;
    if (phase !== "success" && phase !== "error") return;
    clearTimers();
    startRollup();
  }

  function setGlobalBannerProgressBar(el, visible) {
    if (!el) return;
    let bar = el.querySelector(".gc-global-banner__bar");
    if (bar) bar.hidden = !visible;
  }

  /** Progress UI only; does not touch sync batch state. Uses indeterminate bar (no spinner). */
  function applyProgressUI(message) {
    let el = root();
    if (!el) return;
    resetRollupState(el);
    el.hidden = false;
    el.removeAttribute("data-gc-banner-phase");
    el.setAttribute("data-gc-banner-phase", "progress");
    el.setAttribute("aria-busy", "true");
    el.className = "gc-global-banner gc-global-banner--progress";
    let icon = el.querySelector(".gc-global-banner__icon");
    let text = el.querySelector(".gc-global-banner__text");
    if (icon) icon.innerHTML = "";
    if (text) text.textContent = message || "Working…";
    setResultCloseVisible(el, false);
    setGlobalBannerProgressBar(el, true);
    scheduleSyncAppFlyoutTopOffset();
  }

  function showProgress(message) {
    clearTimers();
    syncResetBatch();
    applyProgressUI(message);
  }

  function stopBackgroundStatusPoll() {
    if (bgStatusPollTimer) {
      clearInterval(bgStatusPollTimer);
      bgStatusPollTimer = null;
    }
  }

  function resetTaskQueueRateState() {
    tqRateState.lastTsMs = 0;
    tqRateState.lastCount = null;
    tqRateState.emaRate = null;
  }

  function isTaskQueueBackground(data) {
    let msg = String((data && data.message) || "").toLowerCase();
    return msg.indexOf("task queue") !== -1;
  }

  function formatTaskQueueRateSuffix(rate) {
    if (!(rate > 0.049)) return "";
    let n = rate >= 10 ? Math.round(rate) : Math.round(rate * 10) / 10;
    return " \u00b7 " + n + " tasks/s";
  }

  function renderServerBackgroundProgressWithTaskRate(data, queueCount) {
    let msg = (data && data.message) || "Background work in progress…";
    if (data && data.count > 1) msg += " (" + data.count + ")";

    let now = Date.now();
    let currentCount =
      typeof queueCount === "number" && queueCount >= 0 ? queueCount : null;
    if (currentCount == null) {
      resetTaskQueueRateState();
      renderServerBackgroundProgress(data);
      return;
    }

    let suffix = "";
    let prevTs = tqRateState.lastTsMs;
    let prevCount = tqRateState.lastCount;
    if (prevTs > 0 && prevCount != null && now > prevTs) {
      let dtSec = (now - prevTs) / 1000;
      let processed = prevCount - currentCount;
      let instRate = processed > 0 ? processed / dtSec : 0;
      if (tqRateState.emaRate == null) tqRateState.emaRate = instRate;
      else tqRateState.emaRate = tqRateState.emaRate * 0.65 + instRate * 0.35;
      suffix = formatTaskQueueRateSuffix(tqRateState.emaRate);
    }
    tqRateState.lastTsMs = now;
    tqRateState.lastCount = currentCount;
    applyProgressUI(msg + suffix);
    let el = root();
    if (el) el.setAttribute("data-gc-banner-bg-tracked", "1");
  }

  function addPendingConfigCacheFirewallIds(ids) {
    if (!ids || !ids.length) return;
    for (let i = 0; i < ids.length; i++) {
      let n = typeof ids[i] === "number" ? ids[i] : parseInt(ids[i], 10);
      if (!isNaN(n) && n > 0) pendingConfigCacheFwIdSet[n] = true;
    }
  }

  function flushPendingConfigCacheFirewallIds() {
    let keys = Object.keys(pendingConfigCacheFwIdSet);
    if (!keys.length) return;
    pendingConfigCacheFwIdSet = {};
    let ids = keys
      .map(function (k) {
        return parseInt(k, 10);
      })
      .filter(function (n) {
        return !isNaN(n) && n > 0;
      });
    if (!ids.length) return;
    try {
      document.dispatchEvent(
        new CustomEvent("gc-config-cache-synced", { detail: { firewall_ids: ids } }),
      );
    } catch (eFlush) {}
  }

  function renderServerBackgroundProgress(data) {
    let msg = (data && data.message) || "Background work in progress…";
    if (data && data.count > 1) msg += " (" + data.count + ")";
    applyProgressUI(msg);
    let el = root();
    if (el) el.setAttribute("data-gc-banner-bg-tracked", "1");
  }

  function tickBackgroundSyncStatus() {
    if (!root()) {
      stopBackgroundStatusPoll();
      return;
    }
    fetch(BG_STATUS_URL, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        if (r.status === 401) return null;
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (data) {
        if (!data) return;
        if (data.active) {
          if (isTaskQueueBackground(data)) {
            fetch(TASK_QUEUE_COUNT_URL, {
              credentials: "same-origin",
              headers: {
                Accept: "application/json",
                "X-Requested-With": "Ground-Control",
              },
            })
              .then(function (r2) {
                if (!r2.ok) throw new Error("task queue count failed");
                return r2.json();
              })
              .then(function (countData) {
                let c =
                  countData && typeof countData.count === "number"
                    ? countData.count
                    : null;
                renderServerBackgroundProgressWithTaskRate(data, c);
              })
              .catch(function () {
                resetTaskQueueRateState();
                renderServerBackgroundProgress(data);
              });
          } else {
            resetTaskQueueRateState();
            renderServerBackgroundProgress(data);
          }
          return;
        }
        resetTaskQueueRateState();
        stopBackgroundStatusPoll();
        let el = root();
        let tracked = el && el.dataset.gcBannerBgTracked === "1";
        if (tracked && el.dataset.gcBannerPhase === "progress") {
          el.removeAttribute("data-gc-banner-bg-tracked");
          flushPendingConfigCacheFirewallIds();
          showResult(true, "Background sync finished.");
        }
      })
      .catch(function () {});
  }

  function startBackgroundStatusPoll() {
    if (!root()) return;
    if (bgStatusPollTimer) return;
    bgStatusPollTimer = setInterval(tickBackgroundSyncStatus, BG_POLL_MS);
    tickBackgroundSyncStatus();
  }

  /**
   * Progress banner tied to server-side background jobs; survives navigation and full reload.
   * @param {string} [message]
   * @param {{ firewall_ids?: number[] }} [options] - When background work completes, dispatch
   *   gc-config-cache-synced with these firewall ids so tables (e.g. IPS configure spoof toggle) refresh.
   */
  function trackBackgroundSync(message, options) {
    let opt = options && typeof options === "object" ? options : {};
    if (opt.firewall_ids && opt.firewall_ids.length) {
      addPendingConfigCacheFirewallIds(opt.firewall_ids);
    }
    if (!root()) return;
    showProgress(message || "Background work in progress…");
    root().setAttribute("data-gc-banner-bg-tracked", "1");
    startBackgroundStatusPoll();
  }

  function restoreBackgroundBannerIfNeeded() {
    if (!root()) return;
    fetch(BG_STATUS_URL, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) return;
        if (!r.ok) return;
        return r.json();
      })
      .then(function (data) {
        if (data && data.active) {
          renderServerBackgroundProgress(data);
          startBackgroundStatusPoll();
        }
      })
      .catch(function () {});
  }

  function renderSyncProgress(optionalMessage) {
    clearTimers();
    if (optionalMessage) syncBaseMessage = optionalMessage;
    let line = syncBaseMessage || "Syncing…";
    if (syncInFlight > 1) line += " (" + syncInFlight + ")";
    applyProgressUI(line);
  }

  function aggregateSyncOutcomes(arr) {
    if (!arr.length) return { ok: true, message: "Done." };
    if (arr.length === 1) return { ok: arr[0].ok, message: arr[0].message };
    let failed = arr.filter(function (x) {
      return !x.ok;
    });
    let allOk = failed.length === 0;
    if (allOk) {
      return {
        ok: true,
        message: "All " + arr.length + " configuration syncs finished successfully.",
      };
    }
    let first = failed[0].message || "Error";
    let extra = failed.length > 1 ? " (+" + (failed.length - 1) + " more)" : "";
    return {
      ok: false,
      message: failed.length + " of " + arr.length + " syncs failed. " + first + extra,
    };
  }

  /**
   * Start a tracked configuration sync. Returns batch id — pass to gcGlobalBannerSyncEnd.
   * @param {string} [message] Progress line (shared for all concurrent syncs in this batch).
   */
  function syncBegin(message) {
    let bid = syncBatchId;
    syncInFlight++;
    renderSyncProgress(message);
    return bid;
  }

  function syncEnd(bid, ok, message) {
    if (bid !== syncBatchId) return;
    syncOutcomes.push({ ok: !!ok, message: message || "" });
    syncInFlight--;
    if (syncInFlight < 0) syncInFlight = 0;
    if (syncInFlight === 0) {
      let agg = aggregateSyncOutcomes(syncOutcomes);
      syncOutcomes = [];
      showResult(agg.ok, agg.message);
    } else {
      renderSyncProgress();
    }
  }

  function onRollupDone(el) {
    el.hidden = true;
    el.className = "gc-global-banner gc-global-banner--hidden";
    el.removeAttribute("data-gc-banner-phase");
    el.removeAttribute("aria-busy");
    setGlobalBannerProgressBar(el, false);
    let text = el.querySelector(".gc-global-banner__text");
    let icon = el.querySelector(".gc-global-banner__icon");
    if (text) text.textContent = "";
    if (icon) icon.innerHTML = "";
    setResultCloseVisible(el, false);
    rollupTimer = null;
    scheduleSyncAppFlyoutTopOffset();
  }

  function startRollup() {
    let el = root();
    if (!el) return;
    el.classList.add("gc-global-banner--rollup");
    scheduleSyncAppFlyoutTopOffset();
    if (rollupTimer) clearTimeout(rollupTimer);
    rollupTimer = setTimeout(function () {
      onRollupDone(el);
    }, ROLLUP_MS);
  }

  function showResult(ok, message) {
    clearTimers();
    syncResetBatch();
    let el = root();
    if (!el) return;
    resetRollupState(el);
    el.hidden = false;
    el.removeAttribute("data-gc-banner-phase");
    el.removeAttribute("aria-busy");
    el.setAttribute("data-gc-banner-phase", ok ? "success" : "error");
    el.className =
      "gc-global-banner " + (ok ? "gc-global-banner--success" : "gc-global-banner--error");
    let icon = el.querySelector(".gc-global-banner__icon");
    let text = el.querySelector(".gc-global-banner__text");
    if (icon) icon.innerHTML = ok ? CHECK_SVG : ERROR_SVG;
    if (text) text.textContent = message || (ok ? "Done." : "Something went wrong.");
    setGlobalBannerProgressBar(el, false);
    setResultCloseVisible(el, true);
    hideTimer = setTimeout(startRollup, RESULT_HOLD_MS);
    scheduleSyncAppFlyoutTopOffset();
  }

  let bannerEl = root();
  if (bannerEl) {
    bannerEl.addEventListener("click", function (ev) {
      if (!ev.target.closest(".gc-global-banner__close")) return;
      dismissResultIfShowing();
    });
    if (typeof ResizeObserver !== "undefined") {
      try {
        new ResizeObserver(scheduleSyncAppFlyoutTopOffset).observe(bannerEl);
      } catch (eRo) {}
    }
  }

  globalThis.addEventListener("resize", scheduleSyncAppFlyoutTopOffset);

  let topBarEl = document.querySelector(".app-shell > .top-bar");
  if (topBarEl && typeof ResizeObserver !== "undefined") {
    try {
      new ResizeObserver(scheduleSyncAppFlyoutTopOffset).observe(topBarEl);
    } catch (eTopRo) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleSyncAppFlyoutTopOffset);
  } else {
    scheduleSyncAppFlyoutTopOffset();
  }

  globalThis.gcGlobalBannerShowProgress = showProgress;
  globalThis.gcGlobalBannerShowResult = showResult;
  globalThis.gcGlobalBannerSyncBegin = syncBegin;
  globalThis.gcGlobalBannerSyncEnd = syncEnd;
  globalThis.gcGlobalBannerTrackBackgroundSync = trackBackgroundSync;

  globalThis.addEventListener("message", function (ev) {
    if (ev.origin !== globalThis.location.origin) return;
    let d = ev.data;
    if (!d || d.source !== "ground-control" || d.type !== "gc-global-banner") return;
    if (d.phase === "progress") showProgress(d.message);
    else if (d.phase === "background") trackBackgroundSync(d.message, d.firewall_ids ? { firewall_ids: d.firewall_ids } : undefined);
    else if (d.phase === "result") showResult(!!d.ok, d.message);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", restoreBackgroundBannerIfNeeded);
  } else {
    restoreBackgroundBannerIfNeeded();
  }
})();
