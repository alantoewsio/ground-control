/**
 * Firewalls · System Services · HA — table + HAConfigure flyout (Sophos-style layout, readonly).
 */
(function () {
  "use strict";

  var URL_HA = window.GC_HA_CONFIGURE_TABLE_URL || "";
  var flyoutRoot = null;
  var flyoutFw = null;
  var tableHa = null;
  var lastPassphraseForCopy = "";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function hueLabel(label) {
    var h = 0;
    var t = String(label || "").toLowerCase();
    for (var i = 0; i < t.length; i++) {
      h = (h * 31 + t.charCodeAt(i)) % 360;
    }
    return h;
  }

  /** Link interface name to Network · Interfaces when it exists in the cache. */
  function ifaceLinkAnchor(name, setLcArr) {
    var n = String(name || "").trim();
    if (!n) return "";
    var e = esc(n);
    var lc = n.toLowerCase();
    if (setLcArr && setLcArr.indexOf(lc) >= 0) {
      return (
        '<a class="gc-ha-if-pill-link" href="/firewalls/network?if_search=' +
        encodeURIComponent(n) +
        '">' +
        e +
        "</a>"
      );
    }
    return e;
  }

  function ifacePillInner(name, setLcArr) {
    var n = String(name || "").trim();
    if (!n) return "";
    var inner = ifaceLinkAnchor(n, setLcArr);
    return (
      '<span class="gc-zone-pill" style="--gc-zone-h: ' + hueLabel(n) + '">' + inner + "</span>"
    );
  }

  function setVis(el, on) {
    if (!el) return;
    el.hidden = !on;
  }

  function syncBodyFlyoutClass() {
    var open = !!document.querySelector(".gc-if-flyout:not([hidden])");
    document.body.classList.toggle("gc-if-flyout--open", open);
  }

  function closeHaFlyout() {
    if (!flyoutRoot) return;
    flyoutRoot.hidden = true;
    flyoutRoot.setAttribute("aria-hidden", "true");
    lastPassphraseForCopy = "";
    syncBodyFlyoutClass();
  }

  function openHaFlyout() {
    if (!flyoutRoot) return;
    flyoutRoot.hidden = false;
    flyoutRoot.setAttribute("aria-hidden", "false");
    syncBodyFlyoutClass();
    var panel = flyoutRoot.querySelector(".gc-if-flyout__panel");
    if (panel) {
      try {
        panel.focus();
      } catch (e) {}
    }
  }

  function setRadioGroup(name, value) {
    var nodes = document.querySelectorAll('input[name="' + name + '"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].checked = value != null && String(value) !== "" && nodes[i].value === value;
    }
  }

  function populateHaFlyout(row) {
    var emptyEl = document.getElementById("gc-ha-flyout-empty");
    var formEl = document.getElementById("gc-ha-flyout-form");
    var rawPre = document.getElementById("gc-ha-raw-pre");
    if (!emptyEl || !formEl) return;

    if (!row.ha_in_cache) {
      emptyEl.hidden = false;
      formEl.hidden = true;
      if (rawPre) rawPre.textContent = "";
      return;
    }

    emptyEl.hidden = true;
    formEl.hidden = false;

    var f = row.ha_form && typeof row.ha_form === "object" ? row.ha_form : {};
    var setLc = Array.isArray(row.interface_names_lower) ? row.interface_names_lower : [];

    var role = String(f.device_normalized || "").trim();
    setRadioGroup("gc-ha-device-role", role || null);

    var mode = String(f.configuration_mode || "none");
    if (mode === "quick") {
      setRadioGroup("gc-ha-cfg-mode", "quick");
    } else if (mode === "interactive") {
      setRadioGroup("gc-ha-cfg-mode", "interactive");
    } else {
      setRadioGroup("gc-ha-cfg-mode", null);
    }

    var hintAp = document.getElementById("gc-ha-role-hint-ap");
    var hintAux = document.getElementById("gc-ha-role-hint-aux");
    var hintAa = document.getElementById("gc-ha-role-hint-aa");
    var hintAaCell = document.getElementById("gc-ha-role-hint-aa-cell");
    setVis(hintAp, role === "Active_Passive");
    setVis(hintAux, role === "Auxilliary");
    setVis(hintAa, role === "Active_Active");
    setVis(hintAaCell, role === "Active_Active");

    var clusterRow = document.getElementById("gc-ha-row-cluster");
    var clusterInp = document.getElementById("gc-ha-cluster-id");
    if (clusterRow) clusterRow.hidden = mode === "quick";
    if (clusterInp) clusterInp.value = f.cluster_id != null ? String(f.cluster_id) : "";

    var nodeInp = document.getElementById("gc-ha-node-name");
    if (nodeInp) nodeInp.value = f.node_name != null ? String(f.node_name) : "";

    var passInp = document.getElementById("gc-ha-passphrase");
    if (passInp) {
      passInp.value = f.passphrase_set ? String(f.passphrase_masked || "••••••••") : "";
    }
    lastPassphraseForCopy = f.passphrase_copy != null ? String(f.passphrase_copy) : "";

    var dedInp = document.getElementById("gc-ha-dedicated-link");
    var dedLinkWrap = document.getElementById("gc-ha-dedicated-link-as-link");
    var ded = f.dedicated_ha_link != null ? String(f.dedicated_ha_link).trim() : "";
    if (dedInp) dedInp.value = ded;
    if (dedLinkWrap) {
      var dedLc = ded.toLowerCase();
      var dedInCache = ded && setLc.indexOf(dedLc) >= 0;
      if (dedInCache) {
        dedLinkWrap.innerHTML = ifaceLinkAnchor(ded, setLc);
        dedLinkWrap.hidden = false;
      } else {
        dedLinkWrap.innerHTML = "";
        dedLinkWrap.hidden = true;
      }
    }

    var peer4 = document.getElementById("gc-ha-peer-ipv4");
    if (peer4) peer4.value = f.dedicated_peer_ha_ipv4 != null ? String(f.dedicated_peer_ha_ipv4) : "";

    var monPills = document.getElementById("gc-ha-monitor-pills");
    var monEmpty = document.getElementById("gc-ha-monitor-empty");
    var ports = Array.isArray(f.monitor_ports) ? f.monitor_ports : [];
    if (monPills) {
      monPills.innerHTML = ports
        .map(function (p) {
          return ifacePillInner(p, setLc);
        })
        .join("");
    }
    if (monEmpty) monEmpty.hidden = ports.length > 0;

    var peerBody = document.getElementById("gc-ha-peer-tbody");
    var peerEmpty = document.getElementById("gc-ha-peer-empty");
    var peers = Array.isArray(f.peer_rows) ? f.peer_rows : [];
    if (peerBody) {
      peerBody.innerHTML = peers
        .map(function (pr) {
          pr = pr || {};
          var ifn = String(pr.Interface || "").trim();
          var ifCell = ifn ? ifaceLinkAnchor(ifn, setLc) : "—";
          if (!ifCell) ifCell = "—";
          return (
            "<tr><td>" +
            ifCell +
            '</td><td class="mono">' +
            esc(pr.IPAddressV4) +
            '</td><td class="mono">' +
            esc(pr.IPAddressV6) +
            "</td><td>" +
            esc(pr.ReserveBridgePort) +
            "</td></tr>"
          );
        })
        .join("");
    }
    if (peerEmpty) peerEmpty.hidden = peers.length > 0;

    var pref = document.getElementById("gc-ha-preferred-primary");
    if (pref) pref.value = f.preferred_primary != null ? String(f.preferred_primary) : "";

    var kMs = document.getElementById("gc-ha-keepalive-ms");
    var kAtt = document.getElementById("gc-ha-keepalive-att");
    if (kMs) kMs.value = f.keepalive_interval != null ? String(f.keepalive_interval) : "";
    if (kAtt) kAtt.value = f.keepalive_attempts != null ? String(f.keepalive_attempts) : "";

    var macChk = document.getElementById("gc-ha-hypervisor-mac");
    if (macChk) macChk.checked = !!f.use_hypervisor_mac;

    var flagsBanner = document.getElementById("gc-ha-flags-banner");
    var fl = Array.isArray(f.flags) ? f.flags : [];
    if (flagsBanner) {
      if (fl.length) {
        flagsBanner.hidden = false;
        flagsBanner.innerHTML =
          "<strong>XML flags present:</strong> " +
          fl
            .map(function (x) {
              return '<span class="gc-table-value-pill">' + esc(x) + "</span>";
            })
            .join(" ");
      } else {
        flagsBanner.hidden = true;
        flagsBanner.innerHTML = "";
      }
    }

    var raw = row.ha_flyout && row.ha_flyout.raw;
    if (rawPre) {
      try {
        rawPre.textContent = raw && typeof raw === "object" ? JSON.stringify(raw, null, 2) : "";
      } catch (e2) {
        rawPre.textContent = "";
      }
    }
  }

  function haFlyoutOpenFromTr(tr) {
    if (!flyoutRoot) return;
    if (!tr || !tr._gcNetRow) return;
    var row = tr._gcNetRow;
    if (flyoutFw) {
      var lab = row.cells && row.cells.__name != null ? String(row.cells.__name).trim() : "";
      flyoutFw.textContent = lab ? "Firewall: " + lab : "";
    }
    populateHaFlyout(row);
    openHaFlyout();
  }

  function bindFlyoutOnce() {
    if (!flyoutRoot) return;
    var btn = document.getElementById("gc-ha-flyout-close");
    if (btn && !btn._gcHaBound) {
      btn._gcHaBound = true;
      btn.addEventListener("click", closeHaFlyout);
    }
    var bd = flyoutRoot.querySelector(".gc-if-flyout__backdrop");
    if (bd && !bd._gcHaBound) {
      bd._gcHaBound = true;
      bd.addEventListener("click", closeHaFlyout);
    }
    var copyBtn = document.getElementById("gc-ha-pass-copy");
    if (copyBtn && !copyBtn._gcHaBound) {
      copyBtn._gcHaBound = true;
      copyBtn.addEventListener("click", function () {
        if (!lastPassphraseForCopy) {
          try {
            alert("No passphrase value in the cached sync payload.");
          } catch (e) {}
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(lastPassphraseForCopy).catch(function () {
            try {
              alert("Could not copy to clipboard.");
            } catch (e2) {}
          });
        } else {
          try {
            alert("Clipboard API not available.");
          } catch (e3) {}
        }
      });
    }
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (flyoutRoot && !flyoutRoot.hidden) {
      closeHaFlyout();
      e.preventDefault();
    }
  });

  function init() {
    if (!URL_HA || typeof globalThis.gcCreateNetworkEntityTable !== "function") return;
    flyoutRoot = document.getElementById("gc-ha-flyout");
    flyoutFw = document.getElementById("gc-ha-flyout-fw");
    bindFlyoutOnce();

    tableHa = globalThis.gcCreateNetworkEntityTable({
      prefix: "gc-ha",
      apiUrl: URL_HA,
      emptySelectionMessage: "Select one or more firewalls in the top bar.",
      lsKey: "ground-control-ha-configure-columns-v1",
      dataRowClass: "gc-ha-data-row",
      colPickerAttr: "data-gc-ha-col",
      pageSyncFallbackEntities: ["ha_configure"],
      rowClickable: true,
      onRowClick: function (tr) {
        haFlyoutOpenFromTr(tr);
      },
      labels: {
        countSingular: "row",
        countPlural: "rows",
        emptyCache:
          "No HA configuration in the cache for the selected firewalls. Run sync from Inventory (include HA configuration).",
        emptyFilter: "No rows match the current search or filters.",
        loadError: "Could not load HA configuration.",
      },
    });

    document.addEventListener("gc-firewall-selection-changed", function () {
      if (tableHa && tableHa.refresh) tableHa.refresh();
    });
    if (typeof globalThis.gcRegisterConfigCacheTableRefresher === "function") {
      globalThis.gcRegisterConfigCacheTableRefresher(function (ids) {
        if (!ids || !ids.length || !tableHa || typeof tableHa.refresh !== "function") return;
        var sel =
          typeof globalThis.gcGetSelectedFirewallIds === "function"
            ? globalThis.gcGetSelectedFirewallIds()
            : [];
        if (!sel || !sel.length) return;
        var set = {};
        sel.forEach(function (id) {
          set[Number(id)] = true;
        });
        if (ids.some(function (id) { return set[Number(id)]; })) tableHa.refresh();
      });
    }

    if (tableHa && tableHa.refresh) {
      tableHa.refresh();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
