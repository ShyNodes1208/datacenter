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

    [HttpGet("network-path/by-port")]
    public async Task<IActionResult> FindPathByPort(
        [FromQuery] Guid sourcePortId,
        [FromQuery] Guid targetServerId,
        CancellationToken cancellationToken)
    {
        if (sourcePortId == Guid.Empty || targetServerId == Guid.Empty)
            return BadRequest(new { error = "起点端口和目标设备不能为空" });

        var topology = await LoadNetworkTopologyAsync(cancellationToken);
        if (!topology.PortToServer.TryGetValue(sourcePortId, out var sourceServerId))
            return NotFound(new { error = "起点端口不存在" });

        if (!topology.DeviceInfo.ContainsKey(targetServerId))
            return NotFound(new { error = "目标设备不存在" });

        if (sourceServerId == targetServerId)
            return BadRequest(new { error = "起点端口所属设备和目标设备不能相同" });

        var queue = new Queue<(Guid DeviceId, List<PathHop> Hops)>();
        var visitedDevices = new HashSet<Guid> { sourceServerId };

        foreach (var candidate in GetOrderedCandidates(topology, [topology.Ports.First(port => port.Id == sourcePortId)]))
        {
            if (candidate.NeighborDeviceId == sourceServerId
                || (candidate.NeighborDeviceId != targetServerId
                    && !IsNetworkDevice(topology.DeviceInfo[candidate.NeighborDeviceId].DeviceType))
                || !visitedDevices.Add(candidate.NeighborDeviceId))
            {
                continue;
            }

            var hops = new List<PathHop>
            {
                CreateHop(
                    sourceServerId,
                    candidate.FromPort.Id,
                    candidate.Cable,
                    candidate.NeighborDeviceId,
                    candidate.NeighborPortId,
                    topology.DeviceInfo,
                    topology.Ports)
            };

            if (candidate.NeighborDeviceId == targetServerId)
                return await BuildPathResponse(hops, topology.DeviceInfo, cancellationToken);

            queue.Enqueue((candidate.NeighborDeviceId, hops));
        }

        while (queue.Count > 0)
        {
            var (currentDeviceId, currentHops) = queue.Dequeue();
            if (currentHops.Count >= 10 || !topology.ServerToPorts.TryGetValue(currentDeviceId, out var currentPorts))
                continue;

            foreach (var candidate in GetOrderedCandidates(topology, currentPorts))
            {
                if (candidate.NeighborDeviceId == currentDeviceId
                    || (candidate.NeighborDeviceId != targetServerId
                        && !IsNetworkDevice(topology.DeviceInfo[candidate.NeighborDeviceId].DeviceType))
                    || !visitedDevices.Add(candidate.NeighborDeviceId))
                {
                    continue;
                }

                var hops = new List<PathHop>(currentHops)
                {
                    CreateHop(
                        currentDeviceId,
                        candidate.FromPort.Id,
                        candidate.Cable,
                        candidate.NeighborDeviceId,
                        candidate.NeighborPortId,
                        topology.DeviceInfo,
                        topology.Ports)
                };

                if (candidate.NeighborDeviceId == targetServerId)
                    return await BuildPathResponse(hops, topology.DeviceInfo, cancellationToken);

                queue.Enqueue((candidate.NeighborDeviceId, hops));
            }
        }

        return Ok(new NetworkPathResponse(
            false,
            "已登记连接拓扑示意，不代表实时数据包路由",
            "未找到已登记的连接路径",
            null,
            null));
    }

    [HttpGet("network-path/reachable")]
    public async Task<IActionResult> FindReachable(
        [FromQuery] Guid sourcePortId,
        [FromQuery] int maxHops = 4,
        [FromQuery] int limit = 100,
        CancellationToken cancellationToken = default)
    {
        if (sourcePortId == Guid.Empty)
            return BadRequest(new { error = "起点端口不能为空" });

        if (maxHops is < 1 or > 10)
            return BadRequest(new { error = "最大跳数必须在 1 到 10 之间" });

        var topology = await LoadNetworkTopologyAsync(cancellationToken);
        if (!topology.PortToServer.TryGetValue(sourcePortId, out var sourceServerId))
            return NotFound(new { error = "起点端口不存在" });

        var endpoints = new Dictionary<Guid, ReachableEndpoint>();
        var visitedNetworkDevices = new HashSet<Guid> { sourceServerId };
        var queue = new Queue<(Guid DeviceId, int HopCount)>();

        void ProcessCandidate(PathCandidate candidate, int hopCount)
        {
            if (candidate.NeighborDeviceId == sourceServerId)
                return;

            var neighbor = topology.DeviceInfo[candidate.NeighborDeviceId];
            if (!IsNetworkDevice(neighbor.DeviceType))
            {
                endpoints.TryAdd(candidate.NeighborPortId, new ReachableEndpoint(
                    candidate.NeighborDeviceId,
                    neighbor.Name,
                    neighbor.DeviceType,
                    null,
                    candidate.NeighborPortId,
                    topology.Ports.First(port => port.Id == candidate.NeighborPortId).PortName,
                    hopCount));
                return;
            }

            if (hopCount < maxHops && visitedNetworkDevices.Add(candidate.NeighborDeviceId))
                queue.Enqueue((candidate.NeighborDeviceId, hopCount));
        }

        foreach (var candidate in GetOrderedCandidates(topology, [topology.Ports.First(port => port.Id == sourcePortId)]))
            ProcessCandidate(candidate, 1);

        while (queue.Count > 0)
        {
            var (currentDeviceId, currentHopCount) = queue.Dequeue();
            if (!topology.ServerToPorts.TryGetValue(currentDeviceId, out var currentPorts))
                continue;

            foreach (var candidate in GetOrderedCandidates(topology, currentPorts))
                ProcessCandidate(candidate, currentHopCount + 1);
        }

        var rackCodes = await LoadRackCodesAsync(endpoints.Values.Select(endpoint => endpoint.DeviceId), cancellationToken);
        var orderedEndpoints = endpoints.Values
            .Select(endpoint => endpoint with { RackCode = rackCodes.GetValueOrDefault(endpoint.DeviceId) })
            .OrderBy(endpoint => endpoint.HopCount)
            .ThenBy(endpoint => endpoint.DeviceId)
            .ThenBy(endpoint => endpoint.PortId)
            .ToList();
        var returnedEndpoints = orderedEndpoints.Take(100).ToList();
        _ = limit;

        return Ok(new ReachableNetworkPathResponse(
            "已登记连接拓扑示意，不代表实时数据包路由",
            maxHops,
            orderedEndpoints.Count,
            returnedEndpoints.Count,
            orderedEndpoints.Count > returnedEndpoints.Count,
            returnedEndpoints));
    }

    private async Task<NetworkTopology> LoadNetworkTopologyAsync(CancellationToken cancellationToken)
    {
        var deviceInfo = await dbContext.Servers
            .AsNoTracking()
            .ToDictionaryAsync(server => server.Id, server => new DeviceInfo(server.Name, server.DeviceType), cancellationToken);
        var ports = await dbContext.Ports.AsNoTracking().ToListAsync(cancellationToken);
        var cables = await dbContext.Cables
            .AsNoTracking()
            .OrderBy(cable => cable.Id)
            .ToListAsync(cancellationToken);
        var portAdjacency = new Dictionary<Guid, List<(Cable Cable, Guid NeighborPortId)>>();

        foreach (var cable in cables)
        {
            if (!portAdjacency.TryGetValue(cable.SourcePortId, out var sourceEdges))
                portAdjacency[cable.SourcePortId] = sourceEdges = [];
            sourceEdges.Add((cable, cable.TargetPortId));

            if (!portAdjacency.TryGetValue(cable.TargetPortId, out var targetEdges))
                portAdjacency[cable.TargetPortId] = targetEdges = [];
            targetEdges.Add((cable, cable.SourcePortId));
        }

        var portToServer = ports.ToDictionary(port => port.Id, port => port.ServerId);
        var serverToPorts = ports
            .GroupBy(port => port.ServerId)
            .ToDictionary(group => group.Key, group => group.OrderBy(port => port.Id).ToList());

        return new NetworkTopology(deviceInfo, ports, portToServer, serverToPorts, portAdjacency);
    }

    private static IReadOnlyList<PathCandidate> GetOrderedCandidates(
        NetworkTopology topology,
        IEnumerable<Port> ports)
    {
        var candidates = new List<PathCandidate>();
        foreach (var port in ports)
        {
            if (!topology.PortAdjacency.TryGetValue(port.Id, out var edges))
                continue;

            foreach (var (cable, neighborPortId) in edges)
            {
                if (!topology.PortToServer.TryGetValue(neighborPortId, out var neighborDeviceId)
                    || !topology.DeviceInfo.ContainsKey(neighborDeviceId))
                {
                    continue;
                }

                candidates.Add(new PathCandidate(port, cable, neighborPortId, neighborDeviceId));
            }
        }

        return candidates
            .OrderBy(candidate => candidate.NeighborDeviceId)
            .ThenBy(candidate => candidate.FromPort.Id)
            .ThenBy(candidate => candidate.Cable.Id)
            .ToList();
    }

    private async Task<Dictionary<Guid, string>> LoadRackCodesAsync(
        IEnumerable<Guid> deviceIds,
        CancellationToken cancellationToken)
    {
        var ids = deviceIds.Distinct().ToList();
        return await dbContext.ServerPositions
            .AsNoTracking()
            .Where(position => ids.Contains(position.ServerId) && position.Status == "在架")
            .Select(position => new { position.ServerId, position.Rack.Code })
            .ToDictionaryAsync(position => position.ServerId, position => position.Code, cancellationToken);
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

    private sealed record NetworkTopology(
        Dictionary<Guid, DeviceInfo> DeviceInfo,
        List<Port> Ports,
        Dictionary<Guid, Guid> PortToServer,
        Dictionary<Guid, List<Port>> ServerToPorts,
        Dictionary<Guid, List<(Cable Cable, Guid NeighborPortId)>> PortAdjacency);

    private sealed record PathCandidate(Port FromPort, Cable Cable, Guid NeighborPortId, Guid NeighborDeviceId);
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

public sealed record ReachableEndpoint(
    Guid DeviceId,
    string DeviceName,
    string DeviceType,
    string? RackCode,
    Guid PortId,
    string PortName,
    int HopCount);

public sealed record ReachableNetworkPathResponse(
    string Warning,
    int MaxHops,
    int TotalEndpointCount,
    int ReturnedEndpointCount,
    bool IsTruncated,
    IReadOnlyList<ReachableEndpoint> Endpoints);
