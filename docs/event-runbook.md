# Event Runbook — the canonical lifecycle timeline

Every food week runs the same shape. Dates are relative to three anchors from
`config.js`: **D** = `dataLiveDate` (map goes public), **S** = `eventStartDate`,
**E** = `eventEndDate`. The `foodweek-tickets` skill turns this table into
Linear issues with due dates — this doc is the source of truth it reads.

| When | Milestone | What happens |
|------|-----------|--------------|
| announced | **Repo setup** | Create repo from template, set config identity + `DATASET_NAME` in wrangler.toml, `registry.py pull` a draft roster, commit |
| S−21d | **Infrastructure** | Domain + DNS + GitHub Pages, repo secrets (`GOOGLE_PLACES_API_KEY`, `CF_ACCOUNT_ID`, `CF_API_TOKEN`), create AE dataset + deploy Worker, Web Analytics site + correct GraphQL `RUM_SITE_TAG` (see wrangler.toml comment) |
| D−7d | **Roster + data** | Real participant list from the source article, `registry.py pull`, `fetch-place-ids.py` / `fetch-details.py` / `fetch-hours.py` for new venues, skeleton `data.js` in place |
| D | **Map live** | `python3 scripts/start-event.py` (validates everything), publicity push, verify workflow gates report active, `wrangler tail` shows events |
| S−1d | **Menus final** | Full `menuItems` in `data-<year>.js`, re-run `start-event.py --validate-only`, spot-check map + stats |
| S+3d | **Mid-event check** | Stats sane, snapshot cron committing daily, worker writes flowing, no console errors on the live site |
| E+1d | **Wrap messaging** | Post-event modal live (automatic), watch post-event traffic, note anything broken for the template |
| E+6d | **Wind-down** | Like-grace window closed; `python3 scripts/wind-down.py` (archives hourly, bakes tracking-snapshot.js, sets `archived: true`), `registry.py writeback`, `sync-from-template.py --check` → 0, push |
| E+7d | **Report** | `python3 scripts/generate_report.py`, review, deliver to the organizer with per-restaurant one-pagers |

Details for the two scripted transitions live in the README's "Event Day
Checklist" and `docs/wind-down-runbook.md`. Fix any shared-code issues in the
template, never in the event repo, then re-sync.
