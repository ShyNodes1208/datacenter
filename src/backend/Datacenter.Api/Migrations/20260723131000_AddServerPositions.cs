using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datacenter.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddServerPositions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ServerPositions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ServerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    RackId = table.Column<Guid>(type: "TEXT", nullable: false),
                    StartU = table.Column<int>(type: "INTEGER", nullable: false),
                    EndU = table.Column<int>(type: "INTEGER", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    InstalledAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServerPositions", x => x.Id);
                    table.CheckConstraint("CK_ServerPositions_StartU", "StartU >= 1");
                    table.CheckConstraint("CK_ServerPositions_Status", "Status IN ('在架', '已下架')");
                    table.ForeignKey(
                        name: "FK_ServerPositions_Racks_RackId",
                        column: x => x.RackId,
                        principalTable: "Racks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ServerPositions_Servers_ServerId",
                        column: x => x.ServerId,
                        principalTable: "Servers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServerPositions_RackId",
                table: "ServerPositions",
                column: "RackId");

            migrationBuilder.CreateIndex(
                name: "IX_ServerPositions_ServerId",
                table: "ServerPositions",
                column: "ServerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ServerPositions");
        }
    }
}
