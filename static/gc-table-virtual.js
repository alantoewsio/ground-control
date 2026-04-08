/**
 * Virtual scrolling for large tables: only render visible rows + a buffer.
 *
 * Usage:
 *   var vs = gcTableVirtual.attach(tbody, allRowNodes, { rowHeight: 36 });
 *   // later, to update the row set:
 *   vs.setRows(filteredRowNodes);
 *   // clean up:
 *   vs.destroy();
 */
(function (global) {
  "use strict";

  var BUFFER_ROWS = 20;
  var DEFAULT_ROW_HEIGHT = 36;
  var SCROLL_DEBOUNCE_MS = 16;
  var ACTIVATION_THRESHOLD = 500;

  function attach(tbody, allRows, opts) {
    opts = opts || {};
    var rowHeight = opts.rowHeight || DEFAULT_ROW_HEIGHT;
    var onVisibleChange = opts.onVisibleChange || null;
    var scrollContainer = opts.scrollContainer || _findScrollParent(tbody);

    var rows = allRows || [];
    var spacerTop = document.createElement("tr");
    var spacerBottom = document.createElement("tr");
    var spacerTopTd = document.createElement("td");
    var spacerBottomTd = document.createElement("td");
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

    var renderedStart = 0;
    var renderedEnd = 0;
    var active = false;
    var destroyed = false;
    var rafId = null;

    function _findScrollParent(el) {
      var p = el ? el.parentElement : null;
      while (p) {
        var ov = getComputedStyle(p).overflowY;
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

      var scrollTop = scrollContainer.scrollTop || 0;
      var viewportH = scrollContainer.clientHeight || window.innerHeight;
      var tbodyOffset = tbody.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top + scrollTop;

      var relativeScroll = Math.max(0, scrollTop - tbodyOffset);
      var startIdx = Math.max(0, Math.floor(relativeScroll / rowHeight) - BUFFER_ROWS);
      var visibleCount = Math.ceil(viewportH / rowHeight) + BUFFER_ROWS * 2;
      var endIdx = Math.min(rows.length, startIdx + visibleCount);

      if (startIdx === renderedStart && endIdx === renderedEnd) return;

      var colCount = 1;
      var thead = tbody.parentElement ? tbody.parentElement.querySelector("thead") : null;
      if (thead) {
        var ths = thead.querySelectorAll("th");
        if (ths.length) colCount = ths.length;
      }
      spacerTopTd.setAttribute("colspan", String(colCount));
      spacerBottomTd.setAttribute("colspan", String(colCount));

      spacerTop.style.height = (startIdx * rowHeight) + "px";
      spacerBottom.style.height = ((rows.length - endIdx) * rowHeight) + "px";

      var frag = document.createDocumentFragment();
      frag.appendChild(spacerTop);
      for (var i = startIdx; i < endIdx; i++) {
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
      window.addEventListener("resize", onScroll, { passive: true });
    }

    function deactivate() {
      if (!active) return;
      active = false;
      scrollContainer.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      spacerTop.remove();
      spacerBottom.remove();
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      for (var i = 0; i < rows.length; i++) {
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
})(window);
