/**
 * Combined-view flyouts: highlight fields that differ across scopes and open a secondary pick sheet.
 * Depends on gc-network-entity.js for gcFirewallScopePillHtml (load gc-combine-flyout-conflicts after it).
 */
(function () {
  "use strict";

  let MODAL_ID = "gc-combine-field-pick-modal";
  let pickValueStore = [];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function previewText(s, maxLen) {
    let t = String(s == null ? "" : s);
    if (t.length <= maxLen) return t;
    return t.slice(0, Math.max(0, maxLen - 1)) + "…";
  }

  function normItem(s) {
    return String(s == null ? "" : s).trim();
  }

  function itemsFromJsonArray(arr) {
    let out = [];
    for (let ai = 0; ai < arr.length; ai++) {
      let x = arr[ai];
      if (x === null || x === undefined) continue;
      if (typeof x === "object") out.push(JSON.stringify(x));
      else out.push(String(x));
    }
    return out.map(normItem).filter(Boolean);
  }

  /** @returns {string[]|null} non-null means treat as list for display/compare */
  function detectListShape(raw) {
    if (Array.isArray(raw)) {
      let fromArr = itemsFromJsonArray(raw);
      return fromArr.length ? fromArr : null;
    }
    if (raw == null) return null;
    if (typeof raw !== "string") return null;
    let t = raw.trim();
    if (!t) return null;
    if (t.charAt(0) === "[" || t.charAt(0) === "{") {
      try {
        let p = JSON.parse(t);
        if (Array.isArray(p)) {
          let parsed = itemsFromJsonArray(p);
          return parsed.length ? parsed : null;
        }
        if (p !== null && typeof p === "object") {
          return null;
        }
      } catch (e0) {
        return null;
      }
      return null;
    }
    let lines = t.split(/\r?\n/).map(normItem).filter(Boolean);
    if (lines.length >= 2) return lines;
    if (t.indexOf(",") !== -1) {
      let parts = t.split(",").map(normItem).filter(Boolean);
      if (parts.length >= 2) return parts;
    }
    return null;
  }

  function itemsForDisplay(raw) {
    let d = detectListShape(raw);
    if (d) return d;
    return [normItem(raw)];
  }

  function useListPresentation(perFw, fwLabels) {
    for (let i = 0; i < fwLabels.length; i++) {
      if (detectListShape(perFw[fwLabels[i]]) !== null) return true;
    }
    return false;
  }

  function itemPresentOnAllFirewalls(norm, perFw, fwLabels) {
    if (!fwLabels.length) return true;
    for (let i = 0; i < fwLabels.length; i++) {
      let items = itemsForDisplay(perFw[fwLabels[i]]);
      let seen = {};
      for (let j = 0; j < items.length; j++) seen[normItem(items[j])] = true;
      if (!seen[norm]) return false;
    }
    return true;
  }

  function gcExtractCombinePerFieldMap(row) {
    if (!row || typeof row !== "object") return null;
    if (row.access_per_firewall && typeof row.access_per_firewall === "object") {
      return row.access_per_firewall;
    }
    let keys = Object.keys(row);
    for (let i = 0; i < keys.length; i++) {
      let k = keys[i];
      if (/_combine_per_field$/.test(k) && row[k] && typeof row[k] === "object") {
        return row[k];
      }
    }
    return null;
  }

  function parseFieldKeys(attr) {
    if (!attr || typeof attr !== "string") return [];
    return attr
      .split(",")
      .map(function (x) {
        return String(x || "").trim();
      })
      .filter(Boolean);
  }

  function matchingPerFieldKey(el, perMap) {
    let keys = parseFieldKeys(el.dataset.gcCombineFieldKeys);
    for (let i = 0; i < keys.length; i++) {
      if (Object.prototype.hasOwnProperty.call(perMap, keys[i])) return keys[i];
    }
    return "";
  }

  function ensureModal() {
    let m = document.getElementById(MODAL_ID);
    if (m) return m;
    m = document.createElement("div");
    m.id = MODAL_ID;
    m.className = "gc-combine-field-pick-subflyout gc-combine-field-pick-modal";
    m.hidden = true;
    m.setAttribute("aria-hidden", "true");
    m.innerHTML =
      '<div class="gc-combine-field-pick-subflyout__backdrop" tabindex="-1" aria-hidden="true"></div>' +
      '<div class="gc-combine-field-pick-subflyout__panel" role="dialog" aria-modal="true" aria-labelledby="' +
      MODAL_ID +
      '-title">' +
      '<header class="gc-if-flyout__header">' +
      '<h2 id="' +
      MODAL_ID +
      '-title" class="gc-if-flyout__title">Values by firewall</h2>' +
      '<button type="button" class="gc-net-zone-combine-modal__close gc-combine-field-pick-subflyout__close" aria-label="Close">' +
      "<span aria-hidden=\"true\">×</span></button>" +
      "</header>" +
      '<div class="gc-if-flyout__scroll">' +
      '<div class="gc-combine-field-pick-modal__body gc-if-flyout__form-body"></div>' +
      "</div>" +
      '<footer class="gc-if-flyout__footer">' +
      '<button type="button" class="btn btn--secondary gc-combine-field-pick-done">Close</button>' +
      "</footer>" +
      "</div>";
    document.body.appendChild(m);
    function close() {
      m.hidden = true;
      m.setAttribute("aria-hidden", "true");
    }
    m.querySelector(".gc-combine-field-pick-subflyout__backdrop").addEventListener("click", close);
    m.querySelector(".gc-combine-field-pick-subflyout__close").addEventListener("click", close);
    m.querySelector(".gc-combine-field-pick-done").addEventListener("click", close);
    m.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });
    return m;
  }

  function openPickModal(title, perFw, onChoose) {
    let m = ensureModal();
    let body = m.querySelector(".gc-combine-field-pick-modal__body");
    let titleEl = m.querySelector("#" + MODAL_ID + "-title");
    if (titleEl) titleEl.textContent = title || "Values by firewall";
    pickValueStore = [];
    let fwLabels = Object.keys(perFw || {}).sort();
    if (!body) return;
    body.innerHTML = "";
    let listMode = useListPresentation(perFw, fwLabels);
    let hint = document.createElement("p");
    hint.className = "muted gc-combine-field-pick-hint";
    hint.textContent = listMode
      ? "Click a row to apply that firewall’s value to the form. Gray list items appear on every firewall; red items are missing on at least one."
      : "Click a row to apply that firewall’s value to the form.";
    body.appendChild(hint);
    let ul = document.createElement("ul");
    ul.className = "gc-net-zone-modal__fw-list gc-combine-field-pick-list";
    fwLabels.forEach(function (fw, idx) {
      let raw = perFw[fw];
      pickValueStore[idx] = raw;
      let li = document.createElement("li");
      li.className = "gc-net-zone-modal__fw-row gc-combine-field-pick-row";
      let btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gc-combine-field-pick-option";
      btn.setAttribute("data-gc-pick-idx", String(idx));
      let pill =
        typeof globalThis.gcFirewallScopePillHtml === "function"
          ? globalThis.gcFirewallScopePillHtml(fw)
          : escapeHtml(fw);
      let pillWrap = document.createElement("span");
      pillWrap.className = "gc-combine-field-pick-option__pill";
      pillWrap.innerHTML = pill;
      let valCol = document.createElement("span");
      valCol.className = "gc-combine-field-pick-option__val mono";
      if (listMode) {
        let rowItems = itemsForDisplay(raw);
        let valList = document.createElement("ul");
        valList.className = "gc-combine-field-pick-val-list";
        for (let vi = 0; vi < rowItems.length; vi++) {
          let entry = rowItems[vi];
          let vli = document.createElement("li");
          let n = normItem(entry);
          vli.className =
            "gc-combine-field-pick-val-li " +
            (itemPresentOnAllFirewalls(n, perFw, fwLabels)
              ? "gc-combine-field-pick-val-li--all"
              : "gc-combine-field-pick-val-li--partial");
          vli.textContent = entry;
          valList.appendChild(vli);
        }
        valCol.appendChild(valList);
      } else {
        valCol.textContent = previewText(raw, 400);
      }
      btn.appendChild(pillWrap);
      btn.appendChild(valCol);
      btn.addEventListener("click", function () {
        let i = parseInt(btn.dataset.gcPickIdx || "-1", 10);
        if (isNaN(i) || i < 0) return;
        let v = pickValueStore[i];
        onChoose(fw, v);
        m.hidden = true;
        m.setAttribute("aria-hidden", "true");
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
    body.appendChild(ul);
    m.hidden = false;
    m.setAttribute("aria-hidden", "false");
  }

  function findPrimaryControl(fieldEl) {
    if (!fieldEl) return null;
    let sel = fieldEl.querySelector(
      'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), select, textarea',
    );
    if (sel) return sel;
    let ra = fieldEl.querySelector('input[type="radio"]');
    return ra;
  }

  function applyRawValueToControl(fieldEl, raw) {
    let s = raw != null ? String(raw) : "";
    let el = findPrimaryControl(fieldEl);
    if (!el) return false;
    let tag = el.tagName;
    if (tag === "SELECT") {
      el.value = s;
      if (el.value !== s) {
        let opt = document.createElement("option");
        opt.value = s;
        opt.textContent = previewText(s, 80);
        el.appendChild(opt);
        el.value = s;
      }
      try {
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e0) {}
      return true;
    }
    if (tag === "TEXTAREA" || (tag === "INPUT" && el.type !== "radio" && el.type !== "checkbox")) {
      el.value = s;
      try {
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e1) {}
      return true;
    }
    if (tag === "INPUT" && el.type === "radio") {
      let rname = el.name;
      if (!rname) return false;
      let hit = false;
      fieldEl.querySelectorAll('input[type="radio"]').forEach(function (r) {
        if (r.name !== rname) return;
        r.checked = String(r.value) === s;
        if (r.checked) hit = true;
      });
      try {
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e2) {}
      return true;
    }
    if (tag === "INPUT" && el.type === "checkbox") {
      let on =
        s === "1" ||
        /^true$/i.test(s) ||
        /^yes$/i.test(s) ||
        /^on$/i.test(s) ||
        /^enable/i.test(s);
      el.checked = on;
      try {
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e3) {}
      return true;
    }
    return false;
  }

  function gcCombineFlyoutClearConflictChrome(root) {
    if (!root) return;
    root.querySelectorAll(".gc-combine-flyout-field--conflict").forEach(function (el) {
      el.classList.remove("gc-combine-flyout-field--conflict");
    });
    root.querySelectorAll(".gc-combine-flyout-conflict-trigger").forEach(function (n) {
      n.remove();
    });
  }

  /**
   * @param {HTMLElement} root
   * @param {object} row - table row payload
   * @param {object} [options]
   * @param {Object<string, function(string, string): void>} [options.fieldPickHandlers] - keyed by API column id; (rawValue, fwLabel) => void
   * @param {Object<string, string>} [options.columnLabels] - optional titles for modal
   */
  function gcCombineFlyoutApplyConflictChrome(root, row, options) {
    options = options || {};
    gcCombineFlyoutClearConflictChrome(root);
    let perMap = gcExtractCombinePerFieldMap(row);
    if (!root || !perMap) return;
    let handlers = options.fieldPickHandlers || {};
    let colLabels = options.columnLabels || {};
    let targets = root.querySelectorAll("[data-gc-combine-field-keys]");
    targets.forEach(function (fieldEl) {
      let colKey = matchingPerFieldKey(fieldEl, perMap);
      if (!colKey) return;
      fieldEl.classList.add("gc-combine-flyout-field--conflict");
      let perFw = perMap[colKey];
      if (!perFw || typeof perFw !== "object") return;
      let trig = document.createElement("button");
      trig.type = "button";
      trig.className = "gc-combine-flyout-conflict-trigger";
      trig.setAttribute("aria-label", "Compare values across firewalls and pick one");
      trig.title = "Values differ across firewalls — click to compare and apply one";
      trig.innerHTML =
        '<svg class="gc-combine-flyout-conflict-trigger__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 5h2v6h-2V7zm0 8h2v2h-2v-2z"/></svg>';
      trig.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        let modalTitle = colLabels[colKey] || colKey;
        openPickModal(modalTitle, perFw, function (_fw, raw) {
          if (handlers[colKey]) {
            handlers[colKey](raw, _fw);
          } else {
            applyRawValueToControl(fieldEl, raw);
          }
        });
      });
      let label = null;
      let ch = fieldEl.children;
      for (let ci = 0; ci < ch.length; ci++) {
        if (ch[ci].classList && ch[ci].classList.contains("gc-if-flyout__label")) {
          label = ch[ci];
          break;
        }
      }
      if (label && label.parentNode === fieldEl) {
        let rowBar = document.createElement("div");
        rowBar.className = "gc-combine-flyout-conflict-label-row";
        label.parentNode.insertBefore(rowBar, label);
        rowBar.appendChild(label);
        rowBar.appendChild(trig);
      } else {
        fieldEl.classList.add("gc-combine-flyout-conflict--no-label");
        trig.classList.add("gc-combine-flyout-conflict-trigger--float");
        fieldEl.insertBefore(trig, fieldEl.firstChild);
      }
    });
  }

  globalThis.gcExtractCombinePerFieldMap = gcExtractCombinePerFieldMap;
  globalThis.gcCombineFlyoutClearConflictChrome = gcCombineFlyoutClearConflictChrome;
  globalThis.gcCombineFlyoutApplyConflictChrome = gcCombineFlyoutApplyConflictChrome;
  globalThis.gcCombineFlyoutOpenPickModal = openPickModal;
})();
