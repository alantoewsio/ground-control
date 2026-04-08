/**
 * IPS Configure · DoS and Spoof protection flyouts: prefill from cache, enqueue Set DoSSettings / SpoofPrevention.
 */
(function () {
  "use strict";

  var dosRoot = null;
  var spoofRoot = null;
  var flyoutsBound = false;
  var spoofFlyoutTr = null;
  var dosFlyoutTr = null;

  /** Incremented on each spoof flyout open so stale zone fetches do not repaint the table. */
  var spoofZonesLoadGen = 0;
  var spoofZonesAbort = null;

  var DOS_ENQUEUE_URL = "";
  var SPOOF_ENQUEUE_URL = "";

  function bannerResult(ok, msg) {
    if (typeof window.gcGlobalBannerShowResult === "function") {
      window.gcGlobalBannerShowResult(ok, msg);
    } else {
      alert(msg);
    }
  }

  function dispatchTaskQueueUpdated() {
    try {
      document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
    } catch (e0) {}
  }

  function textScalar(v) {
    if (v == null) return "";
    if (typeof v === "object" && v !== null && v["#text"] != null) {
      return String(v["#text"]).trim();
    }
    return String(v).trim();
  }

  function syncBodyFlyoutClass() {
    var any =
      (dosRoot && !dosRoot.hidden) || (spoofRoot && !spoofRoot.hidden);
    document.body.classList.toggle("gc-if-flyout--open", !!any);
  }

  function closeDosFlyout() {
    if (!dosRoot) return;
    dosRoot.hidden = true;
    dosRoot.setAttribute("aria-hidden", "true");
    dosFlyoutTr = null;
    syncBodyFlyoutClass();
  }

  function closeSpoofFlyout() {
    if (!spoofRoot) return;
    spoofRoot.hidden = true;
    spoofRoot.setAttribute("aria-hidden", "true");
    spoofFlyoutTr = null;
    syncBodyFlyoutClass();
  }

  function openDosFlyout() {
    if (!dosRoot) return;
    closeSpoofFlyout();
    dosRoot.hidden = false;
    dosRoot.setAttribute("aria-hidden", "false");
    syncBodyFlyoutClass();
    var panel = dosRoot.querySelector(".gc-if-flyout__panel");
    if (panel) {
      try {
        panel.focus();
      } catch (e1) {}
    }
  }

  function openSpoofFlyout() {
    if (!spoofRoot) return;
    closeDosFlyout();
    spoofRoot.hidden = false;
    spoofRoot.setAttribute("aria-hidden", "false");
    syncBodyFlyoutClass();
    var panel = spoofRoot.querySelector(".gc-if-flyout__panel");
    if (panel) {
      try {
        panel.focus();
      } catch (e2) {}
    }
  }

  function firewallLabelFromRow(row) {
    if (!row || !row.cells) return "";
    var n = row.cells.__name;
    return n != null ? String(n).trim() : "";
  }

  function spoofZonesNaTd() {
    var td = document.createElement("td");
    td.className = "gc-ips-spoof-zones-table__na muted";
    td.setAttribute("aria-hidden", "true");
    td.textContent = "—";
    return td;
  }

  function spoofZonesChkTd(id, ariaLabel, col) {
    var td = document.createElement("td");
    td.className = "gc-ips-spoof-zones-table__chk";
    var inp = document.createElement("input");
    inp.type = "checkbox";
    inp.id = id;
    inp.setAttribute("aria-label", ariaLabel);
    if (col) inp.setAttribute("data-gc-spoof-col", col);
    td.appendChild(inp);
    return td;
  }

  function showSpoofZonesLoading() {
    var tbody = document.getElementById("gc-ips-spoof-zones-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = 4;
    td.className = "muted";
    td.textContent = "Loading zones…";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function applySpoofZoneSelectionFromRow(row) {
    var tbody = document.getElementById("gc-ips-spoof-zones-tbody");
    if (!tbody || !row) return;
    var sel = row.spoof_zone_selection || {};
    [].forEach.call(tbody.querySelectorAll("tr[data-gc-spoof-zone]"), function (tr) {
      var zName = tr.getAttribute("data-gc-spoof-zone") || "";
      var flags = sel[zName] || {};
      [].forEach.call(tr.querySelectorAll("input[data-gc-spoof-col]"), function (inp) {
        var c = inp.getAttribute("data-gc-spoof-col");
        if (c === "ip") inp.checked = !!flags.ip_spoof;
        else if (c === "mac") inp.checked = !!flags.mac_filter;
        else if (c === "pair") inp.checked = !!flags.pair_filter;
      });
    });
  }

  function rebuildSpoofZonesTableBody(zoneNames) {
    var tbody = document.getElementById("gc-ips-spoof-zones-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!zoneNames || !zoneNames.length) {
      var tr0 = document.createElement("tr");
      var td0 = document.createElement("td");
      td0.colSpan = 4;
      td0.className = "muted";
      td0.textContent =
        "No zones in the cache for this firewall. Sync zones from Inventory.";
      tr0.appendChild(td0);
      tbody.appendChild(tr0);
      return;
    }
    zoneNames.forEach(function (zName, idx) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-gc-spoof-zone", zName);
      var th = document.createElement("th");
      th.scope = "row";
      th.textContent = zName;
      tr.appendChild(th);
      var wan = String(zName).trim().toUpperCase() === "WAN";
      var baseId = "gc-ips-spoof-z-" + idx + "-";
      if (wan) {
        tr.appendChild(spoofZonesNaTd());
        tr.appendChild(spoofZonesChkTd(baseId + "mac", zName + " MAC filter", "mac"));
        tr.appendChild(spoofZonesNaTd());
      } else {
        tr.appendChild(spoofZonesChkTd(baseId + "ip", zName + " IP spoofing", "ip"));
        tr.appendChild(spoofZonesChkTd(baseId + "mac", zName + " MAC filter", "mac"));
        tr.appendChild(spoofZonesChkTd(baseId + "pair", zName + " IP–MAC pair filter", "pair"));
      }
      tbody.appendChild(tr);
    });
  }

  function loadSpoofZonesForFirewall(fwId, expectedGen) {
    var base =
      typeof window.GC_NETWORK_ZONES_URL === "string" ? window.GC_NETWORK_ZONES_URL.trim() : "";
    if (!base || fwId == null || fwId === "") {
      if (expectedGen != null && expectedGen !== spoofZonesLoadGen) return;
      rebuildSpoofZonesTableBody([]);
      applySpoofZoneSelectionFromRow(
        spoofFlyoutTr && spoofFlyoutTr._gcNetRow ? spoofFlyoutTr._gcNetRow : null,
      );
      return;
    }
    var fid = parseInt(String(fwId), 10);
    if (isNaN(fid) || fid < 1) {
      if (expectedGen != null && expectedGen !== spoofZonesLoadGen) return;
      rebuildSpoofZonesTableBody([]);
      applySpoofZoneSelectionFromRow(
        spoofFlyoutTr && spoofFlyoutTr._gcNetRow ? spoofFlyoutTr._gcNetRow : null,
      );
      return;
    }
    var sep = base.indexOf("?") >= 0 ? "&" : "?";
    var u =
      base + sep + "firewall_ids=" + encodeURIComponent(String(fid)) + "&combine=false";
    var ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    spoofZonesAbort = ac;
    var signal = ac ? ac.signal : undefined;
    fetch(u, {
      method: "GET",
      credentials: "same-origin",
      signal: signal,
      headers: {
        Accept: "application/json",
        "X-Requested-With": "Ground-Control",
      },
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        if (expectedGen != null && expectedGen !== spoofZonesLoadGen) return;
        if (!x.ok || !x.j || !Array.isArray(x.j.rows)) {
          rebuildSpoofZonesTableBody([]);
          applySpoofZoneSelectionFromRow(
            spoofFlyoutTr && spoofFlyoutTr._gcNetRow ? spoofFlyoutTr._gcNetRow : null,
          );
          return;
        }
        var names = [];
        var seen = {};
        x.j.rows.forEach(function (rw) {
          if (!rw) return;
          if (Number(rw.firewall_id) !== fid) return;
          var c = rw.cells || {};
          var n = c.__name != null ? String(c.__name).trim() : "";
          if (!n || n === "—" || seen[n]) return;
          seen[n] = true;
          names.push(n);
        });
        rebuildSpoofZonesTableBody(names);
        applySpoofZoneSelectionFromRow(
          spoofFlyoutTr && spoofFlyoutTr._gcNetRow ? spoofFlyoutTr._gcNetRow : null,
        );
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        if (expectedGen != null && expectedGen !== spoofZonesLoadGen) return;
        var tb = document.getElementById("gc-ips-spoof-zones-tbody");
        if (!tb) return;
        tb.innerHTML = "";
        var trE = document.createElement("tr");
        var tdE = document.createElement("td");
        tdE.colSpan = 4;
        tdE.className = "muted";
        tdE.textContent = "Could not load zones.";
        trE.appendChild(tdE);
        tb.appendChild(trE);
      });
  }

  function bindResize(root, boundKey, anchorLeft) {
    if (!root) return;
    var panel = root.querySelector(".gc-if-flyout__panel");
    var handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset[boundKey] === "1") return;
    handle.dataset[boundKey] = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var startX = e.clientX;
      var startW = panel.getBoundingClientRect().width;
      var maxW = window.innerWidth - 24;
      function onMove(e2) {
        var delta = anchorLeft ? e2.clientX - startX : startX - e2.clientX;
        var w = startW + delta;
        w = Math.max(320, Math.min(maxW, w));
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

  function syncSpoofRestrictMacEnabled() {
    var en = document.getElementById("gc-ips-spoof-enable");
    var res = document.getElementById("gc-ips-spoof-restrict-mac");
    var lbl = document.getElementById("gc-ips-spoof-restrict-mac-label");
    if (!en || !res) return;
    var on = !!en.checked;
    res.disabled = !on;
    if (!on) res.checked = false;
    if (lbl) {
      lbl.classList.toggle("gc-ips-spoof-flyout__restrict-label--locked", !on);
    }
  }

  function applyFlagEnabled(side) {
    if (!side || typeof side !== "object") return false;
    return textScalar(side.ApplyFlag).toLowerCase() === "enable";
  }

  function floodSides(block) {
    if (!block || typeof block !== "object") {
      return { src: {}, dst: {} };
    }
    return {
      src: block.Source && typeof block.Source === "object" ? block.Source : {},
      dst: block.Destination && typeof block.Destination === "object" ? block.Destination : {},
    };
  }

  function setNumInput(id, v) {
    var el = document.getElementById(id);
    if (!el) return;
    var t = v == null ? "" : textScalar(v);
    el.value = t !== "" ? t : "";
  }

  function prefillFlood(block, sPkt, sBurst, sApply, dPkt, dBurst, dApply) {
    var f = floodSides(block);
    var sa = document.getElementById(sApply);
    if (sa) sa.checked = applyFlagEnabled(f.src);
    var da = document.getElementById(dApply);
    if (da) da.checked = applyFlagEnabled(f.dst);
    setNumInput(sPkt, f.src.PacketRatePerSource);
    setNumInput(sBurst, f.src.BurstRatePerSource);
    setNumInput(dPkt, f.dst.PacketRatePerDestination);
    setNumInput(dBurst, f.dst.BurstRatePerDestination);
  }

  function prefillDosTwoSided(data, key, srcApplyId, dstApplyId) {
    if (!data || typeof data !== "object") return;
    var o = data[key];
    if (!o || typeof o !== "object") return;
    var sEl = document.getElementById(srcApplyId);
    if (sEl) sEl.checked = applyFlagEnabled(o.Source);
    var dEl = document.getElementById(dstApplyId);
    if (dEl) dEl.checked = applyFlagEnabled(o.Destination);
  }

  function populateDosFormFromPayload(data) {
    if (!data || typeof data !== "object") return;
    prefillFlood(
      data.SYNFlood,
      "gc-ips-dos-syn-src-pkt",
      "gc-ips-dos-syn-src-burst",
      "gc-ips-dos-syn-src-apply",
      "gc-ips-dos-syn-dst-pkt",
      "gc-ips-dos-syn-dst-burst",
      "gc-ips-dos-syn-dst-apply",
    );
    prefillFlood(
      data.UDPFlood,
      "gc-ips-dos-udp-src-pkt",
      "gc-ips-dos-udp-src-burst",
      "gc-ips-dos-udp-src-apply",
      "gc-ips-dos-udp-dst-pkt",
      "gc-ips-dos-udp-dst-burst",
      "gc-ips-dos-udp-dst-apply",
    );
    prefillFlood(
      data.TCPFlood,
      "gc-ips-dos-tcp-src-pkt",
      "gc-ips-dos-tcp-src-burst",
      "gc-ips-dos-tcp-src-apply",
      "gc-ips-dos-tcp-dst-pkt",
      "gc-ips-dos-tcp-dst-burst",
      "gc-ips-dos-tcp-dst-apply",
    );
    prefillFlood(
      data.ICMPFlood,
      "gc-ips-dos-icmp-src-pkt",
      "gc-ips-dos-icmp-src-burst",
      "gc-ips-dos-icmp-src-apply",
      "gc-ips-dos-icmp-dst-pkt",
      "gc-ips-dos-icmp-dst-burst",
      "gc-ips-dos-icmp-dst-apply",
    );
    prefillDosTwoSided(data, "DroppedSourceRoutedPackets", "gc-ips-dos-srcrt-apply", "gc-ips-dos-srcrt-dst-apply");
    prefillDosTwoSided(data, "DisableICMPRedirectPacket", "gc-ips-dos-redirect-apply", "gc-ips-dos-redirect-dst-apply");
    prefillDosTwoSided(data, "DisableARPFlooding", "gc-ips-dos-arp-apply", "gc-ips-dos-arp-dst-apply");
  }

  function chk(id) {
    var el = document.getElementById(id);
    return !!(el && el.checked);
  }

  function numStr(id) {
    var el = document.getElementById(id);
    if (!el) return undefined;
    var v = String(el.value || "").trim();
    if (v === "") return undefined;
    var n = Number(v);
    if (isNaN(n)) return undefined;
    return String(Math.floor(n));
  }

  function floodPatch(sPkt, sBurst, sApply, dPkt, dBurst, dApply) {
    var src = { ApplyFlag: chk(sApply) ? "Enable" : "Disable" };
    var dst = { ApplyFlag: chk(dApply) ? "Enable" : "Disable" };
    var prs = numStr(sPkt);
    var brs = numStr(sBurst);
    var prd = numStr(dPkt);
    var brd = numStr(dBurst);
    if (prs !== undefined) src.PacketRatePerSource = prs;
    if (brs !== undefined) src.BurstRatePerSource = brs;
    if (prd !== undefined) dst.PacketRatePerDestination = prd;
    if (brd !== undefined) dst.BurstRatePerDestination = brd;
    return { Source: src, Destination: dst };
  }

  function collectDosSettingsPatch() {
    return {
      SYNFlood: floodPatch(
        "gc-ips-dos-syn-src-pkt",
        "gc-ips-dos-syn-src-burst",
        "gc-ips-dos-syn-src-apply",
        "gc-ips-dos-syn-dst-pkt",
        "gc-ips-dos-syn-dst-burst",
        "gc-ips-dos-syn-dst-apply",
      ),
      UDPFlood: floodPatch(
        "gc-ips-dos-udp-src-pkt",
        "gc-ips-dos-udp-src-burst",
        "gc-ips-dos-udp-src-apply",
        "gc-ips-dos-udp-dst-pkt",
        "gc-ips-dos-udp-dst-burst",
        "gc-ips-dos-udp-dst-apply",
      ),
      TCPFlood: floodPatch(
        "gc-ips-dos-tcp-src-pkt",
        "gc-ips-dos-tcp-src-burst",
        "gc-ips-dos-tcp-src-apply",
        "gc-ips-dos-tcp-dst-pkt",
        "gc-ips-dos-tcp-dst-burst",
        "gc-ips-dos-tcp-dst-apply",
      ),
      ICMPFlood: floodPatch(
        "gc-ips-dos-icmp-src-pkt",
        "gc-ips-dos-icmp-src-burst",
        "gc-ips-dos-icmp-src-apply",
        "gc-ips-dos-icmp-dst-pkt",
        "gc-ips-dos-icmp-dst-burst",
        "gc-ips-dos-icmp-dst-apply",
      ),
      DroppedSourceRoutedPackets: {
        Source: { ApplyFlag: chk("gc-ips-dos-srcrt-apply") ? "Enable" : "Disable" },
        Destination: {
          ApplyFlag: chk("gc-ips-dos-srcrt-dst-apply") ? "Enable" : "Disable",
        },
      },
      DisableICMPRedirectPacket: {
        Source: { ApplyFlag: chk("gc-ips-dos-redirect-apply") ? "Enable" : "Disable" },
        Destination: {
          ApplyFlag: chk("gc-ips-dos-redirect-dst-apply") ? "Enable" : "Disable",
        },
      },
      DisableARPFlooding: {
        Source: { ApplyFlag: chk("gc-ips-dos-arp-apply") ? "Enable" : "Disable" },
        Destination: {
          ApplyFlag: chk("gc-ips-dos-arp-dst-apply") ? "Enable" : "Disable",
        },
      },
    };
  }

  function spoofFlyoutHasAnyZoneProtectionSelected() {
    var tbody = document.getElementById("gc-ips-spoof-zones-tbody");
    if (!tbody) return false;
    var rows = tbody.querySelectorAll("tr[data-gc-spoof-zone]");
    if (!rows || !rows.length) return false;
    for (var i = 0; i < rows.length; i++) {
      var inputs = rows[i].querySelectorAll('input[type="checkbox"]');
      for (var j = 0; j < inputs.length; j++) {
        if (inputs[j].checked) return true;
      }
    }
    return false;
  }

  function collectSpoofSettingsForQueue() {
    var en = document.getElementById("gc-ips-spoof-enable");
    var res = document.getElementById("gc-ips-spoof-restrict-mac");
    var zones = [];
    var tbody = document.getElementById("gc-ips-spoof-zones-tbody");
    if (tbody) {
      [].forEach.call(tbody.querySelectorAll("tr[data-gc-spoof-zone]"), function (tr) {
        var zName = tr.getAttribute("data-gc-spoof-zone") || "";
        if (!zName) return;
        var wan = zName.trim().toUpperCase() === "WAN";
        var ip = tr.querySelector('input[data-gc-spoof-col="ip"]');
        var mac = tr.querySelector('input[data-gc-spoof-col="mac"]');
        var pair = tr.querySelector('input[data-gc-spoof-col="pair"]');
        zones.push({
          zone: zName,
          wan: wan,
          ip_spoof: !!(ip && ip.checked),
          mac_filter: !!(mac && mac.checked),
          pair_filter: !!(pair && pair.checked),
        });
      });
    }
    return {
      enabled: !!(en && en.checked),
      restrict_unknown_ip_trusted_mac: !!(res && res.checked),
      zones: zones,
    };
  }

  function bindOnce() {
    if (flyoutsBound) return;
    if (!dosRoot && !spoofRoot) return;
    flyoutsBound = true;

    DOS_ENQUEUE_URL =
      typeof window.GC_IPS_DOS_SETTINGS_ENQUEUE_URL === "string"
        ? window.GC_IPS_DOS_SETTINGS_ENQUEUE_URL.trim()
        : "";
    SPOOF_ENQUEUE_URL =
      typeof window.GC_IPS_SPOOF_PREVENTION_ENQUEUE_URL === "string"
        ? window.GC_IPS_SPOOF_PREVENTION_ENQUEUE_URL.trim()
        : "";

    bindResize(dosRoot, "gcIpsDosResizeBound", false);
    bindResize(spoofRoot, "gcIpsSpoofResizeBound", false);

    var dosForm = document.getElementById("gc-ips-dos-form");
    var dosCancel = document.getElementById("gc-ips-dos-cancel");
    var dosBackdrop = dosRoot ? dosRoot.querySelector(".gc-if-flyout__backdrop") : null;

    if (dosCancel) dosCancel.addEventListener("click", closeDosFlyout);
    if (dosBackdrop) dosBackdrop.addEventListener("click", closeDosFlyout);
    if (dosForm) {
      dosForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!DOS_ENQUEUE_URL) {
          bannerResult(false, "DoS settings queue URL is not configured.");
          return;
        }
        var tr = dosFlyoutTr;
        var row = tr && tr._gcNetRow;
        if (!row || row.firewall_id == null) {
          bannerResult(false, "No firewall selected.");
          return;
        }
        if (!row.dos_settings_in_cache) {
          bannerResult(
            false,
            "DoS settings are not in the cache for this firewall. Sync DoS settings from Inventory.",
          );
          return;
        }
        var fid = parseInt(String(row.firewall_id), 10);
        if (isNaN(fid) || fid < 1) {
          bannerResult(false, "Invalid firewall.");
          return;
        }
        var patch = collectDosSettingsPatch();
        fetch(DOS_ENQUEUE_URL, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "Ground-Control",
          },
          body: JSON.stringify({ firewall_id: fid, settings: patch }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, j: j };
            });
          })
          .then(function (x) {
            if (!x.ok) {
              var em =
                (x.j && (x.j.detail || x.j.message)) || "Could not queue DoS settings.";
              bannerResult(false, typeof em === "string" ? em : JSON.stringify(em));
              return;
            }
            if (x.j && x.j.task_id != null) {
              bannerResult(true, "DoS settings change queued for approval.");
              dispatchTaskQueueUpdated();
              closeDosFlyout();
            } else {
              bannerResult(true, "No changes to queue — values match the cache.");
            }
          })
          .catch(function () {
            bannerResult(false, "Network error.");
          });
      });
    }

    var spoofEnable = document.getElementById("gc-ips-spoof-enable");
    if (spoofEnable) {
      spoofEnable.addEventListener("change", function () {
        syncSpoofRestrictMacEnabled();
      });
    }
    syncSpoofRestrictMacEnabled();

    var spoofForm = document.getElementById("gc-ips-spoof-form");
    var spoofCancel = document.getElementById("gc-ips-spoof-cancel");
    var spoofBackdrop = spoofRoot ? spoofRoot.querySelector(".gc-if-flyout__backdrop") : null;

    if (spoofCancel) spoofCancel.addEventListener("click", closeSpoofFlyout);
    if (spoofBackdrop) spoofBackdrop.addEventListener("click", closeSpoofFlyout);
    if (spoofForm) {
      spoofForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!SPOOF_ENQUEUE_URL) {
          bannerResult(false, "Spoof prevention queue URL is not configured.");
          return;
        }
        var tr = spoofFlyoutTr;
        var row = tr && tr._gcNetRow;
        if (!row || row.firewall_id == null) {
          bannerResult(false, "No firewall selected.");
          return;
        }
        if (!row.spoof_prevention_in_cache) {
          bannerResult(
            false,
            "Spoof prevention is not in the cache for this firewall. Sync from Inventory.",
          );
          return;
        }
        var fid = parseInt(String(row.firewall_id), 10);
        if (isNaN(fid) || fid < 1) {
          bannerResult(false, "Invalid firewall.");
          return;
        }
        var settings = collectSpoofSettingsForQueue();
        if (settings.enabled && !spoofFlyoutHasAnyZoneProtectionSelected()) {
          bannerResult(
            false,
            "When spoof prevention is enabled, select at least one zone in the table " +
              "(IP spoofing, MAC filter, or IP–MAC pair) before applying.",
          );
          return;
        }
        fetch(SPOOF_ENQUEUE_URL, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "Ground-Control",
          },
          body: JSON.stringify({ firewall_id: fid, settings: settings }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, j: j };
            });
          })
          .then(function (x) {
            if (!x.ok) {
              var em2 =
                (x.j && (x.j.detail || x.j.message)) ||
                "Could not queue spoof prevention settings.";
              bannerResult(false, typeof em2 === "string" ? em2 : JSON.stringify(em2));
              return;
            }
            if (x.j && x.j.task_id != null) {
              bannerResult(true, "Spoof prevention change queued for approval.");
              dispatchTaskQueueUpdated();
              closeSpoofFlyout();
            } else {
              bannerResult(true, "No changes to queue — values match the cache.");
            }
          })
          .catch(function () {
            bannerResult(false, "Network error.");
          });
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (dosRoot && !dosRoot.hidden) {
        closeDosFlyout();
        e.preventDefault();
        return;
      }
      if (spoofRoot && !spoofRoot.hidden) {
        closeSpoofFlyout();
        e.preventDefault();
      }
    });
  }

  window.gcIpsDosSpoofFlyoutsInit = function () {
    dosRoot = document.getElementById("gc-ips-dos-flyout");
    spoofRoot = document.getElementById("gc-ips-spoof-flyout");
    bindOnce();
  };

  window.gcIpsDosFlyoutOpenFromTr = function (tr) {
    if (!dosRoot) window.gcIpsDosSpoofFlyoutsInit();
    if (!tr || !tr._gcNetRow) return;
    dosFlyoutTr = tr;
    var row = tr._gcNetRow;
    var fwEl = document.getElementById("gc-ips-dos-flyout-fw");
    if (fwEl) {
      var lab = firewallLabelFromRow(row);
      fwEl.textContent = lab ? "Firewall: " + lab : "";
    }
    if (row.dos_settings && typeof row.dos_settings === "object") {
      populateDosFormFromPayload(row.dos_settings);
    }
    openDosFlyout();
  };

  /**
   * @param {HTMLElement} tr
   * @param {{ toggleEnableCheckbox?: boolean }} [opts] - If true, invert the flyout enable checkbox after
   *   loading from the cached row (table switch click); the table toggle is not updated.
   */
  window.gcIpsSpoofFlyoutOpenFromTr = function (tr, opts) {
    if (!spoofRoot) window.gcIpsDosSpoofFlyoutsInit();
    if (!tr || !tr._gcNetRow) return;
    opts = opts && typeof opts === "object" ? opts : {};
    spoofZonesLoadGen += 1;
    var zonGen = spoofZonesLoadGen;
    if (spoofZonesAbort) {
      try {
        spoofZonesAbort.abort();
      } catch (ez) {}
      spoofZonesAbort = null;
    }
    spoofFlyoutTr = tr;
    var row = tr._gcNetRow;
    var fwEl = document.getElementById("gc-ips-spoof-flyout-fw");
    if (fwEl) {
      var lab = firewallLabelFromRow(row);
      fwEl.textContent = lab ? "Firewall: " + lab : "";
    }
    var en = document.getElementById("gc-ips-spoof-enable");
    if (en) {
      en.checked = row.spoof_prevention_enabled != null && !!row.spoof_prevention_enabled;
      if (opts.toggleEnableCheckbox) {
        en.checked = !en.checked;
      }
    }
    var res = document.getElementById("gc-ips-spoof-restrict-mac");
    syncSpoofRestrictMacEnabled();
    if (res && en && en.checked) {
      res.checked = !!row.restrict_unknown_ip_on_trusted_mac;
    }
    var embedded = row.spoof_flyout_zone_names;
    if (Array.isArray(embedded)) {
      var zonNames = embedded
        .map(function (z) {
          return String(z != null ? z : "").trim();
        })
        .filter(function (n) {
          return n && n !== "—";
        });
      rebuildSpoofZonesTableBody(zonNames);
      applySpoofZoneSelectionFromRow(row);
      openSpoofFlyout();
    } else {
      showSpoofZonesLoading();
      openSpoofFlyout();
      loadSpoofZonesForFirewall(row.firewall_id, zonGen);
    }
  };

  window.gcIpsSpoofFlyoutSyncEnableFromTable = function (tr) {
    if (!tr || !spoofRoot || spoofRoot.hidden) return;
    if (tr !== spoofFlyoutTr) return;
    var en = document.getElementById("gc-ips-spoof-enable");
    if (!en || !tr._gcNetRow) return;
    en.checked = !!tr._gcNetRow.spoof_prevention_enabled;
    syncSpoofRestrictMacEnabled();
  };
})();
