namespace Datacenter.Api.Models;

public sealed class Wall
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RoomId { get; set; }

    public Room Room { get; set; } = null!;

    public double X1 { get; set; }

    public double Y1 { get; set; }

    public double X2 { get; set; }

    public double Y2 { get; set; }

    public string Color { get; set; } = "#333333";

    public int Thickness { get; set; } = 3;
}
