# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

## 当前任务

- Task ID：TASK-0006
- Task Name：MVP 项目脚手架
- Status：IN_PROGRESS
- Owner：Cursor Developer（AGENTS.md 第 3 节；CR-0002 批准的全栈实施角色）
- Reviewer：Codex Reviewer
- Branch：chore/task-0006-project-scaffold
- Task File：tasks/TASK-0006-PROJECT-SCAFFOLD.md
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：Cursor Developer 持有 9 项实施路径锁（CLAIMED）；IN_PROGRESS，阻塞已解除

## 技术澄清（已解决）

- 原冲突：TASK-0006 步骤 12 生成全局 `Program`（顶级语句），步骤 17 错误引用 `typeof(Datacenter.Api.Program)`，.NET 8 顶级语句 + `public partial class Program { }` 编译后 Program 位于全局命名空间（`FullName=Program; Namespace=''`），CS0234 编译错误
- 裁决：保留顶级语句 + `public partial class Program { }`；测试引用统一改为 `typeof(global::Program)`
- 影响：仅修正规格中的类型引用措辞；不改变脚手架范围、架构、依赖或验收目标
- 日期：2026-07-17

## 当前目标

产出（部分已落地，阻塞解除后继续完成验证与交审）：

- src/frontend/（Vue 3 + Vite + TypeScript 前端项目）— 已创建并本地通过 typecheck/test/build
- src/backend/Datacenter.Api/（ASP.NET Core 8 Web API）— 已创建并清理模板；Api 单独 build 通过
- tests/backend/Datacenter.Api.Tests/ — 已创建；测试代码需按修正后规格更新 `typeof(global::Program)` 后重新验证
- Datacenter.sln — 已创建，含两个 .NET 项目
- scripts/verify-project.ps1 — 未创建
- README.md — 未追加 Development 节

Cursor Developer 可从现有未提交现场继续；不要求重新生成已完成的脚手架。

## 上一任务摘要

### TASK-0005（MVP 技术架构与开发基线）

- 最终状态：COMPLETED
- 审核结论：PASS

### TASK-0004（MVP 产品基线）

- 最终状态：COMPLETED
- 最终复审：PASS

## 当前约束

- 不修改产品基线或架构裁决
- 不自行修改 TASK-0006 规格以绕过冲突
- 不开始 TASK-0007
- 模块锁保持 CLAIMED 直至任务 COMPLETED/CANCELLED 或书面批准释放
