using Datacenter.Api.Data;
using Datacenter.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Datacenter.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class NetworkPathController(AppDbContext dbContext) : ControllerBase
{
    private static readonly string[] NetworkDeviceKeywords =
        ["交换", "switch", "路由", "router", "网络", "network"];

    [HttpGet("network-path")]
    public async Task<IActionResult> FindPath(
        [FromQuery] Guid sourceId,
        [FromQuery] Guid targetId,
        CancellationToken cancellationToken)
    {
        // 1. 验证设备存在
        if (sourceId == targetId)
            return BadRequest(new { error = "源设备和目标设备不能相同" });

        // 2. 一次性加载所有需要的数据到内存
        var deviceInfo = await dbContext.Servers
            .AsNoTracking()
            .ToDictionaryAsync(s => s.Id, s => new DeviceInfo(s.Name, s.DeviceType), cancellationToken);

        if (!deviceInfo.ContainsKey(sourceId))
            return NotFound(new { error = "源设备不存在" });

        if (!deviceInfo.ContainsKey(targetId))
            return NotFound(new { error = "目标设备不存在" });

        var ports = await dbContext.Ports
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var cables = await dbContext.Cables
            .AsNoTracking()
            .OrderBy(c => c.Id)
            .ToListAsync(cancellationToken);

        // 3. 构建邻接表: portId -> [(cable, neighborPortId)]
        var portAdjacency = new Dictionary<Guid, List<(Cable Cable, Guid NeighborPortId)>>();
        foreach (var cable in cables)
        {
            if (!portAdjacency.ContainsKey(cable.SourcePortId))
                portAdjacency[cable.SourcePortId] = [];
            portAdjacency[cable.SourcePortId].Add((cable, cable.TargetPortId));

            if (!portAdjacency.ContainsKey(cable.TargetPortId))
                portAdjacency[cable.TargetPortId] = [];
            portAdjacency[cable.TargetPortId].Add((cable, cable.SourcePortId));
        }

        // 4. portId -> serverId
        var portToServer = ports.ToDictionary(p => p.Id, p => p.ServerId);

        // 5. serverId -> ports
        var serverToPorts = ports
            .GroupBy(p => p.ServerId)
            .ToDictionary(g => g.Key, g => g.OrderBy(p => p.Id).ToList());

        // 6. BFS（邻接边按 neighborDeviceId → portId → cableId 排序保证确定性）
        var queue = new Queue<(Guid ServerId, List<PathHop> Hops)>();
        var visited = new HashSet<Guid> { sourceId };

        // 初始化：从 source 出发探索第一跳
        if (serverToPorts.TryGetValue(sourceId, out var srcPorts))
        {
            var candidates = new List<(Port Port, Cable Cable, Guid NeighborPortId, Guid NeighborId)>();
            foreach (var port in srcPorts)
            {
                if (!portAdjacency.TryGetValue(port.Id, out var edges))
                    continue;
                foreach (var (cable, neighborPortId) in edges)
                {
                    var neighborId = portToServer.GetValueOrDefault(neighborPortId);
                    if (neighborId == Guid.Empty || neighborId == sourceId)
                        continue;
                    candidates.Add((port, cable, neighborPortId, neighborId));
                }
            }

            foreach (var (port, cable, neighborPortId, neighborId) in
                candidates.OrderBy(c => c.NeighborId).ThenBy(c => c.Port.Id).ThenBy(c => c.Cable.Id))
            {
                if (neighborId != targetId && !IsNetworkDevice(deviceInfo[neighborId].DeviceType))
                    continue;

                if (!visited.Add(neighborId))
                    continue;

                var hop = CreateHop(
                    sourceId, port.Id, cable, neighborId, neighborPortId,
                    deviceInfo, ports);

                var hops = new List<PathHop> { hop };

                if (neighborId == targetId)
                    return await BuildPathResponse(hops, deviceInfo, cancellationToken);

                queue.Enqueue((neighborId, hops));
            }
        }

        // BFS 主循环
        while (queue.Count > 0)
        {
            var (currentId, currentHops) = queue.Dequeue();

            if (currentHops.Count >= 10)
                continue;

            if (!serverToPorts.TryGetValue(currentId, out var curPorts))
                continue;

            var candidates = new List<(Port Port, Cable Cable, Guid NeighborPortId, Guid NeighborId)>();
            foreach (var port in curPorts)
            {
                if (!portAdjacency.TryGetValue(port.Id, out var edges))
                    continue;
                foreach (var (cable, neighborPortId) in edges)
                {
                    var neighborId = portToServer.GetValueOrDefault(neighborPortId);
                    if (neighborId == Guid.Empty || neighborId == currentId)
                        continue;
                    candidates.Add((port, cable, neighborPortId, neighborId));
                }
            }

            foreach (var (port, cable, neighborPortId, neighborId) in
                candidates.OrderBy(c => c.NeighborId).ThenBy(c => c.Port.Id).ThenBy(c => c.Cable.Id))
            {
                if (neighborId != targetId && !IsNetworkDevice(deviceInfo[neighborId].DeviceType))
                    continue;

                if (!visited.Add(neighborId))
                    continue;

                var hop = CreateHop(
                    currentId, port.Id, cable, neighborId, neighborPortId,
                    deviceInfo, ports);

                var newHops = new List<PathHop>(currentHops) { hop };

                if (neighborId == targetId)
                    return await BuildPathResponse(newHops, deviceInfo, cancellationToken);

                queue.Enqueue((neighborId, newHops));
            }
        }

        // 无路径
        return Ok(new NetworkPathResponse(
            false,
            "已登记连接拓扑示意，不代表实时数据包路由",
            "未找到已登记的连接路径",
            null,
            null));
    }

    private static PathHop CreateHop(
        Guid fromDeviceId, Guid fromPortId, Cable cable,
        Guid toDeviceId, Guid toPortId,
        Dictionary<Guid, DeviceInfo> deviceInfo, List<Port> ports)
    {
        var fromPort = ports.First(p => p.Id == fromPortId);
        var toPort = ports.First(p => p.Id == toPortId);

        return new PathHop(
            fromDeviceId,
            deviceInfo[fromDeviceId].Name,
            fromPortId,
            fromPort.PortName,
            cable.Id,
            cable.CableType,
            toDeviceId,
            deviceInfo[toDeviceId].Name,
            toPortId,
            toPort.PortName);
    }

    private async Task<IActionResult> BuildPathResponse(
        List<PathHop> hops,
        Dictionary<Guid, DeviceInfo> deviceInfo,
        CancellationToken cancellationToken)
    {
        // 收集所有涉及的设备 ID
        var deviceIds = new HashSet<Guid>();
        foreach (var hop in hops)
        {
            deviceIds.Add(hop.FromDeviceId);
            deviceIds.Add(hop.ToDeviceId);
        }

        // 查询 rackCode
        var rackCodes = await dbContext.ServerPositions
            .AsNoTracking()
            .Where(sp => deviceIds.Contains(sp.ServerId) && sp.Status == "在架")
            .Select(sp => new { sp.ServerId, sp.Rack.Code })
            .ToDictionaryAsync(sp => sp.ServerId, sp => sp.Code, cancellationToken);

        // 构建设备路径
        var devices = new List<PathDevice>();
        if (hops.Count > 0)
        {
            var firstHop = hops[0];
            devices.Add(MakeDevice(firstHop.FromDeviceId, deviceInfo, rackCodes));

            foreach (var hop in hops)
                devices.Add(MakeDevice(hop.ToDeviceId, deviceInfo, rackCodes));
        }

        return Ok(new NetworkPathResponse(
            true,
            "已登记连接拓扑示意，不代表实时数据包路由",
            null,
            devices,
            hops));
    }

    private static PathDevice MakeDevice(
        Guid deviceId,
        Dictionary<Guid, DeviceInfo> deviceInfo,
        Dictionary<Guid, string> rackCodes)
    {
        var info = deviceInfo[deviceId];
        return new PathDevice(
            deviceId,
            info.Name,
            info.DeviceType,
            rackCodes.GetValueOrDefault(deviceId));
    }

    private static bool IsNetworkDevice(string deviceType) =>
        !string.IsNullOrWhiteSpace(deviceType)
        && NetworkDeviceKeywords.Any(k => deviceType.Contains(k, StringComparison.OrdinalIgnoreCase));

    private sealed record DeviceInfo(string Name, string DeviceType);
}

public sealed record PathDevice(
    Guid DeviceId,
    string DeviceName,
    string DeviceType,
    string? RackCode);

public sealed record PathHop(
    Guid FromDeviceId,
    string FromDeviceName,
    Guid FromPortId,
    string FromPortName,
    Guid CableId,
    string CableType,
    Guid ToDeviceId,
    string ToDeviceName,
    Guid ToPortId,
    string ToPortName);

public sealed record NetworkPathResponse(
    bool PathFound,
    string Warning,
    string? Reason,
    IReadOnlyList<PathDevice>? Devices,
    IReadOnlyList<PathHop>? Hops);
