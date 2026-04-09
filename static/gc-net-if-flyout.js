/**
 * Right-aligned flyout for editing a cached interface row (display-only; does not push to firewall).
 */
(function () {
  "use strict";

  let initialFormSnapshot = "";
  let currentNetRow = null;

  function pick(flat, keys) {
    if (!flat) return "";
    for (let i = 0; i < keys.length; i++) {
      let v = flat[keys[i]];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  function normLower(s) {
    return String(s || "").trim().toLowerCase();
  }

  function collectZonesFromInterfacesTable() {
    let set = {};
    let tbody = document.getElementById("gc-net-if-tbody");
    if (!tbody) return [];
    tbody.querySelectorAll("tr.gc-net-if-data-row td[data-gc-col='__zone']").forEach(function (td) {
      let t = (td.textContent || "").trim();
      if (t && normLower(t) !== "none") set[t] = true;
    });
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }

  function netmaskToDisplay(nm) {
    return globalThis.gcNetIpv4FlyoutBlur.netmaskToDisplay(nm);
  }

  function tryApplyIpv4CidrOnBlur() {
    globalThis.gcNetIpv4FlyoutBlur.applyCidrSplit(els, syncDirty, { maskAsSlash: true });
  }

  function tryNormalizeIpv4NetmaskOnBlur() {
    globalThis.gcNetIpv4FlyoutBlur.applyNetmaskNormalizeToSlash(els, syncDirty);
  }

  /** If IPv6 field contains addr/prefix, split on blur. Uses last "/" as CIDR delimiter. */
  function tryApplyIpv6CidrOnBlur() {
    if (!els.ipv6Ip || !els.ipv6Prefix) return;
    if (els.ipv6Ip.readOnly) return;
    let raw = els.ipv6Ip.value.trim();
    let slash = raw.lastIndexOf("/");
    if (slash < 0) return;
    let addr = raw.slice(0, slash).trim();
    let pstr = raw.slice(slash + 1).trim();
    let prefix = parseInt(pstr, 10);
    if (pstr !== String(prefix) || prefix < 0 || prefix > 128) return;
    if (!addr || addr.indexOf(":") < 0) return;
    els.ipv6Ip.value = addr;
    els.ipv6Prefix.value = String(prefix);
    syncDirty();
  }

  function guessIpv4Mode(flat) {
    let v = normLower(
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
    let ip = pick(flat, ["IPAddress", "IPv4Address"]);
    if (ip) return "static";
    return "dhcp";
  }

  function guessIpv6Mode(flat) {
    let v = normLower(
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
    let ip = pick(flat, ["IPv6Address", "IPv6_Address"]);
    if (ip) return "static";
    return "static";
  }

  function truthyFlat(flat, keys) {
    let s = normLower(pick(flat, keys));
    if (s === "false" || s === "0" || s === "no" || s === "off" || s === "disabled") return false;
    if (s === "true" || s === "1" || s === "yes" || s === "on" || s === "enable" || s === "enabled") return true;
    return null;
  }

  /** Map legacy / UI labels to SFOS InterfaceSpeed option values. */
  let LEGACY_INTERFACE_SPEED = {
    Automatic: "Auto Negotiate",
    "Auto Negotiate": "Auto Negotiate",
    "10 Mbps Full Duplex": "10MbpsFD",
    "100 Mbps Full Duplex": "100MbpsFD",
    "1000 Mbps Full Duplex": "1000MbpsFD",
    "10000 Mbps Full Duplex": "10000MbpsFD",
  };

  function normalizeInterfaceSpeedForSelect(raw) {
    let s = String(raw || "").trim();
    if (!s) return "Auto Negotiate";
    if (LEGACY_INTERFACE_SPEED[s]) return LEGACY_INTERFACE_SPEED[s];
    return s;
  }

  /** Map API / legacy FEC strings to select option values (SFOS literals). */
  let LEGACY_FEC_TO_VALUE = {
    On: "Automatic",
    "RS-FEC": "RS-FEC-encoding",
    RSFEC: "RS-FEC-encoding",
  };

  function normalizeFecForSelect(raw) {
    let s = String(raw || "").trim();
    if (!s) return "Off";
    if (LEGACY_FEC_TO_VALUE[s]) return LEGACY_FEC_TO_VALUE[s];
    return s;
  }

  let els = {};

  let IF_COMBINE_COL_LABELS = {
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
    let isCfg =
      typeof globalThis.gcHsEntityTarget === "string" && globalThis.gcHsEntityTarget === "configuration";
    let ms = form.querySelector(isCfg ? "[data-gc-cfg-ms]" : "[data-gc-fw-ms]");
    if (!ms) return [];
    let idAttr = isCfg ? "data-gc-cfg-id" : "data-gc-fw-id";
    let out = [];
    ms.querySelectorAll("input[type=\"checkbox\"]").forEach(function (cb) {
      if (!cb.checked || !cb.hasAttribute(idAttr)) return;
      let n = parseInt(String(cb.getAttribute(idAttr) || ""), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function scopeIdFromSource(src) {
    if (!src) return null;
    if (src.configuration_id != null && String(src.configuration_id).trim() !== "") {
      let c = parseInt(String(src.configuration_id), 10);
      if (!isNaN(c) && c > 0) return c;
    }
    if (src.firewall_id != null && String(src.firewall_id).trim() !== "") {
      let f = parseInt(String(src.firewall_id), 10);
      if (!isNaN(f) && f > 0) return f;
    }
    return null;
  }

  function mountInterfaceFirewallPicker(row) {
    if (!els.fwSlot || typeof globalThis.gcHsBuildFirewallPickerSectionHtml !== "function") return;
    let initial = [];
    let assigned = [];
    if (row && row.configuration_ids && row.configuration_ids.length) {
      initial = row.configuration_ids.slice();
      assigned = row.configuration_ids.slice();
    } else if (row && row.firewall_ids && row.firewall_ids.length) {
      initial = row.firewall_ids.slice();
      assigned = row.firewall_ids.slice();
    } else if (row) {
      let cid = row.configuration_id;
      let fid = row.firewall_id;
      let cn = cid != null ? parseInt(String(cid), 10) : NaN;
      let fn = fid != null ? parseInt(String(fid), 10) : NaN;
      if (!isNaN(cn) && cn > 0) initial = assigned = [cn];
      else if (!isNaN(fn) && fn > 0) initial = assigned = [fn];
    }
    let mode = initial.length ? "edit" : "add";
    els.fwSlot.innerHTML = globalThis.gcHsBuildFirewallPickerSectionHtml(mode, initial, assigned);
    if (typeof globalThis.gcHsHydrateFlyoutFirewallPicker === "function") {
      try {
        globalThis.gcHsHydrateFlyoutFirewallPicker(els.form, { row: row || {} });
      } catch (e1) {}
    }
    let ms = els.form && els.form.querySelector("[data-gc-fw-ms], [data-gc-cfg-ms]");
    if (ms) {
      ms.querySelectorAll("input[type=\"checkbox\"]").forEach(function (cb) {
        cb.addEventListener("change", syncDirty);
      });
    }
  }

  function applyInterfaceCombineChrome(root, row) {
    if (typeof globalThis.gcCombineFlyoutClearConflictChrome === "function") {
      try {
        globalThis.gcCombineFlyoutClearConflictChrome(root);
      } catch (e0) {}
    }
    let perMap = null;
    try {
      if (typeof globalThis.gcExtractCombinePerFieldMap === "function") {
        perMap = globalThis.gcExtractCombinePerFieldMap(row);
      }
    } catch (ePm) {
      perMap = null;
    }
    if (
      row &&
      typeof globalThis.gcCombineFlyoutApplyConflictChrome === "function" &&
      perMap
    ) {
      try {
        globalThis.gcCombineFlyoutApplyConflictChrome(root, row, { columnLabels: IF_COMBINE_COL_LABELS });
      } catch (e2) {}
    }
  }

  function setZoneOptions(currentZone) {
    let sel = els.zone;
    if (!sel) return;
    let zones = collectZonesFromInterfacesTable();
    let cur = (currentZone || "").trim();
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
    let useVal = cur && normLower(cur) !== "none" ? cur : "None";
    sel.value = zones.indexOf(useVal) !== -1 || useVal === "None" ? useVal : "";
    if (useVal && useVal !== "None" && !sel.value && cur) {
      let opt = document.createElement("option");
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
    let post = els.postZone;
    if (!post || !els.zone) return;
    let empty =
      !els.zone.value ||
      normLower(els.zone.value) === "none";
    post.hidden = empty;
    post.setAttribute("aria-hidden", empty ? "true" : "false");
  }

  function syncIpv4Body() {
    if (!els.ipv4Cb || !els.ipv4Body) return;
    let on = els.ipv4Cb.checked;
    els.ipv4Body.hidden = !on;
    els.ipv4Body.setAttribute("aria-hidden", on ? "false" : "true");
  }

  function syncIpv6Body() {
    if (!els.ipv6Cb || !els.ipv6Body) return;
    let on = els.ipv6Cb.checked;
    els.ipv6Body.hidden = !on;
    els.ipv6Body.setAttribute("aria-hidden", on ? "false" : "true");
  }

  let advOpen = false;
  /** Last known WAN state for zone select; used to clear gateways when leaving WAN. */
  let lastZoneWasWan = false;

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
    let show = isWanNetworkZone();
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
    let mode = "";
    if (els.ipv4ModeStatic && els.ipv4ModeStatic.checked) mode = "static";
    else if (els.ipv4ModePppoe && els.ipv4ModePppoe.checked) mode = "pppoe";
    else if (els.ipv4ModeDhcp && els.ipv4ModeDhcp.checked) mode = "dhcp";
    let ro = mode === "dhcp" || mode === "pppoe";
    [els.ipv4Ip, els.ipv4Nm, els.ipv4GwIp].forEach(function (inp) {
      if (!inp) return;
      inp.readOnly = ro;
      inp.classList.toggle("gc-if-flyout__input--readonly", ro);
    });
    if (typeof globalThis.gcNetIfCombinedStaticSync === "function") {
      globalThis.gcNetIfCombinedStaticSync(els, currentNetRow);
    }
  }

  function syncIpv6ModeUi() {
    if (!els.ipv6ModeDhcp) return;
    let mode = "";
    if (els.ipv6ModeStatic && els.ipv6ModeStatic.checked) mode = "static";
    else if (els.ipv6ModeDhcp && els.ipv6ModeDhcp.checked) mode = "dhcp";
    else if (els.ipv6ModeDel && els.ipv6ModeDel.checked) mode = "delegated";
    let ro = mode === "dhcp";
    [els.ipv6Ip, els.ipv6Prefix, els.ipv6GwName, els.ipv6GwIp].forEach(function (inp) {
      if (!inp) return;
      inp.readOnly = ro;
      inp.classList.toggle("gc-if-flyout__input--readonly", ro);
    });
    if (typeof globalThis.gcNetIfCombinedStaticSync === "function") {
      globalThis.gcNetIfCombinedStaticSync(els, currentNetRow);
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
    let staticMode = ipv4ModeValue() === "static";
    let blank = els.ipv4Ip.value.trim() === "";
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
    let staticMode = ipv6ModeValue() === "static";
    let blank = els.ipv6Ip.value.trim() === "";
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
    let form = els.form;
    if (!form) return "";
    let nodes = form.querySelectorAll("input, select, textarea");
    let parts = [];
    for (let i = 0; i < nodes.length; i++) {
      let n = nodes[i];
      let t = n.type;
      if (t === "submit" || t === "button" || n.disabled) continue;
      let key = n.name || n.id;
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
    return globalThis.gcNetIpv4FlyoutBlur.netmaskInputToApi(raw);
  }

  function collectFormWithCombinedRow(tr4, tr6) {
    let base = collectInterfaceForm();
    let wan = isWanNetworkZone();
    if (tr4) {
      let ip = tr4.querySelector(".gc-if-cmb-v4-ip");
      let nm = tr4.querySelector(".gc-if-cmb-v4-nm");
      if (ip) base.ipv4_ip = ip.value.trim();
      if (nm) base.ipv4_netmask = ipv4NetmaskForApi(nm.value);
      if (wan) {
        let gwn = tr4.querySelector(".gc-if-cmb-v4-gw-name");
        let gwi = tr4.querySelector(".gc-if-cmb-v4-gw-ip");
        base.ipv4_gateway_name = gwn ? gwn.value.trim() : "";
        base.ipv4_gateway_ip = gwi ? gwi.value.trim() : "";
      } else {
        base.ipv4_gateway_name = "";
        base.ipv4_gateway_ip = "";
      }
    }
    if (tr6) {
      let ip6 = tr6.querySelector(".gc-if-cmb-v6-ip");
      let px = tr6.querySelector(".gc-if-cmb-v6-px");
      if (ip6) base.ipv6_ip = ip6.value.trim();
      if (px) base.ipv6_prefix = px.value.trim();
      if (wan) {
        let g6n = tr6.querySelector(".gc-if-cmb-v6-gw-name");
        let g6i = tr6.querySelector(".gc-if-cmb-v6-gw-ip");
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
    let wan = isWanNetworkZone();
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
    let panel = root.querySelector(".gc-if-flyout__panel");
    if (panel) {
      try {
        panel.focus();
      } catch (e) {}
    }
  }

  function close(root) {
    if (typeof globalThis.gcCombineFlyoutClearConflictChrome === "function") {
      try {
        globalThis.gcCombineFlyoutClearConflictChrome(root);
      } catch (eC) {}
    }
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gc-if-flyout--open");
  }

  function populateFromRow(row) {
    let flat = (row && row.flat) || {};
    let cells = (row && row.cells) || {};

    let name = pick(flat, ["Name"]) || String(cells.__name != null ? cells.__name : "") || "";
    let hw = pick(flat, ["Hardware"]);
    let zone = pick(flat, ["NetworkZone", "Zone", "ZoneName"]) || String(cells.__zone != null ? cells.__zone : "");

    if (els.nameInp) els.nameInp.value = name;
    if (els.hwOut) els.hwOut.textContent = hw || "—";
    setZoneOptions(zone);

    let v4 = guessIpv4Mode(flat);
    if (els.ipv4ModeStatic) els.ipv4ModeStatic.checked = v4 === "static";
    if (els.ipv4ModePppoe) els.ipv4ModePppoe.checked = v4 === "pppoe";
    if (els.ipv4ModeDhcp) els.ipv4ModeDhcp.checked = v4 === "dhcp";

    if (els.ipv4Ip) els.ipv4Ip.value = pick(flat, ["IPAddress", "IPv4Address"]);
    if (els.ipv4Nm) {
      let nmPick = pick(flat, ["Netmask", "IPv4Netmask"]);
      if (
        globalThis.gcNetIpv4FlyoutBlur &&
        typeof globalThis.gcNetIpv4FlyoutBlur.netmaskToSlashDisplay === "function"
      ) {
        els.ipv4Nm.value = globalThis.gcNetIpv4FlyoutBlur.netmaskToSlashDisplay(nmPick);
      } else {
        els.ipv4Nm.value = String(nmPick || "").trim();
      }
    }

    if (els.ipv4GwName) els.ipv4GwName.value = pick(flat, ["GatewayName", "IPv4GatewayName", "DefaultGatewayName"]);
    if (els.ipv4GwIp) els.ipv4GwIp.value = pick(flat, ["GatewayIP", "Gateway", "DefaultGateway", "IPv4Gateway"]);

    applyIpv4CheckboxOnLoad();

    let v6 = guessIpv6Mode(flat);
    if (els.ipv6ModeStatic) els.ipv6ModeStatic.checked = v6 === "static";
    if (els.ipv6ModeDhcp) els.ipv6ModeDhcp.checked = v6 === "dhcp";
    if (els.ipv6ModeDel) els.ipv6ModeDel.checked = v6 === "delegated";

    if (els.ipv6Ip) els.ipv6Ip.value = pick(flat, ["IPv6Address", "IPv6_Address"]);
    if (els.ipv6Prefix) els.ipv6Prefix.value = pick(flat, ["Prefix", "IPv6PrefixLength", "IPv6Prefix", "PrefixLength"]) || "64";

    if (els.ipv6GwName) els.ipv6GwName.value = pick(flat, ["GatewayNameIpv6", "IPv6GatewayName", "IPv6_GatewayName"]);
    if (els.ipv6GwIp) els.ipv6GwIp.value = pick(flat, ["GatewayIPv6", "IPv6Gateway", "IPv6_Gateway", "IPv6DefaultGateway"]);

    applyIpv6CheckboxOnLoad();

    if (els.linkMode) {
      let lmRaw = pick(flat, ["InterfaceSpeed", "LinkMode", "LinkSpeed"]) || "Auto Negotiate";
      let lm = normalizeInterfaceSpeedForSelect(lmRaw);
      els.linkMode.value = lm;
      if (els.linkMode.value !== lm) {
        let o = document.createElement("option");
        o.value = lm;
        o.textContent = lmRaw !== lm ? lmRaw + " (" + lm + ")" : lm;
        els.linkMode.appendChild(o);
        els.linkMode.value = lm;
      }
    }
    let autoNeg = truthyFlat(flat, ["AutoNegotiation", "AutoNegotiate", "MediaAutoNegotiation"]);
    if (autoNeg === null) autoNeg = true;
    if (els.autoNeg) els.autoNeg.checked = autoNeg !== false;
    if (els.fec) {
      let fecV = normalizeFecForSelect(pick(flat, ["FEC", "ForwardErrorCorrection"]) || "Off");
      els.fec.value = fecV;
      if (els.fec.value !== fecV) {
        let fo = document.createElement("option");
        fo.value = fecV;
        fo.textContent = fecV;
        els.fec.appendChild(fo);
        els.fec.value = fecV;
      }
    }

    if (els.mtu) els.mtu.value = pick(flat, ["MTU"]) || "1500";
    let mssO = truthyFlat(flat, ["MSS.OverrideMSS", "OverrideMSS", "MSSOverride"]);
    if (els.mssCb) els.mssCb.checked = mssO === true;
    if (els.mssInp) els.mssInp.value = pick(flat, ["MSS.MSSValue", "MSSValue", "MSS"]) || "1460";

    let mac = pick(flat, ["MACAddress", "MacAddress", "PhysicalAddress"]);
    let isDefaultMac = !mac || normLower(mac) === "default";
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
    if (typeof globalThis.gcNetIfCombinedStaticSync === "function") {
      globalThis.gcNetIfCombinedStaticSync(els, row, { forceRebuild: true });
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
    let panel = root.querySelector(".gc-if-flyout__panel");
    let handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset.gcIfResizeBound === "1") return;
    handle.dataset.gcIfResizeBound = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      let startX = e.clientX;
      let startW = panel.getBoundingClientRect().width;
      let maxW = Math.min(720, globalThis.innerWidth - 24);
      function onMove(e2) {
        let w = startW + (startX - e2.clientX);
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
      let wan = isWanNetworkZone();
      syncZoneBelow();
      syncGatewayBlocksForZone();
      if (lastZoneWasWan && !wan) {
        clearGatewayFields();
      }
      lastZoneWasWan = wan;
      if (typeof globalThis.gcNetIfCombinedStaticSync === "function") {
        globalThis.gcNetIfCombinedStaticSync(els, currentNetRow);
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
      if (typeof globalThis.gcNetIfCombinedStaticSync === "function") {
        globalThis.gcNetIfCombinedStaticSync(els, currentNetRow);
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
      if (typeof globalThis.gcNetIfCombinedStaticSync === "function") {
        globalThis.gcNetIfCombinedStaticSync(els, currentNetRow);
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
      let def = els.macDefault && els.macDefault.checked;
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
        let row0 = currentNetRow;
        let isCfg =
          (typeof globalThis.gcNetIfEntityTarget === "string" &&
            globalThis.gcNetIfEntityTarget === "configuration") ||
          !!(
            row0 &&
            (row0.configuration_id != null || row0.scope === "configuration")
          );
        let url = isCfg
          ? typeof globalThis.gcConfigurationApplyInterfaceUrl === "string"
            ? globalThis.gcConfigurationApplyInterfaceUrl
            : ""
          : typeof globalThis.gcTaskQueueEnqueueUrl === "string"
            ? globalThis.gcTaskQueueEnqueueUrl
            : "";
        let srcs = row0 && row0.if_combine_sources;
        let combinedMulti =
          row0 &&
          row0.interfaces_row_combined &&
          Array.isArray(srcs) &&
          srcs.length > 1 &&
          ((typeof globalThis.gcNetIfCombinedStaticUsesV4 === "function" &&
            globalThis.gcNetIfCombinedStaticUsesV4(els, row0)) ||
            (typeof globalThis.gcNetIfCombinedStaticUsesV6 === "function" &&
              globalThis.gcNetIfCombinedStaticUsesV6(els, row0)));
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
          if (typeof globalThis.gcNetIfInvalidateIpamPoolsCache === "function") {
            globalThis.gcNetIfInvalidateIpamPoolsCache();
          }
          close(root);
        }
        function failSave(msg) {
          alert(typeof msg === "string" ? msg : JSON.stringify(msg));
          if (els.saveBtn) els.saveBtn.disabled = false;
          syncDirty();
        }
        if (combinedMulti) {
          let selectedScopes = collectFlyoutScopeIds(els.form);
          if (!selectedScopes.length) {
            alert("Select at least one firewall or configuration to update.");
            return;
          }
          let tb4 = els.ipv4CombinedTbody;
          let tb6 = els.ipv6CombinedTbody;
          let r4 = tb4 ? tb4.querySelectorAll("tr.gc-if-cmb-data-row") : [];
          let r6 = tb6 ? tb6.querySelectorAll("tr.gc-if-cmb-data-row") : [];
          let idx = 0;
          if (els.saveBtn) els.saveBtn.disabled = true;
          function postOne() {
            if (idx >= srcs.length) {
              finishOk();
              return;
            }
            let src = srcs[idx];
            let tr4 = r4[idx];
            let tr6 = r6[idx];
            idx++;
            if (src == null || src.config_entry_id == null) {
              postOne();
              return;
            }
            let scopeId = scopeIdFromSource(src);
            if (scopeId != null && selectedScopes.indexOf(scopeId) === -1) {
              postOne();
              return;
            }
            let fdat = collectFormWithCombinedRow(tr4, tr6);
            let payload = JSON.stringify({
              config_entry_id: src.config_entry_id,
              form: fdat,
            });
            let poolSel = tr4 && tr4.querySelector(".gc-if-cmb-pool");
            let pid = poolSel && poolSel.value.trim();
            let fid =
              src && src.firewall_id != null && String(src.firewall_id).trim() !== ""
                ? parseInt(String(src.firewall_id), 10)
                : 0;
            let commitU =
              typeof globalThis.gcIpamInterfacePoolCommitUrl === "string"
                ? globalThis.gcIpamInterfacePoolCommitUrl
                : "";
            let doCommit =
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
                    let msg =
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
                  let m =
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
        let cid = row0 && row0.config_entry_id;
        if (cid == null) {
          alert(
            isCfg
              ? "Configuration save URL is not configured or the row is missing a config entry id."
              : "Task queue is not configured or row is missing config entry id.",
          );
          return;
        }
        let payload = JSON.stringify({
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
              let msg =
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

    globalThis.gcNetIfIpv4ModeValue = ipv4ModeValue;
    globalThis.gcNetIfIpv6ModeValue = ipv6ModeValue;
    globalThis.gcNetIfPick = pick;
    globalThis.gcNetIfNetmaskToDisplay = function (nm) {
      return globalThis.gcNetIpv4FlyoutBlur.netmaskToSlashDisplay(nm);
    };
    globalThis.gcNetIfSyncDirty = syncDirty;
    globalThis.gcNetIfIsWanNetworkZone = isWanNetworkZone;
  }

  function openFromTr(tr) {
    let row = tr && tr._gcNetRow;
    currentNetRow = row || null;
    let root = document.getElementById("gc-net-if-edit-flyout");
    if (!row || !root) return;
    let etN = normLower(row.entity_type);
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

  globalThis.gcNetIfEditFlyoutInit = function () {
    let root = document.getElementById("gc-net-if-edit-flyout");
    if (!root) return;
    bind(root);
  };

  globalThis.gcNetIfEditFlyoutOpenFromTr = function (tr) {
    openFromTr(tr);
  };
})();
