// Stats Dashboard — fetch tracking data and render leaderboard

(function () {
  "use strict";

  // Track stats page view
  if (typeof window.track === "function") window.track("stats-view", "stats");

  // Apply theme
  var pageTitle = document.getElementById("pageTitle");
  if (pageTitle) {
    pageTitle.textContent = THEME.eventName;
    pageTitle.href = THEME.siteUrl + "/";
  }
  var backLink = document.getElementById("backLink");
  if (backLink) backLink.href = THEME.siteUrl + "/";

  // State-driven concluded banner
  var concludedBanner = document.getElementById("concludedBanner");
  var bannerTextEl = document.getElementById("concludedBannerText");
  var __statsEventState = typeof getEventState === "function" ? getEventState() : "off-season";
  if (concludedBanner && (__statsEventState === "post-event" || __statsEventState === "off-season")) {
    concludedBanner.style.display = "";
    if (bannerTextEl) {
      if (__statsEventState === "off-season") {
        bannerTextEl.textContent = "Showing final results from " + THEME.eventName;
      }
    }
  }

  var escapeHtml = StatsUtils.escapeHtml;
  var slugify = StatsUtils.slugify;

  // Build filter labels dynamically from AREA_COLORS (data file) and THEME config
  var filterLabels = {};
  if (typeof AREA_COLORS !== "undefined") {
    Object.keys(AREA_COLORS).forEach(function (area) {
      filterLabels[area] = area;
    });
  }
  (THEME.tagFilters || []).forEach(function (t) {
    filterLabels[t.key] = t.label;
  });
  (THEME.hoursFilters || []).forEach(function (h) {
    filterLabels[h.key] = h.label;
  });

  // Column definitions for sortable leaderboard
  var columns = [
    { key: "deeplinks", label: "Direct" },
    { key: "views", label: "Views" },
    { key: "directions", label: "Maps" },
    { key: "contact", label: "Contact" },
    { key: "shares", label: "Shares" },
    { key: "likes", label: "Likes" },
    { key: "score", label: "Score" },
  ];

  // Sort state: null = default (score desc), otherwise { key, dir }
  // dir: "desc" or "asc"
  var sortState = null;
  var currentRows = [];

  function defaultSort(rows) {
    return rows.slice().sort(function (a, b) {
      return b.score - a.score || a.name.localeCompare(b.name);
    });
  }

  function sortRows(rows) {
    if (!sortState) return defaultSort(rows);
    var key = sortState.key;
    var dir = sortState.dir;
    return rows.slice().sort(function (a, b) {
      if (key === "name") {
        var cmp = a.name.localeCompare(b.name);
        return dir === "asc" ? cmp : -cmp;
      }
      var diff = dir === "desc" ? b[key] - a[key] : a[key] - b[key];
      return diff || a.name.localeCompare(b.name);
    });
  }

  function renderTable() {
    var sorted = sortRows(currentRows);
    var tbody = document.getElementById("leaderboardBody");
    tbody.innerHTML = "";

    sorted.forEach(function (row, i) {
      var rank = i + 1;
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="rank-cell">' + rank + "</td>" +
        '<td class="name-cell">' +
        '<a href="' + THEME.siteUrl + '/#' + slugify(row.name) + '" target="_blank" rel="noopener">' + escapeHtml(row.name) + '</a>' +
        "</td>" +
        '<td class="col-num">' + row.deeplinks.toLocaleString() + "</td>" +
        '<td class="col-num">' + row.views.toLocaleString() + "</td>" +
        '<td class="col-num">' + row.directions.toLocaleString() + "</td>" +
        '<td class="col-num">' + row.contact.toLocaleString() + "</td>" +
        '<td class="col-num">' + row.shares.toLocaleString() + "</td>" +
        '<td class="col-num">' + row.likes.toLocaleString() + "</td>" +
        '<td class="col-num score-cell">' + row.score.toLocaleString() + "</td>";
      tbody.appendChild(tr);
    });

    updateHeaderIndicators();
  }

  function updateHeaderIndicators() {
    var ths = document.querySelectorAll("#leaderboard thead th[data-sort]");
    ths.forEach(function (th) {
      var key = th.getAttribute("data-sort");
      var arrow = th.querySelector(".sort-arrow");
      if (sortState && sortState.key === key) {
        arrow.textContent = sortState.dir === "desc" ? " \u25BC" : " \u25B2";
        th.classList.add("sort-active");
      } else {
        arrow.textContent = "";
        th.classList.remove("sort-active");
      }
    });
  }

  function setupSortHeaders() {
    var headerRow = document.querySelector("#leaderboard thead tr");
    var ths = headerRow.querySelectorAll("th");

    // Add data-sort and name sort to Restaurant column
    ths[1].setAttribute("data-sort", "name");
    var nameArrow = document.createElement("span");
    nameArrow.className = "sort-arrow";
    ths[1].appendChild(nameArrow);
    ths[1].style.cursor = "pointer";

    // Add data-sort to numeric columns
    columns.forEach(function (col, i) {
      var th = ths[i + 2]; // offset by # and Restaurant
      th.setAttribute("data-sort", col.key);
      var arrow = document.createElement("span");
      arrow.className = "sort-arrow";
      th.appendChild(arrow);
      th.style.cursor = "pointer";
    });

    headerRow.addEventListener("click", function (e) {
      var th = e.target.closest("th[data-sort]");
      if (!th) return;
      var key = th.getAttribute("data-sort");

      // 3-way toggle: desc → asc → none
      if (!sortState || sortState.key !== key) {
        sortState = { key: key, dir: "desc" };
      } else if (sortState.dir === "desc") {
        sortState = { key: key, dir: "asc" };
      } else {
        sortState = null;
      }

      renderTable();
    });
  }

  setupSortHeaders();

  // Scoring method toggle
  var scoringToggle = document.getElementById("scoringToggle");
  var scoringDetail = document.getElementById("scoringDetail");
  if (scoringToggle && scoringDetail) {
    scoringToggle.addEventListener("click", function () {
      var arrow = scoringToggle.querySelector(".toggle-arrow");
      scoringDetail.classList.toggle("open");
      arrow.classList.toggle("open");
    });
  }

  function render(data) {
    var totalViews = 0;
    var totalDirApple = 0;
    var totalDirGoogle = 0;
    var totalWebsite = 0;
    var totalPhone = 0;
    var totalInstagram = 0;
    var totalShares = 0;
    var totalDeeplinks = 0;
    var totalLikes = 0;

    // Collect filter usage stats
    var filterCounts = {};

    var rows = [];
    Object.keys(data).forEach(function (name) {
      var d = data[name];

      // Gather filter-area, filter-tag, and filter-hours events
      var filterArea = d["filter-area"] || 0;
      var filterTag = d["filter-tag"] || 0;
      var filterHours = d["filter-hours"] || 0;
      if (filterArea > 0 || filterTag > 0 || filterHours > 0) {
        filterCounts[name] = (filterCounts[name] || 0) + filterArea + filterTag + filterHours;
      }

      // Skip non-restaurant entries for the leaderboard
      var hasRestaurantEvents = d.view || d["sidebar-view"] || d["directions-apple"] || d["directions-google"] || d.website || d.phone || d.instagram || d.share || d.deeplink || d.upvote;
      if (!hasRestaurantEvents) return;

      var views = (d.view || 0) + (d["sidebar-view"] || 0);
      var dirApple = d["directions-apple"] || 0;
      var dirGoogle = d["directions-google"] || 0;
      var directions = dirApple + dirGoogle;
      var website = d.website || 0;
      var phone = d.phone || 0;
      var instagram = d.instagram || 0;
      var shares = d.share || 0;
      var deeplinks = d.deeplink || 0;
      var likes = Math.max((d.upvote || 0) - (d["un-upvote"] || 0), 0);
      var score = (directions + phone) * 3 + (deeplinks + shares + likes) * 2 + website + instagram + views;

      totalViews += views;
      totalDirApple += dirApple;
      totalDirGoogle += dirGoogle;
      totalWebsite += website;
      totalPhone += phone;
      totalInstagram += instagram;
      totalShares += shares;
      totalDeeplinks += deeplinks;
      totalLikes += likes;

      rows.push({
        name: name,
        views: views,
        directions: directions,
        contact: website + phone + instagram,
        shares: shares,
        deeplinks: deeplinks,
        likes: likes,
        score: score,
      });
    });

    currentRows = rows;

    // Summary cards
    document.getElementById("totalViews").textContent =
      totalViews.toLocaleString();
    document.getElementById("totalDirApple").textContent =
      totalDirApple.toLocaleString();
    document.getElementById("totalDirGoogle").textContent =
      totalDirGoogle.toLocaleString();
    document.getElementById("totalWebsite").textContent =
      totalWebsite.toLocaleString();
    document.getElementById("totalPhone").textContent =
      totalPhone.toLocaleString();
    document.getElementById("totalInstagram").textContent =
      totalInstagram.toLocaleString();
    document.getElementById("totalShares").textContent =
      totalShares.toLocaleString();
    document.getElementById("totalDeeplinks").textContent =
      totalDeeplinks.toLocaleString();
    document.getElementById("totalLikes").textContent =
      totalLikes.toLocaleString();

    // Render leaderboard
    renderTable();

    // Filter usage section — always show, with zeros for missing filters
    var filterSection = document.getElementById("filterSection");
    var filterGrid = document.getElementById("filterStatsGrid");
    filterSection.style.display = "";
    filterGrid.innerHTML = "";
    var allFilterKeys = Object.keys(filterLabels);
    allFilterKeys.forEach(function (key) {
      var count = filterCounts[key] || 0;
      var card = document.createElement("div");
      card.className = "card card-clickable";
      card.setAttribute("data-filter-label", key);
      card.setAttribute("data-metric-label", filterLabels[key]);
      card.innerHTML =
        '<div class="card-value">' + count.toLocaleString() + "</div>" +
        '<div class="card-label">' + escapeHtml(filterLabels[key]) + "</div>";
      filterGrid.appendChild(card);
    });

    // Stats page view count
    var statsData = data["stats"];
    var statsEl = document.getElementById("statsPageViews");
    if (statsData && statsEl) {
      var statsViews = statsData["stats-view"] || 0;
      statsEl.textContent = statsViews.toLocaleString();
    }

    var note = document.getElementById("footerNote");
    if (rows.length > 0) {
      if (__statsEventState === "off-season") {
        note.textContent = "Showing final results from " + THEME.eventName + ".";
      } else {
        var startLabel = THEME.eventStartDate
          ? new Date(THEME.eventStartDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "event start";
        note.textContent =
          "Updated every 5 minutes. Data collected since event start (" + startLabel + ").";
      }
    } else {
      note.textContent =
        "No tracking data yet. Stats will appear once the event starts.";
    }
  }

  // ── Platform & Device (RUM) ──────────────
  function renderBars(container, rawData) {
    var entries = Object.keys(rawData).map(function (k) {
      return { label: k, count: rawData[k] };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 6);

    if (entries.length === 0) return;
    var max = entries[0].count;

    entries.forEach(function (e) {
      var row = document.createElement("div");
      row.className = "bar-row";
      var pct = max > 0 ? (e.count / max * 100) : 0;
      row.innerHTML =
        '<span class="bar-label">' + escapeHtml(e.label) + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
        '<span class="bar-value">' + e.count.toLocaleString() + '</span>';
      container.appendChild(row);
    });
  }

  function renderPlatform(data) {
    var grid = document.getElementById("platformGrid");
    if (!grid) return;

    var hasData = (Object.keys(data.devices).length + Object.keys(data.browsers).length + Object.keys(data.os).length) > 0;
    if (!hasData) return;

    document.getElementById("platformSection").style.display = "";
    grid.innerHTML = "";

    // Device Type column
    var devCol = document.createElement("div");
    devCol.className = "platform-col";
    devCol.innerHTML = '<h3>Device Type</h3>';
    var devCards = document.createElement("div");
    devCards.className = "device-cards";
    var total = 0;
    Object.keys(data.devices).forEach(function (k) { total += data.devices[k]; });

    var deviceMeta = {
      desktop: { emoji: "\uD83D\uDDA5\uFE0F", label: "Desktop" },
      mobile: { emoji: "\uD83D\uDCF1", label: "Mobile" },
      tablet: { emoji: "\uD83D\uDCCB", label: "Tablet" },
    };

    ["desktop", "mobile", "tablet"].forEach(function (type) {
      var count = data.devices[type] || 0;
      if (count === 0 && !data.devices[type]) return;
      var meta = deviceMeta[type] || { emoji: "\u2753", label: type };
      var pct = total > 0 ? (count / total * 100).toFixed(1) : "0";
      var card = document.createElement("div");
      card.className = "device-card";
      card.innerHTML =
        '<span class="device-emoji">' + meta.emoji + '</span>' +
        '<div class="device-pct">' + pct + '%</div>' +
        '<div class="device-label">' + meta.label + '</div>' +
        '<div class="device-count">' + count.toLocaleString() + '</div>';
      devCards.appendChild(card);
    });
    devCol.appendChild(devCards);
    grid.appendChild(devCol);

    // Browsers column
    var brCol = document.createElement("div");
    brCol.className = "platform-col";
    brCol.innerHTML = '<h3>Top Browsers</h3>';
    renderBars(brCol, data.browsers);
    grid.appendChild(brCol);

    // OS column
    var osCol = document.createElement("div");
    osCol.className = "platform-col";
    osCol.innerHTML = '<h3>Operating System</h3>';
    renderBars(osCol, data.os);
    grid.appendChild(osCol);
  }

  // Fetch RUM data (independent of detail fetch)
  if (THEME.trackUrl) {
    fetch(THEME.trackUrl + "?rum=true", { method: "GET" })
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        if (data && typeof data === "object") renderPlatform(data);
      })
      .catch(function () { /* section stays hidden */ });
  }

  // ── Live activity section ──────────────
  function updateLiveActivity() {
    if (!THEME.trackUrl) return;
    fetch(THEME.trackUrl + "?active=true", { method: "GET" })
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        var section = document.getElementById("liveSection");
        if (!section || !data) return;

        var v = data.visitors1h || 0;
        var a = data.recentActions || 0;

        document.getElementById("liveVisitors").textContent = v.toLocaleString();
        document.getElementById("liveActions").textContent = a.toLocaleString();
        section.style.display = "";
      })
      .catch(function () { /* section stays hidden */ });
  }

  // Live activity polling — disabled while panel is hidden
  // updateLiveActivity();
  // setInterval(updateLiveActivity, 30000);

  // ── Hourly chart modal ──────────────────
  var hourlyCache = null;
  var hourlyLabelCache = {};
  var chartInstance = null;

  // Build date range params from config for hourly queries
  var __eventConcluded = __statsEventState === "post-event" || __statsEventState === "off-season";

  function hourlyDateParams() {
    if (THEME.eventStartDate && THEME.eventEndDate) {
      return "&start=" + encodeURIComponent(THEME.eventStartDate) + "&end=" + encodeURIComponent(THEME.eventEndDate);
    }
    return "";
  }

  function fetchHourly() {
    if (hourlyCache) return Promise.resolve(hourlyCache);
    // Use snapshot for concluded events
    if (__eventConcluded) {
      return fetch("../snapshots/hourly-events.json", { method: "GET" })
        .then(function (resp) { return resp.ok ? resp.json() : null; })
        .then(function (data) { hourlyCache = data; return data; })
        .catch(function () { return null; });
    }
    if (!THEME.trackUrl) return Promise.resolve(null);
    return fetch(THEME.trackUrl + "?hourly=true" + hourlyDateParams(), { method: "GET" })
      .then(function (resp) { return resp.json(); })
      .then(function (data) { hourlyCache = data; return data; })
      .catch(function () { return null; });
  }

  function fetchHourlyLabel(label) {
    if (hourlyLabelCache[label]) return Promise.resolve(hourlyLabelCache[label]);
    // Use snapshot for concluded events
    if (__eventConcluded) {
      if (!hourlyLabelCache.__snapshot) {
        hourlyLabelCache.__snapshot = fetch("../snapshots/hourly-labels.json", { method: "GET" })
          .then(function (resp) { return resp.ok ? resp.json() : {}; })
          .catch(function () { return {}; });
      }
      return hourlyLabelCache.__snapshot.then(function (all) {
        var data = all[label] || null;
        hourlyLabelCache[label] = data;
        return data;
      });
    }
    if (!THEME.trackUrl) return Promise.resolve(null);
    return fetch(THEME.trackUrl + "?hourly=true&label=" + encodeURIComponent(label) + hourlyDateParams(), { method: "GET" })
      .then(function (resp) { return resp.json(); })
      .then(function (data) { hourlyLabelCache[label] = data; return data; })
      .catch(function () { return null; });
  }

  function formatHourLabel(h) {
    var d = new Date(h);
    var mon = d.getMonth() + 1;
    var day = d.getDate();
    var hr = d.getHours();
    var ampm = hr >= 12 ? "p" : "a";
    var h12 = hr % 12 || 12;
    return mon + "/" + day + " " + h12 + ampm;
  }

  function formatHourTooltip(h) {
    var d = new Date(h);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " " +
      d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
  }

  // opts: { cumulative: bool }
  function renderChart(hours, values, label, opts) {
    var cumulative = opts && opts.cumulative;
    var chartValues = values;
    if (cumulative) {
      chartValues = [];
      var sum = 0;
      values.forEach(function (v) { sum += v; chartValues.push(sum); });
    }

    var labels = hours.map(formatHourLabel);

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    var ctx = document.getElementById("chartModalCanvas").getContext("2d");

    var dataset = {
      label: label,
      data: chartValues,
      borderColor: "#e76f51",
      backgroundColor: "rgba(230, 111, 81, 0.1)",
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHitRadius: 8,
    };

    chartInstance = new Chart(ctx, {
      type: "line",
      data: { labels: labels, datasets: [dataset] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (items) {
                return formatHourTooltip(hours[items[0].dataIndex]);
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { maxRotation: 45, font: { size: 10 }, autoSkip: true, maxTicksLimit: 24 },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, font: { size: 11 } },
          },
        },
      },
    });
  }

  // Metrics that render as heatmap instead of line chart
  var heatmapMetrics = { "view": true };

  // Open chart for a metric (action-based, from ?hourly=true)
  function openChartModal(metricKey, label, opts) {
    fetchHourly().then(function (data) {
      if (!data) return;

      var keys = metricKey.split(",");

      // Use heatmap for qualifying metrics
      if (heatmapMetrics[metricKey]) {
        renderHeatmap(data, keys, label);
        return;
      }

      var overlay = document.getElementById("chartModalOverlay");
      document.getElementById("chartModalTitle").textContent = label + " per Hour";
      overlay.classList.add("open");

      var filtered = StatsUtils.filterHourlyToEvent(data);
      var hourMap = {};
      Object.keys(filtered).forEach(function (hour) {
        var total = 0;
        keys.forEach(function (k) { total += filtered[hour][k] || 0; });
        hourMap[hour] = total;
      });

      var hours = Object.keys(hourMap).sort();
      var values = hours.map(function (h) { return hourMap[h]; });
      renderChart(hours, values, label, opts);
    });
  }

  // Open chart for a filter label (label-based, from ?hourly=true&label=X)
  function openFilterChartModal(filterKey, label) {
    fetchHourlyLabel(filterKey).then(function (data) {
      if (!data) return;
      data = StatsUtils.filterHourlyToEvent(data);

      var overlay = document.getElementById("chartModalOverlay");
      document.getElementById("chartModalTitle").textContent = label + " (Cumulative)";
      overlay.classList.add("open");

      var hours = Object.keys(data).sort();
      var values = hours.map(function (h) { return data[h] || 0; });
      renderChart(hours, values, label, { cumulative: true });
    });
  }

  function heatColor(intensity) {
    // Multi-stop: cream (#fde8d0) → orange (#e76f51) → deep red (#b5230f)
    var stops = [
      { p: 0,   r: 253, g: 232, b: 208 },
      { p: 0.4, r: 231, g: 111, b: 81 },
      { p: 1,   r: 181, g: 35,  b: 15 },
    ];
    var i = 0;
    while (i < stops.length - 2 && intensity > stops[i + 1].p) i++;
    var a = stops[i], z = stops[i + 1];
    var t = (intensity - a.p) / (z.p - a.p);
    var r = Math.round(a.r + (z.r - a.r) * t);
    var g = Math.round(a.g + (z.g - a.g) * t);
    var b = Math.round(a.b + (z.b - a.b) * t);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function formatHour12(h) {
    if (h === 0) return "12am";
    if (h < 12) return h + "am";
    if (h === 12) return "12pm";
    return (h - 12) + "pm";
  }

  // Render a day × hour heatmap in the chart modal
  // hourlyData: raw ?hourly=true response, actionKeys: array of action names to sum, label: display name
  function renderHeatmap(hourlyData, actionKeys, label) {
    var overlay = document.getElementById("chartModalOverlay");
    document.getElementById("chartModalTitle").textContent = label + " — Hourly Heatmap";
    overlay.classList.add("open");

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    hourlyData = StatsUtils.filterHourlyToEvent(hourlyData);
    var dayMap = {};
    Object.keys(hourlyData).forEach(function (hour) {
      var d = new Date(hour.replace(" ", "T") + "Z");
      var localDate = d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
      var localHour = d.getHours();
      if (!dayMap[localDate]) dayMap[localDate] = {};
      var total = 0;
      actionKeys.forEach(function (k) { total += hourlyData[hour][k] || 0; });
      dayMap[localDate][localHour] = (dayMap[localDate][localHour] || 0) + total;
    });

    var days = Object.keys(dayMap).sort();
    var maxVal = 0;
    days.forEach(function (day) {
      for (var h = 0; h < 24; h++) {
        var v = dayMap[day][h] || 0;
        if (v > maxVal) maxVal = v;
      }
    });

    // Find peak cell (day + hour with highest count)
    var peakDay = null, peakHour = -1;
    if (maxVal > 0) {
      days.forEach(function (day) {
        for (var h = 0; h < 24; h++) {
          if ((dayMap[day][h] || 0) === maxVal) { peakDay = day; peakHour = h; }
        }
      });
    }

    var fullDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var shortDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var html = '<div class="heatmap-wrap">';

    // Tooltip element
    html += '<div class="heatmap-tooltip" id="heatmapTooltip"></div>';

    // Header row with hour labels + "Total" column
    html += '<div class="heatmap-row heatmap-header"><div class="heatmap-day-label"></div>';
    for (var h = 0; h < 24; h++) {
      var show = h % 3 === 0;
      var lbl = show ? (h === 0 ? "12a" : h < 12 ? h + "a" : h === 12 ? "12p" : (h - 12) + "p") : "";
      html += '<div class="heatmap-hour-label">' + lbl + '</div>';
    }
    html += '<div class="heatmap-row-total heatmap-hour-label"></div>';
    html += '</div>';

    // Day rows
    days.forEach(function (day) {
      var d = new Date(day + "T12:00:00");
      var shortLabel = shortDayNames[d.getDay()] + " " + (d.getMonth() + 1) + "/" + d.getDate();
      var fullDay = fullDayNames[d.getDay()];
      var dateStr = (d.getMonth() + 1) + "/" + d.getDate();
      var rowTotal = 0;
      html += '<div class="heatmap-row"><div class="heatmap-day-label">' + shortLabel + '</div>';
      for (var h = 0; h < 24; h++) {
        var count = dayMap[day][h] || 0;
        rowTotal += count;
        var intensity = maxVal > 0 ? count / maxVal : 0;
        var bg = count === 0 ? "#f0f0f0" : heatColor(intensity);
        var isPeak = (day === peakDay && h === peakHour);
        html += '<div class="heatmap-cell' + (isPeak ? ' heatmap-peak' : '') + '" style="background:' + bg + '"' +
          ' data-day="' + fullDay + ' ' + dateStr + '"' +
          ' data-hour="' + formatHour12(h) + '"' +
          ' data-count="' + count + '"' +
          ' data-label="' + escapeHtml(label) + '"></div>';
      }
      html += '<div class="heatmap-row-total">' + rowTotal.toLocaleString() + '</div>';
      html += '</div>';
    });

    html += '<div class="heatmap-legend"><span>Less</span>';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      html += '<div class="heatmap-legend-cell" style="background:' + (v === 0 ? "#f0f0f0" : heatColor(v)) + '"></div>';
    });
    html += '<span>More</span></div>';
    html += '</div>';

    var body = document.querySelector(".chart-modal-body");
    var canvas = document.getElementById("chartModalCanvas");
    canvas.style.display = "none";
    var existing = body.querySelector(".heatmap-wrap");
    if (existing) existing.remove();
    body.insertAdjacentHTML("beforeend", html);

    // Wire up tooltip (mouse)
    var wrap = body.querySelector(".heatmap-wrap");
    var tip = document.getElementById("heatmapTooltip");

    function showTip(cell) {
      var count = cell.getAttribute("data-count");
      var day = cell.getAttribute("data-day");
      var hour = cell.getAttribute("data-hour");
      var metricLabel = cell.getAttribute("data-label");
      tip.innerHTML = '<strong>' + day + ', ' + hour + '</strong><br>' +
        count + ' ' + metricLabel.toLowerCase();
      tip.style.opacity = "1";
    }

    function positionTip(clientX, clientY) {
      var rect = wrap.getBoundingClientRect();
      var x = clientX - rect.left + 12;
      var y = clientY - rect.top - 40;
      var tipW = tip.offsetWidth;
      if (x + tipW > rect.width) x = x - tipW - 24;
      if (y < 0) y = clientY - rect.top + 16;
      tip.style.left = x + "px";
      tip.style.top = y + "px";
    }

    wrap.addEventListener("mouseover", function (e) {
      var cell = e.target.closest(".heatmap-cell");
      if (!cell) { tip.style.opacity = "0"; return; }
      showTip(cell);
    });

    wrap.addEventListener("mousemove", function (e) {
      positionTip(e.clientX, e.clientY);
    });

    wrap.addEventListener("mouseleave", function () {
      tip.style.opacity = "0";
    });

    // Touch support — tap cell to show tooltip, tap elsewhere to hide
    wrap.addEventListener("touchstart", function (e) {
      var cell = e.target.closest(".heatmap-cell");
      if (!cell) { tip.style.opacity = "0"; return; }
      e.preventDefault();
      showTip(cell);
      var touch = e.touches[0];
      positionTip(touch.clientX, touch.clientY);
    }, { passive: false });
  }

  function closeChartModal() {
    var overlay = document.getElementById("chartModalOverlay");
    overlay.classList.remove("open");
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    // Clean up heatmap if present
    var heatmap = document.querySelector(".chart-modal-body .heatmap-wrap");
    if (heatmap) heatmap.remove();
    document.getElementById("chartModalCanvas").style.display = "";
  }

  // Close handlers
  document.getElementById("chartModalOverlay").addEventListener("click", function (e) {
    if (e.target === this) closeChartModal();
  });
  document.getElementById("chartModalClose").addEventListener("click", closeChartModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeChartModal();
  });

  // Summary card click → bar chart
  document.getElementById("summaryCards").addEventListener("click", function (e) {
    var card = e.target.closest(".card-clickable[data-metric]");
    if (!card) return;
    var metric = card.getAttribute("data-metric");
    var label = card.getAttribute("data-metric-label");
    openChartModal(metric, label);
  });

  // Filter card click → cumulative line chart
  document.getElementById("filterStatsGrid").addEventListener("click", function (e) {
    var card = e.target.closest(".card-clickable[data-filter-label]");
    if (!card) return;
    var filterKey = card.getAttribute("data-filter-label");
    var label = card.getAttribute("data-metric-label");
    openFilterChartModal(filterKey, label);
  });

  // Live card click — disabled while panel is hidden
  // var liveCards = document.getElementById("liveCards");
  // if (liveCards) { liveCards.addEventListener("click", function (e) { ... }); }

  // Load from snapshot or live API
  if (typeof TRACKING_SNAPSHOT !== "undefined" && TRACKING_SNAPSHOT.detail) {
    render(TRACKING_SNAPSHOT.detail);
  } else if (THEME.trackUrl) {
    fetch(THEME.trackUrl + "?detail=true", { method: "GET" })
      .then(function (resp) {
        return resp.json();
      })
      .then(function (data) {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
          render(data);
        } else {
          document.getElementById("footerNote").textContent =
            "No tracking data yet. Stats will appear once the event starts.";
        }
      })
      .catch(function () {
        document.getElementById("footerNote").textContent =
          "No tracking data yet. Stats will appear once the event starts.";
      });
  } else {
    document.getElementById("footerNote").textContent =
      __statsEventState === "off-season"
        ? "Showing final results from " + THEME.eventName + "."
        : "No tracking data yet. Stats will appear once the event starts.";
  }
})();
