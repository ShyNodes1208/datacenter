namespace Datacenter.Api.Services.ConnectionSheet;

public sealed record ConnectionSheetRow(
    int RowNumber,
    string? Brand,
    string? DeviceType,
    string? Model,
    string? Serial,
    string LocalPort,
    string Room,
    string Rack,
    string UText,
    string SwitchName,
    string SwitchPort,
    string PeerRack,
    string PeerUText,
    string? InterfaceType,
    string CableType,
    string? OutOfBandIp,
    string? Notes);

public sealed record ConnectionSheetRowIssue(int Row, string Message, bool IsError);

public sealed record PlannedRoom(string Name, bool Exists);

public sealed record PlannedRack(string Room, string Code, bool Exists, int HeightU, double X, double Y);

public sealed record PlannedDevice(
    string Key,
    string Room,
    string Rack,
    int StartU,
    int HeightU,
    string DisplayName,
    string DeviceType,
    string? ManagementIp,
    string? AssetNumber,
    string? Brand,
    string? Model,
    string? Notes,
    bool IsSwitch,
    bool Exists);

public sealed record PlannedCable(
    int RowNumber,
    string LocalDeviceKey,
    string LocalPort,
    string LocalPortType,
    string RemoteDeviceKey,
    string RemotePort,
    string RemotePortType,
    string CableType,
    string? Length,
    string Purpose);

public sealed record ConnectionSheetImportPlan(
    int TotalRows,
    int ValidRows,
    int ErrorRows,
    IReadOnlyList<PlannedRoom> Rooms,
    IReadOnlyList<PlannedRack> Racks,
    IReadOnlyList<PlannedDevice> Devices,
    IReadOnlyList<PlannedCable> Cables,
    IReadOnlyList<ConnectionSheetRowIssue> Issues);

public sealed record ConnectionSheetImportResult(
    int TotalRows,
    int SuccessCount,
    int ErrorCount,
    int RoomsCreated,
    int RacksCreated,
    int DevicesCreated,
    int CablesCreated,
    IReadOnlyList<ConnectionSheetRowIssue> Errors);
