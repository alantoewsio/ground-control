/**
 * DHCP flyout: Add / Edit forms for dhcp_server (IPv4), dhcp_server_ipv6 and
 * dhcp_relay. Submits via the HS task queue (firewall scope) or the
 * configuration-apply endpoints (configuration scope). Mirrors the structure
 * of gc-routing-flyout.js so the two share styling and behaviour.
 */
(function () {
  "use strict";

  let flyout = null;
  let panel = null;
  let backdrop = null;
  let titleEl = null;
  let metaEl = null;
  let fieldsRoot = null;
  let closeBtn = null;
  let doneBtn = null;
  let saveBtn = null;
  /** @type {object|null} */
  let currentRow = null;
  /** @type {string} */
  let currentEntityType = "";
  /** @type {"add"|"edit"} */
  let currentMode = "add";

  function isCfg() {
    return typeof globalThis.gcDhcpEntityTarget === "string"
      && globalThis.gcDhcpEntityTarget === "configuration";
  }

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

  function topBarOwnerIds() {
    if (isCfg()) {
      let g = globalThis.gcGetSelectedConfigurationIds;
      let arr = typeof g === "function" ? g() : [];
      return Array.isArray(arr) ? arr.map(Number).filter(function (n) { return !isNaN(n) && n > 0; }) : [];
    }
    let g2 = globalThis.gcGetSelectedFirewallIds;
    let arr2 = typeof g2 === "function" ? g2() : [];
    return Array.isArray(arr2) ? arr2.map(Number).filter(function (n) { return !isNaN(n) && n > 0; }) : [];
  }

  function rowEditOwnerIds(row) {
    if (!row) return [];
    let t = row.hs_edit_targets;
    if (!Array.isArray(t)) t = [];
    let out = [];
    let cfg = isCfg();
    t.forEach(function (x) {
      if (!x) return;
      let id = cfg ? x.configuration_id : x.firewall_id;
      let n = parseInt(String(id), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function rowEditEntryIds(row) {
    if (!row) return [];
    let t = row.hs_edit_targets;
    if (!Array.isArray(t)) return [];
    let out = [];
    t.forEach(function (x) {
      if (!x || x.config_entry_id == null) return;
      let n = parseInt(String(x.config_entry_id), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function selectInput(id, val, options, opts) {
    opts = opts || {};
    let html = options.map(function (o) {
      let v = typeof o === "string" ? o : o.value;
      let lab = typeof o === "string" ? o : (o.label || o.value);
      return '<option value="' + escapeHtml(v) + '"' + (String(val) === String(v) ? " selected" : "") + ">" + escapeHtml(lab) + "</option>";
    }).join("");
    let extra = opts.disabled ? " disabled" : "";
    return '<select id="' + id + '" class="gc-if-flyout__input"' + extra + ">" + html + "</select>";
  }

  function textInput(id, val, opts) {
    opts = opts || {};
    let type = opts.type || "text";
    let attrs = "";
    if (opts.placeholder) attrs += ' placeholder="' + escapeHtml(opts.placeholder) + '"';
    if (opts.mono) attrs += ' class="gc-if-flyout__input mono"';
    else attrs += ' class="gc-if-flyout__input"';
    if (opts.disabled) attrs += " disabled";
    if (opts.inputmode) attrs += ' inputmode="' + escapeHtml(opts.inputmode) + '"';
    if (opts.min != null) attrs += ' min="' + escapeHtml(String(opts.min)) + '"';
    if (opts.max != null) attrs += ' max="' + escapeHtml(String(opts.max)) + '"';
    if (opts.step != null) attrs += ' step="' + escapeHtml(String(opts.step)) + '"';
    return '<input id="' + id + '" type="' + escapeHtml(type) + '" value="' + escapeHtml(val == null ? "" : val) + '"' + attrs + " />";
  }

  function fieldRow(label, html, opts) {
    opts = opts || {};
    let req = opts.required ? ' <span class="gc-if-flyout__req">*</span>' : "";
    let hint = opts.hint ? '<p class="muted" style="margin-top:4px">' + escapeHtml(opts.hint) + "</p>" : "";
    return '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label">' + escapeHtml(label) + req + "</label>" + html + hint + "</div>";
  }

  // ── Repeating-row helpers ──────────────────────────────────────────────

  function buildIpLeaseRow(idx, val) {
    return '<div class="gc-dhcp-iplease-row" data-idx="' + idx + '" style="display:flex;gap:6px;align-items:center;margin-bottom:6px">' +
      '<input id="gc-dhcp-iplease-' + idx + '" type="text" class="gc-if-flyout__input mono" value="' + escapeHtml(val || "") + '" placeholder="start-end" style="flex:1" />' +
      '<button type="button" class="btn btn--secondary" data-gc-dhcp-iplease-remove="' + idx + '" title="Remove range" aria-label="Remove range">&minus;</button>' +
      '</div>';
  }

  function buildStaticLeaseV4Row(idx, row) {
    row = row || {};
    return '<div class="gc-dhcp-static-row" data-idx="' + idx + '" style="border:1px solid var(--surface-3);padding:8px;margin-bottom:8px;border-radius:4px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">' +
      '<div>' + fieldRow("Host name", textInput("gc-dhcp-stat-host-" + idx, row.HostName || "", { mono: true })) + '</div>' +
      '<div>' + fieldRow("MAC address", textInput("gc-dhcp-stat-mac-" + idx, row.MACAddress || "", { mono: true, placeholder: "AA:BB:CC:DD:EE:FF" })) + '</div>' +
      '<div>' + fieldRow("IP address", textInput("gc-dhcp-stat-ip-" + idx, row.IPAddress || "", { mono: true })) + '</div>' +
      '</div>' +
      '<button type="button" class="btn btn--secondary" data-gc-dhcp-stat-remove="' + idx + '" style="margin-top:6px">Remove lease</button>' +
      '</div>';
  }

  function buildStaticLeaseV6Row(idx, row) {
    row = row || {};
    return '<div class="gc-dhcp-static-row" data-idx="' + idx + '" style="border:1px solid var(--surface-3);padding:8px;margin-bottom:8px;border-radius:4px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">' +
      '<div>' + fieldRow("Host name", textInput("gc-dhcp-stat-host-" + idx, row.HostName || "", { mono: true })) + '</div>' +
      '<div>' + fieldRow("DUID", textInput("gc-dhcp-stat-duid-" + idx, row.DUID || "", { mono: true })) + '</div>' +
      '<div>' + fieldRow("IPv6 address", textInput("gc-dhcp-stat-ip-" + idx, row.IPAddress || "", { mono: true })) + '</div>' +
      '</div>' +
      '<button type="button" class="btn btn--secondary" data-gc-dhcp-stat-remove="' + idx + '" style="margin-top:6px">Remove lease</button>' +
      '</div>';
  }

  function buildDhcpOptionRow(idx, row) {
    row = row || {};
    return '<div class="gc-dhcp-opt-row" data-idx="' + idx + '" style="border:1px solid var(--surface-3);padding:8px;margin-bottom:8px;border-radius:4px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 2fr;gap:8px">' +
      '<div>' + fieldRow("Name", textInput("gc-dhcp-opt-name-" + idx, row.OptionName || "")) + '</div>' +
      '<div>' + fieldRow("Type", textInput("gc-dhcp-opt-type-" + idx, row.OptionType || "")) + '</div>' +
      '<div>' + fieldRow("Code", textInput("gc-dhcp-opt-code-" + idx, row.OptionCode || "", { mono: true })) + '</div>' +
      '<div>' + fieldRow("Value", textInput("gc-dhcp-opt-val-" + idx, row.OptionValue || "", { mono: true })) + '</div>' +
      '</div>' +
      '<button type="button" class="btn btn--secondary" data-gc-dhcp-opt-remove="' + idx + '" style="margin-top:6px">Remove option</button>' +
      '</div>';
  }

  function buildRelayServerIpRow(idx, val) {
    return '<div class="gc-dhcp-relayip-row" data-idx="' + idx + '" style="display:flex;gap:6px;align-items:center;margin-bottom:6px">' +
      '<input id="gc-dhcp-relayip-' + idx + '" type="text" class="gc-if-flyout__input mono" value="' + escapeHtml(val || "") + '" placeholder="10.10.0.5" style="flex:1" />' +
      '<button type="button" class="btn btn--secondary" data-gc-dhcp-relayip-remove="' + idx + '" title="Remove" aria-label="Remove">&minus;</button>' +
      '</div>';
  }

  // ── Form builders per entity type ──────────────────────────────────────

  function readIpLeases(flat) {
    let out = [];
    if (!flat) return out;
    let block = flat.IPLease;
    if (block && typeof block === "object") {
      let ips = block.IP;
      if (Array.isArray(ips)) {
        ips.forEach(function (v) { if (v != null && String(v).trim()) out.push(String(v).trim()); });
      } else if (ips != null && String(ips).trim()) {
        out.push(String(ips).trim());
      }
    }
    return out;
  }

  function readRepeatingRows(flat, blockKey, childKey) {
    let out = [];
    if (!flat) return out;
    let block = flat[blockKey];
    if (!block || typeof block !== "object") return out;
    let raw = block[childKey];
    if (!raw) return out;
    if (!Array.isArray(raw)) raw = [raw];
    raw.forEach(function (r) {
      if (r && typeof r === "object") out.push(r);
    });
    return out;
  }

  function readRelayServerIps(flat) {
    let out = [];
    if (!flat) return out;
    let raw = flat.DHCPServerIP;
    if (raw == null) return out;
    if (!Array.isArray(raw)) raw = [raw];
    raw.forEach(function (v) {
      if (v != null && String(v).trim()) out.push(String(v).trim());
    });
    return out;
  }

  function buildDhcpServerForm(row) {
    let f = (row && row.flat) || {};
    let isAdd = currentMode === "add";
    let nameEditable = isAdd;
    let html = "";

    html += fieldRow("Name", textInput("gc-dhcp-name", pick(f, ["Name"]), { disabled: !nameEditable }), { required: true });
    html += fieldRow("Interface", textInput("gc-dhcp-iface", pick(f, ["Interface"]), { mono: true, placeholder: "Port1" }), { required: true });
    html += fieldRow("Use interface IP as gateway", selectInput("gc-dhcp-useif-gw", pick(f, ["UseInterfaceIPasGateway"]) || "Disable", [
      { value: "Enable", label: "Enable" },
      { value: "Disable", label: "Disable" },
    ]));

    let leases = readIpLeases(f);
    if (!leases.length && isAdd) leases = [""];
    let leasesHtml = '<div id="gc-dhcp-iplease-rows">';
    leases.forEach(function (v, i) { leasesHtml += buildIpLeaseRow(i, v); });
    leasesHtml += '</div><button type="button" id="gc-dhcp-iplease-add" class="btn btn--secondary">Add lease range</button>';
    html += '<fieldset class="gc-if-flyout__fieldset"><legend>IP lease ranges</legend>' + leasesHtml + "</fieldset>";

    html += fieldRow("Subnet mask", textInput("gc-dhcp-mask", pick(f, ["SubnetMask"]), { mono: true, placeholder: "255.255.255.0" }), { required: true });
    html += fieldRow("Gateway", textInput("gc-dhcp-gw", pick(f, ["Gateway"]), { mono: true }));
    html += fieldRow("Domain name", textInput("gc-dhcp-domain", pick(f, ["DomainName"])));
    html += fieldRow("Default lease time (s)", textInput("gc-dhcp-defltime", pick(f, ["DefaultLeaseTime"]) || (isAdd ? "86400" : ""), { type: "number", inputmode: "numeric", min: 0 }));
    html += fieldRow("Max lease time (s)", textInput("gc-dhcp-maxltime", pick(f, ["MaxLeaseTime"]) || (isAdd ? "86400" : ""), { type: "number", inputmode: "numeric", min: 0 }));
    html += fieldRow("Conflict detection", selectInput("gc-dhcp-conflict", pick(f, ["ConflictDetection"]) || "Disable", [
      { value: "Enable", label: "Enable" },
      { value: "Disable", label: "Disable" },
    ]));
    html += fieldRow("Use appliance DNS", selectInput("gc-dhcp-applidns", pick(f, ["UseApplianceDNSSettings"]) || "Enable", [
      { value: "Enable", label: "Enable" },
      { value: "Disable", label: "Disable" },
    ]));
    html += fieldRow("Primary DNS", textInput("gc-dhcp-dns1", pick(f, ["PrimaryDNSServer"]), { mono: true }));
    html += fieldRow("Secondary DNS", textInput("gc-dhcp-dns2", pick(f, ["SecondaryDNSServer"]), { mono: true }));
    html += fieldRow("Primary WINS", textInput("gc-dhcp-wins1", pick(f, ["PrimaryWINSServer"]), { mono: true }));
    html += fieldRow("Secondary WINS", textInput("gc-dhcp-wins2", pick(f, ["SecondaryWINSServer"]), { mono: true }));
    html += fieldRow("Boot server", textInput("gc-dhcp-bootsrv", pick(f, ["BootServer"]), { mono: true }));
    html += fieldRow("Boot file", textInput("gc-dhcp-bootfile", pick(f, ["BootFile"])));
    html += fieldRow("Lease for relay", selectInput("gc-dhcp-leaserelay", pick(f, ["LeaseForRelay"]) || "Disable", [
      { value: "Enable", label: "Enable" },
      { value: "Disable", label: "Disable" },
    ]));

    let staticRows = readRepeatingRows(f, "StaticLease", "Lease");
    let stHtml = '<div id="gc-dhcp-stat-rows">';
    staticRows.forEach(function (r, i) { stHtml += buildStaticLeaseV4Row(i, r); });
    stHtml += '</div><button type="button" id="gc-dhcp-stat-add" class="btn btn--secondary">Add static lease</button>';
    html += '<fieldset class="gc-if-flyout__fieldset"><legend>Static leases</legend>' + stHtml + "</fieldset>";

    let optRows = readRepeatingRows(f, "DHCPOption", "Options");
    let optHtml = '<div id="gc-dhcp-opt-rows">';
    optRows.forEach(function (r, i) { optHtml += buildDhcpOptionRow(i, r); });
    optHtml += '</div><button type="button" id="gc-dhcp-opt-add" class="btn btn--secondary">Add DHCP option</button>';
    html += '<fieldset class="gc-if-flyout__fieldset"><legend>DHCP options</legend>' + optHtml + "</fieldset>";

    return html;
  }

  function buildDhcpServerIpv6Form(row) {
    let f = (row && row.flat) || {};
    let isAdd = currentMode === "add";
    let nameEditable = isAdd;
    let html = "";

    html += fieldRow("Name", textInput("gc-dhcp-name", pick(f, ["Name"]), { disabled: !nameEditable }), { required: true });
    html += fieldRow("Interface", textInput("gc-dhcp-iface", pick(f, ["Interface"]), { mono: true, placeholder: "Port1" }), { required: true });

    let leases = readIpLeases(f);
    if (!leases.length && isAdd) leases = [""];
    let leasesHtml = '<div id="gc-dhcp-iplease-rows">';
    leases.forEach(function (v, i) { leasesHtml += buildIpLeaseRow(i, v); });
    leasesHtml += '</div><button type="button" id="gc-dhcp-iplease-add" class="btn btn--secondary">Add lease range</button>';
    html += '<fieldset class="gc-if-flyout__fieldset"><legend>IPv6 lease ranges</legend>' + leasesHtml + "</fieldset>";

    html += fieldRow("Preferred time (s)", textInput("gc-dhcp-preftime", pick(f, ["PreferredTime"]) || (isAdd ? "3600" : ""), { type: "number", inputmode: "numeric", min: 0 }));
    html += fieldRow("Valid time (s)", textInput("gc-dhcp-validtime", pick(f, ["ValidTime"]) || (isAdd ? "7200" : ""), { type: "number", inputmode: "numeric", min: 0 }));
    html += fieldRow("Use appliance DNS", selectInput("gc-dhcp-applidns", pick(f, ["UseApplianceDNSSettings"]) || "Enable", [
      { value: "Enable", label: "Enable" },
      { value: "Disable", label: "Disable" },
    ]));
    html += fieldRow("Primary DNS (IPv6)", textInput("gc-dhcp-dnsv61", pick(f, ["primarydnsv6"]), { mono: true }));
    html += fieldRow("Secondary DNS (IPv6)", textInput("gc-dhcp-dnsv62", pick(f, ["secondarydnsv6"]), { mono: true }));
    html += fieldRow("Lease for relay", selectInput("gc-dhcp-leaserelay", pick(f, ["LeaseForRelay"]) || "Disable", [
      { value: "Enable", label: "Enable" },
      { value: "Disable", label: "Disable" },
    ]));

    let staticRows = readRepeatingRows(f, "StaticLease", "Lease");
    let stHtml = '<div id="gc-dhcp-stat-rows">';
    staticRows.forEach(function (r, i) { stHtml += buildStaticLeaseV6Row(i, r); });
    stHtml += '</div><button type="button" id="gc-dhcp-stat-add" class="btn btn--secondary">Add static lease</button>';
    html += '<fieldset class="gc-if-flyout__fieldset"><legend>Static leases</legend>' + stHtml + "</fieldset>";

    let optRows = readRepeatingRows(f, "DHCPOption", "Options");
    let optHtml = '<div id="gc-dhcp-opt-rows">';
    optRows.forEach(function (r, i) { optHtml += buildDhcpOptionRow(i, r); });
    optHtml += '</div><button type="button" id="gc-dhcp-opt-add" class="btn btn--secondary">Add DHCP option</button>';
    html += '<fieldset class="gc-if-flyout__fieldset"><legend>DHCP options</legend>' + optHtml + "</fieldset>";

    return html;
  }

  function buildDhcpRelayForm(row) {
    let f = (row && row.flat) || {};
    let isAdd = currentMode === "add";
    let nameEditable = isAdd;
    let html = "";

    html += fieldRow("Name", textInput("gc-dhcp-name", pick(f, ["Name"]), { disabled: !nameEditable }), { required: true });
    html += fieldRow("IP family", selectInput("gc-dhcp-family", pick(f, ["IPFamily"]) || (isAdd ? "IPv4" : ""), [
      { value: "IPv4", label: "IPv4" },
      { value: "IPv6", label: "IPv6" },
    ]), { required: true });
    html += fieldRow("Interface", textInput("gc-dhcp-iface", pick(f, ["Interface"]), { mono: true, placeholder: "Port1" }), { required: true });
    html += fieldRow("Relay through IPSec", selectInput("gc-dhcp-rti", pick(f, ["RelaythroughIPSec"]) || "Disable", [
      { value: "Enable", label: "Enable" },
      { value: "Disable", label: "Disable" },
    ]));

    let ips = readRelayServerIps(f);
    if (!ips.length && isAdd) ips = [""];
    let ipsHtml = '<div id="gc-dhcp-relayip-rows">';
    ips.forEach(function (v, i) { ipsHtml += buildRelayServerIpRow(i, v); });
    ipsHtml += '</div><button type="button" id="gc-dhcp-relayip-add" class="btn btn--secondary">Add server IP</button>';
    html += '<fieldset class="gc-if-flyout__fieldset"><legend>DHCP server IPs</legend>' + ipsHtml + "</fieldset>";

    return html;
  }

  function buildFormFor(et, row) {
    if (et === "dhcp_server") return buildDhcpServerForm(row);
    if (et === "dhcp_server_ipv6") return buildDhcpServerIpv6Form(row);
    if (et === "dhcp_relay") return buildDhcpRelayForm(row);
    return '<p class="muted">Unsupported entity type.</p>';
  }

  // ── Form collectors ────────────────────────────────────────────────────

  function valOf(id) {
    let el = document.getElementById(id);
    return el ? (el.value || "") : "";
  }

  function collectIpLeases() {
    let out = [];
    document.querySelectorAll("#gc-dhcp-iplease-rows .gc-dhcp-iplease-row").forEach(function (el) {
      let i = el.dataset.idx;
      let v = valOf("gc-dhcp-iplease-" + i).trim();
      if (v) out.push(v);
    });
    return out;
  }

  function collectStaticLeasesV4() {
    let out = [];
    document.querySelectorAll("#gc-dhcp-stat-rows .gc-dhcp-static-row").forEach(function (el) {
      let i = el.dataset.idx;
      let row = {
        HostName: valOf("gc-dhcp-stat-host-" + i),
        MACAddress: valOf("gc-dhcp-stat-mac-" + i),
        IPAddress: valOf("gc-dhcp-stat-ip-" + i),
      };
      if (row.HostName || row.MACAddress || row.IPAddress) out.push(row);
    });
    return out;
  }

  function collectStaticLeasesV6() {
    let out = [];
    document.querySelectorAll("#gc-dhcp-stat-rows .gc-dhcp-static-row").forEach(function (el) {
      let i = el.dataset.idx;
      let row = {
        HostName: valOf("gc-dhcp-stat-host-" + i),
        DUID: valOf("gc-dhcp-stat-duid-" + i),
        IPAddress: valOf("gc-dhcp-stat-ip-" + i),
      };
      if (row.HostName || row.DUID || row.IPAddress) out.push(row);
    });
    return out;
  }

  function collectDhcpOptions() {
    let out = [];
    document.querySelectorAll("#gc-dhcp-opt-rows .gc-dhcp-opt-row").forEach(function (el) {
      let i = el.dataset.idx;
      let row = {
        OptionName: valOf("gc-dhcp-opt-name-" + i),
        OptionType: valOf("gc-dhcp-opt-type-" + i),
        OptionCode: valOf("gc-dhcp-opt-code-" + i),
        OptionValue: valOf("gc-dhcp-opt-val-" + i),
      };
      if (row.OptionName || row.OptionCode || row.OptionValue) out.push(row);
    });
    return out;
  }

  function collectRelayServerIps() {
    let out = [];
    document.querySelectorAll("#gc-dhcp-relayip-rows .gc-dhcp-relayip-row").forEach(function (el) {
      let i = el.dataset.idx;
      let v = valOf("gc-dhcp-relayip-" + i).trim();
      if (v) out.push(v);
    });
    return out;
  }

  function collectDhcpServerForm() {
    let nm = valOf("gc-dhcp-name");
    return {
      name: nm,
      Name: nm,
      Interface: valOf("gc-dhcp-iface"),
      UseInterfaceIPasGateway: valOf("gc-dhcp-useif-gw"),
      ip_lease: collectIpLeases(),
      SubnetMask: valOf("gc-dhcp-mask"),
      Gateway: valOf("gc-dhcp-gw"),
      DomainName: valOf("gc-dhcp-domain"),
      DefaultLeaseTime: valOf("gc-dhcp-defltime"),
      MaxLeaseTime: valOf("gc-dhcp-maxltime"),
      ConflictDetection: valOf("gc-dhcp-conflict"),
      UseApplianceDNSSettings: valOf("gc-dhcp-applidns"),
      PrimaryDNSServer: valOf("gc-dhcp-dns1"),
      SecondaryDNSServer: valOf("gc-dhcp-dns2"),
      PrimaryWINSServer: valOf("gc-dhcp-wins1"),
      SecondaryWINSServer: valOf("gc-dhcp-wins2"),
      BootServer: valOf("gc-dhcp-bootsrv"),
      BootFile: valOf("gc-dhcp-bootfile"),
      LeaseForRelay: valOf("gc-dhcp-leaserelay"),
      static_lease: collectStaticLeasesV4(),
      dhcp_options: collectDhcpOptions(),
    };
  }

  function collectDhcpServerIpv6Form() {
    let nm = valOf("gc-dhcp-name");
    return {
      name: nm,
      Name: nm,
      Interface: valOf("gc-dhcp-iface"),
      ip_lease: collectIpLeases(),
      PreferredTime: valOf("gc-dhcp-preftime"),
      ValidTime: valOf("gc-dhcp-validtime"),
      UseApplianceDNSSettings: valOf("gc-dhcp-applidns"),
      primarydnsv6: valOf("gc-dhcp-dnsv61"),
      secondarydnsv6: valOf("gc-dhcp-dnsv62"),
      LeaseForRelay: valOf("gc-dhcp-leaserelay"),
      static_lease: collectStaticLeasesV6(),
      dhcp_options: collectDhcpOptions(),
    };
  }

  function collectDhcpRelayForm() {
    let nm = valOf("gc-dhcp-name");
    return {
      name: nm,
      Name: nm,
      IPFamily: valOf("gc-dhcp-family"),
      Interface: valOf("gc-dhcp-iface"),
      RelaythroughIPSec: valOf("gc-dhcp-rti"),
      dhcp_server_ip: collectRelayServerIps(),
    };
  }

  function collectForm(et) {
    if (et === "dhcp_server") return collectDhcpServerForm();
    if (et === "dhcp_server_ipv6") return collectDhcpServerIpv6Form();
    if (et === "dhcp_relay") return collectDhcpRelayForm();
    return null;
  }

  function humanTitle(et) {
    if (et === "dhcp_server") return "IPv4 DHCP server";
    if (et === "dhcp_server_ipv6") return "IPv6 DHCP server";
    if (et === "dhcp_relay") return "DHCP relay";
    return et;
  }

  // ── Repeating-row click handlers ───────────────────────────────────────

  function setupRepeatableHandlers() {
    let leaseAdd = document.getElementById("gc-dhcp-iplease-add");
    if (leaseAdd) leaseAdd.addEventListener("click", function () {
      let root = document.getElementById("gc-dhcp-iplease-rows");
      if (!root) return;
      let nextIdx = root.children.length;
      root.insertAdjacentHTML("beforeend", buildIpLeaseRow(nextIdx, ""));
    });
    let statAdd = document.getElementById("gc-dhcp-stat-add");
    if (statAdd) statAdd.addEventListener("click", function () {
      let root = document.getElementById("gc-dhcp-stat-rows");
      if (!root) return;
      let nextIdx = root.children.length;
      let row = currentEntityType === "dhcp_server_ipv6"
        ? buildStaticLeaseV6Row(nextIdx, {})
        : buildStaticLeaseV4Row(nextIdx, {});
      root.insertAdjacentHTML("beforeend", row);
    });
    let optAdd = document.getElementById("gc-dhcp-opt-add");
    if (optAdd) optAdd.addEventListener("click", function () {
      let root = document.getElementById("gc-dhcp-opt-rows");
      if (!root) return;
      let nextIdx = root.children.length;
      root.insertAdjacentHTML("beforeend", buildDhcpOptionRow(nextIdx, {}));
    });
    let ripAdd = document.getElementById("gc-dhcp-relayip-add");
    if (ripAdd) ripAdd.addEventListener("click", function () {
      let root = document.getElementById("gc-dhcp-relayip-rows");
      if (!root) return;
      let nextIdx = root.children.length;
      root.insertAdjacentHTML("beforeend", buildRelayServerIpRow(nextIdx, ""));
    });
    if (fieldsRoot) {
      fieldsRoot.addEventListener("click", function (ev) {
        let t = ev.target;
        if (!t) return;
        let attrs = [
          ["data-gc-dhcp-iplease-remove", ".gc-dhcp-iplease-row"],
          ["data-gc-dhcp-stat-remove", ".gc-dhcp-static-row"],
          ["data-gc-dhcp-opt-remove", ".gc-dhcp-opt-row"],
          ["data-gc-dhcp-relayip-remove", ".gc-dhcp-relayip-row"],
        ];
        for (let i = 0; i < attrs.length; i++) {
          let attr = attrs[i][0], sel = attrs[i][1];
          if (t.getAttribute && t.getAttribute(attr) != null) {
            let row = t.closest(sel);
            if (row && row.parentNode) row.parentNode.removeChild(row);
            return;
          }
        }
      });
    }
  }

  // ── Open / close ───────────────────────────────────────────────────────

  function openAdd(et, presets) {
    if (!flyout) return;
    if (et !== "dhcp_server" && et !== "dhcp_server_ipv6" && et !== "dhcp_relay") return;
    currentEntityType = et;
    currentMode = "add";
    let flat = {};
    if (presets && typeof presets === "object") {
      Object.keys(presets).forEach(function (k) { flat[k] = presets[k]; });
    }
    currentRow = { entity_type: et, flat: flat, hs_edit_targets: [] };
    if (titleEl) titleEl.textContent = "Add " + humanTitle(et);
    if (metaEl) metaEl.hidden = true;
    if (saveBtn) { saveBtn.hidden = false; saveBtn.disabled = false; }
    if (fieldsRoot) fieldsRoot.innerHTML = buildFormFor(et, currentRow);
    setupRepeatableHandlers();
    flyout.hidden = false;
    flyout.setAttribute("aria-hidden", "false");
    if (panel) try { panel.focus(); } catch (e) { }
  }

  function openEditFromTr(tr) {
    if (!flyout || !tr || !tr._gcNetRow) return;
    let row = tr._gcNetRow;
    let et = String(row.entity_type || "").trim();
    if (et !== "dhcp_server" && et !== "dhcp_server_ipv6" && et !== "dhcp_relay") return;
    currentEntityType = et;
    currentMode = "edit";
    currentRow = row;
    let nm = (row.cells && (row.cells.__name || row.cells.Name)) || row.external_name || "";
    if (titleEl) titleEl.textContent = "Edit " + humanTitle(et) + (nm ? " \u2014 " + nm : "");
    if (metaEl) {
      let owners = rowEditOwnerIds(row);
      metaEl.textContent = (owners.length || 1) + " " + (isCfg() ? "configuration" : "firewall") + " target" + ((owners.length === 1) ? "" : "s");
      metaEl.hidden = false;
    }
    if (saveBtn) { saveBtn.hidden = false; saveBtn.disabled = false; }
    if (fieldsRoot) fieldsRoot.innerHTML = buildFormFor(et, currentRow);
    setupRepeatableHandlers();
    flyout.hidden = false;
    flyout.setAttribute("aria-hidden", "false");
    if (panel) try { panel.focus(); } catch (e) { }
  }

  function closeFlyout() {
    if (!flyout) return;
    if (saveBtn) saveBtn.disabled = false;
    flyout.hidden = true;
    flyout.setAttribute("aria-hidden", "true");
    currentRow = null;
  }

  function notifySaved() {
    if (isCfg()) {
      document.dispatchEvent(new CustomEvent("gc-configuration-entries-updated"));
    } else {
      document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
    }
  }

  function postJson(url, payload) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
  }

  function handleSave() {
    if (!currentRow || !currentEntityType) return;
    let form = collectForm(currentEntityType);
    if (!form || !String(form.name || "").trim()) {
      window.gcAlert("Name is required.");
      return;
    }
    if (saveBtn) saveBtn.disabled = true;

    let cfg = isCfg();
    let crUrl = cfg ? globalThis.gcHsApplyCreatesBatchUrl : globalThis.gcHsEnqueueCreatesBatchUrl;
    let upUrl = cfg ? globalThis.gcHsApplyUpdatesBatchUrl : globalThis.gcHsEnqueueUpdatesBatchUrl;
    let idsKey = cfg ? "configuration_ids" : "firewall_ids";

    function fail(msg) {
      window.gcAlert(typeof msg === "string" ? msg : JSON.stringify(msg));
      if (saveBtn) saveBtn.disabled = false;
    }

    if (currentMode === "add") {
      let owners = topBarOwnerIds();
      if (!crUrl || !owners.length) {
        return fail(cfg ? "Select at least one configuration." : "Select at least one firewall.");
      }
      let payload = { entity_type: currentEntityType, form: form };
      payload[idsKey] = owners;
      postJson(crUrl, payload).then(function (x) {
        if (!x.ok) return fail((x.j && (x.j.detail || x.j.message)) || "Could not create.");
        notifySaved();
        closeFlyout();
      }).catch(function () { fail("Network error."); });
      return;
    }

    let entryIds = rowEditEntryIds(currentRow);
    if (!entryIds.length) return fail("No targets to update.");
    if (!upUrl) return fail("Update URL not configured.");
    postJson(upUrl, { config_entry_ids: entryIds, form: form }).then(function (x) {
      if (!x.ok) return fail((x.j && (x.j.detail || x.j.message)) || "Could not update.");
      notifySaved();
      closeFlyout();
    }).catch(function () { fail("Network error."); });
  }

  function init() {
    flyout = document.getElementById("gc-dhcp-edit-flyout");
    if (!flyout) return;
    panel = flyout.querySelector(".gc-if-flyout__panel");
    backdrop = flyout.querySelector(".gc-if-flyout__backdrop");
    titleEl = document.getElementById("gc-dhcp-flyout-title");
    metaEl = document.getElementById("gc-dhcp-flyout-meta");
    fieldsRoot = document.getElementById("gc-dhcp-flyout-fields");
    closeBtn = document.getElementById("gc-dhcp-flyout-close");
    doneBtn = document.getElementById("gc-dhcp-flyout-done");
    saveBtn = document.getElementById("gc-dhcp-flyout-save");

    if (closeBtn) closeBtn.addEventListener("click", closeFlyout);
    if (doneBtn) doneBtn.addEventListener("click", closeFlyout);
    if (backdrop) backdrop.addEventListener("click", closeFlyout);
    if (saveBtn) saveBtn.addEventListener("click", handleSave);

    document.addEventListener("keydown", function (ev) {
      if (!flyout || flyout.hidden) return;
      if (ev.key === "Escape") closeFlyout();
    });
  }

  globalThis.gcDhcpFlyout = {
    init: init,
    openAdd: openAdd,
    openEditFromTr: openEditFromTr,
  };
})();
