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
[Route("api/device-positions")]
public sealed class DevicePositionsBatchController(AppDbContext dbContext, IAntiforgery antiforgery) : ControllerBase
{
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

            // Scan row 1 for all cabinet identifiers
            var allRacks = await dbContext.Racks
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            var lastColumn = worksheet.Row(1).LastCellUsed()?.Address.ColumnNumber ?? 0;
            var cabinetColumns = new List<(int StartColumn, Rack Rack)>();

            for (var col = 1; col <= lastColumn; col++)
            {
                var headerText = worksheet.Cell(1, col).GetString().Trim();
                if (string.IsNullOrWhiteSpace(headerText))
                {
                    continue;
                }

                var normalized = ChineseSymbolNormalizer.Normalize(headerText);
                var matchedRack = allRacks.FirstOrDefault(r =>
                    normalized.Contains(r.Code, StringComparison.OrdinalIgnoreCase));

                if (matchedRack is not null)
                {
                    cabinetColumns.Add((col, matchedRack));
                }
            }

            if (cabinetColumns.Count == 0)
            {
                return BadRequest(new { error = "Excel 中未找到任何匹配的机柜" });
            }

            var results = new List<object>();
            var totalOccupied = 0;

            foreach (var (startCol, rack) in cabinetColumns)
            {
                var uNumberCol = startCol;
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

                // Full replace
                var existingPositions = await dbContext.DevicePositions
                    .Where(dp => dp.RackId == rack.Id)
                    .ToListAsync(cancellationToken);

                dbContext.DevicePositions.RemoveRange(existingPositions);

                var occupied = 0;
                foreach (var (uNumber, label) in importData)
                {
                    if (label is not null)
                    {
                        dbContext.DevicePositions.Add(new DevicePosition
                        {
                            RackId = rack.Id,
                            UNumber = uNumber,
                            UHeight = 1,
                            Label = label
                        });
                        occupied++;
                    }
                }

                totalOccupied += occupied;

                results.Add(new
                {
                    rackId = rack.Id,
                    rackCode = rack.Code,
                    totalUPositions = rack.HeightU,
                    occupied,
                    empty = rack.HeightU - occupied,
                    errors = errors.Count > 0 ? errors : null
                });
            }

            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                racks = results,
                totalRacks = results.Count,
                totalOccupied
            });
        }
    }
}
