<template>
  <div ref="containerRef" class="floorplan-canvas" @contextmenu.prevent></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Konva from 'konva'
import type { RackItem } from '../composables/useFloorplan'
import type { SnapLine } from '../composables/useFloorplanEditor'

const props = defineProps<{
  racks: RackItem[]
  mode: 'view' | 'edit'
  snapLines: SnapLine[]
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
let stage: Konva.Stage | null = null
let gridLayer: Konva.Layer | null = null
let rackLayer: Konva.Layer | null = null
let snapLayer: Konva.Layer | null = null
let resizeObserver: ResizeObserver | null = null
let dragMoved = false

const GRID = 60
const RACK_W = 60
const RACK_H = 100

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

  // Pan
  let panning = false
  stage.on('mousedown', (e) => { if (e.target === stage) panning = true })
  stage.on('mousemove', (e) => {
    if (!panning) return
    const p = stage!.position()
    stage!.position({ x: p.x + e.evt.movementX, y: p.y + e.evt.movementY })
    stage!.batchDraw()
  })
  stage.on('mouseup', () => { panning = false })
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

onMounted(() => {
  init()
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
