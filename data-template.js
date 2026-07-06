// Food Week — Restaurant Data (Full Example)
// Copy this file to data-YYYY.js (e.g. data-2026.js) for your event —
// the year must match eventStartDate's year (the loader picks data-<year>.js).
// Better: python3 scripts/registry.py pull prefills known venues from the
// shared registry in the template repo.
//
// DATA CONTRACT — every data file must define three globals:
//   SOURCE_URL   string — the announcing article (map/embed source link)
//   AREA_COLORS  { "Area Name": "#hex" } — every restaurant.area must be a key;
//                use the canonical SB region names from the registry
//   restaurants  array of restaurant objects, fields in this order:
//     name         string. " (Location)" suffix splits multi-location pins;
//                  the returning badge strips it when matching firstYearByName
//     address      string
//     area         string, an AREA_COLORS key
//     lat, lng     numbers
//     mapUrl       Google Maps link — a maps.app.goo.gl share link or the
//                  search-URL fallback: https://www.google.com/maps/search/?api=1&query=<encoded name+address>
//     appleMapsUrl Apple Maps link or null (registry preserves these — capture once)
//     website      URL or null
//     phone        "805-555-1234" or null
//     instagram    handle without @, or null
//     <tag keys>   one boolean per key in config.js tagFilters, on EVERY object
//     menuItems    [{ name, description }] — description: null renders
//                  "coming soon"; the data.js skeleton uses menuItems: []
//
// The skeleton/full split: data.js (menuItems: []) loads before dataLiveDate,
// data-<year>.js after. Keep both files' restaurant lists in sync.
// Preview the skeleton anytime with ?year=9999.

const SOURCE_URL = "https://example.com/your-event-article";

const AREA_COLORS = {
  Downtown: "#e63946",
  Westside: "#457b9d",
  Eastside: "#2a9d8f",
  Midtown: "#e9c46a",
};

const restaurants = [
  {
    name: "Example Restaurant",
    address: "123 State St, Santa Barbara, CA 93101",
    area: "Downtown",
    lat: 34.4208,
    lng: -119.6982,
    mapUrl: "https://maps.app.goo.gl/example",
    appleMapsUrl: null,
    website: "https://example.com",
    phone: "805-555-1234",
    instagram: "example_restaurant",
    menuItems: [
      { name: "The Signature", description: "House specialty with all the fixings." },
      { name: "The Veggie", description: null },
    ],
  },
  {
    name: "Another Restaurant",
    address: "456 De La Vina St, Santa Barbara, CA 93101",
    area: "Westside",
    lat: 34.4268,
    lng: -119.7110,
    mapUrl: "https://maps.app.goo.gl/example2",
    appleMapsUrl: null,
    website: null,
    phone: null,
    instagram: null,
    menuItems: [
      { name: "Classic Style", description: "Traditional preparation done right." },
    ],
  },
  {
    name: "Third Place (Downtown)",
    address: "789 Cabrillo Blvd, Santa Barbara, CA 93103",
    area: "Downtown",
    lat: 34.4145,
    lng: -119.6868,
    mapUrl: "https://maps.app.goo.gl/example3",
    appleMapsUrl: null,
    website: "https://thirdplace.example.com",
    phone: "805-555-9876",
    instagram: "thirdplace",
    menuItems: [
      { name: "The Monster", description: "Double portion with house sauce." },
      { name: "The Light One", description: "Smaller portion, big on flavor." },
    ],
  },
];
