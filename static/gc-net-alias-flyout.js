/**
 * Interface alias add/edit flyout (Firewalls · Network & Configuration · Network).
 */
(function () {
  "use strict";

  let initialFormSnapshot = "";
  let currentNetRow = null;
  let addMode = false;
  let els = {};
  let ifacePayloadByName = {};
  let ifaceAddressHintByValue = {};

  function ifTbodyId() {
    let p = (typeof globalThis.gcNetVlanIfPrefix === "string" && globalThis.gcNetVlanIfPrefix) || "gc-net-if";
    return p + "-tbody";
  }

  function normLower(s) {
    return String(s || "").trim().toLowerCase();
  }

  function truthySophosFlag(x) {
    let s = normLower(x);
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
    let cells = (row && row.cells) || {};
    let raw = (row && row.raw_payload) || {};
    let flat = (row && row.flat) || {};
    let o = {};
    markSet(o, cells.__name);
    markSet(o, cells.__hardware);
    markSet(o, raw.Hardware);
    markSet(o, flat.Hardware);
    return o;
  }

  function rowTouchesExcludedSet(row, excluded) {
    if (!excluded || row.entity_type !== "interface") return false;
    let keys = rowIdentityKeys(row);
    for (let k in keys) {
      if (excluded[k]) return true;
    }
    return false;
  }

  function collectBridgeMemberIfaces(raw) {
    let out = [];
    if (!raw || typeof raw !== "object") return out;
    let bm = raw.BridgeMembers;
    if (!bm || typeof bm !== "object") return out;
    let members = bm.Member;
    let arr = Array.isArray(members) ? members : members ? [members] : [];
    arr.forEach(function (m) {
      if (!m || typeof m !== "object") return;
      let iface = m.Interface != null ? String(m.Interface).trim() : "";
      if (iface) out.push(iface);
    });
    return out;
  }

  function collectLagMemberIfaces(raw) {
    let out = [];
    if (!raw || typeof raw !== "object") return out;
    let mi = raw.MemberInterface;
    if (mi == null) return out;
    function pushIface(x) {
      let s = x != null ? String(x).trim() : "";
      if (s) out.push(s);
    }
    if (Array.isArray(mi)) {
      mi.forEach(function (block) {
        if (block && typeof block === "object" && block.Interface != null) pushIface(block.Interface);
      });
      return out;
    }
    if (typeof mi === "object") {
      let v = mi.Interface;
      if (Array.isArray(v)) v.forEach(pushIface);
      else pushIface(v);
    }
    return out;
  }

  function isLagInterfaceRaw(raw) {
    return collectLagMemberIfaces(raw).length > 0;
  }

  function collectBridgeLagMemberExclusionsScoped(fwId, cfgId, opts) {
    let require = opts && opts.requireScope;
    let wantFw = fwId != null && fwId !== "" && !isNaN(Number(fwId));
    let wantCfg = cfgId != null && cfgId !== "" && !isNaN(Number(cfgId));
    if (require && !wantFw && !wantCfg) return {};
    let excluded = {};
    let tbody = document.getElementById(ifTbodyId());
    if (!tbody) return excluded;
    tbody.querySelectorAll("tr[class*='-data-row'], tr.gc-net-entity-row--clickable").forEach(function (tr) {
      let row = tr._gcNetRow;
      if (!row) return;
      if (!rowMatchesNetScope(row, fwId, cfgId)) return;
      let raw = row.raw_payload || {};
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
    let z = String((row.cells && row.cells.__zone) || "").trim();
    if (!z) return false;
    if (normLower(z) === "none") return false;
    return true;
  }

  function aliasParentConfigured(row) {
    let cells = (row && row.cells) || {};
    let raw = (row && row.raw_payload) || {};
    let addr = String(cells.__address_cidr != null ? cells.__address_cidr : "").trim();
    let fl = ifaceIpFlags(raw);
    if (hasMeaningfulZone(row)) return true;
    if (addr) return true;
    if (fl.v4 || fl.v6) return true;
    return false;
  }

  function aliasParentSelectValue(row) {
    let cells = (row && row.cells) || {};
    let raw = (row && row.raw_payload) || {};
    let flat = (row && row.flat) || {};
    let nm = String(cells.__name != null ? cells.__name : "").trim();
    let hw = raw.Hardware != null ? String(raw.Hardware).trim() : "";
    if (!hw) hw = String(flat.Hardware != null ? flat.Hardware : "").trim();
    if (!hw) hw = String(cells.__hardware != null ? cells.__hardware : "").trim();
    let et = row.entity_type;
    if (et === "bridge_pair" || et === "lag") return hw || nm;
    if (et === "interface" && isLagInterfaceRaw(raw)) return hw || nm;
    return nm;
  }

  function aliasParentOptionLabel(row) {
    let cells = (row && row.cells) || {};
    let nm = String(cells.__name != null ? cells.__name : "").trim();
    let z = String(cells.__zone != null ? cells.__zone : "").trim();
    if (normLower(z) === "none") z = "";
    let val = aliasParentSelectValue(row);
    let head = nm;
    if (nm && val && nm !== val) head = nm + " (" + val + ")";
    else if (!nm && val) head = val;
    let parts = [];
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
    let tbody = document.getElementById(ifTbodyId());
    if (!tbody || !parentValue) return "";
    let want = String(parentValue).trim();
    let found = "";
    tbody.querySelectorAll("tr[class*='-data-row'], tr.gc-net-entity-row--clickable").forEach(function (tr) {
      if (found) return;
      let row = tr._gcNetRow;
      if (!row) return;
      if (!rowMatchesNetScope(row, fwId, cfgId)) return;
      if (
        row.entity_type !== "interface" &&
        row.entity_type !== "bridge_pair" &&
        row.entity_type !== "lag"
      )
        return;
      let pv = aliasParentSelectValue(row);
      let nm = String((row.cells && row.cells.__name) || "").trim();
      if (pv !== want && nm !== want) return;
      found = aliasParentOptionLabel(row);
    });
    return found;
  }

  function findAddressHintForParentFromTable(parentName, fwId, cfgId) {
    let tbody = document.getElementById(ifTbodyId());
    if (!tbody || !parentName) return "";
    let want = String(parentName).trim();
    let found = "";
    tbody.querySelectorAll("tr[class*='-data-row'], tr.gc-net-entity-row--clickable").forEach(function (tr) {
      if (found) return;
      let row = tr._gcNetRow;
      if (!row) return;
      if (!rowMatchesNetScope(row, fwId, cfgId)) return;
      if (
        row.entity_type !== "interface" &&
        row.entity_type !== "bridge_pair" &&
        row.entity_type !== "lag"
      )
        return;
      let pv = aliasParentSelectValue(row);
      let nm = String((row.cells && row.cells.__name) || "").trim();
      if (pv !== want && nm !== want) return;
      found = formatParentAddressHint(row);
    });
    return found;
  }

  function formatParentAddressHint(row) {
    let cells = (row && row.cells) || {};
    let raw = (row && row.raw_payload) || {};
    let flat = (row && row.flat) || {};
    let s = String(cells.__address_cidr != null ? cells.__address_cidr : "").trim();
    if (!s) {
      let parts = [];
      let ip4 =
        (flat.IPAddress && String(flat.IPAddress).trim()) ||
        (flat.IPv4Address && String(flat.IPv4Address).trim()) ||
        (raw.IPAddress != null ? String(raw.IPAddress).trim() : "") ||
        (raw.IPv4Address != null ? String(raw.IPv4Address).trim() : "");
      let nm = (flat.Netmask && String(flat.Netmask).trim()) || (raw.Netmask != null ? String(raw.Netmask).trim() : "");
      if (ip4 && nm) parts.push(ip4 + "/" + nm);
      else if (ip4) parts.push(ip4);
      let ip6 =
        (flat.IPv6Address && String(flat.IPv6Address).trim()) ||
        (flat.IPv6 && String(flat.IPv6).trim()) ||
        (raw.IPv6Address != null ? String(raw.IPv6Address).trim() : "") ||
        (raw.IPv6 != null ? String(raw.IPv6).trim() : "");
      let pfx =
        (flat.Prefix && String(flat.Prefix).trim()) || (raw.Prefix != null ? String(raw.Prefix).trim() : "");
      if (ip6 && pfx) parts.push(ip6 + "/" + pfx);
      else if (ip6) parts.push(ip6);
      s = parts.length ? parts.join(" · ") : "";
    }
    if (!s) return "";
    let chunks = s.split(/\s*·\s*/);
    let v4 = [];
    let v6 = [];
    chunks.forEach(function (p) {
      p = p.trim();
      if (!p) return;
      if (p.indexOf(":") >= 0) v6.push(p);
      else v4.push(p);
    });
    let lines = [];
    if (v4.length) lines.push("IPv4: " + v4.join(", "));
    if (v6.length) lines.push("IPv6: " + v6.join(", "));
    return lines.length ? lines.join("\n") : s;
  }

  function rowMatchesNetScope(row, fwId, cfgId) {
    let wantFw = fwId != null && fwId !== "" && !isNaN(Number(fwId));
    let wantCfg = cfgId != null && cfgId !== "" && !isNaN(Number(cfgId));
    if (!wantFw && !wantCfg) return true;
    if (wantFw && (row.firewall_id == null || Number(row.firewall_id) !== Number(fwId))) return false;
    if (wantCfg && (row.configuration_id == null || Number(row.configuration_id) !== Number(cfgId))) return false;
    return true;
  }

  function collectAliasParentChoicesScoped(fwId, cfgId, opts) {
    let require = opts && opts.requireScope;
    let wantFw = fwId != null && fwId !== "" && !isNaN(Number(fwId));
    let wantCfg = cfgId != null && cfgId !== "" && !isNaN(Number(cfgId));
    if (require && !wantFw && !wantCfg) return [];
    let excluded = collectBridgeLagMemberExclusionsScoped(fwId, cfgId, opts);
    let tbody = document.getElementById(ifTbodyId());
    if (!tbody) return [];
    let byVal = {};
    tbody.querySelectorAll("tr[class*='-data-row'], tr.gc-net-entity-row--clickable").forEach(function (tr) {
      let row = tr._gcNetRow;
      if (!row) return;
      if (!rowMatchesNetScope(row, fwId, cfgId)) return;
      let et = row.entity_type;
      if (et !== "interface" && et !== "bridge_pair" && et !== "lag") return;
      if (!aliasParentConfigured(row)) return;
      if (et === "interface") {
        if (rowTouchesExcludedSet(row, excluded)) return;
        if (!isLagInterfaceRaw(row.raw_payload || {}) && !String((row.cells && row.cells.__name) || "").trim()) return;
      } else if (et === "bridge_pair" || et === "lag") {
        if (!String((row.cells && row.cells.__name) || "").trim() && !aliasParentSelectValue(row)) return;
      }
      let val = aliasParentSelectValue(row);
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
    let out = [];
    for (let k in byVal) {
      if (Object.prototype.hasOwnProperty.call(byVal, k)) out.push(byVal[k]);
    }
    out.sort(function (a, b) {
      let la = String(a.label || a.value || "");
      let lb = String(b.label || b.value || "");
      let c = la.localeCompare(lb, undefined, { sensitivity: "base" });
      if (c !== 0) return c;
      return String(a.value).localeCompare(String(b.value), undefined, { sensitivity: "base" });
    });
    return out;
  }

  function aliasScopeForPickers() {
    if (!addMode) {
      let r = currentNetRow;
      return {
        fwId: r && r.firewall_id != null && r.firewall_id !== "" ? Number(r.firewall_id) : undefined,
        cfgId: r && r.configuration_id != null && r.configuration_id !== "" ? Number(r.configuration_id) : undefined,
        requireScope: false,
      };
    }
    let target =
      typeof globalThis.gcNetAliasEntityTarget === "string" ? globalThis.gcNetAliasEntityTarget : "firewall";
    if (target === "firewall") {
      let fv = els.addFwSelect ? els.addFwSelect.value.trim() : "";
      let fn = parseInt(fv, 10);
      let fok = fv && !isNaN(fn) && fn > 0;
      return { fwId: fok ? fn : undefined, cfgId: undefined, requireScope: true };
    }
    let cv = els.addCfgSelect ? els.addCfgSelect.value.trim() : "";
    let cn = parseInt(cv, 10);
    let cok = cv && !isNaN(cn) && cn > 0;
    return { fwId: undefined, cfgId: cok ? cn : undefined, requireScope: true };
  }

  function fillAddTargetSelects() {
    let target =
      typeof globalThis.gcNetAliasEntityTarget === "string" ? globalThis.gcNetAliasEntityTarget : "firewall";
    if (target === "firewall" && els.addFwSelect) {
      let inv =
        typeof globalThis.gcGetFirewallNavInventory === "function" ? globalThis.gcGetFirewallNavInventory() : [];
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
      let inv2 =
        typeof globalThis.gcGetConfigurationNavInventory === "function"
          ? globalThis.gcGetConfigurationNavInventory()
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
    let p = Number(prefix);
    if (p !== p || p < 0 || p > 32) return null;
    let low = p === 32 ? 0 : Math.pow(2, 32 - p) - 1;
    let mask = (4294967295 ^ low) >>> 0;
    return [(mask >>> 24) & 255, (mask >>> 16) & 255, (mask >>> 8) & 255, mask & 255].join(".");
  }

  function buildNetmaskSelect(sel) {
    if (!sel) return;
    let parts = [];
    for (let i = 32; i >= 8; i--) {
      let d = prefixToDotted(i);
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
    if (globalThis.gcNetIpv4FlyoutBlur && typeof globalThis.gcNetIpv4FlyoutBlur.netmaskToDisplay === "function") {
      return globalThis.gcNetIpv4FlyoutBlur.netmaskToDisplay(nm);
    }
    return String(nm || "").trim();
  }

  function fillInterfaceSelect(forAdd) {
    if (!els.ifaceSelect) return;
    let sc = aliasScopeForPickers();
    let choices = collectAliasParentChoicesScoped(sc.fwId, sc.cfgId, {
      requireScope: forAdd ? sc.requireScope : false,
    });
    ifacePayloadByName = {};
    ifaceAddressHintByValue = {};
    let opts = [];
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
    let v = els.ifaceSelect ? els.ifaceSelect.value.trim() : "";
    let hint = v && ifaceAddressHintByValue[v] ? ifaceAddressHintByValue[v] : "";
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
    let n = els.ifaceSelect ? els.ifaceSelect.value.trim() : "";
    return ifaceIpFlags(ifacePayloadByName[n] || {});
  }

  function syncIfaceIpFamilyConstraints() {
    let fl = selectedIfaceFlags();
    let r4 = els.radioV4;
    let r6 = els.radioV6;
    if (r4) {
      r4.disabled = !fl.v4;
      r4.parentElement && r4.parentElement.classList.toggle("muted", !fl.v4);
    }
    if (r6) {
      r6.disabled = !fl.v6;
      r6.parentElement && r6.parentElement.classList.toggle("muted", !fl.v6);
    }
    let v4on = r4 && r4.checked;
    let v6on = r6 && r6.checked;
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
    let ipv6 = els.radioV6 && els.radioV6.checked;
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
    let form = els.form;
    if (!form) return "";
    let nodes = form.querySelectorAll("input, select, textarea");
    let parts = [];
    for (let i = 0; i < nodes.length; i++) {
      let n = nodes[i];
      if (!snapshotAlwaysField(n) && n.offsetParent === null && n.type !== "hidden") continue;
      let t = n.type;
      if (t === "submit" || t === "button" || n.disabled) continue;
      let key = n.name || n.id || "i" + i;
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
    let ipv6 = els.radioV6 && els.radioV6.checked;
    let out = {
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
    let tfw = document.getElementById("gc-alias-flyout-target-fw-row");
    let tcg = document.getElementById("gc-alias-flyout-target-cfg-row");
    let target =
      typeof globalThis.gcNetAliasEntityTarget === "string" ? globalThis.gcNetAliasEntityTarget : "firewall";
    if (tfw) {
      let showFw = !!(addMode && target === "firewall");
      tfw.hidden = !showFw;
      tfw.setAttribute("aria-hidden", showFw ? "false" : "true");
    }
    if (tcg) {
      let showCfg = !!(addMode && target === "configuration");
      tcg.hidden = !showCfg;
      tcg.setAttribute("aria-hidden", showCfg ? "false" : "true");
    }
    if (els.title) els.title.textContent = addMode ? "Add alias" : "Edit alias";
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
    let flat = (row && row.flat) || {};
    fillInterfaceSelect(false);
    let parentIface = String(flat.Interface != null ? flat.Interface : "").trim();
    if (els.ifaceSelect && parentIface) {
      let found = false;
      for (let oi = 0; oi < els.ifaceSelect.options.length; oi++) {
        if (els.ifaceSelect.options[oi].value === parentIface) {
          found = true;
          break;
        }
      }
      if (found) {
        els.ifaceSelect.value = parentIface;
      } else {
        let o = document.createElement("option");
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
    let fam = normLower(flat.IPFamily || "");
    if (fam === "ipv6" && els.radioV6 && !els.radioV6.disabled) {
      els.radioV6.checked = true;
    } else if (els.radioV4) {
      els.radioV4.checked = true;
    }
    syncIpVersionBlocks();
    if (els.ipv4Inp) els.ipv4Inp.value = String(flat.IPAddress != null ? flat.IPAddress : "").trim();
    if (els.netmaskSel) {
      let nd = netmaskToDisplay(flat.Netmask != null ? flat.Netmask : "");
      if (nd) {
        let nfound = false;
        for (let ni = 0; ni < els.netmaskSel.options.length; ni++) {
          if (els.netmaskSel.options[ni].value === nd) {
            nfound = true;
            break;
          }
        }
        if (nfound) els.netmaskSel.value = nd;
        else {
          let o2 = document.createElement("option");
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
    let panel = root.querySelector(".gc-if-flyout__panel");
    let handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset.gcAliasResizeBound === "1") return;
    handle.dataset.gcAliasResizeBound = "1";
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

        let targetEnt =
          typeof globalThis.gcNetAliasEntityTarget === "string" ? globalThis.gcNetAliasEntityTarget : "firewall";
        let rowAl = currentNetRow;
        let isCfg =
          targetEnt === "configuration" ||
          !!(
            rowAl &&
            (rowAl.configuration_id != null || rowAl.scope === "configuration")
          );

        let formObj = collectAliasForm();
        if (!formObj.interface_parent) {
          alert("Select a parent interface.");
          return;
        }
        let fl = ifaceIpFlags(ifacePayloadByName[formObj.interface_parent] || {});
        if (formObj.ip_family === "ipv4" && !fl.v4) {
          alert("IPv4 is not enabled on the selected parent interface.");
          return;
        }
        if (formObj.ip_family === "ipv6" && !fl.v6) {
          alert("IPv6 is not enabled on the selected parent interface.");
          return;
        }
        if (formObj.ip_family === "ipv4") {
          if (globalThis.gcNetIpv4FlyoutBlur && els.ipv4Inp && els.netmaskSel) {
            globalThis.gcNetIpv4FlyoutBlur.applyCidrSplit(
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
            let createUrl =
              typeof globalThis.gcNetAliasApplyCreateUrl === "string" ? globalThis.gcNetAliasApplyCreateUrl : "";
            if (!createUrl) {
              alert("Alias create URL is not configured.");
              return;
            }
            let cfgId = els.addCfgSelect ? parseInt(els.addCfgSelect.value.trim(), 10) : NaN;
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
                  let msg = (x.j && (x.j.detail || x.j.message)) || "Could not add alias.";
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
          let createFwUrl =
            typeof globalThis.gcNetAliasEnqueueCreateUrl === "string" ? globalThis.gcNetAliasEnqueueCreateUrl : "";
          if (!createFwUrl) {
            alert("Alias create URL is not configured.");
            return;
          }
          let fwId = els.addFwSelect ? parseInt(els.addFwSelect.value.trim(), 10) : NaN;
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
                let msg2 = (x.j && (x.j.detail || x.j.message)) || "Could not queue alias.";
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

        let url = isCfg
          ? typeof globalThis.gcNetAliasApplyUrl === "string"
            ? globalThis.gcNetAliasApplyUrl
            : ""
          : typeof globalThis.gcNetAliasEnqueueUrl === "string"
            ? globalThis.gcNetAliasEnqueueUrl
            : "";
        let cid = currentNetRow && currentNetRow.config_entry_id;
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
              let msg3 =
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

  globalThis.gcNetAliasFlyoutInit = function () {
    let root = document.getElementById("gc-net-alias-flyout");
    if (!root) return;
    bind(root);
  };

  globalThis.gcNetAliasFlyoutOpenFromTr = function (tr) {
    let row = tr && tr._gcNetRow;
    if (!row || row.entity_type !== "alias") return;
    let root = document.getElementById("gc-net-alias-flyout");
    if (!root) return;
    bind(root);
    populateFromRow(row);
    open(root);
  };

  globalThis.gcNetAliasFlyoutOpenAdd = function () {
    let root = document.getElementById("gc-net-alias-flyout");
    if (!root) return;
    bind(root);
    populateAdd();
    open(root);
  };
})();
