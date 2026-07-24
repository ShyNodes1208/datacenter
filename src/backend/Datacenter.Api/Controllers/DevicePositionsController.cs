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

    [HttpPost("import-preview")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> ImportPreview(Guid rackId, IFormFile file, CancellationToken cancellationToken)
    {
        var antiforgeryError = await ValidateAntiforgeryAsync();
        if (antiforgeryError is not null)
        {
            return antiforgeryError;
        }

        var rack = await dbContext.Racks
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == rackId, cancellationToken);

        if (rack is null)
        {
            return NotFound(new { error = "机柜不存在" });
        }

        var openResult = await OpenWorksheetAsync(file);
        if (openResult.ErrorResult is not null)
        {
            return openResult.ErrorResult;
        }

        using (openResult.Workbook!)
        {
            var (errors, importData) = DevicePositionExcelParser.ParseForRack(
                openResult.Worksheet!, rack.Code, rack.HeightU);
            var positions = importData
                .Where(kv => kv.Value.Label is not null)
                .OrderByDescending(kv => kv.Key)
                .Select(kv => new
                {
                    uNumber = kv.Key,
                    label = kv.Value.Label,
                    uHeight = kv.Value.UHeight
                })
                .ToList();
            var occupied = positions.Sum(p => p.uHeight);

            return Ok(new
            {
                rackId = rack.Id,
                rackCode = rack.Code,
                totalUPositions = rack.HeightU,
                occupied,
                empty = rack.HeightU - occupied,
                positions,
                errors = errors.Count > 0 ? errors : null
            });
        }
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

        var openResult = await OpenWorksheetAsync(file);
        if (openResult.ErrorResult is not null)
        {
            return openResult.ErrorResult;
        }

        using (openResult.Workbook!)
        {
            var (errors, occupied) = await ImportPositionsForRack(
                openResult.Worksheet!, rack, rackId, cancellationToken);

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

    private async Task<(XLWorkbook? Workbook, IXLWorksheet? Worksheet, IActionResult? ErrorResult)> OpenWorksheetAsync(
        IFormFile file)
    {
        if (file is null || file.Length == 0)
        {
            return (null, null, BadRequest(new { error = "请选择要导入的文件" }));
        }

        if (!string.Equals(Path.GetExtension(file.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            return (null, null, BadRequest(new { error = "仅支持 .xlsx 文件" }));
        }

        XLWorkbook workbook;
        try
        {
            await using var stream = file.OpenReadStream();
            workbook = new XLWorkbook(stream);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return (null, null, BadRequest(new { error = "无法读取 Excel 文件" }));
        }

        var worksheet = workbook.Worksheets.FirstOrDefault();
        if (worksheet is null)
        {
            workbook.Dispose();
            return (null, null, BadRequest(new { error = "Excel 文件不包含工作表" }));
        }

        return (workbook, worksheet, null);
    }

    private async Task<(List<string> Errors, int Occupied)> ImportPositionsForRack(
        IXLWorksheet worksheet, Rack rack, Guid rackId, CancellationToken cancellationToken)
    {
        var (errors, importData) = DevicePositionExcelParser.ParseForRack(worksheet, rack.Code, rack.HeightU);

        var existingPositions = await dbContext.DevicePositions
            .Where(dp => dp.RackId == rackId)
            .ToListAsync(cancellationToken);

        dbContext.DevicePositions.RemoveRange(existingPositions);

        var occupied = 0;
        foreach (var (uNumber, (label, uHeight)) in importData)
        {
            if (label is not null)
            {
                dbContext.DevicePositions.Add(new DevicePosition
                {
                    RackId = rackId,
                    UNumber = uNumber,
                    UHeight = uHeight,
                    Label = label
                });
                occupied += uHeight;
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
