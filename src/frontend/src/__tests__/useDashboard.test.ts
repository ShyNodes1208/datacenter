import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequest = vi.fn()
vi.mock('../composables/useApi', () => ({
  useApi: () => ({ request: mockRequest }),
}))

import { useDashboard } from '../composables/useDashboard'

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadStats returns DashboardStats on success', async () => {
    mockRequest.mockResolvedValueOnce({
      ok: true,
      data: {
        totalRooms: 3,
        totalRacks: 22,
        totalU: 924,
        occupiedU: 120,
        usagePercent: 13,
        rackedServers: 22,
      },
    })

    const { stats, loadStats } = useDashboard()
    await loadStats()

    expect(stats.value).toEqual({
      totalRooms: 3,
      totalRacks: 22,
      totalU: 924,
      occupiedU: 120,
      usagePercent: 13,
      rackedServers: 22,
    })
  })

  it('loadStats sets error on failure', async () => {
    mockRequest.mockResolvedValueOnce({ ok: false, error: 'fail' })

    const { stats, error, loadStats } = useDashboard()
    await loadStats()

    expect(stats.value).toBeNull()
    expect(error.value).toBe('fail')
  })

  it('loadRooms returns RoomItem array on success', async () => {
    mockRequest.mockResolvedValueOnce({
      ok: true,
      data: [
        { id: '1', name: '机房A', status: '启用', location: '1F-A', rackCount: 3 },
        { id: '2', name: '网络机房', status: '启用', location: null, rackCount: 0 },
      ],
    })

    const { rooms, loadRooms } = useDashboard()
    await loadRooms()

    expect(rooms.value).toHaveLength(2)
    expect(rooms.value![0]).toEqual({
      id: '1',
      name: '机房A',
      status: '启用',
      location: '1F-A',
      rackCount: 3,
    })
    expect(rooms.value![1]).toEqual({
      id: '2',
      name: '网络机房',
      status: '启用',
      location: null,
      rackCount: 0,
    })
  })
})
