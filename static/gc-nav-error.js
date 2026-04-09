(function () {
  "use strict";

  let PREFLIGHT = "1";
  let HDR = "X-GC-Navigation-Preflight";
  let FETCH_HEADERS = {
    Accept: "application/json, text/html;q=0.5",
    "X-Requested-With": "Ground-Control",
  };
  FETCH_HEADERS[HDR] = PREFLIGHT;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      let map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[c] || c;
    });
  }

  function formatDetail(detail) {
    if (detail == null) return "";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map(function (item) {
          if (item && typeof item === "object" && item.msg != null) {
            let loc = item.loc;
            let prefix =
              Array.isArray(loc) && loc.length
                ? String(loc.join(".")) + ": "
                : "";
            return prefix + String(item.msg);
          }
          try {
            return JSON.stringify(item);
          } catch (e) {
            return String(item);
          }
        })
        .join("\n");
    }
    if (typeof detail === "object") {
      try {
        return JSON.stringify(detail, null, 2);
      } catch (e2) {
        return String(detail);
      }
    }
    return String(detail);
  }

  function parseStatusTitle(status) {
    if (status === 404) return "Not found";
    if (status === 403) return "Forbidden";
    if (status === 401) return "Not signed in";
    if (status >= 500) return "Server error";
    if (status >= 400) return "Request failed";
    return "Error";
  }

  async function bodyMessage(response) {
    let ct = (response.headers.get("content-type") || "").toLowerCase();
    if (ct.indexOf("application/json") !== -1) {
      try {
        let j = await response.json();
        if (j && j.detail !== undefined) return formatDetail(j.detail);
        return JSON.stringify(j, null, 2);
      } catch (e) {
        /* fall through */
      }
    }
    let text = await response.text();
    let t = text.replace(/\s+/g, " ").trim();
    if (t.length > 12000) t = t.slice(0, 12000) + "\n…";
    return t || response.statusText || "Unknown error";
  }

  let modal = null;
  let titleEl = null;
  let statusEl = null;
  let bodyEl = null;
  let closeBtn = null;
  let dismissBtn = null;
  let backdrop = null;

  function ensureDom() {
    if (modal) return;
    modal = document.getElementById("gc-nav-error-modal");
    if (!modal) return;
    titleEl = document.getElementById("gc-nav-error-modal-title");
    statusEl = document.getElementById("gc-nav-error-modal-status");
    bodyEl = document.getElementById("gc-nav-error-modal-body");
    closeBtn = document.getElementById("gc-nav-error-modal-close");
    dismissBtn = document.getElementById("gc-nav-error-modal-dismiss");
    backdrop = modal.querySelector(".gc-nav-error-modal__backdrop");
    function close() {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
    }
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (dismissBtn) dismissBtn.addEventListener("click", close);
    if (backdrop) backdrop.addEventListener("click", close);
    modal.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") close();
    });
  }

  function showNavErrorModal(status, title, message) {
    ensureDom();
    if (!modal || !bodyEl) {
      globalThis.alert([title, message].filter(Boolean).join("\n\n"));
      return;
    }
    if (titleEl) titleEl.textContent = title || "Something went wrong";
    if (statusEl) {
      statusEl.textContent = status ? "HTTP " + status : "";
      statusEl.hidden = !status;
    }
    bodyEl.innerHTML =
      "<pre class=\"gc-nav-error-modal__pre\" tabindex=\"0\">" +
      escapeHtml(message || "") +
      "</pre>";
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    try {
      bodyEl.querySelector(".gc-nav-error-modal__pre").focus();
    } catch (e) {}
  }

  globalThis.gcShowNavErrorModal = function (opts) {
    let o = opts || {};
    showNavErrorModal(o.status || 0, o.title || "Error", o.message || "");
  };

  function sameOriginUrl(hrefAttr, base) {
    try {
      return new URL(hrefAttr, base || globalThis.location.href);
    } catch (e) {
      return null;
    }
  }

  function shouldSkipAnchor(a, ev) {
    if (!a || a.tagName !== "A") return true;
    if (ev.defaultPrevented) return true;
    if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return true;
    let t = (a.getAttribute("target") || "").toLowerCase();
    if (t && t !== "_self") return true;
    if (a.hasAttribute("download")) return true;
    if (a.closest("[data-gc-skip-nav-check]")) return true;
    if (a.getAttribute("aria-disabled") === "true") return true;
    let href = a.getAttribute("href");
    if (!href || href === "#" || href.charAt(0) === "#") return true;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return true;
    let u = sameOriginUrl(href);
    if (!u || u.origin !== globalThis.location.origin) return true;
    return false;
  }

  function hasFileInput(form) {
    let files = form.querySelectorAll('input[type="file"]');
    for (let i = 0; i < files.length; i++) {
      if (files[i].files && files[i].files.length) return true;
    }
    return false;
  }

  function shouldSkipForm(form, ev) {
    if (!form || form.tagName !== "FORM") return true;
    if (ev.defaultPrevented) return true;
    if (form.closest("[data-gc-skip-nav-check]")) return true;
    let method = (form.getAttribute("method") || "get").toLowerCase();
    if (method !== "get" && method !== "post") return true;
    let act = form.getAttribute("action");
    let actionUrl = sameOriginUrl(
      act != null && act !== "" ? act : globalThis.location.pathname + globalThis.location.search
    );
    if (!actionUrl || actionUrl.origin !== globalThis.location.origin) return true;
    if (method === "post" && hasFileInput(form)) return true;
    return false;
  }

  async function preflightNavigate(url, init) {
    let reqUrl = typeof url === "string" ? url : url.toString();
    try {
      let response = await fetch(reqUrl, {
        credentials: "same-origin",
        redirect: "follow",
        headers: FETCH_HEADERS,
        cache: "no-store",
        ...(init || {}),
      });
      if (response.ok) {
        globalThis.location.assign(response.url);
        return;
      }
      let msg = await bodyMessage(response);
      showNavErrorModal(
        response.status,
        parseStatusTitle(response.status),
        msg
      );
    } catch (err) {
      showNavErrorModal(
        0,
        "Network error",
        err && err.message ? String(err.message) : "Could not reach the server."
      );
    }
  }

  document.addEventListener(
    "click",
    function (ev) {
      let a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
      if (!a || shouldSkipAnchor(a, ev)) return;
      let u = sameOriginUrl(a.getAttribute("href"));
      if (!u || u.origin !== globalThis.location.origin) return;
      ev.preventDefault();
      preflightNavigate(u.toString(), { method: "GET" });
    },
    false
  );

  document.addEventListener(
    "submit",
    function (ev) {
      let form = ev.target;
      if (!form || form.tagName !== "FORM" || shouldSkipForm(form, ev)) return;
      let method = (form.getAttribute("method") || "get").toLowerCase();
      ev.preventDefault();
      let actionUrl = sameOriginUrl(
        form.getAttribute("action") != null && form.getAttribute("action") !== ""
          ? form.getAttribute("action")
          : globalThis.location.pathname + globalThis.location.search
      );
      if (!actionUrl) return;
      if (method === "get") {
        try {
          let params = new URLSearchParams(new FormData(form));
          actionUrl.search = params.toString();
        } catch (e) {
          showNavErrorModal(0, "Navigation error", "Could not read form data.");
          return;
        }
        preflightNavigate(actionUrl.toString(), { method: "GET" });
        return;
      }
      preflightNavigate(actionUrl.toString(), {
        method: "POST",
        body: new FormData(form),
      });
    },
    false
  );
})();
