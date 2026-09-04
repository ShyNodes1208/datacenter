using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/rooms")]
public sealed class RoomsController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var rooms = await dbContext.Rooms
            .AsNoTracking()
            .Select(room => new
            {
                room.Id,
                room.Name,
                room.Status,
                room.Location,
                room.TopologyX,
                room.TopologyY,
                RackCount = dbContext.Racks.Count(rack => rack.RoomId == room.Id)
            })
            .ToListAsync(cancellationToken);

        return Ok(rooms);
    }

    [HttpGet("topology")]
    public async Task<IActionResult> GetTopology([FromQuery] Guid? roomId, CancellationToken cancellationToken)
    {
        if (roomId is Guid requestedRoomId)
        {
            var exists = await dbContext.Rooms.AnyAsync(room => room.Id == requestedRoomId, cancellationToken);
            if (!exists)
            {
                return NotFound(new { error = "机房不存在" });
            }
        }

        var rooms = await dbContext.Rooms
            .AsNoTracking()
            .Select(room => new TopologyRoomDto(
                room.Id,
                room.Name,
                room.Status,
                room.Location,
                room.TopologyX,
                room.TopologyY,
                dbContext.Racks.Count(rack => rack.RoomId == room.Id),
                dbContext.ServerPositions.Count(sp => sp.Rack.RoomId == room.Id && sp.Status == "在架"),
                0))
            .ToListAsync(cancellationToken);

        var placements = await dbContext.ServerPositions
            .AsNoTracking()
            .Where(sp => sp.Status == "在架")
            .Select(sp => new
            {
                sp.ServerId,
                sp.RackId,
                RoomId = sp.Rack.RoomId,
                RackCode = sp.Rack.Code
            })
            .ToListAsync(cancellationToken);

        var placementByServer = placements
            .GroupBy(item => item.ServerId)
            .ToDictionary(group => group.Key, group => group.First());

        var cables = await dbContext.Cables
            .AsNoTracking()
            .Select(cable => new
            {
                cable.Id,
                cable.CableType,
                cable.Purpose,
                cable.Status,
                SourceServerId = cable.SourcePort.ServerId,
                TargetServerId = cable.TargetPort.ServerId,
                SourcePortName = cable.SourcePort.PortName,
                TargetPortName = cable.TargetPort.PortName,
                SourceDeviceName = cable.SourcePort.Server.Name,
                TargetDeviceName = cable.TargetPort.Server.Name
            })
            .ToListAsync(cancellationToken);

        var cableCountByRoom = rooms.ToDictionary(room => room.Id, _ => 0);
        var roomBundles = new Dictionary<(Guid Source, Guid Target, string CableType, string Purpose, string Status), TopologyBundleAccumulator>();
        var rackBundles = new Dictionary<(Guid Source, Guid Target), TopologyBundleAccumulator>();

        foreach (var cable in cables)
        {
            if (!placementByServer.TryGetValue(cable.SourceServerId, out var sourcePlacement)
                || !placementByServer.TryGetValue(cable.TargetServerId, out var targetPlacement))
            {
                continue;
            }

            if (cableCountByRoom.ContainsKey(sourcePlacement.RoomId))
            {
                cableCountByRoom[sourcePlacement.RoomId]++;
            }

            if (sourcePlacement.RoomId != targetPlacement.RoomId
                && cableCountByRoom.ContainsKey(targetPlacement.RoomId))
            {
                cableCountByRoom[targetPlacement.RoomId]++;
            }

            if (roomId is null)
            {
                if (sourcePlacement.RoomId == targetPlacement.RoomId)
                {
                    continue;
                }

                var ordered = OrderPair(sourcePlacement.RoomId, targetPlacement.RoomId);
                var bundleKey = (ordered.Source, ordered.Target, cable.CableType, cable.Purpose, cable.Status);
                AccumulateBundle(roomBundles, bundleKey, cable.CableType, new TopologyCableDetailDto(
                    cable.Id,
                    cable.CableType,
                    cable.SourceDeviceName,
                    cable.SourcePortName,
                    cable.TargetDeviceName,
                    cable.TargetPortName));
                continue;
            }

            if (sourcePlacement.RoomId != roomId.Value || targetPlacement.RoomId != roomId.Value)
            {
                continue;
            }

            if (sourcePlacement.RackId == targetPlacement.RackId)
            {
                continue;
            }

            var rackOrdered = OrderPair(sourcePlacement.RackId, targetPlacement.RackId);
            AccumulateBundle(rackBundles, rackOrdered, cable.CableType, new TopologyCableDetailDto(
                cable.Id,
                cable.CableType,
                cable.SourceDeviceName,
                cable.SourcePortName,
                cable.TargetDeviceName,
                cable.TargetPortName));
        }

        var roomsWithCounts = rooms
            .Select(room => room with { CableCount = cableCountByRoom[room.Id] })
            .ToList();

        if (roomId is null)
        {
            var connections = roomBundles
                .Select(pair => new TopologyRoomConnectionDto(
                    pair.Key.Source,
                    pair.Key.Target,
                    pair.Value.CableCount,
                    pair.Key.CableType,
                    pair.Key.Purpose,
                    pair.Key.Status,
                    pair.Value.OrderedTypes,
                    pair.Value.Cables))
                .ToList();

            return Ok(new { rooms = roomsWithCounts, connections });
        }

        var racks = await dbContext.Racks
            .AsNoTracking()
            .Where(rack => rack.RoomId == roomId.Value)
            .Select(rack => new
            {
                rack.Id,
                rack.Code,
                rack.X,
                rack.Y
            })
            .ToListAsync(cancellationToken);

        var rackConnections = rackBundles
            .Select(pair => new TopologyRackConnectionDto(
                pair.Key.Source,
                pair.Key.Target,
                pair.Value.CableCount,
                pair.Value.OrderedTypes,
                pair.Value.Cables))
            .ToList();

        return Ok(new { rooms = roomsWithCounts, racks, connections = rackConnections });
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateRoomRequest request, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator))
        {
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        try
        {
            await antiforgery.ValidateRequestAsync(HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            return BadRequest(new { error = "防伪令牌缺失或无效" });
        }

        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { error = "机房名称不能为空" });
        }

        if (request.Status is not ("启用" or "停用"))
        {
            return BadRequest(new { error = "状态值无效" });
        }

        if (await dbContext.Rooms.AnyAsync(room => room.Name == name, cancellationToken))
        {
            return Conflict(new { error = "机房名称已存在" });
        }

        var room = new Room
        {
            Name = name,
            Status = request.Status,
            Location = request.Location,
            TopologyX = request.TopologyX ?? 0,
            TopologyY = request.TopologyY ?? 0
        };
        dbContext.Rooms.Add(room);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsRoomNameUniqueConstraintViolation(exception))
        {
            return Conflict(new { error = "机房名称已存在" });
        }

        return StatusCode(StatusCodes.Status201Created, new { room.Name, room.Status });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateRoomRequest request, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator))
        {
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        try
        {
            await antiforgery.ValidateRequestAsync(HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            return BadRequest(new { error = "防伪令牌缺失或无效" });
        }

        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { error = "机房名称不能为空" });
        }

        if (request.Status is not ("启用" or "停用"))
        {
            return BadRequest(new { error = "状态值无效" });
        }

        var room = await dbContext.Rooms.FindAsync(new object[] { id }, cancellationToken);
        if (room is null)
        {
            return NotFound(new { error = "机房不存在" });
        }

        if (await dbContext.Rooms.AnyAsync(r => r.Name == name && r.Id != id, cancellationToken))
        {
            return Conflict(new { error = "机房名称已存在" });
        }

        room.Name = name;
        room.Status = request.Status;
        room.Location = request.Location ?? room.Location;
        if (request.TopologyX is double topologyX)
        {
            room.TopologyX = topologyX;
        }

        if (request.TopologyY is double topologyY)
        {
            room.TopologyY = topologyY;
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsRoomNameUniqueConstraintViolation(exception))
        {
            return Conflict(new { error = "机房名称已存在" });
        }

        return Ok(new
        {
            room.Id,
            room.Name,
            room.Status,
            room.Location,
            room.TopologyX,
            room.TopologyY
        });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(
        Guid id,
        [FromQuery] bool force = false,
        CancellationToken cancellationToken = default)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
        {
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        try
        {
            await antiforgery.ValidateRequestAsync(HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            return BadRequest(new { error = "防伪令牌缺失或无效" });
        }

        var room = await dbContext.Rooms.FindAsync([id], cancellationToken);
        if (room is null)
        {
            return NotFound(new { error = "机房不存在" });
        }

        if (!force)
        {
            if (await dbContext.Racks.AnyAsync(rack => rack.RoomId == id, cancellationToken))
            {
                return Conflict(new { error = "机房中存在机柜，不能删除" });
            }

            dbContext.Rooms.Remove(room);
            await dbContext.SaveChangesAsync(cancellationToken);
            return NoContent();
        }

        var rackIds = await dbContext.Racks
            .Where(rack => rack.RoomId == id)
            .Select(rack => rack.Id)
            .ToListAsync(cancellationToken);

        var serverIds = await dbContext.ServerPositions
            .Where(position => rackIds.Contains(position.RackId))
            .Select(position => position.ServerId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var portIds = await dbContext.Ports
            .Where(port => serverIds.Contains(port.ServerId))
            .Select(port => port.Id)
            .ToListAsync(cancellationToken);

        dbContext.Cables.RemoveRange(
            dbContext.Cables.Where(cable =>
                portIds.Contains(cable.SourcePortId) || portIds.Contains(cable.TargetPortId)));
        dbContext.Ports.RemoveRange(
            dbContext.Ports.Where(port => serverIds.Contains(port.ServerId)));
        dbContext.AuditRecords.RemoveRange(
            dbContext.AuditRecords.Where(record => serverIds.Contains(record.ServerId)));
        dbContext.ServerPositions.RemoveRange(
            dbContext.ServerPositions.Where(position =>
                rackIds.Contains(position.RackId) || serverIds.Contains(position.ServerId)));
        dbContext.Servers.RemoveRange(
            dbContext.Servers.Where(server => serverIds.Contains(server.Id)));
        dbContext.DevicePositions.RemoveRange(
            dbContext.DevicePositions.Where(position => rackIds.Contains(position.RackId)));
        dbContext.Racks.RemoveRange(
            dbContext.Racks.Where(rack => rack.RoomId == id));
        dbContext.Rooms.Remove(room);
        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private static (Guid Source, Guid Target) OrderPair(Guid left, Guid right) =>
        left.CompareTo(right) <= 0 ? (left, right) : (right, left);

    private static void AccumulateBundle<TKey>(
        Dictionary<TKey, TopologyBundleAccumulator> bundles,
        TKey key,
        string cableType,
        TopologyCableDetailDto detail)
        where TKey : notnull
    {
        if (!bundles.TryGetValue(key, out var accumulator))
        {
            accumulator = new TopologyBundleAccumulator();
            bundles[key] = accumulator;
        }

        accumulator.CableCount++;
        accumulator.TypeCounts[cableType] = accumulator.TypeCounts.GetValueOrDefault(cableType) + 1;
        accumulator.Cables.Add(detail);
    }

    private static bool IsRoomNameUniqueConstraintViolation(DbUpdateException exception) =>
        exception.InnerException is SqliteException
        {
            SqliteErrorCode: 19,
            SqliteExtendedErrorCode: 2067
        } sqliteException
        && sqliteException.Message.Contains("UNIQUE constraint failed: Rooms.Name", StringComparison.Ordinal);

    private sealed class TopologyBundleAccumulator
    {
        public int CableCount { get; set; }

        public Dictionary<string, int> TypeCounts { get; } = new(StringComparer.Ordinal);

        public List<TopologyCableDetailDto> Cables { get; } = [];

        public string[] OrderedTypes => TypeCounts
            .OrderByDescending(pair => pair.Value)
            .ThenBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => pair.Key)
            .ToArray();
    }
}

public sealed record CreateRoomRequest(
    string? Name,
    string? Status,
    string? Location = null,
    double? TopologyX = null,
    double? TopologyY = null);

public sealed record UpdateRoomRequest(
    string? Name,
    string? Status,
    string? Location = null,
    double? TopologyX = null,
    double? TopologyY = null);

public sealed record TopologyRoomDto(
    Guid Id,
    string Name,
    string Status,
    string? Location,
    double TopologyX,
    double TopologyY,
    int RackCount,
    int ServerCount,
    int CableCount);

public sealed record TopologyCableDetailDto(
    Guid CableId,
    string CableType,
    string SourceDevice,
    string SourcePort,
    string TargetDevice,
    string TargetPort);

public sealed record TopologyRoomConnectionDto(
    Guid SourceRoomId,
    Guid TargetRoomId,
    int CableCount,
    string CableType,
    string Purpose,
    string Status,
    string[] Types,
    IReadOnlyList<TopologyCableDetailDto> Cables);

public sealed record TopologyRackConnectionDto(
    Guid SourceRackId,
    Guid TargetRackId,
    int CableCount,
    string[] Types,
    IReadOnlyList<TopologyCableDetailDto> Cables);
