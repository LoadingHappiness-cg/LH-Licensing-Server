using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LH.Licensing.Server.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDemoLicenseSeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Customers",
                columns: new[] { "Id", "Code", "CreatedAt", "Name", "Status", "UpdatedAt" },
                values: new object[] { new Guid("33333333-3333-3333-3333-333333333331"), "DEMO", new DateTimeOffset(new DateTime(2026, 4, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), "LH Demo Customer", 1, null });

            migrationBuilder.InsertData(
                table: "Licenses",
                columns: new[] { "Id", "CreatedAt", "CustomerId", "EndsAt", "LicenseKey", "LicensePlanId", "PolicyVersion", "ProductId", "RevocationReason", "RevokedAt", "StartsAt", "Status", "UpdatedAt" },
                values: new object[] { new Guid("44444444-4444-4444-4444-444444444441"), new DateTimeOffset(new DateTime(2026, 4, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), new Guid("33333333-3333-3333-3333-333333333331"), null, "LH-DEMO-0001", new Guid("22222222-2222-2222-2222-222222222222"), 1, new Guid("11111111-1111-1111-1111-111111111111"), null, null, new DateTimeOffset(new DateTime(2026, 4, 10, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), 1, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Licenses",
                keyColumn: "Id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444441"));

            migrationBuilder.DeleteData(
                table: "Customers",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333331"));
        }
    }
}
