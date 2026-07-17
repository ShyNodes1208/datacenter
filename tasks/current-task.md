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
- Module Lock：9 项实施路径锁全部 HANDED_OFF；CHANGES_REQUESTED 保持 HANDED_OFF；修复时由 Cursor Developer 重新认领为 CLAIMED 后进入 IN_FIX

## 第三次实现复审结果

- 复审提交：2edbc2e（retest）
- 复审报告：reviews/tasks/TASK-0006-PROJECT-SCAFFOLD-IMPLEMENTATION-RETEST-2.md
- 复审结论：NEEDS_CHANGES
- AC 结果：19 PASS / 1 FAIL（AC-SC-13 FAIL）

### 复审缺陷摘要

| Finding | 等级 | 问题 | 处置 |
|---------|------|------|------|
| IR-001 | MAJOR | AC-SC-18 lock metadata | **CLOSED**（确认） |
| IR-002 | MAJOR | AC-SC-20 directory check | **CLOSED**（确认） |
| IR-003/RT-001 | MAJOR | grep/Git error propagation | **CLOSED**（确认） |
| IR-004/RT-002 | MINOR | launchSettings BOM | **CLOSED**（确认） |
| RT-003 | MAJOR | AC-SC-13 recursive grep hits binary DLL strings | **SPEC_CLARIFIED**（AC-SC-13 改为 XML 检查；CR-0004 批准；verify-project.ps1 实现无需修改） |

## 当前目标

RT-003 仅涉及规格 AC 命令修正（CR-0004）；verify-project.ps1 实现已正确（--exclude-dir=bin --exclude-dir=obj）。Cursor Developer 无需修改任何代码。

规格修正完成后直接进入 READY_FOR_RETEST，由 Codex Reviewer 执行第四次（终审）复审。

## 上一任务摘要

### TASK-0005（MVP 技术架构与开发基线）

- 最终状态：COMPLETED
- 审核结论：PASS

### TASK-0004（MVP 产品基线）

- 最终状态：COMPLETED
- 最终复审：PASS

## 当前约束

- 不得改为 COMPLETED；不得释放锁；不得开始 TASK-0007；不得合并 main
- 规格修正范围限于 AC-SC-13 和 CR-0004；不改变其他 AC 或依赖预算
- verify-project.ps1 无需修改
