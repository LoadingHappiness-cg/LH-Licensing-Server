using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LH.Licensing.Server.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLicenseRevocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RevocationReason",
                table: "Licenses",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RevokedAt",
                table: "Licenses",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RevocationReason",
                table: "Licenses");

            migrationBuilder.DropColumn(
                name: "RevokedAt",
                table: "Licenses");
        }
    }
}
