# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

## 当前任务

- Task ID：TASK-0006
- Task Name：MVP 项目脚手架
- Status：READY
- Owner：Cursor Developer（AGENTS.md 第 3 节；CR-0002 批准的全栈实施角色）
- Reviewer：Codex Reviewer
- Branch：chore/task-0006-project-scaffold
- Task File：tasks/TASK-0006-PROJECT-SCAFFOLD.md
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：TASK-0006 三条规格文档锁已 RELEASED；实施路径锁（src/、tests/、scripts/、.gitignore、README.md）待 Cursor Developer 认领

## 当前目标

产出：

- src/frontend/（Vue 3 + Vite + TypeScript 前端项目）
- src/backend/Datacenter.Api/（ASP.NET Core 8 Web API 后端项目）
- tests/backend/Datacenter.Api.Tests/（xUnit 后端测试项目）
- Datacenter.sln（解决方案文件）
- scripts/verify-project.ps1（统一验证脚本）
- README.md（开发命令更新）

任务规格已通过实施前 Codex 审查（提交 6a1b4a9）并完成全部 9 项 finding 修正。当前状态 READY 表示可以交 Cursor Developer 实施，但尚未开始编码。

## 上一任务摘要

### TASK-0005（MVP 技术架构与开发基线）

- 架构基线文件：docs/architecture/MVP-ARCHITECTURE-BASELINE.md
- 最终状态：COMPLETED
- 审核结论：PASS（四轮审核：初次 NEEDS_CHANGES → 复审 NEEDS_CHANGES → 第二次复审 NEEDS_CHANGES → 最终复审 PASS）
- 最终复审报告：reviews/architecture/MVP-ARCHITECTURE-BASELINE-RETEST-3-TASK-0005.md
- 最终复审提交：030098ad42fe4129739fbb915a49a605683ea8d7
- 架构裁决：单体应用、SQLite、Controllers、Cookie Auth + PasswordHasher + Antiforgery、HTML/CSS 二维视图
- 后续任务拆分：TASK-0006 至 TASK-0016（11 个独立任务）
- 关闭日期：2026-07-17

### TASK-0004（MVP 产品基线）

- 最终状态：COMPLETED
- 最终复审：PASS

## 当前约束

- 任务规格已完成并通过实施前审查
- Cursor Developer 可开始实施
- 不修改产品基线或架构裁决
- 必须遵守防过度规划和防过度开发门禁
- 实施前规格审查报告：reviews/tasks/TASK-0006-PROJECT-SCAFFOLD-SPEC-REVIEW.md
- 工作流纠正和角色批准：tasks/CR-0002-TASK-0006-WORKFLOW-AND-DEVELOPER-ROLE.md
