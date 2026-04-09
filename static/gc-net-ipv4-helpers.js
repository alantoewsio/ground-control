/**
 * Shared IPv4 helpers for network flyouts: CIDR split on IP blur, prefix → netmask on netmask blur.
 */
(function (g) {
  "use strict";

  function prefixToDotted(prefix) {
    let p = Number(prefix);
    if (p !== prefix || p < 0 || p > 32) return null;
    let low = p === 32 ? 0 : Math.pow(2, 32 - p) - 1;
    let mask = (4294967295 ^ low) >>> 0;
    return [(mask >>> 24) & 255, (mask >>> 16) & 255, (mask >>> 8) & 255, mask & 255].join(".");
  }

  /** Normalize API or legacy UI strings to dotted decimal for the netmask input. */
  function netmaskToDisplay(nm) {
    nm = String(nm || "").trim();
    if (!nm) return "";
    let openP = nm.indexOf("(");
    let closeP = nm.indexOf(")");
    if (openP !== -1 && closeP > openP) {
      return nm.slice(openP + 1, closeP).trim();
    }
    let mOnly = nm.match(/^\s*\/(\d{1,2})\s*$/);
    if (mOnly) {
      let d = prefixToDotted(parseInt(mOnly[1], 10));
      return d || nm;
    }
    let parts = nm.split(".");
    if (parts.length === 4) {
      for (let k = 0; k < 4; k++) {
        let oct = parseInt(parts[k], 10);
        if (isNaN(oct) || oct < 0 || oct > 255) return nm;
      }
      return parts.join(".");
    }
    return nm;
  }

  function isContiguousIpv4Netmask32(n32) {
    let inv = (~n32) >>> 0;
    return (inv & (inv + 1)) === 0;
  }

  function dottedQuadToPrefixLen(dotted) {
    let parts = String(dotted || "").trim().split(".");
    if (parts.length !== 4) return null;
    let octets = [];
    for (let j = 0; j < 4; j++) {
      let o2 = parseInt(parts[j], 10);
      if (isNaN(o2) || o2 < 0 || o2 > 255) return null;
      octets.push(o2);
    }
    let n32 = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
    if (!isContiguousIpv4Netmask32(n32)) return null;
    let bits = 0;
    for (let k = 0; k < 4; k++) {
      bits += (octets[k] >>> 0).toString(2).replace(/0/g, "").length;
    }
    return bits;
  }

  /** Show netmask as /prefix in UI (from API dotted, /n, or legacy). */
  function netmaskToSlashDisplay(nm) {
    nm = String(nm || "").trim();
    if (!nm) return "";
    let mOnly = nm.match(/^\s*\/(\d{1,2})\s*$/);
    if (mOnly) {
      let pl0 = parseInt(mOnly[1], 10);
      if (pl0 >= 0 && pl0 <= 32) return "/" + pl0;
      return nm;
    }
    if (/^\s*\d{1,2}\s*$/.test(nm)) {
      let pl1 = parseInt(nm.replace(/\s/g, ""), 10);
      if (pl1 >= 0 && pl1 <= 32) return "/" + pl1;
    }
    let dotted = netmaskToDisplay(nm);
    let plen = dottedQuadToPrefixLen(dotted);
    return plen != null ? "/" + plen : nm;
  }

  /**
   * Normalize netmask input to /prefix for display (Interface flyout).
   * Accepts the same forms as applyNetmaskNormalize.
   */
  function applyNetmaskNormalizeToSlash(els, syncDirty) {
    if (!els || !els.ipv4Nm) return;
    if (els.ipv4Nm.readOnly) return;
    let before = els.ipv4Nm.value;
    applyNetmaskNormalize(els, null);
    let dotted = els.ipv4Nm.value.trim();
    let plen = dottedQuadToPrefixLen(dotted);
    if (plen != null) {
      els.ipv4Nm.value = "/" + plen;
      if (typeof syncDirty === "function" && before !== els.ipv4Nm.value) syncDirty();
    } else if (typeof syncDirty === "function" && before !== els.ipv4Nm.value) {
      syncDirty();
    }
  }

  /** Match server netmask_display_to_api: dotted quad for payloads. */
  function netmaskInputToApi(s) {
    s = String(s || "").trim();
    if (!s) return "";
    let openP = s.indexOf("(");
    let closeP = s.indexOf(")");
    if (openP !== -1 && closeP > openP) {
      return s.slice(openP + 1, closeP).trim();
    }
    let m = s.match(/^\s*\/(\d{1,2})\s*$/);
    if (m) {
      let d = prefixToDotted(parseInt(m[1], 10));
      return d || s;
    }
    let m2 = s.match(/^\s*(\d{1,2})\s*$/);
    if (m2) {
      let p = parseInt(m2[1], 10);
      if (p >= 0 && p <= 32) {
        let d2 = prefixToDotted(p);
        if (d2) return d2;
      }
    }
    return s;
  }

  /**
   * If IPv4 field contains a.b.c.d/n, set IP + netmask display. No-op if no slash or invalid.
   * @param {{ maskAsSlash?: boolean }} [opts] If maskAsSlash, netmask becomes /prefix instead of dotted.
   */
  function applyCidrSplit(els, syncDirty, opts) {
    opts = opts || {};
    if (!els || !els.ipv4Ip || !els.ipv4Nm) return;
    if (els.ipv4Ip.readOnly) return;
    let raw = els.ipv4Ip.value.trim();
    let slash = raw.indexOf("/");
    if (slash < 0) return;
    let ipPart = raw.slice(0, slash).trim();
    let pPart = raw.slice(slash + 1).trim();
    let prefix = parseInt(pPart, 10);
    if (pPart !== String(prefix) || prefix < 0 || prefix > 32) return;
    let octets = ipPart.split(".");
    if (octets.length !== 4) return;
    for (let i = 0; i < 4; i++) {
      let o = parseInt(octets[i], 10);
      if (isNaN(o) || o < 0 || o > 255) return;
    }
    let dottedNm = prefixToDotted(prefix);
    if (!dottedNm) return;
    els.ipv4Ip.value = octets.join(".");
    els.ipv4Nm.value = opts.maskAsSlash ? "/" + prefix : dottedNm;
    if (typeof syncDirty === "function") syncDirty();
  }

  /**
   * If netmask is /n, n (0–32), dotted quad, or legacy "/n (dotted)", normalize to dotted decimal.
   */
  function applyNetmaskNormalize(els, syncDirty) {
    if (!els || !els.ipv4Nm) return;
    if (els.ipv4Nm.readOnly) return;
    let raw = els.ipv4Nm.value.trim();
    if (!raw) return;

    let prefix = null;
    let mSlashOnly = raw.match(/^\s*\/(\d{1,2})\s*$/);
    if (mSlashOnly) {
      prefix = parseInt(mSlashOnly[1], 10);
      if (prefix < 0 || prefix > 32) prefix = null;
    }
    if (prefix === null && /^\s*\d{1,2}\s*$/.test(raw)) {
      prefix = parseInt(raw.replace(/\s/g, ""), 10);
      if (prefix < 0 || prefix > 32) prefix = null;
    }

    if (prefix !== null) {
      let dottedFromPrefix = prefixToDotted(prefix);
      if (dottedFromPrefix) {
        els.ipv4Nm.value = dottedFromPrefix;
        if (typeof syncDirty === "function") syncDirty();
      }
      return;
    }

    let inner = raw;
    let openP = raw.indexOf("(");
    let closeP = raw.indexOf(")");
    if (openP !== -1 && closeP > openP) {
      inner = raw.slice(openP + 1, closeP).trim();
    }
    let parts = inner.split(".");
    if (parts.length !== 4) return;
    let octets = [];
    for (let j = 0; j < 4; j++) {
      let o2 = parseInt(parts[j], 10);
      if (isNaN(o2) || o2 < 0 || o2 > 255) return;
      octets.push(o2);
    }
    let n32 = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
    if (!isContiguousIpv4Netmask32(n32)) return;
    let dotted = octets.join(".");
    if (dotted !== raw) {
      els.ipv4Nm.value = dotted;
      if (typeof syncDirty === "function") syncDirty();
    }
  }

  g.gcNetIpv4FlyoutBlur = {
    netmaskToDisplay: netmaskToDisplay,
    netmaskToSlashDisplay: netmaskToSlashDisplay,
    netmaskInputToApi: netmaskInputToApi,
    applyCidrSplit: applyCidrSplit,
    applyNetmaskNormalize: applyNetmaskNormalize,
    applyNetmaskNormalizeToSlash: applyNetmaskNormalizeToSlash,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
