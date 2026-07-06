// Event lifecycle behavior — template-owned. Event values live in config.js.
// Every page loads this immediately after config.js.

// Event year, derived from eventStartDate — used for the returning-restaurant
// badge math and the data-<year>.js loader convention.
THEME.eventYear = THEME.eventStartDate
  ? parseInt(THEME.eventStartDate.slice(0, 4), 10)
  : new Date().getFullYear();

// Milliseconds the event timezone is offset from UTC at the given instant.
function eventTzOffsetMs(date) {
  var parts = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: THEME.timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(date).forEach(function (p) { parts[p.type] = p.value; });
  var asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return asUtc - date.getTime();
}

// The instant when the event-timezone wall clock reads dateStr + timeStr.
// A bare new Date("YYYY-MM-DDTHH:MM:SS") would use the viewer's timezone,
// making phase boundaries drift by the viewer's offset from the event.
function eventDate(dateStr, timeStr) {
  var wallClock = new Date(dateStr + "T" + (timeStr || "00:00:00") + "Z");
  if (!THEME.timeZone) {
    return new Date(dateStr + "T" + (timeStr || "00:00:00"));
  }
  try {
    var guess = new Date(wallClock.getTime() - eventTzOffsetMs(wallClock));
    // Second pass so instants near a DST transition resolve with that side's offset
    return new Date(wallClock.getTime() - eventTzOffsetMs(guess));
  } catch (e) {
    return new Date(dateStr + "T" + (timeStr || "00:00:00"));
  }
}

// Lifecycle: off-season → pre-event → during → post-event → (archived) off-season.
// THEME.archived is the explicit wind-down switch; trackUrl is only "where the
// Worker lives" and never drives state.
function getEventState() {
  if (THEME.archived) return "off-season";
  var now = new Date();
  var liveDate = THEME.dataLiveDate ? eventDate(THEME.dataLiveDate, "00:01:00") : null;
  var startDate = THEME.eventStartDate ? eventDate(THEME.eventStartDate, "00:00:00") : null;
  var endDate = THEME.eventEndDate ? eventDate(THEME.eventEndDate, "23:59:59") : null;
  if (endDate && now > endDate) return "post-event";
  if (startDate && now >= startDate) return "during";
  if (liveDate && now >= liveDate) return "pre-event";
  return "off-season";
}

function canCastVotes() {
  var state = getEventState();
  if (state === "pre-event" || state === "during") return true;
  if (state === "post-event" && THEME.eventEndDate) {
    var grace = new Date(eventDate(THEME.eventEndDate, "23:59:59").getTime() + 5 * 86400000);
    return new Date() <= grace;
  }
  return false;
}
