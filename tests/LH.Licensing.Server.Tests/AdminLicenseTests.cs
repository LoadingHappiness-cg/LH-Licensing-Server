using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using LH.Licensing.Server.Domain.Entities;
using LH.Licensing.Server.Domain.Enums;
using LH.Licensing.Server.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace LH.Licensing.Server.Tests;

public sealed class AdminLicenseTests : IClassFixture<TestApplicationFactory>
{
    private readonly TestApplicationFactory _factory;
    private readonly HttpClient _client;
    private readonly HttpClient _adminClient;

    public AdminLicenseTests(TestApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _adminClient = factory.CreateClient();
        _adminClient.DefaultRequestHeaders.Add("X-Admin-Api-Key", factory.AdminApiKey);
    }

    [Fact]
    public async Task Admin_Endpoints_RequireApiKey()
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
        var licenseId = activatePayload!.RootElement.GetProperty("license").GetProperty("licenseId").GetGuid();

        var getResponse = await _client.GetAsync($"/api/admin/licenses/{licenseId}");
        Assert.Equal(HttpStatusCode.Unauthorized, getResponse.StatusCode);

        var listResponse = await _client.GetAsync("/api/admin/licenses");
        Assert.Equal(HttpStatusCode.Unauthorized, listResponse.StatusCode);

        var revokeResponse = await _client.PostAsJsonAsync($"/api/admin/licenses/{licenseId}/revoke", new
        {
            reason = "Customer requested revocation"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, revokeResponse.StatusCode);
    }

    [Fact]
    public async Task Admin_Endpoints_ReturnForbidden_ForInvalidApiKey()
    {
        await _factory.InitializeDatabaseAsync();
        var scenario = await SeedActivationScenarioAsync();

        var activateResponse = await _adminClient.PostAsJsonAsync("/api/licenses/activate", new
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
        var licenseId = activatePayload!.RootElement.GetProperty("license").GetProperty("licenseId").GetGuid();

        using var invalidClient = _factory.CreateClient();
        invalidClient.DefaultRequestHeaders.Add("X-Admin-Api-Key", "definitely-wrong");

        var getResponse = await invalidClient.GetAsync($"/api/admin/licenses/{licenseId}");
        Assert.Equal(HttpStatusCode.Forbidden, getResponse.StatusCode);

        var listResponse = await invalidClient.GetAsync("/api/admin/licenses");
        Assert.Equal(HttpStatusCode.Forbidden, listResponse.StatusCode);
    }

    [Fact]
    public async Task Search_ReturnsPagedFilteredResults()
    {
        await _factory.InitializeDatabaseAsync();
        var scenario = await SeedSearchScenarioAsync();

        var firstPageResponse = await _adminClient.GetAsync($"/api/admin/licenses?productCode={Uri.EscapeDataString(scenario.productCode)}&customerCode={Uri.EscapeDataString(scenario.customerCode)}&status=Active&page=1&pageSize=1");
        Assert.True(firstPageResponse.IsSuccessStatusCode, await firstPageResponse.Content.ReadAsStringAsync());

        var firstPagePayload = await firstPageResponse.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(firstPagePayload);
        var firstRoot = firstPagePayload!.RootElement;
        Assert.Equal(1, firstRoot.GetProperty("page").GetInt32());
        Assert.Equal(1, firstRoot.GetProperty("pageSize").GetInt32());
        Assert.Equal(2, firstRoot.GetProperty("totalCount").GetInt32());
        Assert.Single(firstRoot.GetProperty("items").EnumerateArray());

        var firstItem = firstRoot.GetProperty("items").EnumerateArray().First();
        var maskedKey = firstItem.GetProperty("licenseKeyMasked").GetString()!;

        var maskedResponse = await _adminClient.GetAsync($"/api/admin/licenses?licenseKeyMasked={Uri.EscapeDataString(maskedKey)}&page=1&pageSize=10");
        Assert.True(maskedResponse.IsSuccessStatusCode, await maskedResponse.Content.ReadAsStringAsync());
        var maskedPayload = await maskedResponse.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(maskedPayload);
        Assert.Equal(1, maskedPayload!.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Equal(maskedKey, maskedPayload.RootElement.GetProperty("items").EnumerateArray().First().GetProperty("licenseKeyMasked").GetString());

        var secondPageResponse = await _adminClient.GetAsync($"/api/admin/licenses?productCode={Uri.EscapeDataString(scenario.productCode)}&customerCode={Uri.EscapeDataString(scenario.customerCode)}&status=Active&page=2&pageSize=1");
        Assert.True(secondPageResponse.IsSuccessStatusCode, await secondPageResponse.Content.ReadAsStringAsync());
        var secondPagePayload = await secondPageResponse.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(secondPagePayload);
        Assert.Equal(2, secondPagePayload!.RootElement.GetProperty("totalCount").GetInt32());
        Assert.Single(secondPagePayload.RootElement.GetProperty("items").EnumerateArray());
    }

    [Fact]
    public async Task Revoke_BlocksFutureRefresh_AndReturnsAdminDetails()
    {
        await _factory.InitializeDatabaseAsync();
        var scenario = await SeedActivationScenarioAsync();

        var activateResponse = await _adminClient.PostAsJsonAsync("/api/licenses/activate", new
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
        var root = activatePayload!.RootElement;
        var licenseId = root.GetProperty("license").GetProperty("licenseId").GetGuid();
        var refreshToken = root.GetProperty("refreshToken").GetString()!;

        var revokeResponse = await _adminClient.PostAsJsonAsync($"/api/admin/licenses/{licenseId}/revoke", new
        {
            reason = "Customer requested revocation"
        });

        revokeResponse.EnsureSuccessStatusCode();
        var revokePayload = await revokeResponse.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(revokePayload);
        var revokeRoot = revokePayload!.RootElement;
        Assert.Equal("Revoked", revokeRoot.GetProperty("status").GetString());
        Assert.Equal("Customer requested revocation", revokeRoot.GetProperty("revocationReason").GetString());
        Assert.NotNull(revokeRoot.GetProperty("revokedAt").GetString());
        Assert.Equal(0, revokeRoot.GetProperty("activeActivations").GetInt32());

        var getResponse = await _adminClient.GetAsync($"/api/admin/licenses/{licenseId}");
        getResponse.EnsureSuccessStatusCode();
        var getPayload = await getResponse.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(getPayload);
        Assert.Equal("Revoked", getPayload!.RootElement.GetProperty("status").GetString());
        Assert.Equal(1, getPayload.RootElement.GetProperty("totalActivations").GetInt32());

        var refreshResponse = await _adminClient.PostAsJsonAsync("/api/licenses/refresh", new
        {
            refreshToken,
            productCode = scenario.productCode,
            appId = scenario.appId,
            machineFingerprint = "fingerprint-001",
            clientVersion = "1.0.1"
        });

        Assert.Equal(HttpStatusCode.BadRequest, refreshResponse.StatusCode);
        var problem = await refreshResponse.Content.ReadFromJsonAsync<JsonDocument>();
        Assert.NotNull(problem);
        Assert.Equal("activation_revoked", problem!.RootElement.GetProperty("errorCode").GetString());

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var license = await dbContext.Licenses.Include(x => x.Activations).SingleAsync();
        Assert.Equal(LicenseStatus.Revoked, license.Status);
        Assert.NotNull(license.RevokedAt);
        Assert.Equal(ActivationStatus.Revoked, license.Activations.Single().Status);
        Assert.Equal(3, await dbContext.AuditEvents.CountAsync());
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

    private async Task<(string productCode, string customerCode)> SeedSearchScenarioAsync()
    {
        await _factory.ResetDatabaseAsync();

        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTimeOffset.UtcNow;
        var productCode = $"LH.DESKTOP.LIST.{Guid.NewGuid():N}";
        var customerCode = $"CUST-{Guid.NewGuid():N}".ToUpperInvariant();
        var otherCustomerCode = $"CUST-{Guid.NewGuid():N}".ToUpperInvariant();

        var customer = new Customer(customerCode, "Search Customer")
        {
            Id = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
            CreatedAt = now
        };

        var otherCustomer = new Customer(otherCustomerCode, "Other Customer")
        {
            Id = Guid.Parse("ffffffff-ffff-ffff-ffff-ffffffffffff"),
            CreatedAt = now
        };

        var product = new Product(productCode, "Search Product", 1)
        {
            Id = Guid.Parse("11111111-2222-3333-4444-555555555555"),
            AllowedAppIdsJson = """
            ["lh.labels.gs1.desktop","lh.desktop.search"]
            """
        };
        product.CreatedAt = now;

        var plan = new LicensePlan(product.Id, "STANDARD", "Standard", """
            {"max_activations":3,"offline_grace_days":7,"features":["basic","standard"]}
            """, 7, 3)
        {
            Id = Guid.Parse("66666666-6666-6666-6666-666666666666"),
            CreatedAt = now
        };

        var license1 = new License(customer.Id, product.Id, plan.Id, "LH-LIST-0001", now.AddDays(-2), now.AddMonths(1), 1)
        {
            Id = Guid.Parse("77777777-7777-7777-7777-777777777771"),
            CreatedAt = now
        };

        var license2 = new License(customer.Id, product.Id, plan.Id, "LH-LIST-0002", now.AddDays(-1), now.AddMonths(1), 1)
        {
            Id = Guid.Parse("77777777-7777-7777-7777-777777777772"),
            CreatedAt = now
        };

        var revokedLicense = new License(otherCustomer.Id, product.Id, plan.Id, "LH-LIST-0003", now.AddDays(-1), now.AddMonths(1), 1)
        {
            Id = Guid.Parse("77777777-7777-7777-7777-777777777773"),
            Status = LicenseStatus.Revoked,
            RevokedAt = now,
            RevocationReason = "Manual test",
            CreatedAt = now
        };

        dbContext.Customers.AddRange(customer, otherCustomer);
        dbContext.Products.Add(product);
        dbContext.LicensePlans.Add(plan);
        dbContext.Licenses.AddRange(license1, license2, revokedLicense);
        await dbContext.SaveChangesAsync();

        return (product.ProductCode, customer.Code);
    }
}
