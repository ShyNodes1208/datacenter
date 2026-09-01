# CR-001：TASK-20260810-000003 设备级拓扑 Change Request

- **Change Request ID**：CR-001
- **原任务**：TASK-20260810-000003（机房拓扑地图）
- **发现者**：Claude + DeepSeek（用户需求）
- **变更原因**：用户于 2026-08-11 提出设备到设备的 2.5D 线缆拓扑需求，要求现有拓扑支持下钻到设备级和端口级连接
- **Requirement Source**：用户于 2026-08-11 提出的设备级拓扑视觉图稿，已翻译为 [设备级 2.5D 线缆拓扑视觉规格](../docs/ui/DEVICE-TOPOLOGY-VISUAL-SPEC.md)
- **产品范围影响**：TASK-20260810-000003 范围从"机房级 + 机柜级"扩展为"机房级 + 机柜级 + 设备级"
- **Claude 裁决**：APPROVED（裁决写入 [MVP 产品基线附录 A](../docs/product/MVP-PRODUCT-BASELINE.md#21-登记拓扑可视化附录-a设备级拓扑)）
- **Architect 裁决**：APPROVED（Claude 兼任 Architect，2026-08-11 确认技术影响：后端 1 文件 2 处修改，前端扩展现有框架，无新增依赖、无数据模型变更、无 API 契约破坏）
- **批准状态**：APPROVED（产品 + 技术双批准）

---

# TASK: 设备级拓扑 — 登记连接可视化

- **Task-ID**：TASK-20260810-000003（复用，通过 CR-001 扩展范围）
- **当前状态**：READY
- **Requirement Source**：用户于 2026-08-11 提出设备到设备的 2.5D 线缆拓扑需求
- **Owner**：Cursor（前端 + 后端）
- **Reviewer**：Codex Reviewer

## 1. 产品基线（不可变）

以下内容已写入产品基线，Cursor 不得自行修改：

1. 所有线路始终显示静态方向箭头（VIS-001）。
2. 选中的线路和完整路径必须高亮（VIS-002）。
3. 只有选中的线路允许显示纯前端装饰性流动动画（VIS-003）。
4. 页面必须显著显示"非实时流量"提示（VIS-004）。
5. 动画不代表实际数据包方向、实时带宽或实时链路状态（VIS-005）。
6. 关闭动画或 prefers-reduced-motion 时，只停止动画，静态箭头和路径高亮必须保留（VIS-006）。

上述效果属于**登记拓扑的前端展示**，不是实时网络监控能力。

## 2. 字段展示语义（不可变）

| 字段 | 展示方式 | 空值 |
|---|---|---|
| CableType | 线色映射、筛选、图例。当前值：铜缆、光纤、DAC | — |
| Purpose | 线型/颜色区分、筛选、图例。当前值：正常、上联、存储 | 默认"正常" |
| Port.Speed | 详情面板显示实际值（如"10G""1G"） | 显示"未登记"，不得伪造 |
| 线路"状态" | 无此字段，显示"已登记"或省略 | 不显示"正常" |
| 登记方向 | SourcePort→TargetPort，标注为"登记端点方向" | — |

**禁止**：伪造图稿中的"管理网络""业务网络""存储网络""10 Gbps"等当前数据库不存在的分类或值。

## 3. 实现范围

### 3.1 后端

**FR-DEV-1：cable-scene 返回全部在架设备**
- 修改 `CableSceneController.cs` 的 `GetScene` 方法
- devices 查询条件从"仅网络设备"改为"当前机房内全部在架设备"
- 即移除 `DeviceType.Contains("交换")` 等过滤条件
- 保持现有响应结构不变

**FR-DEV-2：cable-scene 响应增加 Port.Speed**
- 在 cables 的 Source 和 Target 匿名对象中增加 `Speed = c.SourcePort.Speed` / `Speed = c.TargetPort.Speed`
- Speed 可为 null，前端自行处理空值

**文件影响**：
- `src/backend/Datacenter.Api/Controllers/CableSceneController.cs`（修改）
- 对应后端集成测试（如存在，需更新）

### 3.2 前端

**FR-DEV-3：useTopology 增加 devices 模式**
- 在 `useTopology.ts` 中增加 `'devices'` 模式
- devices 模式的数据结构复用现有 `TopologyData`，或适当扩展以包含设备级信息
- 对接 `/api/rooms/{roomId}/cable-scene` 接口

**FR-DEV-4：设备级画布**
- 在 `TopologyView.vue` 中增加设备级画布渲染
- 设备节点：显示名称、设备类型（简化轮廓）、所在机柜
- 端口锚点：设备边缘小型锚点，默认只显示有线缆连接的端口
- 线路：复用 `CableLayer.vue` 的箭头、高亮、动画和 reduced-motion 处理
- 复用 `useCableScene.ts` 已有的设备焦点、端口焦点、路由、筛选、图例逻辑

**FR-DEV-5：静态箭头 + 选中高亮 + 装饰性动画**
- 所有线路中段显示静态方向箭头（基于 `useCableScene` 或 `CableLayer` 现有箭头能力）
- 选中线路：线宽加大（3-4px）、不透明度 ≥ 0.9
- 非选中线路：不透明度降低到 0.15-0.30
- 选中线路允许装饰性流动动画（虚线偏移）；关闭动画或 reduced-motion 时停止动画但保留箭头和高亮

**FR-DEV-6：设备焦点与弱化**
- 单击设备 → 该设备及直接相连线路高亮，非相关设备和线路降低透明度
- 焦点设备使用主色描边
- 点击画布空白区域清除焦点

**FR-DEV-7：线路详情面板**
- 单击线路 → 右侧打开详情面板
- 显示：源设备名、源端口名、目标设备名、目标端口名、CableType、Purpose、端口 Speed、所在机柜编码
- Speed 缺失时显示"未登记"
- 面板可关闭

**FR-DEV-8："非实时流量"提示**
- 页面显著位置（顶部标题副标题或画布上方）显示提示文字
- 内容："登记连接拓扑示意，非实时流量。箭头为登记端点方向，不代表实际数据包路由。"

**FR-DEV-9：筛选**
- 设备级支持按 CableType 和 Purpose 筛选
- 复用 `useCableScene` 已有的 `CableFilters` 机制

**FR-DEV-10：层级导航**
- 机柜级 → 设备级：双击机柜或"查看设备"按钮
- 设备级 → 机柜级：面包屑或返回按钮
- 保持所选机房上下文

**文件影响**：
- `src/frontend/src/composables/useTopology.ts`（修改，增加 devices 模式）
- `src/frontend/src/views/TopologyView.vue`（修改，增加设备级画布）
- `src/frontend/src/composables/useCableScene.ts`（按需调整）
- `src/frontend/src/components/CableLayer.vue`（按需调整）
- `src/frontend/src/__tests__/topology.test.ts`（更新，增加设备级测试）
- 必要时新增设备拓扑组件（前提：TopologyView 继续膨胀且拆分能降低实现风险）

## 4. 明确不实现

1. 不修改数据库迁移
2. 不修改 Room/Server/Port/Cable 数据模型
3. 不新增第三方依赖
4. 不引入 Three.js 或新的图可视化框架
5. 不修改与拓扑无关的服务器 CRUD、机房 CRUD
6. 不重构整个前端主题系统
7. 不把图稿示例数据硬编码到项目
8. 不新增 API 端点（复用已有 cable-scene 和 network-path）
9. 不实现全机房所有设备同时展开（必须先选机房）
10. 不实现实时流量、带宽、告警等监控能力

## 5. 验收标准

| 编号 | 验收标准 |
|---|---|
| AC-DEV-01 | 用户从机柜级进入设备级后，画布只显示当前机房的机柜和在架设备，不显示其他机房的设备 |
| AC-DEV-02 | 每个设备显示真实名称；悬浮时显示设备类型、运行状态、机柜编码和 U 位范围 |
| AC-DEV-03 | 两台设备之间的 Cable 连线两端落在具体端口锚点上；详情面板显示真实源端口名和目标端口名 |
| AC-DEV-04 | 单击设备后，该设备及直接相连线路高亮，非相关线路透明度明显降低 |
| AC-DEV-05 | 单击线路后，右侧显示源设备、源端口、目标设备、目标端口、CableType、Purpose、端口 Speed；Speed 缺失时显示"未登记" |
| AC-DEV-06 | 所有线路中段显示静态方向箭头 |
| AC-DEV-07 | 选中线路高亮（线宽 3-4px，不透明度 ≥ 0.9），非选中线路不透明度 0.15-0.30 |
| AC-DEV-08 | 页面显著位置显示"非实时流量"提示，内容包含"登记端点方向" |
| AC-DEV-09 | 操作系统启用 prefers-reduced-motion 时，流动动画停止，静态箭头和路径高亮仍然可见 |
| AC-DEV-10 | 现有机房级和机柜级拓扑：功能不受影响，原有测试全部通过 |
| AC-DEV-11 | 按 CableType（铜缆/光纤/DAC）或 Purpose（正常/上联/存储）筛选后，只显示匹配线路 |
| AC-DEV-12 | 点击空白区域可清除设备焦点，所有设备恢复原始透明度 |
| AC-DEV-13 | TypeScript 类型检查通过，前端构建成功 |
| AC-DEV-14 | 后端构建和全部测试通过 |

## 6. 测试要求

- 前端：`npx vitest run` 全部通过（含新增设备级测试）
- 前端：`npx vue-tsc --noEmit` typecheck 通过
- 前端：`npm run build` 构建成功
- 后端：`dotnet test` 全部通过
- 现有 topology.test.ts 的机房级和机柜级回归测试通过

## 7. 模块锁

本 CR 复用 TASK-20260810-000003 的现有 CLAIMED 锁（共 12 项）。如 Architect 确认文件清单有增减，需更新 MODULE-LOCKS.md。

## 8. 完成条件

1. 所有验收标准通过
2. 构建、测试、typecheck 通过
3. 提供运行截图
4. Codex Reviewer 独立审核通过
5. 无越界修改或过度开发
