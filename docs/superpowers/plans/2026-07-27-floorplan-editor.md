# Floorplan 平面编辑器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2D floorplan page (`/rooms/:id/floorplan`) where users view and edit rack positions on a Konva.js canvas.

**Architecture:** FloorplanView owns two composables (`useFloorplan` for data/coords, `useFloorplanEditor` for drag/snap/undo). FloorplanCanvas is a pure rendering component — receives all state as props, emits events up. Zero backend changes.

**Tech Stack:** Vue 3 + TypeScript + Vite + Konva 9.x + Vitest

## Global Constraints

- Zero backend changes — reuses `GET /api/racks?roomId=` and `PUT /api/racks/:id`
- New npm dependency: `konva` only (no vue-konva wrapper)
- Follow existing patterns: `useApi()` for HTTP, `useAuth()` for user, scoped CSS with tokens.css
- TDD: write test first, see it fail, then implement
- TypeScript strict: no `any` without justification

---

### Task 1: Install konva dependency

**Files:**
- Modify: `src/frontend/package.json`

**Produces:** `konva` available as npm dependency

- [ ] **Step 1: Install konva**

```bash
cd src/frontend && npm install konva
```

- [ ] **Step 2: Verify install and types**

```bash
cd src/frontend && node -e "const K = require('konva'); console.log('konva', K.version)"
```

Expected: prints version (e.g. `konva 9.3.x`)

```bash
cd src/frontend && npx vue-tsc --noEmit
```

Expected: no new type errors from konva

- [ ] **Step 3: Commit**

```bash
git add src/frontend/package.json src/frontend/package-lock.json
git commit -m "chore: add konva dependency for floorplan canvas"
```

---

### Task 2: useFloorplan composable

**Files:**
- Create: `src/frontend/src/composables/useFloorplan.ts`
- Create: `src/frontend/src/__tests__/useFloorplan.test.ts`

**Produces:**
```typescript
function useFloorplan(roomId: string): {
  racks: Ref<RackItem[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  loadRacks: () => Promise<void>
  toCanvasX: (dbMm: number) => number
  toCanvasY: (dbMm: number) => number
  toDbX: (canvasPx: number) => number
  toDbY: (canvasPx: number) => number
  scaleFactor: number  // 0.1
}

type RackItem = {
  id: string; code: string; roomId: string; roomName: string
  heightU: number; occupiedU?: number
  brand: string | null; power: number | null; notes: string | null
  x: number; y: number; z: number
}
```

- [ ] **Step 1: Write failing tests**

Create `src/frontend/src/__tests__/useFloorplan.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useFloorplan } from '../composables/useFloorplan'

const requestMock = vi.fn()
vi.mock('../composables/useApi', () => ({
  useApi: () => ({ request: requestMock }),
}))

const RACK = {
  id: 'r1', code: 'A01', roomId: 'room1', roomName: 'Room 1',
  heightU: 42, occupiedU: 10, brand: 'HP', power: 3.5, notes: null,
  x: 600, y: 1000, z: 0,
}

describe('useFloorplan', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('coordinate conversion', () => {
    it('toCanvasX converts mm to px (scale=0.1)', () => {
      const { toCanvasX } = useFloorplan('room1')
      expect(toCanvasX(600)).toBe(60)
      expect(toCanvasX(0)).toBe(0)
      expect(toCanvasX(1200)).toBe(120)
    })

    it('toCanvasY converts mm to px (scale=0.1)', () => {
      const { toCanvasY } = useFloorplan('room1')
      expect(toCanvasY(1000)).toBe(100)
    })

    it('toDbX converts px back to mm (rounded)', () => {
      const { toDbX } = useFloorplan('room1')
      expect(toDbX(60)).toBe(600)
      expect(toDbX(75)).toBe(750)
    })

    it('toDbY converts px back to mm', () => {
      const { toDbY } = useFloorplan('room1')
      expect(toDbY(100)).toBe(1000)
    })
  })

  describe('loadRacks', () => {
    it('populates racks on success', async () => {
      requestMock.mockResolvedValueOnce({ ok: true, data: [RACK], status: 200 })
      const { racks, loading, loadRacks } = useFloorplan('room1')
      expect(loading.value).toBe(false)
      const p = loadRacks()
      expect(loading.value).toBe(true)
      await p
      expect(loading.value).toBe(false)
      expect(racks.value).toHaveLength(1)
      expect(racks.value[0].code).toBe('A01')
      expect(requestMock).toHaveBeenCalledWith('/api/racks?roomId=room1')
    })

    it('sets error on API failure', async () => {
      requestMock.mockResolvedValueOnce({ ok: false, error: 'fail', status: 500 })
      const { error, loadRacks } = useFloorplan('room1')
      await loadRacks()
      expect(error.value).toBe('fail')
    })
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd src/frontend && npx vitest run src/__tests__/useFloorplan.test.ts
```

- [ ] **Step 3: Implement useFloorplan**

Create `src/frontend/src/composables/useFloorplan.ts`:

```typescript
import { ref } from 'vue'
import { useApi } from './useApi'

export type RackItem = {
  id: string
  code: string
  roomId: string
  roomName: string
  heightU: number
  occupiedU?: number
  brand: string | null
  power: number | null
  notes: string | null
  x: number
  y: number
  z: number
}

export const SCALE_FACTOR = 0.1

export function useFloorplan(roomId: string) {
  const { request } = useApi()
  const racks = ref<RackItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function toCanvasX(dbMm: number): number { return dbMm * SCALE_FACTOR }
  function toCanvasY(dbMm: number): number { return dbMm * SCALE_FACTOR }
  function toDbX(px: number): number { return Math.round(px / SCALE_FACTOR) }
  function toDbY(px: number): number { return Math.round(px / SCALE_FACTOR) }

  async function loadRacks(): Promise<void> {
    loading.value = true
    error.value = null
    const result = await request<RackItem[]>(`/api/racks?roomId=${encodeURIComponent(roomId)}`)
    if (result.ok) { racks.value = result.data }
    else { error.value = result.error }
    loading.value = false
  }

  return { racks, loading, error, loadRacks, toCanvasX, toCanvasY, toDbX, toDbY, scaleFactor: SCALE_FACTOR }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd src/frontend && npx vitest run src/__tests__/useFloorplan.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/composables/useFloorplan.ts src/frontend/src/__tests__/useFloorplan.test.ts
git commit -m "feat: add useFloorplan composable with coordinate conversion"
```

---

### Task 3: useFloorplanEditor composable

**Files:**
- Create: `src/frontend/src/composables/useFloorplanEditor.ts`
- Create: `src/frontend/src/__tests__/useFloorplanEditor.test.ts`

**Produces:**
```typescript
function useFloorplanEditor(
  racks: Ref<RackItem[]>,
  toDbX: (px: number) => number,
  toDbY: (px: number) => number,
  saveRackPosition: (id: string, x: number, y: number) => Promise<boolean>,
): {
  mode: Ref<'view' | 'edit'>
  selectedRackId: Ref<string | null>
  isDragging: Ref<boolean>
  snapLines: Ref<SnapLine[]>
  toggleMode: () => void
  selectRack: (id: string | null) => void
  snapPosition: (rackId: string, px: number, py: number) => { x: number; y: number }
  handleDragStart: (rackId: string) => void
  handleDragEnd: (rackId: string, canvasX: number, canvasY: number) => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
}

type SnapLine = { x1: number; y1: number; x2: number; y2: number }
```

- [ ] **Step 1: Write failing tests**

Create `src/frontend/src/__tests__/useFloorplanEditor.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useFloorplanEditor } from '../composables/useFloorplanEditor'
import type { RackItem } from '../composables/useFloorplan'

function rack(overrides: Partial<RackItem> = {}): RackItem {
  return {
    id: 'r1', code: 'A01', roomId: 'room1', roomName: 'R1',
    heightU: 42, occupiedU: 10, brand: null, power: null, notes: null,
    x: 600, y: 1000, z: 0, ...overrides,
  }
}

const toDbX = (px: number) => Math.round(px / 0.1)
const toDbY = (px: number) => Math.round(px / 0.1)

describe('useFloorplanEditor', () => {
  let racks: ReturnType<typeof ref<RackItem[]>>
  let saveMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    racks = ref([rack()])
    saveMock = vi.fn().mockResolvedValue(true)
  })

  function create() { return useFloorplanEditor(racks, toDbX, toDbY, saveMock) }

  describe('mode', () => {
    it('starts in view mode', () => {
      expect(create().mode.value).toBe('view')
    })
    it('toggleMode switches view↔edit', () => {
      const e = create()
      e.toggleMode(); expect(e.mode.value).toBe('edit')
      e.toggleMode(); expect(e.mode.value).toBe('view')
    })
  })

  describe('selection', () => {
    it('selectRack sets and clears selectedRackId', () => {
      const e = create()
      e.selectRack('r1'); expect(e.selectedRackId.value).toBe('r1')
      e.selectRack(null); expect(e.selectedRackId.value).toBeNull()
    })
  })

  describe('snapPosition', () => {
    it('snaps to grid (60px) when within 8px', () => {
      const e = create()
      expect(e.snapPosition('r1', 55, 55)).toEqual({ x: 60, y: 60 })
    })
    it('does not snap when >8px from grid', () => {
      const e = create()
      expect(e.snapPosition('r1', 50, 50)).toEqual({ x: 50, y: 50 })
    })
  })

  describe('handleDragEnd', () => {
    it('converts px→db, saves, pushes undo', async () => {
      const e = create()
      e.handleDragStart('r1')
      await e.handleDragEnd('r1', 120, 200)
      expect(saveMock).toHaveBeenCalledWith('r1', 1200, 2000)
      expect(racks.value[0].x).toBe(1200)
    })
    it('rolls back on save failure', async () => {
      saveMock.mockResolvedValueOnce(false)
      const e = create()
      await e.handleDragEnd('r1', 120, 200)
      expect(racks.value[0].x).toBe(600)
    })
  })

  describe('undo/redo', () => {
    it('undo reverts, redo re-applies', async () => {
      const e = create()
      e.handleDragStart('r1')
      await e.handleDragEnd('r1', 120, 200)
      expect(racks.value[0].x).toBe(1200)

      await e.undo()
      expect(racks.value[0].x).toBe(600)
      expect(e.canUndo.value).toBe(false)
      expect(e.canRedo.value).toBe(true)

      await e.redo()
      expect(racks.value[0].x).toBe(1200)
      expect(e.canRedo.value).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd src/frontend && npx vitest run src/__tests__/useFloorplanEditor.test.ts
```

- [ ] **Step 3: Implement useFloorplanEditor**

Create `src/frontend/src/composables/useFloorplanEditor.ts`:

```typescript
import { ref, computed, type Ref } from 'vue'
import type { RackItem } from './useFloorplan'

export interface SnapLine {
  x1: number; y1: number; x2: number; y2: number
}

interface UndoEntry {
  rackId: string
  prevX: number; prevY: number
  newX: number; newY: number
}

const GRID_SIZE = 60
const SNAP_DIST = 8
const RACK_W = 60
const RACK_H = 100

export function useFloorplanEditor(
  racks: Ref<RackItem[]>,
  toDbX: (px: number) => number,
  toDbY: (px: number) => number,
  saveRackPosition: (id: string, x: number, y: number) => Promise<boolean>,
) {
  const mode = ref<'view' | 'edit'>('view')
  const selectedRackId = ref<string | null>(null)
  const isDragging = ref(false)
  const snapLines = ref<SnapLine[]>([])
  const undoStack = ref<UndoEntry[]>([])
  const redoStack = ref<UndoEntry[]>([])

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  function toggleMode(): void {
    mode.value = mode.value === 'view' ? 'edit' : 'view'
    selectedRackId.value = null
    snapLines.value = []
  }

  function selectRack(id: string | null): void {
    selectedRackId.value = id
  }

  function snapToGrid(v: number): number {
    const s = Math.round(v / GRID_SIZE) * GRID_SIZE
    return Math.abs(s - v) <= SNAP_DIST ? s : v
  }

  function snapPosition(rackId: string, x: number, y: number): { x: number; y: number } {
    const sx = snapToGrid(x)
    const sy = snapToGrid(y)
    const lines: SnapLine[] = []

    for (const rack of racks.value) {
      if (rack.id === rackId) continue
      const rx = rack.x * 0.1
      const ry = rack.y * 0.1

      if (Math.abs(sx - rx) <= SNAP_DIST)
        lines.push({ x1: sx, y1: Math.min(sy, ry), x2: sx, y2: Math.max(sy + RACK_H, ry + RACK_H) })
      if (Math.abs(sx + RACK_W - (rx + RACK_W)) <= SNAP_DIST)
        lines.push({ x1: sx + RACK_W, y1: Math.min(sy, ry), x2: sx + RACK_W, y2: Math.max(sy + RACK_H, ry + RACK_H) })
      if (Math.abs(sy - ry) <= SNAP_DIST)
        lines.push({ x1: Math.min(sx, rx), y1: sy, x2: Math.max(sx + RACK_W, rx + RACK_W), y2: sy })
      if (Math.abs(sy + RACK_H - (ry + RACK_H)) <= SNAP_DIST)
        lines.push({ x1: Math.min(sx, rx), y1: sy + RACK_H, x2: Math.max(sx + RACK_W, rx + RACK_W), y2: sy + RACK_H })
    }

    snapLines.value = lines
    return { x: sx, y: sy }
  }

  function handleDragStart(rackId: string): void {
    isDragging.value = true
    selectedRackId.value = rackId
  }

  async function handleDragEnd(rackId: string, canvasX: number, canvasY: number): Promise<void> {
    isDragging.value = false
    snapLines.value = []

    const dbX = toDbX(canvasX)
    const dbY = toDbY(canvasY)
    const rack = racks.value.find(r => r.id === rackId)
    if (!rack) return

    const prevX = rack.x
    const prevY = rack.y

    // Optimistic update
    rack.x = dbX
    rack.y = dbY

    const ok = await saveRackPosition(rackId, dbX, dbY)
    if (!ok) {
      rack.x = prevX
      rack.y = prevY
      return
    }

    undoStack.value.push({ rackId, prevX, prevY, newX: dbX, newY: dbY })
    redoStack.value = []
  }

  async function undo(): Promise<void> {
    const entry = undoStack.value.pop()
    if (!entry) return
    const rack = racks.value.find(r => r.id === entry.rackId)
    if (!rack) return
    rack.x = entry.prevX; rack.y = entry.prevY
    const ok = await saveRackPosition(entry.rackId, entry.prevX, entry.prevY)
    if (!ok) { rack.x = entry.newX; rack.y = entry.newY; undoStack.value.push(entry); return }
    redoStack.value.push(entry)
  }

  async function redo(): Promise<void> {
    const entry = redoStack.value.pop()
    if (!entry) return
    const rack = racks.value.find(r => r.id === entry.rackId)
    if (!rack) return
    rack.x = entry.newX; rack.y = entry.newY
    const ok = await saveRackPosition(entry.rackId, entry.newX, entry.newY)
    if (!ok) { rack.x = entry.prevX; rack.y = entry.prevY; redoStack.value.push(entry); return }
    undoStack.value.push(entry)
  }

  return {
    mode, selectedRackId, isDragging, snapLines,
    toggleMode, selectRack, snapPosition, handleDragStart, handleDragEnd,
    undo, redo, canUndo, canRedo,
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd src/frontend && npx vitest run src/__tests__/useFloorplanEditor.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/composables/useFloorplanEditor.ts src/frontend/src/__tests__/useFloorplanEditor.test.ts
git commit -m "feat: add useFloorplanEditor composable with drag/snap/undo"
```

---

### Task 4: FloorplanCanvas component

**Files:**
- Create: `src/frontend/src/components/FloorplanCanvas.vue`

**Interfaces:**
- Props (from FloorplanView):
  ```typescript
  racks: RackItem[]
  mode: 'view' | 'edit'
  snapLines: SnapLine[]
  toCanvasX: (dbMm: number) => number
  toCanvasY: (dbMm: number) => number
  snapPosition: (rackId: string, x: number, y: number) => { x: number; y: number }
  ```
- Emits:
  ```typescript
  'rack-click': [rackId: string]
  'rack-dragstart': [rackId: string]
  'rack-dragend': [rackId: string, x: number, y: number]
  ```

- [ ] **Step 1: Implement FloorplanCanvas**

Create `src/frontend/src/components/FloorplanCanvas.vue`:

```vue
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd src/frontend && npx vue-tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/components/FloorplanCanvas.vue
git commit -m "feat: add FloorplanCanvas component with Konva rendering"
```

---

### Task 5: FloorplanView page

**Files:**
- Create: `src/frontend/src/views/FloorplanView.vue`
- Create: `src/frontend/src/__tests__/floorplan.test.ts`

**Route:** `/rooms/:id/floorplan`

- [ ] **Step 1: Write rendering test**

Create `src/frontend/src/__tests__/floorplan.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import FloorplanView from '../views/FloorplanView.vue'

const requestMock = vi.fn()
vi.mock('../composables/useApi', () => ({
  useApi: () => ({ request: (...args: unknown[]) => requestMock(...args) }),
}))
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ user: { value: { id: 'u1', username: 'admin', role: '机房管理员' } } }),
}))
vi.mock('../composables/useFloorplan', () => ({
  useFloorplan: () => ({
    racks: { value: [] }, loading: { value: false }, error: { value: null },
    loadRacks: vi.fn().mockResolvedValue(undefined),
    toCanvasX: (v: number) => v * 0.1,
    toCanvasY: (v: number) => v * 0.1,
    toDbX: (v: number) => Math.round(v / 0.1),
    toDbY: (v: number) => Math.round(v / 0.1),
    scaleFactor: 0.1,
  }),
}))
vi.mock('../composables/useFloorplanEditor', () => ({
  useFloorplanEditor: () => ({
    mode: { value: 'view' }, selectedRackId: { value: null },
    isDragging: { value: false }, snapLines: { value: [] },
    toggleMode: vi.fn(), selectRack: vi.fn(),
    snapPosition: vi.fn((_id: string, x: number, y: number) => ({ x, y })),
    handleDragStart: vi.fn(), handleDragEnd: vi.fn(),
    undo: vi.fn(), redo: vi.fn(),
    canUndo: { value: false }, canRedo: { value: false },
  }),
}))

describe('FloorplanView', () => {
  it('renders page structure', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/rooms/:id/floorplan', component: FloorplanView }],
    })
    router.push('/rooms/room1/floorplan')
    await router.isReady()

    const app = createSSRApp(FloorplanView, {})
    const html = await renderToString(app)

    expect(html).toContain('查看模式')
    expect(html).toContain('编辑模式')
    expect(html).toContain('返回')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd src/frontend && npx vitest run src/__tests__/floorplan.test.ts
```

- [ ] **Step 3: Implement FloorplanView**

Create `src/frontend/src/views/FloorplanView.vue`:

```vue
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
          :racks="racks"
          :mode="mode"
          :snap-lines="snapLines"
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFloorplan } from '../composables/useFloorplan'
import { useFloorplanEditor } from '../composables/useFloorplanEditor'
import { useApi } from '../composables/useApi'
import FloorplanCanvas from '../components/FloorplanCanvas.vue'

const route = useRoute()
const router = useRouter()
const roomId = computed(() => route.params.id as string)

const { racks, loading, error, loadRacks, toCanvasX, toCanvasY, toDbX, toDbY } = useFloorplan(roomId.value)
const { request } = useApi()

async function saveRackPosition(id: string, x: number, y: number): Promise<boolean> {
  const rack = racks.value.find(r => r.id === id)
  if (!rack) return false
  const result = await request(`/api/racks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { code: rack.code, heightU: rack.heightU, brand: rack.brand, power: rack.power, notes: rack.notes, x, y, z: rack.z },
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

function setViewMode(): void { if (mode.value === 'edit') toggleMode() }
function setEditMode(): void { if (mode.value === 'view') toggleMode() }
function goBack(): void { router.push('/') }
function goToRack(rackId: string): void { router.push(`/racks/${encodeURIComponent(rackId)}`) }
function onDragEnd(rackId: string, x: number, y: number): void { handleDragEnd(rackId, x, y) }

// Keyboard shortcuts
function onKeyDown(e: KeyboardEvent): void {
  if (e.key === '1' && mode.value === 'edit') toggleMode()
  if (e.key === '2' && mode.value === 'view') toggleMode()
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); editor.undo() }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); editor.redo() }
}

// Load data + register keyboard on mount
onMounted(() => {
  loadRacks()
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
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd src/frontend && npx vitest run src/__tests__/floorplan.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/frontend/src/views/FloorplanView.vue src/frontend/src/__tests__/floorplan.test.ts
git commit -m "feat: add FloorplanView page with toolbar, canvas, and sidebar"
```

---

### Task 6: Route + navigation integration

**Files:**
- Modify: `src/frontend/src/router.ts`
- Modify: `src/frontend/src/views/HomeView.vue`
- Modify: `src/frontend/src/views/RackDeviceView.vue`

- [ ] **Step 1: Read HomeView to find the right insertion point**

Read `src/frontend/src/views/HomeView.vue` — locate the room card template where rack cards are rendered. We need to add a "平面图" button next to each room's expand/collapse toggle.

- [ ] **Step 2: Add route**

Edit `src/frontend/src/router.ts`:

Add after line 8:
```typescript
import FloorplanView from './views/FloorplanView.vue'
```

Add after the `/racks/:id` route:
```typescript
{ path: '/rooms/:id/floorplan', component: FloorplanView, meta: { requiresAuth: true } },
```

- [ ] **Step 3: Add "平面图" button in HomeView**

In `src/frontend/src/views/HomeView.vue`, find the room header area (where room name and expand toggle are displayed). Add a button:

```vue
<button
  class="btn btn--small btn--muted"
  @click.stop="router.push(`/rooms/${room.id}/floorplan`)"
>平面图</button>
```

The `@click.stop` prevents the click from bubbling to the room expand/collapse toggle.

- [ ] **Step 4: Add breadcrumb in RackDeviceView**

In `src/frontend/src/views/RackDeviceView.vue`, find the breadcrumb area (the "机房列表 > roomName > rackCode" line). Add a "平面图" link:

After the room name in the breadcrumb:
```vue
<router-link :to="`/rooms/${rackInfo.roomId}/floorplan`">平面图</router-link>
```

- [ ] **Step 5: Verify TypeScript and build**

```bash
cd src/frontend && npx vue-tsc --noEmit && npm run build
```

Expected: clean typecheck and build with no errors

- [ ] **Step 6: Commit**

```bash
git add src/frontend/src/router.ts src/frontend/src/views/HomeView.vue src/frontend/src/views/RackDeviceView.vue
git commit -m "feat: add floorplan route and navigation links"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Run all tests**

```bash
cd src/frontend && npx vitest run
```

Expected: all tests pass (existing 69 + new ~20)

- [ ] **Step 2: Run backend tests**

```bash
cd tests/backend/Datacenter.Api.Tests && dotnet test
```

Expected: all 197 pass (confirming zero backend regression)

- [ ] **Step 3: Build production bundle**

```bash
cd src/frontend && npm run build
```

Expected: clean build with no warnings

- [ ] **Step 4: Manual smoke test checklist**

Start both servers (`dotnet run` + `npm run dev`), then:

- [ ] Login as admin
- [ ] Open a room with racks
- [ ] Verify racks appear on the floorplan canvas at correct coordinates
- [ ] Verify rack colors reflect occupancy (green/yellow/red/gray)
- [ ] Hover a rack → border highlights
- [ ] Click a rack → navigates to `/racks/:id`
- [ ] Scroll wheel → zooms in/out
- [ ] Drag empty canvas → pans
- [ ] Press 2 → switches to edit mode
- [ ] Drag a rack → grid snap lines appear
- [ ] Release rack → position saves (reload page to verify)
- [ ] Ctrl+Z → undo last move
- [ ] Ctrl+Y → redo
- [ ] Double-click rack → sidebar opens
- [ ] Sidebar "查看机柜详情" button → navigates

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A && git commit -m "chore: final verification fixes for floorplan editor"
```
