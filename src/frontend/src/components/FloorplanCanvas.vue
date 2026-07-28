<template>
  <div ref="containerRef" class="floorplan-canvas" @contextmenu.prevent></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Konva from 'konva'
import type { RackItem } from '../composables/useFloorplan'
import type { SnapLine } from '../composables/useFloorplanEditor'
import type { WallItem, ZoneItem, LabelItem } from '../composables/useFloorplanElements'

const props = defineProps<{
  racks: RackItem[]
  walls: WallItem[]
  zones: ZoneItem[]
  labels: LabelItem[]
  mode: 'view' | 'edit'
  activeTool: 'select' | 'wall' | 'rack' | 'label' | 'zone' | 'delete'
  snapLines: SnapLine[]
  toCanvasX: (db: number) => number
  toCanvasY: (db: number) => number
  snapPosition: (rackId: string, x: number, y: number) => { x: number; y: number }
}>()

const emit = defineEmits<{
  'rack-click': [rackId: string]
  'rack-dragstart': [rackId: string]
  'rack-dragend': [rackId: string, x: number, y: number]
  'element-click': [elementId: string]
  'element-dragend': [elementId: string, x: number, y: number]
  'wall-drawn': [x1: number, y1: number, x2: number, y2: number]
  'zone-drawn': [x: number, y: number, width: number, height: number]
  'label-placed': [x: number, y: number]
  'element-delete': [elementId: string, elementType: string]
}>()

const containerRef = ref<HTMLDivElement>()
let stage: Konva.Stage | null = null
let gridLayer: Konva.Layer | null = null
let zoneLayer: Konva.Layer | null = null
let wallLayer: Konva.Layer | null = null
let rackLayer: Konva.Layer | null = null
let snapLayer: Konva.Layer | null = null
let labelLayer: Konva.Layer | null = null
let resizeObserver: ResizeObserver | null = null
let dragMoved = false
let drawStartX = 0
let drawStartY = 0
let drawPreview: Konva.Shape | null = null

const GRID = 60
const RACK_W = 60
const RACK_H = 100
const SCALE_FACTOR = 0.1

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
      points: [x, 0, x, h], stroke: '#e0e0e0', strokeWidth: 0.5,
      dash: [4, 4], listening: false,
    }))
  }
  for (let y = 0; y <= h; y += GRID) {
    layer.add(new Konva.Line({
      points: [0, y, w, y], stroke: '#e0e0e0', strokeWidth: 0.5,
      dash: [4, 4], listening: false,
    }))
  }
}

function renderRacks(): void {
  if (!rackLayer) return
  rackLayer.destroyChildren()

  for (const rack of props.racks) {
    const c = occColor(rack.occupiedU, rack.heightU)
    const cx = props.toCanvasX(rack.x)
    const cy = props.toCanvasY(rack.y)

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
      text: rack.code, fontSize: 11, fontFamily: 'sans-serif',
      fill: '#2c3e50', align: 'center', verticalAlign: 'middle',
      width: RACK_W, height: RACK_H, listening: false,
    })

    group.add(rect, label)

    // Hover
    group.on('mouseenter', () => {
      if (props.mode !== 'edit') { rect.strokeWidth(3); rackLayer?.batchDraw() }
    })
    group.on('mouseleave', () => {
      rect.strokeWidth(1.5); rackLayer?.batchDraw()
    })

    // Click
    group.on('click', () => {
      if (!dragMoved) emit('rack-click', rack.id)
    })

    // Drag
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

function renderWalls(): void {
  if (!wallLayer) return
  wallLayer.destroyChildren()
  for (const w of props.walls) {
    const x1 = props.toCanvasX(w.x1)
    const y1 = props.toCanvasY(w.y1)
    const x2 = props.toCanvasX(w.x2)
    const y2 = props.toCanvasY(w.y2)
    wallLayer.add(new Konva.Line({
      points: [x1, y1, x2, y2],
      stroke: w.color,
      strokeWidth: w.thickness,
      lineCap: 'round',
      listening: false,
    }))
  }
  wallLayer.batchDraw()
}

function renderZones(): void {
  if (!zoneLayer) return
  zoneLayer.destroyChildren()
  for (const z of props.zones) {
    const x = props.toCanvasX(z.x)
    const y = props.toCanvasY(z.y)
    const w = z.width * SCALE_FACTOR
    const h = z.height * SCALE_FACTOR
    zoneLayer.add(new Konva.Rect({
      x, y, width: w, height: h,
      fill: z.color,
      stroke: z.color.replace(/[\d.]+\)$/, '0.4)'),
      strokeWidth: 1,
      cornerRadius: 2,
      listening: false,
    }))
    zoneLayer.add(new Konva.Text({
      x: x + 4, y: y + 4,
      text: z.name,
      fontSize: 11, fontFamily: 'sans-serif',
      fill: '#666', listening: false,
    }))
  }
  zoneLayer.batchDraw()
}

function renderLabels(): void {
  if (!labelLayer) return
  labelLayer.destroyChildren()
  for (const l of props.labels) {
    const x = props.toCanvasX(l.x)
    const y = props.toCanvasY(l.y)
    labelLayer.add(new Konva.Text({
      x, y, text: l.text,
      fontSize: l.fontSize, fontFamily: 'sans-serif',
      fill: l.color, listening: false,
    }))
  }
  labelLayer.batchDraw()
}

function init(): void {
  if (!containerRef.value) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight

  stage = new Konva.Stage({ container: containerRef.value, width: w, height: h })

  gridLayer = new Konva.Layer({ listening: false })
  drawGrid(gridLayer, w * 3, h * 3)
  stage.add(gridLayer)

  zoneLayer = new Konva.Layer({ listening: false })
  renderZones()
  stage.add(zoneLayer)

  wallLayer = new Konva.Layer({ listening: false })
  renderWalls()
  stage.add(wallLayer)

  rackLayer = new Konva.Layer()
  renderRacks()
  stage.add(rackLayer)

  snapLayer = new Konva.Layer({ listening: false })
  stage.add(snapLayer)

  labelLayer = new Konva.Layer({ listening: false })
  renderLabels()
  stage.add(labelLayer)

  // Zoom
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
    stage!.batchDraw()
  })

  // Drawing & panning
  let panning = false
  stage.on('mousedown', (e) => {
    if (e.target !== stage) return
    const pos = stage!.getPointerPosition()
    if (!pos) return

    if (props.activeTool === 'wall' || props.activeTool === 'zone') {
      drawStartX = pos.x
      drawStartY = pos.y
    } else if (props.activeTool === 'label') {
      emit('label-placed', pos.x, pos.y)
    } else {
      panning = true
    }
  })

  stage.on('mousemove', (e) => {
    const pos = stage!.getPointerPosition()
    if (!pos) return

    if (drawPreview) {
      drawPreview.destroy()
      drawPreview = null
    }

    if (props.activeTool === 'wall' && stage && (e.target === stage || drawPreview)) {
      drawPreview = new Konva.Line({
        points: [drawStartX, drawStartY, pos.x, pos.y],
        stroke: '#333', strokeWidth: 2, dash: [6, 4],
      })
      rackLayer?.add(drawPreview)
      rackLayer?.batchDraw()
    } else if (props.activeTool === 'zone' && stage) {
      const x = Math.min(drawStartX, pos.x)
      const y = Math.min(drawStartY, pos.y)
      const w = Math.abs(pos.x - drawStartX)
      const h = Math.abs(pos.y - drawStartY)
      drawPreview = new Konva.Rect({
        x, y, width: w, height: h,
        fill: 'rgba(100,149,237,0.1)',
        stroke: 'rgba(100,149,237,0.5)', strokeWidth: 1, dash: [6, 4],
      })
      rackLayer?.add(drawPreview)
      rackLayer?.batchDraw()
    } else if (panning) {
      const p = stage!.position()
      stage!.position({ x: p.x + e.evt.movementX, y: p.y + e.evt.movementY })
      stage!.batchDraw()
    }
  })

  stage.on('mouseup', () => {
    if (drawPreview) {
      if (props.activeTool === 'wall') {
        const line = drawPreview as Konva.Line
        const pts = line.points()
        emit('wall-drawn', pts[0], pts[1], pts[2], pts[3])
      } else if (props.activeTool === 'zone') {
        const rect = drawPreview as Konva.Rect
        emit('zone-drawn', rect.x(), rect.y(), rect.width(), rect.height())
      }
      drawPreview.destroy()
      drawPreview = null
      rackLayer?.batchDraw()
    }
    panning = false
  })
  stage.on('mouseleave', () => { panning = false })
}

// Watch mode for draggable toggle
watch(() => props.mode, (m) => {
  if (!rackLayer) return
  rackLayer.find('.rackGroup').forEach(g => (g as Konva.Group).draggable(m === 'edit'))
  rackLayer.batchDraw()
})

// Watch racks for undo/redo re-render
watch(() => props.racks, () => { renderRacks() }, { deep: true })

// Watch snapLines for drag alignment rendering
watch(() => props.snapLines, () => { renderSnapLines() }, { deep: true })

// Watch walls, zones, labels for re-render
watch(() => props.walls, () => { renderWalls() }, { deep: true })
watch(() => props.zones, () => { renderZones() }, { deep: true })
watch(() => props.labels, () => { renderLabels() }, { deep: true })

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
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: var(--color-bg, #f5f7fa);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius, 6px);
  overflow: hidden;
}
</style>
