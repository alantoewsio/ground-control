(function () {
  "use strict";

  var PREFLIGHT = "1";
  var HDR = "X-GC-Navigation-Preflight";
  var FETCH_HEADERS = {
    Accept: "application/json, text/html;q=0.5",
    "X-Requested-With": "Ground-Control",
  };
  FETCH_HEADERS[HDR] = PREFLIGHT;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
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
            var loc = item.loc;
            var prefix =
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
    var ct = (response.headers.get("content-type") || "").toLowerCase();
    if (ct.indexOf("application/json") !== -1) {
      try {
        var j = await response.json();
        if (j && j.detail !== undefined) return formatDetail(j.detail);
        return JSON.stringify(j, null, 2);
      } catch (e) {
        /* fall through */
      }
    }
    var text = await response.text();
    var t = text.replace(/\s+/g, " ").trim();
    if (t.length > 12000) t = t.slice(0, 12000) + "\n…";
    return t || response.statusText || "Unknown error";
  }

  var modal = null;
  var titleEl = null;
  var statusEl = null;
  var bodyEl = null;
  var closeBtn = null;
  var dismissBtn = null;
  var backdrop = null;

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
      window.alert([title, message].filter(Boolean).join("\n\n"));
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

  window.gcShowNavErrorModal = function (opts) {
    var o = opts || {};
    showNavErrorModal(o.status || 0, o.title || "Error", o.message || "");
  };

  function sameOriginUrl(hrefAttr, base) {
    try {
      return new URL(hrefAttr, base || window.location.href);
    } catch (e) {
      return null;
    }
  }

  function shouldSkipAnchor(a, ev) {
    if (!a || a.tagName !== "A") return true;
    if (ev.defaultPrevented) return true;
    if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return true;
    var t = (a.getAttribute("target") || "").toLowerCase();
    if (t && t !== "_self") return true;
    if (a.hasAttribute("download")) return true;
    if (a.closest("[data-gc-skip-nav-check]")) return true;
    if (a.getAttribute("aria-disabled") === "true") return true;
    var href = a.getAttribute("href");
    if (!href || href === "#" || href.charAt(0) === "#") return true;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return true;
    var u = sameOriginUrl(href);
    if (!u || u.origin !== window.location.origin) return true;
    return false;
  }

  function hasFileInput(form) {
    var files = form.querySelectorAll('input[type="file"]');
    for (var i = 0; i < files.length; i++) {
      if (files[i].files && files[i].files.length) return true;
    }
    return false;
  }

  function shouldSkipForm(form, ev) {
    if (!form || form.tagName !== "FORM") return true;
    if (ev.defaultPrevented) return true;
    if (form.closest("[data-gc-skip-nav-check]")) return true;
    var method = (form.getAttribute("method") || "get").toLowerCase();
    if (method !== "get" && method !== "post") return true;
    var act = form.getAttribute("action");
    var actionUrl = sameOriginUrl(
      act != null && act !== "" ? act : window.location.pathname + window.location.search
    );
    if (!actionUrl || actionUrl.origin !== window.location.origin) return true;
    if (method === "post" && hasFileInput(form)) return true;
    return false;
  }

  async function preflightNavigate(url, init) {
    var reqUrl = typeof url === "string" ? url : url.toString();
    try {
      var response = await fetch(reqUrl, {
        credentials: "same-origin",
        redirect: "follow",
        headers: FETCH_HEADERS,
        cache: "no-store",
        ...(init || {}),
      });
      if (response.ok) {
        window.location.assign(response.url);
        return;
      }
      var msg = await bodyMessage(response);
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
      var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
      if (!a || shouldSkipAnchor(a, ev)) return;
      var u = sameOriginUrl(a.getAttribute("href"));
      if (!u || u.origin !== window.location.origin) return;
      ev.preventDefault();
      preflightNavigate(u.toString(), { method: "GET" });
    },
    false
  );

  document.addEventListener(
    "submit",
    function (ev) {
      var form = ev.target;
      if (!form || form.tagName !== "FORM" || shouldSkipForm(form, ev)) return;
      var method = (form.getAttribute("method") || "get").toLowerCase();
      ev.preventDefault();
      var actionUrl = sameOriginUrl(
        form.getAttribute("action") != null && form.getAttribute("action") !== ""
          ? form.getAttribute("action")
          : window.location.pathname + window.location.search
      );
      if (!actionUrl) return;
      if (method === "get") {
        try {
          var params = new URLSearchParams(new FormData(form));
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
