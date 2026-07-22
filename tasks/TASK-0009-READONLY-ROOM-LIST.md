# TASK-0009：首页只读机房列表

> 必须遵守 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md)。本文件仅登记已书面批准的最小范围；独立规格审核通过前不得实施。

## 基本信息

- Task ID：TASK-0009
- Task Name：首页只读机房列表
- Status：BLOCKED
- Owner：Codex Architect
- Implementation Owner：待规格审核 PASS 后由 Codex Architect 书面指定
- Reviewer：Codex Reviewer
- Branch：`feature/task-0009-readonly-room-list`
- Requirement Source：项目负责人 2026-07-21 书面批准的 TASK-0009 范围；`docs/product/MVP-PRODUCT-BASELINE.md` FR-001、BR-027、NFR-007、AC-021、AC-037
- Product Baseline：`docs/product/MVP-PRODUCT-BASELINE.md`
- Architecture Reference：`docs/architecture/AGENT-WORKFLOW.md`；TASK-0007 现有 ASP.NET Core/EF Core/SQLite 基线；TASK-0008 现有认证首页和 `useApi`
- Dependency：TASK-0007、TASK-0008（均已 COMPLETED 并合入 main）
- Module Lock：3 项规格文档锁 `RELEASED` by Codex Architect；0 项实施锁
- Implementation Started：NO

## 当前阻塞

- 原状态：DRAFT
- 新状态：BLOCKED
- 执行角色：Codex Architect
- Blocker：TASK-0008 合并治理缺口尚未完成修复，且 TASK-0009 feature 基线落后于当前 main；在治理状态、分支同步方式和锁状态统一前，不允许继续规格放行或实施。
- 责任人：Codex Architect
- 恢复目标：DRAFT
- 恢复前置条件：当前治理修复任务完成；TASK-0009 分支同步方式获得明确批准；feature 与最新 main 的基线关系经过只读核验；三项规格路径不存在冲突；Codex Architect 重新认领精确规格锁；必要时重新核对规格，但不默认要求重写规格。
- 限制：当前不允许进入 READY，不允许开始实施，不允许执行 Room 代码。
- 规格审核：PASS；业务规格未改变；AC 数量和内容未改变。

## Reviewer 独立性检查

- Owner 与 Reviewer 不同：是；Codex Architect 与 Codex Reviewer 不同
- 修复者与最终 Reviewer 不同：是；如有规格 Finding，由 Codex Architect 修正，Codex Reviewer 独立复审
- 例外原因：N/A：无 Reviewer 独立性例外
- hangyu 批准记录：N/A：无需例外批准
- 补偿性复审方式：N/A：保持独立 Reviewer

## 前置条件

- [x] 产品范围已书面批准：本任务输入及 MVP 产品基线 FR-001/AC-021/NFR-007/AC-037
- [x] TASK-0007 后端认证和数据库基线已 COMPLETED
- [x] TASK-0008 登录壳、受保护首页和 `useApi` 已 COMPLETED
- [x] Owner/Reviewer 独立性已检查
- [x] 规格文档锁无父子路径冲突
- [x] 独立 Codex Reviewer 规格审核 PASS
- [ ] Codex Architect 在审核 PASS 后合法执行 `DRAFT → READY`
- [ ] 实施 Owner 逐项认领实施文件锁

## 任务目标与用户价值

所有已登录用户在现有首页 `/` 中，可以只读查看全部机房的名称和启用状态。不提供机房变更或独立机房页面。

## 功能要求

- FR-01：已登录的四类角色均可通过 `GET /api/rooms` 获取全部机房的只读名称和状态。
- FR-02：现有首页在用户名、角色和登出按钮下方显示机房列表、空态或错误态。
- FR-03：匿名访问 `/` 继续由现有路由守卫重定向 `/login`。
- FR-04：机房列表区域不提供任何创建、编辑、删除、详情、搜索、排序、筛选或分页入口。

## 非功能要求

- NFR-01：继续使用现有 Cookie Authentication、`[Authorize]` 默认策略和 `useApi`，不新增授权策略或客户端 HTTP 抽象。
- NFR-02：错误状态与成功空数组必须可区分；失败时不得显示“暂无机房”。
- NFR-03：仅实现本任务验收所需的最小数据表、API、页面片段和测试，不增加未批准依赖、抽象或功能。

## 最小数据模型

`Room`：

| 字段 | 类型 | 约束 |
|---|---|---|
| `Id` | `Guid` | 主键，系统生成 |
| `Name` | `string` | 必填，全局唯一 |
| `Status` | `string` | 必填，只允许“启用”或“停用” |

- `Name` 全局唯一映射 MVP 产品基线 BR-027。
- `Status` 枚举范围映射 MVP 产品基线 9.1 节。
- 不包含 `CreatedAt`、`Location`、`Notes` 或任何其他字段。

## API 契约

### `GET /api/rooms`

- 认证：使用现有 `[Authorize]` 默认策略；所有已登录角色可访问；不新增授权策略。
- 请求：无查询参数，无请求体。
- `200` 响应：

```json
[
  {
    "name": "A1-核心机房",
    "status": "启用"
  }
]
```

- 响应元素只含 `name`、`status`。
- 空数据返回 `[]`。
- 不返回 `id`、`createdAt`、`location`、`notes`。
- 未认证沿用现有 `401` 行为。
- 不重新定义全局 `500` 错误协议。
- 不保证返回顺序。

## 架构决定

- `RoomsController` 直接使用现有 `AppDbContext`。
- 不创建 `RoomService`、Repository 或独立 DTO 文件；可在现有文件内使用最小投影。
- 前端仅修改现有 `HomeView.vue`，使用现有 `useApi`。
- 不新增 composable、路由或生产种子数据；不修改登录跳转。

## 前端行为

- 保留首页已有用户名、角色、登出按钮及现有行为。
- 在其下方增加 `aria-label="机房列表"` 的只读区域。
- `HomeView` 挂载后只请求一次 `GET /api/rooms`。
- 加载期间不显示空态或错误；不强制新增“加载中”文字。
- 成功有数据时每条只显示名称和状态。
- 成功空数组时显示“暂无机房”。
- 失败时显示安全、可读的错误信息，不显示“暂无机房”。

## 精确文件预算上限

文件预算是上限，不要求实际必须修改全部文件。预算外业务代码文件变更必须停止并申请书面范围变更。

| 操作 | 路径 | 用途 |
|---|---|---|
| 新增 | `src/backend/Datacenter.Api/Models/Room.cs` | 最小 Room 实体 |
| 新增 | `src/backend/Datacenter.Api/Controllers/RoomsController.cs` | 只读 GET API |
| 新增 | `tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs` | 最小后端集成测试 |
| 新增 | `src/backend/Datacenter.Api/Migrations/<timestamp>_AddRooms.cs` | EF Core Migration |
| 新增 | `src/backend/Datacenter.Api/Migrations/<timestamp>_AddRooms.Designer.cs` | EF Core Migration Designer |
| 修改 | `src/backend/Datacenter.Api/Data/AppDbContext.cs` | Rooms DbSet 和约束 |
| 修改 | `src/backend/Datacenter.Api/Migrations/AppDbContextModelSnapshot.cs` | Migration Snapshot |
| 修改 | `src/frontend/src/views/HomeView.vue` | 首页只读列表 |
| 修改 | `src/frontend/src/__tests__/router-and-views.test.ts` | HomeView 最小测试 |

批准新增上限 5，修改上限 4，总上限 9。不得修改预算之外的业务代码文件。

## 禁止修改与明确非目标

- 不修改 `Program.cs`、现有认证/授权契约、`useApi.ts`、`router.ts`、登录页或其他业务代码。
- 不实现创建、编辑、删除、详情、独立 `/rooms` 路由、搜索、排序、筛选、分页或状态修改。
- 不实现 `CreatedAt`、`Location`、`Notes`、机柜/服务器关联、统计、操作日志或生产种子数据。
- 不新增通用 CRUD、Repository、`RoomService`、composable、UI 框架、任何依赖或抽象层。
- 不读取、复制、cherry-pick、恢复或参考 `archive/claude-room-management-unapproved-20260721` 中的实现；只知道该归档分支存在。

## 依赖与复杂度预算

- 新增 NuGet 依赖：0
- 新增 npm 依赖：0
- 新增 DI 服务：0
- 新增路由：0
- 新增数据库表：仅 `Rooms`
- 新增抽象层：0
- 允许修改的数据模型：仅新增上述最小 `Room`
- 允许修改的 API 契约：仅新增上述 `GET /api/rooms`
- 复杂方案采用理由：N/A：采用 Controller 直接查询 DbContext 和 HomeView 直接使用现有 `useApi` 的最简单可行方案

## 测试预算

### 后端集成测试

仅覆盖：

1. 已认证用户获取同时包含启用和停用机房的列表：`200`；返回两种状态；每个响应元素只含 `name`、`status`。四类角色访问权限必须使用一个参数化测试覆盖，不得复制四套相同测试。
2. `Rooms` 表为空时返回 `[]`。
3. 未认证请求返回 `401`。

### 前端 HomeView 测试

仅覆盖：

1. 成功数据显示名称和状态。
2. 空数组显示“暂无机房”。
3. 请求失败显示错误且不显示“暂无机房”。
4. 机房列表区域不存在 AC-06 排除的入口和控件。

现有路由守卫测试必须继续通过，不重复新增相同测试。

## 验收标准

- [ ] AC-01：所有已登录角色访问现有首页 `/` 时，在用户信息和登出按钮下方看到只读机房列表。
- [ ] AC-02：每条机房只显示名称和状态；启用和停用机房都显示。
- [ ] AC-03：无机房数据时显示“暂无机房”。
- [ ] AC-04：请求失败时显示错误信息，不显示“暂无机房”。
- [ ] AC-05：未登录用户访问 `/` 时，继续由现有路由守卫重定向 `/login`。
- [ ] AC-06：机房列表区域不存在创建、编辑、删除、详情、搜索、排序、筛选和分页入口。

## 需求追踪矩阵

| 实现项 | Requirement Source | 要求类型与编号 | 验收标准 |
|---|---|---|---|
| 最小 Room 表与约束 | MVP FR-001、BR-027、9.1 | FR-01、NFR-03 | AC-01、AC-02、AC-03 |
| `GET /api/rooms` 只读 API | MVP FR-001、NFR-007、AC-021、AC-037 | FR-01、FR-03、NFR-01 | AC-01、AC-02、AC-03、AC-05 |
| HomeView 只读列表 | 书面批准范围；MVP FR-001、AC-021 | FR-02、FR-04、NFR-02 | AC-01～AC-06 |
| 后端集成测试 | 书面批准测试预算 | FR-01、FR-03、NFR-01 | AC-01、AC-02、AC-03、AC-05 |
| HomeView 测试 | 书面批准测试预算 | FR-02、FR-04、NFR-02、NFR-03 | AC-01～AC-06 |

## 构建与验证命令

```powershell
dotnet test
pwsh -NoLogo -NoProfile -Command "Set-Location src/frontend; npm test"
pwsh -NoLogo -NoProfile -Command "Set-Location src/frontend; npm run typecheck"
pwsh -NoLogo -NoProfile -Command "Set-Location src/frontend; npm run build"
pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1
git diff --check
git diff --name-status
```

## 构建与测试结果

- 命令：N/A：当前仅创建 DRAFT 规格，未实施代码
- 退出码：N/A：待实施与审核阶段记录
- 摘要/证据：N/A：本轮只运行工作流与文档差异检查

## 交接记录

| 时间 | 发起者 | 原状态 | 新状态 | 接收者 | 证据/说明 |
|---|---|---|---|---|---|
| 2026-07-21 21:54:08 +08:00 | Codex Architect | IDLE | DRAFT | Codex Reviewer | 创建 TASK-0009 规格并登记 3 项规格文档锁；仅待独立规格审核，不授权实施 |
| 2026-07-22 08:33:56 +08:00 | Codex Architect | DRAFT | BLOCKED | Codex Architect | TASK-0008 合并治理缺口尚未完成修复，且 TASK-0009 feature 基线落后于当前 main；释放 3 项规格锁，恢复目标为 DRAFT；恢复前重新核验基线、锁冲突并重新认领 |

## 审核与完成字段

- 审核结论：PASS；报告 `reviews/tasks/TASK-0009-READONLY-ROOM-LIST-SPEC-REVIEW.md`；Findings 0/0/0/0
- 缺陷清单：N/A：规格审核 PASS，Findings 0/0/0/0
- 缺陷修复记录：N/A：无 Finding
- 复审结果：N/A：未进入复审
- Change Request：N/A：本任务范围已书面批准，未发现范围变更
- 提交说明：`docs: define task-0009 readonly room list`
- 提交哈希：N/A：提交后回填不属于本轮必要修改，以 Git 记录为准
- 推送结果：N/A：待本轮推送
- 已知限制：任务当前为 BLOCKED；治理和基线前置条件统一前不得进入 READY、继续 TASK-0009 或开始实施

## 防过度开发检查

- 是否存在验收标准以外的实现：否；本轮无实现
- 是否提前实现未来需求：否
- 是否新增未批准依赖：否
- 是否存在无实际需求的抽象：否；抽象预算为 0
- 是否存在无关重构：否
- 是否采用最简单可行方案：是
- Reviewer 结论：PASS；防过度设计与防过度开发专项检查通过

## 最终完成条件

- [ ] 独立 Reviewer 验收或复审通过
- [ ] 验收标准全部通过
- [ ] 所有缺陷关闭
- [ ] 构建和测试通过或有批准的 N/A
- [ ] 工作流校验和 `git diff --check` 通过
- [ ] 模块锁已释放
- [ ] 已提交并推送
- [ ] 工作区干净
- [ ] 本地与远端哈希一致
- [ ] Reviewer 的防过度开发专项检查通过
- [ ] 状态由 Reviewer 转为 `COMPLETED`

---

> 当前为 BLOCKED；规格审核仍为 PASS，但治理和基线前置条件未满足。恢复目标为 DRAFT；恢复前必须重新核验基线和锁冲突并重新认领三项规格锁，不得进入 READY、开始实施或修改 `src/`/`tests/`。
