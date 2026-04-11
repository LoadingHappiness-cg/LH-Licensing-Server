namespace LH.Licensing.Server.Contracts;

public sealed record ActivateLicenseRequest
{
    public string LicenseKey { get; init; } = string.Empty;

    public string ProductCode { get; init; } = string.Empty;

    public string AppId { get; init; } = string.Empty;

    public string MachineFingerprint { get; init; } = string.Empty;

    public string? DeviceName { get; init; }

    public string ClientVersion { get; init; } = string.Empty;
}
