// Food Week Map — Main Application

(function () {
  "use strict";

  // ── Apply theme to header + about modal ────────────
  var headerTitle = document.getElementById("headerTitle");
  if (headerTitle) {
    headerTitle.innerHTML =
      THEME.eventName + " <span>| " + THEME.eventDates + "</span>";
  }
  var aboutTitle = document.getElementById("aboutTitle");
  if (aboutTitle) aboutTitle.textContent = THEME.eventName;
  var aboutDates = document.getElementById("aboutDates");
  if (aboutDates) aboutDates.textContent = THEME.eventDates;
  var aboutSource = document.getElementById("aboutSource");
  if (aboutSource) {
    aboutSource.href = THEME.sourceUrl;
  }
  var aboutEmbed = document.getElementById("aboutEmbed");
  if (aboutEmbed) aboutEmbed.href = THEME.siteUrl + "/embed";
  var aboutStats = document.getElementById("aboutStats");
  if (aboutStats) aboutStats.href = THEME.siteUrl + "/stats";
  var aboutVenmo = document.getElementById("aboutVenmo");
  if (aboutVenmo) {
    aboutVenmo.href = "#";
    aboutVenmo.addEventListener("click", function (e) {
      e.preventDefault();
      var aboutOverlay = document.getElementById("aboutOverlay");
      if (aboutOverlay) aboutOverlay.classList.remove("open");
      var tipJarOverlay = document.getElementById("tipJarOverlay");
      if (tipJarOverlay) tipJarOverlay.classList.add("open");
    });
  }
  var aboutContact = document.getElementById("aboutContact");
  if (aboutContact && THEME.contactDomain) {
    var year =
      (THEME.dataLiveDate || "").slice(0, 4) || new Date().getFullYear();
    var contactEmail =
      "sb" + THEME.itemLabel + "week" + year + "@" + THEME.contactDomain;
    aboutContact.href = "mailto:" + contactEmail;
  } else if (aboutContact) {
    aboutContact.style.display = "none";
  }

  // ── About modal ───────────────────────────────────
  var aboutOverlay = document.getElementById("aboutOverlay");
  var aboutLink = document.getElementById("aboutLink");
  var aboutClose = document.getElementById("aboutClose");

  aboutLink.addEventListener("click", function (e) {
    e.preventDefault();
    aboutOverlay.classList.add("open");
  });

  aboutClose.addEventListener("click", function () {
    aboutOverlay.classList.remove("open");
  });

  aboutOverlay.addEventListener("click", function (e) {
    if (e.target === aboutOverlay) {
      aboutOverlay.classList.remove("open");
    }
  });

  // ── Shared DOM refs + drawer state ────────────
  var sidebar = document.getElementById("sidebar");
  var PEEK_HEIGHT = 105;
  var drawerStops = [];
  var currentStop = 0;

  // ── Map setup ──────────────────────────────────

  const map = L.map("map", {
    zoomControl: true,
    attributionControl: true,
  }).setView(THEME.mapCenter, THEME.mapZoom);

  // On mobile, offset the target so the marker sits in the lower third of the
  // visible map area — this keeps the popup (which opens above) from hiding
  // behind the top-right controls.
  function mobileOffsetLatLng(lat, lng, zoom) {
    if (window.innerWidth > 768) return [lat, lng];
    var mapHeight = map.getSize().y;
    // Shift target up by 30% of visible height so marker lands lower on screen
    var offsetPx = mapHeight * 0.3;
    var point = map.project([lat, lng], zoom);
    point.y -= offsetPx;
    var shifted = map.unproject(point, zoom);
    return [shifted.lat, shifted.lng];
  }

  // Place a pin in the visible strip above the detail sheet (sheet covers the
  // bottom ~58%, so pull the marker up into the top ~28% of the map).
  function sheetOffsetLatLng(lat, lng, zoom) {
    var mapHeight = map.getSize().y;
    var point = map.project([lat, lng], zoom);
    point.y += mapHeight * 0.28;
    var shifted = map.unproject(point, zoom);
    return [shifted.lat, shifted.lng];
  }

  var tileLayer = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 20,
      subdomains: "abcd",
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  ).addTo(map);

  // ── Marker cluster group ───────────────────────

  const clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 30,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyDistanceMultiplier: 1.5,
  });

  // ── Build markers ──────────────────────────────

  const markerMap = new Map(); // restaurant name → marker

  // ── Checklist state ─────────────────────────────
  var checklistMode = false;
  var checkedSet = new Set();
  var STORAGE_KEY = THEME.storageKey;

  function loadChecklist() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        JSON.parse(saved).forEach(function (n) {
          checkedSet.add(n);
        });
      } else {
        // Default: all checked
        restaurants.forEach(function (r) {
          checkedSet.add(r.name);
        });
      }
    } catch (e) {
      restaurants.forEach(function (r) {
        checkedSet.add(r.name);
      });
    }
  }

  function saveChecklist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(checkedSet)));
    } catch (e) {
      // ignore
    }
  }

  loadChecklist();

  // ── Upvote state ──────────────────────────────
  var upvotedSet = new Set();
  var UPVOTE_KEY = THEME.storageKey + "-upvotes";
  var upvoteCounts = {};

  function loadUpvotes() {
    try {
      var saved = localStorage.getItem(UPVOTE_KEY);
      if (saved) {
        JSON.parse(saved).forEach(function (n) {
          upvotedSet.add(n);
        });
      }
    } catch (e) {
      // ignore
    }
  }

  function saveUpvotes() {
    try {
      localStorage.setItem(UPVOTE_KEY, JSON.stringify(Array.from(upvotedSet)));
    } catch (e) {
      // ignore
    }
  }

  loadUpvotes();

  // Load upvote counts from snapshot or live API
  if (typeof TRACKING_SNAPSHOT !== "undefined" && TRACKING_SNAPSHOT.upvotes) {
    upvoteCounts = TRACKING_SNAPSHOT.upvotes;
    setTimeout(function () {
      refreshSidebarUpvoteBadges();
      refreshOpenPopupUpvote();
    }, 0);
  } else if (THEME.trackUrl) {
    fetch(THEME.trackUrl + "?upvotes=true", { method: "GET" })
      .then(function (resp) {
        return resp.json();
      })
      .then(function (data) {
        if (data && typeof data === "object") {
          var valid = {};
          Object.keys(data).forEach(function (k) {
            if (typeof data[k] === "number") valid[k] = data[k];
          });
          upvoteCounts = valid;
          refreshSidebarUpvoteBadges();
          refreshOpenPopupUpvote();
        }
      })
      .catch(function () {
        /* silently ignore */
      });
  }

  // ── Event lifecycle state ────────────────────
  var __eventState = getEventState();
  var __showUpvotes = __eventState !== "off-season";
  var __canVote = canCastVotes();

  // The header "recent" chip is driven by the live eyes layer below (it shows
  // the number of restaurants with eyes on the map), so the tile and the map
  // always agree. See updateRecentChip().

  // ── Hours data ─────────────────────────────
  var hoursData = {};
  var hoursLoaded = false;
  var activeHoursFilter = null; // "open", "lunch", or "dinner"

  if (__eventState === "pre-event" || __eventState === "during")
  fetch("hours.json")
    .then(function (resp) {
      if (!resp.ok) throw new Error("not found");
      return resp.json();
    })
    .then(function (data) {
      if (data && typeof data === "object") {
        hoursData = data;
        hoursLoaded = true;
        // Show hours filter buttons
        var hf = document.getElementById("hoursFilters");
        if (hf) hf.style.display = "grid";
        renderList();
      }
    })
    .catch(function () {
      /* silently ignore — filters stay hidden, no hours in UI */
    });

  function isOpenNow(name) {
    var entry = hoursData[name];
    if (!entry || !entry.periods) return null;
    var now = new Date();
    var day = now.getDay(); // 0=Sun
    var hhmm =
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0");
    var timeNum = parseInt(hhmm, 10);
    for (var i = 0; i < entry.periods.length; i++) {
      var p = entry.periods[i];
      if (p.day === day && timeNum >= parseInt(p.open, 10) && timeNum <= parseInt(p.close, 10)) {
        return true;
      }
    }
    return false;
  }

  function getOpenStatus(name) {
    // Returns "open", "closing-soon", "closed", or null
    var entry = hoursData[name];
    if (!entry || !entry.periods) return null;
    var now = new Date();
    var day = now.getDay();
    var hhmm =
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0");
    var timeNum = parseInt(hhmm, 10);
    for (var i = 0; i < entry.periods.length; i++) {
      var p = entry.periods[i];
      if (p.day === day && timeNum >= parseInt(p.open, 10) && timeNum <= parseInt(p.close, 10)) {
        var closeNum = parseInt(p.close, 10);
        var effectiveCloseMinutes = Math.floor(closeNum / 100) * 60 + (closeNum % 100);
        // If period ends at midnight, check for next-day continuation
        if (p.close === "2359") {
          var nextDay = (day + 1) % 7;
          for (var j = 0; j < entry.periods.length; j++) {
            var np = entry.periods[j];
            if (np.day === nextDay && np.open === "0000") {
              var nextClose = parseInt(np.close, 10);
              effectiveCloseMinutes += Math.floor(nextClose / 100) * 60 + (nextClose % 100);
              break;
            }
          }
        }
        var nowMinutes = Math.floor(timeNum / 100) * 60 + (timeNum % 100);
        if (effectiveCloseMinutes - nowMinutes <= 60) return "closing-soon";
        return "open";
      }
    }
    // Check if we're in a next-day continuation period (e.g., 12am–1am from previous day)
    var prevDay = (day + 6) % 7;
    for (var i = 0; i < entry.periods.length; i++) {
      var p = entry.periods[i];
      if (p.day === day && p.open === "0000") {
        for (var j = 0; j < entry.periods.length; j++) {
          if (entry.periods[j].day === prevDay && entry.periods[j].close === "2359") {
            if (timeNum <= parseInt(p.close, 10)) {
              var closeMinutes = Math.floor(parseInt(p.close, 10) / 100) * 60 + (parseInt(p.close, 10) % 100);
              var nowMinutes = Math.floor(timeNum / 100) * 60 + (timeNum % 100);
              if (closeMinutes - nowMinutes <= 60) return "closing-soon";
              return "open";
            }
            break;
          }
        }
      }
    }
    return "closed";
  }

  function getNextOpenTime(name) {
    var entry = hoursData[name];
    if (!entry || !entry.periods) return null;
    var now = new Date();
    var day = now.getDay();
    var hhmm =
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0");
    var timeNum = parseInt(hhmm, 10);

    // Check for a later period today
    for (var i = 0; i < entry.periods.length; i++) {
      var p = entry.periods[i];
      if (p.day === day && parseInt(p.open, 10) > timeNum) {
        return formatTime(p.open);
      }
    }

    // Check tomorrow and beyond (up to 7 days)
    for (var d = 1; d <= 7; d++) {
      var checkDay = (day + d) % 7;
      for (var j = 0; j < entry.periods.length; j++) {
        var p2 = entry.periods[j];
        if (p2.day === checkDay) {
          var dayLabel = d === 1 ? "tomorrow" : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][checkDay];
          return dayLabel + " " + formatTime(p2.open);
        }
      }
    }
    return null;
  }

  function formatTime(hhmm) {
    if (hhmm === "2359") return "midnight";
    var h = parseInt(hhmm.substring(0, 2), 10);
    var m = hhmm.substring(2);
    var suffix = h >= 12 ? "pm" : "am";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return m === "00" ? h + suffix : h + ":" + m + suffix;
  }

  function formatTodayHours(name) {
    var entry = hoursData[name];
    if (!entry || !entry.periods) return "Closed today";
    var day = new Date().getDay();
    var nextDay = (day + 1) % 7;

    // Get today's periods
    var todayPeriods = entry.periods.filter(function (p) {
      return p.day === day;
    });
    if (todayPeriods.length === 0) return "Closed today";

    // Build display ranges, merging midnight spans
    var ranges = [];
    for (var i = 0; i < todayPeriods.length; i++) {
      var p = todayPeriods[i];
      // Skip early-morning carryover periods (e.g. 12am–1am from previous night)
      // if there's also a main period today — they'll be shown as the tail of that period
      if (p.open === "0000" && p.close !== "2359" && todayPeriods.length > 1) {
        continue;
      }

      var closeTime = p.close;

      // If this period ends at midnight, check if it continues into next day
      if (p.close === "2359") {
        var nextDayCarryover = entry.periods.filter(function (np) {
          return np.day === nextDay && np.open === "0000" && np.close !== "2359";
        });
        if (nextDayCarryover.length > 0) {
          closeTime = nextDayCarryover[0].close;
        }
      }

      ranges.push(formatTime(p.open) + "–" + formatTime(closeTime));
    }

    return ranges.length > 0 ? ranges.join(", ") : "Closed today";
  }

  // Dietary tag icon helper
  var tagDefs = THEME.tagFilters || [];

  function getDietaryIconsHtml(r) {
    var html = "";
    tagDefs.forEach(function (t) {
      if (r[t.key]) {
        html +=
          '<img src="' +
          t.icon +
          '" alt="' +
          t.label +
          '" title="' +
          t.label +
          '" class="dietary-icon">';
      }
    });
    return html;
  }

  // Returning-restaurant badge: shows for 2+ years of participation (first-timers get nothing).
  function getReturningBadgeHtml(r) {
    var hist = THEME.firstYearByName || {};
    // strip any " (Location)" suffix so split multi-location pins still match
    var base = r.name.replace(/\s*\([^)]*\)\s*$/, "");
    var first = hist[base];
    if (!first || !THEME.eventYear) return "";
    var years = THEME.eventYear - first + 1;
    if (years < 2) return "";
    var s = ["th", "st", "nd", "rd"], v = years % 100;
    var ord = years + (s[(v - 20) % 10] || s[v] || s[0]);
    return (
      '<span class="returning-badge" title="' +
      escapeHtml(THEME.eventName + " since " + first) +
      '">' + THEME.emoji + " " + ord + " year</span>"
    );
  }

  function createDietaryIconEls(r) {
    var frag = document.createDocumentFragment();
    tagDefs.forEach(function (t) {
      if (r[t.key]) {
        var img = document.createElement("img");
        img.src = t.icon;
        img.alt = t.label;
        img.title = t.label;
        img.className = "dietary-icon";
        frag.appendChild(img);
      }
    });
    return frag;
  }

  restaurants.forEach(function (r) {
    const color = AREA_COLORS[r.area] || "#999";

    const marker = L.circleMarker([r.lat, r.lng], {
      radius: 9,
      fillColor: color,
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85,
    });

    var appleMapsUrl =
      r.appleMapsUrl ||
      "https://maps.apple.com/?daddr=" + encodeURIComponent(r.address);

    var popupHtml =
      '<div class="popup-content">' +
      '<div class="popup-accent" style="background:' +
      color +
      '"></div>';
    var isUpvoted = upvotedSet.has(r.name);
    var upvoteCount = upvoteCounts[r.name] || 0;
    var dietaryHtml = getDietaryIconsHtml(r);
    popupHtml +=
      '<div class="popup-section popup-section-name">' +
      "<h3>" +
      escapeHtml(r.name) +
      (dietaryHtml
        ? '<span class="dietary-tags">' + dietaryHtml + "</span>"
        : "") +
      "</h3>" +
      getReturningBadgeHtml(r) +
      "</div>";
    popupHtml += '<div class="popup-section popup-section-menu">';
    if (r.menuItems.length > 0)
      r.menuItems.forEach(function (item) {
        popupHtml +=
          '<p class="popup-item">' +
          THEME.emoji +
          " " +
          escapeHtml(item.name) +
          "</p>";
        if (item.description)
          popupHtml +=
            '<p class="popup-description"><em>' +
            escapeHtml(item.description) +
            "</em></p>";
        else
          popupHtml +=
            '<p class="popup-coming-soon">More details coming soon!</p>';
      });
    else popupHtml += '<p class="popup-coming-soon">Details coming soon!</p>';
    popupHtml += "</div>";
    // Hours line in popup (rendered dynamically, populated after hoursData loads)
    popupHtml += '<div class="popup-hours" data-hours-name="' + escapeHtml(r.name) + '"></div>';

    var shareUrl = THEME.siteUrl + "/?src=share#" + slugify(r.name);
    popupHtml +=
      '<div class="popup-section popup-section-directions">' +
      '<div class="popup-section-heading">Address</div>' +
      '<div class="popup-address-row">' +
      '<svg class="popup-pin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
      "<span>" +
      escapeHtml(r.address) +
      "</span>" +
      (__showUpvotes
        ? '<button class="upvote-btn popup-upvote' +
          (isUpvoted ? " upvoted" : "") +
          (upvoteCount === 0 ? " zero" : "") +
          (!__canVote ? " frozen" : "") +
          '" data-name="' +
          escapeHtml(r.name) +
          '">' +
          '<span class="upvote-heart">\uD83D\uDC4D</span>' +
          (upvoteCount > 0
            ? '<span class="upvote-count">' + upvoteCount + "</span>"
            : "") +
          "</button>"
        : "") +
      "</div>" +
      '<div class="popup-directions-btns">' +
      '<a href="' +
      appleMapsUrl +
      '" target="_blank" rel="noopener" class="popup-dir-btn" title="Apple Maps">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>' +
      " Apple Maps</a>" +
      '<a href="' +
      r.mapUrl +
      '" target="_blank" rel="noopener" class="popup-dir-btn" title="Google Maps">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>' +
      " Google Maps</a>" +
      "</div>";
    if (r.website || r.instagram || r.phone) {
      popupHtml += '<div class="popup-directions-btns" style="margin-top:4px">';
      if (r.website)
        popupHtml +=
          '<a href="' +
          r.website +
          '" target="_blank" rel="noopener" class="popup-dir-btn" title="Website">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>' +
          '<span class="dir-label"> Website</span></a>';
      if (r.instagram)
        popupHtml +=
          '<a href="https://instagram.com/' +
          encodeURIComponent(r.instagram) +
          '" target="_blank" rel="noopener" class="popup-dir-btn" title="Instagram">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>' +
          '<span class="dir-label"> Instagram</span></a>';
      if (r.phone)
        popupHtml +=
          '<a href="tel:' +
          r.phone +
          '" class="popup-dir-btn" title="' +
          escapeHtml(r.phone) +
          '">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>' +
          '<span class="dir-label"> Call</span></a>';
      popupHtml += "</div>";
    }
    popupHtml += "</div>";
    popupHtml +=
      '<a href="#" class="popup-share-btn share-link" data-url="' +
      escapeHtml(shareUrl) +
      '" data-name="' +
      escapeHtml(r.name) +
      '" title="Share link">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
      "<span>Share this spot</span></a>";
    popupHtml += "</div>";

    // Stash the detail markup so the mobile sheet can reuse it verbatim.
    marker._detailHtml = popupHtml;

    if (window.innerWidth <= 768) {
      // Mobile: tap raises the half-height detail sheet; map stays visible.
      marker.on("click", function () {
        openDetailSheet(r, "map");
      });
    } else {
      marker.bindPopup(popupHtml, {
        maxWidth: 360,
        offset: [0, -4],
        closeButton: false,
      });
      // Show popup and emoji overlay on hover
      marker.on("mouseover", function () {
        showEmojiOverlay([r.lat, r.lng]);
        this.openPopup();
      });
    }

    clusterGroup.addLayer(marker);
    markerMap.set(r.name, marker);
  });

  map.addLayer(clusterGroup);

  // ── Live "eyes" layer — who's looking at each restaurant ───────
  // A 10-minute sliding window of recent views per restaurant, shown as a
  // pulsing 👀 badge over the pin (each new view keeps it alive another 10
  // min). On dev hosts (LAN testing) it runs off a local simulation fed by
  // your own taps plus a little ambient activity, since LAN views aren't
  // logged. On prod it polls the worker's ?eyes=true endpoint.
  var eyesLayer = L.layerGroup().addTo(map);
  var __eyesDevHost = typeof isDevHost === "function" && isDevHost(location.hostname);
  var EYES_WINDOW_MS = 10 * 60 * 1000;
  var simViews = {}; // name -> [timestamps], dev simulation only

  var lastEyeCounts = {};
  function renderEyes(counts) {
    if (counts) lastEyeCounts = counts;
    counts = lastEyeCounts;
    eyesLayer.clearLayers();
    var totalViews = 0; // a view = a person looking; sum is the "recent" count
    var placed = {}; // one eye per visible cluster/pin, so eyes cluster with pins
    Object.keys(counts).forEach(function (name) {
      var c = counts[name];
      if (!c) return;
      var marker = markerMap.get(name);
      if (!marker) return;
      totalViews += c;
      // Pin the eye to whatever's actually visible — the marker if unclustered,
      // or its cluster if it's bundled — and only one eye per visible thing.
      var visible = clusterGroup.getVisibleParent(marker);
      if (!visible) return;
      var id = L.Util.stamp(visible);
      if (placed[id]) return;
      placed[id] = true;
      var icon = L.divIcon({
        className: "eye-badge-wrap",
        html: '<span class="eye-badge">👀</span>',
        iconSize: [0, 0],
        iconAnchor: [0, 24],
      });
      L.marker(visible.getLatLng(), {
        icon: icon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 2000,
      }).addTo(eyesLayer);
    });
    updateRecentChip(totalViews);
  }

  // Header tile shows total recent restaurant views (last 10 min) — a faked
  // "people looking" count off the rolling window. Self-hides when zero.
  function updateRecentChip(n) {
    var chip = document.getElementById("liveChip");
    if (!chip) return;
    var countEl = document.getElementById("liveChipCount");
    if (n > 0) {
      if (countEl) countEl.textContent = n;
      chip.style.display = "";
    } else {
      chip.style.display = "none";
    }
  }

  // Dev-only: record a local view so eyes appear while experimenting on the LAN.
  function noteLocalView(name) {
    if (!__eyesDevHost || !name) return;
    (simViews[name] = simViews[name] || []).push(Date.now());
  }

  function getSimEyeCounts() {
    var now = Date.now();
    var out = {};
    Object.keys(simViews).forEach(function (name) {
      simViews[name] = simViews[name].filter(function (t) {
        return now - t < EYES_WINDOW_MS;
      });
      if (simViews[name].length) out[name] = simViews[name].length;
      else delete simViews[name];
    });
    return out;
  }

  function seedAmbientSimViews() {
    var n = 1 + Math.floor(Math.random() * 2);
    for (var i = 0; i < n; i++) {
      noteLocalView(restaurants[Math.floor(Math.random() * restaurants.length)].name);
    }
  }

  function fetchEyes() {
    if (__eyesDevHost) {
      if (Math.random() < 0.35) seedAmbientSimViews();
      renderEyes(getSimEyeCounts());
      return;
    }
    if (!THEME.trackUrl) return;
    fetch(THEME.trackUrl + "?eyes=true", { method: "GET" })
      .then(function (resp) { return resp.json(); })
      .then(function (data) { renderEyes(data || {}); })
      .catch(function () {});
  }

  if (__eyesDevHost) seedAmbientSimViews();
  fetchEyes();
  setInterval(fetchEyes, __eyesDevHost ? 5000 : 30000);
  // Re-place eyes when clustering changes so they stay attached to what's
  // visible (a cluster, or an individual pin) rather than scattering.
  map.on("zoomend moveend", function () { renderEyes(); });
  clusterGroup.on("animationend", function () { renderEyes(); });

  // ── Cluster hover tooltip ────────────────────

  clusterGroup.on("clustermouseover", function (e) {
    var childMarkers = e.layer.getAllChildMarkers();
    var names = childMarkers
      .map(function (m) {
        // Find restaurant name from markerMap
        var name = "";
        markerMap.forEach(function (marker, key) {
          if (marker === m) name = key;
        });
        return name;
      })
      .sort();
    var html =
      '<div class="cluster-tooltip">' +
      '<div class="cluster-tooltip-header">' +
      names.length +
      " restaurants</div>" +
      names
        .map(function (n) {
          return "<div>" + n + "</div>";
        })
        .join("") +
      "</div>";
    e.layer
      .bindTooltip(html, {
        sticky: true,
        direction: "right",
        className: "cluster-tooltip-wrapper",
      })
      .openTooltip();
  });

  clusterGroup.on("clustermouseout", function (e) {
    e.layer.unbindTooltip();
  });

  // ── Emoji overlay on selected marker ──

  var emojiIcon = L.divIcon({
    html: '<span class="emoji-icon">' + THEME.emoji + "</span>",
    className: "emoji-icon-wrapper",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  // Custom pane so the emoji renders above popups
  map.createPane("emojiOverlay");
  map.getPane("emojiOverlay").style.zIndex = 750;

  var activeOverlay = null;
  var hoverPopupActive = false;

  function showEmojiOverlay(latlng) {
    removeEmojiOverlay();
    activeOverlay = L.marker(latlng, {
      icon: emojiIcon,
      interactive: false,
      pane: "emojiOverlay",
      zIndexOffset: 10000,
    }).addTo(map);
  }

  function removeEmojiOverlay() {
    if (activeOverlay) {
      map.removeLayer(activeOverlay);
      activeOverlay = null;
    }
  }

  map.on("popupopen", function (e) {
    showEmojiOverlay(e.popup.getLatLng());

    // Track popup view — distinguish sidebar click vs map interaction
    var popupEl = e.popup.getElement();
    var h3 = popupEl && popupEl.querySelector("h3");
    if (h3 && typeof window.track === "function") {
      var source = map._viewSource || "map";
      map._viewSource = null;
      window.track(source === "sidebar" ? "sidebar-view" : "view", h3.textContent);
      if (currentUserArea) {
        window.track("geo-view", currentUserArea + " | " + h3.textContent);
      }
    }

    // Populate hours in popup
    populateHoursIn(popupEl);

    // Refresh upvote button state in the newly opened popup
    refreshOpenPopupUpvote();

    // Find and highlight the active restaurant in the sidebar
    var popupLatLng = e.popup.getLatLng();
    var activeName = null;
    markerMap.forEach(function (marker, name) {
      var ll = marker.getLatLng();
      if (
        Math.abs(ll.lat - popupLatLng.lat) < 0.0001 &&
        Math.abs(ll.lng - popupLatLng.lng) < 0.0001
      ) {
        activeName = name;
      }
    });
    var listEl = document.getElementById("restaurantList");
    var items = listEl.querySelectorAll(".restaurant-item");
    items.forEach(function (item) {
      var nameEl = item.querySelector(".name");
      if (nameEl && nameEl.textContent === activeName) {
        item.classList.add("active");
        // Scroll so active item is at the top of the visible list (skip in checklist mode and hover-triggered popups)
        if (!checklistMode && !hoverPopupActive) {
          listEl.scrollTo({
            top: item.offsetTop - listEl.offsetTop,
            behavior: "smooth",
          });
        }
      } else {
        item.classList.remove("active");
      }
    });
  });

  map.on("popupclose", function () {
    removeEmojiOverlay();
    // Clear active highlight
    var items = document.querySelectorAll(".restaurant-item.active");
    items.forEach(function (item) {
      item.classList.remove("active");
    });
  });

  // ── Mobile detail sheet ────────────────────────
  // Reuses each marker's stashed detail markup. Every interactive control in
  // that markup is document-delegated, so directions/share/upvote work here
  // unchanged; only the hours line and upvote state need re-running per open.
  var sheetOpenedAt = 0;
  function openDetailSheet(r, source) {
    var marker = markerMap.get(r.name);
    var html = marker && marker._detailHtml;
    var sheet = document.getElementById("detailSheet");
    var content = document.getElementById("detailSheetContent");
    if (!html || !sheet || !content) return;
    content.innerHTML = html;
    content.scrollTop = 0;
    if (typeof window.track === "function") {
      window.track(source === "sidebar" ? "sidebar-view" : "view", r.name);
    }
    noteLocalView(r.name); // dev sim: your tap lights up an eye on this pin
    if (currentUserArea && typeof window.track === "function") {
      // Neighborhood → restaurant pair (timestamped by the worker), for later
      // "which areas want which spots" analysis.
      window.track("geo-view", currentUserArea + " | " + r.name);
    }
    populateHoursIn(content);
    refreshUpvoteIn(content);
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    sheetOpenedAt = Date.now();
    showEmojiOverlay([r.lat, r.lng]);
    snapDrawerTo(0); // tuck the list drawer to peek behind the sheet
    var z = Math.max(map.getZoom(), 15);
    map.flyTo(sheetOffsetLatLng(r.lat, r.lng, z), z, { duration: 0.4 });
  }

  function closeDetailSheet() {
    var sheet = document.getElementById("detailSheet");
    if (!sheet || !sheet.classList.contains("open")) return;
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    removeEmojiOverlay();
  }

  var detailSheetCloseBtn = document.getElementById("detailSheetClose");
  if (detailSheetCloseBtn) {
    detailSheetCloseBtn.addEventListener("click", closeDetailSheet);
  }
  // Leaflet bubbles a marker click up to the map's "click", so ignore the map
  // click that fires in the same gesture that opened the sheet — otherwise the
  // sheet would close the instant it opens. Later map taps still dismiss it.
  map.on("click", function () {
    if (Date.now() - sheetOpenedAt < 400) return;
    closeDetailSheet();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDetailSheet();
  });

  // Popup link click handler (delegated) — track directions, website, phone
  document.addEventListener("click", function (e) {
    var btn =
      e.target.closest(".popup-btn") || e.target.closest(".popup-dir-btn");
    if (!btn || btn.classList.contains("share-link")) return;
    if (typeof window.track !== "function") return;
    var popup = btn.closest(".popup-content");
    var h3 = popup && popup.querySelector("h3");
    var name = h3 ? h3.textContent : "";
    var title = btn.getAttribute("title") || "";
    var action;
    if (title === "Apple Maps") action = "directions-apple";
    else if (title === "Google Maps") action = "directions-google";
    else if (title === "Website") action = "website";
    else if (title === "Instagram") action = "instagram";
    else if (btn.href && btn.href.indexOf("tel:") === 0) action = "phone";
    if (action && name) window.track(action, name);
  });

  // Share link click handler (delegated)
  document.addEventListener("click", function (e) {
    var link = e.target.closest(".share-link");
    if (!link) return;
    e.preventDefault();
    var url = link.getAttribute("data-url");
    var name = link.getAttribute("data-name");
    if (typeof window.track === "function") window.track("share", name);
    if (navigator.share) {
      navigator
        .share({ title: name + " — " + THEME.eventName, url: url })
        .catch(function () {});
    } else {
      var copied = false;
      if (navigator.clipboard) {
        try {
          navigator.clipboard.writeText(url);
          copied = true;
        } catch (err) {}
      }
      if (!copied) {
        var ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      var orig = link.textContent;
      link.textContent = "Copied!";
      setTimeout(function () {
        link.textContent = orig;
      }, 1500);
    }
  });

  // Upvote button click handler (delegated)
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".upvote-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var name = btn.getAttribute("data-name");
    if (!name) return;
    if (!canCastVotes()) return;

    var wasUpvoted = upvotedSet.has(name);
    if (wasUpvoted) {
      upvotedSet.delete(name);
      upvoteCounts[name] = Math.max((upvoteCounts[name] || 0) - 1, 0);
      if (typeof window.track === "function") window.track("un-upvote", name);
    } else {
      upvotedSet.add(name);
      upvoteCounts[name] = (upvoteCounts[name] || 0) + 1;
      if (typeof window.track === "function") window.track("upvote", name);
    }
    saveUpvotes();

    // Update button UI in-place
    var heart = btn.querySelector(".upvote-heart");
    var countEl = btn.querySelector(".upvote-count");
    var isNowUpvoted = upvotedSet.has(name);
    btn.classList.toggle("upvoted", isNowUpvoted);
    if (heart) heart.textContent = "\uD83D\uDC4D";
    if (countEl) countEl.textContent = String(upvoteCounts[name] || 0);

    updateSidebarUpvoteBadge(name);
  });

  // Populate the hours line inside any container holding the detail markup
  // (Leaflet popup or the mobile detail sheet).
  function populateHoursIn(container) {
    if (!hoursLoaded || !container) return;
    var hoursEl = container.querySelector(".popup-hours");
    if (!hoursEl) return;
    var hName = hoursEl.getAttribute("data-hours-name");
    if (hName && hoursData[hName]) {
      var status = getOpenStatus(hName);
      var dot = status === "open" ? "🟢" : status === "closing-soon" ? "🟡" : "🔴";
      var statusText =
        status === "open" ? "Open" : status === "closing-soon" ? "Closing Soon" : "Closed";
      var todayStr = formatTodayHours(hName);
      hoursEl.innerHTML =
        '<span class="popup-hours-dot">' + dot + "</span> " +
        "<strong>" + statusText + "</strong> · Today: " + todayStr;
    } else if (hName && hoursData[hName] === null) {
      hoursEl.innerHTML =
        '<span class="popup-hours-dot">⚪</span> Hours not available';
    }
  }

  function refreshOpenPopupUpvote() {
    refreshUpvoteIn(document.querySelector(".leaflet-popup"));
  }

  function refreshUpvoteIn(container) {
    var btn = container && container.querySelector(".upvote-btn");
    if (!btn) return;
    var name = btn.getAttribute("data-name");
    if (!name) return;
    var c = upvoteCounts[name] || 0;
    var isUpvoted = upvotedSet.has(name);
    btn.classList.toggle("upvoted", isUpvoted);
    btn.classList.toggle("zero", c === 0);
    var countEl = btn.querySelector(".upvote-count");
    if (c > 0) {
      if (!countEl) {
        countEl = document.createElement("span");
        countEl.className = "upvote-count";
        btn.appendChild(countEl);
      }
      countEl.textContent = String(c);
    } else if (countEl) {
      countEl.remove();
    }
  }

  function updateSidebarUpvoteBadge(name) {
    var li = document.querySelector(
      '.restaurant-item[data-restaurant-name="' + CSS.escape(name) + '"]',
    );
    if (!li) return;
    var btn = li.querySelector(".sidebar-upvote");
    if (!btn) return;
    var c = upvoteCounts[name] || 0;
    var isUpvoted = upvotedSet.has(name);
    btn.classList.toggle("upvoted", isUpvoted);
    btn.classList.toggle("zero", c === 0);
    var countEl = btn.querySelector(".upvote-count");
    if (c > 0) {
      if (!countEl) {
        countEl = document.createElement("span");
        countEl.className = "upvote-count";
        btn.appendChild(countEl);
      }
      countEl.textContent = String(c);
    } else if (countEl) {
      countEl.remove();
    }
  }

  function refreshSidebarUpvoteBadges() {
    var items = document.querySelectorAll(
      ".restaurant-item[data-restaurant-name]",
    );
    items.forEach(function (li) {
      var name = li.getAttribute("data-restaurant-name");
      updateSidebarUpvoteBadge(name);
    });
  }

  // Fit bounds to show all markers
  const allCoords = restaurants.map(function (r) {
    return [r.lat, r.lng];
  });

  // Returns fitBounds padding that accounts for the mobile drawer
  function getMapPadding() {
    if (window.innerWidth <= 768 && drawerStops.length) {
      var drawerVisible =
        (sidebar.offsetHeight || 0) - (drawerStops[currentStop] || 0);
      return {
        paddingTopLeft: [20, 20],
        paddingBottomRight: [20, drawerVisible + 20],
      };
    }
    return { padding: [30, 30] };
  }

  if (allCoords.length && !window.location.hash) {
    map.fitBounds(allCoords, { padding: [30, 30] });
  }

  // ── Sidebar: area filter buttons ───────────────

  const areas = [];
  restaurants.forEach(function (r) {
    if (areas.indexOf(r.area) === -1) areas.push(r.area);
  });

  const filtersEl = document.getElementById("areaFilters");

  // Clear filters button (full-width, above all rows)
  var clearBtn = document.createElement("button");
  clearBtn.className = "area-btn clear-filters-btn";
  clearBtn.setAttribute("data-clear", "true");
  clearBtn.textContent = "✕ Clear Filters";
  clearBtn.style.display = "none";
  filtersEl.appendChild(clearBtn);

  // Area filter row
  var areaRow = document.createElement("div");
  areaRow.className = "filter-row filter-row-areas";
  areas.forEach(function (area) {
    const btn = document.createElement("button");
    btn.className = "area-btn";
    btn.setAttribute("data-area", area);
    btn.textContent = area;
    areaRow.appendChild(btn);
  });
  filtersEl.appendChild(areaRow);

  // Tag filter row
  var tagRow = document.createElement("div");
  tagRow.className = "filter-row filter-row-tags";
  tagDefs.forEach(function (t) {
    var btn = document.createElement("button");
    btn.className = "area-btn";
    btn.setAttribute("data-tag", t.key);
    var img = document.createElement("img");
    img.src = t.icon;
    img.alt = t.label;
    img.className = "tag-icon";
    btn.appendChild(img);
    btn.appendChild(document.createTextNode(" " + t.label));
    tagRow.appendChild(btn);
  });
  filtersEl.appendChild(tagRow);

  // Hours filter row (hidden until hours.json loads)
  var hoursFilterSpan = document.createElement("div");
  hoursFilterSpan.id = "hoursFilters";
  hoursFilterSpan.className = "filter-row filter-row-hours";
  hoursFilterSpan.style.display = "none";
  var hoursDefs = THEME.hoursFilters || [
    { key: "open", icon: "🟢", label: "Open Now" },
    { key: "lunch", icon: "☀️", label: "Lunch" },
    { key: "dinner", icon: "🌙", label: "Dinner" },
  ];
  hoursDefs.forEach(function (h) {
    var btn = document.createElement("button");
    btn.className = "area-btn";
    btn.setAttribute("data-hours", h.key);
    btn.textContent = h.icon + " " + h.label;
    hoursFilterSpan.appendChild(btn);
  });
  filtersEl.appendChild(hoursFilterSpan);

  // Horizontal-scroll fade hints: fade whichever edge has more off-screen chips
  // so the rows read as scrollable rather than a complete short list.
  var filterRowEls = filtersEl.querySelectorAll(".filter-row");
  function refreshFilterScrollHints() {
    filterRowEls.forEach(function (row) {
      var scrollable = row.scrollWidth - row.clientWidth > 2;
      var atStart = row.scrollLeft <= 1;
      var atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 1;
      row.classList.toggle("fade-left", scrollable && !atStart);
      row.classList.toggle("fade-right", scrollable && !atEnd);
    });
  }
  filterRowEls.forEach(function (row) {
    row.addEventListener("scroll", refreshFilterScrollHints, { passive: true });
  });
  window.addEventListener("resize", refreshFilterScrollHints);
  requestAnimationFrame(refreshFilterScrollHints);

  var activeArea = null;
  var activeTag = null;

  function clearAllFilters() {
    activeArea = null;
    activeTag = null;
    activeHoursFilter = null;
    filtersEl.querySelectorAll(".area-btn.active").forEach(function (b) {
      b.classList.remove("active");
    });
    updateFilterBtnState();
    renderList();
  }

  filtersEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".area-btn");
    if (!btn) return;

    // Clear filters button
    if (btn.getAttribute("data-clear")) {
      clearAllFilters();
      return;
    }

    var hoursKey = btn.getAttribute("data-hours");
    var tag = btn.getAttribute("data-tag");
    var area = btn.getAttribute("data-area");

    if (hoursKey) {
      // Hours: toggle within group (only one at a time)
      if (activeHoursFilter === hoursKey) {
        activeHoursFilter = null;
        btn.classList.remove("active");
      } else {
        hoursFilterSpan.querySelectorAll(".area-btn").forEach(function (b) {
          b.classList.remove("active");
        });
        activeHoursFilter = hoursKey;
        btn.classList.add("active");
      }
      if (typeof window.track === "function")
        window.track("filter-hours", hoursKey);
    } else if (tag) {
      // Tag: toggle on/off independently
      if (activeTag === tag) {
        activeTag = null;
        btn.classList.remove("active");
      } else {
        tagRow.querySelectorAll(".area-btn").forEach(function (b) {
          b.classList.remove("active");
        });
        activeTag = tag;
        btn.classList.add("active");
      }
      if (typeof window.track === "function") window.track("filter-tag", tag);
    } else if (area) {
      // Area: toggle, only one at a time
      if (activeArea === area) {
        activeArea = null;
        btn.classList.remove("active");
      } else {
        areaRow.querySelectorAll(".area-btn").forEach(function (b) {
          b.classList.remove("active");
        });
        activeArea = area;
        btn.classList.add("active");
      }
      if (typeof window.track === "function")
        window.track("filter-area", activeArea || "All");
    }

    updateFilterBtnState();
    renderList();
  });

  // ── Mobile filter toggle ─────────────────────
  var filterToggleBtn = document.getElementById("filterToggle");
  var filterPanel = document.getElementById("filterPanel");

  filterToggleBtn.addEventListener("click", function () {
    var willOpen = !filterPanel.classList.contains("open");
    filterPanel.classList.toggle("open");
    // On mobile, snap drawer to full when opening filters
    if (willOpen && window.innerWidth <= 768 && currentStop < 2) {
      snapDrawerTo(2);
    }
    // Rows have zero size while the panel is hidden, so refresh hints on open.
    if (willOpen) requestAnimationFrame(refreshFilterScrollHints);
  });

  // ── Zoom reset control (below +/- buttons) ────
  L.Control.ZoomReset = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function () {
      var container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      var btn = L.DomUtil.create("a", "", container);
      btn.href = "#";
      btn.title = "Zoom to fit all";
      btn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 14 14" style="vertical-align:middle"><path d="M0 4V1a1 1 0 011-1h3M10 0h3a1 1 0 011 1v3M14 10v3a1 1 0 01-1 1h-3M4 14H1a1 1 0 01-1-1v-3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
      btn.style.lineHeight = "30px";
      btn.style.textAlign = "center";
      btn.setAttribute("role", "button");
      btn.setAttribute("aria-label", "Zoom to fit all");
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(btn, "click", function (e) {
        L.DomEvent.preventDefault(e);
        if (allCoords.length) {
          map.fitBounds(allCoords, getMapPadding());
        }
      });
      return container;
    },
  });
  new L.Control.ZoomReset().addTo(map);

  // ── "Use my location" control (nav arrow, below the reset button) ──
  var userLocLayer = L.layerGroup().addTo(map);
  var currentUserArea = null;
  try {
    currentUserArea = sessionStorage.getItem("user-area-val") || null;
  } catch (e) {}

  // Bucket a location to the nearest restaurant's neighborhood — coarse, never
  // stored as raw coordinates. Far-off visitors bucket to "Outside SB".
  function nearestUserArea(latlng) {
    var bestArea = null;
    var bestD = Infinity;
    restaurants.forEach(function (r) {
      var d = map.distance(latlng, [r.lat, r.lng]);
      if (d < bestD) {
        bestD = d;
        bestArea = r.area;
      }
    });
    return bestD > 8000 ? "Outside SB" : bestArea;
  }

  map.on("locationfound", function (e) {
    userLocLayer.clearLayers();
    L.circle(e.latlng, {
      radius: Math.min(e.accuracy || 60, 400),
      color: "#2a7de1",
      weight: 1,
      fillColor: "#2a7de1",
      fillOpacity: 0.1,
    }).addTo(userLocLayer);
    L.circleMarker(e.latlng, {
      radius: 7,
      color: "#fff",
      weight: 2,
      fillColor: "#2a7de1",
      fillOpacity: 1,
    }).addTo(userLocLayer);

    // Coarse, consented, anonymous: record only the neighborhood bucket, once
    // per session. Also keep it for geo-view pair logging on subsequent views.
    var area = nearestUserArea(e.latlng);
    currentUserArea = area;
    try {
      sessionStorage.setItem("user-area-val", area);
      if (!sessionStorage.getItem("ua-sampled") && typeof window.track === "function") {
        window.track("user-area", area);
        sessionStorage.setItem("ua-sampled", "1");
      }
    } catch (err) {}
  });

  map.on("locationerror", function () {
    /* permission denied or unavailable — quietly no-op, button can be retried */
  });

  L.Control.Locate = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function () {
      var container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      var btn = L.DomUtil.create("a", "", container);
      btn.href = "#";
      btn.title = "Use my location";
      btn.setAttribute("role", "button");
      btn.setAttribute("aria-label", "Use my location");
      btn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>';
      btn.style.lineHeight = "30px";
      btn.style.textAlign = "center";
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(btn, "click", function (ev) {
        L.DomEvent.preventDefault(ev);
        map.locate({ setView: true, maxZoom: 15, enableHighAccuracy: true });
      });
      return container;
    },
  });
  new L.Control.Locate().addTo(map);

  function updateFilterBtnState() {
    var hasActiveFilters = activeArea || activeTag || activeHoursFilter || checklistMode;
    filterToggleBtn.classList.toggle("has-filters", hasActiveFilters);
    clearBtn.style.display = (activeArea || activeTag || activeHoursFilter) ? "" : "none";
  }

  // ── Sidebar: restaurant list ───────────────────

  var searchTerm = "";
  var searchBox = document.getElementById("searchBox");

  var searchTrackTimer = null;
  var lastFilteredCount = 0;
  searchBox.addEventListener("input", function () {
    searchTerm = this.value.toLowerCase().trim();
    renderList();
    // On mobile, snap drawer to half so user can see filtered results
    if (window.innerWidth <= 768 && searchTerm && currentStop < 1) {
      snapDrawerTo(1);
    }
    // Track search queries (debounced, 2+ chars). Also flag zero-result
    // searches — they reveal missing spots, name mismatches, or feature gaps.
    clearTimeout(searchTrackTimer);
    if (searchTerm.length >= 2 && typeof window.track === "function") {
      searchTrackTimer = setTimeout(function () {
        window.track("search", searchTerm);
        if (lastFilteredCount === 0) window.track("search-empty", searchTerm);
      }, 800);
    }
  });

  function renderList(skipFitBounds) {
    var listEl = document.getElementById("restaurantList");
    var countEl = document.getElementById("restaurantCount");
    listEl.innerHTML = "";

    // Update cluster layer to reflect filter
    clusterGroup.clearLayers();

    var filtered = restaurants.filter(function (r) {
      var matchesArea = !activeArea || r.area === activeArea;
      var matchesSearch =
        !searchTerm ||
        r.name.toLowerCase().indexOf(searchTerm) !== -1 ||
        r.address.toLowerCase().indexOf(searchTerm) !== -1 ||
        r.area.toLowerCase().indexOf(searchTerm) !== -1 ||
        r.menuItems.some(function (item) {
          return (
            item.name.toLowerCase().indexOf(searchTerm) !== -1 ||
            (item.description &&
              item.description.toLowerCase().indexOf(searchTerm) !== -1)
          );
        });
      var matchesTags = !activeTag || r[activeTag];
      var matchesHours = true;
      if (activeHoursFilter && hoursLoaded) {
        var entry = hoursData[r.name];
        if (!entry) {
          matchesHours = false;
        } else if (activeHoursFilter === "open") {
          matchesHours = isOpenNow(r.name) === true;
        } else if (activeHoursFilter === "lunch") {
          matchesHours = entry.lunch === true;
        } else if (activeHoursFilter === "dinner") {
          matchesHours = entry.dinner === true;
        }
      }
      return matchesArea && matchesSearch && matchesTags && matchesHours;
    });

    filtered.sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

    lastFilteredCount = filtered.length;

    if (checklistMode) {
      var checkedCount = filtered.filter(function (r) {
        return checkedSet.has(r.name);
      }).length;
      countEl.innerHTML =
        filtered.length +
        " of " +
        restaurants.length +
        ' restaurants — <span class="checklist-summary">' +
        checkedCount +
        " selected</span>";
    } else {
      countEl.textContent =
        filtered.length + " of " + restaurants.length + " restaurants";
    }

    if (filtered.length === 0) {
      var noRes = document.createElement("li");
      noRes.className = "no-results";
      noRes.textContent = "No restaurants match your search.";
      listEl.appendChild(noRes);
      return;
    }

    filtered.forEach(function (r) {
      // Re-add marker to cluster
      var marker = markerMap.get(r.name);
      if (marker) {
        clusterGroup.addLayer(marker);
        updateMarkerOpacity(r.name);
      }

      // List item
      var li = document.createElement("li");
      li.className = "restaurant-item";
      li.setAttribute("data-restaurant-name", r.name);
      var isChecked = checkedSet.has(r.name);
      if (checklistMode && !isChecked) {
        li.classList.add("unchecked");
      }

      // Checkbox (only in checklist mode)
      if (checklistMode) {
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "checklist-checkbox";
        cb.checked = isChecked;
        cb.addEventListener("change", function () {
          if (this.checked) {
            checkedSet.add(r.name);
          } else {
            checkedSet.delete(r.name);
          }
          saveChecklist();
          updateFabCount();
          map.panTo([r.lat, r.lng]);
          renderList(true);
        });
        li.appendChild(cb);
      }

      var nameCol = document.createElement("div");
      nameCol.className = "name-col";
      var nameSpan = document.createElement("span");
      nameSpan.className = "name";
      var dietaryIcons = createDietaryIconEls(r);
      if (dietaryIcons.childNodes.length > 0) {
        var tagsWrap = document.createElement("span");
        tagsWrap.className = "dietary-tags";
        tagsWrap.appendChild(dietaryIcons);
        nameSpan.appendChild(tagsWrap);
      }
      nameSpan.appendChild(document.createTextNode(r.name));
      nameCol.appendChild(nameSpan);
      if (r.menuItems.length > 0) {
        r.menuItems.forEach(function (item) {
          var subtitle = document.createElement("span");
          subtitle.className = "menu-item-subtitle";
          subtitle.textContent = item.name;
          nameCol.appendChild(subtitle);
        });
      } else {
        var coming = document.createElement("span");
        coming.className = "menu-item-subtitle coming-soon";
        coming.textContent = "Details coming soon!";
        nameCol.appendChild(coming);
      }

      // Hours badge in sidebar (only show closing-soon and closed)
      if (hoursLoaded && hoursData[r.name]) {
        var status = getOpenStatus(r.name);
        if (status === "closing-soon" || status === "closed") {
          var hoursBadge = document.createElement("span");
          hoursBadge.className = "hours-dot " + status;
          if (status === "closing-soon") {
            hoursBadge.textContent = "Closing Soon";
          } else {
            var nextOpen = getNextOpenTime(r.name);
            hoursBadge.textContent = nextOpen ? "Opens " + nextOpen : "Closed";
          }
          nameCol.appendChild(hoursBadge);
        }
      }

      var badge = document.createElement("span");
      badge.className = "area-badge";
      badge.textContent = r.area;
      badge.style.backgroundColor = AREA_COLORS[r.area] || "#999";

      li.appendChild(nameCol);

      var rightCol = document.createElement("div");
      rightCol.className = "sidebar-right-col";
      rightCol.appendChild(badge);

      if (__showUpvotes) {
        var upvoteC = upvoteCounts[r.name] || 0;
        var isUpvoted = upvotedSet.has(r.name);
        var upBtn = document.createElement("button");
        upBtn.setAttribute("data-name", r.name);
        upBtn.className =
          "upvote-btn sidebar-upvote" +
          (isUpvoted ? " upvoted" : "") +
          (upvoteC === 0 ? " zero" : "") +
          (!__canVote ? " frozen" : "");
        upBtn.innerHTML =
          '<span class="upvote-heart">\uD83D\uDC4D</span>' +
          (upvoteC > 0
            ? '<span class="upvote-count">' + upvoteC + "</span>"
            : "");
        rightCol.appendChild(upBtn);
      }

      li.appendChild(rightCol);

      li.addEventListener("mouseenter", function () {
        showEmojiOverlay([r.lat, r.lng]);
      });

      li.addEventListener("mouseleave", function () {
        if (!marker || !marker.isPopupOpen()) {
          removeEmojiOverlay();
        }
      });

      li.addEventListener("click", function () {
        map._viewSource = "sidebar";
        if (window.innerWidth <= 768) {
          // Mobile: open the detail sheet (it centers the pin and tucks the list)
          openDetailSheet(r, "sidebar");
          return;
        }
        map.flyTo(mobileOffsetLatLng(r.lat, r.lng, 17), 17, { duration: 0.8 });

        // After fly, open popup (with slight delay for cluster to resolve)
        setTimeout(function () {
          if (marker) {
            // Spiderfy the cluster if needed
            var parent = clusterGroup.getVisibleParent(marker);
            if (parent && parent !== marker) {
              parent.spiderfy();
              setTimeout(function () {
                marker.openPopup();
              }, 300);
            } else {
              marker.openPopup();
            }
          }
        }, 900);
      });

      listEl.appendChild(li);
    });

    // Fit map to filtered markers
    var coords = filtered.map(function (r) {
      return [r.lat, r.lng];
    });
    if (coords.length && !skipFitBounds) {
      map.fitBounds(coords, getMapPadding());
    }
  }

  renderList();

  // ── Loading overlay dismiss ───────────────────
  tileLayer.once("load", function () {
    var overlay = document.getElementById("loadingOverlay");
    if (overlay) {
      overlay.classList.add("loaded");
      setTimeout(function () {
        overlay.remove();
      }, 400);
    }
  });

  // ── Checklist helpers ───────────────────────────

  function updateMarkerOpacity(name) {
    var marker = markerMap.get(name);
    if (!marker) return;
    if (checklistMode && !checkedSet.has(name)) {
      marker.setStyle({ fillOpacity: 0.2, opacity: 0.3 });
    } else {
      marker.setStyle({ fillOpacity: 0.85, opacity: 1 });
    }
  }

  // ── FAB: Select & Print floating action button ──

  L.Control.SelectPrintFab = L.Control.extend({
    options: { position: "topright" },
    onAdd: function () {
      var wrapper = L.DomUtil.create("div", "leaflet-control fab-wrapper");
      L.DomEvent.disableClickPropagation(wrapper);
      L.DomEvent.disableScrollPropagation(wrapper);

      // Main FAB button
      var fab = L.DomUtil.create("button", "fab-btn", wrapper);
      fab.title = "Select & Print";
      fab.setAttribute("aria-label", "Select & Print");
      fab.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

      // Toolbar (hidden by default)
      var toolbar = L.DomUtil.create("div", "fab-toolbar", wrapper);
      toolbar.id = "fabToolbar";

      var countSpan = L.DomUtil.create("span", "fab-count", toolbar);
      countSpan.id = "fabCount";
      countSpan.textContent = "0 selected";

      var allBtn = L.DomUtil.create("button", "fab-action-btn", toolbar);
      allBtn.textContent = "All";

      var noneBtn = L.DomUtil.create("button", "fab-action-btn", toolbar);
      noneBtn.textContent = "None";

      var printBtn = L.DomUtil.create(
        "button",
        "fab-action-btn fab-print-btn",
        toolbar,
      );
      printBtn.textContent = "Print";
      printBtn.id = "fabPrintBtn";

      // Toggle checklist mode
      L.DomEvent.on(fab, "click", function (e) {
        L.DomEvent.preventDefault(e);
        checklistMode = !checklistMode;
        wrapper.classList.toggle("active", checklistMode);
        updateFilterBtnState();
        updateFabCount();
        renderList();
      });

      // Bulk actions
      L.DomEvent.on(allBtn, "click", function (e) {
        L.DomEvent.preventDefault(e);
        restaurants.forEach(function (r) {
          checkedSet.add(r.name);
        });
        saveChecklist();
        updateFabCount();
        renderList();
      });

      L.DomEvent.on(noneBtn, "click", function (e) {
        L.DomEvent.preventDefault(e);
        checkedSet.clear();
        saveChecklist();
        updateFabCount();
        renderList();
      });

      L.DomEvent.on(printBtn, "click", function (e) {
        L.DomEvent.preventDefault(e);
        printChecklist();
      });

      if (window.innerWidth <= 768) {
        var hint = L.DomUtil.create("span", "fab-hint", toolbar);
        hint.textContent = "Print works best on desktop";
      }

      return wrapper;
    },
  });
  new L.Control.SelectPrintFab().addTo(map);

  // ── Tip Jar control ──────────────────────────
  L.Control.TipJar = L.Control.extend({
    options: { position: "topright" },
    onAdd: function () {
      var btn = L.DomUtil.create("button", "tip-jar-btn leaflet-control");
      btn.title = "Tip Jar";
      btn.setAttribute("aria-label", "Tip Jar");
      btn.innerHTML = "🫙";
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, "click", function (e) {
        L.DomEvent.preventDefault(e);
        if (typeof window.track === "function")
          window.track("tip-jar-open", "tip-jar");
        var overlay = document.getElementById("tipJarOverlay");
        if (overlay) overlay.classList.add("open");
      });
      return btn;
    },
  });
  new L.Control.TipJar().addTo(map);

  // ── Tip Jar modal ──────────────────────────────
  (function () {
    var tipOverlay = document.getElementById("tipJarOverlay");
    var tipClose = document.getElementById("tipJarClose");
    if (!tipOverlay || !tipClose) return;

    tipClose.addEventListener("click", function () {
      tipOverlay.classList.remove("open");
    });

    tipOverlay.addEventListener("click", function (e) {
      if (e.target === tipOverlay) {
        tipOverlay.classList.remove("open");
      }
    });

    // Populate tip jar text from config
    var tipBody = document.getElementById("tipJarBody");
    if (tipBody) {
      tipBody.innerHTML =
        "Hi! I\u2019m Sam Gutentag and I built the " +
        THEME.itemLabel +
        " map. It\u2019s free to use and always will be!<br>If it helped you discover your next great " +
        THEME.itemLabel +
        ", consider sharing it with a friend or leaving a small tip.";
    }
    // Build tip tiers dynamically from config
    var tipAmountsContainer = document.getElementById("tipAmounts");
    var tipShareBtn = document.getElementById("tipShare");
    var isMobileDev = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (tipAmountsContainer && THEME.tipTiers && THEME.venmoUser) {
      // Detach share button before inserting tiers
      if (tipShareBtn) tipShareBtn.remove();
      var tiers = THEME.tipTiers;
      tiers.forEach(function (tier) {
        var a = document.createElement("a");
        a.className = "tip-amount-btn";
        if (tier.size === "m") a.className += " tip-amount-featured";
        a.href = "#";

        // Emoji span
        var emojiSpan = document.createElement("span");
        emojiSpan.className = "tip-emoji";
        if (tier.size === "m") {
          var halfSpan = document.createElement("span");
          halfSpan.className = "tip-emoji-half";
          halfSpan.textContent = tier.emoji || THEME.emoji;
          emojiSpan.appendChild(halfSpan);
        } else if (tier.size === "l") {
          emojiSpan.textContent = tier.emoji || THEME.emoji;
        } else {
          emojiSpan.textContent = tier.emoji || THEME.emoji;
        }
        a.appendChild(emojiSpan);

        // Label span
        var labelSpan = document.createElement("span");
        labelSpan.className = "tip-label";
        labelSpan.textContent = tier.label;
        a.appendChild(labelSpan);

        // Price span
        var priceSpan = document.createElement("span");
        priceSpan.className = "tip-price";
        priceSpan.textContent = "$" + tier.amount;
        a.appendChild(priceSpan);

        // Venmo deep link
        var note = THEME.emoji + " " + THEME.venmoNote;
        if (isMobileDev) {
          a.href =
            "venmo://paycharge?txn=pay&recipients=" +
            THEME.venmoUser +
            "&note=" +
            encodeURIComponent(note) +
            "&amount=" +
            tier.amount;
        } else {
          a.href =
            "https://account.venmo.com/pay?recipients=%2C" +
            THEME.venmoUser +
            "&amount=" +
            tier.amount.toFixed(2) +
            "&note=" +
            encodeURIComponent(note) +
            "&txn=pay";
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }

        // Click tracking
        var trackName = "tip-" + tier.size;
        a.addEventListener("click", function () {
          if (typeof window.track === "function")
            window.track(trackName, "tip-jar");
        });

        tipAmountsContainer.appendChild(a);
      });
      // Re-append share button after tiers
      if (tipShareBtn) tipAmountsContainer.appendChild(tipShareBtn);
    }

    // Tip progress bar
    fetch("tips.json")
      .then(function (resp) {
        if (!resp.ok) throw new Error("not found");
        return resp.json();
      })
      .then(function (data) {
        var total = data && typeof data.total === "number" ? data.total : 0;
        if (total <= 0) return;
        var max = total <= 25 ? 25 : Math.ceil((total + 10) / 10) * 10;
        var fillEl = document.getElementById("tipProgressFill");
        var labelsEl = document.getElementById("tipProgressLabels");
        var progressEl = document.getElementById("tipProgress");
        if (!fillEl || !labelsEl || !progressEl) return;

        // Set fill width (minimum 8% so small amounts are visible)
        var pct = Math.min((total / max) * 100, 100);
        fillEl.style.width = Math.max(pct, 8) + "%";

        // Current amount badge on the fill
        var badge = document.createElement("span");
        badge.className = "tip-progress-amount";
        badge.textContent = "$" + total;
        fillEl.appendChild(badge);

        // Build tick marks and labels
        var bar = fillEl.parentElement;
        var ticksDiv = document.createElement("div");
        ticksDiv.className = "tip-progress-ticks";

        var capItem = THEME.itemLabel.charAt(0).toUpperCase() + THEME.itemLabel.slice(1);
        var markerDescs = {
          0: "Love of the game",
          10: "Price of website",
          20: capItem + " Time!"
        };

        var markers = [0, 10, 20, 25];
        if (max > 25) markers.push(max);

        markers.forEach(function (val) {
          var pos = (val / max) * 100;

          // Tick on bar
          var tick = document.createElement("div");
          tick.className = "tip-progress-tick";
          tick.style.left = pos + "%";
          ticksDiv.appendChild(tick);

          // Label below (skip $25)
          if (val === 25) return;
          var label = document.createElement("span");
          label.className = "tip-progress-label";
          label.style.left = pos + "%";
          var desc = markerDescs[val] || "";
          label.innerHTML = "<strong>$" + val + "</strong>" + (desc ? desc : "");
          labelsEl.appendChild(label);
        });

        bar.appendChild(ticksDiv);

        // Donation note
        var note = document.createElement("p");
        note.className = "tip-progress-note";
        note.innerHTML = 'Half of all donations over $20 go to the <a href="https://foodbanksbc.org" target="_blank" rel="noopener">Santa Barbara Food Bank</a>';
        progressEl.appendChild(note);

        progressEl.style.display = "";
      })
      .catch(function () {
        /* silently ignore — bar stays hidden */
      });

    // Share button
    var tipShareBtn = document.getElementById("tipShare");
    if (tipShareBtn) {
      tipShareBtn.addEventListener("click", function (e) {
        e.preventDefault();
        var shareUrl = THEME.siteUrl + "/?src=share";
        var shareTitle = THEME.eventName + " Map";
        if (typeof window.track === "function")
          window.track("tip-share", "tip-jar");
        if (navigator.share) {
          navigator
            .share({ title: shareTitle, url: shareUrl })
            .catch(function () {});
        } else {
          var copied = false;
          if (navigator.clipboard) {
            try {
              navigator.clipboard.writeText(shareUrl);
              copied = true;
            } catch (err) {}
          }
          if (!copied) {
            var ta = document.createElement("textarea");
            ta.value = shareUrl;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          }
          var priceEl = tipShareBtn.querySelector(".tip-price");
          var orig = priceEl.textContent;
          priceEl.textContent = "Copied!";
          setTimeout(function () {
            priceEl.textContent = orig;
          }, 1500);
        }
      });
    }
  })();

  function updateFabCount() {
    var countEl = document.getElementById("fabCount");
    if (countEl) {
      countEl.textContent = checkedSet.size + " selected";
    }
  }

  updateFabCount();

  // ── Print selected restaurants ──────────────────

  function printChecklist() {
    var selected = restaurants.filter(function (r) {
      return checkedSet.has(r.name);
    });

    if (selected.length === 0) {
      alert("No restaurants selected. Check some restaurants first.");
      return;
    }

    var areaOrder = Object.keys(AREA_COLORS);
    var groups = {};
    selected.forEach(function (r) {
      if (!groups[r.area]) groups[r.area] = [];
      groups[r.area].push(r);
    });

    Object.keys(groups).forEach(function (area) {
      groups[area].sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
    });

    var sortedAreas = Object.keys(groups).sort(function (a, b) {
      var ai = areaOrder.indexOf(a);
      var bi = areaOrder.indexOf(b);
      if (ai === -1) ai = 999;
      if (bi === -1) bi = 999;
      return ai - bi;
    });

    var num = 1;
    var numberedItems = [];
    sortedAreas.forEach(function (area) {
      groups[area].forEach(function (r) {
        numberedItems.push({ num: num++, restaurant: r, area: area });
      });
    });

    var markersJs = numberedItems
      .map(function (item) {
        var r = item.restaurant;
        return (
          "L.marker([" +
          r.lat +
          "," +
          r.lng +
          "],{icon:L.divIcon({html:'<div style=\"background:" +
          (AREA_COLORS[r.area] || "#999") +
          ';color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3)">' +
          item.num +
          "</div>',className:'',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(m);"
        );
      })
      .join("\n");

    var boundsJs =
      "m.fitBounds([" +
      numberedItems
        .map(function (item) {
          return "[" + item.restaurant.lat + "," + item.restaurant.lng + "]";
        })
        .join(",") +
      "],{padding:[50,50]});";

    var listHtml = "";
    sortedAreas.forEach(function (area) {
      listHtml +=
        '<h2 style="margin:18px 0 8px;font-size:1.1rem;color:' +
        (AREA_COLORS[area] || "#999") +
        ";border-bottom:2px solid " +
        (AREA_COLORS[area] || "#999") +
        ';padding-bottom:4px">' +
        escapeHtml(area) +
        "</h2>";
      groups[area].forEach(function (r) {
        var n = numberedItems.find(function (item) {
          return item.restaurant === r;
        }).num;
        listHtml +=
          '<div style="display:flex;gap:12px;margin-bottom:12px;padding-left:8px">';
        listHtml += '<div style="flex:1;min-width:0">';
        var printTags = "";
        tagDefs.forEach(function (t) {
          if (r[t.key]) {
            printTags +=
              '<img src="' +
              t.icon +
              '" alt="' +
              t.label +
              '" style="width:14px;height:14px;vertical-align:-2px;margin-right:2px;opacity:0.7">';
          }
        });
        listHtml +=
          '<div style="font-weight:700;font-size:0.95rem"><span style="display:inline-block;background:' +
          (AREA_COLORS[r.area] || "#999") +
          ';color:#fff;width:22px;height:22px;border-radius:50%;text-align:center;line-height:22px;font-size:11px;margin-right:6px">' +
          n +
          "</span>" +
          (printTags
            ? '<span style="margin-right:4px">' + printTags + "</span>"
            : "") +
          escapeHtml(r.name) +
          "</div>";
        listHtml +=
          '<div style="font-size:0.85rem;color:#555">' +
          escapeHtml(r.address) +
          "</div>";
        if (r.phone)
          listHtml +=
            '<div style="font-size:0.85rem;color:#555">' +
            escapeHtml(r.phone) +
            "</div>";
        listHtml += "</div>";
        if (r.menuItems.length > 0) {
          listHtml += '<div style="flex:1;min-width:0">';
          r.menuItems.forEach(function (item) {
            listHtml +=
              '<div style="font-size:0.85rem;font-weight:600">' +
              THEME.emoji +
              " " +
              escapeHtml(item.name) +
              "</div>";
            if (item.description)
              listHtml +=
                '<div style="font-size:0.82rem;color:#666;font-style:italic">' +
                escapeHtml(item.description) +
                "</div>";
            else
              listHtml +=
                '<div style="font-size:0.82rem;color:#999;font-style:italic">' +
                "More details coming soon!" +
                "</div>";
          });
          listHtml += "</div>";
        }
        listHtml += "</div>";
      });
    });

    var venmoQrHtml = "";
    if (THEME.venmoUser) {
      var venmoDeeplink =
        "venmo://paycharge?txn=pay&recipients=" +
        THEME.venmoUser +
        "&note=" +
        encodeURIComponent(THEME.emoji + " " + THEME.venmoNote) +
        "&amount=" +
        (THEME.tipTiers && THEME.tipTiers.length > 0 ? THEME.tipTiers[Math.floor(THEME.tipTiers.length / 2)].amount : 5);
      var qrUrl =
        "https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=" +
        encodeURIComponent(venmoDeeplink);
      venmoQrHtml =
        '<div style="float:right;text-align:center;margin-left:12px">' +
        '<img src="' +
        qrUrl +
        '" alt="Venmo QR Code" style="width:60px;height:60px;opacity:0.7">' +
        '<div style="font-size:0.55rem;color:#aaa;margin-top:2px">Enjoyed the map?</div>' +
        '<div style="font-size:0.55rem;color:#aaa">' +
        " " + THEME.venmoNote + "</div>" +
        "</div>";
    }

    var printHtml =
      "<!DOCTYPE html><html><head>" +
      '<meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<title>" +
      THEME.printTitle +
      "</title>" +
      '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">' +
      "<style>" +
      "body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;margin:0 auto;padding:20px;color:#2b2b2b;width:800px}" +
      "h1{font-size:1.3rem;margin-bottom:4px}" +
      ".subtitle{color:#888;font-size:0.85rem;margin-bottom:16px}" +
      "#printMap{height:400px;border-radius:8px;border:1px solid #ddd;margin-bottom:20px}" +
      "#mapImage{width:100%;height:400px;border-radius:8px;border:1px solid #ddd;margin-bottom:20px;object-fit:cover;display:none}" +
      ".print-btn{display:block;margin:0 auto 20px;padding:10px 28px;background:#e63946;color:#fff;border:none;border-radius:20px;font-size:0.95rem;font-weight:600;cursor:pointer}" +
      ".print-btn:hover{background:#c62d3a}" +
      "@media print{.print-btn{display:none}" +
      "*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}" +
      "}" +
      "</style>" +
      "</head><body>" +
      venmoQrHtml +
      "<h1>" +
      THEME.printTitle +
      "</h1>" +
      '<p class="subtitle">' +
      selected.length +
      " restaurants selected | " +
      THEME.siteUrl.replace(/^https?:\/\//, "") +
      "</p>" +
      '<button class="print-btn" id="printBtn">Print This Page</button>' +
      '<div id="printMap"></div>' +
      '<img id="mapImage" alt="Map of selected restaurants">' +
      listHtml +
      '<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></' +
      "script>" +
      '<script src="https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js"></' +
      "script>" +
      "<script>" +
      'var m=L.map("printMap",{zoomControl:false,attributionControl:false});' +
      'L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",{maxZoom:20,subdomains:"abcd",crossOrigin:true}).addTo(m);' +
      markersJs +
      boundsJs +
      'document.getElementById("printBtn").addEventListener("click",function(){' +
      "var btn=this;btn.textContent='Capturing map...';btn.disabled=true;" +
      "var mapEl=document.getElementById('printMap');" +
      "var imgEl=document.getElementById('mapImage');" +
      "html2canvas(mapEl,{useCORS:true,scale:2,logging:false}).then(function(canvas){" +
      "imgEl.src=canvas.toDataURL('image/png');" +
      "imgEl.style.display='block';" +
      "mapEl.style.display='none';" +
      "setTimeout(function(){window.print();" +
      "imgEl.style.display='none';" +
      "mapEl.style.display='block';" +
      "btn.textContent='Print This Page';btn.disabled=false;" +
      "},300);" +
      "}).catch(function(){" +
      "btn.textContent='Print This Page';btn.disabled=false;" +
      "window.print();" +
      "});" +
      "});" +
      "</" +
      "script>" +
      "</body></html>";

    var printWindow = window.open("", "_blank");
    printWindow.document.write(printHtml);
    printWindow.document.close();
  }

  // ── Mobile three-stop snap drawer ─────────────

  var dragHandle = document.getElementById("dragHandle");
  var isMobileView = window.innerWidth <= 768;

  function calcDrawerStops() {
    var vh = window.innerHeight;
    var sidebarHeight = sidebar.offsetHeight || Math.round(vh * 0.9);
    var halfVisible = Math.round(vh * 0.5);
    var fullVisible = sidebarHeight; // show it all (90vh)
    drawerStops = [
      sidebarHeight - PEEK_HEIGHT, // peek: most of drawer hidden
      sidebarHeight - halfVisible, // half: 50vh visible
      0, // full: all visible
    ];
  }

  function snapDrawerTo(stopIndex) {
    currentStop = Math.max(0, Math.min(stopIndex, drawerStops.length - 1));
    sidebar.classList.remove("dragging");
    sidebar.style.setProperty(
      "--drawer-offset",
      drawerStops[currentStop] + "px",
    );

    // Track the first drawer expansion per session (mobile only) — tells us
    // whether phone users engage with the list/filters at all, which should
    // shape the mobile layout.
    if (currentStop >= 1 && window.innerWidth <= 768 && typeof window.track === "function") {
      try {
        if (!sessionStorage.getItem("drawer-expanded")) {
          sessionStorage.setItem("drawer-expanded", "1");
          window.track("drawer-expand", currentStop >= 2 ? "full" : "half");
        }
      } catch (e) {}
    }

    // Haptic-style flash on drag handle
    sidebar.classList.add("snap-flash");
    setTimeout(function () {
      sidebar.classList.remove("snap-flash");
    }, 200);
  }

  // Drag state
  var dragStartY = 0;
  var dragStartOffset = 0;
  var dragStartTime = 0;
  var isDragging = false;

  function getCurrentOffset() {
    return drawerStops[currentStop] || 0;
  }

  function onDragStart(clientY) {
    isDragging = true;
    dragStartY = clientY;
    dragStartOffset = getCurrentOffset();
    dragStartTime = Date.now();
    sidebar.classList.add("dragging");
  }

  var RUBBER_BAND_MAX = 30;

  function onDragMove(clientY, e) {
    if (!isDragging) return;
    var deltaY = clientY - dragStartY;
    var rawOffset = dragStartOffset + deltaY;
    var newOffset;
    if (rawOffset > drawerStops[0]) {
      // Rubber-band past peek: diminishing resistance
      var overscroll = rawOffset - drawerStops[0];
      newOffset =
        drawerStops[0] + RUBBER_BAND_MAX * (1 - Math.exp(-overscroll / 80));
    } else {
      newOffset = Math.max(0, rawOffset);
    }
    sidebar.style.setProperty("--drawer-offset", newOffset + "px");
    if (e) e.preventDefault();
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;

    var currentOffsetStr = sidebar.style.getPropertyValue("--drawer-offset");
    var currentOffset = parseInt(currentOffsetStr, 10) || 0;

    // If in rubber-band zone (past peek), snap back to peek
    if (currentOffset > drawerStops[0]) {
      snapDrawerTo(0);
      return;
    }

    var elapsed = (Date.now() - dragStartTime) / 1000;
    // positive velocity = dragging down (offset increasing = less visible)
    var velocity = (currentOffset - dragStartOffset) / elapsed;

    var VELOCITY_THRESHOLD = 300; // px/s
    var FAST_VELOCITY_THRESHOLD = 800; // px/s — skip to end stop

    var targetStop;
    if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
      var skipToEnd = Math.abs(velocity) > FAST_VELOCITY_THRESHOLD;
      if (velocity > 0) {
        // Flick down → less visible (lower stop index = higher offset)
        targetStop = skipToEnd ? 0 : Math.max(currentStop - 1, 0);
      } else {
        // Flick up → more visible (higher stop index = lower offset)
        targetStop = skipToEnd
          ? drawerStops.length - 1
          : Math.min(currentStop + 1, drawerStops.length - 1);
      }
    } else {
      // Snap to nearest stop
      var minDist = Infinity;
      targetStop = currentStop;
      for (var i = 0; i < drawerStops.length; i++) {
        var dist = Math.abs(currentOffset - drawerStops[i]);
        if (dist < minDist) {
          minDist = dist;
          targetStop = i;
        }
      }
    }

    snapDrawerTo(targetStop);
  }

  // Touch events — only drag handle initiates drawer drag
  dragHandle.addEventListener(
    "touchstart",
    function (e) {
      onDragStart(e.touches[0].clientY);
    },
    { passive: true },
  );

  dragHandle.addEventListener(
    "touchmove",
    function (e) {
      onDragMove(e.touches[0].clientY, e);
    },
    { passive: false },
  );

  dragHandle.addEventListener("touchend", onDragEnd);

  // Mouse events (for desktop testing)
  dragHandle.addEventListener("mousedown", function (e) {
    onDragStart(e.clientY);
    e.preventDefault();
  });

  document.addEventListener("mousemove", function (e) {
    onDragMove(e.clientY, e);
  });

  document.addEventListener("mouseup", onDragEnd);

  // Map click on mobile: snap to peek
  map.on("click", function () {
    if (window.innerWidth <= 768 && currentStop > 0) {
      snapDrawerTo(0);
    }
  });

  // Peek on load for mobile
  if (isMobileView) {
    calcDrawerStops();
    snapDrawerTo(0); // peek position
    setTimeout(function () {
      map.invalidateSize();
      if (allCoords.length && !window.location.hash) {
        map.fitBounds(allCoords, {
          paddingTopLeft: [20, 20],
          paddingBottomRight: [20, PEEK_HEIGHT],
        });
      }
    }, 350);
  }

  // Recalculate on resize / orientation change
  window.addEventListener("resize", function () {
    map.invalidateSize();
    if (window.innerWidth <= 768) {
      calcDrawerStops();
      snapDrawerTo(currentStop);
    }
  });

  // ── Utility ────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function slugify(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // ── Deep linking via URL hash ──────────────────

  // Build slug → restaurant lookup
  var slugMap = {};
  restaurants.forEach(function (r) {
    slugMap[slugify(r.name)] = r;
  });

  map.on("popupopen", function (e) {
    var popupLatLng = e.popup.getLatLng();
    var matchedSlug = null;
    markerMap.forEach(function (marker, name) {
      var ll = marker.getLatLng();
      if (
        Math.abs(ll.lat - popupLatLng.lat) < 0.0001 &&
        Math.abs(ll.lng - popupLatLng.lng) < 0.0001
      ) {
        matchedSlug = slugify(name);
      }
    });
    if (matchedSlug) {
      history.replaceState(null, "", "#" + matchedSlug);
    }
  });

  map.on("popupclose", function () {
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  });

  // On page load, check for hash and fly to restaurant
  function openFromHash() {
    var hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    var r = slugMap[hash];
    if (!r) return;
    var marker = markerMap.get(r.name);
    if (!marker) return;
    if (typeof window.track === "function") window.track("deeplink", r.name);

    if (window.innerWidth <= 768) {
      openDetailSheet(r, "map");
      return;
    }
    map.flyTo(mobileOffsetLatLng(r.lat, r.lng, 17), 17, { duration: 0.8 });
    // Short delay for cluster to resolve at new zoom
    setTimeout(function () {
      var parent = clusterGroup.getVisibleParent(marker);
      if (parent && parent !== marker) {
        parent.spiderfy();
        setTimeout(function () {
          marker.openPopup();
        }, 300);
      } else {
        marker.openPopup();
      }
    }, 300);
  }

  setTimeout(openFromHash, 300);
  window.addEventListener("hashchange", openFromHash);

  // ── Event Concluded modal ─────────────────────
  var concludedOverlay = document.getElementById("concludedOverlay");
  var concludedClose = document.getElementById("concludedClose");
  var concludedBanner = document.getElementById("concludedBanner");
  var concludedSeenKey = THEME.storageKey + "-concluded-seen";

  function openConcluded() {
    if (concludedOverlay) concludedOverlay.classList.add("open");
  }

  function closeConcluded() {
    if (concludedOverlay) concludedOverlay.classList.remove("open");
    try {
      localStorage.setItem(concludedSeenKey, "1");
    } catch (e) {}
  }

  // Wire up Tip Jar CTA — close concluded modal, open tip jar
  var concludedVenmo = document.getElementById("concludedVenmo");
  if (concludedVenmo) {
    concludedVenmo.addEventListener("click", function (e) {
      e.preventDefault();
      closeConcluded();
      var tipJarOverlay = document.getElementById("tipJarOverlay");
      if (tipJarOverlay) tipJarOverlay.classList.add("open");
    });
  }

  // Wire up Contact CTA
  var concludedContact = document.getElementById("concludedContact");
  if (concludedContact && THEME.contactDomain) {
    var year =
      (THEME.dataLiveDate || "").slice(0, 4) || new Date().getFullYear();
    var contactEmail =
      "sb" + THEME.itemLabel + "week" + year + "@" + THEME.contactDomain;
    concludedContact.href =
      "mailto:" +
      contactEmail +
      "?subject=" +
      encodeURIComponent("Ideas for next year");
  }

  // Close handlers
  if (concludedClose) {
    concludedClose.addEventListener("click", closeConcluded);
  }
  if (concludedOverlay) {
    concludedOverlay.addEventListener("click", function (e) {
      if (e.target === concludedOverlay) closeConcluded();
    });
  }

  // Banner + concluded logic based on event lifecycle state
  var bannerText = document.getElementById("concludedBannerText");

  function showBanner(text, clickHandler) {
    if (!concludedBanner) return;
    if (bannerText) bannerText.innerHTML = text;
    concludedBanner.style.display = "";
    if (clickHandler) {
      concludedBanner.addEventListener("click", clickHandler);
    }
    var app = document.querySelector(".app");
    if (app) {
      var bannerH = concludedBanner.offsetHeight;
      app.style.height = "calc(100dvh - 47px - " + bannerH + "px)";
    }
  }

  if (__eventState === "post-event") {
    showBanner(THEME.emoji + " " + THEME.eventName + " has wrapped! Thanks for joining.", openConcluded);
    // Auto-open concluded modal on first visit
    try {
      if (!localStorage.getItem(concludedSeenKey)) {
        openConcluded();
      }
    } catch (e) {
      openConcluded();
    }
  } else if (__eventState === "off-season") {
    if (THEME.nextEvent) {
      var ne = THEME.nextEvent;
      var neText = "Next up: <strong>" + ne.name + "</strong> | " + ne.dates;
      if (ne.url) {
        showBanner(neText, function () { window.open(ne.url, "_blank"); });
      } else {
        showBanner(neText);
      }
    } else {
      showBanner("Check back for the next event!");
    }
  }
})();
