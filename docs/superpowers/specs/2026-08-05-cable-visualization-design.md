# 机柜只读线路可视化

## 目标

在机房二维平面图和机柜检查器中，只读展示交换机端口及其连接关系。三层展示（机柜总览→设备聚焦→端口追踪），线路聚合避免重叠，方向动画表达路径追踪。

## 裁决记录

| 决策点 | 裁决 |
|--------|------|
| 数据来源 | Excel 导入 + 手动录入（已有） |
| 逻辑 vs 物理路径 | 逻辑连接路径（无物理桥架数据） |
| 展示范围 | 交换机到服务器 + 交换机上联 |
| 线路类型 | Purpose 字段：正常/存储/上联 |
| 理线通道 | 算法自动生成，基于机柜坐标 |
| 动画语义 | 路径追踪方向，非实时流量 |

## 数据模型变更

### Cable 表

新增 `Purpose` 字段：

```csharp
public string Purpose { get; set; } = "正常";  // 正常 / 存储 / 上联
```

迁移：新增列，默认值 "正常"。回填规则：
- CableType=DAC → Purpose=存储
- 两端设备均为交换机 → Purpose=上联
- 其余 → Purpose=正常

### 受影响端点

| 端点 | 变更 |
|------|------|
| `POST /api/cables` | CreateRequest 加可选 Purpose 字段 |
| `POST /api/cables/import` | Excel 模板加"线路用途"列，Import 方法处理 |
| `GET /api/cables` | 返回 Purpose，加 `purpose` 筛选参数 |

## 后端 — CableScene 端点

### `GET /api/rooms/{roomId}/cable-scene`

一次性返回机房内全量线路数据。

**响应：**

```json
{
  "racks": [
    { "rackId": "guid", "rackCode": "A01", "x": 100, "y": 200, "width": 60, "height": 120 }
  ],
  "devices": [
    { "deviceId": "guid", "deviceName": "SW-A01", "rackId": "guid", "deviceType": "交换机", "uRange": "20-21" }
  ],
  "cables": [
    {
      "cableId": "guid",
      "cableType": "光纤",
      "purpose": "上联",
      "source": { "deviceId": "guid", "deviceName": "SW-A01", "portName": "GE0/0/1", "rackId": "guid", "rackCode": "A01" },
      "target": { "deviceId": "guid", "deviceName": "SW-B01", "portName": "GE0/0/1", "rackId": "guid", "rackCode": "B01" }
    }
  ]
}
```

仅返回两端至少有一端在指定机房的电缆。新建 `CableSceneController.cs`。

## 前端架构

### 深模块 `useCableScene.ts`

```typescript
function buildCableScene(
  snapshot: CableSnapshot,   // 后端返回的原始数据
  focus: CableFocus,          // 当前焦点层级
  filters: CableFilters       // 图例筛选
): CableScene
```

**核心类型：**

```typescript
type CableFocus =
  | { level: 'room'; roomId: string }
  | { level: 'rack'; rackId: string }
  | { level: 'device'; deviceId: string }
  | { level: 'port'; portId: string }

interface CableScene {
  bundles: CableBundle[]
  highlightedPath: PortPath | null
  legend: LegendItem[]
  detailRows: DetailRow[]
  breadcrumbs: BreadcrumbItem[]
}

interface CableBundle {
  id: string
  purpose: string
  cableType: string
  count: number
  route: Point[]
  opacity: number
  highlighted: boolean
}
```

**三层显隐规则：**

| 层级 | 可见 | 淡化 | 隐藏 |
|------|------|------|------|
| room | 聚合线束（机柜间） | — | 设备内部线路 |
| rack | 本机柜所有线路 | 其他机柜线路 | — |
| device | 选中设备相关线路 | 其他线路（0.15） | — |
| port | 选中端口完整路径 | 其他全部（0.1） | — |

**聚合规则：** 同源柜+同目标柜+同purpose+同cableType → 聚合为一条线束，显示 ×N。

**理线通道路由：**
- 机柜间：源柜边缘 → 水平/垂直主通道 → 目标柜边缘
- 机柜内：设备端口位置 → 机柜出线点 → 外部通道
- 同柜设备：沿机柜侧面垂直通道走线
- 线束不穿过设备主体，始终沿通道边缘

### 视图层组件

| 组件 | 职责 |
|------|------|
| `CableLayer.vue` | SVG 叠加层，渲染 bundles + highlightedPath |
| `CableBreadcrumb.vue` | 面包屑：A01 > SW-CORE-A01 > 端口 08 |
| `CableLegend.vue` | 图例（颜色+线型+文字）+ 类型筛选 + 明细表 |

**集成点修改：**
- `FloorplanCanvas.vue` — 引入 CableLayer（机柜总览层）
- `RackDeviceView.vue` — 设备聚焦层线路展示

### 动画

- 选中端口路径：CSS `stroke-dasharray` + `stroke-dashoffset` 动画模拟方向流动
- `prefers-reduced-motion: reduce` 时停止动画
- 全局开关：用户可关闭动画，线路变为静态实线

### 空状态

| 状态 | 展示 |
|------|------|
| 机房无网络设备 | "该机房暂未发现网络设备" |
| 设备无端口 | "该设备暂无端口" |
| 端口未连接 | "端口未连接" |
| 加载失败 | "加载失败 [重试]" |

### 免责声明

页面底部固定显示："路径追踪效果，非实时流量"

## 文件清单

| 层 | 文件 | 操作 | 职责 |
|----|------|------|------|
| 后端 | `Models/Cable.cs` | 修改 | +Purpose |
| 后端 | Migrations/`*_AddCablePurpose.cs` | 新建 | 迁移 |
| 后端 | `Controllers/CableSceneController.cs` | 新建 | GET cable-scene |
| 后端 | `Controllers/CablesController.cs` | 修改 | Create/Import/List 支持 Purpose |
| 前端 | `composables/useCableScene.ts` | 新建 | 深模块 |
| 前端 | `components/CableLayer.vue` | 新建 | SVG 渲染 |
| 前端 | `components/CableBreadcrumb.vue` | 新建 | 面包屑 |
| 前端 | `components/CableLegend.vue` | 新建 | 图例+筛选+明细 |
| 前端 | `views/FloorplanCanvas.vue` | 修改 | 集成 CableLayer |
| 前端 | `views/RackDeviceView.vue` | 修改 | 设备层线路展示 |

## 验收标准对照

| AC | 验证点 |
|----|--------|
| AC-021 | 同类型多线聚合为 ×N |
| AC-022 | 选中设备展开，其他淡化 |
| AC-023 | 端口追踪显示完整路径 |
| AC-024 | 线路沿通道走，不穿过设备 |
| AC-025 | Esc/面包屑逐级返回 |
| AC-026 | 动画可关闭 |
| AC-027 | 尊重 prefers-reduced-motion |
| AC-028 | 颜色+线型+文字图例 |
| AC-029 | 无写入入口 |
| AC-030 | 免责声明文字 |
| AC-031 | 3 秒加载 + 切换无卡顿 |
| AC-032 | 三种空状态区分 |

## 不做

- 端口/交换机/线路新增编辑删除
- 实时流量/带宽/告警
- WebSocket/SSE
- 物理桥架/走线架
- 网络拓扑编辑器
- 3D/WebGL/Canvas
- 第三方拓扑框架
