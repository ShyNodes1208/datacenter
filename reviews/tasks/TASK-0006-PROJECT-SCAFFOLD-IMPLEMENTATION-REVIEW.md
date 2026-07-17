# TASK-0006 Project Scaffold Implementation Review

## 1. Review metadata

| Field | Value |
|---|---|
| Task | TASK-0006 — MVP project scaffold |
| Review type | Independent implementation review |
| Owner | Cursor Developer |
| Reviewer | Codex Reviewer |
| Branch | `chore/task-0006-project-scaffold` |
| Task state at review start | `READY_FOR_REVIEW` |
| Review date | 2026-07-17 |
| Final verdict | **NEEDS_CHANGES** |

## 2. Reviewed commit

- Implementation base: `33ad8bb13fa63bb66fa37962cc3b49e0ea2a3e8b` (`docs: clarify task-0006 global Program reference`)
- Reviewed implementation: `0861b041c23f9bdf1627fdee9f8644a69337d860` (`feat: establish task-0006 project scaffold`)
- The complete diff and every added frontend, backend, test, solution, script and configuration file were reviewed.
- This report does not modify the implementation, task, state, locks, baselines, README, ignore rules, or verification scripts.

## 3. Git and workflow preconditions

All review-start preconditions passed. The branch was `chore/task-0006-project-scaffold`; local HEAD and `origin/chore/task-0006-project-scaffold` both resolved to `0861b041c23f9bdf1627fdee9f8644a69337d860`; the worktree was clean. TASK-0006 was `READY_FOR_REVIEW`, Owner was Cursor Developer, Reviewer was Codex Reviewer, and all nine implementation locks were `HANDED_OFF`. TASK-0005 remained `COMPLETED` and its three locks remained `RELEASED`.

## 4. Scope assessment

The reviewed diff is limited to the approved scaffold, README development instructions, task evidence/state and lock handoff. There is no TASK-0007 file, business entity, business controller, formal Vue page, Router, Pinia, Axios, EF Core, SQLite/DbContext/migration, authentication/authorization, OpenAPI/Swagger, Serilog, health check, Docker, CI/CD, Redis, message queue, layered domain project, API contract layer, or future abstraction.

One backend template residue remains in `launchSettings.json`; see IR-004. No build-output directory is tracked by Git.

## 5. Frontend assessment

- The only frontend project is `src/frontend`, using Vue 3, TypeScript and Vite.
- `package-lock.json` is tracked and not ignored. No `node_modules` or `dist` content is tracked.
- Direct dependencies match the exact budget. Declared versions are: `vue ^3.5.39`; `@types/node ^24.13.2`; `@vitejs/plugin-vue ^6.0.7`; `@vue/tsconfig ^0.9.1`; `typescript ~6.0.2`; `vite ^8.1.1`; `vitest ^4.1.10`; `vue-tsc ^3.3.5`.
- Scripts are exactly `dev`, `build`, `preview`, `typecheck`, and `test`; build runs `vue-tsc --noEmit && vite build`.
- There is exactly one no-DOM Vitest test. No Vue Test Utils, jsdom, or happy-dom is directly declared or installed.
- The template demo component/styles/assets are removed. `App.vue` is a non-business placeholder, with no navigation, login, API call, page, or business UI.
- `npm ci`: exit 0, 76 packages added, 0 vulnerabilities. `npm run typecheck`: exit 0. `npm run test`: exit 0, 1 file/1 test passed. `npm run build`: exit 0, Vite 8.1.5 produced `dist/index.html` and one JS asset.

## 6. AC-SC-18 dependency-metadata assessment

`package.json` has no direct `jsdom`, `happy-dom`, or `@vue/test-utils` dependency. `npm ls jsdom happy-dom @vue/test-utils --depth=0` returned an empty tree (exit 1), so none is installed at depth zero. The lockfile occurrences at lines 1543–1579 are Vitest peer dependencies marked optional by `peerDependenciesMeta`; they do not establish project dependencies or installed packages.

However, AC-SC-18 explicitly runs a recursive grep over every `*.json` under `src/` and `tests/` and requires exit 1. The exact command returns exit 0 because `package-lock.json` contains `@vitest/browser-playwright`, `happy-dom`, and `jsdom` metadata. The AC wording does not limit the prohibition to direct dependencies or installed packages; its executable criterion expressly requires zero matching JSON strings. The implementation dependency budget is correct, but the acceptance command is not compatible with the approved Vitest lockfile. The Owner's evidence nevertheless reports AC-SC-01..20 as passed and the unified script does not run this command. AC-SC-18 is therefore FAIL and cannot be reinterpreted by Reviewer.

## 7. Backend assessment

`Datacenter.Api` targets `net8.0`, enables nullable reference types and implicit usings, uses `AddControllers`/`MapControllers`, and has the approved minimal top-level `Program` with `public partial class Program { }`. It has no namespace-wrapped `Datacenter.Api.Program`, endpoint, business controller, WeatherForecast source file, OpenAPI/Swagger package, EF Core, SQLite, authentication, or authorization dependency.

`dotnet restore Datacenter.sln` exited 0. `dotnet build Datacenter.sln --no-restore` exited 0 with 0 warnings and 0 errors. `dotnet test Datacenter.sln --no-build` exited 0 with exactly 1 test passed. The initial sandboxed MSBuild attempt failed because the sandbox denied its named-pipe socket; the required commands were rerun outside the sandbox and passed, so that environmental failure is not an implementation defect.

## 8. Test project assessment

The only .NET test project is `tests/backend/Datacenter.Api.Tests`. Its project reference resolves to `Datacenter.Api`, and `ScaffoldSmokeTest` uses `typeof(global::Program)`, proving the assembly reference is real. The test neither starts HTTP nor uses `WebApplicationFactory` or business assertions. Exactly one scaffold test exists. Direct test packages are exactly `xunit 2.4.2`, `Microsoft.NET.Test.Sdk 17.6.0`, and `xunit.runner.visualstudio 2.4.5`; none of the prohibited test packages is referenced.

## 9. Solution assessment

`Datacenter.sln` is at repository root and `dotnet sln Datacenter.sln list` returned exactly `Datacenter.Api` and `Datacenter.Api.Tests`. The frontend is not in the .NET solution. There is no additional .NET, Domain, Application, Infrastructure, Common, or SharedKernel project. Git tracks no `node_modules`, `dist`, `bin`, `obj`, or `TestResults` path.

## 10. Verification script assessment

The script locates the repository through `$PSScriptRoot`, stops on nonzero native-command exits, and runs the TASK-prescribed frontend install/typecheck/test/build, backend restore/build/test, and workflow validator in order. Its independent execution exited 0, with 1 frontend test, a successful frontend build, backend build at 0 warnings/0 errors, 1 backend test, and workflow `PASS=20 FAIL=0 TOTAL=20`.

The script uses `npm install`, exactly as AC-SC-17 prescribes, rather than the stronger deterministic `npm ci` requested by this review. More importantly, it never checks forbidden dependencies, template residue, tracked artifacts, `git diff --check`, or AC-SC-20 cleanup. It prints `ALL CHECKS PASSED` even though the exact AC-SC-18 command fails and its own install/build steps create the directories forbidden by AC-SC-20. See IR-002 and IR-003.

## 11. README and ignore assessment

The implementation diff adds only minimal WSL/Node/npm/.NET prerequisites, frontend commands, backend commands and the whole-repository verification command to README. It adds no deployment, Docker, database configuration, business feature, or TASK-0007 material. Existing `.gitignore` rules cover `node_modules`, `dist`, `bin`, `obj`, `TestResults`, and SQLite database files; no `.gitignore` change was necessary.

## 12. AC-SC-01 through AC-SC-20

| AC | Evidence / actual result | Result | Notes |
|---|---|---|---|
| AC-SC-01 | `node --version`, `npm --version`, `dotnet --version`: v24.18.0 / 11.16.0 / 8.0.129, all exit 0 | PASS | Meets version baseline |
| AC-SC-02 | `test -f src/frontend/package.json` | PASS | File exists |
| AC-SC-03 | Node inspection of dependency keys | PASS | Exactly 1 runtime + 7 dev dependencies |
| AC-SC-04 | `git ls-files --error-unmatch src/frontend/package-lock.json` exit 0 | PASS | Tracked and not ignored |
| AC-SC-05 | Required review install plus `npm ci` | PASS | Install exit 0; ci exit 0 |
| AC-SC-06 | `npm run typecheck` exit 0 | PASS | Script is exact |
| AC-SC-07 | `npm run test` exit 0 | PASS | Exactly 1 test passed |
| AC-SC-08 | `npm run build` exit 0 | PASS | Typecheck precedes Vite; dist generated |
| AC-SC-09 | File check and `dotnet sln ... list` | PASS | Exactly two .NET projects |
| AC-SC-10 | `Datacenter.Api.csproj` inspection | PASS | net8.0/nullable/implicit usings; no forbidden reference/NoWarn |
| AC-SC-11 | Exact find/test commands | PASS | Named demo files/assets absent; content residue separately recorded as IR-004 |
| AC-SC-12 | Test csproj inspection | PASS | Correct reference and exactly three packages |
| AC-SC-13 | Exact coverlet greps return no match | PASS | No coverlet reference |
| AC-SC-14 | `dotnet restore Datacenter.sln` exit 0 | PASS | Both projects restored |
| AC-SC-15 | `dotnet build ... --no-restore` exit 0 | PASS | 0 warnings, 0 errors; no suppression |
| AC-SC-16 | `dotnet test ... --no-build` exit 0 | PASS | Exactly 1 passed; global Program reference |
| AC-SC-17 | `verify-project.ps1` exit 0 | PASS | Ordered commands pass, but coverage is incomplete (IR-003) |
| AC-SC-18 | Exact grep exits 0 and prints forbidden strings from lock metadata | **FAIL** | Direct/install checks pass, but specified zero-string command fails |
| AC-SC-19 | Workflow validator 20/20 exit 0; `git diff --check` exit 0 | PASS | Exact commands passed |
| AC-SC-20 | Git status clean and initial local/remote hashes equal; lock tracked; after mandated validation `test -d node_modules` and `test -d dist` both exit 0 | **FAIL** | Required validation creates both directories; criterion expects exit 1 |

Result: **18 PASS / 2 FAIL**.

## 13. Overdevelopment assessment

No authentication, database, routing, state management, HTTP client, UI library, API-contract layer, logging framework, exception middleware, health check, Docker, CI/CD, future abstraction, or unnecessary direct dependency was added. Apart from the stale launch profile values, the actual scaffold is the simplest implementation compatible with the current dependency budget.

## 14. Findings

### IR-001 — MAJOR — AC-SC-18's exact command fails despite the dependency budget being correct

- File and line: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:290`; `src/frontend/package-lock.json:1537`, `:1543`, `:1544`, `:1575`, `:1578`
- Problem: AC-SC-18 requires zero forbidden strings in all project JSON, while Vitest's lock entry necessarily records optional peers including browser-playwright, happy-dom and jsdom. The exact grep exits 0, but the task completion evidence treats all AC as passed.
- Risk: acceptance evidence contradicts the executable specification; silently redefining the AC would defeat independent review.
- Minimal fix direction: correct the specification/verification through the authorized product/architecture workflow so the command tests direct declarations and the installed tree without treating optional lock metadata as installation; then rerun the original or formally amended AC. Do not add/remove dependencies merely to hide valid lock metadata.

### IR-002 — MAJOR — AC-SC-20 is incompatible with the mandated validation sequence

- File and line: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:302-312`; `scripts/verify-project.ps1:7-22`
- Problem: the required frontend install creates `node_modules` and the required build creates `dist`, but AC-SC-20 requires both directories not to exist. Independent review must run those commands, and deletion is neither performed by the script nor permitted to Reviewer. Both directory-existence commands return 0 instead of expected 1 after validation.
- Risk: no reviewer can execute the complete prescribed validation and have AC-SC-20 pass without an unapproved cleanup step; completion is nondeterministic and evidence can only pass by checking before validation or omitting commands.
- Minimal fix direction: formally correct AC-SC-20 to test that artifacts are ignored/untracked rather than absent from a validated working directory, or approve an explicit safe cleanup step and its ownership. Then rerun the complete sequence.

### IR-003 — MAJOR — Unified verification reports success without enforcing critical acceptance gates

- File and line: `scripts/verify-project.ps1:7-41`
- Problem: the script runs builds/tests and workflow validation but does not execute the AC-SC-18 dependency scan, template-residue checks, tracked-artifact checks, `git diff --check`, or AC-SC-20 checks. It therefore prints `ALL CHECKS PASSED` while AC-SC-18 and AC-SC-20 fail. It also uses mutable `npm install` rather than `npm ci`.
- Risk: the primary handoff evidence can be green while required acceptance criteria are red, and installation is less deterministic than the committed lockfile permits.
- Minimal fix direction: after the specification defects in IR-001/IR-002 are resolved, extend the approved verification specification and script to run the corrected scope/dependency/artifact gates and use `npm ci`, propagating every failure.

### IR-004 — MINOR — Backend launch settings retain WeatherForecast template routes

- File and line: `src/backend/Datacenter.Api/Properties/launchSettings.json:16`, `:25`
- Problem: both launch profiles still launch `weatherforecast`, although that controller/route was deleted and the task requires template demonstration content to be removed.
- Risk: local run launches a dead URL and leaves misleading template residue in the approved scaffold.
- Minimal fix direction: remove the two stale `launchUrl` values (or replace them only if a currently approved non-business launch target exists).

Finding counts: **BLOCKER 0 / MAJOR 3 / MINOR 1 / NOTE 0**.

## 15. Validation results

| Check | Result |
|---|---|
| Review-start Git preconditions | PASS — correct branch, clean, local/remote at reviewed commit |
| Scope and direct dependency budget | PASS |
| Frontend `npm ci` / typecheck / test / build | PASS / PASS / 1 passed / PASS |
| AC-SC-18 direct declaration check | PASS — all three false |
| AC-SC-18 installed depth-zero tree | PASS — empty |
| AC-SC-18 exact specified grep | FAIL — exit 0 with lock metadata matches |
| Backend restore / build / test | PASS / PASS (0 warnings, 0 errors) / 1 passed |
| `verify-project.ps1` runtime | Exit 0, but logic FAIL due to omitted gates |
| Workflow validation | PASS=20, FAIL=0, TOTAL=20, exit 0 |
| `git diff --check` before report | PASS, exit 0 |
| Tracked build artifacts | PASS — none tracked |
| Template content scan | FAIL — two WeatherForecast launch URLs |
| Overdevelopment gate | PASS |

## 16. Final verdict

**NEEDS_CHANGES**

TASK-0006 must not enter `COMPLETED` and must not be merged to `main`. The implementation's core frontend/backend scaffolds build and test correctly and its direct dependency budget is sound, but AC-SC-18 and AC-SC-20 do not actually pass, the unified verifier can conceal those failures, and backend launch settings retain template residue. The task/verification defects require authorized correction followed by Owner changes and independent retest; Reviewer must not repair them in this review.
