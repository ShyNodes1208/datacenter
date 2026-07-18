# TASK-0006 Project Scaffold — RETEST-5 Independent Final Retest

## 1. Review metadata

| Field | Value |
|---|---|
| Task | TASK-0006 — MVP project scaffold |
| Review type | RETEST-5 independent final retest, limited to RV-001 / R4-001 |
| Owner / fixer | Cursor Developer |
| Reviewer | Codex Reviewer |
| Branch | `chore/task-0006-project-scaffold` |
| Previous review commit | `497df48622a06681683292366eb605f4fdeb9de5` |
| Reviewed fix commit | `d308d09e121aae5d5036e1a1f75892f2954c4cf4` |
| Review date | 2026-07-18 |
| Final verdict | **PASS** |

This review is limited to closing the remaining RV-001/R4-001 Coverlet gate finding and the directly required regression. This report is the only Reviewer-authored repository change. The Reviewer did not change the task specification, state pointer, locks, verifier, implementation, tests, dependencies, scaffold, baselines, or prior reports.

## 2. Preconditions and fix scope

The review started on a clean `chore/task-0006-project-scaffold` worktree. Both `HEAD` and `origin/chore/task-0006-project-scaffold` resolved to `d308d09e121aae5d5036e1a1f75892f2954c4cf4`.

The Reviewer completely read `AGENTS.md`, the authoritative Agent workflow, current-task pointer, module locks, TASK-0006 specification, RETEST-4, the preceding Coverlet/AC-SC-13/AC-SC-17 review history, CR-0004, and the complete verifier. The complete `497df48..d308d09` diff was reviewed.

The range changes exactly:

- `scripts/verify-project.ps1`
- `tasks/MODULE-LOCKS.md`
- `tasks/TASK-0006-PROJECT-SCAFFOLD.md`
- `tasks/current-task.md`

The verifier change is limited to gate 9. There is no business source, test source, dependency manifest/lock, scaffold structure, solution, README, product baseline, architecture baseline, TASK-0007, or later-task change. Range `git diff --check` exited `0` with no output.

## 3. Semantic alignment — PASS

AC-SC-13, AC-SC-17 gate 9, and `scripts/verify-project.ps1` gate 9 now share the same authoritative target:

- exact project: `tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`;
- elements: `PackageReference` only;
- attributes: both `Include` and `Update`;
- forbidden value: exact `coverlet.collector`, compared case-insensitively;
- implementation: Python `xml.etree.ElementTree` structured XML parsing;
- success: forbidden reference absent and exit `0`;
- failure: forbidden reference found, missing csproj, or malformed XML and nonzero exit.

No wildcard such as `tests/**/*.csproj` is used. No Markdown, log, test data, snapshot, `TestResults`, DLL, PDB, `bin`, `obj`, or other non-csproj file is inspected by gate 9.

AC-SC-13 Part A is explicitly authoritative. Part B remains a supplemental case-insensitive grep of only the exact approved csproj for the exact package name; it does not expand scope or override Part A.

## 4. Current repository validation

### 4.1 AC-SC-13 Part A

The exact structured Python heredoc in the current task specification was run from the repository root.

- stdout:

```text
PackageReferences: Microsoft.NET.Test.Sdk, xunit, xunit.runner.visualstudio
coverlet.collector PackageReference: absent
```

- stderr: empty
- exit code: `0`
- result: **PASS**

### 4.2 AC-SC-13 Part B

```bash
grep -ni "coverlet.collector" \
  tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj
```

- stdout: empty
- stderr: empty
- exit code: `1`
- result: **PASS** as the specified supplemental no-match result

## 5. Formal verifier

Required command:

```powershell
pwsh -NoLogo -NoProfile -File ./scripts/verify-project.ps1
```

The first sandboxed run reached and passed gate 9 but later returned `1` at PowerShell-launched `dotnet restore`; direct `dotnet restore Datacenter.sln` immediately returned `0` and reported all projects up to date, identifying an execution-sandbox restriction rather than a repository failure. Per sandbox procedure, the exact verifier command was rerun in the approved execution environment.

The authoritative rerun produced gate 9 output:

```text
=== coverlet.collector PackageReference absent ===
PackageReferences: Microsoft.NET.Test.Sdk, xunit, xunit.runner.visualstudio
coverlet.collector PackageReference: absent
=== Solution project list ===
```

It then completed frontend/backend build and tests, reported one backend test passed, ran workflow validation with `PASS=20 FAIL=0 TOTAL=20`, and ended with:

```text
=== ALL CHECKS PASSED ===
```

- stderr: empty
- total exit code: `0`
- result: **PASS**

The PowerShell implementation pipes the Python program to `python3`, reads `$LASTEXITCODE` immediately, and calls `Assert-ExitZero`. The dedicated propagation tests below independently confirm that Python failures remain nonzero through PowerShell.

## 6. Repository-external fixture matrix

All fixtures were created below `/tmp/task0006-retest5.jegP9z`, outside the repository. No fixture was staged or committed.

| Fixture | Expected | stdout summary | stderr summary | Exit | Result |
|---|---|---|---|---:|---|
| Harmless `README.md`, `log.txt`, and `TestResults/result.txt` contain Coverlet text beside an unchanged copied csproj | PASS | Three allowed references; `coverlet.collector PackageReference: absent` | Empty | 0 | PASS; unrelated files ignored |
| Copied csproj with `PackageReference Include="coverlet.collector"` | FAIL | Includes forbidden name | `Forbidden PackageReference found: coverlet.collector` | 1 | PASS |
| Copied csproj with `PackageReference Update="Coverlet.Collector"` | FAIL | Includes mixed-case forbidden name | Same forbidden-reference message | 1 | PASS; Update and case-insensitive comparison confirmed |
| Nonexistent csproj path | FAIL | Empty | `FileNotFoundError` traceback | 1 | PASS |
| Malformed csproj | FAIL | Empty | `ElementTree.ParseError` traceback | 1 | PASS |

The equivalent PowerShell-to-Python propagation harness produced overall exits `0 / 1 / 1 / 1 / 1` for harmless / Include / Update / missing / malformed. Its stdout recorded `PYTHON_EXIT=0 / 1 / 1 / 1 / 1`; no failing Python case was converted to PASS.

## 7. Old recursive command audit

Current active gate 9 contains no `grep -r` or `grep -ri` against `tests/`. The exact old commands occur only in:

- historical review/retest evidence;
- CR-0004's original-problem and abolished-command sections;
- TASK-0006's explicit abolished-command note.

TASK-0006 step 14 retains a single exact-file implementation-time grep, and AC-SC-13 Part B retains a single exact-file supplemental grep. Neither recursively scans the test directory. The verifier's separate gate 8 grep uses `--include="*.csproj"` for the approved backend dependency whitelist; gate 9 itself is the exact structured project-only check.

Result: **PASS** — no old recursive test-tree Coverlet command remains active.

## 8. Workflow and module locks

The ordered handoff record contains:

1. Codex Reviewer: `READY_FOR_RETEST → CHANGES_REQUESTED`, with RETEST-4/R4-001 evidence.
2. Cursor Developer: `CHANGES_REQUESTED → IN_FIX`, reclaiming the verifier and three task/lock documents with the exact R4-001 scope.
3. Cursor Developer: `IN_FIX → READY_FOR_RETEST`, handing the structured gate and regression evidence to Codex Reviewer.

Both task pointers state `READY_FOR_RETEST`. All nine active Cursor Developer locks are `HANDED_OFF`; the verifier and three changed task/lock paths show their R4-001 IN_FIX re-claim and handoff. Cursor Developer is the current Owner and is distinct from Codex Reviewer.

TASK-0006 is not `COMPLETED`; active locks are not released; TASK-0007 was not started; and main was not merged. Reviewer can formally receive the retest.

Result: **PASS**.

## 9. Minimum regression

| Check | Result |
|---|---|
| `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` | `PASS=20 FAIL=0 TOTAL=20`, stderr empty, exit `0` — PASS |
| `git diff --check` | stdout/stderr empty, exit `0` — PASS |
| `git diff --check 497df48..d308d09` | Empty output, exit `0` — PASS |
| Formal `verify-project.ps1` approved-environment rerun | `ALL CHECKS PASSED`, exit `0` — PASS |
| Business code/tests/dependencies/scaffold/baselines | No changes — PASS |
| TASK-0007 | Not started — PASS |
| Review-start worktree and local/remote hash | Clean and identical — PASS |

No unapproved dependency, abstraction, feature, API/data-model change, baseline change, or future-task implementation was introduced. The gate replacement is the minimum implementation traceable to R4-001.

## 10. Findings and verdict

RV-001 / R4-001 is **CLOSED**.

Finding counts: **BLOCKER 0 / MAJOR 0 / MINOR 0 / NOTE 0**.

Final verdict: **PASS**.

This PASS authorizes entry into TASK-0006's formal close workflow. It does not itself change the task to `COMPLETED`, release locks, or merge main. After TASK-0006 is formally closed, the project may perform the main-merge gate checks. TASK-0007 preparation is permitted only after TASK-0006 has been formally closed and merged to main, as required by the stated sequencing constraint.
