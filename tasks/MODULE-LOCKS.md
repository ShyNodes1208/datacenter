# Module Locks

本表必须按 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 维护。路径使用仓库相对路径；Windows 比较不区分大小写。`CLAIMED` 和 `HANDED_OFF` 都是活跃占用，完全相同或父子路径重叠即冲突。

| Task ID | Module or Path | Owner | Claimed At | Status | Release Condition | Released At |
|---|---|---|---|---|---|---|
| TASK-0002 | AGENTS.md | Codex Architect | 2026-07-16 +08:00 | RELEASED | TASK-0002 进入 COMPLETED 或 CANCELLED | 2026-07-16 16:48:08 +08:00 |
| TASK-0002 | agents/ | Codex Architect | 2026-07-16 +08:00 | RELEASED | TASK-0002 进入 COMPLETED 或 CANCELLED | 2026-07-16 16:48:08 +08:00 |
| TASK-0002 | docs/architecture/AGENT-WORKFLOW.md | Codex Architect | 2026-07-16 +08:00 | RELEASED | TASK-0002 进入 COMPLETED 或 CANCELLED | 2026-07-16 16:48:08 +08:00 |
| TASK-0002 | tasks/TASK-TEMPLATE.md | Codex Architect | 2026-07-16 +08:00 | RELEASED | TASK-0002 进入 COMPLETED 或 CANCELLED | 2026-07-16 16:48:08 +08:00 |
| TASK-0002 | tasks/current-task.md | Codex Architect | 2026-07-16 +08:00 | RELEASED | TASK-0002 进入 COMPLETED 或 CANCELLED | 2026-07-16 16:48:08 +08:00 |
| TASK-0002 | tasks/MODULE-LOCKS.md | Codex Architect | 2026-07-16 +08:00 | RELEASED | TASK-0002 进入 COMPLETED 或 CANCELLED | 2026-07-16 16:48:08 +08:00 |
| TASK-0002 | tasks/TASK-EXAMPLE.md | Codex Architect | 2026-07-16 +08:00 | RELEASED | TASK-0002 进入 COMPLETED 或 CANCELLED | 2026-07-16 16:48:08 +08:00 |
| TASK-0002 | scripts/validate-agent-workflow.ps1 | Codex Architect | 2026-07-16 +08:00 | RELEASED | TASK-0002 进入 COMPLETED 或 CANCELLED | 2026-07-16 16:48:08 +08:00 |
| TASK-0003 | AGENTS.md | Codex Architect | 2026-07-16 17:12:50 +08:00 | RELEASED | TASK-0003 进入 COMPLETED 或 CANCELLED | 2026-07-16 21:40:28 +08:00 |
| TASK-0003 | docs/architecture/AGENT-WORKFLOW.md | Codex Architect | 2026-07-16 17:12:50 +08:00 | RELEASED | TASK-0003 进入 COMPLETED 或 CANCELLED | 2026-07-16 21:40:28 +08:00 |
| TASK-0003 | tasks/TASK-TEMPLATE.md | Codex Architect | 2026-07-16 17:12:50 +08:00 | RELEASED | TASK-0003 进入 COMPLETED 或 CANCELLED | 2026-07-16 21:40:28 +08:00 |
| TASK-0003 | tasks/current-task.md | Codex Architect | 2026-07-16 17:12:50 +08:00 | RELEASED | TASK-0003 进入 COMPLETED 或 CANCELLED | 2026-07-16 21:40:28 +08:00 |
| TASK-0003 | tasks/MODULE-LOCKS.md | Codex Architect | 2026-07-16 17:12:50 +08:00 | RELEASED | TASK-0003 进入 COMPLETED 或 CANCELLED | 2026-07-16 21:40:28 +08:00 |
| TASK-0003 | agents/ | Codex Architect | 2026-07-16 17:12:50 +08:00 | RELEASED | TASK-0003 进入 COMPLETED 或 CANCELLED | 2026-07-16 21:40:28 +08:00 |
| TASK-0003 | scripts/validate-agent-workflow.ps1 | Codex Architect | 2026-07-16 17:12:50 +08:00 | RELEASED | TASK-0003 进入 COMPLETED 或 CANCELLED | 2026-07-16 21:40:28 +08:00 |

| TASK-0004 | docs/product/MVP-PRODUCT-BASELINE.md | Claude + DeepSeek Product Manager | 2026-07-17 14:41:38 +08:00 | RELEASED | TASK-0004 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-17 15:01:08 +08:00 |
| TASK-0004 | tasks/current-task.md | Claude + DeepSeek Product Manager | 2026-07-17 14:41:38 +08:00 | RELEASED | TASK-0004 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-17 15:01:08 +08:00 |
| TASK-0004 | tasks/MODULE-LOCKS.md | Claude + DeepSeek Product Manager | 2026-07-17 14:41:38 +08:00 | RELEASED | TASK-0004 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-17 15:01:08 +08:00 |
| TASK-0005 | docs/architecture/MVP-ARCHITECTURE-BASELINE.md | Claude + DeepSeek Product Manager | 2026-07-17 16:00:00 +08:00 | RELEASED | TASK-0005 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-17 |
| TASK-0005 | tasks/current-task.md | Claude + DeepSeek Product Manager | 2026-07-17 16:00:00 +08:00 | RELEASED | TASK-0005 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-17 |
| TASK-0005 | tasks/MODULE-LOCKS.md | Claude + DeepSeek Product Manager | 2026-07-17 16:00:00 +08:00 | RELEASED | TASK-0005 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-17 |
| TASK-0006 | tasks/TASK-0006-PROJECT-SCAFFOLD.md | Claude + DeepSeek Product Manager | 2026-07-17 | RELEASED | TASK-0006 规格修正完成，转入 READY；实施时由 Cursor Developer 重新认领 | 2026-07-17 |
| TASK-0006 | tasks/current-task.md | Claude + DeepSeek Product Manager | 2026-07-17 | RELEASED | TASK-0006 规格修正完成，转入 READY；实施时由 Cursor Developer 重新认领 | 2026-07-17 |
| TASK-0006 | tasks/MODULE-LOCKS.md | Claude + DeepSeek Product Manager | 2026-07-17 | RELEASED | TASK-0006 规格修正完成，转入 READY；实施时由 Cursor Developer 重新认领 | 2026-07-17 |
| TASK-0006 | Datacenter.sln | Cursor Developer | 2026-07-17 22:56:03 +08:00 | RELEASED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-18 11:11:38 +08:00（Codex Reviewer 实际释放；6d89eeb 无效关闭历史见任务交接记录） |
| TASK-0006 | src/frontend | Cursor Developer | 2026-07-17 22:56:03 +08:00 | RELEASED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-18 11:11:38 +08:00（Codex Reviewer 实际释放） |
| TASK-0006 | src/backend/Datacenter.Api | Cursor Developer | 2026-07-17 22:56:03 +08:00 | RELEASED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-18 11:11:38 +08:00（Codex Reviewer 实际释放） |
| TASK-0006 | tests/backend/Datacenter.Api.Tests | Cursor Developer | 2026-07-17 22:56:03 +08:00 | RELEASED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-18 11:11:38 +08:00（Codex Reviewer 实际释放） |
| TASK-0006 | scripts/verify-project.ps1 | Cursor Developer | 2026-07-18（R4-001 IN_FIX 重新认领） | RELEASED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-18 11:11:38 +08:00（Codex Reviewer 实际释放） |
| TASK-0006 | README.md | Cursor Developer | 2026-07-17 22:56:03 +08:00 | RELEASED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-18 11:11:38 +08:00（Codex Reviewer 实际释放） |
| TASK-0006 | tasks/TASK-0006-PROJECT-SCAFFOLD.md | Cursor Developer | 2026-07-18（R4-001 IN_FIX 重新认领） | RELEASED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-18 11:11:38 +08:00（Codex Reviewer 实际释放） |
| TASK-0006 | tasks/current-task.md | Cursor Developer | 2026-07-18（R4-001 IN_FIX 重新认领） | RELEASED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-18 11:11:38 +08:00（Codex Reviewer 实际释放） |
| TASK-0006 | tasks/MODULE-LOCKS.md | Cursor Developer | 2026-07-18（R4-001 IN_FIX 重新认领） | RELEASED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | 2026-07-18 11:11:38 +08:00（Codex Reviewer 实际释放） |
| TASK-0007 | tasks/TASK-0007-BACKEND-FOUNDATION.md | Codex Architect | 2026-07-18（READY-GATE 审计纠正重新认领） | RELEASED | SPEC-RETEST-6 PASS（Reviewer 提交 3d532fd）；当前真实 Codex Architect 会话执行 DRAFT→READY 后释放；不转交 Codex Backend | 2026-07-19 00:24:46 +08:00（Codex Architect 实际释放） |
| TASK-0007 | tasks/current-task.md | Codex Architect | 2026-07-18（READY-GATE 审计纠正重新认领） | RELEASED | SPEC-RETEST-6 PASS（Reviewer 提交 3d532fd）；当前真实 Codex Architect 会话执行 DRAFT→READY 后释放；不转交 Codex Backend | 2026-07-19 00:24:46 +08:00（Codex Architect 实际释放） |
| TASK-0007 | tasks/MODULE-LOCKS.md | Codex Architect | 2026-07-18（READY-GATE 审计纠正重新认领） | RELEASED | SPEC-RETEST-6 PASS（Reviewer 提交 3d532fd）；当前真实 Codex Architect 会话执行 DRAFT→READY 后释放；不转交 Codex Backend | 2026-07-19 00:24:46 +08:00（Codex Architect 实际释放） |

## TASK-0007 锁审计纠正

- ⚠ **INVALID（提交 322e240）**：`tasks/TASK-0007-BACKEND-FOUNDATION.md` 的 RELEASED 由 Claude 会话实际执行，却记录为 Codex Architect；仓库无角色映射授权。依据 READY-GATE 报告及提交 0239fc5，该释放无效。
- ⚠ **INVALID（提交 322e240）**：`tasks/current-task.md` 的 RELEASED 由 Claude 会话实际执行，却记录为 Codex Architect；仓库无角色映射授权。依据 READY-GATE 报告及提交 0239fc5，该释放无效。
- ⚠ **INVALID（提交 322e240）**：`tasks/MODULE-LOCKS.md` 的 RELEASED 由 Claude 会话实际执行，却记录为 Codex Architect；仓库无角色映射授权。依据 READY-GATE 报告及提交 0239fc5，该释放无效。
- **CORRECTION**：当前有效状态恢复为 SPEC-RETEST-6 PASS 后的 DRAFT；这是对无效迁移及无效锁释放的审计纠正，不是新的业务状态倒退。三项规格文档锁由当前实际修正规格的正式角色 Codex Architect 恢复为 CLAIMED；原 322e240 历史保留。
- **VALID RELEASE（2026-07-19）**：原状态 CLAIMED，原 Owner Codex Architect；当前真实 Codex Architect 会话依据 SPEC-RETEST-6 PASS（Reviewer 提交 3d532fd，Findings 0/0/0/0）合法执行 DRAFT → READY 后，将三项规格文档锁全部变更为 RELEASED。当前不再持有规格编写锁；无 CLAIMED/HANDED_OFF 遗留；未转交 Codex Backend，未认领实施锁。

## 冲突处理示例

若 TASK-1001 已以 `CLAIMED` 占用 `src/backend/Assets/`，TASK-1002 申请 `src/backend/Assets/Racks/` 时属于子路径重叠。TASK-1002 不得认领或修改，必须转为 `BLOCKED` 并记录 TASK-1001；待 TASK-1001 释放后重新检查并认领。
