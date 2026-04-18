/**
 * Shared bootstrap for the DHCP tab on the Firewalls and Configurations
 * "Network" pages.
 *
 * Both templates render an identical three-sub-tab layout (IPv4 servers,
 * IPv6 servers, DHCP relays) over the same backend with a handful of
 * wiring differences:
 *
 *   - DOM id prefix                ("gc-net-dhcp"   vs "gc-cfg-net-dhcp")
 *   - sub-tab data-attribute       ("data-gc-net-dhcp-subtab" vs cfg variant)
 *   - target qualifier             ("firewall"      vs "configuration")
 *   - fetch URL shape              (firewallIds path vs configurationIds path)
 *   - table factory wrapper        (raw opts        vs Object.assign(tableOpts,...))
 *   - delete endpoint + event      (enqueue / apply flavours)
 *   - empty-cache / confirm copy   (per target wording)
 *   - "nothing selected" message   (per target wording)
 *   - parent-id getter             (fw / cfg selection getters)
 *
 * The page templates call gcDhcpPageInit() with the appropriate config so all
 * the shared logic lives here.
 */
(function () {
  // Stable per-target table definitions.  Only the prefix changes at runtime
  // (built from cfg.prefix) so this array is cheap to produce on each init.
  function _buildTabDefs(cfg) {
    return [
      {
        key: "ipv4",
        prefix: cfg.prefix + "-ipv4",
        apiEntity: "dhcp_server",
        aria: "IPv4 DHCP server",
        countS: "IPv4 DHCP server",
        countP: "IPv4 DHCP servers",
        humanAdd: "IPv4 DHCP server",
      },
      {
        key: "ipv6",
        prefix: cfg.prefix + "-ipv6",
        apiEntity: "dhcp_server_ipv6",
        aria: "IPv6 DHCP server",
        countS: "IPv6 DHCP server",
        countP: "IPv6 DHCP servers",
        humanAdd: "IPv6 DHCP server",
      },
      {
        key: "relay",
        prefix: cfg.prefix + "-relay",
        apiEntity: "dhcp_relay",
        aria: "DHCP relay",
        countS: "DHCP relay",
        countP: "DHCP relays",
        humanAdd: "DHCP relay",
      },
    ];
  }

  function _emptySet(val) {
    return !val || !val.length;
  }

  /**
   * Initialise the DHCP tab on a network page.
   *
   * @param {Object}   cfg
   * @param {string}   cfg.prefix                 DOM id prefix ("gc-net-dhcp").
   * @param {string}   cfg.subAttr                Sub-tab data-attribute name.
   * @param {string}   cfg.subtablistId           id of the sub-tablist element.
   * @param {string}   cfg.subLsKey               localStorage key for sub-tab.
   * @param {string}   cfg.lsKeyPrefix            localStorage col-layout prefix.
   * @param {string}   cfg.target                 "firewall" or "configuration".
   * @param {string}   cfg.emptySelectionMessage  shown when no parents selected.
   * @param {string}   cfg.entriesUpdatedEvent    event dispatched after delete.
   * @param {Function} cfg.getDeleteUrl           fn() -> batch delete endpoint.
   * @param {Function} cfg.deleteConfirmMsg       fn(n, countPlural) -> string.
   * @param {Function} cfg.buildEmptyCache        fn(countPlural) -> string.
   * @param {Function} cfg.buildFetchUrl          fn(tab, ctx) -> request URL.
   * @param {Function} cfg.makeTable              fn(baseOpts) -> table instance.
   * @param {Function} cfg.getSelectedParentIds   fn() -> array of parent ids.
   * @param {Function=} cfg.syncFilterAsides      optional callback after sub switch.
   * @param {Function=} cfg.onTablesCreated       optional fn(tables) post-init hook.
   */
  function gcDhcpPageInit(cfg) {
    var DHCP_TAB_DEFS = _buildTabDefs(cfg);

    function makeDhcpTable(t) {
      var baseOpts = {
        prefix: t.prefix,
        apiEntityType: t.apiEntity,
        lsKey: cfg.lsKeyPrefix + t.key + "-columns-v1",
        dataRowClass: t.prefix + "-data-row",
        colPickerAttr: "data-" + t.prefix + "-col",
        pageSyncFallbackEntities: [t.apiEntity],
        rowClickable: true,
        rowAriaEntitySingular: t.aria,
        bulkRowSelect: true,
        combineQuery: { param: "combine" },
        onRowClick: function (tr) {
          if (window.gcDhcpFlyout && window.gcDhcpFlyout.openEditFromTr) {
            window.gcDhcpFlyout.openEditFromTr(tr);
          }
        },
        fetchTablePayload: function (ctx) {
          var url = cfg.buildFetchUrl(t, ctx);
          return fetch(url, {
            credentials: "same-origin",
            headers: { Accept: "application/json", "X-Requested-With": "Ground-Control" },
          }).then(function (r) { return r.json(); });
        },
        labels: {
          countSingular: t.countS,
          countPlural: t.countP,
          emptyCache: cfg.buildEmptyCache(t.countP),
          emptyFilter: "No " + t.countP + " match the current search or filters.",
          loadError: "Could not load " + t.countP + ".",
        },
      };
      if (cfg.emptySelectionMessage) {
        baseOpts.emptySelectionMessage = cfg.emptySelectionMessage;
      }
      return cfg.makeTable(baseOpts);
    }

    var tableDhcpV4 = makeDhcpTable(DHCP_TAB_DEFS[0]);
    var tableDhcpV6 = makeDhcpTable(DHCP_TAB_DEFS[1]);
    var tableDhcpRelay = makeDhcpTable(DHCP_TAB_DEFS[2]);
    var dhcpTablesByKey = {
      ipv4: tableDhcpV4,
      ipv6: tableDhcpV6,
      relay: tableDhcpRelay,
    };

    // --- Sub-tab switching (persisted in localStorage) --------------------
    function readSavedSubtab() {
      try {
        var raw = localStorage.getItem(cfg.subLsKey);
        if (raw === "ipv4" || raw === "ipv6" || raw === "relay") return raw;
      } catch (e) {}
      return "ipv4";
    }
    var activeSubtab = readSavedSubtab();
    var subTabs = document.querySelectorAll(
      "#" + cfg.subtablistId + " .gc-tabs__tab[" + cfg.subAttr + "]"
    );
    var subPanels = {
      ipv4: document.getElementById(cfg.prefix + "-panel-ipv4"),
      ipv6: document.getElementById(cfg.prefix + "-panel-ipv6"),
      relay: document.getElementById(cfg.prefix + "-panel-relay"),
    };
    function syncButtons() {
      subTabs.forEach(function (b) {
        var on = b.getAttribute(cfg.subAttr) === activeSubtab;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    function applyPanels() {
      Object.keys(subPanels).forEach(function (k) {
        var p = subPanels[k];
        if (!p) return;
        var show = k === activeSubtab;
        p.classList.toggle("is-active", show);
        p.hidden = !show;
      });
    }
    subTabs.forEach(function (b) {
      b.addEventListener("click", function () {
        activeSubtab = b.getAttribute(cfg.subAttr);
        syncButtons();
        applyPanels();
        if (typeof cfg.syncFilterAsides === "function") cfg.syncFilterAsides();
        try { localStorage.setItem(cfg.subLsKey, activeSubtab); } catch (e) {}
      });
    });
    syncButtons();
    applyPanels();

    if (window.gcDhcpFlyout && typeof window.gcDhcpFlyout.init === "function") {
      window.gcDhcpFlyout.init();
    }

    // --- Add / bulk-add / delete-selected button wiring -------------------
    DHCP_TAB_DEFS.forEach(function (t) {
      var addBtn = document.getElementById(t.prefix + "-add");
      if (addBtn) {
        addBtn.addEventListener("click", function () {
          var sel = cfg.getSelectedParentIds ? cfg.getSelectedParentIds() : [];
          if (_emptySet(sel)) {
            window.gcAlert(cfg.emptySelectionMessage || "Select one or more items in the top bar to add objects.");
            return;
          }
          if (window.gcDhcpFlyout && window.gcDhcpFlyout.openAdd) {
            window.gcDhcpFlyout.openAdd(t.apiEntity, null);
          }
        });
      }
      var bulkBtn = document.getElementById(t.prefix + "-bulk-add");
      if (bulkBtn && window.gcHsBulkAdd && window.gcHsBulkAdd.openForEntity) {
        bulkBtn.addEventListener("click", function () {
          window.gcHsBulkAdd.openForEntity(t.apiEntity, { target: cfg.target });
        });
      }
      var delBtn = document.getElementById(t.prefix + "-delete-selected");
      if (delBtn) {
        delBtn.addEventListener("click", function () {
          var tbl = dhcpTablesByKey[t.key];
          if (!tbl || typeof tbl.getDeleteConfigEntryIdsFromSelection !== "function") return;
          var ids = tbl.getDeleteConfigEntryIdsFromSelection();
          if (!ids.length) { window.gcAlert("Select one or more rows to delete."); return; }
          var n = ids.length;
          var msg = cfg.deleteConfirmMsg(n, t.countP);
          var cf = window.gcConfirm ? window.gcConfirm(msg) : Promise.resolve(globalThis.confirm(msg));
          cf.then(function (ok) {
            if (!ok) return;
            var url = cfg.getDeleteUrl();
            if (!url) { window.gcAlert("Delete URL not configured."); return; }
            delBtn.disabled = true;
            fetch(url, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ config_entry_ids: ids }),
            }).then(function (r) {
              return r.json().then(function (j) { return { ok: r.ok, j: j }; });
            }).then(function (x) {
              delBtn.disabled = false;
              if (!x.ok) {
                var em = (x.j && (x.j.detail || x.j.message)) || "Could not apply delete.";
                window.gcAlert(typeof em === "string" ? em : JSON.stringify(em));
                return;
              }
              try { document.dispatchEvent(new CustomEvent(cfg.entriesUpdatedEvent)); } catch (e) {}
              if (tbl.refresh) tbl.refresh();
            }).catch(function () {
              delBtn.disabled = false;
              window.gcAlert("Network error.");
            });
          });
        });
      }
    });

    if (typeof cfg.onTablesCreated === "function") {
      cfg.onTablesCreated({ ipv4: tableDhcpV4, ipv6: tableDhcpV6, relay: tableDhcpRelay });
    }

    return {
      tables: { ipv4: tableDhcpV4, ipv6: tableDhcpV6, relay: tableDhcpRelay },
      getActiveSubtab: function () { return activeSubtab; },
    };
  }

  window.gcDhcpPageInit = gcDhcpPageInit;
})();
