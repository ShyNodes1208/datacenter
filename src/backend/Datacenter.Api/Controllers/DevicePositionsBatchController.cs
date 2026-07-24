using System.Linq;
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

            var allRacks = await dbContext.Racks
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            var cabinetColumns = DevicePositionExcelParser.FindCabinetColumns(worksheet, allRacks);

            if (cabinetColumns.Count == 0)
            {
                return BadRequest(new { error = "Excel 中未找到任何匹配的机柜" });
            }

            var results = new List<object>();
            var totalOccupied = 0;

            foreach (var (startCol, rack) in cabinetColumns)
            {
                var (errors, importData) = DevicePositionExcelParser.ParseColumn(
                    worksheet, startCol, rack.HeightU);

                var existingPositions = await dbContext.DevicePositions
                    .Where(dp => dp.RackId == rack.Id)
                    .ToListAsync(cancellationToken);

                dbContext.DevicePositions.RemoveRange(existingPositions);

                var occupied = 0;
                foreach (var (uNumber, (label, uHeight)) in importData)
                {
                    if (label is not null)
                    {
                        dbContext.DevicePositions.Add(new DevicePosition
                        {
                            RackId = rack.Id,
                            UNumber = uNumber,
                            UHeight = uHeight,
                            Label = label
                        });
                        occupied += uHeight;
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
