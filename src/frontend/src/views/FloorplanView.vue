<template>
  <div class="floorplan-page">
    <header class="floorplan-toolbar">
      <div class="toolbar-left">
        <button class="btn btn--small btn--muted" @click="goBack">← 返回机房列表</button>
        <h2 class="toolbar-title" v-if="!loading">{{ roomName }}</h2>
      </div>
      <div class="toolbar-center">
        <div class="mode-toggle">
          <button
            :class="['btn btn--small', mode === 'view' ? 'btn--primary' : 'btn--muted']"
            @click="setViewMode"
          >查看模式</button>
          <button
            :class="['btn btn--small', mode === 'edit' ? 'btn--primary' : 'btn--muted']"
            @click="setEditMode"
          >编辑模式</button>
        </div>
      </div>
      <div class="toolbar-right">
        <span class="hint" v-if="mode === 'edit'">{{ activeTool === 'select' ? '拖拽移动 | Ctrl+Z 撤销 | Ctrl+Y 重做' : '绘制中...' }}</span>
        <span class="hint" v-else>滚轮缩放 | 拖拽平移 | 点击机柜查看</span>
      </div>
    </header>

    <div class="floorplan-body">
      <FloorplanToolbar
        v-if="mode === 'edit'"
        :active-tool="activeTool"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :mode="mode"
        @tool-change="setTool"
        @undo="undo"
        @redo="redo"
        @export-svg="exportSvg"
      />

      <div class="canvas-wrap">
        <div v-if="loading" class="status-msg">加载中...</div>
        <div v-else-if="error" class="status-msg status-msg--error">{{ error }}</div>
        <FloorplanCanvas
          v-else
          :racks="racks"
          :walls="walls"
          :zones="zones"
          :labels="labels"
          :mode="mode"
          :active-tool="activeTool"
          :snap-lines="snapLines"
          :to-canvas-x="toCanvasX"
          :to-canvas-y="toCanvasY"
          :snap-position="snapPosition"
          @rack-click="goToRack"
          @rack-dragstart="handleDragStart"
          @rack-dragend="onDragEnd"
          @wall-drawn="onWallDrawn"
          @zone-drawn="onZoneDrawn"
          @label-placed="onLabelPlaced"
        />
      </div>

      <FloorplanRackLibrary
        v-if="mode === 'edit' && activeTool === 'rack'"
        :racks="racks"
        @rack-drop="onRackDrop"
        @rack-create="onRackCreate"
      />

      <FloorplanPropertyPanel
        v-if="mode === 'edit' && selectedElement"
        :selected="selectedElement"
        @update="onPropertyUpdate"
        @delete="onElementDelete"
      />

      <aside v-if="mode === 'view' && selectedRack" class="sidebar">
        <div class="sidebar-header">
          <h3>{{ selectedRack.code }}</h3>
          <button class="btn btn--tiny btn--muted" @click="selectRack(null)">✕</button>
        </div>
        <dl class="sidebar-dl">
          <dt>房间</dt><dd>{{ selectedRack.roomName }}</dd>
          <dt>U位</dt><dd>{{ selectedRack.heightU }}U</dd>
          <dt>已用</dt><dd>{{ selectedRack.occupiedU ?? 0 }}U ({{ occPct }}%)</dd>
          <dt>品牌</dt><dd>{{ selectedRack.brand || '—' }}</dd>
          <dt>功率</dt><dd>{{ selectedRack.power != null ? selectedRack.power + ' kW' : '—' }}</dd>
          <dt>坐标</dt><dd>({{ selectedRack.x }}, {{ selectedRack.y }})</dd>
        </dl>
        <div class="sidebar-actions">
          <button class="btn btn--small btn--primary" @click="goToRack(selectedRack.id)">查看机柜详情</button>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFloorplan } from '../composables/useFloorplan'
import { useFloorplanEditor } from '../composables/useFloorplanEditor'
import { useFloorplanElements, type WallItem, type ZoneItem, type LabelItem } from '../composables/useFloorplanElements'
import { useApi } from '../composables/useApi'
import FloorplanCanvas from '../components/FloorplanCanvas.vue'
import FloorplanToolbar from '../components/FloorplanToolbar.vue'
import FloorplanRackLibrary from '../components/FloorplanRackLibrary.vue'
import FloorplanPropertyPanel from '../components/FloorplanPropertyPanel.vue'

type ToolType = 'select' | 'wall' | 'rack' | 'label' | 'zone' | 'delete'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id as string)

const { racks, loading, error, loadRacks, toCanvasX, toCanvasY, toDbX, toDbY } = useFloorplan(roomId.value)
const { walls, zones, labels, loadElements, addWall, addZone, addLabel, deleteWall, deleteZone, deleteLabel, updateWall, updateZone, updateLabel } = useFloorplanElements(roomId.value)
const { request } = useApi()

const activeTool = ref<ToolType>('select')
const selectedElementType = ref<string | null>(null)
const selectedElementId = ref<string | null>(null)

const selectedElement = computed(() => {
  if (!selectedElementId.value) return null
  const type = selectedElementType.value
  if (type === 'wall') {
    const w = walls.value.find(e => e.id === selectedElementId.value)
    return w ? { ...w, type: 'wall' as const } : null
  }
  if (type === 'zone') {
    const z = zones.value.find(e => e.id === selectedElementId.value)
    return z ? { ...z, type: 'zone' as const } : null
  }
  if (type === 'label') {
    const l = labels.value.find(e => e.id === selectedElementId.value)
    return l ? { ...l, type: 'label' as const } : null
  }
  return null
})

async function saveRackPosition(id: string, x: number, y: number): Promise<boolean> {
  const rack = racks.value.find(r => r.id === id)
  if (!rack) return false
  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) return false
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) return false
  const result = await request(`/api/racks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { code: rack.code, heightU: rack.heightU, brand: rack.brand, power: rack.power, notes: rack.notes, x, y, z: rack.z },
    csrfToken: token,
  })
  return result.ok
}

const editor = useFloorplanEditor(racks, toDbX, toDbY, saveRackPosition)
const { mode, selectedRackId, snapLines, toggleMode, selectRack, snapPosition, handleDragStart, handleDragEnd, undo, redo, canUndo, canRedo } = editor

const roomName = computed(() => racks.value[0]?.roomName ?? '机房平面图')
const selectedRack = computed(() => selectedRackId.value ? racks.value.find(r => r.id === selectedRackId.value) ?? null : null)
const occPct = computed(() => {
  if (!selectedRack.value?.occupiedU) return 0
  return Math.round((selectedRack.value.occupiedU / selectedRack.value.heightU) * 100)
})

function setViewMode(): void { if (mode.value !== 'view') toggleMode() }
function setEditMode(): void { if (mode.value !== 'edit') toggleMode() }
function setTool(t: ToolType): void { activeTool.value = t; selectedElementId.value = null }
function goBack(): void { router.push('/') }
function goToRack(rackId: string): void { router.push(`/racks/${encodeURIComponent(rackId)}`) }
function onDragEnd(rackId: string, x: number, y: number): void { handleDragEnd(rackId, x, y) }

// Drawing event handlers
async function onWallDrawn(x1: number, y1: number, x2: number, y2: number): Promise<void> {
  const wall = await addWall({ x1: toDbX(x1), y1: toDbY(y1), x2: toDbX(x2), y2: toDbY(y2) })
  if (wall) activeTool.value = 'select'
}

async function onZoneDrawn(x: number, y: number, w: number, h: number): Promise<void> {
  const name = window.prompt('区域名称：', '新区域')
  if (!name) return
  const zone = await addZone({ x: toDbX(x), y: toDbY(y), width: toDbX(w), height: toDbY(h), name, zoneType: 'functional' })
  if (zone) activeTool.value = 'select'
}

async function onLabelPlaced(x: number, y: number): Promise<void> {
  const text = window.prompt('标签文字：')
  if (!text) return
  const label = await addLabel({ x: toDbX(x), y: toDbY(y), text })
  if (label) activeTool.value = 'select'
}

async function onElementDelete(id: string, type: string): Promise<void> {
  if (!window.confirm('确认删除此元素？')) return
  if (type === 'wall') await deleteWall(id)
  else if (type === 'zone') await deleteZone(id)
  else if (type === 'label') await deleteLabel(id)
  selectedElementId.value = null
  selectedElementType.value = null
}

async function onPropertyUpdate(patch: Record<string, unknown>): Promise<void> {
  if (!selectedElementId.value || !selectedElementType.value) return
  const id = selectedElementId.value
  const type = selectedElementType.value
  if (type === 'wall') {
    const w = walls.value.find(e => e.id === id)
    if (w) await updateWall(id, { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, ...patch })
  } else if (type === 'zone') {
    const z = zones.value.find(e => e.id === id)
    if (z) await updateZone(id, { x: z.x, y: z.y, width: z.width, height: z.height, name: z.name, zoneType: z.zoneType, ...patch })
  } else if (type === 'label') {
    const l = labels.value.find(e => e.id === id)
    if (l) await updateLabel(id, { x: l.x, y: l.y, text: l.text, fontSize: l.fontSize, color: l.color, ...patch })
  }
}

function onRackDrop(payload: { rackId: string; clientX: number; clientY: number }): void {
  const canvasWrap = document.querySelector('.canvas-wrap') as HTMLElement | null
  if (!canvasWrap) return
  const rect = canvasWrap.getBoundingClientRect()
  const canvasX = payload.clientX - rect.left
  const canvasY = payload.clientY - rect.top
  const existingRack = racks.value.find(r => r.id === payload.rackId)
  if (existingRack) {
    handleDragEnd(payload.rackId, canvasX, canvasY)
  }
}

async function onRackCreate(): Promise<void> {
  const code = window.prompt('机柜编号：')
  if (!code) return
  const heightU = Number(window.prompt('高度(U)：', '42'))
  if (!heightU || heightU < 1) return
  const brand = window.prompt('品牌（可选）：') || ''
  const canvasWrap = document.querySelector('.canvas-wrap') as HTMLElement | null
  const defaultX = canvasWrap ? canvasWrap.clientWidth / 2 : 300
  const defaultY = canvasWrap ? canvasWrap.clientHeight / 2 : 300
  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) return
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) return
  const result = await request(`/api/racks`, {
    method: 'POST',
    body: { code, roomId: roomId.value, heightU, brand, x: toDbX(defaultX), y: toDbY(defaultY), z: 0 },
    csrfToken: token,
  })
  if (result.ok) {
    await loadRacks()
  }
}

function exportSvg(): void {
  // implemented in Task 12
}

// Keyboard shortcuts
function onKeyDown(e: KeyboardEvent): void {
  if (e.key === '1' && mode.value === 'edit') toggleMode()
  if (e.key === '2' && mode.value === 'view') toggleMode()
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo() }
}

onMounted(() => {
  loadRacks()
  loadElements()
  window.addEventListener('keydown', onKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.floorplan-page { display: flex; flex-direction: column; height: calc(100vh - 56px); max-height: calc(100vh - 56px); }
.floorplan-toolbar { display: flex; align-items: center; justify-content: space-between; padding: var(--space-sm) var(--space-md); background: var(--color-bg-card, #fff); border-bottom: 1px solid var(--color-border, #e0e0e0); flex-shrink: 0; gap: var(--space-md); }
.toolbar-left { display: flex; align-items: center; gap: var(--space-sm); }
.toolbar-title { font-size: var(--font-lg); font-weight: 600; margin: 0; }
.toolbar-center { display: flex; align-items: center; gap: var(--space-md); }
.mode-toggle { display: flex; border-radius: var(--radius, 6px); overflow: hidden; }
.mode-toggle .btn { border-radius: 0; }
.mode-toggle .btn:first-child { border-radius: var(--radius, 6px) 0 0 var(--radius, 6px); }
.mode-toggle .btn:last-child { border-radius: 0 var(--radius, 6px) var(--radius, 6px) 0; }
.toolbar-right { font-size: var(--font-sm); color: #999; }
.floorplan-body { display: flex; flex: 1; overflow: hidden; }
.canvas-wrap { flex: 1; position: relative; }
.status-msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: var(--font-lg); color: #999; }
.status-msg--error { color: var(--color-danger, #e74c3c); }
.sidebar { width: 280px; border-left: 1px solid var(--color-border, #e0e0e0); background: var(--color-bg-card, #fff); padding: var(--space-md); overflow-y: auto; flex-shrink: 0; }
.sidebar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); }
.sidebar-header h3 { margin: 0; font-size: var(--font-lg); }
.sidebar-dl { display: grid; grid-template-columns: 60px 1fr; gap: var(--space-xs) var(--space-sm); font-size: var(--font-sm); }
.sidebar-dl dt { color: #999; font-weight: 400; }
.sidebar-dl dd { margin: 0; font-weight: 500; }
.sidebar-actions { margin-top: var(--space-md); }
.hint { font-size: var(--font-sm); }
</style>
