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
public sealed class RoomIntegrationTests(AuthTestFixture fixture)
{
    public static TheoryData<string> NonAdministratorRoles => new()
    {
        Roles.Operations,
        Roles.DbaApplicationOperations,
        Roles.ReadOnlyViewer
    };

    public static TheoryData<string> AuthenticatedRoles => new()
    {
        Roles.RoomAdministrator,
        Roles.Operations,
        Roles.DbaApplicationOperations,
        Roles.ReadOnlyViewer
    };

    [Theory]
    [MemberData(nameof(AuthenticatedRoles))]
    public async Task AuthenticatedRolesCanGetRoomIdNameAndStatus(string role)
    {
        await ReplaceRoomsAsync(
            new Room { Name = "主机房", Status = "启用" },
            new Room { Name = "灾备机房", Status = "停用" });
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await client.GetAsync("/api/rooms");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        var rooms = document.RootElement.EnumerateArray().ToArray();
        Assert.Equal(2, rooms.Length);
        Assert.All(rooms, room => Assert.Equal(["id", "name", "status"], room.EnumerateObject().Select(property => property.Name).Order()));
        Assert.All(rooms, room => Assert.True(Guid.TryParse(room.GetProperty("id").GetString(), out _)));
        Assert.Contains(rooms, room => room.GetProperty("name").GetString() == "主机房" && room.GetProperty("status").GetString() == "启用");
        Assert.Contains(rooms, room => room.GetProperty("name").GetString() == "灾备机房" && room.GetProperty("status").GetString() == "停用");
    }

    [Fact]
    public async Task EmptyRoomTableReturnsEmptyArray()
    {
        await ReplaceRoomsAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync("/api/rooms");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("[]", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task AnonymousRequestReturnsUnauthorized()
    {
        using var client = fixture.CreateClient();

        using var response = await client.GetAsync("/api/rooms");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RoomAdministratorCanCreateRoom()
    {
        await ReplaceRoomsAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRoomAsync(client, "主机房", "启用");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<CreateRoomResult>();
        Assert.Equal(new CreateRoomResult("主机房", "启用"), result);
        Assert.Equal(1, await CountRoomsAsync("主机房", "启用"));
    }

    [Fact]
    public async Task EmptyRoomNameReturnsBadRequestWithoutSaving()
    {
        await ReplaceRoomsAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRoomAsync(client, string.Empty, "启用");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("机房名称不能为空", await ReadErrorAsync(response));
        Assert.Equal(0, await CountRoomsAsync());
    }

    [Fact]
    public async Task WhitespaceRoomNameReturnsBadRequestWithoutSaving()
    {
        await ReplaceRoomsAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRoomAsync(client, "   ", "启用");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await CountRoomsAsync());
    }

    [Fact]
    public async Task RoomNameIsTrimmedBeforeSaving()
    {
        await ReplaceRoomsAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRoomAsync(client, "  主机房  ", "停用");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(1, await CountRoomsAsync("主机房", "停用"));
        Assert.Equal(0, await CountRoomsAsync("  主机房  ", "停用"));
    }

    [Fact]
    public async Task InvalidRoomStatusReturnsBadRequestWithoutSaving()
    {
        await ReplaceRoomsAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostRoomAsync(client, "主机房", "未知");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("状态值无效", await ReadErrorAsync(response));
        Assert.Equal(0, await CountRoomsAsync());
    }

    [Fact]
    public async Task DuplicateRoomNameReturnsConflictAndKeepsSingleRecord()
    {
        await ReplaceRoomsAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var firstResponse = await PostRoomAsync(client, "主机房", "启用");
        using var secondResponse = await PostRoomAsync(client, "主机房", "停用");

        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);
        Assert.Equal("机房名称已存在", await ReadErrorAsync(secondResponse));
        Assert.Equal(1, await CountRoomsByNameAsync("主机房"));
    }

    [Theory]
    [MemberData(nameof(NonAdministratorRoles))]
    public async Task NonAdministratorCannotCreateRoom(string role)
    {
        await ReplaceRoomsAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PostRoomAsync(client, "主机房", "启用");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(0, await CountRoomsAsync());
    }

    [Fact]
    public async Task AnonymousCannotCreateRoom()
    {
        await ReplaceRoomsAsync();
        using var client = fixture.CreateClient();

        using var response = await PostRoomAsync(client, "主机房", "启用");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, await CountRoomsAsync());
    }

    [Fact]
    public async Task RoomAdministratorCanUpdateRoom()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        await ReplaceRoomsAsync(room);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PutRoomAsync(client, room.Id, "核心机房", "停用");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<UpdateRoomResult>();
        Assert.Equal(new UpdateRoomResult(room.Id, "核心机房", "停用"), result);
        Assert.Equal(1, await CountRoomsAsync("核心机房", "停用"));
    }

    [Fact]
    public async Task UpdateEmptyNameReturnsBadRequest()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        await ReplaceRoomsAsync(room);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PutRoomAsync(client, room.Id, string.Empty, "停用");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("机房名称不能为空", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task UpdateDuplicateNameReturnsConflict()
    {
        var firstRoom = new Room { Name = "主机房", Status = "启用" };
        var secondRoom = new Room { Name = "灾备机房", Status = "停用" };
        await ReplaceRoomsAsync(firstRoom, secondRoom);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PutRoomAsync(client, secondRoom.Id, firstRoom.Name, "启用");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("机房名称已存在", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task UpdateNonexistentRoomReturnsNotFound()
    {
        await ReplaceRoomsAsync();
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PutRoomAsync(client, Guid.NewGuid(), "主机房", "启用");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("机房不存在", await ReadErrorAsync(response));
    }

    [Theory]
    [MemberData(nameof(NonAdministratorRoles))]
    public async Task NonAdministratorCannotUpdateRoom(string role)
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        await ReplaceRoomsAsync(room);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, role);

        using var response = await PutRoomAsync(client, room.Id, "核心机房", "停用");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AnonymousCannotUpdateRoom()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        await ReplaceRoomsAsync(room);
        using var client = fixture.CreateClient();

        using var response = await PutRoomAsync(client, room.Id, "核心机房", "停用");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task ReplaceRoomsAsync(params Room[] rooms)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Rooms.RemoveRange(await dbContext.Rooms.ToListAsync());
        dbContext.Rooms.AddRange(rooms);
        await dbContext.SaveChangesAsync();
    }

    private async Task<int> CountRoomsAsync(string? name = null, string? status = null)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var rooms = scope.ServiceProvider.GetRequiredService<AppDbContext>().Rooms.AsNoTracking();
        if (name is not null)
        {
            rooms = rooms.Where(room => room.Name == name);
        }
        if (status is not null)
        {
            rooms = rooms.Where(room => room.Status == status);
        }
        return await rooms.CountAsync();
    }

    private async Task<int> CountRoomsByNameAsync(string name)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<AppDbContext>().Rooms
            .AsNoTracking()
            .CountAsync(room => room.Name == name);
    }

    private static async Task<HttpResponseMessage> PostRoomAsync(HttpClient client, string name, string status)
    {
        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/rooms")
        {
            Content = JsonContent.Create(new { name, status })
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PutRoomAsync(
        HttpClient client, Guid id, string name, string status)
    {
        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/rooms/{id}")
        {
            Content = JsonContent.Create(new { name, status })
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
        var username = $"room-{Guid.NewGuid():N}";
        const string password = "room-test-password";
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

    private sealed record CreateRoomResult(string Name, string Status);

    private sealed record UpdateRoomResult(Guid Id, string Name, string Status);
}
