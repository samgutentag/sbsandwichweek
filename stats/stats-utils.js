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

  // Today's date on the event's clock (en-CA locale formats as YYYY-MM-DD)
  function todayStr() {
    try {
      return new Date().toLocaleDateString("en-CA", { timeZone: THEME.timeZone });
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  // Pure date-string arithmetic — pinned to UTC so the viewer's timezone
  // can't shift the result across a day boundary
  function addDays(ds, n) {
    var d = new Date(ds + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
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
      if (p === "event" || p === "pre" || p === "post" || p === "all") preset = p;
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
    } else if (preset === "post") {
      start = THEME.eventEndDate ? addDays(THEME.eventEndDate, 1) : live;
      end = todayStr();
    }
    return { preset: preset, start: start, end: end };
  }

  // Filter hourly data keys to a date range (defaults to the active range).
  // End is inclusive through +1 day 6am to allow late-night spillover.
  function filterHourlyToEvent(hourlyData, range) {
    if (!hourlyData) return hourlyData;
    range = range || getActiveRange();
    if (!range.start && !range.end) return hourlyData;
    // Range bounds are event-timezone days; hourly keys from the worker are UTC
    var start = range.start ? eventDate(range.start, "00:00:00") : null;
    var end = range.end ? eventDate(addDays(range.end, 1), "06:00:00") : null;
    var filtered = {};
    Object.keys(hourlyData).forEach(function (key) {
      var d = new Date(key.replace(" ", "T") + "Z");
      if ((!start || d >= start) && (!end || d <= end)) {
        filtered[key] = hourlyData[key];
      }
    });
    return filtered;
  }

  // Fetch all daily snapshots within a date range (defaults to active range).
  // Snapshot files are named with the UTC date, so iterate UTC date strings
  // (not local Date objects) and add a one-day buffer — otherwise a behind-UTC
  // timezone misses the current day's snapshot.
  function fetchAllSnapshots(basePath, range) {
    basePath = basePath || "../snapshots/";
    range = range || getActiveRange();
    var startStr = range.start || THEME.dataLiveDate || THEME.eventStartDate;
    var todayUTC = todayStr();
    var endStr = range.end && range.end < todayUTC ? range.end : todayUTC;
    endStr = addDays(endStr, 1); // buffer for UTC/local boundary
    var dates = [];
    var d = startStr;
    var guard = 0;
    while (d <= endStr && guard < 400) {
      dates.push(d);
      d = addDays(d, 1);
      guard++;
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
