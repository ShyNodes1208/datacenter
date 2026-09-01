# Seed IP Namespace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move new synthetic seed addresses into verified-unused per-room ranges so the 330-rack seed can coexist with historical device IPs.

**Architecture:** Preserve the existing per-rack unique formatter inputs and change only its first two address octets. The pure test proves room separation and all 6,270 unique values without opening the database.

**Tech Stack:** Python 3 standard-library unit tests; no seed execution.

**Spec:** `tasks/TASK-20260828-150000-SEED-IP-NAMESPACE.md`

## Global Constraints

- Use Shanghai `172.17.*.*`, Beijing `172.18.*.*`, Guangzhou `172.19.*.*`.
- Preserve existing server management IPs and names.
- Modify only the seed script and its existing no-database test; add no dependency and do not run the seed.

---

### Task 1: Isolated synthetic IP namespace

**Files:**

- Modify: `scripts/seed-acceptance-data.py:115-125`
- Test: `scripts/test_seed_acceptance_data.py`

**Interfaces:**

- Consumes: `synthetic_management_ip(room_index: int, rack_n: int, device_ordinal: int) -> str`.
- Produces: room-index mapping 1→172.17, 2→172.18, 3→172.19.

- [ ] **Step 1: Write the failing test**

```python
self.assertEqual(seed.synthetic_management_ip(1, 1, 1), "172.17.1.1")
self.assertEqual(seed.synthetic_management_ip(2, 1, 1), "172.18.1.1")
self.assertEqual(seed.synthetic_management_ip(3, 1, 1), "172.19.1.1")
self.assertEqual(seed.synthetic_management_ip(3, 80, 19), "172.19.80.19")
```

Keep the existing 6,270-length and set-length assertions.

- [ ] **Step 2: Verify the expected RED failure**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/test_seed_acceptance_data.py -v`

Expected: FAIL because the old formatter returns `10.*`.

- [ ] **Step 3: Write the minimal formatter change**

```python
def synthetic_management_ip(room_index: int, rack_n: int, device_ordinal: int) -> str:
    return f"172.{16 + room_index}.{rack_n}.{device_ordinal}"
```

Do not change call sites or `ensure_server()`.

- [ ] **Step 4: Verify GREEN and scope**

Run: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest scripts/test_seed_acceptance_data.py -v`

Expected: all tests PASS, including the 6,270 unique-address test.

Run: `git diff --check`

Expected: exit code 0; no database file change.

- [ ] **Step 5: Commit and hand off**

Commit with: `fix(seed): isolate synthetic management ip range`.

## Self-Review

1. FR-01 and FR-02 map to the pure formatter test; FR-03 is protected by the explicit no-change constraint; NFR-01 maps to the two-file boundary.
2. No unresolved placeholder remains.
3. All formatter calls retain the existing three-integer interface.
