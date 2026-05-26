// Tab switching, URL hash sync, lazy CSS/JS loading
(function () {
  "use strict";

  var tabs = document.querySelectorAll(".tab-btn");
  var panels = document.querySelectorAll(".tab-panel");
  var loaded = { activity: true }; // Activity tab always loaded

  // Hide Post-Event tab in off-season
  if (typeof getEventState === "function" && getEventState() === "off-season") {
    var peBtn = document.querySelector('.tab-btn[data-tab="post-event"]');
    if (peBtn) peBtn.style.display = "none";
  }

  // Lazy-load CSS and JS for a tab
  function loadTab(name) {
    if (loaded[name]) return Promise.resolve();
    loaded[name] = true;

    var cssMap = {
      insights: "insights/insights.css",
      trends: "trends/trends.css",
      restaurants: "restaurant/restaurant.css",
      "post-event": "post-event/post-event.css",
    };
    var jsMap = {
      insights: "insights/insights-tab.js",
      trends: "trends/trends-tab.js",
      restaurants: "restaurant/restaurant-tab.js",
      "post-event": "post-event/post-event-tab.js",
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
    var validTabs = { activity: 1, insights: 1, trends: 1, restaurants: 1, "post-event": 1 };
    // Redirect post-event to activity in off-season
    if (tabName === "post-event" && typeof getEventState === "function" && getEventState() === "off-season") {
      tabName = "activity";
      window.location.hash = "";
    }
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
