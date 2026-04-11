namespace LH.Licensing.Server.Infrastructure.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; init; } = string.Empty;

    public string Audience { get; init; } = string.Empty;

    public int AccessTokenLifetimeMinutes { get; init; } = 60;

    public int ClockSkewMinutes { get; init; } = 2;

    public string KeyId { get; init; } = "lh-licensing-key-1";

    public string? PrivateKeyPemPath { get; init; }

    public string? PublicKeyPemPath { get; init; }
}
