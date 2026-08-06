<template>
  <div class="floorplan-dark">
    <header class="floorplan-toolbar">
      <div class="toolbar-left">
        <span class="toolbar-icon" aria-hidden="true">☰</span>
        <span class="toolbar-label">机房详情</span>
        <h2 class="toolbar-title">{{ roomName }}</h2>
      </div>
      <div class="toolbar-center">
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          placeholder="搜索机柜编号、服务器名称、IP、资产编号…"
          aria-label="搜索机柜或服务器"
        />
        <button
          type="button"
          class="btn btn--small btn--muted"
          @click="networkPathVisible = true"
        >连接路径查询</button>
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
        <span v-if="mode === 'edit'" class="hint">拖拽移动 | Ctrl+Z 撤销 | Ctrl+Y 重做</span>
        <span v-else class="hint">滚轮缩放 | 拖拽平移 | 点击机柜查看</span>
        <span v-if="user" class="user-info">{{ user.username }} · {{ user.role }}</span>
      </div>
    </header>

    <div class="floorplan-body">
      <nav class="floorplan-sidebar">
        <ul class="nav-list">
          <li><router-link to="/" class="nav-link">机房</router-link></li>
          <li><span class="nav-link nav-link--active">机柜</span></li>
          <li><router-link to="/servers" class="nav-link">服务器</router-link></li>
          <li><a href="#recent" class="nav-link">操作记录</a></li>
        </ul>
        <div class="room-summary">
          <h4>机房概况</h4>
          <dl class="summary-dl">
            <dt>机柜数</dt><dd>{{ capacityStats.count }}</dd>
            <dt>总 U 位</dt><dd>{{ capacityStats.totalU }}</dd>
            <dt>已用 U 位</dt><dd>{{ capacityStats.usedU }}</dd>
            <dt>使用率</dt><dd>{{ capacityStats.pct }}%</dd>
          </dl>
        </div>
      </nav>

      <main class="floorplan-main">
        <div class="capacity-overview">
          <div class="cap-stat">
            <span class="cap-value">{{ capacityStats.count }}</span>
            <span class="cap-label">机柜数</span>
          </div>
          <div class="cap-stat">
            <span class="cap-value">{{ capacityStats.totalU }}</span>
            <span class="cap-label">总 U 位</span>
          </div>
          <div class="cap-stat">
            <span class="cap-value">{{ capacityStats.usedU }}</span>
            <span class="cap-label">已用 U 位</span>
          </div>
          <div class="cap-stat">
            <span class="cap-value">{{ capacityStats.pct }}%</span>
            <span class="cap-label">使用率</span>
          </div>
        </div>

        <div class="canvas-wrap">
          <div v-if="loading" class="status-msg">加载中…</div>
          <div v-else-if="error" class="status-msg status-msg--error">{{ error }}</div>
          <FloorplanCanvas
            v-else
            ref="canvasRef"
            :room-id="roomId"
            :racks="racks"
            :mode="mode"
            :snap-lines="snapLines"
            :cable-links="cableLinks"
            :selected-rack-id="selectedRackId"
            :search-highlight-ids="searchHighlightIds"
            :highlighted-rack-ids="networkPathHighlightIds"
            :to-canvas-x="toCanvasX"
            :to-canvas-y="toCanvasY"
            :snap-position="snapPosition"
            @rack-click="onRackClick"
            @rack-dragstart="handleDragStart"
            @rack-dragend="onDragEnd"
          />
        </div>

        <section
          v-if="selectedRackId && recentChanges.length > 0"
          id="recent"
          class="recent-changes"
        >
          <h4>最近位置变更</h4>
          <table class="recent-table">
            <thead>
              <tr>
                <th>设备</th>
                <th>操作</th>
                <th>操作人</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in recentChanges" :key="item.id">
                <td>{{ item.serverName }}</td>
                <td>{{ item.operationType }}</td>
                <td>{{ item.operatorUsername }}</td>
                <td>{{ formatOperatedAt(item.operatedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </main>

      <aside class="floorplan-inspector">
        <template v-if="!selectedRack">
          <div class="inspector-empty">
            <p>点击机柜查看详情</p>
            <span class="inspector-hint">在平面图中选择机柜，右侧将显示 U 位与设备信息</span>
          </div>
        </template>
        <template v-else>
          <div class="inspector-header">
            <div>
              <h3>{{ selectedRack.code }}</h3>
              <span class="inspector-meta">{{ selectedRack.roomName }} · {{ selectedRack.heightU }}U</span>
            </div>
            <button class="btn btn--tiny btn--muted" type="button" @click="selectRack(null)">✕</button>
          </div>

          <div class="capacity-bar-wrap">
            <div class="capacity-bar-label">
              <span>容量</span>
              <span>{{ selectedRack.occupiedU ?? 0 }}/{{ selectedRack.heightU }}U ({{ occPct }}%)</span>
            </div>
            <div class="capacity-bar">
              <div class="capacity-bar-fill" :style="{ width: occPct + '%' }" />
            </div>
          </div>

          <div v-if="inspectorLoading" class="inspector-loading">加载 U 位…</div>
          <RackFrontPanel
            v-else
            :rack-code="selectedRack.code"
            :height-u="selectedRack.heightU"
            :u-slots="inspectorSlots"
            :room-id="roomId"
            compact
            @server-click="goToServer"
          />

          <div class="inspector-actions">
            <button
              type="button"
              class="btn btn--small btn--primary"
              @click="goToRack(selectedRack.id)"
            >查看机柜详情</button>
          </div>
        </template>
      </aside>
    </div>

    <NetworkPathDrawer
      :visible="networkPathVisible"
      :loading="networkPathLoading"
      :error="networkPathError"
      :path-result="networkPathResult"
      @close="networkPathVisible = false; networkPathHighlightIds = []"
      @search="handleNetworkPathSearch"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFloorplan } from '../composables/useFloorplan'
import { useFloorplanEditor } from '../composables/useFloorplanEditor'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'
import { buildUSlotsFromOccupancy } from '../composables/useRackDetail'
import FloorplanCanvas, { type CableLink } from '../components/FloorplanCanvas.vue'
import NetworkPathDrawer, { type NetworkPathResult } from '../components/NetworkPathDrawer.vue'
import RackFrontPanel, { type USlot } from '../components/RackFrontPanel.vue'

type RoomServer = {
  id: string
  name: string
  managementIP: string
  assetNumber: string | null
  rackCode: string | null
}

type AuditRecordItem = {
  id: string
  operationType: string
  fromPosition: string | null
  toPosition: string | null
  operatorUsername: string
  operatedAt: string
  notes: string | null
}

type RecentChange = AuditRecordItem & { serverName: string }

type AvailabilityResponse = {
  positions: Array<{
    uNumber: number
    occupied: boolean
    serverName?: string
    serverId?: string
    deviceType?: string
    deviceHeight?: number
  }>
}

const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const roomId = computed(() => route.params.id as string)
const canvasRef = ref<InstanceType<typeof FloorplanCanvas>>()

const cableLinks = ref<CableLink[]>([])
const networkPathVisible = ref(false)
const networkPathLoading = ref(false)
const networkPathError = ref('')
const networkPathResult = ref<NetworkPathResult | null>(null)
const networkPathHighlightIds = ref<string[]>([])

const searchQuery = ref('')
const roomServers = ref<RoomServer[]>([])
const inspectorSlots = ref<USlot[]>([])
const inspectorLoading = ref(false)
const recentChanges = ref<RecentChange[]>([])

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

async function loadRoomServers(): Promise<void> {
  const result = await request<unknown>('/api/servers', { method: 'GET' })
  if (!result.ok || !Array.isArray(result.data)) {
    roomServers.value = []
    return
  }

  const rackCodes = new Set(racks.value.map(r => r.code))
  const parsed: RoomServer[] = []
  for (const item of result.data) {
    if (item === null || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.name !== 'string') continue
    const rackCode = typeof record.rackCode === 'string' ? record.rackCode : null
    if (!rackCode || !rackCodes.has(rackCode)) continue
    parsed.push({
      id: record.id,
      name: record.name,
      managementIP: typeof record.managementIP === 'string' ? record.managementIP : '',
      assetNumber: typeof record.assetNumber === 'string' ? record.assetNumber : null,
      rackCode,
    })
  }
  roomServers.value = parsed
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

const capacityStats = computed(() => {
  const count = racks.value.length
  const totalU = racks.value.reduce((sum, r) => sum + r.heightU, 0)
  const usedU = racks.value.reduce((sum, r) => sum + (r.occupiedU ?? 0), 0)
  const pct = totalU > 0 ? Math.round((usedU / totalU) * 100) : 0
  return { count, totalU, usedU, pct }
})

const searchHighlightIds = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []

  const ids = new Set<string>()
  for (const rack of racks.value) {
    if (rack.code.toLowerCase().includes(q)) {
      ids.add(rack.id)
    }
  }

  const rackByCode = new Map(racks.value.map(r => [r.code, r.id]))
  for (const server of roomServers.value) {
    const nameMatch = server.name.toLowerCase().includes(q)
    const ipMatch = server.managementIP.toLowerCase().includes(q)
    const assetMatch = server.assetNumber?.toLowerCase().includes(q) ?? false
    if ((nameMatch || ipMatch || assetMatch) && server.rackCode) {
      const rackId = rackByCode.get(server.rackCode)
      if (rackId) ids.add(rackId)
    }
  }

  return [...ids]
})

const occPct = computed(() => {
  if (!selectedRack.value || !selectedRack.value.heightU) return 0
  return Math.round(((selectedRack.value.occupiedU ?? 0) / selectedRack.value.heightU) * 100)
})

function setViewMode(): void { if (mode.value !== 'view') toggleMode() }
function setEditMode(): void { if (mode.value !== 'edit') toggleMode() }
function onRackClick(rackId: string): void { selectRack(rackId) }
function goToRack(rackId: string): void { router.push(`/racks/${encodeURIComponent(rackId)}`) }
function goToServer(serverId: string): void { router.push(`/servers/${encodeURIComponent(serverId)}`) }
function onDragEnd(rackId: string, x: number, y: number): void { handleDragEnd(rackId, x, y) }

function formatOperatedAt(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function loadInspectorData(rackId: string): Promise<void> {
  inspectorLoading.value = true
  inspectorSlots.value = []

  const rack = racks.value.find(r => r.id === rackId)
  if (!rack) {
    inspectorLoading.value = false
    return
  }

  const availResult = await request<AvailabilityResponse>(
    `/api/racks/${encodeURIComponent(rackId)}/availability`,
    { method: 'GET' },
  )

  if (availResult.ok && availResult.data) {
    const map = new Map<number, { serverName: string; serverId?: string; deviceType: string; deviceHeight: number }>()
    for (const pos of availResult.data.positions) {
      if (pos.occupied && pos.serverName) {
        map.set(pos.uNumber, {
          serverName: pos.serverName,
          serverId: pos.serverId,
          deviceType: pos.deviceType ?? '未知',
          deviceHeight: pos.deviceHeight ?? 1,
        })
      }
    }
    inspectorSlots.value = buildUSlotsFromOccupancy(map, rack.heightU)
  }

  inspectorLoading.value = false
}

async function loadRecentChanges(rackId: string): Promise<void> {
  recentChanges.value = []

  const availResult = await request<AvailabilityResponse>(
    `/api/racks/${encodeURIComponent(rackId)}/availability`,
    { method: 'GET' },
  )
  if (!availResult.ok || !availResult.data) return

  const serverMap = new Map<string, string>()
  for (const pos of availResult.data.positions) {
    if (pos.occupied && pos.serverId && pos.serverName) {
      serverMap.set(pos.serverId, pos.serverName)
    }
  }
  if (serverMap.size === 0) return

  const results = await Promise.all(
    [...serverMap.entries()].map(async ([serverId, serverName]) => {
      const result = await request<AuditRecordItem[]>(
        `/api/servers/${encodeURIComponent(serverId)}/audit-records`,
        { method: 'GET' },
      )
      if (!result.ok || !Array.isArray(result.data)) return [] as RecentChange[]
      return result.data.map(record => ({ ...record, serverName }))
    }),
  )

  recentChanges.value = results
    .flat()
    .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime())
    .slice(0, 5)
}

watch(selectedRackId, (rackId) => {
  if (!rackId) {
    inspectorSlots.value = []
    recentChanges.value = []
    return
  }
  void loadInspectorData(rackId)
  void loadRecentChanges(rackId)
})

watch(racks, () => {
  void loadRoomServers()
})

async function handleNetworkPathSearch(sourceId: string, targetId: string): Promise<void> {
  networkPathLoading.value = true
  networkPathError.value = ''
  networkPathResult.value = null
  networkPathHighlightIds.value = []

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
    networkPathHighlightIds.value = ids
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === '1' && mode.value === 'edit') toggleMode()
  if (e.key === '2' && mode.value === 'view') toggleMode()
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); editor.undo() }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); editor.redo() }
  if (e.ctrlKey && e.key === '0') { e.preventDefault(); canvasRef.value?.fitToScreen() }
}

onMounted(async () => {
  await loadRacks()
  void loadCables()
  void loadRoomServers()
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.floorplan-dark {
  --color-bg: #0d1117;
  --color-bg-card: #161b22;
  --color-border: #21262d;
  --color-text: #c9d1d9;
  --color-text-secondary: #8b949e;
  --color-primary: #58a6ff;
  --color-success: #3fb950;
  --color-warning: #d2991d;
  --color-danger: #f85149;
  --color-nav-bg: #0d1117;
  --color-accent: #39d2c0;
  --color-rack-fill: #1a3a5c;
  --color-rack-empty: #161b22;
  --color-grid-line: #1c2533;
  --color-bg-hover: #21262d;

  background: var(--color-bg);
  color: var(--color-text);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px);
  max-height: calc(100vh - 56px);
  overflow: hidden;
}

.floorplan-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  gap: var(--space-md);
  min-height: 54px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.toolbar-icon {
  font-size: 18px;
  color: var(--color-text-secondary);
}

.toolbar-label {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.toolbar-title {
  font-size: var(--font-lg);
  font-weight: 600;
  margin: 0;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex: 1;
  justify-content: center;
  max-width: 720px;
}

.search-input {
  flex: 1;
  min-width: 200px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius, 6px);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-sm);
}

.search-input::placeholder {
  color: var(--color-text-secondary);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.mode-toggle {
  display: flex;
  border-radius: var(--radius, 6px);
  overflow: hidden;
  flex-shrink: 0;
}

.mode-toggle .btn {
  border-radius: 0;
}

.mode-toggle .btn:first-child {
  border-radius: var(--radius, 6px) 0 0 var(--radius, 6px);
}

.mode-toggle .btn:last-child {
  border-radius: 0 var(--radius, 6px) var(--radius, 6px) 0;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.user-info {
  color: var(--color-text);
  white-space: nowrap;
}

.floorplan-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.floorplan-sidebar {
  width: 200px;
  flex-shrink: 0;
  background: var(--color-nav-bg);
  border-right: 1px solid var(--color-border);
  padding: var(--space-md);
  overflow-y: auto;
}

.nav-list {
  list-style: none;
  margin: 0 0 var(--space-lg);
  padding: 0;
}

.nav-link {
  display: block;
  padding: var(--space-xs) var(--space-sm);
  color: var(--color-text-secondary);
  text-decoration: none;
  border-radius: var(--radius, 6px);
  font-size: var(--font-sm);
}

.nav-link:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.nav-link--active {
  color: var(--color-accent);
  font-weight: 600;
  background: rgba(57, 210, 192, 0.1);
}

.room-summary h4 {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.summary-dl {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: var(--space-xs);
  font-size: var(--font-sm);
  margin: 0;
}

.summary-dl dt {
  color: var(--color-text-secondary);
}

.summary-dl dd {
  margin: 0;
  font-weight: 500;
}

.floorplan-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.capacity-overview {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.cap-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
  padding: var(--space-xs) var(--space-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius, 6px);
}

.cap-value {
  font-size: var(--font-xl, 20px);
  font-weight: 700;
  color: var(--color-accent);
}

.cap-label {
  font-size: var(--font-xs);
  color: var(--color-text-secondary);
}

.canvas-wrap {
  flex: 1;
  position: relative;
  min-height: 0;
  padding: var(--space-sm);
}

.status-msg {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-lg);
  color: var(--color-text-secondary);
}

.status-msg--error {
  color: var(--color-danger);
}

.recent-changes {
  flex-shrink: 0;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-border);
  max-height: 160px;
  overflow-y: auto;
}

.recent-changes h4 {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-sm);
}

.recent-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-sm);
}

.recent-table th,
.recent-table td {
  padding: 4px 8px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.recent-table th {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.floorplan-inspector {
  width: 360px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border);
  background: var(--color-bg-card);
  padding: var(--space-md);
  overflow-y: auto;
}

.inspector-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--color-text-secondary);
  gap: var(--space-sm);
}

.inspector-hint {
  font-size: var(--font-xs);
  max-width: 240px;
}

.inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-md);
}

.inspector-header h3 {
  margin: 0;
  font-size: var(--font-lg);
}

.inspector-meta {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.capacity-bar-wrap {
  margin-bottom: var(--space-md);
}

.capacity-bar-label {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-sm);
  margin-bottom: 4px;
  color: var(--color-text-secondary);
}

.capacity-bar {
  height: 6px;
  background: var(--color-bg);
  border-radius: 3px;
  overflow: hidden;
}

.capacity-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 3px;
  transition: width 0.2s ease;
}

.inspector-loading {
  padding: var(--space-md);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-sm);
}

.inspector-actions {
  margin-top: var(--space-md);
}

.hint {
  font-size: var(--font-xs);
  white-space: nowrap;
}
</style>
