namespace Datacenter.Api.Models;

public sealed class Port
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ServerId { get; set; }

    public Server Server { get; set; } = null!;

    public string PortName { get; set; } = string.Empty;

    public string PortType { get; set; } = string.Empty;

    public string? Speed { get; set; }

    public string? Notes { get; set; }
}
