---
name: verify
description: Verify this food-week map site locally — serve, drive in a browser, check event state, likes, and stats tabs.
---

# Verify — food-week map site

Static site, no build step.

## Serve

```bash
python3 -m http.server 8742 --bind 127.0.0.1
```

## Drive (chrome-devtools MCP)

1. Open `http://127.0.0.1:8742/index.html`
2. Event lifecycle sanity — run in the page console:
   ```js
   ({ state: getEventState(), canVote: canCastVotes(), year: THEME.eventYear, archived: THEME.archived || false })
   ```
   Expected state depends on today's date vs `eventStartDate`/`eventEndDate` in
   `config.js` (grace window = end date + 5 days; `archived: true` forces off-season).
3. Map: markers render, restaurant list populated, like counts visible.
4. Stats: `http://127.0.0.1:8742/stats/` then `location.hash = '#trends'` etc. —
   each tab should render charts (canvas count > 0). Wait ~2-3s for async fetches.

## Expected noise (not failures)

- `tracking-snapshot.js` 404 until wind-down bakes it (`scripts/wind-down.py`);
  pages fall back to live Worker fetches while `trackUrl` is set.
- `tips.json` 404 — optional file.
- Cloudflare RUM beacon CORS errors on localhost — the beacon only allows the
  production origin. Gone after wind-down nulls `cfAnalyticsToken`.
- After wind-down: DevTools network panel must show ZERO requests to the Worker
  or Cloudflare beacons from the main map (see docs/wind-down-runbook.md).

## Gotcha

If chrome-devtools MCP says "browser is already running", kill the stale
instance: `pkill -f 'chrome-devtools-mcp/chrome-profile'`
