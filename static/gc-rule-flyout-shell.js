/**
 * Shared shell for the firewall_rule and nat_rule edit/add flyouts.
 *
 * Both flyouts have an identical lifecycle (open / close / save / wire-up
 * keyboard + buttons) plus an identical set of cross-cutting helpers
 * (escape-HTML, owner-id lookups, isCfg target detection).  This module
 * factors those out so each rule-specific flyout only needs to provide:
 *
 *   - the per-rule DOM ids (flyout, title, meta, fields-root, buttons),
 *   - per-rule defaults (entityType, default presets, save-event name),
 *   - a buildForm(row) renderer,
 *   - a setupRepeatableHandlers() function (event wiring done after every
 *     buildForm() write, since innerHTML wipes listeners),
 *   - a collectForm() reader,
 *   - an optional applyReadOnlyState() (used by firewall_rule for the
 *     HTTPBased read-only banner; nat_rule passes nothing).
 *
 * Public entry points:
 *   gcRuleFlyoutShell.escapeHtml(s)
 *   gcRuleFlyoutShell.pick(flat, keys)
 *   gcRuleFlyoutShell.isCfg()
 *   gcRuleFlyoutShell.topBarOwnerIds()
 *   gcRuleFlyoutShell.rowEditOwnerIds(row)
 *   gcRuleFlyoutShell.rowEditEntryIds(row)
 *   gcRuleFlyoutShell.create(cfg) -> { init, openAdd, openEditFromTr, closeFlyout, getCurrentRow }
 */
(function () {
  "use strict";

  // ── Cross-cutting helpers ─────────────────────────────────────────────

  function isCfg() {
    // The DHCP page publishes ``gcDhcpEntityTarget``; the Protect page
    // publishes ``gcProtectFirewallEntityTarget``.  Both are honoured so
    // the flyouts work regardless of which page hosts them.
    let t =
      typeof globalThis.gcProtectFirewallEntityTarget === "string"
        ? globalThis.gcProtectFirewallEntityTarget
        : globalThis.gcDhcpEntityTarget;
    return typeof t === "string" && t === "configuration";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
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

  function _normalizeIds(arr) {
    return Array.isArray(arr)
      ? arr.map(Number).filter(function (n) { return !isNaN(n) && n > 0; })
      : [];
  }

  function topBarOwnerIds() {
    if (isCfg()) {
      let g = globalThis.gcGetSelectedConfigurationIds;
      return _normalizeIds(typeof g === "function" ? g() : []);
    }
    let g2 = globalThis.gcGetSelectedFirewallIds;
    return _normalizeIds(typeof g2 === "function" ? g2() : []);
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

  // ── Pure HTML field builders (no DOM access; safe to share verbatim) ──

  function selectInput(id, val, options, opts) {
    opts = opts || {};
    let html = options.map(function (o) {
      let v = typeof o === "string" ? o : o.value;
      let lab = typeof o === "string" ? o : (o.label || o.value);
      return '<option value="' + escapeHtml(v) + '"' +
        (String(val) === String(v) ? " selected" : "") + ">" +
        escapeHtml(lab) + "</option>";
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
    return '<input id="' + id + '" type="' + escapeHtml(type) +
      '" value="' + escapeHtml(val == null ? "" : val) + '"' + attrs + " />";
  }

  function textArea(id, val, opts) {
    opts = opts || {};
    let attrs = ' class="gc-if-flyout__input"';
    if (opts.disabled) attrs += " disabled";
    if (opts.placeholder) attrs += ' placeholder="' + escapeHtml(opts.placeholder) + '"';
    let rows = opts.rows || 2;
    return '<textarea id="' + id + '" rows="' + rows + '"' + attrs + ">" +
      escapeHtml(val == null ? "" : val) + "</textarea>";
  }

  function fieldRow(label, html, opts) {
    opts = opts || {};
    let req = opts.required ? ' <span class="gc-if-flyout__req">*</span>' : "";
    let hint = opts.hint
      ? '<p class="muted" style="margin-top:4px">' + escapeHtml(opts.hint) + "</p>"
      : "";
    return '<div class="gc-if-flyout__field"><label class="gc-if-flyout__label">' +
      escapeHtml(label) + req + "</label>" + html + hint + "</div>";
  }

  function fieldset(text, inner, attrs) {
    attrs = attrs || "";
    return '<fieldset class="gc-if-flyout__fieldset"' + attrs + ">" +
      "<legend>" + escapeHtml(text) + "</legend>" + inner + "</fieldset>";
  }

  // ── List-of-strings repeating helpers (no DOM access) ─────────────────

  function readStringList(flat, blockKey, childKey) {
    let out = [];
    if (!flat) return out;
    let block = flat[blockKey];
    if (block == null) return out;
    if (typeof block === "string") {
      let v = block.trim();
      if (v) out.push(v);
      return out;
    }
    if (typeof block !== "object") return out;
    let raw = block[childKey];
    if (raw == null) return out;
    if (!Array.isArray(raw)) raw = [raw];
    raw.forEach(function (v) {
      if (v != null && String(v).trim()) out.push(String(v).trim());
    });
    return out;
  }

  /**
   * Render the row + add/remove buttons for a "list of strings" fieldset.
   *
   * Each per-flyout caller picks its own ``rowClass`` and ``dataAttrPrefix``
   * (e.g. "gc-fwr-strrow" + "gc-fwr-str") so the per-flyout click delegate
   * can scope its handlers without colliding with another flyout instance
   * that happens to be alive on the same page.
   */
  function buildStringRow(rowClass, dataAttrPrefix, rowsId, idx, val, placeholder) {
    return '<div class="' + rowClass + '" data-rowsid="' + rowsId +
      '" data-idx="' + idx +
      '" style="display:flex;gap:6px;align-items:center;margin-bottom:6px">' +
      '<input id="' + rowsId + "-" + idx +
      '" type="text" class="gc-if-flyout__input mono" value="' +
      escapeHtml(val || "") + '" placeholder="' + escapeHtml(placeholder || "") +
      '" style="flex:1" />' +
      '<button type="button" class="btn btn--secondary" data-' + dataAttrPrefix +
      'rm="' + rowsId + ":" + idx + '" title="Remove" aria-label="Remove">&minus;</button>' +
      "</div>";
  }

  function stringListBlock(rowClass, dataAttrPrefix, legendText, rowsId, values, placeholder, addLabel) {
    let html = '<div id="' + rowsId + '">';
    values.forEach(function (v, i) {
      html += buildStringRow(rowClass, dataAttrPrefix, rowsId, i, v, placeholder);
    });
    html += '</div><button type="button" id="' + rowsId + '-add" data-' +
      dataAttrPrefix + 'add="' + rowsId + '" data-placeholder="' +
      escapeHtml(placeholder || "") + '" class="btn btn--secondary">' +
      escapeHtml(addLabel || "Add") + "</button>";
    return fieldset(legendText, html);
  }

  function collectStringList(rowClass, rowsId) {
    let out = [];
    document.querySelectorAll('#' + rowsId + ' .' + rowClass).forEach(function (el) {
      let i = el.dataset.idx;
      let inp = document.getElementById(rowsId + "-" + i);
      let v = inp ? String(inp.value || "").trim() : "";
      if (v) out.push(v);
    });
    return out;
  }

  function _postJson(url, payload) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); });
  }

  // ── Per-flyout shell factory ──────────────────────────────────────────

  /**
   * @param {{
   *   entityType: string,
   *   flyoutId: string,
   *   titleId: string,
   *   metaId: string,
   *   fieldsId: string,
   *   closeBtnId: string,
   *   doneBtnId: string,
   *   saveBtnId: string,
   *   readOnlyBannerId?: string,
   *   savedEventName: string,
   *   titleAdd: string,
   *   titleEdit: string,
   *   targetSingular?: string,   // e.g. "firewall rule" / "NAT rule" — used in titles
   *   defaultPresets?: object,
   *   buildForm: function(object): string,
   *   setupRepeatableHandlers: function(): void,
   *   collectForm: function(): object|null,
   *   applyReadOnlyState?: function(): void,
   * }} cfg
   */
  function create(cfg) {
    cfg = cfg || {};
    const entityType = String(cfg.entityType || "");
    const savedEvent = String(cfg.savedEventName || "");

    let flyout = null;
    let panel = null;
    let backdrop = null;
    let titleEl = null;
    let metaEl = null;
    let readOnlyBanner = null;
    let fieldsRoot = null;
    let closeBtn = null;
    let doneBtn = null;
    let saveBtn = null;

    /** @type {object|null} */
    let currentRow = null;
    /** @type {"add"|"edit"} */
    let currentMode = "add";

    function callMaybe(name) {
      let fn = cfg[name];
      if (typeof fn === "function") {
        try { return fn(); } catch (e) { /* ignore */ }
      }
      return undefined;
    }

    function renderForm(row) {
      if (fieldsRoot) {
        let html = "";
        try { html = cfg.buildForm(row, currentMode === "add"); } catch (e) { html = ""; }
        fieldsRoot.innerHTML = html;
      }
      callMaybe("setupRepeatableHandlers");
      callMaybe("applyReadOnlyState");
    }

    function showFlyout() {
      if (!flyout) return;
      flyout.hidden = false;
      flyout.setAttribute("aria-hidden", "false");
      if (panel) try { panel.focus(); } catch (e) { /* ignore */ }
    }

    function openAdd(presets) {
      if (!flyout) return;
      currentMode = "add";
      let flat = {};
      if (cfg.defaultPresets && typeof cfg.defaultPresets === "object") {
        Object.keys(cfg.defaultPresets).forEach(function (k) {
          flat[k] = cfg.defaultPresets[k];
        });
      }
      if (presets && typeof presets === "object") {
        Object.keys(presets).forEach(function (k) { flat[k] = presets[k]; });
      }
      currentRow = { entity_type: entityType, flat: flat, hs_edit_targets: [] };
      if (titleEl) titleEl.textContent = cfg.titleAdd || ("Add " + (cfg.targetSingular || "rule"));
      if (metaEl) metaEl.hidden = true;
      if (saveBtn) { saveBtn.hidden = false; saveBtn.disabled = false; }
      renderForm(currentRow);
      showFlyout();
    }

    function openEditFromTr(tr) {
      if (!flyout || !tr || !tr._gcNetRow) return;
      let row = tr._gcNetRow;
      let et = String(row.entity_type || "").trim();
      if (et !== entityType) return;
      currentMode = "edit";
      currentRow = row;
      let nm = (row.cells && (row.cells.__name || row.cells.Name)) || row.external_name || "";
      let baseTitle = cfg.titleEdit || ("Edit " + (cfg.targetSingular || "rule"));
      if (titleEl) titleEl.textContent = baseTitle + (nm ? " \u2014 " + nm : "");
      if (metaEl) {
        let owners = rowEditOwnerIds(row);
        metaEl.textContent =
          (owners.length || 1) + " " +
          (isCfg() ? "configuration" : "firewall") +
          " target" + ((owners.length === 1) ? "" : "s");
        metaEl.hidden = false;
      }
      if (saveBtn) { saveBtn.hidden = false; saveBtn.disabled = false; }
      renderForm(currentRow);
      showFlyout();
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
      if (savedEvent) {
        document.dispatchEvent(new CustomEvent(savedEvent));
      }
    }

    function handleSave() {
      if (!currentRow) return;
      let form = null;
      try { form = cfg.collectForm(); } catch (e) { form = null; }
      if (!form || !String(form.name || "").trim()) {
        if (typeof globalThis.gcAlert === "function") globalThis.gcAlert("Name is required.");
        return;
      }
      if (saveBtn) saveBtn.disabled = true;

      let cfgScope = isCfg();
      let crUrl = cfgScope ? globalThis.gcHsApplyCreatesBatchUrl : globalThis.gcHsEnqueueCreatesBatchUrl;
      let upUrl = cfgScope ? globalThis.gcHsApplyUpdatesBatchUrl : globalThis.gcHsEnqueueUpdatesBatchUrl;
      let idsKey = cfgScope ? "configuration_ids" : "firewall_ids";

      function fail(msg) {
        if (typeof globalThis.gcAlert === "function") {
          globalThis.gcAlert(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
        if (saveBtn) saveBtn.disabled = false;
      }

      if (currentMode === "add") {
        let owners = topBarOwnerIds();
        if (!crUrl || !owners.length) {
          return fail(cfgScope ? "Select at least one configuration." : "Select at least one firewall.");
        }
        let payload = { entity_type: entityType, form: form };
        payload[idsKey] = owners;
        _postJson(crUrl, payload).then(function (x) {
          if (!x.ok) return fail((x.j && (x.j.detail || x.j.message)) || "Could not create.");
          notifySaved();
          closeFlyout();
        }).catch(function () { fail("Network error."); });
        return;
      }

      let entryIds = rowEditEntryIds(currentRow);
      if (!entryIds.length) return fail("No targets to update.");
      if (!upUrl) return fail("Update URL not configured.");
      _postJson(upUrl, { config_entry_ids: entryIds, form: form }).then(function (x) {
        if (!x.ok) return fail((x.j && (x.j.detail || x.j.message)) || "Could not update.");
        notifySaved();
        closeFlyout();
      }).catch(function () { fail("Network error."); });
    }

    function init() {
      flyout = document.getElementById(cfg.flyoutId);
      if (!flyout) return;
      panel = flyout.querySelector(".gc-if-flyout__panel");
      backdrop = flyout.querySelector(".gc-if-flyout__backdrop");
      titleEl = document.getElementById(cfg.titleId);
      metaEl = document.getElementById(cfg.metaId);
      if (cfg.readOnlyBannerId) {
        readOnlyBanner = document.getElementById(cfg.readOnlyBannerId);
      }
      fieldsRoot = document.getElementById(cfg.fieldsId);
      closeBtn = document.getElementById(cfg.closeBtnId);
      doneBtn = document.getElementById(cfg.doneBtnId);
      saveBtn = document.getElementById(cfg.saveBtnId);

      if (closeBtn) closeBtn.addEventListener("click", closeFlyout);
      if (doneBtn) doneBtn.addEventListener("click", closeFlyout);
      if (backdrop) backdrop.addEventListener("click", closeFlyout);
      if (saveBtn) saveBtn.addEventListener("click", handleSave);

      document.addEventListener("keydown", function (ev) {
        if (!flyout || flyout.hidden) return;
        if (ev.key === "Escape") closeFlyout();
      });
    }

    return {
      init: init,
      openAdd: openAdd,
      openEditFromTr: openEditFromTr,
      closeFlyout: closeFlyout,
      getCurrentRow: function () { return currentRow; },
      getCurrentMode: function () { return currentMode; },
      getReadOnlyBanner: function () { return readOnlyBanner; },
      getSaveBtn: function () { return saveBtn; },
      getFieldsRoot: function () { return fieldsRoot; },
      getFlyout: function () { return flyout; },
    };
  }

  globalThis.gcRuleFlyoutShell = {
    create: create,
    isCfg: isCfg,
    escapeHtml: escapeHtml,
    pick: pick,
    topBarOwnerIds: topBarOwnerIds,
    rowEditOwnerIds: rowEditOwnerIds,
    rowEditEntryIds: rowEditEntryIds,
    selectInput: selectInput,
    textInput: textInput,
    textArea: textArea,
    fieldRow: fieldRow,
    fieldset: fieldset,
    readStringList: readStringList,
    buildStringRow: buildStringRow,
    stringListBlock: stringListBlock,
    collectStringList: collectStringList,
  };
})();
