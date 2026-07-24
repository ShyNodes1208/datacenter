namespace Datacenter.Api.Models;

public sealed class AuditRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ServerId { get; set; }

    public Server Server { get; set; } = null!;

    public string OperationType { get; set; } = string.Empty;

    public string? FromPosition { get; set; }

    public string? ToPosition { get; set; }

    public string OperatorUsername { get; set; } = string.Empty;

    public DateTime OperatedAt { get; set; } = DateTime.UtcNow;

    public string? Notes { get; set; }
}
