# Task 8: RackDeviceView 集成

> **Assigned to:** Cursor
> **Depends on:** Task 4 (useCableScene), Task 5 (CableLayer)
> **Plan ref:** docs/superpowers/plans/2026-08-05-cable-visualization.md

## 目标

在机柜设备检查器 (RackDeviceView) 中集成设备层线路可视化。当用户选中某个交换机时，显示该设备所有连接线路。

## 文件

| 文件 | 操作 |
|------|------|
| `src/frontend/src/views/RackDeviceView.vue` | 修改 |

## Steps

### 1. 引入依赖

```typescript
import { buildCableScene, type CableFocus, type CableScene, type CableSnapshot } from '../composables/useCableScene'
import CableLayer from '../components/CableLayer.vue'
```

### 2. 添加状态

```typescript
const deviceCableFocus = ref<CableFocus | null>(null)
const deviceCableScene = ref<CableScene | null>(null)
const cableSceneLoaded = ref(false)  // 标记场景数据是否已加载
```

### 3. 加载场景数据

```typescript
async function ensureCableSceneLoaded(): Promise<void> {
  if (cableSceneLoaded.value) return
  // 从 roomId 获取（从路由或 rack 数据推算）
  const result = await request<CableSnapshot>(`/api/rooms/${roomId}/cable-scene`, { method: 'GET' })
  if (result.ok && result.data) {
    cableSceneLoaded.value = true
    // 缓存原始数据以便切换 focus 时重建
    cableSnapshotCache.value = result.data
  }
}
```

### 4. 设备聚焦方法

在选中某个设备时调用：

```typescript
function showDeviceCables(deviceId: string): void {
  deviceCableFocus.value = { level: 'device', deviceId }
  deviceCableScene.value = buildCableScene(
    cableSnapshotCache.value,
    deviceCableFocus.value,
    { purposes: [], cableTypes: [] }
  )
}
```

### 5. 端口路径追踪

在端口列表中，已连接端口可点击：

```typescript
function showPortPath(deviceId: string, portName: string): void {
  const portId = `${deviceId}:${portName}`
  deviceCableFocus.value = { level: 'port', portId }
  deviceCableScene.value = buildCableScene(
    cableSnapshotCache.value,
    deviceCableFocus.value,
    { purposes: [], cableTypes: [] }
  )
}
```

### 6. 在 SwitchPortDrawer 或端口列表中集成

- 在端口列表中识别已连接的端口
- 为已连接端口添加视觉标记（如连接图标）和点击事件
- 点击后触发 `showPortPath`，高亮该端口的连接路径

### 7. 模板中叠加 CableLayer

在机柜/设备视图的合适位置：

```html
<CableLayer
  v-if="deviceCableScene"
  :scene="deviceCableScene"
  :animation-enabled="true"
  @bundle-click="onDeviceBundleClick"
  @background-click="deviceCableScene = null"
/>
```

### 8. 清理

```typescript
function clearDeviceCables(): void {
  deviceCableScene.value = null
  deviceCableFocus.value = null
}
```

Esc 键或点击背景时清理。

## 注意事项

- Task 8 依赖对现有 RackDeviceView.vue 的理解，实现时需先阅读现有代码结构
- 如果 SwitchPortDrawer 是独立组件，需要在那边也引入相关逻辑
- device 级别的线路不聚合（每条单独显示比聚合更有意义）

## 编译验证

```bash
cd src/frontend && npx vue-tsc --noEmit
```

## Commit

```
feat: add device-level cable visualization to RackDeviceView
```
