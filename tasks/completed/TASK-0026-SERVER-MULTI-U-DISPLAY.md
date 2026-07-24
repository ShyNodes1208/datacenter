# TASK-0026: Fix server multi-U display in RackDeviceView

## Problem

`groupServerMap` in `RackDeviceView.vue` uses `seenServers` Set to deduplicate, causing a 2U server to only show its name in the first matched merged group (e.g., U4), while the other U position (e.g., U3) appears empty.

## Fix

**File:** `src/frontend/src/views/RackDeviceView.vue`

1. **Server name** should appear in **every** merged group that the server occupies. Remove the `seenServers` dedup from `groupServerMap`.

2. **Move/decommission buttons** should only appear at the server's **highest U position** (topU). Add a separate computed or modify the template check.

### Implementation hint

`serverOccupancy` is a `Map<number, {serverId, serverName}>` mapping each occupied U number to server info. The `groupServerMap` should check if any U position within each merged group's range `[group.endU, group.startU]` has an entry in `serverOccupancy`, and if so, include the server info. For the highest-U group only, also include action buttons.

## Constraints

- No over-engineering
- No over-development
- Minimal change to existing code
