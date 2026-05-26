// Trends tab — time-series analysis with split Views/Engagement charts + hourly resolution
(function () {
  "use strict";

  var container = document.getElementById("tab-trends");
  if (!container) return;

  var areaByName = StatsUtils.buildAreaByName();

  // Inject HTML skeleton
  container.innerHTML =
    '<div class="section" id="trn-viewsSection">' +
      '<h2>Views Over Time</h2>' +
      '<p class="section-hint">Cumulative views across all restaurants</p>' +
      '<div class="chart-container-wide"><canvas id="trn-viewsChart"></canvas></div>' +
    '</div>' +
    '<div class="section" id="trn-engagementSection">' +
      '<h2>Engagement Over Time</h2>' +
      '<p class="section-hint">Intents (directions, website, phone) + Shares</p>' +
      '<div class="chart-container-wide"><canvas id="trn-engagementChart"></canvas></div>' +
    '</div>' +
    '<div class="section" id="trn-dailySection">' +
      '<h2>Daily New Activity</h2>' +
      '<p class="section-hint">New actions each day, broken down by type</p>' +
      '<div class="chart-container-wide"><canvas id="trn-dailyChart"></canvas></div>' +
    '</div>' +
    '<div class="section" id="trn-moversSection">' +
      '<h2>Movers &amp; Shakers</h2>' +
      '<p class="section-hint">Biggest view gains in the latest day</p>' +
      '<div class="movers-grid" id="trn-moversGrid"></div>' +
    '</div>' +
    '<div class="section" id="trn-areaTrendsSection">' +
      '<h2>Area Trends</h2>' +
      '<p class="section-hint">Cumulative views by neighborhood over time</p>' +
      '<div class="chart-container-wide"><canvas id="trn-areaTrendsChart"></canvas></div>' +
    '</div>' +
    '<p class="footer-note" id="trn-footerNote">Loading data...</p>';

  // Extract totals from a snapshot detail object
  function extractTotals(detail) {
    var totals = { views: 0, intents: 0, shares: 0, directions: 0, website: 0, phone: 0, instagram: 0, deeplinks: 0 };
    Object.keys(detail).forEach(function (name) {
      var d = detail[name];
      if (!StatsUtils.isRestaurant(name, d)) return;
      totals.views += d.view || 0;
      totals.directions += (d["directions-apple"] || 0) + (d["directions-google"] || 0);
      totals.intents += (d["directions-apple"] || 0) + (d["directions-google"] || 0) + (d.website || 0) + (d.phone || 0);
      totals.website += d.website || 0;
      totals.phone += d.phone || 0;
      totals.instagram += d.instagram || 0;
      totals.shares += d.share || 0;
      totals.deeplinks += d.deeplink || 0;
    });
    return totals;
  }

  function extractRestaurantViews(detail) {
    var views = {};
    Object.keys(detail).forEach(function (name) {
      var d = detail[name];
      if (!StatsUtils.isRestaurant(name, d)) return;
      views[name] = d.view || 0;
    });
    return views;
  }

  // Try to fetch hourly data from the Worker for the Views chart
  var __trendsConcluded = (typeof getEventState === "function") &&
    (getEventState() === "post-event" || getEventState() === "off-season");

  function fetchHourlyData() {
    // Use snapshot for concluded events
    if (__trendsConcluded) {
      return fetch("../snapshots/hourly-events.json", { method: "GET" })
        .then(function (resp) { return resp.ok ? resp.json() : null; })
        .catch(function () { return null; });
    }
    if (!THEME.trackUrl) return Promise.resolve(null);
    var dateParams = "";
    if (THEME.eventStartDate && THEME.eventEndDate) {
      dateParams = "&start=" + encodeURIComponent(THEME.eventStartDate) + "&end=" + encodeURIComponent(THEME.eventEndDate);
    }
    return fetch(THEME.trackUrl + "?hourly=true" + dateParams, { method: "GET" })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .catch(function () { return null; });
  }

  function formatHour(isoStr) {
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    var month = d.getMonth();
    var day = d.getDate();
    var hour = d.getHours();
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var ampm = hour >= 12 ? "pm" : "am";
    var h = hour % 12 || 12;
    return months[month] + " " + day + " " + h + ampm;
  }

  function render(snapshots, hourlyData) {
    if (snapshots.length === 0) {
      document.getElementById("trn-footerNote").textContent = "No snapshot data found.";
      return;
    }

    var dates = snapshots.map(function (s) { return s.date; });
    var labels = dates.map(StatsUtils.formatDate);
    var dailyTotals = snapshots.map(function (s) { return extractTotals(s.data.detail); });

    // Compute deltas
    var deltas = dailyTotals.map(function (t, i) {
      if (i === 0) return t;
      var prev = dailyTotals[i - 1];
      var d = {};
      Object.keys(t).forEach(function (k) { d[k] = Math.max(0, t[k] - prev[k]); });
      return d;
    });

    // Views + Engagement charts: prefer hourly from Worker, fall back to daily snapshots
    if (hourlyData && Object.keys(hourlyData).length > 0) {
      renderHourlyViewsChart(hourlyData);
      renderHourlyEngagementChart(hourlyData);
    } else {
      renderDailyViewsChart(labels, dailyTotals);
      renderDailyEngagementChart(labels, dailyTotals);
    }

    renderDailyChart(labels, deltas);
    renderMovers(snapshots);
    renderAreaTrends(labels, snapshots);
    document.getElementById("trn-footerNote").textContent =
      "Generated from " + snapshots.length + " daily snapshots" +
      (hourlyData ? " + hourly data" : "") + ". Updates automatically.";
  }

  function renderHourlyViewsChart(hourlyData) {
    hourlyData = StatsUtils.filterHourlyToEvent(hourlyData);
    var hours = Object.keys(hourlyData).sort();
    var labels = hours.map(formatHour);

    // Cumulative views
    var cumViews = [];
    var running = 0;
    hours.forEach(function (h) {
      running += hourlyData[h].view || 0;
      cumViews.push(running);
    });

    var ctx = document.getElementById("trn-viewsChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Views",
          data: cumViews,
          borderColor: "#e63946",
          backgroundColor: "rgba(230,57,70,0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 11 } } },
        },
        scales: {
          x: { ticks: { maxTicksLimit: 12, font: { size: 10 } } },
          y: { beginAtZero: true },
        },
      },
    });
  }

  function renderHourlyEngagementChart(hourlyData) {
    hourlyData = StatsUtils.filterHourlyToEvent(hourlyData);
    var hours = Object.keys(hourlyData).sort();
    var labels = hours.map(formatHour);

    var cumIntents = [];
    var cumShares = [];
    var runI = 0, runS = 0;
    hours.forEach(function (h) {
      var d = hourlyData[h];
      runI += (d["directions-apple"] || 0) + (d["directions-google"] || 0) + (d.website || 0) + (d.phone || 0);
      runS += d.share || 0;
      cumIntents.push(runI);
      cumShares.push(runS);
    });

    var ctx = document.getElementById("trn-engagementChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Intents",
            data: cumIntents,
            borderColor: "#2d6a4f",
            backgroundColor: "rgba(45,106,79,0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: "Shares",
            data: cumShares,
            borderColor: "#f4a261",
            backgroundColor: "rgba(244,162,97,0.1)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 11 } } },
        },
        scales: {
          x: { ticks: { maxTicksLimit: 12, font: { size: 10 } } },
          y: { beginAtZero: true },
        },
      },
    });
  }

  function renderDailyViewsChart(labels, totals) {
    var ctx = document.getElementById("trn-viewsChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Views",
          data: totals.map(function (t) { return t.views; }),
          borderColor: "#e63946",
          backgroundColor: "rgba(230,57,70,0.1)",
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 11 } } },
        },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  function renderDailyEngagementChart(labels, totals) {
    var ctx = document.getElementById("trn-engagementChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Intents",
            data: totals.map(function (t) { return t.intents; }),
            borderColor: "#2d6a4f",
            backgroundColor: "rgba(45,106,79,0.1)",
            fill: true,
            tension: 0.3,
          },
          {
            label: "Shares",
            data: totals.map(function (t) { return t.shares; }),
            borderColor: "#f4a261",
            backgroundColor: "rgba(244,162,97,0.1)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 11 } } },
        },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  function renderDailyChart(labels, deltas) {
    var ctx = document.getElementById("trn-dailyChart").getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          { label: "Views", data: deltas.map(function (d) { return d.views; }), backgroundColor: "#e63946" },
          { label: "Directions", data: deltas.map(function (d) { return d.directions; }), backgroundColor: "#e76f51" },
          { label: "Website", data: deltas.map(function (d) { return d.website; }), backgroundColor: "#2d6a4f" },
          { label: "Phone", data: deltas.map(function (d) { return d.phone; }), backgroundColor: "#1d3557" },
          { label: "Shares", data: deltas.map(function (d) { return d.shares; }), backgroundColor: "#f4a261" },
          { label: "Deep Links", data: deltas.map(function (d) { return d.deeplinks; }), backgroundColor: "#264653" },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 11 } } },
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true },
        },
      },
    });
  }

  function renderMovers(snapshots) {
    var grid = document.getElementById("trn-moversGrid");
    if (snapshots.length < 2) {
      grid.innerHTML = '<p style="color:#999;font-size:0.85rem;">Need at least 2 snapshots to show trends.</p>';
      return;
    }

    var latest = snapshots[snapshots.length - 1];
    var prev = snapshots[snapshots.length - 2];
    var latestViews = extractRestaurantViews(latest.data.detail);
    var prevViews = extractRestaurantViews(prev.data.detail);

    var movers = [];
    Object.keys(latestViews).forEach(function (name) {
      var curr = latestViews[name];
      var old = prevViews[name] || 0;
      var delta = curr - old;
      var pct = old > 0 ? (delta / old * 100) : (delta > 0 ? 100 : 0);
      movers.push({ name: name, delta: delta, pct: pct, total: curr });
    });

    movers.sort(function (a, b) { return b.delta - a.delta; });
    var top = movers.slice(0, 5);

    grid.innerHTML = "";
    top.forEach(function (m) {
      var card = document.createElement("div");
      card.className = "mover-card";
      card.innerHTML =
        '<div class="mover-name"><a href="' + THEME.siteUrl + '/#' + StatsUtils.slugify(m.name) + '" target="_blank" rel="noopener">' + StatsUtils.escapeHtml(m.name) + '</a></div>' +
        '<div class="mover-delta">+' + m.delta.toLocaleString() + '</div>' +
        '<div class="mover-detail">' + m.total.toLocaleString() + ' total views (+' + m.pct.toFixed(0) + '%)</div>';
      grid.appendChild(card);
    });
  }

  function renderAreaTrends(labels, snapshots) {
    var allAreas = {};
    snapshots.forEach(function (s) {
      Object.keys(s.data.detail).forEach(function (name) {
        var d = s.data.detail[name];
        if (!StatsUtils.isRestaurant(name, d)) return;
        var area = areaByName[name] || "Other SB";
        if (!allAreas[area]) allAreas[area] = [];
      });
    });

    var areaNames = Object.keys(allAreas).sort();

    areaNames.forEach(function (area) {
      allAreas[area] = snapshots.map(function (s) {
        var total = 0;
        Object.keys(s.data.detail).forEach(function (name) {
          var d = s.data.detail[name];
          if (!StatsUtils.isRestaurant(name, d)) return;
          if ((areaByName[name] || "Other SB") === area) {
            total += d.view || 0;
          }
        });
        return total;
      });
    });

    var datasets = areaNames.map(function (area) {
      var color = (typeof AREA_COLORS !== "undefined" && AREA_COLORS[area]) || "#999";
      return {
        label: area,
        data: allAreas[area],
        borderColor: color,
        backgroundColor: "transparent",
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 3,
      };
    });

    var ctx = document.getElementById("trn-areaTrendsChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 11 } } },
        },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  // Fetch snapshots + hourly data in parallel
  Promise.all([
    StatsUtils.fetchAllSnapshots("../snapshots/"),
    fetchHourlyData(),
  ]).then(function (results) {
    render(results[0], results[1]);
  });
})();
