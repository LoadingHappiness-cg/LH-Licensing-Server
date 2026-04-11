using LH.Licensing.Server.Infrastructure.Health;
using LH.Licensing.Server.Infrastructure.Options;
using LH.Licensing.Server.Infrastructure.Persistence;
using LH.Licensing.Server.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace LH.Licensing.Server.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddLicensingInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Database")
            ?? "Host=localhost;Port=5432;Database=lh_licensing_server;Username=postgres;Password=postgres";

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.SectionName));
        services.Configure<AdminApiKeyOptions>(configuration.GetSection(AdminApiKeyOptions.SectionName));
        services.Configure<ProxyOptions>(configuration.GetSection(ProxyOptions.SectionName));

        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseNpgsql(connectionString, npgsql =>
            {
                npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
            });
        });

        services.AddAuthentication()
            .AddScheme<AuthenticationSchemeOptions, AdminApiKeyAuthenticationHandler>(AdminApiKeyAuthenticationDefaults.Scheme, _ => { });

        services.AddAuthorization(options =>
        {
            options.AddPolicy(AdminApiKeyAuthorizationDefaults.Policy, policy =>
            {
                policy.AddAuthenticationSchemes(AdminApiKeyAuthenticationDefaults.Scheme);
                policy.RequireAuthenticatedUser();
                policy.RequireAssertion(context =>
                    context.User.HasClaim(AdminApiKeyAuthenticationDefaults.ApiKeyValidClaimType, "true"));
            });
        });

        services.AddScoped<DatabaseHealthCheck>();
        services.AddSingleton<TimeProvider>(TimeProvider.System);
        services.AddSingleton<RsaJwtTokenService>();
        services.AddScoped<LH.Licensing.Server.Application.ILicenseFlowService, LicenseFlowService>();
        services.AddScoped<LH.Licensing.Server.Application.ILicenseAdminService, LicenseAdminService>();

        return services;
    }
}
