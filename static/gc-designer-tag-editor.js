/**
 * Designer Controls · tag-editor: pill tag input with suggestions (shared with Inventory flyout).
 * Options: { tagPool: string[], maxTagLen?: number, maxTagCount?: number }
 */
(function () {
  "use strict";

  var TAG_COLOR_PALETTE = [
    { bg: "#0d9488", fg: "#fff", border: "#0f766e", rm: "rgba(255,255,255,0.85)" },
    { bg: "#2563eb", fg: "#fff", border: "#1d4ed8", rm: "rgba(255,255,255,0.85)" },
    { bg: "#7c3aed", fg: "#fff", border: "#6d28d9", rm: "rgba(255,255,255,0.85)" },
    { bg: "#db2777", fg: "#fff", border: "#be185d", rm: "rgba(255,255,255,0.85)" },
    { bg: "#ea580c", fg: "#fff", border: "#c2410c", rm: "rgba(255,255,255,0.85)" },
    { bg: "#ca8a04", fg: "#111", border: "#a16207", rm: "rgba(0,0,0,0.55)" },
    { bg: "#16a34a", fg: "#fff", border: "#15803d", rm: "rgba(255,255,255,0.85)" },
    { bg: "#0891b2", fg: "#fff", border: "#0e7490", rm: "rgba(255,255,255,0.85)" },
    { bg: "#4f46e5", fg: "#fff", border: "#4338ca", rm: "rgba(255,255,255,0.85)" },
    { bg: "#9333ea", fg: "#fff", border: "#7e22ce", rm: "rgba(255,255,255,0.85)" },
    { bg: "#e11d48", fg: "#fff", border: "#be123c", rm: "rgba(255,255,255,0.85)" },
    { bg: "#0f766e", fg: "#fff", border: "#115e59", rm: "rgba(255,255,255,0.85)" },
    { bg: "#0369a1", fg: "#fff", border: "#075985", rm: "rgba(255,255,255,0.85)" },
    { bg: "#a21caf", fg: "#fff", border: "#86198f", rm: "rgba(255,255,255,0.85)" },
    { bg: "#b45309", fg: "#fff", border: "#92400e", rm: "rgba(255,255,255,0.85)" },
    { bg: "#047857", fg: "#fff", border: "#065f46", rm: "rgba(255,255,255,0.85)" },
  ];

  function fnv1aLower(s) {
    var h = 2166136261;
    var str = String(s || "").toLowerCase();
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function tagColorForLabel(label) {
    var idx = fnv1aLower(label) % TAG_COLOR_PALETTE.length;
    return TAG_COLOR_PALETTE[idx];
  }

  function designerTagsSavedSet() {
    if (!globalThis.__gcDesignerTagsSaved) globalThis.__gcDesignerTagsSaved = new Set();
    return globalThis.__gcDesignerTagsSaved;
  }

  function isTagSaved(label) {
    return designerTagsSavedSet().has(String(label).toLowerCase());
  }

  function applyPillVisual(span, label) {
    span.classList.remove("gc-designer-tags__pill--unsaved", "gc-designer-tags__pill--saved");
    span.style.removeProperty("background-color");
    span.style.removeProperty("color");
    span.style.removeProperty("border-color");
    span.style.removeProperty("--pill-bg");
    span.style.removeProperty("--pill-fg");
    span.style.removeProperty("--pill-border");
    span.style.removeProperty("--pill-rm");
    var rm = span.querySelector(".gc-designer-tags__pill-remove");
    if (rm) {
      rm.style.removeProperty("color");
    }
    if (isTagSaved(label)) {
      var c = tagColorForLabel(label);
      span.classList.add("gc-designer-tags__pill--saved");
      span.style.setProperty("--pill-bg", c.bg);
      span.style.setProperty("--pill-fg", c.fg);
      span.style.setProperty("--pill-border", c.border);
      span.style.setProperty("--pill-rm", c.rm);
      if (rm) rm.style.color = c.rm;
    } else {
      span.classList.add("gc-designer-tags__pill--unsaved");
    }
  }

  if (typeof window !== "undefined") {
    window.gcDesignerTagEditorMarkSaved = function (root, labels) {
      var s = designerTagsSavedSet();
      (labels || []).forEach(function (t) {
        s.add(String(t).toLowerCase());
      });
      var api = root && root._gcDesignerTagApi;
      if (api && typeof api.rerender === "function") api.rerender();
    };

    window.gcDesignerTagEditorInit = function (root, options) {
      if (!root || root.dataset.gcDesignerTagBound === "1") return;
      root.dataset.gcDesignerTagBound = "1";

      var opt = options && typeof options === "object" ? options : {};
      var TAG_POOL = Array.isArray(opt.tagPool) ? opt.tagPool.map(String) : [];
      var maxTagLen = opt.maxTagLen != null ? Math.max(1, parseInt(opt.maxTagLen, 10) || 64) : 64;
      var maxTagCount = opt.maxTagCount != null ? Math.max(1, parseInt(opt.maxTagCount, 10) || 50) : 50;

      var hidden = root.querySelector(".gc-designer-tags__hidden");
      var field = root.querySelector(".gc-designer-tags__field");
      var chips = field ? field.querySelector(".gc-designer-tags__chips") : null;
      var input = field ? field.querySelector(".gc-designer-tags__input") : null;
      var suggest = root.querySelector(".gc-designer-tags__suggest");
      var mirrorTyped = root.querySelector(".gc-designer-tags__typed-mirror");
      var mirrorGhost = root.querySelector(".gc-designer-tags__ghost");
      var inputShell = root.querySelector(".gc-designer-tags__input-shell");

      if (!field || !chips || !input || !suggest) return;

      if (!suggest.id) {
        suggest.id = (root.id || "gc-designer-tags") + "-listbox";
      }
      input.setAttribute("aria-controls", suggest.id);

      var state = {
        tags: [],
        highlightIdx: -1,
        focused: false,
      };

      function tagSet() {
        var o = Object.create(null);
        state.tags.forEach(function (t) {
          o[String(t).toLowerCase()] = true;
        });
        return o;
      }

      function syncHidden() {
        if (hidden) hidden.value = JSON.stringify(state.tags);
      }

      function filterCandidates(q) {
        var ql = (q || "").trim().toLowerCase();
        var have = tagSet();
        var out = TAG_POOL.filter(function (t) {
          if (have[String(t).toLowerCase()]) return false;
          if (!ql) return true;
          return String(t).toLowerCase().indexOf(ql) !== -1;
        });
        out.sort(function (a, b) {
          var al = String(a).toLowerCase();
          var bl = String(b).toLowerCase();
          var ap = ql && al.indexOf(ql) === 0 ? 0 : 1;
          var bp = ql && bl.indexOf(ql) === 0 ? 0 : 1;
          if (ap !== bp) return ap - bp;
          return al.localeCompare(bl);
        });
        return out;
      }

      function getGhostSuffix(typed, candidates) {
        var q = typed;
        if (!q) return "";
        if (!candidates.length) return "";
        var first = candidates[0];
        if (first.toLowerCase().indexOf(q.toLowerCase()) !== 0) return "";
        return first.slice(q.length);
      }

      function updateMirrorAndSuggest() {
        var typed = input.value;
        var c = filterCandidates(typed);
        var ghost = getGhostSuffix(typed, c);
        if (mirrorTyped) mirrorTyped.textContent = typed;
        if (mirrorGhost) mirrorGhost.textContent = ghost;

        if (!state.focused) {
          suggest.hidden = true;
          input.setAttribute("aria-expanded", "false");
          return;
        }
        if (!c.length) {
          suggest.hidden = true;
          input.setAttribute("aria-expanded", "false");
          state.highlightIdx = -1;
          return;
        }
        var max = 10;
        var slice = c.slice(0, max);
        if (state.highlightIdx < 0 || state.highlightIdx >= slice.length) state.highlightIdx = 0;
        suggest.innerHTML = "";
        slice.forEach(function (tag, idx) {
          var li = document.createElement("li");
          li.setAttribute("role", "presentation");
          if (idx === state.highlightIdx) li.classList.add("is-active");
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "gc-designer-tags__suggest-btn";
          btn.setAttribute("role", "option");
          btn.textContent = tag;
          btn.addEventListener("mousedown", function (e) {
            e.preventDefault();
          });
          btn.addEventListener("click", function () {
            addTag(tag);
          });
          li.appendChild(btn);
          suggest.appendChild(li);
        });
        suggest.hidden = false;
        input.setAttribute("aria-expanded", "true");
      }

      function addTag(raw) {
        if (state.tags.length >= maxTagCount) return;
        var t = String(raw || "").trim().slice(0, maxTagLen);
        if (!t) return;
        var k = t.toLowerCase();
        for (var i = 0; i < state.tags.length; i++) {
          if (String(state.tags[i]).toLowerCase() === k) return;
        }
        state.tags.push(t);
        input.value = "";
        state.highlightIdx = -1;
        syncHidden();
        render();
        updateMirrorAndSuggest();
        try {
          input.focus();
        } catch (eF) {}
      }

      function removeTagIndex(i) {
        if (i < 0 || i >= state.tags.length) return;
        state.tags.splice(i, 1);
        syncHidden();
        render();
        updateMirrorAndSuggest();
      }

      function createPillNode(label, indexInTags, forMeasure) {
        var span = document.createElement("span");
        span.className = "gc-designer-tags__pill";
        span.setAttribute("data-tag", label);
        var t = document.createElement("span");
        t.className = "gc-designer-tags__pill-text";
        t.textContent = label;
        span.appendChild(t);
        if (!forMeasure && indexInTags >= 0) {
          var rm = document.createElement("button");
          rm.type = "button";
          rm.className = "gc-designer-tags__pill-remove";
          rm.setAttribute("aria-label", "Remove " + label);
          rm.innerHTML = "\u00d7";
          rm.addEventListener("mousedown", function (e) {
            e.preventDefault();
          });
          rm.addEventListener("click", function (e) {
            e.stopPropagation();
            removeTagIndex(indexInTags);
          });
          span.appendChild(rm);
        }
        applyPillVisual(span, label);
        return span;
      }

      function createOverflowNode(n) {
        var span = document.createElement("span");
        span.className = "gc-designer-tags__pill gc-designer-tags__pill--overflow";
        span.setAttribute("aria-hidden", "true");
        var t = document.createElement("span");
        t.className = "gc-designer-tags__pill-text";
        t.textContent = "+" + n;
        span.appendChild(t);
        return span;
      }

      var measureEl = null;
      function ensureMeasure() {
        if (measureEl) return measureEl;
        measureEl = document.createElement("div");
        measureEl.className = "gc-designer-tags__measure";
        measureEl.setAttribute("aria-hidden", "true");
        root.appendChild(measureEl);
        return measureEl;
      }

      function measureRowWidth(tagsSlice, overflowCount) {
        var m = ensureMeasure();
        m.innerHTML = "";
        for (var i = 0; i < tagsSlice.length; i++) {
          m.appendChild(createPillNode(tagsSlice[i], -1, true));
        }
        if (overflowCount > 0) {
          m.appendChild(createOverflowNode(overflowCount));
        }
        return m.scrollWidth;
      }

      function renderCollapsedChips() {
        var tags = state.tags;
        var avail = field.clientWidth - 16;
        if (avail < 48) avail = 220;
        chips.innerHTML = "";
        var n = tags.length;
        if (n === 0) return;
        var k = n;
        while (k > 0) {
          var over = n - k;
          var w = measureRowWidth(tags.slice(0, k), over);
          if (w <= avail) break;
          k--;
        }
        var over2 = n - k;
        for (var i = 0; i < k; i++) {
          chips.appendChild(createPillNode(tags[i], i, false));
        }
        if (over2 > 0) {
          chips.appendChild(createOverflowNode(over2));
        }
      }

      function renderExpandedChips() {
        chips.innerHTML = "";
        state.tags.forEach(function (tg, i) {
          chips.appendChild(createPillNode(tg, i, false));
        });
      }

      function render() {
        if (state.focused) {
          root.classList.remove("is-collapsed");
          renderExpandedChips();
        } else {
          root.classList.add("is-collapsed");
          renderCollapsedChips();
        }
      }

      var blurTimer = null;
      function queueBlurCollapse() {
        if (blurTimer) clearTimeout(blurTimer);
        blurTimer = setTimeout(function () {
          blurTimer = null;
          state.focused = false;
          suggest.hidden = true;
          input.setAttribute("aria-expanded", "false");
          render();
        }, 130);
      }

      function cancelBlurCollapse() {
        if (blurTimer) clearTimeout(blurTimer);
        blurTimer = null;
      }

      field.addEventListener("mousedown", function (e) {
        if (e.target.closest(".gc-designer-tags__pill-remove")) return;
        if (!inputShell.contains(e.target)) {
          e.preventDefault();
          input.focus();
        }
      });

      input.addEventListener("focus", function () {
        cancelBlurCollapse();
        state.focused = true;
        render();
        updateMirrorAndSuggest();
      });
      input.addEventListener("blur", function () {
        queueBlurCollapse();
      });
      input.addEventListener("input", function () {
        state.highlightIdx = -1;
        updateMirrorAndSuggest();
      });
      input.addEventListener("keydown", function (e) {
        var sl = suggest && !suggest.hidden;
        var opts = suggest ? suggest.querySelectorAll(".gc-designer-tags__suggest-btn") : [];
        if (e.key === "ArrowDown" && sl && opts.length) {
          e.preventDefault();
          state.highlightIdx = Math.min(state.highlightIdx + 1, opts.length - 1);
          updateMirrorAndSuggest();
          return;
        }
        if (e.key === "ArrowUp" && sl && opts.length) {
          e.preventDefault();
          state.highlightIdx = Math.max(state.highlightIdx - 1, 0);
          updateMirrorAndSuggest();
          return;
        }
        if (e.key === "Enter") {
          var typed = input.value.trim().slice(0, maxTagLen);
          var c = filterCandidates(typed);
          if (sl && state.highlightIdx >= 0 && opts[state.highlightIdx]) {
            e.preventDefault();
            addTag(opts[state.highlightIdx].textContent);
            return;
          }
          if (typed && c.length) {
            e.preventDefault();
            var exact = null;
            for (var ci = 0; ci < c.length; ci++) {
              if (String(c[ci]).toLowerCase() === typed.toLowerCase()) {
                exact = c[ci];
                break;
              }
            }
            if (exact) addTag(exact);
            else addTag(c[0]);
            return;
          }
          if (typed) {
            e.preventDefault();
            addTag(typed);
          }
        }
        if (e.key === "Escape") {
          if (suggest && !suggest.hidden) {
            e.preventDefault();
            suggest.hidden = true;
            input.setAttribute("aria-expanded", "false");
            state.highlightIdx = -1;
          }
        }
      });

      window.addEventListener("resize", function () {
        if (!state.focused) render();
      });

      if (typeof ResizeObserver !== "undefined") {
        var ro = new ResizeObserver(function () {
          if (!state.focused) render();
        });
        ro.observe(field);
      }

      var api = {
        getTags: function () {
          return state.tags.slice();
        },
        setTags: function (arr) {
          state.tags = Array.isArray(arr) ? arr.map(function (x) { return String(x).slice(0, maxTagLen); }) : [];
          if (state.tags.length > maxTagCount) {
            state.tags = state.tags.slice(0, maxTagCount);
          }
          syncHidden();
          render();
          updateMirrorAndSuggest();
        },
        rerender: function () {
          render();
          updateMirrorAndSuggest();
        },
      };
      root._gcDesignerTagApi = api;

      render();
      syncHidden();
    };
  }
})();
