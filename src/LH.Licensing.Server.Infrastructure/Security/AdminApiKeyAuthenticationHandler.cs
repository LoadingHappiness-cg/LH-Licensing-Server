using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using LH.Licensing.Server.Infrastructure.Options;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace LH.Licensing.Server.Infrastructure.Security;

public static class AdminApiKeyAuthenticationDefaults
{
    public const string Scheme = "AdminApiKey";
    public const string HeaderName = "X-Admin-Api-Key";
    public const string ApiKeyValidClaimType = "admin_api_key_valid";
    public const string ActorTypeClaimType = "admin_actor_type";
    public const string ActorIdClaimType = "admin_actor_id";
    public const string ActorTypeValue = "admin-api-key";
}

public sealed class AdminApiKeyAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly AdminApiKeyOptions _options;

    public AdminApiKeyAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IOptions<AdminApiKeyOptions> adminOptions)
        : base(options, logger, encoder)
    {
        _options = adminOptions.Value;
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(AdminApiKeyAuthenticationDefaults.HeaderName, out var headerValues) || headerValues.Count == 0)
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var providedKey = headerValues[0] ?? string.Empty;
        var isValid = IsValidApiKey(providedKey, _options.ApiKey);

        var claims = new List<Claim>
        {
            new(AdminApiKeyAuthenticationDefaults.ApiKeyValidClaimType, isValid ? "true" : "false")
        };

        if (isValid)
        {
            claims.Add(new Claim(AdminApiKeyAuthenticationDefaults.ActorTypeClaimType, AdminApiKeyAuthenticationDefaults.ActorTypeValue));
            claims.Add(new Claim(AdminApiKeyAuthenticationDefaults.ActorIdClaimType, string.IsNullOrWhiteSpace(_options.ActorId) ? AdminApiKeyAuthenticationDefaults.ActorTypeValue : _options.ActorId));
        }

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name)));
    }

    private static bool IsValidApiKey(string provided, string? configured)
    {
        if (string.IsNullOrWhiteSpace(provided) || string.IsNullOrWhiteSpace(configured))
        {
            return false;
        }

        var providedBytes = Encoding.UTF8.GetBytes(provided);
        var configuredBytes = Encoding.UTF8.GetBytes(configured);
        return providedBytes.Length == configuredBytes.Length && CryptographicOperations.FixedTimeEquals(providedBytes, configuredBytes);
    }
}
