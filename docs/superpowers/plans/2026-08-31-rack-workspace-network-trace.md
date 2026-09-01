# 机柜工作区与线路追踪 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户从单机柜设备与精确端口进入可解释的多跳物理线缆追踪，而非默认浏览全机房设备图。

**Architecture:** 保持现有 RackDeviceView、ServerDetailView 和 Cable/Port 数据模型。后端在 NetworkPathController 追加按端口路径与可达终点查询；前端增加独立追踪页，只渲染一条线性路径。

**Tech Stack:** Vue 3、TypeScript、vue-router、Vitest、ASP.NET Core 8、EF Core 8、xUnit。

**Spec:** `docs/superpowers/specs/2026-08-31-rack-workspace-network-trace-design.md`

## Global Constraints

- Owner：Cursor Developer；Reviewer：独立 Codex Reviewer；统筹 Agent 不写业务代码。
- 不新增依赖、数据库表、字段、迁移或外部网络调用。
- 保留现有 `/api/network-path?sourceId=&targetId=` 与所有端口维护行为。
- 路径标记为已登记物理连接、非实时数据；所有开发前须认领精确模块锁。

---

### Task 1: 按端口路径和可达终点 API

**Files:** Modify `src/backend/Datacenter.Api/Controllers/NetworkPathController.cs`; Create `tests/backend/Datacenter.Api.Tests/IntegrationTests/NetworkPathIntegrationTests.cs`.

**Interfaces:** 新增 `GET /api/network-path/by-port?sourcePortId={guid}&targetServerId={guid}` 和 `GET /api/network-path/reachable?sourcePortId={guid}&maxHops={1..10}&limit=100`。

- [ ] **Step 1: 认领后端模块锁** — 在 `tasks/MODULE-LOCKS.md` 登记上述两个路径为 `CLAIMED`；确认无父子冲突后转入 `IN_PROGRESS`。
- [ ] **Step 2: 写失败的集成测试** — 建立 `服务器 A / eth0 -> 接入交换机 -> 核心交换机 -> 服务器 B / eth0`。覆盖精确起点端口、最短路径、默认 4 跳、1–10 跳校验、固定 limit=100、截断元数据、无路径 200 和匿名 401。
- [ ] **Step 3: 验证失败** — 运行 `dotnet test tests/backend/Datacenter.Api.Tests/ --filter FullyQualifiedName~NetworkPathIntegrationTests`；预期新路由不存在而失败。
- [ ] **Step 4: 最小实现** — 在 Controller 添加：

```csharp
[HttpGet("network-path/by-port")]
public Task<IActionResult> FindPathByPort(Guid sourcePortId, Guid targetServerId, CancellationToken cancellationToken)

[HttpGet("network-path/reachable")]
public Task<IActionResult> FindReachable(Guid sourcePortId, int maxHops = 4, int limit = 100, CancellationToken cancellationToken)
```

从 `sourcePortId` 开始 BFS；按跳数、邻居设备 ID、端口 ID、线缆 ID 稳定排序；仅现有规则识别的网络设备可中继；路径中不重复设备；最多十跳。发现模式完整计数可达非网络设备端口，稳定返回前 100 项与截断元数据。

- [ ] **Step 5: 验证和提交** — 依次运行新测试、全量 `dotnet test tests/backend/Datacenter.Api.Tests/` 与 `git diff --check`；通过后提交 `feat(network): trace physical paths from a port`，两条锁改为 `HANDED_OFF` 并记录证据。

### Task 2: 线路追踪页面和端口入口

**Files:** Create `src/frontend/src/composables/useNetworkTrace.ts`, `src/frontend/src/views/NetworkTraceView.vue`, `src/frontend/src/__tests__/network-trace.test.ts`; Modify `src/frontend/src/router.ts`, `src/frontend/src/views/ServerDetailView.vue`, `src/frontend/src/__tests__/server-detail-view.test.ts`.

**Interfaces:** 新路由 `/network-trace?sourcePortId={guid}&sourceServerId={guid}`；composable 暴露 `findPath` 和 `findReachable`，消费 Task 1 API、现有 `GET /api/servers?name=` 搜索、`GET /api/servers/{id}` 与 `GET /api/servers/{id}/ports`。

- [ ] **Step 1: 认领六个前端路径** — 确认 Task 1 锁已 `HANDED_OFF` 后，认领上列所有精确路径。
- [ ] **Step 2: 写失败测试** — mock 两追踪 API、来源设备/端口查询和现有设备名称搜索，并断言默认 `sourcePortId, 4, 100`，页面在搜索前固定显示经校验的来源设备/端口，来源设备与端口不匹配时不追踪，名称搜索的候选设备可被选为目标，非法 0/11 跳提示，截断文本“已显示 100 / 共 135 个终点”，点终点后渲染起点/交换机/目标/端口，非实时说明可见；详情页已连接端口链接同时携带两个来源 ID，未连接端口不可追踪。
- [ ] **Step 3: 验证失败** — 运行 `cd src/frontend && npm test -- network-trace.test.ts server-detail-view.test.ts`；预期页面、入口和 composable 缺失而失败。
- [ ] **Step 4: 最小实现** — composable 只请求相对 `/api` 路径；追踪页有“已知目标”“发现终点”标签，先用现有来源设备和端口查询校验路由参数并固定显示来源，再调用现有 `/api/servers?name=` 以设备名称选择目标，默认 4 跳、固定 100 项，使用 Vue DOM/CSS 线性节点和逐跳列表，不引入 Konva/CableLayer/依赖。已连接端口使用：

```ts
router.push({ path: '/network-trace', query: { sourcePortId: port.id, sourceServerId: serverId.value } })
```

- [ ] **Step 5: 验证和提交** — 运行目标测试、`npm test`、`npm run typecheck`、`npm run build`、`git diff --check`；提交 `feat(frontend): add port-based network trace`；六条锁改为 `HANDED_OFF`。

### Task 3: 机柜优先入口和全景视图降级

**Files:** Modify `src/frontend/src/views/TopologyView.vue`, `src/frontend/src/__tests__/topology.test.ts`.

**Interfaces:** 选中机柜进入现有 `/racks/:id`；全景设备图保留为显式“全景线路图”。

- [ ] **Step 1: 认领两个拓扑路径** — 确认 Task 2 锁 `HANDED_OFF` 后认领。
- [ ] **Step 2: 写失败测试** — 断言选机柜后的“进入机柜工作区”和机柜双击导航 `/racks/{rackId}`、不调用 `loadDevices`；断言全景入口明确命名“全景线路图”。
- [ ] **Step 3: 验证失败** — 运行 `cd src/frontend && npm test -- topology.test.ts`；预期当前双击进入全机房 devices 模式而失败。
- [ ] **Step 4: 最小实现** — 未选机柜时禁用工作区入口并提示先选择机柜；选中时导航 `/racks/{id}`。保留全景 canvas、筛选和渲染，仅改为显式全景入口；不修改 CableLayer、useCableScene 或后端拓扑 API。
- [ ] **Step 5: 完成回归和提交** — 运行 `npm test`、`npm run typecheck`、`npm run build`、`git diff --check`；手工验证“机房级 -> 机柜级 -> 选机柜 -> 机柜工作区 -> 设备详情 -> 已连接端口 -> 两种追踪模式”；提交 `feat(topology): make rack workspace the default device entry`，锁改为 `HANDED_OFF`，任务转 `READY_FOR_REVIEW`。

## Reviewer Checkpoints

1. 新路径从精确端口开始，旧契约不变，无数据库或依赖变更。
2. 发现模式满足默认 4 跳、范围 1–10、固定 100 项、环路保护、稳定排序和非实时说明。
3. 日常入口为单机柜，端口详情无回归，全景图仍可显式进入。
4. 测试、构建、diff、模块锁、提交和推送满足 `docs/architecture/AGENT-WORKFLOW.md`。

## Plan Self-Review

每个规格要求均映射到 Task 1–3；无占位步骤；两条 API 的 `sourcePortId` 与前端路由参数一致。
