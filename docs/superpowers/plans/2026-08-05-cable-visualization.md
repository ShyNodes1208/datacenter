# 机柜只读线路可视化 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在机房平面图和机柜检查器中，三层展示交换机端口连接关系（机柜总览→设备聚焦→端口追踪），线路聚合避免重叠，方向动画表达路径追踪。

**Architecture:** 后端新增 CableScene 端点返回机房全量线路数据。前端深模块 `useCableScene` 集中处理聚合/路由/显隐逻辑，三个视图层组件消费同一份场景数据。理线通道算法自动生成，SVG + CSS 动画渲染。

**Tech Stack:** C# + EF Core（后端），Vue 3 + TypeScript + SVG + CSS（前端）

## Global Constraints

- 只读：无任何写入端点或 UI 入口
- 动画：必须尊重 prefers-reduced-motion，提供关闭开关
- 免责声明：页面显示"路径追踪效果，非实时流量"
- 线路不穿过设备主体，沿理线通道走
- 同源柜+同目标柜+同类型线路聚合为线束
- 性能：3 秒加载，层级切换无卡顿

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `Models/Cable.cs` | 修改 | +Purpose 字段 |
| `Migrations/*_AddCablePurpose.cs` | 新建 | DB 迁移 |
| `Controllers/CableSceneController.cs` | 新建 | GET cable-scene |
| `Controllers/CablesController.cs` | 修改 | Create/Import/List 支持 Purpose |
| `composables/useCableScene.ts` | 新建 | 深模块：聚合/路由/显隐 |
| `components/CableLayer.vue` | 新建 | SVG 渲染层 |
| `components/CableBreadcrumb.vue` | 新建 | 面包屑导航 |
| `components/CableLegend.vue` | 新建 | 图例+筛选+明细 |
| `views/FloorplanCanvas.vue` | 修改 | 集成 CableLayer |
| `views/RackDeviceView.vue` | 修改 | 设备层线路 |
| `docs/线缆导入模板.xlsx` | 修改 | +线路用途列 |

---

### Task 1: Cable 模型 — Purpose 字段

**Files:**
- Modify: `src/backend/Datacenter.Api/Models/Cable.cs`
- Create: `src/backend/Datacenter.Api/Migrations/*_AddCablePurpose.cs`

**Interfaces:**
- Produces: `Cable.Purpose` (string, default "正常")

- [ ] **Step 1: 修改 Cable 模型**

`Models/Cable.cs` 的现有属性之后添加：

```csharp
public string Purpose { get; set; } = "正常";
```

- [ ] **Step 2: 生成迁移**

```bash
cd src/backend/Datacenter.Api
dotnet ef migrations add AddCablePurpose
```

- [ ] **Step 3: 编写回填 SQL**

在生成的 Migration 的 `Up` 方法中，`AddColumn` 之后添加：

```csharp
migrationBuilder.Sql(@"
    UPDATE ""Cables"" SET ""Purpose"" = '存储'
    WHERE ""CableType"" = 'DAC' AND ""Purpose"" = '正常';
    
    UPDATE ""Cables"" SET ""Purpose"" = '上联'
    WHERE ""SourcePortId"" IN (SELECT ""Id"" FROM ""Ports"" WHERE ""ServerId"" IN (SELECT ""Id"" FROM ""Servers"" WHERE ""DeviceType"" ILIKE '%交换%' OR ""DeviceType"" ILIKE '%switch%' OR ""DeviceType"" ILIKE '%路由%' OR ""DeviceType"" ILIKE '%router%'))
      AND ""TargetPortId"" IN (SELECT ""Id"" FROM ""Ports"" WHERE ""ServerId"" IN (SELECT ""Id"" FROM ""Servers"" WHERE ""DeviceType"" ILIKE '%交换%' OR ""DeviceType"" ILIKE '%switch%' OR ""DeviceType"" ILIKE '%路由%' OR ""DeviceType"" ILIKE '%router%'))
      AND ""Purpose"" = '正常';
");
```

- [ ] **Step 4: 应用迁移**

```bash
cd src/backend/Datacenter.Api && dotnet ef database update
```

- [ ] **Step 5: 编译验证**

```bash
cd src/backend/Datacenter.Api && dotnet build
```

- [ ] **Step 6: Commit**

```bash
git add src/backend/Datacenter.Api/Models/Cable.cs src/backend/Datacenter.Api/Migrations/
git commit -m "feat: add Purpose column to Cable for logical cable classification"
```

---

### Task 2: CablesController — Purpose 支持

**Files:**
- Modify: `src/backend/Datacenter.Api/Controllers/CablesController.cs`

**Interfaces:**
- Consumes: `Cable.Purpose`
- Produces: Create/Import/List 端点支持 Purpose

- [ ] **Step 1: CreateCableRequest 加 Purpose**

修改 `CreateCableRequest` 记录（约第 93 行）：

```csharp
public sealed record CreateCableRequest(
    Guid SourcePortId, Guid TargetPortId, string CableType, string? Color, string? Length, string? Purpose);
```

- [ ] **Step 2: Create 方法使用 Purpose**

在 `Create` 方法中，创建 Cable 时：

```csharp
var cable = new Cable
{
    SourcePortId = request.SourcePortId,
    TargetPortId = request.TargetPortId,
    CableType = request.CableType.Trim(),
    Color = request.Color?.Trim(),
    Length = request.Length?.Trim(),
    Purpose = string.IsNullOrWhiteSpace(request.Purpose) ? "正常" : request.Purpose.Trim()
};
```

- [ ] **Step 3: List 端点加 purpose 筛选参数**

在 `List` 方法签名中添加：

```csharp
[FromQuery] string? purpose,
```

在筛选逻辑中添加：

```csharp
if (!string.IsNullOrWhiteSpace(purpose))
{
    query = query.Where(c => c.Purpose == purpose);
}
```

- [ ] **Step 4: List 端点 Select 投影加 Purpose**

在 `List` 方法的 Select 匿名对象中添加：

```csharp
c.Purpose,
```

- [ ] **Step 5: Import 方法支持 Purpose**

在 `Import` 方法的 headerMap 相关逻辑中：
- `requiredHeaders` 数组不变（Purpose 可选）
- 读取行时添加：

```csharp
var purpose = RowCell(worksheet, row, headerMap, "线路用途") ?? "正常";
```

- 创建 Cable 时使用 `Purpose = purpose`

- [ ] **Step 6: 更新 Excel 导入模板**

在 `docs/线缆导入模板.xlsx` 的表头末尾（"长度"之后）添加"线路用途"列。示例行填写"正常"。

- [ ] **Step 7: 编译验证**

```bash
cd src/backend/Datacenter.Api && dotnet build
```

- [ ] **Step 8: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/CablesController.cs docs/线缆导入模板.xlsx
git commit -m "feat: add Purpose support to cable create/import/list endpoints"
```

---

### Task 3: CableSceneController — 只读查询端点

**Files:**
- Create: `src/backend/Datacenter.Api/Controllers/CableSceneController.cs`

**Interfaces:**
- Consumes: `AppDbContext`, `IAntiforgery`
- Produces: `GET /api/rooms/{roomId}/cable-scene`

- [ ] **Step 1: 创建 CableSceneController**

```csharp
using Datacenter.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class CableSceneController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("rooms/{roomId:guid}/cable-scene")]
    public async Task<IActionResult> GetScene(Guid roomId, CancellationToken cancellationToken)
    {
        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == roomId, cancellationToken);
        if (!roomExists)
            return NotFound(new { error = "机房不存在" });

        // 机房内所有机柜
        var racks = await dbContext.Racks
            .AsNoTracking()
            .Where(r => r.RoomId == roomId)
            .Select(r => new
            {
                RackId = r.Id,
                r.Code,
                r.X,
                r.Y,
                Width = 60,   // 默认宽度，前端可覆盖
                Height = r.HeightU * 20  // 1U ≈ 20px
            })
            .ToListAsync(cancellationToken);

        var rackIds = racks.Select(r => r.RackId).ToHashSet();

        // 机柜内的网络设备
        var devices = await dbContext.ServerPositions
            .AsNoTracking()
            .Where(sp => rackIds.Contains(sp.RackId) && sp.Status == "在架")
            .Where(sp => sp.Server.DeviceType.Contains("交换") ||
                         sp.Server.DeviceType.Contains("switch") ||
                         sp.Server.DeviceType.Contains("路由") ||
                         sp.Server.DeviceType.Contains("router") ||
                         sp.Server.DeviceType.Contains("网络") ||
                         sp.Server.DeviceType.Contains("network"))
            .Select(sp => new
            {
                DeviceId = sp.Server.Id,
                DeviceName = sp.Server.Name,
                sp.Server.DeviceType,
                RackId = sp.RackId,
                sp.StartU,
                sp.EndU
            })
            .ToListAsync(cancellationToken);

        var deviceIds = devices.Select(d => d.DeviceId).ToHashSet();

        // 至少一端在机房内的所有线缆
        var cables = await dbContext.Cables
            .AsNoTracking()
            .Where(c =>
                deviceIds.Contains(c.SourcePort.ServerId) ||
                deviceIds.Contains(c.TargetPort.ServerId))
            .Select(c => new
            {
                CableId = c.Id,
                c.CableType,
                c.Purpose,
                Source = new
                {
                    DeviceId = c.SourcePort.Server.Id,
                    DeviceName = c.SourcePort.Server.Name,
                    PortName = c.SourcePort.PortName,
                    RackId = dbContext.ServerPositions
                        .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                        .Select(sp => (Guid?)sp.RackId)
                        .FirstOrDefault(),
                    RackCode = dbContext.ServerPositions
                        .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                        .Select(sp => sp.Rack.Code)
                        .FirstOrDefault()
                },
                Target = new
                {
                    DeviceId = c.TargetPort.Server.Id,
                    DeviceName = c.TargetPort.Server.Name,
                    PortName = c.TargetPort.PortName,
                    RackId = dbContext.ServerPositions
                        .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                        .Select(sp => (Guid?)sp.RackId)
                        .FirstOrDefault(),
                    RackCode = dbContext.ServerPositions
                        .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                        .Select(sp => sp.Rack.Code)
                        .FirstOrDefault()
                }
            })
            .ToListAsync(cancellationToken);

        return Ok(new { racks, devices, cables });
    }
}
```

- [ ] **Step 2: 编译验证**

```bash
cd src/backend/Datacenter.Api && dotnet build
```

- [ ] **Step 3: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/CableSceneController.cs
git commit -m "feat: add GET /api/rooms/{roomId}/cable-scene endpoint"
```

---

### Task 4: useCableScene 深模块

**Files:**
- Create: `src/frontend/src/composables/useCableScene.ts`

**Interfaces:**
- Consumes: `CableSnapshot` (API response), `CableFocus`, `CableFilters`
- Produces: `CableScene`

- [ ] **Step 1: 创建类型定义和模块骨架**

```typescript
// src/frontend/src/composables/useCableScene.ts

export interface Point { x: number; y: number }

export type CableFocus =
  | { level: 'room'; roomId: string }
  | { level: 'rack'; rackId: string }
  | { level: 'device'; deviceId: string }
  | { level: 'port'; portId: string }

export interface CableFilters {
  purposes: string[]      // 空数组 = 全部
  cableTypes: string[]    // 空数组 = 全部
}

export interface RackInfo {
  rackId: string
  code: string
  x: number; y: number
  width: number; height: number
}

export interface DeviceInfo {
  deviceId: string
  deviceName: string
  rackId: string
  deviceType: string
  startU: number; endU: number
}

export interface EndpointInfo {
  deviceId: string; deviceName: string
  portName: string
  rackId: string | null; rackCode: string | null
}

export interface CableInfo {
  cableId: string
  cableType: string
  purpose: string
  source: EndpointInfo
  target: EndpointInfo
}

export interface CableSnapshot {
  racks: RackInfo[]
  devices: DeviceInfo[]
  cables: CableInfo[]
}

export interface CableBundle {
  id: string
  purpose: string
  cableType: string
  count: number
  sourceRackId: string
  targetRackId: string
  route: Point[]
  opacity: number
  highlighted: boolean
  isAggregated: boolean
}

export interface PortPath {
  cableId: string
  sourceLabel: string
  targetLabel: string
  route: Point[]
}

export interface LegendItem {
  purpose: string
  cableType: string
  color: string
  dashArray: string
  count: number
}

export interface DetailRow {
  sourceDevice: string
  sourcePort: string
  targetDevice: string
  targetPort: string
  cableType: string
  purpose: string
  sourceRack: string
  targetRack: string
}

export interface BreadcrumbItem {
  label: string
  level: CableFocus['level']
  id: string
}

export interface CableScene {
  bundles: CableBundle[]
  highlightedPath: PortPath | null
  legend: LegendItem[]
  detailRows: DetailRow[]
  breadcrumbs: BreadcrumbItem[]
}
```

- [ ] **Step 2: 实现 buildCableScene 函数**

```typescript
const PURPOSE_COLORS: Record<string, string> = {
  '正常': '#3B82F6',
  '存储': '#F59E0B',
  '上联': '#10B981',
}

const PURPOSE_DASH: Record<string, string> = {
  '正常': 'none',
  '存储': '6,4',
  '上联': '2,4',
}

function rackCenter(r: RackInfo): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

function deviceEdgePoint(device: DeviceInfo, rack: RackInfo, direction: 'left' | 'right' | 'top' | 'bottom'): Point {
  const uHeight = (device.endU - device.startU + 1)
  const deviceTopY = rack.y + (device.startU - 1) * 20
  const deviceCenterY = deviceTopY + uHeight * 10

  switch (direction) {
    case 'left':  return { x: rack.x, y: deviceCenterY }
    case 'right': return { x: rack.x + rack.width, y: deviceCenterY }
    case 'top':   return { x: rackCenter(rack).x, y: deviceTopY }
    case 'bottom':return { x: rackCenter(rack).x, y: deviceTopY + uHeight * 20 }
  }
}

function routeBetweenRacks(
  srcRack: RackInfo, srcDevice: DeviceInfo,
  tgtRack: RackInfo, tgtDevice: DeviceInfo
): Point[] {
  // 简化理线通道：从源设备出 → 机柜边缘 → 水平/垂直主通道 → 目标机柜边缘 → 目标设备入
  const points: Point[] = []

  const startEdge = srcRack.x + srcRack.width / 2 < tgtRack.x + tgtRack.width / 2 ? 'right' : 'left'
  const endEdge = srcRack.x + srcRack.width / 2 < tgtRack.x + tgtRack.width / 2 ? 'left' : 'right'

  const start = deviceEdgePoint(srcDevice, srcRack, startEdge)
  const end = deviceEdgePoint(tgtDevice, tgtRack, endEdge)

  points.push(start)

  // 水平距离 vs 垂直距离决定走线方向
  const midX = (start.x + end.x) / 2
  points.push({ x: midX, y: start.y })
  points.push({ x: midX, y: end.y })

  points.push(end)
  return points
}

function aggregateCables(cables: CableInfo[], rackMap: Map<string, RackInfo>): CableBundle[] {
  // 同源柜+同目标柜+同purpose+同cableType → 聚合
  const groups = new Map<string, CableInfo[]>()
  for (const c of cables) {
    const srcRack = c.source.rackId ?? '__none__'
    const tgtRack = c.target.rackId ?? '__none__'
    const [a, b] = srcRack < tgtRack ? [srcRack, tgtRack] : [tgtRack, srcRack]
    const key = `${a}|${b}|${c.purpose}|${c.cableType}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }

  const bundles: CableBundle[] = []
  for (const [key, group] of groups) {
    const parts = key.split('|')
    const srcRackId = parts[0]
    const tgtRackId = parts[1]
    const purpose = parts[2]
    const cableType = parts[3]

    const srcRack = rackMap.get(srcRackId)
    const tgtRack = rackMap.get(tgtRackId)

    // 找两台代表性的设备来计算路由
    const sample = group[0]
    const srcDevice: DeviceInfo = {
      deviceId: sample.source.deviceId, deviceName: sample.source.deviceName,
      rackId: sample.source.rackId ?? '',
      deviceType: '', startU: 1, endU: 2
    }
    const tgtDevice: DeviceInfo = {
      deviceId: sample.target.deviceId, deviceName: sample.target.deviceName,
      rackId: sample.target.rackId ?? '',
      deviceType: '', startU: 1, endU: 2
    }

    const route = srcRack && tgtRack && srcRackId !== tgtRackId
      ? routeBetweenRacks(srcRack, srcDevice, tgtRack, tgtDevice)
      : srcRack && tgtRack
        ? sameRackRoute(srcRack, srcDevice, tgtDevice)
        : []

    bundles.push({
      id: key,
      purpose,
      cableType,
      count: group.length,
      sourceRackId: srcRackId,
      targetRackId: tgtRackId,
      route,
      opacity: 1,
      highlighted: false,
      isAggregated: group.length > 1,
    })
  }
  return bundles
}

function sameRackRoute(rack: RackInfo, src: DeviceInfo, tgt: DeviceInfo): Point[] {
  // 同机柜内沿侧面走线
  const start = deviceEdgePoint(src, rack, 'left')
  const end = deviceEdgePoint(tgt, rack, 'left')
  const midX = rack.x - 30  // 机柜左侧 30px 偏移
  return [
    start,
    { x: midX, y: start.y },
    { x: midX, y: end.y },
    end,
  ]
}

export function buildCableScene(
  snapshot: CableSnapshot,
  focus: CableFocus,
  filters: CableFilters,
): CableScene {
  const rackMap = new Map(snapshot.racks.map(r => [r.rackId, r]))

  // 筛选
  let visibleCables = snapshot.cables
  if (filters.purposes.length > 0) {
    visibleCables = visibleCables.filter(c => filters.purposes.includes(c.purpose))
  }
  if (filters.cableTypes.length > 0) {
    visibleCables = visibleCables.filter(c => filters.cableTypes.includes(c.cableType))
  }

  // 聚合
  const allBundles = aggregateCables(visibleCables, rackMap)

  // 三层显隐
  for (const b of allBundles) {
    b.opacity = 1
    b.highlighted = false
  }

  let highlightedPath: PortPath | null = null

  switch (focus.level) {
    case 'room':
      // 只显示聚合线束，隐藏同机柜内线路
      break

    case 'rack':
      // 本机柜线路全显，其他淡化
      for (const b of allBundles) {
        if (b.sourceRackId !== focus.rackId && b.targetRackId !== focus.rackId) {
          b.opacity = 0.15
        }
      }
      break

    case 'device': {
      // 选中设备相关全显，其他淡化
      const related = new Set<string>()
      for (const c of visibleCables) {
        if (c.source.deviceId === focus.deviceId || c.target.deviceId === focus.deviceId) {
          related.add(c.cableId)
        }
      }
      for (const b of allBundles) {
        b.opacity = 0.15
      }
      // 相关 bundles 恢复全显（简化：检查 bundle 中的 cable 是否包含）
      break
    }

    case 'port': {
      // 只高亮选中端口路径
      const portCable = visibleCables.find(c =>
        (c.source.deviceId === focus.portId.replace(':port', '') || c.target.deviceId === focus.portId.replace(':port', ''))
        && (c.source.portName === focus.portId.split(':')[1] || c.target.portName === focus.portId.split(':')[1])
      )
      if (portCable) {
        const srcRack = rackMap.get(portCable.source.rackId ?? '')
        const tgtRack = rackMap.get(portCable.target.rackId ?? '')
        highlightedPath = {
          cableId: portCable.cableId,
          sourceLabel: `${portCable.source.deviceName} / ${portCable.source.portName}`,
          targetLabel: `${portCable.target.deviceName} / ${portCable.target.portName}`,
          route: srcRack && tgtRack
            ? routeBetweenRacks(srcRack, { deviceId: '', deviceName: '', rackId: srcRack.rackId, deviceType: '', startU: 1, endU: 2 },
                                 tgtRack, { deviceId: '', deviceName: '', rackId: tgtRack.rackId, deviceType: '', startU: 1, endU: 2 })
            : [],
        }
      }
      for (const b of allBundles) {
        b.opacity = 0.1
      }
      break
    }
  }

  // 图例
  const legendMap = new Map<string, LegendItem>()
  for (const c of visibleCables) {
    const key = `${c.purpose}|${c.cableType}`
    if (!legendMap.has(key)) {
      legendMap.set(key, {
        purpose: c.purpose,
        cableType: c.cableType,
        color: PURPOSE_COLORS[c.purpose] ?? '#95a5a6',
        dashArray: PURPOSE_DASH[c.purpose] ?? 'none',
        count: 0,
      })
    }
    legendMap.get(key)!.count++
  }
  const legend = Array.from(legendMap.values())

  // 明细表
  const detailRows: DetailRow[] = visibleCables.map(c => ({
    sourceDevice: c.source.deviceName,
    sourcePort: c.source.portName,
    targetDevice: c.target.deviceName,
    targetPort: c.target.portName,
    cableType: c.cableType,
    purpose: c.purpose,
    sourceRack: c.source.rackCode ?? '-',
    targetRack: c.target.rackCode ?? '-',
  }))

  // 面包屑
  const breadcrumbs: BreadcrumbItem[] = []
  if (focus.level !== 'room') {
    breadcrumbs.push({ label: '机柜总览', level: 'room', id: focus.roomId })
  }
  // ... 根据 focus 构建面包屑

  return { bundles: allBundles, highlightedPath, legend, detailRows, breadcrumbs }
}
```

- [ ] **Step 3: 编译验证**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/frontend/src/composables/useCableScene.ts
git commit -m "feat: add useCableScene composable for cable aggregation/routing/visibility"
```

---

### Task 5: CableLayer SVG 渲染组件

**Files:**
- Create: `src/frontend/src/components/CableLayer.vue`

**Interfaces:**
- Consumes: `CableScene`（从 useCableScene 获取）
- Props: `scene: CableScene`, `animationEnabled: boolean`
- Emits: `bundle-click`, `port-path-click`

- [ ] **Step 1: 创建 CableLayer.vue**

```html
<script setup lang="ts">
import { computed } from 'vue'
import type { CableScene } from '../composables/useCableScene'

const props = defineProps<{
  scene: CableScene
  animationEnabled: boolean
}>()

const emit = defineEmits<{
  'bundle-click': [bundleId: string]
  'background-click': []
}>()

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const shouldAnimate = computed(() => props.animationEnabled && !prefersReducedMotion)

const PURPOSE_COLORS: Record<string, string> = {
  '正常': '#3B82F6',
  '存储': '#F59E0B',
  '上联': '#10B981',
}

function bundleStroke(bundle: typeof props.scene.bundles[0]): string {
  return PURPOSE_COLORS[bundle.purpose] ?? '#95a5a6'
}

function bundleDash(bundle: typeof props.scene.bundles[0]): string {
  if (bundle.purpose === '存储') return '6,4'
  if (bundle.purpose === '上联') return '2,4'
  return 'none'
}

function routeD(bundle: typeof props.scene.bundles[0]): string {
  if (bundle.route.length === 0) return ''
  const start = bundle.route[0]
  let d = `M ${start.x} ${start.y}`
  for (let i = 1; i < bundle.route.length; i++) {
    d += ` L ${bundle.route[i].x} ${bundle.route[i].y}`
  }
  return d
}
</script>

<template>
  <svg class="cable-layer" @click.self="emit('background-click')">
    <!-- 免责声明 -->
    <text x="10" :y="10" class="disclaimer" font-size="10" fill="#999">
      路径追踪效果，非实时流量
    </text>

    <!-- 线束 -->
    <g v-for="bundle in scene.bundles" :key="bundle.id"
       :opacity="bundle.opacity"
       @click.stop="emit('bundle-click', bundle.id)">
      <path
        :d="routeD(bundle)"
        fill="none"
        :stroke="bundleStroke(bundle)"
        :stroke-width="bundle.isAggregated ? 3 + Math.min(bundle.count, 10) : 2"
        :stroke-dasharray="shouldAnimate && bundle.highlighted ? '8,4' : bundleDash(bundle)"
        :class="{ 'animated-path': shouldAnimate && bundle.highlighted }"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <!-- 聚合标签 -->
      <text
        v-if="bundle.isAggregated"
        :x="bundle.route.length > 1 ? (bundle.route[0].x + bundle.route[bundle.route.length - 1].x) / 2 : 0"
        :y="bundle.route.length > 1 ? (bundle.route[0].y + bundle.route[bundle.route.length - 1].y) / 2 - 8 : 0"
        text-anchor="middle"
        font-size="11"
        :fill="bundleStroke(bundle)"
        font-weight="600"
      >
        ×{{ bundle.count }}
      </text>

      <!-- 方向箭头（聚合线束） -->
      <polygon
        v-if="bundle.isAggregated && bundle.route.length >= 2"
        :points="arrowPoints(bundle)"
        :fill="bundleStroke(bundle)"
      />
    </g>

    <!-- 高亮端口路径 -->
    <g v-if="scene.highlightedPath">
      <path
        :d="highlightedRouteD()"
        fill="none"
        stroke="#EF4444"
        stroke-width="3"
        :class="{ 'animated-path': shouldAnimate }"
      />
      <!-- 路径标签 -->
      <text
        v-if="scene.highlightedPath.route.length > 1"
        :x="(scene.highlightedPath.route[0].x + scene.highlightedPath.route[scene.highlightedPath.route.length - 1].x) / 2"
        :y="(scene.highlightedPath.route[0].y + scene.highlightedPath.route[scene.highlightedPath.route.length - 1].y) / 2 - 12"
        text-anchor="middle"
        font-size="10"
        fill="#EF4444"
      >
        {{ scene.highlightedPath.sourceLabel }} → {{ scene.highlightedPath.targetLabel }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.cable-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.cable-layer g {
  pointer-events: auto;
  cursor: pointer;
}

.cable-layer path {
  transition: opacity 0.25s ease, stroke-width 0.25s ease;
}

.animated-path {
  animation: dash-flow 1.5s linear infinite;
}

@keyframes dash-flow {
  to {
    stroke-dashoffset: -24;
  }
}

@media (prefers-reduced-motion: reduce) {
  .animated-path {
    animation: none;
  }
}

.disclaimer {
  user-select: none;
}
</style>
```

- [ ] **Step 2: 编译验证**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/components/CableLayer.vue
git commit -m "feat: add CableLayer SVG component for cable bundle rendering"
```

---

### Task 6: CableBreadcrumb + CableLegend 组件

**Files:**
- Create: `src/frontend/src/components/CableBreadcrumb.vue`
- Create: `src/frontend/src/components/CableLegend.vue`

- [ ] **Step 1: CableBreadcrumb.vue**

```html
<script setup lang="ts">
import type { BreadcrumbItem, CableFocus } from '../composables/useCableScene'

defineProps<{ items: BreadcrumbItem[] }>()
const emit = defineEmits<{ 'navigate': [level: CableFocus['level'], id: string] }>()
</script>

<template>
  <nav class="cable-breadcrumb" aria-label="线路层级导航">
    <button
      v-for="(item, i) in items"
      :key="item.id"
      class="crumb"
      :class="{ active: i === items.length - 1 }"
      @click="emit('navigate', item.level, item.id)"
    >
      {{ item.label }}
      <span v-if="i < items.length - 1" class="separator"> &gt; </span>
    </button>
  </nav>
</template>

<style scoped>
.cable-breadcrumb { display: flex; gap: 4px; padding: var(--space-xs) var(--space-sm); font-size: var(--font-sm); }
.crumb { background: none; border: none; color: var(--color-primary); cursor: pointer; }
.crumb.active { color: var(--color-text); font-weight: 600; cursor: default; }
.separator { color: var(--color-text-secondary); }
</style>
```

- [ ] **Step 2: CableLegend.vue**

```html
<script setup lang="ts">
import type { LegendItem, DetailRow } from '../composables/useCableScene'

defineProps<{
  legend: LegendItem[]
  detailRows: DetailRow[]
  animationEnabled: boolean
}>()

const emit = defineEmits<{
  'toggle-animation': []
  'filter-change': [purposes: string[], cableTypes: string[]]
}>()

const PURPOSE_LABELS: Record<string, string> = {
  '正常': '正常连接', '存储': '存储链路', '上联': '交换机上联',
}
</script>

<template>
  <aside class="cable-legend">
    <h4>图例</h4>
    <div class="legend-items">
      <div v-for="item in legend" :key="item.purpose + item.cableType" class="legend-item">
        <svg width="30" height="12">
          <line x1="0" y1="6" x2="28" y2="6"
                :stroke="item.color"
                :stroke-width="2"
                :stroke-dasharray="item.dashArray === 'none' ? 'none' : item.dashArray" />
        </svg>
        <span>{{ PURPOSE_LABELS[item.purpose] ?? item.purpose }} ({{ item.cableType }})</span>
        <span class="count">{{ item.count }}</span>
      </div>
    </div>

    <label class="animation-toggle">
      <input type="checkbox" :checked="animationEnabled" @change="emit('toggle-animation')" />
      方向动画
    </label>

    <details>
      <summary>连接明细 ({{ detailRows.length }})</summary>
      <table class="detail-table">
        <thead>
          <tr><th>源设备</th><th>源端口</th><th>目标设备</th><th>目标端口</th><th>类型</th><th>用途</th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in detailRows" :key="i">
            <td>{{ row.sourceDevice }} <span class="muted">[{{ row.sourceRack }}]</span></td>
            <td>{{ row.sourcePort }}</td>
            <td>{{ row.targetDevice }} <span class="muted">[{{ row.targetRack }}]</span></td>
            <td>{{ row.targetPort }}</td>
            <td>{{ row.cableType }}</td>
            <td>{{ row.purpose }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </aside>
</template>

<style scoped>
.cable-legend { padding: var(--space-sm); font-size: var(--font-sm); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-bg-card); }
.legend-items { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
.legend-item { display: flex; align-items: center; gap: 4px; }
.count { color: var(--color-text-secondary); margin-left: 2px; }
.animation-toggle { display: flex; align-items: center; gap: 4px; margin-top: var(--space-sm); }
.detail-table { width: 100%; border-collapse: collapse; margin-top: var(--space-sm); }
.detail-table th, .detail-table td { padding: 2px 6px; text-align: left; border-bottom: 1px solid var(--color-border); }
.muted { color: var(--color-text-secondary); font-size: var(--font-xs); }
</style>
```

- [ ] **Step 3: 编译验证**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/frontend/src/components/CableBreadcrumb.vue src/frontend/src/components/CableLegend.vue
git commit -m "feat: add CableBreadcrumb and CableLegend components"
```

---

### Task 7: FloorplanCanvas 集成

**Files:**
- Modify: `src/frontend/src/views/FloorplanCanvas.vue`

**Interfaces:**
- Consumes: `useCableScene`, `CableLayer`, `CableBreadcrumb`, `CableLegend`
- Produces: 机房平面图上的线路叠加层

- [ ] **Step 1: 引入依赖**

在 script 顶部添加 import：

```typescript
import { ref, computed } from 'vue'
import { buildCableScene, type CableFocus, type CableScene } from '../composables/useCableScene'
import CableLayer from '../components/CableLayer.vue'
import CableBreadcrumb from '../components/CableBreadcrumb.vue'
import CableLegend from '../components/CableLegend.vue'
```

（如果 vue 和 ref 已有则只加新增的）

- [ ] **Step 2: 添加状态和方法**

```typescript
const cableFocus = ref<CableFocus>({ level: 'room', roomId: '' })
const animationEnabled = ref(true)
const cableScene = ref<CableScene | null>(null)
const cableFilters = ref<{ purposes: string[]; cableTypes: string[] }>({ purposes: [], cableTypes: [] })

async function loadCableScene(): Promise<void> {
  if (cableFocus.value.level === 'room') {
    const result = await request<unknown>(`/api/rooms/${cableFocus.value.roomId}/cable-scene`, { method: 'GET' })
    if (result.ok && result.data) {
      cableScene.value = buildCableScene(result.data as any, cableFocus.value, cableFilters.value)
    }
  }
}

function onBundleClick(bundleId: string): void {
  // 从 bundle 解析出机柜 ID，切换 focus
  const parts = bundleId.split('|')
  if (parts[0] !== '__none__') {
    cableFocus.value = { level: 'rack', rackId: parts[0] }
    cableScene.value = buildCableScene(cableScene.value! as any, cableFocus.value, cableFilters.value)
  }
}

function onNavigate(level: string, id: string): void {
  cableFocus.value = { level: level as CableFocus['level'], [level === 'room' ? 'roomId' : level === 'rack' ? 'rackId' : level === 'device' ? 'deviceId' : 'portId']: id } as CableFocus
  cableScene.value = buildCableScene(cableScene.value! as any, cableFocus.value, cableFilters.value)
}

function onBackgroundClick(): void {
  cableFocus.value = { level: 'room', roomId: cableFocus.value.roomId }
  cableScene.value = buildCableScene(cableScene.value! as any, cableFocus.value, cableFilters.value)
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && cableFocus.value.level !== 'room') {
    onBackgroundClick()
  }
}
```

- [ ] **Step 3: 在 onMounted 中初始化**

在现有的 `onMounted` 中添加 `loadCableScene()` 调用和键盘监听：

```typescript
document.addEventListener('keydown', handleKeydown)
```

在 `onUnmounted` 中清理（如没有则添加）：

```typescript
import { onUnmounted } from 'vue'
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
```

- [ ] **Step 4: 在模板中添加 CableLayer 和相关组件**

在 floorplan SVG 容器内（机柜渲染层的上方）添加：

```html
<CableLayer
  v-if="cableScene"
  :scene="cableScene"
  :animation-enabled="animationEnabled"
  @bundle-click="onBundleClick"
  @background-click="onBackgroundClick"
/>
<CableBreadcrumb
  v-if="cableScene"
  :items="cableScene.breadcrumbs"
  @navigate="onNavigate"
/>
<CableLegend
  v-if="cableScene"
  :legend="cableScene.legend"
  :detail-rows="cableScene.detailRows"
  :animation-enabled="animationEnabled"
  @toggle-animation="animationEnabled = !animationEnabled"
/>
```

- [ ] **Step 5: 编译验证**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/frontend/src/views/FloorplanCanvas.vue
git commit -m "feat: integrate CableLayer into FloorplanCanvas for rack-level cable visualization"
```

---

### Task 8: RackDeviceView 集成

**Files:**
- Modify: `src/frontend/src/views/RackDeviceView.vue`

**Interfaces:**
- Consumes: `useCableScene`, 设备端口连接信息
- Produces: 设备聚焦层线路展示

- [ ] **Step 1: 引入 CableScene 相关依赖**

```typescript
import { buildCableScene, type CableFocus, type CableScene } from '../composables/useCableScene'
```

- [ ] **Step 2: 添加设备层线路状态**

```typescript
const deviceCableFocus = ref<CableFocus | null>(null)
const deviceCableScene = ref<CableScene | null>(null)

function showDeviceCables(deviceId: string): void {
  deviceCableFocus.value = { level: 'device', deviceId }
  // 从已加载的场景数据重新构建
  deviceCableScene.value = buildCableScene(
    cableSceneSnapshot.value!,
    deviceCableFocus.value,
    { purposes: [], cableTypes: [] }
  )
}

function showPortPath(portId: string): void {
  deviceCableFocus.value = { level: 'port', portId }
  deviceCableScene.value = buildCableScene(
    cableSceneSnapshot.value!,
    deviceCableFocus.value,
    { purposes: [], cableTypes: [] }
  )
}
```

- [ ] **Step 3: 在 SwitchPortDrawer 或端口列表中集成**

在设备端口列表中，为已连接的端口添加点击事件，触发 `showPortPath`。

- [ ] **Step 4: 编译验证**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/views/RackDeviceView.vue
git commit -m "feat: add device-level cable visualization to RackDeviceView"
```
