using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using LH.Licensing.Server.Contracts;
using LH.Licensing.Server.Infrastructure.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LH.Licensing.Server.Infrastructure.Security;

public sealed class RsaJwtTokenService
{
    private readonly JwtOptions _options;
    private readonly RsaSecurityKey _securityKey;

    public RsaJwtTokenService(IOptions<JwtOptions> options)
    {
        _options = options.Value;
        var rsa = RSA.Create();

        if (!string.IsNullOrWhiteSpace(_options.PrivateKeyPemPath) && File.Exists(_options.PrivateKeyPemPath))
        {
            rsa.ImportFromPem(File.ReadAllText(_options.PrivateKeyPemPath));
        }
        else
        {
            rsa.KeySize = 2048;
        }

        _securityKey = new RsaSecurityKey(rsa)
        {
            KeyId = _options.KeyId
        };
    }

    public (string token, string jti, DateTimeOffset expiresAt) CreateToken(
        Guid activationId,
        Guid licenseId,
        Guid customerId,
        Guid productId,
        Guid installationId,
        string productCode,
        string appId,
        string planCode,
        int policyVersion,
        DateTimeOffset offlineGraceUntil,
        string licenseStatus,
        LicenseEntitlementsDto entitlements,
        TimeProvider timeProvider)
    {
        var now = timeProvider.GetUtcNow();
        var expiresAt = now.AddMinutes(_options.AccessTokenLifetimeMinutes);
        var jti = Guid.NewGuid().ToString("N");

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, activationId.ToString()),
            new(JwtRegisteredClaimNames.Jti, jti),
            new(JwtRegisteredClaimNames.Iat, EpochTime.GetIntDate(now.UtcDateTime).ToString(), ClaimValueTypes.Integer64),
            new(JwtRegisteredClaimNames.Nbf, EpochTime.GetIntDate(now.UtcDateTime).ToString(), ClaimValueTypes.Integer64),
            new(JwtRegisteredClaimNames.Exp, EpochTime.GetIntDate(expiresAt.UtcDateTime).ToString(), ClaimValueTypes.Integer64),
            new("license_id", licenseId.ToString()),
            new("customer_id", customerId.ToString()),
            new("product_id", productId.ToString()),
            new("product_code", productCode),
            new("app_id", appId),
            new("installation_id", installationId.ToString()),
            new("plan_code", planCode),
            new("policy_version", policyVersion.ToString()),
            new("offline_grace_until", EpochTime.GetIntDate(offlineGraceUntil.UtcDateTime).ToString(), ClaimValueTypes.Integer64),
            new("license_status", licenseStatus),
            new("entitlements", JsonSerializer.Serialize(entitlements), JsonClaimValueTypes.Json)
        };

        var credentials = new SigningCredentials(_securityKey, SecurityAlgorithms.RsaSha256);
        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: expiresAt.UtcDateTime,
            signingCredentials: credentials);

        token.Header["kid"] = _securityKey.KeyId;

        return (new JwtSecurityTokenHandler().WriteToken(token), jti, expiresAt);
    }
}
