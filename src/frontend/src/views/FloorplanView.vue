<template>
  <div class="floorplan-page">
    <header class="floorplan-toolbar">
      <div class="toolbar-left">
        <button class="btn btn--small btn--muted" @click="goBack">← 返回机房列表</button>
        <h2 class="toolbar-title" v-if="!loading">{{ roomName }}</h2>
      </div>
      <div class="toolbar-center">
        <button type="button" class="btn btn--small btn--muted" @click="networkPathVisible = true">连接路径查询</button>
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
        <span class="hint" v-if="mode === 'edit'">拖拽移动 | Ctrl+Z 撤销 | Ctrl+Y 重做</span>
        <span class="hint" v-else>滚轮缩放 | 拖拽平移 | 点击机柜查看</span>
      </div>
    </header>

    <div class="floorplan-body">
      <div class="canvas-wrap">
        <div v-if="loading" class="status-msg">加载中...</div>
        <div v-else-if="error" class="status-msg status-msg--error">{{ error }}</div>
        <FloorplanCanvas
          v-else
          ref="canvasRef"
          :racks="racks"
          :mode="mode"
          :snap-lines="snapLines"
          :cable-links="cableLinks"
          :highlighted-rack-ids="highlightedRackIds"
          :to-canvas-x="toCanvasX"
          :to-canvas-y="toCanvasY"
          :snap-position="snapPosition"
          @rack-click="goToRack"
          @rack-dragstart="handleDragStart"
          @rack-dragend="onDragEnd"
        />
      </div>

      <aside v-if="selectedRack" class="sidebar">
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

    <NetworkPathDrawer
      :visible="networkPathVisible"
      :loading="networkPathLoading"
      :error="networkPathError"
      :path-result="networkPathResult"
      @close="networkPathVisible = false; highlightedRackIds = []"
      @search="handleNetworkPathSearch"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFloorplan } from '../composables/useFloorplan'
import { useFloorplanEditor } from '../composables/useFloorplanEditor'
import { useApi } from '../composables/useApi'
import FloorplanCanvas, { type CableLink } from '../components/FloorplanCanvas.vue'
import NetworkPathDrawer, { type NetworkPathResult } from '../components/NetworkPathDrawer.vue'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id as string)
const canvasRef = ref<InstanceType<typeof FloorplanCanvas>>()
const cableLinks = ref<CableLink[]>([])
const networkPathVisible = ref(false)
const networkPathLoading = ref(false)
const networkPathError = ref('')
const networkPathResult = ref<NetworkPathResult | null>(null)
const highlightedRackIds = ref<string[]>([])

const { racks, loading, error, loadRacks, toCanvasX, toCanvasY, toDbX, toDbY } = useFloorplan(roomId.value)
const { request } = useApi()

async function loadCables(): Promise<void> {
  const result = await request<{ links: CableLink[] }>(`/api/rooms/${roomId.value}/cables`, { method: 'GET' })
  if (result.ok && result.data && Array.isArray(result.data.links)) {
    cableLinks.value = result.data.links.map(link => ({
      cableCount: link.cableCount,
      cableTypes: link.cableTypes,
      source: {
        rackId: String(link.source.rackId),
        rackCode: link.source.rackCode,
        x: link.source.x,
        y: link.source.y,
      },
      target: {
        rackId: String(link.target.rackId),
        rackCode: link.target.rackCode,
        x: link.target.x,
        y: link.target.y,
      },
    }))
  } else {
    cableLinks.value = []
  }
}

async function saveRackPosition(id: string, x: number, y: number): Promise<boolean> {
  const rack = racks.value.find(r => r.id === id)
  if (!rack) return false

  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) return false
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) return false

  const result = await request(`/api/racks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: {
      code: rack.code,
      heightU: rack.heightU,
      brand: rack.brand,
      power: rack.power,
      notes: rack.notes,
      x,
      y,
      z: rack.z,
    },
    csrfToken: token,
  })
  return result.ok
}

const editor = useFloorplanEditor(racks, toDbX, toDbY, saveRackPosition)
const { mode, selectedRackId, snapLines, toggleMode, selectRack, snapPosition, handleDragStart, handleDragEnd } = editor

const roomName = computed(() => racks.value[0]?.roomName ?? '机房平面图')

const selectedRack = computed(() => {
  if (!selectedRackId.value) return null
  return racks.value.find(r => r.id === selectedRackId.value) ?? null
})

const occPct = computed(() => {
  if (!selectedRack.value || !selectedRack.value.occupiedU) return 0
  return Math.round((selectedRack.value.occupiedU / selectedRack.value.heightU) * 100)
})

function setViewMode(): void { if (mode.value !== 'view') toggleMode() }
function setEditMode(): void { if (mode.value !== 'edit') toggleMode() }
function goBack(): void { router.push('/') }
function goToRack(rackId: string): void { router.push(`/racks/${encodeURIComponent(rackId)}`) }
function onDragEnd(rackId: string, x: number, y: number): void { handleDragEnd(rackId, x, y) }

async function handleNetworkPathSearch(sourceId: string, targetId: string): Promise<void> {
  networkPathLoading.value = true
  networkPathError.value = ''
  networkPathResult.value = null
  highlightedRackIds.value = []
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
  if (result.data?.pathFound && result.data?.devices) {
    const ids: string[] = []
    for (const d of result.data.devices) {
      if (d.rackCode) {
        const rack = racks.value.find(r => r.code === d.rackCode)
        if (rack && !ids.includes(rack.id)) ids.push(rack.id)
      }
    }
    highlightedRackIds.value = ids
  }
}

// Keyboard shortcuts
function onKeyDown(e: KeyboardEvent): void {
  if (e.key === '1' && mode.value === 'edit') toggleMode()
  if (e.key === '2' && mode.value === 'view') toggleMode()
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); editor.undo() }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); editor.redo() }
  if (e.ctrlKey && e.key === '0') { e.preventDefault(); canvasRef.value?.fitToScreen() }
}

// Load data + register keyboard on mount
onMounted(() => {
  loadRacks()
  void loadCables()
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
