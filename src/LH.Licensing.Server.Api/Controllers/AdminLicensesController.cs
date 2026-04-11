using LH.Licensing.Server.Application;
using LH.Licensing.Server.Contracts;
using LH.Licensing.Server.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace LH.Licensing.Server.Api.Controllers;

[ApiController]
[Route("api/admin/licenses")]
[Authorize(Policy = AdminApiKeyAuthorizationDefaults.Policy, AuthenticationSchemes = AdminApiKeyAuthenticationDefaults.Scheme)]
public sealed class AdminLicensesController : ControllerBase
{
    private readonly ILicenseAdminService _licenseAdminService;
    private readonly ILogger<AdminLicensesController> _logger;

    public AdminLicensesController(ILicenseAdminService licenseAdminService, ILogger<AdminLicensesController> logger)
    {
        _licenseAdminService = licenseAdminService;
        _logger = logger;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<LicenseDetailsResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _licenseAdminService.GetLicenseAsync(
                id,
                GetActorType(),
                GetActorId(),
                cancellationToken);
            return Ok(response);
        }
        catch (LicenseAdminException ex)
        {
            _logger.LogWarning(ex, "License lookup failed: {ErrorCode}", ex.ErrorCode);
            return StatusCode(ex.StatusCode, new ProblemDetails
            {
                Title = "License lookup failed",
                Detail = ex.Message,
                Extensions = { ["errorCode"] = ex.ErrorCode }
            });
        }
    }

    [HttpGet]
    public async Task<ActionResult<LicenseSearchResponse>> Search(
        [FromQuery] string? productCode,
        [FromQuery] string? status,
        [FromQuery] string? customerCode,
        [FromQuery] string? licenseKeyMasked,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _licenseAdminService.SearchLicensesAsync(
                productCode,
                status,
                customerCode,
                licenseKeyMasked,
                page,
                pageSize,
                GetActorType(),
                GetActorId(),
                cancellationToken);

            return Ok(response);
        }
        catch (LicenseAdminException ex)
        {
            _logger.LogWarning(ex, "License search failed: {ErrorCode}", ex.ErrorCode);
            return StatusCode(ex.StatusCode, new ProblemDetails
            {
                Title = "License search failed",
                Detail = ex.Message,
                Extensions = { ["errorCode"] = ex.ErrorCode }
            });
        }
    }

    [HttpPost("{id:guid}/revoke")]
    public async Task<ActionResult<LicenseDetailsResponse>> Revoke(Guid id, [FromBody] RevokeLicenseRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _licenseAdminService.RevokeLicenseAsync(
                id,
                request.Reason,
                GetActorType(),
                GetActorId(),
                cancellationToken);
            return Ok(response);
        }
        catch (LicenseAdminException ex)
        {
            _logger.LogWarning(ex, "License revocation failed: {ErrorCode}", ex.ErrorCode);
            return StatusCode(ex.StatusCode, new ProblemDetails
            {
                Title = "License revocation failed",
                Detail = ex.Message,
                Extensions = { ["errorCode"] = ex.ErrorCode }
            });
        }
    }

    private string GetActorType()
    {
        return User.FindFirstValue(AdminApiKeyAuthenticationDefaults.ActorTypeClaimType)
            ?? AdminApiKeyAuthenticationDefaults.ActorTypeValue;
    }

    private string GetActorId()
    {
        return User.FindFirstValue(AdminApiKeyAuthenticationDefaults.ActorIdClaimType)
            ?? AdminApiKeyAuthenticationDefaults.ActorTypeValue;
    }
}
