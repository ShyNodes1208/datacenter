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

Complete these steps **in order**:

### Step 1: Verify and commit

- [ ] npx vitest run (must pass)
- [ ] npx vue-tsc --noEmit (must pass)
- [ ] npm run build (must succeed)

```bash
git add <your changed files>
git commit -m "<descriptive commit message>"
```

**This is mandatory.** The state.json update (Step 2) records the commit hash.
If you skip this, the pipeline breaks — state.json will point to a nonexistent commit.

### Step 2: Update state.json

Update `tasks/active/state.json` **atomically** (read full doc, merge, write back):

```bash
# Step 2: Update state.json atomically
# Uses the commit hash from Step 1
FILES_JSON=$(git diff --name-only HEAD~1 | jq -R -s 'split("\n") | map(select(length>0))')

jq --argjson files "$FILES_JSON" \
  '.phases.frontend.status = "done" |
   .phases.frontend.commit = "'"$(git rev-parse HEAD)"'" |
   .phases.frontend.commitMsg = "<your commit message>" |
   .phases.frontend.filesChanged = $files |
   .phases.frontend.testResults = { "total": <N>, "passed": <N>, "failed": <N>, "failures": ["<test name if failed>"] } |
   .phases.frontend.handoffNote = "<handoff note>" |
   .updated = "<ISO8601 now>" |
   .history += [{ "time": "<ISO8601 now>", "phase": "frontend", "from": "in-progress", "to": "done", "by": "cursor" }]' \
  tasks/active/state.json > tasks/active/state.json.tmp \
  && mv tasks/active/state.json.tmp tasks/active/state.json
```

- [ ] Handoff note written (API assumptions, known limitations, test gaps)
