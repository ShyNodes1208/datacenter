namespace Datacenter.Api.Models;

public sealed class ServerPosition
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ServerId { get; set; }

    public Server Server { get; set; } = null!;

    public Guid RackId { get; set; }

    public Rack Rack { get; set; } = null!;

    public int StartU { get; set; }

    public int EndU { get; set; }

    public string Status { get; set; } = "在架";

    public DateTime InstalledAt { get; set; } = DateTime.UtcNow;
}
