using Datacenter.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Services;

public sealed class AuthService(
    Data.AppDbContext dbContext,
    IPasswordHasher<User> passwordHasher)
{
    public async Task<User?> AuthenticateAsync(string username, string password, CancellationToken cancellationToken)
    {
        var user = await dbContext.Users.SingleOrDefaultAsync(
            item => item.Username == username,
            cancellationToken);

        if (user is null || !user.Enabled)
        {
            return null;
        }

        var result = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded
            ? user
            : null;
    }
}
