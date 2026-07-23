using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Datacenter.Api.Services;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/racks/{rackId:guid}/device-positions")]
public sealed class DevicePositionsController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(Guid rackId, CancellationToken cancellationToken)
    {
        var rack = await dbContext.Racks
            .AsNoTracking()
            .Include(r => r.Room)
            .FirstOrDefaultAsync(r => r.Id == rackId, cancellationToken);

        if (rack is null)
        {
            return NotFound(new { error = "机柜不存在" });
        }

        var positions = await dbContext.DevicePositions
            .AsNoTracking()
            .Where(dp => dp.RackId == rackId)
            .OrderByDescending(dp => dp.UNumber)
            .Select(dp => new { dp.UNumber, dp.UHeight, dp.Label })
            .ToListAsync(cancellationToken);

        var positionDict = positions.ToDictionary(p => p.UNumber, p => (p.Label, p.UHeight));

        var allPositions = new List<object>(rack.HeightU);
        var occupiedU = 0;

        for (var u = rack.HeightU; u >= 1; u--)
        {
            if (positionDict.TryGetValue(u, out var existing))
            {
                allPositions.Add(new { uNumber = u, label = existing.Label, uHeight = existing.UHeight });
                if (existing.Label is not null)
                {
                    occupiedU += existing.UHeight;
                }
            }
            else
            {
                allPositions.Add(new { uNumber = u, label = (string?)null, uHeight = 1 });
            }
        }

        return Ok(new
        {
            rack = new
            {
                rack.Id,
                rack.Code,
                RoomName = rack.Room.Name,
                rack.HeightU,
                rack.X,
                rack.Y,
                rack.Z
            },
            positions = allPositions,
            stats = new
            {
                total = rack.HeightU,
                occupied = occupiedU,
                empty = rack.HeightU - occupiedU
            }
        });
    }

    [HttpPost("import")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> Import(Guid rackId, IFormFile file, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null)
        {
            return antiforgeryError;
        }

        var rack = await dbContext.Racks
            .FirstOrDefaultAsync(r => r.Id == rackId, cancellationToken);

        if (rack is null)
        {
            return NotFound(new { error = "机柜不存在" });
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

            var (errors, occupied) = await ImportPositionsForRack(
                worksheet, rack, rackId, cancellationToken);

            return Ok(new
            {
                rackId = rack.Id,
                rackCode = rack.Code,
                totalUPositions = rack.HeightU,
                occupied,
                empty = rack.HeightU - occupied,
                errors = errors.Count > 0 ? errors : null
            });
        }
    }

    private async Task<(List<string> Errors, int Occupied)> ImportPositionsForRack(
        IXLWorksheet worksheet, Rack rack, Guid rackId, CancellationToken cancellationToken)
    {
        var lastColumn = worksheet.Row(1).LastCellUsed()?.Address.ColumnNumber ?? 0;
        int? targetStartColumn = null;

        for (var col = 1; col <= lastColumn; col++)
        {
            var headerText = worksheet.Cell(1, col).GetString().Trim();
            if (string.IsNullOrWhiteSpace(headerText))
            {
                continue;
            }

            var normalized = ChineseSymbolNormalizer.Normalize(headerText);
            if (normalized.Contains(rack.Code, StringComparison.OrdinalIgnoreCase))
            {
                targetStartColumn = col;
                break;
            }
        }

        if (targetStartColumn is null)
        {
            return (new List<string> { $"Excel 中未找到机柜 '{rack.Code}' 的数据列" }, 0);
        }

        var uNumberCol = targetStartColumn.Value;
        var labelCol = uNumberCol + 1;

        var importData = new Dictionary<int, string?>();
        var errors = new List<string>();
        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;

        for (var row = 2; row <= lastRow; row++)
        {
            var uNumberText = worksheet.Cell(row, uNumberCol).GetString().Trim();
            if (string.IsNullOrWhiteSpace(uNumberText))
            {
                continue;
            }

            var uNumberStr = uNumberText.TrimEnd('U', 'u');
            if (!int.TryParse(uNumberStr, out var uNumber) || uNumber < 1)
            {
                errors.Add($"第 {row} 行 U 位编号无效：'{uNumberText}'");
                continue;
            }

            if (uNumber > rack.HeightU)
            {
                errors.Add($"第 {row} 行 U 位编号 {uNumber} 超出机柜 U 位范围 (1-{rack.HeightU})");
                continue;
            }

            var label = worksheet.Cell(row, labelCol).GetString().Trim();
            importData[uNumber] = string.IsNullOrWhiteSpace(label) ? null : label;
        }

        var existingPositions = await dbContext.DevicePositions
            .Where(dp => dp.RackId == rackId)
            .ToListAsync(cancellationToken);

        dbContext.DevicePositions.RemoveRange(existingPositions);

        var occupied = 0;
        foreach (var (uNumber, label) in importData)
        {
            if (label is not null)
            {
                dbContext.DevicePositions.Add(new DevicePosition
                {
                    RackId = rackId,
                    UNumber = uNumber,
                    UHeight = 1,
                    Label = label
                });
                occupied++;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return (errors, occupied);
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
