// Theme configuration — edit this file to rebrand for your food event.
// After editing, run: python3 apply-theme.py
// This updates og-image, CNAME, HTML fallbacks, and README to match.

const THEME = {
  // Event identity
  eventName: "SB Sandwich Week 2026",
  eventDates: "Jun 25–Jul 1",
  emoji: "🥪",

  // OG image text (two lines for the social preview image)
  ogLine1: "Santa Barbara",
  ogLine2: "Sandwich Week 2026",

  // Labels (what to call the featured item)
  itemLabel: "sandwich",
  itemLabelPlural: "sandwiches",

  // Site URL (used for OG meta tags, embed snippets, print page)
  siteUrl: "https://sbsandwichweekmap.com",

  // Description (used for meta tags)
  description:
    "Interactive map of all participating restaurants. Search, filter by area, and get directions.",

  // Header — link to the source article announcing your event
  sourceLabel: "Source: The Independent",
  sourceUrl: "https://www.independent.com/2026/06/11/sandwich-week-2026/",

  // Venmo tip jar (set venmoUser to null to hide the tip jar entirely)
  venmoUser: "samgutentag",
  venmoNote: "Buy me a sandwich?",

  // Tip jar tiers — size: "s" (custom emoji), "m" (half theme emoji), "l" (full theme emoji)
  // The "m" tier gets an orange featured border. Tracking events: tip-s, tip-m, tip-l
  tipTiers: [
    { size: "s", label: "Side of Fries", emoji: "🍟", amount: 1 },
    { size: "m", label: "Half a Sandwich", amount: 5 },
    { size: "l", label: "Full Sandwich", amount: 10 },
  ],

  // LocalStorage namespace (unique per event to avoid collisions)
  storageKey: "sbsandwichweek-checklist",

  // Print page
  printTitle: "SB Sandwich Week 2026 — My Picks",

  // Event start date — used for analytics/stats time filters (ISO date)
  eventStartDate: "2026-06-25",

  // Event end date — concluded banner/modal auto-shows after this date (ISO date, null to never show)
  eventEndDate: "2026-07-01",

  // Map center and zoom level — [latitude, longitude]
  mapCenter: [34.42, -119.7],
  mapZoom: 13,

  // GitHub repo URL (used in About modal and footer)
  githubRepoUrl: "https://github.com/samgutentag/sbsandwichweek",

  // Data launch date — before this date, data.js (skeleton) loads.
  // On or after this date, data-<year>.js (full menu details) loads.
  // Format: "YYYY-MM-DD" in local time, activates at 12:01 AM. Set null to always load full data.
  dataLiveDate: "2026-06-24",

  // Event tracking — Cloudflare Worker URL (null to disable, see README Step 9)
  trackUrl: "https://sbsandwichweek-track.developer-95b.workers.dev",

  // Cloudflare Web Analytics (null to disable, see README Step 8)
  cfAnalyticsToken: null,

  // Contact email domain — auto-generates sb{itemLabel}week{year}@{domain}
  // Set null to hide the contact link in the About modal
  contactDomain: "samgutentag.com",

  // Tag filters — category filters shown in the search/filter menu.
  // Each key must match a boolean property on restaurant objects in your data file.
  // Example: if you define { key: "vegetarian", ... }, each restaurant needs vegetarian: true/false.
  // Icons can be emoji strings ("🌱") or SVG filenames ("icon-vegetarian.svg") in the repo root.
  tagFilters: [
    // Define once you know what filters make sense for sandwiches
    // { key: "hotSandwich", icon: "🔥", label: "Hot" },
    // { key: "coldSandwich", icon: "🧊", label: "Cold" },
    // { key: "vegetarian", icon: "🌱", label: "Vegetarian" },
  ],

  // Hours filters — time-of-day filters (hidden until hours.json loads, see README Step 11)
  hoursFilters: [
    { key: "open", icon: "🟢", label: "Open Now" },
    { key: "lunch", icon: "☀️", label: "Lunch" },
    { key: "dinner", icon: "🌙", label: "Dinner" },
  ],

  // Google Places API key — documentation only, actual key goes in GitHub Secrets
  googlePlacesApiKey: null,
};

// Next event promo (shown in off-season banner). null for generic "check back" message.
THEME.nextEvent = null;

function getEventState() {
  var now = new Date();
  var liveDate = THEME.dataLiveDate ? new Date(THEME.dataLiveDate + "T00:01:00") : null;
  var startDate = THEME.eventStartDate ? new Date(THEME.eventStartDate + "T00:00:00") : null;
  var endDate = THEME.eventEndDate ? new Date(THEME.eventEndDate + "T23:59:59") : null;
  if (!THEME.trackUrl) return "off-season";
  if (endDate && now > endDate) return "post-event";
  if (startDate && now >= startDate) return "during";
  if (liveDate && now >= liveDate) return "pre-event";
  return "off-season";
}

function canCastVotes() {
  var state = getEventState();
  if (state === "pre-event" || state === "during") return true;
  if (state === "post-event" && THEME.eventEndDate) {
    var grace = new Date(THEME.eventEndDate + "T23:59:59");
    grace.setDate(grace.getDate() + 5);
    return new Date() <= grace;
  }
  return false;
}
