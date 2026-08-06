# Task 4: useCableScene 深模块

> **Assigned to:** Cursor
> **Depends on:** Task 3 (需要 API 数据结构)
> **Plan ref:** docs/superpowers/plans/2026-08-05-cable-visualization.md

## 目标

创建 `useCableScene.ts` composable，集中处理线路聚合、理线通道路由、三层显隐逻辑。这是整个可视化功能的核心模块。

## 文件

| 文件 | 操作 |
|------|------|
| `src/frontend/src/composables/useCableScene.ts` | 新建 |

## 核心逻辑

### 1. 类型定义

导出以下接口：

```typescript
Point { x, y }
CableFocus = { level: 'room', roomId } | { level: 'rack', rackId } | { level: 'device', deviceId } | { level: 'port', portId }
CableFilters { purposes: string[], cableTypes: string[] }
RackInfo { rackId, code, x, y, width, height }
DeviceInfo { deviceId, deviceName, rackId, deviceType, startU, endU }
EndpointInfo { deviceId, deviceName, portName, rackId, rackCode }
CableInfo { cableId, cableType, purpose, source: EndpointInfo, target: EndpointInfo }
CableSnapshot { racks: RackInfo[], devices: DeviceInfo[], cables: CableInfo[] }
CableBundle { id, purpose, cableType, count, sourceRackId, targetRackId, route: Point[], opacity, highlighted, isAggregated }
PortPath { cableId, sourceLabel, targetLabel, route: Point[] }
LegendItem { purpose, cableType, color, dashArray, count }
DetailRow { sourceDevice, sourcePort, targetDevice, targetPort, cableType, purpose, sourceRack, targetRack }
BreadcrumbItem { label, level, id }
CableScene { bundles: CableBundle[], highlightedPath: PortPath | null, legend: LegendItem[], detailRows: DetailRow[], breadcrumbs: BreadcrumbItem[] }
```

### 2. 颜色/线型映射

```typescript
const PURPOSE_COLORS: Record<string, string> = {
  '正常': '#3B82F6',   // 蓝
  '存储': '#F59E0B',   // 橙
  '上联': '#10B981',   // 绿
}
const PURPOSE_DASH: Record<string, string> = {
  '正常': 'none',
  '存储': '6,4',
  '上联': '2,4',
}
```

### 3. 几何计算函数

- `rackCenter(r: RackInfo): Point` — 机柜中心点
- `deviceEdgePoint(device, rack, direction): Point` — 设备在机柜某侧面的出线点
- `routeBetweenRacks(srcRack, srcDevice, tgtRack, tgtDevice): Point[]` — 机柜间理线通道路由
- `sameRackRoute(rack, src, tgt): Point[]` — 同机柜内侧面走线

### 4. 聚合函数

`aggregateCables(cables, rackMap): CableBundle[]`
- 按 `源柜|目标柜|purpose|cableType` 分组
- 同组 >1 条即为聚合线束 (`isAggregated: true`)
- 线束宽度 = `3 + min(count, 10)`

### 5. 三层显隐 (buildCableScene)

```
room 层:  所有聚合线束全显，过滤同机柜内线路
rack 层:  本机柜相关全显，其他 opacity=0.15
device 层: 选中设备相关全显，其他 opacity=0.15
port 层:  只高亮端口路径(红色)，其他 opacity=0.1
```

### 6. 导出函数

```typescript
export function buildCableScene(
  snapshot: CableSnapshot,
  focus: CableFocus,
  filters: CableFilters,
): CableScene
```

完整实现参考: `docs/superpowers/plans/2026-08-05-cable-visualization.md` Task 4 部分 (约 180 行代码)

## 编译验证

```bash
cd src/frontend && npx vue-tsc --noEmit
```

## Commit

```
feat: add useCableScene composable for cable aggregation/routing/visibility
```
