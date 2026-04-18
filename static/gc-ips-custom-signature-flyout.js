/**
 * IPS custom signature flyout: add/edit cached signatures; queue create/update via task API.
 */
(function () {
  "use strict";

  let root = null;
  let els = {};
  let mode = "edit";
  let currentRow = null;
  let CREATE_BATCH_URL = "";
  let UPDATE_URL = "";

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

  function mountFwPicker(mode, row) {
    let slot = root.querySelector("#gc-ips-sig-fw-slot");
    let tmpl = root.querySelector("#gc-ips-sig-fw-ms-template");
    if (!slot || !tmpl) return;
    slot.innerHTML = "";
    slot.appendChild(tmpl.content.cloneNode(true));
    let ms = slot.querySelector("[data-gc-fw-ms]");
    if (!ms) return;
    let initial = [];
    let assigned = [];
    if (mode === "create") {
      ms.setAttribute("data-fw-picker-mode", "add");
      if (typeof globalThis.gcGetSelectedFirewallIds === "function") {
        (globalThis.gcGetSelectedFirewallIds() || []).forEach(function (x) {
          let n = parseInt(String(x), 10);
          if (!isNaN(n) && n > 0) initial.push(n);
        });
      }
    } else {
      ms.setAttribute("data-fw-picker-mode", "edit");
      collectIpsCustomSigUpdateTargets(row || {}).forEach(function (t) {
        if (t && t.firewall_id != null) {
          let fid = parseInt(String(t.firewall_id), 10);
          if (!isNaN(fid) && fid > 0) initial.push(fid);
        }
      });
      assigned = initial.slice();
    }
    ms.setAttribute("data-fw-initial-selected", JSON.stringify(initial));
    ms.setAttribute("data-fw-assigned-ids", JSON.stringify(assigned));
    let body = formBodyEl();
    if (body && typeof globalThis.gcHsHydrateFlyoutFirewallPicker === "function") {
      globalThis.gcHsHydrateFlyoutFirewallPicker(body, { row: row || {} });
    }
    let mh = root.querySelector("#gc-ips-sig-fw-ms-hint");
    if (mh) {
      mh.textContent =
        mode === "create"
          ? "The signature is queued on every firewall you leave selected. Search to filter the list."
          : "Uncheck to skip queuing an update on that firewall. Newly checked firewalls get an add task when the name is not already cached there.";
    }
  }

  function collectCreateFirewallIds() {
    let slot = root.querySelector("#gc-ips-sig-fw-slot");
    if (!slot) return [];
    let ms = slot.querySelector("[data-gc-fw-ms]");
    if (!ms) return [];
    let out = [];
    ms.querySelectorAll('input[type="checkbox"][data-gc-fw-id]').forEach(function (cb) {
      if (!cb.checked) return;
      let n = parseInt(String(cb.dataset.gcFwId || ""), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function collectIpsCustomSigUpdateTargets(row) {
    let t = row && row.ips_custom_sig_edit_targets;
    if (Array.isArray(t) && t.length) return t.slice();
    if (row && row.config_entry_id != null) {
      return [{ config_entry_id: row.config_entry_id }];
    }
    return [];
  }

  function openFlyout() {
    if (!root) return;
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("gc-if-flyout--open");
    let panel = root.querySelector(".gc-if-flyout__panel");
    if (panel) {
      try {
        panel.focus();
      } catch (e2) {}
    }
    syncRuleHighlight();
  }

  function closeFlyout() {
    if (!root) return;
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gc-if-flyout--open");
  }

  function syncRuleHighlight() {
    let ta = els.ruleTa;
    let code = els.ruleHl;
    if (!ta || !code) return;
    if (typeof globalThis.gcSnortRuleHighlightToHtml === "function") {
      code.innerHTML = globalThis.gcSnortRuleHighlightToHtml(ta.value);
    } else {
      code.textContent = ta.value;
    }
    let wrap = ta.closest(".gc-snort-editor");
    if (wrap) {
      let hlPre = wrap.querySelector(".gc-snort-editor__highlights");
      if (hlPre) {
        hlPre.scrollTop = ta.scrollTop;
        hlPre.scrollLeft = ta.scrollLeft;
      }
    }
  }

  function bindSnortEditor() {
    let ta = els.ruleTa;
    if (!ta || ta.dataset.gcSnortEditorBound === "1") return;
    ta.dataset.gcSnortEditorBound = "1";
    ta.addEventListener("input", syncRuleHighlight);
    ta.addEventListener("scroll", function () {
      let wrap = ta.closest(".gc-snort-editor");
      if (!wrap) return;
      let hlPre = wrap.querySelector(".gc-snort-editor__highlights");
      if (hlPre) {
        hlPre.scrollTop = ta.scrollTop;
        hlPre.scrollLeft = ta.scrollLeft;
      }
    });
  }

  function fillSelect(sel, options, placeholder) {
    if (!sel) return;
    let opts = options || [];
    let isPh = !!placeholder;
    sel.innerHTML = "";
    if (isPh) {
      let ph = document.createElement("option");
      ph.value = "";
      ph.textContent = placeholder;
      sel.appendChild(ph);
    }
    opts.forEach(function (opt) {
      let o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      sel.appendChild(o);
    });
    if (isPh) sel.value = "";
  }

  function setSelectValue(sel, val, allowEmpty) {
    if (!sel) return;
    let v = String(val || "").trim();
    if (!v) {
      if (allowEmpty) sel.value = "";
      return;
    }
    let found = false;
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === v) {
        found = true;
        break;
      }
    }
    if (!found) {
      let o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    }
    sel.value = v;
  }

  function loadDropdowns() {
    let raw = globalThis.GC_IPS_CUSTOM_SIGNATURE_DROPDOWNS;
    if (!raw || typeof raw !== "object") raw = {};
    fillSelect(els.protoSel, raw.protocols || [], "Select here");
    fillSelect(els.sevSel, raw.severities || [], "Select here");
    fillSelect(els.actSel, raw.recommended_actions || [], null);
  }

  function populateFromSignature(sig, row) {
    sig = sig && typeof sig === "object" ? sig : {};
    let fwField = root.querySelector("#gc-ips-sig-fw-field");
    if (fwField) {
      fwField.hidden = false;
    }
    if (els.nameInp) {
      els.nameInp.value = textScalar(sig.Name) || (row && row.cells && row.cells.__name) || "";
      els.nameInp.readOnly = mode === "edit";
      els.nameInp.classList.toggle("gc-if-flyout__input--readonly", mode === "edit");
    }
    loadDropdowns();
    setSelectValue(els.protoSel, textScalar(sig.Protocol), true);
    setSelectValue(els.sevSel, textScalar(sig.Severity), true);
    setSelectValue(els.actSel, textScalar(sig.RecommendedAction) || "Allow Packet", false);
    if (els.ruleTa) els.ruleTa.value = textScalar(sig.CustomRule) || "";
    if (els.title) {
      els.title.textContent = mode === "create" ? "Add custom signature" : "Custom signature";
    }
    mountFwPicker(mode === "create" ? "create" : "edit", mode === "edit" ? row : null);
    syncRuleHighlight();
  }

  function collectSignature() {
    return {
      Name: (els.nameInp && els.nameInp.value) || "",
      Protocol: (els.protoSel && els.protoSel.value) || "",
      CustomRule: (els.ruleTa && els.ruleTa.value) || "",
      Severity: (els.sevSel && els.sevSel.value) || "",
      RecommendedAction: (els.actSel && els.actSel.value) || "Allow Packet",
    };
  }

  function bindPanelResize() {
    let panel = root.querySelector(".gc-if-flyout__panel");
    let handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset.gcIpsSigResizeBound === "1") return;
    handle.dataset.gcIpsSigResizeBound = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      let startX = e.clientX;
      let startW = panel.getBoundingClientRect().width;
      let maxW = Math.min(720, globalThis.innerWidth - 24);
      function onMove(e2) {
        let w = startW + (startX - e2.clientX);
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
    if (!root || root.dataset.gcIpsSigBound === "1") return;
    root.dataset.gcIpsSigBound = "1";

    els = {
      title: root.querySelector("#gc-ips-sig-flyout-title"),
      form: root.querySelector("#gc-ips-sig-form"),
      nameInp: root.querySelector("#gc-ips-sig-name"),
      protoSel: root.querySelector("#gc-ips-sig-protocol"),
      sevSel: root.querySelector("#gc-ips-sig-severity"),
      actSel: root.querySelector("#gc-ips-sig-action"),
      ruleTa: root.querySelector("#gc-ips-sig-rule"),
      ruleHl: root.querySelector("#gc-ips-sig-rule-highlights"),
      saveBtn: root.querySelector("#gc-ips-sig-save"),
      cancelBtn: root.querySelector("#gc-ips-sig-cancel"),
    };

    bindSnortEditor();
    bindPanelResize();

    if (els.form && els.form.dataset.gcIpsSigFwPanelClose !== "1") {
      els.form.dataset.gcIpsSigFwPanelClose = "1";
      els.form.addEventListener("click", function (e) {
        if (!root || root.hidden) return;
        if (e.target.closest("[data-gc-fw-ms]")) return;
        let body = formBodyEl();
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
    let backdrop = root.querySelector(".gc-if-flyout__backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", closeFlyout);
    }

    if (els.form) {
      els.form.addEventListener("submit", function (e) {
        e.preventDefault();
        let body = collectSignature();
        if (!body.Name || !body.Name.trim()) {
          bannerResult(false, "Name is required (max 15 characters).");
          return;
        }
        if (!body.Protocol) {
          bannerResult(false, "Protocol is required.");
          return;
        }
        if (!body.CustomRule || !body.CustomRule.trim()) {
          bannerResult(false, "Custom rule is required.");
          return;
        }
        if (!body.Severity) {
          bannerResult(false, "Severity is required.");
          return;
        }
        if (mode === "create") {
          let fwIds = collectCreateFirewallIds();
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
            body: JSON.stringify({ firewall_ids: fwIds, signature: body }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (els.saveBtn) els.saveBtn.disabled = false;
              if (!x.ok) {
                let em = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
                bannerResult(false, typeof em === "string" ? em : JSON.stringify(em));
                return;
              }
              let n = (x.j && x.j.count) || 0;
              bannerResult(
                true,
                n === 1
                  ? "Added 1 custom signature task to the queue."
                  : "Added " + n + " custom signature tasks to the queue.",
              );
              dispatchTaskQueueUpdated();
              closeFlyout();
              if (typeof globalThis.gcIpsCustomSignatureTableRefresh === "function") {
                globalThis.gcIpsCustomSignatureTableRefresh();
              }
            })
            .catch(function () {
              if (els.saveBtn) els.saveBtn.disabled = false;
              bannerResult(false, "Network error.");
            });
          return;
        }
        let allSigTargets = collectIpsCustomSigUpdateTargets(currentRow);
        let byFw = {};
        allSigTargets.forEach(function (t) {
          if (t && t.firewall_id != null) byFw[t.firewall_id] = t;
        });
        let selectedFw = collectCreateFirewallIds();
        let toUpdate = [];
        let toCreateFw = [];
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
        let sIdx = 0;
        let queued = 0;
        function finishSigSave(errMsg) {
          if (els.saveBtn) els.saveBtn.disabled = false;
          if (errMsg) {
            bannerResult(false, errMsg);
            return;
          }
          if (queued === 0) {
            bannerResult(true, "Nothing queued — signatures already match your edits in the cache.");
          } else {
            bannerResult(
              true,
              queued === 1
                ? "Added 1 custom signature task to the queue."
                : "Added " + queued + " custom signature tasks to the queue.",
            );
            dispatchTaskQueueUpdated();
          }
          closeFlyout();
          if (typeof globalThis.gcIpsCustomSignatureTableRefresh === "function") {
            globalThis.gcIpsCustomSignatureTableRefresh();
          }
        }
        function runBatchCreateForNew() {
          if (!toCreateFw.length) {
            finishSigSave(null);
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
            body: JSON.stringify({ firewall_ids: toCreateFw, signature: body }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (!x.ok) {
                let em3 = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
                finishSigSave(typeof em3 === "string" ? em3 : JSON.stringify(em3));
                return;
              }
              let n = (x.j && x.j.count) || 0;
              queued += n;
              finishSigSave(null);
            })
            .catch(function () {
              finishSigSave("Network error.");
            });
        }
        function stepSigUpdate() {
          if (sIdx >= toUpdate.length) {
            runBatchCreateForNew();
            return;
          }
          let tid = toUpdate[sIdx].config_entry_id;
          sIdx++;
          fetch(UPDATE_URL, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "Ground-Control",
            },
            body: JSON.stringify({ config_entry_id: tid, signature: body }),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, j: j };
              });
            })
            .then(function (x) {
              if (!x.ok) {
                let em2 = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
                finishSigSave(typeof em2 === "string" ? em2 : JSON.stringify(em2));
                return;
              }
              if (x.j && x.j.task_id != null) queued++;
              stepSigUpdate();
            })
            .catch(function () {
              finishSigSave("Network error.");
            });
        }
        if (toUpdate.length) stepSigUpdate();
        else runBatchCreateForNew();
      });
    }

    document.addEventListener("keydown", function (e) {
      if (!root || root.hidden) return;
      if (e.key === "Escape") closeFlyout();
    });
  }

  globalThis.gcIpsCustomSignatureFlyoutInit = function () {
    root = document.getElementById("gc-ips-sig-flyout");
    CREATE_BATCH_URL =
      typeof globalThis.GC_IPS_CUSTOM_SIGNATURE_CREATE_BATCH_URL === "string"
        ? globalThis.GC_IPS_CUSTOM_SIGNATURE_CREATE_BATCH_URL
        : "";
    UPDATE_URL =
      typeof globalThis.GC_IPS_CUSTOM_SIGNATURE_UPDATE_URL === "string"
        ? globalThis.GC_IPS_CUSTOM_SIGNATURE_UPDATE_URL
        : "";
    if (!root) return;
    bindOnce();
    loadDropdowns();
  };

  globalThis.gcIpsCustomSignatureFlyoutOpenFromTr = function (tr) {
    globalThis.gcIpsCustomSignatureFlyoutInit();
    let row = tr && tr._gcNetRow;
    if (!row || !root) return;
    mode = "edit";
    currentRow = row;
    populateFromSignature(row.signature, row);
    openFlyout();
    let b = formBodyEl();
    if (b && typeof globalThis.gcCombineFlyoutApplyConflictChrome === "function") {
      globalThis.gcCombineFlyoutApplyConflictChrome(b, row, {
        columnLabels: {
          __protocol: "Protocol",
          __severity: "Severity",
          __action: "Recommended action",
          __custom_rule: "Custom rule",
        },
      });
    }
  };

  globalThis.gcIpsCustomSignatureFlyoutOpenCreate = function () {
    globalThis.gcIpsCustomSignatureFlyoutInit();
    if (!root) return;
    mode = "create";
    currentRow = null;
    populateFromSignature(
      {
        Name: "",
        Protocol: "",
        CustomRule: "",
        Severity: "",
        RecommendedAction: "Allow Packet",
      },
      null,
    );
    if (els.nameInp) {
      els.nameInp.readOnly = false;
      els.nameInp.classList.remove("gc-if-flyout__input--readonly");
    }
    openFlyout();
  };
})();
