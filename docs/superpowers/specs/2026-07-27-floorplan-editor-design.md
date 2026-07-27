# Floorplan 平面编辑器设计文档

**日期**: 2026-07-27
**状态**: 设计完成，待用户审核
**参考系统**: NetBox Data Model + NetBox Floorplan Plugin + Rackscope

---

## 1. 背景与动机

### 1.1 现状

当前项目 (v1.0.0 MVP) 具备完整的数据管理能力（机房/机柜/服务器 CRUD + U 位可视化 + 上架/移动/下架），但**完全缺失空间可视化**：

- 机柜有 X/Y/Z 坐标字段，但前端从未渲染为 2D 平面布局
- 用户无法直观看到机房内机柜的物理位置关系
- 上架操作依赖表单选择 U 位号，缺少空间交互

### 1.2 参照系统分析

| 参照 | 核心能力 | 当前差距 |
|---|---|---|
| **NetBox 数据模型** | Region→Site→Location→Rack→Device 层级；DeviceType/Manufacturer 抽象 | 数据模型扁平，缺 DeviceType/Location 层级（按需后补） |
| **NetBox Floorplan Plugin** | 2D Canvas 平面图，机柜绘制，墙壁/区域叠加，点击导航 | **完全缺失** — 无 2D 平面图 |
| **Rackscope** | 拖拽编辑器，视觉状态传播，告警颜色联动 | 无拖拽，无视觉状态传播（按需后补） |

### 1.3 本次目标

**Phase 2 第一步**：实现 Floorplan 平面编辑器，让用户能在 2D 俯视图中查看、编辑机柜位置。

- **包含**: Canvas 2D 渲染、机柜颜色映射、拖拽编辑、点击导航、网格吸附
- **不包含**: 墙壁/区域绘制、设备类型模型、3D 视图、告警联动（后续 Phase）

---

## 2. 整体架构

### 2.1 页面路由

```
当前路由                          新增
/  (HomeView)                   
/racks/:id  (RackDeviceView)    
/servers/*  (3个视图)           
                                /rooms/:id/floorplan  ← FloorplanView.vue
```

### 2.2 组件树

```
FloorplanView.vue                    ← 页面容器
├── FloorplanToolbar                 ← 模式切换(查看/编辑)、缩放控制、图例按钮
├── FloorplanCanvas.vue              ← Konva Stage 封装
│   ├── Layer 0: 背景 + 网格
│   ├── Layer 1: 机房边界 (v2)
│   ├── Layer 2: 机柜节点 (Konva.Group)
│   │   ├── Konva.Rect (主体，颜色=占用率)
│   │   ├── Konva.Text (编号)
│   │   └── Konva.Rect (占用率进度条)
│   ├── Layer 3: 文字标注 (v2)
│   └── Layer 4: 交互 (Transformer + 吸附线)
└── FloorplanSidebar                 ← 双击机柜展开的快捷面板
```

### 2.3 状态管理

不引入 Pinia，使用 composable 模式：

- `useFloorplan(roomId)`: 机柜数据加载、缩放/平移状态、坐标转换
- `useFloorplanEditor()`: 编辑模式逻辑、拖拽处理、吸附、undo/redo、API 写入

### 2.4 现有系统改动点

- **HomeView.vue**: Room 卡片增加 "平面图" 按钮 → 跳转 `/rooms/:id/floorplan`
- **RackDeviceView.vue**: 面包屑增加 "返回平面图" 链接
- **router.ts**: 新增 `/rooms/:id/floorplan` 路由

---

## 3. Canvas 图层结构

### 3.1 分层定义

```
Layer 0: 背景层 (BackgroundLayer)
  └── 纯色背景 + 网格线 (虚线, 浅灰)
      网格间距: 60px (对应实际 600mm)
      网格原点: 画布左上角

Layer 1: 边界层 (BoundaryLayer) [v2 可选]
  └── 机房墙壁: Konva.Line (封闭多边形)
  └── 柱子/障碍物: Konva.Rect

Layer 2: 机柜层 (RackLayer)
  └── 每个 Rack: Konva.Group (编辑模式可拖拽)
      ├── Konva.Rect (机柜主体, 60×100px, 对应标准机柜 600×1000mm 俯视轮廓)
      ├── Konva.Text (编号标签)
      └── Konva.Rect (占用率进度条, 底部 4px)

Layer 3: 标注层 (LabelLayer) [v2 可选]
  └── 区域名称、行列标签

Layer 4: 交互层 (InteractionLayer)
  └── Konva.Transformer (选中高亮 + 缩放手柄, 编辑模式)
  └── 吸附辅助线 (拖拽时显示对齐虚线)
```

### 3.2 坐标映射

```
Rack.X, Rack.Y (数据库, 单位: mm)
       ↓ 除以 scale (10mm/px)
Canvas x, y (像素坐标)

机柜渲染尺寸: 600mm/10 = 60px (宽) × 1000mm/10 = 100px (深)
网格间距:     600mm/10 = 60px
```

### 3.3 机柜颜色映射

```
占用率 < 50%              → 绿色 (--color-success)
占用率 50% ~ 80%          → 橙色 (--color-warning)  
占用率 > 80%              → 红色 (--color-danger)
空机柜 (occupiedU === 0)  → 灰色空心边框
选中状态                  → 蓝色边框 (--color-primary)
```

---

## 4. 交互设计

### 4.1 查看模式（默认）

| 操作 | 行为 |
|---|---|
| 滚轮 | 缩放 (0.3x ~ 3x)，以鼠标位置为中心 |
| 拖拽空白区域 | 平移画布 |
| Hover 机柜 | 高亮 + Tooltip（编号/U位占用/品牌/功率） |
| Click 机柜 | 跳转 `/racks/:id` 机柜详情页 |
| 双击机柜 | 展开快捷信息 Sidebar |
| Click 空白 | 取消选中 |
| 键盘 1/2 | 切换查看/编辑模式 |

### 4.2 编辑模式

| 操作 | 行为 |
|---|---|
| 拖拽机柜 | 移动位置，实时更新坐标 |
| 拖拽松手 | 自动调 `PUT /api/racks/:id` 写入新 X/Y |
| 拖拽中 | 显示吸附辅助线（网格 + 对象边缘对齐） |
| 吸附规则 | 网格吸附(60px) + 边到边 + 中心到中心 |
| Ctrl+Z / Ctrl+Y | Undo / Redo 移动操作 |
| Click 机柜 | 选中，显示 Transformer 手柄 |
| 拖拽空白 | 平移画布（编辑模式下） |

### 4.3 Tooltip 内容

```
┌─────────────────────┐
│ A01                 │
│ 42U 机柜            │
│ 已用: 28U (67%)     │
│ 品牌: HP            │
│ 功率: 3.5kW         │
│ 点击查看详情 →      │
└─────────────────────┘
```

### 4.4 Sidebar

双击机柜时右侧展开，显示：
- 机柜基本信息（编号、房间、U位、品牌、功率）
- 占用率统计
- 快捷操作按钮（查看详情 → `/racks/:id`、上架服务器）

---

## 5. 数据流与 API

### 5.1 数据获取

```
FloorplanView mount
  → GET /api/racks?roomId={id}
  → 构建 Konva 节点树
  → 渲染到 Canvas
```

### 5.2 拖拽保存（乐观更新）

```
用户松手 (Konva dragend)
  → 读取新 x, y (Canvas 像素)
  → 转换: dbX = canvasX × scale, dbY = canvasY × scale
  → 乐观更新本地 RackItem
  → PUT /api/racks/{id} { x, y }
  → 成功: 静默
  → 失败: 回滚坐标 + toast "保存失败, 请重试"
```

### 5.3 API 复用

| 接口 | 用途 | 状态 |
|---|---|---|
| `GET /api/racks?roomId=` | 获取机房所有机柜 (含 X/Y/Z/occupiedU) | ✅ 已有 |
| `PUT /api/racks/:id` | 更新机柜坐标 X/Y | ✅ 已有，UpdateRackRequest 已含 X/Y/Z |

### 5.4 后端改动

**零改动。** 现有数据模型、API 端点、请求/响应 DTO 全部满足需求。

---

## 6. 文件预算

### 6.1 新增文件

| 文件 | 估算行数 | 职责 |
|---|---|---|
| `src/frontend/src/views/FloorplanView.vue` | ~350 | 页面布局：Toolbar + Canvas + Sidebar 三栏 |
| `src/frontend/src/components/FloorplanCanvas.vue` | ~300 | Konva Stage 封装：图层初始化、节点渲染、事件桥接 |
| `src/frontend/src/composables/useFloorplan.ts` | ~200 | 状态管理：数据加载、缩放/平移、坐标转换 |
| `src/frontend/src/composables/useFloorplanEditor.ts` | ~250 | 编辑逻辑：拖拽、吸附、undo/redo、乐观更新 |
| `src/frontend/src/__tests__/floorplan.test.ts` | ~100 | FloorplanView 渲染 + composable 单元测试 |

### 6.2 修改文件

| 文件 | 改动 | 行数 |
|---|---|---|
| `src/frontend/src/router.ts` | 新增路由 `/rooms/:id/floorplan` | +6 |
| `src/frontend/src/views/HomeView.vue` | Room 卡片增加 "平面图" 按钮 | +15 |
| `src/frontend/src/views/RackDeviceView.vue` | 面包屑增加 "返回平面图" 链接 | +5 |
| `src/frontend/package.json` | 增加 `konva` 依赖 | +1 |

### 6.3 依赖分析

- `konva` (v9.x): ~170KB gzipped, MIT 协议, 无额外子依赖
- 不引入 `vue-konva`: 减少封装层，直接操作 Konva API，与 composable 模式更契合
- 项目首个 `src/components/` 目录下的可复用组件

### 6.4 总计

- **新增**: ~1200 行 TypeScript/Vue
- **修改**: ~27 行
- **后端改动**: 0 行
- **新依赖**: 1 个

---

## 7. 验收标准

### AC-FP-001: 平面图查看
- [ ] 从 HomeView Room 卡片 "平面图" 按钮可进入 `/rooms/:id/floorplan`
- [ ] 机柜在 Canvas 上按 X/Y 坐标正确渲染
- [ ] 机柜颜色按占用率映射（绿/橙/红/灰）
- [ ] 机柜编号标签清晰可见
- [ ] 网格背景提供空间参考

### AC-FP-002: 缩放与平移
- [ ] 滚轮缩放范围 0.3x ~ 3x
- [ ] 拖拽空白区域可平移画布
- [ ] 缩放以鼠标位置为中心

### AC-FP-003: 机柜交互
- [ ] Hover 机柜显示 Tooltip（编号/U位/占用率/品牌/功率）
- [ ] Click 机柜跳转 `/racks/:id`
- [ ] 双击机柜展开 Sidebar

### AC-FP-004: 编辑模式 - 拖拽
- [ ] 切换到编辑模式后可拖拽机柜
- [ ] 松手后自动调 PUT API 保存坐标
- [ ] 拖拽时显示网格吸附线
- [ ] 拖拽时显示与其他机柜的对齐线
- [ ] API 失败时坐标回滚 + toast 提示

### AC-FP-005: 编辑模式 - Undo/Redo
- [ ] Ctrl+Z 回退移动操作
- [ ] Ctrl+Y 重做移动操作

### AC-FP-006: 导航
- [ ] RackDeviceView 面包屑可返回平面图
- [ ] 查看/编辑模式按 1/2 键切换

### AC-FP-007: 测试
- [ ] FloorplanView 渲染测试
- [ ] useFloorplan 数据加载和坐标转换测试
- [ ] useFloorplanEditor 拖拽/吸附/undo 逻辑测试
- [ ] 后端 API (PUT racks) 已有测试确认通过

---

## 8. 不纳入范围 (Out of Scope)

以下能力来自参照系统分析，但**不在本次实现范围内**：

| 能力 | 理由 | 优先级 |
|---|---|---|
| 墙壁/区域/标注绘制工具 | 需要新增 FloorplanObject 模型 | P1 - 下个 Phase |
| Location 递归层级 (Floor→Row→Cage) | 需要新增 Location 模型 + 父子关系 | P1 |
| DeviceType / Manufacturer 模型 | 数据模型重构 | P1 |
| 告警状态视觉传播 (Rackscope 风格) | 需要告警系统对接 | P2 |
| NOC 大屏视图 | 独立页面 | P2 |
| SVG/PNG 导出 | Floorplan Plugin 功能 | P2 |
| 3D 机柜视图 | 需要 Three.js | P3 |
| IPAM / Power / Cable 模型 | 大规模数据模型扩展 | P3 |

---

## 9. 技术风险与应对

| 风险 | 应对 |
|---|---|
| Konva 库缺乏 Vue 3 官方集成 | 用 composable 封装 Konva API，保持响应式桥接 |
| 首次引入 Canvas 渲染，缺少团队经验 | 参考 Konva 官方 React/Vue demo，保持简单 |
| 坐标映射精度 (mm ↔ px) | 固定 scale=10mm/px，存储用整数 mm |

---

## 10. 后续演进路径

```
Phase 2.1 (本次): Floorplan 平面编辑器
       ↓
Phase 2.2: 墙壁/区域/标注绘制 + FloorplanObject 模型
       ↓
Phase 2.3: DeviceType / Manufacturer 模型 + NetBox 风格抽象
       ↓
Phase 2.4: Location 递归层级 (Floor → Row → Cage)
       ↓
Phase 3.1: Rackscope 风格视觉状态传播 (告警颜色)
       ↓
Phase 3.2: 3D 机柜视图 (Three.js)
```
