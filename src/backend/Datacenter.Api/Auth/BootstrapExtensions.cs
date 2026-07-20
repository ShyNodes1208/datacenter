using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Auth;

public static class BootstrapExtensions
{
    public static async Task BootstrapAdminAsync(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment())
        {
            return;
        }

        var username = app.Configuration["BootstrapAdmin:Username"];
        var password = app.Configuration["BootstrapAdmin:Password"];
        var role = app.Configuration["BootstrapAdmin:Role"] ?? Roles.RoomAdministrator;
        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("BootstrapAdmin");

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
        if (await dbContext.Users.AnyAsync(user => user.Username == username))
        {
            return;
        }

        var user = new User
        {
            Username = username,
            Role = role,
            Enabled = true,
            CreatedAt = DateTimeOffset.UtcNow
        };
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
        user.PasswordHash = hasher.HashPassword(user, password);
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();
        logger.LogInformation("Bootstrap administrator {UserId} was created.", user.Id);
    }
}
