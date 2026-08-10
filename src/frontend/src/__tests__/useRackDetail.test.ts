import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequest = vi.fn()
vi.mock('../composables/useApi', () => ({
  useApi: () => ({ request: mockRequest }),
}))

import { useRackDetail } from '../composables/useRackDetail'

describe('useRackDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads rack status from GET /api/racks?roomId=', async () => {
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/api/racks/r1/device-positions') {
        return {
          ok: true,
          data: {
            rack: {
              id: 'r1',
              code: 'A01',
              roomId: 'room-1',
              roomName: '机房A',
              heightU: 42,
            },
          },
        }
      }
      if (path === '/api/racks?roomId=room-1') {
        return {
          ok: true,
          data: [{ id: 'r1', status: '停用' }],
        }
      }
      if (path === '/api/racks/r1/availability') {
        return {
          ok: true,
          data: { rackId: 'r1', rackCode: 'A01', heightU: 42, positions: [] },
        }
      }
      return { ok: false, error: 'unexpected' }
    })

    const { rack, loadData } = useRackDetail('r1')
    await loadData()

    expect(rack.value?.status).toBe('停用')
    expect(mockRequest).toHaveBeenCalledWith('/api/racks?roomId=room-1', { method: 'GET' })
  })
})
