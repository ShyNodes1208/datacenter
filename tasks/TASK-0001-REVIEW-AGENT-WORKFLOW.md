# TASK-0001：审核 Agent 工作规范

## 基本信息

- Task ID：TASK-0001
- Task Name：审核 Agent 工作规范和任务流程
- Status：READY
- Owner：Codex Reviewer
- Reviewer：hangyu
- Branch：chore/agent-workspaces
- Requirement Source：AGENTS.md

## 任务目标

独立审核本分支新增的 Agent 角色说明和任务流程，确认这些规则足以支持后续多 Agent 协同开发。

本任务只进行审核，不修改被审核文件。

## 前置条件

- 当前分支必须是 chore/agent-workspaces
- 工作区必须干净
- 本地分支必须已经同步 GitHub
- 必须阅读根目录 AGENTS.md
- 必须阅读 agents/ 下全部角色说明
- 必须阅读 tasks/TASK-TEMPLATE.md
- 必须阅读 tasks/current-task.md

## 允许修改

- reviews/architecture/AGENT-WORKFLOW-REVIEW.md

## 禁止修改

- AGENTS.md
- agents/
- tasks/TASK-TEMPLATE.md
- tasks/current-task.md
- src/
- tests/
- docs/product/
- docs/architecture/

## 审核范围

必须检查以下内容：

1. 各 Agent 的职责是否清晰且没有明显冲突。
2. Claude、Codex、Cursor 的工作边界是否合理。
3. Codex Architect、Codex Backend、Codex Reviewer 是否保持职责隔离。
4. Reviewer 是否具备足够的独立性。
5. 是否符合 Windows、PowerShell、无 Linux、无 WSL 的固定约束。
6. 是否明确规定任务开始、开发、审核、修复、复审和完成流程。
7. 是否明确规定本地提交和 GitHub 推送要求。
8. TASK-TEMPLATE.md 是否足以约束后续实际开发任务。
9. current-task.md 的 IDLE 和 READY 机制是否清晰。
10. 是否存在规则缺失、规则矛盾、表述含糊或无法执行的问题。
11. 是否能够防止多个 Agent 同时修改同一模块。
12. 是否能够防止开发 Agent 自行扩大需求范围。

## 必须执行的检查

```powershell
git branch --show-current
git status
git diff main...HEAD --stat
git diff main...HEAD
Get-ChildItem agents -File
Get-ChildItem tasks -File
```

## 审核报告要求

审核报告必须写入：

reviews/architecture/AGENT-WORKFLOW-REVIEW.md

报告必须包含：

- 审核结论：PASS 或 FAIL
- 审核范围
- 已执行的检查命令
- 正面确认项
- 缺陷清单
- 风险清单
- 最终建议

每个缺陷必须包含：

- 缺陷编号
- 严重等级
- 涉及文件
- 证据或具体位置
- 问题说明
- 可能影响
- 修复要求

如果没有发现缺陷，也必须明确写出：未发现阻止合并的问题。

## 验收标准

- [ ] AC-01：审核了所有新增 Agent 角色文件。
- [ ] AC-02：审核了 TASK-TEMPLATE.md 和 current-task.md。
- [ ] AC-03：报告包含明确的 PASS 或 FAIL。
- [ ] AC-04：每个问题均具有编号、等级、证据和修复要求。
- [ ] AC-05：Reviewer 没有修改任何被审核文件。
- [ ] AC-06：审核报告已经提交并推送 GitHub。

## Git 要求

- 只允许提交审核报告。
- 提交信息使用：review: audit agent roles and task workflow
- 必须推送 chore/agent-workspaces 分支。
- 完成后工作区必须干净。
