using LH.Licensing.Server.Domain.Common;
using LH.Licensing.Server.Domain.Enums;

namespace LH.Licensing.Server.Domain.Entities;

public sealed class License : EntityBase
{
    public License()
    {
    }

    public License(Guid customerId, Guid productId, Guid licensePlanId, string licenseKey, DateTimeOffset startsAt, DateTimeOffset? endsAt, int policyVersion)
    {
        CustomerId = customerId;
        ProductId = productId;
        LicensePlanId = licensePlanId;
        LicenseKey = licenseKey;
        StartsAt = startsAt;
        EndsAt = endsAt;
        PolicyVersion = policyVersion;
        Status = LicenseStatus.Active;
    }

    public Guid CustomerId { get; set; }

    public Customer? Customer { get; set; }

    public Guid ProductId { get; set; }

    public Product? Product { get; set; }

    public Guid LicensePlanId { get; set; }

    public LicensePlan? LicensePlan { get; set; }

    public string LicenseKey { get; set; } = string.Empty;

    public LicenseStatus Status { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public int PolicyVersion { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }

    public string? RevocationReason { get; set; }

    public ICollection<Activation> Activations { get; set; } = new List<Activation>();
}
