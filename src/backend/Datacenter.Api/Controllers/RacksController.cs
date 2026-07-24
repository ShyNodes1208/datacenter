using ClosedXML.Excel;
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
[Route("api/racks")]
public sealed class RacksController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
    private static readonly IReadOnlyDictionary<string, string> HeaderAliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["机柜编号"] = "code",
            ["code"] = "code",
            ["所在机房"] = "roomName",
            ["roomName"] = "roomName",
            ["高度(U)"] = "heightU",
            ["高度"] = "heightU",
            ["高度u"] = "heightU",
            ["heightU"] = "heightU",
            ["品牌"] = "brand",
            ["brand"] = "brand",
            ["额定功率"] = "power",
            ["功率"] = "power",
            ["power"] = "power",
            ["备注"] = "notes",
            ["notes"] = "notes",
            ["X坐标"] = "x",
            ["x"] = "x",
            ["Y坐标"] = "y",
            ["y"] = "y",
            ["Z坐标"] = "z",
            ["z"] = "z"
        };

    private static readonly string[] RequiredHeaders =
        ["code", "roomName", "heightU", "brand", "power", "notes", "x", "y", "z"];

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] Guid? roomId, CancellationToken cancellationToken)
    {
        IQueryable<Rack> query = dbContext.Racks.AsNoTracking();

        if (roomId.HasValue)
        {
            query = query.Where(rack => rack.RoomId == roomId.Value);
        }

        var racks = await query
            .Select(rack => new
            {
                rack.Id,
                rack.Code,
                rack.RoomId,
                RoomName = rack.Room.Name,
                rack.HeightU,
                rack.Brand,
                rack.Power,
                rack.Notes,
                rack.X,
                rack.Y,
                rack.Z
            })
            .ToListAsync(cancellationToken);

        return Ok(racks);
    }

    [HttpGet("{id:guid}/availability")]
    public async Task<IActionResult> GetAvailability(Guid id, CancellationToken cancellationToken)
    {
        var rack = await dbContext.Racks
            .AsNoTracking()
            .Select(item => new
            {
                item.Id,
                item.Code,
                item.HeightU
            })
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (rack is null)
        {
            return NotFound(new { error = "机柜不存在" });
        }

        var occupiedPositions = await dbContext.ServerPositions
            .AsNoTracking()
            .Where(position => position.RackId == id && position.Status == "在架")
            .Select(position => new
            {
                position.StartU,
                position.EndU,
                position.ServerId,
                ServerName = position.Server.Name
            })
            .ToListAsync(cancellationToken);

        var occupiedByU = new Dictionary<int, (string ServerName, Guid ServerId)>();

        foreach (var occupied in occupiedPositions)
        {
            for (var u = occupied.StartU; u <= occupied.EndU; u++)
            {
                occupiedByU[u] = (occupied.ServerName, occupied.ServerId);
            }
        }

        var positions = new List<object>();

        for (var u = rack.HeightU; u >= 1; u--)
        {
            if (occupiedByU.TryGetValue(u, out var occupancy))
            {
                positions.Add(new
                {
                    uNumber = u,
                    occupied = true,
                    serverName = occupancy.ServerName,
                    serverId = occupancy.ServerId
                });
            }
            else
            {
                positions.Add(new
                {
                    uNumber = u,
                    occupied = false
                });
            }
        }

        return Ok(new
        {
            rackId = rack.Id,
            rackCode = rack.Code,
            heightU = rack.HeightU,
            positions
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateRackRequest request, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
        {
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null)
        {
            return antiforgeryError;
        }

        if (request.HeightU < 1)
        {
            return BadRequest(new { error = "高度(U)必须为正整数" });
        }

        var rack = await dbContext.Racks.FindAsync([id], cancellationToken);
        if (rack is null)
        {
            return NotFound(new { error = "机柜不存在" });
        }

        var wouldTruncate = await dbContext.ServerPositions.AnyAsync(
            position =>
                position.RackId == id
                && position.Status == "在架"
                && position.EndU > request.HeightU,
            cancellationToken);
        if (wouldTruncate)
        {
            return Conflict(new { error = "新的 U 位总数会导致现有服务器占用超出机柜范围" });
        }

        var code = request.Code?.Trim();
        if (string.IsNullOrWhiteSpace(code))
        {
            return BadRequest(new { error = "机柜编号不能为空" });
        }

        if (await dbContext.Racks.AnyAsync(
                item => item.RoomId == rack.RoomId && item.Code == code && item.Id != id,
                cancellationToken))
        {
            return Conflict(new { error = "同一机房内机柜编号已存在" });
        }

        rack.Code = code;
        rack.HeightU = request.HeightU;
        rack.Brand = NullIfWhiteSpace(request.Brand);
        rack.Power = request.Power;
        rack.Notes = request.Notes;
        rack.X = request.X;
        rack.Y = request.Y;
        rack.Z = request.Z;

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (IsRackUniqueConstraintViolation(exception))
        {
            return Conflict(new { error = "同一机房内机柜编号已存在" });
        }

        return Ok(new
        {
            rack.Id,
            rack.Code,
            rack.RoomId,
            RoomName = await dbContext.Rooms.AsNoTracking()
                .Where(room => room.Id == rack.RoomId)
                .Select(room => room.Name)
                .SingleAsync(cancellationToken),
            rack.HeightU,
            rack.Brand,
            rack.Power,
            rack.Notes,
            rack.X,
            rack.Y,
            rack.Z
        });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
        {
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null)
        {
            return antiforgeryError;
        }

        var rack = await dbContext.Racks.FindAsync([id], cancellationToken);
        if (rack is null)
        {
            return NotFound(new { error = "机柜不存在" });
        }

        var hasServerPositions = await dbContext.ServerPositions.AnyAsync(
            position => position.RackId == id,
            cancellationToken);
        if (hasServerPositions)
        {
            return Conflict(new { error = "机柜中存在在架服务器，不能删除" });
        }

        dbContext.DevicePositions.RemoveRange(
            dbContext.DevicePositions.Where(position => position.RackId == id));
        dbContext.Racks.Remove(rack);
        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpPost("import-preview")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> ImportPreview(IFormFile file, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null)
        {
            return antiforgeryError;
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
        catch (Exception exception) when (exception is not OperationCanceledException)
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

            var columns = ReadHeaders(worksheet);
            var missingHeaders = RequiredHeaders.Where(header => !columns.ContainsKey(header)).ToArray();
            if (missingHeaders.Length > 0)
            {
                return BadRequest(new { error = $"缺少必需列头：{string.Join("、", missingHeaders.Select(GetHeaderDisplayName))}" });
            }

            var rooms = await dbContext.Rooms.AsNoTracking().ToListAsync(cancellationToken);
            var rows = ParseRows(worksheet, columns, rooms);
            MarkFileDuplicates(rows);
            await MarkDatabaseDuplicatesAsync(rows, cancellationToken);

            return Ok(new ImportPreviewResponse(
                rows,
                rows.Count,
                rows.Count(row => row.Errors.Count == 0),
                rows.Count(row => row.Errors.Count > 0),
                rows.Count(row => row.Duplicate)));
        }
    }

    [HttpPost("import")]
    public async Task<IActionResult> Import(ImportRequest request, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null)
        {
            return antiforgeryError;
        }

        if (request?.Rows is null || request.Rows.Count == 0)
        {
            return BadRequest(new { error = "导入行不能为空" });
        }

        var created = 0;
        var skipped = 0;
        var overwritten = 0;
        var errors = new List<ImportError>();
        var requestKeys = new HashSet<(Guid RoomId, string Code)>();

        foreach (var row in request.Rows)
        {
            if (row.Action == "skip")
            {
                skipped++;
                continue;
            }

            var validationError = await ValidateImportRowAsync(row, cancellationToken);
            if (validationError is not null)
            {
                errors.Add(new ImportError(row.Row, validationError));
                continue;
            }

            var code = row.Code.Trim();
            if (row.Action == "create")
            {
                if (!requestKeys.Add((row.RoomId, code)))
                {
                    errors.Add(new ImportError(row.Row, "同一请求内机柜编号重复"));
                    continue;
                }

                if (await dbContext.Racks.AnyAsync(
                    rack => rack.RoomId == row.RoomId && rack.Code == code,
                    cancellationToken))
                {
                    errors.Add(new ImportError(row.Row, "同一机房内机柜编号已存在"));
                    continue;
                }

                var rack = new Rack
                {
                    Code = code,
                    RoomId = row.RoomId,
                    HeightU = row.HeightU,
                    Brand = NullIfWhiteSpace(row.Brand),
                    Power = row.Power,
                    Notes = row.Notes,
                    X = row.X,
                    Y = row.Y,
                    Z = row.Z
                };
                dbContext.Racks.Add(rack);
                try
                {
                    await dbContext.SaveChangesAsync(cancellationToken);
                    created++;
                }
                catch (DbUpdateException exception) when (IsRackUniqueConstraintViolation(exception))
                {
                    dbContext.Entry(rack).State = EntityState.Detached;
                    errors.Add(new ImportError(row.Row, "同一机房内机柜编号已存在"));
                }

                continue;
            }

            if (row.Action == "overwrite")
            {
                var rack = await dbContext.Racks.FindAsync([row.ExistingRackId!.Value], cancellationToken);
                if (rack is null)
                {
                    errors.Add(new ImportError(row.Row, "要覆盖的机柜不存在"));
                    continue;
                }

                if (rack.RoomId != row.RoomId || !string.Equals(rack.Code, code, StringComparison.Ordinal))
                {
                    errors.Add(new ImportError(row.Row, "要覆盖的机柜与机房或编号不匹配"));
                    continue;
                }

                rack.HeightU = row.HeightU;
                rack.Brand = NullIfWhiteSpace(row.Brand);
                rack.Power = row.Power;
                rack.Notes = row.Notes;
                rack.X = row.X;
                rack.Y = row.Y;
                rack.Z = row.Z;
                await dbContext.SaveChangesAsync(cancellationToken);
                overwritten++;
                continue;
            }

            errors.Add(new ImportError(row.Row, "导入操作无效"));
        }

        return Ok(new ImportResponse(created, skipped, overwritten, errors.Count, errors));
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

    private static Dictionary<string, int> ReadHeaders(IXLWorksheet worksheet)
    {
        var columns = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var lastColumn = worksheet.Row(1).LastCellUsed()?.Address.ColumnNumber ?? 0;
        for (var column = 1; column <= lastColumn; column++)
        {
            var header = worksheet.Cell(1, column).GetString().Trim();
            if (HeaderAliases.TryGetValue(header, out var canonicalName))
            {
                columns.TryAdd(canonicalName, column);
            }
        }

        return columns;
    }

    private static List<ImportRowResult> ParseRows(
        IXLWorksheet worksheet,
        IReadOnlyDictionary<string, int> columns,
        IReadOnlyCollection<Room> rooms)
    {
        var results = new List<ImportRowResult>();
        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;
        for (var rowNumber = 2; rowNumber <= lastRow; rowNumber++)
        {
            var row = worksheet.Row(rowNumber);
            if (RequiredHeaders.All(header => row.Cell(columns[header]).IsEmpty()))
            {
                continue;
            }

            var errors = new List<string>();
            var code = NullIfWhiteSpace(row.Cell(columns["code"]).GetString());
            var roomName = NullIfWhiteSpace(row.Cell(columns["roomName"]).GetString());
            var brand = NullIfWhiteSpace(row.Cell(columns["brand"]).GetString());
            var notes = row.Cell(columns["notes"]).GetString();

            if (code is null)
            {
                errors.Add("机柜编号不能为空");
            }

            Room? room = null;
            if (roomName is null)
            {
                errors.Add("所在机房不能为空");
            }
            else
            {
                room = rooms.FirstOrDefault(item =>
                    string.Equals(item.Name.Trim(), roomName, StringComparison.OrdinalIgnoreCase));
                if (room is null)
                {
                    errors.Add($"机房 '{roomName}' 不存在");
                }
            }

            var heightCell = row.Cell(columns["heightU"]);
            int? heightU = null;
            if (heightCell.IsEmpty())
            {
                errors.Add("高度(U)不能为空");
            }
            else if (!heightCell.TryGetValue<int>(out var parsedHeight) || parsedHeight <= 0)
            {
                errors.Add("高度(U)必须为正整数");
            }
            else
            {
                heightU = parsedHeight;
            }

            var power = ParseOptionalNumber(row.Cell(columns["power"]), "额定功率必须为数字", errors);
            var x = ParseRequiredNumber(row.Cell(columns["x"]), "X坐标必须为数字", errors);
            var y = ParseRequiredNumber(row.Cell(columns["y"]), "Y坐标必须为数字", errors);
            var z = ParseRequiredNumber(row.Cell(columns["z"]), "Z坐标必须为数字", errors);

            results.Add(new ImportRowResult(
                rowNumber,
                code,
                roomName,
                room?.Id,
                heightU,
                brand,
                power,
                notes,
                x,
                y,
                z,
                errors,
                false,
                null));
        }

        return results;
    }

    private static void MarkFileDuplicates(List<ImportRowResult> rows)
    {
        var duplicateKeys = rows
            .Where(row => row.Errors.Count == 0 && row.RoomId.HasValue && row.Code is not null)
            .GroupBy(row => (row.RoomId!.Value, row.Code!), RoomCodeComparer.Instance)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToHashSet(RoomCodeComparer.Instance);

        foreach (var row in rows.Where(row =>
                     row.Errors.Count == 0
                     && row.RoomId.HasValue
                     && row.Code is not null
                     && duplicateKeys.Contains((row.RoomId.Value, row.Code))))
        {
            row.Errors.Add("同一文件内机柜编号重复");
        }
    }

    private async Task MarkDatabaseDuplicatesAsync(List<ImportRowResult> rows, CancellationToken cancellationToken)
    {
        foreach (var row in rows.Where(row => row.Errors.Count == 0 && row.RoomId.HasValue && row.Code is not null))
        {
            var existingRack = await dbContext.Racks.AsNoTracking().SingleOrDefaultAsync(
                rack => rack.RoomId == row.RoomId && rack.Code == row.Code,
                cancellationToken);
            if (existingRack is not null)
            {
                row.Duplicate = true;
                row.ExistingRackId = existingRack.Id;
            }
        }
    }

    private async Task<string?> ValidateImportRowAsync(ImportRowAction row, CancellationToken cancellationToken)
    {
        if (row.Action is not ("create" or "overwrite"))
        {
            return "导入操作无效";
        }

        if (string.IsNullOrWhiteSpace(row.Code))
        {
            return "机柜编号不能为空";
        }

        if (row.HeightU <= 0)
        {
            return "高度(U)必须为正整数";
        }

        if (!await dbContext.Rooms.AnyAsync(room => room.Id == row.RoomId, cancellationToken))
        {
            return "机房不存在";
        }

        if (row.Action == "overwrite" && !row.ExistingRackId.HasValue)
        {
            return "要覆盖的机柜不存在";
        }

        return null;
    }

    private static double? ParseOptionalNumber(IXLCell cell, string error, List<string> errors)
    {
        if (cell.IsEmpty())
        {
            return null;
        }

        if (cell.TryGetValue<double>(out var value))
        {
            return value;
        }

        errors.Add(error);
        return null;
    }

    private static double? ParseRequiredNumber(IXLCell cell, string error, List<string> errors)
    {
        if (cell.TryGetValue<double>(out var value))
        {
            return value;
        }

        errors.Add(error);
        return null;
    }

    private static string? NullIfWhiteSpace(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static string GetHeaderDisplayName(string header) => header switch
    {
        "code" => "机柜编号",
        "roomName" => "所在机房",
        "heightU" => "高度(U)",
        "brand" => "品牌",
        "power" => "额定功率",
        "notes" => "备注",
        "x" => "X坐标",
        "y" => "Y坐标",
        "z" => "Z坐标",
        _ => header
    };

    private static bool IsRackUniqueConstraintViolation(DbUpdateException exception) =>
        exception.InnerException is SqliteException
        {
            SqliteErrorCode: 19,
            SqliteExtendedErrorCode: 2067
        } sqliteException
        && sqliteException.Message.Contains(
            "UNIQUE constraint failed: Racks.RoomId, Racks.Code",
            StringComparison.Ordinal);

    private sealed class RoomCodeComparer : IEqualityComparer<(Guid RoomId, string Code)>
    {
        public static RoomCodeComparer Instance { get; } = new();

        public bool Equals((Guid RoomId, string Code) x, (Guid RoomId, string Code) y) =>
            x.RoomId == y.RoomId && string.Equals(x.Code, y.Code, StringComparison.Ordinal);

        public int GetHashCode((Guid RoomId, string Code) value) =>
            HashCode.Combine(value.RoomId, StringComparer.Ordinal.GetHashCode(value.Code));
    }
}

public sealed record ImportPreviewResponse(
    List<ImportRowResult> Rows,
    int TotalRows,
    int ValidRows,
    int ErrorRows,
    int DuplicateRows);

public sealed record ImportRowResult(
    int Row,
    string? Code,
    string? RoomName,
    Guid? RoomId,
    int? HeightU,
    string? Brand,
    double? Power,
    string? Notes,
    double? X,
    double? Y,
    double? Z,
    List<string> Errors,
    bool Duplicate,
    Guid? ExistingRackId)
{
    public bool Duplicate { get; set; } = Duplicate;

    public Guid? ExistingRackId { get; set; } = ExistingRackId;
}

public sealed record ImportRequest(List<ImportRowAction> Rows);

public sealed record ImportRowAction(
    int Row,
    string Action,
    string Code,
    Guid RoomId,
    int HeightU,
    string? Brand,
    double? Power,
    string? Notes,
    double X,
    double Y,
    double Z,
    Guid? ExistingRackId);

public sealed record ImportResponse(
    int Created,
    int Skipped,
    int Overwritten,
    int Failed,
    List<ImportError> Errors);

public sealed record ImportError(int Row, string Error);

public sealed record UpdateRackRequest(
    string? Code,
    int HeightU,
    string? Brand,
    double? Power,
    string? Notes,
    double X,
    double Y,
    double Z);
