// Trends Page — time-series analysis from daily snapshots
(function () {
  "use strict";

  if (typeof window.track === "function") window.track("trends-view", "stats");

  var pageTitle = document.getElementById("pageTitle");
  if (pageTitle) pageTitle.textContent = THEME.eventName;

  // Area lookup
  var areaByName = {};
  if (typeof restaurants !== "undefined") {
    restaurants.forEach(function (r) {
      areaByName[r.name] = r.area;
    });
  }

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function isRestaurant(name, d) {
    return !!(d.view || d["directions-apple"] || d["directions-google"] || d.website || d.phone);
  }

  // Fetch all available snapshots
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
      return results.filter(function (r) { return r && r.data && r.data.detail; });
    });
  }

  // Extract restaurant totals from a snapshot
  function extractTotals(detail) {
    var totals = { views: 0, intents: 0, shares: 0, directions: 0, website: 0, phone: 0, instagram: 0, deeplinks: 0 };
    Object.keys(detail).forEach(function (name) {
      var d = detail[name];
      if (!isRestaurant(name, d)) return;
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

  // Get per-restaurant views from a snapshot
  function extractRestaurantViews(detail) {
    var views = {};
    Object.keys(detail).forEach(function (name) {
      var d = detail[name];
      if (!isRestaurant(name, d)) return;
      views[name] = d.view || 0;
    });
    return views;
  }

  function formatDate(ds) {
    var parts = ds.split("-");
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[parseInt(parts[1], 10) - 1] + " " + parseInt(parts[2], 10);
  }

  function render(snapshots) {
    if (snapshots.length === 0) {
      document.getElementById("footerNote").textContent = "No snapshot data found.";
      return;
    }

    // Sort by date
    snapshots.sort(function (a, b) { return a.date.localeCompare(b.date); });

    var dates = snapshots.map(function (s) { return s.date; });
    var labels = dates.map(formatDate);

    // Cumulative totals per day
    var dailyTotals = snapshots.map(function (s) { return extractTotals(s.data.detail); });

    // Compute deltas (daily new)
    var deltas = dailyTotals.map(function (t, i) {
      if (i === 0) return t;
      var prev = dailyTotals[i - 1];
      var d = {};
      Object.keys(t).forEach(function (k) { d[k] = Math.max(0, t[k] - prev[k]); });
      return d;
    });

    renderOverallChart(labels, dailyTotals);
    renderDailyChart(labels, deltas);
    renderMovers(snapshots);
    renderAreaTrends(labels, snapshots);
    renderSparklines(snapshots);

    document.getElementById("footerNote").textContent =
      "Generated from " + snapshots.length + " daily snapshots. Updates automatically.";
  }

  function renderOverallChart(labels, totals) {
    var ctx = document.getElementById("overallChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Views",
            data: totals.map(function (t) { return t.views; }),
            borderColor: "#e63946",
            backgroundColor: "rgba(230,57,70,0.1)",
            fill: true,
            tension: 0.3,
          },
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
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  function renderDailyChart(labels, deltas) {
    var ctx = document.getElementById("dailyChart").getContext("2d");
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
    if (snapshots.length < 2) {
      document.getElementById("moversGrid").innerHTML =
        '<p style="color:#999;font-size:0.85rem;">Need at least 2 snapshots to show trends.</p>';
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

    var container = document.getElementById("moversGrid");
    container.innerHTML = "";

    top.forEach(function (m) {
      var card = document.createElement("div");
      card.className = "mover-card";
      card.innerHTML =
        '<div class="mover-name"><a href="' + THEME.siteUrl + '/#' + slugify(m.name) + '" target="_blank" rel="noopener">' + escapeHtml(m.name) + '</a></div>' +
        '<div class="mover-delta">+' + m.delta.toLocaleString() + '</div>' +
        '<div class="mover-detail">' + m.total.toLocaleString() + ' total views (+' + m.pct.toFixed(0) + '%)</div>';
      container.appendChild(card);
    });
  }

  function renderAreaTrends(labels, snapshots) {
    // Build cumulative views per area per snapshot
    var allAreas = {};
    snapshots.forEach(function (s) {
      Object.keys(s.data.detail).forEach(function (name) {
        var d = s.data.detail[name];
        if (!isRestaurant(name, d)) return;
        var area = areaByName[name] || "Other SB";
        if (!allAreas[area]) allAreas[area] = [];
      });
    });

    var areaNames = Object.keys(allAreas).sort();

    // Fill data
    areaNames.forEach(function (area) {
      allAreas[area] = snapshots.map(function (s) {
        var total = 0;
        Object.keys(s.data.detail).forEach(function (name) {
          var d = s.data.detail[name];
          if (!isRestaurant(name, d)) return;
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

    var ctx = document.getElementById("areaTrendsChart").getContext("2d");
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
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  function renderSparklines(snapshots) {
    // Collect all restaurant names and their view series
    var allNames = {};
    snapshots.forEach(function (s) {
      Object.keys(s.data.detail).forEach(function (name) {
        var d = s.data.detail[name];
        if (!isRestaurant(name, d)) return;
        if (!allNames[name]) allNames[name] = [];
      });
    });

    Object.keys(allNames).forEach(function (name) {
      allNames[name] = snapshots.map(function (s) {
        var d = s.data.detail[name];
        return d ? (d.view || 0) : 0;
      });
    });

    // Sort by latest total views desc
    var sorted = Object.keys(allNames).sort(function (a, b) {
      var aLast = allNames[a][allNames[a].length - 1] || 0;
      var bLast = allNames[b][allNames[b].length - 1] || 0;
      return bLast - aLast;
    });

    var container = document.getElementById("sparklinesList");
    container.innerHTML = "";

    // Find global max for consistent scaling
    var globalMax = 0;
    sorted.forEach(function (name) {
      allNames[name].forEach(function (v) {
        if (v > globalMax) globalMax = v;
      });
    });

    sorted.forEach(function (name, i) {
      var values = allNames[name];
      var totalViews = values[values.length - 1] || 0;

      var row = document.createElement("div");
      row.className = "spark-row";

      // Build SVG sparkline
      var svgWidth = 200;
      var svgHeight = 24;
      var padding = 2;
      var maxVal = globalMax || 1;
      var points = values.map(function (v, j) {
        var x = padding + (values.length > 1 ? j / (values.length - 1) : 0.5) * (svgWidth - 2 * padding);
        var y = svgHeight - padding - (v / maxVal) * (svgHeight - 2 * padding);
        return x.toFixed(1) + "," + y.toFixed(1);
      }).join(" ");

      var area = areaByName[name] || "Other SB";
      var color = (typeof AREA_COLORS !== "undefined" && AREA_COLORS[area]) || "#999";

      row.innerHTML =
        '<span class="spark-rank">' + (i + 1) + '</span>' +
        '<span class="spark-name"><a href="' + THEME.siteUrl + '/#' + slugify(name) + '" target="_blank" rel="noopener">' + escapeHtml(name) + '</a></span>' +
        '<svg class="spark-svg" viewBox="0 0 ' + svgWidth + ' ' + svgHeight + '" preserveAspectRatio="none">' +
        '<polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
        '<span class="spark-total">' + totalViews.toLocaleString() + '</span>';

      container.appendChild(row);
    });
  }

  // Go
  fetchAllSnapshots().then(render);
})();
