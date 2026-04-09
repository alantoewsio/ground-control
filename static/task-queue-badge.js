(function () {
  "use strict";

  let COUNT_URL = "/api/task-queue/count";
  let pollMs = 8000;

  function badgeWraps() {
    return document.querySelectorAll("[data-gc-task-queue-badge]");
  }

  function badgeLinks() {
    return document.querySelectorAll("[data-gc-task-queue-badge-link]");
  }

  function applyCount(n, errorCount) {
    let c = typeof n === "number" && n >= 0 ? n : 0;
    let err =
      typeof errorCount === "number" && errorCount >= 0 ? errorCount : 0;
    let wraps = badgeWraps();
    let label =
      "Task queue, " + c + " item" + (c === 1 ? "" : "s") + " queued";
    let labelFull =
      err > 0
        ? label +
          (err === 1 ? ", 1 with an error" : ", " + err + " with errors")
        : label;
    let numText = c > 99 ? "99+" : String(c);
    let tabLine =
      c < 1
        ? ""
        : "Task Queue - " +
          c +
          " item" +
          (c === 1 ? "" : "s") +
          " pending";

    if (wraps.length) {
      wraps.forEach(function (wrap) {
        wrap.classList.remove(
          "task-queue-nav-badge--pending",
          "task-queue-nav-badge--error",
        );
        let num = wrap.querySelector("[data-gc-task-queue-badge-num]");
        if (c < 1) {
          wrap.hidden = true;
          wrap.setAttribute("aria-hidden", "true");
        } else {
          if (num) num.textContent = numText;
          wrap.hidden = false;
          wrap.setAttribute("aria-hidden", "false");
          if (err > 0) {
            wrap.classList.add("task-queue-nav-badge--error");
          } else {
            wrap.classList.add("task-queue-nav-badge--pending");
          }
        }
      });
    }

    badgeLinks().forEach(function (link) {
      if (c < 1) {
        link.removeAttribute("aria-label");
      } else {
        link.setAttribute("aria-label", labelFull);
      }
    });

    document.querySelectorAll("[data-gc-task-queue-tab-label]").forEach(function (el) {
      el.textContent = tabLine;
    });

    let bottomTab = document.getElementById("gc-task-queue-bottom-tab");
    if (bottomTab) {
      if (c < 1) {
        bottomTab.hidden = true;
        bottomTab.setAttribute("aria-hidden", "true");
      } else {
        let dock = document.getElementById("gc-task-queue-dock");
        let dockOpen = dock && !dock.hidden;
        if (!dockOpen) {
          bottomTab.hidden = false;
          bottomTab.setAttribute("aria-hidden", "false");
        }
      }
    }

    let openDockBtn = document.getElementById("gc-task-queue-dock-open");
    if (openDockBtn) {
      if (c < 1) {
        openDockBtn.removeAttribute("aria-label");
      } else {
        openDockBtn.setAttribute("aria-label", "Open task queue. " + labelFull);
      }
    }

    globalThis.gcTaskQueueBadgeCount = c;
  }

  function refresh() {
    fetch(COUNT_URL, { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(function (data) {
        let n = data && typeof data.count === "number" ? data.count : 0;
        let ec =
          data && typeof data.error_count === "number" ? data.error_count : 0;
        applyCount(n, ec);
      })
      .catch(function () {
        applyCount(0, 0);
      });
  }

  globalThis.gcRefreshTaskQueueBadge = refresh;

  document.addEventListener("gc-task-queue-updated", refresh);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") refresh();
  });

  document.addEventListener("DOMContentLoaded", function () {
    refresh();
    globalThis.setInterval(refresh, pollMs);
  });
})();
