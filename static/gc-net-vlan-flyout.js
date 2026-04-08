/**
 * VLAN add/edit flyout — mirrors gc-net-if-flyout IPv4/IPv6/zone/gateway behavior; no Advanced block.
 */
(function () {
  "use strict";

  var initialFormSnapshot = "";
  var currentNetRow = null;
  var addMode = false;

  function pick(flat, keys) {
    if (!flat) return "";
    for (var i = 0; i < keys.length; i++) {
      var v = flat[keys[i]];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  function normLower(s) {
    return String(s || "").trim().toLowerCase();
  }

  function ifTbodyId() {
    var p = (typeof window.gcNetVlanIfPrefix === "string" && window.gcNetVlanIfPrefix) || "gc-net-if";
    return p + "-tbody";
  }

  function vlanTbodyId() {
    var p = (typeof window.gcNetVlanVlanPrefix === "string" && window.gcNetVlanVlanPrefix) || "gc-net-vlan";
    return p + "-tbody";
  }

  function rowMatchesNetScope(row, fwId, cfgId) {
    var wantFw = fwId != null && fwId !== "" && !isNaN(Number(fwId));
    var wantCfg = cfgId != null && cfgId !== "" && !isNaN(Number(cfgId));
    if (!wantFw && !wantCfg) return true;
    if (wantFw) {
      if (row.firewall_id == null || Number(row.firewall_id) !== Number(fwId)) return false;
    }
    if (wantCfg) {
      if (row.configuration_id == null || Number(row.configuration_id) !== Number(cfgId)) return false;
    }
    return true;
  }

  function zoneTbodyIds() {
    return [ifTbodyId(), vlanTbodyId()];
  }

  function collectZonesFromNetworkTablesScoped(fwId, cfgId, opts) {
    var require = opts && opts.requireScope;
    var wantFw = fwId != null && fwId !== "" && !isNaN(Number(fwId));
    var wantCfg = cfgId != null && cfgId !== "" && !isNaN(Number(cfgId));
    if (require && !wantFw && !wantCfg) return [];
    var set = {};
    zoneTbodyIds().forEach(function (tid) {
      var tbody = document.getElementById(tid);
      if (!tbody) return;
      tbody.querySelectorAll("tr[data-search]").forEach(function (tr) {
        var row = tr._gcNetRow;
        if (!row) return;
        if (!rowMatchesNetScope(row, fwId, cfgId)) return;
        var td = tr.querySelector('td[data-gc-col="__zone"]');
        var t = td ? (td.textContent || "").trim().replace(/\s+/g, " ") : "";
        if (t && normLower(t) !== "none") set[t] = true;
      });
    });
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }

  function collectParentInterfaceNamesScoped(fwId, cfgId, opts) {
    var require = opts && opts.requireScope;
    var wantFw = fwId != null && fwId !== "" && !isNaN(Number(fwId));
    var wantCfg = cfgId != null && cfgId !== "" && !isNaN(Number(cfgId));
    if (require && !wantFw && !wantCfg) return [];
    var tbody = document.getElementById(ifTbodyId());
    if (!tbody) return [];
    var names = [];
    var seen = {};
    tbody.querySelectorAll("tr.gc-net-entity-row--clickable, tr[class*='-data-row']").forEach(function (tr) {
      var row = tr._gcNetRow;
      if (!row || !row.cells) return;
      if (row.entity_type && row.entity_type !== "interface") return;
      if (!rowMatchesNetScope(row, fwId, cfgId)) return;
      var n = String(row.cells.__name != null ? row.cells.__name : "").trim();
      if (!n || seen[n]) return;
      seen[n] = true;
      names.push(n);
    });
    names.sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
    return names;
  }

  function vlanScopeForPickers() {
    if (!addMode) {
      var r = currentNetRow;
      return {
        fwId: r && r.firewall_id != null && r.firewall_id !== "" ? Number(r.firewall_id) : undefined,
        cfgId: r && r.configuration_id != null && r.configuration_id !== "" ? Number(r.configuration_id) : undefined,
        requireScope: false,
      };
    }
    var target = typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
    if (target === "firewall") {
      var fv = els.addFwSelect ? els.addFwSelect.value.trim() : "";
      var fn = parseInt(fv, 10);
      var fok = fv && !isNaN(fn) && fn > 0;
      return { fwId: fok ? fn : undefined, cfgId: undefined, requireScope: true };
    }
    var cv = els.addCfgSelect ? els.addCfgSelect.value.trim() : "";
    var cn = parseInt(cv, 10);
    var cok = cv && !isNaN(cn) && cn > 0;
    return { fwId: undefined, cfgId: cok ? cn : undefined, requireScope: true };
  }

  function fillVlanAddTargetSelects() {
    var target = typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
    if (target === "firewall" && els.addFwSelect) {
      var inv = typeof window.gcGetFirewallNavInventory === "function" ? window.gcGetFirewallNavInventory() : [];
      els.addFwSelect.innerHTML =
        '<option value="">Select firewall…</option>' +
        inv
          .map(function (x) {
            return '<option value="' + escapeAttr(String(x.id)) + '">' + escapeHtml(x.label) + "</option>";
          })
          .join("");
      els.addFwSelect.value = "";
    }
    if (target === "configuration" && els.addCfgSelect) {
      var inv2 =
        typeof window.gcGetConfigurationNavInventory === "function" ? window.gcGetConfigurationNavInventory() : [];
      els.addCfgSelect.innerHTML =
        '<option value="">Select configuration…</option>' +
        inv2
          .map(function (x) {
            return '<option value="' + escapeAttr(String(x.id)) + '">' + escapeHtml(x.label) + "</option>";
          })
          .join("");
      els.addCfgSelect.value = "";
    }
  }

  function refreshVlanAddScopedPickers() {
    var sc = vlanScopeForPickers();
    var curZ = els.zone && els.zone.value ? els.zone.value : "LAN";
    setZoneOptions(curZ, sc.fwId, sc.cfgId, { requireScope: sc.requireScope });
    fillParentInterfaceSelect();
    syncZoneBelow();
    syncGatewayBlocksForZone();
  }

  function netmaskToDisplay(nm) {
    return window.gcNetIpv4FlyoutBlur.netmaskToDisplay(nm);
  }

  function tryApplyIpv4CidrOnBlur() {
    window.gcNetIpv4FlyoutBlur.applyCidrSplit(els, syncDirty);
  }

  function tryNormalizeIpv4NetmaskOnBlur() {
    window.gcNetIpv4FlyoutBlur.applyNetmaskNormalize(els, syncDirty);
  }

  function tryApplyIpv6CidrOnBlur() {
    if (!els.ipv6Ip || !els.ipv6Prefix) return;
    if (els.ipv6Ip.readOnly) return;
    var raw = els.ipv6Ip.value.trim();
    var slash = raw.lastIndexOf("/");
    if (slash < 0) return;
    var addr = raw.slice(0, slash).trim();
    var pstr = raw.slice(slash + 1).trim();
    var prefix = parseInt(pstr, 10);
    if (pstr !== String(prefix) || prefix < 0 || prefix > 128) return;
    if (!addr || addr.indexOf(":") < 0) return;
    els.ipv6Ip.value = addr;
    els.ipv6Prefix.value = String(prefix);
    syncDirty();
  }

  function guessIpv4Mode(flat) {
    var v = normLower(
      pick(flat, [
        "IPv4Assignment",
        "IPv4_Assignment",
        "AddressType",
        "IPv4AddressType",
        "ConnectionType",
        "IPv4ConnectionType",
      ]),
    );
    if (v.indexOf("dhcp") !== -1) return "dhcp";
    if (v.indexOf("ppp") !== -1 || v.indexOf("pppoe") !== -1) return "pppoe";
    if (v.indexOf("static") !== -1) return "static";
    var ip = pick(flat, ["IPAddress", "IPv4Address"]);
    if (ip) return "static";
    return "dhcp";
  }

  function guessIpv6Mode(flat) {
    var v = normLower(
      pick(flat, [
        "IPv6Assignment",
        "IPv6_Assignment",
        "IPv6AddressType",
        "IPv6ConnectionType",
      ]),
    );
    if (v.indexOf("delegat") !== -1) return "delegated";
    if (v.indexOf("dhcp") !== -1) return "dhcp";
    if (v.indexOf("static") !== -1) return "static";
    var ip = pick(flat, ["IPv6Address", "IPv6_Address"]);
    if (ip) return "static";
    return "static";
  }

  function truthyFlat(flat, keys) {
    var s = normLower(pick(flat, keys));
    if (s === "false" || s === "0" || s === "no" || s === "off" || s === "disabled") return false;
    if (s === "true" || s === "1" || s === "yes" || s === "on" || s === "enable" || s === "enabled") return true;
    return null;
  }

  var els = {};

  function setZoneOptions(currentZone, fwId, cfgId, scopeOpts) {
    var sel = els.zone;
    if (!sel) return;
    var zones = collectZonesFromNetworkTablesScoped(fwId, cfgId, scopeOpts || {});
    var cur = (currentZone || "").trim();
    if (cur && normLower(cur) !== "none" && zones.indexOf(cur) === -1) zones.push(cur);
    zones.sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
    sel.innerHTML =
      '<option value="None">None</option>' +
      zones
        .map(function (z) {
          return '<option value="' + escapeAttr(z) + '">' + escapeHtml(z) + "</option>";
        })
        .join("");
    var useVal = cur && normLower(cur) !== "none" ? cur : "None";
    sel.value = zones.indexOf(useVal) !== -1 || useVal === "None" ? useVal : "";
    if (useVal && useVal !== "None" && !sel.value && cur) {
      var opt = document.createElement("option");
      opt.value = cur;
      opt.textContent = cur;
      sel.appendChild(opt);
      sel.value = cur;
    }
  }

  function fillParentInterfaceSelect() {
    var sel = els.ifSelect;
    if (!sel) return;
    var sc = vlanScopeForPickers();
    var names = collectParentInterfaceNamesScoped(sc.fwId, sc.cfgId, { requireScope: sc.requireScope });
    if (sc.requireScope && !names.length) {
      sel.innerHTML = '<option value="">Select firewall or configuration above…</option>';
      return;
    }
    sel.innerHTML = names
      .map(function (n) {
        return '<option value="' + escapeAttr(n) + '">' + escapeHtml(n) + "</option>";
      })
      .join("");
    if (names.length) sel.value = names[0];
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function syncZoneBelow() {
    var post = els.postZone;
    if (!post || !els.zone) return;
    var empty = !els.zone.value || normLower(els.zone.value) === "none";
    post.hidden = empty;
    post.setAttribute("aria-hidden", empty ? "true" : "false");
  }

  function syncIpv4Body() {
    if (!els.ipv4Cb || !els.ipv4Body) return;
    var on = els.ipv4Cb.checked;
    els.ipv4Body.hidden = !on;
    els.ipv4Body.setAttribute("aria-hidden", on ? "false" : "true");
  }

  function syncIpv6Body() {
    if (!els.ipv6Cb || !els.ipv6Body) return;
    var on = els.ipv6Cb.checked;
    els.ipv6Body.hidden = !on;
    els.ipv6Body.setAttribute("aria-hidden", on ? "false" : "true");
  }

  var lastZoneWasWan = false;

  function isWanNetworkZone() {
    if (!els.zone) return false;
    return normLower((els.zone.value || "").trim()) === "wan";
  }

  function clearGatewayFields() {
    if (els.ipv4GwName) els.ipv4GwName.value = "";
    if (els.ipv4GwIp) els.ipv4GwIp.value = "";
    if (els.ipv6GwName) els.ipv6GwName.value = "";
    if (els.ipv6GwIp) els.ipv6GwIp.value = "";
    function clearTbodyGw(tb) {
      if (!tb) return;
      tb.querySelectorAll("tr").forEach(function (tr) {
        tr.querySelectorAll(
          ".gc-if-cmb-v4-gw-name, .gc-if-cmb-v4-gw-ip, .gc-if-cmb-v6-gw-name, .gc-if-cmb-v6-gw-ip",
        ).forEach(function (inp) {
          inp.value = "";
        });
      });
    }
    clearTbodyGw(els.ipv4CombinedTbody);
    clearTbodyGw(els.ipv6CombinedTbody);
  }

  function syncGatewayBlocksForZone() {
    var show = isWanNetworkZone();
    if (els.ipv4GatewayWrap) {
      els.ipv4GatewayWrap.hidden = !show;
      els.ipv4GatewayWrap.setAttribute("aria-hidden", show ? "false" : "true");
    }
    if (els.ipv6GatewayWrap) {
      els.ipv6GatewayWrap.hidden = !show;
      els.ipv6GatewayWrap.setAttribute("aria-hidden", show ? "false" : "true");
    }
  }

  function syncIpv4ModeUi() {
    if (!els.ipv4ModeDhcp || !els.ipv4Ip) return;
    var mode = "";
    if (els.ipv4ModeStatic && els.ipv4ModeStatic.checked) mode = "static";
    else if (els.ipv4ModePppoe && els.ipv4ModePppoe.checked) mode = "pppoe";
    else if (els.ipv4ModeDhcp && els.ipv4ModeDhcp.checked) mode = "dhcp";
    var ro = mode === "dhcp" || mode === "pppoe";
    [els.ipv4Ip, els.ipv4Nm, els.ipv4GwIp].forEach(function (inp) {
      if (!inp) return;
      inp.readOnly = ro;
      inp.classList.toggle("gc-if-flyout__input--readonly", ro);
    });
    vlanCombinedSync();
  }

  function syncIpv6ModeUi() {
    if (!els.ipv6ModeDhcp) return;
    var mode = "";
    if (els.ipv6ModeStatic && els.ipv6ModeStatic.checked) mode = "static";
    else if (els.ipv6ModeDhcp && els.ipv6ModeDhcp.checked) mode = "dhcp";
    else if (els.ipv6ModeDel && els.ipv6ModeDel.checked) mode = "delegated";
    var ro = mode === "dhcp";
    [els.ipv6Ip, els.ipv6Prefix, els.ipv6GwName, els.ipv6GwIp].forEach(function (inp) {
      if (!inp) return;
      inp.readOnly = ro;
      inp.classList.toggle("gc-if-flyout__input--readonly", ro);
    });
    vlanCombinedSync();
  }

  function clearIpv4Section() {
    if (els.ipv4ModeStatic) els.ipv4ModeStatic.checked = true;
    if (els.ipv4ModeDhcp) els.ipv4ModeDhcp.checked = false;
    if (els.ipv4ModePppoe) els.ipv4ModePppoe.checked = false;
    if (els.ipv4Ip) els.ipv4Ip.value = "";
    if (els.ipv4Nm) els.ipv4Nm.value = "";
    if (els.ipv4GwName) els.ipv4GwName.value = "";
    if (els.ipv4GwIp) els.ipv4GwIp.value = "";
  }

  function clearIpv6Section() {
    if (els.ipv6ModeStatic) els.ipv6ModeStatic.checked = true;
    if (els.ipv6ModeDhcp) els.ipv6ModeDhcp.checked = false;
    if (els.ipv6ModeDel) els.ipv6ModeDel.checked = false;
    if (els.ipv6Ip) els.ipv6Ip.value = "";
    if (els.ipv6Prefix) els.ipv6Prefix.value = "";
    if (els.ipv6GwName) els.ipv6GwName.value = "";
    if (els.ipv6GwIp) els.ipv6GwIp.value = "";
  }

  function ipv4ModeValue() {
    if (els.ipv4ModeStatic && els.ipv4ModeStatic.checked) return "static";
    if (els.ipv4ModePppoe && els.ipv4ModePppoe.checked) return "pppoe";
    if (els.ipv4ModeDhcp && els.ipv4ModeDhcp.checked) return "dhcp";
    return "dhcp";
  }

  function ipv6ModeValue() {
    if (els.ipv6ModeStatic && els.ipv6ModeStatic.checked) return "static";
    if (els.ipv6ModeDhcp && els.ipv6ModeDhcp.checked) return "dhcp";
    if (els.ipv6ModeDel && els.ipv6ModeDel.checked) return "delegated";
    return "static";
  }

  function applyIpv4CheckboxOnLoad() {
    if (!els.ipv4Cb || !els.ipv4Ip) return;
    var staticMode = ipv4ModeValue() === "static";
    var blank = els.ipv4Ip.value.trim() === "";
    if (staticMode && blank) {
      clearIpv4Section();
      els.ipv4Cb.checked = false;
    } else {
      els.ipv4Cb.checked = true;
    }
    syncIpv4Body();
    syncIpv4ModeUi();
  }

  function applyIpv6CheckboxOnLoad() {
    if (!els.ipv6Cb || !els.ipv6Ip) return;
    var staticMode = ipv6ModeValue() === "static";
    var blank = els.ipv6Ip.value.trim() === "";
    if (staticMode && blank) {
      clearIpv6Section();
      els.ipv6Cb.checked = false;
    } else {
      els.ipv6Cb.checked = true;
    }
    syncIpv6Body();
    syncIpv6ModeUi();
  }

  function getFormSnapshot() {
    var form = els.form;
    if (!form) return "";
    var nodes = form.querySelectorAll("input, select, textarea");
    var parts = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.offsetParent === null && n.type !== "hidden") continue;
      var t = n.type;
      if (t === "submit" || t === "button" || n.disabled) continue;
      var key = n.name || n.id;
      if (!key) key = "i" + i;
      if (t === "checkbox") {
        parts.push(key + "=" + (n.checked ? "1" : "0"));
      } else if (t === "radio") {
        if (n.checked) parts.push(key + "=" + n.value);
      } else {
        parts.push(key + "=" + (n.value || ""));
      }
    }
    return parts.join("|");
  }

  function setInitialSnapshot() {
    initialFormSnapshot = getFormSnapshot();
    if (els.saveBtn) els.saveBtn.disabled = true;
  }

  function syncDirty() {
    if (!els.saveBtn) return;
    els.saveBtn.disabled = getFormSnapshot() === initialFormSnapshot;
  }

  var VLAN_COMBINE_COL_LABELS = {
    __type: "Type",
    __name: "Name",
    __zone: "Network zone",
    __status: "Status",
    __address_cidr: "Address (CIDR)",
    __hardware: "Hardware",
    __auto_negotiation: "Auto-negotiation",
    Name: "Name",
    NetworkZone: "Network zone",
    Zone: "Zone",
    IPAddress: "IPv4 address",
    IPv4Address: "IPv4 address",
    Netmask: "IPv4 netmask",
    IPv4Netmask: "IPv4 netmask",
    IPv6Address: "IPv6 address",
    IPv6_Address: "IPv6 address",
    Prefix: "IPv6 prefix",
    IPv6Prefix: "IPv6 prefix",
    IPv6PrefixLength: "IPv6 prefix length",
    PrefixLength: "Prefix length",
    GatewayName: "Gateway name (IPv4)",
    IPv4GatewayName: "Gateway name (IPv4)",
    DefaultGatewayName: "Gateway name (IPv4)",
    GatewayIP: "Gateway IP (IPv4)",
    Gateway: "Gateway (IPv4)",
    DefaultGateway: "Default gateway (IPv4)",
    IPv4Gateway: "Gateway (IPv4)",
    GatewayNameIpv6: "Gateway name (IPv6)",
    IPv6GatewayName: "Gateway name (IPv6)",
    IPv6_GatewayName: "Gateway name (IPv6)",
    GatewayIPv6: "Gateway address (IPv6)",
    IPv6Gateway: "Gateway address (IPv6)",
    IPv6_Gateway: "Gateway address (IPv6)",
    IPv6DefaultGateway: "IPv6 default gateway",
  };

  function collectFlyoutScopeIds(form) {
    if (!form) return [];
    var isCfg =
      typeof window.gcHsEntityTarget === "string" && window.gcHsEntityTarget === "configuration";
    var ms = form.querySelector(isCfg ? "[data-gc-cfg-ms]" : "[data-gc-fw-ms]");
    if (!ms) return [];
    var idAttr = isCfg ? "data-gc-cfg-id" : "data-gc-fw-id";
    var out = [];
    ms.querySelectorAll("input[type=\"checkbox\"]").forEach(function (cb) {
      if (!cb.checked || !cb.hasAttribute(idAttr)) return;
      var n = parseInt(String(cb.getAttribute(idAttr) || ""), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function scopeIdFromSource(src) {
    if (!src) return null;
    if (src.configuration_id != null && String(src.configuration_id).trim() !== "") {
      var c = parseInt(String(src.configuration_id), 10);
      if (!isNaN(c) && c > 0) return c;
    }
    if (src.firewall_id != null && String(src.firewall_id).trim() !== "") {
      var f = parseInt(String(src.firewall_id), 10);
      if (!isNaN(f) && f > 0) return f;
    }
    return null;
  }

  function vlanCmbOpts() {
    return {
      ipv4ModeValue: ipv4ModeValue,
      ipv6ModeValue: ipv6ModeValue,
      pick: pick,
      netmaskToDisplay: netmaskToDisplay,
      syncDirty: syncDirty,
      isWanNetworkZone: isWanNetworkZone,
    };
  }

  function vlanCombinedSync(x) {
    if (typeof window.gcNetIfCombinedStaticSync !== "function" || !currentNetRow) return;
    window.gcNetIfCombinedStaticSync(els, currentNetRow, Object.assign(vlanCmbOpts(), x || {}));
  }

  function mountVlanFirewallPicker(row) {
    if (!els.fwSlot || typeof window.gcHsBuildFirewallPickerSectionHtml !== "function") return;
    var initial = [];
    var assigned = [];
    if (row && row.configuration_ids && row.configuration_ids.length) {
      initial = row.configuration_ids.slice();
      assigned = row.configuration_ids.slice();
    } else if (row && row.firewall_ids && row.firewall_ids.length) {
      initial = row.firewall_ids.slice();
      assigned = row.firewall_ids.slice();
    } else if (row) {
      var cid = row.configuration_id;
      var fid = row.firewall_id;
      var cn = cid != null ? parseInt(String(cid), 10) : NaN;
      var fn = fid != null ? parseInt(String(fid), 10) : NaN;
      if (!isNaN(cn) && cn > 0) initial = assigned = [cn];
      else if (!isNaN(fn) && fn > 0) initial = assigned = [fn];
    }
    var mode = initial.length ? "edit" : "add";
    els.fwSlot.innerHTML = window.gcHsBuildFirewallPickerSectionHtml(mode, initial, assigned);
    if (typeof window.gcHsHydrateFlyoutFirewallPicker === "function") {
      try {
        window.gcHsHydrateFlyoutFirewallPicker(els.form, { row: row || {} });
      } catch (e1) {}
    }
    var ms = els.form && els.form.querySelector("[data-gc-fw-ms], [data-gc-cfg-ms]");
    if (ms) {
      ms.querySelectorAll("input[type=\"checkbox\"]").forEach(function (cb) {
        cb.addEventListener("change", syncDirty);
      });
    }
  }

  function applyVlanCombineChrome(root, row) {
    if (typeof window.gcCombineFlyoutClearConflictChrome === "function") {
      try {
        window.gcCombineFlyoutClearConflictChrome(root);
      } catch (e0) {}
    }
    if (
      row &&
      typeof window.gcCombineFlyoutApplyConflictChrome === "function" &&
      window.gcExtractCombinePerFieldMap &&
      window.gcExtractCombinePerFieldMap(row)
    ) {
      try {
        window.gcCombineFlyoutApplyConflictChrome(root, row, { columnLabels: VLAN_COMBINE_COL_LABELS });
      } catch (e2) {}
    }
  }

  function collectVlanForm() {
    var wan = isWanNetworkZone();
    var out = {
      name: els.nameInp ? els.nameInp.value.trim() : "",
      network_zone: els.zone ? els.zone.value : "",
      ipv4_enabled: !!(els.ipv4Cb && els.ipv4Cb.checked),
      ipv4_mode: ipv4ModeValue(),
      ipv4_ip: els.ipv4Ip ? els.ipv4Ip.value : "",
      ipv4_netmask: els.ipv4Nm ? els.ipv4Nm.value : "",
      ipv4_gateway_name: wan && els.ipv4GwName ? els.ipv4GwName.value : "",
      ipv4_gateway_ip: wan && els.ipv4GwIp ? els.ipv4GwIp.value : "",
      ipv6_enabled: !!(els.ipv6Cb && els.ipv6Cb.checked),
      ipv6_mode: ipv6ModeValue(),
      ipv6_ip: els.ipv6Ip ? els.ipv6Ip.value : "",
      ipv6_prefix: els.ipv6Prefix ? els.ipv6Prefix.value : "",
      ipv6_gateway_name: wan && els.ipv6GwName ? els.ipv6GwName.value : "",
      ipv6_gateway_ip: wan && els.ipv6GwIp ? els.ipv6GwIp.value : "",
    };
    if (addMode) {
      out.hardware = els.hwInput ? els.hwInput.value.trim() : "";
      out.interface_parent = els.ifSelect ? els.ifSelect.value.trim() : "";
      out.vlan_id = els.vlanIdInp ? els.vlanIdInp.value.trim() : "";
    }
    return out;
  }

  function collectVlanFormWithCombinedRow(tr4, tr6) {
    var base = collectVlanForm();
    var wan = isWanNetworkZone();
    if (tr4) {
      var ip = tr4.querySelector(".gc-if-cmb-v4-ip");
      var nm = tr4.querySelector(".gc-if-cmb-v4-nm");
      if (ip) base.ipv4_ip = ip.value.trim();
      if (nm) base.ipv4_netmask = nm.value.trim();
      if (wan) {
        var gwn = tr4.querySelector(".gc-if-cmb-v4-gw-name");
        var gwi = tr4.querySelector(".gc-if-cmb-v4-gw-ip");
        base.ipv4_gateway_name = gwn ? gwn.value.trim() : "";
        base.ipv4_gateway_ip = gwi ? gwi.value.trim() : "";
      } else {
        base.ipv4_gateway_name = "";
        base.ipv4_gateway_ip = "";
      }
    }
    if (tr6) {
      var ip6 = tr6.querySelector(".gc-if-cmb-v6-ip");
      var px = tr6.querySelector(".gc-if-cmb-v6-px");
      if (ip6) base.ipv6_ip = ip6.value.trim();
      if (px) base.ipv6_prefix = px.value.trim();
      if (wan) {
        var g6n = tr6.querySelector(".gc-if-cmb-v6-gw-name");
        var g6i = tr6.querySelector(".gc-if-cmb-v6-gw-ip");
        base.ipv6_gateway_name = g6n ? g6n.value.trim() : "";
        base.ipv6_gateway_ip = g6i ? g6i.value.trim() : "";
      } else {
        base.ipv6_gateway_name = "";
        base.ipv6_gateway_ip = "";
      }
    }
    return base;
  }

  function open(root) {
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("gc-if-flyout--open");
    var panel = root.querySelector(".gc-if-flyout__panel");
    if (panel) {
      try {
        panel.focus();
      } catch (e) {}
    }
  }

  function close(root) {
    if (typeof window.gcCombineFlyoutClearConflictChrome === "function") {
      try {
        window.gcCombineFlyoutClearConflictChrome(root);
      } catch (eC) {}
    }
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gc-if-flyout--open");
    addMode = false;
  }

  function syncAddEditLayout() {
    var edH = document.getElementById("gc-vlan-flyout-hardware-row-edit");
    var adH = document.getElementById("gc-vlan-flyout-hardware-row-add");
    var edI = document.getElementById("gc-vlan-flyout-interface-row-edit");
    var adI = document.getElementById("gc-vlan-flyout-interface-row-add");
    var vid = document.getElementById("gc-vlan-flyout-vlanid-row");
    var tfw = document.getElementById("gc-vlan-flyout-target-fw-row");
    var tcg = document.getElementById("gc-vlan-flyout-target-cfg-row");
    var target = typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
    if (edH) edH.hidden = addMode;
    if (adH) adH.hidden = !addMode;
    if (edI) edI.hidden = addMode;
    if (adI) adI.hidden = !addMode;
    if (vid) vid.hidden = !addMode;
    if (tfw) {
      var showFw = !!(addMode && target === "firewall");
      tfw.hidden = !showFw;
      tfw.setAttribute("aria-hidden", showFw ? "false" : "true");
    }
    if (tcg) {
      var showCfg = !!(addMode && target === "configuration");
      tcg.hidden = !showCfg;
      tcg.setAttribute("aria-hidden", showCfg ? "false" : "true");
    }
    if (els.fwSlot) {
      var showFwMs = !addMode;
      els.fwSlot.hidden = !showFwMs;
      els.fwSlot.setAttribute("aria-hidden", showFwMs ? "false" : "true");
      if (addMode) els.fwSlot.innerHTML = "";
    }
    if (els.title) els.title.textContent = addMode ? "Add VLAN" : "Edit VLAN";
  }

  function populateFromRow(row) {
    addMode = false;
    syncAddEditLayout();
    var flat = (row && row.flat) || {};
    var cells = (row && row.cells) || {};

    var name = pick(flat, ["Name"]) || String(cells.__name != null ? cells.__name : "") || "";
    var hw = pick(flat, ["Hardware"]) || String(cells.__hardware != null ? cells.__hardware : "") || "";
    var zone = pick(flat, ["NetworkZone", "Zone", "ZoneName"]) || String(cells.__zone != null ? cells.__zone : "") || "";
    var iface = pick(flat, ["Interface", "ParentInterface", "BoundTo", "PhysicalInterface"]);

    if (els.nameInp) els.nameInp.value = name;
    if (els.hwReadonly) els.hwReadonly.textContent = hw || "—";
    if (els.ifReadonly) els.ifReadonly.textContent = iface || hw || "—";
    var fwId = row && row.firewall_id != null && row.firewall_id !== "" ? Number(row.firewall_id) : undefined;
    var cfgId = row && row.configuration_id != null && row.configuration_id !== "" ? Number(row.configuration_id) : undefined;
    setZoneOptions(zone, fwId, cfgId, { requireScope: false });

    var v4 = guessIpv4Mode(flat);
    if (els.ipv4ModeStatic) els.ipv4ModeStatic.checked = v4 === "static";
    if (els.ipv4ModePppoe) els.ipv4ModePppoe.checked = v4 === "pppoe";
    if (els.ipv4ModeDhcp) els.ipv4ModeDhcp.checked = v4 === "dhcp";

    if (els.ipv4Ip) els.ipv4Ip.value = pick(flat, ["IPAddress", "IPv4Address"]);
    if (els.ipv4Nm) els.ipv4Nm.value = netmaskToDisplay(pick(flat, ["Netmask", "IPv4Netmask"]));

    if (els.ipv4GwName) els.ipv4GwName.value = pick(flat, ["GatewayName", "IPv4GatewayName", "DefaultGatewayName"]);
    if (els.ipv4GwIp) els.ipv4GwIp.value = pick(flat, ["GatewayIP", "Gateway", "DefaultGateway", "IPv4Gateway"]);

    applyIpv4CheckboxOnLoad();

    var v6 = guessIpv6Mode(flat);
    if (els.ipv6ModeStatic) els.ipv6ModeStatic.checked = v6 === "static";
    if (els.ipv6ModeDhcp) els.ipv6ModeDhcp.checked = v6 === "dhcp";
    if (els.ipv6ModeDel) els.ipv6ModeDel.checked = v6 === "delegated";

    if (els.ipv6Ip) els.ipv6Ip.value = pick(flat, ["IPv6Address", "IPv6_Address"]);
    if (els.ipv6Prefix) els.ipv6Prefix.value = pick(flat, ["Prefix", "IPv6PrefixLength", "IPv6Prefix", "PrefixLength"]) || "64";

    if (els.ipv6GwName) els.ipv6GwName.value = pick(flat, ["GatewayNameIpv6", "IPv6GatewayName", "IPv6_GatewayName"]);
    if (els.ipv6GwIp) els.ipv6GwIp.value = pick(flat, ["GatewayIPv6", "IPv6Gateway", "IPv6_Gateway", "IPv6DefaultGateway"]);

    applyIpv6CheckboxOnLoad();

    syncZoneBelow();
    syncGatewayBlocksForZone();
    lastZoneWasWan = isWanNetworkZone();
    mountVlanFirewallPicker(row);
    vlanCombinedSync({ forceRebuild: true });
    applyVlanCombineChrome(els.root, row);
    setInitialSnapshot();
  }

  function populateAdd() {
    addMode = true;
    currentNetRow = null;
    syncAddEditLayout();
    fillVlanAddTargetSelects();
    var sc0 = vlanScopeForPickers();
    setZoneOptions("LAN", sc0.fwId, sc0.cfgId, { requireScope: sc0.requireScope });
    if (els.zone) {
      var z = els.zone;
      if (z.querySelector('option[value="LAN"]')) z.value = "LAN";
      else if (z.options.length) z.selectedIndex = Math.min(1, z.options.length - 1);
    }
    fillParentInterfaceSelect();
    if (els.nameInp) els.nameInp.value = "";
    if (els.hwInput) els.hwInput.value = "";
    if (els.vlanIdInp) els.vlanIdInp.value = "";

    if (els.ipv4ModeStatic) els.ipv4ModeStatic.checked = true;
    if (els.ipv4ModePppoe) els.ipv4ModePppoe.checked = false;
    if (els.ipv4ModeDhcp) els.ipv4ModeDhcp.checked = false;
    if (els.ipv4Ip) els.ipv4Ip.value = "";
    if (els.ipv4Nm) els.ipv4Nm.value = "";
    if (els.ipv4GwName) els.ipv4GwName.value = "";
    if (els.ipv4GwIp) els.ipv4GwIp.value = "";
    if (els.ipv4Cb) els.ipv4Cb.checked = true;

    if (els.ipv6ModeStatic) els.ipv6ModeStatic.checked = true;
    if (els.ipv6ModeDhcp) els.ipv6ModeDhcp.checked = false;
    if (els.ipv6ModeDel) els.ipv6ModeDel.checked = false;
    if (els.ipv6Ip) els.ipv6Ip.value = "";
    if (els.ipv6Prefix) els.ipv6Prefix.value = "64";
    if (els.ipv6GwName) els.ipv6GwName.value = "";
    if (els.ipv6GwIp) els.ipv6GwIp.value = "";
    if (els.ipv6Cb) els.ipv6Cb.checked = true;

    syncIpv4Body();
    syncIpv6Body();
    syncIpv4ModeUi();
    syncIpv6ModeUi();
    syncZoneBelow();
    syncGatewayBlocksForZone();
    lastZoneWasWan = isWanNetworkZone();
    if (els.ipv4CombinedTbody) {
      els.ipv4CombinedTbody.innerHTML = "";
      els.ipv4CombinedTbody.dataset.gcIfCmbKey = "";
    }
    if (els.ipv6CombinedTbody) {
      els.ipv6CombinedTbody.innerHTML = "";
      els.ipv6CombinedTbody.dataset.gcIfCmbKey = "";
    }
    setInitialSnapshot();
  }

  function cacheEls(root) {
    els = {
      root: root,
      title: root.querySelector("#gc-vlan-flyout-title"),
      postZone: root.querySelector("#gc-vlan-flyout-post-zone"),
      zone: root.querySelector("#gc-vlan-flyout-zone"),
      nameInp: root.querySelector("#gc-vlan-flyout-name"),
      hwReadonly: root.querySelector("#gc-vlan-flyout-hardware-readonly"),
      hwInput: root.querySelector("#gc-vlan-flyout-hardware-input"),
      ifReadonly: root.querySelector("#gc-vlan-flyout-interface-readonly"),
      ifSelect: root.querySelector("#gc-vlan-flyout-interface-select"),
      vlanIdInp: root.querySelector("#gc-vlan-flyout-vlan-id"),
      ipv4Cb: root.querySelector("#gc-vlan-flyout-ipv4-enabled"),
      ipv4Body: root.querySelector("#gc-vlan-flyout-ipv4-body"),
      ipv6Cb: root.querySelector("#gc-vlan-flyout-ipv6-enabled"),
      ipv6Body: root.querySelector("#gc-vlan-flyout-ipv6-body"),
      ipv4ModeStatic: root.querySelector('input[name="gc-vlan-ipv4-mode"][value="static"]'),
      ipv4ModePppoe: root.querySelector('input[name="gc-vlan-ipv4-mode"][value="pppoe"]'),
      ipv4ModeDhcp: root.querySelector('input[name="gc-vlan-ipv4-mode"][value="dhcp"]'),
      ipv4Ip: root.querySelector("#gc-vlan-flyout-ipv4-ip"),
      ipv4Nm: root.querySelector("#gc-vlan-flyout-ipv4-netmask"),
      ipv4GwName: root.querySelector("#gc-vlan-flyout-ipv4-gw-name"),
      ipv4GwIp: root.querySelector("#gc-vlan-flyout-ipv4-gw-ip"),
      ipv4GatewayWrap: root.querySelector("#gc-vlan-flyout-ipv4-gateway-wrap"),
      ipv4SingleStatic: root.querySelector("#gc-vlan-flyout-ipv4-single-static"),
      ipv4CombinedWrap: root.querySelector("#gc-vlan-flyout-ipv4-combined-wrap"),
      ipv4CombinedTbody: root.querySelector("#gc-vlan-flyout-ipv4-combined-tbody"),
      ipv6ModeStatic: root.querySelector('input[name="gc-vlan-ipv6-mode"][value="static"]'),
      ipv6ModeDhcp: root.querySelector('input[name="gc-vlan-ipv6-mode"][value="dhcp"]'),
      ipv6ModeDel: root.querySelector('input[name="gc-vlan-ipv6-mode"][value="delegated"]'),
      ipv6Ip: root.querySelector("#gc-vlan-flyout-ipv6-ip"),
      ipv6Prefix: root.querySelector("#gc-vlan-flyout-ipv6-prefix"),
      ipv6GwName: root.querySelector("#gc-vlan-flyout-ipv6-gw-name"),
      ipv6GwIp: root.querySelector("#gc-vlan-flyout-ipv6-gw-ip"),
      ipv6GatewayWrap: root.querySelector("#gc-vlan-flyout-ipv6-gateway-wrap"),
      ipv6SingleStatic: root.querySelector("#gc-vlan-flyout-ipv6-single-static"),
      ipv6CombinedWrap: root.querySelector("#gc-vlan-flyout-ipv6-combined-wrap"),
      ipv6CombinedTbody: root.querySelector("#gc-vlan-flyout-ipv6-combined-tbody"),
      fwSlot: root.querySelector("#gc-vlan-flyout-fw-slot"),
      cancelBtn: root.querySelector("#gc-vlan-flyout-cancel"),
      saveBtn: root.querySelector("#gc-vlan-flyout-save"),
      form: root.querySelector("#gc-vlan-flyout-form"),
      addFwSelect: root.querySelector("#gc-vlan-flyout-add-firewall"),
      addCfgSelect: root.querySelector("#gc-vlan-flyout-add-configuration"),
    };
  }

  function bindPanelResize(root) {
    var panel = root.querySelector(".gc-if-flyout__panel");
    var handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset.gcVlanResizeBound === "1") return;
    handle.dataset.gcVlanResizeBound = "1";
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

  function bind(root) {
    if (root.dataset.gcVlanFlyoutBound === "1") return;
    root.dataset.gcVlanFlyoutBound = "1";
    cacheEls(root);
    bindPanelResize(root);

    function onZoneChange() {
      var wan = isWanNetworkZone();
      syncZoneBelow();
      syncGatewayBlocksForZone();
      if (lastZoneWasWan && !wan) {
        clearGatewayFields();
      }
      lastZoneWasWan = wan;
      vlanCombinedSync();
      syncDirty();
    }
    if (els.zone) els.zone.addEventListener("change", onZoneChange);

    function onVlanAddTargetChange() {
      refreshVlanAddScopedPickers();
      syncDirty();
    }
    if (els.addFwSelect) els.addFwSelect.addEventListener("change", onVlanAddTargetChange);
    if (els.addCfgSelect) els.addCfgSelect.addEventListener("change", onVlanAddTargetChange);

    function onIpv4Toggle() {
      if (els.ipv4Cb && !els.ipv4Cb.checked) {
        clearIpv4Section();
      } else if (els.ipv4Cb && els.ipv4Cb.checked) {
        if (ipv4ModeValue() === "static" && els.ipv4Ip && els.ipv4Ip.value.trim() === "") {
          if (els.ipv4ModeDhcp) els.ipv4ModeDhcp.checked = true;
          if (els.ipv4ModeStatic) els.ipv4ModeStatic.checked = false;
          if (els.ipv4ModePppoe) els.ipv4ModePppoe.checked = false;
        }
      }
      syncIpv4Body();
      syncIpv4ModeUi();
      vlanCombinedSync();
      syncDirty();
    }
    function onIpv6Toggle() {
      if (els.ipv6Cb && !els.ipv6Cb.checked) {
        clearIpv6Section();
      } else if (els.ipv6Cb && els.ipv6Cb.checked) {
        if (ipv6ModeValue() === "static" && els.ipv6Ip && els.ipv6Ip.value.trim() === "") {
          if (els.ipv6ModeDhcp) els.ipv6ModeDhcp.checked = true;
          if (els.ipv6ModeStatic) els.ipv6ModeStatic.checked = false;
          if (els.ipv6ModeDel) els.ipv6ModeDel.checked = false;
        }
      }
      syncIpv6Body();
      syncIpv6ModeUi();
      vlanCombinedSync();
      syncDirty();
    }
    if (els.ipv4Cb) els.ipv4Cb.addEventListener("change", onIpv4Toggle);
    if (els.ipv6Cb) els.ipv6Cb.addEventListener("change", onIpv6Toggle);

    if (els.ipv4Ip) {
      els.ipv4Ip.addEventListener("input", syncDirty);
      els.ipv4Ip.addEventListener("blur", tryApplyIpv4CidrOnBlur);
    }
    if (els.ipv4Nm) {
      els.ipv4Nm.addEventListener("blur", tryNormalizeIpv4NetmaskOnBlur);
    }
    if (els.ipv6Ip) {
      els.ipv6Ip.addEventListener("input", syncDirty);
      els.ipv6Ip.addEventListener("blur", tryApplyIpv6CidrOnBlur);
    }

    root.querySelectorAll('input[name="gc-vlan-ipv4-mode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        syncIpv4ModeUi();
        syncDirty();
      });
    });
    root.querySelectorAll('input[name="gc-vlan-ipv6-mode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        syncIpv6ModeUi();
        syncDirty();
      });
    });

    if (els.cancelBtn) els.cancelBtn.addEventListener("click", function () {
      close(root);
    });

    if (els.form) {
      els.form.addEventListener("input", syncDirty);
      els.form.addEventListener("change", syncDirty);
      els.form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (els.saveBtn && els.saveBtn.disabled) return;

        var target =
          typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
        var rowEd = currentNetRow;
        var isCfg =
          target === "configuration" ||
          !!(
            rowEd &&
            (rowEd.configuration_id != null || rowEd.scope === "configuration")
          );

        if (addMode) {
          if (!isCfg) {
            alert(
              "Adding a new VLAN to the task queue is not supported yet. Use Configuration · Network to add a VLAN to a saved configuration, or edit an existing VLAN row to queue an update.",
            );
            return;
          }
          var createUrl =
            typeof window.gcNetVlanApplyCreateUrl === "string" ? window.gcNetVlanApplyCreateUrl : "";
          if (!createUrl) {
            alert("VLAN create URL is not configured.");
            return;
          }
          var cfgIdSel = els.addCfgSelect ? parseInt(els.addCfgSelect.value.trim(), 10) : NaN;
          if (!els.addCfgSelect || !els.addCfgSelect.value.trim() || isNaN(cfgIdSel) || cfgIdSel <= 0) {
            alert("Select a configuration.");
            return;
          }
          var vid = els.vlanIdInp ? els.vlanIdInp.value.trim() : "";
          var n = parseInt(vid, 10);
          if (!vid || String(n) !== vid || n < 1 || n > 4094) {
            alert("VLAN ID must be a number from 1 to 4094.");
            return;
          }
          var payload = JSON.stringify({
            configuration_id: cfgIdSel,
            form: collectVlanForm(),
          });
          if (els.saveBtn) els.saveBtn.disabled = true;
          fetch(createUrl, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: payload,
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (!x.ok) {
                var msg = (x.j && (x.j.detail || x.j.message)) || "Could not add VLAN.";
                alert(typeof msg === "string" ? msg : JSON.stringify(msg));
                if (els.saveBtn) els.saveBtn.disabled = false;
                syncDirty();
                return;
              }
              document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
              close(root);
            })
            .catch(function () {
              alert("Network error.");
              if (els.saveBtn) els.saveBtn.disabled = false;
              syncDirty();
            });
          return;
        }

        var url = isCfg
          ? typeof window.gcNetVlanApplyUpdateUrl === "string"
            ? window.gcNetVlanApplyUpdateUrl
            : ""
          : typeof window.gcNetVlanEnqueueUrl === "string"
            ? window.gcNetVlanEnqueueUrl
            : "";
        if (!url) {
          alert(
            isCfg
              ? "VLAN save URL is not configured or the row is missing a config entry id."
              : "Task queue URL is not configured or the row is missing a config entry id.",
          );
          return;
        }

        var srcsMulti = rowEd && rowEd.if_combine_sources;
        var cmbOptsSubmit = vlanCmbOpts();
        var combinedMulti =
          rowEd &&
          rowEd.interfaces_row_combined &&
          Array.isArray(srcsMulti) &&
          srcsMulti.length > 1 &&
          ((typeof window.gcNetIfCombinedStaticUsesV4 === "function" &&
            window.gcNetIfCombinedStaticUsesV4(els, rowEd, cmbOptsSubmit)) ||
            (typeof window.gcNetIfCombinedStaticUsesV6 === "function" &&
              window.gcNetIfCombinedStaticUsesV6(els, rowEd, cmbOptsSubmit)));

        if (combinedMulti) {
          var selectedScopes = collectFlyoutScopeIds(els.form);
          if (!selectedScopes.length) {
            alert("Select at least one firewall or configuration to update.");
            return;
          }
          var tb4m = els.ipv4CombinedTbody;
          var tb6m = els.ipv6CombinedTbody;
          var r4m = tb4m ? tb4m.querySelectorAll("tr.gc-if-cmb-data-row") : [];
          var r6m = tb6m ? tb6m.querySelectorAll("tr.gc-if-cmb-data-row") : [];
          var idxM = 0;
          if (els.saveBtn) els.saveBtn.disabled = true;
          function postOneVlan() {
            if (idxM >= srcsMulti.length) {
              document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
              if (typeof window.gcNetIfInvalidateIpamPoolsCache === "function") {
                window.gcNetIfInvalidateIpamPoolsCache();
              }
              close(root);
              return;
            }
            var srcM = srcsMulti[idxM];
            var tr4m = r4m[idxM];
            var tr6m = r6m[idxM];
            idxM++;
            if (srcM == null || srcM.config_entry_id == null) {
              postOneVlan();
              return;
            }
            var scopeIdM = scopeIdFromSource(srcM);
            if (scopeIdM != null && selectedScopes.indexOf(scopeIdM) === -1) {
              postOneVlan();
              return;
            }
            var payloadM = JSON.stringify({
              config_entry_id: srcM.config_entry_id,
              form: collectVlanFormWithCombinedRow(tr4m, tr6m),
            });
            fetch(url, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: payloadM,
            })
              .then(function (r) {
                return r.json().then(function (j) {
                  return { ok: r.ok, j: j };
                });
              })
              .then(function (x) {
                if (!x.ok) {
                  var msgM =
                    (x.j && (x.j.detail || x.j.message)) ||
                    (isCfg ? "Could not save configuration." : "Could not save to task queue.");
                  alert(typeof msgM === "string" ? msgM : JSON.stringify(msgM));
                  if (els.saveBtn) els.saveBtn.disabled = false;
                  syncDirty();
                  return;
                }
                postOneVlan();
              })
              .catch(function () {
                alert("Network error.");
                if (els.saveBtn) els.saveBtn.disabled = false;
                syncDirty();
              });
          }
          postOneVlan();
          return;
        }

        var cid = currentNetRow && currentNetRow.config_entry_id;
        if (cid == null) {
          alert(
            isCfg
              ? "VLAN save URL is not configured or the row is missing a config entry id."
              : "Task queue URL is not configured or the row is missing a config entry id.",
          );
          return;
        }
        var payload = JSON.stringify({
          config_entry_id: cid,
          form: collectVlanForm(),
        });
        if (els.saveBtn) els.saveBtn.disabled = true;
        fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: payload,
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, j: j };
            });
          })
          .then(function (x) {
            if (!x.ok) {
              var msg2 =
                (x.j && (x.j.detail || x.j.message)) ||
                (isCfg ? "Could not save configuration." : "Could not save to task queue.");
              alert(typeof msg2 === "string" ? msg2 : JSON.stringify(msg2));
              if (els.saveBtn) els.saveBtn.disabled = false;
              syncDirty();
              return;
            }
            document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
            close(root);
          })
          .catch(function () {
            alert("Network error.");
            if (els.saveBtn) els.saveBtn.disabled = false;
            syncDirty();
          });
      });
    }

    if (els.form) setInitialSnapshot();
  }

  function openFromTr(tr) {
    var row = tr && tr._gcNetRow;
    currentNetRow = row || null;
    var root = document.getElementById("gc-net-vlan-flyout");
    if (!row || !root) return;
    if (row.entity_type && row.entity_type !== "vlan") return;
    if (root.dataset.gcVlanFlyoutBound !== "1") {
      bind(root);
    }
    open(root);
    populateFromRow(row);
  }

  window.gcNetVlanFlyoutInit = function () {
    var root = document.getElementById("gc-net-vlan-flyout");
    if (!root) return;
    bind(root);
  };

  window.gcNetVlanFlyoutOpenFromTr = function (tr) {
    openFromTr(tr);
  };

  window.gcNetVlanFlyoutOpenAdd = function () {
    var root = document.getElementById("gc-net-vlan-flyout");
    if (!root) return;
    if (root.dataset.gcVlanFlyoutBound !== "1") {
      bind(root);
    }
    open(root);
    populateAdd();
  };
})();
