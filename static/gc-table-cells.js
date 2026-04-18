/**
 * Shared table cell helpers: shorten dotted column labels, compact multi-value cells
 * with a preview row and a searchable modal for the full list.
 */
(function (global) {
  "use strict";

  let HS_SEP = "\x1e";
  let SEARCH_MIN_ITEMS = 12;

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
    let sep = multivalueSep !== undefined ? multivalueSep : HS_SEP;
    if (raw == null) return null;
    if (Array.isArray(raw)) {
      let a = raw
        .map(function (x) {
          return String(x == null ? "" : x).trim();
        })
        .filter(function (x) {
          return x.length > 0;
        });
      return a.length >= 2 ? a : null;
    }
    let str = String(raw);
    if (sep && str.indexOf(sep) !== -1) {
      let parts = str
        .split(sep)
        .map(function (x) {
          return String(x || "").trim();
        })
        .filter(function (x) {
          return x.length > 0;
        });
      return parts.length >= 2 ? parts : null;
    }
    let t = str.trim();
    if (t.charAt(0) === "[") {
      try {
        let j = JSON.parse(t);
        if (Array.isArray(j)) {
          let b = j
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
    let safe = escapeHtml(String(text == null ? "" : text));
    return '<span class="gc-table-value-pill" title="' + safe + '">' + safe + "</span>";
  }

  function morePillHtml(restCount) {
    let n = typeof restCount === "number" ? restCount : parseInt(restCount, 10);
    if (isNaN(n) || n < 1) n = 0;
    let label = "+" + n + " more";
    return (
      '<span class="gc-table-value-pill gc-table-value-pill--more" aria-label="Show all ' +
      escapeHtml(String(n + 2)) +
      ' values">' +
      escapeHtml(label) +
      "</span>"
    );
  }

  /**
   * First values as pills, then a +N more pill (N = items beyond the first two shown).
   * @param {string[]} items
   * @param {function(string): string} pillRenderer
   */
  function gcTableListCellPreviewHtml(items, pillRenderer) {
    let fn = typeof pillRenderer === "function" ? pillRenderer : defaultListPillHtml;
    if (!items || items.length < 2) return "";
    let maxFirst = 2;
    let out = [];
    let i;
    for (i = 0; i < items.length && i < maxFirst; i++) {
      out.push(fn(items[i]));
    }
    let rest = items.length - maxFirst;
    if (rest > 0) out.push(morePillHtml(rest));
    return '<span class="gc-table-cell-pills">' + out.join("") + "</span>";
  }

  let modalEl;
  let modalPanelEl;
  let modalTitleEl;
  let modalSearchEl;
  let modalListEl;
  let modalCloseEl;
  let modalBackdropEl;
  let lastModalTrigger;
  let modalKeydownBound;
  let activeAnchorEl;
  let resizeListener;
  let scrollListener;

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
      (window.gcIcon ? window.gcIcon("close", { size: "md" }) : "") +
      "</button></div>" +
      '<input type="search" class="fw-cols-modal__filter gc-table-list-modal__search" id="gc-table-list-modal-search" autocomplete="off" placeholder="Search" />' +
      '<ul class="fw-cols-modal__list gc-table-list-modal__list" id="gc-table-list-modal-list"></ul>' +
      "</div>";
    document.body.appendChild(modalEl);
    modalPanelEl = modalEl.querySelector(".gc-table-list-modal__panel");
    modalTitleEl = modalEl.querySelector("#gc-table-list-modal-title");
    modalSearchEl = modalEl.querySelector("#gc-table-list-modal-search");
    modalListEl = modalEl.querySelector("#gc-table-list-modal-list");
    modalCloseEl = modalEl.querySelector("[data-gc-list-modal-close]");
    modalBackdropEl = modalEl.querySelector("[data-gc-list-modal-backdrop]");

    function closeModal() {
      modalEl.setAttribute("hidden", "");
      modalEl.classList.remove(
        "gc-table-list-modal--anchored",
        "gc-table-list-modal--flip",
        "gc-table-list-modal--align-end",
        "gc-table-list-modal--align-start",
      );
      if (modalPanelEl) {
        modalPanelEl.style.left = "";
        modalPanelEl.style.top = "";
        modalPanelEl.style.removeProperty("--gc-popover-arrow-x");
      }
      activeAnchorEl = null;
      if (resizeListener) {
        window.removeEventListener("resize", resizeListener);
        resizeListener = null;
      }
      if (scrollListener) {
        window.removeEventListener("scroll", scrollListener, true);
        scrollListener = null;
      }
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
      let q = (modalSearchEl.value || "").trim().toLowerCase();
      modalListEl.querySelectorAll("li").forEach(function (li) {
        let t = (li.dataset.gcListText || "").toLowerCase();
        li.hidden = q.length > 0 && t.indexOf(q) === -1;
      });
    });

    return modalEl;
  }

  function fillModalList(items, pillFn, listModalItemOptions) {
    modalListEl.innerHTML = "";
    let opts = listModalItemOptions && typeof listModalItemOptions === "object" ? listModalItemOptions : null;
    let onActivate = opts && typeof opts.onItemActivate === "function" ? opts.onItemActivate : null;
    let ariaPrefix =
      opts && typeof opts.itemAriaLabelPrefix === "string" ? opts.itemAriaLabelPrefix.trim() : "";
    items.forEach(function (text) {
      let li = document.createElement("li");
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

  /**
   * Place the panel next to `anchor`:
   *  - vertically: below if there's room, otherwise above (flips the arrow).
   *  - horizontally: centered on the anchor, clamped to the viewport; if the
   *    centered position would overflow, slide toward the viewport edge and
   *    mark the arrow offset with a CSS custom property so it still points
   *    at the anchor center.
   * Panel uses position: fixed on an ancestor (document.body) with no
   * transformed ancestors, so getBoundingClientRect ↔ inline top/left align 1:1.
   * Returns true iff the anchor was still in view.
   */
  function positionPanelToAnchor(anchor) {
    if (!modalPanelEl || !anchor || typeof anchor.getBoundingClientRect !== "function") return false;
    let gap = 8;
    let edge = 8;
    let vw = window.innerWidth || document.documentElement.clientWidth || 0;
    let vh = window.innerHeight || document.documentElement.clientHeight || 0;
    let r = anchor.getBoundingClientRect();
    let anchorVisible = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    /* Reset inline placement before measuring so offsetWidth/Height reflect the
       natural popover size (width from CSS, height from content). */
    modalPanelEl.style.left = "0px";
    modalPanelEl.style.top = "0px";
    let pw = modalPanelEl.offsetWidth;
    let ph = modalPanelEl.offsetHeight;
    let spaceBelow = vh - r.bottom;
    let spaceAbove = r.top;
    let placeAbove = spaceBelow < ph + gap + edge && spaceAbove > spaceBelow;
    let top = placeAbove ? r.top - ph - gap : r.bottom + gap;
    if (!placeAbove && top + ph > vh - edge) top = Math.max(edge, vh - ph - edge);
    if (placeAbove && top < edge) top = edge;
    let anchorCenterX = r.left + r.width / 2;
    let left = Math.round(anchorCenterX - pw / 2);
    if (left + pw > vw - edge) left = vw - pw - edge;
    if (left < edge) left = edge;
    modalPanelEl.style.left = left + "px";
    modalPanelEl.style.top = Math.round(top) + "px";
    /* Arrow: CSS positions it via --gc-popover-arrow-x (px from panel's left edge),
       so a wide popover that got clamped still visually points at the anchor. */
    let arrowX = Math.max(12, Math.min(pw - 12, Math.round(anchorCenterX - left)));
    modalPanelEl.style.setProperty("--gc-popover-arrow-x", arrowX + "px");
    modalEl.classList.toggle("gc-table-list-modal--flip", placeAbove);
    return anchorVisible;
  }

  function closeModalFromListeners() {
    if (modalEl && !modalEl.hasAttribute("hidden")) {
      modalEl.setAttribute("hidden", "");
      modalEl.classList.remove(
        "gc-table-list-modal--anchored",
        "gc-table-list-modal--flip",
      );
      if (modalPanelEl) {
        modalPanelEl.style.left = "";
        modalPanelEl.style.top = "";
        modalPanelEl.style.removeProperty("--gc-popover-arrow-x");
      }
    }
    activeAnchorEl = null;
    if (resizeListener) {
      window.removeEventListener("resize", resizeListener);
      resizeListener = null;
    }
    if (scrollListener) {
      window.removeEventListener("scroll", scrollListener, true);
      scrollListener = null;
    }
  }

  function bindAnchorListeners() {
    /* Resize: reposition so the popover stays attached to the anchor. */
    if (!resizeListener) {
      resizeListener = function () {
        if (modalEl && !modalEl.hasAttribute("hidden") && activeAnchorEl) {
          positionPanelToAnchor(activeAnchorEl);
        }
      };
      window.addEventListener("resize", resizeListener);
    }
    /* Scroll (any ancestor, capture): close. Trying to re-track a scrolling
       anchor is visually jittery and the anchor often leaves the viewport. */
    if (!scrollListener) {
      scrollListener = function () {
        closeModalFromListeners();
      };
      window.addEventListener("scroll", scrollListener, true);
    }
  }

  function openListValueModal(title, items, pillFn, listModalItemOptions, anchorEl) {
    ensureModal();
    lastModalTrigger = document.activeElement;
    let renderer = typeof pillFn === "function" ? pillFn : defaultListPillHtml;
    let copy = items.slice();
    modalTitleEl.textContent = title || "Values";
    fillModalList(copy, renderer, listModalItemOptions);
    let showSearch = copy.length >= SEARCH_MIN_ITEMS;
    if (showSearch) {
      modalSearchEl.value = "";
      modalSearchEl.removeAttribute("hidden");
    } else {
      modalSearchEl.setAttribute("hidden", "");
    }
    activeAnchorEl = anchorEl && typeof anchorEl.getBoundingClientRect === "function" ? anchorEl : null;
    if (activeAnchorEl) {
      modalEl.classList.add("gc-table-list-modal--anchored");
    } else {
      modalEl.classList.remove("gc-table-list-modal--anchored");
      if (modalPanelEl) {
        modalPanelEl.style.left = "";
        modalPanelEl.style.top = "";
      }
    }
    modalEl.removeAttribute("hidden");
    if (activeAnchorEl) {
      positionPanelToAnchor(activeAnchorEl);
      bindAnchorListeners();
    }
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
    let pfx = gcTableColumnDisplayLabel(columnTitle || "");
    td.setAttribute(
      "aria-label",
      (pfx || columnTitle || "Column") + ": " + items.length + " values, press Enter or click to show all",
    );
    let pillFn = typeof pillRenderer === "function" ? pillRenderer : defaultListPillHtml;

    function open(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      let anchor = td;
      if (e && e.target && typeof e.target.closest === "function") {
        anchor =
          e.target.closest(".gc-table-value-pill--more") ||
          e.target.closest(".gc-table-value-pill") ||
          e.target.closest(".gc-zone-pill") ||
          td;
      }
      openListValueModal(
        pfx || columnTitle || "Values",
        items,
        pillFn,
        listModalItemOptions,
        anchor,
      );
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
    closeModalFromListeners();
    lastModalTrigger = null;
  }

  global.gcTableBindListCell = gcTableBindListCell;
  global.gcTableListModalOpen = openListValueModal;
  global.gcTableListModalClose = closeListValueModal;
})(typeof globalThis !== "undefined" ? globalThis : this);
