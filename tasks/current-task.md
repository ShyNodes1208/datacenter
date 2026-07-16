# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

## 当前任务

- Task ID：TASK-0002
- Task Name：修复 Agent 工作规范和任务流程缺陷
- Status：READY_FOR_RETEST
- Owner：Codex Architect
- Reviewer：Codex Reviewer
- Branch：chore/agent-workspaces
- Task File：tasks/TASK-0002-FIX-AGENT-WORKFLOW.md
- Requirement Source：reviews/architecture/AGENT-WORKFLOW-REVIEW.md
- Review Source：reviews/architecture/AGENT-WORKFLOW-REVIEW-TASK-0002.md
- Product Baseline：用户批准的 TASK-0002 完整任务说明
- Architecture Reference：docs/architecture/AGENT-WORKFLOW.md
- Module Lock：tasks/MODULE-LOCKS.md 中 TASK-0002 的 HANDED_OFF 待复审记录

## 当前允许修改

- tasks/TASK-EXAMPLE.md
- tasks/current-task.md
- tasks/MODULE-LOCKS.md

## 当前禁止修改

- reviews/
- AGENTS.md
- agents/
- docs/architecture/AGENT-WORKFLOW.md
- tasks/TASK-TEMPLATE.md
- scripts/validate-agent-workflow.ps1
- tasks/TASK-0002-FIX-AGENT-WORKFLOW.md
- tasks/TASK-0001-REVIEW-AGENT-WORKFLOW.md
- README.md
- src/
- tests/
- docs/product/
- docs/contracts/
- docs/ui/

## 当前提交信息

- 提交说明：docs: align task example change request evidence
- 提交基线：0f63dd1bfe5703989a70a8451e2b6fa30cc6d4f4
- 交付提交哈希：以推送后 `git rev-parse HEAD` 和最终报告为准（提交内容无法预先包含自身哈希）
- 推送目标：origin/chore/agent-workspaces

## 校验结果

- `git diff --check`：PASS（本轮修复，退出码 0）
- Windows PowerShell 5.1 校验：PASS（本轮修复 10/10，`$LASTEXITCODE` 为 0）
- PowerShell 7 校验：N/A：系统未安装 `pwsh`
- 禁止文件变更检查：PASS；本轮仅修改 tasks/TASK-EXAMPLE.md、tasks/current-task.md、tasks/MODULE-LOCKS.md

## 交接说明

Codex Architect 已完成 AWF-001 至 AWF-007 的规范修复并交给 Codex Reviewer。Reviewer 应对 `origin/main...HEAD` 做全量独立复审，运行校验脚本，检查状态机闭合性、父子路径锁冲突、Change Request 门禁、模板字段和 Git 证据。Codex Architect 不将本任务标记为 `COMPLETED`。

本轮仅修复 T2-AWF-001；请 Reviewer 针对示例的 Requirement Source、查询计数功能、AC-04、测试证据和 Change Request 前后一致性执行复审。

## T2-AWF-001 修复交接记录

| 时间 | 发起者 | 原状态 | 新状态 | 证据/说明 |
|---|---|---|---|---|
| 2026-07-16 | Codex Reviewer | READY_FOR_REVIEW | CHANGES_REQUESTED | `reviews/architecture/AGENT-WORKFLOW-REVIEW-TASK-0002.md` 结论 FAIL，仅记录 T2-AWF-001 |
| 2026-07-16 | Codex Architect | CHANGES_REQUESTED | IN_FIX | 修复范围仅限三个允许文件；TASK-0002 模块锁重新认领为 CLAIMED |
| 2026-07-16 | Codex Architect | IN_FIX | READY_FOR_RETEST | 已对齐示例的 Requirement Source、查询计数功能、AC-04、测试证据与交接记录；锁恢复为 HANDED_OFF |
