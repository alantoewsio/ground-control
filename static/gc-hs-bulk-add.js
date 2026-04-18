/**
 * Hosts & Services — Bulk Add modal.
 *
 * Supports: ip_host, fqdn_host, mac_host, ip_hostgroup, fqdn_hostgroup,
 *           country_group, service, service_group
 *
 * Wire-up: call gcHsBulkAddInit() once after DOM ready (done at bottom of
 * firewalls_hosts_services.html inline script).
 */
(function () {
  "use strict";

  // ── Helpers ──────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isValidIP(v) {
    v = String(v || "").trim();
    // IPv4 or CIDR
    var cidr = v.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/);
    if (cidr) {
      var parts = cidr[1].split(".").map(Number);
      if (parts.every(function (p) { return p >= 0 && p <= 255; })) {
        if (cidr[2] === undefined || (parseInt(cidr[2], 10) >= 0 && parseInt(cidr[2], 10) <= 32)) {
          return true;
        }
      }
    }
    // IPv6
    if (/^[0-9a-fA-F:]+$/.test(v) && v.indexOf(":") !== -1) return true;
    return false;
  }

  function isValidMAC(v) {
    v = String(v || "").trim();
    return /^([0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}$/.test(v);
  }

  function isValidFQDN(v) {
    v = String(v || "").trim();
    if (!v) return false;
    // Allow wildcard FQDNs like *.example.com
    if (v.startsWith("*.")) v = "x" + v.slice(1);
    return /^[a-zA-Z0-9]([a-zA-Z0-9\-\.]{0,253}[a-zA-Z0-9])?$/.test(v) && v.indexOf(".") !== -1;
  }

  function isValidPort(v) {
    var n = parseInt(String(v || ""), 10);
    return !isNaN(n) && n >= 0 && n <= 65535;
  }

  function isValidPortRange(v) {
    v = String(v || "").trim();
    if (!v) return false;
    if (v.indexOf(":") !== -1) {
      var parts = v.split(":");
      if (parts.length !== 2) return false;
      return isValidPort(parts[0]) && isValidPort(parts[1]);
    }
    return isValidPort(v);
  }

  function parseCsvLine(line) {
    // Simple CSV: split on comma, trim each field
    return line.split(",").map(function (s) { return s.trim(); });
  }

  // ── Entity type configurations ────────────────────────────────────────────

  var ENTITY_CONFIGS = {
    ip_host: {
      title: "IP hosts",
      format: [
        "Format:  name, ip_or_network [, description]",
        "",
        "Examples:",
        "  WebServer,192.168.1.10",
        "  AppServer,10.0.0.0/24,Application subnet",
        "  DNS1,8.8.8.8,Google DNS",
      ].join("\n"),
      hint: "Name and IP/subnet are required. Subnet prefix (e.g. /24) makes it a Network type. Description is optional.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 2) return null; // null = bad format
        var name = f[0], ip = f[1];
        if (!name || !ip) return null;
        if (!isValidIP(ip)) return { _error: "Invalid IP/subnet: " + ip };
        var hostType = ip.indexOf("/") !== -1 ? "Network" : "IP";
        var form = {
          Name: name,
          HostType: hostType,
          IPFamily: ip.indexOf(":") !== -1 ? "IPv6" : "IPv4",
        };
        if (hostType === "Network") {
          var parts = ip.split("/");
          form.IPAddress = parts[0];
          form.Subnet = parts[1];
        } else {
          form.IPAddress = ip;
        }
        if (f[2]) form.Description = f[2];
        return form;
      },
    },

    fqdn_host: {
      title: "FQDN hosts",
      format: [
        "Format:  name, fqdn [, description]",
        "",
        "Examples:",
        "  Google,google.com",
        "  Wildcard,*.example.com,All example subdomains",
      ].join("\n"),
      hint: "Name and FQDN are required. Wildcards (*.domain.com) are supported. Description is optional.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 2) return null;
        var name = f[0], fqdn = f[1];
        if (!name || !fqdn) return null;
        if (!isValidFQDN(fqdn)) return { _error: "Invalid FQDN: " + fqdn };
        var form = { Name: name, FQDN: fqdn };
        if (f[2]) form.Description = f[2];
        return form;
      },
    },

    mac_host: {
      title: "MAC hosts",
      format: [
        "Format:  name, mac_address [, description]",
        "",
        "Examples:",
        "  Printer,AA:BB:CC:DD:EE:FF",
        "  Camera,11-22-33-44-55-66,Security camera",
      ].join("\n"),
      hint: "Name and MAC address are required. Colons or dashes as separator. Description is optional.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 2) return null;
        var name = f[0], mac = f[1];
        if (!name || !mac) return null;
        if (!isValidMAC(mac)) return { _error: "Invalid MAC: " + mac };
        var form = { Name: name, MACAddress: mac.toUpperCase().replace(/-/g, ":") };
        if (f[2]) form.Description = f[2];
        return form;
      },
    },

    ip_hostgroup: {
      title: "IP host groups",
      format: [
        "Format:  name, member1+member2+... [, description]",
        "",
        "Examples:",
        "  WebServers,Server1+Server2+Server3",
        "  DMZ,Host-A+Host-B,DMZ server group",
      ].join("\n"),
      hint: "Name is required. Separate member names with +. Members must already exist on the firewall. Description is optional.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 1) return null;
        var name = f[0];
        if (!name) return null;
        var members = f[1] ? f[1].split("+").map(function (s) { return s.trim(); }).filter(Boolean) : [];
        var form = { Name: name, HostList: members };
        if (f[2]) form.Description = f[2];
        return form;
      },
    },

    fqdn_hostgroup: {
      title: "FQDN host groups",
      format: [
        "Format:  name, member1+member2+... [, description]",
        "",
        "Examples:",
        "  SearchEngines,Google+Bing+DuckDuckGo",
        "  CDNs,Cloudflare+Akamai,Content delivery networks",
      ].join("\n"),
      hint: "Name is required. Separate member names with +. Members must already exist. Description is optional.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 1) return null;
        var name = f[0];
        if (!name) return null;
        var members = f[1] ? f[1].split("+").map(function (s) { return s.trim(); }).filter(Boolean) : [];
        var form = { Name: name, FQDNHostList: members };
        if (f[2]) form.Description = f[2];
        return form;
      },
    },

    country_group: {
      title: "Country groups",
      format: [
        "Format:  name, country1+country2+... [, description]",
        "",
        "Examples:",
        "  EU,Germany+France+Italy+Spain",
        "  APAC,Japan+China+Australia,Asia Pacific",
      ].join("\n"),
      hint: "Name is required. Separate country names with +. Country names must match Sophos firewall values. Description is optional.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 1) return null;
        var name = f[0];
        if (!name) return null;
        var countries = f[1] ? f[1].split("+").map(function (s) { return s.trim(); }).filter(Boolean) : [];
        var form = { Name: name, CountryList: countries };
        if (f[2]) form.Description = f[2];
        return form;
      },
    },

    service: {
      title: "Services",
      format: [
        "Format:  name, protocol, dst_port [, src_port] [, description]",
        "         protocol: TCP, UDP, TCP/UDP, ICMP, IP",
        "",
        "Examples:",
        "  HTTPS,TCP,443",
        "  DNS,UDP,53,,Domain Name System",
        "  Custom-Range,TCP,8000:8080",
        "  SSH-Custom,TCP,22,1024:65535,Custom SSH",
      ].join("\n"),
      hint: "Name, protocol and destination port are required. Port ranges use colon (e.g. 8000:8080). Source port is optional.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 3) return null;
        var name = f[0], proto = (f[1] || "").toUpperCase(), dstPort = f[2];
        if (!name || !proto || !dstPort) return null;
        var validProtos = ["TCP", "UDP", "TCP/UDP", "TCPUDP", "ICMP", "IP"];
        if (validProtos.indexOf(proto) === -1) return { _error: "Unknown protocol: " + proto };
        if (!isValidPortRange(dstPort)) return { _error: "Invalid destination port: " + dstPort };
        if (f[3] && f[3] !== "" && !isValidPortRange(f[3])) return { _error: "Invalid source port: " + f[3] };
        var form = { Name: name, Protocol: proto === "TCPUDP" ? "TCP/UDP" : proto };
        if (dstPort.indexOf(":") !== -1) {
          var dp = dstPort.split(":");
          form.DestinationPort = dp[0] + ":" + dp[1];
        } else {
          form.DestinationPort = dstPort;
        }
        if (f[3] && f[3] !== "") form.SourcePort = f[3];
        if (f[4]) form.Description = f[4];
        return form;
      },
    },

    service_group: {
      title: "Service groups",
      format: [
        "Format:  name, member1+member2+... [, description]",
        "",
        "Examples:",
        "  WebServices,HTTP+HTTPS+HTTP_8080",
        "  EmailServices,SMTP+IMAPS+POP3S,Mail protocols",
      ].join("\n"),
      hint: "Name is required. Separate member service names with +. Members must already exist. Description is optional.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 1) return null;
        var name = f[0];
        if (!name) return null;
        var members = f[1] ? f[1].split("+").map(function (s) { return s.trim(); }).filter(Boolean) : [];
        var form = { Name: name, ServiceList: members };
        if (f[2]) form.Description = f[2];
        return form;
      },
    },

    unicast_route: {
      title: "Unicast routes",
      identityField: "DestinationIP",
      format: [
        "Format:  destination_ip, netmask, gateway [, interface] [, distance]",
        "",
        "Examples:",
        "  10.0.0.0,255.255.255.0,10.0.0.1",
        "  192.168.5.0,255.255.255.0,192.168.5.1,PortB,10",
      ].join("\n"),
      hint: "Destination IP, netmask and gateway are required. Interface and distance are optional.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 3) return null;
        var dest = f[0], mask = f[1], gw = f[2];
        if (!dest || !mask || !gw) return null;
        var form = {
          name: dest,
          DestinationIP: dest,
          Netmask: mask,
          Gateway: gw,
        };
        if (f[3]) form.Interface = f[3];
        if (f[4]) form.Distance = f[4];
        return form;
      },
    },

    gateway: {
      title: "Gateways",
      format: [
        "Format:  name, ip_address [, zone] [, weight] [, timeout]",
        "",
        "Examples:",
        "  WAN1,203.0.113.1,WAN,10,60",
        "  WAN2,203.0.113.2",
      ].join("\n"),
      hint: "Name and IP address are required. Failover rules can be added later via Edit.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 2) return null;
        var name = f[0], ip = f[1];
        if (!name || !ip) return null;
        var form = { name: name, Name: name, IPAddress: ip };
        if (f[2]) form.Zone = f[2];
        if (f[3]) form.Weight = f[3];
        if (f[4]) form.Timeout = f[4];
        return form;
      },
    },

    gateway_host: {
      title: "Custom gateways",
      format: [
        "Format:  name, zone, ip_address",
        "",
        "Examples:",
        "  CustGW-WAN,WAN,10.10.0.1",
        "  Branch1,LAN,10.20.0.1",
      ].join("\n"),
      hint: "Name, zone and IP address are required. Monitoring conditions can be added later via Edit.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 3) return null;
        var name = f[0], zone = f[1], ip = f[2];
        if (!name || !zone || !ip) return null;
        return {
          name: name,
          Name: name,
          Zone: zone,
          IPAddress: ip,
        };
      },
    },

    clientless_user: {
      title: "Clientless users",
      format: [
        "Format:  name, username, group, email [, ip_address] [, description]",
        "",
        "Examples:",
        "  Alice,alice,Default Group,alice@example.com,10.0.0.20",
        "  Bob,bob,VPN Users,bob@example.com",
      ].join("\n"),
      hint: "Name, username, group and email are required. IP address and description are optional.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 4) return null;
        var name = f[0], user = f[1], group = f[2], email = f[3];
        if (!name || !user || !group || !email) return null;
        var form = {
          name: name,
          Name: name,
          UserName: user,
          ClientLessGroup: group,
          Email: email,
        };
        if (f[4]) form.IPAddress = f[4];
        if (f[5]) form.Description = f[5];
        return form;
      },
    },

    dhcp_server: {
      title: "DHCP servers (IPv4)",
      format: [
        "Format:  name, interface, start_ip-end_ip, subnet_mask, gateway [, lease_seconds]",
        "",
        "Examples:",
        "  LAN-DHCP,Port1,192.168.1.100-192.168.1.200,255.255.255.0,192.168.1.1,86400",
        "  Guest-DHCP,Port2,10.0.0.50-10.0.0.150,255.255.255.0,10.0.0.1",
      ].join("\n"),
      hint: "Name, interface, IP lease range (start-end), subnet mask and gateway are required. Default lease time defaults to 86400.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 5) return null;
        var name = f[0], iface = f[1], range = f[2], mask = f[3], gw = f[4];
        if (!name || !iface || !range || !mask || !gw) return null;
        var parts = String(range).split("-");
        if (parts.length !== 2) return { _error: "IP lease must be START-END" };
        var s = parts[0].trim(), e = parts[1].trim();
        if (!isValidIP(s) || !isValidIP(e)) return { _error: "Invalid IP in lease range: " + range };
        var form = {
          name: name,
          Name: name,
          Interface: iface,
          ip_lease: [s + "-" + e],
          SubnetMask: mask,
          Gateway: gw,
          DefaultLeaseTime: f[5] || "86400",
          MaxLeaseTime: f[5] || "86400",
        };
        return form;
      },
    },

    dhcp_server_ipv6: {
      title: "DHCP servers (IPv6)",
      format: [
        "Format:  name, interface, start_ipv6-end_ipv6 [, preferred_time] [, valid_time]",
        "",
        "Examples:",
        "  V6-LAN,Port1,2001:db8::100-2001:db8::200,3600,7200",
        "  V6-Guest,Port2,fd00::10-fd00::ff",
      ].join("\n"),
      hint: "Name, interface and IPv6 lease range (start-end) are required. Times default to 3600/7200.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 3) return null;
        var name = f[0], iface = f[1], range = f[2];
        if (!name || !iface || !range) return null;
        var parts = String(range).split("-");
        if (parts.length !== 2) return { _error: "IPv6 lease must be START-END" };
        var s = parts[0].trim(), e = parts[1].trim();
        if (s.indexOf(":") === -1 || e.indexOf(":") === -1) return { _error: "Lease range must be IPv6: " + range };
        var form = {
          name: name,
          Name: name,
          Interface: iface,
          ip_lease: [s + "-" + e],
          PreferredTime: f[3] || "3600",
          ValidTime: f[4] || "7200",
        };
        return form;
      },
    },

    dhcp_relay: {
      title: "DHCP relays",
      format: [
        "Format:  name, interface, server_ip1+server_ip2+... [, ip_family] [, relay_through_ipsec]",
        "         ip_family: IPv4 | IPv6 (default IPv4)",
        "         relay_through_ipsec: Enable | Disable (default Disable)",
        "",
        "Examples:",
        "  Relay-LAN,Port1,10.10.0.5,IPv4,Disable",
        "  Relay-Guest,Port2,10.20.0.5+10.20.0.6",
      ].join("\n"),
      hint: "Name, interface and at least one DHCP server IP are required.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 3) return null;
        var name = f[0], iface = f[1], srv = f[2];
        if (!name || !iface || !srv) return null;
        var ips = srv.split("+").map(function (s) { return s.trim(); }).filter(Boolean);
        if (!ips.length) return { _error: "At least one server IP is required" };
        for (var i = 0; i < ips.length; i++) {
          if (!isValidIP(ips[i])) return { _error: "Invalid server IP: " + ips[i] };
        }
        var family = f[3] || "IPv4";
        if (family !== "IPv4" && family !== "IPv6") return { _error: "ip_family must be IPv4 or IPv6" };
        var rti = f[4] || "Disable";
        if (rti !== "Enable" && rti !== "Disable") return { _error: "relay_through_ipsec must be Enable or Disable" };
        return {
          name: name,
          Name: name,
          IPFamily: family,
          Interface: iface,
          RelaythroughIPSec: rti,
          dhcp_server_ip: ips,
        };
      },
    },

    acl_rule: {
      title: "Local Service ACL rules",
      identityField: "RuleName",
      format: [
        "Format:  rule_name, source_zone, action [, ip_family] [, description]",
        "         action: Accept | Drop",
        "         ip_family: IPv4 | IPv6 (default IPv4)",
        "",
        "Examples:",
        "  AllowAdmin,LAN,Accept,IPv4,Admin access",
        "  BlockGuest,WAN,Drop",
      ].join("\n"),
      hint: "Rule name, source zone and action are required. Source/destination hosts and services can be added later via Edit.",
      validate: function (line) {
        var f = parseCsvLine(line);
        if (f.length < 3) return null;
        var name = f[0], zone = f[1], action = f[2];
        if (!name || !zone || !action) return null;
        if (action !== "Accept" && action !== "Drop") return { _error: "Action must be Accept or Drop" };
        var form = {
          name: name,
          RuleName: name,
          SourceZone: zone,
          Action: action,
          IPFamily: f[3] || "IPv4",
        };
        if (f[4]) form.Description = f[4];
        return form;
      },
    },
  };

  // ── State ─────────────────────────────────────────────────────────────────

  var modal = null;
  var backdrop = null;
  var titleEl = null;
  var textareaEl = null;
  var formatPreEl = null;
  var formatHintEl = null;
  var summaryEl = null;
  var summaryValidEl = null;
  var summaryInvalidEl = null;
  var summaryDupeEl = null;
  var validCountEl = null;
  var invalidCountEl = null;
  var dupeCountEl = null;
  var invalidLinesEl = null;
  var submitBtn = null;
  var cancelBtn = null;
  var closeBtn = null;
  var targetLabelEl = null;
  // Firewall picker
  var fwListEl = null;
  var fwEmptyEl = null;
  var fwAllBtn = null;
  var fwNoneBtn = null;

  var currentEntityKey = null;
  var currentParsed = { valid: [], invalid: [], duplicates: [] };
  var debounceTimer = null;

  // ── DOM helpers ───────────────────────────────────────────────────────────

  function getFirewallIds() {
    if (typeof window.gcHsTopBarFirewallIds === "function") {
      return window.gcHsTopBarFirewallIds();
    }
    var ids = [];
    document.querySelectorAll(".gc-net-fw-cb--fw:checked").forEach(function (cb) {
      var raw = String(cb.value || "");
      var v = raw.indexOf("f:") === 0 ? parseInt(raw.slice(2), 10) : parseInt(raw, 10);
      if (!isNaN(v) && v > 0) ids.push(v);
    });
    return ids;
  }

  function getFirewallLabelById(id) {
    var arr = window.gcNavFirewallsJson;
    if (!Array.isArray(arr)) return "#" + id;
    for (var i = 0; i < arr.length; i++) {
      var fw = arr[i];
      if (fw.id === id) return fw.name || fw.host || ("#" + id);
    }
    return "#" + id;
  }

  function buildTargetLabel(ids) {
    if (!ids.length) return "No firewalls selected";
    if (ids.length === 1) return getFirewallLabelById(ids[0]);
    if (ids.length <= 3) return ids.map(getFirewallLabelById).join(", ");
    return ids.slice(0, 2).map(getFirewallLabelById).join(", ") + " +" + (ids.length - 2) + " more";
  }

  // Returns the IDs checked inside the modal picker (falls back to top bar if picker not initialised)
  function getSelectedModalFirewallIds() {
    if (!fwListEl) return getFirewallIds();
    var ids = [];
    fwListEl.querySelectorAll('input[type="checkbox"][data-gc-bulk-fw-id]:checked').forEach(function (cb) {
      var v = parseInt(cb.value, 10);
      if (!isNaN(v) && v > 0) ids.push(v);
    });
    return ids;
  }

  // Sync the submit button state — needs both valid entries AND ≥1 firewall checked
  function updateSubmitBtn() {
    if (!submitBtn) return;
    var nv = currentParsed.valid.length;
    var hasFw = getSelectedModalFirewallIds().length > 0;
    submitBtn.disabled = nv === 0 || !hasFw;
    submitBtn.textContent = nv > 0
      ? "Add " + nv + " entr" + (nv === 1 ? "y" : "ies") + " to " + getSelectedModalFirewallIds().length + " firewall" + (getSelectedModalFirewallIds().length === 1 ? "" : "s")
      : "Add entries";
  }

  // Populate (or refresh) the firewall checkbox list; pre-check IDs in preSelectedIds array
  function populateFirewallPicker(preSelectedIds) {
    if (!fwListEl) return;
    var firewalls = Array.isArray(window.gcNavFirewallsJson) ? window.gcNavFirewallsJson : [];
    fwListEl.innerHTML = "";
    var preSet = {};
    (preSelectedIds || []).forEach(function (id) { preSet[String(id)] = true; });

    if (!firewalls.length) {
      if (fwEmptyEl) fwEmptyEl.hidden = false;
      if (fwAllBtn) fwAllBtn.disabled = true;
      if (fwNoneBtn) fwNoneBtn.disabled = true;
      updateSubmitBtn();
      return;
    }

    if (fwEmptyEl) fwEmptyEl.hidden = true;
    if (fwAllBtn) fwAllBtn.disabled = false;
    if (fwNoneBtn) fwNoneBtn.disabled = false;

    firewalls.forEach(function (fw) {
      var fid = parseInt(String(fw.id), 10);
      if (isNaN(fid) || fid <= 0) return;
      var lbl = String(fw.label != null ? fw.label : "").trim() || String(fid);
      var hostStr = fw.host ? String(fw.host).trim() : "";

      var item = document.createElement("label");
      item.className = "gc-hs-bulk-add-modal__fw-item";

      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = String(fid);
      cb.dataset.gcBulkFwId = String(fid);
      cb.checked = !!preSet[String(fid)];
      cb.addEventListener("change", updateSubmitBtn);

      var nameWrap = document.createElement("span");
      nameWrap.className = "gc-hs-bulk-add-modal__fw-name";
      nameWrap.textContent = lbl;

      if (hostStr && hostStr !== lbl) {
        var hostSpan = document.createElement("span");
        hostSpan.className = "gc-hs-bulk-add-modal__fw-host";
        hostSpan.textContent = hostStr;
        nameWrap.appendChild(hostSpan);
      }

      item.appendChild(cb);
      item.appendChild(nameWrap);
      fwListEl.appendChild(item);
    });

    updateSubmitBtn();
  }

  // ── Parsing ───────────────────────────────────────────────────────────────

  function parseInput(raw, entityKey) {
    var cfg = ENTITY_CONFIGS[entityKey];
    if (!cfg) return { valid: [], invalid: [], duplicates: [] };

    var lines = raw.split("\n")
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length > 0 && !l.startsWith("#"); });

    var valid = [];
    var invalid = [];
    var duplicates = [];
    var seenNames = new Set();

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var result = cfg.validate(line);

      if (result === null) {
        invalid.push({ line: line, error: "Invalid format" });
        continue;
      }
      if (result._error) {
        invalid.push({ line: line, error: result._error });
        continue;
      }

      var idField = cfg.identityField || "Name";
      var name = String(result[idField] || result.Name || result.name || "").trim().toLowerCase();
      if (name && seenNames.has(name)) {
        duplicates.push(line);
        continue;
      }
      if (name) seenNames.add(name);
      valid.push({ line: line, form: result });
    }

    return { valid: valid, invalid: invalid, duplicates: duplicates };
  }

  // ── UI updates ────────────────────────────────────────────────────────────

  function updateSummary() {
    var raw = textareaEl ? textareaEl.value : "";
    var ek = currentEntityKey;
    currentParsed = raw.trim() ? parseInput(raw, ek) : { valid: [], invalid: [], duplicates: [] };

    var hasAny = raw.trim().length > 0;
    if (summaryEl) summaryEl.hidden = !hasAny;

    var nv = currentParsed.valid.length;
    var ni = currentParsed.invalid.length;
    var nd = currentParsed.duplicates.length;

    if (summaryValidEl) summaryValidEl.hidden = nv === 0;
    if (validCountEl) validCountEl.textContent = nv + " valid entr" + (nv === 1 ? "y" : "ies");

    if (summaryInvalidEl) summaryInvalidEl.hidden = ni === 0;
    if (invalidCountEl) invalidCountEl.textContent = ni + " invalid line" + (ni !== 1 ? "s" : "");
    if (invalidLinesEl) {
      var shown = currentParsed.invalid.slice(0, 5);
      invalidLinesEl.innerHTML = shown.map(function (x) {
        return '<span class="gc-hs-bulk-add-modal__invalid-item">' + esc(x.line) +
          (x.error ? ' <span class="gc-hs-bulk-add-modal__invalid-reason">(' + esc(x.error) + ')</span>' : '') +
          '</span>';
      }).join("") + (ni > 5 ? '<span class="gc-hs-bulk-add-modal__invalid-more">…and ' + (ni - 5) + ' more</span>' : "");
    }

    if (summaryDupeEl) summaryDupeEl.hidden = nd === 0;
    if (dupeCountEl) dupeCountEl.textContent = nd + " duplicate" + (nd !== 1 ? "s" : "") + " skipped";

    if (submitBtn) {
      updateSubmitBtn();
    }
  }

  // ── Modal open / close ────────────────────────────────────────────────────

  function openModal(entityKey) {
    if (!modal) return;
    var cfg = ENTITY_CONFIGS[entityKey];
    if (!cfg) return;

    currentEntityKey = entityKey;
    currentParsed = { valid: [], invalid: [], duplicates: [] };

    if (titleEl) titleEl.textContent = "Bulk add " + cfg.title.toLowerCase();
    if (textareaEl) {
      textareaEl.value = "";
      var entityPlaceholders = {
        ip_host: "WebServer,192.168.1.10\nAppSubnet,10.0.0.0/24,Application subnet\nDNS1,8.8.8.8",
        fqdn_host: "Google,google.com\nWildcard,*.example.com,All subdomains",
        mac_host: "Printer,AA:BB:CC:DD:EE:FF\nCamera,11-22-33-44-55-66",
        ip_hostgroup: "WebServers,Server1+Server2+Server3\nDMZ,HostA+HostB",
        fqdn_hostgroup: "SearchEngines,Google+Bing\nCDNs,Cloudflare+Akamai",
        country_group: "EU,Germany+France+Italy\nAPAC,Japan+China",
        service: "HTTPS,TCP,443\nDNS,UDP,53,,Domain Name System\nSSH-Alt,TCP,2222",
        service_group: "WebServices,HTTP+HTTPS\nEmailServices,SMTP+IMAPS",
      };
      textareaEl.placeholder = entityPlaceholders[entityKey] || "One entry per line…";
    }
    if (formatPreEl) formatPreEl.textContent = cfg.format;
    if (formatHintEl) formatHintEl.textContent = cfg.hint;
    if (summaryEl) summaryEl.hidden = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Add entries";
    }

    try { populateFirewallPicker(getFirewallIds()); } catch (e) { console.error("GC bulk-add: firewall picker error", e); }

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    if (textareaEl) {
      setTimeout(function () { textareaEl.focus(); }, 60);
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    currentEntityKey = null;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function doSubmit() {
    var ek = currentEntityKey;
    if (!ek || !currentParsed.valid.length) return;

    var crUrl =
      typeof window.gcHsEnqueueCreatesBatchUrl === "string"
        ? window.gcHsEnqueueCreatesBatchUrl
        : (typeof window.gcHsIpHostEnqueueCreateBatchUrl === "string" && ek === "ip_host"
          ? window.gcHsIpHostEnqueueCreateBatchUrl
          : "");

    if (!crUrl) {
      window.gcAlert("Batch create URL is not configured.");
      return;
    }

    var ids = getSelectedModalFirewallIds();
    if (!ids.length) {
      window.gcAlert("Select at least one firewall to apply to.");
      return;
    }

    var entries = currentParsed.valid.slice();
    var total = entries.length;
    var done = 0;
    var errors = [];

    if (submitBtn) submitBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    var isIpHost = ek === "ip_host" && typeof window.gcHsIpHostEnqueueCreateBatchUrl === "string";
    var url = isIpHost ? window.gcHsIpHostEnqueueCreateBatchUrl : crUrl;

    function submitNext() {
      if (done >= entries.length) {
        finishSubmit();
        return;
      }
      var entry = entries[done];
      var body = isIpHost
        ? { firewall_ids: ids, form: entry.form }
        : { entity_type: ek, firewall_ids: ids, form: entry.form };

      fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (r) {
          return r.json().then(function (j) { return { ok: r.ok, j: j }; });
        })
        .then(function (x) {
          if (!x.ok) {
            var msg = (x.j && (x.j.detail || x.j.message)) || "Failed to queue entry.";
            errors.push({ entry: entry.line, msg: typeof msg === "string" ? msg : JSON.stringify(msg) });
          }
          done++;
          updateProgress();
          submitNext();
        })
        .catch(function () {
          errors.push({ entry: entry.line, msg: "Network error" });
          done++;
          updateProgress();
          submitNext();
        });
    }

    function updateProgress() {
      if (submitBtn) {
        submitBtn.textContent = "Adding… " + done + "/" + total;
      }
    }

    function finishSubmit() {
      if (cancelBtn) cancelBtn.disabled = false;
      if (errors.length) {
        var msg =
          (total - errors.length) + " of " + total + " entr" + (total === 1 ? "y" : "ies") + " queued.\n\n" +
          errors.length + " failed:\n" +
          errors.slice(0, 10).map(function (e) { return "• " + e.entry + " — " + e.msg; }).join("\n") +
          (errors.length > 10 ? "\n…and " + (errors.length - 10) + " more" : "");
        window.gcAlert(msg);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Add entries";
        }
      } else {
        // Notify the rest of the app that the task queue changed
        if (typeof window.gcHsDispatchAfterDeleteBatch === "function") {
          window.gcHsDispatchAfterDeleteBatch();
        } else {
          document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
        }
        closeModal();
      }
    }

    submitNext();
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  function gcHsBulkAddInit() {
    modal = document.getElementById("gc-hs-bulk-add-modal");
    if (!modal) return;

    backdrop = modal.querySelector(".gc-hs-bulk-add-modal__backdrop");
    titleEl = document.getElementById("gc-hs-bulk-add-title");
    textareaEl = document.getElementById("gc-hs-bulk-add-textarea");
    formatPreEl = document.getElementById("gc-hs-bulk-add-format-pre");
    formatHintEl = document.getElementById("gc-hs-bulk-add-format-hint");
    summaryEl = document.getElementById("gc-hs-bulk-add-summary");
    summaryValidEl = document.getElementById("gc-hs-bulk-add-summary-valid");
    summaryInvalidEl = document.getElementById("gc-hs-bulk-add-summary-invalid");
    summaryDupeEl = document.getElementById("gc-hs-bulk-add-summary-dupe");
    validCountEl = document.getElementById("gc-hs-bulk-add-valid-count");
    invalidCountEl = document.getElementById("gc-hs-bulk-add-invalid-count");
    dupeCountEl = document.getElementById("gc-hs-bulk-add-dupe-count");
    invalidLinesEl = document.getElementById("gc-hs-bulk-add-invalid-lines");
    submitBtn = document.getElementById("gc-hs-bulk-add-submit");
    cancelBtn = document.getElementById("gc-hs-bulk-add-cancel");
    closeBtn = document.getElementById("gc-hs-bulk-add-close");
    targetLabelEl = document.getElementById("gc-hs-bulk-add-target-label");
    fwListEl = document.getElementById("gc-hs-bulk-add-fw-list");
    fwEmptyEl = document.getElementById("gc-hs-bulk-add-fw-empty");
    fwAllBtn = document.getElementById("gc-hs-bulk-add-fw-all");
    fwNoneBtn = document.getElementById("gc-hs-bulk-add-fw-none");

    if (textareaEl) {
      textareaEl.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateSummary, 200);
      });
    }

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (backdrop) backdrop.addEventListener("click", closeModal);

    if (fwAllBtn) {
      fwAllBtn.addEventListener("click", function () {
        if (!fwListEl) return;
        fwListEl.querySelectorAll('input[type="checkbox"][data-gc-bulk-fw-id]').forEach(function (cb) {
          cb.checked = true;
        });
        updateSubmitBtn();
      });
    }

    if (fwNoneBtn) {
      fwNoneBtn.addEventListener("click", function () {
        if (!fwListEl) return;
        fwListEl.querySelectorAll('input[type="checkbox"][data-gc-bulk-fw-id]').forEach(function (cb) {
          cb.checked = false;
        });
        updateSubmitBtn();
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", doSubmit);
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal && !modal.hidden) {
        e.preventDefault();
        closeModal();
      }
    });
  }

  // Expose for external use
  globalThis.gcHsBulkAddInit = gcHsBulkAddInit;
  globalThis.gcHsBulkAddOpen = openModal;
})();
