namespace Datacenter.Api.Models;

public sealed class Zone
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RoomId { get; set; }

    public Room Room { get; set; } = null!;

    public double X { get; set; }

    public double Y { get; set; }

    public double Width { get; set; }

    public double Height { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Color { get; set; } = "rgba(100,149,237,0.15)";

    public string ZoneType { get; set; } = "functional";
}
