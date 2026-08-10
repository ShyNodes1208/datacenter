import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useFloorplan } from '../composables/useFloorplan'

const requestMock = vi.fn()
vi.mock('../composables/useApi', () => ({
  useApi: () => ({ request: requestMock }),
}))

const RACK = {
  id: 'r1', code: 'A01', roomId: 'room1', roomName: 'Room 1',
  heightU: 42, occupiedU: 10, brand: 'HP', power: 3.5, notes: null,
  x: 600, y: 1000, z: 0, status: '启用',
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
      expect(racks.value[0].status).toBe('启用')
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
