#!/usr/bin/env python3
"""Sync template-owned files from sbfoodweek-template into this event repo.

Event repos have no shared git history with the template ("Use this template"
squashes it), so sync is file-based: paths listed in the TEMPLATE's
template-manifest.json are copied wholesale, obsolete files it names are
removed, and everything else (config.js, data files, wrangler.toml, snapshots)
is never touched. Afterwards apply-theme.py re-brands the copied shells from
this repo's config.js.

Usage:
  python3 sync-from-template.py             # sync + re-theme
  python3 sync-from-template.py --check     # report drift only, exit 1 if any
  python3 sync-from-template.py --template ../path/to/sbfoodweek-template
"""

import argparse
import filecmp
import shutil
import subprocess
import sys
import json
from pathlib import Path

REPO = Path(__file__).resolve().parent


def find_template(override):
    if override:
        p = Path(override).resolve()
    else:
        p = REPO.parent / "sbfoodweek-template"
    if not (p / "template-manifest.json").exists():
        sys.exit(f"template not found at {p} — clone sbfoodweek-template as a sibling or pass --template")
    return p


def manifest_files(template, manifest):
    """Expand the manifest into (checked_rels, themed_rels), from the template side."""
    themed = {Path(t) for t in manifest.get("themed", [])}
    rels = []
    for f in manifest["files"] + manifest.get("themed", []):
        if (template / f).exists():
            rels.append(Path(f))
        else:
            print(f"  WARN manifest lists {f} but the template doesn't have it")
    for d in manifest["dirs"]:
        for p in sorted((template / d).rglob("*")):
            if p.is_file():
                rels.append(p.relative_to(template))
    checked = [r for r in dict.fromkeys(rels) if r not in themed]
    return checked, sorted(themed)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="report drift, change nothing")
    ap.add_argument("--template", help="path to the template checkout")
    args = ap.parse_args()

    template = find_template(args.template)
    if template == REPO:
        sys.exit("this IS the template repo — run sync from an event repo")

    manifest = json.loads((template / "template-manifest.json").read_text())
    checked, themed = manifest_files(template, manifest)

    drifted, missing = [], []
    for rel in checked:
        dst = REPO / rel
        if not dst.exists():
            missing.append(rel)
        elif not filecmp.cmp(template / rel, dst, shallow=False):
            drifted.append(rel)
    missing_themed = [rel for rel in themed if not (REPO / rel).exists()]
    stale = [Path(d) for d in manifest.get("delete", []) if (REPO / d).exists()]

    if args.check:
        for rel in drifted:
            print(f"  DRIFT   {rel}")
        for rel in missing + missing_themed:
            print(f"  MISSING {rel}")
        for rel in stale:
            print(f"  STALE   {rel} (template deleted this)")
        total = len(drifted) + len(missing) + len(missing_themed) + len(stale)
        print(f"{total} path(s) out of sync ({len(checked)} checked; "
              f"{len(themed)} themed shells skipped — re-branded on every sync)")
        sys.exit(1 if total else 0)

    # themed shells are always refreshed: their event branding is re-applied below
    for rel in drifted + missing + themed:
        dst = REPO / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(template / rel, dst)
        print(f"  synced  {rel}")
    for rel in stale:
        (REPO / rel).unlink()
        print(f"  removed {rel}")

    print("\nRe-branding synced shells from this repo's config.js...")
    subprocess.run([sys.executable, str(REPO / "apply-theme.py")], check=True, cwd=REPO)
    print("\nSync complete. Review with git diff, then commit.")


if __name__ == "__main__":
    main()
