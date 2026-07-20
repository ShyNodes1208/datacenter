using System.Security.Claims;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Datacenter.Api.Tests.UnitTests;

public sealed class AuthUnitTests
{
    [Fact]
    public void PasswordHasherUsesSaltAndVerifiesPasswords()
    {
        var user = new User { Username = "unit-user", Role = Roles.RoomAdministrator };
        var hasher = new PasswordHasher<User>();
        var first = hasher.HashPassword(user, "unit-test-password");
        var second = hasher.HashPassword(user, "unit-test-password");

        Assert.NotEqual("unit-test-password", first);
        Assert.NotEqual(first, second);
        Assert.Equal(PasswordVerificationResult.Success, hasher.VerifyHashedPassword(user, first, "unit-test-password"));
        Assert.Equal(PasswordVerificationResult.Failed, hasher.VerifyHashedPassword(user, first, "different-password"));
    }

    [Fact]
    public void RolesContainExactlyTheApprovedFourValues()
    {
        Assert.Equal(4, Roles.All.Count);
        Assert.Contains("机房管理员", Roles.All);
        Assert.Contains("运维人员", Roles.All);
        Assert.Contains("DBA/应用运维人员", Roles.All);
        Assert.Contains("只读查看人员", Roles.All);
    }

    [Theory]
    [InlineData(Roles.RoomAdministrator, true, false)]
    [InlineData(Roles.Operations, true, false)]
    [InlineData(Roles.DbaApplicationOperations, false, true)]
    [InlineData(Roles.ReadOnlyViewer, false, true)]
    [InlineData(null, false, false)]
    public async Task AuthorizationPoliciesApplyApprovedRoleSets(string? role, bool canModify, bool readOnly)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAuthorization(options =>
        {
            options.AddPolicy("CanModify", policy => policy.RequireRole(Roles.RoomAdministrator, Roles.Operations));
            options.AddPolicy("ReadOnly", policy => policy.RequireRole(Roles.DbaApplicationOperations, Roles.ReadOnlyViewer));
        });
        await using var provider = services.BuildServiceProvider();
        var authorization = provider.GetRequiredService<IAuthorizationService>();
        var claims = role is null ? [] : new[] { new Claim(ClaimTypes.Role, role) };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, role is null ? null : "Test"));

        Assert.Equal(canModify, (await authorization.AuthorizeAsync(principal, null, "CanModify")).Succeeded);
        Assert.Equal(readOnly, (await authorization.AuthorizeAsync(principal, null, "ReadOnly")).Succeeded);
    }
}
