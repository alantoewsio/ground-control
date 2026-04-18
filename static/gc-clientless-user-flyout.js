/**
 * Clientless User flyout: Add / Edit form for entity_type "clientless_user".
 * Submits via the HS task queue (firewall scope) or the configuration-apply
 * endpoints (configuration scope).
 */
(function () {
  "use strict";

  let flyout, panel, backdrop, titleEl, metaEl, fieldsRoot, closeBtn, doneBtn, saveBtn;
  let currentRow = null;
  let currentMode = "add";

  function isCfg() {
    return typeof globalThis.gcClientlessUserEntityTarget === "string"
      && globalThis.gcClientlessUserEntityTarget === "configuration";
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
    let nm = pick(f, ["Name"]);
    let user = pick(f, ["UserName", "Username"]);
    let ip = pick(f, ["IPAddress"]);
    let group = pick(f, ["ClientLessGroup", "Group"]);
    let email = pick(f, ["Email"]);
    let status = pick(f, ["Status"]) || "Active";
    let qDigest = pick(f, ["QuarantineDigest"]) || "ApplyGroupSettings";
    let qos = pick(f, ["QoSPolicy"]);
    let desc = pick(f, ["Description"]);

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

    let html = "";
    html += row1("Name", txt("gc-cu-name", nm, true, !nameEditable), true);
    html += row1("Username", txt("gc-cu-username", user, true, !nameEditable), true);
    html += row1("IP address", txt("gc-cu-ip", ip, true), false);
    html += row1("Group", txt("gc-cu-group", group, true), true);
    html += row1("Email", txt("gc-cu-email", email, false), true);
    html += row1("Status", sel("gc-cu-status", status, ["Active", "Inactive"]), false);
    html += row1("Quarantine digest", sel("gc-cu-qd", qDigest, ["ApplyGroupSettings", "Enable", "Disable"]), false);
    html += row1("QoS policy", txt("gc-cu-qos", qos, false), false);
    html += row1("Description", '<textarea id="gc-cu-desc" class="gc-if-flyout__input" rows="2">' + escapeHtml(desc) + "</textarea>", false);
    return html;
  }

  function collectForm() {
    function v(id) { let el = document.getElementById(id); return el ? el.value : ""; }
    return {
      name: v("gc-cu-name"),
      Name: v("gc-cu-name"),
      UserName: v("gc-cu-username"),
      IPAddress: v("gc-cu-ip"),
      ClientLessGroup: v("gc-cu-group"),
      Email: v("gc-cu-email"),
      Status: v("gc-cu-status"),
      QuarantineDigest: v("gc-cu-qd"),
      QoSPolicy: v("gc-cu-qos"),
      Description: v("gc-cu-desc"),
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
    currentRow = { entity_type: "clientless_user", flat: {}, hs_edit_targets: [] };
    if (titleEl) titleEl.textContent = "Add clientless user";
    if (metaEl) metaEl.hidden = true;
    if (saveBtn) { saveBtn.hidden = false; saveBtn.disabled = false; }
    if (fieldsRoot) fieldsRoot.innerHTML = buildForm(currentRow);
    flyout.hidden = false; flyout.setAttribute("aria-hidden", "false");
    if (panel) try { panel.focus(); } catch (e) { }
  }

  function openEditFromTr(tr) {
    if (!flyout || !tr || !tr._gcNetRow) return;
    let row = tr._gcNetRow;
    if (String(row.entity_type || "") !== "clientless_user") return;
    currentMode = "edit";
    currentRow = row;
    let nm = (row.cells && (row.cells.__name || row.cells.Name)) || row.external_name || "";
    if (titleEl) titleEl.textContent = "Edit clientless user" + (nm ? " — " + nm : "");
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
    if (!String(f.name || "").trim()) { window.gcAlert("Name is required."); return; }
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
      let payload = { entity_type: "clientless_user", form: f };
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
    flyout = document.getElementById("gc-cu-edit-flyout");
    if (!flyout) return;
    panel = flyout.querySelector(".gc-if-flyout__panel");
    backdrop = flyout.querySelector(".gc-if-flyout__backdrop");
    titleEl = document.getElementById("gc-cu-flyout-title");
    metaEl = document.getElementById("gc-cu-flyout-meta");
    fieldsRoot = document.getElementById("gc-cu-flyout-fields");
    closeBtn = document.getElementById("gc-cu-flyout-close");
    doneBtn = document.getElementById("gc-cu-flyout-done");
    saveBtn = document.getElementById("gc-cu-flyout-save");
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (doneBtn) doneBtn.addEventListener("click", close);
    if (backdrop) backdrop.addEventListener("click", close);
    if (saveBtn) saveBtn.addEventListener("click", onSave);
    document.addEventListener("keydown", function (ev) {
      if (!flyout || flyout.hidden) return;
      if (ev.key === "Escape") close();
    });
  }

  globalThis.gcClientlessUserFlyoutInit = init;
  globalThis.gcClientlessUserFlyoutOpenAdd = openAdd;
  globalThis.gcClientlessUserFlyoutOpenFromTr = openEditFromTr;
})();
