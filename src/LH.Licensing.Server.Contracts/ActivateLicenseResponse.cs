namespace LH.Licensing.Server.Contracts;

public sealed record ActivateLicenseResponse
{
    public string AccessToken { get; init; } = string.Empty;

    public string RefreshToken { get; init; } = string.Empty;

    public DateTimeOffset ExpiresAt { get; init; }

    public DateTimeOffset OfflineGraceUntil { get; init; }

    public int PolicyVersion { get; init; }

    public LicenseEntitlementsDto Entitlements { get; init; } = new(0, 0, Array.Empty<string>());

    public LicenseSummaryDto License { get; init; } = new(Guid.Empty, Guid.Empty, Guid.Empty, Guid.Empty, string.Empty, string.Empty, string.Empty);
}
