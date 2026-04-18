/**
 * Shared bootstrap for the Configurations and Firewalls "Routing" pages.
 *
 * Both templates render the same four-tab layout (unicast IPv4 / IPv6 routes,
 * gateways, custom gateways) over the same backend with only a few wiring
 * differences (prefix, target, fetch URLs, event names, delete endpoint and
 * confirmation copy). The page templates call gcRoutingPageInit() with the
 * appropriate configuration object so all the shared logic lives here.
 */
(function () {
  function _selectedIds(getter) {
    return typeof getter === "function" ? getter() || [] : [];
  }

  function _showBanner(el, hideAfterMs) {
    if (!el) return;
    el.hidden = false;
    clearTimeout(el._gcRtHideTimer);
    el._gcRtHideTimer = setTimeout(function () {
      el.hidden = true;
    }, hideAfterMs || 4000);
  }

  function _familyMatches(row, want) {
    if (!want) return true;
    var f = (row && row.flat) || {};
    var v = f.IPFamily || f.ip_family || "";
    v = String(v).trim().toUpperCase();
    if (!v) v = "IPV4";
    return v === String(want).toUpperCase();
  }

  /**
   * Initialise a routing page.
   *
   * @param {Object}   cfg
   * @param {string}   cfg.prefix              DOM id prefix (e.g. "gc-rt").
   * @param {string}   cfg.tablistId           id of the main tablist element.
   * @param {string}   cfg.tabDataAttr         data-attr name on each tab button.
   * @param {string}   cfg.lsKey               localStorage key for active tab.
   * @param {string}   cfg.lsColsPrefix        localStorage prefix for col layout.
   * @param {string}   cfg.apiBase             base URL for the entity table.
   * @param {string}   cfg.target              "configuration" or "firewall".
   * @param {string}   cfg.deleteUrl           batch delete/enqueue endpoint.
   * @param {string}   cfg.emptySelectionMsg   shown when no parents selected.
   * @param {Function} cfg.deleteConfirmMsg    fn(count, plural) -> string.
   * @param {string[]} cfg.refreshEvents       events that trigger table refresh.
   * @param {string}   cfg.entriesUpdatedEvent event dispatched after delete.
   * @param {Function} cfg.getSelectedIds      returns selected parent ids (array).
   * @param {string}   cfg.bannerId            id of the no-selection banner.
   * @param {Function} cfg.buildEmptyCache     fn(countPlural) -> empty-cache message.
   * @param {Function=} cfg.afterFetchUrl      optional URL transform per request.
   */
  function gcRoutingPageInit(cfg) {
    var TAB_DEFS = [
      {
        key: "unicast_route_v4",
        prefix: cfg.prefix + "-unicast-route-v4",
        apiEntity: "unicast_route",
        family: "IPv4",
        aria: "IPv4 unicast route",
        countS: "IPv4 unicast route",
        countP: "IPv4 unicast routes",
      },
      {
        key: "unicast_route_v6",
        prefix: cfg.prefix + "-unicast-route-v6",
        apiEntity: "unicast_route",
        family: "IPv6",
        aria: "IPv6 unicast route",
        countS: "IPv6 unicast route",
        countP: "IPv6 unicast routes",
      },
      {
        key: "gateway",
        prefix: cfg.prefix + "-gateway",
        apiEntity: "gateway",
        aria: "gateway",
        countS: "gateway",
        countP: "gateways",
      },
      {
        key: "gateway_host",
        prefix: cfg.prefix + "-gateway-host",
        apiEntity: "gateway_host",
        aria: "custom gateway",
        countS: "custom gateway",
        countP: "custom gateways",
      },
    ];

    function readSavedTab() {
      try {
        var raw = localStorage.getItem(cfg.lsKey);
        if (raw && TAB_DEFS.some(function (t) { return t.key === raw; })) return raw;
      } catch (e) { /* ignore storage failures */ }
      return TAB_DEFS[0].key;
    }

    var activeKey = readSavedTab();
    var mainTablist = document.getElementById(cfg.tablistId);
    var dataSelector = ":scope > .gc-tabs__tab[" + cfg.tabDataAttr + "]";
    var mainTabs = mainTablist ? mainTablist.querySelectorAll(dataSelector) : [];
    var mainPanels = {};
    TAB_DEFS.forEach(function (t) {
      var slug = t.key.replace(/_/g, "-");
      mainPanels[t.key] = document.getElementById(cfg.prefix + "-panel-" + slug);
    });

    function syncFilterAsidesVisibility() {
      TAB_DEFS.forEach(function (t) {
        var el = document.getElementById(t.prefix + "-filters-aside");
        if (el) el.hidden = t.key !== activeKey;
      });
    }
    function applyMainTabPanels() {
      TAB_DEFS.forEach(function (t) {
        var p = mainPanels[t.key];
        if (!p) return;
        var show = t.key === activeKey;
        p.classList.toggle("is-active", show);
        p.hidden = !show;
      });
    }
    function syncMainTabButtons() {
      mainTabs.forEach(function (btn) {
        var on = btn.getAttribute(cfg.tabDataAttr) === activeKey;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
    }

    var tables = {};
    function refreshAllTables() {
      TAB_DEFS.forEach(function (t) { if (tables[t.key]) tables[t.key].refresh(); });
    }
    (cfg.refreshEvents || []).forEach(function (evt) {
      document.addEventListener(evt, refreshAllTables);
    });
    if (cfg.target === "firewall" && typeof window.gcRegisterConfigCacheTableRefresher === "function") {
      window.gcRegisterConfigCacheTableRefresher(function () { refreshAllTables(); });
    }

    function buildFetchUrl(t, ctx) {
      var ids = cfg.target === "configuration"
        ? (ctx && ctx.configurationIds) || []
        : (ctx && ctx.firewallIds) || [];
      var url = cfg.apiBase + "?" + ctx.idsQueryParam + "=" + encodeURIComponent(ids.join(","));
      if (cfg.target === "firewall"
        && ctx.idsQueryParam !== "configuration_ids"
        && ctx.configurationIds && ctx.configurationIds.length) {
        url += "&configuration_ids=" + encodeURIComponent(ctx.configurationIds.join(","));
      }
      url += "&entity_type=" + encodeURIComponent(t.apiEntity);
      var combineEl = document.getElementById(t.prefix + "-combine-toggle");
      var combinedOn = !combineEl || combineEl.checked;
      url += "&combine=" + (combinedOn ? "true" : "false");
      return typeof cfg.afterFetchUrl === "function" ? cfg.afterFetchUrl(url, t, ctx) : url;
    }

    TAB_DEFS.forEach(function (t) {
      var tableCfg = {
        prefix: t.prefix,
        apiUrl: cfg.apiBase,
        emptySelectionMessage: cfg.emptySelectionMsg,
        apiEntityType: t.apiEntity,
        lsKey: cfg.lsColsPrefix + t.key + "-v1",
        dataRowClass: t.prefix + "-data-row",
        rowClickable: true,
        rowAriaEntitySingular: t.aria,
        bulkRowSelect: true,
        combineQuery: { param: "combine" },
        onRowClick: function (tr) {
          if (window.gcRoutingFlyoutOpenFromTr) window.gcRoutingFlyoutOpenFromTr(tr);
        },
        labels: {
          countSingular: t.countS,
          countPlural: t.countP,
          emptyCache: cfg.buildEmptyCache(t.countP),
          emptyFilter: "No " + t.countP + " match the current search or filters.",
          loadError: "Could not load " + t.countP + ".",
        },
      };
      if (cfg.target === "configuration") {
        tableCfg.target = "configuration";
      }
      // For unicast IPv4/IPv6 tabs we hit the same backend endpoint and post-filter
      // the rows by IPFamily so each tab shows only its address family.
      if (t.family) {
        tableCfg.fetchTablePayload = function (ctx) {
          var url = buildFetchUrl(t, ctx);
          return fetch(url, {
            credentials: "same-origin",
            headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
          }).then(function (r) { return r.json(); }).then(function (body) {
            if (body && Array.isArray(body.rows)) {
              body.rows = body.rows.filter(function (row) { return _familyMatches(row, t.family); });
            }
            return body;
          });
        };
      }
      tables[t.key] = gcCreateNetworkEntityTable(tableCfg);
    });

    mainTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        activeKey = tab.getAttribute(cfg.tabDataAttr);
        syncMainTabButtons();
        applyMainTabPanels();
        syncFilterAsidesVisibility();
        try { localStorage.setItem(cfg.lsKey, activeKey); } catch (e) { /* ignore */ }
      });
    });

    if (window.gcRoutingFlyoutInit) window.gcRoutingFlyoutInit();

    if (cfg.target === "firewall") {
      window.gcRoutingTopBarFirewallIds = function () { return _selectedIds(cfg.getSelectedIds); };
    }

    var bannerEl = document.getElementById(cfg.bannerId);

    TAB_DEFS.forEach(function (t) {
      var addBtn = document.getElementById(t.prefix + "-add");
      if (addBtn) {
        addBtn.addEventListener("click", function () {
          if (_selectedIds(cfg.getSelectedIds).length < 1) {
            _showBanner(bannerEl);
            return;
          }
          if (window.gcRoutingFlyoutOpenAddForEntity) {
            var presets = t.family ? { IPFamily: t.family, _lockFamily: true } : null;
            window.gcRoutingFlyoutOpenAddForEntity(t.apiEntity, presets);
          }
        });
      }
      var delBtn = document.getElementById(t.prefix + "-delete-selected");
      if (delBtn) {
        delBtn.addEventListener("click", function () {
          var tbl = tables[t.key];
          if (!tbl || typeof tbl.getDeleteConfigEntryIdsFromSelection !== "function") return;
          var ids = tbl.getDeleteConfigEntryIdsFromSelection();
          if (!ids.length) { window.gcAlert("Select one or more rows to delete."); return; }
          var n = ids.length;
          var msg = cfg.deleteConfirmMsg(n, t.countP);
          var confirm = window.gcConfirm
            ? window.gcConfirm(msg)
            : Promise.resolve(globalThis.confirm(msg));
          confirm.then(function (ok) {
            if (!ok) return;
            delBtn.disabled = true;
            fetch(cfg.deleteUrl, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ config_entry_ids: ids }),
            }).then(function (r) {
              return r.json().then(function (j) { return { ok: r.ok, j: j }; });
            }).then(function (x) {
              delBtn.disabled = false;
              if (!x.ok) {
                var em = (x.j && (x.j.detail || x.j.message))
                  || (cfg.target === "configuration" ? "Could not delete." : "Could not enqueue delete tasks.");
                window.gcAlert(typeof em === "string" ? em : JSON.stringify(em));
                return;
              }
              document.dispatchEvent(new CustomEvent(cfg.entriesUpdatedEvent));
              if (tbl.refresh) tbl.refresh();
            }).catch(function () {
              delBtn.disabled = false;
              window.gcAlert("Network error.");
            });
          });
        });
      }
    });

    syncMainTabButtons();
    applyMainTabPanels();
    syncFilterAsidesVisibility();
    refreshAllTables();
  }

  window.gcRoutingPageInit = gcRoutingPageInit;
})();
