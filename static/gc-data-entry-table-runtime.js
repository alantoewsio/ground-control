/**
 * Shared helpers for catalog ``data-entry-table`` object fields and column children
 * (``data-entry-table-col-*``) in object-edit and Designer layout flows.
 */
(function (global) {
  "use strict";

  function trimStr(x) {
    return String(x == null ? "" : x).replace(/^\s+|\s+$/g, "");
  }

  function escapeRe(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Nearest ancestor field (by property_name prefix) that is an object with
   * ``data-entry-table``, excluding the field with ``excludeFieldId`` when matching self.
   */
  function gcDataEntryTableParentForFieldProp(propertyName, allFields, excludeFieldId) {
    var pn = trimStr(propertyName);
    if (!pn || pn.indexOf(".") < 0) return null;
    var segments = pn.split(".");
    for (var i = 1; i < segments.length; i++) {
      var prefix = segments.slice(0, i).join(".");
      for (var j = 0; j < (allFields || []).length; j++) {
        var f = allFields[j];
        if (!f || typeof f !== "object") continue;
        if (excludeFieldId != null && String(f.id || "") === String(excludeFieldId)) continue;
        if (trimStr(f.property_name) !== prefix) continue;
        if (trimStr(f.data_entry_type).toLowerCase() !== "data-entry-table") continue;
        return f;
      }
    }
    return null;
  }

  function gcDataEntryTableIsColumnField(field, allFields) {
    if (!field) return false;
    var pn = trimStr(field.property_name);
    if (!pn) return false;
    var par = gcDataEntryTableParentForFieldProp(pn, allFields, null);
    if (!par) return false;
    return trimStr(par.property_name) !== pn;
  }

  function gcDataEntryTableColumnFieldsForParent(parentField, allFields) {
    var pfx = trimStr(parentField && parentField.property_name) + ".";
    if (pfx === ".") return [];
    return (allFields || [])
      .filter(function (f) {
        if (!f || String(f.id) === String(parentField && parentField.id)) return false;
        var pn = trimStr(f.property_name);
        if (pn.indexOf(pfx) !== 0) return false;
        return gcDataEntryTableIsColumnField(f, allFields);
      })
      .sort(function (a, b) {
        var oa = a.display_order != null ? Number(a.display_order) : 0;
        var ob = b.display_order != null ? Number(b.display_order) : 0;
        if (oa !== ob) return oa - ob;
        return trimStr(a.property_name).localeCompare(trimStr(b.property_name));
      });
  }

  /**
   * Strip every numeric ``<digits>`` segment from a dotted path so flat keys and catalog
   * ``property_name`` values line up regardless of whether rows are indexed (``…ServiceDetail.0.Port``)
   * or stored as a single object (``…ServiceDetail.Port``), and regardless of whether the parent
   * property_name already includes the array-element segment.
   */
  function gcDataEntryTableLogicalRelTail(tail) {
    var s = trimStr(tail);
    if (!s) return s;
    var parts = s.split(".");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (!/^\d+$/.test(parts[i])) out.push(parts[i]);
    }
    return out.join(".");
  }

  /** ``ServiceDetails`` + ``ServiceDetails.ServiceDetail.DestinationPort`` → flat key with index. */
  function gcDataEntryTableFlatKeyForCell(parentProp, columnPropertyFull, rowIndex) {
    var pp = trimStr(parentProp);
    var full = trimStr(columnPropertyFull);
    var rel = full.indexOf(pp + ".") === 0 ? full.slice(pp.length + 1) : "";
    var parts = rel.split(".").filter(Boolean);
    if (parts.length < 2) {
      return pp + "." + String(rowIndex) + "." + (parts[0] || "");
    }
    return pp + "." + parts[0] + "." + String(rowIndex) + "." + parts.slice(1).join(".");
  }

  /** Merge ``row.flat`` and ``row.cells``; if argument is already a flat map, return it. */
  function gcDataEntryTableNormalizeFlatMap(flatOrRow) {
    if (!flatOrRow || typeof flatOrRow !== "object") return {};
    if (
      Object.prototype.hasOwnProperty.call(flatOrRow, "flat") ||
      Object.prototype.hasOwnProperty.call(flatOrRow, "cells")
    ) {
      var out = {};
      if (flatOrRow.flat && typeof flatOrRow.flat === "object") {
        Object.assign(out, flatOrRow.flat);
      }
      if (flatOrRow.cells && typeof flatOrRow.cells === "object") {
        Object.assign(out, flatOrRow.cells);
      }
      return out;
    }
    return flatOrRow;
  }

  /** Two-digit hour or minute segment for time strings. */
  function padTime2(n) {
    var s = String(Number(n) || 0);
    return s.length >= 2 ? s : "0" + s;
  }

  /**
   * Fixed dropdown values for ``data-entry-table-col-time``: every quarter hour from
   * ``00:00`` through ``23:45``, then ``23:59``.
   */
  function gcDataEntryTableQuarterHourTimeOptions() {
    var out = [];
    var h;
    var m;
    for (h = 0; h < 24; h++) {
      for (m = 0; m < 60; m += 15) {
        out.push(padTime2(h) + ":" + padTime2(m));
      }
    }
    if (out.indexOf("23:59") === -1) {
      out.push("23:59");
    }
    return out;
  }

  function gcDataEntryTableColumnFieldValueFromRow(row, propertyName, allFields) {
    var pn = trimStr(propertyName);
    if (!pn || !allFields || !allFields.length) return null;
    var colField = null;
    for (var i = 0; i < allFields.length; i++) {
      var f = allFields[i];
      if (f && trimStr(f.property_name) === pn) {
        colField = f;
        break;
      }
    }
    if (!colField) return null;
    if (!gcDataEntryTableIsColumnField(colField, allFields)) return null;
    var par = gcDataEntryTableParentForFieldProp(pn, allFields, null);
    if (!par) return null;
    var flat = gcDataEntryTableNormalizeFlatMap(row);
    var cols = gcDataEntryTableColumnFieldsForParent(par, allFields);
    var rows = gcDataEntryTableParseRowsFromFlat(flat, par, cols);
    if (!rows.length) return "";
    var cfid = String(colField.id || "");
    var parts = [];
    for (var r = 0; r < rows.length; r++) {
      var cells = rows[r].cells || {};
      if (!Object.prototype.hasOwnProperty.call(cells, cfid)) continue;
      var c = cells[cfid];
      if (c != null && trimStr(String(c)) !== "") parts.push(String(c));
    }
    return parts.length ? parts.join(" · ") : "";
  }

  /**
   * Parse indexed (``…ServiceDetail.0.Port``) **or** unindexed single-row
   * (``…ServiceDetail.Port``) flat keys into row objects keyed by column field id.
   * ``flat`` may be a merged map or a row object ``{ flat, cells }``.
   *
   * Matching is done on the *logical* relative path (all numeric segments stripped),
   * so it works regardless of whether the parent ``property_name`` already includes
   * the array-element segment (``ServiceDetails.ServiceDetail``) or only the wrapper
   * (``ServiceDetails``), and regardless of whether the column ``property_name``
   * carries an example row index.
   * @returns {Array<{ cells: Record<string, string> }>}
   */
  function gcDataEntryTableParseRowsFromFlat(flat, parentField, columnFields) {
    flat = gcDataEntryTableNormalizeFlatMap(flat);
    var parentProp = trimStr(parentField && parentField.property_name);
    var cols = columnFields || [];
    if (!parentProp || !cols.length) return [];
    var prefix = parentProp + ".";
    var colLookup = [];
    cols.forEach(function (cf) {
      var full = trimStr(cf.property_name);
      if (full.indexOf(prefix) !== 0) return;
      var rel = full.slice(prefix.length);
      var logical = gcDataEntryTableLogicalRelTail(rel);
      if (!logical) return;
      colLookup.push({ cf: cf, logical: logical });
    });
    if (!colLookup.length) return [];
    var reFirstDigit = /(?:^|\.)(\d+)(?=\.|$)/;
    var allKeys = Object.keys(flat).filter(function (k) {
      return String(k).indexOf(prefix) === 0;
    });
    /** If any key has a numeric index, the multi-row (indexed) keys are authoritative.
     * Consolidated single-row keys that land alongside them (e.g. combined-view ``cells``)
     * would overwrite row 0, so skip keys without any digit segment in that case. */
    var hasIndexed = false;
    for (var kk = 0; kk < allKeys.length; kk++) {
      var rk = allKeys[kk].slice(prefix.length);
      if (reFirstDigit.test(rk)) {
        hasIndexed = true;
        break;
      }
    }
    var byIx = {};
    allKeys.forEach(function (k) {
      var rel = String(k).slice(prefix.length);
      var logicalRel = gcDataEntryTableLogicalRelTail(rel);
      if (!logicalRel) return;
      var idxMatch = rel.match(reFirstDigit);
      if (!idxMatch && hasIndexed) return;
      var ix = idxMatch ? parseInt(idxMatch[1], 10) : 0;
      if (isNaN(ix)) ix = 0;
      for (var i = 0; i < colLookup.length; i++) {
        if (colLookup[i].logical !== logicalRel) continue;
        if (!byIx[ix]) byIx[ix] = {};
        byIx[ix][String(colLookup[i].cf.id)] = flat[k] != null ? String(flat[k]) : "";
      }
    });
    var keys = Object.keys(byIx)
      .map(function (x) {
        return parseInt(x, 10);
      })
      .filter(function (n) {
        return !isNaN(n);
      })
      .sort(function (a, b) {
        return a - b;
      });
    if (!keys.length) return [];
    return keys.map(function (ix) {
      return { cells: byIx[ix] };
    });
  }

  global.gcDataEntryTableParentForFieldProp = gcDataEntryTableParentForFieldProp;
  global.gcDataEntryTableIsColumnField = gcDataEntryTableIsColumnField;
  global.gcDataEntryTableColumnFieldsForParent = gcDataEntryTableColumnFieldsForParent;
  global.gcDataEntryTableFlatKeyForCell = gcDataEntryTableFlatKeyForCell;
  global.gcDataEntryTableParseRowsFromFlat = gcDataEntryTableParseRowsFromFlat;
  global.gcDataEntryTableNormalizeFlatMap = gcDataEntryTableNormalizeFlatMap;
  global.gcDataEntryTableColumnFieldValueFromRow = gcDataEntryTableColumnFieldValueFromRow;
  global.gcDataEntryTableQuarterHourTimeOptions = gcDataEntryTableQuarterHourTimeOptions;
})(typeof globalThis !== "undefined" ? globalThis : window);
