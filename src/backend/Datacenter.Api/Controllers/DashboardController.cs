using Datacenter.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/dashboard")]
public sealed class DashboardController(AppDbContext dbContext) : ControllerBase
{
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken)
    {
        var totalRooms = await dbContext.Rooms.CountAsync(cancellationToken);

        var rackStats = await dbContext.Racks
            .Select(rack => new { rack.HeightU })
            .ToListAsync(cancellationToken);

        var totalRacks = rackStats.Count;
        var totalU = rackStats.Sum(r => r.HeightU);

        var occupiedU = await dbContext.ServerPositions
            .Where(sp => sp.Status == "在架")
            .Select(sp => sp.EndU - sp.StartU + 1)
            .SumAsync(cancellationToken);

        var rackedServers = await dbContext.ServerPositions
            .Where(sp => sp.Status == "在架")
            .Select(sp => sp.ServerId)
            .Distinct()
            .CountAsync(cancellationToken);

        var usagePercent = totalU > 0
            ? (int)Math.Round((double)occupiedU / totalU * 100)
            : 0;

        return Ok(new
        {
            totalRooms,
            totalRacks,
            totalU,
            occupiedU,
            usagePercent,
            rackedServers
        });
    }
}
