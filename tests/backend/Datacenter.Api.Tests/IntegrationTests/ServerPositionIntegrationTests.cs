using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Datacenter.Api.Tests.IntegrationTests;

[Collection(AuthCollection.Name)]
public sealed class ServerPositionIntegrationTests(AuthTestFixture fixture)
{
    public static TheoryData<string> AdministratorsAndOperations => new()
    {
        Roles.RoomAdministrator,
        Roles.Operations
    };

    public static TheoryData<string> ReadOnlyRoles => new()
    {
        Roles.DbaApplicationOperations,
        Roles.ReadOnlyViewer
    };

    [Theory]
    [MemberData(nameof(AdministratorsAndOperations))]
    public async Task UnrackedServerCanBeRackedToFreeUPosition(string role)
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        await ReplaceDataAsync([room], [rack], [server], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PostRackAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.NotEqual(Guid.Empty, document.RootElement.GetProperty("serverPositionId").GetGuid());
        Assert.Equal("web-01", document.RootElement.GetProperty("serverName").GetString());
        Assert.Equal("R001", document.RootElement.GetProperty("rackCode").GetString());
        Assert.Equal(10, document.RootElement.GetProperty("startU").GetInt32());
        Assert.Equal(11, document.RootElement.GetProperty("endU").GetInt32());

        var serverPosition = await FindServerPositionAsync(server.Id);
        Assert.NotNull(serverPosition);
        Assert.Equal(rack.Id, serverPosition.RackId);
        Assert.Equal(10, serverPosition.StartU);
        Assert.Equal(11, serverPosition.EndU);
        Assert.Equal("在架", serverPosition.Status);

        var updatedServer = await FindServerAsync(server.Id);
        Assert.NotNull(updatedServer);
        Assert.Equal("在架", updatedServer.PositionStatus);
    }

    [Theory]
    [MemberData(nameof(AdministratorsAndOperations))]
    public async Task OffTheShelfServerCanBeReRacked(string role)
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "已下架"
        };
        await ReplaceDataAsync([room], [rack], [server], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PostRackAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 5
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var updatedServer = await FindServerAsync(server.Id);
        Assert.NotNull(updatedServer);
        Assert.Equal("在架", updatedServer.PositionStatus);
    }

    [Fact]
    public async Task AlreadyRackedServerReturnsBadRequest()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "在架"
        };
        await ReplaceDataAsync([room], [rack], [server], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRackAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("服务器已在架，不能重复上架", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task UPOutOfRangeReturnsBadRequest()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 4,
            PositionStatus = "未上架"
        };
        await ReplaceDataAsync([room], [rack], [server], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRackAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 40
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("U位超出机柜范围", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task UConflictWithExistingPositionReturnsConflict()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server1 = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "在架"
        };
        var server2 = new Server
        {
            Name = "db-01",
            ManagementIP = "10.0.0.2",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        var existingPosition = new ServerPosition
        {
            ServerId = server1.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server1, server2], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRackAsync(client, server2.Id, new
        {
            rackId = rack.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("目标U位范围与已有在架设备冲突", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task PartiallyOverlappingUPositionsReturnConflict()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server1 = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 4,
            PositionStatus = "在架"
        };
        var server2 = new Server
        {
            Name = "db-01",
            ManagementIP = "10.0.0.2",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        var existingPosition = new ServerPosition
        {
            ServerId = server1.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 13,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server1, server2], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRackAsync(client, server2.Id, new
        {
            rackId = rack.Id,
            startU = 12
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("目标U位范围与已有在架设备冲突", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task NonOverlappingUPositionSucceeds()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server1 = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "在架"
        };
        var server2 = new Server
        {
            Name = "db-01",
            ManagementIP = "10.0.0.2",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        var existingPosition = new ServerPosition
        {
            ServerId = server1.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server1, server2], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRackAsync(client, server2.Id, new
        {
            rackId = rack.Id,
            startU = 12
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(12, document.RootElement.GetProperty("startU").GetInt32());
        Assert.Equal(13, document.RootElement.GetProperty("endU").GetInt32());
    }

    [Fact]
    public async Task OffTheShelfPositionsDoNotConflict()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server1 = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "已下架"
        };
        var server2 = new Server
        {
            Name = "db-01",
            ManagementIP = "10.0.0.2",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        var existingPosition = new ServerPosition
        {
            ServerId = server1.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "已下架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server1, server2], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRackAsync(client, server2.Id, new
        {
            rackId = rack.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task DisabledRoomRackReturnsBadRequest()
    {
        var room = new Room { Name = "备用房", Status = "停用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        await ReplaceDataAsync([room], [rack], [server], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRackAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("目标机柜所在机房未启用", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task NonexistentRackReturnsNotFound()
    {
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        await ReplaceDataAsync([], [], [server], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRackAsync(client, server.Id, new
        {
            rackId = Guid.NewGuid(),
            startU = 10
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("机柜不存在", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task StartULessThanOneReturnsBadRequest()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        await ReplaceDataAsync([room], [rack], [server], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRackAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 0
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("起始U位必须大于等于1", await ReadErrorAsync(response));
    }

    [Theory]
    [MemberData(nameof(ReadOnlyRoles))]
    public async Task ReadOnlyRolesCannotRackServer(string role)
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        await ReplaceDataAsync([room], [rack], [server], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PostRackAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AnonymousCannotRackServer()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        await ReplaceDataAsync([room], [rack], [server], []);

        using var client = fixture.CreateClient();

        using var response = await PostRackAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RackMissingCsrfTokenReturnsBadRequest()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        await ReplaceDataAsync([room], [rack], [server], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await client.PostAsJsonAsync($"/api/servers/{server.Id}/rack", new
        {
            rackId = rack.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("防伪令牌缺失或无效", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task GetAllRolesCanViewRackAvailability()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "在架"
        };
        var serverPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 20,
            EndU = 21,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [serverPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync($"/api/racks/{rack.Id}/availability");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(rack.Id, document.RootElement.GetProperty("rackId").GetGuid());
        Assert.Equal("R001", document.RootElement.GetProperty("rackCode").GetString());
        Assert.Equal(42, document.RootElement.GetProperty("heightU").GetInt32());

        var positions = document.RootElement.GetProperty("positions").EnumerateArray().ToArray();
        Assert.Equal(42, positions.Length);

        Assert.Equal(42, positions[0].GetProperty("uNumber").GetInt32());
        Assert.False(positions[0].GetProperty("occupied").GetBoolean());

        var occupied20 = positions.First(p => p.GetProperty("uNumber").GetInt32() == 20);
        Assert.True(occupied20.GetProperty("occupied").GetBoolean());
        Assert.Equal("web-01", occupied20.GetProperty("serverName").GetString());
        Assert.Equal(server.Id, occupied20.GetProperty("serverId").GetGuid());

        var occupied21 = positions.First(p => p.GetProperty("uNumber").GetInt32() == 21);
        Assert.True(occupied21.GetProperty("occupied").GetBoolean());
    }

    [Fact]
    public async Task AnonymousCannotViewAvailability()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        await ReplaceDataAsync([room], [rack], [], []);

        using var client = fixture.CreateClient();

        using var response = await client.GetAsync($"/api/racks/{rack.Id}/availability");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AvailabilityForNonexistentRackReturnsNotFound()
    {
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync($"/api/racks/{Guid.NewGuid()}/availability");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("机柜不存在", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task AvailabilityExcludesOffTheShelfPositions()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "已下架"
        };
        var serverPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 15,
            EndU = 16,
            Status = "已下架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [serverPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await client.GetAsync($"/api/racks/{rack.Id}/availability");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var positions = document.RootElement.GetProperty("positions").EnumerateArray().ToArray();
        var position15 = positions.First(p => p.GetProperty("uNumber").GetInt32() == 15);
        Assert.False(position15.GetProperty("occupied").GetBoolean());
    }

    private async Task ReplaceDataAsync(
        IReadOnlyCollection<Room> rooms,
        IReadOnlyCollection<Rack> racks,
        IReadOnlyCollection<Server> servers,
        IReadOnlyCollection<ServerPosition> serverPositions)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.ServerPositions.RemoveRange(await dbContext.ServerPositions.ToListAsync());
        dbContext.Servers.RemoveRange(await dbContext.Servers.ToListAsync());
        dbContext.Racks.RemoveRange(await dbContext.Racks.ToListAsync());
        dbContext.Rooms.RemoveRange(await dbContext.Rooms.ToListAsync());
        dbContext.Rooms.AddRange(rooms);
        dbContext.Racks.AddRange(racks);
        dbContext.Servers.AddRange(servers);
        dbContext.ServerPositions.AddRange(serverPositions);
        await dbContext.SaveChangesAsync();
    }

    private async Task<ServerPosition?> FindServerPositionAsync(Guid serverId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await dbContext.ServerPositions
            .AsNoTracking()
            .FirstOrDefaultAsync(position => position.ServerId == serverId && position.Status == "在架");
    }

    private async Task<Server?> FindServerAsync(Guid serverId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await dbContext.Servers.AsNoTracking().FirstOrDefaultAsync(server => server.Id == serverId);
    }

    private static async Task<HttpResponseMessage> PostRackAsync(HttpClient client, Guid serverId, object body)
    {
        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/servers/{serverId}/rack")
        {
            Content = JsonContent.Create(body)
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        return await client.SendAsync(request);
    }

    private static async Task<string?> ReadErrorAsync(HttpResponseMessage response)
    {
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return document.RootElement.GetProperty("error").GetString();
    }

    private async Task LoginAsRoleAsync(HttpClient client, string role)
    {
        var username = $"sp-{Guid.NewGuid():N}";
        const string password = "sp-test-password";
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.IPasswordHasher<User>>();
            var user = new User { Username = username, Role = role, Enabled = true };
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
}
