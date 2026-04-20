(function () {
  "use strict";

  const DEFAULT_SESSION_IDLE_MINUTES = 60;
  let sessionIdleMinutes = DEFAULT_SESSION_IDLE_MINUTES;

  let currentSessionUser = null;
  let sessionIdleMs = 0;
  let lastUserActivityAt = 0;
  let lastKeepaliveSentAt = 0;
  let sessionIdleWatchdogTimer = null;
  let sessionIdleCountdownTimer = null;
  let sessionIdleListenersBound = false;
  const SESSION_IDLE_ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "wheel"];
  /** Abort in-flight ``/api/auth/activity`` so it cannot race logout and revive the session cookie. */
  let sessionActivityAbort = null;

  function getSessionActivitySignal() {
    if (!sessionActivityAbort || sessionActivityAbort.signal.aborted) {
      sessionActivityAbort = new AbortController();
    }
    return sessionActivityAbort.signal;
  }

  function abortSessionActivityKeepalives() {
    try {
      sessionActivityAbort?.abort();
    } catch {
      /* ignore */
    }
    sessionActivityAbort = null;
  }

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

  /** Elapsed time since ISO timestamp, e.g. "5 mins ago", "3 weeks ago". */
  function formatUserRelativeTime(iso) {
    if (!iso) return "—";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "—";
    const diffSec = Math.floor((Date.now() - then) / 1000);
    if (diffSec < 45) return "just now";
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
    }
    if (days < 365) {
      const months = Math.floor(days / 30);
      const m = Math.max(1, months);
      return `${m} month${m === 1 ? "" : "s"} ago`;
    }
    const years = Math.floor(days / 365);
    const y = Math.max(1, years);
    return `${y} year${y === 1 ? "" : "s"} ago`;
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
    window.gcAlert([title, message].filter(Boolean).join("\n"));
  }

  function stopSessionIdleWatch() {
    if (sessionIdleWatchdogTimer != null) {
      clearInterval(sessionIdleWatchdogTimer);
      sessionIdleWatchdogTimer = null;
    }
    if (sessionIdleCountdownTimer != null) {
      clearInterval(sessionIdleCountdownTimer);
      sessionIdleCountdownTimer = null;
    }
    sessionIdleMs = 0;
    updateSessionIdleCountdownTab();
  }

  function onSessionUserActivity() {
    lastUserActivityAt = Date.now();
    updateSessionIdleCountdownTab();
    maybeSendSessionKeepalive();
  }

  function updateSessionIdleCountdownTab() {
    const tab = document.getElementById("user-menu-idle-countdown");
    if (!tab) return;
    if (!currentSessionUser || sessionIdleMs <= 0 || lastUserActivityAt <= 0) {
      tab.hidden = true;
      tab.textContent = "";
      tab.removeAttribute("title");
      tab.classList.remove("user-menu__idle-countdown--urgent");
      return;
    }
    const remainingMs = Math.max(0, sessionIdleMs - (Date.now() - lastUserActivityAt));
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const label = remainingSeconds > 60 ? `${Math.ceil(remainingSeconds / 60)}m` : `${remainingSeconds}s`;
    const name =
      String(currentSessionUser.full_name || "").trim() ||
      String(currentSessionUser.username || "").trim() ||
      "User";
    const role = appRoleDisplay(currentSessionUser.role);
    tab.textContent = `${name} | ${role} | ${label}`;
    tab.title = `${name} | ${role} | Automatic logout in ${remainingSeconds > 60 ? `${Math.ceil(remainingSeconds / 60)} minutes` : `${remainingSeconds} seconds`}`;
    tab.classList.toggle("user-menu__idle-countdown--urgent", remainingSeconds < 60);
    tab.hidden = false;
  }

  function maybeSendSessionKeepalive() {
    if (!currentSessionUser || sessionIdleMs <= 0) return;
    const now = Date.now();
    if (now - lastKeepaliveSentAt < 45000) return;
    lastKeepaliveSentAt = now;
    fetch("/api/auth/activity", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: getSessionActivitySignal(),
    }).then((r) => {
      if (r.status === 401) handleSessionExpired("Signed out due to inactivity.").catch(() => {});
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
    sessionIdleWatchdogTimer = globalThis.setInterval(() => {
      if (!currentSessionUser || sessionIdleMs <= 0) return;
      if (Date.now() - lastUserActivityAt >= sessionIdleMs) {
        handleSessionExpired("Signed out due to inactivity.").catch(() => {});
      }
    }, 1000);
    updateSessionIdleCountdownTab();
    sessionIdleCountdownTimer = globalThis.setInterval(updateSessionIdleCountdownTab, 1000);
  }

  function restartSessionIdleWatchIfAuthenticated() {
    stopSessionIdleWatch();
    startSessionIdleWatch();
  }

  const APP_ROLES = [
    { value: "admin", label: "Admin" },
    { value: "SuperAdmin", label: "SuperAdmin" },
    { value: "ReadOnly", label: "ReadOnly" },
    { value: "Designer", label: "Designer" },
  ];

  function normalizeAppRole(role) {
    const key = String(role || "").trim().toLowerCase();
    if (key === "admin" || key === "administrator") return "admin";
    if (key === "superadmin" || key === "super admin") return "SuperAdmin";
    if (key === "readonly" || key === "read only" || key === "user") return "ReadOnly";
    if (key === "designer") return "Designer";
    return String(role || "").trim();
  }

  function isAdminRole(role) {
    const r = normalizeAppRole(role);
    return r === "admin" || r === "SuperAdmin";
  }

  function isDesignerRole(role) {
    const r = normalizeAppRole(role);
    return r === "Designer" || r === "SuperAdmin";
  }

  function isAdmin() {
    return isAdminRole(currentSessionUser?.role);
  }

  async function handleSessionExpired(message) {
    abortSessionActivityKeepalives();
    stopSessionIdleWatch();
    currentSessionUser = null;
    const btnUser = document.getElementById("btn-user-menu");
    if (btnUser) btnUser.hidden = true;
    stopActiveAdminsPoller();
    stopAdminChatsPoller();
    closeUserDropdown();
    closeActiveAdminsDialog();
    closeAdminChatFlyout();
    closeAdminLogoutWarning();
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
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } catch {
      /* still show login gate; session may already be invalid */
    }
    showLoginGate(message || "Session expired. Sign in again.");
  }

  async function loadJson(url) {
    const r = await fetch(url, { credentials: "same-origin" });
    if (r.status === 401) {
      await handleSessionExpired();
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
      await handleSessionExpired();
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
    const r = normalizeAppRole(role);
    const found = APP_ROLES.find((item) => item.value === r);
    return found ? found.label : role ? String(role) : "—";
  }

  function appRoleOptionsHtml(selectedRole) {
    const selected = normalizeAppRole(selectedRole);
    return APP_ROLES.map((role) => {
      const sel = role.value === selected ? " selected" : "";
      return `<option value="${escapeHtml(role.value)}"${sel}>${escapeHtml(role.label)}</option>`;
    }).join("");
  }

  function applyDesignerNavForRole() {
    const show = isDesignerRole(currentSessionUser?.role);
    document
      .querySelectorAll('[data-top-nav="designer"], [data-top-nav="firewalls-v2"]')
      .forEach((el) => {
        el.hidden = !show;
      });
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
    applyDesignerNavForRole();
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
    startActiveAdminsPoller();
    startAdminChatsPoller();
    if (typeof globalThis.gcRefreshTaskQueueBadge === "function") {
      globalThis.gcRefreshTaskQueueBadge();
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
      typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* After whole split fade (delay ~0.92s + duration ~0.52s) */
    const delay = reduce ? 0 : 1500;
    globalThis.setTimeout(() => {
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
    stopActiveAdminsPoller();
    stopAdminChatsPoller();
    const overlay = document.getElementById("auth-overlay");
    const title = document.getElementById("auth-overlay-title");
    const sub = document.getElementById("auth-overlay-subtitle");
    const setup = document.getElementById("auth-setup-block");
    const login = document.getElementById("auth-login-block");
    const lead = document.getElementById("auth-setup-lead");
    if (!overlay || !setup || !login) return;
    const u = (defaultAdminUsername != null && String(defaultAdminUsername).trim()
      ? String(defaultAdminUsername).trim()
      : "admin");
    if (lead) {
      lead.innerHTML = `This is your first sign-in. Set a password for the <strong>${escapeHtml(u)}</strong> administrator account. Minimum 10 characters. Afterwards you will sign in with that username and password. You can add more local accounts later in <strong>Settings</strong>.`;
    }
    if (title) {
      title.textContent = "Set administrator password";
      title.hidden = false;
    }
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
    hideAuthBootstrapLoading();
    scheduleAuthGateFocus();
  }

  function showLoginGate(prefillMessage) {
    const btnUserEarly = document.getElementById("btn-user-menu");
    if (btnUserEarly) btnUserEarly.hidden = true;
    stopActiveAdminsPoller();
    stopAdminChatsPoller();
    const overlay = document.getElementById("auth-overlay");
    const title = document.getElementById("auth-overlay-title");
    const sub = document.getElementById("auth-overlay-subtitle");
    const setup = document.getElementById("auth-setup-block");
    const login = document.getElementById("auth-login-block");
    if (!overlay || !setup || !login) return;
    if (title) {
      title.textContent = "Sign in";
      title.hidden = false;
    }
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
    hideAuthBootstrapLoading();
    scheduleAuthGateFocus();
  }

  function initNeedsAdminPasswordSetup(init) {
    const v = init && init.needs_admin_password_setup;
    return v === true || v === "true" || v === 1;
  }

  async function bootAuth() {
    const init = globalThis.GC_INITIAL_AUTH || {};
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
      if (!r.ok) {
        throw new Error(`auth status ${r.status}`);
      }
      let st;
      try {
        st = await r.json();
      } catch {
        throw new Error("auth status bad json");
      }
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
      /* Page HTML already reflected server-side auth state; keep setup gate if API cannot be reached. */
      if (initNeedsAdminPasswordSetup(init)) {
        showSetupGate(init.default_admin_username);
        const stEl = document.getElementById("auth-setup-status");
        if (stEl) {
          stEl.textContent =
            "Could not reach the server to refresh status. You can still set your password below; if this keeps happening, check the URL, proxy, or TLS settings.";
          stEl.classList.add("is-error");
          stEl.classList.remove("is-ok");
        }
        return;
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
        globalThis.location.reload();
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
        globalThis.location.reload();
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
  let activeAdminsPollTimer = null;
  let activeAdminsKnownKeys = null;
  let activeAdminsPulseTimer = null;
  let adminChatsRows = [];
  let adminChatsPollTimer = null;
  let adminChatToast = null;
  const adminChatToastDismissedIds = new Set();
  let activeAdminChatId = "";
  let adminChatFlyoutOpen = false;
  let activeAdminLogoutChallenge = null;
  let adminLogoutCountdownTimer = null;
  let lastActiveAdminsFetchAt = 0;
  const ACTIVE_ADMINS_POLL_MS = 10000;
  const ADMIN_CHATS_POLL_MS = 4000;

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
    document.getElementById("user-menu-admin-chats")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-admin-chat-id]");
      if (!btn) return;
      e.preventDefault();
      const chatId = btn.dataset.adminChatId || "";
      const chat = adminChatsRows.find((c) => c.chat_id === chatId);
      if (chat) {
        closeUserDropdown();
        openAdminChatFlyout(chat);
      }
    });
    document.getElementById("active-admins-close")?.addEventListener("click", closeActiveAdminsDialog);
    document.querySelector("#active-admins-dialog .settings-subdialog__backdrop")?.addEventListener("click", closeActiveAdminsDialog);
    document.getElementById("active-admins-body")?.addEventListener("click", (e) => {
      const logoutBtn = e.target.closest("button[data-admin-logout-peer]");
      if (logoutBtn) {
        e.preventDefault();
        requestAdminLogout(logoutBtn.dataset.adminLogoutPeer || "").catch((err) => {
          setActiveAdminsStatus(err?.message || "Could not request logout.", true);
        });
        return;
      }
      const btn = e.target.closest("button[data-admin-chat-peer]");
      if (!btn) return;
      e.preventDefault();
      startAdminChat(btn.dataset.adminChatPeer || "").catch((err) => {
        setActiveAdminsStatus(err?.message || "Could not start chat.", true);
      });
    });
    document.getElementById("admin-chat-close")?.addEventListener("click", closeAdminChatFlyout);
    document.querySelector("#admin-chat-flyout .admin-chat-flyout__backdrop")?.addEventListener("click", closeAdminChatFlyout);
    document.getElementById("admin-chat-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      sendActiveAdminChatMessage().catch((err) => {
        setAdminChatStatus(err?.message || "Could not send message.", true);
      });
    });
    document.getElementById("admin-chat-input")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) {
        globalThis.setTimeout(resizeAdminChatInput, 0);
        return;
      }
      e.preventDefault();
      document.getElementById("admin-chat-form")?.requestSubmit();
    });
    document.getElementById("admin-chat-input")?.addEventListener("input", resizeAdminChatInput);
    bindAdminChatFlyoutResize();
    document.getElementById("admin-logout-warning-still-here")?.addEventListener("click", () => {
      respondStillHereToAdminLogout().catch((err) => {
        const st = document.getElementById("admin-logout-warning-status");
        if (st) {
          st.textContent = err?.message || "Could not respond.";
          st.classList.add("is-error");
        }
      });
    });
    document.getElementById("user-menu-logout")?.addEventListener("click", async () => {
      try {
        await apiRequestJson("/api/auth/logout", { method: "POST" });
      } catch {
        /* still sign out locally */
      }
      currentSessionUser = null;
      trigger.hidden = true;
      stopActiveAdminsPoller();
      stopAdminChatsPoller();
      closeUserDropdown();
      closeActiveAdminsDialog();
      closeAdminChatFlyout();
      closeAdminLogoutWarning();
      globalThis.location.href = "/";
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
    const rolesNav = document.getElementById("settings-nav-roles");
    if (rolesNav) rolesNav.hidden = !admin;
    const leNav = document.getElementById("settings-nav-letsencrypt");
    if (leNav) leNav.hidden = !admin;
    const testNav = document.getElementById("settings-nav-test");
    if (testNav) testNav.hidden = !admin;
    const dmNav = document.getElementById("settings-nav-data-management");
    if (dmNav) dmNav.hidden = !admin;
    const backupNav = document.getElementById("settings-nav-backup");
    if (backupNav) backupNav.hidden = !admin;
    const activePanel = document.querySelector("#settings-modal .settings-panel.is-active");
    const adminOnlyPanel =
      activePanel?.dataset?.settingsPanel === "security" ||
      activePanel?.dataset?.settingsPanel === "roles" ||
      activePanel?.dataset?.settingsPanel === "letsencrypt" ||
      activePanel?.dataset?.settingsPanel === "test" ||
      activePanel?.dataset?.settingsPanel === "data-management" ||
      activePanel?.dataset?.settingsPanel === "backup";
    if (!admin && adminOnlyPanel) {
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
      tbody.innerHTML = '<tr><td colspan="6" class="muted active-admins-dialog__empty">No users are currently active.</td></tr>';
      return;
    }
    const now = Date.now();
    tbody.innerHTML = activeAdminsRows
      .map((row) => {
        const displayName = escapeHtml(row.display_name || row.username || row.user_id || "—");
        const role = escapeHtml(appRoleDisplay(row.role));
        const ipAddr = escapeHtml(row.client_ip || "—");
        const loggedIn = fmtDate(row.logged_in_at);
        const lastActivity = fmtDate(row.last_activity_at);
        const idleSecs =
          row.last_activity_at && !Number.isNaN(new Date(row.last_activity_at).getTime())
            ? Math.max(0, Math.floor((now - new Date(row.last_activity_at).getTime()) / 1000))
            : Number(row.last_activity_seconds_ago || 0);
        const currentTag = row.is_current
          ? '<span class="active-admins-dialog__me-pill" aria-label="This is your session">ME</span>'
          : "";
        const chatIcon = window.gcIcon ? window.gcIcon("chat", { size: "xs" }) : "";
        const logoutIcon = window.gcIcon ? window.gcIcon("logout", { size: "xs" }) : "";
        const chatButton = row.is_current
          ? ""
          : `<button type="button" class="active-admins-dialog__chat-btn" data-admin-chat-peer="${escapeHtml(row.session_id || "")}" aria-label="Message ${displayName}" title="Message ${displayName}">
              ${chatIcon}
            </button>`;
        const logoutButton = row.is_current
          ? ""
          : `<button type="button" class="active-admins-dialog__logout-btn" data-admin-logout-peer="${escapeHtml(row.session_id || "")}" aria-label="Request logout for ${displayName}" title="Request logout">
              ${logoutIcon}
            </button>`;
        return `<tr>
          <td><span class="active-admins-dialog__admin-name">${displayName}</span>${chatButton}${logoutButton}</td>
          <td>${role}</td>
          <td>${ipAddr}</td>
          <td>${loggedIn}</td>
          <td>${lastActivity}</td>
          <td>${escapeHtml(formatDuration(idleSecs))} ago${currentTag}</td>
        </tr>`;
      })
      .join("");
  }

  function updateActiveAdminCountBadge(count) {
    const countEl = document.getElementById("user-menu-active-admin-count");
    if (!countEl) return;
    const n = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0;
    countEl.textContent = String(n);
    countEl.classList.toggle("user-menu__session-count--active-admins", n >= 2);
  }

  function activeAdminSessionKey(row) {
    return [
      row?.user_id,
      row?.username,
      row?.client_ip,
      row?.logged_in_at,
    ]
      .map((v) => String(v || "").trim())
      .join("|");
  }

  function setActiveAdminsIndicator(count) {
    const trigger = document.getElementById("btn-user-menu");
    if (!trigger) return;
    const n = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0;
    trigger.classList.toggle("user-menu__trigger--active-admins", n >= 2);
  }

  function pulseActiveAdminsIndicator() {
    const trigger = document.getElementById("btn-user-menu");
    if (!trigger) return;
    if (activeAdminsPulseTimer != null) {
      clearTimeout(activeAdminsPulseTimer);
      activeAdminsPulseTimer = null;
    }
    trigger.classList.remove("user-menu__trigger--admin-login-pulse");
    void trigger.offsetWidth;
    trigger.classList.add("user-menu__trigger--admin-login-pulse");
    activeAdminsPulseTimer = globalThis.setTimeout(() => {
      trigger.classList.remove("user-menu__trigger--admin-login-pulse");
      activeAdminsPulseTimer = null;
    }, 10000);
  }

  function applyActiveAdminsPayload(payload, { notifyNew = false } = {}) {
    const rows = Array.isArray(payload?.admins) ? payload.admins : [];
    const count = Number.isFinite(Number(payload?.count)) ? Number(payload.count) : rows.length;
    const nextKeys = new Set(rows.map(activeAdminSessionKey).filter(Boolean));
    if (notifyNew && activeAdminsKnownKeys && count >= 2) {
      const hasNewSession = [...nextKeys].some((key) => !activeAdminsKnownKeys.has(key));
      if (hasNewSession) pulseActiveAdminsIndicator();
    }
    activeAdminsKnownKeys = nextKeys;
    activeAdminsRows = rows;
    updateActiveAdminCountBadge(count);
    setActiveAdminsIndicator(count);
    if (activeAdminsDialogOpen) renderActiveAdminsTable();
  }

  function speechBubbleSvg(size = 16) {
    var sz = "xs";
    if (size >= 28) sz = "xl";
    else if (size >= 24) sz = "lg";
    else if (size >= 20) sz = "md";
    else if (size >= 18) sz = "sm";
    return window.gcIcon ? window.gcIcon("chat", { size: sz }) : "";
  }

  function setAdminChatStatus(message, isError) {
    const st = document.getElementById("admin-chat-status");
    if (!st) return;
    st.textContent = message || "";
    st.classList.toggle("is-error", !!isError);
  }

  function renderAdminChatMenu() {
    const list = document.getElementById("user-menu-admin-chats");
    if (!list) return;
    if (!Array.isArray(adminChatsRows) || adminChatsRows.length === 0) {
      list.hidden = true;
      list.innerHTML = "";
      return;
    }
    list.hidden = false;
    list.innerHTML = adminChatsRows
      .map((chat) => {
        const unread = Number(chat.unread_count || 0);
        const peer = escapeHtml(chat.peer_display_name || "Admin");
        const unreadBadge = unread > 0 ? `<span class="user-menu__chat-unread">${unread}</span>` : "";
        return `<button type="button" class="user-menu__chat-link${unread > 0 ? " user-menu__chat-link--unread" : ""}" data-admin-chat-id="${escapeHtml(chat.chat_id || "")}">
          <span class="user-menu__chat-icon">${speechBubbleSvg(15)}</span>
          <span class="user-menu__chat-name">${peer}</span>
          ${unreadBadge}
        </button>`;
      })
      .join("");
  }

  function renderAdminChatMessages(chat) {
    const wrap = document.getElementById("admin-chat-messages");
    const title = document.getElementById("admin-chat-title");
    if (title) title.textContent = chat?.peer_display_name ? `Message ${chat.peer_display_name}` : "Message admin";
    if (!wrap) return;
    const messages = Array.isArray(chat?.messages) ? chat.messages : [];
    if (messages.length === 0) {
      wrap.innerHTML = '<p class="admin-chat-flyout__empty muted">No messages yet.</p>';
      return;
    }
    wrap.replaceChildren(
      ...messages.map((msg) => {
        const bubble = document.createElement("div");
        bubble.className = `admin-chat-flyout__bubble ${
          msg.is_mine ? "admin-chat-flyout__bubble--mine" : "admin-chat-flyout__bubble--theirs"
        }`;
        const body = document.createElement("div");
        body.className = "admin-chat-flyout__bubble-text";
        body.textContent = msg.body || "";
        const sent = document.createElement("div");
        sent.className = "admin-chat-flyout__bubble-time";
        sent.textContent = fmtDate(msg.sent_at);
        bubble.append(body, sent);
        return bubble;
      })
    );
    wrap.scrollTop = wrap.scrollHeight;
  }

  function resizeAdminChatInput() {
    const input = document.getElementById("admin-chat-input");
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 104)}px`;
  }

  function bindAdminChatFlyoutResize() {
    const root = document.getElementById("admin-chat-flyout");
    const panel = root?.querySelector(".admin-chat-flyout__panel");
    const handle = root?.querySelector(".admin-chat-flyout__resize");
    if (!root || !panel || !handle || handle.dataset.adminChatResizeBound === "1") return;
    handle.dataset.adminChatResizeBound = "1";
    handle.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = panel.getBoundingClientRect().width;
      const maxW = Math.max(320, globalThis.innerWidth - 24);
      const minW = Math.min(320, maxW);
      function onMove(e2) {
        const w = Math.max(minW, Math.min(maxW, startW + (startX - e2.clientX)));
        panel.style.width = `${w}px`;
      }
      function onUp() {
        document.body.style.cursor = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }
      document.body.style.cursor = "ew-resize";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function setAdminChatAlert(unreadCount) {
    const n = Number.isFinite(Number(unreadCount)) ? Math.max(0, Math.floor(Number(unreadCount))) : 0;
    const activeUnread = n > 0 && !adminChatFlyoutOpen;
    const trigger = document.getElementById("btn-user-menu");
    trigger?.classList.toggle("user-menu__trigger--chat-alert", activeUnread);
    document.getElementById("user-menu-admin-chats")?.classList.toggle("user-menu__chat-list--alert", activeUnread);
  }

  function ensureAdminChatToast() {
    let toast = document.getElementById("admin-chat-toast");
    if (toast) return toast;
    toast = document.createElement("div");
    toast.id = "admin-chat-toast";
    toast.className = "admin-chat-toast";
    toast.hidden = true;
    toast.innerHTML = `<button type="button" class="admin-chat-toast__body">
      <span class="admin-chat-toast__icon">${speechBubbleSvg(15)}</span>
      <span class="admin-chat-toast__text"></span>
    </button>
    <button type="button" class="admin-chat-toast__close" aria-label="Dismiss message" title="Dismiss">×</button>`;
    toast.querySelector(".admin-chat-toast__body")?.addEventListener("click", () => {
      const chat = adminChatsRows.find((row) => row.chat_id === adminChatToast?.chatId);
      hideAdminChatToast();
      if (chat) {
        closeUserDropdown();
        openAdminChatFlyout(chat);
      }
    });
    toast.querySelector(".admin-chat-toast__close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (adminChatToast?.messageId) adminChatToastDismissedIds.add(adminChatToast.messageId);
      hideAdminChatToast();
    });
    document.body.appendChild(toast);
    return toast;
  }

  function positionAdminChatToast(toast) {
    const trigger = document.getElementById("btn-user-menu");
    if (!trigger || !toast) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, Math.max(240, globalThis.innerWidth - 24));
    toast.style.width = `${width}px`;
    toast.style.top = `${Math.max(0, rect.bottom + 8)}px`;
    toast.style.left = `${Math.min(Math.max(12, rect.right - width), globalThis.innerWidth - width - 12)}px`;
  }

  function showAdminChatToast(chat, msg) {
    if (adminChatFlyoutOpen || !chat || !msg?.id) return;
    const toast = ensureAdminChatToast();
    const sender = chat.peer_display_name || msg.sender_display_name || "Admin";
    const text = String(msg.body || "").trim();
    const textWrap = toast.querySelector(".admin-chat-toast__text");
    if (textWrap) {
      const senderEl = document.createElement("strong");
      senderEl.textContent = sender;
      const messageEl = document.createElement("span");
      messageEl.textContent = text;
      textWrap.replaceChildren(senderEl, messageEl);
    }
    adminChatToast = { chatId: chat.chat_id, messageId: msg.id };
    positionAdminChatToast(toast);
    toast.hidden = false;
  }

  function hideAdminChatToast() {
    const toast = document.getElementById("admin-chat-toast");
    if (toast) toast.hidden = true;
    adminChatToast = null;
  }

  function newestUnreadIncomingMessage(chat) {
    if (!chat || Number(chat.unread_count || 0) <= 0) return null;
    const messages = Array.isArray(chat.messages) ? chat.messages : [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (!msg?.is_mine && msg.id) return msg;
    }
    return null;
  }

  function updateAdminChatToast() {
    if (adminChatFlyoutOpen) {
      hideAdminChatToast();
      return;
    }
    const chat = adminChatsRows.find((row) => Number(row.unread_count || 0) > 0);
    const msg = newestUnreadIncomingMessage(chat);
    if (!chat || !msg || adminChatToastDismissedIds.has(msg.id)) {
      if (adminChatToast && (!msg || adminChatToast.messageId !== msg.id)) hideAdminChatToast();
      return;
    }
    if (adminChatToast?.messageId !== msg.id) showAdminChatToast(chat, msg);
    else positionAdminChatToast(document.getElementById("admin-chat-toast"));
  }

  function applyAdminChatsPayload(payload) {
    adminChatsRows = Array.isArray(payload?.chats) ? payload.chats : [];
    renderAdminChatMenu();
    const active = adminChatsRows.find((chat) => chat.chat_id === activeAdminChatId);
    if (adminChatFlyoutOpen) {
      if (active) {
        renderAdminChatMessages(active);
        markActiveAdminChatRead().catch(() => {});
      } else {
        closeAdminChatFlyout();
      }
    }
    setAdminChatAlert(payload?.unread_count || 0);
    updateAdminChatToast();
    applyAdminLogoutChallenges(payload?.logout_challenges || []);
  }

  function applyAdminLogoutChallenges(challenges) {
    const rows = Array.isArray(challenges) ? challenges : [];
    if (!rows.length) {
      if (activeAdminLogoutChallenge) closeAdminLogoutWarning();
      return;
    }
    const next = rows[0];
    if (!activeAdminLogoutChallenge || activeAdminLogoutChallenge.id !== next.id) {
      openAdminLogoutWarning(next);
      return;
    }
    activeAdminLogoutChallenge = next;
    updateAdminLogoutCountdown();
  }

  function openAdminLogoutWarning(challenge) {
    const d = document.getElementById("admin-logout-warning-dialog");
    if (!d) return;
    activeAdminLogoutChallenge = challenge;
    d.hidden = false;
    d.setAttribute("aria-hidden", "false");
    const req = document.getElementById("admin-logout-warning-requester");
    if (req) req.textContent = challenge.requester_display_name ? `Requested by ${challenge.requester_display_name}.` : "";
    const st = document.getElementById("admin-logout-warning-status");
    if (st) {
      st.textContent = "";
      st.classList.remove("is-error", "is-ok");
    }
    updateAdminLogoutCountdown();
    if (adminLogoutCountdownTimer != null) clearInterval(adminLogoutCountdownTimer);
    adminLogoutCountdownTimer = globalThis.setInterval(updateAdminLogoutCountdown, 500);
    document.getElementById("admin-logout-warning-still-here")?.focus();
  }

  function closeAdminLogoutWarning() {
    const d = document.getElementById("admin-logout-warning-dialog");
    activeAdminLogoutChallenge = null;
    if (adminLogoutCountdownTimer != null) {
      clearInterval(adminLogoutCountdownTimer);
      adminLogoutCountdownTimer = null;
    }
    if (d) {
      d.hidden = true;
      d.setAttribute("aria-hidden", "true");
    }
  }

  function adminLogoutSecondsRemaining() {
    if (!activeAdminLogoutChallenge?.deadline_at) return 0;
    const deadline = new Date(activeAdminLogoutChallenge.deadline_at).getTime();
    if (Number.isNaN(deadline)) return 0;
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  }

  function updateAdminLogoutCountdown() {
    const n = adminLogoutSecondsRemaining();
    const el = document.getElementById("admin-logout-warning-seconds");
    if (el) el.textContent = String(n);
    if (n <= 0 && activeAdminLogoutChallenge?.id) {
      completeAdminLogoutChallenge(activeAdminLogoutChallenge.id).catch(() => {
        handleSessionExpired("Signed out by administrator request.");
      });
    }
  }

  async function requestAdminLogout(peerSessionId) {
    const peer = String(peerSessionId || "").trim();
    if (!peer) return;
    await apiRequestJson("/api/auth/admin-logout-requests", {
      method: "POST",
      body: JSON.stringify({ target_session_id: peer }),
    });
    setActiveAdminsStatus("Logout warning sent.", false);
  }

  async function respondStillHereToAdminLogout() {
    const id = activeAdminLogoutChallenge?.id;
    if (!id) return;
    await apiRequestJson(`/api/auth/admin-logout-requests/${encodeURIComponent(id)}/still-here`, {
      method: "POST",
    });
    closeAdminLogoutWarning();
    await fetchAdminChats().catch(() => {});
  }

  async function completeAdminLogoutChallenge(id) {
    await apiRequestJson(`/api/auth/admin-logout-requests/${encodeURIComponent(id)}/logout`, {
      method: "POST",
    });
    closeAdminLogoutWarning();
    currentSessionUser = null;
    handleSessionExpired("Signed out by administrator request.");
  }

  async function fetchAdminChats() {
    const payload = await apiRequestJson("/api/auth/admin-chats", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    applyAdminChatsPayload(payload || {});
  }

  function startAdminChatsPoller() {
    stopAdminChatsPoller();
    if (!currentSessionUser) return;
    fetchAdminChats().catch(() => {});
    adminChatsPollTimer = globalThis.setInterval(() => {
      if (!currentSessionUser) return;
      fetchAdminChats().catch(() => {});
    }, ADMIN_CHATS_POLL_MS);
  }

  function stopAdminChatsPoller() {
    if (adminChatsPollTimer != null) {
      clearInterval(adminChatsPollTimer);
      adminChatsPollTimer = null;
    }
    adminChatsRows = [];
    activeAdminChatId = "";
    adminChatFlyoutOpen = false;
    renderAdminChatMenu();
    setAdminChatAlert(0);
    hideAdminChatToast();
  }

  async function startAdminChat(peerSessionId) {
    const peer = String(peerSessionId || "").trim();
    if (!peer) return;
    const payload = await apiRequestJson("/api/auth/admin-chats", {
      method: "POST",
      body: JSON.stringify({ peer_session_id: peer }),
    });
    const chat = payload?.chat;
    if (chat) {
      await fetchAdminChats().catch(() => {});
      closeActiveAdminsDialog();
      openAdminChatFlyout(chat);
    }
  }

  function openAdminChatFlyout(chat) {
    if (!chat?.chat_id) return;
    const flyout = document.getElementById("admin-chat-flyout");
    if (!flyout) return;
    activeAdminChatId = chat.chat_id;
    adminChatFlyoutOpen = true;
    flyout.hidden = false;
    flyout.setAttribute("aria-hidden", "false");
    setAdminChatStatus("", false);
    renderAdminChatMessages(chat);
    setAdminChatAlert(0);
    hideAdminChatToast();
    markActiveAdminChatRead().catch(() => {});
    resizeAdminChatInput();
    document.getElementById("admin-chat-input")?.focus();
  }

  function closeAdminChatFlyout() {
    const flyout = document.getElementById("admin-chat-flyout");
    adminChatFlyoutOpen = false;
    activeAdminChatId = "";
    if (flyout) {
      flyout.hidden = true;
      flyout.setAttribute("aria-hidden", "true");
    }
    const unread = adminChatsRows.reduce((acc, chat) => acc + Number(chat.unread_count || 0), 0);
    setAdminChatAlert(unread);
    updateAdminChatToast();
  }

  async function markActiveAdminChatRead() {
    if (!activeAdminChatId) return;
    const payload = await apiRequestJson(`/api/auth/admin-chats/${encodeURIComponent(activeAdminChatId)}/read`, {
      method: "POST",
    });
    const chat = payload?.chat;
    if (!chat) return;
    adminChatsRows = adminChatsRows.map((row) => (row.chat_id === chat.chat_id ? chat : row));
    renderAdminChatMenu();
    renderAdminChatMessages(chat);
    setAdminChatAlert(0);
    hideAdminChatToast();
  }

  async function sendActiveAdminChatMessage() {
    const input = document.getElementById("admin-chat-input");
    const msg = String(input?.value || "").trim();
    if (!activeAdminChatId || !msg) return;
    const payload = await apiRequestJson(`/api/auth/admin-chats/${encodeURIComponent(activeAdminChatId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ message: msg }),
    });
    if (input) input.value = "";
    resizeAdminChatInput();
    const chat = payload?.chat;
    if (chat) {
      adminChatsRows = adminChatsRows.some((row) => row.chat_id === chat.chat_id)
        ? adminChatsRows.map((row) => (row.chat_id === chat.chat_id ? chat : row))
        : [chat, ...adminChatsRows];
      renderAdminChatMenu();
      renderAdminChatMessages(chat);
      setAdminChatStatus("", false);
    }
  }

  async function fetchActiveAdmins({ force = false } = {}) {
    const now = Date.now();
    if (!force && now - lastActiveAdminsFetchAt < 20000) return;
    lastActiveAdminsFetchAt = now;
    const payload = await apiRequestJson("/api/auth/active-admin-sessions", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    applyActiveAdminsPayload(payload, { notifyNew: force });
  }

  function stopActiveAdminsPoller() {
    if (activeAdminsPollTimer != null) {
      clearInterval(activeAdminsPollTimer);
      activeAdminsPollTimer = null;
    }
    if (activeAdminsPulseTimer != null) {
      clearTimeout(activeAdminsPulseTimer);
      activeAdminsPulseTimer = null;
    }
    activeAdminsKnownKeys = null;
    setActiveAdminsIndicator(0);
    updateActiveAdminCountBadge(0);
    document.getElementById("btn-user-menu")?.classList.remove("user-menu__trigger--admin-login-pulse");
  }

  function startActiveAdminsPoller() {
    stopActiveAdminsPoller();
    if (!currentSessionUser) return;
    fetchActiveAdmins({ force: true }).catch(() => {
      setActiveAdminsIndicator(0);
    });
    activeAdminsPollTimer = globalThis.setInterval(() => {
      if (!currentSessionUser) return;
      fetchActiveAdmins({ force: true }).catch(() => {
        /* Keep the last known dot state on transient failures. */
      });
    }, ACTIVE_ADMINS_POLL_MS);
  }

  function stopActiveAdminsTicker() {
    if (activeAdminsTickTimer != null) {
      clearInterval(activeAdminsTickTimer);
      activeAdminsTickTimer = null;
    }
  }

  function startActiveAdminsTicker() {
    stopActiveAdminsTicker();
    activeAdminsTickTimer = globalThis.setInterval(() => {
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
    stopLetsEncryptQueuePoll();
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

  function securityExternalSettingsTooltip(info) {
    if (!info) return "";
    const env = !!info.from_environment;
    const dock = !!info.from_docker_secret;
    const restart =
      "Saving a different value here updates the on-disk settings file only. After you restart the application, any matching environment variable or Docker Compose / Swarm secret is merged in again and can overwrite what you saved—so the running service may ignore your edit.";
    if (env && dock) {
      return (
        "This field is set from an environment variable and/or a Docker secret (for example under /run/secrets). " +
        restart
      );
    }
    if (dock) {
      return "This field is supplied from a Docker secret (for example under /run/secrets). " + restart;
    }
    return "This field is set from an environment variable. " + restart;
  }

  function applySecurityFieldSourceWarnings(sources) {
    if (!sources) return;
    document.querySelectorAll("[data-security-field-source]").forEach((el) => {
      const key = el.dataset.securityFieldSource;
      const row = key ? sources[key] : null;
      const warn = !!(row && (row.from_environment || row.from_docker_secret));
      el.hidden = !warn;
      if (warn) {
        const t = securityExternalSettingsTooltip(row);
        el.setAttribute("title", t);
        el.setAttribute("aria-label", t);
      } else {
        el.removeAttribute("title");
        el.setAttribute("aria-label", "");
      }
    });
  }

  function setSecurityStatus(message, kind) {
    const st = document.getElementById("settings-security-status");
    if (!st) return;
    st.textContent = message || "";
    st.classList.remove("is-error", "is-ok");
    if (kind === "error") st.classList.add("is-error");
    else if (kind === "ok") st.classList.add("is-ok");
  }

  function renderSecurityTlsCertificatePanels(data) {
    const payload = data || {};
    const active = payload.certificate;
    const selfC = payload.certificate_self_signed;
    const leC = payload.certificate_letsencrypt;
    const certSource =
      payload.cert_source ||
      (document.querySelector('#settings-security-form input[name="cert_method"]:checked')?.value === "letsencrypt"
        ? "letsencrypt"
        : "self_signed");

    const selfEl = document.getElementById("settings-security-cert-self-summary");
    const leEl = document.getElementById("settings-security-cert-le-summary");
    const dlSelf = document.getElementById("settings-security-download-self-chain");
    const dlLe = document.getElementById("settings-security-download-le-chain");
    const activeHint = document.getElementById("settings-security-active-cert-hint");
    const selfChainHint = document.getElementById("settings-security-self-chain-hint");
    const leChainHint = document.getElementById("settings-security-le-chain-hint");
    const selfTrustHint = document.getElementById("settings-security-self-trust-hint");
    const pillSelf = document.getElementById("settings-security-active-pill-self");
    const pillLe = document.getElementById("settings-security-active-pill-le");

    const hasSelf = !!(selfC && selfC.present);
    const hasLe = !!(leC && leC.present);
    securityCertPresent = !!(active && active.present);

    if (dlSelf) dlSelf.disabled = !hasSelf;
    if (dlLe) dlLe.disabled = !hasLe;

    function fillSummaryText(cert, textEl, emptyMessage) {
      if (!textEl) return;
      if (!cert || !cert.present) {
        textEl.textContent = emptyMessage;
        return;
      }
      const nameLine =
        (cert.dns_names && cert.dns_names.length ? cert.dns_names.join(", ") : null) ||
        cert.subject_common_name ||
        cert.primary_hostname ||
        "—";
      const after = cert.not_after ? ` Valid until ${cert.not_after}.` : "";
      textEl.textContent = `Issued for: ${nameLine}.${after}`;
    }

    function setChainHint(cert, hintEl) {
      if (!hintEl) return;
      const n = cert && cert.chain_certificate_count;
      if (cert && cert.present && n != null && n > 1) {
        hintEl.textContent = `This PEM contains ${n} certificates (full signing chain).`;
        hintEl.hidden = false;
      } else {
        hintEl.textContent = "";
        hintEl.hidden = true;
      }
    }

    fillSummaryText(
      selfC,
      selfEl,
      "No self-signed certificate on file. Use “Generate certificate” below; a copy is kept here even when HTTPS uses Let’s Encrypt.",
    );
    fillSummaryText(
      leC,
      leEl,
      "No Let’s Encrypt chain on file. Use “Obtain Let’s Encrypt certificate” below once Let’s Encrypt is configured.",
    );
    setChainHint(selfC, selfChainHint);
    setChainHint(leC, leChainHint);

    if (selfTrustHint) selfTrustHint.hidden = !hasSelf;

    if (activeHint) {
      if (active && active.present) {
        const label =
          certSource === "letsencrypt"
            ? "Let’s Encrypt"
            : certSource === "self_signed"
              ? "self-signed"
              : "saved";
        const n = active.chain_certificate_count;
        const chainWording =
          n != null && n > 1 ? `${n} public certificates (full chain)` : "one public certificate";
        activeHint.textContent = `The HTTPS listener is configured to use the ${label} source; the active PEM on disk contains ${chainWording}.`;
        activeHint.hidden = false;
      } else {
        activeHint.textContent = "";
        activeHint.hidden = true;
      }
    }

    const httpsOn = !!payload.https_enabled;
    let activeSelf = false;
    let activeLe = false;
    if (httpsOn && active && active.present) {
      if (active.is_self_signed === true) {
        activeSelf = true;
      } else if (active.is_self_signed === false) {
        activeLe = true;
      } else if (certSource === "self_signed") {
        activeSelf = true;
      } else if (certSource === "letsencrypt") {
        activeLe = true;
      }
    }
    if (pillSelf) pillSelf.hidden = !activeSelf;
    if (pillLe) pillLe.hidden = !activeLe;
  }

  async function downloadSecurityTlsChainPem(source, filename) {
    try {
      const q = new URLSearchParams({ source });
      const r = await fetch(`/api/settings/security/tls-certificate-chain.pem?${q.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (r.status === 401) {
        await handleSessionExpired();
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
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSecurityStatus("Certificate chain downloaded.", "ok");
    } catch (e) {
      setSecurityStatus(e.message || "Download failed.", "error");
    }
  }

  function readSecurityTlsHostnamesText() {
    return (document.getElementById("settings-security-tls-hostnames")?.value || "").trim() || "localhost";
  }

  function parseSecurityHostnamesList() {
    const raw = readSecurityTlsHostnamesText();
    const lines = raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.length ? lines : ["localhost"];
  }

  function readSecurityFormPayload() {
    const httpPort = parseInt(document.getElementById("settings-security-http-port")?.value, 10);
    const httpsRaw = document.getElementById("settings-security-https-port")?.value?.trim();
    const httpsPortParsed = httpsRaw === "" ? NaN : parseInt(httpsRaw, 10);
    const certMethod =
      document.getElementById("settings-security-form")?.querySelector('input[name="cert_method"]:checked')?.value ||
      "self_signed";
    return {
      http_enabled: !!document.getElementById("settings-security-http-enabled")?.checked,
      https_enabled: !!document.getElementById("settings-security-https-enabled")?.checked,
      redirect_http_to_https: !!document.getElementById("settings-security-redirect-http")?.checked,
      http_port: Number.isFinite(httpPort) ? httpPort : 8000,
      https_port: Number.isFinite(httpsPortParsed) ? httpsPortParsed : null,
      listen_interface: document.getElementById("settings-security-listen-interface")?.value || "0.0.0.0",
      allowed_ranges: document.getElementById("settings-security-allowed-ranges")?.value || "",
      tls_hostnames: readSecurityTlsHostnamesText(),
      cert_source: certMethod === "letsencrypt" ? "letsencrypt" : "self_signed",
      session_idle_timeout_minutes: (() => {
        const raw = (document.getElementById("settings-security-session-idle")?.value || "").trim();
        const n = Number.parseInt(raw, 10);
        if (!Number.isFinite(n)) return 60;
        return Math.min(525600, Math.max(0, n));
      })(),
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
    const leEl = document.getElementById("settings-security-cert-le");
    if (selfEl) selfEl.hidden = v !== "self_signed";
    if (leEl) leEl.hidden = v !== "letsencrypt";
  }

  let securityLetsencryptReady = false;

  function syncSecurityLetsencryptAvailability() {
    const leRadio = document.getElementById("settings-security-cert-le-radio");
    const hint = document.getElementById("settings-security-le-hint");
    const obtainBtn = document.getElementById("settings-security-obtain-le");
    if (leRadio) {
      leRadio.disabled = !securityLetsencryptReady;
      if (!securityLetsencryptReady && leRadio.checked) {
        const self = document.querySelector('#settings-security-form input[name="cert_method"][value="self_signed"]');
        if (self) self.checked = true;
        syncSecurityCertPanel();
      }
    }
    if (hint) hint.hidden = securityLetsencryptReady;
    if (obtainBtn) obtainBtn.disabled = !securityLetsencryptReady;
  }

  let letsEncryptPluginsCache = [];

  function setLetsEncryptTopStatus(message, kind) {
    const st = document.getElementById("settings-le-top-status");
    if (!st) return;
    st.textContent = message || "";
    st.classList.remove("is-error", "is-ok");
    if (kind === "error") st.classList.add("is-error");
    else if (kind === "ok") st.classList.add("is-ok");
  }

  function setLetsEncryptFooterStatus(message, kind) {
    const st = document.getElementById("settings-le-footer-status");
    if (!st) return;
    st.textContent = message || "";
    st.classList.remove("is-error", "is-ok");
    if (kind === "error") st.classList.add("is-error");
    else if (kind === "ok") st.classList.add("is-ok");
  }

  let letsEncryptQueuePollTimer = null;

  function stopLetsEncryptQueuePoll() {
    if (letsEncryptQueuePollTimer != null) {
      clearInterval(letsEncryptQueuePollTimer);
      letsEncryptQueuePollTimer = null;
    }
  }

  function renderLetsEncryptQueuePayload(data) {
    const idle = document.getElementById("settings-le-queue-idle");
    const detail = document.getElementById("settings-le-queue-detail");
    const runBlk = document.getElementById("settings-le-queue-running-block");
    const runLab = document.getElementById("settings-le-queue-running-label");
    const runMeta = document.getElementById("settings-le-queue-running-meta");
    const waitWrap = document.getElementById("settings-le-queue-waiting-wrap");
    const waitUl = document.getElementById("settings-le-queue-waiting");
    if (!idle || !detail) return;
    const running = data && data.running;
    const queued = (data && data.queued) || [];
    const busy = !!(running || queued.length);
    idle.hidden = busy;
    detail.hidden = !busy;
    if (!busy) return;
    if (running && runBlk && runLab && runMeta) {
      runBlk.hidden = false;
      runLab.textContent = running.label || running.operation || "Certbot job";
      const doms = Array.isArray(running.domains)
        ? running.domains.join(", ")
        : String(running.domains || "");
      const lines = [`Domains: ${doms || "—"}`, `Requested by: ${running.requested_by || "—"}`];
      if (running.dry_run === true) lines.push("Dry run");
      runMeta.textContent = lines.join("\n");
    } else if (runBlk && runLab && runMeta) {
      runBlk.hidden = true;
      runLab.textContent = "";
      runMeta.textContent = "";
    }
    if (waitUl && waitWrap) {
      waitUl.innerHTML = "";
      if (queued.length) {
        waitWrap.hidden = false;
        queued.forEach((q) => {
          const li = document.createElement("li");
          const domPart = Array.isArray(q.domains) ? q.domains.join(", ") : String(q.domains || "");
          const parts = [q.label || q.operation, domPart, q.requested_by].filter((x) => x && String(x).trim());
          li.textContent = parts.join(" · ");
          waitUl.appendChild(li);
        });
      } else {
        waitWrap.hidden = true;
      }
    }
  }

  async function refreshLetsEncryptQueueOnce() {
    if (!isAdmin()) return;
    try {
      const data = await apiRequestJson("/api/settings/letsencrypt/queue");
      renderLetsEncryptQueuePayload(data);
    } catch {
      /* ignore */
    }
  }

  function startLetsEncryptQueuePoll() {
    stopLetsEncryptQueuePoll();
    refreshLetsEncryptQueueOnce().catch(() => {});
    letsEncryptQueuePollTimer = setInterval(() => {
      refreshLetsEncryptQueueOnce().catch(() => {});
    }, 2000);
  }

  function syncLeDnsBlockVisible() {
    const dns = document.getElementById("settings-le-form")?.querySelector('input[name="le_validation"]:checked')
      ?.value;
    const block = document.getElementById("settings-le-dns-block");
    if (block) block.hidden = dns !== "dns";
  }

  function renderLeDnsFieldsForPlugin(pluginId) {
    const wrap = document.getElementById("settings-le-dns-fields");
    if (!wrap) return;
    const spec = letsEncryptPluginsCache.find((p) => p.id === pluginId);
    wrap.innerHTML = "";
    if (!spec || !Array.isArray(spec.fields)) return;
    spec.fields.forEach((f) => {
      const id = `settings-le-cred-${f.key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      const lab = document.createElement("label");
      lab.className = "settings-form__field";
      const span = document.createElement("span");
      span.className = "settings-form__label";
      span.textContent = f.label + (f.required ? "" : " (optional)");
      lab.appendChild(span);
      let input;
      if (f.type === "textarea") {
        input = document.createElement("textarea");
        input.className = "settings-form__input settings-form__textarea";
        input.rows = 6;
        input.spellcheck = false;
      } else {
        input = document.createElement("input");
        input.className = "settings-form__input";
        input.type = f.type === "password" ? "password" : "text";
        input.autocomplete = "new-password";
      }
      input.id = id;
      input.dataset.leCredKey = f.key;
      if (f.placeholder) input.placeholder = f.placeholder;
      const hint = f.required ? "" : " Leave blank to keep the saved value.";
      const sub = document.createElement("span");
      sub.className = "settings-security__hint muted";
      sub.textContent =
        f.key === "dns_google_credentials_json"
          ? "Paste the service account JSON key. Leave blank to keep the saved key." + hint
          : hint;
      lab.appendChild(input);
      if (sub.textContent) lab.appendChild(sub);
      wrap.appendChild(lab);
    });
  }

  function populateLePluginSelect(selectedId) {
    const sel = document.getElementById("settings-le-dns-plugin");
    if (!sel) return;
    sel.innerHTML = "";
    letsEncryptPluginsCache.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.label;
      sel.appendChild(o);
    });
    if (selectedId && letsEncryptPluginsCache.some((p) => p.id === selectedId)) sel.value = selectedId;
    renderLeDnsFieldsForPlugin(sel.value);
  }

  function readLetsEncryptCredentialsPayload() {
    const out = {};
    document.querySelectorAll("#settings-le-dns-fields [data-le-cred-key]").forEach((el) => {
      const k = el.dataset.leCredKey;
      if (k) out[k] = el.value || "";
    });
    return out;
  }

  function applyLetsEncryptCredentialShapes(shapes) {
    if (!shapes || typeof shapes !== "object") return;
    document.querySelectorAll("#settings-le-dns-fields [data-le-cred-key]").forEach((el) => {
      const k = el.dataset.leCredKey;
      const sh = shapes[k];
      if (sh && sh.configured && el.type !== "textarea") {
        el.placeholder = "•••••••• (saved; type to replace)";
      }
    });
  }

  async function loadLetsEncryptSettings() {
    if (!isAdmin()) return;
    setLetsEncryptTopStatus("Loading…", null);
    setLetsEncryptFooterStatus("", null);
    try {
      const data = await apiRequestJson("/api/settings/letsencrypt");
      letsEncryptPluginsCache = Array.isArray(data.plugins) ? data.plugins : [];
      const st = data.settings || {};
      const emailEl = document.getElementById("settings-le-email");
      if (emailEl) emailEl.value = st.email != null ? String(st.email) : "";
      const httpR = document.querySelector('#settings-le-form input[name="le_validation"][value="http"]');
      const dnsR = document.querySelector('#settings-le-form input[name="le_validation"][value="dns"]');
      if (st.validation_method === "dns") {
        if (dnsR) dnsR.checked = true;
      } else if (httpR) httpR.checked = true;
      populateLePluginSelect(st.dns_plugin || "cloudflare");
      const sel = document.getElementById("settings-le-dns-plugin");
      if (sel) {
        sel.onchange = () => renderLeDnsFieldsForPlugin(sel.value);
      }
      applyLetsEncryptCredentialShapes(data.credential_fields);
      syncLeDnsBlockVisible();
      const certbotOk = !!data.certbot_available;
      const setupOk = !!data.setup_complete;
      setLetsEncryptTopStatus(
        certbotOk
          ? setupOk
            ? "Certbot is available and setup looks complete."
            : "Certbot found. Enter email and DNS credentials (if using DNS), then save."
          : "Certbot is not available in this Python environment. Reinstall the app dependencies (certbot is included), or set GROUND_CONTROL_CERTBOT_PATH.",
        certbotOk ? (setupOk ? "ok" : null) : "error",
      );
    } catch (e) {
      setLetsEncryptTopStatus(e.message || "Could not load Let’s Encrypt settings.", "error");
    }
  }

  async function saveLetsEncryptSettingsClick() {
    if (!isAdmin()) return;
    const btn = document.getElementById("settings-le-save");
    if (btn) btn.disabled = true;
    setLetsEncryptFooterStatus("Saving…", null);
    try {
      const validation =
        document.getElementById("settings-le-form")?.querySelector('input[name="le_validation"]:checked')?.value ||
        "http";
      const plugin = document.getElementById("settings-le-dns-plugin")?.value || "cloudflare";
      const email = document.getElementById("settings-le-email")?.value?.trim() || "";
      const credentials = validation === "dns" ? readLetsEncryptCredentialsPayload() : {};
      const data = await apiRequestJson("/api/settings/letsencrypt", {
        method: "POST",
        body: JSON.stringify({
          validation_method: validation,
          dns_plugin: plugin,
          email,
          credentials,
        }),
      });
      letsEncryptPluginsCache = Array.isArray(data.plugins) ? data.plugins : letsEncryptPluginsCache;
      applyLetsEncryptCredentialShapes(data.credential_fields);
      loadSecuritySettings().catch(() => {});
      setLetsEncryptFooterStatus("Saved.", "ok");
      setLetsEncryptTopStatus(
        data.setup_complete ? "Setup complete. You can use Let’s Encrypt on the Security tab." : "Saved; finish required fields for a complete setup.",
        data.setup_complete ? "ok" : null,
      );
    } catch (e) {
      setLetsEncryptFooterStatus(e.message || "Save failed.", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function runLetsEncryptDryRun() {
    if (!isAdmin()) return;
    const domain = document.getElementById("settings-le-test-domain")?.value?.trim() || "";
    const logEl = document.getElementById("settings-le-test-log");
    if (!domain) {
      setLetsEncryptTopStatus("Enter a test domain.", "error");
      return;
    }
    setLetsEncryptTopStatus("Running Certbot dry run…", null);
    if (logEl) logEl.hidden = true;
    try {
      const data = await apiRequestJson("/api/settings/letsencrypt/test", {
        method: "POST",
        body: JSON.stringify({ domain }),
      });
      if (logEl) {
        logEl.textContent = data.log || "(no output)";
        logEl.hidden = false;
      }
      setLetsEncryptTopStatus("Dry run succeeded.", "ok");
    } catch (e) {
      let msg = e.message || "Dry run failed.";
      let detail = null;
      try {
        detail = JSON.parse(msg);
      } catch {
        /* plain string */
      }
      if (detail && typeof detail === "object" && detail.log) {
        if (logEl) {
          logEl.textContent = detail.log;
          logEl.hidden = false;
        }
        msg = detail.message || "Certbot dry run failed.";
      }
      setLetsEncryptTopStatus(msg, "error");
    }
  }

  async function loadSecuritySettings() {
    if (!isAdmin()) return;
    setSecurityStatus("Loading…", null);
    try {
      const data = await apiRequestJson("/api/settings/security");
      renderSecurityTlsCertificatePanels(data);
      applySecurityFieldSourceWarnings(data.security_field_sources);
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
      const tlsTa = document.getElementById("settings-security-tls-hostnames");
      if (tlsTa) {
        const th = data.tls_hostnames != null ? String(data.tls_hostnames).trim() : "";
        tlsTa.value = th || "localhost";
      }
      const idleInp = document.getElementById("settings-security-session-idle");
      if (idleInp) {
        const iv =
          data.session_idle_timeout_minutes != null ? Number(data.session_idle_timeout_minutes) : 60;
        idleInp.value = String(Number.isFinite(iv) ? iv : 60);
        const idleSrc = data.security_field_sources?.session_idle_timeout_minutes;
        idleInp.disabled = !!(idleSrc && (idleSrc.from_environment || idleSrc.from_docker_secret));
      }
      const idleHint = document.getElementById("settings-security-session-idle-hint");
      if (idleHint) {
        const src = data.security_field_sources?.session_idle_timeout_minutes;
        const envOverride = !!(src && (src.from_environment || src.from_docker_secret));
        const saved =
          data.session_idle_timeout_minutes != null ? Number(data.session_idle_timeout_minutes) : 60;
        const eff =
          data.session_idle_effective_minutes != null
            ? Number(data.session_idle_effective_minutes)
            : saved;
        if (envOverride) {
          idleHint.textContent = `Effective timeout is ${Number.isFinite(eff) ? eff : "—"} minute(s); GROUND_CONTROL_SESSION_IDLE_MINUTES overrides the value in this form.`;
          idleHint.hidden = false;
        } else {
          idleHint.textContent = "";
          idleHint.hidden = true;
        }
      }
      securityLetsencryptReady = !!data.letsencrypt_ready;
      const cs = data.cert_source === "letsencrypt" ? "letsencrypt" : "self_signed";
      const cr = document.querySelector(`#settings-security-form input[name="cert_method"][value="${cs}"]`);
      if (cr) cr.checked = true;
      syncSecurityFormControls();
      syncSecurityCertPanel();
      syncSecurityLetsencryptAvailability();
      setSecurityStatus("", null);
    } catch (e) {
      renderSecurityTlsCertificatePanels(null);
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
      renderSecurityTlsCertificatePanels(result);
      applySecurityFieldSourceWarnings(result.security_field_sources);
      syncSecurityFormControls();
      if (typeof result.session_idle_effective_minutes === "number") {
        sessionIdleMinutes = result.session_idle_effective_minutes;
        restartSessionIdleWatchIfAuthenticated();
      }
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
      globalThis.requestAnimationFrame(() => {
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
        typeof globalThis.gcNavFirewallsJson !== "undefined" ? globalThis.gcNavFirewallsJson : [],
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
    if (typeof globalThis.gcGlobalBannerShowProgress === "function") {
      globalThis.gcGlobalBannerShowProgress(progressMsg);
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
      if (typeof globalThis.gcGlobalBannerShowResult === "function") {
        const doneMsg =
          created === 1 ? "Added 1 test firewall." : `Added ${created} test firewalls.`;
        globalThis.gcGlobalBannerShowResult(true, doneMsg);
      }
      hydrateTestFwSourcePicker().catch(() => {});
    } catch (e) {
      setTestFirewallsStatus(e.message || "Could not add test firewalls.", "error");
      if (typeof globalThis.gcGlobalBannerShowResult === "function") {
        globalThis.gcGlobalBannerShowResult(false, e.message || "Could not add test firewalls.");
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
    if (!(await (window.gcConfirm ? window.gcConfirm("Remove all test firewalls?") : Promise.resolve(globalThis.confirm("Remove all test firewalls?"))))) return;
    closeSettingsModal();
    if (addBtn) addBtn.disabled = true;
    if (cleanupBtn) cleanupBtn.disabled = true;
    setTestFirewallsStatus("Removing test firewalls…", null);
    if (typeof globalThis.gcGlobalBannerShowProgress === "function") {
      globalThis.gcGlobalBannerShowProgress("Removing test firewalls…");
    }
    try {
      const data = await apiRequestJson("/api/settings/test-firewalls", { method: "DELETE" });
      setTestFirewallCurrentCount(parseInt(data?.total_test_firewalls, 10) || 0);
      const deleted = parseInt(data?.deleted, 10) || 0;
      setTestFirewallsStatus(`Removed ${deleted} test firewall${deleted === 1 ? "" : "s"}.`, "ok");
      if (typeof globalThis.gcGlobalBannerShowResult === "function") {
        globalThis.gcGlobalBannerShowResult(true, "Test firewalls cleaned up.");
      }
      hydrateTestFwSourcePicker().catch(() => {});
    } catch (e) {
      setTestFirewallsStatus(e.message || "Could not clean up test firewalls.", "error");
      if (typeof globalThis.gcGlobalBannerShowResult === "function") {
        globalThis.gcGlobalBannerShowResult(false, e.message || "Could not clean up test firewalls.");
      }
    } finally {
      if (addBtn) addBtn.disabled = false;
      if (cleanupBtn) cleanupBtn.disabled = false;
      updateTestFirewallsAddButtonLabel();
    }
  }

  function setDmStatus(message, kind) {
    const st = document.getElementById("settings-dm-status");
    if (!st) return;
    st.textContent = message || "";
    st.classList.remove("is-error", "is-ok");
    if (kind === "error") st.classList.add("is-error");
    else if (kind === "ok") st.classList.add("is-ok");
  }

  function setDmFooterStatus(message, kind) {
    const st = document.getElementById("settings-dm-footer-status");
    if (!st) return;
    st.textContent = message || "";
    st.classList.remove("is-error", "is-ok");
    if (kind === "error") st.classList.add("is-error");
    else if (kind === "ok") st.classList.add("is-ok");
  }

  function setBackupStatus(message, kind) {
    const st = document.getElementById("settings-backup-status");
    if (!st) return;
    st.textContent = message || "";
    st.classList.remove("is-error", "is-ok");
    if (kind === "error") st.classList.add("is-error");
    else if (kind === "ok") st.classList.add("is-ok");
  }

  function parseContentDispositionFilename(header) {
    if (!header || typeof header !== "string") return null;
    const m =
      /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(header.trim());
    if (!m) return null;
    const raw = (m[1] || m[2] || m[3] || "").trim();
    try {
      return decodeURIComponent(raw.replace(/^"+|"+$/g, ""));
    } catch {
      return raw.replace(/^"+|"+$/g, "");
    }
  }

  function syncBackupPwUi() {
    const panel = document.getElementById("settings-panel-backup");
    const pwOk = panel?.dataset?.backupPwConfigured === "1";
    const changing = panel?.dataset?.backupPwChanging === "1";
    const summary = document.getElementById("settings-backup-pw-summary");
    const edit = document.getElementById("settings-backup-pw-edit");
    const cancelBtn = document.getElementById("settings-backup-pw-cancel");
    if (summary) summary.hidden = !pwOk || changing;
    if (edit) edit.hidden = !!(pwOk && !changing);
    if (cancelBtn) cancelBtn.hidden = !(pwOk && changing);
  }

  /** Hide password fields until status loads (unless user is mid “change”). */
  function prepareBackupPasswordPanelBeforeLoad() {
    const panel = document.getElementById("settings-panel-backup");
    if (panel?.dataset?.backupPwChanging === "1") return;
    const summary = document.getElementById("settings-backup-pw-summary");
    const edit = document.getElementById("settings-backup-pw-edit");
    if (summary) summary.hidden = true;
    if (edit) edit.hidden = true;
  }

  function applyBackupPanelFromStatus(data) {
    const ready = !!(data && data.ready);
    const pwOk = !!(data && data.password_configured);
    const needsPwReset = !!(data && data.password_needs_reset);
    const panel = document.getElementById("settings-panel-backup");
    if (panel) {
      panel.dataset.backupPwConfigured = pwOk ? "1" : "0";
      if (!pwOk) panel.dataset.backupPwChanging = "0";
    }
    const unreadable = document.getElementById("settings-backup-pw-unreadable");
    if (unreadable) unreadable.hidden = !needsPwReset;

    const dl = document.getElementById("settings-backup-download");
    const rl = document.getElementById("settings-backup-restore-last");
    const lastLine = document.getElementById("settings-backup-last-line");
    const createBtn = document.getElementById("settings-backup-create");

    if (dl) dl.disabled = !ready;
    if (rl) {
      rl.hidden = !ready;
      rl.disabled = !ready;
    }
    if (createBtn) createBtn.disabled = !pwOk;

    if (lastLine) {
      if (ready) {
        let when = null;
        if (data.generated_at) {
          const d = new Date(data.generated_at);
          when = Number.isNaN(d.getTime()) ? String(data.generated_at) : d.toLocaleString();
        }
        const szN = data.size_bytes != null ? Number(data.size_bytes) : NaN;
        const szMb =
          Number.isFinite(szN) && szN >= 0 ? (szN / (1024 * 1024)).toFixed(1) : null;
        if (when && szMb) lastLine.textContent = `Last backup: ${when} ${szMb} MB`;
        else if (when) lastLine.textContent = `Last backup: ${when}`;
        else if (szMb) lastLine.textContent = `Last backup: ${szMb} MB`;
        else lastLine.textContent = "Last backup: available";
      } else {
        lastLine.textContent = "Last backup: Never";
      }
    }

    syncBackupPwUi();
  }

  function setBackupGenerating(on) {
    const prog = document.getElementById("settings-backup-progress");
    const createBtn = document.getElementById("settings-backup-create");
    const panel = document.getElementById("settings-panel-backup");
    const pwOk = panel?.dataset?.backupPwConfigured === "1";
    if (prog) {
      prog.classList.toggle("is-visible", !!on);
      prog.setAttribute("aria-busy", on ? "true" : "false");
    }
    if (createBtn) {
      createBtn.disabled = !!on || !pwOk;
      createBtn.setAttribute("aria-busy", on ? "true" : "false");
    }
  }

  function setBackupPwFormStatus(message, kind) {
    const st = document.getElementById("settings-backup-pw-form-status");
    if (!st) return;
    st.textContent = message || "";
    st.classList.remove("is-error", "is-ok");
    if (kind === "error") st.classList.add("is-error");
    else if (kind === "ok") st.classList.add("is-ok");
  }

  function clearBackupPasswordFields() {
    const a = document.getElementById("settings-backup-pw-new");
    const b = document.getElementById("settings-backup-pw-confirm");
    if (a) a.value = "";
    if (b) b.value = "";
  }

  function syncRestoreBackupPasswordToggleUi() {
    const inp = document.getElementById("settings-backup-restore-password");
    const btn = document.getElementById("settings-backup-restore-password-toggle");
    const showIcon = btn?.querySelector(".settings-backup__pw-toggle-icon--show");
    const hideIcon = btn?.querySelector(".settings-backup__pw-toggle-icon--hide");
    if (!inp || !btn || !showIcon || !hideIcon) return;
    const revealed = inp.type === "text";
    showIcon.hidden = revealed;
    hideIcon.hidden = !revealed;
    btn.setAttribute("aria-pressed", revealed ? "true" : "false");
    btn.setAttribute("aria-label", revealed ? "Hide password" : "Show password");
  }

  function beginBackupPasswordChange() {
    const panel = document.getElementById("settings-panel-backup");
    if (panel) panel.dataset.backupPwChanging = "1";
    clearBackupPasswordFields();
    setBackupPwFormStatus("", null);
    syncBackupPwUi();
    document.getElementById("settings-backup-pw-new")?.focus();
  }

  function cancelBackupPasswordChange() {
    const panel = document.getElementById("settings-panel-backup");
    if (panel) panel.dataset.backupPwChanging = "0";
    clearBackupPasswordFields();
    setBackupPwFormStatus("", null);
    syncBackupPwUi();
  }

  async function saveBackupPassword() {
    if (!isAdmin()) return;
    const newPw = document.getElementById("settings-backup-pw-new")?.value || "";
    const conf = document.getElementById("settings-backup-pw-confirm")?.value || "";
    const btn = document.getElementById("settings-backup-pw-save");
    if (btn) btn.disabled = true;
    setBackupPwFormStatus("Saving…", null);
    try {
      const body = { password: newPw, password_confirm: conf };
      await apiRequestJson("/api/settings/backup/password", { method: "POST", body: JSON.stringify(body) });
      const panel = document.getElementById("settings-panel-backup");
      if (panel) panel.dataset.backupPwChanging = "0";
      clearBackupPasswordFields();
      setBackupPwFormStatus("Backup password saved.", "ok");
      await loadBackupStatus();
    } catch (e) {
      setBackupPwFormStatus(e.message || "Could not save password.", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function loadBackupStatus() {
    if (!isAdmin()) return;
    try {
      const data = await apiRequestJson("/api/settings/backup/status");
      applyBackupPanelFromStatus(data || { ready: false });
    } catch {
      applyBackupPanelFromStatus({ ready: false, password_configured: false });
    }
  }

  async function createSettingsBackup() {
    if (!isAdmin()) return;
    setBackupGenerating(true);
    setBackupStatus("", null);
    try {
      await apiRequestJson("/api/settings/backup/generate", { method: "POST", body: "{}" });
      setBackupStatus("Backup generated. You can download it or restore from this server.", "ok");
      await loadBackupStatus();
    } catch (e) {
      setBackupStatus(e.message || "Could not create backup.", "error");
    } finally {
      setBackupGenerating(false);
    }
  }

  async function downloadSettingsBackup() {
    if (!isAdmin()) return;
    const dl = document.getElementById("settings-backup-download");
    if (dl?.disabled) {
      setBackupStatus("Create a backup on this server before downloading.", "error");
      return;
    }
    setBackupStatus("", null);
    try {
      const r = await fetch("/api/settings/backup/download", { credentials: "same-origin" });
      if (r.status === 401) {
        await handleSessionExpired();
        return;
      }
      if (!r.ok) {
        let msg = r.statusText;
        try {
          const j = await r.json();
          if (typeof j.detail === "string") msg = j.detail;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const blob = await r.blob();
      const cd = r.headers.get("Content-Disposition");
      let name = parseContentDispositionFilename(cd) || "ground-control-backup.gcbak";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      setBackupStatus("Download started.", "ok");
    } catch (e) {
      setBackupStatus(e.message || "Download failed.", "error");
    }
  }

  async function restoreSettingsBackupFromServer() {
    if (!isAdmin()) return;
    const rl = document.getElementById("settings-backup-restore-last");
    if (rl?.disabled || rl?.hidden) {
      setBackupStatus("Create a backup on this server first.", "error");
      return;
    }
    const restoreMsg =
      "Restore merge from the last backup created on this server? Matching database rows will be replaced with the backup version, and files from that backup will be written over existing TLS / Let’s Encrypt / policy files.";
    const ok = await (window.gcConfirm
      ? window.gcConfirm(restoreMsg)
      : Promise.resolve(globalThis.confirm(restoreMsg)));
    if (!ok) return;
    const btn = document.getElementById("settings-backup-restore-last");
    if (btn) btn.disabled = true;
    setBackupStatus("Restoring…", null);
    const rp = (document.getElementById("settings-backup-restore-password")?.value || "").trim();
    const payload = { password: rp.length ? rp : null };
    try {
      const r = await fetch("/api/settings/backup/restore-last", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.status === 401) {
        await handleSessionExpired();
        return;
      }
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        const d = data && data.detail;
        throw new Error(typeof d === "string" ? d : r.statusText || "Restore failed.");
      }
      const fr = data && data.files_restored != null ? Number(data.files_restored) : 0;
      setBackupStatus(
        `Restore completed (${fr} file(s) written). Restart the app if you changed certificates or listen settings.`,
        "ok",
      );
    } catch (e) {
      setBackupStatus(e.message || "Restore failed.", "error");
    } finally {
      await loadBackupStatus();
    }
  }

  async function restoreSettingsBackupMerge() {
    if (!isAdmin()) return;
    const inp = document.getElementById("settings-backup-file");
    const file = inp?.files?.[0];
    if (!file) {
      setBackupStatus("Choose a backup file first.", "error");
      return;
    }
    const btn = document.getElementById("settings-backup-restore");
    if (btn) btn.disabled = true;
    setBackupStatus("Restoring…", null);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append(
        "password",
        (document.getElementById("settings-backup-restore-password")?.value || "").trim(),
      );
      const r = await fetch("/api/settings/backup/restore", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      if (r.status === 401) {
        await handleSessionExpired();
        return;
      }
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        const d = data && data.detail;
        throw new Error(typeof d === "string" ? d : r.statusText || "Restore failed.");
      }
      const fr = data && data.files_restored != null ? Number(data.files_restored) : 0;
      setBackupStatus(
        `Restore completed (${fr} file(s) written). Restart the app if you changed certificates or listen settings.`,
        "ok",
      );
    } catch (e) {
      setBackupStatus(e.message || "Restore failed.", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderFirewallCacheTable(rows, totals) {
    const tbody = document.getElementById("settings-dm-firewall-cache-body");
    if (!tbody) return;
    const list = Array.isArray(rows) ? rows : [];
    const t = totals && typeof totals === "object" ? totals : null;
    const hasRows = list.length > 0;
    const totOrphan = t ? Number(t.orphaned_record_count) || 0 : 0;
    const totManaged = t ? Number(t.managed_record_count) || 0 : 0;
    if (!hasRows && totOrphan === 0 && totManaged === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="muted">No cached firewall configuration.</td></tr>';
      return;
    }
    const bodyHtml = list
      .map((row) => {
        const et = escapeHtml(row.entity_type || "—");
        const mr = Number(row.managed_record_count);
        const or = Number(row.orphaned_record_count);
        const mrStr = Number.isFinite(mr) ? String(Math.max(0, Math.floor(mr))) : "—";
        const orStr = Number.isFinite(or) ? String(Math.max(0, Math.floor(or))) : "—";
        const ms = escapeHtml(row.managed_approx_storage || "—");
        const os = escapeHtml(row.orphaned_approx_storage || "—");
        return `<tr>
          <td><code class="settings-about__code">${et}</code></td>
          <td class="settings-dm-col-num">${mrStr}</td>
          <td>${ms}</td>
          <td class="settings-dm-col-num">${orStr}</td>
          <td>${os}</td>
        </tr>`;
      })
      .join("");
    let foot = "";
    if (t) {
      const tmr = Number(t.managed_record_count);
      const tor = Number(t.orphaned_record_count);
      foot = `<tr class="settings-dm-cache-totals">
        <td>Total</td>
        <td class="settings-dm-col-num">${Number.isFinite(tmr) ? String(Math.max(0, Math.floor(tmr))) : "—"}</td>
        <td>${escapeHtml(t.managed_approx_storage || "—")}</td>
        <td class="settings-dm-col-num">${Number.isFinite(tor) ? String(Math.max(0, Math.floor(tor))) : "—"}</td>
        <td>${escapeHtml(t.orphaned_approx_storage || "—")}</td>
      </tr>`;
    }
    tbody.innerHTML = bodyHtml + foot;
  }

  function applyDataManagementPayload(data) {
    renderDataManagementTable(data?.categories || []);
    renderFirewallCacheTable(data?.firewall_cache_by_entity, data?.firewall_cache_totals);
  }

  function renderDataManagementTable(categories) {
    const tbody = document.getElementById("settings-data-management-body");
    if (!tbody) return;
    const rows = Array.isArray(categories) ? categories : [];
    if (rows.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="muted">No data categories returned.</td></tr>';
      return;
    }
    const mib = 1024 * 1024;
    tbody.innerHTML = rows
      .map((cat) => {
        const id = escapeHtml(cat.id || "");
        const label = escapeHtml(cat.label || cat.id || "—");
        const n = Number(cat.record_count);
        const countStr = Number.isFinite(n) ? String(Math.max(0, Math.floor(n))) : "—";
        const storage = escapeHtml(cat.approx_storage || "—");
        const age =
          cat.oldest_record_age_days != null && Number.isFinite(Number(cat.oldest_record_age_days))
            ? escapeHtml(String(Math.max(0, Math.floor(Number(cat.oldest_record_age_days)))))
            : "—";
        const maxB = Number(cat.max_bytes);
        const mibVal =
          Number.isFinite(maxB) && maxB > 0 ? Math.max(1, Math.round(maxB / mib)) : 1024;
        const maxAge =
          cat.max_age_days != null && Number.isFinite(Number(cat.max_age_days))
            ? Math.max(1, Math.floor(Number(cat.max_age_days)))
            : 365;
        const rowKey = String(cat.id || "").replace(/[^a-z0-9_-]/gi, "") || "row";
        return `<tr data-dm-id="${id}">
          <td>${label}</td>
          <td class="settings-dm-col-num">${countStr}</td>
          <td>${storage}</td>
          <td class="settings-dm-col-age">${age}</td>
          <td>
            <input type="number" class="settings-form__input settings-dm-input-mib" min="1" step="1" value="${mibVal}" aria-label="Max storage in mebibytes (${rowKey})" />
          </td>
          <td>
            <input type="number" class="settings-form__input settings-dm-input-days" min="1" step="1" value="${maxAge}" aria-label="Max age in days (${rowKey})" />
          </td>
        </tr>`;
      })
      .join("");
  }

  async function loadDataManagement() {
    if (!isAdmin()) return;
    setDmStatus("Loading…", null);
    setDmFooterStatus("", null);
    try {
      const data = await apiRequestJson("/api/settings/data-management");
      applyDataManagementPayload(data);
      setDmStatus("", null);
    } catch (e) {
      applyDataManagementPayload({});
      setDmStatus(e.message || "Could not load data management.", "error");
    }
  }

  async function saveDataManagementLimits() {
    if (!isAdmin()) return;
    const tbody = document.getElementById("settings-data-management-body");
    if (!tbody) return;
    const limits = {};
    let bad = false;
    tbody.querySelectorAll("tr[data-dm-id]").forEach((tr) => {
      const id = tr.dataset.dmId;
      const mibInp = tr.querySelector(".settings-dm-input-mib");
      const daysInp = tr.querySelector(".settings-dm-input-days");
      const mibParsed = parseInt(mibInp?.value, 10);
      const daysParsed = parseInt(daysInp?.value, 10);
      if (!id || !Number.isFinite(mibParsed) || mibParsed < 1 || !Number.isFinite(daysParsed) || daysParsed < 1) {
        bad = true;
      } else {
        limits[id] = { max_bytes: mibParsed * 1024 * 1024, max_age_days: daysParsed };
      }
    });
    if (bad || Object.keys(limits).length === 0) {
      setDmFooterStatus("Enter valid limits (MiB ≥ 1, days ≥ 1).", "error");
      return;
    }
    const saveBtn = document.getElementById("settings-dm-save");
    if (saveBtn) saveBtn.disabled = true;
    setDmFooterStatus("Saving…", null);
    try {
      const data = await apiRequestJson("/api/settings/data-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limits }),
      });
      applyDataManagementPayload(data);
      setDmFooterStatus("Saved.", "ok");
      setDmStatus("", null);
    } catch (e) {
      setDmFooterStatus(e.message || "Could not save limits.", "error");
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function formatHistoryPurgeSummary(purged) {
    if (!purged || typeof purged !== "object") return "";
    const parts = [];
    const add = (key, label) => {
      const n = parseInt(purged[key], 10);
      if (Number.isFinite(n) && n > 0) parts.push(`${label}: ${n}`);
    };
    add("cache_updates", "Cache updates");
    add("sync_logs", "Sync logs");
    add("task_queue_history", "Task queue");
    add("access_logs", "Access logs");
    return parts.length ? `Removed ${parts.join("; ")}.` : "Nothing to remove; data is already within limits.";
  }

  async function runHistoryRetentionCleanup() {
    if (!isAdmin()) return;
    const retMsg =
      "Run retention cleanup now? Rows older than the configured max age, or over the max size (oldest removed first), will be deleted permanently.";
    const retOk = await (window.gcConfirm
      ? window.gcConfirm(retMsg)
      : Promise.resolve(globalThis.confirm(retMsg)));
    if (!retOk) return;
    const btn = document.getElementById("settings-dm-run-history-retention");
    if (btn) btn.disabled = true;
    setDmStatus("Running cleanup…", null);
    try {
      const data = await apiRequestJson("/api/settings/data-management/run-history-retention", {
        method: "POST",
        body: "{}",
      });
      applyDataManagementPayload(data);
      setDmStatus(formatHistoryPurgeSummary(data?.purged), "ok");
    } catch (e) {
      setDmStatus(e.message || "Cleanup failed.", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function cleanupOrphanedFirewallCache() {
    if (!isAdmin()) return;
    const orphMsg =
      "Delete all cached firewall configuration rows that no longer reference a firewall? This cannot be undone.";
    const orphOk = await (window.gcConfirm
      ? window.gcConfirm(orphMsg)
      : Promise.resolve(globalThis.confirm(orphMsg)));
    if (!orphOk) return;
    const btn = document.getElementById("settings-dm-cleanup-orphaned-cache");
    if (btn) btn.disabled = true;
    setDmStatus("Removing orphaned cache rows…", null);
    try {
      const data = await apiRequestJson("/api/settings/data-management/cleanup-orphaned-firewall-cache", {
        method: "POST",
        body: "{}",
      });
      applyDataManagementPayload(data);
      const n = parseInt(data?.deleted, 10);
      const msg = Number.isFinite(n)
        ? n === 0
          ? "No orphaned cache rows found."
          : `Removed ${n} orphaned cache row${n === 1 ? "" : "s"}.`
        : "Cleanup finished.";
      setDmStatus(msg, "ok");
    } catch (e) {
      setDmStatus(e.message || "Could not clean up orphaned data.", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function setSettingsSection(section) {
    if (section !== "letsencrypt") {
      stopLetsEncryptQueuePoll();
    }
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
    const leFooter = document.getElementById("settings-modal-letsencrypt-footer");
    if (leFooter) leFooter.hidden = section !== "letsencrypt";
    const dmFooter = document.getElementById("settings-modal-data-management-footer");
    if (dmFooter) dmFooter.hidden = section !== "data-management";
    if (section === "users") {
      loadSettingsUsers().catch((err) => console.error(err));
    }
    if (section === "security") {
      loadSecuritySettings().catch((err) => console.error(err));
    }
    if (section === "letsencrypt") {
      loadLetsEncryptSettings().catch((err) => console.error(err));
      startLetsEncryptQueuePoll();
    }
    if (section === "data-management") {
      loadDataManagement().catch((err) => console.error(err));
    }
    if (section === "backup") {
      prepareBackupPasswordPanelBeforeLoad();
      loadBackupStatus().catch((err) => console.error(err));
    }
    if (section === "test") {
      loadTestFirewallSummary().catch((err) => console.error(err));
    }
  }

  function filterSettingsNav() {
    const q = (document.getElementById("settings-nav-filter")?.value || "").trim().toLowerCase();
    const adminOnly = new Set([
      "settings-nav-roles",
      "settings-nav-security",
      "settings-nav-letsencrypt",
      "settings-nav-data-management",
      "settings-nav-backup",
      "settings-nav-test",
    ]);
    document.querySelectorAll("#settings-nav .settings-nav__item").forEach((btn) => {
      const navText = (btn.querySelector("span")?.textContent || "").toLowerCase();
      const match = q === "" || navText.includes(q);
      btn.hidden = !match || (adminOnly.has(btn.id) && !isAdmin());
    });
    const aboutBtn = document.getElementById("settings-nav-about");
    if (aboutBtn) {
      const navText = (aboutBtn.querySelector("span")?.textContent || "").toLowerCase();
      const match = q === "" || navText.includes(q);
      aboutBtn.hidden = !match;
    }
  }

  function cellTextOrDash(val) {
    const t = val != null ? String(val).trim() : "";
    return t ? escapeHtml(t) : "—";
  }

  const SETTINGS_USER_FACET_COLS = [
    { id: "username", label: "Username" },
    { id: "full_name", label: "Full name" },
    { id: "role", label: "Role" },
    { id: "updated_at", label: "Updated" },
  ];

  let settingsUsersFacetAsideBound = false;
  let settingsUsersLoadGen = 0;
  /** @type {Map<string, Record<string, unknown>>} */
  let settingsUsersRowCache = new Map();

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
      role: appRoleDisplay(row.role),
      updated_at: updatedDisplay.trim().replace(/\s+/g, " "),
    };
  }

  function syncSettingsUsersFacetRowData(tbody) {
    const maps = [];
    tbody.querySelectorAll("tr[data-user-id]").forEach((tr) => {
      const m = {};
      tr.querySelectorAll("td[data-gc-col]").forEach((td) => {
        const k = td.dataset.gcCol;
        if (k) m[k] = (td.textContent || "").trim().replace(/\s+/g, " ");
      });
      maps.push(m);
      globalThis.gcTableFacets?.setRowFacets(tr, m);
    });
    return maps;
  }

  function rebuildSettingsUsersFacets(maps) {
    const drawer = document.getElementById("settings-users-filters-drawer");
    if (!drawer || !globalThis.gcTableFacets) return;
    globalThis.gcTableFacets.rebuild(drawer, SETTINGS_USER_FACET_COLS, maps, "settings-users");
  }

  function settingsUsersFacetAppliedCount() {
    const drawer = document.getElementById("settings-users-filters-drawer");
    if (!drawer || !globalThis.gcTableFacets) return 0;
    return globalThis.gcTableFacets.appliedCount(drawer);
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
    if (!tbody || !drawer || !globalThis.gcTableFacets) return;
    tbody.querySelectorAll("tr[data-user-id]").forEach((tr) => {
      tr.hidden = !globalThis.gcTableFacets.rowMatches(tr, drawer);
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
    globalThis.gcTableFacets?.bindAside(
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
    settingsUsersRowCache = new Map();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">No users.</td></tr>';
      if (drawer && globalThis.gcTableFacets) {
        globalThis.gcTableFacets.reset(drawer, "settings-users");
        drawer.innerHTML = "";
      }
      updateSettingsUsersFacetChrome();
      globalThis.gcTableSort?.bindTable(document.getElementById("settings-users-table"));
      return;
    }
    const adminUi = isAdmin();
    rows.forEach((r) => {
      if (r && r.id != null) settingsUsersRowCache.set(String(r.id), r);
    });
    const facetMaps = rows.map(settingsUserFacetMapFromApiRow);
    if (drawer && globalThis.gcTableFacets) {
      rebuildSettingsUsersFacets(facetMaps);
    }
    const rowHtmlJoined = rows
      .map((row) => {
        const id = escapeHtml(row.id);
        const usernameCell = adminUi
          ? `<button type="button" class="settings-user-username-btn" data-user-open="${id}" title="Edit user">${escapeHtml(row.username)}</button>`
          : `<strong>${escapeHtml(row.username)}</strong>`;
        const roleCell = escapeHtml(appRoleDisplay(row.role));
        const updatedTitle = row.updated_at ? escapeHtml(String(row.updated_at)) : "";
        const updatedDisplay = formatUserRelativeTime(row.updated_at);
        return `<tr data-user-id="${id}">
          <td data-gc-col="username">${usernameCell}</td>
          <td data-gc-col="full_name">${cellTextOrDash(row.full_name)}</td>
          <td data-gc-col="role" data-sort-value="${escapeHtml(appRoleDisplay(row.role))}" class="settings-user-cell--role">${roleCell}</td>
          <td data-gc-col="updated_at" data-sort-value="${escapeHtml(row.updated_at || "")}" class="muted" ${updatedTitle ? `title="${updatedTitle}"` : ""}>${updatedDisplay}</td>
        </tr>`;
      })
      .join("");
    const wrap = document.createElement("tbody");
    wrap.innerHTML = rowHtmlJoined;
    const trList = Array.from(wrap.children);
    trList.forEach((tr, i) => {
      globalThis.gcTableFacets?.setRowFacets(tr, facetMaps[i]);
    });

    function finishSettingsUsersTable() {
      if (gen !== settingsUsersLoadGen) return;
      updateSettingsUsersFacetChrome();
      applySettingsUsersFacetFilter();
      globalThis.gcTableSort?.bindTable(document.getElementById("settings-users-table"));
    }

    const lazy = globalThis.gcTableLazy;
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

  function openUserEditUserDialog(userId) {
    const d = document.getElementById("user-edit-profile-dialog");
    const row = settingsUsersRowCache.get(String(userId));
    if (!d || !row) return;
    document.getElementById("user-edit-profile-id").value = String(row.id || "");
    const un = document.getElementById("user-edit-profile-username");
    if (un) un.value = row.username != null ? String(row.username) : "";
    document.getElementById("user-edit-profile-full-name").value =
      row.full_name != null ? String(row.full_name) : "";
    document.getElementById("user-edit-profile-email").value = row.email != null ? String(row.email) : "";
    document.getElementById("user-edit-profile-mobile").value = row.mobile != null ? String(row.mobile) : "";
    const roleSel = document.getElementById("user-edit-profile-role");
    if (roleSel) {
      roleSel.innerHTML = appRoleOptionsHtml(row.role);
      roleSel.dataset.previousRole = normalizeAppRole(row.role);
    }
    const st = document.getElementById("user-edit-profile-status");
    if (st) {
      st.textContent = "";
      st.classList.remove("is-error", "is-ok");
    }
    d.hidden = false;
    d.setAttribute("aria-hidden", "false");
    un?.focus();
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
      if (d && globalThis.gcTableFacets) globalThis.gcTableFacets.reset(d, "settings-users");
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
      const sec = btn.dataset.settingsSection;
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
    document.getElementById("settings-security-download-self-chain")?.addEventListener("click", () => {
      downloadSecurityTlsChainPem("self_signed", "ground-control-self-signed-chain.pem").catch((err) =>
        setSecurityStatus(err.message || "Download failed.", "error"),
      );
    });
    document.getElementById("settings-security-download-le-chain")?.addEventListener("click", () => {
      downloadSecurityTlsChainPem("letsencrypt", "ground-control-letsencrypt-chain.pem").catch((err) =>
        setSecurityStatus(err.message || "Download failed.", "error"),
      );
    });
    document.getElementById("settings-security-gen-self-signed")?.addEventListener("click", async () => {
      const hosts = parseSecurityHostnamesList();
      if (!hosts.length) {
        setSecurityStatus("Enter at least one hostname.", "error");
        return;
      }
      try {
        const r = await apiRequestJson("/api/settings/security/generate-self-signed", {
          method: "POST",
          body: JSON.stringify({ hostnames: hosts }),
        });
        renderSecurityTlsCertificatePanels(r);
        syncSecurityFormControls();
        setSecurityStatus("Certificate generated.", "ok");
      } catch (err) {
        setSecurityStatus(err.message || "Could not generate certificate.", "error");
      }
    });
    document.getElementById("settings-security-obtain-le")?.addEventListener("click", async () => {
      const hosts = parseSecurityHostnamesList();
      if (!hosts.length) {
        setSecurityStatus("Enter at least one hostname.", "error");
        return;
      }
      try {
        const r = await apiRequestJson("/api/settings/security/obtain-letsencrypt", {
          method: "POST",
          body: JSON.stringify({ hostnames: hosts }),
        });
        renderSecurityTlsCertificatePanels(r);
        syncSecurityFormControls();
        setSecurityStatus("Let’s Encrypt certificate installed.", "ok");
      } catch (err) {
        setSecurityStatus(err.message || "Could not obtain certificate.", "error");
      }
    });
    document.getElementById("settings-security-goto-le")?.addEventListener("click", () => {
      setSettingsSection("letsencrypt");
    });
    document.getElementById("settings-le-form")?.addEventListener("change", (e) => {
      const t = e.target;
      if (t && t.matches && t.matches('input[name="le_validation"]')) syncLeDnsBlockVisible();
    });
    document.getElementById("settings-le-save")?.addEventListener("click", () => {
      saveLetsEncryptSettingsClick().catch((err) =>
        setLetsEncryptFooterStatus(err.message || "Save failed.", "error"),
      );
    });
    document.getElementById("settings-le-test-run")?.addEventListener("click", () => {
      runLetsEncryptDryRun().catch((err) => setLetsEncryptTopStatus(err.message || "Test failed.", "error"));
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
    document.getElementById("settings-dm-save")?.addEventListener("click", () => {
      saveDataManagementLimits().catch((err) =>
        setDmFooterStatus(err.message || "Could not save limits.", "error"),
      );
    });
    document.getElementById("settings-dm-cleanup-orphaned-cache")?.addEventListener("click", () => {
      cleanupOrphanedFirewallCache().catch((err) =>
        setDmStatus(err.message || "Could not clean up orphaned data.", "error"),
      );
    });
    document.getElementById("settings-dm-run-history-retention")?.addEventListener("click", () => {
      runHistoryRetentionCleanup().catch((err) =>
        setDmStatus(err.message || "Cleanup failed.", "error"),
      );
    });
    document.getElementById("settings-backup-pw-save")?.addEventListener("click", () => {
      saveBackupPassword().catch((err) =>
        setBackupPwFormStatus(err.message || "Could not save password.", "error"),
      );
    });
    document.getElementById("settings-backup-pw-cancel")?.addEventListener("click", () => {
      cancelBackupPasswordChange();
    });
    document.getElementById("settings-backup-pw-change")?.addEventListener("click", () => {
      beginBackupPasswordChange();
    });
    document.getElementById("settings-backup-create")?.addEventListener("click", () => {
      createSettingsBackup().catch((err) =>
        setBackupStatus(err.message || "Could not create backup.", "error"),
      );
    });
    document.getElementById("settings-backup-download")?.addEventListener("click", () => {
      downloadSettingsBackup().catch((err) =>
        setBackupStatus(err.message || "Download failed.", "error"),
      );
    });
    document.getElementById("settings-backup-restore-last")?.addEventListener("click", () => {
      restoreSettingsBackupFromServer().catch((err) =>
        setBackupStatus(err.message || "Restore failed.", "error"),
      );
    });
    document.getElementById("settings-backup-restore")?.addEventListener("click", () => {
      restoreSettingsBackupMerge().catch((err) =>
        setBackupStatus(err.message || "Restore failed.", "error"),
      );
    });
    document.getElementById("settings-backup-restore-password-toggle")?.addEventListener("click", () => {
      const inp = document.getElementById("settings-backup-restore-password");
      if (!inp) return;
      inp.type = inp.type === "password" ? "text" : "password";
      syncRestoreBackupPasswordToggleUi();
    });
    syncRestoreBackupPasswordToggleUi();
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
      const role = document.getElementById("user-form-role")?.value || "ReadOnly";
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
      const username = document.getElementById("user-edit-profile-username")?.value?.trim() || "";
      const full_name = document.getElementById("user-edit-profile-full-name")?.value?.trim() ?? "";
      const email = document.getElementById("user-edit-profile-email")?.value?.trim() ?? "";
      const mobile = document.getElementById("user-edit-profile-mobile")?.value?.trim() ?? "";
      const role = document.getElementById("user-edit-profile-role")?.value ?? "";
      const st = document.getElementById("user-edit-profile-status");
      const sub = document.getElementById("user-edit-profile-submit");
      if (!id) return;
      if (!username) {
        if (st) {
          st.textContent = "Username is required.";
          st.classList.add("is-error");
        }
        return;
      }
      if (sub) sub.disabled = true;
      try {
        const updated = await apiRequestJson(`/api/settings/users/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ username, full_name, email, mobile, role }),
        });
        if (updated && updated.id === currentSessionUser?.id) {
          currentSessionUser = { ...currentSessionUser, ...updated };
          applySettingsNavForRole();
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
    document.getElementById("user-edit-profile-set-password")?.addEventListener("click", async () => {
      const id = document.getElementById("user-edit-profile-id")?.value?.trim() || "";
      if (!id) return;
      const pw = await (window.gcPrompt
        ? window.gcPrompt("New password (min. 10 characters)", "", {
            title: "Set password",
            tone: "warning",
          })
        : Promise.resolve(globalThis.prompt("New password (min. 10 characters)")));
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
    });
    document.getElementById("user-edit-profile-delete")?.addEventListener("click", async () => {
      const id = document.getElementById("user-edit-profile-id")?.value?.trim() || "";
      if (!id) return;
      const rmMsg = "Remove this user? They will no longer be able to sign in.";
      if (!(await (window.gcConfirm ? window.gcConfirm(rmMsg) : Promise.resolve(globalThis.confirm(rmMsg))))) return;
      try {
        await apiRequestJson(`/api/settings/users/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        closeUserEditProfileDialog();
        if (id === currentSessionUser?.id) {
          globalThis.location.href = "/";
          return;
        }
        await loadSettingsUsers();
      } catch (err) {
        notify("Delete failed", err.message || "");
      }
    });
    document.getElementById("settings-users-body")?.addEventListener("click", (e) => {
      const opener = e.target.closest("button[data-user-open]");
      if (!opener) return;
      const id = opener.getAttribute("data-user-open");
      if (!id) return;
      openUserEditUserDialog(id);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initAuthForms();
    initUserMenu();
    initSettingsModal();
    bootAuth();
  });
})();
