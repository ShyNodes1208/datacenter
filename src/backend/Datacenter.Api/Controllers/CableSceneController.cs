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
            .Select(r => new
            {
                RackId = r.Id,
                r.Code,
                r.X,
                r.Y,
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
            .Select(sp => new
            {
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
            .Select(c => new
            {
                CableId = c.Id,
                c.CableType,
                c.Purpose,
                Source = new
                {
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
                Target = new
                {
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
