/**
 * Firewall rule flyout: Add / Edit forms for `firewall_rule`.
 *
 * Submits via the HS task queue (firewall scope) or the configuration-apply
 * endpoints (configuration scope).  Mirrors the structure of
 * gc-dhcp-flyout.js so the two share styling and behaviour.
 *
 * Three policy variants exist on a Sophos firewall rule:
 *   - UserPolicy        — fully editable
 *   - NetworkPolicy     — fully editable
 *   - HTTPBasedPolicy   — read-only (the embedded Web Server / Reverse Proxy
 *                         schema is too rich for a flyout; we surface the
 *                         hosted address / listen port / domains / source
 *                         networks for context but disable Save).  Top-level
 *                         Status + Position changes still flow through the
 *                         merge layer.
 */
(function () {
  "use strict";

  // Lifecycle + cross-cutting helpers (owner-id lookups, isCfg detection,
  // open / close / save scaffolding) live in gc-rule-flyout-shell.js so they
  // can be shared with gc-nat-rule-flyout.js without copy-paste duplication.
  const SHELL = globalThis.gcRuleFlyoutShell;
  if (!SHELL || typeof SHELL.create !== "function") {
    return;
  }
  const escapeHtml = SHELL.escapeHtml;
  const pick = SHELL.pick;
  const selectInput = SHELL.selectInput;
  const textInput = SHELL.textInput;
  const textArea = SHELL.textArea;
  const fieldRow = SHELL.fieldRow;
  const fieldset = SHELL.fieldset;
  const readStringList = SHELL.readStringList;

  const ROW_CLASS = "gc-fwr-strrow";
  const DATA_PREFIX = "gc-fwr-str";
  function buildStringRow(rowsId, idx, val, placeholder) {
    return SHELL.buildStringRow(ROW_CLASS, DATA_PREFIX, rowsId, idx, val, placeholder);
  }
  function stringListBlock(legendText, rowsId, values, placeholder, addLabel) {
    return SHELL.stringListBlock(ROW_CLASS, DATA_PREFIX, legendText, rowsId, values, placeholder, addLabel);
  }
  function collectStringList(rowsId) {
    return SHELL.collectStringList(ROW_CLASS, rowsId);
  }

  const ENTITY_TYPE = "firewall_rule";

  // ``shell`` is created later in init() once we know all the per-flyout DOM
  // helpers; the form builders below use ``getCurrentRow()`` (set on shell)
  // when they need the active row, so a forward declaration here keeps the
  // rest of the module free of stale ``currentRow`` accessors.
  let shell = null;

  // ── Common selector option lists ──────────────────────────────────────

  const ENABLE_DISABLE = [{ value: "Enable", label: "Enable" }, { value: "Disable", label: "Disable" }];
  const POSITION_OPTS = [
    { value: "top", label: "Top" },
    { value: "bottom", label: "Bottom" },
    { value: "after", label: "After…" },
    { value: "before", label: "Before…" },
  ];
  const SECTION_OPTS = [
    { value: "", label: "(unset)" },
    { value: "Local", label: "Local" },
    { value: "Central_TOP", label: "Central_TOP" },
    { value: "Central_Bottom", label: "Central_Bottom" },
  ];
  const POLICY_TYPE_OPTS = [
    { value: "Network", label: "Network" },
    { value: "User", label: "User" },
    { value: "HTTPBased", label: "HTTPBased" },
  ];
  const ACTION_OPTS = [
    { value: "Accept", label: "Accept" },
    { value: "Reject", label: "Reject" },
    { value: "Drop", label: "Drop" },
  ];

  // ── Read helpers for the policy block payloads ────────────────────────

  function policyBlockOf(flat) {
    if (!flat) return null;
    if (flat.UserPolicy && typeof flat.UserPolicy === "object") return flat.UserPolicy;
    if (flat.NetworkPolicy && typeof flat.NetworkPolicy === "object") return flat.NetworkPolicy;
    if (flat.HTTPBasedPolicy && typeof flat.HTTPBasedPolicy === "object") return flat.HTTPBasedPolicy;
    return null;
  }

  function detectPolicyType(flat) {
    if (!flat) return "Network";
    let raw = pick(flat, ["PolicyType"]);
    if (raw === "User" || raw === "Network" || raw === "HTTPBased") return raw;
    if (flat.HTTPBasedPolicy && typeof flat.HTTPBasedPolicy === "object") return "HTTPBased";
    if (flat.UserPolicy && typeof flat.UserPolicy === "object") return "User";
    return "Network";
  }

  // ── Form builders ─────────────────────────────────────────────────────

  function buildHeader(row, isAdd) {
    let f = (row && row.flat) || {};
    let nameEditable = isAdd;
    let html = "";
    html += fieldRow("Name", textInput("gc-fwr-name", pick(f, ["Name"]), { disabled: !nameEditable }), { required: true });
    html += fieldRow("Description", textArea("gc-fwr-description", pick(f, ["Description"])));
    html += fieldRow("Status", selectInput("gc-fwr-status", pick(f, ["Status"]) || "Enable", ENABLE_DISABLE));
    html += fieldRow("IP family", selectInput("gc-fwr-ipfamily", pick(f, ["IPFamily"]) || "IPv4", [
      { value: "IPv4", label: "IPv4" },
      { value: "IPv6", label: "IPv6" },
    ]), { required: true, hint: isAdd ? "" : "Changing IP family on an existing rule is rarely safe." });
    html += fieldRow("Policy type", selectInput("gc-fwr-policytype", detectPolicyType(f), POLICY_TYPE_OPTS), { required: true });

    // Position group
    let pos = pick(f, ["Position"]);
    let after = "";
    let before = "";
    if (f.After && typeof f.After === "object") after = String(f.After.Name || "").trim();
    if (f.Before && typeof f.Before === "object") before = String(f.Before.Name || "").trim();
    html += fieldRow("Position", selectInput("gc-fwr-position", pos || (isAdd ? "bottom" : ""), POSITION_OPTS));
    html += fieldRow("After (rule name)", textInput("gc-fwr-after", after, { mono: true }), { hint: "Used when position = after." });
    html += fieldRow("Before (rule name)", textInput("gc-fwr-before", before, { mono: true }), { hint: "Used when position = before." });
    html += fieldRow("Section", selectInput("gc-fwr-section", pick(f, ["Section"]), SECTION_OPTS));
    return html;
  }

  function buildSharedPolicyFields(flat, prefix, includeUserOnlyFields) {
    let pb = policyBlockOf({ UserPolicy: flat && flat.UserPolicy, NetworkPolicy: flat && flat.NetworkPolicy }) || {};
    // Note: caller passes the *raw* flat, but for User/Network we want to
    // read the relevant block.  We dispatch on includeUserOnlyFields below.
    let html = "";

    let action = String(pb.Action || "");
    let logTraffic = String(pb.LogTraffic || "");
    let skipLocal = String(pb.SkipLocalDestined || "");
    let schedule = String(pb.Schedule || "");
    let webfilter = String(pb.WebFilter || "");
    let webcatQos = String(pb.WebCategoryBaseQoSPolicy || "");
    let blockQuic = String(pb.BlockQuickQuic || "");
    let scanVirus = String(pb.ScanVirus || "");
    let zeroDay = String(pb.ZeroDayProtection || "");
    let scanFTP = String(pb.ScanFTP || "");
    let proxy = String(pb.ProxyMode || "");
    let decryptHttps = String(pb.DecryptHTTPS || "");
    let srcHB = String(pb.SourceSecurityHeartbeat || "");
    let minSrcHB = String(pb.MinimumSourceHBPermitted || "");
    let dstHB = String(pb.DestSecurityHeartbeat || "");
    let minDstHB = String(pb.MinimumDestinationHBPermitted || "");
    let appCtrl = String(pb.ApplicationControl || "");
    let appQos = String(pb.ApplicationBaseQoSPolicy || "");
    let ips = String(pb.IntrusionPrevention || "");
    let tsp = String(pb.TrafficShapingPolicy || "");
    let dscp = String(pb.DSCPMarking || "");
    let scanSMTP = String(pb.ScanSMTP || "");
    let scanSMTPS = String(pb.ScanSMTPS || "");
    let scanIMAP = String(pb.ScanIMAP || "");
    let scanIMAPS = String(pb.ScanIMAPS || "");
    let scanPOP3 = String(pb.ScanPOP3 || "");
    let scanPOP3S = String(pb.ScanPOP3S || "");

    let srcZones = readStringList(pb, "SourceZones", "Zone");
    let srcNets = readStringList(pb, "SourceNetworks", "Network");
    let dstZones = readStringList(pb, "DestinationZones", "Zone");
    let dstNets = readStringList(pb, "DestinationNetworks", "Network");
    let services = readStringList(pb, "Services", "Service");

    let actHtml = '<fieldset class="gc-if-flyout__fieldset"><legend>Action &amp; logging</legend>' +
      fieldRow("Action", selectInput(prefix + "-action", action || "Accept", ACTION_OPTS), { required: true }) +
      fieldRow("Log traffic", selectInput(prefix + "-logtraffic", logTraffic || "Disable", ENABLE_DISABLE)) +
      fieldRow("Skip local destined", selectInput(prefix + "-skiplocaldest", skipLocal || "Disable", ENABLE_DISABLE)) +
      fieldRow("Schedule", textInput(prefix + "-schedule", schedule, { placeholder: "All The Time" })) +
      "</fieldset>";
    html += actHtml;

    html += stringListBlock("Source zones", prefix + "-srczones-rows", srcZones, "Any / LAN / WAN / VPN / DMZ", "Add zone");
    html += stringListBlock("Source networks", prefix + "-srcnets-rows", srcNets, "host or group", "Add source");
    html += stringListBlock("Destination zones", prefix + "-dstzones-rows", dstZones, "Any / LAN / WAN / VPN", "Add zone");
    html += stringListBlock("Destination networks", prefix + "-dstnets-rows", dstNets, "host or group", "Add destination");
    html += stringListBlock("Services", prefix + "-services-rows", services, "service or service group", "Add service");

    // User-only identity block
    if (includeUserOnlyFields) {
      let upb = (flat && flat.UserPolicy) || {};
      let identity = readStringList(upb, "Identity", "Member");
      let ihtml = '<fieldset class="gc-if-flyout__fieldset"><legend>Identity</legend>' +
        fieldRow("Match identity", selectInput(prefix + "-matchidentity", String(upb.MatchIdentity || "Disable"), ENABLE_DISABLE)) +
        fieldRow("Show captive portal", selectInput(prefix + "-showcaptive", String(upb.ShowCaptivePortal || "Disable"), ENABLE_DISABLE)) +
        fieldRow("Data accounting", selectInput(prefix + "-dataacct", String(upb.DataAccounting || ""), [
          { value: "", label: "(default)" },
          { value: "Include", label: "Include" },
          { value: "Exclude", label: "Exclude" },
        ])) +
        "</fieldset>";
      ihtml += stringListBlock("Identity members (users / groups)", prefix + "-identity-rows", identity, "user or group", "Add member");
      html += ihtml;
    }

    let secHtml = '<fieldset class="gc-if-flyout__fieldset"><legend>Threat protection</legend>' +
      fieldRow("Web filter", textInput(prefix + "-webfilter", webfilter, { placeholder: "None / Allow All / policy name" })) +
      fieldRow("Web category QoS policy", textInput(prefix + "-webqos", webcatQos)) +
      fieldRow("Block QUIC", selectInput(prefix + "-blockquic", blockQuic || "Disable", ENABLE_DISABLE)) +
      fieldRow("Scan virus", selectInput(prefix + "-scanvirus", scanVirus || "Disable", ENABLE_DISABLE)) +
      fieldRow("Zero-day protection", selectInput(prefix + "-zeroday", zeroDay || "Disable", ENABLE_DISABLE)) +
      fieldRow("Scan FTP", selectInput(prefix + "-scanftp", scanFTP || "Disable", ENABLE_DISABLE)) +
      fieldRow("Proxy mode", selectInput(prefix + "-proxy", proxy || "Disable", ENABLE_DISABLE)) +
      fieldRow("Decrypt HTTPS", selectInput(prefix + "-decrypthttps", decryptHttps || "Disable", ENABLE_DISABLE)) +
      fieldRow("Application control", textInput(prefix + "-appctrl", appCtrl, { placeholder: "None / Allow All / policy name" })) +
      fieldRow("Application QoS policy", textInput(prefix + "-appqos", appQos)) +
      fieldRow("Intrusion prevention", textInput(prefix + "-ips", ips, { placeholder: "None / policy name" })) +
      fieldRow("Traffic shaping policy", textInput(prefix + "-tsp", tsp, { placeholder: "None / policy name" })) +
      fieldRow("DSCP marking", textInput(prefix + "-dscp", dscp, { placeholder: "0-Best Effort / EF / …" })) +
      "</fieldset>";
    html += secHtml;

    let mailHtml = '<fieldset class="gc-if-flyout__fieldset"><legend>Mail scanning</legend>' +
      fieldRow("Scan SMTP", selectInput(prefix + "-scansmtp", scanSMTP || "Disable", ENABLE_DISABLE)) +
      fieldRow("Scan SMTPS", selectInput(prefix + "-scansmtps", scanSMTPS || "Disable", ENABLE_DISABLE)) +
      fieldRow("Scan IMAP", selectInput(prefix + "-scanimap", scanIMAP || "Disable", ENABLE_DISABLE)) +
      fieldRow("Scan IMAPS", selectInput(prefix + "-scanimaps", scanIMAPS || "Disable", ENABLE_DISABLE)) +
      fieldRow("Scan POP3", selectInput(prefix + "-scanpop3", scanPOP3 || "Disable", ENABLE_DISABLE)) +
      fieldRow("Scan POP3S", selectInput(prefix + "-scanpop3s", scanPOP3S || "Disable", ENABLE_DISABLE)) +
      "</fieldset>";
    html += mailHtml;

    let hbHtml = '<fieldset class="gc-if-flyout__fieldset"><legend>Security Heartbeat</legend>' +
      fieldRow("Source heartbeat", selectInput(prefix + "-srchb", srcHB || "Disable", ENABLE_DISABLE)) +
      fieldRow("Min source HB permitted", textInput(prefix + "-minsrchb", minSrcHB, { placeholder: "NoRestriction / Green / Yellow" })) +
      fieldRow("Destination heartbeat", selectInput(prefix + "-dsthb", dstHB || "Disable", ENABLE_DISABLE)) +
      fieldRow("Min destination HB permitted", textInput(prefix + "-mindsthb", minDstHB, { placeholder: "NoRestriction / Green / Yellow" })) +
      "</fieldset>";
    html += hbHtml;

    return html;
  }

  function buildHttpBasedReadOnlyView(flat) {
    // HTTPBased is read-only in the flyout; we only surface a few useful
    // top-level fields so the user understands what they're looking at.
    let pb = (flat && flat.HTTPBasedPolicy) || {};
    let domains = readStringList(pb, "Domains", "Domain");
    let srcNets = readStringList(pb, "SourceNetworks", "Network");
    let exceptionNets = readStringList(pb, "ExceptionNetworks", "Network");
    let html = '<fieldset class="gc-if-flyout__fieldset"><legend>HTTPBased policy (read-only)</legend>';
    html += fieldRow("Hosted address", textInput("gc-fwr-http-host", String(pb.HostedAddress || ""), { mono: true, disabled: true }));
    html += fieldRow("HTTPS", textInput("gc-fwr-http-https", String(pb.HTTPS || ""), { disabled: true }));
    html += fieldRow("Redirect HTTP", textInput("gc-fwr-http-redirect", String(pb.RedirectHTTP || ""), { disabled: true }));
    html += fieldRow("Listen port", textInput("gc-fwr-http-port", String(pb.ListenPort || ""), { mono: true, disabled: true }));
    html += "</fieldset>";

    function roList(label, vals) {
      let inner = "<div>";
      if (!vals.length) inner += '<p class="muted">(none)</p>';
      else vals.forEach(function (v) {
        inner += '<div><input type="text" class="gc-if-flyout__input mono" value="' + escapeHtml(v) + '" disabled /></div>';
      });
      inner += "</div>";
      return fieldset(label + " (read-only)", inner);
    }
    html += roList("Domains", domains);
    html += roList("Source networks", srcNets);
    html += roList("Exception networks", exceptionNets);

    html += '<p class="muted" style="margin-top:8px">' +
      'Reverse-proxy / Web Application Firewall details (Access paths, ' +
      'Exceptions, Protocol security) are preserved from the firewall ' +
      'unchanged. Only Status / Position / Section / Description from the ' +
      'header are sent on save.</p>';
    return html;
  }

  function buildPolicyEditor(row) {
    let f = (row && row.flat) || {};
    let pt = detectPolicyType(f);
    if (pt === "HTTPBased") return buildHttpBasedReadOnlyView(f);
    let includeUserOnly = pt === "User";
    let pb = pt === "User" ? (f.UserPolicy || {}) : (f.NetworkPolicy || {});
    return buildSharedPolicyFields(
      pt === "User" ? { UserPolicy: pb, NetworkPolicy: null } : { UserPolicy: null, NetworkPolicy: pb },
      "gc-fwr-pol",
      includeUserOnly,
    );
  }

  function buildForm(row, isAdd) {
    let html = "";
    html += '<fieldset class="gc-if-flyout__fieldset"><legend>Identity &amp; placement</legend>' + buildHeader(row, isAdd) + '</fieldset>';
    html += '<div id="gc-fwr-policy-section">' + buildPolicyEditor(row) + "</div>";
    return html;
  }

  // ── Form collectors ───────────────────────────────────────────────────

  function valOf(id) {
    let el = document.getElementById(id);
    return el ? String(el.value || "") : "";
  }

  function maybe(form, key, val) {
    if (val === "" || val == null) return;
    form[key] = val;
  }

  function collectPolicyFlat(form, prefix, includeUserOnly) {
    // The Python merger reads policy scalars + list members from the
    // **top-level** form (see _apply_policy_block in app/hs_flyout_merge.py).
    // We therefore flatten our editor inputs onto `form` rather than nesting
    // them inside a UserPolicy / NetworkPolicy dict.  Snake_case keys are
    // accepted by the merger and chosen here for readability.
    maybe(form, "action", valOf(prefix + "-action"));
    maybe(form, "log_traffic", valOf(prefix + "-logtraffic"));
    maybe(form, "skip_local_destined", valOf(prefix + "-skiplocaldest"));
    maybe(form, "schedule", valOf(prefix + "-schedule"));

    // Always emit the list keys (even if empty) so the merger can clear
    // server-side blocks when the user removed everything.
    form.source_zones = collectStringList(prefix + "-srczones-rows");
    form.source_networks = collectStringList(prefix + "-srcnets-rows");
    form.destination_zones = collectStringList(prefix + "-dstzones-rows");
    form.destination_networks = collectStringList(prefix + "-dstnets-rows");
    form.services = collectStringList(prefix + "-services-rows");

    if (includeUserOnly) {
      maybe(form, "match_identity", valOf(prefix + "-matchidentity"));
      maybe(form, "show_captive_portal", valOf(prefix + "-showcaptive"));
      maybe(form, "data_accounting", valOf(prefix + "-dataacct"));
      form.identity = collectStringList(prefix + "-identity-rows");
    }

    maybe(form, "web_filter", valOf(prefix + "-webfilter"));
    maybe(form, "web_category_base_qos_policy", valOf(prefix + "-webqos"));
    maybe(form, "block_quick_quic", valOf(prefix + "-blockquic"));
    maybe(form, "scan_virus", valOf(prefix + "-scanvirus"));
    maybe(form, "zero_day_protection", valOf(prefix + "-zeroday"));
    maybe(form, "scan_ftp", valOf(prefix + "-scanftp"));
    maybe(form, "proxy_mode", valOf(prefix + "-proxy"));
    maybe(form, "decrypt_https", valOf(prefix + "-decrypthttps"));
    maybe(form, "application_control", valOf(prefix + "-appctrl"));
    maybe(form, "application_base_qos_policy", valOf(prefix + "-appqos"));
    maybe(form, "intrusion_prevention", valOf(prefix + "-ips"));
    maybe(form, "traffic_shaping_policy", valOf(prefix + "-tsp"));
    maybe(form, "dscp_marking", valOf(prefix + "-dscp"));

    maybe(form, "scan_smtp", valOf(prefix + "-scansmtp"));
    maybe(form, "scan_smtps", valOf(prefix + "-scansmtps"));
    maybe(form, "scan_imap", valOf(prefix + "-scanimap"));
    maybe(form, "scan_imaps", valOf(prefix + "-scanimaps"));
    maybe(form, "scan_pop3", valOf(prefix + "-scanpop3"));
    maybe(form, "scan_pop3s", valOf(prefix + "-scanpop3s"));

    maybe(form, "source_security_heartbeat", valOf(prefix + "-srchb"));
    maybe(form, "minimum_source_hb_permitted", valOf(prefix + "-minsrchb"));
    maybe(form, "dest_security_heartbeat", valOf(prefix + "-dsthb"));
    maybe(form, "minimum_destination_hb_permitted", valOf(prefix + "-mindsthb"));
  }

  function collectForm() {
    let nm = valOf("gc-fwr-name").trim();
    let pt = valOf("gc-fwr-policytype") || "Network";
    let form = {
      name: nm,
      Name: nm,
      policy_type: pt,
      PolicyType: pt,
    };
    maybe(form, "Description", valOf("gc-fwr-description"));
    maybe(form, "Status", valOf("gc-fwr-status") || "Enable");
    maybe(form, "IPFamily", valOf("gc-fwr-ipfamily") || "IPv4");
    maybe(form, "Section", valOf("gc-fwr-section"));

    // Position is translated by the merger; supply both a Position scalar
    // and the InsertAfter / InsertBefore names so After:/Before: payloads
    // round-trip correctly.
    let pos = valOf("gc-fwr-position").trim();
    if (pos) form.Position = pos;
    let after = valOf("gc-fwr-after").trim();
    let before = valOf("gc-fwr-before").trim();
    if (after) form.AfterName = after;
    if (before) form.BeforeName = before;

    if (pt === "HTTPBased") {
      // Body is read-only — back-end merger preserves the existing block.
      return form;
    }
    collectPolicyFlat(form, "gc-fwr-pol", pt === "User");
    return form;
  }

  // ── Repeating-row click handlers ─────────────────────────────────────

  function setupRepeatableHandlers() {
    let fieldsRoot = shell && shell.getFieldsRoot();
    if (!fieldsRoot) return;
    fieldsRoot.addEventListener("click", function (ev) {
      let t = ev.target;
      if (!t || !t.getAttribute) return;
      let addId = t.getAttribute("data-gc-fwr-stradd");
      if (addId) {
        let root = document.getElementById(addId);
        if (root) {
          let nextIdx = root.children.length;
          let placeholder = t.getAttribute("data-placeholder") || "";
          root.insertAdjacentHTML("beforeend", buildStringRow(addId, nextIdx, "", placeholder));
        }
        return;
      }
      let rmId = t.getAttribute("data-gc-fwr-strrm");
      if (rmId) {
        let parts = rmId.split(":");
        let row = t.closest(".gc-fwr-strrow");
        if (row && row.parentNode) row.parentNode.removeChild(row);
        return;
      }
    });

    // Re-render policy section when policy type changes
    let ptSel = document.getElementById("gc-fwr-policytype");
    if (ptSel) {
      ptSel.addEventListener("change", function () {
        let host = document.getElementById("gc-fwr-policy-section");
        let curr = shell && shell.getCurrentRow();
        if (!host || !curr) return;
        // Build a synthetic row that respects the chosen type so that
        // the right block is read.
        let synth = { flat: Object.assign({}, curr.flat || {}) };
        let chosen = ptSel.value;
        synth.flat.PolicyType = chosen;
        if (chosen === "User" && !synth.flat.UserPolicy) synth.flat.UserPolicy = {};
        if (chosen === "Network" && !synth.flat.NetworkPolicy) synth.flat.NetworkPolicy = {};
        host.innerHTML = buildPolicyEditor(synth);
        applyReadOnlyState();
      });
    }
  }

  function applyReadOnlyState() {
    let pt = valOf("gc-fwr-policytype");
    let isHttp = pt === "HTTPBased";
    let saveBtn = shell && shell.getSaveBtn();
    let readOnlyBanner = shell && shell.getReadOnlyBanner();
    if (saveBtn) {
      // HTTPBased rules can still have header-only updates (Status / Section
      // / Description / Position).  Editing is allowed on add (for symmetry
      // with the firewall-config-viewer reference) but not encouraged.
      saveBtn.disabled = false;
    }
    if (readOnlyBanner) {
      if (isHttp) {
        readOnlyBanner.textContent =
          "HTTPBased rules: only header fields (Status / Section / Position / Description) are sent. The reverse-proxy body is preserved from the firewall.";
        readOnlyBanner.hidden = false;
      } else {
        readOnlyBanner.textContent = "";
        readOnlyBanner.hidden = true;
      }
    }
  }

  // ── Open / close / save lifecycle ─────────────────────────────────────
  //
  // All scaffolding (DOM lookups, save POST, escape-key wiring) lives in
  // gc-rule-flyout-shell.js so the same code is shared with the NAT rule
  // flyout.  We only declare the per-rule cfg here.

  shell = SHELL.create({
    entityType: ENTITY_TYPE,
    flyoutId: "gc-firewall-rule-edit-flyout",
    titleId: "gc-firewall-rule-flyout-title",
    metaId: "gc-firewall-rule-flyout-meta",
    fieldsId: "gc-firewall-rule-flyout-fields",
    closeBtnId: "gc-firewall-rule-flyout-close",
    doneBtnId: "gc-firewall-rule-flyout-done",
    saveBtnId: "gc-firewall-rule-flyout-save",
    readOnlyBannerId: "gc-firewall-rule-flyout-readonly-banner",
    savedEventName: "gc-firewall-rule-saved",
    titleAdd: "Add firewall rule",
    titleEdit: "Edit firewall rule",
    targetSingular: "firewall rule",
    defaultPresets: { PolicyType: "Network", IPFamily: "IPv4", Status: "Enable" },
    buildForm: buildForm,
    setupRepeatableHandlers: setupRepeatableHandlers,
    applyReadOnlyState: applyReadOnlyState,
    collectForm: collectForm,
  });

  globalThis.gcFirewallRuleFlyout = {
    init: shell.init,
    openAdd: shell.openAdd,
    openEditFromTr: shell.openEditFromTr,
  };
})();
