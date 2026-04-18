/**
 * Firewalls · Configure · Authentication — users & groups tables and flyouts.
 */
(function () {
  "use strict";

  function bannerResult(ok, msg) {
    if (typeof globalThis.gcGlobalBannerShowResult === "function") {
      globalThis.gcGlobalBannerShowResult(ok, msg);
    } else {
      window.gcAlert(msg);
    }
  }

  function dispatchTaskQueueUpdated() {
    try {
      document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
    } catch (e0) {}
  }

  function firewallScopeIds() {
    let base = [];
    if (typeof globalThis.gcGetSelectedFirewallIds === "function") {
      try {
        base = globalThis.gcGetSelectedFirewallIds() || [];
      } catch (eSel) {
        base = [];
      }
    }
    if (!Array.isArray(base)) base = [];
    if (base.length) return base;
    let inv = globalThis.gcNavFirewallsJson;
    if (!Array.isArray(inv) || !inv.length) return [];
    return inv
      .map(function (x) {
        return x && x.id != null ? Number(x.id) : 0;
      })
      .filter(function (n) {
        return n > 0;
      });
  }

  function textScalar(v) {
    if (v == null) return "";
    if (typeof v === "object" && v !== null && v["#text"] != null) {
      return String(v["#text"]).trim();
    }
    return String(v).trim();
  }

  function collectCheckedFwIdsFromMs(msRoot) {
    if (!msRoot || !msRoot.querySelectorAll) return [];
    let out = [];
    let seen = {};
    msRoot.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      if (!cb.checked) return;
      let id = cb.dataset.gcFwId || cb.dataset.gcCfgId;
      if (id == null) return;
      let n = parseInt(String(id), 10);
      if (isNaN(n) || n < 1 || seen[n]) return;
      seen[n] = true;
      out.push(n);
    });
    return out;
  }

  function selectedFirewallIdsFromMs(msRoot) {
    let live = collectCheckedFwIdsFromMs(msRoot);
    if (live.length) return live;
    if (!msRoot || !msRoot.getAttribute) return [];
    try {
      let a = JSON.parse(msRoot.dataset.fwAssignedIds || "[]");
      return Array.isArray(a) ? a.map(Number).filter(function (n) { return n > 0; }) : [];
    } catch (e) {
      return [];
    }
  }

  function openAuFlyout(open) {
    let root = document.getElementById("gc-au-flyout");
    if (!root) return;
    root.hidden = !open;
    root.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("gc-if-flyout-open", !!open);
  }

  function syncAuProfileFieldVisibility() {
    let wrap = document.getElementById("gc-au-profile-field");
    if (!wrap) return;
    let ut = "User";
    document.querySelectorAll('input[name="gc-au-usertype"]').forEach(function (r) {
      if (r.checked) ut = r.value;
    });
    wrap.hidden = ut !== "Administrator";
  }

  function openAgFlyout(open) {
    let root = document.getElementById("gc-ag-flyout");
    if (!root) return;
    root.hidden = !open;
    root.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("gc-if-flyout-open", !!open);
  }

  function fillUserForm(p) {
    p = p || {};
    document.getElementById("gc-au-username").value = textScalar(p.Username);
    document.getElementById("gc-au-name").value = textScalar(p.Name);
    document.getElementById("gc-au-desc").value = textScalar(p.Description);
    let ut = textScalar(p.UserType) || "User";
    document.querySelectorAll('input[name="gc-au-usertype"]').forEach(function (r) {
      r.checked = r.value === ut;
    });
    let profSel = document.getElementById("gc-au-profile");
    if (profSel) {
      if (ut === "Administrator") {
        let pv = textScalar(p.Profile);
        if (pv) profSel.setAttribute("data-gc-profile-pending", pv);
        else profSel.removeAttribute("data-gc-profile-pending");
      } else {
        profSel.removeAttribute("data-gc-profile-pending");
      }
    }
    document.getElementById("gc-au-password").value = "";
    let email = "";
    let el = p.EmailList;
    if (el && typeof el === "object") {
      let eid = el.EmailID;
      if (Array.isArray(eid)) email = textScalar(eid[0]);
      else email = textScalar(eid);
    }
    document.getElementById("gc-au-email").value = email;
    let grpSel = document.getElementById("gc-au-group");
    if (grpSel) {
      let gv = textScalar(p.Group);
      if (gv) grpSel.setAttribute("data-gc-group-pending", gv);
      else grpSel.removeAttribute("data-gc-group-pending");
    }
    document.getElementById("gc-au-surfing").value = textScalar(p.SurfingQuotaPolicy);
    document.getElementById("gc-au-accesstime").value = textScalar(p.AccessTimePolicy);
    document.getElementById("gc-au-datatransfer").value = textScalar(p.DataTransferPolicy);
    document.getElementById("gc-au-qos").value = textScalar(p.QoSPolicy);
    document.getElementById("gc-au-sslvpn").value = textScalar(p.SSLVPNPolicy);
    document.getElementById("gc-au-clientless").value = textScalar(p.ClientlessPolicy);
    let qd = textScalar(p.QuarantineDigest) || "Disable";
    document.querySelectorAll('input[name="gc-au-quarantine"]').forEach(function (r) {
      r.checked = r.value === qd;
    });
    let mb = textScalar(p.MACBinding) || "Disable";
    document.querySelectorAll('input[name="gc-au-macbind"]').forEach(function (r) {
      r.checked = r.value === mb;
    });
    let macs = [];
    let ml = p.MACAddressList;
    if (ml && typeof ml === "object") {
      let mm = ml.MACAddress;
      if (Array.isArray(mm)) macs = mm.map(textScalar).filter(Boolean);
      else if (mm) macs = [textScalar(mm)];
    }
    document.getElementById("gc-au-maclist").value = macs.join("\n");
    document.getElementById("gc-au-applsched").value =
      textScalar(p.ScheduleForApplianceAccess) || "All the time";
    let ar = textScalar(p.LoginRestrictionForAppliance) || "AnyNode";
    document.querySelectorAll('input[name="gc-au-admlogin"]').forEach(function (r) {
      r.checked = r.value === ar;
    });
    syncAuProfileFieldVisibility();
  }

  function collectUserPayload() {
    let ut = "User";
    document.querySelectorAll('input[name="gc-au-usertype"]').forEach(function (r) {
      if (r.checked) ut = r.value;
    });
    let email = document.getElementById("gc-au-email").value.trim();
    let macRaw = document.getElementById("gc-au-maclist").value || "";
    let macList = macRaw
      .split(/[\n,]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    let qd = "Disable";
    document.querySelectorAll('input[name="gc-au-quarantine"]').forEach(function (r) {
      if (r.checked) qd = r.value;
    });
    let mb = "Disable";
    document.querySelectorAll('input[name="gc-au-macbind"]').forEach(function (r) {
      if (r.checked) mb = r.value;
    });
    let adm = "AnyNode";
    document.querySelectorAll('input[name="gc-au-admlogin"]').forEach(function (r) {
      if (r.checked) adm = r.value;
    });
    let profVal = "";
    if (ut === "Administrator") {
      let ps = document.getElementById("gc-au-profile");
      profVal = ps ? String(ps.value || "").trim() : "";
    }
    let o = {
      Username: document.getElementById("gc-au-username").value.trim(),
      Name: document.getElementById("gc-au-name").value.trim(),
      Description: document.getElementById("gc-au-desc").value.trim(),
      UserType: ut,
      Profile: profVal,
      Group: document.getElementById("gc-au-group").value.trim(),
      SurfingQuotaPolicy: document.getElementById("gc-au-surfing").value.trim(),
      AccessTimePolicy: document.getElementById("gc-au-accesstime").value.trim(),
      DataTransferPolicy: document.getElementById("gc-au-datatransfer").value.trim(),
      QoSPolicy: document.getElementById("gc-au-qos").value.trim(),
      SSLVPNPolicy: document.getElementById("gc-au-sslvpn").value.trim(),
      ClientlessPolicy: document.getElementById("gc-au-clientless").value.trim(),
      QuarantineDigest: qd,
      MACBinding: mb,
      ScheduleForApplianceAccess: document.getElementById("gc-au-applsched").value.trim(),
      LoginRestrictionForAppliance: adm,
    };
    let pw = document.getElementById("gc-au-password").value;
    if (pw) o.Password = pw;
    if (email) o.EmailList = { EmailID: email };
    if (macList.length) {
      o.MACAddressList = {
        MACAddress: macList.length === 1 ? macList[0] : macList,
      };
    }
    return o;
  }

  function fillGroupForm(p) {
    p = p || {};
    let gd = p.GroupDetail;
    if (Array.isArray(gd) && gd.length) gd = gd[0];
    if (!gd || typeof gd !== "object") gd = {};
    document.getElementById("gc-ag-name").value = textScalar(gd.Name);
    document.getElementById("gc-ag-desc").value = textScalar(gd.Description);
    let gt = textScalar(gd.GroupType) || "Normal";
    document.getElementById("gc-ag-grouptype").value = gt === "Clientless" ? "Clientless" : "Normal";
    document.getElementById("gc-ag-surfing").value = textScalar(gd.SurfingQuotaPolicy);
    document.getElementById("gc-ag-access").value = textScalar(gd.AccessTimePolicy);
    document.getElementById("gc-ag-datatransfer").value = textScalar(gd.DataTransferPolicy);
    document.getElementById("gc-ag-qos").value = textScalar(gd.QoSPolicy);
    document.getElementById("gc-ag-sslvpn").value = textScalar(gd.SSLVPNPolicy);
    document.getElementById("gc-ag-clientless").value = textScalar(gd.ClientlessPolicy);
    let l2 = textScalar(gd.L2TP) || "Disable";
    document.querySelectorAll('input[name="gc-ag-l2tp"]').forEach(function (r) {
      r.checked = r.value === l2;
    });
    let pp = textScalar(gd.PPTP) || "Disable";
    document.querySelectorAll('input[name="gc-ag-pptp"]').forEach(function (r) {
      r.checked = r.value === pp;
    });
    let qd = textScalar(gd.QuarantineDigest) || "Enable";
    document.querySelectorAll('input[name="gc-ag-quarantine"]').forEach(function (r) {
      r.checked = r.value === qd;
    });
    let mb = textScalar(gd.MACBinding) || "Disable";
    document.querySelectorAll('input[name="gc-ag-macbind"]').forEach(function (r) {
      r.checked = r.value === mb;
    });
    let lr = textScalar(gd.LoginRestriction) || "AnyNode";
    document.querySelectorAll('input[name="gc-ag-loginrestriction"]').forEach(function (r) {
      r.checked = r.value === lr;
    });
  }

  function collectGroupPayload() {
    let l2 = "Disable";
    document.querySelectorAll('input[name="gc-ag-l2tp"]').forEach(function (r) {
      if (r.checked) l2 = r.value;
    });
    let pp = "Disable";
    document.querySelectorAll('input[name="gc-ag-pptp"]').forEach(function (r) {
      if (r.checked) pp = r.value;
    });
    let qd = "Enable";
    document.querySelectorAll('input[name="gc-ag-quarantine"]').forEach(function (r) {
      if (r.checked) qd = r.value;
    });
    let mb = "Disable";
    document.querySelectorAll('input[name="gc-ag-macbind"]').forEach(function (r) {
      if (r.checked) mb = r.value;
    });
    let lr = "AnyNode";
    document.querySelectorAll('input[name="gc-ag-loginrestriction"]').forEach(function (r) {
      if (r.checked) lr = r.value;
    });
    return {
      GroupDetail: {
        Name: document.getElementById("gc-ag-name").value.trim(),
        Description: document.getElementById("gc-ag-desc").value.trim(),
        GroupType: document.getElementById("gc-ag-grouptype").value,
        SurfingQuotaPolicy: document.getElementById("gc-ag-surfing").value.trim(),
        AccessTimePolicy: document.getElementById("gc-ag-access").value.trim(),
        DataTransferPolicy: document.getElementById("gc-ag-datatransfer").value.trim(),
        QoSPolicy: document.getElementById("gc-ag-qos").value.trim(),
        SSLVPNPolicy: document.getElementById("gc-ag-sslvpn").value.trim(),
        ClientlessPolicy: document.getElementById("gc-ag-clientless").value.trim(),
        L2TP: l2,
        PPTP: pp,
        QuarantineDigest: qd,
        MACBinding: mb,
        LoginRestriction: lr,
      },
    };
  }

  globalThis.gcInitAuthenticationPage = function (cfg) {
    let URL_USERS = cfg.urlUsers;
    let URL_GROUPS = cfg.urlGroups;
    let U_CREATE = cfg.urlUserCreate;
    let U_UPDATE = cfg.urlUserUpdate;
    let U_DEL = cfg.urlUserDeletes;
    let G_CREATE = cfg.urlGroupCreate;
    let G_UPDATE = cfg.urlGroupUpdate;
    let G_DEL = cfg.urlGroupDeletes;

    let auMode = "edit";
    let auRow = null;
    let agMode = "edit";
    let agRow = null;

    let URL_ADMIN_PROFILE_OPTS = (cfg && cfg.urlAdminProfileOptions) || "";
    let URL_USER_GROUP_OPTS = (cfg && cfg.urlUserGroupOptions) || "";
    let auProfileRefreshGen = 0;
    let auGroupRefreshGen = 0;

    function auFlyoutFirewallIdsForPicker() {
      let ids = [];
      if (auMode === "edit" && auRow && auRow.firewall_id != null) {
        let f0 = Number(auRow.firewall_id);
        if (!isNaN(f0) && f0 > 0) ids = [f0];
      } else {
        let fwF = document.getElementById("gc-au-fw-field");
        let ms0 = fwF && fwF.querySelector(".gc-hs-ip-host-flyout__fw-ms");
        ids = collectCheckedFwIdsFromMs(ms0);
        if (!ids.length) ids = selectedFirewallIdsFromMs(ms0);
      }
      return ids;
    }

    function refreshAuAdminProfileSelect() {
      let utCur = "User";
      document.querySelectorAll('input[name="gc-au-usertype"]').forEach(function (r) {
        if (r.checked) utCur = r.value;
      });
      if (utCur !== "Administrator") return;

      let gen = ++auProfileRefreshGen;
      let sel = document.getElementById("gc-au-profile");
      if (!sel) return;
      let ids = auFlyoutFirewallIdsForPicker();
      let pendingRaw = sel.dataset.gcProfilePending;
      sel.removeAttribute("data-gc-profile-pending");
      let pending = pendingRaw != null ? String(pendingRaw).trim() : "";

      if (!URL_ADMIN_PROFILE_OPTS) {
        sel.innerHTML = "";
        let pm = document.createElement("option");
        pm.value = "";
        pm.textContent = "Profile options unavailable";
        sel.appendChild(pm);
        sel.disabled = true;
        return;
      }

      if (!ids.length) {
        sel.innerHTML = "";
        let oz = document.createElement("option");
        oz.value = "";
        oz.textContent = "Select firewall(s) first…";
        sel.appendChild(oz);
        sel.disabled = true;
        return;
      }

      sel.disabled = false;
      let url =
        URL_ADMIN_PROFILE_OPTS + "?firewall_ids=" + encodeURIComponent(ids.join(","));
      fetch(url, {
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "Ground-Control",
        },
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          if (gen !== auProfileRefreshGen) return;
          if (!sel.isConnected) return;
          sel.innerHTML = "";
          let p0 = document.createElement("option");
          p0.value = "";
          p0.textContent = "Select profile…";
          sel.appendChild(p0);
          if (!x.ok) return;
          let opts = (x.j && x.j.options) || [];
          if (Array.isArray(opts)) {
            opts.forEach(function (name) {
              if (!name) return;
              let o = document.createElement("option");
              o.value = name;
              o.textContent = name;
              sel.appendChild(o);
            });
          }
          if (
            pending &&
            !Array.prototype.some.call(sel.options, function (opt) {
              return opt.value === pending;
            })
          ) {
            let ox = document.createElement("option");
            ox.value = pending;
            ox.textContent = pending + " (not in cache)";
            sel.appendChild(ox);
          }
          sel.value = pending || "";
        })
        .catch(function () {
          if (gen !== auProfileRefreshGen) return;
          if (!sel.isConnected) return;
          sel.innerHTML = "";
          let pe = document.createElement("option");
          pe.value = "";
          pe.textContent = "Could not load profiles";
          sel.appendChild(pe);
        });
    }

    function refreshAuUserGroupSelect() {
      let gen = ++auGroupRefreshGen;
      let sel = document.getElementById("gc-au-group");
      if (!sel) return;
      let ids = auFlyoutFirewallIdsForPicker();
      let pendingRaw = sel.dataset.gcGroupPending;
      sel.removeAttribute("data-gc-group-pending");
      let pending = pendingRaw != null ? String(pendingRaw).trim() : "";

      if (!URL_USER_GROUP_OPTS) {
        sel.innerHTML = "";
        let pm = document.createElement("option");
        pm.value = "";
        pm.textContent = "Group options unavailable";
        sel.appendChild(pm);
        sel.disabled = true;
        return;
      }

      if (!ids.length) {
        sel.innerHTML = "";
        let oz = document.createElement("option");
        oz.value = "";
        oz.textContent = "Select firewall(s) first…";
        sel.appendChild(oz);
        sel.disabled = true;
        return;
      }

      sel.disabled = false;
      let url =
        URL_USER_GROUP_OPTS + "?firewall_ids=" + encodeURIComponent(ids.join(","));
      fetch(url, {
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "Ground-Control",
        },
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          if (gen !== auGroupRefreshGen) return;
          if (!sel.isConnected) return;
          sel.innerHTML = "";
          let p0 = document.createElement("option");
          p0.value = "";
          p0.textContent = "— No group —";
          sel.appendChild(p0);
          if (!x.ok) return;
          let opts = (x.j && x.j.options) || [];
          if (Array.isArray(opts)) {
            opts.forEach(function (name) {
              if (!name) return;
              let o = document.createElement("option");
              o.value = name;
              o.textContent = name;
              sel.appendChild(o);
            });
          }
          if (
            pending &&
            !Array.prototype.some.call(sel.options, function (opt) {
              return opt.value === pending;
            })
          ) {
            let ox = document.createElement("option");
            ox.value = pending;
            ox.textContent = pending + " (not in cache)";
            sel.appendChild(ox);
          }
          sel.value = pending || "";
        })
        .catch(function () {
          if (gen !== auGroupRefreshGen) return;
          if (!sel.isConnected) return;
          sel.innerHTML = "";
          let pe = document.createElement("option");
          pe.value = "";
          pe.textContent = "Could not load groups";
          sel.appendChild(pe);
        });
    }

    let prevFwSelHook = globalThis.gcHsOnFlyoutFirewallSelectionChange;
    globalThis.gcHsOnFlyoutFirewallSelectionChange = function (root) {
      if (typeof prevFwSelHook === "function") {
        try {
          prevFwSelHook(root);
        } catch (eHook) {}
      }
      try {
        if (root && root.closest && root.closest("#gc-au-flyout")) {
          refreshAuAdminProfileSelect();
          refreshAuUserGroupSelect();
        }
      } catch (eAu) {}
    };

    document.querySelectorAll('input[name="gc-au-usertype"]').forEach(function (r) {
      r.addEventListener("change", function () {
        syncAuProfileFieldVisibility();
        let ch = document.querySelector('input[name="gc-au-usertype"]:checked');
        if (ch && ch.value === "Administrator") {
          refreshAuAdminProfileSelect();
        }
      });
    });

    let tableUsers = globalThis.gcCreateNetworkEntityTable({
      prefix: "gc-auth-u",
      apiUrl: URL_USERS,
      getSelectedIds: firewallScopeIds,
      pageSyncFallbackEntities: ["user", "user_group"],
      lsKey: "ground-control-auth-users-columns-v1",
      dataRowClass: "gc-auth-u-data-row",
      colPickerAttr: "data-gc-auth-u-col",
      bulkRowSelect: true,
      rowClickable: true,
      rowAriaEntitySingular: "user",
      onRowClick: function (tr) {
        if (!tr || !tr._gcNetRow) return;
        auMode = "edit";
        auRow = tr._gcNetRow;
        document.getElementById("gc-au-flyout-title").textContent = "Edit user";
        document.getElementById("gc-au-username").disabled = true;
        let fwField = document.getElementById("gc-au-fw-field");
        if (fwField) fwField.hidden = true;
        fillUserForm(auRow.payload || {});
        openAuFlyout(true);
        refreshAuAdminProfileSelect();
        refreshAuUserGroupSelect();
      },
      labels: {
        countSingular: "user",
        countPlural: "users",
        emptyCache:
          "No users in the cache. Enable Users and User groups sync in Inventory, then sync.",
        emptyFilter: "No rows match the current search or filters.",
        loadError: "Could not load users.",
      },
    });

    let tableGroups = globalThis.gcCreateNetworkEntityTable({
      prefix: "gc-auth-g",
      apiUrl: URL_GROUPS,
      getSelectedIds: firewallScopeIds,
      pageSyncFallbackEntities: ["user", "user_group"],
      lsKey: "ground-control-auth-groups-columns-v1",
      dataRowClass: "gc-auth-g-data-row",
      colPickerAttr: "data-gc-auth-g-col",
      bulkRowSelect: true,
      rowClickable: true,
      rowAriaEntitySingular: "group",
      onRowClick: function (tr) {
        if (!tr || !tr._gcNetRow) return;
        agMode = "edit";
        agRow = tr._gcNetRow;
        document.getElementById("gc-ag-flyout-title").textContent = "Edit group";
        document.getElementById("gc-ag-name").disabled = true;
        let fwField = document.getElementById("gc-ag-fw-field");
        if (fwField) fwField.hidden = true;
        fillGroupForm(agRow.payload || {});
        openAgFlyout(true);
      },
      labels: {
        countSingular: "group",
        countPlural: "groups",
        emptyCache:
          "No user groups in the cache. Enable User groups sync in Inventory, then sync.",
        emptyFilter: "No rows match the current search or filters.",
        loadError: "Could not load groups.",
      },
    });

    let AUTH_TAB_LS = "ground-control-auth-main-tab-v1";
    let activeTab = "users";
    try {
      let s = localStorage.getItem(AUTH_TAB_LS);
      if (s === "groups" || s === "clientless_users") activeTab = s;
    } catch (e) {}

    function applyAuthTabs() {
      document.querySelectorAll("[data-gc-auth-tab]").forEach(function (btn) {
        let on = btn.dataset.gcAuthTab === activeTab;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      let pu = document.getElementById("gc-panel-auth-users");
      let pg = document.getElementById("gc-panel-auth-groups");
      let pc = document.getElementById("gc-panel-auth-clientless-users");
      if (pu) {
        pu.classList.toggle("is-active", activeTab === "users");
        pu.hidden = activeTab !== "users";
      }
      if (pg) {
        pg.classList.toggle("is-active", activeTab === "groups");
        pg.hidden = activeTab !== "groups";
      }
      if (pc) {
        pc.classList.toggle("is-active", activeTab === "clientless_users");
        pc.hidden = activeTab !== "clientless_users";
      }
      let fa = document.getElementById("gc-auth-u-filters-aside");
      let fb = document.getElementById("gc-auth-g-filters-aside");
      let fc = document.getElementById("gc-auth-cu-filters-aside");
      if (fa) fa.hidden = activeTab !== "users";
      if (fb) fb.hidden = activeTab !== "groups";
      if (fc) fc.hidden = activeTab !== "clientless_users";
    }

    document.querySelectorAll("[data-gc-auth-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeTab = btn.dataset.gcAuthTab || "users";
        try {
          localStorage.setItem(AUTH_TAB_LS, activeTab);
        } catch (e2) {}
        applyAuthTabs();
      });
    });
    applyAuthTabs();

    document.getElementById("gc-auth-u-add").addEventListener("click", function () {
      auMode = "add";
      auRow = null;
      document.getElementById("gc-au-flyout-title").textContent = "Add user";
      document.getElementById("gc-au-username").disabled = false;
      fillUserForm({});
      let fwField = document.getElementById("gc-au-fw-field");
      if (fwField) fwField.hidden = false;
      let ms = fwField && fwField.querySelector(".gc-hs-ip-host-flyout__fw-ms");
      if (ms && typeof globalThis.gcHsHydrateFlyoutFirewallPicker === "function") {
        globalThis.gcHsHydrateFlyoutFirewallPicker(
          ms.closest(".gc-if-flyout__form-body") || ms,
          { row: {} },
        );
      }
      refreshAuAdminProfileSelect();
      refreshAuUserGroupSelect();
      openAuFlyout(true);
    });

    document.getElementById("gc-auth-g-add").addEventListener("click", function () {
      agMode = "add";
      agRow = null;
      document.getElementById("gc-ag-flyout-title").textContent = "Add group";
      document.getElementById("gc-ag-name").disabled = false;
      fillGroupForm({});
      let fwField = document.getElementById("gc-ag-fw-field");
      if (fwField) fwField.hidden = false;
      let ms = fwField && fwField.querySelector(".gc-hs-ip-host-flyout__fw-ms");
      if (ms && typeof globalThis.gcHsHydrateFlyoutFirewallPicker === "function") {
        globalThis.gcHsHydrateFlyoutFirewallPicker(
          ms.closest(".gc-if-flyout__form-body") || ms,
          { row: {} },
        );
      }
      openAgFlyout(true);
    });

    function bindDel(btnId, table, url, noun) {
      let btn = document.getElementById(btnId);
      if (!btn || !table) return;
      btn.addEventListener("click", function () {
        if (typeof table.getDeleteConfigEntryIdsFromSelection !== "function") return;
        let ids = table.getDeleteConfigEntryIdsFromSelection();
        if (!ids.length) {
          bannerResult(false, "Select one or more rows.");
          return;
        }
        let qMsg = "Queue deletion of " + ids.length + " " + noun + " on the firewall(s)?";
        let cf = window.gcConfirm
          ? window.gcConfirm(qMsg, { tone: "danger", confirmLabel: "Queue deletes" })
          : Promise.resolve(globalThis.confirm(qMsg));
        cf.then(function (ok) {
          if (!ok) return;
          btn.disabled = true;
          fetch(url, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ config_entry_ids: ids }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              btn.disabled = false;
              if (!x.ok) {
                let em = (x.j && (x.j.detail || x.j.message)) || "Could not queue.";
                bannerResult(false, typeof em === "string" ? em : JSON.stringify(em));
                return;
              }
              bannerResult(true, "Delete tasks queued.");
              dispatchTaskQueueUpdated();
              if (table.refresh) table.refresh();
            })
            .catch(function () {
              btn.disabled = false;
              bannerResult(false, "Network error.");
            });
        });
      });
    }

    bindDel("gc-auth-u-delete-selected", tableUsers, U_DEL, "user(s)");
    bindDel("gc-auth-g-delete-selected", tableGroups, G_DEL, "group(s)");

    function refreshAllAuthTables() {
      if (tableUsers && tableUsers.refresh) tableUsers.refresh();
      if (tableGroups && tableGroups.refresh) tableGroups.refresh();
    }

    document.addEventListener("gc-firewall-selection-changed", function () {
      refreshAllAuthTables();
    });
    refreshAllAuthTables();

    document.getElementById("gc-au-flyout-close").addEventListener("click", function () {
      openAuFlyout(false);
    });
    document.getElementById("gc-au-cancel").addEventListener("click", function () {
      openAuFlyout(false);
    });
    document
      .getElementById("gc-au-flyout")
      .querySelector(".gc-if-flyout__backdrop")
      .addEventListener("click", function () {
        openAuFlyout(false);
      });

    document.getElementById("gc-au-form").addEventListener("submit", function (e) {
      e.preventDefault();
      let body = collectUserPayload();
      if (!body.Username || !body.Name) {
        bannerResult(false, "Username and name are required.");
        return;
      }
      if (auMode === "add") {
        let ms = document
          .getElementById("gc-au-fw-field")
          .querySelector(".gc-hs-ip-host-flyout__fw-ms");
        let fids = selectedFirewallIdsFromMs(ms);
        if (!fids.length) {
          bannerResult(false, "Select at least one firewall.");
          return;
        }
        if (!body.Password) {
          bannerResult(false, "Password is required for new users.");
          return;
        }
        let ok = 0;
        let fail = 0;
        let tot = fids.length;
        fids.forEach(function (fid) {
          fetch(U_CREATE, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ firewall_id: fid, user: body }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (x.ok) ok++;
              else fail++;
              if (ok + fail >= tot) {
                bannerResult(fail === 0, fail === 0 ? "Tasks queued." : "Some requests failed.");
                dispatchTaskQueueUpdated();
                openAuFlyout(false);
                if (tableUsers.refresh) tableUsers.refresh();
              }
            })
            .catch(function () {
              fail++;
              if (ok + fail >= tot) {
                bannerResult(false, "Network error.");
                if (tableUsers.refresh) tableUsers.refresh();
              }
            });
        });
        return;
      }
      if (!auRow || !auRow.config_entry_id) return;
      fetch(U_UPDATE, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "Ground-Control",
        },
        body: JSON.stringify({ config_entry_id: auRow.config_entry_id, user: body }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          if (!x.ok) {
            let em = (x.j && (x.j.detail || x.j.message)) || "Could not queue update.";
            bannerResult(false, typeof em === "string" ? em : JSON.stringify(em));
            return;
          }
          bannerResult(true, x.j && x.j.skipped ? "No changes." : "Update queued.");
          dispatchTaskQueueUpdated();
          openAuFlyout(false);
          if (tableUsers.refresh) tableUsers.refresh();
        })
        .catch(function () {
          bannerResult(false, "Network error.");
        });
    });

    document.getElementById("gc-ag-flyout-close").addEventListener("click", function () {
      openAgFlyout(false);
    });
    document.getElementById("gc-ag-cancel").addEventListener("click", function () {
      openAgFlyout(false);
    });
    document
      .getElementById("gc-ag-flyout")
      .querySelector(".gc-if-flyout__backdrop")
      .addEventListener("click", function () {
        openAgFlyout(false);
      });

    document.getElementById("gc-ag-form").addEventListener("submit", function (e) {
      e.preventDefault();
      let body = collectGroupPayload();
      let gn = body.GroupDetail && body.GroupDetail.Name;
      if (!gn) {
        bannerResult(false, "Group name is required.");
        return;
      }
      if (agMode === "add") {
        let ms = document
          .getElementById("gc-ag-fw-field")
          .querySelector(".gc-hs-ip-host-flyout__fw-ms");
        let fids = selectedFirewallIdsFromMs(ms);
        if (!fids.length) {
          bannerResult(false, "Select at least one firewall.");
          return;
        }
        let ok = 0;
        let fail = 0;
        let tot = fids.length;
        fids.forEach(function (fid) {
          fetch(G_CREATE, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ firewall_id: fid, group: body }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (x.ok) ok++;
              else fail++;
              if (ok + fail >= tot) {
                bannerResult(fail === 0, fail === 0 ? "Tasks queued." : "Some requests failed.");
                dispatchTaskQueueUpdated();
                openAgFlyout(false);
                if (tableGroups.refresh) tableGroups.refresh();
              }
            })
            .catch(function () {
              fail++;
              if (ok + fail >= tot) {
                bannerResult(false, "Network error.");
                if (tableGroups.refresh) tableGroups.refresh();
              }
            });
        });
        return;
      }
      if (!agRow || !agRow.config_entry_id) return;
      fetch(G_UPDATE, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "Ground-Control",
        },
        body: JSON.stringify({ config_entry_id: agRow.config_entry_id, group: body }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          if (!x.ok) {
            let em = (x.j && (x.j.detail || x.j.message)) || "Could not queue update.";
            bannerResult(false, typeof em === "string" ? em : JSON.stringify(em));
            return;
          }
          bannerResult(true, x.j && x.j.skipped ? "No changes." : "Update queued.");
          dispatchTaskQueueUpdated();
          openAgFlyout(false);
          if (tableGroups.refresh) tableGroups.refresh();
        })
        .catch(function () {
          bannerResult(false, "Network error.");
        });
    });
  };

  let lastApCombinePayload = {};
  let AP_LS_COMBINE = "ground-control-prof-ap-combine-v1";

  function escApCombine(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function apCombineModalScalar(val) {
    return '<span class="gc-net-zone-modal__scalar">' + escApCombine(val) + "</span>";
  }

  function apCombineScopePill(fw) {
    if (typeof globalThis.gcFirewallScopePillHtml === "function") {
      return globalThis.gcFirewallScopePillHtml(fw);
    }
    return escApCombine(fw);
  }

  function buildApCombineModalHtml(data) {
    let labels = (data && data.column_labels) || {};
    let rows = (data && data.rows) || [];
    let conflictRows = rows.filter(function (r) {
      if (!r) return false;
      let pf = r.adminprofile_combine_per_field;
      return r.adminprofile_combine_conflict && pf;
    });
    if (!conflictRows.length) {
      return '<p class="muted">No differing field values for this selection.</p>';
    }
    return conflictRows
      .map(function (row) {
        let hname = (row.cells && row.cells.__name) || "";
        let pf = row.adminprofile_combine_per_field || {};
        let colKeys = Object.keys(pf).sort();
        let parts =
          '<section class="gc-net-zone-modal__zone"><h3 class="gc-net-zone-modal__zn">' +
          escApCombine(hname) +
          "</h3>";
        colKeys.forEach(function (colKey) {
          let lbl = labels[colKey] || colKey;
          parts +=
            '<h4 class="gc-net-zone-modal__col">' + escApCombine(lbl).replace(/\n/g, "<br />") + "</h4>";
          parts += '<ul class="gc-net-zone-modal__fw-list">';
          let per = pf[colKey];
          Object.keys(per)
            .sort()
            .forEach(function (fw) {
              parts +=
                '<li class="gc-net-zone-modal__fw-row">' +
                apCombineScopePill(fw) +
                '<span class="gc-net-zone-modal__fw-val">' +
                apCombineModalScalar(per[fw]) +
                "</span></li>";
            });
          parts += "</ul>";
        });
        parts += "</section>";
        return parts;
      })
      .join("");
  }

  function updateApCombineChrome(data) {
    let wrap = document.getElementById("gc-prof-ap-combine-wrap");
    let inp = document.getElementById("gc-prof-ap-combine");
    if (!wrap || !inp) return;
    let conflicts = !!(data && data.adminprofile_combine_conflicts);
    let flat = !!(data && data.adminprofile_combined === false);
    wrap.classList.toggle("gc-toolbar-combine--warning", conflicts && !flat && inp.checked);
  }

  function bindApDeviceAccessCombine(table) {
    let cbx = document.getElementById("gc-prof-ap-combine");
    if (!cbx) return;

    try {
      let vp = localStorage.getItem(AP_LS_COMBINE);
      if (vp === "0") cbx.checked = false;
      else if (vp === "1") cbx.checked = true;
    } catch (eLs) {}

    cbx.addEventListener("change", function () {
      try {
        localStorage.setItem(AP_LS_COMBINE, cbx.checked ? "1" : "0");
      } catch (e2) {}
      if (table.refresh) table.refresh();
    });

    let modal = document.getElementById("gc-prof-combine-modal");
    let modalBody = document.getElementById("gc-prof-combine-modal-body");
    let modalTitle = document.getElementById("gc-prof-combine-modal-title");
    let modalClose = document.getElementById("gc-prof-combine-modal-close");
    let modalDone = document.getElementById("gc-prof-combine-modal-done");
    let modalBackdrop = document.getElementById("gc-prof-combine-modal-backdrop");

    function closeApCombineModal() {
      if (!modal) return;
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function openApCombineModal() {
      if (!modal || !modalBody) return;
      if (modalTitle) modalTitle.textContent = "Administration profile by firewall";
      modalBody.innerHTML = buildApCombineModalHtml(lastApCombinePayload);
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    cbx.addEventListener("pointerdown", function (e) {
      let data = lastApCombinePayload;
      let conflicts = !!(data && data.adminprofile_combine_conflicts);
      let flat = !!(data && data.adminprofile_combined === false);
      if (conflicts && !flat && cbx.checked && !e.shiftKey) {
        e.preventDefault();
        openApCombineModal();
      }
    });

    if (modalClose) modalClose.addEventListener("click", closeApCombineModal);
    if (modalDone) modalDone.addEventListener("click", closeApCombineModal);
    if (modalBackdrop) modalBackdrop.addEventListener("click", closeApCombineModal);
  }

  globalThis.gcInitProfilesDeviceAccessPage = function (cfg) {
    let URL_TABLE = cfg.urlTable;
    let CREATE_URL = cfg.urlCreate;
    let UPDATE_URL = cfg.urlUpdate;
    let DEL_URL = cfg.urlDeletes;
    let suppressFirewallRefreshListener = !!(cfg && cfg.suppressFirewallRefreshListener);

    let table = globalThis.gcCreateNetworkEntityTable({
      prefix: "gc-prof-ap",
      apiUrl: URL_TABLE,
      apiEntityType: "admin_profile",
      getSelectedIds: firewallScopeIds,
      pageSyncFallbackEntities: ["admin_profile"],
      lsKey: "ground-control-profiles-device-access-columns-v1",
      dataRowClass: "gc-prof-ap-data-row",
      colPickerAttr: "data-gc-prof-ap-col",
      bulkRowSelect: true,
      rowClickable: true,
      rowAriaEntitySingular: "administration profile",
      combineQuery: { param: "combine" },
      combineSyncSelected: {
        strategy: "admin_profile_create",
        createUrl: CREATE_URL,
      },
      onRowClick: function (tr) {
        if (globalThis.gcAdminProfileFlyoutOpenFromTr) globalThis.gcAdminProfileFlyoutOpenFromTr(tr);
      },
      labels: {
        countSingular: "profile",
        countPlural: "profiles",
        emptyCache:
          "No administration profiles in the cache. Enable Administration profiles sync in Inventory, then sync.",
        emptyFilter: "No rows match the current search or filters.",
        loadError: "Could not load profiles.",
      },
      afterRenderFromApi: function (data) {
        lastApCombinePayload = data || {};
        updateApCombineChrome(data);
      },
    });

    bindApDeviceAccessCombine(table);

    if (table.refresh) table.refresh();

    if (typeof globalThis.gcAdminProfileFlyoutInit === "function") {
      try {
        globalThis.gcAdminProfileFlyoutInit({
          createUrl: CREATE_URL,
          updateUrl: UPDATE_URL,
          onSaved: function () {
            if (table.refresh) table.refresh();
          },
        });
      } catch (eAp) {
        try {
          console.error("gcAdminProfileFlyoutInit failed", eAp);
        } catch (eLog) {}
      }
    }

    let apAdd = document.getElementById("gc-prof-ap-add");
    if (apAdd) {
      apAdd.addEventListener("click", function () {
        if (globalThis.gcAdminProfileFlyoutOpenCreate) globalThis.gcAdminProfileFlyoutOpenCreate();
      });
    }

    let btn = document.getElementById("gc-prof-ap-delete-selected");
    if (btn) {
      btn.addEventListener("click", function () {
        if (typeof table.getDeleteConfigEntryIdsFromSelection !== "function") return;
        let ids = table.getDeleteConfigEntryIdsFromSelection();
        if (!ids.length) {
          bannerResult(false, "Select one or more profiles.");
          return;
        }
        let qMsg2 = "Queue deletion of " + ids.length + " profile(s) on the firewall(s)?";
        let cf2 = window.gcConfirm
          ? window.gcConfirm(qMsg2, { tone: "danger", confirmLabel: "Queue deletes" })
          : Promise.resolve(globalThis.confirm(qMsg2));
        cf2.then(function (ok) {
          if (!ok) return;
          btn.disabled = true;
          fetch(DEL_URL, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ config_entry_ids: ids }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              btn.disabled = false;
              if (!x.ok) {
                let em = (x.j && (x.j.detail || x.j.message)) || "Could not queue.";
                bannerResult(false, typeof em === "string" ? em : JSON.stringify(em));
                return;
              }
              bannerResult(true, "Delete tasks queued.");
              dispatchTaskQueueUpdated();
              if (table.refresh) table.refresh();
            })
            .catch(function () {
              btn.disabled = false;
              bannerResult(false, "Network error.");
            });
        });
      });
    }

    if (!suppressFirewallRefreshListener) {
      document.addEventListener("gc-firewall-selection-changed", function () {
        if (table.refresh) table.refresh();
      });
    }
    return { table: table };
  };
})();
