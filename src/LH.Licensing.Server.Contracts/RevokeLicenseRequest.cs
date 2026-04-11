namespace LH.Licensing.Server.Contracts;

public sealed record RevokeLicenseRequest
{
    [System.ComponentModel.DataAnnotations.Required]
    public string Reason { get; init; } = string.Empty;
}
