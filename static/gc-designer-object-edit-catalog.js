/**
 * Designer · Modals · object-edit-flyout: render payload catalog fields from
 * GET /api/designer/entity-payload-fields/{entity_type} (requires designer auth).
 */
(function () {
  "use strict";

  var ENTITY_TYPE_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
  var helpPopoverEl = null;
  var helpPopoverOpenBtn = null;

  function trimStr(x) {
    return String(x == null ? "" : x).replace(/^\s+|\s+$/g, "");
  }

  function isSkippableDataEntryType(detRaw) {
    if (typeof globalThis.gcDcLayoutIsSkippableDataEntryType === "function") {
      return globalThis.gcDcLayoutIsSkippableDataEntryType(detRaw);
    }
    var det = trimStr(detRaw != null ? String(detRaw) : "").toLowerCase();
    return !det || det === "hidden" || det === "none";
  }

  function notifyObjectEditCatalogVisibleFieldCount(visibleFieldCount) {
    var n = typeof visibleFieldCount === "number" ? visibleFieldCount : 0;
    try {
      document.dispatchEvent(
        new CustomEvent("gc-designer-object-edit-catalog-rendered", {
          detail: { visibleFieldCount: n },
        }),
      );
    } catch (e0) {}
  }

  function countVisibleCatalogRows() {
    var host = document.getElementById("gc-designer-object-edit-catalog-fields");
    if (!host) return 0;
    var n = 0;
    host.querySelectorAll(".gc-designer-object-edit-catalog-row").forEach(function (row) {
      if (!row.hidden && row.style.display !== "none") n++;
    });
    return n;
  }

  function parsePropsJson(raw) {
    if (raw == null || trimStr(raw) === "") return {};
    try {
      var j = JSON.parse(String(raw));
      return j && typeof j === "object" ? j : {};
    } catch (e) {
      return {};
    }
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtmlText(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /** Valid entity_type strings from field catalog ``data_source_entity_types`` (API-shaped). */
  function catalogDataSourceEntityTypes(field) {
    if (!field || !Array.isArray(field.data_source_entity_types)) return [];
    var out = [];
    var seen = {};
    field.data_source_entity_types.forEach(function (x) {
      var t = trimStr(x != null ? x : "");
      if (!t || !ENTITY_TYPE_RE.test(t) || seen[t]) return;
      seen[t] = true;
      out.push(t);
    });
    return out;
  }

  function mlCatalogEntityCheckboxesHtml(types) {
    var parts = [];
    types.forEach(function (et) {
      var v = escapeAttr(et);
      var lab = escapeHtmlText(et);
      parts.push(
        '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
          '<input type="checkbox" data-gc-ml-entity-type value="' +
          v +
          '" checked />' +
          '<span class="settings-form__label mono" style="margin:0">' +
          lab +
          "</span></label>",
      );
    });
    return parts.join("");
  }

  function ensureHelpPopover() {
    if (helpPopoverEl) return helpPopoverEl;
    helpPopoverEl = document.createElement("div");
    helpPopoverEl.className = "gc-object-edit-help-popover";
    helpPopoverEl.setAttribute("role", "tooltip");
    helpPopoverEl.hidden = true;
    document.body.appendChild(helpPopoverEl);
    document.addEventListener("click", function (e) {
      if (!helpPopoverEl || helpPopoverEl.hidden) return;
      var t = e.target;
      if (helpPopoverEl.contains(t)) return;
      if (t.closest && t.closest(".gc-object-edit-help-icon")) return;
      hideHelpPopover();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideHelpPopover();
    });
    return helpPopoverEl;
  }

  function hideHelpPopover() {
    if (helpPopoverEl) helpPopoverEl.hidden = true;
    if (helpPopoverOpenBtn) {
      helpPopoverOpenBtn.setAttribute("aria-expanded", "false");
      helpPopoverOpenBtn = null;
    }
  }

  function positionHelpPopover(anchor) {
    var pop = ensureHelpPopover();
    var r = anchor.getBoundingClientRect();
    var margin = 8;
    pop.style.left = Math.round(r.left + r.width / 2) + "px";
    pop.style.top = Math.round(r.top - margin) + "px";
    pop.style.transform = "translate(-50%, -100%)";
  }

  function wireHelpIcon(btn, helpText) {
    var text = trimStr(helpText);
    if (!text) return;
    btn.type = "button";
    btn.className = "gc-object-edit-help-icon";
    btn.setAttribute("aria-label", "Help: " + text.slice(0, 120));
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML =
      '<span class="gc-object-edit-help-icon__glyph" aria-hidden="true">i</span>';
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var pop = ensureHelpPopover();
      var opening = pop.hidden || helpPopoverOpenBtn !== btn;
      hideHelpPopover();
      if (!opening) return;
      pop.textContent = text;
      positionHelpPopover(btn);
      pop.hidden = false;
      helpPopoverOpenBtn = btn;
      btn.setAttribute("aria-expanded", "true");
    });
  }

  function buildLabelRow(labelText, helpText) {
    var wrap = document.createElement("div");
    wrap.className = "gc-designer-object-edit-catalog-label-row";
    var lab = document.createElement("span");
    lab.className = "settings-form__label";
    lab.textContent = labelText;
    wrap.appendChild(lab);
    if (trimStr(helpText)) {
      var hi = document.createElement("button");
      wireHelpIcon(hi, helpText);
      wrap.appendChild(hi);
    }
    return wrap;
  }

  function buildDefaultText(props) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "settings-form__input mono";
    inp.autocomplete = "off";
    if (props.value != null) inp.value = String(props.value);
    return inp;
  }

  function buildTextSingle(props) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "settings-form__input mono";
    inp.autocomplete = "off";
    if (props.value != null) inp.value = String(props.value);
    if (props.minLength != null) inp.minLength = Math.max(0, parseInt(props.minLength, 10) || 0);
    if (props.maxLength != null) inp.maxLength = Math.max(1, parseInt(props.maxLength, 10) || 1);
    if (props.charset != null) inp.setAttribute("data-gc-text-charset", String(props.charset));
    return inp;
  }

  function buildTextConfig(props) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "settings-form__input mono";
    inp.autocomplete = "off";
    if (props.value != null) inp.value = String(props.value);
    if (props.minLengthSingle != null) inp.minLength = Math.max(0, parseInt(props.minLengthSingle, 10) || 0);
    if (props.maxLengthSingle != null) inp.maxLength = Math.max(1, parseInt(props.maxLengthSingle, 10) || 1);
    if (props.charset != null) inp.setAttribute("data-gc-text-charset", String(props.charset));
    return inp;
  }

  function buildTextMultiline(props) {
    var ta = document.createElement("textarea");
    ta.className = "settings-form__input mono";
    ta.rows = 4;
    if (props.value != null) ta.value = String(props.value);
    if (props.maxLength != null) ta.maxLength = Math.max(1, parseInt(props.maxLength, 10) || 1);
    return ta;
  }

  function buildSelector(props, fieldId) {
    var grp = document.createElement("div");
    grp.className = "gc-option-selector";
    grp.setAttribute("role", "group");
    grp.setAttribute("aria-label", "Option selector");
    grp.setAttribute("data-gc-option-selector", "");
    grp.id = "gc-obj-edit-sel-" + fieldId;
    var CF = (window.__gcDesignerControlsBridge || {}).catalogFieldUi;
    var rebuild =
      CF && CF.selectorRebuild
        ? CF.selectorRebuild
        : typeof globalThis.gcOptionSelectorRebuild === "function"
          ? globalThis.gcOptionSelectorRebuild
          : null;
    if (rebuild) {
      var items = Array.isArray(props.items) ? props.items : [];
      rebuild(grp, items, {});
      var wantLabel =
        props.selectedLabel != null
          ? trimStr(props.selectedLabel)
          : props.label != null
            ? trimStr(props.label)
            : "";
      var idx = props.selectedIndex != null ? parseInt(props.selectedIndex, 10) : NaN;
      if (window.gcOptionSelectorSetSelection) {
        window.gcOptionSelectorSetSelection(grp, wantLabel, idx);
      }
      if (typeof globalThis.gcOptionSelectorSyncLayout === "function") {
        requestAnimationFrame(function () {
          globalThis.gcOptionSelectorSyncLayout(grp);
        });
      }
    }
    return grp;
  }

  function buildTagEditor(props, fieldId) {
    var root = document.createElement("div");
    root.className = "gc-designer-tags";
    root.setAttribute("data-gc-designer-tag-editor", "");
    root.id = "gc-obj-edit-tags-" + fieldId;
    root.innerHTML =
      '<input type="hidden" class="gc-designer-tags__hidden" value="[]" />' +
      '<div class="gc-designer-tags__combo">' +
      '<div class="gc-designer-tags__field" role="group">' +
      '<div class="gc-designer-tags__chips" aria-live="polite"></div>' +
      '<div class="gc-designer-tags__input-shell">' +
      '<div class="gc-designer-tags__mirror" aria-hidden="true">' +
      '<span class="gc-designer-tags__typed-mirror"></span><span class="gc-designer-tags__ghost"></span>' +
      "</div>" +
      '<input type="text" class="gc-designer-tags__input mono" autocomplete="off" spellcheck="false" aria-autocomplete="list" aria-expanded="false" placeholder="Add tag…" />' +
      "</div></div>" +
      '<ul class="gc-designer-tags__suggest" role="listbox" hidden></ul>' +
      "</div>";
    var tagBr = (window.__gcDesignerControlsBridge || {}).tags;
    if (tagBr && tagBr.initEditor) {
      tagBr.initEditor(root);
      var api = root._gcDesignerTagApi;
      if (api && api.setTags && Array.isArray(props.tags)) api.setTags(props.tags);
    }
    return root;
  }

  function buildIpField(props, family, fieldId) {
    var wrap = document.createElement("div");
    var uid = "gc-obj-edit-ip-" + family + "-" + fieldId;
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className = "settings-form__input mono gc-ip-field__input";
    inp.id = uid;
    inp.autocomplete = "off";
    inp.setAttribute("aria-invalid", "false");
    var pill = document.createElement("span");
    pill.className = "gc-ip-field__mask-pill";
    pill.hidden = true;
    pill.setAttribute("aria-hidden", "true");
    var ok = document.createElement("span");
    ok.className = "gc-ip-field__ok";
    ok.hidden = true;
    ok.setAttribute("aria-hidden", "true");
    ok.setAttribute("title", "Valid");
    ok.innerHTML = "&#10003;";
    var ipWrap = document.createElement("div");
    ipWrap.className = "gc-ip-field";
    ipWrap.appendChild(inp);
    ipWrap.appendChild(pill);
    ipWrap.appendChild(ok);
    var prev = document.createElement("p");
    prev.className = "settings-form__status gc-ip-correct-preview";
    prev.setAttribute("role", "status");
    prev.hidden = true;
    var err = document.createElement("p");
    err.className = "settings-form__status is-error";
    err.setAttribute("role", "alert");
    err.hidden = true;
    wrap.appendChild(ipWrap);
    wrap.appendChild(prev);
    wrap.appendChild(err);
    var ipB = (window.__gcDesignerControlsBridge || {}).ip;
    if (ipB) {
      if (props.clearAppliedIpAttributes) ipB.clearAllGcIpAttrs && ipB.clearAllGcIpAttrs(inp);
      else if (props.appliedIpAttributes) ipB.writeAllGcIpAttrs && ipB.writeAllGcIpAttrs(inp, props.appliedIpAttributes);
      if (props.value != null) inp.value = String(props.value);
      if (ipB.wireCatalogIpInput) {
        ipB.wireCatalogIpInput(inp, err, ok, prev, pill, family);
      }
      try {
        inp.dispatchEvent(new Event("blur"));
      } catch (eBl) {}
    }
    return wrap;
  }

  function parseIpListCsv(raw) {
    return String(raw == null ? "" : raw)
      .split(",")
      .map(function (x) {
        return trimStr(x);
      })
      .filter(Boolean);
  }

  function ipFamilyFromProps(props) {
    var famRaw =
      props && props.IPFamily != null
        ? props.IPFamily
        : props && props.ipfamily != null
          ? props.ipfamily
          : "";
    return String(famRaw || "").trim().toLowerCase() === "ipv6" ? "ipv6" : "ipv4";
  }

  function ipListReadonlyFromProps(props) {
    if (!props || typeof props !== "object") return false;
    if (props.readonly == null) return false;
    return !!props.readonly;
  }

  function buildIpListField(props, fieldId) {
    var ipB = (window.__gcDesignerControlsBridge || {}).ip;
    var wrap = document.createElement("div");
    wrap.className = "gc-ip-list-field";
    wrap.setAttribute("data-gc-ip-list", "1");
    var list = document.createElement("div");
    list.className = "gc-ip-list-field__items";
    wrap.appendChild(list);
    var family = ipFamilyFromProps(props);
    var isReadonly = ipListReadonlyFromProps(props);

    function syncErrorIcon(errEl, iconEl) {
      if (!errEl || !iconEl) return;
      var msg = trimStr(errEl.textContent || "");
      var show = !errEl.hidden && !!msg;
      iconEl.hidden = !show;
      iconEl.setAttribute("title", show ? msg : "");
      iconEl.setAttribute("aria-label", show ? msg : "");
    }

    function createItem(value, idx) {
      var row = document.createElement("div");
      row.className = "gc-ip-list-field__item";
      var ipWrap = document.createElement("div");
      ipWrap.className = "gc-ip-field";
      var inp = document.createElement("input");
      inp.type = "text";
      inp.className = "settings-form__input mono gc-ip-field__input";
      inp.autocomplete = "off";
      inp.readOnly = isReadonly;
      inp.id = "gc-obj-edit-ip-list-" + fieldId + "-" + idx;
      inp.placeholder = family === "ipv6" ? "2001:db8::1" : "192.0.2.1";
      inp.setAttribute("aria-invalid", "false");
      if (value != null) inp.value = String(value);

      var pill = document.createElement("span");
      pill.className = "gc-ip-field__mask-pill";
      pill.hidden = true;
      pill.setAttribute("aria-hidden", "true");
      var ok = document.createElement("span");
      ok.className = "gc-ip-field__ok";
      ok.hidden = true;
      ok.setAttribute("aria-hidden", "true");
      ok.setAttribute("title", "Valid");
      ok.innerHTML = "&#10003;";
      var errIcon = document.createElement("span");
      errIcon.className = "gc-ip-field__error-icon";
      errIcon.hidden = true;
      errIcon.setAttribute("aria-hidden", "true");
      errIcon.textContent = "!";

      var prev = document.createElement("p");
      prev.className = "settings-form__status gc-ip-correct-preview gc-sr-only";
      prev.setAttribute("role", "status");
      prev.hidden = true;
      var err = document.createElement("p");
      err.className = "settings-form__status is-error gc-sr-only";
      err.setAttribute("role", "alert");
      err.hidden = true;

      ipWrap.appendChild(inp);
      ipWrap.appendChild(pill);
      ipWrap.appendChild(ok);
      ipWrap.appendChild(errIcon);
      row.appendChild(ipWrap);
      row.appendChild(prev);
      row.appendChild(err);
      list.appendChild(row);

      if (ipB && ipB.wireCatalogIpInput) {
        if (props.clearAppliedIpAttributes) ipB.clearAllGcIpAttrs && ipB.clearAllGcIpAttrs(inp);
        else if (props.appliedIpAttributes)
          ipB.writeAllGcIpAttrs && ipB.writeAllGcIpAttrs(inp, props.appliedIpAttributes);
        ipB.wireCatalogIpInput(inp, err, ok, prev, pill, family);
        syncErrorIcon(err, errIcon);
        inp.addEventListener("input", function () {
          syncErrorIcon(err, errIcon);
          syncValueCache();
        });
        inp.addEventListener("blur", function () {
          syncErrorIcon(err, errIcon);
          syncValueCache();
        });
      } else {
        inp.addEventListener("input", syncValueCache);
        inp.addEventListener("blur", syncValueCache);
      }
    }

    function syncValueCache() {
      var values = [];
      list.querySelectorAll("input.gc-ip-field__input").forEach(function (inp) {
        var t = trimStr(inp.value);
        if (t) values.push(t);
      });
      wrap.dataset.gcIpListValue = values.join(",");
    }

    function setCsv(raw) {
      var values = parseIpListCsv(raw);
      list.innerHTML = "";
      if (!values.length) values = [""];
      values.forEach(function (v, idx) {
        createItem(v, idx);
      });
      syncValueCache();
      list.querySelectorAll("input.gc-ip-field__input").forEach(function (inp) {
        try {
          inp.dispatchEvent(new Event("blur"));
        } catch (eBlur) {}
      });
    }

    wrap.gcGetIpListValue = function () {
      syncValueCache();
      return wrap.dataset.gcIpListValue || "";
    };
    wrap.gcSetIpListValue = function (raw) {
      setCsv(raw);
    };

    setCsv(props && props.value != null ? props.value : "");
    return wrap;
  }

  function ddSourceFieldsetHtml(uid, multi) {
    var etChecks =
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-entity-type value="ip_host" />' +
      '<span class="settings-form__label" style="margin:0">IP host</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-entity-type value="ip_hostgroup" />' +
      '<span class="settings-form__label" style="margin:0">IP host group</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-entity-type value="fqdn_host" />' +
      '<span class="settings-form__label" style="margin:0">FQDN host</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-entity-type value="mac_host" />' +
      '<span class="settings-form__label" style="margin:0">MAC host</span></label>';
    var colChecks =
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-list-col value="__firewall" />' +
      '<span class="settings-form__label" style="margin:0">Firewall / configuration</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-list-col value="entity_type" />' +
      '<span class="settings-form__label" style="margin:0">Entity type</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-list-col value="HostType" />' +
      '<span class="settings-form__label" style="margin:0">Host type</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-list-col value="Description" />' +
      '<span class="settings-form__label" style="margin:0">Description</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-dd-list-col value="IPAddress" />' +
      '<span class="settings-form__label" style="margin:0">IP address</span></label>';
    return (
      '<fieldset class="settings-form gc-designer-dd__source gc-designer-object-edit-dd-source" id="' +
      escapeAttr(uid + "-source-fieldset") +
      '" aria-label="Dropdown data source" hidden>' +
      '<legend class="gc-sr-only">Data source</legend>' +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:10px 14px;align-items:flex-end">' +
      '<label class="settings-form__field" style="min-width:11rem">' +
      '<span class="settings-form__label">Scope</span>' +
      '<select class="settings-form__input" data-gc-dd-scope>' +
      '<option value="global">Global selector (top bar)</option>' +
      '<option value="custom">Custom IDs</option></select></label>' +
      '<label class="settings-form__field gc-designer-dd__custom-ids" style="min-width:10rem;flex:1" data-gc-dd-custom-wrap hidden>' +
      '<span class="settings-form__label">Firewall IDs</span>' +
      '<input type="text" class="settings-form__input mono" data-gc-dd-fw-ids autocomplete="off" /></label>' +
      '<label class="settings-form__field gc-designer-dd__custom-ids" style="min-width:10rem;flex:1" data-gc-dd-custom-wrap hidden>' +
      '<span class="settings-form__label">Configuration IDs</span>' +
      '<input type="text" class="settings-form__input mono" data-gc-dd-cfg-ids autocomplete="off" /></label></div>' +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:8px 16px;margin-top:8px">' +
      etChecks +
      "</div>" +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:8px 16px;margin-top:8px">' +
      colChecks +
      "</div>" +
      '<p class="settings-form__status" id="' +
      escapeAttr(uid + "-dd-status") +
      '" role="status" aria-live="polite"></p></fieldset>'
    );
  }

  function mlSourceFieldsetHtml(uid, multi, catalogEntityTypes) {
    var etChecks;
    if (catalogEntityTypes && catalogEntityTypes.length) {
      etChecks = mlCatalogEntityCheckboxesHtml(catalogEntityTypes);
    } else {
      etChecks =
        '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
        '<input type="checkbox" data-gc-ml-entity-type value="ip_host" checked />' +
        '<span class="settings-form__label" style="margin:0">IP host</span></label>' +
        '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
        '<input type="checkbox" data-gc-ml-entity-type value="ip_hostgroup" checked />' +
        '<span class="settings-form__label" style="margin:0">IP host group</span></label>' +
        '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
        '<input type="checkbox" data-gc-ml-entity-type value="fqdn_host" />' +
        '<span class="settings-form__label" style="margin:0">FQDN host</span></label>' +
        '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
        '<input type="checkbox" data-gc-ml-entity-type value="mac_host" />' +
        '<span class="settings-form__label" style="margin:0">MAC host</span></label>';
    }
    var colChecks =
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-ml-list-col value="__firewall" checked />' +
      '<span class="settings-form__label" style="margin:0">Firewall / configuration</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-ml-list-col value="entity_type" checked />' +
      '<span class="settings-form__label" style="margin:0">Entity type</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-ml-list-col value="HostType" />' +
      '<span class="settings-form__label" style="margin:0">Host type</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-ml-list-col value="Description" />' +
      '<span class="settings-form__label" style="margin:0">Description</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="checkbox" data-gc-ml-list-col value="IPAddress" />' +
      '<span class="settings-form__label" style="margin:0">IP address</span></label>';
    var modeName = escapeAttr(uid + "-ml-mode");
    var singleChecked = multi ? "" : " checked";
    var multiChecked = multi ? " checked" : "";
    return (
      '<fieldset class="settings-form gc-designer-dd__source gc-designer-object-edit-dd-source" id="' +
      escapeAttr(uid + "-source-fieldset") +
      '" aria-label="Member lookup data source" hidden>' +
      '<legend class="gc-sr-only">Member lookup source</legend>' +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:8px 16px;margin-bottom:8px">' +
      '<span class="settings-form__label" style="margin:0">Mode</span>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="radio" name="' +
      modeName +
      '" data-gc-ml-mode-single value="single"' +
      singleChecked +
      " />" +
      '<span class="settings-form__label" style="margin:0">Single</span></label>' +
      '<label class="settings-form__field" style="display:flex;align-items:center;gap:6px;margin:0">' +
      '<input type="radio" name="' +
      modeName +
      '" data-gc-ml-mode-multi value="multi"' +
      multiChecked +
      " />" +
      '<span class="settings-form__label" style="margin:0">Multi</span></label></div>' +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:8px 16px;margin-top:8px">' +
      etChecks +
      "</div>" +
      '<div class="gc-designer__row" style="flex-wrap:wrap;gap:8px 16px;margin-top:8px">' +
      colChecks +
      "</div>" +
      '<p class="settings-form__status" id="' +
      escapeAttr(uid + "-ml-status") +
      '" role="status" aria-live="polite"></p></fieldset>'
    );
  }

  function buildMemberLookup(props, fieldId, field) {
    var catalogTypes = catalogDataSourceEntityTypes(field);
    var uid = "gc-obj-edit-ml-" + fieldId;
    var multi = !!(props && props.multi);
    if (props && props.source && props.source.multi != null) multi = !!props.source.multi;
    if (catalogTypes.length) {
      props = props && typeof props === "object" ? props : {};
      props.source = props.source && typeof props.source === "object" ? props.source : {};
      props.source.entity = catalogTypes.slice();
    }
    var wrap = document.createElement("div");
    wrap.className =
      "gc-designer-dd gc-designer-member-lookup" + (multi ? " gc-designer-dd--multi" : "");
    wrap.id = uid;
    wrap.setAttribute("data-gc-designer-dd", "");
    wrap.setAttribute("data-gc-designer-member-lookup", "1");
    wrap.setAttribute("data-gc-member-lookup-status-id", uid + "-ml-status");
    if (catalogTypes.length) {
      wrap.setAttribute("data-gc-ml-catalog-entity-types", JSON.stringify(catalogTypes));
    }
    var lblId = uid + "-ml-lbl";
    wrap.innerHTML =
      '<span class="gc-sr-only" id="' +
      escapeAttr(lblId) +
      '">Member lookup</span>' +
      '<div class="gc-designer-dd__shell">' +
      '<button type="button" class="settings-form__input gc-designer-dd__trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="' +
      escapeAttr(lblId) +
      '">' +
      (multi ? "None selected" : "Choose…") +
      "</button>" +
      '<div class="gc-designer-dd__panel" hidden>' +
      '<div class="gc-designer-dd__search-wrap">' +
      '<input type="search" class="settings-form__input mono gc-designer-dd__search" placeholder="Filter…" autocomplete="off" aria-label="Filter member lookup" />' +
      "</div>" +
      '<div class="gc-designer-member-lookup__toolbar">' +
      '<button type="button" class="btn btn--text gc-designer-member-lookup__select-all">Select all shown</button>' +
      "</div>" +
      '<ul class="gc-designer-dd__list' +
      (multi ? " gc-designer-dd__list--multi" : "") +
      '" role="listbox" ' +
      (multi ? 'aria-multiselectable="true" ' : "") +
      'aria-label="Cached object names"></ul></div></div>' +
      '<p class="gc-sr-only" id="' +
      escapeAttr(uid + "-ml-status") +
      '" aria-live="polite"></p>';
    var RT = (window.__gcDesignerControlsBridge || {}).ddFieldRuntime;
    var CF = (window.__gcDesignerControlsBridge || {}).catalogFieldUi || {};
    if (RT) {
      var fs = RT.designerDdSourceFs(wrap);
      if (fs && props.source) RT.restoreMemberLookupSourceFsCatalog(fs, props.source);
      RT.wireSearchableDropdown(wrap);
      RT.bindMemberLookupAutoReload(wrap);
      setTimeout(function () {
        RT.loadMemberLookupFromCache(wrap, RT.memberLookupStatusElement(wrap), true);
        if (multi) {
          if (props.selection != null && typeof CF.ddSetMultiSelection === "function") {
            CF.ddSetMultiSelection(wrap, props.selection);
          }
        } else {
          if (props.selection && props.selection.value != null && typeof CF.ddSetSingleSelection === "function") {
            CF.ddSetSingleSelection(wrap, props.selection.value);
          } else if (props.selectedValue != null && typeof CF.ddSetSingleSelection === "function") {
            CF.ddSetSingleSelection(wrap, props.selectedValue);
          }
        }
      }, 0);
    }
    return wrap;
  }

  function buildDropdown(props, fieldId, multi, field) {
    var uid = "gc-obj-edit-dd-" + fieldId;
    var wrap = document.createElement("div");
    wrap.className = "gc-designer-dd" + (multi ? " gc-designer-dd--multi" : "");
    wrap.id = uid;
    wrap.setAttribute("data-gc-designer-dd", "");
    wrap.setAttribute("data-gc-object-edit-dd", "1");
    var etypes = field ? catalogDataSourceEntityTypes(field) : [];
    if (etypes.length) {
      wrap.setAttribute("data-gc-dd-entity-types", JSON.stringify(etypes));
    } else {
      wrap.setAttribute("data-gc-dd-entity-types", JSON.stringify(["ip_host"]));
    }
    var lblId = uid + "-ddl";
    wrap.innerHTML =
      '<span class="gc-sr-only" id="' +
      escapeAttr(lblId) +
      '">Cached objects</span>' +
      '<div class="gc-designer-dd__shell">' +
      '<button type="button" class="settings-form__input gc-designer-dd__trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="' +
      escapeAttr(lblId) +
      '">' +
      (multi ? "None selected" : "Choose…") +
      "</button>" +
      '<div class="gc-designer-dd__panel" hidden>' +
      '<div class="gc-designer-dd__search-wrap">' +
      '<input type="search" class="settings-form__input mono gc-designer-dd__search" placeholder="Filter…" autocomplete="off" aria-label="Filter options" />' +
      "</div>" +
      '<ul class="gc-designer-dd__list' +
      (multi ? " gc-designer-dd__list--multi" : "") +
      '" role="listbox" ' +
      (multi ? 'aria-multiselectable="true" ' : "") +
      'aria-label="Cached objects"></ul></div></div>' +
      '<p class="gc-sr-only" id="' +
      escapeAttr(uid + "-dd-status") +
      '" aria-live="polite"></p>';
    var RT = (window.__gcDesignerControlsBridge || {}).ddFieldRuntime;
    var CF = (window.__gcDesignerControlsBridge || {}).catalogFieldUi || {};
    if (RT) {
      var fs = RT.designerDdSourceFs(wrap);
      if (fs && props.source) RT.restoreDdSourceFs(fs, props.source);
      RT.wireSearchableDropdown(wrap);
      RT.bindDesignerDdAutoLoad(wrap, uid + "-dd-status");
      setTimeout(function () {
        RT.loadDesignerDdFromCache(wrap, document.getElementById(uid + "-dd-status"), true);
        if (multi) {
          if (props.selection != null && typeof CF.ddSetMultiSelection === "function") {
            CF.ddSetMultiSelection(wrap, props.selection);
          }
        } else {
          if (props.selection && props.selection.value != null && typeof CF.ddSetSingleSelection === "function") {
            CF.ddSetSingleSelection(wrap, props.selection.value);
          } else if (props.selectedValue != null && typeof CF.ddSetSingleSelection === "function") {
            CF.ddSetSingleSelection(wrap, props.selectedValue);
          }
        }
      }, 0);
    }
    return wrap;
  }

  function buildControlForType(detRaw, props, field) {
    if (isSkippableDataEntryType(detRaw)) return null;
    var det = trimStr(detRaw).toLowerCase();
    switch (det) {
      case "hidden":
        return null;
      case "text-single":
        return buildTextSingle(props);
      case "text-multiline":
        return buildTextMultiline(props);
      case "text-config":
        return buildTextConfig(props);
      case "selector":
        return buildSelector(props, field.id);
      case "tag-editor":
        return buildTagEditor(props, field.id);
      case "ip-address": {
        var wireFam = ipFamilyFromProps(props);
        return buildIpField(props, wireFam, field.id);
      }
      case "ip-list":
        return buildIpListField(props, field.id);
      case "ip-ipv4":
        return buildIpField(props, "ipv4", field.id);
      case "ip-ipv6":
        return buildIpField(props, "ipv6", field.id);
      case "dropdown-single":
        return buildDropdown(props, field.id, false, field);
      case "dropdown-multi":
        return buildDropdown(props, field.id, true, field);
      case "member-lookup":
        return buildMemberLookup(props, field.id, field);
      case "ip-constraint":
      case "edit-flyout":
      case "tag-save":
      case "dropdown-shared":
      default:
        return buildDefaultText(props);
    }
  }

  function buildRowValueLookup(catalogHydrateOpts) {
    var cells =
      catalogHydrateOpts &&
      catalogHydrateOpts.cells &&
      typeof catalogHydrateOpts.cells === "object"
        ? catalogHydrateOpts.cells
        : null;
    var flat =
      catalogHydrateOpts &&
      catalogHydrateOpts.flat &&
      typeof catalogHydrateOpts.flat === "object"
        ? catalogHydrateOpts.flat
        : null;
    return function valueForProperty(propertyName) {
      var p = trimStr(propertyName);
      if (!p) return null;
      function fromMap(map) {
        if (!map) return null;
        if (!Object.prototype.hasOwnProperty.call(map, p)) return null;
        var v = map[p];
        if (v == null) return null;
        return String(v);
      }
      var hit = fromMap(cells);
      if (hit != null) return hit;
      hit = fromMap(flat);
      if (hit != null) return hit;
      var leaf = p.indexOf(".") >= 0 ? p.slice(p.lastIndexOf(".") + 1) : p;
      if (leaf === "Name" || p === "Name") {
        if (cells && Object.prototype.hasOwnProperty.call(cells, "__name")) {
          var cn = cells.__name;
          if (cn != null) return String(cn);
        }
        if (flat && Object.prototype.hasOwnProperty.call(flat, "Name")) {
          var fn = flat.Name;
          if (fn != null) return String(fn);
        }
      }
      return null;
    };
  }

  function applyObjectEditCatalogRowValues(fieldsEl, valueForProperty) {
    if (!fieldsEl || typeof valueForProperty !== "function") return;
    var CF = (window.__gcDesignerControlsBridge || {}).catalogFieldUi;
    fieldsEl.querySelectorAll(".gc-designer-object-edit-catalog-row").forEach(function (rowEl) {
      var prop = rowEl.getAttribute("data-gc-catalog-property") || "";
      if (!trimStr(prop)) return;
      var val = valueForProperty(prop);
      if (val == null) return;
      var sval = String(val);

      var ipList = rowEl.querySelector("[data-gc-ip-list]");
      if (ipList && typeof ipList.gcSetIpListValue === "function") {
        ipList.gcSetIpListValue(sval);
        return;
      }

      var ipInp = rowEl.querySelector("input.gc-ip-field__input");
      if (ipInp) {
        ipInp.value = sval;
        try {
          ipInp.dispatchEvent(new Event("input", { bubbles: true }));
          ipInp.dispatchEvent(new Event("blur"));
        } catch (eIp) {}
        return;
      }

      var ta = rowEl.querySelector("textarea.settings-form__input");
      if (ta) {
        ta.value = sval;
        return;
      }

      var inp = rowEl.querySelector("input.settings-form__input:not([type=\"hidden\"])");
      if (inp && inp.type !== "checkbox" && inp.type !== "radio") {
        inp.value = sval;
        return;
      }

      var optSel = rowEl.querySelector("[data-gc-option-selector]");
      if (optSel && window.gcOptionSelectorSetSelection) {
        window.gcOptionSelectorSetSelection(optSel, sval, NaN);
        if (typeof globalThis.gcOptionSelectorSyncLayout === "function") {
          globalThis.gcOptionSelectorSyncLayout(optSel);
        }
        return;
      }

      var tagRoot = rowEl.querySelector("[data-gc-designer-tag-editor]");
      if (tagRoot) {
        var api = tagRoot._gcDesignerTagApi;
        if (api && api.setTags) {
          var tags =
            sval.indexOf("\x1e") >= 0
              ? sval
                  .split("\x1e")
                  .map(function (x) {
                    return trimStr(x);
                  })
                  .filter(Boolean)
              : sval
                  .split(/[;,]/)
                  .map(function (x) {
                    return trimStr(x);
                  })
                  .filter(Boolean);
          if (tags.length) api.setTags(tags);
        }
        return;
      }

      var dd = rowEl.querySelector("[data-gc-designer-dd]");
      if (dd && CF && CF.ddSetSingleSelection) {
        setTimeout(function () {
          try {
            CF.ddSetSingleSelection(dd, sval);
          } catch (eDd) {}
        }, 120);
      }
    });
  }

  function renderFields(container, statusEl, fields) {
    container.innerHTML = "";
    var visible = 0;
    (fields || []).forEach(function (f) {
      var det = f.data_entry_type != null ? String(f.data_entry_type) : "";
      if (isSkippableDataEntryType(det)) return;
      var props = parsePropsJson(f.data_entry_properties);
      var detLower = trimStr(det).toLowerCase();
      if (detLower === "selector" && f.allowed_options && Array.isArray(f.allowed_options)) {
        var ao = [];
        f.allowed_options.forEach(function (x) {
          var t = String(x != null ? x : "").trim();
          if (t) ao.push(t);
        });
        if (ao.length) props.items = ao;
      }
      var label =
        f.show_as != null && trimStr(f.show_as) !== ""
          ? trimStr(f.show_as)
          : f.property_name != null
            ? String(f.property_name)
            : "Field";
      var help = f.help_text != null ? String(f.help_text) : "";
      var ctrl = buildControlForType(det, props, f);
      if (!ctrl) return;
      var row = document.createElement("div");
      row.className = "settings-form__field gc-designer-object-edit-catalog-row";
      row.setAttribute("data-gc-catalog-property", f.property_name != null ? String(f.property_name) : "");
      row.setAttribute("data-gc-catalog-field-id", f.id != null ? String(f.id) : "");
      row.appendChild(buildLabelRow(label, help));
      row.appendChild(ctrl);
      container.appendChild(row);
      visible++;
    });
    if (statusEl) {
      if (!visible) {
        statusEl.textContent =
          "No visible fields for this type (all Hidden or empty catalog). Run config sync and use Data Controls to map fields.";
        statusEl.hidden = false;
      } else {
        statusEl.textContent = "";
        statusEl.hidden = true;
      }
    }
    notifyObjectEditCatalogVisibleFieldCount(visible);
  }

  var hydrateObjectEditCatalogSeq = 0;
  var objectEditSelectorReevalWired = false;

  function reevalObjectEditLayoutFromCurrentInputs() {
    var st = globalThis.__gcObjectEditFlyoutState;
    var fieldsEl = document.getElementById("gc-designer-object-edit-catalog-fields");
    if (
      !st ||
      !st.nodeCatalog ||
      !st.connections ||
      !fieldsEl ||
      typeof globalThis.gcDcLayoutReevalObjectEditCatalogFromDom !== "function"
    ) {
      return;
    }
    var fieldList = st.allFields && st.allFields.length ? st.allFields : st.fields;
    globalThis.gcDcLayoutReevalObjectEditCatalogFromDom(
      st.nodeCatalog,
      st.connections,
      fieldList,
      st.row && typeof st.row === "object" ? st.row : {},
      fieldsEl,
    );
    notifyObjectEditCatalogVisibleFieldCount(countVisibleCatalogRows());
  }

  function wireObjectEditSelectorReeval() {
    if (objectEditSelectorReevalWired) return;
    objectEditSelectorReevalWired = true;

    document.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".gc-option-selector__btn") : null;
      if (!btn) return;
      var host = document.getElementById("gc-designer-object-edit-catalog-fields");
      if (!host || !host.contains(btn)) return;
      // Option selector pills are toggled by delegated document click handling;
      // run after that mutation so flow reads the latest selected pill.
      setTimeout(reevalObjectEditLayoutFromCurrentInputs, 0);
    });

    document.addEventListener("change", function (ev) {
      var sel =
        ev.target && ev.target.closest
          ? ev.target.closest("select.gc-option-selector__native")
          : null;
      if (!sel) return;
      var host = document.getElementById("gc-designer-object-edit-catalog-fields");
      if (!host || !host.contains(sel)) return;
      reevalObjectEditLayoutFromCurrentInputs();
    });
  }

  function hydrateObjectEditCatalogFields(entityTypeOverride, catalogHydrateOpts) {
    var host = document.getElementById("gc-designer-object-edit-catalog-host");
    var fieldsEl = document.getElementById("gc-designer-object-edit-catalog-fields");
    var statusEl = document.getElementById("gc-designer-object-edit-catalog-status");
    var etIn = document.getElementById("gc-designer-modals-prop-object-edit-entity-type");
    if (!host || !fieldsEl) return;
    var ov = trimStr(entityTypeOverride);
    var et = ov !== "" ? ov : etIn ? trimStr(etIn.value) : "";
    hideHelpPopover();
    if (!et) {
      host.hidden = true;
      fieldsEl.innerHTML = "";
      globalThis.__gcObjectEditFlyoutState = null;
      if (statusEl) {
        statusEl.textContent = "";
        statusEl.hidden = true;
      }
      notifyObjectEditCatalogVisibleFieldCount(0);
      return;
    }
    if (!ENTITY_TYPE_RE.test(et)) {
      host.hidden = false;
      fieldsEl.innerHTML = "";
      if (statusEl) {
        statusEl.textContent =
          "Object type must match API pattern (letter + up to 31 letters, digits, underscore) to load the catalog.";
        statusEl.hidden = false;
      }
      notifyObjectEditCatalogVisibleFieldCount(0);
      return;
    }
    host.hidden = false;
    fieldsEl.innerHTML = "";
    if (statusEl) {
      statusEl.textContent = "Loading field catalog…";
      statusEl.hidden = false;
    }
    notifyObjectEditCatalogVisibleFieldCount(0);
    var seq = ++hydrateObjectEditCatalogSeq;
    var fieldsUrl = "/api/firewalls/config-ui/entity-payload-fields/" + encodeURIComponent(et);
    var layoutUrl = "/api/firewalls/config-ui/data-controls-layout/" + encodeURIComponent(et);
    function fetchJsonOk(url) {
      return fetch(url, {
        credentials: "same-origin",
        headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .catch(function () {
          return { ok: false, j: {} };
        });
    }
    Promise.all([fetchJsonOk(fieldsUrl), fetchJsonOk(layoutUrl)])
      .then(function (pair) {
        if (seq !== hydrateObjectEditCatalogSeq) return;
        var xf = pair[0];
        var xl = pair[1];
        if (!xf.ok || !xf.j || !Array.isArray(xf.j.fields)) {
          if (statusEl) {
            var msg = "Could not load catalog for this type.";
            var d = xf.j && xf.j.detail;
            if (typeof d === "string") msg = d;
            else if (Array.isArray(d) && d[0] && d[0].msg) msg = String(d[0].msg);
            statusEl.textContent = msg;
            statusEl.hidden = false;
          }
          globalThis.__gcObjectEditFlyoutState = null;
          notifyObjectEditCatalogVisibleFieldCount(0);
          return;
        }
        var layoutJson =
          xl && xl.ok && xl.j && xl.j.layout && typeof xl.j.layout === "object" ? xl.j.layout : {};
        var pack =
          typeof globalThis.gcDcLayoutOrderedFieldsForFlyout === "function"
            ? globalThis.gcDcLayoutOrderedFieldsForFlyout(xf.j.fields, layoutJson)
            : {
                fields: xf.j.fields,
                connections: [],
                nodeCatalog: {},
              };
        globalThis.__gcObjectEditFlyoutState = {
          entityType: et,
          fields: pack.fields,
          allFields: xf.j.fields,
          layout: layoutJson,
          connections: pack.connections,
          nodeCatalog: pack.nodeCatalog,
          row:
            catalogHydrateOpts && catalogHydrateOpts.row && typeof catalogHydrateOpts.row === "object"
              ? catalogHydrateOpts.row
              : null,
        };
        renderFields(fieldsEl, statusEl, pack.fields);
        var rowForFlow =
          catalogHydrateOpts && catalogHydrateOpts.row && typeof catalogHydrateOpts.row === "object"
            ? catalogHydrateOpts.row
            : {};
        if (!rowForFlow.cells && !rowForFlow.flat && catalogHydrateOpts) {
          rowForFlow = {
            cells: catalogHydrateOpts.cells && typeof catalogHydrateOpts.cells === "object"
              ? catalogHydrateOpts.cells
              : {},
            flat: catalogHydrateOpts.flat && typeof catalogHydrateOpts.flat === "object"
              ? catalogHydrateOpts.flat
              : {},
          };
        }
        function applyLayoutFlowFromRow() {
          if (
            typeof globalThis.gcDcLayoutComputeFlowFromRow !== "function" ||
            typeof globalThis.gcDcLayoutApplyToObjectEditCatalog !== "function" ||
            !pack.nodeCatalog ||
            !Object.keys(pack.nodeCatalog).length
          ) {
            return;
          }
          var flow = globalThis.gcDcLayoutComputeFlowFromRow(
            pack.nodeCatalog,
            pack.connections,
            xf.j.fields,
            rowForFlow,
          );
          globalThis.gcDcLayoutApplyToObjectEditCatalog(flow, xf.j.fields);
          notifyObjectEditCatalogVisibleFieldCount(countVisibleCatalogRows());
        }
        if (
          catalogHydrateOpts &&
          (catalogHydrateOpts.cells || catalogHydrateOpts.flat)
        ) {
          var lookup = buildRowValueLookup(catalogHydrateOpts);
          applyObjectEditCatalogRowValues(fieldsEl, lookup);
          setTimeout(function () {
            if (seq !== hydrateObjectEditCatalogSeq) return;
            applyObjectEditCatalogRowValues(fieldsEl, lookup);
            applyLayoutFlowFromRow();
          }, 180);
        } else {
          applyLayoutFlowFromRow();
        }
      })
      .catch(function () {
        if (seq !== hydrateObjectEditCatalogSeq) return;
        if (statusEl) {
          statusEl.textContent = "Network error loading catalog.";
          statusEl.hidden = false;
        }
        globalThis.__gcObjectEditFlyoutState = null;
        notifyObjectEditCatalogVisibleFieldCount(0);
      });
  }

  globalThis.gcDesignerHydrateObjectEditCatalogFields = hydrateObjectEditCatalogFields;
  wireObjectEditSelectorReeval();

  globalThis.gcDesignerObjectEditFlyoutCollectSave = function () {
    var st = globalThis.__gcObjectEditFlyoutState;
    var fieldsEl = document.getElementById("gc-designer-object-edit-catalog-fields");
    if (
      !st ||
      !st.nodeCatalog ||
      !st.connections ||
      !fieldsEl ||
      typeof globalThis.gcDcLayoutBuildSavePayload !== "function"
    ) {
      return {
        entity_type: st && st.entityType ? st.entityType : "",
        properties: {},
        row: st && st.row ? st.row : null,
      };
    }
    var fieldList = st.allFields && st.allFields.length ? st.allFields : st.fields;
    var save = globalThis.gcDcLayoutBuildSavePayload(
      st.nodeCatalog,
      st.connections,
      fieldList,
      fieldsEl,
    );
    return {
      entity_type: st.entityType || "",
      properties: save.properties || {},
      row: st.row || null,
    };
  };
})();
