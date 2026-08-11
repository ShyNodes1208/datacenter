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
public sealed class RoomTopologyIntegrationTests(AuthTestFixture fixture)
{
    [Fact]
    public async Task GetTopologyReturnsRoomBundlesAndStats()
    {
        var roomA = new Room { Name = "机房A", Status = "启用", TopologyX = 10, TopologyY = 20 };
        var roomB = new Room { Name = "机房B", Status = "启用", TopologyX = 200, TopologyY = 40 };
        var rackA = new Rack { RoomId = roomA.Id, Code = "A-01", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var rackB = new Rack { RoomId = roomB.Id, Code = "B-01", HeightU = 42, X = 1, Y = 0, Z = 0 };
        var serverA = new Server
        {
            Name = "sw-a",
            ManagementIP = "10.0.0.1",
            DeviceType = "交换机",
            DeviceHeight = 1,
            OperationalStatus = "正常",
            PositionStatus = "在架"
        };
        var serverB = new Server
        {
            Name = "sw-b",
            ManagementIP = "10.0.0.2",
            DeviceType = "交换机",
            DeviceHeight = 1,
            OperationalStatus = "正常",
            PositionStatus = "在架"
        };
        var portA1 = new Port { ServerId = serverA.Id, PortName = "eth0", PortType = "RJ45" };
        var portA2 = new Port { ServerId = serverA.Id, PortName = "eth1", PortType = "RJ45" };
        var portB1 = new Port { ServerId = serverB.Id, PortName = "eth0", PortType = "RJ45" };
        var portB2 = new Port { ServerId = serverB.Id, PortName = "eth1", PortType = "RJ45" };
        var cables = new[]
        {
            new Cable { SourcePortId = portA1.Id, TargetPortId = portB1.Id, CableType = "光纤" },
            new Cable { SourcePortId = portA2.Id, TargetPortId = portB2.Id, CableType = "铜缆" }
        };

        await SeedTopologyAsync(
            [roomA, roomB],
            [rackA, rackB],
            [serverA, serverB],
            [
                new ServerPosition
                {
                    ServerId = serverA.Id,
                    RackId = rackA.Id,
                    StartU = 1,
                    EndU = 1,
                    Status = "在架"
                },
                new ServerPosition
                {
                    ServerId = serverB.Id,
                    RackId = rackB.Id,
                    StartU = 1,
                    EndU = 1,
                    Status = "在架"
                }
            ],
            [portA1, portA2, portB1, portB2],
            cables);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync("/api/rooms/topology");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var root = document.RootElement;
        var rooms = root.GetProperty("rooms").EnumerateArray().ToArray();
        Assert.Equal(2, rooms.Length);
        var roomPayload = Assert.Single(rooms, room => room.GetProperty("name").GetString() == "机房A");
        Assert.Equal(10, roomPayload.GetProperty("topologyX").GetDouble());
        Assert.Equal(20, roomPayload.GetProperty("topologyY").GetDouble());
        Assert.Equal(1, roomPayload.GetProperty("rackCount").GetInt32());
        Assert.Equal(1, roomPayload.GetProperty("serverCount").GetInt32());
        Assert.Equal(2, roomPayload.GetProperty("cableCount").GetInt32());

        var connections = root.GetProperty("connections").EnumerateArray().ToArray();
        var connection = Assert.Single(connections);
        Assert.Equal(2, connection.GetProperty("cableCount").GetInt32());
        var types = connection.GetProperty("types").EnumerateArray().Select(item => item.GetString()).Order().ToArray();
        Assert.Equal(["光纤", "铜缆"], types);
        Assert.Contains(
            new[] { roomA.Id, roomB.Id },
            id => id == Guid.Parse(connection.GetProperty("sourceRoomId").GetString()!));
        Assert.Contains(
            new[] { roomA.Id, roomB.Id },
            id => id == Guid.Parse(connection.GetProperty("targetRoomId").GetString()!));
        Assert.Equal(2, connection.GetProperty("cables").GetArrayLength());
        await ClearTopologyAsync();
    }

    [Fact]
    public async Task GetTopologyWithRoomIdReturnsRackBundles()
    {
        var room = new Room { Name = "机房A", Status = "启用", TopologyX = 0, TopologyY = 0 };
        var rack1 = new Rack { RoomId = room.Id, Code = "R1", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var rack2 = new Rack { RoomId = room.Id, Code = "R2", HeightU = 42, X = 2, Y = 0, Z = 0 };
        var server1 = new Server
        {
            Name = "sw-1",
            ManagementIP = "10.0.1.1",
            DeviceType = "交换机",
            DeviceHeight = 1,
            OperationalStatus = "正常",
            PositionStatus = "在架"
        };
        var server2 = new Server
        {
            Name = "sw-2",
            ManagementIP = "10.0.1.2",
            DeviceType = "交换机",
            DeviceHeight = 1,
            OperationalStatus = "正常",
            PositionStatus = "在架"
        };
        var port1 = new Port { ServerId = server1.Id, PortName = "p1", PortType = "RJ45" };
        var port2 = new Port { ServerId = server2.Id, PortName = "p1", PortType = "RJ45" };

        await SeedTopologyAsync(
            [room],
            [rack1, rack2],
            [server1, server2],
            [
                new ServerPosition
                {
                    ServerId = server1.Id,
                    RackId = rack1.Id,
                    StartU = 1,
                    EndU = 1,
                    Status = "在架"
                },
                new ServerPosition
                {
                    ServerId = server2.Id,
                    RackId = rack2.Id,
                    StartU = 1,
                    EndU = 1,
                    Status = "在架"
                }
            ],
            [port1, port2],
            [new Cable { SourcePortId = port1.Id, TargetPortId = port2.Id, CableType = "DAC" }]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync($"/api/rooms/topology?roomId={room.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var root = document.RootElement;
        Assert.Equal(2, root.GetProperty("racks").GetArrayLength());
        var connection = Assert.Single(root.GetProperty("connections").EnumerateArray());
        Assert.Equal(1, connection.GetProperty("cableCount").GetInt32());
        Assert.Equal(["DAC"], connection.GetProperty("types").EnumerateArray().Select(item => item.GetString()).ToArray());
        Assert.Contains(
            new[] { rack1.Id, rack2.Id },
            id => id == Guid.Parse(connection.GetProperty("sourceRackId").GetString()!));
        Assert.Contains(
            new[] { rack1.Id, rack2.Id },
            id => id == Guid.Parse(connection.GetProperty("targetRackId").GetString()!));
        await ClearTopologyAsync();
    }

    [Fact]
    public async Task GetTopologyUnknownRoomReturnsNotFound()
    {
        await SeedTopologyAsync([], [], [], [], [], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync($"/api/rooms/topology?roomId={Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal("机房不存在", document.RootElement.GetProperty("error").GetString());
        await ClearTopologyAsync();
    }

    [Fact]
    public async Task AnonymousCannotGetTopology()
    {
        using var client = fixture.CreateClient();

        using var response = await client.GetAsync("/api/rooms/topology");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetCableSceneReturnsAllMountedDevicesAndPortSpeed()
    {
        var room = new Room { Name = "机房C", Status = "启用", TopologyX = 0, TopologyY = 0 };
        var rack = new Rack { RoomId = room.Id, Code = "C-01", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var switchServer = new Server
        {
            Name = "sw-core",
            ManagementIP = "10.0.2.1",
            DeviceType = "交换机",
            DeviceHeight = 1,
            OperationalStatus = "正常",
            PositionStatus = "在架"
        };
        var appServer = new Server
        {
            Name = "app-01",
            ManagementIP = "10.0.2.2",
            DeviceType = "服务器",
            DeviceHeight = 2,
            OperationalStatus = "维护",
            PositionStatus = "在架"
        };
        var switchPort = new Port { ServerId = switchServer.Id, PortName = "GE0/1", PortType = "RJ45", Speed = "10G" };
        var appPort = new Port { ServerId = appServer.Id, PortName = "eth0", PortType = "RJ45", Speed = null };
        var cable = new Cable
        {
            SourcePortId = switchPort.Id,
            TargetPortId = appPort.Id,
            CableType = "铜缆",
            Purpose = "上联"
        };

        await SeedTopologyAsync(
            [room],
            [rack],
            [switchServer, appServer],
            [
                new ServerPosition
                {
                    ServerId = switchServer.Id,
                    RackId = rack.Id,
                    StartU = 40,
                    EndU = 40,
                    Status = "在架"
                },
                new ServerPosition
                {
                    ServerId = appServer.Id,
                    RackId = rack.Id,
                    StartU = 1,
                    EndU = 2,
                    Status = "在架"
                }
            ],
            [switchPort, appPort],
            [cable]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync($"/api/rooms/{room.Id}/cable-scene");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var root = document.RootElement;
        var devices = root.GetProperty("devices").EnumerateArray().ToArray();
        Assert.Equal(2, devices.Length);
        Assert.Contains(devices, d => d.GetProperty("deviceName").GetString() == "app-01");
        Assert.Contains(devices, d => d.GetProperty("deviceName").GetString() == "sw-core");
        var appDevice = Assert.Single(devices, d => d.GetProperty("deviceName").GetString() == "app-01");
        Assert.Equal("维护", appDevice.GetProperty("operationalStatus").GetString());

        var cablePayload = Assert.Single(root.GetProperty("cables").EnumerateArray());
        Assert.Equal("10G", cablePayload.GetProperty("source").GetProperty("speed").GetString());
        Assert.Equal(JsonValueKind.Null, cablePayload.GetProperty("target").GetProperty("speed").ValueKind);
        await ClearTopologyAsync();
    }

    private async Task SeedTopologyAsync(
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

    private async Task ClearTopologyAsync()
    {
        await SeedTopologyAsync([], [], [], [], [], []);
    }

    private async Task LoginAsRoleAsync(HttpClient client, string role)
    {
        var username = $"topology-{Guid.NewGuid():N}";
        const string password = "topology-test-password";
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
            var user = new User { Username = username, Role = role, Enabled = true };
            var passwordHash = hasher.HashPassword(user, password);
            user.PasswordHash = passwordHash;
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
}
