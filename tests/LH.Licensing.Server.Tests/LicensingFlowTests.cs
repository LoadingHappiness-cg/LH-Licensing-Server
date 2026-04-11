using System.Net;
using System.Net.Http.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Text.Json;
using LH.Licensing.Server.Domain.Entities;
using LH.Licensing.Server.Domain.Enums;
using LH.Licensing.Server.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace LH.Licensing.Server.Tests;

public sealed class LicensingFlowTests : IClassFixture<TestApplicationFactory>
{
    private readonly TestApplicationFactory _factory;
    private readonly HttpClient _client;

    public LicensingFlowTests(TestApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Activate_ReturnsTokens_AndPersistsActivation()
    {
        await _factory.InitializeDatabaseAsync();
        var (licenseKey, productCode, appId) = await SeedActivationScenarioAsync();

        var response = await _client.PostAsJsonAsync("/api/licenses/activate", new
        {
            licenseKey,
            productCode,
            appId,
            machineFingerprint = "fingerprint-001",
            deviceName = "DESKTOP-01",
            clientVersion = "1.0.0"
        });

        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(payload);

        var root = payload!.RootElement;
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("accessToken").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("refreshToken").GetString()));
        Assert.True(root.GetProperty("expiresAt").GetDateTimeOffset() > DateTimeOffset.UtcNow);
        Assert.True(root.GetProperty("offlineGraceUntil").GetDateTimeOffset() > DateTimeOffset.UtcNow);
        Assert.Equal(1, root.GetProperty("policyVersion").GetInt32());

        ValidateJwtSignature(root.GetProperty("accessToken").GetString()!, _factory.PublicKeyPath, _factory.Issuer, _factory.Audience);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var activation = await dbContext.Activations.SingleAsync();
        Assert.Equal(ActivationStatus.Active, activation.Status);
        Assert.False(string.IsNullOrWhiteSpace(activation.RefreshTokenHash));
        Assert.False(string.IsNullOrWhiteSpace(activation.TokenJti));

        var audit = await dbContext.AuditEvents.SingleAsync();
        Assert.Equal(AuditEventType.LicenseActivated, audit.EventType);
    }

    [Fact]
    public async Task Refresh_RotatesRefreshToken_AndIssuesNewAccessToken()
    {
        await _factory.InitializeDatabaseAsync();
        var scenario = await SeedActivationScenarioAsync();

        var activateResponse = await _client.PostAsJsonAsync("/api/licenses/activate", new
        {
            licenseKey = scenario.licenseKey,
            productCode = scenario.productCode,
            appId = scenario.appId,
            machineFingerprint = "fingerprint-001",
            deviceName = "DESKTOP-01",
            clientVersion = "1.0.0"
        });

        activateResponse.EnsureSuccessStatusCode();
        var activatePayload = await activateResponse.Content.ReadFromJsonAsync<JsonDocument>();
        var originalRefreshToken = activatePayload!.RootElement.GetProperty("refreshToken").GetString();

        var refreshResponse = await _client.PostAsJsonAsync("/api/licenses/refresh", new
        {
            refreshToken = originalRefreshToken,
            productCode = scenario.productCode,
            appId = scenario.appId,
            machineFingerprint = "fingerprint-001",
            clientVersion = "1.0.1"
        });

        refreshResponse.EnsureSuccessStatusCode();
        var refreshPayload = await refreshResponse.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(refreshPayload);

        var root = refreshPayload!.RootElement;
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("accessToken").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(root.GetProperty("refreshToken").GetString()));
        Assert.NotEqual(originalRefreshToken, root.GetProperty("refreshToken").GetString());
        Assert.True(root.GetProperty("expiresAt").GetDateTimeOffset() > DateTimeOffset.UtcNow);

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var activation = await dbContext.Activations.SingleAsync();
        Assert.Equal(2, await dbContext.AuditEvents.CountAsync());
        Assert.True(activation.LastRefreshedAt.HasValue);
        Assert.NotEqual(originalRefreshToken, activation.RefreshTokenHash);
    }

    [Fact]
    public async Task Activate_ReturnsBadRequest_ForUnknownLicense()
    {
        await _factory.InitializeDatabaseAsync();
        var scenario = await SeedActivationScenarioAsync();

        var response = await _client.PostAsJsonAsync("/api/licenses/activate", new
        {
            licenseKey = $"{scenario.licenseKey}-INVALID",
            productCode = scenario.productCode,
            appId = scenario.appId,
            machineFingerprint = "fingerprint-001",
            deviceName = "DESKTOP-01",
            clientVersion = "1.0.0"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<(string licenseKey, string productCode, string appId)> SeedActivationScenarioAsync()
    {
        await _factory.ResetDatabaseAsync();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTimeOffset.UtcNow;
        var productCode = $"LH.DESKTOP.TEST.{Guid.NewGuid():N}";
        var customer = new Customer("CUST-LH", "Loading Happiness")
        {
            Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            CreatedAt = now
        };

        var product = new Product(productCode, "Test Desktop Product", 1)
        {
            Id = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            AllowedAppIdsJson = """
            ["lh.labels.gs1.desktop","lh.desktop.test"]
            """
        };
        product.CreatedAt = now;

        var plan = new LicensePlan(product.Id, "STANDARD", "Standard", """
            {"max_activations":2,"offline_grace_days":7,"features":["basic","standard"]}
            """, 7, 2)
        {
            Id = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            CreatedAt = now
        };

        var licenseKey = "LH-TEST-0001";
        var license = new License(customer.Id, product.Id, plan.Id, licenseKey, now.AddDays(-1), now.AddMonths(1), 1)
        {
            Id = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
            CreatedAt = now
        };

        dbContext.Customers.Add(customer);
        dbContext.Products.Add(product);
        dbContext.LicensePlans.Add(plan);
        dbContext.Licenses.Add(license);
        await dbContext.SaveChangesAsync();

        return (licenseKey, product.ProductCode, "lh.labels.gs1.desktop");
    }

    private static void ValidateJwtSignature(string token, string publicKeyPath, string issuer, string audience)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(File.ReadAllText(publicKeyPath));

        var handler = new JwtSecurityTokenHandler();
        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new RsaSecurityKey(rsa),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        var principal = handler.ValidateToken(token, parameters, out var validatedToken);
        var jwt = Assert.IsType<JwtSecurityToken>(validatedToken);
        Assert.Equal("test-key-1", jwt.Header.Kid);
        Assert.True(principal.Identity?.IsAuthenticated);
    }
}
