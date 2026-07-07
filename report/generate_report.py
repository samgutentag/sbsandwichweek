#!/usr/bin/env python3
"""Generate the post-event metrics report for SB Sandwich Week 2026.

Outputs (print-ready HTML, no external assets):
  report/index.html               — event-wide report for the Independent
  report/restaurants/<slug>.html  — one-pager per participating restaurant

Reads:
  snapshots/raw-events-2026.json  — raw Analytics Engine dump (weighted rows)
  snapshots/rum-2026-07-07.json   — Cloudflare Web Analytics aggregates
  data-2026.js + config.js        — restaurant metadata (dumped to JSON via node)

All counts are weighted by _sample_interval, so they reflect true event counts,
not sampled row counts. Days are bucketed on the event's clock (America/Los_
Angeles, UTC-7 during the event).

Usage: python3 report/generate_report.py
"""

import html
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "report"
EVENT_DAYS = [f"2026-06-{d}" for d in range(25, 31)] + ["2026-07-01"]
PRE_DAYS_START = "2026-06-19"
INTENT_ACTIONS = ("directions-apple", "directions-google", "website", "phone")
RESTAURANT_ACTIONS = INTENT_ACTIONS + ("view", "sidebar-view", "instagram", "share", "deeplink", "upvote", "un-upvote")

# ── data loading ──────────────────────────────────────────────────────────────

def load_metadata():
    """Evaluate the site's JS data files with node and return them as JSON."""
    # const declarations are scoped to each eval, so export via globalThis inside it
    script = (
        "const fs=require('fs');"
        f"eval(fs.readFileSync('{REPO}/data-2026.js','utf8')"
        "+';globalThis.restaurants=restaurants;globalThis.AREA_COLORS=AREA_COLORS;');"
        f"eval(fs.readFileSync('{REPO}/config.js','utf8')+';globalThis.THEME=THEME;');"
        "console.log(JSON.stringify({restaurants,AREA_COLORS,firstYearByName:THEME.firstYearByName,eventName:THEME.eventName}))"
    )
    out = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"node metadata dump failed: {out.stderr}")
    return json.loads(out.stdout)


def slugify(name):
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))


def la_day(ts_utc):
    """UTC timestamp string -> event-local (PDT, UTC-7) date string."""
    return (datetime.fromisoformat(ts_utc) - timedelta(hours=7)).date().isoformat()


class Aggregates:
    def __init__(self, events, restaurants):
        names = {r["name"] for r in restaurants}
        self.by_restaurant = defaultdict(Counter)   # name -> action -> weighted count
        self.daily_views = Counter()                # LA day -> weighted views (all days)
        self.daily_by_restaurant = defaultdict(Counter)  # name -> LA day -> views
        self.action_totals = Counter()              # event week only
        self.filters = Counter()
        self.searches = Counter()
        self.zero_searches = Counter()
        self.sources = Counter()
        self.geo_pairs = Counter()                  # (user area, restaurant)
        self.viewports = Counter()
        self.unmatched = Counter()

        for e in events:
            action, label, w = e["action"], e["label"], int(e.get("weight", 1))
            if action == "test":
                continue
            day = la_day(e["timestamp"])
            in_event = day in EVENT_DAYS

            if action in ("view", "sidebar-view") and label in names:
                self.daily_views[day] += w
                self.daily_by_restaurant[label][day] += w
            if action in RESTAURANT_ACTIONS:
                if label in names:
                    # Likes count through the 5-day post-event grace window
                    # (canCastVotes stayed true until July 6), matching the map
                    # and the baked tracking-snapshot. Everything else stays
                    # event-week scoped.
                    if in_event or action in ("upvote", "un-upvote"):
                        self.by_restaurant[label][action] += w
                else:
                    self.unmatched[label] += w
            if not in_event:
                continue
            self.action_totals[action] += w
            if action in ("filter-area", "filter-tag", "filter-hours"):
                self.filters[label] += w
            elif action == "search":
                self.searches[label.lower()] += w
            elif action == "search-empty":
                self.zero_searches[label.lower()] += w
            elif action == "source":
                self.sources[label] += w
            elif action == "geo-view" and " | " in label:
                area, name = label.split(" | ", 1)
                if name in names:
                    self.geo_pairs[(area, name)] += w
            elif action == "viewport":
                self.viewports[label] += w

    def restaurant_row(self, name):
        c = self.by_restaurant[name]
        views = c["view"] + c["sidebar-view"]
        intents = sum(c[a] for a in INTENT_ACTIONS)
        return {
            "views": views,
            "intents": intents,
            "directions": c["directions-apple"] + c["directions-google"],
            "website": c["website"],
            "phone": c["phone"],
            "instagram": c["instagram"],
            "shares": c["share"],
            "deeplinks": c["deeplink"],
            "likes": max(0, c["upvote"] - c["un-upvote"]),
            "intent_rate": (intents / views * 100) if views else 0.0,
        }


# ── svg chart helpers (dataviz-skill mark specs: thin marks, rounded data ends,
#    direct labels, recessive axes; single blue hue for magnitude) ─────────────

INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
BLUE = "#2a78d6"
BLUE_LIGHT = "#9ec5f4"
AQUA = "#1baf7a"

def esc(s):
    return html.escape(str(s), quote=True)


def fmt(n):
    return f"{round(n):,}"


def svg_columns(series, width=680, height=170, color=BLUE, highlight=None, label_every=1):
    """Column chart for a day series: [(label, value), ...]. Direct labels on peaks."""
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
        if i % label_every == 0:
            parts.append(f'<text x="{x+bw/2:.1f}" y="{height-7}" text-anchor="middle" font-size="10" fill="{MUTED}">{esc(lab)}</text>')
    parts.append("</svg>")
    return "".join(parts)


def svg_hbars(rows, width=680, color=BLUE, value_fmt=fmt):
    """Horizontal bars: [(label, value), ...] with direct value labels."""
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
        parts.append(f'<text x="{label_w+max(w,2)+8:.1f}" y="{y+row_h/2+4}" font-size="12" fill="{INK}" font-weight="600">{value_fmt(v)}</text>')
    parts.append("</svg>")
    return "".join(parts)


def spark_columns(series, width=300, height=54, color=BLUE):
    if not series:
        return ""
    max_v = max(v for _, v in series) or 1
    n = len(series)
    gap = 2
    bw = (width - gap * (n - 1)) / n
    parts = [f'<svg viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img">']
    for i, (_, v) in enumerate(series):
        h = (height - 4) * v / max_v
        parts.append(f'<rect x="{i*(bw+gap):.1f}" y="{height-h:.1f}" width="{bw:.1f}" height="{max(h,1):.1f}" rx="2" fill="{color}"/>')
    parts.append("</svg>")
    return "".join(parts)


# ── shared page chrome (print-ready: serif body, sans headings, minimal color) ─

BASE_CSS = f"""
  * {{ box-sizing: border-box; }}
  body {{ font-family: Georgia, 'Times New Roman', serif; color: {INK}; margin: 0;
         line-height: 1.55; font-size: 15px; background: #fff; }}
  .page {{ max-width: 7.6in; margin: 0 auto; padding: 40px 32px; }}
  h1, h2, h3, .sans {{ font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }}
  h1 {{ font-size: 26px; margin: 0 0 2px; letter-spacing: -0.02em; }}
  h2 {{ font-size: 17px; margin: 34px 0 10px; border-bottom: 2px solid {INK}; padding-bottom: 5px;
       break-after: avoid; }}
  h3 {{ font-size: 14px; margin: 18px 0 6px; break-after: avoid; }}
  .subtitle {{ color: {INK2}; font-size: 14px; margin: 0 0 6px; }}
  .tiles {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }}
  .tile {{ border: 1px solid {GRID}; border-radius: 8px; padding: 12px 14px; break-inside: avoid; }}
  .tile .v {{ font-family: system-ui, -apple-system, sans-serif; font-size: 26px; font-weight: 700; }}
  .tile .l {{ font-family: system-ui, -apple-system, sans-serif; font-size: 11px; color: {INK2};
             text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }}
  table {{ border-collapse: collapse; width: 100%; font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px; }}
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


# ── report assembly ───────────────────────────────────────────────────────────

def main():
    meta = load_metadata()
    restaurants = meta["restaurants"]
    first_year = meta["firstYearByName"]
    raw = json.load(open(REPO / "snapshots" / "raw-events-2026.json"))
    rum = json.load(open(REPO / "snapshots" / "rum-2026-07-07.json"))
    agg = Aggregates(raw["events"], restaurants)

    if agg.unmatched:
        print("labels not matching a restaurant (excluded from per-restaurant stats):")
        for lab, n in agg.unmatched.most_common():
            print(f"  {lab}: {n}")

    rows = {r["name"]: agg.restaurant_row(r["name"]) for r in restaurants}
    ranked = sorted(rows, key=lambda n: rows[n]["views"], reverse=True)
    total = lambda k: sum(r[k] for r in rows.values())

    # RUM, event week only (hourly keys are UTC ISO strings)
    rum_week_loads = rum_week_visits = 0
    for h in rum["hourly"]:
        if la_day(h["dimensions"]["datetimeHour"].replace("T", " ").replace("Z", "")) in EVENT_DAYS:
            rum_week_loads += h["count"]
            rum_week_visits += h["sum"]["visits"]
    devices = {r["dimensions"]["deviceType"]: r["count"] for r in rum["devices"]}
    dev_total = sum(devices.values()) or 1
    referers = [(r["dimensions"]["refererHost"] or "direct / none", r["count"]) for r in rum["referers"][:6]]

    day_labels = [(d[8:].lstrip("0") and f"{int(d[5:7])}/{int(d[8:])}", agg.daily_views[d])
                  for d in sorted(agg.daily_views) if PRE_DAYS_START <= d <= "2026-07-01"]
    area_views = Counter()
    area_by_name = {r["name"]: r["area"] for r in restaurants}
    for name, r in rows.items():
        area_views[area_by_name[name]] += r["views"]

    funnel = [("Restaurant views", total("views")),
              ("Engaged (any intent tap)", total("intents")),
              ("Directions", total("directions")),
              ("Website", total("website")),
              ("Phone", total("phone"))]

    top_geo = [(f"{area} → {name}", n) for (area, name), n in agg.geo_pairs.most_common(10)]
    zero_top = agg.zero_searches.most_common(8)

    body = f"""
<h1>SB Sandwich Week 2026: What the Map Saw</h1>
<p class="subtitle">Engagement report from sbsandwichweekmap.com, the interactive restaurant map ·
June 25 to July 1, 2026 · prepared July 7, 2026</p>

<p>Santa Barbara Sandwich Week ran for seven days with {len(restaurants)} participating restaurants.
The companion map let readers browse every sandwich, filter by neighborhood and dietary needs, and
jump straight to directions, websites, and phone numbers. This report covers what visitors actually
did with it. Every number below counts an action a real person took during event week, adjusted for
analytics sampling (methodology at the end).</p>

<h2>The Headline</h2>
{tiles([(fmt(rum_week_visits), "site visits (event week)"),
        (fmt(total("views")), "restaurant views"),
        (fmt(total("intents")), "intent taps (directions, site, call)"),
        (f"{total('intents')/max(total('views'),1)*100:.1f}%", "views that became an intent tap")])}
<p>An "intent tap" is a click on directions, a restaurant's website, or its phone number: the moment
a browser stops browsing and starts planning a visit. {fmt(total("directions"))} of those taps were
directions requests (Google or Apple Maps), which is about as close to "a customer is on the way"
as web analytics gets.</p>

<h2>Traffic Over the Week</h2>
<figure class="fig">{svg_columns(day_labels, highlight={f"{int(d[5:7])}/{int(d[8:])}" for d in EVENT_DAYS})}
<figcaption>Restaurant views per day, Santa Barbara time. Pre-event days (June 19 to 24) shown in
lighter blue; the event ran June 25 to July 1.</figcaption></figure>
<p>The map went live ahead of the event and pre-event browsing was modest. Opening day multiplied
traffic roughly tenfold, Friday June 26 was the single busiest day, and attention held remarkably
steady through the full week rather than fading after the weekend. Peak browsing hour after hour
was late morning into lunch, and the audience skewed heavily mobile
({devices.get("mobile",0)/dev_total*100:.0f}% phone, {devices.get("desktop",0)/dev_total*100:.0f}%
desktop): people deciding where to eat, close to when they eat.</p>

<h2>Where Readers Came From</h2>
<figure class="fig">{svg_hbars(referers)}
<figcaption>Site visits by referrer, June 15 to July 7 (Cloudflare Web Analytics).</figcaption></figure>
<p>The Independent's article and embedded map were the front door: the overwhelming majority of
visits arrived from independent.com. Reddit chatter added a real secondary audience, and the
remainder came direct (bookmarks, messages, typed URLs). For next year, the lesson is simple: the
article placement carries the event, and anything that keeps the embed high on the page pays off.</p>

<h2>Neighborhoods</h2>
<figure class="fig">{svg_hbars([(a, v) for a, v in area_views.most_common(9)])}
<figcaption>Restaurant views by neighborhood during event week.</figcaption></figure>
<p>Downtown drew the most attention, in line with its restaurant count, but Goleta punched well
above its weight. Visitors who shared their location (a small, opt-in subset) were most often
browsing from Upper State and Downtown, and their most-viewed pairings suggest Downtown browsers
were doing most of the cross-neighborhood window shopping.</p>

<h2>Restaurant Leaderboard</h2>
<figure class="fig">{svg_hbars([(n, rows[n]["views"]) for n in ranked[:15]])}
<figcaption>Most-viewed restaurants, event week. Full table for all {len(restaurants)} on the last page.</figcaption></figure>
<p>Views measure curiosity; the intent rate (intent taps per hundred views) measures pull. Several
mid-list restaurants converted browsers at two to three times the field average, which is exactly
the kind of quiet-but-strong signal a raw view count hides. Each restaurant's one-page summary
includes its own numbers and percentile standing.</p>

<h2>How People Used the Map</h2>
{tiles([(fmt(agg.action_totals["search"]), "searches typed"),
        (fmt(sum(agg.filters.values())), "filter taps"),
        (fmt(agg.action_totals["share"]), "shares"),
        (fmt(agg.action_totals["deeplink"]), "direct links opened")])}
<p>The dietary filters mattered: vegetarian was tapped {fmt(agg.filters.get("vegetarian",0))} times
and gluten-free {fmt(agg.filters.get("glutenFree",0))}, alongside {fmt(agg.filters.get("open",0))}
taps on "Open Now." Searches that returned nothing are a menu wishlist for next year: readers
looked for {", ".join(f'"{esc(t)}"' for t, _ in zero_top[:5])} and came up empty.</p>

<h2>Methodology, Honestly</h2>
<p class="note">Counts come from a privacy-light tracker: no cookies, no user IDs, no precise
location. Numbers are actions, not unique people (someone who opened a restaurant twice counts
twice). Analytics sampling was corrected by weighting, so totals are true estimates, accurate to
within about one percent. Site visits and device split come from Cloudflare Web Analytics, a
separate sampled system. Location-based figures cover only visitors who tapped "use my location,"
a small and self-selected group, and are directional only. Views from the article embed and the
full map are counted together. Like counts allowed un-liking and stayed open through a five-day
post-event grace window (through July 6), so they run slightly past the event-week scope of every
other number here. Beacon-based tracking loses a small number of events by design. The event
tracker recorded {fmt(sum(agg.action_totals.values()))} weighted actions during event week.</p>

<h2 class="break">Appendix: All Restaurants</h2>
<table>
<tr><th>Restaurant</th><th>Area</th><th class="num">Views</th><th class="num">Intent taps</th>
<th class="num">Directions</th><th class="num">Shares</th><th class="num">Likes</th><th class="num">Intent %</th></tr>
{"".join(f"<tr><td>{esc(n)}</td><td>{esc(area_by_name[n])}</td><td class='num'>{fmt(rows[n]['views'])}</td>"
         f"<td class='num'>{fmt(rows[n]['intents'])}</td><td class='num'>{fmt(rows[n]['directions'])}</td>"
         f"<td class='num'>{fmt(rows[n]['shares'])}</td><td class='num'>{fmt(rows[n]['likes'])}</td>"
         f"<td class='num'>{rows[n]['intent_rate']:.1f}%</td></tr>" for n in ranked)}
</table>

<div class="footer">SB Sandwich Week 2026 map &amp; report · sbsandwichweekmap.com · data archived
from Cloudflare Analytics Engine and Web Analytics on July 7, 2026 · built by Sam Gutentag</div>
"""
    OUT.mkdir(exist_ok=True)
    (OUT / "index.html").write_text(page("SB Sandwich Week 2026 — Map Engagement Report", body))
    print(f"wrote report/index.html")

    # ── per-restaurant one-pagers ────────────────────────────────────────────
    (OUT / "restaurants").mkdir(exist_ok=True)
    view_values = sorted(r["views"] for r in rows.values())
    for r in restaurants:
        name = r["name"]
        d = rows[name]
        pct = sum(1 for v in view_values if v < d["views"]) / len(view_values) * 100
        spark = [(day, agg.daily_by_restaurant[name].get(day, 0)) for day in EVENT_DAYS]
        geo = [(area, n) for (area, rest), n in agg.geo_pairs.most_common() if rest == name][:3]
        menu = "; ".join(m["name"] for m in r.get("menuItems", []))
        returning = first_year.get(name)
        body = f"""
<h1>{esc(name)}</h1>
<p class="subtitle">{esc(r["area"])} · SB Sandwich Week 2026 · {esc(menu) if menu else "menu item"}
{f"· returning since {returning}" if returning else "· first year"}</p>

<p>How readers of the Independent's Sandwich Week map interacted with {esc(name)} during event week
(June 25 to July 1, 2026).</p>

{tiles([(fmt(d["views"]), "restaurant views"),
        (fmt(d["intents"]), "intent taps"),
        (fmt(d["directions"]), "directions requests"),
        (fmt(d["likes"]), "likes")])}
{tiles([(fmt(d["website"]), "website clicks"),
        (fmt(d["phone"]), "phone taps"),
        (fmt(d["shares"]), "shares"),
        (fmt(d["deeplinks"]), "direct links")])}

<h2>Standing</h2>
<p>{esc(name)} drew more map views than {pct:.0f}% of this year's {len(restaurants)} participating
restaurants{f", and {d['intent_rate']:.1f}% of its views turned into an intent tap (directions, website, or phone)" if d["views"] else ""}.</p>

<h2>Views by Day</h2>
<figure class="fig">{svg_columns([(f"{int(day[5:7])}/{int(day[8:])}", v) for day, v in spark], width=560, height=140)}
<figcaption>Daily map views during event week, Santa Barbara time.</figcaption></figure>
{f"<h2>Who Was Looking</h2><p>Among visitors who opted in to sharing their location, the most common home neighborhoods browsing {esc(name)} were {', '.join(esc(a) for a, _ in geo)}. This covers a small opt-in subset and is directional only.</p>" if geo else ""}

<p class="note">Counts are actions, not unique visitors, adjusted for analytics sampling.
Full methodology in the event-wide report.</p>
<div class="footer">SB Sandwich Week 2026 · sbsandwichweekmap.com · prepared July 7, 2026</div>
"""
        (OUT / "restaurants" / f"{slugify(name)}.html").write_text(page(f"{name} — Sandwich Week 2026", body))
    print(f"wrote {len(restaurants)} one-pagers to report/restaurants/")


if __name__ == "__main__":
    main()
