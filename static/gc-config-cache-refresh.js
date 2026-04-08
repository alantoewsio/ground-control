(function () {
  "use strict";

  var refreshers = [];

  function normalizeIdList(raw) {
    if (!raw) return [];
    var arr = Array.isArray(raw) ? raw : [raw];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      var n = typeof v === "number" ? v : parseInt(v, 10);
      if (!isNaN(n) && n > 0 && out.indexOf(n) === -1) out.push(n);
    }
    return out;
  }

  function idsFromPostSync(ps) {
    if (ps == null) return [];
    var list = Array.isArray(ps) ? ps : [ps];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || p.firewall_id == null) continue;
      if (p.ok !== true) continue;
      var n = parseInt(p.firewall_id, 10);
      if (!isNaN(n) && n > 0 && out.indexOf(n) === -1) out.push(n);
    }
    return out;
  }

  function normalizeDetail(detail) {
    if (!detail) return [];
    if (detail.firewall_ids && detail.firewall_ids.length) return normalizeIdList(detail.firewall_ids);
    return idsFromPostSync(detail.post_sync);
  }

  function runRefreshers(ids, detail) {
    var d = detail || {};
    for (var i = 0; i < refreshers.length; i++) {
      try {
        refreshers[i](ids, d);
      } catch (e) {}
    }
  }

  function handleConfigCacheSynced(detail) {
    var d = detail || {};
    var ids = normalizeDetail(d);
    if (!ids.length) return;
    runRefreshers(ids, d);
  }

  /**
   * Register a callback after config cache sync. Receives firewall id(s) that were synced
   * and the original event detail (e.g. post_sync for entity-aware refresh).
   * @param {function(number[], object): void} fn
   * @returns {function(): void} unregister
   */
  window.gcRegisterConfigCacheTableRefresher = function (fn) {
    if (typeof fn !== "function") {
      return function () {};
    }
    refreshers.push(fn);
    return function unregister() {
      var j = refreshers.indexOf(fn);
      if (j !== -1) refreshers.splice(j, 1);
    };
  };

  document.addEventListener("gc-config-cache-synced", function (ev) {
    handleConfigCacheSynced(ev.detail);
  });

  window.addEventListener("message", function (ev) {
    if (ev.origin !== window.location.origin) return;
    var d = ev.data;
    if (!d || d.source !== "ground-control" || d.type !== "gc-config-cache-synced") return;
    handleConfigCacheSynced({ firewall_ids: d.firewall_ids });
  });
})();
