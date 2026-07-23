namespace Datacenter.Api.Models;

public sealed class Rack
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Code { get; set; } = string.Empty;

    public Guid RoomId { get; set; }

    public Room Room { get; set; } = null!;

    public int HeightU { get; set; }

    public string? Brand { get; set; }

    public double? Power { get; set; }

    public string? Notes { get; set; }

    public double X { get; set; }

    public double Y { get; set; }

    public double Z { get; set; }
}
