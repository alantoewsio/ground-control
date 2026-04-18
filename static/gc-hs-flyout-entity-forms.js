/**
 * Hosts & Services flyout: structured forms for non–IP-host entities (FQDN, service, MAC, groups, country).
 * Loaded before gc-hosts-services-flyout.js; hydrate uses globalThis.gcHsHydrateFlyoutFirewallPicker from that script.
 */
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pick(flat, keys) {
    if (!flat) return "";
    for (let i = 0; i < keys.length; i++) {
      let v = flat[keys[i]];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  function getEntitySchema(entityType) {
    if (typeof globalThis.gcHsGetEntitySchema !== "function") return null;
    try {
      return globalThis.gcHsGetEntitySchema(entityType);
    } catch (e) {
      return null;
    }
  }

  function htmlAttrs(attrs) {
    if (!attrs || typeof attrs !== "object") return "";
    let out = "";
    Object.keys(attrs).forEach(function (k) {
      let v = attrs[k];
      if (v == null || v === false) return;
      if (v === true) {
        out += " " + escapeHtml(k);
        return;
      }
      out += ' ' + escapeHtml(k) + '="' + escapeHtml(String(v)) + '"';
    });
    return out;
  }

  function collectFwIdsFromFlyoutDom(root) {
    let out = [];
    if (!root) return out;
    let cfg =
      typeof globalThis.gcHsEntityTarget === "string" && globalThis.gcHsEntityTarget === "configuration";
    let ms = root.querySelector(cfg ? "[data-gc-cfg-ms]" : "[data-gc-fw-ms]");
    if (!ms) return out;
    let idAttr = cfg ? "data-gc-cfg-id" : "data-gc-fw-id";
    ms.querySelectorAll("input[type=\"checkbox\"]").forEach(function (cb) {
      if (!cb.checked || !cb.hasAttribute(idAttr)) return;
      let n = parseInt(String(cb.getAttribute(idAttr) || ""), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function assignedFirewallIdsFromRow(row) {
    let t = (row && (row.hs_edit_targets || row.ip_host_edit_targets)) || [];
    let cfg =
      typeof globalThis.gcHsEntityTarget === "string" && globalThis.gcHsEntityTarget === "configuration";
    let out = [];
    t.forEach(function (x) {
      if (!x) return;
      if (cfg && x.configuration_id != null) {
        let nc = parseInt(String(x.configuration_id), 10);
        if (!isNaN(nc) && nc > 0) out.push(nc);
      } else if (x.firewall_id != null) {
        let n = parseInt(String(x.firewall_id), 10);
        if (!isNaN(n) && n > 0) out.push(n);
      }
    });
    return out;
  }

  function hgSummary(count) {
    if (count === 0) return "None selected";
    if (count === 1) return "1 selected";
    return count + " selected";
  }

  function buildFirewallPickerSection(pickerMode, initialSelectedIds, assignedFirewallIds) {
    let ids = [];
    (initialSelectedIds || []).forEach(function (x) {
      let n = parseInt(String(x), 10);
      if (!isNaN(n) && n > 0) ids.push(n);
    });
    let assigned = [];
    (assignedFirewallIds || []).forEach(function (x) {
      let na = parseInt(String(x), 10);
      if (!isNaN(na) && na > 0) assigned.push(na);
    });
    let idsJson = escapeHtml(JSON.stringify(ids));
    let assignedJson = escapeHtml(JSON.stringify(assigned));
    let pm = pickerMode === "edit" ? "edit" : "add";
    let isCfg =
      typeof globalThis.gcHsEntityTarget === "string" && globalThis.gcHsEntityTarget === "configuration";
    let msAttr = isCfg ? 'data-gc-cfg-ms="1"' : 'data-gc-fw-ms="1"';
    let hint =
      pm === "add"
        ? isCfg
          ? '<p class="muted gc-hs-ip-host-flyout__fw-hint">The object is stored on every configuration you leave selected.</p>'
          : '<p class="muted gc-hs-ip-host-flyout__fw-hint">The object is created on every firewall you leave selected.</p>'
        : isCfg
          ? '<p class="muted gc-hs-ip-host-flyout__fw-hint">Uncheck to skip updates where this object exists. Newly checked configurations receive an add.</p>'
          : '<p class="muted gc-hs-ip-host-flyout__fw-hint">Uncheck to skip updates where this object exists. Newly checked firewalls receive an add task.</p>';
    let lbl = isCfg ? "Configurations" : "Firewalls";
    let ph = isCfg ? "Search configurations" : "Search firewalls";
    let emptyT = isCfg ? "No configurations available." : "No firewalls available.";
    return (
      '<div class="gc-if-flyout__field gc-hs-ip-host-flyout__fw-field">' +
      '<span class="gc-if-flyout__label">' +
      escapeHtml(lbl) +
      "</span>" +
      hint +
      '<div class="gc-hs-ip-host-flyout__fw-ms" ' +
      msAttr +
      ' data-fw-picker-mode="' +
      escapeHtml(pm) +
      '" data-fw-initial-selected="' +
      idsJson +
      '" data-fw-assigned-ids="' +
      assignedJson +
      '">' +
      '<div class="gc-multiselect__control gc-hs-ip-host-flyout__fw-ms-control">' +
      '<button type="button" class="gc-multiselect__trigger gc-hs-ip-host-flyout__fw-trigger" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="gc-multiselect__trigger-value">' +
      '<span class="gc-ms-trigger-chips gc-hs-ip-host-flyout__fw-trigger-chips" aria-hidden="true"></span>' +
      '<span class="gc-multiselect__trigger-text gc-hs-ip-host-flyout__fw-trigger-text">Loading…</span>' +
      "</span>" +
      '<span class="gc-multiselect__chev" aria-hidden="true">▾</span>' +
      "</button>" +
      '<div class="gc-multiselect__dropdown gc-hs-ip-host-flyout__fw-dropdown" hidden>' +
      '<div class="gc-hs-ip-host-flyout__fw-search-wrap">' +
      '<input type="search" class="gc-if-flyout__input gc-hs-ip-host-flyout__fw-search" placeholder="' +
      escapeHtml(ph) +
      '" autocomplete="off" />' +
      "</div>" +
      '<div class="gc-hs-ip-host-flyout__fw-ms-options" role="listbox" aria-multiselectable="true"></div>' +
      '<p class="gc-hs-ip-host-flyout__fw-empty muted" hidden>' +
      escapeHtml(emptyT) +
      "</p>" +
      "</div></div>" +
      "</div></div>"
    );
  }

  function buildNamesMultiselectSection(label, emptyText, namesEntityType, readOnly, initSourceSelector, extraAttrs) {
    let ro = readOnly ? "1" : "0";
    let initAttr = initSourceSelector
      ? ' data-init-source="' + escapeHtml(initSourceSelector) + '"'
      : "";
    let xattr = extraAttrs && String(extraAttrs).trim() ? " " + String(extraAttrs).trim() : "";
    return (
      '<div class="gc-if-flyout__field"' +
      xattr +
      ">" +
      '<span class="gc-if-flyout__label">' +
      escapeHtml(label) +
      "</span>" +
      '<div class="gc-hs-ip-host-flyout__hg-ms" data-gc-hs-names-ms="1" data-names-entity-type="' +
      escapeHtml(namesEntityType) +
      '" data-ms-readonly="' +
      ro +
      '"' +
      initAttr +
      ">" +
      '<div class="gc-multiselect__control gc-hs-ip-host-flyout__hg-ms-control">' +
      '<button type="button" class="gc-multiselect__trigger gc-hs-ip-host-flyout__hg-trigger" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="gc-multiselect__trigger-value">' +
      '<span class="gc-ms-trigger-chips gc-hs-ip-host-flyout__hg-trigger-chips" aria-hidden="true"></span>' +
      '<span class="gc-multiselect__trigger-text gc-hs-ip-host-flyout__hg-trigger-text">Loading…</span>' +
      "</span>" +
      '<span class="gc-multiselect__chev" aria-hidden="true">▾</span>' +
      "</button>" +
      '<div class="gc-multiselect__dropdown gc-hs-ip-host-flyout__hg-dropdown" hidden>' +
      '<div class="gc-hs-ip-host-flyout__hg-search-wrap">' +
      '<input type="search" class="gc-if-flyout__input gc-hs-ip-host-flyout__hg-search" placeholder="Search" autocomplete="off" />' +
      "</div>" +
      '<div class="gc-hs-ip-host-flyout__hg-ms-options" role="listbox" aria-multiselectable="true"></div>' +
      '<p class="gc-hs-entity-ms-empty muted" hidden>' +
      escapeHtml(emptyText) +
      "</p>" +
      "</div></div>" +
      '<ul class="gc-hs-ip-host-flyout__hg-pills" aria-label="Selected"></ul>' +
      "</div></div>"
    );
  }

  /**
   * Flattened cache joins list-of-string API values with commas (see flatten_payload).
   * Split those aggregates so multiselects get one entry per name.
   */
  function pushCommaSplitFlatNames(out, raw) {
    if (raw == null) return;
    let s = String(raw).trim();
    if (!s) return;
    s.split(",").forEach(function (part) {
      let p = String(part || "").trim();
      if (p) out.push(p);
    });
  }

  function fqdnHostGroupNamesFromFlat(flat) {
    return memberNamesFromFlat(flat, "FQDNHostGroupList", "FQDNHostGroup");
  }

  function memberNamesFromFlat(flat, listKey, itemKey) {
    let out = [];
    if (!flat) return out;
    let direct = listKey + "." + itemKey;
    pushCommaSplitFlatNames(out, flat[direct]);
    let re = new RegExp(
      "^" + listKey.replace(/\./g, "\\.") + "\\.(?:\\d+\\.)?" + itemKey + "$",
    );
    Object.keys(flat).forEach(function (k) {
      if (re.test(k) && k !== direct) {
        let x = String(flat[k] || "").trim();
        if (x) out.push(x);
      }
    });
    return out.filter(function (n, i, a) {
      return a.indexOf(n) === i;
    });
  }

  function countryNamesFromFlat(flat) {
    return memberNamesFromFlat(flat, "CountryList", "Country");
  }

  function sophosTypeToServiceUi(t) {
    let s = String(t || "").trim();
    if (s === "TCPorUDP") return "tcpudp";
    if (s === "IP") return "ip";
    if (s === "ICMP") return "icmp";
    if (s === "ICMPv6") return "icmpv6";
    return "tcpudp";
  }

  function serviceDetailRowsFromFlat(flat) {
    flat = flat || {};
    let byIx = {};
    Object.keys(flat).forEach(function (k) {
      let m = k.match(/^ServiceDetails\.ServiceDetail\.(\d+)\.(.+)$/);
      if (m) {
        let ix = parseInt(m[1], 10);
        let sub = m[2];
        if (!byIx[ix]) byIx[ix] = {};
        byIx[ix][sub] = flat[k];
      }
    });
    let keys = Object.keys(byIx)
      .map(function (x) {
        return parseInt(x, 10);
      })
      .sort(function (a, b) {
        return a - b;
      });
    if (!keys.length) {
      let one = {};
      if (flat["ServiceDetails.ServiceDetail.Protocol"])
        one.Protocol = flat["ServiceDetails.ServiceDetail.Protocol"];
      if (flat["ServiceDetails.ServiceDetail.SourcePort"])
        one.SourcePort = flat["ServiceDetails.ServiceDetail.SourcePort"];
      if (flat["ServiceDetails.ServiceDetail.DestinationPort"])
        one.DestinationPort = flat["ServiceDetails.ServiceDetail.DestinationPort"];
      if (flat["ServiceDetails.ServiceDetail.ProtocolName"])
        one.ProtocolName = flat["ServiceDetails.ServiceDetail.ProtocolName"];
      if (flat["ServiceDetails.ServiceDetail.ICMPType"])
        one.ICMPType = flat["ServiceDetails.ServiceDetail.ICMPType"];
      if (flat["ServiceDetails.ServiceDetail.ICMPCode"])
        one.ICMPCode = flat["ServiceDetails.ServiceDetail.ICMPCode"];
      if (Object.keys(one).length) return [one];
      return [{ Protocol: "TCP", SourcePort: "1:65535", DestinationPort: "" }];
    }
    return keys.map(function (ix) {
      return byIx[ix];
    });
  }

  /** Default source port range for new TCP/UDP detail rows (matches hs_flyout_merge). */
  let TCPUDP_SRC_DEFAULT = "1:65535";

  let SVC_TCPUDP_TRASH_SVG = (window.gcIcon
    ? window.gcIcon("delete", { size: "xs", cls: "gc-bridge-flyout__member-trash-svg" })
    : "");

  function buildTcpUdpDetailsTableShell() {
    return (
      '<div class="gc-bridge-flyout__members-table-wrap">' +
      '<table class="gc-bridge-flyout__members-table gc-hs-svc-tcpudp-table" aria-label="TCP or UDP service ports">' +
      "<colgroup>" +
      '<col class="gc-hs-svc-tcpudp-col-src" />' +
      '<col class="gc-hs-svc-tcpudp-col-dst" />' +
      '<col class="gc-hs-svc-tcpudp-col-proto" />' +
      '<col class="gc-hs-svc-tcpudp-col-actions" />' +
      "</colgroup>" +
      "<thead><tr>" +
      '<th scope="col">Source</th>' +
      '<th scope="col">Destination</th>' +
      '<th scope="col">Protocol</th>' +
      '<th scope="col" class="gc-bridge-flyout__members-actions-col"></th>' +
      "</tr></thead>" +
      '<tbody id="gc-hs-svc-tcpudp-tbody"></tbody>' +
      "</table></div>"
    );
  }

  /** Split flat ServiceDetail rows into committed (has destination) vs seed for the trailing blank row. */
  function splitTcpUdpRowsForRender(rows) {
    rows = rows && rows.length ? rows : [];
    let dataRows = [];
    let blankSeed = {};
    let empties = [];
    let i;
    for (i = 0; i < rows.length; i++) {
      let r = rows[i] || {};
      let dp = String(r.DestinationPort != null ? r.DestinationPort : "").trim();
      if (dp) {
        dataRows.push(r);
      } else {
        empties.push(r);
      }
    }
    if (empties.length) {
      blankSeed = empties[0];
      for (i = 1; i < empties.length; i++) {
        dataRows.push(empties[i]);
      }
    }
    return { dataRows: dataRows, blankSeed: blankSeed };
  }

  function appendTcpUdpTableRow(tb, row, isBlank) {
    let p = String((row && row.Protocol) || "TCP").toUpperCase();
    if (p !== "UDP") p = "TCP";
    let sp = String((row && row.SourcePort) || "").trim();
    if (isBlank && !sp) sp = TCPUDP_SRC_DEFAULT;
    let dp = String((row && row.DestinationPort) || "").trim();

    let tr = document.createElement("tr");
    tr.setAttribute("data-gc-svc-tcpudp-row", "1");
    if (isBlank) tr.setAttribute("data-gc-svc-tcpudp-blank", "1");

    let tdS = document.createElement("td");
    let inpS = document.createElement("input");
    inpS.type = "text";
    inpS.className = "gc-if-flyout__input mono gc-hs-svc-src";
    inpS.value = sp;
    inpS.setAttribute("aria-label", isBlank ? "New source port" : "Source port");
    tdS.appendChild(inpS);

    let tdD = document.createElement("td");
    let inpD = document.createElement("input");
    inpD.type = "text";
    inpD.className = "gc-if-flyout__input mono gc-hs-svc-dst";
    inpD.value = dp;
    inpD.setAttribute(
      "placeholder",
      isBlank ? "e.g. 443 (required to add another row)" : "e.g. 443 or 8000:9000",
    );
    inpD.setAttribute("aria-label", isBlank ? "New destination port" : "Destination port");
    tdD.appendChild(inpD);

    let tdP = document.createElement("td");
    let sel = document.createElement("select");
    sel.className =
      "gc-if-flyout__input gc-if-flyout__select gc-bridge-flyout__member-select gc-hs-svc-proto-select";
    sel.setAttribute("aria-label", isBlank ? "New protocol" : "Protocol");
    ["TCP", "UDP"].forEach(function (v) {
      let o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
    sel.value = p;
    tdP.appendChild(sel);

    let tdA = document.createElement("td");
    let rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn-icon gc-bridge-flyout__member-remove gc-hs-svc-tcpudp-rm";
    rm.innerHTML = SVC_TCPUDP_TRASH_SVG;
    if (isBlank) {
      rm.disabled = true;
      rm.classList.add("gc-bridge-flyout__member-remove--blank");
      rm.setAttribute("aria-label", "New port row");
      rm.setAttribute("title", "Enter a destination port to add another row");
    } else {
      rm.setAttribute("aria-label", "Remove row");
      rm.setAttribute("title", "Remove");
    }
    tdA.appendChild(rm);

    tr.appendChild(tdS);
    tr.appendChild(tdD);
    tr.appendChild(tdP);
    tr.appendChild(tdA);
    tb.appendChild(tr);
  }

  function renderTcpUdpServiceTable(slot, initRows) {
    let tb = slot.querySelector("#gc-hs-svc-tcpudp-tbody");
    if (!tb) return;
    let split = splitTcpUdpRowsForRender(initRows);
    tb.innerHTML = "";
    split.dataRows.forEach(function (r) {
      appendTcpUdpTableRow(tb, r, false);
    });
    appendTcpUdpTableRow(tb, split.blankSeed, true);
  }

  function readTcpUdpRowsFromTable(slot) {
    let tb = slot.querySelector("#gc-hs-svc-tcpudp-tbody");
    if (!tb) return [];
    let out = [];
    tb.querySelectorAll("tr[data-gc-svc-tcpudp-row]").forEach(function (tr) {
      if (tr.dataset.gcSvcTcpudpBlank === "1") return;
      let sel = tr.querySelector(".gc-hs-svc-proto-select");
      let spIn = tr.querySelector(".gc-hs-svc-src");
      let dpIn = tr.querySelector(".gc-hs-svc-dst");
      let proto = sel ? String(sel.value || "TCP").toUpperCase() : "TCP";
      out.push({
        Protocol: proto === "UDP" ? "UDP" : "TCP",
        SourcePort: spIn ? String(spIn.value || "").trim() : "",
        DestinationPort: dpIn ? String(dpIn.value || "").trim() : "",
      });
    });
    return out;
  }

  function promoteTcpUdpBlankRow(tr, slot) {
    tr.removeAttribute("data-gc-svc-tcpudp-blank");
    let rm = tr.querySelector(".gc-hs-svc-tcpudp-rm");
    if (rm) {
      rm.disabled = false;
      rm.classList.remove("gc-bridge-flyout__member-remove--blank");
      rm.setAttribute("aria-label", "Remove row");
      rm.setAttribute("title", "Remove");
    }
    let spIn = tr.querySelector(".gc-hs-svc-src");
    if (spIn && !String(spIn.value || "").trim()) spIn.value = TCPUDP_SRC_DEFAULT;
    let tb = slot.querySelector("#gc-hs-svc-tcpudp-tbody");
    if (tb) appendTcpUdpTableRow(tb, {}, true);
  }

  function serviceRowHtmlIp(row, idx) {
    let pn = String((row && row.ProtocolName) || "");
    return (
      '<div class="gc-hs-svc-detail-row gc-hs-svc-detail-row--ip" data-gc-svc-ix="' +
      idx +
      '">' +
      '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label">Protocol name</label>' +
      '<input type="text" class="gc-if-flyout__input mono gc-hs-svc-pname" value="' +
      escapeHtml(pn) +
      '" /></div>' +
      '<button type="button" class="gc-btn gc-btn--ghost gc-hs-svc-rm" aria-label="Remove row">Remove</button>' +
      "</div>"
    );
  }

  function serviceRowHtmlIcmp(row, idx, v6) {
    let t = String((row && row.ICMPType) || "");
    let c = String((row && row.ICMPCode) != null ? row.ICMPCode : v6 ? "" : "Any Code");
    return (
      '<div class="gc-hs-svc-detail-row gc-hs-svc-detail-row--icmp" data-gc-svc-ix="' +
      idx +
      '">' +
      '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label">ICMP type</label>' +
      '<input type="text" class="gc-if-flyout__input mono gc-hs-svc-icmp-type" value="' +
      escapeHtml(t) +
      '" /></div>' +
      '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label">ICMP code</label>' +
      '<input type="text" class="gc-if-flyout__input mono gc-hs-svc-icmp-code" value="' +
      escapeHtml(c) +
      '" /></div>' +
      '<button type="button" class="gc-btn gc-btn--ghost gc-hs-svc-rm" aria-label="Remove row">Remove</button>' +
      "</div>"
    );
  }

  function buildServiceDetailsInner(ui, rows) {
    rows = rows && rows.length ? rows : [{}];
    if (ui === "tcpudp") {
      return buildTcpUdpDetailsTableShell();
    }
    let parts = rows.map(function (r, i) {
      if (ui === "ip") return serviceRowHtmlIp(r, i);
      if (ui === "icmpv6") return serviceRowHtmlIcmp(r, i, true);
      return serviceRowHtmlIcmp(r, i, false);
    });
    return (
      parts.join("") +
      '<button type="button" class="gc-btn gc-btn--secondary gc-hs-svc-add">Add detail</button>'
    );
  }

  function buildServiceDetailsSlot(ui, rows) {
    let initTcp = "";
    if (ui === "tcpudp") {
      let ir = rows && rows.length ? rows : [{}];
      initTcp =
        '<textarea hidden id="gc-hs-svc-tcpudp-rows-init" class="gc-hs-json-init" aria-hidden="true">' +
        escapeHtml(JSON.stringify(ir)) +
        "</textarea>";
    }
    return (
      '<div id="gc-hs-svc-details-root" data-gc-svc-ui="' +
      escapeHtml(ui) +
      '">' +
      initTcp +
      buildServiceDetailsInner(ui, rows) +
      "</div>"
    );
  }

  function buildFqdnHostHtml(row, mode, opts) {
    opts = opts || {};
    let flat = (row && row.flat) || {};
    let fwHtml =
      mode === "add"
        ? buildFirewallPickerSection("add", opts.firewallIds || [], [])
        : buildFirewallPickerSection(
            "edit",
            assignedFirewallIdsFromRow(row),
            assignedFirewallIdsFromRow(row),
          );
    let nm = pick(flat, ["Name"]);
    let desc = pick(flat, ["Description"]);
    let fq = pick(flat, ["FQDN"]);
    let gsel = fqdnHostGroupNamesFromFlat(flat);
    return (
      fwHtml +
      '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label" for="gc-hs-fqdn-name">Name <span class="gc-if-flyout__req">*</span></label>' +
      '<input id="gc-hs-fqdn-name" type="text" class="gc-if-flyout__input mono" value="' +
      escapeHtml(nm) +
      '" /></div>' +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="Description"><label class="gc-if-flyout__label" for="gc-hs-fqdn-desc">Description</label>' +
      '<input id="gc-hs-fqdn-desc" type="text" class="gc-if-flyout__input" value="' +
      escapeHtml(desc) +
      '" /></div>' +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="FQDN"><label class="gc-if-flyout__label" for="gc-hs-fqdn-val">FQDN <span class="gc-if-flyout__req">*</span></label>' +
      '<input id="gc-hs-fqdn-val" type="text" class="gc-if-flyout__input mono" value="' +
      escapeHtml(fq) +
      '" placeholder="host.example.com" /></div>' +
      '<textarea hidden id="gc-hs-fqdn-hg-initial" class="gc-hs-json-init" aria-hidden="true">' +
      escapeHtml(JSON.stringify(gsel)) +
      "</textarea>" +
      buildNamesMultiselectSection(
        "FQDN host groups",
        "No FQDN host groups on selected firewalls.",
        "fqdn_hostgroup",
        false,
        "#gc-hs-fqdn-hg-initial",
        'data-gc-combine-field-keys="FQDNHostGroupList.FQDNHostGroup"',
      )
    );
  }

  function buildServiceHtml(row) {
    let flat = (row && row.flat) || {};
    let ui = sophosTypeToServiceUi(flat.Type);
    let nm = pick(flat, ["Name"]);
    let desc = pick(flat, ["Description"]);
    let rowsD = serviceDetailRowsFromFlat(flat);
    let typeRadios = ["tcpudp", "ip", "icmp", "icmpv6"].map(function (v) {
      return (
        '<label class="gc-hs-ip-host-flyout__radio"><input type="radio" name="gc-hs-svc-type" value="' +
        v +
        '"' +
        (ui === v ? " checked" : "") +
        " /> " +
        (v === "tcpudp"
          ? "TCP or UDP"
          : v === "ip"
            ? "IP"
            : v === "icmp"
              ? "ICMP"
              : "ICMPv6") +
        "</label>"
      );
    });
    return (
      buildFirewallPickerSection(
        "edit",
        assignedFirewallIdsFromRow(row),
        assignedFirewallIdsFromRow(row),
      ) +
      '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label" for="gc-hs-svc-name">Name <span class="gc-if-flyout__req">*</span></label>' +
      '<input id="gc-hs-svc-name" type="text" class="gc-if-flyout__input mono" value="' +
      escapeHtml(nm) +
      '" /></div>' +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="Description"><label class="gc-if-flyout__label" for="gc-hs-svc-desc">Description</label>' +
      '<input id="gc-hs-svc-desc" type="text" class="gc-if-flyout__input" value="' +
      escapeHtml(desc) +
      '" /></div>' +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="Type"><span class="gc-if-flyout__label">Type</span><div class="gc-hs-ip-host-flyout__radio-row">' +
      typeRadios.join(" ") +
      "</div></div>" +
      '<div class="gc-if-flyout__field"><span class="gc-if-flyout__label">Service details</span>' +
      buildServiceDetailsSlot(ui, rowsD) +
      "</div>"
    );
  }

  function buildServiceHtmlAdd(opts) {
    opts = opts || {};
    let ui = "tcpudp";
    let typeRadios = ["tcpudp", "ip", "icmp", "icmpv6"].map(function (v) {
      return (
        '<label class="gc-hs-ip-host-flyout__radio"><input type="radio" name="gc-hs-svc-type" value="' +
        v +
        '"' +
        (ui === v ? " checked" : "") +
        " /> " +
        (v === "tcpudp"
          ? "TCP or UDP"
          : v === "ip"
            ? "IP"
            : v === "icmp"
              ? "ICMP"
              : "ICMPv6") +
        "</label>"
      );
    });
    return (
      buildFirewallPickerSection("add", opts.firewallIds || [], []) +
      '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label" for="gc-hs-svc-name">Name <span class="gc-if-flyout__req">*</span></label>' +
      '<input id="gc-hs-svc-name" type="text" class="gc-if-flyout__input mono" value="" /></div>' +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="Description"><label class="gc-if-flyout__label" for="gc-hs-svc-desc">Description</label>' +
      '<input id="gc-hs-svc-desc" type="text" class="gc-if-flyout__input" value="" /></div>' +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="Type"><span class="gc-if-flyout__label">Type</span><div class="gc-hs-ip-host-flyout__radio-row">' +
      typeRadios.join(" ") +
      "</div></div>" +
      '<div class="gc-if-flyout__field"><span class="gc-if-flyout__label">Service details</span>' +
      buildServiceDetailsSlot(ui, [{}]) +
      "</div>"
    );
  }

  function macUiFromFlat(flat) {
    let t = String((flat && flat.Type) || "").trim();
    if (t === "MACList" || /list/i.test(t)) return "maclist";
    return "macaddress";
  }

  function macListTextFromFlat(flat) {
    let parts = memberNamesFromFlat(flat || {}, "MACList", "MAC");
    return parts.join(", ");
  }

  function buildMacHostHtml(row, mode, opts) {
    opts = opts || {};
    let flat = (row && row.flat) || {};
    let ui = macUiFromFlat(flat);
    let nm = pick(flat, ["Name"]);
    let desc = pick(flat, ["Description"]);
    let mac = pick(flat, ["MACAddress"]);
    let listTxt = macListTextFromFlat(flat);
    let fwHtml =
      mode === "add"
        ? buildFirewallPickerSection("add", opts.firewallIds || [], [])
        : buildFirewallPickerSection(
            "edit",
            assignedFirewallIdsFromRow(row),
            assignedFirewallIdsFromRow(row),
          );
    return (
      fwHtml +
      '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label" for="gc-hs-mac-name">Name <span class="gc-if-flyout__req">*</span></label>' +
      '<input id="gc-hs-mac-name" type="text" class="gc-if-flyout__input mono" value="' +
      escapeHtml(nm) +
      '" /></div>' +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="Description"><label class="gc-if-flyout__label" for="gc-hs-mac-desc">Description</label>' +
      '<input id="gc-hs-mac-desc" type="text" class="gc-if-flyout__input" value="' +
      escapeHtml(desc) +
      '" /></div>' +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="Type"><span class="gc-if-flyout__label">Type</span>' +
      '<label class="gc-hs-ip-host-flyout__radio"><input type="radio" name="gc-hs-mac-type" value="macaddress"' +
      (ui === "maclist" ? "" : " checked") +
      " /> MAC address</label> " +
      '<label class="gc-hs-ip-host-flyout__radio"><input type="radio" name="gc-hs-mac-type" value="maclist"' +
      (ui === "maclist" ? " checked" : "") +
      " /> MAC list</label></div>" +
      '<div id="gc-hs-mac-slot-addr" class="gc-if-flyout__field gc-hs-mac-cond"' +
      (ui === "maclist" ? ' style="display:none"' : "") +
      ' data-gc-combine-field-keys="MACAddress"><label class="gc-if-flyout__label" for="gc-hs-mac-addr">MAC address</label>' +
      '<input id="gc-hs-mac-addr" type="text" class="gc-if-flyout__input mono" value="' +
      escapeHtml(mac) +
      '" /></div>' +
      '<div id="gc-hs-mac-slot-list" class="gc-if-flyout__field gc-hs-mac-cond"' +
      (ui === "maclist" ? "" : ' style="display:none"') +
      ' data-gc-combine-field-keys="MACList.MAC"><label class="gc-if-flyout__label" for="gc-hs-mac-list">MAC list</label>' +
      '<textarea id="gc-hs-mac-list" class="gc-if-flyout__input gc-hs-ip-host-flyout__textarea" rows="4" placeholder="Comma or newline separated">' +
      escapeHtml(listTxt) +
      "</textarea></div>"
    );
  }

  let GROUP_MEMBER_ET = {
    ip_hostgroup: "ip_host",
    fqdn_hostgroup: "fqdn_host",
    service_group: "service",
  };

  let GROUP_MEMBER_LABEL = {
    ip_hostgroup: "IP hosts",
    fqdn_hostgroup: "FQDN hosts",
    service_group: "Services",
  };

  function buildGroupHtml(entityType, row, mode, opts) {
    opts = opts || {};
    let schema = getEntitySchema(entityType) || {};
    let fields = schema.fields || {};
    let nameCfg = fields.name || {};
    let descCfg = fields.description || {};
    let membersCfg = fields.members || {};
    let met = GROUP_MEMBER_ET[entityType] || "ip_host";
    let flat = (row && row.flat) || {};
    let nm = pick(flat, ["Name"]);
    let desc = pick(flat, ["Description"]);
    let listKey =
      entityType === "ip_hostgroup"
        ? "HostList"
        : entityType === "fqdn_hostgroup"
          ? "FQDNHostList"
          : "ServiceList";
    let itemKey =
      entityType === "fqdn_hostgroup"
        ? "FQDNHost"
        : entityType === "service_group"
          ? "Service"
          : "Host";
    if (membersCfg.listKey) listKey = String(membersCfg.listKey);
    if (membersCfg.itemKey) itemKey = String(membersCfg.itemKey);
    let members = memberNamesFromFlat(flat, listKey, itemKey);
    let memberColKey = listKey + "." + itemKey;
    let fwHtml =
      mode === "add"
        ? buildFirewallPickerSection("add", opts.firewallIds || [], [])
        : buildFirewallPickerSection(
            "edit",
            assignedFirewallIdsFromRow(row),
            assignedFirewallIdsFromRow(row),
          );
    return (
      fwHtml +
      '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label" for="gc-hs-grp-name">' +
      escapeHtml(String(nameCfg.label || "Name")) +
      ' <span class="gc-if-flyout__req">*</span></label>' +
      '<input id="gc-hs-grp-name" type="text" class="gc-if-flyout__input mono" value="' +
      escapeHtml(nm) +
      '"' +
      htmlAttrs({ maxlength: nameCfg.maxLength || null }) +
      " /></div>" +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="Description"><label class="gc-if-flyout__label" for="gc-hs-grp-desc">' +
      escapeHtml(String(descCfg.label || "Description")) +
      "</label>" +
      '<input id="gc-hs-grp-desc" type="text" class="gc-if-flyout__input" value="' +
      escapeHtml(desc) +
      '"' +
      htmlAttrs({ maxlength: descCfg.maxLength || null }) +
      " /></div>" +
      '<textarea hidden id="gc-hs-grp-mem-initial" class="gc-hs-json-init" aria-hidden="true">' +
      escapeHtml(JSON.stringify(members)) +
      "</textarea>" +
      buildNamesMultiselectSection(
        String(membersCfg.label || GROUP_MEMBER_LABEL[entityType] || "Members"),
        String(membersCfg.emptyText || "No members synced on selected firewalls."),
        String(membersCfg.sourceEntity || met),
        false,
        "#gc-hs-grp-mem-initial",
        'data-gc-combine-field-keys="' + escapeHtml(memberColKey) + '"',
      )
    );
  }

  function buildCountryListboxSection(initialCodes) {
    return (
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="CountryList.Country">' +
      '<span class="gc-if-flyout__label">Countries</span>' +
      '<div class="gc-hs-country-ms" data-gc-hs-country-ms="1">' +
      '<textarea hidden id="gc-hs-ctry-sel-initial" class="gc-hs-json-init" aria-hidden="true">' +
      escapeHtml(JSON.stringify(initialCodes || [])) +
      "</textarea>" +
      '<p class="gc-hs-country-ms-summary muted" aria-live="polite">Loading…</p>' +
      '<div class="gc-hs-country-ms-search-wrap">' +
      '<input type="search" class="gc-if-flyout__input gc-hs-country-ms-search" placeholder="Search countries" autocomplete="off" aria-label="Search countries" />' +
      "</div>" +
      '<div class="gc-hs-country-ms-listbox gc-hs-ip-host-flyout__hg-box" role="listbox" aria-multiselectable="true"></div>' +
      '<p class="gc-hs-country-ms-empty muted" hidden>No reference countries yet. Sync <strong>Country groups</strong> from a firewall so the built-in <strong>All Countries</strong> group can populate the list.</p>' +
      '<ul class="gc-hs-ip-host-flyout__hg-pills" aria-label="Selected countries"></ul>' +
      "</div></div>"
    );
  }

  function buildCountryHtml(row, mode, opts) {
    opts = opts || {};
    let flat = (row && row.flat) || {};
    let nm = pick(flat, ["Name"]);
    let desc = pick(flat, ["Description"]);
    let countries = countryNamesFromFlat(flat);
    let fwHtml =
      mode === "add"
        ? buildFirewallPickerSection("add", opts.firewallIds || [], [])
        : buildFirewallPickerSection(
            "edit",
            assignedFirewallIdsFromRow(row),
            assignedFirewallIdsFromRow(row),
          );
    return (
      fwHtml +
      '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label" for="gc-hs-ctry-name">Name <span class="gc-if-flyout__req">*</span></label>' +
      '<input id="gc-hs-ctry-name" type="text" class="gc-if-flyout__input mono" value="' +
      escapeHtml(nm) +
      '" /></div>' +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="Description"><label class="gc-if-flyout__label" for="gc-hs-ctry-desc">Description</label>' +
      '<input id="gc-hs-ctry-desc" type="text" class="gc-if-flyout__input" value="' +
      escapeHtml(desc) +
      '" /></div>' +
      buildCountryListboxSection(countries)
    );
  }

  globalThis.gcHsBuildFlyoutFieldsHtml = function (entityType, row, mode, opts) {
    let et = String(entityType || "").trim();
    if (et === "fqdn_host") return buildFqdnHostHtml(row, mode, opts);
    if (et === "service") return mode === "add" ? buildServiceHtmlAdd(opts) : buildServiceHtml(row);
    if (et === "mac_host") return buildMacHostHtml(row, mode, opts);
    if (GROUP_MEMBER_ET[et]) return buildGroupHtml(et, row, mode, opts);
    if (et === "country_group") return buildCountryHtml(row, mode, opts);
    return '<p class="muted">Unsupported entity type.</p>';
  };

  function selectedNamesFromMs(ms) {
    let out = [];
    if (!ms) return out;
    ms.querySelectorAll('input[type="checkbox"][data-gc-hs-mem-name]').forEach(function (cb) {
      if (cb.checked) {
        let n = cb.dataset.gcHsMemName;
        if (n) out.push(n);
      }
    });
    return out;
  }

  function selectedCountryCodesFromMs(wrap) {
    let out = [];
    if (!wrap) return out;
    wrap.querySelectorAll('input[type="checkbox"][data-gc-hs-country-code]').forEach(function (cb) {
      if (cb.checked) {
        let n = cb.dataset.gcHsCountryCode;
        if (n) out.push(n);
      }
    });
    return out;
  }

  function hydrateNamesMultiselect(root, ms) {
    if (!root || !ms) return;
    let url = typeof globalThis.gcHsCachedNamesAggregateUrl === "string" ? globalThis.gcHsCachedNamesAggregateUrl : "";
    let et = String(ms.dataset.namesEntityType || "").trim();
    let readOnly = ms.dataset.msReadonly === "1";
    let trigger = ms.querySelector(".gc-hs-ip-host-flyout__hg-trigger");
    let triggerText = ms.querySelector(".gc-hs-ip-host-flyout__hg-trigger-text");
    let dropdown = ms.querySelector(".gc-hs-ip-host-flyout__hg-dropdown");
    let search = ms.querySelector(".gc-hs-ip-host-flyout__hg-search");
    let optsRoot = ms.querySelector(".gc-hs-ip-host-flyout__hg-ms-options");
    let emptyEl = ms.querySelector(".gc-hs-entity-ms-empty");
    let selected = selectedNamesFromMs(ms);
    if (!selected.length && !ms.dataset.gcHsSeedApplied) {
      let srcSel = ms.dataset.initSource;
      if (srcSel && root) {
        let te = root.querySelector(srcSel);
        if (te && String(te.value || te.textContent || "").trim()) {
          try {
            let parsed = JSON.parse(String(te.value || te.textContent).trim());
            if (Array.isArray(parsed)) selected = parsed.map(String);
          } catch (eSeed) {}
        }
        ms.dataset.gcHsSeedApplied = "1";
      }
    }

    function setOpen(open) {
      if (!dropdown) return;
      dropdown.hidden = !open;
      if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function syncTrigger() {
      let chipsFn =
        typeof globalThis.gcRenderMultiselectTriggerChips === "function"
          ? globalThis.gcRenderMultiselectTriggerChips
          : null;
      let chipsEl = ms.querySelector(".gc-hs-ip-host-flyout__hg-trigger-chips");
      let n = selected.length;
      if (n === 0) {
        if (triggerText) {
          triggerText.textContent = hgSummary(0);
          triggerText.classList.remove("gc-ms-trigger-sr");
        }
        if (chipsEl) chipsEl.innerHTML = "";
        return;
      }
      if (triggerText) {
        triggerText.textContent = hgSummary(n);
        triggerText.classList.add("gc-ms-trigger-sr");
      }
      if (!chipsEl || !chipsFn) {
        if (triggerText) triggerText.classList.remove("gc-ms-trigger-sr");
        return;
      }
      let items = [];
      selected
        .slice()
        .sort(function (a, b) {
          return a.toLowerCase().localeCompare(b.toLowerCase());
        })
        .forEach(function (nm) {
          items.push({
            label: nm,
            title: nm,
            removeLabel: "Remove " + nm,
            onRemove: function () {
              ms.querySelectorAll('input[type="checkbox"][data-gc-hs-mem-name]').forEach(
                function (hit) {
                  if (hit.dataset.gcHsMemName === nm) {
                    hit.checked = false;
                    hit.dispatchEvent(new Event("change", { bubbles: true }));
                  }
                },
              );
            },
          });
        });
      chipsFn(chipsEl, items);
    }

    function renderGroups(groups) {
      if (!optsRoot) return;
      optsRoot.innerHTML = "";
      let selSet = {};
      selected.forEach(function (s) {
        selSet[s] = true;
      });
      (groups || []).forEach(function (g) {
        let name = String(g && g.name != null ? g.name : "").trim();
        if (!name) return;
        let desc = String(g && g.description != null ? g.description : "").trim();
        let lab = document.createElement("label");
        lab.className = "gc-multiselect__option gc-hs-ip-host-flyout__hg-option";
        let cb = document.createElement("input");
        cb.type = "checkbox";
        cb.setAttribute("data-gc-hs-mem-name", name);
        cb.checked = !!selSet[name];
        if (readOnly) cb.disabled = true;
        cb.addEventListener("change", function () {
          selected = selectedNamesFromMs(ms);
          syncTrigger();
        });
        let textWrap = document.createElement("span");
        textWrap.className = "gc-hs-ip-host-flyout__hg-opt-text";
        let nameEl = document.createElement("span");
        nameEl.className = "gc-hs-ip-host-flyout__hg-opt-name mono";
        nameEl.textContent = name;
        textWrap.appendChild(nameEl);
        if (desc) {
          let sep = document.createElement("span");
          sep.className = "muted";
          sep.textContent = " · " + desc;
          textWrap.appendChild(sep);
        }
        if (g && g.on_all_firewalls === false) {
          let part = document.createElement("span");
          part.className = "gc-hs-ip-host-flyout__hg-opt-partial muted";
          part.textContent = " · not on all selected firewalls";
          textWrap.appendChild(part);
        }
        lab.appendChild(cb);
        lab.appendChild(textWrap);
        optsRoot.appendChild(lab);
      });
      if (emptyEl) {
        let show = !groups || groups.length === 0;
        emptyEl.hidden = !show;
      }
      syncTrigger();
    }

    if (ms.dataset.gcHsNmUiBound !== "1") {
      ms.dataset.gcHsNmUiBound = "1";
      if (trigger && dropdown) {
        trigger.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          let next = dropdown.hidden;
          if (root) {
            root.querySelectorAll(".gc-hs-ip-host-flyout__hg-dropdown").forEach(function (d) {
              d.hidden = true;
            });
            root.querySelectorAll(".gc-hs-ip-host-flyout__fw-dropdown").forEach(function (d) {
              d.hidden = true;
            });
            root.querySelectorAll(".gc-hs-ip-host-flyout__hg-trigger").forEach(function (t) {
              t.setAttribute("aria-expanded", "false");
            });
            root.querySelectorAll(".gc-hs-ip-host-flyout__fw-trigger").forEach(function (t) {
              t.setAttribute("aria-expanded", "false");
            });
          }
          setOpen(next);
          if (next && search) {
            try {
              search.focus();
            } catch (e2) {}
          }
        });
      }
      if (search) {
        search.addEventListener("input", function () {
          let q = String(search.value || "")
            .trim()
            .toLowerCase();
          if (!optsRoot) return;
          optsRoot.querySelectorAll(".gc-hs-ip-host-flyout__hg-option").forEach(function (lab) {
            let cb = lab.querySelector("[data-gc-hs-mem-name]");
            let nm = cb ? String(cb.dataset.gcHsMemName || "").toLowerCase() : "";
            lab.style.display = !q || nm.indexOf(q) !== -1 ? "" : "none";
          });
        });
        search.addEventListener("click", function (e) {
          e.stopPropagation();
        });
      }
      if (dropdown) {
        dropdown.addEventListener("mousedown", function (e) {
          e.stopPropagation();
        });
      }
    }

    let fwIds = collectFwIdsFromFlyoutDom(root);
    if (!url || !et || !fwIds.length) {
      renderGroups([]);
      if (triggerText) triggerText.textContent = !fwIds.length ? "Select firewalls first" : "—";
      return;
    }
    let cfgN =
      typeof globalThis.gcHsEntityTarget === "string" && globalThis.gcHsEntityTarget === "configuration";
    let bodyObj = cfgN
      ? { configuration_ids: fwIds, entity_type: et }
      : { firewall_ids: fwIds, entity_type: et };
    fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        if (!x.ok || !x.j || !Array.isArray(x.j.groups)) {
          renderGroups([]);
          return;
        }
        renderGroups(x.j.groups);
      })
      .catch(function () {
        renderGroups([]);
      });
  }

  function hydrateCountryMultiselect(root, wrap) {
    if (!wrap) return;
    let url =
      typeof globalThis.gcHsReferenceCountriesUrl === "string"
        ? globalThis.gcHsReferenceCountriesUrl
        : "";
    let summaryEl = wrap.querySelector(".gc-hs-country-ms-summary");
    let search = wrap.querySelector(".gc-hs-country-ms-search");
    let listbox = wrap.querySelector(".gc-hs-country-ms-listbox");
    let emptyEl = wrap.querySelector(".gc-hs-country-ms-empty");
    let pillsEl = wrap.querySelector(".gc-hs-ip-host-flyout__hg-pills");
    let seedTa = wrap.querySelector("#gc-hs-ctry-sel-initial");
    let selected = [];
    if (seedTa && String(seedTa.value || seedTa.textContent || "").trim()) {
      try {
        let parsed0 = JSON.parse(String(seedTa.value || seedTa.textContent).trim());
        if (Array.isArray(parsed0)) selected = parsed0.map(String);
      } catch (e0) {}
    }
    let initialSelectedSet = {};
    selected.forEach(function (s) {
      if (s) initialSelectedSet[String(s)] = true;
    });

    function syncSummary(totalOpts) {
      if (!summaryEl) return;
      let n = selectedCountryCodesFromMs(wrap).length;
      let t = typeof totalOpts === "number" ? totalOpts : 0;
      summaryEl.textContent = t ? hgSummary(n) + " · " + t + " available" : hgSummary(n);
    }

    function syncPills() {
      if (!pillsEl) return;
      pillsEl.innerHTML = "";
      selectedCountryCodesFromMs(wrap)
        .slice()
        .sort(function (a, b) {
          return a.toLowerCase().localeCompare(b.toLowerCase());
        })
        .forEach(function (nm) {
          let li = document.createElement("li");
          li.className = "gc-hs-ip-host-flyout__hg-pill mono";
          li.textContent = nm;
          pillsEl.appendChild(li);
        });
    }

    function renderOptions(apiRows, extraCodes) {
      if (!listbox) return;
      listbox.innerHTML = "";
      let orderMap = {};
      (apiRows || []).forEach(function (r) {
        let c = String((r && r.code) || "").trim();
        if (!c) return;
        let so =
          r && r.sort_order != null && !isNaN(parseInt(String(r.sort_order), 10))
            ? parseInt(String(r.sort_order), 10)
            : 0;
        orderMap[c] = so;
      });
      let allCodes = Object.keys(orderMap);
      let seen = {};
      allCodes.forEach(function (c) {
        seen[c] = true;
      });
      (extraCodes || []).forEach(function (c) {
        let x = String(c || "").trim();
        if (!x || seen[x]) return;
        seen[x] = true;
        allCodes.push(x);
      });
      allCodes.sort(function (a, b) {
        let ao = Object.prototype.hasOwnProperty.call(orderMap, a) ? orderMap[a] : 999999;
        let bo = Object.prototype.hasOwnProperty.call(orderMap, b) ? orderMap[b] : 999999;
        if (ao !== bo) return ao - bo;
        return a.toLowerCase().localeCompare(b.toLowerCase());
      });
      allCodes.forEach(function (code) {
        let inRef = Object.prototype.hasOwnProperty.call(orderMap, code);
        let lab = document.createElement("label");
        lab.className =
          "gc-multiselect__option gc-hs-ip-host-flyout__hg-option gc-hs-country-ms-option";
        let cb = document.createElement("input");
        cb.type = "checkbox";
        cb.setAttribute("data-gc-hs-country-code", code);
        cb.checked = !!initialSelectedSet[code];
        cb.addEventListener("change", function () {
          syncSummary(allCodes.length);
          syncPills();
        });
        let textWrap = document.createElement("span");
        textWrap.className = "gc-hs-ip-host-flyout__hg-opt-text";
        let nameEl = document.createElement("span");
        nameEl.className = "gc-hs-ip-host-flyout__hg-opt-name mono";
        nameEl.textContent = code;
        textWrap.appendChild(nameEl);
        if (!inRef) {
          let note = document.createElement("span");
          note.className = "muted";
          note.textContent = " · not in reference list";
          textWrap.appendChild(note);
        }
        lab.appendChild(cb);
        lab.appendChild(textWrap);
        listbox.appendChild(lab);
      });
      if (emptyEl) {
        let show = allCodes.length === 0;
        emptyEl.hidden = !show;
      }
      syncSummary(allCodes.length);
      syncPills();
    }

    if (wrap.dataset.gcHsCountryUiBound !== "1") {
      wrap.dataset.gcHsCountryUiBound = "1";
      if (search) {
        search.addEventListener("input", function () {
          let q = String(search.value || "")
            .trim()
            .toLowerCase();
          if (!listbox) return;
          listbox.querySelectorAll(".gc-hs-country-ms-option").forEach(function (lab) {
            let cb = lab.querySelector("[data-gc-hs-country-code]");
            let nm = cb ? String(cb.dataset.gcHsCountryCode || "").toLowerCase() : "";
            lab.style.display = !q || nm.indexOf(q) !== -1 ? "" : "none";
          });
        });
      }
    }

    if (!url) {
      renderOptions([], selected);
      if (summaryEl) summaryEl.textContent = "Reference list unavailable";
      return;
    }
    fetch(url, { method: "GET", credentials: "same-origin" })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        let rows = x.ok && x.j && Array.isArray(x.j.countries) ? x.j.countries : [];
        let extras = [];
        selected.forEach(function (c) {
          if (c && extras.indexOf(c) === -1) extras.push(c);
        });
        renderOptions(rows, extras);
      })
      .catch(function () {
        renderOptions([], selected);
        if (summaryEl) summaryEl.textContent = "Could not load countries";
      });
  }

  function applyServiceTypeUi(root, ui) {
    let slot = root.querySelector("#gc-hs-svc-details-root");
    if (!slot) return;
    slot.removeAttribute("data-gc-hs-svc-bound");
    slot.setAttribute("data-gc-svc-ui", ui);
    let initTcp = "";
    if (ui === "tcpudp") {
      initTcp =
        '<textarea hidden id="gc-hs-svc-tcpudp-rows-init" class="gc-hs-json-init" aria-hidden="true">' +
        escapeHtml(JSON.stringify([{}])) +
        "</textarea>";
    }
    slot.innerHTML =
      initTcp + buildServiceDetailsInner(ui, ui === "tcpudp" ? [] : [{}]);
    bindServiceDetailButtons(root);
  }

  function bindServiceDetailButtons(root) {
    let slot = root.querySelector("#gc-hs-svc-details-root");
    if (!slot || slot.dataset.gcHsSvcBound === "1") return;
    slot.dataset.gcHsSvcBound = "1";

    let ui0 = String(slot.dataset.gcSvcUi || "tcpudp");
    if (ui0 === "tcpudp") {
      let ta0 = slot.querySelector("#gc-hs-svc-tcpudp-rows-init");
      let initTcp = [{}];
      if (ta0 && ta0.value && ta0.value.trim()) {
        try {
          let parsed = JSON.parse(ta0.value);
          initTcp = Array.isArray(parsed) ? parsed : [{}];
        } catch (e0) {
          initTcp = [{}];
        }
      }
      renderTcpUdpServiceTable(slot, initTcp);
    }

    slot.addEventListener("input", function (e) {
      let t = e.target;
      if (!t || !t.classList || !t.classList.contains("gc-hs-svc-dst")) return;
      let sl = root.querySelector("#gc-hs-svc-details-root");
      if (!sl) return;
      let ui = String(sl.dataset.gcSvcUi || "");
      if (ui !== "tcpudp") return;
      let tr = t.closest("tr[data-gc-svc-tcpudp-row]");
      if (!tr || tr.dataset.gcSvcTcpudpBlank !== "1") return;
      if (!String(t.value || "").trim()) return;
      promoteTcpUdpBlankRow(tr, sl);
    });

    slot.addEventListener("click", function (e) {
      let t = e.target;
      if (!t || !t.closest) return;
      let sl = root.querySelector("#gc-hs-svc-details-root");
      if (!sl) return;
      let ui = String(sl.dataset.gcSvcUi || "tcpudp");

      let rmTcp = t.closest(".gc-hs-svc-tcpudp-rm");
      if (rmTcp && !rmTcp.disabled) {
        e.preventDefault();
        let trR = rmTcp.closest("tr[data-gc-svc-tcpudp-row]");
        if (trR) trR.remove();
        renderTcpUdpServiceTable(sl, readTcpUdpRowsFromTable(sl));
        return;
      }

      let add = t.closest(".gc-hs-svc-add");
      let rm = t.closest(".gc-hs-svc-rm");
      if (add) {
        e.preventDefault();
        if (ui === "tcpudp") return;
        let rows = sl.querySelectorAll(".gc-hs-svc-detail-row");
        let ix = rows.length;
        let wrap = document.createElement("div");
        if (ui === "ip") wrap.innerHTML = serviceRowHtmlIp({}, ix);
        else if (ui === "icmpv6") wrap.innerHTML = serviceRowHtmlIcmp({}, ix, true);
        else wrap.innerHTML = serviceRowHtmlIcmp({}, ix, false);
        let nu = wrap.firstElementChild;
        if (nu) add.parentNode.insertBefore(nu, add);
      }
      if (rm) {
        e.preventDefault();
        let row = rm.closest(".gc-hs-svc-detail-row");
        if (row && sl.querySelectorAll(".gc-hs-svc-detail-row").length > 1) row.remove();
      }
    });
  }

  globalThis.gcHsHydrateHsEntityFields = function (root, entityType, row, mode) {
    if (!root) return;
    let et = String(entityType || "").trim();
    root.querySelectorAll("[data-gc-hs-names-ms]").forEach(function (ms) {
      hydrateNamesMultiselect(root, ms);
    });
    root.querySelectorAll("[data-gc-hs-country-ms]").forEach(function (w) {
      hydrateCountryMultiselect(root, w);
    });
    if (et === "service") {
      bindServiceDetailButtons(root);
      root.querySelectorAll('input[name="gc-hs-svc-type"]').forEach(function (rb) {
        if (rb.dataset.gcHsSvcTypeBound === "1") return;
        rb.dataset.gcHsSvcTypeBound = "1";
        rb.addEventListener("change", function () {
          if (!rb.checked) return;
          applyServiceTypeUi(root, String(rb.value || "").trim());
        });
      });
    }
    if (et === "mac_host") {
      root.querySelectorAll('input[name="gc-hs-mac-type"]').forEach(function (rb) {
        if (rb.dataset.gcHsMacTypeBound === "1") return;
        rb.dataset.gcHsMacTypeBound = "1";
        rb.addEventListener("change", function () {
          if (!rb.checked) return;
          let v = String(rb.value || "").trim();
          let a = root.querySelector("#gc-hs-mac-slot-addr");
          let l = root.querySelector("#gc-hs-mac-slot-list");
          if (a) a.style.display = v === "maclist" ? "none" : "";
          if (l) l.style.display = v === "maclist" ? "" : "none";
        });
      });
    }
  };

  globalThis.gcHsOnFlyoutFirewallSelectionChange = function (root) {
    if (!root) return;
    root.querySelectorAll("[data-gc-hs-names-ms]").forEach(function (ms) {
      hydrateNamesMultiselect(root, ms);
    });
  };

  function collectServiceDetailRows(root) {
    let ui = "tcpudp";
    let r0 = root.querySelector('input[name="gc-hs-svc-type"]:checked');
    if (r0) ui = String(r0.value || "").trim() || "tcpudp";
    let out = [];
    if (ui === "tcpudp") {
      let slTcp = root.querySelector("#gc-hs-svc-details-root");
      readTcpUdpRowsFromTable(slTcp || root).forEach(function (r) {
        out.push({
          protocol: r.Protocol,
          source_port: r.SourcePort,
          dest_port: r.DestinationPort,
        });
      });
    } else {
      root.querySelectorAll(".gc-hs-svc-detail-row").forEach(function (row) {
        if (ui === "ip") {
          let pn = row.querySelector(".gc-hs-svc-pname");
          out.push({ protocol_name: pn ? String(pn.value || "").trim() : "" });
        } else {
          let it = row.querySelector(".gc-hs-svc-icmp-type");
          let ic = row.querySelector(".gc-hs-svc-icmp-code");
          out.push({
            icmp_type: it ? String(it.value || "").trim() : "",
            icmp_code: ic ? String(ic.value || "").trim() : "",
          });
        }
      });
    }
    return { service_type_ui: ui, service_detail_rows: out };
  }

  globalThis.gcHsCollectFlyoutEntityForm = function (root, entityType) {
    let et = String(entityType || "").trim();
    if (et === "fqdn_host") {
      let n = root.querySelector("#gc-hs-fqdn-name");
      let d = root.querySelector("#gc-hs-fqdn-desc");
      let f = root.querySelector("#gc-hs-fqdn-val");
      let ms = root.querySelector("[data-gc-hs-names-ms]");
      return {
        name: n ? String(n.value || "").trim() : "",
        description: d ? String(d.value || "").trim() : "",
        fqdn: f ? String(f.value || "").trim() : "",
        fqdn_host_groups: ms ? selectedNamesFromMs(ms) : [],
      };
    }
    if (et === "service") {
      let sn = root.querySelector("#gc-hs-svc-name");
      let sd = root.querySelector("#gc-hs-svc-desc");
      let svc = collectServiceDetailRows(root);
      svc.name = sn ? String(sn.value || "").trim() : "";
      svc.description = sd ? String(sd.value || "").trim() : "";
      return svc;
    }
    if (et === "mac_host") {
      let mn = root.querySelector("#gc-hs-mac-name");
      let md = root.querySelector("#gc-hs-mac-desc");
      let mt = root.querySelector('input[name="gc-hs-mac-type"]:checked');
      let ui = mt ? String(mt.value || "").trim() : "macaddress";
      let ma = root.querySelector("#gc-hs-mac-addr");
      let ml = root.querySelector("#gc-hs-mac-list");
      return {
        name: mn ? String(mn.value || "").trim() : "",
        description: md ? String(md.value || "").trim() : "",
        mac_host_type_ui: ui,
        mac_address: ma ? String(ma.value || "").trim() : "",
        mac_list: ml ? String(ml.value || "") : "",
      };
    }
    if (GROUP_MEMBER_ET[et]) {
      let gn = root.querySelector("#gc-hs-grp-name");
      let gd = root.querySelector("#gc-hs-grp-desc");
      let gms = root.querySelector("[data-gc-hs-names-ms]");
      let mem = gms ? selectedNamesFromMs(gms) : [];
      if (et === "service_group") {
        return {
          name: gn ? String(gn.value || "").trim() : "",
          description: gd ? String(gd.value || "").trim() : "",
          member_services: mem,
        };
      }
      return {
        name: gn ? String(gn.value || "").trim() : "",
        description: gd ? String(gd.value || "").trim() : "",
        member_hosts: mem,
      };
    }
    if (et === "country_group") {
      let cn = root.querySelector("#gc-hs-ctry-name");
      let cd = root.querySelector("#gc-hs-ctry-desc");
      let cw = root.querySelector("[data-gc-hs-country-ms]");
      let parts = cw ? selectedCountryCodesFromMs(cw) : [];
      return {
        name: cn ? String(cn.value || "").trim() : "",
        description: cd ? String(cd.value || "").trim() : "",
        countries: parts,
      };
    }
    return { name: "" };
  };

  globalThis.gcHsBuildFirewallPickerSectionHtml = buildFirewallPickerSection;
})();
