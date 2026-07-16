# TASK-EXAMPLE：机柜标签查询示例（说明文件）

> 本文件仅说明如何填写任务，不是当前活动任务。示例遵守 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md)，其中提交与时间为虚构证据。

## 基本信息

- Task ID：TASK-EXAMPLE
- Task Name：按机柜标签查询只读详情
- Status：COMPLETED
- Owner：Codex Backend
- Reviewer：Codex Reviewer
- Branch：feature/example-rack-label-query
- Requirement Source：docs/product/PRD.md#rack-label-query-rev2
- Product Baseline：PB-EXAMPLE-001，Claude 于 2026-07-10 批准
- Architecture Reference：docs/contracts/RACKS.md#find-by-label
- Module Lock：`src/backend/Racks/`，详见本文件模块占用记录

## Reviewer 独立性检查

- Owner 与 Reviewer 不同：是，Codex Backend 与 Codex Reviewer 为不同主体
- 修复者与最终 Reviewer 不同：是，修复者为 Codex Backend
- 例外原因：N/A：未使用独立性例外
- hangyu 批准记录：N/A：未使用独立性例外
- 补偿性复审方式：N/A：未使用独立性例外

## 前置条件

- [x] 产品基线已批准：PB-EXAMPLE-001
- [x] Owner/Reviewer 独立性已检查：不同主体
- [x] 模块父子路径冲突已检查：无 `CLAIMED` 或 `HANDED_OFF` 重叠路径
- [x] API 契约已批准：docs/contracts/RACKS.md#find-by-label

## 允许修改

- src/backend/Racks/
- tests/backend/Racks/

## 禁止修改

- src/frontend/
- docs/contracts/
- 数据库结构和迁移

## 功能要求

1. 提供已批准契约中的只读机柜标签精确查询。
2. 未找到时返回契约定义的 404 响应。
3. 每次完成有效标签查询时，将既有 `rack_query_total` 查询计数增加 1。

## 非功能要求

1. 查询不得修改数据，并沿用现有权限检查。
2. 不新增第三方依赖。

## 验收标准

- [x] AC-01：有效标签返回对应机柜及 200。
- [x] AC-02：未知标签返回契约规定的 404。
- [x] AC-03：自动化测试覆盖成功与未找到路径。
- [x] AC-04：执行一次有效标签查询后，`rack_query_total` 相比查询前恰好增加 1。

## 构建命令

```powershell
dotnet build .\DatacenterLayout.sln
```

## 构建结果

- 命令：`dotnet build .\DatacenterLayout.sln`
- 退出码：0
- 摘要/证据：Build succeeded，0 warnings，0 errors

## 测试命令

```powershell
dotnet test .\tests\DatacenterLayout.Backend.Tests.csproj --filter RackLabel
```

## 测试结果

- 命令：`dotnet test .\tests\DatacenterLayout.Backend.Tests.csproj --filter RackLabel`
- 退出码：0
- 摘要/证据：Passed 5，Failed 0，Skipped 0；包含 `rack_query_total` 单次增量断言

## 模块占用记录

| Task ID | Module or Path | Owner | Claimed At | Status | Release Condition | Released At |
|---|---|---|---|---|---|---|
| TASK-EXAMPLE | src/backend/Racks/ | Codex Backend | 2026-07-11T09:00:00+08:00 | RELEASED | 状态进入 COMPLETED 或 CANCELLED | 2026-07-12T16:30:00+08:00 |
| TASK-EXAMPLE | tests/backend/Racks/ | Codex Backend | 2026-07-11T09:00:00+08:00 | RELEASED | 状态进入 COMPLETED 或 CANCELLED | 2026-07-12T16:30:00+08:00 |

冲突检查示例：若 TASK-EXAMPLE-2 同时申请 `src/backend/Racks/Queries/`，它与本任务的父路径占用重叠，必须转 `BLOCKED`；不能仅因位于另一工作区而继续。

## 开发完成证据

- 修改文件：`src/backend/Racks/RackQueryService.cs`、`tests/backend/Racks/RackQueryServiceTests.cs`
- 验收证据：AC-01 至 AC-04 均由 5 个自动化测试和 Reviewer 重跑结果覆盖，包括 `rack_query_total` 单次增量断言
- 模块锁状态：开发交审和修复交复审时为 `HANDED_OFF`，完成前已改为 `RELEASED`
- 已知限制：仅支持精确匹配；模糊查询明确不在产品基线内

## 交接记录（完整合法流转）

| 时间 | 发起者 | 原状态 | 新状态 | 接收者 | 证据/说明 |
|---|---|---|---|---|---|
| 2026-07-10 09:00 | Architect | DRAFT | READY | Codex Backend | 产品基线、契约、范围、验收、Owner/Reviewer 分离均齐备 |
| 2026-07-11 09:00 | Codex Backend | READY | IN_PROGRESS | Codex Backend | 父子路径无冲突，锁登记为 CLAIMED |
| 2026-07-11 11:00 | Codex Backend | IN_PROGRESS | BLOCKED | Claude/Architect | 发现监控指标新增需求，提交 CR-EXAMPLE-001 并停止相关开发 |
| 2026-07-11 14:00 | Architect | BLOCKED | IN_PROGRESS | Codex Backend | CR 已批准，Requirement Source、任务和 AC 已更新 |
| 2026-07-11 17:00 | Codex Backend | IN_PROGRESS | READY_FOR_REVIEW | Codex Reviewer | 构建测试通过，锁改为 HANDED_OFF |
| 2026-07-12 10:00 | Codex Reviewer | READY_FOR_REVIEW | CHANGES_REQUESTED | Codex Backend | EX-DEFECT-01：404 响应缺少契约错误码 |
| 2026-07-12 11:00 | Codex Backend | CHANGES_REQUESTED | IN_FIX | Codex Backend | 重新检查并将锁改为 CLAIMED；Reviewer 未参与修复 |
| 2026-07-12 14:00 | Codex Backend | IN_FIX | READY_FOR_RETEST | Codex Reviewer | 修复与回归通过，锁改为 HANDED_OFF |
| 2026-07-12 16:30 | Codex Reviewer | READY_FOR_RETEST | COMPLETED | 项目归档 | 复审通过、Git 证据一致、锁已 RELEASED |

## 审核结论

- Reviewer：Codex Reviewer
- 结论：首次审核不通过，记录 EX-DEFECT-01 并转 `CHANGES_REQUESTED`
- 审核命令和证据：重跑构建和 5 个测试；指标增量断言通过，响应快照显示错误码缺失

## 缺陷清单

| 缺陷 ID | 等级 | 证据/复现 | 修复要求 | 状态 |
|---|---|---|---|---|
| EX-DEFECT-01 | MEDIUM | 查询未知标签，404 body 缺少 `RACK_NOT_FOUND` | 按批准契约补齐错误码并回归 | CLOSED |

## 缺陷修复记录

| 缺陷 ID | 修复者 | 修改说明 | 回归证据 | 提交 |
|---|---|---|---|---|
| EX-DEFECT-01 | Codex Backend | 使用既有错误响应工厂返回 `RACK_NOT_FOUND` | 5/5 tests passed（含指标断言），Reviewer 独立重跑通过 | `1111111111111111111111111111111111111111` |

## 复审结果

- 最终 Reviewer：Codex Reviewer（未参与开发或修复）
- 复审结论：PASS
- 关闭缺陷及证据：EX-DEFECT-01 已关闭；404 快照与契约一致；构建和测试退出码均为 0

## Change Request

- Change Request ID：CR-EXAMPLE-001
- 发现者：Codex Backend
- 原任务：TASK-EXAMPLE
- 变更原因：批准的验收标准要求记录查询计数，但原技术设计未指定既有指标名称
- 产品范围影响：不改变用户功能；确认查询计数属于产品验收范围
- 技术影响：复用现有 `rack_query_total` 指标，不新增依赖或数据表
- 文件影响：仍限于 `src/backend/Racks/` 和对应测试
- 测试影响：增加一次既有指标增量断言
- 风险：低；指标基数保持固定
- Claude 裁决：APPROVED；保持原产品范围并补充验收标准文字
- Architect 裁决：APPROVED；复用既有指标接口，禁止新增依赖
- 更新后的 Requirement Source：docs/product/PRD.md#rack-label-query-rev2
- 批准状态：APPROVED

## Git 提交与推送

- 提交说明：feat: add rack label query
- 提交哈希：`2222222222222222222222222222222222222222`
- 推送结果：成功推送 `origin/feature/example-rack-label-query`
- 本地哈希：`2222222222222222222222222222222222222222`
- 远端哈希：`2222222222222222222222222222222222222222`

## 已知限制

- 仅支持标签精确匹配；模糊搜索为明确的后续范围。

## 最终完成条件

- [x] 独立 Reviewer 复审通过
- [x] 验收标准全部通过
- [x] 所有缺陷关闭
- [x] 构建和测试通过
- [x] 工作流校验和 `git diff --check` 通过
- [x] 模块锁已释放
- [x] 已提交并推送
- [x] 工作区干净
- [x] 本地与远端哈希一致
- [x] 状态由 Reviewer 转为 `COMPLETED`
