# TASK-0006 Project Scaffold — RT-003 Specification Correction Retest

## 1. Review metadata

| Field | Value |
|---|---|
| Task | TASK-0006 — MVP project scaffold |
| Review type | Fourth independent retest, limited to RT-003 specification correction |
| Owner | Cursor Developer |
| Specification fixer | Claude + DeepSeek |
| Reviewer | Codex Reviewer |
| Branch | `chore/task-0006-project-scaffold` |
| Reviewed range | `2edbc2e9dc85bbb4955b1060e3306a6374a4ae67..33bb53aef1f958fdf948d1c942e055f3a10cb531` |
| Review date | 2026-07-18 |
| Final verdict | **NEEDS_CHANGES** |

This report is the only review-authored file. The Reviewer did not modify the task specification, current-task pointer, module locks, scripts, source, tests, baselines, or prior reports.

## 2. Preconditions and reviewed authority

The review started with a clean worktree. `HEAD` and `origin/chore/task-0006-project-scaffold` both resolved to `33bb53aef1f958fdf948d1c942e055f3a10cb531`.

The Reviewer read `AGENTS.md`, the complete authoritative workflow, `tasks/current-task.md`, `tasks/MODULE-LOCKS.md`, the complete TASK-0006 specification, CR-0002 through CR-0004, and every existing TASK-0006 specification review, implementation review, and retest report. RT-003's authority was taken from `TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST-2.md` section 11, not from the fix commit message.

The authoritative RT-003 defect was that the exact recursive `grep -ri "coverlet" tests/` command scanned generated `bin`/`obj` content after the mandated build and matched a string in a DLL even though the test project did not declare `coverlet.collector`. The minimum correction was an approved, maintained-project-file scope or structured project/package check, followed by execution of the amended command.

## 3. Diff and scope assessment

The reviewed range changes only:

- `tasks/CR-0004-TASK-0006-COVERLET-VALIDATION-CORRECTION.md` (new)
- `tasks/TASK-0006-PROJECT-SCAFFOLD.md`
- `tasks/current-task.md`

No implementation, test, script, dependency manifest, solution/project file, product baseline, architecture baseline, module-lock file, TASK-0007 artifact, scaffold, or existing report changed. There is no new dependency, code, infrastructure, abstraction, or functionality. The product and technical scope remain unchanged. The anti-overdevelopment review therefore passes for the reviewed diff.

## 4. RT-003 amended command execution

### A. Structured XML check — authoritative evidence

The exact amended Python heredoc in AC-SC-13 was run from the repository root under WSL.

- Standard output:

```text
PackageReferences: Microsoft.NET.Test.Sdk, xunit, xunit.runner.visualstudio
coverlet.collector PackageReference: absent
```

- Standard error: empty
- Exit code: `0`
- Result: **PASS**

### B. Exact csproj grep — supplemental evidence

Executed command:

```bash
grep -ni "coverlet.collector" \
  tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj
```

- Standard output: empty
- Standard error: empty
- Exit code: `1`
- Result: **PASS** (the specified no-match exit)

The amended AC-SC-13 checks the only approved test project's dependency declaration instead of repository documentation, historical reports, ignored output, DLLs, PDBs, `TestResults`, or unrelated files. The structured check detects an exact case-insensitive `Include="coverlet.collector"`; the supplemental case-insensitive grep retains textual coverage of the exact forbidden package name in that csproj. The scope does not omit another approved test project because TASK-0006 permits exactly one and AC-SC-09/12 constrain the solution and test project accordingly.

The commands are executable in the current WSL toolchain. The Python check uses exit `0` for absence and nonzero for a forbidden exact PackageReference or parse/file failure. The grep check deliberately uses exit `1` for absence; exit `0` would identify a violation and exit `2+` would identify command/input failure. Their actual outputs and exit codes therefore provide truthful PASS evidence.

## 5. Required workflow and whitespace validation

| Check | Standard output summary | Standard error | Exit | Result |
|---|---|---|---:|---|
| `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1` | 20 individual PASS lines; `SUMMARY PASS=20 FAIL=0 TOTAL=20` | Empty | 0 | PASS |
| `git diff --check` | Empty | Empty | 0 | PASS |

The existing `scripts/verify-project.ps1` was not executed because this review is expressly prohibited from installing dependencies and that script performs `npm ci`. Its PowerShell syntax was checked without execution using `System.Management.Automation.Language.Parser.ParseFile`; output was `verify-project.ps1 syntax: valid`, standard error was empty, and exit code was `0`. The reviewed commit does not modify that script or any implementation/dependency input, so previously passing implementation ACs were not changed by this documentation-only diff.

## 6. Workflow, lock, and regression checks

- All nine TASK-0006 implementation locks remain `HANDED_OFF`; none was released.
- TASK-0006 is not `COMPLETED`.
- No TASK-0007 or later task was started or modified.
- Product and architecture baselines are byte-identical across the reviewed range.
- Source, tests, scripts, dependencies, solution, README, and `.gitignore` are byte-identical across the reviewed range.
- The existing unified script remains syntactically valid under PowerShell 7.
- No approved business scope or dependency budget changed.

The current retest-stage state and handoff record do not comply with the authoritative workflow; see RV-002.

## 7. Findings

### RV-001 — MAJOR — AC-SC-17 still requires the abolished recursive coverlet command

- File and line: `tasks/TASK-0006-PROJECT-SCAFFOLD.md:342`
- Problem: AC-SC-13 lines 250-307 abolish recursive scanning and replace it with a structured csproj check plus exact-file grep, but AC-SC-17 gate 9 still says `grep -r "coverlet" tests/` must exit 1. That is the same overbroad command class that caused RT-003 and contradicts both AC-SC-13 and CR-0004. The actual verifier instead uses `--exclude-dir=bin --exclude-dir=obj`, so the specification, acceptance criteria, and implemented verification command are three non-identical descriptions.
- Risk: after a required build, the written AC-SC-17 command can still match generated DLL content and fail falsely. A Reviewer cannot truthfully satisfy all written acceptance commands, and future maintainers cannot know which scope is authoritative.
- Minimum fix direction: within the approved CR-0004 scope, make AC-SC-17 gate 9 explicitly reference the corrected AC-SC-13 method or state the exact maintained-file/exclusion command actually required. Preserve strict exit handling and do not modify implementation or dependencies unless a newly approved defect requires it.

### RV-002 — MAJOR — The specification correction was not handed off in `READY_FOR_RETEST`

- File and line: `tasks/current-task.md:9-17,38-40`; `tasks/TASK-0006-PROJECT-SCAFFOLD.md:7-14,928-940,972,983-989`
- Problem: both task pointers remain `CHANGES_REQUESTED`, while the current-task text says the completed specification correction should enter `READY_FOR_RETEST`. There is no recorded `CHANGES_REQUESTED → IN_FIX → READY_FOR_RETEST` transition for RT-003, no correction handoff entry, and the RT-003 fix record still says `待本轮提交` despite commit `33bb53a` already existing. The remaining retest section is stale and still describes the earlier RT-001/RT-002 retest.
- Risk: the authoritative workflow permits Reviewer retesting only from `READY_FOR_RETEST`; at `CHANGES_REQUESTED`, only defect assessment/planning is permitted and a fixer must reclaim the relevant lock before `IN_FIX`. The present metadata cannot prove a legal fix/handoff cycle and cannot support completion.
- Minimum fix direction: have the authorized non-Reviewer fixer record the legal state/lock transitions and RT-003 correction evidence, synchronize both task pointers to `READY_FOR_RETEST`, and update only the stale RT-003 handoff/fix metadata necessary for this correction. Do not close TASK-0006 or release implementation locks.

Finding counts: **BLOCKER 0 / MAJOR 2 / MINOR 0 / NOTE 0**.

## 8. Final verdict

**NEEDS_CHANGES**

The new AC-SC-13 commands themselves accurately correct RT-003 and both execute with the expected PASS exit codes. However, AC-SC-17 still normatively retains the abolished recursive scan, and the correction has not been moved through the required fix-to-retest workflow. The specification, acceptance commands, implemented gate description, state, and handoff evidence are therefore not yet mutually consistent.

TASK-0006 must remain open. This report does not authorize `COMPLETED`, module-lock release, a main-branch merge, or the start of TASK-0007.
