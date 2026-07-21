using Datacenter.Api.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Datacenter.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/rooms")]
public sealed class RoomsController(RoomService service, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rooms = await service.GetAllAsync();
        return Ok(rooms);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var room = await service.GetByIdAsync(id);
        if (room is null)
        {
            return NotFound(new { error = "机房不存在" });
        }
        return Ok(room);
    }

    [HttpPost]
    [Authorize(Roles = "机房管理员,运维人员")]
    public async Task<IActionResult> Create([FromBody] CreateRoomRequest request)
    {
        if (!await HasValidAntiforgeryTokenAsync())
        {
            return BadRequest(new { error = "防伪令牌缺失或无效" });
        }

        var (room, error) = await service.CreateAsync(request.Name, request.Location, request.Notes);
        if (error is not null)
        {
            return BadRequest(new { error });
        }
        return CreatedAtAction(nameof(GetById), new { id = room!.Id }, room);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "机房管理员,运维人员")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRoomRequest request)
    {
        if (!await HasValidAntiforgeryTokenAsync())
        {
            return BadRequest(new { error = "防伪令牌缺失或无效" });
        }

        var (room, error) = await service.UpdateAsync(id, request.Name, request.Location, request.Notes);
        if (error is not null)
        {
            if (error == "机房不存在")
            {
                return NotFound(new { error });
            }
            return BadRequest(new { error });
        }
        return Ok(room);
    }

    private async Task<bool> HasValidAntiforgeryTokenAsync()
    {
        try
        {
            await antiforgery.ValidateRequestAsync(HttpContext);
            return true;
        }
        catch (AntiforgeryValidationException)
        {
            return false;
        }
    }
}

public sealed record CreateRoomRequest(string Name, string? Location, string? Notes);

public sealed record UpdateRoomRequest(string? Name, string? Location, string? Notes);
