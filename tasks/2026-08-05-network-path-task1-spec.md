# Task 1: NetworkPathController — 可直接复制的完整代码

## 文件

`src/backend/Datacenter.Api/Controllers/NetworkPathController.cs`（新建）

## 完整代码（直接复制整个文件）

```csharp
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
            .ToDictionary(g => g.Key, g => g.ToList());

        // 6. BFS（按 cableId 排序保证确定性）
        var sourceHops = new List<PathHop>();
        var queue = new Queue<(Guid ServerId, List<PathHop> Hops)>();
        var visited = new HashSet<Guid> { sourceId };

        // 初始化：从 source 出发探索第一跳
        if (serverToPorts.TryGetValue(sourceId, out var srcPorts))
        {
            foreach (var port in srcPorts)
            {
                if (!portAdjacency.TryGetValue(port.Id, out var edges))
                    continue;

                foreach (var (cable, neighborPortId) in edges.OrderBy(e => e.Cable.Id))
                {
                    var neighborId = portToServer.GetValueOrDefault(neighborPortId);
                    if (neighborId == Guid.Empty || neighborId == sourceId)
                        continue;

                    // 中间节点必须是网络设备（除非直达 target）
                    if (neighborId != targetId && !IsNetworkDevice(deviceInfo[neighborId].DeviceType))
                        continue;

                    if (!visited.Add(neighborId))
                        continue;

                    var neighborPortName = ports.First(p => p.Id == neighborPortId).PortName;
                    var hop = CreateHop(
                        sourceId, port.Id, cable, neighborId, neighborPortId,
                        deviceInfo, ports);

                    var hops = new List<PathHop> { hop };

                    if (neighborId == targetId)
                        return await BuildPathResponse(hops, deviceInfo, cancellationToken);

                    queue.Enqueue((neighborId, hops));
                }
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

            foreach (var port in curPorts)
            {
                if (!portAdjacency.TryGetValue(port.Id, out var edges))
                    continue;

                foreach (var (cable, neighborPortId) in edges.OrderBy(e => e.Cable.Id))
                {
                    var neighborId = portToServer.GetValueOrDefault(neighborPortId);
                    if (neighborId == Guid.Empty || neighborId == currentId)
                        continue;

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

// --- 响应 DTO（放在 namespace 外面，file-scoped 也可以） ---

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
```

## 关键决策说明

| 决策 | 原因 |
|------|------|
| `DeviceInfo` 一次性加载到 Dictionary | BFS 中 O(1) 取设备名，避免 N+1 查询 |
| 端口名用 `ports.First(p => p.Id == id)` | 端口数据已在内存，避免二次 DB 查询。如果端口量大，Cursor 可改为 `ports.ToDictionary(p => p.Id)` |
| `cables.OrderBy(c => c.Id)` | 保证 BFS 确定性的关键 |
| `edges.OrderBy(e => e.Cable.Id)` | 同层遍历按 cableId 排序 |
| RackCode 在 BuildResponse 中异步查询 | BFS 纯内存不阻塞，最后统一查 rackCode |
| 不注入 `IAntiforgery` | 只读 GET，不需要防伪令牌 |
| `[Authorize]` 不加角色检查 | 所有认证用户可访问此端点 |

## 验证

```bash
cd src/backend/Datacenter.Api
dotnet build

# 如果 build 成功，启动后端测试
# 1. 找有连接的设备
curl -s "http://localhost:5142/api/servers" | jq '.[0]'

# 2. 查端口连接
curl -s "http://localhost:5142/api/servers/{id}/ports" | jq '.[] | select(.connectedCableId != null)'

# 3. 测试路径
curl -s "http://localhost:5142/api/network-path?sourceId={sourceId}&targetId={targetId}" | jq '.'

# 4. 同设备 (400)
curl -s "http://localhost:5142/api/network-path?sourceId={id}&targetId={id}"
```
