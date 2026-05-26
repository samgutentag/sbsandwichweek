// Restaurant tab — per-restaurant stats, trends, insights
(function () {
  "use strict";

  var container = document.getElementById("tab-restaurants");
  if (!container) return;

  var areaByName = StatsUtils.buildAreaByName();
  var restaurantList = [];
  if (typeof restaurants !== "undefined") {
    restaurants.forEach(function (r) {
      if (restaurantList.indexOf(r.name) === -1) {
        restaurantList.push(r.name);
      }
    });
  }
  restaurantList.sort();

  // Slug lookup
  var nameBySlug = {};
  restaurantList.forEach(function (name) {
    nameBySlug[StatsUtils.slugify(name)] = name;
  });

  // Inject HTML skeleton
  var pickerOptions = '<option value="">Select a restaurant...</option>';
  restaurantList.forEach(function (name) {
    pickerOptions += '<option value="' + StatsUtils.slugify(name) + '">' + StatsUtils.escapeHtml(name) + '</option>';
  });

  container.innerHTML =
    '<div class="picker-section">' +
      '<select id="rst-restaurantPicker">' + pickerOptions + '</select>' +
    '</div>' +
    '<div id="rst-detailContent" style="display:none;">' +
      '<div class="section restaurant-header-section">' +
        '<h2 id="rst-restaurantName"></h2>' +
        '<p class="section-hint">' +
          '<span id="rst-restaurantArea"></span>' +
          '<span id="rst-restaurantRank"></span>' +
        '</p>' +
        '<a id="rst-mapLink" class="map-link" href="#" target="_blank" rel="noopener">View on Map</a>' +
      '</div>' +
      '<div class="section">' +
        '<h2>Activity Summary</h2>' +
        '<p class="section-hint">All-time counts since event start</p>' +
        '<div class="summary-cards" id="rst-summaryCards"></div>' +
      '</div>' +
      '<div class="section">' +
        '<h2>Conversion Funnel</h2>' +
        '<p class="section-hint">How many viewers took action</p>' +
        '<div class="funnel-visual" id="rst-funnelVisual"></div>' +
      '</div>' +
      '<div class="section">' +
        '<h2>Action Breakdown</h2>' +
        '<p class="section-hint">What people do after viewing</p>' +
        '<div class="chart-container"><canvas id="rst-actionChart"></canvas></div>' +
      '</div>' +
      '<div class="section">' +
        '<h2>View Trend</h2>' +
        '<p class="section-hint">Cumulative views across snapshots</p>' +
        '<div class="chart-container-wide"><canvas id="rst-trendChart"></canvas></div>' +
      '</div>' +
      '<div class="section">' +
        '<h2>Daily New Views</h2>' +
        '<p class="section-hint">New views gained each day</p>' +
        '<div class="chart-container-wide"><canvas id="rst-dailyChart"></canvas></div>' +
      '</div>' +
      '<div class="section">' +
        '<h2>Compared to Average</h2>' +
        '<p class="section-hint">This restaurant vs. all-restaurant average</p>' +
        '<div class="comparison-grid" id="rst-comparisonGrid"></div>' +
      '</div>' +
    '</div>' +
    '<div id="rst-emptyState" class="empty-state">' +
      '<p>Select a restaurant above to view detailed stats, trends, and insights.</p>' +
    '</div>' +
    '<p class="footer-note" id="rst-footerNote">Loading data...</p>';

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
      document.getElementById("rst-detailContent").style.display = "none";
      document.getElementById("rst-emptyState").style.display = "";
      document.getElementById("rst-emptyState").querySelector("p").textContent =
        "No tracking data found for " + name + ".";
      return;
    }

    document.getElementById("rst-detailContent").style.display = "";
    document.getElementById("rst-emptyState").style.display = "none";

    // Header
    document.getElementById("rst-restaurantName").textContent = name;
    var area = areaByName[name] || "Other SB";
    var areaColor = (typeof AREA_COLORS !== "undefined" && AREA_COLORS[area]) || "#666";
    document.getElementById("rst-restaurantArea").innerHTML =
      '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + areaColor + ';margin-right:4px;vertical-align:middle;"></span>' + StatsUtils.escapeHtml(area);

    // Rank
    var allRestaurantViews = [];
    Object.keys(latest.data.detail).forEach(function (n) {
      var d = latest.data.detail[n];
      if (StatsUtils.isRestaurant(n, d)) {
        allRestaurantViews.push({ name: n, views: d.view || 0 });
      }
    });
    allRestaurantViews.sort(function (a, b) { return b.views - a.views; });
    var rank = -1;
    for (var i = 0; i < allRestaurantViews.length; i++) {
      if (allRestaurantViews[i].name === name) { rank = i + 1; break; }
    }
    document.getElementById("rst-restaurantRank").textContent =
      rank > 0 ? " — #" + rank + " of " + allRestaurantViews.length + " by views" : "";

    // Map link
    document.getElementById("rst-mapLink").href = THEME.siteUrl + "/#" + slug;

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

    var cardsEl = document.getElementById("rst-summaryCards");
    cardsEl.innerHTML = "";
    cards.forEach(function (c) {
      var div = document.createElement("div");
      div.className = "card";
      div.innerHTML =
        '<div class="card-value">' + c.value.toLocaleString() + '</div>' +
        '<div class="card-label">' + c.label + '</div>';
      cardsEl.appendChild(div);
    });

    // Compute all-restaurant averages for funnel markers
    var avgIntentRate = 0;
    var avgShareRate = 0;
    var rCount = 0;
    var totalAvgViews = 0, totalAvgIntents = 0, totalAvgShares = 0;
    Object.keys(latest.data.detail).forEach(function (n) {
      var d = latest.data.detail[n];
      if (!StatsUtils.isRestaurant(n, d)) return;
      rCount++;
      var rv = d.view || 0;
      var ri = (d["directions-apple"] || 0) + (d["directions-google"] || 0) + (d.website || 0) + (d.phone || 0);
      var rs = d.share || 0;
      totalAvgViews += rv;
      totalAvgIntents += ri;
      totalAvgShares += rs;
    });
    if (totalAvgViews > 0) {
      avgIntentRate = totalAvgIntents / totalAvgViews * 100;
      avgShareRate = totalAvgShares / totalAvgViews * 100;
    }

    // Funnel
    var intents = dirApple + dirGoogle + website + phone;
    var funnelEl = document.getElementById("rst-funnelVisual");
    funnelEl.innerHTML = "";

    var funnelSteps = [
      { label: "Intents", value: intents, color: "#e76f51", avgRate: avgIntentRate },
      { label: "Shares", value: shares, color: "#2d6a4f", avgRate: avgShareRate },
    ];
    var maxFunnel = Math.max(views, 1);

    funnelSteps.forEach(function (step) {
      var pct = (step.value / maxFunnel * 100);
      var avgPct = step.avgRate;
      var row = document.createElement("div");
      row.className = "funnel-row";
      row.innerHTML =
        '<span class="funnel-label">' + step.label + '</span>' +
        '<span class="funnel-bar-wrap">' +
          '<span class="funnel-bar" style="width:' + Math.max(pct, 3).toFixed(1) + '%;background:' + step.color + '">' + step.value.toLocaleString() + '</span>' +
          '<span class="funnel-avg-marker" style="left:' + avgPct.toFixed(1) + '%" title="Avg: ' + avgPct.toFixed(1) + '%"></span>' +
        '</span>' +
        '<span class="funnel-pct">' + (views > 0 ? (step.value / views * 100).toFixed(1) + '%' : '—') + '</span>';
      funnelEl.appendChild(row);
    });

    // Action breakdown donut
    if (actionChartInstance) actionChartInstance.destroy();
    var actionLabels = ["Directions", "Website", "Phone", "Instagram", "Shares", "Deep Links"];
    var actionValues = [dirApple + dirGoogle, website, phone, instagram, shares, deeplinks];
    var actionColors = ["#e76f51", "#2d6a4f", "#1d3557", "#7b2cbf", "#f4a261", "#264653"];

    var ctx1 = document.getElementById("rst-actionChart").getContext("2d");
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
    var trendLabels = allSnapshots.map(function (s) { return StatsUtils.formatDate(s.date); });
    var trendData = allSnapshots.map(function (s) {
      var d = s.data.detail[name];
      return d ? (d.view || 0) : 0;
    });

    var ctx2 = document.getElementById("rst-trendChart").getContext("2d");
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
    var dailyData = trendData.map(function (v, idx) {
      return idx === 0 ? v : Math.max(0, v - trendData[idx - 1]);
    });

    var ctx3 = document.getElementById("rst-dailyChart").getContext("2d");
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
      if (!StatsUtils.isRestaurant(n, d)) return;
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

    var compGrid = document.getElementById("rst-comparisonGrid");
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
  var picker = document.getElementById("rst-restaurantPicker");
  picker.addEventListener("change", function () {
    var slug = picker.value;
    if (slug) {
      window.location.hash = "restaurants/" + slug;
    }
  });

  // Handle hash for restaurant selection
  function checkHash() {
    var hash = window.location.hash.replace(/^#/, "");
    var parts = hash.split("/");
    if (parts[0] === "restaurants" && parts[1]) {
      var slug = parts[1];
      if (nameBySlug[slug]) {
        picker.value = slug;
        showRestaurant(slug);
      }
    }
  }

  window.addEventListener("hashchange", checkHash);

  // Load data and init
  StatsUtils.fetchAllSnapshots("../snapshots/").then(function (snapshots) {
    allSnapshots = snapshots;
    if (snapshots.length === 0) {
      document.getElementById("rst-footerNote").textContent = "No snapshot data found.";
      return;
    }
    document.getElementById("rst-footerNote").textContent =
      "Data from " + snapshots.length + " snapshots. Latest: " + StatsUtils.formatDate(snapshots[snapshots.length - 1].date) + ".";

    // Check for hash on load
    checkHash();
  });
})();
