namespace Datacenter.Api.Models;

public sealed class Server
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public string ManagementIP { get; set; } = string.Empty;

    public string? AssetNumber { get; set; }

    public string DeviceType { get; set; } = string.Empty;

    public int DeviceHeight { get; set; }

    public string OperationalStatus { get; set; } = "正常";

    public string PositionStatus { get; set; } = "未上架";

    public string? System { get; set; }

    public string? Owner { get; set; }

    public string? Notes { get; set; }
}
