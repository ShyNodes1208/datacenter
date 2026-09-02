using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Auth;

public static class BootstrapExtensions
{
    public static bool IsPackageHost(IConfiguration configuration, IHostEnvironment environment) =>
        configuration.GetValue<bool>("DatacenterPackage")
        || string.Equals(Environment.GetEnvironmentVariable("DATACENTER_PACKAGE_MODE"), "1", StringComparison.Ordinal);

    public static async Task BootstrapAdminAsync(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment() && !IsPackageHost(app.Configuration, app.Environment))
        {
            return;
        }

        var username = app.Configuration["BootstrapAdmin:Username"];
        var password = app.Configuration["BootstrapAdmin:Password"];
        var role = app.Configuration["BootstrapAdmin:Role"] ?? Roles.RoomAdministrator;
        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("BootstrapAdmin");
        var packageHost = IsPackageHost(app.Configuration, app.Environment);

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogInformation("Bootstrap administrator configuration is incomplete; initialization was skipped.");
            return;
        }

        if (!Roles.All.Contains(role))
        {
            logger.LogError("Bootstrap administrator role is invalid; initialization was rejected.");
            throw new InvalidOperationException("Bootstrap administrator role is invalid.");
        }

        await using var scope = app.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
        var existing = await dbContext.Users.SingleOrDefaultAsync(user => user.Username == username);
        if (existing is not null)
        {
            if (!packageHost)
            {
                return;
            }

            var verify = PasswordVerificationResult.Failed;
            try
            {
                verify = hasher.VerifyHashedPassword(existing, existing.PasswordHash, password);
            }
            catch (FormatException)
            {
                logger.LogWarning(
                    "Bootstrap administrator {UserId} has an invalid password hash; repairing.",
                    existing.Id);
            }

            var passwordMatches = verify is PasswordVerificationResult.Success
                or PasswordVerificationResult.SuccessRehashNeeded;
            var needsRepair = !passwordMatches || !existing.Enabled || !string.Equals(existing.Role, role, StringComparison.Ordinal);
            if (!needsRepair)
            {
                if (verify is PasswordVerificationResult.SuccessRehashNeeded)
                {
                    existing.PasswordHash = hasher.HashPassword(existing, password);
                    await dbContext.SaveChangesAsync();
                }
                return;
            }

            existing.PasswordHash = hasher.HashPassword(existing, password);
            existing.Role = role;
            existing.Enabled = true;
            await dbContext.SaveChangesAsync();
            logger.LogWarning(
                "Bootstrap administrator {UserId} was repaired for portable package recovery.",
                existing.Id);
            return;
        }

        var user = new User
        {
            Username = username,
            Role = role,
            Enabled = true,
            CreatedAt = DateTimeOffset.UtcNow
        };
        user.PasswordHash = hasher.HashPassword(user, password);
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();
        logger.LogInformation("Bootstrap administrator {UserId} was created.", user.Id);
    }
}
