# Task 3 + Task 4: FloorplanCanvas 机柜高亮 + 前端集成

## 概述

Task 3 和 Task 4 互不依赖，但都依赖于已完成的 Task 1 (NetworkPathController) 和 Task 2 (NetworkPathDrawer)。

---

## Task 3 — FloorplanCanvas 机柜高亮

**文件:** `src/frontend/src/components/FloorplanCanvas.vue`

### 3.1 新增 prop

在 props 定义中新增 (第 25-33 行附近):

```ts
highlightedRackIds?: string[]
```

当前 props 没有用 `withDefaults`，直接加可选属性即可。

### 3.2 renderRacks() 中机柜高亮 (第 249 行开始)

在 `renderRacks()` 函数中，`const rect = new Konva.Rect({...})` 创建后 (当前约第 268-272 行)，添加高亮判断:

```ts
const isHighlighted = (props.highlightedRackIds ?? []).includes(rack.id)
if (isHighlighted) {
  rect.stroke('#e74c3c')
  rect.strokeWidth(3)
  rect.shadowColor('#e74c3c')
  rect.shadowBlur(8)
  rect.shadowEnabled(true)
}
```

注意：这段代码需要放在 `rect` 变量创建之后、`group.add(rect, ...)` 之前。

### 3.3 drawCables() 中 cable 高亮 (第 143 行开始)

在 `drawCables()` 函数中，`const line = new Konva.Line({...})` 创建后 (当前约第 155-160 行)，添加:

```ts
const highlightIds = props.highlightedRackIds ?? []
if (highlightIds.length > 0 && highlightIds.includes(link.source.rackId) && highlightIds.includes(link.target.rackId)) {
  line.stroke('#e74c3c')
  line.strokeWidth(5)
  line.opacity(0.6)
}
```

注意：两端都在高亮机柜内的 cable 才高亮。这段需要放在 `line` 创建之后、`cableLayer.add(line, tooltip)` 之前（当前约第 172 行）。

### 3.4 watch 触发重绘

在现有 `watch` 区域（约第 427-429 行附近）新增:

```ts
watch(() => props.highlightedRackIds, () => {
  renderRacks()
  drawCables()
})
```

### 3.5 验收

- `highlightedRackIds` 为空或 undefined 时，不影响现有渲染
- 传入 rack.id 后，对应机柜出现红色边框+发光阴影
- 两端都在高亮机柜内的 cable 加粗变红

---

## Task 4 — 前端集成

涉及两个文件:
- `src/frontend/src/views/RackDeviceView.vue`
- `src/frontend/src/views/FloorplanView.vue`

---

### 4a. RackDeviceView.vue

#### 引入组件

在 `<script setup>` 顶部 import 区域添加:

```ts
import NetworkPathDrawer, { type NetworkPathResult } from '../components/NetworkPathDrawer.vue'
```

#### 新增状态变量

在现有的 `ref` 变量区域添加:

```ts
const networkPathVisible = ref(false)
const networkPathLoading = ref(false)
const networkPathError = ref('')
const networkPathResult = ref<NetworkPathResult | null>(null)
```

#### 搜索函数

```ts
async function handleNetworkPathSearch(sourceId: string, targetId: string): Promise<void> {
  networkPathLoading.value = true
  networkPathError.value = ''
  networkPathResult.value = null
  const result = await request<NetworkPathResult>(
    `/api/network-path?sourceId=${sourceId}&targetId=${targetId}`,
    { method: 'GET' },
  )
  networkPathLoading.value = false
  if (!result.ok) {
    networkPathError.value = result.error
    return
  }
  networkPathResult.value = result.data
}
```

#### 工具栏按钮

在 `toolbar__actions` div 内（第 666 行附近），第一个按钮前添加:

```html
<button type="button" class="btn" @click="networkPathVisible = true">连接路径查询</button>
```

#### 模板中挂载抽屉

在 `</div>` 关闭 rack-page 之前（即 `</template>` 前）添加:

```html
<NetworkPathDrawer
  :visible="networkPathVisible"
  :loading="networkPathLoading"
  :error="networkPathError"
  :path-result="networkPathResult"
  @close="networkPathVisible = false"
  @search="handleNetworkPathSearch"
/>
```

---

### 4b. FloorplanView.vue

#### 引入组件

在 `<script setup>` 顶部 import 区域添加:

```ts
import NetworkPathDrawer, { type NetworkPathResult } from '../components/NetworkPathDrawer.vue'
```

#### 新增状态

在现有的 `ref` 变量区域添加:

```ts
const networkPathVisible = ref(false)
const networkPathLoading = ref(false)
const networkPathError = ref('')
const networkPathResult = ref<NetworkPathResult | null>(null)
const highlightedRackIds = ref<string[]>([])
```

#### 搜索函数

```ts
async function handleNetworkPathSearch(sourceId: string, targetId: string): Promise<void> {
  networkPathLoading.value = true
  networkPathError.value = ''
  networkPathResult.value = null
  const result = await request<NetworkPathResult>(
    `/api/network-path?sourceId=${sourceId}&targetId=${targetId}`,
    { method: 'GET' },
  )
  networkPathLoading.value = false
  if (!result.ok) {
    networkPathError.value = result.error
    return
  }
  networkPathResult.value = result.data
  // 提取高亮机柜 rackId
  if (result.data?.pathFound && result.data?.devices) {
    const ids: string[] = []
    for (const d of result.data.devices) {
      if (d.rackCode) {
        const rack = racks.value.find(r => r.code === d.rackCode)
        if (rack) ids.push(rack.id)
      }
    }
    highlightedRackIds.value = ids
  }
}
```

#### 工具栏按钮

在 `toolbar-center` div 内（第 8 行附近），添加一个查询按钮:

```html
<button type="button" class="btn btn--small" @click="networkPathVisible = true">连接路径查询</button>
```

可以放在 mode-toggle 前面或后面，用 `btn--muted` 样式与现有按钮风格一致。

#### FloorplanCanvas 传递高亮 prop

在 `<FloorplanCanvas>` 组件上（第 30-43 行）添加:

```html
:highlighted-rack-ids="highlightedRackIds"
```

#### 模板中挂载抽屉

在 `</div>` 关闭 floorplan-page 之前添加:

```html
<NetworkPathDrawer
  :visible="networkPathVisible"
  :loading="networkPathLoading"
  :error="networkPathError"
  :path-result="networkPathResult"
  @close="networkPathVisible = false; highlightedRackIds = []"
  @search="handleNetworkPathSearch"
/>
```

注意：`@close` 时要同时清空 `highlightedRackIds`，因为关抽屉后不应保留高亮。

---

## 关键注意

1. RoomDeviceView 中 `request` 来自 `useApi()` composable，该 view 已经在使用（参考 `openSwitchDrawer` 中的用法），无需重复引入
2. RoomplanView 中已有 `const { request } = useApi()`（约第 82 行），直接使用即可
3. FloorplanView 中的 rackCode→rackId 映射依赖 `racks.value`，这个数据来自 `useFloorplan` composable
4. 两个 view 的 `handleNetworkPathSearch` 函数逻辑基本相同，不需要抽取共享（保持简单）

---

## 验收

1. RackDeviceView: 工具栏出现"连接路径查询"按钮 → 点击打开抽屉 → 选择设备 → 查询 → 显示路径
2. FloorplanView: 工具栏出现"连接路径查询"按钮 → 点击打开抽屉 → 查询成功 → 平面图相关机柜红色高亮 + 中间 cable 加粗变红
3. 关闭抽屉后平面图高亮消失
4. 无路径时正常显示提示，不影响高亮
