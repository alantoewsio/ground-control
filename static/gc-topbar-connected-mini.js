(function () {
  "use strict";

  let cfg = globalThis.GC_TOPBAR_CONNECTED_MINI || null;
  let root = document.getElementById("gc-topbar-connected-mini");
  let canvas = document.getElementById("gc-topbar-connected-mini-canvas");
  let valueEl = document.getElementById("gc-topbar-connected-mini-value");
  if (!cfg || !root || !canvas || !valueEl) return;

  let CACHE_SS_PREFIX = "gc-topbar-dash:v1:";
  let CACHE_MAX_AGE_MS = 5 * 60 * 1000;
  let reqGen = 0;
  let lastDataKey = "";
  let lastMiniPayload = null;
  let resizeT = null;

  function normalizeInventoryRows(arr) {
    let out = [];
    if (!Array.isArray(arr)) return out;
    arr.forEach(function (fw) {
      if (!fw || fw.id == null) return;
      let fid = parseInt(String(fw.id), 10);
      if (isNaN(fid) || fid <= 0) return;
      let tags = [];
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
    (inventory || []).forEach(function (fw) {
      if (!fw || fw.id == null) return;
      let tags = fw.tags || [];
      for (let i = 0; i < tags.length; i++) {
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
    let userId = cfg.userId;
    if (userId == null) return [];
    let k = (cfg.firewallStorageKeyPrefix || "ground-control-network-fw-filter-v2") + ":" + String(userId);
    try {
      let raw = localStorage.getItem(k);
      if (!raw) return [];
      let o = JSON.parse(raw);
      if (!o || o.v !== 2) return [];
      let ids = Array.isArray(o.firewallIds) ? o.firewallIds : [];
      let tags = Array.isArray(o.tags) ? o.tags : [];
      let inv = normalizeInventoryRows(globalThis.gcNavFirewallsJson || []);
      return computeEffectiveIds(inv, ids, tags);
    } catch (_e) {
      return [];
    }
  }

  function selectedIds() {
    if (typeof globalThis.gcGetSelectedFirewallIds === "function") {
      let ids = globalThis.gcGetSelectedFirewallIds();
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
    let ids = selectedIds().slice().sort(function (a, b) {
      return a - b;
    });
    return ids.join(",") + "\x1e" + browserTz();
  }

  function readSessionCache(key) {
    try {
      let raw = sessionStorage.getItem(CACHE_SS_PREFIX + key);
      if (!raw) return null;
      let o = JSON.parse(raw);
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
    let rect = canvas.getBoundingClientRect();
    let cssW = Math.max(48, Math.floor(rect.width || 88));
    let cssH = Math.max(18, Math.floor(rect.height || 24));
    let dpr = Math.max(1, globalThis.devicePixelRatio || 1);
    let pxW = Math.floor(cssW * dpr);
    let pxH = Math.floor(cssH * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    let ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pxW, pxH);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let n = connectedVals.length;
    if (n === 0) return;
    let minV = connectedVals[0];
    let maxV = connectedVals[0];
    for (let i = 0; i < n; i++) {
      minV = Math.min(minV, connectedVals[i], disconnectedVals[i]);
      maxV = Math.max(maxV, connectedVals[i], disconnectedVals[i]);
    }
    let xPad = 1;
    let yPad = 2;
    let w = Math.max(1, cssW - xPad * 2);
    let h = Math.max(1, cssH - yPad * 2);
    let range = maxV - minV;
    if (range <= 0) range = 1;
    let denom = n > 1 ? n - 1 : 1;
    function yFor(v) {
      return yPad + h - ((v - minV) / range) * h;
    }
    function strokeSeries(vals, color) {
      ctx.beginPath();
      for (let idx = 0; idx < vals.length; idx++) {
        let x = xPad + (idx / denom) * w;
        let y = yFor(vals[idx]);
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
    let hourly = Array.isArray(payload && payload.connected_chart_hourly) ? payload.connected_chart_hourly : [];
    let managed = payload && typeof payload.managed_count === "number" ? payload.managed_count : 0;
    let nowMs = Date.now();
    let filtered = hourly.filter(function (d) {
      let t = d && d.hour_start ? new Date(d.hour_start).getTime() : NaN;
      return !isNaN(t) && t <= nowMs;
    });
    let slice = filtered.slice(-24);
    if (slice.length === 0) {
      valueEl.textContent = "—";
      let ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
      return;
    }
    let vals = slice.map(function (d) {
      return typeof d.connected_count === "number" ? d.connected_count : 0;
    });
    let disc = slice.map(function (d) {
      if (typeof d.disconnected_count === "number") return d.disconnected_count;
      return 0;
    });
    drawDualSparkline(vals, disc);
    let latest = vals[vals.length - 1];
    valueEl.textContent = managed > 0 ? String(latest) + "/" + String(managed) : String(latest);
  }

  function applyMiniPayload(payload, dataKey) {
    lastMiniPayload = extractMiniPayload(payload);
    lastDataKey = dataKey;
    renderMini(lastMiniPayload);
  }

  function refreshMini() {
    let myGen = ++reqGen;
    let dataKey = storageKeyForSelection();
    let cached = readSessionCache(dataKey);
    let cacheFresh = cached && Date.now() - cached.t <= CACHE_MAX_AGE_MS;

    if (cacheFresh) {
      applyMiniPayload(cached.p, dataKey);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let ids = selectedIds();
    let q = ids.length ? "?firewall_ids=" + encodeURIComponent(ids.join(",")) : "?firewall_ids=";
    let tz = browserTz();
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
        let mini = extractMiniPayload(data || {});
        writeSessionCache(dataKey, mini);
        applyMiniPayload(mini, dataKey);
        setLoading(false);
      })
      .catch(function () {
        if (myGen !== reqGen) return;
        if (storageKeyForSelection() !== dataKey) return;
        if (!cacheFresh) {
          valueEl.textContent = "—";
          let ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
        }
        setLoading(false);
      });
  }

  document.addEventListener("gc-firewall-selection-changed", refreshMini);
  globalThis.addEventListener("resize", function () {
    if (resizeT) clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      resizeT = null;
      let dataKey = storageKeyForSelection();
      if (lastMiniPayload && dataKey === lastDataKey) {
        renderMini(lastMiniPayload);
      }
    }, 80);
  });
  setInterval(refreshMini, 60000);
  refreshMini();
})();
