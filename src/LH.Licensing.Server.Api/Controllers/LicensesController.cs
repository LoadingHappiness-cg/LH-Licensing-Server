using LH.Licensing.Server.Application;
using LH.Licensing.Server.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace LH.Licensing.Server.Api.Controllers;

[ApiController]
[Route("api/licenses")]
public sealed class LicensesController : ControllerBase
{
    private readonly ILicenseFlowService _licenseFlowService;
    private readonly ILogger<LicensesController> _logger;

    public LicensesController(ILicenseFlowService licenseFlowService, ILogger<LicensesController> logger)
    {
        _licenseFlowService = licenseFlowService;
        _logger = logger;
    }

    [HttpPost("activate")]
    public async Task<ActionResult<ActivateLicenseResponse>> Activate([FromBody] ActivateLicenseRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _licenseFlowService.ActivateAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (LicenseFlowException ex)
        {
            _logger.LogWarning(ex, "License activation denied: {ErrorCode}", ex.ErrorCode);
            return BadRequest(new ProblemDetails
            {
                Title = "Activation denied",
                Detail = ex.Message,
                Extensions = { ["errorCode"] = ex.ErrorCode }
            });
        }
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<RefreshLicenseResponse>> Refresh([FromBody] RefreshLicenseRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _licenseFlowService.RefreshAsync(request, cancellationToken);
            return Ok(response);
        }
        catch (LicenseFlowException ex)
        {
            _logger.LogWarning(ex, "License refresh denied: {ErrorCode}", ex.ErrorCode);
            return BadRequest(new ProblemDetails
            {
                Title = "Refresh denied",
                Detail = ex.Message,
                Extensions = { ["errorCode"] = ex.ErrorCode }
            });
        }
    }
}
