using LH.Licensing.Server.Domain.Entities;
using LH.Licensing.Server.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace LH.Licensing.Server.Infrastructure.Persistence;

public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Customer> Customers => Set<Customer>();

    public DbSet<Product> Products => Set<Product>();

    public DbSet<LicensePlan> LicensePlans => Set<LicensePlan>();

    public DbSet<License> Licenses => Set<License>();

    public DbSet<Installation> Installations => Set<Installation>();

    public DbSet<Activation> Activations => Set<Activation>();

    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.ToTable("Customers");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).HasMaxLength(64).IsRequired();
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Status).HasConversion<int>().IsRequired();
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("Products");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ProductCode).HasMaxLength(64).IsRequired();
            entity.HasIndex(x => x.ProductCode).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Status).HasConversion<int>().IsRequired();
            entity.Property(x => x.DefaultPolicyVersion).IsRequired();
            entity.Property(x => x.AllowedAppIdsJson).HasColumnType("jsonb").IsRequired();
        });

        modelBuilder.Entity<LicensePlan>(entity =>
        {
            entity.ToTable("LicensePlans");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.PlanCode).HasMaxLength(64).IsRequired();
            entity.HasIndex(x => new { x.ProductId, x.PlanCode }).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Status).HasConversion<int>().IsRequired();
            entity.Property(x => x.EntitlementsJson).HasColumnType("jsonb").IsRequired();
            entity.Property(x => x.OfflineGraceDays).IsRequired();
            entity.Property(x => x.MaxActivations).IsRequired();
            entity.HasOne(x => x.Product)
                .WithMany(x => x.LicensePlans)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<License>(entity =>
        {
            entity.ToTable("Licenses");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.LicenseKey).HasMaxLength(128).IsRequired();
            entity.HasIndex(x => x.LicenseKey).IsUnique();
            entity.Property(x => x.Status).HasConversion<int>().IsRequired();
            entity.Property(x => x.PolicyVersion).IsRequired();
            entity.Property(x => x.StartsAt).IsRequired();
            entity.Property(x => x.EndsAt);
            entity.Property(x => x.RevokedAt);
            entity.Property(x => x.RevocationReason).HasMaxLength(500);
            entity.HasOne(x => x.Customer)
                .WithMany(x => x.Licenses)
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Product)
                .WithMany(x => x.Licenses)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.LicensePlan)
                .WithMany(x => x.Licenses)
                .HasForeignKey(x => x.LicensePlanId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Installation>(entity =>
        {
            entity.ToTable("Installations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.AppId).HasMaxLength(128).IsRequired();
            entity.Property(x => x.MachineFingerprintHash).HasMaxLength(128).IsRequired();
            entity.Property(x => x.DeviceName).HasMaxLength(200);
            entity.Property(x => x.OsInfo).HasMaxLength(200);
            entity.Property(x => x.Status).HasConversion<int>().IsRequired();
            entity.HasIndex(x => new { x.ProductId, x.AppId, x.MachineFingerprintHash }).IsUnique();
            entity.HasOne(x => x.Product)
                .WithMany(x => x.Installations)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Activation>(entity =>
        {
            entity.ToTable("Activations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Status).HasConversion<int>().IsRequired();
            entity.Property(x => x.TokenJti).HasMaxLength(64).IsRequired();
            entity.Property(x => x.RefreshTokenHash).HasMaxLength(200);
            entity.Property(x => x.ClientVersion).HasMaxLength(64).IsRequired();
            entity.Property(x => x.ActivatedAt).IsRequired();
            entity.Property(x => x.ExpiresAt).IsRequired();
            entity.Property(x => x.RefreshTokenExpiresAt).IsRequired();
            entity.Property(x => x.OfflineGraceUntil);
            entity.HasIndex(x => x.TokenJti).IsUnique();
            entity.HasOne(x => x.License)
                .WithMany(x => x.Activations)
                .HasForeignKey(x => x.LicenseId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Installation)
                .WithMany(x => x.Activations)
                .HasForeignKey(x => x.InstallationId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AuditEvent>(entity =>
        {
            entity.ToTable("AuditEvents");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.EventType).HasConversion<int>().IsRequired();
            entity.Property(x => x.ActorType).HasMaxLength(100).IsRequired();
            entity.Property(x => x.ActorId).HasMaxLength(100);
            entity.Property(x => x.PayloadJson).HasColumnType("jsonb").IsRequired();
            entity.HasIndex(x => x.CreatedAt);
        });

        var productId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var seedTimestamp = new DateTimeOffset(2026, 4, 11, 0, 0, 0, TimeSpan.Zero);

        modelBuilder.Entity<Product>().HasData(
            new Product
            {
                Id = productId,
                ProductCode = "LH.DESKTOP.SAMPLE",
                Name = "Sample Desktop Product",
                Status = ProductStatus.Active,
                DefaultPolicyVersion = 1,
                AllowedAppIdsJson = """
                ["lh.labels.gs1.desktop","lh.desktop.sample"]
                """,
                CreatedAt = seedTimestamp
            });

        modelBuilder.Entity<LicensePlan>().HasData(
            new LicensePlan
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222221"),
                ProductId = productId,
                PlanCode = "TRIAL",
                Name = "Trial",
                Status = LicensePlanStatus.Active,
                EntitlementsJson = """
                {"max_activations":1,"offline_grace_days":3,"features":["basic"]}
                """,
                OfflineGraceDays = 3,
                MaxActivations = 1,
                CreatedAt = seedTimestamp
            },
            new LicensePlan
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                ProductId = productId,
                PlanCode = "STANDARD",
                Name = "Standard",
                Status = LicensePlanStatus.Active,
                EntitlementsJson = """
                {"max_activations":2,"offline_grace_days":7,"features":["basic","standard"]}
                """,
                OfflineGraceDays = 7,
                MaxActivations = 2,
                CreatedAt = seedTimestamp
            },
            new LicensePlan
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222223"),
                ProductId = productId,
                PlanCode = "PRO",
                Name = "Pro",
                Status = LicensePlanStatus.Active,
                EntitlementsJson = """
                {"max_activations":5,"offline_grace_days":14,"features":["basic","standard","pro"]}
                """,
                OfflineGraceDays = 14,
                MaxActivations = 5,
                CreatedAt = seedTimestamp
            });
    }
}
