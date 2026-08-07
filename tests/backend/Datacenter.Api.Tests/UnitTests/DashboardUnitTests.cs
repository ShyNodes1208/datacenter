using Datacenter.Api.Controllers;
using Datacenter.Api.Data;
using Datacenter.Api.Models;
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

    [Fact]
    public async Task SummaryReturnsExactCountsFromDatabase()
    {
        await using var dbContext = new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite("Data Source=:memory:")
                .Options);
        await dbContext.Database.OpenConnectionAsync();
        await dbContext.Database.EnsureCreatedAsync();

        var room = new Room { Name = "Dashboard test room", Status = "启用" };
        var servers = Enumerable.Range(1, 3)
            .Select(index => new Server
            {
                Name = $"dashboard-server-{index}",
                ManagementIP = $"192.0.2.{index}",
                DeviceType = "机架式服务器",
                DeviceHeight = 1
            })
            .ToArray();
        var racks = Enumerable.Range(1, 5)
            .Select(index => new Rack
            {
                RoomId = room.Id,
                Code = $"DASH-{index}",
                HeightU = 42,
                X = index,
                Y = 0,
                Z = 0
            })
            .ToArray();
        var ports = Enumerable.Range(1, 14)
            .Select(index => new Port
            {
                ServerId = servers[(index - 1) % servers.Length].Id,
                PortName = $"dashboard-port-{index}",
                PortType = "RJ45"
            })
            .ToArray();
        var cables = Enumerable.Range(0, 7)
            .Select(index => new Cable
            {
                SourcePortId = ports[index * 2].Id,
                TargetPortId = ports[(index * 2) + 1].Id,
                CableType = "网线"
            })
            .ToArray();

        dbContext.Rooms.Add(room);
        dbContext.Servers.AddRange(servers);
        dbContext.Racks.AddRange(racks);
        dbContext.Ports.AddRange(ports);
        dbContext.Cables.AddRange(cables);
        await dbContext.SaveChangesAsync();

        var summary = await new DashboardService(dbContext)
            .GetSummaryAsync(CancellationToken.None);

        Assert.Equal(3, summary.TotalServers);
        Assert.Equal(5, summary.TotalRacks);
        Assert.Equal(7, summary.TotalCables);
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
