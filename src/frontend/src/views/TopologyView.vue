<template>
  <main class="topology-page" aria-label="拓扑视图">
    <header class="topology-header">
      <div>
        <h1>机房拓扑地图</h1>
        <p class="topology-subtitle">跨机房线缆聚合视图；拖拽保存位置，双击机房展开机柜连接</p>
      </div>
      <div class="topology-actions">
        <button
          v-if="focusedRoomId"
          type="button"
          class="btn"
          @click="exitRoomFocus"
        >
          返回机房级
        </button>
        <button type="button" class="btn" :disabled="loading" @click="reload">刷新</button>
      </div>
    </header>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="loading && !topology">加载中…</p>
    <p v-else-if="topology && topology.rooms.length === 0">暂无机房</p>

    <div ref="containerRef" class="topology-canvas">
      <div ref="konvaContainer" class="konva-stage"></div>
      <div
        v-if="tooltip"
        class="topology-tooltip"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
      >
        <div class="topology-tooltip__title">线缆 {{ tooltip.cableCount }} 条</div>
        <div>类型：{{ tooltip.types.join('、') || '无' }}</div>
        <ul v-if="tooltip.cables.length > 0" class="topology-tooltip__list">
          <li v-for="cable in tooltip.cables.slice(0, 8)" :key="cable.cableId">
            {{ cable.sourceDevice }}:{{ cable.sourcePort }}
            →
            {{ cable.targetDevice }}:{{ cable.targetPort }}
            （{{ cable.cableType }}）
          </li>
        </ul>
        <div v-if="tooltip.cables.length > 8">…其余 {{ tooltip.cables.length - 8 }} 条</div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Konva from 'konva'
import { useAuth } from '../composables/useAuth'
import { useApi } from '../composables/useApi'
import {
  cableTypeColor,
  primaryCableType,
  useTopology,
  type TopologyCableDetail,
  type TopologyRoom,
} from '../composables/useTopology'

const ROOM_ADMIN_ROLE = '机房管理员'
const ROOM_W = 180
const ROOM_H = 100
const RACK_W = 90
const RACK_H = 56

const { user } = useAuth()
const { request } = useApi()
const { data: topology, error, loading, load, saveRoomPosition } = useTopology()

const isRoomAdmin = computed(() => user.value?.role === ROOM_ADMIN_ROLE)
const focusedRoomId = ref<string | null>(null)
const containerRef = ref<HTMLDivElement>()
const konvaContainer = ref<HTMLDivElement>()
const saveError = ref('')

const tooltip = ref<{
  x: number
  y: number
  cableCount: number
  types: string[]
  cables: TopologyCableDetail[]
} | null>(null)

let stage: Konva.Stage | null = null
let layer: Konva.Layer | null = null
let resizeObserver: ResizeObserver | null = null

async function reload(): Promise<void> {
  await load(focusedRoomId.value)
}

async function exitRoomFocus(): Promise<void> {
  focusedRoomId.value = null
  await load(null)
}

async function fetchCsrf(): Promise<string | null> {
  const result = await request<{ token?: string }>('/api/auth/csrf', { method: 'GET' })
  if (!result.ok) {
    saveError.value = result.error
    return null
  }
  const headerToken = result.headers.get('X-XSRF-TOKEN')
  if (headerToken) return headerToken
  if (result.data && typeof result.data === 'object' && typeof (result.data as { token?: unknown }).token === 'string') {
    return (result.data as { token: string }).token
  }
  saveError.value = '防伪令牌缺失或无效'
  return null
}

function autoLayoutRooms(rooms: TopologyRoom[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const zeroRooms = rooms.filter((room) => room.topologyX === 0 && room.topologyY === 0)
  const layoutZeros = zeroRooms.length > 1 || rooms.every((room) => room.topologyX === 0 && room.topologyY === 0)
  let zeroIndex = 0
  const cols = Math.min(4, Math.ceil(Math.sqrt(rooms.length)))
  for (const room of rooms) {
    if (layoutZeros && room.topologyX === 0 && room.topologyY === 0) {
      const col = zeroIndex % cols
      const row = Math.floor(zeroIndex / cols)
      positions.set(room.id, { x: 40 + col * 220, y: 40 + row * 140 })
      zeroIndex += 1
      continue
    }
    positions.set(room.id, { x: room.topologyX, y: room.topologyY })
  }
  return positions
}

function strokeWidthForCount(count: number): number {
  return Math.max(2, Math.min(14, 2 + Math.log2(count + 1) * 2.5))
}

function drawScene(): void {
  if (!stage || !layer || !topology.value) return
  layer.destroyChildren()
  tooltip.value = null

  const current = topology.value
  if (current.mode === 'rooms') {
    const positions = autoLayoutRooms(current.rooms)
    const centerOf = (roomId: string) => {
      const pos = positions.get(roomId) ?? { x: 0, y: 0 }
      return { x: pos.x + ROOM_W / 2, y: pos.y + ROOM_H / 2 }
    }

    for (const connection of current.roomConnections) {
      const from = centerOf(connection.sourceRoomId)
      const to = centerOf(connection.targetRoomId)
      const color = cableTypeColor(primaryCableType(connection.types))
      const line = new Konva.Line({
        points: [from.x, from.y, to.x, to.y],
        stroke: color,
        strokeWidth: strokeWidthForCount(connection.cableCount),
        lineCap: 'round',
        opacity: 0.85,
        hitStrokeWidth: 18,
      })
      line.on('mouseenter', (event) => {
        const pointer = stage?.getPointerPosition()
        tooltip.value = {
          x: (pointer?.x ?? event.evt.offsetX) + 12,
          y: (pointer?.y ?? event.evt.offsetY) + 12,
          cableCount: connection.cableCount,
          types: connection.types,
          cables: connection.cables,
        }
        document.body.style.cursor = 'pointer'
      })
      line.on('mousemove', () => {
        const pointer = stage?.getPointerPosition()
        if (!pointer || !tooltip.value) return
        tooltip.value = { ...tooltip.value, x: pointer.x + 12, y: pointer.y + 12 }
      })
      line.on('mouseleave', () => {
        tooltip.value = null
        document.body.style.cursor = 'default'
      })
      layer.add(line)
    }

    for (const room of current.rooms) {
      const pos = positions.get(room.id) ?? { x: room.topologyX, y: room.topologyY }
      const group = new Konva.Group({
        x: pos.x,
        y: pos.y,
        draggable: isRoomAdmin.value,
        id: `room-${room.id}`,
      })

      const body = new Konva.Rect({
        width: ROOM_W,
        height: ROOM_H,
        cornerRadius: 12,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: 0, y: ROOM_H },
        fillLinearGradientColorStops:
          room.status === '启用'
            ? [0, '#3d5a80', 1, '#1b2838']
            : [0, '#6c757d', 1, '#343a40'],
        shadowColor: 'rgba(0,0,0,0.45)',
        shadowBlur: 12,
        shadowOffset: { x: 0, y: 6 },
        shadowOpacity: 0.35,
        stroke: room.status === '启用' ? '#78c2ff' : '#adb5bd',
        strokeWidth: 1.5,
      })

      const title = new Konva.Text({
        x: 12,
        y: 12,
        width: ROOM_W - 24,
        text: room.name,
        fontSize: 15,
        fontStyle: 'bold',
        fill: '#f8f9fa',
        ellipsis: true,
      })
      const status = new Konva.Text({
        x: 12,
        y: 34,
        text: room.status,
        fontSize: 12,
        fill: room.status === '启用' ? '#8fecb0' : '#ffc9c9',
      })
      const stats = new Konva.Text({
        x: 12,
        y: 56,
        width: ROOM_W - 24,
        text: `机柜 ${room.rackCount} · 服务器 ${room.serverCount}\n线缆 ${room.cableCount}`,
        fontSize: 11,
        lineHeight: 1.35,
        fill: '#d7dee7',
      })

      group.add(body, title, status, stats)
      group.on('dragend', async () => {
        const nextX = group.x()
        const nextY = group.y()
        room.topologyX = nextX
        room.topologyY = nextY
        drawScene()
        if (!isRoomAdmin.value) return
        const token = await fetchCsrf()
        if (!token) {
          error.value = saveError.value || '保存失败'
          return
        }
        const result = await saveRoomPosition(room, nextX, nextY, token)
        if (!result.ok) {
          error.value = result.error
        }
      })
      group.on('dblclick', async () => {
        focusedRoomId.value = room.id
        await load(room.id)
      })
      layer.add(group)
    }
  } else {
    const racks = current.racks
    const rackPos = new Map<string, { x: number; y: number }>()
    racks.forEach((rack, index) => {
      rackPos.set(rack.id, {
        x: 80 + (Number.isFinite(rack.x) ? rack.x * 120 : index * 120),
        y: 100 + (Number.isFinite(rack.y) ? rack.y * 90 : 0),
      })
    })

    const focused = current.rooms.find((room) => room.id === current.focusedRoomId)
    if (focused) {
      layer.add(new Konva.Text({
        x: 24,
        y: 24,
        text: `${focused.name} · 机柜级连接`,
        fontSize: 16,
        fontStyle: 'bold',
        fill: '#1f2a37',
      }))
    }

    for (const connection of current.rackConnections) {
      const from = rackPos.get(connection.sourceRackId)
      const to = rackPos.get(connection.targetRackId)
      if (!from || !to) continue
      const color = cableTypeColor(primaryCableType(connection.types))
      const line = new Konva.Line({
        points: [from.x + RACK_W / 2, from.y + RACK_H / 2, to.x + RACK_W / 2, to.y + RACK_H / 2],
        stroke: color,
        strokeWidth: strokeWidthForCount(connection.cableCount),
        lineCap: 'round',
        opacity: 0.9,
        hitStrokeWidth: 16,
      })
      line.on('mouseenter', () => {
        const pointer = stage?.getPointerPosition()
        tooltip.value = {
          x: (pointer?.x ?? 0) + 12,
          y: (pointer?.y ?? 0) + 12,
          cableCount: connection.cableCount,
          types: connection.types,
          cables: connection.cables,
        }
      })
      line.on('mouseleave', () => {
        tooltip.value = null
      })
      layer.add(line)
    }

    for (const rack of racks) {
      const pos = rackPos.get(rack.id) ?? { x: 0, y: 0 }
      const group = new Konva.Group({ x: pos.x, y: pos.y })
      group.add(new Konva.Rect({
        width: RACK_W,
        height: RACK_H,
        cornerRadius: 8,
        fillLinearGradientStartPoint: { x: 0, y: 0 },
        fillLinearGradientEndPoint: { x: 0, y: RACK_H },
        fillLinearGradientColorStops: [0, '#495057', 1, '#212529'],
        shadowColor: 'rgba(0,0,0,0.35)',
        shadowBlur: 8,
        shadowOffset: { x: 0, y: 4 },
        stroke: '#ced4da',
        strokeWidth: 1,
      }))
      group.add(new Konva.Text({
        x: 8,
        y: 18,
        width: RACK_W - 16,
        align: 'center',
        text: rack.code,
        fontSize: 13,
        fill: '#f8f9fa',
      }))
      layer.add(group)
    }
  }

  layer.draw()
}

function computeStageSize(): { width: number; height: number } {
  const viewW = konvaContainer.value?.clientWidth || 800
  const viewH = konvaContainer.value?.clientHeight || 760
  if (!topology.value || topology.value.rooms.length === 0) return { width: viewW, height: viewH }

  const rooms = topology.value.rooms
  const positions = autoLayoutRooms(rooms)
  let maxX = 0
  let maxY = 0
  for (const room of rooms) {
    const pos = positions.get(room.id) ?? { x: room.topologyX, y: room.topologyY }
    maxX = Math.max(maxX, pos.x + ROOM_W + 80)
    maxY = Math.max(maxY, pos.y + ROOM_H + 80)
  }
  return { width: Math.max(viewW, maxX), height: Math.max(viewH, maxY) }
}

function initStage(): void {
  if (!konvaContainer.value) return
  const { width, height } = computeStageSize()
  stage = new Konva.Stage({ container: konvaContainer.value, width, height })
  layer = new Konva.Layer()
  stage.add(layer)
  drawScene()

  resizeObserver = new ResizeObserver(() => {
    if (!stage || !konvaContainer.value) return
    const { width: w, height: h } = computeStageSize()
    stage.width(w)
    stage.height(h)
    drawScene()
  })
  resizeObserver.observe(konvaContainer.value)
}

watch(topology, () => {
  drawScene()
})

onMounted(async () => {
  await load(null)
  initStage()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  stage?.destroy()
  stage = null
  layer = null
  document.body.style.cursor = 'default'
})
</script>

<style scoped>
.topology-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  min-height: calc(100vh - 48px);
  background:
    radial-gradient(circle at top left, rgba(61, 90, 128, 0.12), transparent 40%),
    linear-gradient(180deg, #f4f7fb 0%, #e8eef5 100%);
}

.topology-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-md);
}

.topology-header h1 {
  margin: 0;
  font-size: 1.4rem;
  color: #1f2a37;
}

.topology-subtitle {
  margin: 0.25rem 0 0;
  color: #5c6b7a;
  font-size: 0.9rem;
}

.topology-actions {
  display: flex;
  gap: var(--space-sm);
}

.btn {
  border: 1px solid #9aa7b5;
  background: #fff;
  color: #1f2a37;
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: var(--color-danger, #c0392b);
}

.topology-canvas {
  position: relative;
  flex: 1;
  min-height: 760px;
  border: 1px solid #cfd8e3;
  border-radius: 12px;
  overflow: auto;
  background:
    linear-gradient(90deg, rgba(31, 42, 55, 0.04) 1px, transparent 1px),
    linear-gradient(0deg, rgba(31, 42, 55, 0.04) 1px, transparent 1px);
  background-size: 24px 24px;
  background-color: #fbfcfe;
}

.konva-stage {
  width: 100%;
  height: 100%;
  min-height: 760px;
}

.topology-tooltip {
  position: absolute;
  z-index: 5;
  max-width: 320px;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: rgba(20, 28, 36, 0.92);
  color: #f1f5f9;
  font-size: 12px;
  pointer-events: none;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.topology-tooltip__title {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.topology-tooltip__list {
  margin: 0.4rem 0 0;
  padding-left: 1rem;
}
</style>
