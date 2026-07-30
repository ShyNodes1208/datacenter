<template>
  <div ref="containerRef" class="floorplan-canvas" @contextmenu.prevent>
    <div class="flp-zoom-controls">
      <button class="flp-zoom-btn" title="缩小" @click="zoomOut">−</button>
      <span class="flp-zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
      <button class="flp-zoom-btn" title="放大" @click="zoomIn">+</button>
      <button class="flp-zoom-btn flp-zoom-btn--fit" title="适应屏幕" @click="fitToScreen">⊡</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Konva from 'konva'
import type { RackItem } from '../composables/useFloorplan'
import type { SnapLine } from '../composables/useFloorplanEditor'

export interface CableLink {
  source: { rackId: string; rackCode: string; x: number; y: number }
  target: { rackId: string; rackCode: string; x: number; y: number }
  cableCount: number
  cableTypes: string[]
}

const props = defineProps<{
  racks: RackItem[]
  mode: 'view' | 'edit'
  snapLines: SnapLine[]
  cableLinks?: CableLink[]
  toCanvasX: (db: number) => number
  toCanvasY: (db: number) => number
  snapPosition: (rackId: string, x: number, y: number) => { x: number; y: number }
}>()

const emit = defineEmits<{
  'rack-click': [rackId: string]
  'rack-dragstart': [rackId: string]
  'rack-dragend': [rackId: string, x: number, y: number]
}>()

const containerRef = ref<HTMLDivElement>()
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

function occColor(occ: number | undefined, total: number): { fill: string; stroke: string } {
  if (!occ || occ === 0) return { fill: 'transparent', stroke: '#999' }
  const pct = occ / total
  if (pct > 0.8) return { fill: '#fce4e4', stroke: '#e74c3c' }
  if (pct >= 0.5) return { fill: '#fef3e0', stroke: '#f0ad4e' }
  return { fill: '#e8f8e8', stroke: '#52c41a' }
}

function drawGrid(layer: Konva.Layer, w: number, h: number): void {
  layer.destroyChildren()
  for (let x = 0; x <= w; x += GRID) {
    layer.add(new Konva.Line({
      points: [x, 0, x, h], stroke: '#eee', strokeWidth: 0.3,
      listening: false,
    }))
  }
  for (let y = 0; y <= h; y += GRID) {
    layer.add(new Konva.Line({
      points: [0, y, w, y], stroke: '#eee', strokeWidth: 0.3,
      listening: false,
    }))
  }
  for (let x = 0; x <= w; x += GRID_MAJOR) {
    layer.add(new Konva.Line({
      points: [x, 0, x, h], stroke: '#ddd', strokeWidth: 0.8,
      listening: false,
    }))
  }
  for (let y = 0; y <= h; y += GRID_MAJOR) {
    layer.add(new Konva.Line({
      points: [0, y, w, y], stroke: '#ddd', strokeWidth: 0.8,
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
    fill: '#f0f2f5', listening: false,
  }))
  layer.add(new Konva.Rect({
    x: 0, y: RULER_SIZE, width: RULER_SIZE, height: h - RULER_SIZE,
    fill: '#f0f2f5', listening: false,
  }))
  layer.add(new Konva.Rect({
    x: 0, y: 0, width: RULER_SIZE, height: RULER_SIZE,
    fill: '#e0e0e0', listening: false,
  }))

  const majorInterval = GRID_MAJOR * scale
  const minorInterval = GRID * scale
  const startX = pos.x % majorInterval
  for (let x = RULER_SIZE + startX; x < w; x += minorInterval) {
    const isMajor = Math.abs(((x - RULER_SIZE - startX) / minorInterval) % 5) < 0.01
    const tickH = isMajor ? 16 : 8
    layer.add(new Konva.Line({
      points: [x, 0, x, tickH],
      stroke: '#999', strokeWidth: 0.5, listening: false,
    }))
  }

  const startY = pos.y % majorInterval
  for (let y = RULER_SIZE + startY; y < h; y += minorInterval) {
    const isMajor = Math.abs(((y - RULER_SIZE - startY) / minorInterval) % 5) < 0.01
    const tickW = isMajor ? 16 : 8
    layer.add(new Konva.Line({
      points: [0, y, tickW, y],
      stroke: '#999', strokeWidth: 0.5, listening: false,
    }))
  }

  layer.batchDraw()
}

function drawCables(): void {
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
      stroke: color, strokeWidth: 2, opacity: 0.6,
      listening: true,
    })
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
    x: (stage.width() - RULER_SIZE) / 2 - cx * scale + RULER_SIZE,
    y: (stage.height() - RULER_SIZE) / 2 - cy * scale + RULER_SIZE,
  })
  zoomLevel.value = scale
  drawRulers(rulerLayer!)
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
    const barColor = capPct > 0.8 ? '#e74c3c' : capPct >= 0.5 ? '#f0ad4e' : '#52c41a'
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

    const label = new Konva.Text({
      text: `${rack.code}\n${rack.occupiedU ?? 0}/${rack.heightU}U`,
      fontSize: 10, fontFamily: 'sans-serif',
      fill: '#2c3e50', align: 'center', verticalAlign: 'middle',
      width: RACK_W, height: RACK_H - 6,
      listening: false,
      lineHeight: 1.3,
    })

    const capBarBg = new Konva.Rect({
      x: 0, y: RACK_H - barHeight,
      width: RACK_W, height: barHeight,
      fill: '#e0e0e0',
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
      fill: '#2c3e50', cornerRadius: 4,
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
  if (!containerRef.value) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight

  stage = new Konva.Stage({ container: containerRef.value, width: w, height: h })

  gridLayer = new Konva.Layer({ listening: false })
  drawGrid(gridLayer, w * 3, h * 3)
  stage.add(gridLayer)

  rackLayer = new Konva.Layer()
  renderRacks()
  stage.add(rackLayer)

  snapLayer = new Konva.Layer({ listening: false })
  stage.add(snapLayer)

  cableLayer = new Konva.Layer()
  drawCables()
  stage.add(cableLayer)

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
    stage!.batchDraw()
  })

  let panning = false
  stage.on('mousedown', (e) => { if (e.target === stage) panning = true })
  stage.on('mousemove', (e) => {
    if (!panning) return
    const p = stage!.position()
    stage!.position({ x: p.x + e.evt.movementX, y: p.y + e.evt.movementY })
    drawRulers(rulerLayer!)
    stage!.batchDraw()
  })
  stage.on('mouseup', () => { panning = false })
  stage.on('mouseleave', () => { panning = false })
}

watch(() => props.mode, (m) => {
  if (!rackLayer) return
  rackLayer.find('.rackGroup').forEach(g => (g as Konva.Group).draggable(m === 'edit'))
  rackLayer.batchDraw()
})

watch(() => props.racks, () => { renderRacks() }, { deep: true })
watch(() => props.snapLines, () => { renderSnapLines() }, { deep: true })
watch(() => props.cableLinks, () => { drawCables() }, { deep: true })

onMounted(() => {
  try {
    init()
  } catch (err) {
    console.error('FloorplanCanvas init failed:', err)
    return
  }
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (!stage || !containerRef.value) return
      const w = containerRef.value.clientWidth
      const h = containerRef.value.clientHeight
      stage.width(w); stage.height(h)
      if (gridLayer) drawGrid(gridLayer, w * 3, h * 3)
      if (rulerLayer) drawRulers(rulerLayer)
      stage.batchDraw()
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
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
  background: var(--color-bg, #f5f7fa);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius, 6px);
  overflow: hidden;
}

.flp-zoom-controls {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--color-border, #e0e0e0);
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
  background: var(--color-bg-card, #fff);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text, #333);
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
</style>
