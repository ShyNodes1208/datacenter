using System.Security.Claims;
using Datacenter.Api.Auth;
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Datacenter.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = NormalizeSqliteConnectionString(
    builder.Configuration.GetConnectionString("DefaultConnection"),
    Directory.GetCurrentDirectory());

builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<Microsoft.AspNetCore.Identity.IPasswordHasher<User>, Microsoft.AspNetCore.Identity.PasswordHasher<User>>();
builder.Services.AddControllers(options => options.Filters.Add(new AuthorizeFilter()))
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = _ => new BadRequestObjectResult(new { error = "请求格式错误" });
    });
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "Datacenter.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = false;
        options.Events.OnRedirectToLogin = context => WriteAuthenticationErrorAsync(context.Response);
        options.Events.OnRedirectToAccessDenied = context => WriteAuthenticationErrorAsync(context.Response);
        options.Events.OnValidatePrincipal = async context =>
        {
            try
            {
                var idText = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                var cookieRole = context.Principal?.FindFirstValue(ClaimTypes.Role);
                if (!Guid.TryParse(idText, out var userId))
                {
                    await RejectPrincipalAsync(context);
                    return;
                }

                var dbContext = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var user = await dbContext.Users.AsNoTracking().SingleOrDefaultAsync(item => item.Id == userId);
                if (user is null || !user.Enabled || !string.Equals(user.Role, cookieRole, StringComparison.Ordinal))
                {
                    await RejectPrincipalAsync(context);
                }
            }
            catch (Exception)
            {
                await RejectPrincipalAsync(context);
            }
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanModify", policy => policy.RequireRole(Roles.RoomAdministrator, Roles.Operations));
    options.AddPolicy("ReadOnly", policy => policy.RequireRole(Roles.DbaApplicationOperations, Roles.ReadOnlyViewer));
});

var app = builder.Build();

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception)
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { error = "服务内部错误" });
    }
});
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

await InitializeDatabaseAsync(app);
await app.BootstrapAdminAsync();
await app.RunAsync();

static string NormalizeSqliteConnectionString(string? configuredConnectionString, string workingDirectory)
{
    if (string.IsNullOrWhiteSpace(configuredConnectionString))
    {
        throw new InvalidOperationException("SQLite connection string is required.");
    }

    var builder = new SqliteConnectionStringBuilder(configuredConnectionString);
    var dataSource = builder.DataSource;
    if (string.IsNullOrWhiteSpace(dataSource)
        || dataSource.Equals(":memory:", StringComparison.OrdinalIgnoreCase)
        || dataSource.StartsWith("\\\\", StringComparison.Ordinal)
        || dataSource.StartsWith("//", StringComparison.Ordinal)
        || dataSource.StartsWith("smb:", StringComparison.OrdinalIgnoreCase)
        || dataSource.StartsWith("nfs:", StringComparison.OrdinalIgnoreCase)
        || dataSource.StartsWith("nas:", StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException("SQLite database must use a local file path.");
    }

    var fullPath = Path.GetFullPath(dataSource, workingDirectory);
    var parentDirectory = Path.GetDirectoryName(fullPath)
        ?? throw new InvalidOperationException("SQLite database parent directory is invalid.");
    Directory.CreateDirectory(parentDirectory);
    builder.DataSource = fullPath;
    return builder.ConnectionString;
}

static async Task InitializeDatabaseAsync(WebApplication app)
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();

    var connection = dbContext.Database.GetDbConnection();
    await connection.OpenAsync();
    try
    {
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA journal_mode=WAL;";
            var result = Convert.ToString(await command.ExecuteScalarAsync());
            if (!string.Equals(result, "wal", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("SQLite WAL mode could not be enabled.");
            }
        }
        catch (Exception exception) when (exception is not InvalidOperationException)
        {
            throw new InvalidOperationException("SQLite WAL mode could not be enabled.", exception);
        }
    }
    finally
    {
        await connection.CloseAsync();
    }
}

static async Task RejectPrincipalAsync(CookieValidatePrincipalContext context)
{
    context.RejectPrincipal();
    await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
}

static Task WriteAuthenticationErrorAsync(HttpResponse response)
{
    response.StatusCode = StatusCodes.Status401Unauthorized;
    response.ContentType = "application/json";
    return response.WriteAsJsonAsync(new { error = "未认证" });
}

public partial class Program { }
