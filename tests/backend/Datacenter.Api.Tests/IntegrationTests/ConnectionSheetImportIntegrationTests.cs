using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ClosedXML.Excel;
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Datacenter.Api.Tests.IntegrationTests;

[Collection(AuthCollection.Name)]
public sealed class ConnectionSheetImportIntegrationTests(AuthTestFixture fixture)
{
  private static readonly string[] Headers =
  [
    "序号", "品牌", "设备类型", "型号", "序列号", "本端端口", "机房", "机柜", "U位",
    "对端交换机", "对端交换机接口", "对端机柜", "对端机柜U位", "接口类型", "线缆类型",
    "带外管理IP", "备注"
  ];

  [Fact]
  public async Task Preview_returns_plan_for_sample_rows()
  {
    using var client = fixture.CreateClient();
    await LoginAsRoleAsync(client, Roles.RoomAdministrator);
    using var workbook = CreateSampleWorkbook();

    using var response = await PostPreviewAsync(client, workbook);

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
    var root = document.RootElement;
    Assert.Equal(7, root.GetProperty("totalRows").GetInt32());
    Assert.Equal(7, root.GetProperty("cablesToCreate").GetInt32());
    Assert.True(root.GetProperty("racksToCreate").GetInt32() >= 0);
    Assert.True(root.GetProperty("devicesToCreate").GetInt32() >= 0);
  }

  [Fact]
  public async Task Import_creates_room_racks_devices_and_cables()
  {
    await ClearInfrastructureAsync();
    using var client = fixture.CreateClient();
    await LoginAsRoleAsync(client, Roles.RoomAdministrator);
    using var workbook = CreateSampleWorkbook();

    using var response = await PostImportAsync(client, workbook);
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    await using var scope = fixture.Factory.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    Assert.Equal(1, await db.Rooms.CountAsync(r => r.Name == "B213"));
    Assert.Equal(7, await db.Racks.CountAsync());
    Assert.Equal(8, await db.Servers.CountAsync());
    Assert.Equal(7, await db.Cables.CountAsync());
    Assert.Equal(8, await db.ServerPositions.CountAsync(p => p.Status == "在架"));
  }

  private static XLWorkbook CreateSampleWorkbook()
  {
    var workbook = new XLWorkbook();
    var ws = workbook.AddWorksheet("整理后");
    for (var i = 0; i < Headers.Length; i++)
      ws.Cell(1, i + 1).Value = Headers[i];

    var rows = new object?[][]
    {
      ["35", "联想", "X86", "WA7780G3", "JE000123", "BMC", "B213", "M13-12-13", "2-8U", "HW_S5731_M13_12_03&04-39U", "Gi1/0/40", "M13-12-04", "39U", "电口", "OM3", "10.4.122.180", "15米"],
      ["36", "联想", "X86", "WA7780G3", "JE000123", "P1-1", "B213", "M13-12-13", "2-8U", "HW_CE6881_M13-12-05_37U", "10GE1/0/39", "M13-12-05", "37U", "光口", "OM3", "2,032", "10米"],
      ["37", "联想", "X86", "WA7780G3", "JE000123", "P2-1", "B213", "M13-12-13", "2-8U", "HW_CE6881_M13-12-06_37U", "10GE1/0/39", "M13-12-06", "37U", "光口", "OM3", "2,032", "10米"],
      ["30", "联想", "x86", "SR650", "J301HRFH", "P1-1", "B213", "M13-11_13", "20_21U", "HW_CE6881_07-M13_11_11_39U", "10GE1/0/45", "M13-11-11", "39U", "光口", "OM3", "2、2002", "10米"],
      ["31", "联想", "x86", "SR650", "J301HRFH", "P2-1", "B213", "M13-11_13", "20_21U", "HW_CE6881_08-M13_11_12_39U", "10GE1/0/45", "M13-11-12", "39U", "光口", "OM3", "2、2002", "10米"],
      ["33", "联想", "x86", "SR650", "J301HRFH", "P1-1", "B213", "M13-11_13", "18-19U", "HW_CE6881_07-M13_11_11_39U", "10GE1/0/46", "M13-11-11", "39U", "光口", "OM3", "2、2002", "10米"],
      ["34", "联想", "x86", "SR650", "J301HRFH", "P2-1", "B213", "M13-11_13", "18-19U", "HW_CE6881_08-M13_11_12_39U", "10GE1/0/46", "M13-11-12", "39U", "光口", "OM3", "2、2002", "10米"],
    };

    for (var row = 0; row < rows.Length; row++)
    {
      for (var col = 0; col < rows[row].Length; col++)
        ws.Cell(row + 2, col + 1).Value = rows[row][col]?.ToString() ?? string.Empty;
    }

    return workbook;
  }

  private static async Task<HttpResponseMessage> PostPreviewAsync(HttpClient client, XLWorkbook workbook)
  {
    using var stream = new MemoryStream();
    workbook.SaveAs(stream);
    stream.Position = 0;
  using var csrf = await client.GetAsync("/api/auth/csrf");
    var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
    using var content = new MultipartFormDataContent();
    var fileContent = new StreamContent(stream);
    fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    content.Add(fileContent, "file", "connection-sheet.xlsx");
    using var request = new HttpRequestMessage(HttpMethod.Post, "/api/import/connection-sheet/preview")
    {
      Content = content
    };
    request.Headers.Add("X-XSRF-TOKEN", token);
    return await client.SendAsync(request);
  }

  private static async Task<HttpResponseMessage> PostImportAsync(HttpClient client, XLWorkbook workbook)
  {
    using var stream = new MemoryStream();
    workbook.SaveAs(stream);
    stream.Position = 0;
    using var csrf = await client.GetAsync("/api/auth/csrf");
    var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
    using var content = new MultipartFormDataContent();
    var fileContent = new StreamContent(stream);
    fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    content.Add(fileContent, "file", "connection-sheet.xlsx");
    using var request = new HttpRequestMessage(HttpMethod.Post, "/api/import/connection-sheet")
    {
      Content = content
    };
    request.Headers.Add("X-XSRF-TOKEN", token);
    return await client.SendAsync(request);
  }

  private async Task ClearInfrastructureAsync()
  {
    await using var scope = fixture.Factory.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Cables.RemoveRange(db.Cables);
    db.Ports.RemoveRange(db.Ports);
    db.AuditRecords.RemoveRange(db.AuditRecords);
    db.ServerPositions.RemoveRange(db.ServerPositions);
    db.Servers.RemoveRange(db.Servers);
    db.DevicePositions.RemoveRange(db.DevicePositions);
    db.Racks.RemoveRange(db.Racks);
    db.Rooms.RemoveRange(db.Rooms);
    await db.SaveChangesAsync();
  }

  private async Task LoginAsRoleAsync(HttpClient client, string role)
  {
    var username = $"conn-{Guid.NewGuid():N}";
    const string password = "conn-test-password";
    await using (var scope = fixture.Factory.Services.CreateAsyncScope())
    {
      var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
      var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
      var user = new User { Username = username, Role = role, Enabled = true };
      user.PasswordHash = hasher.HashPassword(user, password);
      dbContext.Users.Add(user);
      await dbContext.SaveChangesAsync();
    }

    using var csrf = await client.GetAsync("/api/auth/csrf");
    var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
    using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
    {
      Content = new StringContent(
        JsonSerializer.Serialize(new { username, password }),
        System.Text.Encoding.UTF8,
        "application/json")
    };
    request.Headers.Add("X-XSRF-TOKEN", token);
    using var response = await client.SendAsync(request);
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
  }
}
