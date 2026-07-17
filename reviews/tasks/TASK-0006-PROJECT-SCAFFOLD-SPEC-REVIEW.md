# TASK-0006 Project Scaffold Specification Review

## 1. Review metadata

| Field | Value |
|---|---|
| Task | TASK-0006 — MVP 项目脚手架 |
| Review type | Independent task-specification review |
| Reviewer | Codex Reviewer |
| Branch | `chore/task-0006-project-scaffold` |
| Reviewed HEAD | `37a8ca235f4da4d3854079759a416439ecc8c511` |
| Main baseline | `01ee54c5405568b6ad2dcde7d093c2dfd1d0f707` |
| Review date | 2026-07-17 |
| Verdict | **NEEDS_CHANGES** |

## 2. Reviewed commit and files

Reviewed commits:

- `005755b1ebb2ca980a5b992b8a49260413f373a2` — `docs: prepare task-0006 project scaffold`
- `37a8ca235f4da4d3854079759a416439ecc8c511` — `chore: hand off task-0006 specification for review`

The complete diffs of both commits and the three changed specification/workflow files were reviewed:

- `tasks/TASK-0006-PROJECT-SCAFFOLD.md`
- `tasks/current-task.md`
- `tasks/MODULE-LOCKS.md`

Also read the required workflow, product and architecture baselines, task template, TASK-0005 closure, CR-0001, TASK-0005 final retest, current repository layout, scripts, README, `.gitignore`, and anti-overdevelopment rules. No business code, scaffold, `package.json`, project file, solution, or dependency lock file exists at the reviewed HEAD.

## 3. Executive conclusion

The intended scaffold scope is appropriately small, but the specification is not yet safe to hand to Cursor Frontend. The current workflow state closes off any legal path from specification approval to implementation; the named Owner is not authorized by `AGENTS.md` to implement the backend and .NET test portions; and the generation commands, dependency budget, template cleanup, project/script naming, and several acceptance criteria remain ambiguous or internally inconsistent.

## 4. Workflow and role assessment

`READY_FOR_REVIEW` and the three `HANDED_OFF` records are syntactically valid, and Owner/Reviewer independence holds. They are not semantically valid for a pre-implementation specification gate:

- `READY_FOR_REVIEW` means first development is complete. Its successful exit is `COMPLETED`; there is no legal transition back to `READY` or `IN_PROGRESS` for later scaffold implementation.
- The recorded locks cover only the task specification, current-task pointer, and lock register. They do not cover the implementation paths listed by the task (`src/`, `tests/`, scripts, README, `.gitignore`).
- `AGENTS.md` authorizes Cursor Frontend for Vue/frontend work. Backend, database, API, authorization, and backend tests belong to Codex Backend. TASK-0005 defines TASK-0006 scope but does not grant Cursor Frontend new backend authority or call it “frontend-led.”

Therefore the formal state and Owner must be corrected before implementation. Review failure should follow the existing legal transition `READY_FOR_REVIEW -> CHANGES_REQUESTED`; a non-reviewer fixes the recorded findings, reclaims the relevant specification locks, and returns the corrected specification for retest. Implementation must then begin under a workflow arrangement that has a legal `READY -> IN_PROGRESS` path and authorized ownership for every module.

## 5. Scope assessment

The declared non-goals correctly exclude business entities, business controllers, formal pages, routing, EF Core, SQLite, authentication, HTTP client abstraction, Docker, CI/CD, distributed infrastructure, and production deployment. The scope is conceptually limited to one Vue project, one ASP.NET Core project, one xUnit project, one solution, minimal commands, ignores, and placeholder tests.

However, AC-SC-11 and AC-SC-14 permit template demo content that the non-functional requirements require deleting. This weakens the actual scope boundary and is addressed in finding SC-005.

## 6. Directory and naming assessment

The appendix presents paths and names, but labels the structure “推荐” and makes `scripts/build.ps1` optional. The solution build location is “仓库根目录或 src/,” and script placement and shell are alternatives. These are not unique implementation decisions. The specification must make the approved paths, project names, solution name, project references, README section, and exact script set normative.

## 7. Frontend scaffold assessment

The desired direct dependencies are mostly appropriate: `vue` at runtime and Vite, the Vue plugin, TypeScript, Vitest, and `vue-tsc` for development. The task does not specify whether to use `npm create vue`, `npm create vite`, or manual files; it supplies neither a repeatable non-interactive command nor exact interactive answers. It also does not define package scripts, exact versions, `package-lock.json`, or the handling of additional direct dependencies emitted by the selected generator. AC-SC-02 permits an unspecified “equivalent” command.

The specification must choose one reproducible npm-based generation procedure, explicitly disable Router, Pinia, JSX, ESLint, Prettier, browser tests, and DOM/component-test packages, require TypeScript and Vitest, list every resulting direct dependency with its current purpose, and require the lock file.

## 8. Backend scaffold assessment

The task says only “dotnet new webapi” and never gives an exact command. With the installed .NET 8 template, controllers are not the default and OpenAPI is enabled unless explicitly disabled. A reproducible command therefore needs, at minimum, explicit name/output/framework, `--use-controllers`, `--no-openapi`, authentication choice, and restore behavior. The task also needs exact solution/project commands, project-reference command, template cleanup, `Nullable`/`ImplicitUsings`, and warning policy.

The current statement that the Web API template “automatically includes” default references is not a dependency budget. No OpenAPI/Swagger package is approved, yet the command does not prevent its generation.

## 9. Test dependency assessment

`xunit`, `Microsoft.NET.Test.Sdk`, and `xunit.runner.visualstudio` have present purposes. `coverlet.collector` is marked optional solely because the template emits it; TASK-0006 has no coverage command, output, threshold, or acceptance criterion. Template default is not a current requirement, so it must be removed from the project and dependency budget unless a Change Request adds a concrete coverage acceptance need.

The placeholder test must be given a stable name and a precise non-business assertion. The specification must decide whether it verifies only the xUnit runner (no `ProjectReference`) or verifies a public scaffold seam (with an exact `ProjectReference`); it currently requires the reference but does not define a test that uses it.

## 10. Build script assessment

No exact script is required. “最多少量,” “可能新增,” “可选,” “根目录或 scripts,” and “pwsh or bash” leave the implementer to choose file count, names, locations, and behavior. The existing `scripts/validate-agent-workflow.ps1` must not be overwritten. The minimum fix is to select either no new wrapper script and list direct commands, or exactly one named `pwsh` script with its ordered commands, failure behavior, and working-directory assumptions.

## 11. Acceptance criteria assessment

AC-SC-01 through AC-SC-20 are not all objectively verifiable:

- AC-SC-02 permits an undefined equivalent command.
- AC-SC-08 permits two solution locations without naming the solution.
- AC-SC-09 permits unspecified scripts in unspecified locations and either shell.
- AC-SC-11 and AC-SC-14 permit demo placeholders contrary to the cleanup requirement.
- AC-SC-18/19 are useful final Git gates, but no AC requires `package-lock.json` or checks ignored `node_modules`, `dist`, `bin`, `obj`, and test results.
- AC-SC-20 (“can be independently reviewed”) is circular and has no executable pass criterion.
- Warning handling and exact expected frontend/backend test counts are not fixed.

The AC set must identify exact commands, paths, expected counts/results, warning policy, lockfile and ignore evidence, and forbidden-template-content checks.

## 12. Complexity budget assessment

The project count and abstraction count are bounded, but the file and script budgets are not. “最多少量” and a recommended directory tree do not let the implementer determine whether a generated file is allowed. The corrected specification should enumerate mandatory template/config files or define objective allowed file categories and maximum optional files, state which generated files must be deleted, limit scripts exactly, and require a Change Request before exceeding the budget.

## 13. Overdevelopment assessment

The intended design follows the simplest viable architecture and explicitly rejects the major overdevelopment risks. No implementation or dependency has yet been introduced. The ambiguities nevertheless create room for accidental Router/Pinia/lint/browser-test/OpenAPI/coverage packages, template demo endpoints, or extra runner infrastructure. Resolving the findings below is necessary to make the guardrail enforceable rather than aspirational.

## 14. Findings

### SC-001 — BLOCKER — Specification review state has no legal path to implementation

- File/section: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:7,14,195-202`; `tasks/current-task.md:9-17`; `tasks/MODULE-LOCKS.md:29-31`; `docs/architecture/AGENT-WORKFLOW.md` sections 3–5.
- Problem: TASK-0006 is already `READY_FOR_REVIEW`, which means implementation is finished. A PASS can only move it to `COMPLETED`; the workflow has no transition back to implementation. The handed-off locks cover specification files, not the modules the scaffold will modify.
- Risk: approving the specification either falsely completes an unimplemented task or forces an illegal state transition/unlocked implementation.
- Minimal fix direction: record `CHANGES_REQUESTED`, have a non-reviewer correct the task lifecycle, and establish a separately reviewable specification gate or separate specification/implementation tasks. Before implementation, enter `READY -> IN_PROGRESS` legally and claim every implementation path, including parent/child conflict checks.

### SC-002 — BLOCKER — Cursor Frontend lacks authority for the full task scope

- File/section: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:8,59-68`; `tasks/current-task.md:10`; `AGENTS.md` section 3; architecture baseline section 22.
- Problem: the task asserts that TASK-0005 authorized a “frontend-led” task and assigns backend Web API, xUnit, solution, and backend scripts to Cursor Frontend. AGENTS.md authorizes Cursor Frontend only for frontend responsibilities; TASK-0005 describes scope, not a role exception.
- Risk: backend and test projects would be created by an unauthorized role, violating role boundaries and making ownership/review accountability invalid.
- Minimal fix direction: assign authorized Owners per module/task (for example, split frontend and .NET scaffold work), or obtain and record an explicit approved role-boundary change. Do not infer backend authority from the word “scaffold.”

### SC-003 — MAJOR — Frontend generation and dependency result are not reproducible

- File/section: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:59,80,119-122,142-150,284-300,335-363`.
- Problem: no generator or exact non-interactive options are selected; package scripts, exact versions, npm-only policy, lockfile, Node/npm checks, and handling of generator-added direct dependencies are unspecified.
- Risk: different Cursor choices produce different files and dependency graphs, including unbudgeted packages.
- Minimal fix direction: prescribe one exact npm command/procedure and answers, explicit disabled options, exact direct dependency budget/versions, exact scripts, version checks, and committed `package-lock.json`.

### SC-004 — MAJOR — Backend and solution commands omit required template decisions

- File/section: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:60-68,123-127,142-161,302-308,335-363`.
- Problem: the exact `dotnet new webapi`, `dotnet new xunit`, `dotnet new sln`, `dotnet sln add`, and `dotnet add reference` commands are absent. Controllers, `net8.0`, no OpenAPI, project names, output paths, Nullable/ImplicitUsings, restore behavior, and warning policy are not fully fixed.
- Risk: the default .NET 8 template can generate Minimal API/OpenAPI content and dependencies contrary to the baseline, and solution/reference layout can vary.
- Minimal fix direction: provide exact commands and post-generation edits, including `--use-controllers`, `--no-openapi`, explicit framework/name/output, exact solution membership/reference, and build warning acceptance.

### SC-005 — MAJOR — Template cleanup requirements contradict the AC and directory appendix

- File/section: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:81,129,132,335-363`.
- Problem: the non-functional requirement deletes demo content, while AC-SC-11 allows a template controller, AC-SC-14 allows default `App.vue`, and the appendix retains `UnitTest1.cs`. No objective ban covers WeatherForecast, Vite counter/HelloWorld, logos, demo CSS/API, or unused template packages.
- Risk: demo code and dependencies can pass acceptance and become accidental production baseline.
- Minimal fix direction: require deletion of all named template demos and assets; replace them with explicitly named minimal neutral app/test content; make the AC match the prohibition.

### SC-006 — MAJOR — `coverlet.collector` has no current acceptance purpose

- File/section: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:310-318`.
- Problem: coverage collection is optional and justified only by template default; no coverage command, report, threshold, or AC exists.
- Risk: an unused dependency violates the approved minimum-dependency and anti-overdevelopment gates.
- Minimal fix direction: delete `coverlet.collector` after template generation and remove it from the budget. Add it later only through an approved task/Change Request with executable coverage acceptance.

### SC-007 — MAJOR — Paths, names, scripts, and file budget remain optional

- File/section: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:101-115,126-127,335-363`.
- Problem: the solution may be in root or `src`, scripts may be in root or `scripts`, bash or pwsh may be used, `build.ps1` is optional, and the appendix is only recommended. “最多少量” does not cap scripts/files.
- Risk: implementation cannot be compared objectively with the approved scope and may overwrite or duplicate existing scripts.
- Minimal fix direction: make one directory/project/solution naming scheme normative; define exact script count/name/commands (or explicitly zero wrappers); name the README section; bound allowed generated/config files and require CR for excess.

### SC-008 — MAJOR — AC-SC-01 through AC-SC-20 are not fully executable

- File/section: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:117-138`.
- Problem: several AC contain alternatives or subjective/circular outcomes, omit lockfile and ignore checks, allow demo content, and do not state warning policy or exact test results.
- Risk: Cursor self-test and independent retest can legitimately reach different conclusions.
- Minimal fix direction: rewrite each affected AC with one command/file assertion and expected exit/result; require lockfile, ignored-artifact checks, exact placeholder test counts, zero errors plus explicit warning policy, forbidden-content/dependency scans, and replace AC-SC-20 with an objective artifact check.

### SC-009 — MINOR — Traceability mappings do not match the cited AC

- File/section: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:89-97`.
- Problem: the backend test project maps to AC-SC-08 (solution build) instead of AC-SC-07; solution/build scripts map to AC-SC-12 (absence of EF/SQLite); README maps only to AC-SC-09, which does not verify README content.
- Risk: required artifacts can appear traceable while having no actual acceptance evidence.
- Minimal fix direction: correct mappings and add an objective README AC if README modification remains required.

## 15. Validation results

| Check | Result |
|---|---|
| Review-start worktree | CLEAN |
| Branch | PASS — `chore/task-0006-project-scaffold` |
| HEAD | PASS — `37a8ca235f4da4d3854079759a416439ecc8c511` |
| HEAD vs remote branch | PASS — identical |
| Baseline range | PASS — exactly three task-specification/workflow files changed |
| Current status | Syntactically PASS (`READY_FOR_REVIEW`), semantically FAIL for pre-implementation gate |
| TASK-0006 locks | Syntactically three `HANDED_OFF`; FAIL for implementation coverage/lifecycle |
| TASK-0005 regression | PASS — `COMPLETED`, three locks `RELEASED` |
| Scaffold/code/dependency files | PASS — none present |
| Installed environment observed | Node `v24.18.0`; npm `11.16.0`; .NET SDK `8.0.129` |
| Workflow validator | PASS=20, FAIL=0, TOTAL=20, exit code 0 |
| `git diff --check` | PASS, exit code 0 |

## 16. Final verdict

**NEEDS_CHANGES**

Finding counts: BLOCKER 2 / MAJOR 6 / MINOR 1 / NOTE 0.

TASK-0006 must not be handed to Cursor Frontend for implementation in its current form. The workflow lifecycle and authorized ownership are blocking; the remaining specification ambiguities must be resolved before an independent retest.
