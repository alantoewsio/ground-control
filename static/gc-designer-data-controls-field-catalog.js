/**
 * Designer · Data Controls: field catalog "Data source" multi-select (cached entity types)
 * and "Test selection" modal (cached object names for global firewall scope).
 */
(function (global) {
  "use strict";

  var openPanelClose = null;

  function trimStr(x) {
    return String(x == null ? "" : x).replace(/^\s+|\s+$/g, "");
  }

  function parseSelectedJson(raw) {
    var s = trimStr(raw);
    if (!s) return [];
    try {
      var j = JSON.parse(s);
      if (!Array.isArray(j)) return [];
      var out = [];
      for (var i = 0; i < j.length; i++) {
        var t = trimStr(j[i] != null ? j[i] : "");
        if (t && out.indexOf(t) === -1) out.push(t);
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  function writeHidden(hiddenInput, arr) {
    if (!hiddenInput) return;
    var a = arr || [];
    hiddenInput.value = a.length ? JSON.stringify(a) : "";
    hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function triggerLabel(count) {
    if (!count) return "Select types…";
    return count === 1 ? "1 type" : String(count) + " types";
  }

  function closeOpenDataSourcePanel() {
    if (typeof openPanelClose === "function") {
      openPanelClose();
      openPanelClose = null;
    }
  }

  function firewallIdsForRequest() {
    var ids = [];
    if (typeof global.gcGetSelectedFirewallIds === "function") {
      var a = global.gcGetSelectedFirewallIds();
      if (Array.isArray(a)) ids = a;
    }
    return ids
      .map(function (x) {
        var n = parseInt(String(x), 10);
        return isNaN(n) ? 0 : n;
      })
      .filter(function (n) {
        return n > 0;
      });
  }

  function bindDataSourceUI(wrap, hiddenInput, selectedArr, allTypes, onChange) {
    if (!wrap || !hiddenInput) return;
    wrap.innerHTML = "";
    wrap.className = "gc-designer-data-controls__data-source";

    var row = document.createElement("div");
    row.className = "gc-designer-data-controls__data-source-row";

    var dd = document.createElement("div");
    dd.className = "gc-designer-data-controls__data-source-dd";

    var trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className =
      "settings-form__input mono gc-designer-data-controls__data-source-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    var triggerLabelSpan = document.createElement("span");
    triggerLabelSpan.className = "gc-designer-data-controls__data-source-trigger-label";
    trigger.appendChild(triggerLabelSpan);

    var panel = document.createElement("div");
    panel.className = "gc-designer-data-controls__data-source-panel";
    panel.setAttribute("role", "listbox");
    panel.setAttribute("aria-multiselectable", "true");
    panel.hidden = true;

    var selected = {};

    function refreshSelectedFromHidden() {
      Object.keys(selected).forEach(function (k) {
        delete selected[k];
      });
      parseSelectedJson(hiddenInput.value).forEach(function (t) {
        selected[t] = true;
      });
    }

    function syncTriggerText() {
      var n = Object.keys(selected).length;
      triggerLabelSpan.textContent = triggerLabel(n);
    }

    function rebuildPanel() {
      panel.innerHTML = "";
      refreshSelectedFromHidden();
      if (!allTypes || !allTypes.length) {
        var empty = document.createElement("p");
        empty.className = "muted gc-designer-data-controls__data-source-empty";
        empty.textContent = "No cached entity types yet.";
        panel.appendChild(empty);
        return;
      }
      allTypes.forEach(function (et) {
        var t = trimStr(et);
        if (!t) return;
        var pr = document.createElement("div");
        pr.className = "gc-designer-data-controls__data-source-opt";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "gc-designer-data-controls__data-source-cb";
        cb.value = t;
        cb.id = hiddenInput.id + "-cb-" + t.replace(/[^a-zA-Z0-9_]/g, "_");
        cb.checked = !!selected[t];
        cb.setAttribute("aria-selected", cb.checked ? "true" : "false");
        var lab = document.createElement("label");
        lab.className = "gc-designer-data-controls__data-source-lab mono";
        lab.htmlFor = cb.id;
        lab.textContent = t;
        cb.addEventListener("change", function () {
          if (cb.checked) selected[t] = true;
          else delete selected[t];
          cb.setAttribute("aria-selected", cb.checked ? "true" : "false");
          var keys = Object.keys(selected).sort(function (a, b) {
            return a.toLowerCase().localeCompare(b.toLowerCase());
          });
          writeHidden(hiddenInput, keys);
          syncTriggerText();
          if (typeof onChange === "function") onChange();
        });
        pr.appendChild(cb);
        pr.appendChild(lab);
        panel.appendChild(pr);
      });
    }

    function openPanel() {
      closeOpenDataSourcePanel();
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      openPanelClose = function () {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      };
    }

    function onDocDown(ev) {
      if (!dd.contains(ev.target)) {
        closeOpenDataSourcePanel();
        document.removeEventListener("mousedown", onDocDown, true);
      }
    }

    trigger.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (!panel.hidden) {
        closeOpenDataSourcePanel();
        document.removeEventListener("mousedown", onDocDown, true);
        return;
      }
      rebuildPanel();
      openPanel();
      document.addEventListener("mousedown", onDocDown, true);
    });

    refreshSelectedFromHidden();
    syncTriggerText();

    dd.appendChild(trigger);
    dd.appendChild(panel);

    var testBtn = document.createElement("button");
    testBtn.type = "button";
    testBtn.className = "gc-designer-data-controls__test-selection icon-btn";
    testBtn.setAttribute("aria-label", "Test selection");
    testBtn.title = "Test selection";
    testBtn.innerHTML = (window.gcIcon
      ? window.gcIcon("search", { size: "sm", cls: "gc-designer-data-controls__test-selection-icon" })
      : "");

    testBtn.addEventListener("click", function () {
      var types = parseSelectedJson(hiddenInput.value);
      global.gcDesignerDcOpenCachedNamesTestModal(types);
    });

    row.appendChild(dd);
    row.appendChild(testBtn);
    wrap.appendChild(row);
  }

  function setModalBody(modal, content, mode) {
    var body = modal.querySelector(".gc-designer-data-controls-test-modal__body");
    if (!body) return;
    body.innerHTML = "";
    if (mode === "html") {
      body.innerHTML = content;
      return;
    }
    var p = document.createElement("p");
    p.className = "muted";
    p.textContent = content;
    body.appendChild(p);
  }

  function openCachedNamesTestModal(entityTypes) {
    var modal = document.getElementById("gc-designer-data-controls-test-modal");
    if (!modal) return;
    var types = (entityTypes || []).map(trimStr).filter(Boolean);
    if (!types.length) {
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("gc-designer-modal-open");
      setModalBody(
        modal,
        "Select one or more entity types in Data source before testing.",
        "text",
      );
      return;
    }
    var fwIds = firewallIdsForRequest();
    if (!fwIds.length) {
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("gc-designer-modal-open");
      setModalBody(
        modal,
        "Select at least one firewall in the top bar to load cached object names.",
        "text",
      );
      return;
    }
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("gc-designer-modal-open");
    setModalBody(modal, "Loading…", "text");

    fetch("/api/designer/config-cache/cached-object-names", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "Ground-Control",
      },
      body: JSON.stringify({ firewall_ids: fwIds, entity_types: types }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        if (!res.ok || !res.j || res.j.ok !== true || !res.j.names_by_type) {
          setModalBody(modal, "Could not load cached names.", "text");
          return;
        }
        var nb = res.j.names_by_type;
        var parts = [];
        types.forEach(function (et) {
          var names = nb[et];
          if (!Array.isArray(names)) names = [];
          var escEt = et.replace(/&/g, "&amp;").replace(/</g, "&lt;");
          parts.push("<section class=\"gc-designer-data-controls-test-modal__sec\"><h3 class=\"gc-designer-data-controls-test-modal__et mono\">" + escEt + "</h3>");
          if (!names.length) {
            parts.push("<p class=\"muted\">No cached objects for this type in the selected firewalls.</p>");
          } else {
            parts.push("<ul class=\"gc-designer-data-controls-test-modal__ul\">");
            names.forEach(function (n) {
              var s = String(n != null ? n : "");
              var esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
              parts.push("<li class=\"mono\">" + esc + "</li>");
            });
            parts.push("</ul>");
          }
          parts.push("</section>");
        });
        setModalBody(modal, parts.join(""), "html");
      })
      .catch(function () {
        setModalBody(modal, "Request failed.", "text");
      });
  }

  function closeCachedNamesTestModal() {
    var modal = document.getElementById("gc-designer-data-controls-test-modal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gc-designer-modal-open");
  }

  global.gcDesignerDcBindDataSourceUI = bindDataSourceUI;
  global.gcDesignerDcOpenCachedNamesTestModal = openCachedNamesTestModal;
  global.gcDesignerDcCloseCachedNamesTestModal = closeCachedNamesTestModal;
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof window !== "undefined"
      ? window
      : this,
);
