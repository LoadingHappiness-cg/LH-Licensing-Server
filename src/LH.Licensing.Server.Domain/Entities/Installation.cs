using LH.Licensing.Server.Domain.Common;
using LH.Licensing.Server.Domain.Enums;

namespace LH.Licensing.Server.Domain.Entities;

public sealed class Installation : EntityBase
{
    public Installation()
    {
    }

    public Installation(Guid productId, string appId, string machineFingerprintHash, string? deviceName, string? osInfo)
    {
        ProductId = productId;
        AppId = appId;
        MachineFingerprintHash = machineFingerprintHash;
        DeviceName = deviceName;
        OsInfo = osInfo;
        FirstSeenAt = DateTimeOffset.UtcNow;
        LastSeenAt = DateTimeOffset.UtcNow;
        Status = InstallationStatus.Active;
    }

    public Guid ProductId { get; set; }

    public Product? Product { get; set; }

    public string AppId { get; set; } = string.Empty;

    public string MachineFingerprintHash { get; set; } = string.Empty;

    public string? DeviceName { get; set; }

    public string? OsInfo { get; set; }

    public DateTimeOffset FirstSeenAt { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }

    public InstallationStatus Status { get; set; }

    public ICollection<Activation> Activations { get; set; } = new List<Activation>();
}
