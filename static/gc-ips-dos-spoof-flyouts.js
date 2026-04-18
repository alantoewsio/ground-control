/**
 * IPS Configure · DoS and Spoof protection flyouts: prefill from cache, enqueue Set DoSSettings / SpoofPrevention.
 */
(function () {
  "use strict";

  let dosRoot = null;
  let spoofRoot = null;
  let flyoutsBound = false;
  let spoofFlyoutTr = null;
  let dosFlyoutTr = null;

  /** Incremented on each spoof flyout open so stale zone fetches do not repaint the table. */
  let spoofZonesLoadGen = 0;
  let spoofZonesAbort = null;

  let DOS_ENQUEUE_URL = "";
  let SPOOF_ENQUEUE_URL = "";

  function bannerResult(ok, msg) {
    if (typeof globalThis.gcGlobalBannerShowResult === "function") {
      globalThis.gcGlobalBannerShowResult(ok, msg);
    } else {
      window.gcAlert(msg);
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
    let any =
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
    let panel = dosRoot.querySelector(".gc-if-flyout__panel");
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
    let panel = spoofRoot.querySelector(".gc-if-flyout__panel");
    if (panel) {
      try {
        panel.focus();
      } catch (e2) {}
    }
  }

  function firewallLabelFromRow(row) {
    if (!row || !row.cells) return "";
    let n = row.cells.__name;
    return n != null ? String(n).trim() : "";
  }

  function spoofZonesNaTd() {
    let td = document.createElement("td");
    td.className = "gc-ips-spoof-zones-table__na muted";
    td.setAttribute("aria-hidden", "true");
    td.textContent = "—";
    return td;
  }

  function spoofZonesChkTd(id, ariaLabel, col) {
    let td = document.createElement("td");
    td.className = "gc-ips-spoof-zones-table__chk";
    let inp = document.createElement("input");
    inp.type = "checkbox";
    inp.id = id;
    inp.setAttribute("aria-label", ariaLabel);
    if (col) inp.setAttribute("data-gc-spoof-col", col);
    td.appendChild(inp);
    return td;
  }

  function showSpoofZonesLoading() {
    let tbody = document.getElementById("gc-ips-spoof-zones-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    let tr = document.createElement("tr");
    let td = document.createElement("td");
    td.colSpan = 4;
    td.className = "muted";
    td.textContent = "Loading zones…";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function applySpoofZoneSelectionFromRow(row) {
    let tbody = document.getElementById("gc-ips-spoof-zones-tbody");
    if (!tbody || !row) return;
    let sel = row.spoof_zone_selection || {};
    [].forEach.call(tbody.querySelectorAll("tr[data-gc-spoof-zone]"), function (tr) {
      let zName = tr.dataset.gcSpoofZone || "";
      let flags = sel[zName] || {};
      [].forEach.call(tr.querySelectorAll("input[data-gc-spoof-col]"), function (inp) {
        let c = inp.dataset.gcSpoofCol;
        if (c === "ip") inp.checked = !!flags.ip_spoof;
        else if (c === "mac") inp.checked = !!flags.mac_filter;
        else if (c === "pair") inp.checked = !!flags.pair_filter;
      });
    });
  }

  function rebuildSpoofZonesTableBody(zoneNames) {
    let tbody = document.getElementById("gc-ips-spoof-zones-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!zoneNames || !zoneNames.length) {
      let tr0 = document.createElement("tr");
      let td0 = document.createElement("td");
      td0.colSpan = 4;
      td0.className = "muted";
      td0.textContent =
        "No zones in the cache for this firewall. Sync zones from Inventory.";
      tr0.appendChild(td0);
      tbody.appendChild(tr0);
      return;
    }
    zoneNames.forEach(function (zName, idx) {
      let tr = document.createElement("tr");
      tr.setAttribute("data-gc-spoof-zone", zName);
      let th = document.createElement("th");
      th.scope = "row";
      th.textContent = zName;
      tr.appendChild(th);
      let wan = String(zName).trim().toUpperCase() === "WAN";
      let baseId = "gc-ips-spoof-z-" + idx + "-";
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
    let base =
      typeof globalThis.GC_NETWORK_ZONES_URL === "string" ? globalThis.GC_NETWORK_ZONES_URL.trim() : "";
    if (!base || fwId == null || fwId === "") {
      if (expectedGen != null && expectedGen !== spoofZonesLoadGen) return;
      rebuildSpoofZonesTableBody([]);
      applySpoofZoneSelectionFromRow(
        spoofFlyoutTr && spoofFlyoutTr._gcNetRow ? spoofFlyoutTr._gcNetRow : null,
      );
      return;
    }
    let fid = parseInt(String(fwId), 10);
    if (isNaN(fid) || fid < 1) {
      if (expectedGen != null && expectedGen !== spoofZonesLoadGen) return;
      rebuildSpoofZonesTableBody([]);
      applySpoofZoneSelectionFromRow(
        spoofFlyoutTr && spoofFlyoutTr._gcNetRow ? spoofFlyoutTr._gcNetRow : null,
      );
      return;
    }
    let sep = base.indexOf("?") >= 0 ? "&" : "?";
    let u =
      base + sep + "firewall_ids=" + encodeURIComponent(String(fid)) + "&combine=false";
    let ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    spoofZonesAbort = ac;
    let signal = ac ? ac.signal : undefined;
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
        let names = [];
        let seen = {};
        x.j.rows.forEach(function (rw) {
          if (!rw) return;
          if (Number(rw.firewall_id) !== fid) return;
          let c = rw.cells || {};
          let n = c.__name != null ? String(c.__name).trim() : "";
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
        let tb = document.getElementById("gc-ips-spoof-zones-tbody");
        if (!tb) return;
        tb.innerHTML = "";
        let trE = document.createElement("tr");
        let tdE = document.createElement("td");
        tdE.colSpan = 4;
        tdE.className = "muted";
        tdE.textContent = "Could not load zones.";
        trE.appendChild(tdE);
        tb.appendChild(trE);
      });
  }

  function bindResize(root, boundKey, anchorLeft) {
    if (!root) return;
    let panel = root.querySelector(".gc-if-flyout__panel");
    let handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset[boundKey] === "1") return;
    handle.dataset[boundKey] = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      let startX = e.clientX;
      let startW = panel.getBoundingClientRect().width;
      let maxW = globalThis.innerWidth - 24;
      function onMove(e2) {
        let delta = anchorLeft ? e2.clientX - startX : startX - e2.clientX;
        let w = startW + delta;
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
    let en = document.getElementById("gc-ips-spoof-enable");
    let res = document.getElementById("gc-ips-spoof-restrict-mac");
    let lbl = document.getElementById("gc-ips-spoof-restrict-mac-label");
    if (!en || !res) return;
    let on = !!en.checked;
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
    let el = document.getElementById(id);
    if (!el) return;
    let t = v == null ? "" : textScalar(v);
    el.value = t !== "" ? t : "";
  }

  function prefillFlood(block, sPkt, sBurst, sApply, dPkt, dBurst, dApply) {
    let f = floodSides(block);
    let sa = document.getElementById(sApply);
    if (sa) sa.checked = applyFlagEnabled(f.src);
    let da = document.getElementById(dApply);
    if (da) da.checked = applyFlagEnabled(f.dst);
    setNumInput(sPkt, f.src.PacketRatePerSource);
    setNumInput(sBurst, f.src.BurstRatePerSource);
    setNumInput(dPkt, f.dst.PacketRatePerDestination);
    setNumInput(dBurst, f.dst.BurstRatePerDestination);
  }

  function prefillDosTwoSided(data, key, srcApplyId, dstApplyId) {
    if (!data || typeof data !== "object") return;
    let o = data[key];
    if (!o || typeof o !== "object") return;
    let sEl = document.getElementById(srcApplyId);
    if (sEl) sEl.checked = applyFlagEnabled(o.Source);
    let dEl = document.getElementById(dstApplyId);
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
    let el = document.getElementById(id);
    return !!(el && el.checked);
  }

  function numStr(id) {
    let el = document.getElementById(id);
    if (!el) return undefined;
    let v = String(el.value || "").trim();
    if (v === "") return undefined;
    let n = Number(v);
    if (isNaN(n)) return undefined;
    return String(Math.floor(n));
  }

  function floodPatch(sPkt, sBurst, sApply, dPkt, dBurst, dApply) {
    let src = { ApplyFlag: chk(sApply) ? "Enable" : "Disable" };
    let dst = { ApplyFlag: chk(dApply) ? "Enable" : "Disable" };
    let prs = numStr(sPkt);
    let brs = numStr(sBurst);
    let prd = numStr(dPkt);
    let brd = numStr(dBurst);
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
    let tbody = document.getElementById("gc-ips-spoof-zones-tbody");
    if (!tbody) return false;
    let rows = tbody.querySelectorAll("tr[data-gc-spoof-zone]");
    if (!rows || !rows.length) return false;
    for (let i = 0; i < rows.length; i++) {
      let inputs = rows[i].querySelectorAll('input[type="checkbox"]');
      for (let j = 0; j < inputs.length; j++) {
        if (inputs[j].checked) return true;
      }
    }
    return false;
  }

  function collectSpoofSettingsForQueue() {
    let en = document.getElementById("gc-ips-spoof-enable");
    let res = document.getElementById("gc-ips-spoof-restrict-mac");
    let zones = [];
    let tbody = document.getElementById("gc-ips-spoof-zones-tbody");
    if (tbody) {
      [].forEach.call(tbody.querySelectorAll("tr[data-gc-spoof-zone]"), function (tr) {
        let zName = tr.dataset.gcSpoofZone || "";
        if (!zName) return;
        let wan = zName.trim().toUpperCase() === "WAN";
        let ip = tr.querySelector('input[data-gc-spoof-col="ip"]');
        let mac = tr.querySelector('input[data-gc-spoof-col="mac"]');
        let pair = tr.querySelector('input[data-gc-spoof-col="pair"]');
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
      typeof globalThis.GC_IPS_DOS_SETTINGS_ENQUEUE_URL === "string"
        ? globalThis.GC_IPS_DOS_SETTINGS_ENQUEUE_URL.trim()
        : "";
    SPOOF_ENQUEUE_URL =
      typeof globalThis.GC_IPS_SPOOF_PREVENTION_ENQUEUE_URL === "string"
        ? globalThis.GC_IPS_SPOOF_PREVENTION_ENQUEUE_URL.trim()
        : "";

    bindResize(dosRoot, "gcIpsDosResizeBound", false);
    bindResize(spoofRoot, "gcIpsSpoofResizeBound", false);

    let dosForm = document.getElementById("gc-ips-dos-form");
    let dosCancel = document.getElementById("gc-ips-dos-cancel");
    let dosBackdrop = dosRoot ? dosRoot.querySelector(".gc-if-flyout__backdrop") : null;

    if (dosCancel) dosCancel.addEventListener("click", closeDosFlyout);
    if (dosBackdrop) dosBackdrop.addEventListener("click", closeDosFlyout);
    if (dosForm) {
      dosForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!DOS_ENQUEUE_URL) {
          bannerResult(false, "DoS settings queue URL is not configured.");
          return;
        }
        let tr = dosFlyoutTr;
        let row = tr && tr._gcNetRow;
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
        let fid = parseInt(String(row.firewall_id), 10);
        if (isNaN(fid) || fid < 1) {
          bannerResult(false, "Invalid firewall.");
          return;
        }
        let patch = collectDosSettingsPatch();
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
              let em =
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

    let spoofEnable = document.getElementById("gc-ips-spoof-enable");
    if (spoofEnable) {
      spoofEnable.addEventListener("change", function () {
        syncSpoofRestrictMacEnabled();
      });
    }
    syncSpoofRestrictMacEnabled();

    let spoofForm = document.getElementById("gc-ips-spoof-form");
    let spoofCancel = document.getElementById("gc-ips-spoof-cancel");
    let spoofBackdrop = spoofRoot ? spoofRoot.querySelector(".gc-if-flyout__backdrop") : null;

    if (spoofCancel) spoofCancel.addEventListener("click", closeSpoofFlyout);
    if (spoofBackdrop) spoofBackdrop.addEventListener("click", closeSpoofFlyout);
    if (spoofForm) {
      spoofForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!SPOOF_ENQUEUE_URL) {
          bannerResult(false, "Spoof prevention queue URL is not configured.");
          return;
        }
        let tr = spoofFlyoutTr;
        let row = tr && tr._gcNetRow;
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
        let fid = parseInt(String(row.firewall_id), 10);
        if (isNaN(fid) || fid < 1) {
          bannerResult(false, "Invalid firewall.");
          return;
        }
        let settings = collectSpoofSettingsForQueue();
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
              let em2 =
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

  globalThis.gcIpsDosSpoofFlyoutsInit = function () {
    dosRoot = document.getElementById("gc-ips-dos-flyout");
    spoofRoot = document.getElementById("gc-ips-spoof-flyout");
    bindOnce();
  };

  globalThis.gcIpsDosFlyoutOpenFromTr = function (tr) {
    if (!dosRoot) globalThis.gcIpsDosSpoofFlyoutsInit();
    if (!tr || !tr._gcNetRow) return;
    dosFlyoutTr = tr;
    let row = tr._gcNetRow;
    let fwEl = document.getElementById("gc-ips-dos-flyout-fw");
    if (fwEl) {
      let lab = firewallLabelFromRow(row);
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
  globalThis.gcIpsSpoofFlyoutOpenFromTr = function (tr, opts) {
    if (!spoofRoot) globalThis.gcIpsDosSpoofFlyoutsInit();
    if (!tr || !tr._gcNetRow) return;
    opts = opts && typeof opts === "object" ? opts : {};
    spoofZonesLoadGen += 1;
    let zonGen = spoofZonesLoadGen;
    if (spoofZonesAbort) {
      try {
        spoofZonesAbort.abort();
      } catch (ez) {}
      spoofZonesAbort = null;
    }
    spoofFlyoutTr = tr;
    let row = tr._gcNetRow;
    let fwEl = document.getElementById("gc-ips-spoof-flyout-fw");
    if (fwEl) {
      let lab = firewallLabelFromRow(row);
      fwEl.textContent = lab ? "Firewall: " + lab : "";
    }
    let en = document.getElementById("gc-ips-spoof-enable");
    if (en) {
      en.checked = row.spoof_prevention_enabled != null && !!row.spoof_prevention_enabled;
      if (opts.toggleEnableCheckbox) {
        en.checked = !en.checked;
      }
    }
    let res = document.getElementById("gc-ips-spoof-restrict-mac");
    syncSpoofRestrictMacEnabled();
    if (res && en && en.checked) {
      res.checked = !!row.restrict_unknown_ip_on_trusted_mac;
    }
    let embedded = row.spoof_flyout_zone_names;
    if (Array.isArray(embedded)) {
      let zonNames = embedded
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

  globalThis.gcIpsSpoofFlyoutSyncEnableFromTable = function (tr) {
    if (!tr || !spoofRoot || spoofRoot.hidden) return;
    if (tr !== spoofFlyoutTr) return;
    let en = document.getElementById("gc-ips-spoof-enable");
    if (!en || !tr._gcNetRow) return;
    en.checked = !!tr._gcNetRow.spoof_prevention_enabled;
    syncSpoofRestrictMacEnabled();
  };
})();
