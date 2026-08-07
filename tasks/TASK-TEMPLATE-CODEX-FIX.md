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

Complete these steps **in order**:

### Step 1: Commit your changes

```bash
# Add all changed/new files for this phase
git add <list your changed files>
git commit -m "fix: <describe what was fixed>"
```

**This is mandatory.** The state.json update (Step 2) records the commit hash.
If you skip this, the pipeline breaks — state.json will point to a nonexistent commit.

**IMPORTANT:** Reference the issue IDs (e.g., RV-001, RV-003) in your commit message.

### Step 2: Update state.json

Update `state.json` **atomically** by reading the full document, modifying only
your phase, and writing the complete result:

```bash
# Step 2: Update state.json atomically
# Uses the commit hash from Step 1
FILES_JSON=$(git diff --name-only HEAD~1 | jq -R -s 'split("\n") | map(select(length>0))')

jq --argjson files "$FILES_JSON" \
  '.phases.<phase>.status = "done" |
   .phases.<phase>._invoked = false |
   .phases.<phase>.completed = "<ISO8601 now>" |
   .phases.<phase>.commit = "'"$(git rev-parse HEAD)"'" |
   .phases.<phase>.commitMsg = "fix: <describe what was fixed>" |
   .phases.<phase>.filesChanged = $files |
   .phases.<phase>.testResults = { "total": <N>, "passed": <N>, "failed": <N> } |
   .phases.<phase>.handoffNote = "<updated handoff — note what changed from the rejected version>" |
   .updated = "<ISO8601 now>" |
   .history += [{ "time": "<ISO8601 now>", "phase": "<phase>", "from": "in-progress", "to": "done", "by": "codex" }]' \
  tasks/active/state.json > tasks/active/state.json.tmp \
  && mv tasks/active/state.json.tmp tasks/active/state.json
```

- The `.updated` timestamp and `.history` entry are REQUIRED — do not skip them
