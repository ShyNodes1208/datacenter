# 网络连接路径功能

## 目标

实现设备间经过交换机的已登记连接路径查询：BFS 最短路径计算 + 前端路径抽屉 + 平面图机柜高亮。

参考：`docs/product/DEVICE-NETWORK-PATH-PROPOSAL.md`

---

## Task 1: 后端 NetworkPathController

**文件:** `src/backend/Datacenter.Api/Controllers/NetworkPathController.cs`（新建）

### 端点

```http
GET /api/network-path?sourceId={guid}&targetId={guid}
```

### 算法

1. 从 DB 加载所有 Port + Cable 数据到内存（用 AsNoTracking）
2. 构建无向图：节点=ServerId，边=Cable（SourcePort↔TargetPort）
3. 网络设备判断：DeviceType 含 `交换/switch/路由/router/网络/network`（case-insensitive）
4. BFS：
   - 起点和终点不能相同
   - 中间节点只能走网络设备（交换机/路由器）
   - 线缆方向忽略（双向无向图）
   - 最多搜索 10 跳
5. 稳定排序：等长路径按 deviceId 排序保证确定性

### 响应（找到路径）

```json
{
  "pathFound": true,
  "warning": "已登记连接拓扑示意，不代表实时数据包路由",
  "devices": [
    { "deviceId": "guid", "deviceName": "服务器A", "deviceType": "服务器", "rackCode": "A01" }
  ],
  "hops": [
    {
      "fromDeviceId": "guid", "fromDeviceName": "服务器A",
      "fromPortId": "guid", "fromPortName": "eth0",
      "cableId": "guid", "cableType": "铜缆",
      "toDeviceId": "guid", "toDeviceName": "SW-01",
      "toPortId": "guid", "toPortName": "GE0/0/1"
    }
  ]
}
```

### 响应（无路径）

```json
{
  "pathFound": false,
  "warning": "已登记连接拓扑示意，不代表实时数据包路由",
  "reason": "未找到已登记的连接路径"
}
```

### 实现要点

- Controller 模式：`[ApiController] [Authorize] [Route("api")]` + primary constructor `AppDbContext`
- 只读端点，所有认证用户可访问
- 所有查询用 `AsNoTracking()`
- 参考 `CablesController.cs` 的查询模式（ServerPositions JOIN 获取 rackCode）

---

## Task 2: 前端 NetworkPathDrawer 组件

**文件:** `src/frontend/src/components/NetworkPathDrawer.vue`（新建）

### 抽屉结构

复用 `SwitchPortDrawer.vue` 的 drawer-overlay/drawer-panel/drawer-header/drawer-body 结构。

### Props

```ts
visible: boolean
loading: boolean
error: string
pathResult: NetworkPathResult | null
```

`NetworkPathResult` 接口：
```ts
interface PathDevice {
  deviceId: string; deviceName: string; deviceType: string; rackCode: string | null
}
interface PathHop {
  fromDeviceId: string; fromDeviceName: string; fromPortId: string; fromPortName: string
  cableId: string; cableType: string
  toDeviceId: string; toDeviceName: string; toPortId: string; toPortName: string
}
interface NetworkPathResult {
  pathFound: boolean
  warning: string
  reason?: string
  devices?: PathDevice[]
  hops?: PathHop[]
}
```

### Emits

```ts
(e: 'close'): void
(e: 'search', sourceId: string, targetId: string): void
```

### 模板状态

| 状态 | 显示 |
|---|---|
| **设备选择**（无结果） | 标题"连接路径查询"，源设备下拉 + 目标设备下拉 + 查询按钮 + 取消按钮 |
| **loading** | 正在计算连接路径... |
| **error** | 红色错误信息 |
| **pathFound=false** | "未找到已登记的连接路径" + 建议检查端口线缆登记 |
| **pathFound=true** | Warning banner + 步骤式路径展示 |

### 设备选择器

- 调用 `GET /api/servers` 获取设备列表
- 下拉列表显示：`设备名 (设备类型) - 机柜` 方便识别
- 同一个设备不能同时选为源和目标

### 路径展示

```
┌────────────────────────────────────────┐
│ ⚠ 已登记连接拓扑示意，不代表实时数据包路由 │
├────────────────────────────────────────┤
│ 服务器 A（A01 机柜）                    │
│   eth0                                  │
│    │ 铜缆                               │
│    ▼                                    │
│ 交换机 SW-01（A01 机柜）                 │
│   GE0/0/1 → GE0/0/12                   │
│    │ 铜缆                               │
│    ▼                                    │
│ 服务器 B（A01 机柜）                    │
│   eth0                                  │
├────────────────────────────────────────┤
│                              [关闭]     │
└────────────────────────────────────────┘
```

### 交互

- 设备名可点击 → `router.push('/servers/' + id)`
- 线缆类型用小色块（复用 `SwitchPortDrawer.vue` 的 CABLE_COLORS）
- 设备未上架（rackCode=null）时显示"未上架"标签
- 抽屉宽度 560px（路径信息比端口表格宽）

### 加载设备列表

- `onMounted` 或 `watch(visible)` 时加载 `GET /api/servers`
- 下拉列表支持按名称搜索（可用原生 `<input list>` 或搜索式 select）

---

## Task 3: FloorplanCanvas 机柜高亮

**文件:** `src/frontend/src/components/FloorplanCanvas.vue`

### 新增 prop

```ts
highlightedRackIds: string[]
```

### 行为

- 高亮 rack 列表中的机柜节点：红色边框 + 发光阴影（`stroke='#e74c3c'`, `shadowColor='#e74c3c'`, `shadowBlur=8`）
- 两端都在高亮机柜内的 cable 线：加粗（strokeWidth 5）+ 红色 + 高透明度
- `highlightedRackIds` 为空数组时不应用任何高亮效果

---

## Task 4: 前端集成

**文件:** `src/frontend/src/views/RackDeviceView.vue`, `src/frontend/src/views/FloorplanView.vue`

### RackDeviceView

- 工具栏添加 "连接路径查询" 按钮
- 点击 → 打开 NetworkPathDrawer（设备选择模式）
- 搜索 → 调用 API → 展示结果
- 状态管理：`networkPathVisible`, `networkPathLoading`, `networkPathError`, `networkPathResult`

### FloorplanView

- 工具栏添加 "连接路径查询" 按钮
- 打开同一个 NetworkPathDrawer 组件
- 当 pathResult 有数据且 pathFound=true → 提取所有 rackId 传给 FloorplanCanvas 的 `highlightedRackIds`
- 关闭抽屉时清空高亮

---

## 验收

1. 同机柜路径：A01 中选两台通过交换机连接的服务器 → 显示 2-hop 路径
2. 跨机柜路径：选不同机柜设备 → 显示完整设备+端口链
3. 无路径：选两台无连接关系设备 → "未找到已登记的连接路径"
4. 同设备：选同一设备 → 返回 400 错误
5. 平面图高亮：FloorplanView 打开路径结果 → 相关机柜红色高亮
6. 权限：只读用户可访问，不修改数据

## 执行顺序

**Task 1+2 并行** → Task 3+4 在后
