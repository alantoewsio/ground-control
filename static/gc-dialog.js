/* ---------------------------------------------------------------------------
   Ground Control — Unified custom dialog/toast helper

   Replaces native window.alert / window.confirm with styled, theme-aware
   modal dialogs that match the design language defined in
   ground-control/design/design-skill.md.

   Public API (Promise-based):
     window.gcAlert(message, opts)              → Promise<void>
     window.gcConfirm(message, opts)            → Promise<boolean>
     window.gcPrompt(message, defaultValue, opts) → Promise<string|null>
     window.gcToast(message, type, opts)        → Promise<void>

   `opts` is an optional object:
     {
       title?:        string,            // header text (defaults by tone)
       confirmLabel?: string,            // primary button label
       cancelLabel?:  string,            // secondary button label (confirm/prompt only)
       tone?:         "info" | "success" | "warning" | "danger",
       icon?:         string,            // material symbol name override
       placeholder?:  string,            // prompt input placeholder
     }

   `type` for gcToast: "success" | "error" | "warning" | "info" (default "info")
   --------------------------------------------------------------------------- */
(function () {
  "use strict";

  function escAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escText(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function makeIcon(name, sizeCls) {
    if (window.gcIcon) {
      return window.gcIcon(name, { size: sizeCls || "md" });
    }
    return '<span aria-hidden="true">' + escText(name) + "</span>";
  }

  /* ----------------------------------------------------------------------- */
  /* Modal dialog (alert / confirm)                                          */
  /* ----------------------------------------------------------------------- */

  let modalEl = null;
  let modalBackdropEl = null;
  let modalPanelEl = null;
  let modalIconEl = null;
  let modalTitleEl = null;
  let modalMessageEl = null;
  let modalInputEl = null;
  let modalConfirmBtn = null;
  let modalCancelBtn = null;
  let modalCloseBtn = null;
  let activeResolve = null;
  let activeMode = null;
  let prevFocusEl = null;
  let escHandler = null;

  function ensureModalDom() {
    if (modalEl) return;
    modalEl = document.createElement("div");
    modalEl.className = "gc-dialog";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.setAttribute("aria-labelledby", "gc-dialog-title");
    modalEl.setAttribute("aria-describedby", "gc-dialog-message");
    modalEl.hidden = true;
    modalEl.innerHTML =
      '<div class="gc-dialog__backdrop" data-gc-dialog-backdrop tabindex="-1"></div>' +
      '<div class="gc-dialog__panel" role="document">' +
      '  <button type="button" class="gc-dialog__close" data-gc-dialog-close aria-label="Close">' +
      makeIcon("close", "md") +
      '  </button>' +
      '  <div class="gc-dialog__head">' +
      '    <span class="gc-dialog__icon" data-gc-dialog-icon aria-hidden="true"></span>' +
      '    <h2 class="gc-dialog__title" id="gc-dialog-title" data-gc-dialog-title></h2>' +
      '  </div>' +
      '  <div class="gc-dialog__body">' +
      '    <p class="gc-dialog__message" id="gc-dialog-message" data-gc-dialog-message></p>' +
      '    <input type="text" class="gc-dialog__input" data-gc-dialog-input hidden />' +
      '  </div>' +
      '  <div class="gc-dialog__footer">' +
      '    <button type="button" class="gc-dialog__btn gc-dialog__btn--secondary" data-gc-dialog-cancel></button>' +
      '    <button type="button" class="gc-dialog__btn gc-dialog__btn--primary" data-gc-dialog-confirm></button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(modalEl);

    modalBackdropEl = modalEl.querySelector("[data-gc-dialog-backdrop]");
    modalPanelEl = modalEl.querySelector(".gc-dialog__panel");
    modalIconEl = modalEl.querySelector("[data-gc-dialog-icon]");
    modalTitleEl = modalEl.querySelector("[data-gc-dialog-title]");
    modalMessageEl = modalEl.querySelector("[data-gc-dialog-message]");
    modalInputEl = modalEl.querySelector("[data-gc-dialog-input]");
    modalConfirmBtn = modalEl.querySelector("[data-gc-dialog-confirm]");
    modalCancelBtn = modalEl.querySelector("[data-gc-dialog-cancel]");
    modalCloseBtn = modalEl.querySelector("[data-gc-dialog-close]");

    modalConfirmBtn.addEventListener("click", function () {
      submitConfirm();
    });
    modalCancelBtn.addEventListener("click", function () {
      submitCancel();
    });
    modalCloseBtn.addEventListener("click", function () {
      submitCancel();
    });
    modalBackdropEl.addEventListener("click", function () {
      submitCancel();
    });
  }

  function submitConfirm() {
    if (activeMode === "prompt") {
      finish(modalInputEl ? String(modalInputEl.value) : "");
    } else if (activeMode === "confirm") {
      finish(true);
    } else {
      finish(true);
    }
  }

  function submitCancel() {
    if (activeMode === "prompt") {
      finish(null);
    } else {
      finish(false);
    }
  }

  function finish(result) {
    if (!modalEl) return;
    modalEl.hidden = true;
    modalEl.removeAttribute("data-gc-dialog-tone");
    modalEl.removeAttribute("data-gc-dialog-mode");
    if (escHandler) {
      document.removeEventListener("keydown", escHandler, true);
      escHandler = null;
    }
    let resolve = activeResolve;
    activeResolve = null;
    activeMode = null;
    try {
      if (prevFocusEl && typeof prevFocusEl.focus === "function") prevFocusEl.focus();
    } catch (e) {}
    prevFocusEl = null;
    if (resolve) resolve(result);
  }

  let DEFAULT_TITLES = {
    info: "Notice",
    success: "Success",
    warning: "Warning",
    danger: "Confirm",
  };
  let DEFAULT_ICONS = {
    info: "info",
    success: "check_circle",
    warning: "warning",
    danger: "error",
  };

  function openDialog(message, opts, mode, defaultValue) {
    ensureModalDom();
    if (activeResolve) {
      submitCancel();
    }
    let o = opts && typeof opts === "object" ? opts : {};
    let defaultTone =
      mode === "confirm" ? "warning" : mode === "prompt" ? "info" : "info";
    let tone = o.tone || defaultTone;
    if (!DEFAULT_TITLES[tone]) tone = "info";

    let iconName = o.icon || DEFAULT_ICONS[tone] || "info";
    let defaultTitle =
      mode === "confirm"
        ? "Please confirm"
        : mode === "prompt"
        ? "Enter a value"
        : DEFAULT_TITLES[tone];
    let title = o.title || defaultTitle;
    let confirmLabel =
      o.confirmLabel ||
      (mode === "confirm" ? "Confirm" : mode === "prompt" ? "OK" : "OK");
    let cancelLabel = o.cancelLabel || "Cancel";

    activeMode = mode;
    modalEl.setAttribute("data-gc-dialog-tone", tone);
    modalEl.setAttribute("data-gc-dialog-mode", mode);
    modalIconEl.innerHTML = makeIcon(iconName, "md");
    modalTitleEl.textContent = title;
    modalMessageEl.textContent = String(message == null ? "" : message);
    modalConfirmBtn.textContent = confirmLabel;
    modalCancelBtn.textContent = cancelLabel;
    modalCancelBtn.hidden = mode === "alert";

    if (modalInputEl) {
      if (mode === "prompt") {
        modalInputEl.hidden = false;
        modalInputEl.value = defaultValue == null ? "" : String(defaultValue);
        modalInputEl.placeholder = o.placeholder ? String(o.placeholder) : "";
      } else {
        modalInputEl.hidden = true;
        modalInputEl.value = "";
        modalInputEl.placeholder = "";
      }
    }

    prevFocusEl = document.activeElement;
    modalEl.hidden = false;

    escHandler = function (ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        submitCancel();
      } else if (ev.key === "Enter" && ev.target && ev.target.tagName !== "TEXTAREA") {
        if (document.activeElement !== modalCancelBtn) {
          ev.preventDefault();
          submitConfirm();
        }
      }
    };
    document.addEventListener("keydown", escHandler, true);

    setTimeout(function () {
      try {
        if (mode === "prompt" && modalInputEl) {
          modalInputEl.focus();
          modalInputEl.select();
        } else {
          modalConfirmBtn.focus();
        }
      } catch (e) {}
    }, 0);

    return new Promise(function (resolve) {
      activeResolve = resolve;
    });
  }

  function gcAlert(message, opts) {
    return openDialog(message, opts, "alert").then(function () {
      return undefined;
    });
  }

  function gcConfirm(message, opts) {
    return openDialog(message, opts, "confirm");
  }

  function gcPrompt(message, defaultValue, opts) {
    return openDialog(message, opts, "prompt", defaultValue);
  }

  /* ----------------------------------------------------------------------- */
  /* Toast notifications                                                     */
  /* ----------------------------------------------------------------------- */

  let toastStack = null;
  let TOAST_AUTO_DISMISS_MS = 4000;

  function ensureToastStack() {
    if (toastStack) return;
    toastStack = document.createElement("div");
    toastStack.className = "gc-toast-stack";
    toastStack.setAttribute("aria-live", "polite");
    toastStack.setAttribute("aria-atomic", "true");
    document.body.appendChild(toastStack);
  }

  let TOAST_ICONS = {
    success: "check_circle",
    error: "error",
    warning: "warning",
    info: "info",
  };

  function gcToast(message, type, opts) {
    ensureToastStack();
    let kind = type && TOAST_ICONS[type] ? type : "info";
    let o = opts && typeof opts === "object" ? opts : {};
    let dismissMs = Number(o.dismissMs);
    if (!Number.isFinite(dismissMs) || dismissMs < 0) dismissMs = TOAST_AUTO_DISMISS_MS;

    let item = document.createElement("div");
    item.className = "gc-toast gc-toast--" + kind;
    item.setAttribute("role", kind === "error" || kind === "warning" ? "alert" : "status");

    let iconHtml =
      '<span class="gc-toast__icon" aria-hidden="true">' +
      makeIcon(o.icon || TOAST_ICONS[kind], "sm") +
      "</span>";
    let textHtml =
      '<span class="gc-toast__text">' + escText(message == null ? "" : message) + "</span>";
    let closeHtml =
      '<button type="button" class="gc-toast__close" aria-label="Dismiss">' +
      makeIcon("close", "xs") +
      "</button>";
    item.innerHTML = iconHtml + textHtml + closeHtml;

    toastStack.appendChild(item);

    let resolved = false;
    return new Promise(function (resolve) {
      function dismiss() {
        if (resolved) return;
        resolved = true;
        item.classList.add("gc-toast--leaving");
        setTimeout(function () {
          if (item.parentNode) item.parentNode.removeChild(item);
          resolve();
        }, 220);
      }
      item.querySelector(".gc-toast__close").addEventListener("click", dismiss);
      if (dismissMs > 0) {
        setTimeout(dismiss, dismissMs);
      }
    });
  }

  /* ----------------------------------------------------------------------- */
  /* Public exports                                                          */
  /* ----------------------------------------------------------------------- */

  window.gcAlert = gcAlert;
  window.gcConfirm = gcConfirm;
  window.gcPrompt = gcPrompt;
  window.gcToast = gcToast;
})();
