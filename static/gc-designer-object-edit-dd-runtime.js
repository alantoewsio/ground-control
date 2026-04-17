/**
 * Canonical dropdown + member-lookup runtime for the object-edit flyout
 * (#gc-designer-flyout-object-edit-modal). Exposes the
 * __gcDesignerControlsBridge.ddFieldRuntime / catalogFieldUi surface the catalog expects.
 *
 * This file is loaded on every page that opens the object-edit flyout, including
 * Designer pages that also load partials/gc_designer_controls_scripts.html (which
 * contains a legacy inline copy of the same runtime for its sandbox/demo widgets).
 * We intentionally register last so both Firewalls v2 and Designer use this single
 * flyout-aware implementation — that's what guarantees the flyout member-lookup
 * control behaves identically on both pages (correct "N selected" status line and
 * proper reconciliation of pending multi-selection against freshly-loaded rows).
 */
(function () {
  "use strict";

  var ddRoots = [];
  var layoutLocksCache = null;
  var layoutLocksFetchPromise = null;

  function invalidateLayoutLocksCache() {
    layoutLocksCache = null;
    layoutLocksFetchPromise = null;
  }
  globalThis.gcInvalidateDataControlsLayoutLocksCache = invalidateLayoutLocksCache;

  function fetchLayoutLocksMap() {
    if (layoutLocksCache && typeof layoutLocksCache === "object") {
      return Promise.resolve(layoutLocksCache);
    }
    if (layoutLocksFetchPromise) return layoutLocksFetchPromise;
    layoutLocksFetchPromise = fetch("/api/firewalls/config-ui/data-controls-layout-locks", {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok && j && j.ok, locks: j && j.locks };
        });
      })
      .then(function (res) {
        layoutLocksFetchPromise = null;
        layoutLocksCache =
          res.ok && res.locks && typeof res.locks === "object" ? res.locks : {};
        return layoutLocksCache;
      })
      .catch(function () {
        layoutLocksFetchPromise = null;
        layoutLocksCache = {};
        return layoutLocksCache;
      });
    return layoutLocksFetchPromise;
  }

  function syncAllLayoutLockCheckboxesForEt(et, checked) {
    var s = String(et || "");
    var q =
      'input.gc-designer-dd__layout-lock-cb[data-gc-dd-layout-lock-et="' +
      s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
      '"]';
    document.querySelectorAll(q).forEach(function (cb) {
      cb.checked = !!checked;
    });
  }

  if (!document.documentElement.dataset.gcDdLayoutLockDelegation) {
    document.documentElement.dataset.gcDdLayoutLockDelegation = "1";
    document.addEventListener("change", function (ev) {
      var t = ev.target;
      if (!t || !t.matches || !t.matches("input.gc-designer-dd__layout-lock-cb")) return;
      if (globalThis.GC_CAN_EDIT_DATA_CONTROLS_LAYOUT_LOCK !== true) return;
      var et = String(t.getAttribute("data-gc-dd-layout-lock-et") || "").trim();
      if (!et) return;
      var want = !!t.checked;
      ev.stopPropagation();
      fetch(
        "/api/designer/data-controls-layout/" + encodeURIComponent(et) + "/layout-locked",
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "Ground-Control",
          },
          body: JSON.stringify({ layout_locked: want }),
        },
      )
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok && j && j.ok };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            t.checked = !want;
            return;
          }
          invalidateLayoutLocksCache();
          syncAllLayoutLockCheckboxesForEt(et, want);
        })
        .catch(function () {
          t.checked = !want;
        });
    });
  }

  var LIST_COL_LABELS = {
    __firewall: "Scope",
    entity_type: "Type",
    HostType: "Host type",
    Description: "Description",
    IPAddress: "IP address",
  };

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getCell(row, key) {
    var cells = row.cells || {};
    if (key === "__name") return String(cells.__name != null ? cells.__name : "").trim();
    if (key === "__firewall") return String(cells.__firewall || cells.__firewalls || "").trim();
    if (key === "entity_type") return String(row.entity_type || "").trim();
    return String(cells[key] != null ? cells[key] : "").trim();
  }

  function hostTypeSlug(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    s = s.replace(/([a-z])([A-Z])/g, "$1 $2");
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function iconClasses(row) {
    var et = row.entity_type || "";
    var base = "gc-designer-dd__icon gc-designer-dd__icon--et-" + et.replace(/_/g, "-");
    if (et !== "ip_host") return base;
    var ht = hostTypeSlug((row.flat && row.flat.HostType) || "");
    return base + (ht ? " gc-designer-dd__icon--ht-" + ht : "");
  }

  function navIconMapForDdRows() {
    var m = globalThis.GC_ENTITY_TYPE_NAV_ICONS;
    return m && typeof m === "object" ? m : null;
  }

  function rowLeadingVisualHtml(row, navIconMap) {
    var et = String(row.entity_type || "").trim();
    var raw =
      navIconMap && Object.prototype.hasOwnProperty.call(navIconMap, et)
        ? String(navIconMap[et] != null ? navIconMap[et] : "").trim()
        : "";
    if (raw) {
      return (
        '<span class="gc-designer-dd__leading gc-designer-dd__leading--nav-icon" aria-hidden="true">' +
        '<span class="gc-material-symbol gc-designer-dd__material-icon">' +
        escapeHtml(raw) +
        "</span></span>"
      );
    }
    if (navIconMap) return "";
    var iconCl = iconClasses(row);
    return (
      '<span class="gc-designer-dd__leading gc-designer-dd__leading--swatch" aria-hidden="true">' +
      '<span class="' +
      iconCl +
      '"></span></span>'
    );
  }

  function isFlyoutMemberLookupRoot(root) {
    return (
      !!root &&
      root.classList &&
      root.classList.contains("gc-designer-member-lookup") &&
      !!root.closest("#gc-designer-flyout-object-edit-modal")
    );
  }

  function memberLookupFlyoutSelectedCount(root) {
    var list = root.querySelector(".gc-designer-dd__list");
    if (!list) return 0;
    if (root.classList.contains("gc-designer-dd--multi")) {
      var n = 0;
      list.querySelectorAll(".gc-designer-dd__check input[type=\"checkbox\"]").forEach(function (cb) {
        if (cb.checked) n++;
      });
      return n;
    }
    var tr = root.querySelector(".gc-designer-dd__trigger");
    return tr && tr.getAttribute("data-gc-dd-value") ? 1 : 0;
  }

  function formatFlyoutMemberLookupStatusLine(n) {
    if (n === 0) return "No objects selected";
    if (n === 1) return "1 object selected";
    return n + " objects selected";
  }

  function refreshMemberLookupFlyoutStatus(root, statusEl) {
    if (!statusEl || !isFlyoutMemberLookupRoot(root)) return;
    statusEl.textContent = formatFlyoutMemberLookupStatusLine(memberLookupFlyoutSelectedCount(root));
    statusEl.classList.remove("is-error");
  }

  function rowStableValue(row) {
    var et = row.entity_type || "";
    var sid =
      row.firewall_id != null
        ? "f:" + row.firewall_id
        : row.configuration_id != null
          ? "c:" + row.configuration_id
          : "x";
    return et + "|" + sid + "|" + row.config_entry_id;
  }

  function readScopeFromSource(fs) {
    var scopeEl = fs.querySelector("[data-gc-dd-scope]");
    var custom = scopeEl && scopeEl.value === "custom";
    var fw = "";
    var cfg = "";
    if (!custom) {
      if (typeof globalThis.gcGetSelectedFirewallIds === "function") {
        var a = globalThis.gcGetSelectedFirewallIds();
        if (a && a.length) fw = a.join(",");
      }
      if (typeof globalThis.gcGetSelectedConfigurationIds === "function") {
        var b = globalThis.gcGetSelectedConfigurationIds();
        if (b && b.length) cfg = b.join(",");
      }
    } else {
      var fwi = fs.querySelector("[data-gc-dd-fw-ids]");
      var cfi = fs.querySelector("[data-gc-dd-cfg-ids]");
      fw = fwi ? String(fwi.value || "").trim().replace(/\s+/g, "") : "";
      cfg = cfi ? String(cfi.value || "").trim().replace(/\s+/g, "") : "";
    }
    return { custom: custom, firewall_ids: fw, configuration_ids: cfg };
  }

  function readCheckedValues(fs, sel) {
    var out = [];
    if (!fs) return out;
    fs.querySelectorAll(sel).forEach(function (cb) {
      if (cb.checked) out.push(cb.value);
    });
    return out;
  }

  function dedupeDesignerDdRowsByName(rows) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var name = (getCell(r, "__name") || r.external_name || "").trim();
      var et = String(r.entity_type || "");
      var key = et + "\0" + name.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      out.push(r);
    }
    return out;
  }

  function layoutLockCellHtml(etRaw, locksMap) {
    var et = String(etRaw || "").trim();
    if (!et) return "";
    var locked = !!(locksMap && locksMap[et]);
    var canEdit = globalThis.GC_CAN_EDIT_DATA_CONTROLS_LAYOUT_LOCK === true;
    return (
      '<span class="gc-designer-dd__layout-lock-wrap">' +
      '<label class="gc-designer-dd__layout-lock" title="Designer layout map locked for ' +
      escapeAttr(et) +
      ' (toggle requires Designer role)">' +
      '<input type="checkbox" class="gc-designer-dd__layout-lock-cb" tabindex="-1" data-gc-dd-layout-lock-et="' +
      escapeAttr(et) +
      '" ' +
      (locked ? "checked " : "") +
      (!canEdit ? "disabled " : "") +
      'aria-label="Layout locked for ' +
      escapeAttr(et) +
      '" />' +
      '<span class="gc-designer-dd__layout-lock-ui" aria-hidden="true"></span>' +
      "</label></span>"
    );
  }

  function renderRowHtml(row, cols, isMulti, locksMap, rowCtx) {
    rowCtx = rowCtx || {};
    var omitLayoutLock = !!rowCtx.omitLayoutLock;
    var navIconMap = rowCtx.navIconMap != null ? rowCtx.navIconMap : null;
    var etType = String(row.entity_type || getCell(row, "entity_type") || "").trim();
    var lockHtml = omitLayoutLock ? "" : layoutLockCellHtml(etType, locksMap || {});
    var primary = getCell(row, "__name") || row.external_name || "—";
    var metaParts = [];
    for (var i = 0; i < cols.length; i++) {
      var k = cols[i];
      if (k === "__name") continue;
      var v = getCell(row, k);
      if (!v) continue;
      metaParts.push((LIST_COL_LABELS[k] || k) + ": " + v);
    }
    var meta = metaParts.join(" · ");
    var val = rowStableValue(row);
    var lead = rowLeadingVisualHtml(row, navIconMap);
    var rowInner =
      lead +
      '<span class="gc-designer-dd__row-text"><span class="gc-designer-dd__primary">' +
      escapeHtml(primary) +
      "</span>" +
      (meta ? '<span class="gc-designer-dd__meta">' + escapeHtml(meta) + "</span>" : "") +
      "</span>";
    if (!isMulti) {
      return (
        '<li role="option" aria-selected="false" tabindex="-1" data-value="' +
        escapeAttr(val) +
        '" data-gc-dd-primary="' +
        escapeAttr(primary) +
        '">' +
        lockHtml +
        rowInner +
        "</li>"
      );
    }
    return (
      '<li role="option" aria-selected="false" tabindex="-1" data-value="' +
      escapeAttr(val) +
      '" data-gc-dd-primary="' +
        escapeAttr(primary) +
        '">' +
        lockHtml +
        '<label class="gc-designer-dd__check"><input type="checkbox" />' +
        rowInner +
        "</label></li>"
    );
  }

  function normalizeDdMultiSelectionTokens(items) {
    var seen = Object.create(null);
    var out = [];
    function pushOne(raw) {
      var t = String(raw != null ? raw : "").trim();
      if (!t || seen[t]) return;
      seen[t] = true;
      out.push(t);
    }
    function expand(str) {
      var s = String(str != null ? str : "").trim();
      if (!s) return;
      if (s.charAt(0) === "[") {
        try {
          var j = JSON.parse(s);
          if (Array.isArray(j)) {
            j.forEach(function (x) {
              pushOne(String(x != null ? x : ""));
            });
            return;
          }
        } catch (eJsonTok) {}
      }
      if (s.indexOf("\x1e") >= 0) {
        s.split("\x1e").forEach(pushOne);
        return;
      }
      if (/\r?\n/.test(s)) {
        s.split(/\r?\n/).forEach(pushOne);
        return;
      }
      s.split(/[,;]\s*/).forEach(pushOne);
    }
    if (items == null) return [];
    if (typeof items === "string") {
      expand(items);
      return out;
    }
    (Array.isArray(items) ? items : []).forEach(function (x) {
      if (typeof x === "string") expand(x);
      else if (x && x.value != null) expand(String(x.value));
    });
    return out;
  }

  function tokenMatchesDdRow(tok, dataValue, primary) {
    var t = String(tok || "").trim();
    if (!t) return false;
    var dv = String(dataValue || "");
    if (t === dv) return true;
    var pr = String(primary || "").trim();
    if (pr && t === pr) return true;
    if (pr && t.toLowerCase() === pr.toLowerCase()) return true;
    return false;
  }

  function applyDdMultiSelectionTokens(root, tokens) {
    if (!root || !root.classList.contains("gc-designer-dd--multi")) return;
    var list = root.querySelector(".gc-designer-dd__list");
    if (!list) return;
    var toks = Array.isArray(tokens) ? tokens : normalizeDdMultiSelectionTokens(tokens);
    if (!toks.length) {
      list.querySelectorAll("li[role='option']").forEach(function (li) {
        var cb = li.querySelector(".gc-designer-dd__check input[type='checkbox']");
        if (cb) {
          cb.checked = false;
          li.setAttribute("aria-selected", "false");
        }
      });
      if (root._gcDdRefreshMultiLabel) root._gcDdRefreshMultiLabel();
      if (root.classList.contains("gc-designer-member-lookup") && isFlyoutMemberLookupRoot(root)) {
        refreshMemberLookupFlyoutStatus(root, memberLookupStatusElement(root));
      }
      return;
    }
    var hasRealOptions = false;
    list.querySelectorAll("li[role='option']").forEach(function (li) {
      if (li.classList.contains("gc-designer-dd__empty")) return;
      hasRealOptions = true;
      var dv = li.getAttribute("data-value") || "";
      var pr = li.getAttribute("data-gc-dd-primary") || "";
      var hit = false;
      for (var ti = 0; ti < toks.length; ti++) {
        if (tokenMatchesDdRow(toks[ti], dv, pr)) {
          hit = true;
          break;
        }
      }
      var cb = li.querySelector(".gc-designer-dd__check input[type='checkbox']");
      if (!cb) return;
      cb.checked = !!hit;
      li.setAttribute("aria-selected", hit ? "true" : "false");
    });
    if (!hasRealOptions) return;
    if (root._gcDdRefreshMultiLabel) root._gcDdRefreshMultiLabel();
    if (root.classList.contains("gc-designer-member-lookup") && isFlyoutMemberLookupRoot(root)) {
      refreshMemberLookupFlyoutStatus(root, memberLookupStatusElement(root));
    }
  }

  function reorderMergedForFlyoutMemberLookup(root, merged) {
    if (!Array.isArray(merged) || merged.length < 2) return merged;
    var tokens = null;
    if (root.classList.contains("gc-designer-dd--multi")) {
      var pend = root._gcDdPendingMultiSelection;
      if (Array.isArray(pend) && pend.length) tokens = pend.slice();
    } else {
      var pv = root._gcDdPendingSingleValue;
      if (pv != null && String(pv).trim() !== "") tokens = [String(pv)];
    }
    if (!tokens || !tokens.length) return merged;
    var selected = [];
    var unselected = [];
    for (var i = 0; i < merged.length; i++) {
      var row = merged[i];
      var dv = rowStableValue(row);
      var pr = getCell(row, "__name") || row.external_name || "";
      var hit = false;
      for (var ti = 0; ti < tokens.length; ti++) {
        if (tokenMatchesDdRow(tokens[ti], dv, pr)) {
          hit = true;
          break;
        }
      }
      if (hit) selected.push(row);
      else unselected.push(row);
    }
    if (!selected.length) return merged;
    return selected.concat(unselected);
  }

  function reorderFlyoutMemberLookupListDom(root, list, trigger, isMulti) {
    if (!list || !trigger || !isFlyoutMemberLookupRoot(root)) return;
    var items = [];
    list.querySelectorAll("li[role='option']").forEach(function (li) {
      if (li.classList.contains("gc-designer-dd__empty")) return;
      items.push(li);
    });
    if (items.length < 2) return;

    function sortKey(li) {
      var p = String(li.getAttribute("data-gc-dd-primary") || "").toLowerCase();
      var v = String(li.getAttribute("data-value") || "");
      return p || v;
    }
    function cmp(a, b) {
      var ka = sortKey(a);
      var kb = sortKey(b);
      if (ka !== kb) return ka < kb ? -1 : 1;
      return 0;
    }

    var ordered;
    if (isMulti) {
      var sel = [];
      var unsel = [];
      for (var i = 0; i < items.length; i++) {
        var li = items[i];
        var cb = li.querySelector(".gc-designer-dd__check input[type='checkbox']");
        if (cb && cb.checked) sel.push(li);
        else unsel.push(li);
      }
      if (!sel.length) return;
      sel.sort(cmp);
      unsel.sort(cmp);
      ordered = sel.concat(unsel);
    } else {
      var val = String(trigger.getAttribute("data-gc-dd-value") || "").trim();
      var picked = null;
      if (val) {
        for (var j = 0; j < items.length; j++) {
          var liV = items[j];
          if (String(liV.getAttribute("data-value") || "") === val) {
            picked = liV;
            break;
          }
        }
      }
      if (!picked) {
        for (var k = 0; k < items.length; k++) {
          if (items[k].getAttribute("aria-selected") === "true") {
            picked = items[k];
            break;
          }
        }
      }
      if (!picked) return;
      var rest = [];
      for (var r = 0; r < items.length; r++) {
        if (items[r] !== picked) rest.push(items[r]);
      }
      rest.sort(cmp);
      ordered = [picked].concat(rest);
    }

    for (var z = 0; z < ordered.length; z++) {
      list.appendChild(ordered[z]);
    }
    var empty = list.querySelector("li.gc-designer-dd__empty");
    if (empty) list.appendChild(empty);
  }

  function applyRowsToList(root, merged, cols, statusEl, typesCount, locksMap) {
    var list = root.querySelector(".gc-designer-dd__list");
    if (!list) return;
    var isMulti = root.classList.contains("gc-designer-dd--multi");
    var flyoutMl = isFlyoutMemberLookupRoot(root);
    var rowCtx = {
      omitLayoutLock: flyoutMl,
      navIconMap: flyoutMl ? navIconMapForDdRows() : null,
    };
    if (flyoutMl) merged = reorderMergedForFlyoutMemberLookup(root, merged);
    root._gcDdCachedRows = merged;
    var lm = locksMap && typeof locksMap === "object" ? locksMap : {};
    if (!merged.length) {
      list.innerHTML =
        '<li class="gc-designer-dd__empty" role="presentation" style="cursor:default;color:var(--text-muted,#64748b)">No cached rows for this scope.</li>';
    } else {
      var html = "";
      for (var mi = 0; mi < merged.length; mi++) {
        html += renderRowHtml(merged[mi], cols, isMulti, lm, rowCtx);
      }
      list.innerHTML = html;
    }
    if (statusEl) {
      if (!flyoutMl) {
        statusEl.textContent =
          merged.length + " object(s) from " + typesCount + " type request(s).";
        statusEl.classList.remove("is-error");
      }
    }
    var search = root.querySelector(".gc-designer-dd__search");
    if (search) search.value = "";
    if (isMulti && root._gcDdPendingMultiSelection && root._gcDdPendingMultiSelection.length) {
      applyDdMultiSelectionTokens(root, root._gcDdPendingMultiSelection);
    }
    if (statusEl && flyoutMl) {
      refreshMemberLookupFlyoutStatus(root, statusEl);
    }
    if (root._gcDdFilterList) root._gcDdFilterList();
    if (isMulti && root._gcDdRefreshMultiLabel) root._gcDdRefreshMultiLabel();
    if (!isMulti) {
      var tr = root.querySelector(".gc-designer-dd__trigger");
      if (tr) {
        tr.textContent = "Choose…";
        tr.removeAttribute("data-gc-dd-value");
      }
      var pendSingle = root._gcDdPendingSingleValue;
      if (pendSingle != null && String(pendSingle).trim() !== "") {
        designerDdSetSingleSelection(root, String(pendSingle));
      }
    }
  }

  function designerDdSourceFs(root) {
    if (!root || !root.id) return null;
    var byId = document.getElementById(root.id + "-source-fieldset");
    return byId || root.querySelector(".gc-designer-dd__source");
  }

  function readMemberLookupScopeFromRoot(controlRoot) {
    var modal = controlRoot.closest("#gc-designer-flyout-object-edit-modal");
    if (modal) {
      var ms = modal.querySelector("[data-gc-fw-ms], [data-gc-cfg-ms]");
      if (ms) {
        var useCfg = ms.hasAttribute("data-gc-cfg-ms");
        var idAttr = useCfg ? "data-gc-cfg-id" : "data-gc-fw-id";
        var ids = [];
        ms.querySelectorAll("input[type=\"checkbox\"][" + idAttr + "]").forEach(function (cb) {
          if (!cb.checked) return;
          var n = parseInt(String(cb.getAttribute(idAttr) || ""), 10);
          if (!isNaN(n) && n > 0) ids.push(n);
        });
        if (ids.length) {
          if (useCfg) return { firewall_ids: "", configuration_ids: ids.join(",") };
          return { firewall_ids: ids.join(","), configuration_ids: "" };
        }
      }
    }
    var fw = "";
    var cfg = "";
    if (typeof globalThis.gcGetSelectedFirewallIds === "function") {
      var a = globalThis.gcGetSelectedFirewallIds();
      if (a && a.length) fw = a.join(",");
    }
    if (typeof globalThis.gcGetSelectedConfigurationIds === "function") {
      var b = globalThis.gcGetSelectedConfigurationIds();
      if (b && b.length) cfg = b.join(",");
    }
    return { firewall_ids: fw, configuration_ids: cfg };
  }

  function readDdEntityTypesFromRoot(root, fs) {
    var types = [];
    var j = root && root.getAttribute("data-gc-dd-entity-types");
    if (j) {
      try {
        var arr = JSON.parse(j);
        if (Array.isArray(arr)) {
          arr.forEach(function (x) {
            var t = String(x != null ? x : "").trim();
            if (t && types.indexOf(t) === -1) types.push(t);
          });
        }
      } catch (e0) {}
    }
    if (!types.length && fs) types = readCheckedValues(fs, "[data-gc-dd-entity-type]");
    return types;
  }

  function readDdListColsFromRoot(root, fs) {
    var cols = [];
    if (fs) cols = readCheckedValues(fs, "[data-gc-dd-list-col]");
    if (!cols.length) cols = ["__firewall", "entity_type"];
    return cols;
  }

  function readDdScopeForRoot(root, fs) {
    if (root && root.getAttribute("data-gc-object-edit-dd") === "1") {
      return readMemberLookupScopeFromRoot(root);
    }
    if (!fs) return { firewall_ids: "", configuration_ids: "" };
    var s = readScopeFromSource(fs);
    return { firewall_ids: s.firewall_ids, configuration_ids: s.configuration_ids };
  }

  function isSpecialCountriesEntityType(et) {
    var s = String(et || "").trim().toLowerCase();
    /* Layout / catalog "countries" matches API entity_type ref_countries. */
    return s === "ref_countries" || s === "countries";
  }

  function referenceCountriesApiUrl() {
    var raw = String(globalThis.gcHsReferenceCountriesUrl || "").trim();
    return raw || "/api/reference/countries";
  }

  function rowFromReferenceCountry(item) {
    var obj = item && typeof item === "object" ? item : {};
    var code = String(obj.code != null ? obj.code : "").trim();
    if (!code) return null;
    return {
      entity_type: "ref_countries",
      firewall_id: null,
      configuration_id: null,
      config_entry_id: "country:" + code,
      external_name: code,
      cells: {
        __name: code,
        __firewall: "",
        entity_type: "ref_countries",
      },
      flat: {
        Name: code,
        Code: code,
      },
    };
  }

  function fetchMemberLookupRowsForType(et, scope) {
    var entityType = String(et || "").trim();
    if (isSpecialCountriesEntityType(entityType)) {
      return fetch(referenceCountriesApiUrl(), {
        credentials: "same-origin",
        headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
      }).then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json().then(function (j) {
          var rowsIn = j && Array.isArray(j.countries) ? j.countries : [];
          var out = [];
          for (var i = 0; i < rowsIn.length; i++) {
            var row = rowFromReferenceCountry(rowsIn[i]);
            if (row) out.push(row);
          }
          return { rows: out };
        });
      });
    }
    var tableUrl =
      "/api/firewalls/hosts-services/table?entity_type=" +
      encodeURIComponent(entityType) +
      "&firewall_ids=" +
      encodeURIComponent(scope.firewall_ids) +
      "&configuration_ids=" +
      encodeURIComponent(scope.configuration_ids) +
      "&combine=false&limit=800";
    return fetch(tableUrl, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }

  function loadDesignerDdFromCache(root, statusEl, quietEmptyScope) {
    var fs = designerDdSourceFs(root);
    var list = root.querySelector(".gc-designer-dd__list");
    if (!list) return;
    var scope = readDdScopeForRoot(root, fs);
    var types = readDdEntityTypesFromRoot(root, fs);
    var cols = readDdListColsFromRoot(root, fs);
    if (!types.length) {
      if (statusEl && !quietEmptyScope) {
        statusEl.textContent = "Select at least one object type.";
        statusEl.classList.add("is-error");
      }
      return;
    }
    var scopeOptional = types.every(isSpecialCountriesEntityType);
    if (!scope.firewall_ids && !scope.configuration_ids && !scopeOptional) {
      if (statusEl) {
        if (quietEmptyScope) {
          statusEl.textContent = "";
          statusEl.classList.remove("is-error");
        } else {
          statusEl.textContent =
            root.getAttribute("data-gc-object-edit-dd") === "1"
              ? "Select at least one firewall in the flyout."
              : "No firewalls or configurations in scope — use the top-bar selector or choose Custom IDs.";
          statusEl.classList.add("is-error");
        }
      }
      return;
    }
    if (statusEl) {
      statusEl.classList.remove("is-error");
      statusEl.textContent = "Loading…";
    }
    Promise.all(
      types.map(function (et) {
        return fetchMemberLookupRowsForType(et, scope);
      }),
    )
      .then(function (payloads) {
        return fetchLayoutLocksMap().then(function (locksMap) {
          return { payloads: payloads, locksMap: locksMap };
        });
      })
      .then(function (pack) {
        var payloads = pack.payloads;
        var merged = [];
        for (var pi = 0; pi < payloads.length; pi++) {
          var rows = payloads[pi].rows || [];
          for (var ri = 0; ri < rows.length; ri++) merged.push(rows[ri]);
        }
        merged.sort(function (a, b) {
          var an = (getCell(a, "__name") || "").toLowerCase();
          var bn = (getCell(b, "__name") || "").toLowerCase();
          if (an !== bn) return an < bn ? -1 : 1;
          return String(a.entity_type || "").localeCompare(String(b.entity_type || ""));
        });
        merged = dedupeDesignerDdRowsByName(merged);
        applyRowsToList(root, merged, cols, statusEl, types.length, pack.locksMap);
      })
      .catch(function () {
        if (statusEl) {
          statusEl.textContent = "Load failed (network or API error).";
          statusEl.classList.add("is-error");
        }
      });
  }

  function bindObjectEditDdAutoReload(root, statusId) {
    if (!root || root.dataset.gcObjEditDdReloadBound === "1") return;
    root.dataset.gcObjEditDdReloadBound = "1";
    var statusEl = document.getElementById(statusId);
    function reload() {
      root._gcDdCachedRows = null;
      loadDesignerDdFromCache(root, statusEl, true);
    }
    document.addEventListener("gc-firewall-selection-changed", reload);
    document.addEventListener(
      "change",
      function (ev) {
        var t = ev.target;
        if (
          !t ||
          !t.matches ||
          !t.matches(
            "#gc-designer-flyout-object-edit-modal [data-gc-fw-ms] input[type=\"checkbox\"], #gc-designer-flyout-object-edit-modal [data-gc-cfg-ms] input[type=\"checkbox\"]",
          )
        )
          return;
        if (!root.closest("#gc-designer-flyout-object-edit-modal")) return;
        reload();
      },
      true,
    );
    loadDesignerDdFromCache(root, statusEl, true);
  }

  function bindDesignerDdAutoLoad(root, statusId) {
    var fs = designerDdSourceFs(root);
    if (fs) {
      var statusEl = document.getElementById(statusId);
      var sel = fs.querySelector("[data-gc-dd-scope]");
      var debounceT = null;
      function scheduleLoadDebounced() {
        if (debounceT) clearTimeout(debounceT);
        debounceT = setTimeout(function () {
          debounceT = null;
          loadDesignerDdFromCache(root, statusEl, false);
        }, 350);
      }
      function syncCustomVisibility() {
        var custom = sel && sel.value === "custom";
        fs.querySelectorAll("[data-gc-dd-custom-wrap]").forEach(function (el) {
          el.hidden = !custom;
        });
      }
      if (sel) {
        sel.addEventListener("change", function () {
          syncCustomVisibility();
          root._gcDdCachedRows = null;
          loadDesignerDdFromCache(root, statusEl, false);
        });
      }
      syncCustomVisibility();
      fs.querySelectorAll("[data-gc-dd-fw-ids], [data-gc-dd-cfg-ids]").forEach(function (inp) {
        inp.addEventListener("input", function () {
          if (!sel || sel.value !== "custom") return;
          root._gcDdCachedRows = null;
          scheduleLoadDebounced();
        });
        inp.addEventListener("change", function () {
          if (!sel || sel.value !== "custom") return;
          root._gcDdCachedRows = null;
          if (debounceT) clearTimeout(debounceT);
          debounceT = null;
          loadDesignerDdFromCache(root, statusEl, false);
        });
      });
      return;
    }
    if (root && root.getAttribute("data-gc-object-edit-dd") === "1") {
      bindObjectEditDdAutoReload(root, statusId);
    }
  }

  function loadMemberLookupFromCache(root, statusEl, quietEmptyScope) {
    var fs = designerDdSourceFs(root);
    var list = root.querySelector(".gc-designer-dd__list");
    if (!list) return;
    var scope = readMemberLookupScopeFromRoot(root);
    var types = [];
    var layoutEt = String(root.getAttribute("data-gc-ml-layout-source-type") || "").trim();
    var isFlyoutMl = isFlyoutMemberLookupRoot(root);
    if (isFlyoutMl) {
      if (!layoutEt || !/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(layoutEt)) {
        if (statusEl && !quietEmptyScope) {
          statusEl.textContent =
            "Set Data source on the Layout plan display card for this member list control.";
          statusEl.classList.add("is-error");
        }
        return;
      }
      types = [layoutEt];
    } else {
      var catJson = root.getAttribute("data-gc-ml-catalog-entity-types");
      if (catJson) {
        try {
          var arr = JSON.parse(catJson);
          if (Array.isArray(arr)) {
            arr.forEach(function (x) {
              var t = String(x != null ? x : "").trim();
              if (t && types.indexOf(t) === -1) types.push(t);
            });
          }
        } catch (eMlCat) {}
      }
      if (!types.length && fs) types = readCheckedValues(fs, "[data-gc-ml-entity-type]");
      if (layoutEt && /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(layoutEt)) {
        types = [layoutEt];
      }
    }
    var cols = [];
    if (fs) cols = readCheckedValues(fs, "[data-gc-ml-list-col]");
    if (!cols.length) cols = ["__firewall", "entity_type"];
    if (!types.length) {
      if (statusEl && !quietEmptyScope) {
        statusEl.textContent = "Select at least one object type.";
        statusEl.classList.add("is-error");
      }
      return;
    }
    var allTypesAreScopeFree = types.length > 0 && types.every(isSpecialCountriesEntityType);
    if (!scope.firewall_ids && !scope.configuration_ids && !allTypesAreScopeFree) {
      if (statusEl) {
        if (quietEmptyScope) {
          statusEl.textContent = "";
          statusEl.classList.remove("is-error");
        } else {
          statusEl.textContent =
            "No firewalls or configurations in scope — select some in the Object edit flyout or use the top bar.";
          statusEl.classList.add("is-error");
        }
      }
      return;
    }
    if (statusEl) {
      statusEl.classList.remove("is-error");
      statusEl.textContent = "Loading…";
    }
    Promise.all(
      types.map(function (et) {
        return fetchMemberLookupRowsForType(et, scope);
      }),
    )
      .then(function (payloads) {
        return fetchLayoutLocksMap().then(function (locksMap) {
          return { payloads: payloads, locksMap: locksMap };
        });
      })
      .then(function (pack) {
        var payloads = pack.payloads;
        var merged = [];
        for (var pi = 0; pi < payloads.length; pi++) {
          var rows = payloads[pi].rows || [];
          for (var ri = 0; ri < rows.length; ri++) merged.push(rows[ri]);
        }
        merged.sort(function (a, b) {
          var an = (getCell(a, "__name") || "").toLowerCase();
          var bn = (getCell(b, "__name") || "").toLowerCase();
          if (an !== bn) return an < bn ? -1 : 1;
          return String(a.entity_type || "").localeCompare(String(b.entity_type || ""));
        });
        merged = dedupeDesignerDdRowsByName(merged);
        applyRowsToList(root, merged, cols, statusEl, types.length, pack.locksMap);
      })
      .catch(function () {
        if (statusEl) {
          statusEl.textContent = "Load failed (network or API error).";
          statusEl.classList.add("is-error");
        }
      });
  }

  function memberLookupStatusElement(root) {
    if (!root) return null;
    var attr = root.getAttribute("data-gc-member-lookup-status-id");
    if (attr) return document.getElementById(attr);
    if (root.id) {
      return (
        document.getElementById(root.id + "-load-status") || document.getElementById(root.id + "-ml-status")
      );
    }
    return null;
  }

  function reloadMemberLookupRootsInObjectEditModal() {
    var modal = document.getElementById("gc-designer-flyout-object-edit-modal");
    if (!modal) return;
    modal.querySelectorAll("[data-gc-designer-member-lookup]").forEach(function (el) {
      loadMemberLookupFromCache(el, memberLookupStatusElement(el), true);
    });
  }

  function reloadObjectEditDdFromFlyoutFw() {
    var modal = document.getElementById("gc-designer-flyout-object-edit-modal");
    if (!modal) return;
    modal.querySelectorAll("[data-gc-object-edit-dd=\"1\"]").forEach(function (el) {
      var st = memberLookupStatusElement(el);
      if (!st && el.id) st = document.getElementById(el.id + "-dd-status");
      el._gcDdCachedRows = null;
      loadDesignerDdFromCache(el, st, true);
    });
  }

  function bindMemberLookupAutoReload(root) {
    if (!root || root.dataset.gcMemberLookupReloadBound === "1") return;
    root.dataset.gcMemberLookupReloadBound = "1";
    document.addEventListener("gc-firewall-selection-changed", function () {
      root._gcDdCachedRows = null;
      loadMemberLookupFromCache(root, memberLookupStatusElement(root), false);
    });
    document.addEventListener(
      "change",
      function (ev) {
        var t = ev.target;
        if (
          !t ||
          !t.matches ||
          !t.matches(
            "#gc-designer-flyout-object-edit-modal [data-gc-fw-ms] input[type=\"checkbox\"], #gc-designer-flyout-object-edit-modal [data-gc-cfg-ms] input[type=\"checkbox\"]",
          )
        )
          return;
        if (!root.closest("#gc-designer-flyout-object-edit-modal")) return;
        root._gcDdCachedRows = null;
        loadMemberLookupFromCache(root, memberLookupStatusElement(root), false);
      },
      true,
    );
  }

  function restoreDdSourceFs() {}
  function restoreMemberLookupSourceFsCatalog() {}

  function wireSearchableDropdown(root) {
    if (!root) return;
    var shell = root.querySelector(".gc-designer-dd__shell");
    var panel = root.querySelector(".gc-designer-dd__panel");
    var search = root.querySelector(".gc-designer-dd__search");
    var trigger = root.querySelector(".gc-designer-dd__trigger");
    var list = root.querySelector(".gc-designer-dd__list");
    if (!shell || !trigger || !list) return;

    ddRoots.push(root);

    var isMemberLookup = root.classList.contains("gc-designer-member-lookup");
    var mlToolbar = root.querySelector(".gc-designer-member-lookup__toolbar");
    var mlSelectAll = root.querySelector(".gc-designer-member-lookup__select-all");

    function isMultiNow() {
      return root.classList.contains("gc-designer-dd--multi");
    }

    function setOpen(open) {
      if (panel) panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (mlToolbar) mlToolbar.hidden = !open || !isMultiNow() || !isMemberLookup;
      if (open) {
        if (isMemberLookup && isFlyoutMemberLookupRoot(root)) {
          reorderFlyoutMemberLookupListDom(root, list, trigger, isMultiNow());
          if (root._gcDdFilterList) root._gcDdFilterList();
        }
        if (search && !root.classList.contains("gc-designer-dd--no-search")) {
          try {
            search.focus();
          } catch (e1) {}
        }
      }
    }

    function filterList() {
      var q = (search && search.value ? search.value : "").trim().toLowerCase();
      var items = list.querySelectorAll("li[role='option']");
      for (var i = 0; i < items.length; i++) {
        var li = items[i];
        var t = li.textContent.trim().toLowerCase();
        li.hidden = q && t.indexOf(q) === -1;
      }
    }

    root._gcDdFilterList = filterList;

    if (search) search.addEventListener("input", filterList);

    list.addEventListener(
      "mousedown",
      function (ev) {
        if (ev.target.closest && ev.target.closest(".gc-designer-dd__layout-lock-wrap")) {
          ev.stopPropagation();
        }
      },
      true,
    );

    function refreshMultiLabel() {
      if (!isMultiNow()) return;
      var labels = [];
      var boxes = list.querySelectorAll(".gc-designer-dd__check input[type='checkbox']");
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) {
          var liM = boxes[i].closest("li");
          var pl = liM ? liM.getAttribute("data-gc-dd-primary") : "";
          if (pl) labels.push(pl);
        }
      }
      var n = labels.length;
      var flyoutMl = isMemberLookup && isFlyoutMemberLookupRoot(root);
      if (flyoutMl && n > 1) {
        trigger.textContent = n + " items selected";
        trigger.setAttribute(
          "aria-label",
          n + " items selected — open the list to review or change the selection",
        );
      } else {
        trigger.textContent = n ? labels.join(", ") : "None selected";
        if (flyoutMl) {
          if (n === 1) trigger.setAttribute("aria-label", labels[0]);
          else trigger.removeAttribute("aria-label");
        }
      }
      if (flyoutMl) {
        refreshMemberLookupFlyoutStatus(root, memberLookupStatusElement(root));
      }
    }
    root._gcDdRefreshMultiLabel = refreshMultiLabel;

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var opening = panel ? panel.hidden : true;
      if (opening) {
        for (var j = 0; j < ddRoots.length; j++) {
          var other = ddRoots[j];
          if (other !== root && other._gcDdSetOpen) other._gcDdSetOpen(false);
        }
      }
      setOpen(opening);
    });

    list.addEventListener("click", function (e) {
      if (isMultiNow()) return;
      if (e.target.closest && e.target.closest(".gc-designer-dd__layout-lock-wrap")) return;
      var li = e.target.closest("li[role='option']");
      if (!li || li.hidden) return;
      var opts = list.querySelectorAll("li[role='option']");
      for (var oi = 0; oi < opts.length; oi++) {
        opts[oi].setAttribute("aria-selected", opts[oi] === li ? "true" : "false");
      }
      var pl = li.getAttribute("data-gc-dd-primary") || li.textContent.trim();
      trigger.textContent = pl;
      trigger.setAttribute("data-gc-dd-value", li.getAttribute("data-value") || "");
      if (isMemberLookup && isFlyoutMemberLookupRoot(root)) {
        refreshMemberLookupFlyoutStatus(root, memberLookupStatusElement(root));
      }
      setOpen(false);
    });

    list.addEventListener("change", function (e) {
      if (!isMultiNow()) return;
      if (
        e.target &&
        e.target.matches &&
        e.target.matches(".gc-designer-dd__check input[type='checkbox']")
      ) {
        var liC = e.target.closest("li");
        if (liC) liC.setAttribute("aria-selected", e.target.checked ? "true" : "false");
        refreshMultiLabel();
      }
    });

    if (mlSelectAll && isMemberLookup) {
      mlSelectAll.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (!isMultiNow()) return;
        list.querySelectorAll("li[role='option']").forEach(function (li) {
          if (li.hidden) return;
          var cb = li.querySelector(".gc-designer-dd__check input[type='checkbox']");
          if (cb && !cb.disabled) cb.checked = true;
          li.setAttribute("aria-selected", "true");
        });
        refreshMultiLabel();
      });
    }

    if (isMultiNow()) refreshMultiLabel();
    if (isMemberLookup && isFlyoutMemberLookupRoot(root) && !isMultiNow()) {
      refreshMemberLookupFlyoutStatus(root, memberLookupStatusElement(root));
    }

    root._gcDdSetOpen = setOpen;
    shell.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  function designerDdSetSingleSelection(root, value) {
    var list = root && root.querySelector(".gc-designer-dd__list");
    var trigger = root && root.querySelector(".gc-designer-dd__trigger");
    if (!trigger || !list) return;
    var sv = value == null ? "" : String(value);
    if (sv === "") {
      root._gcDdPendingSingleValue = null;
      trigger.textContent = "Choose…";
      trigger.removeAttribute("data-gc-dd-value");
      list.querySelectorAll("li[role='option']").forEach(function (li) {
        li.setAttribute("aria-selected", "false");
      });
      if (root.classList.contains("gc-designer-member-lookup") && isFlyoutMemberLookupRoot(root)) {
        refreshMemberLookupFlyoutStatus(root, memberLookupStatusElement(root));
      }
      return;
    }
    var opts = list.querySelectorAll("li[role='option']");
    var wantNorm = sv.trim().toLowerCase();
    var pickedLi = null;
    var pickedVal = "";
    for (var i = 0; i < opts.length; i++) {
      var li = opts[i];
      var v = String(li.getAttribute("data-value") || "");
      if (v === sv) {
        pickedLi = li;
        pickedVal = v;
        break;
      }
    }
    if (!pickedLi && wantNorm) {
      for (var j = 0; j < opts.length; j++) {
        var li2 = opts[j];
        var primary = String(li2.getAttribute("data-gc-dd-primary") || "").trim().toLowerCase();
        if (primary && primary === wantNorm) {
          pickedLi = li2;
          pickedVal = String(li2.getAttribute("data-value") || "");
          break;
        }
      }
    }
    if (pickedLi) {
      root._gcDdPendingSingleValue = null;
      var pl = pickedLi.getAttribute("data-gc-dd-primary") || pickedLi.textContent.trim();
      trigger.textContent = pl;
      trigger.setAttribute("data-gc-dd-value", pickedVal);
      list.querySelectorAll("li[role='option']").forEach(function (x) {
        x.setAttribute("aria-selected", x === pickedLi ? "true" : "false");
      });
      if (root.classList.contains("gc-designer-member-lookup") && isFlyoutMemberLookupRoot(root)) {
        refreshMemberLookupFlyoutStatus(root, memberLookupStatusElement(root));
      }
    } else if (wantNorm) {
      root._gcDdPendingSingleValue = sv;
    }
  }

  function designerDdSetMultiSelection(root, items) {
    var list = root && root.querySelector(".gc-designer-dd__list");
    if (!list || !root.classList.contains("gc-designer-dd--multi")) return;
    var tokens = normalizeDdMultiSelectionTokens(items);
    root._gcDdPendingMultiSelection = tokens.length ? tokens.slice() : null;
    applyDdMultiSelectionTokens(root, tokens);
  }

  document.addEventListener("click", function () {
    ddRoots.forEach(function (el) {
      if (el && el._gcDdSetOpen) el._gcDdSetOpen(false);
    });
  });

  globalThis.__gcDesignerMlFwHookChained = true;
  (function chainMemberLookupFlyoutFwHook() {
    var prev = globalThis.gcHsOnFlyoutFirewallSelectionChange;
    globalThis.gcHsOnFlyoutFirewallSelectionChange = function (root) {
      if (typeof prev === "function") {
        try {
          prev(root);
        } catch (ePrev) {}
      }
      reloadMemberLookupRootsInObjectEditModal();
      reloadObjectEditDdFromFlyoutFw();
    };
  })();

  window.__gcDesignerControlsBridge = window.__gcDesignerControlsBridge || {};
  window.__gcDesignerControlsBridge.ddFieldRuntime = {
    loadDesignerDdFromCache: loadDesignerDdFromCache,
    wireSearchableDropdown: wireSearchableDropdown,
    bindDesignerDdAutoLoad: bindDesignerDdAutoLoad,
    designerDdSourceFs: designerDdSourceFs,
    restoreDdSourceFs: restoreDdSourceFs,
    loadMemberLookupFromCache: loadMemberLookupFromCache,
    bindMemberLookupAutoReload: bindMemberLookupAutoReload,
    restoreMemberLookupSourceFsCatalog: restoreMemberLookupSourceFsCatalog,
    snapshotMemberLookupSourceFsFromFieldset: function () {
      return null;
    },
    memberLookupStatusElement: memberLookupStatusElement,
  };

  var selRebuild =
    typeof globalThis.gcOptionSelectorRebuild === "function" ? globalThis.gcOptionSelectorRebuild : null;
  window.__gcDesignerControlsBridge.catalogFieldUi = window.__gcDesignerControlsBridge.catalogFieldUi || {};
  if (selRebuild) {
    window.__gcDesignerControlsBridge.catalogFieldUi.selectorRebuild = selRebuild;
  }
  window.__gcDesignerControlsBridge.catalogFieldUi.ddSetSingleSelection = designerDdSetSingleSelection;
  window.__gcDesignerControlsBridge.catalogFieldUi.ddSetMultiSelection = designerDdSetMultiSelection;
})();
