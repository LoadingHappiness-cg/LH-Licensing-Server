namespace LH.Licensing.Server.Contracts;

public sealed record LicenseListItemDto
{
    public Guid LicenseId { get; init; }

    public string LicenseKeyMasked { get; init; } = string.Empty;

    public Guid CustomerId { get; init; }

    public string CustomerCode { get; init; } = string.Empty;

    public string CustomerName { get; init; } = string.Empty;

    public Guid ProductId { get; init; }

    public string ProductCode { get; init; } = string.Empty;

    public string ProductName { get; init; } = string.Empty;

    public Guid LicensePlanId { get; init; }

    public string PlanCode { get; init; } = string.Empty;

    public string Status { get; init; } = string.Empty;

    public DateTimeOffset StartsAt { get; init; }

    public DateTimeOffset? EndsAt { get; init; }

    public DateTimeOffset? RevokedAt { get; init; }

    public int TotalActivations { get; init; }

    public int ActiveActivations { get; init; }
}
