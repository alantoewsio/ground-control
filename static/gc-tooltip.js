/* ---------------------------------------------------------------------------
   Ground Control — Unified styled tooltip helper

   Replaces the browser's native `title` tooltip with a single styled surface
   that matches the Figma spec documented in
   ground-control/design/design-skill.md sec. 7:

     bg           #3B3C3D
     text         #FFFFFF, Inter 500, 12px / 16px
     border       1px
     shadow       0 4 4 0 rgba(0,0,0,0.25)
     z-index      1070 (tooltip layer, sec. 11)

   Authors keep writing `title="..."` as before — this module intercepts the
   attribute, copies its value to `data-gc-tooltip`, removes `title` (so the
   browser never surfaces its OS chrome), and shows a portaled styled <div>
   on hover/focus.

   Opt-out: add `data-gc-tooltip-native` to any element that should keep the
   browser's native tooltip behaviour.

   Public API:
     window.gcTooltip.refresh(root?)   // force-rescan a subtree
     window.gcTooltip.hide()           // dismiss any visible tooltip
   --------------------------------------------------------------------------- */
(function () {
  "use strict";

  var SHOW_DELAY_MS = 300;
  var VIEWPORT_GAP = 8;
  var ARROW_SIZE = 6;

  var tooltipEl = null;
  var currentTarget = null;
  var currentAnchor = null;
  var showTimer = null;
  var idCounter = 0;

  function isElement(node) {
    return node && node.nodeType === 1;
  }

  function shouldManage(el) {
    if (!isElement(el)) return false;
    if (el.hasAttribute("data-gc-tooltip-native")) return false;
    return true;
  }

  /* Move a [title] value onto [data-gc-tooltip] so the browser stops
     rendering its own chrome. Runtime assignments (el.title = "...") are
     caught by the MutationObserver below. */
  function migrateElement(el) {
    if (!shouldManage(el)) return;
    var title = el.getAttribute("title");
    if (title == null) return;
    /* Only overwrite data-gc-tooltip if the title is non-empty; an empty
       title is a deliberate "suppress" marker and should clear the tooltip. */
    if (title.length > 0) {
      el.setAttribute("data-gc-tooltip", title);
    } else {
      el.removeAttribute("data-gc-tooltip");
    }
    el.removeAttribute("title");
  }

  function migrateSubtree(root) {
    if (!root) return;
    if (isElement(root) && root.hasAttribute("title")) migrateElement(root);
    if (!root.querySelectorAll) return;
    var nodes = root.querySelectorAll("[title]");
    for (var i = 0; i < nodes.length; i++) migrateElement(nodes[i]);
  }

  function ensureTooltipEl() {
    if (tooltipEl && document.body.contains(tooltipEl)) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.className = "gc-tooltip";
    tooltipEl.setAttribute("role", "tooltip");
    tooltipEl.id = "gc-tooltip-" + (++idCounter);
    tooltipEl.setAttribute("data-placement", "top");
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function positionTooltip(anchor, tip) {
    var targetRect = anchor.getBoundingClientRect();
    var tipRect = tip.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;

    /* Prefer top placement; flip to bottom if we'd clip above the viewport. */
    var placeTop = targetRect.top - tipRect.height - ARROW_SIZE - VIEWPORT_GAP;
    var placeBottom = targetRect.bottom + ARROW_SIZE + VIEWPORT_GAP;
    var placement = "top";
    var top;
    if (placeTop >= VIEWPORT_GAP) {
      top = placeTop;
    } else if (placeBottom + tipRect.height <= vh - VIEWPORT_GAP) {
      top = placeBottom - tipRect.height;
      placement = "bottom";
    } else {
      top = Math.max(VIEWPORT_GAP, placeTop);
    }

    var idealLeft = targetRect.left + targetRect.width / 2 - tipRect.width / 2;
    var left = Math.max(
      VIEWPORT_GAP,
      Math.min(idealLeft, vw - tipRect.width - VIEWPORT_GAP)
    );

    /* Keep the arrow centred on the target even after horizontal clamping. */
    var arrowCentre = targetRect.left + targetRect.width / 2 - left;
    arrowCentre = Math.max(
      ARROW_SIZE + 4,
      Math.min(arrowCentre, tipRect.width - ARROW_SIZE - 4)
    );

    tip.style.top = Math.round(top) + "px";
    tip.style.left = Math.round(left) + "px";
    tip.style.setProperty("--gc-tooltip-arrow-x", Math.round(arrowCentre) + "px");
    tip.setAttribute("data-placement", placement);
  }

  function showFor(target, anchor) {
    if (!isElement(target)) return;
    var text = target.getAttribute("data-gc-tooltip");
    if (!text) return;

    /* Anchor on the smallest sensible rect so the tooltip points at what the
       user is actually hovering — not at a wide/tall wrapper that happens to
       carry the `title`. Falls back to the target itself for keyboard focus,
       when the leaf is detached from the target, or when the leaf has a
       degenerate (0x0) box (e.g. `display: contents` spans). */
    var anchorEl = target;
    if (isElement(anchor) && target.contains(anchor)) {
      var ar = anchor.getBoundingClientRect();
      if (ar.width > 0 && ar.height > 0) anchorEl = anchor;
    }

    var tip = ensureTooltipEl();
    tip.textContent = text;
    /* Measure off-screen before positioning to avoid a flash at (0,0). */
    tip.style.top = "-9999px";
    tip.style.left = "-9999px";
    tip.setAttribute("data-visible", "true");
    target.setAttribute("aria-describedby", tip.id);
    currentTarget = target;
    currentAnchor = anchorEl;
    positionTooltip(anchorEl, tip);
  }

  function hide() {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (currentTarget) {
      /* Only clear aria-describedby if we set it (matches our tooltip id). */
      if (tooltipEl && currentTarget.getAttribute("aria-describedby") === tooltipEl.id) {
        currentTarget.removeAttribute("aria-describedby");
      }
      currentTarget = null;
    }
    currentAnchor = null;
    if (tooltipEl) {
      tooltipEl.removeAttribute("data-visible");
    }
  }

  function scheduleShow(target, anchor) {
    hide();
    if (!target || !target.getAttribute("data-gc-tooltip")) return;
    showTimer = setTimeout(function () {
      showTimer = null;
      showFor(target, anchor);
    }, SHOW_DELAY_MS);
  }

  function findTooltipTarget(start) {
    var node = start;
    while (isElement(node)) {
      if (node.hasAttribute && node.hasAttribute("data-gc-tooltip")) return node;
      node = node.parentNode;
    }
    return null;
  }

  function onPointerEnter(ev) {
    var target = findTooltipTarget(ev.target);
    if (!target) return;
    /* Pass the leaf as anchor so the tooltip points at the actual hovered
       child (icon, text), not at a wide wrapper carrying the `title`. */
    scheduleShow(target, ev.target);
  }

  function onPointerMove(ev) {
    /* Track the leaf inside the current target so the anchor stays accurate
       as the cursor moves between children of a wide wrapper. We only
       reposition for an already-shown tooltip; we don't reset the show timer. */
    if (!currentTarget || !tooltipEl) return;
    if (!currentTarget.contains(ev.target)) return;
    if (ev.target === currentAnchor) return;
    var ar = ev.target.getBoundingClientRect();
    if (ar.width <= 0 || ar.height <= 0) return;
    currentAnchor = ev.target;
    positionTooltip(currentAnchor, tooltipEl);
  }

  function onPointerLeave(ev) {
    /* pointerleave bubbles via capture; only hide when leaving the current
       target (or one of its descendants) into a non-descendant. */
    if (!currentTarget && !showTimer) return;
    var related = ev.relatedTarget;
    var originTarget = findTooltipTarget(ev.target);
    if (!originTarget) return;
    if (related && isElement(related) && originTarget.contains(related)) return;
    hide();
  }

  function onFocusIn(ev) {
    var target = findTooltipTarget(ev.target);
    if (!target) return;
    /* Keyboard focus: show without the hover delay for responsiveness. */
    hide();
    showFor(target);
  }

  function onFocusOut(ev) {
    var target = findTooltipTarget(ev.target);
    if (!target) return;
    hide();
  }

  function onKeyDown(ev) {
    if (ev.key === "Escape" || ev.keyCode === 27) hide();
  }

  function onScrollOrResize() {
    hide();
  }

  function observeMutations() {
    if (typeof MutationObserver !== "function") return;
    var mo = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var rec = records[i];
        if (rec.type === "attributes" && rec.attributeName === "title") {
          migrateElement(rec.target);
          continue;
        }
        if (rec.type === "childList" && rec.addedNodes) {
          for (var j = 0; j < rec.addedNodes.length; j++) {
            migrateSubtree(rec.addedNodes[j]);
          }
        }
      }
    });
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["title"],
    });
  }

  function installListeners() {
    /* Capture phase so we see events before other handlers stop propagation. */
    document.addEventListener("pointerenter", onPointerEnter, true);
    document.addEventListener("pointerleave", onPointerLeave, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("keydown", onKeyDown, true);
    /* Scroll doesn't bubble; listen in capture so we catch any ancestor. */
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize, true);
  }

  function boot() {
    migrateSubtree(document.body);
    observeMutations();
    installListeners();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.gcTooltip = {
    refresh: function (root) {
      migrateSubtree(root || document.body);
    },
    hide: hide,
  };
})();
