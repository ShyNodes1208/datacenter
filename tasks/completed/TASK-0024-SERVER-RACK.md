# TASK-0024：服务器上架（后端）

## 目标

实现 ServerPosition 模型、数据库迁移、上架 API、U 位可用性查询 API，以及集成测试。

## ServerPosition 模型

```csharp
public sealed class ServerPosition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ServerId { get; set; }
    public Server Server { get; set; } = null!;
    public Guid RackId { get; set; }
    public Rack Rack { get; set; } = null!;
    public int StartU { get; set; }
    public int EndU { get; set; }
    public string Status { get; set; } = "在架";  // 在架/已下架
    public DateTime InstalledAt { get; set; } = DateTime.UtcNow;
}
```

## DB 约束

- PK: Id
- FK: ServerId → Servers.Id (Restrict)
- FK: RackId → Racks.Id (Restrict)
- CHECK: StartU >= 1
- CHECK: Status IN ('在架','已下架')

## API

### POST /api/servers/{id}/rack

- 权限：机房管理员、运维人员
- CSRF 必须
- Body: `{ rackId, startU }`
- 校验：
  1. Server 存在且 PositionStatus 为 未上架 或 已下架
  2. Rack 存在且所属 Room 状态为 启用
  3. startU >= 1
  4. EndU = startU + Server.DeviceHeight - 1，EndU <= Rack.HeightU
  5. 目标 U 位范围 [startU, endU] 与已有在架 ServerPosition 无重叠
- 成功：创建 ServerPosition（Status=在架），更新 Server.PositionStatus="在架"
- 事务：创建 ServerPosition 和更新 Server 在同一事务中
- 返回：201 + { serverPositionId, serverName, rackCode, startU, endU }

### GET /api/racks/{id}/availability

- 认证：所有登录用户
- 返回该机柜每个 U 位的占用情况：
```json
{
  "rackId": "...",
  "rackCode": "...",
  "heightU": 42,
  "positions": [
    { "uNumber": 42, "occupied": true, "serverName": "xxx", "serverId": "..." },
    { "uNumber": 41, "occupied": false },
    ...
  ]
}
```

## 事务要求

上架操作中，创建 ServerPosition 和更新 Server.PositionStatus 必须在同一事务中，确保数据一致性。使用 EF Core 的 `SaveChangesAsync`（单次保存自动在事务中）。

## 文件清单

新增：
- Models/ServerPosition.cs
- Migration
- ServerPositionIntegrationTests.cs（或扩展 ServerIntegrationTests.cs）

修改：
- Data/AppDbContext.cs
- Controllers/ServersController.cs（扩展 POST /api/servers/{id}/rack）
- Controllers/RacksController.cs（扩展 GET /api/racks/{id}/availability）

## 验收

1. 未上架服务器可上架到空闲 U 位
2. 已下架服务器可重新上架
3. 已在架服务器上架返回错误
4. U 位超出范围返回错误
5. U 位冲突返回错误（与其他在架 ServerPosition 重叠）
6. 停用机柜/机房上架返回错误
7. 匿名 401，只读角色 403
8. dotnet build 0 错误 0 警告
9. dotnet test 全部通过
