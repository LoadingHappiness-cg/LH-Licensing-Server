using LH.Licensing.Server.Domain.Common;
using LH.Licensing.Server.Domain.Enums;

namespace LH.Licensing.Server.Domain.Entities;

public sealed class Product : EntityBase
{
    public Product()
    {
    }

    public Product(string productCode, string name, int defaultPolicyVersion)
    {
        ProductCode = productCode;
        Name = name;
        DefaultPolicyVersion = defaultPolicyVersion;
        Status = ProductStatus.Active;
    }

    public string ProductCode { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public ProductStatus Status { get; set; }

    public int DefaultPolicyVersion { get; set; }

    public string AllowedAppIdsJson { get; set; } = "[]";

    public ICollection<LicensePlan> LicensePlans { get; set; } = new List<LicensePlan>();

    public ICollection<License> Licenses { get; set; } = new List<License>();

    public ICollection<Installation> Installations { get; set; } = new List<Installation>();
}
