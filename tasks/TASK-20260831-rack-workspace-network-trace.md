# TASK-20260831-rack-workspace-network-trace

- Status: `COMPLETED`
- Requirement Source: 用户 2026-08-31 确认的“机柜优先工作区 + 双模式端口物理线缆追踪”。
- Product/Technical Orchestrator: Codex + Terra
- Owner: Cursor Developer
- Independent Reviewer: Codex Reviewer
- Planned branch: `feature/TASK-20260831-rack-workspace-network-trace`
- Design: `docs/superpowers/specs/2026-08-31-rack-workspace-network-trace-design.md`
- Plan: `docs/superpowers/plans/2026-08-31-rack-workspace-network-trace.md`

## Approved Product Baseline

1. 单机柜工作区是设备查询与管理的默认入口；全景线路图仅显式进入。
2. 保留设备详情页的全部端口表，并让已连接端口进入线路追踪。
3. 支持“已知目标的一条最短物理路径”和“从端口发现可达终点”两种模式。
4. 发现模式默认 4 跳、允许 1–10 跳、最多渲染 100 个终点，并显示总数/截断信息。

## Allowed Scope

- `NetworkPathController.cs` 与新的后端路径测试。
- 新的前端追踪 composable、页面和测试；路由与设备详情端口入口。
- TopologyView 的机柜优先入口与测试。

## Prohibited Scope

- 数据库、迁移、线缆/端口数据模型和新依赖。
- 实时流量、VLAN、路由协议、自动发现、备用路径枚举。
- 重写现有全景拓扑渲染、CableLayer 或端口维护。

## Role Boundaries

| Role | Responsibility | Must not do |
|---|---|---|
| Codex + Terra | 维护范围、API 契约、验收标准、状态和最终复核 | 编写业务代码或测试实现 |
| Cursor Developer | 认领批准模块、TDD 实现、运行测试、提交和交接 | 改变范围/API/数据模型或自行标记完成 |
| Codex Reviewer | 独立代码、测试、契约和范围审核；复审修复 | 修改被审核业务代码 |

## READY Transition

2026-08-31，由 Codex + Terra 发起 `DRAFT -> READY`：用户已明确确认计划并交给 Cursor Developer；产品基线、范围、验收、命令、架构引用与角色独立性完整。检查 `tasks/MODULE-LOCKS.md`：允许路径无 `CLAIMED`/`HANDED_OFF` 父子冲突。下一状态仅能由 Cursor Developer 成功认领模块后转为 `IN_PROGRESS`。

## Review Finding

- 2026-08-31，Codex Reviewer：`READY_FOR_REVIEW -> CHANGES_REQUESTED`。
- RV-001（MEDIUM）：已知目标的搜索达到十跳上限时，必须返回“达到十跳追踪上限”的可见原因；当前返回普通“未找到已登记的连接路径”。
- 修复范围：仅 `NetworkPathController.cs` 的上限状态和 `NetworkPathIntegrationTests.cs` 的十一跳回归测试；不得修改 API 契约、数据库、依赖或其他功能。
- 证据：`.superpowers/sdd/2026-08-31-rack-workspace-network-trace/task-1-review.md`。

## Task 1 Review Result

- 2026-08-31：Cursor Developer 以 `33a2254` 完成 Task 1；Codex Reviewer 提出 RV-001 后，Cursor Developer 以 `d9bf037` 修复。
- 独立复审 PASS：`.superpowers/sdd/2026-08-31-rack-workspace-network-trace/task-1-re-review.md`。
- 任务继续 `IN_PROGRESS`，仅可开始无冲突的 Task 2 前端路径；Task 1 两条锁保留 `HANDED_OFF` 直至最终审核释放。

## Task 2 Review Finding and Technical Ruling

- 2026-08-31，Codex Reviewer：`IN_PROGRESS -> CHANGES_REQUESTED`，RV-002（MEDIUM）：追踪页必须在成功、无路径和错误状态都固定显示来源设备及端口。
- 技术裁决：不新增 API、数据模型或依赖。`ServerDetailView` 路由携带 `sourcePortId` 与 `sourceServerId`；`NetworkTraceView` 使用既有设备详情和设备端口列表接口校验二者归属后显示来源。参数不匹配时显示错误且不追踪。
- 修复范围：仅 Task 2 已认领的 `NetworkTraceView.vue`、`ServerDetailView.vue`、两项对应测试及必要的既有路由类型；不得修改后端或 Task 1 锁。
- 复审：同一独立 Codex Reviewer 仅验证 RV-002。

## Task 2 Review Result

- Task 2 实现与返修提交：`08e5cf5`、`1eae615`、`c5cb9cf`。
- 独立 Reviewer 关闭 RV-002 与 RV-003 并 PASS；证据：`.superpowers/sdd/2026-08-31-rack-workspace-network-trace/task-2-rv003-review.md`。
- 开始无冲突的 Task 3；Task 1/2 锁均保留 `HANDED_OFF` 至最终审核释放。

## Task 3 and Final Review Result

- Task 3 实现提交：`7957b4e`。机房图选择机柜后可进入该机柜工作区；双击机柜同样进入工作区；全景线路图保留为显式入口。
- Task 3 独立审核 PASS：`.superpowers/sdd/2026-08-31-rack-workspace-network-trace/task-3-review.md`。
- 全任务独立终审 PASS：`.superpowers/sdd/2026-08-31-rack-workspace-network-trace/final-review.md`；未发现范围、契约或实现缺陷。
- 本地复验：后端 232/232 通过；端口追踪前端 15/15 通过；机柜入口定向测试 1/1 通过；typecheck、build 与 `git diff --check` 通过。全量 Vitest 仅有既有浏览器 harness 用例因测试环境无法连接 `localhost:5173` 失败，非本任务回归。

## Completion Gate

- 已推送 `feature/TASK-20260831-rack-workspace-network-trace`；本地与远端均为 `7686de4b894057031e9af48bd8c18bbc0634980c`。
- 独立 Reviewer 已通过终审，十条模块锁已由 `HANDED_OFF` 释放为 `RELEASED`，任务完成。
- 后续卡顿修复：选中线路拖拽期间暂停动画、滤镜和 transition；提交 `7686de4`，独立复审 PASS。
