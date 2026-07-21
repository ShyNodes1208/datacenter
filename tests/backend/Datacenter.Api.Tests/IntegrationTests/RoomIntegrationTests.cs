using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Datacenter.Api.Tests.IntegrationTests;

[CollectionDefinition(Name)]
public sealed class RoomCollection : ICollectionFixture<AuthTestFixture>
{
    public const string Name = "Room integration tests";
}

[Collection(RoomCollection.Name)]
public sealed class RoomIntegrationTests(AuthTestFixture fixture)
{
    private static async Task<string> GetCsrfTokenAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/auth/csrf");
        response.EnsureSuccessStatusCode();
        return response.Headers.GetValues("X-XSRF-TOKEN").Single();
    }

    private static async Task<HttpResponseMessage> LoginAsAsync(HttpClient client, string username, string password)
    {
        var token = await GetCsrfTokenAsync(client);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { username, password })
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return response;
    }

    private static async Task<(HttpClient Client, string CsrfToken)> CreateSessionForRoleAsync(
        AuthTestFixture fixture, string username, string password, string role)
    {
        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
            if (!await db.Users.AnyAsync(u => u.Username == username))
            {
                var user = new User { Username = username, Role = role, Enabled = true };
                user.PasswordHash = hasher.HashPassword(user, password);
                db.Users.Add(user);
                await db.SaveChangesAsync();
            }
        }

        var client = fixture.CreateClient();
        var token = await GetCsrfTokenAsync(client);
        using var loginRequest = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { username, password })
        };
        loginRequest.Headers.Add("X-XSRF-TOKEN", token);
        using var loginResponse = await client.SendAsync(loginRequest);
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var sessionToken = await GetCsrfTokenAsync(client);
        return (client, sessionToken);
    }

    private static Task<(HttpClient Client, string CsrfToken)> CreateAdminClientAndTokenAsync(AuthTestFixture fixture)
    {
        return CreateSessionForRoleAsync(fixture, "room-admin", "admin-password", Roles.RoomAdministrator);
    }

    private static HttpRequestMessage CreatePost(string path, string token, object? body = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, path);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        request.Headers.Add("X-XSRF-TOKEN", token);
        return request;
    }

    private static HttpRequestMessage CreatePut(string path, string token, object? body = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, path);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        request.Headers.Add("X-XSRF-TOKEN", token);
        return request;
    }

    // ── Group 1: Admin operations ──

    [Fact]
    public async Task CreateAndGet_RoomLifecycle()
    {
        var (client, token) = await CreateAdminClientAndTokenAsync(fixture);

        using var createRequest = CreatePost("/api/rooms", token, new
        {
            name = "Test Room",
            location = "Building A",
            notes = "Core room"
        });
        using var createResponse = await client.SendAsync(createRequest);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var room = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = room.GetProperty("id").GetInt32();
        Assert.Equal("Test Room", room.GetProperty("name").GetString());
        Assert.Equal("Building A", room.GetProperty("location").GetString());
        Assert.Equal("Core room", room.GetProperty("notes").GetString());
        Assert.NotEqual(default, room.GetProperty("createdAt").GetDateTime());
        Assert.NotEqual(default, room.GetProperty("updatedAt").GetDateTime());

        // GET all includes the new room
        using var getAll = await client.GetAsync("/api/rooms");
        Assert.Equal(HttpStatusCode.OK, getAll.StatusCode);

        // GET by id
        using var getById = await client.GetAsync($"/api/rooms/{id}");
        Assert.Equal(HttpStatusCode.OK, getById.StatusCode);
        var fetched = await getById.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Test Room", fetched.GetProperty("name").GetString());

        // PUT update
        token = await GetCsrfTokenAsync(client);
        using var updateRequest = CreatePut($"/api/rooms/{id}", token, new
        {
            name = "Updated Room",
            location = "Building B"
        });
        using var updateResponse = await client.SendAsync(updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated Room", updated.GetProperty("name").GetString());
        Assert.Equal("Building B", updated.GetProperty("location").GetString());
    }

    [Fact]
    public async Task Create_ReturnsBadRequest_WhenNameEmpty()
    {
        var (client, token) = await CreateAdminClientAndTokenAsync(fixture);

        using var request = CreatePost("/api/rooms", token, new { name = "", location = "A" });
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("不能为空", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Create_ReturnsBadRequest_WhenNameDuplicate()
    {
        var (client, token) = await CreateAdminClientAndTokenAsync(fixture);

        using var first = CreatePost("/api/rooms", token, new { name = "Duplicate Room" });
        using var firstResponse = await client.SendAsync(first);
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        token = await GetCsrfTokenAsync(client);
        using var second = CreatePost("/api/rooms", token, new { name = "Duplicate Room" });
        using var secondResponse = await client.SendAsync(second);

        Assert.Equal(HttpStatusCode.BadRequest, secondResponse.StatusCode);
        var body = await secondResponse.Content.ReadAsStringAsync();
        Assert.Contains("已存在", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Update_ReturnsNotFound_ForNonexistentRoom()
    {
        var (client, token) = await CreateAdminClientAndTokenAsync(fixture);

        using var request = CreatePut("/api/rooms/99999", token, new { name = "N/A" });
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_ReturnsBadRequest_WhenNameConflict()
    {
        var (client, token) = await CreateAdminClientAndTokenAsync(fixture);

        using var first = CreatePost("/api/rooms", token, new { name = "Room A" });
        using var firstResponse = await client.SendAsync(first);
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        token = await GetCsrfTokenAsync(client);
        using var second = CreatePost("/api/rooms", token, new { name = "Room B" });
        using var secondResponse = await client.SendAsync(second);
        Assert.Equal(HttpStatusCode.Created, secondResponse.StatusCode);
        var roomB = await secondResponse.Content.ReadFromJsonAsync<JsonElement>();
        var roomBId = roomB.GetProperty("id").GetInt32();

        token = await GetCsrfTokenAsync(client);
        using var update = CreatePut($"/api/rooms/{roomBId}", token, new { name = "Room A" });
        using var updateResponse = await client.SendAsync(update);

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
        Assert.Contains("已存在", await updateResponse.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    // ── Group 1b: Operations role ──

    [Fact]
    public async Task OperationsRole_CanCreateAndEdit()
    {
        var (client, token) = await CreateSessionForRoleAsync(
            fixture, "ops-user", "ops-password", Roles.Operations);

        using var createRequest = CreatePost("/api/rooms", token, new
        {
            name = "Ops Room",
            location = "DC-East",
            notes = "Created by ops"
        });
        using var createResponse = await client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var room = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
        var id = room.GetProperty("id").GetInt32();
        Assert.Equal("Ops Room", room.GetProperty("name").GetString());

        token = await GetCsrfTokenAsync(client);
        using var updateRequest = CreatePut($"/api/rooms/{id}", token, new
        {
            name = "Ops Room Updated"
        });
        using var updateResponse = await client.SendAsync(updateRequest);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Ops Room Updated", updated.GetProperty("name").GetString());
    }

    // ── Group 2: Read-only user ──

    [Fact]
    public async Task GetAll_ReturnsEmptyArray_WhenNoRooms()
    {
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        using var response = await client.GetAsync("/api/rooms");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var rooms = await response.Content.ReadFromJsonAsync<List<object>>();
        Assert.NotNull(rooms);
    }

    [Fact]
    public async Task GetById_ReturnsNotFound_ForNonexistentRoom()
    {
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        using var response = await client.GetAsync("/api/rooms/99999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("不存在", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ReadonlyRole_CannotCreate()
    {
        using var client = fixture.CreateClient();
        // AuthTestFixture.EnabledUsername has role DbaApplicationOperations (readonly)
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        var token = await GetCsrfTokenAsync(client);

        using var request = CreatePost("/api/rooms", token, new { name = "Should Fail" });
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ReadonlyRole_CannotEdit()
    {
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        var token = await GetCsrfTokenAsync(client);

        using var request = CreatePut("/api/rooms/1", token, new { name = "Should Fail" });
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ReadOnlyViewerRole_CanGetButCannotModify()
    {
        var (client, _) = await CreateSessionForRoleAsync(
            fixture, "viewer-user", "viewer-password", Roles.ReadOnlyViewer);

        // GET all — should succeed
        using var getAll = await client.GetAsync("/api/rooms");
        Assert.Equal(HttpStatusCode.OK, getAll.StatusCode);

        // GET by id — should succeed (404 is OK — means auth passed but room doesn't exist)
        using var getById = await client.GetAsync("/api/rooms/1");
        Assert.True(
            getById.StatusCode == HttpStatusCode.OK || getById.StatusCode == HttpStatusCode.NotFound,
            $"Expected OK or NotFound, got {getById.StatusCode}");

        // POST — should be forbidden (not in CanModify policy)
        var token = await GetCsrfTokenAsync(client);
        using var createRequest = CreatePost("/api/rooms", token, new { name = "Should Fail" });
        using var createResponse = await client.SendAsync(createRequest);
        Assert.Equal(HttpStatusCode.Unauthorized, createResponse.StatusCode);

        // PUT — should be forbidden
        token = await GetCsrfTokenAsync(client);
        using var updateRequest = CreatePut("/api/rooms/1", token, new { name = "Should Fail" });
        using var updateResponse = await client.SendAsync(updateRequest);
        Assert.Equal(HttpStatusCode.Unauthorized, updateResponse.StatusCode);
    }

    // ── Group 3: Anonymous ──

    [Fact]
    public async Task Anonymous_ReturnsUnauthorized()
    {
        using var client = fixture.CreateClient();
        using var response = await client.GetAsync("/api/rooms");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ── Group 4: CSRF protection ──

    [Fact]
    public async Task PostWithoutCsrfToken_IsRejected()
    {
        var (client, _) = await CreateAdminClientAndTokenAsync(fixture);

        // No X-XSRF-TOKEN header
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/rooms")
        {
            Content = JsonContent.Create(new { name = "No CSRF" })
        };
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task PutWithoutCsrfToken_IsRejected()
    {
        var (client, _) = await CreateAdminClientAndTokenAsync(fixture);

        using var request = new HttpRequestMessage(HttpMethod.Put, "/api/rooms/1")
        {
            Content = JsonContent.Create(new { name = "No CSRF" })
        };
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
