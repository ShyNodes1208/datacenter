#!/bin/bash
# Monitor script for agent pipeline — polls state.json for the frontend phase status
# and pipeline abort signals.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/watch.pid"
STATE_FILE="$SCRIPT_DIR/state.json"
CONFIG_FILE="${PIPELINE_CONFIG:-$SCRIPT_DIR/pipeline-config.json}"

# JSON key in state.phases (always "frontend"); label from config for event output
MONITORED_PHASE_KEY="frontend"
MONITORED_PHASE_LABEL=$(jq -r '.phases.frontend // "FRONTEND"' "$CONFIG_FILE" 2>/dev/null || echo "FRONTEND")

echo $$ > "$PID_FILE"
cleanup() {
  rm -f "$PID_FILE"
  exit 0
}
trap cleanup EXIT SIGTERM SIGINT

while [ ! -f "$STATE_FILE" ]; do sleep 1; done

PREV=""
while true; do
  PIPELINE_STATUS=$(jq -r '.status // "N/A"' "$STATE_FILE" 2>/dev/null || echo "N/A")
  if [ "$PIPELINE_STATUS" = "aborted" ]; then
    echo "PIPELINE:aborted"
    break
  fi
  CUR=$(jq -r ".phases.${MONITORED_PHASE_KEY}.status // \"N/A\"" "$STATE_FILE" 2>/dev/null || echo "N/A")
  if [ "$CUR" != "$PREV" ] && [ "$CUR" != "N/A" ]; then
    echo "${MONITORED_PHASE_LABEL}:$CUR"
    PREV="$CUR"
  fi
  sleep 1
done
