using Datacenter.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<Room> Rooms => Set<Room>();

    public DbSet<Rack> Racks => Set<Rack>();

    public DbSet<DevicePosition> DevicePositions => Set<DevicePosition>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<User>();
        user.ToTable("Users", table => table.HasCheckConstraint(
            "CK_Users_Role",
            $"Role IN ('{Roles.RoomAdministrator}', '{Roles.Operations}', '{Roles.DbaApplicationOperations}', '{Roles.ReadOnlyViewer}')"));
        user.HasKey(item => item.Id);
        user.HasIndex(item => item.Username).IsUnique();
        user.Property(item => item.Username).IsRequired();
        user.Property(item => item.PasswordHash).IsRequired();
        user.Property(item => item.Role).IsRequired();
        user.Property(item => item.CreatedAt).IsRequired();

        var room = modelBuilder.Entity<Room>();
        room.ToTable("Rooms", table => table.HasCheckConstraint(
            "CK_Rooms_Status",
            "Status IN ('启用', '停用')"));
        room.HasKey(item => item.Id);
        room.HasIndex(item => item.Name).IsUnique();
        room.Property(item => item.Name).IsRequired();
        room.Property(item => item.Status).IsRequired();

        var rack = modelBuilder.Entity<Rack>();
        rack.ToTable("Racks");
        rack.HasKey(item => item.Id);
        rack.HasIndex(item => new { item.RoomId, item.Code }).IsUnique();
        rack.Property(item => item.Code).IsRequired();
        rack.Property(item => item.HeightU).IsRequired();
        rack.Property(item => item.X).IsRequired();
        rack.Property(item => item.Y).IsRequired();
        rack.Property(item => item.Z).IsRequired();
        rack.HasOne(item => item.Room)
            .WithMany()
            .HasForeignKey(item => item.RoomId)
            .OnDelete(DeleteBehavior.Restrict);

        var devicePosition = modelBuilder.Entity<DevicePosition>();
        devicePosition.ToTable("DevicePositions");
        devicePosition.HasKey(item => item.Id);
        devicePosition.HasIndex(item => new { item.RackId, item.UNumber }).IsUnique();
        devicePosition.Property(item => item.UNumber).IsRequired();
        devicePosition.HasOne(item => item.Rack)
            .WithMany()
            .HasForeignKey(item => item.RackId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
