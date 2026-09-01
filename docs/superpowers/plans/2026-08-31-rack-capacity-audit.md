# Rack Capacity and Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators find a usable contiguous U-position in an enabled rack and browse existing placement-change records from one page.

**Architecture:** Capacity search stays in the frontend: `HomeView` loads existing room rack summaries and a pure helper identifies empty `USlot` ranges. The audit page gets one read-only projection of existing `AuditRecords` joined to `Servers`; it writes no new historical data.

**Tech Stack:** Vue 3, TypeScript, Vitest, ASP.NET Core 8, EF Core 8, xUnit.

**Spec:** `tasks/TASK-20260831-rack-capacity-audit.md`

## Global Constraints

- Do not modify a database model, migration, seed data, authentication, existing write endpoint, or per-server audit endpoint.
- Do not add a dependency, export, pagination, automatic mounting, or exact historical room/rack filter.
- Claim every allowed path in `tasks/MODULE-LOCKS.md` before editing.

---

### Task 1: Find contiguous available U ranges

**Files:**
- Modify: `src/frontend/src/composables/useRackDetail.ts`
- Modify: `src/frontend/src/views/HomeView.vue`
- Test: `src/frontend/src/__tests__/rackDetail.test.ts`
- Test: `src/frontend/src/__tests__/router-and-views.test.ts`

**Interface:** Export `findAvailableURanges(slots: USlot[], requiredU: number): Array<{ startU: number; endU: number; length: number }>` from `useRackDetail.ts`.

- [ ] Write failing pure-helper tests for adjacent free slots, occupied breaks, and too-short ranges.
- [ ] Run `cd src/frontend && npm test -- rackDetail.test.ts --run`; verify failure because the helper is absent.
- [ ] Add the helper by filtering existing free `USlot` values with `uCount >= requiredU`; return `[]` for non-positive/non-integer input.
- [ ] Refactor the existing HomeView summary fetch into one function reused by expansion and search. Add a labeled numeric field, submit action, errors/loading, and results. Search every known room, exclude rack status other than `启用`, render room/rack/range/length, and reuse `goToRack(id)` when a result is clicked.
- [ ] Add SSR setup-state assertions for invalid input and a matching result, then run `npm test -- rackDetail.test.ts router-and-views.test.ts --run`.

### Task 2: Read-only global audit endpoint

**Files:**
- Modify: `src/backend/Datacenter.Api/Controllers/ServersController.cs`
- Test: `tests/backend/Datacenter.Api.Tests/IntegrationTests/ServerPositionIntegrationTests.cs`

**Interface:** Add `GET /api/servers/audit-records?from=&to=&operatorUsername=&operationType=&serverName=` returning `id`, `serverId`, `serverName`, `operationType`, `fromPosition`, `toPosition`, `operatorUsername`, `operatedAt`, and `notes`.

- [ ] Write failing integration tests with multiple audit records that prove combined filters, newest-first order, full response fields, inclusive `to` date, and anonymous `401`.
- [ ] Run `dotnet test tests/backend/Datacenter.Api.Tests/ --no-restore --filter 'FullyQualifiedName~ServerPositionIntegrationTests'`; verify the route fails.
- [ ] Add `HttpGet("audit-records")` in `ServersController`: start at `AuditRecords.AsNoTracking()`, apply non-empty filters, map `to` to the next-day exclusive bound, project the exact fields and `Server.Name`, order descending, then `Ok` the rows. Do not apply antiforgery validation to this GET.
- [ ] Rerun the focused backend tests and verify pass.

### Task 3: Global audit page and navigation

**Files:**
- Create: `src/frontend/src/views/AuditRecordsView.vue`
- Modify: `src/frontend/src/router.ts`
- Modify: `src/frontend/src/App.vue`
- Test: `src/frontend/src/__tests__/router-and-views.test.ts`

**Interface:** Add protected route `/audit-records`; consume Task 2 through `useApi().request`.

- [ ] Write a failing SSR test that mocks the global audit response and requires filters, response fields, and the protected route.
- [ ] Run `cd src/frontend && npm test -- router-and-views.test.ts --run`; verify the missing route/view fails.
- [ ] Add one SFC with date, operator, operation-type, and server-name filters; only serialize non-empty parameters; show query/error/loading state and results; use `-` for null positions and `router.push('/servers/' + encodeURIComponent(serverId))` for server links. Add one lazy route and one `变更记录` App navigation link.
- [ ] Run `cd src/frontend && npm test -- --run && npm run typecheck && npm run build`.

### Task 4: Handoff

**Files:**
- Modify: `tasks/MODULE-LOCKS.md`
- Modify: `tasks/TASK-20260831-rack-capacity-audit.md`
- Modify: `tasks/current-task.md`

- [ ] Run `dotnet test tests/backend/Datacenter.Api.Tests/ --no-restore` and `git diff --check`.
- [ ] Record changed paths, test evidence, known limitation, commit, and the legal `IN_PROGRESS -> READY_FOR_REVIEW` transition; change locks from `CLAIMED` to `HANDED_OFF`.

## Plan Self-Review

- FR-01 is covered by Task 1; FR-02/NFR-01 by Tasks 2–3; handoff by Task 4.
- No placeholders, dependency additions, or inconsistent interface names remain.
