using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace LH.Licensing.Server.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventType = table.Column<int>(type: "integer", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: true),
                    LicenseId = table.Column<Guid>(type: "uuid", nullable: true),
                    InstallationId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ActorId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductCode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    DefaultPolicyVersion = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Installations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppId = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    MachineFingerprintHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    DeviceName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    OsInfo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    FirstSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Installations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Installations_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LicensePlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanCode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    EntitlementsJson = table.Column<string>(type: "jsonb", nullable: false),
                    OfflineGraceDays = table.Column<int>(type: "integer", nullable: false),
                    MaxActivations = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LicensePlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LicensePlans_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Licenses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    LicensePlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    LicenseKey = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    StartsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    PolicyVersion = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Licenses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Licenses_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Licenses_LicensePlans_LicensePlanId",
                        column: x => x.LicensePlanId,
                        principalTable: "LicensePlans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Licenses_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Activations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LicenseId = table.Column<Guid>(type: "uuid", nullable: false),
                    InstallationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ActivatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastRefreshedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    RevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TokenJti = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    RefreshTokenHash = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ClientVersion = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Activations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Activations_Installations_InstallationId",
                        column: x => x.InstallationId,
                        principalTable: "Installations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Activations_Licenses_LicenseId",
                        column: x => x.LicenseId,
                        principalTable: "Licenses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "Products",
                columns: new[] { "Id", "CreatedAt", "DefaultPolicyVersion", "Name", "ProductCode", "Status", "UpdatedAt" },
                values: new object[] { new Guid("11111111-1111-1111-1111-111111111111"), new DateTimeOffset(new DateTime(2026, 4, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), 1, "Sample Desktop Product", "LH.DESKTOP.SAMPLE", 1, null });

            migrationBuilder.InsertData(
                table: "LicensePlans",
                columns: new[] { "Id", "CreatedAt", "EntitlementsJson", "MaxActivations", "Name", "OfflineGraceDays", "PlanCode", "ProductId", "Status", "UpdatedAt" },
                values: new object[,]
                {
                    { new Guid("22222222-2222-2222-2222-222222222221"), new DateTimeOffset(new DateTime(2026, 4, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), "{\"max_activations\":1,\"offline_grace_days\":3,\"features\":[\"basic\"]}", 1, "Trial", 3, "TRIAL", new Guid("11111111-1111-1111-1111-111111111111"), 1, null },
                    { new Guid("22222222-2222-2222-2222-222222222222"), new DateTimeOffset(new DateTime(2026, 4, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), "{\"max_activations\":2,\"offline_grace_days\":7,\"features\":[\"basic\",\"standard\"]}", 2, "Standard", 7, "STANDARD", new Guid("11111111-1111-1111-1111-111111111111"), 1, null },
                    { new Guid("22222222-2222-2222-2222-222222222223"), new DateTimeOffset(new DateTime(2026, 4, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), "{\"max_activations\":5,\"offline_grace_days\":14,\"features\":[\"basic\",\"standard\",\"pro\"]}", 5, "Pro", 14, "PRO", new Guid("11111111-1111-1111-1111-111111111111"), 1, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Activations_InstallationId",
                table: "Activations",
                column: "InstallationId");

            migrationBuilder.CreateIndex(
                name: "IX_Activations_LicenseId",
                table: "Activations",
                column: "LicenseId");

            migrationBuilder.CreateIndex(
                name: "IX_Activations_TokenJti",
                table: "Activations",
                column: "TokenJti",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditEvents_CreatedAt",
                table: "AuditEvents",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_Code",
                table: "Customers",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Installations_ProductId_AppId_MachineFingerprintHash",
                table: "Installations",
                columns: new[] { "ProductId", "AppId", "MachineFingerprintHash" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LicensePlans_ProductId_PlanCode",
                table: "LicensePlans",
                columns: new[] { "ProductId", "PlanCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Licenses_CustomerId",
                table: "Licenses",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Licenses_LicenseKey",
                table: "Licenses",
                column: "LicenseKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Licenses_LicensePlanId",
                table: "Licenses",
                column: "LicensePlanId");

            migrationBuilder.CreateIndex(
                name: "IX_Licenses_ProductId",
                table: "Licenses",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_ProductCode",
                table: "Products",
                column: "ProductCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Activations");

            migrationBuilder.DropTable(
                name: "AuditEvents");

            migrationBuilder.DropTable(
                name: "Installations");

            migrationBuilder.DropTable(
                name: "Licenses");

            migrationBuilder.DropTable(
                name: "Customers");

            migrationBuilder.DropTable(
                name: "LicensePlans");

            migrationBuilder.DropTable(
                name: "Products");
        }
    }
}
