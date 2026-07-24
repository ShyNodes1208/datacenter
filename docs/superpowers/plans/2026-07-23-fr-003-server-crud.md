# FR-003 服务器基础信息录入 — 实现计划

## Backend（派 Codex Backend）

### 1. Server 模型

```csharp
// Models/Server.cs
namespace Datacenter.Api.Models;

public sealed class Server
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string ManagementIP { get; set; } = string.Empty;
    public string? AssetNumber { get; set; }
    public string DeviceType { get; set; } = string.Empty;
    public int DeviceHeight { get; set; }
    public string OperationalStatus { get; set; } = "正常";
    public string PositionStatus { get; set; } = "未上架";
    public string? System { get; set; }
    public string? Owner { get; set; }
    public string? Notes { get; set; }
}
```

DB 约束：
- PK Id
- UNIQUE Name, ManagementIP
- UNIQUE AssetNumber（过滤 null 的 unique index，或应用层校验）
- CHECK OperationalStatus IN ('正常','异常','维护')
- CHECK PositionStatus IN ('未上架','在架','已下架')
- CHECK DeviceHeight >= 1

### 2. API

**GET /api/servers**

查询参数（全部可选）：name, ip, assetNumber, roomId, rackId, positionStatus, operationalStatus, system

返回：
```json
[
  { "id", "name", "managementIP", "assetNumber", "deviceType", "deviceHeight",
    "operationalStatus", "positionStatus", "system", "owner", "notes",
    "roomName": null, "rackCode": null }
]
```

**GET /api/servers/{id}**

返回完整信息 + 当前位置（机房名、机柜编号、U 位范围）

**POST /api/servers**

权限：机房管理员、运维人员
校验：Name 必填唯一、ManagementIP 必填唯一、DeviceType 必填、DeviceHeight >=1
AssetNumber 若填写则唯一
OperationalStatus 默认"正常"，PositionStatus 默认"未上架"

**PUT /api/servers/{id}**

同 POST 校验，不可修改 PositionStatus（由位置操作修改）

### 3. 文件清单

新增：Models/Server.cs, Controllers/ServersController.cs, Migration
修改：Data/AppDbContext.cs, AppDbContextModelSnapshot.cs
测试：ServerIntegrationTests.cs

## Frontend（派 Cursor Frontend）

### 4. 路由

| 路径 | 组件 |
|---|---|
| /servers | ServerListView |
| /servers/new | ServerFormView (create mode) |
| /servers/:id | ServerDetailView |
| /servers/:id/edit | ServerFormView (edit mode) |

### 5. 页面

**ServerListView**：搜索栏（名称/IP/位置状态/运行状态）+ 服务器表格 + 新增按钮
**ServerDetailView**：全部字段 + 当前位置（机房/机柜/U位）+ 编辑按钮
**ServerFormView**：表单（名称/IP/设备类型/设备高度/所属系统/负责人/备注），新增/编辑复用

### 6. 文件清单

新增：ServerListView.vue, ServerDetailView.vue, ServerFormView.vue
修改：router.ts
