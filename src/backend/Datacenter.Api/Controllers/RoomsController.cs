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
            .Select(room => new { room.Id, room.Name, room.Status })
            .ToListAsync(cancellationToken);

        return Ok(rooms);
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

        var room = new Room { Name = name, Status = request.Status };
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

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsRoomNameUniqueConstraintViolation(exception))
        {
            return Conflict(new { error = "机房名称已存在" });
        }

        return Ok(new { room.Id, room.Name, room.Status });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
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

        if (await dbContext.Racks.AnyAsync(rack => rack.RoomId == id, cancellationToken))
        {
            return Conflict(new { error = "机房中存在机柜，不能删除" });
        }

        dbContext.Rooms.Remove(room);
        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private static bool IsRoomNameUniqueConstraintViolation(DbUpdateException exception) =>
        exception.InnerException is SqliteException
        {
            SqliteErrorCode: 19,
            SqliteExtendedErrorCode: 2067
        } sqliteException
        && sqliteException.Message.Contains("UNIQUE constraint failed: Rooms.Name", StringComparison.Ordinal);
}

public sealed record CreateRoomRequest(string? Name, string? Status);

public sealed record UpdateRoomRequest(string? Name, string? Status);
