# Change Request CR-0002

## 基本信息

- Change Request ID：CR-0002
- 发现者：Codex Reviewer（TASK-0006 规格审核报告 SC-001、SC-002）
- 原任务：TASK-0006（MVP 项目脚手架）
- 变更原因：
  1. TASK-0006 当前处于 `READY_FOR_REVIEW`，但该状态语义为"首次开发完成，等待独立审核"。当前任务规格文档虽已完成并交审，但脚手架代码尚未实施。Codex 审核 PASS 后只能进入 `COMPLETED`，无法回到实施阶段。需要一次性状态纠正。
  2. 当前 Owner 为 Cursor Frontend，但 AGENTS.md 第 3 节定义的 Cursor Frontend 职责只覆盖 Vue 3 前端，不覆盖 ASP.NET Core Web API、xUnit、.NET solution 和 PowerShell 构建脚本。TASK-0006 要求创建全栈脚手架（前端 + 后端 + 测试 + solution），需要一个能同时处理前后端基础项目创建的合法角色。
- 产品范围影响：无。不修改任何产品功能、用户角色、业务规则或验收标准。
- 技术影响：
  - AGENTS.md 第 3 节需新增 Cursor Developer 角色
  - TASK-0006 状态从 `READY_FOR_REVIEW` 一次性纠正到 `READY`
  - TASK-0006 Owner 从 Cursor Frontend 改为 Cursor Developer
  - docs/architecture/AGENT-WORKFLOW.md 角色引用需同步更新
- 文件影响：
  - AGENTS.md（第 3 节新增 Cursor Developer 角色）
  - docs/architecture/AGENT-WORKFLOW.md（第 2 节角色边界引用同步）
  - tasks/TASK-0006-PROJECT-SCAFFOLD.md（状态、Owner、交接记录）
  - tasks/current-task.md（状态、Owner）
  - tasks/MODULE-LOCKS.md（锁 Owner、状态）
  - tasks/CR-0002-TASK-0006-WORKFLOW-AND-DEVELOPER-ROLE.md（本文件，新建）
- 测试影响：无。本轮不涉及代码。
- 风险：低。
  - 状态纠正为一次性批准，不创建新状态或修改状态机定义。
  - Cursor Developer 是最小通用实施角色，不替代 Codex Backend（其负责业务逻辑、数据模型和安全实现），不替代 Cursor Frontend（其仍在后续前端业务任务中使用）。
  - Reviewer（Codex Reviewer）独立性保持。
- Claude 裁决：批准。
  - 产品范围无变化。
  - 角色调整是实现需要：TASK-0006 是空项目脚手架（不含业务逻辑、EF Core、认证），适合单个通用实施角色完成。
  - Cursor Frontend 保留，在后续前端业务任务（TASK-0008、TASK-0011 等）中继续使用。
  - Codex Backend 保留，在后续后端业务任务（TASK-0007、TASK-0009 等）中继续使用。
- Architect 裁决：批准。
  - Cursor Developer 是最小实施角色，不违反架构基线（TASK-0005）的任何技术裁决。
  - 脚手架不含数据模型、API 契约或业务逻辑，无需 Architect 额外审批。
  - 状态纠正不影响 TASK-0005 及其锁状态。
- 更新后的 Requirement Source：不适用（产品需求不变）。
- 批准状态：APPROVED

## 第一部分：TASK-0006 状态纠正

### 问题

TASK-0006 的任务规格文档编写过程使用了工作流状态机：
```
IDLE → DRAFT → READY → IN_PROGRESS → READY_FOR_REVIEW
```

其中 `IN_PROGRESS` 和 `READY_FOR_REVIEW` 的本意是"规格文档编写中"和"规格文档交审"。但工作流定义中：

- `READY_FOR_REVIEW` 的语义是"首次开发完成，等待独立审核"
- `READY_FOR_REVIEW` 的合法出口只有 `COMPLETED`、`CHANGES_REQUESTED`、`BLOCKED`、`CANCELLED`
- `COMPLETED` 的语义是"Reviewer 已确认全部门禁通过"，之后只能转 `IDLE`

Codex Reviewer 的审核（提交 6a1b4a9）确认：任务规格 NEEDS_CHANGES，但即使修正后 PASS，任务会直接进入 `COMPLETED`，无法回到实施阶段。

**根因：** TASK-0006 是实施任务（项目脚手架），不是纯文档任务。不应将规格文档编写过程映射到完整的 `IN_PROGRESS → READY_FOR_REVIEW → COMPLETED` 周期。规格文档只是实施前的准备，实施本身才是任务的 `IN_PROGRESS`。

### 裁决

1. 当前 `READY_FOR_REVIEW` 在形式上合法，但在语义上错误（任务尚未实施）。
2. Codex Reviewer 已出具 NEEDS_CHANGES（含 SC-001 至 SC-009），按工作流应转为 `CHANGES_REQUESTED`。
3. 本次修正完成后，不按常规路径进入 `READY_FOR_RETEST`（因为那仍会导致 COMPLETED），而是通过本 CR 一次性批准进入 `READY`。
4. `READY` 的语义是"已获准开始但尚未开发"——这正是 TASK-0006 修正后应处的状态。
5. 从 `READY` 开始，Cursor Developer 可以合法进入 `IN_PROGRESS` 并实施脚手架。

### 状态迁移路径

```
当前: READY_FOR_REVIEW (错误——任务未实施)
  ↓ CHANGES_REQUESTED (Codex Reviewer 出具 NEEDS_CHANGES)
CHANGES_REQUESTED
  ↓ IN_FIX (Claude 修复规格文档)
IN_FIX
  ↓ 一次性 CR 批准 → READY (跳过 READY_FOR_RETEST/COMPLETED)
READY (Claude 交 Cursor Developer 实施)
  ↓ IN_PROGRESS (Cursor Developer 认领模块锁并开始实施)
IN_PROGRESS
  ↓ READY_FOR_REVIEW (实施完成后正式交审)
READY_FOR_REVIEW (正确——脚手架代码完成)
  ↓ COMPLETED (Codex Reviewer PASS)
COMPLETED
```

### 约束

- 本次状态纠正为一次性批准，不创建新状态、不修改状态机定义。
- 现有 Codex 规格审核报告（reviews/tasks/TASK-0006-PROJECT-SCAFFOLD-SPEC-REVIEW.md）保留为"实施前规格审查证据"，不得伪装成实施代码审核。
- 正式 `READY_FOR_REVIEW` 只在 Cursor Developer 完成实际脚手架后使用。
- 此次修正不修改产品范围。
- 此次修正不启动代码实施。

## 第二部分：Cursor Developer 角色

### 问题

当前 AGENTS.md 第 3 节定义的 Cursor Frontend 角色职责为：
- Vue 3 前端
- 2D 平面布局
- Grid Plan 适配
- Three.js 局部 3D
- 页面交互
- 前端测试

TASK-0006 要求创建：
- Vue 3 + Vite + TypeScript 前端项目
- ASP.NET Core 8 Web API 后端项目
- xUnit 后端测试项目
- .NET solution 文件
- PowerShell 构建/验证脚本

Cursor Frontend 的权威职责不覆盖后端项目、.NET solution、xUnit 测试项目和后端脚本。需要一个合法角色来完成全栈脚手架创建。

当前项目长期固定分工是：
- Claude + DeepSeek：规划、规格、裁决
- Cursor：编写和修改代码
- Codex：独立审核

### 裁决

新增最小合法角色 **Cursor Developer**：

**Cursor Developer 职责：**
- 按已批准任务规格创建和修改代码
- 可以处理 Vue、TypeScript、ASP.NET Core、.NET、xUnit 和脚本
- 可以执行构建、测试和最小调试
- 不得自行修改产品需求和架构裁决
- 不得自行扩大依赖预算
- 遇到规格缺口必须停止并提交问题
- 不负责独立最终审核
- Reviewer 始终为 Codex Reviewer

**与现有角色的关系：**
- Cursor Frontend：保留，仍负责后续前端业务任务（TASK-0008、TASK-0011 等）中的 Vue 组件开发、页面交互和前端测试
- Codex Backend：保留，仍负责后续后端业务任务（TASK-0007、TASK-0009 等）中的 EF Core、数据模型、业务逻辑和安全实现
- Codex Architect：保留，仍负责架构裁决和 API 契约
- Codex Reviewer：保持独立，审核所有实现

**TASK-0006 的角色分配：**
- Owner：Cursor Developer（从前 Cursor Frontend）
- Reviewer：Codex Reviewer（不变）

**规则：**
1. 只增加完成当前项目开发所需的一个通用实施角色。
2. 不创建复杂角色体系。
3. 不删除 Cursor Frontend 或 Codex Backend。
4. AGENTS.md、AGENT-WORKFLOW.md 和 TASK-0006 中的角色名称必须一致。

## 裁决日期

2026-07-17
