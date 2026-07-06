#!/usr/bin/env python3
"""Fetch website and phone number for all restaurants from Google Places API.

Reads place-ids.json, calls the Places Details API for each,
and updates data-2026.js and data.js with website and phone values
where they are currently null.

Usage:
    GOOGLE_PLACES_API_KEY=xxx python3 fetch-details.py

Only overwrites null values — existing website/phone entries are preserved.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def fetch_place_details(place_id, api_key):
    """Fetch website and phone for a Place ID using Places Details API."""
    params = {
        "place_id": place_id,
        "fields": "website,formatted_phone_number",
        "key": api_key,
    }
    url = (
        "https://maps.googleapis.com/maps/api/place/details/json?"
        + urllib.parse.urlencode(params)
    )

    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            if data.get("status") != "OK":
                return None, None
            result = data.get("result", {})
            return (
                result.get("website"),
                result.get("formatted_phone_number"),
            )
    except Exception as e:
        print(f"  API error: {e}")
        return None, None


def read_data_file(path):
    """Read a JS data file and return its contents."""
    with open(path, "r") as f:
        return f.read()


def update_null_field(content, name, field, value):
    """Replace a null field value for a specific restaurant entry.

    Finds the restaurant by name, then replaces the first null occurrence
    of the given field after that name.
    """
    if value is None:
        return content

    # Escape special regex chars in restaurant name
    escaped_name = re.escape(name)

    # Find the restaurant block by name
    name_pattern = rf'name:\s*"{escaped_name}"'
    name_match = re.search(name_pattern, content)
    if not name_match:
        return content

    # Find the field: null after this name (within a reasonable range)
    start = name_match.start()
    # Look within the next 500 chars for the field
    block = content[start:start + 500]

    field_pattern = rf'{field}:\s*null'
    field_match = re.search(field_pattern, block)
    if not field_match:
        return content

    # Build replacement
    escaped_value = value.replace('"', '\\"')
    replacement = f'{field}: "{escaped_value}"'

    # Replace in the full content at the exact position
    abs_start = start + field_match.start()
    abs_end = start + field_match.end()
    content = content[:abs_start] + replacement + content[abs_end:]

    return content


def main():
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY", "")
    if not api_key:
        print("Error: GOOGLE_PLACES_API_KEY environment variable required.")
        sys.exit(1)

    if not os.path.exists("place-ids.json"):
        print("Error: place-ids.json not found. Run fetch-place-ids.py first.")
        sys.exit(1)

    with open("place-ids.json", "r") as f:
        place_ids = json.load(f)

    # Filter out metadata keys
    restaurants = {
        k: v for k, v in place_ids.items() if not k.startswith("_")
    }

    # Read both data files
    data_2026 = read_data_file("data-2026.js")
    data_skeleton = read_data_file("data.js")

    print(f"Processing {len(restaurants)} restaurants")

    updated_website = 0
    updated_phone = 0
    skipped = 0
    errors = 0

    for i, (name, place_id) in enumerate(sorted(restaurants.items())):
        print(f"[{i + 1}/{len(restaurants)}] {name}...", end=" ")

        if not place_id:
            print("SKIP (no Place ID)")
            skipped += 1
            continue

        # Check if this restaurant already has both fields populated
        has_website = f'name: "{name}"' in data_2026 and re.search(
            rf'name:\s*"{re.escape(name)}"[\s\S]{{0,300}}website:\s*null',
            data_2026
        ) is not None
        has_phone = f'name: "{name}"' in data_2026 and re.search(
            rf'name:\s*"{re.escape(name)}"[\s\S]{{0,300}}phone:\s*null',
            data_2026
        ) is not None

        if not has_website and not has_phone:
            print("already populated")
            skipped += 1
            continue

        website, phone = fetch_place_details(place_id, api_key)

        updates = []
        if has_website and website:
            data_2026 = update_null_field(data_2026, name, "website", website)
            data_skeleton = update_null_field(data_skeleton, name, "website", website)
            updated_website += 1
            updates.append(f"website={website}")

        if has_phone and phone:
            data_2026 = update_null_field(data_2026, name, "phone", phone)
            data_skeleton = update_null_field(data_skeleton, name, "phone", phone)
            updated_phone += 1
            updates.append(f"phone={phone}")

        if updates:
            print(", ".join(updates))
        else:
            print("no data from API")

        # Rate limit
        time.sleep(0.2)

    # Write updated files
    with open("data-2026.js", "w") as f:
        f.write(data_2026)

    with open("data.js", "w") as f:
        f.write(data_skeleton)

    print(f"\nResults:")
    print(f"  Total: {len(restaurants)}")
    print(f"  Websites added: {updated_website}")
    print(f"  Phones added: {updated_phone}")
    print(f"  Skipped (already populated): {skipped}")
    print(f"  Errors: {errors}")
    print(f"\nUpdated data-2026.js and data.js")


if __name__ == "__main__":
    main()
