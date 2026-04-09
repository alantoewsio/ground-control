(function () {
  "use strict";

  let refreshers = [];

  function normalizeIdList(raw) {
    if (!raw) return [];
    let arr = Array.isArray(raw) ? raw : [raw];
    let out = [];
    for (let i = 0; i < arr.length; i++) {
      let v = arr[i];
      let n = typeof v === "number" ? v : parseInt(v, 10);
      if (!isNaN(n) && n > 0 && out.indexOf(n) === -1) out.push(n);
    }
    return out;
  }

  function idsFromPostSync(ps) {
    if (ps == null) return [];
    let list = Array.isArray(ps) ? ps : [ps];
    let out = [];
    for (let i = 0; i < list.length; i++) {
      let p = list[i];
      if (!p || p.firewall_id == null) continue;
      if (p.ok !== true) continue;
      let n = parseInt(p.firewall_id, 10);
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
    let d = detail || {};
    for (let i = 0; i < refreshers.length; i++) {
      try {
        refreshers[i](ids, d);
      } catch (e) {}
    }
  }

  function handleConfigCacheSynced(detail) {
    let d = detail || {};
    let ids = normalizeDetail(d);
    if (!ids.length) return;
    runRefreshers(ids, d);
  }

  /**
   * Register a callback after config cache sync. Receives firewall id(s) that were synced
   * and the original event detail (e.g. post_sync for entity-aware refresh).
   * @param {function(number[], object): void} fn
   * @returns {function(): void} unregister
   */
  globalThis.gcRegisterConfigCacheTableRefresher = function (fn) {
    if (typeof fn !== "function") {
      return function () {};
    }
    refreshers.push(fn);
    return function unregister() {
      let j = refreshers.indexOf(fn);
      if (j !== -1) refreshers.splice(j, 1);
    };
  };

  document.addEventListener("gc-config-cache-synced", function (ev) {
    handleConfigCacheSynced(ev.detail);
  });

  globalThis.addEventListener("message", function (ev) {
    if (ev.origin !== globalThis.location.origin) return;
    let d = ev.data;
    if (!d || d.source !== "ground-control" || d.type !== "gc-config-cache-synced") return;
    handleConfigCacheSynced({ firewall_ids: d.firewall_ids });
  });
})();
