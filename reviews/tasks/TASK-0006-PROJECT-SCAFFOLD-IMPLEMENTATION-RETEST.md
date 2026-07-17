# TASK-0006 Project Scaffold Implementation Retest

## 1. Review metadata

| Field | Value |
|---|---|
| Task | TASK-0006 — MVP project scaffold |
| Review type | Independent implementation retest |
| Owner | Cursor Developer |
| Reviewer | Codex Reviewer |
| Branch | `chore/task-0006-project-scaffold` |
| State at retest start | `READY_FOR_RETEST` |
| Review date | 2026-07-18 |
| Final verdict | **NEEDS_CHANGES** |

## 2. Reviewed commits

- First implementation: `0861b041c23f9bdf1627fdee9f8644a69337d860`
- First implementation review: `d6d8455d630dd1a2c3f91b97e3b40a7cc5ec9abb` — NEEDS_CHANGES
- Approved gate correction: `e8e2c3011d4695508ab3ce3939071d014edf1ad2`
- Retested fix: `1bfcc54d2e5143c50fa86dcb8645e0b151aa62c4`

The complete `e8e2c30..1bfcc54` diff and all required source, configuration, task, CR, baseline, workflow, lock, review, dependency, project and test files were reviewed. The four original findings were extracted as follows:

| Finding | Original problem | Original risk | Original minimum direction |
|---|---|---|---|
| IR-001 | AC-SC-18 scanned normal Vitest optional peer metadata in `package-lock.json` and failed despite a correct dependency budget | Executable evidence contradicted the claimed PASS and could be silently reinterpreted | Formally correct validation to check direct declarations, installed tree and active references without altering lock metadata |
| IR-002 | AC-SC-20 required generated directories to be absent after commands that create them | Full validation could not deterministically pass without unapproved cleanup | Check ignored/untracked artifacts, or approve an explicit cleanup step |
| IR-003 | Unified verification omitted critical gates and still printed `ALL CHECKS PASSED` | Primary handoff evidence could be green while ACs were red | Add all approved gates, deterministic install and reliable failure propagation |
| IR-004 | Two launch profiles retained `weatherforecast` | Local run opened a dead template URL and preserved misleading residue | Remove both stale launch URL values without adding another endpoint |

## 3. Git and workflow preconditions

All mandatory preconditions passed: branch was `chore/task-0006-project-scaffold`; HEAD and remote both resolved to `1bfcc54d2e5143c50fa86dcb8645e0b151aa62c4`; the worktree was clean; state was `READY_FOR_RETEST`; Owner and Reviewer were correct; all nine TASK-0006 implementation locks were `HANDED_OFF`; TASK-0005 remained `COMPLETED` with all three locks `RELEASED`.

## 4. Fix scope assessment

The fix commit modifies only `scripts/verify-project.ps1`, `src/backend/Datacenter.Api/Properties/launchSettings.json`, `tasks/TASK-0006-PROJECT-SCAFFOLD.md`, and `tasks/current-task.md`. It adds no dependency, scaffold regeneration, product/architecture baseline change, TASK-0007 file, business code, database/authentication feature, Router/Pinia/Axios, Docker, CI/CD, or modification to the first implementation review. Dependency and project files are unchanged from the first implementation.

## 5. IR-001 retest — CLOSED

- Layer A: exit 0; `dependencies=vue`; approved seven dev dependencies; `forbiddenDirect=` empty.
- Layer B after `npm ci`: all three `test ! -d` checks passed.
- Layer C: scoped grep returned exit 1 with no active source/config reference.
- `verify-project.ps1` performs the whitelist and all A/B/C checks and excludes `package-lock.json`.
- The valid lockfile remains tracked and unchanged; no metadata was removed or falsified.

## 6. IR-002 retest — CLOSED

`git ls-files | grep -E '(^|/)(node_modules|dist|bin|obj|TestResults)(/|$)'` returned no output (grep exit 1). Local generated directories remained allowed. The script checks the Git index, does not reject filesystem presence, and performs no `git clean`, reset, restore, or build-directory deletion.

## 7. IR-003 retest — OPEN

The expanded script correctly uses `$ErrorActionPreference = "Stop"`, derives the repository root from `$PSScriptRoot`, checks all tools and the lockfile, uses `npm ci`, validates dependency/project whitelists, runs frontend and backend builds/tests with exact counts, checks solution membership, templates, Git tracking, `git diff --check`, and workflow 20/20. Its normal execution exited 0 and ended with `ALL CHECKS PASSED`.

The central `Invoke-Native` wrapper correctly propagated a controlled native exit 7: the safe external test exited 1, printed `VERIFICATION FAILED`, and did not print `ALL CHECKS PASSED`.

However, grep-based gates at lines 107, 130, 135, 200 and 205–208 do not distinguish the expected “no match” exit 1 from a grep execution error (exit 2). A safe repository-external reproduction of the same condition against a missing target produced `grepExit=2`, yet the gate returned 0 and printed `GATE_ACCEPTED`. The Git pipeline also checks only grep's final exit and can mask a failing `git ls-files`. Consequently, not every external command failure is propagated and a failed gate can still lead to `ALL CHECKS PASSED`. See RT-001.

## 8. IR-004 retest — OPEN

Both `weatherforecast` launch URL entries are removed. Case-insensitive grep returned exit 1; no Swagger, OpenAPI, health, or business endpoint replaced them; `applicationUrl` and environment variables remain.

The specified syntax command `python3 -m json.tool .../launchSettings.json >/dev/null` returned exit 1 because the file retains a UTF-8 BOM (`Unexpected UTF-8 BOM`). Thus the required JSON syntax validation does not pass. See RT-002.

## 9. Frontend verification

| Command | Exit/result |
|---|---|
| `npm ci` | 0; 76 packages installed; 0 vulnerabilities |
| `npm run typecheck` | 0 |
| `npm run test` | 0; exactly 1 file and 1 test passed |
| `npm run build` | 0; Vite 8.1.5 built `dist` successfully |
| AC-SC-05 `npm install` | 0; lock and declarations unchanged |

## 10. Backend verification

| Command | Exit/result |
|---|---|
| `dotnet restore Datacenter.sln` | 0 |
| `dotnet build Datacenter.sln --no-restore` | 0; 0 warnings, 0 errors |
| `dotnet test Datacenter.sln --no-build` | 0; exactly 1 test passed |

## 11. Solution verification

`dotnet sln Datacenter.sln list` exited 0 and listed exactly:

- `src/backend/Datacenter.Api/Datacenter.Api.csproj`
- `tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`

## 12. AC-SC-01 through AC-SC-20

| AC | Evidence and actual result | Result | Notes |
|---|---|---|---|
| AC-SC-01 | Node v24.18.0, npm 11.16.0, .NET 8.0.129 | PASS | All exit 0 |
| AC-SC-02 | `src/frontend/package.json` exists | PASS | Exact path |
| AC-SC-03 | Direct dependency whitelist | PASS | `vue` + exact seven dev dependencies |
| AC-SC-04 | Lockfile tracked and not ignored | PASS | `git ls-files` 0; `git check-ignore` 1 |
| AC-SC-05 | `npm install` | PASS | Exit 0 |
| AC-SC-06 | Typecheck | PASS | Exit 0; exact script |
| AC-SC-07 | Frontend test | PASS | Exactly 1 passed |
| AC-SC-08 | Frontend build | PASS | Exit 0; typecheck precedes Vite |
| AC-SC-09 | Solution existence/list | PASS | Exactly two approved projects |
| AC-SC-10 | API csproj inspection | PASS | net8.0, nullable, implicit usings; no package/NoWarn |
| AC-SC-11 | Exact template file/resource checks | PASS | All absent |
| AC-SC-12 | Test csproj/reference inspection | PASS | Correct reference and exact three packages |
| AC-SC-13 | Both source-only coverlet greps | PASS | Exit 1 |
| AC-SC-14 | Backend restore | PASS | Exit 0 |
| AC-SC-15 | Backend build | PASS | 0 warnings, 0 errors |
| AC-SC-16 | Backend test | PASS | Exactly 1 passed; global Program reference unchanged |
| AC-SC-17 | Unified script normal run plus negative logic audit | **FAIL** | Grep exit 2 and upstream Git failure can be masked (RT-001) |
| AC-SC-18 | Corrected A/B/C and backend checks | PASS | All layers pass; lock metadata excluded correctly |
| AC-SC-19 | Workflow validator and `git diff --check` | PASS | 20/20 and exit 0 |
| AC-SC-20 | Clean/equal precondition, tracked lock, no tracked artifacts | PASS | Generated local directories are permitted |

Result: **19 PASS / 1 FAIL**.

## 13. Regression and overdevelopment assessment

No frontend/backend/test regression was observed. Project-scope searches found no active WeatherForecast/HelloWorld/Counter/template asset, EF Core, SQLite, DbContext, migration, authentication, Router, Pinia, Axios, OpenAPI/Swagger, Docker, CI/CD, business controller/page, TASK-0007 artifact, or future abstraction. The expanded script uses only existing tools and no PowerShell module. Fix scope remains minimal and traceable.

## 14. Findings

### RT-001 — MAJOR — Grep and pipeline failures are accepted as successful negative gates

- File and line: `scripts/verify-project.ps1:107-113`, `:130-136`, `:200-208`
- Problem: conditions use `$LASTEXITCODE -ne 0` as success, so grep exit 2 is treated exactly like the expected no-match exit 1. The Git pipeline also does not independently validate `git ls-files` before grep.
- Risk: missing/unreadable targets, unavailable/broken grep, or a failed Git producer can bypass dependency, template, launch-settings, coverlet, or tracked-artifact gates; the script can still print `ALL CHECKS PASSED` after an external command failure.
- Minimum fix direction: require grep exit 1 specifically for no matches, fail on every other nonzero code, and capture/check `git ls-files` independently before filtering. Apply the same reliable tri-state handling to every grep gate and rerun safe negative tests.

### RT-002 — MINOR — Launch settings fail the required JSON syntax command

- File and line: `src/backend/Datacenter.Api/Properties/launchSettings.json:1`
- Problem: the file begins with a UTF-8 BOM, causing the specified `python3 -m json.tool` command to exit 1 with `Unexpected UTF-8 BOM`.
- Risk: the retest's required syntax evidence fails and tooling that expects BOM-free UTF-8 cannot parse this configuration, despite .NET-compatible content.
- Minimum fix direction: save the same JSON content as UTF-8 without BOM and rerun both `json.tool` and the zero-match weatherforecast check.

Finding counts: **BLOCKER 0 / MAJOR 1 / MINOR 1 / NOTE 0**.

## 15. Validation results

| Check | Result |
|---|---|
| IR-001 | CLOSED |
| IR-002 | CLOSED |
| IR-003 | OPEN — native wrapper works, grep/pipeline errors are masked |
| IR-004 | OPEN — strings removed, required JSON command fails |
| `verify-project.ps1` normal run | Exit 0; all displayed gates pass; ends `ALL CHECKS PASSED` |
| Safe negative wrapper test | PASS — native exit 7 becomes script exit 1; no success banner |
| Safe negative grep-gate test | FAIL — grep exit 2 is accepted with exit 0 |
| AC-SC-18 A/B/C | PASS / PASS / PASS |
| AC-SC-20 Git tracking | PASS — no tracked build artifact |
| Weatherforecast search | PASS — exit 1, zero matches |
| JSON tool | FAIL — exit 1 due to BOM |
| Frontend | PASS — typecheck/build and exactly 1 test |
| Backend | PASS — restore/build, 0 warnings/errors, exactly 1 test |
| Workflow | PASS=20, FAIL=0, TOTAL=20, exit 0 |
| `git diff --check` before report | PASS, exit 0 |
| Regression/overdevelopment | PASS |

## 16. Final verdict

**NEEDS_CHANGES**

IR-001 and IR-002 are genuinely closed, but IR-003 and IR-004 are not. AC-SC-17 fails because external grep/Git errors are not reliably propagated, and the required launch-settings JSON validation exits nonzero. TASK-0006 must remain open; this report does not authorize completion, lock release, main merge, or TASK-0007.
