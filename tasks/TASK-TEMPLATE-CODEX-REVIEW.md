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

Update `tasks/active/state.json` **atomically** (read full doc, merge, write back):

```bash
jq '.phases.review._invoked = false |
    .phases.review.status = "done" |
    .phases.review.completed = "<ISO8601 now>" |
    .phases.review.handoffNote = "<key findings for VERIFY phase>" |
    .updated = "<ISO8601 now>" |
    .history += [{ "time": "<ISO8601 now>", "phase": "review", "from": "in-progress", "to": "done", "by": "codex" }]' \
    tasks/active/state.json > tasks/active/state.json.tmp \
    && mv tasks/active/state.json.tmp tasks/active/state.json
```
