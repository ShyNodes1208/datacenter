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
[Route("api/servers")]
public sealed class ServersController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? name,
        [FromQuery] string? ip,
        [FromQuery] string? assetNumber,
        [FromQuery] string? positionStatus,
        [FromQuery] string? operationalStatus,
        [FromQuery] string? system,
        CancellationToken cancellationToken)
    {
        IQueryable<Server> query = dbContext.Servers.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(server => EF.Functions.Like(server.Name, $"%{name.Trim()}%"));
        }

        if (!string.IsNullOrWhiteSpace(ip))
        {
            query = query.Where(server => EF.Functions.Like(server.ManagementIP, $"%{ip.Trim()}%"));
        }

        if (!string.IsNullOrWhiteSpace(assetNumber))
        {
            query = query.Where(server => server.AssetNumber == assetNumber.Trim());
        }

        if (!string.IsNullOrWhiteSpace(positionStatus))
        {
            query = query.Where(server => server.PositionStatus == positionStatus.Trim());
        }

        if (!string.IsNullOrWhiteSpace(operationalStatus))
        {
            query = query.Where(server => server.OperationalStatus == operationalStatus.Trim());
        }

        if (!string.IsNullOrWhiteSpace(system))
        {
            query = query.Where(server => EF.Functions.Like(server.System, $"%{system.Trim()}%"));
        }

        var servers = await query
            .Select(server => new
            {
                server.Id,
                server.Name,
                server.ManagementIP,
                server.AssetNumber,
                server.DeviceType,
                server.DeviceHeight,
                server.OperationalStatus,
                server.PositionStatus,
                server.System,
                server.Owner,
                server.Notes
            })
            .ToListAsync(cancellationToken);

        return Ok(servers);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var server = await dbContext.Servers
            .AsNoTracking()
            .Select(item => new
            {
                item.Id,
                item.Name,
                item.ManagementIP,
                item.AssetNumber,
                item.DeviceType,
                item.DeviceHeight,
                item.OperationalStatus,
                item.PositionStatus,
                item.System,
                item.Owner,
                item.Notes
            })
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (server is null)
        {
            return NotFound(new { error = "服务器不存在" });
        }

        return Ok(server);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateServerRequest request, CancellationToken cancellationToken)
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

        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { error = "服务器名称不能为空" });
        }

        var managementIP = request.ManagementIP?.Trim();
        if (string.IsNullOrWhiteSpace(managementIP))
        {
            return BadRequest(new { error = "管理IP不能为空" });
        }

        if (string.IsNullOrWhiteSpace(request.DeviceType))
        {
            return BadRequest(new { error = "设备类型不能为空" });
        }

        if (request.DeviceHeight < 1)
        {
            return BadRequest(new { error = "设备高度必须大于等于1" });
        }

        if (request.OperationalStatus is not (null or "正常" or "异常" or "维护"))
        {
            return BadRequest(new { error = "运行状态值无效" });
        }

        if (request.PositionStatus is not (null or "未上架" or "在架" or "已下架"))
        {
            return BadRequest(new { error = "位置状态值无效" });
        }

        if (await dbContext.Servers.AnyAsync(server => server.Name == name, cancellationToken))
        {
            return Conflict(new { error = "服务器名称已存在" });
        }

        if (await dbContext.Servers.AnyAsync(server => server.ManagementIP == managementIP, cancellationToken))
        {
            return Conflict(new { error = "管理IP已存在" });
        }

        var assetNumber = request.AssetNumber?.Trim();
        if (!string.IsNullOrWhiteSpace(assetNumber))
        {
            if (await dbContext.Servers.AnyAsync(server => server.AssetNumber == assetNumber, cancellationToken))
            {
                return Conflict(new { error = "资产编号已存在" });
            }
        }

        var server = new Server
        {
            Name = name,
            ManagementIP = managementIP,
            AssetNumber = string.IsNullOrWhiteSpace(assetNumber) ? null : assetNumber,
            DeviceType = request.DeviceType.Trim(),
            DeviceHeight = request.DeviceHeight,
            OperationalStatus = request.OperationalStatus ?? "正常",
            PositionStatus = request.PositionStatus ?? "未上架",
            System = request.System?.Trim(),
            Owner = request.Owner?.Trim(),
            Notes = request.Notes?.Trim()
        };

        dbContext.Servers.Add(server);
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsServerUniqueConstraintViolation(exception))
        {
            return Conflict(new { error = "服务器名称或管理IP已存在" });
        }

        return StatusCode(StatusCodes.Status201Created, new
        {
            server.Id,
            server.Name,
            server.ManagementIP,
            server.AssetNumber,
            server.DeviceType,
            server.DeviceHeight,
            server.OperationalStatus,
            server.PositionStatus,
            server.System,
            server.Owner,
            server.Notes
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateServerRequest request, CancellationToken cancellationToken)
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

        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { error = "服务器名称不能为空" });
        }

        var managementIP = request.ManagementIP?.Trim();
        if (string.IsNullOrWhiteSpace(managementIP))
        {
            return BadRequest(new { error = "管理IP不能为空" });
        }

        if (string.IsNullOrWhiteSpace(request.DeviceType))
        {
            return BadRequest(new { error = "设备类型不能为空" });
        }

        if (request.DeviceHeight < 1)
        {
            return BadRequest(new { error = "设备高度必须大于等于1" });
        }

        if (request.OperationalStatus is not (null or "正常" or "异常" or "维护"))
        {
            return BadRequest(new { error = "运行状态值无效" });
        }

        if (request.PositionStatus is not (null or "未上架" or "在架" or "已下架"))
        {
            return BadRequest(new { error = "位置状态值无效" });
        }

        var server = await dbContext.Servers.FindAsync(new object[] { id }, cancellationToken);
        if (server is null)
        {
            return NotFound(new { error = "服务器不存在" });
        }

        if (await dbContext.Servers.AnyAsync(item => item.Name == name && item.Id != id, cancellationToken))
        {
            return Conflict(new { error = "服务器名称已存在" });
        }

        if (await dbContext.Servers.AnyAsync(item => item.ManagementIP == managementIP && item.Id != id, cancellationToken))
        {
            return Conflict(new { error = "管理IP已存在" });
        }

        var assetNumber = request.AssetNumber?.Trim();
        if (!string.IsNullOrWhiteSpace(assetNumber))
        {
            if (await dbContext.Servers.AnyAsync(item => item.AssetNumber == assetNumber && item.Id != id, cancellationToken))
            {
                return Conflict(new { error = "资产编号已存在" });
            }
        }

        server.Name = name;
        server.ManagementIP = managementIP;
        server.AssetNumber = string.IsNullOrWhiteSpace(assetNumber) ? null : assetNumber;
        server.DeviceType = request.DeviceType.Trim();
        server.DeviceHeight = request.DeviceHeight;
        server.OperationalStatus = request.OperationalStatus ?? server.OperationalStatus;
        server.System = request.System?.Trim();
        server.Owner = request.Owner?.Trim();
        server.Notes = request.Notes?.Trim();

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsServerUniqueConstraintViolation(exception))
        {
            return Conflict(new { error = "服务器名称或管理IP已存在" });
        }

        return Ok(new
        {
            server.Id,
            server.Name,
            server.ManagementIP,
            server.AssetNumber,
            server.DeviceType,
            server.DeviceHeight,
            server.OperationalStatus,
            server.PositionStatus,
            server.System,
            server.Owner,
            server.Notes
        });
    }

    private static bool IsServerUniqueConstraintViolation(DbUpdateException exception) =>
        exception.InnerException is SqliteException
        {
            SqliteErrorCode: 19,
            SqliteExtendedErrorCode: 2067
        } sqliteException
        && (sqliteException.Message.Contains("UNIQUE constraint failed: Servers.Name", StringComparison.Ordinal)
            || sqliteException.Message.Contains("UNIQUE constraint failed: Servers.ManagementIP", StringComparison.Ordinal)
            || sqliteException.Message.Contains("UNIQUE constraint failed: Servers.AssetNumber", StringComparison.Ordinal));
}

public sealed record CreateServerRequest(
    string? Name,
    string? ManagementIP,
    string? AssetNumber,
    string? DeviceType,
    int DeviceHeight,
    string? OperationalStatus,
    string? PositionStatus,
    string? System,
    string? Owner,
    string? Notes);

public sealed record UpdateServerRequest(
    string? Name,
    string? ManagementIP,
    string? AssetNumber,
    string? DeviceType,
    int DeviceHeight,
    string? OperationalStatus,
    string? PositionStatus,
    string? System,
    string? Owner,
    string? Notes);
