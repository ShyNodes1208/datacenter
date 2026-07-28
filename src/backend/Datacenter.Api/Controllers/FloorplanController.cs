using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/rooms/{roomId:guid}/floorplan-elements")]
public sealed class FloorplanController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(Guid roomId, CancellationToken cancellationToken)
    {
        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == roomId, cancellationToken);
        if (!roomExists) return NotFound(new { error = "机房不存在" });

        var walls = await dbContext.Walls.AsNoTracking()
            .Where(w => w.RoomId == roomId)
            .Select(w => new { w.Id, w.RoomId, w.X1, w.Y1, w.X2, w.Y2, w.Color, w.Thickness, Type = "wall" })
            .ToListAsync(cancellationToken);

        var zones = await dbContext.Zones.AsNoTracking()
            .Where(z => z.RoomId == roomId)
            .Select(z => new { z.Id, z.RoomId, z.X, z.Y, z.Width, z.Height, z.Name, z.Color, z.ZoneType, Type = "zone" })
            .ToListAsync(cancellationToken);

        var labels = await dbContext.FloorplanLabels.AsNoTracking()
            .Where(l => l.RoomId == roomId)
            .Select(l => new { l.Id, l.RoomId, l.X, l.Y, l.Text, l.FontSize, l.Color, Type = "label" })
            .ToListAsync(cancellationToken);

        return Ok(new { walls, zones, labels });
    }

    public sealed record CreateWallRequest(double X1, double Y1, double X2, double Y2, string? Color, int? Thickness);
    public sealed record UpdateWallRequest(double X1, double Y1, double X2, double Y2, string? Color, int? Thickness);

    [HttpPost("walls")]
    public async Task<IActionResult> CreateWall(Guid roomId, CreateWallRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == roomId, cancellationToken);
        if (!roomExists) return NotFound(new { error = "机房不存在" });

        var wall = new Wall
        {
            RoomId = roomId,
            X1 = request.X1, Y1 = request.Y1,
            X2 = request.X2, Y2 = request.Y2,
            Color = request.Color ?? "#333333",
            Thickness = request.Thickness ?? 3,
        };
        dbContext.Walls.Add(wall);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Created(string.Empty, new { wall.Id, wall.RoomId, wall.X1, wall.Y1, wall.X2, wall.Y2, wall.Color, wall.Thickness, Type = "wall" });
    }

    [HttpPut("walls/{id:guid}")]
    public async Task<IActionResult> UpdateWall(Guid roomId, Guid id, UpdateWallRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var wall = await dbContext.Walls.FirstOrDefaultAsync(w => w.Id == id && w.RoomId == roomId, cancellationToken);
        if (wall is null) return NotFound(new { error = "墙体不存在" });

        wall.X1 = request.X1; wall.Y1 = request.Y1;
        wall.X2 = request.X2; wall.Y2 = request.Y2;
        wall.Color = request.Color ?? wall.Color;
        wall.Thickness = request.Thickness ?? wall.Thickness;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { wall.Id, wall.RoomId, wall.X1, wall.Y1, wall.X2, wall.Y2, wall.Color, wall.Thickness, Type = "wall" });
    }

    [HttpDelete("walls/{id:guid}")]
    public async Task<IActionResult> DeleteWall(Guid roomId, Guid id, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var wall = await dbContext.Walls.FirstOrDefaultAsync(w => w.Id == id && w.RoomId == roomId, cancellationToken);
        if (wall is null) return NotFound(new { error = "墙体不存在" });

        dbContext.Walls.Remove(wall);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    public sealed record CreateZoneRequest(double X, double Y, double Width, double Height, string Name, string? Color, string ZoneType);
    public sealed record UpdateZoneRequest(double X, double Y, double Width, double Height, string Name, string? Color, string ZoneType);

    [HttpPost("zones")]
    public async Task<IActionResult> CreateZone(Guid roomId, CreateZoneRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == roomId, cancellationToken);
        if (!roomExists) return NotFound(new { error = "机房不存在" });

        var zone = new Zone
        {
            RoomId = roomId,
            X = request.X, Y = request.Y,
            Width = request.Width, Height = request.Height,
            Name = request.Name,
            Color = request.Color ?? "rgba(100,149,237,0.15)",
            ZoneType = request.ZoneType,
        };
        dbContext.Zones.Add(zone);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Created(string.Empty, new { zone.Id, zone.RoomId, zone.X, zone.Y, zone.Width, zone.Height, zone.Name, zone.Color, zone.ZoneType, Type = "zone" });
    }

    [HttpPut("zones/{id:guid}")]
    public async Task<IActionResult> UpdateZone(Guid roomId, Guid id, UpdateZoneRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var zone = await dbContext.Zones.FirstOrDefaultAsync(z => z.Id == id && z.RoomId == roomId, cancellationToken);
        if (zone is null) return NotFound(new { error = "区域不存在" });

        zone.X = request.X; zone.Y = request.Y;
        zone.Width = request.Width; zone.Height = request.Height;
        zone.Name = request.Name;
        zone.Color = request.Color ?? zone.Color;
        zone.ZoneType = request.ZoneType;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { zone.Id, zone.RoomId, zone.X, zone.Y, zone.Width, zone.Height, zone.Name, zone.Color, zone.ZoneType, Type = "zone" });
    }

    [HttpDelete("zones/{id:guid}")]
    public async Task<IActionResult> DeleteZone(Guid roomId, Guid id, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var zone = await dbContext.Zones.FirstOrDefaultAsync(z => z.Id == id && z.RoomId == roomId, cancellationToken);
        if (zone is null) return NotFound(new { error = "区域不存在" });

        dbContext.Zones.Remove(zone);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    public sealed record CreateLabelRequest(double X, double Y, string Text, int? FontSize, string? Color);
    public sealed record UpdateLabelRequest(double X, double Y, string Text, int? FontSize, string? Color);

    [HttpPost("labels")]
    public async Task<IActionResult> CreateLabel(Guid roomId, CreateLabelRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var roomExists = await dbContext.Rooms.AnyAsync(r => r.Id == roomId, cancellationToken);
        if (!roomExists) return NotFound(new { error = "机房不存在" });

        var label = new FloorplanLabel
        {
            RoomId = roomId,
            X = request.X, Y = request.Y,
            Text = request.Text,
            FontSize = request.FontSize ?? 14,
            Color = request.Color ?? "#666666",
        };
        dbContext.FloorplanLabels.Add(label);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Created(string.Empty, new { label.Id, label.RoomId, label.X, label.Y, label.Text, label.FontSize, label.Color, Type = "label" });
    }

    [HttpPut("labels/{id:guid}")]
    public async Task<IActionResult> UpdateLabel(Guid roomId, Guid id, UpdateLabelRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var label = await dbContext.FloorplanLabels.FirstOrDefaultAsync(l => l.Id == id && l.RoomId == roomId, cancellationToken);
        if (label is null) return NotFound(new { error = "标签不存在" });

        label.X = request.X; label.Y = request.Y;
        label.Text = request.Text;
        label.FontSize = request.FontSize ?? label.FontSize;
        label.Color = request.Color ?? label.Color;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { label.Id, label.RoomId, label.X, label.Y, label.Text, label.FontSize, label.Color, Type = "label" });
    }

    [HttpDelete("labels/{id:guid}")]
    public async Task<IActionResult> DeleteLabel(Guid roomId, Guid id, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null) return antiforgeryError;

        var label = await dbContext.FloorplanLabels.FirstOrDefaultAsync(l => l.Id == id && l.RoomId == roomId, cancellationToken);
        if (label is null) return NotFound(new { error = "标签不存在" });

        dbContext.FloorplanLabels.Remove(label);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<BadRequestObjectResult?> ValidateAntiforgeryAsync()
    {
        try
        {
            await antiforgery.ValidateRequestAsync(HttpContext);
            return null;
        }
        catch (AntiforgeryValidationException)
        {
            return BadRequest(new { error = "防伪令牌缺失或无效" });
        }
    }
}
