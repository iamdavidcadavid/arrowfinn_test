#!/usr/bin/env bash
# Pushes a random fill every 2 seconds to the dev-only endpoint (Ctrl+C to stop).
# Usage: ./scripts/simulate-fills.sh [ACCOUNT_ID] [SYMBOL] [PRICE]
#   e.g. ./scripts/simulate-fills.sh ACC-1006 MES 5643.25
ACCOUNT=${1:-ACC-1006}
SYMBOL=${2:-MES}
PRICE=${3:-5643.25}
API=${API:-http://localhost:4000}
while true; do
  if (( RANDOM % 2 )); then SIDE=BUY; else SIDE=SELL; fi
  QTY=$(( RANDOM % 3 + 1 ))
  COMMISSION=$(awk "BEGIN { printf \"%.2f\", $QTY * 0.70 }")
  curl -s -X POST "$API/dev/fills" -H 'content-type: application/json' \
    -d "{\"account_id\":\"$ACCOUNT\",\"instrument_symbol\":\"$SYMBOL\",\"side\":\"$SIDE\",\"quantity\":$QTY,\"price\":$PRICE,\"commission_usd\":$COMMISSION}"
  echo
  sleep 2
done
