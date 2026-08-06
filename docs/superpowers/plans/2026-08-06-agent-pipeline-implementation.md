# Agent Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tooling artifacts (JSON Schema, Monitor script, task templates, module locks) that enable Claude to orchestrate a state-file-driven multi-agent pipeline across Codex and Cursor.

**Architecture:** Stateless tooling layered on the filesystem. `state.schema.json` enforces data integrity at key gates via ajv. `watch.sh` polls `state.json` for Cursor-driven frontend.status changes and pipeline abort signals. Task templates define the contract between Claude and Codex/Cursor — every agent reads the same state file and writes to the same fields. No server, no database, no network dependency.

**Tech Stack:** Bash (Monitor), JSON Schema draft-2020-12 (validation), Markdown (templates), jq + ajv-cli (validation tooling)

## Global Constraints

- All pipeline artifacts live under `tasks/active/` during execution, archived to `tasks/completed/` on DONE
- `state.json` is the single source of truth — every agent reads/writes it
- JSON Schema validation at every phase boundary (jq fast gate + ajv full schema)
- Monitor ONLY watches `phases.frontend.status` and top-level `status` for abort — never touches other fields
- Task templates must instruct agents to write ALL fields atomically (single `Write` call) to prevent Monitor false triggers
- PID file (`watch.pid`) prevents zombie Monitor processes; always check liveliness before relying on it
- Module locks follow existing `MODULE-LOCKS.md` format in `tasks/`

---

## File Structure

```
tasks/active/                    # NEW: pipeline runtime directory
  state.schema.json              # NEW: JSON Schema for state.json validation
  watch.sh                       # NEW: Monitor polling script
  watch.pid                       # Runtime: created by watch.sh at startup
  state.json                      # Runtime: created by Claude at pipeline start
  review-output.json              # Runtime: created by Codex during REVIEW

tasks/
  TASK-TEMPLATE-CODEX-DEV.md     # NEW: Codex backend/frontend dev task template
  TASK-TEMPLATE-CODEX-REVIEW.md  # NEW: Codex review task template
  TASK-TEMPLATE-CODEX-FIX.md     # NEW: Codex fix-after-rejection task template
  TASK-TEMPLATE-CURSOR.md        # NEW: Cursor prompt template (manual trigger)
  MODULE-LOCKS.md                # EXISTS: verify format compatible with pipeline

tasks/completed/                 # NEW: archive directory for completed state.json

.claude/agents/
  pipeline-runner.md             # NEW: Claude agent definition for pipeline orchestration
```

### Responsibility Map

| File | Responsibility | Depends On |
|------|---------------|------------|
| `state.schema.json` | Validate state.json structure at phase gates | Nothing |
| `watch.sh` | Emit FRONTEND:* and PIPELINE:aborted events to stdout | `state.json` (reads) |
| `TASK-TEMPLATE-CODEX-DEV.md` | Template Claude fills in to generate Codex dev task | `state.schema.json` (field names) |
| `TASK-TEMPLATE-CODEX-REVIEW.md` | Template for Codex review task | Dev template (field names) |
| `TASK-TEMPLATE-CODEX-FIX.md` | Template for Codex fix-after-rejection task | Review template (issues format) |
| `TASK-TEMPLATE-CURSOR.md` | Prompt user pastes into Cursor | Dev template (field names) |
| `MODULE-LOCKS.md` | Existing file; verify pipeline compatibility | Nothing |
| `pipeline-runner.md` | Claude's operational runbook (condensed from design doc) | All of the above |

---

### Task 1: Create Directory Scaffolding and state.schema.json

**Files:**
- Create: `tasks/active/state.schema.json`
- Create: `tasks/completed/.gitkeep`

**Interfaces:**
- Produces: JSON Schema validating all 7 phases + errors + history + top-level fields

The schema must validate every field shown in the design doc's state.json Schema section. It uses JSON Schema draft-2020-12 (compatible with ajv).

- [ ] **Step 1: Create directories**

```bash
mkdir -p tasks/active tasks/completed
touch tasks/completed/.gitkeep
```

- [ ] **Step 2: Write state.schema.json**

Create `tasks/active/state.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://datacenter-layout/tasks/active/state.schema.json",
  "title": "Agent Pipeline State",
  "description": "Validates state.json for the multi-agent automated development pipeline.",
  "type": "object",
  "required": ["version", "pipeline", "type", "status", "phase", "created", "updated", "task", "phases", "errors", "history"],
  "properties": {
    "version": { "type": "string", "const": "1.0" },
    "pipeline": {
      "type": "string",
      "pattern": "^TASK-\\d{4}$",
      "description": "Pipeline ID, e.g. TASK-0022"
    },
    "type": {
      "type": "string",
      "enum": ["fullstack", "backend-only", "frontend-only"]
    },
    "status": {
      "type": "string",
      "enum": ["running", "paused", "aborted"]
    },
    "phase": {
      "type": "string",
      "enum": ["PLANNING", "BACKEND", "FRONTEND", "REVIEW", "VERIFY", "DONE", "PAUSED"]
    },
    "created": { "type": "string", "format": "date-time" },
    "updated": { "type": "string", "format": "date-time" },
    "task": {
      "type": "object",
      "required": ["id", "title", "requirement"],
      "properties": {
        "id": { "type": "string", "pattern": "^TASK-\\d{4}$" },
        "title": { "type": "string", "minLength": 1 },
        "plan": { "type": "string" },
        "spec": { "type": "string" },
        "requirement": { "type": "string", "minLength": 1 }
      }
    },
    "phases": {
      "type": "object",
      "required": ["planning", "backend", "frontend", "review", "verify"],
      "properties": {
        "planning": {
          "type": "object",
          "required": ["status", "owner"],
          "properties": {
            "status": { "type": "string", "enum": ["pending", "in-progress", "done", "failed"] },
            "owner": { "type": "string", "const": "claude" },
            "started": { "type": "string", "format": "date-time" },
            "completed": { "type": "string", "format": "date-time" },
            "taskFile": { "type": "string" },
            "planFile": { "type": "string" },
            "specFile": { "type": "string" },
            "modules": {
              "type": "object",
              "properties": {
                "backend": { "type": "array", "items": { "type": "string" } },
                "frontend": { "type": "array", "items": { "type": "string" } }
              }
            },
            "branch": { "type": "string" },
            "commit": { "type": "string" },
            "summary": { "type": "string" },
            "handoffNote": { "type": "string" }
          }
        },
        "backend": {
          "type": "object",
          "required": ["status", "owner", "retryCount", "_invoked"],
          "properties": {
            "status": { "type": "string", "enum": ["pending", "in-progress", "done", "failed"] },
            "owner": { "type": "string", "const": "codex" },
            "retryCount": { "type": "integer", "minimum": 0, "maximum": 3 },
            "timeout": { "type": "string" },
            "_invoked": { "type": "boolean" },
            "started": { "type": "string", "format": "date-time" },
            "completed": { "type": "string", "format": "date-time" },
            "commit": { "type": "string" },
            "commitMsg": { "type": "string" },
            "filesChanged": { "type": "array", "items": { "type": "string" } },
            "testResults": {
              "type": "object",
              "properties": {
                "total": { "type": "integer", "minimum": 0 },
                "passed": { "type": "integer", "minimum": 0 },
                "failed": { "type": "integer", "minimum": 0 }
              }
            },
            "cliCommand": { "type": "string" },
            "handoffNote": { "type": "string" }
          }
        },
        "frontend": {
          "type": "object",
          "required": ["status", "owner"],
          "properties": {
            "status": { "type": "string", "enum": ["pending", "in-progress", "done", "failed", "skipped"] },
            "owner": { "type": "string", "const": "cursor" },
            "started": { "type": "string", "format": "date-time" },
            "completed": { "type": "string", "format": "date-time" },
            "commit": { "type": "string" },
            "commitMsg": { "type": "string" },
            "filesChanged": { "type": "array", "items": { "type": "string" } },
            "testResults": {
              "type": "object",
              "properties": {
                "total": { "type": "integer", "minimum": 0 },
                "passed": { "type": "integer", "minimum": 0 },
                "failed": { "type": "integer", "minimum": 0 },
                "failures": { "type": "array", "items": { "type": "string" } }
              }
            },
            "handoffNote": { "type": "string" }
          }
        },
        "review": {
          "type": "object",
          "required": ["status", "owner", "retryCount", "_invoked"],
          "properties": {
            "status": { "type": "string", "enum": ["pending", "in-progress", "done", "failed", "rejected"] },
            "owner": { "type": "string", "const": "codex" },
            "retryCount": { "type": "integer", "minimum": 0, "maximum": 3 },
            "timeout": { "type": "string" },
            "_invoked": { "type": "boolean" },
            "started": { "type": "string", "format": "date-time" },
            "completed": { "type": "string", "format": "date-time" },
            "scope": {
              "type": "object",
              "properties": {
                "backendCommit": { "type": "string" },
                "frontendCommit": { "type": ["string", "null"] }
              }
            },
            "verdict": { "type": "string", "enum": ["approved", "approved_with_issues", "rejected"] },
            "issues": {
              "type": "array",
              "items": {
                "type": "object",
                "required": ["id", "severity", "affectedPhase", "summary"],
                "properties": {
                  "id": { "type": "string", "pattern": "^RV-\\d{3}$" },
                  "severity": { "type": "string", "enum": ["blocking", "major", "minor", "info"] },
                  "affectedPhase": { "type": "string", "enum": ["backend", "frontend"] },
                  "file": { "type": "string" },
                  "line": { "type": "integer" },
                  "summary": { "type": "string" },
                  "recommendation": { "type": "string" }
                }
              }
            },
            "cliCommand": { "type": "string" },
            "handoffNote": { "type": "string" }
          }
        },
        "verify": {
          "type": "object",
          "required": ["status", "owner"],
          "properties": {
            "status": { "type": "string", "enum": ["pending", "in-progress", "done", "failed"] },
            "owner": { "type": "string", "const": "claude" },
            "started": { "type": "string", "format": "date-time" },
            "completed": { "type": "string", "format": "date-time" },
            "checks": {
              "type": "object",
              "properties": {
                "backendBuild": { "$ref": "#/$defs/checkResult" },
                "backendTest": { "$ref": "#/$defs/checkResult" },
                "frontendBuild": { "$ref": "#/$defs/checkResult" },
                "frontendTest": { "$ref": "#/$defs/checkResult" },
                "typeCheck": { "$ref": "#/$defs/checkResult" },
                "diffCheck": { "$ref": "#/$defs/checkResult" },
                "gitStatus": { "$ref": "#/$defs/checkResult" }
              }
            },
            "verdict": { "type": "string", "enum": ["ready", "failed"] },
            "handoffNote": { "type": "string" }
          }
        }
      }
    },
    "errors": {
      "type": "array",
      "items": { "$ref": "#/$defs/errorItem" }
    },
    "history": {
      "type": "array",
      "items": { "$ref": "#/$defs/historyItem" }
    }
  },
  "$defs": {
    "checkResult": {
      "type": "object",
      "properties": {
        "passed": { "type": "boolean" },
        "skipped": { "type": "boolean" },
        "command": { "type": "string" },
        "exitCode": { "type": "integer" },
        "total": { "type": "integer" },
        "failed": { "type": "integer" },
        "expectedFiles": { "type": "array", "items": { "type": "string" } },
        "actualFiles": { "type": "array", "items": { "type": "string" } },
        "extra": { "type": "array", "items": { "type": "string" } },
        "missing": { "type": "array", "items": { "type": "string" } },
        "clean": { "type": "boolean" }
      }
    },
    "errorItem": {
      "type": "object",
      "required": ["id", "phase", "time", "type", "detail"],
      "properties": {
        "id": { "type": "string", "pattern": "^ERR-\\d{3}$" },
        "phase": { "type": "string", "enum": ["planning", "backend", "frontend", "review", "verify"] },
        "time": { "type": "string", "format": "date-time" },
        "type": {
          "type": "string",
          "enum": ["build_failed", "test_failed", "review_rejected", "timeout", "codex_error", "verify_failed"]
        },
        "detail": { "type": "string" },
        "action": { "type": "string" },
        "resolved": { "type": "boolean" },
        "resolvedAt": { "type": "string", "format": "date-time" }
      }
    },
    "historyItem": {
      "type": "object",
      "required": ["time", "phase", "from", "to", "by"],
      "properties": {
        "time": { "type": "string", "format": "date-time" },
        "phase": { "type": "string" },
        "from": { "type": "string" },
        "to": { "type": "string" },
        "by": { "type": "string" }
      }
    }
  }
}
```

- [ ] **Step 3: Validate the schema is well-formed JSON**

```bash
jq '.' tasks/active/state.schema.json > /dev/null && echo "Valid JSON"
```

- [ ] **Step 4: Validate a minimal state.json against the schema**

Create a minimal valid state.json for testing:
```bash
cat > /tmp/test-state.json << 'STATEEOF'
{
  "version": "1.0",
  "pipeline": "TASK-0099",
  "type": "fullstack",
  "status": "running",
  "phase": "PLANNING",
  "created": "2026-08-06T00:00:00Z",
  "updated": "2026-08-06T00:00:00Z",
  "task": {
    "id": "TASK-0099",
    "title": "Test Pipeline",
    "requirement": "Verify schema validation works"
  },
  "phases": {
    "planning": { "status": "in-progress", "owner": "claude" },
    "backend": { "status": "pending", "owner": "codex", "retryCount": 0, "_invoked": false },
    "frontend": { "status": "pending", "owner": "cursor" },
    "review": { "status": "pending", "owner": "codex", "retryCount": 0, "_invoked": false },
    "verify": { "status": "pending", "owner": "claude" }
  },
  "errors": [],
  "history": []
}
STATEEOF
```

- [ ] **Step 5: Test validation with ajv (if available) or jq structural check**

```bash
# jq fast gate
jq -e '.phase and .status and .phases.backend.retryCount != null' /tmp/test-state.json && echo "jq gate: PASS"

# If ajv-cli is available:
npx ajv validate -s tasks/active/state.schema.json -d /tmp/test-state.json 2>&1 && echo "ajv: PASS" || echo "ajv not available, skipping (install with: npm install -g ajv-cli)"
```

- [ ] **Step 6: Test rejection of invalid state.json**

```bash
# Missing required field 'phase'
cat > /tmp/test-invalid.json << 'EOF'
{ "version": "1.0", "status": "running" }
EOF
npx ajv validate -s tasks/active/state.schema.json -d /tmp/test-invalid.json 2>&1 && echo "ajv should have rejected! FAIL" || echo "ajv correctly rejected: PASS"
```

- [ ] **Step 7: Commit**

```bash
git add tasks/active/state.schema.json tasks/completed/.gitkeep
git commit -m "feat: add state.json JSON Schema for pipeline validation"
```

---

### Task 2: Create Monitor Script (watch.sh)

**Files:**
- Create: `tasks/active/watch.sh`

**Interfaces:**
- Consumes: `state.json` (reads `.status` and `.phases.frontend.status` via jq)
- Produces: stdout lines `FRONTEND:<status>` and `PIPELINE:aborted`
- Side effect: writes own PID to `watch.pid`, cleans up on SIGTERM/SIGINT/EXIT

- [ ] **Step 1: Write watch.sh**

Create `tasks/active/watch.sh`:

```bash
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
```

- [ ] **Step 2: Make watch.sh executable**

```bash
chmod +x tasks/active/watch.sh
```

- [ ] **Step 3: Test — Monitor waits for state.json**

```bash
# Start monitor in background with a temp state.json location
# It should wait (no output) until state.json appears
timeout 3 bash tasks/active/watch.sh 2>&1 &
WATCH_PID=$!
sleep 1
# Verify PID file exists
test -f tasks/active/watch.pid && echo "PID file: PASS" || echo "PID file: FAIL"
# Verify process is alive
kill -0 $WATCH_PID 2>/dev/null && echo "Monitor alive: PASS" || echo "Monitor alive: FAIL"
# Cleanup
kill $WATCH_PID 2>/dev/null || true
wait $WATCH_PID 2>/dev/null || true
```

- [ ] **Step 4: Test — Monitor detects frontend status changes**

```bash
# Create a test state.json
cat > /tmp/test-pipeline-state.json << 'EOF'
{
  "version": "1.0", "pipeline": "TASK-0099", "type": "fullstack",
  "status": "running", "phase": "FRONTEND",
  "created": "2026-08-06T00:00:00Z", "updated": "2026-08-06T00:00:00Z",
  "task": { "id": "TASK-0099", "title": "Test", "requirement": "Test" },
  "phases": {
    "planning": { "status": "done", "owner": "claude" },
    "backend": { "status": "done", "owner": "codex", "retryCount": 0, "_invoked": false },
    "frontend": { "status": "pending", "owner": "cursor" },
    "review": { "status": "pending", "owner": "codex", "retryCount": 0, "_invoked": false },
    "verify": { "status": "pending", "owner": "claude" }
  },
  "errors": [], "history": []
}
EOF

# Point watch.sh at the test file (override via env)
STATE_FILE=/tmp/test-pipeline-state.json PID_FILE=/tmp/test-watch.pid \
  bash -c '
    SCRIPT_DIR="/tmp"
    PID_FILE="/tmp/test-watch.pid"
    STATE_FILE="/tmp/test-pipeline-state.json"
    echo $$ > "$PID_FILE"
    trap "rm -f $PID_FILE" EXIT
    PREV_FRONTEND=""
    # Simulate: read once, then change state.json, read again
    for i in 1 2; do
      CUR=$(jq -r ".phases.frontend.status" "$STATE_FILE" 2>/dev/null)
      if [ "$CUR" != "$PREV_FRONTEND" ] && [ "$CUR" != "" ]; then
        echo "FRONTEND:$CUR"
        PREV_FRONTEND="$CUR"
      fi
      if [ $i -eq 1 ]; then
        # Change frontend status to done
        jq ".phases.frontend.status = \"done\"" "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
      fi
    done
  ' 2>&1
# Expected output: FRONTEND:pending then FRONTEND:done
```

- [ ] **Step 5: Test — Monitor detects pipeline abort**

```bash
# Set status to aborted
jq '.status = "aborted"' /tmp/test-pipeline-state.json > /tmp/test-abort-state.json

STATE_FILE=/tmp/test-abort-state.json PID_FILE=/tmp/test-watch-abort.pid \
  bash -c '
    PID_FILE="/tmp/test-watch-abort.pid"
    STATE_FILE="/tmp/test-abort-state.json"
    echo $$ > "$PID_FILE"
    trap "rm -f $PID_FILE" EXIT
    PIPELINE_STATUS=$(jq -r ".status" "$STATE_FILE" 2>/dev/null)
    if [ "$PIPELINE_STATUS" = "aborted" ]; then
      echo "PIPELINE:aborted"
    fi
  ' 2>&1
# Expected: PIPELINE:aborted
```

- [ ] **Step 6: Verify trap cleans up PID file**

```bash
# Start monitor briefly, kill it, verify PID file is gone
bash tasks/active/watch.sh &
WATCH_PID=$!
sleep 1
test -f tasks/active/watch.pid && echo "PID exists: PASS" || echo "PID exists: FAIL"
kill $WATCH_PID
wait $WATCH_PID 2>/dev/null || true
sleep 0.5
test ! -f tasks/active/watch.pid && echo "PID cleaned: PASS" || echo "PID cleaned: FAIL"
```

- [ ] **Step 7: Commit**

```bash
git add tasks/active/watch.sh
git commit -m "feat: add Monitor script (watch.sh) for frontend status + abort detection"
```

---

### Task 3: Create Codex Task Templates

**Files:**
- Create: `tasks/TASK-TEMPLATE-CODEX-DEV.md`
- Create: `tasks/TASK-TEMPLATE-CODEX-REVIEW.md`
- Create: `tasks/TASK-TEMPLATE-CODEX-FIX.md`

**Interfaces:**
- Consumes: `state.json` field names from schema; existing `TASK-TEMPLATE.md` format for consistency
- Produces: Three markdown templates Claude fills in via string substitution before passing to Codex CLI

Templates use `<placeholder>` syntax for fields Claude fills in. They instruct Codex to read `state.json` for context and write ALL fields atomically.

- [ ] **Step 1: Write TASK-TEMPLATE-CODEX-DEV.md**

Create `tasks/TASK-TEMPLATE-CODEX-DEV.md`:

```markdown
# Codex Dev Task

> Pipeline: `<pipeline>` | Phase: `<phase>` | Attempt: `<retryCount>`

## Required Reading

Before starting, read these files for full context:
1. `tasks/active/state.json` — pipeline state, handoff notes, module locks
2. `<specFile>` — design specification
3. `<planFile>` — implementation plan

## Task

<taskDescription>

## Constraints

- **Allowed files:** `<allowedFiles>`
- **Forbidden files:** `<forbiddenFiles>`
- **Module lock:** `<moduleLock>`

<retryContext>

## Completion Checklist

When done, you MUST update `tasks/active/state.json` atomically (all fields in one write):

```json
{
  "phases": {
    "<phase>": {
      "status": "done",
      "_invoked": false,
      "completed": "<ISO8601 now>",
      "commit": "<run: git rev-parse HEAD>",
      "commitMsg": "<your commit message>",
      "filesChanged": <run: git diff --name-only HEAD~1 | jq -R -s 'split("\n") | map(select(length>0))'>,
      "testResults": {
        "total": <N>,
        "passed": <N>,
        "failed": <N>
      },
      "handoffNote": "<what the next phase needs to know>"
    }
  }
}
```

**Important:**
- All git changes must be committed BEFORE updating state.json
- One commit per phase — squash if needed
- `handoffNote` must include: API signatures, config changes, known caveats
- If tests fail, document each failure in `testResults.failures[]`
```

- [ ] **Step 2: Write TASK-TEMPLATE-CODEX-REVIEW.md**

Create `tasks/TASK-TEMPLATE-CODEX-REVIEW.md`:

```markdown
# Codex Review Task

> Pipeline: `<pipeline>` | Review Attempt: `<retryCount>`

## Required Reading

1. `tasks/active/state.json` — full pipeline state
2. Backend diff: `git diff <base>..<backendCommit>`
3. Frontend diff: `git diff <base>..<frontendCommit>` (skip if backend-only)

## Review Scope

| Dimension | Commit | Files |
|-----------|--------|-------|
| Backend | `<backendCommit>` | `<backendFiles>` |
| Frontend | `<frontendCommit>` | `<frontendFiles>` |

## Handoff Notes (for context)

**Backend handoff:** `<backendHandoffNote>`
**Frontend handoff:** `<frontendHandoffNote>`

## Review Checklist

For each changed file, check:
1. **Correctness** — Does it implement the spec correctly?
2. **Security** — SQL injection, auth bypass, XSS, exposed secrets?
3. **Performance** — N+1 queries, missing indexes, unnecessary loops?
4. **Contracts** — API changes backward-compatible? TypeScript types match C# DTOs?
5. **Tests** — Are new paths covered? Do existing tests still pass?

## Output

Write your findings to `tasks/active/review-output.json`:

```json
{
  "verdict": "approved | approved_with_issues | rejected",
  "issues": [
    {
      "id": "RV-001",
      "severity": "blocking | major | minor | info",
      "affectedPhase": "backend | frontend",
      "file": "path/to/file",
      "line": 42,
      "summary": "One-line description",
      "recommendation": "How to fix"
    }
  ],
  "summary": "Brief review summary"
}
```

**Rules:**
- `blocking` issues → `verdict: rejected` (must route back to dev)
- Only `blocking` severity triggers rejection
- `approved_with_issues` means non-blocking issues exist but pipeline can proceed
- Be specific about which phase each issue affects (`affectedPhase`)

## After Writing review-output.json

Update `tasks/active/state.json`:

```json
{
  "phases": {
    "review": {
      "_invoked": false,
      "status": "done",
      "completed": "<ISO8601 now>",
      "handoffNote": "<key findings for VERIFY phase>"
    }
  }
}
```
```

- [ ] **Step 3: Write TASK-TEMPLATE-CODEX-FIX.md**

Create `tasks/TASK-TEMPLATE-CODEX-FIX.md`:

```markdown
# Codex Fix Task (REVIEW REJECTED)

> Pipeline: `<pipeline>` | Phase: `<phase>` | Fix Attempt: `<retryCount>`

## Why This Was Rejected

The following blocking issues were found during review. Fix ALL of them:

<reviewIssuesList>

## Original Task

<originalTaskContent>

## What Changed

Re-read `tasks/active/state.json` to see the current state. The handoff notes from
other phases may have been updated (especially if the other phase was also re-done).

## Completion Checklist

Same as the original dev task — update `state.json` atomically:

```json
{
  "phases": {
    "<phase>": {
      "status": "done",
      "_invoked": false,
      "completed": "<ISO8601 now>",
      "commit": "<run: git rev-parse HEAD>",
      "commitMsg": "fix: <describe what was fixed>",
      "filesChanged": <run: git diff --name-only HEAD~1 | jq -R -s 'split("\n") | map(select(length>0))'>,
      "testResults": {
        "total": <N>,
        "passed": <N>,
        "failed": <N>
      },
      "handoffNote": "<updated handoff — note what changed from the rejected version>"
    }
  }
}
```

**IMPORTANT:** Reference the issue IDs (e.g., RV-001, RV-003) in your commit message.
```

- [ ] **Step 4: Verify templates contain all required placeholders**

```bash
echo "=== DEV template placeholders ===" && grep -o '<[^>]*>' tasks/TASK-TEMPLATE-CODEX-DEV.md | sort -u
echo "=== REVIEW template placeholders ===" && grep -o '<[^>]*>' tasks/TASK-TEMPLATE-CODEX-REVIEW.md | sort -u
echo "=== FIX template placeholders ===" && grep -o '<[^>]*>' tasks/TASK-TEMPLATE-CODEX-FIX.md | sort -u
```

- [ ] **Step 5: Commit**

```bash
git add tasks/TASK-TEMPLATE-CODEX-DEV.md tasks/TASK-TEMPLATE-CODEX-REVIEW.md tasks/TASK-TEMPLATE-CODEX-FIX.md
git commit -m "feat: add Codex task templates (dev, review, fix)"
```

---

### Task 4: Create Cursor Prompt Template

**Files:**
- Create: `tasks/TASK-TEMPLATE-CURSOR.md`

**Interfaces:**
- Consumes: `state.json` field names; backend handoff context
- Produces: Markdown prompt user copies into Cursor

- [ ] **Step 1: Write TASK-TEMPLATE-CURSOR.md**

Create `tasks/TASK-TEMPLATE-CURSOR.md`:

```markdown
# Cursor Frontend Task

> Pipeline: `<pipeline>` | Phase: FRONTEND

## Context

**Read `tasks/active/state.json` first** — it contains the full pipeline state,
backend API details, and module lock information.

### What the backend built

**Backend commit:** `<backendCommit>`
**Backend files changed:** `<backendFiles>`
**Backend handoff:** `<backendHandoffNote>`

<reviewRejectionContext>

## Your Task

<frontendTaskDescription>

## Constraints

- **Allowed files:** `<allowedFiles>`
- **Forbidden files:** `<forbiddenFiles>`

## When Done

Update `tasks/active/state.json` with ALL of these fields in ONE write:

```json
{
  "phases": {
    "frontend": {
      "status": "done",
      "commit": "<run: git rev-parse HEAD>",
      "commitMsg": "<your commit message>",
      "filesChanged": <run: git diff --name-only HEAD~1 | jq -R -s 'split("\n") | map(select(length>0))'>,
      "testResults": {
        "total": <N>,
        "passed": <N>,
        "failed": <N>,
        "failures": ["<test name if failed>"]
      },
      "handoffNote": "<what the reviewer needs to know: design decisions, known issues, testing notes>"
    }
  }
}
```

**Checklist before writing state.json:**
- [ ] All changes committed (one commit)
- [ ] Tests run: `npx vitest run`
- [ ] Type check passes: `npx vue-tsc --noEmit`
- [ ] Build succeeds: `npm run build`
- [ ] Handoff note written (API assumptions, known limitations, test gaps)
```

- [ ] **Step 2: Verify template placeholders**

```bash
grep -o '<[^>]*>' tasks/TASK-TEMPLATE-CURSOR.md | sort -u
```

- [ ] **Step 3: Commit**

```bash
git add tasks/TASK-TEMPLATE-CURSOR.md
git commit -m "feat: add Cursor prompt template"
```

---

### Task 5: Verify MODULE-LOCKS.md Compatibility

**Files:**
- Read: `tasks/MODULE-LOCKS.md` (existing)

**Interfaces:**
- Produces: Confirmation that existing format supports pipeline lock/unlock operations (or documents needed changes)

The pipeline needs: lock acquisition (mark module as owned by pipeline), lock release (mark module as free). Verify the existing format supports these operations without format changes.

- [ ] **Step 1: Check if MODULE-LOCKS.md exists and review format**

```bash
if [ -f tasks/MODULE-LOCKS.md ]; then
  echo "=== MODULE-LOCKS.md exists ==="
  head -30 tasks/MODULE-LOCKS.md
else
  echo "MODULE-LOCKS.md does not exist — will create stub"
fi
```

- [ ] **Step 2: If it exists, verify pipeline compatibility**

Check that the format supports:
- Per-module lock status (free/locked)
- Lock owner (pipeline ID or agent name)
- Lock timestamp

If the format is incompatible, document the mapping in a comment. The pipeline only needs read/write access to lock entries — it doesn't change the format.

- [ ] **Step 3: Create stub if missing**

Only if `tasks/MODULE-LOCKS.md` doesn't exist:

```bash
cat > tasks/MODULE-LOCKS.md << 'EOF'
# Module Locks

> Auto-managed by the agent pipeline. Do not edit manually while a pipeline is running.

## Active Locks

| Module | Locked By | Pipeline | Since |
|--------|-----------|----------|-------|
| (none) | — | — | — |

## Lock History

| Module | Pipeline | Acquired | Released | Duration |
|--------|----------|----------|----------|----------|
EOF
```

- [ ] **Step 4: Commit (if changes made)**

```bash
git add tasks/MODULE-LOCKS.md 2>/dev/null && git commit -m "chore: add MODULE-LOCKS.md stub for pipeline" || echo "No changes to MODULE-LOCKS.md"
```

---

### Task 6: Integration Smoke Test

**Files:**
- Modify: None (test-only, cleanup after)

**Interfaces:**
- Consumes: All artifacts from Tasks 1–5
- Produces: Validated end-to-end flow: create state.json → validate schema → Monitor detects changes → templates render

This task simulates a minimal pipeline run without actually invoking Codex or Cursor.

- [ ] **Step 1: Create a test state.json for PLANNING phase**

```bash
cat > tasks/active/state.json << 'EOF'
{
  "version": "1.0",
  "pipeline": "TASK-0099",
  "type": "fullstack",
  "status": "running",
  "phase": "PLANNING",
  "created": "2026-08-06T12:00:00Z",
  "updated": "2026-08-06T12:00:00Z",
  "task": {
    "id": "TASK-0099",
    "title": "Smoke Test Pipeline",
    "requirement": "Verify pipeline tooling works end-to-end"
  },
  "phases": {
    "planning": {
      "status": "in-progress",
      "owner": "claude",
      "started": "2026-08-06T12:00:00Z",
      "handoffNote": "Test planning handoff"
    },
    "backend": {
      "status": "pending",
      "owner": "codex",
      "retryCount": 0,
      "_invoked": false
    },
    "frontend": {
      "status": "pending",
      "owner": "cursor"
    },
    "review": {
      "status": "pending",
      "owner": "codex",
      "retryCount": 0,
      "_invoked": false
    },
    "verify": {
      "status": "pending",
      "owner": "claude"
    }
  },
  "errors": [],
  "history": [
    {
      "time": "2026-08-06T12:00:00Z",
      "phase": "planning",
      "from": "pending",
      "to": "in-progress",
      "by": "claude"
    }
  ]
}
EOF
```

- [ ] **Step 2: Validate against schema**

```bash
echo "=== jq fast gate ==="
jq -e '.phase and .status' tasks/active/state.json && echo "PASS" || echo "FAIL"

echo "=== ajv full schema ==="
npx ajv validate -s tasks/active/state.schema.json -d tasks/active/state.json 2>&1 && echo "PASS" || echo "FAIL"
```

- [ ] **Step 3: Test Monitor detects frontend status change**

```bash
# Start Monitor in background
bash tasks/active/watch.sh > /tmp/monitor-output.txt 2>&1 &
MONITOR_PID=$!
echo "Monitor PID: $MONITOR_PID"

# Give it time to start polling
sleep 1

# Simulate Cursor writing 'done' to state.json
jq '.phases.frontend.status = "done"' tasks/active/state.json > tasks/active/state.json.tmp
mv tasks/active/state.json.tmp tasks/active/state.json

# Wait for Monitor to detect
sleep 2

# Check output
echo "=== Monitor output ==="
cat /tmp/monitor-output.txt

# Verify FRONTEND:done was emitted (may also have FRONTEND:pending from initial read)
grep -q "FRONTEND:done" /tmp/monitor-output.txt && echo "FRONTEND:done detected: PASS" || echo "FRONTEND:done detected: FAIL"

# Cleanup
kill $MONITOR_PID 2>/dev/null || true
wait $MONITOR_PID 2>/dev/null || true
```

- [ ] **Step 4: Test Monitor detects abort**

```bash
# Start fresh Monitor
bash tasks/active/watch.sh > /tmp/monitor-abort-output.txt 2>&1 &
MONITOR_PID=$!
sleep 1

# Set abort
jq '.status = "aborted"' tasks/active/state.json > tasks/active/state.json.tmp
mv tasks/active/state.json.tmp tasks/active/state.json

sleep 2

echo "=== Monitor abort output ==="
cat /tmp/monitor-abort-output.txt

grep -q "PIPELINE:aborted" /tmp/monitor-abort-output.txt && echo "PIPELINE:aborted detected: PASS" || echo "PIPELINE:aborted detected: FAIL"

# Monitor should have exited on its own (break on abort)
wait $MONITOR_PID 2>/dev/null
echo "Monitor exit code: $?"
```

- [ ] **Step 5: Verify template rendering (manual check)**

```bash
echo "=== Template files exist ==="
for f in tasks/TASK-TEMPLATE-CODEX-DEV.md tasks/TASK-TEMPLATE-CODEX-REVIEW.md tasks/TASK-TEMPLATE-CODEX-FIX.md tasks/TASK-TEMPLATE-CURSOR.md; do
  test -f "$f" && echo "  $f: EXISTS ($(wc -l < $f) lines)" || echo "  $f: MISSING"
done

echo ""
echo "=== All placeholders (should match pipeline fields) ==="
grep -oh '<[^>]*>' tasks/TASK-TEMPLATE-*.md | sort -u
```

- [ ] **Step 6: Clean up test artifacts**

```bash
rm -f tasks/active/state.json tasks/active/watch.pid /tmp/test-*.json /tmp/monitor-*.txt
# Restore directory to clean state
test -f tasks/completed/.gitkeep && echo "Cleanup complete"
```

- [ ] **Step 7: Commit (if any test fixes needed)**

```bash
# Only if fixes were made during testing
git status
```

---

### Task 7: Pipeline Runner Agent Definition

**Files:**
- Create: `.claude/agents/pipeline-runner.md`

**Interfaces:**
- Consumes: Design doc at `docs/superpowers/specs/2026-08-06-agent-pipeline-design.md`
- Produces: Claude agent definition that loads the pipeline orchestration flow

This is a Claude Code custom agent that pre-loads the pipeline design so Claude can execute pipeline runs without re-reading the full design doc each time. It references the design doc for detailed steps and keeps this file as a quick-reference entry point.

- [ ] **Step 1: Create agents directory**

```bash
mkdir -p .claude/agents
```

- [ ] **Step 2: Write pipeline-runner.md**

Create `.claude/agents/pipeline-runner.md`:

```markdown
---
name: pipeline-runner
description: Executes the multi-agent automated development pipeline. Use when the user says "run pipeline", "start pipeline", "execute task TASK-XXXX", or submits a new feature requirement.
tools: Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, Task
model: opus
---

# Agent Pipeline Runner

You are the pipeline orchestrator. Your job is to execute the multi-agent
development pipeline defined in the design doc, driving Codex (backend/review)
and Cursor (frontend) through the state machine to deliver completed features.

## Required Reading

Before taking any action, read:
1. `docs/superpowers/specs/2026-08-06-agent-pipeline-design.md` — the full design
2. `tasks/active/state.json` — current pipeline state (if exists)

## Core Loop

The design doc's "Claude 主流程" section (steps 1-13) is your operational playbook.
Follow it exactly. Key principles:

1. **Check abort at every step boundary.** Before each major action, read `status`
   from state.json. If `aborted` → execute step 13 cleanup.
2. **Write state.json atomically.** Every update must include `updated` timestamp
   and a `history` entry.
3. **Validate at gates.** jq fast gate after every write; ajv full schema before
   every phase transition.
4. **Monitor only for Cursor.** The Monitor script (`tasks/active/watch.sh`)
   watches `phases.frontend.status`. You drive everything else directly.
5. **retryCount > 2 → PAUSED.** Never retry more than 3 total attempts.

## State File Locations

| File | Purpose |
|------|---------|
| `tasks/active/state.json` | Single source of truth |
| `tasks/active/state.schema.json` | JSON Schema for validation |
| `tasks/active/watch.sh` | Monitor script (run in background) |
| `tasks/active/watch.pid` | Monitor PID (auto-managed) |
| `tasks/active/review-output.json` | Codex review output |
| `tasks/completed/TASK-XXXX-state.json` | Archived completed pipelines |

## Task Templates

When generating task files for Codex or prompts for Cursor, start from:
- Codex dev: `tasks/TASK-TEMPLATE-CODEX-DEV.md`
- Codex review: `tasks/TASK-TEMPLATE-CODEX-REVIEW.md`
- Codex fix: `tasks/TASK-TEMPLATE-CODEX-FIX.md`
- Cursor: `tasks/TASK-TEMPLATE-CURSOR.md`

Replace all `<placeholders>` with actual values from state.json and the current task.

## Quick Validation Commands

```bash
# Fast gate: does state.json have basic structure?
jq -e '.phase and .status' tasks/active/state.json

# Full schema validation:
npx ajv validate -s tasks/active/state.schema.json -d tasks/active/state.json

# Check Monitor health:
kill -0 $(cat tasks/active/watch.pid) 2>/dev/null && echo "alive" || echo "dead"

# Start Monitor:
bash tasks/active/watch.sh &
```
```

- [ ] **Step 3: Verify agent definition loads correctly**

```bash
echo "=== Agent definition ==="
head -10 .claude/agents/pipeline-runner.md
echo "..."
wc -l .claude/agents/pipeline-runner.md
```

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/pipeline-runner.md
git commit -m "feat: add pipeline-runner agent definition"
```

---

## Self-Review

### 1. Spec coverage

| Spec Section | Covered By |
|-------------|-----------|
| state.json Schema (top-level + all 5 phases + errors + history) | Task 1 (state.schema.json validates every field) |
| Monitor 检测机制 (watch.sh + events table) | Task 2 (watch.sh with abort detection + all 4 event types) |
| Codex 集成 (3 task templates) | Task 3 (DEV, REVIEW, FIX templates) |
| Cursor 集成 (Prompt Template) | Task 4 (Cursor template with abort + fix variants) |
| 模块锁集成 | Task 5 (MODULE-LOCKS.md verification) |
| JSON Schema 校验 (jq + ajv) | Task 1 step 5-6, Task 6 step 2 |
| Crash Recovery | Covered by design doc; runner agent references it |
| PAUSED + Abort handling | Task 2 (Monitor abort detection), design doc steps 12-13 |
| Claude 主流程 (steps 1-13) | Task 7 (pipeline-runner agent references design doc) |
| 验收标准 AC-01 ~ AC-15 | Task 6 (integration smoke test validates key paths) |

### 2. Placeholder scan

No TBD, TODO, or vague instructions. All steps have concrete commands and expected output.

### 3. Type consistency

- Field names match between state.schema.json (Task 1) and task templates (Tasks 3-4):
  - `phases.<phase>.status`, `.commit`, `.filesChanged`, `.testResults`, `.handoffNote` — consistent across all templates
  - `retryCount`, `_invoked` — consistent between schema and Codex templates
  - `verdict`, `issues[].severity`, `issues[].affectedPhase` — consistent between schema and review template
- Monitor script (Task 2) reads `.status` and `.phases.frontend.status` — matches schema paths
- Event names (`FRONTEND:done`, `FRONTEND:failed`, `PIPELINE:aborted`) — consistent between watch.sh and design doc events table

---

## Execution Handoff

All 7 tasks produce independently testable deliverables. Each task ends with a commit. Tasks 1-4 can be done in any order; Task 5-6 depend on earlier tasks; Task 7 is standalone.
