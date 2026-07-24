using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datacenter.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditRecords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ServerId = table.Column<Guid>(type: "TEXT", nullable: false),
                    OperationType = table.Column<string>(type: "TEXT", nullable: false),
                    FromPosition = table.Column<string>(type: "TEXT", nullable: true),
                    ToPosition = table.Column<string>(type: "TEXT", nullable: true),
                    OperatorUsername = table.Column<string>(type: "TEXT", nullable: false),
                    OperatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditRecords_Servers_ServerId",
                        column: x => x.ServerId,
                        principalTable: "Servers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_ServerId",
                table: "AuditRecords",
                column: "ServerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditRecords");
        }
    }
}
