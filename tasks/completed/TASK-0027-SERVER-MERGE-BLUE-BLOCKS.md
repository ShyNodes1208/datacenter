# TASK-0027: Merge server-occupied U positions into unified blue blocks

## Problem

Excel-imported devices display as **merged cells** with a **blue background** (via `mergedPositions` + `group.label` check). Manually racked servers display as individual U blocks with green background, server name repeated on each row — inconsistent visual.

## Goal

Manually racked servers should look the same as imported devices:
- Multi-U servers appear as a single merged block spanning their full U-height
- Block has blue background (`#b3d9ff`)
- Server name shown once, move/decommission buttons at the top U

## Fix

**File:** `src/frontend/src/views/RackDeviceView.vue`

Modify `mergedPositions` to also merge server-occupied U positions into unified blocks. When consecutive U positions all belong to the same server (same `serverOccupancy` serverId) and don't already have a DevicePosition label, merge them into one block with:
- `label` = server name (so the block renders blue)
- `startU` = top U, `endU` = bottom U

Then `groupServerMap` can be simplified — the server info is already in the merged block's `label`. The template can check if a block has `showActions` from `groupServerMap` to render the buttons.

## Constraints

- No over-engineering
- No over-development
- Reuse existing `serverOccupancy` data already available in the component
