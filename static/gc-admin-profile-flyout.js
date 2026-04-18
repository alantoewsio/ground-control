/**
 * Administration profile flyout: permission matrix + queue create/update.
 */
(function () {
  "use strict";

  let LEVELS = ["None", "Read-Only", "Read-Write"];

  /** Rows: { g: "Group title" } or { k: "Dot.Path", label: "…", d: depth } */
  let ROWS = [
    { k: "Dashboard", label: "Control center", d: 0 },
    { k: "Wizard", label: "Initial setup", d: 0 },
    { g: "System" },
    { k: "System.SetSystemProfile", label: "System", d: 1 },
    { k: "System.Profile", label: "Device access profile", d: 1 },
    { k: "System.Password", label: "Password", d: 1 },
    { k: "System.CentralManagement", label: "Central management", d: 1 },
    { k: "System.Backup", label: "Backup", d: 1 },
    { k: "System.Restore", label: "Restore", d: 1 },
    { k: "System.Firmware", label: "Firmware", d: 1 },
    { k: "System.Licensing", label: "Licensing", d: 1 },
    { k: "System.Services", label: "Services", d: 1 },
    { k: "System.Updates", label: "Updates", d: 1 },
    { k: "System.RebootShutdown", label: "Reboot/shutdown", d: 1 },
    { k: "System.HA", label: "HA", d: 1 },
    { k: "System.DownloadCertificates", label: "Download certificates", d: 1 },
    {
      k: "System.OtherCertificateConfiguration",
      label: "Other certificate configuration",
      d: 1,
    },
    { k: "System.Diagnostics", label: "Diagnostics", d: 1 },
    { k: "System.OtherSystemConfiguration", label: "Other system configuration", d: 1 },
    { k: "Objects", label: "Objects", d: 0 },
    { k: "Network", label: "Network", d: 0 },
    { g: "Identity" },
    { k: "Identity.SetIdentityProfile", label: "Identity", d: 1 },
    { k: "Identity.Authentication", label: "Authentication", d: 1 },
    { k: "Identity.Groups", label: "Groups", d: 1 },
    { k: "Identity.ExportUsers", label: "Export users", d: 1 },
    { k: "Identity.Users", label: "Users", d: 1 },
    { k: "Identity.AdministratorUsers", label: "Administrator users", d: 1 },
    { k: "Identity.GuestUsersManagement", label: "Guest users management", d: 1 },
    { k: "Identity.OtherGuestUserSettings", label: "Other guest user settings", d: 1 },
    { k: "Identity.Policy", label: "Policy", d: 1 },
    {
      k: "Identity.TestExternalServerConnectivity",
      label: "Test external server connectivity",
      d: 1,
    },
    { k: "Identity.DisconnectLiveUser", label: "Manage live users", d: 1 },
    { g: "Wireless protection" },
    { k: "WirelessProtection.SetWirelessProtection", label: "Wireless protection", d: 1 },
    { k: "WirelessProtection.WirelessProtectionOverview", label: "Overview", d: 1 },
    { k: "WirelessProtection.WirelessProtectionSettings", label: "Global settings", d: 1 },
    {
      k: "WirelessProtection.WirelessProtectionNetworkNetwork",
      label: "Wireless networks",
      d: 1,
    },
    { k: "WirelessProtection.WirelessProtectionAccessPoint", label: "Access points", d: 1 },
    { k: "WirelessProtection.WirelessProtectionMesh", label: "Mesh networks", d: 1 },
    { k: "Firewall", label: "Rules and policies", d: 0 },
    { g: "VPN" },
    { k: "VPN.SetVPNProfile", label: "VPN", d: 1 },
    { k: "VPN.ConnectTunnel", label: "Connect tunnel", d: 1 },
    { k: "VPN.OtherVPNConfigurations", label: "Other VPN configurations", d: 1 },
    { k: "IPS", label: "IPS", d: 0 },
    { k: "WebFilter", label: "Web & content filter", d: 0 },
    { k: "CloudApplicationDashboard", label: "Cloud application dashboard", d: 0 },
    { k: "ApplicationFilter", label: "Application filter", d: 0 },
    { k: "ZeroDayProtection", label: "Zero-day protection", d: 0 },
    { g: "WAF" },
    { k: "WAF.SetWAFProfile", label: "WAF", d: 1 },
    { k: "WAF.Alerts", label: "Alerts", d: 1 },
    { k: "WAF.OtherWAFConfiguration", label: "Other WAF configuration", d: 1 },
    { k: "IM", label: "IM", d: 0 },
    { k: "QoS", label: "Traffic shaping", d: 0 },
    { k: "EmailProtection", label: "Email protection", d: 0 },
    { k: "TrafficDiscovery", label: "Traffic discovery", d: 0 },
    { g: "Logs & reports" },
    { k: "LogsReports.SetLogsReportsProfile", label: "Logs & reports", d: 1 },
    { k: "LogsReports.Configuration", label: "Configuration", d: 1 },
    { k: "LogsReports.LogViewer", label: "Log viewer", d: 1 },
    { k: "LogsReports.ReportsAccess", label: "Reports access", d: 1 },
    {
      k: "LogsReports.Four-EyeAuthenticationSettings",
      label: "Data anonymization settings",
      d: 1,
    },
    { k: "LogsReports.De-Anonymization", label: "De-anonymization", d: 1 },
  ];

  let CREATE_URL = "";
  let UPDATE_URL = "";
  let mode = "edit";
  let currentRow = null;
  /** @type {{ config_entry_id: number, firewall_id: number }[]} */
  let apEditTargets = [];
  let state = {};

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

  function pathParts(dotKey) {
    return String(dotKey || "")
      .split(".")
      .filter(Boolean);
  }

  function getDeep(obj, dotKey) {
    let p = pathParts(dotKey);
    let cur = obj;
    for (let i = 0; i < p.length; i++) {
      if (!cur || typeof cur !== "object") return "None";
      cur = cur[p[i]];
    }
    if (cur == null || cur === "") return "None";
    return String(cur);
  }

  function setDeep(obj, dotKey, val) {
    let p = pathParts(dotKey);
    if (!p.length) return;
    let cur = obj;
    for (let i = 0; i < p.length - 1; i++) {
      let k = p[i];
      if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
      cur = cur[k];
    }
    cur[p[p.length - 1]] = val;
  }

  function defaultProfileShape(name) {
    let o = { Name: name || "" };
    ROWS.forEach(function (r) {
      if (r.k) setDeep(o, r.k, "None");
    });
    return o;
  }

  function mergeFromPayload(raw) {
    let base = defaultProfileShape("");
    if (raw && typeof raw === "object") {
      Object.keys(raw).forEach(function (k) {
        if (k === "Name") base.Name = raw.Name;
        else if (raw[k] != null && typeof raw[k] === "object" && !Array.isArray(raw[k])) {
          if (!base[k] || typeof base[k] !== "object") base[k] = {};
          Object.assign(base[k], raw[k]);
        } else if (typeof raw[k] !== "undefined") {
          base[k] = raw[k];
        }
      });
    }
    return base;
  }

  function renderTable(wrap) {
    if (!wrap) return;
    let esc =
      globalThis.gcEscapeHtmlForNetEntity ||
      function (s) {
        return String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      };
    let h =
      '<table class="gc-ap-perm-table"><thead><tr><th class="gc-ap-perm-label">Configuration</th>';
    LEVELS.forEach(function (L) {
      h += "<th class=\"gc-ap-perm-radio\">" + esc(L) + "</th>";
    });
    h += "</tr></thead><tbody>";
    ROWS.forEach(function (r, idx) {
      if (r.g) {
        h +=
          '<tr class="gc-ap-perm-group-row"><td colspan="4">' + esc(r.g) + "</td></tr>";
        return;
      }
      let id = "gc-ap-r-" + idx;
      let v = getDeep(state, r.k);
      let d = r.d || 0;
      h +=
        '<tr class="gc-ap-perm-depth-' +
        d +
        '"><td class="gc-ap-perm-label">' +
        esc(r.label) +
        "</td>";
      LEVELS.forEach(function (L) {
        let chk = L === v;
        h +=
          '<td class="gc-ap-perm-radio"><label><input type="radio" name="' +
          id +
          '" value="' +
          esc(L) +
          '"' +
          (chk ? " checked" : "") +
          " /></label></td>";
      });
      h += "</tr>";
    });
    h += "</tbody></table>";
    wrap.innerHTML = h;
    wrap.querySelectorAll('input[type="radio"]').forEach(function (inp) {
      inp.addEventListener("change", function () {
        let m = String(inp.name || "").match(/^gc-ap-r-(\d+)$/);
        if (!m) return;
        let rowIdx = parseInt(m[1], 10);
        let row = ROWS[rowIdx];
        if (!row || !row.k) return;
        setDeep(state, row.k, inp.value);
      });
    });
  }

  function readTableIntoState(wrap) {
    if (!wrap) return;
    ROWS.forEach(function (r, idx) {
      if (r.g) return;
      let id = "gc-ap-r-" + idx;
      let sel = wrap.querySelector('input[name="' + id + '"]:checked');
      if (sel) setDeep(state, r.k, sel.value);
    });
  }

  function openFlyout(root, open) {
    if (!root) return;
    root.hidden = !open;
    root.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("gc-if-flyout-open", !!open);
  }

  function collectApFirewallIds(ms) {
    if (!ms) return [];
    let out = [];
    ms.querySelectorAll('input[type="checkbox"][data-gc-fw-id]').forEach(function (cb) {
      if (!cb.checked) return;
      let n = parseInt(String(cb.dataset.gcFwId || ""), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function buildApEditTargets(row) {
    let out = [];
    if (!row) return out;
    if (Array.isArray(row.adminprofile_edit_targets) && row.adminprofile_edit_targets.length) {
      row.adminprofile_edit_targets.forEach(function (t) {
        if (!t || t.config_entry_id == null || t.firewall_id == null) return;
        out.push({
          config_entry_id: Number(t.config_entry_id),
          firewall_id: Number(t.firewall_id),
        });
      });
    } else if (row.config_entry_id != null && row.firewall_id != null) {
      out.push({
        config_entry_id: Number(row.config_entry_id),
        firewall_id: Number(row.firewall_id),
      });
    }
    return out;
  }

  function init(cfg) {
    CREATE_URL = cfg.createUrl || "";
    UPDATE_URL = cfg.updateUrl || "";
    let root = document.getElementById("gc-ap-flyout");
    let form = document.getElementById("gc-ap-form");
    let title = document.getElementById("gc-ap-flyout-title");
    let nameInp = document.getElementById("gc-ap-name");
    let wrap = document.getElementById("gc-ap-perm-wrap");
    let fwField = document.getElementById("gc-ap-fw-field");
    let msRoot = fwField ? fwField.querySelector(".gc-hs-ip-host-flyout__fw-ms") : null;

    function close() {
      openFlyout(root, false);
      currentRow = null;
    }

    let apClose = document.getElementById("gc-ap-flyout-close");
    let apCancel = document.getElementById("gc-ap-cancel");
    let apBackdrop = root ? root.querySelector(".gc-if-flyout__backdrop") : null;
    if (apClose) apClose.addEventListener("click", close);
    if (apCancel) apCancel.addEventListener("click", close);
    if (apBackdrop) apBackdrop.addEventListener("click", close);

    if (!root || !form) {
      globalThis.gcAdminProfileFlyoutOpenCreate = function () {};
      globalThis.gcAdminProfileFlyoutOpenFromTr = function () {};
      return;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      readTableIntoState(wrap);
      let profile = JSON.parse(JSON.stringify(state));
      profile.Name = (nameInp && nameInp.value) || profile.Name || "";

      if (mode === "add") {
        let ids = collectApFirewallIds(msRoot);
        if (!ids.length) {
          bannerResult(false, "Select at least one firewall.");
          return;
        }
        if (!CREATE_URL) {
          bannerResult(false, "Create URL not configured.");
          return;
        }
        let done = 0;
        let fail = 0;
        let total = ids.length;
        ids.forEach(function (fid) {
          fetch(CREATE_URL, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ firewall_id: fid, profile: profile }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (x.ok) done++;
              else fail++;
              if (done + fail >= total) {
                bannerResult(
                  fail === 0,
                  fail === 0
                    ? "Queued " + done + " profile create task(s)."
                    : "Some tasks failed (" + fail + ").",
                );
                dispatchTaskQueueUpdated();
                close();
                if (cfg.onSaved) cfg.onSaved();
              }
            })
            .catch(function () {
              fail++;
              if (done + fail >= total) {
                bannerResult(false, "Network error.");
                if (cfg.onSaved) cfg.onSaved();
              }
            });
        });
        return;
      }

      let selFw = collectApFirewallIds(msRoot);
      if (!selFw.length) {
        bannerResult(false, "Select at least one firewall.");
        return;
      }
      let fwToCe = {};
      apEditTargets.forEach(function (t) {
        if (!t || t.firewall_id == null || t.config_entry_id == null) return;
        let fid = parseInt(String(t.firewall_id), 10);
        let ce = parseInt(String(t.config_entry_id), 10);
        if (!isNaN(fid) && fid > 0 && !isNaN(ce) && ce > 0) fwToCe[fid] = ce;
      });
      let entryIds = [];
      selFw.forEach(function (fid) {
        if (fwToCe[fid]) entryIds.push(fwToCe[fid]);
      });
      let createFwIds = selFw.filter(function (fid) {
        return !fwToCe[fid];
      });

      if (!entryIds.length && !createFwIds.length) {
        bannerResult(false, "Nothing to save.");
        return;
      }

      function afterAllOk(msg) {
        bannerResult(true, msg);
        dispatchTaskQueueUpdated();
        close();
        if (cfg.onSaved) cfg.onSaved();
      }

      function runProfileCreates(msgPrefix) {
        if (!createFwIds.length) {
          afterAllOk(msgPrefix || "Saved.");
          return;
        }
        if (!CREATE_URL) {
          bannerResult(false, "Create URL not configured.");
          return;
        }
        let doneC = 0;
        let failC = 0;
        let totalC = createFwIds.length;
        let lastErrC = "";
        function finishCreates() {
          if (doneC + failC < totalC) return;
          if (failC === 0) {
            let tail =
              totalC === 1 ? "1 create task queued." : totalC + " create tasks queued.";
            afterAllOk(msgPrefix ? msgPrefix + " " + tail : tail.charAt(0).toUpperCase() + tail.slice(1));
          } else if (doneC === 0) {
            bannerResult(false, lastErrC || "Could not queue creates.");
          } else {
            bannerResult(false, doneC + " of " + totalC + " creates succeeded. " + (lastErrC || ""));
            dispatchTaskQueueUpdated();
            close();
            if (cfg.onSaved) cfg.onSaved();
          }
        }
        createFwIds.forEach(function (fid) {
          fetch(CREATE_URL, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ firewall_id: fid, profile: profile }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (x.ok) doneC++;
              else {
                failC++;
                let emc = (x.j && (x.j.detail || x.j.message)) || "Could not queue.";
                lastErrC = typeof emc === "string" ? emc : JSON.stringify(emc);
              }
              finishCreates();
            })
            .catch(function () {
              failC++;
              lastErrC = "Network error.";
              finishCreates();
            });
        });
      }

      if (!entryIds.length) {
        runProfileCreates("");
        return;
      }
      if (!UPDATE_URL) {
        bannerResult(false, "Update URL not configured.");
        return;
      }
      let doneU = 0;
      let failU = 0;
      let totalU = entryIds.length;
      let lastErrU = "";
      function finishUpdates() {
        if (doneU + failU < totalU) return;
        if (failU > 0) {
          if (doneU === 0) bannerResult(false, lastErrU || "Could not queue updates.");
          else {
            bannerResult(false, doneU + " of " + totalU + " updates succeeded. " + (lastErrU || ""));
            dispatchTaskQueueUpdated();
            close();
            if (cfg.onSaved) cfg.onSaved();
          }
          return;
        }
        let upMsg = totalU === 1 ? "Update queued." : "Queued " + totalU + " update task(s).";
        runProfileCreates(upMsg);
      }
      entryIds.forEach(function (ceid) {
        fetch(UPDATE_URL, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "Ground-Control",
          },
          body: JSON.stringify({
            config_entry_id: ceid,
            profile: profile,
          }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, j: j };
            });
          })
          .then(function (x) {
            if (x.ok) doneU++;
            else {
              failU++;
              let em = (x.j && (x.j.detail || x.j.message)) || "Could not queue.";
              lastErrU = typeof em === "string" ? em : JSON.stringify(em);
            }
            finishUpdates();
          })
          .catch(function () {
            failU++;
            lastErrU = "Network error.";
            finishUpdates();
          });
      });
    });

    globalThis.gcAdminProfileFlyoutOpenCreate = function () {
      mode = "add";
      currentRow = null;
      apEditTargets = [];
      if (title) title.textContent = "Add profile";
      if (nameInp) {
        nameInp.value = "";
        nameInp.disabled = false;
      }
      state = defaultProfileShape("");
      if (fwField) fwField.hidden = false;
      if (msRoot) {
        msRoot.setAttribute("data-fw-picker-mode", "add");
        msRoot.setAttribute("data-fw-initial-selected", "[]");
        msRoot.setAttribute("data-fw-assigned-ids", "[]");
      }
      if (msRoot && typeof globalThis.gcHsHydrateFlyoutFirewallPicker === "function") {
        globalThis.gcHsHydrateFlyoutFirewallPicker(msRoot.closest(".gc-if-flyout__form-body") || msRoot, {
          row: {},
        });
      }
      renderTable(wrap);
      openFlyout(root, true);
    };

    globalThis.gcAdminProfileFlyoutOpenFromTr = function (tr) {
      if (!tr || !tr._gcNetRow) return;
      let row = tr._gcNetRow;
      mode = "edit";
      currentRow = row;
      apEditTargets = buildApEditTargets(row);
      if (title) title.textContent = "Edit profile";
      if (nameInp) {
        nameInp.value = (row.payload && row.payload.Name) || row.cells.__name || "";
        nameInp.disabled = true;
      }
      state = mergeFromPayload(row.payload || {});
      if (fwField) fwField.hidden = false;
      let assignedFw = [];
      apEditTargets.forEach(function (x) {
        if (x.firewall_id > 0) assignedFw.push(x.firewall_id);
      });
      if (msRoot) {
        msRoot.setAttribute("data-fw-picker-mode", "edit");
        try {
          msRoot.setAttribute("data-fw-initial-selected", JSON.stringify(assignedFw));
          msRoot.setAttribute("data-fw-assigned-ids", JSON.stringify(assignedFw));
        } catch (eApFw) {}
      }
      let apBody = root ? root.querySelector(".gc-if-flyout__form-body") : null;
      if (apBody && msRoot && typeof globalThis.gcHsHydrateFlyoutFirewallPicker === "function") {
        globalThis.gcHsHydrateFlyoutFirewallPicker(apBody, { row: row });
      }
      renderTable(wrap);
      openFlyout(root, true);
      if (apBody && typeof globalThis.gcCombineFlyoutApplyConflictChrome === "function") {
        globalThis.gcCombineFlyoutApplyConflictChrome(apBody, row, {
          columnLabels: { __ap_detail: "Profile definition" },
          fieldPickHandlers: {
            __ap_detail: function (raw) {
              try {
                state = mergeFromPayload(JSON.parse(String(raw)));
                renderTable(wrap);
              } catch (eAp) {
                bannerResult(false, "Could not apply that firewall’s payload.");
              }
            },
          },
        });
      }
    };
  }

  globalThis.gcAdminProfileFlyoutInit = init;
})();
