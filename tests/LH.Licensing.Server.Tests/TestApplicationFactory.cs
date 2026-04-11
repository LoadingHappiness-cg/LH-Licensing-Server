using LH.Licensing.Server.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using System.Security.Cryptography;
using System.Text;

namespace LH.Licensing.Server.Tests;

public sealed class TestApplicationFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection;
    private readonly string _tempDirectory;
    private readonly string _privateKeyPath;
    private readonly string _publicKeyPath;
    private readonly string _adminApiKey;
    public string Issuer { get; } = "https://tests.loadinghappiness.local";
    public string Audience { get; } = "lh-licensing-api";
    public string AdminApiKey => _adminApiKey;

    public TestApplicationFactory()
    {
        _tempDirectory = Path.Combine(Path.GetTempPath(), "lh-licensing-server-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempDirectory);
        _adminApiKey = "test-admin-api-key";

        using var rsa = RSA.Create(2048);
        _privateKeyPath = Path.Combine(_tempDirectory, "private.pem");
        _publicKeyPath = Path.Combine(_tempDirectory, "public.pem");
        File.WriteAllText(_privateKeyPath, ExportPrivateKeyPem(rsa));
        File.WriteAllText(_publicKeyPath, ExportPublicKeyPem(rsa));

        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
    }

    public string PrivateKeyPath => _privateKeyPath;

    public string PublicKeyPath => _publicKeyPath;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Database"] = "DataSource=:memory:",
                ["Jwt:Issuer"] = Issuer,
                ["Jwt:Audience"] = Audience,
                ["Jwt:PrivateKeyPemPath"] = _privateKeyPath,
                ["Jwt:PublicKeyPemPath"] = _publicKeyPath,
                ["Jwt:KeyId"] = "test-key-1",
                ["Admin:ApiKey"] = _adminApiKey,
                ["Admin:ActorId"] = "test-admin@loadinghappiness.local"
            });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll(typeof(DbContextOptions<AppDbContext>));
            services.RemoveAll(typeof(AppDbContext));
            services.RemoveAll(typeof(SqliteConnection));

            services.AddSingleton(_connection);
            services.AddDbContext<AppDbContext>(options => options.UseSqlite(_connection));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);

        if (disposing)
        {
            _connection.Dispose();
            if (Directory.Exists(_tempDirectory))
            {
                Directory.Delete(_tempDirectory, recursive: true);
            }
        }
    }

    public async Task InitializeDatabaseAsync()
    {
        using var scope = Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.EnsureCreatedAsync();
    }

    public async Task ResetDatabaseAsync()
    {
        using var scope = Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.EnsureCreatedAsync();
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
