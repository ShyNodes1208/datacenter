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

    // ── Move ──────────────────────────────────────────────

    [Theory]
    [MemberData(nameof(AdministratorsAndOperations))]
    public async Task RackedServerCanBeMovedToNewPosition(string role)
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PostMoveAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 20
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal("web-01", document.RootElement.GetProperty("serverName").GetString());
        Assert.Equal(20, document.RootElement.GetProperty("startU").GetInt32());
        Assert.Equal(21, document.RootElement.GetProperty("endU").GetInt32());

        var newPosition = await FindServerPositionAsync(server.Id);
        Assert.NotNull(newPosition);
        Assert.Equal(20, newPosition.StartU);
        Assert.Equal(21, newPosition.EndU);
        Assert.Equal("在架", newPosition.Status);

        var updatedServer = await FindServerAsync(server.Id);
        Assert.NotNull(updatedServer);
        Assert.Equal("在架", updatedServer.PositionStatus);
    }

    [Fact]
    public async Task MoveToDifferentRackSucceeds()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack1 = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var rack2 = new Rack { RoomId = room.Id, Code = "R002", HeightU = 42, X = 1, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "在架"
        };
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack1.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack1, rack2], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostMoveAsync(client, server.Id, new
        {
            rackId = rack2.Id,
            startU = 5
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal("R002", document.RootElement.GetProperty("toRackCode").GetString());

        var newPosition = await FindServerPositionAsync(server.Id);
        Assert.NotNull(newPosition);
        Assert.Equal(rack2.Id, newPosition.RackId);
        Assert.Equal(5, newPosition.StartU);
        Assert.Equal(6, newPosition.EndU);
    }

    [Fact]
    public async Task MoveToSamePositionReturnsBadRequest()
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostMoveAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("移动目标与当前位置相同", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task MoveNonRackedServerReturnsBadRequest()
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

        using var response = await PostMoveAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("服务器不在架，无法移动", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task MoveToDisabledRoomReturnsBadRequest()
    {
        var room = new Room { Name = "旧机房", Status = "停用" };
        var room2 = new Room { Name = "新机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var rackDisabled = new Rack { RoomId = room2.Id, Code = "R002", HeightU = 42, X = 0, Y = 0, Z = 0 };
        // Make room2 disabled
        var disabledRoom = new Room { Name = "停用机房", Status = "停用" };
        var rackInDisabledRoom = new Rack { RoomId = disabledRoom.Id, Code = "R003", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "在架"
        };
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room, room2, disabledRoom], [rack, rackDisabled, rackInDisabledRoom], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostMoveAsync(client, server.Id, new
        {
            rackId = rackInDisabledRoom.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("目标机柜所在机房未启用", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task MoveConflictsWithExistingServerReturnsConflict()
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
            PositionStatus = "在架"
        };
        var pos1 = new ServerPosition
        {
            ServerId = server1.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        var pos2 = new ServerPosition
        {
            ServerId = server2.Id,
            RackId = rack.Id,
            StartU = 20,
            EndU = 21,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server1, server2], [pos1, pos2]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostMoveAsync(client, server1.Id, new
        {
            rackId = rack.Id,
            startU = 20
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("目标U位范围与已有在架设备冲突", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task MoveOutOfBoundsReturnsBadRequest()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 4,
            PositionStatus = "在架"
        };
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 13,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostMoveAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 40
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("U位超出目标机柜范围", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task MoveToNonexistentRackReturnsNotFound()
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostMoveAsync(client, server.Id, new
        {
            rackId = Guid.NewGuid(),
            startU = 10
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("目标机柜不存在", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task MoveNonexistentServerReturnsNotFound()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        await ReplaceDataAsync([room], [rack], [], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostMoveAsync(client, Guid.NewGuid(), new
        {
            rackId = rack.Id,
            startU = 10
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(ReadOnlyRoles))]
    public async Task ReadOnlyRolesCannotMoveServer(string role)
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PostMoveAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 20
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AnonymousCannotMoveServer()
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();

        using var response = await PostMoveAsync(client, server.Id, new
        {
            rackId = rack.Id,
            startU = 20
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task MoveMissingCsrfTokenReturnsBadRequest()
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await client.PostAsJsonAsync($"/api/servers/{server.Id}/move", new
        {
            rackId = rack.Id,
            startU = 20
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("防伪令牌缺失或无效", await ReadErrorAsync(response));
    }

    // ── Decommission ───────────────────────────────────────

    [Theory]
    [MemberData(nameof(AdministratorsAndOperations))]
    public async Task RackedServerCanBeDecommissioned(string role)
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PostDecommissionAsync(client, server.Id);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal("web-01", document.RootElement.GetProperty("serverName").GetString());
        Assert.Equal("服务器已下架", document.RootElement.GetProperty("message").GetString());

        var updatedServer = await FindServerAsync(server.Id);
        Assert.NotNull(updatedServer);
        Assert.Equal("已下架", updatedServer.PositionStatus);

        var position = await FindServerPositionAsync(server.Id);
        Assert.Null(position);
    }

    [Fact]
    public async Task DecommissionNonRackedServerReturnsBadRequest()
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

        using var response = await PostDecommissionAsync(client, server.Id);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("服务器不在架，无法下架", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task DecommissionNonexistentServerReturnsNotFound()
    {
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostDecommissionAsync(client, Guid.NewGuid());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(ReadOnlyRoles))]
    public async Task ReadOnlyRolesCannotDecommission(string role)
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PostDecommissionAsync(client, server.Id);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AnonymousCannotDecommission()
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();

        using var response = await PostDecommissionAsync(client, server.Id);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task DecommissionMissingCsrfTokenReturnsBadRequest()
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await client.PostAsJsonAsync($"/api/servers/{server.Id}/decommission", new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("防伪令牌缺失或无效", await ReadErrorAsync(response));
    }

    // ── Audit Records ──────────────────────────────────────

    [Fact]
    public async Task RackWritesAuditRecord()
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

        await PostRackAsync(client, server.Id, new { rackId = rack.Id, startU = 10 });

        var records = await GetAuditRecordsAsync(server.Id);
        Assert.Single(records);
        Assert.Equal("上架", records[0].OperationType);
        Assert.Null(records[0].FromPosition);
        Assert.Equal("R001 U10-U11", records[0].ToPosition);
    }

    [Fact]
    public async Task MoveWritesAuditRecordWithFromToPosition()
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        await PostMoveAsync(client, server.Id, new { rackId = rack.Id, startU = 20 });

        var records = await GetAuditRecordsAsync(server.Id);
        Assert.Single(records);
        Assert.Equal("移动", records[0].OperationType);
        Assert.Equal("R001 U10-U11", records[0].FromPosition);
        Assert.Equal("R001 U20-U21", records[0].ToPosition);
    }

    [Fact]
    public async Task DecommissionWritesAuditRecord()
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
        var existingPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 10,
            EndU = 11,
            Status = "在架",
            InstalledAt = DateTime.UtcNow
        };
        await ReplaceDataAsync([room], [rack], [server], [existingPosition]);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        await PostDecommissionAsync(client, server.Id);

        var records = await GetAuditRecordsAsync(server.Id);
        Assert.Single(records);
        Assert.Equal("下架", records[0].OperationType);
        Assert.Equal("R001 U10-U11", records[0].FromPosition);
        Assert.Null(records[0].ToPosition);
    }

    [Fact]
    public async Task GetAuditRecords_ReturnsEmptyForServerWithNoOperations()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        await ReplaceDataAsync([room], [], [server], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync($"/api/servers/{server.Id}/audit-records");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(JsonValueKind.Array, document.RootElement.ValueKind);
        Assert.Equal(0, document.RootElement.GetArrayLength());
    }

    [Fact]
    public async Task GetAuditRecords_ReturnsRecordsSortedDescending()
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

        await PostRackAsync(client, server.Id, new { rackId = rack.Id, startU = 10 });
        await Task.Delay(10);
        await PostDecommissionAsync(client, server.Id);

        using var response = await client.GetAsync($"/api/servers/{server.Id}/audit-records");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var records = document.RootElement.EnumerateArray().ToArray();
        Assert.Equal(2, records.Length);
        Assert.Equal("下架", records[0].GetProperty("operationType").GetString());
        Assert.Equal("上架", records[1].GetProperty("operationType").GetString());
    }

    [Fact]
    public async Task GetAuditRecords_NonexistentServerReturnsNotFound()
    {
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync($"/api/servers/{Guid.NewGuid()}/audit-records");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetAuditRecords_AnonymousReturns401()
    {
        using var client = fixture.CreateClient();

        using var response = await client.GetAsync($"/api/servers/{Guid.NewGuid()}/audit-records");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task FullLifecycleProducesThreeAuditRecords()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack1 = new Rack { RoomId = room.Id, Code = "R001", HeightU = 42, X = 0, Y = 0, Z = 0 };
        var rack2 = new Rack { RoomId = room.Id, Code = "R002", HeightU = 42, X = 1, Y = 0, Z = 0 };
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "未上架"
        };
        await ReplaceDataAsync([room], [rack1, rack2], [server], []);

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        // Rack
        await PostRackAsync(client, server.Id, new { rackId = rack1.Id, startU = 10 });
        // Move
        await PostMoveAsync(client, server.Id, new { rackId = rack2.Id, startU = 20 });
        // Decommission
        await PostDecommissionAsync(client, server.Id);

        var records = await GetAuditRecordsAsync(server.Id);
        Assert.Equal(3, records.Count);
        Assert.Equal("上架", records[0].OperationType);
        Assert.Equal("移动", records[1].OperationType);
        Assert.Equal("下架", records[2].OperationType);
    }

    private async Task ReplaceDataAsync(
        IReadOnlyCollection<Room> rooms,
        IReadOnlyCollection<Rack> racks,
        IReadOnlyCollection<Server> servers,
        IReadOnlyCollection<ServerPosition> serverPositions)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.AuditRecords.RemoveRange(await dbContext.AuditRecords.ToListAsync());
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

    private static async Task<HttpResponseMessage> PostMoveAsync(HttpClient client, Guid serverId, object body)
    {
        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/servers/{serverId}/move")
        {
            Content = JsonContent.Create(body)
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PostDecommissionAsync(HttpClient client, Guid serverId)
    {
        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/servers/{serverId}/decommission")
        {
            Content = JsonContent.Create(new { })
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        return await client.SendAsync(request);
    }

    private async Task<List<AuditRecord>> GetAuditRecordsAsync(Guid serverId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await dbContext.AuditRecords
            .AsNoTracking()
            .Where(ar => ar.ServerId == serverId)
            .OrderBy(ar => ar.OperatedAt)
            .ToListAsync();
    }

    private async Task<int> CountAuditRecordsAsync(Guid serverId)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await dbContext.AuditRecords
            .AsNoTracking()
            .CountAsync(ar => ar.ServerId == serverId);
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
