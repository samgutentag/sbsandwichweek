#!/usr/bin/env bash
# Snapshot hourly tracking data from the Cloudflare Worker for a concluded event.
# Reads event dates from config.js and saves to snapshots/ for permanent archival.
#
# Usage: ./snapshot-hourly.sh
#
# Prerequisites:
#   - config.js must have trackUrl, eventStartDate, and eventEndDate set
#   - The Worker must be deployed with start/end query param support
#   - curl and python3 must be available

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

python3 "${SCRIPT_DIR}/snapshot-hourly.py" "$SCRIPT_DIR"
