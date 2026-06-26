// Food Week Map — Embed

(function () {
  "use strict";

  // On small screens the embed renders a map-only layout (sidebar hidden via
  // CSS) with a floating "Open full map" CTA, so phone readers still get an
  // interactive map inline instead of being bounced off the article.

  // ── Apply theme to page ──────────────────────────
  document.title = THEME.eventName + " Map";
  document.querySelector('link[rel="icon"]').href =
    "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>" +
    THEME.emoji +
    "</text></svg>";
  var embedTitle = document.getElementById("embedTitle");
  if (embedTitle) {
    embedTitle.innerHTML =
      THEME.eventName +
      ' <span class="embed-dates">| ' +
      THEME.eventDates +
      "</span>";
  }
  var embedFooterCta = document.getElementById("embedFooterCta");
  if (embedFooterCta) {
    embedFooterCta.href = THEME.siteUrl + "/?src=embed";
  }

  // ── Apply theme to About modal ─────────────────
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
  var embedStatsLink = document.getElementById("embedStatsLink");
  if (embedStatsLink) embedStatsLink.href = THEME.siteUrl + "/stats";
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

  // ── Map setup ──────────────────────────────────

  var map = L.map("map", {
    zoomControl: true,
    attributionControl: true,
  }).setView(THEME.mapCenter, THEME.mapZoom);

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

  var clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 30,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    spiderfyDistanceMultiplier: 1.5,
  });

  // ── Build markers ──────────────────────────────

  var markerMap = new Map();

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
          refreshOpenPopupUpvote();
        }
      })
      .catch(function () {
        /* silently ignore */
      });
  }

  function refreshOpenPopupUpvote() {
    var btn = document.querySelector(".leaflet-popup .upvote-btn");
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

  // ── Event lifecycle state ────────────────────
  var __eventState = getEventState();
  var __showUpvotes = __eventState !== "off-season";
  var __canVote = canCastVotes();

  // ── Hours data ──────────────────────────────
  var hoursData = {};
  var hoursLoaded = false;
  var activeHoursFilter = null;

  if (__eventState === "pre-event" || __eventState === "during")
  fetch("../../hours.json")
    .then(function (resp) {
      if (!resp.ok) throw new Error("not found");
      return resp.json();
    })
    .then(function (data) {
      if (data && typeof data === "object") {
        hoursData = data;
        hoursLoaded = true;
        var hf = document.getElementById("hoursFilters");
        if (hf) hf.style.display = "flex";
        renderList();
      }
    })
    .catch(function () {
      /* silently ignore */
    });

  function isOpenNow(name) {
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
        return true;
      }
    }
    return false;
  }

  function getOpenStatus(name) {
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
    for (var i = 0; i < entry.periods.length; i++) {
      var p = entry.periods[i];
      if (p.day === day && parseInt(p.open, 10) > timeNum) {
        return formatTime(p.open);
      }
    }
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
    var todayPeriods = entry.periods.filter(function (p) {
      return p.day === day;
    });
    if (todayPeriods.length === 0) return "Closed today";
    var ranges = [];
    for (var i = 0; i < todayPeriods.length; i++) {
      var p = todayPeriods[i];
      if (p.open === "0000" && p.close !== "2359" && todayPeriods.length > 1) {
        continue;
      }
      var closeTime = p.close;
      if (p.close === "2359") {
        var nextDayCarryover = entry.periods.filter(function (np) {
          return np.day === nextDay && np.open === "0000" && np.close !== "2359";
        });
        if (nextDayCarryover.length > 0) {
          closeTime = nextDayCarryover[0].close;
        }
      }
      ranges.push(formatTime(p.open) + "\u2013" + formatTime(closeTime));
    }
    return ranges.length > 0 ? ranges.join(", ") : "Closed today";
  }

  restaurants.forEach(function (r) {
    var color = AREA_COLORS[r.area] || "#999";

    var marker = L.circleMarker([r.lat, r.lng], {
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
      "</h3></div>";
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
          " Website</a>";
      if (r.instagram)
        popupHtml +=
          '<a href="https://instagram.com/' +
          encodeURIComponent(r.instagram) +
          '" target="_blank" rel="noopener" class="popup-dir-btn" title="Instagram">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>' +
          " Instagram</a>";
      if (r.phone)
        popupHtml +=
          '<a href="tel:' +
          r.phone +
          '" class="popup-dir-btn" title="' +
          escapeHtml(r.phone) +
          '">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>' +
          " Call</a>";
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

    var popupMaxWidth = window.innerWidth > 600 ? 360 : 240;
    marker.bindPopup(popupHtml, {
      maxWidth: popupMaxWidth,
      offset: [0, -4],
      closeButton: false,
    });

    marker.on("mouseover", function () {
      showEmojiOverlay([r.lat, r.lng]);
      this.openPopup();
    });

    clusterGroup.addLayer(marker);
    markerMap.set(r.name, marker);
  });

  map.addLayer(clusterGroup);

  // ── Cluster hover tooltip ────────────────────

  clusterGroup.on("clustermouseover", function (e) {
    var childMarkers = e.layer.getAllChildMarkers();
    var names = childMarkers
      .map(function (m) {
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

  // ── Emoji overlay ─────────────────────

  var emojiIcon = L.divIcon({
    html: '<span class="emoji-icon">' + THEME.emoji + "</span>",
    className: "emoji-icon-wrapper",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  map.createPane("emojiOverlay");
  map.getPane("emojiOverlay").style.zIndex = 750;

  var activeOverlay = null;

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

    // Track popup view
    var popupEl = e.popup.getElement();
    var h3 = popupEl && popupEl.querySelector("h3");
    if (h3 && typeof window.track === "function") {
      window.track("view", h3.textContent);
    }

    // Populate hours in popup
    if (hoursLoaded) {
      var hoursEl = popupEl && popupEl.querySelector(".popup-hours");
      if (hoursEl) {
        var hName = hoursEl.getAttribute("data-hours-name");
        if (hName && hoursData[hName]) {
          var popupStatus = getOpenStatus(hName);
          var dot = popupStatus === "open" ? "\uD83D\uDFE2" : popupStatus === "closing-soon" ? "\uD83D\uDFE1" : "\uD83D\uDD34";
          var statusText = popupStatus === "open" ? "Open" : popupStatus === "closing-soon" ? "Closing Soon" : "Closed";
          var todayStr = formatTodayHours(hName);
          hoursEl.innerHTML =
            '<span class="popup-hours-dot">' + dot + "</span> " +
            "<strong>" + statusText + "</strong> \u00B7 Today: " + todayStr;
        } else if (hName && hoursData[hName] === null) {
          hoursEl.innerHTML =
            '<span class="popup-hours-dot">\u26AA</span> Hours not available';
        }
      }
    }

    // Refresh upvote button state
    refreshOpenPopupUpvote();
  });

  map.on("popupclose", function () {
    removeEmojiOverlay();
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

  // Fit bounds to show all markers
  var allCoords = restaurants.map(function (r) {
    return [r.lat, r.lng];
  });
  if (allCoords.length) {
    map.fitBounds(allCoords, { padding: [30, 30] });
  }

  // ── Zoom reset control ──────────────────────────
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
          map.fitBounds(allCoords, { padding: [30, 30] });
        }
      });
      return container;
    },
  });
  new L.Control.ZoomReset().addTo(map);

  // ── Sidebar: area filter buttons ───────────────

  var areas = ["All"];
  restaurants.forEach(function (r) {
    if (areas.indexOf(r.area) === -1) areas.push(r.area);
  });

  var filtersEl = document.getElementById("areaFilters");
  areas.forEach(function (area) {
    var btn = document.createElement("button");
    btn.className = "area-btn" + (area === "All" ? " active" : "");
    btn.setAttribute("data-area", area);
    btn.textContent = area;
    filtersEl.appendChild(btn);
  });

  var activeArea = "All";

  // Hours filter buttons (hidden until hours.json loads)
  var hoursFilterSpan = document.createElement("span");
  hoursFilterSpan.id = "hoursFilters";
  hoursFilterSpan.className = "hours-filters";
  hoursFilterSpan.style.display = "none";
  var hoursDefs = THEME.hoursFilters || [
    { key: "open", icon: "\uD83D\uDFE2", label: "Open Now" },
    { key: "lunch", icon: "\u2600\uFE0F", label: "Lunch" },
    { key: "dinner", icon: "\uD83C\uDF19", label: "Dinner" },
  ];
  hoursDefs.forEach(function (h) {
    var btn = document.createElement("button");
    btn.className = "area-btn";
    btn.setAttribute("data-hours", h.key);
    btn.textContent = h.icon + " " + h.label;
    hoursFilterSpan.appendChild(btn);
  });
  filtersEl.parentNode.insertBefore(hoursFilterSpan, filtersEl.nextSibling);

  // ── Dietary tag filters (Vegetarian / Gluten-Free) — 1:1 with the desktop map.
  // Config icons are bare filenames resolved from the site root; the embed lives
  // at /embed/map/, so relative paths need a prefix to reach them.
  function tagIconSrc(icon) {
    return /^(https?:|\/|\.\.)/.test(icon) ? icon : "../../" + icon;
  }
  function getDietaryIconsHtml(r) {
    var html = "";
    (THEME.tagFilters || []).forEach(function (t) {
      if (r[t.key]) {
        html +=
          '<img src="' +
          tagIconSrc(t.icon) +
          '" alt="' +
          t.label +
          '" title="' +
          t.label +
          '" class="dietary-icon">';
      }
    });
    return html;
  }

  var tagDefs = THEME.tagFilters || [];
  var activeTag = null;
  var tagFilterSpan = document.createElement("span");
  tagFilterSpan.id = "tagFilters";
  tagFilterSpan.className = "hours-filters tag-filters";
  tagDefs.forEach(function (t) {
    var btn = document.createElement("button");
    btn.className = "area-btn";
    btn.setAttribute("data-tag", t.key);
    var img = document.createElement("img");
    img.src = tagIconSrc(t.icon);
    img.alt = t.label;
    img.className = "tag-icon";
    btn.appendChild(img);
    btn.appendChild(document.createTextNode(" " + t.label));
    tagFilterSpan.appendChild(btn);
  });
  if (tagDefs.length) {
    filtersEl.parentNode.insertBefore(tagFilterSpan, hoursFilterSpan);
  }

  tagFilterSpan.addEventListener("click", function (e) {
    var btn = e.target.closest(".area-btn");
    if (!btn) return;
    var tagKey = btn.getAttribute("data-tag");
    if (activeTag === tagKey) {
      activeTag = null;
      btn.classList.remove("active");
    } else {
      tagFilterSpan.querySelectorAll(".area-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      activeTag = tagKey;
      btn.classList.add("active");
    }
    if (typeof window.track === "function") window.track("filter-tag", tagKey);
    renderList();
  });

  filtersEl.addEventListener("click", function (e) {
    if (!e.target.classList.contains("area-btn")) return;
    filtersEl.querySelectorAll(".area-btn").forEach(function (b) {
      b.classList.remove("active");
    });
    e.target.classList.add("active");
    activeArea = e.target.getAttribute("data-area");
    renderList();
  });

  hoursFilterSpan.addEventListener("click", function (e) {
    var btn = e.target.closest(".area-btn");
    if (!btn) return;
    var hoursKey = btn.getAttribute("data-hours");
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
    renderList();
  });

  // ── Sidebar: restaurant list ───────────────────

  var searchTerm = "";
  var searchBox = document.getElementById("searchBox");

  var searchTrackTimer = null;
  var lastFilteredCount = 0;
  searchBox.addEventListener("input", function () {
    searchTerm = this.value.toLowerCase().trim();
    renderList();
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

  function renderList() {
    var listEl = document.getElementById("restaurantList");
    var countEl = document.getElementById("restaurantCount");
    listEl.innerHTML = "";

    clusterGroup.clearLayers();

    var filtered = restaurants.filter(function (r) {
      var matchesArea = activeArea === "All" || r.area === activeArea;
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
      var matchesTags = !activeTag || r[activeTag];
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
      var marker = markerMap.get(r.name);
      if (marker) {
        clusterGroup.addLayer(marker);
        updateMarkerOpacity(r.name);
      }

      var li = document.createElement("li");
      li.className = "restaurant-item";
      var isChecked = checkedSet.has(r.name);
      if (checklistMode && !isChecked) {
        li.classList.add("unchecked");
      }

      if (checklistMode) {
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "checklist-checkbox";
        cb.checked = isChecked;
        cb.addEventListener("change", function (e) {
          e.stopPropagation();
          if (this.checked) {
            checkedSet.add(r.name);
            li.classList.remove("unchecked");
          } else {
            checkedSet.delete(r.name);
            li.classList.add("unchecked");
          }
          saveChecklist();
          updateMarkerOpacity(r.name);
          updateFabCount();
        });
        li.appendChild(cb);
      }

      var nameCol = document.createElement("div");
      nameCol.className = "name-col";

      var nameSpan = document.createElement("span");
      nameSpan.className = "name";
      nameSpan.textContent = r.name;
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
        map.flyTo([r.lat, r.lng], 17, { duration: 0.8 });
        setTimeout(function () {
          if (marker) {
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

    var coords = filtered.map(function (r) {
      return [r.lat, r.lng];
    });
    if (coords.length) {
      map.fitBounds(coords, { padding: [30, 30] });
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

      var fab = L.DomUtil.create("button", "fab-btn", wrapper);
      fab.title = "Select & Print";
      fab.setAttribute("aria-label", "Select & Print");
      fab.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

      var toolbar = L.DomUtil.create("div", "fab-toolbar", wrapper);

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

      L.DomEvent.on(fab, "click", function (e) {
        L.DomEvent.preventDefault(e);
        checklistMode = !checklistMode;
        wrapper.classList.toggle("active", checklistMode);
        updateFabCount();
        renderList();
      });

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

      if (window.innerWidth <= 600) {
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
        listHtml +=
          '<div style="font-weight:700;font-size:0.95rem"><span style="display:inline-block;background:' +
          (AREA_COLORS[r.area] || "#999") +
          ';color:#fff;width:22px;height:22px;border-radius:50%;text-align:center;line-height:22px;font-size:11px;margin-right:6px">' +
          n +
          "</span>" +
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
        THEME.emoji +
        " " + (THEME.venmoNote || "Enjoyed the map?") + "</div>" +
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

  window.addEventListener("resize", function () {
    map.invalidateSize();
  });

  // ── Utility ──────────────────────────────────

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

  // Redirect hash links to the main site
  function redirectHash() {
    var hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      window.location.replace(THEME.siteUrl + "/#" + hash);
    }
  }

  redirectHash();

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

  // Tip Jar CTA — close concluded modal, open tip jar
  var concludedVenmo = document.getElementById("concludedVenmo");
  if (concludedVenmo) {
    concludedVenmo.addEventListener("click", function (e) {
      e.preventDefault();
      closeConcluded();
      var tipJarOverlay = document.getElementById("tipJarOverlay");
      if (tipJarOverlay) tipJarOverlay.classList.add("open");
    });
  }

  // Contact CTA
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
      app.style.height = "calc(100% - 36px - " + bannerH + "px)";
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
