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
    it('toggleMode switches view<->edit', () => {
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
    it('converts px->db, saves, pushes undo', async () => {
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
