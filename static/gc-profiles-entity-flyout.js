/**
 * Profiles · policy entities — shared flyout (schedule, access time, quotas, VPN).
 */
(function () {
  "use strict";

  function bannerResult(ok, msg) {
    if (typeof globalThis.gcGlobalBannerShowResult === "function") {
      globalThis.gcGlobalBannerShowResult(ok, msg);
    } else {
      alert(msg);
    }
  }

  function dispatchTaskQueueUpdated() {
    try {
      document.dispatchEvent(new CustomEvent("gc-task-queue-updated"));
    } catch (e0) {}
  }

  function val(id) {
    let el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  function checked(id) {
    let el = document.getElementById(id);
    return !!(el && el.checked);
  }

  function setVal(id, v) {
    let el = document.getElementById(id);
    if (el) el.value = v != null ? String(v) : "";
  }

  function setChecked(id, on) {
    let el = document.getElementById(id);
    if (el) el.checked = !!on;
  }

  function radioVal(name) {
    let el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? String(el.value || "").trim() : "";
  }

  function setRadio(name, v) {
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (inp) {
      inp.checked = String(inp.value) === String(v);
    });
  }

  function textScalar(x) {
    if (x == null) return "";
    if (typeof x === "object" && x["#text"] != null) return String(x["#text"]).trim();
    return String(x).trim();
  }

  let ACCESS_TIME_SCHEDULE_DEFAULT = "All the time";
  let ACCESS_TIME_SCHEDULE_CHOICES = [
    "All the time",
    "Work hours (5 Day week)",
    "Work hours (6 Day week)",
    "All Time on Weekdays",
    "All Time on Weekends",
    "All Time on Sunday",
    "All Days 10:00 to 19:00",
  ];

  function atScheduleClearDynamicOption() {
    let sel = document.getElementById("gc-pe-at-schedule");
    if (!sel) return;
    let o = sel.querySelector('option[data-gc-at-schedule-dynamic="1"]');
    if (o) o.remove();
  }

  function atScheduleCanonicalFromRaw(raw) {
    raw = String(raw || "").trim();
    if (!raw) return ACCESS_TIME_SCHEDULE_DEFAULT;
    let lower = raw.toLowerCase();
    for (let i = 0; i < ACCESS_TIME_SCHEDULE_CHOICES.length; i++) {
      if (ACCESS_TIME_SCHEDULE_CHOICES[i].toLowerCase() === lower) return ACCESS_TIME_SCHEDULE_CHOICES[i];
    }
    return raw;
  }

  function setAccessTimeScheduleValue(raw) {
    let sel = document.getElementById("gc-pe-at-schedule");
    if (!sel) return;
    atScheduleClearDynamicOption();
    let canon = atScheduleCanonicalFromRaw(raw);
    let inList = false;
    for (let j = 0; j < ACCESS_TIME_SCHEDULE_CHOICES.length; j++) {
      if (ACCESS_TIME_SCHEDULE_CHOICES[j] === canon) {
        inList = true;
        break;
      }
    }
    if (!inList && canon) {
      let opt = document.createElement("option");
      opt.value = canon;
      opt.textContent = canon;
      opt.setAttribute("data-gc-at-schedule-dynamic", "1");
      sel.appendChild(opt);
    }
    setVal("gc-pe-at-schedule", canon);
  }

  let SCHED_DAY_OPTIONS = [
    { v: "", l: "Select day…" },
    { v: "Sunday", l: "Sunday" },
    { v: "Monday", l: "Monday" },
    { v: "Tuesday", l: "Tuesday" },
    { v: "Wednesday", l: "Wednesday" },
    { v: "Thursday", l: "Thursday" },
    { v: "Friday", l: "Friday" },
    { v: "Saturday", l: "Saturday" },
    { v: "Week Days", l: "Weekdays" },
    { v: "Weekdays Including Saturday", l: "Weekdays including Saturday" },
    { v: "All Days of week", l: "All days of the week" },
  ];

  function schedNormalizeDaysApi(raw) {
    let s = String(raw || "").trim();
    if (!s) return "";
    let compact = s.replace(/\s+/g, "").toLowerCase();
    if (compact === "weekdays" || s === "WeekDays") return "Week Days";
    if (compact === "weekdaysincludingsaturday") return "Weekdays Including Saturday";
    if (compact === "alldaysofweek" || compact === "alldaysoftheweek") return "All Days of week";
    return s;
  }

  function schedNormalizeTime(t) {
    let s = String(t || "").trim();
    if (!s) return "";
    if (s === "23:59" || s === "23:59:00") return "23:59";
    let m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return "";
    let h = parseInt(m[1], 10);
    let min = parseInt(m[2], 10);
    if (isNaN(h) || isNaN(min)) return "";
    let q = Math.round((h * 60 + min) / 15);
    let tmin = q * 15;
    if (tmin >= 24 * 60) return "23:59";
    let nh = Math.floor(tmin / 60);
    let nm = tmin % 60;
    return (nh < 10 ? "0" : "") + nh + ":" + (nm < 10 ? "0" : "") + nm;
  }

  function schedApiDatetimeToLocalInput(s) {
    let t = String(s || "").trim();
    if (!t) return "";
    let m = t.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return "";
    return m[1] + "T" + m[2] + ":" + m[3];
  }

  function schedLocalDatetimeToApi(s) {
    let t = String(s || "").trim();
    if (!t) return "";
    let m = t.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (!m) return t;
    return m[1] + " " + m[2] + ":" + m[3] + ":00";
  }

  function schedMakeTimeSelect(extraClass, value) {
    let sel = document.createElement("select");
    sel.className = "gc-if-flyout__input gc-if-flyout__select " + (extraClass || "");
    let o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "—";
    sel.appendChild(o0);
    let want = schedNormalizeTime(value);
    let found = false;
    let q;
    for (q = 0; q < 96; q++) {
      let h = (q / 4) | 0;
      let min = (q % 4) * 15;
      let hh = h < 10 ? "0" + h : String(h);
      let mm = min < 10 ? "0" + min : String(min);
      let val = hh + ":" + mm;
      let opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      if (want === val) {
        opt.selected = true;
        found = true;
      }
      sel.appendChild(opt);
    }
    let o59 = document.createElement("option");
    o59.value = "23:59";
    o59.textContent = "23:59";
    if (want === "23:59") {
      o59.selected = true;
      found = true;
    }
    sel.appendChild(o59);
    if (want && !found) {
      let ox = document.createElement("option");
      ox.value = want;
      ox.textContent = want;
      ox.selected = true;
      sel.insertBefore(ox, sel.firstChild.nextSibling);
    }
    return sel;
  }

  function schedAppendDetailRow(tbody, initial) {
    initial = initial || {};
    let tr = document.createElement("tr");
    tr.setAttribute("data-gc-pe-sched-detail-row", "1");
    let tdD = document.createElement("td");
    let selD = document.createElement("select");
    selD.className = "gc-if-flyout__input gc-if-flyout__select gc-pe-sched-detail-days";
    let dayVal = schedNormalizeDaysApi(initial.Days);
    SCHED_DAY_OPTIONS.forEach(function (o) {
      let opt = document.createElement("option");
      opt.value = o.v;
      opt.textContent = o.l;
      if (o.v === dayVal) opt.selected = true;
      selD.appendChild(opt);
    });
    tdD.appendChild(selD);
    let tdS = document.createElement("td");
    tdS.appendChild(schedMakeTimeSelect("gc-pe-sched-detail-start", initial.StartTime));
    let tdE = document.createElement("td");
    tdE.appendChild(schedMakeTimeSelect("gc-pe-sched-detail-stop", initial.StopTime));
    let tdR = document.createElement("td");
    tdR.className = "gc-pe-sched-detail-table__actions";
    let btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gc-pe-sched-detail-remove";
    btn.setAttribute("aria-label", "Remove period");
    btn.innerHTML =
      '<svg class="gc-pe-sched-detail-remove__svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
      '<path fill="currentColor" d="M8 12h8v1H8z"/>' +
      "</svg>";
    tdR.appendChild(btn);
    tr.appendChild(tdD);
    tr.appendChild(tdS);
    tr.appendChild(tdE);
    tr.appendChild(tdR);
    tbody.appendChild(tr);
  }

  function schedRowIsEmpty(tr) {
    let days = tr.querySelector(".gc-pe-sched-detail-days");
    let st = tr.querySelector(".gc-pe-sched-detail-start");
    let sp = tr.querySelector(".gc-pe-sched-detail-stop");
    return (
      (!days || !String(days.value || "").trim()) &&
      (!st || !String(st.value || "").trim()) &&
      (!sp || !String(sp.value || "").trim())
    );
  }

  function schedPruneExtraEmptyRows(tbody) {
    let rows = Array.prototype.slice.call(tbody.querySelectorAll("tr[data-gc-pe-sched-detail-row]"));
    while (
      rows.length >= 2 &&
      schedRowIsEmpty(rows[rows.length - 1]) &&
      schedRowIsEmpty(rows[rows.length - 2])
    ) {
      tbody.removeChild(rows[rows.length - 1]);
      rows.pop();
    }
  }

  function schedEnsureTrailingBlank(tbody) {
    if (!tbody) return;
    let rows = tbody.querySelectorAll("tr[data-gc-pe-sched-detail-row]");
    if (!rows.length) {
      schedAppendDetailRow(tbody, {});
      return;
    }
    let last = rows[rows.length - 1];
    if (!schedRowIsEmpty(last)) schedAppendDetailRow(tbody, {});
    schedPruneExtraEmptyRows(tbody);
  }

  function schedClearAndLoadDetails(details) {
    let tbody = document.getElementById("gc-pe-sched-detail-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    let list = Array.isArray(details) ? details : details && typeof details === "object" ? [details] : [];
    if (!list.length) {
      schedAppendDetailRow(tbody, {});
      schedEnsureTrailingBlank(tbody);
      return;
    }
    list.forEach(function (d) {
      schedAppendDetailRow(tbody, {
        Days: d && d.Days,
        StartTime: d && d.StartTime,
        StopTime: d && d.StopTime,
      });
    });
    schedEnsureTrailingBlank(tbody);
  }

  function schedCollectDetailRows() {
    let tbody = document.getElementById("gc-pe-sched-detail-tbody");
    if (!tbody) return [];
    let out = [];
    tbody.querySelectorAll("tr[data-gc-pe-sched-detail-row]").forEach(function (tr) {
      let days = tr.querySelector(".gc-pe-sched-detail-days");
      let st = tr.querySelector(".gc-pe-sched-detail-start");
      let sp = tr.querySelector(".gc-pe-sched-detail-stop");
      let d = days && days.value ? String(days.value).trim() : "";
      let a = st && st.value ? String(st.value).trim() : "";
      let b = sp && sp.value ? String(sp.value).trim() : "";
      if (d && a && b) out.push({ Days: d, StartTime: a, StopTime: b });
    });
    return out;
  }

  function syncSchedTypeVisibility() {
    let one = radioVal("gc-pe-sched-type") === "OneTime";
    let ot = document.getElementById("gc-pe-sched-onetime-wrap");
    let rec = document.getElementById("gc-pe-sched-recurring-wrap");
    if (ot) ot.hidden = !one;
    if (rec) rec.hidden = one;
  }

  function schedRemoveDetailRow(btn) {
    let tr = btn && btn.closest ? btn.closest("tr") : null;
    let tbody = tr && tr.parentElement;
    if (!tbody) return;
    let rows = tbody.querySelectorAll("tr[data-gc-pe-sched-detail-row]");
    if (rows.length <= 1) {
      tr.querySelectorAll("select").forEach(function (s) {
        s.value = "";
      });
      schedEnsureTrailingBlank(tbody);
      return;
    }
    tr.remove();
    schedEnsureTrailingBlank(tbody);
  }

  function validateScheduleClientPayload(type, payload) {
    if (type === "OneTime") {
      if (!payload.StartDate || !payload.EndDate) {
        return "Start date and end date are required for a one-time schedule.";
      }
      return "";
    }
    let det =
      payload.ScheduleDetails &&
      payload.ScheduleDetails.ScheduleDetail &&
      Array.isArray(payload.ScheduleDetails.ScheduleDetail)
        ? payload.ScheduleDetails.ScheduleDetail
        : [];
    if (!det.length) {
      return "Add at least one recurring period with days, start time, and stop time.";
    }
    return "";
  }

  function collectPeFirewallIds(ms) {
    if (!ms) return [];
    let out = [];
    ms.querySelectorAll('input[type="checkbox"][data-gc-fw-id]').forEach(function (cb) {
      if (!cb.checked) return;
      let n = parseInt(String(cb.dataset.gcFwId || ""), 10);
      if (!isNaN(n) && n > 0) out.push(n);
    });
    return out;
  }

  function sectionIdForEntityType(et) {
    if (et === "schedule") return "gc-pe-section-schedule";
    if (et === "access_time_policy") return "gc-pe-section-at";
    if (et === "surfing_quota_policy") return "gc-pe-section-sq";
    if (et === "data_transfer_policy") return "gc-pe-section-dt";
    if (et === "vpn_profile") return "gc-pe-section-vpn";
    return null;
  }

  function vpnCollectDhGroups() {
    let optsRoot = document.getElementById("gc-pe-vpn-dh-options");
    if (!optsRoot) return [];
    let out = [];
    optsRoot.querySelectorAll('input[type="checkbox"][data-gc-vpn-dh]:checked').forEach(function (cb) {
      out.push(cb.value);
    });
    return out;
  }

  function vpnSyncDhTriggerText() {
    let n = vpnCollectDhGroups().length;
    let sp = document.getElementById("gc-pe-vpn-dh-trigger-text");
    if (sp) sp.textContent = n === 0 ? "Select DH groups…" : n + " selected";
  }

  function vpnCloseDhDropdown() {
    let dropdown = document.getElementById("gc-pe-vpn-dh-dropdown");
    let trigger = document.getElementById("gc-pe-vpn-dh-trigger");
    if (dropdown) dropdown.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function vpnClearDhMultiselectDynamic() {
    let optsRoot = document.getElementById("gc-pe-vpn-dh-options");
    if (!optsRoot) return;
    optsRoot.querySelectorAll(".gc-pe-vpn-dh-option[data-gc-vpn-dh-dynamic]").forEach(function (lab) {
      lab.remove();
    });
  }

  function vpnFindDhCheckbox(optsRoot, v) {
    let cbs = optsRoot.querySelectorAll('input[type="checkbox"][data-gc-vpn-dh]');
    let i;
    for (i = 0; i < cbs.length; i++) {
      if (cbs[i].value === v) return cbs[i];
    }
    return null;
  }

  function vpnHydrateDhMultiselect(dhl) {
    let optsRoot = document.getElementById("gc-pe-vpn-dh-options");
    if (!optsRoot) return;
    vpnClearDhMultiselectDynamic();
    optsRoot.querySelectorAll('input[type="checkbox"][data-gc-vpn-dh]').forEach(function (cb) {
      cb.checked = false;
    });
    if (!Array.isArray(dhl)) dhl = [];
    dhl.forEach(function (raw) {
      let v = textScalar(raw);
      if (!v) return;
      let cb = vpnFindDhCheckbox(optsRoot, v);
      if (cb) {
        cb.checked = true;
        return;
      }
      let lab = document.createElement("label");
      lab.className = "gc-multiselect__option gc-pe-vpn-dh-option";
      lab.setAttribute("data-gc-vpn-dh-dynamic", "1");
      cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = v;
      cb.setAttribute("data-gc-vpn-dh", "1");
      cb.checked = true;
      let tx = document.createElement("span");
      tx.textContent = v;
      lab.appendChild(cb);
      lab.appendChild(tx);
      optsRoot.appendChild(lab);
    });
    vpnSyncDhTriggerText();
  }

  function vpnInitPeVpnDhMs() {
    let msRoot = document.getElementById("gc-pe-vpn-dh-root");
    if (!msRoot || msRoot.dataset.gcPeVpnDhUi === "1") return;
    msRoot.setAttribute("data-gc-pe-vpn-dh-ui", "1");
    let trigger = document.getElementById("gc-pe-vpn-dh-trigger");
    let dropdown = document.getElementById("gc-pe-vpn-dh-dropdown");
    let optsRoot = document.getElementById("gc-pe-vpn-dh-options");
    function setOpen(open) {
      if (dropdown) dropdown.hidden = !open;
      if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (trigger && dropdown) {
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(!!dropdown.hidden);
      });
    }
    if (dropdown) {
      dropdown.addEventListener("mousedown", function (e) {
        e.stopPropagation();
      });
    }
    if (optsRoot) {
      optsRoot.addEventListener("change", function (e) {
        let t = e.target;
        if (t && t.matches && t.matches('input[type="checkbox"][data-gc-vpn-dh]')) {
          vpnSyncDhTriggerText();
        }
      });
    }
    document.addEventListener("click", function (e) {
      if (!dropdown || dropdown.hidden) return;
      let node = e.target;
      if (!(node instanceof Node)) return;
      if (!msRoot.contains(node)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!dropdown || dropdown.hidden) return;
      setOpen(false);
    });
  }

  function vpnClearSelectDynamic(selId) {
    let sel = document.getElementById(selId);
    if (!sel) return;
    sel.querySelectorAll("option[data-gc-vpn-opt-dynamic]").forEach(function (o) {
      o.remove();
    });
  }

  function vpnEnsureSelectValue(selId, raw) {
    let v = textScalar(raw);
    let sel = document.getElementById(selId);
    if (!sel) return;
    if (v === "") {
      setVal(selId, "");
      return;
    }
    let found = false;
    let i;
    for (i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === v) {
        found = true;
        break;
      }
    }
    if (!found) {
      let opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      opt.setAttribute("data-gc-vpn-opt-dynamic", "1");
      sel.appendChild(opt);
    }
    setVal(selId, v);
  }

  function vpnNormalizePfsApi(raw) {
    let s = String(raw == null ? "" : raw).trim();
    if (!s) return "";
    let compact = s.toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
    if (compact === "sameasphase1" || compact === "sameasphasei") return "SameasPhase-I";
    if (compact === "none") return "None";
    return s;
  }

  function syncVpnDpdUi() {
    let on = checked("gc-pe-vpn-dpd");
    ["gc-pe-vpn-dpd-every", "gc-pe-vpn-dpd-wait", "gc-pe-vpn-dpd-act"].forEach(function (id) {
      let el = document.getElementById(id);
      if (el) el.disabled = !on;
    });
  }

  function collectPayload(et) {
    if (et === "schedule") {
      let type = radioVal("gc-pe-sched-type");
      let o = {
        Name: val("gc-pe-sched-name"),
        Description: val("gc-pe-sched-desc") || null,
        Type: type,
      };
      if (type === "OneTime") {
        let sdOne = schedLocalDatetimeToApi(val("gc-pe-sched-start"));
        let edOne = schedLocalDatetimeToApi(val("gc-pe-sched-end"));
        o.StartDate = sdOne || null;
        o.EndDate = edOne || null;
        o.ScheduleDetails = {
          StartDate: sdOne || null,
          EndDate: edOne || null,
          ScheduleDetail: null,
        };
      } else {
        o.StartDate = null;
        o.EndDate = null;
        let detList = schedCollectDetailRows();
        o.ScheduleDetails = {
          StartDate: null,
          EndDate: null,
          ScheduleDetail: detList.length ? detList : [],
        };
      }
      return o;
    }
    if (et === "access_time_policy") {
      return {
        Name: val("gc-pe-at-name"),
        Description: val("gc-pe-at-desc") || null,
        Strategy: val("gc-pe-at-strategy") || "Allow",
        Schedule: val("gc-pe-at-schedule") || ACCESS_TIME_SCHEDULE_DEFAULT,
      };
    }
    if (et === "surfing_quota_policy") {
      let cycSq = val("gc-pe-sq-cycle");
      let oSq = {
        Name: val("gc-pe-sq-name"),
        Description: val("gc-pe-sq-desc") || null,
        CycleType: cycSq,
        PerDay: val("gc-pe-sq-period") || null,
      };
      if (cycSq === "NonCyclic") {
        oSq.CycleHours = null;
        oSq.CycleMinutes = "0";
      } else {
        let chSq = val("gc-pe-sq-ch");
        oSq.CycleHours = chSq === "" ? null : chSq;
        let cmSq = val("gc-pe-sq-cm");
        oSq.CycleMinutes = cmSq === "" ? "0" : cmSq;
      }
      if (checked("gc-pe-sq-val-unl")) {
        oSq.Validity = "Unlimited";
      } else {
        let moSq = parseInt(val("gc-pe-sq-val-months"), 10);
        let daysSq = moSq * 30;
        if (daysSq > SQ_VALIDITY_MAX_DAYS) daysSq = SQ_VALIDITY_MAX_DAYS;
        oSq.Validity = String(daysSq);
      }
      if (checked("gc-pe-sq-mxh-unl")) {
        oSq.MaximumHours = "Unlimited";
        oSq.Minutes = null;
      } else {
        oSq.MaximumHours = val("gc-pe-sq-mxh-hours");
        oSq.Minutes = val("gc-pe-sq-mxh-min");
      }
      return oSq;
    }
    if (et === "data_transfer_policy") {
      let rest = radioVal("gc-pe-dt-restrict");
      let cyc = radioVal("gc-pe-dt-cyclic");
      let o = {
        Name: val("gc-pe-dt-name"),
        Description: val("gc-pe-dt-desc") || null,
        RestrictionBasedOn: rest,
        CycleType: cyc,
        CyclePeriod: val("gc-pe-dt-period"),
      };
      if (rest === "TotalDataTransfer") {
        o.CycleDataTransferInMB = val("gc-pe-dt-cycmb") || null;
        if (checked("gc-pe-dt-max-unl")) o.MaximumDataTransfer = "Unlimited";
        else o.MaximumDataTransferInMB = val("gc-pe-dt-maxmb") || null;
      } else {
        if (checked("gc-pe-dt-cu-unl")) o.CycleUploadDataTransfer = "Unlimited";
        else o.CycleUploadDataTransferInMB = val("gc-pe-dt-cumb") || null;
        if (checked("gc-pe-dt-cd-unl")) o.CycleDownloadDataTransfer = "Unlimited";
        else o.CycleDownloadDataTransferInMB = val("gc-pe-dt-cdmb") || null;
        if (checked("gc-pe-dt-mu-unl")) o.MaximumUploadDataTransfer = "Unlimited";
        else o.MaximumUploadDataTransferInMB = val("gc-pe-dt-mumb") || null;
        if (checked("gc-pe-dt-md-unl")) o.MaximumDownloadDataTransfer = "Unlimited";
        else o.MaximumDownloadDataTransferInMB = val("gc-pe-dt-mdmb") || null;
      }
      return o;
    }
    if (et === "vpn_profile") {
      let dhs = vpnCollectDhGroups();
      let p1 = {
        KeyLife: val("gc-pe-vpn-p1-kl"),
        ReKeyMargin: val("gc-pe-vpn-p1-rm"),
        "RandomizeRe-KeyingMarginBy": val("gc-pe-vpn-p1-rnd"),
        EncryptionAlgorithm1: val("gc-pe-vpn-p1-enc"),
        AuthenticationAlgorithm1: val("gc-pe-vpn-p1-auth"),
      };
      if (dhs.length === 1) p1.SupportedDHGroups = { DHGroup: dhs[0] };
      else if (dhs.length > 1) p1.SupportedDHGroups = { DHGroup: dhs };
      p1.DeadPeerDetection = checked("gc-pe-vpn-dpd") ? "Enable" : "Disable";
      if (checked("gc-pe-vpn-dpd")) {
        p1.CheckPeerAfterEvery = val("gc-pe-vpn-dpd-every");
        p1.WaitForResponseUpto = val("gc-pe-vpn-dpd-wait");
        p1.ActionWhenPeerUnreachable = val("gc-pe-vpn-dpd-act");
      }
      let pfsV = val("gc-pe-vpn-p2-pfs");
      let p2 = {
        PFSGroup: pfsV === "" ? null : pfsV,
        KeyLife: val("gc-pe-vpn-p2-kl"),
        EncryptionAlgorithm1: val("gc-pe-vpn-p2-enc"),
        AuthenticationAlgorithm1: val("gc-pe-vpn-p2-auth"),
      };
      return {
        Name: val("gc-pe-vpn-name"),
        Description: val("gc-pe-vpn-desc") || null,
        KeyingMethod: val("gc-pe-vpn-keying"),
        AllowReKeying: val("gc-pe-vpn-rekey"),
        KeyNegotiationTries: val("gc-pe-vpn-tries") || "0",
        AuthenticationMode: val("gc-pe-vpn-authmode"),
        Phase1: p1,
        Phase2: p2,
      };
    }
    return {};
  }

  function hydrate(et, p) {
    p = p && typeof p === "object" ? p : {};
    if (et === "schedule") {
      setVal("gc-pe-sched-name", textScalar(p.Name));
      setVal("gc-pe-sched-desc", textScalar(p.Description));
      let ty = textScalar(p.Type) || "Recurring";
      setRadio("gc-pe-sched-type", ty);
      let sdRoot = p.ScheduleDetails && typeof p.ScheduleDetails === "object" ? p.ScheduleDetails : {};
      let startApi = textScalar(p.StartDate) || textScalar(sdRoot.StartDate);
      let endApi = textScalar(p.EndDate) || textScalar(sdRoot.EndDate);
      setVal("gc-pe-sched-start", schedApiDatetimeToLocalInput(startApi));
      setVal("gc-pe-sched-end", schedApiDatetimeToLocalInput(endApi));
      let sd = p.ScheduleDetails;
      let dlist = [];
      if (sd && typeof sd === "object") {
        let d = sd.ScheduleDetail;
        if (Array.isArray(d)) dlist = d.filter(Boolean);
        else if (d && typeof d === "object") dlist = [d];
      }
      schedClearAndLoadDetails(dlist);
      syncSchedTypeVisibility();
      return;
    }
    if (et === "access_time_policy") {
      setVal("gc-pe-at-name", textScalar(p.Name));
      setVal("gc-pe-at-desc", textScalar(p.Description));
      let st = textScalar(p.Strategy) || "Allow";
      if (st === "Y" || st === "y") st = "Allow";
      if (st === "N" || st === "n") st = "Deny";
      setVal("gc-pe-at-strategy", st.indexOf("Deny") >= 0 ? "Deny" : "Allow");
      setAccessTimeScheduleValue(textScalar(p.Schedule));
      return;
    }
    if (et === "surfing_quota_policy") {
      setVal("gc-pe-sq-name", textScalar(p.Name));
      setVal("gc-pe-sq-desc", textScalar(p.Description));
      setVal("gc-pe-sq-cycle", textScalar(p.CycleType) || "Cyclic");
      sqHydratePeriod(textScalar(p.PerDay));
      setVal("gc-pe-sq-ch", textScalar(p.CycleHours));
      let cmH = textScalar(p.CycleMinutes);
      setVal("gc-pe-sq-cm", cmH === "" ? "0" : cmH);
      let vSq = textScalar(p.Validity);
      let vUnl = sqScalarUnlimited(vSq);
      setChecked("gc-pe-sq-val-unl", vUnl);
      setVal("gc-pe-sq-val-months", vUnl ? "" : sqValidityDaysToMonths(vSq));
      let mxSq = textScalar(p.MaximumHours);
      let mxUnl = sqScalarUnlimited(mxSq);
      setChecked("gc-pe-sq-mxh-unl", mxUnl);
      setVal("gc-pe-sq-mxh-hours", mxUnl ? "" : mxSq);
      setVal("gc-pe-sq-mxh-min", mxUnl ? "" : textScalar(p.Minutes));
      syncSqFlyoutChrome();
      return;
    }
    if (et === "data_transfer_policy") {
      setVal("gc-pe-dt-name", textScalar(p.Name));
      setVal("gc-pe-dt-desc", textScalar(p.Description));
      let rb = textScalar(p.RestrictionBasedOn) || "TotalDataTransfer";
      setRadio("gc-pe-dt-restrict", rb.indexOf("Individual") >= 0 ? "IndividualDataTransfer" : "TotalDataTransfer");
      let ct = textScalar(p.CycleType) || "Cyclic";
      setRadio("gc-pe-dt-cyclic", ct.indexOf("Non") >= 0 ? "NonCyclic" : "Cyclic");
      setVal("gc-pe-dt-period", textScalar(p.CyclePeriod) || "Day");
      setVal("gc-pe-dt-cycmb", textScalar(p.CycleDataTransferInMB));
      let maxU = textScalar(p.MaximumDataTransfer) === "Unlimited";
      setChecked("gc-pe-dt-max-unl", maxU);
      setVal("gc-pe-dt-maxmb", textScalar(p.MaximumDataTransferInMB));
      setChecked("gc-pe-dt-cu-unl", textScalar(p.CycleUploadDataTransfer) === "Unlimited");
      setVal("gc-pe-dt-cumb", textScalar(p.CycleUploadDataTransferInMB));
      setChecked("gc-pe-dt-cd-unl", textScalar(p.CycleDownloadDataTransfer) === "Unlimited");
      setVal("gc-pe-dt-cdmb", textScalar(p.CycleDownloadDataTransferInMB));
      setChecked("gc-pe-dt-mu-unl", textScalar(p.MaximumUploadDataTransfer) === "Unlimited");
      setVal("gc-pe-dt-mumb", textScalar(p.MaximumUploadDataTransferInMB));
      setChecked("gc-pe-dt-md-unl", textScalar(p.MaximumDownloadDataTransfer) === "Unlimited");
      setVal("gc-pe-dt-mdmb", textScalar(p.MaximumDownloadDataTransferInMB));
      syncDtSectionVisibility();
      return;
    }
    if (et === "vpn_profile") {
      setVal("gc-pe-vpn-name", textScalar(p.Name));
      setVal("gc-pe-vpn-desc", textScalar(p.Description));
      setVal("gc-pe-vpn-keying", textScalar(p.KeyingMethod) || "Automatic");
      setVal("gc-pe-vpn-rekey", textScalar(p.AllowReKeying) || "Enable");
      setVal("gc-pe-vpn-tries", textScalar(p.KeyNegotiationTries) || "0");
      setVal("gc-pe-vpn-authmode", textScalar(p.AuthenticationMode) || "MainMode");
      let p1 = p.Phase1 && typeof p.Phase1 === "object" ? p.Phase1 : p;
      setVal("gc-pe-vpn-p1-kl", textScalar(p1.KeyLife) || "5400");
      setVal("gc-pe-vpn-p1-rm", textScalar(p1.ReKeyMargin) || "360");
      setVal("gc-pe-vpn-p1-rnd", textScalar(p1["RandomizeRe-KeyingMarginBy"]) || "50");
      let sg = p1.SupportedDHGroups;
      let dhl = [];
      if (sg && typeof sg === "object") {
        let dg = sg.DHGroup;
        if (Array.isArray(dg)) dhl = dg.map(textScalar).filter(Boolean);
        else if (dg) dhl = [textScalar(dg)];
      }
      vpnHydrateDhMultiselect(dhl);
      vpnClearSelectDynamic("gc-pe-vpn-p1-enc");
      vpnClearSelectDynamic("gc-pe-vpn-p1-auth");
      vpnEnsureSelectValue("gc-pe-vpn-p1-enc", textScalar(p1.EncryptionAlgorithm1) || "AES256");
      vpnEnsureSelectValue("gc-pe-vpn-p1-auth", textScalar(p1.AuthenticationAlgorithm1) || "SHA2_256");
      let dpd = textScalar(p1.DeadPeerDetection) === "Enable";
      setChecked("gc-pe-vpn-dpd", dpd);
      setVal("gc-pe-vpn-dpd-every", textScalar(p1.CheckPeerAfterEvery) || "30");
      setVal("gc-pe-vpn-dpd-wait", textScalar(p1.WaitForResponseUpto) || "120");
      setVal("gc-pe-vpn-dpd-act", textScalar(p1.ActionWhenPeerUnreachable) || "ReInitiate");
      let p2 = p.Phase2 && typeof p.Phase2 === "object" ? p.Phase2 : {};
      vpnClearSelectDynamic("gc-pe-vpn-p2-pfs");
      vpnClearSelectDynamic("gc-pe-vpn-p2-enc");
      vpnClearSelectDynamic("gc-pe-vpn-p2-auth");
      vpnEnsureSelectValue("gc-pe-vpn-p2-pfs", vpnNormalizePfsApi(textScalar(p2.PFSGroup)));
      vpnEnsureSelectValue("gc-pe-vpn-p2-enc", textScalar(p2.EncryptionAlgorithm1) || "AES256");
      vpnEnsureSelectValue("gc-pe-vpn-p2-auth", textScalar(p2.AuthenticationAlgorithm1) || "SHA2_256");
      setVal("gc-pe-vpn-p2-kl", textScalar(p2.KeyLife) || "3600");
      syncVpnDpdUi();
    }
  }

  function syncDtSectionVisibility() {
    let indiv = radioVal("gc-pe-dt-restrict") === "IndividualDataTransfer";
    let nonCyc = radioVal("gc-pe-dt-cyclic") === "NonCyclic";
    let iw = document.getElementById("gc-pe-dt-indiv-wrap");
    let tw = document.getElementById("gc-pe-dt-total-wrap");
    let mw = document.getElementById("gc-pe-dt-max-wrap");
    if (iw) iw.hidden = !indiv;
    if (tw) tw.hidden = indiv || nonCyc;
    if (mw) mw.hidden = indiv;
  }

  let SQ_VALIDITY_MAX_DAYS = 3660;
  let SQ_VALIDITY_MAX_MONTHS = 122;

  function sqPeriodClearDynamicOption() {
    let sel = document.getElementById("gc-pe-sq-period");
    if (!sel) return;
    let o = sel.querySelector('option[data-gc-sq-period-dynamic="1"]');
    if (o) o.remove();
  }

  function sqPeriodCanonical(raw) {
    let s = String(raw || "").trim();
    if (!s) return "Monthly";
    let lower = s.toLowerCase();
    if (lower === "days" || lower === "day") return "Days";
    if (lower === "weekly" || lower === "week") return "Weekly";
    if (lower === "monthly" || lower === "month") return "Monthly";
    if (lower === "yearly" || lower === "year") return "Yearly";
    let opts = ["Days", "Weekly", "Monthly", "Yearly"];
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].toLowerCase() === lower) return opts[i];
    }
    return s;
  }

  function sqHydratePeriod(raw) {
    let sel = document.getElementById("gc-pe-sq-period");
    if (!sel) return;
    sqPeriodClearDynamicOption();
    let canon = sqPeriodCanonical(raw);
    let known = false;
    for (let j = 0; j < sel.options.length; j++) {
      if (sel.options[j].value === canon) {
        known = true;
        break;
      }
    }
    if (!known && canon) {
      let opt = document.createElement("option");
      opt.value = canon;
      opt.textContent = canon;
      opt.setAttribute("data-gc-sq-period-dynamic", "1");
      sel.appendChild(opt);
    }
    setVal("gc-pe-sq-period", canon || "Monthly");
  }

  function sqScalarUnlimited(raw) {
    let s = String(raw == null ? "" : raw).trim();
    if (!s) return true;
    let l = s.toLowerCase();
    return l === "unlimited" || s === "-11";
  }

  function sqValidityDaysToMonths(daysStr) {
    let d = parseInt(String(daysStr || "").trim(), 10);
    if (isNaN(d) || d <= 0) return "";
    let m = Math.round(d / 30);
    if (d > 0 && m < 1) m = 1;
    if (m > SQ_VALIDITY_MAX_MONTHS) m = SQ_VALIDITY_MAX_MONTHS;
    return String(m);
  }

  function syncSqCycleHmVisibility() {
    let wrap = document.getElementById("gc-pe-sq-cycle-hm-wrap");
    if (!wrap) return;
    wrap.hidden = val("gc-pe-sq-cycle") === "NonCyclic";
  }

  function syncSqValUnlimitedUi() {
    let unl = checked("gc-pe-sq-val-unl");
    let el = document.getElementById("gc-pe-sq-val-months");
    if (el) el.disabled = unl;
  }

  function syncSqMxhUnlimitedUi() {
    let unl = checked("gc-pe-sq-mxh-unl");
    ["gc-pe-sq-mxh-hours", "gc-pe-sq-mxh-min"].forEach(function (id) {
      let el = document.getElementById(id);
      if (el) el.disabled = unl;
    });
  }

  function syncSqFlyoutChrome() {
    syncSqCycleHmVisibility();
    syncSqValUnlimitedUi();
    syncSqMxhUnlimitedUi();
  }

  function validateSurfingQuotaFlyout() {
    let cyc = val("gc-pe-sq-cycle");
    if (cyc !== "NonCyclic") {
      let ch = val("gc-pe-sq-ch");
      if (ch !== "" && !/^[1-9]\d*$/.test(ch)) {
        return "Cycle hours must be blank or a positive integer.";
      }
      let cm = val("gc-pe-sq-cm");
      if (cm === "") {
        return "Enter cycle minutes (0–59).";
      }
      if (!/^\d+$/.test(cm)) {
        return "Cycle minutes must be an integer from 0 to 59.";
      }
      let cmi = parseInt(cm, 10);
      if (cmi < 0 || cmi > 59) {
        return "Cycle minutes must be from 0 to 59.";
      }
    }
    if (!checked("gc-pe-sq-val-unl")) {
      let mo = val("gc-pe-sq-val-months");
      if (!/^[1-9]\d*$/.test(mo)) {
        return "Enter validity months (1–" + SQ_VALIDITY_MAX_MONTHS + ") or enable Unlimited.";
      }
      let m = parseInt(mo, 10);
      if (m < 1 || m > SQ_VALIDITY_MAX_MONTHS) {
        return "Validity months must be from 1 to " + SQ_VALIDITY_MAX_MONTHS + ".";
      }
    }
    if (!checked("gc-pe-sq-mxh-unl")) {
      let hh = val("gc-pe-sq-mxh-hours");
      let mm = val("gc-pe-sq-mxh-min");
      if (!/^\d+$/.test(hh)) {
        return "Enter maximum hours (non-negative integer) or enable Unlimited.";
      }
      if (parseInt(hh, 10) < 0) {
        return "Maximum hours cannot be negative.";
      }
      if (!/^\d+$/.test(mm)) {
        return "Maximum minutes must be an integer from 0 to 59.";
      }
      let mi = parseInt(mm, 10);
      if (mi < 0 || mi > 59) {
        return "Maximum minutes must be from 0 to 59.";
      }
    }
    return "";
  }

  let mode = "add";
  let currentTabCfg = null;
  /** @type {{ config_entry_id: number, firewall_id: number }[]} */
  let peEditTargets = [];
  let URLS = {};

  function openFlyout(root, open) {
    if (!root) return;
    root.hidden = !open;
    root.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("gc-if-flyout-open", !!open);
  }

  function showSection(et) {
    document.querySelectorAll(".gc-pe-section").forEach(function (s) {
      s.hidden = true;
    });
    let sid = sectionIdForEntityType(et);
    let sec = sid ? document.getElementById(sid) : null;
    if (sec) sec.hidden = false;
  }

  function init(cfg) {
    URLS = (cfg && cfg.urls) || {};
    let onSaved = cfg && cfg.onSaved;
    let root = document.getElementById("gc-pe-flyout");
    let form = document.getElementById("gc-pe-form");
    let title = document.getElementById("gc-pe-flyout-title");
    let fwField = document.getElementById("gc-pe-fw-field");
    let msRoot = fwField ? fwField.querySelector(".gc-hs-ip-host-flyout__fw-ms") : null;
    let bodyRoot = root ? root.querySelector(".gc-if-flyout__form-body") : null;

    document.querySelectorAll('input[name="gc-pe-dt-restrict"]').forEach(function (r) {
      r.addEventListener("change", syncDtSectionVisibility);
    });
    document.querySelectorAll('input[name="gc-pe-dt-cyclic"]').forEach(function (r) {
      r.addEventListener("change", syncDtSectionVisibility);
    });
    document.querySelectorAll('input[name="gc-pe-sched-type"]').forEach(function (r) {
      r.addEventListener("change", syncSchedTypeVisibility);
    });
    let schedTbody = document.getElementById("gc-pe-sched-detail-tbody");
    if (schedTbody) {
      schedTbody.addEventListener("change", function () {
        schedEnsureTrailingBlank(schedTbody);
      });
      schedTbody.addEventListener("input", function () {
        schedEnsureTrailingBlank(schedTbody);
      });
      schedTbody.addEventListener("click", function (e) {
        let btn = e.target && e.target.closest ? e.target.closest(".gc-pe-sched-detail-remove") : null;
        if (!btn) return;
        e.preventDefault();
        schedRemoveDetailRow(btn);
      });
    }

    let sqCycleEl = document.getElementById("gc-pe-sq-cycle");
    if (sqCycleEl) sqCycleEl.addEventListener("change", syncSqCycleHmVisibility);
    let sqValUnlEl = document.getElementById("gc-pe-sq-val-unl");
    if (sqValUnlEl) sqValUnlEl.addEventListener("change", syncSqValUnlimitedUi);
    let sqMxhUnlEl = document.getElementById("gc-pe-sq-mxh-unl");
    if (sqMxhUnlEl) sqMxhUnlEl.addEventListener("change", syncSqMxhUnlimitedUi);
    let vpnDpdEl = document.getElementById("gc-pe-vpn-dpd");
    if (vpnDpdEl) vpnDpdEl.addEventListener("change", syncVpnDpdUi);

    function close() {
      vpnCloseDhDropdown();
      openFlyout(root, false);
      currentTabCfg = null;
      peEditTargets = [];
    }

    let closeBtn = document.getElementById("gc-pe-flyout-close");
    let cancelBtn = document.getElementById("gc-pe-cancel");
    let backdropEl = root ? root.querySelector(".gc-if-flyout__backdrop") : null;
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (cancelBtn) cancelBtn.addEventListener("click", close);
    if (backdropEl) backdropEl.addEventListener("click", close);

    if (!root || !form) {
      globalThis.gcProfileEntityFlyoutOpenCreate = function () {};
      globalThis.gcProfileEntityFlyoutOpenFromTr = function () {};
      return;
    }

    vpnInitPeVpnDhMs();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!currentTabCfg) return;
      let et = currentTabCfg.entityType;
      if (et === "surfing_quota_policy") {
        let sqErr0 = validateSurfingQuotaFlyout();
        if (sqErr0) {
          bannerResult(false, sqErr0);
          return;
        }
      }
      let payload = collectPayload(et);
      if (!payload.Name) {
        bannerResult(false, "Name is required.");
        return;
      }
      if (et === "schedule") {
        let sErr = validateScheduleClientPayload(String(payload.Type || ""), payload);
        if (sErr) {
          bannerResult(false, sErr);
          return;
        }
      }

      if (mode === "add") {
        let ids = msRoot ? collectPeFirewallIds(msRoot) : [];
        if (!ids.length) {
          bannerResult(false, "Select at least one firewall.");
          return;
        }
        fetch(URLS.createBatch, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "Ground-Control",
          },
          body: JSON.stringify({
            entity_type: et,
            firewall_ids: ids,
            payload: payload,
          }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, j: j };
            });
          })
          .then(function (x) {
            if (!x.ok) {
              let em = (x.j && (x.j.detail || x.j.message)) || "Could not queue.";
              bannerResult(false, typeof em === "string" ? em : JSON.stringify(em));
              return;
            }
            bannerResult(true, "Create tasks queued.");
            dispatchTaskQueueUpdated();
            close();
            if (onSaved) onSaved();
          })
          .catch(function () {
            bannerResult(false, "Network error.");
          });
        return;
      }

      let selFw = msRoot ? collectPeFirewallIds(msRoot) : [];
      if (!selFw.length) {
        bannerResult(false, "Select at least one firewall.");
        return;
      }
      let fwToCe = {};
      peEditTargets.forEach(function (t) {
        if (!t || t.firewall_id == null || t.config_entry_id == null) return;
        let fid = parseInt(String(t.firewall_id), 10);
        let ce = parseInt(String(t.config_entry_id), 10);
        if (!isNaN(fid) && fid > 0 && !isNaN(ce) && ce > 0) fwToCe[fid] = ce;
      });
      let updateEntryIds = [];
      selFw.forEach(function (fid) {
        if (fwToCe[fid]) updateEntryIds.push(fwToCe[fid]);
      });
      let createFwIds = selFw.filter(function (fid) {
        return !fwToCe[fid];
      });

      if (!updateEntryIds.length && !createFwIds.length) {
        bannerResult(false, "Nothing to update.");
        return;
      }

      function finishEditSuccess(msg) {
        bannerResult(true, msg);
        dispatchTaskQueueUpdated();
        close();
        if (onSaved) onSaved();
      }

      function runCreatesAfterUpdate() {
        if (!URLS.createBatch) {
          bannerResult(false, "Select new firewalls to add this object, but create batch URL is not configured.");
          return;
        }
        fetch(URLS.createBatch, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "Ground-Control",
          },
          body: JSON.stringify({
            entity_type: et,
            firewall_ids: createFwIds,
            payload: payload,
          }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, j: j };
            });
          })
          .then(function (x) {
            if (!x.ok) {
              let emC = (x.j && (x.j.detail || x.j.message)) || "Could not queue creates.";
              bannerResult(false, typeof emC === "string" ? emC : JSON.stringify(emC));
              return;
            }
            finishEditSuccess(
              updateEntryIds.length
                ? "Update tasks queued. Create tasks queued."
                : "Create tasks queued.",
            );
          })
          .catch(function () {
            bannerResult(false, "Network error.");
          });
      }

      if (!updateEntryIds.length) {
        runCreatesAfterUpdate();
        return;
      }
      if (!URLS.updateBatch) {
        bannerResult(false, "Update batch URL not configured.");
        return;
      }
      fetch(URLS.updateBatch, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "Ground-Control",
        },
        body: JSON.stringify({
          config_entry_ids: updateEntryIds,
          payload: payload,
        }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (x) {
          if (!x.ok) {
            let em = (x.j && (x.j.detail || x.j.message)) || "Could not queue.";
            bannerResult(false, typeof em === "string" ? em : JSON.stringify(em));
            return;
          }
          if (!createFwIds.length) {
            finishEditSuccess(
              x.j && x.j.count === 0 ? "No changes to save." : "Update tasks queued.",
            );
            return;
          }
          runCreatesAfterUpdate();
        })
        .catch(function () {
          bannerResult(false, "Network error.");
        });
    });

    function enableAllNameFields() {
      ["gc-pe-sched-name", "gc-pe-at-name", "gc-pe-sq-name", "gc-pe-dt-name", "gc-pe-vpn-name"].forEach(function (id) {
        let el = document.getElementById(id);
        if (el) el.disabled = false;
      });
    }

    globalThis.gcProfileEntityFlyoutOpenCreate = function (tabCfg) {
      currentTabCfg = tabCfg;
      mode = "add";
      peEditTargets = [];
      enableAllNameFields();
      if (title) title.textContent = "Add";
      if (fwField) fwField.hidden = false;
      showSection(tabCfg.entityType);
      hydrate(tabCfg.entityType, {});
      if (msRoot) {
        msRoot.setAttribute("data-fw-picker-mode", "add");
        msRoot.setAttribute("data-fw-initial-selected", "[]");
        msRoot.setAttribute("data-fw-assigned-ids", "[]");
      }
      if (bodyRoot && msRoot && typeof globalThis.gcHsHydrateFlyoutFirewallPicker === "function") {
        globalThis.gcHsHydrateFlyoutFirewallPicker(bodyRoot, { row: {} });
      }
      let sel =
        typeof globalThis.gcGetSelectedFirewallIds === "function"
          ? globalThis.gcGetSelectedFirewallIds()
          : [];
      if (msRoot && sel && sel.length) {
        try {
          msRoot.setAttribute("data-fw-initial-selected", JSON.stringify(sel));
        } catch (e1) {}
        if (bodyRoot && typeof globalThis.gcHsHydrateFlyoutFirewallPicker === "function") {
          globalThis.gcHsHydrateFlyoutFirewallPicker(bodyRoot, { row: {} });
        }
      }
      syncDtSectionVisibility();
      syncSqFlyoutChrome();
      syncVpnDpdUi();
      openFlyout(root, true);
    };

    globalThis.gcProfileEntityFlyoutOpenFromTr = function (tr, tabCfg) {
      if (!tr || !tr._gcNetRow || !tabCfg) return;
      let row = tr._gcNetRow;
      currentTabCfg = tabCfg;
      mode = "edit";
      if (title) title.textContent = "Edit";
      if (fwField) fwField.hidden = false;
      showSection(tabCfg.entityType);
      let p = row.payload && typeof row.payload === "object" ? row.payload : {};
      hydrate(tabCfg.entityType, p);
      let targets = row[tabCfg.editTargets];
      peEditTargets = [];
      if (Array.isArray(targets) && targets.length) {
        targets.forEach(function (t) {
          if (!t || t.config_entry_id == null || t.firewall_id == null) return;
          peEditTargets.push({
            config_entry_id: Number(t.config_entry_id),
            firewall_id: Number(t.firewall_id),
          });
        });
      } else if (row.config_entry_id != null && row.firewall_id != null) {
        peEditTargets.push({
          config_entry_id: Number(row.config_entry_id),
          firewall_id: Number(row.firewall_id),
        });
      }
      let assignedFw = [];
      peEditTargets.forEach(function (x) {
        if (x.firewall_id > 0) assignedFw.push(x.firewall_id);
      });
      if (msRoot) {
        msRoot.setAttribute("data-fw-picker-mode", "edit");
        try {
          msRoot.setAttribute("data-fw-initial-selected", JSON.stringify(assignedFw));
          msRoot.setAttribute("data-fw-assigned-ids", JSON.stringify(assignedFw));
        } catch (eFwAttr) {}
      }
      if (bodyRoot && msRoot && typeof globalThis.gcHsHydrateFlyoutFirewallPicker === "function") {
        globalThis.gcHsHydrateFlyoutFirewallPicker(bodyRoot, { row: row });
      }
      let nameEl = document.getElementById(
        tabCfg.entityType === "schedule"
          ? "gc-pe-sched-name"
          : tabCfg.entityType === "access_time_policy"
            ? "gc-pe-at-name"
            : tabCfg.entityType === "surfing_quota_policy"
              ? "gc-pe-sq-name"
              : tabCfg.entityType === "data_transfer_policy"
                ? "gc-pe-dt-name"
                : "gc-pe-vpn-name",
      );
      if (nameEl) nameEl.disabled = true;
      openFlyout(root, true);
      if (bodyRoot && typeof globalThis.gcCombineFlyoutApplyConflictChrome === "function") {
        let combineOpts = { columnLabels: {}, fieldPickHandlers: {} };
        if (tabCfg.combineFlyoutColumnLabels && typeof tabCfg.combineFlyoutColumnLabels === "object") {
          combineOpts.columnLabels = tabCfg.combineFlyoutColumnLabels;
        }
        if (tabCfg.entityType !== "access_time_policy" && tabCfg.combineDetailCol) {
          let dcol = tabCfg.combineDetailCol;
          combineOpts.fieldPickHandlers[dcol] = function (raw) {
            try {
              hydrate(tabCfg.entityType, JSON.parse(String(raw)));
              syncDtSectionVisibility();
              syncSqFlyoutChrome();
              syncVpnDpdUi();
            } catch (eJ) {
              bannerResult(false, "Could not apply that firewall’s payload.");
            }
          };
          combineOpts.columnLabels[dcol] = "Definition from firewall";
        }
        globalThis.gcCombineFlyoutApplyConflictChrome(bodyRoot, row, combineOpts);
      }
      if (tabCfg.entityType === "schedule") syncSchedTypeVisibility();
    };
  }

  globalThis.gcProfileEntityFlyoutInit = init;
})();
