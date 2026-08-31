import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import NetworkTraceView from '../views/NetworkTraceView.vue'
import { useNetworkTrace } from '../composables/useNetworkTrace'

const requestMock = vi.fn()
const routeQuery: Record<string, string> = {
  sourcePortId: 'source-port',
  sourceServerId: 'source-server',
}

vi.mock('../composables/useApi', () => ({
  useApi: () => ({
    request: (...args: unknown[]) => requestMock(...args),
  }),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => ({ query: routeQuery }),
    useRouter: () => ({ push: vi.fn() }),
  }
})

type NetworkTraceViewState = {
  mode: { value: 'known' | 'reachable' }
  searchName: { value: string }
  searchTargets: () => Promise<void>
  selectTarget: (id: string) => void
  selectEndpoint: (deviceId: string) => Promise<void>
  loadSource: () => Promise<void>
  findKnownPath: () => Promise<void>
  findReachable: () => Promise<void>
}

function success(data: unknown) {
  return { ok: true as const, data, headers: new Headers(), status: 200 }
}

function sourceResponse(path: string, portId = 'source-port') {
  if (path === '/api/servers/source-server') {
    return success({
      id: 'source-server', name: 'Source Server', managementIP: '10.0.0.1',
      deviceType: '服务器', deviceHeight: 1, operationalStatus: '正常', positionStatus: '在架',
    })
  }
  if (path === '/api/servers/source-server/ports') {
    return success([{ id: portId, serverId: 'source-server', portName: 'eth0', portType: 'RJ45' }])
  }
  return null
}

async function mountTraceView(): Promise<{
  state: NetworkTraceViewState
  html: () => Promise<string>
  unmount: () => void
}> {
  type SetupFn = (...args: unknown[]) => Record<string, unknown>
  const component = NetworkTraceView as { setup: SetupFn }
  const originalSetup = component.setup
  let bindings: Record<string, unknown> | null = null

  component.setup = (props, ctx) => {
    if (bindings) return bindings
    bindings = originalSetup(props, ctx)
    return bindings
  }

  const html = async () => renderToString(createSSRApp(NetworkTraceView))
  await html()
  if (bindings === null) {
    component.setup = originalSetup
    throw new Error('NetworkTraceView setup bindings were not captured')
  }

  return {
    state: bindings as unknown as NetworkTraceViewState,
    html,
    unmount: () => {
      component.setup = originalSetup
    },
  }
}

afterEach(() => {
  requestMock.mockReset()
  routeQuery.sourcePortId = 'source-port'
  routeQuery.sourceServerId = 'source-server'
})

describe('useNetworkTrace', () => {
  it('uses the required reachable defaults', async () => {
    requestMock.mockReturnValue(success({
      warning: '已登记物理连接，非实时数据',
      maxHops: 4,
      totalEndpointCount: 0,
      returnedEndpointCount: 0,
      isTruncated: false,
      endpoints: [],
    }))

    const { findReachable } = useNetworkTrace()
    await findReachable('source-port')

    expect(requestMock).toHaveBeenCalledWith(
      '/api/network-path/reachable?sourcePortId=source-port&maxHops=4&limit=100',
      { method: 'GET' },
    )
  })
})

describe('NetworkTraceView', () => {
  it('fixedly shows the verified source device and port before any search', async () => {
    requestMock.mockImplementation((path: string) => sourceResponse(path) ?? success([]))

    const view = await mountTraceView()
    try {
      await view.state.loadSource()

      expect(await view.html()).toContain('起点：Source Server / eth0')
      expect(requestMock).toHaveBeenCalledWith('/api/servers/source-server', { method: 'GET' })
      expect(requestMock).toHaveBeenCalledWith('/api/servers/source-server/ports', { method: 'GET' })
    } finally {
      view.unmount()
    }
  })

  it('blocks trace requests when the route source port is not owned by the source device', async () => {
    requestMock.mockImplementation((path: string) => sourceResponse(path, 'different-port') ?? success([]))

    const view = await mountTraceView()
    try {
      await view.state.loadSource()
      await view.state.findReachable()

      expect(await view.html()).toContain('起点端口不属于来源设备，无法追踪')
      expect(requestMock).not.toHaveBeenCalledWith(
        '/api/network-path/reachable?sourcePortId=source-port&maxHops=4&limit=100',
        { method: 'GET' },
      )
    } finally {
      view.unmount()
    }
  })

  it('searches target devices by name and renders the selected physical path', async () => {
    requestMock.mockImplementation((path: string) => {
      const source = sourceResponse(path)
      if (source) return source
      if (path === '/api/servers?name=Target') {
        return success([{
          id: 'target-server', name: 'Target Server', managementIP: '10.0.0.3',
          deviceType: '服务器', deviceHeight: 1, operationalStatus: '正常', positionStatus: '在架',
        }])
      }
      if (path.includes('/network-path/by-port')) {
        return success({
          pathFound: true,
          warning: '已登记物理连接，非实时数据',
          reason: null,
          devices: [
            { deviceId: 'source-server', deviceName: 'Source Server', deviceType: '服务器', rackCode: 'R-01' },
            { deviceId: 'switch-server', deviceName: 'Core Switch', deviceType: '交换机', rackCode: 'R-01' },
            { deviceId: 'target-server', deviceName: 'Target Server', deviceType: '服务器', rackCode: 'R-02' },
          ],
          hops: [
            { fromDeviceId: 'source-server', fromDeviceName: 'Source Server', fromPortId: 'source-port', fromPortName: 'eth0', cableId: 'cable-1', cableType: '铜缆', toDeviceId: 'switch-server', toDeviceName: 'Core Switch', toPortId: 'switch-port', toPortName: 'Gi0/1' },
            { fromDeviceId: 'switch-server', fromDeviceName: 'Core Switch', fromPortId: 'switch-port-2', fromPortName: 'Gi0/2', cableId: 'cable-2', cableType: '光纤', toDeviceId: 'target-server', toDeviceName: 'Target Server', toPortId: 'target-port', toPortName: 'eth0' },
          ],
        })
      }
      return success([])
    })

    const view = await mountTraceView()
    try {
      await view.state.loadSource()
      view.state.searchName.value = 'Target'
      await view.state.searchTargets()
      view.state.selectTarget('target-server')
      await view.state.findKnownPath()
      await nextTick()

      const html = await view.html()
      expect(requestMock).toHaveBeenCalledWith('/api/servers?name=Target', { method: 'GET' })
      expect(html).toContain('Source Server')
      expect(html).toContain('Core Switch')
      expect(html).toContain('Target Server')
      expect(html).toContain('eth0')
      expect(html).toContain('已登记物理连接，非实时数据')
      expect(html).toContain('起点：Source Server / eth0')
    } finally {
      view.unmount()
    }
  })

  it('keeps the fixed source label after a no-path known-target result', async () => {
    requestMock.mockImplementation((path: string) => {
      const source = sourceResponse(path)
      if (source) return source
      if (path === '/api/servers?name=Target') {
        return success([{
          id: 'target-server', name: 'Target Server', managementIP: '10.0.0.3',
          deviceType: '服务器', deviceHeight: 1, operationalStatus: '正常', positionStatus: '在架',
        }])
      }
      return success({
        pathFound: false, warning: '已登记物理连接，非实时数据',
        reason: '未找到已登记的连接路径', devices: null, hops: null,
      })
    })

    const view = await mountTraceView()
    try {
      await view.state.loadSource()
      view.state.searchName.value = 'Target'
      await view.state.searchTargets()
      view.state.selectTarget('target-server')
      await view.state.findKnownPath()

      const html = await view.html()
      expect(html).toContain('未找到已登记的连接路径')
      expect(html).toContain('起点：Source Server / eth0')
    } finally {
      view.unmount()
    }
  })

  it('keeps the fixed source label after a trace request failure', async () => {
    requestMock.mockImplementation((path: string) => {
      const source = sourceResponse(path)
      if (source) return source
      if (path === '/api/servers?name=Target') {
        return success([{
          id: 'target-server', name: 'Target Server', managementIP: '10.0.0.3',
          deviceType: '服务器', deviceHeight: 1, operationalStatus: '正常', positionStatus: '在架',
        }])
      }
      return { ok: false as const, error: '线路追踪请求失败', status: 500 }
    })

    const view = await mountTraceView()
    try {
      await view.state.loadSource()
      view.state.searchName.value = 'Target'
      await view.state.searchTargets()
      view.state.selectTarget('target-server')
      await view.state.findKnownPath()

      const html = await view.html()
      expect(html).toContain('线路追踪请求失败')
      expect(html).toContain('起点：Source Server / eth0')
    } finally {
      view.unmount()
    }
  })

  it('shows the fixed discovery limit when the API truncates endpoints', async () => {
    requestMock.mockImplementation((path: string) => sourceResponse(path) ?? success({
      warning: '已登记物理连接，非实时数据', maxHops: 4,
      totalEndpointCount: 135, returnedEndpointCount: 100, isTruncated: true, endpoints: [],
    }))

    const view = await mountTraceView()
    try {
      await view.state.loadSource()
      view.state.mode.value = 'reachable'
      await view.state.findReachable()
      expect(await view.html()).toContain('已显示 100 / 共 135 个终点')
    } finally {
      view.unmount()
    }
  })

  it('traces the selected discovered endpoint as a known target path', async () => {
    requestMock.mockImplementation((path: string) => {
      const source = sourceResponse(path)
      if (source) return source
      if (path.includes('/reachable?')) {
        return success({
          warning: '已登记物理连接，非实时数据', maxHops: 4,
          totalEndpointCount: 1, returnedEndpointCount: 1, isTruncated: false,
          endpoints: [{ deviceId: 'target-server', deviceName: 'Target Server', deviceType: '服务器', rackCode: 'R-02', portId: 'target-port', portName: 'eth0', hopCount: 2 }],
        })
      }
      return success({
        pathFound: true, warning: '已登记物理连接，非实时数据', reason: null,
        devices: [
          { deviceId: 'source-server', deviceName: 'Source Server', deviceType: '服务器', rackCode: 'R-01' },
          { deviceId: 'switch-server', deviceName: 'Core Switch', deviceType: '交换机', rackCode: 'R-01' },
          { deviceId: 'target-server', deviceName: 'Target Server', deviceType: '服务器', rackCode: 'R-02' },
        ],
        hops: [
          { fromDeviceId: 'source-server', fromDeviceName: 'Source Server', fromPortId: 'source-port', fromPortName: 'eth0', cableId: 'cable-1', cableType: '铜缆', toDeviceId: 'switch-server', toDeviceName: 'Core Switch', toPortId: 'switch-port', toPortName: 'Gi0/1' },
          { fromDeviceId: 'switch-server', fromDeviceName: 'Core Switch', fromPortId: 'switch-port-2', fromPortName: 'Gi0/2', cableId: 'cable-2', cableType: '光纤', toDeviceId: 'target-server', toDeviceName: 'Target Server', toPortId: 'target-port', toPortName: 'eth0' },
        ],
      })
    })

    const view = await mountTraceView()
    try {
      await view.state.loadSource()
      view.state.mode.value = 'reachable'
      await view.state.findReachable()
      await view.state.selectEndpoint('target-server')

      const html = await view.html()
      expect(html).toContain('Source Server')
      expect(html).toContain('Core Switch')
      expect(html).toContain('Target Server')
      expect(html).toContain('eth0')
    } finally {
      view.unmount()
    }
  })

  it.each([0, 11])('shows a validation error for unsupported discovery hops: %s', async (maxHops) => {
    const { findReachable } = useNetworkTrace()

    const result = await findReachable('source-port', maxHops)

    expect(result.error).toBe('最大跳数必须在 1 到 10 之间')
    expect(requestMock).not.toHaveBeenCalled()
  })
})
