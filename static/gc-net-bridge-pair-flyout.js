/**
 * Bridge pair add/edit flyout (Firewalls / Configuration · Network).
 */
(function () {
  "use strict";

  var currentNetRow = null;
  var addMode = false;
  var currentRaw = null;
  var routingKeyUsed = "EnableRoutingOnBridge";
  var initialFormSnapshot = "";
  var els = {};
  var memberScopeFw;
  var memberScopeCfg;
  var memberScopeRequired = false;

  function ifTbodyId() {
    var p = (typeof window.gcNetVlanIfPrefix === "string" && window.gcNetVlanIfPrefix) || "gc-net-if";
    return p + "-tbody";
  }

  function normLower(s) {
    return String(s || "").trim().toLowerCase();
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

  function pick(raw, keys) {
    if (!raw || typeof raw !== "object") return "";
    for (var i = 0; i < keys.length; i++) {
      var v = raw[keys[i]];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  function truthyRaw(raw, keys) {
    var s = normLower(pick(raw, keys));
    if (
      s === "false" ||
      s === "0" ||
      s === "no" ||
      s === "off" ||
      s === "disable" ||
      s === "disabled"
    )
      return false;
    if (s === "true" || s === "1" || s === "yes" || s === "on" || s === "enable" || s === "enabled") return true;
    return null;
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
    var ifId = ifTbodyId();
    var vlanP = (typeof window.gcNetVlanVlanPrefix === "string" && window.gcNetVlanVlanPrefix) || "gc-net-vlan";
    return [ifId, vlanP + "-tbody"];
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

  /** Resolve nested { Interface: { Name: "Port1" } } and similar to a display string. */
  function leafMemberString(v) {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      return String(v).trim();
    }
    if (typeof v !== "object" || Array.isArray(v)) return "";
    return leafMemberString(
      v.Interface ||
        v.interface ||
        v.Name ||
        v.name ||
        v.InterfaceName ||
        v.Hardware ||
        v.Device ||
        v.Port ||
        v.port,
    );
  }

  function leafZoneString(v) {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      return String(v).trim();
    }
    if (typeof v !== "object" || Array.isArray(v)) return "";
    return leafZoneString(
      v.NetworkZone || v.networkZone || v.Zone || v.zone || v.ZoneName || v.zonename,
    );
  }

  function coalesceMember(x) {
    if (x == null) return { iface: "", zone: "" };
    if (typeof x === "string") return { iface: x.trim(), zone: "" };
    if (typeof x !== "object") return { iface: "", zone: "" };
    var ifaceRaw =
      x.Interface !== undefined && x.Interface !== null
        ? x.Interface
        : x.interface !== undefined && x.interface !== null
          ? x.interface
          : x.Name !== undefined && x.Name !== null
            ? x.Name
            : x.InterfaceName !== undefined && x.InterfaceName !== null
              ? x.InterfaceName
              : x.Hardware !== undefined && x.Hardware !== null
                ? x.Hardware
                : x.Device !== undefined && x.Device !== null
                  ? x.Device
                  : x.Port !== undefined && x.Port !== null
                    ? x.Port
                    : x.port;
    var zoneRaw =
      x.NetworkZone !== undefined && x.NetworkZone !== null
        ? x.NetworkZone
        : x.networkZone !== undefined && x.networkZone !== null
          ? x.networkZone
          : x.Zone !== undefined && x.Zone !== null
            ? x.Zone
            : x.zone !== undefined && x.zone !== null
              ? x.zone
              : x.ZoneName !== undefined && x.ZoneName !== null
                ? x.ZoneName
                : x.zonename;
    return {
      iface: leafMemberString(ifaceRaw),
      zone: leafZoneString(zoneRaw),
    };
  }

  /** Unwrap Sophos BridgeMembers { Member: [...] } and similar wrappers to a member array. */
  function unwrapMembersBlock(block) {
    if (block == null) return block;
    if (Array.isArray(block)) return block;
    if (typeof block === "string") return block;
    if (typeof block !== "object") return block;
    if (Array.isArray(block.Member)) return block.Member;
    if (block.Member != null && typeof block.Member === "object") {
      var inner = block.Member;
      if (Array.isArray(inner)) return inner;
      var numArr = objectNumericKeysToArray(inner);
      if (numArr) return numArr;
      return [inner];
    }
    if (Array.isArray(block.Members)) return block.Members;
    return block;
  }

  /** Turn { "0": row, "1": row } into [row, row] (some JSON encoders). */
  function objectNumericKeysToArray(block) {
    if (!block || typeof block !== "object" || Array.isArray(block)) return null;
    var keys = Object.keys(block);
    if (!keys.length) return null;
    if (
      !keys.every(function (k) {
        return /^\d+$/.test(k);
      })
    )
      return null;
    return keys
      .map(function (k) {
        return parseInt(k, 10);
      })
      .sort(function (a, b) {
        return a - b;
      })
      .map(function (n) {
        return block[String(n)];
      });
  }

  /** Map of interface name -> zone or nested member object (Sophos-style). */
  function membersFromInterfaceMap(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    var keys = Object.keys(obj);
    if (!keys.length) return null;
    var numeric = keys.every(function (k) {
      return /^\d+$/.test(k);
    });
    if (numeric) return null;
    var out = [];
    keys.forEach(function (k) {
      var v = obj[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        var m = coalesceMember(v);
        if (!m.iface) m.iface = String(k).trim();
        out.push(m);
      } else if (typeof v === "string") {
        out.push({ iface: String(k).trim(), zone: String(v).trim() });
      } else {
        out.push({ iface: String(k).trim(), zone: "" });
      }
    });
    return out.length ? out : null;
  }

  /** Normalize an unwrapped bridge-member block (array, map, or string) to iface/zone rows. */
  function membersFromResolvedBlock(block) {
    if (block == null) return [];
    if (typeof block === "string") {
      var st = block.trim();
      return st ? [{ iface: st, zone: "" }] : [];
    }
    var asArray = Array.isArray(block) ? block : objectNumericKeysToArray(block);
    if (asArray) {
      return asArray.map(coalesceMember);
    }
    if (typeof block === "object") {
      var single = coalesceMember(block);
      if (single.iface || single.zone) return [single];
      var mapped = membersFromInterfaceMap(block);
      if (mapped && mapped.length) return mapped;
    }
    return [];
  }

  function interfaceMembersFromRaw(raw) {
    if (!raw || typeof raw !== "object") return [];
    /* Prefer BridgeMembers / member lists before raw.Interface — bridge payloads often set
     * Interface to the bridge's own port name (string or object), which is not the member list. */
    var candidates = [
      raw.BridgeMembers,
      raw.BridgedInterfaces,
      raw.MemberInterfaces,
      raw.Member,
      raw.Members,
      raw.Interfaces,
      raw.BridgeInterface,
      raw.Interface,
    ];
    for (var c = 0; c < candidates.length; c++) {
      var cand = candidates[c];
      if (cand == null) continue;
      if (typeof cand === "string") {
        var ts = cand.trim();
        if (!ts) continue;
        if (ts.charAt(0) === "{" || ts.charAt(0) === "[") {
          try {
            cand = JSON.parse(ts);
          } catch (e) {
            continue;
          }
        } else {
          continue;
        }
      }
      if (Array.isArray(cand) && cand.length === 0) continue;
      if (typeof cand === "object" && !Array.isArray(cand) && Object.keys(cand).length === 0) continue;

      var unwrapped = unwrapMembersBlock(cand);
      if (Array.isArray(unwrapped) && unwrapped.length === 0) {
        return [];
      }
      var got = membersFromResolvedBlock(unwrapped);
      if (got.length > 0) return got;
    }
    return [];
  }

  /**
   * Rebuild members from flattened cache keys (e.g. Interface.0.Name, Member.1.NetworkZone).
   */
  function interfaceMembersFromFlat(flat) {
    if (!flat || typeof flat !== "object") return [];
    var bmFlat = flat.BridgeMembers;
    if (typeof bmFlat === "string") {
      var bms = bmFlat.trim();
      if (bms.charAt(0) === "{" || bms.charAt(0) === "[") {
        try {
          var parsedBm = JSON.parse(bms);
          var fromBm = interfaceMembersFromRaw({ BridgeMembers: parsedBm });
          if (fromBm.length) return fromBm;
        } catch (e) {}
      }
    }
    var prefixes = ["Interface", "Interfaces", "Member", "Members", "BridgeInterface", "BridgedInterface"];
    var byIx = {};
    var byNamed = {};
    function touch(i) {
      if (!byIx[i]) byIx[i] = { iface: "", zone: "" };
      return byIx[i];
    }
    function setField(i, leaf, val) {
      var s = val != null ? String(val).trim() : "";
      if (!s) return;
      var m = touch(i);
      var L = leaf.toLowerCase();
      if (
        L === "name" ||
        L === "interface" ||
        L === "interfacename" ||
        L === "hardware" ||
        L === "device" ||
        L === "port"
      ) {
        m.iface = m.iface || s;
      } else if (L === "networkzone" || L === "zone" || L === "zonename") {
        m.zone = m.zone || s;
      }
    }
    Object.keys(flat).forEach(function (k) {
      for (var p = 0; p < prefixes.length; p++) {
        var pref = prefixes[p];
        var esc = pref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        var mNum = k.match(new RegExp("^" + esc + "\\.(\\d+)\\.(.+)$"));
        if (mNum) {
          setField(parseInt(mNum[1], 10), mNum[2], flat[k]);
          return;
        }
        var mNamed = k.match(
          new RegExp("^" + esc + "\\.([^\\.]+)\\.(NetworkZone|Zone|ZoneName|Name|Interface|InterfaceName|Hardware)$", "i"),
        );
        if (mNamed) {
          var slug = mNamed[1];
          if (/^\d+$/.test(slug)) return;
          var leaf = mNamed[2].toLowerCase();
          var sv = String(flat[k] || "").trim();
          if (!sv) return;
          if (!byNamed[slug]) byNamed[slug] = { iface: "", zone: "" };
          if (leaf === "name" || leaf === "interface" || leaf === "interfacename" || leaf === "hardware") {
            byNamed[slug].iface = byNamed[slug].iface || sv;
          } else if (leaf === "networkzone" || leaf === "zone" || leaf === "zonename") {
            byNamed[slug].zone = byNamed[slug].zone || sv;
          }
          return;
        }
      }
    });
    var bbm = {};
    Object.keys(flat).forEach(function (k) {
      var m = k.match(/^BridgeMembers\.Member\.(\d+)\.(Interface|Zone|NetworkZone|Name)$/i);
      if (!m) return;
      var i = parseInt(m[1], 10);
      var leaf = m[2].toLowerCase();
      var sv = String(flat[k] != null ? flat[k] : "").trim();
      if (!sv) return;
      if (!bbm[i]) bbm[i] = { iface: "", zone: "" };
      if (leaf === "interface" || leaf === "name") bbm[i].iface = bbm[i].iface || sv;
      else if (leaf === "zone" || leaf === "networkzone") bbm[i].zone = bbm[i].zone || sv;
    });
    var bridgeNums = Object.keys(bbm)
      .map(Number)
      .filter(function (n) {
        return !isNaN(n);
      })
      .sort(function (a, b) {
        return a - b;
      });
    var bridgeList = bridgeNums.map(function (n) {
      return bbm[n];
    });
    if (
      bridgeList.some(function (m) {
        return m.iface || m.zone;
      })
    )
      return bridgeList;
    var nums = Object.keys(byIx)
      .map(Number)
      .filter(function (n) {
        return !isNaN(n);
      })
      .sort(function (a, b) {
        return a - b;
      });
    var numericList = nums.map(function (n) {
      return byIx[n];
    });
    var namedList = Object.keys(byNamed)
      .sort()
      .map(function (slug) {
        var o = byNamed[slug];
        if (!o.iface) o.iface = slug;
        return o;
      });
    if (numericList.some(function (m) {
      return m.iface || m.zone;
    }))
      return numericList;
    if (namedList.some(function (m) {
      return m.iface || m.zone;
    }))
      return namedList;
    return [];
  }

  function memberRowHasValue(m) {
    if (!m) return false;
    return !!(String(m.iface || "").trim() || String(m.zone || "").trim());
  }

  function resolveMemberRowsForEdit(row, raw) {
    var fromRaw = interfaceMembersFromRaw(raw);
    var hasData = fromRaw.some(function (m) {
      return (m.iface && m.iface.length) || (m.zone && m.zone.length);
    });
    if (hasData) return fromRaw;
    var fromFlat = interfaceMembersFromFlat((row && row.flat) || {});
    var hasFlat = fromFlat.some(function (m) {
      return (m.iface && m.iface.length) || (m.zone && m.zone.length);
    });
    if (hasFlat) return fromFlat;
    return [{ iface: "", zone: "" }];
  }

  /** SFOS stores bridge MSS as { Override, MSSValue }; pick() on raw.MSS would stringify [object Object]. */
  function bridgeMssBlock(raw) {
    var m = raw && raw.MSS;
    if (m && typeof m === "object" && !Array.isArray(m)) return m;
    return null;
  }

  function bridgeMssOverrideEnabled(raw) {
    var m = bridgeMssBlock(raw);
    if (!m) return null;
    var o = m.Override != null ? String(m.Override).trim() : "";
    if (!o) return null;
    var lo = o.toLowerCase();
    if (lo === "enable" || lo === "enabled") return true;
    if (lo === "disable" || lo === "disabled") return false;
    return null;
  }

  function bridgeMssValue(raw) {
    var m = bridgeMssBlock(raw);
    if (m && m.MSSValue != null) {
      var inner = m.MSSValue;
      if (inner && typeof inner === "object" && !Array.isArray(inner) && inner["#text"] != null) {
        inner = inner["#text"];
      }
      var s = String(inner).trim();
      if (s) return s;
    }
    return "";
  }

  function detectRoutingKey(raw) {
    if (!raw || typeof raw !== "object") return "EnableRoutingOnBridge";
    var candidates = [
      "RoutingOnBridgePair",
      "EnableRoutingOnBridge",
      "RoutingOnBridge",
      "EnableBridgeRouting",
      "BridgeRouting",
      "RoutingEnabled",
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (Object.prototype.hasOwnProperty.call(raw, candidates[i])) return candidates[i];
    }
    return "EnableRoutingOnBridge";
  }

  var MEMBER_TRASH_SVG =
    '<svg class="gc-bridge-flyout__member-trash-svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4v-2h-3.5l-1-1h-5l-1 1H5v2h14zM8 9h8v10H8V9z"/></svg>';

  /** Build options with DOM APIs and set .value — innerHTML on <select> is unreliable in some browsers. */
  function populateMemberSelect(selectEl, currentValue, choiceList) {
    var cur = currentValue != null ? String(currentValue).trim() : "";
    var curLower = cur.toLowerCase();
    while (selectEl.firstChild) {
      selectEl.removeChild(selectEl.firstChild);
    }
    var optPlaceholder = document.createElement("option");
    optPlaceholder.value = "";
    optPlaceholder.textContent = "\u2014";
    selectEl.appendChild(optPlaceholder);

    for (var i = 0; i < choiceList.length; i++) {
      var ch = choiceList[i];
      var opt = document.createElement("option");
      opt.value = ch;
      opt.textContent = ch;
      selectEl.appendChild(opt);
    }

    if (cur) {
      var valueToSet = cur;
      for (var j = 0; j < choiceList.length; j++) {
        if (choiceList[j] === cur) {
          valueToSet = choiceList[j];
          break;
        }
      }
      if (valueToSet === cur) {
        for (var k = 0; k < choiceList.length; k++) {
          if (choiceList[k].toLowerCase() === curLower) {
            valueToSet = choiceList[k];
            break;
          }
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
      if (selectEl.value !== valueToSet) {
        optPlaceholder.value = valueToSet;
        optPlaceholder.textContent = valueToSet;
        optPlaceholder.selected = true;
      }
    } else {
      selectEl.selectedIndex = 0;
    }
  }

  function renderMemberRows(members) {
    var tb = els.membersTbody;
    if (!tb) return;
    var scopeOpts = { requireScope: memberScopeRequired };
    var ifaces = collectPhysicalInterfaceNamesScoped(memberScopeFw, memberScopeCfg, scopeOpts);
    var zones = collectZonesFromNetworkTablesScoped(memberScopeFw, memberScopeCfg, scopeOpts);
    var dataRows = (members || []).filter(memberRowHasValue);
    tb.innerHTML = "";

    function appendRow(m, isBlankRow) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-gc-bridge-member-row", "1");
      if (isBlankRow) tr.setAttribute("data-gc-bridge-member-blank", "1");

      var td1 = document.createElement("td");
      var sel1 = document.createElement("select");
      sel1.className =
        "gc-if-flyout__input gc-if-flyout__select gc-bridge-flyout__member-if gc-bridge-flyout__member-select";
      sel1.setAttribute("aria-label", isBlankRow ? "New member interface" : "Member interface");
      populateMemberSelect(sel1, m.iface, ifaces);

      var td2 = document.createElement("td");
      var sel2 = document.createElement("select");
      sel2.className =
        "gc-if-flyout__input gc-if-flyout__select gc-bridge-flyout__member-zone gc-bridge-flyout__member-select";
      sel2.setAttribute("aria-label", isBlankRow ? "New member zone" : "Member zone");
      populateMemberSelect(sel2, m.zone, zones);

      td1.appendChild(sel1);
      td2.appendChild(sel2);

      var td3 = document.createElement("td");
      var rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn-icon gc-bridge-flyout__member-remove";
      rm.innerHTML = MEMBER_TRASH_SVG;
      if (isBlankRow) {
        rm.disabled = true;
        rm.classList.add("gc-bridge-flyout__member-remove--blank");
        rm.setAttribute("aria-label", "New member row");
        rm.setAttribute("title", "Choose an interface or zone to add another row");
      } else {
        rm.setAttribute("aria-label", "Remove member");
        rm.setAttribute("title", "Remove");
        rm.addEventListener("click", function () {
          tr.remove();
          renderMemberRows(readMembersFromDom().filter(memberRowHasValue));
          syncDirty();
        });
      }
      td3.appendChild(rm);

      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tb.appendChild(tr);
    }

    dataRows.forEach(function (m) {
      appendRow(m, false);
    });
    appendRow({ iface: "", zone: "" }, true);
  }

  function readMembersFromDom() {
    var tb = els.membersTbody;
    if (!tb) return [];
    var out = [];
    tb.querySelectorAll("tr[data-gc-bridge-member-row]").forEach(function (tr) {
      var si = tr.querySelector(".gc-bridge-flyout__member-if");
      var sz = tr.querySelector(".gc-bridge-flyout__member-zone");
      out.push({
        iface: si ? si.value.trim() : "",
        zone: sz ? sz.value.trim() : "",
      });
    });
    return out;
  }

  function ipv4ModeValue() {
    if (els.ipv4Dhcp && els.ipv4Dhcp.checked) return "dhcp";
    return "static";
  }

  function guessBridgeIpv6Mode(raw) {
    var v = normLower(
      pick(raw, [
        "IPv6Assignment",
        "IPv6_Assignment",
        "IPv6AddressType",
        "IPv6ConnectionType",
      ]),
    );
    if (v.indexOf("delegat") !== -1) return "delegated";
    if (v.indexOf("dhcp") !== -1) return "dhcp";
    if (v.indexOf("static") !== -1) return "static";
    var ip = pick(raw, ["IPv6Address", "IPv6_Address"]);
    if (ip) return "static";
    return "static";
  }

  function bridgeIpv6ModeValue() {
    if (els.ipv6ModeStatic && els.ipv6ModeStatic.checked) return "static";
    if (els.ipv6ModeDhcp && els.ipv6ModeDhcp.checked) return "dhcp";
    if (els.ipv6ModeDel && els.ipv6ModeDel.checked) return "delegated";
    return "static";
  }

  /** Split addr/prefix on blur when user pastes CIDR into the IPv6 field. */
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

  function syncBridgeIpv6ModeUi() {
    if (!els.ipv6ModeDhcp) return;
    var mode = bridgeIpv6ModeValue();
    var ro = mode === "dhcp";
    [els.ipv6Ip, els.ipv6Prefix, els.ipv6GwName, els.ipv6GwIp].forEach(function (inp) {
      if (!inp) return;
      inp.readOnly = ro;
      inp.classList.toggle("gc-if-flyout__input--readonly", ro);
    });
  }

  /** Bridge flyout has no zone selector; show IPv6 gateway fields for static assignment only. */
  function syncBridgeIpv6GatewayWrap() {
    if (!els.ipv6GatewayWrap) return;
    var show = bridgeIpv6ModeValue() === "static";
    els.ipv6GatewayWrap.hidden = !show;
    els.ipv6GatewayWrap.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function clearBridgeIpv6Section() {
    if (els.ipv6ModeStatic) els.ipv6ModeStatic.checked = true;
    if (els.ipv6ModeDhcp) els.ipv6ModeDhcp.checked = false;
    if (els.ipv6ModeDel) els.ipv6ModeDel.checked = false;
    if (els.ipv6Ip) els.ipv6Ip.value = "";
    if (els.ipv6Prefix) els.ipv6Prefix.value = "";
    if (els.ipv6GwName) els.ipv6GwName.value = "";
    if (els.ipv6GwIp) els.ipv6GwIp.value = "";
  }

  function applyBridgeIpv6CheckboxOnLoad() {
    if (!els.ipv6Cb || !els.ipv6Ip) return;
    var staticMode = bridgeIpv6ModeValue() === "static";
    var blank = els.ipv6Ip.value.trim() === "";
    if (staticMode && blank) {
      clearBridgeIpv6Section();
      els.ipv6Cb.checked = false;
    }
    syncIpv6Body();
  }

  function collectBridgeForm() {
    var out = {};
    out.Name = els.nameInp ? els.nameInp.value.trim() : "";
    out.Hardware = els.hwInp ? els.hwInp.value.trim() : "";
    out.Description = els.descInp ? els.descInp.value.trim() : "";
    out[routingKeyUsed] = !!(els.routingCb && els.routingCb.checked);

    var members = readMembersFromDom().filter(memberRowHasValue);
    out.BridgeMembers = {
      Member: members.map(function (m) {
        return { Interface: m.iface, Zone: m.zone };
      }),
    };

    if (els.ipv4Cb && els.ipv4Cb.checked) {
      out.IPv4Assignment = ipv4ModeValue() === "dhcp" ? "DHCP" : "Static";
      out.IPAddress = els.ipv4Ip ? els.ipv4Ip.value.trim() : "";
      out.Netmask = els.ipv4Nm ? els.ipv4Nm.value.trim() : "";
    }

    out.FilterVLANs = !!(els.filterVlanCb && els.filterVlanCb.checked);
    out.PermittedVLANIDs = els.vlanIdsInp ? els.vlanIdsInp.value.trim() : "";

    out.PermitArpBroadcast = !!(els.arpCb && els.arpCb.checked);
    out.EnableSTP = !!(els.stpCb && els.stpCb.checked);
    out.STPMaxAge = els.stpMaxInp ? els.stpMaxInp.value.trim() : "";
    out.MACAging = els.macAgingInp ? els.macAgingInp.value.trim() : "";
    out.MTU = els.mtuInp ? els.mtuInp.value.trim() : "";
    out.OverrideMSS = !!(els.mssCb && els.mssCb.checked);
    out.MSS = els.mssInp ? els.mssInp.value.trim() : "";
    out.FilterEthernetFrames = !!(els.filterEthCb && els.filterEthCb.checked);
    out.ForwardedEthernetFrameTypes = els.ethTypesInp ? els.ethTypesInp.value.trim() : "";

    if (els.ipv6Cb && els.ipv6Cb.checked) {
      out.IPv6Enabled = true;
      var v6m = bridgeIpv6ModeValue();
      out.IPv6Assignment =
        v6m === "dhcp" ? "DHCP" : v6m === "delegated" ? "Delegated" : "Static";
      out.IPv6Address = els.ipv6Ip ? els.ipv6Ip.value.trim() : "";
      out.Prefix = els.ipv6Prefix ? els.ipv6Prefix.value.trim() : "";
      if (v6m === "static") {
        out.GatewayNameIpv6 = els.ipv6GwName ? els.ipv6GwName.value.trim() : "";
        out.GatewayIPv6 = els.ipv6GwIp ? els.ipv6GwIp.value.trim() : "";
      } else {
        out.GatewayNameIpv6 = "";
        out.GatewayIPv6 = "";
      }
    } else {
      out.IPv6Enabled = false;
    }

    return out;
  }

  function getFormSnapshot() {
    try {
      return JSON.stringify(collectBridgeForm());
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
    if (on) {
      syncBridgeIpv6ModeUi();
      syncBridgeIpv6GatewayWrap();
    } else if (els.ipv6GatewayWrap) {
      els.ipv6GatewayWrap.hidden = true;
      els.ipv6GatewayWrap.setAttribute("aria-hidden", "true");
    }
  }

  function syncAdv() {
    if (!els.advBody || !els.advToggle) return;
    var open = els.advToggle.getAttribute("aria-expanded") === "true";
    els.advBody.hidden = !open;
    els.advBody.setAttribute("aria-hidden", open ? "false" : "true");
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
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gc-if-flyout--open");
    addMode = false;
    currentNetRow = null;
    currentRaw = null;
    syncBridgeAddTargetRows();
  }

  function syncBridgeAddTargetRows() {
    var fwRow = document.getElementById("gc-bridge-flyout-target-fw-row");
    var cfgRow = document.getElementById("gc-bridge-flyout-target-cfg-row");
    var target = typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
    var showFw = !!(addMode && target === "firewall" && fwRow);
    var showCfg = !!(addMode && target === "configuration" && cfgRow);
    if (fwRow) {
      fwRow.hidden = !showFw;
      fwRow.setAttribute("aria-hidden", showFw ? "false" : "true");
    }
    if (cfgRow) {
      cfgRow.hidden = !showCfg;
      cfgRow.setAttribute("aria-hidden", showCfg ? "false" : "true");
    }
  }

  function fillBridgeAddTargetSelect(target) {
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

  function applyBridgeAddScopeFromSelectors() {
    if (!addMode) return;
    var target = typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
    memberScopeRequired = true;
    if (target === "firewall") {
      var fv = els.addFwSelect ? els.addFwSelect.value.trim() : "";
      var fn = parseInt(fv, 10);
      memberScopeFw = fv && !isNaN(fn) && fn > 0 ? fn : undefined;
      memberScopeCfg = undefined;
    } else {
      var cv = els.addCfgSelect ? els.addCfgSelect.value.trim() : "";
      var cn = parseInt(cv, 10);
      memberScopeCfg = cv && !isNaN(cn) && cn > 0 ? cn : undefined;
      memberScopeFw = undefined;
    }
  }

  function onBridgeAddTargetChange() {
    applyBridgeAddScopeFromSelectors();
    renderMemberRows(readMembersFromDom().filter(memberRowHasValue));
    syncDirty();
  }

  function populateFromRow(row) {
    addMode = false;
    memberScopeRequired = false;
    memberScopeFw =
      row && row.firewall_id != null && row.firewall_id !== "" ? Number(row.firewall_id) : undefined;
    memberScopeCfg =
      row && row.configuration_id != null && row.configuration_id !== "" ? Number(row.configuration_id) : undefined;
    syncBridgeAddTargetRows();
    currentNetRow = row || null;
    var raw = (row && row.raw_payload) || {};
    currentRaw = raw;
    routingKeyUsed = detectRoutingKey(raw);
    if (els.title) els.title.textContent = "Edit bridge pair";

    if (els.nameInp) els.nameInp.value = pick(raw, ["Name"]) || String((row && row.cells && row.cells.__name) || "").trim();
    if (els.hwInp) els.hwInp.value = pick(raw, ["Hardware"]) || String((row && row.cells && row.cells.__hardware) || "").trim();
    if (els.descInp) els.descInp.value = pick(raw, ["Description"]);

    var rt = truthyRaw(raw, [
      routingKeyUsed,
      "RoutingOnBridgePair",
      "EnableRoutingOnBridge",
      "RoutingOnBridge",
      "EnableBridgeRouting",
    ]);
    if (els.routingCb) els.routingCb.checked = rt === true;

    renderMemberRows(resolveMemberRowsForEdit(row, raw));

    var v4 = normLower(pick(raw, ["IPv4Assignment", "AddressType", "IPv4AddressType"]));
    if (els.ipv4Dhcp) els.ipv4Dhcp.checked = v4.indexOf("dhcp") !== -1;
    if (els.ipv4Static) els.ipv4Static.checked = v4.indexOf("dhcp") === -1;
    if (els.ipv4Ip) els.ipv4Ip.value = pick(raw, ["IPAddress", "IPv4Address"]);
    if (els.ipv4Nm) {
      els.ipv4Nm.value = window.gcNetIpv4FlyoutBlur.netmaskToDisplay(pick(raw, ["Netmask", "IPv4Netmask"]));
    }
    var hasV4 = !!(pick(raw, ["IPAddress"]) || v4);
    if (els.ipv4Cb) els.ipv4Cb.checked = hasV4 || truthyRaw(raw, ["IPv4Enabled"]) === true;
    syncIpv4Body();

    var v6 = guessBridgeIpv6Mode(raw);
    if (els.ipv6ModeStatic) els.ipv6ModeStatic.checked = v6 === "static";
    if (els.ipv6ModeDhcp) els.ipv6ModeDhcp.checked = v6 === "dhcp";
    if (els.ipv6ModeDel) els.ipv6ModeDel.checked = v6 === "delegated";
    if (els.ipv6Ip) els.ipv6Ip.value = pick(raw, ["IPv6Address", "IPv6_Address"]);
    if (els.ipv6Prefix) {
      els.ipv6Prefix.value = pick(raw, ["Prefix", "IPv6PrefixLength", "IPv6Prefix", "PrefixLength"]) || "64";
    }
    if (els.ipv6GwName) els.ipv6GwName.value = pick(raw, ["GatewayNameIpv6", "IPv6GatewayName", "IPv6_GatewayName"]);
    if (els.ipv6GwIp) {
      els.ipv6GwIp.value = pick(raw, ["GatewayIPv6", "IPv6Gateway", "IPv6_Gateway", "IPv6DefaultGateway"]);
    }
    var v6OnExplicit = truthyRaw(raw, ["IPv6Enabled"]);
    var hasV6Addr = !!(pick(raw, ["IPv6Address", "IPv6_Address"]) || "").trim();
    if (els.ipv6Cb) {
      els.ipv6Cb.checked = v6OnExplicit === true || (v6OnExplicit !== false && hasV6Addr);
    }
    applyBridgeIpv6CheckboxOnLoad();

    if (els.filterVlanCb) els.filterVlanCb.checked = truthyRaw(raw, ["FilterVLANs", "VLANFiltering"]) === true;
    if (els.vlanIdsInp) els.vlanIdsInp.value = pick(raw, ["PermittedVLANIDs", "PermittedVLANId", "VLANPermitted"]);

    if (els.arpCb) {
      var arp = truthyRaw(raw, ["PermitArpBroadcast", "ARPBroadcast"]);
      els.arpCb.checked = arp !== false;
    }
    if (els.stpCb) els.stpCb.checked = truthyRaw(raw, ["EnableSTP", "STPEnabled", "SpanningTree"]) === true;
    if (els.stpMaxInp) els.stpMaxInp.value = pick(raw, ["STPMaxAge", "STPMaxAgeSeconds", "MAXAge"]) || "20";
    if (els.macAgingInp) els.macAgingInp.value = pick(raw, ["MACAging", "MacAgingSeconds"]) || "300";
    if (els.mtuInp) els.mtuInp.value = pick(raw, ["MTU"]) || "1500";
    var mssOv = bridgeMssOverrideEnabled(raw);
    if (els.mssCb)
      els.mssCb.checked =
        mssOv === true || (mssOv === null && truthyRaw(raw, ["OverrideMSS", "MSSOverride"]) === true);
    if (els.mssInp) els.mssInp.value = bridgeMssValue(raw) || "1460";
    if (els.filterEthCb) els.filterEthCb.checked = truthyRaw(raw, ["FilterEthernetFrames"]) === true;
    if (els.ethTypesInp) els.ethTypesInp.value = pick(raw, ["ForwardedEthernetFrameTypes", "EthernetFrameTypes"]);

    setInitialSnapshot();
  }

  function populateAdd() {
    addMode = true;
    currentNetRow = null;
    currentRaw = {};
    routingKeyUsed = "RoutingOnBridgePair";
    memberScopeRequired = true;
    memberScopeFw = undefined;
    memberScopeCfg = undefined;
    var target = typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
    syncBridgeAddTargetRows();
    fillBridgeAddTargetSelect(target);
    if (els.title) els.title.textContent = "Add bridge pair";
    if (els.nameInp) els.nameInp.value = "";
    if (els.hwInp) els.hwInp.value = "";
    if (els.descInp) els.descInp.value = "";
    if (els.routingCb) els.routingCb.checked = false;
    renderMemberRows([]);
    if (els.ipv4Static) els.ipv4Static.checked = true;
    if (els.ipv4Dhcp) els.ipv4Dhcp.checked = false;
    if (els.ipv4Ip) els.ipv4Ip.value = "";
    if (els.ipv4Nm) els.ipv4Nm.value = "";
    if (els.ipv4Cb) els.ipv4Cb.checked = false;
    syncIpv4Body();
    clearBridgeIpv6Section();
    if (els.ipv6Cb) els.ipv6Cb.checked = false;
    syncIpv6Body();
    if (els.filterVlanCb) els.filterVlanCb.checked = false;
    if (els.vlanIdsInp) els.vlanIdsInp.value = "";
    if (els.arpCb) els.arpCb.checked = true;
    if (els.stpCb) els.stpCb.checked = false;
    if (els.stpMaxInp) els.stpMaxInp.value = "20";
    if (els.macAgingInp) els.macAgingInp.value = "300";
    if (els.mtuInp) els.mtuInp.value = "1500";
    if (els.mssCb) els.mssCb.checked = false;
    if (els.mssInp) els.mssInp.value = "1460";
    if (els.filterEthCb) els.filterEthCb.checked = false;
    if (els.ethTypesInp) els.ethTypesInp.value = "";
    setInitialSnapshot();
  }

  function bindPanelResize(root) {
    var panel = root.querySelector(".gc-if-flyout__panel");
    var handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset.gcBridgeResizeBound === "1") return;
    handle.dataset.gcBridgeResizeBound = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var startX = e.clientX;
      var startW = panel.getBoundingClientRect().width;
      var maxW = Math.min(900, window.innerWidth - 24);
      function onMove(e2) {
        var w = startW + (startX - e2.clientX);
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

  function cacheEls(root) {
    els = {
      root: root,
      title: root.querySelector("#gc-bridge-flyout-title"),
      nameInp: root.querySelector("#gc-bridge-flyout-name"),
      hwInp: root.querySelector("#gc-bridge-flyout-hardware"),
      descInp: root.querySelector("#gc-bridge-flyout-description"),
      routingCb: root.querySelector("#gc-bridge-flyout-routing"),
      membersTbody: root.querySelector("#gc-bridge-flyout-members-tbody"),
      ipv4Cb: root.querySelector("#gc-bridge-flyout-ipv4-enabled"),
      ipv4Body: root.querySelector("#gc-bridge-flyout-ipv4-body"),
      ipv4Static: root.querySelector('input[name="gc-bridge-ipv4-mode"][value="static"]'),
      ipv4Dhcp: root.querySelector('input[name="gc-bridge-ipv4-mode"][value="dhcp"]'),
      ipv4Ip: root.querySelector("#gc-bridge-flyout-ipv4-ip"),
      ipv4Nm: root.querySelector("#gc-bridge-flyout-ipv4-netmask"),
      ipv6Cb: root.querySelector("#gc-bridge-flyout-ipv6-enabled"),
      ipv6Body: root.querySelector("#gc-bridge-flyout-ipv6-body"),
      ipv6ModeStatic: root.querySelector('input[name="gc-bridge-ipv6-mode"][value="static"]'),
      ipv6ModeDhcp: root.querySelector('input[name="gc-bridge-ipv6-mode"][value="dhcp"]'),
      ipv6ModeDel: root.querySelector('input[name="gc-bridge-ipv6-mode"][value="delegated"]'),
      ipv6Ip: root.querySelector("#gc-bridge-flyout-ipv6-ip"),
      ipv6Prefix: root.querySelector("#gc-bridge-flyout-ipv6-prefix"),
      ipv6GwName: root.querySelector("#gc-bridge-flyout-ipv6-gw-name"),
      ipv6GwIp: root.querySelector("#gc-bridge-flyout-ipv6-gw-ip"),
      ipv6GatewayWrap: root.querySelector("#gc-bridge-flyout-ipv6-gateway-wrap"),
      filterVlanCb: root.querySelector("#gc-bridge-flyout-filter-vlan"),
      vlanIdsInp: root.querySelector("#gc-bridge-flyout-vlan-ids"),
      advToggle: root.querySelector("#gc-bridge-flyout-adv-toggle"),
      advBody: root.querySelector("#gc-bridge-flyout-adv-body"),
      arpCb: root.querySelector("#gc-bridge-flyout-arp"),
      stpCb: root.querySelector("#gc-bridge-flyout-stp"),
      stpMaxInp: root.querySelector("#gc-bridge-flyout-stp-max"),
      macAgingInp: root.querySelector("#gc-bridge-flyout-mac-aging"),
      mtuInp: root.querySelector("#gc-bridge-flyout-mtu"),
      mssCb: root.querySelector("#gc-bridge-flyout-mss-cb"),
      mssInp: root.querySelector("#gc-bridge-flyout-mss"),
      filterEthCb: root.querySelector("#gc-bridge-flyout-filter-eth"),
      ethTypesInp: root.querySelector("#gc-bridge-flyout-eth-types"),
      saveBtn: root.querySelector("#gc-bridge-flyout-save"),
      cancelBtn: root.querySelector("#gc-bridge-flyout-cancel"),
      form: root.querySelector("#gc-bridge-flyout-form"),
      addFwSelect: root.querySelector("#gc-bridge-flyout-add-firewall"),
      addCfgSelect: root.querySelector("#gc-bridge-flyout-add-configuration"),
    };
  }

  function bind(root) {
    if (root.dataset.gcBridgeFlyoutBound === "1") return;
    root.dataset.gcBridgeFlyoutBound = "1";
    cacheEls(root);
    bindPanelResize(root);

    if (els.membersTbody) {
      els.membersTbody.addEventListener("change", function (e) {
        var t = e.target;
        if (!t || typeof t.matches !== "function") return;
        if (!t.matches(".gc-bridge-flyout__member-if, .gc-bridge-flyout__member-zone")) return;
        var tr = t.closest("tr[data-gc-bridge-member-row]");
        if (!tr) return;
        var isBlank = tr.getAttribute("data-gc-bridge-member-blank") === "1";
        var si = tr.querySelector(".gc-bridge-flyout__member-if");
        var sz = tr.querySelector(".gc-bridge-flyout__member-zone");
        var has = (si && si.value.trim()) || (sz && sz.value.trim());
        if (isBlank && has) {
          renderMemberRows(readMembersFromDom().filter(memberRowHasValue));
          syncDirty();
          return;
        }
        if (!isBlank && !has) {
          renderMemberRows(readMembersFromDom().filter(memberRowHasValue));
          syncDirty();
          return;
        }
        syncDirty();
      });
    }
    if (els.addFwSelect) els.addFwSelect.addEventListener("change", onBridgeAddTargetChange);
    if (els.addCfgSelect) els.addCfgSelect.addEventListener("change", onBridgeAddTargetChange);
    if (els.ipv4Cb) els.ipv4Cb.addEventListener("change", syncIpv4Body);
    if (els.ipv4Ip) {
      els.ipv4Ip.addEventListener("blur", function () {
        window.gcNetIpv4FlyoutBlur.applyCidrSplit(els, syncDirty);
      });
    }
    if (els.ipv4Nm) {
      els.ipv4Nm.addEventListener("blur", function () {
        window.gcNetIpv4FlyoutBlur.applyNetmaskNormalize(els, syncDirty);
      });
    }

    function onBridgeIpv6Toggle() {
      if (els.ipv6Cb && !els.ipv6Cb.checked) {
        clearBridgeIpv6Section();
      } else if (els.ipv6Cb && els.ipv6Cb.checked) {
        if (bridgeIpv6ModeValue() === "static" && els.ipv6Ip && els.ipv6Ip.value.trim() === "") {
          if (els.ipv6ModeDhcp) els.ipv6ModeDhcp.checked = true;
          if (els.ipv6ModeStatic) els.ipv6ModeStatic.checked = false;
          if (els.ipv6ModeDel) els.ipv6ModeDel.checked = false;
        }
      }
      syncIpv6Body();
      syncDirty();
    }
    if (els.ipv6Cb) els.ipv6Cb.addEventListener("change", onBridgeIpv6Toggle);
    root.querySelectorAll('input[name="gc-bridge-ipv6-mode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        syncBridgeIpv6ModeUi();
        syncBridgeIpv6GatewayWrap();
        syncDirty();
      });
    });
    if (els.ipv6Ip) {
      els.ipv6Ip.addEventListener("blur", tryApplyIpv6CidrOnBlur);
    }

    if (els.advToggle) {
      els.advToggle.addEventListener("click", function () {
        var open = els.advToggle.getAttribute("aria-expanded") === "true";
        els.advToggle.setAttribute("aria-expanded", open ? "false" : "true");
        syncAdv();
      });
    }
    syncAdv();

    if (els.cancelBtn) {
      els.cancelBtn.addEventListener("click", function () {
        close(root);
      });
    }
    if (els.form) {
      els.form.addEventListener("input", syncDirty);
      els.form.addEventListener("change", syncDirty);
      els.form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (els.saveBtn && els.saveBtn.disabled) return;

        var target =
          typeof window.gcNetVlanEntityTarget === "string" ? window.gcNetVlanEntityTarget : "firewall";
        var rowBr = currentNetRow;
        var isCfg =
          target === "configuration" ||
          !!(
            rowBr &&
            (rowBr.configuration_id != null || rowBr.scope === "configuration")
          );

        if (addMode) {
          var createUrl = isCfg
            ? typeof window.gcNetBridgePairApplyCreateUrl === "string"
              ? window.gcNetBridgePairApplyCreateUrl
              : ""
            : typeof window.gcNetBridgePairEnqueueCreateUrl === "string"
              ? window.gcNetBridgePairEnqueueCreateUrl
              : "";
          if (!createUrl) {
            alert(
              isCfg
                ? "Bridge pair create URL is not configured."
                : "Bridge pair queue-create URL is not configured.",
            );
            return;
          }
          if (isCfg) {
            var cfgIdSel = els.addCfgSelect ? parseInt(els.addCfgSelect.value.trim(), 10) : NaN;
            if (!els.addCfgSelect || !els.addCfgSelect.value.trim() || isNaN(cfgIdSel) || cfgIdSel <= 0) {
              alert("Select a configuration.");
              return;
            }
          } else {
            var fwIdSel = els.addFwSelect ? parseInt(els.addFwSelect.value.trim(), 10) : NaN;
            if (!els.addFwSelect || !els.addFwSelect.value.trim() || isNaN(fwIdSel) || fwIdSel <= 0) {
              alert("Select a firewall.");
              return;
            }
          }
          var hw = els.hwInp ? els.hwInp.value.trim() : "";
          if (!hw) {
            alert("Hardware name is required.");
            return;
          }
          if (hw.length > 10) {
            alert("Hardware must be at most 10 characters.");
            return;
          }
          if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(hw)) {
            alert(
              "Hardware must start with a letter and contain only letters, digits, and underscores.",
            );
            return;
          }
          var nm = els.nameInp ? els.nameInp.value.trim() : "";
          if (nm.length > 58) {
            alert("Name must be at most 58 characters.");
            return;
          }
          var dsc = els.descInp ? els.descInp.value.trim() : "";
          if (dsc.length > 100) {
            alert("Description must be at most 100 characters.");
            return;
          }
          var mems = readMembersFromDom().filter(memberRowHasValue);
          if (mems.length < 2) {
            alert("Add at least two member interfaces, each with a zone.");
            return;
          }
          for (var mi = 0; mi < mems.length; mi++) {
            if (!mems[mi].iface || !mems[mi].zone) {
              alert("Each member needs an interface and a zone.");
              return;
            }
          }
          if (els.saveBtn) els.saveBtn.disabled = true;
          function finishBridgePairCreateError(msg) {
            alert(typeof msg === "string" ? msg : JSON.stringify(msg));
            if (els.saveBtn) els.saveBtn.disabled = false;
            syncDirty();
          }
          function runBridgePairCreateRequest(force) {
            var payloadObj = isCfg
              ? { configuration_id: cfgIdSel, form: collectBridgeForm() }
              : (function () {
                  var o = { firewall_id: fwIdSel, form: collectBridgeForm() };
                  if (force) o.force = true;
                  return o;
                })();
            return fetch(createUrl, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payloadObj),
            }).then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, status: r.status, j: j };
              });
            });
          }
          function detailMessage(j, fallback) {
            var d = j && j.detail;
            if (typeof d === "string") return d;
            if (d && typeof d.message === "string") return d.message;
            if (j && typeof j.message === "string") return j.message;
            return fallback;
          }
          runBridgePairCreateRequest(false)
            .then(function (x) {
              if (!x.ok) {
                var d = x.j && x.j.detail;
                var code = typeof d === "object" && d && d.code;
                var msg = detailMessage(x.j, "Could not add bridge pair.");
                if (!isCfg && x.status === 409 && code === "bridge_pair_cache_conflict") {
                  var q =
                    msg +
                    "\n\nQueue this add anyway? Choose OK to proceed, or Cancel to stop.";
                  if (window.confirm(q)) {
                    return runBridgePairCreateRequest(true).then(function (x2) {
                      if (!x2.ok) {
                        finishBridgePairCreateError(detailMessage(x2.j, "Could not add bridge pair."));
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
                finishBridgePairCreateError(msg);
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
          ? typeof window.gcNetBridgePairApplyUrl === "string"
            ? window.gcNetBridgePairApplyUrl
            : ""
          : typeof window.gcNetBridgePairEnqueueUrl === "string"
            ? window.gcNetBridgePairEnqueueUrl
            : "";
        var cid = currentNetRow && currentNetRow.config_entry_id;
        if (!url || cid == null) {
          alert(
            isCfg
              ? "Bridge pair save URL is not configured or the row is missing a config entry id."
              : "Task queue URL is not configured or the row is missing a config entry id.",
          );
          return;
        }
        var payload = JSON.stringify({
          config_entry_id: cid,
          form: collectBridgeForm(),
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
      });
    }
  }

  window.gcNetBridgePairFlyoutInit = function () {
    var root = document.getElementById("gc-net-bridge-pair-flyout");
    if (!root) return;
    bind(root);
  };

  window.gcNetBridgePairFlyoutOpenFromTr = function (tr) {
    var row = tr && tr._gcNetRow;
    if (!row || row.entity_type !== "bridge_pair") return;
    var root = document.getElementById("gc-net-bridge-pair-flyout");
    if (!root) return;
    bind(root);
    populateFromRow(row);
    open(root);
  };

  window.gcNetBridgePairFlyoutOpenAdd = function () {
    var root = document.getElementById("gc-net-bridge-pair-flyout");
    if (!root) return;
    bind(root);
    populateAdd();
    open(root);
  };
})();
