namespace LH.Licensing.Server.Contracts;

public sealed record LicenseSearchResponse
{
    public IReadOnlyCollection<LicenseListItemDto> Items { get; init; } = Array.Empty<LicenseListItemDto>();

    public int Page { get; init; }

    public int PageSize { get; init; }

    public int TotalCount { get; init; }
}
