using LH.Licensing.Server.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace LH.Licensing.Server.Infrastructure.Health;

public sealed class DatabaseHealthCheck : IHealthCheck
{
    private readonly AppDbContext _dbContext;

    public DatabaseHealthCheck(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var canConnect = await _dbContext.Database.CanConnectAsync(cancellationToken);

        return canConnect
            ? HealthCheckResult.Healthy("Database connection available.")
            : HealthCheckResult.Unhealthy("Database connection unavailable.");
    }
}
