using LH.Licensing.Server.Domain.Common;
using LH.Licensing.Server.Domain.Enums;

namespace LH.Licensing.Server.Domain.Entities;

public sealed class Customer : EntityBase
{
    public Customer()
    {
    }

    public Customer(string code, string name)
    {
        Code = code;
        Name = name;
        Status = CustomerStatus.Active;
    }

    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public CustomerStatus Status { get; set; }

    public ICollection<License> Licenses { get; set; } = new List<License>();
}
