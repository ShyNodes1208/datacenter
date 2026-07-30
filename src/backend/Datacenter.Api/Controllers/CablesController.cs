using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class CablesController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet("cables")]
    public async Task<IActionResult> List(
        [FromQuery] Guid? sourceRackId,
        [FromQuery] Guid? targetRackId,
        [FromQuery] Guid? roomId,
        [FromQuery] string? cableType,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Cables.AsNoTracking();

        if (sourceRackId.HasValue)
        {
            query = query.Where(c => dbContext.ServerPositions
                .Any(sp => sp.ServerId == c.SourcePort.ServerId && sp.RackId == sourceRackId.Value && sp.Status == "在架"));
        }
        if (targetRackId.HasValue)
        {
            query = query.Where(c => dbContext.ServerPositions
                .Any(sp => sp.ServerId == c.TargetPort.ServerId && sp.RackId == targetRackId.Value && sp.Status == "在架"));
        }
        if (roomId.HasValue)
        {
            query = query.Where(c => dbContext.ServerPositions
                .Any(sp => sp.ServerId == c.SourcePort.ServerId && sp.Rack.RoomId == roomId.Value && sp.Status == "在架")
                || dbContext.ServerPositions
                .Any(sp => sp.ServerId == c.TargetPort.ServerId && sp.Rack.RoomId == roomId.Value && sp.Status == "在架"));
        }
        if (!string.IsNullOrWhiteSpace(cableType))
        {
            query = query.Where(c => c.CableType == cableType);
        }

        var cables = await query
            .Select(c => new
            {
                c.Id,
                c.SourcePortId,
                SourcePortName = c.SourcePort.PortName,
                SourceServerName = c.SourcePort.Server.Name,
                SourceServerId = c.SourcePort.ServerId,
                SourceRackCode = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault(),
                SourceRackId = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.RackId)
                    .FirstOrDefault(),
                SourceRoomName = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Room.Name)
                    .FirstOrDefault(),
                c.TargetPortId,
                TargetPortName = c.TargetPort.PortName,
                TargetServerName = c.TargetPort.Server.Name,
                TargetServerId = c.TargetPort.ServerId,
                TargetRackCode = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault(),
                TargetRackId = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.RackId)
                    .FirstOrDefault(),
                TargetRoomName = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Room.Name)
                    .FirstOrDefault(),
                c.CableType,
                c.Color,
                c.Length,
                c.Notes
            })
            .ToListAsync(cancellationToken);

        return Ok(cables);
    }

    public sealed record CreateCableRequest(
        Guid SourcePortId, Guid TargetPortId, string CableType, string? Color, string? Length);

    [HttpPost("cables")]
    public async Task<IActionResult> Create(CreateCableRequest request, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        if (string.IsNullOrWhiteSpace(request.CableType))
            return BadRequest(new { error = "线缆类型不能为空" });

        var sourcePort = await dbContext.Ports.FindAsync([request.SourcePortId], cancellationToken);
        if (sourcePort is null)
            return BadRequest(new { error = "源端口不存在" });

        var targetPort = await dbContext.Ports.FindAsync([request.TargetPortId], cancellationToken);
        if (targetPort is null)
            return BadRequest(new { error = "目标端口不存在" });

        var sourceOccupied = await dbContext.Cables
            .AnyAsync(c => c.SourcePortId == request.SourcePortId || c.TargetPortId == request.SourcePortId, cancellationToken);
        if (sourceOccupied)
            return BadRequest(new { error = "源端口已被占用" });

        var targetOccupied = await dbContext.Cables
            .AnyAsync(c => c.SourcePortId == request.TargetPortId || c.TargetPortId == request.TargetPortId, cancellationToken);
        if (targetOccupied)
            return BadRequest(new { error = "目标端口已被占用" });

        var cable = new Cable
        {
            SourcePortId = request.SourcePortId,
            TargetPortId = request.TargetPortId,
            CableType = request.CableType.Trim(),
            Color = request.Color?.Trim(),
            Length = request.Length?.Trim()
        };
        dbContext.Cables.Add(cable);
        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(List), null, new { cable.Id, cable.SourcePortId, cable.TargetPortId, cable.CableType, cable.Color, cable.Length });
    }

    [HttpDelete("cables/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        var cable = await dbContext.Cables.FindAsync([id], cancellationToken);
        if (cable is null)
            return NotFound(new { error = "线缆不存在" });

        dbContext.Cables.Remove(cable);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpGet("rooms/{id:guid}/cables")]
    public async Task<IActionResult> RoomCables(Guid id, CancellationToken cancellationToken)
    {
        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == id, cancellationToken);
        if (!roomExists)
            return NotFound(new { error = "机房不存在" });

        var cables = await dbContext.Cables
            .AsNoTracking()
            .Where(c =>
                dbContext.ServerPositions.Any(sp => sp.ServerId == c.SourcePort.ServerId && sp.Rack.RoomId == id && sp.Status == "在架")
                && dbContext.ServerPositions.Any(sp => sp.ServerId == c.TargetPort.ServerId && sp.Rack.RoomId == id && sp.Status == "在架"))
            .Select(c => new
            {
                c.Id,
                c.CableType,
                c.Color,
                SourceRackId = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.RackId)
                    .FirstOrDefault(),
                SourceRackCode = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault(),
                SourceX = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.X)
                    .FirstOrDefault(),
                SourceY = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.SourcePort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Y)
                    .FirstOrDefault(),
                TargetRackId = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.RackId)
                    .FirstOrDefault(),
                TargetRackCode = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault(),
                TargetX = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.X)
                    .FirstOrDefault(),
                TargetY = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == c.TargetPort.ServerId && sp.Status == "在架")
                    .Select(sp => sp.Rack.Y)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        var links = cables
            .Where(c => c.SourceRackId != Guid.Empty && c.TargetRackId != Guid.Empty && c.SourceRackId != c.TargetRackId)
            .GroupBy(c => new
            {
                Rack1 = string.Compare(c.SourceRackCode, c.TargetRackCode, StringComparison.Ordinal) < 0
                    ? c.SourceRackCode : c.TargetRackCode,
                Rack2 = string.Compare(c.SourceRackCode, c.TargetRackCode, StringComparison.Ordinal) < 0
                    ? c.TargetRackCode : c.SourceRackCode,
            })
            .Select(g =>
            {
                var first = g.First();
                return new
                {
                    CableCount = g.Count(),
                    CableTypes = g.Select(c => c.CableType).Distinct().ToList(),
                    Source = new { RackId = first.SourceRackId, RackCode = first.SourceRackCode, X = first.SourceX, Y = first.SourceY },
                    Target = new { RackId = first.TargetRackId, RackCode = first.TargetRackCode, X = first.TargetX, Y = first.TargetY },
                };
            })
            .ToList();

        return Ok(new { links });
    }
}
