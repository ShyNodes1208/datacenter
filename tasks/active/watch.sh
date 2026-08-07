#!/bin/bash
# Monitor script for agent pipeline — polls state.json for frontend.status changes
# and pipeline abort signals. Only watches these two fields.
#
# Usage: bash tasks/active/watch.sh
# Output (stdout): FRONTEND:pending | FRONTEND:in-progress | FRONTEND:done | FRONTEND:failed | PIPELINE:aborted
# Stops on PIPELINE:aborted or SIGTERM.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/watch.pid"
STATE_FILE="$SCRIPT_DIR/state.json"

# Write PID file for health checks and cleanup
echo $$ > "$PID_FILE"

# Cleanup on exit (normal, signal, or abort)
cleanup() {
  rm -f "$PID_FILE"
  # SIGTERM/SIGINT must exit explicitly — trap returns to the loop otherwise
  exit 0
}
trap cleanup EXIT SIGTERM SIGINT

# Wait for state.json to exist (pipeline may not have started yet)
while [ ! -f "$STATE_FILE" ]; do
  sleep 1
done

PREV_FRONTEND=""
while true; do
  # Check pipeline-level abort first
  PIPELINE_STATUS=$(jq -r '.status // "N/A"' "$STATE_FILE" 2>/dev/null || echo "N/A")
  if [ "$PIPELINE_STATUS" = "aborted" ]; then
    echo "PIPELINE:aborted"
    break
  fi

  # Check frontend status
  CUR=$(jq -r '.phases.frontend.status // "N/A"' "$STATE_FILE" 2>/dev/null || echo "N/A")
  if [ "$CUR" != "$PREV_FRONTEND" ] && [ "$CUR" != "N/A" ]; then
    echo "FRONTEND:$CUR"
    PREV_FRONTEND="$CUR"
    # If we reached a terminal frontend state, we could exit — but we stay alive
    # so Claude can detect abort during the REVIEW/VERIFY phases that follow.
    # Claude is responsible for killing this process when no longer needed.
  fi

  sleep 1
done
