// Restaurant Detail Page — per-restaurant stats, trends, insights
(function () {
  "use strict";

  if (typeof window.track === "function") window.track("restaurant-stats-view", "stats");

  var pageTitle = document.getElementById("pageTitle");
  if (pageTitle) pageTitle.textContent = THEME.eventName;

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Build lookups
  var areaByName = {};
  var restaurantList = [];
  if (typeof restaurants !== "undefined") {
    restaurants.forEach(function (r) {
      areaByName[r.name] = r.area;
      if (restaurantList.indexOf(r.name) === -1) {
        restaurantList.push(r.name);
      }
    });
  }
  restaurantList.sort();

  function isRestaurant(name, d) {
    return !!(d.view || d["directions-apple"] || d["directions-google"] || d.website || d.phone);
  }

  // Fetch all snapshots
  function fetchAllSnapshots() {
    var today = new Date();
    var dates = [];
    for (var d = new Date(THEME.eventStartDate); d <= today; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    var fetches = dates.map(function (ds) {
      return fetch("../../snapshots/tracking-" + ds + ".json")
        .then(function (r) { return r.ok ? r.json().then(function (j) { return { date: ds, data: j }; }) : null; })
        .catch(function () { return null; });
    });
    return Promise.all(fetches).then(function (results) {
      return results.filter(function (r) { return r && r.data && r.data.detail; })
        .sort(function (a, b) { return a.date.localeCompare(b.date); });
    });
  }

  function formatDate(ds) {
    var parts = ds.split("-");
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[parseInt(parts[1], 10) - 1] + " " + parseInt(parts[2], 10);
  }

  // Populate dropdown
  var picker = document.getElementById("restaurantPicker");
  restaurantList.forEach(function (name) {
    var opt = document.createElement("option");
    opt.value = slugify(name);
    opt.textContent = name;
    picker.appendChild(opt);
  });

  // Slug → name lookup
  var nameBySlug = {};
  restaurantList.forEach(function (name) {
    nameBySlug[slugify(name)] = name;
  });

  // State
  var allSnapshots = null;
  var actionChartInstance = null;
  var trendChartInstance = null;
  var dailyChartInstance = null;

  function showRestaurant(slug) {
    if (!slug || !nameBySlug[slug] || !allSnapshots) return;

    var name = nameBySlug[slug];
    var latest = allSnapshots[allSnapshots.length - 1];
    var detail = latest.data.detail[name];

    if (!detail) {
      document.getElementById("detailContent").style.display = "none";
      document.getElementById("emptyState").style.display = "";
      document.getElementById("emptyState").querySelector("p").textContent =
        "No tracking data found for " + name + ".";
      return;
    }

    document.getElementById("detailContent").style.display = "";
    document.getElementById("emptyState").style.display = "none";

    // Update page title
    document.title = name + " — " + THEME.eventName + " Stats";

    // Header
    document.getElementById("restaurantName").textContent = name;
    var area = areaByName[name] || "Other SB";
    var areaColor = (typeof AREA_COLORS !== "undefined" && AREA_COLORS[area]) || "#666";
    document.getElementById("restaurantArea").innerHTML =
      '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + areaColor + ';margin-right:4px;vertical-align:middle;"></span>' + escapeHtml(area);

    // Rank
    var allRestaurantViews = [];
    Object.keys(latest.data.detail).forEach(function (n) {
      var d = latest.data.detail[n];
      if (isRestaurant(n, d)) {
        allRestaurantViews.push({ name: n, views: d.view || 0 });
      }
    });
    allRestaurantViews.sort(function (a, b) { return b.views - a.views; });
    var rank = -1;
    for (var i = 0; i < allRestaurantViews.length; i++) {
      if (allRestaurantViews[i].name === name) { rank = i + 1; break; }
    }
    document.getElementById("restaurantRank").textContent =
      rank > 0 ? " — #" + rank + " of " + allRestaurantViews.length + " by views" : "";

    // Map link
    document.getElementById("mapLink").href = THEME.siteUrl + "/#" + slug;

    // Summary cards
    var views = detail.view || 0;
    var dirApple = detail["directions-apple"] || 0;
    var dirGoogle = detail["directions-google"] || 0;
    var website = detail.website || 0;
    var phone = detail.phone || 0;
    var instagram = detail.instagram || 0;
    var shares = detail.share || 0;
    var deeplinks = detail.deeplink || 0;
    var likes = Math.max((detail.upvote || 0) - (detail["un-upvote"] || 0), 0);

    var cards = [
      { label: "Views", value: views },
      { label: "Apple Maps", value: dirApple },
      { label: "Google Maps", value: dirGoogle },
      { label: "Website", value: website },
      { label: "Phone", value: phone },
      { label: "Instagram", value: instagram },
      { label: "Shares", value: shares },
      { label: "Direct Links", value: deeplinks },
      { label: "Likes", value: likes },
    ];

    var cardsEl = document.getElementById("summaryCards");
    cardsEl.innerHTML = "";
    cards.forEach(function (c) {
      var div = document.createElement("div");
      div.className = "card";
      div.innerHTML =
        '<div class="card-value">' + c.value.toLocaleString() + '</div>' +
        '<div class="card-label">' + c.label + '</div>';
      cardsEl.appendChild(div);
    });

    // Funnel
    var intents = dirApple + dirGoogle + website + phone;
    var funnelEl = document.getElementById("funnelVisual");
    funnelEl.innerHTML = "";

    var funnelSteps = [
      { label: "Views", value: views, color: "#e63946" },
      { label: "Intents", value: intents, color: "#e76f51" },
      { label: "Shares", value: shares, color: "#2d6a4f" },
    ];
    var maxFunnel = Math.max(views, 1);

    funnelSteps.forEach(function (step) {
      var pct = (step.value / maxFunnel * 100);
      var row = document.createElement("div");
      row.className = "funnel-row";
      row.innerHTML =
        '<span class="funnel-label">' + step.label + '</span>' +
        '<span class="funnel-bar-wrap"><span class="funnel-bar" style="width:' + Math.max(pct, 3).toFixed(1) + '%;background:' + step.color + '">' + step.value.toLocaleString() + '</span></span>' +
        '<span class="funnel-pct">' + (views > 0 ? (step.value / views * 100).toFixed(1) + '%' : '—') + '</span>';
      funnelEl.appendChild(row);
    });

    // Action breakdown donut
    if (actionChartInstance) actionChartInstance.destroy();
    var actionLabels = ["Directions", "Website", "Phone", "Instagram", "Shares", "Deep Links"];
    var actionValues = [dirApple + dirGoogle, website, phone, instagram, shares, deeplinks];
    var actionColors = ["#e76f51", "#2d6a4f", "#1d3557", "#7b2cbf", "#f4a261", "#264653"];

    var ctx1 = document.getElementById("actionChart").getContext("2d");
    actionChartInstance = new Chart(ctx1, {
      type: "doughnut",
      data: {
        labels: actionLabels,
        datasets: [{ data: actionValues, backgroundColor: actionColors, borderWidth: 2, borderColor: "#fff" }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 11 }, padding: 10 } },
        },
        cutout: "55%",
      },
    });

    // View trend line
    if (trendChartInstance) trendChartInstance.destroy();
    var trendLabels = allSnapshots.map(function (s) { return formatDate(s.date); });
    var trendData = allSnapshots.map(function (s) {
      var d = s.data.detail[name];
      return d ? (d.view || 0) : 0;
    });

    var ctx2 = document.getElementById("trendChart").getContext("2d");
    trendChartInstance = new Chart(ctx2, {
      type: "line",
      data: {
        labels: trendLabels,
        datasets: [{
          label: "Views",
          data: trendData,
          borderColor: areaColor,
          backgroundColor: areaColor + "22",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });

    // Daily new views bar
    if (dailyChartInstance) dailyChartInstance.destroy();
    var dailyData = trendData.map(function (v, i) {
      return i === 0 ? v : Math.max(0, v - trendData[i - 1]);
    });

    var ctx3 = document.getElementById("dailyChart").getContext("2d");
    dailyChartInstance = new Chart(ctx3, {
      type: "bar",
      data: {
        labels: trendLabels,
        datasets: [{
          label: "New Views",
          data: dailyData,
          backgroundColor: areaColor,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });

    // Comparison to average
    var avgData = { views: 0, intents: 0, website: 0, phone: 0, directions: 0, shares: 0, instagram: 0, deeplinks: 0 };
    var count = 0;
    Object.keys(latest.data.detail).forEach(function (n) {
      var d = latest.data.detail[n];
      if (!isRestaurant(n, d)) return;
      count++;
      avgData.views += d.view || 0;
      avgData.directions += (d["directions-apple"] || 0) + (d["directions-google"] || 0);
      avgData.intents += (d["directions-apple"] || 0) + (d["directions-google"] || 0) + (d.website || 0) + (d.phone || 0);
      avgData.website += d.website || 0;
      avgData.phone += d.phone || 0;
      avgData.instagram += d.instagram || 0;
      avgData.shares += d.share || 0;
      avgData.deeplinks += d.deeplink || 0;
    });
    if (count > 0) {
      Object.keys(avgData).forEach(function (k) { avgData[k] = avgData[k] / count; });
    }

    var convRate = views > 0 ? (intents / views * 100) : 0;
    var avgConvRate = avgData.views > 0 ? (avgData.intents / avgData.views * 100) : 0;

    var compItems = [
      { label: "Views", thisVal: views, avgVal: avgData.views },
      { label: "Intents", thisVal: intents, avgVal: avgData.intents },
      { label: "Conversion Rate", thisVal: convRate, avgVal: avgConvRate, isPct: true },
      { label: "Directions", thisVal: dirApple + dirGoogle, avgVal: avgData.directions },
      { label: "Website", thisVal: website, avgVal: avgData.website },
      { label: "Shares", thisVal: shares, avgVal: avgData.shares },
    ];

    var compGrid = document.getElementById("comparisonGrid");
    compGrid.innerHTML = "";
    compItems.forEach(function (c) {
      var isAbove = c.thisVal >= c.avgVal;
      var badge = isAbove
        ? '<span class="comp-badge comp-above">above avg</span>'
        : '<span class="comp-badge comp-below">below avg</span>';
      var thisStr = c.isPct ? c.thisVal.toFixed(1) + "%" : Math.round(c.thisVal).toLocaleString();
      var avgStr = c.isPct ? c.avgVal.toFixed(1) + "%" : Math.round(c.avgVal).toLocaleString();

      var card = document.createElement("div");
      card.className = "comp-card";
      card.innerHTML =
        '<div class="comp-label">' + c.label + '</div>' +
        '<div class="comp-values">' +
        '<span class="comp-this">' + thisStr + ' ' + badge + '</span>' +
        '</div>' +
        '<div class="comp-values" style="margin-top:4px;">' +
        '<span class="comp-avg">avg: ' + avgStr + '</span>' +
        '</div>';
      compGrid.appendChild(card);
    });

    // Track
    if (typeof window.track === "function") window.track("restaurant-detail", name);
  }

  // Wire up picker
  picker.addEventListener("change", function () {
    var slug = picker.value;
    if (slug) {
      window.location.hash = slug;
    }
  });

  // Handle hash changes
  function onHashChange() {
    var slug = window.location.hash.replace(/^#/, "");
    if (slug && nameBySlug[slug]) {
      picker.value = slug;
      showRestaurant(slug);
    } else if (slug) {
      // Try to find a partial match
      var found = Object.keys(nameBySlug).find(function (s) { return s === slug; });
      if (found) {
        picker.value = found;
        showRestaurant(found);
      }
    }
  }

  window.addEventListener("hashchange", onHashChange);

  // Load data and init
  fetchAllSnapshots().then(function (snapshots) {
    allSnapshots = snapshots;
    if (snapshots.length === 0) {
      document.getElementById("footerNote").textContent = "No snapshot data found.";
      return;
    }
    document.getElementById("footerNote").textContent =
      "Data from " + snapshots.length + " snapshots. Latest: " + formatDate(snapshots[snapshots.length - 1].date) + ".";

    // Check for hash on load
    onHashChange();
  });
})();
