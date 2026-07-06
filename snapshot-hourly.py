#!/usr/bin/env python3
"""Snapshot hourly tracking data from the Cloudflare Worker for a concluded event.

Called by snapshot-hourly.sh. Reads trackUrl, event dates, and filter keys from
config.js, fetches hourly aggregates from the Worker, and writes:

  snapshots/hourly-events.json   — verbatim ?hourly=true response: {hour: {action: count}}
  snapshots/hourly-labels.json   — {label: {hour: count}} for every filter label
                                   (area names + tagFilters keys + hoursFilters keys)

The captured window is wider than the event itself (7 days before the earlier of
dataLiveDate/eventStartDate, through today) so the stats page's All time and
Pre-event ranges still have data; the client filters to a range on its own.

Usage: snapshot-hourly.py <repo-root> [--start YYYY-MM-DD] [--end YYYY-MM-DD]
"""

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path


def parse_config(config_text):
    def scalar(name):
        m = re.search(r'^\s*' + name + r':\s*"([^"]+)"', config_text, re.M)
        return m.group(1) if m else None

    def block_keys(block_name):
        m = re.search(block_name + r':\s*\[(.*?)\]', config_text, re.S)
        if not m:
            return []
        return re.findall(r'key:\s*"([^"]+)"', m.group(1))

    track_url = scalar("trackUrl")
    if not track_url:
        sys.exit("config.js has trackUrl: null — snapshot before disabling tracking (README wind-down step 2 comes before step 3)")
    start = scalar("eventStartDate")
    end = scalar("eventEndDate")
    if not start or not end:
        sys.exit("config.js must set eventStartDate and eventEndDate")
    return {
        "trackUrl": track_url.rstrip("/"),
        "eventStartDate": start,
        "eventEndDate": end,
        "dataLiveDate": scalar("dataLiveDate"),
        "filterKeys": block_keys("tagFilters") + block_keys("hoursFilters"),
    }


def parse_area_names(repo, event_start):
    year = event_start[:4]
    for candidate in (repo / f"data-{year}.js", repo / "data.js"):
        if not candidate.exists():
            continue
        m = re.search(r'AREA_COLORS\s*=\s*\{(.*?)\}', candidate.read_text(), re.S)
        if m:
            block = m.group(1)
            # keys may be quoted ("Funk Zone":) or bare identifiers (Downtown:)
            names = re.findall(r'["\']([^"\']+)["\']\s*:', block)
            for bare in re.findall(r'(?:^|,)\s*(\w+)\s*:', block):
                if bare not in names:
                    names.append(bare)
            return names
    return []


def fetch_json(url):
    # Cloudflare 403s the default Python-urllib user agent
    req = urllib.request.Request(url, headers={"User-Agent": "sbfoodweek-snapshot/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError) as e:
        raise RuntimeError(f"Worker request failed ({url}): {e}") from e


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__.strip().splitlines()[-1])
    repo = Path(sys.argv[1])
    overrides = dict(zip(sys.argv[2::2], sys.argv[3::2]))

    cfg = parse_config((repo / "config.js").read_text())

    anchor = min(d for d in (cfg["dataLiveDate"], cfg["eventStartDate"]) if d)
    start = overrides.get("--start") or (date.fromisoformat(anchor) - timedelta(days=7)).isoformat()
    end = overrides.get("--end") or date.today().isoformat()
    window = f"&start={start}&end={end}"
    base = cfg["trackUrl"] + "/?hourly=true"

    print(f"Fetching hourly data from {cfg['trackUrl']} ({start} → {end})")
    try:
        events = fetch_json(base + window)
    except RuntimeError as e:
        sys.exit(str(e))
    if not events:
        sys.exit("Worker returned no hourly data — check trackUrl and the date range")

    labels = parse_area_names(repo, cfg["eventStartDate"]) + cfg["filterKeys"]
    if not labels:
        sys.exit("No filter labels found (AREA_COLORS / tagFilters / hoursFilters) — check config.js and the data file")
    by_label = {}
    for label in labels:
        try:
            data = fetch_json(base + "&label=" + urllib.parse.quote(label) + window)
        except RuntimeError as e:
            print(f"  {label}: failed ({e}) — continuing")
            continue
        if data:
            by_label[label] = data
        print(f"  {label}: {sum(data.values()) if data else 0} events")

    out_dir = repo / "snapshots"
    out_dir.mkdir(exist_ok=True)
    (out_dir / "hourly-events.json").write_text(json.dumps(events, indent=2) + "\n")
    (out_dir / "hourly-labels.json").write_text(json.dumps(by_label, indent=2) + "\n")
    print(f"Wrote snapshots/hourly-events.json ({len(events)} hours)")
    print(f"Wrote snapshots/hourly-labels.json ({len(by_label)}/{len(labels)} labels with data)")


if __name__ == "__main__":
    main()
