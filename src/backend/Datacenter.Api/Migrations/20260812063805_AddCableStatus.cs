using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datacenter.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCableStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Cables",
                type: "TEXT",
                nullable: false,
                defaultValue: "正常");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                table: "Cables");
        }
    }
}
