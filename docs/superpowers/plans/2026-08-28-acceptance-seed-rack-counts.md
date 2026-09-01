# Acceptance Seed Rack Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure the acceptance seed for 100 Shanghai racks, 150 Beijing racks, and 80 Guangzhou racks without executing it.

**Architecture:** Keep each room's rack count beside its existing name, location, abbreviation, and rack prefix in `KEPT_ROOMS`, making it the single source for creation and validation. Add a standard-library-only test that imports the script without calling `main()`, so it cannot write to SQLite.

**Tech Stack:** Python 3 standard library (`unittest`, `importlib`), SQLite seed script (not executed).

**Spec:** `tasks/TASK-20260828-134500-ACCEPTANCE-SEED-RACK-COUNTS.md`

## Global Constraints

- Exact counts: Shanghai 100, Beijing 150, Guangzhou 80; total 330.
- Do not run the seed script and do not modify database files.
- Preserve room names, Shanghai fixed ID, rack prefixes, U height, device/line logic, and all API/data-model code.
- Modify only `scripts/seed-acceptance-data.py` and `scripts/test_seed_acceptance_data.py`; add no dependency.

---

### Task 1: Per-room acceptance rack configuration

**Files:**

- Create: `scripts/test_seed_acceptance_data.py`
- Modify: `scripts/seed-acceptance-data.py:1-33, 352-370, 751-800`

**Interfaces:**

- Consumes: `KEPT_ROOMS` at module scope and `seed_kept_rooms_and_racks()` / `print_summary()` in the seed script.
- Produces: `KEPT_ROOMS` entries shaped `(name, location, abbr, rack_prefix, rack_count)`, used consistently by creation and summary validation.

- [ ] **Step 1: Write the failing test**

```python
class AcceptanceSeedRackCountsTests(unittest.TestCase):
    def test_kept_rooms_define_required_rack_counts(self) -> None:
        seed = load_seed_module()
        self.assertEqual(
            seed.KEPT_ROOMS,
            [
                ("上海机房", "上海张江DC1", "SH", "R1", 100),
                ("北京机房", "北京", "BJ", "R2", 150),
                ("广州机房", "广州", "GZ", "R3", 80),
            ],
        )
        self.assertEqual(sum(room[4] for room in seed.KEPT_ROOMS), 330)
```

`load_seed_module()` must use `importlib.util.spec_from_file_location` for `scripts/seed-acceptance-data.py`; do not invoke `main()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m unittest scripts/test_seed_acceptance_data.py -v`

Expected: FAIL because the pre-change room tuples contain only four fields and the values are 10 racks per room.

- [ ] **Step 3: Write minimal implementation**

```python
# (name, location, abbr, rack_prefix, rack_count)
KEPT_ROOMS = [
    (SHANGHAI_NAME, SHANGHAI_LOCATION, "SH", "R1", 100),
    ("北京机房", "北京", "BJ", "R2", 150),
    ("广州机房", "广州", "GZ", "R3", 80),
]
```

Remove `RACKS_PER_ROOM`. Unpack `rack_count` in the room-creation loop and use `range(1, rack_count + 1)`. Derive the summary total and per-room expected values from `KEPT_ROOMS`, then reject values other than 330 and `[100, 150, 80]` in the existing Shanghai/Beijing/Guangzhou order. Update the module docstring to state `3 rooms × 330 racks`.

- [ ] **Step 4: Run tests and syntax check**

Run: `python3 -m unittest scripts/test_seed_acceptance_data.py -v`

Expected: PASS with the exact three room configurations and total 330.

Run: `python3 -m py_compile scripts/seed-acceptance-data.py scripts/test_seed_acceptance_data.py`

Expected: exit code 0; no seed execution or database change.

- [ ] **Step 5: Inspect scope and commit**

Run: `git diff --check && git status --short`

Expected: only the two allowed implementation files plus task-governance records created by the orchestrator.

Commit implementation and task records with message: `feat(seed): configure per-room rack counts`.

## Self-Review

1. Spec coverage: FR-01 is Task 1 configuration; FR-02 is its loop update; FR-03 is its summary update; FR-04 is guaranteed by import-only test and stated verification; NFR-01 is its exact file boundary.
2. Placeholder scan: no unresolved placeholder or unspecified implementation/test step remains.
3. Type consistency: each `KEPT_ROOMS` consumer must unpack five fields after the change; no remaining consumer may expect four fields.
