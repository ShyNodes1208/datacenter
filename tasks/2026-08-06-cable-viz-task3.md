# Task 3: CableSceneController — 只读查询端点

> **Assigned to:** Cursor
> **Depends on:** Task 1 (需要 Cable.Purpose 字段)
> **Plan ref:** docs/superpowers/plans/2026-08-05-cable-visualization.md

## 目标

新增 `GET /api/rooms/{roomId}/cable-scene` 端点，返回机房内所有机柜、网络设备、线缆的聚合数据，供前端一次查询渲染线路图。

## 文件

| 文件 | 操作 |
|------|------|
| `src/backend/Datacenter.Api/Controllers/CableSceneController.cs` | 新建 |

## 返回数据结构

```json
{
  "racks": [{ "rackId", "code", "x", "y", "width": 60, "height": "heightU * 20" }],
  "devices": [{ "deviceId", "deviceName", "deviceType", "rackId", "startU", "endU" }],
  "cables": [{
    "cableId", "cableType", "purpose",
    "source": { "deviceId", "deviceName", "portName", "rackId", "rackCode" },
    "target": { "deviceId", "deviceName", "portName", "rackId", "rackCode" }
  }]
}
```

## Controller 代码

```csharp
using Datacenter.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class CableSceneController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("rooms/{roomId:guid}/cable-scene")]
    public async Task<IActionResult> GetScene(Guid roomId, CancellationToken cancellationToken)
    {
        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == roomId, cancellationToken);
        if (!roomExists)
            return NotFound(new { error = "机房不存在" });

        // 机房内所有机柜
        var racks = await dbContext.Racks
            .AsNoTracking()
            .Where(r => r.RoomId == roomId)
            .Select(r => new {
                RackId = r.Id, r.Code, r.X, r.Y,
                Width = 60,
                Height = r.HeightU * 20
            })
            .ToListAsync(cancellationToken);

        var rackIds = racks.Select(r => r.RackId).ToHashSet();

        // 机柜内的网络设备（交换机/路由器等）
        var devices = await dbContext.ServerPositions
            .AsNoTracking()
            .Where(sp => rackIds.Contains(sp.RackId) && sp.Status == "在架")
            .Where(sp =>
                sp.Server.DeviceType.Contains("交换") ||
                sp.Server.DeviceType.Contains("switch") ||
                sp.Server.DeviceType.Contains("路由") ||
                sp.Server.DeviceType.Contains("router") ||
                sp.Server.DeviceType.Contains("网络") ||
                sp.Server.DeviceType.Contains("network"))
            .Select(sp => new {
                DeviceId = sp.Server.Id,
                DeviceName = sp.Server.Name,
                sp.Server.DeviceType,
                RackId = sp.RackId,
                sp.StartU,
                sp.EndU
            })
            .ToListAsync(cancellationToken);

        var deviceIds = devices.Select(d => d.DeviceId).ToHashSet();

        // 至少一端在机房内的线缆
        var cables = await dbContext.Cables
            .AsNoTracking()
            .Where(c =>
                deviceIds.Contains(c.SourcePort.ServerId) ||
                deviceIds.Contains(c.TargetPort.ServerId))
            .Select(c => new {
                CableId = c.Id, c.CableType, c.Purpose,
                Source = new {
                    DeviceId = c.SourcePort.Server.Id,
                    DeviceName = c.SourcePort.Server.Name,
                    PortName = c.SourcePort.PortName,
                    RackId = dbContext.ServerPositions
                        .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                        .Select(sp => (Guid?)sp.RackId).FirstOrDefault(),
                    RackCode = dbContext.ServerPositions
                        .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                        .Select(sp => sp.Rack.Code).FirstOrDefault()
                },
                Target = new {
                    DeviceId = c.TargetPort.Server.Id,
                    DeviceName = c.TargetPort.Server.Name,
                    PortName = c.TargetPort.PortName,
                    RackId = dbContext.ServerPositions
                        .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                        .Select(sp => (Guid?)sp.RackId).FirstOrDefault(),
                    RackCode = dbContext.ServerPositions
                        .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                        .Select(sp => sp.Rack.Code).FirstOrDefault()
                }
            })
            .ToListAsync(cancellationToken);

        return Ok(new { racks, devices, cables });
    }
}
```

## 编译验证

```bash
cd src/backend/Datacenter.Api && dotnet build
```

## Commit

```
feat: add GET /api/rooms/{roomId}/cable-scene endpoint
```
