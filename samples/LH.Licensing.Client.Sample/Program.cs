using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.IdentityModel.Tokens;

namespace LH.Licensing.Client.Sample;

internal static class JsonDefaults
{
    public static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
}

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        var options = SampleOptions.Load(args);
        var store = new FileLicenseStore(options.StateFilePath);

        IDesktopLicensingClient client;
        JwtLicenseValidator validator;

        if (options.UseDemoServer)
        {
            var demoServer = DemoLicensingServer.Create(options);
            client = demoServer.Client;
            validator = new JwtLicenseValidator(demoServer.PublicKeyPath, options.Issuer, options.Audience, options.ProductCode, options.AppId, options.ClockSkew);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(options.BaseUrl))
            {
                Console.Error.WriteLine("Base URL is required in real mode.");
                return 1;
            }

            client = new DesktopLicensingClient(new HttpClient { BaseAddress = new Uri(options.BaseUrl, UriKind.Absolute) });
            validator = new JwtLicenseValidator(options.PublicKeyPemPath ?? throw new InvalidOperationException("Public key path is required in real mode."), options.Issuer, options.Audience, options.ProductCode, options.AppId, options.ClockSkew);
        }

        var runtime = new ClientRuntime(store, validator, client, options);
        await runtime.RunAsync();
        return 0;
    }
}

internal sealed class ClientRuntime
{
    private readonly FileLicenseStore _store;
    private readonly JwtLicenseValidator _validator;
    private readonly IDesktopLicensingClient _client;
    private readonly SampleOptions _options;
    private readonly LicenseDecisionEngine _decisionEngine = new();

    public ClientRuntime(FileLicenseStore store, JwtLicenseValidator validator, IDesktopLicensingClient client, SampleOptions options)
    {
        _store = store;
        _validator = validator;
        _client = client;
        _options = options;
    }

    public async Task RunAsync()
    {
        var snapshot = await _store.LoadAsync();
        if (snapshot is null)
        {
            Console.WriteLine("No cached snapshot. Activating now.");
            var activation = await _client.ActivateAsync(new ActivateRequest(
                _options.LicenseKey,
                _options.ProductCode,
                _options.AppId,
                _options.MachineFingerprint,
                _options.DeviceName,
                _options.ClientVersion));

            snapshot = LicenseSnapshot.FromActivation(activation, _options.MachineFingerprint);
            await _store.SaveAsync(snapshot);
            Console.WriteLine("Activation persisted locally.");
        }

        var state = Evaluate(snapshot, DateTimeOffset.UtcNow);
        PrintState("startup", state);

        if (state == LicenseState.Blocked)
        {
            return;
        }

        if (_options.SimulateTransientRefreshFailure && _client is DemoLicensingClient demoClient)
        {
            demoClient.ArmTransientRefreshFailureOnce();
        }

        await TryRefreshAsync(snapshot, DateTimeOffset.UtcNow, "refresh");

        snapshot = await _store.LoadAsync() ?? snapshot;

        if (_options.SimulateRevocationOnRefresh && _client is DemoLicensingClient demoClientForRevocation)
        {
            demoClientForRevocation.ArmRevocationOnNextRefresh();
            await TryRefreshAsync(snapshot, DateTimeOffset.UtcNow, "revocation refresh");
        }

        if (_options.SimulateOfflineGraceExpiry)
        {
            var expired = snapshot.WithExpiredGrace();
            PrintState("offline grace expiry", _decisionEngine.Evaluate(expired, DateTimeOffset.UtcNow));
        }
    }

    private async Task TryRefreshAsync(LicenseSnapshot snapshot, DateTimeOffset now, string label)
    {
        try
        {
            var refreshed = await _client.RefreshAsync(new RefreshRequest(
                snapshot.RefreshToken,
                snapshot.ProductCode,
                snapshot.AppId,
                snapshot.MachineFingerprint,
                _options.ClientVersion));

            var nextSnapshot = snapshot.WithRefresh(refreshed);
            await _store.SaveAsync(nextSnapshot);
            var state = Evaluate(nextSnapshot, now);
            PrintState(label, state);
        }
        catch (LicenseClientException ex) when (ex.IsTransient)
        {
            var degraded = _decisionEngine.FromRefreshFailure(snapshot, ex.ErrorCode, transient: true, now);
            PrintState($"{label} transient failure", degraded);
        }
        catch (LicenseClientException ex)
        {
            var blocked = _decisionEngine.FromRefreshFailure(snapshot, ex.ErrorCode, transient: false, now);
            PrintState($"{label} definitive failure", blocked);
            await _store.ClearAsync();
        }
    }

    private LicenseState Evaluate(LicenseSnapshot snapshot, DateTimeOffset now)
    {
        try
        {
            var validation = _validator.Validate(snapshot.AccessToken, snapshot.InstallationId);
            if (!validation.IsValid)
            {
                return now <= snapshot.OfflineGraceUntil ? LicenseState.Degraded : LicenseState.Blocked;
            }
        }
        catch
        {
            return now <= snapshot.OfflineGraceUntil ? LicenseState.Degraded : LicenseState.Blocked;
        }

        return _decisionEngine.Evaluate(snapshot, now);
    }

    private static void PrintState(string step, LicenseState state)
    {
        Console.WriteLine($"{step}: {state}");
    }
}

internal enum LicenseState
{
    Allowed,
    Degraded,
    Blocked
}

internal sealed class LicenseDecisionEngine
{
    public LicenseState Evaluate(LicenseSnapshot snapshot, DateTimeOffset now)
    {
        if (now > snapshot.OfflineGraceUntil)
        {
            return LicenseState.Blocked;
        }

        if (now > snapshot.ExpiresAt)
        {
            return LicenseState.Degraded;
        }

        return LicenseState.Allowed;
    }

    public LicenseState FromRefreshFailure(LicenseSnapshot snapshot, string errorCode, bool transient, DateTimeOffset now)
    {
        if (transient)
        {
            return now <= snapshot.OfflineGraceUntil ? LicenseState.Degraded : LicenseState.Blocked;
        }

        return errorCode switch
        {
            "refresh_token_not_found" or "refresh_token_expired" or "activation_revoked" or "license_inactive" or "product_mismatch" or "app_mismatch" or "fingerprint_mismatch" => LicenseState.Blocked,
            _ => now <= snapshot.OfflineGraceUntil ? LicenseState.Degraded : LicenseState.Blocked
        };
    }
}

internal sealed class FileLicenseStore
{
    private readonly string _path;

    public FileLicenseStore(string path)
    {
        _path = path;
    }

    public async Task<LicenseSnapshot?> LoadAsync()
    {
        if (!File.Exists(_path))
        {
            return null;
        }

        var json = await File.ReadAllTextAsync(_path);
        return JsonSerializer.Deserialize<LicenseSnapshot>(json, JsonDefaults.Web);
    }

    public async Task SaveAsync(LicenseSnapshot snapshot)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        var json = JsonSerializer.Serialize(snapshot, JsonDefaults.Web);
        await File.WriteAllTextAsync(_path, json);
    }

    public Task ClearAsync()
    {
        if (File.Exists(_path))
        {
            File.Delete(_path);
        }

        return Task.CompletedTask;
    }
}

internal sealed record LicenseSnapshot(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset ExpiresAt,
    DateTimeOffset OfflineGraceUntil,
    int PolicyVersion,
    string ProductCode,
    string AppId,
    string InstallationId,
    string MachineFingerprint,
    string LicenseId,
    string LicenseStatus)
{
    public static LicenseSnapshot FromActivation(ActivateResponse response, string machineFingerprint)
    {
        return new LicenseSnapshot(
            response.AccessToken,
            response.RefreshToken,
            response.ExpiresAt,
            response.OfflineGraceUntil,
            response.PolicyVersion,
            response.License.ProductCode,
            response.License.AppId,
            response.License.InstallationId,
            machineFingerprint,
            response.License.LicenseId,
            response.License.LicenseStatus);
    }

    public LicenseSnapshot WithRefresh(RefreshResponse response)
    {
        return this with
        {
            AccessToken = response.AccessToken,
            RefreshToken = response.RefreshToken,
            ExpiresAt = response.ExpiresAt,
            OfflineGraceUntil = response.OfflineGraceUntil,
            PolicyVersion = response.PolicyVersion,
            LicenseStatus = response.LicenseStatus
        };
    }

    public LicenseSnapshot WithExpiredGrace() => this with { OfflineGraceUntil = DateTimeOffset.UtcNow.AddSeconds(-1) };
}

internal sealed class JwtLicenseValidator
{
    private readonly string _publicKeyPath;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly string _productCode;
    private readonly string _appId;
    private readonly TimeSpan _clockSkew;

    public JwtLicenseValidator(string publicKeyPath, string issuer, string audience, string productCode, string appId, TimeSpan clockSkew)
    {
        _publicKeyPath = publicKeyPath;
        _issuer = issuer;
        _audience = audience;
        _productCode = productCode;
        _appId = appId;
        _clockSkew = clockSkew;
    }

    public JwtValidationResult Validate(string token, string installationId)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(File.ReadAllText(_publicKeyPath));

        var handler = new JwtSecurityTokenHandler();
        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = _issuer,
            ValidateAudience = true,
            ValidAudience = _audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new RsaSecurityKey(rsa),
            ValidateLifetime = true,
            ClockSkew = _clockSkew
        };

        var principal = handler.ValidateToken(token, parameters, out var validatedToken);
        var jwt = (JwtSecurityToken)validatedToken;

        var productCode = principal.FindFirst("product_code")?.Value ?? string.Empty;
        var appId = principal.FindFirst("app_id")?.Value ?? string.Empty;
        var installation = principal.FindFirst("installation_id")?.Value ?? string.Empty;
        var policyVersion = principal.FindFirst("policy_version")?.Value ?? string.Empty;

        if (!string.Equals(productCode, _productCode, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(appId, _appId, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(installation, installationId, StringComparison.OrdinalIgnoreCase))
        {
            return JwtValidationResult.Invalid("Context claims do not match the local app state.");
        }

        if (!int.TryParse(policyVersion, out var version) || version < 1)
        {
            return JwtValidationResult.Invalid("Policy version is not supported.");
        }

        if (jwt.Header.Kid is null)
        {
            return JwtValidationResult.Invalid("kid is missing.");
        }

        return JwtValidationResult.Valid();
    }
}

internal sealed record JwtValidationResult(bool IsValid, string Reason)
{
    public static JwtValidationResult Valid() => new(true, string.Empty);
    public static JwtValidationResult Invalid(string reason) => new(false, reason);
}

internal interface IDesktopLicensingClient
{
    Task<ActivateResponse> ActivateAsync(ActivateRequest request);
    Task<RefreshResponse> RefreshAsync(RefreshRequest request);
}

internal sealed class DesktopLicensingClient : IDesktopLicensingClient
{
    private readonly HttpClient _httpClient;

    public DesktopLicensingClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<ActivateResponse> ActivateAsync(ActivateRequest request)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync("/api/licenses/activate", request);
            return await ReadResponseAsync<ActivateResponse>(response);
        }
        catch (HttpRequestException)
        {
            throw new LicenseClientException("network_error", isTransient: true);
        }
        catch (TaskCanceledException)
        {
            throw new LicenseClientException("request_timeout", isTransient: true);
        }
    }

    public async Task<RefreshResponse> RefreshAsync(RefreshRequest request)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync("/api/licenses/refresh", request);
            return await ReadResponseAsync<RefreshResponse>(response);
        }
        catch (HttpRequestException)
        {
            throw new LicenseClientException("network_error", isTransient: true);
        }
        catch (TaskCanceledException)
        {
            throw new LicenseClientException("request_timeout", isTransient: true);
        }
    }

    private static async Task<T> ReadResponseAsync<T>(HttpResponseMessage response)
    {
        if (response.IsSuccessStatusCode)
        {
            return (await response.Content.ReadFromJsonAsync<T>(JsonDefaults.Web))!;
        }

        var payload = await TryReadProblemAsync(response);
        var errorCode = payload?.ErrorCode ?? response.StatusCode.ToString();
        throw new LicenseClientException(errorCode, response.IsTransientStatusCode());
    }

    private static async Task<ProblemResponse?> TryReadProblemAsync(HttpResponseMessage response)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<ProblemResponse>(JsonDefaults.Web);
        }
        catch
        {
            return null;
        }
    }
}

internal sealed class DemoLicensingServer
{
    public DemoLicensingClient Client { get; }
    public string PublicKeyPath { get; }

    private DemoLicensingServer(DemoLicensingClient client, string publicKeyPath)
    {
        Client = client;
        PublicKeyPath = publicKeyPath;
    }

    public static DemoLicensingServer Create(SampleOptions options)
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "lh-licensing-client-sample", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);

        using var rsa = RSA.Create(2048);
        var privateKeyPath = Path.Combine(tempDir, "private.pem");
        var publicKeyPath = Path.Combine(tempDir, "public.pem");
        File.WriteAllText(privateKeyPath, ExportPrivateKeyPem(rsa));
        File.WriteAllText(publicKeyPath, ExportPublicKeyPem(rsa));

        var client = new DemoLicensingClient(options, privateKeyPath);

        return new DemoLicensingServer(client, publicKeyPath);
    }

    private static string ExportPrivateKeyPem(RSA rsa)
    {
        var builder = new StringBuilder();
        builder.AppendLine("-----BEGIN RSA PRIVATE KEY-----");
        builder.AppendLine(Convert.ToBase64String(rsa.ExportRSAPrivateKey(), Base64FormattingOptions.InsertLineBreaks));
        builder.AppendLine("-----END RSA PRIVATE KEY-----");
        return builder.ToString();
    }

    private static string ExportPublicKeyPem(RSA rsa)
    {
        var builder = new StringBuilder();
        builder.AppendLine("-----BEGIN RSA PUBLIC KEY-----");
        builder.AppendLine(Convert.ToBase64String(rsa.ExportRSAPublicKey(), Base64FormattingOptions.InsertLineBreaks));
        builder.AppendLine("-----END RSA PUBLIC KEY-----");
        return builder.ToString();
    }
}

internal sealed class DemoLicensingClient : IDesktopLicensingClient
{
    private readonly SampleOptions _options;
    private readonly string _privateKeyPath;
    private readonly JwtSecurityTokenHandler _handler = new();
    private string? _currentRefreshToken;
    private bool _transientFailureNextRefresh;
    private bool _revokeNextRefresh;
    private int _refreshCount;

    public DemoLicensingClient(SampleOptions options, string privateKeyPath)
    {
        _options = options;
        _privateKeyPath = privateKeyPath;
    }

    public void ArmTransientRefreshFailureOnce() => _transientFailureNextRefresh = true;

    public void ArmRevocationOnNextRefresh() => _revokeNextRefresh = true;

    public Task<ActivateResponse> ActivateAsync(ActivateRequest request)
    {
        using var rsa = RSA.Create();
        rsa.ImportFromPem(File.ReadAllText(_privateKeyPath));
        var signingKey = new RsaSecurityKey(rsa) { KeyId = "demo-key-1" };

        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.AddMinutes(30);
        var offlineGraceUntil = now.AddHours(12);
        var activationId = Guid.NewGuid().ToString("N");
        var licenseId = Guid.NewGuid().ToString("N");
        var customerId = Guid.NewGuid().ToString("N");
        var productId = Guid.NewGuid().ToString("N");
        var installationId = ComputeInstallationId(request.MachineFingerprint);
        var refreshToken = GenerateRefreshToken();
        _currentRefreshToken = refreshToken;
        _refreshCount = 0;

        var token = CreateToken(signingKey, activationId, licenseId, customerId, productId, installationId, request.ProductCode, request.AppId, 1, offlineGraceUntil, "active", now, expiresAt);

        return Task.FromResult(new ActivateResponse(
            token,
            refreshToken,
            expiresAt,
            offlineGraceUntil,
            1,
            new LicenseEntitlements(2, 7, new[] { "basic", "standard" }),
            new LicenseSummary(licenseId, customerId, productId, installationId, request.ProductCode, "STANDARD", "Active", request.AppId)));
    }

    public Task<RefreshResponse> RefreshAsync(RefreshRequest request)
    {
        if (_transientFailureNextRefresh)
        {
            _transientFailureNextRefresh = false;
            throw new LicenseClientException("network_timeout", isTransient: true);
        }

        if (_revokeNextRefresh)
        {
            _revokeNextRefresh = false;
            throw new LicenseClientException("activation_revoked", isTransient: false);
        }

        if (!string.Equals(_currentRefreshToken, request.RefreshToken, StringComparison.Ordinal))
        {
            throw new LicenseClientException("refresh_token_not_found", isTransient: false);
        }

        using var rsa = RSA.Create();
        rsa.ImportFromPem(File.ReadAllText(_privateKeyPath));
        var signingKey = new RsaSecurityKey(rsa) { KeyId = "demo-key-1" };

        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.AddMinutes(30);
        var offlineGraceUntil = now.AddHours(12);
        var newRefreshToken = GenerateRefreshToken();
        _currentRefreshToken = newRefreshToken;
        _refreshCount++;

        var token = CreateToken(signingKey, Guid.NewGuid().ToString("N"), Guid.NewGuid().ToString("N"), Guid.NewGuid().ToString("N"), Guid.NewGuid().ToString("N"), ComputeInstallationId(request.MachineFingerprint), request.ProductCode, request.AppId, 1, offlineGraceUntil, "active", now, expiresAt);

        return Task.FromResult(new RefreshResponse(
            token,
            newRefreshToken,
            expiresAt,
            offlineGraceUntil,
            1,
            "Active"));
    }

    private string CreateToken(RsaSecurityKey signingKey, string activationId, string licenseId, string customerId, string productId, string installationId, string productCode, string appId, int policyVersion, DateTimeOffset offlineGraceUntil, string licenseStatus, DateTimeOffset now, DateTimeOffset expiresAt)
    {
        var claims = new List<System.Security.Claims.Claim>
        {
            new(JwtRegisteredClaimNames.Sub, activationId),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new(JwtRegisteredClaimNames.Iat, EpochTime.GetIntDate(now.UtcDateTime).ToString(), ClaimValueTypes.Integer64),
            new(JwtRegisteredClaimNames.Nbf, EpochTime.GetIntDate(now.UtcDateTime).ToString(), ClaimValueTypes.Integer64),
            new(JwtRegisteredClaimNames.Exp, EpochTime.GetIntDate(expiresAt.UtcDateTime).ToString(), ClaimValueTypes.Integer64),
            new("license_id", licenseId),
            new("customer_id", customerId),
            new("product_id", productId),
            new("product_code", productCode),
            new("app_id", appId),
            new("installation_id", installationId),
            new("plan_code", "STANDARD"),
            new("policy_version", policyVersion.ToString()),
            new("offline_grace_until", EpochTime.GetIntDate(offlineGraceUntil.UtcDateTime).ToString(), ClaimValueTypes.Integer64),
            new("license_status", licenseStatus),
            new("entitlements", JsonSerializer.Serialize(new LicenseEntitlements(2, 7, new[] { "basic", "standard" })), JsonClaimValueTypes.Json)
        };

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: expiresAt.UtcDateTime,
            signingCredentials: new SigningCredentials(signingKey, SecurityAlgorithms.RsaSha256));

        token.Header["kid"] = signingKey.KeyId;
        return _handler.WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(24);
        return Base64UrlEncoder.Encode(bytes);
    }

    private static string ComputeInstallationId(string machineFingerprint)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(machineFingerprint.Trim()));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

internal sealed class LicenseClientException : Exception
{
    public LicenseClientException(string errorCode, bool isTransient)
        : base(errorCode)
    {
        ErrorCode = errorCode;
        IsTransient = isTransient;
    }

    public string ErrorCode { get; }

    public bool IsTransient { get; }
}

internal static class HttpStatusCodeExtensions
{
    public static bool IsTransientStatusCode(this HttpResponseMessage response)
    {
        var code = (int)response.StatusCode;
        return code >= 500 || response.StatusCode == HttpStatusCode.RequestTimeout;
    }
}

internal sealed record ActivateRequest(
    string LicenseKey,
    string ProductCode,
    string AppId,
    string MachineFingerprint,
    string? DeviceName,
    string ClientVersion);

internal sealed record RefreshRequest(
    string RefreshToken,
    string ProductCode,
    string AppId,
    string MachineFingerprint,
    string ClientVersion);

internal sealed record LicenseEntitlements(
    int MaxActivations,
    int OfflineGraceDays,
    IReadOnlyCollection<string> Features);

internal sealed record LicenseSummary(
    string LicenseId,
    string CustomerId,
    string ProductId,
    string InstallationId,
    string ProductCode,
    string PlanCode,
    string LicenseStatus,
    string AppId);

internal sealed record ActivateResponse(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset ExpiresAt,
    DateTimeOffset OfflineGraceUntil,
    int PolicyVersion,
    LicenseEntitlements Entitlements,
    LicenseSummary License);

internal sealed record RefreshResponse(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset ExpiresAt,
    DateTimeOffset OfflineGraceUntil,
    int PolicyVersion,
    string LicenseStatus);

internal sealed record ProblemResponse([property: JsonPropertyName("errorCode")] string? ErrorCode);

internal sealed record SampleOptions
{
    public string BaseUrl { get; init; } = string.Empty;
    public bool UseDemoServer { get; init; } = true;
    public string StateFilePath { get; init; } = Path.Combine(Path.GetTempPath(), "lh-licensing-client-sample", "license-state.json");
    public string LicenseKey { get; init; } = "LH-DEMO-0001";
    public string ProductCode { get; init; } = "LH.DESKTOP.SAMPLE";
    public string AppId { get; init; } = "lh.labels.gs1.desktop";
    public string MachineFingerprint { get; init; } = "demo-fingerprint-001";
    public string? DeviceName { get; init; } = Environment.MachineName;
    public string ClientVersion { get; init; } = "1.0.0";
    public string Issuer { get; init; } = "https://tests.loadinghappiness.local";
    public string Audience { get; init; } = "lh-licensing-api";
    public string? PublicKeyPemPath { get; init; }
    public TimeSpan ClockSkew { get; init; } = TimeSpan.FromMinutes(2);
    public TimeSpan OfflineGraceBuffer { get; init; } = TimeSpan.FromSeconds(0);
    public bool SimulateTransientRefreshFailure { get; init; } = true;
    public bool SimulateRevocationOnRefresh { get; init; } = true;
    public bool SimulateOfflineGraceExpiry { get; init; } = true;

    public static SampleOptions Load(string[] args)
    {
        var options = new SampleOptions();

        var parsed = args.ToDictionary(
            arg => arg.Split('=')[0].TrimStart('-'),
            arg => arg.Contains('=') ? arg.Split('=')[1] : "true",
            StringComparer.OrdinalIgnoreCase);

        if (parsed.TryGetValue("real", out var realValue) && bool.TryParse(realValue, out var real))
        {
            options = options with { UseDemoServer = !real };
        }

        if (parsed.TryGetValue("baseUrl", out var baseUrl))
        {
            options = options with { BaseUrl = baseUrl, UseDemoServer = false };
        }

        if (parsed.TryGetValue("publicKey", out var publicKey))
        {
            options = options with { PublicKeyPemPath = publicKey };
        }

        if (parsed.TryGetValue("stateFile", out var stateFile))
        {
            options = options with { StateFilePath = stateFile };
        }

        if (parsed.TryGetValue("simulateTransient", out var transient) && bool.TryParse(transient, out var transientEnabled))
        {
            options = options with { SimulateTransientRefreshFailure = transientEnabled };
        }

        if (parsed.TryGetValue("simulateRevocation", out var revocation) && bool.TryParse(revocation, out var revocationEnabled))
        {
            options = options with { SimulateRevocationOnRefresh = revocationEnabled };
        }

        if (parsed.TryGetValue("simulateOfflineExpiry", out var offlineExpiry) && bool.TryParse(offlineExpiry, out var offlineExpiryEnabled))
        {
            options = options with { SimulateOfflineGraceExpiry = offlineExpiryEnabled };
        }

        return options;
    }
}
