using LH.Licensing.Server.Domain.Common;
using LH.Licensing.Server.Domain.Enums;

namespace LH.Licensing.Server.Domain.Entities;

public sealed class Activation : EntityBase
{
    public Activation()
    {
    }

    public Activation(Guid licenseId, Guid installationId, string tokenJti, string clientVersion, DateTimeOffset activatedAt, DateTimeOffset expiresAt)
    {
        LicenseId = licenseId;
        InstallationId = installationId;
        TokenJti = tokenJti;
        ClientVersion = clientVersion;
        ActivatedAt = activatedAt;
        ExpiresAt = expiresAt;
        Status = ActivationStatus.Active;
    }

    public Guid LicenseId { get; set; }

    public License? License { get; set; }

    public Guid InstallationId { get; set; }

    public Installation? Installation { get; set; }

    public ActivationStatus Status { get; set; }

    public DateTimeOffset ActivatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset RefreshTokenExpiresAt { get; set; }

    public DateTimeOffset? OfflineGraceUntil { get; set; }

    public DateTimeOffset? LastRefreshedAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public string TokenJti { get; set; } = string.Empty;

    public string? RefreshTokenHash { get; set; }

    public string ClientVersion { get; set; } = string.Empty;
}
