/**
 * Client-side table sorting: click column headers to toggle ascending/descending.
 * Skips checkbox / actions columns; keeps filter-empty and colspan rows fixed in place.
 */
(function (global) {
  "use strict";

  let theadClickHandlers = new WeakMap();
  let sortState = new WeakMap();

  function headerColCount(table) {
    let tr = table.querySelector("thead tr");
    if (!tr) return 0;
    return tr.cells.length;
  }

  function isDataRow(tr, colCount) {
    if (!tr || tr.tagName !== "TR") return false;
    if (colCount < 1) return false;
    if (tr.cells.length !== colCount) return false;
    let c0 = tr.cells[0];
    if (c0 && c0.colSpan > 1) return false;
    return true;
  }

  function isSortableTh(th) {
    if (!th || th.tagName !== "TH") return false;
    if (th.hasAttribute("data-gc-no-sort")) return false;
    if (th.classList.contains("th-check")) return false;
    if (th.querySelector("input, button, select")) return false;
    if (th.classList.contains("actions")) return false;
    if (th.classList.contains("settings-cred-actions-col")) return false;
    if (th.classList.contains("task-queue-col-actions")) return false;
    if (th.dataset.gcCol === "_placeholder") return false;
    return true;
  }

  function markSortableHeaders(table) {
    let thead = table.querySelector("thead");
    if (!thead) return;
    thead.querySelectorAll("th").forEach(function (th) {
      th.classList.toggle("gc-th-sortable", isSortableTh(th));
      if (!isSortableTh(th)) {
        th.removeAttribute("aria-sort");
      }
    });
  }

  function clearAriaSort(table) {
    let thead = table.querySelector("thead");
    if (!thead) return;
    thead.querySelectorAll("th.gc-th-sortable").forEach(function (th) {
      th.removeAttribute("aria-sort");
    });
  }

  function cellSortValue(td, th, colId) {
    if (!td) return "";
    let explicit = td.dataset.sortValue;
    if (explicit != null && explicit !== "") return explicit;
    let tr = td.closest("tr");
    if (tr && colId === "tls") {
      let tls = tr.dataset.tls;
      if (tls != null) return tls;
    }
    if (tr && colId === "monitor") {
      let m = tr.dataset.fwMonitor;
      if (m != null) return m === "1" ? "1" : m === "0" ? "0" : m;
    }
    if (tr && colId === "port") {
      let p = tr.dataset.fwPort;
      if (p != null && p !== "") return p;
    }
    return (td.textContent || "").replace(/\s+/g, " ").trim();
  }

  function compareValues(a, b, th) {
    let mode = th.dataset.gcSort;
    if (mode === "number") {
      let na = parseFloat(String(a).replace(/,/g, ""));
      let nb = parseFloat(String(b).replace(/,/g, ""));
      if (isNaN(na)) na = Number.NEGATIVE_INFINITY;
      if (isNaN(nb)) nb = Number.NEGATIVE_INFINITY;
      return na - nb;
    }
    if (mode === "date") {
      let da = Date.parse(String(a));
      let db = Date.parse(String(b));
      if (isNaN(da)) da = 0;
      if (isNaN(db)) db = 0;
      return da - db;
    }
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  }

  function sortTable(table, colIndex, ascending) {
    let tbody = table.tBodies[0];
    if (!tbody) return;
    let colCount = headerColCount(table);
    let headerRow = table.querySelector("thead tr");
    if (!headerRow || colIndex < 0 || colIndex >= headerRow.cells.length) return;
    let th = headerRow.cells[colIndex];
    if (!isSortableTh(th)) return;

    let colId = th.dataset.gcCol || "";
    let children = Array.prototype.slice.call(tbody.children);
    let slots = children.map(function (tr) {
      return { tr: tr, isData: isDataRow(tr, colCount) };
    });
    let dataRows = slots
      .filter(function (s) {
        return s.isData;
      })
      .map(function (s) {
        return s.tr;
      });
    if (dataRows.length < 2) return;

    let dir = ascending ? 1 : -1;
    dataRows.sort(function (a, b) {
      let tdA = a.cells[colIndex];
      let tdB = b.cells[colIndex];
      let va = cellSortValue(tdA, th, colId);
      let vb = cellSortValue(tdB, th, colId);
      return dir * compareValues(va, vb, th);
    });

    let k = 0;
    slots.forEach(function (s) {
      tbody.appendChild(s.isData ? dataRows[k++] : s.tr);
    });
  }

  function applySortFromClick(table, colIndex) {
    let headerRow = table.querySelector("thead tr");
    if (!headerRow) return;
    let th = headerRow.cells[colIndex];
    if (!th || !isSortableTh(th)) return;

    let prev = sortState.get(table) || {};
    let ascending = true;
    if (prev.col === colIndex) ascending = !prev.asc;
    sortState.set(table, { col: colIndex, asc: ascending });

    clearAriaSort(table);
    th.setAttribute("aria-sort", ascending ? "ascending" : "descending");

    sortTable(table, colIndex, ascending);
  }

  function bindTable(table) {
    if (!table || !table.querySelector) return;
    let thead = table.querySelector("thead");
    if (!thead) return;

    markSortableHeaders(table);

    let prev = theadClickHandlers.get(table);
    if (prev) thead.removeEventListener("click", prev);

    function onHeadClick(e) {
      let t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("input, button, a, select, label")) return;
      let th = t.closest("th");
      if (!th || !thead.contains(th) || !th.classList.contains("gc-th-sortable")) return;
      e.preventDefault();
      applySortFromClick(table, th.cellIndex);
    }

    thead.addEventListener("click", onHeadClick);
    theadClickHandlers.set(table, onHeadClick);
  }

  function initAll(root) {
    let scope = root || document;
    scope.querySelectorAll("table.data-table, table.task-queue-diff-table, table.settings-cred-table").forEach(function (t) {
      bindTable(t);
    });
  }

  function boot() {
    initAll(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.gcTableSort = {
    bindTable: bindTable,
    initAll: initAll,
  };
})(globalThis);
