/**
 * Lightweight Snort 2–style syntax coloring for IPS custom rule text.
 * Highlights actions, protocols, variables, quoted strings, option keywords, numbers, comments.
 */
(function () {
  "use strict";

  var ACTIONS = {
    alert: true,
    log: true,
    pass: true,
    drop: true,
    reject: true,
    sdrop: true,
  };
  var PROTOS = { tcp: true, udp: true, icmp: true, ip: true };
  var OPTION_KW = {
    msg: true,
    content: true,
    pcre: true,
    sid: true,
    rev: true,
    gid: true,
    classtype: true,
    reference: true,
    metadata: true,
    nocase: true,
    rawbytes: true,
    depth: true,
    offset: true,
    distance: true,
    within: true,
    byte_test: true,
    byte_jump: true,
    byte_extract: true,
    isdataat: true,
    dsize: true,
    flags: true,
    flow: true,
    flowbits: true,
    threshold: true,
    detection_filter: true,
    replace: true,
    uricontent: true,
    urilen: true,
    http_inspect: true,
    fast_pattern: true,
    pkt_data: true,
    file_data: true,
    ssl_version: true,
    ssl_state: true,
    tls_version: true,
    tag: true,
    priority: true,
    sameip: true,
    ipopts: true,
    fragbits: true,
    fragoffset: true,
    ttl: true,
    tos: true,
    id: true,
    ip_proto: true,
    window: true,
    seq: true,
    ack: true,
    itype: true,
    icode: true,
    icmp_id: true,
    icmp_seq: true,
    rpc: true,
    ipoption: true,
    regex: true,
  };

  function esc(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function span(cls, text) {
    return '<span class="' + cls + '">' + esc(text) + "</span>";
  }

  /**
   * @param {string} src
   * @returns {string} HTML (escaped content inside spans)
   */
  function highlightSnortRule(src) {
    if (src == null) src = "";
    src = String(src);
    var out = [];
    var n = src.length;
    var i = 0;
    var lineStart = true;
    var parenDepth = 0;
    var sawActionSlot = true;

    function peek() {
      return i < n ? src.charAt(i) : "";
    }
    function consume(ch) {
      out.push(esc(ch));
      i++;
    }

    while (i < n) {
      var c = peek();
      if (c === "\r") {
        i++;
        continue;
      }
      if (c === "\n") {
        consume("\n");
        lineStart = true;
        parenDepth = 0;
        sawActionSlot = true;
        continue;
      }
      if (lineStart && /\s/.test(c)) {
        consume(c);
        continue;
      }
      lineStart = false;

      if (c === "#") {
        var start = i;
        while (i < n && src.charAt(i) !== "\n") i++;
        out.push(span("gc-snort-tok--comment", src.slice(start, i)));
        continue;
      }

      if (c === '"') {
        var qs = i;
        i++;
        while (i < n) {
          var q = src.charAt(i);
          if (q === "\\" && i + 1 < n) {
            i += 2;
            continue;
          }
          if (q === '"') {
            i++;
            break;
          }
          i++;
        }
        out.push(span("gc-snort-tok--string", src.slice(qs, i)));
        continue;
      }

      if (c === "$") {
        var vs = i;
        i++;
        while (i < n && /[A-Za-z0-9_]/.test(src.charAt(i))) i++;
        out.push(span("gc-snort-tok--var", src.slice(vs, i)));
        sawActionSlot = false;
        continue;
      }

      if (/[0-9]/.test(c)) {
        var ns = i;
        while (i < n && /[0-9]/.test(src.charAt(i))) i++;
        out.push(span("gc-snort-tok--number", src.slice(ns, i)));
        sawActionSlot = false;
        continue;
      }

      if (/[a-zA-Z_]/.test(c)) {
        var ws = i;
        while (i < n && /[a-zA-Z0-9_]/.test(src.charAt(i))) i++;
        var w = src.slice(ws, i);
        var wl = w.toLowerCase();
        var next = peek();
        var cls = "gc-snort-tok--ident";
        if (sawActionSlot && ACTIONS[wl]) {
          cls = "gc-snort-tok--action";
        } else if (sawActionSlot && PROTOS[wl]) {
          cls = "gc-snort-tok--proto";
        } else if (next === ":" && (OPTION_KW[wl] || /^[a-z_][a-z0-9_]*$/i.test(w))) {
          cls = "gc-snort-tok--optkw";
        }
        if (cls !== "gc-snort-tok--ident") {
          sawActionSlot = false;
        } else if (wl === "any") {
          cls = "gc-snort-tok--kw";
          sawActionSlot = false;
        } else {
          sawActionSlot = false;
        }
        out.push(span(cls, w));
        continue;
      }

      if (c === "(") {
        parenDepth++;
        consume("(");
        sawActionSlot = false;
        continue;
      }
      if (c === ")") {
        if (parenDepth > 0) parenDepth--;
        consume(")");
        continue;
      }

      if (c === ";" || c === ":" || c === ",") {
        consume(c);
        if (c === ";") sawActionSlot = true;
        continue;
      }

      if (c === "-" && src.charAt(i + 1) === ">") {
        out.push(span("gc-snort-tok--arrow", "->"));
        i += 2;
        sawActionSlot = false;
        continue;
      }
      if (c === "<" && src.charAt(i + 1) === ">") {
        out.push(span("gc-snort-tok--arrow", "<>"));
        i += 2;
        sawActionSlot = false;
        continue;
      }

      consume(c);
      sawActionSlot = false;
    }

    return out.join("");
  }

  window.gcSnortRuleHighlightToHtml = highlightSnortRule;
})();
