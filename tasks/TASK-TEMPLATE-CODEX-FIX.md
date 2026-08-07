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

Same as the original dev task — update `state.json` **atomically** by reading
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
   .phases.<phase>.commitMsg = "fix: <describe what was fixed>" |
   .phases.<phase>.filesChanged = $files |
   .phases.<phase>.testResults = { "total": <N>, "passed": <N>, "failed": <N> } |
   .phases.<phase>.handoffNote = "<updated handoff — note what changed from the rejected version>" |
   .updated = "<ISO8601 now>" |
   .history += [{ "time": "<ISO8601 now>", "phase": "<phase>", "from": "in-progress", "to": "done", "by": "codex" }]' \
  tasks/active/state.json > tasks/active/state.json.tmp \
  && mv tasks/active/state.json.tmp tasks/active/state.json
```

**IMPORTANT:** Reference the issue IDs (e.g., RV-001, RV-003) in your commit message.
- The `.updated` timestamp and `.history` entry are REQUIRED — do not skip them
