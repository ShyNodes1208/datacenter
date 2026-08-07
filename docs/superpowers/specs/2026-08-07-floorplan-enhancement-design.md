# 机房 2.5D 平面图增强 & 线缆连接策略 — 设计文档

> **流水线 ID**: TASK-0053 | **类型**: fullstack | **状态**: PLANNING

## 1. 用户流程

```
登录 → 首页(机房列表) → 点击机房 → 2.5D 平面图
                                    ├── 点击机柜 → 右侧详情面板
                                    │   ├── 机柜名称/编号
                                    │   ├── 42U 容量（已用/空闲）
                                    │   ├── 设备列表（名称、类型、U位）
                                    │   └── 位置变更记录
                                    │
                                    └── 线缆连接入口 → 线缆列表
                                        └── 连接策略图（起点→终点可视化）
```

## 2. 页面与组件拆分

```
FloorplanView.vue（修改）
├── FloorplanToolbar.vue（不动）
├── FloorplanCanvas.vue（修改）
│   └── 增强：机柜选中态、容量条、设备标记
├── RackDetailPanel.vue（新增）
│   ├── 机柜基本信息（code, heightU, brand）
│   ├── U 位占用可视化（42U 纵向条）
│   ├── 设备列表（名称→设备类型→U位区间）
│   ├── 位置变更记录（时间→设备→动作→U位变化）
│   └── 关联线缆列表
└── CableConnectionStrategy.vue（新增）
    └── 基于 cable-connection-strategy.html 的静态视觉参考
        改造成数据驱动的线缆关系展示

CableListView.vue（修改）
├── 线缆筛选（保留）
├── 线缆列表（保留）
└── 连接策略卡片（新增，嵌入 CableConnectionStrategy）

新增文件清单：
  src/frontend/src/components/RackDetailPanel.vue
  src/frontend/src/components/CableConnectionStrategy.vue
  src/frontend/src/components/__tests__/RackDetailPanel.test.ts
  src/frontend/src/components/__tests__/CableConnectionStrategy.test.ts

允许修改文件：
  src/frontend/src/views/FloorplanView.vue
  src/frontend/src/components/FloorplanCanvas.vue
  src/frontend/src/views/CableListView.vue
  src/frontend/src/router.ts

禁止修改文件（由 TASK-0052 / 现有功能占用）：
  VisualReferenceView.vue / VisualReferencePanel.vue
  HomeView.vue
  RackDeviceView.vue / RackFrontPanel.vue / RackOperationDrawer.vue
  NetworkPathDrawer.vue / SwitchPortDrawer.vue
  App.vue / main.ts / useAuth.ts
```

## 3. 2D 平面图数据模型

```typescript
// 平面图整体数据
interface FloorplanData {
  room: RoomInfo
  racks: RackOnFloorplan[]
  cables: CableOnFloorplan[]
}

interface RoomInfo {
  id: string
  name: string
  rackCount: number
}

interface RackOnFloorplan {
  id: string
  code: string           // 机柜编号, e.g. "A01"
  x: number              // 平面图 X 坐标
  y: number              // 平面图 Y 坐标
  heightU: number        // 总 U 数, 默认 42
  devices: DeviceOnRack[]
  occupancy: {
    usedU: number
    freeU: number
    totalU: number
  }
}

interface DeviceOnRack {
  id: string
  name: string           // 设备名称
  deviceType: string     // 服务器/交换机/路由器/存储
  startU: number         // 起始 U 位 (1-based)
  endU: number           // 结束 U 位
}

interface CableOnFloorplan {
  id: string
  sourceRackCode: string
  targetRackCode: string
  cableType: '铜缆' | '光纤' | 'DAC'
  color: string          // 线缆颜色 hex
}
```

## 4. 数据关系

```
Room (1) ──< (N) Rack
  Rack.id → DevicePosition.rackId
  Rack.code → Cable 关联（通过 Port → Server → Rack）

Rack (1) ──< (N) DevicePosition
  DevicePosition.rackId → Rack.id
  DevicePosition.serverId → Server.id
  DevicePosition.startU / endU → U位范围

Server (1) ──< (N) Port
  Port.id → Cable.sourcePortId / Cable.targetPortId

Cable (N:N through Ports)
  Cable.sourcePortId → Port.id → Server → Rack (sourceRackCode)
  Cable.targetPortId → Port.id → Server → Rack (targetRackCode)

U 位约束：
  - startU >= 1, endU <= rack.heightU
  - 同一个 rackId 的 DevicePosition 区间不可重叠
  - 校验公式：new [startU, endU] ∩ existing [startU, endU] == ∅

位置变更记录：
  - 来源：AuditService 已有数据
  - 过滤：devicePositions 相关的事件
  - 展示：时间、设备名称、动作(上架/下架/移动)、U位变化
```

## 5. API 契约

### 5.1 GET /api/rooms/{roomId}/floorplan-data

**用途**：获取指定机房的完整平面图数据

**响应**：
```json
{
  "room": { "id": "guid", "name": "核心机房A", "rackCount": 12 },
  "racks": [
    {
      "id": "guid", "code": "A01", "x": 100, "y": 200, "heightU": 42,
      "devices": [
        { "id": "guid", "name": "web-01", "deviceType": "服务器", "startU": 1, "endU": 2 },
        { "id": "guid", "name": "db-01", "deviceType": "服务器", "startU": 5, "endU": 8 }
      ],
      "occupancy": { "usedU": 5, "freeU": 37, "totalU": 42 }
    }
  ],
  "cables": [
    {
      "id": "guid", "sourceRackCode": "A01", "targetRackCode": "B03",
      "cableType": "光纤", "color": "#f1c40f"
    }
  ]
}
```

**后端实现**：CableSceneController 已有 `GET /api/rooms/{roomId}/cable-scene`，本次在该 Controller 新增 `/api/rooms/{roomId}/floorplan-data` 端点。复用已有 `dbContext.Racks` + `dbContext.ServerPositions` 查询，增加 occupancy 计算和 cable 关联。

### 5.2 GET /api/racks/{rackId}/detail

**用途**：获取单个机柜的完整详情（右侧面板用）

**响应**：
```json
{
  "rack": { "id": "guid", "code": "A01", "heightU": 42, "brand": "华为", "power": "3kW", "notes": "" },
  "devices": [
    { "id": "guid", "name": "web-01", "deviceType": "服务器", "startU": 1, "endU": 2, "uHeight": 2 }
  ],
  "occupancy": { "usedU": 5, "freeU": 37, "totalU": 42 },
  "positionHistory": [
    { "time": "2026-08-07T10:00:00Z", "deviceName": "web-01", "action": "上架", "fromU": null, "toU": 1 }
  ],
  "cables": [
    { "id": "guid", "portName": "eth0", "remoteDevice": "db-01", "remoteRack": "B03" }
  ]
}
```

**后端实现**：RacksController 新增 `GET /api/racks/{id}/detail`。组装 rack + devices + occupancy + AuditService 查询 + 关联 cable。

### 5.3 GET /api/racks/{rackId}/position-history

**用途**：获取机柜的设备位置变更历史

**响应**：
```json
{
  "rackCode": "A01",
  "history": [
    { "time": "2026-08-07T10:00:00Z", "deviceName": "web-01", "action": "上架", "fromU": null, "toU": 1 },
    { "time": "2026-08-06T15:00:00Z", "deviceName": "web-01", "action": "下架", "fromU": 1, "toU": null },
    { "time": "2026-08-05T09:00:00Z", "deviceName": "db-01", "action": "移动", "fromU": 10, "toU": 5 }
  ]
}
```

### 5.4 GET /api/cables/connections

**用途**：获取线缆连接关系摘要（用于连接策略图）

**查询参数**：`?roomId=` (可选，按机房过滤), `?cableType=` (可选，按类型过滤)

**响应**：
```json
{
  "connections": [
    {
      "id": "guid",
      "source": { "deviceName": "web-01", "portName": "eth0", "rackCode": "A01", "roomName": "核心机房A" },
      "target": { "deviceName": "db-01", "portName": "eth1", "rackCode": "B03", "roomName": "核心机房A" },
      "cableType": "光纤",
      "color": "#f1c40f",
      "status": "normal",
      "notes": null
    }
  ]
}
```

## 6. 状态管理

不引入 Pinia/Vuex。使用现有 composable 模式：

```
useFloorplan.ts（已有，扩展）
  └── 管理 selectedRackId、floorplanData、rackDetail

useCableScene.ts（已有，扩展）
  └── 管理 cableConnections、连接策略图数据

数据流：
  FloorplanView.vue
    ├── onMounted → fetch floorplanData (GET /api/rooms/:id/floorplan-data)
    ├── selectRack(id) → fetch rackDetail (GET /api/racks/:id/detail)
    │   └── RackDetailPanel 绑定 rackDetail
    └── cableClick → 跳转 /cables?roomId=xxx

  CableListView.vue
    ├── onMounted → fetch connections (GET /api/cables/connections)
    └── CableConnectionStrategy 绑定 connections
```

## 7. 任务拆分与角色分工

| 任务 | 角色 | 内容 | 依赖 |
|------|------|------|------|
| **TASK-0053-BE-01** | Codex Backend | 新增 `GET /api/rooms/{roomId}/floorplan-data` | — |
| **TASK-0053-BE-02** | Codex Backend | 新增 `GET /api/racks/{rackId}/detail` | — |
| **TASK-0053-BE-03** | Codex Backend | 新增 `GET /api/racks/{rackId}/position-history` | — |
| **TASK-0053-BE-04** | Codex Backend | 新增 `GET /api/cables/connections` | — |
| **TASK-0053-FE-01** | Cursor | 新增 `RackDetailPanel.vue` — 机柜详情右侧面板 | BE-02, BE-03 |
| **TASK-0053-FE-02** | Cursor | 新增 `CableConnectionStrategy.vue` — 线缆连接可视化 | BE-04 |
| **TASK-0053-FE-03** | Cursor | 修改 `FloorplanView.vue` — 集成 RackDetailPanel | FE-01 |
| **TASK-0053-FE-04** | Cursor | 修改 `FloorplanCanvas.vue` — 增强选中态+容量展示 | BE-01 |
| **TASK-0053-FE-05** | Cursor | 修改 `CableListView.vue` — 集成 CableConnectionStrategy | FE-02 |
| **TASK-0053-RV-01** | Codex Reviewer | 审核全部后端+前端 diff | 全部完成 |

**执行顺序**：BE-01 → BE-02 → BE-03 → BE-04（可并行）→ FE 任务（按依赖）

## 8. 验收标准

| ID | 标准 | 验证方式 |
|----|------|---------|
| AC-01 | 登录后进入 `/rooms/:id/floorplan`，看到深色背景 2.5D 平面图 | 手动 |
| AC-02 | 点击机柜，右侧面板显示 rack.code、heightU、usedU/freeU | 手动 + 组件测试 |
| AC-03 | 右侧面板列出该机柜所有设备（名称、类型、U位） | 手动 |
| AC-04 | 右侧面板显示设备位置变更记录（来源：AuditService） | 手动 |
| AC-05 | U 位占用可视化显示 42U 纵向条，区分已用/空闲 | 手动 |
| AC-06 | 线缆连接策略页 `/cables` 显示起点→终点关系图 | 手动 |
| AC-07 | 线缆按类型（铜缆/光纤/DAC）区分颜色 | 手动 |
| AC-08 | 平面图机柜间线缆不显示（用户要求去掉线缆连接线） | 手动 |
| AC-09 | `GET /api/rooms/:id/floorplan-data` 返回正确 JSON | 后端测试 |
| AC-10 | `GET /api/racks/:id/detail` 返回 occupancy + devices + history | 后端测试 |
| AC-11 | `GET /api/racks/:id/position-history` 过滤正确 | 后端测试 |
| AC-12 | `GET /api/cables/connections` 返回完整连接关系 | 后端测试 |
| AC-13 | U 位上架校验 startU/endU 合法且不重叠 | 后端测试 |
| AC-14 | `vue-tsc --noEmit` 通过 | CI |
| AC-15 | `npm run build` 通过 | CI |
| AC-16 | 不修改 TASK-0052 锁定文件 | diff check |
| AC-17 | 不新增前端依赖 | diff check |

## 9. 明确不做（本期）

- 全建筑 BIM
- 3D 机柜漫游
- 实时线缆动画
- 冷热通道展示
- 温湿度/流体仿真
- AI 容量预测
- 完整供电链路
- 网络拓扑系统
- 实时监控数据接入
- 修改 HomeView / RackDeviceView / RackFrontPanel / NetworkPathDrawer
- 新增数据库表（纯查询 DTO）
- 新增前端框架依赖

## 10. 给 Cursor 的前端开发提示词

```
## Cursor Frontend Task — 机房 2.5D 平面图增强

### 上下文
完整设计文档见 docs/superpowers/specs/2026-08-07-floorplan-enhancement-design.md

### 当前流水线状态
读取 tasks/active/state.json 了解后端 API 完成情况。
后端会提供以下 API：
- GET /api/rooms/{roomId}/floorplan-data
- GET /api/racks/{rackId}/detail
- GET /api/cables/connections?roomId=&cableType=

### 功能实现
1. FloorplanCanvas.vue — 增强：
   - 机柜选中态：深色轮廓 → 青色高亮 (#39d2c0)，2px 边框
   - 每个机柜顶部显示容量占用条（已用/空闲比例）
   - 点击机柜 emit('select-rack', rackId)

2. RackDetailPanel.vue — 新增（右侧 360px 面板）：
   - 机柜基本信息区：编号、42U 总量、品牌
   - U 位占用可视化：纵向 42U 条形图，青色=已用，深灰=空闲
   - 设备列表：表格（设备名称、类型、U位区间），支持点击跳转设备详情
   - 位置变更记录：时间线列表（最近 10 条）
   - 关联线缆：列表，点击跳转线缆详情
   - 关闭按钮

3. CableConnectionStrategy.vue — 新增：
   - 基于 visual-reference/cable-connection-strategy.html 的视觉风格
   - 数据驱动：接收 connections 数组
   - 每个连接显示起点(设备@机柜) → 终点(设备@机柜)
   - 颜色区分：铜缆 #e67e22 / 光纤 #f1c40f / DAC #3498db
   - 连接状态标签：正常/待确认/异常

4. FloorplanView.vue — 修改：
   - 引入 RackDetailPanel
   - 点击机柜 → 右侧滑入 RackDetailPanel
   - 点击空白 → 关闭面板
   - 响应式：窄屏时面板全宽覆盖

5. CableListView.vue — 修改：
   - 引入 CableConnectionStrategy
   - 在筛选栏下方新增"连接策略"卡片区域
   - 保留原有线缆表格

### 约束
- 禁止修改 VisualReferenceView/VisualReferencePanel
- 禁止修改 HomeView / RackDeviceView / RackFrontPanel
- 禁止新增 npm 依赖
- 使用现有暗色主题 CSS 变量
- 组件测试覆盖关键交互

### 验收
- vue-tsc --noEmit 通过
- npm run build 通过
- 组件测试通过
```

## 11. 给 Codex Reviewer 的独立审核清单

```
## Codex Review Task — TASK-0053 审核

### 审核范围
后端（4 个新 API）+ 前端（1 新增组件 + 3 修改组件）

### 审核基准
完整设计文档：docs/superpowers/specs/2026-08-07-floorplan-enhancement-design.md

### 逐项检查

#### 后端（Codex Backend 产出）
□ GET /api/rooms/{roomId}/floorplan-data — 返回结构是否符合 API 契约
□ GET /api/racks/{rackId}/detail — occupancy 计算是否正确
□ GET /api/racks/{rackId}/position-history — 是否正确关联 AuditService
□ GET /api/cables/connections — 连接关系是否完整（含 sourceRackCode/targetRackCode）
□ U 位重叠校验 — DevicePositionsController 是否实现了区间冲突检测
□ 所有新端点是否有 [Authorize] 标记
□ 是否新增了数据库表 / migration（预期：无）
□ 是否修改了已有端点的行为（预期：无）

#### 前端（Cursor 产出）
□ RackDetailPanel.vue — 是否正确渲染 occupancy / devices / history
□ FloorplanCanvas.vue — 选中态高亮 + 容量条是否正常
□ FloorplanView.vue — 面板滑入/关闭交互
□ CableConnectionStrategy.vue — 线缆颜色/方向/状态是否正确
□ 是否修改了禁止修改文件（VisualReference*, HomeView, RackDeviceView）
□ 是否新增 npm 依赖

#### 全局
□ vue-tsc --noEmit 通过
□ dotnet build 通过
□ npm run build 通过
□ git diff --check 通过

### 审核输出格式
写入 reviews/tasks/TASK-0053-REVIEW.md
- 总体结论：PASS / CHANGES_REQUESTED
- 问题列表（如有）：id, severity, file, summary, recommendation
```
