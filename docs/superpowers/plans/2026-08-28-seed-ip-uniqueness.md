# Seed IP Uniqueness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make acceptance-seed synthetic device IPs unique for the configured 330-rack dataset without running the seed script.

**Architecture:** Add a deterministic, pure IP formatter that encodes room, rack, and per-rack device ordinal. Both synthetic-device creation loops supply the next ordinal from `counts[rack_id] + 1`, while existing server records remain untouched.

**Tech Stack:** Python 3 standard library (`unittest`, `importlib`); SQLite seed script is not executed.

**Spec:** `tasks/TASK-20260828-143000-SEED-IP-UNIQUENESS.md`

## Global Constraints

- Exact rack counts remain Shanghai 100, Beijing 150, Guangzhou 80; total 330.
- Existing server names and management IPs must remain unchanged.
- Do not run the seed script or write to database files.
- Modify only `scripts/seed-acceptance-data.py` and `scripts/test_seed_acceptance_data.py`; add no dependency.

---

### Task 1: Per-rack synthetic management IPs

**Files:**

- Modify: `scripts/seed-acceptance-data.py:115-145, 479-535`
- Test: `scripts/test_seed_acceptance_data.py`

**Interfaces:**

- Produces: `synthetic_management_ip(room_index: int, rack_n: int, device_ordinal: int) -> str`.
- Consumes: `room_index`, one-based `rack_n`, and `counts[rack_id] + 1` in both creation loops.

- [ ] **Step 1: Write the failing test**

```python
def test_synthetic_management_ips_are_unique_for_330_racks(self) -> None:
    seed = load_seed_module()
    ips = [
        seed.synthetic_management_ip(room_index, rack_n, device_ordinal)
        for room_index, rack_count in ((1, 100), (2, 150), (3, 80))
        for rack_n in range(1, rack_count + 1)
        for device_ordinal in range(1, 20)
    ]
    self.assertEqual(len(ips), 6270)
    self.assertEqual(len(set(ips)), 6270)
    self.assertEqual(seed.synthetic_management_ip(3, 80, 19), "10.3.80.19")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/test_seed_acceptance_data.py -v`

Expected: FAIL because `synthetic_management_ip` does not exist before the fix.

- [ ] **Step 3: Write minimal implementation**

```python
def synthetic_management_ip(room_index: int, rack_n: int, device_ordinal: int) -> str:
    return f"10.{room_index}.{rack_n}.{device_ordinal}"
```

In each `fill_synthetic_devices()` device-creation loop, immediately before `ensure_server`, compute `device_ordinal = counts.get(rack_id, 0) + 1` and set `ip = synthetic_management_ip(room_index, rack_n, device_ordinal)`. Remove both prior `min(n, 254)` expressions.

- [ ] **Step 4: Run all specified verification**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/test_seed_acceptance_data.py -v`

Expected: all tests PASS, including 6,270 unique values.

Run: `git diff --check`

Expected: exit code 0; no seed execution and no database write.

- [ ] **Step 5: Commit implementation and hand off**

Run: `git status --short`

Expected: only the two permitted implementation paths and task-governance records.

Commit with: `fix(seed): generate unique synthetic management ips`.

## Self-Review

1. Spec coverage: FR-01/FR-02 are the pure-function test; FR-03 is both loop calls; FR-04 retains the existing return path; NFR-01 is the exact file boundary and import-only test.
2. Placeholder scan: no unresolved placeholder or unspecified implementation/test step remains.
3. Type consistency: all call sites use the declared three integer parameters and return a string.
