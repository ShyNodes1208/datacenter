using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ClosedXML.Excel;
using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Datacenter.Api.Tests.IntegrationTests;

[Collection(AuthCollection.Name)]
public sealed class DevicePositionIntegrationTests(AuthTestFixture fixture) : IAsyncLifetime
{
    private readonly HttpClient _client = fixture.CreateClient();
    private Rack _rack = null!;
    private Room _room = null!;

    public async Task InitializeAsync()
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        _room = new Room { Name = $"DP-TEST-{Guid.NewGuid():N}", Status = "启用" };
        db.Rooms.Add(_room);
        await db.SaveChangesAsync();

        _rack = new Rack
        {
            Code = $"RACK-DP-{Guid.NewGuid():N}",
            RoomId = _room.Id,
            HeightU = 42,
            X = 0, Y = 0, Z = 0
        };
        db.Racks.Add(_rack);
        await db.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.DevicePositions.RemoveRange(db.DevicePositions.Where(dp => dp.RackId == _rack.Id));
        db.Racks.Remove(_rack);
        db.Rooms.Remove(_room);
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetDevicePositions_Unauthenticated_Returns401()
    {
        var client = fixture.CreateClient(); // no auth cookie
        var response = await client.GetAsync($"/api/racks/{_rack.Id}/device-positions");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetDevicePositions_NonexistentRack_Returns404()
    {
        await LoginAsRoleAsync(_client, Roles.RoomAdministrator);
        var response = await _client.GetAsync($"/api/racks/{Guid.NewGuid()}/device-positions");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetDevicePositions_EmptyRack_ReturnsAllPositionsNull()
    {
        await LoginAsRoleAsync(_client, Roles.RoomAdministrator);

        var response = await _client.GetAsync($"/api/racks/{_rack.Id}/device-positions");
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"total\":42", body, StringComparison.Ordinal);
        Assert.Contains("\"occupied\":0", body, StringComparison.Ordinal);
        Assert.Contains("\"empty\":42", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ImportDevicePositions_RequiresCsrf()
    {
        await LoginAsRoleAsync(_client, Roles.RoomAdministrator);

        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("机柜1");
        worksheet.Cell(1, 1).Value = "42U";
        worksheet.Cell(1, 2).Value = "设备A";
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(stream.ToArray());
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        content.Add(fileContent, "file", "positions.xlsx");

        var response = await _client.PostAsync(
            $"/api/racks/{_rack.Id}/device-positions/import",
            content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("防伪令牌缺失或无效", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ImportDevicePositions_Success_AndVerifyGet()
    {
        await LoginAsRoleAsync(_client, Roles.RoomAdministrator);

        using var csrf = await _client.GetAsync("/api/auth/csrf");
        var csrfToken = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();

        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("设备落位");
        worksheet.Cell(1, 1).Value = $"机柜[{_rack.Code}]";
        worksheet.Cell(1, 2).Value = "";
        worksheet.Cell(1, 3).Value = "";
        worksheet.Cell(2, 1).Value = "42U";
        worksheet.Cell(2, 2).Value = "配线架";
        worksheet.Cell(2, 3).Value = "42U";
        worksheet.Cell(3, 1).Value = "41U";
        worksheet.Cell(3, 2).Value = "配线架";
        worksheet.Cell(3, 3).Value = "41U";
        worksheet.Cell(4, 1).Value = "40U";
        worksheet.Cell(4, 2).Value = "H3C5600 交换机";
        worksheet.Cell(4, 3).Value = "40U";
        worksheet.Cell(5, 1).Value = "39U";
        worksheet.Cell(5, 2).Value = "";
        worksheet.Cell(5, 3).Value = "39U";

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(stream.ToArray());
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        content.Add(fileContent, "file", "positions.xlsx");

        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"/api/racks/{_rack.Id}/device-positions/import")
        {
            Content = content
        };
        request.Headers.Add("X-XSRF-TOKEN", csrfToken);
        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"occupied\":3", body, StringComparison.Ordinal);
        Assert.Contains("\"empty\":39", body, StringComparison.Ordinal);

        // Verify GET returns the imported positions
        var getResponse = await _client.GetAsync($"/api/racks/{_rack.Id}/device-positions");
        getResponse.EnsureSuccessStatusCode();
        var getBody = await getResponse.Content.ReadAsStringAsync();
        Assert.Contains("\"uNumber\":42", getBody, StringComparison.Ordinal);
        Assert.Contains("\"label\":\"配线架\"", getBody, StringComparison.Ordinal);
        Assert.Contains("\"uNumber\":41", getBody, StringComparison.Ordinal);
        Assert.Contains("\"label\":\"配线架\"", getBody, StringComparison.Ordinal);
        Assert.Contains("\"uNumber\":40", getBody, StringComparison.Ordinal);
        Assert.Contains("H3C5600", getBody, StringComparison.Ordinal);
        Assert.Contains("\"uNumber\":39", getBody, StringComparison.Ordinal);
        Assert.Contains("\"label\":null", getBody, StringComparison.Ordinal);
        Assert.Contains("\"occupied\":3", getBody, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ImportPreviewDevicePositions_DoesNotWriteAndReturnsPositions()
    {
        await LoginAsRoleAsync(_client, Roles.RoomAdministrator);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.DevicePositions.Add(new DevicePosition
            {
                RackId = _rack.Id,
                UNumber = 10,
                UHeight = 1,
                Label = "已有设备"
            });
            await db.SaveChangesAsync();
        }

        using var csrf = await _client.GetAsync("/api/auth/csrf");
        var csrfToken = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();

        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("设备落位");
        worksheet.Cell(1, 1).Value = $"机柜[{_rack.Code}]";
        worksheet.Cell(1, 2).Value = "";
        worksheet.Cell(2, 1).Value = "42U";
        worksheet.Cell(2, 2).Value = "配线架";
        worksheet.Cell(3, 1).Value = "40U";
        worksheet.Cell(3, 2).Value = "交换机";

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(stream.ToArray());
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        content.Add(fileContent, "file", "positions.xlsx");

        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"/api/racks/{_rack.Id}/device-positions/import-preview")
        {
            Content = content
        };
        request.Headers.Add("X-XSRF-TOKEN", csrfToken);
        var response = await _client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"occupied\":2", body, StringComparison.Ordinal);
        Assert.Contains("配线架", body, StringComparison.Ordinal);
        Assert.Contains("交换机", body, StringComparison.Ordinal);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var existing = await db.DevicePositions
                .Where(dp => dp.RackId == _rack.Id)
                .ToListAsync();
            Assert.Single(existing);
            Assert.Equal("已有设备", existing[0].Label);
        }
    }

    [Fact]
    public async Task GetRacks_ByRoomId_ReturnsFilteredRacks()
    {
        await LoginAsRoleAsync(_client, Roles.ReadOnlyViewer);

        var response = await _client.GetAsync($"/api/racks?roomId={_room.Id}");
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains(_rack.Code, body, StringComparison.Ordinal);
        Assert.Contains("\"occupiedU\":0", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetRacks_ByRoomId_NonexistentRoom_ReturnsEmpty()
    {
        await LoginAsRoleAsync(_client, Roles.RoomAdministrator);

        var response = await _client.GetAsync($"/api/racks?roomId={Guid.NewGuid()}");
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("[]", body, StringComparison.Ordinal);
    }

    private async Task LoginAsRoleAsync(HttpClient client, string role)
    {
        var username = $"dp-{Guid.NewGuid():N}";
        const string password = "dp-test-password";
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
            Content = JsonContent.Create(new { username, password })
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
