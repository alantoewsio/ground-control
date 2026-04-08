/**
 * IPS custom signature flyout: add/edit cached signatures; queue create/update via task API.
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

  function mountFwPicker(mode, row) {
    var slot = root.querySelector("#gc-ips-sig-fw-slot");
    var tmpl = root.querySelector("#gc-ips-sig-fw-ms-template");
    if (!slot || !tmpl) return;
    slot.innerHTML = "";
    slot.appendChild(tmpl.content.cloneNode(true));
    var ms = slot.querySelector("[data-gc-fw-ms]");
    if (!ms) return;
    var initial = [];
    var assigned = [];
    if (mode === "create") {
      ms.setAttribute("data-fw-picker-mode", "add");
      if (typeof window.gcGetSelectedFirewallIds === "function") {
        (window.gcGetSelectedFirewallIds() || []).forEach(function (x) {
          var n = parseInt(String(x), 10);
          if (!isNaN(n) && n > 0) initial.push(n);
        });
      }
    } else {
      ms.setAttribute("data-fw-picker-mode", "edit");
      collectIpsCustomSigUpdateTargets(row || {}).forEach(function (t) {
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
    var mh = root.querySelector("#gc-ips-sig-fw-ms-hint");
    if (mh) {
      mh.textContent =
        mode === "create"
          ? "The signature is queued on every firewall you leave selected. Search to filter the list."
          : "Uncheck to skip queuing an update on that firewall. Newly checked firewalls get an add task when the name is not already cached there.";
    }
  }

  function collectCreateFirewallIds() {
    var slot = root.querySelector("#gc-ips-sig-fw-slot");
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

  function collectIpsCustomSigUpdateTargets(row) {
    var t = row && row.ips_custom_sig_edit_targets;
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
    var panel = root.querySelector(".gc-if-flyout__panel");
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
    var ta = els.ruleTa;
    var code = els.ruleHl;
    if (!ta || !code) return;
    if (typeof window.gcSnortRuleHighlightToHtml === "function") {
      code.innerHTML = window.gcSnortRuleHighlightToHtml(ta.value);
    } else {
      code.textContent = ta.value;
    }
    var wrap = ta.closest(".gc-snort-editor");
    if (wrap) {
      var hlPre = wrap.querySelector(".gc-snort-editor__highlights");
      if (hlPre) {
        hlPre.scrollTop = ta.scrollTop;
        hlPre.scrollLeft = ta.scrollLeft;
      }
    }
  }

  function bindSnortEditor() {
    var ta = els.ruleTa;
    if (!ta || ta.dataset.gcSnortEditorBound === "1") return;
    ta.dataset.gcSnortEditorBound = "1";
    ta.addEventListener("input", syncRuleHighlight);
    ta.addEventListener("scroll", function () {
      var wrap = ta.closest(".gc-snort-editor");
      if (!wrap) return;
      var hlPre = wrap.querySelector(".gc-snort-editor__highlights");
      if (hlPre) {
        hlPre.scrollTop = ta.scrollTop;
        hlPre.scrollLeft = ta.scrollLeft;
      }
    });
  }

  function fillSelect(sel, options, placeholder) {
    if (!sel) return;
    var opts = options || [];
    var isPh = !!placeholder;
    sel.innerHTML = "";
    if (isPh) {
      var ph = document.createElement("option");
      ph.value = "";
      ph.textContent = placeholder;
      sel.appendChild(ph);
    }
    opts.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      sel.appendChild(o);
    });
    if (isPh) sel.value = "";
  }

  function setSelectValue(sel, val, allowEmpty) {
    if (!sel) return;
    var v = String(val || "").trim();
    if (!v) {
      if (allowEmpty) sel.value = "";
      return;
    }
    var found = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === v) {
        found = true;
        break;
      }
    }
    if (!found) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    }
    sel.value = v;
  }

  function loadDropdowns() {
    var raw = window.GC_IPS_CUSTOM_SIGNATURE_DROPDOWNS;
    if (!raw || typeof raw !== "object") raw = {};
    fillSelect(els.protoSel, raw.protocols || [], "Select here");
    fillSelect(els.sevSel, raw.severities || [], "Select here");
    fillSelect(els.actSel, raw.recommended_actions || [], null);
  }

  function populateFromSignature(sig, row) {
    sig = sig && typeof sig === "object" ? sig : {};
    var fwField = root.querySelector("#gc-ips-sig-fw-field");
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
    var panel = root.querySelector(".gc-if-flyout__panel");
    var handle = root.querySelector(".gc-if-flyout__resize");
    if (!panel || !handle || handle.dataset.gcIpsSigResizeBound === "1") return;
    handle.dataset.gcIpsSigResizeBound = "1";
    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var startX = e.clientX;
      var startW = panel.getBoundingClientRect().width;
      var maxW = Math.min(720, window.innerWidth - 24);
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
        var body = collectSignature();
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
                var em = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
                bannerResult(false, typeof em === "string" ? em : JSON.stringify(em));
                return;
              }
              var n = (x.j && x.j.count) || 0;
              bannerResult(
                true,
                n === 1
                  ? "Added 1 custom signature task to the queue."
                  : "Added " + n + " custom signature tasks to the queue.",
              );
              dispatchTaskQueueUpdated();
              closeFlyout();
              if (typeof window.gcIpsCustomSignatureTableRefresh === "function") {
                window.gcIpsCustomSignatureTableRefresh();
              }
            })
            .catch(function () {
              if (els.saveBtn) els.saveBtn.disabled = false;
              bannerResult(false, "Network error.");
            });
          return;
        }
        var allSigTargets = collectIpsCustomSigUpdateTargets(currentRow);
        var byFw = {};
        allSigTargets.forEach(function (t) {
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
        var sIdx = 0;
        var queued = 0;
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
          if (typeof window.gcIpsCustomSignatureTableRefresh === "function") {
            window.gcIpsCustomSignatureTableRefresh();
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
                var em3 = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
                finishSigSave(typeof em3 === "string" ? em3 : JSON.stringify(em3));
                return;
              }
              var n = (x.j && x.j.count) || 0;
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
          var tid = toUpdate[sIdx].config_entry_id;
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
                var em2 = (x.j && (x.j.detail || x.j.message)) || "Request failed.";
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

  window.gcIpsCustomSignatureFlyoutInit = function () {
    root = document.getElementById("gc-ips-sig-flyout");
    CREATE_BATCH_URL =
      typeof window.GC_IPS_CUSTOM_SIGNATURE_CREATE_BATCH_URL === "string"
        ? window.GC_IPS_CUSTOM_SIGNATURE_CREATE_BATCH_URL
        : "";
    UPDATE_URL =
      typeof window.GC_IPS_CUSTOM_SIGNATURE_UPDATE_URL === "string"
        ? window.GC_IPS_CUSTOM_SIGNATURE_UPDATE_URL
        : "";
    if (!root) return;
    bindOnce();
    loadDropdowns();
  };

  window.gcIpsCustomSignatureFlyoutOpenFromTr = function (tr) {
    window.gcIpsCustomSignatureFlyoutInit();
    var row = tr && tr._gcNetRow;
    if (!row || !root) return;
    mode = "edit";
    currentRow = row;
    populateFromSignature(row.signature, row);
    openFlyout();
    var b = formBodyEl();
    if (b && typeof window.gcCombineFlyoutApplyConflictChrome === "function") {
      window.gcCombineFlyoutApplyConflictChrome(b, row, {
        columnLabels: {
          __protocol: "Protocol",
          __severity: "Severity",
          __action: "Recommended action",
          __custom_rule: "Custom rule",
        },
      });
    }
  };

  window.gcIpsCustomSignatureFlyoutOpenCreate = function () {
    window.gcIpsCustomSignatureFlyoutInit();
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
