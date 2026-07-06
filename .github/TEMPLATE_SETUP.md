# Getting Started

You just created a food week map from the template. Here's what to do next:

1. **Edit `config.js`** — event name, dates, timezone, emoji, domain, and tag filters
2. **Set `DATASET_NAME`** in `workers/track/wrangler.toml` (and the matching
   `dataset` binding below it) — one Analytics Engine dataset per event
3. **Create `data-YYYY.js`** — `python3 scripts/registry.py pull` prefills known
   venues (coordinates, contacts, Apple/Google Maps links) from the shared
   registry in the template repo; or copy `data-template.js` and fill by hand
4. **Run `python3 scripts/start-event.py`** — validates config + data, runs
   `apply-theme.py`, and prints what's left to do manually
5. **Deploy** — Enable GitHub Pages (Settings → Pages → Deploy from main branch)
6. **Optional** — custom domain, Cloudflare analytics, click tracking, restaurant hours

See the [README](../README.md#fork-it--complete-setup-guide) for the full step-by-step guide.

## Staying in Sync with the Template

Template repos made with "Use this template" have no shared git history, so
`git merge template/main` does not work. Sync is file-based: template-owned
files (listed in `template-manifest.json`) get copied wholesale; your event
files (`config.js`, data files, `wrangler.toml`, snapshots) are never touched.

```bash
# with the template cloned as a sibling directory
python3 sync-from-template.py            # copy template-owned files
python3 sync-from-template.py --check    # just report drift
```
