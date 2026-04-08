/**
 * Firewalls · Configure · Authentication — users & groups tables and flyouts.
 */
(function () {
  "use strict";

  function bannerResult(ok, msg) {
    if (typeof window.gcGlobalBannerShowResult === "function") {
      window.gcGlobalBannerShowResult(ok, msg);
    } else {
      alert(msg);
    }
  }

  function dispatchTaskQueueUpdated() {
    try {
      document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
    } catch (e0) {}
  }

  function firewallScopeIds() {
    var base = [];
    if (typeof window.gcGetSelectedFirewallIds === "function") {
      try {
        base = window.gcGetSelectedFirewallIds() || [];
      } catch (eSel) {
        base = [];
      }
    }
    if (!Array.isArray(base)) base = [];
    if (base.length) return base;
    var inv = window.gcNavFirewallsJson;
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
    var out = [];
    var seen = {};
    msRoot.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      if (!cb.checked) return;
      var id = cb.getAttribute("data-gc-fw-id") || cb.getAttribute("data-gc-cfg-id");
      if (id == null) return;
      var n = parseInt(String(id), 10);
      if (isNaN(n) || n < 1 || seen[n]) return;
      seen[n] = true;
      out.push(n);
    });
    return out;
  }

  function selectedFirewallIdsFromMs(msRoot) {
    var live = collectCheckedFwIdsFromMs(msRoot);
    if (live.length) return live;
    if (!msRoot || !msRoot.getAttribute) return [];
    try {
      var a = JSON.parse(msRoot.getAttribute("data-fw-assigned-ids") || "[]");
      return Array.isArray(a) ? a.map(Number).filter(function (n) { return n > 0; }) : [];
    } catch (e) {
      return [];
    }
  }

  function openAuFlyout(open) {
    var root = document.getElementById("gc-au-flyout");
    if (!root) return;
    root.hidden = !open;
    root.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("gc-if-flyout-open", !!open);
  }

  function syncAuProfileFieldVisibility() {
    var wrap = document.getElementById("gc-au-profile-field");
    if (!wrap) return;
    var ut = "User";
    document.querySelectorAll('input[name="gc-au-usertype"]').forEach(function (r) {
      if (r.checked) ut = r.value;
    });
    wrap.hidden = ut !== "Administrator";
  }

  function openAgFlyout(open) {
    var root = document.getElementById("gc-ag-flyout");
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
    var ut = textScalar(p.UserType) || "User";
    document.querySelectorAll('input[name="gc-au-usertype"]').forEach(function (r) {
      r.checked = r.value === ut;
    });
    var profSel = document.getElementById("gc-au-profile");
    if (profSel) {
      if (ut === "Administrator") {
        var pv = textScalar(p.Profile);
        if (pv) profSel.setAttribute("data-gc-profile-pending", pv);
        else profSel.removeAttribute("data-gc-profile-pending");
      } else {
        profSel.removeAttribute("data-gc-profile-pending");
      }
    }
    document.getElementById("gc-au-password").value = "";
    var email = "";
    var el = p.EmailList;
    if (el && typeof el === "object") {
      var eid = el.EmailID;
      if (Array.isArray(eid)) email = textScalar(eid[0]);
      else email = textScalar(eid);
    }
    document.getElementById("gc-au-email").value = email;
    var grpSel = document.getElementById("gc-au-group");
    if (grpSel) {
      var gv = textScalar(p.Group);
      if (gv) grpSel.setAttribute("data-gc-group-pending", gv);
      else grpSel.removeAttribute("data-gc-group-pending");
    }
    document.getElementById("gc-au-surfing").value = textScalar(p.SurfingQuotaPolicy);
    document.getElementById("gc-au-accesstime").value = textScalar(p.AccessTimePolicy);
    document.getElementById("gc-au-datatransfer").value = textScalar(p.DataTransferPolicy);
    document.getElementById("gc-au-qos").value = textScalar(p.QoSPolicy);
    document.getElementById("gc-au-sslvpn").value = textScalar(p.SSLVPNPolicy);
    document.getElementById("gc-au-clientless").value = textScalar(p.ClientlessPolicy);
    var qd = textScalar(p.QuarantineDigest) || "Disable";
    document.querySelectorAll('input[name="gc-au-quarantine"]').forEach(function (r) {
      r.checked = r.value === qd;
    });
    var mb = textScalar(p.MACBinding) || "Disable";
    document.querySelectorAll('input[name="gc-au-macbind"]').forEach(function (r) {
      r.checked = r.value === mb;
    });
    var macs = [];
    var ml = p.MACAddressList;
    if (ml && typeof ml === "object") {
      var mm = ml.MACAddress;
      if (Array.isArray(mm)) macs = mm.map(textScalar).filter(Boolean);
      else if (mm) macs = [textScalar(mm)];
    }
    document.getElementById("gc-au-maclist").value = macs.join("\n");
    document.getElementById("gc-au-applsched").value =
      textScalar(p.ScheduleForApplianceAccess) || "All the time";
    var ar = textScalar(p.LoginRestrictionForAppliance) || "AnyNode";
    document.querySelectorAll('input[name="gc-au-admlogin"]').forEach(function (r) {
      r.checked = r.value === ar;
    });
    syncAuProfileFieldVisibility();
  }

  function collectUserPayload() {
    var ut = "User";
    document.querySelectorAll('input[name="gc-au-usertype"]').forEach(function (r) {
      if (r.checked) ut = r.value;
    });
    var email = document.getElementById("gc-au-email").value.trim();
    var macRaw = document.getElementById("gc-au-maclist").value || "";
    var macList = macRaw
      .split(/[\n,]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    var qd = "Disable";
    document.querySelectorAll('input[name="gc-au-quarantine"]').forEach(function (r) {
      if (r.checked) qd = r.value;
    });
    var mb = "Disable";
    document.querySelectorAll('input[name="gc-au-macbind"]').forEach(function (r) {
      if (r.checked) mb = r.value;
    });
    var adm = "AnyNode";
    document.querySelectorAll('input[name="gc-au-admlogin"]').forEach(function (r) {
      if (r.checked) adm = r.value;
    });
    var profVal = "";
    if (ut === "Administrator") {
      var ps = document.getElementById("gc-au-profile");
      profVal = ps ? String(ps.value || "").trim() : "";
    }
    var o = {
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
    var pw = document.getElementById("gc-au-password").value;
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
    var gd = p.GroupDetail;
    if (Array.isArray(gd) && gd.length) gd = gd[0];
    if (!gd || typeof gd !== "object") gd = {};
    document.getElementById("gc-ag-name").value = textScalar(gd.Name);
    document.getElementById("gc-ag-desc").value = textScalar(gd.Description);
    var gt = textScalar(gd.GroupType) || "Normal";
    document.getElementById("gc-ag-grouptype").value = gt === "Clientless" ? "Clientless" : "Normal";
    document.getElementById("gc-ag-surfing").value = textScalar(gd.SurfingQuotaPolicy);
    document.getElementById("gc-ag-access").value = textScalar(gd.AccessTimePolicy);
    document.getElementById("gc-ag-datatransfer").value = textScalar(gd.DataTransferPolicy);
    document.getElementById("gc-ag-qos").value = textScalar(gd.QoSPolicy);
    document.getElementById("gc-ag-sslvpn").value = textScalar(gd.SSLVPNPolicy);
    document.getElementById("gc-ag-clientless").value = textScalar(gd.ClientlessPolicy);
    var l2 = textScalar(gd.L2TP) || "Disable";
    document.querySelectorAll('input[name="gc-ag-l2tp"]').forEach(function (r) {
      r.checked = r.value === l2;
    });
    var pp = textScalar(gd.PPTP) || "Disable";
    document.querySelectorAll('input[name="gc-ag-pptp"]').forEach(function (r) {
      r.checked = r.value === pp;
    });
    var qd = textScalar(gd.QuarantineDigest) || "Enable";
    document.querySelectorAll('input[name="gc-ag-quarantine"]').forEach(function (r) {
      r.checked = r.value === qd;
    });
    var mb = textScalar(gd.MACBinding) || "Disable";
    document.querySelectorAll('input[name="gc-ag-macbind"]').forEach(function (r) {
      r.checked = r.value === mb;
    });
    var lr = textScalar(gd.LoginRestriction) || "AnyNode";
    document.querySelectorAll('input[name="gc-ag-loginrestriction"]').forEach(function (r) {
      r.checked = r.value === lr;
    });
  }

  function collectGroupPayload() {
    var l2 = "Disable";
    document.querySelectorAll('input[name="gc-ag-l2tp"]').forEach(function (r) {
      if (r.checked) l2 = r.value;
    });
    var pp = "Disable";
    document.querySelectorAll('input[name="gc-ag-pptp"]').forEach(function (r) {
      if (r.checked) pp = r.value;
    });
    var qd = "Enable";
    document.querySelectorAll('input[name="gc-ag-quarantine"]').forEach(function (r) {
      if (r.checked) qd = r.value;
    });
    var mb = "Disable";
    document.querySelectorAll('input[name="gc-ag-macbind"]').forEach(function (r) {
      if (r.checked) mb = r.value;
    });
    var lr = "AnyNode";
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

  window.gcInitAuthenticationPage = function (cfg) {
    var URL_USERS = cfg.urlUsers;
    var URL_GROUPS = cfg.urlGroups;
    var U_CREATE = cfg.urlUserCreate;
    var U_UPDATE = cfg.urlUserUpdate;
    var U_DEL = cfg.urlUserDeletes;
    var G_CREATE = cfg.urlGroupCreate;
    var G_UPDATE = cfg.urlGroupUpdate;
    var G_DEL = cfg.urlGroupDeletes;

    var auMode = "edit";
    var auRow = null;
    var agMode = "edit";
    var agRow = null;

    var URL_ADMIN_PROFILE_OPTS = (cfg && cfg.urlAdminProfileOptions) || "";
    var URL_USER_GROUP_OPTS = (cfg && cfg.urlUserGroupOptions) || "";
    var auProfileRefreshGen = 0;
    var auGroupRefreshGen = 0;

    function auFlyoutFirewallIdsForPicker() {
      var ids = [];
      if (auMode === "edit" && auRow && auRow.firewall_id != null) {
        var f0 = Number(auRow.firewall_id);
        if (!isNaN(f0) && f0 > 0) ids = [f0];
      } else {
        var fwF = document.getElementById("gc-au-fw-field");
        var ms0 = fwF && fwF.querySelector(".gc-hs-ip-host-flyout__fw-ms");
        ids = collectCheckedFwIdsFromMs(ms0);
        if (!ids.length) ids = selectedFirewallIdsFromMs(ms0);
      }
      return ids;
    }

    function refreshAuAdminProfileSelect() {
      var utCur = "User";
      document.querySelectorAll('input[name="gc-au-usertype"]').forEach(function (r) {
        if (r.checked) utCur = r.value;
      });
      if (utCur !== "Administrator") return;

      var gen = ++auProfileRefreshGen;
      var sel = document.getElementById("gc-au-profile");
      if (!sel) return;
      var ids = auFlyoutFirewallIdsForPicker();
      var pendingRaw = sel.getAttribute("data-gc-profile-pending");
      sel.removeAttribute("data-gc-profile-pending");
      var pending = pendingRaw != null ? String(pendingRaw).trim() : "";

      if (!URL_ADMIN_PROFILE_OPTS) {
        sel.innerHTML = "";
        var pm = document.createElement("option");
        pm.value = "";
        pm.textContent = "Profile options unavailable";
        sel.appendChild(pm);
        sel.disabled = true;
        return;
      }

      if (!ids.length) {
        sel.innerHTML = "";
        var oz = document.createElement("option");
        oz.value = "";
        oz.textContent = "Select firewall(s) first…";
        sel.appendChild(oz);
        sel.disabled = true;
        return;
      }

      sel.disabled = false;
      var url =
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
          var p0 = document.createElement("option");
          p0.value = "";
          p0.textContent = "Select profile…";
          sel.appendChild(p0);
          if (!x.ok) return;
          var opts = (x.j && x.j.options) || [];
          if (Array.isArray(opts)) {
            opts.forEach(function (name) {
              if (!name) return;
              var o = document.createElement("option");
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
            var ox = document.createElement("option");
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
          var pe = document.createElement("option");
          pe.value = "";
          pe.textContent = "Could not load profiles";
          sel.appendChild(pe);
        });
    }

    function refreshAuUserGroupSelect() {
      var gen = ++auGroupRefreshGen;
      var sel = document.getElementById("gc-au-group");
      if (!sel) return;
      var ids = auFlyoutFirewallIdsForPicker();
      var pendingRaw = sel.getAttribute("data-gc-group-pending");
      sel.removeAttribute("data-gc-group-pending");
      var pending = pendingRaw != null ? String(pendingRaw).trim() : "";

      if (!URL_USER_GROUP_OPTS) {
        sel.innerHTML = "";
        var pm = document.createElement("option");
        pm.value = "";
        pm.textContent = "Group options unavailable";
        sel.appendChild(pm);
        sel.disabled = true;
        return;
      }

      if (!ids.length) {
        sel.innerHTML = "";
        var oz = document.createElement("option");
        oz.value = "";
        oz.textContent = "Select firewall(s) first…";
        sel.appendChild(oz);
        sel.disabled = true;
        return;
      }

      sel.disabled = false;
      var url =
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
          var p0 = document.createElement("option");
          p0.value = "";
          p0.textContent = "— No group —";
          sel.appendChild(p0);
          if (!x.ok) return;
          var opts = (x.j && x.j.options) || [];
          if (Array.isArray(opts)) {
            opts.forEach(function (name) {
              if (!name) return;
              var o = document.createElement("option");
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
            var ox = document.createElement("option");
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
          var pe = document.createElement("option");
          pe.value = "";
          pe.textContent = "Could not load groups";
          sel.appendChild(pe);
        });
    }

    var prevFwSelHook = window.gcHsOnFlyoutFirewallSelectionChange;
    window.gcHsOnFlyoutFirewallSelectionChange = function (root) {
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
        var ch = document.querySelector('input[name="gc-au-usertype"]:checked');
        if (ch && ch.value === "Administrator") {
          refreshAuAdminProfileSelect();
        }
      });
    });

    var tableUsers = window.gcCreateNetworkEntityTable({
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
        var fwField = document.getElementById("gc-au-fw-field");
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

    var tableGroups = window.gcCreateNetworkEntityTable({
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
        var fwField = document.getElementById("gc-ag-fw-field");
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

    var AUTH_TAB_LS = "ground-control-auth-main-tab-v1";
    var activeTab = "users";
    try {
      var s = localStorage.getItem(AUTH_TAB_LS);
      if (s === "groups") activeTab = "groups";
    } catch (e) {}

    function applyAuthTabs() {
      document.querySelectorAll("[data-gc-auth-tab]").forEach(function (btn) {
        var on = btn.getAttribute("data-gc-auth-tab") === activeTab;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
      var pu = document.getElementById("gc-panel-auth-users");
      var pg = document.getElementById("gc-panel-auth-groups");
      if (pu) {
        pu.classList.toggle("is-active", activeTab === "users");
        pu.hidden = activeTab !== "users";
      }
      if (pg) {
        pg.classList.toggle("is-active", activeTab === "groups");
        pg.hidden = activeTab !== "groups";
      }
      var fa = document.getElementById("gc-auth-u-filters-aside");
      var fb = document.getElementById("gc-auth-g-filters-aside");
      if (fa) fa.hidden = activeTab !== "users";
      if (fb) fb.hidden = activeTab !== "groups";
    }

    document.querySelectorAll("[data-gc-auth-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeTab = btn.getAttribute("data-gc-auth-tab") || "users";
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
      var fwField = document.getElementById("gc-au-fw-field");
      if (fwField) fwField.hidden = false;
      var ms = fwField && fwField.querySelector(".gc-hs-ip-host-flyout__fw-ms");
      if (ms && typeof window.gcHsHydrateFlyoutFirewallPicker === "function") {
        window.gcHsHydrateFlyoutFirewallPicker(
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
      var fwField = document.getElementById("gc-ag-fw-field");
      if (fwField) fwField.hidden = false;
      var ms = fwField && fwField.querySelector(".gc-hs-ip-host-flyout__fw-ms");
      if (ms && typeof window.gcHsHydrateFlyoutFirewallPicker === "function") {
        window.gcHsHydrateFlyoutFirewallPicker(
          ms.closest(".gc-if-flyout__form-body") || ms,
          { row: {} },
        );
      }
      openAgFlyout(true);
    });

    function bindDel(btnId, table, url, noun) {
      var btn = document.getElementById(btnId);
      if (!btn || !table) return;
      btn.addEventListener("click", function () {
        if (typeof table.getDeleteConfigEntryIdsFromSelection !== "function") return;
        var ids = table.getDeleteConfigEntryIdsFromSelection();
        if (!ids.length) {
          bannerResult(false, "Select one or more rows.");
          return;
        }
        if (
          !window.confirm(
            "Queue deletion of " + ids.length + " " + noun + " on the firewall(s)?",
          )
        ) {
          return;
        }
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
              var em = (x.j && (x.j.detail || x.j.message)) || "Could not queue.";
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
      var body = collectUserPayload();
      if (!body.Username || !body.Name) {
        bannerResult(false, "Username and name are required.");
        return;
      }
      if (auMode === "add") {
        var ms = document
          .getElementById("gc-au-fw-field")
          .querySelector(".gc-hs-ip-host-flyout__fw-ms");
        var fids = selectedFirewallIdsFromMs(ms);
        if (!fids.length) {
          bannerResult(false, "Select at least one firewall.");
          return;
        }
        if (!body.Password) {
          bannerResult(false, "Password is required for new users.");
          return;
        }
        var ok = 0;
        var fail = 0;
        var tot = fids.length;
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
            var em = (x.j && (x.j.detail || x.j.message)) || "Could not queue update.";
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
      var body = collectGroupPayload();
      var gn = body.GroupDetail && body.GroupDetail.Name;
      if (!gn) {
        bannerResult(false, "Group name is required.");
        return;
      }
      if (agMode === "add") {
        var ms = document
          .getElementById("gc-ag-fw-field")
          .querySelector(".gc-hs-ip-host-flyout__fw-ms");
        var fids = selectedFirewallIdsFromMs(ms);
        if (!fids.length) {
          bannerResult(false, "Select at least one firewall.");
          return;
        }
        var ok = 0;
        var fail = 0;
        var tot = fids.length;
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
            var em = (x.j && (x.j.detail || x.j.message)) || "Could not queue update.";
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

  var lastApCombinePayload = {};
  var AP_LS_COMBINE = "ground-control-prof-ap-combine-v1";

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
    if (typeof window.gcFirewallScopePillHtml === "function") {
      return window.gcFirewallScopePillHtml(fw);
    }
    return escApCombine(fw);
  }

  function buildApCombineModalHtml(data) {
    var labels = (data && data.column_labels) || {};
    var rows = (data && data.rows) || [];
    var conflictRows = rows.filter(function (r) {
      if (!r) return false;
      var pf = r.adminprofile_combine_per_field;
      return r.adminprofile_combine_conflict && pf;
    });
    if (!conflictRows.length) {
      return '<p class="muted">No differing field values for this selection.</p>';
    }
    return conflictRows
      .map(function (row) {
        var hname = (row.cells && row.cells.__name) || "";
        var pf = row.adminprofile_combine_per_field || {};
        var colKeys = Object.keys(pf).sort();
        var parts =
          '<section class="gc-net-zone-modal__zone"><h3 class="gc-net-zone-modal__zn">' +
          escApCombine(hname) +
          "</h3>";
        colKeys.forEach(function (colKey) {
          var lbl = labels[colKey] || colKey;
          parts +=
            '<h4 class="gc-net-zone-modal__col">' + escApCombine(lbl).replace(/\n/g, "<br />") + "</h4>";
          parts += '<ul class="gc-net-zone-modal__fw-list">';
          var per = pf[colKey];
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
    var wrap = document.getElementById("gc-prof-ap-combine-wrap");
    var inp = document.getElementById("gc-prof-ap-combine");
    if (!wrap || !inp) return;
    var conflicts = !!(data && data.adminprofile_combine_conflicts);
    var flat = !!(data && data.adminprofile_combined === false);
    wrap.classList.toggle("gc-toolbar-combine--warning", conflicts && !flat && inp.checked);
  }

  function bindApDeviceAccessCombine(table) {
    var cbx = document.getElementById("gc-prof-ap-combine");
    if (!cbx) return;

    try {
      var vp = localStorage.getItem(AP_LS_COMBINE);
      if (vp === "0") cbx.checked = false;
      else if (vp === "1") cbx.checked = true;
    } catch (eLs) {}

    cbx.addEventListener("change", function () {
      try {
        localStorage.setItem(AP_LS_COMBINE, cbx.checked ? "1" : "0");
      } catch (e2) {}
      if (table.refresh) table.refresh();
    });

    var modal = document.getElementById("gc-prof-combine-modal");
    var modalBody = document.getElementById("gc-prof-combine-modal-body");
    var modalTitle = document.getElementById("gc-prof-combine-modal-title");
    var modalClose = document.getElementById("gc-prof-combine-modal-close");
    var modalDone = document.getElementById("gc-prof-combine-modal-done");
    var modalBackdrop = document.getElementById("gc-prof-combine-modal-backdrop");

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
      var data = lastApCombinePayload;
      var conflicts = !!(data && data.adminprofile_combine_conflicts);
      var flat = !!(data && data.adminprofile_combined === false);
      if (conflicts && !flat && cbx.checked && !e.shiftKey) {
        e.preventDefault();
        openApCombineModal();
      }
    });

    if (modalClose) modalClose.addEventListener("click", closeApCombineModal);
    if (modalDone) modalDone.addEventListener("click", closeApCombineModal);
    if (modalBackdrop) modalBackdrop.addEventListener("click", closeApCombineModal);
  }

  window.gcInitProfilesDeviceAccessPage = function (cfg) {
    var URL_TABLE = cfg.urlTable;
    var CREATE_URL = cfg.urlCreate;
    var UPDATE_URL = cfg.urlUpdate;
    var DEL_URL = cfg.urlDeletes;
    var suppressFirewallRefreshListener = !!(cfg && cfg.suppressFirewallRefreshListener);

    var table = window.gcCreateNetworkEntityTable({
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
        if (window.gcAdminProfileFlyoutOpenFromTr) window.gcAdminProfileFlyoutOpenFromTr(tr);
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

    if (typeof window.gcAdminProfileFlyoutInit === "function") {
      try {
        window.gcAdminProfileFlyoutInit({
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

    var apAdd = document.getElementById("gc-prof-ap-add");
    if (apAdd) {
      apAdd.addEventListener("click", function () {
        if (window.gcAdminProfileFlyoutOpenCreate) window.gcAdminProfileFlyoutOpenCreate();
      });
    }

    var btn = document.getElementById("gc-prof-ap-delete-selected");
    if (btn) {
      btn.addEventListener("click", function () {
        if (typeof table.getDeleteConfigEntryIdsFromSelection !== "function") return;
        var ids = table.getDeleteConfigEntryIdsFromSelection();
        if (!ids.length) {
          bannerResult(false, "Select one or more profiles.");
          return;
        }
        if (!window.confirm("Queue deletion of " + ids.length + " profile(s) on the firewall(s)?")) {
          return;
        }
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
              var em = (x.j && (x.j.detail || x.j.message)) || "Could not queue.";
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
    }

    if (!suppressFirewallRefreshListener) {
      document.addEventListener("gc-firewall-selection-changed", function () {
        if (table.refresh) table.refresh();
      });
    }
    return { table: table };
  };
})();
