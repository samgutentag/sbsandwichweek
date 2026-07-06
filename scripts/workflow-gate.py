#!/usr/bin/env python3
"""Decide whether a scheduled workflow should run today.

The workflows keep a permanent daily cron; this gate reads the event window
from config.js so starting/stopping an event never touches the yml files.

Usage: workflow-gate.py {fetch-hours|snapshot}
Prints GitHub Actions output: active=true | active=false (with a reason on stderr).

Windows (UTC day granularity, slack built in for the event-local timezone):
  fetch-hours : (dataLiveDate or eventStartDate) - 3 days -> eventEndDate + 1 day
  snapshot    : (dataLiveDate or eventStartDate) - 1 day  -> eventEndDate + 5 days

archived: true or missing dates -> inactive.
"""

import re
import sys
from datetime import date, timedelta
from pathlib import Path

WINDOWS = {"fetch-hours": (3, 1), "snapshot": (1, 5)}


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode not in WINDOWS:
        sys.exit(f"usage: workflow-gate.py {{{'|'.join(WINDOWS)}}}")

    config = (Path(__file__).resolve().parent.parent / "config.js").read_text()

    def scalar(name):
        m = re.search(r'^\s*' + name + r':\s*"([^"]+)"', config, re.M)
        return m.group(1) if m else None

    def inactive(reason):
        print(f"gate: inactive — {reason}", file=sys.stderr)
        print("active=false")

    if re.search(r'^\s*archived:\s*true', config, re.M):
        return inactive("config.js has archived: true")

    start = scalar("dataLiveDate") or scalar("eventStartDate")
    end = scalar("eventEndDate")
    if not start or not end:
        return inactive("event dates not set in config.js")

    before, after = WINDOWS[mode]
    lo = date.fromisoformat(start) - timedelta(days=before)
    hi = date.fromisoformat(end) + timedelta(days=after)
    today = date.today()
    if lo <= today <= hi:
        print(f"gate: active — {lo} <= {today} <= {hi}", file=sys.stderr)
        print("active=true")
    else:
        inactive(f"today {today} outside window {lo}..{hi}")


if __name__ == "__main__":
    main()
