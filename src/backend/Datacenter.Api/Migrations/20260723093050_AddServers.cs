using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datacenter.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddServers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Servers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    ManagementIP = table.Column<string>(type: "TEXT", nullable: false),
                    AssetNumber = table.Column<string>(type: "TEXT", nullable: true),
                    DeviceType = table.Column<string>(type: "TEXT", nullable: false),
                    DeviceHeight = table.Column<int>(type: "INTEGER", nullable: false),
                    OperationalStatus = table.Column<string>(type: "TEXT", nullable: false),
                    PositionStatus = table.Column<string>(type: "TEXT", nullable: false),
                    System = table.Column<string>(type: "TEXT", nullable: true),
                    Owner = table.Column<string>(type: "TEXT", nullable: true),
                    Notes = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Servers", x => x.Id);
                    table.CheckConstraint("CK_Servers_DeviceHeight", "DeviceHeight >= 1");
                    table.CheckConstraint("CK_Servers_OperationalStatus", "OperationalStatus IN ('正常', '异常', '维护')");
                    table.CheckConstraint("CK_Servers_PositionStatus", "PositionStatus IN ('未上架', '在架', '已下架')");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Servers_ManagementIP",
                table: "Servers",
                column: "ManagementIP",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Servers_Name",
                table: "Servers",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Servers");
        }
    }
}
