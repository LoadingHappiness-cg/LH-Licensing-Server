using System.Text.Json;
using LH.Licensing.Server.Application;
using LH.Licensing.Server.Contracts;
using LH.Licensing.Server.Domain.Entities;
using LH.Licensing.Server.Domain.Enums;
using LH.Licensing.Server.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace LH.Licensing.Server.Infrastructure.Security;

public sealed class LicenseFlowService : ILicenseFlowService
{
    private readonly AppDbContext _dbContext;
    private readonly RsaJwtTokenService _tokenService;
    private readonly ILogger<LicenseFlowService> _logger;
    private readonly TimeProvider _timeProvider;

    public LicenseFlowService(AppDbContext dbContext, RsaJwtTokenService tokenService, ILogger<LicenseFlowService> logger, TimeProvider timeProvider)
    {
        _dbContext = dbContext;
        _tokenService = tokenService;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    public async Task<ActivateLicenseResponse> ActivateAsync(ActivateLicenseRequest request, CancellationToken cancellationToken)
    {
        var now = _timeProvider.GetUtcNow();
        var normalizedLicenseKey = LicenseKeyHasher.Normalize(request.LicenseKey);
        var normalizedProductCode = request.ProductCode.Trim();
        var normalizedAppId = request.AppId.Trim();
        var normalizedFingerprint = request.MachineFingerprint.Trim();

        var product = await _dbContext.Products
            .SingleOrDefaultAsync(x => x.ProductCode == normalizedProductCode, cancellationToken);

        if (product is null)
        {
            return await DenyActivationAsync("product_not_found", "Product not found.", request, cancellationToken);
        }

        var allowedAppIds = JsonPolicyParser.ParseAllowedAppIds(product.AllowedAppIdsJson);
        if (!allowedAppIds.Contains(normalizedAppId, StringComparer.OrdinalIgnoreCase))
        {
            return await DenyActivationAsync("app_not_allowed", "App not allowed for product.", request, cancellationToken, productId: product.Id);
        }

        var license = await _dbContext.Licenses
            .Include(x => x.LicensePlan)
            .SingleOrDefaultAsync(x => x.LicenseKey == normalizedLicenseKey, cancellationToken);

        if (license is null)
        {
            return await DenyActivationAsync("license_not_found", "License not found.", request, cancellationToken, productId: product.Id);
        }

        if (license.ProductId != product.Id)
        {
            return await DenyActivationAsync("product_mismatch", "License does not belong to product.", request, cancellationToken, product.Id, license.Id);
        }

        if (!string.Equals(LicenseKeyHasher.Hash(normalizedLicenseKey), LicenseKeyHasher.Hash(license.LicenseKey), StringComparison.OrdinalIgnoreCase))
        {
            return await DenyActivationAsync("license_hash_mismatch", "License hash does not match.", request, cancellationToken, product.Id, license.Id);
        }

        if (license.Status != LicenseStatus.Active)
        {
            return await DenyActivationAsync("license_inactive", "License is not active.", request, cancellationToken, product.Id, license.Id);
        }

        if (license.StartsAt > now || (license.EndsAt.HasValue && license.EndsAt.Value < now))
        {
            return await DenyActivationAsync("license_out_of_range", "License is outside valid dates.", request, cancellationToken, product.Id, license.Id);
        }

        if (license.LicensePlan is null || license.LicensePlan.Status != LicensePlanStatus.Active)
        {
            return await DenyActivationAsync("plan_invalid", "Plan is not active.", request, cancellationToken, product.Id, license.Id);
        }

        var currentActiveCount = await _dbContext.Activations.CountAsync(x => x.LicenseId == license.Id && x.Status == ActivationStatus.Active && x.RevokedAt == null, cancellationToken);
        var existingInstallation = await _dbContext.Installations
            .SingleOrDefaultAsync(x => x.ProductId == product.Id && x.AppId == normalizedAppId && x.MachineFingerprintHash == LicenseKeyHasher.Hash(normalizedFingerprint), cancellationToken);

        if (existingInstallation is null && currentActiveCount >= license.LicensePlan.MaxActivations)
        {
            return await DenyActivationAsync("activation_limit_reached", "Activation limit reached.", request, cancellationToken, product.Id, license.Id);
        }

        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        var installation = existingInstallation;
        if (installation is null)
        {
            installation = new Installation(product.Id, normalizedAppId, LicenseKeyHasher.Hash(normalizedFingerprint), request.DeviceName?.Trim(), null)
            {
                Id = Guid.NewGuid(),
                CreatedAt = now
            };
            _dbContext.Installations.Add(installation);
        }
        else
        {
            installation.DeviceName = request.DeviceName?.Trim();
            installation.LastSeenAt = now;
            installation.UpdatedAt = now;
        }

        var refreshToken = RefreshTokenService.GenerateToken();
        var refreshTokenHash = RefreshTokenService.Hash(refreshToken);
        var offlineGraceUntil = now.AddDays(license.LicensePlan.OfflineGraceDays);

        var activation = await _dbContext.Activations
            .SingleOrDefaultAsync(x => x.LicenseId == license.Id && x.InstallationId == installation.Id, cancellationToken);

        var activationId = activation?.Id ?? Guid.NewGuid();
        var (accessToken, jti, expiresAt) = _tokenService.CreateToken(
            activationId: activationId,
            licenseId: license.Id,
            customerId: license.CustomerId,
            productId: license.ProductId,
            installationId: installation.Id,
            productCode: product.ProductCode,
            appId: normalizedAppId,
            planCode: license.LicensePlan.PlanCode,
            policyVersion: license.PolicyVersion,
            offlineGraceUntil: offlineGraceUntil,
            licenseStatus: license.Status.ToString().ToLowerInvariant(),
            entitlements: BuildEntitlements(license.LicensePlan),
            timeProvider: _timeProvider);

        if (activation is null)
        {
            activation = new Activation(license.Id, installation.Id, jti, request.ClientVersion.Trim(), now, expiresAt)
            {
                Id = activationId,
                CreatedAt = now
            };
            _dbContext.Activations.Add(activation);
        }

        activation.Status = ActivationStatus.Active;
        activation.TokenJti = jti;
        activation.ClientVersion = request.ClientVersion.Trim();
        activation.ExpiresAt = expiresAt;
        activation.RefreshTokenExpiresAt = offlineGraceUntil;
        activation.RefreshTokenHash = refreshTokenHash;
        activation.OfflineGraceUntil = offlineGraceUntil;
        activation.ActivatedAt = now;
        activation.LastRefreshedAt = now;
        activation.RevokedAt = null;
        activation.UpdatedAt = now;

        await WriteAuditAsync(
            AuditEventType.LicenseActivated,
            request,
            now,
            payload: new
            {
                licenseId = license.Id,
                productCode = product.ProductCode,
                appId = normalizedAppId,
                installationId = installation.Id,
                activationId = activation.Id
            },
            customerId: license.CustomerId,
            productId: license.ProductId,
            licenseId: license.Id,
            installationId: installation.Id,
            cancellationToken);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation("License activated for product {ProductCode} and app {AppId}", product.ProductCode, normalizedAppId);

        return new ActivateLicenseResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = expiresAt,
            OfflineGraceUntil = offlineGraceUntil,
            PolicyVersion = license.PolicyVersion,
            Entitlements = BuildEntitlements(license.LicensePlan),
            License = new LicenseSummaryDto(license.Id, license.CustomerId, license.ProductId, installation.Id, product.ProductCode, license.LicensePlan.PlanCode, license.Status.ToString())
        };
    }

    public async Task<RefreshLicenseResponse> RefreshAsync(RefreshLicenseRequest request, CancellationToken cancellationToken)
    {
        var now = _timeProvider.GetUtcNow();
        var normalizedProductCode = request.ProductCode.Trim();
        var normalizedAppId = request.AppId.Trim();
        var normalizedFingerprintHash = LicenseKeyHasher.Hash(request.MachineFingerprint);
        var refreshTokenHash = RefreshTokenService.Hash(request.RefreshToken);

        var activation = await _dbContext.Activations
            .Include(x => x.License)!.ThenInclude(x => x!.LicensePlan)
            .Include(x => x.Installation)
            .ThenInclude(x => x!.Product)
            .SingleOrDefaultAsync(x => x.RefreshTokenHash == refreshTokenHash, cancellationToken);

        if (activation is null)
        {
            return await DenyRefreshAsync("refresh_token_not_found", "Refresh token not found.", request, now, cancellationToken);
        }

        if (activation.Status != ActivationStatus.Active || activation.RevokedAt is not null)
        {
            return await DenyRefreshAsync("activation_revoked", "Activation is not active.", request, now, cancellationToken, activation);
        }

        if (activation.RefreshTokenExpiresAt < now)
        {
            return await DenyRefreshAsync("refresh_token_expired", "Refresh token expired.", request, now, cancellationToken, activation);
        }

        if (activation.Installation is null || activation.License is null || activation.License.LicensePlan is null)
        {
            return await DenyRefreshAsync("activation_invalid", "Activation is incomplete.", request, now, cancellationToken, activation);
        }

        if (!string.Equals(activation.Installation.Product?.ProductCode, normalizedProductCode, StringComparison.OrdinalIgnoreCase))
        {
            return await DenyRefreshAsync("product_mismatch", "Product code does not match activation.", request, now, cancellationToken, activation);
        }

        if (!string.Equals(activation.Installation.AppId, normalizedAppId, StringComparison.OrdinalIgnoreCase))
        {
            return await DenyRefreshAsync("app_mismatch", "App id does not match activation.", request, now, cancellationToken, activation);
        }

        if (!string.Equals(activation.Installation.MachineFingerprintHash, normalizedFingerprintHash, StringComparison.OrdinalIgnoreCase))
        {
            return await DenyRefreshAsync("fingerprint_mismatch", "Machine fingerprint does not match activation.", request, now, cancellationToken, activation);
        }

        if (activation.License.Status != LicenseStatus.Active)
        {
            return await DenyRefreshAsync("license_inactive", "License is not active.", request, now, cancellationToken, activation);
        }

        var product = activation.Installation.Product;
        var plan = activation.License.LicensePlan;

        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        var newRefreshToken = RefreshTokenService.GenerateToken();
        var newRefreshTokenHash = RefreshTokenService.Hash(newRefreshToken);
        var offlineGraceUntil = now.AddDays(plan.OfflineGraceDays);
        var (accessToken, jti, expiresAt) = _tokenService.CreateToken(
            activationId: activation.Id,
            licenseId: activation.LicenseId,
            customerId: activation.License.CustomerId,
            productId: activation.License.ProductId,
            installationId: activation.InstallationId,
            productCode: product!.ProductCode,
            appId: activation.Installation.AppId,
            planCode: plan.PlanCode,
            policyVersion: activation.License.PolicyVersion,
            offlineGraceUntil: offlineGraceUntil,
            licenseStatus: activation.License.Status.ToString().ToLowerInvariant(),
            entitlements: BuildEntitlements(plan),
            timeProvider: _timeProvider);

        activation.Status = ActivationStatus.Active;
        activation.TokenJti = jti;
        activation.ClientVersion = request.ClientVersion.Trim();
        activation.ExpiresAt = expiresAt;
        activation.RefreshTokenExpiresAt = offlineGraceUntil;
        activation.RefreshTokenHash = newRefreshTokenHash;
        activation.OfflineGraceUntil = offlineGraceUntil;
        activation.LastRefreshedAt = now;
        activation.UpdatedAt = now;

        activation.Installation.LastSeenAt = now;
        activation.Installation.UpdatedAt = now;

        await WriteAuditAsync(
            AuditEventType.LicenseRefreshed,
            request,
            now,
            payload: new
            {
                licenseId = activation.LicenseId,
                installationId = activation.InstallationId,
                activationId = activation.Id
            },
            customerId: activation.License.CustomerId,
            productId: activation.License.ProductId,
            licenseId: activation.LicenseId,
            installationId: activation.InstallationId,
            cancellationToken);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        _logger.LogInformation("License refreshed for activation {ActivationId}", activation.Id);

        return new RefreshLicenseResponse
        {
            AccessToken = accessToken,
            RefreshToken = newRefreshToken,
            ExpiresAt = expiresAt,
            OfflineGraceUntil = offlineGraceUntil,
            PolicyVersion = activation.License.PolicyVersion,
            Entitlements = BuildEntitlements(plan)
        };
    }

    private static LicenseEntitlementsDto BuildEntitlements(LicensePlan plan)
    {
        var parsed = JsonPolicyParser.ParseEntitlements(plan.EntitlementsJson);
        return new LicenseEntitlementsDto(parsed.MaxActivations, parsed.OfflineGraceDays, parsed.Features);
    }

    private async Task<ActivateLicenseResponse> DenyActivationAsync(
        string errorCode,
        string message,
        ActivateLicenseRequest request,
        CancellationToken cancellationToken,
        Guid? productId = null,
        Guid? licenseId = null)
    {
        await WriteAuditAsync(
            AuditEventType.LicenseActivated,
            request,
            _timeProvider.GetUtcNow(),
            payload: new
            {
                errorCode,
                message,
                licenseKey = request.LicenseKey,
                productCode = request.ProductCode,
                appId = request.AppId
            },
            productId: productId,
            licenseId: licenseId,
            cancellationToken: cancellationToken,
            eventTypeOverride: AuditEventType.LicenseActivationDenied);

        throw new LicenseFlowException(errorCode, message);
    }

    private async Task<RefreshLicenseResponse> DenyRefreshAsync(
        string errorCode,
        string message,
        RefreshLicenseRequest request,
        DateTimeOffset now,
        CancellationToken cancellationToken,
        Activation? activation = null)
    {
        await WriteAuditAsync(
            AuditEventType.LicenseRefreshed,
            request,
            now,
            payload: new
            {
                errorCode,
                message,
                productCode = request.ProductCode,
                appId = request.AppId
            },
            customerId: activation?.License?.CustomerId,
            productId: activation?.License?.ProductId,
            licenseId: activation?.LicenseId,
            installationId: activation?.InstallationId,
            cancellationToken: cancellationToken,
            eventTypeOverride: AuditEventType.LicenseRefreshDenied);

        throw new LicenseFlowException(errorCode, message);
    }

    private async Task WriteAuditAsync<TRequest>(
        AuditEventType eventType,
        TRequest request,
        DateTimeOffset now,
        object payload,
        Guid? customerId = null,
        Guid? productId = null,
        Guid? licenseId = null,
        Guid? installationId = null,
        CancellationToken cancellationToken = default,
        AuditEventType? eventTypeOverride = null)
    {
        var auditEvent = new AuditEvent(eventTypeOverride ?? eventType, "system", null, JsonSerializer.Serialize(payload), customerId, productId, licenseId, installationId)
        {
            CreatedAt = now
        };

        _dbContext.AuditEvents.Add(auditEvent);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
