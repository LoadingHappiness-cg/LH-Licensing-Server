using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace LH.Licensing.Server.Infrastructure.Security;

public static class RefreshTokenService
{
    public static string GenerateToken()
    {
        return Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(48));
    }

    public static string Hash(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
