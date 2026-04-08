(function () {
  "use strict";

  const DEFAULT_SESSION_IDLE_MINUTES = 60;
  let sessionIdleMinutes = DEFAULT_SESSION_IDLE_MINUTES;

  let currentSessionUser = null;
  let sessionIdleMs = 0;
  let lastUserActivityAt = 0;
  let lastKeepaliveSentAt = 0;
  let sessionIdleWatchdogTimer = null;
  let sessionIdleListenersBound = false;
  const SESSION_IDLE_ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "wheel"];

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
      return map[c] || c;
    });
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return escapeHtml(String(iso));
    return escapeHtml(d.toLocaleString());
  }

  function formatDuration(seconds) {
    const n = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
    const d = Math.floor(n / 86400);
    const h = Math.floor((n % 86400) / 3600);
    const m = Math.floor((n % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function notify(title, message) {
    window.alert([title, message].filter(Boolean).join("\n"));
  }

  function stopSessionIdleWatch() {
    if (sessionIdleWatchdogTimer != null) {
      clearInterval(sessionIdleWatchdogTimer);
      sessionIdleWatchdogTimer = null;
    }
    sessionIdleMs = 0;
  }

  function onSessionUserActivity() {
    lastUserActivityAt = Date.now();
    maybeSendSessionKeepalive();
  }

  function maybeSendSessionKeepalive() {
    if (!currentSessionUser || sessionIdleMs <= 0) return;
    const now = Date.now();
    if (now - lastKeepaliveSentAt < 45000) return;
    lastKeepaliveSentAt = now;
    fetch("/api/auth/activity", { method: "POST", credentials: "same-origin", cache: "no-store" }).then((r) => {
      if (r.status === 401) handleSessionExpired("Signed out due to inactivity.");
    });
  }

  function startSessionIdleWatch() {
    stopSessionIdleWatch();
    const mins = Number(sessionIdleMinutes);
    const m = Number.isFinite(mins) && mins >= 0 ? Math.min(525600, Math.floor(mins)) : DEFAULT_SESSION_IDLE_MINUTES;
    sessionIdleMs = m * 60 * 1000;
    if (!currentSessionUser || sessionIdleMs <= 0) return;
    lastUserActivityAt = Date.now();
    lastKeepaliveSentAt = 0;
    if (!sessionIdleListenersBound) {
      SESSION_IDLE_ACTIVITY_EVENTS.forEach((ev) => {
        document.addEventListener(ev, onSessionUserActivity, { passive: true, capture: true });
      });
      sessionIdleListenersBound = true;
    }
    sessionIdleWatchdogTimer = window.setInterval(() => {
      if (!currentSessionUser || sessionIdleMs <= 0) return;
      if (Date.now() - lastUserActivityAt >= sessionIdleMs) {
        handleSessionExpired("Signed out due to inactivity.");
      }
    }, 10000);
  }

  function restartSessionIdleWatchIfAuthenticated() {
    stopSessionIdleWatch();
    startSessionIdleWatch();
  }

  function isAdmin() {
    return currentSessionUser?.role === "admin";
  }

  function handleSessionExpired(message) {
    stopSessionIdleWatch();
    currentSessionUser = null;
    const btnUser = document.getElementById("btn-user-menu");
    if (btnUser) btnUser.hidden = true;
    closeUserDropdown();
    closeActiveAdminsDialog();
    closeSettingsModal();
    const uf = document.getElementById("user-form-dialog");
    if (uf && !uf.hidden) {
      uf.hidden = true;
      uf.setAttribute("aria-hidden", "true");
    }
    const uep = document.getElementById("user-edit-profile-dialog");
    if (uep && !uep.hidden) {
      uep.hidden = true;
      uep.setAttribute("aria-hidden", "true");
    }
    showLoginGate(message || "Session expired. Sign in again.");
  }

  async function loadJson(url) {
    const r = await fetch(url, { credentials: "same-origin" });
    if (r.status === 401) {
      handleSessionExpired();
      throw new Error("Unauthorized");
    }
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  }

  async function apiRequestJson(url, options = {}) {
    const skipAuthRedirectOn401 = Boolean(options.skipAuthRedirectOn401);
    const { skipAuthRedirectOn401: _s, ...fetchOptions } = options;
    const headers = { "Content-Type": "application/json", ...(fetchOptions.headers || {}) };
    const r = await fetch(url, { ...fetchOptions, headers, credentials: "same-origin" });
    if (r.status === 401 && !skipAuthRedirectOn401) {
      handleSessionExpired();
      throw new Error("Unauthorized");
    }
    if (!r.ok) {
      let msg = r.statusText;
      try {
        const j = await r.json();
        if (j.detail !== undefined) {
          const d = j.detail;
          if (typeof d === "object" && d !== null && Array.isArray(d.errors)) {
            msg = d.errors.join(" ");
          } else {
            msg = typeof d === "string" ? d : JSON.stringify(d);
          }
        }
      } catch {
        /* ignore */
      }
      const err = new Error(msg);
      err.status = r.status;
      throw err;
    }
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  function appRoleDisplay(role) {
    if (role === "admin") return "Administrator";
    if (role === "user") return "User";
    return role ? String(role) : "—";
  }

  function applySessionUserToChrome() {
    const u = currentSessionUser;
    const nameEl = document.getElementById("user-menu-display-name");
    const roleEl = document.getElementById("user-menu-role-line");
    if (nameEl) {
      const fn = u?.full_name != null ? String(u.full_name).trim() : "";
      nameEl.textContent = fn || (u?.username ? String(u.username) : "—");
    }
    if (roleEl) {
      roleEl.textContent = u ? appRoleDisplay(u.role) : "";
    }
  }

  function hideAuthBootstrapLoading() {
    const load = document.getElementById("auth-loading-block");
    if (load) load.hidden = true;
    document.getElementById("auth-overlay")?.classList.remove("auth-overlay--bootstrapping");
  }

  function revealAuthenticatedChrome() {
    const overlay = document.getElementById("auth-overlay");
    if (overlay) {
      overlay.classList.remove("auth-overlay--anim", "auth-overlay--bootstrapping");
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
    }
    const load = document.getElementById("auth-loading-block");
    if (load) load.hidden = true;
    const btnUser = document.getElementById("btn-user-menu");
    if (btnUser) btnUser.hidden = false;
    applySessionUserToChrome();
    if (typeof window.gcRefreshTaskQueueBadge === "function") {
      window.gcRefreshTaskQueueBadge();
    }
  }

  function triggerAuthIntro() {
    const overlay = document.getElementById("auth-overlay");
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove("auth-overlay--anim");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add("auth-overlay--anim");
      });
    });
  }

  function scheduleAuthGateFocus() {
    const reduce =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduce ? 0 : 560;
    window.setTimeout(() => {
      const o = document.getElementById("auth-overlay");
      if (!o || o.hidden) return;
      const setup = document.getElementById("auth-setup-block");
      const login = document.getElementById("auth-login-block");
      if (setup && !setup.hidden) {
        document.getElementById("auth-setup-password")?.focus();
      } else if (login && !login.hidden) {
        document.getElementById("auth-login-username")?.focus();
      }
    }, delay);
  }

  function showSetupGate(defaultAdminUsername) {
    const btnUserEarly = document.getElementById("btn-user-menu");
    if (btnUserEarly) btnUserEarly.hidden = true;
    const overlay = document.getElementById("auth-overlay");
    const title = document.getElementById("auth-overlay-title");
    const sub = document.getElementById("auth-overlay-subtitle");
    const setup = document.getElementById("auth-setup-block");
    const login = document.getElementById("auth-login-block");
    const lead = document.getElementById("auth-setup-lead");
    if (!overlay || !setup || !login) return;
    hideAuthBootstrapLoading();
    const u = (defaultAdminUsername != null && String(defaultAdminUsername).trim()
      ? String(defaultAdminUsername).trim()
      : "admin");
    if (lead) {
      lead.innerHTML = `This is your first sign-in. Set a password for the <strong>${escapeHtml(u)}</strong> administrator account. Minimum 10 characters. Afterwards you will sign in with that username and password. You can add more local accounts later in <strong>Settings</strong>.`;
    }
    if (title) title.textContent = "Set administrator password";
    if (sub) {
      sub.textContent = "";
      sub.hidden = true;
    }
    setup.hidden = false;
    login.hidden = true;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    const st = document.getElementById("auth-setup-status");
    if (st) {
      st.textContent = "";
      st.classList.remove("is-error", "is-ok");
    }
    document.getElementById("auth-setup-form")?.reset();
    triggerAuthIntro();
    scheduleAuthGateFocus();
  }

  function showLoginGate(prefillMessage) {
    const btnUserEarly = document.getElementById("btn-user-menu");
    if (btnUserEarly) btnUserEarly.hidden = true;
    const overlay = document.getElementById("auth-overlay");
    const title = document.getElementById("auth-overlay-title");
    const sub = document.getElementById("auth-overlay-subtitle");
    const setup = document.getElementById("auth-setup-block");
    const login = document.getElementById("auth-login-block");
    if (!overlay || !setup || !login) return;
    hideAuthBootstrapLoading();
    if (title) title.textContent = "Sign in to Ground Control";
    if (sub) {
      sub.textContent = "Use your local account credentials.";
      sub.hidden = false;
    }
    setup.hidden = true;
    login.hidden = false;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    const lst = document.getElementById("auth-login-status");
    if (lst) {
      lst.textContent = prefillMessage || "";
      lst.classList.toggle("is-error", Boolean(prefillMessage));
      lst.classList.remove("is-ok");
    }
    document.getElementById("auth-login-form")?.reset();
    triggerAuthIntro();
    scheduleAuthGateFocus();
  }

  async function bootAuth() {
    const init = window.GC_INITIAL_AUTH || {};
    if (typeof init.session_idle_timeout_minutes === "number") {
      sessionIdleMinutes = init.session_idle_timeout_minutes;
    }
    if (init.authenticated && init.user) {
      currentSessionUser = init.user;
      revealAuthenticatedChrome();
      restartSessionIdleWatchIfAuthenticated();
    }
    try {
      const r = await fetch("/api/auth/status", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const st = await r.json();
      if (typeof st.session_idle_timeout_minutes === "number") {
        sessionIdleMinutes = st.session_idle_timeout_minutes;
      }
      if (st.authenticated) {
        currentSessionUser = st.user;
        revealAuthenticatedChrome();
        restartSessionIdleWatchIfAuthenticated();
        return;
      }
      currentSessionUser = null;
      stopSessionIdleWatch();
      /* Truthy: JSON may deserialize oddly across proxies; never send users to login if setup is required. */
      if (st.needs_admin_password_setup) {
        showSetupGate(st.default_admin_username);
        return;
      }
      showLoginGate();
    } catch (e) {
      console.error(e);
      if (init.authenticated && init.user) {
        currentSessionUser = null;
        stopSessionIdleWatch();
      }
      showLoginGate("Could not reach the server.");
    }
  }

  function initAuthForms() {
    document.getElementById("auth-setup-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const p1 = document.getElementById("auth-setup-password")?.value || "";
      const p2 = document.getElementById("auth-setup-password-confirm")?.value || "";
      const st = document.getElementById("auth-setup-status");
      if (p1 !== p2) {
        if (st) {
          st.textContent = "Passwords do not match.";
          st.classList.add("is-error");
          st.classList.remove("is-ok");
        }
        return;
      }
      try {
        const res = await apiRequestJson("/api/auth/setup-admin-password", {
          method: "POST",
          body: JSON.stringify({ password: p1, password_confirm: p2 }),
        });
        currentSessionUser = res?.user;
        revealAuthenticatedChrome();
        restartSessionIdleWatchIfAuthenticated();
        window.location.reload();
      } catch (err) {
        if (st) {
          st.textContent = err.message || "Could not save password.";
          st.classList.add("is-error");
          st.classList.remove("is-ok");
        }
      }
    });

    document.getElementById("auth-login-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("auth-login-username")?.value?.trim() || "";
      const password = document.getElementById("auth-login-password")?.value || "";
      const st = document.getElementById("auth-login-status");
      try {
        const res = await apiRequestJson("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
          skipAuthRedirectOn401: true,
        });
        currentSessionUser = res?.user;
        revealAuthenticatedChrome();
        if (st) {
          st.textContent = "";
          st.classList.remove("is-error");
        }
        restartSessionIdleWatchIfAuthenticated();
        window.location.reload();
      } catch (err) {
        const msg = err.message || "";
        if (
          msg.includes("administrator password first") ||
          msg.includes("Initial setup") ||
          msg.toLowerCase().includes("initial setup")
        ) {
          showSetupGate();
          return;
        }
        if (st) {
          st.textContent = msg || "Sign-in failed.";
          st.classList.add("is-error");
        }
      }
    });
  }

  let userMenuOpen = false;
  let activeAdminsDialogOpen = false;
  let activeAdminsRows = [];
  let activeAdminsTickTimer = null;
  let lastActiveAdminsFetchAt = 0;

  function setUserMenuOpen(open) {
    const menu = document.getElementById("user-menu-dropdown");
    const trigger = document.getElementById("btn-user-menu");
    if (!menu || !trigger) return;
    userMenuOpen = open;
    menu.hidden = !open;
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      fetchActiveAdmins().catch(() => {
        updateActiveAdminCountBadge(0);
      });
    }
  }

  function closeUserDropdown() {
    setUserMenuOpen(false);
  }

  function initUserMenu() {
    const trigger = document.getElementById("btn-user-menu");
    const menu = document.getElementById("user-menu-dropdown");
    if (!trigger || !menu) return;
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      setUserMenuOpen(!userMenuOpen);
    });
    document.addEventListener("click", () => closeUserDropdown());
    menu.addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("user-menu-active-admins")?.addEventListener("click", (e) => {
      e.preventDefault();
      openActiveAdminsDialog();
    });
    document.getElementById("active-admins-close")?.addEventListener("click", closeActiveAdminsDialog);
    document.querySelector("#active-admins-dialog .settings-subdialog__backdrop")?.addEventListener("click", closeActiveAdminsDialog);
    document.getElementById("user-menu-logout")?.addEventListener("click", async () => {
      try {
        await apiRequestJson("/api/auth/logout", { method: "POST" });
      } catch {
        /* still sign out locally */
      }
      currentSessionUser = null;
      trigger.hidden = true;
      closeUserDropdown();
      closeActiveAdminsDialog();
      window.location.href = "/";
    });
  }

  function applySettingsNavForRole() {
    const admin = isAdmin();
    const actions = document.getElementById("settings-users-actions");
    const wrap = document.getElementById("settings-users-wrap");
    if (actions) actions.hidden = !admin;
    if (wrap) wrap.classList.toggle("settings-user-readonly", !admin);
    const secNav = document.getElementById("settings-nav-security");
    if (secNav) secNav.hidden = !admin;
    const testNav = document.getElementById("settings-nav-test");
    if (testNav) testNav.hidden = !admin;
    const activePanel = document.querySelector("#settings-modal .settings-panel.is-active");
    if (!admin && (activePanel?.dataset?.settingsPanel === "security" || activePanel?.dataset?.settingsPanel === "test")) {
      setSettingsSection("users");
    }
  }

  function openUserFormDialog() {
    const d = document.getElementById("user-form-dialog");
    if (!d) return;
    document.getElementById("user-form")?.reset();
    const st = document.getElementById("user-form-status");
    if (st) {
      st.textContent = "";
      st.classList.remove("is-error", "is-ok");
    }
    d.hidden = false;
    d.setAttribute("aria-hidden", "false");
    document.getElementById("user-form-username")?.focus();
  }

  function closeUserFormDialog() {
    const d = document.getElementById("user-form-dialog");
    if (!d || d.hidden) return;
    d.hidden = true;
    d.setAttribute("aria-hidden", "true");
  }

  function closeUserEditProfileDialog() {
    const d = document.getElementById("user-edit-profile-dialog");
    if (!d || d.hidden) return;
    d.hidden = true;
    d.setAttribute("aria-hidden", "true");
  }

  function setActiveAdminsStatus(message, isError) {
    const st = document.getElementById("active-admins-status");
    if (!st) return;
    st.textContent = message || "";
    st.classList.toggle("is-error", !!isError);
    st.classList.remove("is-ok");
  }

  function renderActiveAdminsTable() {
    const tbody = document.getElementById("active-admins-body");
    if (!tbody) return;
    if (!Array.isArray(activeAdminsRows) || activeAdminsRows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted active-admins-dialog__empty">No admins are currently active.</td></tr>';
      return;
    }
    const now = Date.now();
    tbody.innerHTML = activeAdminsRows
      .map((row) => {
        const displayName = escapeHtml(row.display_name || row.username || row.user_id || "—");
        const ipAddr = escapeHtml(row.client_ip || "—");
        const loggedIn = fmtDate(row.logged_in_at);
        const lastActivity = fmtDate(row.last_activity_at);
        const idleSecs =
          row.last_activity_at && !Number.isNaN(new Date(row.last_activity_at).getTime())
            ? Math.max(0, Math.floor((now - new Date(row.last_activity_at).getTime()) / 1000))
            : Number(row.last_activity_seconds_ago || 0);
        return `<tr>
          <td>${displayName}</td>
          <td>${ipAddr}</td>
          <td>${loggedIn}</td>
          <td>${lastActivity}</td>
          <td>${escapeHtml(formatDuration(idleSecs))} ago</td>
        </tr>`;
      })
      .join("");
  }

  function updateActiveAdminCountBadge(count) {
    const countEl = document.getElementById("user-menu-active-admin-count");
    if (!countEl) return;
    const n = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0;
    countEl.textContent = String(n);
  }

  async function fetchActiveAdmins({ force = false } = {}) {
    const now = Date.now();
    if (!force && now - lastActiveAdminsFetchAt < 20000) return;
    lastActiveAdminsFetchAt = now;
    const payload = await apiRequestJson("/api/auth/active-admin-sessions", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const rows = Array.isArray(payload?.admins) ? payload.admins : [];
    activeAdminsRows = rows;
    updateActiveAdminCountBadge(payload?.count ?? rows.length);
    if (activeAdminsDialogOpen) renderActiveAdminsTable();
  }

  function stopActiveAdminsTicker() {
    if (activeAdminsTickTimer != null) {
      clearInterval(activeAdminsTickTimer);
      activeAdminsTickTimer = null;
    }
  }

  function startActiveAdminsTicker() {
    stopActiveAdminsTicker();
    activeAdminsTickTimer = window.setInterval(() => {
      if (!activeAdminsDialogOpen) return;
      renderActiveAdminsTable();
    }, 30000);
  }

  function openActiveAdminsDialog() {
    const d = document.getElementById("active-admins-dialog");
    if (!d) return;
    closeUserDropdown();
    d.hidden = false;
    d.setAttribute("aria-hidden", "false");
    activeAdminsDialogOpen = true;
    setActiveAdminsStatus("Loading…", false);
    renderActiveAdminsTable();
    fetchActiveAdmins({ force: true })
      .then(() => setActiveAdminsStatus("", false))
      .catch((err) => {
        setActiveAdminsStatus(err?.message || "Could not load active admins.", true);
      });
    startActiveAdminsTicker();
    document.getElementById("active-admins-close")?.focus();
  }

  function closeActiveAdminsDialog() {
    const d = document.getElementById("active-admins-dialog");
    activeAdminsDialogOpen = false;
    stopActiveAdminsTicker();
    if (!d || d.hidden) return;
    d.hidden = true;
    d.setAttribute("aria-hidden", "true");
  }

  let settingsFocusBeforeOpen = null;

  function openSettingsModal() {
    const m = document.getElementById("settings-modal");
    if (!m) return;
    settingsFocusBeforeOpen = document.activeElement;
    m.hidden = false;
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const filter = document.getElementById("settings-nav-filter");
    if (filter) filter.value = "";
    applySettingsNavForRole();
    filterSettingsNav();
    setSettingsSection("users");
    loadSettingsUsers().catch((err) => console.error(err));
    filter?.focus();
  }

  function closeSettingsModal() {
    const m = document.getElementById("settings-modal");
    if (!m || m.hidden) return;
    closeUserFormDialog();
    closeUserEditProfileDialog();
    m.hidden = true;
    m.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (settingsFocusBeforeOpen && typeof settingsFocusBeforeOpen.focus === "function") {
      settingsFocusBeforeOpen.focus();
    }
    settingsFocusBeforeOpen = null;
  }

  let securityCertPresent = false;

  function setSecurityStatus(message, kind) {
    const st = document.getElementById("settings-security-status");
    if (!st) return;
    st.textContent = message || "";
    st.classList.remove("is-error", "is-ok");
    if (kind === "error") st.classList.add("is-error");
    else if (kind === "ok") st.classList.add("is-ok");
  }

  function renderSecurityCertificateSummary(cert) {
    const el = document.getElementById("settings-security-cert-summary");
    const dlBtn = document.getElementById("settings-security-download-public-cert");
    const dlHint = document.getElementById("settings-security-download-cert-hint");
    const hasCert = !!(cert && cert.present);
    if (dlBtn) dlBtn.disabled = !hasCert;
    if (dlHint) dlHint.hidden = !hasCert;
    if (!el) return;
    if (!hasCert) {
      el.textContent =
        "No certificate on disk yet. Use “Generate certificate” (self-signed) or place PEM files where the server expects them (see GROUND_CONTROL_TLS_CERT_PATH / GROUND_CONTROL_TLS_KEY_PATH).";
      securityCertPresent = false;
      return;
    }
    securityCertPresent = true;
    const nameLine =
      (cert.dns_names && cert.dns_names.length ? cert.dns_names.join(", ") : null) ||
      cert.subject_common_name ||
      cert.primary_hostname ||
      "—";
    const after = cert.not_after ? ` Valid until ${cert.not_after}.` : "";
    el.textContent = `Issued for: ${nameLine}.${after}`;
  }

  async function downloadSecurityTlsPublicCert() {
    try {
      const r = await fetch("/api/settings/security/tls-public-certificate.pem", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (r.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!r.ok) {
        let msg = r.statusText;
        try {
          const j = await r.json();
          if (j.detail !== undefined) {
            msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
          }
        } catch {
          /* ignore */
        }
        setSecurityStatus(msg, "error");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ground-control-tls-public.pem";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSecurityStatus("Public certificate downloaded.", "ok");
    } catch (e) {
      setSecurityStatus(e.message || "Download failed.", "error");
    }
  }

  function readSecurityFormPayload() {
    const httpPort = parseInt(document.getElementById("settings-security-http-port")?.value, 10);
    const httpsRaw = document.getElementById("settings-security-https-port")?.value?.trim();
    const httpsPortParsed = httpsRaw === "" ? NaN : parseInt(httpsRaw, 10);
    return {
      http_enabled: !!document.getElementById("settings-security-http-enabled")?.checked,
      https_enabled: !!document.getElementById("settings-security-https-enabled")?.checked,
      redirect_http_to_https: !!document.getElementById("settings-security-redirect-http")?.checked,
      http_port: Number.isFinite(httpPort) ? httpPort : 8000,
      https_port: Number.isFinite(httpsPortParsed) ? httpsPortParsed : null,
      listen_interface: document.getElementById("settings-security-listen-interface")?.value || "0.0.0.0",
      allowed_ranges: document.getElementById("settings-security-allowed-ranges")?.value || "",
      tls_hostname: document.getElementById("settings-security-tls-hostname")?.value?.trim() || "",
    };
  }

  function syncSecurityFormControls() {
    const httpEn = document.getElementById("settings-security-http-enabled");
    const httpPort = document.getElementById("settings-security-http-port");
    const httpsEn = document.getElementById("settings-security-https-enabled");
    const httpsPort = document.getElementById("settings-security-https-port");
    const redirect = document.getElementById("settings-security-redirect-http");
    const block = document.getElementById("settings-security-tls-block");

    const httpOn = !!httpEn?.checked;
    if (httpPort) httpPort.disabled = !httpOn;

    const httpsOn = !!httpsEn?.checked;
    if (httpsPort) httpsPort.disabled = !httpsOn;
    if (redirect) {
      redirect.disabled = !httpsOn;
      if (!httpsOn) redirect.checked = false;
    }
    if (block) block.hidden = !httpsOn;
  }

  function syncSecurityCertPanel() {
    const form = document.getElementById("settings-security-form");
    const v = form?.querySelector('input[name="cert_method"]:checked')?.value || "self_signed";
    const selfEl = document.getElementById("settings-security-cert-self");
    const httpEl = document.getElementById("settings-security-cert-lehttp");
    const dnsEl = document.getElementById("settings-security-cert-ledns");
    if (selfEl) selfEl.hidden = v !== "self_signed";
    if (httpEl) httpEl.hidden = v !== "letsencrypt_http";
    if (dnsEl) dnsEl.hidden = v !== "letsencrypt_dns";
  }

  async function loadSecuritySettings() {
    if (!isAdmin()) return;
    setSecurityStatus("Loading…", null);
    try {
      const data = await apiRequestJson("/api/settings/security");
      renderSecurityCertificateSummary(data.certificate);
      const httpEn = document.getElementById("settings-security-http-enabled");
      const httpsEn = document.getElementById("settings-security-https-enabled");
      if (httpEn) httpEn.checked = !!data.http_enabled;
      if (httpsEn) httpsEn.checked = !!data.https_enabled;
      const redir = document.getElementById("settings-security-redirect-http");
      if (redir) redir.checked = !!data.redirect_http_to_https;
      const hInp = document.getElementById("settings-security-http-port");
      if (hInp) hInp.value = String(data.http_port ?? data.runtime_http_port ?? 8000);
      const hsInp = document.getElementById("settings-security-https-port");
      if (hsInp) {
        const hp = data.https_port ?? data.runtime_https_port;
        hsInp.value = hp != null ? String(hp) : "8443";
      }
      const lif = document.getElementById("settings-security-listen-interface");
      if (lif) lif.value = data.listen_interface || "0.0.0.0";
      const ar = document.getElementById("settings-security-allowed-ranges");
      if (ar) ar.value = data.allowed_ranges || "";
      const tlsH = document.getElementById("settings-security-tls-hostname");
      if (tlsH) tlsH.value = (data.tls_hostname && String(data.tls_hostname).trim()) || "localhost";
      syncSecurityFormControls();
      syncSecurityCertPanel();
      setSecurityStatus("", null);
    } catch (e) {
      renderSecurityCertificateSummary(null);
      securityCertPresent = false;
      syncSecurityFormControls();
      setSecurityStatus(e.message || "Could not load security settings.", "error");
    }
  }

  async function submitSecuritySettings(e) {
    if (e) e.preventDefault();
    if (!isAdmin()) return;
    const payload = readSecurityFormPayload();
    const applyBtn = document.getElementById("settings-security-apply");
    if (applyBtn) applyBtn.disabled = true;
    setSecurityStatus("Validating ports…", null);
    try {
      const v = await apiRequestJson("/api/settings/security/validate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!v.ok) {
        setSecurityStatus((v.errors && v.errors.join(" ")) || "Validation failed.", "error");
        return;
      }
      setSecurityStatus("Saving…", null);
      const result = await apiRequestJson("/api/settings/security", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (result.certificate) renderSecurityCertificateSummary(result.certificate);
      syncSecurityFormControls();
      setSecurityStatus(result.message || "Applied.", "ok");
    } catch (err) {
      setSecurityStatus(err.message || "Apply failed.", "error");
    } finally {
      if (applyBtn) applyBtn.disabled = false;
    }
  }

  function setTestFirewallsStatus(message, kind) {
    const st = document.getElementById("settings-test-firewalls-status");
    if (!st) return;
    st.textContent = message || "";
    st.classList.remove("is-error", "is-ok");
    if (kind === "error") st.classList.add("is-error");
    else if (kind === "ok") st.classList.add("is-ok");
  }

  function readRequestedTestFirewallCount() {
    const input = document.getElementById("settings-test-firewalls-count");
    const parsed = parseInt(input?.value || "10", 10);
    const safe = Number.isFinite(parsed) ? Math.max(1, Math.min(1000, parsed)) : 10;
    if (input) input.value = String(safe);
    return safe;
  }

  function readTestLanPoolCidr() {
    const input = document.getElementById("settings-test-firewalls-lan-pool");
    const raw = (input?.value || "172.16.0.0/12").trim();
    return raw || "172.16.0.0/12";
  }

  function updateTestFirewallsAddButtonLabel() {
    const btn = document.getElementById("settings-test-firewalls-add");
    if (!btn) return;
    const n = readRequestedTestFirewallCount();
    btn.textContent = n === 1 ? "Add 1 test firewall" : `Add ${n} test firewalls`;
  }

  function setTestFirewallCurrentCount(n) {
    const cur = document.getElementById("settings-test-firewalls-current");
    if (cur) cur.value = String(Number.isFinite(n) ? n : 0);
  }

  let testFwSourceInventory = [];
  let testFwSourcePickerBound = false;
  let testFwSourceDropdownDocBound = false;

  function getTestFwSourceSelectedId() {
    const raw = document.getElementById("settings-test-fw-source-id")?.value?.trim() || "";
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function normTestFwSourceInventory(rows) {
    const out = [];
    if (!Array.isArray(rows)) return out;
    rows.forEach((fw) => {
      if (!fw || fw.id == null) return;
      const fid = parseInt(String(fw.id), 10);
      if (!Number.isFinite(fid) || fid <= 0) return;
      const label = String(fw.label != null ? fw.label : "").trim() || String(fid);
      const tags = Array.isArray(fw.tags)
        ? fw.tags.filter((t) => typeof t === "string" && t.trim())
        : [];
      out.push({ id: fid, label, tags });
    });
    out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    return out;
  }

  function isTestFwSourceDropdownOpen() {
    const d = document.getElementById("settings-test-fw-source-dropdown");
    return !!(d && !d.hidden);
  }

  function setTestFwSourceDropdownOpen(open) {
    const d = document.getElementById("settings-test-fw-source-dropdown");
    const tr = document.getElementById("settings-test-fw-source-trigger");
    const modal = document.getElementById("settings-modal");
    if (d) d.hidden = !open;
    if (tr) tr.setAttribute("aria-expanded", open ? "true" : "false");
    if (modal) modal.classList.toggle("settings-modal--test-fw-source-open", open);
    if (open) {
      window.requestAnimationFrame(() => {
        document.getElementById("settings-test-fw-source-search")?.focus();
      });
    }
  }

  function syncTestFwSourceTriggerLabel() {
    const span = document.getElementById("settings-test-fw-source-trigger-text");
    if (!span) return;
    const id = getTestFwSourceSelectedId();
    if (id == null) {
      span.textContent = "None (empty cache)";
      return;
    }
    const fw = testFwSourceInventory.find((x) => x.id === id);
    span.textContent = fw ? fw.label : `Firewall #${id}`;
  }

  function onTestFwSourceDocumentClick(e) {
    const combo = document.getElementById("settings-test-fw-source-combo");
    if (!combo || !isTestFwSourceDropdownOpen()) return;
    if (!combo.contains(e.target)) setTestFwSourceDropdownOpen(false);
  }

  function onTestFwSourceDocumentKeydown(e) {
    if (e.key !== "Escape") return;
    if (!isTestFwSourceDropdownOpen()) return;
    setTestFwSourceDropdownOpen(false);
    document.getElementById("settings-test-fw-source-trigger")?.focus();
    e.preventDefault();
  }

  function renderTestFwSourceList() {
    const list = document.getElementById("settings-test-fw-source-list");
    const empty = document.getElementById("settings-test-fw-source-empty");
    const search = document.getElementById("settings-test-fw-source-search");
    if (!list) return;
    const q = (search?.value || "").trim().toLowerCase();
    const selected = getTestFwSourceSelectedId();
    const items = testFwSourceInventory.filter((fw) => {
      if (!q) return true;
      if (fw.label.toLowerCase().includes(q)) return true;
      return fw.tags.some((t) => t.toLowerCase().includes(q));
    });
    list.innerHTML = "";
    items.forEach((fw) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "settings-test-fw-source__opt";
      if (fw.id === selected) btn.classList.add("is-selected");
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", fw.id === selected ? "true" : "false");
      btn.dataset.fwId = String(fw.id);
      const tagStr = fw.tags.length
        ? ` · ${fw.tags.slice(0, 4).join(", ")}${fw.tags.length > 4 ? "…" : ""}`
        : "";
      btn.textContent = `${fw.label}${tagStr}`;
      btn.addEventListener("click", () => {
        const hid = document.getElementById("settings-test-fw-source-id");
        if (hid) hid.value = String(fw.id);
        renderTestFwSourceList();
        setTestFwSourceDropdownOpen(false);
        document.getElementById("settings-test-fw-source-trigger")?.focus();
      });
      list.appendChild(btn);
    });
    if (empty) {
      if (testFwSourceInventory.length === 0) {
        empty.textContent = "No firewalls in inventory.";
        empty.hidden = false;
      } else if (items.length === 0) {
        empty.textContent = "No firewalls match.";
        empty.hidden = false;
      } else {
        empty.hidden = true;
      }
    }
    syncTestFwSourceTriggerLabel();
  }

  async function hydrateTestFwSourcePicker() {
    if (!isAdmin()) return;
    try {
      const rows = await apiRequestJson("/api/firewalls/nav-multiselect");
      testFwSourceInventory = normTestFwSourceInventory(rows);
    } catch {
      testFwSourceInventory = normTestFwSourceInventory(
        typeof window.gcNavFirewallsJson !== "undefined" ? window.gcNavFirewallsJson : [],
      );
    }
    const sel = getTestFwSourceSelectedId();
    if (sel != null && !testFwSourceInventory.some((x) => x.id === sel)) {
      const hid = document.getElementById("settings-test-fw-source-id");
      if (hid) hid.value = "";
    }
    renderTestFwSourceList();
  }

  function bindTestFwSourcePicker() {
    if (testFwSourcePickerBound) return;
    const trigger = document.getElementById("settings-test-fw-source-trigger");
    const search = document.getElementById("settings-test-fw-source-search");
    const clear = document.getElementById("settings-test-fw-source-clear");
    const countInput = document.getElementById("settings-test-firewalls-count");
    trigger?.addEventListener("click", (e) => {
      e.preventDefault();
      setTestFwSourceDropdownOpen(!isTestFwSourceDropdownOpen());
    });
    search?.addEventListener("input", () => renderTestFwSourceList());
    search?.addEventListener("click", (e) => e.stopPropagation());
    clear?.addEventListener("click", (e) => {
      e.stopPropagation();
      const hid = document.getElementById("settings-test-fw-source-id");
      if (hid) hid.value = "";
      if (search) search.value = "";
      renderTestFwSourceList();
    });
    if (countInput && !countInput.dataset.gcTestFwCountBound) {
      countInput.dataset.gcTestFwCountBound = "1";
      ["input", "change"].forEach((ev) => {
        countInput.addEventListener(ev, () => updateTestFirewallsAddButtonLabel());
      });
    }
    if (!testFwSourceDropdownDocBound) {
      document.addEventListener("click", onTestFwSourceDocumentClick);
      document.addEventListener("keydown", onTestFwSourceDocumentKeydown);
      testFwSourceDropdownDocBound = true;
    }
    testFwSourcePickerBound = true;
    updateTestFirewallsAddButtonLabel();
  }

  async function loadTestFirewallSummary() {
    if (!isAdmin()) return;
    bindTestFwSourcePicker();
    setTestFirewallsStatus("Loading…", null);
    try {
      const data = await apiRequestJson("/api/settings/test-firewalls");
      setTestFirewallCurrentCount(parseInt(data?.count, 10) || 0);
      setTestFirewallsStatus("", null);
    } catch (e) {
      setTestFirewallsStatus(e.message || "Could not load test firewall summary.", "error");
      return;
    }
    try {
      await hydrateTestFwSourcePicker();
    } catch {
      /* picker is optional; count already loaded */
    }
  }

  async function addTestFirewalls() {
    if (!isAdmin()) return;
    closeSettingsModal();
    const addBtn = document.getElementById("settings-test-firewalls-add");
    const cleanupBtn = document.getElementById("settings-test-firewalls-cleanup");
    const count = readRequestedTestFirewallCount();
    if (addBtn) addBtn.disabled = true;
    if (cleanupBtn) cleanupBtn.disabled = true;
    setTestFirewallsStatus(`Creating ${count} test firewall${count === 1 ? "" : "s"}…`, null);
    const progressMsg =
      count === 1 ? "Adding 1 test firewall…" : `Adding ${count} test firewalls…`;
    if (typeof window.gcGlobalBannerShowProgress === "function") {
      window.gcGlobalBannerShowProgress(progressMsg);
    }
    try {
      const srcId = getTestFwSourceSelectedId();
      const payload = { count, test_lan_pool_cidr: readTestLanPoolCidr() };
      if (srcId != null) payload.source_firewall_id = srcId;
      const data = await apiRequestJson("/api/settings/test-firewalls/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const created = parseInt(data?.created, 10) || 0;
      setTestFirewallCurrentCount(parseInt(data?.total_test_firewalls, 10) || 0);
      setTestFirewallsStatus(
        `Added ${created} test firewall${created === 1 ? "" : "s"}.`,
        "ok",
      );
      if (typeof window.gcGlobalBannerShowResult === "function") {
        const doneMsg =
          created === 1 ? "Added 1 test firewall." : `Added ${created} test firewalls.`;
        window.gcGlobalBannerShowResult(true, doneMsg);
      }
      hydrateTestFwSourcePicker().catch(() => {});
    } catch (e) {
      setTestFirewallsStatus(e.message || "Could not add test firewalls.", "error");
      if (typeof window.gcGlobalBannerShowResult === "function") {
        window.gcGlobalBannerShowResult(false, e.message || "Could not add test firewalls.");
      }
    } finally {
      if (addBtn) addBtn.disabled = false;
      if (cleanupBtn) cleanupBtn.disabled = false;
      updateTestFirewallsAddButtonLabel();
    }
  }

  async function cleanupTestFirewalls() {
    if (!isAdmin()) return;
    const addBtn = document.getElementById("settings-test-firewalls-add");
    const cleanupBtn = document.getElementById("settings-test-firewalls-cleanup");
    if (!window.confirm("Remove all test firewalls?")) return;
    closeSettingsModal();
    if (addBtn) addBtn.disabled = true;
    if (cleanupBtn) cleanupBtn.disabled = true;
    setTestFirewallsStatus("Removing test firewalls…", null);
    if (typeof window.gcGlobalBannerShowProgress === "function") {
      window.gcGlobalBannerShowProgress("Removing test firewalls…");
    }
    try {
      const data = await apiRequestJson("/api/settings/test-firewalls", { method: "DELETE" });
      setTestFirewallCurrentCount(parseInt(data?.total_test_firewalls, 10) || 0);
      const deleted = parseInt(data?.deleted, 10) || 0;
      setTestFirewallsStatus(`Removed ${deleted} test firewall${deleted === 1 ? "" : "s"}.`, "ok");
      if (typeof window.gcGlobalBannerShowResult === "function") {
        window.gcGlobalBannerShowResult(true, "Test firewalls cleaned up.");
      }
      hydrateTestFwSourcePicker().catch(() => {});
    } catch (e) {
      setTestFirewallsStatus(e.message || "Could not clean up test firewalls.", "error");
      if (typeof window.gcGlobalBannerShowResult === "function") {
        window.gcGlobalBannerShowResult(false, e.message || "Could not clean up test firewalls.");
      }
    } finally {
      if (addBtn) addBtn.disabled = false;
      if (cleanupBtn) cleanupBtn.disabled = false;
      updateTestFirewallsAddButtonLabel();
    }
  }

  function setSettingsSection(section) {
    if (section !== "test") {
      setTestFwSourceDropdownOpen(false);
    }
    document.querySelectorAll("#settings-modal [data-settings-section]").forEach((btn) => {
      const on = btn.dataset.settingsSection === section;
      btn.classList.toggle("is-active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    document.querySelectorAll("#settings-modal .settings-panel").forEach((p) => {
      const on = p.dataset.settingsPanel === section;
      p.classList.toggle("is-active", on);
      p.hidden = !on;
    });
    const secFooter = document.getElementById("settings-modal-security-footer");
    if (secFooter) secFooter.hidden = section !== "security";
    if (section === "users") {
      loadSettingsUsers().catch((err) => console.error(err));
    }
    if (section === "security") {
      loadSecuritySettings().catch((err) => console.error(err));
    }
    if (section === "test") {
      loadTestFirewallSummary().catch((err) => console.error(err));
    }
  }

  function filterSettingsNav() {
    const q = (document.getElementById("settings-nav-filter")?.value || "").trim().toLowerCase();
    document.querySelectorAll("#settings-nav .settings-nav__item").forEach((btn) => {
      const navText = (btn.querySelector("span")?.textContent || "").toLowerCase();
      const match = q === "" || navText.includes(q);
      btn.hidden = !match;
    });
    const aboutBtn = document.getElementById("settings-nav-about");
    if (aboutBtn) {
      const navText = (aboutBtn.querySelector("span")?.textContent || "").toLowerCase();
      const match = q === "" || navText.includes(q);
      aboutBtn.hidden = !match;
    }
  }

  const CRED_ROW_ICONS = {
    edit:
      '<svg class="settings-cred-icon-btn__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
    del: '<svg class="settings-cred-icon-btn__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  };

  const USER_ROW_ICONS = {
    role: '<svg class="settings-cred-icon-btn__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
    edit: CRED_ROW_ICONS.edit,
    key: '<svg class="settings-cred-icon-btn__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6 0 1.66.68 3.15 1.76 4.24l1.42-1.42A3.96 3.96 0 0 1 3 12c0-2.21 1.79-4 4-4 1.38 0 2.6.7 3.31 1.76L12 11h5V6l-1.79 1.79C14.55 6.67 12.83 6 11 6a7 7 0 0 0 0 14c3.87 0 7-3.13 7-7h-2c0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5c1.13 0 2.17.39 3.02 1.02L12.65 10z"/></svg>',
    del: CRED_ROW_ICONS.del,
  };

  function cellTextOrDash(val) {
    const t = val != null ? String(val).trim() : "";
    return t ? escapeHtml(t) : "—";
  }

  const SETTINGS_USER_FACET_COLS = [
    { id: "username", label: "Username" },
    { id: "full_name", label: "Full name" },
    { id: "email", label: "Email" },
    { id: "mobile", label: "Mobile" },
    { id: "role", label: "Role" },
    { id: "updated_at", label: "Updated" },
  ];

  let settingsUsersFacetAsideBound = false;
  let settingsUsersLoadGen = 0;

  function normUserFacetCell(val) {
    const t = val != null ? String(val).trim() : "";
    return t ? t.replace(/\s+/g, " ") : "—";
  }

  function settingsUserFacetMapFromApiRow(row) {
    let updatedDisplay = "—";
    if (row.updated_at) {
      const d = new Date(row.updated_at);
      updatedDisplay = Number.isNaN(d.getTime()) ? String(row.updated_at) : d.toLocaleString();
    }
    return {
      username: String(row.username || "")
        .trim()
        .replace(/\s+/g, " "),
      full_name: normUserFacetCell(row.full_name),
      email: normUserFacetCell(row.email),
      mobile: normUserFacetCell(row.mobile),
      role: String(row.role || "")
        .trim()
        .replace(/\s+/g, " "),
      updated_at: updatedDisplay.trim().replace(/\s+/g, " "),
    };
  }

  function syncSettingsUsersFacetRowData(tbody) {
    const maps = [];
    tbody.querySelectorAll("tr[data-user-id]").forEach((tr) => {
      const m = {};
      tr.querySelectorAll("td[data-gc-col]").forEach((td) => {
        const k = td.getAttribute("data-gc-col");
        if (k) m[k] = (td.textContent || "").trim().replace(/\s+/g, " ");
      });
      maps.push(m);
      window.gcTableFacets?.setRowFacets(tr, m);
    });
    return maps;
  }

  function rebuildSettingsUsersFacets(maps) {
    const drawer = document.getElementById("settings-users-filters-drawer");
    if (!drawer || !window.gcTableFacets) return;
    window.gcTableFacets.rebuild(drawer, SETTINGS_USER_FACET_COLS, maps, "settings-users");
  }

  function settingsUsersFacetAppliedCount() {
    const drawer = document.getElementById("settings-users-filters-drawer");
    if (!drawer || !window.gcTableFacets) return 0;
    return window.gcTableFacets.appliedCount(drawer);
  }

  function updateSettingsUsersFacetChrome() {
    const n = settingsUsersFacetAppliedCount();
    const head = document.getElementById("settings-users-facet-head-actions");
    const countEl = document.getElementById("settings-users-facet-count");
    const resetBtn = document.getElementById("settings-users-facet-reset");
    if (!head || !countEl || !resetBtn) return;
    if (n > 0) {
      head.hidden = false;
      countEl.innerHTML = `<span class="filters__facet-count-num">${n}</span> applied`;
      resetBtn.hidden = false;
    } else {
      head.hidden = true;
      countEl.textContent = "";
      resetBtn.hidden = true;
    }
  }

  function applySettingsUsersFacetFilter() {
    const tbody = document.getElementById("settings-users-body");
    const drawer = document.getElementById("settings-users-filters-drawer");
    if (!tbody || !drawer || !window.gcTableFacets) return;
    tbody.querySelectorAll("tr[data-user-id]").forEach((tr) => {
      tr.hidden = !window.gcTableFacets.rowMatches(tr, drawer);
    });
  }

  function setSettingsUsersFiltersCollapsed(collapsed) {
    const aside = document.getElementById("settings-users-filters-aside");
    const drawer = document.getElementById("settings-users-filters-drawer");
    const btn = document.getElementById("settings-users-filters-toggle");
    if (!aside || !drawer || !btn) return;
    aside.classList.toggle("filters--collapsed", collapsed);
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (collapsed) drawer.setAttribute("hidden", "");
    else drawer.removeAttribute("hidden");
  }

  function bindSettingsUsersFacetAsideOnce() {
    const aside = document.getElementById("settings-users-filters-aside");
    if (!aside || settingsUsersFacetAsideBound) return;
    settingsUsersFacetAsideBound = true;
    window.gcTableFacets?.bindAside(
      aside,
      () => {
        updateSettingsUsersFacetChrome();
        applySettingsUsersFacetFilter();
      },
      "settings-users",
    );
  }

  async function loadSettingsUsers() {
    const gen = ++settingsUsersLoadGen;
    const rows = await loadJson("/api/settings/users");
    if (gen !== settingsUsersLoadGen) return;
    const tbody = document.getElementById("settings-users-body");
    if (!tbody) return;
    bindSettingsUsersFacetAsideOnce();
    const drawer = document.getElementById("settings-users-filters-drawer");
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted">No users.</td></tr>';
      if (drawer && window.gcTableFacets) {
        window.gcTableFacets.reset(drawer, "settings-users");
        drawer.innerHTML = "";
      }
      updateSettingsUsersFacetChrome();
      window.gcTableSort?.bindTable(document.getElementById("settings-users-table"));
      return;
    }
    const adminUi = isAdmin();
    const facetMaps = rows.map(settingsUserFacetMapFromApiRow);
    if (drawer && window.gcTableFacets) {
      rebuildSettingsUsersFacets(facetMaps);
    }
    const rowHtmlJoined = rows
      .map((row) => {
        const id = escapeHtml(row.id);
        const actions = adminUi
          ? `<td class="settings-cred-actions settings-user-actions-cell">
          <div class="settings-cred-actions">
            <button type="button" class="settings-cred-icon-btn user-role-btn" data-id="${id}" title="Change role" aria-label="Change role">${USER_ROW_ICONS.role}</button>
            <button type="button" class="settings-cred-icon-btn user-profile-btn" data-id="${id}" title="Edit name and contact" aria-label="Edit name and contact">${USER_ROW_ICONS.edit}</button>
            <button type="button" class="settings-cred-icon-btn user-password-btn" data-id="${id}" title="Set password" aria-label="Set password">${USER_ROW_ICONS.key}</button>
            <button type="button" class="settings-cred-icon-btn settings-cred-icon-btn--danger user-delete-btn" data-id="${id}" title="Delete user" aria-label="Delete user">${USER_ROW_ICONS.del}</button>
          </div>
        </td>`
          : `<td class="settings-user-actions-cell"></td>`;
        return `<tr data-user-id="${id}">
          <td data-gc-col="username"><strong>${escapeHtml(row.username)}</strong></td>
          <td data-gc-col="full_name">${cellTextOrDash(row.full_name)}</td>
          <td data-gc-col="email">${cellTextOrDash(row.email)}</td>
          <td data-gc-col="mobile">${cellTextOrDash(row.mobile)}</td>
          <td data-gc-col="role" class="settings-user-cell--role">${escapeHtml(row.role)}</td>
          <td data-gc-col="updated_at" data-sort-value="${escapeHtml(row.updated_at || "")}" class="muted">${fmtDate(row.updated_at)}</td>
          ${actions}
        </tr>`;
      })
      .join("");
    const wrap = document.createElement("tbody");
    wrap.innerHTML = rowHtmlJoined;
    const trList = Array.from(wrap.children);
    trList.forEach((tr, i) => {
      window.gcTableFacets?.setRowFacets(tr, facetMaps[i]);
    });

    function finishSettingsUsersTable() {
      if (gen !== settingsUsersLoadGen) return;
      updateSettingsUsersFacetChrome();
      applySettingsUsersFacetFilter();
      window.gcTableSort?.bindTable(document.getElementById("settings-users-table"));
    }

    const lazy = window.gcTableLazy;
    tbody.innerHTML = "";
    if (!lazy || typeof lazy.appendBefore !== "function" || trList.length <= lazy.DEFAULT_THRESHOLD) {
      trList.forEach((tr) => tbody.appendChild(tr));
      finishSettingsUsersTable();
      return;
    }
    lazy.appendBefore(tbody, trList, null, {
      isCancelled: () => gen !== settingsUsersLoadGen,
      onComplete: finishSettingsUsersTable,
    });
  }

  function openUserEditProfileDialogFromRow(row, userId) {
    const d = document.getElementById("user-edit-profile-dialog");
    if (!d || !row) return;
    const cells = row.querySelectorAll("td");
    const readCell = (i) => (cells[i]?.textContent || "").replace("—", "").trim();
    document.getElementById("user-edit-profile-id").value = userId;
    document.getElementById("user-edit-profile-full-name").value = readCell(1);
    document.getElementById("user-edit-profile-email").value = readCell(2);
    document.getElementById("user-edit-profile-mobile").value = readCell(3);
    const st = document.getElementById("user-edit-profile-status");
    if (st) {
      st.textContent = "";
      st.classList.remove("is-error", "is-ok");
    }
    d.hidden = false;
    d.setAttribute("aria-hidden", "false");
    document.getElementById("user-edit-profile-full-name")?.focus();
  }

  function initSettingsModal() {
    bindSettingsUsersFacetAsideOnce();
    document.getElementById("settings-users-filters-toggle")?.addEventListener("click", () => {
      const aside = document.getElementById("settings-users-filters-aside");
      const collapsed = aside?.classList.contains("filters--collapsed");
      setSettingsUsersFiltersCollapsed(!collapsed);
    });
    document.getElementById("settings-users-facet-reset")?.addEventListener("click", () => {
      const d = document.getElementById("settings-users-filters-drawer");
      if (d && window.gcTableFacets) window.gcTableFacets.reset(d, "settings-users");
      updateSettingsUsersFacetChrome();
      applySettingsUsersFacetFilter();
    });
    document.getElementById("btn-settings")?.addEventListener("click", () => {
      if (!currentSessionUser) return;
      openSettingsModal();
    });
    document.getElementById("settings-modal-close")?.addEventListener("click", closeSettingsModal);
    document.querySelector("#settings-modal .settings-modal__backdrop")?.addEventListener("click", closeSettingsModal);
    document.getElementById("settings-nav")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-settings-section]");
      if (!btn || btn.id === "settings-nav-about") return;
      const sec = btn.getAttribute("data-settings-section");
      if (sec) setSettingsSection(sec);
    });
    document.getElementById("settings-nav-about")?.addEventListener("click", () => setSettingsSection("about"));
    document.getElementById("settings-nav-filter")?.addEventListener("input", filterSettingsNav);
    document.getElementById("settings-security-http-enabled")?.addEventListener("change", () => {
      syncSecurityFormControls();
      setSecurityStatus("", null);
    });
    document.getElementById("settings-security-https-enabled")?.addEventListener("change", () => {
      syncSecurityFormControls();
      setSecurityStatus("", null);
    });
    document.getElementById("settings-security-form")?.addEventListener("change", (e) => {
      const t = e.target;
      if (t && t.matches && t.matches('input[name="cert_method"]')) syncSecurityCertPanel();
    });
    document.getElementById("settings-security-form")?.addEventListener("submit", (e) => {
      submitSecuritySettings(e);
    });
    document.getElementById("settings-security-download-public-cert")?.addEventListener("click", () => {
      downloadSecurityTlsPublicCert().catch((err) =>
        setSecurityStatus(err.message || "Download failed.", "error"),
      );
    });
    document.getElementById("settings-security-gen-self-signed")?.addEventListener("click", async () => {
      const host = document.getElementById("settings-security-tls-hostname")?.value?.trim();
      if (!host) {
        setSecurityStatus("Enter a TLS hostname first.", "error");
        return;
      }
      try {
        const r = await apiRequestJson("/api/settings/security/generate-self-signed", {
          method: "POST",
          body: JSON.stringify({ hostname: host }),
        });
        renderSecurityCertificateSummary(r.certificate);
        syncSecurityFormControls();
        setSecurityStatus("Certificate generated.", "ok");
      } catch (err) {
        setSecurityStatus(err.message || "Could not generate certificate.", "error");
      }
    });
    document.getElementById("settings-security-fetch-le-http")?.addEventListener("click", () => {
      setSecurityStatus(
        "Let’s Encrypt HTTP-01 issuance will run on the server once this action is connected to the API.",
        "ok",
      );
    });
    document.getElementById("settings-security-dns-request")?.addEventListener("click", () => {
      const host =
        document.getElementById("settings-security-tls-hostname")?.value?.trim() || "your-hostname.example.com";
      const pre = document.getElementById("settings-security-dns-txt-placeholder");
      const hint = document.getElementById("settings-security-dns-txt-hint");
      if (pre) {
        pre.textContent = `_acme-challenge.${host}    TXT    \"<token-from-server>\"`;
      }
      if (hint) hint.hidden = false;
      setSecurityStatus(
        "After the server starts a real DNS-01 challenge, use the TXT name and value it returns at your DNS provider.",
        "ok",
      );
    });
    document.getElementById("settings-security-dns-verify")?.addEventListener("click", () => {
      setSecurityStatus(
        "Certificate issuance after DNS verification will run on the server once this action is connected to the API.",
        "ok",
      );
    });
    document.getElementById("settings-test-firewalls-add")?.addEventListener("click", () => {
      addTestFirewalls().catch((err) =>
        setTestFirewallsStatus(err.message || "Could not add test firewalls.", "error"),
      );
    });
    document.getElementById("settings-test-firewalls-cleanup")?.addEventListener("click", () => {
      cleanupTestFirewalls().catch((err) =>
        setTestFirewallsStatus(err.message || "Could not clean up test firewalls.", "error"),
      );
    });
    bindTestFwSourcePicker();
    syncSecurityFormControls();
    syncSecurityCertPanel();
    document.getElementById("btn-add-user")?.addEventListener("click", openUserFormDialog);
    document.getElementById("user-form-close")?.addEventListener("click", closeUserFormDialog);
    document.querySelector("#user-form-dialog .settings-subdialog__backdrop")?.addEventListener("click", closeUserFormDialog);
    document.getElementById("user-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("user-form-username")?.value?.trim() || "";
      const password = document.getElementById("user-form-password")?.value || "";
      const role = document.getElementById("user-form-role")?.value || "user";
      const full_name = document.getElementById("user-form-full-name")?.value?.trim() || "";
      const email = document.getElementById("user-form-email")?.value?.trim() || "";
      const mobile = document.getElementById("user-form-mobile")?.value?.trim() || "";
      const st = document.getElementById("user-form-status");
      const sub = document.getElementById("user-form-submit");
      if (sub) sub.disabled = true;
      try {
        await apiRequestJson("/api/settings/users", {
          method: "POST",
          body: JSON.stringify({ username, password, role, full_name, email, mobile }),
        });
        closeUserFormDialog();
        await loadSettingsUsers();
      } catch (err) {
        if (st) {
          st.textContent = err.message || "Could not create user.";
          st.classList.add("is-error");
        }
      } finally {
        if (sub) sub.disabled = false;
      }
    });
    document.getElementById("user-edit-profile-close")?.addEventListener("click", closeUserEditProfileDialog);
    document.querySelector("#user-edit-profile-dialog .settings-subdialog__backdrop")?.addEventListener("click", closeUserEditProfileDialog);
    document.getElementById("user-edit-profile-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("user-edit-profile-id")?.value?.trim() || "";
      const full_name = document.getElementById("user-edit-profile-full-name")?.value?.trim() ?? "";
      const email = document.getElementById("user-edit-profile-email")?.value?.trim() ?? "";
      const mobile = document.getElementById("user-edit-profile-mobile")?.value?.trim() ?? "";
      const st = document.getElementById("user-edit-profile-status");
      const sub = document.getElementById("user-edit-profile-submit");
      if (!id) return;
      if (sub) sub.disabled = true;
      try {
        const updated = await apiRequestJson(`/api/settings/users/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ full_name, email, mobile }),
        });
        if (updated && updated.id === currentSessionUser?.id) {
          currentSessionUser = { ...currentSessionUser, ...updated };
          applySessionUserToChrome();
        }
        closeUserEditProfileDialog();
        await loadSettingsUsers();
      } catch (err) {
        if (st) {
          st.textContent = err.message || "Could not save.";
          st.classList.add("is-error");
        }
      } finally {
        if (sub) sub.disabled = false;
      }
    });
    document.getElementById("settings-users-body")?.addEventListener("click", async (e) => {
      const profileBtn = e.target.closest("button.user-profile-btn");
      if (profileBtn) {
        const id = profileBtn.getAttribute("data-id");
        if (!id) return;
        const row = profileBtn.closest("tr");
        openUserEditProfileDialogFromRow(row, id);
        return;
      }
      const roleBtn = e.target.closest("button.user-role-btn");
      if (roleBtn) {
        const id = roleBtn.getAttribute("data-id");
        if (!id) return;
        const row = roleBtn.closest("tr");
        const current = row?.querySelector(".settings-user-cell--role")?.textContent?.trim() || "user";
        const choice = window.prompt(`Role for this user: type "admin" or "user"`, current);
        if (choice == null) return;
        const r = choice.trim().toLowerCase();
        if (r !== "admin" && r !== "user") {
          notify("Invalid role", 'Role must be "admin" or "user".');
          return;
        }
        try {
          await apiRequestJson(`/api/settings/users/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify({ role: r }),
          });
          await loadSettingsUsers();
          if (id === currentSessionUser?.id) {
            currentSessionUser = { ...currentSessionUser, role: r };
            applySettingsNavForRole();
            applySessionUserToChrome();
          }
        } catch (err) {
          notify("Could not update role", err.message || "");
        }
        return;
      }
      const pwBtn = e.target.closest("button.user-password-btn");
      if (pwBtn) {
        const id = pwBtn.getAttribute("data-id");
        if (!id) return;
        const pw = window.prompt("New password (min. 10 characters)");
        if (pw == null) return;
        if (pw.length < 10) {
          notify("Password too short", "Password must be at least 10 characters.");
          return;
        }
        try {
          await apiRequestJson(`/api/settings/users/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify({ password: pw }),
          });
          await loadSettingsUsers();
        } catch (err) {
          notify("Could not set password", err.message || "");
        }
        return;
      }
      const delBtn = e.target.closest("button.user-delete-btn");
      if (delBtn) {
        const id = delBtn.getAttribute("data-id");
        if (!id) return;
        if (!window.confirm("Remove this user? They will no longer be able to sign in.")) return;
        try {
          await apiRequestJson(`/api/settings/users/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          if (id === currentSessionUser?.id) {
            window.location.href = "/";
            return;
          }
          await loadSettingsUsers();
        } catch (err) {
          notify("Delete failed", err.message || "");
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initAuthForms();
    initUserMenu();
    initSettingsModal();
    bootAuth();
  });
})();
