/**
 * Local Service ACL flyout: Add / Edit form for entity_type "acl_rule".
 * Handles list-style fields (source_hosts, dst_hosts, services) by collecting
 * comma- or newline-separated values from textareas. Submits via the HS task
 * queue (firewall scope) or the configuration-apply endpoints (configuration
 * scope).
 */
(function () {
  "use strict";

  let flyout, panel, backdrop, titleEl, metaEl, fieldsRoot, closeBtn, doneBtn, saveBtn;
  let currentRow = null;
  let currentMode = "add";

  function isCfg() {
    return typeof globalThis.gcLocalServiceAclEntityTarget === "string"
      && globalThis.gcLocalServiceAclEntityTarget === "configuration";
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

  function pickList(flat, key) {
    if (!flat) return [];
    let v = flat[key];
    if (Array.isArray(v)) return v.map(function (x) { return String(x).trim(); }).filter(Boolean);
    if (v == null || v === "") return [];
    return [String(v).trim()];
  }

  function topBarOwnerIds() {
    let g = isCfg() ? globalThis.gcGetSelectedConfigurationIds : globalThis.gcGetSelectedFirewallIds;
    let arr = typeof g === "function" ? g() : [];
    return Array.isArray(arr) ? arr.map(Number).filter(function (n) { return !isNaN(n) && n > 0; }) : [];
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

  function buildForm(row) {
    let f = (row && row.flat) || {};
    let nameEditable = currentMode === "add";
    let rule = pick(f, ["RuleName", "Name"]);
    let ipFamily = pick(f, ["IPFamily"]) || "IPv4";
    let srcZone = pick(f, ["SourceZone"]);
    let action = pick(f, ["Action"]) || "Accept";
    let desc = pick(f, ["Description"]);

    let srcHosts = pickList(f, "Hosts.Host");
    if (!srcHosts.length && f.Hosts && typeof f.Hosts === "object") {
      let h = f.Hosts.Host;
      if (Array.isArray(h)) srcHosts = h.map(String);
      else if (typeof h === "string") srcHosts = [h];
    }
    let dstHosts = pickList(f, "Hosts.DstHost");
    if (!dstHosts.length && f.Hosts && typeof f.Hosts === "object") {
      let d = f.Hosts.DstHost;
      if (Array.isArray(d)) dstHosts = d.map(String);
      else if (typeof d === "string") dstHosts = [d];
    }
    let services = pickList(f, "Services.Service");
    if (!services.length && f.Services && typeof f.Services === "object") {
      let s = f.Services.Service;
      if (Array.isArray(s)) services = s.map(String);
      else if (typeof s === "string") services = [s];
    }

    function row1(label, html, req) {
      return '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label">' + escapeHtml(label) +
        (req ? ' <span class="gc-if-flyout__req">*</span>' : "") + "</label>" + html + "</div>";
    }
    function txt(id, v, mono, disabled) {
      return '<input id="' + id + '" type="text" class="gc-if-flyout__input' + (mono ? " mono" : "") + '" value="' +
        escapeHtml(v) + '"' + (disabled ? " disabled" : "") + " />";
    }
    function sel(id, v, opts) {
      let o = opts.map(function (x) {
        return '<option value="' + escapeHtml(x) + '"' + (v === x ? " selected" : "") + ">" + escapeHtml(x) + "</option>";
      }).join("");
      return '<select id="' + id + '" class="gc-if-flyout__input">' + o + "</select>";
    }
    function ta(id, v, hint) {
      return '<textarea id="' + id + '" class="gc-if-flyout__input mono" rows="3" placeholder="One per line">' +
        escapeHtml(v.join("\n")) + "</textarea>" +
        (hint ? '<p class="muted" style="margin-top:4px">' + escapeHtml(hint) + "</p>" : "");
    }

    let html = "";
    html += row1("Rule name", txt("gc-lsacl-name", rule, true, !nameEditable), true);
    html += row1("IP family", sel("gc-lsacl-ipfamily", ipFamily, ["IPv4", "IPv6"]), false);
    html += row1("Source zone", txt("gc-lsacl-srczone", srcZone, true), false);
    html += row1("Action", sel("gc-lsacl-action", action, ["Accept", "Drop"]), false);
    html += row1("Source hosts", ta("gc-lsacl-srchosts", srcHosts, "Host names, one per line"), false);
    html += row1("Destination hosts", ta("gc-lsacl-dsthosts", dstHosts, "Host names, one per line"), false);
    html += row1("Services", ta("gc-lsacl-services", services, "Service names, one per line"), false);
    html += row1("Description", '<textarea id="gc-lsacl-desc" class="gc-if-flyout__input" rows="2">' + escapeHtml(desc) + "</textarea>", false);
    return html;
  }

  function splitLines(text) {
    return String(text || "")
      .split(/\r?\n|,/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function collectForm() {
    function v(id) { let el = document.getElementById(id); return el ? el.value : ""; }
    return {
      name: v("gc-lsacl-name"),
      RuleName: v("gc-lsacl-name"),
      IPFamily: v("gc-lsacl-ipfamily"),
      SourceZone: v("gc-lsacl-srczone"),
      Action: v("gc-lsacl-action"),
      Description: v("gc-lsacl-desc"),
      source_hosts: splitLines(v("gc-lsacl-srchosts")),
      dst_hosts: splitLines(v("gc-lsacl-dsthosts")),
      services: splitLines(v("gc-lsacl-services")),
    };
  }

  function notifySaved() {
    if (isCfg()) document.dispatchEvent(new CustomEvent("gc-configuration-entries-updated"));
    else document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
  }

  function postJson(url, payload) {
    return fetch(url, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
  }

  function openAdd() {
    if (!flyout) return;
    currentMode = "add";
    currentRow = { entity_type: "acl_rule", flat: {}, hs_edit_targets: [] };
    if (titleEl) titleEl.textContent = "Add Local Service ACL rule";
    if (metaEl) metaEl.hidden = true;
    if (saveBtn) { saveBtn.hidden = false; saveBtn.disabled = false; }
    if (fieldsRoot) fieldsRoot.innerHTML = buildForm(currentRow);
    flyout.hidden = false; flyout.setAttribute("aria-hidden", "false");
    if (panel) try { panel.focus(); } catch (e) { }
  }

  function openEditFromTr(tr) {
    if (!flyout || !tr || !tr._gcNetRow) return;
    let row = tr._gcNetRow;
    if (String(row.entity_type || "") !== "acl_rule") return;
    currentMode = "edit";
    currentRow = row;
    let nm = (row.cells && (row.cells.__name || row.cells.RuleName)) || row.external_name || "";
    if (titleEl) titleEl.textContent = "Edit ACL rule" + (nm ? " — " + nm : "");
    if (metaEl) metaEl.hidden = true;
    if (saveBtn) { saveBtn.hidden = false; saveBtn.disabled = false; }
    if (fieldsRoot) fieldsRoot.innerHTML = buildForm(currentRow);
    flyout.hidden = false; flyout.setAttribute("aria-hidden", "false");
    if (panel) try { panel.focus(); } catch (e) { }
  }

  function close() {
    if (!flyout) return;
    if (saveBtn) saveBtn.disabled = false;
    flyout.hidden = true; flyout.setAttribute("aria-hidden", "true");
    currentRow = null;
  }

  function onSave() {
    if (!currentRow) return;
    let f = collectForm();
    if (!String(f.name || "").trim()) { window.gcAlert("Rule name is required."); return; }
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
      if (!crUrl || !owners.length) return fail(cfg ? "Select at least one configuration." : "Select at least one firewall.");
      let payload = { entity_type: "acl_rule", form: f };
      payload[idsKey] = owners;
      postJson(crUrl, payload).then(function (x) {
        if (!x.ok) return fail((x.j && (x.j.detail || x.j.message)) || "Could not create.");
        notifySaved(); close();
      }).catch(function () { fail("Network error."); });
      return;
    }
    let entryIds = rowEditEntryIds(currentRow);
    if (!entryIds.length) return fail("No targets to update.");
    if (!upUrl) return fail("Update URL not configured.");
    postJson(upUrl, { config_entry_ids: entryIds, form: f }).then(function (x) {
      if (!x.ok) return fail((x.j && (x.j.detail || x.j.message)) || "Could not update.");
      notifySaved(); close();
    }).catch(function () { fail("Network error."); });
  }

  function init() {
    flyout = document.getElementById("gc-lsacl-edit-flyout");
    if (!flyout) return;
    panel = flyout.querySelector(".gc-if-flyout__panel");
    backdrop = flyout.querySelector(".gc-if-flyout__backdrop");
    titleEl = document.getElementById("gc-lsacl-flyout-title");
    metaEl = document.getElementById("gc-lsacl-flyout-meta");
    fieldsRoot = document.getElementById("gc-lsacl-flyout-fields");
    closeBtn = document.getElementById("gc-lsacl-flyout-close");
    doneBtn = document.getElementById("gc-lsacl-flyout-done");
    saveBtn = document.getElementById("gc-lsacl-flyout-save");
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (doneBtn) doneBtn.addEventListener("click", close);
    if (backdrop) backdrop.addEventListener("click", close);
    if (saveBtn) saveBtn.addEventListener("click", onSave);
    document.addEventListener("keydown", function (ev) {
      if (!flyout || flyout.hidden) return;
      if (ev.key === "Escape") close();
    });
  }

  globalThis.gcLocalServiceAclFlyoutInit = init;
  globalThis.gcLocalServiceAclFlyoutOpenAdd = openAdd;
  globalThis.gcLocalServiceAclFlyoutOpenFromTr = openEditFromTr;
})();
