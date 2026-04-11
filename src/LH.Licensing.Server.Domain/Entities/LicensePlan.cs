using LH.Licensing.Server.Domain.Common;
using LH.Licensing.Server.Domain.Enums;

namespace LH.Licensing.Server.Domain.Entities;

public sealed class LicensePlan : EntityBase
{
    public LicensePlan()
    {
    }

    public LicensePlan(Guid productId, string planCode, string name, string entitlementsJson, int offlineGraceDays, int maxActivations)
    {
        ProductId = productId;
        PlanCode = planCode;
        Name = name;
        EntitlementsJson = entitlementsJson;
        OfflineGraceDays = offlineGraceDays;
        MaxActivations = maxActivations;
        Status = LicensePlanStatus.Active;
    }

    public Guid ProductId { get; set; }

    public Product? Product { get; set; }

    public string PlanCode { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public LicensePlanStatus Status { get; set; }

    public string EntitlementsJson { get; set; } = "{}";

    public int OfflineGraceDays { get; set; }

    public int MaxActivations { get; set; }

    public ICollection<License> Licenses { get; set; } = new List<License>();
}
