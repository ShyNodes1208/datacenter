import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}))

vi.mock('../../composables/useApi', () => ({
  useApi: () => ({ request: mockRequest }),
}))

import { useRackDetailPanel } from '../../composables/useRackDetailPanel'
import RackDetailPanel from '../RackDetailPanel.vue'

const mockDetail = {
  rack: { id: 'r1', code: 'A01', heightU: 42, brand: '华为', power: '3kW', notes: '' },
  devices: [
    { id: 'd1', name: 'web-01', deviceType: '服务器', startU: 1, endU: 2, uHeight: 2 },
    { id: 'd2', name: 'db-01', deviceType: '服务器', startU: 5, endU: 8, uHeight: 4 },
  ],
  occupancy: { usedU: 6, freeU: 36, totalU: 42 },
  positionHistory: [
    { time: '2026-08-07T10:00:00Z', deviceName: 'web-01', action: '上架', fromU: null, toU: 1 },
  ],
  cables: [{ id: 'c1', portName: 'eth0', remoteDevice: 'db-01', remoteRack: 'B03' }],
}

describe('useRackDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest.mockResolvedValue({
      ok: true,
      data: mockDetail,
      headers: new Headers(),
      status: 200,
    })
  })

  it('loads rack detail for selected rack id', async () => {
    const rackId = ref<string | null>('r1')
    const { detail, loading } = useRackDetailPanel(rackId)
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(mockRequest).toHaveBeenCalledWith('/api/racks/r1/detail', { method: 'GET' })
    expect(detail.value?.rack.code).toBe('A01')
    expect(detail.value?.occupancy.usedU).toBe(6)
    expect(detail.value?.devices).toHaveLength(2)
  })

  it('clears detail when rack id is null', async () => {
    const rackId = ref<string | null>('r1')
    const { detail } = useRackDetailPanel(rackId)
    await vi.waitFor(() => expect(detail.value).not.toBeNull())

    rackId.value = null
    await vi.waitFor(() => expect(detail.value).toBeNull())
  })
})

describe('RackDetailPanel', () => {
  it('shows empty state when no rack is selected', async () => {
    const html = await renderToString(createSSRApp(RackDetailPanel, { rackId: null }))
    expect(html).toContain('点击机柜查看详情')
    expect(html).toContain('aria-label="机柜详情"')
  })

  it('includes close button for keyboard access', async () => {
    const html = await renderToString(createSSRApp(RackDetailPanel, { rackId: 'r1' }))
    expect(html).toContain('data-test="close-btn"')
    expect(html).toContain('aria-label="关闭面板"')
  })
})
