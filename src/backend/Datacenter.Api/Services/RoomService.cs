using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Services;

public sealed class RoomService(AppDbContext db)
{
    public async Task<List<Room>> GetAllAsync()
    {
        return await db.Rooms.OrderBy(r => r.Name).ToListAsync();
    }

    public async Task<Room?> GetByIdAsync(int id)
    {
        return await db.Rooms.FindAsync(id);
    }

    public async Task<(Room? Room, string? Error)> CreateAsync(string name, string? location, string? notes)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return (null, "机房名称不能为空");
        }

        var trimmedName = name.Trim();
        var exists = await db.Rooms.AnyAsync(r => r.Name == trimmedName);
        if (exists)
        {
            return (null, "机房名称已存在");
        }

        var room = new Room
        {
            Name = trimmedName,
            Location = location?.Trim(),
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.Rooms.Add(room);
        await db.SaveChangesAsync();
        return (room, null);
    }

    public async Task<(Room? Room, string? Error)> UpdateAsync(int id, string? name, string? location, string? notes)
    {
        var room = await db.Rooms.FindAsync(id);
        if (room is null)
        {
            return (null, "机房不存在");
        }

        if (name is not null)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return (null, "机房名称不能为空");
            }

            var trimmed = name.Trim();
            var exists = await db.Rooms.AnyAsync(r => r.Name == trimmed && r.Id != id);
            if (exists)
            {
                return (null, "机房名称已存在");
            }

            room.Name = trimmed;
        }

        if (location is not null)
        {
            var trimmedLocation = location.Trim();
            room.Location = trimmedLocation.Length == 0 ? null : trimmedLocation;
        }

        if (notes is not null)
        {
            var trimmedNotes = notes.Trim();
            room.Notes = trimmedNotes.Length == 0 ? null : trimmedNotes;
        }

        room.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return (room, null);
    }
}
