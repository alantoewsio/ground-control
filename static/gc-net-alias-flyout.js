/**
 * Interface alias add/edit flyout (Firewalls · Network & Configuration · Network).
 */
(function () {
  "use strict";

  var initialFormSnapshot = "";
  var currentNetRow = null;
  var addMode = false;
  var els = {};
  var ifacePayloadByName = {};
  var ifaceAddressHintByValue = {};

  function ifTbodyId() {
    var p = (typeof window.gcNetVlanIfPrefix === "string" && window.gcNetVlanIfPrefix) || "gc-net-if";
    return p + "-tbody";
  }

  function normLower(s) {
    return String(s || "").trim().toLowerCase();
  }

  function truthySophosFlag(x) {
    var s = normLower(x);
    return s === "enable" || s === "enabled" || s === "1" || s === "true" || s === "on";
  }

  function ifaceIpFlags(raw) {
    if (!raw || typeof raw !== "object") return { v4: true, v6: true };
    return {
      v4: truthySophosFlag(raw.IPv4Configuration),
      v6: truthySophosFlag(raw.IPv6Configuration),
    };
  }

  function markSet(obj, s) {
    s = String(s || "").trim();
    if (s) obj[s] = true;
  }

  function rowIdentityKeys(row) {
    var cells = (row && row.cells) || {};
    var raw = (row && row.raw_payload) || {};
    var flat = (row && row.flat) || {};
    var o = {};
    markSet(o, cells.__name);
    markSet(o, cells.__hardware);
    markSet(o, raw.Hardware);
    markSet(o, flat.Hardware);
    return o;
  }

  function rowTouchesExcludedSet(row, excluded) {
    if (!excluded || row.entity_type !== "interface") return false;
    var keys = rowIdentityKeys(row);
    for (var k in keys) {
      if (excluded[k]) return true;
    }
    return false;
  }

  function collectBridgeMemberIfaces(raw) {
    var out = [];
    if (!raw || typeof raw !== "object") return out;
    var bm = raw.BridgeMembers;
    if (!bm || typeof bm !== "object") return out;
    var members = bm.Member;
    var arr = Array.isArray(members) ? members : members ? [members] : [];
    arr.forEach(function (m) {
      if (!m || typeof m !== "object") return;
      var iface = m.Interface != null ? String(m.Interface).trim() : "";
      if (iface) out.push(iface);
    });
    return out;
  }

  function collectLagMemberIfaces(raw) {
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

  function isLagInterfaceRaw(raw) {
    return collectLagMemberIfaces(raw).length > 0;
  }

  function collectBridgeLagMemberExclusionsScoped(fwId, cfgId, opts) {
    var require = opts && opts.requireScope;
    var wantFw = fwId != null && fwId !== "" && !isNaN(Number(fwId));
    var wantCfg = cfgId != null && cfgId !== "" && !isNaN(Number(cfgId));
    if (require && !wantFw && !wantCfg) return {};
    var excluded = {};
    var tbody = document.getElementById(ifTbodyId());
    if (!tbody) return excluded;
    tbody.querySelectorAll("tr[class*='-data-row'], tr.gc-net-entity-row--clickable").forEach(function (tr) {
      var row = tr._gcNetRow;
      if (!row) return;
      if (!rowMatchesNetScope(row, fwId, cfgId)) return;
      var raw = row.raw_payload || {};
      if (row.entity_type === "bridge_pair") {
        collectBridgeMemberIfaces(raw).forEach(function (n) {
          markSet(excluded, n);
        });
      } else if (row.entity_type === "lag") {
        collectLagMemberIfaces(raw).forEach(function (n) {
          markSet(excluded, n);
        });
      } else if (row.entity_type === "interface" && isLagInterfaceRaw(raw)) {
        collectLagMemberIfaces(raw).forEach(function (n) {
          markSet(excluded, n);
        });
      }
    });
    return excluded;
  }

  function hasMeaningfulZone(row) {
    var z = String((row.cells && row.cells.__zone) || "").trim();
    if (!z) return false;
    if (normLower(z) === "none") return false;
    return true;
  }

  function aliasParentConfigured(row) {
    var cells = (row && row.cells) || {};
    var raw = (row && row.raw_payload) || {};
    var addr = String(cells.__address_cidr != null ? cells.__address_cidr : "").trim();
    var fl = ifaceIpFlags(raw);
    if (hasMeaningfulZone(row)) return true;
    if (addr) return true;
    if (fl.v4 || fl.v6) return true;
    return false;
  }

  function aliasParentSelectValue(row) {
    var cells = (row && row.cells) || {};
    var raw = (row && row.raw_payload) || {};
    var flat = (row && row.flat) || {};
    var nm = String(cells.__name != null ? cells.__name : "").trim();
    var hw = raw.Hardware != null ? String(raw.Hardware).trim() : "";
    if (!hw) hw = String(flat.Hardware != null ? flat.Hardware : "").trim();
    if (!hw) hw = String(cells.__hardware != null ? cells.__hardware : "").trim();
    var et = row.entity_type;
    if (et === "bridge_pair" || et === "lag") return hw || nm;
    if (et === "interface" && isLagInterfaceRaw(raw)) return hw || nm;
    return nm;
  }

  function aliasParentOptionLabel(row) {
    var cells = (row && row.cells) || {};
    var nm = String(cells.__name != null ? cells.__name : "").trim();
    var z = String(cells.__zone != null ? cells.__zone : "").trim();
    if (normLower(z) === "none") z = "";
    var val = aliasParentSelectValue(row);
    var head = nm;
    if (nm && val && nm !== val) head = nm + " (" + val + ")";
    else if (!nm && val) head = val;
    var parts = [];
    if (head) parts.push(head);
    if (z) parts.push(z);
    return parts.join(" — ") || val || "";
  }

  function escapeOptionDisplay(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function findParentOptionLabelFromTable(parentValue, fwId, cfgId) {
    var tbody = document.getElementById(ifTbodyId());
    if (!tbody || !parentValue) return "";
    var want = String(parentValue).trim();
    var found = "";
    tbody.querySelectorAll("tr[class*='-data-row'], tr.gc-net-entity-row--clickable").forEach(function (tr) {
      if (found) return;
      var row = tr._gcNetRow;
      if (!row) return;
      if (!rowMatchesNetScope(row, fwId, cfgId)) return;
      if (
        row.entity_type !== "interface" &&
        row.entity_type !== "bridge_pair" &&
        row.entity_type !== "lag"
      )
        return;
      var pv = aliasParentSelectValue(row);
      var nm = String((row.cells && row.cells.__name) || "").trim();
      if (pv !== want && nm !== want) return;
      found = aliasParentOptionLabel(row);
    });
    return found;
  }

  function findAddressHintForParentFromTable(parentName, fwId, cfgId) {
    var tbody = document.getElementById(ifTbodyId());
    if (!tbody || !parentName) return "";
    var want = String(parentName).trim();
    var found = "";
    tbody.querySelectorAll("tr[class*='-data-row'], tr.gc-net-entity-row--clickable").forEach(function (tr) {
      if (found) return;
      var row = tr._gcNetRow;
      if (!row) return;
      if (!rowMatchesNetScope(row, fwId, cfgId)) return;
      if (
        row.entity_type !== "interface" &&
        row.entity_type !== "bridge_pair" &&
        row.entity_type !== "lag"
      )
        return;
      var pv = aliasParentSelectValue(row);
      var nm = String((row.cells && row.cells.__name) || "").trim();
      if (pv !== want && nm !== want) return;
      found = formatParentAddressHint(row);
    });
    return found;
  }

  function formatParentAddressHint(row) {
    var cells = (row && row.cells) || {};
    var raw = (row && row.raw_payload) || {};
    var flat = (row && row.flat) || {};
    var s = String(cells.__address_cidr != null ? cells.__address_cidr : "").trim();
    if (!s) {
      var parts = [];
      var ip4 =
        (flat.IPAddress && String(flat.IPAddress).trim()) ||
        (flat.IPv4Address && String(flat.IPv4Address).trim()) ||
        (raw.IPAddress != null ? String(raw.IPAddress).trim() : "") ||
        (raw.IPv4Address != null ? String(raw.IPv4Address).trim() : "");
      var nm = (flat.Netmask && String(flat.Netmask).trim()) || (raw.Netmask != null ? String(raw.Netmask).trim() : "");
      if (ip4 && nm) parts.push(ip4 + "/" + nm);
      else if (ip4) parts.push(ip4);
      var ip6 =
        (flat.IPv6Address && String(flat.IPv6Address).trim()) ||
        (flat.IPv6 && String(flat.IPv6).trim()) ||
        (raw.IPv6Address != null ? String(raw.IPv6Address).trim() : "") ||
        (raw.IPv6 != null ? String(raw.IPv6).trim() : "");
      var pfx =
        (flat.Prefix && String(flat.Prefix).trim()) || (raw.Prefix != null ? String(raw.Prefix).trim() : "");
      if (ip6 && pfx) parts.push(ip6 + "/" + pfx);
      else if (ip6) parts.push(ip6);
      s = parts.length ? parts.join(" · ") : "";
    }
    if (!s) return "";
    var chunks = s.split(/\s*·\s*/);
    var v4 = [];
    var v6 = [];
    chunks.forEach(function (p) {
      p = p.trim();
      if (!p) return;
      if (p.indexOf(":") >= 0) v6.push(p);
      else v4.push(p);
    });
    var lines = [];
    if (v4.length) lines.push("IPv4: " + v4.join(", "));
    if (v6.length) lines.push("IPv6: " + v6.join(", "));
    return lines.length ? lines.join("\n") : s;
  }

  function rowMatchesNetScope(row, fwId, cfgId) {
    var wantFw = fwId != null && fwId !== "" && !isNaN(Number(fwId));
    var wantCfg = cfgId != null && cfgId !== "" && !isNaN(Number(cfgId));
    if (!wantFw && !wantCfg) return true;
    if (wantFw && (row.firewall_id == null || Number(row.firewall_id) !== Number(fwId))) return false;
    if (wantCfg && (row.configuration_id == null || Number(row.configuration_id) !== Number(cfgId))) return false;
    return true;
  }

  function collectAliasParentChoicesScoped(fwId, cfgId, opts) {
    var require = opts && opts.requireScope;
    var wantFw = fwId != null && fwId !== "" && !isNaN(Number(fwId));
    var wantCfg = cfgId != null && cfgId !== "" && !isNaN(Number(cfgId));
    if (require && !wantFw && !wantCfg) return [];
    var excluded = collectBridgeLagMemberExclusionsScoped(fwId, cfgId, opts);
    var tbody = document.getElementById(ifTbodyId());
    if (!tbody) return [];
    var byVal = {};
    tbody.querySelectorAll("tr[class*='-data-row'], tr.gc-net-entity-row--clickable").forEach(function (tr) {
      var row = tr._gcNetRow;
      if (!row) return;
      if (!rowMatchesNetScope(row, fwId, cfgId)) return;
      var et = row.entity_type;
      if (et !== "interface" && et !== "bridge_pair" && et !== "lag") return;
      if (!aliasParentConfigured(row)) return;
      if (et === "interface") {
        if (rowTouchesExcludedSet(row, excluded)) return;
        if (!isLagInterfaceRaw(row.raw_payload || {}) && !String((row.cells && row.cells.__name) || "").trim()) return;
      } else if (et === "bridge_pair" || et === "lag") {
        if (!String((row.cells && row.cells.__name) || "").trim() && !aliasParentSelectValue(row)) return;
      }
      var val = aliasParentSelectValue(row);
      if (!val) return;
      if (!byVal[val]) {
        byVal[val] = {
          value: val,
          label: aliasParentOptionLabel(row),
          raw: row.raw_payload || {},
          hintRow: row,
        };
      }
    });
    var out = [];
    for (var k in byVal) {
      if (Object.prototype.hasOwnProperty.call(byVal, k)) out.push(byVal[k]);
    }
    out.sort(function (a, b) {
      var la = String(a.label || a.value || "");
      var lb = String(b.label || b.value || "");
      var c = la.localeCompare(lb, undefined, { sensitivity: "base" });
      if (c !== 0) return c;
      return String(a.value).localeCompare(String(b.value), undefined, { sensitivity: "base" });
    });
    return out;
  }

  function aliasScopeForPickers() {
    if (!addMode) {
      var r = currentNetRow;
      return {
        fwId: r && r.firewall_id != null && r.firewall_id !== "" ? Number(r.firewall_id) : undefined,
        cfgId: r && r.configuration_id != null && r.configuration_id !== "" ? Number(r.configuration_id) : undefined,
        requireScope: false,
      };
    }
    var target =
      typeof window.gcNetAliasEntityTarget === "string" ? window.gcNetAliasEntityTarget : "firewall";
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

  function fillAddTargetSelects() {
    var target =
      typeof window.gcNetAliasEntityTarget === "string" ? window.gcNetAliasEntityTarget : "firewall";
    if (target === "firewall" && els.addFwSelect) {
      var inv =
        typeof window.gcGetFirewallNavInventory === "function" ? window.gcGetFirewallNavInventory() : [];
      els.addFwSelect.innerHTML =
        '<option value="">Select firewall…</option>' +
        inv
          .map(function (x) {
            return (
              '<option value="' +
              String(x.id).replace(/"/g, "&quot;") +
              '">' +
              String(x.label || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;") +
              "</option>"
            );
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
            return (
              '<option value="' +
              String(x.id).replace(/"/g, "&quot;") +
              '">' +
              String(x.label || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;") +
              "</option>"
            );
          })
          .join("");
      els.addCfgSelect.value = "";
    }
  }

  function prefixToDotted(prefix) {
    var p = Number(prefix);
    if (p !== p || p < 0 || p > 32) return null;
    var low = p === 32 ? 0 : Math.pow(2, 32 - p) - 1;
    var mask = (4294967295 ^ low) >>> 0;
    return [(mask >>> 24) & 255, (mask >>> 16) & 255, (mask >>> 8) & 255, mask & 255].join(".");
  }

  function buildNetmaskSelect(sel) {
    if (!sel) return;
    var parts = [];
    for (var i = 32; i >= 8; i--) {
      var d = prefixToDotted(i);
      if (!d) continue;
      parts.push(
        '<option value="' +
        d +
        '">/' +
        i +
        " (" +
        d +
        ")</option>",
      );
    }
    sel.innerHTML = parts.join("");
    sel.value = "255.255.255.0";
  }

  function netmaskToDisplay(nm) {
    if (window.gcNetIpv4FlyoutBlur && typeof window.gcNetIpv4FlyoutBlur.netmaskToDisplay === "function") {
      return window.gcNetIpv4FlyoutBlur.netmaskToDisplay(nm);
    }
    return String(nm || "").trim();
  }

  function fillInterfaceSelect(forAdd) {
    if (!els.ifaceSelect) return;
    var sc = aliasScopeForPickers();
    var choices = collectAliasParentChoicesScoped(sc.fwId, sc.cfgId, {
      requireScope: forAdd ? sc.requireScope : false,
    });
    ifacePayloadByName = {};
    ifaceAddressHintByValue = {};
    var opts = [];
    choices.forEach(function (c) {
      ifacePayloadByName[c.value] = c.raw;
      ifaceAddressHintByValue[c.value] = formatParentAddressHint(c.hintRow);
      opts.push(
        '<option value="' +
        String(c.value).replace(/"/g, "&quot;") +
        '">' +
        escapeOptionDisplay(c.label || c.value) +
        "</option>",
      );
    });
    els.ifaceSelect.innerHTML =
      opts.length > 0 ? opts.join("") : '<option value="">No eligible parent interfaces</option>';
    syncIfaceIpFamilyConstraints();
  }

  function syncIfaceAddressHint() {
    if (!els.ifaceAddrHint) return;
    var v = els.ifaceSelect ? els.ifaceSelect.value.trim() : "";
    var hint = v && ifaceAddressHintByValue[v] ? ifaceAddressHintByValue[v] : "";
    if (hint) {
      els.ifaceAddrHint.textContent = hint;
      els.ifaceAddrHint.hidden = false;
      els.ifaceAddrHint.setAttribute("aria-hidden", "false");
    } else {
      els.ifaceAddrHint.textContent = "";
      els.ifaceAddrHint.hidden = true;
      els.ifaceAddrHint.setAttribute("aria-hidden", "true");
    }
  }

  function selectedIfaceFlags() {
    var n = els.ifaceSelect ? els.ifaceSelect.value.trim() : "";
    return ifaceIpFlags(ifacePayloadByName[n] || {});
  }

  function syncIfaceIpFamilyConstraints() {
    var fl = selectedIfaceFlags();
    var r4 = els.radioV4;
    var r6 = els.radioV6;
    if (r4) {
      r4.disabled = !fl.v4;
      r4.parentElement && r4.parentElement.classList.toggle("muted", !fl.v4);
    }
    if (r6) {
      r6.disabled = !fl.v6;
      r6.parentElement && r6.parentElement.classList.toggle("muted", !fl.v6);
    }
    var v4on = r4 && r4.checked;
    var v6on = r6 && r6.checked;
    if (v4on && !fl.v4 && fl.v6 && r6) {
      r6.checked = true;
    } else if (v6on && !fl.v6 && fl.v4 && r4) {
      r4.checked = true;
    } else if (!fl.v4 && !fl.v6) {
      if (r4) r4.disabled = false;
      if (r6) r6.disabled = false;
      if (r4 && r4.parentElement) r4.parentElement.classList.remove("muted");
      if (r6 && r6.parentElement) r6.parentElement.classList.remove("muted");
    }
    syncIpVersionBlocks();
    syncIfaceAddressHint();
  }

  function syncIpVersionBlocks() {
    var ipv6 = els.radioV6 && els.radioV6.checked;
    if (els.ipv4Block) {
      els.ipv4Block.hidden = ipv6;
      els.ipv4Block.setAttribute("aria-hidden", ipv6 ? "true" : "false");
    }
    if (els.ipv6Block) {
      els.ipv6Block.hidden = !ipv6;
      els.ipv6Block.setAttribute("aria-hidden", ipv6 ? "false" : "true");
    }
  }

  function snapshotAlwaysField(n) {
    if (!n || !n.id) return false;
    return (
      n.id === "gc-alias-flyout-ipv4" ||
      n.id === "gc-alias-flyout-netmask" ||
      n.id === "gc-alias-flyout-ipv6" ||
      n.id === "gc-alias-flyout-prefix"
    );
  }

  function getFormSnapshot() {
    var form = els.form;
    if (!form) return "";
    var nodes = form.querySelectorAll("input, select, textarea");
    var parts = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!snapshotAlwaysField(n) && n.offsetParent === null && n.type !== "hidden") continue;
      var t = n.type;
      if (t === "submit" || t === "button" || n.disabled) continue;
      var key = n.name || n.id || "i" + i;
      if (t === "radio") {
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

  function collectAliasForm() {
    var ipv6 = els.radioV6 && els.radioV6.checked;
    var out = {
      name: "",
      interface_parent: els.ifaceSelect ? els.ifaceSelect.value.trim() : "",
      ip_family: ipv6 ? "ipv6" : "ipv4",
      ipv4_ip: els.ipv4Inp ? els.ipv4Inp.value.trim() : "",
      ipv4_netmask: els.netmaskSel ? els.netmaskSel.value.trim() : "",
      ipv6: els.ipv6Inp ? els.ipv6Inp.value.trim() : "",
      prefix: els.prefixInp ? els.prefixInp.value.trim() : "",
    };
    return out;
  }

  function syncAddEditLayout() {
    var tfw = document.getElementById("gc-alias-flyout-target-fw-row");
    var tcg = document.getElementById("gc-alias-flyout-target-cfg-row");
    var target =
      typeof window.gcNetAliasEntityTarget === "string" ? window.gcNetAliasEntityTarget : "firewall";
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
    if (els.title) els.title.textContent = addMode ? "Add alias" : "Edit alias";
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
  }

  function populateFromRow(row) {
    addMode = false;
    currentNetRow = row || null;
    syncAddEditLayout();
    var flat = (row && row.flat) || {};
    fillInterfaceSelect(false);
    var parentIface = String(flat.Interface != null ? flat.Interface : "").trim();
    if (els.ifaceSelect && parentIface) {
      var found = false;
      for (var oi = 0; oi < els.ifaceSelect.options.length; oi++) {
        if (els.ifaceSelect.options[oi].value === parentIface) {
          found = true;
          break;
        }
      }
      if (found) {
        els.ifaceSelect.value = parentIface;
      } else {
        var o = document.createElement("option");
        o.value = parentIface;
        o.textContent =
          findParentOptionLabelFromTable(parentIface, row && row.firewall_id, row && row.configuration_id) ||
          parentIface;
        els.ifaceSelect.appendChild(o);
        els.ifaceSelect.value = parentIface;
        ifacePayloadByName[parentIface] = {};
        ifaceAddressHintByValue[parentIface] = findAddressHintForParentFromTable(
          parentIface,
          row && row.firewall_id,
          row && row.configuration_id,
        );
      }
    }
    syncIfaceIpFamilyConstraints();
    var fam = normLower(flat.IPFamily || "");
    if (fam === "ipv6" && els.radioV6 && !els.radioV6.disabled) {
      els.radioV6.checked = true;
    } else if (els.radioV4) {
      els.radioV4.checked = true;
    }
    syncIpVersionBlocks();
    if (els.ipv4Inp) els.ipv4Inp.value = String(flat.IPAddress != null ? flat.IPAddress : "").trim();
    if (els.netmaskSel) {
      var nd = netmaskToDisplay(flat.Netmask != null ? flat.Netmask : "");
      if (nd) {
        var nfound = false;
        for (var ni = 0; ni < els.netmaskSel.options.length; ni++) {
          if (els.netmaskSel.options[ni].value === nd) {
            nfound = true;
            break;
          }
        }
        if (nfound) els.netmaskSel.value = nd;
        else {
          var o2 = document.createElement("option");
          o2.value = nd;
          o2.textContent = nd;
          els.netmaskSel.appendChild(o2);
          els.netmaskSel.value = nd;
        }
      }
    }
    if (els.ipv6Inp) els.ipv6Inp.value = String(flat.IPv6 != null ? flat.IPv6 : "").trim();
    if (els.prefixInp) els.prefixInp.value = String(flat.Prefix != null ? flat.Prefix : "").trim();
    setInitialSnapshot();
  }

  function populateAdd() {
    addMode = true;
    currentNetRow = null;
    syncAddEditLayout();
    fillAddTargetSelects();
    if (els.ipv4Inp) els.ipv4Inp.value = "";
    if (els.netmaskSel) els.netmaskSel.value = "255.255.255.0";
    if (els.ipv6Inp) els.ipv6Inp.value = "";
    if (els.prefixInp) els.prefixInp.value = "64";
    if (els.radioV4) els.radioV4.checked = true;
    fillInterfaceSelect(true);
    syncIpVersionBlocks();
    setInitialSnapshot();
  }

  function bindPanelResize(root) {
    var panel = root.querySelector(".gc-if-flyout__panel");
    var handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset.gcAliasResizeBound === "1") return;
    handle.dataset.gcAliasResizeBound = "1";
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

  function cacheEls(root) {
    els = {
      root: root,
      title: root.querySelector("#gc-alias-flyout-title"),
      ifaceSelect: root.querySelector("#gc-alias-flyout-iface"),
      ifaceAddrHint: root.querySelector("#gc-alias-flyout-iface-addr-hint"),
      ipv4Block: root.querySelector("#gc-alias-flyout-ipv4-block"),
      ipv6Block: root.querySelector("#gc-alias-flyout-ipv6-block"),
      radioV4: root.querySelector('input[name="gc-alias-ipfam"][value="ipv4"]'),
      radioV6: root.querySelector('input[name="gc-alias-ipfam"][value="ipv6"]'),
      ipv4Inp: root.querySelector("#gc-alias-flyout-ipv4"),
      netmaskSel: root.querySelector("#gc-alias-flyout-netmask"),
      ipv6Inp: root.querySelector("#gc-alias-flyout-ipv6"),
      prefixInp: root.querySelector("#gc-alias-flyout-prefix"),
      cancelBtn: root.querySelector("#gc-alias-flyout-cancel"),
      saveBtn: root.querySelector("#gc-alias-flyout-save"),
      form: root.querySelector("#gc-alias-flyout-form"),
      addFwSelect: root.querySelector("#gc-alias-flyout-add-firewall"),
      addCfgSelect: root.querySelector("#gc-alias-flyout-add-configuration"),
    };
  }

  function bind(root) {
    if (root.dataset.gcAliasFlyoutBound === "1") return;
    root.dataset.gcAliasFlyoutBound = "1";
    cacheEls(root);
    bindPanelResize(root);
    buildNetmaskSelect(els.netmaskSel);

    if (els.ifaceSelect) {
      els.ifaceSelect.addEventListener("change", function () {
        syncIfaceIpFamilyConstraints();
        syncDirty();
      });
    }
    root.querySelectorAll('input[name="gc-alias-ipfam"]').forEach(function (r) {
      r.addEventListener("change", function () {
        syncIfaceIpFamilyConstraints();
        syncDirty();
      });
    });
    if (els.cancelBtn) {
      els.cancelBtn.addEventListener("click", function () {
        close(root);
      });
    }
    if (els.addFwSelect) {
      els.addFwSelect.addEventListener("change", function () {
        fillInterfaceSelect(true);
        syncDirty();
      });
    }
    if (els.addCfgSelect) {
      els.addCfgSelect.addEventListener("change", function () {
        fillInterfaceSelect(true);
        syncDirty();
      });
    }
    if (els.form) {
      els.form.addEventListener("input", syncDirty);
      els.form.addEventListener("change", syncDirty);
      els.form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (els.saveBtn && els.saveBtn.disabled) return;

        var targetEnt =
          typeof window.gcNetAliasEntityTarget === "string" ? window.gcNetAliasEntityTarget : "firewall";
        var rowAl = currentNetRow;
        var isCfg =
          targetEnt === "configuration" ||
          !!(
            rowAl &&
            (rowAl.configuration_id != null || rowAl.scope === "configuration")
          );

        var formObj = collectAliasForm();
        if (!formObj.interface_parent) {
          alert("Select a parent interface.");
          return;
        }
        var fl = ifaceIpFlags(ifacePayloadByName[formObj.interface_parent] || {});
        if (formObj.ip_family === "ipv4" && !fl.v4) {
          alert("IPv4 is not enabled on the selected parent interface.");
          return;
        }
        if (formObj.ip_family === "ipv6" && !fl.v6) {
          alert("IPv6 is not enabled on the selected parent interface.");
          return;
        }
        if (formObj.ip_family === "ipv4") {
          if (window.gcNetIpv4FlyoutBlur && els.ipv4Inp && els.netmaskSel) {
            window.gcNetIpv4FlyoutBlur.applyCidrSplit(
              { ipv4Ip: els.ipv4Inp, ipv4Nm: els.netmaskSel },
              syncDirty,
            );
            formObj.ipv4_ip = els.ipv4Inp.value.trim();
            formObj.ipv4_netmask = els.netmaskSel.value.trim();
          }
          if (!formObj.ipv4_ip || !formObj.ipv4_netmask) {
            alert("IPv4 address and netmask are required.");
            return;
          }
        } else {
          if (!formObj.ipv6 || !formObj.prefix) {
            alert("IPv6 address and prefix length are required.");
            return;
          }
        }

        if (addMode) {
          if (isCfg) {
            var createUrl =
              typeof window.gcNetAliasApplyCreateUrl === "string" ? window.gcNetAliasApplyCreateUrl : "";
            if (!createUrl) {
              alert("Alias create URL is not configured.");
              return;
            }
            var cfgId = els.addCfgSelect ? parseInt(els.addCfgSelect.value.trim(), 10) : NaN;
            if (!els.addCfgSelect || !els.addCfgSelect.value.trim() || isNaN(cfgId) || cfgId <= 0) {
              alert("Select a configuration.");
              return;
            }
            if (els.saveBtn) els.saveBtn.disabled = true;
            fetch(createUrl, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ configuration_id: cfgId, form: formObj }),
            })
              .then(function (r) {
                return r.json().then(function (j) {
                  return { ok: r.ok, j: j };
                });
              })
              .then(function (x) {
                if (!x.ok) {
                  var msg = (x.j && (x.j.detail || x.j.message)) || "Could not add alias.";
                  alert(typeof msg === "string" ? msg : JSON.stringify(msg));
                  if (els.saveBtn) els.saveBtn.disabled = false;
                  syncDirty();
                  return;
                }
                document.dispatchEvent(new CustomEvent("gc-configuration-entries-updated"));
                close(root);
              })
              .catch(function () {
                alert("Network error.");
                if (els.saveBtn) els.saveBtn.disabled = false;
                syncDirty();
              });
            return;
          }
          var createFwUrl =
            typeof window.gcNetAliasEnqueueCreateUrl === "string" ? window.gcNetAliasEnqueueCreateUrl : "";
          if (!createFwUrl) {
            alert("Alias create URL is not configured.");
            return;
          }
          var fwId = els.addFwSelect ? parseInt(els.addFwSelect.value.trim(), 10) : NaN;
          if (!els.addFwSelect || !els.addFwSelect.value.trim() || isNaN(fwId) || fwId <= 0) {
            alert("Select a firewall.");
            return;
          }
          if (els.saveBtn) els.saveBtn.disabled = true;
          fetch(createFwUrl, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firewall_id: fwId, form: formObj }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (!x.ok) {
                var msg2 = (x.j && (x.j.detail || x.j.message)) || "Could not queue alias.";
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
          return;
        }

        var url = isCfg
          ? typeof window.gcNetAliasApplyUrl === "string"
            ? window.gcNetAliasApplyUrl
            : ""
          : typeof window.gcNetAliasEnqueueUrl === "string"
            ? window.gcNetAliasEnqueueUrl
            : "";
        var cid = currentNetRow && currentNetRow.config_entry_id;
        if (!url || cid == null) {
          alert(
            isCfg
              ? "Save URL is not configured or the row is missing an id."
              : "Task queue URL is not configured or the row is missing an id.",
          );
          return;
        }
        if (els.saveBtn) els.saveBtn.disabled = true;
        fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config_entry_id: cid, form: formObj }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, j: j };
            });
          })
          .then(function (x) {
            if (!x.ok) {
              var msg3 =
                (x.j && (x.j.detail || x.j.message)) ||
                (isCfg ? "Could not save configuration." : "Could not save to task queue.");
              alert(typeof msg3 === "string" ? msg3 : JSON.stringify(msg3));
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

  window.gcNetAliasFlyoutInit = function () {
    var root = document.getElementById("gc-net-alias-flyout");
    if (!root) return;
    bind(root);
  };

  window.gcNetAliasFlyoutOpenFromTr = function (tr) {
    var row = tr && tr._gcNetRow;
    if (!row || row.entity_type !== "alias") return;
    var root = document.getElementById("gc-net-alias-flyout");
    if (!root) return;
    bind(root);
    populateFromRow(row);
    open(root);
  };

  window.gcNetAliasFlyoutOpenAdd = function () {
    var root = document.getElementById("gc-net-alias-flyout");
    if (!root) return;
    bind(root);
    populateAdd();
    open(root);
  };
})();
