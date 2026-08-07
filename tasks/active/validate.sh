#!/bin/bash
# Schema validation wrapper — tries ajv first, falls back to Python jsonschema.
# Usage: bash tasks/active/validate.sh
# Exit: 0 = valid, 1 = invalid, 2 = no validator available

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEMA="$SCRIPT_DIR/state.schema.json"
STATE="$SCRIPT_DIR/state.json"

if [ ! -f "$STATE" ]; then
  echo "SKIP: no state.json yet"
  exit 0
fi

# Try ajv-cli first
if npx --yes ajv validate -s "$SCHEMA" -d "$STATE" 2>/dev/null; then
  echo "ajv: PASS"
  exit 0
fi

# Fall back to Python jsonschema
if command -v python3 &>/dev/null; then
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
