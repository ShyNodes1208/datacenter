using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Datacenter.Api.Tests.IntegrationTests;

[Collection(AuthCollection.Name)]
public sealed class NetworkPathIntegrationTests(AuthTestFixture fixture)
{
    [Fact]
    public async Task FindPathByPortUsesTheSelectedPortAndReturnsTheShortestPhysicalPath()
    {
        var topology = await SeedPathTopologyAsync();
        using var client = fixture.CreateClient();
        await LoginAsReadOnlyViewerAsync(client);

        using var response = await client.GetAsync(
            $"/api/network-path/by-port?sourcePortId={topology.SourcePortId}&targetServerId={topology.TargetServerId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var root = document.RootElement;
        Assert.True(root.GetProperty("pathFound").GetBoolean());
        Assert.Equal(3, root.GetProperty("hops").GetArrayLength());
        Assert.Equal(topology.SourcePortId, root.GetProperty("hops")[0].GetProperty("fromPortId").GetGuid());
        Assert.Equal(["server-a", "access-switch", "core-switch", "server-b"],
            root.GetProperty("devices").EnumerateArray().Select(item => item.GetProperty("deviceName").GetString()).ToArray());
        Assert.Equal("A-01", root.GetProperty("devices")[0].GetProperty("rackCode").GetString());
        await ClearTopologyAsync();
    }

    [Fact]
    public async Task FindPathByPortReturnsNotFoundForMissingSourcePortOrTargetDevice()
    {
        var topology = await SeedPathTopologyAsync();
        using var client = fixture.CreateClient();
        await LoginAsReadOnlyViewerAsync(client);

        using var missingPort = await client.GetAsync(
            $"/api/network-path/by-port?sourcePortId={Guid.NewGuid()}&targetServerId={topology.TargetServerId}");
        using var missingTarget = await client.GetAsync(
            $"/api/network-path/by-port?sourcePortId={topology.SourcePortId}&targetServerId={Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, missingPort.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missingTarget.StatusCode);
        await ClearTopologyAsync();
    }

    [Fact]
    public async Task FindPathByPortReturnsAnOkNoPathResultWhenTargetCannotBeReached()
    {
        var topology = await SeedPathTopologyAsync();
        using var client = fixture.CreateClient();
        await LoginAsReadOnlyViewerAsync(client);

        using var response = await client.GetAsync(
            $"/api/network-path/by-port?sourcePortId={topology.SourcePortId}&targetServerId={topology.UnreachableServerId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.False(document.RootElement.GetProperty("pathFound").GetBoolean());
        Assert.Equal("未找到已登记的连接路径", document.RootElement.GetProperty("reason").GetString());
        await ClearTopologyAsync();
    }

    [Fact]
    public async Task FindPathByPortExplainsWhenTheTargetRequiresMoreThanTenHops()
    {
        var topology = await SeedHopLimitTopologyAsync();
        using var client = fixture.CreateClient();
        await LoginAsReadOnlyViewerAsync(client);

        using var response = await client.GetAsync(
            $"/api/network-path/by-port?sourcePortId={topology.SourcePortId}&targetServerId={topology.TargetServerId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.False(document.RootElement.GetProperty("pathFound").GetBoolean());
        Assert.Equal("已达到十跳搜索上限，未找到目标设备", document.RootElement.GetProperty("reason").GetString());
        await ClearTopologyAsync();
    }

    [Fact]
    public async Task FindReachableUsesDefaultFourHopsAndReportsReachableEndpoints()
    {
        var topology = await SeedPathTopologyAsync();
        using var client = fixture.CreateClient();
        await LoginAsReadOnlyViewerAsync(client);

        using var response = await client.GetAsync($"/api/network-path/reachable?sourcePortId={topology.SourcePortId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var root = document.RootElement;
        Assert.Equal(4, root.GetProperty("maxHops").GetInt32());
        Assert.Equal(1, root.GetProperty("totalEndpointCount").GetInt32());
        Assert.Equal(1, root.GetProperty("returnedEndpointCount").GetInt32());
        Assert.False(root.GetProperty("isTruncated").GetBoolean());
        var endpoint = Assert.Single(root.GetProperty("endpoints").EnumerateArray());
        Assert.Equal(topology.TargetServerId, endpoint.GetProperty("deviceId").GetGuid());
        Assert.Equal(3, endpoint.GetProperty("hopCount").GetInt32());
        await ClearTopologyAsync();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(11)]
    public async Task FindReachableRejectsMaxHopsOutsideOneThroughTen(int maxHops)
    {
        var topology = await SeedPathTopologyAsync();
        using var client = fixture.CreateClient();
        await LoginAsReadOnlyViewerAsync(client);

        using var response = await client.GetAsync(
            $"/api/network-path/reachable?sourcePortId={topology.SourcePortId}&maxHops={maxHops}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await ClearTopologyAsync();
    }

    [Fact]
    public async Task FindReachableReturnsOnlyOneHundredEndpointsAndReportsTruncation()
    {
        var topology = await SeedManyReachableEndpointsAsync(101);
        using var client = fixture.CreateClient();
        await LoginAsReadOnlyViewerAsync(client);

        using var response = await client.GetAsync($"/api/network-path/reachable?sourcePortId={topology.SourcePortId}&maxHops=2&limit=1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var root = document.RootElement;
        Assert.Equal(101, root.GetProperty("totalEndpointCount").GetInt32());
        Assert.Equal(100, root.GetProperty("returnedEndpointCount").GetInt32());
        Assert.True(root.GetProperty("isTruncated").GetBoolean());
        Assert.Equal(100, root.GetProperty("endpoints").GetArrayLength());
        await ClearTopologyAsync();
    }

    [Theory]
    [InlineData("/api/network-path/by-port?sourcePortId=00000000-0000-0000-0000-000000000001&targetServerId=00000000-0000-0000-0000-000000000002")]
    [InlineData("/api/network-path/reachable?sourcePortId=00000000-0000-0000-0000-000000000001")]
    public async Task AnonymousRequestsAreUnauthorized(string url)
    {
        using var client = fixture.CreateClient();

        using var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task<PathTopology> SeedPathTopologyAsync()
    {
        var room = new Room { Name = "network-path-room", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "A-01", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var source = NewServer("server-a", "服务器", "10.8.0.1");
        var access = NewServer("access-switch", "交换机", "10.8.0.2");
        var core = NewServer("core-switch", "switch", "10.8.0.3");
        var target = NewServer("server-b", "服务器", "10.8.0.4");
        var unreachable = NewServer("server-c", "服务器", "10.8.0.5");
        var sourcePort = NewPort(source, "eth0");
        var ignoredSourcePort = NewPort(source, "eth1");
        var accessDownlink = NewPort(access, "downlink");
        var accessUplink = NewPort(access, "uplink");
        var coreDownlink = NewPort(core, "downlink");
        var coreUplink = NewPort(core, "uplink");
        var targetPort = NewPort(target, "eth0");
        var ignoredTargetPort = NewPort(target, "eth1");
        var unreachablePort = NewPort(unreachable, "eth0");

        await ReplaceTopologyAsync(
            [room],
            [rack],
            [source, access, core, target, unreachable],
            [
                new ServerPosition { ServerId = source.Id, RackId = rack.Id, StartU = 1, EndU = 1, Status = "在架" },
                new ServerPosition { ServerId = access.Id, RackId = rack.Id, StartU = 2, EndU = 2, Status = "在架" },
                new ServerPosition { ServerId = core.Id, RackId = rack.Id, StartU = 3, EndU = 3, Status = "在架" },
                new ServerPosition { ServerId = target.Id, RackId = rack.Id, StartU = 4, EndU = 4, Status = "在架" },
                new ServerPosition { ServerId = unreachable.Id, RackId = rack.Id, StartU = 5, EndU = 5, Status = "在架" }
            ],
            [sourcePort, ignoredSourcePort, accessDownlink, accessUplink, coreDownlink, coreUplink, targetPort, ignoredTargetPort, unreachablePort],
            [
                NewCable(sourcePort, accessDownlink),
                NewCable(accessUplink, coreDownlink),
                NewCable(coreUplink, targetPort),
                NewCable(ignoredSourcePort, ignoredTargetPort)
            ]);

        return new PathTopology(sourcePort.Id, target.Id, unreachable.Id);
    }

    private async Task<PathTopology> SeedManyReachableEndpointsAsync(int endpointCount)
    {
        var room = new Room { Name = "network-limit-room", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "L-01", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var source = NewServer("limit-source", "服务器", "10.9.0.1");
        var network = NewServer("limit-switch", "交换机", "10.9.0.2");
        var sourcePort = NewPort(source, "eth0");
        var networkIngress = NewPort(network, "ingress");
        var servers = new List<Server> { source, network };
        var ports = new List<Port> { sourcePort, networkIngress };
        var positions = new List<ServerPosition>
        {
            new() { ServerId = source.Id, RackId = rack.Id, StartU = 1, EndU = 1, Status = "在架" },
            new() { ServerId = network.Id, RackId = rack.Id, StartU = 2, EndU = 2, Status = "在架" }
        };
        var cables = new List<Cable> { NewCable(sourcePort, networkIngress) };

        for (var index = 0; index < endpointCount; index++)
        {
            var endpoint = NewServer($"limit-endpoint-{index:D3}", "服务器", $"10.9.1.{index + 1}");
            var switchPort = NewPort(network, $"endpoint-{index:D3}");
            var endpointPort = NewPort(endpoint, "eth0");
            servers.Add(endpoint);
            ports.AddRange([switchPort, endpointPort]);
            positions.Add(new ServerPosition { ServerId = endpoint.Id, RackId = rack.Id, StartU = 3, EndU = 3, Status = "在架" });
            cables.Add(NewCable(switchPort, endpointPort));
        }

        await ReplaceTopologyAsync([room], [rack], servers, positions, ports, cables);
        return new PathTopology(sourcePort.Id, Guid.Empty, Guid.Empty);
    }

    private async Task<PathTopology> SeedHopLimitTopologyAsync()
    {
        var room = new Room { Name = "hop-limit-room", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "H-01", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var source = NewServer("hop-limit-source", "服务器", "10.10.0.1");
        var target = NewServer("hop-limit-target", "服务器", "10.10.0.2");
        var sourcePort = NewPort(source, "eth0");
        var ports = new List<Port> { sourcePort };
        var servers = new List<Server> { source, target };
        var cables = new List<Cable>();
        var previousPort = sourcePort;

        for (var index = 1; index <= 10; index++)
        {
            var networkDevice = NewServer($"hop-limit-switch-{index:D2}", "交换机", $"10.10.1.{index}");
            var ingressPort = NewPort(networkDevice, "ingress");
            var egressPort = NewPort(networkDevice, "egress");
            servers.Add(networkDevice);
            ports.AddRange([ingressPort, egressPort]);
            cables.Add(NewCable(previousPort, ingressPort));
            previousPort = egressPort;
        }

        var targetPort = NewPort(target, "eth0");
        ports.Add(targetPort);
        cables.Add(NewCable(previousPort, targetPort));

        await ReplaceTopologyAsync([room], [rack], servers, [], ports, cables);
        return new PathTopology(sourcePort.Id, target.Id, Guid.Empty);
    }

    private async Task ReplaceTopologyAsync(
        IEnumerable<Room> rooms,
        IEnumerable<Rack> racks,
        IEnumerable<Server> servers,
        IEnumerable<ServerPosition> positions,
        IEnumerable<Port> ports,
        IEnumerable<Cable> cables)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Cables.RemoveRange(await dbContext.Cables.ToListAsync());
        dbContext.Ports.RemoveRange(await dbContext.Ports.ToListAsync());
        dbContext.ServerPositions.RemoveRange(await dbContext.ServerPositions.ToListAsync());
        dbContext.DevicePositions.RemoveRange(await dbContext.DevicePositions.ToListAsync());
        dbContext.AuditRecords.RemoveRange(await dbContext.AuditRecords.ToListAsync());
        dbContext.Servers.RemoveRange(await dbContext.Servers.ToListAsync());
        dbContext.Racks.RemoveRange(await dbContext.Racks.ToListAsync());
        dbContext.Rooms.RemoveRange(await dbContext.Rooms.ToListAsync());
        await dbContext.SaveChangesAsync();

        dbContext.Rooms.AddRange(rooms);
        dbContext.Racks.AddRange(racks);
        dbContext.Servers.AddRange(servers);
        dbContext.ServerPositions.AddRange(positions);
        dbContext.Ports.AddRange(ports);
        dbContext.Cables.AddRange(cables);
        await dbContext.SaveChangesAsync();
    }

    private Task ClearTopologyAsync() => ReplaceTopologyAsync([], [], [], [], [], []);

    private async Task LoginAsReadOnlyViewerAsync(HttpClient client)
    {
        var username = $"network-path-{Guid.NewGuid():N}";
        const string password = "network-path-test-password";
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
            var user = new User { Username = username, Role = Roles.ReadOnlyViewer, Enabled = true };
            user.PasswordHash = hasher.HashPassword(user, password);
            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync();
        }

        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { username, password })
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static Server NewServer(string name, string deviceType, string ip) => new()
    {
        Name = name,
        DeviceType = deviceType,
        ManagementIP = ip,
        DeviceHeight = 1,
        OperationalStatus = "正常",
        PositionStatus = "在架"
    };

    private static Port NewPort(Server server, string name) => new()
    {
        ServerId = server.Id,
        PortName = name,
        PortType = "RJ45"
    };

    private static Cable NewCable(Port source, Port target) => new()
    {
        SourcePortId = source.Id,
        TargetPortId = target.Id,
        CableType = "铜缆"
    };

    private sealed record PathTopology(Guid SourcePortId, Guid TargetServerId, Guid UnreachableServerId);
}
