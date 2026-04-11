using LH.Licensing.Server.Contracts;

namespace LH.Licensing.Server.Application;

public interface ILicenseFlowService
{
    Task<ActivateLicenseResponse> ActivateAsync(ActivateLicenseRequest request, CancellationToken cancellationToken);

    Task<RefreshLicenseResponse> RefreshAsync(RefreshLicenseRequest request, CancellationToken cancellationToken);
}
