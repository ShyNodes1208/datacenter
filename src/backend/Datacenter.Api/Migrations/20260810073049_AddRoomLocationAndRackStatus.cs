using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datacenter.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRoomLocationAndRackStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "Rooms",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Racks",
                type: "TEXT",
                nullable: false,
                defaultValue: "启用");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Location",
                table: "Rooms");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Racks");
        }
    }
}
