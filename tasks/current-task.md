# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

## 当前任务

- Task ID：TASK-0002
- Task Name：修复 Agent 工作规范和任务流程缺陷
- Status：READY_FOR_REVIEW
- Owner：Codex Architect
- Reviewer：Codex Reviewer
- Branch：chore/agent-workspaces
- Task File：tasks/TASK-0002-FIX-AGENT-WORKFLOW.md
- Requirement Source：reviews/architecture/AGENT-WORKFLOW-REVIEW.md
- Review Source：reviews/architecture/AGENT-WORKFLOW-REVIEW.md
- Product Baseline：用户批准的 TASK-0002 完整任务说明
- Architecture Reference：docs/architecture/AGENT-WORKFLOW.md
- Module Lock：tasks/MODULE-LOCKS.md 中 TASK-0002 的 HANDED_OFF 记录

## 当前允许修改

- AGENTS.md
- agents/claude-product-manager.md
- agents/codex-architect.md
- agents/codex-backend.md
- agents/codex-reviewer.md
- agents/cursor-frontend.md
- docs/architecture/AGENT-WORKFLOW.md
- tasks/TASK-TEMPLATE.md
- tasks/current-task.md
- tasks/MODULE-LOCKS.md
- tasks/TASK-EXAMPLE.md
- scripts/validate-agent-workflow.ps1

## 当前禁止修改

- reviews/architecture/AGENT-WORKFLOW-REVIEW.md
- tasks/TASK-0001-REVIEW-AGENT-WORKFLOW.md
- tasks/TASK-0002-FIX-AGENT-WORKFLOW.md
- README.md
- src/
- tests/
- docs/product/
- docs/contracts/
- docs/ui/

## 当前提交信息

- 提交说明：docs: fix agent workflow review findings
- 提交基线：e75746d2b5dd8e50f59ba0d9129a9170c7e60ec1
- 交付提交哈希：以推送后 `git rev-parse HEAD` 和最终报告为准（提交内容无法预先包含自身哈希）
- 推送目标：origin/chore/agent-workspaces

## 校验结果

- `git diff --check`：PASS（退出码 0）
- Windows PowerShell 5.1 校验：PASS（10/10，退出码 0）
- PowerShell 7 校验：N/A：系统未安装 `pwsh`
- 禁止文件变更检查：PASS；`git status` 与 `git diff --name-only` 仅列出允许范围文件

## 交接说明

Codex Architect 已完成 AWF-001 至 AWF-007 的规范修复并交给 Codex Reviewer。Reviewer 应对 `origin/main...HEAD` 做全量独立复审，运行校验脚本，检查状态机闭合性、父子路径锁冲突、Change Request 门禁、模板字段和 Git 证据。Codex Architect 不将本任务标记为 `COMPLETED`。
