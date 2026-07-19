# Change Request CR-0006

## 基本信息

- Change Request ID：CR-0006
- 标题：TASK-0007 验证门禁适用范围修正
- 状态：等待独立 Reviewer 对 CR6-RV-001 纠正结果复审
- 提出和纠正角色：Codex Architect
- 关联任务：TASK-0007 — 后端 SQLite 基础与最小认证骨架
- 原记录 Blocker：`BLOCKED_CHANGE_REQUEST_REQUIRED`
- 原 BLOCKED 提交：`675dc43792953ec4d57536f2a7ded02381173c5a`
- 原 CR 提交：`f516d2fc34826eb6d2509930a9a4c2988c67fbac`
- 审核报告：`reviews/tasks/CR-0006-TASK-0007-VALIDATION-GATE-SCOPE-REVIEW.md`
- 审核提交：`08e73fbf18f2532b4762e7d2ead31ab1235f40b5`
- Reviewer：Codex Reviewer
- 审核结论：NEEDS_CHANGES；BLOCKER 0 / MAJOR 1 / MINOR 0 / NOTE 0
- Finding：`CR6-RV-001`
- 批准状态：REJECTED（原始前提无效；本 CR 新增验证门禁不得实施）

## 原提出原因（历史保留）

CR-0006 原声称 TASK-0007 已有提交前规则要求执行不存在的 `scripts/build.ps1` 和 `scripts/test.ps1`，并曾把 TASK-0006 专用的 `scripts/verify-project.ps1` 作为候选替代。基于这一前提，原 CR 提交新增了一组 TASK-0007 验证门禁。

以上内容仅作为原 CR 历史记录，不再作为当前有效事实或裁决。

## CR6-RV-001 与 Git 历史证据

独立 Reviewer 判定原前提无法从批准规格历史复现，结论准确：

1. `675dc437^` 中的 `tasks/TASK-0007-BACKEND-FOUNDATION.md` 和 `tasks/current-task.md` 均未要求执行 `scripts/build.ps1` 或 `scripts/test.ps1`。
2. `git log --all -S"scripts/build.ps1"` 与 `-S"scripts/test.ps1"` 表明两个路径首次进入 TASK/current-task 正是阻塞提交 `675dc437`，后续仅由 CR 提交 `f516d2f` 改写。
3. 两个脚本当前不存在且 Git 历史中从未作为文件存在，但“不存在”不能证明它们曾是 TASK-0007 已批准规格要求。
4. `scripts/verify-project.ps1` 是 TASK-0006 专用脚本，也从未是 TASK-0007 已批准验证入口。

真实来源是仓库外实施提示词。Codex Backend 因该提示词增加的要求停止提交，随后 `675dc437` 错误地将其登记为既有任务规格缺口，CR-0006 又建立在该错误阻塞前提上，形成循环审计依据。

## Architect 纠正裁决

- 接受并修正 `CR6-RV-001`，不得补造原规则证据。
- CR-0006 批准状态从原 `APPROVED` 纠正为权威流程已有的 `REJECTED`。
- 不再通过新增验证门禁解除阻塞；原 CR 新增的七项门禁及禁止规则不生效。
- TASK-0007 恢复到 `675dc437^` 已批准的构建、测试和验收基线，同时保留 CR-0005 已批准的 `Microsoft.AspNetCore.Mvc.Testing 8.0.29`。
- `scripts/build.ps1`、`scripts/test.ps1` 从来不是 TASK-0007 已批准要求。
- `scripts/verify-project.ps1` 属于 TASK-0006，不是 TASK-0007 验证入口。
- 不新增脚本、验证规则、文件预算、依赖、AC 或 API。
- 不删除或改写 Git 提交历史和 Reviewer 报告；通过本记录说明纠正原因。

## 权威 Change Request 字段与影响

- 发现者：Codex Backend（原阻塞记录）；CR6-RV-001 由 Codex Reviewer 发现。
- 原任务：TASK-0007。
- 变更原因：原 CR 所称既有验证规则缺口无批准规格或提交历史依据。
- 产品范围影响：无。
- 技术影响：撤销 CR-0006 错误增加的验证规则，恢复既有批准基线。
- 文件影响：仅 CR-0006、TASK-0007、current-task、MODULE-LOCKS 管理文档。
- 测试影响：无；不增加、删除或放宽原批准测试要求。
- 风险：低；仅纠正审计来源和移除无依据的后续规则。
- Claude 裁决：N/A：无产品范围变化。
- Architect 裁决：REJECTED；CR-0006 原提案不实施。
- 更新后的 Requirement Source：不变。
- 批准状态：REJECTED。
- 文件预算影响：无；仍为新增 16、修改 5、Migration 3 个。
- 依赖预算影响：无；CR-0005 批准的四项 8.0.29 依赖不变。
- AC 数量影响：无；仍为 35 条。
- API 影响：无；仍为 4 个认证 API。
- 安全规则影响：无。
- 实施代码影响：无；完整实现继续原样保留且未提交。
- scripts 影响：无。
- 实施锁影响：无；19 项继续 `CLAIMED by Codex Backend`。

## 回退与验收条件

本纠正的回退不是恢复 CR-0006 原门禁，而是继续保持 TASK-0007 `BLOCKED` 并再次升级流程裁决。纠正验收条件：

1. 当前有效 TASK 不再声称原规格要求 build.ps1/test.ps1，不要求 verify-project.ps1，也不包含 CR-0006 新增替代门禁。
2. CR6-RV-001、Git 历史证据和原前提无效结论完整保留。
3. 预算 16/5、Migration 3、AC 35、API 4、依赖和安全规则不变。
4. TASK/current-task 保持 `BLOCKED`，恢复目标为 `IN_PROGRESS`。
5. 19 项实施锁保持 `CLAIMED by Codex Backend`，完整实现保持未暂存、未提交。
6. 独立 Codex Reviewer 复审本纠正；不得预先记录 PASS 或 Reviewer 提交。

## BLOCKED 恢复条件

当前等待独立 Reviewer 对 CR6-RV-001 审计纠正进行复审。复审 PASS 后，才可由 Owner 按权威流程评估并执行 `BLOCKED → IN_PROGRESS`；本轮不执行恢复，复审 PASS 前不得提交实现。

## 纠正日期

2026-07-19
