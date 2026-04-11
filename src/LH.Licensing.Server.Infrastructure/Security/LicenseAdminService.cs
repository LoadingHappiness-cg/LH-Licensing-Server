using System.Net;
using System.Text.Json;
using LH.Licensing.Server.Application;
using LH.Licensing.Server.Contracts;
using LH.Licensing.Server.Domain.Entities;
using LH.Licensing.Server.Domain.Enums;
using LH.Licensing.Server.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LH.Licensing.Server.Infrastructure.Security;

public sealed class LicenseAdminService : ILicenseAdminService
{
    private readonly AppDbContext _dbContext;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<LicenseAdminService> _logger;

    public LicenseAdminService(AppDbContext dbContext, TimeProvider timeProvider, ILogger<LicenseAdminService> logger)
    {
        _dbContext = dbContext;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<LicenseDetailsResponse> GetLicenseAsync(Guid licenseId, string actorType, string actorId, CancellationToken cancellationToken)
    {
        var license = await LoadLicenseAsync(licenseId, cancellationToken);
        if (license is null)
        {
            throw new LicenseAdminException("license_not_found", "License not found.", (int)HttpStatusCode.NotFound);
        }

        _logger.LogInformation("Admin {ActorType}:{ActorId} loaded license {LicenseId}", actorType, actorId, licenseId);

        return MapLicense(license);
    }

    public async Task<LicenseDetailsResponse> RevokeLicenseAsync(Guid licenseId, string reason, string actorType, string actorId, CancellationToken cancellationToken)
    {
        var now = _timeProvider.GetUtcNow();
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new LicenseAdminException("reason_required", "Revocation reason is required.", (int)HttpStatusCode.BadRequest);
        }

        var license = await LoadLicenseAsync(licenseId, cancellationToken);
        if (license is null)
        {
            throw new LicenseAdminException("license_not_found", "License not found.", (int)HttpStatusCode.NotFound);
        }

        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        license.Status = LicenseStatus.Revoked;
        license.RevokedAt = now;
        license.RevocationReason = reason.Trim();
        license.UpdatedAt = now;

        foreach (var activation in license.Activations)
        {
            if (activation.Status == ActivationStatus.Revoked)
            {
                continue;
            }

            activation.Status = ActivationStatus.Revoked;
            activation.RevokedAt = now;
            activation.RefreshTokenExpiresAt = now;
            activation.OfflineGraceUntil = now;
            activation.UpdatedAt = now;
        }

        _dbContext.AuditEvents.Add(new AuditEvent(
            AuditEventType.LicenseRevoked,
            actorType,
            actorId,
            JsonSerializer.Serialize(new
            {
                licenseId = license.Id,
                reason = reason.Trim()
            }),
            license.CustomerId,
            license.ProductId,
            license.Id,
            null)
        {
            CreatedAt = now
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return MapLicense(license);
    }

    public async Task<LicenseSearchResponse> SearchLicensesAsync(
        string? productCode,
        string? status,
        string? customerCode,
        string? licenseKeyMasked,
        int page,
        int pageSize,
        string actorType,
        string actorId,
        CancellationToken cancellationToken)
    {
        if (page < 1)
        {
            throw new LicenseAdminException("page_invalid", "Page must be greater than zero.", (int)HttpStatusCode.BadRequest);
        }

        if (pageSize < 1 || pageSize > 100)
        {
            throw new LicenseAdminException("page_size_invalid", "Page size must be between 1 and 100.", (int)HttpStatusCode.BadRequest);
        }

        LicenseStatus? parsedStatus = null;
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<LicenseStatus>(status, true, out var statusValue))
            {
                throw new LicenseAdminException("status_invalid", "Status is invalid.", (int)HttpStatusCode.BadRequest);
            }

            parsedStatus = statusValue;
        }

        var query = _dbContext.Licenses
            .AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Product)
            .Include(x => x.LicensePlan)
            .Include(x => x.Activations)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(productCode))
        {
            var normalized = productCode.Trim();
            query = query.Where(x => x.Product != null && x.Product.ProductCode == normalized);
        }

        if (!string.IsNullOrWhiteSpace(customerCode))
        {
            var normalized = customerCode.Trim();
            query = query.Where(x => x.Customer != null && x.Customer.Code == normalized);
        }

        if (parsedStatus is not null)
        {
            query = query.Where(x => x.Status == parsedStatus.Value);
        }

        _logger.LogInformation(
            "Admin {ActorType}:{ActorId} searched licenses with filters productCode={ProductCode} status={Status} customerCode={CustomerCode}",
            actorType,
            actorId,
            productCode,
            status,
            customerCode);

        var records = await query
            .ToListAsync(cancellationToken);

        records = records
            .OrderByDescending(x => x.UpdatedAt)
            .ThenByDescending(x => x.CreatedAt)
            .ToList();

        if (!string.IsNullOrWhiteSpace(licenseKeyMasked))
        {
            var normalizedMask = licenseKeyMasked.Trim();
            records = records
                .Where(x => MaskLicenseKey(x.LicenseKey).Contains(normalizedMask, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        var totalCount = records.Count;
        var items = records
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapLicenseListItem)
            .ToArray();

        return new LicenseSearchResponse
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    private async Task<License?> LoadLicenseAsync(Guid licenseId, CancellationToken cancellationToken)
    {
        return await _dbContext.Licenses
            .Include(x => x.Customer)
            .Include(x => x.Product)
            .Include(x => x.LicensePlan)
            .Include(x => x.Activations)
                .ThenInclude(x => x.Installation)
            .SingleOrDefaultAsync(x => x.Id == licenseId, cancellationToken);
    }

    private static LicenseDetailsResponse MapLicense(License license)
    {
        var activations = license.Activations
            .OrderByDescending(x => x.ActivatedAt)
            .Select(x => new ActivationSummaryDto(
                x.Id,
                x.InstallationId,
                x.Status.ToString(),
                x.ActivatedAt,
                x.ExpiresAt,
                x.LastRefreshedAt,
                x.RevokedAt,
                x.ClientVersion))
            .ToArray();

        return new LicenseDetailsResponse
        {
            LicenseId = license.Id,
            CustomerId = license.CustomerId,
            CustomerCode = license.Customer?.Code ?? string.Empty,
            CustomerName = license.Customer?.Name ?? string.Empty,
            ProductId = license.ProductId,
            ProductCode = license.Product?.ProductCode ?? string.Empty,
            ProductName = license.Product?.Name ?? string.Empty,
            LicensePlanId = license.LicensePlanId,
            PlanCode = license.LicensePlan?.PlanCode ?? string.Empty,
            PlanName = license.LicensePlan?.Name ?? string.Empty,
            Status = license.Status.ToString(),
            StartsAt = license.StartsAt,
            EndsAt = license.EndsAt,
            RevokedAt = license.RevokedAt,
            RevocationReason = license.RevocationReason,
            PolicyVersion = license.PolicyVersion,
            TotalActivations = license.Activations.Count,
            ActiveActivations = license.Activations.Count(x => x.Status == ActivationStatus.Active && x.RevokedAt is null),
            Activations = activations
        };
    }

    private static LicenseListItemDto MapLicenseListItem(License license)
    {
        var activeActivations = license.Activations.Count(x => x.Status == ActivationStatus.Active && x.RevokedAt is null);

        return new LicenseListItemDto
        {
            LicenseId = license.Id,
            LicenseKeyMasked = MaskLicenseKey(license.LicenseKey),
            CustomerId = license.CustomerId,
            CustomerCode = license.Customer?.Code ?? string.Empty,
            CustomerName = license.Customer?.Name ?? string.Empty,
            ProductId = license.ProductId,
            ProductCode = license.Product?.ProductCode ?? string.Empty,
            ProductName = license.Product?.Name ?? string.Empty,
            LicensePlanId = license.LicensePlanId,
            PlanCode = license.LicensePlan?.PlanCode ?? string.Empty,
            Status = license.Status.ToString(),
            StartsAt = license.StartsAt,
            EndsAt = license.EndsAt,
            RevokedAt = license.RevokedAt,
            TotalActivations = license.Activations.Count,
            ActiveActivations = activeActivations
        };
    }

    private static string MaskLicenseKey(string licenseKey)
    {
        if (string.IsNullOrWhiteSpace(licenseKey))
        {
            return string.Empty;
        }

        var value = licenseKey.Trim();
        if (value.Length <= 8)
        {
            return new string('*', value.Length);
        }

        var masked = value.ToCharArray();
        for (var i = 4; i < masked.Length - 4; i++)
        {
            masked[i] = '*';
        }

        return new string(masked);
    }
}
