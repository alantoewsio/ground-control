/**
 * Combined-view interface flyout: per-scope IPv4/IPv6 static tables with IPAM pool pickers.
 * Depends on gc-net-if-flyout.js (els, currentNetRow, pick, netmaskToDisplay, syncDirty, ipv4ModeValue, ipv6ModeValue).
 */
(function () {
  "use strict";

  let ipamPoolsCache = null;

  function prefixesUrl() {
    return (
      (typeof globalThis !== "undefined" && globalThis.gcIpamPrefixesUrl) || "/api/ipam/prefixes"
    );
  }

  function nextCidrUrl() {
    return (typeof globalThis !== "undefined" && globalThis.gcIpamNextAssignmentCidrUrl) || "";
  }

  function resolveInterfacePoolIpv4Url() {
    return (
      (typeof globalThis !== "undefined" && globalThis.gcIpamResolveInterfacePoolIpv4Url) || ""
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Data columns after scope banner row: hardware + address fields + pool + conflict. */
  let CMB_STATIC_COL_COUNT = 7;

  function countCombinedDataRows(tb) {
    return tb ? tb.querySelectorAll("tr.gc-if-cmb-data-row").length : 0;
  }

  function gatherTrSearchText(tr) {
    if (!tr) return "";
    let parts = [tr.textContent || ""];
    tr.querySelectorAll("input, select").forEach(function (n) {
      if (!n) return;
      if (n.tagName === "SELECT") {
        let o = n.options[n.selectedIndex];
        parts.push((o && o.text) || n.value || "");
      } else {
        parts.push(n.value || "");
      }
    });
    return parts.join(" ").trim();
  }

  function applyCombinedStaticFilter(tbody, query) {
    if (!tbody) return;
    let q = String(query || "")
      .trim()
      .toLowerCase();
    tbody.querySelectorAll("tr.gc-if-cmb-data-row").forEach(function (dr) {
      let scope = dr.previousElementSibling;
      let scopeOk =
        scope &&
        scope.classList &&
        scope.classList.contains("gc-if-cmb-scope-row");
      let ok =
        !q ||
        (scopeOk &&
          (gatherTrSearchText(scope) + " " + gatherTrSearchText(dr)).toLowerCase().indexOf(q) !== -1);
      if (scopeOk) scope.hidden = !ok;
      dr.hidden = !ok;
    });
  }

  function bindCombinedStaticFilter(wrap, tbody) {
    if (!wrap || !tbody) return;
    let inp = wrap.querySelector(".gc-if-cmb-filter");
    if (!inp || inp.dataset.gcCmbFilterBound === "1") return;
    inp.dataset.gcCmbFilterBound = "1";
    function run() {
      applyCombinedStaticFilter(tbody, inp.value);
    }
    inp.addEventListener("input", run);
    inp.addEventListener("search", run);
    if (tbody.dataset.gcCmbTbodyFilterDelegated !== "1") {
      tbody.dataset.gcCmbTbodyFilterDelegated = "1";
      tbody.addEventListener("input", function (ev) {
        if (!ev.target || !ev.target.closest || !ev.target.closest("tr.gc-if-cmb-data-row")) return;
        run();
      });
      tbody.addEventListener("change", function (ev) {
        if (!ev.target || !ev.target.closest || !ev.target.closest("tr.gc-if-cmb-data-row")) return;
        run();
      });
    }
  }

  function combinedRowActive(row) {
    return !!(row && row.interfaces_row_combined && row.if_combine_sources && row.if_combine_sources.length);
  }

  /** @param {object} [opts] */
  function resolveOpts(opts) {
    opts = opts || {};
    return {
      ipv4ModeValue:
        opts.ipv4ModeValue ||
        (typeof globalThis.gcNetIfIpv4ModeValue === "function" ? globalThis.gcNetIfIpv4ModeValue : null),
      ipv6ModeValue:
        opts.ipv6ModeValue ||
        (typeof globalThis.gcNetIfIpv6ModeValue === "function" ? globalThis.gcNetIfIpv6ModeValue : null),
      pick:
        opts.pick || (typeof globalThis.gcNetIfPick === "function" ? globalThis.gcNetIfPick : null),
      netmaskToDisplay:
        opts.netmaskToDisplay ||
        (typeof globalThis.gcNetIfNetmaskToDisplay === "function" ? globalThis.gcNetIfNetmaskToDisplay : null),
      syncDirty:
        opts.syncDirty || (typeof globalThis.gcNetIfSyncDirty === "function" ? globalThis.gcNetIfSyncDirty : null),
      isWanNetworkZone:
        opts.isWanNetworkZone ||
        (typeof globalThis.gcNetIfIsWanNetworkZone === "function" ? globalThis.gcNetIfIsWanNetworkZone : null),
    };
  }

  function modeV4From(ro) {
    let fn = ro && ro.ipv4ModeValue;
    return fn ? fn() : "dhcp";
  }

  function modeV6From(ro) {
    let fn = ro && ro.ipv6ModeValue;
    return fn ? fn() : "static";
  }

  function pickFlat(keys, flat, ro) {
    let fn = ro && ro.pick;
    if (fn) return fn(flat, keys);
    return "";
  }

  function nmDisp(nm, ro) {
    let fn = ro && ro.netmaskToDisplay;
    if (fn) return fn(nm);
    return String(nm || "");
  }

  function dirty(ro) {
    let fn = ro && ro.syncDirty;
    if (fn) fn();
    else if (typeof globalThis.gcNetIfSyncDirty === "function") globalThis.gcNetIfSyncDirty();
  }

  function syncCombinedGwCols(els, ro) {
    let wanFn = ro && ro.isWanNetworkZone;
    let show = wanFn ? !!wanFn() : false;
    [els.ipv4CombinedWrap, els.ipv6CombinedWrap].forEach(function (wrap) {
      if (!wrap) return;
      wrap.querySelectorAll(".gc-if-cmb-gw-col, .gc-if-cmb-gw-cell").forEach(function (el) {
        el.hidden = !show;
        el.setAttribute("aria-hidden", show ? "false" : "true");
      });
    });
  }

  function loadIpamPools(cb) {
    if (ipamPoolsCache) {
      cb(ipamPoolsCache);
      return;
    }
    fetch(prefixesUrl(), { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        let rows = (j && j.prefixes) || [];
        ipamPoolsCache = rows.filter(function (p) {
          return (
            p &&
            String(p.prefix_type || "").toLowerCase() === "pool" &&
            !p.pool_unmanaged
          );
        });
        cb(ipamPoolsCache);
      })
      .catch(function () {
        ipamPoolsCache = [];
        cb([]);
      });
  }

  function poolOptionsHtml(selectedId) {
    let pools = ipamPoolsCache || [];
    let opts =
      '<option value="">— Select pool —</option>' +
      pools
        .map(function (p) {
          let id = String(p.id);
          let lab = (p.name || p.cidr || "").trim() || id;
          let sel = String(selectedId || "") === id ? ' selected=""' : "";
          return '<option value="' + escapeHtml(id) + '"' + sel + ">" + escapeHtml(lab) + "</option>";
        })
        .join("");
    return opts;
  }

  /** Parse /24 from dotted netmask or prefix (best effort). */
  function guessIpv4PrefixLen(netmaskStr) {
    let s = String(netmaskStr || "").trim();
    if (!s) return 24;
    let mSlash = s.match(/^\s*\/(\d{1,2})\s*$/);
    if (mSlash) {
      let pls = parseInt(mSlash[1], 10);
      return pls >= 0 && pls <= 32 ? pls : 24;
    }
    if (/^\d{1,2}$/.test(s)) {
      let n = parseInt(s, 10);
      return n >= 0 && n <= 32 ? n : 24;
    }
    if (s.indexOf(".") !== -1) {
      let parts = s.split(".");
      if (parts.length === 4) {
        let bits = 0;
        for (let i = 0; i < 4; i++) {
          let o = parseInt(parts[i], 10);
          if (isNaN(o)) return 24;
          bits += (o >>> 0).toString(2).replace(/0/g, "").length;
        }
        return bits;
      }
    }
    return 24;
  }

  function applyNextCidrToV4Row(tr, cidrStr) {
    let raw = String(cidrStr || "").trim();
    let slash = raw.indexOf("/");
    if (slash < 0) return;
    let hostPart = raw.slice(0, slash).trim();
    let pl = parseInt(raw.slice(slash + 1), 10);
    if (isNaN(pl) || pl < 0 || pl > 32) return;
    let parts = hostPart.split(".").map(function (x) {
      return parseInt(x, 10);
    });
    if (parts.length !== 4 || parts.some(function (n) {
      return isNaN(n) || n < 0 || n > 255;
    }))
      return;
    let ipInt =
      (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    let mask = pl === 0 ? 0 : (~0 << (32 - pl)) >>> 0;
    let netInt = (ipInt & mask) >>> 0;
    let hostInt = (netInt + 1) >>> 0;
    let o0 = (hostInt >>> 24) & 255;
    let o1 = (hostInt >>> 16) & 255;
    let o2 = (hostInt >>> 8) & 255;
    let o3 = hostInt & 255;
    let ipEl = tr.querySelector(".gc-if-cmb-v4-ip");
    let nmEl = tr.querySelector(".gc-if-cmb-v4-nm");
    if (ipEl) ipEl.value = o0 + "." + o1 + "." + o2 + "." + o3;
    if (nmEl) nmEl.value = "/" + pl;
  }

  function applyNextCidrToV6Row(tr, cidrStr) {
    let ipEl = tr.querySelector(".gc-if-cmb-v6-ip");
    let pxEl = tr.querySelector(".gc-if-cmb-v6-px");
    if (!ipEl || !pxEl) return;
    ipEl.value = String(cidrStr || "").trim();
    pxEl.value = "";
    let slash = ipEl.value.lastIndexOf("/");
    if (slash > 0) {
      let rest = ipEl.value.slice(0, slash).trim();
      let suf = ipEl.value.slice(slash + 1).trim();
      ipEl.value = rest;
      pxEl.value = suf;
    }
  }

  function onPoolChangeV4(tr, poolId, ro) {
    if (!poolId) return;
    let pl = guessIpv4PrefixLen(
      (tr.querySelector(".gc-if-cmb-v4-nm") && tr.querySelector(".gc-if-cmb-v4-nm").value) || "",
    );
    let resolveU = resolveInterfacePoolIpv4Url();
    let fallback = nextCidrUrl();
    let fwRaw = (tr.dataset && tr.dataset.gcFirewallId) || "";
    let fwNum = parseInt(String(fwRaw), 10);
    let fwQ = !isNaN(fwNum) && fwNum > 0 ? "&firewall_id=" + encodeURIComponent(String(fwNum)) : "";
    let query =
      "?parent_pool_id=" + encodeURIComponent(poolId) + "&prefix_len=" + encodeURIComponent(String(pl));
    let primary = resolveU ? resolveU + query + fwQ : "";
    let secondary = fallback ? fallback + query : "";
    let u = primary || secondary;
    if (!u) return;
    fetch(u, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        if (!x.ok || !x.j || !x.j.cidr) {
          if (primary && secondary && u === primary) {
            return fetch(secondary, {
              credentials: "same-origin",
              headers: { Accept: "application/json" },
            }).then(function (r2) {
              return r2.json().then(function (j2) {
                return { ok: r2.ok, j: j2 };
              });
            });
          }
          let msg = (x.j && x.j.detail) || "Could not allocate from pool.";
          window.gcAlert(typeof msg === "string" ? msg : JSON.stringify(msg));
          return null;
        }
        return x;
      })
      .then(function (x) {
        if (!x) return;
        if (!x.ok || !x.j || !x.j.cidr) {
          let msg2 = (x.j && x.j.detail) || "Could not allocate from pool.";
          window.gcAlert(typeof msg2 === "string" ? msg2 : JSON.stringify(msg2));
          return;
        }
        applyNextCidrToV4Row(tr, x.j.cidr);
        tr.dataset.gcPoolConflict = "0";
        let ic = tr.querySelector(".gc-if-cmb-pool-conflict");
        if (ic) {
          ic.innerHTML = "";
          ic.removeAttribute("title");
        }
        dirty(ro);
      })
      .catch(function () {
        window.gcAlert("Network error while requesting next CIDR.");
      });
  }

  function onPoolChangeV6(tr, poolId, ro) {
    let url = nextCidrUrl();
    if (!url || !poolId) return;
    let px = (tr.querySelector(".gc-if-cmb-v6-px") && tr.querySelector(".gc-if-cmb-v6-px").value) || "64";
    let pl = parseInt(String(px).trim(), 10);
    if (isNaN(pl) || pl < 1 || pl > 128) pl = 64;
    let u = url + "?parent_pool_id=" + encodeURIComponent(poolId) + "&prefix_len=" + encodeURIComponent(String(pl));
    fetch(u, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        if (!x.ok || !x.j || !x.j.cidr) {
          let msg = (x.j && x.j.detail) || "Could not allocate from pool.";
          window.gcAlert(typeof msg === "string" ? msg : JSON.stringify(msg));
          return;
        }
        applyNextCidrToV6Row(tr, x.j.cidr);
        tr.dataset.gcPoolConflict = "0";
        let ic = tr.querySelector(".gc-if-cmb-pool-conflict");
        if (ic) {
          ic.innerHTML = "";
          ic.removeAttribute("title");
        }
        dirty(ro);
      })
      .catch(function () {
        window.gcAlert("Network error while requesting next CIDR.");
      });
  }

  function sourcesStableKey(srcs) {
    if (!srcs || !srcs.length) return "";
    return srcs
      .map(function (s) {
        return String((s && s.config_entry_id) != null ? s.config_entry_id : "");
      })
      .join(",");
  }

  function buildIpv4Combined(els, row, ro) {
    let tb = els.ipv4CombinedTbody;
    if (!tb) return;
    let wrap = els.ipv4CombinedWrap;
    if (wrap) {
      let fi = wrap.querySelector(".gc-if-cmb-filter");
      if (fi) fi.value = "";
    }
    tb.innerHTML = "";
    let srcs = row.if_combine_sources || [];
    loadIpamPools(function () {
      srcs.forEach(function (src) {
        let flat = src.flat || {};
        let hw = pickFlat(["Hardware"], flat, ro);
        let scopeTr = document.createElement("tr");
        scopeTr.className = "gc-if-cmb-scope-row";
        scopeTr.innerHTML =
          '<td colspan="' +
          CMB_STATIC_COL_COUNT +
          '" class="gc-if-cmb-scope-cell">' +
          escapeHtml(src.scope_label || "") +
          "</td>";
        let tr = document.createElement("tr");
        tr.className = "gc-if-cmb-data-row";
        tr.dataset.configEntryId = String(src.config_entry_id || "");
        let ip = pickFlat(["IPAddress", "IPv4Address"], flat, ro);
        let nmRaw = pickFlat(["Netmask", "IPv4Netmask"], flat, ro);
        let nm =
          typeof globalThis.gcNetIpv4FlyoutBlur !== "undefined" &&
          globalThis.gcNetIpv4FlyoutBlur.netmaskToSlashDisplay
            ? globalThis.gcNetIpv4FlyoutBlur.netmaskToSlashDisplay(nmRaw)
            : nmDisp(nmRaw, ro);
        let gwn = pickFlat(
          ["GatewayName", "IPv4GatewayName", "DefaultGatewayName"],
          flat,
          ro,
        );
        let gwi = pickFlat(
          ["GatewayIP", "Gateway", "DefaultGateway", "IPv4Gateway"],
          flat,
          ro,
        );
        let ip4 = src.ipam_v4 || {};
        let poolId = ip4.pool_id != null ? String(ip4.pool_id) : "";
        let conflict = !!ip4.pool_conflict;
        tr.dataset.gcPoolConflict = conflict ? "1" : "0";
        tr.dataset.gcFirewallId =
          src.firewall_id != null && String(src.firewall_id).trim() !== ""
            ? String(src.firewall_id)
            : "";
        tr.innerHTML =
          '<td><input type="text" class="gc-if-flyout__input mono gc-if-cmb-hw" readonly tabindex="-1" aria-readonly="true" title="Hardware (read-only)" value="' +
          escapeHtml(hw) +
          '" /></td>' +
          '<td><input type="text" class="gc-if-flyout__input mono gc-if-cmb-v4-ip" autocomplete="off" value="' +
          escapeHtml(ip) +
          '" /></td>' +
          '<td><input type="text" class="gc-if-flyout__input mono gc-if-cmb-v4-nm" autocomplete="off" value="' +
          escapeHtml(nm) +
          '" /></td>' +
          '<td class="gc-if-cmb-gw-cell"><input type="text" class="gc-if-flyout__input gc-if-cmb-v4-gw-name" autocomplete="off" value="' +
          escapeHtml(gwn) +
          '" /></td>' +
          '<td class="gc-if-cmb-gw-cell"><input type="text" class="gc-if-flyout__input mono gc-if-cmb-v4-gw-ip" autocomplete="off" value="' +
          escapeHtml(gwi) +
          '" /></td>' +
          '<td><select class="gc-if-flyout__input gc-if-flyout__select gc-if-cmb-pool">' +
          poolOptionsHtml(poolId) +
          "</select></td>" +
          '<td class="gc-if-cmb-pool-conflict-cell"><span class="gc-if-cmb-pool-conflict" title="' +
          (conflict
            ? "Address does not match IPAM pool assignment for this scope"
            : "") +
          '">' +
          (conflict
            ? '<span class="gc-if-ipam-cidr-icon gc-if-ipam-cidr-icon--conflict gc-if-cmb-inline-icon" role="img" aria-label="Pool mismatch">!</span>'
            : "") +
          "</span></td>";
        let sel = tr.querySelector(".gc-if-cmb-pool");
        if (sel) {
          sel.addEventListener("change", function () {
            onPoolChangeV4(tr, sel.value, ro);
          });
        }
        let nmInp = tr.querySelector(".gc-if-cmb-v4-nm");
        if (
          nmInp &&
          globalThis.gcNetIpv4FlyoutBlur &&
          globalThis.gcNetIpv4FlyoutBlur.applyNetmaskNormalizeToSlash
        ) {
          nmInp.addEventListener("blur", function () {
            globalThis.gcNetIpv4FlyoutBlur.applyNetmaskNormalizeToSlash(
              { ipv4Nm: nmInp },
              function () {
                dirty(ro);
              },
            );
          });
        }
        tb.appendChild(scopeTr);
        tb.appendChild(tr);
      });
      tb.dataset.gcIfCmbKey = sourcesStableKey(srcs);
      syncCombinedGwCols(els, ro);
      bindCombinedStaticFilter(wrap, tb);
      applyCombinedStaticFilter(tb, "");
    });
  }

  function buildIpv6Combined(els, row, ro) {
    let tb = els.ipv6CombinedTbody;
    if (!tb) return;
    let wrap = els.ipv6CombinedWrap;
    if (wrap) {
      let fi6 = wrap.querySelector(".gc-if-cmb-filter");
      if (fi6) fi6.value = "";
    }
    tb.innerHTML = "";
    let srcs = row.if_combine_sources || [];
    loadIpamPools(function () {
      srcs.forEach(function (src) {
        let flat = src.flat || {};
        let hw = pickFlat(["Hardware"], flat, ro);
        let scopeTr = document.createElement("tr");
        scopeTr.className = "gc-if-cmb-scope-row";
        scopeTr.innerHTML =
          '<td colspan="' +
          CMB_STATIC_COL_COUNT +
          '" class="gc-if-cmb-scope-cell">' +
          escapeHtml(src.scope_label || "") +
          "</td>";
        let tr = document.createElement("tr");
        tr.className = "gc-if-cmb-data-row";
        tr.dataset.configEntryId = String(src.config_entry_id || "");
        let ip = pickFlat(["IPv6Address", "IPv6_Address"], flat, ro);
        let px =
          pickFlat(["Prefix", "IPv6PrefixLength", "IPv6Prefix", "PrefixLength"], flat, ro) || "64";
        let gwn = pickFlat(
          ["GatewayNameIpv6", "IPv6GatewayName", "IPv6_GatewayName"],
          flat,
          ro,
        );
        let gwi = pickFlat(
          ["GatewayIPv6", "IPv6Gateway", "IPv6_Gateway", "IPv6DefaultGateway"],
          flat,
          ro,
        );
        let ip6 = src.ipam_v6 || {};
        let poolId = ip6.pool_id != null ? String(ip6.pool_id) : "";
        let conflict = !!ip6.pool_conflict;
        tr.dataset.gcPoolConflict = conflict ? "1" : "0";
        tr.innerHTML =
          '<td><input type="text" class="gc-if-flyout__input mono gc-if-cmb-hw" readonly tabindex="-1" aria-readonly="true" title="Hardware (read-only)" value="' +
          escapeHtml(hw) +
          '" /></td>' +
          '<td><input type="text" class="gc-if-flyout__input mono gc-if-cmb-v6-ip" autocomplete="off" value="' +
          escapeHtml(ip) +
          '" /></td>' +
          '<td><input type="text" class="gc-if-flyout__input mono gc-if-cmb-v6-px" autocomplete="off" value="' +
          escapeHtml(px) +
          '" /></td>' +
          '<td class="gc-if-cmb-gw-cell"><input type="text" class="gc-if-flyout__input gc-if-cmb-v6-gw-name" autocomplete="off" value="' +
          escapeHtml(gwn) +
          '" /></td>' +
          '<td class="gc-if-cmb-gw-cell"><input type="text" class="gc-if-flyout__input mono gc-if-cmb-v6-gw-ip" autocomplete="off" value="' +
          escapeHtml(gwi) +
          '" /></td>' +
          '<td><select class="gc-if-flyout__input gc-if-flyout__select gc-if-cmb-pool-v6">' +
          poolOptionsHtml(poolId) +
          "</select></td>" +
          '<td class="gc-if-cmb-pool-conflict-cell"><span class="gc-if-cmb-pool-conflict" title="' +
          (conflict
            ? "Address does not match IPAM pool assignment for this scope"
            : "") +
          '">' +
          (conflict
            ? '<span class="gc-if-ipam-cidr-icon gc-if-ipam-cidr-icon--conflict gc-if-cmb-inline-icon" role="img" aria-label="Pool mismatch">!</span>'
            : "") +
          "</span></td>";
        let sel = tr.querySelector(".gc-if-cmb-pool-v6");
        if (sel) {
          sel.addEventListener("change", function () {
            onPoolChangeV6(tr, sel.value, ro);
          });
        }
        tb.appendChild(scopeTr);
        tb.appendChild(tr);
      });
      tb.dataset.gcIfCmbKey = sourcesStableKey(srcs);
      syncCombinedGwCols(els, ro);
      bindCombinedStaticFilter(wrap, tb);
      applyCombinedStaticFilter(tb, "");
    });
  }

  globalThis.gcNetIfCombinedStaticSync = function (els, row, opts) {
    if (!els || !row) return;
    let force = !!(opts && opts.forceRebuild);
    let ro = resolveOpts(opts);
    let on = combinedRowActive(row);
    let v4s =
      on &&
      els.ipv4Cb &&
      els.ipv4Cb.checked &&
      modeV4From(ro) === "static" &&
      !!els.ipv4CombinedWrap &&
      !!els.ipv4SingleStatic;
    let v6s =
      on &&
      els.ipv6Cb &&
      els.ipv6Cb.checked &&
      modeV6From(ro) === "static" &&
      !!els.ipv6CombinedWrap &&
      !!els.ipv6SingleStatic;
    if (els.ipv4SingleStatic) {
      els.ipv4SingleStatic.hidden = v4s;
      els.ipv4SingleStatic.setAttribute("aria-hidden", v4s ? "true" : "false");
    }
    if (els.ipv4CombinedWrap) {
      els.ipv4CombinedWrap.hidden = !v4s;
      els.ipv4CombinedWrap.setAttribute("aria-hidden", v4s ? "false" : "true");
    }
    if (els.ipv6SingleStatic) {
      els.ipv6SingleStatic.hidden = v6s;
      els.ipv6SingleStatic.setAttribute("aria-hidden", v6s ? "true" : "false");
    }
    if (els.ipv6CombinedWrap) {
      els.ipv6CombinedWrap.hidden = !v6s;
      els.ipv6CombinedWrap.setAttribute("aria-hidden", v6s ? "false" : "true");
    }
    let srcs = row.if_combine_sources || [];
    let srcKey = sourcesStableKey(srcs);
    if (v4s && srcs.length) {
      let tb4 = els.ipv4CombinedTbody;
      let needV4 =
        force ||
        !tb4 ||
        tb4.dataset.gcIfCmbKey !== srcKey ||
        countCombinedDataRows(tb4) !== srcs.length;
      if (needV4) buildIpv4Combined(els, row, ro);
      else syncCombinedGwCols(els, ro);
    } else if (els.ipv4CombinedTbody) {
      els.ipv4CombinedTbody.innerHTML = "";
      els.ipv4CombinedTbody.dataset.gcIfCmbKey = "";
    }
    if (v6s && srcs.length) {
      let tb6 = els.ipv6CombinedTbody;
      let needV6 =
        force ||
        !tb6 ||
        tb6.dataset.gcIfCmbKey !== srcKey ||
        countCombinedDataRows(tb6) !== srcs.length;
      if (needV6) buildIpv6Combined(els, row, ro);
      else syncCombinedGwCols(els, ro);
    } else if (els.ipv6CombinedTbody) {
      els.ipv6CombinedTbody.innerHTML = "";
      els.ipv6CombinedTbody.dataset.gcIfCmbKey = "";
    }
    if (!v4s && !v6s) syncCombinedGwCols(els, ro);
  };

  globalThis.gcNetIfCombinedStaticUsesV4 = function (els, row, opts) {
    let ro = resolveOpts(opts);
    return (
      combinedRowActive(row) &&
      els &&
      els.ipv4Cb &&
      els.ipv4Cb.checked &&
      modeV4From(ro) === "static"
    );
  };

  globalThis.gcNetIfCombinedStaticUsesV6 = function (els, row, opts) {
    let ro = resolveOpts(opts);
    return (
      combinedRowActive(row) &&
      els &&
      els.ipv6Cb &&
      els.ipv6Cb.checked &&
      modeV6From(ro) === "static"
    );
  };

  globalThis.gcNetIfInvalidateIpamPoolsCache = function () {
    ipamPoolsCache = null;
  };
})();
