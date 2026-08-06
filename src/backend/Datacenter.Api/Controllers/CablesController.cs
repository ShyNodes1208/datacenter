using ClosedXML.Excel;
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
        [FromQuery] string? purpose,
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
        if (!string.IsNullOrWhiteSpace(purpose))
        {
            query = query.Where(c => c.Purpose == purpose);
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
                c.Notes,
                c.Purpose
            })
            .ToListAsync(cancellationToken);

        return Ok(cables);
    }

    public sealed record CreateCableRequest(
        Guid SourcePortId, Guid TargetPortId, string CableType, string? Color, string? Length, string? Purpose);

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
            Length = request.Length?.Trim(),
            Purpose = string.IsNullOrWhiteSpace(request.Purpose) ? "正常" : request.Purpose.Trim()
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

    [HttpPost("cables/import")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> Import(IFormFile file, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        if (file is null || file.Length == 0)
            return BadRequest(new { error = "请选择要导入的文件" });

        if (!string.Equals(Path.GetExtension(file.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "仅支持 .xlsx 文件" });

        XLWorkbook workbook;
        try
        {
            await using var stream = file.OpenReadStream();
            workbook = new XLWorkbook(stream);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return BadRequest(new { error = "无法读取 Excel 文件" });
        }

        using (workbook)
        {
            var worksheet = workbook.Worksheets.FirstOrDefault();
            if (worksheet is null)
                return BadRequest(new { error = "Excel 文件不包含工作表" });

            // 解析表头
            var headerMap = new Dictionary<string, int>();
            var headerRow = worksheet.FirstRow();
            var lastHeaderCol = headerRow.LastCellUsed()?.Address.ColumnNumber ?? 0;
            for (int col = 1; col <= lastHeaderCol; col++)
            {
                var header = headerRow.Cell(col).GetString().Trim();
                if (!string.IsNullOrEmpty(header))
                    headerMap[header] = col;
            }

            var requiredHeaders = new[] { "源设备", "源端口", "目标设备", "目标端口", "线缆类型" };
            foreach (var h in requiredHeaders)
            {
                if (!headerMap.ContainsKey(h))
                    return BadRequest(new { error = $"缺少必填列: {h}" });
            }

            // 预加载所有设备
            var allServers = await dbContext.Servers
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            var serverByName = new Dictionary<string, Server>(StringComparer.OrdinalIgnoreCase);
            var serverByIP = new Dictionary<string, Server>(StringComparer.OrdinalIgnoreCase);
            foreach (var s in allServers)
            {
                serverByName[s.Name] = s;
                if (!string.IsNullOrEmpty(s.ManagementIP))
                    serverByIP[s.ManagementIP] = s;
            }

            // 预加载已占用端口
            var occupiedPortIds = new HashSet<Guid>(
                await dbContext.Cables.Select(c => c.SourcePortId).ToListAsync(cancellationToken));
            occupiedPortIds.UnionWith(
                await dbContext.Cables.Select(c => c.TargetPortId).ToListAsync(cancellationToken));

            // 逐行处理
            var errors = new List<object>();
            var successCount = 0;
            var totalRows = 0;

            var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;
            for (int row = 2; row <= lastRow; row++)
            {
                totalRows++;

                var srcDevice = RowCell(worksheet, row, headerMap, "源设备");
                var srcPortName = RowCell(worksheet, row, headerMap, "源端口");
                var srcPortType = RowCell(worksheet, row, headerMap, "源端口类型") ?? "RJ45";
                var srcPortSpeed = RowCell(worksheet, row, headerMap, "源端口速率");

                var tgtDevice = RowCell(worksheet, row, headerMap, "目标设备");
                var tgtPortName = RowCell(worksheet, row, headerMap, "目标端口");
                var tgtPortType = RowCell(worksheet, row, headerMap, "目标端口类型") ?? "RJ45";
                var tgtPortSpeed = RowCell(worksheet, row, headerMap, "目标端口速率");

                var cableType = RowCell(worksheet, row, headerMap, "线缆类型");
                var color = RowCell(worksheet, row, headerMap, "颜色");
                var length = RowCell(worksheet, row, headerMap, "长度");
                var purpose = RowCell(worksheet, row, headerMap, "线路用途") ?? "正常";

                // 必填校验
                if (string.IsNullOrWhiteSpace(srcDevice))
                { errors.Add(new { row, error = "源设备为空" }); continue; }
                if (string.IsNullOrWhiteSpace(srcPortName))
                { errors.Add(new { row, error = "源端口为空" }); continue; }
                if (string.IsNullOrWhiteSpace(tgtDevice))
                { errors.Add(new { row, error = "目标设备为空" }); continue; }
                if (string.IsNullOrWhiteSpace(tgtPortName))
                { errors.Add(new { row, error = "目标端口为空" }); continue; }
                if (string.IsNullOrWhiteSpace(cableType))
                { errors.Add(new { row, error = "线缆类型为空" }); continue; }

                // 匹配设备
                if (!serverByName.TryGetValue(srcDevice, out var srcServer) &&
                    !serverByIP.TryGetValue(srcDevice, out srcServer))
                { errors.Add(new { row, error = $"源设备不存在: {srcDevice}" }); continue; }

                if (!serverByName.TryGetValue(tgtDevice, out var tgtServer) &&
                    !serverByIP.TryGetValue(tgtDevice, out tgtServer))
                { errors.Add(new { row, error = $"目标设备不存在: {tgtDevice}" }); continue; }

                // 自连接检查
                if (srcServer.Id == tgtServer.Id &&
                    string.Equals(srcPortName, tgtPortName, StringComparison.OrdinalIgnoreCase))
                { errors.Add(new { row, error = "源端口与目标端口相同" }); continue; }

                try
                {
                    // 查找或创建源端口
                    var srcPort = await dbContext.Ports
                        .FirstOrDefaultAsync(p => p.ServerId == srcServer.Id && p.PortName == srcPortName,
                            cancellationToken);

                    if (srcPort is null)
                    {
                        srcPort = new Port
                        {
                            ServerId = srcServer.Id,
                            PortName = srcPortName,
                            PortType = srcPortType,
                            Speed = string.IsNullOrWhiteSpace(srcPortSpeed) ? null : srcPortSpeed
                        };
                        dbContext.Ports.Add(srcPort);
                        await dbContext.SaveChangesAsync(cancellationToken);
                    }
                    else if (occupiedPortIds.Contains(srcPort.Id))
                    { errors.Add(new { row, error = $"源端口已被占用: {srcServer.Name} / {srcPortName}" }); continue; }

                    // 查找或创建目标端口
                    var tgtPort = await dbContext.Ports
                        .FirstOrDefaultAsync(p => p.ServerId == tgtServer.Id && p.PortName == tgtPortName,
                            cancellationToken);

                    if (tgtPort is null)
                    {
                        tgtPort = new Port
                        {
                            ServerId = tgtServer.Id,
                            PortName = tgtPortName,
                            PortType = tgtPortType,
                            Speed = string.IsNullOrWhiteSpace(tgtPortSpeed) ? null : tgtPortSpeed
                        };
                        dbContext.Ports.Add(tgtPort);
                        await dbContext.SaveChangesAsync(cancellationToken);
                    }
                    else if (occupiedPortIds.Contains(tgtPort.Id))
                    { errors.Add(new { row, error = $"目标端口已被占用: {tgtServer.Name} / {tgtPortName}" }); continue; }

                    // 同一端口检查（两边都可能刚创建）
                    if (srcPort.Id == tgtPort.Id)
                    { errors.Add(new { row, error = "源端口与目标端口相同" }); continue; }

                    // 最终占用检查（该端口可能被本批次前面的行连接）
                    var alreadyConnected = await dbContext.Cables
                        .AnyAsync(c => c.SourcePortId == srcPort.Id || c.TargetPortId == srcPort.Id ||
                                       c.SourcePortId == tgtPort.Id || c.TargetPortId == tgtPort.Id,
                            cancellationToken);
                    if (alreadyConnected)
                    { errors.Add(new { row, error = "端口已被占用" }); continue; }

                    var cable = new Cable
                    {
                        SourcePortId = srcPort.Id,
                        TargetPortId = tgtPort.Id,
                        CableType = cableType,
                        Color = string.IsNullOrWhiteSpace(color) ? null : color,
                        Length = string.IsNullOrWhiteSpace(length) ? null : length,
                        Purpose = purpose
                    };
                    dbContext.Cables.Add(cable);
                    await dbContext.SaveChangesAsync(cancellationToken);

                    occupiedPortIds.Add(srcPort.Id);
                    occupiedPortIds.Add(tgtPort.Id);
                    successCount++;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    errors.Add(new { row, error = $"处理失败: {ex.Message}" });
                }
            }

            return Ok(new
            {
                totalRows,
                successCount,
                errorCount = errors.Count,
                errors = errors.Count > 0 ? errors : null
            });
        }
    }

    private static string? RowCell(IXLWorksheet worksheet, int row, Dictionary<string, int> map, string header)
    {
        if (!map.TryGetValue(header, out var col)) return null;
        var cell = worksheet.Cell(row, col);
        var value = cell.GetString()?.Trim();
        return string.IsNullOrEmpty(value) ? null : value;
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
