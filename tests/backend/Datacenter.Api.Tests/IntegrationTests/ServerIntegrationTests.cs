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
public sealed class ServerIntegrationTests(AuthTestFixture fixture)
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

    public static TheoryData<string> AllRoles => new()
    {
        Roles.RoomAdministrator,
        Roles.Operations,
        Roles.DbaApplicationOperations,
        Roles.ReadOnlyViewer
    };

    [Theory]
    [MemberData(nameof(AllRoles))]
    public async Task AllRolesCanGetServerList(string role)
    {
        await ReplaceServersAsync(
            new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2 },
            new Server { Name = "db-01", ManagementIP = "10.0.0.2", DeviceType = "机架式服务器", DeviceHeight = 4 });
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await client.GetAsync("/api/servers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var servers = document.RootElement.EnumerateArray().ToArray();
        Assert.Equal(2, servers.Length);
        Assert.Contains(servers, server => server.GetProperty("name").GetString() == "web-01");
        Assert.Contains(servers, server => server.GetProperty("name").GetString() == "db-01");
    }

    [Fact]
    public async Task EmptyServerTableReturnsEmptyArray()
    {
        await ReplaceServersAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync("/api/servers");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task AnonymousRequestReturnsUnauthorized()
    {
        using var client = fixture.CreateClient();

        using var response = await client.GetAsync("/api/servers");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetFilterByNameReturnsMatchingServers()
    {
        await ReplaceServersAsync(
            new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2 },
            new Server { Name = "db-01", ManagementIP = "10.0.0.2", DeviceType = "机架式服务器", DeviceHeight = 4 });
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.Operations);

        using var response = await client.GetAsync("/api/servers?name=web");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var servers = document.RootElement.EnumerateArray().ToArray();
        Assert.Single(servers);
        Assert.Equal("web-01", servers[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetFilterByIpReturnsMatchingServers()
    {
        await ReplaceServersAsync(
            new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2 },
            new Server { Name = "db-01", ManagementIP = "192.168.1.1", DeviceType = "机架式服务器", DeviceHeight = 4 });
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.Operations);

        using var response = await client.GetAsync("/api/servers?ip=10.0");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var servers = document.RootElement.EnumerateArray().ToArray();
        Assert.Single(servers);
        Assert.Equal("web-01", servers[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetFilterByAssetNumberReturnsExactMatch()
    {
        await ReplaceServersAsync(
            new Server { Name = "web-01", ManagementIP = "10.0.0.1", AssetNumber = "ASSET-001", DeviceType = "机架式服务器", DeviceHeight = 2 },
            new Server { Name = "db-01", ManagementIP = "10.0.0.2", AssetNumber = "ASSET-002", DeviceType = "机架式服务器", DeviceHeight = 4 });
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.Operations);

        using var response = await client.GetAsync("/api/servers?assetNumber=ASSET-001");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var servers = document.RootElement.EnumerateArray().ToArray();
        Assert.Single(servers);
        Assert.Equal("ASSET-001", servers[0].GetProperty("assetNumber").GetString());
    }

    [Fact]
    public async Task GetFilterByPositionStatusReturnsMatchingServers()
    {
        await ReplaceServersAsync(
            new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2, PositionStatus = "在架" },
            new Server { Name = "db-01", ManagementIP = "10.0.0.2", DeviceType = "机架式服务器", DeviceHeight = 4, PositionStatus = "未上架" });
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.Operations);

        using var response = await client.GetAsync("/api/servers?positionStatus=在架");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var servers = document.RootElement.EnumerateArray().ToArray();
        Assert.Single(servers);
        Assert.Equal("web-01", servers[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetFilterByOperationalStatusReturnsMatchingServers()
    {
        await ReplaceServersAsync(
            new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2, OperationalStatus = "正常" },
            new Server { Name = "db-01", ManagementIP = "10.0.0.2", DeviceType = "机架式服务器", DeviceHeight = 4, OperationalStatus = "维护" });
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.Operations);

        using var response = await client.GetAsync("/api/servers?operationalStatus=维护");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var servers = document.RootElement.EnumerateArray().ToArray();
        Assert.Single(servers);
        Assert.Equal("db-01", servers[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetFilterBySystemReturnsMatchingServers()
    {
        await ReplaceServersAsync(
            new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2, System = "生产系统" },
            new Server { Name = "db-01", ManagementIP = "10.0.0.2", DeviceType = "机架式服务器", DeviceHeight = 4, System = "开发系统" });
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.Operations);

        using var response = await client.GetAsync("/api/servers?system=生产");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var servers = document.RootElement.EnumerateArray().ToArray();
        Assert.Single(servers);
        Assert.Equal("web-01", servers[0].GetProperty("name").GetString());
    }

    [Theory]
    [MemberData(nameof(AllRoles))]
    public async Task AllRolesCanGetServerById(string role)
    {
        var server = new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2 };
        await ReplaceServersAsync(server);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await client.GetAsync($"/api/servers/{server.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal(server.Id, document.RootElement.GetProperty("id").GetGuid());
        Assert.Equal("web-01", document.RootElement.GetProperty("name").GetString());
        Assert.Equal("10.0.0.1", document.RootElement.GetProperty("managementIP").GetString());
    }

    [Fact]
    public async Task GetNonexistentServerReturnsNotFound()
    {
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync($"/api/servers/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("服务器不存在", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task AnonymousCannotGetServerById()
    {
        using var client = fixture.CreateClient();

        using var response = await client.GetAsync($"/api/servers/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(AdministratorsAndOperations))]
    public async Task AdminAndOpsCanCreateServer(string role)
    {
        await ReplaceServersAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PostServerAsync(client, new
        {
            name = "web-01",
            managementIP = "10.0.0.1",
            deviceType = "机架式服务器",
            deviceHeight = 2,
            operationalStatus = "正常",
            positionStatus = "未上架"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(body);
        Assert.True(document.RootElement.TryGetProperty("id", out _));
        Assert.Equal("web-01", document.RootElement.GetProperty("name").GetString());
        Assert.Equal("10.0.0.1", document.RootElement.GetProperty("managementIP").GetString());
        Assert.Equal(1, await CountServersAsync("web-01"));
    }

    [Theory]
    [MemberData(nameof(ReadOnlyRoles))]
    public async Task ReadOnlyRolesCannotCreateServer(string role)
    {
        await ReplaceServersAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PostServerAsync(client, new
        {
            name = "web-01",
            managementIP = "10.0.0.1",
            deviceType = "机架式服务器",
            deviceHeight = 2
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(0, await CountServersAsync());
    }

    [Fact]
    public async Task AnonymousCannotCreateServer()
    {
        await ReplaceServersAsync();
        using var client = fixture.CreateClient();

        using var response = await PostServerAsync(client, new
        {
            name = "web-01",
            managementIP = "10.0.0.1",
            deviceType = "机架式服务器",
            deviceHeight = 2
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, await CountServersAsync());
    }

    [Fact]
    public async Task CreateServerWithDefaultsAssignsDefaultStatuses()
    {
        await ReplaceServersAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostServerAsync(client, new
        {
            name = "web-01",
            managementIP = "10.0.0.1",
            deviceType = "机架式服务器",
            deviceHeight = 2
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal("正常", document.RootElement.GetProperty("operationalStatus").GetString());
        Assert.Equal("未上架", document.RootElement.GetProperty("positionStatus").GetString());
    }

    [Fact]
    public async Task CreateServerWithEmptyNameReturnsBadRequest()
    {
        await ReplaceServersAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostServerAsync(client, new
        {
            name = "",
            managementIP = "10.0.0.1",
            deviceType = "机架式服务器",
            deviceHeight = 2
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("服务器名称不能为空", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task CreateServerWithEmptyManagementIpReturnsBadRequest()
    {
        await ReplaceServersAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostServerAsync(client, new
        {
            name = "web-01",
            managementIP = "",
            deviceType = "机架式服务器",
            deviceHeight = 2
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("管理IP不能为空", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task CreateServerWithEmptyDeviceTypeReturnsBadRequest()
    {
        await ReplaceServersAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostServerAsync(client, new
        {
            name = "web-01",
            managementIP = "10.0.0.1",
            deviceType = "",
            deviceHeight = 2
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("设备类型不能为空", await ReadErrorAsync(response));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task CreateServerWithInvalidDeviceHeightReturnsBadRequest(int height)
    {
        await ReplaceServersAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostServerAsync(client, new
        {
            name = "web-01",
            managementIP = "10.0.0.1",
            deviceType = "机架式服务器",
            deviceHeight = height
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("设备高度必须大于等于1", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task CreateServerWithDuplicateNameReturnsConflict()
    {
        await ReplaceServersAsync(
            new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2 });
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostServerAsync(client, new
        {
            name = "web-01",
            managementIP = "10.0.0.2",
            deviceType = "机架式服务器",
            deviceHeight = 2
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("服务器名称已存在", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task CreateServerWithDuplicateManagementIpReturnsConflict()
    {
        await ReplaceServersAsync(
            new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2 });
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostServerAsync(client, new
        {
            name = "web-02",
            managementIP = "10.0.0.1",
            deviceType = "机架式服务器",
            deviceHeight = 2
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("管理IP已存在", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task CreateServerWithDuplicateAssetNumberReturnsConflict()
    {
        await ReplaceServersAsync(
            new Server { Name = "web-01", ManagementIP = "10.0.0.1", AssetNumber = "ASSET-001", DeviceType = "机架式服务器", DeviceHeight = 2 });
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostServerAsync(client, new
        {
            name = "web-02",
            managementIP = "10.0.0.2",
            assetNumber = "ASSET-001",
            deviceType = "机架式服务器",
            deviceHeight = 2
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("资产编号已存在", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task CreateServerMissingCsrfTokenReturnsBadRequest()
    {
        await ReplaceServersAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await client.PostAsJsonAsync("/api/servers", new
        {
            name = "web-01",
            managementIP = "10.0.0.1",
            deviceType = "机架式服务器",
            deviceHeight = 2
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("防伪令牌缺失或无效", await ReadErrorAsync(response));
    }

    [Theory]
    [MemberData(nameof(AdministratorsAndOperations))]
    public async Task AdminAndOpsCanUpdateServer(string role)
    {
        var server = new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2 };
        await ReplaceServersAsync(server);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PutServerAsync(client, server.Id, new
        {
            name = "web-02",
            managementIP = "10.0.0.2",
            deviceType = "刀片服务器",
            deviceHeight = 4,
            operationalStatus = "维护"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal("web-02", document.RootElement.GetProperty("name").GetString());
        Assert.Equal("10.0.0.2", document.RootElement.GetProperty("managementIP").GetString());
        Assert.Equal("刀片服务器", document.RootElement.GetProperty("deviceType").GetString());
        Assert.Equal(4, document.RootElement.GetProperty("deviceHeight").GetInt32());
        Assert.Equal("维护", document.RootElement.GetProperty("operationalStatus").GetString());
        Assert.Equal(1, await CountServersAsync("web-02"));
    }

    [Fact]
    public async Task UpdateServerCannotModifyPositionStatus()
    {
        var server = new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2, PositionStatus = "未上架" };
        await ReplaceServersAsync(server);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PutServerAsync(client, server.Id, new
        {
            name = "web-01",
            managementIP = "10.0.0.1",
            deviceType = "机架式服务器",
            deviceHeight = 2,
            positionStatus = "在架"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal("未上架", document.RootElement.GetProperty("positionStatus").GetString());
    }

    [Theory]
    [MemberData(nameof(ReadOnlyRoles))]
    public async Task ReadOnlyRolesCannotUpdateServer(string role)
    {
        var server = new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2 };
        await ReplaceServersAsync(server);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PutServerAsync(client, server.Id, new
        {
            name = "web-02",
            managementIP = "10.0.0.2",
            deviceType = "刀片服务器",
            deviceHeight = 4
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AnonymousCannotUpdateServer()
    {
        var server = new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2 };
        await ReplaceServersAsync(server);
        using var client = fixture.CreateClient();

        using var response = await PutServerAsync(client, server.Id, new
        {
            name = "web-02",
            managementIP = "10.0.0.2",
            deviceType = "刀片服务器",
            deviceHeight = 4
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdateNonexistentServerReturnsNotFound()
    {
        await ReplaceServersAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PutServerAsync(client, Guid.NewGuid(), new
        {
            name = "web-01",
            managementIP = "10.0.0.1",
            deviceType = "机架式服务器",
            deviceHeight = 2
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("服务器不存在", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task UpdateDuplicateNameReturnsConflict()
    {
        var server1 = new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2 };
        var server2 = new Server { Name = "db-01", ManagementIP = "10.0.0.2", DeviceType = "机架式服务器", DeviceHeight = 4 };
        await ReplaceServersAsync(server1, server2);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PutServerAsync(client, server2.Id, new
        {
            name = "web-01",
            managementIP = "10.0.0.2",
            deviceType = "机架式服务器",
            deviceHeight = 4
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("服务器名称已存在", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task UpdateWithInvalidOperationalStatusReturnsBadRequest()
    {
        var server = new Server { Name = "web-01", ManagementIP = "10.0.0.1", DeviceType = "机架式服务器", DeviceHeight = 2 };
        await ReplaceServersAsync(server);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PutServerAsync(client, server.Id, new
        {
            name = "web-01",
            managementIP = "10.0.0.1",
            deviceType = "机架式服务器",
            deviceHeight = 2,
            operationalStatus = "无效状态"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("运行状态值无效", await ReadErrorAsync(response));
    }

    private async Task ReplaceServersAsync(params Server[] servers)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Servers.RemoveRange(await dbContext.Servers.ToListAsync());
        dbContext.Servers.AddRange(servers);
        await dbContext.SaveChangesAsync();
    }

    private async Task<int> CountServersAsync(string? name = null)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var servers = scope.ServiceProvider.GetRequiredService<AppDbContext>().Servers.AsNoTracking();
        if (name is not null)
        {
            servers = servers.Where(server => server.Name == name);
        }

        return await servers.CountAsync();
    }

    private static async Task<HttpResponseMessage> PostServerAsync(HttpClient client, object body)
    {
        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/servers")
        {
            Content = JsonContent.Create(body)
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PutServerAsync(HttpClient client, Guid id, object body)
    {
        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/servers/{id}")
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
        var username = $"server-{Guid.NewGuid():N}";
        const string password = "server-test-password";
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
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
