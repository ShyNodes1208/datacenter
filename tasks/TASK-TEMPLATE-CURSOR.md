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

Update `tasks/active/state.json` **atomically** (read full doc, merge, write back):

```bash
jq '.phases.frontend.status = "done" |
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

**Checklist before writing state.json:**
- [ ] All changes committed (one commit)
- [ ] Tests run: `npx vitest run`
- [ ] Type check passes: `npx vue-tsc --noEmit`
- [ ] Build succeeds: `npm run build`
- [ ] Handoff note written (API assumptions, known limitations, test gaps)
