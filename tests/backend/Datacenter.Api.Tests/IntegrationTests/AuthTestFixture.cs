using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Datacenter.Api.Tests.IntegrationTests;

public sealed class AuthTestFixture : IAsyncLifetime
{
    public const string EnabledUsername = "enabled-user";
    public const string EnabledPassword = "test-password-1";
    public const string DisabledUsername = "disabled-user";
    public const string DisabledPassword = "test-password-2";

    private readonly string temporaryDirectory = Path.Combine(Path.GetTempPath(), $"datacenter-auth-{Guid.NewGuid():N}");
    private TestApplicationFactory? factory;

    public string DatabasePath { get; private set; } = string.Empty;

    public string TemporaryDirectory => temporaryDirectory;

    public TestApplicationFactory Factory => factory ?? throw new InvalidOperationException("Fixture is not initialized.");

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(temporaryDirectory);
        DatabasePath = Path.Combine(temporaryDirectory, $"auth-{Guid.NewGuid():N}.db");
        factory = new TestApplicationFactory(DatabasePath, "Testing");
        using var client = CreateClient();
        await client.GetAsync("/api/auth/csrf");

        await using var scope = Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
        if (!await dbContext.Users.AnyAsync())
        {
            var enabled = new User { Username = EnabledUsername, Role = Roles.DbaApplicationOperations, Enabled = true };
            enabled.PasswordHash = hasher.HashPassword(enabled, EnabledPassword);
            var disabled = new User { Username = DisabledUsername, Role = Roles.ReadOnlyViewer, Enabled = false };
            disabled.PasswordHash = hasher.HashPassword(disabled, DisabledPassword);
            dbContext.Users.AddRange(enabled, disabled);
            await dbContext.SaveChangesAsync();
        }
    }

    public HttpClient CreateClient() => Factory.CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri("https://localhost"),
        HandleCookies = true,
        AllowAutoRedirect = false
    });

    public async Task DisposeAsync()
    {
        if (factory is not null)
        {
            await factory.DisposeAsync();
        }

        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (Directory.Exists(temporaryDirectory))
        {
            Directory.Delete(temporaryDirectory, recursive: true);
        }
    }

    public sealed class TestApplicationFactory(
        string databasePath,
        string environment,
        IReadOnlyDictionary<string, string?>? settings = null,
        string? connectionString = null) : WebApplicationFactory<Program>
    {
        public TestLogCollector LogCollector { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            var effectiveConnectionString = connectionString ?? $"Data Source={databasePath}";
            builder.UseEnvironment(environment);
            builder.UseSetting("ConnectionStrings:DefaultConnection", effectiveConnectionString);
            builder.ConfigureLogging(logging => logging.AddProvider(LogCollector));
            if (settings is not null)
            {
                foreach (var setting in settings)
                {
                    builder.UseSetting(setting.Key, setting.Value);
                }
            }

            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                var values = new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = effectiveConnectionString
                };
                if (settings is not null)
                {
                    foreach (var setting in settings)
                    {
                        values[setting.Key] = setting.Value;
                    }
                }

                configuration.AddInMemoryCollection(values);
            });
        }
    }

    public sealed class TestLogCollector : ILoggerProvider
    {
        private readonly List<string> messages = [];
        private readonly object sync = new();

        public IReadOnlyList<string> Messages
        {
            get
            {
                lock (sync)
                {
                    return messages.ToArray();
                }
            }
        }

        public ILogger CreateLogger(string categoryName) => new TestLogger(this, categoryName);

        public void Dispose()
        {
        }

        private sealed class TestLogger(TestLogCollector collector, string categoryName) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(
                LogLevel logLevel,
                EventId eventId,
                TState state,
                Exception? exception,
                Func<TState, Exception?, string> formatter)
            {
                lock (collector.sync)
                {
                    collector.messages.Add($"{logLevel}|{categoryName}|{formatter(state, exception)}");
                }
            }
        }
    }
}
