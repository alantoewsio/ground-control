/**
 * Shared IP validation + catalog wiring for object-edit flyout (Firewalls v2, etc.).
 * Extracted from templates/partials/gc_designer_controls_scripts.html; re-run:
 *   uv run python scripts/_extract_ip_catalog_runtime.py
 */
(function () {
  "use strict";
  var IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/;

  function ipv4ToInt(s) {
    var p = s.split(".").map(function (x) {
      return parseInt(x, 10);
    });
    return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
  }

  function intToIpv4(n) {
    n = n >>> 0;
    return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  }

  function cidrMask4(prefix) {
    if (prefix < 0 || prefix > 32) return null;
    if (prefix === 0) return 0;
    return (0xffffffff << (32 - prefix)) >>> 0;
  }

  function parseCidrV4(cidr) {
    var m = String(cidr || "")
      .trim()
      .match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
    if (!m) return null;
    if (!IPV4_RE.test(m[1])) return null;
    var prefix = parseInt(m[2], 10);
    if (prefix < 0 || prefix > 32) return null;
    var mask = cidrMask4(prefix);
    if (mask === null) return null;
    var raw = ipv4ToInt(m[1]);
    return { network: raw & mask, mask: mask, prefix: prefix };
  }

  /** Contiguous IPv4 netmask → prefix length, or null if not a valid mask. */
  function ipv4NetmaskToPrefix(maskStr) {
    if (!maskStr || !IPV4_RE.test(maskStr)) return null;
    var n = ipv4ToInt(maskStr);
    var p = 0;
    var x = n;
    while (x & 0x80000000) {
      p++;
      x = (x << 1) >>> 0;
    }
    if (x !== 0) return null;
    return p;
  }

  function trimStrIp(x) {
    return String(x == null ? "" : x).replace(/^\s+|\s+$/g, "");
  }

  /**
   * Turn Layout-wired subnet/netmask into a CIDR /suffix (prefix length as string).
   * @param {string} maskPart — prefix "24" or dotted netmask "255.255.255.0"
   * @param {"ipv4"|"ipv6"} family
   */
  function normalizeMaskWireToCidrSuffix(maskPart, family) {
    var m = trimStrIp(maskPart);
    if (!m) return "";
    if (/^\d+$/.test(m)) {
      var n = parseInt(m, 10);
      if (family === "ipv6") {
        if (n >= 0 && n <= 128) return String(n);
      } else {
        if (n >= 0 && n <= 32) return String(n);
      }
      return m;
    }
    if (family !== "ipv6" && IPV4_RE.test(m)) {
      var pfx = ipv4NetmaskToPrefix(m);
      if (pfx !== null) return String(pfx);
    }
    return m;
  }

  function familyHintToKey(famHint) {
    var s = trimStrIp(famHint).toLowerCase();
    if (!s) return "";
    if (s === "ipv6" || s.indexOf("ipv6") !== -1) return "ipv6";
    if (s === "ipv4" || s.indexOf("ipv4") !== -1) return "ipv4";
    return "";
  }

  /**
   * Build the value for the object-edit IP field from Data Controls Layout wires.
   * When subnet or netmask is wired, combines host address with a CIDR suffix (converts IPv4 netmask to /prefix).
   * @param {*} inAddress — wired "address" (host only or already a.b.c.d/p)
   * @param {*} inSubnet — wired prefix or mask (subnet handle)
   * @param {*} inNetmask — wired netmask handle (used if subnet empty)
   * @param {*} inValue — wired combined "value" fallback when address empty
   * @param {*} famHint — e.g. "IPv4" / "IPv6" from ipfamily wire
   */
  function gcFormatWiredIpDisplayCidr(inAddress, inSubnet, inNetmask, inValue, famHint) {
    var maskW = trimStrIp(inSubnet) !== "" ? trimStrIp(inSubnet) : trimStrIp(inNetmask);
    var addrW = trimStrIp(inAddress);
    var valW = trimStrIp(inValue);
    var addrBase = addrW || valW;
    if (!addrBase && !maskW) return "";
    if (maskW) {
      var famK = familyHintToKey(famHint);
      var fam =
        famK === "ipv6" || famK === "ipv4"
          ? famK
          : addrBase.indexOf(":") >= 0
            ? "ipv6"
            : "ipv4";
      var ipOnly = addrBase;
      var ix = ipOnly.indexOf("/");
      if (ix >= 0) ipOnly = trimStrIp(ipOnly.slice(0, ix));
      if (!ipOnly) return "";
      var suf = normalizeMaskWireToCidrSuffix(maskW, fam);
      return suf ? ipOnly + "/" + suf : ipOnly;
    }
    return addrBase;
  }

  function ipv4InCidr(ipStr, cidrSpec) {
    var c = parseCidrV4(cidrSpec);
    if (!c) return null;
    if (!IPV4_RE.test(ipStr)) return false;
    var ip = ipv4ToInt(ipStr);
    return (ip & c.mask) === (c.network & c.mask);
  }

  function isIpv4NetworkAddress(ipStr, prefix) {
    if (!IPV4_RE.test(ipStr)) return false;
    if (prefix < 0 || prefix > 32) return false;
    var mask = cidrMask4(prefix);
    if (mask === null) return false;
    return (ipv4ToInt(ipStr) & mask) === ipv4ToInt(ipStr);
  }

  function normalizeIpv4Network(ipStr, prefix) {
    if (!IPV4_RE.test(ipStr)) return null;
    if (prefix < 0 || prefix > 32) return null;
    var mask = cidrMask4(prefix);
    if (mask === null) return null;
    return intToIpv4(ipv4ToInt(ipStr) & mask);
  }

  function expandIpv6Hextets(host) {
    var zone = host.indexOf("%");
    if (zone !== -1) host = host.slice(0, zone);
    host = host.trim();
    if (!host) return null;
    if (host.indexOf("::") === -1) {
      var parts = host.split(":");
      if (parts.length !== 8) return null;
      var out = [];
      for (var i = 0; i < 8; i++) {
        var v = parseInt(parts[i], 16);
        if (!Number.isFinite(v) || v < 0 || v > 0xffff) return null;
        out.push(v);
      }
      return out;
    }
    var sides = host.split("::");
    if (sides.length !== 2) return null;
    var left = sides[0] ? sides[0].split(":").filter(Boolean) : [];
    var right = sides[1] ? sides[1].split(":").filter(Boolean) : [];
    var missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    var outL = [];
    for (var a = 0; a < left.length; a++) {
      var va = parseInt(left[a], 16);
      if (!Number.isFinite(va) || va < 0 || va > 0xffff) return null;
      outL.push(va);
    }
    for (var b = 0; b < missing; b++) outL.push(0);
    for (var c = 0; c < right.length; c++) {
      var vc = parseInt(right[c], 16);
      if (!Number.isFinite(vc) || vc < 0 || vc > 0xffff) return null;
      outL.push(vc);
    }
    if (outL.length !== 8) return null;
    return outL;
  }

  function hextetsToBigInt(words) {
    var v = 0n;
    for (var i = 0; i < 8; i++) v = (v << 16n) + BigInt(words[i]);
    return v;
  }

  function ipv6PrefixMask(prefix) {
    if (prefix < 0 || prefix > 128) return null;
    if (prefix === 0) return 0n;
    return ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
  }

  function bigIntToExpandedIpv6(v) {
    var parts = [];
    for (var i = 0; i < 8; i++) {
      parts.push(Number((v >> BigInt(112 - 16 * i)) & 0xffffn));
    }
    return parts
      .map(function (x) {
        return x.toString(16);
      })
      .join(":");
  }

  function parseCidrV6(cidr) {
    var s = String(cidr || "").trim();
    var ix = s.lastIndexOf("/");
    if (ix === -1) return null;
    var addr = s.slice(0, ix).trim();
    var prefix = parseInt(s.slice(ix + 1), 10);
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 128) return null;
    var words = expandIpv6Hextets(addr);
    if (!words) return null;
    var mask = ipv6PrefixMask(prefix);
    if (mask === null) return null;
    var network = hextetsToBigInt(words) & mask;
    return { network: network, mask: mask, prefix: prefix };
  }

  function ipv6InCidr(ipHost, cidrSpec) {
    var c = parseCidrV6(cidrSpec);
    if (!c) return null;
    var words = expandIpv6Hextets(ipHost);
    if (!words) return false;
    var ip = hextetsToBigInt(words);
    return (ip & c.mask) === (c.network & c.mask);
  }

  function isIpv6NetworkAddress(ipHost, prefix) {
    var words = expandIpv6Hextets(ipHost);
    if (!words) return false;
    if (prefix < 0 || prefix > 128) return false;
    var mask = ipv6PrefixMask(prefix);
    if (mask === null) return false;
    var ip = hextetsToBigInt(words);
    return (ip & mask) === ip;
  }

  function normalizeIpv6Network(ipHost, prefix) {
    var words = expandIpv6Hextets(ipHost);
    if (!words) return null;
    if (prefix < 0 || prefix > 128) return null;
    var mask = ipv6PrefixMask(prefix);
    if (mask === null) return null;
    return bigIntToExpandedIpv6(hextetsToBigInt(words) & mask);
  }

  function isValidIpv6Shape(s) {
    s = String(s || "").trim();
    if (!s) return true;
    var zone = s.indexOf("%");
    if (zone !== -1) s = s.slice(0, zone);
    try {
      new URL("http://[" + s + "]");
      return true;
    } catch (e) {
      return false;
    }
  }

  function readOptsFromInput(el) {
    return {
      withinCidr: el.getAttribute("data-gc-ip-within-cidr") || "",
      rangeLo: el.getAttribute("data-gc-ip-range-lo") || "",
      rangeHi: el.getAttribute("data-gc-ip-range-hi") || "",
      prefix: el.getAttribute("data-gc-ip-prefix") || "",
      cidrPrefixMin: el.getAttribute("data-gc-ip-cidr-prefix-min") || "",
      cidrPrefixMax: el.getAttribute("data-gc-ip-cidr-prefix-max") || "",
      storedPrefix: el.getAttribute("data-gc-ip-prefix-length") || "",
      requireNetwork: el.getAttribute("data-gc-ip-require-network") === "true",
      requireValueCidr: el.getAttribute("data-gc-ip-require-value-cidr") === "true",
      autocorrect: el.getAttribute("data-gc-ip-autocorrect") === "true",
    };
  }

  function writeOptsToInput(el, opts) {
    if (!el || !opts || typeof opts !== "object") return;
    var strKeys = [
      ["withinCidr", "data-gc-ip-within-cidr"],
      ["rangeLo", "data-gc-ip-range-lo"],
      ["rangeHi", "data-gc-ip-range-hi"],
      ["prefix", "data-gc-ip-prefix"],
      ["cidrPrefixMin", "data-gc-ip-cidr-prefix-min"],
      ["cidrPrefixMax", "data-gc-ip-cidr-prefix-max"],
      ["storedPrefix", "data-gc-ip-prefix-length"],
    ];
    strKeys.forEach(function (pair) {
      var k = pair[0];
      var attr = pair[1];
      var v = opts[k];
      if (v != null && String(v).trim() !== "") el.setAttribute(attr, String(v).trim());
      else el.removeAttribute(attr);
    });
    var boolKeys = [
      ["requireNetwork", "data-gc-ip-require-network"],
      ["requireValueCidr", "data-gc-ip-require-value-cidr"],
      ["autocorrect", "data-gc-ip-autocorrect"],
    ];
    boolKeys.forEach(function (pair) {
      var k = pair[0];
      var attr = pair[1];
      if (opts[k] === true) el.setAttribute(attr, "true");
      else el.removeAttribute(attr);
    });
  }

  function hasAppliedIpConstraints(el) {
    if (!el || !el.attributes) return false;
    for (var i = 0; i < el.attributes.length; i++) {
      if (el.attributes[i].name.indexOf("data-gc-ip-") === 0) return true;
    }
    return false;
  }

  function cidrPrefixBoundsActive(opts, maxPfx) {
    if (!opts.withinCidr) return false;
    var loN = opts.cidrPrefixMin !== "" ? parseInt(opts.cidrPrefixMin, 10) : null;
    var hiN = opts.cidrPrefixMax !== "" ? parseInt(opts.cidrPrefixMax, 10) : null;
    var hasLo = loN !== null && Number.isFinite(loN);
    var hasHi = hiN !== null && Number.isFinite(hiN);
    if (!hasLo && !hasHi) return false;
    var lo = hasLo ? loN : 0;
    var hi = hasHi ? hiN : maxPfx;
    if (lo < 0 || hi > maxPfx || lo > hi) return false;
    return { lo: lo, hi: hi };
  }

  function validateIpv4(val, opts) {
    var s = String(val || "").trim();
    if (!s) return { ok: true, msg: "" };
    var ix = s.lastIndexOf("/");
    var host;
    var userPfx = null;
    if (ix === -1) {
      host = s;
    } else {
      host = s.slice(0, ix).trim();
      userPfx = parseInt(s.slice(ix + 1), 10);
      if (!Number.isFinite(userPfx) || userPfx < 0 || userPfx > 32) {
        return { ok: false, msg: "IPv4 prefix must be a number from 0 to 32." };
      }
    }
    if (!IPV4_RE.test(host)) {
      return { ok: false, msg: "Enter a dotted IPv4 address (four octets 0–255)." };
    }
    var bounds = cidrPrefixBoundsActive(opts, 32);
    if (bounds === false && opts.withinCidr && (opts.cidrPrefixMin || opts.cidrPrefixMax)) {
      var loC = opts.cidrPrefixMin !== "" ? parseInt(opts.cidrPrefixMin, 10) : null;
      var hiC = opts.cidrPrefixMax !== "" ? parseInt(opts.cidrPrefixMax, 10) : null;
      if (
        (loC !== null && (!Number.isFinite(loC) || loC < 0 || loC > 32)) ||
        (hiC !== null && (!Number.isFinite(hiC) || hiC < 0 || hiC > 32)) ||
        (Number.isFinite(loC) && Number.isFinite(hiC) && loC > hiC)
      ) {
        return { ok: false, msg: "Invalid data-gc-ip-cidr-prefix-min/max for IPv4 (0–32, min ≤ max)." };
      }
    }
    if (bounds !== false) {
      if (userPfx === null) {
        return {
          ok: false,
          msg: "Enter IPv4 as address/prefix; /prefix must be " + bounds.lo + "–" + bounds.hi + " (CIDR bounds).",
        };
      }
      if (userPfx < bounds.lo || userPfx > bounds.hi) {
        return {
          ok: false,
          msg: "IPv4 /prefix must be between " + bounds.lo + " and " + bounds.hi + ".",
        };
      }
    }
    if (opts.withinCidr) {
      var inC = ipv4InCidr(host, opts.withinCidr);
      if (inC === null) {
        return { ok: false, msg: "Invalid CIDR in data-gc-ip-within-cidr (use a.b.c.d/p)." };
      }
      if (!inC) {
        return { ok: false, msg: "IPv4 is not inside the configured subnet (" + opts.withinCidr + ")." };
      }
    }
    if (opts.rangeLo && opts.rangeHi) {
      if (!IPV4_RE.test(opts.rangeLo) || !IPV4_RE.test(opts.rangeHi)) {
        return { ok: false, msg: "Range bounds are not valid IPv4 addresses." };
      }
      var ip = ipv4ToInt(host);
      var lo = ipv4ToInt(opts.rangeLo);
      var hi = ipv4ToInt(opts.rangeHi);
      if (lo > hi) {
        return { ok: false, msg: "Range low must be ≤ high." };
      }
      if (ip < lo || ip > hi) {
        return { ok: false, msg: "IPv4 is outside the configured range " + opts.rangeLo + " – " + opts.rangeHi + "." };
      }
    }
    if (opts.requireNetwork) {
      var pfxNet = parseInt(opts.prefix, 10);
      if (userPfx !== null && Number.isFinite(userPfx)) {
        pfxNet = userPfx;
      } else if (opts.storedPrefix) {
        var spNet = parseInt(opts.storedPrefix, 10);
        if (Number.isFinite(spNet)) pfxNet = spNet;
      }
      if (!Number.isFinite(pfxNet) || pfxNet < 0 || pfxNet > 32) {
        return { ok: false, msg: "Set data-gc-ip-prefix (0–32) for IPv4 network-address check." };
      }
      if (!isIpv4NetworkAddress(host, pfxNet)) {
        return { ok: false, msg: "IPv4 must be the network address for /" + pfxNet + " (host bits must be 0)." };
      }
    }
    if (opts.requireValueCidr) {
      if (userPfx === null && opts.storedPrefix) {
        userPfx = parseInt(opts.storedPrefix, 10);
      }
      if (userPfx === null || !Number.isFinite(userPfx)) {
        return { ok: false, msg: "Enter IPv4 CIDR as address/prefix (e.g. 10.1.2.3/16)." };
      }
      if (!isIpv4NetworkAddress(host, userPfx)) {
        return {
          ok: false,
          msg: "IPv4 host must be the /" + userPfx + " network address (tab away to normalize).",
        };
      }
    }
    return { ok: true, msg: "" };
  }

  function validateIpv6(val, opts) {
    var s = String(val || "").trim();
    if (!s) return { ok: true, msg: "" };
    var ix = s.lastIndexOf("/");
    var left;
    var userPfx6 = null;
    if (ix === -1) {
      left = s;
    } else {
      left = s.slice(0, ix).trim();
      userPfx6 = parseInt(s.slice(ix + 1), 10);
      if (!Number.isFinite(userPfx6) || userPfx6 < 0 || userPfx6 > 128) {
        return { ok: false, msg: "IPv6 prefix must be a number from 0 to 128." };
      }
    }
    if (!isValidIpv6Shape(left)) {
      return { ok: false, msg: "Enter a valid IPv6 address (e.g. 2001:db8::1 or ::1)." };
    }
    var zone = left.indexOf("%");
    var host = zone !== -1 ? left.slice(0, zone) : left;
    var bounds6 = cidrPrefixBoundsActive(opts, 128);
    if (bounds6 === false && opts.withinCidr && (opts.cidrPrefixMin || opts.cidrPrefixMax)) {
      var lo6 = opts.cidrPrefixMin !== "" ? parseInt(opts.cidrPrefixMin, 10) : null;
      var hi6 = opts.cidrPrefixMax !== "" ? parseInt(opts.cidrPrefixMax, 10) : null;
      if (
        (lo6 !== null && (!Number.isFinite(lo6) || lo6 < 0 || lo6 > 128)) ||
        (hi6 !== null && (!Number.isFinite(hi6) || hi6 < 0 || hi6 > 128)) ||
        (Number.isFinite(lo6) && Number.isFinite(hi6) && lo6 > hi6)
      ) {
        return { ok: false, msg: "Invalid data-gc-ip-cidr-prefix-min/max for IPv6 (0–128, min ≤ max)." };
      }
    }
    if (bounds6 !== false) {
      if (userPfx6 === null) {
        return {
          ok: false,
          msg: "Enter IPv6 as address/prefix; /prefix must be " + bounds6.lo + "–" + bounds6.hi + " (CIDR bounds).",
        };
      }
      if (userPfx6 < bounds6.lo || userPfx6 > bounds6.hi) {
        return {
          ok: false,
          msg: "IPv6 /prefix must be between " + bounds6.lo + " and " + bounds6.hi + ".",
        };
      }
    }
    if (opts.withinCidr) {
      var in6 = ipv6InCidr(host, opts.withinCidr);
      if (in6 === null) {
        return { ok: false, msg: "Invalid IPv6 CIDR in data-gc-ip-within-cidr (use addr/prefix)." };
      }
      if (!in6) {
        return { ok: false, msg: "IPv6 is not inside the configured subnet (" + opts.withinCidr + ")." };
      }
    }
    if (opts.rangeLo || opts.rangeHi) {
      return {
        ok: false,
        msg: "IPv4 range is set on this field; use CIDR for IPv6 or clear range options.",
      };
    }
    if (opts.requireNetwork) {
      var pfx6Net = parseInt(opts.prefix, 10);
      if (userPfx6 !== null && Number.isFinite(userPfx6)) {
        pfx6Net = userPfx6;
      } else if (opts.storedPrefix) {
        var sp6 = parseInt(opts.storedPrefix, 10);
        if (Number.isFinite(sp6)) pfx6Net = sp6;
      }
      if (!Number.isFinite(pfx6Net) || pfx6Net < 0 || pfx6Net > 128) {
        return { ok: false, msg: "Set data-gc-ip-prefix (0–128) for IPv6 network-address check." };
      }
      if (!isIpv6NetworkAddress(host, pfx6Net)) {
        return { ok: false, msg: "IPv6 must be the network address for /" + pfx6Net + " (host bits must be 0)." };
      }
    }
    if (opts.requireValueCidr) {
      if (userPfx6 === null && opts.storedPrefix) {
        userPfx6 = parseInt(opts.storedPrefix, 10);
      }
      if (userPfx6 === null || !Number.isFinite(userPfx6)) {
        return { ok: false, msg: "Enter IPv6 CIDR as address/prefix (e.g. 2001:db8::/32)." };
      }
      if (!isIpv6NetworkAddress(host, userPfx6)) {
        return {
          ok: false,
          msg: "IPv6 host must be the /" + userPfx6 + " network address (tab away to normalize).",
        };
      }
    }
    return { ok: true, msg: "" };
  }

  function autocorrectIpv4Value(s, opts) {
    s = String(s || "");
    if (opts.requireValueCidr) {
      var ix0 = s.lastIndexOf("/");
      var hp;
      var pfxV;
      if (ix0 === -1) {
        hp = s.trim();
        pfxV = opts.storedPrefix ? parseInt(opts.storedPrefix, 10) : NaN;
      } else {
        hp = s.slice(0, ix0).trim();
        pfxV = parseInt(s.slice(ix0 + 1), 10);
      }
      if (!IPV4_RE.test(hp) || !Number.isFinite(pfxV) || pfxV < 0 || pfxV > 32) return s;
      var nv = normalizeIpv4Network(hp, pfxV);
      return nv != null ? nv : s;
    }
    if (!opts.autocorrect) return s;
    var ix = s.lastIndexOf("/");
    var hostPart = (ix === -1 ? s : s.slice(0, ix)).trim();
    var slashSuffix = ix === -1 ? "" : s.slice(ix);
    if (!IPV4_RE.test(hostPart)) return s;
    var pfx = null;
    if (opts.withinCidr) {
      var c = parseCidrV4(opts.withinCidr);
      if (c) pfx = c.prefix;
    }
    if (pfx === null && opts.prefix) {
      pfx = parseInt(opts.prefix, 10);
    }
    if (pfx === null || !Number.isFinite(pfx) || pfx < 0 || pfx > 32) return s;
    var n = normalizeIpv4Network(hostPart, pfx);
    return n != null ? n + slashSuffix : s;
  }

  function autocorrectIpv6Value(s, opts) {
    s = String(s || "");
    if (opts.requireValueCidr) {
      var ixv = s.lastIndexOf("/");
      var leftV;
      var pfxV6;
      if (ixv === -1) {
        leftV = s.trim();
        pfxV6 = opts.storedPrefix ? parseInt(opts.storedPrefix, 10) : NaN;
      } else {
        leftV = s.slice(0, ixv).trim();
        pfxV6 = parseInt(s.slice(ixv + 1), 10);
      }
      if (!isValidIpv6Shape(leftV) || !Number.isFinite(pfxV6) || pfxV6 < 0 || pfxV6 > 128) return s;
      var zoneV = leftV.indexOf("%");
      var hostV = zoneV !== -1 ? leftV.slice(0, zoneV) : leftV;
      var zoneSufV = zoneV !== -1 ? leftV.slice(zoneV) : "";
      var nv6 = normalizeIpv6Network(hostV.trim(), pfxV6);
      return nv6 != null ? nv6 + zoneSufV : s;
    }
    if (!opts.autocorrect) return s;
    var ix = s.lastIndexOf("/");
    var left = (ix === -1 ? s : s.slice(0, ix)).trim();
    var slashSuffix = ix === -1 ? "" : s.slice(ix);
    if (!isValidIpv6Shape(left)) return s;
    var zone = left.indexOf("%");
    var host = zone !== -1 ? left.slice(0, zone) : left;
    var suffix = zone !== -1 ? left.slice(zone) : "";
    var pfx = null;
    if (opts.withinCidr) {
      var c6 = parseCidrV6(opts.withinCidr);
      if (c6) pfx = c6.prefix;
    }
    if (pfx === null && opts.prefix) {
      pfx = parseInt(opts.prefix, 10);
    }
    if (pfx === null || !Number.isFinite(pfx) || pfx < 0 || pfx > 128) return s;
    var n = normalizeIpv6Network(host.trim(), pfx);
    return n != null ? n + suffix + slashSuffix : s;
  }

  function canShowAutocorrectPreview(opts) {
    return !!(opts && (opts.autocorrect || opts.requireValueCidr));
  }

  function computeCorrectionTarget(raw, family, opts) {
    if (!canShowAutocorrectPreview(opts)) return null;
    if (!String(raw || "").trim()) return null;
    if (opts.requireValueCidr) {
      var ix = String(raw).lastIndexOf("/");
      var hp;
      var pfx;
      if (ix !== -1) {
        hp = String(raw).slice(0, ix).trim();
        pfx = parseInt(String(raw).slice(ix + 1), 10);
      } else {
        hp = String(raw).trim();
        pfx = opts.storedPrefix ? parseInt(opts.storedPrefix, 10) : NaN;
      }
      if (family === "ipv4") {
        if (!IPV4_RE.test(hp) || !Number.isFinite(pfx) || pfx < 0 || pfx > 32) return null;
        var net = normalizeIpv4Network(hp, pfx);
        if (!net) return null;
        var mask = intToIpv4(cidrMask4(pfx));
        var before = String(raw).trim();
        if (before === net && ix === -1 && isIpv4NetworkAddress(hp, pfx)) return null;
        if (net === hp && ix !== -1) return net + " · " + mask;
        if (net === hp && ix === -1) return null;
        return net + " · " + mask;
      }
      var z = hp.indexOf("%");
      var hostOnly = z !== -1 ? hp.slice(0, z) : hp;
      var zoneSuf = z !== -1 ? hp.slice(z) : "";
      if (!isValidIpv6Shape(hp) || !Number.isFinite(pfx) || pfx < 0 || pfx > 128) return null;
      var nv = normalizeIpv6Network(hostOnly, pfx);
      if (!nv) return null;
      var full = nv + zoneSuf;
      var mb = ipv6PrefixMask(pfx);
      var maskStr = mb !== null ? bigIntToExpandedIpv6(mb) : "";
      var maskShort = maskStr.length > 28 ? "/" + pfx : maskStr;
      var before6 = String(raw).trim();
      if (before6 === full && ix === -1 && isIpv6NetworkAddress(hostOnly, pfx)) return null;
      if (full === hp && ix !== -1) return full + " · " + maskShort;
      if (full === before6 && ix === -1) return null;
      return full + " · " + maskShort;
    }
    var corrected =
      family === "ipv4" ? autocorrectIpv4Value(raw, opts) : autocorrectIpv6Value(raw, opts);
    var before = String(raw).trim();
    var after = String(corrected).trim();
    if (before === after) return null;
    return after;
  }

  function optsFromConstraintPanel(family) {
    var modeEl = document.getElementById("gc-designer-ip-constraint-mode");
    var mode = modeEl ? modeEl.value : "none";
    var cidrV4El = document.getElementById("gc-designer-ip-cidr-v4");
    var cidrV6El = document.getElementById("gc-designer-ip-cidr-v6");
    var loEl = document.getElementById("gc-designer-ip-range-lo");
    var hiEl = document.getElementById("gc-designer-ip-range-hi");
    var pfxEl = document.getElementById("gc-designer-ip-prefix");
    var cidrPfxMinEl = document.getElementById("gc-designer-ip-cidr-pfx-min");
    var cidrPfxMaxEl = document.getElementById("gc-designer-ip-cidr-pfx-max");
    var autoEl = document.getElementById("gc-designer-ip-autocorrect");
    var o = {
      withinCidr: "",
      rangeLo: "",
      rangeHi: "",
      prefix: "",
      cidrPrefixMin: "",
      cidrPrefixMax: "",
      storedPrefix: "",
      requireNetwork: false,
      requireValueCidr: false,
      autocorrect: false,
    };
    var pfxStr = pfxEl && pfxEl.value !== "" ? String(pfxEl.value) : "";
    if (mode === "cidr-subnet") {
      var v4c = cidrV4El && cidrV4El.value.trim();
      var v6c = cidrV6El && cidrV6El.value.trim();
      if (family === "ipv4" && v4c) o.withinCidr = v4c;
      if (family === "ipv6" && v6c) o.withinCidr = v6c;
      var cMin = cidrPfxMinEl && cidrPfxMinEl.value !== "" ? String(cidrPfxMinEl.value) : "";
      var cMax = cidrPfxMaxEl && cidrPfxMaxEl.value !== "" ? String(cidrPfxMaxEl.value) : "";
      if (family === "ipv4" && v4c && (cMin || cMax)) {
        if (cMin) o.cidrPrefixMin = cMin;
        if (cMax) o.cidrPrefixMax = cMax;
      }
      if (family === "ipv6" && v6c && (cMin || cMax)) {
        if (cMin) o.cidrPrefixMin = cMin;
        if (cMax) o.cidrPrefixMax = cMax;
      }
    } else if (mode === "ip-range" && family === "ipv4") {
      if (loEl && loEl.value.trim()) o.rangeLo = loEl.value.trim();
      if (hiEl && hiEl.value.trim()) o.rangeHi = hiEl.value.trim();
    } else if (mode === "network-only") {
      o.requireNetwork = true;
      if (pfxStr) o.prefix = pfxStr;
    } else if (mode === "value-cidr") {
      o.requireValueCidr = true;
    } else if (mode === "none" && autoEl && autoEl.checked && pfxStr) {
      o.prefix = pfxStr;
    }
    if (autoEl && autoEl.checked) {
      o.autocorrect = true;
      if (pfxStr && mode !== "cidr-subnet" && mode !== "value-cidr" && !o.prefix) {
        o.prefix = pfxStr;
      }
    }
    return o;
  }

  function designerIpOpts(inputEl, family) {
    if (hasAppliedIpConstraints(inputEl)) return readOptsFromInput(inputEl);
    return optsFromConstraintPanel(family);
  }

  function sampleIpv4InCidr(cidrSpec) {
    var c = parseCidrV4(cidrSpec);
    if (!c) return "192.0.2.1";
    var hostMax = (0xffffffff >>> c.prefix) >>> 0;
    if (hostMax <= 1) return intToIpv4(c.network);
    var cand = (c.network + Math.min(10, hostMax - 1)) >>> 0;
    return intToIpv4(cand);
  }

  function sampleIpv6InCidr(cidrSpec) {
    var c = parseCidrV6(cidrSpec);
    if (!c) return "2001:db8::1";
    var candidates = [
      "2001:db8::1",
      "2001:db8:0:1::1",
      "2001:db8:0:1::abcd",
      "::1",
      "fe80::1",
    ];
    for (var i = 0; i < candidates.length; i++) {
      var h = candidates[i].split("%")[0];
      if (ipv6InCidr(h, cidrSpec)) return candidates[i];
    }
    return bigIntToExpandedIpv6(c.network + 1n);
  }

  function pickDemoPrefix(bounds, maxPfx) {
    if (bounds === false) return Math.min(24, maxPfx);
    var mid = Math.floor((bounds.lo + bounds.hi) / 2);
    return Math.max(bounds.lo, Math.min(bounds.hi, mid));
  }

  function exampleIpv4Placeholder(opts) {
    var ex = "192.0.2.1";
    var bounds = cidrPrefixBoundsActive(opts, 32);
    if (opts.withinCidr) {
      ex = sampleIpv4InCidr(opts.withinCidr);
      if (bounds !== false) ex = ex + "/" + pickDemoPrefix(bounds, 32);
    } else if (opts.rangeLo && opts.rangeHi && IPV4_RE.test(opts.rangeLo) && IPV4_RE.test(opts.rangeHi)) {
      var a = ipv4ToInt(opts.rangeLo);
      var b = ipv4ToInt(opts.rangeHi);
      ex = a <= b ? intToIpv4(Math.floor((a + b) / 2)) : opts.rangeLo;
    } else if (opts.requireNetwork) {
      var p = parseInt(opts.prefix, 10);
      if (Number.isFinite(p) && p >= 0 && p <= 32) {
        var n = normalizeIpv4Network("10.20.30.0", p);
        ex = n != null ? n : "10.0.0.0";
      } else {
        ex = "10.0.0.0";
      }
    } else if (opts.requireValueCidr) {
      ex = "10.1.0.0/16";
    } else if (opts.autocorrect && opts.prefix) {
      var p2 = parseInt(opts.prefix, 10);
      if (Number.isFinite(p2) && p2 >= 0 && p2 <= 32) {
        var n2 = normalizeIpv4Network("192.0.2.17", p2);
        if (n2 != null) ex = n2;
      }
    }
    return ex;
  }

  function exampleIpv6Placeholder(opts) {
    var ex = "2001:db8::1";
    var bounds = cidrPrefixBoundsActive(opts, 128);
    if (opts.withinCidr) {
      ex = sampleIpv6InCidr(opts.withinCidr);
      if (bounds !== false) ex = ex + "/" + pickDemoPrefix(bounds, 128);
    } else if (opts.requireNetwork) {
      var p = parseInt(opts.prefix, 10);
      if (Number.isFinite(p) && p >= 0 && p <= 128) {
        var n = normalizeIpv6Network("2001:db8:1::", p);
        ex = n != null ? n : "2001::";
      } else {
        ex = "2001::";
      }
    } else if (opts.requireValueCidr) {
      ex = "2001:db8::/32";
    } else if (opts.autocorrect && opts.prefix) {
      var p2 = parseInt(opts.prefix, 10);
      if (Number.isFinite(p2) && p2 >= 0 && p2 <= 128) {
        var n2 = normalizeIpv6Network("2001:db8::cafe", p2);
        if (n2 != null) ex = n2;
      }
    }
    return ex;
  }

  function describeIpv4Constraints(opts) {
    var parts = [];
    parts.push("Empty allowed.");
    parts.push("Non-empty values must be a dotted IPv4 address.");
    if (opts.withinCidr) {
      parts.push("Must fall inside " + opts.withinCidr + ".");
      var b = cidrPrefixBoundsActive(opts, 32);
      if (b !== false) {
        parts.push("Enter host/prefix; prefix must be between /" + b.lo + " and /" + b.hi + ".");
      }
    }
    if (opts.rangeLo && opts.rangeHi) {
      parts.push("Must be between " + opts.rangeLo + " and " + opts.rangeHi + " inclusive.");
    }
    if (opts.requireNetwork) {
      if (opts.prefix) {
        parts.push("Must be the /" + opts.prefix + " network address (host bits zero).");
      } else {
        parts.push("Network-address mode: set prefix length in IP field properties.");
      }
    }
    if (opts.requireValueCidr) {
      parts.push(
        "Enter IPv4 CIDR (address/prefix). On blur: network address in the field, subnet mask in a pill, and data-gc-ip-network-address / data-gc-ip-netmask / data-gc-ip-prefix-length set."
      );
    }
    if (opts.autocorrect) {
      if (opts.withinCidr) {
        parts.push("On blur, host bits are cleared for the containment subnet mask.");
      } else if (opts.prefix) {
        parts.push("On blur, host bits are cleared for /" + opts.prefix + ".");
      } else {
        parts.push("Auto-correct on blur needs a prefix length or Within CIDR on this field.");
      }
    }
    return parts.join(" ");
  }

  function describeIpv6Constraints(opts) {
    var parts = [];
    parts.push("Empty allowed.");
    parts.push("Non-empty values must be a valid IPv6 address.");
    var modeEl = document.getElementById("gc-designer-ip-constraint-mode");
    var mode = modeEl ? modeEl.value : "none";
    if (mode === "ip-range") {
      parts.push("IPv4 range mode only constrains the IPv4 field.");
    }
    if (opts.withinCidr) {
      parts.push("Must fall inside " + opts.withinCidr + ".");
      var b = cidrPrefixBoundsActive(opts, 128);
      if (b !== false) {
        parts.push("Enter host/prefix; prefix must be between /" + b.lo + " and /" + b.hi + ".");
      }
    }
    if (opts.requireNetwork) {
      if (opts.prefix) {
        parts.push("Must be the /" + opts.prefix + " network address (host bits zero).");
      } else {
        parts.push("Network-address mode: set prefix length in IP field properties.");
      }
    }
    if (opts.requireValueCidr) {
      parts.push(
        "Enter IPv6 CIDR (address/prefix). On blur: network in the field, mask (or /prefix) in a pill, and data-gc-ip-network-address / data-gc-ip-netmask / data-gc-ip-prefix-length set."
      );
    }
    if (opts.autocorrect) {
      if (opts.withinCidr) {
        parts.push("On blur, host bits are cleared for the containment subnet mask.");
      } else if (opts.prefix) {
        parts.push("On blur, host bits are cleared for /" + opts.prefix + ".");
      } else {
        parts.push("Auto-correct on blur needs a prefix length or Within CIDR on this field.");
      }
    }
    return parts.join(" ");
  }

  function refreshDesignerIpHints() {
    var ipv4Inp = document.getElementById("gc-designer-controls-ipv4");
    var ipv6Inp = document.getElementById("gc-designer-controls-ipv6");
    var lab4 = document.getElementById("gc-designer-ipv4-l");
    var lab6 = document.getElementById("gc-designer-ipv6-l");
    var hint4 = document.getElementById("gc-designer-ipv4-constraints");
    var hint6 = document.getElementById("gc-designer-ipv6-constraints");
    if (!ipv4Inp || !ipv6Inp) return;
    var o4 = optsFromConstraintPanel("ipv4");
    var o6 = optsFromConstraintPanel("ipv6");
    var p4 = exampleIpv4Placeholder(o4);
    var p6 = exampleIpv6Placeholder(o6);
    var d4 = describeIpv4Constraints(o4);
    var d6 = describeIpv6Constraints(o6);
    ipv4Inp.placeholder = p4;
    ipv6Inp.placeholder = p6;
    if (lab4) lab4.setAttribute("title", d4);
    if (lab6) lab6.setAttribute("title", d6);
    if (hint4) hint4.textContent = d4;
    if (hint6) hint6.textContent = d6;
  }

  function clearValueCidrUi(input, pill) {
    if (pill) {
      pill.textContent = "";
      pill.hidden = true;
      pill.setAttribute("aria-hidden", "true");
      pill.removeAttribute("title");
    }
    var wrap = input ? input.closest(".gc-ip-field") : null;
    if (wrap) wrap.classList.remove("gc-ip-field--composite");
    if (input) {
      input.removeAttribute("data-gc-ip-network-address");
      input.removeAttribute("data-gc-ip-netmask");
      input.removeAttribute("data-gc-ip-prefix-length");
    }
  }

  function syncValueCidrMaskPill(input, pill, family, pfx) {
    if (!input || !pill || !Number.isFinite(pfx)) return;
    var wrap = input.closest(".gc-ip-field");
    var v = input.value.trim();
    if (family === "ipv4") {
      if (!IPV4_RE.test(v)) return;
      var net = normalizeIpv4Network(v, pfx);
      if (!net) return;
      if (net !== v) input.value = net;
      var mask = intToIpv4(cidrMask4(pfx));
      pill.textContent = mask;
      pill.hidden = false;
      pill.setAttribute("aria-hidden", "false");
      pill.setAttribute("title", "Subnet mask /" + pfx);
      input.setAttribute("data-gc-ip-network-address", net);
      input.setAttribute("data-gc-ip-netmask", mask);
      input.setAttribute("data-gc-ip-prefix-length", String(pfx));
      if (wrap) wrap.classList.add("gc-ip-field--composite");
    } else {
      var ixz = v.indexOf("%");
      var hostOnly = ixz !== -1 ? v.slice(0, ixz) : v;
      var zoneSuf = ixz !== -1 ? v.slice(ixz) : "";
      if (!isValidIpv6Shape(v)) return;
      var nv = normalizeIpv6Network(hostOnly, pfx);
      if (!nv) return;
      var full = nv + zoneSuf;
      if (full !== v) input.value = full;
      var mb = ipv6PrefixMask(pfx);
      var maskStr = mb !== null ? bigIntToExpandedIpv6(mb) : "";
      var pillText = maskStr.length > 28 ? "/" + pfx : maskStr;
      pill.textContent = pillText;
      pill.hidden = false;
      pill.setAttribute("aria-hidden", "false");
      pill.setAttribute("title", maskStr ? "Mask: " + maskStr : "");
      input.setAttribute("data-gc-ip-network-address", full);
      input.setAttribute("data-gc-ip-netmask", maskStr);
      input.setAttribute("data-gc-ip-prefix-length", String(pfx));
      if (wrap) wrap.classList.add("gc-ip-field--composite");
    }
  }

  function wireIpField(input, errEl, okEl, previewEl, maskPillEl, family, getOpts) {
    if (!input || !errEl) return;

    function hidePreview() {
      if (!previewEl) return;
      previewEl.textContent = "";
      previewEl.hidden = true;
    }

    function apply() {
      var opts = getOpts();
      var rawBefore = input.value;
      hidePreview();
      var savedPfx = NaN;
      if (opts.requireValueCidr) {
        var ix0 = rawBefore.lastIndexOf("/");
        if (ix0 !== -1) {
          savedPfx = parseInt(rawBefore.slice(ix0 + 1), 10);
        } else {
          savedPfx = parseInt(
            opts.storedPrefix || input.getAttribute("data-gc-ip-prefix-length") || "",
            10
          );
        }
      }
      var validateOpts = Object.assign({}, opts);
      if (opts.requireValueCidr && Number.isFinite(savedPfx)) {
        validateOpts.storedPrefix = String(savedPfx);
      }
      if (family === "ipv4") {
        input.value = autocorrectIpv4Value(rawBefore, validateOpts);
      } else {
        input.value = autocorrectIpv6Value(rawBefore, validateOpts);
      }
      if (!opts.requireValueCidr && maskPillEl) {
        clearValueCidrUi(input, maskPillEl);
      }
      var r =
        family === "ipv4"
          ? validateIpv4(input.value, validateOpts)
          : validateIpv6(input.value, validateOpts);
      if (opts.requireValueCidr && r.ok && maskPillEl && Number.isFinite(savedPfx)) {
        syncValueCidrMaskPill(input, maskPillEl, family, savedPfx);
      } else if (opts.requireValueCidr && !r.ok && maskPillEl) {
        clearValueCidrUi(input, maskPillEl);
      }
      input.setAttribute("aria-invalid", r.ok ? "false" : "true");
      if (r.ok) {
        errEl.textContent = "";
        errEl.hidden = true;
      } else {
        errEl.textContent = r.msg;
        errEl.hidden = false;
      }
      var showOk = r.ok && input.value.trim() !== "";
      if (okEl) {
        okEl.hidden = !showOk;
        okEl.setAttribute("aria-hidden", showOk ? "false" : "true");
      }
    }

    input.addEventListener("blur", apply);
    input.addEventListener("input", function () {
      var opts2 = getOpts();
      if (!opts2.requireValueCidr && maskPillEl) {
        clearValueCidrUi(input, maskPillEl);
      }
      var v = input.value.trim();
      var target = computeCorrectionTarget(input.value, family, opts2);
      var validateInput = Object.assign({}, opts2);
      if (opts2.requireValueCidr) {
        var ixV = input.value.lastIndexOf("/");
        if (ixV !== -1) {
          validateInput.storedPrefix = input.value.slice(ixV + 1);
        }
      }
      var r2 =
        family === "ipv4"
          ? validateIpv4(input.value, validateInput)
          : validateIpv6(input.value, validateInput);

      if (target) {
        errEl.textContent = "";
        errEl.hidden = true;
        if (previewEl) {
          previewEl.textContent = "Will be corrected to " + target + " when you leave this field.";
          previewEl.hidden = false;
        }
        input.setAttribute("aria-invalid", "false");
      } else {
        hidePreview();
        input.setAttribute("aria-invalid", r2.ok || v === "" ? "false" : "true");
        if (r2.ok || v === "") {
          errEl.textContent = "";
          errEl.hidden = true;
        } else {
          errEl.textContent = r2.msg;
          errEl.hidden = false;
        }
      }

      var showOk2 = r2.ok && v !== "" && !target;
      if (okEl) {
        okEl.hidden = !showOk2;
        okEl.setAttribute("aria-hidden", showOk2 ? "false" : "true");
      }
    });
  }
  function readAllGcIpAttrs(el) {
    var o = {};
    if (!el || !el.attributes) return o;
    for (var ai = 0; ai < el.attributes.length; ai++) {
      var n = el.attributes[ai].name;
      if (n.indexOf("data-gc-ip-") === 0) o[n] = el.attributes[ai].value;
    }
    return o;
  }

  function clearAllGcIpAttrs(el) {
    if (!el || !el.attributes) return;
    var rm = [];
    for (var bi = 0; bi < el.attributes.length; bi++) {
      var n2 = el.attributes[bi].name;
      if (n2.indexOf("data-gc-ip-") === 0) rm.push(n2);
    }
    for (var ri = 0; ri < rm.length; ri++) el.removeAttribute(rm[ri]);
  }

  function writeAllGcIpAttrs(el, attrs) {
    clearAllGcIpAttrs(el);
    if (!el || !attrs || typeof attrs !== "object") return;
    Object.keys(attrs).forEach(function (k) {
      if (k.indexOf("data-gc-ip-") !== 0) return;
      var v = attrs[k];
      if (v != null && String(v) !== "") el.setAttribute(k, String(v));
    });
  }
  window.__gcDesignerControlsBridge = window.__gcDesignerControlsBridge || {};
  window.__gcDesignerControlsBridge.ip = {
    readAllGcIpAttrs: readAllGcIpAttrs,
    clearAllGcIpAttrs: clearAllGcIpAttrs,
    writeAllGcIpAttrs: writeAllGcIpAttrs,
    hasAppliedIpConstraints: hasAppliedIpConstraints,
    readOptsFromInput: readOptsFromInput,
    formatWiredIpDisplayCidr: gcFormatWiredIpDisplayCidr,
    wireCatalogIpInput: function (input, errEl, okEl, previewEl, maskPillEl, family) {
      wireIpField(input, errEl, okEl, previewEl, maskPillEl, family, function () {
        return readOptsFromInput(input);
      });
    }
  };
  globalThis.gcFormatWiredIpDisplayCidr = gcFormatWiredIpDisplayCidr;

  /**
   * SFOS IPHost (and similar) expect IPv4 Subnet as a dotted netmask (e.g. 255.255.0.0).
   * Layout / CIDR UI often carries prefix length ("16") or dotted mask — normalize for API.
   */
  function gcIpv4MaskWireToFortiSubnet(maskPart) {
    var m = trimStrIp(maskPart);
    if (!m) return "";
    if (IPV4_RE.test(m)) return m;
    if (/^\d+$/.test(m)) {
      var p = parseInt(m, 10);
      if (p < 0 || p > 32) return m;
      if (p === 0) return "0.0.0.0";
      var mask = (0xffffffff << (32 - p)) >>> 0;
      return intToIpv4(mask);
    }
    return m;
  }
  globalThis.gcIpv4MaskWireToFortiSubnet = gcIpv4MaskWireToFortiSubnet;
})();
