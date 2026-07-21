using Datacenter.Api.Data;
using Datacenter.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Tests.UnitTests;

public sealed class RoomUnitTests : IDisposable
{
    private readonly AppDbContext _db;

    public RoomUnitTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;
        _db = new AppDbContext(options);
        _db.Database.OpenConnection();
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
    }

    [Fact]
    public async Task CreateAsync_ReturnsError_WhenNameIsEmpty()
    {
        var service = new RoomService(_db);

        var (room, error) = await service.CreateAsync("", null, null);

        Assert.Null(room);
        Assert.Equal("机房名称不能为空", error);
    }

    [Fact]
    public async Task CreateAsync_ReturnsError_WhenNameIsWhitespace()
    {
        var service = new RoomService(_db);

        var (room, error) = await service.CreateAsync("   ", null, null);

        Assert.Null(room);
        Assert.Equal("机房名称不能为空", error);
    }

    [Fact]
    public async Task CreateAsync_Succeeds_WithValidName()
    {
        var service = new RoomService(_db);

        var (room, error) = await service.CreateAsync("Test Room", "Floor 1", "Notes here");

        Assert.Null(error);
        Assert.NotNull(room);
        Assert.Equal("Test Room", room.Name);
        Assert.Equal("Floor 1", room.Location);
        Assert.Equal("Notes here", room.Notes);
        Assert.NotEqual(default, room.CreatedAt);
        Assert.NotEqual(default, room.UpdatedAt);
    }

    [Fact]
    public async Task CreateAsync_ReturnsError_WhenNameDuplicate()
    {
        var service = new RoomService(_db);
        await service.CreateAsync("Unique Room", null, null);

        var (room, error) = await service.CreateAsync("Unique Room", null, null);

        Assert.Null(room);
        Assert.Equal("机房名称已存在", error);
    }
}
