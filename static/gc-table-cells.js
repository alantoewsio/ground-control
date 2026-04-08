/**
 * Shared table cell helpers: shorten dotted column labels, compact multi-value cells
 * with a preview row and a searchable modal for the full list.
 */
(function (global) {
  "use strict";

  var HS_SEP = "\x1e";
  var SEARCH_MIN_ITEMS = 12;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Display title for headers / modals: HostList.Host -> Host; leaves __internal keys untouched.
   */
  function gcTableColumnDisplayLabel(s) {
    s = String(s == null ? "" : s);
    if (!s || s.indexOf(".") === -1) return s;
    if (s.indexOf("__") === 0) return s;
    return s.slice(s.lastIndexOf(".") + 1);
  }

  /**
   * Normalize a cell to a string[] when it represents multiple distinct values (>= 2).
   * @param {*} raw
   * @param {string} [multivalueSep] - default Record Separator used by hosts/services tables
   */
  function gcTableNormalizeListCellItems(raw, multivalueSep) {
    var sep = multivalueSep !== undefined ? multivalueSep : HS_SEP;
    if (raw == null) return null;
    if (Array.isArray(raw)) {
      var a = raw
        .map(function (x) {
          return String(x == null ? "" : x).trim();
        })
        .filter(function (x) {
          return x.length > 0;
        });
      return a.length >= 2 ? a : null;
    }
    var str = String(raw);
    if (sep && str.indexOf(sep) !== -1) {
      var parts = str
        .split(sep)
        .map(function (x) {
          return String(x || "").trim();
        })
        .filter(function (x) {
          return x.length > 0;
        });
      return parts.length >= 2 ? parts : null;
    }
    var t = str.trim();
    if (t.charAt(0) === "[") {
      try {
        var j = JSON.parse(t);
        if (Array.isArray(j)) {
          var b = j
            .map(function (x) {
              return String(x == null ? "" : x).trim();
            })
            .filter(function (x) {
              return x.length > 0;
            });
          return b.length >= 2 ? b : null;
        }
      } catch (e) {}
    }
    return null;
  }

  function defaultListPillHtml(text) {
    return (
      '<span class="gc-table-value-pill">' + escapeHtml(String(text == null ? "" : text)) + "</span>"
    );
  }

  function morePillHtml(restCount) {
    var n = typeof restCount === "number" ? restCount : parseInt(restCount, 10);
    if (isNaN(n) || n < 1) n = 0;
    return (
      '<span class="gc-table-value-pill gc-table-value-pill--more" title="Show all values">' +
      escapeHtml("+" + n + " more") +
      "</span>"
    );
  }

  /**
   * First values as pills, then a +N more pill (N = items beyond the first two shown).
   * @param {string[]} items
   * @param {function(string): string} pillRenderer
   */
  function gcTableListCellPreviewHtml(items, pillRenderer) {
    var fn = typeof pillRenderer === "function" ? pillRenderer : defaultListPillHtml;
    if (!items || items.length < 2) return "";
    var maxFirst = 2;
    var out = [];
    var i;
    for (i = 0; i < items.length && i < maxFirst; i++) {
      out.push(fn(items[i]));
    }
    var rest = items.length - maxFirst;
    if (rest > 0) out.push(morePillHtml(rest));
    return '<span class="gc-table-cell-pills">' + out.join("") + "</span>";
  }

  var modalEl;
  var modalTitleEl;
  var modalSearchEl;
  var modalListEl;
  var modalCloseEl;
  var modalBackdropEl;
  var lastModalTrigger;
  var modalKeydownBound;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.id = "gc-table-list-modal";
    modalEl.className = "fw-cols-modal gc-table-list-modal";
    modalEl.setAttribute("hidden", "");
    modalEl.innerHTML =
      '<div class="fw-cols-modal__backdrop" data-gc-list-modal-backdrop></div>' +
      '<div class="fw-cols-modal__panel gc-table-list-modal__panel" role="dialog" aria-modal="true" aria-labelledby="gc-table-list-modal-title">' +
      '<div class="fw-cols-modal__header">' +
      '<h2 id="gc-table-list-modal-title" class="fw-cols-modal__title"></h2>' +
      '<button type="button" class="fw-cols-modal__close" data-gc-list-modal-close aria-label="Close">' +
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
      "</button></div>" +
      '<input type="search" class="fw-cols-modal__filter gc-table-list-modal__search" id="gc-table-list-modal-search" autocomplete="off" placeholder="Search" />' +
      '<ul class="fw-cols-modal__list gc-table-list-modal__list" id="gc-table-list-modal-list"></ul>' +
      "</div>";
    document.body.appendChild(modalEl);
    modalTitleEl = modalEl.querySelector("#gc-table-list-modal-title");
    modalSearchEl = modalEl.querySelector("#gc-table-list-modal-search");
    modalListEl = modalEl.querySelector("#gc-table-list-modal-list");
    modalCloseEl = modalEl.querySelector("[data-gc-list-modal-close]");
    modalBackdropEl = modalEl.querySelector("[data-gc-list-modal-backdrop]");

    function closeModal() {
      modalEl.setAttribute("hidden", "");
      if (lastModalTrigger && typeof lastModalTrigger.focus === "function") {
        try {
          lastModalTrigger.focus();
        } catch (e) {}
      }
      lastModalTrigger = null;
    }

    modalCloseEl.addEventListener("click", closeModal);
    modalBackdropEl.addEventListener("click", closeModal);
    if (!modalKeydownBound) {
      modalKeydownBound = true;
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modalEl && !modalEl.hasAttribute("hidden")) {
          closeModal();
        }
      });
    }

    modalSearchEl.addEventListener("input", function () {
      var q = (modalSearchEl.value || "").trim().toLowerCase();
      modalListEl.querySelectorAll("li").forEach(function (li) {
        var t = (li.getAttribute("data-gc-list-text") || "").toLowerCase();
        li.hidden = q.length > 0 && t.indexOf(q) === -1;
      });
    });

    return modalEl;
  }

  function fillModalList(items, pillFn, listModalItemOptions) {
    modalListEl.innerHTML = "";
    var opts = listModalItemOptions && typeof listModalItemOptions === "object" ? listModalItemOptions : null;
    var onActivate = opts && typeof opts.onItemActivate === "function" ? opts.onItemActivate : null;
    var ariaPrefix =
      opts && typeof opts.itemAriaLabelPrefix === "string" ? opts.itemAriaLabelPrefix.trim() : "";
    items.forEach(function (text) {
      var li = document.createElement("li");
      li.className = "gc-table-list-modal__item";
      li.setAttribute("data-gc-list-text", String(text));
      li.innerHTML = pillFn(text);
      if (onActivate) {
        li.classList.add("gc-table-list-modal__item--activate");
        li.setAttribute("role", "button");
        li.setAttribute("tabindex", "0");
        li.setAttribute(
          "aria-label",
          (ariaPrefix ? ariaPrefix + " " : "Open ") + String(text),
        );
        (function (memberText) {
          function go(e) {
            if (e) {
              e.preventDefault();
              e.stopPropagation();
            }
            onActivate(memberText);
          }
          li.addEventListener("click", go);
          li.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
              go(e);
            }
          });
        })(text);
      }
      modalListEl.appendChild(li);
    });
  }

  function openListValueModal(title, items, pillFn, listModalItemOptions) {
    ensureModal();
    lastModalTrigger = document.activeElement;
    var renderer = typeof pillFn === "function" ? pillFn : defaultListPillHtml;
    var copy = items.slice();
    modalTitleEl.textContent = title || "Values";
    fillModalList(copy, renderer, listModalItemOptions);
    var showSearch = copy.length >= SEARCH_MIN_ITEMS;
    if (showSearch) {
      modalSearchEl.value = "";
      modalSearchEl.removeAttribute("hidden");
    } else {
      modalSearchEl.setAttribute("hidden", "");
    }
    modalEl.removeAttribute("hidden");
    if (showSearch) {
      setTimeout(function () {
        modalSearchEl.focus();
      }, 30);
    } else if (modalCloseEl) {
      modalCloseEl.focus();
    }
  }

  /**
   * @param {HTMLElement} td
   * @param {string[]} items
   * @param {string} columnTitle
   * @param {function(string): string} [pillRenderer]
   * @param {{ onItemActivate?: function(string): void, itemAriaLabelPrefix?: string }} [listModalItemOptions]
   */
  function gcTableBindListCell(td, items, columnTitle, pillRenderer, listModalItemOptions) {
    if (!td || !items || items.length < 2) return;
    td.classList.add("gc-table-cell--list");
    td.setAttribute("role", "button");
    td.setAttribute("tabindex", "0");
    var pfx = gcTableColumnDisplayLabel(columnTitle || "");
    td.setAttribute(
      "aria-label",
      (pfx || columnTitle || "Column") + ": " + items.length + " values, press Enter or click to show all",
    );
    var pillFn = typeof pillRenderer === "function" ? pillRenderer : defaultListPillHtml;

    function open(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      openListValueModal(pfx || columnTitle || "Values", items, pillFn, listModalItemOptions);
    }

    td.addEventListener("click", open);
    td.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        open(e);
      }
    });
  }

  global.gcTableColumnDisplayLabel = gcTableColumnDisplayLabel;
  global.gcTableNormalizeListCellItems = gcTableNormalizeListCellItems;
  global.gcTableListCellPreviewHtml = gcTableListCellPreviewHtml;
  function closeListValueModal() {
    if (modalEl) {
      modalEl.setAttribute("hidden", "");
    }
    lastModalTrigger = null;
  }

  global.gcTableBindListCell = gcTableBindListCell;
  global.gcTableListModalOpen = openListValueModal;
  global.gcTableListModalClose = closeListValueModal;
})(typeof window !== "undefined" ? window : this);
