using ClosedXML.Excel;
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Datacenter.Api.Services;
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
                server.Notes,
                RackCode = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == server.Id && sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault()
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
                item.Notes,
                RoomName = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == item.Id && sp.Status == "在架")
                    .Select(sp => sp.Rack.Room.Name)
                    .FirstOrDefault(),
                RoomId = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == item.Id && sp.Status == "在架")
                    .Select(sp => sp.Rack.RoomId)
                    .FirstOrDefault(),
                RackCode = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == item.Id && sp.Status == "在架")
                    .Select(sp => sp.Rack.Code)
                    .FirstOrDefault(),
                RackId = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == item.Id && sp.Status == "在架")
                    .Select(sp => sp.RackId)
                    .FirstOrDefault(),
                URange = dbContext.ServerPositions
                    .Where(sp => sp.ServerId == item.Id && sp.Status == "在架")
                    .Select(sp => sp.StartU + "-" + sp.EndU)
                    .FirstOrDefault()
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

    [HttpPost("{id:guid}/rack")]
    public async Task<IActionResult> Rack(Guid id, RackServerRequest request, CancellationToken cancellationToken)
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

        if (request.StartU < 1)
        {
            return BadRequest(new { error = "起始U位必须大于等于1" });
        }

        var server = await dbContext.Servers.FindAsync(new object[] { id }, cancellationToken);
        if (server is null)
        {
            return NotFound(new { error = "服务器不存在" });
        }

        if (server.PositionStatus is not ("未上架" or "已下架"))
        {
            return BadRequest(new { error = "服务器已在架，不能重复上架" });
        }

        var rack = await dbContext.Racks
            .Include(item => item.Room)
            .FirstOrDefaultAsync(item => item.Id == request.RackId, cancellationToken);

        if (rack is null)
        {
            return NotFound(new { error = "机柜不存在" });
        }

        if (rack.Room.Status != "启用")
        {
            return BadRequest(new { error = "目标机柜所在机房未启用" });
        }

        if (rack.Status != "启用")
        {
            return BadRequest(new { error = "机柜已停用" });
        }

        var endU = request.StartU + server.DeviceHeight - 1;

        if (endU > rack.HeightU)
        {
            return BadRequest(new { error = "U位超出机柜范围" });
        }

        var overlapping = await dbContext.ServerPositions
            .AnyAsync(position =>
                position.RackId == request.RackId
                && position.Status == "在架"
                && position.StartU <= endU
                && position.EndU >= request.StartU,
                cancellationToken);

        if (overlapping)
        {
            return Conflict(new { error = "目标U位范围与已有在架设备冲突" });
        }

        var serverPosition = new ServerPosition
        {
            ServerId = id,
            RackId = request.RackId,
            StartU = request.StartU,
            EndU = endU,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };

        server.PositionStatus = "在架";

        dbContext.ServerPositions.Add(serverPosition);
        AuditService.Record(dbContext, server, "上架", null,
            $"{rack.Code} U{serverPosition.StartU}-U{serverPosition.EndU}",
            User.Identity?.Name ?? "unknown");

        await dbContext.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new
        {
            serverPositionId = serverPosition.Id,
            serverName = server.Name,
            rackCode = rack.Code,
            startU = serverPosition.StartU,
            endU = serverPosition.EndU
        });
    }

    [HttpPost("{id:guid}/move")]
    public async Task<IActionResult> Move(Guid id, MoveServerRequest request, CancellationToken cancellationToken)
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

        if (request.StartU < 1)
        {
            return BadRequest(new { error = "起始U位必须大于等于1" });
        }

        var server = await dbContext.Servers.FindAsync(new object[] { id }, cancellationToken);
        if (server is null)
        {
            return NotFound(new { error = "服务器不存在" });
        }

        if (server.PositionStatus != "在架")
        {
            return BadRequest(new { error = "服务器不在架，无法移动" });
        }

        var oldPosition = await dbContext.ServerPositions
            .Include(position => position.Rack)
            .FirstOrDefaultAsync(position => position.ServerId == id && position.Status == "在架", cancellationToken);

        if (oldPosition is null)
        {
            return BadRequest(new { error = "服务器位置记录异常" });
        }

        var targetRack = await dbContext.Racks
            .Include(rack => rack.Room)
            .FirstOrDefaultAsync(rack => rack.Id == request.RackId, cancellationToken);

        if (targetRack is null)
        {
            return NotFound(new { error = "目标机柜不存在" });
        }

        if (targetRack.Room.Status != "启用")
        {
            return BadRequest(new { error = "目标机柜所在机房未启用" });
        }

        if (targetRack.Status != "启用")
        {
            return BadRequest(new { error = "目标机柜已停用" });
        }

        if (oldPosition.RackId == request.RackId && oldPosition.StartU == request.StartU)
        {
            return BadRequest(new { error = "移动目标与当前位置相同" });
        }

        var endU = request.StartU + server.DeviceHeight - 1;

        if (endU > targetRack.HeightU)
        {
            return BadRequest(new { error = "U位超出目标机柜范围" });
        }

        var overlapping = await dbContext.ServerPositions
            .AnyAsync(position =>
                position.RackId == request.RackId
                && position.Status == "在架"
                && position.Id != oldPosition.Id
                && position.StartU <= endU
                && position.EndU >= request.StartU,
                cancellationToken);

        if (overlapping)
        {
            return Conflict(new { error = "目标U位范围与已有在架设备冲突" });
        }

        var fromPosition = $"{oldPosition.Rack.Code} U{oldPosition.StartU}-U{oldPosition.EndU}";
        var toPosition = $"{targetRack.Code} U{request.StartU}-U{endU}";

        oldPosition.Status = "已下架";

        var newPosition = new ServerPosition
        {
            ServerId = id,
            RackId = request.RackId,
            StartU = request.StartU,
            EndU = endU,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };

        dbContext.ServerPositions.Add(newPosition);
        AuditService.Record(dbContext, server, "移动", fromPosition, toPosition,
            User.Identity?.Name ?? "unknown");

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            serverPositionId = newPosition.Id,
            serverName = server.Name,
            fromRackCode = oldPosition.Rack.Code,
            toRackCode = targetRack.Code,
            startU = newPosition.StartU,
            endU = newPosition.EndU
        });
    }

    [HttpPost("{id:guid}/decommission")]
    public async Task<IActionResult> Decommission(Guid id, CancellationToken cancellationToken)
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

        var server = await dbContext.Servers.FindAsync(new object[] { id }, cancellationToken);
        if (server is null)
        {
            return NotFound(new { error = "服务器不存在" });
        }

        if (server.PositionStatus != "在架")
        {
            return BadRequest(new { error = "服务器不在架，无法下架" });
        }

        var position = await dbContext.ServerPositions
            .Include(item => item.Rack)
            .FirstOrDefaultAsync(item => item.ServerId == id && item.Status == "在架", cancellationToken);

        if (position is null)
        {
            return BadRequest(new { error = "服务器位置记录异常" });
        }

        var fromPosition = $"{position.Rack.Code} U{position.StartU}-U{position.EndU}";

        position.Status = "已下架";
        server.PositionStatus = "已下架";

        AuditService.Record(dbContext, server, "下架", fromPosition, null,
            User.Identity?.Name ?? "unknown");

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            serverName = server.Name,
            message = "服务器已下架"
        });
    }

    [HttpGet("{id:guid}/audit-records")]
    public async Task<IActionResult> GetAuditRecords(Guid id, CancellationToken cancellationToken)
    {
        var serverExists = await dbContext.Servers
            .AsNoTracking()
            .AnyAsync(s => s.Id == id, cancellationToken);

        if (!serverExists)
        {
            return NotFound(new { error = "服务器不存在" });
        }

        var records = await dbContext.AuditRecords
            .AsNoTracking()
            .Where(ar => ar.ServerId == id)
            .OrderByDescending(ar => ar.OperatedAt)
            .Select(ar => new
            {
                ar.Id,
                ar.OperationType,
                ar.FromPosition,
                ar.ToPosition,
                ar.OperatorUsername,
                ar.OperatedAt,
                ar.Notes
            })
            .ToListAsync(cancellationToken);

        return Ok(records);
    }

    [HttpPost("import-batch")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> ImportBatch(IFormFile file, CancellationToken cancellationToken)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            return BadRequest(new { error = "防伪令牌缺失或无效" });
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { error = "请选择要导入的文件" });
        }

        if (!string.Equals(Path.GetExtension(file.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "仅支持 .xlsx 文件" });
        }

        XLWorkbook workbook;
        try
        {
            await using var stream = file.OpenReadStream();
            workbook = new XLWorkbook(stream);
        }
        catch (Exception) when (true)
        {
            return BadRequest(new { error = "无法读取 Excel 文件" });
        }

        using (workbook)
        {
            var worksheet = workbook.Worksheets.FirstOrDefault();
            if (worksheet is null)
            {
                return BadRequest(new { error = "Excel 文件不包含工作表" });
            }

            // Header mappings (Chinese → canonical)
            var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var lastCol = worksheet.Row(1).LastCellUsed()?.Address.ColumnNumber ?? 0;
            for (var col = 1; col <= lastCol; col++)
            {
                var h = worksheet.Cell(1, col).GetString().Trim();
                if (!string.IsNullOrWhiteSpace(h))
                {
                    headerMap[h] = col;
                }
            }

            // Required: name, managementIP
            if (!headerMap.ContainsKey("服务器名称"))
                return BadRequest(new { error = "缺少列：服务器名称" });
            if (!headerMap.ContainsKey("管理IP"))
                return BadRequest(new { error = "缺少列：管理IP" });

            // Load all racks for auto-rack lookup
            var racks = await dbContext.Racks.AsNoTracking().ToListAsync(cancellationToken);
            var rackMap = racks.ToDictionary(r => r.Code, r => r, StringComparer.OrdinalIgnoreCase);

            var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;
            var created = 0;
            var skipped = 0;
            var racked = 0;
            var errors = new List<object>();

            for (var row = 2; row <= lastRow; row++)
            {
                var name = RowCell(worksheet, row, headerMap, "服务器名称");
                var ip = RowCell(worksheet, row, headerMap, "管理IP");
                if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(ip))
                    continue;

                if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(ip))
                {
                    errors.Add(new { row, error = "服务器名称和管理IP不能为空" });
                    continue;
                }

                // Check existing server by name
                var existing = await dbContext.Servers
                    .FirstOrDefaultAsync(s => s.Name == name, cancellationToken);

                if (existing is not null)
                {
                    skipped++;
                    continue;
                }

                var assetNumber = RowCell(worksheet, row, headerMap, "资产编号");
                var deviceType = RowCell(worksheet, row, headerMap, "设备类型") ?? "服务器";
                var deviceHeightStr = RowCell(worksheet, row, headerMap, "设备高度(U)") ?? "1";
                if (!int.TryParse(deviceHeightStr, out var deviceHeight) || deviceHeight < 1)
                    deviceHeight = 1;

                var opStatus = RowCell(worksheet, row, headerMap, "运行状态") ?? "正常";
                if (opStatus != "正常" && opStatus != "异常" && opStatus != "维护")
                    opStatus = "正常";

                var system = RowCell(worksheet, row, headerMap, "系统");
                var owner = RowCell(worksheet, row, headerMap, "负责人");
                var notes = RowCell(worksheet, row, headerMap, "备注");

                var server = new Server
                {
                    Name = name,
                    ManagementIP = ip,
                    AssetNumber = NullIfWhiteSpace(assetNumber),
                    DeviceType = deviceType,
                    DeviceHeight = deviceHeight,
                    OperationalStatus = opStatus,
                    PositionStatus = "未上架",
                    System = NullIfWhiteSpace(system),
                    Owner = NullIfWhiteSpace(owner),
                    Notes = NullIfWhiteSpace(notes)
                };

                dbContext.Servers.Add(server);

                // Auto-rack if rack code and start U provided
                var rackCode = RowCell(worksheet, row, headerMap, "所在机柜");
                var startUStr = RowCell(worksheet, row, headerMap, "起始U位");

                if (!string.IsNullOrWhiteSpace(rackCode) && rackMap.TryGetValue(rackCode, out var targetRack)
                    && int.TryParse(startUStr, out var startU) && startU >= 1)
                {
                    var endU = startU + deviceHeight - 1;
                    if (endU > targetRack.HeightU)
                    {
                        errors.Add(new { row, error = $"机柜 '{rackCode}' 高度 {targetRack.HeightU}U，无法容纳 {deviceHeight}U 设备 (U{startU}-U{endU})" });
                    }
                    else
                    {
                        var hasConflict = await dbContext.ServerPositions.AnyAsync(p =>
                            p.RackId == targetRack.Id && p.Status == "在架"
                            && p.StartU <= endU && p.EndU >= startU, cancellationToken);

                        if (hasConflict)
                        {
                            errors.Add(new { row, error = $"机柜 '{rackCode}' U{startU}-U{endU} 已被占用" });
                        }
                        else
                        {
                            server.PositionStatus = "在架";
                            dbContext.ServerPositions.Add(new ServerPosition
                            {
                                Server = server,
                                RackId = targetRack.Id,
                                StartU = startU,
                                EndU = endU,
                                Status = "在架",
                                InstalledAt = DateTime.UtcNow
                            });
                            AuditService.Record(dbContext, server, "上架", null,
                                $"{targetRack.Code} U{startU}-U{endU}", User.Identity?.Name ?? "unknown");
                            racked++;
                        }
                    }
                }

                created++;

                try
                {
                    await dbContext.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException ex) when (IsServerUniqueConstraintViolation(ex))
                {
                    dbContext.ChangeTracker.Clear();
                    skipped++;
                    created--;
                }
            }

            return Ok(new { created, skipped, racked, errors = errors.Count > 0 ? errors : null });
        }
    }

    private static string? RowCell(IXLWorksheet ws, int row, Dictionary<string, int> map, string header)
    {
        if (map.TryGetValue(header, out var col))
        {
            var val = ws.Cell(row, col).GetString().Trim();
            return string.IsNullOrWhiteSpace(val) ? null : val;
        }
        return null;
    }

    private static string? NullIfWhiteSpace(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s;

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

public sealed record RackServerRequest(
    Guid RackId,
    int StartU);

public sealed record MoveServerRequest(
    Guid RackId,
    int StartU);
