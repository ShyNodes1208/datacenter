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
