using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LH.Licensing.Server.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddActivationRefreshAndAllowedApps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AllowedAppIdsJson",
                table: "Products",
                type: "jsonb",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "OfflineGraceUntil",
                table: "Activations",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RefreshTokenExpiresAt",
                table: "Activations",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.UpdateData(
                table: "Products",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"),
                column: "AllowedAppIdsJson",
                value: "[\"lh.labels.gs1.desktop\",\"lh.desktop.sample\"]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowedAppIdsJson",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "OfflineGraceUntil",
                table: "Activations");

            migrationBuilder.DropColumn(
                name: "RefreshTokenExpiresAt",
                table: "Activations");
        }
    }
}
