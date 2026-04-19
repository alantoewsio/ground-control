/**
 * NAT rule flyout: Add / Edit forms for `nat_rule`.
 *
 * Submits via the HS task queue (firewall scope) or the configuration-apply
 * endpoints (configuration scope).  Mirrors gc-firewall-rule-flyout.js so
 * the two share styling and behaviour.
 *
 * Schema reference: xml-api-docs/Protect/Firewall/NatRule.md
 *   <NATRule>
 *     <Name/> <Description/> <IPFamily/> <Status/>
 *     <Position/> <After><Name/></After> <Before><Name/></Before>
 *     <LinkedFirewallrule/>
 *     <OriginalSourceNetworks><Network/>...</OriginalSourceNetworks>
 *     <TranslatedSource/>
 *     <OriginalDestinationNetworks><Network/>...</OriginalDestinationNetworks>
 *     <TranslatedDestination/>
 *     <OriginalServices><Service/>...</OriginalServices>
 *     <TranslatedService/>
 *     <InboundInterfaces><Interface/>...</InboundInterfaces>
 *     <OutboundInterfaces><Interface/>...</OutboundInterfaces>
 *     <OverrideInterfaceNATPolicy/>
 *     <InterfaceNATPolicyList>
 *       <Override>
 *         <specific_interface/> <specific_translatedsourceid/>
 *       </Override>...
 *     </InterfaceNATPolicyList>
 *   </NATRule>
 *
 * The Python merger (`merge_nat_rule_form`) reads everything from the
 * top-level form — keys are emitted flat, in either snake_case or PascalCase.
 */
(function () {
  "use strict";

  // Lifecycle and cross-cutting helpers (open/close/save scaffolding,
  // owner-id lookups, isCfg target detection) live in gc-rule-flyout-shell.js
  // so this module shares them with gc-firewall-rule-flyout.js without
  // copy-paste duplication.
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

  const ROW_CLASS = "gc-natr-strrow";
  const DATA_PREFIX = "gc-natr-str";
  function buildStringRow(rowsId, idx, val, placeholder) {
    return SHELL.buildStringRow(ROW_CLASS, DATA_PREFIX, rowsId, idx, val, placeholder);
  }
  function stringListBlock(legendText, rowsId, values, placeholder, addLabel) {
    return SHELL.stringListBlock(ROW_CLASS, DATA_PREFIX, legendText, rowsId, values, placeholder, addLabel);
  }
  function collectStringList(rowsId) {
    return SHELL.collectStringList(ROW_CLASS, rowsId);
  }

  const ENTITY_TYPE = "nat_rule";

  let shell = null;

  // ── InterfaceNATPolicyList override repeating block ───────────────────

  function readOverrideRows(flat) {
    let out = [];
    if (!flat) return out;
    let block = flat.InterfaceNATPolicyList;
    if (!block || typeof block !== "object") return out;
    let raw = block.Override;
    if (raw == null) return out;
    if (!Array.isArray(raw)) raw = [raw];
    raw.forEach(function (r) {
      if (r && typeof r === "object") out.push(r);
    });
    return out;
  }

  function buildOverrideRow(idx, row) {
    row = row || {};
    let iface = row.specific_interface || row.specificInterface || "";
    let xlat = row.specific_translatedsourceid || row.specificTranslatedSourceId || "";
    return '<div class="gc-natr-ovr-row" data-idx="' + idx + '" style="border:1px solid var(--surface-3);padding:8px;margin-bottom:8px;border-radius:4px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<div>' + fieldRow("Outbound interface", textInput("gc-natr-ovr-iface-" + idx, iface, { mono: true, placeholder: "Port1" }), { required: true }) + '</div>' +
      '<div>' + fieldRow("Translated source", textInput("gc-natr-ovr-xlat-" + idx, xlat, { mono: true, placeholder: "Original / MASQ / IPHost / IPRange" })) + '</div>' +
      '</div>' +
      '<button type="button" class="btn btn--secondary" data-gc-natr-ovr-remove="' + idx + '" style="margin-top:6px">Remove override</button>' +
      '</div>';
  }

  function collectOverrideRows() {
    let out = [];
    document.querySelectorAll("#gc-natr-ovr-rows .gc-natr-ovr-row").forEach(function (el) {
      let i = el.dataset.idx;
      let row = {
        specific_interface:
          (document.getElementById("gc-natr-ovr-iface-" + i) || {}).value || "",
        specific_translatedsourceid:
          (document.getElementById("gc-natr-ovr-xlat-" + i) || {}).value || "",
      };
      row.specific_interface = String(row.specific_interface).trim();
      row.specific_translatedsourceid = String(row.specific_translatedsourceid).trim();
      if (row.specific_interface || row.specific_translatedsourceid) out.push(row);
    });
    return out;
  }

  // ── Common option lists ──────────────────────────────────────────────

  const ENABLE_DISABLE = [{ value: "Enable", label: "Enable" }, { value: "Disable", label: "Disable" }];
  const POSITION_OPTS = [
    { value: "top", label: "Top" },
    { value: "bottom", label: "Bottom" },
    { value: "after", label: "After…" },
    { value: "before", label: "Before…" },
  ];
  const TRANS_SRC_PRESETS = [
    { value: "", label: "(custom — type below)" },
    { value: "Original", label: "Original" },
    { value: "MASQ", label: "MASQ" },
  ];

  // ── Form builder ─────────────────────────────────────────────────────

  function buildForm(row, isAdd) {
    let f = (row && row.flat) || {};
    let nameEditable = isAdd;
    let html = "";

    // Identity & placement
    let identityInner = "";
    identityInner += fieldRow("Name", textInput("gc-natr-name", pick(f, ["Name"]), { disabled: !nameEditable }), { required: true });
    identityInner += fieldRow("Description", textArea("gc-natr-description", pick(f, ["Description"])));
    identityInner += fieldRow("Status", selectInput("gc-natr-status", pick(f, ["Status"]) || "Enable", ENABLE_DISABLE));
    identityInner += fieldRow("IP family", selectInput("gc-natr-ipfamily", pick(f, ["IPFamily"]) || "IPv4", [
      { value: "IPv4", label: "IPv4" },
      { value: "IPv6", label: "IPv6" },
    ]), { required: true });
    identityInner += fieldRow("Linked firewall rule", textInput("gc-natr-linked", pick(f, ["LinkedFirewallrule", "LinkedFirewallRule"]), { mono: true }), { hint: "Optional. Name of an existing firewall rule to bind this NAT rule to." });
    let pos = pick(f, ["Position"]);
    let after = "";
    let before = "";
    if (f.After && typeof f.After === "object") after = String(f.After.Name || "").trim();
    if (f.Before && typeof f.Before === "object") before = String(f.Before.Name || "").trim();
    identityInner += fieldRow("Position", selectInput("gc-natr-position", pos || (isAdd ? "bottom" : ""), POSITION_OPTS));
    identityInner += fieldRow("After (rule name)", textInput("gc-natr-after", after, { mono: true }), { hint: "Used when position = after." });
    identityInner += fieldRow("Before (rule name)", textInput("gc-natr-before", before, { mono: true }), { hint: "Used when position = before." });
    html += fieldset("Identity & placement", identityInner);

    // Original / Translated source
    let srcNets = readStringList(f, "OriginalSourceNetworks", "Network");
    html += stringListBlock("Original source networks", "gc-natr-orig-src-rows", srcNets, "host or group", "Add source");
    let curTsrc = pick(f, ["TranslatedSource"]);
    let tsrcInner = "";
    tsrcInner += fieldRow("Translated source preset", selectInput("gc-natr-tsrc-preset", (curTsrc === "Original" || curTsrc === "MASQ") ? curTsrc : "", TRANS_SRC_PRESETS));
    tsrcInner += fieldRow("Translated source", textInput("gc-natr-tsrc", curTsrc, { mono: true, placeholder: "Original / MASQ / IPHost / IPRange / IPList / FQDN" }));
    html += fieldset("Translated source", tsrcInner);

    // Original / Translated destination
    let dstNets = readStringList(f, "OriginalDestinationNetworks", "Network");
    html += stringListBlock("Original destination networks", "gc-natr-orig-dst-rows", dstNets, "host or group", "Add destination");
    html += fieldset("Translated destination",
      fieldRow("Translated destination", textInput("gc-natr-tdst", pick(f, ["TranslatedDestination"]), { mono: true, placeholder: "Original / IPAddress / IPRange / IPList / FQDN" })));

    // Original / Translated services
    let svcs = readStringList(f, "OriginalServices", "Service");
    html += stringListBlock("Original services", "gc-natr-orig-svc-rows", svcs, "service or service group", "Add service");
    html += fieldset("Translated service",
      fieldRow("Translated service", textInput("gc-natr-tsvc", pick(f, ["TranslatedService"]), { mono: true, placeholder: "Original / TCPUDP_Service" })));

    // Inbound / Outbound interfaces
    let inI = readStringList(f, "InboundInterfaces", "Interface");
    html += stringListBlock("Inbound interfaces", "gc-natr-in-iface-rows", inI, "Port1 / VLAN10", "Add interface");
    let outI = readStringList(f, "OutboundInterfaces", "Interface");
    html += stringListBlock("Outbound interfaces", "gc-natr-out-iface-rows", outI, "Port1 / VLAN10", "Add interface");

    // Override block
    let ovr = pick(f, ["OverrideInterfaceNATPolicy"]) || "Disable";
    let ovrInner = "";
    ovrInner += fieldRow("Override interface NAT policy", selectInput("gc-natr-override", ovr, ENABLE_DISABLE), { hint: "When Enable, the per-interface overrides below take precedence over the rule's translated source." });
    let rows = readOverrideRows(f);
    let ovrRowsHtml = '<div id="gc-natr-ovr-rows">';
    rows.forEach(function (r, i) { ovrRowsHtml += buildOverrideRow(i, r); });
    ovrRowsHtml += '</div><button type="button" id="gc-natr-ovr-add" class="btn btn--secondary">Add per-interface override</button>';
    ovrInner += ovrRowsHtml;
    html += fieldset("Per-interface overrides", ovrInner);

    return html;
  }

  // ── Form collector ───────────────────────────────────────────────────

  function valOf(id) {
    let el = document.getElementById(id);
    return el ? String(el.value || "") : "";
  }

  function maybe(form, key, val) {
    if (val === "" || val == null) return;
    form[key] = val;
  }

  function collectForm() {
    let nm = valOf("gc-natr-name").trim();
    let form = {
      name: nm,
      Name: nm,
    };
    maybe(form, "Description", valOf("gc-natr-description"));
    maybe(form, "Status", valOf("gc-natr-status") || "Enable");
    maybe(form, "IPFamily", valOf("gc-natr-ipfamily") || "IPv4");
    let linked = valOf("gc-natr-linked").trim();
    if (linked) form.LinkedFirewallrule = linked;

    // Position translation handled by merger.
    let pos = valOf("gc-natr-position").trim();
    if (pos) form.Position = pos;
    let after = valOf("gc-natr-after").trim();
    let before = valOf("gc-natr-before").trim();
    if (after) form.AfterName = after;
    if (before) form.BeforeName = before;

    form.original_source_networks = collectStringList("gc-natr-orig-src-rows");
    form.original_destination_networks = collectStringList("gc-natr-orig-dst-rows");
    form.original_services = collectStringList("gc-natr-orig-svc-rows");
    form.inbound_interfaces = collectStringList("gc-natr-in-iface-rows");
    form.outbound_interfaces = collectStringList("gc-natr-out-iface-rows");

    // Translated source: prefer explicit text, fall back to preset.
    let tsrc = valOf("gc-natr-tsrc").trim();
    let tsrcPreset = valOf("gc-natr-tsrc-preset").trim();
    let chosen = tsrc || tsrcPreset;
    if (chosen) form.TranslatedSource = chosen;

    let tdst = valOf("gc-natr-tdst").trim();
    if (tdst) form.TranslatedDestination = tdst;
    let tsvc = valOf("gc-natr-tsvc").trim();
    if (tsvc) form.TranslatedService = tsvc;

    let ovr = valOf("gc-natr-override").trim();
    if (ovr) form.OverrideInterfaceNATPolicy = ovr;

    // The merger key is `interface_nat_policy_overrides` (snake) — see
    // _apply_interface_nat_policy_list in app/hs_flyout_merge.py.
    form.interface_nat_policy_overrides = collectOverrideRows();

    return form;
  }

  // ── Repeating-row click handlers ─────────────────────────────────────

  function setupRepeatableHandlers() {
    let fieldsRoot = shell && shell.getFieldsRoot();
    if (!fieldsRoot) return;
    fieldsRoot.addEventListener("click", function (ev) {
      let t = ev.target;
      if (!t || !t.getAttribute) return;

      let addId = t.getAttribute("data-gc-natr-stradd");
      if (addId) {
        let root = document.getElementById(addId);
        if (root) {
          let nextIdx = root.children.length;
          let placeholder = t.getAttribute("data-placeholder") || "";
          root.insertAdjacentHTML("beforeend", buildStringRow(addId, nextIdx, "", placeholder));
        }
        return;
      }

      let rmStr = t.getAttribute("data-gc-natr-strrm");
      if (rmStr) {
        let row = t.closest(".gc-natr-strrow");
        if (row && row.parentNode) row.parentNode.removeChild(row);
        return;
      }

      let rmOvr = t.getAttribute("data-gc-natr-ovr-remove");
      if (rmOvr != null) {
        let row = t.closest(".gc-natr-ovr-row");
        if (row && row.parentNode) row.parentNode.removeChild(row);
        return;
      }
    });

    let ovrAddBtn = document.getElementById("gc-natr-ovr-add");
    if (ovrAddBtn) {
      ovrAddBtn.addEventListener("click", function () {
        let root = document.getElementById("gc-natr-ovr-rows");
        if (!root) return;
        let nextIdx = root.children.length;
        root.insertAdjacentHTML("beforeend", buildOverrideRow(nextIdx, {}));
      });
    }

    // Sync the preset selector → text field when user picks Original/MASQ.
    let presetSel = document.getElementById("gc-natr-tsrc-preset");
    if (presetSel) {
      presetSel.addEventListener("change", function () {
        let v = presetSel.value || "";
        let inp = document.getElementById("gc-natr-tsrc");
        if (inp && (v === "Original" || v === "MASQ")) inp.value = v;
      });
    }
  }

  // ── Open / close / save lifecycle ─────────────────────────────────────
  //
  // All scaffolding lives in gc-rule-flyout-shell.js so this file only
  // declares the per-rule cfg the shell needs.

  shell = SHELL.create({
    entityType: ENTITY_TYPE,
    flyoutId: "gc-nat-rule-edit-flyout",
    titleId: "gc-nat-rule-flyout-title",
    metaId: "gc-nat-rule-flyout-meta",
    fieldsId: "gc-nat-rule-flyout-fields",
    closeBtnId: "gc-nat-rule-flyout-close",
    doneBtnId: "gc-nat-rule-flyout-done",
    saveBtnId: "gc-nat-rule-flyout-save",
    savedEventName: "gc-nat-rule-saved",
    titleAdd: "Add NAT rule",
    titleEdit: "Edit NAT rule",
    targetSingular: "NAT rule",
    defaultPresets: { IPFamily: "IPv4", Status: "Enable", OverrideInterfaceNATPolicy: "Disable" },
    buildForm: buildForm,
    setupRepeatableHandlers: setupRepeatableHandlers,
    collectForm: collectForm,
  });

  globalThis.gcNatRuleFlyout = {
    init: shell.init,
    openAdd: shell.openAdd,
    openEditFromTr: shell.openEditFromTr,
  };
})();
