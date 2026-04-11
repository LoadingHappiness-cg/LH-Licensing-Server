using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace LH.Licensing.Server.Infrastructure.Persistence;

public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        var connectionString = "Host=localhost;Port=5432;Database=lh_licensing_server;Username=postgres;Password=postgres";

        optionsBuilder.UseNpgsql(connectionString, npgsql =>
        {
            npgsql.MigrationsAssembly(typeof(DesignTimeDbContextFactory).Assembly.FullName);
        });

        return new AppDbContext(optionsBuilder.Options);
    }
}
