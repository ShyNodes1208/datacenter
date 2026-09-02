using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Services.ConnectionSheet;

public sealed class ConnectionSheetImportService(AppDbContext dbContext)
{
    private const int DefaultRackHeightU = 42;
    private const double RackGridSpacing = 600;
    private const int MaxReturnedErrors = 200;

    public ConnectionSheetImportPlan BuildPlan(Stream stream)
    {
        var (rows, parseIssues, scannedRows) = ConnectionSheetExcelParser.Parse(stream);
        return BuildPlanFromRows(rows, parseIssues, scannedRows);
    }

    public async Task<ConnectionSheetImportResult> ImportAsync(
        Stream stream,
        string operatorUsername,
        CancellationToken cancellationToken = default)
    {
        var plan = BuildPlan(stream);
        if (plan.Cables.Count == 0)
        {
            return new ConnectionSheetImportResult(
                plan.TotalRows,
                0,
                plan.ErrorRows,
                0,
                0,
                0,
                0,
                plan.Issues.Where(i => i.IsError).Take(MaxReturnedErrors).ToList());
        }

        var roomsCreated = 0;
        var racksCreated = 0;
        var devicesCreated = 0;
        var cablesCreated = 0;
        var runtimeErrors = new List<ConnectionSheetRowIssue>();

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var roomsByName = await dbContext.Rooms
                .AsNoTracking()
                .ToDictionaryAsync(r => r.Name, r => r, StringComparer.OrdinalIgnoreCase, cancellationToken);

            foreach (var plannedRoom in plan.Rooms.Where(r => !r.Exists))
            {
                var room = new Room
                {
                    Name = plannedRoom.Name,
                    Status = "启用",
                    TopologyX = 0,
                    TopologyY = 0
                };
                dbContext.Rooms.Add(room);
                await dbContext.SaveChangesAsync(cancellationToken);
                roomsByName[room.Name] = room;
                roomsCreated++;
            }

            var racks = await dbContext.Racks.Include(r => r.Room).ToListAsync(cancellationToken);
            var racksByKey = racks.ToDictionary(
                r => RackKey(r.Room.Name, r.Code),
                r => r,
                StringComparer.OrdinalIgnoreCase);

            foreach (var plannedRack in plan.Racks.Where(r => !r.Exists))
            {
                if (!roomsByName.TryGetValue(plannedRack.Room, out var room))
                {
                    runtimeErrors.Add(new ConnectionSheetRowIssue(0, $"机房不存在: {plannedRack.Room}", true));
                    continue;
                }

                var rack = new Rack
                {
                    Code = plannedRack.Code,
                    RoomId = room.Id,
                    HeightU = plannedRack.HeightU,
                    X = plannedRack.X,
                    Y = plannedRack.Y,
                    Z = 0,
                    Status = "启用",
                    Notes = "设备连接信息导入"
                };
                dbContext.Racks.Add(rack);
                await dbContext.SaveChangesAsync(cancellationToken);
                racksByKey[RackKey(plannedRack.Room, plannedRack.Code)] = rack;
                racksCreated++;
            }

            var servers = await dbContext.Servers.ToListAsync(cancellationToken);
            var positions = await dbContext.ServerPositions
                .Where(p => p.Status == "在架")
                .Include(p => p.Rack)
                .ThenInclude(r => r.Room)
                .ToListAsync(cancellationToken);

            var serverByKey = BuildExistingServerLookup(servers, positions, roomsByName);
            var usedNames = new HashSet<string>(servers.Select(s => s.Name), StringComparer.OrdinalIgnoreCase);
            var usedIps = new HashSet<string>(
                servers.Select(s => s.ManagementIP).Where(ip => !string.IsNullOrWhiteSpace(ip)),
                StringComparer.OrdinalIgnoreCase);
            var usedAssetNumbers = new HashSet<string>(
                servers.Where(s => !string.IsNullOrWhiteSpace(s.AssetNumber)).Select(s => s.AssetNumber!),
                StringComparer.OrdinalIgnoreCase);

            var serverIdByKey = new Dictionary<string, Server>(StringComparer.Ordinal);
            foreach (var pair in serverByKey)
                serverIdByKey[pair.Key] = pair.Value;

            var pendingDevices = new List<(string Key, Server Server)>();
            foreach (var device in plan.Devices)
            {
                if (serverIdByKey.ContainsKey(device.Key))
                    continue;

                var name = EnsureUniqueName(device.DisplayName, usedNames);
                var ip = ResolveManagementIp(device, usedIps);
                var assetNumber = ResolveAssetNumber(device.AssetNumber, usedAssetNumbers);

                if (!racksByKey.TryGetValue(RackKey(device.Room, device.Rack), out var rack))
                {
                    runtimeErrors.Add(new ConnectionSheetRowIssue(0, $"机柜不存在: {device.Room}/{device.Rack}", true));
                    continue;
                }

                var endU = device.StartU + device.HeightU - 1;
                if (endU > rack.HeightU)
                {
                    runtimeErrors.Add(new ConnectionSheetRowIssue(
                        0,
                        $"机柜 {device.Rack} 高度 {rack.HeightU}U，无法容纳设备 {name} (U{device.StartU}-U{endU})",
                        true));
                    continue;
                }

                var conflict = await dbContext.ServerPositions.AnyAsync(
                    p => p.RackId == rack.Id && p.Status == "在架"
                         && p.StartU <= endU && p.EndU >= device.StartU,
                    cancellationToken);
                if (conflict)
                {
                    runtimeErrors.Add(new ConnectionSheetRowIssue(
                        0,
                        $"机柜 {device.Rack} U{device.StartU}-U{endU} 已被占用",
                        true));
                    continue;
                }

                var server = new Server
                {
                    Name = name,
                    ManagementIP = ip,
                    AssetNumber = assetNumber,
                    DeviceType = device.DeviceType,
                    DeviceHeight = device.HeightU,
                    OperationalStatus = "正常",
                    PositionStatus = "在架",
                    Notes = BuildServerNotes(device)
                };
                dbContext.Servers.Add(server);
                dbContext.ServerPositions.Add(new ServerPosition
                {
                    Server = server,
                    RackId = rack.Id,
                    StartU = device.StartU,
                    EndU = endU,
                    Status = "在架",
                    InstalledAt = DateTime.UtcNow
                });
                AuditService.Record(dbContext, server, "上架", null, $"{rack.Code} U{device.StartU}-U{endU}", operatorUsername);
                pendingDevices.Add((device.Key, server));
            }

            if (pendingDevices.Count > 0)
            {
                await dbContext.SaveChangesAsync(cancellationToken);
                foreach (var (key, server) in pendingDevices)
                    serverIdByKey[key] = server;
                devicesCreated = pendingDevices.Count;
            }

            var ports = await dbContext.Ports.ToListAsync(cancellationToken);
            var portByServerAndName = ports.ToDictionary(
                p => PortKey(p.ServerId, p.PortName),
                p => p,
                StringComparer.OrdinalIgnoreCase);

            var occupiedPortIds = new HashSet<Guid>(
                await dbContext.Cables.Select(c => c.SourcePortId).ToListAsync(cancellationToken));
            occupiedPortIds.UnionWith(await dbContext.Cables.Select(c => c.TargetPortId).ToListAsync(cancellationToken));

            foreach (var cable in plan.Cables)
            {
                if (!serverIdByKey.TryGetValue(cable.LocalDeviceKey, out var localServer)
                    || !serverIdByKey.TryGetValue(cable.RemoteDeviceKey, out var remoteServer))
                    continue;

                GetOrCreatePort(localServer, cable.LocalPort, cable.LocalPortType, portByServerAndName);
                GetOrCreatePort(remoteServer, cable.RemotePort, cable.RemotePortType, portByServerAndName);
            }

            await dbContext.SaveChangesAsync(cancellationToken);

            var successCount = 0;
            foreach (var cable in plan.Cables)
            {
                if (!serverIdByKey.TryGetValue(cable.LocalDeviceKey, out var localServer)
                    || !serverIdByKey.TryGetValue(cable.RemoteDeviceKey, out var remoteServer))
                {
                    runtimeErrors.Add(new ConnectionSheetRowIssue(cable.RowNumber, "设备未创建或不存在", true));
                    continue;
                }

                try
                {
                    var sourceKey = PortKey(localServer.Id, cable.LocalPort);
                    var targetKey = PortKey(remoteServer.Id, cable.RemotePort);
                    if (!portByServerAndName.TryGetValue(sourceKey, out var sourcePort)
                        || !portByServerAndName.TryGetValue(targetKey, out var targetPort))
                    {
                        runtimeErrors.Add(new ConnectionSheetRowIssue(cable.RowNumber, "端口不存在", true));
                        continue;
                    }

                    if (occupiedPortIds.Contains(sourcePort.Id))
                    {
                        runtimeErrors.Add(new ConnectionSheetRowIssue(
                            cable.RowNumber, $"源端口已被占用: {localServer.Name}/{cable.LocalPort}", true));
                        continue;
                    }

                    if (occupiedPortIds.Contains(targetPort.Id))
                    {
                        runtimeErrors.Add(new ConnectionSheetRowIssue(
                            cable.RowNumber, $"目标端口已被占用: {remoteServer.Name}/{cable.RemotePort}", true));
                        continue;
                    }

                    if (sourcePort.Id == targetPort.Id)
                    {
                        runtimeErrors.Add(new ConnectionSheetRowIssue(cable.RowNumber, "源端口与目标端口相同", true));
                        continue;
                    }

                    dbContext.Cables.Add(new Cable
                    {
                        SourcePortId = sourcePort.Id,
                        TargetPortId = targetPort.Id,
                        CableType = cable.CableType,
                        Length = cable.Length,
                        Purpose = cable.Purpose,
                        Notes = $"行 {cable.RowNumber}"
                    });
                    occupiedPortIds.Add(sourcePort.Id);
                    occupiedPortIds.Add(targetPort.Id);
                    successCount++;
                    cablesCreated++;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    runtimeErrors.Add(new ConnectionSheetRowIssue(cable.RowNumber, $"处理失败: {ex.Message}", true));
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var allErrors = plan.Issues.Where(i => i.IsError)
                .Concat(runtimeErrors)
                .Take(MaxReturnedErrors)
                .ToList();

            return new ConnectionSheetImportResult(
                plan.TotalRows,
                successCount,
                allErrors.Count,
                roomsCreated,
                racksCreated,
                devicesCreated,
                cablesCreated,
                allErrors);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private ConnectionSheetImportPlan BuildPlanFromRows(
        IReadOnlyList<ConnectionSheetRow> rows,
        IReadOnlyList<ConnectionSheetRowIssue> parseIssues,
        int scannedRows)
    {
        var issues = new List<ConnectionSheetRowIssue>(parseIssues);
        var warnings = new List<ConnectionSheetRowIssue>();
        var devices = new Dictionary<string, PlannedDevice>(StringComparer.Ordinal);
        var racks = new Dictionary<string, PlannedRack>(StringComparer.OrdinalIgnoreCase);
        var rooms = new Dictionary<string, PlannedRoom>(StringComparer.OrdinalIgnoreCase);
        var cables = new List<PlannedCable>();
        var usedAssetNumbers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var usedIps = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var existingRooms = dbContext.Rooms.AsNoTracking()
            .Select(r => r.Name)
            .ToList()
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var existingRackList = dbContext.Racks.AsNoTracking()
            .Include(r => r.Room)
            .Select(r => new { r.Code, RoomName = r.Room.Name })
            .ToList();
        var existingRacks = new HashSet<string>(
            existingRackList.Select(r => RackKey(r.RoomName, r.Code)),
            StringComparer.OrdinalIgnoreCase);

        var existingDeviceKeys = BuildExistingDeviceKeySet();

        foreach (var row in rows)
        {
            try
            {
                var (localStart, localHeight) = ConnectionSheetExcelParser.ParseURange(row.UText);
                var (peerStart, peerHeight) = ConnectionSheetExcelParser.ParseURange(row.PeerUText);
                var localKey = ConnectionSheetExcelParser.LocalDeviceKey(
                    row.Room, row.Rack, localStart, localHeight, row.Serial);
                var remoteKey = ConnectionSheetExcelParser.RemoteDeviceKey(
                    row.Room, row.PeerRack, peerStart, peerHeight, row.SwitchName);

                EnsureRoom(rooms, row.Room, existingRooms);
                EnsureRack(racks, row.Room, row.Rack, localStart, localHeight, existingRacks);
                EnsureRack(racks, row.Room, row.PeerRack, peerStart, peerHeight, existingRacks);

                if (!devices.ContainsKey(localKey))
                {
                    var displayName = ConnectionSheetExcelParser.BuildLocalDisplayName(row);
                    var mgmtIp = ResolvePreviewIp(row.OutOfBandIp, localKey, usedIps, warnings, row.RowNumber);
                    var assetNumber = ResolvePreviewAsset(row.Serial, usedAssetNumbers);
                    devices[localKey] = new PlannedDevice(
                        localKey,
                        row.Room,
                        row.Rack,
                        localStart,
                        localHeight,
                        displayName,
                        ConnectionSheetExcelParser.NormalizeLocalDeviceType(row.DeviceType),
                        mgmtIp,
                        assetNumber,
                        row.Brand,
                        row.Model,
                        row.Notes,
                        IsSwitch: false,
                        Exists: existingDeviceKeys.Contains(localKey));
                }

                if (!devices.ContainsKey(remoteKey))
                {
                    var mgmtIp = ConnectionSheetExcelParser.GeneratePlaceholderIp(remoteKey, usedIps);
                    devices[remoteKey] = new PlannedDevice(
                        remoteKey,
                        row.Room,
                        row.PeerRack,
                        peerStart,
                        peerHeight,
                        row.SwitchName,
                        "交换机",
                        mgmtIp,
                        null,
                        null,
                        null,
                        "设备连接信息导入",
                        IsSwitch: true,
                        Exists: existingDeviceKeys.Contains(remoteKey));
                }

                var localPortType = ConnectionSheetExcelParser.NormalizePortType(row.InterfaceType);
                var remotePortType = ConnectionSheetExcelParser.NormalizePortType(
                    row.InterfaceType?.Contains("光", StringComparison.Ordinal) == true ? "光口" : row.InterfaceType);

                cables.Add(new PlannedCable(
                    row.RowNumber,
                    localKey,
                    row.LocalPort,
                    localPortType,
                    remoteKey,
                    row.SwitchPort,
                    remotePortType,
                    ConnectionSheetExcelParser.NormalizeCableType(row.CableType),
                    ConnectionSheetExcelParser.ExtractCableLength(row.Notes),
                    "正常"));
            }
            catch (FormatException ex)
            {
                issues.Add(new ConnectionSheetRowIssue(row.RowNumber, ex.Message, true));
            }
            catch (Exception ex)
            {
                issues.Add(new ConnectionSheetRowIssue(row.RowNumber, ex.Message, true));
            }
        }

        var newRackIndex = 0;
        var plannedRacks = racks.Values
            .OrderBy(r => r.Room)
            .ThenBy(r => r.Code)
            .Select(r =>
            {
                if (r.Exists)
                    return r;
                var col = newRackIndex % 4;
                var rowIndex = newRackIndex / 4;
                newRackIndex++;
                return r with
                {
                    X = col * RackGridSpacing,
                    Y = rowIndex * RackGridSpacing
                };
            })
            .ToList();

        var errorRows = issues.Count(i => i.IsError);
        return new ConnectionSheetImportPlan(
            scannedRows,
            cables.Count,
            errorRows,
            rooms.Values.OrderBy(r => r.Name).ToList(),
            plannedRacks,
            devices.Values.OrderBy(d => d.Room).ThenBy(d => d.Rack).ThenBy(d => d.StartU).ToList(),
            cables,
            issues.Concat(warnings).ToList());
    }

    private HashSet<string> BuildExistingDeviceKeySet()
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        var positions = dbContext.ServerPositions.AsNoTracking()
            .Where(p => p.Status == "在架")
            .Select(p => new
            {
                p.StartU,
                p.EndU,
                p.Server.Name,
                p.Server.AssetNumber,
                p.Server.DeviceType,
                RackCode = p.Rack.Code,
                RoomName = p.Rack.Room.Name
            })
            .ToList();

        foreach (var item in positions)
        {
            var height = item.EndU - item.StartU + 1;
            if (item.DeviceType.Contains("交换", StringComparison.Ordinal))
            {
                result.Add(ConnectionSheetExcelParser.RemoteDeviceKey(
                    item.RoomName, item.RackCode, item.StartU, height, item.Name));
            }
            else
            {
                result.Add(ConnectionSheetExcelParser.LocalDeviceKey(
                    item.RoomName, item.RackCode, item.StartU, height, item.AssetNumber ?? string.Empty));
            }
        }

        return result;
    }

    private static Dictionary<string, Server> BuildExistingServerLookup(
        IReadOnlyList<Server> servers,
        IReadOnlyList<ServerPosition> positions,
        IReadOnlyDictionary<string, Room> roomsByName)
    {
        var serverById = servers.ToDictionary(s => s.Id);
        var lookup = new Dictionary<string, Server>(StringComparer.Ordinal);
        foreach (var position in positions)
        {
            if (!serverById.TryGetValue(position.ServerId, out var server))
                continue;
            var roomName = position.Rack.Room?.Name
                ?? roomsByName.Values.FirstOrDefault(r => r.Id == position.Rack.RoomId)?.Name
                ?? string.Empty;
            var height = position.EndU - position.StartU + 1;
            if (server.DeviceType.Contains("交换", StringComparison.Ordinal))
            {
                var key = ConnectionSheetExcelParser.RemoteDeviceKey(
                    roomName, position.Rack.Code, position.StartU, height, server.Name);
                lookup[key] = server;
            }
            else
            {
                var key = ConnectionSheetExcelParser.LocalDeviceKey(
                    roomName, position.Rack.Code, position.StartU, height, server.AssetNumber ?? string.Empty);
                lookup[key] = server;
            }
        }
        return lookup;
    }

    private static void EnsureRoom(
        IDictionary<string, PlannedRoom> rooms,
        string roomName,
        ISet<string> existingRooms)
    {
        if (rooms.ContainsKey(roomName))
            return;
        rooms[roomName] = new PlannedRoom(roomName, existingRooms.Contains(roomName));
    }

    private static void EnsureRack(
        IDictionary<string, PlannedRack> racks,
        string room,
        string code,
        int startU,
        int heightU,
        ISet<string> existingRacks)
    {
        var key = RackKey(room, code);
        if (racks.TryGetValue(key, out var existing))
        {
            var requiredHeight = Math.Max(startU + heightU - 1, DefaultRackHeightU);
            if (requiredHeight > existing.HeightU)
                racks[key] = existing with { HeightU = requiredHeight };
            return;
        }

        var neededHeight = Math.Max(DefaultRackHeightU, startU + heightU - 1);
        racks[key] = new PlannedRack(room, code, existingRacks.Contains(key), neededHeight, -1, -1);
    }

    private void GetOrCreatePort(
        Server server,
        string portName,
        string portType,
        IDictionary<string, Port> portByServerAndName)
    {
        var key = PortKey(server.Id, portName);
        if (portByServerAndName.ContainsKey(key))
            return;

        var port = new Port
        {
            ServerId = server.Id,
            PortName = portName,
            PortType = portType
        };
        dbContext.Ports.Add(port);
        portByServerAndName[key] = port;
    }

    private static string RackKey(string room, string code) => $"{room}\0{code}";

    private static string PortKey(Guid serverId, string portName) => $"{serverId:N}\0{portName}";

    private static string EnsureUniqueName(string baseName, ISet<string> used)
    {
        var candidate = baseName.Trim();
        if (used.Add(candidate))
            return candidate;
        var index = 2;
        while (!used.Add($"{candidate}#{index}"))
            index++;
        return $"{candidate}#{index}";
    }

    private static string ResolveManagementIp(PlannedDevice device, ISet<string> usedIps)
    {
        if (ConnectionSheetExcelParser.IsValidIpv4(device.ManagementIp) && usedIps.Add(device.ManagementIp!))
            return device.ManagementIp!;
        return ConnectionSheetExcelParser.GeneratePlaceholderIp(device.Key, usedIps);
    }

    private static string? ResolveAssetNumber(string? serial, ISet<string> usedAssetNumbers)
    {
        if (string.IsNullOrWhiteSpace(serial))
            return null;
        var value = serial.Trim();
        return usedAssetNumbers.Add(value) ? value : null;
    }

    private static string? ResolvePreviewAsset(string? serial, ISet<string> usedAssetNumbers)
    {
        if (string.IsNullOrWhiteSpace(serial))
            return null;
        var value = serial.Trim();
        if (usedAssetNumbers.Contains(value))
            return null;
        usedAssetNumbers.Add(value);
        return value;
    }

    private static string ResolvePreviewIp(
        string? rawIp,
        string deviceKey,
        ISet<string> usedIps,
        ICollection<ConnectionSheetRowIssue> warnings,
        int rowNumber)
    {
        if (ConnectionSheetExcelParser.IsValidIpv4(rawIp) && usedIps.Add(rawIp!))
            return rawIp!;
        if (!string.IsNullOrWhiteSpace(rawIp))
        {
            warnings.Add(new ConnectionSheetRowIssue(
                rowNumber,
                $"带外管理 IP「{rawIp}」无效或重复，将自动生成占位 IP",
                false));
        }
        return ConnectionSheetExcelParser.GeneratePlaceholderIp(deviceKey, usedIps);
    }

    private static string? BuildServerNotes(PlannedDevice device)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(device.Brand))
            parts.Add(device.Brand);
        if (!string.IsNullOrWhiteSpace(device.Model))
            parts.Add(device.Model);
        if (!string.IsNullOrWhiteSpace(device.Notes))
            parts.Add(device.Notes);
        return parts.Count == 0 ? "设备连接信息导入" : string.Join(" ", parts);
    }
}
