using LH.Licensing.Server.Contracts;

namespace LH.Licensing.Server.Application;

public interface ILicenseAdminService
{
    Task<LicenseDetailsResponse> GetLicenseAsync(Guid licenseId, string actorType, string actorId, CancellationToken cancellationToken);

    Task<LicenseDetailsResponse> RevokeLicenseAsync(Guid licenseId, string reason, string actorType, string actorId, CancellationToken cancellationToken);

    Task<LicenseSearchResponse> SearchLicensesAsync(string? productCode, string? status, string? customerCode, string? licenseKeyMasked, int page, int pageSize, string actorType, string actorId, CancellationToken cancellationToken);
}
