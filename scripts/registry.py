#!/usr/bin/env python3
"""Shared restaurant registry — the cross-event venue database.

registry/restaurants.json holds every venue seen across SB food-week events:
coordinates, contacts, Google/Apple Maps links (the Apple ones are captured by
hand — never lose them), canonical areas, and participation history. New
events pull from it instead of re-researching; concluded events write back.

Subcommands
  seed       one-time build from the existing event repos' data files
  pull       generate data-<year>.js (+ data.js skeleton) for a roster of names
  writeback  merge an event repo's data file back into the registry
  check      validate registry integrity

The registry lives only in the template repo. From an event repo, this script
finds it in a sibling ../sbfoodweek-template checkout (or pass --registry).

Examples
  python3 scripts/registry.py seed --repos ../sbburgerweek ../sbcoffeeweek ../sbsandwichweek
  python3 scripts/registry.py pull --roster roster.txt --year 2027 --event sbburritoweek
  python3 scripts/registry.py writeback --event sbsandwichweek --year 2026
  python3 scripts/registry.py check
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LINK_FIELDS = ("mapUrl", "appleMapsUrl")
CONTACT_FIELDS = ("website", "phone", "instagram")


def registry_path(override):
    if override:
        return Path(override)
    local = HERE.parent / "registry" / "restaurants.json"
    if local.parent.parent.name == "sbfoodweek-template" or local.exists():
        return local
    sibling = HERE.parent.parent / "sbfoodweek-template" / "registry" / "restaurants.json"
    if sibling.exists():
        return sibling
    sys.exit("registry not found — clone sbfoodweek-template as a sibling or pass --registry")


def load_registry(path):
    if path.exists():
        return json.loads(path.read_text())
    return {"areas": {}, "venues": {}}


def save_registry(path, reg):
    path.parent.mkdir(parents=True, exist_ok=True)
    reg["venues"] = dict(sorted(reg["venues"].items()))
    path.write_text(json.dumps(reg, indent=2, ensure_ascii=False) + "\n")


def slugify(name):
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))


def split_name(name):
    """'Crushcakes & Cafe (Goleta)' -> ('Crushcakes & Cafe', 'Goleta')"""
    m = re.match(r"^(.*?)\s*\(([^)]+)\)$", name)
    return (m.group(1), m.group(2)) if m else (name, None)


def eval_data_file(path):
    script = (
        "const fs=require('fs');"
        f"eval(fs.readFileSync('{path}','utf8')"
        "+';globalThis.restaurants=restaurants;globalThis.AREA_COLORS=AREA_COLORS;');"
        "console.log(JSON.stringify({restaurants,AREA_COLORS}))"
    )
    out = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"node failed on {path}: {out.stderr.strip()}")
    return json.loads(out.stdout)


def event_year(repo):
    config = (Path(repo) / "config.js").read_text()
    m = re.search(r'eventStartDate:\s*"(\d{4})', config)
    return int(m.group(1)) if m else None


def is_fallback_link(url):
    """Search-URL fallbacks are auto-generated; curated share links beat them."""
    return bool(url) and ("google.com/maps/search" in url or "maps.apple.com/?q=" in url)


def merge_location(venue, entry, log):
    """Upsert one physical location; match by label, else by ~11m coordinates."""
    label = entry.get("label")
    for loc in venue["locations"]:
        same_label = label and loc.get("label") == label
        same_spot = (
            loc.get("lat") and entry.get("lat")
            and round(loc["lat"], 4) == round(entry["lat"], 4)
            and round(loc["lng"], 4) == round(entry["lng"], 4)
        )
        if same_label or same_spot:
            for k, v in entry.items():
                if v is None:
                    continue
                if k in LINK_FIELDS and loc.get(k) and loc[k] != v:
                    if is_fallback_link(v) and not is_fallback_link(loc[k]):
                        log.append(f"    {venue['name']}: kept curated {k} over fallback")
                        continue
                    log.append(f"    {venue['name']}: {k} updated ({loc[k]} -> {v})")
                loc[k] = v
            return
    venue["locations"].append({k: v for k, v in entry.items()})
    if len(venue["locations"]) > 1:
        log.append(f"    {venue['name']}: new location added ({label or entry.get('address')})")


def merge_restaurant(reg, r, event, year, log):
    base, label = split_name(r["name"])
    slug = slugify(base)

    # aka lookup: a rename in a later event still lands on the same venue
    if slug not in reg["venues"]:
        for s, v in reg["venues"].items():
            if base in v.get("aka", []) or v["name"] == base:
                slug = s
                break

    venue = reg["venues"].setdefault(slug, {
        "name": base, "aka": [], "website": None, "phone": None,
        "instagram": None, "locations": [], "participation": {},
    })
    if venue["name"] != base and base not in venue["aka"]:
        venue["aka"].append(base)

    for f in CONTACT_FIELDS:
        if r.get(f):
            venue[f] = r[f]

    merge_location(venue, {
        "label": label,
        "address": r.get("address"),
        "area": r.get("area"),
        "lat": r.get("lat"),
        "lng": r.get("lng"),
        "mapUrl": r.get("mapUrl"),
        "appleMapsUrl": r.get("appleMapsUrl"),
    }, log)

    if event and year:
        prev = venue["participation"].get(event)
        venue["participation"][event] = min(prev, year) if prev else year


def cmd_seed(args):
    path = registry_path(args.registry)
    reg = load_registry(path)
    log = []
    for repo in args.repos:  # pass oldest-first: later repos win field conflicts
        repo = Path(repo).resolve()
        event = repo.name
        year = event_year(repo)
        data_files = sorted(repo.glob("data-2*.js"))
        if not data_files:
            print(f"  {event}: no data-<year>.js — skipped")
            continue
        for df in data_files:
            data = eval_data_file(df)
            for area, color in data["AREA_COLORS"].items():
                reg["areas"].setdefault(area, color)
            for r in data["restaurants"]:
                merge_restaurant(reg, r, event, year, log)
            print(f"  {event}: merged {len(data['restaurants'])} entries from {df.name}")
        # participation history that predates the repos (firstYearByName)
        config = (repo / "config.js").read_text()
        m = re.search(r"firstYearByName\s*=\s*\{(.*?)\};", config, re.S)
        if m:
            for name, first in re.findall(r'"([^"]+)":\s*(\d{4})', m.group(1)):
                vslug = slugify(split_name(name)[0])
                if vslug in reg["venues"]:
                    prev = reg["venues"][vslug]["participation"].get(event)
                    reg["venues"][vslug]["participation"][event] = min(prev or 9999, int(first))
    save_registry(path, reg)
    print(f"\nReconciliation notes:")
    print("\n".join(log) if log else "    (no field conflicts)")
    print(f"\nRegistry: {len(reg['venues'])} venues, {len(reg['areas'])} areas -> {path}")


def find_venue(reg, name):
    base, label = split_name(name.strip())
    slug = slugify(base)
    if slug in reg["venues"]:
        return slug, label
    low = base.lower()
    for s, v in reg["venues"].items():
        if v["name"].lower() == low or low in [a.lower() for a in v.get("aka", [])]:
            return s, label
    return None, label


def venue_to_entries(venue, label=None):
    """Registry venue -> data-file restaurant objects (one per location)."""
    locs = venue["locations"]
    if label:
        locs = [l for l in locs if l.get("label") == label] or locs
    multi = len(locs) > 1
    out = []
    for loc in locs:
        name = venue["name"] + (f" ({loc['label']})" if multi and loc.get("label") else "")
        out.append({
            "name": name,
            "address": loc.get("address"),
            "area": loc.get("area"),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "mapUrl": loc.get("mapUrl"),
            "appleMapsUrl": loc.get("appleMapsUrl"),
            "website": venue.get("website"),
            "phone": venue.get("phone"),
            "instagram": venue.get("instagram"),
            "menuItems": [],
        })
    return out


def render_data_js(entries, source_url, areas, year, skeleton):
    used_areas = {e["area"] for e in entries if e.get("area")}
    lines = [
        f"// Generated by scripts/registry.py pull — {'skeleton (data.js)' if skeleton else f'full data (data-{year}.js)'}",
        "// Fill menuItems (and any tagFilters booleans) by hand; see data-template.js for the contract.",
        "",
        f'const SOURCE_URL = "{source_url}";',
        "",
        "const AREA_COLORS = {",
    ]
    for a in sorted(used_areas):
        lines.append(f'  "{a}": "{areas.get(a, "#6b7280")}",')
    lines += ["};", "", "const restaurants = ["]
    for e in entries:
        lines.append("  {")
        lines.append(f'    name: {json.dumps(e["name"], ensure_ascii=False)},')
        for f in ("address", "area"):
            lines.append(f"    {f}: {json.dumps(e.get(f), ensure_ascii=False)},")
        lines.append(f'    lat: {e.get("lat")},'.replace("None", "null"))
        lines.append(f'    lng: {e.get("lng")},'.replace("None", "null"))
        for f in ("mapUrl", "appleMapsUrl", "website", "phone", "instagram"):
            lines.append(f"    {f}: {json.dumps(e.get(f), ensure_ascii=False)},")
        lines.append("    menuItems: [],")
        lines.append("  },")
    lines += ["];", ""]
    return "\n".join(lines)


def cmd_pull(args):
    path = registry_path(args.registry)
    reg = load_registry(path)
    if not reg["venues"]:
        sys.exit("registry is empty — run seed first")
    roster = [l.strip() for l in Path(args.roster).read_text().splitlines()
              if l.strip() and not l.startswith("#")]
    entries, unknown, first_year = [], [], {}
    for name in roster:
        slug, label = find_venue(reg, name)
        if not slug:
            unknown.append(name)
            entries.append({
                "name": name, "address": "TODO", "area": "TODO",
                "lat": None, "lng": None,
                "mapUrl": f"https://www.google.com/maps/search/?api=1&query={name.replace(' ', '+')}+Santa+Barbara",
                "appleMapsUrl": None,  # https://maps.apple.com/?q=<name> once coords are known
                "website": None, "phone": None, "instagram": None, "menuItems": [],
            })
            continue
        venue = reg["venues"][slug]
        entries.extend(venue_to_entries(venue, label))
        if venue["participation"]:
            first_year[venue["name"]] = min(venue["participation"].values())

    out_dir = Path(args.out or ".")
    full = render_data_js(entries, args.source_url, reg["areas"], args.year, skeleton=False)
    (out_dir / f"data-{args.year}.js").write_text(full)
    (out_dir / "data.js").write_text(full.replace(f"full data (data-{args.year}.js)", "skeleton (data.js)"))
    print(f"Wrote data-{args.year}.js + data.js ({len(entries)} entries; {len(unknown)} unknown venues stubbed)")
    if unknown:
        print("  Unknown (fill by hand, then writeback adds them to the registry):")
        for u in unknown:
            print(f"    - {u}")
    if first_year:
        print("\nfirstYearByName for config.js (returning badges):")
        print("THEME.firstYearByName = {")
        for n, y in sorted(first_year.items()):
            print(f'  "{n}": {y},')
        print("};")


def cmd_writeback(args):
    path = registry_path(args.registry)
    reg = load_registry(path)
    repo = Path(args.repo or ".").resolve()
    df = repo / f"data-{args.year}.js"
    if not df.exists():
        sys.exit(f"{df} not found")
    data = eval_data_file(df)
    log = []
    for area, color in data["AREA_COLORS"].items():
        reg["areas"].setdefault(area, color)
    for r in data["restaurants"]:
        merge_restaurant(reg, r, args.event, int(args.year), log)
    save_registry(path, reg)
    print(f"Merged {len(data['restaurants'])} entries from {df.name} into the registry.")
    print("\n".join(log) if log else "  (no field conflicts)")
    print(f"Commit the registry in the template repo: git -C {path.parent.parent} add registry && git commit")


def cmd_check(args):
    path = registry_path(args.registry)
    reg = load_registry(path)
    problems = []
    aka_seen = {}
    for slug, v in reg["venues"].items():
        if not v["locations"]:
            problems.append(f"{slug}: no locations")
        for loc in v["locations"]:
            if loc.get("area") and loc["area"] not in reg["areas"]:
                problems.append(f"{slug}: area '{loc['area']}' not canonical")
            if loc.get("lat") is None or loc.get("lng") is None:
                problems.append(f"{slug}: location missing coordinates")
        for aka in v.get("aka", []):
            if aka in aka_seen:
                problems.append(f"aka '{aka}' claimed by both {aka_seen[aka]} and {slug}")
            aka_seen[aka] = slug
    apple = sum(1 for v in reg["venues"].values() for l in v["locations"] if l.get("appleMapsUrl"))
    total_locs = sum(len(v["locations"]) for v in reg["venues"].values())
    print(f"{len(reg['venues'])} venues, {total_locs} locations "
          f"({apple} with appleMapsUrl), {len(reg['areas'])} areas")
    if problems:
        print("\n".join(f"  PROBLEM {p}" for p in problems))
        sys.exit(1)
    print("check passed")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--registry", help="path to restaurants.json (default: auto-locate)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("seed", help="build the registry from existing event repos")
    s.add_argument("--repos", nargs="+", required=True, help="event repo paths, oldest first")
    s.set_defaults(fn=cmd_seed)

    p = sub.add_parser("pull", help="generate data files for a roster of venue names")
    p.add_argument("--roster", required=True, help="text file, one venue name per line")
    p.add_argument("--year", required=True)
    p.add_argument("--event", help="event slug (for docs only)")
    p.add_argument("--source-url", default="https://example.com/your-event-article")
    p.add_argument("--out", help="output directory (default: cwd)")
    p.set_defaults(fn=cmd_pull)

    w = sub.add_parser("writeback", help="merge an event's data file into the registry")
    w.add_argument("--event", required=True, help="event slug, e.g. sbsandwichweek")
    w.add_argument("--year", required=True)
    w.add_argument("--repo", help="event repo path (default: cwd)")
    w.set_defaults(fn=cmd_writeback)

    c = sub.add_parser("check", help="validate registry integrity")
    c.set_defaults(fn=cmd_check)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
