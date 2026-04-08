(function () {
  "use strict";

  var root = document.querySelector("[data-gc-dashboard-api]");
  if (!root || !window.Chart) return;

  var apiUrl = root.getAttribute("data-gc-dashboard-api") || "";
  var statusEl = document.getElementById("gc-dashboard-status");
  var emptyHint = document.getElementById("gc-dashboard-empty-hint");

  var charts = {
    connected: null,
    syncTypes: null,
    syncRuns: null,
    deployHbar: null,
    cacheStacked: null,
    latency: [],
  };
  var layoutStorageKey = "gc.dashboard.layout.v1";
  var widgetRoot = null;
  var resizeObserver = null;
  var saveLayoutTimer = null;

  function destroyChart(ch) {
    if (ch) {
      try {
        ch.destroy();
      } catch (e) {}
    }
    return null;
  }

  function clearOfflineStatDanger() {
    var offlineEl = document.getElementById("gc-dashboard-offline");
    if (offlineEl) offlineEl.classList.remove("dashboard-page__stat-value--danger");
  }

  function clearPendingStatDanger() {
    var el = document.getElementById("gc-dashboard-pending");
    if (el) el.classList.remove("dashboard-page__stat-value--danger");
  }

  function clearHistDeniedDanger() {
    ["gc-dashboard-hist-denied-7d", "gc-dashboard-hist-denied-today"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove("dashboard-page__stat-value--danger");
    });
  }

  function resetHistoryStatPlaceholders() {
    ["gc-dashboard-hist-approved-7d", "gc-dashboard-hist-denied-7d", "gc-dashboard-hist-approved-today", "gc-dashboard-hist-denied-today"].forEach(
      function (id) {
        setText(id, "—");
      }
    );
  }

  function destroyAllCharts() {
    charts.connected = destroyChart(charts.connected);
    charts.syncTypes = destroyChart(charts.syncTypes);
    charts.syncRuns = destroyChart(charts.syncRuns);
    charts.deployHbar = destroyChart(charts.deployHbar);
    charts.cacheStacked = destroyChart(charts.cacheStacked);
    charts.latency.forEach(function (c) {
      destroyChart(c);
    });
    charts.latency = [];
    var grid = document.getElementById("gc-dashboard-latency-grid");
    if (grid) grid.innerHTML = "";
  }

  function readSavedLayout() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(layoutStorageKey) : "";
      if (!raw) return { order: [], heights: {} };
      var parsed = JSON.parse(raw);
      return {
        order: Array.isArray(parsed.order) ? parsed.order : [],
        heights: parsed && parsed.heights && typeof parsed.heights === "object" ? parsed.heights : {},
      };
    } catch (e) {
      return { order: [], heights: {} };
    }
  }

  function saveLayoutSoon() {
    if (saveLayoutTimer) window.clearTimeout(saveLayoutTimer);
    saveLayoutTimer = window.setTimeout(function () {
      saveLayoutTimer = null;
      saveLayoutNow();
    }, 180);
  }

  function saveLayoutNow() {
    if (!widgetRoot || !window.localStorage) return;
    var order = [];
    var heights = {};
    widgetRoot.querySelectorAll(".dashboard-page__widget").forEach(function (widget) {
      var id = widget.getAttribute("data-widget-id");
      if (id) order.push(id);
      widget.querySelectorAll(".dashboard-page__chart-wrap[data-resize-key]").forEach(function (wrap) {
        var key = wrap.getAttribute("data-resize-key");
        if (!key) return;
        var h = Math.round(wrap.getBoundingClientRect().height || 0);
        if (h > 0) heights[key] = h;
      });
    });
    try {
      window.localStorage.setItem(
        layoutStorageKey,
        JSON.stringify({
          order: order,
          heights: heights,
          ts: Date.now(),
        })
      );
    } catch (e) {}
  }

  function applySavedOrder(saved) {
    if (!widgetRoot || !saved || !Array.isArray(saved.order) || saved.order.length === 0) return;
    var byId = {};
    widgetRoot.querySelectorAll(".dashboard-page__widget").forEach(function (widget) {
      var id = widget.getAttribute("data-widget-id");
      if (id) byId[id] = widget;
    });
    saved.order.forEach(function (id) {
      var widget = byId[id];
      if (widget) widgetRoot.appendChild(widget);
    });
  }

  function clampHeight(wrap, height) {
    var minH = parseInt(wrap.getAttribute("data-min-height") || "220", 10);
    var maxH = parseInt(wrap.getAttribute("data-max-height") || "520", 10);
    if (!isFinite(minH)) minH = 220;
    if (!isFinite(maxH)) maxH = 520;
    return Math.max(minH, Math.min(maxH, height));
  }

  function applySavedHeights(saved) {
    if (!widgetRoot || !saved || !saved.heights) return;
    widgetRoot.querySelectorAll(".dashboard-page__chart-wrap[data-resize-key]").forEach(function (wrap) {
      var key = wrap.getAttribute("data-resize-key");
      var h = key ? saved.heights[key] : null;
      if (typeof h !== "number" || !isFinite(h) || h <= 0) return;
      var clamped = clampHeight(wrap, h);
      wrap.style.height = clamped + "px";
      wrap.setAttribute("data-user-resized", "1");
    });
  }

  function decorateWidget(widget) {
    if (!widget || widget.getAttribute("data-widget-ready") === "1") return;
    widget.setAttribute("data-widget-ready", "1");
    var heading = widget.querySelector(".dashboard-page__panel-title");
    if (!heading) return;
    var controls = document.createElement("div");
    controls.className = "dashboard-page__widget-controls";
    var dragBtn = document.createElement("button");
    dragBtn.type = "button";
    dragBtn.className = "dashboard-page__widget-btn dashboard-page__widget-btn--drag";
    dragBtn.textContent = "↕";
    dragBtn.setAttribute("title", "Drag to move this widget");
    dragBtn.setAttribute("aria-label", "Drag to move this widget");
    dragBtn.draggable = true;
    var resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "dashboard-page__widget-btn";
    resetBtn.textContent = "Reset size";
    resetBtn.setAttribute("title", "Reset chart size");
    resetBtn.addEventListener("click", function () {
      widget.querySelectorAll(".dashboard-page__chart-wrap").forEach(function (wrap) {
        wrap.style.height = "";
        wrap.removeAttribute("data-user-resized");
      });
      saveLayoutSoon();
      charts.latency.forEach(function (chart) {
        if (chart && typeof chart.resize === "function") chart.resize();
      });
      if (charts.connected && typeof charts.connected.resize === "function") charts.connected.resize();
      if (charts.syncRuns && typeof charts.syncRuns.resize === "function") charts.syncRuns.resize();
      if (charts.deployHbar && typeof charts.deployHbar.resize === "function") charts.deployHbar.resize();
      if (charts.cacheStacked && typeof charts.cacheStacked.resize === "function") charts.cacheStacked.resize();
      if (charts.syncTypes && typeof charts.syncTypes.resize === "function") charts.syncTypes.resize();
    });
    controls.appendChild(dragBtn);
    controls.appendChild(resetBtn);
    var header = document.createElement("div");
    header.className = "dashboard-page__widget-header";
    heading.parentNode.insertBefore(header, heading);
    header.appendChild(heading);
    header.appendChild(controls);
    widget.draggable = true;
  }

  function bindWidgetDragging() {
    if (!widgetRoot) return;
    var dragging = null;
    widgetRoot.addEventListener("dragstart", function (ev) {
      var handle = ev.target && ev.target.closest ? ev.target.closest(".dashboard-page__widget-btn--drag") : null;
      if (!handle) {
        ev.preventDefault();
        return;
      }
      var widget = handle.closest(".dashboard-page__widget");
      if (!widget) return;
      dragging = widget;
      widget.classList.add("dragging");
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", widget.getAttribute("data-widget-id") || "");
      }
    });
    widgetRoot.addEventListener("dragend", function () {
      widgetRoot.querySelectorAll(".dashboard-page__widget").forEach(function (w) {
        w.classList.remove("drop-target");
        w.classList.remove("dragging");
      });
      dragging = null;
      saveLayoutSoon();
    });
    widgetRoot.addEventListener("dragover", function (ev) {
      if (!dragging) return;
      var over = ev.target && ev.target.closest ? ev.target.closest(".dashboard-page__widget") : null;
      if (!over || over === dragging) return;
      ev.preventDefault();
      widgetRoot.querySelectorAll(".dashboard-page__widget").forEach(function (w) {
        w.classList.remove("drop-target");
      });
      over.classList.add("drop-target");
      var rect = over.getBoundingClientRect();
      var insertBefore = ev.clientY < rect.top + rect.height / 2;
      if (insertBefore) widgetRoot.insertBefore(dragging, over);
      else widgetRoot.insertBefore(dragging, over.nextSibling);
    });
    widgetRoot.addEventListener("drop", function (ev) {
      if (!dragging) return;
      ev.preventDefault();
      widgetRoot.querySelectorAll(".dashboard-page__widget").forEach(function (w) {
        w.classList.remove("drop-target");
      });
      saveLayoutSoon();
    });
  }

  function bindChartResizing() {
    if (!widgetRoot || typeof ResizeObserver !== "function") return;
    resizeObserver = new ResizeObserver(function (entries) {
      entries.forEach(function (entry) {
        var wrap = entry.target;
        if (!(wrap instanceof HTMLElement)) return;
        var h = Math.round(entry.contentRect.height || 0);
        if (!h) return;
        var clamped = clampHeight(wrap, h);
        if (clamped !== h) wrap.style.height = clamped + "px";
        wrap.setAttribute("data-user-resized", "1");
        saveLayoutSoon();
      });
    });
    widgetRoot.querySelectorAll(".dashboard-page__chart-wrap[data-resize-key]").forEach(function (wrap) {
      resizeObserver.observe(wrap);
    });
  }

  function initializeDashboardLayout() {
    widgetRoot = document.getElementById("gc-dashboard-widgets");
    if (!widgetRoot) return;
    var saved = readSavedLayout();
    applySavedOrder(saved);
    widgetRoot.querySelectorAll(".dashboard-page__widget").forEach(function (widget) {
      decorateWidget(widget);
      var id = widget.getAttribute("data-widget-id") || "widget";
      widget.querySelectorAll(".dashboard-page__chart-wrap").forEach(function (wrap, idx) {
        var maxH = wrap.classList.contains("dashboard-page__chart-wrap--sync") ? 600 : 520;
        var minH = wrap.classList.contains("dashboard-page__chart-wrap--sync") ? 320 : 220;
        wrap.setAttribute("data-resize-key", id + ":" + idx);
        wrap.setAttribute("data-max-height", String(maxH));
        wrap.setAttribute("data-min-height", String(minH));
      });
    });
    applySavedHeights(saved);
    bindWidgetDragging();
    bindChartResizing();
  }

  function getSelectedIds() {
    if (typeof window.gcGetSelectedFirewallIds !== "function") return [];
    var ids = window.gcGetSelectedFirewallIds();
    return Array.isArray(ids) ? ids : [];
  }

  function themeColors() {
    var r = getComputedStyle(document.documentElement);
    var b = document.body ? getComputedStyle(document.body) : r;
    return {
      accent: (r.getPropertyValue("--accent") || "#0066cc").trim(),
      success: (r.getPropertyValue("--success") || "#1a9b4a").trim(),
      muted: (r.getPropertyValue("--muted") || "#666666").trim(),
      danger: (r.getPropertyValue("--danger") || "#c62828").trim(),
      warning: (r.getPropertyValue("--error") || "#b8860b").trim(),
      text: (r.getPropertyValue("--text") || "#1a1a1a").trim(),
      fontFamily: (b.fontFamily || r.fontFamily || "system-ui, sans-serif").trim(),
    };
  }


  function truncateSankeyDisplayLabel(s, maxLen) {
    var str = String(s == null ? "" : s).trim();
    if (!maxLen || str.length <= maxLen) return str;
    if (maxLen < 2) return "\u2026";
    return str.slice(0, maxLen - 1) + "\u2026";
  }

  function formatDayLabel(isoDate) {
    try {
      var p = String(isoDate || "").split("-");
      if (p.length !== 3) return isoDate;
      var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      if (isNaN(d.getTime())) return isoDate;
      return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    } catch (e) {
      return isoDate;
    }
  }

  /** Labels for UTC calendar date (matches bucket ``date`` / midnight grid). */
  function formatDayLabelUtc(isoDate) {
    try {
      var p = String(isoDate || "").split("-");
      if (p.length !== 3) return isoDate;
      var d = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
      if (isNaN(d.getTime())) return isoDate;
      return d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    } catch (eUtc) {
      return isoDate;
    }
  }

  function isUtcMidnightHourStart(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return false;
    return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  }

  function isLocalMidnightHourStart(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return false;
    return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  }

  function chartUsesUtcBasis(tzLabel) {
    return !tzLabel || tzLabel === "UTC";
  }

  function formatProbeTime(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e2) {
      return iso;
    }
  }

  function renderConnected(canvas, hourlySeries, colors, managedCount, chartTzLabel) {
    charts.connected = destroyChart(charts.connected);
    var raw = hourlySeries || [];
    var nowMs = Date.now();
    var series = raw.filter(function (d) {
      var t = d.hour_start ? new Date(d.hour_start).getTime() : NaN;
      return !isNaN(t) && t <= nowMs;
    });
    if (series.length === 0) return;
    var utcBasis = chartUsesUtcBasis(chartTzLabel);

    var labels = series.map(function (d) {
      var atMidnight = utcBasis
        ? isUtcMidnightHourStart(d.hour_start)
        : isLocalMidnightHourStart(d.hour_start);
      if (!atMidnight) return "";
      return utcBasis ? formatDayLabelUtc(d.date) : formatDayLabel(d.date);
    });
    var connectedVals = series.map(function (d) {
      return typeof d.connected_count === "number" ? d.connected_count : 0;
    });
    var offlineVals = series.map(function (d) {
      return typeof d.offline_count === "number" ? d.offline_count : 0;
    });
    var maxData = 0;
    connectedVals.forEach(function (v) {
      maxData = Math.max(maxData, v);
    });
    offlineVals.forEach(function (v) {
      maxData = Math.max(maxData, v);
    });
    var mc = typeof managedCount === "number" && !isNaN(managedCount) ? managedCount : 0;
    var ySuggestedMax = Math.max(maxData, mc);
    var dense = series.length > 48;

    function xGridStyle(ctx) {
      var i = typeof ctx.index === "number" ? ctx.index : -1;
      if (i < 0 || i >= series.length) {
        return { color: "rgba(0,0,0,0.06)", lineWidth: 1 };
      }
      var row = series[i];
      var atMid =
        row &&
        row.hour_start &&
        (utcBasis ? isUtcMidnightHourStart(row.hour_start) : isLocalMidnightHourStart(row.hour_start));
      if (atMid) {
        return { color: "rgba(0,0,0,0.22)", lineWidth: 1.5 };
      }
      return { color: "rgba(0,0,0,0.05)", lineWidth: 1 };
    }

    charts.connected = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Reachable (monitored)",
            data: connectedVals,
            borderColor: colors.success,
            backgroundColor: colors.success + "33",
            fill: true,
            tension: 0.2,
            pointRadius: dense ? 0 : 2,
            pointHoverRadius: 4,
            borderWidth: 2,
          },
          {
            label: "Failed checks (that hour)",
            data: offlineVals,
            borderColor: colors.danger,
            backgroundColor: "transparent",
            fill: false,
            tension: 0.2,
            pointRadius: dense ? 0 : 2,
            pointHoverRadius: 4,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              title: function (items) {
                var i = items.length ? items[0].dataIndex : 0;
                var row = series[i];
                if (!row || !row.hour_start) return "";
                var s = new Date(row.hour_start);
                if (isNaN(s.getTime())) return row.hour_start;
                var e = new Date(s.getTime() + 3600000);
                return (
                  s.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) +
                  " – " +
                  e.toLocaleString(undefined, { timeStyle: "short" })
                );
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: colors.muted,
              maxRotation: 0,
              autoSkip: false,
            },
            grid: {
              color: function (ctx) {
                return xGridStyle(ctx).color;
              },
              lineWidth: function (ctx) {
                return xGridStyle(ctx).lineWidth;
              },
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: ySuggestedMax > 0 ? ySuggestedMax : undefined,
            ticks: { stepSize: 1, color: colors.muted },
            title: { display: true, text: "Firewalls" },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
        },
      },
    });
  }

  function setDashboardChartSection(canvasId, emptyId, showChart) {
    var canvas = document.getElementById(canvasId);
    var emptyEl = document.getElementById(emptyId);
    var wrap = canvas && canvas.parentElement;
    if (emptyEl) emptyEl.hidden = !!showChart;
    if (wrap) wrap.hidden = !showChart;
  }

  function hideDashboardInsightPanels() {
    var pairs = [
      ["gc-dashboard-sync-runs-chart", "gc-dashboard-sync-runs-empty"],
      ["gc-dashboard-deploy-chart", "gc-dashboard-deploy-empty"],
      ["gc-dashboard-cache-chart", "gc-dashboard-cache-empty"],
    ];
    pairs.forEach(function (pair) {
      var canvas = document.getElementById(pair[0]);
      var emptyEl = document.getElementById(pair[1]);
      var wrap = canvas && canvas.parentElement;
      if (wrap) wrap.hidden = true;
      if (emptyEl) emptyEl.hidden = true;
    });
  }

  function renderSyncRunsDaily(canvas, series, colors) {
    charts.syncRuns = destroyChart(charts.syncRuns);
    var raw = series || [];
    if (!canvas || raw.length === 0) {
      setDashboardChartSection("gc-dashboard-sync-runs-chart", "gc-dashboard-sync-runs-empty", false);
      return;
    }
    setDashboardChartSection("gc-dashboard-sync-runs-chart", "gc-dashboard-sync-runs-empty", true);

    var labels = raw.map(function (d) {
      return formatDayLabelUtc(d.date);
    });
    var success = raw.map(function (d) {
      return d.success != null ? d.success : 0;
    });
    var errors = raw.map(function (d) {
      return d.error != null ? d.error : 0;
    });
    var running = raw.map(function (d) {
      return (d.running != null ? d.running : 0) + (d.other != null ? d.other : 0);
    });

    charts.syncRuns = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Success",
            data: success,
            backgroundColor: colors.success + "cc",
            stack: "sync",
          },
          {
            label: "Error",
            data: errors,
            backgroundColor: colors.danger + "cc",
            stack: "sync",
          },
          {
            label: "Running / other",
            data: running,
            backgroundColor: colors.warning + "cc",
            stack: "sync",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top" },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: colors.muted, maxRotation: 0, autoSkip: true },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { stepSize: 1, color: colors.muted },
            title: { display: true, text: "Runs" },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
        },
      },
    });
  }

  function renderDeployHorizontalBar(canvas, rows, labelMap, colors) {
    charts.deployHbar = destroyChart(charts.deployHbar);
    var list = (rows || []).slice();
    list.sort(function (a, b) {
      return (a.count || 0) - (b.count || 0);
    });
    list = list.slice(-15);
    if (!canvas || list.length === 0) {
      setDashboardChartSection("gc-dashboard-deploy-chart", "gc-dashboard-deploy-empty", false);
      return;
    }
    setDashboardChartSection("gc-dashboard-deploy-chart", "gc-dashboard-deploy-empty", true);

    var labels = list.map(function (r) {
      var k = firewallFwKey(r.firewall_id);
      return labelMap[k] || "Firewall #" + r.firewall_id;
    });
    var vals = list.map(function (r) {
      return r.count != null ? r.count : 0;
    });

    charts.deployHbar = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Pending approval",
            data: vals,
            backgroundColor: colors.accent + "aa",
            borderColor: colors.accent,
            borderWidth: 1,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: colors.muted },
            title: { display: true, text: "Tasks", color: colors.muted },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
          y: {
            ticks: { color: colors.muted },
            grid: { display: false },
          },
        },
      },
    });
  }

  function renderCacheFreshnessStackedByType(canvas, rows, colors) {
    charts.cacheStacked = destroyChart(charts.cacheStacked);
    var list = rows || [];
    if (!canvas || list.length === 0) {
      setDashboardChartSection("gc-dashboard-cache-chart", "gc-dashboard-cache-empty", false);
      return;
    }
    setDashboardChartSection("gc-dashboard-cache-chart", "gc-dashboard-cache-empty", true);

    var labels = list.map(function (r) {
      var lab = (r.label && String(r.label).trim()) || r.entity_type || "—";
      return truncateSankeyDisplayLabel(lab, 26);
    });
    var fresh = list.map(function (r) {
      return r.fresh != null ? r.fresh : 0;
    });
    var recent = list.map(function (r) {
      return r.recent != null ? r.recent : 0;
    });
    var aging = list.map(function (r) {
      return r.aging != null ? r.aging : 0;
    });
    var stale = list.map(function (r) {
      return r.stale != null ? r.stale : 0;
    });

    charts.cacheStacked = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Fresh (<1 h)",
            data: fresh,
            backgroundColor: colors.success + "cc",
            stack: "age",
          },
          {
            label: "1–24 h",
            data: recent,
            backgroundColor: colors.accent + "aa",
            stack: "age",
          },
          {
            label: "1–7 d",
            data: aging,
            backgroundColor: colors.warning + "bb",
            stack: "age",
          },
          {
            label: "≥7 d",
            data: stale,
            backgroundColor: colors.danger + "aa",
            stack: "age",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top" },
          tooltip: {
            callbacks: {
              footer: function (items) {
                if (!items || !items.length) return "";
                var i = items[0].dataIndex;
                var row = list[i];
                if (!row) return "";
                var t =
                  (row.fresh || 0) +
                  (row.recent || 0) +
                  (row.aging || 0) +
                  (row.stale || 0);
                return "Total rows: " + t;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              color: colors.muted,
              maxRotation: 40,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 16,
            },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { stepSize: 1, color: colors.muted },
            title: { display: true, text: "Cached rows", color: colors.muted },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
        },
      },
    });
  }

  function sankeyControllerAvailable() {
    try {
      return !!(window.Chart && Chart.registry && Chart.registry.getController("sankey"));
    } catch (eSankey) {
      return false;
    }
  }

  function hashString32(s) {
    var h = 2166136261;
    var str = String(s);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function hslForEntityType(entityType) {
    var hue = hashString32(entityType) % 360;
    return "hsl(" + hue + ", 58%, 46%)";
  }

  function hslHoverForEntityType(entityType) {
    var hue = hashString32(entityType) % 360;
    return "hsl(" + hue + ", 58%, 38%)";
  }

  function firewallFwKey(id) {
    return "fw:" + id;
  }

  function buildFirewallLabelMap(firewalls) {
    var names = (firewalls || []).map(function (fw) {
      var n = (fw.name && String(fw.name).trim()) || (fw.host && String(fw.host).trim()) || "";
      return n || "Firewall " + fw.id;
    });
    var freq = {};
    names.forEach(function (n) {
      freq[n] = (freq[n] || 0) + 1;
    });
    var labels = {};
    (firewalls || []).forEach(function (fw, i) {
      var base = names[i];
      labels[firewallFwKey(fw.id)] =
        freq[base] > 1 ? base + " · #" + fw.id : base;
    });
    return labels;
  }

  var sankeyToolbarBound = false;
  var sankeyState = null;

  function buildSankeyTypeList(flows, entity_rows) {
    var labelById = {};
    (entity_rows || []).forEach(function (r) {
      if (r && r.entity_type) labelById[r.entity_type] = r.label || r.entity_type;
    });
    var seen = {};
    (flows || []).forEach(function (f) {
      if (f && f.entity_type) seen[f.entity_type] = true;
    });
    var types = Object.keys(seen).map(function (et) {
      return { entity_type: et, label: labelById[et] || et };
    });
    types.sort(function (a, b) {
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
    return types;
  }

  function closeSankeyTypePanel() {
    var panel = document.getElementById("gc-dashboard-sankey-panel");
    var trigger = document.getElementById("gc-dashboard-sankey-trigger");
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function resetSankeyToolbar() {
    sankeyState = null;
    var tb = document.getElementById("gc-dashboard-sankey-toolbar");
    var list = document.getElementById("gc-dashboard-sankey-list");
    var srch = document.getElementById("gc-dashboard-sankey-search");
    var fe = document.getElementById("gc-dashboard-sankey-filter-empty");
    if (tb) tb.hidden = true;
    if (list) list.innerHTML = "";
    if (srch) srch.value = "";
    if (fe) fe.hidden = true;
    closeSankeyTypePanel();
  }

  function updateSankeyTriggerLabel() {
    var el = document.getElementById("gc-dashboard-sankey-trigger-label");
    if (!el || !sankeyState) return;
    var n = sankeyState.types.length;
    var s = sankeyState.selected.size;
    if (n === 0) el.textContent = "Sync types";
    else if (s === 0) el.textContent = "Choose types…";
    else if (s === n) el.textContent = "All types (" + n + ")";
    else el.textContent = s + " of " + n + " types";
  }

  function filterSankeyTypeListRows() {
    var search = document.getElementById("gc-dashboard-sankey-search");
    var list = document.getElementById("gc-dashboard-sankey-list");
    if (!search || !list) return;
    var q = (search.value || "").trim().toLowerCase();
    list.querySelectorAll(".dashboard-page__sankey-option").forEach(function (row) {
      var lab = row.getAttribute("data-label") || "";
      row.hidden = !!(q && lab.indexOf(q) === -1);
    });
  }

  function syncSankeyCheckboxesToSelection() {
    if (!sankeyState) return;
    var list = document.getElementById("gc-dashboard-sankey-list");
    if (!list) return;
    list.querySelectorAll('input[type="checkbox"][data-entity-type]').forEach(function (inp) {
      var et = inp.getAttribute("data-entity-type");
      inp.checked = et ? sankeyState.selected.has(et) : false;
    });
  }

  function applySankeyTypeFilter() {
    var sCanvas = document.getElementById("gc-dashboard-sync-chart");
    var filterEmpty = document.getElementById("gc-dashboard-sankey-filter-empty");
    if (!sankeyState || !sCanvas) return;
    var colors = themeColors();
    var selected = sankeyState.selected;
    updateSankeyTriggerLabel();

    if (selected.size === 0) {
      charts.syncTypes = destroyChart(charts.syncTypes);
      var wrap0 = sCanvas.parentElement;
      if (wrap0 && wrap0.style) wrap0.style.height = "";
      sCanvas.hidden = true;
      if (filterEmpty) filterEmpty.hidden = false;
      return;
    }

    if (filterEmpty) filterEmpty.hidden = true;
    sCanvas.hidden = false;

    var filtered = sankeyState.flows.filter(function (f) {
      return f && selected.has(f.entity_type);
    });

    renderSyncSankey(
      sCanvas,
      {
        flows: filtered,
        entity_rows: sankeyState.entity_rows,
        firewalls: sankeyState.firewalls,
      },
      colors
    );
  }

  function populateSankeyTypeList() {
    var list = document.getElementById("gc-dashboard-sankey-list");
    if (!list || !sankeyState) return;
    list.innerHTML = "";
    sankeyState.types.forEach(function (tp) {
      var labelEl = document.createElement("label");
      labelEl.className = "dashboard-page__sankey-option";
      labelEl.setAttribute("data-label", String(tp.label || "").toLowerCase());
      var inp = document.createElement("input");
      inp.type = "checkbox";
      inp.checked = sankeyState.selected.has(tp.entity_type);
      inp.setAttribute("data-entity-type", tp.entity_type);
      var span = document.createElement("span");
      span.textContent = tp.label;
      labelEl.appendChild(inp);
      labelEl.appendChild(span);
      list.appendChild(labelEl);
    });
    filterSankeyTypeListRows();
  }

  function setupSankeyToolbar(flows, entity_rows, firewalls) {
    closeSankeyTypePanel();
    var tb = document.getElementById("gc-dashboard-sankey-toolbar");
    if (!tb) return;
    var types = buildSankeyTypeList(flows, entity_rows);
    var selected = new Set();
    types.forEach(function (t) {
      selected.add(t.entity_type);
    });
    sankeyState = {
      flows: flows.slice(),
      entity_rows: entity_rows || [],
      firewalls: firewalls || [],
      types: types,
      selected: selected,
    };
    tb.hidden = false;
    populateSankeyTypeList();
    applySankeyTypeFilter();
    ensureSankeyToolbarBindings();
  }

  function ensureSankeyToolbarBindings() {
    if (sankeyToolbarBound) return;
    sankeyToolbarBound = true;

    var trigger = document.getElementById("gc-dashboard-sankey-trigger");
    var panel = document.getElementById("gc-dashboard-sankey-panel");
    var root = document.getElementById("gc-dashboard-sankey-root");
    var list = document.getElementById("gc-dashboard-sankey-list");
    var search = document.getElementById("gc-dashboard-sankey-search");
    var btnAll = document.getElementById("gc-dashboard-sankey-all");
    var btnNone = document.getElementById("gc-dashboard-sankey-none");

    if (trigger && panel) {
      trigger.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var willOpen = panel.hidden;
        if (willOpen) {
          panel.hidden = false;
          trigger.setAttribute("aria-expanded", "true");
          if (search) {
            search.value = "";
            filterSankeyTypeListRows();
            setTimeout(function () {
              search.focus();
            }, 0);
          }
        } else {
          closeSankeyTypePanel();
        }
      });
    }

    document.addEventListener("click", function (ev) {
      var tb = document.getElementById("gc-dashboard-sankey-toolbar");
      if (!tb || tb.hidden || !root) return;
      if (root.contains(ev.target)) return;
      closeSankeyTypePanel();
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      var p = document.getElementById("gc-dashboard-sankey-panel");
      if (p && !p.hidden) {
        ev.preventDefault();
        closeSankeyTypePanel();
      }
    });

    if (search) {
      search.addEventListener("input", filterSankeyTypeListRows);
      search.addEventListener("click", function (ev) {
        ev.stopPropagation();
      });
    }

    if (list) {
      list.addEventListener("change", function (ev) {
        var t = ev.target;
        if (!t || t.type !== "checkbox" || !sankeyState) return;
        var et = t.getAttribute("data-entity-type");
        if (!et) return;
        if (t.checked) sankeyState.selected.add(et);
        else sankeyState.selected.delete(et);
        applySankeyTypeFilter();
      });
      list.addEventListener("click", function (ev) {
        ev.stopPropagation();
      });
    }

    if (btnAll && panel) {
      btnAll.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (!sankeyState) return;
        sankeyState.types.forEach(function (tp) {
          sankeyState.selected.add(tp.entity_type);
        });
        syncSankeyCheckboxesToSelection();
        applySankeyTypeFilter();
      });
    }

    if (btnNone && panel) {
      btnNone.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (!sankeyState) return;
        sankeyState.selected.clear();
        syncSankeyCheckboxesToSelection();
        applySankeyTypeFilter();
      });
    }

    if (panel) {
      panel.addEventListener("click", function (ev) {
        ev.stopPropagation();
      });
    }
  }

  function renderSyncSankey(canvas, payload, theme) {
    charts.syncTypes = destroyChart(charts.syncTypes);
    var wrap = canvas && canvas.parentElement;
    if (wrap && wrap.style) wrap.style.height = "";

    var flows = (payload && payload.flows) || [];
    var entityRows = (payload && payload.entity_rows) || [];
    var firewalls = (payload && payload.firewalls) || [];

    if (!canvas || !sankeyControllerAvailable()) return;
    if (!flows.length) return;

    var entityLabel = {};
    entityRows.forEach(function (r) {
      if (r && r.entity_type)
        entityLabel[r.entity_type] = r.label || r.entity_type;
    });

    var fwLabels = buildFirewallLabelMap(firewalls);
    flows.forEach(function (f) {
      if (!f || f.firewall_id == null) return;
      var k = firewallFwKey(f.firewall_id);
      if (!fwLabels[k]) fwLabels[k] = "Firewall #" + f.firewall_id;
    });
    var nodeLabels = Object.assign({}, entityLabel, fwLabels);
    var displayLabels = {};
    var labelMaxChars = 36;
    Object.keys(nodeLabels).forEach(function (k) {
      displayLabels[k] = truncateSankeyDisplayLabel(nodeLabels[k], labelMaxChars);
    });

    var column = {};
    flows.forEach(function (f) {
      if (f && f.entity_type != null) column[f.entity_type] = 0;
      if (f && f.firewall_id != null) column[firewallFwKey(f.firewall_id)] = 1;
    });

    var typeKeys = {};
    flows.forEach(function (f) {
      if (f && f.entity_type) typeKeys[f.entity_type] = true;
    });
    var colorByType = {};
    Object.keys(typeKeys).forEach(function (et) {
      colorByType[et] = hslForEntityType(et);
    });
    var hoverByType = {};
    Object.keys(typeKeys).forEach(function (et) {
      hoverByType[et] = hslHoverForEntityType(et);
    });

    var data = flows.map(function (f) {
      return {
        from: f.entity_type,
        to: firewallFwKey(f.firewall_id),
        flow: typeof f.count === "number" ? f.count : 0,
      };
    });

    var leftN = Object.keys(
      data.reduce(function (acc, row) {
        acc[row.from] = true;
        return acc;
      }, {})
    ).length;
    var rightN = Object.keys(
      data.reduce(function (acc, row) {
        acc[row.to] = true;
        return acc;
      }, {})
    ).length;
    var estH = Math.min(600, Math.max(340, Math.max(leftN, rightN) * 26));
    if (wrap && wrap.style && wrap.getAttribute("data-user-resized") !== "1") {
      wrap.style.height = estH + "px";
    }

    charts.syncTypes = new Chart(canvas.getContext("2d"), {
      type: "sankey",
      data: {
        datasets: [
          {
            label: "Cached records",
            data: data,
            labels: displayLabels,
            column: column,
            color: theme.text,
            font: {
              size: 12,
              weight: "600",
              family: theme.fontFamily,
            },
            padding: 6,
            nodeWidth: 14,
            nodePadding: 26,
            borderWidth: 0,
            colorFrom: function (c) {
              var row = c.dataset.data[c.dataIndex];
              return colorByType[row.from] || theme.accent;
            },
            colorTo: function (c) {
              var row = c.dataset.data[c.dataIndex];
              return colorByType[row.from] || theme.accent;
            },
            hoverColorFrom: function (c) {
              var row = c.dataset.data[c.dataIndex];
              return hoverByType[row.from] || theme.accent;
            },
            hoverColorTo: function (c) {
              var row = c.dataset.data[c.dataIndex];
              return hoverByType[row.from] || theme.accent;
            },
            colorMode: "from",
            alpha: 0.58,
            size: "max",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        font: {
          family: theme.fontFamily,
        },
        layout: {
          padding: {
            top: 12,
            left: 18,
            right: 28,
            bottom: 12,
          },
        },
        parsing: {
          from: "from",
          to: "to",
          flow: "flow",
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(26, 26, 26, 0.94)",
            titleColor: "#f5f5f5",
            bodyColor: "#f5f5f5",
            borderColor: "rgba(255,255,255,0.12)",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function (ctx) {
                var raw = ctx.raw;
                if (!raw) return "";
                var fromL = nodeLabels[raw.from] || raw.from;
                var toL = nodeLabels[raw.to] || raw.to;
                return fromL + " → " + toL + ": " + raw.flow;
              },
            },
          },
        },
      },
    });
  }

  function renderLatencyCard(container, fw, series, colors) {
    var wrap = document.createElement("div");
    wrap.className = "dashboard-page__latency-card panel";
    var title = (fw.name && String(fw.name).trim()) || fw.host || "Firewall " + fw.id;
    var sub = fw.monitor_enabled
      ? "Admin UI response time, last 24 hours"
      : "Turn on monitoring to collect latency";
    var head = document.createElement("div");
    head.className = "dashboard-page__latency-head";
    var h3 = document.createElement("h3");
    h3.className = "dashboard-page__latency-title";
    h3.textContent = title;
    var p = document.createElement("p");
    p.className = "dashboard-page__latency-sub muted";
    p.textContent = sub;
    var a = document.createElement("a");
    a.className = "dashboard-page__latency-link";
    a.href = "/firewalls/" + encodeURIComponent(String(fw.id)) + "/monitor";
    a.textContent = "Full monitor";
    head.appendChild(h3);
    head.appendChild(p);
    head.appendChild(a);
    var chartWrap = document.createElement("div");
    chartWrap.className = "dashboard-page__latency-chart-wrap";
    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-label", "Admin UI response time over the last 24 hours");
    chartWrap.appendChild(canvas);
    wrap.appendChild(head);
    wrap.appendChild(chartWrap);
    container.appendChild(wrap);
    if (!canvas) return;
    var pts = (series && series.points) || [];
    var gran = series && series.granularity ? series.granularity : "";
    var labels = pts.map(function (p) {
      return formatProbeTime(p.t);
    });
    var ms = pts.map(function (p) {
      return p.avg_ms != null && typeof p.avg_ms === "number" ? p.avg_ms : null;
    });
    var ch = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Latency (ms)",
            data: ms,
            borderColor: colors.accent,
            backgroundColor: "transparent",
            spanGaps: true,
            tension: 0.2,
            pointRadius: pts.length > 120 ? 0 : 2,
            borderWidth: 2,
            stepped: gran === "raw",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: true, position: "top" },
          tooltip: {
            callbacks: {
              title: function (items) {
                var i = items.length ? items[0].dataIndex : 0;
                return pts[i] && pts[i].t ? pts[i].t : "";
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: colors.muted,
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 8,
            },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
          y: {
            beginAtZero: true,
            ticks: { color: colors.muted },
            title: { display: true, text: "ms" },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
        },
      },
    });
    charts.latency.push(ch);
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function load() {
    var ids = getSelectedIds();
    var q = ids.length ? "?firewall_ids=" + encodeURIComponent(ids.join(",")) : "?firewall_ids=";
    var browserTz = "";
    try {
      browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (eTz) {}
    if (browserTz) q += "&timezone=" + encodeURIComponent(browserTz);
    if (statusEl) statusEl.textContent = "Loading…";
    fetch(apiUrl + q, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (res) {
        return res.json().then(function (j) {
          return { ok: res.ok, status: res.status, body: j };
        });
      })
      .then(function (x) {
        if (!x.ok) {
          destroyAllCharts();
          resetSankeyToolbar();
          clearOfflineStatDanger();
          clearPendingStatDanger();
          clearHistDeniedDanger();
          resetHistoryStatPlaceholders();
          hideDashboardInsightPanels();
          if (x.status === 401) {
            if (statusEl) statusEl.textContent = "Sign in to load dashboard data.";
          } else {
            var d = x.body && x.body.detail;
            if (statusEl) {
              statusEl.textContent =
                typeof d === "string" ? d : d ? JSON.stringify(d) : "Could not load dashboard.";
            }
          }
          return;
        }
        if (statusEl) statusEl.textContent = "";
        var data = x.body;
        var colors = themeColors();

        setText("gc-dashboard-managed", String(data.managed_count != null ? data.managed_count : 0));
        var offlineN = data.offline_count != null ? data.offline_count : 0;
        setText("gc-dashboard-offline", String(offlineN));
        var offlineEl = document.getElementById("gc-dashboard-offline");
        if (offlineEl) {
          offlineEl.classList.toggle("dashboard-page__stat-value--danger", offlineN > 0);
        }
        var pendN = data.pending_tasks_total != null ? data.pending_tasks_total : 0;
        setText("gc-dashboard-pending", String(pendN));
        var pendEl = document.getElementById("gc-dashboard-pending");
        if (pendEl) {
          pendEl.classList.toggle("dashboard-page__stat-value--danger", pendN > 0);
        }

        var hist = data.task_queue_history_summary || {};
        var ha7 = hist.approved_7d != null ? hist.approved_7d : 0;
        var hd7 = hist.denied_7d != null ? hist.denied_7d : 0;
        var hat = hist.approved_today != null ? hist.approved_today : 0;
        var hdt = hist.denied_today != null ? hist.denied_today : 0;
        setText("gc-dashboard-hist-approved-7d", String(ha7));
        setText("gc-dashboard-hist-denied-7d", String(hd7));
        setText("gc-dashboard-hist-approved-today", String(hat));
        setText("gc-dashboard-hist-denied-today", String(hdt));
        var hEl7 = document.getElementById("gc-dashboard-hist-denied-7d");
        if (hEl7) hEl7.classList.toggle("dashboard-page__stat-value--danger", hd7 > 0);
        var hElt = document.getElementById("gc-dashboard-hist-denied-today");
        if (hElt) hElt.classList.toggle("dashboard-page__stat-value--danger", hdt > 0);

        if (emptyHint) {
          emptyHint.hidden = !!(ids.length > 0);
        }

        destroyAllCharts();

        var fwLabelMap = buildFirewallLabelMap(data.firewalls || []);
        renderSyncRunsDaily(
          document.getElementById("gc-dashboard-sync-runs-chart"),
          data.sync_runs_daily || [],
          colors
        );
        renderDeployHorizontalBar(
          document.getElementById("gc-dashboard-deploy-chart"),
          data.pending_tasks_by_firewall || [],
          fwLabelMap,
          colors
        );
        renderCacheFreshnessStackedByType(
          document.getElementById("gc-dashboard-cache-chart"),
          data.cache_freshness_by_entity_type || [],
          colors
        );

        var cCanvas = document.getElementById("gc-dashboard-connected-chart");
        var hourly =
          data.connected_chart_hourly && data.connected_chart_hourly.length
            ? data.connected_chart_hourly
            : [];
        if (cCanvas)
          renderConnected(
            cCanvas,
            hourly,
            colors,
            data.managed_count != null ? data.managed_count : 0,
            data.chart_timezone
          );

        var sCanvas = document.getElementById("gc-dashboard-sync-chart");
        var syncEmptyEl = document.getElementById("gc-dashboard-sync-sankey-empty");
        var filterEmptyEl = document.getElementById("gc-dashboard-sankey-filter-empty");
        var flows = Array.isArray(data.sync_sankey_flows) ? data.sync_sankey_flows : [];
        if (syncEmptyEl) {
          syncEmptyEl.hidden = !(ids.length > 0 && flows.length === 0);
        }
        if (filterEmptyEl) {
          filterEmptyEl.hidden = true;
        }
        if (sCanvas) {
          if (ids.length > 0 && flows.length > 0) {
            setupSankeyToolbar(flows, data.sync_entity_counts || [], data.firewalls || []);
          } else {
            resetSankeyToolbar();
            charts.syncTypes = destroyChart(charts.syncTypes);
            sCanvas.hidden = true;
            var wrapSan = sCanvas.parentElement;
            if (wrapSan && wrapSan.style) wrapSan.style.height = "";
          }
        }

        var grid = document.getElementById("gc-dashboard-latency-grid");
        var latMap = data.latency_by_firewall || {};
        if (grid && Array.isArray(data.firewalls)) {
          data.firewalls.forEach(function (fw) {
            var series = latMap[String(fw.id)] || { points: [] };
            renderLatencyCard(grid, fw, series, colors);
          });
        }
      })
      .catch(function () {
        destroyAllCharts();
        resetSankeyToolbar();
        clearOfflineStatDanger();
        clearPendingStatDanger();
        clearHistDeniedDanger();
        resetHistoryStatPlaceholders();
        hideDashboardInsightPanels();
        if (statusEl) statusEl.textContent = "Network error loading dashboard.";
      });
  }

  var t = null;
  function scheduleLoad() {
    if (t) clearTimeout(t);
    t = setTimeout(function () {
      t = null;
      load();
    }, 120);
  }

  initializeDashboardLayout();
  document.addEventListener("gc-firewall-selection-changed", scheduleLoad);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleLoad);
  } else {
    scheduleLoad();
  }
})();
