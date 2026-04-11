using System.Security.Cryptography;
using System.Text;

namespace LH.Licensing.Server.Infrastructure.Security;

public static class LicenseKeyHasher
{
    public static string Hash(string licenseKey)
    {
        var normalized = Normalize(licenseKey);
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(normalized));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static string Normalize(string licenseKey)
    {
        return licenseKey.Trim().ToUpperInvariant();
    }
}
