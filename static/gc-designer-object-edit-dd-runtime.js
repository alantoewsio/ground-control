/**
 * Dropdown + member-lookup runtime for the object-edit flyout on pages that do not load
 * partials/gc_designer_controls_scripts.html (e.g. Firewalls v2). Exposes the same
 * __gcDesignerControlsBridge.ddFieldRuntime / catalogFieldUi surface the catalog expects.
 */
(function () {
  "use strict";

  if (window.__gcDesignerControlsBridge && window.__gcDesignerControlsBridge.ddFieldRuntime) {
    return;
  }

  var ddRoots = [];

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

  function renderRowHtml(row, cols, isMulti) {
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
    var iconCl = iconClasses(row);
    var inner =
      '<span class="' +
      iconCl +
      '" aria-hidden="true"></span><span class="gc-designer-dd__row-text"><span class="gc-designer-dd__primary">' +
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
        inner +
        "</li>"
      );
    }
    return (
      '<li role="option" aria-selected="false" tabindex="-1" data-value="' +
      escapeAttr(val) +
      '" data-gc-dd-primary="' +
      escapeAttr(primary) +
      '"><label class="gc-designer-dd__check"><input type="checkbox" />' +
      inner +
      "</label></li>"
    );
  }

  function applyRowsToList(root, merged, cols, statusEl, typesCount) {
    var list = root.querySelector(".gc-designer-dd__list");
    if (!list) return;
    var isMulti = root.classList.contains("gc-designer-dd--multi");
    root._gcDdCachedRows = merged;
    if (!merged.length) {
      list.innerHTML =
        '<li class="gc-designer-dd__empty" role="presentation" style="cursor:default;color:var(--text-muted,#64748b)">No cached rows for this scope.</li>';
    } else {
      var html = "";
      for (var mi = 0; mi < merged.length; mi++) {
        html += renderRowHtml(merged[mi], cols, isMulti);
      }
      list.innerHTML = html;
    }
    if (statusEl) {
      statusEl.textContent =
        merged.length + " object(s) from " + typesCount + " type request(s).";
      statusEl.classList.remove("is-error");
    }
    var search = root.querySelector(".gc-designer-dd__search");
    if (search) search.value = "";
    if (root._gcDdFilterList) root._gcDdFilterList();
    if (isMulti && root._gcDdRefreshMultiLabel) root._gcDdRefreshMultiLabel();
    if (!isMulti) {
      var tr = root.querySelector(".gc-designer-dd__trigger");
      if (tr) {
        tr.textContent = "Choose…";
        tr.removeAttribute("data-gc-dd-value");
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
    if (!scope.firewall_ids && !scope.configuration_ids) {
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
    var urls = types.map(function (et) {
      return (
        "/api/firewalls/hosts-services/table?entity_type=" +
        encodeURIComponent(et) +
        "&firewall_ids=" +
        encodeURIComponent(scope.firewall_ids) +
        "&configuration_ids=" +
        encodeURIComponent(scope.configuration_ids) +
        "&combine=false&limit=800"
      );
    });
    Promise.all(
      urls.map(function (url) {
        return fetch(url, { credentials: "same-origin" }).then(function (r) {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        });
      }),
    )
      .then(function (payloads) {
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
        applyRowsToList(root, merged, cols, statusEl, types.length);
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
    if (!scope.firewall_ids && !scope.configuration_ids) {
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
    var urls = types.map(function (et) {
      return (
        "/api/firewalls/hosts-services/table?entity_type=" +
        encodeURIComponent(et) +
        "&firewall_ids=" +
        encodeURIComponent(scope.firewall_ids) +
        "&configuration_ids=" +
        encodeURIComponent(scope.configuration_ids) +
        "&combine=false&limit=800"
      );
    });
    Promise.all(
      urls.map(function (url) {
        return fetch(url, { credentials: "same-origin" }).then(function (r) {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        });
      }),
    )
      .then(function (payloads) {
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
        applyRowsToList(root, merged, cols, statusEl, types.length);
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
      if (open && search && !root.classList.contains("gc-designer-dd--no-search")) {
        try {
          search.focus();
        } catch (e1) {}
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

    function refreshMultiLabel() {
      if (!isMultiNow()) return;
      var labels = [];
      var boxes = list.querySelectorAll("input[type='checkbox']");
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) {
          var liM = boxes[i].closest("li");
          var pl = liM ? liM.getAttribute("data-gc-dd-primary") : "";
          if (pl) labels.push(pl);
        }
      }
      trigger.textContent = labels.length ? labels.join(", ") : "None selected";
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
      var li = e.target.closest("li[role='option']");
      if (!li || li.hidden) return;
      var opts = list.querySelectorAll("li[role='option']");
      for (var oi = 0; oi < opts.length; oi++) {
        opts[oi].setAttribute("aria-selected", opts[oi] === li ? "true" : "false");
      }
      var pl = li.getAttribute("data-gc-dd-primary") || li.textContent.trim();
      trigger.textContent = pl;
      trigger.setAttribute("data-gc-dd-value", li.getAttribute("data-value") || "");
      setOpen(false);
    });

    list.addEventListener("change", function (e) {
      if (!isMultiNow()) return;
      if (e.target && e.target.matches && e.target.matches("input[type='checkbox']")) {
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
          var cb = li.querySelector("input[type='checkbox']");
          if (cb && !cb.disabled) cb.checked = true;
          li.setAttribute("aria-selected", "true");
        });
        refreshMultiLabel();
      });
    }

    if (isMultiNow()) refreshMultiLabel();

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
      trigger.textContent = "Choose…";
      trigger.removeAttribute("data-gc-dd-value");
      list.querySelectorAll("li[role='option']").forEach(function (li) {
        li.setAttribute("aria-selected", "false");
      });
      return;
    }
    var opts = list.querySelectorAll("li[role='option']");
    for (var i = 0; i < opts.length; i++) {
      var li = opts[i];
      if (li.getAttribute("data-value") === sv) {
        var pl = li.getAttribute("data-gc-dd-primary") || li.textContent.trim();
        trigger.textContent = pl;
        trigger.setAttribute("data-gc-dd-value", sv);
        list.querySelectorAll("li[role='option']").forEach(function (x) {
          x.setAttribute("aria-selected", x === li ? "true" : "false");
        });
        return;
      }
    }
  }

  function designerDdSetMultiSelection(root, items) {
    var list = root && root.querySelector(".gc-designer-dd__list");
    if (!list) return;
    var want = Object.create(null);
    (Array.isArray(items) ? items : []).forEach(function (x) {
      var v = typeof x === "string" ? x : x && x.value;
      if (v != null && String(v) !== "") want[String(v)] = true;
    });
    list.querySelectorAll("li[role='option']").forEach(function (li) {
      var v = li.getAttribute("data-value");
      var cb = li.querySelector("input[type='checkbox']");
      if (!cb) return;
      cb.checked = !!want[String(v)];
      li.setAttribute("aria-selected", cb.checked ? "true" : "false");
    });
    if (root._gcDdRefreshMultiLabel) root._gcDdRefreshMultiLabel();
  }

  document.addEventListener("click", function () {
    ddRoots.forEach(function (el) {
      if (el && el._gcDdSetOpen) el._gcDdSetOpen(false);
    });
  });

  if (!globalThis.__gcDesignerMlFwHookChained) {
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
  }

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
  if (!window.__gcDesignerControlsBridge.catalogFieldUi.selectorRebuild && selRebuild) {
    window.__gcDesignerControlsBridge.catalogFieldUi.selectorRebuild = selRebuild;
  }
  if (!window.__gcDesignerControlsBridge.catalogFieldUi.ddSetSingleSelection) {
    window.__gcDesignerControlsBridge.catalogFieldUi.ddSetSingleSelection = designerDdSetSingleSelection;
  }
  if (!window.__gcDesignerControlsBridge.catalogFieldUi.ddSetMultiSelection) {
    window.__gcDesignerControlsBridge.catalogFieldUi.ddSetMultiSelection = designerDdSetMultiSelection;
  }
})();
