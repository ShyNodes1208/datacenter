using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Datacenter.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCablePurpose : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Purpose",
                table: "Cables",
                type: "TEXT",
                nullable: false,
                defaultValue: "正常");

            migrationBuilder.Sql(@"
    UPDATE ""Cables"" SET ""Purpose"" = '存储'
    WHERE UPPER(""CableType"") = 'DAC' AND ""Purpose"" = '正常';

    UPDATE ""Cables"" SET ""Purpose"" = '上联'
    WHERE ""SourcePortId"" IN (
        SELECT ""Id"" FROM ""Ports"" WHERE ""ServerId"" IN (
            SELECT ""Id"" FROM ""Servers"" WHERE ""DeviceType"" LIKE '%交换%'
               OR ""DeviceType"" LIKE '%switch%'
               OR ""DeviceType"" LIKE '%路由%'
               OR ""DeviceType"" LIKE '%router%'
               OR ""DeviceType"" LIKE '%网络%'
               OR ""DeviceType"" LIKE '%network%'
        )
    )
      AND ""TargetPortId"" IN (
        SELECT ""Id"" FROM ""Ports"" WHERE ""ServerId"" IN (
            SELECT ""Id"" FROM ""Servers"" WHERE ""DeviceType"" LIKE '%交换%'
               OR ""DeviceType"" LIKE '%switch%'
               OR ""DeviceType"" LIKE '%路由%'
               OR ""DeviceType"" LIKE '%router%'
               OR ""DeviceType"" LIKE '%网络%'
               OR ""DeviceType"" LIKE '%network%'
        )
    )
      AND ""Purpose"" = '正常';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Purpose",
                table: "Cables");
        }
    }
}
