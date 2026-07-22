# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

- Task：TASK-0018
- Title：机房管理员新增机房
- Status：READY
- Owner：Codex Architect
- Backend Owner：Codex Backend
- Frontend Owner：Cursor Frontend
- Reviewer：Codex Reviewer
- Branch：feature/task-0018-create-room
- Task File：tasks/TASK-0018-CREATE-ROOM.md
- Implementation Started：NO
- Active Product Locks：0
- Blocker：无
- Workflow：前序指针 `TASK-0009 COMPLETED → IDLE`；本任务 `IDLE → DRAFT → READY`
- Next Action：Codex Backend 直接实现后端功能

下一合法角色为 Codex Backend。其应在一个会话中检查冲突并认领 `src/backend/Datacenter.Api/Controllers/RoomsController.cs` 与 `tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs`，进入 `IN_PROGRESS`，直接完成 `POST /api/rooms` 和后端集成测试。

Architect 未认领产品实施锁；`tasks/MODULE-LOCKS.md` 无需新增虚假 `CLAIMED` 或 `RELEASED` 记录。
