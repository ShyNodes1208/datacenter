import { ref, computed, type Ref } from 'vue'
import { type RackItem, SCALE_FACTOR } from './useFloorplan'

export interface SnapLine {
  x1: number; y1: number; x2: number; y2: number
}

interface UndoEntry {
  rackId: string
  prevX: number; prevY: number
  newX: number; newY: number
}

interface ElementAction {
  action: 'create' | 'delete' | 'update'
  elementType: 'wall' | 'zone' | 'label'
  elementId: string
  previousData?: Record<string, unknown>
  newData?: Record<string, unknown>
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
  const elementUndoStack = ref<ElementAction[]>([])
  const elementRedoStack = ref<ElementAction[]>([])

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
      const rx = rack.x * SCALE_FACTOR
      const ry = rack.y * SCALE_FACTOR

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

  function pushElementAction(action: ElementAction): void {
    elementUndoStack.value.push(action)
    elementRedoStack.value = []
  }

  function undoElement(): ElementAction | null {
    const action = elementUndoStack.value.pop()
    if (action) elementRedoStack.value.push(action)
    return action ?? null
  }

  function redoElement(): ElementAction | null {
    const action = elementRedoStack.value.pop()
    if (action) elementUndoStack.value.push(action)
    return action ?? null
  }

  function clearElementHistory(): void {
    elementUndoStack.value = []
    elementRedoStack.value = []
  }

  return {
    mode, selectedRackId, isDragging, snapLines,
    toggleMode, selectRack, snapPosition, handleDragStart, handleDragEnd,
    undo, redo, canUndo, canRedo,
    pushElementAction, undoElement, redoElement, clearElementHistory,
  }
}
