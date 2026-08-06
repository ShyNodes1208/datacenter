# 交换机端口连接抽屉

## 目标

在机柜正视图（RackDeviceView）中，点击网络设备（交换机/路由器）弹出抽屉，只读展示该设备所有端口及线缆连接关系。

## 关联任务

| # | 层级 | 文件 | 说明 |
|---|---|---|---|
| 3 | 后端 | `src/backend/Datacenter.Api/Controllers/PortsController.cs` | List 接口补充字段 |
| 4 | 前端 | `src/frontend/src/components/RackFrontPanel.vue` | 区分网络设备 + 端口图标 |
| 5 | 前端 | `src/frontend/src/components/SwitchPortDrawer.vue` | **新增** 抽屉组件 |
| 6 | 前端 | `src/frontend/src/views/RackDeviceView.vue` | 集成抽屉逻辑 |

---

## Task 3: 后端 PortsController List 接口补充字段

### 文件

`src/backend/Datacenter.Api/Controllers/PortsController.cs`

### 改动

在 `List` 方法的 `Select` 投影中补充以下字段：

- `CableType` — 线缆类型（铜缆/光纤/DAC），未连接时为 null
- `ConnectedToRackCode` — 对端设备所在机柜编号，未连接时为 null

### 实现要点

```csharp
CableType = dbContext.Cables
    .Where(c => c.SourcePortId == p.Id || c.TargetPortId == p.Id)
    .Select(c => c.CableType)
    .FirstOrDefault(),
ConnectedToRackCode = dbContext.Cables
    .Where(c => c.SourcePortId == p.Id)
    .Select(c => c.TargetPort.Server.ServerPositions
        .Where(sp => sp.Status == "在架")
        .Select(sp => sp.Rack.Code)
        .FirstOrDefault())
    .FirstOrDefault()
    ?? dbContext.Cables
    .Where(c => c.TargetPortId == p.Id)
    .Select(c => c.SourcePort.Server.ServerPositions
        .Where(sp => sp.Status == "在架")
        .Select(sp => sp.Rack.Code)
        .FirstOrDefault())
    .FirstOrDefault(),
```

注意：`ServerPositions` 是 Server 的导航属性，需要通过 `Server.ServerPositions` 访问（已在 AppDbContext 中配置）。

### 验收

调用 `GET /api/servers/{serverId}/ports`，返回 JSON 中包含 `cableType` 和 `connectedToRackCode` 字段。

---

## Task 4: RackFrontPanel 区分网络设备 + 端口图标

### 文件

`src/frontend/src/components/RackFrontPanel.vue`

### 改动

1. **判断网络设备**：参考 `src/frontend/src/utils/deviceColors.ts` 中的关键词列表（交换/switch/路由/router/网络/network），判断 `deviceType` 是否匹配

2. **设备块右侧加图标**：在已占用 U 位块的右上角，如果是网络设备，显示 🔌 图标（或 SVG 网口图标），`title` 属性为「查看端口连接」

3. **新增 emit 事件**：
```ts
emit('port-view-click', serverId: string)
```

4. **点击图标触发**：`@click.stop` 触发 `port-view-click`，不触发原有的 `server-click`

5. **图标样式**：小尺寸（12-14px），网络设备色块的右上角，颜色与设备文字对比度足够即可

### 验收

- 网络设备 U 位块右侧出现端口图标
- hover 显示「查看端口连接」tooltip
- 点击图标 emit `port-view-click` 事件
- 普通服务器不显示图标，点击仍跳转详情

---

## Task 5: 新增 SwitchPortDrawer 抽屉组件

### 文件

`src/frontend/src/components/SwitchPortDrawer.vue`（新建）

### Props

```ts
defineProps<{
  visible: boolean
  deviceName: string          // 交换机名称
  deviceId: string            // 交换机 ServerId
  ports: SwitchPortItem[]     // 端口列表
  loading: boolean
  error: string
}>()

interface SwitchPortItem {
  id: string
  portName: string
  portType: string
  speed: string | null
  cableType: string | null             // 线缆类型，null = 未连接
  connectedToServerName: string | null // 对端设备名
  connectedToServerId: string | null   // 对端设备 ID
  connectedToPortName: string | null   // 对端端口名
  connectedToRackCode: string | null   // 对端机柜编号
}
```

### Emits

```ts
emit('close')              // 关闭抽屉
emit('navigate', serverId: string)  // 跳转到对端设备详情
```

### 模板结构

```
┌─────────────────────────────────────┐
│  [设备名] 端口连接              [✕] │
├─────────────────────────────────────┤
│ 端口名  类型  速率  对端设备  对端端口  线缆类型  所在机柜 │
│ G1/0/1  SFP+  10G   Web-01    eth0    光纤     A01  │
│ G1/0/2  RJ45  1G    —         —        —        —    │
│ G1/0/3  SFP+  10G   DB-01     eth1     DAC      B03  │
│ ...                                                 │
├─────────────────────────────────────┤
│                         [关闭]      │
└─────────────────────────────────────┘
```

### 状态处理

| 状态 | 显示 |
|---|---|
| `loading` | 加载中... |
| `error` | 红色提示错误信息 |
| `ports` 为空 | 「该设备暂无端口定义」+ 「去添加端口 →」链接跳转到 `/servers/${deviceId}` |
| 端口未连接 | 对端设备/端口/线缆/机柜列显示 `—`（灰色） |
| 端口已连接 | 对端设备名可点击，触发 `navigate` 事件 |

### 样式

- 使用 `RackOperationDrawer.vue` 相同的 drawer-overlay/drawer 结构
- 表格使用 `.data-table` 样式类（与 `CableListView.vue` 一致）
- 线缆类型列用小色块标签（铜缆=#e67e22, 光纤=#f1c40f, DAC=#3498db 与项目现有配色一致）

### 验收

- 抽屉打开/关闭动画正常
- 端口表格正确渲染
- 已连接/未连接行区分明显
- 对端设备名可点击跳转
- 空状态引导链接正确
- 加载态和错误态正常

---

## Task 6: RackDeviceView 集成抽屉逻辑

### 文件

`src/frontend/src/views/RackDeviceView.vue`

### 改动

1. **引入抽屉组件**：
```ts
import SwitchPortDrawer from '../components/SwitchPortDrawer.vue'
```

2. **新增状态变量**：
```ts
const switchDrawerVisible = ref(false)
const switchDrawerDeviceName = ref('')
const switchDrawerDeviceId = ref('')
const switchPorts = ref<SwitchPortItem[]>([])
const switchPortsLoading = ref(false)
const switchPortsError = ref('')
```

3. **判断网络设备的函数**（与 RackFrontPanel 共用逻辑，可提取到 utils）：
```ts
function isNetworkDevice(deviceType: string | undefined): boolean {
  if (!deviceType) return false
  const t = deviceType.toLowerCase()
  return ['交换', 'switch', '路由', 'router', '网络', 'network'].some(k => t.includes(k))
}
```

4. **监听 `port-view-click` 事件**：在 `<RackFrontPanel>` 上绑定 `@port-view-click="openSwitchDrawer"`

5. **`openSwitchDrawer` 函数**：
```ts
async function openSwitchDrawer(serverId: string): void {
  switchDrawerVisible.value = true
  switchDrawerDeviceId.value = serverId
  switchPortsLoading.value = true
  switchPortsError.value = ''
  switchPorts.value = []

  // 先从本地 uSlots 找设备名（立即显示），数据已在内存中
  const slot = uSlots.value.find(s => s.serverId === serverId)
  switchDrawerDeviceName.value = slot?.serverName ?? ''

  const result = await request<unknown>(`/api/servers/${serverId}/ports`, { method: 'GET' })
  switchPortsLoading.value = false

  if (!result.ok) {
    switchPortsError.value = result.error
    return
  }
  if (!Array.isArray(result.data)) {
    switchPortsError.value = 'Request failed.'
    return
  }
  switchPorts.value = result.data.map(parseSwitchPortItem).filter(Boolean) as SwitchPortItem[]
}
```

6. **`parseSwitchPortItem` 解析函数**：校验并映射后端返回的每个字段

7. **`handleNavigate` 函数**：关闭抽屉 → `router.push(/servers/${id})`

8. **模板**：在 `</template>` 前添加抽屉组件实例

### 验收

- 点击网络设备的端口图标 → 抽屉弹出，显示端口列表
- 抽屉标题显示设备名称
- 点击对端设备名 → 关闭抽屉 → 跳转到详情页
- 关闭按钮/点击遮罩 → 抽屉关闭
