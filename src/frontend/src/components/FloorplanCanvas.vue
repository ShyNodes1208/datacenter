<template>
  <div ref="containerRef" class="floorplan-canvas" @contextmenu.prevent>
    <div ref="konvaContainer" class="konva-stage"></div>
    <div
      v-if="false"
      class="cable-scene-overlay"
      :style="stageOverlayStyle"
    >
      <CableLayer
        :scene="cableScene"
        :animation-enabled="animationEnabled"
        @bundle-click="onBundleClick"
      />
    </div>

    <div v-if="false" class="cable-ui-chrome">
      <CableBreadcrumb
        :items="cableScene.breadcrumbs"
        @navigate="onNavigate"
      />
      <CableLegend
        :legend="cableScene.legend"
        :detail-rows="cableScene.detailRows"
        :animation-enabled="animationEnabled"
        @toggle-animation="animationEnabled = !animationEnabled"
      />
    </div>

    <div class="flp-zoom-controls">
      <button class="flp-zoom-btn" title="缩小" @click="zoomOut">−</button>
      <span class="flp-zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
      <button class="flp-zoom-btn" title="放大" @click="zoomIn">+</button>
      <button class="flp-zoom-btn flp-zoom-btn--fit" title="适应屏幕" @click="fitToScreen">⊡</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Konva from 'konva'
import type { RackItem } from '../composables/useFloorplan'
import type { SnapLine } from '../composables/useFloorplanEditor'
import { useApi } from '../composables/useApi'
import {
  buildCableScene,
  mapSnapshotToFloorplan,
  parseCableSnapshot,
  type CableFocus,
  type CableScene,
  type CableSnapshot,
} from '../composables/useCableScene'
import CableLayer from './CableLayer.vue'
import CableBreadcrumb from './CableBreadcrumb.vue'
import CableLegend from './CableLegend.vue'

export interface CableLink {
  source: { rackId: string; rackCode: string; x: number; y: number }
  target: { rackId: string; rackCode: string; x: number; y: number }
  cableCount: number
  cableTypes: string[]
}

const props = defineProps<{
  roomId: string
  racks: RackItem[]
  mode: 'view' | 'edit'
  snapLines: SnapLine[]
  cableLinks?: CableLink[]
  selectedRackId?: string | null
  searchHighlightIds?: string[]
  highlightedRackIds?: string[]
  toCanvasX: (db: number) => number
  toCanvasY: (db: number) => number
  snapPosition: (rackId: string, x: number, y: number) => { x: number; y: number }
}>()

const { request } = useApi()

const EMPTY_CABLE_SCENE: CableScene = {
  bundles: [],
  highlightedPath: null,
  legend: [],
  detailRows: [],
  breadcrumbs: [],
}

const cableFocus = ref<CableFocus>({ level: 'room', roomId: '' })
const animationEnabled = ref(true)
const cableScene = ref<CableScene>({ ...EMPTY_CABLE_SCENE })
const cableSnapshot = ref<CableSnapshot | null>(null)
const cableFilters = ref({ purposes: [] as string[], cableTypes: [] as string[] })

const stagePos = ref({ x: 0, y: 0 })
const stageScale = ref(1)
const stageSize = ref({ w: 0, h: 0 })

const stageOverlayStyle = computed(() => ({
  transform: `translate(${stagePos.value.x}px, ${stagePos.value.y}px) scale(${stageScale.value})`,
  transformOrigin: '0 0',
  width: `${stageSize.value.w}px`,
  height: `${stageSize.value.h}px`,
}))

function syncStageOverlay(): void {
  if (!stage || !containerRef.value) return
  stagePos.value = { x: stage.x(), y: stage.y() }
  stageScale.value = stage.scaleX()
  stageSize.value = { w: stage.width(), h: stage.height() }
}

function rebuildCableScene(): void {
  if (!cableSnapshot.value || !props.roomId) return
  const mapped = mapSnapshotToFloorplan(cableSnapshot.value, props.toCanvasX, props.toCanvasY, {
    rulerSize: RULER_SIZE,
    rackWidth: RACK_W,
    rackHeight: RACK_H,
  })
  cableScene.value = buildCableScene(mapped, cableFocus.value, cableFilters.value, props.roomId)
}

async function loadCableScene(): Promise<void> {
  return // 临时禁用
  if (!props.roomId) return
  cableFocus.value = { level: 'room', roomId: props.roomId }
  const result = await request<unknown>(`/api/rooms/${props.roomId}/cable-scene`, { method: 'GET' })
  if (!result.ok || !result.data) return
  const parsed = parseCableSnapshot(result.data)
  if (!parsed) return
  cableSnapshot.value = parsed
  rebuildCableScene()
}

function onBundleClick(bundleId: string): void {
  const parts = bundleId.split('|')
  if (parts[0] !== '__none__') {
    cableFocus.value = { level: 'rack', rackId: parts[0] }
    rebuildCableScene()
  }
}

function onBackgroundClick(): void {
  if (!props.roomId) return
  cableFocus.value = { level: 'room', roomId: props.roomId }
  rebuildCableScene()
}

function onNavigate(level: CableFocus['level'], id: string): void {
  switch (level) {
    case 'room':
      cableFocus.value = { level: 'room', roomId: id || props.roomId }
      break
    case 'rack':
      cableFocus.value = { level: 'rack', rackId: id }
      break
    case 'device':
      cableFocus.value = { level: 'device', deviceId: id }
      break
    case 'port':
      cableFocus.value = { level: 'port', portId: id }
      break
  }
  rebuildCableScene()
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && cableFocus.value.level !== 'room') {
    onBackgroundClick()
  }
}

const emit = defineEmits<{
  'rack-click': [rackId: string]
  'rack-dragstart': [rackId: string]
  'rack-dragend': [rackId: string, x: number, y: number]
}>()

const containerRef = ref<HTMLDivElement>()
const konvaContainer = ref<HTMLDivElement>()
const zoomLevel = ref(1)

let stage: Konva.Stage | null = null
let gridLayer: Konva.Layer | null = null
let rackLayer: Konva.Layer | null = null
let snapLayer: Konva.Layer | null = null
let cableLayer: Konva.Layer | null = null
let rulerLayer: Konva.Layer | null = null
let resizeObserver: ResizeObserver | null = null
let dragMoved = false

const GRID = 60
const GRID_MAJOR = 300
const RULER_SIZE = 24
const RACK_W = 60
const RACK_H = 100

const CABLE_COLORS: Record<string, string> = { 铜缆: '#e67e22', 光纤: '#f1c40f', DAC: '#3498db' }

const ACCENT = '#39d2c0'
const PATH_HIGHLIGHT = '#f85149'

function occColor(occ: number | undefined, total: number): { fill: string; stroke: string } {
  if (!occ || occ === 0) return { fill: '#161b22', stroke: '#30363d' }
  const pct = occ / total
  if (pct > 0.8) return { fill: '#3d1f1f', stroke: '#f85149' }
  if (pct >= 0.5) return { fill: '#3d3520', stroke: '#d29922' }
  return { fill: '#1a3a5c', stroke: '#58a6ff' }
}

function drawGrid(layer: Konva.Layer, w: number, h: number): void {
  layer.destroyChildren()
  for (let x = 0; x <= w; x += GRID) {
    layer.add(new Konva.Line({
      points: [x, 0, x, h], stroke: '#1c2533', strokeWidth: 0.3,
      listening: false,
    }))
  }
  for (let y = 0; y <= h; y += GRID) {
    layer.add(new Konva.Line({
      points: [0, y, w, y], stroke: '#1c2533', strokeWidth: 0.3,
      listening: false,
    }))
  }
  for (let x = 0; x <= w; x += GRID_MAJOR) {
    layer.add(new Konva.Line({
      points: [x, 0, x, h], stroke: '#21262d', strokeWidth: 0.8,
      listening: false,
    }))
  }
  for (let y = 0; y <= h; y += GRID_MAJOR) {
    layer.add(new Konva.Line({
      points: [0, y, w, y], stroke: '#21262d', strokeWidth: 0.8,
      listening: false,
    }))
  }
}

function drawRulers(layer: Konva.Layer): void {
  if (!stage) return
  layer.destroyChildren()
  const scale = stage.scaleX()
  const pos = stage.position()
  const w = stage.width()
  const h = stage.height()

  layer.add(new Konva.Rect({
    x: RULER_SIZE, y: 0, width: w - RULER_SIZE, height: RULER_SIZE,
    fill: '#161b22', listening: false,
  }))
  layer.add(new Konva.Rect({
    x: 0, y: RULER_SIZE, width: RULER_SIZE, height: h - RULER_SIZE,
    fill: '#161b22', listening: false,
  }))
  layer.add(new Konva.Rect({
    x: 0, y: 0, width: RULER_SIZE, height: RULER_SIZE,
    fill: '#21262d', listening: false,
  }))

  const majorInterval = GRID_MAJOR * scale
  const minorInterval = GRID * scale
  const startX = pos.x % majorInterval
  for (let x = RULER_SIZE + startX; x < w; x += minorInterval) {
    const isMajor = Math.abs(((x - RULER_SIZE - startX) / minorInterval) % 5) < 0.01
    const tickH = isMajor ? 16 : 8
    layer.add(new Konva.Line({
      points: [x, 0, x, tickH],
      stroke: '#484f58', strokeWidth: 0.5, listening: false,
    }))
  }

  const startY = pos.y % majorInterval
  for (let y = RULER_SIZE + startY; y < h; y += minorInterval) {
    const isMajor = Math.abs(((y - RULER_SIZE - startY) / minorInterval) % 5) < 0.01
    const tickW = isMajor ? 16 : 8
    layer.add(new Konva.Line({
      points: [0, y, tickW, y],
      stroke: '#484f58', strokeWidth: 0.5, listening: false,
    }))
  }

  layer.batchDraw()
}

function drawCables(): void {
  return // 临时禁用
  if (!cableLayer) return
  cableLayer.destroyChildren()
  const links = props.cableLinks ?? []
  for (const link of links) {
    const sx = props.toCanvasX(link.source.x) + RACK_W / 2
    const sy = props.toCanvasY(link.source.y) + RACK_H / 2
    const tx = props.toCanvasX(link.target.x) + RACK_W / 2
    const ty = props.toCanvasY(link.target.y) + RACK_H / 2
    const color = link.cableTypes.length === 1
      ? (CABLE_COLORS[link.cableTypes[0] ?? ''] ?? '#95a5a6')
      : '#95a5a6'
    const line = new Konva.Line({
      points: [sx, sy, tx, ty],
      stroke: color, strokeWidth: 3, opacity: 0.85,
      listening: true,
      lineCap: 'round',
    })
    const highlightIds = props.highlightedRackIds ?? []
    if (highlightIds.length > 0 && highlightIds.includes(link.source.rackId) && highlightIds.includes(link.target.rackId)) {
      line.stroke('#e74c3c')
      line.strokeWidth(5)
      line.opacity(0.6)
    }
    const tooltip = new Konva.Label({
      x: (sx + tx) / 2, y: (sy + ty) / 2 - 12,
      visible: false, listening: false, opacity: 0.92,
    })
    tooltip.add(new Konva.Tag({ fill: '#2c3e50', cornerRadius: 4 }))
    tooltip.add(new Konva.Text({
      text: `${link.source.rackCode} ↔ ${link.target.rackCode}\n${link.cableCount} 条线缆\n${link.cableTypes.join(', ')}`,
      fontSize: 11, fontFamily: 'sans-serif', fill: '#fff', padding: 6, lineHeight: 1.4,
    }))
    line.on('mouseenter', () => { tooltip.visible(true); cableLayer?.batchDraw() })
    line.on('mouseleave', () => { tooltip.visible(false); cableLayer?.batchDraw() })
    cableLayer.add(line, tooltip)
  }
  cableLayer.batchDraw()
}

function updateZoomLevel(): void {
  if (stage) zoomLevel.value = stage.scaleX()
}

function zoomIn(): void {
  if (!stage) return
  const oldScale = stage.scaleX()
  const newScale = Math.min(3, oldScale * 1.25)
  const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 }
  stage.scale({ x: newScale, y: newScale })
  stage.position({
    x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
    y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale),
  })
  zoomLevel.value = newScale
  drawRulers(rulerLayer!)
  syncStageOverlay()
  stage.batchDraw()
}

function zoomOut(): void {
  if (!stage) return
  const oldScale = stage.scaleX()
  const newScale = Math.max(0.3, oldScale / 1.25)
  const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 }
  stage.scale({ x: newScale, y: newScale })
  stage.position({
    x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
    y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale),
  })
  zoomLevel.value = newScale
  drawRulers(rulerLayer!)
  syncStageOverlay()
  stage.batchDraw()
}

function fitToScreen(): void {
  if (!stage || !containerRef.value) return
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const rack of props.racks) {
    const cx = props.toCanvasX(rack.x)
    const cy = props.toCanvasY(rack.y)
    minX = Math.min(minX, cx); minY = Math.min(minY, cy)
    maxX = Math.max(maxX, cx + RACK_W); maxY = Math.max(maxY, cy + RACK_H)
  }
  if (!isFinite(minX)) {
    stage.scale({ x: 1, y: 1 })
    stage.position({ x: 0, y: 0 })
    zoomLevel.value = 1
    drawRulers(rulerLayer!)
    syncStageOverlay()
    stage.batchDraw()
    return
  }

  const padding = 80
  const contentW = maxX - minX + padding * 2
  const contentH = maxY - minY + padding * 2
  const scaleX = (stage.width() - RULER_SIZE) / contentW
  const scaleY = (stage.height() - RULER_SIZE) / contentH
  const scale = Math.min(scaleX, scaleY, 2)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  stage.scale({ x: scale, y: scale })
  stage.position({
    x: stage.width() / 2 - (cx + RULER_SIZE) * scale,
    y: stage.height() / 2 - (cy + RULER_SIZE) * scale,
  })
  zoomLevel.value = scale
  drawRulers(rulerLayer!)
  syncStageOverlay()
  stage.batchDraw()
}

defineExpose({ fitToScreen })

function renderRacks(): void {
  if (!rackLayer) return
  rackLayer.destroyChildren()

  for (const rack of props.racks) {
    const c = occColor(rack.occupiedU, rack.heightU)
    const cx = props.toCanvasX(rack.x)
    const cy = props.toCanvasY(rack.y)
    const capPct = rack.heightU > 0 ? (rack.occupiedU ?? 0) / rack.heightU : 0
    const barColor = capPct > 0.8 ? '#f85149' : capPct >= 0.5 ? '#d29922' : '#3fb950'
    const barHeight = 4

    const group = new Konva.Group({
      x: cx, y: cy,
      draggable: props.mode === 'edit',
      id: rack.id,
      name: 'rackGroup',
    })

    const rect = new Konva.Rect({
      width: RACK_W, height: RACK_H,
      fill: c.fill, stroke: c.stroke, strokeWidth: 1.5,
      cornerRadius: 3, name: 'rackRect',
    })

    const isSelected = props.selectedRackId === rack.id
    const isSearchHit = (props.searchHighlightIds ?? []).includes(rack.id)
    const isPathHit = (props.highlightedRackIds ?? []).includes(rack.id)

    if (isSelected) {
      rect.stroke(ACCENT)
      rect.strokeWidth(3)
      rect.shadowColor(ACCENT)
      rect.shadowBlur(10)
      rect.shadowEnabled(true)
    } else if (isSearchHit) {
      rect.stroke(ACCENT)
      rect.strokeWidth(2.5)
      rect.shadowColor(ACCENT)
      rect.shadowBlur(6)
      rect.shadowEnabled(true)
    } else if (isPathHit) {
      rect.stroke(PATH_HIGHLIGHT)
      rect.strokeWidth(3)
      rect.shadowColor(PATH_HIGHLIGHT)
      rect.shadowBlur(8)
      rect.shadowEnabled(true)
    }

    const label = new Konva.Text({
      text: `${rack.code}\n${rack.occupiedU ?? 0}/${rack.heightU}U`,
      fontSize: 10, fontFamily: 'sans-serif',
      fill: '#c9d1d9', align: 'center', verticalAlign: 'middle',
      width: RACK_W, height: RACK_H - 6,
      listening: false,
      lineHeight: 1.3,
    })

    const capBarBg = new Konva.Rect({
      x: 0, y: RACK_H - barHeight,
      width: RACK_W, height: barHeight,
      fill: '#30363d',
      listening: false, name: 'capBarBg',
    })
    const capBarFill = new Konva.Rect({
      x: 0, y: RACK_H - barHeight,
      width: RACK_W * capPct, height: barHeight,
      fill: barColor,
      listening: false, name: 'capBarFill',
    })

    const tooltip = new Konva.Label({
      x: RACK_W + 8, y: 0,
      visible: false, listening: false,
      opacity: 0.92,
    })
    tooltip.add(new Konva.Tag({
      fill: '#21262d', cornerRadius: 4,
      pointerDirection: 'left', pointerWidth: 6, pointerHeight: 8,
    }))
    tooltip.add(new Konva.Text({
      text: `${rack.code}\n${rack.roomName ?? ''}\n${rack.occupiedU ?? 0}/${rack.heightU}U (${Math.round(capPct * 100)}%)`,
      fontSize: 11, fontFamily: 'sans-serif',
      fill: '#fff', padding: 6, lineHeight: 1.4,
    }))

    group.add(rect, label, capBarBg, capBarFill, tooltip)

    group.on('mouseenter', () => {
      tooltip.visible(true)
      rackLayer?.batchDraw()
    })
    group.on('mouseleave', () => {
      tooltip.visible(false)
      rackLayer?.batchDraw()
    })

    group.on('click', () => {
      if (!dragMoved) emit('rack-click', rack.id)
    })

    group.on('dragstart', () => {
      dragMoved = false
      emit('rack-dragstart', rack.id)
    })
    group.on('dragmove', () => {
      dragMoved = true
      const pos = props.snapPosition(rack.id, group.x(), group.y())
      if (pos.x !== group.x() || pos.y !== group.y()) {
        group.x(pos.x); group.y(pos.y)
      }
      renderSnapLines()
    })
    group.on('dragend', () => {
      emit('rack-dragend', rack.id, group.x(), group.y())
      rackLayer?.batchDraw()
      if (snapLayer) { snapLayer.destroyChildren(); snapLayer.batchDraw() }
    })

    rackLayer.add(group)
  }
  rackLayer.batchDraw()
}

function renderSnapLines(): void {
  if (!snapLayer) return
  snapLayer.destroyChildren()
  for (const l of props.snapLines) {
    snapLayer.add(new Konva.Line({
      points: [l.x1, l.y1, l.x2, l.y2],
      stroke: '#4a90d9', strokeWidth: 1, dash: [3, 3], listening: false,
    }))
  }
  snapLayer.batchDraw()
}

function init(): void {
  if (!konvaContainer.value) return
  const w = konvaContainer.value.clientWidth
  const h = konvaContainer.value.clientHeight

  stage = new Konva.Stage({ container: konvaContainer.value, width: w, height: h })
  stage.container().style.background = '#0d1117'

  gridLayer = new Konva.Layer({ listening: false })
  drawGrid(gridLayer, w * 3, h * 3)
  stage.add(gridLayer)
  gridLayer.position({ x: RULER_SIZE, y: RULER_SIZE })

  rackLayer = new Konva.Layer()
  renderRacks()
  stage.add(rackLayer)
  rackLayer.position({ x: RULER_SIZE, y: RULER_SIZE })

  snapLayer = new Konva.Layer({ listening: false })
  stage.add(snapLayer)
  snapLayer.position({ x: RULER_SIZE, y: RULER_SIZE })

  cableLayer = new Konva.Layer()
  drawCables()
  stage.add(cableLayer)
  cableLayer.position({ x: RULER_SIZE, y: RULER_SIZE })

  rulerLayer = new Konva.Layer({ listening: false })
  stage.add(rulerLayer)
  drawRulers(rulerLayer)

  stage.on('wheel', (e) => {
    e.evt.preventDefault()
    const oldScale = stage!.scaleX()
    const pointer = stage!.getPointerPosition()
    if (!pointer) return
    const dir = e.evt.deltaY > 0 ? -1 : 1
    const newScale = Math.min(3, Math.max(0.3, oldScale * (dir > 0 ? 1.1 : 1 / 1.1)))
    stage!.scale({ x: newScale, y: newScale })
    stage!.position({
      x: pointer.x - (pointer.x - stage!.x()) * (newScale / oldScale),
      y: pointer.y - (pointer.y - stage!.y()) * (newScale / oldScale),
    })
    updateZoomLevel()
    drawRulers(rulerLayer!)
    syncStageOverlay()
    stage!.batchDraw()
  })

  let panning = false
  let panMoved = false
  stage.on('mousedown', (e) => {
    if (e.target === stage) {
      panning = true
      panMoved = false
    }
  })
  stage.on('mousemove', (e) => {
    if (!panning) return
    panMoved = true
    const p = stage!.position()
    stage!.position({ x: p.x + e.evt.movementX, y: p.y + e.evt.movementY })
    drawRulers(rulerLayer!)
    syncStageOverlay()
    stage!.batchDraw()
  })
  stage.on('mouseup', () => {
    if (panning && !panMoved && !dragMoved) {
      onBackgroundClick()
    }
    panning = false
  })
  stage.on('mouseleave', () => { panning = false })

  syncStageOverlay()
}

watch(() => props.mode, (m) => {
  if (!rackLayer) return
  rackLayer.find('.rackGroup').forEach(g => (g as Konva.Group).draggable(m === 'edit'))
  rackLayer.batchDraw()
})

watch(() => props.racks, () => { renderRacks() }, { deep: true })
watch(() => props.snapLines, () => { renderSnapLines() }, { deep: true })
watch(() => props.cableLinks, () => { drawCables() }, { deep: true })
watch(
  () => [props.highlightedRackIds, props.searchHighlightIds, props.selectedRackId],
  () => {
    renderRacks()
    drawCables()
  },
)

watch(() => props.roomId, (id) => {
  if (id) void loadCableScene()
}, { immediate: true })

onMounted(() => {
  try {
    init()
  } catch (err) {
    console.error('FloorplanCanvas init failed:', err)
    return
  }
  document.addEventListener('keydown', handleKeydown)
  if (konvaContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (!stage || !konvaContainer.value) return
        const w = konvaContainer.value.clientWidth
        const h = konvaContainer.value.clientHeight
        stage.width(w); stage.height(h)
        if (gridLayer) drawGrid(gridLayer, w * 3, h * 3)
        if (rulerLayer) drawRulers(rulerLayer)
        syncStageOverlay()
        stage.batchDraw()
      })
    })
    resizeObserver.observe(konvaContainer.value)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  resizeObserver?.disconnect()
  stage?.destroy()
})
</script>

<style scoped>
.floorplan-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: var(--color-bg, #0d1117);
  border: 1px solid var(--color-border, #21262d);
  border-radius: var(--radius, 6px);
  overflow: hidden;
}

.konva-stage {
  position: absolute;
  inset: 0;
}

.flp-zoom-controls {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(22, 27, 34, 0.92);
  border: 1px solid var(--color-border, #21262d);
  border-radius: var(--radius, 6px);
  padding: 4px 8px;
  box-shadow: var(--shadow, 0 1px 3px rgba(0, 0, 0, 0.1));
  pointer-events: auto;
}

.flp-zoom-btn {
  width: 24px;
  height: 24px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 4px;
  background: var(--color-bg-card, #161b22);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text, #c9d1d9);
}

.flp-zoom-btn:hover {
  background: var(--color-bg-hover, #f0f2f5);
}

.flp-zoom-level {
  min-width: 40px;
  text-align: center;
  font-size: 11px;
  color: var(--color-text-secondary, #888);
}

.flp-zoom-btn--fit {
  margin-left: 4px;
  font-size: 12px;
}

.cable-scene-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 11;
  overflow: visible;
}

.cable-scene-overlay :deep(.cable-layer) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.cable-ui-chrome {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-width: min(360px, 40vw);
  pointer-events: auto;
}
</style>
