// Food Week — Restaurant Data (Full Example)
// Copy this file to data-YYYY.js (e.g. data-2026.js) for your event.
// This is the version with populated menuItems that loads on/after dataLiveDate.

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
