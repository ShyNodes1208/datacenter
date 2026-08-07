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

When done, you MUST update `tasks/active/state.json` **atomically** by reading
the full document, modifying only your phase, and writing the complete result:

```bash
# Build files array from git diff
FILES_JSON=$(git diff --name-only HEAD~1 | jq -R -s 'split("\n") | map(select(length>0))')

# Read current state, merge your changes, write back in one step:
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
- All git changes must be committed BEFORE updating state.json
- One commit per phase — squash if needed
- `handoffNote` must include: API signatures, config changes, known caveats
- The `.updated` timestamp and `.history` entry are REQUIRED — do not skip them
- If tests fail, document each failure in `testResults.failures[]`
