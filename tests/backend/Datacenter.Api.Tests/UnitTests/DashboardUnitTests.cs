using Datacenter.Api.Controllers;
using Datacenter.Api.Data;
using Datacenter.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Tests.UnitTests;

public sealed class DashboardUnitTests
{
    [Fact]
    public async Task SummaryReturnsNonNegativeIntegerTotalServers()
    {
        var summary = await GetSummaryAsync(new DashboardSummary(42, 15, 128));

        Assert.Equal(3, summary.GetType().GetProperties().Length);
        Assert.IsType<int>(summary.TotalServers);
        Assert.True(summary.TotalServers >= 0);
    }

    [Fact]
    public async Task SummaryReturnsNonNegativeIntegerTotalRacks()
    {
        var summary = await GetSummaryAsync(new DashboardSummary(42, 15, 128));

        Assert.Equal(3, summary.GetType().GetProperties().Length);
        Assert.IsType<int>(summary.TotalRacks);
        Assert.True(summary.TotalRacks >= 0);
    }

    [Fact]
    public async Task SummaryReturnsNonNegativeIntegerTotalCables()
    {
        var summary = await GetSummaryAsync(new DashboardSummary(42, 15, 128));

        Assert.Equal(3, summary.GetType().GetProperties().Length);
        Assert.IsType<int>(summary.TotalCables);
        Assert.True(summary.TotalCables >= 0);
    }

    private static async Task<DashboardSummary> GetSummaryAsync(DashboardSummary expected)
    {
        await using var dbContext = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite("Data Source=:memory:")
                .Options);
        var controller = new DashboardController(dbContext, new StubDashboardService(expected));

        var result = await controller.GetSummary(CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        return Assert.IsType<DashboardSummary>(ok.Value);
    }

    private sealed class StubDashboardService(DashboardSummary summary) : IDashboardService
    {
        public Task<DashboardSummary> GetSummaryAsync(CancellationToken cancellationToken)
        {
            return Task.FromResult(summary);
        }
    }
}
