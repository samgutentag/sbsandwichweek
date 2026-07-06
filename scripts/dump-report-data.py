#!/usr/bin/env python3
"""Refresh the report's committed data archives from Cloudflare.

Outputs:
  snapshots/raw-events-2026.json   — raw Analytics Engine event stream
  snapshots/rum-<utc-date>.json    — Web Analytics (RUM) aggregates

Replicates the 2026-07-02 one-off pull (same shapes; report/generate_report.py
reads both). Counts must be weighted by 'weight' (_sample_interval).

Auth: CF_API_TOKEN from the environment, or workers/track/.dev.vars
(KEY=value lines, wrangler's gitignored local-secrets file).
ACCOUNT_ID / DATASET_NAME / RUM_SITE_TAG come from workers/track/wrangler.toml.

Usage: python3 scripts/dump-report-data.py [--start 2026-06-15]
"""

import json
import os
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WORKER_DIR = REPO / "workers" / "track"


def read_kv(path):
    vals = {}
    if path.exists():
        for line in path.read_text().splitlines():
            m = re.match(r'^\s*([A-Z_]+)\s*=\s*"?([^"\n]+?)"?\s*$', line)
            if m:
                vals[m.group(1)] = m.group(2)
    return vals


def main():
    start = "2026-06-15"
    if "--start" in sys.argv:
        start = sys.argv[sys.argv.index("--start") + 1]

    toml = read_kv(WORKER_DIR / "wrangler.toml")
    dataset_m = re.search(r'^dataset\s*=\s*"([^"]+)"',
                          (WORKER_DIR / "wrangler.toml").read_text(), re.M)
    account_id = toml.get("ACCOUNT_ID")
    dataset = toml.get("DATASET_NAME") or (dataset_m.group(1) if dataset_m else None)
    site_tag = toml.get("RUM_SITE_TAG")
    token = os.environ.get("CF_API_TOKEN") or read_kv(WORKER_DIR / ".dev.vars").get("CF_API_TOKEN")
    if not (account_id and dataset and site_tag):
        sys.exit("could not read ACCOUNT_ID/DATASET_NAME/RUM_SITE_TAG from wrangler.toml")
    if not token:
        sys.exit("no CF_API_TOKEN in env or workers/track/.dev.vars — cannot pull")

    def post(url, body, content_type):
        req = urllib.request.Request(url, data=body.encode(), method="POST")
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Content-Type", content_type)
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())

    sql_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql"
    today = datetime.now(timezone.utc).date()

    # --- Raw event stream, paginated by UTC day (well under per-query limits) ---
    events = []
    day = date.fromisoformat(start)
    while day <= today:
        nxt = day + timedelta(days=1)
        resp = post(sql_url, f"""
            SELECT timestamp, blob1 AS action, blob2 AS label,
                   _sample_interval AS weight
            FROM {dataset}
            WHERE timestamp >= toDateTime('{day} 00:00:00')
              AND timestamp <  toDateTime('{nxt} 00:00:00')
            ORDER BY timestamp
            LIMIT 100000
        """, "text/plain")
        rows = resp.get("data", [])
        for r in rows:
            events.append({"timestamp": r["timestamp"], "action": r["action"],
                           "label": r["label"], "weight": int(r["weight"])})
        print(f"  {day}: {len(rows)} rows")
        day = nxt

    true_events = sum(e["weight"] for e in events)
    raw_out = {
        "meta": {
            "pulled_at_utc": str(today),
            "note": ("Raw Analytics Engine event stream. Counts must be weighted by "
                     "'weight' (_sample_interval); SUM(weight) is the true event count. "
                     "Timestamps are UTC."),
            "total_rows": len(events),
            "true_events": true_events,
        },
        "events": events,
    }
    (REPO / "snapshots" / "raw-events-2026.json").write_text(
        json.dumps(raw_out, indent=1))
    print(f"raw-events-2026.json: {len(events)} rows, {true_events} true events")

    # --- RUM aggregates (same GraphQL groups as the 2026-07-02 pull) ---
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    flt = f'siteTag: "{site_tag}", datetime_geq: "{start}T00:00:00Z", datetime_leq: "{now_iso}"'
    group = "rumPageloadEventsAdaptiveGroups"
    gql = f"""{{
      viewer {{ accounts(filter: {{ accountTag: "{account_id}" }}) {{
        devices:   {group}(filter: {{ {flt} }} limit: 50   orderBy: [count_DESC])
                   {{ count sum {{ visits }} dimensions {{ deviceType }} }}
        browsers:  {group}(filter: {{ {flt} }} limit: 50   orderBy: [count_DESC])
                   {{ count dimensions {{ userAgentBrowser }} }}
        os:        {group}(filter: {{ {flt} }} limit: 50   orderBy: [count_DESC])
                   {{ count dimensions {{ userAgentOS }} }}
        hourly:    {group}(filter: {{ {flt} }} limit: 2000 orderBy: [datetimeHour_ASC])
                   {{ count sum {{ visits }} dimensions {{ datetimeHour }} }}
        countries: {group}(filter: {{ {flt} }} limit: 50   orderBy: [count_DESC])
                   {{ count dimensions {{ countryName }} }}
        paths:     {group}(filter: {{ {flt} }} limit: 100  orderBy: [count_DESC])
                   {{ count dimensions {{ requestPath }} }}
        referers:  {group}(filter: {{ {flt} }} limit: 100  orderBy: [count_DESC])
                   {{ count dimensions {{ refererHost }} }}
      }} }}
    }}"""
    resp = post("https://api.cloudflare.com/client/v4/graphql",
                json.dumps({"query": gql}), "application/json")
    if resp.get("errors"):
        sys.exit(f"RUM GraphQL errors: {json.dumps(resp['errors'])[:500]}")
    acct = resp["data"]["viewer"]["accounts"][0]

    rum_out = {
        "meta": {
            "pulled_at_utc": str(today),
            "site": "sbsandwichweekmap.com",
            "siteTag": site_tag,
            "note": (f"Cloudflare Web Analytics (RUM), {start}..{today}. "
                     "Sampled pageload stream. Pulled via GraphQL."),
        },
    }
    for key in ("devices", "browsers", "os", "hourly", "countries", "paths", "referers"):
        rum_out[key] = acct.get(key) or []
    rum_path = REPO / "snapshots" / f"rum-{today}.json"
    rum_path.write_text(json.dumps(rum_out, indent=1))
    print(f"{rum_path.name}: " + ", ".join(f"{k}={len(rum_out[k])}" for k in
          ("devices", "browsers", "os", "hourly", "countries", "paths", "referers")))
    print("\nRemember: report/generate_report.py reads a dated rum filename — "
          "update it if this pull wrote a new date.")


if __name__ == "__main__":
    main()
