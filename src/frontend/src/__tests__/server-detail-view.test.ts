import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import ServerDetailView from '../views/ServerDetailView.vue'

const requestMock = vi.fn()
const pushMock = vi.fn()

vi.mock('../composables/useApi', () => ({
  useApi: () => ({
    request: (...args: unknown[]) => requestMock(...args),
  }),
}))

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ user: { value: null } }),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => ({ params: { id: 'source-server' } }),
    useRouter: () => ({ push: (...args: unknown[]) => pushMock(...args) }),
  }
})

type ServerDetailViewState = {
  loadServer: () => Promise<void>
  loadPorts: () => Promise<void>
}

async function renderWithPorts(ports: unknown[]): Promise<string> {
  type SetupFn = (...args: unknown[]) => Record<string, unknown>
  const component = ServerDetailView as { setup: SetupFn }
  const originalSetup = component.setup
  let bindings: Record<string, unknown> | null = null

  component.setup = (props, ctx) => {
    if (bindings) return bindings
    bindings = originalSetup(props, ctx)
    return bindings
  }

  try {
    requestMock.mockImplementation((path: string) => ({
      ok: true,
      data: path.endsWith('/ports')
        ? ports
        : {
            id: 'source-server',
            name: 'Source Server',
            managementIP: '10.0.0.1',
            deviceType: '服务器',
            deviceHeight: 1,
            operationalStatus: '正常',
            positionStatus: '在架',
          },
      headers: new Headers(),
      status: 200,
    }))

    const render = () => renderToString(createSSRApp(ServerDetailView))
    await render()
    await (bindings as unknown as ServerDetailViewState).loadServer()
    await (bindings as unknown as ServerDetailViewState).loadPorts()
    return await render()
  } finally {
    component.setup = originalSetup
  }
}

function visibleText(html: string): string {
  return html.replace(/<!--[\s\S]*?-->|<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

afterEach(() => {
  requestMock.mockReset()
  pushMock.mockReset()
})

describe('ServerDetailView port connections', () => {
  it('shows the connected device, port, rack, and U range for a mounted peer', async () => {
    const html = await renderWithPorts([
      {
        id: 'port-1',
        serverId: 'source-server',
        portName: 'eth0',
        portType: 'RJ45',
        speed: '1 Gbps',
        connectedToServerName: 'Core Switch',
        connectedToServerId: 'peer-server',
        connectedToPortName: 'Gi0/1',
        connectedToRackCode: 'R-01',
        connectedToURange: '12-14',
      },
    ])

    expect(visibleText(html)).toContain('Core Switch (Gi0/1) · 机柜 R-01 · U12-14')
  })

  it.each([
    { connectedToRackCode: 'R-01', connectedToURange: null },
    { connectedToRackCode: null, connectedToURange: '12-14' },
  ])('shows unmounted when a peer location field is absent', async ({ connectedToRackCode, connectedToURange }) => {
    const html = await renderWithPorts([
      {
        id: 'port-1',
        serverId: 'source-server',
        portName: 'eth0',
        portType: 'RJ45',
        connectedToServerName: 'Core Switch',
        connectedToServerId: 'peer-server',
        connectedToPortName: 'Gi0/1',
        connectedToRackCode,
        connectedToURange,
      },
    ])

    expect(visibleText(html)).toContain('Core Switch (Gi0/1) · 未上架')
    expect(visibleText(html)).not.toContain('机柜 ')
  })
})
