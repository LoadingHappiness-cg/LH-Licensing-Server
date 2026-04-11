namespace LH.Licensing.Server.Contracts;

public sealed record RefreshLicenseRequest
{
    public string RefreshToken { get; init; } = string.Empty;

    public string ProductCode { get; init; } = string.Empty;

    public string AppId { get; init; } = string.Empty;

    public string MachineFingerprint { get; init; } = string.Empty;

    public string ClientVersion { get; init; } = string.Empty;
}
