/**
 * Segmented option selector: intrinsic width; falls back to a native <select>
 * when pill row would exceed the parent width (avoids wrapping).
 */
(function () {
  "use strict";

  function parseItemsAttr(grp) {
    if (!grp) return null;
    var raw = grp.getAttribute("data-gc-designer-selector-items");
    if (!raw) return null;
    try {
      var j = JSON.parse(raw);
      return Array.isArray(j) ? j.map(function (x) { return String(x); }) : null;
    } catch (e) {
      return null;
    }
  }

  function measurePillsWidth(labels) {
    var measure = document.createElement("div");
    measure.className = "gc-option-selector";
    measure.setAttribute(
      "style",
      "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;z-index:-1"
    );
    labels.forEach(function (label) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn gc-option-selector__btn";
      btn.textContent = label;
      measure.appendChild(btn);
    });
    document.body.appendChild(measure);
    var w = measure.offsetWidth;
    measure.remove();
    return w;
  }

  function getAvailableWidth(grp) {
    var p = grp.parentElement;
    if (!p) return 1e9;
    var rect = p.getBoundingClientRect();
    var cs = window.getComputedStyle(p);
    var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    var w = rect.width - pad;
    if (w < 24) return null;
    return w;
  }

  function getSelectedLabel(grp) {
    var sel = grp.querySelector("select.gc-option-selector__native");
    if (sel && sel.options.length) {
      var o = sel.options[sel.selectedIndex];
      return o ? String(o.textContent || o.value || "").trim() : "";
    }
    var cur = grp.querySelector(".gc-option-selector__btn.primary");
    return cur ? cur.textContent.trim() : "";
  }

  function mountPills(grp, labels, selectedLabel) {
    grp.setAttribute("data-gc-option-selector-mode", "pills");
    grp.classList.add("gc-option-selector");
    grp.classList.remove("gc-option-selector--as-select");
    grp.innerHTML = "";
    labels.forEach(function (label) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn gc-option-selector__btn";
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = label;
      grp.appendChild(btn);
    });
    var btns = grp.querySelectorAll(".gc-option-selector__btn");
    var picked = false;
    if (selectedLabel) {
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === selectedLabel) {
          btns[i].classList.add("primary");
          btns[i].setAttribute("aria-pressed", "true");
          picked = true;
          break;
        }
      }
    }
    if (!picked && btns[0]) {
      btns[0].classList.add("primary");
      btns[0].setAttribute("aria-pressed", "true");
    }
  }

  function mountSelect(grp, labels, selectedLabel) {
    grp.setAttribute("data-gc-option-selector-mode", "select");
    grp.classList.remove("gc-option-selector");
    grp.classList.add("gc-option-selector--as-select");
    grp.innerHTML = "";
    var sel = document.createElement("select");
    sel.className = "settings-form__input mono gc-option-selector__native";
    var al = grp.getAttribute("aria-label");
    if (al) sel.setAttribute("aria-label", al);
    labels.forEach(function (label) {
      var opt = document.createElement("option");
      opt.value = label;
      opt.textContent = label;
      sel.appendChild(opt);
    });
    var picked = false;
    if (selectedLabel) {
      for (var j = 0; j < sel.options.length; j++) {
        if (sel.options[j].value === selectedLabel || sel.options[j].textContent.trim() === selectedLabel) {
          sel.selectedIndex = j;
          picked = true;
          break;
        }
      }
    }
    if (!picked && sel.options.length) sel.selectedIndex = 0;
    grp.appendChild(sel);
  }

  function labelsFromDom(grp) {
    var sel0 = grp.querySelector("select.gc-option-selector__native");
    if (sel0) {
      return Array.prototype.map
        .call(sel0.options, function (o) {
          return o.textContent.trim();
        })
        .filter(Boolean);
    }
    var lines = [];
    grp.querySelectorAll(".gc-option-selector__btn").forEach(function (b) {
      lines.push(b.textContent.trim());
    });
    return lines.filter(Boolean);
  }

  var optionSelectorResizeObserver = null;
  var observedParents = new WeakSet();

  function observeParentIfNeeded(grp) {
    if (typeof ResizeObserver === "undefined" || !grp) return;
    var p = grp.parentElement;
    if (!p || observedParents.has(p)) return;
    observedParents.add(p);
    if (!optionSelectorResizeObserver) {
      optionSelectorResizeObserver = new ResizeObserver(function (entries) {
        entries.forEach(function (ent) {
          ent.target.querySelectorAll("[data-gc-option-selector]").forEach(function (g) {
            syncLayout(g);
          });
        });
      });
    }
    optionSelectorResizeObserver.observe(p);
  }

  function syncLayout(grp) {
    if (!grp || grp.getAttribute("data-gc-option-selector") == null) return;
    var labels = parseItemsAttr(grp);
    if (!labels || !labels.length) labels = labelsFromDom(grp);
    if (!labels.length) labels = ["On", "Off"];
    grp.setAttribute("data-gc-designer-selector-items", JSON.stringify(labels));

    var avail = getAvailableWidth(grp);
    if (avail == null) {
      requestAnimationFrame(function () {
        syncLayout(grp);
      });
      return;
    }

    var natural = measurePillsWidth(labels);
    var eps = 6;
    var useSelect = natural > avail - eps;

    var selected = getSelectedLabel(grp);
    var mode = grp.getAttribute("data-gc-option-selector-mode");

    if (useSelect) {
      var s = grp.querySelector("select.gc-option-selector__native");
      var cur = s
        ? Array.prototype.map.call(s.options, function (o) {
            return o.textContent.trim();
          })
        : [];
      var same =
        mode === "select" &&
        cur.length === labels.length &&
        cur.every(function (x, i) {
          return x === labels[i];
        });
      if (!same) {
        mountSelect(grp, labels, selected);
      }
    } else {
      var btns = grp.querySelectorAll(".gc-option-selector__btn");
      var curL = Array.prototype.map.call(btns, function (b) {
        return b.textContent.trim();
      });
      var same2 =
        mode === "pills" &&
        curL.length === labels.length &&
        curL.every(function (x, i) {
          return x === labels[i];
        });
      if (!same2) {
        mountPills(grp, labels, selected);
      }
    }
  }

  function setSelection(grp, wantLabel, idx) {
    if (!grp) return;
    var selEl = grp.querySelector("select.gc-option-selector__native");
    if (selEl && selEl.options.length) {
      if (Number.isFinite(idx) && idx >= 0 && idx < selEl.options.length) {
        selEl.selectedIndex = idx;
        return;
      }
      if (wantLabel != null) {
        var wl = String(wantLabel).trim();
        if (wl) {
          for (var i = 0; i < selEl.options.length; i++) {
            var o = selEl.options[i];
            if (o.textContent.trim() === wl || o.value === wl) {
              selEl.selectedIndex = i;
              return;
            }
          }
        }
      }
      return;
    }
    var btns = grp.querySelectorAll(".gc-option-selector__btn");
    var targetBtn = null;
    if (Number.isFinite(idx) && idx >= 0 && idx < btns.length) targetBtn = btns[idx];
    if (!targetBtn && wantLabel != null) {
      var wl2 = String(wantLabel).trim();
      if (wl2) {
        for (var j = 0; j < btns.length; j++) {
          if (btns[j].textContent.trim() === wl2) {
            targetBtn = btns[j];
            break;
          }
        }
      }
    }
    if (!targetBtn) return;
    btns.forEach(function (b) {
      b.classList.remove("primary");
      b.setAttribute("aria-pressed", "false");
    });
    targetBtn.classList.add("primary");
    targetBtn.setAttribute("aria-pressed", "true");
  }

  function rebuild(grp, items, opts) {
    if (!grp) return;
    opts = opts || {};
    var prevLabel = opts.preserveSelectedLabel;
    if (prevLabel == null) prevLabel = getSelectedLabel(grp);
    var labels = (Array.isArray(items) ? items : [])
      .map(function (x) {
        return String(x).trim();
      })
      .filter(function (s) {
        return s !== "";
      });
    if (!labels.length) labels = ["On", "Off"];
    grp.setAttribute("data-gc-designer-selector-items", JSON.stringify(labels));
    mountPills(grp, labels, prevLabel);
    observeParentIfNeeded(grp);
    syncLayout(grp);
  }

  function itemsAsText(grp) {
    var fromAttr = parseItemsAttr(grp);
    if (fromAttr && fromAttr.length) return fromAttr.join("\n");
    var sel = grp.querySelector("select.gc-option-selector__native");
    if (sel) {
      var lines = [];
      Array.prototype.forEach.call(sel.options, function (o) {
        var t = o.textContent.trim();
        if (t) lines.push(t);
      });
      return lines.join("\n");
    }
    var lines2 = [];
    if (grp) {
      grp.querySelectorAll(".gc-option-selector__btn").forEach(function (b) {
        lines2.push(b.textContent.trim());
      });
    }
    return lines2.join("\n");
  }

  function attachHandlersOnce() {
    if (document.documentElement.getAttribute("data-gc-option-selector-delegation") === "1") return;
    document.documentElement.setAttribute("data-gc-option-selector-delegation", "1");
    document.addEventListener("click", function (e) {
      var group = e.target.closest && e.target.closest("[data-gc-option-selector]");
      if (!group) return;
      var btn = e.target.closest(".gc-option-selector__btn");
      if (!btn || !group.contains(btn)) return;
      group.querySelectorAll(".gc-option-selector__btn").forEach(function (b) {
        b.classList.remove("primary");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("primary");
      btn.setAttribute("aria-pressed", "true");
    });
  }

  function initDocument() {
    attachHandlersOnce();
    document.querySelectorAll("[data-gc-option-selector]").forEach(function (grp) {
      if (!grp.querySelector(".gc-option-selector__btn") && !grp.querySelector("select.gc-option-selector__native")) {
        var parsed = parseItemsAttr(grp);
        rebuild(grp, parsed && parsed.length ? parsed : ["On", "Off"], {});
      } else {
        observeParentIfNeeded(grp);
        syncLayout(grp);
      }
    });
  }

  window.gcOptionSelectorParseItemsAttr = parseItemsAttr;
  window.gcOptionSelectorGetSelectedLabel = getSelectedLabel;
  window.gcOptionSelectorSyncLayout = syncLayout;
  window.gcOptionSelectorRebuild = rebuild;
  window.gcOptionSelectorItemsAsText = itemsAsText;
  window.gcOptionSelectorObserveParentIfNeeded = observeParentIfNeeded;
  window.gcOptionSelectorInitDocument = initDocument;
  window.gcOptionSelectorSetSelection = setSelection;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDocument);
  } else {
    initDocument();
  }
})();
