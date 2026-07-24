using System.Net;
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
public sealed class RackIntegrationTests(AuthTestFixture fixture)
{
    private static readonly string[] Headers =
        ["机柜编号", "所在机房", "高度(U)", "品牌", "额定功率", "备注", "X坐标", "Y坐标", "Z坐标"];

    [Fact]
    public async Task ValidExcelReturnsParsedPreview()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        await ReplaceDataAsync([room], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);
        var workbook = CreateWorkbook(Headers, [new object?[] { "R001", "主机房", 42, "华为", 5.5, "A区", 1, 2, 3 }]);

        using var response = await PostImportPreviewAsync(client, workbook, "racks.xlsx");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        Assert.Equal(1, document.RootElement.GetProperty("totalRows").GetInt32());
        Assert.Equal(1, document.RootElement.GetProperty("validRows").GetInt32());
        Assert.Equal(0, document.RootElement.GetProperty("errorRows").GetInt32());
        var row = document.RootElement.GetProperty("rows")[0];
        Assert.Equal("R001", row.GetProperty("code").GetString());
        Assert.Equal(room.Id, row.GetProperty("roomId").GetGuid());
        Assert.Equal(42, row.GetProperty("heightU").GetInt32());
    }

    [Fact]
    public async Task MissingRequiredValuesReturnRowErrors()
    {
        await ReplaceDataAsync([], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.Operations);
        var workbook = CreateWorkbook(Headers, [new object?[] { " ", " ", null, null, null, null, "bad", "bad", "bad" }]);

        using var response = await PostImportPreviewAsync(client, workbook, "racks.xlsx");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var errors = await ReadFirstRowErrorsAsync(response);
        Assert.Contains("机柜编号不能为空", errors);
        Assert.Contains("所在机房不能为空", errors);
        Assert.Contains("高度(U)不能为空", errors);
        Assert.Contains("X坐标必须为数字", errors);
        Assert.Contains("Y坐标必须为数字", errors);
        Assert.Contains("Z坐标必须为数字", errors);
    }

    [Fact]
    public async Task UnknownRoomReturnsRowError()
    {
        await ReplaceDataAsync([], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);
        var workbook = CreateWorkbook(Headers, [ValidRow("不存在机房")]);

        using var response = await PostImportPreviewAsync(client, workbook, "racks.xlsx");

        Assert.Contains("机房 '不存在机房' 不存在", await ReadFirstRowErrorsAsync(response));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData("1.5")]
    public async Task NonPositiveOrNonIntegerHeightReturnsRowError(object height)
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        await ReplaceDataAsync([room], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.DbaApplicationOperations);
        var workbook = CreateWorkbook(Headers, [new object?[] { "R001", room.Name, height, null, null, null, 1, 2, 3 }]);

        using var response = await PostImportPreviewAsync(client, workbook, "racks.xlsx");

        Assert.Contains("高度(U)必须为正整数", await ReadFirstRowErrorsAsync(response));
    }

    [Fact]
    public async Task DatabaseDuplicateReturnsExistingRackId()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        await ReplaceDataAsync([room], [rack]);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);
        var workbook = CreateWorkbook(Headers, [ValidRow(room.Name)]);

        using var response = await PostImportPreviewAsync(client, workbook, "racks.xlsx");

        using var document = await ReadDocumentAsync(response);
        var row = document.RootElement.GetProperty("rows")[0];
        Assert.True(row.GetProperty("duplicate").GetBoolean());
        Assert.Equal(rack.Id, row.GetProperty("existingRackId").GetGuid());
        Assert.Equal(1, document.RootElement.GetProperty("duplicateRows").GetInt32());
    }

    [Fact]
    public async Task DuplicateRowsInSameFileReturnErrors()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        await ReplaceDataAsync([room], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);
        var workbook = CreateWorkbook(Headers, [ValidRow(room.Name), ValidRow(room.Name)]);

        using var response = await PostImportPreviewAsync(client, workbook, "racks.xlsx");

        using var document = await ReadDocumentAsync(response);
        var rows = document.RootElement.GetProperty("rows").EnumerateArray().ToArray();
        Assert.All(rows, row => Assert.Contains(
            "同一文件内机柜编号重复",
            row.GetProperty("errors").EnumerateArray().Select(error => error.GetString())));
        Assert.Equal(2, document.RootElement.GetProperty("errorRows").GetInt32());
    }

    [Fact]
    public async Task ImportCreatePersistsRackAndReturnsCount()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        await ReplaceDataAsync([room], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostImportAsync(client, [ImportRow(2, "create", room.Id, "R001")]);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = await ReadDocumentAsync(response);
        Assert.Equal(1, document.RootElement.GetProperty("created").GetInt32());
        var rack = await FindRackAsync(room.Id, "R001");
        Assert.NotNull(rack);
        Assert.Equal(42, rack.HeightU);
        Assert.Equal("华为", rack.Brand);
        Assert.Equal(5.5, rack.Power);
    }

    [Fact]
    public async Task ImportSkipDoesNotPersistRackAndReturnsCount()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        await ReplaceDataAsync([room], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.Operations);

        using var response = await PostImportAsync(client, [ImportRow(2, "skip", room.Id, "R001")]);

        using var document = await ReadDocumentAsync(response);
        Assert.Equal(1, document.RootElement.GetProperty("skipped").GetInt32());
        Assert.Null(await FindRackAsync(room.Id, "R001"));
    }

    [Fact]
    public async Task ImportOverwriteUpdatesAllowedFieldsOnly()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        await ReplaceDataAsync([room], [rack]);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);
        var action = ImportRow(2, "overwrite", room.Id, rack.Code, rack.Id, heightU: 47);

        using var response = await PostImportAsync(client, [action]);

        using var document = await ReadDocumentAsync(response);
        Assert.Equal(1, document.RootElement.GetProperty("overwritten").GetInt32());
        var updated = await FindRackAsync(room.Id, rack.Code);
        Assert.NotNull(updated);
        Assert.Equal(rack.Id, updated.Id);
        Assert.Equal(room.Id, updated.RoomId);
        Assert.Equal("R001", updated.Code);
        Assert.Equal(47, updated.HeightU);
        Assert.Equal("华为", updated.Brand);
        Assert.Equal(5.5, updated.Power);
        Assert.Equal(1, updated.X);
        Assert.Equal(2, updated.Y);
        Assert.Equal(3, updated.Z);
    }

    [Fact]
    public async Task ImportRowFailureDoesNotRollbackAnotherValidRow()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        await ReplaceDataAsync([room], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);
        var invalid = ImportRow(2, "create", Guid.NewGuid(), "R001");
        var valid = ImportRow(3, "create", room.Id, "R002");

        using var response = await PostImportAsync(client, [invalid, valid]);

        using var document = await ReadDocumentAsync(response);
        Assert.Equal(1, document.RootElement.GetProperty("created").GetInt32());
        Assert.Equal(1, document.RootElement.GetProperty("failed").GetInt32());
        Assert.Equal(2, document.RootElement.GetProperty("errors")[0].GetProperty("row").GetInt32());
        Assert.NotNull(await FindRackAsync(room.Id, "R002"));
    }

    [Fact]
    public async Task EmptyImportRowsReturnBadRequest()
    {
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostImportAsync(client, []);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("导入行不能为空", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task AnonymousRequestsReturnUnauthorized()
    {
        using var client = fixture.CreateClient();
        using var previewResponse = await PostImportPreviewAsync(client, [], "racks.xlsx");
        using var importResponse = await client.PostAsJsonAsync("/api/racks/import", new { rows = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.Unauthorized, previewResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, importResponse.StatusCode);
    }

    [Fact]
    public async Task NonXlsxFileReturnsBadRequest()
    {
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PostImportPreviewAsync(client, [1, 2, 3], "racks.csv");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("仅支持 .xlsx 文件", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task MissingRequiredHeaderReturnsBadRequest()
    {
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);
        var workbook = CreateWorkbook(Headers[..^1], []);

        using var response = await PostImportPreviewAsync(client, workbook, "racks.xlsx");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Z坐标", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task MissingCsrfTokenReturnsBadRequest()
    {
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(CreateWorkbook(Headers, [])), "file", "racks.xlsx");

        using var response = await client.PostAsync("/api/racks/import-preview", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("防伪令牌缺失或无效", await ReadErrorAsync(response));
    }

    [Fact]
    public async Task GetRacks_OccupiedU_UnionsDeviceAndServerPositions()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "在架"
        };
        var serverPosition = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 20,
            EndU = 21,
            Status = "在架"
        };
        await ReplaceConstraintDataAsync([room], [rack], [server], [serverPosition]);

        await using (var scope = fixture.Factory.Services.CreateAsyncScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            dbContext.DevicePositions.Add(new DevicePosition
            {
                RackId = rack.Id,
                UNumber = 15,
                UHeight = 6,
                Label = "交换机"
            });
            await dbContext.SaveChangesAsync();
        }

        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await client.GetAsync($"/api/racks?roomId={room.Id}");
        response.EnsureSuccessStatusCode();

        using var document = await ReadDocumentAsync(response);
        var item = document.RootElement.EnumerateArray().Single(el => el.GetProperty("id").GetGuid() == rack.Id);
        // Device U10-U15 (6) + Server U20-U21 (2) = 8
        Assert.Equal(8, item.GetProperty("occupiedU").GetInt32());
    }

    [Fact]
    public async Task DeleteRack_RejectsWhenActiveServerExists()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 2,
            PositionStatus = "在架"
        };
        var position = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 40,
            EndU = 42,
            Status = "在架"
        };
        await ReplaceConstraintDataAsync([room], [rack], [server], [position]);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await DeleteRackAsync(client, rack.Id);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("机柜中存在在架服务器，不能删除", await ReadErrorAsync(response));
        Assert.NotNull(await FindRackByIdAsync(rack.Id));
    }

    [Fact]
    public async Task DeleteRack_SucceedsWhenNoActiveServer()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        await ReplaceConstraintDataAsync([room], [rack], [], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.Operations);

        using var response = await DeleteRackAsync(client, rack.Id);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(await FindRackByIdAsync(rack.Id));
    }

    [Fact]
    public async Task UpdateRack_RejectsHeightUThatTruncatesActiveServers()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 3,
            PositionStatus = "在架"
        };
        var position = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 40,
            EndU = 42,
            Status = "在架"
        };
        await ReplaceConstraintDataAsync([room], [rack], [server], [position]);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await PutRackAsync(client, rack.Id, new
        {
            code = rack.Code,
            heightU = 38,
            brand = rack.Brand,
            power = rack.Power,
            notes = rack.Notes,
            x = rack.X,
            y = rack.Y,
            z = rack.Z
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("新的 U 位总数会导致现有服务器占用超出机柜范围", await ReadErrorAsync(response));
        Assert.Equal(42, (await FindRackByIdAsync(rack.Id))!.HeightU);
    }

    [Fact]
    public async Task UpdateRack_AllowsHeightUAboveActiveServerEndU()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        var server = new Server
        {
            Name = "web-01",
            ManagementIP = "10.0.0.1",
            DeviceType = "机架式服务器",
            DeviceHeight = 3,
            PositionStatus = "在架"
        };
        var position = new ServerPosition
        {
            ServerId = server.Id,
            RackId = rack.Id,
            StartU = 40,
            EndU = 42,
            Status = "在架"
        };
        await ReplaceConstraintDataAsync([room], [rack], [server], [position]);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.Operations);

        using var response = await PutRackAsync(client, rack.Id, new
        {
            code = rack.Code,
            heightU = 42,
            brand = "戴尔",
            power = rack.Power,
            notes = rack.Notes,
            x = rack.X,
            y = rack.Y,
            z = rack.Z
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await FindRackByIdAsync(rack.Id);
        Assert.NotNull(updated);
        Assert.Equal(42, updated.HeightU);
        Assert.Equal("戴尔", updated.Brand);
    }

    [Fact]
    public async Task DeleteRack_ReadOnlyRoleReturnsForbidden()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        await ReplaceConstraintDataAsync([room], [rack], [], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await DeleteRackAsync(client, rack.Id);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.NotNull(await FindRackByIdAsync(rack.Id));
    }

    [Fact]
    public async Task DeleteRack_AnonymousReturnsUnauthorized()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        await ReplaceConstraintDataAsync([room], [rack], [], []);
        using var client = fixture.CreateClient();

        using var response = await DeleteRackAsync(client, rack.Id);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotNull(await FindRackByIdAsync(rack.Id));
    }

    [Fact]
    public async Task DeleteRack_MissingCsrfReturnsBadRequest()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        await ReplaceConstraintDataAsync([room], [rack], [], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await client.DeleteAsync($"/api/racks/{rack.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("防伪令牌缺失或无效", await ReadErrorAsync(response));
        Assert.NotNull(await FindRackByIdAsync(rack.Id));
    }

    [Fact]
    public async Task UpdateRack_ReadOnlyRoleReturnsForbidden()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        await ReplaceConstraintDataAsync([room], [rack], [], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.ReadOnlyViewer);

        using var response = await PutRackAsync(client, rack.Id, ValidUpdateBody(rack));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRack_AnonymousReturnsUnauthorized()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        await ReplaceConstraintDataAsync([room], [rack], [], []);
        using var client = fixture.CreateClient();

        using var response = await PutRackAsync(client, rack.Id, ValidUpdateBody(rack));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRack_MissingCsrfReturnsBadRequest()
    {
        var room = new Room { Name = "主机房", Status = "启用" };
        var rack = NewRack(room.Id, "R001");
        await ReplaceConstraintDataAsync([room], [rack], [], []);
        using var client = fixture.CreateClient();
        await LoginAsRoleAsync(client, Roles.RoomAdministrator);

        using var response = await client.PutAsJsonAsync($"/api/racks/{rack.Id}", ValidUpdateBody(rack));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("防伪令牌缺失或无效", await ReadErrorAsync(response));
    }

    private async Task ReplaceDataAsync(IEnumerable<Room> rooms, IEnumerable<Rack> racks)
    {
        await ReplaceConstraintDataAsync(rooms, racks, [], []);
    }

    private async Task ReplaceConstraintDataAsync(
        IEnumerable<Room> rooms,
        IEnumerable<Rack> racks,
        IEnumerable<Server> servers,
        IEnumerable<ServerPosition> positions)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.ServerPositions.RemoveRange(await dbContext.ServerPositions.ToListAsync());
        dbContext.DevicePositions.RemoveRange(await dbContext.DevicePositions.ToListAsync());
        dbContext.Servers.RemoveRange(await dbContext.Servers.ToListAsync());
        dbContext.Racks.RemoveRange(await dbContext.Racks.ToListAsync());
        dbContext.Rooms.RemoveRange(await dbContext.Rooms.ToListAsync());
        dbContext.Rooms.AddRange(rooms);
        dbContext.Racks.AddRange(racks);
        dbContext.Servers.AddRange(servers);
        dbContext.ServerPositions.AddRange(positions);
        await dbContext.SaveChangesAsync();
    }

    private async Task<Rack?> FindRackByIdAsync(Guid id)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<AppDbContext>().Racks
            .AsNoTracking()
            .SingleOrDefaultAsync(rack => rack.Id == id);
    }

    private async Task<Rack?> FindRackAsync(Guid roomId, string code)
    {
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<AppDbContext>().Racks
            .AsNoTracking()
            .SingleOrDefaultAsync(rack => rack.RoomId == roomId && rack.Code == code);
    }

    private static Rack NewRack(Guid roomId, string code) => new()
    {
        RoomId = roomId,
        Code = code,
        HeightU = 42,
        X = 0,
        Y = 0,
        Z = 0
    };

    private static object ValidUpdateBody(Rack rack) => new
    {
        code = rack.Code,
        heightU = rack.HeightU,
        brand = rack.Brand,
        power = rack.Power,
        notes = rack.Notes,
        x = rack.X,
        y = rack.Y,
        z = rack.Z
    };

    private static object?[] ValidRow(string roomName) =>
        ["R001", roomName, 42, "华为", 5.5, "A区", 1, 2, 3];

    private static object ImportRow(
        int row,
        string action,
        Guid roomId,
        string code,
        Guid? existingRackId = null,
        int heightU = 42) => new
        {
            row,
            action,
            code,
            roomId,
            heightU,
            brand = "华为",
            power = 5.5,
            notes = "A区",
            x = 1,
            y = 2,
            z = 3,
            existingRackId
        };

    private static byte[] CreateWorkbook(IReadOnlyList<string> headers, IReadOnlyList<object?[]> rows)
    {
        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("机柜");
        for (var column = 0; column < headers.Count; column++)
        {
            worksheet.Cell(1, column + 1).Value = headers[column];
        }

        for (var row = 0; row < rows.Count; row++)
        {
            for (var column = 0; column < rows[row].Length; column++)
            {
                if (rows[row][column] is not null)
                {
                    worksheet.Cell(row + 2, column + 1).Value = XLCellValue.FromObject(rows[row][column]);
                }
            }
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static async Task<HttpResponseMessage> PostImportPreviewAsync(
        HttpClient client,
        byte[] fileBytes,
        string fileName)
    {
        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        content.Add(fileContent, "file", fileName);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/racks/import-preview")
        {
            Content = content
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PostImportAsync(HttpClient client, IReadOnlyList<object> rows)
    {
        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/racks/import")
        {
            Content = JsonContent.Create(new { rows })
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> DeleteRackAsync(HttpClient client, Guid id)
    {
        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/racks/{id}");
        request.Headers.Add("X-XSRF-TOKEN", token);
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PutRackAsync(HttpClient client, Guid id, object body)
    {
        using var csrf = await client.GetAsync("/api/auth/csrf");
        var token = csrf.Headers.GetValues("X-XSRF-TOKEN").Single();
        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/racks/{id}")
        {
            Content = JsonContent.Create(body)
        };
        request.Headers.Add("X-XSRF-TOKEN", token);
        return await client.SendAsync(request);
    }

    private async Task LoginAsRoleAsync(HttpClient client, string role)
    {
        var username = $"rack-{Guid.NewGuid():N}";
        const string password = "rack-test-password";
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

    private static async Task<JsonDocument> ReadDocumentAsync(HttpResponseMessage response) =>
        await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());

    private static async Task<string[]> ReadFirstRowErrorsAsync(HttpResponseMessage response)
    {
        using var document = await ReadDocumentAsync(response);
        return document.RootElement.GetProperty("rows")[0].GetProperty("errors")
            .EnumerateArray()
            .Select(error => error.GetString()!)
            .ToArray();
    }

    private static async Task<string?> ReadErrorAsync(HttpResponseMessage response)
    {
        using var document = await ReadDocumentAsync(response);
        return document.RootElement.GetProperty("error").GetString();
    }
}
