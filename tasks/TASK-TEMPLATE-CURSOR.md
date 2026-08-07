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
