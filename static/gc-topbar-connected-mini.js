(function () {
  "use strict";

  var cfg = window.GC_TOPBAR_CONNECTED_MINI || null;
  var root = document.getElementById("gc-topbar-connected-mini");
  var canvas = document.getElementById("gc-topbar-connected-mini-canvas");
  var valueEl = document.getElementById("gc-topbar-connected-mini-value");
  if (!cfg || !root || !canvas || !valueEl) return;

  var CACHE_SS_PREFIX = "gc-topbar-dash:v1:";
  var CACHE_MAX_AGE_MS = 5 * 60 * 1000;
  var reqGen = 0;
  var lastDataKey = "";
  var lastMiniPayload = null;
  var resizeT = null;

  function normalizeInventoryRows(arr) {
    var out = [];
    if (!Array.isArray(arr)) return out;
    arr.forEach(function (fw) {
      if (!fw || fw.id == null) return;
      var fid = parseInt(String(fw.id), 10);
      if (isNaN(fid) || fid <= 0) return;
      var tags = [];
      if (Array.isArray(fw.tags)) {
        fw.tags.forEach(function (t) {
          if (typeof t === "string" && t.trim()) tags.push(t.trim());
        });
      }
      out.push({ id: fid, tags: tags });
    });
    return out;
  }

  function tagKey(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  function computeEffectiveIds(inventory, selectedFwIds, selectedTags) {
    var set = {};
    var tagWant = {};
    (selectedTags || []).forEach(function (t) {
      var k = tagKey(t);
      if (k) tagWant[k] = true;
    });
    (selectedFwIds || []).forEach(function (id) {
      var n = parseInt(String(id), 10);
      if (!isNaN(n) && n > 0) set[String(n)] = true;
    });
    (inventory || []).forEach(function (fw) {
      if (!fw || fw.id == null) return;
      var tags = fw.tags || [];
      for (var i = 0; i < tags.length; i++) {
        if (tagWant[tagKey(tags[i])]) {
          set[String(fw.id)] = true;
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

  function getSelectedIdsFallback() {
    var userId = cfg.userId;
    if (userId == null) return [];
    var k = (cfg.firewallStorageKeyPrefix || "ground-control-network-fw-filter-v2") + ":" + String(userId);
    try {
      var raw = localStorage.getItem(k);
      if (!raw) return [];
      var o = JSON.parse(raw);
      if (!o || o.v !== 2) return [];
      var ids = Array.isArray(o.firewallIds) ? o.firewallIds : [];
      var tags = Array.isArray(o.tags) ? o.tags : [];
      var inv = normalizeInventoryRows(window.gcNavFirewallsJson || []);
      return computeEffectiveIds(inv, ids, tags);
    } catch (_e) {
      return [];
    }
  }

  function selectedIds() {
    if (typeof window.gcGetSelectedFirewallIds === "function") {
      var ids = window.gcGetSelectedFirewallIds();
      return Array.isArray(ids) ? ids : [];
    }
    return getSelectedIdsFallback();
  }

  function browserTz() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (_e2) {
      return "";
    }
  }

  function storageKeyForSelection() {
    var ids = selectedIds().slice().sort(function (a, b) {
      return a - b;
    });
    return ids.join(",") + "\x1e" + browserTz();
  }

  function readSessionCache(key) {
    try {
      var raw = sessionStorage.getItem(CACHE_SS_PREFIX + key);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o.t !== "number" || o.p == null) return null;
      return o;
    } catch (_e) {
      return null;
    }
  }

  function writeSessionCache(key, payload) {
    try {
      sessionStorage.setItem(CACHE_SS_PREFIX + key, JSON.stringify({ t: Date.now(), p: payload }));
    } catch (_e3) {
      /* quota or private mode */
    }
  }

  function extractMiniPayload(data) {
    data = data || {};
    return {
      connected_chart_hourly: Array.isArray(data.connected_chart_hourly) ? data.connected_chart_hourly : [],
      managed_count: typeof data.managed_count === "number" ? data.managed_count : 0,
      chart_timezone: data.chart_timezone,
    };
  }

  function setLoading(on) {
    root.classList.toggle("top-bar-connected-mini--loading", !!on);
    root.setAttribute("aria-busy", on ? "true" : "false");
  }

  function drawDualSparkline(connectedVals, disconnectedVals) {
    var rect = canvas.getBoundingClientRect();
    var cssW = Math.max(48, Math.floor(rect.width || 88));
    var cssH = Math.max(18, Math.floor(rect.height || 24));
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var pxW = Math.floor(cssW * dpr);
    var pxH = Math.floor(cssH * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pxW, pxH);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = connectedVals.length;
    if (n === 0) return;
    var minV = connectedVals[0];
    var maxV = connectedVals[0];
    for (var i = 0; i < n; i++) {
      minV = Math.min(minV, connectedVals[i], disconnectedVals[i]);
      maxV = Math.max(maxV, connectedVals[i], disconnectedVals[i]);
    }
    var xPad = 1;
    var yPad = 2;
    var w = Math.max(1, cssW - xPad * 2);
    var h = Math.max(1, cssH - yPad * 2);
    var range = maxV - minV;
    if (range <= 0) range = 1;
    var denom = n > 1 ? n - 1 : 1;
    function yFor(v) {
      return yPad + h - ((v - minV) / range) * h;
    }
    function strokeSeries(vals, color) {
      ctx.beginPath();
      for (var idx = 0; idx < vals.length; idx++) {
        var x = xPad + (idx / denom) * w;
        var y = yFor(vals[idx]);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    strokeSeries(disconnectedVals, "#c62828");
    strokeSeries(connectedVals, "#7ae27c");
  }

  function renderMini(payload) {
    var hourly = Array.isArray(payload && payload.connected_chart_hourly) ? payload.connected_chart_hourly : [];
    var managed = payload && typeof payload.managed_count === "number" ? payload.managed_count : 0;
    var nowMs = Date.now();
    var filtered = hourly.filter(function (d) {
      var t = d && d.hour_start ? new Date(d.hour_start).getTime() : NaN;
      return !isNaN(t) && t <= nowMs;
    });
    var slice = filtered.slice(-24);
    if (slice.length === 0) {
      valueEl.textContent = "—";
      var ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
      return;
    }
    var vals = slice.map(function (d) {
      return typeof d.connected_count === "number" ? d.connected_count : 0;
    });
    var disc = slice.map(function (d) {
      if (typeof d.disconnected_count === "number") return d.disconnected_count;
      return 0;
    });
    drawDualSparkline(vals, disc);
    var latest = vals[vals.length - 1];
    valueEl.textContent = managed > 0 ? String(latest) + "/" + String(managed) : String(latest);
  }

  function applyMiniPayload(payload, dataKey) {
    lastMiniPayload = extractMiniPayload(payload);
    lastDataKey = dataKey;
    renderMini(lastMiniPayload);
  }

  function refreshMini() {
    var myGen = ++reqGen;
    var dataKey = storageKeyForSelection();
    var cached = readSessionCache(dataKey);
    var cacheFresh = cached && Date.now() - cached.t <= CACHE_MAX_AGE_MS;

    if (cacheFresh) {
      applyMiniPayload(cached.p, dataKey);
      setLoading(false);
    } else {
      setLoading(true);
    }

    var ids = selectedIds();
    var q = ids.length ? "?firewall_ids=" + encodeURIComponent(ids.join(",")) : "?firewall_ids=";
    var tz = browserTz();
    if (tz) q += "&timezone=" + encodeURIComponent(tz);

    fetch(String(cfg.apiDashboardUrl || "/api/dashboard") + q, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (res) {
        return res.ok ? res.json() : Promise.reject();
      })
      .then(function (data) {
        if (myGen !== reqGen) return;
        if (storageKeyForSelection() !== dataKey) return;
        var mini = extractMiniPayload(data || {});
        writeSessionCache(dataKey, mini);
        applyMiniPayload(mini, dataKey);
        setLoading(false);
      })
      .catch(function () {
        if (myGen !== reqGen) return;
        if (storageKeyForSelection() !== dataKey) return;
        if (!cacheFresh) {
          valueEl.textContent = "—";
          var ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
        }
        setLoading(false);
      });
  }

  document.addEventListener("gc-firewall-selection-changed", refreshMini);
  window.addEventListener("resize", function () {
    if (resizeT) clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      resizeT = null;
      var dataKey = storageKeyForSelection();
      if (lastMiniPayload && dataKey === lastDataKey) {
        renderMini(lastMiniPayload);
      }
    }, 80);
  });
  setInterval(refreshMini, 60000);
  refreshMini();
})();
