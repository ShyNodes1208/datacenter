namespace Datacenter.Api.Models;

public sealed class Cable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SourcePortId { get; set; }

    public Port SourcePort { get; set; } = null!;

    public Guid TargetPortId { get; set; }

    public Port TargetPort { get; set; } = null!;

    public string CableType { get; set; } = string.Empty;

    public string? Color { get; set; }

    public string? Length { get; set; }

    public string? Notes { get; set; }

    public string Purpose { get; set; } = "正常";

    public string Status { get; set; } = "正常";
}
