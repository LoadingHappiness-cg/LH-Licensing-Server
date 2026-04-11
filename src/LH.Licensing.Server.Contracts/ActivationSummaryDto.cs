namespace LH.Licensing.Server.Contracts;

public sealed record ActivationSummaryDto(
    Guid ActivationId,
    Guid InstallationId,
    string Status,
    DateTimeOffset ActivatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? LastRefreshedAt,
    DateTimeOffset? RevokedAt,
    string ClientVersion);
