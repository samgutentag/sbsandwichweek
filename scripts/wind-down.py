#!/usr/bin/env python3
"""Wind down a concluded event, in the only order that works.

The critical invariant: hourly data is archived BEFORE anything is disabled,
because snapshot-hourly.py needs a live trackUrl. Doing this by hand backwards
permanently strands the stats charts (see docs/wind-down-runbook.md).

Steps: verify trackUrl → archive hourly data → flip config to archived →
re-theme → point at the registry writeback. Worker writes and the scheduled
workflows quiesce on their own from the event dates.

Usage: python3 scripts/wind-down.py [--dry-run]
"""

import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def main():
    dry = "--dry-run" in sys.argv
    config_path = REPO / "config.js"
    config = config_path.read_text()

    def scalar(name):
        m = re.search(r'^\s*' + name + r':\s*"([^"]+)"', config, re.M)
        return m.group(1) if m else None

    if not scalar("trackUrl"):
        sys.exit("config.js has trackUrl: null — the hourly archive needs a live Worker.\n"
                 "If this event was already wound down, there is nothing to do.")
    if re.search(r'^\s*archived:\s*true', config, re.M):
        sys.exit("config.js already has archived: true — this event is wound down.")

    print("Step 1 — final tracking snapshot")
    print("  Run it now if you haven't today:  gh workflow run 'Snapshot Tracking Data'")
    print("  (or Actions tab → Snapshot Tracking Data → Run workflow)\n")

    print("Step 2 — archive hourly data (must happen while the Worker is reachable)")
    if dry:
        print("  [dry-run] would run: python3 snapshot-hourly.py .")
    else:
        subprocess.run([sys.executable, str(REPO / "snapshot-hourly.py"), str(REPO)], check=True)
        for f in ("hourly-events.json", "hourly-labels.json"):
            p = REPO / "snapshots" / f
            if not p.exists() or not json.loads(p.read_text()):
                sys.exit(f"  snapshots/{f} missing or empty — aborting before disabling anything.")
        print("  hourly archives verified.\n")

    print("Step 2.5 — bake tracking-snapshot.js from the newest daily snapshot")
    print("  (Analytics Engine keeps raw rows ~90 days; without this the stats")
    print("  Activity tab goes empty when retention expires — ask coffee week.)")
    snaps = sorted((REPO / "snapshots").glob("tracking-2*.json"))
    if not snaps:
        sys.exit("  no snapshots/tracking-*.json found — run the snapshot workflow first.")
    latest = snaps[-1]
    if dry:
        print(f"  [dry-run] would bake tracking-snapshot.js from {latest.name}\n")
    else:
        snap = json.loads(latest.read_text())
        baked = (
            f"// Final tracking snapshot from {snap.get('timestamp', 'unknown')}\n"
            f"// Generated from snapshots/{latest.name} by scripts/wind-down.py\n"
            f"var TRACKING_SNAPSHOT = {json.dumps(snap, indent=2, sort_keys=True)};\n"
        )
        (REPO / "tracking-snapshot.js").write_text(baked)
        print(f"  baked tracking-snapshot.js from {latest.name}\n")

    print("Step 3 — flip config.js to archived")
    new_config = re.sub(r'^(\s*)archived:\s*false', r'\1archived: true', config, flags=re.M)
    new_config = re.sub(r'^(\s*cfAnalyticsToken:\s*)"[^"]*"', r'\1null', new_config, flags=re.M)
    if dry:
        print("  [dry-run] would set archived: true and cfAnalyticsToken: null")
    else:
        config_path.write_text(new_config)
        print("  archived: true, cfAnalyticsToken: null (trackUrl left as-is for stats reads)\n")

    print("Step 4 — re-apply theme (removes the analytics beacon, updates worker vars)")
    if dry:
        print("  [dry-run] would run: python3 apply-theme.py")
    else:
        subprocess.run([sys.executable, str(REPO / "apply-theme.py")], check=True, cwd=REPO)

    print("""
Step 5 — feed this event's venues back into the shared registry:
  python3 scripts/registry.py writeback   (run from the template repo; see its --help)

Done. Worker writes self-disable 6 days after EVENT_END; the scheduled
workflows deactivate via the config-driven gate. Then:
  git add -A && git commit -m "chore: wind down <event>" && git push

Full audit of what 'safely dark' means: docs/wind-down-runbook.md""")


if __name__ == "__main__":
    main()
