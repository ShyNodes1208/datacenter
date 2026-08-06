# Task 7: FloorplanCanvas 集成

> **Assigned to:** Cursor
> **Depends on:** Task 3 (API), Task 4 (useCableScene), Task 5 (CableLayer), Task 6 (Legend/Breadcrumb)
> **Plan ref:** docs/superpowers/plans/2026-08-05-cable-visualization.md

## 目标

在机房平面图 (FloorplanCanvas) 上叠加线路可视化层。

## 文件

| 文件 | 操作 |
|------|------|
| `src/frontend/src/views/FloorplanCanvas.vue` | 修改 |

## Steps

### 1. 引入依赖

```typescript
import { ref } from 'vue'
import { buildCableScene, type CableFocus, type CableScene } from '../composables/useCableScene'
import CableLayer from '../components/CableLayer.vue'
import CableBreadcrumb from '../components/CableBreadcrumb.vue'
import CableLegend from '../components/CableLegend.vue'
```

### 2. 添加状态

```typescript
const cableFocus = ref<CableFocus>({ level: 'room', roomId: '' })
const animationEnabled = ref(true)
const cableScene = ref<CableScene | null>(null)
const cableFilters = ref({ purposes: [], cableTypes: [] })
```

### 3. 加载场景数据

```typescript
async function loadCableScene(): Promise<void> {
  const result = await request<unknown>(`/api/rooms/${roomId}/cable-scene`, { method: 'GET' })
  if (result.ok && result.data) {
    cableScene.value = buildCableScene(result.data as any, cableFocus.value, cableFilters.value)
  }
}
```

注意：需要在获取到 `roomId` 后调用。利用现有的 `roomId` 变量（来自路由参数）。

### 4. 交互方法

```typescript
function onBundleClick(bundleId: string): void {
  // 从 bundle.id 解析 rackId: key = "srcRack|tgtRack|purpose|type"
  const parts = bundleId.split('|')
  if (parts[0] !== '__none__') {
    cableFocus.value = { level: 'rack', rackId: parts[0] }
    cableScene.value = buildCableScene(/* snapshot */, cableFocus.value, cableFilters.value)
  }
}

function onBackgroundClick(): void {
  cableFocus.value = { level: 'room', roomId }
  cableScene.value = buildCableScene(/* snapshot */, cableFocus.value, cableFilters.value)
}

function onNavigate(level: string, id: string): void {
  cableFocus.value = { level } as CableFocus  // 根据 level 设置对应 id
  cableScene.value = buildCableScene(/* snapshot */, cableFocus.value, cableFilters.value)
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') onBackgroundClick()
}
```

### 5. 生命周期

```typescript
onMounted(() => {
  // 现有初始化...
  document.addEventListener('keydown', handleKeydown)
  // roomId 可用后调用 loadCableScene()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
```

### 6. 模板中插入组件

在 floorplan 容器内（机柜渲染层上方）添加：

```html
<CableBreadcrumb
  v-if="cableScene"
  :items="cableScene.breadcrumbs"
  @navigate="onNavigate"
/>
<CableLayer
  v-if="cableScene"
  :scene="cableScene"
  :animation-enabled="animationEnabled"
  @bundle-click="onBundleClick"
  @background-click="onBackgroundClick"
/>
<CableLegend
  v-if="cableScene"
  :legend="cableScene.legend"
  :detail-rows="cableScene.detailRows"
  :animation-enabled="animationEnabled"
  @toggle-animation="animationEnabled = !animationEnabled"
/>
```

**关键**: CableLayer 需要放在 SVG 或 floorplan 容器中，且容器需设置 `position: relative`。

### 7. 场景数据缓存

为了避免每次切换 focus 重新请求 API，缓存原始 snapshot：

```typescript
const cableSnapshot = ref<any>(null)  // 缓存 API 返回的原始数据

async function loadCableScene(): Promise<void> {
  const result = await request<unknown>(`/api/rooms/${roomId}/cable-scene`, { method: 'GET' })
  if (result.ok && result.data) {
    cableSnapshot.value = result.data
    cableScene.value = buildCableScene(result.data, cableFocus.value, cableFilters.value)
  }
}

// 后续切换 focus 时用缓存数据重建:
function rebuildScene(): void {
  if (cableSnapshot.value) {
    cableScene.value = buildCableScene(cableSnapshot.value, cableFocus.value, cableFilters.value)
  }
}
```

## 编译验证

```bash
cd src/frontend && npx vue-tsc --noEmit
```

## Commit

```
feat: integrate CableLayer into FloorplanCanvas for rack-level cable visualization
```
