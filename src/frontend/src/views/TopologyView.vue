<template>
  <main
    class="topology-page"
    :class="{ 'topology-page--devices': topology?.mode === 'devices' }"
    aria-label="拓扑视图"
  >
    <header class="topology-header">
      <div class="topology-header__lead">
        <h1>{{ pageTitle }}</h1>
        <p class="topology-subtitle">{{ subtitle }}</p>
        <nav class="topology-breadcrumb" aria-label="层级导航">
          <span>机房拓扑</span>
          <template v-if="focusedRoom">
            <span>/</span>
            <span>{{ focusedRoom.name }}</span>
          </template>
          <template v-if="focusedRoom?.location">
            <span>/</span>
            <span>{{ focusedRoom.location }}</span>
          </template>
          <template v-if="topology?.mode === 'devices'">
            <span>/</span>
            <span>设备链路</span>
          </template>
        </nav>
      </div>
      <div class="topology-header__tools">
        <div class="level-switcher" role="tablist" aria-label="拓扑层级切换">
          <button
            type="button"
            role="tab"
            class="level-switcher__btn"
            :class="{ 'level-switcher__btn--active': !focusedRoomId }"
            :aria-selected="!focusedRoomId"
            title="选择机房后查看机柜和设备链路"
            @click="exitRoomFocus"
          >
            机房级
          </button>
          <button
            type="button"
            role="tab"
            class="level-switcher__btn"
            :class="{ 'level-switcher__btn--active': topology?.mode === 'racks' }"
            :aria-selected="topology?.mode === 'racks'"
            :disabled="!focusedRoomId && topology?.mode !== 'racks'"
            @click="enterRackLevel"
          >
            机柜级
          </button>
          <button
            type="button"
            role="tab"
            class="level-switcher__btn"
            :class="{ 'level-switcher__btn--active': topology?.mode === 'devices' }"
            :aria-selected="topology?.mode === 'devices'"
            :disabled="!focusedRoomId"
            data-testid="enter-device-level"
            @click="enterDeviceLevel"
          >
            设备级
          </button>
        </div>
        <div class="topology-actions">
          <label
            v-if="topology?.mode === 'devices'"
            class="anim-toggle"
            title="动画仅表示登记的线路方向，不代表实时带宽、流量、设备负载或实际路由。"
          >
            <input v-model="animationEnabled" type="checkbox" />
            流动动画
          </label>
          <span
            v-if="topology?.mode === 'devices'"
            class="non-realtime-badge"
            title="动画仅表示登记的线路方向，不代表实时带宽、流量、设备负载或实际路由。"
          >
            配置拓扑 · 非实时数据
          </span>
          <button
            v-if="topology?.mode === 'devices'"
            type="button"
            class="btn"
            title="适应屏幕"
            @click="fitDeviceToScreen"
          >
            适应屏幕
          </button>
          <button type="button" class="btn" :disabled="loading" @click="reload">刷新</button>
        </div>
      </div>
    </header>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-else-if="loading && !topology">加载中…</p>
    <p v-else-if="topology && topology.rooms.length === 0">暂无机房</p>

    <div v-if="topology?.mode === 'rooms'" class="topology-filters" aria-label="机房线缆筛选">
      <span class="filter-label">2.5D视图</span>
      <fieldset>
        <legend>线路类型</legend>
        <label v-for="type in availableRoomCableTypes" :key="type">
          <input
            type="checkbox"
            :checked="roomCableTypes.includes(type)"
            @change="toggleRoomCableType(type)"
          />
          {{ type }}
        </label>
      </fieldset>
      <fieldset>
        <legend>用途</legend>
        <label v-for="purpose in availableRoomPurposes" :key="purpose">
          <input
            type="checkbox"
            :checked="roomPurposes.includes(purpose)"
            @change="toggleRoomPurpose(purpose)"
          />
          {{ purpose }}
        </label>
      </fieldset>
      <fieldset>
        <legend>状态</legend>
        <label v-for="status in availableRoomStatuses" :key="status">
          <input
            type="checkbox"
            :checked="roomStatuses.includes(status)"
            @change="toggleRoomStatus(status)"
          />
          {{ status }}
        </label>
      </fieldset>
      <label class="anim-toggle">
        <input v-model="roomAnimationEnabled" type="checkbox" />
        流动动画
      </label>
      <span
        v-if="roomAnimationEnabled && !selectedRoomConnectionId"
        class="non-realtime-badge"
        data-testid="animation-notice"
      >
        请先选择线路
      </span>
      <span
        v-if="roomAnimationEnabled"
        class="non-realtime-badge"
        data-testid="non-realtime-badge"
      >
        非实时流量：动画仅表示配置的线路方向，不代表实时带宽、实时流量或设备运行状态。
      </span>
    </div>

    <div v-if="topology?.mode === 'devices'" class="topology-filters topology-filters--devices" aria-label="线缆筛选">
      <label class="filter-text">
        设备名称
        <input v-model="deviceNameQuery" type="search" placeholder="筛选设备名" />
      </label>
      <fieldset>
        <legend>设备类型</legend>
        <button
          v-for="type in availableDeviceTypes"
          :key="type"
          type="button"
          class="filter-chip"
          :class="{ 'filter-chip--active': selectedDeviceTypes.includes(type) }"
          :aria-pressed="selectedDeviceTypes.includes(type)"
          @click="toggleDeviceType(type)"
        >
          {{ type }}
        </button>
      </fieldset>
      <fieldset>
        <legend>线路类型</legend>
        <button
          v-for="type in availableCableTypes"
          :key="type"
          type="button"
          class="filter-chip"
          :class="{ 'filter-chip--active': selectedCableTypes.includes(type) }"
          :aria-pressed="selectedCableTypes.includes(type)"
          @click="toggleCableType(type)"
        >
          {{ type }}
        </button>
      </fieldset>
      <fieldset>
        <legend>线路状态</legend>
        <button
          v-for="status in availableLineStatuses"
          :key="status"
          type="button"
          class="filter-chip"
          :class="{ 'filter-chip--active': selectedLineStatuses.includes(status) }"
          :aria-pressed="selectedLineStatuses.includes(status)"
          @click="toggleLineStatus(status)"
        >
          {{ status }}
        </button>
      </fieldset>
      <fieldset>
        <legend>线路用途</legend>
        <button
          v-for="purpose in availablePurposes"
          :key="purpose"
          type="button"
          class="filter-chip"
          :class="{ 'filter-chip--active': selectedPurposes.includes(purpose) }"
          :aria-pressed="selectedPurposes.includes(purpose)"
          @click="togglePurpose(purpose)"
        >
          {{ purpose }}
        </button>
      </fieldset>
      <button type="button" class="btn filter-clear" @click="clearDeviceFilters">清除筛选</button>
    </div>

    <div class="topology-body" :class="{ 'topology-body--with-panel': !!selectedCable || !!selectedRoomConnection }">
      <div
        ref="containerRef"
        class="topology-canvas"
        :class="{ 'topology-canvas--devices': topology?.mode === 'devices' }"
      >
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
            <span>{{ item.purpose }}</span>
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

      <aside v-if="selectedRoomConnection" class="cable-detail-panel" aria-label="链路详情">
        <div class="cable-detail-panel__header">
          <h2>链路详情</h2>
          <button type="button" class="btn" @click="selectedRoomConnectionId = null">关闭</button>
        </div>
        <dl>
          <dt>起点机房</dt>
          <dd>
            <span
              class="dot"
              :style="{ background: purposeLineColor(selectedRoomConnection.purpose, selectedRoomConnection.status) }"
            />
            {{ topology?.rooms.find((r) => r.id === selectedRoomConnection.sourceRoomId)?.name ?? '—' }}
          </dd>
          <dt>终点机房</dt>
          <dd>
            <span
              class="dot"
              :style="{ background: purposeLineColor(selectedRoomConnection.purpose, selectedRoomConnection.status) }"
            />
            {{ topology?.rooms.find((r) => r.id === selectedRoomConnection.targetRoomId)?.name ?? '—' }}
          </dd>
          <dt>线路类型</dt>
          <dd>{{ selectedRoomConnection.cableType }}</dd>
          <dt>聚合线缆数量</dt>
          <dd>{{ selectedRoomConnection.cableCount }}</dd>
          <dt>状态</dt>
          <dd>{{ selectedRoomConnection.status }}</dd>
          <dt>带宽</dt>
          <dd>未配置</dd>
          <dt>流向</dt>
          <dd>聚合链路</dd>
        </dl>
      </aside>

      <aside v-if="selectedCable" class="cable-detail-panel" aria-label="线路详情">
        <div class="cable-detail-panel__header">
          <h2>线路详情</h2>
          <button type="button" class="btn" @click="clearCableSelection">关闭</button>
        </div>
        <dl>
          <dt>起点设备</dt>
          <dd>{{ selectedCable.source.deviceName }}</dd>
          <dt>起点端口</dt>
          <dd>{{ formatPortDisplay(selectedCable.source.portName) }}</dd>
          <dt>终点设备</dt>
          <dd>{{ selectedCable.target.deviceName }}</dd>
          <dt>终点端口</dt>
          <dd>{{ formatPortDisplay(selectedCable.target.portName) }}</dd>
          <dt>线路类型</dt>
          <dd>{{ selectedCable.cableType }}</dd>
          <dt>线路用途</dt>
          <dd>{{ purposeLabel(selectedCable.purpose, selectedCable.cableType) }}</dd>
          <dt>线路状态</dt>
          <dd>{{ selectedCable.status }}</dd>
          <dt>带宽</dt>
          <dd>未配置</dd>
          <dt>方向</dt>
          <dd>单向</dd>
          <dt>所属机房</dt>
          <dd>{{ focusedRoom?.name ?? '—' }}</dd>
          <dt>所属机柜</dt>
          <dd>{{ selectedCable.source.rackCode ?? '—' }} → {{ selectedCable.target.rackCode ?? '—' }}</dd>
          <dt>完整路径</dt>
          <dd>{{ selectedPathLabel }}</dd>
          <dt>源端口 Speed</dt>
          <dd>{{ formatSpeed(selectedCable.source.speed) }}</dd>
          <dt>目标端口 Speed</dt>
          <dd>{{ formatSpeed(selectedCable.target.speed) }}</dd>
        </dl>
      </aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Konva from 'konva'
import { useAuth } from '../composables/useAuth'
import { useApi } from '../composables/useApi'
import {
  buildRoomGridLayout,
  cableTypeColor,
  connectionBundleId,
  filterRoomConnections,
  primaryCableType,
  purposeLineColor,
  roomPlatformEdgePoint,
  routeRoomCable,
  ROOM_PLATFORM_H,
  ROOM_PLATFORM_W,
  TOPOLOGY_PALETTE,
  useTopology,
  type TopologyCableDetail,
  type TopologyRoom,
  type TopologyRoomConnection,
} from '../composables/useTopology'
import CableLayer from '../components/CableLayer.vue'
import {
  buildCableScene,
  buildUniquePortLabelPlacements,
  computeFitToScreenTransform,
  DEVICE_U_PX,
  filterActiveDeviceSnapshot,
  filterVisibleDevices,
  formatPortLabel,
  portSlotKey,
  purposeDisplayName,
  staticArrowPositions,
  UNSELECTED_OPACITY,
  type CableFocus,
  type CableInfo,
  type CableScene,
  type CableSnapshot,
  type DeviceInfo,
  type RackInfo,
} from '../composables/useCableScene'

const route = useRoute()
const router = useRouter()

const ROOM_ADMIN_ROLE = '机房管理员'
const ROOM_W = ROOM_PLATFORM_W
const ROOM_H = ROOM_PLATFORM_H
const RACK_W = 90
const RACK_H = 56
const DEVICE_RACK_W = 240
const RACK_GAP_X = 340
const RACK_DEPTH_X = 16
const RACK_DEPTH_Y = 10
const COMPACT_EMPTY_RACK_H = 240
const DEVICE_FIT_PADDING = 72
const PLATFORM_DEPTH_X = 28
const PLATFORM_DEPTH_Y = 18
const PLATFORM_STRIP_H = 28
const PORT_RADIUS = 4
const PORT_RADIUS_SELECTED = 6

const { user } = useAuth()
const { request } = useApi()
const { data: topology, error, loading, load, loadDevices, saveRoomPosition } = useTopology()

const isRoomAdmin = computed(() => user.value?.role === ROOM_ADMIN_ROLE)
const focusedRoomId = ref<string | null>(null)
const containerRef = ref<HTMLDivElement>()
const konvaContainer = ref<HTMLDivElement>()
const saveError = ref('')
const selectedRoomConnectionId = ref<string | null>(null)
const roomCableTypes = ref<string[]>([])
const roomPurposes = ref<string[]>([])
const roomStatuses = ref<string[]>([])
const roomAnimationEnabled = ref(false)
const animationEnabled = ref(false)
const focusDeviceId = ref<string | null>(null)
const selectedCableId = ref<string | null>(null)
const selectedCableTypes = ref<string[]>([])
const selectedPurposes = ref<string[]>([])
const selectedDeviceTypes = ref<string[]>([])
const selectedLineStatuses = ref<string[]>([])
const deviceNameQuery = ref('')
const laidSnapshot = ref<CableSnapshot | null>(null)
const stageSize = ref({ width: 800, height: 760 })
const stagePos = ref({ x: 0, y: 0 })
const stageScale = ref(1)
/** Logical content size for the SVG cable overlay (matches laid device layout). */
const overlayContentSize = ref({ width: 800, height: 760 })

const tooltip = ref<{
  x: number
  y: number
  title: string
  lines: string[]
  cables?: TopologyCableDetail[]
} | null>(null)

let stage: Konva.Stage | null = null
let layer: Konva.Layer | null = null
let roomGroups = new Map<string, Konva.Group>()
let roomCableAnimation: Konva.Animation | null = null
let resizeObserver: ResizeObserver | null = null
let deviceViewportBound = false
/** Avoid resetting user pan/zoom on every focus redraw in devices mode. */
let deviceFitAppliedForSnapshot: string | null = null

const focusedRoom = computed(() => {
  const id = focusedRoomId.value ?? topology.value?.focusedRoomId ?? null
  if (!id || !topology.value) return null
  return topology.value.rooms.find((room) => room.id === id)
    ?? topology.value.rooms.find((room) => room.id.toLowerCase() === id.toLowerCase())
    ?? null
})

const filteredRoomConnections = computed(() => {
  if (!topology.value || topology.value.mode !== 'rooms') return [] as TopologyRoomConnection[]
  return filterRoomConnections(topology.value.roomConnections, {
    cableTypes: roomCableTypes.value.length ? roomCableTypes.value : undefined,
    purposes: roomPurposes.value.length ? roomPurposes.value : undefined,
    statuses: roomStatuses.value.length ? roomStatuses.value : undefined,
  })
})

const selectedRoomConnection = computed(() => {
  if (!selectedRoomConnectionId.value || !topology.value) return null
  return topology.value.roomConnections.find(
    (c) => connectionBundleId(c) === selectedRoomConnectionId.value,
  ) ?? null
})

const availableRoomCableTypes = computed(() => {
  if (!topology.value) return [] as string[]
  return [...new Set(topology.value.roomConnections.map((c) => c.cableType))].sort()
})

const availableRoomPurposes = computed(() => {
  if (!topology.value) return [] as string[]
  return [...new Set(topology.value.roomConnections.map((c) => c.purpose))].sort()
})

const availableRoomStatuses = computed(() => {
  if (!topology.value) return [] as string[]
  return [...new Set(topology.value.roomConnections.map((c) => c.status))].sort()
})

const pageTitle = computed(() => {
  if (topology.value?.mode === 'devices' && focusedRoom.value) {
    const location = focusedRoom.value.location?.trim()
    return location || `${focusedRoom.value.name} / 位置未登记`
  }
  return '机房线缆拓扑'
})

const subtitle = computed(() => {
  if (topology.value?.mode === 'devices') {
    return '单击设备或线路查看端口标签与链路详情'
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

const availableDeviceTypes = computed(() => {
  const snapshot = topology.value?.cableSnapshot
  if (!snapshot) return [] as string[]
  return [...new Set(snapshot.devices.map((d) => d.deviceType).filter(Boolean))].sort()
})

const availableLineStatuses = ['正常', '告警']

const selectedCable = computed<CableInfo | null>(() => {
  if (!selectedCableId.value || !topology.value?.cableSnapshot) return null
  return topology.value.cableSnapshot.cables.find((c) => c.cableId === selectedCableId.value) ?? null
})

const selectedPathLabel = computed(() => {
  const cable = selectedCable.value
  if (!cable) return '—'
  return `${cable.source.rackCode ?? '—'} / ${cable.source.deviceName} / ${formatPortLabel(cable.source.portName)} → ${cable.target.rackCode ?? '—'} / ${cable.target.deviceName} / ${formatPortLabel(cable.target.portName)}`
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
      deviceNameQuery: deviceNameQuery.value,
      deviceTypes: selectedDeviceTypes.value,
      lineStatuses: selectedLineStatuses.value,
    },
    focusedRoomId.value,
    {
      expandToCables: true,
      selectedCableId: selectedCableId.value,
    },
  )
})

const cableOverlayStyle = computed(() => ({
  width: `${overlayContentSize.value.width}px`,
  height: `${overlayContentSize.value.height}px`,
  transform: `translate(${stagePos.value.x}px, ${stagePos.value.y}px) scale(${stageScale.value})`,
  transformOrigin: '0 0',
}))

function formatPortDisplay(portName: string): string {
  return formatPortLabel(portName)
}

function purposeLabel(purpose: string, cableType: string): string {
  return purposeDisplayName(purpose, cableType)
}

function syncDeviceOverlay(): void {
  if (!stage) return
  stagePos.value = { x: stage.x(), y: stage.y() }
  stageScale.value = stage.scaleX()
}

function resetDeviceViewport(): void {
  if (!stage) return
  stage.scale({ x: 1, y: 1 })
  stage.position({ x: 0, y: 0 })
  syncDeviceOverlay()
  deviceFitAppliedForSnapshot = null
}

function fitDeviceToScreen(): void {
  if (!stage || !laidSnapshot.value) return
  const transform = computeFitToScreenTransform(laidSnapshot.value.racks, {
    width: stage.width(),
    height: stage.height(),
  }, { padding: DEVICE_FIT_PADDING })
  stage.scale({ x: transform.scale, y: transform.scale })
  stage.position({ x: transform.x, y: transform.y })
  syncDeviceOverlay()
  stage.batchDraw()
}

function deviceSnapshotKey(snapshot: CableSnapshot): string {
  return [
    snapshot.racks.map((r) => r.rackId).join(','),
    snapshot.devices.map((d) => d.deviceId).join(','),
    snapshot.cables.map((c) => c.cableId).join(','),
  ].join('|')
}

function bindDeviceViewportControls(): void {
  if (!stage || deviceViewportBound) return
  deviceViewportBound = true

  stage.on('wheel', (event) => {
    if (topology.value?.mode !== 'devices') return
    event.evt.preventDefault()
    const oldScale = stage!.scaleX()
    const pointer = stage!.getPointerPosition()
    if (!pointer) return
    const zoomIn = event.evt.deltaY < 0
    const newScale = Math.min(3, Math.max(0.2, oldScale * (zoomIn ? 1.1 : 1 / 1.1)))
    stage!.scale({ x: newScale, y: newScale })
    stage!.position({
      x: pointer.x - (pointer.x - stage!.x()) * (newScale / oldScale),
      y: pointer.y - (pointer.y - stage!.y()) * (newScale / oldScale),
    })
    syncDeviceOverlay()
    stage!.batchDraw()
  })

  let panning = false
  stage.on('mousedown.devicePan', (event) => {
    if (topology.value?.mode !== 'devices') return
    if (event.target === stage) panning = true
  })
  stage.on('mousemove.devicePan', (event) => {
    if (!panning || topology.value?.mode !== 'devices') return
    const pos = stage!.position()
    stage!.position({
      x: pos.x + event.evt.movementX,
      y: pos.y + event.evt.movementY,
    })
    syncDeviceOverlay()
    stage!.batchDraw()
  })
  stage.on('mouseup.devicePan', () => {
    panning = false
  })
  stage.on('mouseleave.devicePan', () => {
    panning = false
  })
}

function applyDeviceViewportMode(enabled: boolean): void {
  if (!stage) return
  if (!enabled) {
    resetDeviceViewport()
  }
}

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

function toggleDeviceType(type: string): void {
  const set = new Set(selectedDeviceTypes.value)
  if (set.has(type)) set.delete(type)
  else set.add(type)
  selectedDeviceTypes.value = [...set]
}

function toggleLineStatus(status: string): void {
  const set = new Set(selectedLineStatuses.value)
  if (set.has(status)) set.delete(status)
  else set.add(status)
  selectedLineStatuses.value = [...set]
}

function clearDeviceFilters(): void {
  selectedCableTypes.value = []
  selectedPurposes.value = []
  selectedDeviceTypes.value = []
  selectedLineStatuses.value = []
  deviceNameQuery.value = ''
}

async function reload(): Promise<void> {
  if (topology.value?.mode === 'devices' && focusedRoomId.value) {
    await loadDevices(focusedRoomId.value)
    return
  }
  await load(focusedRoomId.value)
}

async function exitRoomFocus(): Promise<void> {
  focusDeviceId.value = null
  selectedCableId.value = null
  clearDeviceFilters()
  laidSnapshot.value = null
  await navigateToView(null, 'rooms')
}

async function enterRackLevel(): Promise<void> {
  if (!focusedRoomId.value) return
  focusDeviceId.value = null
  selectedCableId.value = null
  clearDeviceFilters()
  laidSnapshot.value = null
  await navigateToView(focusedRoomId.value, 'racks')
}

async function enterDeviceLevel(): Promise<void> {
  if (!focusedRoomId.value) return
  focusDeviceId.value = null
  selectedCableId.value = null
  clearDeviceFilters()
  await navigateToView(focusedRoomId.value, 'devices')
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
  const canvasW = konvaContainer.value?.clientWidth || stageSize.value.width || 1536
  return buildRoomGridLayout(rooms, 380, 260, 48, canvasW)
}

function strokeWidthForCount(count: number): number {
  return Math.max(2, Math.min(14, 2 + Math.log2(count + 1) * 2.5))
}

function layoutDeviceSnapshot(snapshot: CableSnapshot): CableSnapshot {
  const filtered = filterActiveDeviceSnapshot(snapshot)
  const floorRack = filtered.racks.find((r) => r.code === 'FLOOR')
  const rackRacks = filtered.racks
    .filter((r) => r.code !== 'FLOOR' && !r.code.startsWith('STUB-'))
    .sort((a, b) => a.code.localeCompare(b.code))
  const floorDevices = floorRack
    ? filtered.devices.filter((d) => d.rackId === floorRack.rackId)
    : []

  const devicesByRack = new Map<string, DeviceInfo[]>()
  for (const device of filtered.devices) {
    if (floorRack && device.rackId === floorRack.rackId) continue
    const list = devicesByRack.get(device.rackId) ?? []
    list.push(device)
    devicesByRack.set(device.rackId, list)
  }

  const laidRacks: RackInfo[] = []
  const laidDevices: DeviceInfo[] = []
  const colCount = 4
  let cursorY = 110
  const rowCount = Math.max(1, Math.ceil(rackRacks.length / colCount))
  for (let row = 0; row < rowCount && rackRacks.length > 0; row++) {
    const slice = rackRacks.slice(row * colCount, row * colCount + colCount)
    let rowMaxH = COMPACT_EMPTY_RACK_H
    for (let col = 0; col < slice.length; col++) {
      const rack = slice[col]!
      const devices = (devicesByRack.get(rack.rackId) ?? [])
        .slice()
        .sort((a, b) => a.startU - b.startU || a.deviceName.localeCompare(b.deviceName))
      const maxEndU = devices.length > 0 ? Math.max(...devices.map((d) => d.endU)) : 0
      const height = maxEndU > 0
        ? Math.max(maxEndU * DEVICE_U_PX + 32, 120)
        : COMPACT_EMPTY_RACK_H
      rowMaxH = Math.max(rowMaxH, height)
      laidRacks.push({
        ...rack,
        x: 80 + col * RACK_GAP_X,
        y: cursorY,
        width: DEVICE_RACK_W,
        height,
      })
      for (const device of devices) {
        laidDevices.push({ ...device })
      }
    }
    cursorY += rowMaxH + 48
  }

  // Floor network + storage devices sit below the last rack row.
  if (floorDevices.length > 0) {
    const baseY = laidRacks.length > 0 ? cursorY : 110
    const network = floorDevices.filter((d) =>
      d.deviceType.includes('交换') || d.deviceType.includes('防火') || d.deviceName.startsWith('SW-') || d.deviceName.startsWith('FW-'),
    )
    const storage = floorDevices.filter((d) =>
      d.deviceType.includes('存储') || d.deviceType.includes('备份') || d.deviceName.startsWith('STORAGE') || d.deviceName.startsWith('BAK'),
    )
    const placeFloorDevice = (device: DeviceInfo, x: number, y: number, slotU: number) => {
      const floorId = `floor-${device.deviceId}`
      laidRacks.push({
        rackId: floorId,
        code: device.deviceName,
        x,
        y,
        width: DEVICE_RACK_W,
        height: Math.max(device.endU - device.startU + 1, 1) * DEVICE_U_PX + 16,
      })
      laidDevices.push({
        ...device,
        rackId: floorId,
        startU: 1,
        endU: Math.max(1, device.endU - device.startU + 1),
      })
    }
    network.forEach((device, i) => {
      const x = 80 + i * RACK_GAP_X
      placeFloorDevice(device, x, baseY, i + 1)
    })
    storage.forEach((device, i) => {
      const x = 80 + i * RACK_GAP_X
      placeFloorDevice(device, x, baseY + 180, i + 1)
    })
  }

  const deviceRackByDeviceId = new Map(laidDevices.map((d) => [d.deviceId, d.rackId]))
  const rackCodeByRackId = new Map(laidRacks.map((r) => [r.rackId, r.code]))
  const remappedCables = filtered.cables.map((c) => {
    const srcRackId = deviceRackByDeviceId.get(c.source.deviceId) ?? c.source.rackId
    const tgtRackId = deviceRackByDeviceId.get(c.target.deviceId) ?? c.target.rackId
    return {
      ...c,
      source: {
        ...c.source,
        rackId: srcRackId,
        rackCode: (srcRackId && rackCodeByRackId.get(srcRackId)) ?? c.source.rackCode,
      },
      target: {
        ...c.target,
        rackId: tgtRackId,
        rackCode: (tgtRackId && rackCodeByRackId.get(tgtRackId)) ?? c.target.rackCode,
      },
    }
  })

  return {
    racks: laidRacks,
    devices: laidDevices,
    cables: remappedCables,
  }
}

function statusLampColor(status: string): string {
  if (status === '异常') return '#FF4D5A'
  if (status === '维护') return '#FFB341'
  return '#8FECB0'
}

function classifyDeviceKind(deviceType: string): 'server' | 'switch' | 'firewall' | 'storage' | 'generic' {
  const t = deviceType.toLowerCase()
  if (deviceType.includes('交换') || t.includes('switch')) return 'switch'
  if (deviceType.includes('防火') || t.includes('firewall')) return 'firewall'
  if (deviceType.includes('存储') || t.includes('storage') || deviceType.includes('备份')) return 'storage'
  if (deviceType.includes('服务') || t.includes('server') || deviceType.includes('主机')) return 'server'
  return 'generic'
}

function drawIsoPlatform(
  racks: RackInfo[],
  areaLabel: string,
): void {
  if (!layer || racks.length === 0) return
  const minX = Math.min(...racks.map((r) => r.x)) - 48
  const maxX = Math.max(...racks.map((r) => r.x + r.width)) + 48
  const minY = Math.min(...racks.map((r) => r.y)) - 28
  const maxY = Math.max(...racks.map((r) => r.y + r.height)) + 48
  const stripH = PLATFORM_STRIP_H
  const w = maxX - minX
  const dx = PLATFORM_DEPTH_X
  const dy = PLATFORM_DEPTH_Y

  // Shadow under platform
  layer.add(new Konva.Line({
    points: [
      minX + 10, maxY + stripH + 8,
      maxX + 10, maxY + stripH + 8,
      maxX + dx + 10, maxY - dy + stripH + 8,
      minX + dx + 10, maxY - dy + stripH + 8,
    ],
    closed: true,
    fill: 'rgba(0,0,0,0.35)',
    listening: false,
  }))

  // Top face (brightest) — full rack footprint projected onto floor plane
  layer.add(new Konva.Line({
    points: [
      minX, maxY,           // front-left
      maxX, maxY,           // front-right
      maxX + dx, minY - dy, // back-right
      minX + dx, minY - dy, // back-left
    ],
    closed: true,
    fill: '#1A3354',
    stroke: '#2E4A6E',
    strokeWidth: 1,
    listening: false,
  }))

  // Perspective grid on top face
  for (let gx = 0; gx <= w; gx += 36) {
    layer.add(new Konva.Line({
      points: [minX + gx, maxY, minX + gx + dx, minY - dy],
      stroke: 'rgba(91,118,152,0.22)',
      strokeWidth: 1,
      listening: false,
    }))
  }
  const depth = Math.max(maxY - minY, 1)
  for (let gy = 0; gy <= depth; gy += 36) {
    const t = gy / depth
    layer.add(new Konva.Line({
      points: [
        minX + t * dx, maxY - gy,
        maxX + t * dx, maxY - gy,
      ],
      stroke: 'rgba(91,118,152,0.12)',
      strokeWidth: 1,
      listening: false,
    }))
  }

  // Front face — thin strip at bottom
  layer.add(new Konva.Line({
    points: [
      minX, maxY,
      maxX, maxY,
      maxX, maxY + stripH,
      minX, maxY + stripH,
    ],
    closed: true,
    fill: '#12253F',
    stroke: '#2E4A6E',
    strokeWidth: 1,
    listening: false,
  }))

  // Right side face (darkest) — thin strip, shares edge with top face
  layer.add(new Konva.Line({
    points: [
      maxX, maxY,
      maxX + dx, minY - dy,
      maxX + dx, minY - dy + stripH,
      maxX, maxY + stripH,
    ],
    closed: true,
    fill: '#0C1A2E',
    stroke: '#2E4A6E',
    strokeWidth: 1,
    listening: false,
  }))

  // Area nameplate on front face
  layer.add(new Konva.Rect({
    x: minX + w / 2 - 70,
    y: maxY + stripH - 28,
    width: 140,
    height: 22,
    cornerRadius: 4,
    fill: '#0B1B31',
    stroke: '#39D2C0',
    strokeWidth: 1,
    listening: false,
  }))
  layer.add(new Konva.Text({
    x: minX + w / 2 - 70,
    y: maxY + stripH - 24,
    width: 140,
    align: 'center',
    text: areaLabel || '设备区域',
    fontSize: 12,
    fill: '#F8F9FA',
    listening: false,
  }))
}

function drawIsoRack(rack: RackInfo, empty: boolean): void {
  if (!layer) return
  const x = rack.x
  const y = rack.y
  const w = rack.width
  const h = rack.height
  const dx = RACK_DEPTH_X
  const dy = RACK_DEPTH_Y

  // Drop shadow
  layer.add(new Konva.Rect({
    x: x + 6,
    y: y + h + 4,
    width: w,
    height: 10,
    fill: 'rgba(0,0,0,0.35)',
    cornerRadius: 4,
    listening: false,
  }))

  // Top face
  layer.add(new Konva.Line({
    points: [x, y, x + w, y, x + w + dx, y - dy, x + dx, y - dy],
    closed: true,
    fill: '#2A3F5F',
    stroke: '#3D5578',
    strokeWidth: 1,
    listening: false,
  }))

  // Right side
  layer.add(new Konva.Line({
    points: [x + w, y, x + w + dx, y - dy, x + w + dx, y + h - dy, x + w, y + h],
    closed: true,
    fill: '#152338',
    stroke: '#3D5578',
    strokeWidth: 1,
    listening: false,
  }))

  // Front face (equipment bay)
  layer.add(new Konva.Rect({
    x,
    y,
    width: w,
    height: h,
    fill: '#182942',
    stroke: '#4A6388',
    strokeWidth: 1.5,
    listening: false,
  }))

  // Inner bay
  layer.add(new Konva.Rect({
    x: x + 6,
    y: y + 6,
    width: w - 12,
    height: h - 12,
    fill: '#0E1A2C',
    stroke: '#0D1117',
    strokeWidth: 1,
    listening: false,
  }))

  // Rack name on top band
  layer.add(new Konva.Text({
    x: x + dx,
    y: y - dy - 18,
    width: w,
    align: 'center',
    text: rack.code,
    fontSize: 13,
    fontStyle: 'bold',
    fill: '#F8F9FA',
    listening: false,
  }))

  if (empty) {
    layer.add(new Konva.Text({
      x: x + 6,
      y: y + h / 2 - 8,
      width: w - 12,
      align: 'center',
      text: '暂无设备',
      fontSize: 13,
      fill: '#5B7698',
      listening: false,
    }))
  }
}

function drawDevicePanel(
  group: Konva.Group,
  device: DeviceInfo,
  panelW: number,
  panelH: number,
  focusedDevice: boolean,
  endpointHighlighted: boolean,
): void {
  const kind = classifyDeviceKind(device.deviceType)
  const stroke = focusedDevice || endpointHighlighted ? '#39D2C0' : '#0D1117'
  const strokeWidth = focusedDevice || endpointHighlighted ? 2.5 : 1
  const baseFill = kind === 'switch'
    ? '#16324F'
    : kind === 'firewall'
      ? '#3A1B24'
      : kind === 'storage'
        ? '#3A2E14'
        : kind === 'server'
          ? '#1B2A3D'
          : '#222C38'

  const compact = panelH < 24 || kind === 'switch' || kind === 'storage' || kind === 'firewall'
  const bodyW = compact ? 120 : panelW

  if (compact) {
    group.add(new Konva.Rect({
      width: panelW,
      height: panelH,
      fill: 'transparent',
    }))
  }

  group.add(new Konva.Rect({
    width: bodyW,
    height: panelH,
    cornerRadius: 3,
    fill: baseFill,
    stroke,
    strokeWidth,
    shadowColor: focusedDevice || endpointHighlighted ? 'rgba(57,210,192,0.45)' : 'transparent',
    shadowBlur: focusedDevice || endpointHighlighted ? 10 : 0,
    name: 'device-panel',
  }))

  // Type-specific panel details
  if (kind === 'server') {
    for (let i = 0; i < 4; i++) {
      group.add(new Konva.Rect({
        x: 8 + i * 14,
        y: Math.max(4, panelH - 12),
        width: 10,
        height: 6,
        fill: '#0D1117',
        stroke: '#3D5578',
        strokeWidth: 0.5,
        listening: false,
      }))
    }
  } else if (kind === 'switch') {
    const slots = Math.min(12, Math.max(4, Math.floor((bodyW - 20) / 10)))
    for (let i = 0; i < slots; i++) {
      group.add(new Konva.Rect({
        x: 10 + i * 10,
        y: Math.max(4, panelH / 2 - 3),
        width: 7,
        height: 6,
        fill: '#071426',
        stroke: '#39D9FF',
        strokeWidth: 0.5,
        listening: false,
      }))
    }
  } else if (kind === 'firewall') {
    group.add(new Konva.Text({
      x: bodyW - 28,
      y: 4,
      text: 'FW',
      fontSize: 10,
      fontStyle: 'bold',
      fill: '#FF4D5A',
      listening: false,
    }))
    for (let i = 0; i < 3; i++) {
      group.add(new Konva.Circle({
        x: 14 + i * 12,
        y: panelH - 8,
        radius: 3,
        fill: '#071426',
        stroke: '#FF4D5A',
        strokeWidth: 1,
        listening: false,
      }))
    }
  } else if (kind === 'storage') {
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 5; col++) {
        group.add(new Konva.Rect({
          x: 10 + col * 16,
          y: 6 + row * 10,
          width: 12,
          height: 7,
          fill: '#0D1117',
          stroke: '#FFB341',
          strokeWidth: 0.5,
          listening: false,
        }))
      }
    }
  }

  // Status lamp
  group.add(new Konva.Circle({
    x: bodyW - 10,
    y: 10,
    radius: 4,
    fill: statusLampColor(device.operationalStatus),
    stroke: '#0D1117',
    strokeWidth: 1,
    listening: false,
    name: 'status-lamp',
  }))

  group.add(new Konva.Text({
    x: compact ? bodyW + 4 : 8,
    y: compact ? 2 : Math.max(4, panelH / 2 - 7),
    width: compact ? Math.max(0, panelW - bodyW - 4) : panelW - 28,
    height: compact ? 14 : undefined,
    text: device.deviceName,
    fontSize: 11,
    fill: '#F8F9FA',
    ellipsis: true,
    listening: false,
    name: 'device-name',
  }))
}

function drawPortAnchors(
  scene: CableScene,
  snapshot: CableSnapshot,
  selectedId: string | null,
): void {
  if (!layer) return
  const selected = selectedId
    ? snapshot.cables.find((c) => c.cableId === selectedId) ?? null
    : null

  const drawnPorts = new Set<string>()
  for (const bundle of scene.bundles) {
    if (bundle.opacity <= 0 || bundle.route.length < 2) continue
    const cable = snapshot.cables.find((c) => c.cableId === bundle.id)
    if (!cable) continue
    const endpoints = [
      { point: bundle.route[0], portName: cable.source.portName, deviceId: cable.source.deviceId },
      {
        point: bundle.route[bundle.route.length - 1],
        portName: cable.target.portName,
        deviceId: cable.target.deviceId,
      },
    ]
    for (const endpoint of endpoints) {
      const key = portSlotKey(endpoint.deviceId, endpoint.portName)
      if (drawnPorts.has(key)) continue
      drawnPorts.add(key)
      const selectedEndpoint = !!selected && (
        (selected.source.deviceId === endpoint.deviceId && selected.source.portName === endpoint.portName)
        || (selected.target.deviceId === endpoint.deviceId && selected.target.portName === endpoint.portName)
      )
      const radius = selectedEndpoint ? PORT_RADIUS_SELECTED : PORT_RADIUS
      layer.add(new Konva.Circle({
        x: endpoint.point.x,
        y: endpoint.point.y,
        radius,
        fill: selectedEndpoint ? '#39D2C0' : '#8FECB0',
        stroke: '#0D1117',
        strokeWidth: 1,
        listening: false,
        name: 'port-anchor',
      }))
    }
  }

  let labelBundles: typeof scene.bundles = []
  let labelCables: typeof snapshot.cables = []
  if (selectedId) {
    const bundle = scene.bundles.find((b) => b.id === selectedId)
    const cable = snapshot.cables.find((c) => c.cableId === selectedId)
    if (bundle && cable && bundle.opacity > 0) {
      labelBundles = [bundle]
      labelCables = [cable]
    }
  } else if (focusDeviceId.value) {
    const focusedId = focusDeviceId.value
    labelCables = snapshot.cables.filter(
      (c) => c.source.deviceId === focusedId || c.target.deviceId === focusedId,
    )
    const ids = new Set(labelCables.map((c) => c.cableId))
    labelBundles = scene.bundles.filter((b) => ids.has(b.id) && b.opacity > 0)
  }
  if (labelBundles.length === 0) return

  const canvasHeight = Math.max(
    stageSize.value.height,
    ...snapshot.racks.map((r) => r.y + r.height + 100),
  )
  let placements = buildUniquePortLabelPlacements(
    labelBundles,
    labelCables,
    snapshot.devices,
    snapshot.racks,
    { canvasHeight },
  )
  if (focusDeviceId.value && !selectedId) {
    placements = placements.filter((p) => p.deviceId === focusDeviceId.value)
  }
  for (const placement of placements) {
    layer.add(new Konva.Text({
      x: placement.rect.x,
      y: placement.rect.y,
      width: placement.rect.width,
      align: placement.side === 'left' ? 'right' : 'left',
      text: formatPortLabel(placement.portName),
      fontSize: 10,
      fill: '#C5D4E8',
      listening: false,
      name: 'port-label',
    }))
  }
}

function drawDeviceScene(): void {
  if (!stage || !layer || !topology.value?.cableSnapshot) return
  const originalSnapshot = topology.value.cableSnapshot
  const originalDevices = new Map(originalSnapshot.devices.map((d) => [d.deviceId, d]))
  const snapshot = layoutDeviceSnapshot(originalSnapshot)
  laidSnapshot.value = snapshot
  const scene = deviceCableScene.value
  const focused = focusedRoom.value
  const areaLabel = focused?.location || focused?.name || '设备区域'

  drawIsoPlatform(snapshot.racks, areaLabel)

  if (focused) {
    layer.add(new Konva.Text({
      x: 24,
      y: 20,
      text: `${focused.name} · 设备级连接`,
      fontSize: 16,
      fontStyle: 'bold',
      fill: '#F8F9FA',
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
  if (selectedCableId.value) {
    const sel = snapshot.cables.find((c) => c.cableId === selectedCableId.value)
    if (sel) {
      relatedDeviceIds.add(sel.source.deviceId)
      relatedDeviceIds.add(sel.target.deviceId)
    }
  }

  const rackCodeById = new Map(snapshot.racks.map((r) => [r.rackId, r.code]))
  const devicesByRack = new Map<string, DeviceInfo[]>()
  for (const device of snapshot.devices) {
    const list = devicesByRack.get(device.rackId) ?? []
    list.push(device)
    devicesByRack.set(device.rackId, list)
  }

  // Empty-rack chrome uses the full device inventory; panels respect name/type filters.
  const visibleDevices = filterVisibleDevices(snapshot.devices, {
    deviceNameQuery: deviceNameQuery.value,
    deviceTypes: selectedDeviceTypes.value,
  })

  for (const rack of snapshot.racks) {
    const rackDevices = devicesByRack.get(rack.rackId) ?? []
    drawIsoRack(rack, rackDevices.length === 0)
  }

  for (const device of visibleDevices) {
    const rack = snapshot.racks.find((r) => r.rackId === device.rackId)
    if (!rack) continue
    const uHeight = Math.max(1, device.endU - device.startU + 1)
    const y = rack.y + (device.startU - 1) * DEVICE_U_PX
    const height = Math.max(16, uHeight * DEVICE_U_PX - 4)
    const dimmed = (focusDeviceId.value !== null || selectedCableId.value !== null)
      && !relatedDeviceIds.has(device.deviceId)
    const focusedDevice = focusDeviceId.value === device.deviceId
    const endpointHighlighted = relatedDeviceIds.has(device.deviceId)
      && (selectedCableId.value !== null || focusedDevice)
    const panelW = rack.width - 20
    const group = new Konva.Group({
      x: rack.x + 10,
      y: y + 2,
      opacity: dimmed ? 0.28 : 1,
      name: `device-${device.deviceId}`,
    })
    drawDevicePanel(group, device, panelW, height, focusedDevice, endpointHighlighted && !focusedDevice)
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
    drawPortAnchors(scene, snapshot, selectedCableId.value)
  }

  const contentW = Math.max(
    stageSize.value.width,
    ...snapshot.racks.map((r) => r.x + r.width + RACK_DEPTH_X + 120),
  )
  const contentH = Math.max(
    stageSize.value.height,
    ...snapshot.racks.map((r) => r.y + r.height + 100),
  )
  overlayContentSize.value = { width: contentW, height: contentH }

  stage.on('click', (event) => {
    if (event.target === stage) {
      clearDeviceFocus()
    }
  })

  applyDeviceViewportMode(true)
  bindDeviceViewportControls()
  const key = deviceSnapshotKey(originalSnapshot)
  if (deviceFitAppliedForSnapshot !== key) {
    fitDeviceToScreen()
    deviceFitAppliedForSnapshot = key
  } else {
    syncDeviceOverlay()
  }
}

function drawRoomPlatform(group: Konva.Group, room: TopologyRoom, selected: boolean): void {
  const w = ROOM_W
  const h = ROOM_H
  const dx = 24
  const dy = 16

  // Transparent hit target: Group itself has no hit area; all visual children are listening:false.
  group.add(new Konva.Rect({
    x: 0,
    y: -dy,
    width: w + dx,
    height: h + dy + 8,
    fill: 'transparent',
  }))

  group.add(new Konva.Line({
    points: [8, h + 8, w + 8, h + 8, w + dx + 8, h - dy + 8, dx + 8, h - dy + 8],
    closed: true,
    fill: 'rgba(0,0,0,0.35)',
    listening: false,
  }))

  group.add(new Konva.Line({
    points: [0, 0, w, 0, w + dx, -dy, dx, -dy],
    closed: true,
    fill: '#1a3354',
    stroke: selected ? TOPOLOGY_PALETTE.accentBlue : '#2e4a6e',
    strokeWidth: selected ? 2 : 1,
    listening: false,
    name: 'room-platform-top',
  }))

  for (let gx = 0; gx <= w; gx += 36) {
    group.add(new Konva.Line({
      points: [gx, 0, gx + dx, -dy],
      stroke: 'rgba(91,118,152,0.22)',
      strokeWidth: 1,
      listening: false,
    }))
  }

  group.add(new Konva.Line({
    points: [0, 0, w, 0, w, h, 0, h],
    closed: true,
    fill: '#12253f',
    stroke: '#2e4a6e',
    strokeWidth: 1,
    listening: false,
  }))

  group.add(new Konva.Line({
    points: [w, 0, w + dx, -dy, w + dx, h - dy, w, h],
    closed: true,
    fill: '#0c1a2e',
    stroke: '#2e4a6e',
    strokeWidth: 1,
    listening: false,
  }))

  // Mini rack blocks on top
  for (let i = 0; i < Math.min(3, Math.max(1, room.rackCount)); i++) {
    const rx = 40 + i * 28
    group.add(new Konva.Rect({
      x: rx,
      y: -dy - 14,
      width: 10,
      height: 12,
      fill: room.status === '启用' ? TOPOLOGY_PALETTE.statusGreen : TOPOLOGY_PALETTE.alertRed,
      opacity: 0.85,
      listening: false,
    }))
  }

  group.add(new Konva.Text({
    x: 8,
    y: h - 52,
    width: w - 16,
    text: room.name,
    fontSize: 13,
    fontStyle: 'bold',
    fill: TOPOLOGY_PALETTE.textPrimary,
    ellipsis: true,
    listening: false,
  }))

  group.add(new Konva.Text({
    x: 8,
    y: h - 36,
    text: room.status,
    fontSize: 11,
    fill: room.status === '启用' ? TOPOLOGY_PALETTE.statusGreen : TOPOLOGY_PALETTE.alertOrange,
    listening: false,
  }))

  group.add(new Konva.Text({
    x: 8,
    y: h - 22,
    width: w - 16,
    text: `机柜 ${room.rackCount} · 服务器 ${room.serverCount} · 线缆 ${room.cableCount}`,
    fontSize: 10,
    fill: TOPOLOGY_PALETTE.textSecondary,
    listening: false,
  }))
}

function updateRoomSelection(prevId: string | null, nextId: string): void {
  const applyStroke = (id: string | null, selected: boolean): void => {
    if (!id) return
    const top = roomGroups.get(id)?.findOne('.room-platform-top')
    if (!top) return
    top.stroke(selected ? TOPOLOGY_PALETTE.accentBlue : '#2e4a6e')
    top.strokeWidth(selected ? 2 : 1)
  }
  if (prevId && prevId !== nextId) applyStroke(prevId, false)
  applyStroke(nextId, true)
  layer?.draw()
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
  applyDeviceViewportMode(false)
  overlayContentSize.value = { width: stageSize.value.width, height: stageSize.value.height }

  if (current.mode === 'rooms') {
    roomGroups.clear()
    const positions = autoLayoutRooms(current.rooms)

    const edgeSlots = new Map<string, number>()
    const slotKey = (roomId: string, edge: string) => `${roomId}|${edge}`

    // 1. Draw cables FIRST (bottom layer) — routed through gaps between rooms
    for (const connection of filteredRoomConnections.value) {
      const srcPos = positions.get(connection.sourceRoomId) ?? { x: 0, y: 0 }
      const tgtPos = positions.get(connection.targetRoomId) ?? { x: 0, y: 0 }
      const srcCenter = srcPos.x + ROOM_W / 2
      const tgtCenter = tgtPos.x + ROOM_W / 2
      const srcEdge = srcCenter <= tgtCenter ? 'right' : 'left'
      const tgtEdge = srcCenter <= tgtCenter ? 'left' : 'right'
      const srcSlot = edgeSlots.get(slotKey(connection.sourceRoomId, srcEdge)) ?? 0
      const tgtSlot = edgeSlots.get(slotKey(connection.targetRoomId, tgtEdge)) ?? 0
      edgeSlots.set(slotKey(connection.sourceRoomId, srcEdge), srcSlot + 1)
      edgeSlots.set(slotKey(connection.targetRoomId, tgtEdge), tgtSlot + 1)

      const from = roomPlatformEdgePoint(srcPos, srcEdge as 'left' | 'right', srcSlot, srcSlot + 1)
      const to = roomPlatformEdgePoint(tgtPos, tgtEdge as 'left' | 'right', tgtSlot, tgtSlot + 1)
      const route = routeRoomCable(from, to, srcPos, tgtPos)
      const flatPoints = route.flatMap((p) => [p.x, p.y])
      const bundleId = connectionBundleId(connection)
      const color = purposeLineColor(connection.purpose, connection.status, connection.cableType)
      const highlighted = selectedRoomConnectionId.value === bundleId
      const dimmed = selectedRoomConnectionId.value !== null && !highlighted

      const line = new Konva.Line({
        points: flatPoints,
        stroke: color,
        strokeWidth: highlighted ? 3 : 2,
        lineCap: 'round',
        lineJoin: 'round',
        opacity: dimmed ? UNSELECTED_OPACITY : 1,
        hitStrokeWidth: 18,
        shadowColor: highlighted ? color : 'transparent',
        shadowBlur: highlighted ? 12 : 0,
        shadowOpacity: highlighted ? 0.7 : 0,
        name: 'room-cable-bundle',
        id: `room-cable-${bundleId}`,
      })

      for (const marker of staticArrowPositions(route, 80)) {
        layer!.add(new Konva.RegularPolygon({
          x: marker.x,
          y: marker.y,
          sides: 3,
          radius: 5,
          fill: color,
          rotation: (marker.angle * 180) / Math.PI + 90,
          opacity: dimmed ? UNSELECTED_OPACITY : 1,
          listening: false,
        }))
      }

      line.on('click', (event) => {
        event.cancelBubble = true
        selectedRoomConnectionId.value = bundleId
        drawScene()
      })
      line.on('mouseenter', (event) => {
        const pointer = stage?.getPointerPosition()
        tooltip.value = {
          x: (pointer?.x ?? event.evt.offsetX) + 12,
          y: (pointer?.y ?? event.evt.offsetY) + 12,
          title: `${connection.purpose} ×${connection.cableCount}`,
          lines: [
            `类型：${connection.cableType}`,
            `状态：${connection.status}`,
          ],
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
      layer!.add(line)
    }

    // 2. Draw rooms SECOND (on top of cables — cables only visible in gaps)
    for (const room of current.rooms) {
      const pos = positions.get(room.id) ?? { x: room.topologyX, y: room.topologyY }
      const selected = focusedRoomId.value === room.id
      const group = new Konva.Group({
        x: pos.x,
        y: pos.y,
        draggable: isRoomAdmin.value,
        id: `room-${room.id}`,
      })

      drawRoomPlatform(group, room, selected)
      roomGroups.set(room.id, group)

      group.on('click', () => {
        const prev = focusedRoomId.value
        focusedRoomId.value = room.id
        updateRoomSelection(prev, room.id)
        router.replace({ query: { ...route.query, roomId: room.id, view: 'rooms' } })
      })
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
        await navigateToView(room.id, 'devices')
      })
      layer!.add(group)
    }

    stage!.on('click', (event) => {
      if (event.target === stage) {
        selectedRoomConnectionId.value = null
        drawScene()
      }
    })
  } else {
    const racks = current.racks
    const rackPos = new Map<string, { x: number; y: number }>()
    racks.forEach((rack, index) => {
      const positioned = Number.isFinite(rack.x) && Number.isFinite(rack.y)
        && !(rack.x === 0 && rack.y === 0)
      rackPos.set(rack.id, {
        x: 80 + (positioned ? rack.x * 120 : index * 120),
        y: 100 + (positioned ? rack.y * 90 : 0),
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
      group.on('click', () => {
        // Restore focusedRoomId from topology data so level switcher stays enabled.
        // Do not call drawScene() here: destroying nodes on click kills Konva dblclick.
        focusedRoomId.value = current.focusedRoomId ?? focusedRoomId.value
      })
      group.on('dblclick', async () => {
        if (!current.focusedRoomId) return
        focusedRoomId.value = current.focusedRoomId
        await loadDevices(current.focusedRoomId)
      })
      layer.add(group)
    }
  }

  layer.draw()
  syncRoomCableAnimation()
}

function stopRoomCableAnimation(): void {
  roomCableAnimation?.stop()
  roomCableAnimation = null
}

function syncRoomCableAnimation(): void {
  stopRoomCableAnimation()
  if (
    !layer
    || !roomAnimationEnabled.value
    || !selectedRoomConnectionId.value
    || topology.value?.mode !== 'rooms'
  ) {
    return
  }

  const line = layer.findOne(`#room-cable-${selectedRoomConnectionId.value}`) as Konva.Line | undefined
  if (!line) return

  line.dash([12, 8])
  let offset = 0
  roomCableAnimation = new Konva.Animation((frame) => {
    if (!frame) return
    offset = (offset + frame.timeDiff * 0.05) % 20
    line.dashOffset(-offset)
  }, layer)
  roomCableAnimation.start()
}

function computeStageSize(): { width: number; height: number } {
  const viewW = containerRef.value?.clientWidth || konvaContainer.value?.clientWidth || 800
  const viewH = containerRef.value?.clientHeight || konvaContainer.value?.clientHeight || 760
  if (!topology.value || topology.value.rooms.length === 0) return { width: viewW, height: viewH }

  // Device level uses viewport-sized stage + pan/zoom (no content-sized scroll canvas).
  if (topology.value.mode === 'devices') {
    return { width: viewW, height: viewH }
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
  if (typeof window !== 'undefined') {
    (window as unknown as { __topologyKonvaStage?: Konva.Stage }).__topologyKonvaStage = stage
  }
  drawScene()

  let observedW = stageSize.value.width
  let observedH = stageSize.value.height
  resizeObserver = new ResizeObserver(() => {
    if (!stage || !containerRef.value) return
    const { width: w, height: h } = computeStageSize()
    const sizeChanged = observedW !== w || observedH !== h
    observedW = w
    observedH = h
    stageSize.value = { width: w, height: h }
    stage.width(w)
    stage.height(h)
    drawScene()
    if (sizeChanged && topology.value?.mode === 'devices') {
      fitDeviceToScreen()
    }
  })
  const roTarget = containerRef.value ?? konvaContainer.value
  if (roTarget) resizeObserver.observe(roTarget)
}

watch(topology, () => {
  // Keep focusedRoomId in sync with topology data (safety for rack/device mode)
  if (topology.value?.focusedRoomId) {
    focusedRoomId.value = topology.value.focusedRoomId
  }
  if (!stage || !konvaContainer.value) return
  const { width, height } = computeStageSize()
  stageSize.value = { width, height }
  stage.width(width)
  stage.height(height)
  drawScene()
})

watch([
  focusDeviceId,
  selectedCableId,
  selectedCableTypes,
  selectedPurposes,
  selectedDeviceTypes,
  selectedLineStatuses,
  deviceNameQuery,
  animationEnabled,
  roomAnimationEnabled,
  selectedRoomConnectionId,
], () => {
  if (topology.value?.mode === 'devices') {
    // FR-VIS-12 / T-20: clear selection when selected cable is filtered out.
    if (selectedCableId.value && laidSnapshot.value && focusedRoomId.value) {
      const scene = buildCableScene(
        laidSnapshot.value,
        { level: 'room', roomId: focusedRoomId.value },
        {
          cableTypes: selectedCableTypes.value,
          purposes: selectedPurposes.value,
          deviceNameQuery: deviceNameQuery.value,
          deviceTypes: selectedDeviceTypes.value,
          lineStatuses: selectedLineStatuses.value,
        },
        focusedRoomId.value,
        { expandToCables: true },
      )
      if (!scene.bundles.some((b) => b.id === selectedCableId.value)) {
        selectedCableId.value = null
      }
    }
    drawScene()
  } else if (topology.value?.mode === 'rooms') {
    drawScene()
  }
})

/** Guard to prevent watch-triggered syncFromRoute while navigateToView is in progress. */
let navigating = false

async function navigateToView(roomId: string | null, view: 'rooms' | 'racks' | 'devices'): Promise<void> {
  navigating = true
  focusedRoomId.value = roomId
  selectedRoomConnectionId.value = null
  selectedCableId.value = null
  const query: Record<string, string> = {}
  if (roomId) query.roomId = roomId
  if (view !== 'rooms' || roomId) query.view = view
  await router.replace({ path: '/topology', query })

  if (view === 'devices' && roomId) {
    await loadDevices(roomId)
  } else if (view === 'racks' && roomId) {
    await load(roomId)
  } else {
    // Room-level: load(null) to stay in room mode
    await load(null)
  }
  navigating = false
}

async function syncFromRoute(): Promise<void> {
  if (navigating) return  // navigateToView is in progress, skip
  const roomId = typeof route.query.roomId === 'string' ? route.query.roomId : null
  const view = typeof route.query.view === 'string' ? route.query.view : 'rooms'
  focusedRoomId.value = roomId
  if (view === 'devices' && roomId) {
    await loadDevices(roomId)
  } else if (view === 'racks' && roomId) {
    await load(roomId)
  } else {
    // Already in rooms mode: skip reload so click→route watch does not rebuild nodes
    // and kill Konva dblclick. Returning from devices/racks still needs load(null).
    if (view === 'rooms' && topology.value?.mode === 'rooms') {
      return
    }
    // Room-level: load(null) to stay in room mode; roomId is used for highlighting only
    await load(null)
  }
}

function toggleRoomCableType(type: string): void {
  const set = new Set(roomCableTypes.value)
  if (set.has(type)) set.delete(type)
  else set.add(type)
  roomCableTypes.value = [...set]
}

function toggleRoomPurpose(purpose: string): void {
  const set = new Set(roomPurposes.value)
  if (set.has(purpose)) set.delete(purpose)
  else set.add(purpose)
  roomPurposes.value = [...set]
}

function toggleRoomStatus(status: string): void {
  const set = new Set(roomStatuses.value)
  if (set.has(status)) set.delete(status)
  else set.add(status)
  roomStatuses.value = [...set]
}

onMounted(async () => {
  await syncFromRoute()
  initStage()
})

watch(() => [route.query.roomId, route.query.view], () => {
  syncFromRoute()
})

onUnmounted(() => {
  stopRoomCableAnimation()
  resizeObserver?.disconnect()
  resizeObserver = null
  if (typeof window !== 'undefined') {
    delete (window as unknown as { __topologyKonvaStage?: Konva.Stage }).__topologyKonvaStage
  }
  if (stage) {
    stage.off('wheel')
    stage.off('.devicePan')
    stage.off('click')
  }
  stage?.destroy()
  stage = null
  layer = null
  deviceViewportBound = false
  document.body.style.cursor = 'default'
})
</script>

<style scoped>
.topology-page {
  --topology-bg: #06111f;
  --topology-panel: #0B1B31;
  --topology-border: #2E4A6E;
  --topology-text: #e8f1ff;
  --topology-muted: #8b9cb3;
  --topology-accent: #39D2C0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0;
  padding: var(--space-sm);
  /* App nav 实测 51px + UA body margin 16px；App.vue 不可改 */
  height: calc(100dvh - 67px);
  max-height: calc(100dvh - 67px);
  min-height: 0;
  overflow: hidden;
  background: linear-gradient(180deg, var(--topology-bg) 0%, #071425 100%);
  color: var(--topology-text);
}

.topology-page--devices {
  --topology-bg: #071426;
  --topology-panel: #0B1B31;
  --topology-border: #2E4A6E;
  --topology-text: #F8F9FA;
  --topology-muted: #C5D4E8;
  --topology-accent: #39D2C0;
  background: linear-gradient(180deg, var(--topology-bg) 0%, var(--topology-panel) 100%);
  color: var(--topology-text);
}

.topology-page .topology-header h1,
.topology-page .topology-subtitle,
.topology-page .topology-breadcrumb {
  color: var(--topology-muted);
}

.topology-page .topology-header h1 {
  color: var(--topology-text);
}

.topology-page--devices .topology-header h1,
.topology-page--devices .topology-subtitle,
.topology-page--devices .topology-breadcrumb,
.topology-page--devices .anim-toggle,
.topology-page--devices .non-realtime-badge {
  color: var(--topology-muted);
}

.topology-page--devices .topology-header h1 {
  color: var(--topology-text);
}

.topology-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
  flex-wrap: nowrap;
}

.topology-header__lead {
  min-width: 0;
  flex: 1 1 auto;
}

.topology-header__tools {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.topology-header h1 {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.25;
  color: var(--topology-text);
}

.topology-subtitle {
  margin: 0.1rem 0 0;
  color: var(--topology-muted);
  font-size: 0.8rem;
  line-height: 1.3;
}

.topology-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.15rem;
  font-size: 0.75rem;
  color: var(--topology-muted);
}

.level-switcher {
  display: inline-flex;
  gap: 0.3rem;
  margin: 0;
  padding: 0.12rem;
  border-radius: 10px;
  background: rgba(11, 27, 49, 0.55);
  border: 1px solid var(--topology-border);
}

.level-switcher__btn {
  border: 1px solid transparent;
  background: transparent;
  color: var(--topology-muted);
  border-radius: 8px;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  font-size: 0.8rem;
}

.level-switcher__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.level-switcher__btn--active {
  background: var(--topology-panel);
  border-color: var(--topology-accent);
  color: var(--topology-text);
  font-weight: 600;
}

.topology-page:not(.topology-page--devices) .level-switcher {
  background: rgba(255, 255, 255, 0.75);
  border-color: #cfd8e3;
}

.topology-page:not(.topology-page--devices) .level-switcher__btn {
  color: #1f2a37;
}

.topology-page:not(.topology-page--devices) .level-switcher__btn--active {
  background: #1f2a37;
  border-color: #1f6feb;
  color: #fff;
}

.topology-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--space-sm);
  align-items: center;
}

.btn {
  border: 1px solid #9aa7b5;
  background: #fff;
  color: #1f2a37;
  border-radius: 8px;
  padding: 0.28rem 0.6rem;
  cursor: pointer;
}

.topology-page--devices .btn {
  border-color: var(--topology-border);
  background: var(--topology-panel);
  color: var(--topology-text);
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

.non-realtime-badge {
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--topology-border);
  background: rgba(11, 27, 49, 0.8);
  color: #FFB341;
}

.error {
  color: var(--color-danger, #c0392b);
}

.topology-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--topology-border);
  border-radius: 8px;
  background: rgba(11, 27, 49, 0.85);
  color: var(--topology-muted);
  flex-shrink: 0;
}

.topology-filters--devices {
  gap: 0.5rem 0.75rem;
  padding: 0.4rem 0.65rem;
  align-items: center;
}

.filter-text {
  display: inline-flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
}

.filter-text input {
  min-width: 160px;
  border: 1px solid var(--topology-border);
  border-radius: 6px;
  background: var(--topology-bg);
  color: var(--topology-text);
  padding: 0.25rem 0.4rem;
}

.filter-chip {
  border: 1px solid var(--topology-border);
  background: transparent;
  color: var(--topology-muted);
  border-radius: 999px;
  padding: 0.15rem 0.55rem;
  font-size: 0.78rem;
  cursor: pointer;
}

.filter-chip--active,
.filter-chip[aria-pressed='true'] {
  border-color: var(--topology-accent);
  background: rgba(57, 210, 192, 0.16);
  color: var(--topology-accent);
  font-weight: 600;
}

.filter-clear {
  margin-left: auto;
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
  min-height: 0;
  overflow: hidden;
}

.topology-body--with-panel .topology-canvas {
  flex: 1;
}

.topology-canvas {
  position: relative;
  flex: 1;
  min-height: 320px;
  border: 1px solid var(--topology-border);
  border-radius: 12px;
  overflow: auto;
  background-color: var(--topology-bg);
  background-image:
    linear-gradient(30deg, rgba(91, 118, 152, 0.08) 1px, transparent 1px),
    linear-gradient(150deg, rgba(91, 118, 152, 0.08) 1px, transparent 1px);
  background-size: 28px 28px;
}

.topology-canvas--devices {
  overflow: hidden;
  cursor: grab;
  border-color: var(--topology-border);
  /* FR-VIS-02 dark theme + diagonal grid */
  background-color: var(--topology-bg);
  background-image:
    linear-gradient(30deg, rgba(91, 118, 152, 0.08) 1px, transparent 1px),
    linear-gradient(150deg, rgba(91, 118, 152, 0.08) 1px, transparent 1px);
  background-size: 28px 28px;
}

.topology-canvas--devices:active {
  cursor: grabbing;
}

.konva-stage {
  width: 100%;
  height: 100%;
  min-height: 320px;
}

.cable-overlay {
  position: absolute;
  inset: 0 auto auto 0;
  pointer-events: none;
  z-index: 4;
  overflow: visible;
}

.device-legend {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 5;
  min-width: 160px;
  max-width: 260px;
  padding: 0.5rem 0.65rem;
  border: 1px solid var(--topology-border);
  border-radius: 8px;
  background: rgba(11, 27, 49, 0.94);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  font-size: 0.75rem;
  color: var(--topology-muted);
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
  color: var(--topology-muted);
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
  border: 1px solid var(--topology-border);
  border-radius: 12px;
  background: var(--topology-panel);
  color: var(--topology-muted);
  padding: 0.75rem 1rem;
  overflow: auto;
}

.cable-detail-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.filter-label {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--topology-text);
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 0.35rem;
  vertical-align: middle;
}

.cable-detail-panel h2 {
  margin: 0;
  font-size: 1rem;
  color: var(--topology-text);
}

.cable-detail-panel dl {
  margin: 0;
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 0.4rem 0.5rem;
  font-size: 0.85rem;
}

.cable-detail-panel dt {
  color: var(--topology-muted);
}

.cable-detail-panel dd {
  margin: 0;
  color: var(--topology-text);
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
