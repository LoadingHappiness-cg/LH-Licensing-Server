using LH.Licensing.Server.Infrastructure;
using LH.Licensing.Server.Infrastructure.Health;
using LH.Licensing.Server.Infrastructure.Options;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Net;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, loggerConfiguration) =>
{
    loggerConfiguration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext();
});

builder.Services.AddLicensingInfrastructure(builder.Configuration);
builder.Services.PostConfigure<ForwardedHeadersOptions>(options =>
{
    var proxyOptions = builder.Configuration.GetSection(ProxyOptions.SectionName).Get<ProxyOptions>() ?? new ProxyOptions();

    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto |
        ForwardedHeaders.XForwardedHost;

    options.ForwardLimit = proxyOptions.ForwardLimit > 0 ? proxyOptions.ForwardLimit : 1;
    options.RequireHeaderSymmetry = proxyOptions.RequireHeaderSymmetry;
    options.KnownProxies.Clear();

    foreach (var knownProxy in proxyOptions.KnownProxies)
    {
        if (IPAddress.TryParse(knownProxy, out var parsedProxy))
        {
            options.KnownProxies.Add(parsedProxy);
        }
    }
});
builder.Services.AddControllers();

builder.Services
    .AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: new[] { "live" })
    .AddCheck<DatabaseHealthCheck>("database", tags: new[] { "ready" });

var app = builder.Build();

app.UseForwardedHeaders();
app.UseSerilogRequestLogging();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("live")
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready")
});

app.MapControllers();

app.Run();

public partial class Program;
