/**
 * Routing flyout: Add / Edit forms for unicast_route, gateway, gateway_host.
 * Submits via the HS task queue (firewall scope) or the configuration-apply
 * endpoints (configuration scope).
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
    return typeof globalThis.gcRoutingEntityTarget === "string"
      && globalThis.gcRoutingEntityTarget === "configuration";
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

  function pickArray(flat, key) {
    if (!flat) return [];
    let v = flat[key];
    if (Array.isArray(v)) return v.map(String);
    if (v == null || v === "") return [];
    return [String(v)];
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

  function selectInput(id, val, options) {
    let opts = options.map(function (o) {
      let v = typeof o === "string" ? o : o.value;
      let lab = typeof o === "string" ? o : (o.label || o.value);
      return '<option value="' + escapeHtml(v) + '"' + (String(val) === String(v) ? " selected" : "") + ">" + escapeHtml(lab) + "</option>";
    }).join("");
    return '<select id="' + id + '" class="gc-if-flyout__input">' + opts + "</select>";
  }

  function textInput(id, val, opts) {
    opts = opts || {};
    let attrs = "";
    if (opts.placeholder) attrs += ' placeholder="' + escapeHtml(opts.placeholder) + '"';
    if (opts.mono) attrs += ' class="gc-if-flyout__input mono"';
    else attrs += ' class="gc-if-flyout__input"';
    if (opts.disabled) attrs += " disabled";
    return '<input id="' + id + '" type="text" value="' + escapeHtml(val == null ? "" : val) + '"' + attrs + " />";
  }

  function fieldRow(label, html, opts) {
    opts = opts || {};
    let req = opts.required ? ' <span class="gc-if-flyout__req">*</span>' : "";
    let hint = opts.hint ? '<p class="muted" style="margin-top:4px">' + escapeHtml(opts.hint) + "</p>" : "";
    return '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label">' + escapeHtml(label) + req + "</label>" + html + hint + "</div>";
  }

  function buildUnicastRouteForm(row) {
    let f = (row && row.flat) || {};
    let dest = pick(f, ["DestinationIP", "Destination_IP", "Destination"]);
    let mask = pick(f, ["Netmask", "NetMask", "Mask"]);
    let gw = pick(f, ["Gateway", "GatewayIP"]);
    let iface = pick(f, ["Interface", "Distance"]);
    let dist = pick(f, ["Distance", "AdminDistance"]);
    let nameEditable = currentMode === "add";
    let html = "";
    html += fieldRow("Destination IP", textInput("gc-rt-ur-dest", dest, { mono: true, disabled: !nameEditable, placeholder: "10.0.0.0" }), { required: true });
    html += fieldRow("Netmask", textInput("gc-rt-ur-mask", mask, { mono: true, placeholder: "255.255.255.0" }), { required: true });
    html += fieldRow("Gateway", textInput("gc-rt-ur-gw", gw, { mono: true, placeholder: "10.0.0.1" }), { required: true });
    html += fieldRow("Interface", textInput("gc-rt-ur-iface", iface, { mono: true }), { hint: "Interface name (e.g. PortB)" });
    html += fieldRow("Distance", textInput("gc-rt-ur-dist", dist, { placeholder: "0" }));
    return html;
  }

  function collectUnicastRouteForm() {
    return {
      name: (document.getElementById("gc-rt-ur-dest") || {}).value || "",
      DestinationIP: (document.getElementById("gc-rt-ur-dest") || {}).value || "",
      Netmask: (document.getElementById("gc-rt-ur-mask") || {}).value || "",
      Gateway: (document.getElementById("gc-rt-ur-gw") || {}).value || "",
      Interface: (document.getElementById("gc-rt-ur-iface") || {}).value || "",
      Distance: (document.getElementById("gc-rt-ur-dist") || {}).value || "",
    };
  }

  function buildFailoverRow(idx, row) {
    row = row || {};
    return '<div class="gc-rt-failover-row" data-idx="' + idx + '" style="border:1px solid var(--surface-3);padding:8px;margin-bottom:8px;border-radius:4px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<div>' + fieldRow("Type", selectInput("gc-rt-gw-fo-type-" + idx, row.Type || "Ping", [
        "Ping", "TCP", "UDP", "DNS", "HTTP", "HTTPS"
      ])) + '</div>' +
      '<div>' + fieldRow("Host", textInput("gc-rt-gw-fo-host-" + idx, row.Host || "", { mono: true })) + '</div>' +
      '<div>' + fieldRow("Port", textInput("gc-rt-gw-fo-port-" + idx, row.Port || "")) + '</div>' +
      '<div>' + fieldRow("Interval (s)", textInput("gc-rt-gw-fo-int-" + idx, row.Interval || "60")) + '</div>' +
      '</div>' +
      '<button type="button" class="btn btn--secondary" data-gc-rt-fo-remove="' + idx + '" style="margin-top:6px">Remove rule</button>' +
      '</div>';
  }

  function buildGatewayForm(row) {
    let f = (row && row.flat) || {};
    let nm = pick(f, ["Name"]);
    let ip = pick(f, ["IPAddress", "IP", "GatewayIP"]);
    let zone = pick(f, ["Zone"]);
    let weight = pick(f, ["Weight"]);
    let timeout = pick(f, ["Timeout", "FailoverTimeout"]);
    let nameEditable = currentMode === "add";
    let html = "";
    html += fieldRow("Name", textInput("gc-rt-gw-name", nm, { mono: true, disabled: !nameEditable }), { required: true });
    html += fieldRow("IP address", textInput("gc-rt-gw-ip", ip, { mono: true }), { required: true });
    html += fieldRow("Zone", textInput("gc-rt-gw-zone", zone, { mono: true }));
    html += fieldRow("Weight", textInput("gc-rt-gw-weight", weight));
    html += fieldRow("Failover timeout (s)", textInput("gc-rt-gw-timeout", timeout, { placeholder: "60" }));

    let foRows = [];
    let raw = (f.FailOverRules && f.FailOverRules.FailOverRule) || (f.FailOverRules) || [];
    if (!Array.isArray(raw)) raw = [raw];
    raw.forEach(function (r) {
      if (r && typeof r === "object") {
        foRows.push({
          Type: r.Type || r["@Type"] || "Ping",
          Host: r.Host || "",
          Port: r.Port || "",
          Interval: r.Interval || "",
        });
      }
    });
    let foHtml = '<div id="gc-rt-gw-fo-rows">';
    foRows.forEach(function (r, i) { foHtml += buildFailoverRow(i, r); });
    foHtml += '</div><button type="button" id="gc-rt-gw-fo-add" class="btn btn--secondary">Add failover rule</button>';
    html += '<fieldset class="gc-if-flyout__fieldset"><legend>Failover rules</legend>' + foHtml + "</fieldset>";
    return html;
  }

  function collectGatewayForm() {
    let foEls = document.querySelectorAll("#gc-rt-gw-fo-rows .gc-rt-failover-row");
    let foRows = [];
    foEls.forEach(function (el) {
      let i = el.dataset.idx;
      let typeEl = document.getElementById("gc-rt-gw-fo-type-" + i);
      let hostEl = document.getElementById("gc-rt-gw-fo-host-" + i);
      let portEl = document.getElementById("gc-rt-gw-fo-port-" + i);
      let intEl = document.getElementById("gc-rt-gw-fo-int-" + i);
      if (typeEl || hostEl) {
        foRows.push({
          Type: (typeEl || {}).value || "",
          Host: (hostEl || {}).value || "",
          Port: (portEl || {}).value || "",
          Interval: (intEl || {}).value || "",
        });
      }
    });
    return {
      name: (document.getElementById("gc-rt-gw-name") || {}).value || "",
      Name: (document.getElementById("gc-rt-gw-name") || {}).value || "",
      IPAddress: (document.getElementById("gc-rt-gw-ip") || {}).value || "",
      Zone: (document.getElementById("gc-rt-gw-zone") || {}).value || "",
      Weight: (document.getElementById("gc-rt-gw-weight") || {}).value || "",
      Timeout: (document.getElementById("gc-rt-gw-timeout") || {}).value || "",
      FailOverRules: foRows,
    };
  }

  function buildMonitorRow(idx, row) {
    row = row || {};
    return '<div class="gc-rt-mon-row" data-idx="' + idx + '" style="border:1px solid var(--surface-3);padding:8px;margin-bottom:8px;border-radius:4px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<div>' + fieldRow("Type", selectInput("gc-rt-gh-mc-type-" + idx, row.Type || "Ping", [
        "Ping", "TCP", "UDP", "DNS", "HTTP", "HTTPS"
      ])) + '</div>' +
      '<div>' + fieldRow("Host", textInput("gc-rt-gh-mc-host-" + idx, row.Host || "", { mono: true })) + '</div>' +
      '<div>' + fieldRow("Port", textInput("gc-rt-gh-mc-port-" + idx, row.Port || "")) + '</div>' +
      '<div>' + fieldRow("Interval (s)", textInput("gc-rt-gh-mc-int-" + idx, row.Interval || "")) + '</div>' +
      '</div>' +
      '<button type="button" class="btn btn--secondary" data-gc-rt-mc-remove="' + idx + '" style="margin-top:6px">Remove condition</button>' +
      '</div>';
  }

  function buildGatewayHostForm(row) {
    let f = (row && row.flat) || {};
    let nm = pick(f, ["Name"]);
    let zone = pick(f, ["Zone"]);
    let ip = pick(f, ["IPAddress", "IP"]);
    let nameEditable = currentMode === "add";
    let html = "";
    html += fieldRow("Name", textInput("gc-rt-gh-name", nm, { mono: true, disabled: !nameEditable }), { required: true });
    html += fieldRow("Zone", textInput("gc-rt-gh-zone", zone, { mono: true }), { required: true });
    html += fieldRow("IP address", textInput("gc-rt-gh-ip", ip, { mono: true }), { required: true });

    let mcRows = [];
    let raw = (f.MonitoringCondition && f.MonitoringCondition.Condition) || (f.MonitoringCondition) || [];
    if (!Array.isArray(raw)) raw = [raw];
    raw.forEach(function (r) {
      if (r && typeof r === "object") {
        mcRows.push({
          Type: r.Type || r["@Type"] || "Ping",
          Host: r.Host || "",
          Port: r.Port || "",
          Interval: r.Interval || "",
        });
      }
    });
    let mcHtml = '<div id="gc-rt-gh-mc-rows">';
    mcRows.forEach(function (r, i) { mcHtml += buildMonitorRow(i, r); });
    mcHtml += '</div><button type="button" id="gc-rt-gh-mc-add" class="btn btn--secondary">Add monitoring condition</button>';
    html += '<fieldset class="gc-if-flyout__fieldset"><legend>Monitoring conditions</legend>' + mcHtml + "</fieldset>";
    return html;
  }

  function collectGatewayHostForm() {
    let mcEls = document.querySelectorAll("#gc-rt-gh-mc-rows .gc-rt-mon-row");
    let mcRows = [];
    mcEls.forEach(function (el) {
      let i = el.dataset.idx;
      let typeEl = document.getElementById("gc-rt-gh-mc-type-" + i);
      let hostEl = document.getElementById("gc-rt-gh-mc-host-" + i);
      let portEl = document.getElementById("gc-rt-gh-mc-port-" + i);
      let intEl = document.getElementById("gc-rt-gh-mc-int-" + i);
      if (typeEl || hostEl) {
        mcRows.push({
          Type: (typeEl || {}).value || "",
          Host: (hostEl || {}).value || "",
          Port: (portEl || {}).value || "",
          Interval: (intEl || {}).value || "",
        });
      }
    });
    return {
      name: (document.getElementById("gc-rt-gh-name") || {}).value || "",
      Name: (document.getElementById("gc-rt-gh-name") || {}).value || "",
      Zone: (document.getElementById("gc-rt-gh-zone") || {}).value || "",
      IPAddress: (document.getElementById("gc-rt-gh-ip") || {}).value || "",
      MonitoringCondition: mcRows,
    };
  }

  function buildFormFor(et, row) {
    if (et === "unicast_route") return buildUnicastRouteForm(row);
    if (et === "gateway") return buildGatewayForm(row);
    if (et === "gateway_host") return buildGatewayHostForm(row);
    return '<p class="muted">Unsupported entity type.</p>';
  }

  function collectForm(et) {
    if (et === "unicast_route") return collectUnicastRouteForm();
    if (et === "gateway") return collectGatewayForm();
    if (et === "gateway_host") return collectGatewayHostForm();
    return null;
  }

  function humanTitle(et) {
    if (et === "unicast_route") return "unicast route";
    if (et === "gateway") return "gateway";
    if (et === "gateway_host") return "custom gateway";
    return et;
  }

  function identityLabel(et) {
    if (et === "unicast_route") return "Destination IP";
    return "Name";
  }

  function setupRepeatableHandlers() {
    let foAdd = document.getElementById("gc-rt-gw-fo-add");
    if (foAdd) foAdd.addEventListener("click", function () {
      let root = document.getElementById("gc-rt-gw-fo-rows");
      if (!root) return;
      let nextIdx = root.children.length;
      root.insertAdjacentHTML("beforeend", buildFailoverRow(nextIdx, {}));
    });
    let mcAdd = document.getElementById("gc-rt-gh-mc-add");
    if (mcAdd) mcAdd.addEventListener("click", function () {
      let root = document.getElementById("gc-rt-gh-mc-rows");
      if (!root) return;
      let nextIdx = root.children.length;
      root.insertAdjacentHTML("beforeend", buildMonitorRow(nextIdx, {}));
    });
    if (fieldsRoot) {
      fieldsRoot.addEventListener("click", function (ev) {
        let t = ev.target;
        if (!t) return;
        let foRm = t.getAttribute && t.getAttribute("data-gc-rt-fo-remove");
        if (foRm != null) {
          let row = t.closest(".gc-rt-failover-row");
          if (row && row.parentNode) row.parentNode.removeChild(row);
          return;
        }
        let mcRm = t.getAttribute && t.getAttribute("data-gc-rt-mc-remove");
        if (mcRm != null) {
          let row = t.closest(".gc-rt-mon-row");
          if (row && row.parentNode) row.parentNode.removeChild(row);
        }
      });
    }
  }

  function openAdd(et) {
    if (!flyout) return;
    currentEntityType = et;
    currentMode = "add";
    currentRow = { entity_type: et, flat: {}, hs_edit_targets: [] };
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
    if (et !== "unicast_route" && et !== "gateway" && et !== "gateway_host") return;
    currentEntityType = et;
    currentMode = "edit";
    currentRow = row;
    let nm = (row.cells && (row.cells.__name || row.cells.Name || row.cells.DestinationIP)) ||
      row.external_name || "";
    if (titleEl) titleEl.textContent = "Edit " + humanTitle(et) + (nm ? " — " + nm : "");
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
      window.gcAlert(identityLabel(currentEntityType) + " is required.");
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
    flyout = document.getElementById("gc-rt-edit-flyout");
    if (!flyout) return;
    panel = flyout.querySelector(".gc-if-flyout__panel");
    backdrop = flyout.querySelector(".gc-if-flyout__backdrop");
    titleEl = document.getElementById("gc-rt-flyout-title");
    metaEl = document.getElementById("gc-rt-flyout-meta");
    fieldsRoot = document.getElementById("gc-rt-flyout-fields");
    closeBtn = document.getElementById("gc-rt-flyout-close");
    doneBtn = document.getElementById("gc-rt-flyout-done");
    saveBtn = document.getElementById("gc-rt-flyout-save");

    if (closeBtn) closeBtn.addEventListener("click", closeFlyout);
    if (doneBtn) doneBtn.addEventListener("click", closeFlyout);
    if (backdrop) backdrop.addEventListener("click", closeFlyout);
    if (saveBtn) saveBtn.addEventListener("click", handleSave);

    document.addEventListener("keydown", function (ev) {
      if (!flyout || flyout.hidden) return;
      if (ev.key === "Escape") closeFlyout();
    });
  }

  globalThis.gcRoutingFlyoutInit = init;
  globalThis.gcRoutingFlyoutOpenAddForEntity = openAdd;
  globalThis.gcRoutingFlyoutOpenFromTr = openEditFromTr;
})();
