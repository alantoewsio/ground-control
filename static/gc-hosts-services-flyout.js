/**
 * Hosts & Services flyout: structured IP host panel (mocks/iphost *.png) or generic flat fields.
 */
(function () {
  "use strict";

  let flyout = null;
  let panel = null;
  let backdrop = null;
  let titleEl = null;
  let metaEl = null;
  let sectionLabelEl = null;
  let hintEl = null;
  let fieldsRoot = null;
  let closeBtn = null;
  let doneBtn = null;
  let saveBtn = null;
  /** @type {object|null} */
  let currentHsRow = null;

  function gcHsIsConfigurationTarget() {
    return typeof globalThis.gcHsEntityTarget === "string" && globalThis.gcHsEntityTarget === "configuration";
  }

  function gcHsNavInventoryArray() {
    if (gcHsIsConfigurationTarget()) {
      let c = globalThis.gcNavConfigurationsJson;
      return Array.isArray(c) ? c : [];
    }
    let f = globalThis.gcNavFirewallsJson;
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
        let nc = parseInt(String(t.configuration_id), 10);
        return isNaN(nc) || nc <= 0 ? null : nc;
      }
      return null;
    }
    if (t.firewall_id != null) {
      let nf = parseInt(String(t.firewall_id), 10);
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
    for (let i = 0; i < keys.length; i++) {
      let v = flat[keys[i]];
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
    let parts = nm.split(".");
    if (parts.length !== 4) return null;
    let bits = "";
    for (let i = 0; i < 4; i++) {
      let o = parseInt(parts[i], 10);
      if (isNaN(o) || o < 0 || o > 255) return null;
      let b = o.toString(2);
      while (b.length < 8) b = "0" + b;
      bits += b;
    }
    if (bits.indexOf("01") !== -1) return null;
    return bits.split("1").length - 1;
  }

  function subnetDisplayLabel(netmask) {
    let nm = String(netmask || "").trim();
    if (!nm) return "";
    let p = netmaskToPrefix(nm);
    if (p == null) return nm;
    return "/" + p + " (" + nm + ")";
  }

  /** @returns {string[]} */
  function hostGroupLabels(flat) {
    let out = [];
    if (!flat) return out;
    Object.keys(flat).forEach(function (k) {
      if (k === "HostGroupList.HostGroup") {
        let agg = String(flat[k] || "").trim();
        if (agg) {
          agg.split(",").forEach(function (part) {
            let p = String(part || "").trim();
            if (p) out.push(p);
          });
        }
      } else if (/^HostGroupList\.\d+\.HostGroup$/.test(k)) {
        let v = String(flat[k] || "").trim();
        if (v) out.push(v);
      }
    });
    return out.filter(function (x, i, a) {
      return a.indexOf(x) === i;
    });
  }

  function listOfIpContent(flat) {
    let direct = pick(flat, [
      "IPAddresses",
      "IPAddressList",
      "ListOfIPAddress",
      "HostAddressList",
      "IPList",
    ]);
    if (direct) return direct;
    let parts = [];
    Object.keys(flat).forEach(function (k) {
      if (/^IPAddresses\.\d+$/.test(k) || /^IPAddressList\.\d+$/.test(k) || /^ListOfIPAddress\.\d+$/.test(k)) {
        let v = String(flat[k] || "").trim();
        if (v) parts.push(v);
      }
    });
    return parts.join(", ");
  }

  /**
   * @returns {'ip'|'network'|'iprange'|'iplist'|'system'|'other'}
   */
  function hostTypeUiKind(hostTypeRaw) {
    let t = norm(hostTypeRaw);
    if (t === "ip") return "ip";
    if (t === "network") return "network";
    if (t === "iprange") return "iprange";
    if (t === "iplist" || t === "ip list" || t.indexOf("list") !== -1) return "iplist";
    if (t === "system host" || t.indexOf("system") !== -1) return "system";
    return "other";
  }

  /** Value sent as host_type_ui when the type control is read-only (matches server HostType). */
  function hostTypeUiValueForSave(flat) {
    let hostTypeRaw = pick(flat, ["HostType"]) || "";
    let kind = hostTypeUiKind(hostTypeRaw);
    if (kind === "other" && listOfIpContent(flat)) kind = "iplist";
    if (kind === "ip") return "ip";
    if (kind === "network") return "network";
    if (kind === "iprange") return "iprange";
    if (kind === "iplist") return "iplist";
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

  /**
   * @param {{ name: string, description?: string }[]} apiGroups
   * @param {string[]} selectedNames
   * @returns {{ name: string, description: string }[]}
   */
  function mergeSortedUniqueHostGroups(apiGroups, selectedNames) {
    let byName = {};
    (apiGroups || []).forEach(function (g) {
      let n = String(g && g.name != null ? g.name : "").trim();
      if (!n) return;
      let row = {
        name: n,
        description: String(g && g.description != null ? g.description : "").trim(),
      };
      if (g && Object.prototype.hasOwnProperty.call(g, "on_all_firewalls")) {
        row.on_all_firewalls = g.on_all_firewalls;
      }
      byName[n] = row;
    });
    (selectedNames || []).forEach(function (n) {
      let s = String(n || "").trim();
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

  function textInput(val, placeholder, extraClass, id, readOnly, attrs) {
    return (
      '<input id="' +
      escapeHtml(id) +
      '" type="text" class="gc-if-flyout__input mono' +
      (extraClass ? " " + extraClass : "") +
      '"' +
      (readOnly ? " readonly" : "") +
      htmlAttrs(attrs) +
      ' value="' +
      escapeHtml(val) +
      '" placeholder="' +
      escapeHtml(placeholder) +
      '" />'
    );
  }

  function textareaInput(val, placeholder, rows, id, readOnly, attrs) {
    rows = rows || 3;
    return (
      '<textarea id="' +
      escapeHtml(id) +
      '" class="gc-if-flyout__input gc-hs-ip-host-flyout__textarea"' +
      (readOnly ? " readonly" : "") +
      htmlAttrs(attrs) +
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
  function buildHostGroupSection(firewallIds, hgReadOnly, labelText) {
    let ids = [];
    if (Array.isArray(firewallIds)) {
      firewallIds.forEach(function (x) {
        let n = parseInt(String(x), 10);
        if (!isNaN(n) && n > 0) ids.push(n);
      });
    }
    let idsJson = escapeHtml(JSON.stringify(ids));
    let multiHint =
      ids.length > 1
        ? '<p class="muted gc-hs-ip-host-flyout__hg-aggregate-hint">Groups are the union across selected firewalls. A label marks groups that are missing on at least one selected firewall. Saving queues empty copies of those groups on firewalls where they are missing, before the new host.</p>'
        : "";
    return (
      '<div class="gc-if-flyout__field">' +
      '<span class="gc-if-flyout__label">' +
      escapeHtml(labelText || "IP host group") +
      "</span>" +
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
      '<span class="gc-multiselect__trigger-value">' +
      '<span class="gc-ms-trigger-chips gc-hs-ip-host-flyout__hg-trigger-chips" aria-hidden="true"></span>' +
      '<span class="gc-multiselect__trigger-text gc-hs-ip-host-flyout__hg-trigger-text">Loading…</span>' +
      "</span>" +
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
    let ids = [];
    if (Array.isArray(initialSelectedIds)) {
      initialSelectedIds.forEach(function (x) {
        let n = parseInt(String(x), 10);
        if (!isNaN(n) && n > 0) ids.push(n);
      });
    }
    let idsJson = escapeHtml(JSON.stringify(ids));
    let assigned = [];
    if (Array.isArray(assignedFirewallIds)) {
      assignedFirewallIds.forEach(function (x) {
        let na = parseInt(String(x), 10);
        if (!isNaN(na) && na > 0) assigned.push(na);
      });
    }
    let assignedJson = escapeHtml(JSON.stringify(assigned));
    let pm = pickerMode === "edit" ? "edit" : "add";
    let isCfg = gcHsIsConfigurationTarget();
    let msAttr = isCfg ? 'data-gc-cfg-ms="1"' : 'data-gc-fw-ms="1"';
    let hint =
      pm === "add"
        ? isCfg
          ? '<p class="muted gc-hs-ip-host-flyout__fw-hint">The same host is stored on every configuration you leave selected. Search to filter the list.</p>'
          : '<p class="muted gc-hs-ip-host-flyout__fw-hint">The same host is created on every firewall you leave selected. Search to filter the list.</p>'
        : isCfg
          ? '<p class="muted gc-hs-ip-host-flyout__fw-hint">All configurations are listed. Uncheck to skip where the host exists. Newly checked configurations get this host added (and empty host groups created first if needed).</p>'
          : '<p class="muted gc-hs-ip-host-flyout__fw-hint">All inventory firewalls are listed. Uncheck to skip updates where the host exists. Newly checked firewalls get this host added (and empty host groups created first if needed), same as Add IP host.</p>';
    let lbl = isCfg ? "Configurations" : "Firewalls";
    let ph = isCfg ? "Search configurations" : "Search firewalls";
    let emptyT = isCfg ? "No configurations available." : "No firewalls available.";
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

  function buildIpHostAddressInnerHtml(kind, vals, readOnly, ipHostSchema) {
    let fields = (ipHostSchema && ipHostSchema.fields) || {};
    let ipListCfg = fields.ipList || {};
    let ipListLabel = String(ipListCfg.label || "List of IP addresses");
    let ipListPlaceholder = String(ipListCfg.placeholder || "E.g. 192.168.1.125, 192.236.25.1");
    let ipListMaxItems = parseInt(String(ipListCfg.maxItems || 1000), 10);
    if (isNaN(ipListMaxItems) || ipListMaxItems < 1) ipListMaxItems = 1000;
    vals = vals || {};
    let ipAddr = vals.ipAddr != null ? String(vals.ipAddr) : "";
    let subnet = vals.subnet != null ? String(vals.subnet) : "";
    let startIp = vals.startIp != null ? String(vals.startIp) : "";
    let endIp = vals.endIp != null ? String(vals.endIp) : "";
    let listContent = vals.listContent != null ? String(vals.listContent) : "";
    let roAttr = readOnly ? " readonly" : "";
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
        '<label class="gc-if-flyout__label" for="gc-hs-ip-list">' +
        escapeHtml(ipListLabel) +
        ' <span class="gc-if-flyout__req" aria-hidden="true">*</span></label>' +
        textareaInput(listContent, ipListPlaceholder, 5, "gc-hs-ip-list", readOnly) +
        '<p class="gc-hs-ip-host-flyout__iplist-hint muted">Maximum ' +
        escapeHtml(String(ipListMaxItems)) +
        " IP addresses</p>" +
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
    let slot = root.querySelector("#gc-hs-ip-address-slot");
    let out = { ipAddr: "", subnet: "", startIp: "", endIp: "", listContent: "" };
    if (!slot) return out;
    let x;
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
    let slot = root.querySelector("#gc-hs-ip-address-slot");
    if (!slot) return;
    let vals = scrapeIpHostAddressVals(root);
    slot.innerHTML = buildIpHostAddressInnerHtml(kind, vals, false);
  }

  function buildIpHostFormHtml(row, opts) {
    opts = opts || {};
    let schema = getEntitySchema("ip_host") || {};
    let fields = schema.fields || {};
    let nameCfg = fields.name || {};
    let descCfg = fields.description || {};
    let hostGroupsCfg = fields.hostGroups || {};
    let typeEditable = !!opts.typeEditable;
    let flat = row.flat && typeof row.flat === "object" ? row.flat : {};
    let systemHost = !!row.system_host;
    let name =
      pick(flat, ["Name"]) ||
      String((row.cells && row.cells["__name"]) || "").trim() ||
      String(row.external_name || "").trim() ||
      "";
    let desc = pick(flat, ["Description"]);
    let ipFamily = pick(flat, ["IPFamily"]) || "IPv4";
    let hostTypeRaw = pick(flat, ["HostType"]) || "";
    let kind = hostTypeUiKind(hostTypeRaw);
    if (kind === "other" && listOfIpContent(flat)) kind = "iplist";
    if (typeEditable && (kind === "system" || kind === "other")) kind = "ip";

    let ip4 = norm(ipFamily) !== "ipv6";
    let ip6 = norm(ipFamily) === "ipv6";

    let typeIp = kind === "ip";
    let typeNet = kind === "network";
    let typeRange = kind === "iprange";
    let typeList = kind === "iplist";
    let typeSystem = kind === "system";
    let typeOther = kind === "other";

    let ro = systemHost || typeSystem;
    let flyoutEditable = typeEditable ? true : !ro;

    let ipAddr = pick(flat, ["IPAddress"]);
    let startIp = pick(flat, ["StartIPAddress"]);
    let endIp = pick(flat, ["EndIPAddress"]);
    let subnet = pick(flat, ["Subnet"]);
    let listContent = listOfIpContent(flat);

    let ipVersionHtml =
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="IPFamily">' +
      '<span class="gc-if-flyout__label">IP version <span class="gc-if-flyout__req" aria-hidden="true">*</span></span>' +
      '<div class="gc-hs-ip-host-flyout__radio-row" role="radiogroup" aria-label="IP version">' +
      ipVerRadio("gc-hs-ipver", "IPv4", "IPv4", ip4, ro || !flyoutEditable) +
      ipVerRadio("gc-hs-ipver", "IPv6", "IPv6", ip6, ro || !flyoutEditable) +
      "</div></div>";

    let hiddenType = "";
    let typeHtml;
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

    let addrRo = ro || !flyoutEditable;
    let addressInner = buildIpHostAddressInnerHtml(kind, {
      ipAddr: ipAddr,
      subnet: subnet,
      startIp: startIp,
      endIp: endIp,
      listContent: listContent,
    }, addrRo, schema);

    let pickerMode = opts.pickerMode === "edit" ? "edit" : "add";
    let initialFwIds = [];
    if (pickerMode === "add") {
      if (Array.isArray(opts.addFirewallIds)) {
        opts.addFirewallIds.forEach(function (x) {
          let nInit = parseInt(String(x), 10);
          if (!isNaN(nInit) && nInit > 0) initialFwIds.push(nInit);
        });
      }
    } else {
      if (Array.isArray(row.ip_host_edit_targets) && row.ip_host_edit_targets.length) {
        row.ip_host_edit_targets.forEach(function (t) {
          if (!t) return;
          if (gcHsIsConfigurationTarget()) {
            if (t.configuration_id != null) {
              let nc = parseInt(String(t.configuration_id), 10);
              if (!isNaN(nc) && nc > 0) initialFwIds.push(nc);
            }
          } else if (t.firewall_id != null) {
            let nt = parseInt(String(t.firewall_id), 10);
            if (!isNaN(nt) && nt > 0) initialFwIds.push(nt);
          }
        });
      } else if (gcHsIsConfigurationTarget()) {
        if (row.configuration_id != null && String(row.configuration_id).trim() !== "") {
          let oneCfg = parseInt(String(row.configuration_id), 10);
          if (!isNaN(oneCfg) && oneCfg > 0) initialFwIds = [oneCfg];
        }
      } else if (row.firewall_id != null && String(row.firewall_id).trim() !== "") {
        let oneInit = parseInt(String(row.firewall_id), 10);
        if (!isNaN(oneInit) && oneInit > 0) initialFwIds = [oneInit];
      }
    }
    let assignedForPicker = pickerMode === "edit" ? initialFwIds.slice() : [];
    let fwPickerHtml = buildFirewallPickerSection(pickerMode, initialFwIds, assignedForPicker);
    let hgFwIds = initialFwIds.slice();

    let nameDescRo = ro || !flyoutEditable;
    return (
      '<div class="gc-hs-ip-host-flyout">' +
      fwPickerHtml +
      hiddenType +
      '<div class="gc-if-flyout__field">' +
      '<label class="gc-if-flyout__label" for="gc-hs-ip-name">' +
      escapeHtml(String(nameCfg.label || "Name")) +
      ' <span class="gc-if-flyout__req" aria-hidden="true">*</span></label>' +
      textInput(
        name,
        String(nameCfg.placeholder || "Enter hostname"),
        "",
        "gc-hs-ip-name",
        nameDescRo,
        { maxlength: nameCfg.maxLength || null },
      ) +
      "</div>" +
      '<div class="gc-if-flyout__field" data-gc-combine-field-keys="Description">' +
      '<label class="gc-if-flyout__label" for="gc-hs-ip-desc">' +
      escapeHtml(String(descCfg.label || "Description")) +
      "</label>" +
      textareaInput(
        desc,
        "Enter description",
        descCfg.rows || 3,
        "gc-hs-ip-desc",
        nameDescRo,
        { maxlength: descCfg.maxLength || null },
      ) +
      "</div>" +
      ipVersionHtml +
      typeHtml +
      '<div id="gc-hs-ip-address-slot" class="gc-hs-ip-host-flyout__address-slot">' +
      addressInner +
      "</div>" +
      buildHostGroupSection(hgFwIds, ro, hostGroupsCfg.label) +
      "</div>"
    );
  }

  function collectIpHostForm(root) {
    let out = {};
    if (!root) return out;
    let nameEl = root.querySelector("#gc-hs-ip-name");
    let descEl = root.querySelector("#gc-hs-ip-desc");
    out.name = nameEl ? String(nameEl.value || "").trim() : "";
    out.description = descEl ? String(descEl.value || "") : "";
    let ver = root.querySelector('input[name="gc-hs-ipver"]:checked');
    out.ip_family = ver ? String(ver.value || "").trim() : "";
    let htRadio = root.querySelector('input[name="gc-hs-htype"]:checked');
    if (htRadio) {
      out.host_type_ui = String(htRadio.value || "").trim().toLowerCase();
    } else {
      let htHidden = root.querySelector("#gc-hs-htype-ui");
      out.host_type_ui = htHidden ? String(htHidden.value || "").trim().toLowerCase() : "";
    }
    let ui = out.host_type_ui || "";
    let hgNames = [];
    root.querySelectorAll('input[type="checkbox"][data-gc-hg-name]').forEach(function (cb) {
      if (cb.checked) {
        let nm = cb.dataset.gcHgName;
        if (nm) hgNames.push(nm);
      }
    });
    out.host_groups = hgNames;
    if (ui === "ip") {
      let ip = root.querySelector("#gc-hs-ip-addr-single");
      out.ip_address = ip ? String(ip.value || "").trim() : "";
    } else if (ui === "network") {
      let ipn = root.querySelector("#gc-hs-ip-net-addr");
      let sn = root.querySelector("#gc-hs-ip-subnet");
      out.ip_address = ipn ? String(ipn.value || "").trim() : "";
      out.subnet = sn ? String(sn.value || "").trim() : "";
    } else if (ui === "iprange") {
      let rs = root.querySelector("#gc-hs-ip-range-start");
      let re = root.querySelector("#gc-hs-ip-range-end");
      out.start_ip = rs ? String(rs.value || "").trim() : "";
      out.end_ip = re ? String(re.value || "").trim() : "";
    } else if (ui === "iplist") {
      let tl = root.querySelector("#gc-hs-ip-list");
      out.ip_list = tl ? String(tl.value || "") : "";
    }
    return out;
  }

  function collectFlyoutFirewallIdsOrdered() {
    let out = [];
    if (!fieldsRoot) return out;
    let ms = fieldsRoot.querySelector(gcHsFlyoutMsSelector());
    if (!ms) return out;
    let idA = gcHsFlyoutIdAttr();
    ms.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      if (!cb.checked) return;
      if (!cb.hasAttribute(idA)) return;
      let n = parseInt(String(cb.getAttribute(idA) || ""), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function refreshHostGroupSectionForFlyoutFirewallIds() {
    if (!fieldsRoot || !flyout) return;
    if (flyout.dataset.gcHsFlyoutKind !== "ip-host") return;
    let msHg = fieldsRoot.querySelector("[data-gc-hg-ms]");
    if (!msHg) return;
    let field = msHg.closest(".gc-if-flyout__field");
    if (!field || !field.parentNode) return;
    let ids = collectFlyoutFirewallIdsOrdered();
    let readOnlyHg = false;
    if (flyout.dataset.gcHsIpHostMode === "edit" && currentHsRow) {
      let f0 = currentHsRow.flat && typeof currentHsRow.flat === "object" ? currentHsRow.flat : {};
      readOnlyHg =
        !!currentHsRow.system_host || hostTypeUiKind(pick(f0, ["HostType"])) === "system";
    }
    let ipSch = getEntitySchema("ip_host");
    let hgLabel =
      ipSch && ipSch.fields && ipSch.fields.hostGroups && ipSch.fields.hostGroups.label
        ? ipSch.fields.hostGroups.label
        : null;
    let wrap = document.createElement("div");
    wrap.innerHTML = buildHostGroupSection(ids, readOnlyHg, hgLabel);
    let replacement = wrap.firstElementChild;
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

  function firewallNavItemFromInventoryRow(fw) {
    if (!fw || fw.id == null) return null;
    let fid = parseInt(String(fw.id), 10);
    if (isNaN(fid) || fid <= 0) return null;
    let lbl = String(fw.label != null ? fw.label : "").trim() || String(fid);
    let tags = [];
    if (Array.isArray(fw.tags)) {
      fw.tags.forEach(function (t) {
        if (typeof t === "string" && t.trim()) tags.push(t.trim());
      });
    }
    let name = fw.name != null ? String(fw.name).trim() : "";
    let host = fw.host != null ? String(fw.host).trim() : "";
    let deviceHostname = fw.device_hostname != null ? String(fw.device_hostname).trim() : "";
    let serial = fw.serial_number != null ? String(fw.serial_number).trim() : "";
    return {
      id: fid,
      label: lbl,
      tags: tags,
      name: name || null,
      host: host || null,
      device_hostname: deviceHostname || null,
      serial_number: serial || null,
    };
  }

  function firewallNavItemSearchHaystack(it) {
    let parts = [String(it.id), it.label];
    if (it.name) parts.push(it.name);
    if (it.host) parts.push(it.host);
    if (it.device_hostname) parts.push(it.device_hostname);
    if (it.serial_number) parts.push(it.serial_number);
    (it.tags || []).forEach(function (t) {
      if (t) parts.push(String(t));
    });
    return norm(parts.join(" "));
  }

  function hydrateIpHostFirewallMs(root, ctx) {
    let ms = null;
    if (gcHsIsConfigurationTarget()) {
      ms = root.querySelector('[data-gc-cfg-ms][data-fw-inventory-scope="global-selected"]');
      if (!ms) ms = root.querySelector("[data-gc-cfg-ms]");
    } else {
      /* Prefer scoped picker so a broad root (e.g. flyout stack containing the top bar) does not
       * match #gc-net-fw-multiselect's [data-gc-fw-ms] first — that node has no global-selected
       * attribute and would incorrectly list every firewall. */
      ms = root.querySelector('[data-gc-fw-ms][data-fw-inventory-scope="global-selected"]');
      if (!ms) ms = root.querySelector("[data-gc-fw-ms]");
    }
    if (!ms) return;
    let idA = gcHsFlyoutIdAttr();
    ctx = ctx || {};
    let row = ctx.row || currentHsRow || {};
    let mode = ms.dataset.fwPickerMode || "add";
    let scopeRaw = (ms.getAttribute("data-fw-inventory-scope") || "").trim().toLowerCase();
    let useGlobalInventoryScope = scopeRaw === "global-selected" && !gcHsIsConfigurationTarget();
    let trigger = ms.querySelector(".gc-hs-ip-host-flyout__fw-trigger");
    let triggerText = ms.querySelector(".gc-hs-ip-host-flyout__fw-trigger-text");
    let dropdown = ms.querySelector(".gc-hs-ip-host-flyout__fw-dropdown");
    let search = ms.querySelector(".gc-hs-ip-host-flyout__fw-search");
    let optsRoot = ms.querySelector(".gc-hs-ip-host-flyout__fw-ms-options");
    let emptyEl = ms.querySelector(".gc-hs-ip-host-flyout__fw-empty");
    let initialSet = {};
    try {
      let rawInit = ms.dataset.fwInitialSelected;
      if (rawInit) {
        let arr = JSON.parse(rawInit);
        if (Array.isArray(arr)) {
          arr.forEach(function (x) {
            let n = parseInt(String(x), 10);
            if (!isNaN(n) && n > 0) initialSet[String(n)] = true;
          });
        }
      }
    } catch (eInit) {}

    let assignedSet = {};
    try {
      let rawA = ms.dataset.fwAssignedIds;
      if (rawA) {
        let arrA = JSON.parse(rawA);
        if (Array.isArray(arrA)) {
          arrA.forEach(function (x) {
            let na = parseInt(String(x), 10);
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
      let n = 0;
      ms.querySelectorAll("input[type=\"checkbox\"]").forEach(function (cb) {
        if (!cb.hasAttribute(idA) || !cb.checked) return;
        n++;
      });
      return n;
    }

    function syncTriggerDisplay() {
      let chipsFn =
        typeof globalThis.gcRenderMultiselectTriggerChips === "function"
          ? globalThis.gcRenderMultiselectTriggerChips
          : null;
      let chipsEl = ms.querySelector(".gc-hs-ip-host-flyout__fw-trigger-chips");
      let n = countFwChecked();
      if (n === 0) {
        if (triggerText) {
          triggerText.textContent = fwSelectionSummary(0);
          triggerText.classList.remove("gc-ms-trigger-sr");
        }
        if (chipsEl) chipsEl.innerHTML = "";
        return;
      }
      if (triggerText) {
        triggerText.textContent = fwSelectionSummary(n);
        triggerText.classList.add("gc-ms-trigger-sr");
      }
      if (!chipsEl || !chipsFn) {
        if (triggerText) triggerText.classList.remove("gc-ms-trigger-sr");
        return;
      }
      let items = [];
      ms.querySelectorAll("input[type=\"checkbox\"]").forEach(function (cb) {
        if (!cb.hasAttribute(idA) || !cb.checked) return;
        let lid = String(cb.getAttribute(idA) || "");
        let lab = String(cb.dataset.gcFwLabel || lid).trim() || lid;
        items.push({
          label: lab,
          title: lab,
          removeLabel: "Remove " + lab,
          onRemove: function () {
            cb.checked = false;
            onFwCheckboxChange();
          },
        });
      });
      items.sort(function (a, b) {
        return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
      });
      chipsFn(chipsEl, items);
    }

    function onFwCheckboxChange() {
      syncTriggerDisplay();
      refreshHostGroupSectionForFlyoutFirewallIds();
      if (typeof globalThis.gcHsOnFlyoutFirewallSelectionChange === "function") {
        try {
          globalThis.gcHsOnFlyoutFirewallSelectionChange(fieldsRoot);
        } catch (eFwHook) {}
      }
      /* Chip remove sets .checked without a native change event — keep object-edit delete UI in sync. */
      if (typeof globalThis.gcDesignerSyncObjectEditFlyoutDeleteChrome === "function") {
        try {
          globalThis.gcDesignerSyncObjectEditFlyoutDeleteChrome();
        } catch (eObjEditDel) {}
      }
    }

    function renderFwOptions(items) {
      if (!optsRoot) return;
      optsRoot.innerHTML = "";
      let selectAllWrap = document.createElement("div");
      selectAllWrap.className = "gc-hs-ip-host-flyout__fw-select-all-wrap";
      let selectAllBtn = document.createElement("button");
      selectAllBtn.type = "button";
      selectAllBtn.className = "btn btn--text gc-hs-ip-host-flyout__fw-select-all";
      selectAllBtn.textContent = "Select all shown";
      selectAllBtn.setAttribute("aria-label", "Select all firewalls currently visible in this list");
      selectAllBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        optsRoot.querySelectorAll(".gc-hs-ip-host-flyout__fw-option").forEach(function (lab) {
          if (lab.style.display === "none") return;
          let cb0 = lab.querySelector("input[type=\"checkbox\"]");
          if (cb0 && !cb0.disabled) cb0.checked = true;
        });
        onFwCheckboxChange();
      });
      selectAllWrap.appendChild(selectAllBtn);
      optsRoot.appendChild(selectAllWrap);
      selectAllWrap.hidden = !items || items.length === 0;
      (items || []).forEach(function (it) {
        let id = it.id;
        let label = String(it.label != null ? it.label : "").trim() || String(id);
        let lab = document.createElement("label");
        lab.className = "gc-multiselect__option gc-hs-ip-host-flyout__fw-option";
        let cb = document.createElement("input");
        cb.type = "checkbox";
        cb.setAttribute(idA, String(id));
        cb.setAttribute("data-gc-fw-label", label);
        cb.setAttribute("data-gc-fw-search-haystack", firewallNavItemSearchHaystack(it));
        cb.checked = !!initialSet[String(id)];
        cb.addEventListener("change", onFwCheckboxChange);
        let textWrap = document.createElement("span");
        textWrap.className = "gc-hs-ip-host-flyout__hg-opt-text";
        let nameEl = document.createElement("span");
        nameEl.className = "gc-hs-ip-host-flyout__hg-opt-name mono";
        nameEl.textContent = label;
        textWrap.appendChild(nameEl);
        if (mode === "edit" && !assignedSet[String(id)]) {
          let nu = document.createElement("span");
          nu.className = "gc-hs-ip-host-flyout__fw-opt-new muted";
          nu.textContent = " · add on save";
          textWrap.appendChild(nu);
        }
        lab.appendChild(cb);
        lab.appendChild(textWrap);
        optsRoot.appendChild(lab);
      });
      if (emptyEl) {
        let showEmpty = !items || items.length === 0;
        emptyEl.hidden = !showEmpty;
        if (showEmpty) {
          if (useGlobalInventoryScope) {
            emptyEl.textContent = gcHsIsConfigurationTarget()
              ? "No configurations in the current top-bar scope."
              : "No firewalls in the current top-bar scope. Select firewalls or tags in the bar above.";
          } else {
            emptyEl.textContent = gcHsIsConfigurationTarget()
              ? "No configurations registered."
              : "No firewalls registered.";
          }
        }
      }
      syncTriggerDisplay();
    }

    function runFwFilter() {
      let q = norm(search ? search.value : "");
      ms.querySelectorAll(".gc-hs-ip-host-flyout__fw-option").forEach(function (lab) {
        let cb = lab.querySelector("input[type=\"checkbox\"]");
        if (!cb || !cb.hasAttribute(idA)) return;
        let hay = norm(cb.getAttribute("data-gc-fw-search-haystack") || "");
        let match = !q || hay.indexOf(q) !== -1;
        lab.style.display = match ? "" : "none";
      });
    }

    if (trigger && dropdown) {
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        let next = dropdown.hidden;
        let closeScope = root || fieldsRoot;
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

    let inv = gcHsNavInventoryArray();
    let byId = {};
    inv.forEach(function (fw) {
      let it0 = firewallNavItemFromInventoryRow(fw);
      if (it0) byId[String(it0.id)] = fw;
    });
    let navItems = [];
    if (useGlobalInventoryScope) {
      let ord = topBarSelectedFirewallIdsOrdered();
      ord.forEach(function (fid) {
        let fw = byId[String(fid)];
        let it1 = firewallNavItemFromInventoryRow(fw);
        if (it1) navItems.push(it1);
      });
    } else {
      inv.forEach(function (fw) {
        let it2 = firewallNavItemFromInventoryRow(fw);
        if (it2) navItems.push(it2);
      });
      navItems.sort(function (a, b) {
        return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
      });
    }
    renderFwOptions(navItems);
    runFwFilter();
    setOpen(false);

    var objEditModal = root && root.closest ? root.closest("#gc-designer-flyout-object-edit-modal") : null;
    if (objEditModal && objEditModal.getAttribute("data-gc-obj-edit-fw-outside-close") !== "1") {
      objEditModal.setAttribute("data-gc-obj-edit-fw-outside-close", "1");
      objEditModal.addEventListener("click", function (e) {
        if (objEditModal.hidden) return;
        var t = e.target;
        if (t && t.closest && (t.closest("[data-gc-fw-ms]") || t.closest("[data-gc-cfg-ms]"))) return;
        objEditModal.querySelectorAll(".gc-hs-ip-host-flyout__fw-dropdown").forEach(function (d) {
          d.hidden = true;
        });
        objEditModal.querySelectorAll(".gc-hs-ip-host-flyout__fw-trigger").forEach(function (trg) {
          trg.setAttribute("aria-expanded", "false");
        });
      });
    }
  }

  function hydrateIpHostHostGroupMs(root, row) {
    let ms = root.querySelector("[data-gc-hg-ms]");
    if (!ms) return;
    let readOnly = ms.dataset.hgReadonly === "1";
    let flat = row.flat && typeof row.flat === "object" ? row.flat : {};
    let selected = hostGroupLabels(flat);
    let firewallIds = [];
    try {
      firewallIds = JSON.parse(ms.dataset.firewallIds || "[]");
      if (!Array.isArray(firewallIds)) firewallIds = [];
    } catch (e0) {
      firewallIds = [];
    }
    let urlBase = typeof globalThis.gcHsIpHostgroupNamesUrl === "string" ? globalThis.gcHsIpHostgroupNamesUrl : "";
    let aggUrl =
      typeof globalThis.gcHsIpHostgroupAggregateUrl === "string" ? globalThis.gcHsIpHostgroupAggregateUrl : "";
    let trigger = ms.querySelector(".gc-hs-ip-host-flyout__hg-trigger");
    let triggerText = ms.querySelector(".gc-hs-ip-host-flyout__hg-trigger-text");
    let dropdown = ms.querySelector(".gc-hs-ip-host-flyout__hg-dropdown");
    let search = ms.querySelector(".gc-hs-ip-host-flyout__hg-search");
    let optsRoot = ms.querySelector(".gc-hs-ip-host-flyout__hg-ms-options");
    let emptyEl = ms.querySelector(".gc-hs-ip-host-flyout__hg-empty");
    function setOpen(open) {
      if (!dropdown) return;
      dropdown.hidden = !open;
      if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function countChecked() {
      let n = 0;
      ms.querySelectorAll('input[type="checkbox"][data-gc-hg-name]').forEach(function (cb) {
        if (cb.checked) n++;
      });
      return n;
    }

    function syncTriggerDisplay() {
      let chipsFn =
        typeof globalThis.gcRenderMultiselectTriggerChips === "function"
          ? globalThis.gcRenderMultiselectTriggerChips
          : null;
      let chipsEl = ms.querySelector(".gc-hs-ip-host-flyout__hg-trigger-chips");
      let n = countChecked();
      if (n === 0) {
        if (triggerText) {
          triggerText.textContent = hgSelectionSummary(0);
          triggerText.classList.remove("gc-ms-trigger-sr");
        }
        if (chipsEl) chipsEl.innerHTML = "";
        return;
      }
      if (triggerText) {
        triggerText.textContent = hgSelectionSummary(n);
        triggerText.classList.add("gc-ms-trigger-sr");
      }
      if (!chipsEl || !chipsFn) {
        if (triggerText) triggerText.classList.remove("gc-ms-trigger-sr");
        return;
      }
      let items = [];
      ms.querySelectorAll('input[type="checkbox"][data-gc-hg-name]').forEach(function (cb) {
        if (!cb.checked) return;
        let nm = String(cb.dataset.gcHgName || "").trim();
        if (!nm) return;
        items.push({
          label: nm,
          title: nm,
          removeLabel: "Remove group " + nm,
          onRemove: function () {
            cb.checked = false;
            onHgCheckboxChange();
          },
        });
      });
      items.sort(function (a, b) {
        return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
      });
      chipsFn(chipsEl, items);
    }

    function onHgCheckboxChange() {
      syncTriggerDisplay();
    }

    function renderHostGroups(groups) {
      if (!optsRoot) return;
      optsRoot.innerHTML = "";
      let selectedSet = {};
      selected.forEach(function (s) {
        selectedSet[s] = true;
      });
      (groups || []).forEach(function (g) {
        let name = String(g && g.name != null ? g.name : "").trim();
        if (!name) return;
        let desc = String(g && g.description != null ? g.description : "").trim();
        let lab = document.createElement("label");
        lab.className = "gc-multiselect__option gc-hs-ip-host-flyout__hg-option";
        let cb = document.createElement("input");
        cb.type = "checkbox";
        cb.setAttribute("data-gc-hg-name", name);
        cb.checked = !!selectedSet[name];
        if (readOnly) cb.disabled = true;
        cb.addEventListener("change", onHgCheckboxChange);
        let textWrap = document.createElement("span");
        textWrap.className = "gc-hs-ip-host-flyout__hg-opt-text";
        let nameEl = document.createElement("span");
        nameEl.className = "gc-hs-ip-host-flyout__hg-opt-name mono";
        nameEl.textContent = name;
        textWrap.appendChild(nameEl);
        if (desc) {
          let sep = document.createElement("span");
          sep.className = "gc-hs-ip-host-flyout__hg-opt-sep muted";
          sep.textContent = " · ";
          textWrap.appendChild(sep);
          let descEl = document.createElement("span");
          descEl.className = "gc-hs-ip-host-flyout__hg-opt-desc muted";
          descEl.textContent = desc;
          textWrap.appendChild(descEl);
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
        let showEmpty = !groups || groups.length === 0;
        emptyEl.hidden = !showEmpty;
        if (showEmpty) {
          let multiFw = ms.dataset.firewallIds;
          let nFw = 0;
          try {
            let parsed = JSON.parse(multiFw || "[]");
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
      syncTriggerDisplay();
    }

    function runFilter() {
      let q = norm(search ? search.value : "");
      ms.querySelectorAll(".gc-hs-ip-host-flyout__hg-option").forEach(function (lab) {
        let cb = lab.querySelector("[data-gc-hg-name]");
        let nm = cb ? norm(cb.dataset.gcHgName || "") : "";
        let descEl = lab.querySelector(".gc-hs-ip-host-flyout__hg-opt-desc");
        let dsc = descEl ? norm(descEl.textContent || "") : "";
        let match = !q || nm.indexOf(q) !== -1 || dsc.indexOf(q) !== -1;
        lab.style.display = match ? "" : "none";
      });
    }

    if (trigger && dropdown) {
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        let next = dropdown.hidden;
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
      let merged = mergeSortedUniqueHostGroups(raw, selected);
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
          let raw = x.j && x.j.groups;
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
    let join = urlBase.indexOf("?") >= 0 ? "&" : "?";
    let qk = gcHsIsConfigurationTarget() ? "configuration_id" : "firewall_id";
    let u = urlBase + join + qk + "=" + encodeURIComponent(String(firewallIds[0]));
    fetch(u, { credentials: "same-origin" })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (x) {
        let raw = x.j && x.j.groups;
        if (!x.ok || !Array.isArray(raw)) {
          if (triggerText) triggerText.textContent = "Could not load groups";
          return;
        }
        let merged = mergeSortedUniqueHostGroups(raw, selected);
        renderHostGroups(merged);
        runFilter();
      })
      .catch(function () {
        if (triggerText) triggerText.textContent = "Could not load groups";
      });
  }

  function buildGenericFieldsHtml(row) {
    let flat = row.flat && typeof row.flat === "object" ? row.flat : {};
    let keys = Object.keys(flat).sort();
    if (keys.length === 0) {
      return "<p class=\"muted\">No flattened fields in this payload.</p>";
    }
    return keys
      .map(function (k) {
        let v = flat[k] != null ? String(flat[k]) : "";
        let multiline = v.indexOf("\n") >= 0 || v.length > 120;
        let inputHtml = multiline
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
    let p = root.querySelector(".gc-if-flyout__panel");
    let handle = root.querySelector(".gc-if-flyout__resize");
    if (!p || !handle || handle.dataset.gcHsResizeBound === "1") return;
    handle.dataset.gcHsResizeBound = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      let startX = e.clientX;
      let startW = p.getBoundingClientRect().width;
      let maxW = Math.min(720, globalThis.innerWidth - 24);
      function onMove(e2) {
        let w = startW + (startX - e2.clientX);
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
    let getter = gcHsIsConfigurationTarget()
      ? typeof globalThis.gcGetEffectiveConfigurationIds === "function"
        ? globalThis.gcGetEffectiveConfigurationIds
        : globalThis.gcGetSelectedConfigurationIds
      : globalThis.gcGetSelectedFirewallIds;
    if (typeof getter === "function") {
      let eff = getter();
      if (!Array.isArray(eff)) eff = [];
      /* When the getter exists but returns [] (stale inventory, race), match Network tables:
       * re-read explicit firewall checkboxes from the top-bar root with f: value parsing. */
      if (!gcHsIsConfigurationTarget() && eff.length === 0) {
        let navRoot = document.getElementById("gc-net-fw-multiselect");
        if (navRoot) {
          let fb = [];
          navRoot.querySelectorAll(".gc-net-fw-cb--fw:checked").forEach(function (cb) {
            let raw = String(cb.value || "");
            let n =
              raw.indexOf("f:") === 0 ? parseInt(raw.slice(2), 10) : parseInt(raw, 10);
            if (!isNaN(n) && n > 0) fb.push(n);
          });
          if (fb.length) eff = fb;
        }
      }
      let set = {};
      eff.forEach(function (id) {
        set[String(id)] = true;
      });
      let out = [];
      gcHsNavInventoryArray().forEach(function (fw) {
        if (fw && fw.id != null && set[String(fw.id)]) {
          let n = parseInt(String(fw.id), 10);
          if (!isNaN(n) && n > 0) out.push(n);
        }
      });
      return out;
    }
    let outLegacy = [];
    let sel = {};
    let navLegacy = document.getElementById("gc-net-fw-multiselect");
    if (navLegacy) {
      navLegacy.querySelectorAll(".gc-net-fw-cb--fw:checked").forEach(function (cb) {
        let raw = String(cb.value || "");
        let n =
          raw.indexOf("f:") === 0 ? parseInt(raw.slice(2), 10) : parseInt(raw, 10);
        if (!isNaN(n) && n > 0) sel[String(n)] = true;
      });
      let tagWant = {};
      navLegacy.querySelectorAll(".gc-net-fw-tag-cb:checked").forEach(function (cb) {
        let k = norm(cb.value || "");
        if (k) tagWant[k] = true;
      });
      if (Object.keys(tagWant).length) {
        gcHsNavInventoryArray().forEach(function (fw) {
          if (!fw || fw.id == null) return;
          let tags = fw.tags || [];
          for (let ti = 0; ti < tags.length; ti++) {
            if (tagWant[norm(tags[ti])]) {
              let nid = parseInt(String(fw.id), 10);
              if (!isNaN(nid) && nid > 0) sel[String(nid)] = true;
              break;
            }
          }
        });
      }
    }
    gcHsNavInventoryArray().forEach(function (fw) {
      if (sel[String(fw.id)]) {
        let n2 = parseInt(String(fw.id), 10);
        if (!isNaN(n2) && n2 > 0) outLegacy.push(n2);
      }
    });
    return outLegacy;
  }

  function collectEditConfigEntryIds() {
    let row = currentHsRow;
    if (!row) return [];
    let targets = row.hs_edit_targets;
    if (!Array.isArray(targets) || !targets.length) {
      targets = row.ip_host_edit_targets;
    }
    if (!Array.isArray(targets)) return [];
    let sel = {};
    collectFlyoutFirewallIdsOrdered().forEach(function (id) {
      sel[id] = true;
    });
    let out = [];
    targets.forEach(function (t) {
      if (!t || t.config_entry_id == null) return;
      let fid = gcHsTargetOwnerId(t);
      if (fid == null) return;
      if (!sel[fid]) return;
      let ce = parseInt(String(t.config_entry_id), 10);
      if (!isNaN(ce) && ce > 0) out.push(ce);
    });
    return out;
  }

  function collectEditCreateFirewallIds() {
    let row = currentHsRow;
    if (!row) return [];
    let existing = {};
    let targets = row.hs_edit_targets;
    if (!Array.isArray(targets) || !targets.length) {
      targets = row.ip_host_edit_targets;
    }
    (targets || []).forEach(function (t) {
      let oid = gcHsTargetOwnerId(t);
      if (oid != null) existing[oid] = true;
    });
    let out = [];
    collectFlyoutFirewallIdsOrdered().forEach(function (id) {
      if (!existing[id]) out.push(id);
    });
    return out;
  }

  function humanHsEntityTitle(entityKey) {
    let m = {
      fqdn_host: "FQDN host",
      service: "service",
      mac_host: "MAC host",
      ip_hostgroup: "IP host group",
      fqdn_hostgroup: "FQDN host group",
      service_group: "service group",
      country_group: "country group",
    };
    let k = String(entityKey || "").trim();
    return m[k] || k.replace(/_/g, " ");
  }

  function openFlyoutAddHsEntity(entityKey) {
    if (!flyout || typeof globalThis.gcHsBuildFlyoutFieldsHtml !== "function") return;
    let ek = String(entityKey || "").trim();
    if (ek === "ip_host") {
      openFlyoutAddIpHost();
      return;
    }
    let ids =
      typeof globalThis.gcHsTopBarFirewallIds === "function"
        ? globalThis.gcHsTopBarFirewallIds()
        : topBarSelectedFirewallIdsOrdered();
    let fwid = ids.length ? ids[0] : null;
    let ist = gcHsIsConfigurationTarget();
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
      fieldsRoot.innerHTML = globalThis.gcHsBuildFlyoutFieldsHtml(ek, currentHsRow, "add", {
        firewallIds: ids,
      });
      flyout.setAttribute("data-gc-hs-flyout-kind", "hs-entity");
      flyout.setAttribute("data-gc-hs-entity-mode", "add");
      flyout.removeAttribute("data-gc-hs-ip-host-mode");
      if (globalThis.gcHsHydrateFlyoutFirewallPicker) {
        globalThis.gcHsHydrateFlyoutFirewallPicker(fieldsRoot, { row: currentHsRow });
      }
      if (globalThis.gcHsHydrateHsEntityFields) {
        globalThis.gcHsHydrateHsEntityFields(fieldsRoot, ek, currentHsRow, "add");
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
    let ids = topBarSelectedFirewallIdsOrdered();
    let fwid = ids.length ? ids[0] : null;
    let ist2 = gcHsIsConfigurationTarget();
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

  let HS_MEMBER_TARGET_SLUG = {
    ip_host: "ip-host",
    fqdn_host: "fqdn-host",
    service: "service",
  };

  function hsMemberTargetTbodyId(targetEntityType) {
    let slug = HS_MEMBER_TARGET_SLUG[targetEntityType];
    if (!slug) return null;
    let base = gcHsIsConfigurationTarget() ? "gc-cfg-hs-" : "gc-hs-";
    return base + slug + "-tbody";
  }

  function hsScopedEntityRowOverlapsScope(entityRow, scopeSet) {
    if (!scopeSet) return false;
    let keys = Object.keys(scopeSet);
    if (!keys.length) return false;
    let targets = entityRow.hs_edit_targets || entityRow.ip_host_edit_targets;
    if (Array.isArray(targets) && targets.length) {
      for (let j = 0; j < targets.length; j++) {
        let oid = gcHsTargetOwnerId(targets[j]);
        if (oid != null && scopeSet[oid]) return true;
      }
      return false;
    }
    let sid = gcHsIsConfigurationTarget() ? entityRow.configuration_id : entityRow.firewall_id;
    let n = parseInt(String(sid), 10);
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
    let normMember = norm(String(memberName));
    if (!normMember) return;

    let scopeSet = {};
    let gt = hostGroupRow.hs_edit_targets;
    if (Array.isArray(gt)) {
      gt.forEach(function (t) {
        let oid = gcHsTargetOwnerId(t);
        if (oid != null) scopeSet[oid] = true;
      });
    }
    if (!Object.keys(scopeSet).length) return;

    let tbodyId = hsMemberTargetTbodyId(targetEntityType);
    if (!tbodyId) return;
    let tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    let nodeList = tbody.querySelectorAll("tr");
    let found = null;
    for (let i = 0; i < nodeList.length; i++) {
      let tr = nodeList[i];
      let entRow = tr._gcNetRow;
      if (!entRow || String(entRow.entity_type || "") !== targetEntityType) continue;
      let cells = entRow.cells || {};
      let nm =
        String(cells["__name"] != null ? cells["__name"] : "").trim() ||
        String(entRow.external_name || "").trim();
      if (norm(nm) !== normMember) continue;
      if (!hsScopedEntityRowOverlapsScope(entRow, scopeSet)) continue;
      found = tr;
      break;
    }

    if (typeof globalThis.gcTableListModalClose === "function") {
      globalThis.gcTableListModalClose();
    }

    if (!found) {
      let scopeWord = gcHsIsConfigurationTarget() ? "configurations" : "firewalls";
      let hint = tabHint || "the matching tab";
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
    let row = tr._gcNetRow;
    currentHsRow = row;
    if (saveBtn) saveBtn.disabled = false;
    let cells = row.cells || {};
    let name =
      String(cells["__name"] != null ? cells["__name"] : "").trim() ||
      String(row.external_name || "").trim() ||
      "—";
    let fw =
      String(cells.firewall != null ? cells.firewall : "").trim() ||
      String(cells["__firewalls"] != null ? cells["__firewalls"] : "").trim() ||
      "—";
    let et = String(row.entity_type || "").trim() || "entry";

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

    let isIpHost = et === "ip_host";
    let HS_ENTITY_TYPES = {
      fqdn_host: true,
      service: true,
      mac_host: true,
      ip_hostgroup: true,
      fqdn_hostgroup: true,
      service_group: true,
      country_group: true,
    };
    let isHsEntity = !!HS_ENTITY_TYPES[et] && typeof globalThis.gcHsBuildFlyoutFieldsHtml === "function";
    let flat0 = row.flat && typeof row.flat === "object" ? row.flat : {};
    let hostTypeForSave = pick(flat0, ["HostType"]);
    let sysByType = hostTypeUiKind(hostTypeForSave) === "system";
    let canEnqueueIpHost = isIpHost && !row.system_host && !sysByType;

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
        fieldsRoot.innerHTML = globalThis.gcHsBuildFlyoutFieldsHtml(et, row, "edit", {});
        flyout.setAttribute("data-gc-hs-flyout-kind", "hs-entity");
        flyout.setAttribute("data-gc-hs-entity-mode", "edit");
        flyout.removeAttribute("data-gc-hs-ip-host-mode");
        if (globalThis.gcHsHydrateFlyoutFirewallPicker) {
          globalThis.gcHsHydrateFlyoutFirewallPicker(fieldsRoot, { row: row });
        }
        if (globalThis.gcHsHydrateHsEntityFields) {
          globalThis.gcHsHydrateHsEntityFields(fieldsRoot, et, row, "edit");
        }
      } else {
        fieldsRoot.innerHTML = buildGenericFieldsHtml(row);
        flyout.setAttribute("data-gc-hs-flyout-kind", "generic");
        flyout.removeAttribute("data-gc-hs-entity-mode");
        flyout.removeAttribute("data-gc-hs-ip-host-mode");
      }
      if (typeof globalThis.gcCombineFlyoutApplyConflictChrome === "function") {
        globalThis.gcCombineFlyoutApplyConflictChrome(fieldsRoot, row, {});
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

    let panelForm = flyout.querySelector(".gc-if-flyout__panel-form");
    if (panelForm && panelForm.dataset.gcHsHgPanelClose !== "1") {
      panelForm.dataset.gcHsHgPanelClose = "1";
      panelForm.addEventListener("click", function (e) {
        let fk = flyout && flyout.dataset.gcHsFlyoutKind;
        if (!flyout || flyout.hidden || (fk !== "ip-host" && fk !== "hs-entity")) return;
        if (!fieldsRoot) return;
        if (
          e.target.closest("[data-gc-hg-ms]") ||
          e.target.closest("[data-gc-fw-ms]") ||
          e.target.closest("[data-gc-cfg-ms]")
        )
          return;
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
        let t = e.target;
        if (!t || t.name !== "gc-hs-htype") return;
        if (!flyout || flyout.dataset.gcHsIpHostMode !== "add") return;
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
        let fk = flyout.dataset.gcHsFlyoutKind;
        if (fk === "hs-entity") {
          let et = currentHsRow && String(currentHsRow.entity_type || "").trim();
          if (!et || typeof globalThis.gcHsCollectFlyoutEntityForm !== "function") {
            alert("Form is not available.");
            return;
          }
          let gForm = globalThis.gcHsCollectFlyoutEntityForm(fieldsRoot, et);
          if (!gForm || !String(gForm.name || "").trim()) {
            alert("Name is required.");
            return;
          }
          if (et === "fqdn_host" && !String(gForm.fqdn || "").trim()) {
            alert("FQDN is required.");
            return;
          }
          saveBtn.disabled = true;
          let em = flyout.dataset.gcHsEntityMode;
          let upUrl =
            typeof globalThis.gcHsEnqueueUpdatesBatchUrl === "string"
              ? globalThis.gcHsEnqueueUpdatesBatchUrl
              : "";
          let crUrl =
            typeof globalThis.gcHsEnqueueCreatesBatchUrl === "string"
              ? globalThis.gcHsEnqueueCreatesBatchUrl
              : "";

          function finishHsOk() {
            gcHsNotifySaveSuccess();
            closeFlyout();
          }

          if (em === "add") {
            let fwIdsA = collectFlyoutFirewallIdsOrdered();
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
                  let msg =
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

          let updateEntryIdsH = collectEditConfigEntryIds();
          let createFwIdsH = collectEditCreateFirewallIds();
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
                  let msgC =
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
                  let msg2 =
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

        let mode = flyout.dataset.gcHsIpHostMode;
        let form = collectIpHostForm(fieldsRoot);
        if (!form.name) {
          alert("Name is required.");
          return;
        }
        saveBtn.disabled = true;
        if (mode === "add") {
          let bUrl =
            typeof globalThis.gcHsIpHostEnqueueCreateBatchUrl === "string"
              ? globalThis.gcHsIpHostEnqueueCreateBatchUrl
              : "";
          let fwIds = collectFlyoutFirewallIdsOrdered();
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
                let msg =
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
        let updateEntryIds = collectEditConfigEntryIds();
        let createFwIds = collectEditCreateFirewallIds();
        if (!updateEntryIds.length && !createFwIds.length) {
          alert(gcHsIsConfigurationTarget() ? "Select at least one configuration." : "Select at least one firewall.");
          saveBtn.disabled = false;
          return;
        }
        let batchUpUrl =
          typeof globalThis.gcHsIpHostEnqueueUpdatesBatchUrl === "string"
            ? globalThis.gcHsIpHostEnqueueUpdatesBatchUrl
            : "";
        let createBatchUrl =
          typeof globalThis.gcHsIpHostEnqueueCreateBatchUrl === "string"
            ? globalThis.gcHsIpHostEnqueueCreateBatchUrl
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
                let msgC =
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
                let msg2 =
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

  globalThis.gcHsFlyoutInit = gcHsFlyoutInit;
  globalThis.gcHsFlyoutOpenFromTr = openFlyout;
  globalThis.gcHsFlyoutOpenIpHostFromGroupMember = gcHsFlyoutOpenIpHostFromGroupMember;
  globalThis.gcHsFlyoutOpenFqdnHostFromGroupMember = gcHsFlyoutOpenFqdnHostFromGroupMember;
  globalThis.gcHsFlyoutOpenServiceFromGroupMember = gcHsFlyoutOpenServiceFromGroupMember;
  globalThis.gcHsFlyoutOpenAddIpHost = openFlyoutAddIpHost;
  globalThis.gcHsFlyoutOpenAddForEntity = openFlyoutAddHsEntity;
  globalThis.gcHsHydrateFlyoutFirewallPicker = hydrateIpHostFirewallMs;
  /** Same ordered ids as the flyout firewall dropdown uses under `data-fw-inventory-scope="global-selected"`. */
  globalThis.gcHsTopBarFirewallIds = topBarSelectedFirewallIdsOrdered;
  globalThis.gcHsDispatchAfterDeleteBatch = gcHsNotifySaveSuccess;
})();
