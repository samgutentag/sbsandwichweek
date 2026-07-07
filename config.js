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
  sourceUrl: "https://www.independent.com/2026/06/24/santa-barbaras-sandwich-week-returns/",

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

  // Event timezone — phase changes (pre/during/post) happen on this clock,
  // not the viewer's. IANA name, e.g. "America/Los_Angeles".
  timeZone: "America/Los_Angeles",

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
  dataLiveDate: "2026-06-22",

  // Archived — event is wound down; drives the off-season state while
  // trackUrl stays set so stats/admin keep reading historical data.
  archived: true,

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
    { key: "vegetarian", icon: "icon-vegetarian.svg", label: "Vegetarian" },
    { key: "glutenFree", icon: "icon-gf.svg", label: "Gluten-Free" },
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

// Participation history — map of restaurant name -> first year they joined SB Sandwich Week.
// Anything not listed is treated as a first-timer this year (no badge). The popup badge only
// shows for 2+ years of participation. Add a name with its first year as restaurants return.
// Sourced from the 2025 lineup: independent.com/2025/06/25/santa-barbaras-first-ever-sandwich-week/
THEME.firstYearByName = {
  "CAYA Restaurant and Bar": 2025,
  "Cristino's Bakery": 2025,
  "Crushcakes & Cafe": 2025,
  "Dutch Garden Restaurant": 2025,
  "Gino's Sicilian Express": 2025,
  "Mission City Sandwich Shop": 2025,
  "Norton's Pastrami & Deli": 2025,
  "Panino": 2025,
  "Poke House": 2025,
  "Rinkside Cafe": 2025,
  "Santa Barbara Fish Market": 2025,
  "South Coast Deli": 2025,
  "Valentino's Take N' Bake Pizza": 2025,
  "Validation Ale": 2025,
  "Yellow Belly": 2025,
  // Dave's Drip House: returning since 2025 (was "Dave's Drip House x J's Hot Chicken").
  "Dave's Drip House": 2025,
};
