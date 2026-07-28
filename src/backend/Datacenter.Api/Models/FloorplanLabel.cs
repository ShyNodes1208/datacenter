namespace Datacenter.Api.Models;

public sealed class FloorplanLabel
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RoomId { get; set; }

    public Room Room { get; set; } = null!;

    public double X { get; set; }

    public double Y { get; set; }

    public string Text { get; set; } = string.Empty;

    public int FontSize { get; set; } = 14;

    public string Color { get; set; } = "#666666";
}
