using System.Security.Claims;
using Datacenter.Api.Auth;
using Datacenter.Api.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Datacenter.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    IAntiforgery antiforgery,
    AuthService authService,
    ILogger<AuthController> logger) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("csrf")]
    public IActionResult Csrf()
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        Response.Headers["X-XSRF-TOKEN"] = tokens.RequestToken;
        return Ok();
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        if (!await HasValidAntiforgeryTokenAsync())
        {
            return BadRequest(new { error = "防伪令牌缺失或无效" });
        }

        var user = await authService.AuthenticateAsync(request.Username, request.Password, cancellationToken);
        if (user is null)
        {
            logger.LogWarning("Authentication failed for username {Username}.", request.Username);
            return Unauthorized(new { error = "用户名或密码错误" });
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role)
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties { IsPersistent = false });

        logger.LogInformation("User {UserId} authenticated successfully.", user.Id);
        return Ok(new UserInfoResponse(user.Id.ToString(), user.Username, user.Role));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        if (!await HasValidAntiforgeryTokenAsync())
        {
            return BadRequest(new { error = "防伪令牌缺失或无效" });
        }

        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        return Ok(new UserInfoResponse(
            User.FindFirstValue(ClaimTypes.NameIdentifier)!,
            User.FindFirstValue(ClaimTypes.Name)!,
            User.FindFirstValue(ClaimTypes.Role)!));
    }

    private async Task<bool> HasValidAntiforgeryTokenAsync()
    {
        try
        {
            await antiforgery.ValidateRequestAsync(HttpContext);
            return true;
        }
        catch (AntiforgeryValidationException)
        {
            return false;
        }
    }
}
