(function () {
  "use strict";

  function apiTreeUrl(kind, id) {
    if (kind === "firewall") {
      return "/api/firewalls/" + encodeURIComponent(id) + "/config-viewer-tree";
    }
    return "/api/configurations/" + encodeURIComponent(id) + "/config-viewer-tree";
  }

  function apiQueueDeletesUrl(kind, id) {
    if (kind === "firewall") {
      return "/api/firewalls/" + encodeURIComponent(id) + "/config-viewer/queue-deletes";
    }
    return "/api/configurations/" + encodeURIComponent(id) + "/config-viewer/queue-deletes";
  }

  function apiEntryUrl(kind, scopeId, entryId) {
    if (kind === "firewall") {
      return (
        "/api/firewalls/" +
        encodeURIComponent(scopeId) +
        "/config-entries/" +
        encodeURIComponent(entryId)
      );
    }
    return (
      "/api/configurations/" +
      encodeURIComponent(scopeId) +
      "/config-entries/" +
      encodeURIComponent(entryId)
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  let DEL_SVG = (window.gcIcon ? window.gcIcon("delete", { size: "xs" }) : "");

  let SYNC_SVG = (window.gcIcon ? window.gcIcon("sync", { size: "xs" }) : "");

  let rootModal = null;
  let detailModal = null;
  let treeEl = null;
  let titleEl = null;
  let metaEl = null;
  let statusEl = null;
  let detailTitleEl = null;
  let detailMetaEl = null;
  let detailBodyEl = null;
  let currentScope = null;

  function getEls() {
    if (!rootModal) rootModal = document.getElementById("gc-config-viewer-modal");
    if (!detailModal) detailModal = document.getElementById("gc-config-viewer-detail-modal");
    if (!treeEl) treeEl = document.getElementById("gc-config-viewer-tree");
    if (!titleEl) titleEl = document.getElementById("gc-config-viewer-title");
    if (!metaEl) metaEl = document.getElementById("gc-config-viewer-meta");
    if (!statusEl) statusEl = document.getElementById("gc-config-viewer-status");
    if (!detailTitleEl) detailTitleEl = document.getElementById("gc-config-viewer-detail-title");
    if (!detailMetaEl) detailMetaEl = document.getElementById("gc-config-viewer-detail-meta");
    if (!detailBodyEl) detailBodyEl = document.getElementById("gc-config-viewer-detail-body");
  }

  function showModal(el) {
    if (!el) return;
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
  }

  function hideModal(el) {
    if (!el) return;
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
  }

  function closeDetail() {
    getEls();
    hideModal(detailModal);
    if (detailBodyEl) detailBodyEl.textContent = "";
  }

  function closeViewer() {
    getEls();
    closeDetail();
    hideModal(rootModal);
    currentScope = null;
    if (treeEl) treeEl.innerHTML = "";
  }

  function renderCount(n) {
    return '<span class="gc-cv-count">' + n + "</span>";
  }

  function collectIdsFromItems(items) {
    let out = [];
    if (!items) return out;
    for (let i = 0; i < items.length; i++) {
      let id = items[i].entry_id;
      if (id != null) out.push(id);
    }
    return out;
  }

  function uniqueStrings(arr) {
    let seen = {};
    let out = [];
    for (let i = 0; i < (arr || []).length; i++) {
      let s = String(arr[i] || "").trim();
      if (!s || seen[s]) continue;
      seen[s] = true;
      out.push(s);
    }
    return out;
  }

  function collectEntityTypesFromItems(items) {
    let types = [];
    if (!items) return types;
    for (let i = 0; i < items.length; i++) {
      let et = items[i].entity_type;
      if (et != null && String(et).trim()) types.push(String(et).trim());
    }
    return uniqueStrings(types);
  }

  function renderDeleteQueueBtn(ids, label) {
    if (!ids || !ids.length) return "";
    let json = JSON.stringify(ids);
    let t = label || "Queue delete for task queue approval";
    return (
      '<button type="button" class="btn-icon gc-cv-queue-delete" title="' +
      escapeAttr(t) +
      '" aria-label="' +
      escapeAttr(t) +
      '" data-gc-cv-delete-ids="' +
      escapeAttr(json) +
      '">' +
      DEL_SVG +
      "</button>"
    );
  }

  function renderSyncBtn(entityTypes, label) {
    if (!entityTypes || !entityTypes.length) return "";
    let json = JSON.stringify(entityTypes);
    let t = label || "Sync these object types from the firewall";
    return (
      '<button type="button" class="btn-icon gc-cv-scope-sync" title="' +
      escapeAttr(t) +
      '" aria-label="' +
      escapeAttr(t) +
      '" data-gc-cv-sync-entities="' +
      escapeAttr(json) +
      '">' +
      SYNC_SVG +
      "</button>"
    );
  }

  function renderScopeActionControls(entryIds, entityTypes, deleteLabel, syncLabel) {
    if (!entryIds || !entryIds.length) return "";
    if (currentScope && currentScope.allowDelete) {
      return renderDeleteQueueBtn(entryIds, deleteLabel);
    }
    if (
      currentScope &&
      currentScope.kind === "firewall" &&
      currentScope.configSyncUrl &&
      entityTypes &&
      entityTypes.length
    ) {
      return renderSyncBtn(entityTypes, syncLabel);
    }
    return "";
  }

  function renderItems(items) {
    if (!items || !items.length) {
      return '<p class="muted gc-cv-empty">No objects in this category.</p>';
    }
    let buf = ['<ul class="gc-cv-items">'];
    for (let i = 0; i < items.length; i++) {
      let it = items[i];
      let eid = it.entry_id;
      let nm = it.name != null ? String(it.name) : "";
      let oneType =
        it.entity_type != null && String(it.entity_type).trim()
          ? [String(it.entity_type).trim()]
          : [];
      buf.push(
        '<li class="gc-cv-item-row">' +
          '<button type="button" class="gc-cv-item-link" data-gc-cv-entry="' +
          escapeHtml(String(eid)) +
          '">' +
          escapeHtml(nm || "(unnamed)") +
          "</button>" +
          renderScopeActionControls(
            eid != null ? [eid] : [],
            oneType,
            "Queue delete for this object",
            "Sync this object type from the firewall"
          ) +
          "</li>"
      );
    }
    buf.push("</ul>");
    return buf.join("");
  }

  function renderTabs(tabs) {
    let parts = [];
    for (let i = 0; i < tabs.length; i++) {
      let t = tabs[i];
      let tabIds = collectIdsFromItems(t.items);
      let tabTypes = collectEntityTypesFromItems(t.items);
      parts.push(
        '<details class="gc-cv-tab">' +
          '<summary class="gc-cv-summary-row">' +
          '<span class="gc-cv-summary-main">' +
          escapeHtml(t.label || t.id || "") +
          " " +
          renderCount(t.count || 0) +
          "</span>" +
          '<span class="gc-cv-summary-actions">' +
          renderScopeActionControls(
            tabIds,
            tabTypes,
            "Queue delete for all objects in this tab",
            "Sync all object types in this tab from the firewall"
          ) +
          "</span>" +
          "</summary>" +
          '<div class="gc-cv-tab-body">' +
          renderItems(t.items) +
          "</div>" +
          "</details>"
      );
    }
    return parts.join("");
  }

  function renderGroups(groups) {
    let parts = [];
    for (let i = 0; i < groups.length; i++) {
      let g = groups[i];
      let gIds = [];
      let gTypes = [];
      let tabs = g.tabs || [];
      for (let j = 0; j < tabs.length; j++) {
        gIds = gIds.concat(collectIdsFromItems(tabs[j].items));
        gTypes = gTypes.concat(collectEntityTypesFromItems(tabs[j].items));
      }
      gTypes = uniqueStrings(gTypes);
      parts.push(
        '<details class="gc-cv-group">' +
          '<summary class="gc-cv-summary-row">' +
          '<span class="gc-cv-summary-main">' +
          escapeHtml(g.label || g.id || "") +
          " " +
          renderCount(g.count || 0) +
          "</span>" +
          '<span class="gc-cv-summary-actions">' +
          renderScopeActionControls(
            gIds,
            gTypes,
            "Queue delete for all objects in this group",
            "Sync all object types in this group from the firewall"
          ) +
          "</span>" +
          "</summary>" +
          '<div class="gc-cv-group-body">' +
          renderTabs(tabs) +
          "</div>" +
          "</details>"
      );
    }
    return parts.join("");
  }

  function collectIdsFromSection(sec) {
    let ids = [];
    let groups = sec.groups || [];
    for (let i = 0; i < groups.length; i++) {
      let tabs = groups[i].tabs || [];
      for (let j = 0; j < tabs.length; j++) {
        ids = ids.concat(collectIdsFromItems(tabs[j].items));
      }
    }
    return ids;
  }

  function collectEntityTypesFromSection(sec) {
    let types = [];
    let groups = sec.groups || [];
    for (let i = 0; i < groups.length; i++) {
      let tabs = groups[i].tabs || [];
      for (let j = 0; j < tabs.length; j++) {
        types = types.concat(collectEntityTypesFromItems(tabs[j].items));
      }
    }
    return uniqueStrings(types);
  }

  function renderSection(sec) {
    let sIds = collectIdsFromSection(sec);
    let sTypes = collectEntityTypesFromSection(sec);
    return (
      '<details class="gc-cv-section">' +
        '<summary class="gc-cv-summary-row">' +
        '<span class="gc-cv-summary-main">' +
        escapeHtml(sec.label || sec.id || "") +
        " " +
        renderCount(sec.count || 0) +
        "</span>" +
        '<span class="gc-cv-summary-actions">' +
        renderScopeActionControls(
          sIds,
          sTypes,
          "Queue delete for all objects in this section",
          "Sync all object types in this section from the firewall"
        ) +
        "</span>" +
        "</summary>" +
        '<div class="gc-cv-section-body">' +
        renderGroups(sec.groups || []) +
        "</div>" +
        "</details>"
    );
  }

  function renderUnmapped(unmapped) {
    if (!unmapped || !unmapped.tabs || !unmapped.tabs.length) return "";
    let uIds = [];
    let uTypes = [];
    let tabs = unmapped.tabs || [];
    for (let i = 0; i < tabs.length; i++) {
      uIds = uIds.concat(collectIdsFromItems(tabs[i].items));
      uTypes = uTypes.concat(collectEntityTypesFromItems(tabs[i].items));
    }
    uTypes = uniqueStrings(uTypes);
    return (
      '<details class="gc-cv-section gc-cv-section--other">' +
        '<summary class="gc-cv-summary-row">' +
        '<span class="gc-cv-summary-main">' +
        escapeHtml(unmapped.label || "Other") +
        " " +
        renderCount(unmapped.count || 0) +
        "</span>" +
        '<span class="gc-cv-summary-actions">' +
        renderScopeActionControls(
          uIds,
          uTypes,
          "Queue delete for all other cached objects",
          "Sync all other object types from the firewall"
        ) +
        "</span>" +
        "</summary>" +
        '<div class="gc-cv-section-body">' +
        renderTabs(tabs) +
        "</div>" +
        "</details>"
    );
  }

  function renderTree(data) {
    let sections = data.sections || [];
    let parts = [];
    for (let i = 0; i < sections.length; i++) {
      parts.push(renderSection(sections[i]));
    }
    parts.push(renderUnmapped(data.unmapped));
    return parts.join("");
  }

  function fetchAndRenderTree() {
    getEls();
    if (!currentScope || !treeEl || !metaEl || !statusEl) return;
    treeEl.innerHTML = '<p class="muted">Loading…</p>';
    statusEl.hidden = true;
    statusEl.textContent = "";
    let url = apiTreeUrl(currentScope.kind, currentScope.id);
    fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, body: j, status: r.status };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          let d = res.body && res.body.detail;
          let msg = typeof d === "string" ? d : JSON.stringify(d || res.body || "");
          treeEl.innerHTML = "";
          statusEl.hidden = false;
          statusEl.textContent = String(msg || "Error " + res.status);
          return;
        }
        let data = res.body;
        let sc = data.scope || {};
        currentScope.allowDelete = !!sc.allow_delete;
        currentScope.configSyncUrl = sc.config_sync_url || null;
        let n = data.total_count != null ? data.total_count : 0;
        let base =
          n === 1 ? "1 cached object in this scope." : n + " cached objects in this scope.";
        if (currentScope.kind === "firewall" && !currentScope.allowDelete) {
          base += " Sync icons refresh the selected object types from the firewall.";
        } else if (currentScope.allowDelete || currentScope.kind === "configuration") {
          base += " Delete queues tasks for approval.";
        }
        metaEl.textContent = base;
        treeEl.innerHTML = renderTree(data);
        try {
          treeEl.focus();
        } catch (e) {}
      })
      .catch(function () {
        treeEl.innerHTML = "";
        statusEl.hidden = false;
        statusEl.textContent = "Request failed.";
      });
  }

  function queueDeletesForIds(ids) {
    getEls();
    if (!currentScope || !ids || !ids.length) return;
    let n = ids.length;
    let msg =
      "Queue " +
      n +
      " delete task" +
      (n === 1 ? "" : "s") +
      " for approval in the task queue? Cached objects remain until tasks are approved and applied.";
    let cf = window.gcConfirm
      ? window.gcConfirm(msg, { tone: "danger", confirmLabel: "Queue deletes" })
      : Promise.resolve(globalThis.confirm(msg));
    cf.then(function (cok) {
      if (!cok) return;
      fetch(apiQueueDeletesUrl(currentScope.kind, currentScope.id), {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ config_entry_ids: ids }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, body: j, status: r.status };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          let d = res.body && res.body.detail;
          let err = typeof d === "string" ? d : JSON.stringify(d || "");
          if (typeof globalThis.gcGlobalBannerShowResult === "function") {
            globalThis.gcGlobalBannerShowResult(false, err || "Could not queue deletes.");
          } else {
            window.gcAlert(err || "Could not queue deletes.");
          }
          return;
        }
        let b = res.body || {};
        let q = b.queued_count != null ? b.queued_count : 0;
        let sk = b.skipped || [];
        let parts = [];
        if (q > 0) parts.push("Queued " + q + " task(s).");
        if (sk.length)
          parts.push(
            sk.length +
              " not queued" +
              (q > 0 ? " (unsupported or invalid for this firewall)" : "") +
              "."
          );
        if (!parts.length) parts.push("Nothing was queued.");
        if (typeof globalThis.gcGlobalBannerShowResult === "function") {
          globalThis.gcGlobalBannerShowResult(q > 0, parts.join(" "));
        }
        if (statusEl) {
          if (sk.length) {
            statusEl.hidden = false;
            statusEl.textContent =
              "Not queued: " +
              sk
                .slice(0, 6)
                .map(function (x) {
                  return "#" + x.config_entry_id + ": " + (x.reason || "");
                })
                .join("; ") +
              (sk.length > 6 ? "…" : "");
          } else if (q > 0) {
            statusEl.hidden = true;
            statusEl.textContent = "";
          }
        }
        try {
          document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
        } catch (e) {}
        fetchAndRenderTree();
      })
      .catch(function () {
        if (typeof globalThis.gcGlobalBannerShowResult === "function") {
          globalThis.gcGlobalBannerShowResult(false, "Network error while queueing deletes.");
        } else {
          window.gcAlert("Network error while queueing deletes.");
        }
      });
    });
  }

  function configViewerSyncBannerMessage(res) {
    let body = res.body || {};
    if (res.status === 404) return { ok: false, text: "Firewall not found." };
    if (res.status === 202 && body.accepted) {
      return {
        ok: true,
        text:
          "Configuration sync started in the background. You can keep navigating; refresh this list when it finishes.",
      };
    }
    if (body.skipped) return { ok: false, text: body.message || "Nothing selected." };
    if (body.ok) {
      let a = body.added || 0;
      let c = body.changed || 0;
      let d = body.deleted || 0;
      if (a + c + d === 0) return { ok: true, text: "Sync finished — no changes." };
      return {
        ok: true,
        text: "Sync finished — " + a + " added, " + c + " updated, " + d + " removed.",
      };
    }
    return { ok: false, text: body.error || body.detail || "Sync failed." };
  }

  function runScopeSync(entityTypes, busyBtn) {
    getEls();
    if (
      !currentScope ||
      currentScope.kind !== "firewall" ||
      !currentScope.configSyncUrl ||
      !entityTypes ||
      !entityTypes.length
    ) {
      return;
    }
    let n = entityTypes.length;
    let scopeMsg =
      "Start configuration sync for " +
      n +
      " object type" +
      (n === 1 ? "" : "s") +
      " in this scope?";
    let cf2 = window.gcConfirm
      ? window.gcConfirm(scopeMsg, { confirmLabel: "Sync" })
      : Promise.resolve(globalThis.confirm(scopeMsg));
    cf2.then(function (sok) {
      if (!sok) return;
      let batch =
        typeof globalThis.gcGlobalBannerSyncBegin === "function" &&
        typeof globalThis.gcGlobalBannerSyncEnd === "function";
      let bid = batch ? globalThis.gcGlobalBannerSyncBegin("Syncing configuration cache from the firewall…") : 0;
      if (busyBtn) {
        busyBtn.disabled = true;
        busyBtn.classList.add("btn-icon--busy");
      }
      fetch(currentScope.configSyncUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Requested-With": "Ground-Control",
      },
      body: JSON.stringify({ entities: entityTypes }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, status: r.status, body: j };
        });
      })
      .then(function (res) {
        if (busyBtn) {
          busyBtn.disabled = false;
          busyBtn.classList.remove("btn-icon--busy");
        }
        let body = res.body || {};
        let msg = configViewerSyncBannerMessage(res);
        if (res.status === 202 && body.accepted) {
          if (typeof globalThis.gcGlobalBannerTrackBackgroundSync === "function") {
            globalThis.gcGlobalBannerTrackBackgroundSync(msg.text);
          } else if (batch) {
            globalThis.gcGlobalBannerSyncEnd(bid, true, msg.text);
          } else if (typeof globalThis.gcGlobalBannerShowResult === "function") {
            globalThis.gcGlobalBannerShowResult(true, msg.text);
          }
        } else {
          if (batch) globalThis.gcGlobalBannerSyncEnd(bid, msg.ok, msg.text);
          else if (typeof globalThis.gcGlobalBannerShowResult === "function") {
            globalThis.gcGlobalBannerShowResult(msg.ok, msg.text);
          }
          if (msg.ok && !body.skipped && res.status !== 202) {
            try {
              let fid = parseInt(currentScope.id, 10);
              if (!isNaN(fid)) {
                document.dispatchEvent(
                  new CustomEvent("gc-config-cache-synced", { detail: { firewall_ids: [fid] } }),
                );
              }
            } catch (e) {}
          }
        }
        fetchAndRenderTree();
      })
      .catch(function () {
        if (busyBtn) {
          busyBtn.disabled = false;
          busyBtn.classList.remove("btn-icon--busy");
        }
        if (batch) globalThis.gcGlobalBannerSyncEnd(bid, false, "Request failed.");
        else if (typeof globalThis.gcGlobalBannerShowResult === "function") {
          globalThis.gcGlobalBannerShowResult(false, "Request failed.");
        }
      });
    });
  }

  function openEntryDetail(entryId) {
    getEls();
    if (!currentScope || !detailModal || !detailBodyEl || !detailTitleEl || !detailMetaEl) return;
    detailTitleEl.textContent = "Loading…";
    detailMetaEl.textContent = "";
    detailBodyEl.innerHTML = '<p class="muted">Loading…</p>';
    showModal(detailModal);

    let url = apiEntryUrl(currentScope.kind, currentScope.id, entryId);
    fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, body: j, status: r.status };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          let d = res.body && res.body.detail;
          let msg = typeof d === "string" ? d : JSON.stringify(d || res.body || "");
          detailTitleEl.textContent = "Could not load object";
          detailMetaEl.textContent = "";
          detailBodyEl.innerHTML =
            '<p class="gc-config-viewer-modal__status gc-config-viewer-modal__status--err">' +
            escapeHtml(String(msg || "Error " + res.status)) +
            "</p>";
          return;
        }
        let b = res.body;
        let et = b.entity_type || "";
        let name = b.external_name != null ? String(b.external_name) : "";
        detailTitleEl.textContent = name || "(unnamed)";
        detailMetaEl.textContent = et ? "Type: " + et : "";
        let pre = document.createElement("pre");
        pre.className = "gc-cv-json-pre mono";
        if (b.payload != null) {
          pre.textContent = JSON.stringify(b.payload, null, 2);
        } else if (b.payload_raw != null) {
          pre.textContent = String(b.payload_raw);
        } else {
          pre.textContent = "{}";
        }
        detailBodyEl.innerHTML = "";
        detailBodyEl.appendChild(pre);
      })
      .catch(function () {
        detailTitleEl.textContent = "Could not load object";
        detailMetaEl.textContent = "";
        detailBodyEl.innerHTML =
          '<p class="gc-config-viewer-modal__status gc-config-viewer-modal__status--err">Request failed.</p>';
      });
  }

  function openViewer(kind, scopeId, label) {
    getEls();
    if (!rootModal || !treeEl || !titleEl || !metaEl || !statusEl) return;
    let lid = label != null && String(label).trim() ? String(label).trim() : kind + " #" + scopeId;
    currentScope = {
      kind: kind,
      id: String(scopeId),
      label: lid,
      allowDelete: false,
      configSyncUrl: null,
    };
    titleEl.textContent = "Config viewer — " + lid;
    metaEl.textContent = "";
    statusEl.hidden = true;
    statusEl.textContent = "";
    showModal(rootModal);
    fetchAndRenderTree();
  }

  function onTreeClick(e) {
    if (!treeEl || !treeEl.contains(e.target)) return;
    let delBtn = e.target.closest && e.target.closest(".gc-cv-queue-delete");
    if (delBtn && treeEl.contains(delBtn)) {
      e.preventDefault();
      e.stopPropagation();
      let raw = delBtn.dataset.gcCvDeleteIds;
      if (!raw) return;
      let ids;
      try {
        ids = JSON.parse(raw);
      } catch (err) {
        return;
      }
      if (!Array.isArray(ids) || !ids.length) return;
      queueDeletesForIds(ids);
      return;
    }
    let syncBtn = e.target.closest && e.target.closest(".gc-cv-scope-sync");
    if (syncBtn && treeEl.contains(syncBtn)) {
      e.preventDefault();
      e.stopPropagation();
      let sraw = syncBtn.dataset.gcCvSyncEntities;
      if (!sraw) return;
      let ets;
      try {
        ets = JSON.parse(sraw);
      } catch (err2) {
        return;
      }
      if (!Array.isArray(ets) || !ets.length) return;
      runScopeSync(ets, syncBtn);
      return;
    }
    let btn = e.target.closest && e.target.closest("[data-gc-cv-entry]");
    if (!btn || !treeEl.contains(btn)) return;
    let eid = btn.dataset.gcCvEntry;
    if (!eid) return;
    e.preventDefault();
    e.stopPropagation();
    openEntryDetail(eid);
  }

  function onDocClick(e) {
    let opener = e.target && e.target.closest && e.target.closest(".gc-config-viewer-open");
    if (opener) {
      e.preventDefault();
      e.stopPropagation();
      let kind = opener.dataset.gcCvKind;
      let sid = opener.dataset.gcCvScopeId;
      let lbl = opener.dataset.gcCvLabel || "";
      if (!kind || !sid) return;
      openViewer(kind, sid, lbl);
      return;
    }
    getEls();
    if (
      detailModal &&
      !detailModal.hidden &&
      e.target &&
      e.target.closest &&
      e.target.closest("#gc-config-viewer-detail-modal .task-queue-compare-modal__backdrop")
    ) {
      closeDetail();
      return;
    }
    if (
      rootModal &&
      !rootModal.hidden &&
      e.target &&
      e.target.closest &&
      e.target.closest("#gc-config-viewer-modal .task-queue-compare-modal__backdrop")
    ) {
      closeViewer();
    }
  }

  function onKeydown(e) {
    if (e.key !== "Escape") return;
    getEls();
    if (detailModal && !detailModal.hidden) {
      closeDetail();
      e.preventDefault();
      return;
    }
    if (rootModal && !rootModal.hidden) {
      closeViewer();
      e.preventDefault();
    }
  }

  function bindChrome() {
    getEls();
    let c1 = document.getElementById("gc-config-viewer-close");
    let c2 = document.getElementById("gc-config-viewer-detail-close");
    if (c1) c1.addEventListener("click", closeViewer);
    if (c2) c2.addEventListener("click", closeDetail);
    if (treeEl) treeEl.addEventListener("click", onTreeClick, true);
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKeydown, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindChrome);
  } else {
    bindChrome();
  }

  globalThis.gcOpenConfigViewer = openViewer;
})();
