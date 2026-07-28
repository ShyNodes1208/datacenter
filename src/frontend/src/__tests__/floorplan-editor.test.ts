import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFloorplanElements } from '../composables/useFloorplanElements'
import { useFloorplanEditor } from '../composables/useFloorplanEditor'
import { ref } from 'vue'
import type { RackItem } from '../composables/useFloorplan'

// Mock useApi
vi.mock('../composables/useApi', () => ({
  useApi: () => ({
    request: vi.fn().mockImplementation(async (path: string, _opts?: unknown) => {
      if (path === '/api/auth/csrf') {
        return { ok: true, headers: new Headers({ 'X-XSRF-TOKEN': 'test-token' }), status: 200 } as const
      }
      if (path.includes('/floorplan-elements')) {
        return { ok: true, data: { walls: [], zones: [], labels: [] }, headers: new Headers(), status: 200 } as const
      }
      return { ok: true, data: [], headers: new Headers(), status: 200 } as const
    }),
  }),
}))

describe('useFloorplanElements', () => {
  it('starts with empty arrays', () => {
    const { walls, zones, labels, loading } = useFloorplanElements('test-room')
    expect(walls.value).toEqual([])
    expect(zones.value).toEqual([])
    expect(labels.value).toEqual([])
    expect(loading.value).toBe(false)
  })

  it('toCanvasX/toCanvasY converts DB mm to canvas px', () => {
    const { toCanvasX, toCanvasY, toDbX, toDbY } = useFloorplanElements('test-room')
    expect(toCanvasX(6000)).toBe(600)
    expect(toCanvasY(3000)).toBe(300)
    expect(toDbX(600)).toBe(6000)
    expect(toDbY(300)).toBe(3000)
  })
})

describe('useFloorplanEditor element undo/redo', () => {
  function makeEditor() {
    const racks = ref<RackItem[]>([])
    return useFloorplanEditor(racks, (v) => v / 0.1, (v) => v / 0.1, async () => true)
  }

  it('pushElementAction and undoElement work', () => {
    const editor = makeEditor()
    editor.pushElementAction({ action: 'create', elementType: 'wall', elementId: 'w1', newData: { x1: 100 } })
    expect(editor.undoElement()).toEqual({ action: 'create', elementType: 'wall', elementId: 'w1', newData: { x1: 100 } })
    expect(editor.undoElement()).toBeNull()
  })

  it('redoElement returns undone actions', () => {
    const editor = makeEditor()
    editor.pushElementAction({ action: 'delete', elementType: 'label', elementId: 'l1' })
    editor.undoElement()
    expect(editor.redoElement()).toEqual({ action: 'delete', elementType: 'label', elementId: 'l1' })
    expect(editor.redoElement()).toBeNull()
  })

  it('clearElementHistory empties both stacks', () => {
    const editor = makeEditor()
    editor.pushElementAction({ action: 'create', elementType: 'zone', elementId: 'z1' })
    editor.pushElementAction({ action: 'create', elementType: 'zone', elementId: 'z2' })
    editor.clearElementHistory()
    expect(editor.undoElement()).toBeNull()
    expect(editor.redoElement()).toBeNull()
  })
})
