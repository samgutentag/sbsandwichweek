// Tab switching, URL hash sync, lazy CSS/JS loading
(function () {
  "use strict";

  var tabs = document.querySelectorAll(".tab-btn");
  var panels = document.querySelectorAll(".tab-panel");
  var loaded = { activity: true }; // Activity tab always loaded

  // Date-range filter row. Presets drive the ?range= param; changing it reloads
  // so all five lazy-loaded tabs re-window consistently — no per-tab re-render.
  (function () {
    var row = document.getElementById("dateFilterRow");
    if (!row) return;
    var active =
      window.StatsUtils && StatsUtils.getActiveRange
        ? StatsUtils.getActiveRange().preset
        : "all";
    row.querySelectorAll(".date-filter-btn").forEach(function (btn) {
      if (btn.getAttribute("data-range") === active) btn.classList.add("active");
      btn.addEventListener("click", function () {
        var r = btn.getAttribute("data-range");
        if (r === active) return;
        var params = new URLSearchParams(window.location.search);
        if (r === "all") params.delete("range");
        else params.set("range", r);
        var qs = params.toString();
        // Preserve the active tab (hash) across the reload.
        window.location.href =
          window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
      });
    });
  })();

  // Lazy-load CSS and JS for a tab
  function loadTab(name) {
    if (loaded[name]) return Promise.resolve();
    loaded[name] = true;

    var cssMap = {
      insights: "insights/insights.css",
      trends: "trends/trends.css",
      restaurants: "restaurant/restaurant.css",
    };
    var jsMap = {
      insights: "insights/insights-tab.js",
      trends: "trends/trends-tab.js",
      restaurants: "restaurant/restaurant-tab.js",
    };

    // Load CSS
    if (cssMap[name]) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssMap[name];
      document.head.appendChild(link);
    }

    // Load JS
    if (jsMap[name]) {
      return new Promise(function (resolve) {
        var script = document.createElement("script");
        script.src = jsMap[name];
        script.onload = resolve;
        script.onerror = resolve; // Don't block on errors
        document.body.appendChild(script);
      });
    }

    return Promise.resolve();
  }

  function switchTab(name) {
    tabs.forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tab") === name);
    });
    panels.forEach(function (panel) {
      panel.classList.toggle("active", panel.id === "tab-" + name);
    });

    loadTab(name);

    // Track tab view
    if (typeof window.track === "function" && name !== "activity") {
      window.track(name + "-view", "stats");
    }
  }

  // Click handlers
  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.getAttribute("data-tab");
      window.location.hash = name === "activity" ? "" : name;
      switchTab(name);
    });
  });

  // Hash-based routing
  function onHash() {
    var hash = window.location.hash.replace(/^#/, "");
    if (!hash) {
      switchTab("activity");
      return;
    }

    // Handle #restaurants/slug pattern
    var parts = hash.split("/");
    var tabName = parts[0];

    // Map valid tab names
    var validTabs = { activity: 1, insights: 1, trends: 1, restaurants: 1 };
    if (validTabs[tabName]) {
      switchTab(tabName);
    } else {
      switchTab("activity");
    }
  }

  window.addEventListener("hashchange", onHash);

  // On load, check hash
  onHash();
})();
