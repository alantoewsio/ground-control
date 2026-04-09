/**
 * Chunked table work: append many <tr> nodes without blocking the main thread, and
 * run per-row setup (e.g. setRowFacets) in requestAnimationFrame slices.
 */
(function (global) {
  "use strict";

  let DEFAULT_THRESHOLD = 64;
  let DEFAULT_CHUNK = 50;

  /**
   * Insert each node from `nodes` into `parent` before `insertBefore` (or append if null).
   * When count exceeds `threshold`, uses requestAnimationFrame between chunks.
   */
  function appendBefore(parent, nodes, insertBefore, opts) {
    opts = opts || {};
    let chunk = opts.chunkSize != null ? opts.chunkSize : DEFAULT_CHUNK;
    let threshold = opts.threshold != null ? opts.threshold : DEFAULT_THRESHOLD;
    let onProgress = opts.onProgress;
    let onComplete = opts.onComplete;
    let isCancelled = opts.isCancelled;

    if (!parent || !nodes || !nodes.length) {
      if (onComplete) onComplete();
      return;
    }

    function cancelled() {
      return isCancelled && isCancelled();
    }

    if (nodes.length <= threshold) {
      for (let i = 0; i < nodes.length; i++) {
        if (cancelled()) return;
        if (insertBefore && insertBefore.parentNode === parent) {
          parent.insertBefore(nodes[i], insertBefore);
        } else {
          parent.appendChild(nodes[i]);
        }
      }
      if (!cancelled() && onComplete) onComplete();
      return;
    }

    let idx = 0;
    function step() {
      if (cancelled()) return;
      let end = Math.min(idx + chunk, nodes.length);
      for (; idx < end; idx++) {
        if (insertBefore && insertBefore.parentNode === parent) {
          parent.insertBefore(nodes[idx], insertBefore);
        } else {
          parent.appendChild(nodes[idx]);
        }
      }
      if (onProgress) onProgress(idx, nodes.length);
      if (idx < nodes.length) {
        requestAnimationFrame(step);
      } else if (!cancelled() && onComplete) {
        onComplete();
      }
    }
    requestAnimationFrame(step);
  }

  /**
   * Call fn(item, index) for each entry. Large arrays run in rAF chunks.
   */
  function forEachChunked(items, chunkSize, fn, done, opts) {
    opts = opts || {};
    let isCancelled = opts.isCancelled;
    let n = items.length;
    if (!n) {
      if (done) done();
      return;
    }
    let th = opts.threshold != null ? opts.threshold : DEFAULT_THRESHOLD;
    let ch = chunkSize || DEFAULT_CHUNK;

    function cancelled() {
      return isCancelled && isCancelled();
    }

    if (n <= th) {
      for (let j = 0; j < n; j++) {
        if (cancelled()) return;
        fn(items[j], j);
      }
      if (!cancelled() && done) done();
      return;
    }

    let idx = 0;
    function step() {
      if (cancelled()) return;
      let end = Math.min(idx + ch, n);
      for (; idx < end; idx++) {
        fn(items[idx], idx);
      }
      if (idx < n) {
        requestAnimationFrame(step);
      } else if (!cancelled() && done) {
        done();
      }
    }
    requestAnimationFrame(step);
  }

  global.gcTableLazy = {
    DEFAULT_THRESHOLD: DEFAULT_THRESHOLD,
    DEFAULT_CHUNK: DEFAULT_CHUNK,
    appendBefore: appendBefore,
    forEachChunked: forEachChunked,
  };
})(globalThis);
