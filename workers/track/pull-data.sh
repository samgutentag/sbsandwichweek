#!/bin/bash
# Pull all tracking data from Cloudflare Analytics Engine
# Usage: CF_ACCOUNT_ID=... CF_API_TOKEN=... ./pull-data.sh [output_file]
set -euo pipefail

: "${CF_ACCOUNT_ID:?Set CF_ACCOUNT_ID in the environment}"
: "${CF_API_TOKEN:?Set CF_API_TOKEN in the environment}"
DATASET="sbsandwichweek"
OUTPUT="${1:-tracking_data.json}"

curl -s "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -d "SELECT timestamp, blob1 AS action, blob2 AS label FROM ${DATASET} ORDER BY timestamp DESC LIMIT 10000" \
  | python3 -m json.tool > "${OUTPUT}"

ROWS=$(python3 -c "import json; d=json.load(open('${OUTPUT}')); print(d.get('rows', 0))")
echo "Saved ${ROWS} events to ${OUTPUT}"
