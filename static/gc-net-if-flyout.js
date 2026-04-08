/**
 * Right-aligned flyout for editing a cached interface row (display-only; does not push to firewall).
 */
(function () {
  "use strict";

  var initialFormSnapshot = "";
  var currentNetRow = null;

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

  function collectZonesFromInterfacesTable() {
    var set = {};
    var tbody = document.getElementById("gc-net-if-tbody");
    if (!tbody) return [];
    tbody.querySelectorAll("tr.gc-net-if-data-row td[data-gc-col='__zone']").forEach(function (td) {
      var t = (td.textContent || "").trim();
      if (t && normLower(t) !== "none") set[t] = true;
    });
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }

  function netmaskToDisplay(nm) {
    return window.gcNetIpv4FlyoutBlur.netmaskToDisplay(nm);
  }

  function tryApplyIpv4CidrOnBlur() {
    window.gcNetIpv4FlyoutBlur.applyCidrSplit(els, syncDirty, { maskAsSlash: true });
  }

  function tryNormalizeIpv4NetmaskOnBlur() {
    window.gcNetIpv4FlyoutBlur.applyNetmaskNormalizeToSlash(els, syncDirty);
  }

  /** If IPv6 field contains addr/prefix, split on blur. Uses last "/" as CIDR delimiter. */
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
      ])
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
      ])
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

  /** Map legacy / UI labels to SFOS InterfaceSpeed option values. */
  var LEGACY_INTERFACE_SPEED = {
    Automatic: "Auto Negotiate",
    "Auto Negotiate": "Auto Negotiate",
    "10 Mbps Full Duplex": "10MbpsFD",
    "100 Mbps Full Duplex": "100MbpsFD",
    "1000 Mbps Full Duplex": "1000MbpsFD",
    "10000 Mbps Full Duplex": "10000MbpsFD",
  };

  function normalizeInterfaceSpeedForSelect(raw) {
    var s = String(raw || "").trim();
    if (!s) return "Auto Negotiate";
    if (LEGACY_INTERFACE_SPEED[s]) return LEGACY_INTERFACE_SPEED[s];
    return s;
  }

  /** Map API / legacy FEC strings to select option values (SFOS literals). */
  var LEGACY_FEC_TO_VALUE = {
    On: "Automatic",
    "RS-FEC": "RS-FEC-encoding",
    RSFEC: "RS-FEC-encoding",
  };

  function normalizeFecForSelect(raw) {
    var s = String(raw || "").trim();
    if (!s) return "Off";
    if (LEGACY_FEC_TO_VALUE[s]) return LEGACY_FEC_TO_VALUE[s];
    return s;
  }

  var els = {};

  var IF_COMBINE_COL_LABELS = {
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

  function mountInterfaceFirewallPicker(row) {
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

  function applyInterfaceCombineChrome(root, row) {
    if (typeof window.gcCombineFlyoutClearConflictChrome === "function") {
      try {
        window.gcCombineFlyoutClearConflictChrome(root);
      } catch (e0) {}
    }
    var perMap = null;
    try {
      if (typeof window.gcExtractCombinePerFieldMap === "function") {
        perMap = window.gcExtractCombinePerFieldMap(row);
      }
    } catch (ePm) {
      perMap = null;
    }
    if (
      row &&
      typeof window.gcCombineFlyoutApplyConflictChrome === "function" &&
      perMap
    ) {
      try {
        window.gcCombineFlyoutApplyConflictChrome(root, row, { columnLabels: IF_COMBINE_COL_LABELS });
      } catch (e2) {}
    }
  }

  function setZoneOptions(currentZone) {
    var sel = els.zone;
    if (!sel) return;
    var zones = collectZonesFromInterfacesTable();
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
    var empty =
      !els.zone.value ||
      normLower(els.zone.value) === "none";
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

  var advOpen = false;
  /** Last known WAN state for zone select; used to clear gateways when leaving WAN. */
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

  function syncAdvanced() {
    if (!els.advBody || !els.advBtn) return;
    els.advBody.hidden = !advOpen;
    els.advBtn.setAttribute("aria-expanded", advOpen ? "true" : "false");
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
    if (typeof window.gcNetIfCombinedStaticSync === "function") {
      window.gcNetIfCombinedStaticSync(els, currentNetRow);
    }
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
    if (typeof window.gcNetIfCombinedStaticSync === "function") {
      window.gcNetIfCombinedStaticSync(els, currentNetRow);
    }
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

  /**
   * Set IPv4 enable checkbox from loaded row only (Static + blank address → off + cleared section).
   * Do not call this when the user changes assignment mode or types in the IP field.
   */
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

  function ipv4NetmaskForApi(raw) {
    return window.gcNetIpv4FlyoutBlur.netmaskInputToApi(raw);
  }

  function collectFormWithCombinedRow(tr4, tr6) {
    var base = collectInterfaceForm();
    var wan = isWanNetworkZone();
    if (tr4) {
      var ip = tr4.querySelector(".gc-if-cmb-v4-ip");
      var nm = tr4.querySelector(".gc-if-cmb-v4-nm");
      if (ip) base.ipv4_ip = ip.value.trim();
      if (nm) base.ipv4_netmask = ipv4NetmaskForApi(nm.value);
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

  function collectInterfaceForm() {
    var wan = isWanNetworkZone();
    return {
      name: els.nameInp ? els.nameInp.value.trim() : "",
      network_zone: els.zone ? els.zone.value : "",
      ipv4_enabled: !!(els.ipv4Cb && els.ipv4Cb.checked),
      ipv4_mode: ipv4ModeValue(),
      ipv4_ip: els.ipv4Ip ? els.ipv4Ip.value : "",
      ipv4_netmask: els.ipv4Nm ? ipv4NetmaskForApi(els.ipv4Nm.value) : "",
      ipv4_gateway_name: wan && els.ipv4GwName ? els.ipv4GwName.value : "",
      ipv4_gateway_ip: wan && els.ipv4GwIp ? els.ipv4GwIp.value : "",
      ipv6_enabled: !!(els.ipv6Cb && els.ipv6Cb.checked),
      ipv6_mode: ipv6ModeValue(),
      ipv6_ip: els.ipv6Ip ? els.ipv6Ip.value : "",
      ipv6_prefix: els.ipv6Prefix ? els.ipv6Prefix.value : "",
      ipv6_gateway_name: wan && els.ipv6GwName ? els.ipv6GwName.value : "",
      ipv6_gateway_ip: wan && els.ipv6GwIp ? els.ipv6GwIp.value : "",
      link_mode: els.linkMode ? els.linkMode.value : "",
      auto_negotiation: !!(els.autoNeg && els.autoNeg.checked),
      fec: els.fec ? els.fec.value : "",
      mtu: els.mtu ? els.mtu.value : "",
      mss_override: !!(els.mssCb && els.mssCb.checked),
      mss: els.mssInp ? els.mssInp.value : "",
      mac_mode: els.macOverride && els.macOverride.checked ? "override" : "default",
      mac_default: els.macDefaultVal ? els.macDefaultVal.value : "",
      mac_override: els.macCustomVal ? els.macCustomVal.value : "",
    };
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
  }

  function populateFromRow(row) {
    var flat = (row && row.flat) || {};
    var cells = (row && row.cells) || {};

    var name = pick(flat, ["Name"]) || String(cells.__name != null ? cells.__name : "") || "";
    var hw = pick(flat, ["Hardware"]);
    var zone = pick(flat, ["NetworkZone", "Zone", "ZoneName"]) || String(cells.__zone != null ? cells.__zone : "");

    if (els.nameInp) els.nameInp.value = name;
    if (els.hwOut) els.hwOut.textContent = hw || "—";
    setZoneOptions(zone);

    var v4 = guessIpv4Mode(flat);
    if (els.ipv4ModeStatic) els.ipv4ModeStatic.checked = v4 === "static";
    if (els.ipv4ModePppoe) els.ipv4ModePppoe.checked = v4 === "pppoe";
    if (els.ipv4ModeDhcp) els.ipv4ModeDhcp.checked = v4 === "dhcp";

    if (els.ipv4Ip) els.ipv4Ip.value = pick(flat, ["IPAddress", "IPv4Address"]);
    if (els.ipv4Nm) {
      var nmPick = pick(flat, ["Netmask", "IPv4Netmask"]);
      if (
        window.gcNetIpv4FlyoutBlur &&
        typeof window.gcNetIpv4FlyoutBlur.netmaskToSlashDisplay === "function"
      ) {
        els.ipv4Nm.value = window.gcNetIpv4FlyoutBlur.netmaskToSlashDisplay(nmPick);
      } else {
        els.ipv4Nm.value = String(nmPick || "").trim();
      }
    }

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

    if (els.linkMode) {
      var lmRaw = pick(flat, ["InterfaceSpeed", "LinkMode", "LinkSpeed"]) || "Auto Negotiate";
      var lm = normalizeInterfaceSpeedForSelect(lmRaw);
      els.linkMode.value = lm;
      if (els.linkMode.value !== lm) {
        var o = document.createElement("option");
        o.value = lm;
        o.textContent = lmRaw !== lm ? lmRaw + " (" + lm + ")" : lm;
        els.linkMode.appendChild(o);
        els.linkMode.value = lm;
      }
    }
    var autoNeg = truthyFlat(flat, ["AutoNegotiation", "AutoNegotiate", "MediaAutoNegotiation"]);
    if (autoNeg === null) autoNeg = true;
    if (els.autoNeg) els.autoNeg.checked = autoNeg !== false;
    if (els.fec) {
      var fecV = normalizeFecForSelect(pick(flat, ["FEC", "ForwardErrorCorrection"]) || "Off");
      els.fec.value = fecV;
      if (els.fec.value !== fecV) {
        var fo = document.createElement("option");
        fo.value = fecV;
        fo.textContent = fecV;
        els.fec.appendChild(fo);
        els.fec.value = fecV;
      }
    }

    if (els.mtu) els.mtu.value = pick(flat, ["MTU"]) || "1500";
    var mssO = truthyFlat(flat, ["MSS.OverrideMSS", "OverrideMSS", "MSSOverride"]);
    if (els.mssCb) els.mssCb.checked = mssO === true;
    if (els.mssInp) els.mssInp.value = pick(flat, ["MSS.MSSValue", "MSSValue", "MSS"]) || "1460";

    var mac = pick(flat, ["MACAddress", "MacAddress", "PhysicalAddress"]);
    var isDefaultMac = !mac || normLower(mac) === "default";
    if (els.macDefault) els.macDefault.checked = isDefaultMac;
    if (els.macOverride) els.macOverride.checked = !isDefaultMac;
    if (els.macDefaultVal)
      els.macDefaultVal.value = isDefaultMac ? pick(flat, ["FactoryMAC", "HardwareMAC"]) || "" : "";
    if (els.macCustomVal) els.macCustomVal.value = !isDefaultMac ? mac : "";

    advOpen = false;
    syncAdvanced();

    syncZoneBelow();
    syncGatewayBlocksForZone();
    lastZoneWasWan = isWanNetworkZone();
    mountInterfaceFirewallPicker(row);
    if (typeof window.gcNetIfCombinedStaticSync === "function") {
      window.gcNetIfCombinedStaticSync(els, row, { forceRebuild: true });
    }
    applyInterfaceCombineChrome(els.root, row);
    setInitialSnapshot();
  }

  function cacheEls(root) {
    els = {
      root: root,
      fwSlot: root.querySelector("#gc-if-edit-fw-slot"),
      postZone: root.querySelector("#gc-if-edit-post-zone"),
      zone: root.querySelector("#gc-if-edit-zone"),
      nameInp: root.querySelector("#gc-if-edit-name"),
      hwOut: root.querySelector("#gc-if-edit-hardware"),
      ipv4Cb: root.querySelector("#gc-if-edit-ipv4-enabled"),
      ipv4Body: root.querySelector("#gc-if-edit-ipv4-body"),
      ipv6Cb: root.querySelector("#gc-if-edit-ipv6-enabled"),
      ipv6Body: root.querySelector("#gc-if-edit-ipv6-body"),
      ipv4ModeStatic: root.querySelector('input[name="gc-if-ipv4-mode"][value="static"]'),
      ipv4ModePppoe: root.querySelector('input[name="gc-if-ipv4-mode"][value="pppoe"]'),
      ipv4ModeDhcp: root.querySelector('input[name="gc-if-ipv4-mode"][value="dhcp"]'),
      ipv4Ip: root.querySelector("#gc-if-edit-ipv4-ip"),
      ipv4Nm: root.querySelector("#gc-if-edit-ipv4-netmask"),
      ipv4GwName: root.querySelector("#gc-if-edit-ipv4-gw-name"),
      ipv4GwIp: root.querySelector("#gc-if-edit-ipv4-gw-ip"),
      ipv4GatewayWrap: root.querySelector("#gc-if-edit-ipv4-gateway-wrap"),
      ipv4SingleStatic: root.querySelector("#gc-if-edit-ipv4-single-static"),
      ipv4CombinedWrap: root.querySelector("#gc-if-edit-ipv4-combined-wrap"),
      ipv4CombinedTbody: root.querySelector("#gc-if-edit-ipv4-combined-tbody"),
      ipv6ModeStatic: root.querySelector('input[name="gc-if-ipv6-mode"][value="static"]'),
      ipv6ModeDhcp: root.querySelector('input[name="gc-if-ipv6-mode"][value="dhcp"]'),
      ipv6ModeDel: root.querySelector('input[name="gc-if-ipv6-mode"][value="delegated"]'),
      ipv6Ip: root.querySelector("#gc-if-edit-ipv6-ip"),
      ipv6Prefix: root.querySelector("#gc-if-edit-ipv6-prefix"),
      ipv6GwName: root.querySelector("#gc-if-edit-ipv6-gw-name"),
      ipv6GwIp: root.querySelector("#gc-if-edit-ipv6-gw-ip"),
      ipv6GatewayWrap: root.querySelector("#gc-if-edit-ipv6-gateway-wrap"),
      ipv6SingleStatic: root.querySelector("#gc-if-edit-ipv6-single-static"),
      ipv6CombinedWrap: root.querySelector("#gc-if-edit-ipv6-combined-wrap"),
      ipv6CombinedTbody: root.querySelector("#gc-if-edit-ipv6-combined-tbody"),
      advBtn: root.querySelector("#gc-if-edit-adv-toggle"),
      advBody: root.querySelector("#gc-if-edit-adv-body"),
      linkMode: root.querySelector("#gc-if-edit-link-mode"),
      autoNeg: root.querySelector("#gc-if-edit-auto-neg"),
      fec: root.querySelector("#gc-if-edit-fec"),
      mtu: root.querySelector("#gc-if-edit-mtu"),
      mssCb: root.querySelector("#gc-if-edit-mss-cb"),
      mssInp: root.querySelector("#gc-if-edit-mss"),
      macDefault: root.querySelector('input[name="gc-if-mac-mode"][value="default"]'),
      macOverride: root.querySelector('input[name="gc-if-mac-mode"][value="override"]'),
      macDefaultVal: root.querySelector("#gc-if-edit-mac-default"),
      macCustomVal: root.querySelector("#gc-if-edit-mac-override"),
      cancelBtn: root.querySelector("#gc-if-edit-cancel"),
      saveBtn: root.querySelector("#gc-if-edit-save"),
      form: root.querySelector("#gc-if-edit-form"),
    };
  }

  function bindPanelResize(root) {
    var panel = root.querySelector(".gc-if-flyout__panel");
    var handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset.gcIfResizeBound === "1") return;
    handle.dataset.gcIfResizeBound = "1";
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
    if (root.dataset.gcIfFlyoutBound === "1") return;
    root.dataset.gcIfFlyoutBound = "1";
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
      if (typeof window.gcNetIfCombinedStaticSync === "function") {
        window.gcNetIfCombinedStaticSync(els, currentNetRow);
      }
      syncDirty();
    }
    if (els.zone) els.zone.addEventListener("change", onZoneChange);

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
      if (typeof window.gcNetIfCombinedStaticSync === "function") {
        window.gcNetIfCombinedStaticSync(els, currentNetRow);
      }
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
      if (typeof window.gcNetIfCombinedStaticSync === "function") {
        window.gcNetIfCombinedStaticSync(els, currentNetRow);
      }
      syncDirty();
    }
    if (els.ipv4Cb) els.ipv4Cb.addEventListener("change", onIpv4Toggle);
    if (els.ipv6Cb) els.ipv6Cb.addEventListener("change", onIpv6Toggle);

    function onIpv4IpInput() {
      syncDirty();
    }
    function onIpv6IpInput() {
      syncDirty();
    }
    if (els.ipv4Ip) {
      els.ipv4Ip.addEventListener("input", onIpv4IpInput);
      els.ipv4Ip.addEventListener("blur", tryApplyIpv4CidrOnBlur);
    }
    if (els.ipv4Nm) {
      els.ipv4Nm.addEventListener("blur", tryNormalizeIpv4NetmaskOnBlur);
    }
    if (els.ipv6Ip) {
      els.ipv6Ip.addEventListener("input", onIpv6IpInput);
      els.ipv6Ip.addEventListener("blur", tryApplyIpv6CidrOnBlur);
    }

    root.querySelectorAll('input[name="gc-if-ipv4-mode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        syncIpv4ModeUi();
        syncDirty();
      });
    });
    root.querySelectorAll('input[name="gc-if-ipv6-mode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        syncIpv6ModeUi();
        syncDirty();
      });
    });

    if (els.advBtn) {
      els.advBtn.addEventListener("click", function () {
        advOpen = !advOpen;
        syncAdvanced();
      });
    }

    function onMacMode() {
      var def = els.macDefault && els.macDefault.checked;
      if (els.macDefaultVal) {
        els.macDefaultVal.readOnly = true;
        els.macDefaultVal.classList.add("gc-if-flyout__input--readonly");
      }
      if (els.macCustomVal) {
        els.macCustomVal.readOnly = def;
        els.macCustomVal.classList.toggle("gc-if-flyout__input--readonly", def);
      }
    }
    root.querySelectorAll('input[name="gc-if-mac-mode"]').forEach(function (r) {
      r.addEventListener("change", onMacMode);
    });
    onMacMode();

    function doCancel() {
      close(root);
    }
    if (els.cancelBtn) els.cancelBtn.addEventListener("click", doCancel);

    if (els.form) {
      els.form.addEventListener("input", syncDirty);
      els.form.addEventListener("change", syncDirty);
      els.form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (els.saveBtn && els.saveBtn.disabled) return;
        var row0 = currentNetRow;
        var isCfg =
          (typeof window.gcNetIfEntityTarget === "string" &&
            window.gcNetIfEntityTarget === "configuration") ||
          !!(
            row0 &&
            (row0.configuration_id != null || row0.scope === "configuration")
          );
        var url = isCfg
          ? typeof window.gcConfigurationApplyInterfaceUrl === "string"
            ? window.gcConfigurationApplyInterfaceUrl
            : ""
          : typeof window.gcTaskQueueEnqueueUrl === "string"
            ? window.gcTaskQueueEnqueueUrl
            : "";
        var srcs = row0 && row0.if_combine_sources;
        var combinedMulti =
          row0 &&
          row0.interfaces_row_combined &&
          Array.isArray(srcs) &&
          srcs.length > 1 &&
          ((typeof window.gcNetIfCombinedStaticUsesV4 === "function" &&
            window.gcNetIfCombinedStaticUsesV4(els, row0)) ||
            (typeof window.gcNetIfCombinedStaticUsesV6 === "function" &&
              window.gcNetIfCombinedStaticUsesV6(els, row0)));
        if (!url) {
          alert(
            isCfg
              ? "Configuration save URL is not configured or the row is missing a config entry id."
              : "Task queue is not configured or row is missing config entry id.",
          );
          return;
        }
        function finishOk() {
          document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
          if (typeof window.gcNetIfInvalidateIpamPoolsCache === "function") {
            window.gcNetIfInvalidateIpamPoolsCache();
          }
          close(root);
        }
        function failSave(msg) {
          alert(typeof msg === "string" ? msg : JSON.stringify(msg));
          if (els.saveBtn) els.saveBtn.disabled = false;
          syncDirty();
        }
        if (combinedMulti) {
          var selectedScopes = collectFlyoutScopeIds(els.form);
          if (!selectedScopes.length) {
            alert("Select at least one firewall or configuration to update.");
            return;
          }
          var tb4 = els.ipv4CombinedTbody;
          var tb6 = els.ipv6CombinedTbody;
          var r4 = tb4 ? tb4.querySelectorAll("tr.gc-if-cmb-data-row") : [];
          var r6 = tb6 ? tb6.querySelectorAll("tr.gc-if-cmb-data-row") : [];
          var idx = 0;
          if (els.saveBtn) els.saveBtn.disabled = true;
          function postOne() {
            if (idx >= srcs.length) {
              finishOk();
              return;
            }
            var src = srcs[idx];
            var tr4 = r4[idx];
            var tr6 = r6[idx];
            idx++;
            if (src == null || src.config_entry_id == null) {
              postOne();
              return;
            }
            var scopeId = scopeIdFromSource(src);
            if (scopeId != null && selectedScopes.indexOf(scopeId) === -1) {
              postOne();
              return;
            }
            var fdat = collectFormWithCombinedRow(tr4, tr6);
            var payload = JSON.stringify({
              config_entry_id: src.config_entry_id,
              form: fdat,
            });
            var poolSel = tr4 && tr4.querySelector(".gc-if-cmb-pool");
            var pid = poolSel && poolSel.value.trim();
            var fid =
              src && src.firewall_id != null && String(src.firewall_id).trim() !== ""
                ? parseInt(String(src.firewall_id), 10)
                : 0;
            var commitU =
              typeof window.gcIpamInterfacePoolCommitUrl === "string"
                ? window.gcIpamInterfacePoolCommitUrl
                : "";
            var doCommit =
              !isCfg &&
              pid &&
              !isNaN(fid) &&
              fid > 0 &&
              commitU &&
              fdat.ipv4_enabled &&
              fdat.ipv4_mode === "static" &&
              (fdat.ipv4_ip || "").trim() !== "";

            function enqueueTask() {
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
                    var msg =
                      (x.j && (x.j.detail || x.j.message)) ||
                      (isCfg ? "Could not save configuration." : "Could not save to task queue.");
                    failSave(msg);
                    return;
                  }
                  postOne();
                })
                .catch(function () {
                  failSave("Network error.");
                });
            }

            if (!doCommit) {
              enqueueTask();
              return;
            }
            fetch(commitU, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({
                firewall_id: fid,
                parent_pool_id: parseInt(pid, 10),
                ipv4_ip: fdat.ipv4_ip,
                ipv4_netmask: fdat.ipv4_netmask,
              }),
            })
              .then(function (r2) {
                return r2.json().then(function (j2) {
                  return { ok: r2.ok, j: j2 };
                });
              })
              .then(function (y) {
                if (!y.ok) {
                  var m =
                    (y.j && (y.j.detail || y.j.message)) ||
                    "Could not record IPAM assignment for this pool.";
                  failSave(typeof m === "string" ? m : JSON.stringify(m));
                  return;
                }
                enqueueTask();
              })
              .catch(function () {
                failSave("Network error recording IPAM assignment.");
              });
          }
          postOne();
          return;
        }
        var cid = row0 && row0.config_entry_id;
        if (cid == null) {
          alert(
            isCfg
              ? "Configuration save URL is not configured or the row is missing a config entry id."
              : "Task queue is not configured or row is missing config entry id.",
          );
          return;
        }
        var payload = JSON.stringify({
          config_entry_id: cid,
          form: collectInterfaceForm(),
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
              var msg =
                (x.j && (x.j.detail || x.j.message)) ||
                (isCfg ? "Could not save configuration." : "Could not save to task queue.");
              failSave(msg);
              return;
            }
            finishOk();
          })
          .catch(function () {
            failSave("Network error.");
          });
      });
    }

    advOpen = false;
    syncAdvanced();
    if (els.form) setInitialSnapshot();

    window.gcNetIfIpv4ModeValue = ipv4ModeValue;
    window.gcNetIfIpv6ModeValue = ipv6ModeValue;
    window.gcNetIfPick = pick;
    window.gcNetIfNetmaskToDisplay = function (nm) {
      return window.gcNetIpv4FlyoutBlur.netmaskToSlashDisplay(nm);
    };
    window.gcNetIfSyncDirty = syncDirty;
    window.gcNetIfIsWanNetworkZone = isWanNetworkZone;
  }

  function openFromTr(tr) {
    var row = tr && tr._gcNetRow;
    currentNetRow = row || null;
    var root = document.getElementById("gc-net-if-edit-flyout");
    if (!row || !root) return;
    var etN = normLower(row.entity_type);
    if (etN && etN !== "interface") return;
    if (root.dataset.gcIfFlyoutBound !== "1") {
      bind(root);
    }
    open(root);
    try {
      populateFromRow(row);
    } catch (ePop) {
      try {
        console.error("gcNetIfEditFlyout populateFromRow", ePop);
      } catch (eLog) {}
    }
  }

  window.gcNetIfEditFlyoutInit = function () {
    var root = document.getElementById("gc-net-if-edit-flyout");
    if (!root) return;
    bind(root);
  };

  window.gcNetIfEditFlyoutOpenFromTr = function (tr) {
    openFromTr(tr);
  };
})();
