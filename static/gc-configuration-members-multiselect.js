(function () {
  "use strict";

  let byRoot = new WeakMap();
  let docClickEscapeBound = false;

  function bindGlobalCloseHandlers() {
    if (docClickEscapeBound) return;
    docClickEscapeBound = true;
    document.addEventListener("click", function (e) {
      let t = e.target;
      if (!(t instanceof Node)) return;
      document.querySelectorAll("[data-gc-cfg-member-root]").forEach(function (r) {
        if (r.contains(t)) return;
        let api = byRoot.get(r);
        if (api && typeof api.closeDropdown === "function") api.closeDropdown();
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      document.querySelectorAll("[data-gc-cfg-member-root]").forEach(function (r) {
        let api = byRoot.get(r);
        if (api && typeof api.closeDropdown === "function") api.closeDropdown();
      });
    });
    document.addEventListener("gc-nav-firewalls-refresh-requested", function () {
      document.querySelectorAll("[data-gc-cfg-member-root]").forEach(function (r) {
        let api = byRoot.get(r);
        if (api && typeof api.applyInventoryAndKeepEfforts === "function") {
          api.applyInventoryAndKeepEfforts();
        }
      });
    });
  }

  function tagKey(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  function normalizeInventoryRows(arr) {
    let out = [];
    if (!Array.isArray(arr)) return out;
    arr.forEach(function (fw) {
      if (!fw || fw.id == null) return;
      let fid = parseInt(String(fw.id), 10);
      if (isNaN(fid) || fid <= 0) return;
      let lbl = String(fw.label != null ? fw.label : "").trim() || String(fid);
      let tags = [];
      if (Array.isArray(fw.tags)) {
        fw.tags.forEach(function (t) {
          if (typeof t === "string" && t.trim()) tags.push(t.trim());
        });
      }
      let desc = fw.description != null ? String(fw.description).trim() : "";
      out.push({
        id: fid,
        label: lbl,
        tags: tags,
        description: desc || null,
      });
    });
    out.sort(function (a, b) {
      return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
    });
    return out;
  }

  function readNavInventory() {
    let fws = typeof globalThis !== "undefined" ? globalThis.gcNavFirewallsJson : null;
    return normalizeInventoryRows(Array.isArray(fws) ? fws : []);
  }

  function distinctOrderedTags(fws) {
    let seen = {};
    let collected = [];
    (fws || []).forEach(function (fw) {
      (fw.tags || []).forEach(function (t) {
        let k = tagKey(t);
        if (!k || seen[k]) return;
        seen[k] = true;
        collected.push(String(t).trim());
      });
    });
    collected.sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    return collected;
  }

  function computeEffectiveIds(fws, selectedFwIds, selectedTags) {
    let set = {};
    let tagWant = {};
    (selectedTags || []).forEach(function (t) {
      let k = tagKey(t);
      if (k) tagWant[k] = true;
    });
    (selectedFwIds || []).forEach(function (id) {
      let n = parseInt(String(id), 10);
      if (!isNaN(n) && n > 0) set[String(n)] = true;
    });
    (fws || []).forEach(function (fw) {
      if (!fw || fw.id == null) return;
      let tags = fw.tags || [];
      for (let i = 0; i < tags.length; i++) {
        if (tagWant[tagKey(tags[i])]) {
          let n = parseInt(String(fw.id), 10);
          if (!isNaN(n) && n > 0) set[String(n)] = true;
          break;
        }
      }
    });
    return Object.keys(set)
      .map(function (k) {
        return parseInt(k, 10);
      })
      .filter(function (n) {
        return !isNaN(n);
      });
  }

  function parseMemberJsonString(raw) {
    let tags = [];
    let ids = [];
    try {
      let data = JSON.parse(raw || "{}");
      if (Array.isArray(data)) {
        data.forEach(function (x) {
          let n = parseInt(String(x), 10);
          if (!isNaN(n) && n > 0) ids.push(n);
        });
      } else if (data && typeof data === "object") {
        let t = data.tags;
        if (Array.isArray(t)) {
          t.forEach(function (x) {
            let s = String(x || "").trim();
            if (s) tags.push(s);
          });
        }
        let f = data.firewall_ids != null ? data.firewall_ids : data.firewallIds;
        if (Array.isArray(f)) {
          f.forEach(function (x) {
            let n = parseInt(String(x), 10);
            if (!isNaN(n) && n > 0) ids.push(n);
          });
        }
      }
    } catch (e) {
      return { tags: [], firewall_ids: [] };
    }
    ids.sort(function (a, b) {
      return a - b;
    });
    return { tags: tags, firewall_ids: ids };
  }

  function parseHiddenExplicit(hidden) {
    return parseMemberJsonString(hidden && hidden.value ? hidden.value : "");
  }

  function writeHiddenExplicit(hidden, fwIds, tagVals) {
    let tags = (tagVals || []).slice().filter(function (t) {
      return String(t || "").trim() !== "";
    });
    tags.sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    let ids = (fwIds || []).slice().filter(function (n) {
      return !isNaN(n) && n > 0;
    });
    ids.sort(function (a, b) {
      return a - b;
    });
    hidden.value = JSON.stringify({ tags: tags, firewall_ids: ids });
  }

  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  let ICON_INVENTORY_WRENCH =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

  function mount(root) {
    if (!root || byRoot.has(root)) return;
    bindGlobalCloseHandlers();
    let hidden = root.querySelector("[data-gc-cfg-member-hidden]");
    if (!hidden && root.parentElement) {
      hidden = root.parentElement.querySelector("[data-gc-cfg-member-hidden]");
    }
    let ms = root.querySelector("[data-gc-fw-ms]");
    if (!hidden || !ms) return;

    let trigger = ms.querySelector(".gc-hs-ip-host-flyout__fw-trigger");
    let dropdown = ms.querySelector(".gc-hs-ip-host-flyout__fw-dropdown");
    let textEl = ms.querySelector(".gc-hs-ip-host-flyout__fw-trigger-text");
    let chipsEl = ms.querySelector(".gc-hs-ip-host-flyout__fw-trigger-chips");
    let search = ms.querySelector(".gc-hs-ip-host-flyout__fw-search");
    let optsRoot = ms.querySelector(".gc-hs-ip-host-flyout__fw-ms-options");
    let emptyEl = ms.querySelector(".gc-hs-ip-host-flyout__fw-empty");
    let selectedPanel = ms.querySelector(".gc-net-fw-dropdown__selected");
    let countEl = root.querySelector("[data-gc-cfg-member-count]");

    let firewallInventory = readNavInventory();

    function readExplicitFwIdsFromMs() {
      let ids = [];
      ms.querySelectorAll(".gc-net-fw-cb:checked").forEach(function (cb) {
        let v = parseInt(cb.value, 10);
        if (!isNaN(v)) ids.push(v);
      });
      return ids;
    }

    function readExplicitTagsFromMs() {
      let tags = [];
      ms.querySelectorAll(".gc-net-fw-tag-cb:checked").forEach(function (cb) {
        let v = String(cb.value || "").trim();
        if (v) tags.push(v);
      });
      return tags;
    }

    function effectiveIdsNow() {
      return computeEffectiveIds(
        firewallInventory,
        readExplicitFwIdsFromMs(),
        readExplicitTagsFromMs(),
      );
    }

    function syncEffectiveCountLine() {
      if (!countEl) return;
      let eff = effectiveIdsNow().length;
      if (eff === 0) {
        countEl.textContent = "0 firewalls assigned.";
        return;
      }
      countEl.textContent = eff === 1 ? "1 firewall assigned." : eff + " firewalls assigned.";
    }

    function syncTriggerText() {
      let chipsFn =
        typeof globalThis.gcRenderMultiselectTriggerChips === "function"
          ? globalThis.gcRenderMultiselectTriggerChips
          : null;
      if (textEl) {
        let nFw = ms.querySelectorAll(".gc-net-fw-cb:checked").length;
        let nTag = ms.querySelectorAll(".gc-net-fw-tag-cb:checked").length;
        let eff = effectiveIdsNow().length;
        if (nFw === 0 && nTag === 0) {
          textEl.textContent = "No firewalls selected";
          textEl.classList.remove("gc-ms-trigger-sr");
          if (chipsEl) chipsEl.innerHTML = "";
        } else {
          let parts = [];
          if (nTag) parts.push(nTag === 1 ? "1 tag" : nTag + " tags");
          if (nFw) parts.push(nFw === 1 ? "1 firewall" : nFw + " firewalls");
          let base = parts.join(" · ");
          let summary =
            nTag > 0
              ? base +
                " → " +
                eff +
                " firewall" +
                (eff === 1 ? "" : "s") +
                " in scope"
              : base + " selected";
          textEl.textContent = summary;
          textEl.classList.add("gc-ms-trigger-sr");
          if (chipsEl && chipsFn) {
            let items = [];
            ms.querySelectorAll(".gc-net-fw-tag-cb:checked").forEach(function (cb) {
              let tag = String(cb.value || "").trim();
              if (!tag) return;
              items.push({
                label: tag,
                removeLabel: "Remove tag " + tag,
                onRemove: function () {
                  cb.checked = false;
                  onMsCheckboxChange();
                },
              });
            });
            ms.querySelectorAll(".gc-net-fw-cb:checked").forEach(function (cb) {
              let label =
                String(cb.dataset.gcFwLabel || "").trim() ||
                "#" + String(cb.value || "");
              let desc = String(cb.dataset.gcFwDesc || "").trim();
              items.push({
                label: label,
                title: desc || undefined,
                removeLabel: "Remove firewall " + label,
                onRemove: function () {
                  cb.checked = false;
                  onMsCheckboxChange();
                },
              });
            });
            chipsFn(chipsEl, items);
          } else if (textEl) {
            textEl.classList.remove("gc-ms-trigger-sr");
          }
        }
      }
      syncEffectiveCountLine();
    }

    function renderSelectedScopePanel() {
      if (!selectedPanel) return;
      let ids = effectiveIdsNow()
        .slice()
        .sort(function (a, b) {
          return a - b;
        });
      let map = {};
      firewallInventory.forEach(function (fw) {
        if (fw && fw.id != null) map[String(fw.id)] = fw;
      });
      let inner = document.createElement("div");
      inner.className = "gc-net-fw-selected__inner";
      let head = document.createElement("div");
      head.className = "gc-net-fw-selected__head";
      let sec = document.createElement("span");
      sec.className = "gc-top-bar-fw__section-label gc-net-fw-selected__head-title";
      sec.textContent = "Assigned firewalls";
      head.appendChild(sec);
      let cfg = globalThis.GC_TOP_BAR_FIREWALLS;
      let invUrl = cfg && cfg.inventoryUrl ? String(cfg.inventoryUrl).trim() : "";
      if (invUrl) {
        let inv = document.createElement("a");
        inv.className = "gc-net-fw-selected__inventory-link";
        inv.href = invUrl;
        inv.title = "Firewall inventory";
        inv.setAttribute("aria-label", "Open firewall inventory");
        inv.innerHTML = ICON_INVENTORY_WRENCH;
        head.appendChild(inv);
      }
      inner.appendChild(head);
      if (ids.length === 0) {
        let empty = document.createElement("p");
        empty.className = "gc-net-fw-selected__empty muted";
        empty.textContent = "None selected yet.";
        inner.appendChild(empty);
        selectedPanel.innerHTML = "";
        selectedPanel.appendChild(inner);
        return;
      }
      let list = document.createElement("div");
      list.className = "gc-net-fw-selected__list";
      ids.forEach(function (id) {
        let fw = map[String(id)];
        let label = fw ? fw.label : "#" + id;
        let desc = fw && fw.description ? String(fw.description) : "";
        let row = document.createElement("div");
        row.className = "gc-net-fw-selected__row";
        let rowHead = document.createElement("div");
        rowHead.className = "gc-net-fw-selected__row-head";
        let nameEl = document.createElement("span");
        nameEl.className = "gc-net-fw-selected__name mono";
        nameEl.textContent = label;
        rowHead.appendChild(nameEl);
        row.appendChild(rowHead);
        if (desc) {
          let pDesc = document.createElement("p");
          pDesc.className = "gc-net-fw-selected__desc";
          pDesc.textContent = desc;
          row.appendChild(pDesc);
        }
        list.appendChild(row);
      });
      inner.appendChild(list);
      selectedPanel.innerHTML = "";
      selectedPanel.appendChild(inner);
    }

    function onMsCheckboxChange() {
      writeHiddenExplicit(hidden, readExplicitFwIdsFromMs(), readExplicitTagsFromMs());
      syncTriggerText();
      renderSelectedScopePanel();
    }

    function applyExplicitToCheckboxes(tags, ids) {
      let tagWant = {};
      (tags || []).forEach(function (t) {
        let k = tagKey(t);
        if (k) tagWant[k] = true;
      });
      ms.querySelectorAll(".gc-net-fw-tag-cb").forEach(function (cb) {
        cb.checked = !!tagWant[tagKey(cb.value)];
      });
      let idWant = {};
      (ids || []).forEach(function (n) {
        idWant[String(n)] = true;
      });
      ms.querySelectorAll(".gc-net-fw-cb").forEach(function (cb) {
        cb.checked = !!idWant[String(cb.value)];
      });
      writeHiddenExplicit(hidden, readExplicitFwIdsFromMs(), readExplicitTagsFromMs());
      syncTriggerText();
      renderSelectedScopePanel();
    }

    function renderMsOptions() {
      if (!optsRoot) return;
      optsRoot.innerHTML = "";
      let tags = distinctOrderedTags(firewallInventory);
      if (tags.length > 0) {
        let sec = document.createElement("div");
        sec.className = "gc-top-bar-fw__section-label";
        sec.textContent = "Tags";
        optsRoot.appendChild(sec);
        tags.forEach(function (tag) {
          let lab = document.createElement("label");
          lab.className =
            "gc-multiselect__option gc-hs-ip-host-flyout__fw-option gc-top-bar-fw__tag-option";
          let cb = document.createElement("input");
          cb.type = "checkbox";
          cb.className = "gc-net-fw-tag-cb";
          cb.value = tag;
          cb.setAttribute("data-gc-fw-tag", tag);
          cb.addEventListener("change", onMsCheckboxChange);
          let pill = document.createElement("span");
          pill.className = "gc-hs-ip-host-flyout__fw-pill";
          pill.textContent = tag;
          lab.appendChild(cb);
          lab.appendChild(pill);
          optsRoot.appendChild(lab);
        });
        let div = document.createElement("div");
        div.className = "gc-top-bar-fw__divider";
        div.setAttribute("role", "separator");
        optsRoot.appendChild(div);
        let secFw = document.createElement("div");
        secFw.className = "gc-top-bar-fw__section-label";
        secFw.textContent = "Firewalls";
        optsRoot.appendChild(secFw);
      }
      firewallInventory.forEach(function (it) {
        let id = it.id;
        let label = String(it.label != null ? it.label : "").trim() || String(id);
        let lab = document.createElement("label");
        lab.className =
          "gc-multiselect__option gc-hs-ip-host-flyout__fw-option gc-top-bar-fw__fw-option";
        let cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "gc-net-fw-cb";
        cb.value = String(id);
        cb.setAttribute("data-gc-fw-id", String(id));
        cb.setAttribute("data-gc-fw-label", label);
        cb.addEventListener("change", onMsCheckboxChange);
        let textWrap = document.createElement("span");
        textWrap.className = "gc-hs-ip-host-flyout__hg-opt-text";
        let nameEl = document.createElement("span");
        nameEl.className = "gc-hs-ip-host-flyout__hg-opt-name mono";
        nameEl.textContent = label;
        textWrap.appendChild(nameEl);
        lab.appendChild(cb);
        lab.appendChild(textWrap);
        optsRoot.appendChild(lab);
      });
      if (emptyEl) {
        let showEmpty = firewallInventory.length === 0;
        emptyEl.hidden = !showEmpty;
        if (showEmpty) {
          emptyEl.textContent = "No firewalls registered.";
        }
      }
      syncTriggerText();
    }

    function applyInventoryAndKeepEfforts() {
      let prevTags = readExplicitTagsFromMs();
      let prevFw = readExplicitFwIdsFromMs();
      firewallInventory = readNavInventory();
      renderMsOptions();
      applyExplicitToCheckboxes(prevTags, prevFw);
      runFwFilter();
    }

    function runFwFilter() {
      let q = norm(search ? search.value : "");
      ms.querySelectorAll(".gc-top-bar-fw__tag-option").forEach(function (lab) {
        let cb = lab.querySelector("[data-gc-fw-tag]");
        let tg = cb ? norm(cb.dataset.gcFwTag || "") : "";
        let match = !q || tg.indexOf(q) !== -1;
        lab.style.display = match ? "" : "none";
      });
      ms.querySelectorAll(".gc-top-bar-fw__fw-option").forEach(function (lab) {
        let cb = lab.querySelector("[data-gc-fw-id]");
        let nm = cb ? norm(cb.dataset.gcFwLabel || "") : "";
        let idStr = cb ? norm(String(cb.dataset.gcFwId || "")) : "";
        let match = !q || nm.indexOf(q) !== -1 || idStr.indexOf(q) !== -1;
        lab.style.display = match ? "" : "none";
      });
    }

    function setOpen(open) {
      if (!dropdown) return;
      dropdown.hidden = !open;
      if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        renderSelectedScopePanel();
      }
    }

    if (trigger && dropdown) {
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(dropdown.hidden);
        if (!dropdown.hidden && search) {
          try {
            search.focus();
          } catch (eF) {}
        }
      });
    }

    if (dropdown) {
      dropdown.addEventListener("mousedown", function (e) {
        e.stopPropagation();
      });
      dropdown.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }

    if (search) {
      search.addEventListener("input", runFwFilter);
      search.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }

    function loadFromMemberJson(jsonStr) {
      let st = parseMemberJsonString(typeof jsonStr === "string" ? jsonStr : "");
      hidden.value = JSON.stringify({ tags: st.tags, firewall_ids: st.firewall_ids });
      firewallInventory = readNavInventory();
      renderMsOptions();
      applyExplicitToCheckboxes(st.tags, st.firewall_ids);
      runFwFilter();
    }

    function resetAfterFormResetEmpty() {
      hidden.value = JSON.stringify({ tags: [], firewall_ids: [] });
      firewallInventory = readNavInventory();
      renderMsOptions();
      applyExplicitToCheckboxes([], []);
      runFwFilter();
    }

    renderMsOptions();
    (function () {
      let init = parseHiddenExplicit(hidden);
      applyExplicitToCheckboxes(init.tags, init.firewall_ids);
    })();
    runFwFilter();

    let api = {
      loadFromMemberJson: loadFromMemberJson,
      resetAfterFormResetEmpty: resetAfterFormResetEmpty,
      closeDropdown: function () {
        setOpen(false);
      },
      applyInventoryAndKeepEfforts: applyInventoryAndKeepEfforts,
    };
    byRoot.set(root, api);
  }

  function init() {
    document.querySelectorAll("[data-gc-cfg-member-root]").forEach(mount);
  }

  globalThis.gcCfgMemberMsInit = init;
  globalThis.gcCfgMemberMsGetApi = function (root) {
    return byRoot.get(root) || null;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
