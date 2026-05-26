#!/usr/bin/env python3
"""One-time script to resolve Google Maps short links to Place IDs.

Reads data-2026.js, follows mapUrl redirects to extract Place IDs,
and writes place-ids.json keyed by restaurant name.

Usage:
    GOOGLE_PLACES_API_KEY=xxx python3 fetch-place-ids.py

The API key is only needed for fallback lookups when redirect parsing fails.
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def parse_restaurants(filepath="data-2026.js"):
    """Extract restaurant names, mapUrls, and lat/lng from data JS file."""
    with open(filepath, "r") as f:
        content = f.read()

    restaurants = []
    # Split on each object in the array
    blocks = re.split(r"\n  \{", content)
    for block in blocks:
        name_m = re.search(r'name:\s*"([^"]+)"', block)
        url_m = re.search(r'mapUrl:\s*"([^"]+)"', block)
        lat_m = re.search(r"lat:\s*([\d.-]+)", block)
        lng_m = re.search(r"lng:\s*([\d.-]+)", block)
        if name_m and url_m:
            restaurants.append(
                {
                    "name": name_m.group(1),
                    "mapUrl": url_m.group(1),
                    "lat": float(lat_m.group(1)) if lat_m else None,
                    "lng": float(lng_m.group(1)) if lng_m else None,
                }
            )
    return restaurants


def follow_redirect(url):
    """Follow a short URL redirect and return the final URL.

    Uses curl -L which handles Google's redirect chain correctly,
    whereas Python's urllib gets a JS-rendered page instead.
    """
    try:
        result = subprocess.run(
            ["curl", "-sI", "-L", "-o", "/dev/null", "-w", "%{url_effective}", url],
            capture_output=True,
            text=True,
            timeout=15,
        )
        final_url = result.stdout.strip()
        return final_url if final_url and final_url != url else None
    except Exception:
        return None


def extract_place_id_from_url(url):
    """Try to extract a Place ID from an expanded Google Maps URL.

    Place IDs look like: ChIJ...  (always start with ChIJ or similar prefix)
    They appear in various URL patterns:
    - /place/.../data=...!1s<PLACE_ID>...
    - ftid=<PLACE_ID>
    - /maps/place/.../@.../data=...
    """
    if not url:
        return None

    # Pattern 1: ftid parameter
    m = re.search(r"ftid=(0x[0-9a-f]+:0x[0-9a-f]+)", url)
    if m:
        return m.group(1)

    # Pattern 2: !1s followed by a Place ID (ChIJ...)
    m = re.search(r"!1s(ChIJ[A-Za-z0-9_-]+)", url)
    if m:
        return m.group(1)

    # Pattern 3: place_id= parameter
    m = re.search(r"place_id=([A-Za-z0-9_-]+)", url)
    if m:
        return m.group(1)

    # Pattern 4: data string with hex place reference
    m = re.search(r"!1s(0x[0-9a-f]+:0x[0-9a-f]+)", url)
    if m:
        return m.group(1)

    return None


def find_place_from_text(name, lat, lng, api_key):
    """Use Find Place From Text API as fallback."""
    if not api_key:
        return None

    input_text = name
    params = {
        "input": input_text,
        "inputtype": "textquery",
        "fields": "place_id",
    }
    if lat and lng:
        params["locationbias"] = f"circle:500@{lat},{lng}"

    url = (
        "https://maps.googleapis.com/maps/api/place/findplacefromtext/json?"
        + urllib.parse.urlencode(params)
        + "&key="
        + api_key
    )

    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            candidates = data.get("candidates", [])
            if candidates:
                return candidates[0].get("place_id")
    except Exception as e:
        print(f"  API error for {name}: {e}")

    return None


def main():
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY", "")

    # Check for data file
    data_file = "data-2026.js"
    if not os.path.exists(data_file):
        print(f"Error: {data_file} not found. Run from repo root.")
        sys.exit(1)

    restaurants = parse_restaurants(data_file)
    print(f"Found {len(restaurants)} restaurants in {data_file}")

    # Try to load existing place-ids.json for incremental updates
    existing = {}
    if os.path.exists("place-ids.json"):
        with open("place-ids.json", "r") as f:
            existing = json.load(f)
        # Remove _updated key for counting
        existing_count = len(
            {k: v for k, v in existing.items() if k != "_updated"}
        )
        print(f"Loaded {existing_count} existing Place IDs")

    place_ids = {}
    matched = 0
    failed = []
    skipped = 0

    for i, r in enumerate(restaurants):
        name = r["name"]

        # Skip if already resolved
        if name in existing and existing[name]:
            place_ids[name] = existing[name]
            matched += 1
            skipped += 1
            continue

        print(f"[{i + 1}/{len(restaurants)}] {name}...", end=" ")

        # Step 1: Try Find Place From Text API (returns ChIJ-format IDs
        # that work with the Places Details API)
        if api_key:
            place_id = find_place_from_text(
                name, r["lat"], r["lng"], api_key
            )
            if place_id:
                print(f"OK: {place_id}")
                place_ids[name] = place_id
                matched += 1
            else:
                # Step 2: Try URL redirect as fallback
                expanded_url = follow_redirect(r["mapUrl"])
                place_id = extract_place_id_from_url(expanded_url) if expanded_url else None
                if place_id and place_id.startswith("ChIJ"):
                    print(f"OK (from URL): {place_id}")
                    place_ids[name] = place_id
                    matched += 1
                else:
                    print("FAILED")
                    place_ids[name] = None
                    failed.append(name)
        else:
            print("SKIP (no API key)")
            place_ids[name] = None
            failed.append(name)

        # Rate limit
        time.sleep(0.3)

    # Write output
    output = {"_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    output.update(dict(sorted(place_ids.items())))

    with open("place-ids.json", "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nResults:")
    print(f"  Total: {len(restaurants)}")
    print(f"  Matched: {matched} ({skipped} from cache)")
    print(f"  Failed: {len(failed)}")
    if failed:
        print(f"  Failed restaurants: {', '.join(failed)}")
    print(f"\nWrote place-ids.json")


if __name__ == "__main__":
    main()
