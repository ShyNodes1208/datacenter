using Datacenter.Api.Auth;
using Datacenter.Api.Models;
using Datacenter.Api.Services.ConnectionSheet;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;

namespace Datacenter.Api.Controllers;

[ApiController]
[Route("api/import/connection-sheet")]
public sealed class ConnectionSheetImportController(
    ConnectionSheetImportService importService,
    IAntiforgery antiforgery) : ControllerBase
{
    [HttpPost("preview")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> Preview(IFormFile file, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        var validationError = ValidateFile(file);
        if (validationError is not null)
            return BadRequest(new { error = validationError });

        try
        {
            await using var stream = file.OpenReadStream();
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, cancellationToken);
            buffer.Position = 0;
            var plan = importService.BuildPlan(buffer);
            return Ok(ToPreviewResponse(plan));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return BadRequest(new { error = "无法读取 Excel 文件" });
        }
    }

    [HttpPost]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> Import(IFormFile file, CancellationToken cancellationToken)
    {
        if (!User.IsInRole(Roles.RoomAdministrator) && !User.IsInRole(Roles.Operations))
            return StatusCode(StatusCodes.Status403Forbidden);

        try { await antiforgery.ValidateRequestAsync(HttpContext); }
        catch (AntiforgeryValidationException) { return BadRequest(new { error = "防伪令牌缺失或无效" }); }

        var validationError = ValidateFile(file);
        if (validationError is not null)
            return BadRequest(new { error = validationError });

        try
        {
            await using var stream = file.OpenReadStream();
            using var buffer = new MemoryStream();
            await stream.CopyToAsync(buffer, cancellationToken);
            buffer.Position = 0;
            var result = await importService.ImportAsync(
                buffer,
                User.Identity?.Name ?? "unknown",
                cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
            return BadRequest(new { error = "无法读取 Excel 文件" });
        }
    }

    private static string? ValidateFile(IFormFile? file)
    {
        if (file is null || file.Length == 0)
            return "请选择要导入的文件";
        if (!string.Equals(Path.GetExtension(file.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
            return "仅支持 .xlsx 文件";
        return null;
    }

    private static object ToPreviewResponse(ConnectionSheetImportPlan plan) =>
        new
        {
            plan.TotalRows,
            plan.ValidRows,
            plan.ErrorRows,
            roomsToCreate = plan.Rooms.Count(r => !r.Exists),
            racksToCreate = plan.Racks.Count(r => !r.Exists),
            devicesToCreate = plan.Devices.Count(d => !d.Exists),
            cablesToCreate = plan.Cables.Count,
            rooms = plan.Rooms.Select(r => new { r.Name, r.Exists }),
            racks = plan.Racks.Take(50).Select(r => new
            {
                r.Room,
                r.Code,
                r.Exists,
                r.HeightU,
                r.X,
                r.Y
            }),
            devices = plan.Devices.Take(50).Select(d => new
            {
                d.DisplayName,
                d.Room,
                d.Rack,
                d.StartU,
                d.HeightU,
                d.DeviceType,
                d.Exists
            }),
            warnings = plan.Issues
                .Where(i => !i.IsError)
                .Take(100)
                .Select(i => new { row = i.Row, message = i.Message }),
            errors = plan.Issues
                .Where(i => i.IsError)
                .Take(100)
                .Select(i => new { row = i.Row, error = i.Message }),
            errorsTruncated = plan.Issues.Count(i => i.IsError) > 100,
            racksTruncated = plan.Racks.Count > 50,
            devicesTruncated = plan.Devices.Count > 50
        };
}
