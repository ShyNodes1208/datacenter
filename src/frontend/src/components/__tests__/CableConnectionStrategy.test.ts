import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}))

vi.mock('../../composables/useApi', () => ({
  useApi: () => ({ request: mockRequest }),
}))

import {
  cableTypeColor,
  connectionStatusLabel,
  useCableConnections,
} from '../../composables/useCableConnections'
import CableConnectionStrategy from '../CableConnectionStrategy.vue'

const mockConnections = {
  connections: [
    {
      id: 'c1',
      source: { deviceName: 'web-01', portName: 'eth0', rackCode: 'A01', roomName: '核心机房A' },
      target: { deviceName: 'db-01', portName: 'eth1', rackCode: 'B03', roomName: '核心机房A' },
      cableType: '光纤',
      color: '#f1c40f',
      status: 'normal',
      notes: null,
    },
    {
      id: 'c2',
      source: { deviceName: 'sw-01', portName: 'ge0', rackCode: 'A01', roomName: '核心机房A' },
      target: { deviceName: 'web-02', portName: 'eth0', rackCode: 'A02', roomName: '核心机房A' },
      cableType: '铜缆',
      color: '#e67e22',
      status: 'pending',
      notes: null,
    },
  ],
}

describe('useCableConnections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest.mockResolvedValue({
      ok: true,
      data: mockConnections,
      headers: new Headers(),
      status: 200,
    })
  })

  it('loads filtered connections', async () => {
    const { connections, loading } = useCableConnections(() => 'room-1', () => '光纤')
    await vi.waitFor(() => expect(loading.value).toBe(false))

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/cables/connections?roomId=room-1&cableType=%E5%85%89%E7%BA%A4',
      { method: 'GET' },
    )
    expect(connections.value).toHaveLength(2)
    expect(connections.value[0]?.source.deviceName).toBe('web-01')
  })
})

describe('cable connection helpers', () => {
  it('maps cable type colors and status labels', () => {
    expect(cableTypeColor('铜缆')).toBe('#e67e22')
    expect(cableTypeColor('光纤')).toBe('#f1c40f')
    expect(cableTypeColor('DAC')).toBe('#3498db')
    expect(connectionStatusLabel('normal')).toBe('正常')
    expect(connectionStatusLabel('pending')).toBe('待确认')
  })
})

describe('CableConnectionStrategy', () => {
  it('renders loading shell and aria label', async () => {
    mockRequest.mockImplementation(() => new Promise(() => {}))
    const html = await renderToString(createSSRApp(CableConnectionStrategy, { roomId: 'room-1' }))
    expect(html).toContain('aria-label="线缆连接策略"')
    expect(html).toContain('加载中')
  })
})
