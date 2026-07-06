#!/usr/bin/env python3
"""Validate the repo is ready for an event, then apply the theme.

Checks config.js, wrangler.toml, and the data files against the data contract,
runs apply-theme.py, and prints the manual steps that remain. Fails loudly on
contract violations so a half-configured event never ships.

Usage: python3 scripts/start-event.py [--validate-only]
"""

import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PLACEHOLDERS = ("YOUR-DOMAIN", "YOUR_USERNAME", "YOUR_REPO", "example.com", "Your Source", "TBD")

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def eval_js(paths, globals_needed):
    """Evaluate JS data files with node and return the requested globals.
    (const declarations are scoped to each eval, so export via globalThis inside it.)"""
    exports = ";".join(
        f'globalThis.{g}=typeof {g}==="undefined"?undefined:{g}' for g in globals_needed
    )
    reads = "".join(
        f"eval(fs.readFileSync('{p}','utf8')+';{exports};');" for p in paths
    )
    script = (
        "const fs=require('fs');" + reads +
        "console.log(JSON.stringify({" + ",".join(globals_needed) + "}))"
    )
    out = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"node failed evaluating {paths}: {out.stderr.strip()}")
    return json.loads(out.stdout)


def main():
    validate_only = "--validate-only" in sys.argv

    # ── config.js ────────────────────────────────────────────────────────────
    config = (REPO / "config.js").read_text()

    def scalar(name):
        m = re.search(r'^\s*' + name + r':\s*"([^"]+)"', config, re.M)
        return m.group(1) if m else None

    required = ["eventName", "emoji", "siteUrl", "eventDates", "storageKey", "timeZone",
                "eventStartDate", "eventEndDate"]
    for key in required:
        val = scalar(key)
        if not val:
            err(f"config.js: {key} is not set")
        elif any(p in val for p in PLACEHOLDERS):
            err(f"config.js: {key} still has a placeholder value ({val})")

    if re.search(r'^\s*archived:\s*true', config, re.M):
        err("config.js: archived is true — un-archive before starting an event")
    if not scalar("trackUrl"):
        warn("config.js: trackUrl is null — no click tracking (fine if intentional)")
    if not scalar("cfAnalyticsToken"):
        warn("config.js: cfAnalyticsToken is null — no Cloudflare Web Analytics")
    if not scalar("dataLiveDate"):
        warn("config.js: dataLiveDate is null — full menu data shows immediately")

    start, end = scalar("eventStartDate"), scalar("eventEndDate")
    if start and end and start > end:
        err(f"config.js: eventStartDate {start} is after eventEndDate {end}")

    # ── wrangler.toml ────────────────────────────────────────────────────────
    toml = (REPO / "workers/track/wrangler.toml").read_text()
    ds_var = re.search(r'^DATASET_NAME\s*=\s*"([^"]+)"', toml, re.M)
    ds_bind = re.search(r'^dataset\s*=\s*"([^"]+)"', toml, re.M)
    if not ds_var:
        err("wrangler.toml: DATASET_NAME is not set")
    elif ds_bind and ds_var.group(1) != ds_bind.group(1):
        err(f"wrangler.toml: DATASET_NAME ({ds_var.group(1)}) != dataset binding ({ds_bind.group(1)})")
    if "YOUR_CLOUDFLARE_ACCOUNT_ID" in toml:
        warn("wrangler.toml: ACCOUNT_ID is still the placeholder")
    if 'RUM_SITE_TAG = "YOUR_RUM_SITE_TAG"' in toml:
        warn("wrangler.toml: RUM_SITE_TAG is still the placeholder (RUM endpoints will be empty; "
             "see the discovery query in the comment above it)")

    # ── data contract ────────────────────────────────────────────────────────
    year = (start or "")[:4]
    data_file = REPO / f"data-{year}.js"
    if not year:
        pass  # already an error above
    elif not data_file.exists():
        err(f"{data_file.name} missing — the loader picks data-<year>.js from eventStartDate's year")
    else:
        block_m = re.search(r'tagFilters:\s*\[(.*?)\]', config, re.S)
        # drop commented-out entries before extracting keys
        block = re.sub(r'^\s*//.*$', '', block_m.group(1), flags=re.M) if block_m else ""
        tag_keys = re.findall(r'key:\s*"([^"]+)"', block)
        data = eval_js([data_file], ["SOURCE_URL", "AREA_COLORS", "restaurants"])
        if not data.get("SOURCE_URL"):
            err(f"{data_file.name}: SOURCE_URL is not defined")
        areas = data.get("AREA_COLORS") or {}
        if not areas:
            err(f"{data_file.name}: AREA_COLORS is empty")
        rests = data.get("restaurants") or []
        if not rests:
            err(f"{data_file.name}: restaurants is empty")
        for r in rests:
            name = r.get("name", "<unnamed>")
            for field in ("name", "address", "area", "lat", "lng", "mapUrl", "menuItems"):
                if r.get(field) in (None, "") and field != "menuItems":
                    err(f"{data_file.name}: {name}: missing {field}")
            if r.get("area") and r["area"] not in areas:
                err(f"{data_file.name}: {name}: area '{r['area']}' not in AREA_COLORS")
            if not isinstance(r.get("menuItems"), list):
                err(f"{data_file.name}: {name}: menuItems must be an array")
            for key in tag_keys:
                if not isinstance(r.get(key), bool):
                    err(f"{data_file.name}: {name}: tagFilters key '{key}' must be a boolean on every restaurant")
        if not (REPO / "data.js").exists():
            warn("data.js skeleton missing — pre-dataLiveDate visitors get a broken page")

    # ── report ───────────────────────────────────────────────────────────────
    for w in warnings:
        print(f"  WARN  {w}")
    for e in errors:
        print(f"  ERROR {e}")
    if errors:
        sys.exit(f"\n{len(errors)} error(s) — fix before launching.")
    print(f"\nValidation passed ({len(warnings)} warning(s)).")

    if validate_only:
        return

    print("\nRunning apply-theme.py...")
    subprocess.run([sys.executable, str(REPO / "apply-theme.py")], check=True, cwd=REPO)

    print("""
Remaining manual steps:
  1. GitHub repo secrets: GOOGLE_PLACES_API_KEY, CF_ACCOUNT_ID, CF_API_TOKEN
  2. Worker secrets (from workers/track/): wrangler secret put CF_API_TOKEN / ADMIN_TOKEN
  3. Deploy the Worker: cd workers/track && wrangler deploy
  4. GitHub Pages + custom domain DNS (see README Steps 7-8)
  5. Commit and push

The scheduled workflows activate themselves inside the event window — no edits needed.""")


if __name__ == "__main__":
    main()
