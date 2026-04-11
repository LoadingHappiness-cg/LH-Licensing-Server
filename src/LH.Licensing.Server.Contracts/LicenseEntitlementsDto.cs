namespace LH.Licensing.Server.Contracts;

public sealed record LicenseEntitlementsDto(
    int MaxActivations,
    int OfflineGraceDays,
    IReadOnlyCollection<string> Features);
