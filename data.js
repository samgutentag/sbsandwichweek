// Food Week — Restaurant Data (Skeleton)
// This file loads before the event data launch date (config.js → dataLiveDate).
// Restaurants appear on the map but menuItems are empty ("Details coming soon!").
// Copy this file to data-YYYY.js and populate menuItems for the live event.

const SOURCE_URL = "https://example.com/your-event-article";

// Area colors — define geographic zones and their marker colors.
// Each restaurant's `area` field must match a key here.
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
    menuItems: [],
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
    menuItems: [],
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
    menuItems: [],
  },
];
