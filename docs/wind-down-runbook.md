# Wind-Down Runbook

Reusable post-event shutdown reference. `scripts/wind-down.py` automates the
ordered steps; this doc explains what "safely dark" means and how to verify it.
(Adapted from the SB Coffee Week 2026 wind-down audit.)

## Order matters

Archive **before** disabling: `snapshot-hourly.py` and the final tracking
snapshot need a live `trackUrl`. Nulling the config first permanently strands
the stats charts with no data source.

1. Run the final snapshot workflow (`gh workflow run "Snapshot Tracking Data"`)
2. `./snapshot-hourly.sh` — commit `snapshots/hourly-events.json` + `hourly-labels.json`
3. Set `cfAnalyticsToken: null` and `archived: true` in `config.js`
4. `python3 apply-theme.py`
5. Deploy the Worker if vars changed (`cd workers/track && wrangler deploy`) —
   POST writes self-disable after `EVENT_END` + grace, so this is usually a no-op
6. Commit and push

`trackUrl` may stay set after wind-down: it only names the Worker so the
stats/admin pages can keep reading historical aggregates. Event state comes
from `archived`, not from `trackUrl`.

## API call audit — what "safely dark" means

Every outbound call is gated. After wind-down, confirm each guard:

| Component | File | Guard |
|---|---|---|
| Tracking beacon | `track.js` | `THEME.trackUrl` null → `window.track` never defined; LAN hosts always skipped |
| Upvote fetch (map + embed) | `app.js`, `embed/map/embed.js` | `if (THEME.trackUrl)` |
| Live activity / eyes polls | `app.js`, `stats/stats.js` | `if (!THEME.trackUrl) return` + event-state gating |
| Hourly chart fetches | `stats/stats.js`, `stats/trends/trends-tab.js` | concluded events read `snapshots/hourly-*.json` instead of the Worker |
| Detail/RUM/admin fetches | `stats/stats.js`, `admin/admin.js` | `if (!THEME.trackUrl) return` |
| CF Web Analytics beacon | all `*.html` | removed by `apply-theme.py` when `cfAnalyticsToken` is null |
| Worker POST writes | `workers/track/index.js` | refuses writes after `EVENT_END` + grace window |

## Verify

Serve locally, open the site with DevTools' network panel: zero requests to the
Worker or Cloudflare beacons from the main map; stats pages read only committed
snapshot files. Then check the live domain the same way after pushing.
