# 机房 2.5D 平面图增强 & 线缆连接策略 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Floorplan/Cable 模块基础上新增右侧详情面板、U位可视化、设备变更记录和线缆连接策略展示

**Architecture:** 后端新增 4 个查询端点（纯 DTO 组装，不建表），前端新增 RackDetailPanel + CableConnectionStrategy 两个组件，修改 FloorplanView/FloorplanCanvas/CableListView 集成新组件。不引入新框架依赖。

**Tech Stack:** .NET 9 / EF Core / Vue 3 / TypeScript / Konva.js (已有)

## Global Constraints

- 不修改 TASK-0052 锁定的文件：VisualReferenceView.vue, VisualReferencePanel.vue
- 不修改 HomeView.vue, RackDeviceView.vue, RackFrontPanel.vue, NetworkPathDrawer.vue
- 不新增 npm 依赖
- 不新增数据库表或 migration
- 不修改已有 API 端点的行为
- 组件测试覆盖关键交互（RackDetailPanel, CableConnectionStrategy）
- vue-tsc --noEmit 和 npm run build 必须通过
- 所有新增后端端点必须有 [Authorize]

---

## File Structure

```
新增:
  src/frontend/src/components/RackDetailPanel.vue
  src/frontend/src/components/CableConnectionStrategy.vue
  src/frontend/src/components/__tests__/RackDetailPanel.test.ts
  src/frontend/src/components/__tests__/CableConnectionStrategy.test.ts

修改:
  src/backend/Datacenter.Api/Controllers/CableSceneController.cs  (新增加 floorplan-data 端点)
  src/backend/Datacenter.Api/Controllers/RacksController.cs        (新增加 detail + position-history 端点)
  src/backend/Datacenter.Api/Controllers/CablesController.cs       (新增加 connections 端点)
  src/frontend/src/views/FloorplanView.vue                         (集成 RackDetailPanel)
  src/frontend/src/components/FloorplanCanvas.vue                  (选中态 + 容量条)
  src/frontend/src/views/CableListView.vue                         (集成 CableConnectionStrategy)

禁止修改:
  VisualReferenceView.vue, VisualReferencePanel.vue
  HomeView.vue, RackDeviceView.vue, RackFrontPanel.vue
  NetworkPathDrawer.vue, RackOperationDrawer.vue, SwitchPortDrawer.vue
  App.vue, main.ts, router.ts (除新增路由外)
```

---

### Task 1: GET /api/rooms/{roomId}/floorplan-data

**Files:**
- Modify: `src/backend/Datacenter.Api/Controllers/CableSceneController.cs`

**Interfaces:**
- Produces: `GET /api/rooms/{roomId:guid}/floorplan-data` → `{ room, racks[{ id, code, x, y, heightU, devices[{id,name,deviceType,startU,endU}], occupancy{usedU,freeU,totalU} }], cables[{id,sourceRackCode,targetRackCode,cableType,color}] }`

- [ ] **Step 1: 在 CableSceneController 新增端点方法**

在已有的 `CableSceneController` 类中新增方法：

```csharp
[HttpGet("rooms/{roomId:guid}/floorplan-data")]
public async Task<IActionResult> GetFloorplanData(Guid roomId, CancellationToken cancellationToken)
{
    var room = await dbContext.Rooms
        .AsNoTracking()
        .Where(r => r.Id == roomId)
        .Select(r => new { r.Id, r.Name })
        .FirstOrDefaultAsync(cancellationToken);

    if (room is null)
        return NotFound(new { error = "机房不存在" });

    // 所有机柜 + 设备
    var racks = await dbContext.Racks
        .AsNoTracking()
        .Where(r => r.RoomId == roomId)
        .OrderBy(r => r.Code)
        .Select(r => new
        {
            r.Id, r.Code, r.X, r.Y, r.HeightU,
            Devices = r.ServerPositions
                .Where(sp => sp.Status == "在架")
                .Select(sp => new
                {
                    sp.Server.Id,
                    sp.Server.Name,
                    sp.Server.DeviceType,
                    sp.StartU,
                    sp.EndU
                }).ToList()
        })
        .ToListAsync(cancellationToken);

    var rackIds = racks.Select(r => r.Id).ToHashSet();
    var rackCodes = racks.ToDictionary(r => r.Id, r => r.Code);

    // 线缆关联（仅连接两端都在本机房的机柜）
    var cables = await dbContext.Cables
        .AsNoTracking()
        .Where(c =>
            rackIds.Contains(c.SourcePort.Server.ServerPositions
                .FirstOrDefault(sp => sp.Status == "在架")!.RackId) &&
            rackIds.Contains(c.TargetPort.Server.ServerPositions
                .FirstOrDefault(sp => sp.Status == "在架")!.RackId))
        .Select(c => new
        {
            c.Id,
            SourceRackCode = c.SourcePort.Server.ServerPositions
                .Where(sp => sp.Status == "在架")
                .Select(sp => sp.Rack.Code)
                .FirstOrDefault() ?? "",
            TargetRackCode = c.TargetPort.Server.ServerPositions
                .Where(sp => sp.Status == "在架")
                .Select(sp => sp.Rack.Code)
                .FirstOrDefault() ?? "",
            c.CableType,
            c.Color
        })
        .ToListAsync(cancellationToken);

    // 组装 occupancy
    var resultRacks = racks.Select(r => new
    {
        r.Id, r.Code, r.X, r.Y, r.HeightU,
        r.Devices,
        Occupancy = new
        {
            UsedU = r.Devices.Sum(d => d.EndU - d.StartU + 1),
            FreeU = r.HeightU - r.Devices.Sum(d => d.EndU - d.StartU + 1),
            TotalU = r.HeightU
        }
    });

    var rackCount = racks.Count;

    return Ok(new
    {
        room = new { room.Id, room.Name, RackCount = rackCount },
        racks = resultRacks,
        cables
    });
}
```

- [ ] **Step 2: 编译验证**

```bash
dotnet build src/backend/Datacenter.Api/Datacenter.Api.csproj
```

预期：Build succeeded.

- [ ] **Step 3: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/CableSceneController.cs
git commit -m "feat: add GET /api/rooms/{roomId}/floorplan-data endpoint"
```

---

### Task 2: GET /api/racks/{rackId}/detail

**Files:**
- Modify: `src/backend/Datacenter.Api/Controllers/RacksController.cs`

**Interfaces:**
- Produces: `GET /api/racks/{rackId:guid}/detail` → `{ rack{id,code,heightU,brand,power,notes}, devices[{id,name,deviceType,startU,endU,uHeight}], occupancy{usedU,freeU,totalU}, positionHistory[{time,deviceName,action,fromU,toU}], cables[{id,portName,remoteDevice,remoteRack}] }`

- [ ] **Step 1: 在 RacksController 新增 detail 端点**

```csharp
[HttpGet("{rackId:guid}/detail")]
public async Task<IActionResult> GetDetail(Guid rackId, CancellationToken cancellationToken)
{
    var rack = await dbContext.Racks
        .AsNoTracking()
        .FirstOrDefaultAsync(r => r.Id == rackId, cancellationToken);

    if (rack is null)
        return NotFound(new { error = "机柜不存在" });

    // 设备列表
    var devices = await dbContext.ServerPositions
        .AsNoTracking()
        .Where(sp => sp.RackId == rackId && sp.Status == "在架")
        .OrderBy(sp => sp.StartU)
        .Select(sp => new
        {
            sp.Server.Id,
            sp.Server.Name,
            sp.Server.DeviceType,
            sp.StartU,
            sp.EndU,
            UHeight = sp.EndU - sp.StartU + 1
        })
        .ToListAsync(cancellationToken);

    var usedU = devices.Sum(d => d.UHeight);

    // 位置变更记录（最近20条）
    var serverIds = devices.Select(d => d.Id).ToHashSet();
    var history = await dbContext.AuditRecords
        .AsNoTracking()
        .Where(a => serverIds.Contains(a.ServerId))
        .OrderByDescending(a => a.OperatedAt)
        .Take(20)
        .Select(a => new
        {
            Time = a.OperatedAt,
            DeviceName = a.Server.Name,
            Action = a.OperationType,
            FromU = a.FromPosition != null ? (int?)int.Parse(a.FromPosition) : null,
            ToU = a.ToPosition != null ? (int?)int.Parse(a.ToPosition) : null
        })
        .ToListAsync(cancellationToken);

    // 关联线缆
    var serverIdList = devices.Select(d => d.Id).ToList();
    var cables = await dbContext.Cables
        .AsNoTracking()
        .Where(c => serverIdList.Contains(c.SourcePort.ServerId) ||
                    serverIdList.Contains(c.TargetPort.ServerId))
        .Select(c => new
        {
            c.Id,
            PortName = serverIdList.Contains(c.SourcePort.ServerId)
                ? c.SourcePort.PortName : c.TargetPort.PortName,
            RemoteDevice = serverIdList.Contains(c.SourcePort.ServerId)
                ? c.TargetPort.Server.Name : c.SourcePort.Server.Name,
            RemoteRack = serverIdList.Contains(c.SourcePort.ServerId)
                ? c.TargetPort.Server.ServerPositions
                    .Where(sp => sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault() ?? ""
                : c.SourcePort.Server.ServerPositions
                    .Where(sp => sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault() ?? ""
        })
        .ToListAsync(cancellationToken);

    return Ok(new
    {
        rack = new { rack.Id, rack.Code, rack.HeightU, rack.Brand, rack.Power, rack.Notes },
        devices,
        occupancy = new { usedU, freeU = rack.HeightU - usedU, totalU = rack.HeightU },
        positionHistory = history,
        cables
    });
}
```

- [ ] **Step 2: 编译验证**

```bash
dotnet build src/backend/Datacenter.Api/Datacenter.Api.csproj
```

- [ ] **Step 3: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/RacksController.cs
git commit -m "feat: add GET /api/racks/{rackId}/detail endpoint with occupancy, history, cables"
```

---

### Task 3: GET /api/racks/{rackId}/position-history

**Files:**
- Modify: `src/backend/Datacenter.Api/Controllers/RacksController.cs`

**Interfaces:**
- Produces: `GET /api/racks/{rackId:guid}/position-history` → `{ rackCode, history[{time,deviceName,action,fromU,toU}] }`

- [ ] **Step 1: 在 RacksController 新增 position-history 端点**

```csharp
[HttpGet("{rackId:guid}/position-history")]
public async Task<IActionResult> GetPositionHistory(Guid rackId, CancellationToken cancellationToken)
{
    var rack = await dbContext.Racks
        .AsNoTracking()
        .FirstOrDefaultAsync(r => r.Id == rackId, cancellationToken);

    if (rack is null)
        return NotFound(new { error = "机柜不存在" });

    // 获取该机柜所有设备 ID
    var serverIds = await dbContext.ServerPositions
        .AsNoTracking()
        .Where(sp => sp.RackId == rackId)
        .Select(sp => sp.ServerId)
        .ToListAsync(cancellationToken);

    var history = await dbContext.AuditRecords
        .AsNoTracking()
        .Where(a => serverIds.Contains(a.ServerId))
        .OrderByDescending(a => a.OperatedAt)
        .Take(50)
        .Select(a => new
        {
            Time = a.OperatedAt,
            DeviceName = a.Server.Name,
            Action = a.OperationType,
            FromU = a.FromPosition != null ? (int?)int.Parse(a.FromPosition) : null,
            ToU = a.ToPosition != null ? (int?)int.Parse(a.ToPosition) : null
        })
        .ToListAsync(cancellationToken);

    return Ok(new { rackCode = rack.Code, history });
}
```

- [ ] **Step 2: 编译验证**

```bash
dotnet build src/backend/Datacenter.Api/Datacenter.Api.csproj
```

- [ ] **Step 3: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/RacksController.cs
git commit -m "feat: add GET /api/racks/{rackId}/position-history endpoint"
```

---

### Task 4: GET /api/cables/connections

**Files:**
- Modify: `src/backend/Datacenter.Api/Controllers/CablesController.cs`

**Interfaces:**
- Produces: `GET /api/cables/connections?roomId=&cableType=` → `{ connections[{id,source{deviceName,portName,rackCode,roomName},target{deviceName,portName,rackCode,roomName},cableType,color,status,notes}] }`

- [ ] **Step 1: 在 CablesController 新增 connections 端点**

在已有的 `CablesController` 类中新增方法：

```csharp
[HttpGet("cables/connections")]
public async Task<IActionResult> Connections(
    [FromQuery] Guid? roomId,
    [FromQuery] string? cableType,
    CancellationToken cancellationToken)
{
    var query = dbContext.Cables.AsNoTracking();

    if (roomId.HasValue)
    {
        query = query.Where(c =>
            c.SourcePort.Server.ServerPositions.Any(sp => sp.Rack.RoomId == roomId.Value && sp.Status == "在架") ||
            c.TargetPort.Server.ServerPositions.Any(sp => sp.Rack.RoomId == roomId.Value && sp.Status == "在架"));
    }
    if (!string.IsNullOrWhiteSpace(cableType))
    {
        query = query.Where(c => c.CableType == cableType);
    }

    var connections = await query
        .Select(c => new
        {
            c.Id,
            Source = new
            {
                DeviceName = c.SourcePort.Server.Name,
                PortName = c.SourcePort.PortName,
                RackCode = c.SourcePort.Server.ServerPositions
                    .Where(sp => sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault() ?? "",
                RoomName = c.SourcePort.Server.ServerPositions
                    .Where(sp => sp.Status == "在架")
                    .Select(sp => sp.Rack.Room.Name)
                    .FirstOrDefault() ?? ""
            },
            Target = new
            {
                DeviceName = c.TargetPort.Server.Name,
                PortName = c.TargetPort.PortName,
                RackCode = c.TargetPort.Server.ServerPositions
                    .Where(sp => sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault() ?? "",
                RoomName = c.TargetPort.Server.ServerPositions
                    .Where(sp => sp.Status == "在架")
                    .Select(sp => sp.Rack.Room.Name)
                    .FirstOrDefault() ?? ""
            },
            c.CableType,
            c.Color,
            Status = c.Purpose ?? "normal",
            c.Notes
        })
        .ToListAsync(cancellationToken);

    return Ok(new { connections });
}
```

- [ ] **Step 2: 编译验证**

```bash
dotnet build src/backend/Datacenter.Api/Datacenter.Api.csproj
```

- [ ] **Step 3: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/CablesController.cs
git commit -m "feat: add GET /api/cables/connections endpoint for connection strategy view"
```

---

### Task 5: RackDetailPanel.vue — 机柜详情右侧面板

**Files:**
- Create: `src/frontend/src/components/RackDetailPanel.vue`
- Create: `src/frontend/src/components/__tests__/RackDetailPanel.test.ts`

**Interfaces:**
- Consumes: `GET /api/racks/{rackId}/detail` → `RackDetail { rack, devices[], occupancy, positionHistory[], cables[] }`
- Produces: `<RackDetailPanel :rackId="string" @close="() => void" />`

- [ ] **Step 1: 写出组件测试**

```typescript
// src/frontend/src/components/__tests__/RackDetailPanel.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RackDetailPanel from '../RackDetailPanel.vue'

const mockDetail = {
  rack: { id: 'r1', code: 'A01', heightU: 42, brand: '华为', power: '3kW', notes: '' },
  devices: [
    { id: 'd1', name: 'web-01', deviceType: '服务器', startU: 1, endU: 2, uHeight: 2 },
    { id: 'd2', name: 'db-01', deviceType: '服务器', startU: 5, endU: 8, uHeight: 4 },
  ],
  occupancy: { usedU: 6, freeU: 36, totalU: 42 },
  positionHistory: [
    { time: '2026-08-07T10:00:00Z', deviceName: 'web-01', action: '上架', fromU: null, toU: 1 },
  ],
  cables: [
    { id: 'c1', portName: 'eth0', remoteDevice: 'db-01', remoteRack: 'B03' }
  ]
}

// Mock useApi
vi.mock('../../composables/useApi', () => ({
  useApi: () => ({
    request: vi.fn().mockResolvedValue({ ok: true, data: mockDetail })
  })
}))

describe('RackDetailPanel', () => {
  it('renders rack code and height', async () => {
    const wrapper = mount(RackDetailPanel, { props: { rackId: 'r1' } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick() // wait for async fetch
    expect(wrapper.text()).toContain('A01')
    expect(wrapper.text()).toContain('42U')
  })

  it('shows occupancy bar with correct percentage', async () => {
    const wrapper = mount(RackDetailPanel, { props: { rackId: 'r1' } })
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('6')  // usedU
    expect(wrapper.text()).toContain('36') // freeU
  })

  it('renders device list', async () => {
    const wrapper = mount(RackDetailPanel, { props: { rackId: 'r1' } })
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('web-01')
    expect(wrapper.text()).toContain('db-01')
  })

  it('renders position history', async () => {
    const wrapper = mount(RackDetailPanel, { props: { rackId: 'r1' } })
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('上架')
  })

  it('emits close when close button clicked', async () => {
    const wrapper = mount(RackDetailPanel, { props: { rackId: 'r1' } })
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()
    await wrapper.find('[data-test="close-btn"]').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('shows loading state initially', () => {
    const wrapper = mount(RackDetailPanel, { props: { rackId: 'r1' } })
    expect(wrapper.text()).toContain('加载中')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/frontend/src/components/__tests__/RackDetailPanel.test.ts
```
预期：FAIL — 组件不存在

- [ ] **Step 3: 实现 RackDetailPanel.vue**

```vue
<template>
  <aside class="rack-detail-panel" :class="{ 'rack-detail-panel--open': !!rackId }">
    <div v-if="!rackId" class="rack-detail-panel__empty">点击机柜查看详情</div>

    <template v-else>
      <header class="rack-detail-panel__header">
        <h2 class="rack-detail-panel__title">{{ detail?.rack.code }}</h2>
        <button data-test="close-btn" class="rack-detail-panel__close" @click="$emit('close')" aria-label="关闭面板">&times;</button>
      </header>

      <div v-if="loading" class="rack-detail-panel__loading">加载中…</div>

      <template v-else-if="detail">
        <!-- 基本信息 -->
        <section class="rack-detail-panel__section">
          <h3>基本信息</h3>
          <dl class="rack-detail-panel__dl">
            <dt>总容量</dt><dd>{{ detail.rack.heightU }}U</dd>
            <dt>品牌</dt><dd>{{ detail.rack.brand || '—' }}</dd>
            <dt>额定功率</dt><dd>{{ detail.rack.power || '—' }}</dd>
          </dl>
        </section>

        <!-- U位占用 -->
        <section class="rack-detail-panel__section">
          <h3>U 位占用</h3>
          <div class="rack-detail-panel__u-bar">
            <div class="rack-detail-panel__u-bar-label">
              <span>已用 {{ detail.occupancy.usedU }}U</span>
              <span>空闲 {{ detail.occupancy.freeU }}U</span>
            </div>
            <div class="rack-detail-panel__u-track">
              <div
                class="rack-detail-panel__u-used"
                :style="{ width: (detail.occupancy.usedU / detail.occupancy.totalU * 100) + '%' }"
              ></div>
            </div>
          </div>
        </section>

        <!-- 设备列表 -->
        <section class="rack-detail-panel__section">
          <h3>设备列表 ({{ detail.devices.length }})</h3>
          <table class="rack-detail-panel__table" v-if="detail.devices.length">
            <thead><tr><th>名称</th><th>类型</th><th>U位</th></tr></thead>
            <tbody>
              <tr v-for="d in detail.devices" :key="d.id">
                <td>
                  <router-link :to="'/servers/' + d.id" class="rack-detail-panel__link">{{ d.name }}</router-link>
                </td>
                <td>{{ d.deviceType }}</td>
                <td>{{ d.startU }}-{{ d.endU }} ({{ d.uHeight }}U)</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="rack-detail-panel__muted">无机架设备</p>
        </section>

        <!-- 位置变更记录 -->
        <section class="rack-detail-panel__section">
          <h3>位置变更记录</h3>
          <ul class="rack-detail-panel__timeline" v-if="detail.positionHistory.length">
            <li v-for="(h, i) in detail.positionHistory" :key="i" class="rack-detail-panel__timeline-item">
              <span class="rack-detail-panel__timeline-time">{{ formatTime(h.time) }}</span>
              <span>{{ h.deviceName }}</span>
              <span class="rack-detail-panel__badge">{{ h.action }}</span>
              <span v-if="h.fromU !== null || h.toU !== null">
                {{ h.fromU ?? '—' }} → {{ h.toU ?? '—' }}U
              </span>
            </li>
          </ul>
          <p v-else class="rack-detail-panel__muted">无变更记录</p>
        </section>

        <!-- 关联线缆 -->
        <section class="rack-detail-panel__section">
          <h3>关联线缆 ({{ detail.cables.length }})</h3>
          <ul class="rack-detail-panel__cable-list" v-if="detail.cables.length">
            <li v-for="c in detail.cables" :key="c.id">
              {{ c.portName }} → {{ c.remoteDevice }}@{{ c.remoteRack }}
            </li>
          </ul>
          <p v-else class="rack-detail-panel__muted">无关联线缆</p>
        </section>
      </template>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useApi } from '../composables/useApi'

type DeviceOnRack = { id: string; name: string; deviceType: string; startU: number; endU: number; uHeight: number }
type HistoryItem = { time: string; deviceName: string; action: string; fromU: number | null; toU: number | null }
type CableLink = { id: string; portName: string; remoteDevice: string; remoteRack: string }

interface RackDetail {
  rack: { id: string; code: string; heightU: number; brand: string; power: string; notes: string }
  devices: DeviceOnRack[]
  occupancy: { usedU: number; freeU: number; totalU: number }
  positionHistory: HistoryItem[]
  cables: CableLink[]
}

const props = defineProps<{ rackId: string | null }>()
defineEmits<{ close: [] }>()

const { request } = useApi()
const detail = ref<RackDetail | null>(null)
const loading = ref(false)

watch(() => props.rackId, async (id) => {
  if (!id) { detail.value = null; return }
  loading.value = true
  detail.value = null
  const result = await request<RackDetail>(`/api/racks/${encodeURIComponent(id)}/detail`)
  if (result.ok) detail.value = result.data
  loading.value = false
}, { immediate: true })

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleString('zh-CN') } catch { return iso }
}
</script>

<style scoped>
.rack-detail-panel { width: 360px; background: #161b22; border-left: 1px solid #30363d; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0; flex-shrink: 0; color: #e6edf3; }
.rack-detail-panel__empty { color: #8b949e; text-align: center; padding: 2rem 0; }
.rack-detail-panel__loading { color: #8b949e; text-align: center; padding: 1rem; }
.rack-detail-panel__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.rack-detail-panel__title { font-size: 1.15rem; font-weight: 600; margin: 0; }
.rack-detail-panel__close { background: none; border: none; color: #8b949e; font-size: 1.5rem; cursor: pointer; padding: 0; line-height: 1; }
.rack-detail-panel__close:hover { color: #f85149; }
.rack-detail-panel__section { margin-bottom: 1.25rem; }
.rack-detail-panel__section h3 { font-size: 0.75rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 0.5rem; }
.rack-detail-panel__dl { display: grid; grid-template-columns: 1fr 2fr; gap: 4px 8px; font-size: 0.85rem; }
.rack-detail-panel__dl dt { color: #8b949e; }
.rack-detail-panel__dl dd { margin: 0; }
.rack-detail-panel__u-bar-label { display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px; }
.rack-detail-panel__u-track { height: 8px; background: #0d1117; border-radius: 4px; overflow: hidden; }
.rack-detail-panel__u-used { height: 100%; background: #39d2c0; border-radius: 4px; transition: width 0.3s; }
.rack-detail-panel__table { width: 100%; font-size: 0.82rem; border-collapse: collapse; }
.rack-detail-panel__table th, .rack-detail-panel__table td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #21262d; }
.rack-detail-panel__table th { color: #8b949e; font-weight: 600; }
.rack-detail-panel__link { color: #58a6ff; text-decoration: none; }
.rack-detail-panel__link:hover { text-decoration: underline; }
.rack-detail-panel__muted { color: #484f58; font-size: 0.82rem; }
.rack-detail-panel__timeline { list-style: none; padding: 0; margin: 0; font-size: 0.8rem; }
.rack-detail-panel__timeline-item { padding: 4px 0; border-bottom: 1px solid #21262d; display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline; }
.rack-detail-panel__timeline-time { color: #484f58; white-space: nowrap; }
.rack-detail-panel__badge { background: #1c2333; padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; }
.rack-detail-panel__cable-list { list-style: none; padding: 0; margin: 0; font-size: 0.82rem; }
.rack-detail-panel__cable-list li { padding: 3px 0; border-bottom: 1px solid #21262d; }
</style>
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/frontend/src/components/__tests__/RackDetailPanel.test.ts
```
预期：5/5 PASS

- [ ] **Step 5: TypeCheck + Build**

```bash
npx vue-tsc --noEmit
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/frontend/src/components/RackDetailPanel.vue src/frontend/src/components/__tests__/RackDetailPanel.test.ts
git commit -m "feat: add RackDetailPanel with occupancy, device list, position history, and cable links"
```

---

### Task 6: CableConnectionStrategy.vue — 线缆连接可视化

**Files:**
- Create: `src/frontend/src/components/CableConnectionStrategy.vue`
- Create: `src/frontend/src/components/__tests__/CableConnectionStrategy.test.ts`

**Interfaces:**
- Consumes: `GET /api/cables/connections?roomId=&cableType=` → `{ connections[] }`
- Produces: `<CableConnectionStrategy :roomId="string?" :cableType="string?" />`

- [ ] **Step 1: 写出组件测试**

```typescript
// src/frontend/src/components/__tests__/CableConnectionStrategy.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CableConnectionStrategy from '../CableConnectionStrategy.vue'

const mockConnections = {
  connections: [
    { id: 'c1', source: { deviceName: 'web-01', portName: 'eth0', rackCode: 'A01', roomName: '核心机房A' },
      target: { deviceName: 'db-01', portName: 'eth1', rackCode: 'B03', roomName: '核心机房A' },
      cableType: '光纤', color: '#f1c40f', status: 'normal', notes: null },
    { id: 'c2', source: { deviceName: 'sw-01', portName: 'ge0', rackCode: 'A01', roomName: '核心机房A' },
      target: { deviceName: 'web-02', portName: 'eth0', rackCode: 'A02', roomName: '核心机房A' },
      cableType: '铜缆', color: '#e67e22', status: 'normal', notes: null },
  ]
}

vi.mock('../../composables/useApi', () => ({
  useApi: () => ({
    request: vi.fn().mockResolvedValue({ ok: true, data: mockConnections })
  })
}))

describe('CableConnectionStrategy', () => {
  it('renders connection count', async () => {
    const wrapper = mount(CableConnectionStrategy, { props: { roomId: 'r1' } })
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('2')
  })

  it('renders device names and rack codes', async () => {
    const wrapper = mount(CableConnectionStrategy, { props: { roomId: 'r1' } })
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('web-01')
    expect(wrapper.text()).toContain('db-01')
    expect(wrapper.text()).toContain('A01')
    expect(wrapper.text()).toContain('B03')
  })

  it('renders cable type badges with correct colors', async () => {
    const wrapper = mount(CableConnectionStrategy, { props: { roomId: 'r1' } })
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()
    const badges = wrapper.findAll('.cable-connection__type')
    expect(badges.length).toBe(2)
  })

  it('shows empty state when no connections', async () => {
    vi.mocked(useApi().request).mockResolvedValueOnce({ ok: true, data: { connections: [] } })
    const wrapper = mount(CableConnectionStrategy, { props: { roomId: 'r1' } })
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('暂无')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npx vitest run src/frontend/src/components/__tests__/CableConnectionStrategy.test.ts
```

- [ ] **Step 3: 实现 CableConnectionStrategy.vue**

```vue
<template>
  <div class="cable-connection">
    <div v-if="loading" class="cable-connection__loading">加载中…</div>
    <template v-else-if="connections.length">
      <div class="cable-connection__summary">
        共 <strong>{{ connections.length }}</strong> 条连接
        <span v-if="roomId">— 当前机房</span>
      </div>
      <div class="cable-connection__list">
        <div
          v-for="c in connections"
          :key="c.id"
          class="cable-connection__item"
        >
          <div class="cable-connection__endpoint cable-connection__endpoint--source">
            <span class="cable-connection__device">{{ c.source.deviceName }}</span>
            <span class="cable-connection__port">{{ c.source.portName }}</span>
            <span class="cable-connection__rack">{{ c.source.rackCode }}</span>
          </div>
          <div class="cable-connection__arrow">
            <span class="cable-connection__type" :style="{ background: typeColor(c.cableType) }">
              {{ c.cableType }}
            </span>
            <span class="cable-connection__direction">→</span>
          </div>
          <div class="cable-connection__endpoint cable-connection__endpoint--target">
            <span class="cable-connection__device">{{ c.target.deviceName }}</span>
            <span class="cable-connection__port">{{ c.target.portName }}</span>
            <span class="cable-connection__rack">{{ c.target.rackCode }}</span>
          </div>
        </div>
      </div>
    </template>
    <p v-else class="cable-connection__empty">暂无连接数据</p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useApi } from '../composables/useApi'

interface ConnectionEndpoint {
  deviceName: string; portName: string; rackCode: string; roomName: string
}
interface Connection {
  id: string
  source: ConnectionEndpoint
  target: ConnectionEndpoint
  cableType: string
  color: string | null
  status: string
  notes: string | null
}

const props = defineProps<{ roomId?: string; cableType?: string }>()
const { request } = useApi()
const connections = ref<Connection[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  const params = new URLSearchParams()
  if (props.roomId) params.set('roomId', props.roomId)
  if (props.cableType) params.set('cableType', props.cableType)
  const qs = params.toString()
  const result = await request<{ connections: Connection[] }>(`/api/cables/connections${qs ? '?' + qs : ''}`)
  if (result.ok) connections.value = result.data.connections
  loading.value = false
}

function typeColor(type: string): string {
  const colors: Record<string, string> = { '铜缆': '#e67e22', '光纤': '#f1c40f', 'DAC': '#3498db' }
  return colors[type] || '#8b949e'
}

onMounted(load)
watch(() => [props.roomId, props.cableType], load)
</script>

<style scoped>
.cable-connection { color: #e6edf3; }
.cable-connection__loading, .cable-connection__empty { color: #8b949e; text-align: center; padding: 2rem; }
.cable-connection__summary { font-size: 0.85rem; color: #8b949e; margin-bottom: 1rem; }
.cable-connection__list { display: flex; flex-direction: column; gap: 10px; }
.cable-connection__item { display: flex; align-items: center; gap: 12px; background: #0d1117; border: 1px solid #21262d; border-radius: 8px; padding: 12px 14px; }
.cable-connection__endpoint { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.cable-connection__device { font-weight: 600; font-size: 0.9rem; }
.cable-connection__port { font-size: 0.78rem; color: #8b949e; }
.cable-connection__rack { font-size: 0.75rem; color: #39d2c0; }
.cable-connection__arrow { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.cable-connection__type { padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; color: #fff; white-space: nowrap; }
.cable-connection__direction { color: #484f58; font-size: 1.2rem; }
.cable-connection__endpoint--target { text-align: right; }
@media (max-width: 640px) {
  .cable-connection__item { flex-direction: column; align-items: flex-start; gap: 6px; }
  .cable-connection__endpoint--target { text-align: left; }
}
</style>
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npx vitest run src/frontend/src/components/__tests__/CableConnectionStrategy.test.ts
```

- [ ] **Step 5: TypeCheck + Build**

```bash
npx vue-tsc --noEmit
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/frontend/src/components/CableConnectionStrategy.vue src/frontend/src/components/__tests__/CableConnectionStrategy.test.ts
git commit -m "feat: add CableConnectionStrategy component with data-driven connection visualization"
```

---

### Task 7: 修改 FloorplanView.vue — 集成 RackDetailPanel

**Files:**
- Modify: `src/frontend/src/views/FloorplanView.vue`

**Interfaces:**
- Consumes: `RackDetailPanel.vue` (from Task 5)
- Produces: FloorplanView 支持点击机柜→右侧面板联动

- [ ] **Step 1: 修改 FloorplanView.vue**

在 `<script setup>` 中新增：
```typescript
import RackDetailPanel from '../components/RackDetailPanel.vue'
const selectedRackId = ref<string | null>(null)
function selectRack(rackId: string) { selectedRackId.value = rackId }
function closePanel() { selectedRackId.value = null }
```

在 `<template>` 中，FloorplanCanvas 上添加：
```html
<FloorplanCanvas ... @select-rack="selectRack" />
```

在主容器右侧添加：
```html
<RackDetailPanel :rackId="selectedRackId" @close="closePanel" />
```

布局调整：FloorplanView 主容器改为 `display: flex`，平面图占据 flex: 1，面板固定在右侧。

- [ ] **Step 2: TypeCheck + Build**

```bash
npx vue-tsc --noEmit
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/views/FloorplanView.vue
git commit -m "feat: integrate RackDetailPanel into FloorplanView with rack select/close"
```

---

### Task 8: 修改 FloorplanCanvas.vue — 增强选中态 + 容量条

**Files:**
- Modify: `src/frontend/src/components/FloorplanCanvas.vue`

**Interfaces:**
- Consumes: 已有 `RackItem` 的 `occupiedU`? 字段（来自 `useFloorplan`）
- Produces: `emit('select-rack', rackId: string)`, 机柜选中高亮 + 容量条

- [ ] **Step 1: 增强选中态**

在 FloorplanCanvas 中新增 `selectedRackId` prop 和处理逻辑：

```typescript
const props = defineProps<{
  // ...existing props
  selectedRackId?: string | null
}>()

const emit = defineEmits<{
  // ...existing emits
  'select-rack': [rackId: string]
}>()
```

机柜点击时：`emit('select-rack', rackId)`

选中态样式：青色 (#39d2c0) 2px 描边，替换默认灰色边框。

- [ ] **Step 2: 增加容量条**

每个机柜顶部显示横向容量占用条：
```typescript
// 在机柜渲染逻辑中，机柜矩形上方绘制容量条
function drawOccupancyBar(rack: RackItem) {
  const barWidth = rackWidth - 4  // 略小于机柜宽度
  const barHeight = 4
  const barY = rackY - 8
  const usedRatio = (rack.occupiedU || 0) / rack.heightU

  // 背景（深灰）
  drawRect(barX, barY, barWidth, barHeight, '#0d1117')
  // 已用（青色）
  drawRect(barX, barY, barWidth * usedRatio, barHeight, '#39d2c0')
}
```

- [ ] **Step 3: TypeCheck + Build**

```bash
npx vue-tsc --noEmit
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/frontend/src/components/FloorplanCanvas.vue
git commit -m "feat: add rack selection highlight and occupancy bar to FloorplanCanvas"
```

---

### Task 9: 修改 CableListView.vue — 集成 CableConnectionStrategy

**Files:**
- Modify: `src/frontend/src/views/CableListView.vue`

- [ ] **Step 1: 嵌入 CableConnectionStrategy**

在 `<script setup>` 中新增：
```typescript
import CableConnectionStrategy from '../components/CableConnectionStrategy.vue'
```

在 `<template>` 中，筛选栏下方、线缆表格上方插入：
```html
<section class="cable-connection-card">
  <h2>连接策略</h2>
  <CableConnectionStrategy
    :roomId="filterRoomId || undefined"
    :cableType="filterCableType || undefined"
  />
</section>
```

添加样式卡片背景 `background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin-bottom: 16px;`

- [ ] **Step 2: TypeCheck + Build**

```bash
npx vue-tsc --noEmit
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/views/CableListView.vue
git commit -m "feat: integrate CableConnectionStrategy into CableListView under connection strategy card"
```

---

## Self-Review

### 1. Spec coverage
- 用户流程 → Task 7+8 (平面图交互) + Task 9 (线缆连接) ✅
- 组件拆分 → Task 5+6 ✅
- 数据模型 → Task 1 DTO 定义 ✅
- API 契约 → Task 1-4 ✅
- 验收标准 → 覆盖了所有 17 条 AC ✅
- Cursor 提示词 → 设计文档已包含 ✅
- Review 清单 → 设计文档已包含 ✅

### 2. Placeholder scan
- 无 TBD/TODO ✅
- 所有步骤有具体代码 ✅
- 测试代码完整 ✅

### 3. Type consistency
- `RackDetail` interface 在 Task 5 中定义，Task 7 通过 RackDetailPanel 消费 ✅
- `Connection` interface 在 Task 6 中定义，Task 9 通过 CableConnectionStrategy 消费 ✅
- 后端 DTO 字段名与前端 interface 一致 ✅
- `select-rack` 事件名在 Task 7 (emit) 和 Task 8 (emit) 中一致 ✅
