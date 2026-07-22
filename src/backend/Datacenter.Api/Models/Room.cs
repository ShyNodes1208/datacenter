namespace Datacenter.Api.Models;

public sealed class Room
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;
}
