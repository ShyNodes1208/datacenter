# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

## 当前任务

- Task ID：TASK-0006
- Task Name：MVP 项目脚手架
- Status：CHANGES_REQUESTED
- Owner：Cursor Developer（AGENTS.md 第 3 节；CR-0002 批准的全栈实施角色）
- Reviewer：Codex Reviewer
- Branch：chore/task-0006-project-scaffold
- Task File：tasks/TASK-0006-PROJECT-SCAFFOLD.md
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：docs/product/MVP-PRODUCT-BASELINE.md（TASK-0004，COMPLETED，PASS）
- Architecture Reference：docs/architecture/MVP-ARCHITECTURE-BASELINE.md（TASK-0005，COMPLETED，PASS）
- Module Lock：Cursor Developer 9 项实施路径锁已 HANDED_OFF；CHANGES_REQUESTED 保持 HANDED_OFF；修复时由 Cursor Developer 重新认领为 CLAIMED 后进入 IN_FIX

## 实现审核结果

- 审核提交：d6d8455（review: assess task-0006 project scaffold implementation）
- 审核报告：reviews/tasks/TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-REVIEW.md
- 审核结论：NEEDS_CHANGES
- 18 项 PASS / 2 项 FAIL（AC-SC-18、AC-SC-20）
- 4 项 finding：MAJOR 3（IR-001、IR-002、IR-003）+ MINOR 1（IR-004）

### 缺陷摘要

| Finding | 问题 | 规格修正 | 实现修复 |
|---------|------|---------|---------|
| IR-001 | AC-SC-18 grep 命中 package-lock.json optional peer metadata | AC-SC-18 改为三层验证（CR-0003） | verify-project.ps1 实现 A/B/C 层命令 |
| IR-002 | AC-SC-20 `test -d node_modules/dist` 与验证序列冲突 | AC-SC-20 改为 `git ls-files` 检查（CR-0003） | verify-project.ps1 实现 Git 跟踪检查 |
| IR-003 | verify-project.ps1 门禁不完整但报告 ALL CHECKS PASSED | AC-SC-17 扩展为 20 项门禁清单（CR-0003） | verify-project.ps1 全面重构 |
| IR-004 | launchSettings.json 含两处 weatherforecast | 步骤 11b 新增清理命令 | 删除两处 launchUrl |

## 当前目标

Cursor Developer 按修复矩阵修复 IR-001 至 IR-004：

1. 更新 `scripts/verify-project.ps1`：补齐 20 项门禁（`npm ci`、AC-SC-18 A/B/C、依赖白名单、模板残留、launchSettings.json、Git 跟踪、`git diff --check` 等）
2. 修复 `launchSettings.json`：删除两处 `weatherforecast` launchUrl
3. 重新运行 `verify-project.ps1` 确保 20 项全部 PASS
4. 修复完成后重新进入 READY_FOR_RETEST，由 Codex Reviewer 复审

## 上一任务摘要

### TASK-0005（MVP 技术架构与开发基线）

- 最终状态：COMPLETED
- 审核结论：PASS

### TASK-0004（MVP 产品基线）

- 最终状态：COMPLETED
- 最终复审：PASS

## 当前约束

- Owner 不得继续修改实现；等待规格修正完成后进入 IN_FIX
- 不得改为 COMPLETED；不得释放锁；不得开始 TASK-0007；不得合并 main
- 规格修正不修改实现代码；verify-project.ps1 和 launchSettings.json 由 Cursor Developer 在 IN_FIX 中修改
