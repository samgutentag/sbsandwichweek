#!/usr/bin/env python3
"""Fetch operating hours for all restaurants from Google Places API.

Reads place-ids.json, calls the Places Details API for each,
and writes hours.json with opening hours, lunch/dinner flags.

Usage:
    GOOGLE_PLACES_API_KEY=xxx python3 fetch-hours.py

Restaurants without a Place ID or without hours data get null entries.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def fetch_place_details(place_id, api_key):
    """Fetch opening_hours for a Place ID using Places Details API."""
    params = {
        "place_id": place_id,
        "fields": "opening_hours",
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
                return None
            return data.get("result", {}).get("opening_hours")
    except Exception as e:
        print(f"  API error: {e}")
        return None


def parse_periods(opening_hours):
    """Parse Google Places opening_hours into simplified period list.

    Google format:
        periods: [{open: {day: 0, time: "1100"}, close: {day: 0, time: "2100"}}]
        day: 0=Sunday, 1=Monday, ..., 6=Saturday

    Output format:
        [{day: 0, open: "1100", close: "2100"}, ...]

    Handles 24-hour places (close missing = open 24h that day).
    Handles midnight-spanning hours by splitting into two entries.
    """
    if not opening_hours or "periods" not in opening_hours:
        return None

    periods = []
    for p in opening_hours["periods"]:
        open_info = p.get("open", {})
        close_info = p.get("close")

        day = open_info.get("day", 0)
        open_time = open_info.get("time", "0000")

        if not close_info:
            # Open 24 hours
            periods.append({"day": day, "open": "0000", "close": "2359"})
            continue

        close_day = close_info.get("day", day)
        close_time = close_info.get("time", "0000")

        if close_day == day:
            # Same day
            periods.append({"day": day, "open": open_time, "close": close_time})
        else:
            # Spans midnight — split into two entries
            periods.append({"day": day, "open": open_time, "close": "2359"})
            periods.append(
                {"day": close_day, "open": "0000", "close": close_time}
            )

    # Sort by day then open time
    periods.sort(key=lambda p: (p["day"], p["open"]))
    return periods


def derive_meal_flags(periods):
    """Derive lunch and dinner booleans from periods.

    lunch: any period includes time before 15:00 (3pm)
    dinner: any period includes time after 17:00 (5pm)
    """
    if not periods:
        return False, False

    lunch = False
    dinner = False

    for p in periods:
        open_t = int(p["open"])
        close_t = int(p["close"])

        # Lunch: restaurant is open during any part of 1100-1500
        if open_t < 1500 and close_t > 1100:
            lunch = True

        # Dinner: restaurant is open during any part of 1700-2359
        if close_t > 1700:
            dinner = True

    return lunch, dinner


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
    print(f"Processing {len(restaurants)} restaurants")

    hours_data = {
        "_updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    success = 0
    no_hours = 0
    no_place_id = 0
    errors = 0

    for i, (name, place_id) in enumerate(sorted(restaurants.items())):
        print(f"[{i + 1}/{len(restaurants)}] {name}...", end=" ")

        if not place_id:
            print("SKIP (no Place ID)")
            hours_data[name] = None
            no_place_id += 1
            continue

        opening_hours = fetch_place_details(place_id, api_key)

        if opening_hours is None:
            print("no hours data")
            hours_data[name] = None
            no_hours += 1
        else:
            periods = parse_periods(opening_hours)
            if periods:
                lunch, dinner = derive_meal_flags(periods)
                hours_data[name] = {
                    "periods": periods,
                    "lunch": lunch,
                    "dinner": dinner,
                }
                print(
                    f"OK ({len(periods)} periods, "
                    f"lunch={lunch}, dinner={dinner})"
                )
                success += 1
            else:
                print("no parseable periods")
                hours_data[name] = None
                no_hours += 1

        # Rate limit — stay well under 10 QPS
        time.sleep(0.2)

    with open("hours.json", "w") as f:
        json.dump(hours_data, f, indent=2, ensure_ascii=False)

    print(f"\nResults:")
    print(f"  Total: {len(restaurants)}")
    print(f"  Success: {success}")
    print(f"  No hours data: {no_hours}")
    print(f"  No Place ID: {no_place_id}")
    print(f"  Errors: {errors}")
    print(f"\nWrote hours.json")


if __name__ == "__main__":
    main()
