(function () {
  "use strict";

  var root = document.getElementById("gc-ipam-root");
  if (!root) return;

  var PREFIX = "gc-ipam";
  /** Parent pool dropdown: opens nested “new pool” sheet (IPv4 only). */
  var NEW_POOL_VALUE = "__gc_new_pool__";
  var FACET_STORAGE_KEY = "gc-ipam";
  var LS_COLS = "gc-ipam-cols-v1";
  var COL_CHECK_ATTR = "data-gc-ipam-col";
  var COLS = [
    { id: "name", label: "Name" },
    { id: "cidr", label: "Prefix" },
    { id: "family", label: "Family" },
    { id: "type", label: "Type" },
    { id: "assigned", label: "Assigned to" },
    { id: "vrf", label: "VRF" },
    { id: "size", label: "Size" },
    { id: "description", label: "Description" },
    { id: "origin", label: "Source" },
  ];
  var colInputSel = "input[" + COL_CHECK_ATTR + "]";

  var facetCols = COLS.filter(function (c) {
    return c.id !== "origin";
  })
    .map(function (c) {
      var lab = c.label;
      if (typeof window.gcTableColumnDisplayLabel === "function") {
        lab = window.gcTableColumnDisplayLabel(lab);
      }
      return { id: c.id, label: lab };
    })
    .concat([
      {
        id: "discovered",
        label:
          typeof window.gcTableColumnDisplayLabel === "function"
            ? window.gcTableColumnDisplayLabel("Discovered")
            : "Discovered",
      },
      {
        id: "conflict",
        label:
          typeof window.gcTableColumnDisplayLabel === "function"
            ? window.gcTableColumnDisplayLabel("VRF conflict")
            : "VRF conflict",
      },
    ]);

  var apiList = root.getAttribute("data-api-prefixes") || "";
  var apiCreate = root.getAttribute("data-api-create") || "";
  var apiAccept = root.getAttribute("data-api-accept-discovered") || "";
  var apiAcceptBatch = root.getAttribute("data-api-accept-discovered-batch") || "";
  var apiNextAssignment = root.getAttribute("data-api-next-assignment") || "";
  var apiVrfs = root.getAttribute("data-api-vrfs") || "";
  var apiVrfsCreate = root.getAttribute("data-api-vrfs-create") || "";
  var pageMode = (root.getAttribute("data-gc-ipam-page") || "").trim().toLowerCase();
  var lockedPrefixType = (root.getAttribute("data-gc-ipam-locked-type") || "").trim().toLowerCase();
  var isPrefixPage =
    pageMode === "pools" || pageMode === "assignments" || pageMode === "hosts";
  var isVrfPage = pageMode === "vrfs";
  var table = document.getElementById("gc-ipam-table");
  var tbody = document.getElementById("gc-ipam-tbody");
  var searchInput = document.getElementById("gc-ipam-search");
  var statusEl = document.getElementById("gc-ipam-status");
  var filtersDrawerEl = document.getElementById(PREFIX + "-filters-drawer");
  var filtersAsideEl = document.getElementById(PREFIX + "-filters-aside");
  var facetHeadActions = document.getElementById(PREFIX + "-facet-head-actions");
  var facetCountEl = document.getElementById(PREFIX + "-facet-count");
  var facetResetBtn = document.getElementById(PREFIX + "-facet-reset");
  var countEl = document.getElementById(PREFIX + "-count");
  var colsModal = document.getElementById(PREFIX + "-cols-modal");
  var colsTrigger = document.getElementById(PREFIX + "-cols-trigger");
  var colsPanel = document.getElementById(PREFIX + "-cols-panel");
  var colsFilter = document.getElementById(PREFIX + "-cols-filter");
  var colsList = document.getElementById(PREFIX + "-cols-list");
  var colsClose = document.getElementById(PREFIX + "-cols-close");

  var flyout = document.getElementById("gc-ipam-flyout");
  var flyoutPanel = flyout && flyout.querySelector(".gc-if-flyout__panel");
  var flyoutBackdrop = flyout && flyout.querySelector(".gc-if-flyout__backdrop");
  var flyoutTitle = document.getElementById("gc-ipam-flyout-title");
  var form = document.getElementById("gc-ipam-flyout-form");
  var fieldId = document.getElementById("gc-ipam-flyout-id");
  var fieldName = document.getElementById("gc-ipam-flyout-name");
  var fieldCidr = document.getElementById("gc-ipam-flyout-cidr");
  var wrapAssignmentSize = document.getElementById("gc-ipam-flyout-assignment-size-wrap");
  var fieldAssignmentPl = document.getElementById("gc-ipam-flyout-assignment-pl");
  var labelCidr = document.getElementById("gc-ipam-flyout-cidr-label");
  var btnCidrRefresh = document.getElementById("gc-ipam-flyout-cidr-refresh");
  var fieldVrf = document.getElementById("gc-ipam-flyout-vrf");
  var fieldType = document.getElementById("gc-ipam-flyout-type");
  var fieldTypeDisplay = document.getElementById("gc-ipam-flyout-type-display");
  var fieldPoolUnmanagedWrap = document.getElementById("gc-ipam-flyout-pool-unmanaged-wrap");
  var fieldPoolUnmanagedSwitch = document.getElementById("gc-ipam-flyout-pool-unmanaged-switch");
  var fieldAssignedFw = document.getElementById("gc-ipam-flyout-assigned-fw");
  var fieldAssignedCustom = document.getElementById("gc-ipam-flyout-assigned-custom");
  var assignedWrap = document.getElementById("gc-ipam-flyout-assigned-wrap");
  var fieldDesc = document.getElementById("gc-ipam-flyout-description");
  var fieldParentPool = document.getElementById("gc-ipam-flyout-parent-pool");
  var fieldParentAssignment = document.getElementById("gc-ipam-flyout-parent-assignment");
  var wrapParentPool = document.getElementById("gc-ipam-flyout-parent-pool-wrap");
  var wrapParentAssignment = document.getElementById("gc-ipam-flyout-parent-assignment-wrap");
  var parentPoolReqStar = document.getElementById("gc-ipam-flyout-parent-pool-req");
  var parentPoolHint = document.getElementById("gc-ipam-flyout-parent-pool-hint");
  var parentPoolHintPool = document.getElementById("gc-ipam-flyout-parent-pool-hint-pool");
  var parentPoolSelectBlock = document.getElementById("gc-ipam-flyout-parent-pool-select-block");
  var parentPoolReadonlyBlock = document.getElementById("gc-ipam-flyout-parent-pool-readonly-block");
  var parentPoolReadonlyEl = document.getElementById("gc-ipam-flyout-parent-pool-readonly");
  var formStatus = document.getElementById("gc-ipam-flyout-status");
  var deleteBtn = document.getElementById("gc-ipam-flyout-delete");

  var discFlyout = document.getElementById("gc-ipam-disc-flyout");
  var discFlyoutPanel = discFlyout && discFlyout.querySelector(".gc-if-flyout__panel");
  var discFlyoutBackdrop = discFlyout && discFlyout.querySelector(".gc-if-flyout__backdrop");
  var discTitle = document.getElementById("gc-ipam-disc-flyout-title");
  var discCidrEl = document.getElementById("gc-ipam-disc-flyout-cidr");
  var discFwEl = document.getElementById("gc-ipam-disc-flyout-fw");
  var discSourcesEl = document.getElementById("gc-ipam-disc-flyout-sources");
  var discName = document.getElementById("gc-ipam-disc-flyout-name");
  var discAssignedFw = document.getElementById("gc-ipam-disc-flyout-assigned-fw");
  var discAssignedCustom = document.getElementById("gc-ipam-disc-flyout-assigned-custom");
  var discDesc = document.getElementById("gc-ipam-disc-flyout-description");
  var discPoolLine = document.getElementById("gc-ipam-disc-flyout-pool-line");
  var discStatus = document.getElementById("gc-ipam-disc-flyout-status");
  var discAcceptBtn = document.getElementById("gc-ipam-disc-flyout-accept");
  var discCancelBtn = document.getElementById("gc-ipam-disc-flyout-cancel");

  var poolFlyout = document.getElementById("gc-ipam-pool-flyout");
  var poolFlyoutPanel = poolFlyout && poolFlyout.querySelector(".gc-if-flyout__panel");
  var poolFlyoutBackdrop = poolFlyout && poolFlyout.querySelector(".gc-if-flyout__backdrop");
  var poolForm = document.getElementById("gc-ipam-pool-flyout-form");
  var poolCidr = document.getElementById("gc-ipam-pool-flyout-cidr");
  var poolName = document.getElementById("gc-ipam-pool-flyout-name");
  var poolStatus = document.getElementById("gc-ipam-pool-flyout-status");
  var poolCancelBtn = document.getElementById("gc-ipam-pool-flyout-cancel");

  var nestedPoolFlyout = document.getElementById("gc-ipam-nested-pool-flyout");
  var nestedPoolFlyoutPanel = nestedPoolFlyout && nestedPoolFlyout.querySelector(".gc-if-flyout__panel");
  var nestedPoolFlyoutBackdrop = nestedPoolFlyout && nestedPoolFlyout.querySelector(".gc-if-flyout__backdrop");
  var nestedPoolForm = document.getElementById("gc-ipam-nested-pool-flyout-form");
  var nestedPoolPl = document.getElementById("gc-ipam-nested-pool-pl");
  var nestedPoolName = document.getElementById("gc-ipam-nested-pool-name");
  var nestedPoolResult = document.getElementById("gc-ipam-nested-pool-result");
  var nestedPoolVrf = document.getElementById("gc-ipam-nested-pool-vrf");
  var nestedPoolAssignCidr = document.getElementById("gc-ipam-nested-pool-assignment-cidr");
  var nestedPoolStatus = document.getElementById("gc-ipam-nested-pool-flyout-status");
  var nestedPoolCancelBtn = document.getElementById("gc-ipam-nested-pool-flyout-cancel");
  var nestedPoolSubmitBtn = document.getElementById("gc-ipam-nested-pool-flyout-submit");
  var assignedFwLockedHint = document.getElementById("gc-ipam-flyout-assigned-fw-locked-hint");

  var vrfTbody = document.getElementById("gc-ipam-vrf-tbody");
  var vrfCountEl = document.getElementById("gc-ipam-vrf-count");
  var vrfFlyout = document.getElementById("gc-ipam-vrf-flyout");
  var vrfFlyoutPanel = vrfFlyout && vrfFlyout.querySelector(".gc-if-flyout__panel");
  var vrfFlyoutBackdrop = vrfFlyout && vrfFlyout.querySelector(".gc-if-flyout__backdrop");
  var vrfForm = document.getElementById("gc-ipam-vrf-flyout-form");
  var vrfFlyoutName = document.getElementById("gc-ipam-vrf-flyout-name");
  var vrfFlyoutDesc = document.getElementById("gc-ipam-vrf-flyout-description");
  var vrfFlyoutStatus = document.getElementById("gc-ipam-vrf-flyout-status");
  var vrfFlyoutCancel = document.getElementById("gc-ipam-vrf-flyout-cancel");
  var vrfAddOpenBtn = document.getElementById("gc-ipam-vrf-add-open");

  var quickDiscoveredMode = "all";
  var quickConflictOnly = false;
  var editId = null;
  var cache = [];
  var cacheDiscovered = [];
  var discCurrent = null;
  /** When set, main add flyout was opened from a discovered row (firewall field locked). */
  var discoveredPrefillSource = null;
  var ipamFormMeta = { vrf_names: [], pools: [], assignments: [] };

  function prefixTypeLabel(ptype) {
    var p = (ptype || "").trim().toLowerCase();
    if (p === "pool") return "Pool";
    if (p === "assignment") return "Assignment";
    if (p === "host") return "Host";
    return ptype ? String(ptype) : "—";
  }

  function addTitleForLockedType() {
    if (lockedPrefixType === "pool") return "Add pool";
    if (lockedPrefixType === "assignment") return "Add assignment";
    if (lockedPrefixType === "host") return "Add host";
    return "Add prefix";
  }

  function editTitleForPrefixType(ptype) {
    var p = (ptype || "").trim().toLowerCase();
    if (p === "pool") return "Edit pool";
    if (p === "assignment") return "Edit assignment";
    if (p === "host") return "Edit host";
    return "Edit prefix";
  }

  /** Keep hidden prefix_type, readonly label, and dependent flyout sections in sync. */
  function setFlyoutPrefixType(ptypeRaw) {
    var ptype = (ptypeRaw || "").trim().toLowerCase();
    if (!ptype) ptype = lockedPrefixType || "assignment";
    if (fieldType) fieldType.value = ptype;
    if (fieldTypeDisplay) fieldTypeDisplay.textContent = prefixTypeLabel(ptype);
    syncHierarchyFlyout();
    syncPoolUnmanagedWrap();
    syncAssignedWrap();
    syncIpamDeleteButton();
    syncAssignmentCidrUi();
  }

  function loadColVis() {
    var d = {};
    COLS.forEach(function (c) {
      d[c.id] = true;
    });
    try {
      var raw = localStorage.getItem(LS_COLS);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object") {
          COLS.forEach(function (c) {
            if (Object.prototype.hasOwnProperty.call(o, c.id)) d[c.id] = !!o[c.id];
          });
        }
      }
    } catch (e) {}
    var visible = 0;
    COLS.forEach(function (c) {
      if (d[c.id]) visible++;
    });
    if (visible < 1 && COLS.length) d[COLS[0].id] = true;
    return d;
  }

  var colVis = loadColVis();

  function persistColVis(vis) {
    try {
      localStorage.setItem(LS_COLS, JSON.stringify(vis));
    } catch (e) {}
  }

  function applyColVis(vis) {
    if (!table) return;
    COLS.forEach(function (c) {
      var on = !!vis[c.id];
      table.querySelectorAll('[data-gc-col="' + c.id + '"]').forEach(function (el) {
        el.classList.toggle("gc-col-hidden", !on);
      });
    });
  }

  function syncFilterEmptyColspan() {
    var n = table ? table.querySelectorAll("thead th").length : 9;
    var fe = document.getElementById("gc-ipam-filter-empty");
    if (fe) {
      var td = fe.querySelector("td");
      if (td) td.setAttribute("colspan", String(n));
    }
    var ph = document.getElementById("gc-ipam-placeholder");
    if (ph) {
      var ptd = ph.querySelector("td");
      if (ptd) ptd.setAttribute("colspan", String(n));
    }
  }

  function updateFacetChrome() {
    var n =
      filtersDrawerEl && window.gcTableFacets
        ? window.gcTableFacets.appliedCount(filtersDrawerEl)
        : 0;
    if (!facetHeadActions || !facetCountEl || !facetResetBtn) return;
    if (n > 0) {
      facetHeadActions.hidden = false;
      facetCountEl.innerHTML = '<span class="filters__facet-count-num">' + n + "</span> applied";
      facetResetBtn.hidden = false;
    } else {
      facetHeadActions.hidden = true;
      facetCountEl.textContent = "";
      facetResetBtn.hidden = true;
    }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("settings-form__status--error", !!isError);
  }

  function setFormStatus(msg, isError) {
    if (!formStatus) return;
    formStatus.textContent = msg || "";
    formStatus.classList.toggle("settings-form__status--error", !!isError);
  }

  function setDiscStatus(msg, isError) {
    if (!discStatus) return;
    discStatus.textContent = msg || "";
    discStatus.classList.toggle("settings-form__status--error", !!isError);
  }

  function setPoolStatus(msg, isError) {
    if (!poolStatus) return;
    poolStatus.textContent = msg || "";
    poolStatus.classList.toggle("settings-form__status--error", !!isError);
  }

  function vrfKey(v) {
    var t = (v || "").trim();
    return t ? t : "default";
  }

  function ipv4ParseCidr(s) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(String(s || "").trim());
    if (!m) return null;
    var a = +m[1];
    var b = +m[2];
    var c = +m[3];
    var d = +m[4];
    var pl = +m[5];
    if (a > 255 || b > 255 || c > 255 || d > 255 || pl < 0 || pl > 32) return null;
    var ip = (((a << 24) | (b << 16) | (c << 8) | d) >>> 0);
    return { ip: ip, pl: pl };
  }

  function intToIpv4(x) {
    x = x >>> 0;
    return [(x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255].join(".");
  }

  function ipv4NetworkFromCidr(cidrStr) {
    var p = ipv4ParseCidr(cidrStr);
    if (!p) return null;
    var mask = p.pl === 0 ? 0 : (0xffffffff << (32 - p.pl)) >>> 0;
    var net = (p.ip & mask) >>> 0;
    return { net: net, pl: p.pl };
  }

  /** Supernet CIDR with prefix length *poolPl* strictly shorter than the assignment’s (larger aggregate). */
  function ipv4SupernetCidrForAssignment(assignmentCidr, poolPl) {
    var nw = ipv4NetworkFromCidr(assignmentCidr);
    if (!nw || poolPl < 0 || poolPl > 32) return null;
    if (poolPl >= nw.pl) return null;
    var mask = poolPl === 0 ? 0 : (0xffffffff << (32 - poolPl)) >>> 0;
    var superNet = (nw.net & mask) >>> 0;
    if ((nw.net & mask) >>> 0 !== superNet) return null;
    return intToIpv4(superNet) + "/" + poolPl;
  }

  function cidrLooksIpv6(s) {
    return /:/.test(String(s || "").split("/")[0] || "");
  }

  function showNewPoolInParentDropdown() {
    if (!fieldType) return false;
    var t = fieldType.value || "";
    if (t !== "assignment" && t !== "host") return false;
    if (cidrLooksIpv6(fieldCidr && fieldCidr.value)) return false;
    return true;
  }

  /** @returns {boolean|null} null = cannot verify (e.g. IPv6), let server validate */
  function cidrStrictInside(containerCidr, candidateCidr) {
    if (!containerCidr || !candidateCidr) return true;
    if (/:/.test(containerCidr) || /:/.test(candidateCidr)) return null;
    var P = ipv4ParseCidr(containerCidr);
    var C = ipv4ParseCidr(candidateCidr);
    if (!P || !C) return null;
    var pMask = P.pl === 0 ? 0 : (0xffffffff << (32 - P.pl)) >>> 0;
    var cMask = C.pl === 0 ? 0 : (0xffffffff << (32 - C.pl)) >>> 0;
    var pNet = (P.ip & pMask) >>> 0;
    var cNet = (C.ip & cMask) >>> 0;
    if (C.pl < P.pl) return false;
    if ((cNet & pMask) >>> 0 !== pNet) return false;
    if (C.pl === P.pl && cNet === pNet) return false;
    return true;
  }

  function poolById(pid) {
    var list = (ipamFormMeta && ipamFormMeta.pools) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === pid) return list[i];
    }
    return null;
  }

  function poolMetaByCidr(cidr) {
    if (!cidr) return null;
    var pools = (ipamFormMeta && ipamFormMeta.pools) || [];
    var i;
    for (i = 0; i < pools.length; i++) {
      if (pools[i].cidr === cidr) return pools[i];
    }
    return null;
  }

  function assignmentById(aid) {
    var list = (ipamFormMeta && ipamFormMeta.assignments) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === aid) return list[i];
    }
    return null;
  }

  /** Prefix length from CIDR string; -1 if missing (IPv4/IPv6). */
  function cidrPrefixLength(cidr) {
    var parts = String(cidr || "").split("/");
    if (parts.length < 2) return -1;
    var pl = parseInt(parts[parts.length - 1], 10);
    return isNaN(pl) ? -1 : pl;
  }

  /** Smallest containing pool in *vk* that strictly contains *childCidr* (matches server find_most_specific_containing_pool). */
  function findMostSpecificContainingPoolMeta(childCidr, vk, excludeId) {
    var child = (childCidr || "").trim();
    if (!child || !vk) return null;
    var pools = (ipamFormMeta && ipamFormMeta.pools) || [];
    var best = null;
    var bestPl = -1;
    var i;
    for (i = 0; i < pools.length; i++) {
      var p = pools[i];
      if (p.vrf_key !== vk) continue;
      if (excludeId != null && String(p.id) === String(excludeId)) continue;
      var inside = cidrStrictInside(p.cidr, child);
      if (inside !== true) continue;
      var pl = cidrPrefixLength(p.cidr);
      if (pl > bestPl) {
        bestPl = pl;
        best = p;
      }
    }
    return best;
  }

  function fillPoolParentReadonlyFromRow(row) {
    if (!parentPoolReadonlyEl) return;
    if (!row || row.parent_pool_id == null) {
      parentPoolReadonlyEl.textContent = "None (root pool for this prefix in this VRF)";
      return;
    }
    var p = poolById(row.parent_pool_id);
    if (p) {
      var lab = (p.name || "").trim();
      parentPoolReadonlyEl.textContent = (lab ? lab + " — " : "") + p.cidr;
    } else {
      parentPoolReadonlyEl.textContent = "Pool #" + row.parent_pool_id;
    }
  }

  function syncPoolParentReadonly() {
    if (!parentPoolReadonlyEl || !fieldType || fieldType.value !== "pool") return;
    var cid = ((fieldCidr && fieldCidr.value) || "").trim();
    var vk = selectedVrfKeyFromFlyout();
    if (!cid || !vk) {
      parentPoolReadonlyEl.textContent = "Enter prefix and VRF to see parent.";
      return;
    }
    var best = findMostSpecificContainingPoolMeta(cid, vk, editId);
    if (best) {
      var lab = (best.name || "").trim();
      parentPoolReadonlyEl.textContent = (lab ? lab + " — " : "") + best.cidr;
    } else {
      parentPoolReadonlyEl.textContent = "None (root pool for this prefix in this VRF)";
    }
  }

  function selectedVrfKeyFromFlyout() {
    return vrfKey(fieldVrf && fieldVrf.value);
  }

  function effectiveVrfLabelForRow(row) {
    if (!row) return "";
    var v = (row.vrf || "").trim();
    return v ? v : "default";
  }

  /** @param {string} preserveVrfLabel - label to select after rebuild (e.g. from saved row, or "" for add). */
  function rebuildVrfSelect(preserveVrfLabel) {
    if (!fieldVrf) return;
    var preserve = (preserveVrfLabel || "").trim();
    var names = (ipamFormMeta && ipamFormMeta.vrf_names) || [];
    fieldVrf.innerHTML = "";
    if (names.length === 0) {
      var o0 = document.createElement("option");
      o0.value = "default";
      o0.textContent = "default";
      fieldVrf.appendChild(o0);
      fieldVrf.value = "default";
      return;
    }
    var multi = names.length > 1;
    if (multi) {
      var ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "Select VRF…";
      ph.disabled = true;
      ph.selected = !preserve;
      fieldVrf.appendChild(ph);
    }
    var i;
    for (i = 0; i < names.length; i++) {
      var nm = String(names[i]);
      var o = document.createElement("option");
      o.value = nm;
      o.textContent = nm;
      fieldVrf.appendChild(o);
    }
    if (names.length === 1) {
      fieldVrf.value = String(names[0]);
      return;
    }
    if (preserve && optionValueExists(fieldVrf, preserve)) {
      fieldVrf.value = preserve;
    }
  }

  function optionValueExists(selectEl, val) {
    if (!selectEl) return false;
    var i;
    for (i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value === val) return true;
    }
    return false;
  }

  function usesAssignmentAutoCidr() {
    if (editId != null) return false;
    if (!fieldType || fieldType.value !== "assignment") return false;
    if (discoveredPrefillSource) return false;
    if (!fieldParentPool) return false;
    var v = fieldParentPool.value;
    if (!v || v === NEW_POOL_VALUE) return false;
    var pid = parseInt(v, 10);
    if (isNaN(pid) || pid <= 0) return false;
    var pool = poolById(pid);
    if (!pool || !pool.cidr) return false;
    return !cidrLooksIpv6(pool.cidr);
  }

  function defaultAssignmentPrefixLen(poolPl) {
    var minChild = poolPl + 1;
    if (minChild > 32) return 32;
    if (minChild >= 24) return minChild;
    return 24;
  }

  function rebuildAssignmentPrefixLenOptions() {
    if (!fieldAssignmentPl || !fieldParentPool) return;
    var v = fieldParentPool.value;
    var prev = fieldAssignmentPl.value;
    fieldAssignmentPl.innerHTML = "";
    if (!v || v === NEW_POOL_VALUE) return;
    var pid = parseInt(v, 10);
    if (isNaN(pid)) return;
    var pool = poolById(pid);
    if (!pool || !pool.cidr) return;
    var parsed = ipv4ParseCidr(pool.cidr);
    if (!parsed) return;
    var poolPl = parsed.pl;
    var start = poolPl + 1;
    if (start > 32) return;
    var pl;
    for (pl = start; pl <= 32; pl++) {
      var o = document.createElement("option");
      o.value = String(pl);
      o.textContent = "/" + pl;
      fieldAssignmentPl.appendChild(o);
    }
    var defPl = String(defaultAssignmentPrefixLen(poolPl));
    var prevN = parseInt(prev, 10);
    if (!isNaN(prevN) && prevN >= start && prevN <= 32) {
      fieldAssignmentPl.value = String(prevN);
    } else if (optionValueExists(fieldAssignmentPl, defPl)) {
      fieldAssignmentPl.value = defPl;
    } else {
      fieldAssignmentPl.value = String(start);
    }
  }

  var nextAssignmentCidrSeq = 0;
  function fetchNextAssignmentCidrFromApi() {
    if (!usesAssignmentAutoCidr() || !apiNextAssignment || !fieldParentPool || !fieldAssignmentPl) {
      return Promise.resolve();
    }
    var pid = parseInt(fieldParentPool.value, 10);
    var pl = parseInt(fieldAssignmentPl.value, 10);
    if (isNaN(pid) || isNaN(pl)) return Promise.resolve();
    var seq = ++nextAssignmentCidrSeq;
    var url =
      apiNextAssignment.replace(/\/?$/, "") +
      "?parent_pool_id=" +
      encodeURIComponent(String(pid)) +
      "&prefix_len=" +
      encodeURIComponent(String(pl));
    return fetch(url, { credentials: "same-origin" })
      .then(function (r) {
        return parseJsonSafe(r).then(function (j) {
          return { ok: r.ok, status: r.status, body: j, seq: seq };
        });
      })
      .then(function (res) {
        if (res.seq !== nextAssignmentCidrSeq) return;
        if (!fieldCidr) return;
        if (!res.ok) {
          var det = res.body && res.body.detail;
          setFormStatus(typeof det === "string" ? det : "Could not allocate a prefix.", true);
          fieldCidr.value = "";
          return;
        }
        var c = res.body && res.body.cidr;
        if (c) fieldCidr.value = c;
        setFormStatus("", false);
      })
      .catch(function () {
        if (seq !== nextAssignmentCidrSeq) return;
        setFormStatus("Could not allocate a prefix.", true);
        if (fieldCidr) fieldCidr.value = "";
      });
  }

  function syncAssignmentCidrUi() {
    if (!wrapAssignmentSize || !fieldCidr || !labelCidr) return;
    var auto = usesAssignmentAutoCidr();
    wrapAssignmentSize.hidden = !auto;
    if (auto) {
      rebuildAssignmentPrefixLenOptions();
      labelCidr.innerHTML =
        'Allocated prefix <span class="gc-if-flyout__req" aria-hidden="true">*</span>';
      fieldCidr.setAttribute("readonly", "readonly");
      fieldCidr.classList.add("gc-if-flyout__input--readonly");
      fieldCidr.setAttribute("aria-readonly", "true");
      fetchNextAssignmentCidrFromApi();
    } else {
      var wasAuto = fieldCidr.classList.contains("gc-if-flyout__input--readonly");
      labelCidr.innerHTML =
        'Prefix (CIDR) <span class="gc-if-flyout__req" aria-hidden="true">*</span>';
      fieldCidr.removeAttribute("readonly");
      fieldCidr.classList.remove("gc-if-flyout__input--readonly");
      fieldCidr.removeAttribute("aria-readonly");
      if (wasAuto && fieldType && fieldType.value === "assignment" && editId == null) {
        fieldCidr.value = "";
      }
    }
  }

  function rebuildParentPoolSelect(preserveValue) {
    if (!fieldParentPool) return;
    var prev = preserveValue ? fieldParentPool.value : "";
    fieldParentPool.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— Select pool —";
    fieldParentPool.appendChild(opt0);
    var vk = selectedVrfKeyFromFlyout();
    var pools = (ipamFormMeta && ipamFormMeta.pools) || [];
    for (var i = 0; i < pools.length; i++) {
      var p = pools[i];
      if (p.vrf_key !== vk) continue;
      var o = document.createElement("option");
      o.value = String(p.id);
      var label = (p.name || "").trim();
      o.textContent = (label ? label + " — " : "") + p.cidr;
      fieldParentPool.appendChild(o);
    }
    if (showNewPoolInParentDropdown()) {
      var optNew = document.createElement("option");
      optNew.value = NEW_POOL_VALUE;
      optNew.textContent = "New pool…";
      fieldParentPool.appendChild(optNew);
    }
    if (prev && optionValueExists(fieldParentPool, prev)) {
      fieldParentPool.value = prev;
    } else {
      fieldParentPool.value = "";
    }
    if (fieldParentPool.value === NEW_POOL_VALUE) {
      syncNestedPoolIfOpenFromNewPoolChoice();
    }
  }

  function rebuildParentAssignmentSelect(preserveValue) {
    if (!fieldParentAssignment) return;
    var prev = preserveValue ? fieldParentAssignment.value : "";
    fieldParentAssignment.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— Select assignment —";
    fieldParentAssignment.appendChild(opt0);
    var vk = selectedVrfKeyFromFlyout();
    var asg = (ipamFormMeta && ipamFormMeta.assignments) || [];
    var poolSel = fieldParentPool && fieldParentPool.value ? parseInt(fieldParentPool.value, 10) : NaN;
    for (var i = 0; i < asg.length; i++) {
      var a = asg[i];
      if (a.vrf_key !== vk) continue;
      if (!isNaN(poolSel) && a.parent_pool_id !== poolSel) continue;
      var o = document.createElement("option");
      o.value = String(a.id);
      var lab = (a.name || "").trim();
      o.textContent = (lab ? lab + " — " : "") + a.cidr;
      fieldParentAssignment.appendChild(o);
    }
    if (prev && optionValueExists(fieldParentAssignment, prev)) fieldParentAssignment.value = prev;
  }

  function poolUnmanagedSwitchIsOn() {
    return !!(fieldPoolUnmanagedSwitch && fieldPoolUnmanagedSwitch.classList.contains("gc-table-toggle--on"));
  }

  function setPoolUnmanagedSwitch(on) {
    if (!fieldPoolUnmanagedSwitch) return;
    var v = !!on;
    fieldPoolUnmanagedSwitch.classList.toggle("gc-table-toggle--on", v);
    fieldPoolUnmanagedSwitch.setAttribute("aria-checked", v ? "true" : "false");
  }

  function syncPoolUnmanagedWrap() {
    if (!fieldPoolUnmanagedWrap || !fieldType) return;
    var isPool = fieldType.value === "pool";
    fieldPoolUnmanagedWrap.hidden = !isPool;
    fieldPoolUnmanagedWrap.setAttribute("aria-hidden", isPool ? "false" : "true");
  }

  function syncHierarchyFlyout() {
    if (!fieldType) return;
    var t = fieldType.value || "assignment";
    if (t === "pool") {
      if (wrapParentPool) wrapParentPool.hidden = false;
      if (parentPoolSelectBlock) parentPoolSelectBlock.hidden = true;
      if (parentPoolReadonlyBlock) parentPoolReadonlyBlock.hidden = false;
      if (wrapParentAssignment) wrapParentAssignment.hidden = true;
      if (parentPoolReqStar) parentPoolReqStar.hidden = true;
      if (parentPoolHint) parentPoolHint.hidden = true;
      if (parentPoolHintPool) parentPoolHintPool.hidden = false;
      if (fieldParentPool) fieldParentPool.removeAttribute("required");
      if (fieldParentAssignment) {
        fieldParentAssignment.removeAttribute("required");
        fieldParentAssignment.value = "";
      }
      syncPoolUnmanagedWrap();
      syncPoolParentReadonly();
      return;
    }
    if (t === "assignment") {
      if (wrapParentPool) wrapParentPool.hidden = false;
      if (parentPoolSelectBlock) parentPoolSelectBlock.hidden = false;
      if (parentPoolReadonlyBlock) parentPoolReadonlyBlock.hidden = true;
      if (wrapParentAssignment) wrapParentAssignment.hidden = true;
      if (parentPoolReqStar) parentPoolReqStar.hidden = false;
      if (parentPoolHint) parentPoolHint.hidden = true;
      if (parentPoolHintPool) parentPoolHintPool.hidden = true;
      if (fieldParentPool) fieldParentPool.setAttribute("required", "required");
      if (fieldParentAssignment) {
        fieldParentAssignment.removeAttribute("required");
        fieldParentAssignment.value = "";
      }
      syncPoolUnmanagedWrap();
      return;
    }
    if (t === "host") {
      if (wrapParentPool) wrapParentPool.hidden = false;
      if (parentPoolSelectBlock) parentPoolSelectBlock.hidden = false;
      if (parentPoolReadonlyBlock) parentPoolReadonlyBlock.hidden = true;
      if (wrapParentAssignment) wrapParentAssignment.hidden = false;
      if (parentPoolReqStar) parentPoolReqStar.hidden = true;
      if (parentPoolHint) parentPoolHint.hidden = false;
      if (parentPoolHintPool) parentPoolHintPool.hidden = true;
      if (fieldParentPool) fieldParentPool.removeAttribute("required");
      if (fieldParentAssignment) fieldParentAssignment.setAttribute("required", "required");
    }
    syncPoolUnmanagedWrap();
  }

  function hydrateIpamFlyoutHierarchyFromRow(row) {
    rebuildVrfSelect(row ? effectiveVrfLabelForRow(row) : "");
    syncHierarchyFlyout();
    if (fieldType && fieldType.value === "pool") {
      fillPoolParentReadonlyFromRow(row);
    } else {
      rebuildParentPoolSelect(false);
      if (fieldParentPool && row && row.parent_pool_id != null) {
        var ps = String(row.parent_pool_id);
        if (optionValueExists(fieldParentPool, ps)) fieldParentPool.value = ps;
      }
      rebuildParentAssignmentSelect(false);
      if (fieldParentAssignment && row && row.parent_assignment_id != null) {
        var as = String(row.parent_assignment_id);
        if (optionValueExists(fieldParentAssignment, as)) fieldParentAssignment.value = as;
      }
    }
    syncAssignmentCidrUi();
  }

  function hydrateIpamFlyoutHierarchyEmpty() {
    rebuildVrfSelect("");
    rebuildParentPoolSelect(false);
    rebuildParentAssignmentSelect(false);
    syncHierarchyFlyout();
    if (fieldType && fieldType.value === "pool") {
      syncPoolParentReadonly();
    }
  }

  function validateHierarchyBeforeSubmit(ptype, cidrTrimmed) {
    if (ptype === "pool") return "";
    if (ptype === "assignment") {
      if (!fieldParentPool || !fieldParentPool.value) return "Select a parent pool for this assignment.";
      if (fieldParentPool.value === NEW_POOL_VALUE) {
        return "Finish creating a new pool or choose an existing pool.";
      }
      var pid = parseInt(fieldParentPool.value, 10);
      var pool = poolById(pid);
      if (!pool) return "Invalid parent pool.";
      var inside = cidrStrictInside(pool.cidr, cidrTrimmed);
      if (inside === false) {
        return "Prefix must be a strict subnet of the parent pool (" + pool.cidr + ").";
      }
      return "";
    }
    if (ptype === "host") {
      if (fieldParentPool && fieldParentPool.value === NEW_POOL_VALUE) {
        return "Finish creating a new pool or choose an existing pool.";
      }
      if (!fieldParentAssignment || !fieldParentAssignment.value) {
        return "Select a parent assignment for this host.";
      }
      var aid = parseInt(fieldParentAssignment.value, 10);
      var asn = assignmentById(aid);
      if (!asn) return "Invalid parent assignment.";
      var inside = cidrStrictInside(asn.cidr, cidrTrimmed);
      if (inside === false) {
        return "Host prefix must be a strict subnet of the parent assignment (" + asn.cidr + ").";
      }
      if (fieldParentPool && fieldParentPool.value) {
        var hpp = parseInt(fieldParentPool.value, 10);
        var poolH = poolById(hpp);
        if (poolH) {
          var inPool = cidrStrictInside(poolH.cidr, cidrTrimmed);
          if (inPool === false) {
            return "Prefix must fall inside the selected parent pool (" + poolH.cidr + ").";
          }
        }
      }
      return "";
    }
    return "";
  }

  function displayName(row) {
    var n = (row && row.name) || "";
    n = n.trim();
    if (!n) return row.cidr;
    if (/^discovered\s*[·.]\s*/i.test(n)) return row.cidr || n;
    return n;
  }

  function manualSearchHaystack(r) {
    return [
      r.name,
      r.cidr,
      String(r.family),
      r.prefix_type || "",
      r.vrf || "",
      r.description || "",
      r.assigned_to_display || "",
      r.assigned_to_custom || "",
    ]
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function manualFacetMap(r) {
    var vrfDisp = (r.vrf || "").trim() || "default";
    var asn =
      (r.prefix_type || "") === "assignment" && r.assigned_to_display
        ? r.assigned_to_display
        : "—";
    return {
      name: (displayName(r) || "").trim(),
      cidr: r.cidr || "",
      family: r.family === 6 ? "IPv6" : "IPv4",
      type: (r.prefix_type || "").trim(),
      assigned: asn,
      vrf: vrfDisp,
      size: String(r.size_label || "—"),
      description: ((r.description || "").trim() || "—"),
      origin: "Manual",
      discovered: "No",
      conflict: r.vrf_assignment_conflict ? "Yes" : "No",
    };
  }

  function discSearchHaystack(d) {
    return [
      d.display_name,
      d.cidr,
      String(d.family),
      "assignment",
      d.source_summary,
      d.firewall_label,
      "discovered",
    ]
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function discFacetMap(d) {
    return {
      name: (d.display_name || d.cidr || "").trim(),
      cidr: d.cidr || "",
      family: d.family === 6 ? "IPv6" : "IPv4",
      type: "assignment",
      assigned: "—",
      vrf: "—",
      size: String(d.size_label || "—"),
      description: ((d.source_summary || "").trim() || "—"),
      origin: "Discovered",
      discovered: "Yes",
      conflict: d.vrf_assignment_conflict ? "Yes" : "No",
    };
  }

  function fillFirewallDropdown(selectEl) {
    if (!selectEl) return;
    var json = typeof window.gcNavFirewallsJson !== "undefined" ? window.gcNavFirewallsJson : [];
    var list = Array.isArray(json) ? json.slice() : [];
    list.sort(function (a, b) {
      return String(a.label || "").localeCompare(String(b.label || ""), undefined, {
        sensitivity: "base",
      });
    });
    selectEl.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— None —";
    selectEl.appendChild(opt0);
    for (var i = 0; i < list.length; i++) {
      var fw = list[i];
      var o = document.createElement("option");
      o.value = String(fw.id);
      o.textContent = fw.label || String(fw.id);
      selectEl.appendChild(o);
    }
  }

  function syncAssignedWrap() {
    if (!assignedWrap || !fieldType) return;
    var on = fieldType.value === "assignment";
    assignedWrap.hidden = !on;
    assignedWrap.setAttribute("aria-hidden", on ? "false" : "true");
  }

  function assignedCellHtml(r) {
    if ((r.prefix_type || "") !== "assignment") return "—";
    var d = r.assigned_to_display;
    return d ? esc(d) : "—";
  }

  function conflictPill() {
    return (
      '<span class="gc-ipam-pill gc-ipam-pill--conflict" title="Overlapping assignment in the same VRF">Conflict</span>'
    );
  }

  function manualRowHtml(r) {
    var fv = vrfKey(r.vrf);
    var famNum = r.family === 6 ? 6 : 4;
    var famLabel = r.family === 6 ? "IPv6" : "IPv4";
    var vrfConflict = !!r.vrf_assignment_conflict;
    var rowExtra = vrfConflict ? " gc-ipam-row--vrf-conflict" : "";
    var srcCell = vrfConflict ? conflictPill() : "";
    return (
      '<tr class="gc-ipam-row gc-ipam-data-row' +
      rowExtra +
      '" data-ipam-id="' +
      esc(String(r.id)) +
      '" data-gc-vrf="' +
      esc(fv) +
      '" data-search="' +
      esc(manualSearchHaystack(r)) +
      '" tabindex="0" role="button">' +
      '<td data-gc-col="name">' +
      esc(displayName(r)) +
      "</td>" +
      '<td data-gc-col="cidr" data-sort-value="' +
      esc(r.cidr) +
      '"><code class="gc-ipam-cidr">' +
      esc(r.cidr) +
      "</code></td>" +
      '<td data-gc-col="family" data-sort-value="' +
      famNum +
      '">' +
      esc(famLabel) +
      "</td>" +
      '<td data-gc-col="type"><span class="gc-ipam-type gc-ipam-type--' +
      esc(r.prefix_type) +
      '">' +
      esc(r.prefix_type) +
      "</span>" +
      ((r.prefix_type || "") === "pool" && r.pool_unmanaged
        ? ' <span class="muted" title="Excluded from parent pickers, discovery, and conflict checks">unmanaged</span>'
        : "") +
      "</td>" +
      '<td data-gc-col="assigned">' +
      assignedCellHtml(r) +
      "</td>" +
      '<td data-gc-col="vrf">' +
      esc(r.vrf || "—") +
      "</td>" +
      '<td data-gc-col="size">' +
      esc(r.size_label || "—") +
      "</td>" +
      '<td data-gc-col="description">' +
      esc(r.description || "—") +
      "</td>" +
      '<td data-gc-col="origin" class="gc-ipam-discovered-cell gc-ipam-source-cell">' +
      srcCell +
      "</td></tr>"
    );
  }

  function discRowHtml(d) {
    var famNum = d.family === 6 ? 6 : 4;
    var famLabel = d.family === 6 ? "IPv6" : "IPv4";
    var vrfConflict = !!d.vrf_assignment_conflict;
    var rowExtra = vrfConflict ? " gc-ipam-row--vrf-conflict" : "";
    var srcCell =
      '<span class="gc-ipam-pill gc-ipam-pill--discovered">Discovered</span>' +
      (vrfConflict ? " " + conflictPill() : "");
    return (
      '<tr class="gc-ipam-row gc-ipam-row--discovered gc-ipam-data-row' +
      rowExtra +
      '" data-discovered-key="' +
      esc(d.key) +
      '" data-search="' +
      esc(discSearchHaystack(d)) +
      '" tabindex="0" role="button">' +
      '<td data-gc-col="name">' +
      esc(d.display_name || d.cidr) +
      "</td>" +
      '<td data-gc-col="cidr" data-sort-value="' +
      esc(d.cidr) +
      '"><code class="gc-ipam-cidr">' +
      esc(d.cidr) +
      "</code></td>" +
      '<td data-gc-col="family" data-sort-value="' +
      famNum +
      '">' +
      esc(famLabel) +
      "</td>" +
      '<td data-gc-col="type"><span class="gc-ipam-type gc-ipam-type--assignment">assignment</span></td>' +
      '<td data-gc-col="assigned">—</td>' +
      '<td data-gc-col="vrf">—</td>' +
      '<td data-gc-col="size">' +
      esc(d.size_label || "—") +
      "</td>" +
      '<td data-gc-col="description">' +
      esc(d.source_summary || "—") +
      "</td>" +
      '<td data-gc-col="origin" class="gc-ipam-discovered-cell gc-ipam-source-cell">' +
      srcCell +
      "</td></tr>"
    );
  }

  function mergedRows() {
    var m = [];
    var i;
    for (i = 0; i < cache.length; i++) {
      m.push({ kind: "manual", row: cache[i] });
    }
    for (i = 0; i < cacheDiscovered.length; i++) {
      m.push({ kind: "discovered", disc: cacheDiscovered[i] });
    }
    m.sort(function (a, b) {
      var ca = a.kind === "manual" ? a.row.cidr : a.disc.cidr;
      var cb = b.kind === "manual" ? b.row.cidr : b.disc.cidr;
      return ca.localeCompare(cb, undefined, { numeric: true });
    });
    return m;
  }

  function mergedRowsForView() {
    var all = mergedRows();
    if (!lockedPrefixType) return all;
    return all.filter(function (item) {
      if (item.kind === "manual") {
        var pt = (item.row.prefix_type || "").trim();
        return pt === lockedPrefixType;
      }
      return lockedPrefixType === "assignment";
    });
  }

  function emptyViewPlaceholderMessage() {
    if (lockedPrefixType === "pool") {
      return "No pools in the plan yet. Add a pool or switch to Assignments for discovered networks.";
    }
    if (lockedPrefixType === "assignment") {
      return "No assignments yet. Add one or sync firewalls to see discovered networks.";
    }
    if (lockedPrefixType === "host") {
      return "No hosts in the plan yet. Add a host under an assignment.";
    }
    return "No prefixes yet. Add one or sync firewalls to see discovered networks.";
  }

  function rebuildFacets(done) {
    if (!filtersDrawerEl || !window.gcTableFacets) {
      if (typeof done === "function") done();
      return;
    }
    var rowEls = tbody
      ? Array.prototype.slice.call(tbody.querySelectorAll("tr.gc-ipam-data-row"))
      : [];
    var maps = rowEls.map(function (tr) {
      try {
        var raw = tr.getAttribute("data-gc-row-facets");
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    });
    window.gcTableFacets.rebuild(filtersDrawerEl, facetCols, maps, FACET_STORAGE_KEY);
    if (typeof done === "function") done();
  }

  function rowMatchesSearch(tr, q) {
    if (!q) return true;
    var s = tr.getAttribute("data-search") || "";
    return s.indexOf(q) !== -1;
  }

  function rowMatchesFacets(tr) {
    if (!filtersDrawerEl || !window.gcTableFacets) return true;
    return window.gcTableFacets.rowMatches(tr, filtersDrawerEl);
  }

  function rowPassesQuickDiscovered(tr) {
    if (quickDiscoveredMode === "all") return true;
    var isDisc = tr.classList.contains("gc-ipam-row--discovered");
    if (quickDiscoveredMode === "manual") return !isDisc;
    if (quickDiscoveredMode === "discovered") return isDisc;
    return true;
  }

  function rowPassesQuickConflicts(tr) {
    if (!quickConflictOnly) return true;
    return tr.classList.contains("gc-ipam-row--vrf-conflict");
  }

  function syncQuickFilterButtons() {
    var nav = document.getElementById("gc-ipam-quick-nav");
    if (nav) {
      nav.querySelectorAll("[data-gc-ipam-quick]").forEach(function (btn) {
        var mode = btn.getAttribute("data-gc-ipam-quick") || "";
        btn.setAttribute("aria-pressed", mode === quickDiscoveredMode ? "true" : "false");
      });
    }
    var cbtn = document.getElementById("gc-ipam-quick-conflicts");
    if (cbtn) cbtn.setAttribute("aria-pressed", quickConflictOnly ? "true" : "false");
  }

  function applyRowFilter() {
    if (!tbody) return;
    var q = (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();
    var rows = tbody.querySelectorAll("tr.gc-ipam-data-row");
    var place = document.getElementById("gc-ipam-placeholder");
    var emptyFilter = document.getElementById("gc-ipam-filter-empty");
    var visible = 0;
    var totalData = rows.length;
    Array.prototype.forEach.call(rows, function (tr) {
      var ok =
        rowMatchesSearch(tr, q) &&
        rowMatchesFacets(tr) &&
        rowPassesQuickDiscovered(tr) &&
        rowPassesQuickConflicts(tr);
      tr.hidden = !ok;
      if (ok) visible++;
    });
    if (place) place.hidden = totalData > 0;
    if (emptyFilter) {
      emptyFilter.hidden = !(totalData > 0 && visible === 0);
      syncFilterEmptyColspan();
    }
    if (countEl) {
      if (totalData === 0) {
        countEl.textContent = "";
      } else if (visible === totalData) {
        countEl.textContent = visible === 1 ? "1 prefix" : visible + " prefixes";
      } else {
        countEl.textContent = "Showing " + visible + " of " + totalData + " prefixes";
      }
    }
    syncQuickFilterButtons();
  }

  function renderTable() {
    if (!tbody) return;
    var merged = mergedRowsForView();
    var totalFromApi = cache.length + cacheDiscovered.length;
    if (totalFromApi === 0) {
      tbody.innerHTML =
        '<tr id="gc-ipam-placeholder" class="gc-ipam-placeholder-row"><td class="muted" colspan="9">No prefixes yet. Add one or sync firewalls to see discovered networks.</td></tr>';
      if (filtersDrawerEl) filtersDrawerEl.innerHTML = "";
      updateFacetChrome();
      if (countEl) countEl.textContent = "";
      if (table && window.gcTableSort) window.gcTableSort.bindTable(table);
      syncFilterEmptyColspan();
      syncQuickFilterButtons();
      return;
    }
    if (merged.length === 0) {
      tbody.innerHTML =
        '<tr id="gc-ipam-placeholder" class="gc-ipam-placeholder-row"><td class="muted" colspan="9">' +
        esc(emptyViewPlaceholderMessage()) +
        "</td></tr>";
      if (filtersDrawerEl) filtersDrawerEl.innerHTML = "";
      updateFacetChrome();
      if (countEl) countEl.textContent = "";
      if (table && window.gcTableSort) window.gcTableSort.bindTable(table);
      syncFilterEmptyColspan();
      syncQuickFilterButtons();
      return;
    }
    var parts = [];
    var maps = [];
    var i;
    for (i = 0; i < merged.length; i++) {
      var item = merged[i];
      if (item.kind === "manual") {
        parts.push(manualRowHtml(item.row));
        maps.push(manualFacetMap(item.row));
      } else {
        parts.push(discRowHtml(item.disc));
        maps.push(discFacetMap(item.disc));
      }
    }
    parts.push(
      '<tr id="gc-ipam-filter-empty" class="gc-ipam-filter-empty-row" hidden><td class="muted" colspan="9">No prefixes match the current filters.</td></tr>'
    );
    tbody.innerHTML = parts.join("");
    var dataRows = tbody.querySelectorAll("tr.gc-ipam-data-row");
    for (i = 0; i < dataRows.length; i++) {
      if (window.gcTableFacets) window.gcTableFacets.setRowFacets(dataRows[i], maps[i]);
    }
    applyColVis(colVis);
    syncFilterEmptyColspan();
    rebuildFacets(function () {
      applyRowFilter();
      updateFacetChrome();
      if (table && window.gcTableSort) window.gcTableSort.bindTable(table);
    });
  }

  function renderStats(prefixes, discovered) {
    // Summary cards count saved plan rows only; discovered has its own stat.
    var total = prefixes.length;
    var v4 = 0;
    var v6 = 0;
    var pools = 0;
    var i;
    var p;
    for (i = 0; i < prefixes.length; i++) {
      p = prefixes[i];
      if (p.family === 6) v6++;
      else v4++;
      if (p.prefix_type === "pool") pools++;
    }
    var conflictN = 0;
    for (i = 0; i < prefixes.length; i++) {
      if (prefixes[i].vrf_assignment_conflict) conflictN++;
    }
    for (i = 0; i < discovered.length; i++) {
      if (discovered[i].vrf_assignment_conflict) conflictN++;
    }
    function set(id, v) {
      var el = document.getElementById(id);
      if (el) el.textContent = String(v);
    }
    set("gc-ipam-stat-total", total);
    set("gc-ipam-stat-v4", v4);
    set("gc-ipam-stat-v6", v6);
    set("gc-ipam-stat-pools", pools);
    set("gc-ipam-stat-discovered", discovered.length);
    set("gc-ipam-stat-conflicts", conflictN);
  }

  function applyFilters() {
    if (!isPrefixPage || !tbody) {
      return Promise.resolve();
    }
    setStatus("Loading…", false);
    return fetch(apiList, { credentials: "same-origin" })
      .then(function (r) {
        if (r.status === 401) throw new Error("Session expired—refresh and sign in again.");
        if (!r.ok) throw new Error("Failed to load prefixes (" + r.status + ").");
        return r.json();
      })
      .then(function (data) {
        cache = data.prefixes || [];
        cacheDiscovered = data.discovered || [];
        ipamFormMeta = data.ipam_form_meta || { vrf_names: [], pools: [], assignments: [] };
        renderStats(cache, cacheDiscovered);
        renderTable();
        setStatus("", false);
        if (flyout && !flyout.hidden) {
          if (editId != null) {
            var er = findRow(editId);
            if (er) rebuildVrfSelect(effectiveVrfLabelForRow(er));
          } else {
            rebuildVrfSelect("");
            var ns = (ipamFormMeta && ipamFormMeta.vrf_names) || [];
            if (ns.length === 1 && fieldVrf) fieldVrf.value = String(ns[0]);
          }
          syncAssignmentCidrUi();
        }
      })
      .catch(function (e) {
        setStatus(e.message || String(e), true);
        throw e;
      });
  }

  function findRow(id) {
    var n = Number(id);
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === n) return cache[i];
    }
    return null;
  }

  function findDiscovered(key) {
    for (var i = 0; i < cacheDiscovered.length; i++) {
      if (cacheDiscovered[i].key === key) return cacheDiscovered[i];
    }
    return null;
  }

  function syncIpamDeleteButton() {
    if (!deleteBtn) return;
    if (editId == null) {
      deleteBtn.hidden = true;
      deleteBtn.disabled = false;
      deleteBtn.removeAttribute("title");
      deleteBtn.removeAttribute("aria-label");
      return;
    }
    var row = findRow(editId);
    if (!row) {
      deleteBtn.hidden = true;
      return;
    }
    var pt = (fieldType && fieldType.value) || row.prefix_type || "";
    var show = !!row.delete_eligible && (pt === "pool" || pt === "assignment");
    deleteBtn.hidden = !show;
    if (!show) {
      deleteBtn.disabled = false;
      deleteBtn.removeAttribute("title");
      deleteBtn.removeAttribute("aria-label");
      return;
    }
    deleteBtn.disabled = !row.delete_allowed;
    var reason = row.delete_blocked_reason || "";
    if (reason) {
      deleteBtn.setAttribute("title", reason);
      deleteBtn.setAttribute("aria-label", "Delete — " + reason);
    } else {
      deleteBtn.removeAttribute("title");
      deleteBtn.setAttribute("aria-label", "Delete this prefix");
    }
  }

  function openFlyoutAdd() {
    unlockAssignedFirewallFields();
    editId = null;
    if (flyoutTitle) flyoutTitle.textContent = addTitleForLockedType();
    if (fieldId) fieldId.value = "";
    if (form) form.reset();
    fillFirewallDropdown(fieldAssignedFw);
    if (fieldAssignedFw) fieldAssignedFw.value = "";
    if (fieldAssignedCustom) fieldAssignedCustom.value = "";
    setPoolUnmanagedSwitch(false);
    setFormStatus("", false);
    setFlyoutPrefixType(lockedPrefixType);
    hydrateIpamFlyoutHierarchyEmpty();
    syncIpamDeleteButton();
    syncAssignmentCidrUi();
    showFlyout();
    if (fieldName) fieldName.focus();
  }

  function openFlyoutEdit(row) {
    unlockAssignedFirewallFields();
    editId = row.id;
    if (flyoutTitle) flyoutTitle.textContent = editTitleForPrefixType(row.prefix_type);
    if (fieldId) fieldId.value = String(row.id);
    if (fieldName) fieldName.value = row.name || "";
    if (fieldCidr) fieldCidr.value = row.cidr || "";
    setFlyoutPrefixType(row.prefix_type || "assignment");
    fillFirewallDropdown(fieldAssignedFw);
    if (fieldAssignedFw) {
      fieldAssignedFw.value =
        row.assigned_to_firewall_id != null ? String(row.assigned_to_firewall_id) : "";
    }
    if (fieldAssignedCustom) {
      fieldAssignedCustom.value = row.assigned_to_custom || "";
    }
    if (fieldDesc) fieldDesc.value = row.description || "";
    setPoolUnmanagedSwitch(!!row.pool_unmanaged);
    setFormStatus("", false);
    hydrateIpamFlyoutHierarchyFromRow(row);
    syncIpamDeleteButton();
    showFlyout();
    if (fieldName) fieldName.focus();
  }

  function showFlyout() {
    if (!flyout) return;
    syncIpamDeleteButton();
    flyout.hidden = false;
    flyout.setAttribute("aria-hidden", "false");
    if (flyoutPanel) flyoutPanel.focus();
  }

  function closeFlyout() {
    closeNestedPoolFlyout(true);
    if (!flyout) return;
    flyout.hidden = true;
    flyout.setAttribute("aria-hidden", "true");
    editId = null;
    unlockAssignedFirewallFields();
    syncIpamDeleteButton();
  }

  function showDiscFlyout() {
    if (!discFlyout) return;
    discFlyout.hidden = false;
    discFlyout.setAttribute("aria-hidden", "false");
    if (discFlyoutPanel) discFlyoutPanel.focus();
  }

  function closeDiscFlyout() {
    closePoolFlyout(true);
    if (!discFlyout) return;
    discFlyout.hidden = true;
    discFlyout.setAttribute("aria-hidden", "true");
    discCurrent = null;
  }

  function lockAssignedFirewallFromDiscovered() {
    if (!discoveredPrefillSource) return;
    if (fieldAssignedFw) {
      fieldAssignedFw.disabled = true;
      fieldAssignedFw.setAttribute("aria-disabled", "true");
    }
    if (fieldAssignedCustom) {
      fieldAssignedCustom.disabled = true;
      fieldAssignedCustom.setAttribute("aria-disabled", "true");
    }
    if (assignedFwLockedHint) assignedFwLockedHint.hidden = false;
  }

  function unlockAssignedFirewallFields() {
    discoveredPrefillSource = null;
    if (fieldAssignedFw) {
      fieldAssignedFw.disabled = false;
      fieldAssignedFw.removeAttribute("aria-disabled");
    }
    if (fieldAssignedCustom) {
      fieldAssignedCustom.disabled = false;
      fieldAssignedCustom.removeAttribute("aria-disabled");
    }
    if (assignedFwLockedHint) assignedFwLockedHint.hidden = true;
  }

  function setNestedPoolStatus(msg, isError) {
    if (!nestedPoolStatus) return;
    nestedPoolStatus.textContent = msg || "";
    nestedPoolStatus.classList.toggle("settings-form__status--error", !!isError);
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function layoutSubflyoutLeftOf(subPanel, primaryPanel, gap) {
    if (!subPanel || !primaryPanel) return;
    var w = primaryPanel.offsetWidth;
    var g = gap == null ? 10 : gap;
    subPanel.style.right = Math.max(0, w + g) + "px";
  }

  function layoutNestedPoolBesidePrimary() {
    layoutSubflyoutLeftOf(nestedPoolFlyoutPanel, flyoutPanel, 10);
  }

  function layoutPoolFlyoutBesideDisc() {
    layoutSubflyoutLeftOf(poolFlyoutPanel, discFlyoutPanel, 10);
  }

  var nestedPoolCloseAnimTimer = null;
  var poolFlyoutCloseAnimTimer = null;

  function finishNestedPoolFlyoutCleanup() {
    if (!nestedPoolFlyout) return;
    nestedPoolFlyout.hidden = true;
    nestedPoolFlyout.setAttribute("aria-hidden", "true");
    nestedPoolFlyout.classList.remove("gc-ipam-nested-pool-flyout--open");
    if (nestedPoolFlyoutPanel) nestedPoolFlyoutPanel.style.right = "";
    if (nestedPoolForm) nestedPoolForm.reset();
    setNestedPoolStatus("", false);
    setNestedPoolSubmitEnabled(true);
    if (fieldParentPool && fieldParentPool.value === NEW_POOL_VALUE) fieldParentPool.value = "";
  }

  function closeNestedPoolFlyout(immediate) {
    if (!nestedPoolFlyout) return;
    if (nestedPoolCloseAnimTimer) {
      window.clearTimeout(nestedPoolCloseAnimTimer);
      nestedPoolCloseAnimTimer = null;
    }
    nestedPoolFlyout.classList.remove("gc-ipam-nested-pool-flyout--open");
    if (immediate || prefersReducedMotion() || !nestedPoolFlyoutPanel || nestedPoolFlyout.hidden) {
      finishNestedPoolFlyoutCleanup();
      return;
    }
    nestedPoolCloseAnimTimer = window.setTimeout(function () {
      nestedPoolCloseAnimTimer = null;
      finishNestedPoolFlyoutCleanup();
    }, 300);
  }

  function showNestedPoolFlyout() {
    if (!nestedPoolFlyout) return;
    if (nestedPoolCloseAnimTimer) {
      window.clearTimeout(nestedPoolCloseAnimTimer);
      nestedPoolCloseAnimTimer = null;
    }
    layoutNestedPoolBesidePrimary();
    nestedPoolFlyout.hidden = false;
    nestedPoolFlyout.setAttribute("aria-hidden", "false");
    nestedPoolFlyout.classList.remove("gc-ipam-nested-pool-flyout--open");
    if (nestedPoolFlyoutPanel) {
      void nestedPoolFlyoutPanel.offsetWidth;
    }
    if (prefersReducedMotion()) {
      nestedPoolFlyout.classList.add("gc-ipam-nested-pool-flyout--open");
    } else {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          nestedPoolFlyout.classList.add("gc-ipam-nested-pool-flyout--open");
        });
      });
    }
    if (nestedPoolFlyoutPanel) nestedPoolFlyoutPanel.focus();
  }

  function updateNestedPoolPreview() {
    if (!nestedPoolPl || !nestedPoolResult || !fieldCidr) return;
    var assign = (fieldCidr.value || "").trim();
    var pl = parseInt(nestedPoolPl.value, 10);
    var cidr = ipv4SupernetCidrForAssignment(assign, pl);
    nestedPoolResult.textContent = cidr || "—";
  }

  function setNestedPoolSubmitEnabled(on) {
    if (!nestedPoolSubmitBtn) return;
    nestedPoolSubmitBtn.disabled = !on;
  }

  /** Sync nested “New pool” sheet from the primary add-prefix form; keep Parent pool on “New pool…”. */
  function syncNestedPoolFlyoutFromPrimary() {
    var assign = ((fieldCidr && fieldCidr.value) || "").trim();
    if (nestedPoolVrf) {
      var vk = selectedVrfKeyFromFlyout();
      nestedPoolVrf.textContent = vk === "default" ? "default (global)" : vk;
    }
    if (nestedPoolAssignCidr) nestedPoolAssignCidr.textContent = assign || "—";

    if (cidrLooksIpv6(assign)) {
      setNestedPoolStatus("New pool from size is only available for IPv4 prefixes.", true);
      if (nestedPoolPl) nestedPoolPl.innerHTML = "";
      if (nestedPoolResult) nestedPoolResult.textContent = "—";
      setNestedPoolSubmitEnabled(false);
      return;
    }
    var nw = ipv4NetworkFromCidr(assign);
    if (!nw) {
      setNestedPoolStatus(
        "Enter a valid IPv4 CIDR in the add-prefix form above (this sheet is for IPv4 only).",
        true
      );
      if (nestedPoolPl) nestedPoolPl.innerHTML = "";
      if (nestedPoolResult) nestedPoolResult.textContent = "—";
      setNestedPoolSubmitEnabled(false);
      return;
    }
    if (nw.pl < 1) {
      setNestedPoolStatus("The assignment prefix must be narrower than /0 to create a containing pool.", true);
      if (nestedPoolPl) nestedPoolPl.innerHTML = "";
      if (nestedPoolResult) nestedPoolResult.textContent = "—";
      setNestedPoolSubmitEnabled(false);
      return;
    }

    setNestedPoolStatus("", false);
    setNestedPoolSubmitEnabled(true);
    if (nestedPoolPl) {
      nestedPoolPl.innerHTML = "";
      var maxPl = nw.pl - 1;
      var pl;
      for (pl = maxPl; pl >= 0; pl--) {
        var o = document.createElement("option");
        o.value = String(pl);
        o.textContent = "/" + pl + " (aggregate)";
        nestedPoolPl.appendChild(o);
      }
      nestedPoolPl.value = String(maxPl);
    }
    if (nestedPoolName && !((nestedPoolName.value || "").trim())) {
      nestedPoolName.value = assign ? "Pool for " + assign : "";
    }
    updateNestedPoolPreview();
  }

  function openNestedPoolFlyoutFromPrimary() {
    setNestedPoolStatus("", false);
    showNestedPoolFlyout();
    syncNestedPoolFlyoutFromPrimary();
  }

  function finishPoolFlyoutCleanup() {
    if (!poolFlyout) return;
    poolFlyout.hidden = true;
    poolFlyout.setAttribute("aria-hidden", "true");
    poolFlyout.classList.remove("gc-ipam-pool-flyout--open");
    if (poolFlyoutPanel) poolFlyoutPanel.style.right = "";
    if (poolForm) poolForm.reset();
    setPoolStatus("", false);
  }

  function showPoolFlyout() {
    if (!poolFlyout) return;
    if (poolFlyoutCloseAnimTimer) {
      window.clearTimeout(poolFlyoutCloseAnimTimer);
      poolFlyoutCloseAnimTimer = null;
    }
    layoutPoolFlyoutBesideDisc();
    poolFlyout.hidden = false;
    poolFlyout.setAttribute("aria-hidden", "false");
    poolFlyout.classList.remove("gc-ipam-pool-flyout--open");
    if (poolFlyoutPanel) void poolFlyoutPanel.offsetWidth;
    if (prefersReducedMotion()) {
      poolFlyout.classList.add("gc-ipam-pool-flyout--open");
    } else {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          poolFlyout.classList.add("gc-ipam-pool-flyout--open");
        });
      });
    }
    if (poolFlyoutPanel) poolFlyoutPanel.focus();
  }

  function closePoolFlyout(immediate) {
    if (!poolFlyout) return;
    if (poolFlyoutCloseAnimTimer) {
      window.clearTimeout(poolFlyoutCloseAnimTimer);
      poolFlyoutCloseAnimTimer = null;
    }
    poolFlyout.classList.remove("gc-ipam-pool-flyout--open");
    if (immediate || prefersReducedMotion() || !poolFlyoutPanel || poolFlyout.hidden) {
      finishPoolFlyoutCleanup();
      return;
    }
    poolFlyoutCloseAnimTimer = window.setTimeout(function () {
      poolFlyoutCloseAnimTimer = null;
      finishPoolFlyoutCleanup();
    }, 300);
  }

  function openFlyoutFromDiscovered(d) {
    discoveredPrefillSource = d;
    discCurrent = d;
    editId = null;
    if (flyoutTitle) flyoutTitle.textContent = "Add assignment";
    if (fieldId) fieldId.value = "";
    if (form) form.reset();
    fillFirewallDropdown(fieldAssignedFw);
    var firstSrc = (d.source_summary || "").split(",")[0].trim();
    if (fieldName) fieldName.value = firstSrc || (d.cidr || "").trim() || "";
    if (fieldCidr) fieldCidr.value = d.cidr || "";
    var encCidr = d.encompassing_pool_cidr;
    if (fieldAssignedFw) {
      fieldAssignedFw.value = d.firewall_id != null ? String(d.firewall_id) : "";
    }
    if (fieldAssignedCustom) fieldAssignedCustom.value = "";
    if (fieldDesc) fieldDesc.value = (d.source_summary || "").trim() || "";
    lockAssignedFirewallFromDiscovered();
    setFormStatus("", false);
    var msgs = [];
    if (d.already_in_ipam) msgs.push("This prefix is already in the address plan.");
    if (d.overlap_conflict) {
      msgs.push(
        "Overlaps an existing assignment" +
          (d.overlap_with_cidr ? " (" + d.overlap_with_cidr + ")." : ".")
      );
    }
    if (d.vrf_assignment_conflict) {
      msgs.push("Overlaps another prefix in the same VRF (resolve the conflict before saving).");
    }
    if (msgs.length) setFormStatus(msgs.join(" "), true);
    rebuildVrfSelect("");
    rebuildParentPoolSelect(false);
    if (fieldParentPool && d.has_encompassing_pool && encCidr) {
      var pm2 = poolMetaByCidr(encCidr);
      if (pm2 && optionValueExists(fieldParentPool, String(pm2.id))) {
        fieldParentPool.value = String(pm2.id);
      }
    }
    rebuildParentAssignmentSelect(false);
    var vrfPick = "";
    if (d.has_encompassing_pool && encCidr) {
      var pmv = poolMetaByCidr(encCidr);
      if (pmv) vrfPick = String(pmv.vrf_key || "default");
    }
    if (vrfPick && fieldVrf && optionValueExists(fieldVrf, vrfPick)) {
      fieldVrf.value = vrfPick;
    } else {
      var ns0 = (ipamFormMeta && ipamFormMeta.vrf_names) || [];
      if (ns0.length === 1 && fieldVrf) fieldVrf.value = String(ns0[0]);
    }
    setFlyoutPrefixType("assignment");
    showFlyout();
    if (fieldName) fieldName.focus();
  }

  function parseJsonSafe(r) {
    return r.json().catch(function () {
      return {};
    });
  }

  function detailMessage(d) {
    if (typeof d === "string") return d;
    if (d && typeof d === "object" && !Array.isArray(d) && d.message) return String(d.message);
    if (Array.isArray(d)) {
      return d
        .map(function (x) {
          return x.msg || JSON.stringify(x);
        })
        .join(" ");
    }
    return "Request failed.";
  }

  function handleSaveError(res, body) {
    if (res.status === 401) throw new Error("Session expired—refresh and sign in again.");
    if (res.status === 409) {
      throw new Error(
        typeof body.detail === "string" ? body.detail : "Conflict saving prefix."
      );
    }
    var d = body.detail;
    var msg = typeof d === "string" ? d : detailMessage(d);
    throw new Error(msg || "Could not save prefix.");
  }

  function openPoolFlyoutForCurrent() {
    setPoolStatus("", false);
    if (poolForm) poolForm.reset();
    if (poolName && discCurrent && discCurrent.cidr) {
      poolName.value = "Pool for " + discCurrent.cidr;
    }
    showPoolFlyout();
    if (poolCidr) poolCidr.focus();
  }

  function postAccept(poolCidrOpt, poolNameOpt) {
    if (!discCurrent || !apiAccept) return;
    setDiscStatus("Saving…", false);
    setPoolStatus("", false);
    var body = {
      firewall_id: discCurrent.firewall_id,
      cidr: discCurrent.cidr,
      name: ((discName && discName.value) || "").trim(),
      assigned_to_firewall_id: null,
      assigned_to_custom: null,
      pool_cidr: poolCidrOpt && String(poolCidrOpt).trim() ? String(poolCidrOpt).trim() : null,
      pool_name: poolNameOpt && String(poolNameOpt).trim() ? String(poolNameOpt).trim() : null,
      description: ((discDesc && discDesc.value) || "").trim() || null,
    };
    if (!body.name) {
      setDiscStatus("Name is required.", true);
      return;
    }
    if (discAssignedFw && discAssignedFw.value) {
      var parsed = parseInt(discAssignedFw.value, 10);
      if (!isNaN(parsed) && parsed > 0) body.assigned_to_firewall_id = parsed;
    } else if (discAssignedCustom) {
      body.assigned_to_custom = (discAssignedCustom.value || "").trim() || null;
    }
    fetch(apiAccept, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return parseJsonSafe(r).then(function (j) {
          return { ok: r.ok, status: r.status, body: j };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          var det = res.body && res.body.detail;
          if (res.status === 400 && det && typeof det === "object" && det.code === "pool_required") {
            setDiscStatus(det.message || "Create a pool first.", false);
            openPoolFlyoutForCurrent();
            throw new Error("__pool_handled");
          }
          throw new Error(detailMessage(det) || "Accept failed.");
        }
        closeDiscFlyout();
        applyFilters();
      })
      .catch(function (e) {
        if (e && e.message === "__pool_handled") return;
        var msg = e && e.message ? e.message : String(e);
        if (poolFlyout && !poolFlyout.hidden) {
          setPoolStatus(msg, true);
        } else {
          setDiscStatus(msg, true);
        }
      });
  }

  function setFiltersAsideCollapsed(collapsed) {
    var aside = filtersAsideEl;
    var drawer = filtersDrawerEl;
    var btn = document.getElementById(PREFIX + "-filters-toggle");
    if (!aside || !drawer || !btn) return;
    aside.classList.toggle("filters--collapsed", collapsed);
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (collapsed) drawer.setAttribute("hidden", "");
    else drawer.removeAttribute("hidden");
  }

  function filterColMenuList() {
    var q = (colsFilter && colsFilter.value ? colsFilter.value : "").trim().toLowerCase();
    if (!colsList) return;
    colsList.querySelectorAll("li[data-col-label]").forEach(function (li) {
      var lab = (li.dataset.colLabel || "").toLowerCase();
      li.hidden = q !== "" && lab.indexOf(q) === -1;
    });
  }

  function buildColMenuList() {
    if (!colsList) return;
    colsList.innerHTML = COLS.map(function (c) {
      return (
        '<li class="toolbar__cols-item" data-col-id="' +
        esc(c.id) +
        '" data-col-label="' +
        esc(c.label.toLowerCase()) +
        '">' +
        '<label class="toolbar__cols-label">' +
        "<input type=\"checkbox\" " +
        COL_CHECK_ATTR +
        '="' +
        esc(c.id) +
        '" ' +
        (colVis[c.id] ? "checked" : "") +
        " />" +
        "<span>" +
        esc(c.label) +
        "</span>" +
        "</label>" +
        "</li>"
      );
    }).join("");
    filterColMenuList();
  }

  function positionColsDropdown() {
    if (!colsTrigger || !colsPanel || !colsModal || colsModal.hidden) return;
    colsPanel.style.maxHeight = "";
    var r = colsTrigger.getBoundingClientRect();
    var gap = 6;
    var margin = 8;
    var pw = colsPanel.offsetWidth || Math.min(380, window.innerWidth - 2 * margin);
    var left = r.left;
    if (left + pw > window.innerWidth - margin) left = window.innerWidth - margin - pw;
    left = Math.max(margin, left);
    var topBelow = r.bottom + gap;
    colsPanel.style.left = left + "px";
    colsPanel.style.top = topBelow + "px";
    var after = colsPanel.getBoundingClientRect();
    if (after.bottom > window.innerHeight - margin) {
      var aboveTop = r.top - gap - after.height;
      if (aboveTop >= margin) colsPanel.style.top = aboveTop + "px";
      else {
        colsPanel.style.top = margin + "px";
        colsPanel.style.maxHeight = Math.max(120, window.innerHeight - 2 * margin) + "px";
      }
    }
  }

  function setColPanelOpen(open) {
    if (!colsModal || !colsTrigger) return;
    colsModal.hidden = !open;
    colsModal.setAttribute("aria-hidden", open ? "false" : "true");
    colsTrigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open && colsPanel) {
      colsPanel.style.top = "";
      colsPanel.style.left = "";
      colsPanel.style.maxHeight = "";
    }
    if (open) {
      requestAnimationFrame(function () {
        requestAnimationFrame(positionColsDropdown);
      });
    }
  }

  function openColsFromTrigger() {
    var willOpen = colsModal.hidden;
    setColPanelOpen(willOpen);
    if (willOpen) {
      buildColMenuList();
      if (colsFilter) colsFilter.focus();
    }
  }

  if (fieldPoolUnmanagedSwitch) {
    fieldPoolUnmanagedSwitch.addEventListener("click", function () {
      setPoolUnmanagedSwitch(!poolUnmanagedSwitchIsOn());
    });
  }

  function syncNestedPoolIfOpenFromNewPoolChoice() {
    if (
      !fieldParentPool ||
      fieldParentPool.value !== NEW_POOL_VALUE ||
      !nestedPoolFlyout ||
      nestedPoolFlyout.hidden
    ) {
      return;
    }
    syncNestedPoolFlyoutFromPrimary();
  }

  if (fieldVrf) {
    fieldVrf.addEventListener("input", function () {
      rebuildParentPoolSelect(false);
      rebuildParentAssignmentSelect(false);
      syncNestedPoolIfOpenFromNewPoolChoice();
      syncAssignmentCidrUi();
    });
    fieldVrf.addEventListener("change", function () {
      rebuildParentPoolSelect(false);
      rebuildParentAssignmentSelect(false);
      syncNestedPoolIfOpenFromNewPoolChoice();
      syncAssignmentCidrUi();
      if (fieldType && fieldType.value === "pool") syncPoolParentReadonly();
    });
  }

  if (fieldParentPool) {
    fieldParentPool.addEventListener("change", function () {
      if (fieldParentPool.value === NEW_POOL_VALUE) {
        syncAssignmentCidrUi();
        openNestedPoolFlyoutFromPrimary();
        return;
      }
      if (fieldType && fieldType.value === "host") rebuildParentAssignmentSelect(false);
      syncAssignmentCidrUi();
    });
  }

  if (fieldCidr) {
    fieldCidr.addEventListener("input", function () {
      if (usesAssignmentAutoCidr()) return;
      if (fieldType && (fieldType.value === "assignment" || fieldType.value === "host")) {
        rebuildParentPoolSelect(true);
      }
      if (fieldType && fieldType.value === "pool") syncPoolParentReadonly();
      syncNestedPoolIfOpenFromNewPoolChoice();
    });
  }

  if (fieldParentAssignment) {
    fieldParentAssignment.addEventListener("change", function () {
      if (!fieldType || fieldType.value !== "host") return;
      var raw = fieldParentAssignment.value;
      if (!raw || !fieldParentPool) return;
      var id = parseInt(raw, 10);
      if (isNaN(id)) return;
      var asg = assignmentById(id);
      if (!asg || asg.parent_pool_id == null) return;
      fieldParentPool.value = String(asg.parent_pool_id);
      rebuildParentAssignmentSelect(true);
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", function () {
      if (editId == null || deleteBtn.disabled) return;
      var row = findRow(editId);
      if (!row) return;
      var pt = row.prefix_type || "";
      var name = displayName(row);
      var cidr = row.cidr || "";
      var msg = 'Delete "' + name + '" (' + cidr + ")?";
      var cascade = Number(row.ipam_delete_cascade_count) || 0;
      if (pt === "pool" && cascade > 0) {
        msg +=
          "\n\nThis pool contains " +
          cascade +
          " other prefix(es) in the address plan (assignments, hosts, or nested pools). They will be deleted as well.";
      }
      if (!window.confirm(msg)) return;
      setFormStatus("Deleting…", false);
      var delUrl =
        apiList.replace(/\/?$/, "") + "/" + encodeURIComponent(String(editId));
      fetch(delUrl, { method: "DELETE", credentials: "same-origin" })
        .then(function (r) {
          return parseJsonSafe(r).then(function (j) {
            return { ok: r.ok, status: r.status, body: j };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            throw new Error(detailMessage(res.body.detail) || "Delete failed.");
          }
          closeFlyout();
          applyFilters();
        })
        .catch(function (e) {
          setFormStatus(e.message || String(e), true);
        });
    });
  }

  if (fieldAssignedFw) {
    fieldAssignedFw.addEventListener("change", function () {
      if (fieldAssignedFw.value && fieldAssignedCustom) fieldAssignedCustom.value = "";
    });
  }

  if (fieldAssignedCustom) {
    fieldAssignedCustom.addEventListener("input", function () {
      if ((fieldAssignedCustom.value || "").trim() && fieldAssignedFw) {
        fieldAssignedFw.value = "";
      }
    });
  }

  if (discAssignedFw) {
    discAssignedFw.addEventListener("change", function () {
      if (discAssignedFw.value && discAssignedCustom) discAssignedCustom.value = "";
    });
  }

  if (discAssignedCustom) {
    discAssignedCustom.addEventListener("input", function () {
      if ((discAssignedCustom.value || "").trim() && discAssignedFw) {
        discAssignedFw.value = "";
      }
    });
  }

  var filtersToggleBtn = document.getElementById(PREFIX + "-filters-toggle");
  if (filtersToggleBtn) {
    filtersToggleBtn.addEventListener("click", function () {
      var collapsed = filtersAsideEl && filtersAsideEl.classList.contains("filters--collapsed");
      setFiltersAsideCollapsed(!collapsed);
    });
  }

  if (facetResetBtn) {
    facetResetBtn.addEventListener("click", function () {
      if (filtersDrawerEl && window.gcTableFacets) {
        window.gcTableFacets.reset(filtersDrawerEl, FACET_STORAGE_KEY);
      }
      updateFacetChrome();
      applyRowFilter();
    });
  }

  if (filtersAsideEl && window.gcTableFacets) {
    window.gcTableFacets.bindAside(
      filtersAsideEl,
      function () {
        updateFacetChrome();
        applyRowFilter();
      },
      FACET_STORAGE_KEY
    );
  }

  if (searchInput) {
    if (window.gcTableFacets && window.gcTableFacets.bindToolbarSearch) {
      window.gcTableFacets.bindToolbarSearch(searchInput, FACET_STORAGE_KEY, applyRowFilter);
    } else {
      searchInput.addEventListener("input", applyRowFilter);
    }
  }

  var quickNav = document.getElementById("gc-ipam-quick-nav");
  if (quickNav) {
    quickNav.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-gc-ipam-quick]");
      if (!btn || !quickNav.contains(btn)) return;
      var mode = btn.getAttribute("data-gc-ipam-quick") || "";
      if (mode !== "all" && mode !== "manual" && mode !== "discovered") return;
      quickDiscoveredMode = mode;
      applyRowFilter();
    });
  }

  var quickConflictsBtn = document.getElementById("gc-ipam-quick-conflicts");
  if (quickConflictsBtn) {
    quickConflictsBtn.addEventListener("click", function () {
      quickConflictOnly = !quickConflictOnly;
      applyRowFilter();
    });
  }

  var acceptAllBtn = document.getElementById("gc-ipam-accept-all");
  if (acceptAllBtn && apiAcceptBatch) {
    acceptAllBtn.addEventListener("click", function () {
      if (
        !window.confirm(
          "Accept every discovered prefix that already sits in a pool, passes individual checks, and has no same-VRF conflict with another assignment?"
        )
      ) {
        return;
      }
      setStatus("Accepting…", false);
      fetch(apiAcceptBatch, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
        .then(function (r) {
          return parseJsonSafe(r).then(function (j) {
            return { ok: r.ok, status: r.status, body: j };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            throw new Error(detailMessage(res.body.detail) || "Batch accept failed.");
          }
          var n = res.body.accepted_count != null ? Number(res.body.accepted_count) : 0;
          var parts = [];
          parts.push(n === 1 ? "Accepted 1 assignment." : "Accepted " + n + " assignments.");
          var sk = res.body.skipped;
          if (Array.isArray(sk) && sk.length) {
            parts.push(sk.length + " skipped (see server log or retry individually).");
          }
          setStatus(parts.join(" "), false);
          applyFilters();
        })
        .catch(function (e) {
          setStatus(e.message || String(e), true);
        });
    });
  }

  if (colsTrigger) {
    colsTrigger.addEventListener("click", function (e) {
      e.stopPropagation();
      openColsFromTrigger();
    });
    colsTrigger.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openColsFromTrigger();
      }
    });
  }
  if (colsFilter) colsFilter.addEventListener("input", filterColMenuList);
  if (colsClose) {
    colsClose.addEventListener("click", function () {
      setColPanelOpen(false);
      if (colsTrigger) colsTrigger.focus();
    });
  }
  if (colsModal) {
    var bd = colsModal.querySelector(".fw-cols-modal__backdrop");
    if (bd) {
      bd.addEventListener("click", function () {
        setColPanelOpen(false);
        if (colsTrigger) colsTrigger.focus();
      });
    }
  }
  if (colsList) {
    colsList.addEventListener("change", function (e) {
      var cb = e.target.closest(colInputSel);
      if (!cb || cb.type !== "checkbox") return;
      var id = cb.getAttribute(COL_CHECK_ATTR);
      if (!id || !Object.prototype.hasOwnProperty.call(colVis, id)) return;
      colVis[id] = cb.checked;
      var nOn = 0;
      COLS.forEach(function (c) {
        if (colVis[c.id]) nOn++;
      });
      if (nOn < 1) {
        cb.checked = true;
        colVis[id] = true;
        return;
      }
      persistColVis(colVis);
      applyColVis(colVis);
      syncFilterEmptyColspan();
      applyRowFilter();
    });
  }

  document.addEventListener("mousedown", function (e) {
    if (!colsModal || colsModal.hidden) return;
    if ((colsTrigger && colsTrigger.contains(e.target)) || (colsPanel && colsPanel.contains(e.target))) return;
    setColPanelOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && colsModal && !colsModal.hidden) {
      setColPanelOpen(false);
      if (colsTrigger) colsTrigger.focus();
    }
  });
  window.addEventListener("resize", function () {
    if (colsModal && !colsModal.hidden) positionColsDropdown();
  });

  document.getElementById("gc-ipam-add-open") &&
    document.getElementById("gc-ipam-add-open").addEventListener("click", openFlyoutAdd);

  document.getElementById("gc-ipam-flyout-cancel") &&
    document.getElementById("gc-ipam-flyout-cancel").addEventListener("click", closeFlyout);

  if (flyoutBackdrop) {
    flyoutBackdrop.addEventListener("click", closeFlyout);
  }

  if (discFlyoutBackdrop) {
    discFlyoutBackdrop.addEventListener("click", closeDiscFlyout);
  }

  if (discCancelBtn) {
    discCancelBtn.addEventListener("click", closeDiscFlyout);
  }

  if (discAcceptBtn) {
    discAcceptBtn.addEventListener("click", function () {
      if (!discCurrent) return;
      if (!discCurrent.accept_allowed || discCurrent.vrf_assignment_conflict) return;
      if (!discCurrent.has_encompassing_pool) {
        openPoolFlyoutForCurrent();
        return;
      }
      postAccept(null, null);
    });
  }

  if (poolFlyoutBackdrop) {
    poolFlyoutBackdrop.addEventListener("click", closePoolFlyout);
  }

  if (poolCancelBtn) {
    poolCancelBtn.addEventListener("click", closePoolFlyout);
  }

  if (poolForm) {
    poolForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var pc = (poolCidr && poolCidr.value) || "";
      var pn = (poolName && poolName.value) || "";
      if (!pc.trim() || !pn.trim()) {
        setPoolStatus("Pool CIDR and name are required.", true);
        return;
      }
      setPoolStatus("Saving…", false);
      postAccept(pc.trim(), pn.trim());
    });
  }

  if (nestedPoolPl) {
    nestedPoolPl.addEventListener("change", updateNestedPoolPreview);
  }

  if (fieldAssignmentPl) {
    fieldAssignmentPl.addEventListener("change", function () {
      fetchNextAssignmentCidrFromApi();
    });
  }
  if (btnCidrRefresh) {
    btnCidrRefresh.addEventListener("click", function () {
      fetchNextAssignmentCidrFromApi();
    });
  }

  if (nestedPoolCancelBtn) {
    nestedPoolCancelBtn.addEventListener("click", function () {
      closeNestedPoolFlyout();
    });
  }

  if (nestedPoolFlyoutBackdrop) {
    nestedPoolFlyoutBackdrop.addEventListener("click", function () {
      closeNestedPoolFlyout();
    });
  }

  if (nestedPoolForm) {
    nestedPoolForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var assign = ((fieldCidr && fieldCidr.value) || "").trim();
      var pl = parseInt(nestedPoolPl && nestedPoolPl.value, 10);
      var name = ((nestedPoolName && nestedPoolName.value) || "").trim();
      var poolCidrStr = ipv4SupernetCidrForAssignment(assign, pl);
      var vrfRaw = ((fieldVrf && fieldVrf.value) || "").trim();
      if (!name) {
        setNestedPoolStatus("Pool name is required.", true);
        return;
      }
      if (!vrfRaw) {
        setNestedPoolStatus("Select a VRF on the main form first.", true);
        return;
      }
      if (!poolCidrStr) {
        setNestedPoolStatus("Choose a valid aggregate size for this prefix.", true);
        return;
      }
      setNestedPoolStatus("Saving…", false);
      fetch(apiCreate, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          cidr: poolCidrStr,
          vrf: vrfRaw,
          prefix_type: "pool",
          parent_pool_id: null,
          parent_assignment_id: null,
          assigned_to_firewall_id: null,
          assigned_to_custom: null,
          description: null,
        }),
      })
        .then(function (r) {
          return parseJsonSafe(r).then(function (j) {
            return { ok: r.ok, status: r.status, body: j };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            var det = res.body && res.body.detail;
            var msg =
              res.status === 409
                ? "That CIDR already exists in this VRF."
                : typeof det === "string"
                  ? det
                  : detailMessage(det) || "Could not create pool.";
            setNestedPoolStatus(msg, true);
            return;
          }
          var newId = res.body && res.body.id;
          closeNestedPoolFlyout();
          applyFilters()
            .then(function () {
              rebuildParentPoolSelect(false);
              if (fieldParentPool && newId != null && optionValueExists(fieldParentPool, String(newId))) {
                fieldParentPool.value = String(newId);
              }
              syncAssignmentCidrUi();
            })
            .catch(function () {});
        })
        .catch(function (e) {
          setNestedPoolStatus(e && e.message ? e.message : String(e), true);
        });
    });
  }

  function setVrfFlyoutStatus(msg, isError) {
    if (!vrfFlyoutStatus) return;
    vrfFlyoutStatus.textContent = msg || "";
    vrfFlyoutStatus.classList.toggle("settings-form__status--error", !!isError);
  }

  function showVrfFlyout() {
    if (!vrfFlyout) return;
    vrfFlyout.hidden = false;
    vrfFlyout.setAttribute("aria-hidden", "false");
    if (vrfFlyoutPanel) vrfFlyoutPanel.focus();
  }

  function closeVrfFlyout() {
    if (!vrfFlyout) return;
    vrfFlyout.hidden = true;
    vrfFlyout.setAttribute("aria-hidden", "true");
    if (vrfForm) vrfForm.reset();
    setVrfFlyoutStatus("", false);
  }

  function openVrfFlyoutAdd() {
    setVrfFlyoutStatus("", false);
    if (vrfForm) vrfForm.reset();
    showVrfFlyout();
    if (vrfFlyoutName) vrfFlyoutName.focus();
  }

  function renderVrfTable(rows) {
    if (!vrfTbody) return;
    var list = rows || [];
    if (!list.length) {
      vrfTbody.innerHTML =
        '<tr><td class="muted" colspan="3">No VRFs defined yet. Add one to use when creating prefixes.</td></tr>';
      if (vrfCountEl) vrfCountEl.textContent = "";
      return;
    }
    var i;
    var parts = [];
    for (i = 0; i < list.length; i++) {
      var r = list[i];
      parts.push(
        "<tr><td><code class=\"mono\">" +
          esc(r.name || "") +
          "</code></td><td>" +
          esc(r.description || "") +
          "</td><td>" +
          String(r.prefix_count != null ? r.prefix_count : 0) +
          "</td></tr>"
      );
    }
    vrfTbody.innerHTML = parts.join("");
    if (vrfCountEl) {
      vrfCountEl.textContent = list.length === 1 ? "1 VRF" : list.length + " VRFs";
    }
  }

  function loadVrfsTable() {
    if (!apiVrfs) return Promise.resolve();
    return fetch(apiVrfs, { credentials: "same-origin" })
      .then(function (r) {
        if (r.status === 401) throw new Error("Session expired—refresh and sign in again.");
        if (!r.ok) throw new Error("Failed to load VRFs (" + r.status + ").");
        return r.json();
      })
      .then(function (data) {
        renderVrfTable(data.vrfs || []);
      })
      .catch(function (e) {
        renderVrfTable([]);
        setStatus(e.message || String(e), true);
      });
  }

  if (vrfAddOpenBtn) {
    vrfAddOpenBtn.addEventListener("click", openVrfFlyoutAdd);
  }

  if (vrfFlyoutCancel) {
    vrfFlyoutCancel.addEventListener("click", closeVrfFlyout);
  }
  if (vrfFlyoutBackdrop) {
    vrfFlyoutBackdrop.addEventListener("click", closeVrfFlyout);
  }

  if (vrfForm) {
    vrfForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!apiVrfsCreate) {
        setVrfFlyoutStatus("VRF API URL is not configured.", true);
        return;
      }
      var nm = ((vrfFlyoutName && vrfFlyoutName.value) || "").trim();
      var ds = ((vrfFlyoutDesc && vrfFlyoutDesc.value) || "").trim();
      if (!nm) {
        setVrfFlyoutStatus("Name is required.", true);
        return;
      }
      setVrfFlyoutStatus("Saving…", false);
      fetch(apiVrfsCreate, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nm, description: ds || null }),
      })
        .then(function (r) {
          return parseJsonSafe(r).then(function (j) {
            return { ok: r.ok, status: r.status, body: j };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            var det = res.body && res.body.detail;
            var msg =
              res.status === 409
                ? typeof det === "string"
                  ? det
                  : "A VRF with this name already exists."
                : typeof det === "string"
                  ? det
                  : detailMessage(det) || "Could not create VRF.";
            setVrfFlyoutStatus(msg, true);
            return;
          }
          closeVrfFlyout();
          if (isPrefixPage) {
            applyFilters().catch(function () {});
          }
          loadVrfsTable();
        })
        .catch(function (e) {
          setVrfFlyoutStatus(e && e.message ? e.message : String(e), true);
        });
    });
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    if (nestedPoolFlyout && !nestedPoolFlyout.hidden) {
      closeNestedPoolFlyout();
      ev.stopPropagation();
      return;
    }
    if (poolFlyout && !poolFlyout.hidden) {
      closePoolFlyout();
      ev.stopPropagation();
      return;
    }
    if (discFlyout && !discFlyout.hidden) {
      closeDiscFlyout();
      ev.stopPropagation();
      return;
    }
    if (vrfFlyout && !vrfFlyout.hidden) {
      closeVrfFlyout();
      ev.stopPropagation();
      return;
    }
    if (!flyout || flyout.hidden) return;
    closeFlyout();
  });

  if (tbody) {
    tbody.addEventListener("click", function (ev) {
      var trD = ev.target.closest("tr[data-discovered-key]");
      if (trD && tbody.contains(trD) && trD.classList.contains("gc-ipam-data-row")) {
        var dk = trD.getAttribute("data-discovered-key");
        var dr = findDiscovered(dk);
        if (dr) openFlyoutFromDiscovered(dr);
        return;
      }
      var tr = ev.target.closest("tr[data-ipam-id]");
      if (!tr || !tbody.contains(tr) || !tr.classList.contains("gc-ipam-data-row")) return;
      var id = tr.getAttribute("data-ipam-id");
      var row = findRow(id);
      if (row) openFlyoutEdit(row);
    });
    tbody.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      var trD = ev.target.closest("tr[data-discovered-key]");
      if (trD && tbody.contains(trD) && trD.classList.contains("gc-ipam-data-row")) {
        ev.preventDefault();
        var dk = trD.getAttribute("data-discovered-key");
        var dr = findDiscovered(dk);
        if (dr) openFlyoutFromDiscovered(dr);
        return;
      }
      var tr = ev.target.closest("tr[data-ipam-id]");
      if (!tr || !tbody.contains(tr) || !tr.classList.contains("gc-ipam-data-row")) return;
      ev.preventDefault();
      var id = tr.getAttribute("data-ipam-id");
      var row = findRow(id);
      if (row) openFlyoutEdit(row);
    });
  }

  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      setFormStatus("Saving…", false);
      var name = (fieldName && fieldName.value) || "";
      var cidr = (fieldCidr && fieldCidr.value) || "";
      var cidrTrim = cidr.trim();
      var vrfRaw = ((fieldVrf && fieldVrf.value) || "").trim();
      if (!vrfRaw) {
        setFormStatus("Select a VRF.", true);
        return;
      }
      var ptype = (fieldType && fieldType.value) || "assignment";
      var hierErr = validateHierarchyBeforeSubmit(ptype, cidrTrim);
      if (hierErr) {
        setFormStatus(hierErr, true);
        return;
      }
      var parentPoolId = null;
      var parentAssignmentId = null;
      if (ptype === "assignment") {
        if (fieldParentPool && fieldParentPool.value) {
          var pp = parseInt(fieldParentPool.value, 10);
          if (!isNaN(pp)) parentPoolId = pp;
        }
      } else if (ptype === "host") {
        if (fieldParentPool && fieldParentPool.value) {
          var ppH = parseInt(fieldParentPool.value, 10);
          if (!isNaN(ppH)) parentPoolId = ppH;
        }
        if (fieldParentAssignment && fieldParentAssignment.value) {
          var pa = parseInt(fieldParentAssignment.value, 10);
          if (!isNaN(pa)) parentAssignmentId = pa;
        }
      }
      var fwVal = null;
      if (discoveredPrefillSource && discoveredPrefillSource.firewall_id != null) {
        var fdi = parseInt(discoveredPrefillSource.firewall_id, 10);
        if (!isNaN(fdi) && fdi > 0) fwVal = fdi;
      } else if (fieldAssignedFw && fieldAssignedFw.value) {
        var parsed2 = parseInt(fieldAssignedFw.value, 10);
        if (!isNaN(parsed2) && parsed2 > 0) fwVal = parsed2;
      }
      var customRaw = (fieldAssignedCustom && fieldAssignedCustom.value) || "";
      var body = {
        name: name.trim(),
        cidr: cidrTrim,
        vrf: vrfRaw,
        prefix_type: ptype,
        parent_pool_id: ptype === "pool" ? null : parentPoolId,
        parent_assignment_id: ptype === "host" ? parentAssignmentId : null,
        assigned_to_firewall_id: null,
        assigned_to_custom: null,
        description: ((fieldDesc && fieldDesc.value) || "").trim() || null,
        pool_unmanaged: ptype === "pool" ? poolUnmanagedSwitchIsOn() : false,
      };
      if (ptype === "assignment") {
        if (fwVal != null) {
          body.assigned_to_firewall_id = fwVal;
        } else {
          body.assigned_to_custom = customRaw.trim() || null;
        }
      }
      var url = apiCreate;
      var method = "POST";
      if (editId != null) {
        url = apiList.replace(/\/?$/, "") + "/" + encodeURIComponent(String(editId));
        method = "PUT";
      }
      fetch(url, {
        method: method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (r) {
          return parseJsonSafe(r).then(function (j) {
            return { ok: r.ok, status: r.status, body: j };
          });
        })
        .then(function (res) {
          if (!res.ok) handleSaveError(res, res.body);
          closeFlyout();
          applyFilters();
        })
        .catch(function (e) {
          setFormStatus(e.message || String(e), true);
        });
    });
  }

  window.addEventListener(
    "resize",
    function () {
      if (nestedPoolFlyout && !nestedPoolFlyout.hidden) layoutNestedPoolBesidePrimary();
      if (poolFlyout && !poolFlyout.hidden) layoutPoolFlyoutBesideDisc();
    },
    { passive: true }
  );

  applyColVis(colVis);
  syncFilterEmptyColspan();
  if (isPrefixPage) {
    fillFirewallDropdown(fieldAssignedFw);
    applyFilters();
  } else if (isVrfPage) {
    loadVrfsTable();
  }
})();
