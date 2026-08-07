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
