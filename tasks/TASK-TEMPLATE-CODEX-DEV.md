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

When done, complete these steps **in order**:

### Step 1: Commit your changes

```bash
# Add all changed/new files for this phase
git add <list your changed files>
git commit -m "<descriptive commit message>"
```

**This is mandatory.** The state.json update (Step 2) records the commit hash.
If you skip this, the pipeline breaks — state.json will point to a nonexistent commit.

### Step 2: Update state.json

Update `tasks/active/state.json` **atomically** by reading the full document,
modifying only your phase, and writing the complete result:

```bash
# Step 2: Update state.json atomically
# Uses the commit hash from Step 1
FILES_JSON=$(git diff --name-only HEAD~1 | jq -R -s 'split("\n") | map(select(length>0))')

jq --argjson files "$FILES_JSON" \
  '.phases.<phase>.status = "done" |
   .phases.<phase>._invoked = false |
   .phases.<phase>.completed = "<ISO8601 now>" |
   .phases.<phase>.commit = "'"$(git rev-parse HEAD)"'" |
   .phases.<phase>.commitMsg = "<your commit message>" |
   .phases.<phase>.filesChanged = $files |
   .phases.<phase>.testResults = { "total": <N>, "passed": <N>, "failed": <N> } |
   .phases.<phase>.handoffNote = "<handoff note>" |
   .updated = "<ISO8601 now>" |
   .history += [{ "time": "<ISO8601 now>", "phase": "<phase>", "from": "in-progress", "to": "done", "by": "codex" }]' \
  tasks/active/state.json > tasks/active/state.json.tmp \
  && mv tasks/active/state.json.tmp tasks/active/state.json
```

**Important:**
- One commit per phase — squash if needed
- `handoffNote` must include: API signatures, config changes, known caveats
- The `.updated` timestamp and `.history` entry are REQUIRED — do not skip them
- If tests fail, document each failure in `testResults.failures[]`
