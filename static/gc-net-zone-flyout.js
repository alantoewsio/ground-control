/**
 * Network · Zones add/edit flyout (combined view: scope multiselect, ApplianceAccess, conflict chrome).
 */
(function () {
  "use strict";

  let addMode = false;
  let currentRow = null;
  let initialSnapshot = "";
  let flyout = null;
  let els = {};

  let ACCESS_GROUPS = [
    {
      title: "Admin services",
      items: [
        { group: "AdminServices", leaf: "HTTPS", label: "HTTPS" },
        { group: "AdminServices", leaf: "SSH", label: "SSH" },
      ],
    },
    {
      title: "Authentication services",
      items: [
        { group: "AuthenticationServices", leaf: "ClientAuthentication", label: "Clients" },
        { group: "AuthenticationServices", leaf: "CaptivePortal", label: "Captive portal" },
        { group: "AuthenticationServices", leaf: "ADSSO", label: "AD SSO" },
        { group: "AuthenticationServices", leaf: "RadiusSSO", label: "RADIUS SSO" },
        { group: "AuthenticationServices", leaf: "ChromebookSSO", label: "Chromebook SSO" },
      ],
    },
    {
      title: "Network services",
      items: [
        { group: "NetworkServices", leaf: "DNS", label: "DNS" },
        { group: "NetworkServices", leaf: "Ping", label: "Ping/ping6" },
      ],
    },
    {
      title: "VPN services",
      items: [
        { group: "VPNServices", leaf: "IPsec", label: "IPsec" },
        { group: "VPNServices", leaf: "SSLVPN", label: "SSL VPN" },
        { group: "VPNServices", leaf: "VPNPortal", label: "VPN portal" },
        { group: "VPNServices", leaf: "RED", label: "RED" },
      ],
    },
    {
      title: "Other services",
      items: [
        { group: "OtherServices", leaf: "WebProxy", label: "Web proxy" },
        { group: "OtherServices", leaf: "WirelessProtection", label: "Wireless protection" },
        { group: "OtherServices", leaf: "UserPortal", label: "User portal" },
        { group: "OtherServices", leaf: "DynamicRouting", label: "Dynamic routing" },
        { group: "OtherServices", leaf: "SNMP", label: "SNMP" },
        { group: "OtherServices", leaf: "SMTPRelay", label: "SMTP relay" },
      ],
    },
  ];

  function combineColId(group, leaf) {
    return "ApplianceAccess." + group + "." + leaf;
  }

  function isCfgTarget() {
    return typeof globalThis.gcHsEntityTarget === "string" && globalThis.gcHsEntityTarget === "configuration";
  }

  function truthySophosFlag(x) {
    let s = String(x == null ? "" : x)
      .trim()
      .toLowerCase();
    return s === "enable" || s === "enabled" || s === "1" || s === "true" || s === "on";
  }

  function selectedScopeIdsTopBar() {
    if (isCfgTarget()) {
      if (typeof globalThis.gcGetEffectiveConfigurationIds === "function") {
        return globalThis.gcGetEffectiveConfigurationIds() || [];
      }
      if (typeof globalThis.gcGetSelectedConfigurationIds === "function") {
        return globalThis.gcGetSelectedConfigurationIds() || [];
      }
    } else {
      if (typeof globalThis.gcGetSelectedFirewallIds === "function") {
        return globalThis.gcGetSelectedFirewallIds() || [];
      }
    }
    return [];
  }

  function buildAccessGroupsHtml() {
    let parts = [];
    ACCESS_GROUPS.forEach(function (g, gi) {
      if (gi > 0) parts.push('<hr class="gc-if-flyout__rule gc-zone-flyout__access-rule" />');
      parts.push('<p class="gc-zone-flyout__access-head">' + escapeHtml(g.title) + "</p>");
      parts.push('<div class="gc-zone-flyout__access-checks">');
      g.items.forEach(function (it) {
        let cid = combineColId(it.group, it.leaf);
        parts.push(
          '<div class="gc-combine-flyout-conflict-scope gc-zone-flyout__access-line" data-gc-combine-field-keys="' +
            escapeHtml(cid) +
            '">' +
            '<label class="gc-zone-flyout__check-label">' +
            '<input type="checkbox" class="gc-zone-flyout__access-cb" data-gc-zone-g="' +
            escapeHtml(it.group) +
            '" data-gc-zone-l="' +
            escapeHtml(it.leaf) +
            '" /> ' +
            escapeHtml(it.label) +
            "</label></div>",
        );
      });
      parts.push("</div>");
    });
    return parts.join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cacheEls(root) {
    els = {
      root: root,
      title: root.querySelector("#gc-zone-flyout-title"),
      form: root.querySelector("#gc-zone-flyout-form"),
      fwSlot: root.querySelector("#gc-zone-flyout-fw-slot"),
      scopeWrap: root.querySelector("#gc-zone-flyout-scope-wrap"),
      scopeTbody: root.querySelector("#gc-zone-flyout-scope-tbody"),
      accessRoot: root.querySelector("#gc-zone-flyout-access-groups"),
      name: root.querySelector("#gc-zone-flyout-name"),
      desc: root.querySelector("#gc-zone-flyout-description"),
      members: root.querySelector("#gc-zone-flyout-members"),
      saveBtn: root.querySelector("#gc-zone-flyout-save"),
      cancelBtn: root.querySelector("#gc-zone-flyout-cancel"),
      backdrop: root.querySelector(".gc-if-flyout__backdrop"),
    };
  }

  function bindPanelResize(root) {
    let panel = root.querySelector(".gc-if-flyout__panel");
    let handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset.gcZoneResizeBound === "1") return;
    handle.dataset.gcZoneResizeBound = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      let startX = e.clientX;
      let startW = panel.getBoundingClientRect().width;
      let maxW = Math.min(960, globalThis.innerWidth - 24);
      function onMove(e2) {
        let w = startW + (startX - e2.clientX);
        w = Math.max(280, Math.min(maxW, w));
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

  function targetsMapFromRow(row) {
    let m = {};
    (row && row.zone_edit_targets ? row.zone_edit_targets : []).forEach(function (t) {
      if (!t) return;
      let sid =
        t.configuration_id != null && t.configuration_id !== ""
          ? Number(t.configuration_id)
          : t.firewall_id != null && t.firewall_id !== ""
            ? Number(t.firewall_id)
            : NaN;
      let ce = t.config_entry_id != null ? Number(t.config_entry_id) : NaN;
      if (!isNaN(sid) && sid > 0 && !isNaN(ce) && ce > 0) m[sid] = ce;
    });
    return m;
  }

  function assignedScopeIdsFromRow(row) {
    return Object.keys(targetsMapFromRow(row)).map(function (x) {
      return parseInt(x, 10);
    });
  }

  function collectFlyoutScopeIdsOrdered() {
    let root = els.form;
    if (!root) return [];
    let cfg = isCfgTarget();
    let ms = root.querySelector(cfg ? "[data-gc-cfg-ms]" : "[data-gc-fw-ms]");
    if (!ms) return [];
    let idAttr = cfg ? "data-gc-cfg-id" : "data-gc-fw-id";
    let out = [];
    ms.querySelectorAll("input[type=\"checkbox\"]").forEach(function (cb) {
      if (!cb.checked || !cb.hasAttribute(idAttr)) return;
      let n = parseInt(String(cb.getAttribute(idAttr) || ""), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function setTypeRadio(val) {
    let v = String(val || "LAN").trim().toUpperCase();
    if (v !== "DMZ") v = "LAN";
    let r = els.form.querySelector('input[name="gc-zone-flyout-type"][value="' + v + '"]');
    if (r) r.checked = true;
  }

  function getTypeRadio() {
    let r = els.form.querySelector('input[name="gc-zone-flyout-type"]:checked');
    return r ? String(r.value || "LAN").trim() : "LAN";
  }

  function populateFromFlat(flat) {
    flat = flat || {};
    if (els.name) els.name.value = String(flat.Name != null ? flat.Name : "").trim();
    if (els.desc) els.desc.value = String(flat.Description != null ? flat.Description : "").trim();
    let zt = String(flat.Type != null ? flat.Type : "LAN").trim().toUpperCase();
    setTypeRadio(zt === "DMZ" ? "DMZ" : "LAN");
    let mem = String(flat.MemberPorts != null ? flat.MemberPorts : "").trim();
    if (els.members) els.members.textContent = mem || "None";

    els.form.querySelectorAll(".gc-zone-flyout__access-cb").forEach(function (cb) {
      let g = cb.dataset.gcZoneG;
      let l = cb.dataset.gcZoneL;
      if (!g || !l) return;
      let key = combineColId(g, l);
      cb.checked = truthySophosFlag(flat[key]);
    });
  }

  function collectFormPayload() {
    let access = {};
    els.form.querySelectorAll(".gc-zone-flyout__access-cb").forEach(function (cb) {
      let g = cb.dataset.gcZoneG;
      let l = cb.dataset.gcZoneL;
      if (!g || !l) return;
      access[l] = !!cb.checked;
    });
    return {
      name: els.name ? String(els.name.value || "").trim() : "",
      description: els.desc ? String(els.desc.value || "").trim() : "",
      type: getTypeRadio(),
      access: access,
    };
  }

  function snapshotForm() {
    try {
      return JSON.stringify(collectFormPayload());
    } catch (e) {
      return "";
    }
  }

  function syncDirty() {
    if (!els.saveBtn) return;
    els.saveBtn.disabled = snapshotForm() === initialSnapshot;
  }

  function mountFirewallPicker(mode, initialIds, assignedIds) {
    if (!els.fwSlot || typeof globalThis.gcHsBuildFirewallPickerSectionHtml !== "function") return;
    els.fwSlot.innerHTML = globalThis.gcHsBuildFirewallPickerSectionHtml(mode, initialIds, assignedIds);
    if (typeof globalThis.gcHsHydrateFlyoutFirewallPicker === "function") {
      try {
        globalThis.gcHsHydrateFlyoutFirewallPicker(els.form, { row: currentRow || {} });
      } catch (e1) {}
    }
    let ms = els.form.querySelector("[data-gc-fw-ms], [data-gc-cfg-ms]");
    if (ms) {
      ms.querySelectorAll("input[type=\"checkbox\"]").forEach(function (cb) {
        cb.addEventListener("change", syncDirty);
      });
    }
  }

  function clearCombineChrome() {
    if (typeof globalThis.gcCombineFlyoutClearConflictChrome === "function") {
      try {
        globalThis.gcCombineFlyoutClearConflictChrome(flyout);
      } catch (e) {}
    }
  }

  let FLYOUT_LAYOUT_CONFLICT_IDS = [
    { lk: "__flyout.NetworkZone", id: "gc-zone-flyout-conflict-network-zone" },
    { lk: "__flyout.Hardware", id: "gc-zone-flyout-conflict-hardware" },
    { lk: "__flyout.GatewayName", id: "gc-zone-flyout-conflict-gateway-name" },
    { lk: "__flyout.GatewayIP", id: "gc-zone-flyout-conflict-gateway-ip" },
  ];

  let FLYOUT_LAYOUT_COL_LABELS = {
    "__flyout.NetworkZone": "Network zone",
    "__flyout.Hardware": "Hardware",
    "__flyout.GatewayName": "Gateway name",
    "__flyout.GatewayIP": "Gateway IP",
  };

  function setFlyoutLayoutConflictRowVisibility(row) {
    if (!flyout) return;
    let per = row && row.access_per_firewall;
    FLYOUT_LAYOUT_CONFLICT_IDS.forEach(function (d) {
      let el = flyout.querySelector("#" + d.id);
      if (!el) return;
      el.hidden = !(per && per[d.lk]);
    });
  }

  function renderScopeDetailTable(row) {
    let wrap = els.scopeWrap;
    let tb = els.scopeTbody;
    if (!wrap || !tb) return;
    let targets = row && Array.isArray(row.zone_edit_targets) ? row.zone_edit_targets : [];
    if (!targets.length) {
      wrap.hidden = true;
      tb.innerHTML = "";
      return;
    }
    wrap.hidden = false;
    tb.innerHTML = targets
      .map(function (t) {
        if (!t || typeof t !== "object") return "";
        let lab = String(t.scope_label != null ? t.scope_label : "").trim();
        let scopeCell =
          lab && typeof globalThis.gcFirewallScopePillHtml === "function"
            ? globalThis.gcFirewallScopePillHtml(lab)
            : escapeHtml(lab || "—");
        return (
          "<tr>" +
          '<td class="gc-zone-flyout__scope-cell">' +
          scopeCell +
          "</td>" +
          '<td class="gc-zone-flyout__scope-cell mono">' +
          escapeHtml(t.network_zone != null ? String(t.network_zone) : "") +
          "</td>" +
          '<td class="gc-zone-flyout__scope-cell mono">' +
          escapeHtml(t.hardware != null ? String(t.hardware) : "") +
          "</td>" +
          '<td class="gc-zone-flyout__scope-cell mono">' +
          escapeHtml(t.gateway_name != null ? String(t.gateway_name) : "") +
          "</td>" +
          '<td class="gc-zone-flyout__scope-cell mono">' +
          escapeHtml(t.gateway_ip != null ? String(t.gateway_ip) : "") +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function applyCombineChrome(row) {
    clearCombineChrome();
    setFlyoutLayoutConflictRowVisibility(row);
    if (
      row &&
      row.access_conflict &&
      row.access_per_firewall &&
      typeof globalThis.gcCombineFlyoutApplyConflictChrome === "function"
    ) {
      try {
        globalThis.gcCombineFlyoutApplyConflictChrome(flyout, row, {
          columnLabels: FLYOUT_LAYOUT_COL_LABELS,
        });
      } catch (e) {}
    }
  }

  function openFlyout() {
    if (!flyout) return;
    flyout.hidden = false;
    flyout.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (els.name) {
      try {
        els.name.focus();
      } catch (e) {}
    }
  }

  function closeFlyout() {
    if (!flyout) return;
    flyout.hidden = true;
    flyout.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    clearCombineChrome();
    setFlyoutLayoutConflictRowVisibility(null);
    if (els.scopeWrap) els.scopeWrap.hidden = true;
    if (els.scopeTbody) els.scopeTbody.innerHTML = "";
    currentRow = null;
    addMode = false;
  }

  function notifyOk() {
    if (isCfgTarget()) {
      try {
        document.dispatchEvent(new CustomEvent("gc-configuration-entries-updated"));
      } catch (e) {}
    } else {
      try {
        document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
      } catch (e2) {}
    }
    if (typeof globalThis.gcNetIfRefresh === "function") globalThis.gcNetIfRefresh();
  }

  function openAdd() {
    if (!flyout || !els.form) {
      try {
        globalThis.gcNetZoneFlyoutInit();
      } catch (eInit) {}
    }
    if (!flyout || !els.form) return;
    addMode = true;
    currentRow = null;
    if (els.title) els.title.textContent = "Add zone";
    if (els.name) {
      els.name.removeAttribute("readonly");
      els.name.value = "";
    }
    if (els.desc) els.desc.value = "";
    setTypeRadio("LAN");
    if (els.members) els.members.textContent = "None";
    els.form.querySelectorAll(".gc-zone-flyout__access-cb").forEach(function (cb) {
      cb.checked = false;
    });
    let top = selectedScopeIdsTopBar().filter(function (id) {
      return !isNaN(Number(id)) && Number(id) > 0;
    });
    mountFirewallPicker("add", top, []);
    renderScopeDetailTable(null);
    initialSnapshot = snapshotForm();
    syncDirty();
    openFlyout();
  }

  function openEdit(row) {
    if (!row || row.entity_type !== "zone") return;
    addMode = false;
    currentRow = row;
    if (els.title) els.title.textContent = "Edit zone";
    let flat = row.flat && typeof row.flat === "object" ? row.flat : {};
    populateFromFlat(flat);
    let assigned = assignedScopeIdsFromRow(row);
    mountFirewallPicker("edit", assigned, assigned);
    if (els.name) els.name.removeAttribute("readonly");
    renderScopeDetailTable(row);
    initialSnapshot = snapshotForm();
    syncDirty();
    applyCombineChrome(row);
    openFlyout();
  }

  function postJson(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "Ground-Control",
      },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, j: j };
      });
    });
  }

  function save() {
    let form = collectFormPayload();
    if (!form.name) {
      alert("Name is required.");
      return;
    }
    let upBatch = isCfgTarget()
      ? typeof globalThis.gcNetZoneApplyUpdateBatchUrl === "string"
        ? globalThis.gcNetZoneApplyUpdateBatchUrl
        : ""
      : typeof globalThis.gcNetZoneEnqueueUpdateBatchUrl === "string"
        ? globalThis.gcNetZoneEnqueueUpdateBatchUrl
        : "";
    let crBatch = isCfgTarget()
      ? typeof globalThis.gcNetZoneApplyCreateBatchUrl === "string"
        ? globalThis.gcNetZoneApplyCreateBatchUrl
        : ""
      : typeof globalThis.gcNetZoneEnqueueCreateBatchUrl === "string"
        ? globalThis.gcNetZoneEnqueueCreateBatchUrl
        : "";

    if (addMode) {
      if (!crBatch) {
        alert("Zone create URL is not configured.");
        return;
      }
      let scopeIds = collectFlyoutScopeIdsOrdered();
      if (!scopeIds.length) {
        alert(
          isCfgTarget()
            ? "Select at least one configuration in the flyout."
            : "Select at least one firewall in the flyout.",
        );
        return;
      }
      let body = isCfgTarget()
        ? { configuration_ids: scopeIds, form: form }
        : { firewall_ids: scopeIds, form: form };
      if (els.saveBtn) els.saveBtn.disabled = true;
      postJson(crBatch, body)
        .then(function (x) {
          if (els.saveBtn) els.saveBtn.disabled = false;
          if (!x.ok) {
            let em = (x.j && (x.j.detail || x.j.message)) || "Could not save.";
            alert(typeof em === "string" ? em : JSON.stringify(em));
            return;
          }
          notifyOk();
          closeFlyout();
        })
        .catch(function () {
          if (els.saveBtn) els.saveBtn.disabled = false;
          alert("Network error.");
        });
      return;
    }

    if (!upBatch) {
      alert("Zone update URL is not configured.");
      return;
    }
    let tmap = targetsMapFromRow(currentRow);
    let checked = collectFlyoutScopeIdsOrdered();
    if (!checked.length) {
      alert(
        isCfgTarget()
          ? "Select at least one configuration."
          : "Select at least one firewall.",
      );
      return;
    }
    let updateIds = [];
    let createIds = [];
    checked.forEach(function (sid) {
      if (tmap[sid]) updateIds.push(tmap[sid]);
      else createIds.push(sid);
    });

    if (els.saveBtn) els.saveBtn.disabled = true;

    function doCreates() {
      if (!createIds.length) {
        notifyOk();
        closeFlyout();
        if (els.saveBtn) els.saveBtn.disabled = false;
        return;
      }
      if (!crBatch) {
        alert("Zone create batch URL is not configured.");
        if (els.saveBtn) els.saveBtn.disabled = false;
        return;
      }
      let cbody = isCfgTarget()
        ? { configuration_ids: createIds, form: form }
        : { firewall_ids: createIds, form: form };
      postJson(crBatch, cbody)
        .then(function (x) {
          if (els.saveBtn) els.saveBtn.disabled = false;
          if (!x.ok) {
            let em = (x.j && (x.j.detail || x.j.message)) || "Could not queue zone creates.";
            alert(typeof em === "string" ? em : JSON.stringify(em));
            return;
          }
          notifyOk();
          closeFlyout();
        })
        .catch(function () {
          if (els.saveBtn) els.saveBtn.disabled = false;
          alert("Network error.");
        });
    }

    if (updateIds.length) {
      postJson(upBatch, { config_entry_ids: updateIds, form: form })
        .then(function (x) {
          if (!x.ok) {
            if (els.saveBtn) els.saveBtn.disabled = false;
            let em = (x.j && (x.j.detail || x.j.message)) || "Could not save zone updates.";
            alert(typeof em === "string" ? em : JSON.stringify(em));
            return;
          }
          doCreates();
        })
        .catch(function () {
          if (els.saveBtn) els.saveBtn.disabled = false;
          alert("Network error.");
        });
    } else {
      doCreates();
    }
  }

  function bind(root) {
    if (!root || root.dataset.gcNetZoneFlyoutBound === "1") return;
    root.dataset.gcNetZoneFlyoutBound = "1";
    flyout = root;
    cacheEls(root);
    bindPanelResize(root);
    if (els.accessRoot) els.accessRoot.innerHTML = buildAccessGroupsHtml();

    els.form.querySelectorAll(".gc-zone-flyout__access-cb").forEach(function (cb) {
      cb.addEventListener("change", syncDirty);
    });
    if (els.name) els.name.addEventListener("input", syncDirty);
    if (els.desc) els.desc.addEventListener("input", syncDirty);
    els.form.querySelectorAll('input[name="gc-zone-flyout-type"]').forEach(function (r) {
      r.addEventListener("change", syncDirty);
    });

    if (els.form) {
      els.form.addEventListener("submit", function (e) {
        e.preventDefault();
        save();
      });
    }
    if (els.cancelBtn) els.cancelBtn.addEventListener("click", closeFlyout);
    if (els.backdrop) els.backdrop.addEventListener("click", closeFlyout);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && flyout && !flyout.hidden) {
        e.preventDefault();
        closeFlyout();
      }
    });
  }

  function openFromTr(tr) {
    if (!tr || !tr._gcNetRow) return;
    openEdit(tr._gcNetRow);
  }

  globalThis.gcNetZoneFlyoutInit = function () {
    let root = document.getElementById("gc-net-zone-flyout");
    if (root) bind(root);
  };
  globalThis.gcNetZoneFlyoutOpenAdd = openAdd;
  globalThis.gcNetZoneFlyoutOpenFromTr = openFromTr;
})();
