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
public sealed class PortsController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet("servers/{serverId:guid}/ports")]
    public async Task<IActionResult> List(Guid serverId, CancellationToken cancellationToken)
    {
        var serverExists = await dbContext.Servers.AnyAsync(s => s.Id == serverId, cancellationToken);
        if (!serverExists)
            return NotFound(new { error = "服务器不存在" });

        var ports = await dbContext.Ports
            .AsNoTracking()
            .Where(p => p.ServerId == serverId)
            .Select(p => new
            {
                p.Id,
                p.ServerId,
                p.PortName,
                p.PortType,
                p.Speed,
                p.Notes,
                ConnectedCableId = dbContext.Cables
                    .Where(c => c.SourcePortId == p.Id || c.TargetPortId == p.Id)
                    .Select(c => c.Id)
                    .FirstOrDefault(),
                ConnectedToPortName = dbContext.Cables
                    .Where(c => c.SourcePortId == p.Id)
                    .Select(c => c.TargetPort.PortName)
                    .FirstOrDefault()
                    ?? dbContext.Cables
                    .Where(c => c.TargetPortId == p.Id)
                    .Select(c => c.SourcePort.PortName)
                    .FirstOrDefault(),
                ConnectedToServerName = dbContext.Cables
                    .Where(c => c.SourcePortId == p.Id)
                    .Select(c => c.TargetPort.Server.Name)
                    .FirstOrDefault()
                    ?? dbContext.Cables
                    .Where(c => c.TargetPortId == p.Id)
                    .Select(c => c.SourcePort.Server.Name)
                    .FirstOrDefault(),
                ConnectedToServerId = dbContext.Cables
                    .Where(c => c.SourcePortId == p.Id)
                    .Select(c => (Guid?)c.TargetPort.ServerId)
                    .FirstOrDefault()
                    ?? dbContext.Cables
                    .Where(c => c.TargetPortId == p.Id)
                    .Select(c => (Guid?)c.SourcePort.ServerId)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        return Ok(ports);
    }

    public sealed record CreatePortRequest(string PortName, string PortType, string? Speed, string? Notes);

    [HttpPost("servers/{serverId:guid}/ports")]
    public async Task<IActionResult> Create(Guid serverId, CreatePortRequest request, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        var serverExists = await dbContext.Servers.AnyAsync(s => s.Id == serverId, cancellationToken);
        if (!serverExists)
            return NotFound(new { error = "服务器不存在" });

        var portName = request.PortName?.Trim();
        if (string.IsNullOrWhiteSpace(portName))
            return BadRequest(new { error = "端口名称不能为空" });

        if (string.IsNullOrWhiteSpace(request.PortType))
            return BadRequest(new { error = "端口类型不能为空" });

        var duplicate = await dbContext.Ports
            .AnyAsync(p => p.ServerId == serverId && p.PortName == portName, cancellationToken);
        if (duplicate)
            return BadRequest(new { error = "端口名称已存在" });

        var port = new Port
        {
            ServerId = serverId,
            PortName = portName,
            PortType = request.PortType.Trim(),
            Speed = request.Speed?.Trim(),
            Notes = request.Notes?.Trim()
        };
        dbContext.Ports.Add(port);
        await dbContext.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(List), new { serverId }, new { port.Id, port.ServerId, port.PortName, port.PortType, port.Speed, port.Notes });
    }

    public sealed record UpdatePortRequest(string PortName, string PortType, string? Speed, string? Notes);

    [HttpPut("ports/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdatePortRequest request, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        var port = await dbContext.Ports.FindAsync([id], cancellationToken);
        if (port is null)
            return NotFound(new { error = "端口不存在" });

        var portName = request.PortName?.Trim();
        if (string.IsNullOrWhiteSpace(portName))
            return BadRequest(new { error = "端口名称不能为空" });

        if (string.IsNullOrWhiteSpace(request.PortType))
            return BadRequest(new { error = "端口类型不能为空" });

        var duplicate = await dbContext.Ports
            .AnyAsync(p => p.ServerId == port.ServerId && p.PortName == portName && p.Id != id, cancellationToken);
        if (duplicate)
            return BadRequest(new { error = "端口名称已存在" });

        port.PortName = portName;
        port.PortType = request.PortType.Trim();
        port.Speed = request.Speed?.Trim();
        port.Notes = request.Notes?.Trim();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { port.Id, port.ServerId, port.PortName, port.PortType, port.Speed, port.Notes });
    }

    [HttpDelete("ports/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        var port = await dbContext.Ports.FindAsync([id], cancellationToken);
        if (port is null)
            return NotFound(new { error = "端口不存在" });

        var hasCable = await dbContext.Cables
            .AnyAsync(c => c.SourcePortId == id || c.TargetPortId == id, cancellationToken);
        if (hasCable)
            return BadRequest(new { error = "端口已连接线缆，请先删除线缆" });

        dbContext.Ports.Remove(port);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
