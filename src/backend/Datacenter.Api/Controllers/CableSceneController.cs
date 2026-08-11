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

        // 机房内全部在架设备（CR-001：不再限定网络设备）
        var devices = await dbContext.ServerPositions
            .AsNoTracking()
            .Where(sp => rackIds.Contains(sp.RackId) && sp.Status == "在架")
            .Select(sp => new
            {
                DeviceId = sp.Server.Id,
                DeviceName = sp.Server.Name,
                sp.Server.DeviceType,
                OperationalStatus = sp.Server.OperationalStatus,
                RackId = sp.RackId,
                sp.StartU,
                sp.EndU
            })
            .ToListAsync(cancellationToken);

        var deviceIds = devices.Select(d => d.DeviceId).ToHashSet();

        // 两端设备均在当前机房内的线缆（跨机房线缆不可在本机房设备级画布渲染）
        var cables = await dbContext.Cables
            .AsNoTracking()
            .Where(c =>
                deviceIds.Contains(c.SourcePort.ServerId) &&
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
                    Speed = c.SourcePort.Speed,
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
                    Speed = c.TargetPort.Speed,
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
