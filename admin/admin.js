(function () {
  var authCard = document.getElementById("authCard");
  var authForm = document.getElementById("authForm");
  var authError = document.getElementById("authError");
  var tokenInput = document.getElementById("tokenInput");
  var dataView = document.getElementById("dataView");
  var tableBody = document.getElementById("tableBody");
  var totalCount = document.getElementById("totalCount");
  var pageTitle = document.getElementById("pageTitle");

  pageTitle.textContent = THEME.eventName;

  function fetchData(token) {
    if (!THEME.trackUrl) return;

    var url = THEME.trackUrl + "?admin=true&token=" + encodeURIComponent(token);

    fetch(url)
      .then(function (resp) {
        if (resp.status === 403) {
          authError.style.display = "block";
          tokenInput.value = "";
          tokenInput.focus();
          sessionStorage.removeItem("adminToken");
          authCard.style.display = "";
          dataView.style.display = "none";
          return null;
        }
        return resp.json();
      })
      .then(function (data) {
        if (!data) return;

        sessionStorage.setItem("adminToken", token);
        authCard.style.display = "none";
        authError.style.display = "none";
        dataView.style.display = "block";

        var total = 0;
        var html = "";
        data.forEach(function (row, i) {
          total += row.count;
          html +=
            "<tr>" +
            '<td class="col-rank">' +
            (i + 1) +
            "</td>" +
            "<td>" +
            escapeHtml(row.query) +
            "</td>" +
            '<td class="col-count">' +
            row.count.toLocaleString() +
            "</td>" +
            "</tr>";
        });
        tableBody.innerHTML = html;
        totalCount.textContent = total.toLocaleString();

        fetchAuxStats();
      })
      .catch(function () {
        authError.textContent = "Network error. Try again.";
        authError.style.display = "block";
      });
  }

  // Auxiliary admin breakdowns pulled from the public aggregate: screen widths
  // (viewport buckets) and traffic sources (the ?src= tag on inbound links).
  function fetchAuxStats() {
    if (!THEME.trackUrl) return;
    fetch(THEME.trackUrl + "?detail=true")
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (data) {
        if (!data) return;
        renderViewports(data);
        renderSources(data);
        renderRanked(data, "user-area", "uaTitle", "uaTable", "uaBody", "uaNote");
        renderRanked(data, "geo-view", "gvTitle", "gvTable", "gvBody", "gvNote");
        renderDrawer(data);
        // Which filters people actually use (by label).
        renderRanked(data, "filter-area", "faTitle", "faTable", "faBody", "faNote");
        renderRanked(data, "filter-tag", "ftTitle", "ftTable", "ftBody", "ftNote", tagLabel);
        renderRanked(data, "filter-hours", "fhTitle", "fhTable", "fhBody", "fhNote", hoursLabel);
        // Sharing & word of mouth.
        renderRanked(data, "share", "shareTitle", "shareTable", "shareBody", "shareNote");
        renderRanked(data, "deeplink", "dlTitle", "dlTable", "dlBody", "dlNote");
        renderEmptySearches(data);
      })
      .catch(function () {});
  }

  // Sum an action's counts across all aggregate entries.
  function sumByAction(data, action) {
    var counts = {};
    var total = 0;
    Object.keys(data).forEach(function (name) {
      var v = data[name] && data[name][action];
      if (v) {
        counts[name] = (counts[name] || 0) + v;
        total += v;
      }
    });
    return { counts: counts, total: total };
  }

  // Render rows of label / count / share into a table body.
  function renderRows(bodyId, keys, counts, total, decorate) {
    document.getElementById(bodyId).innerHTML = keys
      .map(function (k) {
        var c = counts[k];
        var share = total > 0 ? Math.round((c / total) * 100) + "%" : "0%";
        var d = decorate ? decorate(k) : { label: k, cls: "" };
        return (
          "<tr" + (d.cls ? ' class="' + d.cls + '"' : "") + ">" +
          "<td>" + escapeHtml(d.label) + "</td>" +
          '<td class="col-count">' + c.toLocaleString() + "</td>" +
          '<td class="col-count">' + share + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function show(ids) {
    ids.forEach(function (id) { document.getElementById(id).style.display = ""; });
  }

  // Filter-key → human label, from the theme config.
  var __tagLabels = {};
  (THEME.tagFilters || []).forEach(function (t) { __tagLabels[t.key] = t.label; });
  function tagLabel(k) { return __tagLabels[k] || k; }
  var __hoursLabels = {};
  (THEME.hoursFilters || []).forEach(function (h) { __hoursLabels[h.key] = h.label; });
  function hoursLabel(k) { return __hoursLabels[k] || k; }

  // Render a count-ranked table for an action, hidden until it has data.
  function renderRanked(data, action, titleId, tableId, bodyId, noteId, labelOf) {
    var r = sumByAction(data, action);
    if (r.total === 0) return;
    var keys = Object.keys(r.counts).sort(function (a, b) {
      return r.counts[b] - r.counts[a];
    });
    renderRows(bodyId, keys, r.counts, r.total, labelOf
      ? function (k) { return { label: labelOf(k), cls: "" }; }
      : null);
    show([titleId, tableId, noteId]);
  }

  function renderViewports(data) {
    var ORDER = ["<400", "400-599", "600-767", "768-1023", "1024-1439", "1440+"];
    var LABELS = {
      "<400": "≤ 399px — small phone",
      "400-599": "400–599px — phone",
      "600-767": "600–767px — large phone",
      "768-1023": "768–1023px — tablet",
      "1024-1439": "1024–1439px — laptop",
      "1440+": "1440px+ — desktop",
    };
    var MOBILE = { "<400": 1, "400-599": 1, "600-767": 1 };

    var r = sumByAction(data, "viewport");
    if (r.total === 0) return;
    var keys = ORDER.filter(function (k) { return r.counts[k]; });
    Object.keys(r.counts).forEach(function (k) {
      if (ORDER.indexOf(k) === -1) keys.push(k);
    });
    renderRows("viewportBody", keys, r.counts, r.total, function (k) {
      return { label: (LABELS[k] || k) + (MOBILE[k] ? " 📱" : ""), cls: MOBILE[k] ? "vp-mobile" : "" };
    });
    document.getElementById("viewportTotal").textContent = r.total.toLocaleString();
    show(["viewportTitle", "viewportTotalRow", "viewportTable", "viewportNote"]);
  }

  function renderSources(data) {
    var r = sumByAction(data, "source");
    if (r.total === 0) return;
    var keys = Object.keys(r.counts).sort(function (a, b) { return r.counts[b] - r.counts[a]; });
    renderRows("sourceBody", keys, r.counts, r.total);
    document.getElementById("sourceTotal").textContent = r.total.toLocaleString();
    show(["sourceTitle", "sourceTotalRow", "sourceTable", "sourceNote"]);
  }

  function renderDrawer(data) {
    var ORDER = ["half", "full"];
    var LABELS = { half: "Expanded to half", full: "Expanded to full" };
    var r = sumByAction(data, "drawer-expand");
    if (r.total === 0) return;
    var keys = ORDER.filter(function (k) { return r.counts[k]; });
    Object.keys(r.counts).forEach(function (k) {
      if (ORDER.indexOf(k) === -1) keys.push(k);
    });
    renderRows("drawerBody", keys, r.counts, r.total, function (k) {
      return { label: LABELS[k] || k, cls: "" };
    });
    document.getElementById("drawerTotal").textContent = r.total.toLocaleString();
    show(["drawerTitle", "drawerTotalRow", "drawerTable", "drawerNote"]);
  }

  function renderEmptySearches(data) {
    var r = sumByAction(data, "search-empty");
    if (r.total === 0) return;
    var keys = Object.keys(r.counts).sort(function (a, b) { return r.counts[b] - r.counts[a]; });
    renderRows("emptyBody", keys, r.counts, r.total);
    document.getElementById("emptyTotal").textContent = r.total.toLocaleString();
    show(["emptyTitle", "emptyTotalRow", "emptyTable", "emptyNote"]);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  authForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var token = tokenInput.value.trim();
    if (!token) return;
    authError.style.display = "none";
    fetchData(token);
  });

  // Auto-fetch if token in sessionStorage
  var saved = sessionStorage.getItem("adminToken");
  if (saved) {
    fetchData(saved);
  }
})();
