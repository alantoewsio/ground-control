(function () {
  "use strict";

  let root = document.getElementById("gc-ipam-root");
  if (!root) return;

  let pageMode = (root.dataset.gcIpamPage || "").trim().toLowerCase();
  let lockedPrefixType = (root.dataset.gcIpamLockedType || "").trim().toLowerCase();

  let PREFIX = "gc-ipam";
  /** Parent pool dropdown: opens nested “new pool” sheet (IPv4 only). */
  let NEW_POOL_VALUE = "__gc_new_pool__";
  let FACET_STORAGE_KEY = "gc-ipam";
  let LS_COLS = "gc-ipam-cols-v2";
  let COL_CHECK_ATTR = "data-gc-ipam-col";
  let COLS = [{ id: "name", label: "Name" }];
  if (pageMode === "hosts") {
    COLS.push(
      { id: "lease_hostname", label: "Host name" },
      { id: "mac_address", label: "MAC" },
    );
  }
  COLS = COLS.concat([
    { id: "cidr", label: "Prefix" },
    { id: "family", label: "Family" },
    { id: "type", label: "Type" },
    { id: "assigned", label: "Assigned to" },
    { id: "vrf", label: "VRF" },
    { id: "size", label: "Size" },
    { id: "description", label: "Description" },
    { id: "origin", label: "Source" },
  ]);
  let colInputSel = "input[" + COL_CHECK_ATTR + "]";

  let facetCols = COLS.filter(function (c) {
    return c.id !== "origin";
  })
    .map(function (c) {
      let lab = c.label;
      if (typeof globalThis.gcTableColumnDisplayLabel === "function") {
        lab = globalThis.gcTableColumnDisplayLabel(lab);
      }
      return { id: c.id, label: lab };
    })
    .concat([
      {
        id: "discovered",
        label:
          typeof globalThis.gcTableColumnDisplayLabel === "function"
            ? globalThis.gcTableColumnDisplayLabel("Discovered")
            : "Discovered",
      },
      {
        id: "conflict",
        label:
          typeof globalThis.gcTableColumnDisplayLabel === "function"
            ? globalThis.gcTableColumnDisplayLabel("VRF conflict")
            : "VRF conflict",
      },
    ]);

  let apiList = root.dataset.apiPrefixes || "";
  let apiCreate = root.dataset.apiCreate || "";
  let apiAccept = root.dataset.apiAcceptDiscovered || "";
  let apiAcceptDhcpHost = root.dataset.apiAcceptDiscoveredDhcpHost || "";
  let apiAcceptBatch = root.dataset.apiAcceptDiscoveredBatch || "";
  let apiNextAssignment = root.dataset.apiNextAssignment || "";
  let apiVrfs = root.dataset.apiVrfs || "";
  let apiVrfsCreate = root.dataset.apiVrfsCreate || "";
  let isPrefixPage =
    pageMode === "pools" || pageMode === "assignments" || pageMode === "hosts";
  let isVrfPage = pageMode === "vrfs";
  let table = document.getElementById("gc-ipam-table");
  let tbody = document.getElementById("gc-ipam-tbody");
  let searchInput = document.getElementById("gc-ipam-search");
  let statusEl = document.getElementById("gc-ipam-status");
  let filtersDrawerEl = document.getElementById(PREFIX + "-filters-drawer");
  let filtersAsideEl = document.getElementById(PREFIX + "-filters-aside");
  let facetHeadActions = document.getElementById(PREFIX + "-facet-head-actions");
  let facetCountEl = document.getElementById(PREFIX + "-facet-count");
  let facetResetBtn = document.getElementById(PREFIX + "-facet-reset");
  let countEl = document.getElementById(PREFIX + "-count");
  let colsModal = document.getElementById(PREFIX + "-cols-modal");
  let colsTrigger = document.getElementById(PREFIX + "-cols-trigger");
  let colsPanel = document.getElementById(PREFIX + "-cols-panel");
  let colsFilter = document.getElementById(PREFIX + "-cols-filter");
  let colsList = document.getElementById(PREFIX + "-cols-list");
  let colsClose = document.getElementById(PREFIX + "-cols-close");

  let flyout = document.getElementById("gc-ipam-flyout");
  let flyoutPanel = flyout && flyout.querySelector(".gc-if-flyout__panel");
  let flyoutBackdrop = flyout && flyout.querySelector(".gc-if-flyout__backdrop");
  let flyoutTitle = document.getElementById("gc-ipam-flyout-title");
  let form = document.getElementById("gc-ipam-flyout-form");
  let fieldId = document.getElementById("gc-ipam-flyout-id");
  let fieldName = document.getElementById("gc-ipam-flyout-name");
  let wrapLeaseHostname = document.getElementById("gc-ipam-flyout-lease-hostname-wrap");
  let fieldLeaseHostname = document.getElementById("gc-ipam-flyout-lease-hostname");
  let wrapMac = document.getElementById("gc-ipam-flyout-mac-wrap");
  let fieldMac = document.getElementById("gc-ipam-flyout-mac");
  let fieldCidr = document.getElementById("gc-ipam-flyout-cidr");
  let wrapAssignmentSize = document.getElementById("gc-ipam-flyout-assignment-size-wrap");
  let fieldAssignmentPl = document.getElementById("gc-ipam-flyout-assignment-pl");
  let labelCidr = document.getElementById("gc-ipam-flyout-cidr-label");
  let btnCidrRefresh = document.getElementById("gc-ipam-flyout-cidr-refresh");
  let fieldVrf = document.getElementById("gc-ipam-flyout-vrf");
  let fieldType = document.getElementById("gc-ipam-flyout-type");
  let fieldTypeDisplay = document.getElementById("gc-ipam-flyout-type-display");
  let fieldPoolUnmanagedWrap = document.getElementById("gc-ipam-flyout-pool-unmanaged-wrap");
  let fieldPoolUnmanagedSwitch = document.getElementById("gc-ipam-flyout-pool-unmanaged-switch");
  let fieldAssignedFw = document.getElementById("gc-ipam-flyout-assigned-fw");
  let fieldAssignedCustom = document.getElementById("gc-ipam-flyout-assigned-custom");
  let assignedWrap = document.getElementById("gc-ipam-flyout-assigned-wrap");
  let fieldDesc = document.getElementById("gc-ipam-flyout-description");
  let fieldParentPool = document.getElementById("gc-ipam-flyout-parent-pool");
  let fieldParentAssignment = document.getElementById("gc-ipam-flyout-parent-assignment");
  let wrapParentPool = document.getElementById("gc-ipam-flyout-parent-pool-wrap");
  let wrapParentAssignment = document.getElementById("gc-ipam-flyout-parent-assignment-wrap");
  let parentPoolReqStar = document.getElementById("gc-ipam-flyout-parent-pool-req");
  let parentPoolHint = document.getElementById("gc-ipam-flyout-parent-pool-hint");
  let parentPoolHintPool = document.getElementById("gc-ipam-flyout-parent-pool-hint-pool");
  let parentPoolSelectBlock = document.getElementById("gc-ipam-flyout-parent-pool-select-block");
  let parentPoolReadonlyBlock = document.getElementById("gc-ipam-flyout-parent-pool-readonly-block");
  let parentPoolReadonlyEl = document.getElementById("gc-ipam-flyout-parent-pool-readonly");
  let formStatus = document.getElementById("gc-ipam-flyout-status");
  let deleteBtn = document.getElementById("gc-ipam-flyout-delete");

  let discFlyout = document.getElementById("gc-ipam-disc-flyout");
  let discFlyoutPanel = discFlyout && discFlyout.querySelector(".gc-if-flyout__panel");
  let discFlyoutBackdrop = discFlyout && discFlyout.querySelector(".gc-if-flyout__backdrop");
  let discTitle = document.getElementById("gc-ipam-disc-flyout-title");
  let discCidrEl = document.getElementById("gc-ipam-disc-flyout-cidr");
  let discFwEl = document.getElementById("gc-ipam-disc-flyout-fw");
  let discSourcesEl = document.getElementById("gc-ipam-disc-flyout-sources");
  let discName = document.getElementById("gc-ipam-disc-flyout-name");
  let discAssignedFw = document.getElementById("gc-ipam-disc-flyout-assigned-fw");
  let discAssignedCustom = document.getElementById("gc-ipam-disc-flyout-assigned-custom");
  let discDesc = document.getElementById("gc-ipam-disc-flyout-description");
  let discPoolLine = document.getElementById("gc-ipam-disc-flyout-pool-line");
  let discStatus = document.getElementById("gc-ipam-disc-flyout-status");
  let discAcceptBtn = document.getElementById("gc-ipam-disc-flyout-accept");
  let discCancelBtn = document.getElementById("gc-ipam-disc-flyout-cancel");

  let poolFlyout = document.getElementById("gc-ipam-pool-flyout");
  let poolFlyoutPanel = poolFlyout && poolFlyout.querySelector(".gc-if-flyout__panel");
  let poolFlyoutBackdrop = poolFlyout && poolFlyout.querySelector(".gc-if-flyout__backdrop");
  let poolForm = document.getElementById("gc-ipam-pool-flyout-form");
  let poolCidr = document.getElementById("gc-ipam-pool-flyout-cidr");
  let poolName = document.getElementById("gc-ipam-pool-flyout-name");
  let poolStatus = document.getElementById("gc-ipam-pool-flyout-status");
  let poolCancelBtn = document.getElementById("gc-ipam-pool-flyout-cancel");

  let nestedPoolFlyout = document.getElementById("gc-ipam-nested-pool-flyout");
  let nestedPoolFlyoutPanel = nestedPoolFlyout && nestedPoolFlyout.querySelector(".gc-if-flyout__panel");
  let nestedPoolFlyoutBackdrop = nestedPoolFlyout && nestedPoolFlyout.querySelector(".gc-if-flyout__backdrop");
  let nestedPoolForm = document.getElementById("gc-ipam-nested-pool-flyout-form");
  let nestedPoolPl = document.getElementById("gc-ipam-nested-pool-pl");
  let nestedPoolName = document.getElementById("gc-ipam-nested-pool-name");
  let nestedPoolResult = document.getElementById("gc-ipam-nested-pool-result");
  let nestedPoolVrf = document.getElementById("gc-ipam-nested-pool-vrf");
  let nestedPoolAssignCidr = document.getElementById("gc-ipam-nested-pool-assignment-cidr");
  let nestedPoolStatus = document.getElementById("gc-ipam-nested-pool-flyout-status");
  let nestedPoolCancelBtn = document.getElementById("gc-ipam-nested-pool-flyout-cancel");
  let nestedPoolSubmitBtn = document.getElementById("gc-ipam-nested-pool-flyout-submit");
  let assignedFwLockedHint = document.getElementById("gc-ipam-flyout-assigned-fw-locked-hint");

  let vrfTbody = document.getElementById("gc-ipam-vrf-tbody");
  let vrfCountEl = document.getElementById("gc-ipam-vrf-count");
  let vrfFlyout = document.getElementById("gc-ipam-vrf-flyout");
  let vrfFlyoutPanel = vrfFlyout && vrfFlyout.querySelector(".gc-if-flyout__panel");
  let vrfFlyoutBackdrop = vrfFlyout && vrfFlyout.querySelector(".gc-if-flyout__backdrop");
  let vrfForm = document.getElementById("gc-ipam-vrf-flyout-form");
  let vrfFlyoutName = document.getElementById("gc-ipam-vrf-flyout-name");
  let vrfFlyoutDesc = document.getElementById("gc-ipam-vrf-flyout-description");
  let vrfFlyoutStatus = document.getElementById("gc-ipam-vrf-flyout-status");
  let vrfFlyoutCancel = document.getElementById("gc-ipam-vrf-flyout-cancel");
  let vrfAddOpenBtn = document.getElementById("gc-ipam-vrf-add-open");

  let quickDiscoveredMode = "all";
  let quickConflictOnly = false;
  let editId = null;
  let cache = [];
  let cacheDiscovered = [];
  let cacheDiscoveredHosts = [];
  let discCurrent = null;
  /** When set, main add flyout was opened from a discovered row (firewall field locked). */
  let discoveredPrefillSource = null;
  let ipamFormMeta = { vrf_names: [], pools: [], assignments: [] };

  function prefixTypeLabel(ptype) {
    let p = (ptype || "").trim().toLowerCase();
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
    let p = (ptype || "").trim().toLowerCase();
    if (p === "pool") return "Edit pool";
    if (p === "assignment") return "Edit assignment";
    if (p === "host") return "Edit host";
    return "Edit prefix";
  }

  function syncHostOptionalFields() {
    let ptype = (fieldType && fieldType.value) || "";
    let show = (ptype || "").trim().toLowerCase() === "host";
    if (wrapLeaseHostname) wrapLeaseHostname.hidden = !show;
    if (wrapMac) wrapMac.hidden = !show;
  }

  /** Keep hidden prefix_type, readonly label, and dependent flyout sections in sync. */
  function setFlyoutPrefixType(ptypeRaw) {
    let ptype = (ptypeRaw || "").trim().toLowerCase();
    if (!ptype) ptype = lockedPrefixType || "assignment";
    if (fieldType) fieldType.value = ptype;
    if (fieldTypeDisplay) fieldTypeDisplay.textContent = prefixTypeLabel(ptype);
    syncHierarchyFlyout();
    syncPoolUnmanagedWrap();
    syncAssignedWrap();
    syncHostOptionalFields();
    syncIpamDeleteButton();
    syncAssignmentCidrUi();
  }

  function loadColVis() {
    let d = {};
    COLS.forEach(function (c) {
      d[c.id] = true;
    });
    try {
      let raw = localStorage.getItem(LS_COLS);
      if (raw) {
        let o = JSON.parse(raw);
        if (o && typeof o === "object") {
          COLS.forEach(function (c) {
            if (Object.prototype.hasOwnProperty.call(o, c.id)) d[c.id] = !!o[c.id];
          });
        }
      }
    } catch (e) {}
    let visible = 0;
    COLS.forEach(function (c) {
      if (d[c.id]) visible++;
    });
    if (visible < 1 && COLS.length) d[COLS[0].id] = true;
    return d;
  }

  let colVis = loadColVis();

  function persistColVis(vis) {
    try {
      localStorage.setItem(LS_COLS, JSON.stringify(vis));
    } catch (e) {}
  }

  function applyColVis(vis) {
    if (!table) return;
    COLS.forEach(function (c) {
      let on = !!vis[c.id];
      table.querySelectorAll('[data-gc-col="' + c.id + '"]').forEach(function (el) {
        el.classList.toggle("gc-col-hidden", !on);
      });
    });
  }

  function syncFilterEmptyColspan() {
    let n = table ? table.querySelectorAll("thead th").length : 9;
    let fe = document.getElementById("gc-ipam-filter-empty");
    if (fe) {
      let td = fe.querySelector("td");
      if (td) td.setAttribute("colspan", String(n));
    }
    let ph = document.getElementById("gc-ipam-placeholder");
    if (ph) {
      let ptd = ph.querySelector("td");
      if (ptd) ptd.setAttribute("colspan", String(n));
    }
  }

  function updateFacetChrome() {
    let n =
      filtersDrawerEl && globalThis.gcTableFacets
        ? globalThis.gcTableFacets.appliedCount(filtersDrawerEl)
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
    let t = (v || "").trim();
    return t ? t : "default";
  }

  function ipv4ParseCidr(s) {
    let m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(String(s || "").trim());
    if (!m) return null;
    let a = +m[1];
    let b = +m[2];
    let c = +m[3];
    let d = +m[4];
    let pl = +m[5];
    if (a > 255 || b > 255 || c > 255 || d > 255 || pl < 0 || pl > 32) return null;
    let ip = (((a << 24) | (b << 16) | (c << 8) | d) >>> 0);
    return { ip: ip, pl: pl };
  }

  function intToIpv4(x) {
    x = x >>> 0;
    return [(x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255].join(".");
  }

  function ipv4NetworkFromCidr(cidrStr) {
    let p = ipv4ParseCidr(cidrStr);
    if (!p) return null;
    let mask = p.pl === 0 ? 0 : (0xffffffff << (32 - p.pl)) >>> 0;
    let net = (p.ip & mask) >>> 0;
    return { net: net, pl: p.pl };
  }

  /** Supernet CIDR with prefix length *poolPl* strictly shorter than the assignment’s (larger aggregate). */
  function ipv4SupernetCidrForAssignment(assignmentCidr, poolPl) {
    let nw = ipv4NetworkFromCidr(assignmentCidr);
    if (!nw || poolPl < 0 || poolPl > 32) return null;
    if (poolPl >= nw.pl) return null;
    let mask = poolPl === 0 ? 0 : (0xffffffff << (32 - poolPl)) >>> 0;
    let superNet = (nw.net & mask) >>> 0;
    if ((nw.net & mask) >>> 0 !== superNet) return null;
    return intToIpv4(superNet) + "/" + poolPl;
  }

  function cidrLooksIpv6(s) {
    return /:/.test(String(s || "").split("/")[0] || "");
  }

  function showNewPoolInParentDropdown() {
    if (!fieldType) return false;
    let t = fieldType.value || "";
    if (t !== "assignment" && t !== "host") return false;
    if (cidrLooksIpv6(fieldCidr && fieldCidr.value)) return false;
    return true;
  }

  /** @returns {boolean|null} null = cannot verify (e.g. IPv6), let server validate */
  function cidrStrictInside(containerCidr, candidateCidr) {
    if (!containerCidr || !candidateCidr) return true;
    if (/:/.test(containerCidr) || /:/.test(candidateCidr)) return null;
    let P = ipv4ParseCidr(containerCidr);
    let C = ipv4ParseCidr(candidateCidr);
    if (!P || !C) return null;
    let pMask = P.pl === 0 ? 0 : (0xffffffff << (32 - P.pl)) >>> 0;
    let cMask = C.pl === 0 ? 0 : (0xffffffff << (32 - C.pl)) >>> 0;
    let pNet = (P.ip & pMask) >>> 0;
    let cNet = (C.ip & cMask) >>> 0;
    if (C.pl < P.pl) return false;
    if ((cNet & pMask) >>> 0 !== pNet) return false;
    if (C.pl === P.pl && cNet === pNet) return false;
    return true;
  }

  function poolById(pid) {
    let list = (ipamFormMeta && ipamFormMeta.pools) || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === pid) return list[i];
    }
    return null;
  }

  function poolMetaByCidr(cidr) {
    if (!cidr) return null;
    let pools = (ipamFormMeta && ipamFormMeta.pools) || [];
    let i;
    for (i = 0; i < pools.length; i++) {
      if (pools[i].cidr === cidr) return pools[i];
    }
    return null;
  }

  function assignmentById(aid) {
    let list = (ipamFormMeta && ipamFormMeta.assignments) || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === aid) return list[i];
    }
    return null;
  }

  /** Prefix length from CIDR string; -1 if missing (IPv4/IPv6). */
  function cidrPrefixLength(cidr) {
    let parts = String(cidr || "").split("/");
    if (parts.length < 2) return -1;
    let pl = parseInt(parts[parts.length - 1], 10);
    return isNaN(pl) ? -1 : pl;
  }

  /** Smallest containing pool in *vk* that strictly contains *childCidr* (matches server find_most_specific_containing_pool). */
  function findMostSpecificContainingPoolMeta(childCidr, vk, excludeId) {
    let child = (childCidr || "").trim();
    if (!child || !vk) return null;
    let pools = (ipamFormMeta && ipamFormMeta.pools) || [];
    let best = null;
    let bestPl = -1;
    let i;
    for (i = 0; i < pools.length; i++) {
      let p = pools[i];
      if (p.vrf_key !== vk) continue;
      if (excludeId != null && String(p.id) === String(excludeId)) continue;
      let inside = cidrStrictInside(p.cidr, child);
      if (inside !== true) continue;
      let pl = cidrPrefixLength(p.cidr);
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
    let p = poolById(row.parent_pool_id);
    if (p) {
      let lab = (p.name || "").trim();
      parentPoolReadonlyEl.textContent = (lab ? lab + " — " : "") + p.cidr;
    } else {
      parentPoolReadonlyEl.textContent = "Pool #" + row.parent_pool_id;
    }
  }

  function syncPoolParentReadonly() {
    if (!parentPoolReadonlyEl || !fieldType || fieldType.value !== "pool") return;
    let cid = ((fieldCidr && fieldCidr.value) || "").trim();
    let vk = selectedVrfKeyFromFlyout();
    if (!cid || !vk) {
      parentPoolReadonlyEl.textContent = "Enter prefix and VRF to see parent.";
      return;
    }
    let best = findMostSpecificContainingPoolMeta(cid, vk, editId);
    if (best) {
      let lab = (best.name || "").trim();
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
    let v = (row.vrf || "").trim();
    return v ? v : "default";
  }

  /** @param {string} preserveVrfLabel - label to select after rebuild (e.g. from saved row, or "" for add). */
  function rebuildVrfSelect(preserveVrfLabel) {
    if (!fieldVrf) return;
    let preserve = (preserveVrfLabel || "").trim();
    let names = (ipamFormMeta && ipamFormMeta.vrf_names) || [];
    fieldVrf.innerHTML = "";
    if (names.length === 0) {
      let o0 = document.createElement("option");
      o0.value = "default";
      o0.textContent = "default";
      fieldVrf.appendChild(o0);
      fieldVrf.value = "default";
      return;
    }
    let multi = names.length > 1;
    if (multi) {
      let ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "Select VRF…";
      ph.disabled = true;
      ph.selected = !preserve;
      fieldVrf.appendChild(ph);
    }
    let i;
    for (i = 0; i < names.length; i++) {
      let nm = String(names[i]);
      let o = document.createElement("option");
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
    let i;
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
    let v = fieldParentPool.value;
    if (!v || v === NEW_POOL_VALUE) return false;
    let pid = parseInt(v, 10);
    if (isNaN(pid) || pid <= 0) return false;
    let pool = poolById(pid);
    if (!pool || !pool.cidr) return false;
    return !cidrLooksIpv6(pool.cidr);
  }

  function defaultAssignmentPrefixLen(poolPl) {
    let minChild = poolPl + 1;
    if (minChild > 32) return 32;
    if (minChild >= 24) return minChild;
    return 24;
  }

  function rebuildAssignmentPrefixLenOptions() {
    if (!fieldAssignmentPl || !fieldParentPool) return;
    let v = fieldParentPool.value;
    let prev = fieldAssignmentPl.value;
    fieldAssignmentPl.innerHTML = "";
    if (!v || v === NEW_POOL_VALUE) return;
    let pid = parseInt(v, 10);
    if (isNaN(pid)) return;
    let pool = poolById(pid);
    if (!pool || !pool.cidr) return;
    let parsed = ipv4ParseCidr(pool.cidr);
    if (!parsed) return;
    let poolPl = parsed.pl;
    let start = poolPl + 1;
    if (start > 32) return;
    let pl;
    for (pl = start; pl <= 32; pl++) {
      let o = document.createElement("option");
      o.value = String(pl);
      o.textContent = "/" + pl;
      fieldAssignmentPl.appendChild(o);
    }
    let defPl = String(defaultAssignmentPrefixLen(poolPl));
    let prevN = parseInt(prev, 10);
    if (!isNaN(prevN) && prevN >= start && prevN <= 32) {
      fieldAssignmentPl.value = String(prevN);
    } else if (optionValueExists(fieldAssignmentPl, defPl)) {
      fieldAssignmentPl.value = defPl;
    } else {
      fieldAssignmentPl.value = String(start);
    }
  }

  let nextAssignmentCidrSeq = 0;
  function fetchNextAssignmentCidrFromApi() {
    if (!usesAssignmentAutoCidr() || !apiNextAssignment || !fieldParentPool || !fieldAssignmentPl) {
      return Promise.resolve();
    }
    let pid = parseInt(fieldParentPool.value, 10);
    let pl = parseInt(fieldAssignmentPl.value, 10);
    if (isNaN(pid) || isNaN(pl)) return Promise.resolve();
    let seq = ++nextAssignmentCidrSeq;
    let url =
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
          let det = res.body && res.body.detail;
          setFormStatus(typeof det === "string" ? det : "Could not allocate a prefix.", true);
          fieldCidr.value = "";
          return;
        }
        let c = res.body && res.body.cidr;
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
    let auto = usesAssignmentAutoCidr();
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
      let wasAuto = fieldCidr.classList.contains("gc-if-flyout__input--readonly");
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
    let prev = preserveValue ? fieldParentPool.value : "";
    fieldParentPool.innerHTML = "";
    let opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— Select pool —";
    fieldParentPool.appendChild(opt0);
    let vk = selectedVrfKeyFromFlyout();
    let pools = (ipamFormMeta && ipamFormMeta.pools) || [];
    for (let i = 0; i < pools.length; i++) {
      let p = pools[i];
      if (p.vrf_key !== vk) continue;
      let o = document.createElement("option");
      o.value = String(p.id);
      let label = (p.name || "").trim();
      o.textContent = (label ? label + " — " : "") + p.cidr;
      fieldParentPool.appendChild(o);
    }
    if (showNewPoolInParentDropdown()) {
      let optNew = document.createElement("option");
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
    let prev = preserveValue ? fieldParentAssignment.value : "";
    fieldParentAssignment.innerHTML = "";
    let opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— Select assignment —";
    fieldParentAssignment.appendChild(opt0);
    let vk = selectedVrfKeyFromFlyout();
    let asg = (ipamFormMeta && ipamFormMeta.assignments) || [];
    let poolSel = fieldParentPool && fieldParentPool.value ? parseInt(fieldParentPool.value, 10) : NaN;
    for (let i = 0; i < asg.length; i++) {
      let a = asg[i];
      if (a.vrf_key !== vk) continue;
      if (!isNaN(poolSel) && a.parent_pool_id !== poolSel) continue;
      let o = document.createElement("option");
      o.value = String(a.id);
      let lab = (a.name || "").trim();
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
    let v = !!on;
    fieldPoolUnmanagedSwitch.classList.toggle("gc-table-toggle--on", v);
    fieldPoolUnmanagedSwitch.setAttribute("aria-checked", v ? "true" : "false");
  }

  function syncPoolUnmanagedWrap() {
    if (!fieldPoolUnmanagedWrap || !fieldType) return;
    let isPool = fieldType.value === "pool";
    fieldPoolUnmanagedWrap.hidden = !isPool;
    fieldPoolUnmanagedWrap.setAttribute("aria-hidden", isPool ? "false" : "true");
  }

  function syncHierarchyFlyout() {
    if (!fieldType) return;
    let t = fieldType.value || "assignment";
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
        let ps = String(row.parent_pool_id);
        if (optionValueExists(fieldParentPool, ps)) fieldParentPool.value = ps;
      }
      rebuildParentAssignmentSelect(false);
      if (fieldParentAssignment && row && row.parent_assignment_id != null) {
        let as = String(row.parent_assignment_id);
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
      let pid = parseInt(fieldParentPool.value, 10);
      let pool = poolById(pid);
      if (!pool) return "Invalid parent pool.";
      let inside = cidrStrictInside(pool.cidr, cidrTrimmed);
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
      let aid = parseInt(fieldParentAssignment.value, 10);
      let asn = assignmentById(aid);
      if (!asn) return "Invalid parent assignment.";
      let inside = cidrStrictInside(asn.cidr, cidrTrimmed);
      if (inside === false) {
        return "Host prefix must be a strict subnet of the parent assignment (" + asn.cidr + ").";
      }
      if (fieldParentPool && fieldParentPool.value) {
        let hpp = parseInt(fieldParentPool.value, 10);
        let poolH = poolById(hpp);
        if (poolH) {
          let inPool = cidrStrictInside(poolH.cidr, cidrTrimmed);
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
    let n = (row && row.name) || "";
    n = n.trim();
    if (!n) return row.cidr;
    if (/^discovered\s*[·.]\s*/i.test(n)) return row.cidr || n;
    return n;
  }

  function manualSearchHaystack(r) {
    let parts = [
      r.name,
      r.cidr,
      String(r.family),
      r.prefix_type || "",
      r.vrf || "",
      r.description || "",
      r.assigned_to_display || "",
      r.assigned_to_custom || "",
    ];
    if (pageMode === "hosts") {
      parts.push(r.lease_hostname || "", r.mac_address || "");
    }
    return parts
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function manualFacetMap(r) {
    let vrfDisp = (r.vrf || "").trim() || "default";
    let asn =
      (r.prefix_type || "") === "assignment" && r.assigned_to_display
        ? r.assigned_to_display
        : "—";
    let o = {
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
    if (pageMode === "hosts") {
      o.lease_hostname = ((r.lease_hostname || "").trim() || "—").toLowerCase();
      o.mac_address = ((r.mac_address || "").trim() || "—").toLowerCase();
    }
    return o;
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
    let json = typeof globalThis.gcNavFirewallsJson !== "undefined" ? globalThis.gcNavFirewallsJson : [];
    let list = Array.isArray(json) ? json.slice() : [];
    list.sort(function (a, b) {
      return String(a.label || "").localeCompare(String(b.label || ""), undefined, {
        sensitivity: "base",
      });
    });
    selectEl.innerHTML = "";
    let opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— None —";
    selectEl.appendChild(opt0);
    for (let i = 0; i < list.length; i++) {
      let fw = list[i];
      let o = document.createElement("option");
      o.value = String(fw.id);
      o.textContent = fw.label || String(fw.id);
      selectEl.appendChild(o);
    }
  }

  function syncAssignedWrap() {
    if (!assignedWrap || !fieldType) return;
    let on = fieldType.value === "assignment";
    assignedWrap.hidden = !on;
    assignedWrap.setAttribute("aria-hidden", on ? "false" : "true");
  }

  function assignedCellHtml(r) {
    if ((r.prefix_type || "") !== "assignment") return "—";
    let d = r.assigned_to_display;
    return d ? esc(d) : "—";
  }

  function conflictPill() {
    return (
      '<span class="gc-ipam-pill gc-ipam-pill--conflict" title="Overlapping assignment in the same VRF">Conflict</span>'
    );
  }

  function manualRowHtml(r) {
    let fv = vrfKey(r.vrf);
    let famNum = r.family === 6 ? 6 : 4;
    let famLabel = r.family === 6 ? "IPv6" : "IPv4";
    let vrfConflict = !!r.vrf_assignment_conflict;
    let rowExtra = vrfConflict ? " gc-ipam-row--vrf-conflict" : "";
    let srcCell = vrfConflict ? conflictPill() : "";
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
      (pageMode === "hosts"
        ? '<td data-gc-col="lease_hostname">' +
          esc((r.lease_hostname || "").trim() || "—") +
          "</td>" +
          '<td data-gc-col="mac_address" class="mono">' +
          esc((r.mac_address || "").trim() || "—") +
          "</td>"
        : "") +
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
    let famNum = d.family === 6 ? 6 : 4;
    let famLabel = d.family === 6 ? "IPv6" : "IPv4";
    let vrfConflict = !!d.vrf_assignment_conflict;
    let rowExtra = vrfConflict ? " gc-ipam-row--vrf-conflict" : "";
    let srcCell =
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

  function discHostSearchHaystack(d) {
    return [
      d.display_name,
      d.cidr,
      d.dhcp_server_name,
      d.lease_hostname,
      d.mac_address,
      d.source_summary,
      d.firewall_label,
    ]
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function discFacetMapDhcp(d) {
    return {
      name: ((d.display_name || "") + "").trim().toLowerCase(),
      lease_hostname: ((d.lease_hostname || "").trim() || "—").toLowerCase(),
      mac_address: ((d.mac_address || "").trim() || "—").toLowerCase(),
      cidr: d.cidr || "",
      family: "IPv4",
      type: "host",
      assigned: "—",
      vrf: "—",
      size: String(d.size_label || "—"),
      description: ((d.source_summary || "").trim() || "—").toLowerCase(),
      origin: "Discovered",
      discovered: "Yes",
      conflict: d.vrf_assignment_conflict ? "Yes" : "No",
    };
  }

  function discRowHtmlDhcpHost(d) {
    let vrfConflict = !!d.vrf_assignment_conflict;
    let rowExtra = vrfConflict ? " gc-ipam-row--vrf-conflict" : "";
    let srcCell =
      '<span class="gc-ipam-pill gc-ipam-pill--discovered">DHCP</span>' +
      (vrfConflict ? " " + conflictPill() : "");
    return (
      '<tr class="gc-ipam-row gc-ipam-row--discovered gc-ipam-data-row' +
      rowExtra +
      '" data-discovered-dhcp-host-key="' +
      esc(d.key) +
      '" data-search="' +
      esc(discHostSearchHaystack(d)) +
      '" tabindex="0" role="button">' +
      '<td data-gc-col="name">' +
      esc(d.display_name || d.cidr) +
      "</td>" +
      '<td data-gc-col="lease_hostname">' +
      esc((d.lease_hostname || "").trim() || "—") +
      "</td>" +
      '<td data-gc-col="mac_address" class="mono">' +
      esc((d.mac_address || "").trim() || "—") +
      "</td>" +
      '<td data-gc-col="cidr" data-sort-value="' +
      esc(d.cidr) +
      '"><code class="gc-ipam-cidr">' +
      esc(d.cidr) +
      "</code></td>" +
      '<td data-gc-col="family" data-sort-value="4">IPv4</td>' +
      '<td data-gc-col="type"><span class="gc-ipam-type gc-ipam-type--host">host</span></td>' +
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

  function mergedRowCidr(item) {
    if (item.kind === "manual") return item.row.cidr;
    if (item.kind === "disc_host") return item.disc.cidr;
    return item.disc.cidr;
  }

  function mergedRows() {
    let m = [];
    let i;
    for (i = 0; i < cache.length; i++) {
      m.push({ kind: "manual", row: cache[i] });
    }
    for (i = 0; i < cacheDiscovered.length; i++) {
      m.push({ kind: "discovered", disc: cacheDiscovered[i] });
    }
    for (i = 0; i < cacheDiscoveredHosts.length; i++) {
      m.push({ kind: "disc_host", disc: cacheDiscoveredHosts[i] });
    }
    m.sort(function (a, b) {
      return mergedRowCidr(a).localeCompare(mergedRowCidr(b), undefined, { numeric: true });
    });
    return m;
  }

  function mergedRowsForView() {
    let all = mergedRows();
    if (!lockedPrefixType) return all;
    return all.filter(function (item) {
      if (item.kind === "manual") {
        let pt = (item.row.prefix_type || "").trim();
        return pt === lockedPrefixType;
      }
      if (item.kind === "discovered") {
        return lockedPrefixType === "assignment";
      }
      if (item.kind === "disc_host") {
        return lockedPrefixType === "host";
      }
      return false;
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
      return (
        "No hosts in the plan yet. Add a host under an assignment, or sync firewalls with «DHCP servers (IPv4)» " +
        "to discover static leases."
      );
    }
    return "No prefixes yet. Add one or sync firewalls to see discovered networks.";
  }

  function rebuildFacets(done) {
    if (!filtersDrawerEl || !globalThis.gcTableFacets) {
      if (typeof done === "function") done();
      return;
    }
    let rowEls = tbody
      ? Array.prototype.slice.call(tbody.querySelectorAll("tr.gc-ipam-data-row"))
      : [];
    let maps = rowEls.map(function (tr) {
      try {
        let raw = tr.dataset.gcRowFacets;
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    });
    globalThis.gcTableFacets.rebuild(filtersDrawerEl, facetCols, maps, FACET_STORAGE_KEY);
    if (typeof done === "function") done();
  }

  function rowMatchesSearch(tr, q) {
    if (!q) return true;
    let s = tr.dataset.search || "";
    return s.indexOf(q) !== -1;
  }

  function rowMatchesFacets(tr) {
    if (!filtersDrawerEl || !globalThis.gcTableFacets) return true;
    return globalThis.gcTableFacets.rowMatches(tr, filtersDrawerEl);
  }

  function rowPassesQuickDiscovered(tr) {
    if (quickDiscoveredMode === "all") return true;
    let isDisc = tr.classList.contains("gc-ipam-row--discovered");
    if (quickDiscoveredMode === "manual") return !isDisc;
    if (quickDiscoveredMode === "discovered") return isDisc;
    return true;
  }

  function rowPassesQuickConflicts(tr) {
    if (!quickConflictOnly) return true;
    return tr.classList.contains("gc-ipam-row--vrf-conflict");
  }

  function syncQuickFilterButtons() {
    let nav = document.getElementById("gc-ipam-quick-nav");
    if (nav) {
      nav.querySelectorAll("[data-gc-ipam-quick]").forEach(function (btn) {
        let mode = btn.dataset.gcIpamQuick || "";
        btn.setAttribute("aria-pressed", mode === quickDiscoveredMode ? "true" : "false");
      });
    }
    let cbtn = document.getElementById("gc-ipam-quick-conflicts");
    if (cbtn) cbtn.setAttribute("aria-pressed", quickConflictOnly ? "true" : "false");
  }

  function applyRowFilter() {
    if (!tbody) return;
    let q = (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();
    let rows = tbody.querySelectorAll("tr.gc-ipam-data-row");
    let place = document.getElementById("gc-ipam-placeholder");
    let emptyFilter = document.getElementById("gc-ipam-filter-empty");
    let visible = 0;
    let totalData = rows.length;
    Array.prototype.forEach.call(rows, function (tr) {
      let ok =
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
    let merged = mergedRowsForView();
    let totalFromApi = cache.length + cacheDiscovered.length + cacheDiscoveredHosts.length;
    if (totalFromApi === 0) {
      tbody.innerHTML =
        '<tr id="gc-ipam-placeholder" class="gc-ipam-placeholder-row"><td class="muted" colspan="9">No prefixes yet. Add one or sync firewalls to see discovered networks.</td></tr>';
      if (filtersDrawerEl) filtersDrawerEl.innerHTML = "";
      updateFacetChrome();
      if (countEl) countEl.textContent = "";
      if (table && globalThis.gcTableSort) globalThis.gcTableSort.bindTable(table);
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
      if (table && globalThis.gcTableSort) globalThis.gcTableSort.bindTable(table);
      syncFilterEmptyColspan();
      syncQuickFilterButtons();
      return;
    }
    let parts = [];
    let maps = [];
    let i;
    for (i = 0; i < merged.length; i++) {
      let item = merged[i];
      if (item.kind === "manual") {
        parts.push(manualRowHtml(item.row));
        maps.push(manualFacetMap(item.row));
      } else if (item.kind === "disc_host") {
        parts.push(discRowHtmlDhcpHost(item.disc));
        maps.push(discFacetMapDhcp(item.disc));
      } else {
        parts.push(discRowHtml(item.disc));
        maps.push(discFacetMap(item.disc));
      }
    }
    parts.push(
      '<tr id="gc-ipam-filter-empty" class="gc-ipam-filter-empty-row" hidden><td class="muted" colspan="9">No prefixes match the current filters.</td></tr>'
    );
    tbody.innerHTML = parts.join("");
    let dataRows = tbody.querySelectorAll("tr.gc-ipam-data-row");
    for (i = 0; i < dataRows.length; i++) {
      if (globalThis.gcTableFacets) globalThis.gcTableFacets.setRowFacets(dataRows[i], maps[i]);
    }
    applyColVis(colVis);
    syncFilterEmptyColspan();
    rebuildFacets(function () {
      applyRowFilter();
      updateFacetChrome();
      if (table && globalThis.gcTableSort) globalThis.gcTableSort.bindTable(table);
    });
  }

  function renderStats(prefixes, discovered, discoveredHosts) {
    // Summary cards count saved plan rows only; discovered has its own stat.
    let total = prefixes.length;
    let v4 = 0;
    let v6 = 0;
    let pools = 0;
    let i;
    let p;
    let dhosts = discoveredHosts || [];
    for (i = 0; i < prefixes.length; i++) {
      p = prefixes[i];
      if (p.family === 6) v6++;
      else v4++;
      if (p.prefix_type === "pool") pools++;
    }
    let conflictN = 0;
    for (i = 0; i < prefixes.length; i++) {
      if (prefixes[i].vrf_assignment_conflict) conflictN++;
    }
    for (i = 0; i < discovered.length; i++) {
      if (discovered[i].vrf_assignment_conflict) conflictN++;
    }
    for (i = 0; i < dhosts.length; i++) {
      if (dhosts[i].vrf_assignment_conflict) conflictN++;
    }
    function set(id, v) {
      let el = document.getElementById(id);
      if (el) el.textContent = String(v);
    }
    set("gc-ipam-stat-total", total);
    set("gc-ipam-stat-v4", v4);
    set("gc-ipam-stat-v6", v6);
    set("gc-ipam-stat-pools", pools);
    set("gc-ipam-stat-discovered", discovered.length + dhosts.length);
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
        cacheDiscoveredHosts = data.discovered_hosts || [];
        ipamFormMeta = data.ipam_form_meta || { vrf_names: [], pools: [], assignments: [] };
        renderStats(cache, cacheDiscovered, cacheDiscoveredHosts);
        renderTable();
        setStatus("", false);
        if (flyout && !flyout.hidden) {
          if (editId != null) {
            let er = findRow(editId);
            if (er) rebuildVrfSelect(effectiveVrfLabelForRow(er));
          } else {
            rebuildVrfSelect("");
            let ns = (ipamFormMeta && ipamFormMeta.vrf_names) || [];
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
    let n = Number(id);
    for (let i = 0; i < cache.length; i++) {
      if (cache[i].id === n) return cache[i];
    }
    return null;
  }

  function findDiscovered(key) {
    for (let i = 0; i < cacheDiscovered.length; i++) {
      if (cacheDiscovered[i].key === key) return cacheDiscovered[i];
    }
    return null;
  }

  function findDiscoveredDhcpHost(key) {
    for (let i = 0; i < cacheDiscoveredHosts.length; i++) {
      if (cacheDiscoveredHosts[i].key === key) return cacheDiscoveredHosts[i];
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
    let row = findRow(editId);
    if (!row) {
      deleteBtn.hidden = true;
      return;
    }
    let pt = (fieldType && fieldType.value) || row.prefix_type || "";
    let show = !!row.delete_eligible && (pt === "pool" || pt === "assignment");
    deleteBtn.hidden = !show;
    if (!show) {
      deleteBtn.disabled = false;
      deleteBtn.removeAttribute("title");
      deleteBtn.removeAttribute("aria-label");
      return;
    }
    deleteBtn.disabled = !row.delete_allowed;
    let reason = row.delete_blocked_reason || "";
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
    if (fieldLeaseHostname) fieldLeaseHostname.value = (row.lease_hostname || "").trim();
    if (fieldMac) fieldMac.value = (row.mac_address || "").trim();
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
    return globalThis.matchMedia && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function layoutSubflyoutLeftOf(subPanel, primaryPanel, gap) {
    if (!subPanel || !primaryPanel) return;
    let w = primaryPanel.offsetWidth;
    let g = gap == null ? 10 : gap;
    subPanel.style.right = Math.max(0, w + g) + "px";
  }

  function layoutNestedPoolBesidePrimary() {
    layoutSubflyoutLeftOf(nestedPoolFlyoutPanel, flyoutPanel, 10);
  }

  function layoutPoolFlyoutBesideDisc() {
    layoutSubflyoutLeftOf(poolFlyoutPanel, discFlyoutPanel, 10);
  }

  let nestedPoolCloseAnimTimer = null;
  let poolFlyoutCloseAnimTimer = null;

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
      globalThis.clearTimeout(nestedPoolCloseAnimTimer);
      nestedPoolCloseAnimTimer = null;
    }
    nestedPoolFlyout.classList.remove("gc-ipam-nested-pool-flyout--open");
    if (immediate || prefersReducedMotion() || !nestedPoolFlyoutPanel || nestedPoolFlyout.hidden) {
      finishNestedPoolFlyoutCleanup();
      return;
    }
    nestedPoolCloseAnimTimer = globalThis.setTimeout(function () {
      nestedPoolCloseAnimTimer = null;
      finishNestedPoolFlyoutCleanup();
    }, 300);
  }

  function showNestedPoolFlyout() {
    if (!nestedPoolFlyout) return;
    if (nestedPoolCloseAnimTimer) {
      globalThis.clearTimeout(nestedPoolCloseAnimTimer);
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
    let assign = (fieldCidr.value || "").trim();
    let pl = parseInt(nestedPoolPl.value, 10);
    let cidr = ipv4SupernetCidrForAssignment(assign, pl);
    nestedPoolResult.textContent = cidr || "—";
  }

  function setNestedPoolSubmitEnabled(on) {
    if (!nestedPoolSubmitBtn) return;
    nestedPoolSubmitBtn.disabled = !on;
  }

  /** Sync nested “New pool” sheet from the primary add-prefix form; keep Parent pool on “New pool…”. */
  function syncNestedPoolFlyoutFromPrimary() {
    let assign = ((fieldCidr && fieldCidr.value) || "").trim();
    if (nestedPoolVrf) {
      let vk = selectedVrfKeyFromFlyout();
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
    let nw = ipv4NetworkFromCidr(assign);
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
      let maxPl = nw.pl - 1;
      let pl;
      for (pl = maxPl; pl >= 0; pl--) {
        let o = document.createElement("option");
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
      globalThis.clearTimeout(poolFlyoutCloseAnimTimer);
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
      globalThis.clearTimeout(poolFlyoutCloseAnimTimer);
      poolFlyoutCloseAnimTimer = null;
    }
    poolFlyout.classList.remove("gc-ipam-pool-flyout--open");
    if (immediate || prefersReducedMotion() || !poolFlyoutPanel || poolFlyout.hidden) {
      finishPoolFlyoutCleanup();
      return;
    }
    poolFlyoutCloseAnimTimer = globalThis.setTimeout(function () {
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
    let firstSrc = (d.source_summary || "").split(",")[0].trim();
    if (fieldName) fieldName.value = firstSrc || (d.cidr || "").trim() || "";
    if (fieldCidr) fieldCidr.value = d.cidr || "";
    let encCidr = d.encompassing_pool_cidr;
    if (fieldAssignedFw) {
      fieldAssignedFw.value = d.firewall_id != null ? String(d.firewall_id) : "";
    }
    if (fieldAssignedCustom) fieldAssignedCustom.value = "";
    if (fieldDesc) fieldDesc.value = (d.source_summary || "").trim() || "";
    lockAssignedFirewallFromDiscovered();
    setFormStatus("", false);
    let msgs = [];
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
      let pm2 = poolMetaByCidr(encCidr);
      if (pm2 && optionValueExists(fieldParentPool, String(pm2.id))) {
        fieldParentPool.value = String(pm2.id);
      }
    }
    rebuildParentAssignmentSelect(false);
    let vrfPick = "";
    if (d.has_encompassing_pool && encCidr) {
      let pmv = poolMetaByCidr(encCidr);
      if (pmv) vrfPick = String(pmv.vrf_key || "default");
    }
    if (vrfPick && fieldVrf && optionValueExists(fieldVrf, vrfPick)) {
      fieldVrf.value = vrfPick;
    } else {
      let ns0 = (ipamFormMeta && ipamFormMeta.vrf_names) || [];
      if (ns0.length === 1 && fieldVrf) fieldVrf.value = String(ns0[0]);
    }
    setFlyoutPrefixType("assignment");
    showFlyout();
    if (fieldName) fieldName.focus();
  }

  function openFlyoutFromDiscoveredDhcpHost(d) {
    discoveredPrefillSource = d;
    discCurrent = d;
    editId = null;
    if (flyoutTitle) flyoutTitle.textContent = "Add host from DHCP";
    if (fieldId) fieldId.value = "";
    if (form) form.reset();
    unlockAssignedFirewallFields();
    if (fieldName) {
      fieldName.value =
        (d.lease_hostname || "").trim() ||
        String(d.cidr || "")
          .replace(/\/32$/i, "")
          .trim() ||
        "";
    }
    if (fieldCidr) fieldCidr.value = d.cidr || "";
    if (fieldLeaseHostname) fieldLeaseHostname.value = (d.lease_hostname || "").trim();
    if (fieldMac) fieldMac.value = (d.mac_address || "").trim();
    if (fieldDesc) fieldDesc.value = (d.source_summary || "").trim() || "";
    setFormStatus("", false);
    if (d.vrf_assignment_conflict) {
      setFormStatus(
        "Overlaps another prefix in the same VRF (resolve the conflict before saving).",
        true,
      );
    }
    if (!d.accept_allowed) {
      setFormStatus(
        "No saved assignment fully contains this /32. Create or accept an assignment that covers this address first.",
        true,
      );
    }
    rebuildVrfSelect("");
    rebuildParentPoolSelect(false);
    rebuildParentAssignmentSelect(false);
    let asgs = (ipamFormMeta && ipamFormMeta.assignments) || [];
    let sug = d.suggested_parent_assignment_id;
    let pickVrf = "";
    if (sug != null && fieldParentAssignment && optionValueExists(fieldParentAssignment, String(sug))) {
      fieldParentAssignment.value = String(sug);
      let hit = asgs.filter(function (a) {
        return String(a.id) === String(sug);
      })[0];
      if (hit) pickVrf = hit.vrf_key || "";
      if (hit && hit.parent_pool_id != null && fieldParentPool) {
        if (optionValueExists(fieldParentPool, String(hit.parent_pool_id))) {
          fieldParentPool.value = String(hit.parent_pool_id);
        }
      }
    }
    if (pickVrf && fieldVrf && optionValueExists(fieldVrf, pickVrf)) {
      fieldVrf.value = pickVrf;
    } else {
      let ns0 = (ipamFormMeta && ipamFormMeta.vrf_names) || [];
      if (ns0.length === 1 && fieldVrf) fieldVrf.value = String(ns0[0]);
    }
    setFlyoutPrefixType("host");
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
    let d = body.detail;
    let msg = typeof d === "string" ? d : detailMessage(d);
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
    let body = {
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
      let parsed = parseInt(discAssignedFw.value, 10);
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
          let det = res.body && res.body.detail;
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
        let msg = e && e.message ? e.message : String(e);
        if (poolFlyout && !poolFlyout.hidden) {
          setPoolStatus(msg, true);
        } else {
          setDiscStatus(msg, true);
        }
      });
  }

  function setFiltersAsideCollapsed(collapsed) {
    let aside = filtersAsideEl;
    let drawer = filtersDrawerEl;
    let btn = document.getElementById(PREFIX + "-filters-toggle");
    if (!aside || !drawer || !btn) return;
    aside.classList.toggle("filters--collapsed", collapsed);
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (collapsed) drawer.setAttribute("hidden", "");
    else drawer.removeAttribute("hidden");
  }

  function filterColMenuList() {
    let q = (colsFilter && colsFilter.value ? colsFilter.value : "").trim().toLowerCase();
    if (!colsList) return;
    colsList.querySelectorAll("li[data-col-label]").forEach(function (li) {
      let lab = (li.dataset.colLabel || "").toLowerCase();
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
    let r = colsTrigger.getBoundingClientRect();
    let gap = 6;
    let margin = 8;
    let pw = colsPanel.offsetWidth || Math.min(380, globalThis.innerWidth - 2 * margin);
    let left = r.left;
    if (left + pw > globalThis.innerWidth - margin) left = globalThis.innerWidth - margin - pw;
    left = Math.max(margin, left);
    let topBelow = r.bottom + gap;
    colsPanel.style.left = left + "px";
    colsPanel.style.top = topBelow + "px";
    let after = colsPanel.getBoundingClientRect();
    if (after.bottom > globalThis.innerHeight - margin) {
      let aboveTop = r.top - gap - after.height;
      if (aboveTop >= margin) colsPanel.style.top = aboveTop + "px";
      else {
        colsPanel.style.top = margin + "px";
        colsPanel.style.maxHeight = Math.max(120, globalThis.innerHeight - 2 * margin) + "px";
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
    let willOpen = colsModal.hidden;
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
      let raw = fieldParentAssignment.value;
      if (!raw || !fieldParentPool) return;
      let id = parseInt(raw, 10);
      if (isNaN(id)) return;
      let asg = assignmentById(id);
      if (!asg || asg.parent_pool_id == null) return;
      fieldParentPool.value = String(asg.parent_pool_id);
      rebuildParentAssignmentSelect(true);
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", function () {
      if (editId == null || deleteBtn.disabled) return;
      let row = findRow(editId);
      if (!row) return;
      let pt = row.prefix_type || "";
      let name = displayName(row);
      let cidr = row.cidr || "";
      let msg = 'Delete "' + name + '" (' + cidr + ")?";
      let cascade = Number(row.ipam_delete_cascade_count) || 0;
      if (pt === "pool" && cascade > 0) {
        msg +=
          "\n\nThis pool contains " +
          cascade +
          " other prefix(es) in the address plan (assignments, hosts, or nested pools). They will be deleted as well.";
      }
      if (!globalThis.confirm(msg)) return;
      setFormStatus("Deleting…", false);
      let delUrl =
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

  let filtersToggleBtn = document.getElementById(PREFIX + "-filters-toggle");
  if (filtersToggleBtn) {
    filtersToggleBtn.addEventListener("click", function () {
      let collapsed = filtersAsideEl && filtersAsideEl.classList.contains("filters--collapsed");
      setFiltersAsideCollapsed(!collapsed);
    });
  }

  if (facetResetBtn) {
    facetResetBtn.addEventListener("click", function () {
      if (filtersDrawerEl && globalThis.gcTableFacets) {
        globalThis.gcTableFacets.reset(filtersDrawerEl, FACET_STORAGE_KEY);
      }
      updateFacetChrome();
      applyRowFilter();
    });
  }

  if (filtersAsideEl && globalThis.gcTableFacets) {
    globalThis.gcTableFacets.bindAside(
      filtersAsideEl,
      function () {
        updateFacetChrome();
        applyRowFilter();
      },
      FACET_STORAGE_KEY
    );
  }

  if (searchInput) {
    if (globalThis.gcTableFacets && globalThis.gcTableFacets.bindToolbarSearch) {
      globalThis.gcTableFacets.bindToolbarSearch(searchInput, FACET_STORAGE_KEY, applyRowFilter);
    } else {
      searchInput.addEventListener("input", applyRowFilter);
    }
  }

  let quickNav = document.getElementById("gc-ipam-quick-nav");
  if (quickNav) {
    quickNav.addEventListener("click", function (ev) {
      let btn = ev.target.closest("[data-gc-ipam-quick]");
      if (!btn || !quickNav.contains(btn)) return;
      let mode = btn.dataset.gcIpamQuick || "";
      if (mode !== "all" && mode !== "manual" && mode !== "discovered") return;
      quickDiscoveredMode = mode;
      applyRowFilter();
    });
  }

  let quickConflictsBtn = document.getElementById("gc-ipam-quick-conflicts");
  if (quickConflictsBtn) {
    quickConflictsBtn.addEventListener("click", function () {
      quickConflictOnly = !quickConflictOnly;
      applyRowFilter();
    });
  }

  let acceptAllBtn = document.getElementById("gc-ipam-accept-all");
  if (acceptAllBtn && apiAcceptBatch) {
    acceptAllBtn.addEventListener("click", function () {
      if (
        !globalThis.confirm(
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
          let n = res.body.accepted_count != null ? Number(res.body.accepted_count) : 0;
          let parts = [];
          parts.push(n === 1 ? "Accepted 1 assignment." : "Accepted " + n + " assignments.");
          let sk = res.body.skipped;
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
    let bd = colsModal.querySelector(".fw-cols-modal__backdrop");
    if (bd) {
      bd.addEventListener("click", function () {
        setColPanelOpen(false);
        if (colsTrigger) colsTrigger.focus();
      });
    }
  }
  if (colsList) {
    colsList.addEventListener("change", function (e) {
      let cb = e.target.closest(colInputSel);
      if (!cb || cb.type !== "checkbox") return;
      let id = cb.getAttribute(COL_CHECK_ATTR);
      if (!id || !Object.prototype.hasOwnProperty.call(colVis, id)) return;
      colVis[id] = cb.checked;
      let nOn = 0;
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
  globalThis.addEventListener("resize", function () {
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
      let pc = (poolCidr && poolCidr.value) || "";
      let pn = (poolName && poolName.value) || "";
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
      let assign = ((fieldCidr && fieldCidr.value) || "").trim();
      let pl = parseInt(nestedPoolPl && nestedPoolPl.value, 10);
      let name = ((nestedPoolName && nestedPoolName.value) || "").trim();
      let poolCidrStr = ipv4SupernetCidrForAssignment(assign, pl);
      let vrfRaw = ((fieldVrf && fieldVrf.value) || "").trim();
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
            let det = res.body && res.body.detail;
            let msg =
              res.status === 409
                ? "That CIDR already exists in this VRF."
                : typeof det === "string"
                  ? det
                  : detailMessage(det) || "Could not create pool.";
            setNestedPoolStatus(msg, true);
            return;
          }
          let newId = res.body && res.body.id;
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
    let list = rows || [];
    if (!list.length) {
      vrfTbody.innerHTML =
        '<tr><td class="muted" colspan="3">No VRFs defined yet. Add one to use when creating prefixes.</td></tr>';
      if (vrfCountEl) vrfCountEl.textContent = "";
      return;
    }
    let i;
    let parts = [];
    for (i = 0; i < list.length; i++) {
      let r = list[i];
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
      let nm = ((vrfFlyoutName && vrfFlyoutName.value) || "").trim();
      let ds = ((vrfFlyoutDesc && vrfFlyoutDesc.value) || "").trim();
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
            let det = res.body && res.body.detail;
            let msg =
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
      let trH = ev.target.closest("tr[data-discovered-dhcp-host-key]");
      if (trH && tbody.contains(trH) && trH.classList.contains("gc-ipam-data-row")) {
        let hk = trH.dataset.discoveredDhcpHostKey;
        let hr = findDiscoveredDhcpHost(hk);
        if (hr) openFlyoutFromDiscoveredDhcpHost(hr);
        return;
      }
      let trD = ev.target.closest("tr[data-discovered-key]");
      if (trD && tbody.contains(trD) && trD.classList.contains("gc-ipam-data-row")) {
        let dk = trD.dataset.discoveredKey;
        let dr = findDiscovered(dk);
        if (dr) openFlyoutFromDiscovered(dr);
        return;
      }
      let tr = ev.target.closest("tr[data-ipam-id]");
      if (!tr || !tbody.contains(tr) || !tr.classList.contains("gc-ipam-data-row")) return;
      let id = tr.dataset.ipamId;
      let row = findRow(id);
      if (row) openFlyoutEdit(row);
    });
    tbody.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      let trH = ev.target.closest("tr[data-discovered-dhcp-host-key]");
      if (trH && tbody.contains(trH) && trH.classList.contains("gc-ipam-data-row")) {
        ev.preventDefault();
        let hk = trH.dataset.discoveredDhcpHostKey;
        let hr = findDiscoveredDhcpHost(hk);
        if (hr) openFlyoutFromDiscoveredDhcpHost(hr);
        return;
      }
      let trD = ev.target.closest("tr[data-discovered-key]");
      if (trD && tbody.contains(trD) && trD.classList.contains("gc-ipam-data-row")) {
        ev.preventDefault();
        let dk = trD.dataset.discoveredKey;
        let dr = findDiscovered(dk);
        if (dr) openFlyoutFromDiscovered(dr);
        return;
      }
      let tr = ev.target.closest("tr[data-ipam-id]");
      if (!tr || !tbody.contains(tr) || !tr.classList.contains("gc-ipam-data-row")) return;
      ev.preventDefault();
      let id = tr.dataset.ipamId;
      let row = findRow(id);
      if (row) openFlyoutEdit(row);
    });
  }

  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      setFormStatus("Saving…", false);
      let name = (fieldName && fieldName.value) || "";
      let cidr = (fieldCidr && fieldCidr.value) || "";
      let cidrTrim = cidr.trim();
      let vrfRaw = ((fieldVrf && fieldVrf.value) || "").trim();
      if (!vrfRaw) {
        setFormStatus("Select a VRF.", true);
        return;
      }
      let ptype = (fieldType && fieldType.value) || "assignment";
      let hierErr = validateHierarchyBeforeSubmit(ptype, cidrTrim);
      if (hierErr) {
        setFormStatus(hierErr, true);
        return;
      }
      if (
        discoveredPrefillSource &&
        discoveredPrefillSource.row_kind === "discovered_dhcp_host"
      ) {
        if (!apiAcceptDhcpHost) {
          setFormStatus("DHCP accept API URL is not configured.", true);
          return;
        }
        let pa =
          fieldParentAssignment && fieldParentAssignment.value
            ? parseInt(fieldParentAssignment.value, 10)
            : NaN;
        if (isNaN(pa) || pa < 1) {
          setFormStatus("Select a parent assignment.", true);
          return;
        }
        let nm = name.trim();
        if (!nm) {
          setFormStatus("Name is required.", true);
          return;
        }
        let bodyDhcp = {
          firewall_id: discoveredPrefillSource.firewall_id,
          cidr: cidrTrim || discoveredPrefillSource.cidr,
          name: nm,
          parent_assignment_id: pa,
          lease_hostname:
            ((fieldLeaseHostname && fieldLeaseHostname.value) || "").trim() || null,
          mac_address: ((fieldMac && fieldMac.value) || "").trim() || null,
          description: ((fieldDesc && fieldDesc.value) || "").trim() || null,
        };
        fetch(apiAcceptDhcpHost, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyDhcp),
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
        return;
      }
      let parentPoolId = null;
      let parentAssignmentId = null;
      if (ptype === "assignment") {
        if (fieldParentPool && fieldParentPool.value) {
          let pp = parseInt(fieldParentPool.value, 10);
          if (!isNaN(pp)) parentPoolId = pp;
        }
      } else if (ptype === "host") {
        if (fieldParentPool && fieldParentPool.value) {
          let ppH = parseInt(fieldParentPool.value, 10);
          if (!isNaN(ppH)) parentPoolId = ppH;
        }
        if (fieldParentAssignment && fieldParentAssignment.value) {
          let pa = parseInt(fieldParentAssignment.value, 10);
          if (!isNaN(pa)) parentAssignmentId = pa;
        }
      }
      let fwVal = null;
      if (discoveredPrefillSource && discoveredPrefillSource.firewall_id != null) {
        let fdi = parseInt(discoveredPrefillSource.firewall_id, 10);
        if (!isNaN(fdi) && fdi > 0) fwVal = fdi;
      } else if (fieldAssignedFw && fieldAssignedFw.value) {
        let parsed2 = parseInt(fieldAssignedFw.value, 10);
        if (!isNaN(parsed2) && parsed2 > 0) fwVal = parsed2;
      }
      let customRaw = (fieldAssignedCustom && fieldAssignedCustom.value) || "";
      let body = {
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
        lease_hostname:
          ((fieldLeaseHostname && fieldLeaseHostname.value) || "").trim() || null,
        mac_address: ((fieldMac && fieldMac.value) || "").trim() || null,
      };
      if (ptype === "assignment") {
        if (fwVal != null) {
          body.assigned_to_firewall_id = fwVal;
        } else {
          body.assigned_to_custom = customRaw.trim() || null;
        }
      }
      let url = apiCreate;
      let method = "POST";
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

  globalThis.addEventListener(
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
