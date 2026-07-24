# TASK-0022：服务器基础信息 CRUD（后端）

## 目标

实现 Server 模型、数据库迁移、ServersController（列表/详情/新增/编辑 API），以及集成测试。

## Server 模型

```csharp
public sealed class Server
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;       // 必填，全局唯一
    public string ManagementIP { get; set; } = string.Empty; // 必填，全局唯一
    public string? AssetNumber { get; set; }                 // 可选，若填写则全局唯一
    public string DeviceType { get; set; } = string.Empty;   // 必填
    public int DeviceHeight { get; set; }                    // 必填，>=1
    public string OperationalStatus { get; set; } = "正常";  // 正常/异常/维护
    public string PositionStatus { get; set; } = "未上架";   // 未上架/在架/已下架
    public string? System { get; set; }
    public string? Owner { get; set; }
    public string? Notes { get; set; }
}
```

## DB 约束

- PK: Id
- UNIQUE: Name, ManagementIP
- CHECK: OperationalStatus IN ('正常','异常','维护')
- CHECK: PositionStatus IN ('未上架','在架','已下架')
- CHECK: DeviceHeight >= 1

## API

### GET /api/servers
- 认证：所有登录用户
- 查询参数（全部可选，AND 组合）：name（模糊）、ip（模糊）、assetNumber（精确）、positionStatus、operationalStatus、system（模糊）
- 返回服务器列表，包含 id/name/managementIP/assetNumber/deviceType/deviceHeight/operationalStatus/positionStatus/system/owner/notes

### GET /api/servers/{id}
- 返回服务器完整信息

### POST /api/servers
- 权限：机房管理员、运维人员
- CSRF 必须
- Name 必填唯一、ManagementIP 必填唯一、DeviceType 必填、DeviceHeight >=1
- AssetNumber 若填写则唯一
- 默认 OperationalStatus="正常"，PositionStatus="未上架"
- 返回 201

### PUT /api/servers/{id}
- 权限：机房管理员、运维人员
- CSRF 必须
- 同 POST 校验
- 不可修改 PositionStatus
- 404 如果不存在

## 文件清单

新增：
- src/backend/Datacenter.Api/Models/Server.cs
- src/backend/Datacenter.Api/Controllers/ServersController.cs
- src/backend/Datacenter.Api/Migrations/<ts>_AddServers.cs (auto)
- src/backend/Datacenter.Api/Migrations/<ts>_AddServers.Designer.cs (auto)
- tests/backend/Datacenter.Api.Tests/IntegrationTests/ServerIntegrationTests.cs

修改：
- src/backend/Datacenter.Api/Data/AppDbContext.cs
- src/backend/Datacenter.Api/Migrations/AppDbContextModelSnapshot.cs (auto)

## 验收

1. 四种角色均可 GET list 和 detail
2. 匿名返回 401
3. 只读角色 POST/PUT 返回 403
4. CRUD 校验规则生效
5. dotnet build 0 错误 0 警告
6. dotnet test 全部通过（含新增测试）
