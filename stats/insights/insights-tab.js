// Insights tab — conversion funnels, area breakdown, distribution, platform split
(function () {
  "use strict";

  var container = document.getElementById("tab-insights");
  if (!container) return;

  var areaByName = StatsUtils.buildAreaByName();

  // Inject HTML skeleton
  container.innerHTML =
    '<div class="section" id="ins-funnelSection">' +
      '<h2>Conversion Funnel</h2>' +
      '<p class="section-hint">Views vs. intent actions (directions, website, phone) per restaurant</p>' +
      '<p class="section-hint"><span class="scoring-toggle" id="ins-tagToggle">What do the tags mean? <span class="toggle-arrow">&#x25BC;</span></span></p>' +
      '<div class="scoring-detail" id="ins-tagDetail">' +
        '<div class="tag-legend">' +
          '<div class="tag-legend-item"><span class="tag tag-hot">Hot</span> Above-median views AND conversion — well-known and driving action</div>' +
          '<div class="tag-legend-item"><span class="tag tag-popular">Popular</span> Above-median views, below-median conversion — lots of lookers, fewer clicks</div>' +
          '<div class="tag-legend-item"><span class="tag tag-gem">Hidden Gem</span> Below-median views, above-median conversion — under the radar but visitors take action</div>' +
        '</div>' +
      '</div>' +
      '<div class="table-wrap">' +
        '<table id="ins-funnelTable">' +
          '<thead><tr>' +
            '<th class="col-rank">#</th>' +
            '<th class="col-name">Restaurant</th>' +
            '<th class="col-num">Views</th>' +
            '<th class="col-num">Intents</th>' +
            '<th class="col-num">Rate</th>' +
            '<th class="col-tag">Tag</th>' +
          '</tr></thead>' +
          '<tbody id="ins-funnelBody"></tbody>' +
        '</table>' +
      '</div>' +
    '</div>' +
    '<div class="section" id="ins-flowSection" style="display:none">' +
      '<h2>Traffic Flow</h2>' +
      '<p class="section-hint">How visitors arrive and what they do after viewing a restaurant</p>' +
      '<div class="flow-diagram" id="ins-flowDiagram"></div>' +
    '</div>' +
    '<div class="section" id="ins-areaSection">' +
      '<h2>Area Breakdown</h2>' +
      '<p class="section-hint">Engagement aggregated by neighborhood</p>' +
      '<div class="area-cards" id="ins-areaCards"></div>' +
    '</div>' +
    '<div class="section" id="ins-distributionSection">' +
      '<h2>Engagement Distribution</h2>' +
      '<p class="section-hint">How evenly attention is spread across restaurants</p>' +
      '<div class="distribution-summary" id="ins-distributionSummary"></div>' +
    '</div>' +
    '<p class="footer-note" id="ins-footerNote">Loading data...</p>';

  // Tag legend toggle (matches scoring toggle pattern from leaderboard)
  var tagToggle = document.getElementById("ins-tagToggle");
  var tagDetail = document.getElementById("ins-tagDetail");
  if (tagToggle && tagDetail) {
    tagToggle.addEventListener("click", function () {
      var arrow = tagToggle.querySelector(".toggle-arrow");
      tagDetail.classList.toggle("open");
      arrow.classList.toggle("open");
    });
  }

  function getIntents(d) {
    return (d["directions-apple"] || 0) + (d["directions-google"] || 0) + (d.website || 0) + (d.phone || 0);
  }

  function render(snapshot) {
    var detail = snapshot.detail;
    var rows = [];

    Object.keys(detail).forEach(function (name) {
      var d = detail[name];
      if (!StatsUtils.isRestaurant(name, d)) return;
      var mapViews = d.view || 0;
      var sidebarViews = d["sidebar-view"] || 0;
      var views = mapViews + sidebarViews;
      var intents = getIntents(d);
      var rate = views > 0 ? (intents / views * 100) : 0;
      rows.push({
        name: name,
        views: views,
        mapViews: mapViews,
        sidebarViews: sidebarViews,
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
        r.tag = "hot"; r.tagLabel = "Hot";
      } else if (r.views < medianViews && r.rate >= medianRate) {
        r.tag = "gem"; r.tagLabel = "Hidden Gem";
      } else if (r.views >= medianViews && r.rate < medianRate) {
        r.tag = "popular"; r.tagLabel = "Popular";
      } else {
        r.tag = ""; r.tagLabel = "";
      }
    });

    rows.sort(function (a, b) { return b.rate - a.rate || b.views - a.views; });

    renderFunnel(rows);

    // Only show traffic flow when we have deeplink session data
    var hasDeeplinks = rows.some(function (r) { return r.deeplinks > 0; });
    if (hasDeeplinks) {
      renderTrafficFlow(rows);
      document.getElementById("ins-flowSection").style.display = "";
    }

    renderAreaBreakdown(rows);
    renderDistribution(rows);

    document.getElementById("ins-footerNote").textContent =
      "Generated from snapshot data (" + (snapshot.timestamp || "").slice(0, 10) + "). Updated daily.";
  }

  function renderFunnel(rows) {
    var tbody = document.getElementById("ins-funnelBody");
    tbody.innerHTML = "";
    rows.forEach(function (r, i) {
      var tr = document.createElement("tr");
      var tagHtml = r.tag
        ? '<span class="tag tag-' + r.tag + '">' + r.tagLabel + '</span>'
        : "";
      tr.innerHTML =
        '<td class="rank-cell">' + (i + 1) + "</td>" +
        '<td class="name-cell"><a href="' + THEME.siteUrl + '/#' + StatsUtils.slugify(r.name) + '" target="_blank" rel="noopener">' + StatsUtils.escapeHtml(r.name) + '</a></td>' +
        '<td class="col-num">' + r.views.toLocaleString() + "</td>" +
        '<td class="col-num">' + r.intents.toLocaleString() + "</td>" +
        '<td class="col-num">' + r.rate.toFixed(1) + "%</td>" +
        '<td class="col-tag">' + tagHtml + "</td>";
      tbody.appendChild(tr);
    });
  }

  function renderTrafficFlow(rows) {
    var totalViews = 0, totalDeeplinks = 0, totalMapViews = 0, totalSidebarViews = 0;
    var exitCounts = { apple: 0, google: 0, website: 0, phone: 0, instagram: 0, shares: 0 };

    rows.forEach(function (r) {
      totalViews += r.views;
      totalDeeplinks += r.deeplinks;
      totalMapViews += r.mapViews;
      totalSidebarViews += r.sidebarViews;
      exitCounts.apple += r.apple;
      exitCounts.google += r.google;
      exitCounts.website += r.website;
      exitCounts.phone += r.phone;
      exitCounts.instagram += r.instagram;
      exitCounts.shares += r.shares;
    });
    var totalExitActions = exitCounts.apple + exitCounts.google + exitCounts.website +
      exitCounts.phone + exitCounts.instagram + exitCounts.shares;
    var viewOnly = Math.max(0, totalViews - totalExitActions);

    var pct = function (n) { return totalViews > 0 ? (n / totalViews * 100).toFixed(1) : "0"; };

    // Stacked bar for how visitors discover restaurants
    // If we have sidebar-view data, show the 3-way split; otherwise fall back to deeplink vs browse
    var hasSidebarData = totalSidebarViews > 0;
    var entryItems = hasSidebarData ? [
      { label: "Direct Link", count: totalDeeplinks, color: "#e76f51" },
      { label: "Sidebar", count: totalSidebarViews, color: "#264653" },
      { label: "Map", count: totalMapViews, color: "#2d6a4f" },
    ] : [
      { label: "Direct Link", count: totalDeeplinks, color: "#e76f51" },
      { label: "Browsing", count: totalViews - totalDeeplinks, color: "#264653" },
    ];

    // Conversion bar: acted vs view-only
    var actionRate = totalViews > 0 ? (totalExitActions / totalViews * 100).toFixed(1) : "0";
    var conversionItems = [
      { label: "Took Action", count: totalExitActions, color: "#2d6a4f" },
      { label: "View Only", count: viewOnly, color: "#ddd" },
    ].filter(function (e) { return e.count > 0; });

    // Action breakdown (only people who did something)
    var exitItems = [
      { label: "Apple Maps", count: exitCounts.apple, color: "#333" },
      { label: "Google Maps", count: exitCounts.google, color: "#4285f4" },
      { label: "Website", count: exitCounts.website, color: "#2d6a4f" },
      { label: "Phone", count: exitCounts.phone, color: "#1d3557" },
      { label: "Instagram", count: exitCounts.instagram, color: "#7b2cbf" },
      { label: "Shares", count: exitCounts.shares, color: "#f4a261" },
    ].filter(function (e) { return e.count > 0; });

    function stackedBar(items, total) {
      var bar = items.map(function (item) {
        var w = total > 0 ? (item.count / total * 100) : 0;
        return '<div class="flow-bar-seg" style="width:' + w + '%;background:' + item.color + '" title="' + item.label + ': ' + item.count.toLocaleString() + '"></div>';
      }).join("");

      var legend = items.map(function (item) {
        return '<div class="flow-legend-item">' +
          '<span class="flow-legend-dot" style="background:' + item.color + '"></span>' +
          '<span class="flow-legend-label">' + item.label + '</span>' +
          '<span class="flow-legend-value">' + item.count.toLocaleString() + ' (' + pct(item.count) + '%)</span>' +
        '</div>';
      }).join("");

      return '<div class="flow-bar">' + bar + '</div>' +
        '<div class="flow-legend">' + legend + '</div>';
    }

    var el = document.getElementById("ins-flowDiagram");
    el.innerHTML =
      '<div class="flow-center-stat">' +
        '<div class="flow-center-count">' + totalViews.toLocaleString() + '</div>' +
        '<div class="flow-center-label">total restaurant views</div>' +
      '</div>' +
      '<div class="flow-group">' +
        '<div class="flow-group-title">How visitors arrive</div>' +
        stackedBar(entryItems, totalViews) +
      '</div>' +
      '<div class="flow-group">' +
        '<div class="flow-group-title">Conversion — ' + actionRate + '% took action</div>' +
        stackedBar(conversionItems, totalViews) +
      '</div>' +
      '<div class="flow-group">' +
        '<div class="flow-group-title">Action breakdown (' + totalExitActions.toLocaleString() + ' total actions)</div>' +
        stackedBar(exitItems, totalExitActions) +
      '</div>';
  }

  function renderAreaBreakdown(rows) {
    var areas = {};
    rows.forEach(function (r) {
      if (!areas[r.area]) areas[r.area] = { views: 0, intents: 0, count: 0 };
      areas[r.area].views += r.views;
      areas[r.area].intents += r.intents;
      areas[r.area].count++;
    });

    var el = document.getElementById("ins-areaCards");
    el.innerHTML = "";

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
        '<div class="area-card-name">' + StatsUtils.escapeHtml(name) + '</div>' +
        '<div class="area-card-stat"><strong>' + a.views.toLocaleString() + '</strong> views</div>' +
        '<div class="area-card-stat"><strong>' + a.intents.toLocaleString() + '</strong> intents</div>' +
        '<div class="area-card-stat">' + a.count + ' restaurants</div>' +
        '<div class="area-card-rate">' + rate + '% conversion</div>';
      el.appendChild(card);
    });
  }

  function renderDistribution(rows) {
    var sorted = rows.slice().sort(function (a, b) { return b.views - a.views; });
    var totalViews = sorted.reduce(function (s, r) { return s + r.views; }, 0);

    var top5 = sorted.slice(0, 5);
    var top5Views = top5.reduce(function (s, r) { return s + r.views; }, 0);
    var top5Pct = totalViews > 0 ? (top5Views / totalViews * 100).toFixed(1) : "0";
    var ratio = sorted.length > 1 ? (sorted[0].views / sorted[sorted.length - 1].views).toFixed(1) : "N/A";

    var summary = document.getElementById("ins-distributionSummary");
    summary.innerHTML =
      "<strong>Top 5</strong> restaurants account for <strong>" + top5Pct + "%</strong> of all views. " +
      "The most-viewed restaurant has <strong>" + ratio + "x</strong> the views of the least-viewed.";
  }

  // Fetch latest snapshot
  StatsUtils.fetchAllSnapshots("../snapshots/").then(function (snapshots) {
    if (snapshots.length === 0) {
      document.getElementById("ins-footerNote").textContent =
        "No snapshot data found. Insights will appear once snapshots are collected.";
      return;
    }
    var latest = snapshots[snapshots.length - 1];
    render(latest.data);
  });
})();
