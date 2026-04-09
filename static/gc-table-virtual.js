/**
 * Virtual scrolling for large tables: only render visible rows + a buffer.
 *
 * Usage:
 *   let vs = gcTableVirtual.attach(tbody, allRowNodes, { rowHeight: 36 });
 *   // later, to update the row set:
 *   vs.setRows(filteredRowNodes);
 *   // clean up:
 *   vs.destroy();
 */
(function (global) {
  "use strict";

  let BUFFER_ROWS = 20;
  let DEFAULT_ROW_HEIGHT = 36;
  let SCROLL_DEBOUNCE_MS = 16;
  let ACTIVATION_THRESHOLD = 500;

  function attach(tbody, allRows, opts) {
    opts = opts || {};
    let rowHeight = opts.rowHeight || DEFAULT_ROW_HEIGHT;
    let onVisibleChange = opts.onVisibleChange || null;
    let scrollContainer = opts.scrollContainer || _findScrollParent(tbody);

    let rows = allRows || [];
    let spacerTop = document.createElement("tr");
    let spacerBottom = document.createElement("tr");
    let spacerTopTd = document.createElement("td");
    let spacerBottomTd = document.createElement("td");
    spacerTopTd.style.padding = "0";
    spacerTopTd.style.border = "none";
    spacerBottomTd.style.padding = "0";
    spacerBottomTd.style.border = "none";
    spacerTop.style.height = "0px";
    spacerBottom.style.height = "0px";
    spacerTop.appendChild(spacerTopTd);
    spacerBottom.appendChild(spacerBottomTd);
    spacerTop.setAttribute("aria-hidden", "true");
    spacerBottom.setAttribute("aria-hidden", "true");
    spacerTop.className = "gc-virtual-spacer";
    spacerBottom.className = "gc-virtual-spacer";

    let renderedStart = 0;
    let renderedEnd = 0;
    let active = false;
    let destroyed = false;
    let rafId = null;

    function _findScrollParent(el) {
      let p = el ? el.parentElement : null;
      while (p) {
        let ov = getComputedStyle(p).overflowY;
        if (ov === "auto" || ov === "scroll") return p;
        p = p.parentElement;
      }
      return document.documentElement;
    }

    function totalHeight() {
      return rows.length * rowHeight;
    }

    function render() {
      if (destroyed) return;

      if (rows.length < ACTIVATION_THRESHOLD) {
        if (active) deactivate();
        return;
      }

      if (!active) activate();

      let scrollTop = scrollContainer.scrollTop || 0;
      let viewportH = scrollContainer.clientHeight || globalThis.innerHeight;
      let tbodyOffset = tbody.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top + scrollTop;

      let relativeScroll = Math.max(0, scrollTop - tbodyOffset);
      let startIdx = Math.max(0, Math.floor(relativeScroll / rowHeight) - BUFFER_ROWS);
      let visibleCount = Math.ceil(viewportH / rowHeight) + BUFFER_ROWS * 2;
      let endIdx = Math.min(rows.length, startIdx + visibleCount);

      if (startIdx === renderedStart && endIdx === renderedEnd) return;

      let colCount = 1;
      let thead = tbody.parentElement ? tbody.parentElement.querySelector("thead") : null;
      if (thead) {
        let ths = thead.querySelectorAll("th");
        if (ths.length) colCount = ths.length;
      }
      spacerTopTd.setAttribute("colspan", String(colCount));
      spacerBottomTd.setAttribute("colspan", String(colCount));

      spacerTop.style.height = (startIdx * rowHeight) + "px";
      spacerBottom.style.height = ((rows.length - endIdx) * rowHeight) + "px";

      let frag = document.createDocumentFragment();
      frag.appendChild(spacerTop);
      for (let i = startIdx; i < endIdx; i++) {
        frag.appendChild(rows[i]);
      }
      frag.appendChild(spacerBottom);

      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      tbody.appendChild(frag);

      renderedStart = startIdx;
      renderedEnd = endIdx;

      if (onVisibleChange) onVisibleChange(startIdx, endIdx, rows.length);
    }

    function onScroll() {
      if (rafId) return;
      rafId = requestAnimationFrame(function () {
        rafId = null;
        render();
      });
    }

    function activate() {
      if (active) return;
      active = true;
      scrollContainer.addEventListener("scroll", onScroll, { passive: true });
      globalThis.addEventListener("resize", onScroll, { passive: true });
    }

    function deactivate() {
      if (!active) return;
      active = false;
      scrollContainer.removeEventListener("scroll", onScroll);
      globalThis.removeEventListener("resize", onScroll);
      spacerTop.remove();
      spacerBottom.remove();
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      for (let i = 0; i < rows.length; i++) {
        tbody.appendChild(rows[i]);
      }
      renderedStart = 0;
      renderedEnd = rows.length;
    }

    function setRows(newRows) {
      rows = newRows || [];
      renderedStart = 0;
      renderedEnd = 0;
      render();
    }

    function destroy() {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      deactivate();
    }

    function getRows() {
      return rows;
    }

    function isActive() {
      return active;
    }

    render();

    return {
      setRows: setRows,
      render: render,
      destroy: destroy,
      getRows: getRows,
      isActive: isActive,
      ACTIVATION_THRESHOLD: ACTIVATION_THRESHOLD,
    };
  }

  global.gcTableVirtual = {
    attach: attach,
    ACTIVATION_THRESHOLD: ACTIVATION_THRESHOLD,
  };
})(globalThis);
