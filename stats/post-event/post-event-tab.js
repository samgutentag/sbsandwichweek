// Post-Event stats tab — shows activity after the event ended
(function () {
  "use strict";

  var container = document.getElementById("tab-post-event");
  if (!container) return;

  var escapeHtml = StatsUtils.escapeHtml;
  var slugify = StatsUtils.slugify;
  var isRestaurant = StatsUtils.isRestaurant;
  var formatDate = StatsUtils.formatDate;

  // Inject HTML skeleton
  container.innerHTML =
    '<div class="leaderboard-section">' +
    '<h2>Post-Event Activity</h2>' +
    '<p class="pe-date-range" id="peDateRange">Loading…</p>' +
    '<p class="leaderboard-hint">Total actions since the event ended</p>' +
    '<div class="summary-cards" id="peSummaryCards">' +
    '<div class="card"><div class="card-value" id="peViews">—</div><div class="card-label">Views</div></div>' +
    '<div class="card"><div class="card-value" id="peDirApple">—</div><div class="card-label">Apple Maps</div></div>' +
    '<div class="card"><div class="card-value" id="peDirGoogle">—</div><div class="card-label">Google Maps</div></div>' +
    '<div class="card"><div class="card-value" id="peWebsite">—</div><div class="card-label">Website</div></div>' +
    '<div class="card"><div class="card-value" id="pePhone">—</div><div class="card-label">Phone</div></div>' +
    '<div class="card"><div class="card-value" id="peInstagram">—</div><div class="card-label">Instagram</div></div>' +
    '<div class="card"><div class="card-value" id="peShares">—</div><div class="card-label">Shares</div></div>' +
    '<div class="card"><div class="card-value" id="peDeeplinks">—</div><div class="card-label">Direct Links</div></div>' +
    '<div class="card"><div class="card-value" id="peLikes">—</div><div class="card-label">Likes</div></div>' +
    "</div>" +
    "</div>" +
    '<div class="leaderboard-section">' +
    "<h2>Restaurant Leaderboard</h2>" +
    '<p class="leaderboard-hint">Ranked by post-event engagement score</p>' +
    '<div class="table-wrap">' +
    '<table id="peLeaderboard">' +
    "<thead><tr>" +
    '<th class="col-rank">#</th>' +
    '<th class="col-name">Restaurant</th>' +
    '<th class="col-num">Direct</th>' +
    '<th class="col-num">Views</th>' +
    '<th class="col-num">Maps</th>' +
    '<th class="col-num">Contact</th>' +
    '<th class="col-num">Shares</th>' +
    '<th class="col-num">Likes</th>' +
    '<th class="col-num">Score</th>' +
    "</tr></thead>" +
    '<tbody id="peLeaderboardBody"></tbody>' +
    "</table>" +
    "</div>" +
    "</div>" +
    '<p class="footer-note" id="peFooterNote"></p>';

  // Column definitions for sorting
  var columns = [
    { key: "deeplinks", label: "Direct" },
    { key: "views", label: "Views" },
    { key: "directions", label: "Maps" },
    { key: "contact", label: "Contact" },
    { key: "shares", label: "Shares" },
    { key: "likes", label: "Likes" },
    { key: "score", label: "Score" },
  ];

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
    var tbody = document.getElementById("peLeaderboardBody");
    tbody.innerHTML = "";

    sorted.forEach(function (row, i) {
      var rank = i + 1;
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="rank-cell">' + rank + "</td>" +
        '<td class="name-cell">' +
        '<a href="' + THEME.siteUrl + "/#" + slugify(row.name) + '" target="_blank" rel="noopener">' + escapeHtml(row.name) + "</a>" +
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
    var ths = document.querySelectorAll("#peLeaderboard thead th[data-sort]");
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
    var headerRow = document.querySelector("#peLeaderboard thead tr");
    var ths = headerRow.querySelectorAll("th");

    // Name column sort
    ths[1].setAttribute("data-sort", "name");
    var nameArrow = document.createElement("span");
    nameArrow.className = "sort-arrow";
    ths[1].appendChild(nameArrow);
    ths[1].style.cursor = "pointer";

    // Numeric columns
    columns.forEach(function (col, i) {
      var th = ths[i + 2];
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

  // Compute post-event deltas from snapshots
  function computeDeltas(snapshots) {
    if (!THEME.eventEndDate || snapshots.length < 2) return null;

    var endDate = THEME.eventEndDate;

    // Find baseline: last snapshot on or before eventEndDate
    var baseline = null;
    for (var i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].date <= endDate) {
        baseline = snapshots[i];
        break;
      }
    }

    // Latest snapshot
    var latest = snapshots[snapshots.length - 1];

    // If latest IS the baseline (no post-event snapshots yet), nothing to show
    if (!baseline || latest.date <= endDate) return null;

    var baseDetail = baseline.data.detail || {};
    var latestDetail = latest.data.detail || {};
    var baseUpvotes = baseline.data.upvotes || {};
    var latestUpvotes = latest.data.upvotes || {};

    // Compute deltas per restaurant
    var delta = {};
    var allNames = {};
    Object.keys(latestDetail).forEach(function (n) { allNames[n] = 1; });

    Object.keys(allNames).forEach(function (name) {
      var ld = latestDetail[name] || {};
      var bd = baseDetail[name] || {};

      // Only include restaurant entries
      if (!isRestaurant(name, ld)) return;

      var d = {};
      Object.keys(ld).forEach(function (action) {
        var diff = (ld[action] || 0) - (bd[action] || 0);
        if (diff > 0) d[action] = diff;
      });

      // Check if there's any post-event activity
      var hasActivity = Object.keys(d).some(function (k) { return d[k] > 0; });
      if (hasActivity) delta[name] = d;
    });

    return {
      delta: delta,
      baselineDate: baseline.date,
      latestDate: latest.date,
    };
  }

  function render(result) {
    if (!result) {
      document.getElementById("peDateRange").textContent = "No post-event data available yet.";
      document.getElementById("peFooterNote").textContent =
        "Post-event snapshots will appear once the daily snapshot runs after the event ends.";
      return;
    }

    var data = result.delta;
    var dateRange = document.getElementById("peDateRange");
    dateRange.textContent = "Showing activity from " + formatDate(result.baselineDate) + " to " + formatDate(result.latestDate);

    var totalViews = 0;
    var totalDirApple = 0;
    var totalDirGoogle = 0;
    var totalWebsite = 0;
    var totalPhone = 0;
    var totalInstagram = 0;
    var totalShares = 0;
    var totalDeeplinks = 0;
    var totalLikes = 0;

    var rows = [];
    Object.keys(data).forEach(function (name) {
      var d = data[name];

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

    document.getElementById("peViews").textContent = totalViews.toLocaleString();
    document.getElementById("peDirApple").textContent = totalDirApple.toLocaleString();
    document.getElementById("peDirGoogle").textContent = totalDirGoogle.toLocaleString();
    document.getElementById("peWebsite").textContent = totalWebsite.toLocaleString();
    document.getElementById("pePhone").textContent = totalPhone.toLocaleString();
    document.getElementById("peInstagram").textContent = totalInstagram.toLocaleString();
    document.getElementById("peShares").textContent = totalShares.toLocaleString();
    document.getElementById("peDeeplinks").textContent = totalDeeplinks.toLocaleString();
    document.getElementById("peLikes").textContent = totalLikes.toLocaleString();

    renderTable();

    var note = document.getElementById("peFooterNote");
    if (rows.length > 0) {
      note.textContent = "Updated daily via tracking snapshots.";
    } else {
      note.textContent = "No post-event activity recorded yet.";
    }
  }

  // Load and compute
  StatsUtils.fetchAllSnapshots().then(function (snapshots) {
    var result = computeDeltas(snapshots);
    render(result);
  });
})();
