/**
 * Firewalls · Profiles — policy entity tables (schedules, quotas, VPN) + tab UI.
 */
(function () {
  "use strict";

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

  function firewallScopeIds() {
    var base = [];
    if (typeof window.gcGetSelectedFirewallIds === "function") {
      try {
        base = window.gcGetSelectedFirewallIds() || [];
      } catch (eSel) {
        base = [];
      }
    }
    if (!Array.isArray(base)) base = [];
    if (base.length) return base;
    var inv = window.gcNavFirewallsJson;
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
    if (typeof window.gcFirewallScopePillHtml === "function") {
      return window.gcFirewallScopePillHtml(fw);
    }
    return esc(fw);
  }

  function modalScalar(val) {
    return '<span class="gc-net-zone-modal__scalar">' + esc(val) + "</span>";
  }

  function buildProfCombineModalHtml(data, tabCfg) {
    var labels = (data && data.column_labels) || {};
    var rows = (data && data.rows) || [];
    var ck = tabCfg.conflictRow;
    var pk = tabCfg.perField;
    var conflictRows = rows.filter(function (r) {
      if (!r) return false;
      var pf = r[pk];
      return r[ck] && pf;
    });
    if (!conflictRows.length) {
      return '<p class="muted">No differing field values for this selection.</p>';
    }
    return conflictRows
      .map(function (row) {
        var hname = (row.cells && row.cells.__name) || "";
        var pf = row[pk] || {};
        var colKeys = Object.keys(pf).sort();
        var parts =
          '<section class="gc-net-zone-modal__zone"><h3 class="gc-net-zone-modal__zn">' +
          esc(hname) +
          "</h3>";
        colKeys.forEach(function (colKey) {
          var lbl = labels[colKey] || colKey;
          parts +=
            '<h4 class="gc-net-zone-modal__col">' + esc(lbl).replace(/\n/g, "<br />") + "</h4>";
          parts += '<ul class="gc-net-zone-modal__fw-list">';
          var per = pf[colKey];
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

  var lastPayloadByKey = {};
  var tablesByKey = {};

  function updateCombineChrome(tabCfg, data) {
    var wrap = document.getElementById(tabCfg.prefix + "-combine-wrap");
    var inp = document.getElementById(tabCfg.prefix + "-combine");
    if (!wrap || !inp) return;
    var conflicts = !!(data && data[tabCfg.metaConflicts]);
    var flat = !!(data && data[tabCfg.metaCombined] === false);
    wrap.classList.toggle("gc-toolbar-combine--warning", conflicts && !flat && inp.checked);
  }

  function bindCombineForTable(tabCfg, table) {
    var cbx = document.getElementById(tabCfg.prefix + "-combine");
    if (!cbx) return;

    try {
      var vp = localStorage.getItem(tabCfg.lsCombine);
      if (vp === "0") cbx.checked = false;
      else if (vp === "1") cbx.checked = true;
    } catch (eLs) {}

    cbx.addEventListener("change", function () {
      try {
        localStorage.setItem(tabCfg.lsCombine, cbx.checked ? "1" : "0");
      } catch (e2) {}
      if (table.refresh) table.refresh();
    });

    var modal = document.getElementById("gc-prof-combine-modal");
    var modalBody = document.getElementById("gc-prof-combine-modal-body");
    var modalTitle = document.getElementById("gc-prof-combine-modal-title");
    var modalClose = document.getElementById("gc-prof-combine-modal-close");
    var modalDone = document.getElementById("gc-prof-combine-modal-done");
    var modalBackdrop = document.getElementById("gc-prof-combine-modal-backdrop");

    function closeModal() {
      if (!modal) return;
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function openModal() {
      var data = lastPayloadByKey[tabCfg.key];
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
      var data = lastPayloadByKey[tabCfg.key];
      var conflicts = !!(data && data[tabCfg.metaConflicts]);
      var flat = !!(data && data[tabCfg.metaCombined] === false);
      if (conflicts && !flat && cbx.checked && !e.shiftKey) {
        e.preventDefault();
        openModal();
      }
    });

    if (modalClose) modalClose.addEventListener("click", closeModal);
    if (modalDone) modalDone.addEventListener("click", closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);
  }

  window.gcInitProfilesPolicyEntitiesPage = function (cfg) {
    var urls = (cfg && cfg.urls) || {};
    var tabCfgs = (cfg && cfg.tables) || [];
    var deviceTableHolder = cfg && cfg.deviceTableHolder;

    function refreshAll() {
      tabCfgs.forEach(function (tc) {
        var tb = tablesByKey[tc.key];
        if (tb && tb.refresh) tb.refresh();
      });
      var dt = deviceTableHolder && deviceTableHolder.table;
      if (dt && dt.refresh) dt.refresh();
    }

    document.addEventListener("gc-firewall-selection-changed", refreshAll);

    if (typeof window.gcRegisterConfigCacheTableRefresher === "function") {
      window.gcRegisterConfigCacheTableRefresher(function (ids) {
        if (!ids || !ids.length) return;
        var sel =
          typeof window.gcGetSelectedFirewallIds === "function"
            ? window.gcGetSelectedFirewallIds()
            : [];
        if (!sel || !sel.length) return;
        var set = {};
        sel.forEach(function (id) {
          set[Number(id)] = true;
        });
        var hit = ids.some(function (id) {
          return set[Number(id)];
        });
        if (hit) refreshAll();
      });
    }

    tabCfgs.forEach(function (tabCfg) {
      var tableOpts = {
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
          if (window.gcProfileEntityFlyoutOpenFromTr) {
            window.gcProfileEntityFlyoutOpenFromTr(tr, tabCfg);
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
      var table = window.gcCreateNetworkEntityTable(tableOpts);
      tablesByKey[tabCfg.key] = table;
      bindCombineForTable(tabCfg, table);

      var addBtn = document.getElementById(tabCfg.prefix + "-add");
      if (addBtn) {
        addBtn.addEventListener("click", function () {
          if (typeof window.gcProfileEntityFlyoutOpenCreate === "function") {
            window.gcProfileEntityFlyoutOpenCreate(tabCfg);
          }
        });
      }

      var delBtn = document.getElementById(tabCfg.prefix + "-delete-selected");
      if (delBtn) {
        delBtn.addEventListener("click", function () {
          if (typeof table.getDeleteConfigEntryIdsFromSelection !== "function") return;
          var ids = table.getDeleteConfigEntryIdsFromSelection();
          if (!ids.length) {
            bannerResult(false, "Select one or more rows.");
            return;
          }
          if (!window.confirm("Queue deletion of " + ids.length + " row(s)?")) return;
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
                var em = (x.j && (x.j.detail || x.j.message)) || "Could not queue.";
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
      }
    });

    if (typeof window.gcProfileEntityFlyoutInit === "function") {
      try {
        window.gcProfileEntityFlyoutInit({
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
      var tb = tablesByKey[tc.key];
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
