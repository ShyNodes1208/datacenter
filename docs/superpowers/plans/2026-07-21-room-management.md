# 机房管理 (Room Management) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Room CRUD (create, list, detail, edit) with role-based access control — the first business entity users interact with after login.

**Architecture:** Standard 3-layer: Vue 3 SPA pages → ASP.NET Core Controller → Service → EF Core DbContext → SQLite. Zero new dependencies. Reuses existing `useApi`/`useAuth` composables, `AuthTestFixture` test infrastructure, and SSR view test patterns from TASK-0008.

**Tech Stack:** Vue 3 + TypeScript + Vite + Vue Router 4 (frontend), ASP.NET Core 8 + EF Core 8 + SQLite (backend), xUnit + Vitest (tests).

## Global Constraints

- Zero new dependencies (NuGet, npm, or otherwise)
- No `IsActive` field on Room — deferred to Cabinet task
- No DELETE endpoint — not in MVP scope
- No Pinia, Axios, UI component library, or navigation menu
- No generic/reusable components — inline everything until 3rd occurrence
- Role strings: `Roles.RoomAdministrator` (`"机房管理员"`), `Roles.Operations` (`"运维人员"`)
- All timestamps use UTC (`DateTime.UtcNow`)
- Error response format: `{ "error": "message" }` (JSON, matching existing convention)
- CSRF: `[ValidateAntiForgeryToken]` on POST/PUT; token via `X-XSRF-TOKEN` header
- Frontend CSRF flow: call `GET /api/auth/csrf` → extract token from `X-XSRF-TOKEN` response header → pass via `csrfToken` option to `useApi().request()`
- Frontend HTTP: use `useApi().request(path, options)` — no `.get()`/`.post()`/`.put()` convenience wrappers exist
- View tests: SSR pattern (`createSSRApp` + `renderToString` + composable mocking), NO `@vue/test-utils` or jsdom
- Do NOT modify: `useAuth.ts`, `useApi.ts`, `AuthController.cs`, `AuthService.cs`, `Program.cs` auth pipeline, `LoginView.vue`, `HomeView.vue`, `package.json`, `.csproj`, `appsettings.json`

---

### Task 1: Room Entity, DbContext, Migration, RoomService, and Unit Tests

**Files:**
- Create: `src/backend/Datacenter.Api/Models/Room.cs`
- Create: `src/backend/Datacenter.Api/Services/RoomService.cs`
- Create: `tests/backend/Datacenter.Api.Tests/UnitTests/RoomUnitTests.cs`
- Modify: `src/backend/Datacenter.Api/Data/AppDbContext.cs`
- Modify: `src/backend/Datacenter.Api/Program.cs`
- Auto: `src/backend/Datacenter.Api/Migrations/{ts}_AddRooms.cs`
- Auto: `src/backend/Datacenter.Api/Migrations/{ts}_AddRooms.Designer.cs`
- Auto: `src/backend/Datacenter.Api/Migrations/AppDbContextModelSnapshot.cs`

**Interfaces:**
- Consumes: `AppDbContext` (existing), `Roles` constants (existing)
- Produces: `Room` entity, `RoomService` with four methods (see signatures below)

- [ ] **Step 1: Create Room entity model**

Write `src/backend/Datacenter.Api/Models/Room.cs`:

```csharp
namespace Datacenter.Api.Models;

public sealed class Room
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

- [ ] **Step 2: Update AppDbContext with Rooms DbSet and configuration**

Modify `src/backend/Datacenter.Api/Data/AppDbContext.cs`:

Add `using Microsoft.EntityFrameworkCore;` if not already present, then add the `DbSet<Room>` property after the existing `Users` property:

```csharp
public DbSet<Room> Rooms => Set<Room>();
```

Append to `OnModelCreating` after the existing User configuration block:

```csharp
var room = modelBuilder.Entity<Room>();
room.ToTable("Rooms");
room.HasKey(r => r.Id);
room.HasIndex(r => r.Name).IsUnique();
room.Property(r => r.Name).IsRequired();
room.Property(r => r.CreatedAt).IsRequired();
room.Property(r => r.UpdatedAt).IsRequired();
```

Complete file will look like:

```csharp
using Datacenter.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Room> Rooms => Set<Room>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<User>();
        user.ToTable("Users", table => table.HasCheckConstraint(
            "CK_Users_Role",
            $"Role IN ('{Roles.RoomAdministrator}', '{Roles.Operations}', '{Roles.DbaApplicationOperations}', '{Roles.ReadOnlyViewer}')"));
        user.HasKey(item => item.Id);
        user.HasIndex(item => item.Username).IsUnique();
        user.Property(item => item.Username).IsRequired();
        user.Property(item => item.PasswordHash).IsRequired();
        user.Property(item => item.Role).IsRequired();
        user.Property(item => item.CreatedAt).IsRequired();

        var room = modelBuilder.Entity<Room>();
        room.ToTable("Rooms");
        room.HasKey(r => r.Id);
        room.HasIndex(r => r.Name).IsUnique();
        room.Property(r => r.Name).IsRequired();
        room.Property(r => r.CreatedAt).IsRequired();
        room.Property(r => r.UpdatedAt).IsRequired();
    }
}
```

- [ ] **Step 3: Register RoomService in DI**

Modify `src/backend/Datacenter.Api/Program.cs` — add after the existing `builder.Services.AddScoped<AuthService>();` line:

```csharp
builder.Services.AddScoped<RoomService>();
```

- [ ] **Step 4: Build to verify model and DI wiring compile**

Run: `dotnet build src/backend/Datacenter.Api/Datacenter.Api.csproj --no-restore`

Expected: Build succeeded, 0 errors.

- [ ] **Step 5: Generate EF Core migration**

Run: `dotnet ef migrations add AddRooms --project src/backend/Datacenter.Api/Datacenter.Api.csproj`

Expected: Migration files created under `src/backend/Datacenter.Api/Migrations/`.

- [ ] **Step 6: Build again to verify migration compiles**

Run: `dotnet build src/backend/Datacenter.Api/Datacenter.Api.csproj --no-restore`

Expected: Build succeeded, 0 errors.

- [ ] **Step 7: Write failing unit tests for RoomService**

Write `tests/backend/Datacenter.Api.Tests/UnitTests/RoomUnitTests.cs`:

```csharp
using Datacenter.Api.Data;
using Datacenter.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Tests.UnitTests;

public sealed class RoomUnitTests : IDisposable
{
    private readonly AppDbContext _db;

    public RoomUnitTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        _db = new AppDbContext(options);
        _db.Database.OpenConnection();
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
    }

    [Fact]
    public async Task CreateAsync_ReturnsError_WhenNameIsEmpty()
    {
        var service = new RoomService(_db);

        var (room, error) = await service.CreateAsync("", null, null);

        Assert.Null(room);
        Assert.Equal("机房名称不能为空", error);
    }

    [Fact]
    public async Task CreateAsync_ReturnsError_WhenNameIsWhitespace()
    {
        var service = new RoomService(_db);

        var (room, error) = await service.CreateAsync("   ", null, null);

        Assert.Null(room);
        Assert.Equal("机房名称不能为空", error);
    }

    [Fact]
    public async Task CreateAsync_Succeeds_WithValidName()
    {
        var service = new RoomService(_db);

        var (room, error) = await service.CreateAsync("Test Room", "Floor 1", "Notes here");

        Assert.Null(error);
        Assert.NotNull(room);
        Assert.Equal("Test Room", room.Name);
        Assert.Equal("Floor 1", room.Location);
        Assert.Equal("Notes here", room.Notes);
        Assert.NotEqual(default, room.CreatedAt);
        Assert.NotEqual(default, room.UpdatedAt);
    }

    [Fact]
    public async Task CreateAsync_ReturnsError_WhenNameDuplicate()
    {
        var service = new RoomService(_db);
        await service.CreateAsync("Unique Room", null, null);

        var (room, error) = await service.CreateAsync("Unique Room", null, null);

        Assert.Null(room);
        Assert.Equal("机房名称已存在", error);
    }
}
```

- [ ] **Step 8: Run unit tests to verify they fail**

Run: `dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --filter "FullyQualifiedName~RoomUnitTests"`

Expected: FAIL — `RoomService` class does not exist yet.

- [ ] **Step 9: Write RoomService implementation**

Write `src/backend/Datacenter.Api/Services/RoomService.cs`:

```csharp
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Services;

public sealed class RoomService(AppDbContext db)
{
    public async Task<List<Room>> GetAllAsync()
    {
        return await db.Rooms.OrderBy(r => r.Name).ToListAsync();
    }

    public async Task<Room?> GetByIdAsync(int id)
    {
        return await db.Rooms.FindAsync(id);
    }

    public async Task<(Room? Room, string? Error)> CreateAsync(string name, string? location, string? notes)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return (null, "机房名称不能为空");
        }

        var trimmedName = name.Trim();
        var exists = await db.Rooms.AnyAsync(r => r.Name == trimmedName);
        if (exists)
        {
            return (null, "机房名称已存在");
        }

        var room = new Room
        {
            Name = trimmedName,
            Location = location?.Trim(),
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Rooms.Add(room);
        await db.SaveChangesAsync();
        return (room, null);
    }

    public async Task<(Room? Room, string? Error)> UpdateAsync(int id, string? name, string? location, string? notes)
    {
        var room = await db.Rooms.FindAsync(id);
        if (room is null)
        {
            return (null, "机房不存在");
        }

        if (name is not null)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return (null, "机房名称不能为空");
            }

            var trimmed = name.Trim();
            var exists = await db.Rooms.AnyAsync(r => r.Name == trimmed && r.Id != id);
            if (exists)
            {
                return (null, "机房名称已存在");
            }

            room.Name = trimmed;
        }

        if (location is not null)
        {
            room.Location = location.Trim();
        }

        if (notes is not null)
        {
            room.Notes = notes.Trim();
        }

        room.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return (room, null);
    }
}
```

- [ ] **Step 10: Run unit tests to verify they pass**

Run: `dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --filter "FullyQualifiedName~RoomUnitTests"`

Expected: 4/4 PASS.

- [ ] **Step 11: Run all existing tests to verify no regressions**

Run: `dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`

Expected: Existing 28 tests + 4 new = 32 PASS, 0 failures.

- [ ] **Step 12: Commit**

```bash
git add src/backend/Datacenter.Api/Models/Room.cs \
        src/backend/Datacenter.Api/Data/AppDbContext.cs \
        src/backend/Datacenter.Api/Program.cs \
        src/backend/Datacenter.Api/Services/RoomService.cs \
        src/backend/Datacenter.Api/Migrations/ \
        tests/backend/Datacenter.Api.Tests/UnitTests/RoomUnitTests.cs
git commit -m "feat: add Room entity, migration, and RoomService with unit tests"
```

---

### Task 2: RoomsController and Integration Tests

**Files:**
- Create: `src/backend/Datacenter.Api/Controllers/RoomsController.cs`
- Create: `tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs`

**Interfaces:**
- Consumes: `RoomService` (from Task 1), `Roles` constants (existing), `AuthTestFixture` (existing), `AppDbContext` (existing)
- Produces: Four REST endpoints under `/api/rooms`

- [ ] **Step 1: Write request DTOs and RoomsController**

Write `src/backend/Datacenter.Api/Controllers/RoomsController.cs`:

```csharp
using Datacenter.Api.Models;
using Datacenter.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Datacenter.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/rooms")]
public sealed class RoomsController(RoomService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var rooms = await service.GetAllAsync();
        return Ok(rooms);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var room = await service.GetByIdAsync(id);
        if (room is null)
        {
            return NotFound(new { error = "机房不存在" });
        }
        return Ok(room);
    }

    [HttpPost]
    [Authorize(Roles = "机房管理员,运维人员")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Create([FromBody] CreateRoomRequest request)
    {
        var (room, error) = await service.CreateAsync(request.Name, request.Location, request.Notes);
        if (error is not null)
        {
            return BadRequest(new { error });
        }
        return CreatedAtAction(nameof(GetById), new { id = room!.Id }, room);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "机房管理员,运维人员")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateRoomRequest request)
    {
        var (room, error) = await service.UpdateAsync(id, request.Name, request.Location, request.Notes);
        if (error is not null)
        {
            if (error == "机房不存在")
            {
                return NotFound(new { error });
            }
            return BadRequest(new { error });
        }
        return Ok(room);
    }
}

public sealed record CreateRoomRequest(string Name, string? Location, string? Notes);

public sealed record UpdateRoomRequest(string? Name, string? Location, string? Notes);
```

- [ ] **Step 2: Build to verify controller compiles**

Run: `dotnet build src/backend/Datacenter.Api/Datacenter.Api.csproj --no-restore`

Expected: Build succeeded, 0 errors.

- [ ] **Step 3: Write failing integration tests**

Write `tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Datacenter.Api.Models;

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

    [Fact]
    public async Task GetAll_ReturnsEmptyArray_WhenNoRooms()
    {
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        using var response = await client.GetAsync("/api/rooms");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var rooms = await response.Content.ReadFromJsonAsync<List<object>>();
        Assert.NotNull(rooms);
        Assert.Empty(rooms);
    }

    [Fact]
    public async Task CreateAndGet_RoomLifecycle()
    {
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        var token = await GetCsrfTokenAsync(client);

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
        // Notes should be preserved (not passed in update)
    }

    [Fact]
    public async Task Create_ReturnsBadRequest_WhenNameEmpty()
    {
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        var token = await GetCsrfTokenAsync(client);

        using var request = CreatePost("/api/rooms", token, new { name = "", location = "A" });
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("不能为空", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Create_ReturnsBadRequest_WhenNameDuplicate()
    {
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        var token = await GetCsrfTokenAsync(client);

        using var first = CreatePost("/api/rooms", token, new { name = "Duplicate Room" });
        using var firstResponse = await client.SendAsync(first);
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        using var second = CreatePost("/api/rooms", token, new { name = "Duplicate Room" });
        using var secondResponse = await client.SendAsync(second);

        Assert.Equal(HttpStatusCode.BadRequest, secondResponse.StatusCode);
        var body = await secondResponse.Content.ReadAsStringAsync();
        Assert.Contains("已存在", body, StringComparison.Ordinal);
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
    public async Task Update_ReturnsNotFound_ForNonexistentRoom()
    {
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        var token = await GetCsrfTokenAsync(client);

        using var request = CreatePut("/api/rooms/99999", token, new { name = "N/A" });
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_ReturnsBadRequest_WhenNameConflict()
    {
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        var token = await GetCsrfTokenAsync(client);

        using var first = CreatePost("/api/rooms", token, new { name = "Room A" });
        using var firstResponse = await client.SendAsync(first);
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        using var second = CreatePost("/api/rooms", token, new { name = "Room B" });
        using var secondResponse = await client.SendAsync(second);
        Assert.Equal(HttpStatusCode.Created, secondResponse.StatusCode);
        var roomB = await secondResponse.Content.ReadFromJsonAsync<JsonElement>();
        var roomBId = roomB.GetProperty("id").GetInt32();

        using var update = CreatePut($"/api/rooms/{roomBId}", token, new { name = "Room A" });
        using var updateResponse = await client.SendAsync(update);

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
        Assert.Contains("已存在", await updateResponse.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Anonymous_ReturnsUnauthorized()
    {
        using var client = fixture.CreateClient();
        using var response = await client.GetAsync("/api/rooms");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
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

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ReadonlyRole_CannotEdit()
    {
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        var token = await GetCsrfTokenAsync(client);

        using var request = CreatePut("/api/rooms/1", token, new { name = "Should Fail" });
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PostWithoutCsrfToken_IsRejected()
    {
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);

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
        using var client = fixture.CreateClient();
        await LoginAsAsync(client, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);

        using var request = new HttpRequestMessage(HttpMethod.Put, "/api/rooms/1")
        {
            Content = JsonContent.Create(new { name = "No CSRF" })
        };
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
```

Note: `AuthTestFixture.EnabledUsername` has role `DbaApplicationOperations` (read-only). Tests that create/edit rooms need an admin-role user. The test class seeds one in its setup and provides a helper:

```csharp
private static async Task<(HttpClient Client, string Token)> CreateAdminSessionAsync(
    AuthTestFixture fixture)
{
    // Seed admin user once per collection (idempotent)
    await using (var scope = fixture.Factory.Services.CreateAsyncScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
        if (!await db.Users.AnyAsync(u => u.Username == "room-admin"))
        {
            var admin = new User
            {
                Username = "room-admin",
                Role = Roles.RoomAdministrator,
                Enabled = true
            };
            admin.PasswordHash = hasher.HashPassword(admin, "admin-password");
            db.Users.Add(admin);
            await db.SaveChangesAsync();
        }
    }

    var client = fixture.CreateClient();
    var token = await GetCsrfTokenAsync(client);
    using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
    {
        Content = JsonContent.Create(new { username = "room-admin", password = "admin-password" })
    };
    request.Headers.Add("X-XSRF-TOKEN", token);
    using var response = await client.SendAsync(request);
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    return (client, await GetCsrfTokenAsync(client));
}
```

Tests that need admin access call `CreateAdminSessionAsync(fixture)` instead of the default flow. Read-only and anonymous tests use the regular fixture client.

- [ ] **Step 4 (revised): Write integration tests**

Write the complete test file. Tests are organized into three groups:

**Group 1 — Admin operations (use `CreateAdminSessionAsync`):**
- `CreateAndGet_RoomLifecycle` — full CRUD cycle: create (201), get by id (200), update (200), get all includes it
- `Create_ReturnsBadRequest_WhenNameEmpty` — POST with empty name → 400
- `Create_ReturnsBadRequest_WhenNameDuplicate` — two POSTs with same name → first 201, second 400
- `Update_ReturnsNotFound_ForNonexistentRoom` — PUT /api/rooms/99999 → 404
- `Update_ReturnsBadRequest_WhenNameConflict` — create Room A and Room B, then try to rename B to A → 400

**Group 2 — Read-only user (use fixture's default EnabledUsername with DbaApplicationOperations role):**
- `GetAll_ReturnsEmptyArray_WhenNoRooms` — GET → 200, []
- `ReadonlyRole_CannotCreate` — POST → 403
- `ReadonlyRole_CannotEdit` — PUT → 403

**Group 3 — Anonymous (no login):**
- `Anonymous_ReturnsUnauthorized` — GET without auth → 401

**Group 4 — CSRF (use admin session, but omit token):**
- `PostWithoutCsrfToken_IsRejected` — POST without X-XSRF-TOKEN header → 400
- `PutWithoutCsrfToken_IsRejected` — PUT without X-XSRF-TOKEN header → 400
- `GetById_ReturnsNotFound_ForNonexistentRoom` — GET /api/rooms/99999 → 404

```csharp
private static async Task<(HttpClient Client, string CsrfToken)> CreateAdminClientAndTokenAsync(AuthTestFixture fixture)
{
    // Seed an admin user into the test database
    await using (var scope = fixture.Factory.Services.CreateAsyncScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<Datacenter.Api.Data.AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.IPasswordHasher<User>>();
        if (!await db.Users.AnyAsync(u => u.Username == "room-admin"))
        {
            var admin = new User { Username = "room-admin", Role = Roles.RoomAdministrator, Enabled = true };
            admin.PasswordHash = hasher.HashPassword(admin, "admin-password");
            db.Users.Add(admin);
            await db.SaveChangesAsync();
        }
    }

    var client = fixture.CreateClient();
    var token = await GetCsrfTokenAsync(client);
    using var loginRequest = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
    {
        Content = JsonContent.Create(new { username = "room-admin", password = "admin-password" })
    };
    loginRequest.Headers.Add("X-XSRF-TOKEN", token);
    using var loginResponse = await client.SendAsync(loginRequest);
    Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

    var adminToken = await GetCsrfTokenAsync(client);
    return (client, adminToken);
}
```

Then update the tests that need admin access to use `CreateAdminClientAndTokenAsync` instead of the readonly user.

- [ ] **Step 3 (revised): Write integration tests with correct user seeding**

The `RoomIntegrationTests.cs` file above needs the admin-role helper. The complete corrected version is in Step 3. Run the tests to verify they fail (controller endpoints don't exist yet — actually they do since we wrote RoomsController in Step 1, but the tests exercise the full pipeline).

Wait — the test file references `AuthTestFixture` and its helper types. Let me verify the using statements and ensure the test compiles.

Required usings for `RoomIntegrationTests.cs`:
```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
```

- [ ] **Step 4: Run integration tests to verify they pass**

Run: `dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj --filter "FullyQualifiedName~RoomIntegrationTests"`

Expected: All 12 integration tests PASS.

- [ ] **Step 5: Run all backend tests**

Run: `dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`

Expected: 28 existing + 4 unit + 12 integration = 44 PASS, 0 failures. (Note: existing tests include AuthIntegrationTests which may share the AuthTestFixture collection with RoomIntegrationTests — verify no collection fixture conflicts.)

- [ ] **Step 6: Commit**

```bash
git add src/backend/Datacenter.Api/Controllers/RoomsController.cs \
        tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs
git commit -m "feat: add RoomsController with integration tests"
```

---

### Task 3: Router Update, RoomListPage, and Frontend View Tests

**Files:**
- Create: `src/frontend/src/views/RoomListPage.vue`
- Create: `src/frontend/src/__tests__/room-views.test.ts`
- Modify: `src/frontend/src/router.ts`

**Interfaces:**
- Consumes: `useApi` composable (existing), `useAuth` composable (existing), `useRouter` from vue-router (existing), `RoomListPage` component (this task), `RoomDetailPage` component (Task 4)
- Produces: `/rooms` route renders RoomListPage; SSR tests pass

- [ ] **Step 1: Update router**

Modify `src/frontend/src/router.ts`:

Replace the routes array. The current routes are:

```typescript
routes: [
  { path: '/login', component: LoginView },
  { path: '/', component: HomeView, meta: { requiresAuth: true } },
],
```

Replace with:

```typescript
routes: [
  { path: '/login', component: LoginView },
  { path: '/', redirect: '/rooms' },
  { path: '/rooms', component: () => import('../views/RoomListPage.vue'), meta: { requiresAuth: true } },
  { path: '/rooms/:id', component: () => import('../views/RoomDetailPage.vue'), meta: { requiresAuth: true } },
],
```

Note: Use lazy loading (`() => import(...)`) for the room pages. HomeView import at the top of the file can remain (it is no longer referenced in routes but the file is preserved on disk).

Remove the `import HomeView from './views/HomeView.vue'` line if it becomes unused. The `LoginView` import is still needed.

- [ ] **Step 2: Write RoomListPage.vue**

Write `src/frontend/src/views/RoomListPage.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'

interface Room {
  id: number
  name: string
  location: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

const router = useRouter()
const api = useApi()
const { user } = useAuth()

const rooms = ref<Room[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const showCreateForm = ref(false)
const createName = ref('')
const createLocation = ref('')
const createNotes = ref('')
const createError = ref<string | null>(null)
const creating = ref(false)

const canModify = computed(() =>
  user.value?.role === '机房管理员' || user.value?.role === '运维人员'
)

async function fetchRooms(): Promise<void> {
  loading.value = true
  error.value = null
  const result = await api.request<Room[]>('/api/rooms', { method: 'GET' })
  if (result.ok) {
    rooms.value = result.data
  } else {
    error.value = result.error
  }
  loading.value = false
}

async function getCsrfToken(): Promise<string | null> {
  const result = await api.request('/api/auth/csrf', { method: 'GET' })
  if (!result.ok) return null
  return result.headers.get('X-XSRF-TOKEN')
}

function openCreateForm(): void {
  createName.value = ''
  createLocation.value = ''
  createNotes.value = ''
  createError.value = null
  showCreateForm.value = true
}

function cancelCreate(): void {
  showCreateForm.value = false
  createName.value = ''
  createLocation.value = ''
  createNotes.value = ''
  createError.value = null
}

async function submitCreate(): Promise<void> {
  if (creating.value) return
  creating.value = true
  createError.value = null

  const token = await getCsrfToken()
  if (!token) {
    createError.value = 'Request failed.'
    creating.value = false
    return
  }

  const result = await api.request<Room>('/api/rooms', {
    method: 'POST',
    body: { name: createName.value, location: createLocation.value || null, notes: createNotes.value || null },
    csrfToken: token,
  })

  if (result.ok) {
    rooms.value.push(result.data)
    cancelCreate()
  } else {
    createError.value = result.error
  }

  creating.value = false
}

function goToDetail(id: number): void {
  router.push(`/rooms/${id}`)
}

fetchRooms()
</script>

<template>
  <div>
    <h1>机房列表</h1>

    <div v-if="error" role="alert">{{ error }}</div>

    <div v-else-if="loading">加载中...</div>

    <div v-else-if="!rooms.length">
      <p>暂无机房，请创建第一个机房</p>
    </div>

    <table v-else>
      <thead>
        <tr>
          <th>名称</th>
          <th>位置</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="room in rooms" :key="room.id" @click="goToDetail(room.id)" style="cursor: pointer;">
          <td>{{ room.name }}</td>
          <td>{{ room.location || '—' }}</td>
        </tr>
      </tbody>
    </table>

    <button v-if="canModify && !showCreateForm" type="button" @click="openCreateForm">
      新建机房
    </button>

    <form v-if="showCreateForm" @submit.prevent="submitCreate">
      <h2>新建机房</h2>
      <label>
        名称
        <input v-model="createName" type="text" required />
      </label>
      <label>
        位置
        <input v-model="createLocation" type="text" />
      </label>
      <label>
        备注
        <textarea v-model="createNotes"></textarea>
      </label>
      <div v-if="createError" role="alert">{{ createError }}</div>
      <button type="submit" :disabled="creating">创建</button>
      <button type="button" @click="cancelCreate">取消</button>
    </form>
  </div>
</template>
```

- [ ] **Step 3: Write failing frontend view tests**

Write `src/frontend/src/__tests__/room-views.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'

const userMock = ref<{ id: string; username: string; role: string } | null>(null)

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    user: userMock,
  }),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    createWebHistory: () => actual.createMemoryHistory(),
    useRouter: () => ({
      push: vi.fn(),
    }),
  }
})

afterEach(() => {
  userMock.value = null
  vi.unstubAllGlobals()
})

describe('RoomListPage SSR render', () => {
  it('renders without crashing', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))

    const { default: RoomListPage } = await import('../views/RoomListPage.vue')
    const app = createSSRApp(RoomListPage)
    const html = await renderToString(app)

    expect(html).toContain('机房列表')
  })

  it('shows empty state when no rooms exist', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))

    const { default: RoomListPage } = await import('../views/RoomListPage.vue')
    const app = createSSRApp(RoomListPage)
    const html = await renderToString(app)

    expect(html).toContain('暂无机房')
  })

  it('renders room names in the output when data is present', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify([
        { id: 1, name: 'Room A', location: 'Floor 1', notes: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
        { id: 2, name: 'Room B', location: null, notes: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))

    const { default: RoomListPage } = await import('../views/RoomListPage.vue')
    const app = createSSRApp(RoomListPage)
    const html = await renderToString(app)

    expect(html).toContain('Room A')
    expect(html).toContain('Room B')
    expect(html).toContain('Floor 1')
    expect(html).toContain('—')
  })

  it('shows create button for admin role', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))

    const { default: RoomListPage } = await import('../views/RoomListPage.vue')
    const app = createSSRApp(RoomListPage)
    const html = await renderToString(app)

    expect(html).toContain('新建机房')
  })

  it('hides create button for readonly role', async () => {
    userMock.value = { id: '1', username: 'viewer', role: '只读查看人员' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))

    const { default: RoomListPage } = await import('../views/RoomListPage.vue')
    const app = createSSRApp(RoomListPage)
    const html = await renderToString(app)

    expect(html).not.toContain('新建机房')
  })
})
```

- [ ] **Step 4: Run frontend tests to verify view tests pass**

Run: `npx vitest run src/frontend/src/__tests__/room-views.test.ts`

Expected: 5/5 PASS.

- [ ] **Step 5: Run all frontend tests to verify no regressions**

Run: `npx vitest run`

Expected: 44 existing + 5 new = 49 PASS. (One existing test may need updating — see Task 4 Step 6.)

- [ ] **Step 6: Commit**

```bash
git add src/frontend/src/router.ts \
        src/frontend/src/views/RoomListPage.vue \
        src/frontend/src/__tests__/room-views.test.ts
git commit -m "feat: add RoomListPage with inline create form and view tests"
```

---

### Task 4: RoomDetailPage and Complete Frontend Tests

**Files:**
- Create: `src/frontend/src/views/RoomDetailPage.vue`
- Modify: `src/frontend/src/__tests__/room-views.test.ts` (add detail page tests)

**Interfaces:**
- Consumes: `useApi`, `useAuth`, `useRouter` (existing), route param `id` from `/rooms/:id`
- Produces: Detail view with inline edit toggle for authorized users

- [ ] **Step 1: Write RoomDetailPage.vue**

Write `src/frontend/src/views/RoomDetailPage.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'

interface Room {
  id: number
  name: string
  location: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

const route = useRoute()
const router = useRouter()
const api = useApi()
const { user } = useAuth()

const room = ref<Room | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const editing = ref(false)
const editName = ref('')
const editLocation = ref('')
const editNotes = ref('')
const saveError = ref<string | null>(null)
const saving = ref(false)

const canEdit = computed(() =>
  user.value?.role === '机房管理员' || user.value?.role === '运维人员'
)

async function fetchRoom(): Promise<void> {
  loading.value = true
  error.value = null
  const id = route.params.id as string
  const result = await api.request<Room>(`/api/rooms/${id}`, { method: 'GET' })
  if (result.ok) {
    room.value = result.data
  } else {
    error.value = result.error
  }
  loading.value = false
}

async function getCsrfToken(): Promise<string | null> {
  const result = await api.request('/api/auth/csrf', { method: 'GET' })
  if (!result.ok) return null
  return result.headers.get('X-XSRF-TOKEN')
}

function startEdit(): void {
  if (!room.value) return
  editName.value = room.value.name
  editLocation.value = room.value.location ?? ''
  editNotes.value = room.value.notes ?? ''
  saveError.value = null
  editing.value = true
}

function cancelEdit(): void {
  editing.value = false
  saveError.value = null
}

async function save(): Promise<void> {
  if (saving.value || !room.value) return
  saving.value = true
  saveError.value = null

  const token = await getCsrfToken()
  if (!token) {
    saveError.value = 'Request failed.'
    saving.value = false
    return
  }

  const body: Record<string, string | null> = {
    name: editName.value || null,
    location: editLocation.value || null,
    notes: editNotes.value || null,
  }

  const result = await api.request<Room>(`/api/rooms/${room.value.id}`, {
    method: 'PUT',
    body,
    csrfToken: token,
  })

  if (result.ok) {
    room.value = result.data
    editing.value = false
  } else {
    saveError.value = result.error
  }

  saving.value = false
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function goBack(): void {
  router.push('/rooms')
}

fetchRoom()
</script>

<template>
  <div>
    <div v-if="error" role="alert">{{ error }}</div>

    <div v-else-if="loading">加载中...</div>

    <template v-else-if="room">
      <h1>{{ room.name }}</h1>

      <!-- View mode -->
      <dl v-if="!editing">
        <dt>名称</dt>
        <dd>{{ room.name }}</dd>
        <dt>位置</dt>
        <dd>{{ room.location || '—' }}</dd>
        <dt>备注</dt>
        <dd>{{ room.notes || '—' }}</dd>
        <dt>创建时间</dt>
        <dd>{{ formatDate(room.createdAt) }}</dd>
        <dt>更新时间</dt>
        <dd>{{ formatDate(room.updatedAt) }}</dd>
      </dl>

      <!-- Edit mode -->
      <form v-else @submit.prevent="save">
        <label>
          名称
          <input v-model="editName" type="text" required />
        </label>
        <label>
          位置
          <input v-model="editLocation" type="text" />
        </label>
        <label>
          备注
          <textarea v-model="editNotes"></textarea>
        </label>
        <div v-if="saveError" role="alert">{{ saveError }}</div>
        <button type="submit" :disabled="saving">保存</button>
        <button type="button" @click="cancelEdit">取消</button>
      </form>

      <button v-if="canEdit && !editing" type="button" @click="startEdit">编辑</button>
      <a @click.prevent="goBack" href="/rooms">← 返回列表</a>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Add RoomDetailPage tests to room-views.test.ts**

Append to `src/frontend/src/__tests__/room-views.test.ts`:

```typescript
describe('RoomDetailPage SSR render', () => {
  // RoomDetailPage uses useRoute() which requires a router instance during SSR.
  // Use the same pattern as renderLoginViewHtml in router-and-views.test.ts.
  async function renderRoomDetailHtml(): Promise<string> {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        id: 1, name: 'Room A', location: 'Floor 1', notes: 'Test',
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/rooms/:id', component: { template: '<div />' } },
      ],
    })
    await router.push('/rooms/1')
    await router.isReady()

    const { default: RoomDetailPage } = await import('../views/RoomDetailPage.vue')
    const app = createSSRApp(RoomDetailPage)
    app.use(router)
    return renderToString(app)
  }

  it('renders room name, location and notes', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    const html = await renderRoomDetailHtml()
    expect(html).toContain('Room A')
    expect(html).toContain('Floor 1')
    expect(html).toContain('Test')
  })

  it('shows edit button for admin role', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    const html = await renderRoomDetailHtml()
    expect(html).toContain('编辑')
  })

  it('hides edit button for readonly role', async () => {
    userMock.value = { id: '1', username: 'viewer', role: '只读查看人员' }
    const html = await renderRoomDetailHtml()
    expect(html).not.toContain('编辑')
  })

  it('shows back link to room list', async () => {
    userMock.value = { id: '1', username: 'admin', role: '机房管理员' }
    const html = await renderRoomDetailHtml()
    expect(html).toContain('返回列表')
  })
})

- [ ] **Step 3: Run room view tests**

Run: `npx vitest run src/frontend/src/__tests__/room-views.test.ts`

Expected: 5 (Task 3) + 4 (Task 4) = 9/9 PASS.

If `useRoute()` fails in SSR, update the tests to use the `createRouter` + `app.use(router)` pattern from `router-and-views.test.ts`.

- [ ] **Step 4: Run all frontend tests**

Run: `npx vitest run`

Expected: 44 existing + 9 new = 53 PASS.

One existing test in `router-and-views.test.ts` may fail — the test `redirects anonymous access of / to /login` pushes `/` and expects redirect to `/login`. After our router change, `/` is now a redirect to `/rooms` (which also requires auth → redirects to `/login`). The test should still pass because the guard on `/rooms` will redirect to `/login`.

However, the test `redirects authenticated access of /login to /` expects redirect to `/` — which is now a redirect to `/rooms`. The test asserts `router.currentRoute.value.fullPath` equals `/`. With our change, navigating to `/login` while authenticated redirects to `/` which then redirects to `/rooms`. Vue Router resolves redirects transitively, so the final `fullPath` should be `/rooms`, not `/`. This test will likely fail.

**Fix for the existing test:** The test at `router-and-views.test.ts` line 239:

```typescript
expect(router.currentRoute.value.fullPath).toBe('/')
```

Needs to change to:

```typescript
expect(router.currentRoute.value.fullPath).toBe('/rooms')
```

Update this assertion in `router-and-views.test.ts`.

- [ ] **Step 5: Run full frontend typecheck and build**

Run: `npm run typecheck` (from `src/frontend/`)

Expected: No type errors.

Run: `npm run build` (from `src/frontend/`)

Expected: Build succeeded.

- [ ] **Step 6: Run all backend tests (verify no regressions from frontend work)**

Run: `dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj`

Expected: 44/44 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/frontend/src/views/RoomDetailPage.vue \
        src/frontend/src/__tests__/room-views.test.ts \
        src/frontend/src/__tests__/router-and-views.test.ts
git commit -m "feat: add RoomDetailPage with inline edit and complete view tests"
```

---

## Self-Review

After implementing all 4 tasks, verify end-to-end:

```bash
# Run the full verify script if it exists
pwsh -NoLogo -NoProfile -File ./scripts/verify-project.ps1

# Or manually:
cd src/frontend && npx vitest run && cd ../..
dotnet test tests/backend/Datacenter.Api.Tests/Datacenter.Api.Tests.csproj
```

Expected: All frontend and backend tests pass.

## File Budget Summary

| Type | Count | Files |
|------|-------|-------|
| New | 8 | Room.cs, RoomService.cs, RoomsController.cs, RoomListPage.vue, RoomDetailPage.vue, RoomUnitTests.cs, RoomIntegrationTests.cs, room-views.test.ts |
| Modified | 3 | AppDbContext.cs, Program.cs, router.ts |
| Modified (test fix) | 1 | router-and-views.test.ts |
| Auto (migrations) | 3 | `*_AddRooms.cs`, `*_AddRooms.Designer.cs`, `AppDbContextModelSnapshot.cs` |
| **NOT modified** | — | useAuth.ts, useApi.ts, AuthController.cs, AuthService.cs, LoginView.vue, HomeView.vue, User.cs, Roles.cs, package.json, .csproj, appsettings.json |
