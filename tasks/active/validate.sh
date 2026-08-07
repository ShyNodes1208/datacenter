#!/bin/bash
# Schema validation wrapper — tries config primary, then ajv, then Python jsonschema.
# Usage: bash validate.sh
# Exit: 0 = valid, 1 = invalid, 2 = no validator available

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEMA="$SCRIPT_DIR/state.schema.json"
STATE="$SCRIPT_DIR/state.json"
CONFIG_FILE="${PIPELINE_CONFIG:-$SCRIPT_DIR/pipeline-config.json}"

if [ ! -f "$STATE" ]; then
  echo "SKIP: no state.json yet"
  exit 0
fi

PRIMARY_VALIDATOR=$(jq -r '.validation.primary // empty' "$CONFIG_FILE" 2>/dev/null || echo "")
FALLBACK_VALIDATOR=$(jq -r '.validation.fallback // empty' "$CONFIG_FILE" 2>/dev/null || echo "")

run_validator() {
  local cmd="$1"
  [ -z "$cmd" ] && return 1
  eval "$cmd"
}

if [ -n "$PRIMARY_VALIDATOR" ]; then
  if run_validator "$PRIMARY_VALIDATOR"; then
    echo "primary: PASS"
    exit 0
  fi
fi

if npx --yes ajv validate -s "$SCHEMA" -d "$STATE" 2>/dev/null; then
  echo "ajv: PASS"
  exit 0
fi

if [ -n "$FALLBACK_VALIDATOR" ]; then
  if run_validator "$FALLBACK_VALIDATOR"; then
    echo "fallback: PASS"
    exit 0
  fi
fi

if command -v python3 &>/dev/null; then
  if ! python3 -c "import jsonschema" 2>/dev/null; then
    echo "SKIP: python3 available but jsonschema not installed (pip install jsonschema)"
    echo "ERROR: no validator available (install ajv-cli or pip install jsonschema)"
    exit 2
  fi
  if python3 -c "
import json, jsonschema
with open('$SCHEMA') as sf: schema = json.load(sf)
with open('$STATE') as df: data = json.load(df)
jsonschema.validate(data, schema)
print('jsonschema: PASS')
" 2>/dev/null; then
    exit 0
  else
    echo "jsonschema: FAIL"
    exit 1
  fi
fi

echo "ERROR: no validator available (install ajv-cli or pip install jsonschema)"
exit 2
