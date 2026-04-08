/**
 * IPS Trusted MAC flyout: add/edit cached entries; queue create/update via task API.
 */
(function () {
  "use strict";

  var root = null;
  var els = {};
  var mode = "edit";
  var currentRow = null;
  var CREATE_BATCH_URL = "";
  var UPDATE_URL = "";

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

  function textScalar(v) {
    if (v == null) return "";
    if (typeof v === "object" && v !== null && v["#text"] != null) {
      return String(v["#text"]).trim();
    }
    return String(v).trim();
  }

  function formBodyEl() {
    return root ? root.querySelector(".gc-if-flyout__form-body") : null;
  }

  function collectIpsTrustedMacEditTargets(row) {
    var t = row && row.ips_trusted_mac_edit_targets;
    if (Array.isArray(t) && t.length) return t.slice();
    if (row && row.config_entry_id != null) {
      var one = { config_entry_id: row.config_entry_id };
      if (row.firewall_id != null) one.firewall_id = row.firewall_id;
      return [one];
    }
    return [];
  }

  function mountFwPicker(pickerMode, row) {
    var slot = root.querySelector("#gc-ips-tmac-fw-slot");
    var tmpl = root.querySelector("#gc-ips-tmac-fw-ms-template");
    if (!slot || !tmpl) return;
    slot.innerHTML = "";
    slot.appendChild(tmpl.content.cloneNode(true));
    var ms = slot.querySelector("[data-gc-fw-ms]");
    if (!ms) return;
    var initial = [];
    var assigned = [];
    if (pickerMode === "create") {
      ms.setAttribute("data-fw-picker-mode", "add");
      if (typeof window.gcGetSelectedFirewallIds === "function") {
        (window.gcGetSelectedFirewallIds() || []).forEach(function (x) {
          var n = parseInt(String(x), 10);
          if (!isNaN(n) && n > 0) initial.push(n);
        });
      }
    } else {
      ms.setAttribute("data-fw-picker-mode", "edit");
      collectIpsTrustedMacEditTargets(row || {}).forEach(function (t) {
        if (t && t.firewall_id != null) {
          var fid = parseInt(String(t.firewall_id), 10);
          if (!isNaN(fid) && fid > 0) initial.push(fid);
        }
      });
      assigned = initial.slice();
    }
    ms.setAttribute("data-fw-initial-selected", JSON.stringify(initial));
    ms.setAttribute("data-fw-assigned-ids", JSON.stringify(assigned));
    var body = formBodyEl();
    if (body && typeof window.gcHsHydrateFlyoutFirewallPicker === "function") {
      window.gcHsHydrateFlyoutFirewallPicker(body, { row: row || {} });
    }
    var mh = root.querySelector("#gc-ips-tmac-fw-ms-hint");
    if (mh) {
      mh.textContent =
        pickerMode === "create"
          ? "The entry is queued on every firewall you leave selected. Search to filter the list."
          : "Uncheck to skip queuing an update on that firewall. Newly checked firewalls get an add task when this MAC is not already cached there.";
    }
  }

  function collectCreateFirewallIds() {
    var slot = root.querySelector("#gc-ips-tmac-fw-slot");
    if (!slot) return [];
    var ms = slot.querySelector("[data-gc-fw-ms]");
    if (!ms) return [];
    var out = [];
    ms.querySelectorAll('input[type="checkbox"][data-gc-fw-id]').forEach(function (cb) {
      if (!cb.checked) return;
      var n = parseInt(String(cb.getAttribute("data-gc-fw-id") || ""), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function openFlyout() {
    if (!root) return;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("gc-if-flyout--open");
    var panel = root.querySelector(".gc-if-flyout__panel");
    if (panel) {
      try {
        panel.focus();
      } catch (e2) {}
    }
  }

  function closeFlyout() {
    if (!root) return;
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gc-if-flyout--open");
  }

  function getCheckedAssoc(name) {
    var q = root.querySelector('input[name="' + name + '"]:checked');
    return q ? String(q.value || "None") : "None";
  }

  function setAssoc(name, val) {
    var v = String(val || "None").trim();
    if (v !== "Static" && v !== "DHCP") v = "None";
    var inp = root.querySelector('input[name="' + name + '"][value="' + v + '"]');
    if (inp) {
      inp.checked = true;
    } else {
      var none = root.querySelector('input[name="' + name + '"][value="None"]');
      if (none) none.checked = true;
    }
    syncStaticAddrVisibility();
  }

  function syncStaticAddrVisibility() {
    var v4 = getCheckedAssoc("gc-ips-tmac-ipv4-assoc");
    var v6 = getCheckedAssoc("gc-ips-tmac-ipv6-assoc");
    var w4 = root.querySelector("#gc-ips-tmac-ipv4-static-only");
    var w6 = root.querySelector("#gc-ips-tmac-ipv6-static-only");
    if (w4) w4.hidden = v4 !== "Static";
    if (w6) w6.hidden = v6 !== "Static";
  }

  function populateFromPayload(tm, row) {
    tm = tm && typeof tm === "object" ? tm : {};
    if (els.macInp) {
      els.macInp.value =
        textScalar(tm.MACAddress) || (row && row.cells && row.cells.__name) || "";
      els.macInp.readOnly = mode === "edit";
      els.macInp.classList.toggle("gc-if-flyout__input--readonly", mode === "edit");
    }
    setAssoc("gc-ips-tmac-ipv4-assoc", textScalar(tm.IPV4Association) || "None");
    setAssoc("gc-ips-tmac-ipv6-assoc", textScalar(tm.IPV6Association) || "None");
    if (els.v4Ta) els.v4Ta.value = textScalar(tm.IPV4Address);
    if (els.v6Ta) els.v6Ta.value = textScalar(tm.IPV6Address);
    if (els.title) {
      els.title.textContent = mode === "create" ? "Add trusted MAC" : "Trusted MAC";
    }
    mountFwPicker(mode === "create" ? "create" : "edit", mode === "edit" ? row : null);
    syncStaticAddrVisibility();
  }

  function collectTrustedMac() {
    var v4s = getCheckedAssoc("gc-ips-tmac-ipv4-assoc") === "Static";
    var v6s = getCheckedAssoc("gc-ips-tmac-ipv6-assoc") === "Static";
    return {
      MACAddress: (els.macInp && els.macInp.value) || "",
      IPV4Association: getCheckedAssoc("gc-ips-tmac-ipv4-assoc"),
      IPV4Address: v4s && els.v4Ta ? els.v4Ta.value || "" : "",
      IPV6Association: getCheckedAssoc("gc-ips-tmac-ipv6-assoc"),
      IPV6Address: v6s && els.v6Ta ? els.v6Ta.value || "" : "",
    };
  }

  function bindPanelResize() {
    var panel = root.querySelector(".gc-if-flyout__panel");
    var handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset.gcIpsTmacResizeBound === "1") return;
    handle.dataset.gcIpsTmacResizeBound = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var startX = e.clientX;
      var startW = panel.getBoundingClientRect().width;
      var maxW = Math.min(560, window.innerWidth - 24);
      function onMove(e2) {
        var w = startW + (startX - e2.clientX);
        w = Math.max(320, Math.min(maxW, w));
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

  function bindOnce() {
    if (!root || root.dataset.gcIpsTmacBound === "1") return;
    root.dataset.gcIpsTmacBound = "1";

    els = {
      title: root.querySelector("#gc-ips-tmac-flyout-title"),
      form: root.querySelector("#gc-ips-tmac-form"),
      macInp: root.querySelector("#gc-ips-tmac-mac"),
      v4Ta: root.querySelector("#gc-ips-tmac-ipv4"),
      v6Ta: root.querySelector("#gc-ips-tmac-ipv6"),
      saveBtn: root.querySelector("#gc-ips-tmac-save"),
      cancelBtn: root.querySelector("#gc-ips-tmac-cancel"),
    };

    bindPanelResize();

    root.querySelectorAll('input[name="gc-ips-tmac-ipv4-assoc"]').forEach(function (r) {
      r.addEventListener("change", syncStaticAddrVisibility);
    });
    root.querySelectorAll('input[name="gc-ips-tmac-ipv6-assoc"]').forEach(function (r) {
      r.addEventListener("change", syncStaticAddrVisibility);
    });

    if (els.form && els.form.dataset.gcIpsTmacFwPanelClose !== "1") {
      els.form.dataset.gcIpsTmacFwPanelClose = "1";
      els.form.addEventListener("click", function (e) {
        if (!root || root.hidden) return;
        if (e.target.closest("[data-gc-fw-ms]")) return;
        var body = formBodyEl();
        if (!body) return;
        body.querySelectorAll(".gc-hs-ip-host-flyout__fw-dropdown").forEach(function (d) {
          d.hidden = true;
        });
        body.querySelectorAll(".gc-hs-ip-host-flyout__fw-trigger").forEach(function (t) {
          t.setAttribute("aria-expanded", "false");
        });
      });
    }

    if (els.cancelBtn) {
      els.cancelBtn.addEventListener("click", closeFlyout);
    }
    var backdrop = root.querySelector(".gc-if-flyout__backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", closeFlyout);
    }

    if (els.form) {
      els.form.addEventListener("submit", function (e) {
        e.preventDefault();
        var body = collectTrustedMac();
        if (!body.MACAddress || !body.MACAddress.trim()) {
          bannerResult(false, "MAC address is required.");
          return;
        }
        if (mode === "create") {
          var fwIds = collectCreateFirewallIds();
          if (!fwIds.length) {
            bannerResult(false, "Select at least one firewall in the flyout.");
            return;
          }
          if (!CREATE_BATCH_URL) {
            bannerResult(false, "Batch create URL is not configured.");
            return;
          }
          if (els.saveBtn) els.saveBtn.disabled = true;
          fetch(CREATE_BATCH_URL, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ firewall_ids: fwIds, trusted_mac: body }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (els.saveBtn) els.saveBtn.disabled = false;
              if (!x.ok) {
                var em = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
                bannerResult(false, typeof em === "string" ? em : JSON.stringify(em));
                return;
              }
              var n = (x.j && x.j.count) || 0;
              bannerResult(
                true,
                n === 1
                  ? "Added 1 trusted MAC task to the queue."
                  : "Added " + n + " trusted MAC tasks to the queue.",
              );
              dispatchTaskQueueUpdated();
              closeFlyout();
              if (typeof window.gcIpsTrustedMacTableRefresh === "function") {
                window.gcIpsTrustedMacTableRefresh();
              }
            })
            .catch(function () {
              if (els.saveBtn) els.saveBtn.disabled = false;
              bannerResult(false, "Network error.");
            });
          return;
        }
        var allTmacTargets = collectIpsTrustedMacEditTargets(currentRow);
        var byFw = {};
        allTmacTargets.forEach(function (t) {
          if (t && t.firewall_id != null) byFw[t.firewall_id] = t;
        });
        var selectedFw = collectCreateFirewallIds();
        var toUpdate = [];
        var toCreateFw = [];
        selectedFw.forEach(function (fid) {
          if (byFw[fid]) toUpdate.push(byFw[fid]);
          else toCreateFw.push(fid);
        });
        if (!toUpdate.length && !toCreateFw.length) {
          bannerResult(false, "Select at least one firewall.");
          return;
        }
        if (toUpdate.length && !UPDATE_URL) {
          bannerResult(false, "Update URL is not configured.");
          return;
        }
        if (toCreateFw.length && !CREATE_BATCH_URL) {
          bannerResult(false, "Batch create URL is not configured.");
          return;
        }
        if (els.saveBtn) els.saveBtn.disabled = true;
        var uIdx = 0;
        var queued = 0;
        function finishTmacSave(errMsg) {
          if (els.saveBtn) els.saveBtn.disabled = false;
          if (errMsg) {
            bannerResult(false, errMsg);
            return;
          }
          if (queued === 0) {
            bannerResult(true, "Nothing queued — the cache already matches your edits.");
          } else {
            bannerResult(
              true,
              queued === 1
                ? "Added 1 trusted MAC task to the queue."
                : "Added " + queued + " trusted MAC tasks to the queue.",
            );
            dispatchTaskQueueUpdated();
          }
          closeFlyout();
          if (typeof window.gcIpsTrustedMacTableRefresh === "function") {
            window.gcIpsTrustedMacTableRefresh();
          }
        }
        function runBatchCreateForNew() {
          if (!toCreateFw.length) {
            finishTmacSave(null);
            return;
          }
          fetch(CREATE_BATCH_URL, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ firewall_ids: toCreateFw, trusted_mac: body }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (!x.ok) {
                var em3 = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
                finishTmacSave(typeof em3 === "string" ? em3 : JSON.stringify(em3));
                return;
              }
              var n = (x.j && x.j.count) || 0;
              queued += n;
              finishTmacSave(null);
            })
            .catch(function () {
              finishTmacSave("Network error.");
            });
        }
        function stepTmacUpdate() {
          if (uIdx >= toUpdate.length) {
            runBatchCreateForNew();
            return;
          }
          var tid = toUpdate[uIdx].config_entry_id;
          uIdx++;
          fetch(UPDATE_URL, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ config_entry_id: tid, trusted_mac: body }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (!x.ok) {
                var em2 = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
                finishTmacSave(typeof em2 === "string" ? em2 : JSON.stringify(em2));
                return;
              }
              if (x.j && x.j.task_id != null) queued++;
              stepTmacUpdate();
            })
            .catch(function () {
              finishTmacSave("Network error.");
            });
        }
        if (toUpdate.length) stepTmacUpdate();
        else runBatchCreateForNew();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (!root || root.hidden) return;
      if (e.key === "Escape") closeFlyout();
    });
  }

  window.gcIpsTrustedMacFlyoutInit = function () {
    root = document.getElementById("gc-ips-tmac-flyout");
    CREATE_BATCH_URL =
      typeof window.GC_IPS_TRUSTED_MAC_CREATE_BATCH_URL === "string"
        ? window.GC_IPS_TRUSTED_MAC_CREATE_BATCH_URL
        : "";
    UPDATE_URL =
      typeof window.GC_IPS_TRUSTED_MAC_UPDATE_URL === "string"
        ? window.GC_IPS_TRUSTED_MAC_UPDATE_URL
        : "";
    bindOnce();
  };

  window.gcIpsTrustedMacFlyoutOpenCreate = function () {
    if (!root) window.gcIpsTrustedMacFlyoutInit();
    mode = "create";
    currentRow = null;
    populateFromPayload({}, null);
    openFlyout();
    if (els.macInp) {
      try {
        els.macInp.focus();
      } catch (e1) {}
    }
  };

  window.gcIpsTrustedMacFlyoutOpenFromTr = function (tr) {
    if (!root) window.gcIpsTrustedMacFlyoutInit();
    if (!tr || !tr._gcNetRow) return;
    mode = "edit";
    currentRow = tr._gcNetRow;
    var tm = currentRow.trusted_mac;
    populateFromPayload(tm, currentRow);
    openFlyout();
    var btm = formBodyEl();
    if (btm && typeof window.gcCombineFlyoutApplyConflictChrome === "function") {
      window.gcCombineFlyoutApplyConflictChrome(btm, currentRow, {
        columnLabels: {
          __ipv4_assoc: "IPv4 association",
          __ipv4_addr: "IPv4 address",
          __ipv6_assoc: "IPv6 association",
          __ipv6_addr: "IPv6 address",
        },
      });
    }
    if (els.macInp) {
      try {
        els.macInp.focus();
      } catch (e3) {}
    }
  };
})();
