/**
 * Designer · Navigation: entity type display / navigation metadata (JSON in /data).
 * Nav section: shared datalist. Nav page: per-row datalist, same section. Tab: per-row datalist, same section + page (case-insensitive).
 * Rows ordered by persisted facet order (section → page → tab), then nav order, kind, entity type. Header sort disabled.
 * Object selectors (named for reuse on other pages; instances are independent — no cross-widget sync):
 *   data-gc-designer-object-selector="object-selector" (single-select dropdown)
 *   data-gc-designer-object-selector="object-selector-list" (multi-select checklist; row checkboxes)
 *   window.gcDesignerObjectSelectorNames, gcQueryDesignerObjectSelector(name), gcQueryDesignerObjectSelectorAll(name)
 * Standalone pages: gcDesignerHydrateObjectSelectorDropdown(select), gcDesignerHydrateObjectSelectorList(container)
 * Option text = display name (entity_type if blank); value = entity_type; groups section · page; refresh on table render.
 */
(function () {
  "use strict";

  var API_URL = "/api/designer/entity-type-navigation";
  var DISTINCT_URL = "/api/firewalls/config-cache/distinct-entity-types";
  var DL_SECTION_ID = "gc-designer-entity-nav-dl-section";
  var PAGE_DL_PREFIX = "gc-designer-entity-nav-dl-page--";
  var TAB_DL_PREFIX = "gc-designer-entity-nav-dl-tab--";

  var state = { types: [], tbody: null, rowBaseline: {}, facetOrders: null };
  var BLANK_DRAG_IMAGE =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  var facetOverlayState = {
    axis: null,
    anchorSection: "",
    anchorPage: "",
    cancelSnapshot: null,
  };
  var DIRTY_ROW_CLASS = "gc-designer-entity-nav__tr--dirty";
  var ROW_DRAGGING_CLASS = "gc-designer-entity-nav__tr--dragging";
  var ROW_DIMMED_CLASS = "gc-designer-entity-nav__tr--dimmed";
  var TABLE_DRAG_ACTIVE_CLASS = "gc-designer-entity-nav__table--drag-active";
  var dragState = { tr: null, groupKey: null };

  function trimStr(x) {
    return String(x == null ? "" : x).replace(/^\s+|\s+$/g, "");
  }

  function sectionKey(s) {
    return trimStr(s).toLowerCase();
  }

  function pageKey(s) {
    return trimStr(s).toLowerCase();
  }

  function setSaveStatus(el, msg) {
    if (el) el.textContent = msg || "";
  }

  function cmpNav(a, b) {
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  }

  function compareNavOrder(a, b) {
    var sa = trimStr(a);
    var sb = trimStr(b);
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    var na = parseInt(sa, 10);
    var nb = parseInt(sb, 10);
    var aNum = !isNaN(na) && String(na) === sa;
    var bNum = !isNaN(nb) && String(nb) === sb;
    if (aNum && bNum) return na - nb;
    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;
    return cmpNav(sa, sb);
  }

  function defaultFacetOrders() {
    return { sections: [], pagesBySection: {}, tabsBySectionPage: {} };
  }

  function normalizeFacetOrders(raw) {
    var fo = defaultFacetOrders();
    if (!raw || typeof raw !== "object") return fo;
    if (Array.isArray(raw.sections)) {
      fo.sections = raw.sections
        .map(function (x) {
          return trimStr(x);
        })
        .filter(function (s) {
          return s !== "";
        });
    }
    if (raw.pagesBySection && typeof raw.pagesBySection === "object") {
      Object.keys(raw.pagesBySection).forEach(function (k) {
        var v = raw.pagesBySection[k];
        if (!Array.isArray(v)) return;
        var kk = trimStr(k).toLowerCase();
        fo.pagesBySection[kk] = v.map(function (x) {
          return trimStr(x);
        });
      });
    }
    if (raw.tabsBySectionPage && typeof raw.tabsBySectionPage === "object") {
      Object.keys(raw.tabsBySectionPage).forEach(function (k) {
        var v = raw.tabsBySectionPage[k];
        if (!Array.isArray(v)) return;
        var kk = trimStr(k).toLowerCase();
        if (kk.indexOf("|") === -1) return;
        fo.tabsBySectionPage[kk] = v.map(function (x) {
          return trimStr(x);
        });
      });
    }
    return fo;
  }

  function cloneFacetOrders(fo) {
    var base = fo && typeof fo === "object" ? fo : defaultFacetOrders();
    var pbs = {};
    Object.keys(base.pagesBySection || {}).forEach(function (k) {
      pbs[k] = (base.pagesBySection[k] || []).slice();
    });
    var tbm = {};
    Object.keys(base.tabsBySectionPage || {}).forEach(function (k) {
      tbm[k] = (base.tabsBySectionPage[k] || []).slice();
    });
    return {
      sections: (base.sections || []).slice(),
      pagesBySection: pbs,
      tabsBySectionPage: tbm,
    };
  }

  function facetRankPair(orderList, value) {
    var vk = trimStr(value).toLowerCase();
    if (!orderList || !orderList.length) return [1000000, vk];
    for (var i = 0; i < orderList.length; i++) {
      if (trimStr(orderList[i]).toLowerCase() === vk) return [i, ""];
    }
    return [1000001, vk];
  }

  function navOrderSortTuple(raw) {
    var t = trimStr(raw);
    if (!t) return [2, 0, ""];
    var n = parseInt(t, 10);
    if (!isNaN(n) && String(n) === t) return [0, n, ""];
    return [1, 0, t.toLowerCase()];
  }

  /**
   * @param {string} et
   * @param {object} ent
   * @param {object} fo
   */
  function buildNavSortKey(et, ent, fo) {
    fo = fo || defaultFacetOrders();
    var sec = trimStr(ent.nav_section || "");
    var page = trimStr(ent.nav_page || "");
    var tab = trimStr(ent.tab || "");
    var sk = sectionKey(sec);
    var pk = pageKey(page);
    var pbs = fo.pagesBySection || {};
    var tbm = fo.tabsBySectionPage || {};
    var pl = Array.isArray(pbs[sk]) ? pbs[sk] : [];
    var tl = Array.isArray(tbm[sk + "|" + pk]) ? tbm[sk + "|" + pk] : [];
    var prs = facetRankPair(fo.sections, sec);
    var prp = facetRankPair(pl, page);
    var prt = facetRankPair(tl, tab);
    var kind = normalizeKind(ent.kind || "Objects").toLowerCase();
    return [prs, prp, prt, navOrderSortTuple(ent.nav_order || ""), kind, et.toLowerCase()];
  }

  function cmpPairLex(p, q) {
    if (p[0] < q[0]) return -1;
    if (p[0] > q[0]) return 1;
    var a = p[1] || "";
    var b = q[1] || "";
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  function cmpNavSortKeys(ka, kb) {
    var c = cmpPairLex(ka[0], kb[0]);
    if (c !== 0) return c;
    c = cmpPairLex(ka[1], kb[1]);
    if (c !== 0) return c;
    c = cmpPairLex(ka[2], kb[2]);
    if (c !== 0) return c;
    var na = ka[3];
    var nb = kb[3];
    if (na[0] !== nb[0]) return na[0] < nb[0] ? -1 : 1;
    if (na[1] !== nb[1]) return na[1] < nb[1] ? -1 : 1;
    if (na[2] !== nb[2]) return na[2] < nb[2] ? -1 : 1;
    if (ka[4] !== kb[4]) return ka[4] < kb[4] ? -1 : 1;
    if (ka[5] !== kb[5]) return ka[5] < kb[5] ? -1 : 1;
    return 0;
  }

  /**
   * @param {string[]} types
   * @param {Record<string, object>} entries
   * @param {object} [fo]
   */
  function sortTypesByNav(types, entries, fo) {
    fo = fo || state.facetOrders || defaultFacetOrders();
    var merged = mergeEntriesForSort(types, entries);
    return types.slice().sort(function (a, b) {
      return cmpNavSortKeys(
        buildNavSortKey(a, navRowFromEntry(a, merged[a]), fo),
        buildNavSortKey(b, navRowFromEntry(b, merged[b]), fo),
      );
    });
  }

  function orderedUniqueLabels(idMap, orderList, keyFromOrderItem) {
    var out = [];
    var seen = {};
    (orderList || []).forEach(function (lab) {
      var k = keyFromOrderItem(lab);
      if (Object.prototype.hasOwnProperty.call(idMap, k) && !seen[k]) {
        out.push(idMap[k]);
        seen[k] = true;
      }
    });
    var missing = [];
    Object.keys(idMap).forEach(function (k) {
      if (!seen[k]) missing.push(idMap[k]);
    });
    missing.sort(function (a, b) {
      return cmpNav(a, b);
    });
    return out.concat(missing);
  }

  function buildSectionFacetList(entries) {
    var idMap = {};
    Object.keys(entries).forEach(function (et) {
      var s = trimStr(entries[et].nav_section);
      if (!s) return;
      var sk = sectionKey(s);
      if (!idMap[sk]) idMap[sk] = s;
    });
    return orderedUniqueLabels(idMap, state.facetOrders && state.facetOrders.sections, sectionKey);
  }

  function buildPageFacetList(entries, sectionLabel) {
    var sk = sectionKey(sectionLabel);
    var idMap = {};
    Object.keys(entries).forEach(function (et) {
      var e = entries[et];
      if (sectionKey(e.nav_section) !== sk) return;
      var p = trimStr(e.nav_page);
      if (!p) return;
      var pk = pageKey(p);
      if (!idMap[pk]) idMap[pk] = p;
    });
    var order =
      (state.facetOrders && state.facetOrders.pagesBySection && state.facetOrders.pagesBySection[sk]) || [];
    return orderedUniqueLabels(idMap, order, pageKey);
  }

  function buildTabFacetList(entries, sectionLabel, pageLabel) {
    var sk = sectionKey(sectionLabel);
    var pk = pageKey(pageLabel);
    var idMap = {};
    Object.keys(entries).forEach(function (et) {
      var e = entries[et];
      if (sectionKey(e.nav_section) !== sk) return;
      if (pageKey(e.nav_page) !== pk) return;
      var t = trimStr(e.tab);
      if (!t) return;
      var tk = t.toLowerCase();
      if (!idMap[tk]) idMap[tk] = t;
    });
    var ordKey = sk + "|" + pk;
    var order =
      (state.facetOrders &&
        state.facetOrders.tabsBySectionPage &&
        state.facetOrders.tabsBySectionPage[ordKey]) ||
      [];
    return orderedUniqueLabels(idMap, order, function (lab) {
      return trimStr(lab).toLowerCase();
    });
  }

  function rowGroupKey(tr) {
    var f = readRowFieldsFromTr(tr);
    return (
      sectionKey(f.nav_section) +
      "\x1f" +
      pageKey(f.nav_page) +
      "\x1f" +
      pageKey(f.tab)
    );
  }

  function getDragAfterRowForGroup(container, y, draggingTr, groupKey) {
    var rows = [].slice
      .call(container.querySelectorAll("tr[data-entity-type]"))
      .filter(function (child) {
        if (child === draggingTr) return false;
        return rowGroupKey(child) === groupKey;
      });
    var closest = { offset: Number.NEGATIVE_INFINITY, element: null };
    rows.forEach(function (child) {
      var box = child.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        closest = { offset: offset, element: child };
      }
    });
    return closest.element;
  }

  function placeDragRowInGroup(tbody, draggingTr, afterEl, groupKey) {
    if (afterEl) {
      tbody.insertBefore(draggingTr, afterEl);
      return;
    }
    var last = null;
    [].slice.call(tbody.querySelectorAll("tr[data-entity-type]")).forEach(function (tr) {
      if (tr === draggingTr) return;
      if (rowGroupKey(tr) === groupKey) last = tr;
    });
    if (last) {
      if (draggingTr !== last.nextSibling) {
        tbody.insertBefore(draggingTr, last.nextSibling);
      }
    }
  }

  function renumberNavOrderForGroup(tbody, groupKey) {
    var seq = [].slice.call(tbody.querySelectorAll("tr[data-entity-type]")).filter(function (tr) {
      return rowGroupKey(tr) === groupKey;
    });
    seq.forEach(function (tr, i) {
      var inp = tr.querySelector(".gc-designer-entity-nav__input-nav-order");
      if (inp) inp.value = String(i + 1);
    });
  }

  function bindEntityNavDragOnce(tbody) {
    if (!tbody || tbody.dataset.gcEntityNavDragBound) return;
    tbody.dataset.gcEntityNavDragBound = "1";
    var table = tbody.closest("table");

    tbody.addEventListener("dragstart", function (e) {
      var h = e.target.closest && e.target.closest(".gc-designer-entity-nav__drag-handle");
      if (!h || !tbody.contains(h)) return;
      var tr = h.closest("tr[data-entity-type]");
      if (!tr) return;
      dragState.tr = tr;
      dragState.groupKey = rowGroupKey(tr);
      tr.classList.add(ROW_DRAGGING_CLASS);
      if (table) table.classList.add(TABLE_DRAG_ACTIVE_CLASS);
      tbody.querySelectorAll("tr[data-entity-type]").forEach(function (r) {
        if (r !== tr && rowGroupKey(r) !== dragState.groupKey) {
          r.classList.add(ROW_DIMMED_CLASS);
        }
      });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", tr.getAttribute("data-entity-type") || "");
    });

    tbody.addEventListener("dragend", function () {
      var tr = dragState.tr;
      var gk = dragState.groupKey;
      dragState.tr = null;
      dragState.groupKey = null;
      if (table) table.classList.remove(TABLE_DRAG_ACTIVE_CLASS);
      tbody.querySelectorAll("tr[data-entity-type]").forEach(function (r) {
        r.classList.remove(ROW_DRAGGING_CLASS, ROW_DIMMED_CLASS);
      });
      if (tr && gk) {
        renumberNavOrderForGroup(tbody, gk);
        tbody.querySelectorAll("tr[data-entity-type]").forEach(function (r) {
          if (rowGroupKey(r) === gk) refreshRowDirtyClass(r);
        });
      }
    });

    tbody.addEventListener("dragover", function (e) {
      e.preventDefault();
      if (!dragState.tr || !dragState.groupKey) return;
      var after = getDragAfterRowForGroup(
        tbody,
        e.clientY,
        dragState.tr,
        dragState.groupKey,
      );
      placeDragRowInGroup(tbody, dragState.tr, after, dragState.groupKey);
    });

    tbody.addEventListener("drop", function (e) {
      e.preventDefault();
    });
  }

  function pageDatalistId(et) {
    return PAGE_DL_PREFIX + et;
  }

  function ensureSectionDatalist() {
    if (document.getElementById(DL_SECTION_ID)) return;
    var ds = document.createElement("datalist");
    ds.id = DL_SECTION_ID;
    document.body.appendChild(ds);
  }

  function ensurePageDatalist(et) {
    var id = pageDatalistId(et);
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("datalist");
      el.id = id;
      document.body.appendChild(el);
    }
    return el;
  }

  function tabDatalistId(et) {
    return TAB_DL_PREFIX + et;
  }

  function ensureTabDatalist(et) {
    var id = tabDatalistId(et);
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("datalist");
      el.id = id;
      document.body.appendChild(el);
    }
    return el;
  }

  /** Drop per-row page/tab datalists for entity types no longer in the table. */
  function removeStalePerRowDatalists(validEntityTypes) {
    var want = {};
    validEntityTypes.forEach(function (t) {
      want[pageDatalistId(t)] = true;
      want[tabDatalistId(t)] = true;
    });
    document.querySelectorAll("[id^='" + PAGE_DL_PREFIX + "']").forEach(function (el) {
      if (!want[el.id]) el.remove();
    });
    document.querySelectorAll("[id^='" + TAB_DL_PREFIX + "']").forEach(function (el) {
      if (!want[el.id]) el.remove();
    });
  }

  function fillDatalist(dl, values) {
    if (!dl) return;
    dl.innerHTML = "";
    values.forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v;
      dl.appendChild(opt);
    });
  }

  function uniqueColumnValues(tbody, selector) {
    var set = {};
    if (!tbody) return [];
    tbody.querySelectorAll(selector).forEach(function (inp) {
      var s = trimStr(inp.value);
      if (s) set[s] = true;
    });
    return Object.keys(set).sort(function (a, b) {
      return cmpNav(a, b);
    });
  }

  function collectRowSnapshots(tbody) {
    var rows = [];
    if (!tbody) return rows;
    tbody.querySelectorAll("tr[data-entity-type]").forEach(function (tr) {
      var et = trimStr(tr.getAttribute("data-entity-type"));
      if (!et) return;
      var secIn = tr.querySelector(".gc-designer-entity-nav__input-section");
      var pageIn = tr.querySelector(".gc-designer-entity-nav__input-page");
      var tabIn = tr.querySelector(".gc-designer-entity-nav__input-tab");
      rows.push({
        et: et,
        section: secIn ? trimStr(secIn.value) : "",
        page: pageIn ? trimStr(pageIn.value) : "",
        tab: tabIn ? trimStr(tabIn.value) : "",
      });
    });
    return rows;
  }

  function refreshNavPageDatalists(tbody) {
    if (!tbody) return;
    var snap = collectRowSnapshots(tbody);
    snap.forEach(function (r) {
      var dl = ensurePageDatalist(r.et);
      var sk = sectionKey(r.section);
      var vals = {};
      if (sk) {
        snap.forEach(function (o) {
          if (sectionKey(o.section) === sk && o.page) vals[o.page] = true;
        });
      }
      fillDatalist(dl, Object.keys(vals).sort(function (a, b) {
        return cmpNav(a, b);
      }));
    });
  }

  function refreshNavTabDatalists(tbody) {
    if (!tbody) return;
    var snap = collectRowSnapshots(tbody);
    snap.forEach(function (r) {
      var dl = ensureTabDatalist(r.et);
      var sk = sectionKey(r.section);
      var pk = pageKey(r.page);
      var vals = {};
      if (sk && pk) {
        snap.forEach(function (o) {
          if (
            sectionKey(o.section) === sk &&
            pageKey(o.page) === pk &&
            o.tab
          ) {
            vals[o.tab] = true;
          }
        });
      }
      fillDatalist(dl, Object.keys(vals).sort(function (a, b) {
        return cmpNav(a, b);
      }));
    });
  }

  var refreshDatalistsTimer = null;
  function scheduleRefreshDatalists(tbody) {
    if (refreshDatalistsTimer) clearTimeout(refreshDatalistsTimer);
    refreshDatalistsTimer = setTimeout(function () {
      refreshDatalistsTimer = null;
      refreshDatalists(tbody);
    }, 60);
  }

  function refreshDatalists(tbody) {
    var dlS = document.getElementById(DL_SECTION_ID);
    fillDatalist(dlS, uniqueColumnValues(tbody, ".gc-designer-entity-nav__input-section"));
    refreshNavPageDatalists(tbody);
    refreshNavTabDatalists(tbody);
  }

  function loadDistinctTypes() {
    return fetch(DISTINCT_URL, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        if (!res.ok || !res.j || !Array.isArray(res.j.entity_types)) return [];
        return res.j.entity_types
          .map(function (t) {
            return trimStr(t);
          })
          .filter(function (s) {
            return s !== "";
          });
      })
      .catch(function () {
        return [];
      });
  }

  function loadSavedEntries() {
    return fetch(API_URL, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        var empty = { entries: {}, facet_orders: defaultFacetOrders() };
        if (!res.ok || !res.j || !res.j.entries || typeof res.j.entries !== "object") return empty;
        return {
          entries: res.j.entries,
          facet_orders: normalizeFacetOrders(res.j.facet_orders),
        };
      })
      .catch(function () {
        return { entries: {}, facet_orders: defaultFacetOrders() };
      });
  }

  function normalizeKind(v) {
    return trimStr(v) === "Settings" ? "Settings" : "Objects";
  }

  function cellSelectKind(value, ariaLabel) {
    var sel = document.createElement("select");
    sel.className =
      "settings-form__input mono gc-designer-entity-nav__select-kind";
    sel.setAttribute("aria-label", ariaLabel);
    ["Objects", "Settings"].forEach(function (label) {
      var opt = document.createElement("option");
      opt.value = label;
      opt.textContent = label;
      sel.appendChild(opt);
    });
    sel.value = normalizeKind(value);
    return sel;
  }

  function cellInputDisplay(et, value, ariaLabel) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className =
      "settings-form__input mono gc-designer-entity-nav__input gc-designer-entity-nav__input-display";
    inp.value = value != null ? String(value) : "";
    inp.placeholder = et || "";
    inp.setAttribute("aria-label", ariaLabel);
    inp.autocomplete = "off";
    return inp;
  }

  function cellComboSection(value, ariaLabel) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className =
      "settings-form__input mono gc-designer-entity-nav__input gc-designer-entity-nav__input-section";
    inp.setAttribute("list", DL_SECTION_ID);
    inp.value = value != null ? String(value) : "";
    inp.setAttribute("aria-label", ariaLabel);
    inp.autocomplete = "off";
    return inp;
  }

  function cellNavOrder(value, ariaLabel) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.inputMode = "numeric";
    inp.readOnly = true;
    inp.className =
      "settings-form__input mono gc-designer-entity-nav__input gc-designer-entity-nav__input-nav-order";
    inp.value = value != null ? String(value) : "";
    inp.setAttribute("aria-label", ariaLabel);
    inp.setAttribute(
      "title",
      "Updated when you reorder rows with the drag handle (same nav section, page, and tab only).",
    );
    inp.autocomplete = "off";
    return inp;
  }

  function cellDragHandleColumn(et) {
    var td = document.createElement("td");
    td.className = "gc-designer-entity-nav__drag-cell";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gc-designer-entity-nav__drag-handle";
    btn.draggable = true;
    btn.setAttribute(
      "aria-label",
      "Drag to reorder " + et + " within the same nav section, page, and tab",
    );
    btn.innerHTML =
      '<span aria-hidden="true" class="gc-designer-entity-nav__drag-grip">\u22ee\u22ee</span>';
    td.appendChild(btn);
    return td;
  }

  function cellComboPage(et, value, ariaLabel) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className =
      "settings-form__input mono gc-designer-entity-nav__input gc-designer-entity-nav__input-page";
    inp.setAttribute("list", pageDatalistId(et));
    inp.value = value != null ? String(value) : "";
    inp.setAttribute("aria-label", ariaLabel);
    inp.autocomplete = "off";
    return inp;
  }

  function cellComboTab(et, value, ariaLabel) {
    var inp = document.createElement("input");
    inp.type = "text";
    inp.className =
      "settings-form__input mono gc-designer-entity-nav__input gc-designer-entity-nav__input-tab";
    inp.setAttribute("list", tabDatalistId(et));
    inp.value = value != null ? String(value) : "";
    inp.setAttribute("aria-label", ariaLabel);
    inp.autocomplete = "off";
    return inp;
  }

  function facetReorderHandle(axis, et, ariaLabel) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gc-designer-entity-nav__facet-handle";
    btn.draggable = true;
    btn.setAttribute("data-facet-axis", axis);
    btn.setAttribute("data-entity-type", et);
    btn.setAttribute("aria-label", ariaLabel);
    btn.setAttribute(
      "title",
      "Drag to reorder this " +
      (axis === "section" ? "nav section" : axis === "page" ? "nav page" : "tab") +
      " across the table (collapsed list).",
    );
    btn.innerHTML =
      '<span aria-hidden="true" class="gc-designer-entity-nav__drag-grip">\u22ee\u22ee</span>';
    return btn;
  }

  function wrapComboWithFacetHandle(axis, et, inp, facetAria) {
    var wrap = document.createElement("div");
    wrap.className = "gc-designer-entity-nav__combo-wrap";
    wrap.appendChild(facetReorderHandle(axis, et, facetAria));
    wrap.appendChild(inp);
    return wrap;
  }

  function mergeEntriesForSort(types, entries) {
    var merged = {};
    types.forEach(function (et) {
      var row = entries[et] && typeof entries[et] === "object" ? entries[et] : {};
      merged[et] = row;
    });
    return merged;
  }

  function navRowFromEntry(et, row) {
    var r = row && typeof row === "object" ? row : {};
    return {
      et: et,
      kind: normalizeKind(r.kind),
      display_name: trimStr(r.display_name),
      nav_section: trimStr(r.nav_section),
      nav_page: trimStr(r.nav_page),
      nav_order: trimStr(r.nav_order),
      tab: trimStr(r.tab),
    };
  }

  function sortTreeLeaves(items) {
    return items.slice().sort(function (a, b) {
      var c = cmpNav(a.tab, b.tab);
      if (c !== 0) return c;
      var aHas = trimStr(a.nav_order) !== "";
      var bHas = trimStr(b.nav_order) !== "";
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && bHas) {
        c = compareNavOrder(a.nav_order, b.nav_order);
        if (c !== 0) return c;
      }
      return cmpNav(a.et, b.et);
    });
  }

  function sortTreeLeavesWithFacet(items, sk, pk, fo) {
    fo = fo || defaultFacetOrders();
    var key = sk + "|" + pk;
    var tabOrder = (fo.tabsBySectionPage && fo.tabsBySectionPage[key]) || [];
    var idx = {};
    tabOrder.forEach(function (lab, i) {
      idx[trimStr(lab).toLowerCase()] = i;
    });
    return items.slice().sort(function (a, b) {
      var ia = Object.prototype.hasOwnProperty.call(idx, pageKey(a.tab)) ? idx[pageKey(a.tab)] : 999999;
      var ib = Object.prototype.hasOwnProperty.call(idx, pageKey(b.tab)) ? idx[pageKey(b.tab)] : 999999;
      if (ia !== ib) return ia - ib;
      var c = cmpNav(a.tab, b.tab);
      if (c !== 0) return c;
      var aHas = trimStr(a.nav_order) !== "";
      var bHas = trimStr(b.nav_order) !== "";
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && bHas) {
        c = compareNavOrder(a.nav_order, b.nav_order);
        if (c !== 0) return c;
      }
      return cmpNav(a.et, b.et);
    });
  }

  /** Visible option text: display name only when set; otherwise entity_type (unavoidable fallback). */
  function objectSelectorOptionLabel(item) {
    var dn = trimStr(item.display_name);
    return dn || item.et;
  }

  /**
   * Visits grouped structure: { type: "group", label } then { type: "item", item } for each leaf in that group.
   */
  function iterateObjectSelectorStructure(types, entries, visit) {
    if (!types || !types.length) return;

    var merged = mergeEntriesForSort(types, entries);
    var assigned = [];
    var unassigned = [];
    types.forEach(function (et) {
      var item = navRowFromEntry(et, merged[et]);
      if (item.nav_section && item.nav_page) assigned.push(item);
      else unassigned.push(item);
    });

    var bySec = {};
    assigned.forEach(function (item) {
      var sk = sectionKey(item.nav_section);
      var pk = pageKey(item.nav_page);
      if (!bySec[sk]) bySec[sk] = { label: item.nav_section, pages: {} };
      if (!bySec[sk].pages[pk]) bySec[sk].pages[pk] = { label: item.nav_page, leaves: [] };
      bySec[sk].pages[pk].leaves.push(item);
    });

    var fo = state.facetOrders || defaultFacetOrders();
    var secOrderIdx = {};
    (fo.sections || []).forEach(function (lab, i) {
      secOrderIdx[sectionKey(lab)] = i;
    });
    var secKeys = Object.keys(bySec)
      .map(function (k) {
        return { k: k, label: bySec[k].label };
      })
      .sort(function (a, b) {
        var ia = Object.prototype.hasOwnProperty.call(secOrderIdx, a.k) ? secOrderIdx[a.k] : 999999;
        var ib = Object.prototype.hasOwnProperty.call(secOrderIdx, b.k) ? secOrderIdx[b.k] : 999999;
        if (ia !== ib) return ia - ib;
        return cmpNav(a.label, b.label);
      });

    secKeys.forEach(function (sk) {
      var sec = bySec[sk.k];
      var pageList = (fo.pagesBySection && fo.pagesBySection[sk.k]) || [];
      var pageOrderIdx = {};
      pageList.forEach(function (lab, i) {
        pageOrderIdx[pageKey(lab)] = i;
      });
      var pageKeys = Object.keys(sec.pages)
        .map(function (pk) {
          return { k: pk, label: sec.pages[pk].label };
        })
        .sort(function (a, b) {
          var ia = Object.prototype.hasOwnProperty.call(pageOrderIdx, a.k) ? pageOrderIdx[a.k] : 999999;
          var ib = Object.prototype.hasOwnProperty.call(pageOrderIdx, b.k) ? pageOrderIdx[b.k] : 999999;
          if (ia !== ib) return ia - ib;
          return cmpNav(a.label, b.label);
        });

      pageKeys.forEach(function (pk) {
        var pageBucket = sec.pages[pk.k];
        visit({ type: "group", label: sec.label + " · " + pageBucket.label });
        sortTreeLeavesWithFacet(pageBucket.leaves, sk.k, pk.k, fo).forEach(function (item) {
          visit({ type: "item", item: item });
        });
      });
    });

    if (unassigned.length) {
      visit({ type: "group", label: "Unassigned" });
      sortTreeLeaves(unassigned).forEach(function (item) {
        visit({ type: "item", item: item });
      });
    }
  }

  function fillObjectSelectorDropdown(sel, types, entries) {
    if (!sel) return;
    var prev = trimStr(sel.value);

    sel.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "Select an object…";
    sel.appendChild(ph);

    if (!types || !types.length) {
      sel.disabled = true;
      ph.textContent = "No entity types in cache yet (run a config sync)";
      sel.value = "";
      return;
    }
    sel.disabled = false;

    var currentOg = null;
    iterateObjectSelectorStructure(types, entries, function (node) {
      if (node.type === "group") {
        currentOg = document.createElement("optgroup");
        currentOg.label = node.label;
        sel.appendChild(currentOg);
      } else if (node.type === "item" && currentOg) {
        var opt = document.createElement("option");
        opt.value = node.item.et;
        opt.textContent = objectSelectorOptionLabel(node.item);
        if (trimStr(node.item.display_name)) opt.title = node.item.et;
        currentOg.appendChild(opt);
      }
    });

    var want = {};
    types.forEach(function (t) {
      want[t] = true;
    });
    sel.value = prev && want[prev] ? prev : "";
  }

  function collectObjectSelectorListSelection(container) {
    var set = {};
    if (!container) return set;
    container.querySelectorAll('input[type="checkbox"].gc-designer-object-selector-list__cb').forEach(function (inp) {
      if (inp.checked && trimStr(inp.value)) set[inp.value] = true;
    });
    return set;
  }

  function fillObjectSelectorList(container, types, entries) {
    if (!container) return;
    var prevSel = collectObjectSelectorListSelection(container);
    var idBase = trimStr(container.id) || "gc-object-selector-list";
    var rowIdx = 0;

    container.innerHTML = "";
    container.classList.remove("is-disabled");

    if (!types || !types.length) {
      container.classList.add("is-disabled");
      var empty = document.createElement("p");
      empty.className = "muted gc-designer-object-selector-list__empty";
      empty.textContent = "No entity types in cache yet (run a config sync)";
      container.appendChild(empty);
      return;
    }

    iterateObjectSelectorStructure(types, entries, function (node) {
      if (node.type === "group") {
        var gh = document.createElement("div");
        gh.className = "gc-designer-object-selector-list__group mono";
        gh.setAttribute("role", "presentation");
        gh.textContent = node.label;
        container.appendChild(gh);
      } else if (node.type === "item") {
        var item = node.item;
        var row = document.createElement("div");
        row.className = "gc-designer-object-selector-list__row";
        var cbId = idBase + "-cb-" + rowIdx;
        rowIdx += 1;

        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "gc-designer-object-selector-list__cb";
        cb.value = item.et;
        cb.id = cbId;
        cb.checked = !!prevSel[item.et];
        cb.setAttribute("data-entity-type", item.et);

        var lab = document.createElement("label");
        lab.className = "gc-designer-object-selector-list__label mono";
        lab.htmlFor = cbId;
        lab.textContent = objectSelectorOptionLabel(item);
        if (trimStr(item.display_name)) lab.title = item.et;

        row.appendChild(cb);
        row.appendChild(lab);
        container.appendChild(row);
      }
    });
  }

  function refreshObjectSelectorControls(types, entries) {
    document.querySelectorAll('[data-gc-designer-object-selector="object-selector"]').forEach(function (el) {
      fillObjectSelectorDropdown(el, types, entries);
    });
    document.querySelectorAll('[data-gc-designer-object-selector="object-selector-list"]').forEach(function (el) {
      fillObjectSelectorList(el, types, entries);
    });
  }

  function renderTable(tbody, types, entries) {
    if (!tbody) return;
    if (!state.facetOrders) state.facetOrders = defaultFacetOrders();
    tbody.innerHTML = "";
    if (!types.length) {
      var tr0 = document.createElement("tr");
      var td0 = document.createElement("td");
      td0.colSpan = 8;
      td0.className = "muted";
      td0.textContent = "No entity types in cache yet (run a config sync).";
      tr0.appendChild(td0);
      tbody.appendChild(tr0);
      removeStalePerRowDatalists([]);
      setRowBaselines([], {});
      refreshObjectSelectorControls(types, entries);
      return;
    }
    var merged = mergeEntriesForSort(types, entries);
    var sortedTypes = sortTypesByNav(types, merged);
    removeStalePerRowDatalists(sortedTypes);
    sortedTypes.forEach(function (et) {
      ensurePageDatalist(et);
      ensureTabDatalist(et);
      var row = entries[et] && typeof entries[et] === "object" ? entries[et] : {};
      var tr = document.createElement("tr");
      tr.setAttribute("data-entity-type", et);

      tr.appendChild(cellDragHandleColumn(et));

      var tdEt = document.createElement("td");
      tdEt.className = "mono";
      tdEt.textContent = et;
      tr.appendChild(tdEt);

      var tdKind = document.createElement("td");
      tdKind.appendChild(cellSelectKind(row.kind, "Type for " + et));
      tr.appendChild(tdKind);

      var tdDn = document.createElement("td");
      tdDn.appendChild(cellInputDisplay(et, row.display_name, "Display name for " + et));
      tr.appendChild(tdDn);

      var tdNs = document.createElement("td");
      tdNs.className = "gc-designer-entity-nav__td-combo";
      tdNs.appendChild(
        wrapComboWithFacetHandle(
          "section",
          et,
          cellComboSection(row.nav_section, "Nav section for " + et),
          "Reorder nav sections for the whole table",
        ),
      );
      tr.appendChild(tdNs);

      var tdNp = document.createElement("td");
      tdNp.className = "gc-designer-entity-nav__td-combo";
      tdNp.appendChild(
        wrapComboWithFacetHandle(
          "page",
          et,
          cellComboPage(et, row.nav_page, "Nav page for " + et),
          "Reorder nav pages within this row’s section",
        ),
      );
      tr.appendChild(tdNp);

      var tdTab = document.createElement("td");
      tdTab.className = "gc-designer-entity-nav__td-combo";
      tdTab.appendChild(
        wrapComboWithFacetHandle(
          "tab",
          et,
          cellComboTab(et, row.tab, "Tab for " + et),
          "Reorder tabs within this row’s section and page",
        ),
      );
      tr.appendChild(tdTab);

      var tdOrd = document.createElement("td");
      tdOrd.appendChild(
        cellNavOrder(row.nav_order != null ? row.nav_order : "", "Nav order for " + et),
      );
      tr.appendChild(tdOrd);

      tbody.appendChild(tr);
    });
    refreshDatalists(tbody);
    setRowBaselines(types, entries);
    refreshObjectSelectorControls(types, entries);
  }

  function readRowFieldsFromTr(tr) {
    var dn = tr.querySelector(".gc-designer-entity-nav__input-display");
    var ns = tr.querySelector(".gc-designer-entity-nav__input-section");
    var no = tr.querySelector(".gc-designer-entity-nav__input-nav-order");
    var np = tr.querySelector(".gc-designer-entity-nav__input-page");
    var tb = tr.querySelector(".gc-designer-entity-nav__input-tab");
    var ks = tr.querySelector(".gc-designer-entity-nav__select-kind");
    return {
      kind: normalizeKind(ks && ks.value),
      display_name: trimStr(dn && dn.value),
      nav_section: trimStr(ns && ns.value),
      nav_order: trimStr(no && no.value),
      nav_page: trimStr(np && np.value),
      tab: trimStr(tb && tb.value),
    };
  }

  function rowFieldsEqual(a, b) {
    return (
      a.kind === b.kind &&
      a.display_name === b.display_name &&
      a.nav_section === b.nav_section &&
      a.nav_order === b.nav_order &&
      a.nav_page === b.nav_page &&
      a.tab === b.tab
    );
  }

  function setRowBaselines(types, entries) {
    state.rowBaseline = {};
    if (!types || !types.length) return;
    var merged = mergeEntriesForSort(types, entries);
    types.forEach(function (et) {
      var n = navRowFromEntry(et, merged[et]);
      state.rowBaseline[et] = {
        kind: n.kind,
        display_name: n.display_name,
        nav_section: n.nav_section,
        nav_order: n.nav_order,
        nav_page: n.nav_page,
        tab: n.tab,
      };
    });
  }

  function refreshRowDirtyClass(tr) {
    var et = trimStr(tr.getAttribute("data-entity-type"));
    if (!et) return;
    var base = state.rowBaseline[et];
    if (!base) return;
    var cur = readRowFieldsFromTr(tr);
    tr.classList.toggle(DIRTY_ROW_CLASS, !rowFieldsEqual(cur, base));
  }

  function collectEntriesFromDom(tbody) {
    var entries = {};
    if (!tbody) return entries;
    tbody.querySelectorAll("tr[data-entity-type]").forEach(function (tr) {
      var et = trimStr(tr.getAttribute("data-entity-type"));
      if (!et) return;
      entries[et] = readRowFieldsFromTr(tr);
    });
    return entries;
  }

  function entriesPayloadSorted(types, entries) {
    var merged = mergeEntriesForSort(types, entries);
    var sortedTypes = sortTypesByNav(types, merged);
    var ordered = {};
    sortedTypes.forEach(function (et) {
      var e = entries[et];
      ordered[et] = e
        ? {
          kind: normalizeKind(e.kind),
          display_name: e.display_name,
          nav_section: e.nav_section,
          nav_order: e.nav_order,
          nav_page: e.nav_page,
          tab: e.tab,
        }
        : {
          kind: "Objects",
          display_name: "",
          nav_section: "",
          nav_order: "",
          nav_page: "",
          tab: "",
        };
    });
    return ordered;
  }

  function getDragAfterElementForFacetList(ol, y, dragging) {
    var rows = [].slice.call(ol.querySelectorAll("li")).filter(function (c) {
      return c !== dragging;
    });
    var closest = { offset: Number.NEGATIVE_INFINITY, element: null };
    rows.forEach(function (child) {
      var box = child.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        closest = { offset: offset, element: child };
      }
    });
    return closest.element;
  }

  function bindFacetOverlayListOnce(ol) {
    if (!ol || ol.dataset.gcFacetOverlayListBound) return;
    ol.dataset.gcFacetOverlayListBound = "1";
    var dragLi = null;
    ol.addEventListener("dragstart", function (e) {
      var li = e.target.closest && e.target.closest("li");
      if (!li || !ol.contains(li)) return;
      dragLi = li;
      li.classList.add("gc-designer-entity-nav-facet-overlay__item--dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", li.getAttribute("data-facet-label") || "");
    });
    ol.addEventListener("dragend", function () {
      if (dragLi) dragLi.classList.remove("gc-designer-entity-nav-facet-overlay__item--dragging");
      dragLi = null;
    });
    ol.addEventListener("dragover", function (e) {
      e.preventDefault();
      if (!dragLi) return;
      var after = getDragAfterElementForFacetList(ol, e.clientY, dragLi);
      if (after == null) {
        ol.appendChild(dragLi);
      } else if (after !== dragLi) {
        ol.insertBefore(dragLi, after);
      }
    });
    ol.addEventListener("drop", function (e) {
      e.preventDefault();
    });
  }

  function readFacetListLabels(ol) {
    return [].map.call(ol.querySelectorAll("li"), function (li) {
      var v = li.getAttribute("data-facet-label");
      return v != null ? v : trimStr(li.textContent);
    });
  }

  function openFacetOverlay(axis, tr) {
    var overlay = document.getElementById("gc-designer-entity-nav-facet-overlay");
    var titleEl = document.getElementById("gc-designer-entity-nav-facet-title");
    var hintEl = document.getElementById("gc-designer-entity-nav-facet-hint");
    var listEl = document.getElementById("gc-designer-entity-nav-facet-list");
    if (!overlay || !titleEl || !listEl) return;
    if (!state.tbody) return;
    var entries = collectEntriesFromDom(state.tbody);
    facetOverlayState.axis = axis;
    facetOverlayState.anchorSection = "";
    facetOverlayState.anchorPage = "";
    facetOverlayState.cancelSnapshot = cloneFacetOrders(state.facetOrders || defaultFacetOrders());

    var labels = [];
    var title = "";

    if (axis === "section") {
      title = "Reorder nav sections";
      labels = buildSectionFacetList(entries);
      if (hintEl) {
        hintEl.textContent =
          labels.length === 0
            ? "Add at least one nav section on a row, then try again."
            : "Drag rows to set section order. Click Apply order, then Save navigation metadata to persist.";
      }
    } else if (axis === "page") {
      var f = readRowFieldsFromTr(tr);
      facetOverlayState.anchorSection = trimStr(f.nav_section);
      title = "Reorder nav pages in “" + (facetOverlayState.anchorSection || "(empty)") + "”";
      if (!trimStr(f.nav_section)) {
        if (hintEl) hintEl.textContent = "Set this row’s nav section first, then use the page handle.";
        labels = [];
      } else {
        labels = buildPageFacetList(entries, f.nav_section);
        if (hintEl) {
          hintEl.textContent =
            labels.length === 0
              ? "No nav pages in this section yet."
              : "Only pages used by rows in this section are listed (case-insensitive).";
        }
      }
    } else if (axis === "tab") {
      var f2 = readRowFieldsFromTr(tr);
      facetOverlayState.anchorSection = trimStr(f2.nav_section);
      facetOverlayState.anchorPage = trimStr(f2.nav_page);
      title =
        "Reorder tabs in “" +
        (facetOverlayState.anchorSection || "?") +
        "” · “" +
        (facetOverlayState.anchorPage || "?") +
        "”";
      if (!trimStr(f2.nav_section) || !trimStr(f2.nav_page)) {
        if (hintEl) hintEl.textContent = "Set this row’s nav section and nav page first, then use the tab handle.";
        labels = [];
      } else {
        labels = buildTabFacetList(entries, f2.nav_section, f2.nav_page);
        if (hintEl) {
          hintEl.textContent =
            labels.length === 0
              ? "No tab values in this section and page yet."
              : "Only tabs used by rows sharing this section and page are listed.";
        }
      }
    }

    titleEl.textContent = title;
    listEl.innerHTML = "";
    labels.forEach(function (lab) {
      var li = document.createElement("li");
      li.className = "gc-designer-entity-nav-facet-overlay__item";
      li.draggable = true;
      li.setAttribute("data-facet-label", lab);
      li.textContent = lab;
      listEl.appendChild(li);
    });
    bindFacetOverlayListOnce(listEl);
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("gc-designer-entity-nav__facet-overlay-open");
    var doneBtn = document.getElementById("gc-designer-entity-nav-facet-done");
    if (doneBtn) doneBtn.focus();
  }

  function closeFacetOverlay(restore) {
    if (restore && facetOverlayState.cancelSnapshot) {
      state.facetOrders = cloneFacetOrders(facetOverlayState.cancelSnapshot);
    }
    facetOverlayState.axis = null;
    facetOverlayState.cancelSnapshot = null;
    facetOverlayState.anchorSection = "";
    facetOverlayState.anchorPage = "";
    var overlay = document.getElementById("gc-designer-entity-nav-facet-overlay");
    if (overlay) {
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("gc-designer-entity-nav__facet-overlay-open");
  }

  function applyFacetOverlayOrder() {
    var listEl = document.getElementById("gc-designer-entity-nav-facet-list");
    if (!listEl || !facetOverlayState.axis) return;
    var labels = readFacetListLabels(listEl);
    var axis = facetOverlayState.axis;
    if (!state.facetOrders) state.facetOrders = defaultFacetOrders();
    if (axis === "section") {
      state.facetOrders.sections = labels.slice();
    } else if (axis === "page") {
      var sk = sectionKey(facetOverlayState.anchorSection);
      if (!sk) {
        closeFacetOverlay(true);
        return;
      }
      state.facetOrders.pagesBySection = state.facetOrders.pagesBySection || {};
      state.facetOrders.pagesBySection[sk] = labels.slice();
    } else if (axis === "tab") {
      var sk2 = sectionKey(facetOverlayState.anchorSection);
      var pk2 = pageKey(facetOverlayState.anchorPage);
      if (!sk2 || !pk2) {
        closeFacetOverlay(true);
        return;
      }
      var tkey = sk2 + "|" + pk2;
      state.facetOrders.tabsBySectionPage = state.facetOrders.tabsBySectionPage || {};
      state.facetOrders.tabsBySectionPage[tkey] = labels.slice();
    }
    var tbody = state.tbody;
    if (tbody) {
      var raw = collectEntriesFromDom(tbody);
      renderTable(tbody, state.types, raw);
    }
    closeFacetOverlay(false);
  }

  function bindFacetOverlayUiOnce() {
    var overlay = document.getElementById("gc-designer-entity-nav-facet-overlay");
    if (!overlay || overlay.dataset.gcFacetOverlayUiBound) return;
    overlay.dataset.gcFacetOverlayUiBound = "1";
    var done = document.getElementById("gc-designer-entity-nav-facet-done");
    var cancel = document.getElementById("gc-designer-entity-nav-facet-cancel");
    var backdrop = overlay.querySelector(".gc-designer-entity-nav-facet-overlay__backdrop");
    if (done)
      done.addEventListener("click", function () {
        applyFacetOverlayOrder();
      });
    if (cancel)
      cancel.addEventListener("click", function () {
        closeFacetOverlay(true);
      });
    if (backdrop)
      backdrop.addEventListener("click", function () {
        closeFacetOverlay(true);
      });
    document.addEventListener("keydown", function (e) {
      if (!overlay || overlay.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeFacetOverlay(true);
      }
    });
  }

  function bindFacetHandleDragOnce(tbody) {
    if (!tbody || tbody.dataset.gcFacetHandleBound) return;
    tbody.dataset.gcFacetHandleBound = "1";
    tbody.addEventListener("dragstart", function (e) {
      var fh = e.target.closest && e.target.closest(".gc-designer-entity-nav__facet-handle");
      if (!fh || !tbody.contains(fh)) return;
      e.stopPropagation();
      var img = new Image();
      img.src = BLANK_DRAG_IMAGE;
      try {
        e.dataTransfer.setDragImage(img, 0, 0);
      } catch (err) {
        /* ignore */
      }
      e.dataTransfer.effectAllowed = "none";
      var tr = fh.closest("tr[data-entity-type]");
      if (!tr) return;
      var axis = fh.getAttribute("data-facet-axis") || "section";
      openFacetOverlay(axis, tr);
    });
    tbody.addEventListener("keydown", function (e) {
      var fh = e.target.closest && e.target.closest(".gc-designer-entity-nav__facet-handle");
      if (!fh || !tbody.contains(fh)) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      var tr2 = fh.closest("tr[data-entity-type]");
      if (!tr2) return;
      var axis2 = fh.getAttribute("data-facet-axis") || "section";
      openFacetOverlay(axis2, tr2);
    });
  }

  function save(tbody, saveBtn, statusEl) {
    if (!tbody) return;
    var raw = collectEntriesFromDom(tbody);
    var ordered = entriesPayloadSorted(state.types, raw);
    if (saveBtn) saveBtn.disabled = true;
    setSaveStatus(statusEl, "Saving…");
    fetch(API_URL, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "Ground-Control",
      },
      body: JSON.stringify({
        entries: ordered,
        facet_orders: cloneFacetOrders(state.facetOrders || defaultFacetOrders()),
      }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, status: r.status, j: j };
        });
      })
      .then(function (res) {
        if (saveBtn) saveBtn.disabled = false;
        if (!res.ok || !res.j || !res.j.ok) {
          var det = res.j && res.j.detail;
          setSaveStatus(
            statusEl,
            typeof det === "string" ? det : "Save failed (" + (res.status || "?") + ").",
          );
          return;
        }
        var n = Object.keys(res.j.entries || {}).length;
        setSaveStatus(statusEl, "Saved " + n + " type(s) to data/designer_entity_type_navigation.json.");
        if (res.j.facet_orders) {
          state.facetOrders = normalizeFacetOrders(res.j.facet_orders);
        }
        renderTable(tbody, state.types, res.j.entries || {});
      })
      .catch(function () {
        if (saveBtn) saveBtn.disabled = false;
        setSaveStatus(statusEl, "Save request failed.");
      });
  }

  function init() {
    var tbody = document.getElementById("gc-designer-entity-nav-tbody");
    var saveBtn = document.getElementById("gc-designer-entity-nav-save");
    var statusEl = document.getElementById("gc-designer-entity-nav-save-status");
    if (!tbody) return;

    state.tbody = tbody;
    state.facetOrders = defaultFacetOrders();
    ensureSectionDatalist();
    bindEntityNavDragOnce(tbody);
    bindFacetHandleDragOnce(tbody);
    bindFacetOverlayUiOnce();

    Promise.all([loadDistinctTypes(), loadSavedEntries()]).then(function (pair) {
      state.types = pair[0];
      var pack = pair[1];
      state.facetOrders = (pack && pack.facet_orders) || defaultFacetOrders();
      renderTable(tbody, state.types, (pack && pack.entries) || {});
    });

    function onTbodyFieldEdit(ev) {
      scheduleRefreshDatalists(tbody);
      var tr = ev.target.closest && ev.target.closest("tr[data-entity-type]");
      if (tr) refreshRowDirtyClass(tr);
    }
    tbody.addEventListener("input", onTbodyFieldEdit);
    tbody.addEventListener("change", onTbodyFieldEdit);

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        save(tbody, saveBtn, statusEl);
      });
    }
  }

  if (typeof window !== "undefined") {
    /**
     * Fill a standalone object-selector select (data-gc-designer-object-selector) with grouped entity types:
     * distinct cache types plus Designer · Navigation labels and facet order. For pages without the full nav table.
     */
    window.gcDesignerHydrateObjectSelectorDropdown = function (selectEl, onReady) {
      if (!selectEl) return;
      if (String(selectEl.tagName || "").toLowerCase() !== "select") return;
      Promise.all([loadDistinctTypes(), loadSavedEntries()])
        .then(function (pair) {
          var types = pair[0];
          var pack = pair[1] || {};
          var entries = pack.entries && typeof pack.entries === "object" ? pack.entries : {};
          var fo = normalizeFacetOrders(pack.facet_orders);
          var prevFo = state.facetOrders;
          state.facetOrders = fo;
          try {
            fillObjectSelectorDropdown(selectEl, types, entries);
          } finally {
            state.facetOrders = prevFo;
          }
          if (typeof onReady === "function") {
            try {
              onReady(selectEl);
            } catch (eCb) {
              /* ignore */
            }
          }
        })
        .catch(function () {
          selectEl.innerHTML = "";
          var o = document.createElement("option");
          o.value = "";
          o.textContent = "Failed to load types";
          selectEl.appendChild(o);
          selectEl.disabled = true;
          if (typeof onReady === "function") {
            try {
              onReady(selectEl);
            } catch (eCb2) {
              /* ignore */
            }
          }
        });
    };

    /**
     * Fill a standalone object-selector-list mount (data-gc-designer-object-selector="object-selector-list")
     * with grouped entity types: distinct cache types plus Designer · Navigation labels and facet order.
     */
    window.gcDesignerHydrateObjectSelectorList = function (containerEl, onReady) {
      if (!containerEl) return;
      Promise.all([loadDistinctTypes(), loadSavedEntries()])
        .then(function (pair) {
          var types = pair[0];
          var pack = pair[1] || {};
          var entries = pack.entries && typeof pack.entries === "object" ? pack.entries : {};
          var fo = normalizeFacetOrders(pack.facet_orders);
          var prevFo = state.facetOrders;
          state.facetOrders = fo;
          try {
            fillObjectSelectorList(containerEl, types, entries);
          } finally {
            state.facetOrders = prevFo;
          }
          if (typeof onReady === "function") {
            try {
              onReady(containerEl);
            } catch (eCb) {
              /* ignore */
            }
          }
        })
        .catch(function () {
          containerEl.innerHTML = "";
          containerEl.classList.add("is-disabled");
          var empty = document.createElement("p");
          empty.className = "muted gc-designer-object-selector-list__empty";
          empty.textContent = "Could not load entity types.";
          containerEl.appendChild(empty);
          if (typeof onReady === "function") {
            try {
              onReady(containerEl);
            } catch (eCb2) {
              /* ignore */
            }
          }
        });
    };

    window.gcDesignerObjectSelectorNames = {
      objectSelector: "object-selector",
      objectSelectorList: "object-selector-list",
      dataControlsEntityType: "data-controls-entity-type",
    };
    window.gcQueryDesignerObjectSelector = function (name) {
      var n = String(name || "").trim();
      if (!/^[a-z][a-z0-9-]*$/i.test(n)) return null;
      return document.querySelector('[data-gc-designer-object-selector="' + n + '"]');
    };
    window.gcQueryDesignerObjectSelectorAll = function (name) {
      var n = String(name || "").trim();
      if (!/^[a-z][a-z0-9-]*$/i.test(n)) return [];
      return Array.prototype.slice.call(
        document.querySelectorAll('[data-gc-designer-object-selector="' + n + '"]'),
      );
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
