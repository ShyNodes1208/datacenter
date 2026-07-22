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
    public static TheoryData<string> AuthenticatedRoles => new()
    {
        Roles.RoomAdministrator,
        Roles.Operations,
        Roles.DbaApplicationOperations,
        Roles.ReadOnlyViewer
    };

    [Theory]
    [MemberData(nameof(AuthenticatedRoles))]
    public async Task AuthenticatedRolesCanGetOnlyRoomNameAndStatus(string role)
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
        Assert.All(rooms, room => Assert.Equal(["name", "status"], room.EnumerateObject().Select(property => property.Name).Order()));
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

    private async Task ReplaceRoomsAsync(params Room[] rooms)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Rooms.RemoveRange(await dbContext.Rooms.ToListAsync());
        dbContext.Rooms.AddRange(rooms);
        await dbContext.SaveChangesAsync();
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
}
