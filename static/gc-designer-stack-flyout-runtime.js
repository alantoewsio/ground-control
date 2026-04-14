/**
 * Shared designer stacked flyout modal open/close and object-edit flyout wiring.
 * Loaded by Designer · Modals and pages that reuse the object-edit flyout (e.g. Data Controls).
 */
(function () {
  "use strict";

  function syncScrollLock() {
    var anyOpen = document.querySelector(".gc-designer-modal:not([hidden])");
    document.body.classList.toggle("gc-designer-modal-open", !!anyOpen);
    document.querySelectorAll(".gc-designer-modal-overlay-slot").forEach(function (slot) {
      var openIn = slot.querySelector(".gc-designer-modal:not([hidden])");
      slot.classList.toggle("gc-designer-modal-overlay-slot--open", !!openIn);
    });
  }

  function resetDesignerFlyoutScrollChurn() {
    try {
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
      var ab = document.querySelector(".app-body");
      if (ab) ab.scrollLeft = 0;
      var main = document.querySelector(".app-main");
      if (main) main.scrollLeft = 0;
    } catch (e) {}
  }

  var designerStackFlyoutHide = { timer: null, onEnd: null, primary: null, secondary: null };

  var DESIGNER_STACK_FLYOUT_MIN_W = 280;

  function designerStackFlyoutIds(root) {
    if (!root) return null;
    if (root.id === "gc-designer-flyout-view-modal") {
      return {
        primaryId: "gc-designer-flyout-view-primary",
        secondaryId: "gc-designer-flyout-view-secondary",
        skeletonId: "gc-designer-flyout-view-primary-skeleton",
        secondaryFocusId: "gc-designer-flyout-view-secondary-close",
        peekDismiss: true,
      };
    }
    if (root.id === "gc-designer-flyout-edit-modal") {
      return {
        primaryId: "gc-designer-flyout-edit-primary",
        secondaryId: "gc-designer-flyout-edit-secondary",
        skeletonId: "gc-designer-flyout-edit-primary-skeleton",
        secondaryFocusId: "gc-designer-flyout-edit-secondary-save",
        peekDismiss: false,
      };
    }
    if (root.id === "gc-designer-flyout-object-edit-modal") {
      return {
        primaryId: "gc-designer-flyout-object-edit-primary",
        secondaryId: "gc-designer-flyout-object-edit-secondary",
        skeletonId: "",
        secondaryFocusId: "gc-designer-flyout-object-edit-secondary-save",
        peekDismiss: false,
      };
    }
    return null;
  }

  function designerStackFlyoutPrimary(root) {
    var c = designerStackFlyoutIds(root);
    return c ? document.getElementById(c.primaryId) : null;
  }

  function isDesignerStackFlyoutRoot(root) {
    return designerStackFlyoutIds(root) !== null;
  }

  function resetPrimaryFlyoutWidth(root) {
    var p = designerStackFlyoutPrimary(root);
    if (!p) return;
    p.style.removeProperty("width");
    p.style.removeProperty("max-width");
  }

  function rememberPrimaryFlyoutWidthBeforeStack(root) {
    var p = designerStackFlyoutPrimary(root);
    if (!p) return;
    var w = Math.round(p.getBoundingClientRect().width);
    if (w > 0) root.dataset.gcDesignerPrimarySavedWidthPx = String(w);
  }

  function restorePrimaryFlyoutWidthIfSaved(root) {
    var p = designerStackFlyoutPrimary(root);
    var s = root.dataset.gcDesignerPrimarySavedWidthPx;
    if (!p || s === undefined || s === "") return;
    p.style.width = s + "px";
    delete root.dataset.gcDesignerPrimarySavedWidthPx;
  }

  function clearPrimaryFlyoutSavedWidth(root) {
    delete root.dataset.gcDesignerPrimarySavedWidthPx;
  }

  function measureDesignerFlyoutPeekPx(root) {
    var raw = getComputedStyle(root).getPropertyValue("--gc-designer-flyout-peek").trim();
    if (!raw) return 48;
    if (raw.endsWith("px")) {
      var n = parseFloat(raw);
      return isNaN(n) ? 48 : n;
    }
    var probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;left:-9999px;width:" +
      raw +
      ";height:0;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    var w = probe.getBoundingClientRect().width;
    document.body.removeChild(probe);
    return w > 0 ? w : 48;
  }

  function bindDesignerStackFlyoutResize(root) {
    if (!root || root.dataset.gcDesignerStackFlyoutResizeBound === "1") return;
    var cfg = designerStackFlyoutIds(root);
    if (!cfg) return;
    root.dataset.gcDesignerStackFlyoutResizeBound = "1";
    var primary = document.getElementById(cfg.primaryId);
    var secondary = document.getElementById(cfg.secondaryId);
    var hPri = primary && primary.querySelector(".gc-designer-view-flyout__resize--primary");
    var hSec = secondary && secondary.querySelector(".gc-designer-view-flyout__resize--secondary");

    function overlayWidth() {
      return root.getBoundingClientRect().width;
    }

    function bindEdge(panel, handle, getMaxW, isPrimary) {
      if (!panel || !handle) return;
      handle.addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (isPrimary && root.classList.contains("is-view-flyout-stacked")) return;
        var startX = e.clientX;
        var startW = panel.getBoundingClientRect().width;
        function onMove(e2) {
          var cap = getMaxW();
          var w = startW + (startX - e2.clientX);
          w = Math.max(DESIGNER_STACK_FLYOUT_MIN_W, Math.min(cap, w));
          panel.style.width = w + "px";
        }
        function onUp() {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    }

    bindEdge(primary, hPri, overlayWidth, true);
    bindEdge(
      secondary,
      hSec,
      function () {
        return Math.max(DESIGNER_STACK_FLYOUT_MIN_W, overlayWidth() - measureDesignerFlyoutPeekPx(root));
      },
      false
    );
  }

  function getPrimaryContentHit(root) {
    var c = designerStackFlyoutIds(root);
    if (!c || !c.skeletonId) return null;
    return document.getElementById(c.skeletonId);
  }

  function syncPrimaryContentHitState(root, interactive) {
    var el = getPrimaryContentHit(root);
    if (!el) return;
    var allowFocus = interactive && !el.hidden;
    el.tabIndex = allowFocus ? 0 : -1;
    if (allowFocus) el.removeAttribute("aria-disabled");
    else el.setAttribute("aria-disabled", "true");
  }

  function focusPrimaryContentHitOrClose(root) {
    var hit = getPrimaryContentHit(root);
    requestAnimationFrame(function () {
      if (hit && hit.tabIndex === 0 && !hit.hidden) {
        hit.focus();
      } else if (root.id === "gc-designer-flyout-view-modal") {
        var c = root.querySelector("#gc-designer-flyout-view-primary .gc-designer-modal__close");
        if (c) c.focus();
      } else if (
        root.id === "gc-designer-flyout-edit-modal" ||
        root.id === "gc-designer-flyout-object-edit-modal"
      ) {
        var fp = root.querySelector(".gc-designer-view-flyout__panel--primary .gc-designer-modal__footer .btn.primary");
        if (fp) fp.focus();
      }
    });
  }

  document.addEventListener("gc-designer-object-edit-catalog-rendered", function (ev) {
    var root = document.getElementById("gc-designer-flyout-object-edit-modal");
    if (!root || root.hidden) return;
    syncPrimaryContentHitState(root, !root.classList.contains("is-view-flyout-stacked"));
  });

  function cancelDesignerStackFlyoutHide() {
    if (designerStackFlyoutHide.timer) {
      clearTimeout(designerStackFlyoutHide.timer);
      designerStackFlyoutHide.timer = null;
    }
    if (designerStackFlyoutHide.onEnd) {
      if (designerStackFlyoutHide.primary) {
        designerStackFlyoutHide.primary.removeEventListener("transitionend", designerStackFlyoutHide.onEnd);
      }
      if (designerStackFlyoutHide.secondary) {
        designerStackFlyoutHide.secondary.removeEventListener("transitionend", designerStackFlyoutHide.onEnd);
      }
    }
    designerStackFlyoutHide.onEnd = null;
    designerStackFlyoutHide.primary = null;
    designerStackFlyoutHide.secondary = null;
  }

  function applyDesignerStackFlyoutState(root, stacked, opts) {
    opts = opts || {};
    var cfg = designerStackFlyoutIds(root);
    if (!root || !cfg) return;
    var secondary = document.getElementById(cfg.secondaryId);
    var secondaryFocus = document.getElementById(cfg.secondaryFocusId);

    if (stacked) {
      cancelDesignerStackFlyoutHide();
      root.classList.remove("is-view-flyout-collapsing", "is-view-flyout-secondary-visible");
      rememberPrimaryFlyoutWidthBeforeStack(root);
      resetPrimaryFlyoutWidth(root);
      root.classList.add("is-view-flyout-stacked");
      if (secondary) secondary.removeAttribute("hidden");
      if (secondary) secondary.setAttribute("aria-hidden", "false");
      syncPrimaryContentHitState(root, false);
      void (secondary && secondary.offsetWidth);
      requestAnimationFrame(function () {
        if (root.hidden) return;
        root.classList.add("is-view-flyout-secondary-visible");
        if (!opts.skipFocus) {
          requestAnimationFrame(function () {
            if (secondaryFocus) secondaryFocus.focus();
          });
        }
      });
      return;
    }

    cancelDesignerStackFlyoutHide();

    if (!opts.immediate && root.classList.contains("is-view-flyout-collapsing")) {
      return;
    }

    if (opts.immediate) {
      root.classList.remove(
        "is-view-flyout-stacked",
        "is-view-flyout-collapsing",
        "is-view-flyout-secondary-visible"
      );
      clearPrimaryFlyoutSavedWidth(root);
      resetPrimaryFlyoutWidth(root);
      if (secondary) {
        secondary.setAttribute("hidden", "");
        secondary.setAttribute("aria-hidden", "true");
      }
      syncPrimaryContentHitState(root, true);
      resetDesignerFlyoutScrollChurn();
      if (!opts.skipFocus) focusPrimaryContentHitOrClose(root);
      return;
    }

    if (!root.classList.contains("is-view-flyout-stacked")) {
      root.classList.remove("is-view-flyout-collapsing");
      syncPrimaryContentHitState(root, true);
      if (!opts.skipFocus) focusPrimaryContentHitOrClose(root);
      return;
    }

    if (!secondary) {
      root.classList.remove(
        "is-view-flyout-stacked",
        "is-view-flyout-collapsing",
        "is-view-flyout-secondary-visible"
      );
      restorePrimaryFlyoutWidthIfSaved(root);
      syncPrimaryContentHitState(root, true);
      if (!opts.skipFocus) focusPrimaryContentHitOrClose(root);
      return;
    }

    syncPrimaryContentHitState(root, false);

    var primary = designerStackFlyoutPrimary(root);
    if (!primary) {
      root.classList.remove(
        "is-view-flyout-stacked",
        "is-view-flyout-collapsing",
        "is-view-flyout-secondary-visible"
      );
      secondary.setAttribute("hidden", "");
      syncPrimaryContentHitState(root, true);
      restorePrimaryFlyoutWidthIfSaved(root);
      return;
    }

    var finished = false;
    function finishHide() {
      if (finished) return;
      if (!root.classList.contains("is-view-flyout-collapsing")) return;
      finished = true;
      cancelDesignerStackFlyoutHide();
      secondary.setAttribute("hidden", "");
      secondary.setAttribute("aria-hidden", "true");
      root.classList.remove(
        "is-view-flyout-stacked",
        "is-view-flyout-collapsing",
        "is-view-flyout-secondary-visible"
      );
      restorePrimaryFlyoutWidthIfSaved(root);
      syncPrimaryContentHitState(root, true);
      resetDesignerFlyoutScrollChurn();
      requestAnimationFrame(function () {
        resetDesignerFlyoutScrollChurn();
      });
      if (!opts.skipFocus) focusPrimaryContentHitOrClose(root);
    }

    function onTransitionEnd(e) {
      if (e.target !== primary) return;
      if (e.propertyName !== "transform") return;
      finishHide();
    }

    root.classList.add("is-view-flyout-collapsing");
    designerStackFlyoutHide.primary = primary;
    designerStackFlyoutHide.secondary = null;
    designerStackFlyoutHide.onEnd = onTransitionEnd;
    primary.addEventListener("transitionend", onTransitionEnd);
    designerStackFlyoutHide.timer = setTimeout(finishHide, 500);
  }

  function openModal(root) {
    if (!root) return;
    document.querySelectorAll(".gc-designer-modal:not([hidden])").forEach(function (other) {
      if (other !== root) other.hidden = true;
    });
    root.hidden = false;
    syncScrollLock();
    resetDesignerFlyoutScrollChurn();
    if (isDesignerStackFlyoutRoot(root)) {
      applyDesignerStackFlyoutState(root, false, { skipFocus: true, immediate: true });
    }
    if (root.id === "gc-designer-dialog-modal") {
      return;
    }
    var closeBtn =
      root.id === "gc-designer-flyout-view-modal"
        ? root.querySelector("#gc-designer-flyout-view-primary .gc-designer-modal__close")
        : root.id === "gc-designer-flyout-edit-modal" ||
            root.id === "gc-designer-flyout-object-edit-modal"
          ? root.querySelector(
              ".gc-designer-view-flyout__panel--primary .gc-designer-modal__footer .btn.primary"
            )
          : root.querySelector(".gc-designer-modal__close");
    if (closeBtn) {
      closeBtn.focus();
    } else {
      var footerPrimary = root.querySelector(".gc-designer-modal__footer .btn.primary");
      if (footerPrimary) footerPrimary.focus();
    }
  }

  function closeModal(root) {
    if (!root || root.hidden) return;
    if (isDesignerStackFlyoutRoot(root)) {
      applyDesignerStackFlyoutState(root, false, { skipFocus: true, immediate: true });
    }
    root.hidden = true;
    syncScrollLock();
    resetDesignerFlyoutScrollChurn();
  }

  (function wireObjectEditFlyoutCore() {
    var root = document.getElementById("gc-designer-flyout-object-edit-modal");
    var primary = document.getElementById("gc-designer-flyout-object-edit-primary");
    var contentHit = null;
    var saveBtn = document.getElementById("gc-designer-flyout-object-edit-save");
    var cancelBtn = document.getElementById("gc-designer-flyout-object-edit-cancel");
    var secSave = document.getElementById("gc-designer-flyout-object-edit-secondary-save");
    var secCancel = document.getElementById("gc-designer-flyout-object-edit-secondary-cancel");
    if (!root || !primary) return;
    if (root.dataset.gcObjectEditFlyoutCoreWired === "1") return;
    root.dataset.gcObjectEditFlyoutCoreWired = "1";

    bindDesignerStackFlyoutResize(root);

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        var payload =
          typeof globalThis.gcDesignerObjectEditFlyoutCollectSave === "function"
            ? globalThis.gcDesignerObjectEditFlyoutCollectSave()
            : null;
        try {
          document.dispatchEvent(
            new CustomEvent("gc-object-edit-flyout-save", { detail: payload }),
          );
        } catch (eSave) {}
        closeModal(root);
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        closeModal(root);
      });
    }

    function tryOpenSecondaryFromContent(e) {
      if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
      if (e.type === "keydown" && e.key === " ") e.preventDefault();
      if (root.classList.contains("is-view-flyout-stacked")) return;
      if (root.classList.contains("is-view-flyout-collapsing")) return;
      applyDesignerStackFlyoutState(root, true);
    }

    if (contentHit) {
      contentHit.addEventListener("click", function (e) {
        e.stopPropagation();
        tryOpenSecondaryFromContent(e);
      });
      contentHit.addEventListener("keydown", tryOpenSecondaryFromContent);
    }

    function collapseSecondary(e) {
      if (e) e.stopPropagation();
      applyDesignerStackFlyoutState(root, false);
    }
    if (secSave) secSave.addEventListener("click", collapseSecondary);
    if (secCancel) secCancel.addEventListener("click", collapseSecondary);
  })();

  function collectFirewallIdsFromPreviewRow(row) {
    var out = [];
    var seen = {};
    function addId(v) {
      var n = parseInt(String(v), 10);
      if (isNaN(n) || n <= 0) return;
      var k = String(n);
      if (seen[k]) return;
      seen[k] = true;
      out.push(n);
    }
    function addFromTargets(key) {
      var tgts = row[key];
      if (!Array.isArray(tgts)) return;
      tgts.forEach(function (t) {
        if (t && t.firewall_id != null) addId(t.firewall_id);
      });
    }
    if (!row || typeof row !== "object") return out;
    addId(row.firewall_id);
    addFromTargets("hs_edit_targets");
    addFromTargets("ip_host_edit_targets");
    return out;
  }

  globalThis.gcDesignerOpenObjectEditFlyoutFromDataControls = function (opts) {
    opts = opts || {};
    var root = document.getElementById("gc-designer-flyout-object-edit-modal");
    if (!root) return;
    var mount = document.getElementById("gc-designer-object-edit-fw-mount");
    var et = String(opts.entityType || "").trim();
    var titleEl = document.getElementById("gc-designer-flyout-object-edit-title");
    if (titleEl) {
      var rl = String(opts.rowLabel || "").trim();
      titleEl.textContent = rl ? "Edit " + rl : "Edit";
    }
    var row = opts.row && typeof opts.row === "object" ? opts.row : {};
    if (mount) {
      var ms = mount.querySelector("[data-gc-fw-ms]");
      if (ms) {
        var ids = collectFirewallIdsFromPreviewRow(row);
        if (ids.length) {
          ms.dataset.fwInitialSelected = JSON.stringify(ids);
          ms.dataset.fwAssignedIds = JSON.stringify(ids);
        } else {
          ms.dataset.fwInitialSelected = "[]";
          ms.dataset.fwAssignedIds = "[]";
        }
      }
    }
    if (typeof globalThis.gcHsHydrateFlyoutFirewallPicker === "function" && mount) {
      globalThis.gcHsHydrateFlyoutFirewallPicker(mount, { row: row });
    }
    if (typeof globalThis.gcDesignerHydrateObjectEditCatalogFields === "function") {
      globalThis.gcDesignerHydrateObjectEditCatalogFields(et, {
        cells: row.cells && typeof row.cells === "object" ? row.cells : null,
        flat: row.flat && typeof row.flat === "object" ? row.flat : null,
        row: row,
      });
    }
    openModal(root);
  };

  globalThis.gcDesignerFlyoutSyncScrollLock = syncScrollLock;
  globalThis.gcDesignerFlyoutOpenModal = openModal;
  globalThis.gcDesignerFlyoutCloseModal = closeModal;
  globalThis.gcDesignerFlyoutBindDesignerStackFlyoutResize = bindDesignerStackFlyoutResize;
  globalThis.gcDesignerFlyoutApplyDesignerStackFlyoutState = applyDesignerStackFlyoutState;
})();
