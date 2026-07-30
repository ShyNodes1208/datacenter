# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the homepage (`/`) with dashboard stat cards at top, expandable room sections showing mini rack front-panel thumbnails, and right-side drawers for import/create operations.

**Architecture:** New `GET /api/dashboard/stats` endpoint aggregates global counts. New `GET /api/rooms/{id}/racks-summary` returns all racks in a room with per-U server occupancy. `RackFrontPanel` gains a `compact` prop for mini thumbnails. `HomeView` is refactored to use `DashboardStats`, `RackOperationDrawer`, and mini rack grids. Import/create panels move into drawers.

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest, .NET 8 (two new endpoints), existing tokens.css, no new npm dependencies.

## Global Constraints

- No new npm dependencies
- Reuse `RackFrontPanel` via `compact` prop for mini thumbnails — no separate mini-rack component
- Reuse `RackOperationDrawer` for import/create panels — no inline panels
- Stat cards: 机房数, 机柜总数, 总U位使用率, 在架服务器数
- Backend follows existing patterns: `[ApiController]`, `[Authorize]`, `AsNoTracking()`, anonymous projections
- Follow existing patterns: `useApi()` for HTTP, `useAuth()` for roles, scoped CSS with tokens.css
- TypeScript strict: no `any` without justification
- TDD: write test first, see it fail, then implement

---

### Task 1: Backend — Dashboard stats endpoint

**Files:**
- Create: `src/backend/Datacenter.Api/Controllers/DashboardController.cs`

**Interfaces:**
- Produces: `GET /api/dashboard/stats` returns:
```json
{
  "totalRooms": number,
  "totalRacks": number,
  "totalU": number,
  "occupiedU": number,
  "usagePercent": number,
  "rackedServers": number
}
```

- [ ] **Step 1: Create the controller**

Create `src/backend/Datacenter.Api/Controllers/DashboardController.cs`:

```csharp
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public sealed class DashboardController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken)
    {
        var totalRooms = await dbContext.Rooms.CountAsync(cancellationToken);

        var rackStats = await dbContext.Racks
            .Select(rack => new { rack.HeightU })
            .ToListAsync(cancellationToken);

        var totalRacks = rackStats.Count;
        var totalU = rackStats.Sum(r => r.HeightU);

        var occupiedU = await dbContext.ServerPositions
            .Where(sp => sp.Status == "在架")
            .Select(sp => sp.EndU - sp.StartU + 1)
            .SumAsync(cancellationToken);

        var rackedServers = await dbContext.ServerPositions
            .Where(sp => sp.Status == "在架")
            .Select(sp => sp.ServerId)
            .Distinct()
            .CountAsync(cancellationToken);

        var usagePercent = totalU > 0
            ? (int)Math.Round((double)occupiedU / totalU * 100)
            : 0;

        return Ok(new
        {
            totalRooms,
            totalRacks,
            totalU,
            occupiedU,
            usagePercent,
            rackedServers
        });
    }
}
```

- [ ] **Step 2: Build and verify**

```bash
cd src/backend/Datacenter.Api && dotnet build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/DashboardController.cs
git commit -m "feat: add dashboard stats endpoint"
```

---

### Task 2: Backend — Room racks-summary endpoint

**Files:**
- Create: `src/backend/Datacenter.Api/Controllers/RoomRacksController.cs`

**Interfaces:**
- Produces: `GET /api/rooms/{id}/racks-summary` returns:
```json
{
  "roomId": "guid",
  "roomName": "string",
  "racks": [
    {
      "id": "guid",
      "code": "string",
      "heightU": number,
      "brand": "string|null",
      "occupiedU": number,
      "positions": [
        { "uNumber": number, "occupied": bool, "serverName?": "string", "deviceType?": "string", "deviceHeight?": number }
      ]
    }
  ]
}
```

- [ ] **Step 1: Create the controller**

Create `src/backend/Datacenter.Api/Controllers/RoomRacksController.cs`:

```csharp
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/rooms")]
public sealed class RoomRacksController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("{id:guid}/racks-summary")]
    public async Task<IActionResult> GetRacksSummary(Guid id, CancellationToken cancellationToken)
    {
        var room = await dbContext.Rooms
            .AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => new { r.Id, r.Name })
            .FirstOrDefaultAsync(cancellationToken);

        if (room is null)
            return NotFound(new { error = "机房不存在" });

        var racks = await dbContext.Racks
            .AsNoTracking()
            .Where(r => r.RoomId == id)
            .Select(r => new
            {
                r.Id,
                r.Code,
                r.HeightU,
                r.Brand
            })
            .ToListAsync(cancellationToken);

        var rackIds = racks.Select(r => r.Id).ToList();

        // Build per-U occupancy map for all servers in this room's racks
        var serverPositions = await dbContext.ServerPositions
            .AsNoTracking()
            .Where(sp => rackIds.Contains(sp.RackId) && sp.Status == "在架")
            .Select(sp => new
            {
                sp.RackId,
                sp.StartU,
                sp.EndU,
                sp.ServerId,
                ServerName = sp.Server.Name,
                DeviceType = sp.Server.DeviceType,
                DeviceHeight = sp.Server.DeviceHeight
            })
            .ToListAsync(cancellationToken);

        // Build occupancy lookup: rackId -> U number -> (serverName, deviceType, deviceHeight)
        var occupancyByRack = new Dictionary<Guid, Dictionary<int, (string ServerName, string DeviceType, int DeviceHeight)>>();
        foreach (var sp in serverPositions)
        {
            if (!occupancyByRack.ContainsKey(sp.RackId))
                occupancyByRack[sp.RackId] = new Dictionary<int, (string, string, int)>();

            for (var u = sp.StartU; u <= sp.EndU; u++)
            {
                occupancyByRack[sp.RackId][u] = (sp.ServerName, sp.DeviceType, sp.DeviceHeight);
            }
        }

        var result = racks.Select(rack =>
        {
            var positions = new List<object>();
            int occupiedCount = 0;
            var hasOccupancy = occupancyByRack.TryGetValue(rack.Id, out var occMap);

            for (var u = rack.HeightU; u >= 1; u--)
            {
                if (hasOccupancy && occMap!.TryGetValue(u, out var occ))
                {
                    occupiedCount++;
                    positions.Add(new
                    {
                        uNumber = u,
                        occupied = true,
                        serverName = occ.ServerName,
                        deviceType = occ.DeviceType,
                        deviceHeight = occ.DeviceHeight
                    });
                }
                else
                {
                    positions.Add(new { uNumber = u, occupied = false });
                }
            }

            return new
            {
                rack.Id,
                rack.Code,
                rack.HeightU,
                rack.Brand,
                occupiedU = occupiedCount,
                positions
            };
        }).ToList();

        return Ok(new
        {
            roomId = room.Id,
            roomName = room.Name,
            racks = result
        });
    }
}
```

- [ ] **Step 2: Build and verify**

```bash
cd src/backend/Datacenter.Api && dotnet build
```

Expected: Build succeeds.

- [ ] **Step 3: Start backend and test the endpoint**

```bash
cd src/backend/Datacenter.Api && dotnet run
```

```bash
# Login and get token (see Task 1 verification pattern)
# Call GET /api/rooms/{roomId}/racks-summary
# Verify response contains racks with positions
```

- [ ] **Step 4: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/RoomRacksController.cs
git commit -m "feat: add room racks-summary endpoint with per-U occupancy"
```

---

### Task 3: Frontend — Add `compact` prop to RackFrontPanel

**Files:**
- Modify: `src/frontend/src/components/RackFrontPanel.vue`

**Interfaces:**
- New prop: `compact?: boolean` (default `false`)
- When `compact === true`:
  - U-ruler hidden (left column removed)
  - U-row height: 4px instead of 24px
  - Device name and type tag hidden, only colored blocks shown
  - Header reduced to just rack code (small font)
  - No hover action buttons
  - Tooltip on hover showing rack code + occupied/total U

- [ ] **Step 1: Add compact prop and conditional rendering**

Modify `src/frontend/src/components/RackFrontPanel.vue`:

In `<script setup>`, add the prop:
```typescript
const props = defineProps<{
  rackCode: string
  heightU: number
  uSlots: USlot[]
  roomId: string
  compact?: boolean
}>()
```

Update `totalRows` to accept compact row height:
```typescript
function totalRows(count: number): string {
  const h = props.compact ? 4 : 24
  return `repeat(${count}, ${h}px)`
}
```

In the template, conditionally hide U-ruler column when compact:
```html
<div class="rfp" :style="{
  display: 'grid',
  gridTemplateColumns: compact ? '1fr' : '48px 1fr',
  gridTemplateRows: 'auto 1fr',
  ...(compact ? { maxWidth: '60px', cursor: 'pointer' } : {})
}">
```

Conditionally render U-ruler and header-left only when not compact:
```html
<div v-if="!compact" class="rfp__header-left"></div>
```

```html
<div v-if="!compact" class="rfp__ruler" ...>
```

For compact device blocks, hide content details:
```html
<!-- In compact mode, just show color block without text -->
<template v-if="block.occupied && block.serverName && !compact">
  <!-- existing content -->
</template>
<template v-else-if="block.occupied && compact">
  <!-- bare colored block, no text -->
</template>
```

Add compact title attribute on the root element:
```html
:title="compact ? `${rackCode} ${statsText}` : undefined"
```

Where `statsText` is a computed:
```typescript
const statsText = computed(() => {
  const occupied = props.uSlots.filter(s => s.occupied).reduce((sum, s) => sum + s.uCount, 0)
  return `${occupied}/${props.heightU}U`
})
```

- [ ] **Step 2: Verify type check**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/components/RackFrontPanel.vue
git commit -m "feat: add compact mode to RackFrontPanel for mini thumbnails"
```

---

### Task 4: Frontend — Create useDashboard composable

**Files:**
- Create: `src/frontend/src/composables/useDashboard.ts`
- Create: `src/frontend/src/__tests__/useDashboard.test.ts`

**Interfaces:**
- Produces:
```typescript
function useDashboard(): {
  stats: Ref<DashboardStats | null>
  rooms: Ref<RoomItem[] | null>
  loading: Ref<boolean>
  error: Ref<string>
  loadStats: () => Promise<void>
  loadRooms: () => Promise<void>
}

interface DashboardStats {
  totalRooms: number
  totalRacks: number
  totalU: number
  occupiedU: number
  usagePercent: number
  rackedServers: number
}

interface RoomItem {
  id: string
  name: string
  status: string
}
```

- [ ] **Step 1: Write the test**

Create `src/frontend/src/__tests__/useDashboard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequest = vi.fn()
vi.mock('../composables/useApi', () => ({
  useApi: () => ({ request: mockRequest }),
}))

import { useDashboard } from '../composables/useDashboard'

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadStats returns DashboardStats on success', async () => {
    mockRequest.mockResolvedValueOnce({
      ok: true,
      data: {
        totalRooms: 3,
        totalRacks: 22,
        totalU: 924,
        occupiedU: 120,
        usagePercent: 13,
        rackedServers: 22,
      },
    })

    const { stats, loadStats } = useDashboard()
    await loadStats()

    expect(stats.value).toEqual({
      totalRooms: 3,
      totalRacks: 22,
      totalU: 924,
      occupiedU: 120,
      usagePercent: 13,
      rackedServers: 22,
    })
  })

  it('loadStats sets error on failure', async () => {
    mockRequest.mockResolvedValueOnce({ ok: false, error: 'fail' })

    const { stats, error, loadStats } = useDashboard()
    await loadStats()

    expect(stats.value).toBeNull()
    expect(error.value).toBe('fail')
  })

  it('loadRooms returns RoomItem array on success', async () => {
    mockRequest.mockResolvedValueOnce({
      ok: true,
      data: [
        { id: '1', name: '机房A', status: '启用' },
        { id: '2', name: '网络机房', status: '启用' },
      ],
    })

    const { rooms, loadRooms } = useDashboard()
    await loadRooms()

    expect(rooms.value).toHaveLength(2)
    expect(rooms.value![0].name).toBe('机房A')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd src/frontend && npx vitest run src/__tests__/useDashboard.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the composable**

Create `src/frontend/src/composables/useDashboard.ts`:

```typescript
import { ref, type Ref } from 'vue'
import { useApi } from './useApi'

export interface DashboardStats {
  totalRooms: number
  totalRacks: number
  totalU: number
  occupiedU: number
  usagePercent: number
  rackedServers: number
}

export interface RoomItem {
  id: string
  name: string
  status: string
}

export function useDashboard() {
  const { request } = useApi()

  const stats = ref<DashboardStats | null>(null)
  const rooms = ref<RoomItem[] | null>(null)
  const loading = ref(false)
  const error = ref('')

  async function loadStats(): Promise<void> {
    error.value = ''
    const result = await request<DashboardStats>('/api/dashboard/stats', { method: 'GET' })
    if (!result.ok) {
      error.value = result.error
      stats.value = null
      return
    }
    stats.value = result.data
  }

  async function loadRooms(): Promise<void> {
    error.value = ''
    const result = await request<unknown>('/api/rooms', { method: 'GET' })
    if (!result.ok) {
      error.value = result.error
      rooms.value = null
      return
    }
    if (!Array.isArray(result.data)) {
      error.value = 'Request failed.'
      rooms.value = null
      return
    }
    const parsed: RoomItem[] = []
    for (const item of result.data) {
      if (item === null || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      if (
        typeof record.id === 'string' &&
        typeof record.name === 'string' &&
        typeof record.status === 'string'
      ) {
        parsed.push({ id: record.id, name: record.name, status: record.status })
      }
    }
    rooms.value = parsed
  }

  return { stats, rooms, loading, error, loadStats, loadRooms }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd src/frontend && npx vitest run src/__tests__/useDashboard.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/composables/useDashboard.ts src/frontend/src/__tests__/useDashboard.test.ts
git commit -m "feat: add useDashboard composable for stats and rooms"
```

---

### Task 5: Frontend — Create DashboardStats component

**Files:**
- Create: `src/frontend/src/components/DashboardStats.vue`

**Interfaces:**
- Consumes: `DashboardStats` from `../composables/useDashboard`
- Produces: `<DashboardStats>` component

**Props:**
```typescript
interface Props {
  stats: DashboardStats
}
```

- [ ] **Step 1: Create the component**

Create `src/frontend/src/components/DashboardStats.vue`:

```vue
<script setup lang="ts">
import type { DashboardStats } from '../composables/useDashboard'

defineProps<{
  stats: DashboardStats
}>()
</script>

<template>
  <div class="dash-stats">
    <div class="dash-stat-card">
      <div class="dash-stat-card__value">{{ stats.totalRooms }}</div>
      <div class="dash-stat-card__label">机房总数</div>
    </div>
    <div class="dash-stat-card">
      <div class="dash-stat-card__value">{{ stats.totalRacks }}</div>
      <div class="dash-stat-card__label">机柜总数</div>
    </div>
    <div class="dash-stat-card">
      <div class="dash-stat-card__value">{{ stats.usagePercent }}%</div>
      <div class="dash-stat-card__label">U位使用率</div>
      <div class="dash-stat-card__sub">{{ stats.occupiedU }} / {{ stats.totalU }}U</div>
    </div>
    <div class="dash-stat-card">
      <div class="dash-stat-card__value">{{ stats.rackedServers }}</div>
      <div class="dash-stat-card__label">在架服务器</div>
    </div>
  </div>
</template>

<style scoped>
.dash-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.dash-stat-card {
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius, 6px);
  padding: var(--space-md);
  box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,0.1));
  text-align: center;
}

.dash-stat-card__value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-primary, #4a90d9);
  line-height: 1.2;
}

.dash-stat-card__label {
  font-size: var(--font-sm, 12px);
  color: var(--color-text-secondary, #888);
  margin-top: 4px;
}

.dash-stat-card__sub {
  font-size: 11px;
  color: var(--color-text-secondary, #888);
  margin-top: 2px;
}
</style>
```

- [ ] **Step 2: Verify type check**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/components/DashboardStats.vue
git commit -m "feat: add DashboardStats component with 4 stat cards"
```

---

### Task 6: Frontend — Refactor HomeView

**Files:**
- Modify: `src/frontend/src/views/HomeView.vue`

**What stays (preserved from current HomeView):**
- CRUD logic for rooms (create, edit, delete)
- Import logic for racks, devices, servers
- Role-based `canEdit`/`isRoomAdmin`/`canDeleteRoom` computed
- CSRF token handling
- All reactive state for forms

**What changes:**
- Top of page: add `<DashboardStats>` component
- Room card header: keep expand/collapse + edit/delete buttons
- Room expanded area: replace rack-card grid with mini `RackFrontPanel` thumbnails
- Rack mini thumbnail: click → navigate to rack detail, tooltip shows code + occupancy
- Import/create panels: move into `<RackOperationDrawer>` instances
- Remove old `.rack-card` CSS and related styles
- Use `GET /api/rooms/{id}/racks-summary` instead of `GET /api/racks?roomId=`

**New imports:**
```typescript
import { useDashboard } from '../composables/useDashboard'
import DashboardStats from '../components/DashboardStats.vue'
import RackFrontPanel from '../components/RackFrontPanel.vue'
import RackOperationDrawer from '../components/RackOperationDrawer.vue'
import type { USlot } from '../components/RackFrontPanel.vue'
```

**New state:**
```typescript
const { stats, rooms, loadStats, loadRooms } = useDashboard()
const roomRackSummaries = ref<Map<string, { racks: RackSummaryItem[] }>>(new Map())
const summaryLoading = ref<Set<string>>(new Set())

interface RackSummaryItem {
  id: string
  code: string
  heightU: number
  brand: string | null
  occupiedU: number
  positions: USlot[]
}
```

**Data flow:**
- `onMounted`: call both `loadStats()` and `loadRooms()` (replaces old `loadRooms()`)
- `toggleRoom(roomId)`: call `GET /api/rooms/{roomId}/racks-summary`, convert positions to USlot[], store in `roomRackSummaries`
- Delete the old `loadRooms()` function — replaced by `useDashboard().loadRooms()`

**Template structure:**
```html
<template>
  <div class="home-page">
    <!-- Stat cards -->
    <DashboardStats v-if="stats" :stats="stats" />

    <!-- Toolbar -->
    <div class="toolbar">
      <button @click="openDrawer('importRacks')">Excel 导入机柜</button>
      <button @click="openDrawer('importDevices')">批量导入设备</button>
      <button @click="openDrawer('importServers')">Excel 导入服务器</button>
      <button v-if="isRoomAdmin" @click="openDrawer('createRoom')">新增机房</button>
    </div>

    <!-- Room list -->
    <section class="room-list">
      <div v-for="room in rooms" :key="room.id" class="room-card">
        <div class="room-card__header" @click="toggleRoom(room.id)">
          <!-- arrow, name, status, floorplan link, edit, delete -->
        </div>
        <div v-if="expandedRoomId === room.id" class="room-rack-grid">
          <div v-if="summaryLoading.has(room.id)">加载中...</div>
          <div v-else-if="!roomRackSummaries.has(room.id)">加载失败</div>
          <div v-else class="mini-rack-grid">
            <RackFrontPanel
              v-for="rack in roomRackSummaries.get(room.id)!.racks"
              :key="rack.id"
              :rack-code="rack.code"
              :height-u="rack.heightU"
              :u-slots="rack.positions"
              :room-id="room.id"
              compact
              @click="goToRack(rack.id)"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Drawers for import/create -->
    <RackOperationDrawer :visible="drawer === 'importRacks'" title="Excel 导入机柜" @close="closeDrawer">
      <!-- Import rack form (keep existing logic, wrap in drawer) -->
    </RackOperationDrawer>
    <!-- ... more drawers ... -->
  </div>
</template>
```

- [ ] **Step 1: Rewrite the template section**

Replace the entire `<template>` block with the new structure. Keep ALL existing form logic in `<script>`. Move the import preview tables, create room form, batch import panel, and server import panel into their respective `<RackOperationDrawer>` instances.

Key change in `toggleRoom`:
```typescript
async function toggleRoom(roomId: string): Promise<void> {
  if (expandedRoomId.value === roomId) {
    expandedRoomId.value = null
    return
  }
  expandedRoomId.value = roomId

  if (!roomRackSummaries.value.has(roomId)) {
    summaryLoading.value.add(roomId)
    const result = await request<{ racks: RackSummaryItem[] }>(
      `/api/rooms/${roomId}/racks-summary`,
      { method: 'GET' },
    )
    if (result.ok && result.data) {
      const map = new Map(roomRackSummaries.value)
      map.set(roomId, result.data)
      roomRackSummaries.value = map
    }
    summaryLoading.value.delete(roomId)
  }
}
```

- [ ] **Step 2: Update the style section**

Remove old styles: `.rack-card`, `.rack-card__code`, `.rack-card__stats`, `.rack-card__brand`.

Add new styles:
```css
.mini-rack-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  padding: var(--space-md);
}

.mini-rack-grid > * {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.mini-rack-grid > *:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

- [ ] **Step 3: Type check and tests**

```bash
cd src/frontend && npx vue-tsc --noEmit && npx vitest run
```

Expected: no type errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/frontend/src/views/HomeView.vue
git commit -m "refactor: redesign homepage with dashboard stats and mini rack thumbnails"
```

---

### Task 7: Manual verification

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1
cd src/backend/Datacenter.Api && dotnet run

# Terminal 2
cd src/frontend && npm run dev
```

- [ ] **Step 2: Verify the homepage**

1. Open `http://localhost:5174`, login as `admin / admin123`
2. Verify 4 stat cards show correct counts (3 rooms, 22 racks, usage%, 22 servers)
3. Expand a room → mini rack thumbnails appear as colored blocks
4. Hover a mini rack → tooltip shows code + occupied/total U
5. Click a mini rack → navigates to rack detail page
6. Click "新增机房" → drawer slides in from right with create form
7. Click import buttons → drawers with upload forms
8. Verify edit/delete room still works

- [ ] **Step 3: Final commit if fixes needed**

```bash
git add -A && git commit -m "chore: final tweaks from manual verification"
```
