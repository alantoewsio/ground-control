/**
 * Firewalls · Profiles — policy entity tables (schedules, quotas, VPN) + tab UI.
 */
(function () {
  "use strict";

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

  function firewallScopeIds() {
    let base = [];
    if (typeof globalThis.gcGetSelectedFirewallIds === "function") {
      try {
        base = globalThis.gcGetSelectedFirewallIds() || [];
      } catch (eSel) {
        base = [];
      }
    }
    if (!Array.isArray(base)) base = [];
    if (base.length) return base;
    let inv = globalThis.gcNavFirewallsJson;
    if (!Array.isArray(inv) || !inv.length) return [];
    return inv
      .map(function (x) {
        return x && x.id != null ? Number(x.id) : 0;
      })
      .filter(function (n) {
        return n > 0;
      });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function scopePillForModal(fw) {
    if (typeof globalThis.gcFirewallScopePillHtml === "function") {
      return globalThis.gcFirewallScopePillHtml(fw);
    }
    return esc(fw);
  }

  function modalScalar(val) {
    return '<span class="gc-net-zone-modal__scalar">' + esc(val) + "</span>";
  }

  function buildProfCombineModalHtml(data, tabCfg) {
    let labels = (data && data.column_labels) || {};
    let rows = (data && data.rows) || [];
    let ck = tabCfg.conflictRow;
    let pk = tabCfg.perField;
    let conflictRows = rows.filter(function (r) {
      if (!r) return false;
      let pf = r[pk];
      return r[ck] && pf;
    });
    if (!conflictRows.length) {
      return '<p class="muted">No differing field values for this selection.</p>';
    }
    return conflictRows
      .map(function (row) {
        let hname = (row.cells && row.cells.__name) || "";
        let pf = row[pk] || {};
        let colKeys = Object.keys(pf).sort();
        let parts =
          '<section class="gc-net-zone-modal__zone"><h3 class="gc-net-zone-modal__zn">' +
          esc(hname) +
          "</h3>";
        colKeys.forEach(function (colKey) {
          let lbl = labels[colKey] || colKey;
          parts +=
            '<h4 class="gc-net-zone-modal__col">' + esc(lbl).replace(/\n/g, "<br />") + "</h4>";
          parts += '<ul class="gc-net-zone-modal__fw-list">';
          let per = pf[colKey];
          Object.keys(per)
            .sort()
            .forEach(function (fw) {
              parts +=
                '<li class="gc-net-zone-modal__fw-row">' +
                scopePillForModal(fw) +
                '<span class="gc-net-zone-modal__fw-val">' +
                modalScalar(per[fw]) +
                "</span></li>";
            });
          parts += "</ul>";
        });
        parts += "</section>";
        return parts;
      })
      .join("");
  }

  let lastPayloadByKey = {};
  let tablesByKey = {};

  function updateCombineChrome(tabCfg, data) {
    let wrap = document.getElementById(tabCfg.prefix + "-combine-wrap");
    let inp = document.getElementById(tabCfg.prefix + "-combine");
    if (!wrap || !inp) return;
    let conflicts = !!(data && data[tabCfg.metaConflicts]);
    let flat = !!(data && data[tabCfg.metaCombined] === false);
    wrap.classList.toggle("gc-toolbar-combine--warning", conflicts && !flat && inp.checked);
  }

  function bindCombineForTable(tabCfg, table) {
    let cbx = document.getElementById(tabCfg.prefix + "-combine");
    if (!cbx) return;

    try {
      let vp = localStorage.getItem(tabCfg.lsCombine);
      if (vp === "0") cbx.checked = false;
      else if (vp === "1") cbx.checked = true;
    } catch (eLs) {}

    cbx.addEventListener("change", function () {
      try {
        localStorage.setItem(tabCfg.lsCombine, cbx.checked ? "1" : "0");
      } catch (e2) {}
      if (table.refresh) table.refresh();
    });

    let modal = document.getElementById("gc-prof-combine-modal");
    let modalBody = document.getElementById("gc-prof-combine-modal-body");
    let modalTitle = document.getElementById("gc-prof-combine-modal-title");
    let modalClose = document.getElementById("gc-prof-combine-modal-close");
    let modalDone = document.getElementById("gc-prof-combine-modal-done");
    let modalBackdrop = document.getElementById("gc-prof-combine-modal-backdrop");

    function closeModal() {
      if (!modal) return;
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function openModal() {
      let data = lastPayloadByKey[tabCfg.key];
      if (!modal || !modalBody) return;
      if (modalTitle) {
        modalTitle.textContent =
          tabCfg.key === "sched"
            ? "Schedule by firewall"
            : tabCfg.key === "at"
              ? "Access time by firewall"
              : tabCfg.key === "sq"
                ? "Surfing quota by firewall"
                : tabCfg.key === "dt"
                  ? "Network traffic quota by firewall"
                  : "IPsec profile by firewall";
      }
      modalBody.innerHTML = buildProfCombineModalHtml(data, tabCfg);
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    cbx.addEventListener("pointerdown", function (e) {
      let data = lastPayloadByKey[tabCfg.key];
      let conflicts = !!(data && data[tabCfg.metaConflicts]);
      let flat = !!(data && data[tabCfg.metaCombined] === false);
      if (conflicts && !flat && cbx.checked && !e.shiftKey) {
        e.preventDefault();
        openModal();
      }
    });

    if (modalClose) modalClose.addEventListener("click", closeModal);
    if (modalDone) modalDone.addEventListener("click", closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);
  }

  globalThis.gcInitProfilesPolicyEntitiesPage = function (cfg) {
    let urls = (cfg && cfg.urls) || {};
    let tabCfgs = (cfg && cfg.tables) || [];
    let deviceTableHolder = cfg && cfg.deviceTableHolder;

    function refreshAll() {
      tabCfgs.forEach(function (tc) {
        let tb = tablesByKey[tc.key];
        if (tb && tb.refresh) tb.refresh();
      });
      let dt = deviceTableHolder && deviceTableHolder.table;
      if (dt && dt.refresh) dt.refresh();
    }

    document.addEventListener("gc-firewall-selection-changed", refreshAll);

    if (typeof globalThis.gcRegisterConfigCacheTableRefresher === "function") {
      globalThis.gcRegisterConfigCacheTableRefresher(function (ids) {
        if (!ids || !ids.length) return;
        let sel =
          typeof globalThis.gcGetSelectedFirewallIds === "function"
            ? globalThis.gcGetSelectedFirewallIds()
            : [];
        if (!sel || !sel.length) return;
        let set = {};
        sel.forEach(function (id) {
          set[Number(id)] = true;
        });
        let hit = ids.some(function (id) {
          return set[Number(id)];
        });
        if (hit) refreshAll();
      });
    }

    tabCfgs.forEach(function (tabCfg) {
      let tableOpts = {
        prefix: tabCfg.prefix,
        apiUrl: tabCfg.apiUrl,
        apiEntityType: tabCfg.entityType,
        getSelectedIds: firewallScopeIds,
        pageSyncFallbackEntities: [tabCfg.syncEntity],
        lsKey: tabCfg.colLs,
        dataRowClass: tabCfg.prefix + "-data-row",
        colPickerAttr: "data-" + tabCfg.prefix + "-col",
        bulkRowSelect: true,
        rowClickable: true,
        rowAriaEntitySingular: tabCfg.rowAriaEntitySingular,
        combineQuery: { param: "combine" },
        combineSyncSelected: {
          strategy: "profile_create_batch",
          profileCreateBatchUrl: urls.createBatch,
          profileEntityType: tabCfg.entityType,
        },
        onRowClick: function (tr) {
          if (globalThis.gcProfileEntityFlyoutOpenFromTr) {
            globalThis.gcProfileEntityFlyoutOpenFromTr(tr, tabCfg);
          }
        },
        labels: tabCfg.labels,
        afterRenderFromApi: function (data) {
          lastPayloadByKey[tabCfg.key] = data;
          updateCombineChrome(tabCfg, data);
        },
      };
      if (Array.isArray(tabCfg.valuePillColIds) && tabCfg.valuePillColIds.length) {
        tableOpts.valuePillColIds = tabCfg.valuePillColIds;
      }
      let table = globalThis.gcCreateNetworkEntityTable(tableOpts);
      tablesByKey[tabCfg.key] = table;
      bindCombineForTable(tabCfg, table);

      let addBtn = document.getElementById(tabCfg.prefix + "-add");
      if (addBtn) {
        addBtn.addEventListener("click", function () {
          if (typeof globalThis.gcProfileEntityFlyoutOpenCreate === "function") {
            globalThis.gcProfileEntityFlyoutOpenCreate(tabCfg);
          }
        });
      }

      let delBtn = document.getElementById(tabCfg.prefix + "-delete-selected");
      if (delBtn) {
        delBtn.addEventListener("click", function () {
          if (typeof table.getDeleteConfigEntryIdsFromSelection !== "function") return;
          let ids = table.getDeleteConfigEntryIdsFromSelection();
          if (!ids.length) {
            bannerResult(false, "Select one or more rows.");
            return;
          }
          let qMsg = "Queue deletion of " + ids.length + " row(s)?";
          let cf = window.gcConfirm
            ? window.gcConfirm(qMsg, { tone: "danger", confirmLabel: "Queue deletes" })
            : Promise.resolve(globalThis.confirm(qMsg));
          cf.then(function (ok) {
            if (!ok) return;
            delBtn.disabled = true;
            fetch(urls.deleteBatch, {
              method: "POST",
              credentials: "same-origin",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-Requested-With": "Ground-Control",
              },
              body: JSON.stringify({ config_entry_ids: ids }),
            })
              .then(function (r) {
                return r.json().then(function (j) {
                  return { ok: r.ok, j: j };
                });
              })
              .then(function (x) {
                delBtn.disabled = false;
                if (!x.ok) {
                  let em = (x.j && (x.j.detail || x.j.message)) || "Could not queue.";
                  bannerResult(false, typeof em === "string" ? em : JSON.stringify(em));
                  return;
                }
                bannerResult(true, "Delete tasks queued.");
                dispatchTaskQueueUpdated();
                if (table.refresh) table.refresh();
              })
              .catch(function () {
                delBtn.disabled = false;
                bannerResult(false, "Network error.");
              });
          });
        });
      }
    });

    if (typeof globalThis.gcProfileEntityFlyoutInit === "function") {
      try {
        globalThis.gcProfileEntityFlyoutInit({
          urls: urls,
          onSaved: function () {
            refreshAll();
          },
        });
      } catch (eFly) {
        try {
          console.error("gcProfileEntityFlyoutInit failed", eFly);
        } catch (eLog) {}
      }
    }

    tabCfgs.forEach(function (tc) {
      let tb = tablesByKey[tc.key];
      if (tb && typeof tb.refresh === "function") {
        try {
          tb.refresh();
        } catch (eRf) {
          try {
            console.error("Profiles table refresh failed", tc.key, eRf);
          } catch (eLog) {}
        }
      }
    });
  };
})();
