// Shared utilities for stats dashboard tabs
var StatsUtils = (function () {
  "use strict";

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function isRestaurant(name, d) {
    return !!(d.view || d["sidebar-view"] || d["directions-apple"] || d["directions-google"] || d.website || d.phone);
  }

  function formatDate(ds) {
    var parts = ds.split("-");
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[parseInt(parts[1], 10) - 1] + " " + parseInt(parts[2], 10);
  }

  // Build area lookup from restaurant data
  function buildAreaByName() {
    var map = {};
    if (typeof restaurants !== "undefined") {
      restaurants.forEach(function (r) {
        map[r.name] = r.area;
      });
    }
    return map;
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(ds, n) {
    var d = new Date(ds + "T00:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Resolve the active stats date range from the ?range= URL param.
  // Presets: "all" (default) | "event" | "pre". Returns concrete
  // { preset, start, end } so the worker query, snapshot fetch, and hourly
  // filter all window identically. "all" spans data-live → today, which is
  // every day we have collected data.
  function getActiveRange() {
    var preset = "all";
    try {
      var p = new URLSearchParams(window.location.search).get("range");
      if (p === "event" || p === "pre" || p === "all") preset = p;
    } catch (e) {}
    var live = THEME.dataLiveDate || THEME.eventStartDate || todayStr();
    var start = live;
    var end = todayStr();
    if (preset === "event") {
      start = THEME.eventStartDate || live;
      end = THEME.eventEndDate || todayStr();
    } else if (preset === "pre") {
      start = live;
      end = THEME.eventStartDate ? addDays(THEME.eventStartDate, -1) : todayStr();
    }
    return { preset: preset, start: start, end: end };
  }

  // Filter hourly data keys to a date range (defaults to the active range).
  // End is inclusive through +1 day 6am to allow late-night spillover.
  function filterHourlyToEvent(hourlyData, range) {
    if (!hourlyData) return hourlyData;
    range = range || getActiveRange();
    if (!range.start && !range.end) return hourlyData;
    var start = range.start ? new Date(range.start + "T00:00:00") : null;
    var end = null;
    if (range.end) {
      end = new Date(range.end + "T00:00:00");
      end.setDate(end.getDate() + 1);
      end.setHours(6, 0, 0, 0);
    }
    var filtered = {};
    Object.keys(hourlyData).forEach(function (key) {
      var d = new Date(key.replace(" ", "T"));
      if ((!start || d >= start) && (!end || d <= end)) {
        filtered[key] = hourlyData[key];
      }
    });
    return filtered;
  }

  // Fetch all daily snapshots within a date range (defaults to active range).
  function fetchAllSnapshots(basePath, range) {
    basePath = basePath || "../snapshots/";
    range = range || getActiveRange();
    var startStr = range.start || THEME.dataLiveDate || THEME.eventStartDate;
    var today = new Date();
    var endCap = today;
    if (range.end) {
      var rangeEnd = new Date(range.end + "T00:00:00");
      rangeEnd.setDate(rangeEnd.getDate() + 1);
      if (rangeEnd < today) endCap = rangeEnd;
    }
    var dates = [];
    for (var d = new Date(startStr + "T00:00:00"); d <= endCap; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }

    var fetches = dates.map(function (ds) {
      return fetch(basePath + "tracking-" + ds + ".json")
        .then(function (r) {
          return r.ok ? r.json().then(function (j) { return { date: ds, data: j }; }) : null;
        })
        .catch(function () { return null; });
    });

    return Promise.all(fetches).then(function (results) {
      return results
        .filter(function (r) { return r && r.data && r.data.detail; })
        .sort(function (a, b) { return a.date.localeCompare(b.date); });
    });
  }

  return {
    slugify: slugify,
    escapeHtml: escapeHtml,
    isRestaurant: isRestaurant,
    formatDate: formatDate,
    buildAreaByName: buildAreaByName,
    fetchAllSnapshots: fetchAllSnapshots,
    filterHourlyToEvent: filterHourlyToEvent,
    getActiveRange: getActiveRange,
  };
})();
