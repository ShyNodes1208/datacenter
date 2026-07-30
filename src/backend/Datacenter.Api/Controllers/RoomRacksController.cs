using Datacenter.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/rooms")]
public sealed class RoomRacksController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("{id:guid}/racks-summary")]
    public async Task<IActionResult> GetRacksSummary(Guid id, CancellationToken cancellationToken)
    {
        var room = await dbContext.Rooms
            .AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => new { r.Id, r.Name })
            .FirstOrDefaultAsync(cancellationToken);

        if (room is null)
            return NotFound(new { error = "机房不存在" });

        var racks = await dbContext.Racks
            .AsNoTracking()
            .Where(r => r.RoomId == id)
            .Select(r => new
            {
                r.Id,
                r.Code,
                r.HeightU,
                r.Brand
            })
            .ToListAsync(cancellationToken);

        var rackIds = racks.Select(r => r.Id).ToList();

        var serverPositions = await dbContext.ServerPositions
            .AsNoTracking()
            .Where(sp => rackIds.Contains(sp.RackId) && sp.Status == "在架")
            .Select(sp => new
            {
                sp.RackId,
                sp.StartU,
                sp.EndU,
                sp.ServerId,
                ServerName = sp.Server.Name,
                DeviceType = sp.Server.DeviceType,
                DeviceHeight = sp.Server.DeviceHeight
            })
            .ToListAsync(cancellationToken);

        var occupancyByRack = new Dictionary<Guid, Dictionary<int, (string ServerName, string DeviceType, int DeviceHeight)>>();
        foreach (var sp in serverPositions)
        {
            if (!occupancyByRack.ContainsKey(sp.RackId))
                occupancyByRack[sp.RackId] = new Dictionary<int, (string, string, int)>();

            for (var u = sp.StartU; u <= sp.EndU; u++)
            {
                occupancyByRack[sp.RackId][u] = (sp.ServerName, sp.DeviceType, sp.DeviceHeight);
            }
        }

        var result = racks.Select(rack =>
        {
            var positions = new List<object>();
            var occupiedCount = 0;
            var hasOccupancy = occupancyByRack.TryGetValue(rack.Id, out var occMap);

            for (var u = rack.HeightU; u >= 1; u--)
            {
                if (hasOccupancy && occMap!.TryGetValue(u, out var occ))
                {
                    occupiedCount++;
                    positions.Add(new
                    {
                        uNumber = u,
                        occupied = true,
                        serverName = occ.ServerName,
                        deviceType = occ.DeviceType,
                        deviceHeight = occ.DeviceHeight
                    });
                }
                else
                {
                    positions.Add(new { uNumber = u, occupied = false });
                }
            }

            return new
            {
                rack.Id,
                rack.Code,
                rack.HeightU,
                rack.Brand,
                occupiedU = occupiedCount,
                positions
            };
        }).ToList();

        return Ok(new
        {
            roomId = room.Id,
            roomName = room.Name,
            racks = result
        });
    }
}
