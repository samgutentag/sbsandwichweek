// MOCK DATA for local development — obviously fake venues and menus.
// Event: February 19–25, 2026
// Source: Santa Barbara Independent
const SOURCE_URL = "https://example.com/your-event-article";

const AREA_COLORS = {
  "Downtown SB": "#e63946",
  Goleta: "#2d6a4f",
  Carpinteria: "#1d3557",
  "Isla Vista": "#7b2cbf",
  "Santa Ynez": "#e76f51",
  "Other SB": "#e07a5f",
};

const restaurants = [
  // --- Downtown SB ---
  {
    name: "Arnoldi's",
    address: "600 Olive St., Santa Barbara, CA",
    website: "https://www.arnoldis.com/",
    phone: "805-962-5394",
    instagram: "arnoldiscafesb",
    area: "Downtown SB",
    lat: 34.423278,
    lng: -119.691155,
    mapUrl: "https://maps.app.goo.gl/UUefNcGFbYjGUNPd7",
    appleMapsUrl: "https://maps.apple/p/U3gWeWbcVqKjsb",
    menuItems: [
      {
        name: "The Big Arnoldi",
        description:
          "A half-pound certified Angus beef patty seared on a flat-top griddle until a deep golden crust forms, then layered with two slices of aged sharp cheddar that melt into every crevice of the meat. Nestled on a buttery brioche bun with crisp butter lettuce, vine-ripened tomato, thinly sliced red onion, house-made garlic aioli, and a tangy bread-and-butter pickle spear on the side.",
      },
    ],
  },
  {
    name: "Downtown Eats",
    address: "634 State St., Santa Barbara, CA",
    website: "https://www.yelp.com/biz/downtown-eats-santa-barbara",
    phone: "805-453-9796",
    instagram: "downtowneats_sb",
    area: "Downtown SB",
    lat: 34.418771,
    lng: -119.697599,
    mapUrl: "https://maps.app.goo.gl/Xk6icnj39UPAacR47",
    appleMapsUrl: "https://maps.apple/p/CH80ruBx0tokCj",
    menuItems: [
      {
        name: "State Street Smash",
        description:
          "Two thin beef patties smashed crispy on a screaming-hot griddle, each crowned with a blanket of melty American cheese that fuses to the lacy burger edges. Stacked on a soft potato roll with shredded iceberg lettuce, diced white onion, ketchup, yellow mustard, and a generous spread of smoky chipotle mayo that gives every bite a slow-building kick.",
      },
    ],
  },
  {
    name: "Dom's Taverna",
    address: "30 E. Victoria St., Santa Barbara, CA",
    website: "https://www.domstaverna.com/",
    phone: "805-724-4338",
    instagram: "domstaverna",
    area: "Downtown SB",
    lat: 34.424864,
    lng: -119.704726,
    mapUrl: "https://maps.app.goo.gl/C1E679wZKXZsSLpj8",
    appleMapsUrl: "https://maps.apple/p/xvK6mAKKw55U4p",
    menuItems: [
      {
        name: "The Greek Smash",
        description:
          "A juicy quarter-pound beef patty grilled over open flame with crumbled feta and a thick slice of provolone melted on top, finished with roasted red peppers, shaved cucumber, and a drizzle of tzatziki. Served on a warm sesame-crusted bun with a handful of peppery arugula, sliced Kalamata olives, and a squeeze of fresh lemon that brightens every single bite.",
      },
    ],
  },
  {
    name: "Eureka!",
    address: "601 Paseo Nuevo, Santa Barbara, CA",
    website: "https://eurekarestaurantgroup.com/locations/santa-barbara",
    phone: "805-618-3388",
    instagram: "eurekasantabarbara",
    area: "Downtown SB",
    lat: 34.418597,
    lng: -119.700307,
    mapUrl: "https://maps.app.goo.gl/Gsya1VEdNZBjPmoD8",
    appleMapsUrl: "https://maps.apple/p/o6XV_nkn5Yobot",
    menuItems: [
      {
        name: "Eureka Gold Rush",
        description:
          "A thick hand-formed patty of grass-fed beef cooked medium with a caramelized onion jam and double layer of gruyere cheese that pools into a golden, nutty blanket across the top. Pressed into a toasted pretzel bun slathered with whole-grain mustard aioli, topped with thick-cut applewood-smoked bacon, butter lettuce, and house-pickled jalapenos for a sweet and spicy finish.",
      },
    ],
  },
  {
    name: "Finch and Fork",
    address: "31 W. Carrillo St., Santa Barbara, CA",
    website: "https://www.finchandforkrestaurant.com/",
    phone: "805-879-9100",
    instagram: "finchandfork",
    area: "Downtown SB",
    lat: 34.420427,
    lng: -119.702788,
    mapUrl: "https://maps.app.goo.gl/ypafV2iQED8v5vYeA",
    appleMapsUrl: "https://maps.apple/p/P6GFr7sFA.Xmp-",
    menuItems: [
      {
        name: "The Hotel Burger",
        description:
          "A premium eight-ounce dry-aged beef patty charbroiled to a perfect medium-rare and topped with a generous portion of melted brie and white cheddar that oozes down the sides. Served on a house-baked challah bun with arugula, heirloom tomato, caramelized shallots, truffle aioli, and a cornichon relish that adds a bright, tangy crunch to every luxurious bite.",
      },
    ],
  },
  {
    name: "Fresco At The Market",
    address: "38 W. Victoria St. Ste. 102, Santa Barbara, CA",
    website: "https://www.fresco-sb.com/",
    phone: "805-770-7994",
    instagram: "fresco_sb",
    area: "Downtown SB",
    lat: 34.423601,
    lng: -119.707027,
    mapUrl: "https://maps.app.goo.gl/a7gmQtRfSGiXUdR37",
    appleMapsUrl: "https://maps.apple/p/9pZqFtJLsFJMmn",
    menuItems: [
      {
        name: "Market Fresh Burger",
        description:
          "A hand-pressed patty of locally sourced beef grilled over mesquite charcoal, topped with a thick slab of smoked gouda and a slice of sharp white cheddar that meld together as they melt. Piled on a fresh-baked ciabatta roll with mixed baby greens, roasted garlic cloves, sun-dried tomato spread, and paper-thin rings of sweet Vidalia onion for a satisfying farmers-market-inspired cheeseburger.",
      },
    ],
  },
  {
    name: "Gala",
    address: "705 Anacapa St., Santa Barbara, CA",
    website: "https://www.galasb.com/",
    phone: "805-869-2813",
    instagram: "galarestaurantsb",
    area: "Downtown SB",
    lat: 34.41977,
    lng: -119.697264,
    mapUrl: "https://maps.app.goo.gl/5z5GXb8SGmx14QGn8",
    appleMapsUrl: "https://maps.apple/p/hFLAzvWWQkJEUn",
    menuItems: [
      {
        name: "Gala Night Burger",
        description:
          "A six-ounce Wagyu-blend patty pan-seared in clarified butter until the edges are deeply caramelized, then draped with aged fontina and a crumble of tangy blue cheese. Assembled on a warm black sesame bun with thinly shaved fennel, watercress, a spoonful of bourbon-bacon jam, and a light drizzle of balsamic reduction that ties the rich and savory flavors together beautifully.",
      },
    ],
  },
  {
    name: "Goat Tree",
    address: "36 State St., Santa Barbara, CA",
    website: "https://www.hotelcalifornian.com/goat-tree.htm",
    phone: "805-882-0137",
    instagram: "hotelcalifornian",
    area: "Downtown SB",
    lat: 34.413505,
    lng: -119.690624,
    mapUrl: "https://maps.app.goo.gl/h4TARh9WuJcSLujF9",
    appleMapsUrl: "https://maps.apple/p/PcPGZE_I~qS5LH",
    menuItems: [
      {
        name: "The Coastline Classic",
        description:
          "A thick-cut patty of prime chuck and short rib blend cooked over an oak-wood grill, topped with two slices of Tillamook medium cheddar that wrap around the patty in a gooey embrace. Set on a butter-toasted sourdough bun with crispy shallot strings, bread-and-butter pickles, a smear of roasted garlic mayo, and peppery wild arugula that cuts through the richness perfectly.",
      },
    ],
  },
  {
    name: "Little Bird Kitchen",
    address: "38 W. Victoria St., Santa Barbara, CA",
    website: "https://www.littlebirdsb.com",
    phone: "805-303-7865",
    instagram: "littlebird_sb",
    area: "Downtown SB",
    lat: 34.423532,
    lng: -119.70699,
    mapUrl: "https://maps.app.goo.gl/2y4qVPcjub2o29dKA",
    appleMapsUrl: "https://maps.apple/p/mC3RDF86ZgNghN",
    menuItems: [
      {
        name: "Little Bird Smash",
        description:
          "Three ultra-thin beef patties smashed until crispy and laced together with melted American cheese between each layer, creating a towering stack of savory crunch and gooey goodness. Tucked into a pillowy Martin's potato roll with shredded lettuce, minced white onion, tangy yellow mustard, ketchup, and a secret-recipe burger sauce that keeps regulars coming back week after week.",
      },
    ],
  },
  {
    name: "Pascucci",
    address: "1230-A State St., Santa Barbara, CA",
    website: "https://www.pascuccirestaurant-sb.com",
    phone: "805-963-8123",
    instagram: "pascuccirestaurantsb",
    area: "Downtown SB",
    lat: 34.424304,
    lng: -119.705252,
    mapUrl: "https://maps.app.goo.gl/Np3d4iumbLR7txnS9",
    appleMapsUrl: "https://maps.apple/p/.acg2UBX9RIsmD",
    menuItems: [
      {
        name: "The Italian Stallion",
        description:
          "A hearty beef and Italian sausage blend patty seasoned with fennel and red pepper flakes, griddled until charred at the edges and topped with a generous layer of molten mozzarella and shaved Parmigiano-Reggiano. Served on a garlic-rubbed focaccia with fresh basil leaves, slow-roasted cherry tomatoes, a spoonful of house-made marinara, and a final drizzle of peppery extra-virgin olive oil.",
      },
    ],
  },
  {
    name: "Poke House",
    address: "811 State St. Ste. D, Santa Barbara, CA",
    website: "https://www.poke.house/",
    phone: "805-869-2722",
    instagram: "poke.house",
    area: "Downtown SB",
    lat: 34.419647,
    lng: -119.700116,
    mapUrl: "https://maps.app.goo.gl/yELnA6Nf6gKkUnq28",
    appleMapsUrl: "https://maps.apple/p/prDjK9G_-rFP.K",
    menuItems: [
      {
        name: "Ahi Cheese Burger",
        description:
          "A seared ahi tuna patty crusted with black and white sesame seeds, served rare in the center and topped with a melted slice of pepper jack cheese that adds creamy heat. Placed on a warm Hawaiian sweet roll with crisp napa cabbage slaw, pickled ginger, sliced avocado, a squeeze of Sriracha mayo, and a wasabi-soy drizzle that brings bold Pacific Rim flavors together.",
      },
    ],
  },
  {
    name: "Que Smoke Shack",
    address: "38 W. Victoria St., Santa Barbara, CA",
    website: "https://www.quesmokeshack.com",
    phone: "805-869-2193",
    instagram: "quesmokeshack",
    area: "Downtown SB",
    lat: 34.423601,
    lng: -119.707027,
    mapUrl: "https://maps.app.goo.gl/JjMZXMkxcnsDEBLm7",
    appleMapsUrl: "https://maps.apple/p/ocM85RZ2z3h26k",
    menuItems: [
      {
        name: "Smokestack Cheddar",
        description:
          "A slow-smoked beef brisket patty ground fresh daily and seared on a cast-iron flat-top, layered with two thick slices of smoked cheddar and a heap of tangy vinegar-based coleslaw piled right on top. Served on a toasted jalape\u00f1o-cheddar bun with sweet and smoky barbecue sauce, crispy tobacco onions, dill pickle chips, and a side of creamy ranch for dipping your fries.",
      },
    ],
  },
  {
    name: "SB Biergarten",
    address: "11 Anacapa St., Santa Barbara, CA",
    website: "https://www.beersantabarbara.com",
    phone: "805-856-6694",
    instagram: "sbbiergarten",
    area: "Downtown SB",
    lat: 34.413321,
    lng: -119.688943,
    mapUrl: "https://maps.app.goo.gl/sSgP1bi7teQWbd2p9",
    appleMapsUrl: "https://maps.apple/p/dUKud0Wn3XcgJw",
    menuItems: [
      {
        name: "Bavarian Burger",
        description:
          "A half-pound beef patty seasoned with caraway and black pepper, grilled over charcoal and topped with melted raclette cheese that is scraped tableside right onto the sizzling meat. Loaded onto a freshly baked pretzel bun with whole-grain beer mustard, sauerkraut braised in pilsner, crispy fried onion straws, and a leaf of butter lettuce that adds a cool, fresh contrast to every hearty bite.",
      },
    ],
  },
  {
    name: "The Brewhouse",
    address: "229 W Montecito St., Santa Barbara, CA",
    website: "https://www.sbbrewhouse.com",
    phone: "805-884-4664",
    instagram: "sbbrewhouse",
    area: "Downtown SB",
    lat: 34.411938,
    lng: -119.695913,
    mapUrl: "https://maps.app.goo.gl/u86a8XNtQ9gM7DfW6",
    appleMapsUrl: "https://maps.apple/p/Ua9iRD~BAuQ5s.z",
    menuItems: [
      {
        name: "Brewmaster Double",
        description:
          "Two quarter-pound beef patties stacked tall with a slice of colby jack melted onto each one, sandwiched between layers of thick-cut bacon and crispy beer-battered onion rings dripping with malt vinegar. Pressed onto a toasted egg bun with house-made IPA cheese sauce, shredded romaine, sliced kosher dill pickles, and a tangy hop-infused aioli that ties the whole thing together in hoppy harmony.",
      },
    ],
  },
  {
    name: "Seoulmate Kitchen",
    address: "38 W. Victoria St. Ste. 115, Santa Barbara, CA",
    website: "https://www.seoulmatekitchen.com",
    phone: "805-869-2566",
    instagram: "seoulmate_kitchen",
    area: "Downtown SB",
    lat: 34.423601,
    lng: -119.707027,
    mapUrl: "https://maps.app.goo.gl/xzV7swXZ83gfgELA6",
    appleMapsUrl: "https://maps.apple/p/IAXTbR~k-gkNIa",
    menuItems: [
      {
        name: "K-Town Cheese Burger",
        description:
          "A gochujang-glazed beef patty seared on a hot stone griddle until deeply caramelized, then topped with a melted layer of mild provolone and a fried egg with a runny golden yolk. Served on a steamed milk bun with quick-pickled daikon and carrot, crispy kimchi, a swirl of spicy kewpie mayo, toasted sesame seeds, and thinly sliced scallions for a bold Korean-inspired twist.",
      },
    ],
  },
  {
    name: "Shalhoob's Funk Zone Patio",
    address: "220 Gray Ave., Santa Barbara, CA",
    website: "https://www.shalhoob.com",
    phone: "805-963-7733",
    instagram: "shalhoobmeatco",
    area: "Downtown SB",
    lat: 34.416328,
    lng: -119.690533,
    mapUrl: "https://maps.app.goo.gl/V86GgAv3aB1vH7As8",
    appleMapsUrl: "https://maps.apple/p/y~H7PBSHU37cZZ",
    menuItems: [
      {
        name: "Funk Zone Melt",
        description:
          "A thick patty of prime beef blended with bone marrow butter, cooked to a juicy medium on an open flame grill and smothered in a bubbling layer of aged gruyere and fontina cheese. Pressed between two slices of griddled sourdough bread with caramelized onions, Dijon mustard, bread-and-butter pickles, and a handful of crispy shoestring fries stuffed right inside for an irresistible crunch.",
      },
    ],
  },
  {
    name: "The Blue Owl",
    address: "5 W. Canon Perdido, Santa Barbara, CA",
    website: "https://www.theblueowlsb.com",
    phone: "805-705-0991",
    instagram: "blueowlsb",
    area: "Downtown SB",
    lat: 34.420052,
    lng: -119.7009,
    mapUrl: "https://maps.app.goo.gl/1h1oVTPVCz5xG1tg9",
    appleMapsUrl: "https://maps.apple/p/afaRbEdoeqivz_",
    menuItems: [
      {
        name: "Night Owl Double",
        description:
          "Two hand-formed patties of grass-fed beef stacked with a generous double dose of melted Havarti and a crispy hash brown patty wedged between the layers for a satisfying late-night crunch. Built on a toasted onion roll with garlic-herb butter, dill pickle relish, shredded iceberg lettuce, sliced beefsteak tomato, and a swoosh of house-made thousand island dressing that drips down your wrist.",
      },
    ],
  },
  {
    name: "The Win-dow",
    address: "701 Chapala St., Santa Barbara, CA",
    website: "https://www.thewin-dow.la/santa-barbara",
    phone: "805-880-2775",
    instagram: "thewindow.la",
    area: "Downtown SB",
    lat: 34.417568,
    lng: -119.699434,
    mapUrl: "https://maps.app.goo.gl/umr83npQPfSKA8AM8",
    appleMapsUrl: "https://maps.apple/p/pDBVZsfDszCyIQ",
    menuItems: [
      {
        name: "The Walk-Up Classic",
        description:
          "A straightforward quarter-pound all-beef patty griddled until a dark crust forms on both sides, blanketed with a perfectly melted slice of classic yellow American cheese that drapes over the edges. Served on a simple soft white bun with crisp iceberg lettuce, fresh tomato, raw white onion, ketchup, mustard, and a generous stack of crinkle-cut dill pickles for that old-school drive-in cheeseburger feeling.",
      },
    ],
  },
  {
    name: "Third Window Brewing (Santa Barbara)",
    address: "406 E. Haley St. Ste #3, Santa Barbara, CA",
    website: "https://www.thirdwindowbrewing.com",
    phone: "805-979-5090",
    instagram: "thirdwindowbrewing",
    area: "Downtown SB",
    lat: 34.420992,
    lng: -119.690444,
    mapUrl: "https://maps.app.goo.gl/CxyGVg16v1dAXkVq6",
    appleMapsUrl: "https://maps.apple/p/o2.x6VY5-8B~c4",
    menuItems: [
      {
        name: "Hop Head Cheddar",
        description:
          "A juicy half-pound patty of Angus chuck slow-grilled over oak and topped with a thick slice of three-year aged cheddar that melts into a sharp, tangy pool across the charred surface. Nestled in a toasted spent-grain bun with hop shoots, beer-braised mushrooms, crispy bacon lardons, a smear of malty brown mustard, and crunchy malt-vinegar pickled onion rings on top.",
      },
    ],
  },
  {
    name: "Validation Ale",
    address: "102 E. Yanonali St., Santa Barbara, CA",
    website: "https://www.validationale.com",
    phone: "805-500-3111",
    instagram: "validationsb",
    area: "Downtown SB",
    lat: 34.415026,
    lng: -119.690101,
    mapUrl: "https://maps.app.goo.gl/ZeQpwXm2LdCZo4S88",
    appleMapsUrl: "https://maps.apple/p/FS_Cg~a~WvM-8~",
    menuItems: [
      {
        name: "The Validator",
        description:
          "A robust half-pound patty of house-ground brisket and chuck cooked on a cast-iron plancha until deeply crusted, then crowned with melted smoked gouda and a slice of pepper jack for a creamy double-cheese combo. Loaded onto a toasted brioche bun with thick-cut tomato, butter lettuce, bread-and-butter pickle chips, house-made beer cheese sauce, and a dash of hot sauce to keep things honest.",
      },
    ],
    type: "sponsor",
  },
  {
    name: "Crushcakes",
    address: "1315 Anacapa St., Santa Barbara, CA",
    website: "https://www.crushcakes.com",
    phone: "805-963-9353",
    instagram: "crushcakescafe",
    area: "Downtown SB",
    lat: 34.425637,
    lng: -119.705214,
    mapUrl: "https://maps.app.goo.gl/BwkDspDsomjtTNk79",
    appleMapsUrl: "https://maps.apple/p/u2LdIBaUBhX.u.z",
    menuItems: [
      {
        name: "Sweet Heat Burger",
        description:
          "A tender beef patty infused with brown sugar and black pepper, griddled until crispy at the edges and topped with a thick slice of habanero jack cheese that brings slow-creeping heat to every bite. Served on a vanilla-glazed brioche bun with candied bacon, a drizzle of honey-Sriracha sauce, bread-and-butter pickles, coleslaw, and a pinch of flaky sea salt sprinkled on top.",
      },
    ],
  },

  // --- Other SB ---
  {
    name: "Corner Tap",
    address: "1905 Cliff Dr., Santa Barbara, CA",
    website: "https://www.sbcornertap.com",
    phone: "805-690-2739",
    instagram: "cornertapsb",
    area: "Other SB",
    lat: 34.401264,
    lng: -119.722428,
    mapUrl: "https://maps.app.goo.gl/Qsq2ycSkog53L7Pq9",
    appleMapsUrl: "https://maps.apple/p/DsZrwRqcd5gMWR",
    menuItems: [
      {
        name: "Cliff Side Cheddar",
        description:
          "A hand-pattied third-pound burger of premium Angus beef seared on a flat-top until deeply crusted, then blanketed with a thick layer of sharp yellow cheddar that melts into every groove. Served on a lightly charred sesame bun with romaine hearts, vine-ripened tomato slices, thinly sliced red onion, garlic dill pickles, and a generous swipe of herb-infused mayo that pulls the whole burger together.",
      },
    ],
  },
  {
    name: "Dave's Dogs Grill",
    address: "149 S Turnpike Rd., Santa Barbara, CA",
    website: "https://www.davesdogs805.com/home",
    phone: "805-770-7772",
    instagram: "davesdogs805",
    area: "Other SB",
    lat: 34.43777,
    lng: -119.789698,
    mapUrl: "https://maps.app.goo.gl/3gGbzqPgfVrLvNJk8",
    appleMapsUrl: "https://maps.apple/p/JHLABwb8-a48tQ",
    menuItems: [
      {
        name: "Dave's Dirty Burger",
        description:
          "A loose-ground beef patty smashed paper-thin on a screaming griddle so the edges get impossibly crispy and lacy, then loaded with two slices of melty American cheese and a heap of grilled diced onions. Wrapped in a soft steamed bun with yellow mustard, ketchup, chopped dill pickles, and a generous squirt of bright yellow ballpark mustard for a gloriously messy no-frills cheeseburger experience.",
      },
    ],
  },
  {
    name: "Islands Fine Burgers & Drinks",
    address: "3825 State St. Space E-149, Santa Barbara, CA",
    website: "https://www.islandsrestaurants.com",
    phone: "805-946-0044",
    instagram: "islandsburgers",
    area: "Other SB",
    lat: 34.438006,
    lng: -119.748441,
    mapUrl: "https://maps.app.goo.gl/qBiuwTnxZLJBDouK9",
    appleMapsUrl: "https://maps.apple/p/NTQ.NjBT-8oA2L",
    menuItems: [
      {
        name: "Island Style Cheeseburger",
        description:
          "A flame-broiled half-pound patty of premium beef topped with a thick ring of grilled pineapple and a melted blanket of Swiss cheese that goes golden and bubbly under the broiler. Assembled on a toasted Kaiser roll with teriyaki glaze, crisp leaf lettuce, juicy beefsteak tomato, sweet Maui onion slices, and a coconut-lime mayo that transports your taste buds straight to a tropical beach.",
      },
    ],
  },
  {
    name: "Mesa Burger",
    address: "315 Meigs Rd., Santa Barbara, CA",
    website: "https://www.mesaburger.com",
    phone: "805-963-7492",
    instagram: null,
    area: "Other SB",
    lat: 34.400806,
    lng: -119.722701,
    mapUrl: "https://maps.app.goo.gl/g2QpAoPb1cGtsjrZ8",
    appleMapsUrl: "https://maps.apple/p/~6wPW6hFmMWnNH",
    menuItems: [
      {
        name: "The Mesa Classic",
        description:
          "A grass-fed beef patty cooked to order on a charcoal grill and topped with a perfectly melted slice of Tillamook sharp cheddar that pools into every nook and cranny of the hand-formed burger. Placed on a fresh locally baked brioche bun with organic mixed greens, heirloom tomato, thinly sliced avocado, house-made pickled red onion, and a roasted jalape\u00f1o aioli that brings gentle warmth.",
      },
    ],
  },
  {
    name: "Sama San Roque",
    address: "3435 State St., Santa Barbara, CA",
    website: "https://www.samasanroque.com",
    phone: "805-450-8288",
    instagram: "samasanroque",
    area: "Other SB",
    lat: 34.439916,
    lng: -119.738005,
    mapUrl: "https://maps.app.goo.gl/iNqeXdJEw6Q9Mucd6",
    appleMapsUrl: "https://maps.apple/p/oBfTD-.Q6N0Av_",
    menuItems: [
      {
        name: "Sama Spiced Burger",
        description:
          "A lamb and beef blend patty seasoned with cumin, coriander, and smoked paprika, grilled over high heat and topped with a creamy layer of melted Manchego cheese and a dollop of harissa yogurt. Served on a warm flatbread with shaved pickled turnips, sliced cucumber, mint leaves, a shower of sumac, and a final squeeze of lemon that brightens the whole Mediterranean-inspired creation.",
      },
    ],
  },
  {
    name: "The Patio Cafe",
    address: "3007 De La Vina St., Santa Barbara, CA",
    website: "https://www.thepatiocafesb.com",
    phone: "805-687-3663",
    instagram: "the.patiocafesb",
    area: "Other SB",
    lat: 34.438691,
    lng: -119.728472,
    mapUrl: "https://maps.app.goo.gl/raNcJPmmkn5mMp4x9",
    appleMapsUrl: "https://maps.apple/p/PsEIKM3fsXn3z5",
    menuItems: [
      {
        name: "Patio Patty Melt",
        description:
          "A seasoned beef patty griddled with a heap of sweet caramelized onions and sandwiched between two slices of buttery grilled rye bread, with both Swiss and American cheese melted together into a gloriously gooey center. Accompanied by a tangy side of house-made Russian dressing for dipping, plus a handful of kettle chips and a crisp half-sour pickle spear to complete the classic diner experience.",
      },
    ],
  },
  {
    name: "Yellow Belly Tap",
    address: "2611 De La Vina St., Santa Barbara, CA",
    website: "https://www.yellowbellytap.com",
    phone: "805-770-5694",
    instagram: "yellowbellytap",
    area: "Other SB",
    lat: 34.434846,
    lng: -119.724707,
    mapUrl: "https://maps.app.goo.gl/vxF6Kn8zHgkJTzRZA",
    appleMapsUrl: "https://maps.apple/p/KaHQjm176IenYn",
    menuItems: [
      {
        name: "Yellow Belly Smash",
        description:
          "Two thin smashed patties of prime beef cooked until the edges are shatteringly crispy, each draped with a slice of muenster cheese that melts into a silky veil over the crackly meat. Stacked on a butter-toasted brioche bun with garlic-confit mayo, quick-pickled red onions, baby spinach, thick-cut heirloom tomato, and a drizzle of hot honey that brings a sweet and fiery finish.",
      },
    ],
  },

  // --- Goleta ---
  {
    name: "Caya",
    address: "5650 Calle Real, Goleta, CA",
    website: "https://www.cayarestaurant.com",
    phone: "805-964-1288",
    instagram: "cayarestaurant",
    area: "Goleta",
    lat: 34.441588,
    lng: -119.820858,
    mapUrl: "https://maps.app.goo.gl/KDWoCpGP4Bj5tKxG8",
    appleMapsUrl: "https://maps.apple/p/qsKhePr8N5NbRr",
    menuItems: [
      {
        name: "Caya Truffle Burger",
        description:
          "A luxurious Wagyu beef patty seared in truffle butter and topped with a decadent layer of melted taleggio cheese that oozes richly down the sides of the perfectly pink center. Presented on a house-made brioche bun brushed with black truffle oil, finished with saut\u00e9ed wild mushrooms, microgreens, shaved Parmesan, a pinch of fleur de sel, and a side of truffle-Parmesan fries.",
      },
    ],
  },
  {
    name: "Cristino's Bakery",
    address: "170 Aero Camino, Goleta, CA",
    website: "https://www.cristinosbakery.com",
    phone: "805-455-6900",
    instagram: "cristinosbakery",
    area: "Goleta",
    lat: 34.432364,
    lng: -119.84804,
    mapUrl: "https://maps.app.goo.gl/5ateAZg2XUFRejKn8",
    appleMapsUrl: "https://maps.apple/p/PwbJwZa5okKqG8",
    menuItems: [
      {
        name: "Bakery Burger Bun",
        description:
          "A juicy beef patty cooked on a flat griddle and nestled inside a freshly baked house-made potato bun that is impossibly soft and lightly sweetened, topped with two slices of melted Monterey Jack cheese. Finished with crispy romaine, thick tomato slices, house-pickled onion rings, a swipe of roasted red pepper aioli, and a side of golden hand-cut fries dusted with garlic salt and herbs.",
      },
    ],
  },
  {
    name: "Crushcakes and Cafe",
    address: "5392 Hollister Ave., Goleta, CA",
    website: "https://www.crushcakes.com",
    phone: "805-845-2780",
    instagram: "crushcakescafe",
    area: "Goleta",
    lat: 34.435346,
    lng: -119.812297,
    mapUrl: "https://maps.app.goo.gl/YXrd5iwBn4oCouXA9",
    appleMapsUrl: "https://maps.apple/p/Ir9WS14tYcDv6N",
    menuItems: [
      {
        name: "Crush Burger",
        description:
          "A smashed beef patty cooked until crispy-edged and layered with a gooey blend of melted white American and provolone cheese, then topped with thick-cut applewood bacon and a fried egg with a perfectly runny yolk. Served on a toasted everything bagel bun with garlic cream cheese, fresh arugula, sliced Roma tomato, and a housemade everything-spice seasoning that adds crunch and savory depth to every single bite.",
      },
    ],
  },
  {
    name: "Home Plate Grill",
    address: "7398 Calle Real #C, Goleta, CA",
    website: "https://www.homeplategoleta.com",
    phone: "805-845-3323",
    instagram: "homeplate805",
    area: "Goleta",
    lat: 34.43355,
    lng: -119.884676,
    mapUrl: "https://maps.app.goo.gl/Y5UCLYBhX1y4vxY18",
    appleMapsUrl: "https://maps.apple/p/6Zw5j8CDzQhADd",
    menuItems: [
      {
        name: "Grand Slam Burger",
        description:
          "A massive half-pound patty of freshly ground sirloin and brisket chargrilled over open flame and loaded with two slices of melted pepper jack cheese and a heap of crispy jalape\u00f1o coins. Built on a toasted onion Kaiser roll with chipotle barbecue sauce, shredded lettuce, diced tomato, crunchy fried onion tanglers, and a cool cilantro-lime crema that balances the spice with creamy, herby freshness.",
      },
    ],
  },
  {
    name: "Jonesy's Fried Chicken",
    address: "282 Orange Ave., Goleta, CA",
    website: "https://www.jonesysfriedchicken.com",
    phone: "805-770-2428",
    instagram: "jonesysfriedchicken",
    area: "Goleta",
    lat: 34.434138,
    lng: -119.828632,
    mapUrl: "https://maps.app.goo.gl/tQ7zzEVcJvqCFVYn6",
    appleMapsUrl: "https://maps.apple/p/S~V0TY8QH3zT30",
    menuItems: [
      {
        name: "Fried Chicken Cheese Burger",
        description:
          "A crispy buttermilk-fried chicken thigh patty that shatters with every bite, topped with a thick slab of melted pimento cheese and two strips of candied maple-pepper bacon stacked on top. Served on a warm buttered biscuit bun with creamy coleslaw, house-made bread-and-butter pickles, a drizzle of hot honey, and a dusting of cayenne pepper that makes this the ultimate fried-chicken-meets-cheeseburger mashup.",
      },
    ],
  },
  {
    name: "Kyle's Kitchen (Hollister)",
    address: "7000 Hollister Ave., Goleta, CA",
    website: "https://www.kyleskitchen.com",
    phone: "805-845-3436",
    instagram: "kyleskitchensb",
    area: "Goleta",
    lat: 34.430453,
    lng: -119.872319,
    mapUrl: "https://maps.app.goo.gl/7mobFJW4rD6S8gZc8",
    appleMapsUrl: "https://maps.apple/p/pY1SoTqf10FswS",
    menuItems: [
      {
        name: "Kyle's Classic Cheddar",
        description:
          "A generous hand-formed patty of fresh-ground chuck grilled over mesquite coals until perfectly charred on the outside and pink and juicy within, topped with thick-cut aged white cheddar. Loaded on a toasted poppy seed bun with crisp green-leaf lettuce, ripe avocado slices, roasted Hatch green chiles, a ring of raw red onion, and a zesty house-made salsa verde that adds a bright kick.",
      },
    ],
  },
  {
    name: "Kyle's Kitchen (Calle Real)",
    address: "5723 Calle Real, Goleta, CA",
    website: "https://www.kyleskitchen.com",
    phone: "805-845-2260",
    instagram: "kyleskitchensb",
    area: "Goleta",
    lat: 34.44078,
    lng: -119.82405,
    mapUrl: "https://maps.app.goo.gl/pwHJn1FJksgvYt3A9",
    appleMapsUrl: "https://maps.apple/p/dw.tRLQFoqQ~rH",
    menuItems: [
      {
        name: "Calle Real Double Stack",
        description:
          "Two quarter-pound patties of the same fresh-ground chuck stacked high with melted colby jack on each layer and a crispy onion ring nestled between them for structural crunch. Pressed into a butter-griddled brioche bun with house-made thousand island, shredded iceberg, tangy dill pickles, sliced vine tomatoes, and a sprinkle of everything seasoning on the bun top for a beautiful finishing touch.",
      },
    ],
  },
  {
    name: "Rinkside Cafe",
    address: "6985 Santa Felicia Dr., Goleta, CA",
    website: "https://www.iceinparadise.org/rinkside-cafe",
    phone: "805-335-4521",
    instagram: "rinksidecafe",
    area: "Goleta",
    lat: 34.425835,
    lng: -119.871156,
    mapUrl: "https://maps.app.goo.gl/9aS1C1VuTfqo6L4T8",
    appleMapsUrl: "https://maps.apple/p/PsgrujLZSVcRHf",
    menuItems: [
      {
        name: "Rinkside Melt",
        description:
          "A beef patty seared on a well-seasoned flat-top until a deep mahogany crust forms, then smothered with a molten blend of cheddar and Monterey Jack that stretches with every pull. Sandwiched in a grilled sourdough roll with tangy house-made pickles, caramelized onion jam, a few leaves of butter lettuce, a schmear of stone-ground mustard, and a sprinkle of crispy fried shallots on top.",
      },
    ],
  },
  {
    name: "Santa Barbara Fish Market",
    address: "7127 Hollister Ave. Ste. 18, Goleta, CA",
    website: "https://www.sbfish.com",
    phone: "805-966-1000",
    instagram: "sbfishmarket",
    area: "Goleta",
    lat: 34.428633,
    lng: -119.876655,
    mapUrl: "https://maps.app.goo.gl/fATpYsiitbhoVSRm7",
    appleMapsUrl: "https://maps.apple/p/MFjhN9uKSytnZH",
    menuItems: [
      {
        name: "Surf n Turf Burger",
        description:
          "A seared beef patty blended with finely diced shrimp and Old Bay seasoning, grilled until smoky and topped with a slice of smoked gouda that melts into a creamy golden layer across the seafood-studded surface. Served on a toasted ciabatta roll with tartar sauce, crisp butter lettuce, lemon-dressed arugula, tomato, and pickled red onion for a coastal cheeseburger that tastes like the ocean breeze.",
      },
    ],
  },
  {
    name: "Shalhoob's (Magnolia)",
    address: "5112 Hollister Ave., Goleta, CA",
    website: "https://www.shalhoob.com",
    phone: "805-880-0733",
    instagram: "shalhoobmeatco",
    area: "Goleta",
    lat: 34.435304,
    lng: -119.802869,
    mapUrl: "https://maps.app.goo.gl/35q8XFMUXjyyAk8b6",
    appleMapsUrl: "https://maps.apple/p/0b-Z3yLt-pt29a",
    menuItems: [
      {
        name: "Magnolia Smokehouse",
        description:
          "A thick-cut smoked brisket patty ground in-house with a bold peppercorn bark, seared until a crunchy crust forms, and topped with a double layer of melted Tillamook medium cheddar and smoked mozzarella. Placed on a charcoal-grilled brioche bun with house-made coleslaw, tangy Carolina-style vinegar sauce, crispy tobacco onions, and a few strips of thick-cut bacon that add a salty, smoky crunch.",
      },
    ],
  },
  {
    name: "The Nugget (Goleta)",
    address: "5687 Calle Real, Goleta, CA",
    website: "https://www.nuggetbarandgrill.com",
    phone: "805-964-5200",
    instagram: "thenuggetofgoleta",
    area: "Goleta",
    lat: 34.440838,
    lng: -119.823059,
    mapUrl: "https://maps.app.goo.gl/nTom9qBWAcJ9FzKz9",
    appleMapsUrl: "https://maps.apple/p/g~6tyn2jtzVFQ6",
    menuItems: [
      {
        name: "Nugget Bacon Cheddar",
        description:
          "A hearty half-pound patty of fresh-ground Angus beef flame-grilled over hardwood charcoal, blanketed with two slices of sharp cheddar that melt into the craggy surface of the well-seasoned patty. Stacked on a toasted sesame seed bun with four strips of thick-cut hickory bacon, crunchy iceberg lettuce, ripe tomato, raw yellow onion, Thousand Island dressing, and a spear of garlic dill pickle on the side.",
      },
    ],
  },
  {
    name: "White Caps Beach Club",
    address: "6775 Hollister Ave., Goleta, CA",
    website: "https://www.whitecapsbeachclub.com",
    phone: "805-705-6412",
    instagram: "whitecapsbeachclub",
    area: "Goleta",
    lat: 34.429618,
    lng: -119.865668,
    mapUrl: "https://maps.app.goo.gl/nAJvesRCHdofkBez6",
    appleMapsUrl: "https://maps.apple/p/UB7AB5J928n9EF",
    menuItems: [
      {
        name: "Beach Club Burger",
        description:
          "A juicy third-pound patty of grass-fed beef grilled over coconut-shell charcoal for a subtly sweet smoky flavor, topped with melted Havarti cheese and a thick slice of ripe avocado. Served on a warm toasted Hawaiian roll with mango-habanero salsa, crisp shredded cabbage, a squeeze of fresh lime, pickled jalape\u00f1os, and a drizzle of cilantro-lime crema that brings bright tropical vibes.",
      },
    ],
  },

  // --- Carpinteria ---
  {
    name: "Dang Burger",
    address: "5080 A Carpinteria Ave., Carpinteria, CA",
    website: "https://www.dangburger.com",
    phone: "",
    instagram: "dang.burger",
    area: "Carpinteria",
    lat: 34.398305,
    lng: -119.517345,
    mapUrl: "https://maps.app.goo.gl/7gdDkJgfhikYn82W6",
    appleMapsUrl: "https://maps.apple/p/wjhX3Jh.V2_I5p",
    menuItems: [
      {
        name: "The Dang Cheeseburger",
        description:
          "A double-stacked pair of thin beef patties smashed on a blazing-hot griddle until the edges get impossibly crispy, each one blanketed with a slice of gooey American cheese that fuses to the meat. Loaded on a soft squishy potato bun with shredded iceberg, diced raw white onion, tangy dill pickle coins, a squiggle of ketchup and yellow mustard, and a drizzle of house-made burger sauce.",
      },
    ],
  },
  {
    name: "Padaro Beach Grill",
    address: "3765 Santa Claus Lane, Carpinteria, CA",
    website: "https://www.padarobeachgrill.com",
    phone: "805-566-9800",
    instagram: "padarobeachgrill",
    area: "Carpinteria",
    lat: 34.406855,
    lng: -119.548572,
    mapUrl: "https://maps.app.goo.gl/8ZDu63gFeurVYCeM6",
    appleMapsUrl: "https://maps.apple/p/uqiyiVKwDzDndx",
    menuItems: [
      {
        name: "Beachside Swiss Burger",
        description:
          "A flame-grilled half-pound beef patty cooked over an open pit right by the ocean, topped with bubbling Swiss cheese and a generous helping of saut\u00e9ed wild mushrooms that add deep earthy flavor. Served on a toasted whole-wheat bun with fresh baby spinach, roasted red pepper strips, a thick slice of beefsteak tomato, red onion marmalade, and a zesty lemon-herb aioli.",
      },
    ],
  },
  {
    name: "The Nugget (Summerland)",
    address: "2318 Lillie Ave., Summerland, CA",
    website: "https://www.nuggetbarandgrill.com",
    phone: "805-969-6135",
    instagram: "thenuggetofgoleta",
    area: "Carpinteria",
    lat: 34.421723,
    lng: -119.599547,
    mapUrl: "https://maps.app.goo.gl/Qqp5pJiaCNDZ3uRDA",
    appleMapsUrl: "https://maps.apple/p/HM7pAt5EhvmgQx",
    menuItems: [
      {
        name: "Summerland Sunset",
        description:
          "A thick patty of house-ground tri-tip and chuck cooked over a red-oak grill, topped with a melty blanket of smoked provolone and a tangle of crispy fried onion strings that add satisfying crunch. Built on a brioche bun toasted in garlic butter with spicy pickled peppers, romaine hearts, vine-ripe tomato, house-made chipotle ketchup, and a creamy avocado spread for a California-coast cheeseburger vibe.",
      },
    ],
  },
  {
    name: "The Nugget (Carpinteria)",
    address: "892 Linden Ave., Carpinteria, CA",
    website: "https://www.nuggetbarandgrill.com",
    phone: "+1 (805) 576-9007",
    instagram: "thenuggetofgoleta",
    area: "Carpinteria",
    lat: 34.398042,
    lng: -119.51916,
    mapUrl: "https://maps.app.goo.gl/xwmjKDJvPnS1oe4w7",
    appleMapsUrl: "https://maps.apple/p/ZP.ggEK10P5_Go",
    menuItems: [
      {
        name: "Carp Town Cheddar",
        description:
          "A hand-formed patty of premium Angus beef seasoned simply with salt and pepper, grilled over high heat and topped with a thick slab of three-year aged Tillamook cheddar that slowly melts into an orange cascade. Served on a classic sesame seed bun with green-leaf lettuce, fresh tomato, crunchy kosher dill pickles, thinly sliced raw red onion, mayo, ketchup, and a touch of yellow mustard.",
      },
    ],
  },
  {
    name: "Third Window Brewing (Carpinteria)",
    address: "720 Linden Ave., Carpinteria, CA",
    website: "https://www.thirdwindowbrewing.com",
    phone: "+1 (805) 562-6475",
    instagram: "thirdwindowbrewing",
    area: "Carpinteria",
    lat: 34.39704,
    lng: -119.520395,
    mapUrl: "https://maps.app.goo.gl/gpcE5McRYoq2aY4MA",
    appleMapsUrl: "https://maps.apple/p/HhNum2x75sTZXQ",
    menuItems: [
      {
        name: "Third Window IPA Burger",
        description:
          "A robust beef patty infused with spent grain from the brewery's flagship IPA, seared until a bitter-sweet malty crust develops, then topped with melted aged white cheddar and beer-braised onions. Assembled on a spent-grain pretzel bun with whole-grain mustard, peppery arugula, thick-cut house-cured bacon, a smear of hop-cream cheese, and bread-and-butter pickles made with the brewery's own pale ale.",
      },
    ],
  },

  // --- Isla Vista ---
  {
    name: "IV Deli Mart",
    address: "6553 Pardall Rd., Isla Vista, CA",
    website: "https://www.facebook.com/ivdelimart",
    phone: "+1 (805) 562-8858",
    instagram: "ivdelimart",
    area: "Isla Vista",
    lat: 34.412906,
    lng: -119.856403,
    mapUrl: "https://maps.app.goo.gl/3ywpf2asZSic4c6f8",
    appleMapsUrl: "https://maps.apple/p/P8CHoGZ8.n~99_",
    menuItems: [
      {
        name: "The Deli Special",
        description:
          "A quarter-pound smashed beef patty griddled to order at the deli counter with American cheese melted on top and a fried egg slapped on for good measure, all stacked between a fresh-baked Kaiser roll. Dressed with shredded lettuce, sliced tomato, raw onion, a pile of house-made garlic fries crammed right inside the sandwich, a squirt of Sriracha, and a side of ranch for dipping.",
      },
    ],
  },

  // --- Santa Ynez ---
  {
    name: "The Victor",
    address: "3631 Sagunto St., Santa Ynez, CA",
    website: "https://www.thevictor.us",
    phone: "+1 (805) 695-2999",
    instagram: "thevictor_sy",
    area: "Santa Ynez",
    lat: 34.613083,
    lng: -120.078474,
    mapUrl: "https://maps.app.goo.gl/tQ9GFna3qRasLufZ7",
    appleMapsUrl: "https://maps.apple/p/NvE-BeGF4haMtX",
    menuItems: [
      {
        name: "Valley Ranch Burger",
        description:
          "A thick dry-aged ribeye patty grilled over live oak coals until the fat renders into a rich, beefy crust, topped with a generous layer of melted aged Gruy\u00e8re and a slab of smoked Gouda. Presented on a house-baked sourdough bun with heirloom tomato, crispy pancetta, wild arugula, fig-onion jam, a smear of horseradish cream, and flaky Maldon salt sprinkled over the top.",
      },
    ],
  },
];
