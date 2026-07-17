# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

## 当前任务

- Task ID：TASK-0006
- Task Name：MVP 项目脚手架
- Status：READY_FOR_REVIEW
- Owner：Cursor Developer（AGENTS.md 第 3 节；CR-0002 批准的全栈实施角色）
- Reviewer：Codex Reviewer
- Branch：chore/task-0006-project-scaffold
- Task File：tasks/TASK-0006-PROJECT-SCAFFOLD.md
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：Cursor Developer 9 项实施路径锁已 HANDED_OFF（未释放）；等待 Codex Reviewer 只读审核实际脚手架

## 技术澄清（已解决）

- 裁决：保留顶级语句 + `public partial class Program { }`；测试引用 `typeof(global::Program)`
- 实施已按裁决修复并验证通过

## 当前目标

脚手架实施完成，已交 Codex Reviewer 审核。产出：

- src/frontend/（Vue 3 + Vite + TypeScript）
- src/backend/Datacenter.Api/（ASP.NET Core 8 Web API）
- tests/backend/Datacenter.Api.Tests/（xUnit，`typeof(global::Program)`）
- Datacenter.sln（仅两个 .NET 项目）
- scripts/verify-project.ps1
- README.md Development 节

## 交审摘要

- `pwsh -NoLogo -NoProfile -File ./scripts/verify-project.ps1` 退出码 0
- 前端 typecheck / 1 test / build 通过
- 后端 restore / build（0 errors, 0 warnings）/ 1 test 通过
- 工作流校验 20/20 PASS
- `git diff --check` PASS
- 无 TASK-0007 / 业务代码 / EF Core / 认证 / Router / Pinia / Axios

## 上一任务摘要

### TASK-0005（MVP 技术架构与开发基线）

- 最终状态：COMPLETED
- 审核结论：PASS

### TASK-0004（MVP 产品基线）

- 最终状态：COMPLETED
- 最终复审：PASS

## 当前约束

- Owner 不得继续修改；等待独立 Reviewer
- 不得改为 COMPLETED；不得释放锁；不得开始 TASK-0007；不得合并 main
