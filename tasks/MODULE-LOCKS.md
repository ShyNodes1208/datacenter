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
| TASK-0006 | Datacenter.sln | Cursor Developer | 2026-07-17 22:56:03 +08:00 | CLAIMED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | |
| TASK-0006 | src/frontend | Cursor Developer | 2026-07-17 22:56:03 +08:00 | CLAIMED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | |
| TASK-0006 | src/backend/Datacenter.Api | Cursor Developer | 2026-07-17 22:56:03 +08:00 | CLAIMED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | |
| TASK-0006 | tests/backend/Datacenter.Api.Tests | Cursor Developer | 2026-07-17 22:56:03 +08:00 | CLAIMED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | |
| TASK-0006 | scripts/verify-project.ps1 | Cursor Developer | 2026-07-17 22:56:03 +08:00 | CLAIMED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | |
| TASK-0006 | README.md | Cursor Developer | 2026-07-17 22:56:03 +08:00 | CLAIMED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | |
| TASK-0006 | tasks/TASK-0006-PROJECT-SCAFFOLD.md | Cursor Developer | 2026-07-17 22:56:03 +08:00 | CLAIMED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | |
| TASK-0006 | tasks/current-task.md | Cursor Developer | 2026-07-17 22:56:03 +08:00 | CLAIMED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | |
| TASK-0006 | tasks/MODULE-LOCKS.md | Cursor Developer | 2026-07-17 22:56:03 +08:00 | CLAIMED | TASK-0006 进入 COMPLETED 或 CANCELLED 时释放 | |

## 冲突处理示例

若 TASK-1001 已以 `CLAIMED` 占用 `src/backend/Assets/`，TASK-1002 申请 `src/backend/Assets/Racks/` 时属于子路径重叠。TASK-1002 不得认领或修改，必须转为 `BLOCKED` 并记录 TASK-1001；待 TASK-1001 释放后重新检查并认领。
