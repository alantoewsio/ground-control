/**
 * LAG add/edit flyout (Firewalls · Network · Interfaces).
 */
(function () {
  "use strict";

  var currentNetRow = null;
  var addMode = false;
  var initialFormSnapshot = "";
  var els = {};
  var memberScopeFw;
  var memberScopeCfg;
  var memberScopeRequired = false;
  var advOpen = false;

  function ifTbodyId() {
    var p = (typeof window.gcNetVlanIfPrefix === "string" && window.gcNetVlanIfPrefix) || "gc-net-if";
    return p + "-tbody";
  }

  function normLower(s) {
    return String(s || "").trim().toLowerCase();
  }

  function pick(raw, keys) {
    if (!raw || typeof raw !== "object") return "";
    for (var i = 0; i < keys.length; i++) {
      var v = raw[keys[i]];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  function pickFlat(flat, keys) {
    return pick(flat, keys);
  }

  function rowMatchesNetScope(row, fwId) {
    var wantFw = fwId != null && fwId !== "" && !isNaN(Number(fwId));
    if (!wantFw) return true;
    return row.firewall_id != null && Number(row.firewall_id) === Number(fwId);
  }

  function collectZonesFromInterfacesTableScoped(fwId) {
    var set = {};
    var tbody = document.getElementById(ifTbodyId());
    if (!tbody) return [];
    tbody.querySelectorAll("tr[data-search]").forEach(function (tr) {
      var row = tr._gcNetRow;
      if (!row || !rowMatchesNetScope(row, fwId)) return;
      var td = tr.querySelector('td[data-gc-col="__zone"]');
      var t = td ? (td.textContent || "").trim().replace(/\s+/g, " ") : "";
      if (t && normLower(t) !== "none") set[t] = true;
    });
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }

  function collectPhysicalInterfaceNamesScoped(fwId, cfgId, opts) {
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

  function collectLagMembersFromRaw(raw) {
    var out = [];
    if (!raw || typeof raw !== "object") return out;
    var mi = raw.MemberInterface;
    if (mi == null) return out;
    function pushIface(x) {
      var s = x != null ? String(x).trim() : "";
      if (s) out.push(s);
    }
    if (Array.isArray(mi)) {
      mi.forEach(function (block) {
        if (block && typeof block === "object" && block.Interface != null) pushIface(block.Interface);
      });
      return out;
    }
    if (typeof mi === "object") {
      var v = mi.Interface;
      if (Array.isArray(v)) v.forEach(pushIface);
      else pushIface(v);
    }
    return out;
  }

  function truthyFlat(flat, keys) {
    var s = normLower(pickFlat(flat, keys));
    if (s === "false" || s === "0" || s === "no" || s === "off" || s === "disabled") return false;
    if (s === "true" || s === "1" || s === "yes" || s === "on" || s === "enable" || s === "enabled") return true;
    return null;
  }

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

  function guessIpv4Mode(flat, raw) {
    var v = normLower(pick(raw || flat || {}, ["IPAssignment", "IPv4Assignment"]));
    if (v.indexOf("dhcp") !== -1) return "dhcp";
    if (v.indexOf("static") !== -1) return "static";
    var ip = pickFlat(flat, ["IPv4Address", "IPAddress"]);
    if (ip) return "static";
    return "dhcp";
  }

  function guessIpv6Mode(flat) {
    var v = normLower(pickFlat(flat, ["IPv6Assignment"]));
    if (v.indexOf("delegat") !== -1) return "delegated";
    if (v.indexOf("dhcp") !== -1) return "dhcp";
    if (v.indexOf("static") !== -1) return "static";
    var ip = pickFlat(flat, ["IPv6Address"]);
    if (ip) return "static";
    return "static";
  }

  function isWanNetworkZone() {
    if (!els.zone) return false;
    var z = normLower(els.zone.value);
    return z === "wan" || z.indexOf("wan ") === 0;
  }

  function netmaskToDisplay(nm) {
    return window.gcNetIpv4FlyoutBlur.netmaskToDisplay(nm);
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

  var MEMBER_TRASH_SVG =
    '<svg class="gc-bridge-flyout__member-trash-svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4v-2h-3.5l-1-1h-5l-1 1H5v2h14zM8 9h8v10H8V9z"/></svg>';

  function populateMemberSelect(selectEl, currentValue, choiceList) {
    var cur = currentValue != null ? String(currentValue).trim() : "";
    var curLower = cur.toLowerCase();
    while (selectEl.firstChild) selectEl.removeChild(selectEl.firstChild);
    var optPlaceholder = document.createElement("option");
    optPlaceholder.value = "";
    optPlaceholder.textContent = "\u2014";
    selectEl.appendChild(optPlaceholder);
    for (var i = 0; i < choiceList.length; i++) {
      var opt = document.createElement("option");
      opt.value = choiceList[i];
      opt.textContent = choiceList[i];
      selectEl.appendChild(opt);
    }
    if (cur) {
      var valueToSet = cur;
      for (var k = 0; k < choiceList.length; k++) {
        if (choiceList[k].toLowerCase() === curLower) {
          valueToSet = choiceList[k];
          break;
        }
      }
      var hasOption = false;
      for (var n = 0; n < selectEl.options.length; n++) {
        if (selectEl.options[n].value === valueToSet) {
          hasOption = true;
          break;
        }
      }
      if (!hasOption) {
        var ox = document.createElement("option");
        ox.value = valueToSet;
        ox.textContent = valueToSet;
        selectEl.appendChild(ox);
      }
      selectEl.value = valueToSet;
    } else selectEl.selectedIndex = 0;
  }

  function readMembersFromDom() {
    var tb = els.membersTbody;
    if (!tb) return [];
    var out = [];
    tb.querySelectorAll("tr[data-gc-lag-member-row]").forEach(function (tr) {
      var si = tr.querySelector(".gc-lag-flyout__member-if");
      out.push(si ? si.value.trim() : "");
    });
    return out;
  }

  function renderMemberRows(memberIfaces) {
    var tb = els.membersTbody;
    if (!tb) return;
    var scopeOpts = { requireScope: memberScopeRequired };
    var ifaces = collectPhysicalInterfaceNamesScoped(memberScopeFw, memberScopeCfg, scopeOpts);
    var rows = (memberIfaces || []).filter(function (x) {
      return String(x || "").trim() !== "";
    });
    tb.innerHTML = "";

    function appendRow(ifaceVal, isBlank) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-gc-lag-member-row", "1");
      if (isBlank) tr.setAttribute("data-gc-lag-member-blank", "1");
      var td1 = document.createElement("td");
      var sel = document.createElement("select");
      sel.className = "gc-if-flyout__input gc-if-flyout__select gc-lag-flyout__member-if gc-bridge-flyout__member-select";
      sel.setAttribute("aria-label", isBlank ? "New member interface" : "Member interface");
      populateMemberSelect(sel, ifaceVal, ifaces);
      sel.addEventListener("change", function () {
        renderMemberRows(readMembersFromDom());
        syncPrimaryOptions();
        syncDirty();
      });
      td1.appendChild(sel);
      var td2 = document.createElement("td");
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn-icon gc-bridge-flyout__member-remove";
      rm.innerHTML = MEMBER_TRASH_SVG;
      if (isBlank) {
        rm.disabled = true;
        rm.classList.add("gc-bridge-flyout__member-remove--blank");
      } else {
        rm.setAttribute("aria-label", "Remove member");
        rm.addEventListener("click", function () {
          tr.remove();
          renderMemberRows(readMembersFromDom());
          syncPrimaryOptions();
          syncDirty();
        });
      }
      td2.appendChild(rm);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tb.appendChild(tr);
    }

    rows.forEach(function (m) {
      appendRow(m, false);
    });
    appendRow("", true);
  }

  function setZoneOptions(currentZone, fwId, cfgId) {
    var zones = collectZonesFromInterfacesTableScoped(fwId, cfgId);
    var cur = (currentZone || "").trim();
    if (cur && normLower(cur) !== "none" && zones.indexOf(cur) === -1) zones.push(cur);
    zones.sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
    els.zone.innerHTML =
      '<option value="None">None</option>' +
      zones
        .map(function (z) {
          return '<option value="' + escapeAttr(z) + '">' + escapeHtml(z) + "</option>";
        })
        .join("");
    var useVal = cur && normLower(cur) !== "none" ? cur : "None";
    els.zone.value = zones.indexOf(useVal) !== -1 || useVal === "None" ? useVal : "None";
  }

  function syncPrimaryOptions() {
    if (!els.primarySel) return;
    var mems = readMembersFromDom().filter(function (x) {
      return x;
    });
    var cur = els.primarySel.value.trim();
    els.primarySel.innerHTML = '<option value="">\u2014 None \u2014</option>';
    mems.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      els.primarySel.appendChild(o);
    });
    if (cur && mems.indexOf(cur) !== -1) els.primarySel.value = cur;
  }

  function syncModeUi() {
    var lacp = els.modeLacp && els.modeLacp.checked;
    if (els.xmitWrap) {
             els.xmitWrap.hidden = !lacp;
             els.xmitWrap.setAttribute("aria-hidden", lacp ? "false" : "true");
    }
    if (els.primaryWrap) {
      els.primaryWrap.hidden = lacp;
      els.primaryWrap.setAttribute("aria-hidden", lacp ? "true" : "false");
    }
  }

  function ipv4ModeValue() {
    return els.ipv4Static && els.ipv4Static.checked ? "static" : "dhcp";
  }

  function ipv6ModeValue() {
    if (els.ipv6Del && els.ipv6Del.checked) return "delegated";
    if (els.ipv6Dhcp && els.ipv6Dhcp.checked) return "dhcp";
    return "static";
  }

  function syncIpv4ModeUi() {
    var st = ipv4ModeValue() === "static";
    if (els.ipv4Ip) {
             els.ipv4Ip.readOnly = !st;
             els.ipv4Ip.classList.toggle("gc-if-flyout__input--readonly", !st);
    }
    if (els.ipv4Nm) {
             els.ipv4Nm.readOnly = !st;
             els.ipv4Nm.classList.toggle("gc-if-flyout__input--readonly", !st);
    }
    if (els.ipv4GwWrap) {
      var wan = isWanNetworkZone();
      els.ipv4GwWrap.hidden = !(wan && st);
      els.ipv4GwWrap.setAttribute("aria-hidden", els.ipv4GwWrap.hidden ? "true" : "false");
    }
  }

  function syncIpv6ModeUi() {
    var m = ipv6ModeValue();
    var ro = m !== "static";
    [els.ipv6Ip, els.ipv6Prefix, els.ipv6GwName, els.ipv6GwIp].forEach(function (inp) {
      if (!inp) return;
      inp.readOnly = ro;
      inp.classList.toggle("gc-if-flyout__input--readonly", ro);
    });
    if (els.ipv6GwWrap) {
      els.ipv6GwWrap.hidden = m !== "static" || !ipv6Enabled();
      els.ipv6GwWrap.setAttribute("aria-hidden", els.ipv6GwWrap.hidden ? "true" : "false");
    }
  }

  function ipv6Enabled() {
    return !!(els.ipv6Cb && els.ipv6Cb.checked);
  }

  function syncIpv4Body() {
    if (!els.ipv4Body) return;
    var on = els.ipv4Cb && els.ipv4Cb.checked;
    els.ipv4Body.hidden = !on;
    els.ipv4Body.setAttribute("aria-hidden", on ? "false" : "true");
  }

  function syncIpv6Body() {
    if (!els.ipv6Cb || !els.ipv6Body) return;
    var on = els.ipv6Cb.checked;
    els.ipv6Body.hidden = !on;
    els.ipv6Body.setAttribute("aria-hidden", on ? "false" : "true");
    if (on) syncIpv6ModeUi();
  }

  function syncAdvanced() {
    if (!els.advBtn || !els.advBody) return;
    els.advBtn.setAttribute("aria-expanded", advOpen ? "true" : "false");
    els.advBody.hidden = !advOpen;
  }

  function collectLagForm() {
    var o = {
      name: els.nameInp ? els.nameInp.value.trim() : "",
      network_zone: els.zone ? els.zone.value : "",
      lag_mode: els.modeLacp && els.modeLacp.checked ? "lacp" : "active_backup",
      lag_xmit_hash: els.xmitSel ? els.xmitSel.value : "Layer2",
      lag_primary: els.primarySel ? els.primarySel.value.trim() : "",
      lag_members: readMembersFromDom().filter(function (x) {
        return x;
      }),
      ipv4_enabled: !!(els.ipv4Cb && els.ipv4Cb.checked),
      ipv4_mode: ipv4ModeValue(),
      ipv4_ip: els.ipv4Ip ? els.ipv4Ip.value : "",
      ipv4_netmask: els.ipv4Nm ? els.ipv4Nm.value : "",
      ipv4_gateway_name:
        isWanNetworkZone() && els.ipv4GwName ? els.ipv4GwName.value : "",
      ipv4_gateway_ip: isWanNetworkZone() && els.ipv4GwIp ? els.ipv4GwIp.value : "",
      ipv6_enabled: !!(els.ipv6Cb && els.ipv6Cb.checked),
      ipv6_mode: ipv6ModeValue(),
      ipv6_ip: els.ipv6Ip ? els.ipv6Ip.value : "",
      ipv6_prefix: els.ipv6Prefix ? els.ipv6Prefix.value : "",
      ipv6_gateway_name:
        isWanNetworkZone() && els.ipv6GwName ? els.ipv6GwName.value : "",
      ipv6_gateway_ip: isWanNetworkZone() && els.ipv6GwIp ? els.ipv6GwIp.value : "",
      link_mode: els.linkMode ? els.linkMode.value : "",
      auto_negotiation: !!(els.autoNeg && els.autoNeg.checked),
      fec: els.fec ? els.fec.value : "",
      mtu: els.mtu ? els.mtu.value : "",
      mss_override: !!(els.mssCb && els.mssCb.checked),
      mss: els.mssInp ? els.mssInp.value : "",
      mac_mode: els.macOverride && els.macOverride.checked ? "override" : "default",
      mac_override: els.macCustomVal ? els.macCustomVal.value : "",
      interface_status: els.ifStatusCb && els.ifStatusCb.checked ? "on" : "off",
    };
    if (addMode && els.hwInp) o.hardware = els.hwInp.value.trim();
    return o;
  }

  function getFormSnapshot() {
    try {
      return JSON.stringify(collectLagForm());
    } catch (e) {
      return "";
    }
  }

  function syncDirty() {
    if (els.saveBtn) els.saveBtn.disabled = getFormSnapshot() === initialFormSnapshot;
  }

  function setInitialSnapshot() {
    initialFormSnapshot = getFormSnapshot();
    syncDirty();
  }

  function syncLagAddTargetRows() {
    var target =
      typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
    if (els.addFwRow) {
      var showFw = !!(addMode && target === "firewall");
      els.addFwRow.hidden = !showFw;
      els.addFwRow.setAttribute("aria-hidden", showFw ? "false" : "true");
    }
    if (els.addCfgRow) {
      var showCfg = !!(addMode && target === "configuration");
      els.addCfgRow.hidden = !showCfg;
      els.addCfgRow.setAttribute("aria-hidden", showCfg ? "false" : "true");
    }
  }

  function fillLagAddTargetSelects() {
    var target =
      typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
    if (target === "firewall" && els.addFwSelect) {
      var inv =
        typeof window.gcGetFirewallNavInventory === "function" ? window.gcGetFirewallNavInventory() : [];
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
        typeof window.gcGetConfigurationNavInventory === "function"
          ? window.gcGetConfigurationNavInventory()
          : [];
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

  function populateFromRow(row) {
    var raw = (row && row.raw_payload) || {};
    var flat = (row && row.flat) || {};

    if (els.nameInp) els.nameInp.value = pickFlat(flat, ["Name"]) || "";
    var hw = pick(raw, ["Hardware"]) || pickFlat(flat, ["Hardware"]);
    if (addMode) {
      if (els.hwInp) els.hwInp.value = "";
      if (els.hwRo) els.hwRo.textContent = "\u2014";
    } else {
      if (els.hwRo) els.hwRo.textContent = hw || "\u2014";
      if (els.hwInp) els.hwInp.value = hw || "";
    }

    var z = pickFlat(flat, ["NetworkZone", "Zone"]) || "";
    var fwS = row && row.firewall_id != null && row.firewall_id !== "" ? Number(row.firewall_id) : null;
    var cfgS = row && row.configuration_id != null && row.configuration_id !== "" ? Number(row.configuration_id) : null;
    setZoneOptions(z, fwS, cfgS);

    var modeRaw = normLower(pick(raw, ["Mode"]) || pickFlat(flat, ["Mode"]));
    var lacp = modeRaw.indexOf("802.3ad") !== -1 || modeRaw.indexOf("lacp") !== -1;
    if (els.modeAb) els.modeAb.checked = !lacp;
    if (els.modeLacp) els.modeLacp.checked = lacp;
    if (els.xmitSel) {
      var xh = pick(raw, ["XmitHashPolicy"]) || pickFlat(flat, ["XmitHashPolicy"]) || "Layer2";
      els.xmitSel.value = xh.indexOf("+") !== -1 ? xh : xh;
      if (!els.xmitSel.value && xh) {
        var o = document.createElement("option");
        o.value = xh;
        o.textContent = xh;
        els.xmitSel.appendChild(o);
        els.xmitSel.value = xh;
      }
    }

    var mems = collectLagMembersFromRaw(raw);
    renderMemberRows(mems);

    var prim = pick(raw, ["PrimaryInterface"]) || pickFlat(flat, ["PrimaryInterface"]);
    syncPrimaryOptions();
    if (els.primarySel && prim) els.primarySel.value = prim;

    var v4 = guessIpv4Mode(flat, raw);
    if (els.ipv4Static) els.ipv4Static.checked = v4 === "static";
    if (els.ipv4Dhcp) els.ipv4Dhcp.checked = v4 === "dhcp";
    if (els.ipv4Ip)
      els.ipv4Ip.value = pickFlat(flat, ["IPv4Address", "IPAddress"]) || pick(raw, ["IPv4Address", "IPAddress"]);
    if (els.ipv4Nm) els.ipv4Nm.value = netmaskToDisplay(pickFlat(flat, ["Netmask"]));

    var v4on = truthyFlat(flat, ["IPv4Configuration"]) !== false;
    if (els.ipv4Cb) els.ipv4Cb.checked = v4on !== false;

    var v6 = guessIpv6Mode(flat);
    if (els.ipv6Static) els.ipv6Static.checked = v6 === "static";
    if (els.ipv6Dhcp) els.ipv6Dhcp.checked = v6 === "dhcp";
    if (els.ipv6Del) els.ipv6Del.checked = v6 === "delegated";
    if (els.ipv6Ip) els.ipv6Ip.value = pickFlat(flat, ["IPv6Address"]);
    if (els.ipv6Prefix) els.ipv6Prefix.value = pickFlat(flat, ["Prefix"]) || "64";
    if (els.ipv6GwName) els.ipv6GwName.value = pickFlat(flat, ["GatewayNameIpv6"]);
    if (els.ipv6GwIp) els.ipv6GwIp.value = pickFlat(flat, ["GatewayIPv6"]);

    var v6on = truthyFlatIpv6(flat);

    if (els.ipv6Cb) els.ipv6Cb.checked = v6on;

    var st = normLower(pickFlat(flat, ["InterfaceStatus"]));
    if (els.ifStatusCb) els.ifStatusCb.checked = st !== "off";

    if (els.linkMode) {
      var lmRaw = pickFlat(flat, ["InterfaceSpeed"]) || "Auto Negotiate";
      els.linkMode.value = normalizeInterfaceSpeedForSelect(lmRaw);
    }
    var autoNeg = truthyFlat(flat, ["AutoNegotiation"]);
    if (autoNeg === null) autoNeg = true;
    if (els.autoNeg) els.autoNeg.checked = autoNeg !== false;
    if (els.fec) els.fec.value = normalizeFecForSelect(pickFlat(flat, ["FEC"]) || "Off");
    if (els.mtu) els.mtu.value = pickFlat(flat, ["MTU"]) || "1500";
    var mssO = truthyFlat(flat, ["MSS.OverrideMSS", "OverrideMSS"]);
    if (els.mssCb) els.mssCb.checked = mssO === true;
    if (els.mssInp) els.mssInp.value = pickFlat(flat, ["MSS.MSSValue", "MSSValue"]) || "1460";

    var mac = pickFlat(flat, ["MACAddress"]);
    var isDefaultMac = !mac || normLower(mac) === "default";
    if (els.macDefault) els.macDefault.checked = isDefaultMac;
    if (els.macOverride) els.macOverride.checked = !isDefaultMac;
    if (els.macDefVal) els.macDefVal.value = isDefaultMac ? pickFlat(flat, ["FactoryMAC"]) || "" : "";
    if (els.macCustomVal) els.macCustomVal.value = !isDefaultMac ? mac : "";

    advOpen = false;
    syncAdvanced();
    syncModeUi();
    syncIpv4Body();
    syncIpv4ModeUi();
    syncIpv6Body();
    syncIpv6ModeUi();
    setInitialSnapshot();
  }

  function truthyFlatIpv6(flat) {
    return truthyFlat(flat, ["IPv6Configuration"]) !== false;
  }

  function open(root) {
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("gc-if-flyout--open");
    var panel = root.querySelector(".gc-if-flyout__panel");
    if (panel) try { panel.focus(); } catch (e) {}
  }

  function close(root) {
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gc-if-flyout--open");
    addMode = false;
    currentNetRow = null;
  }

  function cacheEls(root) {
    els = {
      root: root,
      title: root.querySelector("#gc-lag-flyout-title"),
      addFwRow: root.querySelector("#gc-lag-flyout-target-fw-row"),
      addCfgRow: root.querySelector("#gc-lag-flyout-target-cfg-row"),
      addFwSelect: root.querySelector("#gc-lag-flyout-add-firewall"),
      addCfgSelect: root.querySelector("#gc-lag-flyout-add-configuration"),
      form: root.querySelector("#gc-lag-flyout-form"),
      nameInp: root.querySelector("#gc-lag-flyout-name"),
      hwFieldEdit: root.querySelector("#gc-lag-flyout-hw-edit-field"),
      hwFieldRo: root.querySelector("#gc-lag-flyout-hw-ro-field"),
      hwInp: root.querySelector("#gc-lag-flyout-hardware"),
      hwRo: root.querySelector("#gc-lag-flyout-hardware-ro"),
      zone: root.querySelector("#gc-lag-flyout-zone"),
      modeAb: root.querySelector('input[name="gc-lag-mode"][value="active_backup"]'),
      modeLacp: root.querySelector('input[name="gc-lag-mode"][value="lacp"]'),
      xmitWrap: root.querySelector("#gc-lag-flyout-xmit-wrap"),
      xmitSel: root.querySelector("#gc-lag-flyout-xmit"),
      primaryWrap: root.querySelector("#gc-lag-flyout-primary-wrap"),
      primarySel: root.querySelector("#gc-lag-flyout-primary"),
      membersTbody: root.querySelector("#gc-lag-flyout-members-tbody"),
      ifStatusCb: root.querySelector("#gc-lag-flyout-if-status"),
      ipv4Cb: root.querySelector("#gc-lag-flyout-ipv4-enabled"),
      ipv4Body: root.querySelector("#gc-lag-flyout-ipv4-body"),
      ipv4Static: root.querySelector('input[name="gc-lag-ipv4-mode"][value="static"]'),
      ipv4Dhcp: root.querySelector('input[name="gc-lag-ipv4-mode"][value="dhcp"]'),
      ipv4Ip: root.querySelector("#gc-lag-flyout-ipv4-ip"),
      ipv4Nm: root.querySelector("#gc-lag-flyout-ipv4-netmask"),
      ipv4GwWrap: root.querySelector("#gc-lag-flyout-ipv4-gateway-wrap"),
      ipv4GwName: root.querySelector("#gc-lag-flyout-ipv4-gw-name"),
      ipv4GwIp: root.querySelector("#gc-lag-flyout-ipv4-gw-ip"),
      ipv6Cb: root.querySelector("#gc-lag-flyout-ipv6-enabled"),
      ipv6Body: root.querySelector("#gc-lag-flyout-ipv6-body"),
      ipv6Static: root.querySelector('input[name="gc-lag-ipv6-mode"][value="static"]'),
      ipv6Dhcp: root.querySelector('input[name="gc-lag-ipv6-mode"][value="dhcp"]'),
      ipv6Del: root.querySelector('input[name="gc-lag-ipv6-mode"][value="delegated"]'),
      ipv6Ip: root.querySelector("#gc-lag-flyout-ipv6-ip"),
      ipv6Prefix: root.querySelector("#gc-lag-flyout-ipv6-prefix"),
      ipv6GwWrap: root.querySelector("#gc-lag-flyout-ipv6-gateway-wrap"),
      ipv6GwName: root.querySelector("#gc-lag-flyout-ipv6-gw-name"),
      ipv6GwIp: root.querySelector("#gc-lag-flyout-ipv6-gw-ip"),
      advBtn: root.querySelector("#gc-lag-flyout-adv-toggle"),
      advBody: root.querySelector("#gc-lag-flyout-adv-body"),
      linkMode: root.querySelector("#gc-lag-flyout-link-mode"),
      autoNeg: root.querySelector("#gc-lag-flyout-auto-neg"),
      fec: root.querySelector("#gc-lag-flyout-fec"),
      mtu: root.querySelector("#gc-lag-flyout-mtu"),
      mssCb: root.querySelector("#gc-lag-flyout-mss-cb"),
      mssInp: root.querySelector("#gc-lag-flyout-mss"),
      macDefault: root.querySelector('input[name="gc-lag-mac-mode"][value="default"]'),
      macOverride: root.querySelector('input[name="gc-lag-mac-mode"][value="override"]'),
      macDefVal: root.querySelector("#gc-lag-flyout-mac-default"),
      macCustomVal: root.querySelector("#gc-lag-flyout-mac-override"),
      saveBtn: root.querySelector("#gc-lag-flyout-save"),
      cancelBtn: root.querySelector("#gc-lag-flyout-cancel"),
    };
  }

  function bind(root) {
    if (root.dataset.gcLagFlyoutBound === "1") return;
    root.dataset.gcLagFlyoutBound = "1";
    cacheEls(root);
    var panel = root.querySelector(".gc-if-flyout__panel");
    var handle = root.querySelector(".gc-if-flyout__resize");
    if (panel && handle && handle.dataset.gcLagResizeBound !== "1") {
      handle.dataset.gcLagResizeBound = "1";
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

    root.querySelectorAll('input[name="gc-lag-mode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        syncModeUi();
        syncDirty();
      });
    });
    if (els.zone)
      els.zone.addEventListener("change", function () {
        syncIpv4ModeUi();
        syncIpv6ModeUi();
        syncDirty();
      });
    if (els.ipv4Cb)
      els.ipv4Cb.addEventListener("change", function () {
        syncIpv4Body();
        syncIpv4ModeUi();
        syncDirty();
      });
    if (els.ipv6Cb)
      els.ipv6Cb.addEventListener("change", function () {
        syncIpv6Body();
        syncIpv6ModeUi();
        syncDirty();
      });
    root.querySelectorAll('input[name="gc-lag-ipv4-mode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        syncIpv4ModeUi();
        syncDirty();
      });
    });
    root.querySelectorAll('input[name="gc-lag-ipv6-mode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        syncIpv6ModeUi();
        syncDirty();
      });
    });
    if (els.ipv4Ip) {
      els.ipv4Ip.addEventListener("blur", function () {
        window.gcNetIpv4FlyoutBlur.applyCidrSplit(
          {
            ipv4Ip: els.ipv4Ip,
            ipv4Nm: els.ipv4Nm,
            ipv4ModeStatic: els.ipv4Static,
            ipv4ModeDhcp: els.ipv4Dhcp,
          },
          syncDirty,
        );
      });
    }
    if (els.ipv4Nm) {
      els.ipv4Nm.addEventListener("blur", function () {
        window.gcNetIpv4FlyoutBlur.applyNetmaskNormalize(
          { ipv4Nm: els.ipv4Nm },
          syncDirty,
        );
      });
    }
    if (els.ipv6Ip) {
      els.ipv6Ip.addEventListener("blur", function () {
        if (!els.ipv6Ip || !els.ipv6Prefix || els.ipv6Ip.readOnly) return;
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
      });
    }

    function onLagAddScopeChange() {
      if (!addMode) return;
      var target =
        typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
      if (target === "firewall") {
        memberScopeFw = els.addFwSelect ? parseInt(els.addFwSelect.value, 10) : NaN;
        memberScopeCfg = null;
      } else {
        memberScopeCfg = els.addCfgSelect ? parseInt(els.addCfgSelect.value, 10) : NaN;
        memberScopeFw = null;
      }
      setZoneOptions("", memberScopeFw, memberScopeCfg);
      renderMemberRows(readMembersFromDom().filter(function (x) { return x; }));
      syncPrimaryOptions();
      syncDirty();
    }
    if (els.addFwSelect && els.addFwSelect.dataset.gcLagFwBound !== "1") {
      els.addFwSelect.dataset.gcLagFwBound = "1";
      els.addFwSelect.addEventListener("change", onLagAddScopeChange);
    }
    if (els.addCfgSelect && els.addCfgSelect.dataset.gcLagCfgBound !== "1") {
      els.addCfgSelect.dataset.gcLagCfgBound = "1";
      els.addCfgSelect.addEventListener("change", onLagAddScopeChange);
    }

    if (els.advBtn) {
      els.advBtn.addEventListener("click", function () {
        advOpen = !advOpen;
        syncAdvanced();
      });
    }
    function onMacMode() {
      var def = els.macDefault && els.macDefault.checked;
      if (els.macCustomVal) {
        els.macCustomVal.readOnly = def;
        els.macCustomVal.classList.toggle("gc-if-flyout__input--readonly", def);
      }
    }
    root.querySelectorAll('input[name="gc-lag-mac-mode"]').forEach(function (r) {
      r.addEventListener("change", onMacMode);
    });
    onMacMode();

    if (els.cancelBtn) els.cancelBtn.addEventListener("click", function () { close(root); });
    root.querySelector(".gc-if-flyout__backdrop").addEventListener("click", function () { close(root); });

    if (els.form) {
      els.form.addEventListener("input", syncDirty);
      els.form.addEventListener("change", syncDirty);
      els.form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (els.saveBtn && els.saveBtn.disabled) return;
        var targetEnt =
          typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
        var rowLag = currentNetRow;
        var isCfg =
          targetEnt === "configuration" ||
          !!(
            rowLag &&
            (rowLag.configuration_id != null || rowLag.scope === "configuration")
          );
        if (addMode) {
          isCfg = targetEnt === "configuration";
          var createUrl = isCfg
            ? typeof window.gcNetLagApplyCreateUrl === "string"
              ? window.gcNetLagApplyCreateUrl
              : ""
            : typeof window.gcNetLagEnqueueCreateUrl === "string"
              ? window.gcNetLagEnqueueCreateUrl
              : "";
          if (!createUrl) {
            alert(
              isCfg
                ? "LAG configuration create URL is not configured."
                : "LAG queue-create URL is not configured.",
            );
            return;
          }
          var fwIdSel;
          var cfgIdSel;
          if (isCfg) {
            cfgIdSel = els.addCfgSelect ? parseInt(els.addCfgSelect.value.trim(), 10) : NaN;
            if (!els.addCfgSelect || !els.addCfgSelect.value.trim() || isNaN(cfgIdSel) || cfgIdSel <= 0) {
              alert("Select a configuration.");
              return;
            }
          } else {
            fwIdSel = els.addFwSelect ? parseInt(els.addFwSelect.value.trim(), 10) : NaN;
            if (!els.addFwSelect || !els.addFwSelect.value.trim() || isNaN(fwIdSel) || fwIdSel <= 0) {
              alert("Select a firewall.");
              return;
            }
          }
          var hw = els.hwInp ? els.hwInp.value.trim() : "";
          if (!hw || !/^[A-Za-z][A-Za-z0-9_]*$/.test(hw) || hw.length > 10) {
            alert("Hardware must be 1–10 characters, start with a letter, letters/digits/underscores only.");
            return;
          }
          var mems = collectLagForm().lag_members;
          if (mems.length < 2 || mems.length > 4) {
            alert("Select 2–4 member interfaces.");
            return;
          }
          if (els.saveBtn) els.saveBtn.disabled = true;
          function detailMessage(j, fallback) {
            var d = j && j.detail;
            if (typeof d === "string") return d;
            if (d && typeof d.message === "string") return d.message;
            if (j && typeof j.message === "string") return j.message;
            return fallback;
          }
          function runCreate(force) {
            var o = isCfg
              ? { configuration_id: cfgIdSel, form: collectLagForm() }
              : { firewall_id: fwIdSel, form: collectLagForm() };
            if (force) o.force = true;
            return fetch(createUrl, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(o),
            }).then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, status: r.status, j: j };
              });
            });
          }
          runCreate(false)
            .then(function (x) {
              if (!x.ok) {
                var d = x.j && x.j.detail;
                var code = typeof d === "object" && d && d.code;
                var msg = detailMessage(x.j, "Could not add LAG.");
                if (x.status === 409 && code === "lag_cache_conflict") {
                  if (
                    window.confirm(
                      msg + "\n\nQueue this add anyway? Choose OK to proceed, or Cancel to stop.",
                    )
                  ) {
                    return runCreate(true).then(function (x2) {
                      if (!x2.ok) {
                        alert(detailMessage(x2.j, "Could not add LAG."));
                        if (els.saveBtn) els.saveBtn.disabled = false;
                        syncDirty();
                        return;
                      }
                      document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
                      close(root);
                    });
                  }
                  if (els.saveBtn) els.saveBtn.disabled = false;
                  syncDirty();
                  return;
                }
                alert(msg);
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
          ? typeof window.gcNetLagApplyUpdateUrl === "string"
            ? window.gcNetLagApplyUpdateUrl
            : ""
          : typeof window.gcNetLagEnqueueUrl === "string"
            ? window.gcNetLagEnqueueUrl
            : "";
        var cid = currentNetRow && currentNetRow.config_entry_id;
        if (!url || cid == null) {
          alert(
            isCfg
              ? "LAG save URL is not configured or the row is missing a config entry id."
              : "Task queue URL is not configured or the row is missing a config entry id.",
          );
          return;
        }
        if (els.saveBtn) els.saveBtn.disabled = true;
        fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config_entry_id: cid, form: collectLagForm() }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, j: j };
            });
          })
          .then(function (x) {
            if (!x.ok) {
              var errMsg =
                (x.j && (x.j.detail || x.j.message)) ||
                (isCfg ? "Could not queue configuration change." : "Could not save to task queue.");
              alert(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
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
    advOpen = false;
    syncAdvanced();
  }

  function openFromTr(tr) {
    addMode = false;
    currentNetRow = tr && tr._gcNetRow;
    var root = document.getElementById("gc-net-lag-flyout");
    if (!root || !currentNetRow) return;
    if (root.dataset.gcLagFlyoutBound !== "1") {
      bind(root);
    } else if (!els.form) {
      cacheEls(root);
    }
    if (els.title) els.title.textContent = "Edit LAG";
    syncLagAddTargetRows();
    if (els.hwFieldEdit) els.hwFieldEdit.hidden = true;
    if (els.hwFieldRo) els.hwFieldRo.hidden = false;
    var r0 = currentNetRow;
    memberScopeFw =
      r0.firewall_id != null && r0.firewall_id !== "" && !isNaN(Number(r0.firewall_id))
        ? Number(r0.firewall_id)
        : null;
    memberScopeCfg =
      r0.configuration_id != null && r0.configuration_id !== "" && !isNaN(Number(r0.configuration_id))
        ? Number(r0.configuration_id)
        : null;
    memberScopeRequired = true;
    populateFromRow(currentNetRow);
    open(root);
  }

  function openAdd() {
    addMode = true;
    currentNetRow = null;
    var root = document.getElementById("gc-net-lag-flyout");
    if (!root) return;
    if (root.dataset.gcLagFlyoutBound !== "1") {
      bind(root);
    } else if (!els.form) {
      cacheEls(root);
    }
    if (els.title) els.title.textContent = "Add LAG";
    if (els.hwFieldEdit) els.hwFieldEdit.hidden = false;
    if (els.hwFieldRo) els.hwFieldRo.hidden = true;
    syncLagAddTargetRows();
    fillLagAddTargetSelects();
    var targetA =
      typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
    if (targetA === "firewall") {
      memberScopeFw = els.addFwSelect ? parseInt(els.addFwSelect.value, 10) : NaN;
      memberScopeCfg = null;
    } else {
      memberScopeCfg = els.addCfgSelect ? parseInt(els.addCfgSelect.value, 10) : NaN;
      memberScopeFw = null;
    }
    memberScopeRequired = true;
    if (els.nameInp) els.nameInp.value = "";
    if (els.hwInp) els.hwInp.value = "";
    setZoneOptions("", memberScopeFw, memberScopeCfg);
    if (els.modeAb) els.modeAb.checked = true;
    if (els.modeLacp) els.modeLacp.checked = false;
    if (els.xmitSel) els.xmitSel.value = "Layer2";
    renderMemberRows([]);
    syncPrimaryOptions();
    if (els.ipv4Cb) els.ipv4Cb.checked = true;
    if (els.ipv4Static) els.ipv4Static.checked = false;
    if (els.ipv4Dhcp) els.ipv4Dhcp.checked = true;
    if (els.ipv4Ip) els.ipv4Ip.value = "";
    if (els.ipv4Nm) els.ipv4Nm.value = "";
    if (els.ipv6Cb) els.ipv6Cb.checked = true;
    if (els.ipv6Static) els.ipv6Static.checked = true;
    if (els.ipv6Dhcp) els.ipv6Dhcp.checked = false;
    if (els.ipv6Del) els.ipv6Del.checked = false;
    if (els.ipv6Ip) els.ipv6Ip.value = "";
    if (els.ipv6Prefix) els.ipv6Prefix.value = "64";
    if (els.ifStatusCb) els.ifStatusCb.checked = true;
    advOpen = false;
    syncAdvanced();
    syncModeUi();
    syncIpv4Body();
    syncIpv4ModeUi();
    syncIpv6Body();
    syncIpv6ModeUi();
    setInitialSnapshot();
    open(root);
  }

  window.gcNetLagFlyoutOpenFromTr = openFromTr;
  window.gcNetLagFlyoutOpenAdd = openAdd;
  window.gcNetLagFlyoutInit = function () {
    var root = document.getElementById("gc-net-lag-flyout");
    if (!root) return;
    cacheEls(root);
    bind(root);
  };
})();
