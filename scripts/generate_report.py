#!/usr/bin/env python3
"""Generate a post-event metrics report from committed snapshot archives.

Works for any event repo after wind-down, using only durable local data — no
Worker or Analytics Engine access needed (raw rows expire after ~90 days):

  tracking-snapshot.js            — final per-restaurant action counts + likes
  snapshots/tracking-*.json       — daily cumulative snapshots (per-day deltas)
  snapshots/hourly-events.json    — hourly action counts over the event window
  config.js + data-<year>.js      — event identity and restaurant metadata

Outputs print-ready HTML (no external assets):
  report/index.html               — event-wide report for the organizer
  report/restaurants/<slug>.html  — one-pager per restaurant

Sections degrade gracefully: no audience/referrer data (that needs a RUM
capture during the event), and counts from events that predate the
SUM(_sample_interval) fix may run slightly low — the methodology says so.

Usage: python3 scripts/generate_report.py
"""

import html
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "report"
INTENT_ACTIONS = ("directions-apple", "directions-google", "website", "phone")

INK, INK2, MUTED, GRID = "#0b0b0b", "#52514e", "#898781", "#e1e0d9"
BLUE, BLUE_LIGHT = "#2a78d6", "#9ec5f4"


def esc(s):
    return html.escape(str(s), quote=True)


def fmt(n):
    return f"{round(n):,}"


# ── inputs ────────────────────────────────────────────────────────────────────

def load_config():
    src = (REPO / "config.js").read_text()

    def scalar(name):
        m = re.search(r'^\s*' + name + r':\s*"([^"]+)"', src, re.M)
        return m.group(1) if m else None

    cfg = {k: scalar(k) for k in
           ("eventName", "eventDates", "emoji", "siteUrl", "timeZone",
            "eventStartDate", "eventEndDate", "dataLiveDate", "sourceUrl")}
    if not cfg["eventStartDate"] or not cfg["eventEndDate"]:
        sys.exit("config.js must have eventStartDate/eventEndDate to scope the report")
    block = re.search(r"firstYearByName\s*=\s*\{(.*?)\};", src, re.S)
    cfg["firstYearByName"] = dict(re.findall(r'"([^"]+)":\s*(\d{4})', block.group(1))) if block else {}
    return cfg


def load_restaurants(cfg):
    year = cfg["eventStartDate"][:4]
    df = REPO / f"data-{year}.js"
    if not df.exists():
        sys.exit(f"{df.name} not found")
    script = (
        "const fs=require('fs');"
        f"eval(fs.readFileSync('{df}','utf8')"
        "+';globalThis.restaurants=restaurants;globalThis.AREA_COLORS=AREA_COLORS;');"
        "console.log(JSON.stringify({restaurants,AREA_COLORS}))"
    )
    out = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"node failed on {df.name}: {out.stderr.strip()}")
    return json.loads(out.stdout)


def load_final_snapshot():
    baked = REPO / "tracking-snapshot.js"
    if baked.exists():
        src = baked.read_text()
        if "{" in src:
            return json.loads(src[src.index("{"):src.rindex("}") + 1])
    dailies = sorted((REPO / "snapshots").glob("tracking-2*.json"))
    if dailies:
        return json.loads(dailies[-1].read_text())
    sys.exit("no tracking-snapshot.js or snapshots/tracking-*.json — nothing to report from")


def load_daily_series():
    out = []
    for p in sorted((REPO / "snapshots").glob("tracking-2*.json")):
        out.append((p.stem.replace("tracking-", ""), json.loads(p.read_text())))
    return out


def load_hourly():
    p = REPO / "snapshots" / "hourly-events.json"
    return json.loads(p.read_text()) if p.exists() else {}


# ── aggregation ───────────────────────────────────────────────────────────────

def event_days(cfg):
    d = date.fromisoformat(cfg["eventStartDate"])
    end = date.fromisoformat(cfg["eventEndDate"])
    days = []
    while d <= end:
        days.append(d.isoformat())
        d += timedelta(days=1)
    return days


def to_local_day(ts_utc, tz):
    dt = datetime.fromisoformat(ts_utc.replace("Z", "")).replace(tzinfo=timezone.utc)
    return dt.astimezone(tz).date().isoformat()


def restaurant_rows(detail, upvotes, names):
    rows = {}
    for name in names:
        c = detail.get(name, {})
        views = c.get("view", 0) + c.get("sidebar-view", 0)
        intents = sum(c.get(a, 0) for a in INTENT_ACTIONS)
        rows[name] = {
            "views": views,
            "intents": intents,
            "directions": c.get("directions-apple", 0) + c.get("directions-google", 0),
            "website": c.get("website", 0),
            "phone": c.get("phone", 0),
            "instagram": c.get("instagram", 0),
            "shares": c.get("share", 0),
            "deeplinks": c.get("deeplink", 0),
            "likes": max(0, upvotes.get(name, 0)),
            "intent_rate": (intents / views * 100) if views else 0.0,
        }
    return rows


def daily_views_by_restaurant(daily_series, names):
    """Per-restaurant daily view deltas from cumulative daily snapshots."""
    out = defaultdict(dict)
    prev = {}
    for day, snap in daily_series:
        detail = snap.get("detail", {})
        for name in names:
            c = detail.get(name, {})
            total = c.get("view", 0) + c.get("sidebar-view", 0)
            out[name][day] = max(0, total - prev.get(name, 0))
            prev[name] = total
    return out


# ── svg helpers (dataviz mark specs: thin marks, rounded ends, direct labels) ─

def svg_columns(series, width=680, height=170, color=BLUE, highlight=None):
    if not series:
        return ""
    top_pad, bottom = 18, 22
    max_v = max(v for _, v in series) or 1
    n = len(series)
    gap = 2
    bw = (width - gap * (n - 1)) / n
    parts = [f'<svg viewBox="0 0 {width} {height}" width="100%" role="img" font-family="system-ui,-apple-system,sans-serif">']
    parts.append(f'<line x1="0" y1="{height-bottom}" x2="{width}" y2="{height-bottom}" stroke="{GRID}" stroke-width="1"/>')
    peak_i = max(range(n), key=lambda i: series[i][1])
    for i, (lab, v) in enumerate(series):
        x = i * (bw + gap)
        h = (height - top_pad - bottom) * v / max_v
        y = height - bottom - h
        fill = color if (highlight is None or lab in highlight) else BLUE_LIGHT
        parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{max(h,1):.1f}" rx="3" fill="{fill}"/>')
        if i == peak_i:
            parts.append(f'<text x="{x+bw/2:.1f}" y="{y-5:.1f}" text-anchor="middle" font-size="11" fill="{INK}" font-weight="600">{fmt(v)}</text>')
        parts.append(f'<text x="{x+bw/2:.1f}" y="{height-7}" text-anchor="middle" font-size="10" fill="{MUTED}">{esc(lab)}</text>')
    parts.append("</svg>")
    return "".join(parts)


def svg_hbars(rows, width=680, color=BLUE):
    if not rows:
        return ""
    row_h, gap, label_w, val_w = 24, 6, 220, 64
    max_v = max(v for _, v in rows) or 1
    height = len(rows) * (row_h + gap)
    bar_w = width - label_w - val_w
    parts = [f'<svg viewBox="0 0 {width} {height}" width="100%" role="img" font-family="system-ui,-apple-system,sans-serif">']
    for i, (lab, v) in enumerate(rows):
        y = i * (row_h + gap)
        w = bar_w * v / max_v
        parts.append(f'<text x="{label_w-8}" y="{y+row_h/2+4}" text-anchor="end" font-size="12" fill="{INK2}">{esc(lab)}</text>')
        parts.append(f'<rect x="{label_w}" y="{y+3}" width="{max(w,2):.1f}" height="{row_h-6}" rx="4" fill="{color}"/>')
        parts.append(f'<text x="{label_w+max(w,2)+8:.1f}" y="{y+row_h/2+4}" font-size="12" fill="{INK}" font-weight="600">{fmt(v)}</text>')
    parts.append("</svg>")
    return "".join(parts)


BASE_CSS = f"""
  * {{ box-sizing: border-box; }}
  body {{ font-family: Georgia, 'Times New Roman', serif; color: {INK}; margin: 0;
         line-height: 1.55; font-size: 15px; background: #fff; }}
  .page {{ max-width: 7.6in; margin: 0 auto; padding: 40px 32px; }}
  h1, h2, h3 {{ font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }}
  h1 {{ font-size: 26px; margin: 0 0 2px; letter-spacing: -0.02em; }}
  h2 {{ font-size: 17px; margin: 34px 0 10px; border-bottom: 2px solid {INK}; padding-bottom: 5px; break-after: avoid; }}
  .subtitle {{ color: {INK2}; font-size: 14px; margin: 0 0 6px; }}
  .tiles {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }}
  .tile {{ border: 1px solid {GRID}; border-radius: 8px; padding: 12px 14px; break-inside: avoid; }}
  .tile .v {{ font-family: system-ui, sans-serif; font-size: 26px; font-weight: 700; }}
  .tile .l {{ font-family: system-ui, sans-serif; font-size: 11px; color: {INK2};
             text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }}
  table {{ border-collapse: collapse; width: 100%; font-family: system-ui, sans-serif; font-size: 12px; }}
  th {{ text-align: left; border-bottom: 2px solid {INK}; padding: 5px 8px; font-size: 11px;
       text-transform: uppercase; letter-spacing: 0.04em; }}
  th.num, td.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  td {{ border-bottom: 1px solid {GRID}; padding: 4px 8px; }}
  tr {{ break-inside: avoid; }}
  .fig {{ margin: 14px 0; break-inside: avoid; }}
  .fig figcaption {{ font-family: system-ui, sans-serif; font-size: 11px; color: {MUTED}; margin-top: 4px; }}
  .note {{ color: {INK2}; font-size: 13px; }}
  .footer {{ margin-top: 40px; padding-top: 10px; border-top: 1px solid {GRID};
            font-size: 11px; color: {MUTED}; font-family: system-ui, sans-serif; }}
  .break {{ break-before: page; }}
  @media print {{ .page {{ padding: 0; max-width: none; }} body {{ font-size: 13px; }} }}
"""


def page(title, body):
    return (f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
            f"<meta name='viewport' content='width=device-width, initial-scale=1'>"
            f"<title>{esc(title)}</title><style>{BASE_CSS}</style></head>"
            f"<body><div class='page'>{body}</div></body></html>")


def tiles(items):
    cells = "".join(f"<div class='tile'><div class='v'>{v}</div><div class='l'>{esc(l)}</div></div>"
                    for v, l in items)
    return f"<div class='tiles'>{cells}</div>"


def slugify(name):
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))


# ── report assembly ───────────────────────────────────────────────────────────

def main():
    cfg = load_config()
    tz = ZoneInfo(cfg["timeZone"] or "America/Los_Angeles")
    data = load_restaurants(cfg)
    restaurants = data["restaurants"]
    names = {r["name"] for r in restaurants}
    area_by_name = {r["name"]: r["area"] for r in restaurants}

    snap = load_final_snapshot()
    detail, upvotes = snap.get("detail", {}), snap.get("upvotes", {})
    daily_series = load_daily_series()
    hourly = load_hourly()

    rows = restaurant_rows(detail, upvotes, names)
    ranked = sorted(rows, key=lambda n: rows[n]["views"], reverse=True)
    total = lambda k: sum(r[k] for r in rows.values())
    days = event_days(cfg)

    # daily curve: hourly archive bucketed onto the event's clock
    daily_views = Counter()
    for hour, actions in hourly.items():
        day = to_local_day(hour.replace(" ", "T"), tz)
        daily_views[day] += actions.get("view", 0) + actions.get("sidebar-view", 0)
    day_labels = [(f"{int(d[5:7])}/{int(d[8:])}", daily_views[d])
                  for d in sorted(daily_views) if daily_views[d] > 0]
    highlight = {f"{int(d[5:7])}/{int(d[8:])}" for d in days}

    area_views = Counter()
    for name, r in rows.items():
        area_views[area_by_name.get(name, "Other")] += r["views"]

    # filters + searches recovered from the final snapshot's entity table
    filter_counts = Counter()
    searches, zero_searches = Counter(), Counter()
    for label, actions in detail.items():
        f = actions.get("filter-area", 0) + actions.get("filter-tag", 0) + actions.get("filter-hours", 0)
        if f and label not in names:
            filter_counts[label] += f
        if actions.get("search"):
            searches[label.lower()] += actions["search"]
        if actions.get("search-empty"):
            zero_searches[label.lower()] += actions["search-empty"]

    event = cfg["eventName"]
    zero_top = zero_searches.most_common(5)
    body = f"""
<h1>{esc(event)}: What the Map Saw</h1>
<p class="subtitle">Engagement report from {esc(cfg["siteUrl"] or "the event map")} ·
{esc(cfg["eventDates"] or "")} · prepared {date.today().strftime("%B %-d, %Y")}</p>

<p>{esc(event)} ran with {len(restaurants)} participating restaurants. The companion map let
readers browse every menu item, filter by neighborhood, and jump straight to directions,
websites, and phone numbers. This report covers what visitors did with it, from the
archived tracking data (methodology at the end).</p>

<h2>The Headline</h2>
{tiles([(fmt(total("views")), "restaurant views"),
        (fmt(total("intents")), "intent taps (directions, site, call)"),
        (fmt(total("directions")), "directions requests"),
        (f"{total('intents')/max(total('views'),1)*100:.1f}%", "views that became an intent tap")])}
<p>An "intent tap" is a click on directions, a restaurant's website, or its phone number:
the moment a browser stops browsing and starts planning a visit.
{fmt(total("directions"))} of those were directions requests, which is about as close to
"a customer is on the way" as web analytics gets.</p>

{f'''<h2>Traffic Over the Event</h2>
<figure class="fig">{svg_columns(day_labels, highlight=highlight)}
<figcaption>Restaurant views per day on the event's clock ({esc(cfg["timeZone"] or "local")}).
Days outside the official window shown in lighter blue.</figcaption></figure>''' if day_labels else ""}

<h2>Neighborhoods</h2>
<figure class="fig">{svg_hbars([(a, v) for a, v in area_views.most_common(9) if v])}
<figcaption>Restaurant views by neighborhood.</figcaption></figure>

<h2>Restaurant Leaderboard</h2>
<figure class="fig">{svg_hbars([(n, rows[n]["views"]) for n in ranked[:15]])}
<figcaption>Most-viewed restaurants. Full table for all {len(restaurants)} on the last page.</figcaption></figure>
<p>Views measure curiosity; the intent rate (intent taps per hundred views) measures pull.
Each restaurant's one-page summary includes its own numbers and percentile standing.</p>

<h2>How People Used the Map</h2>
{tiles([(fmt(sum(searches.values())), "searches typed"),
        (fmt(sum(filter_counts.values())), "filter taps"),
        (fmt(total("shares")), "shares"),
        (fmt(total("deeplinks")), "direct links opened")])}
{f'<p>Searches that returned nothing are a menu wishlist for next year: readers looked for {", ".join(chr(34)+esc(t)+chr(34) for t, _ in zero_top)} and came up empty.</p>' if zero_top else ""}

<h2>Methodology, Honestly</h2>
<p class="note">Counts come from a privacy-light tracker: no cookies, no user IDs, no precise
location. Numbers are actions, not unique people (someone who opened a restaurant twice counts
twice). This report is built from the final archived snapshot rather than live analytics, so
figures are the end-of-event totals; if analytics sampling occurred during peak traffic they
may run slightly low. Audience breakdowns (devices, referrers) require data captured during
the event window and are omitted where unavailable. Beacon-based tracking loses a small
number of events by design, and like counts allowed un-liking.</p>

<h2 class="break">Appendix: All Restaurants</h2>
<table>
<tr><th>Restaurant</th><th>Area</th><th class="num">Views</th><th class="num">Intent taps</th>
<th class="num">Directions</th><th class="num">Shares</th><th class="num">Likes</th><th class="num">Intent %</th></tr>
{"".join(f"<tr><td>{esc(n)}</td><td>{esc(area_by_name.get(n, ''))}</td><td class='num'>{fmt(rows[n]['views'])}</td>"
         f"<td class='num'>{fmt(rows[n]['intents'])}</td><td class='num'>{fmt(rows[n]['directions'])}</td>"
         f"<td class='num'>{fmt(rows[n]['shares'])}</td><td class='num'>{fmt(rows[n]['likes'])}</td>"
         f"<td class='num'>{rows[n]['intent_rate']:.1f}%</td></tr>" for n in ranked)}
</table>

<div class="footer">{esc(event)} map &amp; report · {esc(cfg["siteUrl"] or "")} · generated from
archived snapshot data · built by Sam Gutentag</div>
"""
    OUT.mkdir(exist_ok=True)
    (OUT / "index.html").write_text(page(f"{event} — Map Engagement Report", body))
    print("wrote report/index.html")

    # ── one-pagers ───────────────────────────────────────────────────────────
    (OUT / "restaurants").mkdir(exist_ok=True)
    per_day = daily_views_by_restaurant(daily_series, names)
    view_values = sorted(r["views"] for r in rows.values())
    for r in restaurants:
        name = r["name"]
        d = rows[name]
        pct = sum(1 for v in view_values if v < d["views"]) / len(view_values) * 100
        spark = [(f"{int(day[5:7])}/{int(day[8:])}", per_day[name].get(day, 0)) for day in days]
        menu = "; ".join(m["name"] for m in r.get("menuItems", []))
        first = cfg["firstYearByName"].get(re.sub(r"\s*\([^)]*\)$", "", name))
        body = f"""
<h1>{esc(name)}</h1>
<p class="subtitle">{esc(r.get("area", ""))} · {esc(event)}{" · " + esc(menu) if menu else ""}
{f"· returning since {first}" if first else ""}</p>

<p>How visitors to the {esc(event)} map interacted with {esc(name)}
({esc(cfg["eventDates"] or "event window")}).</p>

{tiles([(fmt(d["views"]), "restaurant views"),
        (fmt(d["intents"]), "intent taps"),
        (fmt(d["directions"]), "directions requests"),
        (fmt(d["likes"]), "likes")])}
{tiles([(fmt(d["website"]), "website clicks"),
        (fmt(d["phone"]), "phone taps"),
        (fmt(d["shares"]), "shares"),
        (fmt(d["deeplinks"]), "direct links")])}

<h2>Standing</h2>
<p>{esc(name)} drew more map views than {pct:.0f}% of the {len(restaurants)} participating
restaurants{f", and {d['intent_rate']:.1f}% of its views turned into an intent tap (directions, website, or phone)" if d["views"] else ""}.</p>

{f'''<h2>Views by Day</h2>
<figure class="fig">{svg_columns(spark, width=560, height=140)}
<figcaption>Daily map views during the event, from the daily snapshot archive.</figcaption></figure>''' if any(v for _, v in spark) else ""}

<p class="note">Counts are actions, not unique visitors. Full methodology in the event-wide report.</p>
<div class="footer">{esc(event)} · {esc(cfg["siteUrl"] or "")} · generated from archived snapshot data</div>
"""
        (OUT / "restaurants" / f"{slugify(name)}.html").write_text(page(f"{name} — {event}", body))
    print(f"wrote {len(restaurants)} one-pagers to report/restaurants/")


if __name__ == "__main__":
    main()
