# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

- Task：TASK-0019
- Title：机房管理员编辑机房名称和状态
- Status：READY
- Owner：Codex Architect
- Backend Owner：Codex Backend
- Frontend Owner：Cursor Frontend
- Reviewer：Codex Reviewer
- Branch：feature/task-0019-edit-room
- Task File：tasks/TASK-0019-EDIT-ROOM.md
- Implementation Started：NO
- Active Product Locks：0
- Blocker：无
- Final Review：N/A：尚未开始实现
- Finding：无
- Workflow：前序指针 `TASK-0018 COMPLETED → IDLE`；本任务 `IDLE → DRAFT → READY`
- Final Result：N/A：任务已可实施，产品代码尚未修改
- Next Action：Codex Backend 在一个会话中自行认领两个后端产品文件锁，执行 `READY → IN_PROGRESS`，并完成 GET 契约调整、PUT 接口和后端测试

TASK-0019 精确批准 Backend 与 Frontend 各 2 个产品文件；当前未认领任何产品锁，活跃产品锁 0。Architect 不代表实施 Owner 认领产品锁。下一合法角色为 Codex Backend。
