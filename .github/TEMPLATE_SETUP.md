# Getting Started

You just created a food week map from the template. Here's what to do next:

1. **Edit `config.js`** — Set your event name, dates, emoji, domain, and tag filters
2. **Create `data-YYYY.js`** — Copy `data-template.js` to `data-2026.js` (or your year) and add your restaurants
3. **Run `python3 apply-theme.py`** — Generates OG image, updates HTML, CNAME, README
4. **Deploy** — Enable GitHub Pages (Settings → Pages → Deploy from main branch)
5. **Optional** — Set up a custom domain, Cloudflare analytics, click tracking, restaurant hours

See the [README](../README.md#fork-it--complete-setup-guide) for the full step-by-step guide.

## Staying in Sync with the Template

To pull future improvements from the template into your event repo:

```bash
git remote add template https://github.com/samgutentag/sbfoodweek-template.git
git fetch template
git merge template/main
# Resolve config.js conflict (keep your values), done
```
