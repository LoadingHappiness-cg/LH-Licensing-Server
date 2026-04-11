using LH.Licensing.Server.Domain.Common;
using LH.Licensing.Server.Domain.Enums;

namespace LH.Licensing.Server.Domain.Entities;

public sealed class AuditEvent : EntityBase
{
    public AuditEvent()
    {
    }

    public AuditEvent(AuditEventType eventType, string actorType, string? actorId, string payloadJson, Guid? customerId = null, Guid? productId = null, Guid? licenseId = null, Guid? installationId = null)
    {
        EventType = eventType;
        ActorType = actorType;
        ActorId = actorId;
        PayloadJson = payloadJson;
        CustomerId = customerId;
        ProductId = productId;
        LicenseId = licenseId;
        InstallationId = installationId;
    }

    public AuditEventType EventType { get; set; }

    public Guid? CustomerId { get; set; }

    public Guid? ProductId { get; set; }

    public Guid? LicenseId { get; set; }

    public Guid? InstallationId { get; set; }

    public string ActorType { get; set; } = string.Empty;

    public string? ActorId { get; set; }

    public string PayloadJson { get; set; } = "{}";
}
