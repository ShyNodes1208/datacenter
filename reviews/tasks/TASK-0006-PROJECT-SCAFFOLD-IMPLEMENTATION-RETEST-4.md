# TASK-0006 Project Scaffold — RETEST-4 Independent Final Retest

## 1. Review metadata

| Field | Value |
|---|---|
| Task | TASK-0006 — MVP project scaffold |
| Review type | RETEST-4 independent final retest, limited to RV-001 and RV-002 |
| Owner / fixer | Cursor Developer |
| Reviewer | Codex Reviewer |
| Branch | `chore/task-0006-project-scaffold` |
| Previous review commit | `b3a4ea4c6acb5aa884f85efd8f225c910329198e` |
| Reviewed fix commit | `bde16caaf5904c8ee95f525acb31a909efbed48c` |
| Review date | 2026-07-18 |
| Final verdict | **NEEDS_CHANGES** |

This retest is limited to RV-001, RV-002, and the minimum regression directly related to those fixes. This report is the only Reviewer-authored file; no specification, state pointer, lock, script, implementation, test, dependency, scaffold, baseline, or prior report was modified.

## 2. Preconditions and reviewed scope

At review start, `git status --short --branch` showed a clean `chore/task-0006-project-scaffold` tracking its origin without ahead/behind markers. Both local HEAD and `origin/chore/task-0006-project-scaffold` resolved to `bde16caaf5904c8ee95f525acb31a909efbed48c`.

The Reviewer completely read `AGENTS.md`, the authoritative Agent workflow, `tasks/current-task.md`, `tasks/MODULE-LOCKS.md`, the TASK-0006 specification, RETEST-3, the prior RT-003 retest, CR-0004, and the Coverlet/state-transition portions of the preceding TASK-0006 review history. The complete `b3a4ea4..bde16ca` diff was reviewed.

The reviewed range changes only:

- `tasks/TASK-0006-PROJECT-SCAFFOLD.md`
- `tasks/current-task.md`
- `tasks/MODULE-LOCKS.md`

`git diff --check b3a4ea4..bde16ca` exited `0`. Source, tests, scripts, solution, README, ignore rules, dependency manifests/locks, and product/architecture baselines are identical across the range. No TASK-0007 or later task artifact was added or changed.

## 3. RV-001 retest — OPEN

### 3.1 Authoritative target

AC-SC-13 lines 250-307 and approved CR-0004 define the target as absence of a direct `coverlet.collector` PackageReference in the test project dependency declaration. AC-SC-13 Part A is explicitly the authoritative structured XML evidence. Part B is a supplemental exact-file, exact-package-name grep. CR-0004 expressly says the corrected validation checks dependency declaration files and does not scan `TestResults` or other generated/unrelated content.

The target is therefore not “the word `coverlet` must never occur anywhere below `tests/`.”

### 3.2 Actual commands and results

#### AC-SC-13 Part A — structured XML authority

The exact Python heredoc from AC-SC-13 was run.

- stdout:

```text
PackageReferences: Microsoft.NET.Test.Sdk, xunit, xunit.runner.visualstudio
coverlet.collector PackageReference: absent
```

- stderr: empty
- exit code: `0`
- interpretation: **PASS**; the only approved test project declares exactly the three allowed packages and not `coverlet.collector`.

#### AC-SC-13 Part B — supplemental exact csproj grep

```bash
grep -ni "coverlet.collector" \
  tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj
```

- stdout: empty
- stderr: empty
- exit code: `1`
- interpretation: **PASS**; no case-insensitive exact forbidden package text appears in the csproj.

Part A parses XML and catches case variants in an `Include` value. Part B is case-insensitive and supplements Part A by checking the exact csproj text. Together they cover the approved PackageReference target without scanning unrelated files.

#### AC-SC-17 gate 9 and the actual verifier gate

```bash
grep -ri "coverlet" --exclude-dir=bin --exclude-dir=obj tests/
```

- stdout: empty
- stderr: empty
- exit code: `1`
- immediate repository result: no current match
- semantic interpretation: **FAIL as a corrected acceptance method**; this particular clean-tree result does not make its search scope consistent with AC-SC-13.

The same command is the actual gate at `scripts/verify-project.ps1:161`. The script's preceding formal csproj dependency command was also executed:

```bash
grep -ri "EntityFrameworkCore\|SQLite\|Swashbuckle\|Microsoft.AspNetCore.OpenApi\|coverlet\|FluentAssertions\|Moq\|NSubstitute\|Microsoft.AspNetCore.Mvc.Testing" \
  --include="*.csproj" src/backend/ tests/backend/
```

- stdout: empty
- stderr: empty
- exit code: `1`
- interpretation: **PASS**; the maintained csproj scope contains none of the forbidden package texts.

### 3.3 Scope-risk proof

Gate 9 excludes only directories named `bin` and `obj`. It still recursively scans Markdown, text explanations, source comments, test data, snapshots, logs, coverage artifacts, `TestResults`, and any other file below `tests/`. Its specification text simultaneously claims it checks “only project source files” and forbids scanning `TestResults`, but the command has no file include filter and no `--exclude-dir=TestResults`.

A repository-external temporary fixture using the exact gate options contained harmless `tests/TestResults/coverage.log` and `tests/docs/readme.md` mentions, plus excluded `bin`/`obj` mentions. The command emitted:

```text
tests/TestResults/coverage.log:coverage produced by coverlet tooling
tests/docs/readme.md:coverlet is intentionally not a project dependency
```

It exited `0` with empty stderr. This proves the gate rejects harmless text outside dependency declarations while correctly excluding only `bin`/`obj`. It can therefore recreate RT-003's semantic false-positive class even though the current repository happens to return `1`.

The current command is case-insensitive, so case variants do not create a miss. However, its broad word search is not a structured PackageReference test; correctness for XML attribute formatting comes from Part A and the csproj checks, not from recursively searching every test-tree file. Making this broad recursive scan an additional mandatory zero-match gate contradicts the authoritative narrower target rather than usefully supplementing it.

RV-001 remains **OPEN**.

## 4. RV-002 retest — CLOSED

The authoritative transition table allows both `CHANGES_REQUESTED → IN_FIX` and `IN_FIX → READY_FOR_RETEST`.

TASK-0006's ordered handoff table now records:

1. Codex Reviewer: `READY_FOR_RETEST → CHANGES_REQUESTED`, with RETEST-3 commit/report, RV-001/RV-002, severity counts, and fix direction.
2. Cursor Developer: `CHANGES_REQUESTED → IN_FIX`, with the three documentation paths reclaimed as `CLAIMED`, the exact RV-001/RV-002 scope, and the explicit no-code/test/dependency/baseline constraint.
3. Cursor Developer: `IN_FIX → READY_FOR_RETEST`, handed to Codex Reviewer with the asserted fixes, Coverlet evidence, workflow result, and the three locks returned to `HANDED_OFF`.

The row order and the fix commit's recorded date provide sequence evidence; each row includes actor, old/new state, repair basis, and Reviewer handoff where applicable. Cursor Developer is the current Owner, is allowed to perform the documentation fix, and remains distinct from Codex Reviewer.

Both `tasks/TASK-0006-PROJECT-SCAFFOLD.md` and `tasks/current-task.md` state `READY_FOR_RETEST`. All nine active Cursor Developer locks are `HANDED_OFF`; the three paths modified in this fix show their IN_FIX re-claim and are handed off. The older three released Product Manager specification locks remain historical records and do not conflict with the nine active implementation locks.

TASK-0006 is not `COMPLETED`; no active implementation lock was released; no TASK-0007 work began; and no main merge occurred. RV-002 is **CLOSED**.

## 5. Minimum regression

| Check | Result |
|---|---|
| Workflow validator | `SUMMARY PASS=20 FAIL=0 TOTAL=20`; stderr empty; exit `0`; PASS |
| `git diff --check` | stdout/stderr empty; exit `0`; PASS |
| Range `git diff --check b3a4ea4..bde16ca` | Empty output; exit `0`; PASS |
| Coverlet structured/exact csproj checks | Stable PASS: exits `0`, `1`, and `1` as documented above |
| Gate 9 current-tree execution | Exit `1`, but method-level FAIL because scope remains overbroad |
| Existing verifier PowerShell syntax | `verify-project.ps1 syntax: valid`; stderr empty; exit `0` |
| Code/tests/dependencies/scaffold/baselines | No diff across reviewed range |
| TASK-0007 | Not started or modified |

The full `verify-project.ps1` was not run because this review is explicitly prohibited from installing dependencies and the script performs `npm ci`. Its PowerShell syntax and both formal Coverlet-related native gates were independently executed/validated. The script itself is unchanged in the reviewed range.

## 6. Finding

### R4-001 — MAJOR — Gate 9 still recursively scans unrelated test-tree content

- File and line: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:342`; implemented unchanged at `scripts/verify-project.ps1:158-162`
- Problem: the revised text says gate 9 follows AC-SC-13, checks only project source, and must not scan `TestResults`, yet the specified/implemented command recursively searches every file under `tests/` except directories named `bin` and `obj`. It therefore includes Markdown, text, source comments, test data, snapshots, logs, `TestResults`, and other non-dependency content. AC-SC-13 and CR-0004 instead make the structured csproj PackageReference check authoritative and the exact csproj grep supplemental.
- Risk: harmless documentation, logs, coverage output, or test data containing the word `coverlet` makes AC-SC-17 fail despite no forbidden PackageReference. This preserves the false-positive class RV-001 was meant to close and leaves AC-SC-13, AC-SC-17, and the verifier semantically inconsistent.
- Minimum fix direction: make gate 9 invoke or faithfully implement the AC-SC-13 structured test-project PackageReference check, optionally retaining the exact `coverlet.collector` grep scoped only to the approved csproj. Remove the broad recursive `tests/` word scan as a mandatory dependency gate. If the script must change, use the normal non-Reviewer `IN_FIX → READY_FOR_RETEST` handoff and do not alter dependencies or implementation beyond this gate.

Finding counts: **BLOCKER 0 / MAJOR 1 / MINOR 0 / NOTE 0**.

## 7. Final verdict

**NEEDS_CHANGES**

RV-002 is accurately and completely closed. RV-001 is not: adding `--exclude-dir=bin --exclude-dir=obj` removes the original binary-output trigger but does not align the recursive scan with the authoritative PackageReference-only target and explicitly fails to exclude `TestResults` as claimed.

TASK-0006 must remain open. This report does not authorize the formal close process, module-lock release, a main merge, or preparation/start of TASK-0007.
