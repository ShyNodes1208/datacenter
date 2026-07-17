# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

## 当前任务

- Task ID：TASK-0006
- Task Name：MVP 项目脚手架
- Status：READY_FOR_REVIEW
- Owner：Cursor Frontend（AGENTS.md 第 3 节；TASK-0005 第 22 节批准的前端主导脚手架任务）
- Reviewer：Codex Reviewer
- Branch：chore/task-0006-project-scaffold
- Task File：tasks/TASK-0006-PROJECT-SCAFFOLD.md
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：TASK-0006 三条模块锁已 HANDED_OFF；任务规格交 Codex Reviewer 独立审核

## 当前目标

产出：

- tasks/TASK-0006-PROJECT-SCAFFOLD.md

该任务规格定义 MVP 项目脚手架的最小范围、依赖预算、验收标准和防过度开发约束。后续由 Cursor Frontend 实施。

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

- 本轮只创建任务规格和工作流记录
- 不创建项目脚手架
- 不安装依赖
- 不生成 package.json、csproj、sln、代码、数据库或 Migration
- 不启动 Cursor 开发
- 不修改产品基线或架构裁决
- 必须遵守防过度规划和防过度开发门禁
