namespace LH.Licensing.Server.Contracts;

public sealed record LicenseSummaryDto(
    Guid LicenseId,
    Guid CustomerId,
    Guid ProductId,
    Guid InstallationId,
    string ProductCode,
    string PlanCode,
    string LicenseStatus);
