/**
 * One network config table (interfaces / VLANs / zones): facets, search, column picker, fetch.
 * @param {object} cfg
 * @param {string} cfg.prefix - ID prefix e.g. "gc-net-if"
 * @param {string} cfg.apiUrl
 * @param {string} cfg.lsKey - localStorage key for column visibility
 * @param {string} cfg.dataRowClass - e.g. "gc-net-if-data-row"
 * @param {string} cfg.colPickerAttr - data attribute on col checkboxes e.g. "data-gc-net-if-col"
 * @param {object} cfg.labels
 * @param {string} cfg.labels.countSingular
 * @param {string} cfg.labels.countPlural
 * @param {string} cfg.labels.emptyCache
 * @param {string} cfg.labels.emptyFilter
 * @param {string} cfg.labels.loadError
 * @param {boolean} [cfg.zoneAsPill] - render __zone column as colored pills (interfaces / VLANs)
 * @param {boolean} [cfg.interfaceStatusColumnVisual] - interfaces tab: rich __status (toggle / ethernet icons)
 * @param {boolean} [cfg.hardwarePortPills] - interfaces tab: __hardware port names as colored pills
 * @param {boolean} [cfg.nameAsZonePill] - render __name column as colored pills (zones tab)
 * @param {boolean} [cfg.rowClickable] - if true, rows are clickable and store row payload on the tr
 * @param {function(HTMLElement): void} [cfg.onRowClick] - called with tr (use tr._gcNetRow)
 * @param {function(object): void} [cfg.afterRenderFromApi] - called after table body built from API payload
 * @param {{ inputId: string, param: string }} [cfg.combineQuery] - append boolean query param from checkbox
 * @param {{ strategy: string, hsCreatesBatchUrl?: string, ipHostCreateBatchUrl?: string, createUrl?: string, profileCreateBatchUrl?: string, profileEntityType?: string, zoneFirewallCreateBatchUrl?: string, zoneConfigurationCreateBatchUrl?: string, resolveScopeIds?: function(): number[] }} [cfg.combineSyncSelected] - combined-view "Sync selected" toolbar button (see gc-combined-view-table skill). Zones: strategy `zone_create_batch`, batch URLs, optional `resolveScopeIds` when firewall + configuration scopes are both selected (Firewalls · Network).
 * @param {string} [cfg.combineConflictRowKey] - row property that is true when merged scopes disagree (if not `*_combine_conflict`)
 * @param {string[]} [cfg.combineConflictRowKeys] - additional row boolean keys for the circled-exclamation beside the row checkbox
 * @param {string} [cfg.rowAriaEntitySingular] - e.g. "IP host" for aria-label on clickable rows
 * @param {string} [cfg.apiEntityType] - appended as entity_type= for hosts/services multi-entity endpoints
 * @param {{ excludeSystemStorageKey: string, excludeSystemDefault?: boolean, bulkRowSelect?: boolean }} [cfg.ipHostTable] - IP host: lock column, exclude-system facet, row filter, optional row checkboxes
 * @param {boolean} [cfg.bulkRowSelect] - Row checkboxes + select-all (without ipHostTable extras)
 * @param {boolean} [cfg.bulkSelectCheckedByDefault] - When bulkRowSelect: new rows get checked checkboxes (e.g. IPS policy delete selection)
 * @param {function(object): boolean} [cfg.bulkSelectDisableRow] - When bulkRowSelect: return true to disable a row's checkbox (e.g. non-deletable entity_type)
 * @param {string} [cfg.bulkSelectDisableHint] - When bulkSelectDisableRow disables a row: title and aria-label (default: delete-table wording)
 * @param {function(object): boolean} [cfg.bulkDeleteRowFilter] - When gathering delete ids: return false to skip a checked row
 * @param {boolean} [cfg.entityTypeQuickFilter] - Toolbar quick type nav; drives Type (__type) facet checkboxes
 * @param {boolean} [cfg.interfaceZonePresenceFacet] - Interfaces tab: Zone facet with "Is None" / "Is NOT None" (default: NOT None only)
 * @param {boolean} [cfg.rowPayloadOnly] - If true, attach tr._gcNetRow without making rows clickable (for bulk actions)
 * @param {string[]} [cfg.interactiveBoolColIds] - Column ids whose bool cell is a button (e.g. IPS status toggle)
 * @param {string} [cfg.interactiveBoolTitle] - Native tooltip (title) on interactive bool toggle buttons
 * @param {string[]} [cfg.actionButtonColIds] - Column ids rendered as a "Configure" button (data-gc-action-col)
 * @param {boolean} [cfg.actionButtonPrimary] - If true, use primary button style instead of secondary
 * @param {Object<string, { rowKey: string, toggleTitle?: string }>} [cfg.actionButtonPreToggleByCol] - Before Configure, render a row-backed toggle (row[rowKey] boolean)
 * @param {function(): void} [cfg.onBulkSelectionChange] - After row checkbox / select-all changes (bulkRowSelect tables)
 * @param {string[]} [cfg.pageSyncExtraEntities] - Config-sync entity ids merged into each toolbar sync job (e.g. dos_settings, spoof_prevention with ips_switch)
 * @param {string[]} [cfg.pageSyncFallbackEntities] - When a selected firewall has no visible row-derived entity types, sync these catalog ids (e.g. multi-type Interfaces tab)
 * @param {string[]} [cfg.noBoolToggleColIds] - Column ids where "0"/"1" (and similar) are shown as plain text, not static on/off toggles (e.g. numeric __rules counts)
 * @param {string[]} [cfg.valuePillColIds] - Column ids rendered as a single gc-table-value-pill (e.g. default action labels)
 */

function gcEscapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Hue 0–359 from label string; same algorithm for table pills and combine modals. */
function gcScopeLabelHue(name) {
  var s = String(name || "");
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/**
 * Scope label (firewall name, etc.) as a gc-zone-pill — same markup as the combined-view __firewalls column.
 * Use in page-specific combine modal HTML so colors and single-line ellipsis match the table.
 */
function gcFirewallScopePillHtml(name) {
  var z = String(name == null ? "" : name).trim();
  if (!z) return "";
  var online = null;
  if (typeof window !== "undefined" && typeof window.gcGetFirewallOnlineByLabel === "function") {
    online = window.gcGetFirewallOnlineByLabel(z);
  }
  var onlineKnown = online === true || online === false;
  var statusClass = online === true ? "gc-firewall-pill-status--online" : "gc-firewall-pill-status--offline";
  var statusLabel = online === true ? "online" : "offline";
  var statusHtml = onlineKnown
    ? '<span class="gc-firewall-pill-status ' +
      statusClass +
      '" role="img" aria-label="Firewall ' +
      statusLabel +
      '">' +
      (online === true ? "&#10003;" : "-") +
      "</span>"
    : "";
  return (
    '<span class="gc-zone-pill gc-firewall-pill" style="--gc-zone-h:' +
    gcScopeLabelHue(z) +
    '">' +
    statusHtml +
    gcEscapeHtml(z) +
    "</span>"
  );
}

if (typeof window !== "undefined") {
  window.gcScopeLabelHue = gcScopeLabelHue;
  window.gcFirewallScopePillHtml = gcFirewallScopePillHtml;
}

var GC_ROW_COMBINE_DIFF_MODAL_ID = "gc-row-combine-diff-modal";

/** Per-column map of scope label → display value (same shape as toolbar “compare” modals). */
function gcNormalizeCombinePerFieldMap(row) {
  if (!row || typeof row !== "object") return null;
  if (typeof window.gcExtractCombinePerFieldMap === "function") {
    var ext = window.gcExtractCombinePerFieldMap(row);
    if (ext && typeof ext === "object" && Object.keys(ext).length) return ext;
  }
  if (row.access_per_firewall && typeof row.access_per_firewall === "object") {
    var ap = row.access_per_firewall;
    if (Object.keys(ap).length) return ap;
  }
  var rk;
  for (rk in row) {
    if (!Object.prototype.hasOwnProperty.call(row, rk)) continue;
    if (!/_combine_per_field$/.test(rk)) continue;
    var o = row[rk];
    if (o && typeof o === "object" && Object.keys(o).length) return o;
  }
  return null;
}

function gcCombineDiffModalBoolTri(val) {
  var s = String(val == null ? "" : val)
    .trim()
    .toLowerCase();
  if (s === "") return null;
  if (
    s === "1" ||
    s === "true" ||
    s === "yes" ||
    s === "on" ||
    s === "enabled" ||
    s === "enable"
  ) {
    return true;
  }
  if (
    s === "0" ||
    s === "false" ||
    s === "no" ||
    s === "off" ||
    s === "disabled" ||
    s === "disable"
  ) {
    return false;
  }
  return null;
}

function gcCombineDiffModalToggleHtml(on) {
  var state = on ? "on" : "off";
  var lab = on ? "On" : "Off";
  return (
    '<span class="gc-table-toggle gc-table-toggle--static gc-table-toggle--' +
    state +
    '" role="img" aria-label="' +
    gcEscapeHtml(lab) +
    '"><span class="gc-table-toggle__track" aria-hidden="true"><span class="gc-table-toggle__thumb"></span></span></span>'
  );
}

function gcCombineDiffModalScalarHtml(val) {
  var s0 = String(val == null ? "" : val).trim();
  if (s0.length > 8000) s0 = s0.slice(0, 7999) + "…";
  return '<span class="gc-net-zone-modal__scalar">' + gcEscapeHtml(s0) + "</span>";
}

function gcCombineDiffModalValueHtml(val) {
  var tri = gcCombineDiffModalBoolTri(val);
  if (tri !== null) return gcCombineDiffModalToggleHtml(tri);
  var s = String(val == null ? "" : val).trim();
  if (s === "") return gcCombineDiffModalToggleHtml(false);
  return gcCombineDiffModalScalarHtml(val);
}

/**
 * HTML for one merged row’s scope/value breakdown (fields × firewalls).
 * @param {object} row - API row
 * @param {object} labelsMap - column_labels from the same payload
 */
function gcBuildRowCombineDiffBodyHtml(row, labelsMap) {
  var pf = gcNormalizeCombinePerFieldMap(row);
  var cells = row && row.cells;
  var hname = cells && cells.__name != null ? String(cells.__name) : "";
  if (!pf || typeof pf !== "object" || !Object.keys(pf).length) {
    return (
      '<p class="muted">No per-scope value breakdown is available for this row. If the toolbar combined-view control is available, use it to compare all conflicting rows.</p>'
    );
  }
  var labels = labelsMap && typeof labelsMap === "object" ? labelsMap : {};
  var colKeys = Object.keys(pf).sort();
  var parts =
    '<section class="gc-net-zone-modal__zone"><h3 class="gc-net-zone-modal__zn">' +
    gcEscapeHtml(hname || "—") +
    "</h3>";
  colKeys.forEach(function (colKey) {
    var per = pf[colKey];
    if (!per || typeof per !== "object") return;
    var lbl = labels[colKey] || colKey;
    parts +=
      '<h4 class="gc-net-zone-modal__col">' +
      gcEscapeHtml(String(lbl)).replace(/\n/g, "<br />") +
      "</h4>";
    parts += '<ul class="gc-net-zone-modal__fw-list">';
    Object.keys(per)
      .sort()
      .forEach(function (fw) {
        parts +=
          '<li class="gc-net-zone-modal__fw-row">' +
          gcFirewallScopePillHtml(fw) +
          '<span class="gc-net-zone-modal__fw-val">' +
          gcCombineDiffModalValueHtml(per[fw]) +
          "</span></li>";
      });
    parts += "</ul>";
  });
  parts += "</section>";
  return parts;
}

function gcEnsureRowCombineDiffModal() {
  var m = document.getElementById(GC_ROW_COMBINE_DIFF_MODAL_ID);
  if (m) return m;
  m = document.createElement("div");
  m.id = GC_ROW_COMBINE_DIFF_MODAL_ID;
  m.className = "gc-net-zone-combine-modal";
  m.hidden = true;
  m.setAttribute("aria-hidden", "true");
  m.innerHTML =
    '<div class="gc-net-zone-combine-modal__backdrop" tabindex="-1" aria-hidden="true"></div>' +
    '<div class="gc-net-zone-combine-modal__panel" role="dialog" aria-modal="true" aria-labelledby="' +
    GC_ROW_COMBINE_DIFF_MODAL_ID +
    '-title">' +
    '<header class="gc-net-zone-combine-modal__header">' +
    '<h2 id="' +
    GC_ROW_COMBINE_DIFF_MODAL_ID +
    '-title" class="gc-net-zone-combine-modal__title">Values differ by scope</h2>' +
    '<button type="button" class="gc-net-zone-combine-modal__close" aria-label="Close" title="Close">' +
    "<span aria-hidden=\"true\">×</span></button>" +
    "</header>" +
    '<div class="gc-net-zone-combine-modal__body"></div>' +
    '<footer class="gc-net-zone-combine-modal__footer">' +
    '<button type="button" class="btn btn--secondary" id="' +
    GC_ROW_COMBINE_DIFF_MODAL_ID +
    '-done">Close</button>' +
    "</footer>" +
    "</div>";
  document.body.appendChild(m);
  var bodyEl = m.querySelector(".gc-net-zone-combine-modal__body");
  var titleEl = m.querySelector("#" + GC_ROW_COMBINE_DIFF_MODAL_ID + "-title");
  function close() {
    m.hidden = true;
    m.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  function open(row, labelsMap) {
    if (!bodyEl) return;
    var cells = row && row.cells;
    var hname = cells && cells.__name != null ? String(cells.__name).trim() : "";
    if (titleEl) {
      titleEl.textContent = hname ? "Scope differences — " + hname : "Scope differences";
    }
    bodyEl.innerHTML = gcBuildRowCombineDiffBodyHtml(row, labelsMap);
    m.hidden = false;
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var closeBtn = m.querySelector(".gc-net-zone-combine-modal__close");
    if (closeBtn) closeBtn.focus();
  }
  m._gcOpen = open;
  m._gcClose = close;
  m.querySelector(".gc-net-zone-combine-modal__backdrop").addEventListener("click", close);
  m.querySelector(".gc-net-zone-combine-modal__close").addEventListener("click", close);
  m.querySelector("#" + GC_ROW_COMBINE_DIFF_MODAL_ID + "-done").addEventListener("click", close);
  m.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  return m;
}

function gcOpenRowCombineDiffModal(row, labelsMap) {
  var m = gcEnsureRowCombineDiffModal();
  if (m && typeof m._gcOpen === "function") m._gcOpen(row, labelsMap || {});
}

if (typeof window !== "undefined") {
  window.gcOpenRowCombineDiffModal = gcOpenRowCombineDiffModal;
}

function gcCreateNetworkEntityTable(cfg) {
  "use strict";

  var prefix = cfg.prefix;
  var apiUrl = cfg.apiUrl;
  var lsKey = cfg.lsKey;
  var dataRowClass = cfg.dataRowClass;
  var colPickerAttr = cfg.colPickerAttr;
  var L = cfg.labels;
  var rowClickable = !!cfg.rowClickable;
  var rowPayloadOnly = !!cfg.rowPayloadOnly;
  var interactiveBoolColIds =
    Array.isArray(cfg.interactiveBoolColIds) && cfg.interactiveBoolColIds.length
      ? cfg.interactiveBoolColIds.map(function (x) {
        return String(x || "").trim();
      })
      : [];
  var interactiveBoolColSet = {};
  interactiveBoolColIds.forEach(function (id) {
    if (id) interactiveBoolColSet[id] = true;
  });
  var interactiveBoolTitle =
    typeof cfg.interactiveBoolTitle === "string" && cfg.interactiveBoolTitle.trim()
      ? cfg.interactiveBoolTitle.trim()
      : "";
  var actionButtonColIds =
    Array.isArray(cfg.actionButtonColIds) && cfg.actionButtonColIds.length
      ? cfg.actionButtonColIds.map(function (x) {
        return String(x || "").trim();
      })
      : [];
  var actionButtonColSet = {};
  actionButtonColIds.forEach(function (id) {
    if (id) actionButtonColSet[id] = true;
  });
  var actionButtonPrimary = !!cfg.actionButtonPrimary;
  var actionButtonPreToggleByCol =
    cfg.actionButtonPreToggleByCol && typeof cfg.actionButtonPreToggleByCol === "object"
      ? cfg.actionButtonPreToggleByCol
      : {};
  var onRowClick = typeof cfg.onRowClick === "function" ? cfg.onRowClick : null;
  var onBulkSelectionChange =
    typeof cfg.onBulkSelectionChange === "function" ? cfg.onBulkSelectionChange : null;
  var zoneAsPill = !!cfg.zoneAsPill;
  var nameAsZonePill = !!cfg.nameAsZonePill;
  var interfaceStatusColumnVisual = !!cfg.interfaceStatusColumnVisual;
  var hardwarePortPills = !!cfg.hardwarePortPills;
  var noBoolToggleColIds =
    Array.isArray(cfg.noBoolToggleColIds) && cfg.noBoolToggleColIds.length
      ? cfg.noBoolToggleColIds.map(function (x) {
        return String(x || "").trim();
      }).filter(Boolean)
      : [];
  var noBoolToggleColSet = {};
  noBoolToggleColIds.forEach(function (id) {
    if (id) noBoolToggleColSet[id] = true;
  });
  var valuePillColIds =
    Array.isArray(cfg.valuePillColIds) && cfg.valuePillColIds.length
      ? cfg.valuePillColIds.map(function (x) {
        return String(x || "").trim();
      }).filter(Boolean)
      : [];
  var valuePillColSet = {};
  valuePillColIds.forEach(function (id) {
    if (id) valuePillColSet[id] = true;
  });
  var afterRenderFromApi = typeof cfg.afterRenderFromApi === "function" ? cfg.afterRenderFromApi : null;
  var combineQuery = cfg.combineQuery || null;
  if (combineQuery && combineQuery.param && !combineQuery.inputId) {
    combineQuery.inputId = prefix + "-combine";
  }
  var combineConflictRowKey =
    typeof cfg.combineConflictRowKey === "string" && cfg.combineConflictRowKey.trim()
      ? cfg.combineConflictRowKey.trim()
      : "";
  var combineConflictRowKeys =
    Array.isArray(cfg.combineConflictRowKeys) && cfg.combineConflictRowKeys.length
      ? cfg.combineConflictRowKeys
          .map(function (x) {
            return String(x || "").trim();
          })
          .filter(Boolean)
      : [];
  var combineSyncSelectedCfg =
    cfg.combineSyncSelected && typeof cfg.combineSyncSelected === "object"
      ? cfg.combineSyncSelected
      : null;
  /** Latest `column_labels` from API; used when opening per-row combine diff from the ! icon. */
  var lastApiColumnLabels = {};
  var rowAriaEntitySingular =
    typeof cfg.rowAriaEntitySingular === "string" && cfg.rowAriaEntitySingular.trim()
      ? cfg.rowAriaEntitySingular.trim()
      : "interface";
  var apiEntityType =
    typeof cfg.apiEntityType === "string" && cfg.apiEntityType.trim() ? cfg.apiEntityType.trim() : "";
  var ipHostTable =
    cfg.ipHostTable &&
      typeof cfg.ipHostTable.excludeSystemStorageKey === "string" &&
      cfg.ipHostTable.excludeSystemStorageKey.trim()
      ? cfg.ipHostTable
      : null;
  var interfaceZonePresenceFacet = !!cfg.interfaceZonePresenceFacet;
  var COL_ZONE_PRESENCE = "__zone_presence";
  var bulkRowSelect =
    !!(ipHostTable && ipHostTable.bulkRowSelect) || !!cfg.bulkRowSelect;
  var bulkSelectCheckedByDefault = !!cfg.bulkSelectCheckedByDefault;
  var bulkSelectDisableRow =
    typeof cfg.bulkSelectDisableRow === "function" ? cfg.bulkSelectDisableRow : null;
  var bulkSelectDisableHint =
    typeof cfg.bulkSelectDisableHint === "string" && cfg.bulkSelectDisableHint.trim()
      ? cfg.bulkSelectDisableHint.trim()
      : "";
  var bulkDeleteRowFilter =
    typeof cfg.bulkDeleteRowFilter === "function" ? cfg.bulkDeleteRowFilter : null;
  var excludeSystemOn = true;
  if (ipHostTable) {
    excludeSystemOn = ipHostTable.excludeSystemDefault !== false;
    try {
      var rawEx = localStorage.getItem(ipHostTable.excludeSystemStorageKey);
      if (rawEx === "0") excludeSystemOn = false;
      else if (rawEx === "1") excludeSystemOn = true;
    } catch (e0) { }
  }

  var idsQueryParam = (cfg.idsQueryParam && String(cfg.idsQueryParam).trim()) || "firewall_ids";
  var emptySelectMsg =
    typeof cfg.emptySelectionMessage === "string" && cfg.emptySelectionMessage.trim()
      ? cfg.emptySelectionMessage.trim()
      : "Select one or more firewalls in the top bar.";
  var pageSyncExtraEntities =
    Array.isArray(cfg.pageSyncExtraEntities) && cfg.pageSyncExtraEntities.length
      ? cfg.pageSyncExtraEntities
        .map(function (x) {
          return String(x || "").trim();
        })
        .filter(Boolean)
      : [];
  var pageSyncFallbackEntities =
    Array.isArray(cfg.pageSyncFallbackEntities) && cfg.pageSyncFallbackEntities.length
      ? cfg.pageSyncFallbackEntities
        .map(function (x) {
          return String(x || "").trim();
        })
        .filter(Boolean)
      : [];

  var COL_ZONE = "__zone";
  var COL_ADDR = "__address_cidr";
  var COL_NAME = "__name";
  var COL_TYPE = "__type";
  var COL_STATUS = "__status";
  var COL_HARDWARE = "__hardware";
  var COL_FIREWALLS = "__firewalls";
  var COL_LOCK = "__lock";
  var COL_SELECT = "__row_select";

  function zonePresenceTouchStorageKey() {
    return "gc-if-zone-pres-touch:" + prefix;
  }

  /** Facet value for synthetic Zone presence filter (matches row facet map). */
  function rowZonePresenceFacetValue(zoneCell) {
    var s = zoneCell == null ? "" : String(zoneCell).trim();
    if (!s || s === "—") return "none";
    if (s.toLowerCase() === "none") return "none";
    return "not_none";
  }

  function augmentInterfaceFacetMap(fm, cells) {
    if (!interfaceZonePresenceFacet || !fm || !cells) return;
    fm[COL_ZONE_PRESENCE] = rowZonePresenceFacetValue(cells[COL_ZONE]);
  }

  function mountInterfaceZonePresenceFacet() {
    if (!interfaceZonePresenceFacet || !filtersDrawer) return;
    var bid = prefix + "-zone-presence-facet-wrap";
    var prev = document.getElementById(bid);
    if (prev) prev.remove();
    var wrap = document.createElement("div");
    wrap.id = bid;
    var encNone = encodeURIComponent("none");
    var encNot = encodeURIComponent("not_none");
    wrap.innerHTML =
      '<div class="filter-group" data-gc-facet-group data-gc-facet-for-col="' +
      COL_ZONE_PRESENCE +
      '">' +
      '<button type="button" class="filter-group__head" aria-expanded="false">' +
      "<span>Zone</span>" +
      '<span class="filter-group__chev" aria-hidden="true">▼</span>' +
      "</button>" +
      '<div class="filter-group__body">' +
      '<label class="filter-opt"><input type="checkbox" name="gc-facet-zp-none" value="' +
      encNone +
      '" data-gc-facet-enum="' +
      COL_ZONE_PRESENCE +
      '" /><span>Is None</span></label>' +
      '<label class="filter-opt"><input type="checkbox" name="gc-facet-zp-notnone" value="' +
      encNot +
      '" data-gc-facet-enum="' +
      COL_ZONE_PRESENCE +
      '" /><span>Is NOT None</span></label>' +
      "</div></div>";
    filtersDrawer.appendChild(wrap);
    if (window.gcTableFacets && window.gcTableFacets.bindNewFacetGroups) {
      window.gcTableFacets.bindNewFacetGroups(wrap, prefix);
    }
    wrap.addEventListener("change", function (e) {
      var t = e.target;
      if (
        t &&
        t.matches &&
        t.matches('input[data-gc-facet-enum="' + COL_ZONE_PRESENCE + '"]')
      ) {
        try {
          sessionStorage.setItem(zonePresenceTouchStorageKey(), "1");
        } catch (eZ) {}
      }
    });
  }

  function readFacetValuesStateRaw() {
    try {
      return sessionStorage.getItem("gc-facet-values:" + prefix);
    } catch (eR) {
      return null;
    }
  }

  function facetStateHasZonePresenceSelection() {
    var raw = readFacetValuesStateRaw();
    if (!raw) return false;
    try {
      var st = JSON.parse(raw);
      return !!(st && st.e && Array.isArray(st.e[COL_ZONE_PRESENCE]) && st.e[COL_ZONE_PRESENCE].length);
    } catch (eP) {
      return false;
    }
  }

  function applyInterfaceZonePresenceFacetDefaults(force) {
    if (!interfaceZonePresenceFacet || !filtersDrawer) return;
    var touched = false;
    try {
      touched = sessionStorage.getItem(zonePresenceTouchStorageKey()) === "1";
    } catch (eT) {}
    if (!force && (touched || facetStateHasZonePresenceSelection())) return;
    var encNot = encodeURIComponent("not_none");
    var encNone = encodeURIComponent("none");
    filtersDrawer.querySelectorAll('input[data-gc-facet-enum="' + COL_ZONE_PRESENCE + '"]').forEach(function (cb) {
      cb.checked = cb.value === encNot;
    });
    try {
      sessionStorage.setItem(zonePresenceTouchStorageKey(), "1");
    } catch (eS) {}
    if (window.gcTableFacets && window.gcTableFacets.persistFilterDrawerState) {
      window.gcTableFacets.persistFilterDrawerState(filtersDrawer, prefix);
    }
  }

  /** Combined hosts/services rows: firewall_labels (firewalls page) or configuration_labels (configurations page). */
  function rowScopeLabelsForFirewallPills(row) {
    var a = row.firewall_labels;
    if (Array.isArray(a) && a.length) return a;
    var b = row.configuration_labels;
    if (Array.isArray(b) && b.length) return b;
    return null;
  }

  var LOCK_ICON_SVG =
    '<svg class="gc-hs-lock-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>';

  /** Circled exclamation (merged-row field drift); keep in sync with combined-view skill. */
  var COMBINE_ROW_CONFLICT_ICON_SVG =
    '<svg class="gc-combine-row-conflict-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>';

  /** Circled question (merged row exists on a subset of selected scopes). */
  var COMBINE_ROW_PARTIAL_SCOPE_ICON_SVG =
    '<svg class="gc-combine-row-partial-scope-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>';

  /** Interfaces tab Address (CIDR): matches IPAM assignment on this firewall. */
  var IPAM_IF_CIDR_VERIFIED_SVG =
    '<svg class="gc-if-ipam-cidr-icon__svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
  /** Same-VRF overlap (IPAM / discovered), aligned with Address Management conflict flag. */
  var IPAM_IF_CIDR_CONFLICT_SVG =
    '<svg class="gc-if-ipam-cidr-icon__svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';

  var thead = document.getElementById(prefix + "-thead");
  var tbody = document.getElementById(prefix + "-tbody");
  var table = document.getElementById(prefix + "-table");
  var searchIn = document.getElementById(prefix + "-search");
  var countEl = document.getElementById(prefix + "-count");
  var filtersAside = document.getElementById(prefix + "-filters-aside");
  var filtersDrawer = document.getElementById(prefix + "-filters-drawer");

  var colsTrigger = document.getElementById(prefix + "-cols-trigger");
  var colsModal = document.getElementById(prefix + "-cols-modal");
  var colsPanel = document.getElementById(prefix + "-cols-panel");
  var colsFilter = document.getElementById(prefix + "-cols-filter");
  var colsList = document.getElementById(prefix + "-cols-list");
  var colsClose = document.getElementById(prefix + "-cols-close");

  var COLS = [];
  var colVis = {};
  var DEFAULT_VISIBLE_FROM_API = [];
  var tableRenderGen = 0;
  var lazyMountInProgress = false;
  var lazyMountTotalRows = 0;

  var entityTypeQuickFilterOn = !!cfg.entityTypeQuickFilter;
  var quickEntityMigrateKey =
    entityTypeQuickFilterOn && prefix ? "gc-quick-entity:" + prefix : null;
  var HS_MULTIVALUE_SEP = "\x1E";

  /** Hosts/services group tabs: flattened member column id → unified UI (pills, modal). */
  var HS_GROUP_MEMBER_COL = {
    ip_hostgroup: "HostList.Host",
    fqdn_hostgroup: "FQDNHostList.FQDNHost",
    service_group: "ServiceList.Service",
    country_group: "CountryList.Country",
  };

  /** Modal list item → open member entity flyout (country_group: pills/modal only, no row flyout). */
  var HS_GROUP_MEMBER_MODAL = {
    ip_hostgroup: {
      fn: "gcHsFlyoutOpenIpHostFromGroupMember",
      ariaPrefix: "Edit IP host",
    },
    fqdn_hostgroup: {
      fn: "gcHsFlyoutOpenFqdnHostFromGroupMember",
      ariaPrefix: "Edit FQDN host",
    },
    service_group: {
      fn: "gcHsFlyoutOpenServiceFromGroupMember",
      ariaPrefix: "Edit service",
    },
  };

  var ENTITY_QUICK_TO_TYPE_DISPLAY = {
    interface: "Interface",
    bridge_pair: "Bridge pair",
    lag: "LAG",
    vlan: "VLAN",
    alias: "Alias",
  };

  /** __type column shows interface icons only for network interface entity rows (not profile rows like schedule). */
  function rowEntityTypeUsesInterfaceTypeIcon(et) {
    return Object.prototype.hasOwnProperty.call(
      ENTITY_QUICK_TO_TYPE_DISPLAY,
      String(et || "").trim(),
    );
  }

  function colLabel(id, labelsMap) {
    var raw = labelsMap && labelsMap[id] ? labelsMap[id] : id;
    var out =
      typeof window.gcTableColumnDisplayLabel === "function"
        ? window.gcTableColumnDisplayLabel(raw)
        : raw;
    if (out == null || String(out).trim() === "") return String(id || "");
    return out;
  }

  /** Zones table: one line per word in <th> for readability (label uses spaces from API). */
  function zoneTableThLabelHtml(label) {
    var raw = String(label == null ? "" : label)
      .trim()
      .replace(/\s*\n\s*/g, " ");
    if (!raw) return "";
    var parts = raw.split(/\s+/).filter(function (p) {
      return p.length > 0;
    });
    if (parts.length <= 1) return gcEscapeHtml(raw);
    return parts.map(gcEscapeHtml).join("<br />");
  }

  function zoneColMenuLabelText(label) {
    return String(label == null ? "" : label)
      .trim()
      .replace(/\s*\n\s*/g, " ");
  }

  function loadColVis() {
    var d = {};
    COLS.forEach(function (c) {
      if (DEFAULT_VISIBLE_FROM_API.length > 0) {
        d[c.id] = DEFAULT_VISIBLE_FROM_API.indexOf(c.id) !== -1;
      } else {
        d[c.id] = true;
      }
    });
    try {
      var raw = localStorage.getItem(lsKey);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") {
          if (
            interfaceZonePresenceFacet &&
            Object.prototype.hasOwnProperty.call(o, "firewall") &&
            !Object.prototype.hasOwnProperty.call(o, "__firewalls")
          ) {
            o.__firewalls = o.firewall;
          }
          COLS.forEach(function (c) {
            if (Object.prototype.hasOwnProperty.call(o, c.id)) d[c.id] = !!o[c.id];
          });
        }
      }
    } catch (e) { }
    var visible = 0;
    COLS.forEach(function (c) {
      if (d[c.id]) visible++;
    });
    if (visible < 1 && COLS.length) d[COLS[0].id] = true;
    if (ipHostTable && Object.prototype.hasOwnProperty.call(d, COL_LOCK)) d[COL_LOCK] = true;
    if (bulkRowSelect) d[COL_SELECT] = true;
    return d;
  }

  function persistColVis(vis) {
    try {
      localStorage.setItem(lsKey, JSON.stringify(vis));
    } catch (e) { }
  }

  function applyColVis(vis) {
    if (!table) return;
    COLS.forEach(function (c) {
      var on = bulkRowSelect && c.id === COL_SELECT ? true : !!vis[c.id];
      table.querySelectorAll('[data-gc-col="' + c.id + '"]').forEach(function (el) {
        el.classList.toggle("gc-col-hidden", !on);
      });
    });
  }

  function syncPlaceholderColspan() {
    var n = table ? table.querySelectorAll("thead th").length : 1;
    var ph = document.getElementById(prefix + "-placeholder");
    var fe = document.getElementById(prefix + "-filter-empty");
    var ld = document.getElementById(prefix + "-loading");
    [ph, fe, ld].forEach(function (row) {
      if (!row) return;
      var cell = row.querySelector("td");
      if (cell) cell.setAttribute("colspan", String(Math.max(1, n)));
    });
  }

  function escapeHtml(s) {
    return gcEscapeHtml(s);
  }

  function zoneHue(name) {
    return gcScopeLabelHue(name);
  }

  function boolTriState(raw) {
    var s = String(raw == null ? "" : raw)
      .trim()
      .toLowerCase();
    if (s === "") return null;
    if (
      s === "1" ||
      s === "true" ||
      s === "yes" ||
      s === "on" ||
      s === "enabled" ||
      s === "enable"
    ) {
      return true;
    }
    if (
      s === "0" ||
      s === "false" ||
      s === "no" ||
      s === "off" ||
      s === "disabled" ||
      s === "disable"
    ) {
      return false;
    }
    return null;
  }

  function boolToggleHtml(on, ariaLabelFull, titleText) {
    var state = on ? "on" : "off";
    var lab =
      typeof ariaLabelFull === "string" && ariaLabelFull.trim()
        ? ariaLabelFull.trim()
        : on
          ? "On"
          : "Off";
    var titleAttr = "";
    if (typeof titleText === "string" && titleText.trim()) {
      titleAttr = ' title="' + escapeHtml(titleText.trim()) + '"';
    }
    return (
      '<span class="gc-table-toggle gc-table-toggle--static gc-table-toggle--' +
      state +
      '" role="img" aria-label="' +
      escapeHtml(lab) +
      '"' +
      titleAttr +
      '><span class="gc-table-toggle__track" aria-hidden="true"><span class="gc-table-toggle__thumb"></span></span></span>'
    );
  }

  function splitInterfaceStatusParts(raw) {
    return String(raw == null ? "" : raw)
      .split(/\s*[·•]\s*/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function interfaceStatusMatchesDisabled(parts) {
    if (parts.length < 2) return false;
    var a = (parts[0] || "").toLowerCase();
    if (a !== "on" && a !== "off") return false;
    var seg = String(parts[1] || "").trim();
    return (
      /^disabled$/i.test(seg) ||
      /^disabled\s*,/i.test(seg) ||
      /^disabled\s+\S/i.test(seg)
    );
  }

  function interfaceStatusUsesDisabledToggle(raw) {
    return interfaceStatusMatchesDisabled(splitInterfaceStatusParts(raw));
  }

  function interfaceStatusMatchesUnplugged(parts) {
    if (parts.length < 2) return false;
    if ((parts[0] || "").toLowerCase() !== "on") return false;
    var seg = String(parts[1] || "").trim();
    return (
      /^unplugged$/i.test(seg) ||
      /^unplugged\s*,/i.test(seg) ||
      /^unplugged\s+\S/i.test(seg)
    );
  }

  function interfaceStatusMatchesConnected(parts) {
    if (parts.length < 2) return false;
    if ((parts[0] || "").toLowerCase() !== "on") return false;
    var seg = String(parts[1] || "").trim();
    return (
      /^connected$/i.test(seg) ||
      /^connected\s*,/i.test(seg) ||
      /^connected\s+\S/i.test(seg)
    );
  }

  function interfaceStatusCellHtml(raw) {
    var full = String(raw != null ? raw : "").trim();
    if (!full) return "";
    var parts = splitInterfaceStatusParts(full);
    var tip = ' title="' + escapeHtml(full) + '"';

    if (interfaceStatusMatchesDisabled(parts)) {
      return boolToggleHtml(false, full, full);
    }
    if (interfaceStatusMatchesUnplugged(parts)) {
      return (
        '<span class="gc-if-status-inline"' +
        tip +
        ">" +
        '<span class="gc-if-status-inline__icon" role="img" aria-label="' +
        escapeHtml(full) +
        '">' +
        '<svg class="gc-if-status-inline__svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M8 5h8v2h2v4h2v6h-2v2H8v-2H6v-6h2V7H8V5zm2 6v8h4v-8h-4z"/>' +
        '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M5 20L19 6"/>' +
        "</svg></span></span>"
      );
    }
    if (interfaceStatusMatchesConnected(parts)) {
      return (
        '<span class="gc-if-status-inline"' +
        tip +
        ">" +
        '<span class="gc-if-status-inline__icon" role="img" aria-label="' +
        escapeHtml(full) +
        '">' +
        '<svg class="gc-if-status-inline__svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M7 6h10v2h2v4h-2v7H7v-7H5V8h2V6zm2 6v6h6v-6H9z"/>' +
        '<circle cx="17.5" cy="8.5" r="5" fill="#16a34a"/>' +
        '<path fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" d="M14.3 8.5l1.5 1.5 3.2-3.2"/>' +
        "</svg></span></span>"
      );
    }
    return null;
  }

  function boolToggleButtonHtml(on, ariaLabel, titleAttr, extraClass) {
    var state = on ? "on" : "off";
    var lab = ariaLabel || (on ? "On" : "Off");
    var t =
      typeof titleAttr === "string" && titleAttr.trim()
        ? ' title="' + escapeHtml(titleAttr.trim()) + '"'
        : "";
    var xc =
      typeof extraClass === "string" && extraClass.trim() ? " " + extraClass.trim() : "";
    return (
      '<button type="button" class="gc-table-toggle gc-table-toggle--' +
      state +
      xc +
      '" aria-pressed="' +
      (on ? "true" : "false") +
      '" aria-label="' +
      escapeHtml(lab) +
      '"' +
      t +
      '><span class="gc-table-toggle__track" aria-hidden="true"><span class="gc-table-toggle__thumb"></span></span></button>'
    );
  }

  function entityTypeIconHtml(entityType) {
    var et = String(entityType || "").trim();
    var label =
      et === "vlan"
        ? "VLAN"
        : et === "bridge_pair"
          ? "Bridge pair"
          : et === "lag"
            ? "LAG"
            : et === "alias"
              ? "Alias"
              : "Interface";
    var cls =
      et === "vlan"
        ? "gc-net-entity-type-icon gc-net-entity-type-icon--vlan"
        : et === "bridge_pair"
          ? "gc-net-entity-type-icon gc-net-entity-type-icon--bridge"
          : et === "lag"
            ? "gc-net-entity-type-icon gc-net-entity-type-icon--lag"
            : et === "alias"
              ? "gc-net-entity-type-icon gc-net-entity-type-icon--alias"
              : "gc-net-entity-type-icon gc-net-entity-type-icon--interface";
    var svg;
    if (et === "vlan") {
      svg =
        '<svg class="gc-net-entity-type-icon__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 8h4v4H4V8zm6-5h4v4h-4V3zm0 10h4v4h-4v-4zm6-5h4v4h-4V8zM4 14h4v4H4v-4zm12 5h4v4h-4v-4z"/></svg>';
    } else if (et === "bridge_pair") {
      svg =
        '<svg class="gc-net-entity-type-icon__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M15 9h2V7h-2v2zm-4 0h2V7h-2v2zm-4 0h2V7H7v2zm-2 4v2h14v-2H5zm2 4h2v-2H7v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2z"/></svg>';
    } else if (et === "lag") {
      svg =
        '<svg class="gc-net-entity-type-icon__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 7h16v2H4V7zm0 4h16v2H4v-2zm0 4h10v2H4v-2z"/><path fill="currentColor" d="M16 15h4v4h-4v-4z" opacity=".85"/></svg>';
    } else if (et === "alias") {
      svg =
        '<svg class="gc-net-entity-type-icon__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M5 5h8v4H5V5zm0 6h10v4H5v-4zm0 6h6v3H5v-3z"/><path fill="currentColor" d="M16 6h3v12h-3V6z" opacity=".85"/></svg>';
    } else {
      svg =
        '<svg class="gc-net-entity-type-icon__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M9 5h6l1.5 3H18v11H6V8h1.5L9 5zm0.75 6.5h7v7h-7v-7z"/><path fill="currentColor" d="M9.85 17.15h0.55v2.75h-0.55zm0.95 0h0.55v2.75h-0.55zm0.95 0h0.55v2.75h-0.55zm0.95 0h0.55v2.75h-0.55zm0.95 0h0.55v2.75h-0.55zm0.95 0h0.55v2.75h-0.55zm0.95 0h0.55v2.75h-0.55zm0.95 0h0.55v2.75h-0.55z"/></svg>';
    }
    return (
      '<span class="' +
      cls +
      '" role="img" title="' +
      escapeHtml(label) +
      '" aria-label="' +
      escapeHtml(label) +
      '">' +
      svg +
      "</span>"
    );
  }

  function zonePillHtml(zoneName) {
    var z = String(zoneName == null ? "" : zoneName).trim();
    if (!z) return "";
    var hue = zoneHue(z);
    return (
      '<span class="gc-zone-pill" style="--gc-zone-h:' +
      hue +
      '">' +
      escapeHtml(z) +
      "</span>"
    );
  }

  /** @deprecated No-op; firewall / multivalue cells use preview + list modal. */
  function compactZoneFirewallCells() { }

  function splitHardwareTokens(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return [];
    var sepDash = /\s+[\u2013\u2014]\s+/;
    var parts = [];
    s.split(/\s*,\s*/).forEach(function (piece) {
      piece = piece.trim();
      if (!piece) return;
      if (sepDash.test(piece)) {
        piece.split(sepDash).forEach(function (p2) {
          p2 = p2.trim();
          if (p2) parts.push(p2);
        });
      } else {
        parts.push(piece);
      }
    });
    return parts;
  }

  /** @returns {"black"|"blue"|"yellow"|"gray"} */
  function hardwarePortPillVariant(token) {
    var t = String(token == null ? "" : token).trim();
    if (!t) return "gray";
    if (/^PortF\d+/i.test(t)) return "black";
    if (/^Port\d+$/i.test(t)) return "blue";
    if (/^Port[A-Za-z]$/i.test(t) && !/^Port[Ff]$/i.test(t)) return "blue";
    if (/^Port(?![Ff])([A-Za-z])\d+/i.test(t)) return "yellow";
    if (!/^Port/i.test(t)) return "gray";
    return "gray";
  }

  function formatHardwarePortPillsHtml(raw) {
    var tokens = splitHardwareTokens(raw);
    if (!tokens.length) return "";
    var pills = tokens.map(function (tok) {
      var variant = hardwarePortPillVariant(tok);
      return (
        '<span class="gc-hw-pill gc-hw-pill--' +
        variant +
        '">' +
        escapeHtml(tok) +
        "</span>"
      );
    });
    return '<span class="gc-hw-pill-row">' + pills.join("") + "</span>";
  }

  function formatCellHtml(colId, raw) {
    var v = raw != null ? String(raw) : "";
    if (zoneAsPill && colId === COL_ZONE) {
      var zt = v.trim();
      if (!zt) return "";
      return zonePillHtml(zt);
    }
    if (nameAsZonePill && colId === COL_NAME) {
      var nt = v.trim();
      if (!nt) return "";
      return zonePillHtml(nt);
    }
    if (valuePillColSet[colId]) {
      var vp = v.trim();
      if (!vp) return '<span class="muted">—</span>';
      return '<span class="gc-table-value-pill">' + escapeHtml(vp) + "</span>";
    }
    if (interfaceStatusColumnVisual && colId === COL_STATUS) {
      var ispec = interfaceStatusCellHtml(raw);
      if (ispec !== null) return ispec;
    }
    if (hardwarePortPills && colId === COL_HARDWARE) {
      var hw = v.trim();
      if (!hw) return "";
      return formatHardwarePortPillsHtml(hw);
    }
    if (noBoolToggleColSet[colId]) {
      return escapeHtml(v);
    }
    var tri = boolTriState(v);
    if (tri !== null) {
      if (interfaceStatusColumnVisual && colId === COL_STATUS) {
        var rawSt = v != null ? String(v).trim() : "";
        var ariaSt = rawSt || (tri ? "On" : "Off");
        return boolToggleHtml(tri, ariaSt, rawSt || ariaSt);
      }
      return boolToggleHtml(tri);
    }
    return escapeHtml(v);
  }

  function parseTopBarFirewallCheckboxValue(raw) {
    var s = String(raw || "");
    var n =
      s.indexOf("f:") === 0 ? parseInt(s.slice(2), 10) : parseInt(s, 10);
    return !isNaN(n) && n > 0 ? n : null;
  }

  function parseTopBarConfigurationCheckboxValue(raw) {
    var s = String(raw || "");
    var n =
      s.indexOf("c:") === 0 ? parseInt(s.slice(2), 10) : parseInt(s, 10);
    return !isNaN(n) && n > 0 ? n : null;
  }

  /** Live DOM read when global getters disagree (stale closure, markup without data-gc-fw-ms, etc.). */
  function topBarExplicitFirewallIdsFromDom() {
    var root = document.getElementById("gc-net-fw-multiselect");
    if (!root) return [];
    var ids = [];
    root.querySelectorAll(".gc-net-fw-cb--fw:checked").forEach(function (cb) {
      var n = parseTopBarFirewallCheckboxValue(cb.value);
      if (n != null) ids.push(n);
    });
    return ids;
  }

  function topBarExplicitConfigurationIdsFromDom() {
    var root = document.getElementById("gc-net-fw-multiselect");
    if (!root) return [];
    var ids = [];
    root.querySelectorAll(".gc-net-fw-cb--cfg:checked").forEach(function (cb) {
      var n = parseTopBarConfigurationCheckboxValue(cb.value);
      if (n != null) ids.push(n);
    });
    return ids;
  }

  function coerceIdArray(x) {
    if (x == null) return [];
    if (Array.isArray(x)) return x;
    if (typeof x === "object" && typeof x.length === "number") {
      try {
        return Array.prototype.slice.call(x);
      } catch (eCo) {
        return [];
      }
    }
    return [];
  }

  function getSelectedFirewallIds() {
    if (typeof window.gcGetSelectedFirewallIds === "function") {
      var g = coerceIdArray(window.gcGetSelectedFirewallIds());
      if (g.length > 0) return g;
      var fb = topBarExplicitFirewallIdsFromDom();
      return fb.length ? fb : g;
    }
    var ids = [];
    document.querySelectorAll(".gc-net-fw-cb--fw:checked").forEach(function (cb) {
      var n = parseTopBarFirewallCheckboxValue(cb.value);
      if (n != null) ids.push(n);
    });
    if (ids.length) return ids;
    return topBarExplicitFirewallIdsFromDom();
  }

  function resolveSelectedIdsForTable() {
    if (typeof cfg.getSelectedIds === "function") {
      try {
        var a = cfg.getSelectedIds();
        a = Array.isArray(a) ? a : [];
        if (cfg.idsQueryParam === "configuration_ids") {
          if (a.length === 0) {
            var cfb = topBarExplicitConfigurationIdsFromDom();
            if (cfb.length) return cfb;
          }
          return a;
        }
        if (a.length === 0) {
          var fbf = topBarExplicitFirewallIdsFromDom();
          if (fbf.length) return fbf;
        }
        return a;
      } catch (eR) {
        return cfg.idsQueryParam === "configuration_ids"
          ? topBarExplicitConfigurationIdsFromDom()
          : topBarExplicitFirewallIdsFromDom();
      }
    }
    return getSelectedFirewallIds();
  }

  /** Union of scopes for combined-view sync / partial-scope chrome when `resolveScopeIds` is set (e.g. zones on Firewalls · Network). */
  function resolveCombineSyncGlobalIds() {
    var c = combineSyncSelectedCfg || {};
    if (typeof c.resolveScopeIds === "function") {
      try {
        var a = c.resolveScopeIds();
        return Array.isArray(a) ? a : [];
      } catch (eCsg) {
        return [];
      }
    }
    return resolveSelectedIdsForTable();
  }

  function resolveExplicitConfigurationIdsSelected() {
    var a = [];
    if (typeof window.gcGetSelectedConfigurationIds === "function") {
      try {
        a = window.gcGetSelectedConfigurationIds();
      } catch (eC) {
        a = [];
      }
    }
    a = Array.isArray(a) ? a : [];
    if (a.length > 0) return a;
    return topBarExplicitConfigurationIdsFromDom();
  }

  function resolveEffectiveConfigurationIdsForApi() {
    var e = [];
    if (typeof window.gcGetEffectiveConfigurationIds === "function") {
      try {
        e = window.gcGetEffectiveConfigurationIds();
      } catch (eE) {
        e = [];
      }
    } else {
      e = resolveExplicitConfigurationIdsSelected();
    }
    e = Array.isArray(e) ? e : [];
    if (e.length > 0) return e;
    var fb = topBarExplicitConfigurationIdsFromDom();
    return fb.length ? fb : e;
  }

  function facetAppliedCount() {
    if (!filtersDrawer || !window.gcTableFacets) return 0;
    return window.gcTableFacets.appliedCount(filtersDrawer);
  }

  function updateFacetChrome() {
    var n = facetAppliedCount();
    var head = document.getElementById(prefix + "-facet-head-actions");
    var cEl = document.getElementById(prefix + "-facet-count");
    var resetBtn = document.getElementById(prefix + "-facet-reset");
    if (!head || !cEl || !resetBtn) return;
    if (n > 0) {
      head.hidden = false;
      cEl.innerHTML = '<span class="filters__facet-count-num">' + n + "</span> applied";
      resetBtn.hidden = false;
    } else {
      head.hidden = true;
      cEl.textContent = "";
      resetBtn.hidden = true;
    }
  }

  function rowMatchesFacets(tr) {
    if (!tr.classList.contains(dataRowClass)) return true;
    if (!filtersDrawer || !window.gcTableFacets) return true;
    return window.gcTableFacets.rowMatches(tr, filtersDrawer);
  }

  function setFiltersAsideCollapsed(collapsed) {
    var aside = document.getElementById(prefix + "-filters-aside");
    var drawer = document.getElementById(prefix + "-filters-drawer");
    var btn = document.getElementById(prefix + "-filters-toggle");
    if (!aside || !drawer || !btn) return;
    aside.classList.toggle("filters--collapsed", collapsed);
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (collapsed) drawer.setAttribute("hidden", "");
    else drawer.removeAttribute("hidden");
  }

  function skipColFacetPicker(colId) {
    if (actionButtonColSet[colId]) return true;
    if (bulkRowSelect && colId === COL_SELECT) return true;
    if (!ipHostTable) return false;
    if (colId === COL_LOCK) return true;
    return false;
  }

  function colsForFacetRebuild() {
    return COLS.filter(function (c) {
      return !skipColFacetPicker(c.id);
    });
  }

  function facetColumnEntriesForRebuild() {
    return colsForFacetRebuild().map(function (c) {
      var o = { id: c.id, label: c.label };
      if (entityTypeQuickFilterOn && c.id === COL_TYPE) o.facetSuppressAutoOpen = true;
      return o;
    });
  }

  function mountIpHostExcludeFacet() {
    if (!ipHostTable || !filtersDrawer) return;
    var bid = prefix + "-exclude-system-facet-wrap";
    var prev = document.getElementById(bid);
    if (prev) prev.remove();
    var wrap = document.createElement("div");
    wrap.id = bid;
    wrap.innerHTML =
      '<div class="filter-group" data-gc-hs-host-type-facet>' +
      '<button type="button" class="filter-group__head" aria-expanded="false">' +
      "<span>Host types</span>" +
      '<span class="filter-group__chev" aria-hidden="true">▼</span>' +
      "</button>" +
      '<div class="filter-group__body">' +
      '<label class="filter-opt gc-hs-exclude-system-opt">' +
      '<input type="checkbox" id="' +
      prefix +
      '-exclude-system-cb" data-gc-hs-exclude-system />' +
      "<span>Exclude system hosts</span>" +
      "</label>" +
      "</div></div>";
    filtersDrawer.appendChild(wrap);
    var root = wrap.querySelector("[data-gc-hs-host-type-facet]");
    var head = root && root.querySelector(".filter-group__head");
    if (head && head.dataset.gcHsHostTypeHeadBound !== "1") {
      head.dataset.gcHsHostTypeHeadBound = "1";
      head.addEventListener("click", function () {
        var g = head.closest(".filter-group");
        if (!g) return;
        var open = g.classList.toggle("is-open");
        head.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    var cb = document.getElementById(prefix + "-exclude-system-cb");
    if (cb) {
      cb.checked = excludeSystemOn;
      if (cb.dataset.gcHsExcludeBound !== "1") {
        cb.dataset.gcHsExcludeBound = "1";
        cb.addEventListener("change", function () {
          excludeSystemOn = !!cb.checked;
          try {
            localStorage.setItem(ipHostTable.excludeSystemStorageKey, excludeSystemOn ? "1" : "0");
          } catch (e1) { }
          applyRowFilter();
        });
      }
    }
  }

  function resetExcludeSystemDefault() {
    if (!ipHostTable) return;
    excludeSystemOn = ipHostTable.excludeSystemDefault !== false;
    try {
      localStorage.setItem(ipHostTable.excludeSystemStorageKey, excludeSystemOn ? "1" : "0");
    } catch (e4) { }
    var cb = document.getElementById(prefix + "-exclude-system-cb");
    if (cb) cb.checked = excludeSystemOn;
  }

  function syncQuickEntityTypeNavFromFacets() {
    var nav = document.getElementById(prefix + "-quick-entity-nav");
    if (!nav || !filtersDrawer || !window.gcTableFacets) return;
    var active = null;
    var checked = filtersDrawer.querySelectorAll(
      'input[data-gc-facet-enum="' + COL_TYPE + '"]:checked',
    );
    if (checked.length === 1) {
      var dec = window.gcTableFacets.decodeFacetEnumValue(checked[0].value);
      if (dec === "Interface") active = "interface";
      else if (dec === "VLAN") active = "vlan";
      else if (dec === "Bridge pair") active = "bridge_pair";
      else if (dec === "LAG") active = "lag";
      else if (dec === "Alias") active = "alias";
    }
    nav.querySelectorAll("[data-gc-entity-quick]").forEach(function (btn) {
      var v = btn.getAttribute("data-gc-entity-quick");
      var on = active != null && active === v;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function applyEntityQuickFilterViaFacets(entityKeyOrNull) {
    if (!entityTypeQuickFilterOn || !filtersDrawer || !window.gcTableFacets) return;
    try {
      sessionStorage.removeItem("gc-facet-expanded:" + prefix + ":" + COL_TYPE);
    } catch (eExp) { }
    filtersDrawer.querySelectorAll('input[data-gc-facet-enum="' + COL_TYPE + '"]').forEach(function (cb) {
      cb.checked = false;
    });
    if (entityKeyOrNull) {
      var display = ENTITY_QUICK_TO_TYPE_DISPLAY[entityKeyOrNull];
      if (display) {
        filtersDrawer.querySelectorAll('input[data-gc-facet-enum="' + COL_TYPE + '"]').forEach(function (cb) {
          if (window.gcTableFacets.decodeFacetEnumValue(cb.value) === display) cb.checked = true;
        });
      }
    }
    window.gcTableFacets.persistFilterDrawerState(filtersDrawer, prefix);
    window.gcTableFacets.syncFacetGroupOpenState(filtersDrawer, prefix);
    syncQuickEntityTypeNavFromFacets();
    updateFacetChrome();
    applyRowFilter();
  }

  function maybeMigrateLegacyQuickEntityFilter() {
    if (!quickEntityMigrateKey || !filtersDrawer || !window.gcTableFacets) return;
    try {
      var legacy = sessionStorage.getItem(quickEntityMigrateKey);
      if (
        legacy !== "interface" &&
        legacy !== "bridge_pair" &&
        legacy !== "lag" &&
        legacy !== "vlan" &&
        legacy !== "alias"
      )
        return;
      var hasType = filtersDrawer.querySelector(
        'input[data-gc-facet-enum="' + COL_TYPE + '"]:checked',
      );
      if (hasType) {
        sessionStorage.removeItem(quickEntityMigrateKey);
        return;
      }
      applyEntityQuickFilterViaFacets(legacy);
      sessionStorage.removeItem(quickEntityMigrateKey);
    } catch (eM) { }
  }

  function bindEntityTypeQuickFilterOnce() {
    if (!entityTypeQuickFilterOn) return;
    var nav = document.getElementById(prefix + "-quick-entity-nav");
    if (!nav || nav.dataset.gcEntityQuickBound === "1") return;
    nav.dataset.gcEntityQuickBound = "1";
    nav.querySelectorAll("[data-gc-entity-quick]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var v = btn.getAttribute("data-gc-entity-quick");
        var display = ENTITY_QUICK_TO_TYPE_DISPLAY[v];
        if (!display) return;
        var cur = null;
        var ch = filtersDrawer.querySelectorAll(
          'input[data-gc-facet-enum="' + COL_TYPE + '"]:checked',
        );
        if (ch.length === 1) cur = window.gcTableFacets.decodeFacetEnumValue(ch[0].value);
        var turningOff = cur === display;
        applyEntityQuickFilterViaFacets(turningOff ? null : v);
      });
    });
  }

  function applyRowFilter() {
    var q = (searchIn && searchIn.value ? searchIn.value : "").trim().toLowerCase();
    if (!tbody) return;
    var rows = tbody.querySelectorAll("tr." + dataRowClass);
    var visible = 0;
    var total = rows.length;
    rows.forEach(function (tr) {
      var s = tr.getAttribute("data-search") || "";
      var ok = rowMatchesFacets(tr) && (!q || s.indexOf(q) !== -1);
      if (ok && ipHostTable && excludeSystemOn && tr.getAttribute("data-gc-system-host") === "1") ok = false;
      tr.hidden = !ok;
      if (ok) visible++;
    });
    var fe = document.getElementById(prefix + "-filter-empty");
    if (fe) fe.hidden = !(total > 0 && visible === 0);
    if (countEl) {
      if (lazyMountInProgress && lazyMountTotalRows > total) {
        countEl.textContent = "Rendering rows… " + total + " / " + lazyMountTotalRows;
      } else if (total === 0) {
        countEl.textContent = "";
      } else if (visible === total) {
        countEl.textContent = visible === 1 ? "1 " + L.countSingular : visible + " " + L.countPlural;
      } else {
        countEl.textContent = "Showing " + visible + " of " + total + " " + L.countPlural;
      }
    }
    if (bulkRowSelect) syncIpHostSelectAllHeader();
  }

  function syncBulkRowActionToolbar() {
    if (!bulkRowSelect) return;
    var n = 0;
    if (tbody) {
      tbody.querySelectorAll("tr." + dataRowClass + " input.gc-hs-row-select:checked").forEach(function (r) {
        if (r.disabled) return;
        n++;
      });
    }
    var btn = document.getElementById(prefix + "-delete-selected");
    if (btn) {
      btn.disabled = n < 1 || !tbody;
    }
    var syncBtn = document.getElementById(prefix + "-combine-sync-selected");
    if (syncBtn) {
      var combineOn = true;
      if (combineQuery && combineQuery.inputId) {
        var cbxComb = document.getElementById(combineQuery.inputId);
        combineOn = !cbxComb || cbxComb.checked;
      }
      syncBtn.disabled = n < 1 || !combineOn;
    }
    if (onBulkSelectionChange) {
      try {
        onBulkSelectionChange();
      } catch (eBsc) { }
    }
  }

  function syncIpHostSelectAllHeader() {
    if (!bulkRowSelect || !tbody) {
      syncBulkRowActionToolbar();
      return;
    }
    var cb = document.getElementById(prefix + "-select-all");
    if (!cb) {
      syncBulkRowActionToolbar();
      return;
    }
    var boxes = [];
    tbody.querySelectorAll("tr." + dataRowClass + " input.gc-hs-row-select").forEach(function (r) {
      var tr = r.closest("tr");
      if (!tr || tr.hidden) return;
      if (r.disabled) return;
      boxes.push(r);
    });
    var n = boxes.length;
    var c = boxes.filter(function (b) {
      return b.checked;
    }).length;
    cb.checked = n > 0 && c === n;
    cb.indeterminate = c > 0 && c < n;
    syncBulkRowActionToolbar();
  }

  function bindIpHostSelectAllOnce() {
    if (!bulkRowSelect || !tbody) return;
    var cb = document.getElementById(prefix + "-select-all");
    if (!cb || cb.dataset.gcHsSelectAllBound === "1") return;
    cb.dataset.gcHsSelectAllBound = "1";
    cb.addEventListener("change", function () {
      var on = cb.checked;
      tbody.querySelectorAll("tr." + dataRowClass + " input.gc-hs-row-select").forEach(function (r) {
        var tr = r.closest("tr");
        if (!tr || tr.hidden) return;
        if (r.disabled) return;
        r.checked = on;
      });
      syncIpHostSelectAllHeader();
    });
  }

  function getDeleteConfigEntryIdsFromSelection() {
    if (!bulkRowSelect || !tbody) return [];
    var seen = {};
    var out = [];
    tbody.querySelectorAll("tr." + dataRowClass + ' input[data-gc-hs-row-select]:checked').forEach(function (cbx) {
      var tr = cbx.closest("tr");
      if (!tr || !tr._gcNetRow) return;
      var row = tr._gcNetRow;
      if (bulkDeleteRowFilter && !bulkDeleteRowFilter(row)) return;
      if (row.entity_type === "ip_host" && row.system_host) return;
      var targets =
        row.hs_edit_targets ||
        row.ip_host_edit_targets ||
        row.ips_policy_edit_targets ||
        row.wfp_edit_targets ||
        row.ips_custom_sig_edit_targets ||
        row.ips_trusted_mac_edit_targets ||
        row.schedule_edit_targets ||
        row.accesstime_edit_targets ||
        row.surfingquota_edit_targets ||
        row.datatransfer_edit_targets ||
        row.vpnprofile_edit_targets ||
        row.adminprofile_edit_targets ||
        row.zone_edit_targets;
      if (Array.isArray(targets) && targets.length) {
        targets.forEach(function (t) {
          if (!t || t.config_entry_id == null) return;
          var ce = parseInt(String(t.config_entry_id), 10);
          if (isNaN(ce) || ce <= 0 || seen[ce]) return;
          seen[ce] = true;
          out.push(ce);
        });
      } else if (row.config_entry_id != null) {
        var c = parseInt(String(row.config_entry_id), 10);
        if (!isNaN(c) && c > 0 && !seen[c]) {
          seen[c] = true;
          out.push(c);
        }
      }
    });
    return out;
  }

  /** True when merged scopes disagree on a non-name field (row-level flag from API or `*_combine_conflict`). */
  function rowHasMergedScopeConflict(row) {
    if (!row || typeof row !== "object") return false;
    if (row.access_conflict) return true;
    if (combineConflictRowKey && row[combineConflictRowKey]) return true;
    for (var cki = 0; cki < combineConflictRowKeys.length; cki++) {
      if (row[combineConflictRowKeys[cki]]) return true;
    }
    for (var rk in row) {
      if (!Object.prototype.hasOwnProperty.call(row, rk)) continue;
      if (/_combine_conflict$/.test(rk) && row[rk]) return true;
    }
    return false;
  }

  function rowScopeLabelList(row) {
    if (!row || typeof row !== "object") return [];
    if (Array.isArray(row.firewall_labels) && row.firewall_labels.length) return row.firewall_labels;
    if (Array.isArray(row.configuration_labels) && row.configuration_labels.length) {
      return row.configuration_labels;
    }
    return [];
  }

  /** Combined view: entity is missing from at least one globally selected scope (any count &lt; n). */
  function rowHasPartialScopeMembership(row) {
    if (!combineQuery) return false;
    var nScope = resolveCombineSyncGlobalIds().length;
    if (nScope <= 1) return false;
    var labels = rowScopeLabelList(row);
    if (!labels.length) return false;
    return labels.length < nScope;
  }

  function partialScopeTooltipNoun(row) {
    if (row && row.configuration_id != null && row.firewall_id == null) return "configurations";
    return "firewalls";
  }

  function makeCombineRowPartialScopeIconSpan(row) {
    var warn = document.createElement("span");
    warn.className = "gc-combine-row-partial-scope-icon";
    warn.setAttribute("data-gc-combine-row-partial-scope", "1");
    warn.setAttribute("role", "img");
    var labels = rowScopeLabelList(row);
    var nScope = resolveCombineSyncGlobalIds().length;
    var noun = partialScopeTooltipNoun(row);
    var msg =
      "Present on " +
      labels.length +
      " of " +
      nScope +
      " selected " +
      noun +
      " — not on every selected " +
      noun.slice(0, -1) +
      ".";
    warn.setAttribute("aria-label", msg);
    warn.title = msg;
    warn.innerHTML = COMBINE_ROW_PARTIAL_SCOPE_ICON_SVG;
    warn.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    return warn;
  }

  function extractPresentScopeIdsFromRow(row) {
    var seen = {};
    var out = [];
    function add(id) {
      var n = parseInt(String(id), 10);
      if (isNaN(n) || n < 1 || seen[n]) return;
      seen[n] = true;
      out.push(n);
    }
    if (!row || typeof row !== "object") return out;
    if (Array.isArray(row.firewall_ids)) row.firewall_ids.forEach(add);
    if (Array.isArray(row.configuration_ids)) row.configuration_ids.forEach(add);
    if (out.length) return out;
    var rk;
    for (rk in row) {
      if (!Object.prototype.hasOwnProperty.call(row, rk)) continue;
      if (!/_edit_targets$/.test(rk) || !Array.isArray(row[rk])) continue;
      row[rk].forEach(function (t) {
        if (!t || typeof t !== "object") return;
        if (t.firewall_id != null) add(t.firewall_id);
        if (t.configuration_id != null) add(t.configuration_id);
      });
    }
    if (row.firewall_id != null) add(row.firewall_id);
    if (row.configuration_id != null) add(row.configuration_id);
    return out;
  }

  /** Skip sync for rows that exist on every selected scope and have field-drift (!) — user must reconcile first. */
  function combineSyncSkipRow(row, globalCount) {
    if (!row || globalCount <= 0) return true;
    var labels = rowScopeLabelList(row);
    var onAll = labels.length >= globalCount;
    return onAll && rowHasMergedScopeConflict(row);
  }

  function missingScopeIdsForRow(row, globalIds) {
    var present = extractPresentScopeIdsFromRow(row);
    var ps = {};
    present.forEach(function (x) {
      ps[String(x)] = true;
    });
    var miss = [];
    globalIds.forEach(function (id) {
      var n = parseInt(String(id), 10);
      if (!isNaN(n) && n > 0 && !ps[String(n)]) miss.push(n);
    });
    return miss;
  }

  function getCheckedPayloadRowsForSync() {
    var out = [];
    if (!tbody) return out;
    tbody.querySelectorAll("tr." + dataRowClass + " input.gc-hs-row-select:checked").forEach(function (cb) {
      if (cb.disabled) return;
      var tr = cb.closest("tr");
      if (!tr || tr.hidden || !tr._gcNetRow) return;
      out.push(tr._gcNetRow);
    });
    return out;
  }

  function postJsonTaskQueue(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "Ground-Control",
      },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, j: j, status: r.status };
      });
    });
  }

  function detailFromTaskQueueRes(res) {
    var j = res && res.j;
    if (!j) return res && !res.ok ? "Request failed." : "";
    var d = j.detail;
    if (typeof d === "string") return d;
    if (d && typeof d === "object" && Array.isArray(d)) {
      try {
        return JSON.stringify(d);
      } catch (e0) {
        return "Request failed.";
      }
    }
    if (j.message) return String(j.message);
    return "Request failed.";
  }

  function cloneJsonObject(obj) {
    if (!obj || typeof obj !== "object") return {};
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e1) {
      return {};
    }
  }

  function loopSingleFirewallCreates(url, fids, buildBody) {
    var acc = { ok: true, count: 0, err: "" };
    var i = 0;
    function step() {
      if (i >= fids.length) return Promise.resolve(acc);
      var fid = fids[i++];
      return postJsonTaskQueue(url, buildBody(fid)).then(function (res) {
        if (res.ok && res.j && res.j.ok !== false) {
          acc.count++;
        } else {
          acc.ok = false;
          acc.err = detailFromTaskQueueRes(res);
        }
        return step();
      });
    }
    return step();
  }

  function executeOneCombineSync(strategy, row, missingIds) {
    var c = combineSyncSelectedCfg || {};
    if (!missingIds.length) return Promise.resolve({ ok: true, count: 0 });
    var st = strategy;
    if (st === "auto_hs") {
      st = apiEntityType === "ip_host" ? "ip_host_batch" : "hs_batch";
    }
    if (st === "ip_host_batch") {
      var uIp = c.ipHostCreateBatchUrl || (typeof window !== "undefined" && window.gcHsIpHostEnqueueCreateBatchUrl);
      if (!uIp) return Promise.resolve({ ok: false, err: "IP host create batch URL is not configured." });
      return postJsonTaskQueue(uIp, {
        firewall_ids: missingIds,
        form: cloneJsonObject(row.flat),
      }).then(function (res) {
        if (!res.ok) return { ok: false, err: detailFromTaskQueueRes(res) };
        var n = res.j && res.j.count != null ? res.j.count : missingIds.length;
        return { ok: true, count: n };
      });
    }
    if (st === "hs_batch") {
      var uHs = c.hsCreatesBatchUrl || (typeof window !== "undefined" && window.gcHsEnqueueCreatesBatchUrl);
      if (!uHs) return Promise.resolve({ ok: false, err: "Hosts & Services create batch URL is not configured." });
      if (!apiEntityType)
        return Promise.resolve({ ok: false, err: "Table is missing apiEntityType for combined sync." });
      return postJsonTaskQueue(uHs, {
        firewall_ids: missingIds,
        entity_type: apiEntityType,
        form: cloneJsonObject(row.flat),
      }).then(function (res) {
        if (!res.ok) return { ok: false, err: detailFromTaskQueueRes(res) };
        var n2 = res.j && res.j.count != null ? res.j.count : missingIds.length;
        return { ok: true, count: n2 };
      });
    }
    if (st === "wfp_create") {
      var uW = c.createUrl || (typeof window !== "undefined" && window.GC_WEBFILTER_POLICY_CREATE_URL);
      if (!uW) return Promise.resolve({ ok: false, err: "Web filter policy create URL is not configured." });
      var polW = cloneJsonObject(row.policy);
      return loopSingleFirewallCreates(uW, missingIds, function (fid) {
        return { firewall_id: fid, policy: polW };
      });
    }
    if (st === "ips_policy_create") {
      var uPol = c.createUrl || (typeof window !== "undefined" && window.GC_IPS_POLICY_CREATE_URL);
      if (!uPol) return Promise.resolve({ ok: false, err: "IPS policy create URL is not configured." });
      var polP = cloneJsonObject(row.policy);
      return loopSingleFirewallCreates(uPol, missingIds, function (fid) {
        return { firewall_id: fid, policy: polP };
      });
    }
    if (st === "ips_custom_sig_batch") {
      var uSig =
        c.createBatchUrl || (typeof window !== "undefined" && window.GC_IPS_CUSTOM_SIGNATURE_CREATE_BATCH_URL);
      if (!uSig) return Promise.resolve({ ok: false, err: "IPS custom signature batch URL is not configured." });
      return postJsonTaskQueue(uSig, {
        firewall_ids: missingIds,
        signature: cloneJsonObject(row.signature),
      }).then(function (res) {
        if (!res.ok) return { ok: false, err: detailFromTaskQueueRes(res) };
        var n3 = res.j && res.j.count != null ? res.j.count : missingIds.length;
        return { ok: true, count: n3 };
      });
    }
    if (st === "ips_trusted_mac_batch") {
      var uTm =
        c.createBatchUrl || (typeof window !== "undefined" && window.GC_IPS_TRUSTED_MAC_CREATE_BATCH_URL);
      if (!uTm) return Promise.resolve({ ok: false, err: "Trusted MAC batch URL is not configured." });
      return postJsonTaskQueue(uTm, {
        firewall_ids: missingIds,
        trusted_mac: cloneJsonObject(row.trusted_mac),
      }).then(function (res) {
        if (!res.ok) return { ok: false, err: detailFromTaskQueueRes(res) };
        var n4 = res.j && res.j.count != null ? res.j.count : missingIds.length;
        return { ok: true, count: n4 };
      });
    }
    if (st === "profile_create_batch") {
      var uPr = c.profileCreateBatchUrl;
      var etPr = c.profileEntityType;
      if (!uPr || !etPr)
        return Promise.resolve({ ok: false, err: "Profile entity batch URL or entity type is not configured." });
      return postJsonTaskQueue(uPr, {
        entity_type: etPr,
        firewall_ids: missingIds,
        payload: cloneJsonObject(row.payload),
      }).then(function (res) {
        if (!res.ok) return { ok: false, err: detailFromTaskQueueRes(res) };
        var n5 = res.j && res.j.count != null ? res.j.count : missingIds.length;
        return { ok: true, count: n5 };
      });
    }
    if (st === "admin_profile_create") {
      var uAp = c.createUrl;
      if (!uAp) return Promise.resolve({ ok: false, err: "Administration profile create URL is not configured." });
      var prof = cloneJsonObject(row.payload);
      return loopSingleFirewallCreates(uAp, missingIds, function (fid) {
        return { firewall_id: fid, profile: prof };
      });
    }
    if (st === "zone_create_batch") {
      var uZf =
        c.zoneFirewallCreateBatchUrl ||
        (typeof window !== "undefined" && window.gcNetZoneEnqueueCreateBatchUrl);
      var uZc =
        c.zoneConfigurationCreateBatchUrl ||
        (typeof window !== "undefined" && window.gcNetZoneApplyCreateBatchUrl);
      var zForm = cloneJsonObject(row.flat || {});
      var fwSetZ = {};
      var cfgSetZ = {};
      (typeof window.gcGetSelectedFirewallIds === "function"
        ? window.gcGetSelectedFirewallIds() || []
        : []
      ).forEach(function (id) {
        var nz = parseInt(String(id), 10);
        if (!isNaN(nz) && nz > 0) fwSetZ[nz] = true;
      });
      (typeof window.gcGetEffectiveConfigurationIds === "function"
        ? window.gcGetEffectiveConfigurationIds() || []
        : []
      ).forEach(function (id) {
        var nz2 = parseInt(String(id), 10);
        if (!isNaN(nz2) && nz2 > 0) cfgSetZ[nz2] = true;
      });
      var missFwZ = [];
      var missCfgZ = [];
      missingIds.forEach(function (id) {
        var nzm = parseInt(String(id), 10);
        if (isNaN(nzm) || nzm < 1) return;
        if (fwSetZ[nzm]) missFwZ.push(nzm);
        else if (cfgSetZ[nzm]) missCfgZ.push(nzm);
      });
      var chainZ = Promise.resolve({ ok: true, count: 0 });
      chainZ = chainZ.then(function (accZ) {
        if (!missFwZ.length) return accZ;
        if (!uZf)
          return { ok: false, err: "Zone create batch URL for firewalls is not configured." };
        return postJsonTaskQueue(uZf, { firewall_ids: missFwZ, form: zForm }).then(function (resZ) {
          if (!resZ.ok) return { ok: false, err: detailFromTaskQueueRes(resZ) };
          var nzc = resZ.j && resZ.j.count != null ? resZ.j.count : missFwZ.length;
          return { ok: true, count: accZ.count + nzc };
        });
      });
      chainZ = chainZ.then(function (accZ2) {
        if (!accZ2.ok) return accZ2;
        if (!missCfgZ.length) return accZ2;
        if (!uZc)
          return { ok: false, err: "Zone create batch URL for configurations is not configured." };
        return postJsonTaskQueue(uZc, { configuration_ids: missCfgZ, form: zForm }).then(function (resC) {
          if (!resC.ok) return { ok: false, err: detailFromTaskQueueRes(resC) };
          try {
            document.dispatchEvent(new CustomEvent("gc-configuration-entries-updated"));
          } catch (eCfgUpd) {}
          var nzc2 = resC.j && resC.j.count != null ? resC.j.count : missCfgZ.length;
          return { ok: true, count: accZ2.count + nzc2 };
        });
      });
      return chainZ;
    }
    return Promise.resolve({ ok: false, err: "Unknown combine sync strategy: " + st });
  }

  function dispatchCombineSyncTaskQueueUpdated() {
    try {
      document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
    } catch (eTq) {}
  }

  function runCombineSyncSelected() {
    if (!combineSyncSelectedCfg || !combineQuery) return;
    var cbxC = combineQuery.inputId ? document.getElementById(combineQuery.inputId) : null;
    if (cbxC && !cbxC.checked) {
      if (typeof window.gcGlobalBannerShowResult === "function") {
        window.gcGlobalBannerShowResult(false, "Turn on Combined View to sync merged rows to missing scopes.");
      }
      return;
    }
    var globalIds = resolveCombineSyncGlobalIds();
    if (!globalIds.length) {
      if (typeof window.gcGlobalBannerShowResult === "function") {
        window.gcGlobalBannerShowResult(
          false,
          emptySelectMsg,
        );
      }
      return;
    }
    var rows = getCheckedPayloadRowsForSync();
    if (!rows.length) {
      if (typeof window.gcGlobalBannerShowResult === "function") {
        window.gcGlobalBannerShowResult(false, "Select at least one row.");
      }
      return;
    }
    var gc = globalIds.length;
    var strat = combineSyncSelectedCfg.strategy || "";
    var todo = [];
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      if (combineSyncSkipRow(row, gc)) continue;
      var miss = missingScopeIdsForRow(row, globalIds);
      if (!miss.length) continue;
      todo.push({ row: row, missing: miss });
    }
    if (!todo.length) {
      if (typeof window.gcGlobalBannerShowResult === "function") {
        window.gcGlobalBannerShowResult(
          false,
          "Nothing to queue: each selected row is already on every selected scope, or skipped because it shows a conflict (!) on all of them.",
        );
      }
      return;
    }
    var btnSync = document.getElementById(prefix + "-combine-sync-selected");
    if (btnSync) btnSync.disabled = true;
    var totalQueued = 0;
    var chain = Promise.resolve();
    var lastFail = "";
    todo.forEach(function (item) {
      chain = chain.then(function () {
        return executeOneCombineSync(strat, item.row, item.missing).then(function (x) {
          if (x && x.ok) totalQueued += x.count || 0;
          else lastFail = (x && x.err) || "Request failed.";
        });
      });
    });
    chain
      .then(function () {
        dispatchCombineSyncTaskQueueUpdated();
        if (typeof window.gcGlobalBannerShowResult === "function") {
          window.gcGlobalBannerShowResult(
            !lastFail,
            lastFail
              ? lastFail
              : totalQueued === 0
                ? "No new tasks were queued (objects may already match the cache on those scopes)."
                : totalQueued === 1
                  ? "Queued 1 create task for missing scope(s)."
                  : "Queued " + totalQueued + " create tasks for missing scope(s).",
          );
        }
      })
      .catch(function () {
        if (typeof window.gcGlobalBannerShowResult === "function") {
          window.gcGlobalBannerShowResult(false, "Network error while queueing sync tasks.");
        }
      })
      .then(function () {
        syncBulkRowActionToolbar();
      });
  }

  function bindCombineSyncSelectedOnce() {
    if (!combineSyncSelectedCfg || !bulkRowSelect || !combineQuery) return;
    var btn = document.getElementById(prefix + "-combine-sync-selected");
    var wrap = document.getElementById(prefix + "-combine-sync-wrap");
    if (!btn || btn.dataset.gcCombineSyncBound === "1") return;
    btn.dataset.gcCombineSyncBound = "1";
    btn.addEventListener("click", function () {
      runCombineSyncSelected();
    });
    if (wrap && combineQuery.inputId) {
      var cbx0 = document.getElementById(combineQuery.inputId);
      function updCombSyncWrap() {
        var on = !cbx0 || cbx0.checked;
        wrap.hidden = !on;
        syncBulkRowActionToolbar();
      }
      if (cbx0) cbx0.addEventListener("change", updCombSyncWrap);
      updCombSyncWrap();
    }
  }

  function makeCombineRowConflictIconButton(row) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gc-combine-row-conflict-icon";
    btn.setAttribute("data-gc-combine-row-conflict", "1");
    btn.setAttribute(
      "aria-label",
      "Show which scopes disagree and the values for each field",
    );
    btn.title =
      "Values differ across selected scopes. Click to see each field and firewall (or configuration) values.";
    btn.innerHTML = COMBINE_ROW_CONFLICT_ICON_SVG;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      gcOpenRowCombineDiffModal(row, lastApiColumnLabels);
    });
    return btn;
  }

  function renderEmptyMessage(msg, rowId) {
    tableRenderGen++;
    lazyMountInProgress = false;
    lazyMountTotalRows = 0;
    if (!tbody) return;
    tbody.innerHTML = "";
    var tr = document.createElement("tr");
    tr.id = rowId || prefix + "-placeholder";
    var td = document.createElement("td");
    td.className = "muted";
    td.setAttribute("data-gc-net-entity-msg", "");
    td.textContent = msg;
    tr.appendChild(td);
    tbody.appendChild(tr);
    syncPlaceholderColspan();
    if (countEl) countEl.textContent = "";
    if (filtersDrawer && window.gcTableFacets) {
      window.gcTableFacets.reset(filtersDrawer, prefix);
      filtersDrawer.innerHTML = "";
    }
    updateFacetChrome();
    syncQuickEntityTypeNavFromFacets();
    if (table) table.removeAttribute("aria-busy");
    if (window.gcTableSort && table) window.gcTableSort.bindTable(table);
    syncBulkRowActionToolbar();
  }

  function buildDataTrFromRow(row) {
    var tr = document.createElement("tr");
    tr.className = dataRowClass;
    tr.setAttribute("data-search", row.search || "");
    var cells = row.cells || {};
    var sysHost = !!row.system_host;
    tr.setAttribute("data-gc-system-host", sysHost ? "1" : "");
    if (sysHost) tr.classList.add("gc-hs-ip-host-row--system");
    if (rowPayloadOnly || (rowClickable && onRowClick)) {
      tr._gcNetRow = row;
    }
    if (rowClickable && onRowClick) {
      tr.classList.add("gc-net-entity-row--clickable");
      tr.setAttribute("role", "button");
      tr.setAttribute("tabindex", "0");
      var disp = String(cells[COL_NAME] != null ? cells[COL_NAME] : "").trim() || rowAriaEntitySingular;
      var et0 = row.entity_type;
      var subj =
        et0 === "vlan"
          ? "VLAN"
          : et0 === "bridge_pair"
            ? "bridge pair"
            : et0 === "alias"
              ? "alias"
              : rowAriaEntitySingular;
      tr.setAttribute(
        "aria-label",
        sysHost ? "View read-only " + subj + " " + disp : "Edit " + subj + " " + disp,
      );
      tr.addEventListener("click", function (e) {
        if (
          e.target.closest &&
          e.target.closest(
            "a, button, input, label, .gc-table-toggle, .gc-table-cell--list, [data-gc-combine-row-conflict], [data-gc-combine-row-partial-scope]",
          )
        ) {
          return;
        }
        onRowClick(tr);
      });
      tr.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          if (
            e.target.closest &&
            (e.target.closest(".gc-table-cell--list") ||
              e.target.closest("[data-gc-combine-row-conflict]") ||
              e.target.closest("[data-gc-combine-row-partial-scope]"))
          ) {
            return;
          }
          e.preventDefault();
          onRowClick(tr);
        }
      });
    }
    COLS.forEach(function (c) {
      var td = document.createElement("td");
      td.setAttribute("data-gc-col", c.id);
      if (c.id === COL_SELECT) {
        td.className = "gc-hs-select-cell gc-hs-ip-host-select-cell";
        var cbx = document.createElement("input");
        cbx.type = "checkbox";
        cbx.className = "gc-hs-row-select";
        cbx.setAttribute("data-gc-hs-row-select", "1");
        cbx.setAttribute("aria-label", "Select row");
        if (sysHost) cbx.disabled = true;
        if (!cbx.disabled && bulkSelectDisableRow && bulkSelectDisableRow(row)) {
          cbx.disabled = true;
          if (bulkSelectDisableHint) {
            cbx.setAttribute("aria-label", bulkSelectDisableHint);
            cbx.title = bulkSelectDisableHint;
          } else {
            cbx.setAttribute("aria-label", "Cannot select this row for delete");
            cbx.title =
              "Only VLANs, bridge pairs, LAGs, and aliases can be removed from this table. Physical interfaces cannot be deleted here.";
          }
        }
        cbx.addEventListener("click", function (e) {
          e.stopPropagation();
        });
        cbx.addEventListener("change", function () {
          syncIpHostSelectAllHeader();
        });
        if (bulkSelectCheckedByDefault && !cbx.disabled) cbx.checked = true;
        var inner = document.createElement("div");
        inner.className = "gc-table-select-cell-inner";
        inner.appendChild(cbx);
        if (rowHasPartialScopeMembership(row)) inner.appendChild(makeCombineRowPartialScopeIconSpan(row));
        if (rowHasMergedScopeConflict(row)) inner.appendChild(makeCombineRowConflictIconButton(row));
        td.appendChild(inner);
        tr.appendChild(td);
        return;
      }
      var v = cells[c.id];
      var html;
      var listExpand = null;
      var scopeLabsFw = null;
      if (c.id === COL_LOCK) {
        td.className = "gc-hs-lock-cell";
        html = sysHost ? LOCK_ICON_SVG : "";
      } else if (
        c.id === COL_FIREWALLS &&
        (scopeLabsFw = rowScopeLabelsForFirewallPills(row)) &&
        scopeLabsFw.length
      ) {
        var fl = scopeLabsFw.slice();
        td._gcFirewallLabels = fl;
        td.classList.add("gc-net-firewall-pills");
        /* Same as Profiles · Schedule: show scope preview pills + expand, not a lone count when 2+. */
        if (
          fl.length >= 2 &&
          window.gcTableListCellPreviewHtml &&
          window.gcTableBindListCell
        ) {
          html = window.gcTableListCellPreviewHtml(fl, gcFirewallScopePillHtml);
          listExpand = { items: fl, pillFn: gcFirewallScopePillHtml };
        } else {
          html = fl.map(gcFirewallScopePillHtml).join("");
        }
      } else if (
        row.entity_type &&
        HS_GROUP_MEMBER_COL[row.entity_type] === c.id
      ) {
        var memRawGm = v;
        var memItemsGm =
          window.gcTableNormalizeListCellItems &&
          window.gcTableNormalizeListCellItems(memRawGm, HS_MULTIVALUE_SEP);
        if (!memItemsGm || !memItemsGm.length) {
          var msGm = memRawGm != null ? String(memRawGm).trim() : "";
          if (msGm.indexOf(",") !== -1) {
            memItemsGm = msGm
              .split(",")
              .map(function (x) {
                return String(x || "").trim();
              })
              .filter(function (x) {
                return x.length > 0;
              });
          } else if (msGm) {
            memItemsGm = [msGm];
          } else {
            memItemsGm = [];
          }
        }
        td.classList.add("gc-net-firewall-pills");
        var gmmSpec = HS_GROUP_MEMBER_MODAL[row.entity_type];
        var listModalOptsGm = null;
        if (gmmSpec && gmmSpec.fn && gmmSpec.ariaPrefix) {
          listModalOptsGm = {
            onItemActivate: function (memberName) {
              var fnGm = window[gmmSpec.fn];
              if (typeof fnGm === "function") fnGm(memberName, row);
            },
            itemAriaLabelPrefix: gmmSpec.ariaPrefix,
          };
        }
        if (
          memItemsGm.length >= 2 &&
          window.gcTableListCellPreviewHtml &&
          window.gcTableBindListCell
        ) {
          html = window.gcTableListCellPreviewHtml(memItemsGm, zonePillHtml);
          listExpand = {
            items: memItemsGm,
            pillFn: zonePillHtml,
            listModalItemOptions: listModalOptsGm,
          };
        } else if (memItemsGm.length === 1) {
          html = zonePillHtml(memItemsGm[0]);
        } else {
          html = '<span class="muted">—</span>';
        }
      } else if (c.id.indexOf("ApplianceAccess.") === 0) {
        var accStr = v != null ? String(v).trim() : "";
        if (accStr === "") {
          html = boolToggleHtml(false);
        } else {
          html = formatCellHtml(c.id, v);
        }
      } else if (c.id === COL_TYPE && rowEntityTypeUsesInterfaceTypeIcon(row.entity_type)) {
        html = entityTypeIconHtml(row.entity_type);
      } else if (interactiveBoolColSet[c.id]) {
        var triI = boolTriState(v != null ? String(v) : "");
        if (triI === null) {
          html =
            '<span class="muted" title="Run a configuration sync that includes IPS switch, DoS settings, and spoof prevention">—</span>';
        } else {
          html = boolToggleButtonHtml(
            triI,
            triI ? "IPS enabled; click to disable" : "IPS disabled; click to enable",
            interactiveBoolTitle,
          );
        }
      } else if (actionButtonColSet[c.id]) {
        var cfgTitle = ("Configure " + String(c.label || "").trim()).trim();
        var pt = actionButtonPreToggleByCol[c.id];
        var btnBase = actionButtonPrimary ? "btn primary" : "btn btn--secondary";
        var cfgBtnHtml =
          '<button type="button" class="' +
          btnBase +
          ' gc-table-action-configure-btn" data-gc-action-col="' +
          escapeHtml(c.id) +
          '" title="' +
          escapeHtml(cfgTitle) +
          '">Configure</button>';
        if (pt && typeof pt.rowKey === "string" && pt.rowKey.trim()) {
          var rk = pt.rowKey.trim();
          var onSp = !!row[rk];
          var tglTitle =
            typeof pt.toggleTitle === "string" && pt.toggleTitle.trim()
              ? pt.toggleTitle.trim()
              : "Toggle spoof prevention for this firewall";
          var tglHtml = boolToggleButtonHtml(
            onSp,
            onSp ? "Spoof prevention on; click to turn off" : "Spoof prevention off; click to turn on",
            tglTitle,
            "gc-ips-spoof-table-toggle",
          );
          html =
            '<span class="gc-table-action-with-toggle">' + tglHtml + cfgBtnHtml + "</span>";
          td.classList.add("gc-table-toggle-cell");
          td.setAttribute("data-sort-value", (onSp ? "1" : "0") + " configure");
        } else {
          html = cfgBtnHtml;
        }
        td.classList.add("gc-table-action-cell");
      } else {
        var li =
          c.id !== COL_TYPE &&
            window.gcTableNormalizeListCellItems &&
            window.gcTableListCellPreviewHtml &&
            window.gcTableBindListCell
            ? window.gcTableNormalizeListCellItems(v, HS_MULTIVALUE_SEP)
            : null;
        if (li) {
          html = window.gcTableListCellPreviewHtml(li, zonePillHtml);
          listExpand = { items: li, pillFn: zonePillHtml };
        } else {
          html = formatCellHtml(c.id, v);
        }
      }
      if (c.id === COL_ADDR && row.ipam_cidr_cell === "conflict") {
        html =
          '<span class="gc-if-ipam-cidr-icon gc-if-ipam-cidr-icon--conflict" role="img" aria-label="Overlapping assignment in the same VRF (IPAM)" title="Overlapping assignment in the same VRF (IPAM)">' +
          IPAM_IF_CIDR_CONFLICT_SVG +
          "</span>" +
          html;
      } else if (c.id === COL_ADDR && row.ipam_cidr_cell === "verified") {
        html =
          '<span class="gc-if-ipam-cidr-icon gc-if-ipam-cidr-icon--verified" role="img" aria-label="Matches IPAM assignment for this firewall" title="Matches IPAM assignment for this firewall">' +
          IPAM_IF_CIDR_VERIFIED_SVG +
          "</span>" +
          html;
      }
      td.innerHTML = html;
      if (listExpand) {
        td.setAttribute("data-sort-value", listExpand.items.join(" ").toLowerCase());
        window.gcTableBindListCell(
          td,
          listExpand.items,
          c.label,
          listExpand.pillFn,
          listExpand.listModalItemOptions || null,
        );
        td.classList.add("gc-hs-multi-pills");
      } else if (v != null && String(v).indexOf(HS_MULTIVALUE_SEP) !== -1) {
        td.classList.add("gc-hs-multi-pills");
      }
      if (interfaceStatusColumnVisual && c.id === COL_STATUS && v != null && String(v).trim()) {
        td.setAttribute("data-sort-value", String(v).trim().toLowerCase());
      }
      if (hardwarePortPills && c.id === COL_HARDWARE && v != null && String(v).trim()) {
        td.setAttribute("data-sort-value", String(v).trim().toLowerCase());
      }
      if (
        interfaceStatusColumnVisual &&
        c.id === COL_STATUS &&
        interfaceStatusUsesDisabledToggle(v)
      ) {
        td.classList.add("gc-table-toggle-cell");
      }
      if (c.id === COL_TYPE && cells[c.id] != null && String(cells[c.id]).trim()) {
        td.setAttribute("data-sort-value", String(cells[c.id]).trim().toLowerCase());
      }
      if (c.id === "firewall") {
        var fwName = v != null ? String(v).trim() : "";
        if (fwName && fwName !== "—") {
          td.innerHTML = gcFirewallScopePillHtml(fwName);
          td.classList.add("gc-net-firewall-pills");
        } else {
          td.classList.add("mono");
        }
      }
      var tri = boolTriState(v != null ? String(v) : "");
      var emptyAccess = c.id.indexOf("ApplianceAccess.") === 0 && (v == null || String(v).trim() === "");
      var skipToggleChrome =
        noBoolToggleColSet[c.id] ||
        valuePillColSet[c.id] ||
        (hardwarePortPills && c.id === COL_HARDWARE);
      if ((tri !== null || emptyAccess) && !skipToggleChrome) td.classList.add("gc-table-toggle-cell");
      if (
        combineQuery &&
        !bulkRowSelect &&
        c.id === COL_NAME &&
        rowHasMergedScopeConflict(row)
      ) {
        var nameOuter = document.createElement("span");
        nameOuter.className = "gc-net-entity-name-with-combine-warn__inner";
        var nameTextWrap = document.createElement("span");
        nameTextWrap.className = "gc-net-entity-name-with-combine-warn__text";
        while (td.firstChild) nameTextWrap.appendChild(td.firstChild);
        nameOuter.appendChild(makeCombineRowConflictIconButton(row));
        nameOuter.appendChild(nameTextWrap);
        td.appendChild(nameOuter);
      }
      tr.appendChild(td);
    });
    if (window.gcTableFacets) {
      var fmap = {};
      Object.keys(cells).forEach(function (k) {
        if (!skipColFacetPicker(k)) fmap[k] = cells[k];
      });
      augmentInterfaceFacetMap(fmap, cells);
      window.gcTableFacets.setRowFacets(tr, fmap);
    }
    return tr;
  }

  function renderFromApi(data) {
    var gen = ++tableRenderGen;
    var labelsMap = (data && data.column_labels) || {};
    lastApiColumnLabels = labelsMap;
    var cols = (data && data.columns) || [];
    var rows = (data && data.rows) || [];
    DEFAULT_VISIBLE_FROM_API = (data && data.columns_visible_by_default) || [];

    COLS = cols.map(function (id) {
      return { id: id, label: colLabel(id, labelsMap) };
    });
    if (bulkRowSelect) {
      COLS.unshift({ id: COL_SELECT, label: "" });
    }
    colVis = loadColVis();

    if (thead) {
      thead.innerHTML = "";
      var htr = document.createElement("tr");
      COLS.forEach(function (c) {
        var th = document.createElement("th");
        th.scope = "col";
        th.setAttribute("data-gc-col", c.id);
        if (c.id === COL_SELECT) {
          th.className = "gc-hs-select-col gc-hs-ip-host-select-col th-check";
          th.setAttribute("aria-label", "Select all visible rows");
          var sid = prefix + "-select-all";
          th.innerHTML =
            '<input type="checkbox" id="' +
            sid +
            '" class="gc-hs-select-all" title="Select all visible" aria-label="Select all visible rows" />';
        } else if (c.id === COL_LOCK) {
          th.className = "gc-hs-lock-col";
          th.setAttribute("aria-label", "Built-in host");
          th.innerHTML = '<span class="gc-hs-lock-col__inner" aria-hidden="true"> </span>';
        } else if (nameAsZonePill) {
          th.className = "gc-net-zone-th";
          th.innerHTML = zoneTableThLabelHtml(c.label);
        } else {
          th.textContent = c.label;
        }
        htr.appendChild(th);
      });
      thead.appendChild(htr);
    }

    tbody.innerHTML = "";
    if (rows.length === 0) {
      var tr0 = document.createElement("tr");
      tr0.id = prefix + "-placeholder";
      var td0 = document.createElement("td");
      td0.className = "muted";
      td0.textContent = L.emptyCache;
      tr0.appendChild(td0);
      tbody.appendChild(tr0);
      syncPlaceholderColspan();
      applyColVis(colVis);
      buildColMenuList();
      if (countEl) countEl.textContent = "";
      if (filtersDrawer && window.gcTableFacets) {
        window.gcTableFacets.rebuild(filtersDrawer, facetColumnEntriesForRebuild(), [], prefix);
      }
      if (interfaceZonePresenceFacet) mountInterfaceZonePresenceFacet();
      if (ipHostTable) mountIpHostExcludeFacet();
      if (filtersDrawer && window.gcTableFacets && window.gcTableFacets.reapplyPersistedFilters) {
        window.gcTableFacets.reapplyPersistedFilters(filtersDrawer, prefix);
      }
      if (interfaceZonePresenceFacet) applyInterfaceZonePresenceFacetDefaults(false);
      maybeMigrateLegacyQuickEntityFilter();
      applyRowFilter();
      syncQuickEntityTypeNavFromFacets();
      lazyMountInProgress = false;
      lazyMountTotalRows = 0;
      if (table) table.removeAttribute("aria-busy");
      if (afterRenderFromApi) afterRenderFromApi(data);
      if (window.gcTableSort && table) window.gcTableSort.bindTable(table);
      bindIpHostSelectAllOnce();
      syncIpHostSelectAllHeader();
      return;
    }

    var facetMaps = rows.map(function (r) {
      var c0 = r.cells || {};
      var fm = {};
      Object.keys(c0).forEach(function (k) {
        if (!skipColFacetPicker(k)) fm[k] = c0[k];
      });
      augmentInterfaceFacetMap(fm, c0);
      return fm;
    });

    if (filtersDrawer && window.gcTableFacets) {
      window.gcTableFacets.rebuild(filtersDrawer, facetColumnEntriesForRebuild(), facetMaps, prefix);
    }
    if (interfaceZonePresenceFacet) mountInterfaceZonePresenceFacet();
    if (ipHostTable) mountIpHostExcludeFacet();
    if (filtersDrawer && window.gcTableFacets && window.gcTableFacets.reapplyPersistedFilters) {
      window.gcTableFacets.reapplyPersistedFilters(filtersDrawer, prefix);
    }
    if (interfaceZonePresenceFacet) applyInterfaceZonePresenceFacetDefaults(false);

    var trF = document.createElement("tr");
    trF.id = prefix + "-filter-empty";
    trF.hidden = true;
    var tdF = document.createElement("td");
    tdF.className = "muted";
    tdF.textContent = L.emptyFilter;
    trF.appendChild(tdF);
    tbody.appendChild(trF);

    var dataTrs = rows.map(function (row) {
      return buildDataTrFromRow(row);
    });

    function finishNetworkTableRender() {
      if (gen !== tableRenderGen) return;
      lazyMountInProgress = false;
      lazyMountTotalRows = 0;
      if (table) table.removeAttribute("aria-busy");
      syncPlaceholderColspan();
      applyColVis(colVis);
      maybeMigrateLegacyQuickEntityFilter();
      applyRowFilter();
      syncQuickEntityTypeNavFromFacets();
      buildColMenuList();
      if (afterRenderFromApi) afterRenderFromApi(data);
      if (window.gcTableSort && table) window.gcTableSort.bindTable(table);
      bindIpHostSelectAllOnce();
      syncIpHostSelectAllHeader();
    }

    var lazy = window.gcTableLazy;
    if (!lazy || typeof lazy.appendBefore !== "function") {
      dataTrs.forEach(function (tr) {
        tbody.insertBefore(tr, trF);
      });
      finishNetworkTableRender();
      return;
    }

    lazyMountTotalRows = dataTrs.length;
    lazyMountInProgress = lazyMountTotalRows > lazy.DEFAULT_THRESHOLD;
    if (table && lazyMountInProgress) table.setAttribute("aria-busy", "true");

    lazy.appendBefore(tbody, dataTrs, trF, {
      isCancelled: function () {
        return gen !== tableRenderGen;
      },
      onProgress: function () {
        if (gen !== tableRenderGen) return;
        applyColVis(colVis);
        applyRowFilter();
      },
      onComplete: function () {
        if (gen !== tableRenderGen) return;
        finishNetworkTableRender();
      },
    });
  }

  function refresh() {
    if (!tbody) {
      try {
        console.error("gcCreateNetworkEntityTable: missing tbody for prefix", prefix);
      } catch (eLog) {}
      return;
    }
    if (!apiUrl || typeof apiUrl !== "string") {
      try {
        console.error("gcCreateNetworkEntityTable: missing apiUrl for prefix", prefix);
      } catch (eLog2) {}
      renderEmptyMessage((L && L.loadError) || "Could not load table.", prefix + "-placeholder");
      if (afterRenderFromApi) afterRenderFromApi({});
      return;
    }
    var ids = resolveSelectedIdsForTable();
    var selectedCfgs = resolveExplicitConfigurationIdsSelected();
    var cfgOnly = selectedCfgs.length > 0;
    var effCfgs = resolveEffectiveConfigurationIdsForApi();
    if (ids.length === 0 && !cfgOnly) {
      COLS = [];
      if (thead) {
        thead.innerHTML = "";
        var htr = document.createElement("tr");
        var th = document.createElement("th");
        th.scope = "col";
        th.setAttribute("data-gc-col", "_placeholder");
        th.textContent = "—";
        htr.appendChild(th);
        thead.appendChild(htr);
      }
      renderEmptyMessage(emptySelectMsg, prefix + "-placeholder");
      if (searchIn) searchIn.value = "";
      if (window.gcTableFacets && window.gcTableFacets.clearToolbarSearchStorage) {
        window.gcTableFacets.clearToolbarSearchStorage(prefix);
      }
      if (filtersDrawer && window.gcTableFacets) {
        window.gcTableFacets.reset(filtersDrawer, prefix);
        filtersDrawer.innerHTML = "";
      }
      updateFacetChrome();
      if (afterRenderFromApi) afterRenderFromApi({});
      return;
    }
    if (ids.length === 0 && cfgOnly && effCfgs.length === 0) {
      COLS = [];
      if (thead) {
        thead.innerHTML = "";
        var htr2 = document.createElement("tr");
        var th2 = document.createElement("th");
        th2.scope = "col";
        th2.setAttribute("data-gc-col", "_placeholder");
        th2.textContent = "—";
        htr2.appendChild(th2);
        thead.appendChild(htr2);
      }
      renderEmptyMessage(
        "No configurations match the current exclusive view. Turn off the eye icon next to a configuration or adjust your selection.",
        prefix + "-placeholder",
      );
      if (searchIn) searchIn.value = "";
      if (window.gcTableFacets && window.gcTableFacets.clearToolbarSearchStorage) {
        window.gcTableFacets.clearToolbarSearchStorage(prefix);
      }
      if (filtersDrawer && window.gcTableFacets) {
        window.gcTableFacets.reset(filtersDrawer, prefix);
        filtersDrawer.innerHTML = "";
      }
      updateFacetChrome();
      if (afterRenderFromApi) afterRenderFromApi({});
      return;
    }

    tbody.innerHTML = "";
    var trL = document.createElement("tr");
    trL.id = prefix + "-loading";
    var tdL = document.createElement("td");
    tdL.className = "muted";
    tdL.textContent = "Loading…";
    trL.appendChild(tdL);
    tbody.appendChild(trL);
    syncPlaceholderColspan();

    var url = apiUrl + "?" + idsQueryParam + "=" + encodeURIComponent(ids.join(","));
    if (idsQueryParam !== "configuration_ids" && effCfgs.length > 0) {
      url += "&configuration_ids=" + encodeURIComponent(effCfgs.join(","));
    }
    if (apiEntityType) {
      url += "&entity_type=" + encodeURIComponent(apiEntityType);
    }
    if (combineQuery && combineQuery.param) {
      var cbx = combineQuery.inputId ? document.getElementById(combineQuery.inputId) : null;
      var combinedOn = !cbx || cbx.checked;
      url += "&" + combineQuery.param + "=" + (combinedOn ? "true" : "false");
    }
    fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, body: j };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          renderEmptyMessage(L.loadError, prefix + "-placeholder");
          if (afterRenderFromApi) afterRenderFromApi({});
          return;
        }
        renderFromApi(res.body);
      })
      .catch(function () {
        renderEmptyMessage(L.loadError, prefix + "-placeholder");
        if (afterRenderFromApi) afterRenderFromApi({});
      });
  }

  function filterColMenuList() {
    var q = (colsFilter && colsFilter.value ? colsFilter.value : "").trim().toLowerCase();
    if (!colsList) return;
    colsList.querySelectorAll("li[data-col-label]").forEach(function (li) {
      var lab = (li.dataset.colLabel || "").toLowerCase();
      li.hidden = q !== "" && lab.indexOf(q) === -1;
    });
  }

  function buildColMenuList() {
    if (!colsList) return;
    colsList.innerHTML = COLS.filter(function (c) {
      return !skipColFacetPicker(c.id);
    }).map(function (c) {
      var menuLab = nameAsZonePill ? zoneColMenuLabelText(c.label) : c.label;
      return (
        '<li class="toolbar__cols-item" data-col-id="' +
        escapeHtml(c.id) +
        '" data-col-label="' +
        escapeHtml(String(menuLab).toLowerCase()) +
        '">' +
        '<label class="toolbar__cols-label">' +
        "<input type=\"checkbox\" " +
        colPickerAttr +
        '="' +
        escapeHtml(c.id) +
        '" ' +
        (colVis[c.id] ? "checked" : "") +
        " />" +
        "<span>" +
        escapeHtml(menuLab) +
        "</span>" +
        "</label>" +
        "</li>"
      );
    }).join("");
    filterColMenuList();
  }

  function positionColsDropdown() {
    var btn = colsTrigger;
    var panel = colsPanel;
    var modal = colsModal;
    if (!btn || !panel || !modal || modal.hidden) return;
    panel.style.maxHeight = "";
    var r = btn.getBoundingClientRect();
    var gap = 6;
    var margin = 8;
    var pw = panel.offsetWidth || Math.min(380, window.innerWidth - 2 * margin);
    var left = r.left;
    if (left + pw > window.innerWidth - margin) left = window.innerWidth - margin - pw;
    left = Math.max(margin, left);
    var topBelow = r.bottom + gap;
    panel.style.left = left + "px";
    panel.style.top = topBelow + "px";
    var after = panel.getBoundingClientRect();
    if (after.bottom > window.innerHeight - margin) {
      var aboveTop = r.top - gap - after.height;
      if (aboveTop >= margin) panel.style.top = aboveTop + "px";
      else {
        panel.style.top = margin + "px";
        panel.style.maxHeight = Math.max(120, window.innerHeight - 2 * margin) + "px";
      }
    }
  }

  function setColPanelOpen(open) {
    if (!colsModal || !colsTrigger) return;
    colsModal.hidden = !open;
    colsModal.setAttribute("aria-hidden", open ? "false" : "true");
    colsTrigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open && colsPanel) {
      colsPanel.style.top = "";
      colsPanel.style.left = "";
      colsPanel.style.maxHeight = "";
    }
    if (open) {
      requestAnimationFrame(function () {
        requestAnimationFrame(positionColsDropdown);
      });
    }
  }

  function openColsFromTrigger() {
    var willOpen = colsModal.hidden;
    if (COLS.length < 1) return;
    setColPanelOpen(willOpen);
    if (willOpen) {
      buildColMenuList();
      colsFilter && colsFilter.focus();
    }
  }

  if (searchIn) {
    if (window.gcTableFacets && window.gcTableFacets.bindToolbarSearch) {
      window.gcTableFacets.bindToolbarSearch(searchIn, prefix, applyRowFilter);
    } else {
      searchIn.addEventListener("input", applyRowFilter);
    }
  }

  document.getElementById(prefix + "-filters-toggle") &&
    document.getElementById(prefix + "-filters-toggle").addEventListener("click", function () {
      var aside = document.getElementById(prefix + "-filters-aside");
      var collapsed = aside && aside.classList.contains("filters--collapsed");
      setFiltersAsideCollapsed(!collapsed);
    });

  document.getElementById(prefix + "-facet-reset") &&
    document.getElementById(prefix + "-facet-reset").addEventListener("click", function () {
      if (filtersDrawer && window.gcTableFacets) window.gcTableFacets.reset(filtersDrawer, prefix);
      resetExcludeSystemDefault();
      if (interfaceZonePresenceFacet) {
        try {
          sessionStorage.removeItem(zonePresenceTouchStorageKey());
        } catch (eFz) {}
        mountInterfaceZonePresenceFacet();
        if (filtersDrawer && window.gcTableFacets && window.gcTableFacets.reapplyPersistedFilters) {
          window.gcTableFacets.reapplyPersistedFilters(filtersDrawer, prefix);
        }
        applyInterfaceZonePresenceFacetDefaults(true);
      }
      updateFacetChrome();
      syncQuickEntityTypeNavFromFacets();
      applyRowFilter();
    });

  if (filtersAside && window.gcTableFacets) {
    window.gcTableFacets.bindAside(
      filtersAside,
      function () {
        updateFacetChrome();
        syncQuickEntityTypeNavFromFacets();
        applyRowFilter();
      },
      prefix,
    );
  }

  if (colsTrigger) {
    colsTrigger.addEventListener("click", function (e) {
      e.stopPropagation();
      openColsFromTrigger();
    });
    colsTrigger.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openColsFromTrigger();
      }
    });
  }
  colsFilter &&
    colsFilter.addEventListener("input", function () {
      filterColMenuList();
    });
  colsClose &&
    colsClose.addEventListener("click", function () {
      setColPanelOpen(false);
      colsTrigger && colsTrigger.focus();
    });
  colsModal &&
    colsModal.querySelector(".fw-cols-modal__backdrop") &&
    colsModal.querySelector(".fw-cols-modal__backdrop").addEventListener("click", function () {
      setColPanelOpen(false);
      colsTrigger && colsTrigger.focus();
    });
  colsList &&
    colsList.addEventListener("change", function (e) {
      var cb = e.target.closest("input[" + colPickerAttr + "]");
      if (!cb) return;
      var id = cb.getAttribute(colPickerAttr);
      if (!id) return;
      if (!Object.prototype.hasOwnProperty.call(colVis, id)) return;
      colVis[id] = cb.checked;
      var n = 0;
      COLS.forEach(function (c) {
        if (colVis[c.id]) n++;
      });
      if (n < 1) {
        cb.checked = true;
        colVis[id] = true;
        return;
      }
      persistColVis(colVis);
      applyColVis(colVis);
      syncPlaceholderColspan();
      applyRowFilter();
    });

  document.addEventListener("mousedown", function (e) {
    if (!colsModal || colsModal.hidden) return;
    if ((colsTrigger && colsTrigger.contains(e.target)) || (colsPanel && colsPanel.contains(e.target))) return;
    setColPanelOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && colsModal && !colsModal.hidden) {
      setColPanelOpen(false);
      colsTrigger && colsTrigger.focus();
    }
  });
  function repositionColsIfOpen() {
    if (colsModal && !colsModal.hidden) positionColsDropdown();
  }
  window.addEventListener("resize", repositionColsIfOpen);
  window.addEventListener("scroll", repositionColsIfOpen, true);

  bindEntityTypeQuickFilterOnce();
  if (entityTypeQuickFilterOn) syncQuickEntityTypeNavFromFacets();

  updateFacetChrome();

  var pageSyncBtn = document.getElementById(prefix + "-page-sync");
  if (pageSyncBtn) {
    function rowFirewallIdsFromPayload(row) {
      var out = [];
      var seen = {};
      function add(id) {
        var n = parseInt(String(id), 10);
        if (isNaN(n) || n < 1 || seen[n]) return;
        seen[n] = true;
        out.push(n);
      }
      if (!row) return out;
      if (row.configuration_id != null && row.firewall_id == null) return out;
      if (row.firewall_id != null) add(row.firewall_id);
      if (Array.isArray(row.firewall_ids)) row.firewall_ids.forEach(add);
      var targets =
        row.hs_edit_targets ||
        row.ip_host_edit_targets ||
        row.schedule_edit_targets ||
        row.accesstime_edit_targets ||
        row.surfingquota_edit_targets ||
        row.datatransfer_edit_targets ||
        row.vpnprofile_edit_targets ||
        row.adminprofile_edit_targets;
      if (Array.isArray(targets)) {
        targets.forEach(function (t) {
          if (t && t.firewall_id != null) add(t.firewall_id);
        });
      }
      return out;
    }

    function collectVisibleSyncJobs() {
      var selected = [];
      if (typeof window.gcGetSelectedFirewallIds === "function") {
        selected = window.gcGetSelectedFirewallIds() || [];
      }
      if ((!selected || !selected.length) && typeof cfg.getSelectedIds === "function") {
        try {
          selected = cfg.getSelectedIds() || [];
        } catch (eScope) {
          selected = [];
        }
      }
      if (!selected || !selected.length) {
        if (typeof window.gcGetSelectedFirewallIds !== "function") {
          return { error: "Firewall selection is not available on this page.", jobs: null };
        }
        return { error: emptySelectMsg, jobs: null };
      }
      var sel = {};
      selected.forEach(function (id) {
        var n = parseInt(String(id), 10);
        if (!isNaN(n) && n > 0) sel[String(n)] = true;
      });
      var byFw = {};
      Object.keys(sel).forEach(function (sk) {
        var n = parseInt(sk, 10);
        if (!isNaN(n) && n > 0) byFw[n] = {};
      });
      var rows = tbody ? tbody.querySelectorAll("tr." + dataRowClass) : [];
      rows.forEach(function (tr) {
        if (tr.hidden) return;
        var row = tr._gcNetRow;
        if (!row) return;
        var et = (row.entity_type || apiEntityType || "").trim();
        if (!et) return;
        rowFirewallIdsFromPayload(row).forEach(function (fid) {
          if (!sel[String(fid)]) return;
          if (!byFw[fid]) byFw[fid] = {};
          byFw[fid][et] = true;
        });
      });
      var fwSorted = Object.keys(byFw)
        .map(function (k) {
          return parseInt(k, 10);
        })
        .filter(function (n) {
          return !isNaN(n) && n > 0;
        })
        .sort(function (a, b) {
          return a - b;
        });
      var jobs = fwSorted.map(function (fid) {
        var rowTypes = byFw[fid] || {};
        var rowDerivedCount = Object.keys(rowTypes).length;
        var ents = {};
        Object.keys(rowTypes).forEach(function (k) {
          ents[k] = true;
        });
        pageSyncExtraEntities.forEach(function (ex) {
          ents[ex] = true;
        });
        if (rowDerivedCount === 0) {
          if (apiEntityType) ents[apiEntityType] = true;
          pageSyncFallbackEntities.forEach(function (fb) {
            if (fb) ents[fb] = true;
          });
        }
        return { firewallId: fid, entities: Object.keys(ents).sort() };
      });
      return { error: null, jobs: jobs };
    }

    function configSyncTableBannerMessage(res) {
      var body = res.body || {};
      if (res.status === 404) return { ok: false, text: "Firewall not found." };
      if (res.status === 202 && body.accepted) {
        return {
          ok: true,
          text:
            "Configuration sync started in the background. You can keep navigating; refresh this page when it finishes.",
        };
      }
      if (body.skipped) return { ok: false, text: body.message || "Nothing to sync." };
      if (body.ok) {
        var a = body.added || 0;
        var c = body.changed || 0;
        var d = body.deleted || 0;
        if (a + c + d === 0) return { ok: true, text: "Sync finished — no changes." };
        return {
          ok: true,
          text: "Sync finished — " + a + " added, " + c + " updated, " + d + " removed.",
        };
      }
      return { ok: false, text: body.error || body.detail || "Sync failed." };
    }

    function configSyncTableUseBatchApi() {
      return (
        typeof window.gcGlobalBannerSyncBegin === "function" &&
        typeof window.gcGlobalBannerSyncEnd === "function"
      );
    }

    function fetchTablePageConfigSync(fwId, entityIds) {
      var url = "/api/firewalls/" + encodeURIComponent(fwId) + "/config-sync";
      return fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "Ground-Control",
        },
        body: JSON.stringify({ entities: entityIds }),
      }).then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, status: r.status, body: j };
        });
      });
    }

    function dispatchConfigCacheSyncedOne(fwId) {
      var n = parseInt(String(fwId), 10);
      if (isNaN(n) || n < 1) return;
      try {
        document.dispatchEvent(
          new CustomEvent("gc-config-cache-synced", { detail: { firewall_ids: [n] } }),
        );
      } catch (eSync) { }
    }

    var TABLE_PAGE_SYNC_MSG = "Syncing configuration cache from firewalls…";

    pageSyncBtn.addEventListener("click", function () {
      var plan = collectVisibleSyncJobs();
      if (plan.error) {
        if (typeof window.gcGlobalBannerShowResult === "function") {
          window.gcGlobalBannerShowResult(false, plan.error);
        }
        return;
      }
      var jobs = plan.jobs;
      var batch = configSyncTableUseBatchApi();
      var bid = batch ? window.gcGlobalBannerSyncBegin(TABLE_PAGE_SYNC_MSG) : 0;
      pageSyncBtn.disabled = true;
      pageSyncBtn.classList.add("btn-icon--busy");
      var ok = 0;
      var fail = 0;
      var asyncOk = 0;
      var lastFail = "";
      var i = 0;
      function finishMulti() {
        pageSyncBtn.disabled = false;
        pageSyncBtn.classList.remove("btn-icon--busy");
        var n = jobs.length;
        if (batch) {
          if (fail === 0) {
            var allAsync = ok === n && asyncOk === n && n > 0;
            var doneMsg = allAsync
              ? (n === 1
                ? "Started background configuration sync for 1 firewall. You can keep navigating; refresh when it finishes."
                : "Started background configuration sync for " +
                n +
                " firewalls. You can keep navigating; refresh when it finishes.")
              : n === 1
                ? "Sync finished for 1 firewall."
                : "Sync finished for " + n + " firewalls.";
            if (allAsync && typeof window.gcGlobalBannerTrackBackgroundSync === "function") {
              window.gcGlobalBannerTrackBackgroundSync(doneMsg, {
                firewall_ids: jobs.map(function (j) {
                  return j.firewallId;
                }),
              });
            } else {
              window.gcGlobalBannerSyncEnd(bid, true, doneMsg);
            }
          } else if (ok === 0) {
            window.gcGlobalBannerSyncEnd(bid, false, lastFail || "Sync failed.");
          } else {
            window.gcGlobalBannerSyncEnd(
              bid,
              false,
              ok + " of " + n + " succeeded. " + (lastFail || ""),
            );
          }
        } else if (typeof window.gcGlobalBannerShowResult === "function") {
          var allAsyncNb = fail === 0 && ok === n && asyncOk === n && n > 0;
          var doneMsgNb = allAsyncNb
            ? (n === 1
              ? "Started background configuration sync for 1 firewall. You can keep navigating; refresh when it finishes."
              : "Started background configuration sync for " +
              n +
              " firewalls. You can keep navigating; refresh when it finishes.")
            : fail === 0
              ? "Sync finished."
              : ok + " of " + n + " succeeded. " + (lastFail || "");
          if (fail === 0 && allAsyncNb && typeof window.gcGlobalBannerTrackBackgroundSync === "function") {
            window.gcGlobalBannerTrackBackgroundSync(doneMsgNb, {
              firewall_ids: jobs.map(function (j) {
                return j.firewallId;
              }),
            });
          } else {
            window.gcGlobalBannerShowResult(fail === 0, doneMsgNb);
          }
        }
      }
      function step() {
        if (i >= jobs.length) {
          finishMulti();
          return;
        }
        var job = jobs[i++];
        fetchTablePageConfigSync(job.firewallId, job.entities)
          .then(function (res) {
            var msg = configSyncTableBannerMessage(res);
            var body = res.body || {};
            if (msg.ok && !body.skipped) {
              ok++;
              if (res.status === 202) asyncOk++;
              else dispatchConfigCacheSyncedOne(job.firewallId);
            } else {
              fail++;
              lastFail = msg.text;
            }
          })
          .catch(function () {
            fail++;
            lastFail = "Request failed.";
          })
          .then(function () {
            step();
          });
      }
      step();
    });
  }

  bindCombineSyncSelectedOnce();

  return {
    refresh: refresh,
    updateFacetChrome: updateFacetChrome,
    compactZoneFirewallCells: compactZoneFirewallCells,
    applyRowFilter: applyRowFilter,
    getDeleteConfigEntryIdsFromSelection: getDeleteConfigEntryIdsFromSelection,
    syncIpHostSelectAllHeader: syncIpHostSelectAllHeader,
  };
}
