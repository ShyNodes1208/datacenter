<template>
  <main class="topology-page" aria-label="拓扑视图">
    <header class="topology-header">
      <div>
        <h1>机房拓扑地图</h1>
        <p class="topology-subtitle">{{ subtitle }}</p>
        <nav v-if="focusedRoomId" class="topology-breadcrumb" aria-label="层级导航">
          <button type="button" class="link-btn" @click="exitRoomFocus">机房级</button>
          <span>/</span>
          <button
            type="button"
            class="link-btn"
            :class="{ 'link-btn--active': topology?.mode === 'racks' }"
            @click="enterRackLevel"
          >
            机柜级
          </button>
          <template v-if="topology?.mode === 'devices'">
            <span>/</span>
            <span class="link-btn link-btn--active">设备级</span>
          </template>
        </nav>
      </div>
      <div class="topology-actions">
        <button
          v-if="topology?.mode === 'racks'"
          type="button"
          class="btn btn--primary"
          @click="enterDeviceLevel"
        >
          查看设备
        </button>
        <button
          v-if="topology?.mode === 'devices'"
          type="button"
          class="btn"
          @click="enterRackLevel"
        >
          返回机柜级
        </button>
        <button
          v-if="focusedRoomId && topology?.mode !== 'devices'"
          type="button"
          class="btn"
          @click="exitRoomFocus"
        >
          返回机房级
        </button>
        <label v-if="topology?.mode === 'devices'" class="anim-toggle">
          <input v-model="animationEnabled" type="checkbox" />
          流向动画
        </label>
        <button type="button" class="btn" :disabled="loading" @click="reload">刷新</button>
      </div>
    </header>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="loading && !topology">加载中…</p>
    <p v-else-if="topology && topology.rooms.length === 0">暂无机房</p>

    <div v-if="topology?.mode === 'devices'" class="topology-filters" aria-label="线缆筛选">
      <fieldset>
        <legend>CableType</legend>
        <label v-for="type in availableCableTypes" :key="type">
          <input
            type="checkbox"
            :checked="selectedCableTypes.includes(type)"
            @change="toggleCableType(type)"
          />
          {{ type }}
        </label>
      </fieldset>
      <fieldset>
        <legend>Purpose</legend>
        <label v-for="purpose in availablePurposes" :key="purpose">
          <input
            type="checkbox"
            :checked="selectedPurposes.includes(purpose)"
            @change="togglePurpose(purpose)"
          />
          {{ purpose }}
        </label>
      </fieldset>
    </div>

    <div class="topology-body" :class="{ 'topology-body--with-panel': !!selectedCable }">
      <div ref="containerRef" class="topology-canvas">
        <div ref="konvaContainer" class="konva-stage"></div>
        <div
          v-if="topology?.mode === 'devices' && deviceCableScene"
          class="cable-overlay"
          :style="cableOverlayStyle"
        >
          <CableLayer
            :scene="deviceCableScene"
            :animation-enabled="animationEnabled"
            @bundle-click="onCableBundleClick"
          />
        </div>
        <aside
          v-if="topology?.mode === 'devices' && deviceCableScene"
          class="device-legend"
          aria-label="线缆图例"
        >
          <div class="device-legend__title">图例</div>
          <div
            v-for="item in deviceCableScene.legend"
            :key="`${item.cableType}|${item.purpose}`"
            class="device-legend__item"
          >
            <svg width="28" height="10" aria-hidden="true">
              <line
                x1="0"
                y1="5"
                x2="28"
                y2="5"
                :stroke="item.color"
                stroke-width="2"
                :stroke-dasharray="item.dashArray === 'none' ? undefined : item.dashArray"
              />
            </svg>
            <span>{{ item.cableType }} · {{ item.purpose }}</span>
            <span class="device-legend__count">{{ item.count }}</span>
          </div>
        </aside>
        <div
          v-if="tooltip"
          class="topology-tooltip"
          :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
        >
          <div class="topology-tooltip__title">{{ tooltip.title }}</div>
          <div v-for="(line, idx) in tooltip.lines" :key="idx">{{ line }}</div>
          <ul v-if="tooltip.cables && tooltip.cables.length > 0" class="topology-tooltip__list">
            <li v-for="cable in tooltip.cables.slice(0, 8)" :key="cable.cableId">
              {{ cable.sourceDevice }}:{{ cable.sourcePort }}
              →
              {{ cable.targetDevice }}:{{ cable.targetPort }}
              （{{ cable.cableType }}）
            </li>
          </ul>
          <div v-if="tooltip.cables && tooltip.cables.length > 8">
            …其余 {{ tooltip.cables.length - 8 }} 条
          </div>
        </div>
      </div>

      <aside v-if="selectedCable" class="cable-detail-panel" aria-label="线路详情">
        <div class="cable-detail-panel__header">
          <h2>线路详情</h2>
          <button type="button" class="btn" @click="clearCableSelection">关闭</button>
        </div>
        <dl>
          <dt>源设备</dt>
          <dd>{{ selectedCable.source.deviceName }}</dd>
          <dt>源端口</dt>
          <dd>{{ selectedCable.source.portName }}</dd>
          <dt>源端口 Speed</dt>
          <dd>{{ formatSpeed(selectedCable.source.speed) }}</dd>
          <dt>目标设备</dt>
          <dd>{{ selectedCable.target.deviceName }}</dd>
          <dt>目标端口</dt>
          <dd>{{ selectedCable.target.portName }}</dd>
          <dt>目标端口 Speed</dt>
          <dd>{{ formatSpeed(selectedCable.target.speed) }}</dd>
          <dt>CableType</dt>
          <dd>{{ selectedCable.cableType }}</dd>
          <dt>Purpose</dt>
          <dd>{{ selectedCable.purpose }}</dd>
          <dt>源机柜</dt>
          <dd>{{ selectedCable.source.rackCode ?? '—' }}</dd>
          <dt>目标机柜</dt>
          <dd>{{ selectedCable.target.rackCode ?? '—' }}</dd>
          <dt>状态</dt>
          <dd>已登记</dd>
        </dl>
      </aside>
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
import CableLayer from '../components/CableLayer.vue'
import {
  buildCableScene,
  type CableFocus,
  type CableInfo,
  type CableScene,
  type CableSnapshot,
  type DeviceInfo,
  type RackInfo,
} from '../composables/useCableScene'

const ROOM_ADMIN_ROLE = '机房管理员'
const ROOM_W = 180
const ROOM_H = 100
const RACK_W = 90
const RACK_H = 56
const DEVICE_RACK_W = 160

const { user } = useAuth()
const { request } = useApi()
const { data: topology, error, loading, load, loadDevices, saveRoomPosition } = useTopology()

const isRoomAdmin = computed(() => user.value?.role === ROOM_ADMIN_ROLE)
const focusedRoomId = ref<string | null>(null)
const containerRef = ref<HTMLDivElement>()
const konvaContainer = ref<HTMLDivElement>()
const saveError = ref('')
const animationEnabled = ref(true)
const focusDeviceId = ref<string | null>(null)
const selectedCableId = ref<string | null>(null)
const selectedCableTypes = ref<string[]>([])
const selectedPurposes = ref<string[]>([])
const laidSnapshot = ref<CableSnapshot | null>(null)
const stageSize = ref({ width: 800, height: 760 })

const tooltip = ref<{
  x: number
  y: number
  title: string
  lines: string[]
  cables?: TopologyCableDetail[]
} | null>(null)

let stage: Konva.Stage | null = null
let layer: Konva.Layer | null = null
let resizeObserver: ResizeObserver | null = null

const subtitle = computed(() => {
  if (topology.value?.mode === 'devices') {
    return '登记连接拓扑示意，非实时流量。箭头为登记端点方向，不代表实际数据包路由。'
  }
  return '跨机房线缆聚合视图；拖拽保存位置，双击机房展开机柜连接'
})

const availableCableTypes = computed(() => {
  const snapshot = topology.value?.cableSnapshot
  if (!snapshot) return [] as string[]
  return [...new Set(snapshot.cables.map((c) => c.cableType))].sort()
})

const availablePurposes = computed(() => {
  const snapshot = topology.value?.cableSnapshot
  if (!snapshot) return [] as string[]
  return [...new Set(snapshot.cables.map((c) => c.purpose || '正常'))].sort()
})

const selectedCable = computed<CableInfo | null>(() => {
  if (!selectedCableId.value || !topology.value?.cableSnapshot) return null
  return topology.value.cableSnapshot.cables.find((c) => c.cableId === selectedCableId.value) ?? null
})

const deviceCableScene = computed<CableScene | null>(() => {
  if (topology.value?.mode !== 'devices' || !laidSnapshot.value || !focusedRoomId.value) return null
  const focus: CableFocus = focusDeviceId.value
    ? { level: 'device', deviceId: focusDeviceId.value }
    : { level: 'room', roomId: focusedRoomId.value }
  return buildCableScene(
    laidSnapshot.value,
    focus,
    {
      cableTypes: selectedCableTypes.value,
      purposes: selectedPurposes.value,
    },
    focusedRoomId.value,
    {
      expandToCables: true,
      selectedCableId: selectedCableId.value,
    },
  )
})

const cableOverlayStyle = computed(() => ({
  width: `${stageSize.value.width}px`,
  height: `${stageSize.value.height}px`,
}))

function formatSpeed(speed: string | null): string {
  return speed && speed.trim() ? speed : '未登记'
}

function toggleCableType(type: string): void {
  const set = new Set(selectedCableTypes.value)
  if (set.has(type)) set.delete(type)
  else set.add(type)
  selectedCableTypes.value = [...set]
}

function togglePurpose(purpose: string): void {
  const set = new Set(selectedPurposes.value)
  if (set.has(purpose)) set.delete(purpose)
  else set.add(purpose)
  selectedPurposes.value = [...set]
}

async function reload(): Promise<void> {
  if (topology.value?.mode === 'devices' && focusedRoomId.value) {
    await loadDevices(focusedRoomId.value)
    return
  }
  await load(focusedRoomId.value)
}

async function exitRoomFocus(): Promise<void> {
  focusedRoomId.value = null
  focusDeviceId.value = null
  selectedCableId.value = null
  selectedCableTypes.value = []
  selectedPurposes.value = []
  laidSnapshot.value = null
  await load(null)
}

async function enterRackLevel(): Promise<void> {
  if (!focusedRoomId.value) return
  focusDeviceId.value = null
  selectedCableId.value = null
  selectedCableTypes.value = []
  selectedPurposes.value = []
  laidSnapshot.value = null
  await load(focusedRoomId.value)
}

async function enterDeviceLevel(): Promise<void> {
  if (!focusedRoomId.value) return
  focusDeviceId.value = null
  selectedCableId.value = null
  selectedCableTypes.value = []
  selectedPurposes.value = []
  await loadDevices(focusedRoomId.value)
}

function clearCableSelection(): void {
  selectedCableId.value = null
}

function onCableBundleClick(bundleId: string): void {
  selectedCableId.value = bundleId
  focusDeviceId.value = null
}

function clearDeviceFocus(): void {
  focusDeviceId.value = null
  selectedCableId.value = null
  tooltip.value = null
  drawScene()
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

function layoutDeviceSnapshot(snapshot: CableSnapshot): CableSnapshot {
  const devicesByRack = new Map<string, DeviceInfo[]>()
  for (const device of snapshot.devices) {
    const list = devicesByRack.get(device.rackId) ?? []
    list.push(device)
    devicesByRack.set(device.rackId, list)
  }

  const sortedRacks = [...snapshot.racks].sort((a, b) => a.x - b.x || a.y - b.y || a.code.localeCompare(b.code))
  const laidRacks: RackInfo[] = []
  const laidDevices: DeviceInfo[] = []

  sortedRacks.forEach((rack, index) => {
    const devices = (devicesByRack.get(rack.rackId) ?? [])
      .slice()
      .sort((a, b) => a.startU - b.startU || a.deviceName.localeCompare(b.deviceName))
    const rackX = 60 + (index % 4) * 220
    const rackY = 70 + Math.floor(index / 4) * 320
    const virtualHeightU = Math.max(4, devices.length * 2)
    laidRacks.push({
      ...rack,
      x: rackX,
      y: rackY,
      width: DEVICE_RACK_W,
      height: virtualHeightU * 20,
    })
    devices.forEach((device, deviceIndex) => {
      laidDevices.push({
        ...device,
        startU: deviceIndex * 2 + 1,
        endU: deviceIndex * 2 + 2,
      })
    })
  })

  return {
    racks: laidRacks,
    devices: laidDevices,
    cables: snapshot.cables,
  }
}

function deviceFill(deviceType: string): string {
  if (deviceType.includes('交换') || deviceType.toLowerCase().includes('switch')) return '#1f6feb'
  if (deviceType.includes('存储') || deviceType.toLowerCase().includes('storage')) return '#bf8700'
  if (deviceType.includes('防火') || deviceType.toLowerCase().includes('firewall')) return '#cf222e'
  return '#424a53'
}

function drawPortAnchors(scene: CableScene): void {
  if (!layer) return

  // One marker per route endpoint (no coordinate dedupe) so multi-port devices keep distinct anchors.
  for (const bundle of scene.bundles) {
    if (bundle.opacity <= 0 || bundle.route.length < 2) continue
    const points = [bundle.route[0], bundle.route[bundle.route.length - 1]]
    for (const point of points) {
      layer.add(new Konva.Circle({
        x: point.x,
        y: point.y,
        radius: 3.5,
        fill: '#39d2c0',
        stroke: '#0d1117',
        strokeWidth: 1,
        listening: false,
      }))
    }
  }
}

function drawDeviceScene(): void {
  if (!stage || !layer || !topology.value?.cableSnapshot) return
  const originalSnapshot = topology.value.cableSnapshot
  const originalDevices = new Map(originalSnapshot.devices.map((d) => [d.deviceId, d]))
  const snapshot = layoutDeviceSnapshot(originalSnapshot)
  laidSnapshot.value = snapshot
  const scene = deviceCableScene.value
  const focused = topology.value.rooms.find((room) => room.id === topology.value?.focusedRoomId)

  if (focused) {
    layer.add(new Konva.Text({
      x: 24,
      y: 24,
      text: `${focused.name} · 设备级连接`,
      fontSize: 16,
      fontStyle: 'bold',
      fill: '#1f2a37',
      listening: false,
    }))
  }

  const relatedDeviceIds = new Set<string>()
  if (focusDeviceId.value) {
    relatedDeviceIds.add(focusDeviceId.value)
    for (const cable of snapshot.cables) {
      if (cable.source.deviceId === focusDeviceId.value || cable.target.deviceId === focusDeviceId.value) {
        relatedDeviceIds.add(cable.source.deviceId)
        relatedDeviceIds.add(cable.target.deviceId)
      }
    }
  }

  const rackCodeById = new Map(snapshot.racks.map((r) => [r.rackId, r.code]))

  for (const rack of snapshot.racks) {
    layer.add(new Konva.Rect({
      x: rack.x - 8,
      y: rack.y - 28,
      width: rack.width + 16,
      height: rack.height + 40,
      cornerRadius: 10,
      fill: '#eef2f6',
      stroke: '#cfd8e3',
      strokeWidth: 1,
      shadowColor: 'rgba(0,0,0,0.12)',
      shadowBlur: 10,
      shadowOffsetY: 4,
      listening: false,
    }))
    layer.add(new Konva.Text({
      x: rack.x,
      y: rack.y - 22,
      width: rack.width,
      align: 'center',
      text: rack.code,
      fontSize: 13,
      fontStyle: 'bold',
      fill: '#1f2a37',
      listening: false,
    }))
  }

  for (const device of snapshot.devices) {
    const rack = snapshot.racks.find((r) => r.rackId === device.rackId)
    if (!rack) continue
    const uHeight = device.endU - device.startU + 1
    const y = rack.y + (device.startU - 1) * 20
    const height = uHeight * 20 - 4
    const dimmed = focusDeviceId.value !== null && !relatedDeviceIds.has(device.deviceId)
    const focusedDevice = focusDeviceId.value === device.deviceId
    const group = new Konva.Group({
      x: rack.x + 8,
      y: y + 2,
      opacity: dimmed ? 0.25 : 1,
    })
    group.add(new Konva.Rect({
      width: rack.width - 16,
      height,
      cornerRadius: 6,
      fill: deviceFill(device.deviceType),
      stroke: focusedDevice ? '#58a6ff' : '#0d1117',
      strokeWidth: focusedDevice ? 2.5 : 1,
      shadowColor: focusedDevice ? 'rgba(88,166,255,0.45)' : 'transparent',
      shadowBlur: focusedDevice ? 10 : 0,
    }))
    group.add(new Konva.Text({
      x: 8,
      y: Math.max(4, height / 2 - 8),
      width: rack.width - 32,
      text: device.deviceName,
      fontSize: 12,
      fill: '#f8f9fa',
      ellipsis: true,
      listening: false,
    }))
    group.on('click', (event) => {
      event.cancelBubble = true
      focusDeviceId.value = device.deviceId
      selectedCableId.value = null
      drawScene()
    })
    group.on('mouseenter', () => {
      const pointer = stage?.getPointerPosition()
      const original = originalDevices.get(device.deviceId) ?? device
      tooltip.value = {
        x: (pointer?.x ?? 0) + 12,
        y: (pointer?.y ?? 0) + 12,
        title: device.deviceName,
        lines: [
          `类型：${original.deviceType || '未登记'}`,
          `运行状态：${original.operationalStatus || '未登记'}`,
          `机柜：${rackCodeById.get(device.rackId) ?? '—'}`,
          `U 位：${original.startU}-${original.endU}`,
        ],
      }
      document.body.style.cursor = 'pointer'
    })
    group.on('mousemove', () => {
      const pointer = stage?.getPointerPosition()
      if (!pointer || !tooltip.value) return
      tooltip.value = { ...tooltip.value, x: pointer.x + 12, y: pointer.y + 12 }
    })
    group.on('mouseleave', () => {
      tooltip.value = null
      document.body.style.cursor = 'default'
    })
    layer.add(group)
  }

  if (scene) {
    drawPortAnchors(scene)
  }

  stage.on('click', (event) => {
    if (event.target === stage) {
      clearDeviceFocus()
    }
  })
}

function drawScene(): void {
  if (!stage || !layer || !topology.value) return
  layer.destroyChildren()
  stage.off('click')
  tooltip.value = null

  const current = topology.value
  if (current.mode === 'devices') {
    drawDeviceScene()
    layer.draw()
    return
  }

  laidSnapshot.value = null

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
          title: `线缆 ${connection.cableCount} 条`,
          lines: [`类型：${connection.types.join('、') || '无'}`],
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
          title: `线缆 ${connection.cableCount} 条`,
          lines: [`类型：${connection.types.join('、') || '无'}`],
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
      group.on('dblclick', async () => {
        if (!current.focusedRoomId) return
        focusedRoomId.value = current.focusedRoomId
        await loadDevices(current.focusedRoomId)
      })
      layer.add(group)
    }
  }

  layer.draw()
}

function computeStageSize(): { width: number; height: number } {
  const viewW = konvaContainer.value?.clientWidth || 800
  const viewH = konvaContainer.value?.clientHeight || 760
  if (!topology.value || topology.value.rooms.length === 0) return { width: viewW, height: viewH }

  if (topology.value.mode === 'devices' && topology.value.cableSnapshot) {
    const laid = layoutDeviceSnapshot(topology.value.cableSnapshot)
    let maxX = viewW
    let maxY = viewH
    for (const rack of laid.racks) {
      maxX = Math.max(maxX, rack.x + rack.width + 80)
      maxY = Math.max(maxY, rack.y + rack.height + 80)
    }
    return { width: maxX, height: maxY }
  }

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
  stageSize.value = { width, height }
  stage = new Konva.Stage({ container: konvaContainer.value, width, height })
  layer = new Konva.Layer()
  stage.add(layer)
  drawScene()

  resizeObserver = new ResizeObserver(() => {
    if (!stage || !konvaContainer.value) return
    const { width: w, height: h } = computeStageSize()
    stageSize.value = { width: w, height: h }
    stage.width(w)
    stage.height(h)
    drawScene()
  })
  resizeObserver.observe(konvaContainer.value)
}

watch(topology, () => {
  if (!stage || !konvaContainer.value) return
  const { width, height } = computeStageSize()
  stageSize.value = { width, height }
  stage.width(width)
  stage.height(height)
  drawScene()
})

watch([focusDeviceId, selectedCableId, selectedCableTypes, selectedPurposes, animationEnabled], () => {
  if (topology.value?.mode === 'devices') {
    drawScene()
  }
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

.topology-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #5c6b7a;
}

.link-btn {
  border: none;
  background: transparent;
  color: #1f6feb;
  cursor: pointer;
  padding: 0;
}

.link-btn--active {
  color: #1f2a37;
  font-weight: 600;
  cursor: default;
}

.topology-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
}

.btn {
  border: 1px solid #9aa7b5;
  background: #fff;
  color: #1f2a37;
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
}

.btn--primary {
  border-color: #1f6feb;
  background: #1f6feb;
  color: #fff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.anim-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: #1f2a37;
}

.error {
  color: var(--color-danger, #c0392b);
}

.topology-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  padding: 0.5rem 0.75rem;
  border: 1px solid #cfd8e3;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
}

.topology-filters fieldset {
  border: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}

.topology-filters legend {
  padding: 0;
  margin-right: 0.5rem;
  font-weight: 600;
  font-size: 0.85rem;
}

.topology-filters label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;
}

.topology-body {
  display: flex;
  gap: var(--space-md);
  flex: 1;
  min-height: 760px;
}

.topology-body--with-panel .topology-canvas {
  flex: 1;
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

.cable-overlay {
  position: absolute;
  inset: 0 auto auto 0;
  pointer-events: none;
  z-index: 4;
}

.device-legend {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 5;
  min-width: 160px;
  max-width: 260px;
  padding: 0.5rem 0.65rem;
  border: 1px solid #cfd8e3;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 4px 14px rgba(31, 42, 55, 0.08);
  font-size: 0.75rem;
  color: #1f2a37;
  pointer-events: none;
}

.device-legend__title {
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.device-legend__item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.2rem;
}

.device-legend__count {
  margin-left: auto;
  color: #5c6b7a;
}

.cable-overlay :deep(.cable-layer) {
  pointer-events: none;
}

.cable-overlay :deep(.bundle-group) {
  pointer-events: auto;
}

.cable-detail-panel {
  width: 300px;
  flex-shrink: 0;
  border: 1px solid #cfd8e3;
  border-radius: 12px;
  background: #fff;
  padding: 0.75rem 1rem;
  overflow: auto;
}

.cable-detail-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.cable-detail-panel h2 {
  margin: 0;
  font-size: 1rem;
}

.cable-detail-panel dl {
  margin: 0;
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 0.4rem 0.5rem;
  font-size: 0.85rem;
}

.cable-detail-panel dt {
  color: #5c6b7a;
}

.cable-detail-panel dd {
  margin: 0;
  color: #1f2a37;
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
