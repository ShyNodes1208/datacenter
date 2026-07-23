namespace Datacenter.Api.Models;

public sealed class DevicePosition
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RackId { get; set; }

    public Rack Rack { get; set; } = null!;

    public int UNumber { get; set; }

    public string? Label { get; set; }
}
