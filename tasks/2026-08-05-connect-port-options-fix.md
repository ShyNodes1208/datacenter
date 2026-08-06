# 修复: 端口连接目标选择弹窗加载卡死

**优先级:** HIGH — 用户可见功能阻塞

## 问题

`ServerDetailView.vue` 的 `loadConnectPortOptions()` 使用 N+1 查询模式：
先请求 `/api/servers`（295 台），然后逐台请求 `/api/servers/{id}/ports`。
**296 次串行 API 调用，耗时 ~15 秒。** 弹窗虽然立即渲染，但下拉框长时间为空，
用户感知为"弹窗不工作"。

## 修复方案

新增一个后端端点，一次查询返回所有未连接端口。前端改为单次调用。

### 步骤 1: 后端 — 新增 `GET /api/ports/available`

**文件:** `src/backend/Datacenter.Api/Controllers/PortsController.cs`

在 `List` 方法之后（第 83 行之后）插入新方法：

```csharp
[HttpGet("ports/available")]
public async Task<IActionResult> Available(CancellationToken cancellationToken)
{
    var ports = await dbContext.Ports
        .AsNoTracking()
        .Where(p => !dbContext.Cables.Any(c => c.SourcePortId == p.Id || c.TargetPortId == p.Id))
        .Select(p => new
        {
            p.Id,
            p.PortName,
            ServerName = p.Server.Name,
            p.Server.DeviceType,
            RackCode = dbContext.ServerPositions
                .Where(sp => sp.ServerId == p.ServerId && sp.Status == "在架")
                .Select(sp => sp.Rack.Code)
                .FirstOrDefault()
        })
        .ToListAsync(cancellationToken);

    return Ok(ports);
}
```

⚠ 放对位置：在 `List` 方法的花括号 `}` 之后、`CreatePortRequest` 记录定义之前。

### 步骤 2: 前端 — 替换 N+1 查询

**文件:** `src/frontend/src/views/ServerDetailView.vue`

替换 `loadConnectPortOptions()` 函数（第 304-330 行）。

将：
```typescript
async function loadConnectPortOptions(): Promise<void> {
  const serversResult = await request<unknown>('/api/servers', { method: 'GET' })
  if (!serversResult.ok || !Array.isArray(serversResult.data)) return

  const options: ConnectPortOption[] = []
  for (const serverItem of serversResult.data) {
    if (serverItem === null || typeof serverItem !== 'object') continue
    const s = serverItem as Record<string, unknown>
    if (typeof s.id !== 'string' || typeof s.name !== 'string') continue

    const portsResult = await request<unknown>(`/api/servers/${s.id}/ports`, { method: 'GET' })
    if (!portsResult.ok || !Array.isArray(portsResult.data)) continue

    for (const port of portsResult.data) {
      if (port === null || typeof port !== 'object') continue
      const p = port as Record<string, unknown>
      if (typeof p.id !== 'string' || typeof p.portName !== 'string') continue
      if (parseOptionalGuid(p.connectedCableId)) continue
      if (p.id === connectSourcePortId.value) continue
      options.push({
        id: p.id,
        label: `${s.name} / ${p.portName}`,
      })
    }
  }
  connectPortOptions.value = options
}
```

改为：
```typescript
async function loadConnectPortOptions(): Promise<void> {
  const result = await request<unknown>('/api/ports/available', { method: 'GET' })
  if (!result.ok || !Array.isArray(result.data)) return

  const options: ConnectPortOption[] = []
  for (const item of result.data) {
    if (item === null || typeof item !== 'object') continue
    const p = item as Record<string, unknown>
    if (typeof p.id !== 'string' || typeof p.portName !== 'string' || typeof p.serverName !== 'string') continue
    if (p.id === connectSourcePortId.value) continue
    const rack = typeof p.rackCode === 'string' ? p.rackCode : null
    const rackHint = rack ? ` [${rack}]` : ''
    options.push({
      id: p.id,
      label: `${p.serverName} / ${p.portName}${rackHint}`,
    })
  }
  connectPortOptions.value = options
}
```

### 步骤 3（可选增强）: 添加加载状态

在 `<select>` 上加一个 loading 提示，用户体验更好：

```html
<select v-model="connectTargetPortId" class="connect-select">
  <option value="">选择目标端口</option>
  <option v-for="opt in connectPortOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
</select>
```

改为：
```html
<select v-model="connectTargetPortId" class="connect-select" :disabled="connectPortOptions.length === 0">
  <option value="">{{ connectPortOptions.length === 0 ? '加载中...' : '选择目标端口' }}</option>
  <option v-for="opt in connectPortOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
</select>
```

## 改动范围

| 文件 | 改动 |
|------|------|
| `PortsController.cs` | +20 行（新增 Available 方法） |
| `ServerDetailView.vue` | 替换 `loadConnectPortOptions()`（-24 行 +20 行），可选改 `<select>` |

## 验证

```bash
# 后端
cd src/backend/Datacenter.Api && dotnet build

# 前端
cd src/frontend && npx vue-tsc --noEmit
```

功能验证：
1. 打开服务器详情 → 端口与连接
2. 点击端口旁的"连接"按钮
3. 确认"选择目标端口"下拉框在 1 秒内加载完成
4. 选择目标端口 → 选择线缆类型 → 创建连接 → 确认连接成功

---

## Codex P2 补充修复: 独立 loading 状态

**文件:** `src/frontend/src/views/ServerDetailView.vue`

### 问题

当前用 `connectPortOptions.length === 0` 判断 loading 状态，存在两个边界缺陷：
- API 返回空数组（全部端口已连接）→ select 永久显示"加载中..."且 disabled
- API 请求失败 → 同样卡死

### 修复

三步改动：

**1. 新增 `connectPortsLoading` 状态**（在第 85 行 `connectPortOptions` 附近）：

```typescript
const connectPortsLoading = ref(false)
```

**2. 在 `openConnect` 和 `loadConnectPortOptions` 中使用：**

```typescript
function openConnect(portId: string): void {
  connectSourcePortId.value = portId
  connectTargetPortId.value = ''
  connectCableType.value = '铜缆'
  connectFormError.value = ''
  connectPortOptions.value = []       // 清空旧选项
  connectPortsLoading.value = true    // 开始加载
  connectFormVisible.value = true
  void loadConnectPortOptions()
}

async function loadConnectPortOptions(): Promise<void> {
  const result = await request<unknown>('/api/ports/available', { method: 'GET' })
  connectPortsLoading.value = false   // 加载完成

  if (!result.ok || !Array.isArray(result.data)) return

  const options: ConnectPortOption[] = []
  for (const item of result.data) {
    // ... 现有逻辑不变 ...
  }
  connectPortOptions.value = options
}
```

⚠ `openConnect` 中加两行：`connectPortOptions.value = []` 清空旧数据，`connectPortsLoading.value = true` 标记加载。

⚠ `loadConnectPortOptions` 中加一行：请求返回后 `connectPortsLoading.value = false`。

**3. 模板改用 `connectPortsLoading`：**

```html
<select
  v-model="connectTargetPortId"
  class="connect-select"
  :disabled="connectPortsLoading"
>
  <option value="">
    {{ connectPortsLoading ? '加载中...' : connectPortOptions.length === 0 ? '无可用端口' : '选择目标端口' }}
  </option>
  <option v-for="opt in connectPortOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
</select>
```

三种状态明确区分：
| `connectPortsLoading` | `connectPortOptions.length` | 显示 |
|---|---|---|
| `true` | — | 加载中... (disabled) |
| `false` | `0` | 无可用端口 |
| `false` | `>0` | 选择目标端口 |

## 改动范围（汇总）

| 文件 | 改动 |
|------|------|
| `PortsController.cs` | +20 行（Available 端点） |
| `ServerDetailView.vue` | 替换 `loadConnectPortOptions()` + 新增 `connectPortsLoading` + 修改 `<select>` 模板 + try/finally 保护 |2026-08-05-connect-port-options-fix.md

---

## Codex P2 #1 补充修复: loading 状态异常保护

**文件:** `src/frontend/src/views/ServerDetailView.vue`

### 问题

`connectPortsLoading = false` 在正常流程中执行，但如果 `request()` 或其他操作抛出未捕获异常，loading 状态永久卡在 `true`，select 永远 disabled。

### 修复

将 `loadConnectPortOptions()` 的函数体用 `try/finally` 包裹：

```typescript
async function loadConnectPortOptions(): Promise<void> {
  try {
    const result = await request<unknown>('/api/ports/available', { method: 'GET' })
    connectPortsLoading.value = false

    if (!result.ok || !Array.isArray(result.data)) return

    const options: ConnectPortOption[] = []
    for (const item of result.data) {
      if (item === null || typeof item !== 'object') continue
      const p = item as Record<string, unknown>
      if (typeof p.id !== 'string' || typeof p.portName !== 'string' || typeof p.serverName !== 'string') continue
      if (p.id === connectSourcePortId.value) continue
      const rack = typeof p.rackCode === 'string' ? p.rackCode : null
      const rackHint = rack ? ` [${rack}]` : ''
      options.push({
        id: p.id,
        label: `${p.serverName} / ${p.portName}${rackHint}`,
      })
    }
    connectPortOptions.value = options
  } finally {
    connectPortsLoading.value = false
  }
}
```

改动：现有 `connectPortsLoading.value = false` 从 `try` 块内删掉（`finally` 已覆盖），其余逻辑不变。

### 验证

```bash
cd src/frontend && npx vue-tsc --noEmit
```
