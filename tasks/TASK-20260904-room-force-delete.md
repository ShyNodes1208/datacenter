# TASK-20260904-room-force-delete

| 字段 | 内容 |
|------|------|
| Status | `READY` |
| Branch | 保持当前 `fix/TASK-20260901-floorplan-path-centered-display`（或用户指定新 `fix/` 分支） |
| Orchestrator | Codex + Terra |
| Owner | Cursor Developer |
| Reviewer | Codex Reviewer |
| Spec | `docs/superpowers/specs/2026-09-04-room-force-delete-design.md` |
| Plan | `docs/superpowers/plans/2026-09-04-room-force-delete.md` |

## 需求

首页支持机房**强制删除**：级联清除机柜、设备 U 位、服务器、端口、线缆、审计，便于导入测试后整机房清空重来。

## Acceptance Criteria

1. `DELETE /api/rooms/{id}` 无 force：有机柜仍 409；无机柜 204。
2. `DELETE /api/rooms/{id}?force=true`：非空机房级联清空后 204；只读 403。
3. 首页：空机房「删除」；有机柜「强制删除」+ 输入机房全名确认。
4. 后端 `RoomIntegrationTests` 与相关前端测试、typecheck 通过。
5. 不改 schema/迁移/新依赖；不实现逐条实体 CRUD；不擅自 commit/push。

## 允许修改

- `src/backend/Datacenter.Api/Controllers/RoomsController.cs`
- `tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs`
- `src/frontend/src/views/HomeView.vue`
- 最小必要的前端测试文件
- `.ai/IMPLEMENTATION.md`、模块锁、HANDOFF/TASKS（收尾）

## 禁止

- 扩大范围到机柜/设备/服务器/线缆逐条改删
- 改其它 API 契约、导入逻辑、全库 Reset 脚本
- commit/push（除非用户明确要求）
