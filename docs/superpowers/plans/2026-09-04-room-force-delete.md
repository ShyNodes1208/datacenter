# 机房强制删除 Implementation Plan

> **For agentic workers:** Use TDD. Steps use checkbox (`- [ ]`) syntax. Do not commit/push unless the user explicitly asks. Orchestrator: Codex + Terra. Implementer: Cursor Developer. Reviewer: Codex Reviewer.

**Goal:** 管理员可对非空机房执行强制删除，级联清除机柜、设备 U 位、服务器、端口、线缆与审计，便于反复导入测试。

**Architecture:** 扩展现有 `DELETE /api/rooms/{id}`，增加查询参数 `force=true`；在 `RoomsController.Delete` 内按 FK Restrict 顺序手动 `RemoveRange` 后一次保存。首页按 `rackCount` 显示「强制删除」并用机房全名二次确认。

**Tech Stack:** ASP.NET Core 8 + EF Core + SQLite；Vue 3 + TypeScript；xUnit 集成测试；Vitest。

## Global Constraints

- 不改数据库 schema / 迁移 / 新依赖
- 不扩大到逐条 CRUD；不做软删除
- API 契约仅增加可选 query `force`；默认行为不变
- 模块锁：认领后再改；完成后 HANDOFF；不擅自 commit/push
- 规格：`docs/superpowers/specs/2026-09-04-room-force-delete-design.md`

## File map

| 文件 | 职责 |
|------|------|
| `src/backend/Datacenter.Api/Controllers/RoomsController.cs` | `Delete` 增加 `force`；级联删除 |
| `tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs` | 强制删除 / 默认拒绝 用例 |
| `src/frontend/src/views/HomeView.vue` | UI 与确认、调用 `?force=true` |
| `src/frontend/src/__tests__/router-and-views.test.ts`（或现有 Home 相关测试） | 前端行为回归 |

---

### Task 1: Backend force delete + tests

**Files:**
- Modify: `src/backend/Datacenter.Api/Controllers/RoomsController.cs`（`Delete` 方法）
- Modify: `tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs`

**Interfaces:**
- Consumes: 现有 `AppDbContext` 实体与 Restrict FK
- Produces: `DELETE /api/rooms/{id}?force=true` → 204；无 force 且有机柜 → 409

- [ ] **Step 1: 写失败集成测试**

在 `RoomIntegrationTests` 增加（命名可微调，语义必须覆盖）：

1. `DeleteRoom_Force_DeletesRoomWithRacksServersCables`  
   - 建机房 + 机柜 + 服务器 + 在架占位 + 两端端口 + 一条线缆 + 一条审计  
   - `DELETE ...?force=true` 期望 204  
   - Assert 库中该机房、机柜、服务器、端口、线缆、审计、DevicePosition（若有）计数为 0

2. `DeleteRoom_WithoutForce_StillRejectsWhenRacksExist`  
   - 有机柜时无 query 仍 409，文案不变

3. `DeleteRoom_Force_ReadOnlyReturnsForbidden`  
   - 只读角色 `force=true` → 403，数据仍在

扩展 helper：

```csharp
private static async Task<HttpResponseMessage> DeleteRoomAsync(
    HttpClient client, Guid id, bool force = false)
{
    using var csrf = await client.GetAsync("/api/auth/csrf");
    var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
    var url = force ? $"/api/rooms/{id}?force=true" : $"/api/rooms/{id}";
    using var request = new HttpRequestMessage(HttpMethod.Delete, url);
    request.Headers.Add("X-XSRF-TOKEN", token);
    return await client.SendAsync(request);
}
```

- [ ] **Step 2: 跑测试确认 RED**

```bash
dotnet test tests/backend/Datacenter.Api.Tests/ --filter "FullyQualifiedName~DeleteRoom_Force"
```

期望：编译失败或断言失败（尚未实现 force）。

- [ ] **Step 3: 实现 `Delete`**

签名改为接受 `[FromQuery] bool force = false`。

伪逻辑（一次 SaveChanges）：

```csharp
if (!force)
{
    if (await dbContext.Racks.AnyAsync(r => r.RoomId == id, cancellationToken))
        return Conflict(new { error = "机房中存在机柜，不能删除" });
    dbContext.Rooms.Remove(room);
    await dbContext.SaveChangesAsync(cancellationToken);
    return NoContent();
}

var rackIds = await dbContext.Racks
    .Where(r => r.RoomId == id)
    .Select(r => r.Id)
    .ToListAsync(cancellationToken);

var serverIds = await dbContext.ServerPositions
    .Where(sp => rackIds.Contains(sp.RackId))
    .Select(sp => sp.ServerId)
    .Distinct()
    .ToListAsync(cancellationToken);

var portIds = await dbContext.Ports
    .Where(p => serverIds.Contains(p.ServerId))
    .Select(p => p.Id)
    .ToListAsync(cancellationToken);

dbContext.Cables.RemoveRange(
    dbContext.Cables.Where(c =>
        portIds.Contains(c.SourcePortId) || portIds.Contains(c.TargetPortId)));
dbContext.Ports.RemoveRange(
    dbContext.Ports.Where(p => serverIds.Contains(p.ServerId)));
dbContext.AuditRecords.RemoveRange(
    dbContext.AuditRecords.Where(a => serverIds.Contains(a.ServerId)));
dbContext.ServerPositions.RemoveRange(
    dbContext.ServerPositions.Where(sp =>
        rackIds.Contains(sp.RackId) || serverIds.Contains(sp.ServerId)));
dbContext.Servers.RemoveRange(
    dbContext.Servers.Where(s => serverIds.Contains(s.Id)));
dbContext.DevicePositions.RemoveRange(
    dbContext.DevicePositions.Where(dp => rackIds.Contains(dp.RackId)));
dbContext.Racks.RemoveRange(
    dbContext.Racks.Where(r => r.RoomId == id));
dbContext.Rooms.Remove(room);
await dbContext.SaveChangesAsync(cancellationToken);
return NoContent();
```

注意：先物化 Id 列表再 `RemoveRange`，避免边枚举边改集合问题。

- [ ] **Step 4: 跑后端相关测试全绿**

```bash
dotnet test tests/backend/Datacenter.Api.Tests/ --filter "FullyQualifiedName~RoomIntegrationTests"
```

---

### Task 2: Frontend force-delete UX + tests

**Files:**
- Modify: `src/frontend/src/views/HomeView.vue`
- Modify: 现有覆盖 Home 删除的 Vitest（优先 `router-and-views.test.ts`；若无删除用例则最小新增）

**Interfaces:**
- Consumes: Task 1 的 `DELETE ?force=true`
- Produces: 有机柜卡片显示「强制删除」；名称确认后调用

- [ ] **Step 1: 写/改失败前端测试**

覆盖：
- `rackCount > 0` 时渲染「强制删除」文案（或 role/button）
- 用户确认名称正确时 `request` 调用 `/api/rooms/{id}?force=true`，method DELETE
- 名称错误时不调用 DELETE

可用 `vi.spyOn(window, 'prompt')` / `confirm`。

- [ ] **Step 2: 实现 UI**

- `rackCount === 0`：保持现有「删除」→ `DELETE /api/rooms/{id}`
- `rackCount > 0`：显示「强制删除」→ `prompt` 要求输入机房名；一致则 `DELETE /api/rooms/{id}?force=true`
- Prompt 文案须含不可恢复与将删除机柜/设备/服务器/线缆之意
- 权限：与现有 `canDeleteRoom` 相同
- 成功后沿用现有刷新逻辑

- [ ] **Step 3: 跑前端测试 + typecheck**

```bash
cd src/frontend && npm test && npm run typecheck
```

---

### Task 3: 收尾报告（不 commit）

- [ ] 写 `.ai/IMPLEMENTATION.md`（改动文件、测试命令与结果、已知限制）
- [ ] 更新 `.ai/TASKS.md` / 模块锁交接为 `HANDED_OFF`
- [ ] `git diff --check`；**不要** commit/push（用户未要求时）

## Acceptance Criteria（任务完成门禁）

1. 空机房普通删除仍可用
2. 非空机房无 force → 409；有 force → 数据清空
3. 只读 403
4. 前端名称校验阻止误删
5. 后端 `RoomIntegrationTests` + 相关前端测试通过；typecheck 通过
