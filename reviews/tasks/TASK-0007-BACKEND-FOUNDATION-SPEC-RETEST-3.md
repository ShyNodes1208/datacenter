# TASK-0007 第三次规格复审报告

## 审核信息

- 审核对象：`tasks/TASK-0007-BACKEND-FOUNDATION.md`
- 待审核提交：`95eea07776c3793375a11141b66cc417bf244fd7`
- 上一轮复审提交：`f517ee3fa62c48989fb43682b9455b601f46e0a1`
- 审核角色：Codex Reviewer
- 审核日期：2026-07-18
- 最终结论：**NEEDS_CHANGES**
- Findings：BLOCKER 1 / MAJOR 0 / MINOR 1 / NOTE 0

## 结论摘要

第三轮修正已关闭精确版本、产品角色、错误响应、Cookie 角色变化及 SQLite/测试隔离问题；但工作流状态迁移仍不合法，且文件预算仍同时保留 16 与 15 两种算法。TASK-0007 暂不允许进入规格批准流程，也不允许进入实现。

## 上一轮 Findings 复审结果

| Finding | 状态 | 复审结论 |
|---|---|---|
| BF-RT2-001 | CLOSED | Sqlite、Design、仓库本地 dotnet-ef 均唯一固定为 8.0.29；Design 使用 `PrivateAssets=all`，命令与 AC 一致。 |
| BF-RT2-002 | CLOSED | 角色已恢复为产品基线规定的四个值，组合角色未被拆分，服务端与 SQLite CHECK 均拒绝未知值。 |
| BF-RT2-003 | CLOSED | API 统一采用架构基线的 `{"error":"..."}`，未再使用 ProblemDetails；认证失败不区分原因。 |
| BF-RT2-004 | OPEN | `DRAFT` 被直接改为 `READY_FOR_RETEST`，不在封闭迁移表中，且交接记录错误归因于 Reviewer。 |
| BF-RT2-005 | CLOSED | 每个认证请求读取 User；不存在、禁用、角色不一致或数据库失败均拒绝 Principal 并清除 Cookie，角色变化要求重新登录。 |
| BF-RT2-006 | OPEN | 逐文件清单为 16 个，但正文仍批准 DTO 合并后为 15 个，预算不是唯一算法。 |
| BF-RT2-007 | CLOSED | 路径创建/打开/WAL 均 fail fast；Fixture 使用唯一 GUID 临时文件、Collection 隔离并清理 db/wal/shm/目录。 |

## Findings

### BF-RT3-001 — BLOCKER

- 文件及位置：`docs/architecture/AGENT-WORKFLOW.md` 第 3.1、3.2 节（第 28–57 行）；`tasks/TASK-0007-BACKEND-FOUNDATION.md` 基本信息及交接记录（第 7、815–816 行）；`tasks/current-task.md` 当前状态及下一步（第 7、41–43 行）
- 问题描述：权威状态机只允许 `DRAFT -> READY/BLOCKED/CANCELLED`；`READY_FOR_RETEST` 只能由 `IN_FIX` 或 `BLOCKED` 进入，并且其合法通过终点为 `COMPLETED`，不能再进入 `READY`。当前记录却把规格阶段的 `DRAFT` 直接改为 `READY_FOR_RETEST`，并在第 815 行将该非法迁移归因于 Codex Reviewer；`current-task.md` 又计划复审通过后从 `READY_FOR_RETEST` 进入 `READY`。这两步均不在封闭迁移表中。
- 风险：Reviewer 无法在不违反唯一权威工作流的情况下批准规格或把任务交给实施 Owner；错误归因还会破坏状态审计真实性。脚本 20/20 PASS 不能证明任务级迁移合法。
- 最小修复方向：删除对 Reviewer 未执行状态迁移的错误归因，并通过权威工作流允许的路径恢复规格批准流程。若现有封闭状态机无法表达多轮规格审核，应先取得明确批准的 Change Request（可参照 CR-0002 的一次性工作流裁决），再同步修正 TASK、current-task、锁和交接记录；不得继续以 `READY_FOR_RETEST -> READY` 绕过状态机。

### BF-RT3-002 — MINOR

- 文件及位置：`tasks/TASK-0007-BACKEND-FOUNDATION.md` 文件预算（第 365–386、404–408 行）
- 问题描述：逐文件清单明确列出 16 个新增文件，汇总上限也是 16 个，但第 386、406 行仍允许将两个 DTO 合并后按 15 个计算。规格因此同时保留 16 与 15 两种批准算法，不是唯一逐文件预算。
- 风险：实施者可以偏离逐文件清单而无需 Change Request，Reviewer 无法对“批准范围”采用唯一、可重复的计数标准，也可能促使为压缩数量合并职责。
- 最小修复方向：选择并保留唯一逐文件清单与唯一汇总数字。若批准当前表格，应固定新增文件上限为 16 并删除 DTO 合并为 15 的替代分支；任何清单变更按既定 Change Request 规则处理。

## 专项复审结论

- 精确版本：通过。三项均为 8.0.29，仓库本地 Tool Manifest、restore/run 命令和禁止全局工具均明确。
- 产品角色：通过。四个角色与产品基线逐字一致，组合角色未拆分，无动态 RBAC。
- 错误契约：通过。统一为架构基线 error JSON，无 ProblemDetails 或第二套 DTO。
- Cookie 角色变化：通过。数据库状态和角色为最终依据，旧角色 Cookie 不自动刷新并要求重新登录。
- 文件预算：未通过。16/15 双算法仍存在。
- SQLite 路径：通过。可配置开发路径、网络共享拒绝、目录/文件/WAL 失败启动均明确。
- 测试隔离：通过。Fixture 路径唯一、局部并行控制、连接关闭和临时文件清理均可验证。
- AC：AC-BF-01 至 AC-BF-35 编号连续且技术行为总体可执行；但状态/交接门禁受 BF-RT3-001 阻塞，文件预算证据受 BF-RT3-002 影响。
- 状态与锁：三项锁为 `HANDED_OFF`、Receiver 为 Codex Reviewer、Released At 为空且无实施锁；但 `READY_FOR_RETEST` 的来源及计划终点均不合法，因此整体未通过。

## Git 与验证证据

- 当前分支：`feature/task-0007-backend-foundation`
- HEAD：`95eea07776c3793375a11141b66cc417bf244fd7`
- 远端任务分支：与 HEAD 一致
- 修正范围：仅 `tasks/TASK-0007-BACKEND-FOUNDATION.md`、`tasks/current-task.md`、`tasks/MODULE-LOCKS.md`
- 代码、测试、脚本、csproj、配置、依赖、Tool Manifest、Migration、数据库变化：无
- 实施锁与实现：无
- `pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`：PASS 20 / FAIL 0 / TOTAL 20 / 退出码 0
- `git diff --check f517ee3fa62c48989fb43682b9455b601f46e0a1..95eea07776c3793375a11141b66cc417bf244fd7`：PASS / 退出码 0
- `git diff --check`（创建本报告前）：PASS / 退出码 0
- 审核开始时工作区：干净

## 最终判定

- 是否允许进入规格批准流程：否
- 是否允许进入实现：否
- 允许的后续动作：仅修正上述工作流审计/迁移与文件预算规格问题，完成合法交接后再次独立复审。
