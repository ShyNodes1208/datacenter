using Datacenter.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Services;

public interface IDashboardService
{
    Task<DashboardSummary> GetSummaryAsync(CancellationToken cancellationToken);
}

public sealed class DashboardService(AppDbContext dbContext) : IDashboardService
{
    public async Task<DashboardSummary> GetSummaryAsync(CancellationToken cancellationToken)
    {
        var totalServers = await dbContext.Servers.CountAsync(cancellationToken);
        var totalRacks = await dbContext.Racks.CountAsync(cancellationToken);
        var totalCables = await dbContext.Cables.CountAsync(cancellationToken);

        return new DashboardSummary(totalServers, totalRacks, totalCables);
    }
}

public sealed record DashboardSummary(
    int TotalServers,
    int TotalRacks,
    int TotalCables);
