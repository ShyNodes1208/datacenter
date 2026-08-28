# TASK-20260828-073500：设备级拓扑二次点击进入设备详情

> 遵守 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md)。

## 基本信息

- Status：READY
- Owner：Cursor Developer
- Reviewer：Codex Reviewer
- Branch：`feature/TASK-20260828-073500-device-detail-navigation`
- Requirement Source：用户 2026-08-28 已确认：设备级拓扑保留第一次点击设备的链路聚焦；再次点击同一已聚焦设备进入设备详情页。
- Product Baseline：`docs/product/MVP-PRODUCT-BASELINE.md`
- Architecture Reference：`docs/architecture/MVP-ARCHITECTURE-BASELINE.md`、`docs/architecture/AGENT-WORKFLOW.md`

## 用户结果

用户在设备级拓扑中可先单击设备查看其相关链路和端口；再次单击同一设备后进入该设备的既有详情页。详情页继续展示设备自身资料和所有已登记连接的对端设备、机柜、U 位及端口。

## Task 1: Cursor Developer 实施范围

1. 仅修改 `src/frontend/src/views/TopologyView.vue`：当用户点击当前已聚焦设备时，调用既有路由跳转到 `/servers/:id`；首次点击或点击另一设备仍维持现有聚焦行为。
2. 仅修改 `src/frontend/src/__tests__/topology.test.ts`：先写失败测试，再覆盖首次聚焦、同设备二次点击跳转、切换设备仍聚焦以及拖动画布不跳转。
3. 复用现有 `ServerDetailView.vue`、`/servers/:id` 路由和端口连接数据；不得修改它们。

## 明确不做

- 不修改后端 API、数据库、迁移、认证、线缆数据或设备详情页字段。
- 不新增页面、抽屉、按钮、依赖、双击手势或移动端专用分支。
- 不改变机柜首次点击、画布拖拽、缩放、线缆选择或现有首次设备聚焦行为。

## 验收标准

| ID | 要求 | 验收 |
|---|---|---|
| FR-01 | 首次点击设备聚焦链路。 | 设备未聚焦时，点击后仍留在拓扑页，设备及关联链路按现有规则聚焦。 |
| FR-02 | 再次点击同一设备进入详情。 | 已聚焦设备再次点击时，路由仅跳转至 `/servers/<encodeURIComponent(deviceId)>`。 |
| FR-03 | 点击另一设备不误跳转。 | 已聚焦 A 时点击 B，改为聚焦 B，仍停留在拓扑页。 |
| FR-04 | 拖动不触发跳转。 | 超过既有拖拽阈值后释放或随后的抑制点击不调用路由跳转。 |
| NFR-01 | 范围最小。 | 修改仅限上述两个前端文件；无 API、数据库、依赖或路由定义变更。 |

## 验证命令

```bash
cd src/frontend && npm test -- topology.test.ts
cd src/frontend && npm test
cd src/frontend && npm run typecheck
cd src/frontend && npm run build
git diff --check
```

## 状态迁移记录

| 时间 | 发起者 | 原状态 | 新状态 | 证据 |
|---|---|---|---|---|
| 2026-08-28 07:35 +08:00 | Codex + Terra | IDLE | DRAFT | 已核对拓扑的现有设备聚焦、详情路由和详情页连接信息。 |
| 2026-08-28 07:35 +08:00 | Codex + Terra | DRAFT | READY | 用户明确确认“第一次聚焦、第二次跳详情”；Owner/Reviewer 独立、范围与验收完整，且目标路径无活跃锁。 |

## Cursor Developer 接手条件

开始前读取本任务、`AGENTS.md`、`docs/architecture/AGENT-WORKFLOW.md`、`tasks/current-task.md`；确认无父子路径锁冲突后，认领两个允许路径并合法进入 `IN_PROGRESS`。若实现需要改变 API、详情页、交互规则或增加文件，停止并交回统筹 Agent。
