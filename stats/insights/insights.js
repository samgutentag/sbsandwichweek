// Insights Page — conversion funnels, area breakdown, distribution, platform split
(function () {
  "use strict";

  if (typeof window.track === "function") window.track("insights-view", "stats");

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

  // Build area lookup from restaurant data
  var areaByName = {};
  if (typeof restaurants !== "undefined") {
    restaurants.forEach(function (r) {
      areaByName[r.name] = r.area;
    });
  }

  // Fetch the latest snapshot
  function fetchLatestSnapshot() {
    var today = new Date();
    var dates = [];
    // Try Feb 19 through today
    for (var d = new Date(THEME.eventStartDate); d <= today; d.setDate(d.getDate() + 1)) {
      var ds = d.toISOString().slice(0, 10);
      dates.push(ds);
    }

    // Try all dates in parallel, use the latest successful one
    var fetches = dates.map(function (ds) {
      return fetch("../../snapshots/tracking-" + ds + ".json")
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    });

    return Promise.all(fetches).then(function (results) {
      var latest = null;
      for (var i = results.length - 1; i >= 0; i--) {
        if (results[i] && results[i].detail) {
          latest = results[i];
          break;
        }
      }
      return latest;
    });
  }

  function isRestaurant(name, d) {
    return !!(d.view || d["directions-apple"] || d["directions-google"] || d.website || d.phone);
  }

  function getIntents(d) {
    return (d["directions-apple"] || 0) + (d["directions-google"] || 0) + (d.website || 0) + (d.phone || 0);
  }

  function render(snapshot) {
    var detail = snapshot.detail;
    var rows = [];

    Object.keys(detail).forEach(function (name) {
      var d = detail[name];
      if (!isRestaurant(name, d)) return;
      var views = d.view || 0;
      var intents = getIntents(d);
      var rate = views > 0 ? (intents / views * 100) : 0;
      rows.push({
        name: name,
        views: views,
        intents: intents,
        rate: rate,
        area: areaByName[name] || "Other SB",
        apple: d["directions-apple"] || 0,
        google: d["directions-google"] || 0,
        website: d.website || 0,
        phone: d.phone || 0,
        instagram: d.instagram || 0,
        shares: d.share || 0,
        deeplinks: d.deeplink || 0,
      });
    });

    // Compute medians
    var viewsSorted = rows.map(function (r) { return r.views; }).sort(function (a, b) { return a - b; });
    var ratesSorted = rows.map(function (r) { return r.rate; }).sort(function (a, b) { return a - b; });
    var medianViews = viewsSorted[Math.floor(viewsSorted.length / 2)] || 0;
    var medianRate = ratesSorted[Math.floor(ratesSorted.length / 2)] || 0;

    // Tag restaurants
    rows.forEach(function (r) {
      if (r.views >= medianViews && r.rate >= medianRate) {
        r.tag = "hot";
        r.tagLabel = "Hot";
      } else if (r.views < medianViews && r.rate >= medianRate) {
        r.tag = "gem";
        r.tagLabel = "Hidden Gem";
      } else if (r.views >= medianViews && r.rate < medianRate) {
        r.tag = "popular";
        r.tagLabel = "Popular";
      } else {
        r.tag = "";
        r.tagLabel = "";
      }
    });

    // Sort by conversion rate desc
    rows.sort(function (a, b) { return b.rate - a.rate || b.views - a.views; });

    renderFunnel(rows);
    renderAreaBreakdown(rows);
    renderDistribution(rows);
    renderPlatformSplit(rows);
    renderActionBreakdown(rows);

    document.getElementById("footerNote").textContent =
      "Generated from snapshot data (" + (snapshot.timestamp || "").slice(0, 10) + "). Updated daily.";
  }

  function renderFunnel(rows) {
    var tbody = document.getElementById("funnelBody");
    tbody.innerHTML = "";
    rows.forEach(function (r, i) {
      var tr = document.createElement("tr");
      var tagHtml = r.tag
        ? '<span class="tag tag-' + r.tag + '">' + r.tagLabel + '</span>'
        : "";
      tr.innerHTML =
        '<td class="rank-cell">' + (i + 1) + "</td>" +
        '<td class="name-cell"><a href="' + THEME.siteUrl + '/#' + slugify(r.name) + '" target="_blank" rel="noopener">' + escapeHtml(r.name) + '</a></td>' +
        '<td class="col-num">' + r.views.toLocaleString() + "</td>" +
        '<td class="col-num">' + r.intents.toLocaleString() + "</td>" +
        '<td class="col-num">' + r.rate.toFixed(1) + "%</td>" +
        '<td class="col-tag">' + tagHtml + "</td>";
      tbody.appendChild(tr);
    });
  }

  function renderAreaBreakdown(rows) {
    var areas = {};
    rows.forEach(function (r) {
      if (!areas[r.area]) areas[r.area] = { views: 0, intents: 0, count: 0 };
      areas[r.area].views += r.views;
      areas[r.area].intents += r.intents;
      areas[r.area].count++;
    });

    var container = document.getElementById("areaCards");
    container.innerHTML = "";

    var areaNames = Object.keys(areas).sort(function (a, b) {
      return areas[b].views - areas[a].views;
    });

    areaNames.forEach(function (name) {
      var a = areas[name];
      var rate = a.views > 0 ? (a.intents / a.views * 100).toFixed(1) : "0.0";
      var color = (typeof AREA_COLORS !== "undefined" && AREA_COLORS[name]) || "#666";
      var card = document.createElement("div");
      card.className = "area-card";
      card.style.background = color;
      card.innerHTML =
        '<div class="area-card-name">' + escapeHtml(name) + '</div>' +
        '<div class="area-card-stat"><strong>' + a.views.toLocaleString() + '</strong> views</div>' +
        '<div class="area-card-stat"><strong>' + a.intents.toLocaleString() + '</strong> intents</div>' +
        '<div class="area-card-stat">' + a.count + ' restaurants</div>' +
        '<div class="area-card-rate">' + rate + '% conversion</div>';
      container.appendChild(card);
    });
  }

  function renderDistribution(rows) {
    var sorted = rows.slice().sort(function (a, b) { return b.views - a.views; });
    var maxViews = sorted[0] ? sorted[0].views : 1;
    var totalViews = sorted.reduce(function (s, r) { return s + r.views; }, 0);

    var container = document.getElementById("distributionBars");
    container.innerHTML = "";

    sorted.forEach(function (r) {
      var pct = (r.views / maxViews * 100).toFixed(1);
      var color = (typeof AREA_COLORS !== "undefined" && AREA_COLORS[r.area]) || "#999";
      var row = document.createElement("div");
      row.className = "dist-row";
      row.innerHTML =
        '<span class="dist-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="dist-bar-wrap"><span class="dist-bar" style="width:' + pct + '%;background:' + color + '"></span></span>' +
        '<span class="dist-value">' + r.views.toLocaleString() + '</span>';
      container.appendChild(row);
    });

    // Summary stats
    var top5 = sorted.slice(0, 5);
    var top5Views = top5.reduce(function (s, r) { return s + r.views; }, 0);
    var top5Pct = totalViews > 0 ? (top5Views / totalViews * 100).toFixed(1) : "0";
    var ratio = sorted.length > 1 ? (sorted[0].views / sorted[sorted.length - 1].views).toFixed(1) : "N/A";

    var summary = document.getElementById("distributionSummary");
    summary.innerHTML =
      "<strong>Top 5</strong> restaurants account for <strong>" + top5Pct + "%</strong> of all views. " +
      "The most-viewed restaurant has <strong>" + ratio + "x</strong> the views of the least-viewed.";
  }

  function renderPlatformSplit(rows) {
    var totalApple = rows.reduce(function (s, r) { return s + r.apple; }, 0);
    var totalGoogle = rows.reduce(function (s, r) { return s + r.google; }, 0);
    var total = totalApple + totalGoogle;

    var ctx = document.getElementById("platformChart").getContext("2d");
    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Apple Maps", "Google Maps"],
        datasets: [{
          data: [totalApple, totalGoogle],
          backgroundColor: ["#333", "#4285f4"],
          borderWidth: 2,
          borderColor: "#fff",
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        cutout: "60%",
      },
    });

    var legend = document.getElementById("platformLegend");
    var applePct = total > 0 ? (totalApple / total * 100).toFixed(0) : "0";
    var googlePct = total > 0 ? (totalGoogle / total * 100).toFixed(0) : "0";
    legend.innerHTML =
      '<span style="color:#333">Apple Maps: ' + totalApple + ' (' + applePct + '%)</span> &nbsp; ' +
      '<span style="color:#4285f4">Google Maps: ' + totalGoogle + ' (' + googlePct + '%)</span>';
  }

  function renderActionBreakdown(rows) {
    var totals = { views: 0, directions: 0, website: 0, phone: 0, instagram: 0, shares: 0, deeplinks: 0 };
    rows.forEach(function (r) {
      totals.views += r.views;
      totals.directions += r.apple + r.google;
      totals.website += r.website;
      totals.phone += r.phone;
      totals.instagram += r.instagram;
      totals.shares += r.shares;
      totals.deeplinks += r.deeplinks;
    });

    var labels = ["Views", "Directions", "Website", "Phone", "Instagram", "Shares", "Deep Links"];
    var values = [totals.views, totals.directions, totals.website, totals.phone, totals.instagram, totals.shares, totals.deeplinks];
    var colors = ["#e63946", "#e76f51", "#2d6a4f", "#1d3557", "#7b2cbf", "#f4a261", "#264653"];

    var ctx = document.getElementById("actionChart").getContext("2d");
    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: "#fff",
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 11 }, padding: 10 },
          },
        },
        cutout: "50%",
      },
    });
  }

  // Go
  fetchLatestSnapshot().then(function (snapshot) {
    if (!snapshot) {
      document.getElementById("footerNote").textContent =
        "No snapshot data found. Insights will appear once snapshots are collected.";
      return;
    }
    render(snapshot);
  });
})();
