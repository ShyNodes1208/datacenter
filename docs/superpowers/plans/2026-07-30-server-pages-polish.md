# Server Pages Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the server list page and server detail page with colored status tags, device-type color coding, and clickable room/rack links from detail page.

**Architecture:** One backend change: `GET /api/servers/{id}` adds roomId/rackId/roomName/rackCode/uRange from ServerPositions. Frontend CSS/template polish on list and detail pages. Reuse `getDeviceColor` from `deviceColors.ts` for device type tags. Add clickable navigation links from detail page to floorplan and rack detail.

**Tech Stack:** Vue 3 + TypeScript + Vitest, existing tokens.css, no new dependencies.

## Global Constraints

- Backend: add roomId/rackId/roomName/rackCode/uRange to `GET /api/servers/{id}` response
- Reuse `getDeviceColor` from `../utils/deviceColors` for device type tag colors
- Status tags: 正常→green, 异常→red, 维护→orange; 在架→green, 未上架→gray, 已下架→orange
- Remove "（人工维护）" suffix from operational status display
- Table stays table, detail stays cards — structural layout unchanged
- TypeScript strict, scoped CSS

---

### Task 0: Backend — Add position info to server detail endpoint

**Files:**
- Modify: `src/backend/Datacenter.Api/Controllers/ServersController.cs` (lines 80-107)

**Change:** The `GET /api/servers/{id}` endpoint currently only returns server fields. It needs to join ServerPositions + Rack + Room to return position info.

Replace the query (lines 83-98) with:

```csharp
var server = await dbContext.Servers
    .AsNoTracking()
    .Select(item => new
    {
        item.Id,
        item.Name,
        item.ManagementIP,
        item.AssetNumber,
        item.DeviceType,
        item.DeviceHeight,
        item.OperationalStatus,
        item.PositionStatus,
        item.System,
        item.Owner,
        item.Notes,
        RoomName = dbContext.ServerPositions
            .Where(sp => sp.ServerId == item.Id && sp.Status == "在架")
            .Select(sp => sp.Rack.Room.Name)
            .FirstOrDefault(),
        RoomId = dbContext.ServerPositions
            .Where(sp => sp.ServerId == item.Id && sp.Status == "在架")
            .Select(sp => sp.Rack.RoomId)
            .FirstOrDefault(),
        RackCode = dbContext.ServerPositions
            .Where(sp => sp.ServerId == item.Id && sp.Status == "在架")
            .Select(sp => sp.Rack.Code)
            .FirstOrDefault(),
        RackId = dbContext.ServerPositions
            .Where(sp => sp.ServerId == item.Id && sp.Status == "在架")
            .Select(sp => sp.RackId)
            .FirstOrDefault(),
        URange = dbContext.ServerPositions
            .Where(sp => sp.ServerId == item.Id && sp.Status == "在架")
            .Select(sp => sp.StartU + "-" + sp.EndU)
            .FirstOrDefault()
    })
    .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
```

This uses sub-queries so it works as a single round-trip. RoomId/RackId are `Guid?` (nullable). RoomName/RackCode/URange are `string?`.

- [ ] **Step 1: Make the change and build**

```bash
cd src/backend/Datacenter.Api && dotnet build
```

Expected: Build succeeds.

- [ ] **Step 2: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/ServersController.cs
git commit -m "feat: add room/rack position info to server detail endpoint"
```

---

### Task 1: ServerListView — Refined table

**Files:**
- Modify: `src/frontend/src/views/ServerListView.vue`

**Changes:**

1. Import `getDeviceColor`:
```typescript
import { getDeviceColor } from '../utils/deviceColors'
```

2. Add helper functions for status tag classes:
```typescript
function opStatusClass(status: string): string {
  if (status === '正常') return 'status-tag status-tag--success'
  if (status === '异常') return 'status-tag status-tag--danger'
  if (status === '维护') return 'status-tag status-tag--warning'
  return 'status-tag'
}

function posStatusClass(status: string): string {
  if (status === '在架') return 'status-tag status-tag--success'
  if (status === '已下架') return 'status-tag status-tag--warning'
  return 'status-tag status-tag--muted'
}

function deviceTagStyle(type: string): Record<string, string> {
  const c = getDeviceColor(type, 0)
  return { background: c.background, color: c.text }
}
```

3. Update template:

Change the position status cell from:
```html
<td>{{ server.positionStatus }}</td>
```
To:
```html
<td><span :class="posStatusClass(server.positionStatus)">{{ server.positionStatus }}</span></td>
```

Change the operational status cell from:
```html
<td>{{ server.operationalStatus }}（人工维护）</td>
```
To:
```html
<td><span :class="opStatusClass(server.operationalStatus)">{{ server.operationalStatus }}</span></td>
```

Change the device type cell from:
```html
<td>{{ server.deviceType }}</td>
```
To:
```html
<td>
  <span class="device-tag" :style="deviceTagStyle(server.deviceType)">{{ server.deviceType }}</span>
</td>
```

4. Add new CSS for status tags and device tags:
```css
.status-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: var(--font-sm);
  font-weight: 500;
}

.status-tag--success {
  background: #e6f7e6;
  color: #2d8a2d;
}

.status-tag--danger {
  background: #fde8e8;
  color: #c0392b;
}

.status-tag--warning {
  background: #fef3e0;
  color: #b8731f;
}

.status-tag--muted {
  background: #eef1f5;
  color: #666;
}

.device-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: var(--font-sm);
  font-weight: 500;
}
```

- [ ] **Step 1: Make the changes**

- [ ] **Step 2: Verify**
```bash
cd src/frontend && npx vue-tsc --noEmit && npx vitest run
```
Expected: no type errors, all tests pass.

- [ ] **Step 3: Commit**
```bash
git add src/frontend/src/views/ServerListView.vue
git commit -m "feat: polish server list with colored status tags and device type badges"
```

---

### Task 2: ServerDetailView — Clickable room/rack links + status tags

**Files:**
- Modify: `src/frontend/src/views/ServerDetailView.vue`

**Changes:**

1. Import `getDeviceColor`:
```typescript
import { getDeviceColor } from '../utils/deviceColors'
```

2. Add device type tag function and nav helpers:
```typescript
function deviceTagStyle(type: string): Record<string, string> {
  const c = getDeviceColor(type, 0)
  return { background: c.background, color: c.text }
}

function goToRoom(roomId: string): void {
  // roomId is not in the response; we navigate by room name via floorplan
  // Use the roomId from the rack — we need to get it. For now, navigate to homepage.
  router.push('/')
}

function goToRack(rackId: string): void {
  router.push(`/racks/${encodeURIComponent(rackId)}`)
}
```

Wait — the API returns `roomName` and `rackCode` but NOT `roomId` and `rackId`. Check the backend `GET /api/servers/{id}` to see what's available.

**Check the ServersController detail endpoint first.** If roomId/rackId are missing, add them to the backend response.

3. Update template — position card:

Also update the `ServerDetail` type to include `roomId` and `rackId`:

```typescript
type ServerDetail = {
  // ... existing fields ...
  roomId?: string | null
  roomName?: string | null
  rackId?: string | null
  rackCode?: string | null
  uRange?: string | null
}
```

And add them to the parsed record:
```typescript
server.value = {
  // ... existing assignments ...
  roomId: typeof record.roomId === 'string' ? record.roomId : null,
  roomName: typeof record.roomName === 'string' ? record.roomName : null,
  rackId: typeof record.rackId === 'string' ? record.rackId : null,
  rackCode: typeof record.rackCode === 'string' ? record.rackCode : null,
  uRange: typeof record.uRange === 'string' ? record.uRange : null,
}
```

Update the position card template:

```html
<section class="card">
  <h3 class="card__title">当前位置</h3>
  <template v-if="server.positionStatus === '未上架'">
    <p><span class="status-tag status-tag--muted">未上架</span></p>
  </template>
  <template v-else-if="server.positionStatus === '已下架'">
    <p><span class="status-tag status-tag--warning">已下架</span></p>
    <p v-if="server.roomName">原机房：{{ server.roomName }}</p>
    <p v-if="server.rackCode">原机柜：{{ server.rackCode }}</p>
    <p v-if="server.uRange">原 U 位：{{ server.uRange }}</p>
  </template>
  <template v-else>
    <p><span class="status-tag status-tag--success">在架</span></p>
    <p>
      机房：
      <a v-if="server.roomId" href="#" @click.prevent="router.push(`/rooms/${server.roomId}/floorplan`)">
        {{ server.roomName }}
      </a>
      <span v-else>{{ server.roomName ?? '-' }}</span>
    </p>
    <p>
      机柜：
      <a v-if="server.rackId" href="#" @click.prevent="router.push(`/racks/${server.rackId}`)">
        {{ server.rackCode }}
      </a>
      <span v-else>{{ server.rackCode ?? '-' }}</span>
    </p>
    <p>U 位范围：{{ server.uRange ?? '-' }}</p>
  </template>
</section>
```

4. Update the basic info card — add device type tag and status tags:

Replace device type and status fields with tagged versions:
- Device type: `<span class="device-tag" :style="deviceTagStyle(server.deviceType)">{{ server.deviceType }}</span>`
- Operational status: `<span class="status-tag" :class="opStatusClass(server.operationalStatus)">{{ server.operationalStatus }}</span>`
- Position status in basic info: `<span class="status-tag" :class="posStatusClass(server.positionStatus)">{{ server.positionStatus }}</span>`

5. Add CSS (same tag styles as Task 1, plus link styles):
```css
.card a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}
.card a:hover {
  text-decoration: underline;
}

/* same status-tag and device-tag styles as ServerListView */
```

**If roomId/rackId missing from API:** Need to add them to the backend `GET /api/servers/{id}` endpoint.

- [ ] **Step 1: Check if roomId/rackId are in the server detail response**

Check `ServersController.cs` detail endpoint. If missing, add:
```csharp
// In the detail query, add:
roomId = serverPosition.Rack.RoomId,
rackId = serverPosition.RackId,
```

- [ ] **Step 2: Make frontend changes**

- [ ] **Step 3: Verify**
```bash
cd src/frontend && npx vue-tsc --noEmit && npx vitest run
cd src/backend/Datacenter.Api && dotnet build
```
Expected: no type errors, all tests pass, backend builds.

- [ ] **Step 4: Commit**
```bash
git add src/frontend/src/views/ServerDetailView.vue
# If backend changed:
git add src/backend/Datacenter.Api/Controllers/ServersController.cs
git commit -m "feat: polish server detail with status tags and clickable room/rack links"
```

---

### Task 3: Manual verification

- [ ] **Step 1: Start services**
```bash
cd src/backend/Datacenter.Api && dotnet run
cd src/frontend && npm run dev
```

- [ ] **Step 2: Verify server list**
1. Open `http://localhost:5173/servers`
2. Verify device type columns show colored badges (blue=服务器, green=交换机, etc.)
3. Verify position status shows colored tags (green=在架, gray=未上架, orange=已下架)
4. Verify operational status shows colored tags (green=正常, red=异常, orange=维护)
5. Verify "（人工维护）" suffix is gone

- [ ] **Step 3: Verify server detail**
1. Click a server name → detail page
2. Verify device type has colored badge
3. Verify status fields have colored tags
4. Click room name → navigates to floorplan
5. Click rack code → navigates to rack detail
6. Verify audit records table still renders correctly

- [ ] **Step 4: Final commit if fixes needed**
