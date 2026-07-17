# TASK-0006 Project Scaffold — Third Independent Implementation Retest

## 1. Review metadata

| Field | Value |
|---|---|
| Task | TASK-0006 — MVP project scaffold |
| Review type | Third independent implementation retest |
| Owner | Cursor Developer |
| Reviewer | Codex Reviewer |
| Branch | `chore/task-0006-project-scaffold` |
| State at retest start | `READY_FOR_RETEST` |
| Review date | 2026-07-18 |
| Final verdict | **NEEDS_CHANGES** |

## 2. Reviewed commits

- Previous retest report commit: `1124339dde025675e6fc45d7fb5aded47eb69917`
- Previous retest result record: `43cdebbb05c81e2677d177d3a183ff1dd563152d`
- Retested fix: `74ba6de9086a1d927079141da0357e933c8c75f9`
- This report is the only new file and does not modify implementation, task state, module locks, or previous reports.

The prior findings were: IR-001 and IR-002 closed; RT-001/IR-003 open because grep exit 2 and Git pipeline failures could be masked; RT-002/IR-004 open because the launch settings UTF-8 BOM made the required `json.tool` command fail.

## 3. Git and workflow preconditions

All preconditions passed. The current branch is `chore/task-0006-project-scaffold`; HEAD and `origin/chore/task-0006-project-scaffold` both resolve to `74ba6de9086a1d927079141da0357e933c8c75f9`; the review-start worktree was clean. TASK-0006 currently has `READY_FOR_RETEST` at the file top, Owner `Cursor Developer`, Reviewer `Codex Reviewer`, and all nine implementation locks are `HANDED_OFF`. TASK-0005 remains `COMPLETED` and its three locks remain `RELEASED`.

## 4. Fix scope

`43cdebb..74ba6de` changes only `scripts/verify-project.ps1`, `src/backend/Datacenter.Api/Properties/launchSettings.json`, `tasks/TASK-0006-PROJECT-SCAFFOLD.md`, and `tasks/current-task.md`. No dependency, scaffold, business code, TASK-0007, product/architecture baseline, Docker/CI, database/authentication, Router/Pinia/Axios, or existing review report changed. The BOM removal is a one-byte-format change; the two stale launch URLs remain deleted.

## 5. RT-001 / IR-003 retest

The new `Assert-GrepNoMatch` implements the required tri-state behavior: exit 0 is a match and fails, exit 1 is no match and passes, and exit 2+ is a grep execution error and fails. The Git artifact gate now captures `git ls-files` separately, checks its exit code, and only then filters its output. Normal native commands use `Invoke-Native`/`Assert-ExitZero`; the script catches failures and exits 1 before the success banner.

The safe negative suite passed without touching repository files:

| Case | Result |
|---|---|
| Native `sh -c "exit 7"` | `FAIL_PROPAGATED` |
| grep missing target (exit 2) | `FAIL_PROPAGATED` |
| grep empty directory (exit 1) | `PASS_NO_MATCH` |
| `git -C /tmp/task0006-not-a-repo ls-files` failure | `FAIL_PROPAGATED` |
| Negative suite final exit | 0; no `ALL CHECKS PASSED` emitted |

RT-001 is **CLOSED**. The normal verification script also exited 0 and ended with `ALL CHECKS PASSED` only after all displayed gates completed.

## 6. RT-002 / IR-004 retest

`launchSettings.json` now begins with bytes `7b0a20`; `has_bom=False` and the BOM check exited 0. `python3 -m json.tool ...` exited 0. Case-insensitive `weatherforecast` grep produced no output and exited 1. `applicationUrl` and both `ASPNETCORE_ENVIRONMENT=Development` values remain. No Swagger, OpenAPI, health or business URL was introduced. RT-002 is **CLOSED**.

## 7. Full `verify-project.ps1` result

`pwsh -NoLogo -NoProfile -File ./scripts/verify-project.ps1` exited 0. It executed environment checks, lockfile existence, `npm ci`, exact direct dependency whitelist, AC-SC-18 A/B/C, backend package/reference checks, solution membership, frontend typecheck/test/build, backend restore/build/test, template and launch settings checks, Git tracking, `git diff --check`, and workflow validation. Output reported one frontend test, one backend test, 0 build warnings/errors, `PASS=20 FAIL=0 TOTAL=20`, and finally `ALL CHECKS PASSED`.

Code review confirms the script does not merely rely on `$ErrorActionPreference`; it checks `$LASTEXITCODE` and uses the tri-state grep helper. It does not invoke `python3` because JSON syntax is a separate review/AC command, not one of the 20 approved verify gates.

## 8. Independent regression verification

Frontend `npm ci`, `npm run typecheck`, `npm run test`, and `npm run build` all exited 0; Vitest reported exactly 1 file and 1 test passed; Vite generated the build successfully.

Backend `dotnet restore Datacenter.sln`, `dotnet build Datacenter.sln --no-restore`, and `dotnet test Datacenter.sln --no-build` all exited 0. Build reported 0 warnings and 0 errors; the solution test run reported exactly 1 passed test. `dotnet sln Datacenter.sln list` listed only the two approved projects.

## 9. AC-SC-01 through AC-SC-20

| AC | Verification evidence | Result | Notes |
|---|---|---|---|
| AC-SC-01 | `node --version && npm --version && dotnet --version` → v24.18.0 / 11.16.0 / 8.0.129 | PASS | Exit 0 |
| AC-SC-02 | `test -f src/frontend/package.json` | PASS | Exists |
| AC-SC-03 | Node dependency whitelist | PASS | Exact `vue` + seven dev dependencies |
| AC-SC-04 | `git ls-files --error-unmatch src/frontend/package-lock.json` | PASS | Tracked, not ignored |
| AC-SC-05 | `npm install` | PASS | Exit 0 |
| AC-SC-06 | `npm run typecheck` | PASS | Exit 0 |
| AC-SC-07 | `npm run test` | PASS | Exactly 1 passed |
| AC-SC-08 | `npm run build` | PASS | Exit 0; typecheck precedes Vite |
| AC-SC-09 | Solution file and `dotnet sln ... list` | PASS | Exactly two projects |
| AC-SC-10 | API csproj | PASS | net8.0, nullable, implicit usings; no forbidden package/NoWarn |
| AC-SC-11 | Required template file/resource checks | PASS | No named residue |
| AC-SC-12 | Test csproj/reference | PASS | Exact three packages and API ProjectReference |
| AC-SC-13 | Exact `grep -ri "coverlet" tests/` after build | **FAIL** | Exit 0 because `bin/Debug/net8.0/Microsoft.TestPlatform.CrossPlatEngine.dll` contains the string; source csproj grep exits 1 |
| AC-SC-14 | `dotnet restore Datacenter.sln` | PASS | Exit 0 |
| AC-SC-15 | `dotnet build ... --no-restore` | PASS | 0 warnings, 0 errors |
| AC-SC-16 | `dotnet test ... --no-build` | PASS | Exactly 1 passed |
| AC-SC-17 | Full `verify-project.ps1` and failure-propagation audit | PASS | Exit 0; all revised gates and negative suite pass |
| AC-SC-18 | A/B/C direct/install/reference checks | PASS | No direct, top-level, or active reference; lock metadata excluded |
| AC-SC-19 | Workflow validator and `git diff --check` | PASS | 20/20 and exit 0 |
| AC-SC-20 | Git status/hash/lock/tracked-artifact checks | PASS | No generated artifact is Git-tracked |

Result: **19 PASS / 1 FAIL**.

AC-SC-13's exact command is not the source-only command used by the revised verifier; after the required build it recursively scans ignored binary output and fails. This is a specification/verification contradiction, not evidence of a declared `coverlet.collector` dependency. It nevertheless prevents an honest 20/20 PASS under the task's exact command.

## 10. Regression and overdevelopment assessment

No new direct dependency or project was introduced. Searches of the maintained project scope found no EF Core, SQLite, DbContext, migration, authentication, PasswordHasher, Antiforgery, Router, Pinia, Axios, Swagger/OpenAPI, Docker, CI/CD, TASK-0007, business controller, formal Vue page, or future abstraction. No first-generation scaffold behavior regressed.

## 11. Findings

### RT-003 — MAJOR — AC-SC-13 exact coverlet command fails after the mandated build

- File and line: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:250-254`; generated ignored output under `tests/backend/Datacenter.Api.Tests/bin/Debug/net8.0/`
- Problem: the exact required command `grep -ri "coverlet" tests/` returns exit 0 after build because `Microsoft.TestPlatform.CrossPlatEngine.dll` contains the string. The revised script intentionally excludes `bin`/`obj`, so its source-level gate passes, but that does not make the original AC command pass.
- Risk: the task cannot honestly satisfy all required validation commands after the required build; accepting the script result alone would silently change AC-SC-13 semantics and would confuse transitive/binary metadata with a project dependency.
- Minimum fix direction: obtain an authorized specification/verification correction that scopes AC-SC-13 to maintained project files (excluding generated `bin`/`obj`) or replaces it with a structured csproj/package check; then rerun the exact amended AC and independent retest. Do not add or remove dependencies to hide binary strings.

Finding counts: **BLOCKER 0 / MAJOR 1 / MINOR 0 / NOTE 0**.

## 12. Validation results

| Check | Result |
|---|---|
| RT-001 / IR-003 | CLOSED |
| RT-002 / IR-004 | CLOSED |
| `verify-project.ps1` | Exit 0; all implemented gates pass; success banner last |
| Native exit propagation | PASS |
| grep 0/1/2+ semantics | PASS |
| Git producer failure propagation | PASS |
| BOM check | PASS; `has_bom=False` |
| JSON tool | PASS; exit 0 |
| weatherforecast | PASS; zero matches, exit 1 |
| Frontend | PASS; typecheck/build, 1 test |
| Backend | PASS; restore/build/test, 0 warnings/errors, 1 test |
| Solution | PASS; exactly two projects |
| Workflow | PASS=20, FAIL=0, TOTAL=20 |
| `git diff --check` | PASS |
| AC total | **19 PASS / 1 FAIL** |
| Regression/overdevelopment | PASS |

## 13. Final verdict

**NEEDS_CHANGES**

RT-001 and RT-002 are genuinely closed, and the implementation hardening is otherwise correct. However, AC-SC-13's exact recursive command still fails after the required build because it scans generated binary output. TASK-0006 therefore does not meet the mandatory 20 PASS / 0 FAIL completion gate. This review does not authorize closing TASK-0006, releasing locks, merging `main`, or starting TASK-0007.
