using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Datacenter.Api.Auth;
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Datacenter.Api.Tests.IntegrationTests;

[CollectionDefinition(Name)]
public sealed class AuthCollection : ICollectionFixture<AuthTestFixture>
{
    public const string Name = "Authentication integration tests";
}

[Collection(AuthCollection.Name)]
public sealed class AuthIntegrationTests(AuthTestFixture fixture)
{
    [Fact]
    public async Task CsrfEndpointReturnsTokenAndCookie()
    {
        using var client = fixture.CreateClient();
        using var response = await client.GetAsync("/api/auth/csrf");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace(response.Headers.GetValues("X-XSRF-TOKEN").Single()));
        Assert.Contains(response.Headers.GetValues("Set-Cookie"), value => value.Contains(".AspNetCore.Antiforgery", StringComparison.Ordinal));
    }

    [Fact]
    public async Task LoginWithoutAntiforgeryTokenReturnsJsonBadRequest()
    {
        using var client = fixture.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/auth/login", new
        {
            username = AuthTestFixture.EnabledUsername,
            password = AuthTestFixture.EnabledPassword
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.True((await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync())).RootElement.TryGetProperty("error", out _));
    }

    [Fact]
    public async Task LoginMeAndCookiePropertiesAreCorrect()
    {
        using var client = fixture.CreateClient();
        var token = await GetCsrfTokenAsync(client);
        using var request = CreateLoginRequest(token, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var info = await response.Content.ReadFromJsonAsync<UserInfoResponse>();
        Assert.Equal(AuthTestFixture.EnabledUsername, info?.Username);
        Assert.Equal(Roles.DbaApplicationOperations, info?.Role);
        var cookie = response.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("Datacenter.Auth=", StringComparison.Ordinal));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("expires=", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("max-age=", cookie, StringComparison.OrdinalIgnoreCase);

        using var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.DoesNotContain("passwordHash", await me.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task InvalidCredentialsAndDisabledUserReturnIdenticalUnauthorizedErrors()
    {
        var missing = await AttemptLoginAsync("missing-user", "wrong-password");
        var wrong = await AttemptLoginAsync(AuthTestFixture.EnabledUsername, "wrong-password");
        var disabled = await AttemptLoginAsync(AuthTestFixture.DisabledUsername, AuthTestFixture.DisabledPassword);

        Assert.Equal(HttpStatusCode.Unauthorized, missing.StatusCode);
        Assert.Equal(missing.Body, wrong.Body);
        Assert.Equal(missing.Body, disabled.Body);
    }

    [Fact]
    public async Task AnonymousMeReturnsJsonUnauthorized()
    {
        using var client = fixture.CreateClient();
        using var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("error", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task AnonymousTokenCannotLogoutAuthenticatedUserButNewTokenCan()
    {
        using var client = fixture.CreateClient();
        var anonymousToken = await GetCsrfTokenAsync(client);
        using (var login = CreateLoginRequest(anonymousToken, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword))
        using (var loginResponse = await client.SendAsync(login))
        {
            Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        }

        using (var oldTokenLogout = CreatePost("/api/auth/logout", anonymousToken))
        using (var oldTokenResponse = await client.SendAsync(oldTokenLogout))
        {
            Assert.Equal(HttpStatusCode.BadRequest, oldTokenResponse.StatusCode);
        }

        var authenticatedToken = await GetCsrfTokenAsync(client);
        using (var logout = CreatePost("/api/auth/logout", authenticatedToken))
        using (var logoutResponse = await client.SendAsync(logout))
        {
            Assert.Equal(HttpStatusCode.NoContent, logoutResponse.StatusCode);
        }

        using var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);

        using var secondLogout = CreatePost("/api/auth/logout", authenticatedToken);
        using var secondLogoutResponse = await client.SendAsync(secondLogout);
        Assert.Equal(HttpStatusCode.Unauthorized, secondLogoutResponse.StatusCode);
    }

    [Fact]
    public async Task AuthenticationTicketExpirationDoesNotSlideAcrossAuthenticatedRequests()
    {
        using var client = fixture.CreateClient();
        using var login = await LoginAsync(client);
        var setCookie = login.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith("Datacenter.Auth=", StringComparison.Ordinal));
        var cookieValue = setCookie["Datacenter.Auth=".Length..].Split(';', 2)[0];
        var options = fixture.Factory.Services
            .GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>()
            .Get(CookieAuthenticationDefaults.AuthenticationScheme);
        var ticket = options.TicketDataFormat.Unprotect(cookieValue);

        Assert.False(options.SlidingExpiration);
        Assert.NotNull(ticket?.Properties.ExpiresUtc);
        var originalExpiration = ticket!.Properties.ExpiresUtc;

        for (var requestNumber = 0; requestNumber < 3; requestNumber++)
        {
            using var response = await client.GetAsync("/api/auth/me");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.False(response.Headers.TryGetValues("Set-Cookie", out var cookies)
                && cookies.Any(value => value.StartsWith("Datacenter.Auth=", StringComparison.Ordinal)));
        }

        Assert.Equal(originalExpiration, ticket.Properties.ExpiresUtc);
    }

    [Fact]
    public async Task RoleChangeRejectsOldCookieAndReloginUsesCurrentRole()
    {
        using var client = fixture.CreateClient();
        await LoginAsync(client);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await dbContext.Users.SingleAsync(item => item.Username == AuthTestFixture.EnabledUsername);
            user.Role = Roles.RoomAdministrator;
            await dbContext.SaveChangesAsync();
        }

        using var stale = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, stale.StatusCode);

        using var newClient = fixture.CreateClient();
        using var login = await LoginAsync(newClient);
        var info = await login.Content.ReadFromJsonAsync<UserInfoResponse>();
        Assert.Equal(Roles.RoomAdministrator, info?.Role);
    }

    [Fact]
    public async Task DatabaseFailureRejectsAuthenticatedRequest()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"datacenter-db-failure-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        var databasePath = Path.Combine(directory, $"failure-{Guid.NewGuid():N}.db");
        await using var factory = new AuthTestFixture.TestApplicationFactory(databasePath, "Testing");
        using var client = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), HandleCookies = true });
        await SeedEnabledUserAsync(factory.Services);
        await LoginAsync(client);
        SqliteConnection.ClearAllPools();
        File.Delete(databasePath);
        File.Delete(databasePath + "-wal");
        File.Delete(databasePath + "-shm");

        using var response = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await factory.DisposeAsync();
        Directory.Delete(directory, recursive: true);
    }

    [Fact]
    public async Task WalModeAndRoleConstraintAreEnforced()
    {
        await using var connection = new SqliteConnection($"Data Source={fixture.DatabasePath}");
        await connection.OpenAsync();
        await using (var wal = connection.CreateCommand())
        {
            wal.CommandText = "PRAGMA journal_mode;";
            Assert.Equal("wal", Convert.ToString(await wal.ExecuteScalarAsync()), ignoreCase: true);
        }

        await using var invalidRole = connection.CreateCommand();
        invalidRole.CommandText = "INSERT INTO Users (Id, Username, PasswordHash, Enabled, Role, CreatedAt) VALUES ($id, $name, $hash, 1, $role, $created)";
        invalidRole.Parameters.AddWithValue("$id", Guid.NewGuid());
        invalidRole.Parameters.AddWithValue("$name", $"invalid-{Guid.NewGuid():N}");
        invalidRole.Parameters.AddWithValue("$hash", "not-a-real-secret");
        invalidRole.Parameters.AddWithValue("$role", "超级管理员");
        invalidRole.Parameters.AddWithValue("$created", DateTimeOffset.UtcNow);
        await Assert.ThrowsAsync<SqliteException>(() => invalidRole.ExecuteNonQueryAsync());
    }

    [Fact]
    public async Task DevelopmentBootstrapIsOptionalIdempotentAndProductionSkipsIt()
    {
        var firstDirectory = Path.Combine(Path.GetTempPath(), $"datacenter-bootstrap-{Guid.NewGuid():N}");
        Directory.CreateDirectory(firstDirectory);
        var databasePath = Path.Combine(firstDirectory, "bootstrap.db");
        var settings = new Dictionary<string, string?>
        {
            ["BootstrapAdmin:Username"] = "bootstrap-admin",
            ["BootstrapAdmin:Password"] = "bootstrap-test-password",
            ["BootstrapAdmin:Role"] = Roles.RoomAdministrator
        };

        await using (var development = new AuthTestFixture.TestApplicationFactory(databasePath, "Development", settings))
        {
            using var client = development.CreateClient();
            await client.GetAsync("/api/auth/csrf");
            await client.GetAsync("/api/auth/csrf");
            await using var scope = development.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(1, await db.Users.CountAsync(item => item.Username == "bootstrap-admin"));
        }

        var productionPath = Path.Combine(firstDirectory, "production.db");
        await using (var production = new AuthTestFixture.TestApplicationFactory(productionPath, "Production", settings))
        {
            using var client = production.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
            await client.GetAsync("/api/auth/csrf");
            await using var scope = production.Services.CreateAsyncScope();
            Assert.False(await scope.ServiceProvider.GetRequiredService<AppDbContext>().Users.AnyAsync());
        }

        Directory.Delete(firstDirectory, recursive: true);
    }

    [Fact]
    public async Task DevelopmentBootstrapAcrossApplicationRestartsDoesNotDuplicateOrOverwriteExistingUser()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"datacenter-bootstrap-restart-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        var databasePath = Path.Combine(directory, "bootstrap-restart.db");
        var settings = new Dictionary<string, string?>
        {
            ["BootstrapAdmin:Username"] = "restart-admin",
            ["BootstrapAdmin:Password"] = "initial-bootstrap-password",
            ["BootstrapAdmin:Role"] = Roles.RoomAdministrator
        };

        await using (var first = new AuthTestFixture.TestApplicationFactory(databasePath, "Development", settings))
        {
            using var client = first.CreateClient();
            using var response = await client.GetAsync("/api/auth/csrf");
            response.EnsureSuccessStatusCode();
        }

        const string preservedHash = "preserved-password-hash";
        await using (var connection = new SqliteConnection($"Data Source={databasePath}"))
        {
            await connection.OpenAsync();
            await using var update = connection.CreateCommand();
            update.CommandText = "UPDATE Users SET PasswordHash = $hash, Role = $role, Enabled = 0 WHERE Username = $username";
            update.Parameters.AddWithValue("$hash", preservedHash);
            update.Parameters.AddWithValue("$role", Roles.ReadOnlyViewer);
            update.Parameters.AddWithValue("$username", "restart-admin");
            Assert.Equal(1, await update.ExecuteNonQueryAsync());
        }

        settings["BootstrapAdmin:Password"] = "replacement-password-must-not-apply";
        settings["BootstrapAdmin:Role"] = Roles.Operations;
        await using (var second = new AuthTestFixture.TestApplicationFactory(databasePath, "Development", settings))
        {
            using var client = second.CreateClient();
            using var response = await client.GetAsync("/api/auth/csrf");
            response.EnsureSuccessStatusCode();
            await using var scope = second.Services.CreateAsyncScope();
            var users = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Users
                .Where(user => user.Username == "restart-admin")
                .ToListAsync();
            var user = Assert.Single(users);
            Assert.Equal(preservedHash, user.PasswordHash);
            Assert.Equal(Roles.ReadOnlyViewer, user.Role);
            Assert.False(user.Enabled);
        }

        SqliteConnection.ClearAllPools();
        Directory.Delete(directory, recursive: true);
    }

    [Fact]
    public async Task MissingBootstrapConfigurationStartsAndUnknownRoleIsRejected()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"datacenter-bootstrap-validation-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        await using (var missing = new AuthTestFixture.TestApplicationFactory(Path.Combine(directory, "missing.db"), "Development"))
        {
            using var client = missing.CreateClient();
            using var response = await client.GetAsync("/api/auth/csrf");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        var settings = new Dictionary<string, string?>
        {
            ["BootstrapAdmin:Username"] = "invalid-role-user",
            ["BootstrapAdmin:Password"] = "bootstrap-test-password",
            ["BootstrapAdmin:Role"] = "超级管理员"
        };
        await using var invalid = new AuthTestFixture.TestApplicationFactory(Path.Combine(directory, "invalid.db"), "Development", settings);
        await Assert.ThrowsAnyAsync<Exception>(() => Task.Run(() => invalid.CreateClient()));
        Directory.Delete(directory, recursive: true);
    }

    [Fact]
    public async Task NetworkShareDatabasePathIsRejectedAtStartup()
    {
        await using var factory = new AuthTestFixture.TestApplicationFactory("\\\\server\\share\\datacenter.db", "Testing");
        await Assert.ThrowsAnyAsync<Exception>(() => Task.Run(() => factory.CreateClient()));
    }

    [Fact]
    public async Task WalModeReturningNonWalCausesApplicationStartupFailure()
    {
        var temporaryDirectory = Path.Combine(Path.GetTempPath(), $"datacenter-wal-failure-{Guid.NewGuid():N}");
        var databasePath = Path.Combine(temporaryDirectory, "wal-failure.db");
        Directory.CreateDirectory(temporaryDirectory);
        try
        {
            await using (var writableFactory = new AuthTestFixture.TestApplicationFactory(databasePath, "Testing"))
            {
                using var client = writableFactory.CreateClient();
                await client.GetAsync("/api/auth/csrf");
            }

            SqliteConnection.ClearAllPools();
            await using var blockingConnection = new SqliteConnection($"Data Source={databasePath}");
            await blockingConnection.OpenAsync();
            await using (var command = blockingConnection.CreateCommand())
            {
                command.CommandText = "PRAGMA journal_mode=DELETE;";
                Assert.Equal("delete", Convert.ToString(await command.ExecuteScalarAsync()), ignoreCase: true);
            }
            await using var blockingTransaction = blockingConnection.BeginTransaction();
            await using (var command = blockingConnection.CreateCommand())
            {
                command.Transaction = blockingTransaction;
                command.CommandText = "UPDATE Users SET Username = Username WHERE 0 = 1;";
                await command.ExecuteNonQueryAsync();
            }

            await using var readOnlyFactory = new AuthTestFixture.TestApplicationFactory(
                databasePath,
                "Testing",
                connectionString: $"Data Source={databasePath};Mode=ReadOnly");

            var exception = await Assert.ThrowsAnyAsync<Exception>(() => Task.Run(() => readOnlyFactory.CreateClient()));
            Assert.Contains("WAL mode", exception.ToString(), StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            Directory.Delete(temporaryDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task DatabasePathBelowOrdinaryFileCausesApplicationStartupFailure()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"datacenter-parent-file-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        var ordinaryFile = Path.Combine(directory, "not-a-directory");
        await File.WriteAllTextAsync(ordinaryFile, "ordinary file");
        var databasePath = Path.Combine(ordinaryFile, "database.db");

        await using var factory = new AuthTestFixture.TestApplicationFactory(databasePath, "Testing");
        await Assert.ThrowsAnyAsync<Exception>(() => Task.Run(() => factory.CreateClient()));

        File.Delete(ordinaryFile);
        Directory.Delete(directory);
    }

    [Fact]
    public async Task MalformedLoginJsonReturnsOnlyUnifiedJsonError()
    {
        using var client = fixture.CreateClient();
        var token = await GetCsrfTokenAsync(client);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = new StringContent("{ malformed", Encoding.UTF8, "application/json")
        };
        request.Headers.Add("X-XSRF-TOKEN", token);

        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        using var json = JsonDocument.Parse(body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.True(json.RootElement.TryGetProperty("error", out _));
        Assert.False(json.RootElement.TryGetProperty("type", out _));
        Assert.False(json.RootElement.TryGetProperty("traceId", out _));
        Assert.DoesNotContain("<html", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("stack", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AuthenticationDependencyFailureReturnsSafeJsonInternalServerError()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"datacenter-auth-error-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        var databasePath = Path.Combine(directory, $"error-{Guid.NewGuid():N}.db");
        await using var factory = new AuthTestFixture.TestApplicationFactory(databasePath, "Testing");
        using var client = factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), HandleCookies = true });
        var token = await GetCsrfTokenAsync(client);
        SqliteConnection.ClearAllPools();
        File.Delete(databasePath);
        File.Delete(databasePath + "-wal");
        File.Delete(databasePath + "-shm");

        using var request = CreateLoginRequest(token, "dependency-failure-user", "sensitive-password-value");
        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        using var json = JsonDocument.Parse(body);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("服务内部错误", json.RootElement.GetProperty("error").GetString());
        Assert.Single(json.RootElement.EnumerateObject());
        Assert.DoesNotContain("sensitive-password-value", body, StringComparison.Ordinal);

        var logs = string.Join("\n", factory.LogCollector.Messages);
        Assert.Contains("no such table", logs, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("sensitive-password-value", logs, StringComparison.Ordinal);

        await factory.DisposeAsync();
        SqliteConnection.ClearAllPools();
        Directory.Delete(directory, recursive: true);
    }

    [Fact]
    public async Task AuthenticationLogsContainApprovedEventsWithoutSensitiveValues()
    {
        using var client = fixture.CreateClient();
        using var successfulLogin = await LoginAsync(client);
        Assert.Equal(HttpStatusCode.OK, successfulLogin.StatusCode);
        var token = await GetCsrfTokenAsync(client);
        const string password = "log-test-sensitive-password";
        using var request = CreateLoginRequest(token, "logged-missing-user", password);
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var passwordHash = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Users
            .Where(user => user.Username == AuthTestFixture.EnabledUsername)
            .Select(user => user.PasswordHash)
            .SingleAsync();
        var logs = string.Join("\n", fixture.Factory.LogCollector.Messages);
        Assert.Contains("authenticated successfully", logs, StringComparison.Ordinal);
        Assert.Contains("Authentication failed for username logged-missing-user", logs, StringComparison.Ordinal);
        Assert.DoesNotContain(AuthTestFixture.EnabledPassword, logs, StringComparison.Ordinal);
        Assert.DoesNotContain(password, logs, StringComparison.Ordinal);
        Assert.DoesNotContain(passwordHash, logs, StringComparison.Ordinal);
        Assert.DoesNotContain(token, logs, StringComparison.Ordinal);
        Assert.DoesNotContain("Datacenter.Auth=", logs, StringComparison.Ordinal);
        Assert.DoesNotContain("Data Source=", logs, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task IndependentFixturesUseIsolatedDatabasesAndDisposeRemovesAllDatabaseFiles()
    {
        var first = new AuthTestFixture();
        var second = new AuthTestFixture();
        await first.InitializeAsync();
        await second.InitializeAsync();
        var firstPath = first.DatabasePath;
        var secondPath = second.DatabasePath;

        Assert.NotEqual(firstPath, secondPath);
        await using (var firstScope = first.Factory.Services.CreateAsyncScope())
        {
            firstScope.ServiceProvider.GetRequiredService<AppDbContext>().Users.Add(new User
            {
                Username = "first-fixture-only",
                PasswordHash = "test-only-hash",
                Role = Roles.ReadOnlyViewer
            });
            await firstScope.ServiceProvider.GetRequiredService<AppDbContext>().SaveChangesAsync();
        }
        await using (var secondScope = second.Factory.Services.CreateAsyncScope())
        {
            Assert.False(await secondScope.ServiceProvider.GetRequiredService<AppDbContext>().Users
                .AnyAsync(user => user.Username == "first-fixture-only"));
        }

        await first.DisposeAsync();
        SqliteConnection.ClearAllPools();
        Assert.False(File.Exists(firstPath));
        Assert.False(File.Exists(firstPath + "-wal"));
        Assert.False(File.Exists(firstPath + "-shm"));
        Assert.False(Directory.Exists(first.TemporaryDirectory));
        using (var response = await second.CreateClient().GetAsync("/api/auth/csrf"))
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        await second.DisposeAsync();
        SqliteConnection.ClearAllPools();
        Assert.False(File.Exists(secondPath));
        Assert.False(File.Exists(secondPath + "-wal"));
        Assert.False(File.Exists(secondPath + "-shm"));
        Assert.False(Directory.Exists(second.TemporaryDirectory));
    }

    private async Task<(HttpStatusCode StatusCode, string Body)> AttemptLoginAsync(string username, string password)
    {
        using var client = fixture.CreateClient();
        var token = await GetCsrfTokenAsync(client);
        using var request = CreateLoginRequest(token, username, password);
        using var response = await client.SendAsync(request);
        return (response.StatusCode, await response.Content.ReadAsStringAsync());
    }

    private static async Task<string> GetCsrfTokenAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/api/auth/csrf");
        response.EnsureSuccessStatusCode();
        return response.Headers.GetValues("X-XSRF-TOKEN").Single();
    }

    private static HttpRequestMessage CreateLoginRequest(string token, string username, string password)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { username, password })
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        return request;
    }

    private static HttpRequestMessage CreatePost(string path, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, path);
        request.Headers.Add("X-XSRF-TOKEN", token);
        return request;
    }

    private static async Task<HttpResponseMessage> LoginAsync(HttpClient client)
    {
        var token = await GetCsrfTokenAsync(client);
        using var request = CreateLoginRequest(token, AuthTestFixture.EnabledUsername, AuthTestFixture.EnabledPassword);
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return response;
    }

    private static async Task SeedEnabledUserAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = new User { Username = AuthTestFixture.EnabledUsername, Role = Roles.DbaApplicationOperations };
        var hasher = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.IPasswordHasher<User>>();
        user.PasswordHash = hasher.HashPassword(user, AuthTestFixture.EnabledPassword);
        db.Users.Add(user);
        await db.SaveChangesAsync();
    }
}
