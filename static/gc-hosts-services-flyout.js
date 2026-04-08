/**
 * Hosts & Services flyout: structured IP host panel (mocks/iphost *.png) or generic flat fields.
 */
(function () {
  "use strict";

  var flyout = null;
  var panel = null;
  var backdrop = null;
  var titleEl = null;
  var metaEl = null;
  var sectionLabelEl = null;
  var hintEl = null;
  var fieldsRoot = null;
  var closeBtn = null;
  var doneBtn = null;
  var saveBtn = null;
  /** @type {object|null} */
  var currentHsRow = null;

  function gcHsIsConfigurationTarget() {
    return typeof window.gcHsEntityTarget === "string" && window.gcHsEntityTarget === "configuration";
  }

  function gcHsNavInventoryArray() {
    if (gcHsIsConfigurationTarget()) {
      var c = window.gcNavConfigurationsJson;
      return Array.isArray(c) ? c : [];
    }
    var f = window.gcNavFirewallsJson;
    return Array.isArray(f) ? f : [];
  }

  function gcHsFlyoutMsSelector() {
    return gcHsIsConfigurationTarget() ? "[data-gc-cfg-ms]" : "[data-gc-fw-ms]";
  }

  function gcHsFlyoutIdAttr() {
    return gcHsIsConfigurationTarget() ? "data-gc-cfg-id" : "data-gc-fw-id";
  }

  function gcHsMultiTargetIdsPayload(ids) {
    if (gcHsIsConfigurationTarget()) {
      return { configuration_ids: ids };
    }
    return { firewall_ids: ids };
  }

  function gcHsTargetOwnerId(t) {
    if (!t) return null;
    if (gcHsIsConfigurationTarget()) {
      if (t.configuration_id != null) {
        var nc = parseInt(String(t.configuration_id), 10);
        return isNaN(nc) || nc <= 0 ? null : nc;
      }
      return null;
    }
    if (t.firewall_id != null) {
      var nf = parseInt(String(t.firewall_id), 10);
      return isNaN(nf) || nf <= 0 ? null : nf;
    }
    return null;
  }

  function gcHsNotifySaveSuccess() {
    if (gcHsIsConfigurationTarget()) {
      document.dispatchEvent(new CustomEvent("gc-configuration-entries-updated"));
    } else {
      document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
    }
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
    for (var i = 0; i < keys.length; i++) {
      var v = flat[keys[i]];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  function norm(s) {
    return String(s == null ? "" : s)
      .trim()
      .toLowerCase();
  }

  function netmaskToPrefix(nm) {
    nm = String(nm || "").trim();
    if (!nm) return null;
    var parts = nm.split(".");
    if (parts.length !== 4) return null;
    var bits = "";
    for (var i = 0; i < 4; i++) {
      var o = parseInt(parts[i], 10);
      if (isNaN(o) || o < 0 || o > 255) return null;
      var b = o.toString(2);
      while (b.length < 8) b = "0" + b;
      bits += b;
    }
    if (bits.indexOf("01") !== -1) return null;
    return bits.split("1").length - 1;
  }

  function subnetDisplayLabel(netmask) {
    var nm = String(netmask || "").trim();
    if (!nm) return "";
    var p = netmaskToPrefix(nm);
    if (p == null) return nm;
    return "/" + p + " (" + nm + ")";
  }

  /** @returns {string[]} */
  function hostGroupLabels(flat) {
    var out = [];
    if (!flat) return out;
    Object.keys(flat).forEach(function (k) {
      if (k === "HostGroupList.HostGroup") {
        var agg = String(flat[k] || "").trim();
        if (agg) {
          agg.split(",").forEach(function (part) {
            var p = String(part || "").trim();
            if (p) out.push(p);
          });
        }
      } else if (/^HostGroupList\.\d+\.HostGroup$/.test(k)) {
        var v = String(flat[k] || "").trim();
        if (v) out.push(v);
      }
    });
    return out.filter(function (x, i, a) {
      return a.indexOf(x) === i;
    });
  }

  function listOfIpContent(flat) {
    var direct = pick(flat, [
      "IPAddresses",
      "IPAddressList",
      "ListOfIPAddress",
      "HostAddressList",
      "IPList",
    ]);
    if (direct) return direct;
    var parts = [];
    Object.keys(flat).forEach(function (k) {
      if (/^IPAddresses\.\d+$/.test(k) || /^IPAddressList\.\d+$/.test(k) || /^ListOfIPAddress\.\d+$/.test(k)) {
        var v = String(flat[k] || "").trim();
        if (v) parts.push(v);
      }
    });
    return parts.join(", ");
  }

  /**
   * @returns {'ip'|'network'|'iprange'|'iplist'|'system'|'other'}
   */
  function hostTypeUiKind(hostTypeRaw) {
    var t = norm(hostTypeRaw);
    if (t === "ip") return "ip";
    if (t === "network") return "network";
    if (t === "iprange") return "iprange";
    if (t === "iplist" || t === "ip list" || t.indexOf("list") !== -1) return "iplist";
    if (t === "system host" || t.indexOf("system") !== -1) return "system";
    return "other";
  }

  /** Value sent as host_type_ui when the type control is read-only (matches server HostType). */
  function hostTypeUiValueForSave(flat) {
    var hostTypeRaw = pick(flat, ["HostType"]) || "";
    var kind = hostTypeUiKind(hostTypeRaw);
    if (kind === "other" && listOfIpContent(flat)) kind = "iplist";
    if (kind === "ip") return "ip";
    if (kind === "network") return "network";
    if (kind === "iprange") return "iprange";
    if (kind === "iplist") return "iplist";
    return "";
  }

  /**
   * @param {{ name: string, description?: string }[]} apiGroups
   * @param {string[]} selectedNames
   * @returns {{ name: string, description: string }[]}
   */
  function mergeSortedUniqueHostGroups(apiGroups, selectedNames) {
    var byName = {};
    (apiGroups || []).forEach(function (g) {
      var n = String(g && g.name != null ? g.name : "").trim();
      if (!n) return;
      var row = {
        name: n,
        description: String(g && g.description != null ? g.description : "").trim(),
      };
      if (g && Object.prototype.hasOwnProperty.call(g, "on_all_firewalls")) {
        row.on_all_firewalls = g.on_all_firewalls;
      }
      byName[n] = row;
    });
    (selectedNames || []).forEach(function (n) {
      var s = String(n || "").trim();
      if (!s) return;
      if (!byName[s]) byName[s] = { name: s, description: "", on_all_firewalls: true };
    });
    return Object.keys(byName)
      .sort(function (a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      })
      .map(function (k) {
        return byName[k];
      });
  }

  function hgSelectionSummary(count) {
    if (count === 0) return "No groups selected";
    if (count === 1) return "1 group selected";
    return count + " groups selected";
  }

  function fwSelectionSummary(count) {
    if (count === 0) return "No firewalls selected";
    if (count === 1) return "1 firewall selected";
    return count + " firewalls selected";
  }

  function ipVerRadio(name, value, label, checked, readOnly) {
    return (
      '<label class="gc-hs-ip-host-flyout__radio">' +
      '<input type="radio" name="' +
      escapeHtml(name) +
      '" value="' +
      escapeHtml(value) +
      '"' +
      (readOnly ? " disabled " : " ") +
      (checked ? "checked " : "") +
      "/>" +
      "<span>" +
      escapeHtml(label) +
      "</span></label>"
    );
  }

  function hostTypeRadioStr(name, value, label, checked, readOnly) {
    return (
      '<label class="gc-hs-ip-host-flyout__radio">' +
      '<input type="radio" name="' +
      escapeHtml(name) +
      '" value="' +
      escapeHtml(value) +
      '"' +
      (readOnly ? " disabled " : " ") +
      (checked ? "checked " : "") +
      "/>" +
      "<span>" +
      escapeHtml(label) +
      "</span></label>"
    );
  }

  function textInput(val, placeholder, extraClass, id, readOnly) {
    return (
      '<input id="' +
      escapeHtml(id) +
      '" type="text" class="gc-if-flyout__input mono' +
      (extraClass ? " " + extraClass : "") +
      '"' +
      (readOnly ? " readonly" : "") +
      ' value="' +
      escapeHtml(val) +
      '" placeholder="' +
      escapeHtml(placeholder) +
      '" />'
    );
  }

  function textareaInput(val, placeholder, rows, id, readOnly) {
    rows = rows || 3;
    return (
      '<textarea id="' +
      escapeHtml(id) +
      '" class="gc-if-flyout__input gc-hs-ip-host-flyout__textarea"' +
      (readOnly ? " readonly" : "") +
      ' rows="' +
      rows +
      '" placeholder="' +
      escapeHtml(placeholder) +
      '">' +
      escapeHtml(val) +
      "</textarea>"
    );
  }

  /**
   * @param {number[]} firewallIds Positive firewall ids (empty = cannot load groups).
   */
  function buildHostGroupSection(firewallIds, hgReadOnly) {
    var ids = [];
    if (Array.isArray(firewallIds)) {
      firewallIds.forEach(function (x) {
        var n = parseInt(String(x), 10);
        if (!isNaN(n) && n > 0) ids.push(n);
      });
    }
    var idsJson = escapeHtml(JSON.stringify(ids));
    var multiHint =
      ids.length > 1
        ? '<p class="muted gc-hs-ip-host-flyout__hg-aggregate-hint">Groups are the union across selected firewalls. A label marks groups that are missing on at least one selected firewall. Saving queues empty copies of those groups on firewalls where they are missing, before the new host.</p>'
        : "";
    return (
      '<div class="gc-if-flyout__field">' +
      '<span class="gc-if-flyout__label">IP host group</span>' +
      multiHint +
      '<div class="gc-hs-ip-host-flyout__hg-ms"' +
      ' data-gc-hg-ms="1"' +
      ' data-firewall-ids="' +
      idsJson +
      '"' +
      ' data-hg-readonly="' +
      (hgReadOnly ? "1" : "0") +
      '"' +
      ">" +
      '<div class="gc-multiselect__control gc-hs-ip-host-flyout__hg-ms-control">' +
      '<button type="button" class="gc-multiselect__trigger gc-hs-ip-host-flyout__hg-trigger" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="gc-multiselect__trigger-text gc-hs-ip-host-flyout__hg-trigger-text">Loading…</span>' +
      '<span class="gc-multiselect__chev" aria-hidden="true">▾</span>' +
      "</button>" +
      '<div class="gc-multiselect__dropdown gc-hs-ip-host-flyout__hg-dropdown" hidden>' +
      '<div class="gc-hs-ip-host-flyout__hg-search-wrap">' +
      '<input type="search" class="gc-if-flyout__input gc-hs-ip-host-flyout__hg-search" placeholder="Search groups" autocomplete="off" />' +
      "</div>" +
      '<div class="gc-hs-ip-host-flyout__hg-ms-options" role="listbox" aria-multiselectable="true"></div>' +
      '<p class="gc-hs-ip-host-flyout__hg-empty muted" hidden>No IP host groups synced for this firewall.</p>' +
      "</div></div>" +
      '<ul class="gc-hs-ip-host-flyout__hg-pills" aria-label="Selected groups"></ul>' +
      "</div></div>"
    );
  }

  /**
   * @param {"add"|"edit"} pickerMode
   * @param {number[]} initialSelectedIds
   * @param {number[]} [assignedFirewallIds] edit: firewalls that already have this host (for “add on save” hint)
   */
  function buildFirewallPickerSection(pickerMode, initialSelectedIds, assignedFirewallIds) {
    var ids = [];
    if (Array.isArray(initialSelectedIds)) {
      initialSelectedIds.forEach(function (x) {
        var n = parseInt(String(x), 10);
        if (!isNaN(n) && n > 0) ids.push(n);
      });
    }
    var idsJson = escapeHtml(JSON.stringify(ids));
    var assigned = [];
    if (Array.isArray(assignedFirewallIds)) {
      assignedFirewallIds.forEach(function (x) {
        var na = parseInt(String(x), 10);
        if (!isNaN(na) && na > 0) assigned.push(na);
      });
    }
    var assignedJson = escapeHtml(JSON.stringify(assigned));
    var pm = pickerMode === "edit" ? "edit" : "add";
    var isCfg = gcHsIsConfigurationTarget();
    var msAttr = isCfg ? 'data-gc-cfg-ms="1"' : 'data-gc-fw-ms="1"';
    var hint =
      pm === "add"
        ? isCfg
          ? '<p class="muted gc-hs-ip-host-flyout__fw-hint">The same host is stored on every configuration you leave selected. Search to filter the list.</p>'
          : '<p class="muted gc-hs-ip-host-flyout__fw-hint">The same host is created on every firewall you leave selected. Search to filter the list.</p>'
        : isCfg
          ? '<p class="muted gc-hs-ip-host-flyout__fw-hint">All configurations are listed. Uncheck to skip where the host exists. Newly checked configurations get this host added (and empty host groups created first if needed).</p>'
          : '<p class="muted gc-hs-ip-host-flyout__fw-hint">All inventory firewalls are listed. Uncheck to skip updates where the host exists. Newly checked firewalls get this host added (and empty host groups created first if needed), same as Add IP host.</p>';
    var lbl = isCfg ? "Configurations" : "Firewalls";
    var ph = isCfg ? "Search configurations" : "Search firewalls";
    var emptyT = isCfg ? "No configurations available." : "No firewalls available.";
    return (
      '<div class="gc-if-flyout__field gc-hs-ip-host-flyout__fw-field">' +
      '<span class="gc-if-flyout__label">' +
      lbl +
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
      '<span class="gc-multiselect__trigger-text gc-hs-ip-host-flyout__fw-trigger-text">Loading…</span>' +
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

  function buildIpHostAddressInnerHtml(kind, vals, readOnly) {
    vals = vals || {};
    var ipAddr = vals.ipAddr != null ? String(vals.ipAddr) : "";
    var subnet = vals.subnet != null ? String(vals.subnet) : "";
    var startIp = vals.startIp != null ? String(vals.startIp) : "";
    var endIp = vals.endIp != null ? String(vals.endIp) : "";
    var listContent = vals.listContent != null ? String(vals.listContent) : "";
    var roAttr = readOnly ? " readonly" : "";
    if (kind === "system" || kind === "other") {
      return (
        '<div class="gc-if-flyout__field gc-hs-ip-host-flyout__conditional">' +
        '<span class="gc-if-flyout__label">Address details</span>' +
        '<p class="muted gc-hs-ip-host-flyout__na">Not applicable for this host type, or not present in the sync payload.</p>' +
        "</div>"
      );
    }
    if (kind === "ip") {
      return (
        '<div class="gc-if-flyout__field gc-hs-ip-host-flyout__conditional" data-gc-combine-field-keys="IPAddress">' +
        '<label class="gc-if-flyout__label" for="gc-hs-ip-addr-single">IP address <span class="gc-if-flyout__req" aria-hidden="true">*</span></label>' +
        '<input id="gc-hs-ip-addr-single" type="text" class="gc-if-flyout__input mono"' +
        roAttr +
        ' value="' +
        escapeHtml(ipAddr) +
        '" placeholder="e.g. 192.168.1.1" />' +
        "</div>"
      );
    }
    if (kind === "network") {
      return (
        '<div class="gc-if-flyout__field gc-hs-ip-host-flyout__conditional" data-gc-combine-field-keys="IPAddress">' +
        '<label class="gc-if-flyout__label" for="gc-hs-ip-net-addr">IP address <span class="gc-if-flyout__req" aria-hidden="true">*</span></label>' +
        '<input id="gc-hs-ip-net-addr" type="text" class="gc-if-flyout__input mono"' +
        roAttr +
        ' value="' +
        escapeHtml(ipAddr) +
        '" />' +
        "</div>" +
        '<div class="gc-if-flyout__field gc-hs-ip-host-flyout__conditional" data-gc-combine-field-keys="Subnet">' +
        '<label class="gc-if-flyout__label" for="gc-hs-ip-subnet">Subnet</label>' +
        '<input id="gc-hs-ip-subnet" type="text" class="gc-if-flyout__input mono"' +
        roAttr +
        ' value="' +
        escapeHtml(subnet) +
        '" placeholder="e.g. 255.255.255.0"' +
        (subnet ? ' title="' + escapeHtml(subnetDisplayLabel(subnet)) + '"' : "") +
        " />" +
        "</div>"
      );
    }
    if (kind === "iprange") {
      return (
        '<div class="gc-if-flyout__field gc-hs-ip-host-flyout__conditional" data-gc-combine-field-keys="StartIPAddress">' +
        '<label class="gc-if-flyout__label" for="gc-hs-ip-range-start">Start IP <span class="gc-if-flyout__req" aria-hidden="true">*</span></label>' +
        '<input id="gc-hs-ip-range-start" type="text" class="gc-if-flyout__input mono"' +
        roAttr +
        ' value="' +
        escapeHtml(startIp) +
        '" aria-label="Start IP" />' +
        "</div>" +
        '<div class="gc-if-flyout__field gc-hs-ip-host-flyout__conditional" data-gc-combine-field-keys="EndIPAddress">' +
        '<label class="gc-if-flyout__label" for="gc-hs-ip-range-end">End IP <span class="gc-if-flyout__req" aria-hidden="true">*</span></label>' +
        '<input id="gc-hs-ip-range-end" type="text" class="gc-if-flyout__input mono"' +
        roAttr +
        ' value="' +
        escapeHtml(endIp) +
        '" aria-label="End IP" />' +
        "</div>"
      );
    }
    if (kind === "iplist") {
      return (
        '<div class="gc-if-flyout__field gc-hs-ip-host-flyout__conditional" data-gc-combine-field-keys="ListOfIPAddress,ListOfIPAddresses,IPAddresses,IPAddressList">' +
        '<label class="gc-if-flyout__label" for="gc-hs-ip-list">List of IP addresses <span class="gc-if-flyout__req" aria-hidden="true">*</span></label>' +
        textareaInput(listContent, "E.g. 192.168.1.125, 192.236.25.1", 5, "gc-hs-ip-list", readOnly) +
        '<p class="gc-hs-ip-host-flyout__iplist-hint muted">Maximum 1000 IP addresses</p>' +
        "</div>"
      );
    }
    return (
      '<div class="gc-if-flyout__field gc-hs-ip-host-flyout__conditional">' +
      '<span class="gc-if-flyout__label">Address details</span>' +
      '<p class="muted gc-hs-ip-host-flyout__na">Not applicable for this host type, or not present in the sync payload.</p>' +
      "</div>"
    );
  }

  function scrapeIpHostAddressVals(root) {
    var slot = root.querySelector("#gc-hs-ip-address-slot");
    var out = { ipAddr: "", subnet: "", startIp: "", endIp: "", listContent: "" };
    if (!slot) return out;
    var x;
    x = slot.querySelector("#gc-hs-ip-addr-single");
    if (x) out.ipAddr = String(x.value || "");
    x = slot.querySelector("#gc-hs-ip-net-addr");
    if (x) out.ipAddr = String(x.value || "");
    x = slot.querySelector("#gc-hs-ip-subnet");
    if (x) out.subnet = String(x.value || "");
    x = slot.querySelector("#gc-hs-ip-range-start");
    if (x) out.startIp = String(x.value || "");
    x = slot.querySelector("#gc-hs-ip-range-end");
    if (x) out.endIp = String(x.value || "");
    x = slot.querySelector("#gc-hs-ip-list");
    if (x) out.listContent = String(x.value || "");
    return out;
  }

  function applyIpHostAddressKind(root, kind) {
    var slot = root.querySelector("#gc-hs-ip-address-slot");
    if (!slot) return;
    var vals = scrapeIpHostAddressVals(root);
    slot.innerHTML = buildIpHostAddressInnerHtml(kind, vals, false);
  }

  function buildIpHostFormHtml(row, opts) {
    opts = opts || {};
    var typeEditable = !!opts.typeEditable;
    var flat = row.flat && typeof row.flat === "object" ? row.flat : {};
    var systemHost = !!row.system_host;
    var name =
      pick(flat, ["Name"]) ||
      String((row.cells && row.cells["__name"]) || "").trim() ||
      String(row.external_name || "").trim() ||
      "";
    var desc = pick(flat, ["Description"]);
    var ipFamily = pick(flat, ["IPFamily"]) || "IPv4";
    var hostTypeRaw = pick(flat, ["HostType"]) || "";
    var kind = hostTypeUiKind(hostTypeRaw);
    if (kind === "other" && listOfIpContent(flat)) kind = "iplist";
    if (typeEditable && (kind === "system" || kind === "other")) kind = "ip";

    var ip4 = norm(ipFamily) !== "ipv6";
    var ip6 = norm(ipFamily) === "ipv6";

    var typeIp = kind === "ip";
    var typeNet = kind === "network";
    var typeRange = kind === "iprange";
    var typeList = kind === "iplist";
    var typeSystem = kind === "system";
    var typeOther = kind === "other";

    var ro = systemHost || typeSystem;
    var flyoutEditable = typeEditable ? true : !ro;

    var ipAddr = pick(flat, ["IPAddress"]);
    var startIp = pick(flat, ["StartIPAddress"]);
    var endIp = pick(flat, ["EndIPAddress"]);
    var subnet = pick(flat, ["Subnet"]);
    var listContent = listOfIpContent(flat);

    var ipVersionHtml =
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="IPFamily">' +
      '<span class="gc-if-flyout__label">IP version <span class="gc-if-flyout__req" aria-hidden="true">*</span></span>' +
      '<div class="gc-hs-ip-host-flyout__radio-row" role="radiogroup" aria-label="IP version">' +
      ipVerRadio("gc-hs-ipver", "IPv4", "IPv4", ip4, ro || !flyoutEditable) +
      ipVerRadio("gc-hs-ipver", "IPv6", "IPv6", ip6, ro || !flyoutEditable) +
      "</div></div>";

    var hiddenType = "";
    var typeHtml;
    if (typeEditable) {
      typeHtml =
        '<div class="gc-if-flyout__field" id="gc-hs-ip-type-field" data-gc-combine-field-keys="HostType">' +
        '<span class="gc-if-flyout__label">Type <span class="gc-if-flyout__req" aria-hidden="true">*</span></span>' +
        '<div class="gc-hs-ip-host-flyout__radio-row gc-hs-ip-host-flyout__radio-row--wrap" role="radiogroup" aria-label="Host type">' +
        hostTypeRadioStr("gc-hs-htype", "ip", "IP", typeIp, false) +
        hostTypeRadioStr("gc-hs-htype", "network", "Network", typeNet, false) +
        hostTypeRadioStr("gc-hs-htype", "iprange", "IP range", typeRange, false) +
        hostTypeRadioStr("gc-hs-htype", "iplist", "IP list", typeList, false) +
        "</div></div>";
    } else {
      hiddenType =
        '<input type="hidden" id="gc-hs-htype-ui" value="' +
        escapeHtml(hostTypeUiValueForSave(flat)) +
        '" />';
      typeHtml =
        '<div class="gc-if-flyout__field" data-gc-combine-field-keys="HostType">' +
        '<span class="gc-if-flyout__label">Type <span class="gc-if-flyout__req" aria-hidden="true">*</span></span>' +
        '<p class="gc-hs-ip-host-flyout__type-note gc-hs-ip-host-flyout__type-note--solo muted">' +
        '<span class="mono">' +
        escapeHtml(hostTypeRaw || "—") +
        "</span></p>" +
        "</div>";
    }

    var addrRo = ro || !flyoutEditable;
    var addressInner = buildIpHostAddressInnerHtml(kind, {
      ipAddr: ipAddr,
      subnet: subnet,
      startIp: startIp,
      endIp: endIp,
      listContent: listContent,
    }, addrRo);

    var pickerMode = opts.pickerMode === "edit" ? "edit" : "add";
    var initialFwIds = [];
    if (pickerMode === "add") {
      if (Array.isArray(opts.addFirewallIds)) {
        opts.addFirewallIds.forEach(function (x) {
          var nInit = parseInt(String(x), 10);
          if (!isNaN(nInit) && nInit > 0) initialFwIds.push(nInit);
        });
      }
    } else {
      if (Array.isArray(row.ip_host_edit_targets) && row.ip_host_edit_targets.length) {
        row.ip_host_edit_targets.forEach(function (t) {
          if (t && t.firewall_id != null) {
            var nt = parseInt(String(t.firewall_id), 10);
            if (!isNaN(nt) && nt > 0) initialFwIds.push(nt);
          }
        });
      } else if (row.firewall_id != null && String(row.firewall_id).trim() !== "") {
        var oneInit = parseInt(String(row.firewall_id), 10);
        if (!isNaN(oneInit) && oneInit > 0) initialFwIds = [oneInit];
      }
    }
    var assignedForPicker = pickerMode === "edit" ? initialFwIds.slice() : [];
    var fwPickerHtml = buildFirewallPickerSection(pickerMode, initialFwIds, assignedForPicker);
    var hgFwIds = initialFwIds.slice();

    var nameDescRo = ro || !flyoutEditable;
    return (
      '<div class="gc-hs-ip-host-flyout">' +
      fwPickerHtml +
      hiddenType +
      '<div class="gc-if-flyout__field">' +
      '<label class="gc-if-flyout__label" for="gc-hs-ip-name">Name <span class="gc-if-flyout__req" aria-hidden="true">*</span></label>' +
      textInput(name, "Enter hostname", "", "gc-hs-ip-name", nameDescRo) +
      "</div>" +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="Description">' +
      '<label class="gc-if-flyout__label" for="gc-hs-ip-desc">Description</label>' +
      textareaInput(desc, "Enter description", 3, "gc-hs-ip-desc", nameDescRo) +
      "</div>" +
      ipVersionHtml +
      typeHtml +
      '<div id="gc-hs-ip-address-slot" class="gc-hs-ip-host-flyout__address-slot">' +
      addressInner +
      "</div>" +
      buildHostGroupSection(hgFwIds, ro) +
      "</div>"
    );
  }

  function collectIpHostForm(root) {
    var out = {};
    if (!root) return out;
    var nameEl = root.querySelector("#gc-hs-ip-name");
    var descEl = root.querySelector("#gc-hs-ip-desc");
    out.name = nameEl ? String(nameEl.value || "").trim() : "";
    out.description = descEl ? String(descEl.value || "") : "";
    var ver = root.querySelector('input[name="gc-hs-ipver"]:checked');
    out.ip_family = ver ? String(ver.value || "").trim() : "";
    var htRadio = root.querySelector('input[name="gc-hs-htype"]:checked');
    if (htRadio) {
      out.host_type_ui = String(htRadio.value || "").trim().toLowerCase();
    } else {
      var htHidden = root.querySelector("#gc-hs-htype-ui");
      out.host_type_ui = htHidden ? String(htHidden.value || "").trim().toLowerCase() : "";
    }
    var ui = out.host_type_ui || "";
    var hgNames = [];
    root.querySelectorAll('input[type="checkbox"][data-gc-hg-name]').forEach(function (cb) {
      if (cb.checked) {
        var nm = cb.getAttribute("data-gc-hg-name");
        if (nm) hgNames.push(nm);
      }
    });
    out.host_groups = hgNames;
    if (ui === "ip") {
      var ip = root.querySelector("#gc-hs-ip-addr-single");
      out.ip_address = ip ? String(ip.value || "").trim() : "";
    } else if (ui === "network") {
      var ipn = root.querySelector("#gc-hs-ip-net-addr");
      var sn = root.querySelector("#gc-hs-ip-subnet");
      out.ip_address = ipn ? String(ipn.value || "").trim() : "";
      out.subnet = sn ? String(sn.value || "").trim() : "";
    } else if (ui === "iprange") {
      var rs = root.querySelector("#gc-hs-ip-range-start");
      var re = root.querySelector("#gc-hs-ip-range-end");
      out.start_ip = rs ? String(rs.value || "").trim() : "";
      out.end_ip = re ? String(re.value || "").trim() : "";
    } else if (ui === "iplist") {
      var tl = root.querySelector("#gc-hs-ip-list");
      out.ip_list = tl ? String(tl.value || "") : "";
    }
    return out;
  }

  function collectFlyoutFirewallIdsOrdered() {
    var out = [];
    if (!fieldsRoot) return out;
    var ms = fieldsRoot.querySelector(gcHsFlyoutMsSelector());
    if (!ms) return out;
    var idA = gcHsFlyoutIdAttr();
    ms.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      if (!cb.checked) return;
      if (!cb.hasAttribute(idA)) return;
      var n = parseInt(String(cb.getAttribute(idA) || ""), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function refreshHostGroupSectionForFlyoutFirewallIds() {
    if (!fieldsRoot || !flyout) return;
    if (flyout.getAttribute("data-gc-hs-flyout-kind") !== "ip-host") return;
    var msHg = fieldsRoot.querySelector("[data-gc-hg-ms]");
    if (!msHg) return;
    var field = msHg.closest(".gc-if-flyout__field");
    if (!field || !field.parentNode) return;
    var ids = collectFlyoutFirewallIdsOrdered();
    var readOnlyHg = false;
    if (flyout.getAttribute("data-gc-hs-ip-host-mode") === "edit" && currentHsRow) {
      var f0 = currentHsRow.flat && typeof currentHsRow.flat === "object" ? currentHsRow.flat : {};
      readOnlyHg =
        !!currentHsRow.system_host || hostTypeUiKind(pick(f0, ["HostType"])) === "system";
    }
    var wrap = document.createElement("div");
    wrap.innerHTML = buildHostGroupSection(ids, readOnlyHg);
    var replacement = wrap.firstElementChild;
    if (!replacement) return;
    field.parentNode.replaceChild(replacement, field);
    if (currentHsRow) {
      if (gcHsIsConfigurationTarget()) {
        currentHsRow.configuration_id = ids.length ? ids[0] : null;
      } else {
        currentHsRow.firewall_id = ids.length ? ids[0] : null;
      }
      hydrateIpHostHostGroupMs(fieldsRoot, currentHsRow);
    }
  }

  function hydrateIpHostFirewallMs(root, ctx) {
    var ms = root.querySelector(gcHsFlyoutMsSelector());
    if (!ms) return;
    var idA = gcHsFlyoutIdAttr();
    ctx = ctx || {};
    var row = ctx.row || currentHsRow || {};
    var mode = ms.getAttribute("data-fw-picker-mode") || "add";
    var trigger = ms.querySelector(".gc-hs-ip-host-flyout__fw-trigger");
    var triggerText = ms.querySelector(".gc-hs-ip-host-flyout__fw-trigger-text");
    var dropdown = ms.querySelector(".gc-hs-ip-host-flyout__fw-dropdown");
    var search = ms.querySelector(".gc-hs-ip-host-flyout__fw-search");
    var optsRoot = ms.querySelector(".gc-hs-ip-host-flyout__fw-ms-options");
    var emptyEl = ms.querySelector(".gc-hs-ip-host-flyout__fw-empty");
    var pillsEl = ms.querySelector(".gc-hs-ip-host-flyout__fw-pills");

    var initialSet = {};
    try {
      var rawInit = ms.getAttribute("data-fw-initial-selected");
      if (rawInit) {
        var arr = JSON.parse(rawInit);
        if (Array.isArray(arr)) {
          arr.forEach(function (x) {
            var n = parseInt(String(x), 10);
            if (!isNaN(n) && n > 0) initialSet[String(n)] = true;
          });
        }
      }
    } catch (eInit) {}

    var assignedSet = {};
    try {
      var rawA = ms.getAttribute("data-fw-assigned-ids");
      if (rawA) {
        var arrA = JSON.parse(rawA);
        if (Array.isArray(arrA)) {
          arrA.forEach(function (x) {
            var na = parseInt(String(x), 10);
            if (!isNaN(na) && na > 0) assignedSet[String(na)] = true;
          });
        }
      }
    } catch (eAs) {}

    function setOpen(open) {
      if (!dropdown) return;
      dropdown.hidden = !open;
      if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function countFwChecked() {
      var n = 0;
      ms.querySelectorAll("input[type=\"checkbox\"]").forEach(function (cb) {
        if (!cb.hasAttribute(idA) || !cb.checked) return;
        n++;
      });
      return n;
    }

    function syncTriggerText() {
      if (triggerText) triggerText.textContent = fwSelectionSummary(countFwChecked());
    }

    function syncPills() {
      if (!pillsEl) return;
      pillsEl.innerHTML = "";
      var items = [];
      ms.querySelectorAll("input[type=\"checkbox\"]").forEach(function (cb) {
        if (!cb.hasAttribute(idA) || !cb.checked) return;
        var id = String(cb.getAttribute(idA) || "");
        var lab = String(cb.getAttribute("data-gc-fw-label") || id).trim() || id;
        items.push({ id: id, lab: lab });
      });
      items.sort(function (a, b) {
        return a.lab.toLowerCase().localeCompare(b.lab.toLowerCase());
      });
      items.forEach(function (it) {
        var li = document.createElement("li");
        li.className = "gc-hs-ip-host-flyout__fw-pill mono";
        li.textContent = it.lab;
        li.setAttribute("title", it.lab);
        pillsEl.appendChild(li);
      });
    }

    function onFwCheckboxChange() {
      syncTriggerText();
      syncPills();
      refreshHostGroupSectionForFlyoutFirewallIds();
      if (typeof window.gcHsOnFlyoutFirewallSelectionChange === "function") {
        try {
          window.gcHsOnFlyoutFirewallSelectionChange(fieldsRoot);
        } catch (eFwHook) {}
      }
    }

    function renderFwOptions(items) {
      if (!optsRoot) return;
      optsRoot.innerHTML = "";
      (items || []).forEach(function (it) {
        var id = it.id;
        var label = String(it.label != null ? it.label : "").trim() || String(id);
        var lab = document.createElement("label");
        lab.className = "gc-multiselect__option gc-hs-ip-host-flyout__fw-option";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.setAttribute(idA, String(id));
        cb.setAttribute("data-gc-fw-label", label);
        cb.checked = !!initialSet[String(id)];
        cb.addEventListener("change", onFwCheckboxChange);
        var textWrap = document.createElement("span");
        textWrap.className = "gc-hs-ip-host-flyout__hg-opt-text";
        var nameEl = document.createElement("span");
        nameEl.className = "gc-hs-ip-host-flyout__hg-opt-name mono";
        nameEl.textContent = label;
        textWrap.appendChild(nameEl);
        if (mode === "edit" && !assignedSet[String(id)]) {
          var nu = document.createElement("span");
          nu.className = "gc-hs-ip-host-flyout__fw-opt-new muted";
          nu.textContent = " · add on save";
          textWrap.appendChild(nu);
        }
        lab.appendChild(cb);
        lab.appendChild(textWrap);
        optsRoot.appendChild(lab);
      });
      if (emptyEl) {
        var showEmpty = !items || items.length === 0;
        emptyEl.hidden = !showEmpty;
        if (showEmpty) {
          emptyEl.textContent = gcHsIsConfigurationTarget()
            ? "No configurations registered."
            : "No firewalls registered.";
        }
      }
      syncTriggerText();
      syncPills();
    }

    function runFwFilter() {
      var q = norm(search ? search.value : "");
      ms.querySelectorAll(".gc-hs-ip-host-flyout__fw-option").forEach(function (lab) {
        var cb = lab.querySelector("input[type=\"checkbox\"]");
        if (!cb || !cb.hasAttribute(idA)) return;
        var nm = norm(cb.getAttribute("data-gc-fw-label") || "");
        var idStr = norm(String(cb.getAttribute(idA) || ""));
        var match = !q || nm.indexOf(q) !== -1 || idStr.indexOf(q) !== -1;
        lab.style.display = match ? "" : "none";
      });
    }

    if (trigger && dropdown) {
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var next = dropdown.hidden;
        var closeScope = root || fieldsRoot;
        if (closeScope) {
          closeScope.querySelectorAll(".gc-hs-ip-host-flyout__hg-dropdown").forEach(function (d) {
            d.hidden = true;
          });
          closeScope.querySelectorAll(".gc-hs-ip-host-flyout__fw-dropdown").forEach(function (d) {
            d.hidden = true;
          });
          closeScope.querySelectorAll(".gc-hs-ip-host-flyout__hg-trigger").forEach(function (t) {
            t.setAttribute("aria-expanded", "false");
          });
          closeScope.querySelectorAll(".gc-hs-ip-host-flyout__fw-trigger").forEach(function (t) {
            t.setAttribute("aria-expanded", "false");
          });
        }
        setOpen(next);
        if (next && search) {
          try {
            search.focus();
          } catch (eF) {}
        }
      });
    }

    if (dropdown) {
      dropdown.addEventListener("mousedown", function (e) {
        e.stopPropagation();
      });
      dropdown.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }

    if (search) {
      search.addEventListener("input", runFwFilter);
      search.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }

    var navItems = [];
    gcHsNavInventoryArray().forEach(function (fw) {
      if (!fw || fw.id == null) return;
      var fid = parseInt(String(fw.id), 10);
      if (isNaN(fid) || fid <= 0) return;
      var lbl = String(fw.label != null ? fw.label : "").trim() || String(fid);
      navItems.push({ id: fid, label: lbl });
    });
    navItems.sort(function (a, b) {
      return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
    });
    renderFwOptions(navItems);
    runFwFilter();
  }

  function hydrateIpHostHostGroupMs(root, row) {
    var ms = root.querySelector("[data-gc-hg-ms]");
    if (!ms) return;
    var readOnly = ms.getAttribute("data-hg-readonly") === "1";
    var flat = row.flat && typeof row.flat === "object" ? row.flat : {};
    var selected = hostGroupLabels(flat);
    var firewallIds = [];
    try {
      firewallIds = JSON.parse(ms.getAttribute("data-firewall-ids") || "[]");
      if (!Array.isArray(firewallIds)) firewallIds = [];
    } catch (e0) {
      firewallIds = [];
    }
    var urlBase = typeof window.gcHsIpHostgroupNamesUrl === "string" ? window.gcHsIpHostgroupNamesUrl : "";
    var aggUrl =
      typeof window.gcHsIpHostgroupAggregateUrl === "string" ? window.gcHsIpHostgroupAggregateUrl : "";
    var trigger = ms.querySelector(".gc-hs-ip-host-flyout__hg-trigger");
    var triggerText = ms.querySelector(".gc-hs-ip-host-flyout__hg-trigger-text");
    var dropdown = ms.querySelector(".gc-hs-ip-host-flyout__hg-dropdown");
    var search = ms.querySelector(".gc-hs-ip-host-flyout__hg-search");
    var optsRoot = ms.querySelector(".gc-hs-ip-host-flyout__hg-ms-options");
    var emptyEl = ms.querySelector(".gc-hs-ip-host-flyout__hg-empty");
    var pillsEl = ms.querySelector(".gc-hs-ip-host-flyout__hg-pills");

    function setOpen(open) {
      if (!dropdown) return;
      dropdown.hidden = !open;
      if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function countChecked() {
      var n = 0;
      ms.querySelectorAll('input[type="checkbox"][data-gc-hg-name]').forEach(function (cb) {
        if (cb.checked) n++;
      });
      return n;
    }

    function syncTriggerText() {
      if (triggerText) triggerText.textContent = hgSelectionSummary(countChecked());
    }

    function syncPills() {
      if (!pillsEl) return;
      pillsEl.innerHTML = "";
      var names = [];
      ms.querySelectorAll('input[type="checkbox"][data-gc-hg-name]').forEach(function (cb) {
        if (!cb.checked) return;
        var nm = cb.getAttribute("data-gc-hg-name");
        if (nm) names.push(nm);
      });
      names.sort(function (a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      });
      names.forEach(function (nm) {
        var li = document.createElement("li");
        li.className = "gc-hs-ip-host-flyout__hg-pill mono";
        li.textContent = nm;
        li.setAttribute("title", nm);
        pillsEl.appendChild(li);
      });
    }

    function onHgCheckboxChange() {
      syncTriggerText();
      syncPills();
    }

    function renderHostGroups(groups) {
      if (!optsRoot) return;
      optsRoot.innerHTML = "";
      var selectedSet = {};
      selected.forEach(function (s) {
        selectedSet[s] = true;
      });
      (groups || []).forEach(function (g) {
        var name = String(g && g.name != null ? g.name : "").trim();
        if (!name) return;
        var desc = String(g && g.description != null ? g.description : "").trim();
        var lab = document.createElement("label");
        lab.className = "gc-multiselect__option gc-hs-ip-host-flyout__hg-option";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.setAttribute("data-gc-hg-name", name);
        cb.checked = !!selectedSet[name];
        if (readOnly) cb.disabled = true;
        cb.addEventListener("change", onHgCheckboxChange);
        var textWrap = document.createElement("span");
        textWrap.className = "gc-hs-ip-host-flyout__hg-opt-text";
        var nameEl = document.createElement("span");
        nameEl.className = "gc-hs-ip-host-flyout__hg-opt-name mono";
        nameEl.textContent = name;
        textWrap.appendChild(nameEl);
        if (desc) {
          var sep = document.createElement("span");
          sep.className = "gc-hs-ip-host-flyout__hg-opt-sep muted";
          sep.textContent = " · ";
          textWrap.appendChild(sep);
          var descEl = document.createElement("span");
          descEl.className = "gc-hs-ip-host-flyout__hg-opt-desc muted";
          descEl.textContent = desc;
          textWrap.appendChild(descEl);
        }
        if (g && g.on_all_firewalls === false) {
          var part = document.createElement("span");
          part.className = "gc-hs-ip-host-flyout__hg-opt-partial muted";
          part.textContent = " · not on all selected firewalls";
          textWrap.appendChild(part);
        }
        lab.appendChild(cb);
        lab.appendChild(textWrap);
        optsRoot.appendChild(lab);
      });
      if (emptyEl) {
        var showEmpty = !groups || groups.length === 0;
        emptyEl.hidden = !showEmpty;
        if (showEmpty) {
          var multiFw = ms.getAttribute("data-firewall-ids");
          var nFw = 0;
          try {
            var parsed = JSON.parse(multiFw || "[]");
            if (Array.isArray(parsed)) nFw = parsed.length;
          } catch (e2) {
            nFw = 0;
          }
          emptyEl.textContent =
            nFw > 1
              ? "No IP host groups synced on any of the selected firewalls."
              : "No IP host groups synced for this firewall.";
        }
      }
      syncTriggerText();
      syncPills();
    }

    function runFilter() {
      var q = norm(search ? search.value : "");
      ms.querySelectorAll(".gc-hs-ip-host-flyout__hg-option").forEach(function (lab) {
        var cb = lab.querySelector("[data-gc-hg-name]");
        var nm = cb ? norm(cb.getAttribute("data-gc-hg-name") || "") : "";
        var descEl = lab.querySelector(".gc-hs-ip-host-flyout__hg-opt-desc");
        var dsc = descEl ? norm(descEl.textContent || "") : "";
        var match = !q || nm.indexOf(q) !== -1 || dsc.indexOf(q) !== -1;
        lab.style.display = match ? "" : "none";
      });
    }

    if (trigger && dropdown) {
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var next = dropdown.hidden;
        if (fieldsRoot) {
          fieldsRoot.querySelectorAll(".gc-hs-ip-host-flyout__hg-dropdown").forEach(function (d) {
            d.hidden = true;
          });
          fieldsRoot.querySelectorAll(".gc-hs-ip-host-flyout__hg-trigger").forEach(function (t) {
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

    if (dropdown) {
      dropdown.addEventListener("mousedown", function (e) {
        e.stopPropagation();
      });
      dropdown.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }

    if (search) {
      search.addEventListener("input", runFilter);
      search.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }

    if (firewallIds.length === 0) {
      if (triggerText) triggerText.textContent = "Firewall context missing";
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = "Cannot load groups without at least one selected firewall.";
      }
      return;
    }

    function finishWithRaw(raw) {
      if (!Array.isArray(raw)) {
        if (triggerText) triggerText.textContent = "Could not load groups";
        return;
      }
      var merged = mergeSortedUniqueHostGroups(raw, selected);
      renderHostGroups(merged);
      runFilter();
    }

    if (firewallIds.length > 1) {
      if (!aggUrl) {
        if (triggerText) triggerText.textContent = "Aggregate URL not configured";
        return;
      }
      fetch(aggUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gcHsMultiTargetIdsPayload(firewallIds)),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          var raw = x.j && x.j.groups;
          if (!x.ok || !Array.isArray(raw)) {
            if (triggerText) triggerText.textContent = "Could not load groups";
            return;
          }
          finishWithRaw(raw);
        })
        .catch(function () {
          if (triggerText) triggerText.textContent = "Could not load groups";
        });
      return;
    }

    if (!urlBase) {
      if (triggerText) triggerText.textContent = "Group list URL not configured";
      return;
    }
    var join = urlBase.indexOf("?") >= 0 ? "&" : "?";
    var qk = gcHsIsConfigurationTarget() ? "configuration_id" : "firewall_id";
    var u = urlBase + join + qk + "=" + encodeURIComponent(String(firewallIds[0]));
    fetch(u, { credentials: "same-origin" })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        var raw = x.j && x.j.groups;
        if (!x.ok || !Array.isArray(raw)) {
          if (triggerText) triggerText.textContent = "Could not load groups";
          return;
        }
        var merged = mergeSortedUniqueHostGroups(raw, selected);
        renderHostGroups(merged);
        runFilter();
      })
      .catch(function () {
        if (triggerText) triggerText.textContent = "Could not load groups";
      });
  }

  function buildGenericFieldsHtml(row) {
    var flat = row.flat && typeof row.flat === "object" ? row.flat : {};
    var keys = Object.keys(flat).sort();
    if (keys.length === 0) {
      return "<p class=\"muted\">No flattened fields in this payload.</p>";
    }
    return keys
      .map(function (k) {
        var v = flat[k] != null ? String(flat[k]) : "";
        var multiline = v.indexOf("\n") >= 0 || v.length > 120;
        var inputHtml = multiline
          ? "<textarea class=\"gc-if-flyout__input gc-hs-flyout__textarea\" readonly rows=\"4\">" +
            escapeHtml(v) +
            "</textarea>"
          : "<input type=\"text\" class=\"gc-if-flyout__input mono\" readonly value=\"" + escapeHtml(v) + "\" />";
        return (
          "<div class=\"gc-if-flyout__field\" data-gc-combine-field-keys=\"" +
          escapeHtml(k) +
          "\">" +
          "<label class=\"gc-if-flyout__label\">" +
          escapeHtml(k) +
          "</label>" +
          inputHtml +
          "</div>"
        );
      })
      .join("");
  }

  function bindResize(root) {
    var p = root.querySelector(".gc-if-flyout__panel");
    var handle = root.querySelector(".gc-if-flyout__resize");
    if (!p || !handle || handle.dataset.gcHsResizeBound === "1") return;
    handle.dataset.gcHsResizeBound = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var startX = e.clientX;
      var startW = p.getBoundingClientRect().width;
      var maxW = Math.min(720, window.innerWidth - 24);
      function onMove(e2) {
        var w = startW + (startX - e2.clientX);
        w = Math.max(280, Math.min(maxW, w));
        p.style.width = w + "px";
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function closeFlyout() {
    if (!flyout) return;
    currentHsRow = null;
    if (saveBtn) saveBtn.disabled = false;
    flyout.hidden = true;
    flyout.setAttribute("aria-hidden", "true");
    flyout.removeAttribute("data-gc-hs-flyout-kind");
    flyout.removeAttribute("data-gc-hs-ip-host-mode");
    flyout.removeAttribute("data-gc-hs-entity-mode");
  }

  function topBarSelectedFirewallIdsOrdered() {
    var getter = gcHsIsConfigurationTarget()
      ? typeof window.gcGetEffectiveConfigurationIds === "function"
        ? window.gcGetEffectiveConfigurationIds
        : window.gcGetSelectedConfigurationIds
      : window.gcGetSelectedFirewallIds;
    if (typeof getter === "function") {
      var eff = getter();
      var set = {};
      eff.forEach(function (id) {
        set[String(id)] = true;
      });
      var out = [];
      gcHsNavInventoryArray().forEach(function (fw) {
        if (fw && fw.id != null && set[String(fw.id)]) {
          var n = parseInt(String(fw.id), 10);
          if (!isNaN(n) && n > 0) out.push(n);
        }
      });
      return out;
    }
    var outLegacy = [];
    var sel = {};
    document.querySelectorAll(".gc-net-fw-cb:checked").forEach(function (cb) {
      sel[String(cb.value)] = true;
    });
    gcHsNavInventoryArray().forEach(function (fw) {
      if (sel[String(fw.id)]) {
        var n2 = parseInt(String(fw.id), 10);
        if (!isNaN(n2) && n2 > 0) outLegacy.push(n2);
      }
    });
    return outLegacy;
  }

  function collectEditConfigEntryIds() {
    var row = currentHsRow;
    if (!row) return [];
    var targets = row.hs_edit_targets;
    if (!Array.isArray(targets) || !targets.length) {
      targets = row.ip_host_edit_targets;
    }
    if (!Array.isArray(targets)) return [];
    var sel = {};
    collectFlyoutFirewallIdsOrdered().forEach(function (id) {
      sel[id] = true;
    });
    var out = [];
    targets.forEach(function (t) {
      if (!t || t.config_entry_id == null) return;
      var fid = gcHsTargetOwnerId(t);
      if (fid == null) return;
      if (!sel[fid]) return;
      var ce = parseInt(String(t.config_entry_id), 10);
      if (!isNaN(ce) && ce > 0) out.push(ce);
    });
    return out;
  }

  function collectEditCreateFirewallIds() {
    var row = currentHsRow;
    if (!row) return [];
    var existing = {};
    var targets = row.hs_edit_targets;
    if (!Array.isArray(targets) || !targets.length) {
      targets = row.ip_host_edit_targets;
    }
    (targets || []).forEach(function (t) {
      var oid = gcHsTargetOwnerId(t);
      if (oid != null) existing[oid] = true;
    });
    var out = [];
    collectFlyoutFirewallIdsOrdered().forEach(function (id) {
      if (!existing[id]) out.push(id);
    });
    return out;
  }

  function humanHsEntityTitle(entityKey) {
    var m = {
      fqdn_host: "FQDN host",
      service: "service",
      mac_host: "MAC host",
      ip_hostgroup: "IP host group",
      fqdn_hostgroup: "FQDN host group",
      service_group: "service group",
      country_group: "country group",
    };
    var k = String(entityKey || "").trim();
    return m[k] || k.replace(/_/g, " ");
  }

  function openFlyoutAddHsEntity(entityKey) {
    if (!flyout || typeof window.gcHsBuildFlyoutFieldsHtml !== "function") return;
    var ek = String(entityKey || "").trim();
    if (ek === "ip_host") {
      openFlyoutAddIpHost();
      return;
    }
    var ids =
      typeof window.gcHsTopBarFirewallIds === "function"
        ? window.gcHsTopBarFirewallIds()
        : topBarSelectedFirewallIdsOrdered();
    var fwid = ids.length ? ids[0] : null;
    var ist = gcHsIsConfigurationTarget();
    currentHsRow = {
      entity_type: ek,
      firewall_id: ist ? null : fwid,
      configuration_id: ist ? fwid : null,
      config_entry_id: null,
      external_name: "",
      flat: {},
      cells: {},
      hs_edit_targets: [],
    };
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.hidden = false;
    }
    if (titleEl) {
      titleEl.textContent = "Add " + humanHsEntityTitle(ek);
    }
    if (metaEl) metaEl.hidden = true;
    if (sectionLabelEl) sectionLabelEl.hidden = true;
    if (hintEl) hintEl.hidden = true;
    if (fieldsRoot) {
      fieldsRoot.innerHTML = window.gcHsBuildFlyoutFieldsHtml(ek, currentHsRow, "add", {
        firewallIds: ids,
      });
      flyout.setAttribute("data-gc-hs-flyout-kind", "hs-entity");
      flyout.setAttribute("data-gc-hs-entity-mode", "add");
      flyout.removeAttribute("data-gc-hs-ip-host-mode");
      if (window.gcHsHydrateFlyoutFirewallPicker) {
        window.gcHsHydrateFlyoutFirewallPicker(fieldsRoot, { row: currentHsRow });
      }
      if (window.gcHsHydrateHsEntityFields) {
        window.gcHsHydrateHsEntityFields(fieldsRoot, ek, currentHsRow, "add");
      }
    }
    flyout.hidden = false;
    flyout.setAttribute("aria-hidden", "false");
    if (panel) {
      try {
        panel.focus();
      } catch (e) {}
    }
  }

  function openFlyoutAddIpHost() {
    if (!flyout) return;
    var ids = topBarSelectedFirewallIdsOrdered();
    var fwid = ids.length ? ids[0] : null;
    var ist2 = gcHsIsConfigurationTarget();
    currentHsRow = {
      entity_type: "ip_host",
      firewall_id: ist2 ? null : fwid,
      configuration_id: ist2 ? fwid : null,
      config_entry_id: null,
      system_host: false,
      external_name: "",
      flat: {
        HostType: "IP",
        IPFamily: "IPv4",
        Name: "",
        Description: "",
      },
      cells: { firewall: "", __name: "" },
    };
    if (saveBtn) saveBtn.disabled = false;
    if (titleEl) titleEl.textContent = "Add IP host";
    if (metaEl) metaEl.hidden = true;
    if (sectionLabelEl) sectionLabelEl.hidden = true;
    if (hintEl) hintEl.hidden = true;
    if (saveBtn) saveBtn.hidden = false;
    if (fieldsRoot) {
      fieldsRoot.innerHTML = buildIpHostFormHtml(currentHsRow, {
        typeEditable: true,
        addFirewallIds: ids,
        pickerMode: "add",
      });
      flyout.setAttribute("data-gc-hs-flyout-kind", "ip-host");
      flyout.removeAttribute("data-gc-hs-entity-mode");
      flyout.setAttribute("data-gc-hs-ip-host-mode", "add");
      hydrateIpHostFirewallMs(fieldsRoot, { row: currentHsRow });
      hydrateIpHostHostGroupMs(fieldsRoot, currentHsRow);
    }
    flyout.hidden = false;
    flyout.setAttribute("aria-hidden", "false");
    if (panel) {
      try {
        panel.focus();
      } catch (e) {}
    }
  }

  var HS_MEMBER_TARGET_SLUG = {
    ip_host: "ip-host",
    fqdn_host: "fqdn-host",
    service: "service",
  };

  function hsMemberTargetTbodyId(targetEntityType) {
    var slug = HS_MEMBER_TARGET_SLUG[targetEntityType];
    if (!slug) return null;
    var base = gcHsIsConfigurationTarget() ? "gc-cfg-hs-" : "gc-hs-";
    return base + slug + "-tbody";
  }

  function hsScopedEntityRowOverlapsScope(entityRow, scopeSet) {
    if (!scopeSet) return false;
    var keys = Object.keys(scopeSet);
    if (!keys.length) return false;
    var targets = entityRow.hs_edit_targets || entityRow.ip_host_edit_targets;
    if (Array.isArray(targets) && targets.length) {
      for (var j = 0; j < targets.length; j++) {
        var oid = gcHsTargetOwnerId(targets[j]);
        if (oid != null && scopeSet[oid]) return true;
      }
      return false;
    }
    var sid = gcHsIsConfigurationTarget() ? entityRow.configuration_id : entityRow.firewall_id;
    var n = parseInt(String(sid), 10);
    return !isNaN(n) && n > 0 && !!scopeSet[n];
  }

  function gcHsFlyoutOpenEntityRowFromGroupMember(
    memberName,
    hostGroupRow,
    targetEntityType,
    entitySingularLabel,
    tabHint,
  ) {
    if (!flyout || !memberName || !hostGroupRow || !targetEntityType) return;
    var normMember = norm(String(memberName));
    if (!normMember) return;

    var scopeSet = {};
    var gt = hostGroupRow.hs_edit_targets;
    if (Array.isArray(gt)) {
      gt.forEach(function (t) {
        var oid = gcHsTargetOwnerId(t);
        if (oid != null) scopeSet[oid] = true;
      });
    }
    if (!Object.keys(scopeSet).length) return;

    var tbodyId = hsMemberTargetTbodyId(targetEntityType);
    if (!tbodyId) return;
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    var nodeList = tbody.querySelectorAll("tr");
    var found = null;
    for (var i = 0; i < nodeList.length; i++) {
      var tr = nodeList[i];
      var entRow = tr._gcNetRow;
      if (!entRow || String(entRow.entity_type || "") !== targetEntityType) continue;
      var cells = entRow.cells || {};
      var nm =
        String(cells["__name"] != null ? cells["__name"] : "").trim() ||
        String(entRow.external_name || "").trim();
      if (norm(nm) !== normMember) continue;
      if (!hsScopedEntityRowOverlapsScope(entRow, scopeSet)) continue;
      found = tr;
      break;
    }

    if (typeof window.gcTableListModalClose === "function") {
      window.gcTableListModalClose();
    }

    if (!found) {
      var scopeWord = gcHsIsConfigurationTarget() ? "configurations" : "firewalls";
      var hint = tabHint || "the matching tab";
      alert(
        "No " +
          entitySingularLabel +
          ' row found for "' +
          String(memberName).replace(/"/g, "'") +
          '" among the selected ' +
          scopeWord +
          ". Open " +
          hint +
          " and confirm the entry is synced.",
      );
      return;
    }

    openFlyout(found);
  }

  function gcHsFlyoutOpenIpHostFromGroupMember(memberName, hostGroupRow) {
    gcHsFlyoutOpenEntityRowFromGroupMember(
      memberName,
      hostGroupRow,
      "ip_host",
      "IP host",
      "the IP hosts tab",
    );
  }

  function gcHsFlyoutOpenFqdnHostFromGroupMember(memberName, hostGroupRow) {
    gcHsFlyoutOpenEntityRowFromGroupMember(
      memberName,
      hostGroupRow,
      "fqdn_host",
      "FQDN host",
      "the FQDN hosts tab",
    );
  }

  function gcHsFlyoutOpenServiceFromGroupMember(memberName, hostGroupRow) {
    gcHsFlyoutOpenEntityRowFromGroupMember(
      memberName,
      hostGroupRow,
      "service",
      "service",
      "the Services tab",
    );
  }

  function openFlyout(tr) {
    if (!flyout || !tr || !tr._gcNetRow) return;
    var row = tr._gcNetRow;
    currentHsRow = row;
    if (saveBtn) saveBtn.disabled = false;
    var cells = row.cells || {};
    var name =
      String(cells["__name"] != null ? cells["__name"] : "").trim() ||
      String(row.external_name || "").trim() ||
      "—";
    var fw =
      String(cells.firewall != null ? cells.firewall : "").trim() ||
      String(cells["__firewalls"] != null ? cells["__firewalls"] : "").trim() ||
      "—";
    var et = String(row.entity_type || "").trim() || "entry";

    if (titleEl) {
      titleEl.textContent = name;
    }
    if (metaEl) {
      metaEl.innerHTML =
        "<span class=\"mono\">" +
        escapeHtml(et.replace(/_/g, " ")) +
        "</span> · Firewall: <span class=\"mono\">" +
        escapeHtml(fw) +
        "</span> · #" +
        escapeHtml(String(row.config_entry_id != null ? row.config_entry_id : "")) +
        "";
    }

    var isIpHost = et === "ip_host";
    var HS_ENTITY_TYPES = {
      fqdn_host: true,
      service: true,
      mac_host: true,
      ip_hostgroup: true,
      fqdn_hostgroup: true,
      service_group: true,
      country_group: true,
    };
    var isHsEntity = !!HS_ENTITY_TYPES[et] && typeof window.gcHsBuildFlyoutFieldsHtml === "function";
    var flat0 = row.flat && typeof row.flat === "object" ? row.flat : {};
    var hostTypeForSave = pick(flat0, ["HostType"]);
    var sysByType = hostTypeUiKind(hostTypeForSave) === "system";
    var canEnqueueIpHost = isIpHost && !row.system_host && !sysByType;

    if (isIpHost && (!row.ip_host_edit_targets || !row.ip_host_edit_targets.length)) {
      if (row.configuration_id != null && row.config_entry_id != null && gcHsIsConfigurationTarget()) {
        row.ip_host_edit_targets = [
          {
            configuration_id: row.configuration_id,
            config_entry_id: row.config_entry_id,
            configuration_label: fw === "—" ? String(row.configuration_id) : fw,
          },
        ];
      } else if (row.firewall_id != null && row.config_entry_id != null) {
        row.ip_host_edit_targets = [
          {
            firewall_id: row.firewall_id,
            config_entry_id: row.config_entry_id,
            firewall_label: fw === "—" ? String(row.firewall_id) : fw,
          },
        ];
      }
    }

    if (!(Array.isArray(row.hs_edit_targets) && row.hs_edit_targets.length)) {
      if (row.configuration_id != null && row.config_entry_id != null && gcHsIsConfigurationTarget()) {
        row.hs_edit_targets = [
          {
            configuration_id: row.configuration_id,
            config_entry_id: row.config_entry_id,
            configuration_label: fw === "—" ? String(row.configuration_id) : fw,
          },
        ];
      } else if (row.firewall_id != null && row.config_entry_id != null) {
        row.hs_edit_targets = [
          {
            firewall_id: row.firewall_id,
            config_entry_id: row.config_entry_id,
            firewall_label: fw === "—" ? String(row.firewall_id) : fw,
          },
        ];
      }
    }

    flyout.setAttribute("data-gc-hs-ip-host-mode", "edit");

    if (isIpHost || isHsEntity) {
      if (metaEl) metaEl.hidden = true;
      if (sectionLabelEl) sectionLabelEl.hidden = true;
      if (hintEl) hintEl.hidden = true;
    } else {
      if (metaEl) metaEl.hidden = false;
      if (sectionLabelEl) {
        sectionLabelEl.hidden = false;
        sectionLabelEl.textContent = "Cached fields";
      }
      if (hintEl) {
        hintEl.hidden = false;
        hintEl.innerHTML =
          "Values reflect the last sync from the firewall. Editing and push-to-device follow the same task flow as <strong>Network · Interfaces</strong> in a future update.";
      }
    }

    if (saveBtn) {
      if (isHsEntity) saveBtn.hidden = false;
      else saveBtn.hidden = !canEnqueueIpHost;
    }

    if (fieldsRoot) {
      if (isIpHost) {
        fieldsRoot.innerHTML = buildIpHostFormHtml(row, { typeEditable: false, pickerMode: "edit" });
        flyout.setAttribute("data-gc-hs-flyout-kind", "ip-host");
        flyout.removeAttribute("data-gc-hs-entity-mode");
        hydrateIpHostFirewallMs(fieldsRoot, { row: row });
        hydrateIpHostHostGroupMs(fieldsRoot, row);
      } else if (isHsEntity) {
        fieldsRoot.innerHTML = window.gcHsBuildFlyoutFieldsHtml(et, row, "edit", {});
        flyout.setAttribute("data-gc-hs-flyout-kind", "hs-entity");
        flyout.setAttribute("data-gc-hs-entity-mode", "edit");
        flyout.removeAttribute("data-gc-hs-ip-host-mode");
        if (window.gcHsHydrateFlyoutFirewallPicker) {
          window.gcHsHydrateFlyoutFirewallPicker(fieldsRoot, { row: row });
        }
        if (window.gcHsHydrateHsEntityFields) {
          window.gcHsHydrateHsEntityFields(fieldsRoot, et, row, "edit");
        }
      } else {
        fieldsRoot.innerHTML = buildGenericFieldsHtml(row);
        flyout.setAttribute("data-gc-hs-flyout-kind", "generic");
        flyout.removeAttribute("data-gc-hs-entity-mode");
        flyout.removeAttribute("data-gc-hs-ip-host-mode");
      }
      if (typeof window.gcCombineFlyoutApplyConflictChrome === "function") {
        window.gcCombineFlyoutApplyConflictChrome(fieldsRoot, row, {});
      }
    }

    flyout.hidden = false;
    flyout.setAttribute("aria-hidden", "false");
    if (panel) {
      try {
        panel.focus();
      } catch (e) {}
    }
  }

  function gcHsFlyoutInit() {
    flyout = document.getElementById("gc-hs-edit-flyout");
    if (!flyout) return;
    panel = flyout.querySelector(".gc-if-flyout__panel");
    backdrop = flyout.querySelector(".gc-if-flyout__backdrop");
    titleEl = document.getElementById("gc-hs-flyout-title");
    metaEl = document.getElementById("gc-hs-flyout-meta");
    sectionLabelEl = document.getElementById("gc-hs-flyout-section-label");
    hintEl = document.getElementById("gc-hs-flyout-hint");
    fieldsRoot = document.getElementById("gc-hs-flyout-fields");
    closeBtn = document.getElementById("gc-hs-flyout-close");
    doneBtn = document.getElementById("gc-hs-flyout-done");
    saveBtn = document.getElementById("gc-hs-flyout-save");

    bindResize(flyout);

    var panelForm = flyout.querySelector(".gc-if-flyout__panel-form");
    if (panelForm && panelForm.dataset.gcHsHgPanelClose !== "1") {
      panelForm.dataset.gcHsHgPanelClose = "1";
      panelForm.addEventListener("click", function (e) {
        var fk = flyout && flyout.getAttribute("data-gc-hs-flyout-kind");
        if (!flyout || flyout.hidden || (fk !== "ip-host" && fk !== "hs-entity")) return;
        if (!fieldsRoot) return;
        if (e.target.closest("[data-gc-hg-ms]") || e.target.closest("[data-gc-fw-ms]")) return;
        fieldsRoot.querySelectorAll(".gc-hs-ip-host-flyout__hg-dropdown").forEach(function (d) {
          d.hidden = true;
        });
        fieldsRoot.querySelectorAll(".gc-hs-ip-host-flyout__fw-dropdown").forEach(function (d) {
          d.hidden = true;
        });
        fieldsRoot.querySelectorAll(".gc-hs-ip-host-flyout__hg-trigger").forEach(function (t) {
          t.setAttribute("aria-expanded", "false");
        });
        fieldsRoot.querySelectorAll(".gc-hs-ip-host-flyout__fw-trigger").forEach(function (t) {
          t.setAttribute("aria-expanded", "false");
        });
      });
    }

    if (fieldsRoot && fieldsRoot.dataset.gcHsHtypeDeleg !== "1") {
      fieldsRoot.dataset.gcHsHtypeDeleg = "1";
      fieldsRoot.addEventListener("change", function (e) {
        var t = e.target;
        if (!t || t.name !== "gc-hs-htype") return;
        if (!flyout || flyout.getAttribute("data-gc-hs-ip-host-mode") !== "add") return;
        applyIpHostAddressKind(fieldsRoot, String(t.value || "").trim().toLowerCase());
      });
    }

    function onClose() {
      closeFlyout();
    }

    if (closeBtn) closeBtn.addEventListener("click", onClose);
    if (doneBtn) doneBtn.addEventListener("click", onClose);
    if (backdrop) backdrop.addEventListener("click", onClose);

    if (saveBtn && saveBtn.dataset.gcHsSaveBound !== "1") {
      saveBtn.dataset.gcHsSaveBound = "1";
      saveBtn.addEventListener("click", function () {
        var fk = flyout.getAttribute("data-gc-hs-flyout-kind");
        if (fk === "hs-entity") {
          var et = currentHsRow && String(currentHsRow.entity_type || "").trim();
          if (!et || typeof window.gcHsCollectFlyoutEntityForm !== "function") {
            alert("Form is not available.");
            return;
          }
          var gForm = window.gcHsCollectFlyoutEntityForm(fieldsRoot, et);
          if (!gForm || !String(gForm.name || "").trim()) {
            alert("Name is required.");
            return;
          }
          if (et === "fqdn_host" && !String(gForm.fqdn || "").trim()) {
            alert("FQDN is required.");
            return;
          }
          saveBtn.disabled = true;
          var em = flyout.getAttribute("data-gc-hs-entity-mode");
          var upUrl =
            typeof window.gcHsEnqueueUpdatesBatchUrl === "string"
              ? window.gcHsEnqueueUpdatesBatchUrl
              : "";
          var crUrl =
            typeof window.gcHsEnqueueCreatesBatchUrl === "string"
              ? window.gcHsEnqueueCreatesBatchUrl
              : "";

          function finishHsOk() {
            gcHsNotifySaveSuccess();
            closeFlyout();
          }

          if (em === "add") {
            var fwIdsA = collectFlyoutFirewallIdsOrdered();
            if (!crUrl || !fwIdsA.length) {
              alert(
                gcHsIsConfigurationTarget()
                  ? "Select at least one configuration in the flyout, or the batch create URL is not configured."
                  : "Select at least one firewall in the flyout, or the batch create URL is not configured.",
              );
              saveBtn.disabled = false;
              return;
            }
            fetch(crUrl, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                Object.assign({ entity_type: et, form: gForm }, gcHsMultiTargetIdsPayload(fwIdsA)),
              ),
            })
              .then(function (r) {
                return r.json().then(function (j) {
                  return { ok: r.ok, j: j };
                });
              })
              .then(function (x) {
                if (!x.ok) {
                  var msg =
                    (x.j && (x.j.detail || x.j.message)) || "Could not enqueue create tasks.";
                  alert(typeof msg === "string" ? msg : JSON.stringify(msg));
                  saveBtn.disabled = false;
                  return;
                }
                finishHsOk();
              })
              .catch(function () {
                alert("Network error.");
                saveBtn.disabled = false;
              });
            return;
          }

          var updateEntryIdsH = collectEditConfigEntryIds();
          var createFwIdsH = collectEditCreateFirewallIds();
          if (!updateEntryIdsH.length && !createFwIdsH.length) {
            alert(gcHsIsConfigurationTarget() ? "Select at least one configuration." : "Select at least one firewall.");
            saveBtn.disabled = false;
            return;
          }

          function doCreatesH() {
            if (!createFwIdsH.length) {
              finishHsOk();
              return;
            }
            if (!crUrl) {
              alert("Task queue batch create URL is not configured.");
              saveBtn.disabled = false;
              return;
            }
            fetch(crUrl, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                Object.assign(
                  { entity_type: et, form: gForm },
                  gcHsMultiTargetIdsPayload(createFwIdsH),
                ),
              ),
            })
              .then(function (r) {
                return r.json().then(function (j) {
                  return { ok: r.ok, j: j };
                });
              })
              .then(function (x) {
                if (!x.ok) {
                  var msgC =
                    (x.j && (x.j.detail || x.j.message)) || "Could not enqueue create tasks.";
                  alert(typeof msgC === "string" ? msgC : JSON.stringify(msgC));
                  saveBtn.disabled = false;
                  return;
                }
                finishHsOk();
              })
              .catch(function () {
                alert("Network error.");
                saveBtn.disabled = false;
              });
          }

          if (updateEntryIdsH.length) {
            if (!upUrl) {
              alert("Task queue batch update URL is not configured.");
              saveBtn.disabled = false;
              return;
            }
            fetch(upUrl, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ config_entry_ids: updateEntryIdsH, form: gForm }),
            })
              .then(function (r) {
                return r.json().then(function (j) {
                  return { ok: r.ok, j: j };
                });
              })
              .then(function (x) {
                if (!x.ok) {
                  var msg2 =
                    (x.j && (x.j.detail || x.j.message)) || "Could not enqueue update tasks.";
                  alert(typeof msg2 === "string" ? msg2 : JSON.stringify(msg2));
                  saveBtn.disabled = false;
                  return;
                }
                doCreatesH();
              })
              .catch(function () {
                alert("Network error.");
                saveBtn.disabled = false;
              });
          } else {
            doCreatesH();
          }
          return;
        }

        var mode = flyout.getAttribute("data-gc-hs-ip-host-mode");
        var form = collectIpHostForm(fieldsRoot);
        if (!form.name) {
          alert("Name is required.");
          return;
        }
        saveBtn.disabled = true;
        if (mode === "add") {
          var bUrl =
            typeof window.gcHsIpHostEnqueueCreateBatchUrl === "string"
              ? window.gcHsIpHostEnqueueCreateBatchUrl
              : "";
          var fwIds = collectFlyoutFirewallIdsOrdered();
          if (!bUrl || !fwIds.length) {
            alert(
              gcHsIsConfigurationTarget()
                ? "Select at least one configuration in the flyout, or the batch create URL is not configured."
                : "Select at least one firewall in the flyout, or the batch create URL is not configured.",
            );
            saveBtn.disabled = false;
            return;
          }
          fetch(bUrl, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.assign({ form: form }, gcHsMultiTargetIdsPayload(fwIds))),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (!x.ok) {
                var msg =
                  (x.j && (x.j.detail || x.j.message)) || "Could not save to task queue.";
                alert(typeof msg === "string" ? msg : JSON.stringify(msg));
                saveBtn.disabled = false;
                return;
              }
              gcHsNotifySaveSuccess();
              closeFlyout();
            })
            .catch(function () {
              alert("Network error.");
              saveBtn.disabled = false;
            });
          return;
        }
        var updateEntryIds = collectEditConfigEntryIds();
        var createFwIds = collectEditCreateFirewallIds();
        if (!updateEntryIds.length && !createFwIds.length) {
          alert(gcHsIsConfigurationTarget() ? "Select at least one configuration." : "Select at least one firewall.");
          saveBtn.disabled = false;
          return;
        }
        var batchUpUrl =
          typeof window.gcHsIpHostEnqueueUpdatesBatchUrl === "string"
            ? window.gcHsIpHostEnqueueUpdatesBatchUrl
            : "";
        var createBatchUrl =
          typeof window.gcHsIpHostEnqueueCreateBatchUrl === "string"
            ? window.gcHsIpHostEnqueueCreateBatchUrl
            : "";

        function finishOk() {
          gcHsNotifySaveSuccess();
          closeFlyout();
        }

        function doCreates() {
          if (!createFwIds.length) {
            finishOk();
            return;
          }
          if (!createBatchUrl) {
            alert("Task queue batch create URL is not configured.");
            saveBtn.disabled = false;
            return;
          }
          fetch(createBatchUrl, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.assign({ form: form }, gcHsMultiTargetIdsPayload(createFwIds))),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (!x.ok) {
                var msgC =
                  (x.j && (x.j.detail || x.j.message)) || "Could not enqueue creates.";
                alert(typeof msgC === "string" ? msgC : JSON.stringify(msgC));
                saveBtn.disabled = false;
                return;
              }
              finishOk();
            })
            .catch(function () {
              alert("Network error.");
              saveBtn.disabled = false;
            });
        }

        if (updateEntryIds.length) {
          if (!batchUpUrl) {
            alert("Task queue batch update URL is not configured.");
            saveBtn.disabled = false;
            return;
          }
          fetch(batchUpUrl, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config_entry_ids: updateEntryIds, form: form }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (!x.ok) {
                var msg2 =
                  (x.j && (x.j.detail || x.j.message)) || "Could not save to task queue.";
                alert(typeof msg2 === "string" ? msg2 : JSON.stringify(msg2));
                saveBtn.disabled = false;
                return;
              }
              doCreates();
            })
            .catch(function () {
              alert("Network error.");
              saveBtn.disabled = false;
            });
        } else {
          doCreates();
        }
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && flyout && !flyout.hidden) {
        e.preventDefault();
        onClose();
      }
    });
  }

  window.gcHsFlyoutInit = gcHsFlyoutInit;
  window.gcHsFlyoutOpenFromTr = openFlyout;
  window.gcHsFlyoutOpenIpHostFromGroupMember = gcHsFlyoutOpenIpHostFromGroupMember;
  window.gcHsFlyoutOpenFqdnHostFromGroupMember = gcHsFlyoutOpenFqdnHostFromGroupMember;
  window.gcHsFlyoutOpenServiceFromGroupMember = gcHsFlyoutOpenServiceFromGroupMember;
  window.gcHsFlyoutOpenAddIpHost = openFlyoutAddIpHost;
  window.gcHsFlyoutOpenAddForEntity = openFlyoutAddHsEntity;
  window.gcHsHydrateFlyoutFirewallPicker = hydrateIpHostFirewallMs;
  window.gcHsDispatchAfterDeleteBatch = gcHsNotifySaveSuccess;
})();
