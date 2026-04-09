/**
 * Firewalls · Administration · Netflow — table + Configure Netflow flyout (queue save / clear batch).
 */
(function () {
  "use strict";

  var URL_TABLE = window.GC_NETFLOW_TABLE_URL || "";
  var URL_UPDATE = window.GC_NETFLOW_ENQUEUE_UPDATE_URL || "";
  var DEFAULT_PORT = "2055";

  var flyoutRoot = null;
  var flyoutFw = null;
  var flyoutForm = null;
  var flyoutTbody = null;
  var tableNetflow = null;
  var currentFirewallId = null;
  /** @type {number|null} */
  var lastConfigureFirewallId = null;

  function mainTbody() {
    return document.getElementById("gc-netflow-tbody");
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function bannerResult(ok, msg) {
    if (typeof globalThis.gcGlobalBannerShowResult === "function") {
      globalThis.gcGlobalBannerShowResult(ok, msg);
    } else {
      try {
        alert(msg);
      } catch (e0) {}
    }
  }

  function dispatchTaskQueueUpdated() {
    try {
      document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
    } catch (e1) {}
  }

  function syncBodyFlyoutClass() {
    var open = !!document.querySelector(".gc-if-flyout:not([hidden])");
    document.body.classList.toggle("gc-if-flyout--open", open);
  }

  function closeFlyout() {
    if (!flyoutRoot) return;
    flyoutRoot.hidden = true;
    flyoutRoot.setAttribute("aria-hidden", "true");
    currentFirewallId = null;
    syncBodyFlyoutClass();
  }

  function openFlyout() {
    if (!flyoutRoot) return;
    flyoutRoot.hidden = false;
    flyoutRoot.setAttribute("aria-hidden", "false");
    syncBodyFlyoutClass();
    var panel = flyoutRoot.querySelector(".gc-if-flyout__panel");
    if (panel) {
      try {
        panel.focus();
      } catch (e2) {}
    }
  }

  function rowInputs(tr) {
    return {
      name: tr.querySelector('input[data-gc-netflow-field="name"]'),
      host: tr.querySelector('input[data-gc-netflow-field="host"]'),
      port: tr.querySelector('input[data-gc-netflow-field="port"]'),
    };
  }

  function rowHasUserData(tr) {
    var i = rowInputs(tr);
    return !!(
      (i.name && String(i.name.value || "").trim()) ||
      (i.host && String(i.host.value || "").trim())
    );
  }

  function createServerRow(initial) {
    initial = initial || {};
    var tr = document.createElement("tr");
    tr.className = "gc-netflow-server-row";
    var n0 = esc(initial.ServerName || initial.Name || "");
    var h0 = esc(initial.NetflowServer || "");
    var p0 = esc(initial.NetflowServerPort || DEFAULT_PORT) || DEFAULT_PORT;
    tr.innerHTML =
      '<td><input type="text" class="gc-if-flyout__input" data-gc-netflow-field="name" value="' +
      n0 +
      '" autocomplete="off" aria-label="Server name" /></td>' +
      '<td><input type="text" class="gc-if-flyout__input mono" data-gc-netflow-field="host" value="' +
      h0 +
      '" autocomplete="off" aria-label="Server IP or domain" /></td>' +
      '<td><input type="text" class="gc-if-flyout__input mono" data-gc-netflow-field="port" value="' +
      p0 +
      '" inputmode="numeric" autocomplete="off" aria-label="Server port" /></td>' +
      '<td class="gc-netflow-servers-table__actions">' +
      '<button type="button" class="gc-netflow-row-remove" aria-label="Remove row" title="Remove row">\u2212</button>' +
      "</td>";

    var rm = tr.querySelector(".gc-netflow-row-remove");
    if (rm) {
      rm.addEventListener("click", function () {
        tr.remove();
        ensureTrailingBlank();
      });
    }
    tr.querySelectorAll("input").forEach(function (inp) {
      inp.addEventListener("input", onFlyoutTbodyInput);
      inp.addEventListener("change", onFlyoutTbodyInput);
    });
    return tr;
  }

  function ensureTrailingBlank() {
    if (!flyoutTbody) return;
    var rows = flyoutTbody.querySelectorAll("tr.gc-netflow-server-row");
    if (!rows.length) {
      flyoutTbody.appendChild(createServerRow({}));
      return;
    }
    var last = rows[rows.length - 1];
    if (rowHasUserData(last)) {
      flyoutTbody.appendChild(createServerRow({}));
    }
  }

  function onFlyoutTbodyInput() {
    ensureTrailingBlank();
  }

  function renderFlyoutServers(servers) {
    if (!flyoutTbody) return;
    flyoutTbody.innerHTML = "";
    var list = Array.isArray(servers) ? servers : [];
    list.forEach(function (s) {
      flyoutTbody.appendChild(createServerRow(s || {}));
    });
    flyoutTbody.appendChild(createServerRow({}));
  }

  function collectServersFromFlyout() {
    if (!flyoutTbody) return [];
    var out = [];
    flyoutTbody.querySelectorAll("tr.gc-netflow-server-row").forEach(function (tr) {
      var i = rowInputs(tr);
      var name = i.name ? String(i.name.value || "").trim() : "";
      var host = i.host ? String(i.host.value || "").trim() : "";
      var port = i.port ? String(i.port.value || "").trim() : "";
      if (!port) port = DEFAULT_PORT;
      if (!name && !host) return;
      out.push({
        ServerName: name,
        NetflowServer: host,
        NetflowServerPort: port,
      });
    });
    return out;
  }

  function openFlyoutFromRow(row) {
    if (!flyoutRoot || !row || row.firewall_id == null) return;
    currentFirewallId = parseInt(String(row.firewall_id), 10);
    if (isNaN(currentFirewallId) || currentFirewallId < 1) return;
    var lab = row.cells && row.cells.__name != null ? String(row.cells.__name).trim() : "";
    if (flyoutFw) {
      flyoutFw.textContent = lab ? "Firewall: " + lab : "Firewall #" + currentFirewallId;
    }
    renderFlyoutServers(row.netflow_servers);
    openFlyout();
  }

  function mainRowPayloadByFirewallId(fid) {
    var tb = mainTbody();
    if (!tb || fid == null) return null;
    var n = parseInt(String(fid), 10);
    if (isNaN(n) || n < 1) return null;
    var trs = tb.querySelectorAll("tr.gc-netflow-data-row");
    for (var i = 0; i < trs.length; i++) {
      var tr = trs[i];
      if (!tr._gcNetRow || tr._gcNetRow.firewall_id == null) continue;
      var r = parseInt(String(tr._gcNetRow.firewall_id), 10);
      if (r === n) return tr._gcNetRow;
    }
    return null;
  }

  function syncConfigureButton() {
    var addBtn = document.getElementById("gc-netflow-configure");
    if (!addBtn) return;
    var row =
      lastConfigureFirewallId != null ? mainRowPayloadByFirewallId(lastConfigureFirewallId) : null;
    addBtn.disabled = !row;
  }

  function bindConfigureButton() {
    var addBtn = document.getElementById("gc-netflow-configure");
    if (addBtn && !addBtn._gcNetflowBound) {
      addBtn._gcNetflowBound = true;
      addBtn.addEventListener("click", function () {
        var row =
          lastConfigureFirewallId != null ? mainRowPayloadByFirewallId(lastConfigureFirewallId) : null;
        if (row) openFlyoutFromRow(row);
      });
    }
  }

  function bindFlyoutOnce() {
    if (!flyoutRoot) return;
    var btn = document.getElementById("gc-netflow-flyout-cancel");
    if (btn && !btn._gcNetflowBound) {
      btn._gcNetflowBound = true;
      btn.addEventListener("click", closeFlyout);
    }
    var bd = flyoutRoot.querySelector(".gc-if-flyout__backdrop");
    if (bd && !bd._gcNetflowBound) {
      bd._gcNetflowBound = true;
      bd.addEventListener("click", closeFlyout);
    }
    if (flyoutForm && !flyoutForm._gcNetflowBound) {
      flyoutForm._gcNetflowBound = true;
      flyoutForm.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!URL_UPDATE || currentFirewallId == null) return;
        var servers = collectServersFromFlyout();
        fetch(URL_UPDATE, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "Ground-Control",
          },
          body: JSON.stringify({ firewall_id: currentFirewallId, servers: servers }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, body: j };
            });
          })
          .then(function (res) {
            if (res.ok && res.body && res.body.ok) {
              if (res.body.task_id) {
                bannerResult(true, "Queued Netflow configuration update.");
                dispatchTaskQueueUpdated();
              } else {
                bannerResult(true, "No changes to queue (already matches cache).");
              }
              closeFlyout();
              if (tableNetflow && tableNetflow.refresh) tableNetflow.refresh();
            } else {
              var err =
                (res.body && (res.body.detail || res.body.error)) || "Could not queue update.";
              bannerResult(false, typeof err === "string" ? err : JSON.stringify(err));
            }
          })
          .catch(function () {
            bannerResult(false, "Request failed.");
          });
      });
    }
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (flyoutRoot && !flyoutRoot.hidden) {
      closeFlyout();
      e.preventDefault();
    }
  });

  function init() {
    if (!URL_TABLE || typeof globalThis.gcCreateNetworkEntityTable !== "function") return;
    flyoutRoot = document.getElementById("gc-netflow-flyout");
    flyoutFw = document.getElementById("gc-netflow-flyout-fw");
    flyoutForm = document.getElementById("gc-netflow-flyout-form");
    flyoutTbody = document.getElementById("gc-netflow-flyout-tbody");
    bindFlyoutOnce();
    bindConfigureButton();

    var addBtn = document.getElementById("gc-netflow-configure");
    if (addBtn) addBtn.disabled = true;

    tableNetflow = globalThis.gcCreateNetworkEntityTable({
      prefix: "gc-netflow",
      apiUrl: URL_TABLE,
      emptySelectionMessage: "Select one or more firewalls in the top bar.",
      lsKey: "ground-control-netflow-columns-v1",
      dataRowClass: "gc-netflow-data-row",
      colPickerAttr: "data-gc-netflow-col",
      pageSyncFallbackEntities: ["netflow_configuration"],
      bulkRowSelect: false,
      rowClickable: true,
      onRowClick: function (tr) {
        var row = tr && tr._gcNetRow;
        if (!row) return;
        if (row.firewall_id != null) {
          lastConfigureFirewallId = parseInt(String(row.firewall_id), 10);
          if (isNaN(lastConfigureFirewallId) || lastConfigureFirewallId < 1) {
            lastConfigureFirewallId = null;
          }
        } else {
          lastConfigureFirewallId = null;
        }
        syncConfigureButton();
        openFlyoutFromRow(row);
      },
      afterRenderFromApi: function () {
        syncConfigureButton();
      },
      labels: {
        countSingular: "firewall",
        countPlural: "firewalls",
        emptyCache: "No firewalls match the current selection.",
        emptyFilter: "No rows match the current search or filters.",
        loadError: "Could not load Netflow configuration.",
      },
    });

    document.addEventListener("gc-firewall-selection-changed", function () {
      if (tableNetflow && tableNetflow.refresh) tableNetflow.refresh();
    });
    if (typeof globalThis.gcRegisterConfigCacheTableRefresher === "function") {
      globalThis.gcRegisterConfigCacheTableRefresher(function (ids) {
        if (!ids || !ids.length || !tableNetflow || typeof tableNetflow.refresh !== "function") return;
        var sel =
          typeof globalThis.gcGetSelectedFirewallIds === "function"
            ? globalThis.gcGetSelectedFirewallIds()
            : [];
        if (!sel || !sel.length) return;
        var set = {};
        sel.forEach(function (id) {
          set[Number(id)] = true;
        });
        if (ids.some(function (id) {
          return set[Number(id)];
        }))
          tableNetflow.refresh();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
