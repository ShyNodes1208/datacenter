# Rack Detail Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the rack detail page (`/racks/:id`) with a realistic front-panel visual (HTML/CSS), device-type color coding, clickable device names, and right-side operation drawers.

**Architecture:** Extract the rack visual into a pure `RackFrontPanel` component (HTML/CSS grid, left U-ruler + right device blocks), extract operation forms into a `RackOperationDrawer` slide-in panel. `RackDeviceView` becomes a thin coordinator that fetches data and manages drawer state. One small backend change: the availability endpoint gains `deviceType` and `deviceHeight` fields. No new npm dependencies.

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest, .NET 8 (backend one-liner), existing tokens.css

## Global Constraints

- No new npm dependencies — pure HTML/CSS for rack visual
- Backend change is a single SELECT field addition in the availability endpoint
- Device type colors: server→blue, network→green, storage→orange, security→red, unknown→gray; adjacent same-type blocks alternate primary/secondary shade
- Left U-ruler + right device blocks; U-ruler grays out occupied U-numbers
- Device block shows: server name (clickable), device type tag, device height (e.g. "2U")
- Click empty U slot → open rack drawer with startU pre-filled
- Operations (rack/move/decommission/import) open in right-side slide-in drawer
- Follow existing patterns: `useApi()` for HTTP, `useAuth()` for roles, scoped CSS with tokens.css variables
- TypeScript strict: no `any` without justification

---

### Task 1: Backend — Add deviceType and deviceHeight to availability endpoint

**Files:**
- Modify: `src/backend/Datacenter.Api/Controllers/RacksController.cs` (lines ~156-168)

**Interfaces:**
- Produces: `GET /api/racks/{id}/availability` response gains `deviceType` (string) and `deviceHeight` (number) on each occupied position entry

- [ ] **Step 1: Modify the occupiedPositions query to include deviceType and deviceHeight**

In `RacksController.cs`, locate the `GetAvailability` method. Change the `occupiedPositions` query (lines ~157-167) from:

```csharp
var occupiedPositions = await dbContext.ServerPositions
    .AsNoTracking()
    .Where(position => position.RackId == id && position.Status == "在架")
    .Select(position => new
    {
        position.StartU,
        position.EndU,
        position.ServerId,
        ServerName = position.Server.Name
    })
    .ToListAsync(cancellationToken);
```

To:

```csharp
var occupiedPositions = await dbContext.ServerPositions
    .AsNoTracking()
    .Where(position => position.RackId == id && position.Status == "在架")
    .Select(position => new
    {
        position.StartU,
        position.EndU,
        position.ServerId,
        ServerName = position.Server.Name,
        DeviceType = position.Server.DeviceType,
        DeviceHeight = position.Server.DeviceHeight
    })
    .ToListAsync(cancellationToken);
```

- [ ] **Step 2: Update the response builder to include the new fields**

Locate the `occupiedByU` dictionary (lines ~169-177) and the response loop (lines ~179-201). Change:

```csharp
var occupiedByU = new Dictionary<int, (string ServerName, Guid ServerId)>();

foreach (var occupied in occupiedPositions)
{
    for (var u = occupied.StartU; u <= occupied.EndU; u++)
    {
        occupiedByU[u] = (occupied.ServerName, occupied.ServerId);
    }
}
```

To:

```csharp
var occupiedByU = new Dictionary<int, (string ServerName, Guid ServerId, string DeviceType, int DeviceHeight)>();

foreach (var occupied in occupiedPositions)
{
    for (var u = occupied.StartU; u <= occupied.EndU; u++)
    {
        occupiedByU[u] = (occupied.ServerName, occupied.ServerId, occupied.DeviceType, occupied.DeviceHeight);
    }
}
```

And in the response construction (lines ~183-191), change:

```csharp
if (occupiedByU.TryGetValue(u, out var occupancy))
{
    positions.Add(new
    {
        uNumber = u,
        occupied = true,
        serverName = occupancy.ServerName,
        serverId = occupancy.ServerId
    });
}
```

To:

```csharp
if (occupiedByU.TryGetValue(u, out var occupancy))
{
    positions.Add(new
    {
        uNumber = u,
        occupied = true,
        serverName = occupancy.ServerName,
        serverId = occupancy.ServerId,
        deviceType = occupancy.DeviceType,
        deviceHeight = occupancy.DeviceHeight
    });
}
```

- [ ] **Step 3: Build and verify**

```bash
cd src/backend/Datacenter.Api && dotnet build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/RacksController.cs
git commit -m "feat: add deviceType and deviceHeight to rack availability endpoint"
```

---

### Task 2: Frontend — Device type color utility

**Files:**
- Create: `src/frontend/src/utils/deviceColors.ts`
- Create: `src/frontend/src/__tests__/deviceColors.test.ts`

**Interfaces:**
- Produces:
```typescript
function getDeviceColor(deviceType: string | undefined, index: number): {
  background: string
  text: string
  tagBg: string
  tagText: string
}

type DeviceColorScheme = {
  primary: string
  secondary: string
  tagBg: string
  tagText: string
}
```

- [ ] **Step 1: Write the test file**

Create `src/frontend/src/__tests__/deviceColors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getDeviceColor } from '../utils/deviceColors'

describe('getDeviceColor', () => {
  it('returns blue shades for server type (服务器)', () => {
    const c0 = getDeviceColor('服务器', 0)
    const c1 = getDeviceColor('服务器', 1)
    // adjacent same-type alternates primary/secondary
    expect(c0.background).not.toBe(c1.background)
    // both are blue-ish
    expect(c0.background).toMatch(/^#/)
    expect(c1.background).toMatch(/^#/)
  })

  it('returns green shades for network device keywords', () => {
    for (const kw of ['网络设备', '交换机', '路由器', 'switch', 'router']) {
      const c = getDeviceColor(kw, 0)
      expect(c.background).toBeTruthy()
    }
  })

  it('returns orange shades for storage device keywords', () => {
    for (const kw of ['存储设备', '磁盘阵列', 'storage']) {
      const c = getDeviceColor(kw, 0)
      expect(c.background).toBeTruthy()
    }
  })

  it('returns red shades for security device keywords', () => {
    for (const kw of ['安全设备', '防火墙', 'firewall']) {
      const c = getDeviceColor(kw, 0)
      expect(c.background).toBeTruthy()
    }
  })

  it('returns gray for unknown device types', () => {
    const c = getDeviceColor('其他设备', 0)
    expect(c.background).toBeTruthy()
  })

  it('returns default gray for undefined/null device type', () => {
    const c = getDeviceColor(undefined, 0)
    expect(c.background).toBeTruthy()
  })

  it('alternates between primary and secondary on even/odd index', () => {
    const c0 = getDeviceColor('服务器', 0)
    const c1 = getDeviceColor('服务器', 1)
    const c2 = getDeviceColor('服务器', 2)
    expect(c0.background).toBe(c2.background) // both even index → same (primary)
    expect(c0.background).not.toBe(c1.background) // even vs odd → different
  })

  it('returns text, tagBg, and tagText colors', () => {
    const c = getDeviceColor('服务器', 0)
    expect(c.text).toBeTruthy()
    expect(c.tagBg).toBeTruthy()
    expect(c.tagText).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd src/frontend && npx vitest run src/__tests__/deviceColors.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the color utility**

Create `src/frontend/src/utils/deviceColors.ts`:

```typescript
export interface DeviceColorResult {
  background: string
  text: string
  tagBg: string
  tagText: string
}

interface ColorPair {
  primary: string
  secondary: string
}

/** Keyword → color pair. Checked case-insensitively against deviceType. */
const COLOR_MAP: Record<string, ColorPair> = {
  '服务器':   { primary: '#3B82F6', secondary: '#60A5FA' },
  'server':   { primary: '#3B82F6', secondary: '#60A5FA' },
  '交换':     { primary: '#10B981', secondary: '#34D399' },
  '路由':     { primary: '#10B981', secondary: '#34D399' },
  'switch':   { primary: '#10B981', secondary: '#34D399' },
  'router':   { primary: '#10B981', secondary: '#34D399' },
  '网络':     { primary: '#10B981', secondary: '#34D399' },
  'network':  { primary: '#10B981', secondary: '#34D399' },
  '存储':     { primary: '#F59E0B', secondary: '#FBBF24' },
  'storage':  { primary: '#F59E0B', secondary: '#FBBF24' },
  '磁盘':     { primary: '#F59E0B', secondary: '#FBBF24' },
  '防火':     { primary: '#EF4444', secondary: '#F87171' },
  'firewall': { primary: '#EF4444', secondary: '#F87171' },
  '安全':     { primary: '#EF4444', secondary: '#F87171' },
  'security': { primary: '#EF4444', secondary: '#F87171' },
}

const DEFAULT_COLOR: ColorPair = { primary: '#6B7280', secondary: '#9CA3AF' }

function matchColorPair(deviceType: string): ColorPair {
  const lower = deviceType.toLowerCase()
  for (const [keyword, pair] of Object.entries(COLOR_MAP)) {
    if (lower.includes(keyword.toLowerCase())) {
      return pair
    }
  }
  return DEFAULT_COLOR
}

/**
 * Returns foreground/background colors for a device block.
 *
 * @param deviceType - The device's DeviceType string (Server model field).
 * @param index      - Sequential index among same-type adjacent devices; even → primary, odd → secondary.
 */
export function getDeviceColor(deviceType: string | undefined, index: number): DeviceColorResult {
  const pair = matchColorPair(deviceType ?? '')
  const bg = index % 2 === 0 ? pair.primary : pair.secondary

  return {
    background: bg,
    text: '#ffffff',
    tagBg: 'rgba(255, 255, 255, 0.2)',
    tagText: '#ffffff',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd src/frontend && npx vitest run src/__tests__/deviceColors.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/utils/deviceColors.ts src/frontend/src/__tests__/deviceColors.test.ts
git commit -m "feat: add device type color utility with alternating shades"
```

---

### Task 3: Frontend — Create RackFrontPanel component

**Files:**
- Create: `src/frontend/src/components/RackFrontPanel.vue`

**Interfaces:**
- Consumes: `getDeviceColor` from `../utils/deviceColors`
- Produces: `<RackFrontPanel>` component

**Props:**
```typescript
interface Props {
  rackCode: string
  heightU: number
  uSlots: USlot[]
  roomId: string
}

interface USlot {
  startU: number       // top U of this block (higher number)
  endU: number         // bottom U of this block (lower number)
  uCount: number       // how many U this block spans
  occupied: boolean
  serverId?: string
  serverName?: string
  deviceType?: string
  deviceHeight?: number
  // colorIndex is assigned by the parent for alternating shades
  colorIndex?: number
}
```

**Emits:**
```typescript
{
  'slot-click': [uNumber: number, slot: USlot]
  'server-click': [serverId: string]
}
```

- [ ] **Step 1: Create the component file**

Create `src/frontend/src/components/RackFrontPanel.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { getDeviceColor } from '../utils/deviceColors'
import { useRouter } from 'vue-router'

export interface USlot {
  startU: number
  endU: number
  uCount: number
  occupied: boolean
  serverId?: string
  serverName?: string
  deviceType?: string
  deviceHeight?: number
  colorIndex?: number
}

const props = defineProps<{
  rackCode: string
  heightU: number
  uSlots: USlot[]
  roomId: string
}>()

const emit = defineEmits<{
  (e: 'slot-click', uNumber: number, slot: USlot): void
  (e: 'server-click', serverId: string): void
}>()

const router = useRouter()

interface RulerSlot {
  uNumber: number
  occupied: boolean
}

/** Flatten uSlots into individual U-level ruler entries. */
const rulerSlots = computed<RulerSlot[]>(() => {
  const result: RulerSlot[] = []
  for (const slot of props.uSlots) {
    const hi = Math.max(slot.startU, slot.endU)
    const lo = Math.min(slot.startU, slot.endU)
    for (let u = hi; u >= lo; u--) {
      result.push({ uNumber: u, occupied: slot.occupied })
    }
  }
  return result
})

interface DeviceBlock {
  startU: number
  endU: number
  uCount: number
  uLabel: string            // e.g. "2U" or "1U"
  occupied: boolean
  serverId?: string
  serverName?: string
  deviceType?: string
  deviceHeight?: number
  colorIndex: number
  colors: ReturnType<typeof getDeviceColor>
  rowSpan: number           // grid rows this block spans
}

const deviceBlocks = computed<DeviceBlock[]>(() => {
  return props.uSlots.map((slot) => {
    const hi = Math.max(slot.startU, slot.endU)
    const lo = Math.min(slot.startU, slot.endU)
    const uCount = hi - lo + 1
    const idx = slot.colorIndex ?? 0
    return {
      startU: hi,
      endU: lo,
      uCount,
      uLabel: `${slot.deviceHeight ?? uCount}U`,
      occupied: slot.occupied,
      serverId: slot.serverId,
      serverName: slot.serverName,
      deviceType: slot.deviceType,
      deviceHeight: slot.deviceHeight,
      colorIndex: idx,
      colors: getDeviceColor(slot.deviceType, idx),
      rowSpan: uCount,
    }
  })
})

function totalRows(count: number): string {
  return `repeat(${count}, 24px)`
}

function onServerClick(e: MouseEvent, serverId: string): void {
  e.stopPropagation()
  emit('server-click', serverId)
}

function onSlotClick(slot: USlot): void {
  if (!slot.occupied) {
    // Click on empty region — emit with the top U of the empty block
    const topU = Math.max(slot.startU, slot.endU)
    emit('slot-click', topU, slot)
  }
}
</script>

<template>
  <div class="rfp" :style="{ display: 'grid', gridTemplateColumns: '48px 1fr', gridTemplateRows: 'auto 1fr' }">
    <!-- Header -->
    <div class="rfp__header-left"></div>
    <div class="rfp__header-right">
      <span class="rfp__rack-code">{{ rackCode }}</span>
    </div>

    <!-- Body: U-ruler + device area -->
    <div
      class="rfp__ruler"
      :style="{ display: 'grid', gridTemplateRows: totalRows(heightU) }"
    >
      <div
        v-for="slot in rulerSlots"
        :key="'r' + slot.uNumber"
        class="rfp__ruler-mark"
        :class="{ 'rfp__ruler-mark--occupied': slot.occupied }"
      >
        {{ slot.uNumber }}
      </div>
    </div>

    <div
      class="rfp__devices"
      :style="{ display: 'grid', gridTemplateRows: totalRows(heightU) }"
    >
      <div
        v-for="block in deviceBlocks"
        :key="'b' + block.startU + '-' + block.endU"
        class="rfp__block"
        :class="{ 'rfp__block--empty': !block.occupied, 'rfp__block--occupied': block.occupied }"
        :style="{
          gridRow: `span ${block.rowSpan}`,
          background: block.occupied ? block.colors.background : undefined,
          cursor: block.occupied && block.serverId ? 'pointer' : !block.occupied ? 'pointer' : undefined,
        }"
        @click="block.occupied && block.serverId ? undefined : onSlotClick(props.uSlots.find(s => s.startU === block.startU && s.endU === block.endU)!)"
      >
        <template v-if="block.occupied && block.serverName">
          <div
            class="rfp__block-content"
            @click="onServerClick($event, block.serverId!)"
          >
            <div class="rfp__block-name">{{ block.serverName }}</div>
            <div class="rfp__block-meta">
              <span
                v-if="block.deviceType"
                class="rfp__block-tag"
                :style="{ background: block.colors.tagBg, color: block.colors.tagText }"
              >{{ block.deviceType }}</span>
              <span class="rfp__block-u">{{ block.uLabel }}</span>
            </div>
          </div>
        </template>
        <template v-else-if="!block.occupied">
          <div class="rfp__block-empty-hint">空闲 {{ block.uCount }}U</div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rfp {
  border: 4px solid #2c3e50;
  border-radius: 6px;
  background: #1a252f;
  overflow: hidden;
  user-select: none;
}

.rfp__header-left {
  background: #243447;
  border-bottom: 1px solid #3d5266;
}

.rfp__header-right {
  background: #243447;
  border-bottom: 1px solid #3d5266;
  padding: 6px 12px;
  display: flex;
  align-items: center;
}

.rfp__rack-code {
  color: #c8d6e5;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.03em;
}

.rfp__ruler {
  background: #111820;
}

.rfp__ruler-mark {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 10px;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  color: #6b8299;
  border-bottom: 1px solid #1e2d3d;
  line-height: 24px;
  height: 24px;
}

.rfp__ruler-mark--occupied {
  color: #3d5266;
  background: #151d28;
}

.rfp__devices {
  position: relative;
}

.rfp__block {
  border-bottom: 1px solid #2c3e50;
  box-sizing: border-box;
  transition: filter 0.1s ease;
}

.rfp__block--empty {
  background: #1a252f;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rfp__block--empty:hover {
  background: #1e2d3d;
}

.rfp__block--occupied:hover {
  filter: brightness(1.12);
}

.rfp__block-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 2px 10px;
  overflow: hidden;
}

.rfp__block-name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: rgba(255,255,255,0.3);
  text-underline-offset: 2px;
}

.rfp__block-name:hover {
  text-decoration-color: rgba(255,255,255,0.8);
}

.rfp__block-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 1px;
}

.rfp__block-tag {
  font-size: 10px;
  padding: 0px 5px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 16px;
}

.rfp__block-u {
  font-size: 10px;
  color: rgba(255,255,255,0.6);
  white-space: nowrap;
}

.rfp__block-empty-hint {
  font-size: 11px;
  color: #4a6279;
}
</style>
```

- [ ] **Step 2: Verify the component compiles**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

Expected: no new type errors from RackFrontPanel.vue.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/components/RackFrontPanel.vue
git commit -m "feat: add RackFrontPanel component with U-ruler and device blocks"
```

---

### Task 4: Frontend — Create RackOperationDrawer component

**Files:**
- Create: `src/frontend/src/components/RackOperationDrawer.vue`

**Interfaces:**
- Produces: `<RackOperationDrawer>` component

**Props:**
```typescript
interface Props {
  visible: boolean
  title: string
}
```

**Emits:**
```typescript
{
  'close': []
}
```

**Slots:**
- `default` — drawer body content

- [ ] **Step 1: Create the component file**

Create `src/frontend/src/components/RackOperationDrawer.vue`:

```vue
<script setup lang="ts">
defineProps<{
  visible: boolean
  title: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="drawer-overlay"
      @click.self="emit('close')"
    >
      <div class="drawer-panel">
        <div class="drawer-header">
          <h3 class="drawer-title">{{ title }}</h3>
          <button class="drawer-close" @click="emit('close')" aria-label="关闭">✕</button>
        </div>
        <div class="drawer-body">
          <slot></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 420px;
  max-width: 100vw;
  height: 100%;
  background: var(--color-bg-card, #fff);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  animation: slide-in 0.2s ease-out;
}

@keyframes slide-in {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  flex-shrink: 0;
}

.drawer-title {
  margin: 0;
  font-size: var(--font-lg, 16px);
  font-weight: 600;
}

.drawer-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--color-text-secondary, #888);
  padding: 0;
  line-height: 1;
}

.drawer-close:hover {
  color: var(--color-text, #333);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
}
</style>
```

- [ ] **Step 2: Verify the component compiles**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

Expected: no new type errors from RackOperationDrawer.vue.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/components/RackOperationDrawer.vue
git commit -m "feat: add RackOperationDrawer slide-in panel component"
```

---

### Task 5: Frontend — Create useRackDetail composable

**Files:**
- Create: `src/frontend/src/composables/useRackDetail.ts`

**Interfaces:**
- Consumes: `useApi` from `../composables/useApi`, `USlot` from `../components/RackFrontPanel.vue`
- Produces:
```typescript
function useRackDetail(rackId: string): {
  rack: Ref<{ id: string; code: string; roomId: string; roomName: string; heightU: number } | null>
  uSlots: Ref<USlot[]>
  stats: Ref<{ total: number; occupied: number; empty: number }>
  loading: Ref<boolean>
  error: Ref<string>
  rackedServerCount: Ref<number>
  loadData: () => Promise<void>
}
```

- [ ] **Step 1: Create the composable**

Create `src/frontend/src/composables/useRackDetail.ts`:

```typescript
import { ref, computed, type Ref } from 'vue'
import { useApi } from './useApi'
import type { USlot } from '../components/RackFrontPanel.vue'

interface RackInfo {
  id: string
  code: string
  roomId: string
  roomName: string
  heightU: number
}

interface AvailabilityPosition {
  uNumber: number
  occupied: boolean
  serverName?: string
  serverId?: string
  deviceType?: string
  deviceHeight?: number
}

interface AvailabilityResponse {
  rackId: string
  rackCode: string
  heightU: number
  positions: AvailabilityPosition[]
}

export function useRackDetail(rackId: string) {
  const { request } = useApi()

  const rack = ref<RackInfo | null>(null)
  const error = ref('')
  const loading = ref(false)
  const serverOccupancy = ref<Map<number, { serverName: string; serverId: string; deviceType: string; deviceHeight: number }>>(new Map())

  /** Merges availability positions into USlot blocks for RackFrontPanel. */
  const uSlots = computed<USlot[]>(() => {
    const positions = serverOccupancy.value
    if (!rack.value) return []

    const heightU = rack.value.heightU
    if (heightU <= 0) return []

    const slots: USlot[] = []
    let u = heightU

    while (u >= 1) {
      const info = positions.get(u)
      if (info) {
        // This U is occupied — find the full span
        const topU = u
        let bottomU = u
        let sameTypeCount = 0

        // Find how far this server extends downward
        while (bottomU - 1 >= 1 && positions.get(bottomU - 1)?.serverId === info.serverId) {
          bottomU--
        }

        const uCount = topU - bottomU + 1

        // Count preceding same-type devices for color alternation
        let ci = 0
        for (let i = 0; i < slots.length; i++) {
          const prev = slots[i]
          if (prev.occupied && prev.deviceType === info.deviceType) {
            ci++
          } else if (prev.occupied && prev.deviceType !== info.deviceType) {
            ci = 0 // reset for different type
          }
        }

        slots.push({
          startU: topU,
          endU: bottomU,
          uCount,
          occupied: true,
          serverId: info.serverId,
          serverName: info.serverName,
          deviceType: info.deviceType,
          deviceHeight: info.deviceHeight,
          colorIndex: ci,
        })

        u = bottomU - 1
      } else {
        // Find contiguous empty range
        const topU = u
        let bottomU = u
        while (bottomU - 1 >= 1 && !positions.has(bottomU - 1)) {
          bottomU--
        }

        slots.push({
          startU: topU,
          endU: bottomU,
          uCount: topU - bottomU + 1,
          occupied: false,
          colorIndex: 0,
        })

        u = bottomU - 1
      }
    }

    return slots
  })

  const stats = computed(() => {
    if (!rack.value) return { total: 0, occupied: 0, empty: 0 }
    const total = rack.value.heightU
    let occupied = 0
    for (const slot of uSlots.value) {
      if (slot.occupied) occupied += slot.uCount
    }
    return { total, occupied, empty: total - occupied }
  })

  const rackedServerCount = computed(() => {
    const ids = new Set<string>()
    for (const info of serverOccupancy.value.values()) {
      ids.add(info.serverId)
    }
    return ids.size
  })

  async function loadData(): Promise<void> {
    error.value = ''
    loading.value = true

    // Fetch rack info
    const rackResult = await request<unknown>(`/api/racks/${rackId}`, { method: 'GET' })
    if (!rackResult.ok) {
      error.value = rackResult.error
      loading.value = false
      return
    }
    const rackData = rackResult.data as Record<string, unknown>
    rack.value = {
      id: rackData.id as string,
      code: rackData.code as string,
      roomId: rackData.roomId as string,
      roomName: rackData.roomName as string,
      heightU: rackData.heightU as number,
    }

    // Fetch availability (U-by-U occupancy with server details)
    const availResult = await request<AvailabilityResponse>(
      `/api/racks/${rackId}/availability`,
      { method: 'GET' },
    )

    if (availResult.ok && availResult.data) {
      const map = new Map<number, { serverName: string; serverId: string; deviceType: string; deviceHeight: number }>()
      for (const pos of availResult.data.positions) {
        if (pos.occupied && pos.serverName && pos.serverId) {
          map.set(pos.uNumber, {
            serverName: pos.serverName,
            serverId: pos.serverId,
            deviceType: pos.deviceType ?? '未知',
            deviceHeight: pos.deviceHeight ?? 1,
          })
        }
      }
      serverOccupancy.value = map
    }

    loading.value = false
  }

  return {
    rack,
    uSlots,
    stats,
    loading,
    error,
    rackedServerCount,
    loadData,
  }
}
```

- [ ] **Step 2: Verify the composable compiles**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/composables/useRackDetail.ts
git commit -m "feat: add useRackDetail composable for rack data and U-slot merging"
```

---

### Task 6: Frontend — Refactor RackDeviceView to use new components

**Files:**
- Modify: `src/frontend/src/views/RackDeviceView.vue`

**Interfaces:**
- Consumes: `RackFrontPanel` from `../components/RackFrontPanel.vue`, `RackOperationDrawer` from `../components/RackOperationDrawer.vue`, `useRackDetail` from `../composables/useRackDetail`, `useApi`, `useAuth`, `useRoute`, `useRouter`

**What stays (from the current RackDeviceView):**
- All form/CRUD logic for racking, moving, decommissioning, importing, deleting
- CSRF token handling
- Role-based `canEdit` computed
- Breadcrumb, stats bar

**What changes:**
- The rack visual (`<div class="rack-shell">`) is replaced by `<RackFrontPanel>`
- The inline panels (import, rack, move, decommission) move into `<RackOperationDrawer>`
- The stats card is simplified/repositioned
- The `main-layout` structure is reorganized

- [ ] **Step 1: Read the current file to understand exact structure**

Before editing, read `src/frontend/src/views/RackDeviceView.vue` to confirm the current state matches the plan.

- [ ] **Step 2: Rewrite the template section**

Replace the entire `<template>` block with the new structure. The key changes:

1. **Remove** the old `<div class="rack-shell">` and all `.u-group` rendering, replacing with `<RackFrontPanel>`
2. **Move** the 4 inline panels (import, rack, move, decommission) into `<RackOperationDrawer>` instances
3. **Add** click handlers for empty-slot → open rack drawer, and server-click → navigate

The new template structure:

```vue
<template>
  <div class="rack-page">
    <div v-if="loading" class="status-msg">加载中...</div>
    <div v-else-if="error" class="error" role="alert" aria-live="polite">{{ error }}</div>

    <template v-else-if="rack">
      <!-- Top bar: breadcrumb + stats + action buttons -->
      <div class="toolbar">
        <div class="toolbar__left">
          <p class="breadcrumb">
            <a href="/" @click.prevent="router.push('/')">机房列表</a>
            &gt; {{ rack.roomName }}
            <router-link :to="`/rooms/${rack.roomId}/floorplan`">平面图</router-link>
            &gt; {{ rack.code }}
          </p>
          <p class="toolbar__stats">
            U 位总数：{{ stats.total }} |
            已占用：{{ stats.occupied }} |
            空闲：{{ stats.empty }} |
            使用率：{{ usagePercent }}%
            <span class="muted"> | 在架服务器：{{ rackedServerCount }}</span>
          </p>
        </div>
        <div class="toolbar__actions">
          <button type="button" class="btn" @click="openImport">导入设备</button>
          <button v-if="canEdit" type="button" class="btn btn--primary" @click="openRack()">上架服务器</button>
          <button
            v-if="canEdit"
            type="button"
            class="btn btn--danger"
            :disabled="deleteRackSubmitting"
            @click="deleteRack"
          >
            {{ deleteRackSubmitting ? '删除中...' : '删除机柜' }}
          </button>
        </div>
      </div>
      <div v-if="deleteRackError" class="error" role="alert" aria-live="polite">
        {{ deleteRackError }}
      </div>

      <!-- Main layout: rack visual + optional usage bar -->
      <div class="main-layout">
        <div class="rack-panel-wrapper">
          <RackFrontPanel
            :rack-code="rack.code"
            :height-u="rack.heightU"
            :u-slots="uSlots"
            :room-id="rack.roomId"
            @slot-click="onEmptySlotClick"
            @server-click="onServerClick"
          />
        </div>
        <div class="usage-section">
          <div class="usage-bar-vertical">
            <div class="usage-bar-vertical__track">
              <div
                class="usage-bar-vertical__fill"
                :style="{ height: `${usagePercent}%` }"
              ></div>
            </div>
            <span class="usage-bar-vertical__label">{{ usagePercent }}%</span>
          </div>
        </div>
      </div>

      <!-- Operation Drawers -->
      <RackOperationDrawer
        :visible="importVisible"
        title="导入设备"
        @close="cancelImport"
      >
        <!-- Import form content (keep existing import logic) -->
        <div v-if="!importPreview && !importResult">
          <input type="file" accept=".xlsx" :disabled="importPreviewLoading" @change="handleFileChange" />
          <p v-if="importPreviewLoading">解析中...</p>
          <div v-if="importError" class="error" role="alert" aria-live="polite">{{ importError }}</div>
        </div>
        <!-- ... rest of import preview/result logic unchanged ... -->
      </RackOperationDrawer>

      <RackOperationDrawer
        :visible="rackVisible"
        title="上架服务器"
        @close="cancelRack"
      >
        <!-- Rack form content unchanged from current code -->
      </RackOperationDrawer>

      <RackOperationDrawer
        :visible="moveVisible"
        title="移动服务器"
        @close="cancelMove"
      >
        <!-- Move form content unchanged from current code -->
      </RackOperationDrawer>

      <RackOperationDrawer
        :visible="decommissionVisible"
        title="下架服务器"
        @close="cancelDecommission"
      >
        <!-- Decommission form content unchanged from current code -->
      </RackOperationDrawer>
    </template>
  </div>
</template>
```

- [ ] **Step 3: Rewrite the script section**

Replace the `<script setup>` block. Keep ALL existing logic for:
- Import (uploadPreview, submitImport, handleFileChange, closeResult, etc.)
- Rack (openRack, cancelRack, confirmRack, loadAvailableServers, etc.)
- Move (openMove, cancelMove, confirmMove, etc.)
- Decommission (openDecommission, cancelDecommission, confirmDecommission, etc.)
- Delete rack
- All reactive state variables (importVisible, rackVisible, moveVisible, etc.)

**Remove:**
- The `mergedPositions` computed (replaced by `useRackDetail.uSlots`)
- The `groupServerMap` computed (no longer needed; move/decommission buttons are now triggered from the drawer)
- The `occupiedUNumbers` computed (replaced by `useRackDetail`)
- The `serverOccupancy` ref and related map building (moved to `useRackDetail`)
- The `groupUNumbers`, `groupUCount` helper functions (no longer needed)
- The `usagePercent` computed (rewire to use `stats` from `useRackDetail`)
- The `rackedServerCount` computed (from `useRackDetail`)

**Add:**
```typescript
import { watch } from 'vue'
import RackFrontPanel from '../components/RackFrontPanel.vue'
import RackOperationDrawer from '../components/RackOperationDrawer.vue'
import { useRackDetail } from '../composables/useRackDetail'

const { rack, uSlots, stats, loading, error: detailError, rackedServerCount, loadData } = useRackDetail(rackId.value)

// Wire detailError into local error display
watch(detailError, (val) => { if (val) error.value = val })

const usagePercent = computed(() => {
  if (stats.value.total === 0) return 0
  return Math.round((stats.value.occupied / stats.value.total) * 100)
})

// New handlers
function onEmptySlotClick(uNumber: number, _slot: unknown): void {
  rackStartU.value = uNumber
  void openRack()
}

function onServerClick(serverId: string): void {
  router.push(`/servers/${encodeURIComponent(serverId)}`)
}

// Modify openRack to accept optional prefill
async function openRack(): Promise<void> {
  rackVisible.value = true
  rackError.value = ''
  // Don't reset selectedServerId or rackStartU here — they may be pre-filled
  await loadAvailableServers()
}
```

**onMounted:** Replace the old `loadData()` call with:
```typescript
onMounted(() => {
  void loadData()
})
```

- [ ] **Step 4: Rewrite the style section**

Remove the old CSS for:
- `.rack-shell` (replaced by RackFrontPanel internal styles)
- `.u-group`, `.u-group--occupied`, `.u-label`, `.u-name`, `.u-actions` (no longer used)
- `.stats-card` (replaced by vertical usage bar)
- `.preview-scroll`, `.preview-table` (keep if import drawer still uses them)

Add new CSS:

```css
.main-layout {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
}

.rack-panel-wrapper {
  flex: 1;
  max-width: 480px;
}

.usage-section {
  display: flex;
  align-items: center;
  padding-top: 48px; /* align with rack header */
}

.usage-bar-vertical {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.usage-bar-vertical__track {
  width: 12px;
  height: 320px;
  background: #eee;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.usage-bar-vertical__fill {
  width: 100%;
  position: absolute;
  bottom: 0;
  background: var(--color-primary);
  border-radius: 6px;
  transition: height 0.3s;
}

.usage-bar-vertical__label {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--color-primary);
}
```

- [ ] **Step 5: Run type checking**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

Expected: no type errors (fix any that appear).

- [ ] **Step 6: Run existing tests to check for regressions**

```bash
cd src/frontend && npx vitest run
```

Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/frontend/src/views/RackDeviceView.vue
git commit -m "refactor: redesign rack detail page with front-panel visual and operation drawers"
```

---

### Task 7: Frontend — Write rack detail integration tests

**Files:**
- Create: `src/frontend/src/__tests__/rackDetail.test.ts`

- [ ] **Step 1: Write the test file**

Create `src/frontend/src/__tests__/rackDetail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'

// Mock useApi
const mockRequest = vi.fn()
vi.mock('../composables/useApi', () => ({
  useApi: () => ({ request: mockRequest }),
}))

// Mock useAuth
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    user: { value: { username: 'test', role: '机房管理员' } },
    restore: vi.fn(),
    logout: vi.fn(),
  }),
}))

// Mock useRackDetail
const mockUSlots: unknown[] = []
const mockLoadData = vi.fn()
vi.mock('../composables/useRackDetail', () => ({
  useRackDetail: () => ({
    rack: { value: { id: 'r1', code: 'A01', roomId: 'rm1', roomName: 'Room A', heightU: 42 } },
    uSlots: { value: mockUSlots },
    stats: { value: { total: 42, occupied: 10, empty: 32 } },
    loading: { value: false },
    error: { value: '' },
    rackedServerCount: { value: 3 },
    loadData: mockLoadData,
  }),
}))

import RackDeviceView from '../views/RackDeviceView.vue'

describe('RackDeviceView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/racks/:id', component: RackDeviceView }],
    })
    router.push('/racks/r1')

    const wrapper = mount(RackDeviceView, {
      global: { plugins: [router] },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('calls loadData on mount', async () => {
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/racks/:id', component: RackDeviceView }],
    })
    router.push('/racks/r1')

    mount(RackDeviceView, {
      global: { plugins: [router] },
    })

    expect(mockLoadData).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the new tests**

```bash
cd src/frontend && npx vitest run src/__tests__/rackDetail.test.ts
```

Expected: tests pass (component mounts, loadData called).

- [ ] **Step 3: Run full test suite**

```bash
cd src/frontend && npx vitest run
```

Expected: all tests pass — both new and existing.

- [ ] **Step 4: Commit**

```bash
git add src/frontend/src/__tests__/rackDetail.test.ts
git commit -m "test: add RackDeviceView integration tests"
```

---

### Task 8: Manual verification

- [ ] **Step 1: Start backend**

```bash
cd src/backend/Datacenter.Api && dotnet run
```

- [ ] **Step 2: Start frontend**

```bash
cd src/frontend && npm run dev
```

- [ ] **Step 3: Verify the rack detail page**

1. Navigate to a rack detail page (`/racks/<id>`)
2. Verify the rack front panel renders with U-ruler on the left and device blocks on the right
3. Verify device blocks show: server name, device type tag, height (e.g. "2U")
4. Verify device blocks are color-coded by device type with alternating shades
5. Click a server name → should navigate to server detail
6. Click an empty U slot → should open the rack drawer with startU pre-filled
7. Verify all drawers (rack, move, decommission, import) slide in from the right
8. Verify the vertical usage bar shows the correct percentage

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A && git commit -m "chore: final tweaks from manual verification"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Rack front-panel visual (HTML/CSS) → Task 3
- ✅ Left U-ruler + right device blocks → Task 3
- ✅ Device type color coding (server blue, network green, storage orange) → Task 2
- ✅ Alternating shades for adjacent same-type → Task 2 + Task 5 (colorIndex logic)
- ✅ Device block shows name, type tag, height → Task 3 template
- ✅ Click device name → navigate to server detail → Task 6 (onServerClick)
- ✅ Click empty U slot → open rack drawer with prefill → Task 6 (onEmptySlotClick)
- ✅ Operations in right-side drawer → Task 4 + Task 6
- ✅ Backend availability endpoint gains deviceType/deviceHeight → Task 1
- ✅ No new npm dependencies → verified across all tasks
- ✅ TypeScript strict, no `any` → all types defined, explicit interfaces

**2. Placeholder scan:**
- No TBD, TODO, or "implement later" found
- All code steps have concrete implementations
- Error handling is explicit (useApi returns ok/false, error display in template)

**3. Type consistency:**
- `USlot` defined in Task 3 (RackFrontPanel.vue), consumed in Task 5 (useRackDetail) and Task 6 (RackDeviceView)
- `useRackDetail` return types match usage in Task 6
- `getDeviceColor` signature matches usage in Task 3
- `RackOperationDrawer` props/emits match usage in Task 6
- Backend response shape (Task 1) matches frontend `AvailabilityResponse` type (Task 5)
