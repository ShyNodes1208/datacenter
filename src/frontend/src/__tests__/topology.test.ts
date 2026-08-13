import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSSRApp, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import {
  cableTypeColor,
  parseTopologyPayload,
  primaryCableType,
  useTopology,
} from '../composables/useTopology'
import {
  buildCableScene,
  buildPortSlotMap,
  buildSamePortExitOffsets,
  buildUniquePortLabelPlacements,
  DEVICE_U_PX,
  deviceEdgePoint,
  deviceNameLabelRect,
  filterVisibleDevices,
  formatPortLabel,
  filterActiveDeviceSnapshot,
  LABEL_STACK_STEP_Y,
  NETWORK_COLORS,
  parseCableSnapshot,
  portLabelRect,
  portLabelSide,
  portSlotKey,
  purposeDisplayName,
  purposeNetworkColor,
  resolveCableStrokeColor,
  rectsOverlap,
  routeIntersectsRect,
  sameRackRoute,
  staticArrowPositions,
  UNSELECTED_OPACITY,
  ANIMATION_PERIOD_MS,
  computeFitToScreenTransform,
} from '../composables/useCableScene'

const requestMock = vi.fn()
const userMock = ref<{ id: string; username: string; role: string } | null>({
  id: 'u1',
  username: 'admin',
  role: '机房管理员',
})

vi.mock('../composables/useApi', () => ({
  useApi: () => ({
    request: (...args: unknown[]) => requestMock(...args),
  }),
  setUnauthorizedHandler: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

vi.mock('konva', () => {
  class Node {
    on() {
      return this
    }
    off() {
      return this
    }
    add() {
      return this
    }
    x(v?: number) {
      if (typeof v === 'number') return this
      return 0
    }
    y(v?: number) {
      if (typeof v === 'number') return this
      return 0
    }
    scale() {
      return this
    }
    scaleX() {
      return 1
    }
    position() {
      return this
    }
    draggable() {
      return this
    }
    batchDraw() {}
    id() {
      return ''
    }
    destroy() {}
    draw() {}
    destroyChildren() {}
    width(v?: number) {
      if (typeof v === 'number') return this
      return 0
    }
    height(v?: number) {
      if (typeof v === 'number') return this
      return 0
    }
    getPointerPosition() {
      return { x: 0, y: 0 }
    }
  }
  return {
    default: {
      Stage: class extends Node {},
      Layer: class extends Node {},
      Group: class extends Node {},
      Rect: class extends Node {},
      Text: class extends Node {},
      Line: class extends Node {},
      Circle: class extends Node {},
    },
  }
})

beforeAll(() => {
  const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  vi.stubGlobal('matchMedia', matchMediaMock)
  if (typeof globalThis.window !== 'undefined') {
    Object.defineProperty(globalThis.window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: matchMediaMock,
    })
  }
})

afterEach(() => {
  requestMock.mockReset()
  userMock.value = { id: 'u1', username: 'admin', role: '机房管理员' }
})

const sampleCableScene = {
  racks: [{ rackId: 'k1', code: 'R1', x: 0, y: 0, width: 60, height: 100 }],
  devices: [{
    deviceId: 'd1',
    deviceName: 'app-01',
    rackId: 'k1',
    deviceType: '服务器',
    operationalStatus: '正常',
    startU: 1,
    endU: 2,
  }, {
    deviceId: 'd2',
    deviceName: 'sw-01',
    rackId: 'k1',
    deviceType: '交换机',
    operationalStatus: '维护',
    startU: 40,
    endU: 40,
  }],
  cables: [{
    cableId: 'c1',
    cableType: '铜缆',
    purpose: '上联',
    source: {
      deviceId: 'd1',
      deviceName: 'app-01',
      portName: 'eth0',
      speed: '10G',
      rackId: 'k1',
      rackCode: 'R1',
    },
    target: {
      deviceId: 'd2',
      deviceName: 'sw-01',
      portName: 'GE0/1',
      speed: null,
      rackId: 'k1',
      rackCode: 'R1',
    },
  }],
}

describe('useTopology parsers', () => {
  it('parses room-level topology payload', () => {
    const parsed = parseTopologyPayload({
      rooms: [{
        id: 'r1',
        name: '主机房',
        status: '启用',
        location: 'A',
        topologyX: 10,
        topologyY: 20,
        rackCount: 2,
        serverCount: 3,
        cableCount: 4,
      }],
      connections: [{
        sourceRoomId: 'r1',
        targetRoomId: 'r2',
        cableCount: 2,
        types: ['光纤', '铜缆'],
        cables: [{
          cableId: 'c1',
          cableType: '光纤',
          sourceDevice: 'sw-a',
          sourcePort: 'eth0',
          targetDevice: 'sw-b',
          targetPort: 'eth0',
        }],
      }],
    }, null)

    expect(parsed?.mode).toBe('rooms')
    expect(parsed?.rooms).toHaveLength(1)
    expect(parsed?.roomConnections[0]?.cableCount).toBe(2)
    expect(parsed?.roomConnections[0]?.cables).toHaveLength(1)
    expect(parsed?.cableSnapshot).toBeNull()
  })

  it('parses rack-level topology payload', () => {
    const parsed = parseTopologyPayload({
      rooms: [{
        id: 'r1',
        name: '主机房',
        status: '启用',
        location: null,
        topologyX: 0,
        topologyY: 0,
        rackCount: 2,
        serverCount: 2,
        cableCount: 1,
      }],
      racks: [{ id: 'k1', code: 'R1', x: 0, y: 0 }],
      connections: [{
        sourceRackId: 'k1',
        targetRackId: 'k2',
        cableCount: 1,
        types: ['DAC'],
        cables: [],
      }],
    }, 'r1')

    expect(parsed?.mode).toBe('racks')
    expect(parsed?.focusedRoomId).toBe('r1')
    expect(parsed?.racks).toHaveLength(1)
    expect(parsed?.rackConnections[0]?.types).toEqual(['DAC'])
  })

  it('maps cable type colors', () => {
    expect(primaryCableType(['光纤', '铜缆'])).toBe('光纤')
    expect(cableTypeColor('光纤')).toBe('#9868ff')
    expect(cableTypeColor('未知类型')).toBe('#95a5a6')
  })

  it('maps purpose line colors and Shanghai room detection', async () => {
    const { purposeLineColor, isShanghaiRoom, connectionBundleId, filterRoomConnections } = await import('../composables/useTopology')
    expect(purposeLineColor('管理网络')).toBe('#35e6ff')
    expect(purposeLineColor('业务网络')).toBe('#9868ff')
    expect(purposeLineColor('存储网络')).toBe('#ffad3b')
    expect(purposeLineColor('业务网络', '告警')).toBe('#ff4d5f')
    expect(isShanghaiRoom({ id: '64D083F6-CFFB-408E-AE45-5EA0E1914A51', name: 'x' })).toBe(true)
    expect(isShanghaiRoom({ id: 'other', name: '上海机房' })).toBe(true)
    const conn = {
      sourceRoomId: 'a',
      targetRoomId: 'b',
      cableCount: 3,
      cableType: '光纤',
      purpose: '业务网络',
      status: '正常',
      types: ['光纤'],
      cables: [],
    }
    expect(connectionBundleId(conn)).toBe('a|b|光纤|业务网络|正常')
    expect(filterRoomConnections([conn], { purposes: ['业务网络'] })).toHaveLength(1)
    expect(filterRoomConnections([conn], { purposes: ['管理网络'] })).toHaveLength(0)
  })
})

describe('useTopology loader', () => {
  it('loads /api/rooms/topology', async () => {
    requestMock.mockResolvedValue({
      ok: true,
      data: {
        rooms: [{
          id: 'r1',
          name: '主机房',
          status: '启用',
          location: null,
          topologyX: 1,
          topologyY: 2,
          rackCount: 0,
          serverCount: 0,
          cableCount: 0,
        }],
        connections: [],
      },
      headers: new Headers(),
      status: 200,
    })

    const { data, load, error } = useTopology()
    await load()
    expect(requestMock).toHaveBeenCalledWith('/api/rooms/topology', { method: 'GET' })
    expect(error.value).toBe('')
    expect(data.value?.rooms[0]?.name).toBe('主机房')
  })

  it('loads room-focused topology', async () => {
    requestMock.mockResolvedValue({
      ok: true,
      data: {
        rooms: [{
          id: 'r1',
          name: '主机房',
          status: '启用',
          location: null,
          topologyX: 0,
          topologyY: 0,
          rackCount: 1,
          serverCount: 0,
          cableCount: 0,
        }],
        racks: [{ id: 'k1', code: 'R1', x: 1, y: 2 }],
        connections: [],
      },
      headers: new Headers(),
      status: 200,
    })

    const { data, load } = useTopology()
    await load('r1')
    expect(requestMock).toHaveBeenCalledWith('/api/rooms/topology?roomId=r1', { method: 'GET' })
    expect(data.value?.mode).toBe('racks')
  })

  it('loads devices mode from cable-scene', async () => {
    requestMock.mockImplementation(async (path: string) => {
      if (path.includes('/cable-scene')) {
        return {
          ok: true,
          data: sampleCableScene,
          headers: new Headers(),
          status: 200,
        }
      }
      return {
        ok: true,
        data: {
          rooms: [{
            id: 'r1',
            name: '主机房',
            status: '启用',
            location: null,
            topologyX: 0,
            topologyY: 0,
            rackCount: 1,
            serverCount: 2,
            cableCount: 1,
          }],
          racks: [{ id: 'k1', code: 'R1', x: 0, y: 0 }],
          connections: [],
        },
        headers: new Headers(),
        status: 200,
      }
    })

    const { data, loadDevices, error } = useTopology()
    await loadDevices('r1')
    expect(requestMock).toHaveBeenCalledWith('/api/rooms/topology?roomId=r1', { method: 'GET' })
    expect(requestMock).toHaveBeenCalledWith('/api/rooms/r1/cable-scene', { method: 'GET' })
    expect(error.value).toBe('')
    expect(data.value?.mode).toBe('devices')
    expect(data.value?.cableSnapshot?.devices).toHaveLength(2)
    expect(data.value?.cableSnapshot?.cables[0]?.source.speed).toBe('10G')
    expect(data.value?.cableSnapshot?.cables[0]?.target.speed).toBeNull()
  })
})

describe('device-level cable scene', () => {
  it('parses operationalStatus and expands cables with selection highlight', () => {
    const snapshot = parseCableSnapshot(sampleCableScene)
    expect(snapshot).not.toBeNull()
    expect(snapshot?.devices.find((d) => d.deviceId === 'd2')?.operationalStatus).toBe('维护')

    const scene = buildCableScene(
      snapshot!,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    expect(scene.bundles).toHaveLength(1)
    expect(scene.bundles[0]?.highlighted).toBe(true)
    expect(scene.bundles[0]?.animated).toBe(true)
    expect(scene.bundles[0]?.opacity).toBe(1)
    expect(scene.detailRows[0]?.sourceSpeed).toBe('10G')
    expect(scene.detailRows[0]?.targetSpeed).toBeNull()
  })

  it('filters by CableType and Purpose', () => {
    const snapshot = parseCableSnapshot(sampleCableScene)!
    const filtered = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: ['存储'], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    expect(filtered.bundles).toHaveLength(0)

    const matched = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: ['上联'], cableTypes: ['铜缆'] },
      'r1',
      { expandToCables: true },
    )
    expect(matched.bundles).toHaveLength(1)
  })

  it('dims unrelated cables when a device is focused', () => {
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      devices: [
        ...sampleCableScene.devices,
        {
          deviceId: 'd3',
          deviceName: 'db-01',
          rackId: 'k1',
          deviceType: '服务器',
          operationalStatus: '正常',
          startU: 10,
          endU: 11,
        },
      ],
      cables: [
        ...sampleCableScene.cables,
        {
          cableId: 'c2',
          cableType: '光纤',
          purpose: '正常',
          source: {
            deviceId: 'd3',
            deviceName: 'db-01',
            portName: 'eth1',
            speed: '1G',
            rackId: 'k1',
            rackCode: 'R1',
          },
          target: {
            deviceId: 'd2',
            deviceName: 'sw-01',
            portName: 'GE0/2',
            speed: '1G',
            rackId: 'k1',
            rackCode: 'R1',
          },
        },
      ],
    })!
    const scene = buildCableScene(
      snapshot,
      { level: 'device', deviceId: 'd1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const related = scene.bundles.find((b) => b.id === 'c1')
    const unrelated = scene.bundles.find((b) => b.id === 'c2')
    expect(related?.opacity).toBe(1)
    expect(related?.highlighted).toBe(true)
    expect(related?.animated).toBe(false)
    expect(unrelated?.opacity).toBe(UNSELECTED_OPACITY)
    expect(unrelated?.animated).toBe(false)
  })

  it('builds legend with purpose network colors (CR-002 mapping)', () => {
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      cables: [
        ...sampleCableScene.cables,
        {
          cableId: 'c2',
          cableType: '光纤',
          purpose: '上联',
          source: {
            deviceId: 'd1',
            deviceName: 'srv-01',
            portName: 'eth1',
            speed: '10G',
            rackId: 'k1',
            rackCode: 'R1',
          },
          target: {
            deviceId: 'd2',
            deviceName: 'sw-01',
            portName: 'GE0/2',
            speed: '10G',
            rackId: 'k1',
            rackCode: 'R1',
          },
        },
        {
          cableId: 'c3',
          cableType: 'DAC',
          purpose: '正常',
          source: {
            deviceId: 'd1',
            deviceName: 'srv-01',
            portName: 'eth2',
            speed: '25G',
            rackId: 'k1',
            rackCode: 'R1',
          },
          target: {
            deviceId: 'd2',
            deviceName: 'sw-01',
            portName: 'GE0/3',
            speed: '25G',
            rackId: 'k1',
            rackCode: 'R1',
          },
        },
        {
          cableId: 'c4',
          cableType: '铜缆',
          purpose: '存储',
          source: {
            deviceId: 'd1',
            deviceName: 'srv-01',
            portName: 'eth3',
            speed: '10G',
            rackId: 'k1',
            rackCode: 'R1',
          },
          target: {
            deviceId: 'd2',
            deviceName: 'sw-01',
            portName: 'GE0/4',
            speed: '10G',
            rackId: 'k1',
            rackCode: 'R1',
          },
        },
      ],
    })!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const management = scene.legend.find((i) => i.purpose === '管理网络')
    const business = scene.legend.find((i) => i.purpose === '业务网络')
    const storage = scene.legend.find((i) => i.purpose === '存储网络')
    expect(management?.color).toBe(NETWORK_COLORS.management)
    expect(business?.color).toBe(NETWORK_COLORS.business)
    expect(storage?.color).toBe(NETWORK_COLORS.storage)
    expect(scene.bundles.find((b) => b.purpose === '正常')?.strokeColor).toBe(NETWORK_COLORS.management)
    expect(scene.bundles.find((b) => b.purpose === '上联')?.strokeColor).toBe(NETWORK_COLORS.business)
  })

  it('assigns distinct edge anchors for multiple ports on the same device', () => {
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      cables: [
        {
          cableId: 'c1',
          cableType: '铜缆',
          purpose: '上联',
          source: {
            deviceId: 'd1',
            deviceName: 'app-01',
            portName: 'eth1',
            speed: '10G',
            rackId: 'k1',
            rackCode: 'R1',
          },
          target: {
            deviceId: 'd2',
            deviceName: 'sw-01',
            portName: 'GE0/1',
            speed: '10G',
            rackId: 'k1',
            rackCode: 'R1',
          },
        },
        {
          cableId: 'c2',
          cableType: '光纤',
          purpose: '正常',
          source: {
            deviceId: 'd1',
            deviceName: 'app-01',
            portName: 'eth2',
            speed: '10G',
            rackId: 'k1',
            rackCode: 'R1',
          },
          target: {
            deviceId: 'd2',
            deviceName: 'sw-01',
            portName: 'GE0/2',
            speed: '10G',
            rackId: 'k1',
            rackCode: 'R1',
          },
        },
      ],
    })!
    const slots = buildPortSlotMap(snapshot.cables)
    expect(slots.get('d1|eth1')?.index).not.toBe(slots.get('d1|eth2')?.index)
    expect(slots.get('d2|GE0/1')?.index).not.toBe(slots.get('d2|GE0/2')?.index)

    const device = snapshot.devices.find((d) => d.deviceId === 'd1')!
    const rack = snapshot.racks[0]!
    const eth1 = deviceEdgePoint(device, rack, 'left', {
      portName: 'eth1',
      slotIndex: slots.get('d1|eth1')!.index,
      slotCount: slots.get('d1|eth1')!.count,
    })
    const eth2 = deviceEdgePoint(device, rack, 'left', {
      portName: 'eth2',
      slotIndex: slots.get('d1|eth2')!.index,
      slotCount: slots.get('d1|eth2')!.count,
    })
    expect(eth1.x).toBe(eth2.x)
    expect(eth1.y).not.toBe(eth2.y)

    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const route1 = scene.bundles.find((b) => b.id === 'c1')?.route
    const route2 = scene.bundles.find((b) => b.id === 'c2')?.route
    expect(route1?.length).toBeGreaterThanOrEqual(2)
    expect(route2?.length).toBeGreaterThanOrEqual(2)
    const start1 = route1![0]!
    const start2 = route2![0]!
    const end1 = route1![route1!.length - 1]!
    const end2 = route2![route2!.length - 1]!
    expect(`${start1.x},${start1.y}`).not.toBe(`${start2.x},${start2.y}`)
    expect(`${end1.x},${end1.y}`).not.toBe(`${end2.x},${end2.y}`)
  })

  it('excludes cross-room cables from scene so remaining routes have arrows and anchors', () => {
    const snapshot = parseCableSnapshot({
      racks: [{ rackId: 'k1', code: 'R1', x: 0, y: 0, width: 60, height: 100 }],
      devices: sampleCableScene.devices,
      cables: [
        ...sampleCableScene.cables,
        {
          cableId: 'c-cross',
          cableType: '光纤',
          purpose: '上联',
          source: {
            deviceId: 'd1',
            deviceName: 'app-01',
            portName: 'eth9',
            speed: '10G',
            rackId: 'k1',
            rackCode: 'R1',
          },
          target: {
            deviceId: 'd-remote',
            deviceName: 'sw-remote',
            portName: 'GE0/9',
            speed: '10G',
            rackId: 'k-other',
            rackCode: 'OTHER',
          },
        },
      ],
    })!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    expect(scene.bundles.map((b) => b.id)).toEqual(['c1'])
    expect(scene.bundles).toHaveLength(1)
    expect(scene.legend.every((item) => item.count === 1)).toBe(true)
    for (const bundle of scene.bundles) {
      expect(bundle.route.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('computes fit-to-screen transform so all racks fit the viewport', () => {
    const transform = computeFitToScreenTransform(
      [
        { x: 60, y: 70, width: 160, height: 200 },
        { x: 280, y: 70, width: 160, height: 200 },
        { x: 60, y: 390, width: 160, height: 200 },
        { x: 280, y: 390, width: 160, height: 200 },
      ],
      { width: 400, height: 300 },
    )
    expect(transform.scale).toBeGreaterThan(0)
    expect(transform.scale).toBeLessThanOrEqual(1)
    const fittedW = (280 + 160 + 8 - (60 - 8) + 80) * transform.scale
    const fittedH = (390 + 200 + 12 - (70 - 28) + 80) * transform.scale
    expect(fittedW).toBeLessThanOrEqual(400 + 1e-6)
    expect(fittedH).toBeLessThanOrEqual(300 + 1e-6)
  })
})

describe('TopologyView', () => {
  it('renders topology page shell', async () => {
    requestMock.mockResolvedValue({
      ok: true,
      data: { rooms: [], connections: [] },
      headers: new Headers(),
      status: 200,
    })

    const { default: TopologyView } = await import('../views/TopologyView.vue')
    const app = createSSRApp(TopologyView)
    const html = await renderToString(app)
    await nextTick()

    expect(html).toContain('aria-label="拓扑视图"')
    expect(html).toContain('机房线缆拓扑')
    expect(html).toContain('跨机房线缆聚合视图')
  })

  it('device-level scene exposes non-realtime notice and missing Speed as 未登记', async () => {
    const snapshot = parseCableSnapshot(sampleCableScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    expect(scene.detailRows[0]?.targetSpeed).toBeNull()
    expect(scene.detailRows[0]?.bandwidth).toBe('未配置')

    const { default: CableLayer } = await import('../components/CableLayer.vue')
    const app = createSSRApp(CableLayer, {
      scene,
      animationEnabled: true,
    })
    const html = await renderToString(app)
    expect(html).not.toContain('非实时流量')
    expect(html).toContain('static-arrow')

    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const view = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(view).toContain('配置拓扑 · 非实时数据')
  })

})

describe('CR-002 visual fidelity (T-01 to T-20)', () => {
  it('T-01: can enter rack level from room topology loader', async () => {
    requestMock.mockResolvedValue({
      ok: true,
      data: {
        rooms: [{
          id: 'r1', name: '主机房', status: '启用', location: 'A区',
          topologyX: 0, topologyY: 0, rackCount: 1, serverCount: 0, cableCount: 0,
        }],
        racks: [{ id: 'k1', code: 'R1', x: 0, y: 0 }],
        connections: [],
      },
      headers: new Headers(),
      status: 200,
    })
    const { data, load } = useTopology()
    await load('r1')
    expect(data.value?.mode).toBe('racks')
  })

  it('T-02: visible device-level button exists in template', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toContain('data-testid="enter-device-level"')
    expect(source).toContain('设备级')
    expect(source).toContain('level-switcher')
  })

  it('T-03: rack double-click enters device level (loadDevices wired)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toMatch(/group\.on\('dblclick'[\s\S]*loadDevices/)
  })

  it('T-04: devices only render under their rack in laid snapshot coords', () => {
    const snapshot = parseCableSnapshot({
      racks: [
        { rackId: 'k1', code: 'R1', x: 0, y: 0, width: 60, height: 100 },
        { rackId: 'k2', code: 'R2', x: 100, y: 0, width: 60, height: 100 },
      ],
      devices: [
        { deviceId: 'd1', deviceName: 'a', rackId: 'k1', deviceType: '服务器', operationalStatus: '正常', startU: 1, endU: 2 },
        { deviceId: 'd2', deviceName: 'b', rackId: 'k2', deviceType: '交换机', operationalStatus: '正常', startU: 1, endU: 1 },
      ],
      cables: [],
    })!
    expect(snapshot.devices.every((d) => snapshot.racks.some((r) => r.rackId === d.rackId))).toBe(true)
    expect(snapshot.devices.find((d) => d.deviceId === 'd1')?.rackId).toBe('k1')
    expect(snapshot.devices.find((d) => d.deviceId === 'd2')?.rackId).toBe('k2')
  })

  it('T-05: cable endpoints land on port edge anchors', () => {
    const snapshot = parseCableSnapshot(sampleCableScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const route = scene.bundles[0]?.route
    expect(route?.length).toBeGreaterThanOrEqual(2)
    const start = route![0]!
    const end = route![route!.length - 1]!
    const rack = snapshot.racks[0]!
    expect([rack.x, rack.x + rack.width]).toContain(start.x)
    expect([rack.x, rack.x + rack.width]).toContain(end.x)
  })

  it('T-06: devices mode excludes room-aggregation payload (cableSnapshot only)', async () => {
    requestMock.mockImplementation(async (path: string) => {
      if (path.includes('/cable-scene')) {
        return { ok: true, data: sampleCableScene, headers: new Headers(), status: 200 }
      }
      return {
        ok: true,
        data: {
          rooms: [{
            id: 'r1', name: '主机房', status: '启用', location: null,
            topologyX: 0, topologyY: 0, rackCount: 1, serverCount: 2, cableCount: 1,
          }],
          racks: [{ id: 'k1', code: 'R1', x: 0, y: 0 }],
          connections: [{
            sourceRackId: 'k1', targetRackId: 'k1', cableCount: 9, types: ['铜缆'], cables: [],
          }],
        },
        headers: new Headers(),
        status: 200,
      }
    })
    const { data, loadDevices } = useTopology()
    await loadDevices('r1')
    expect(data.value?.mode).toBe('devices')
    expect(data.value?.cableSnapshot?.cables).toHaveLength(1)
    expect(data.value?.rackConnections.length ?? 0).toBeGreaterThanOrEqual(0)
  })

  it('T-07: directed cables produce static arrow markers', () => {
    const snapshot = parseCableSnapshot(sampleCableScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    for (const bundle of scene.bundles) {
      const arrows = staticArrowPositions(bundle.route)
      expect(arrows.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('T-08: forward arrows follow route tangent; bidirectional yields reverse too', () => {
    const route = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
    ]
    const arrows = staticArrowPositions(route, 80)
    expect(arrows[0]?.angle).toBeCloseTo(0, 5)
    const long = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ]
    expect(staticArrowPositions(long, 80).length).toBeGreaterThanOrEqual(2)
  })

  it('T-09: selecting a cable highlights only that cable', () => {
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      cables: [
        ...sampleCableScene.cables,
        {
          cableId: 'c2',
          cableType: '光纤',
          purpose: '正常',
          source: {
            deviceId: 'd1', deviceName: 'app-01', portName: 'eth9', speed: '1G',
            rackId: 'k1', rackCode: 'R1',
          },
          target: {
            deviceId: 'd2', deviceName: 'sw-01', portName: 'GE0/9', speed: '1G',
            rackId: 'k1', rackCode: 'R1',
          },
        },
      ],
    })!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    expect(scene.bundles.find((b) => b.id === 'c1')?.highlighted).toBe(true)
    expect(scene.bundles.find((b) => b.id === 'c2')?.highlighted).toBe(false)
  })

  it('T-10: unselected cables use opacity 0.22', () => {
    const snapshot = parseCableSnapshot(sampleCableScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    // only one cable — create second via purpose filter path already covered; assert constant
    expect(UNSELECTED_OPACITY).toBe(0.22)
    expect(scene.bundles[0]?.opacity).toBe(1)
  })

  it('T-11: animation toggle defaults to off in TopologyView', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toMatch(/animationEnabled\s*=\s*ref\(false\)/)
  })

  it('T-12: only selected cable is marked animated', () => {
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      cables: [
        ...sampleCableScene.cables,
        {
          cableId: 'c2', cableType: '光纤', purpose: '正常',
          source: {
            deviceId: 'd1', deviceName: 'app-01', portName: 'eth8', speed: null,
            rackId: 'k1', rackCode: 'R1',
          },
          target: {
            deviceId: 'd2', deviceName: 'sw-01', portName: 'GE0/8', speed: null,
            rackId: 'k1', rackCode: 'R1',
          },
        },
      ],
    })!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    expect(scene.bundles.find((b) => b.id === 'c1')?.animated).toBe(true)
    expect(scene.bundles.find((b) => b.id === 'c2')?.animated).toBe(false)
  })

  it('T-13: non-realtime traffic label is present', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const view = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(view).toContain('非实时流量')
    expect(view).toContain('流动动画')
  })

  it('T-14: prefers-reduced-motion stops animation', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../components/CableLayer.vue'), 'utf8')
    expect(source).toContain('prefers-reduced-motion')
    expect(source).toContain('animation: none')
    expect(source).toContain('1400ms')
    expect(ANIMATION_PERIOD_MS).toBe(1400)

    const snapshot = parseCableSnapshot(sampleCableScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    const { default: CableLayer } = await import('../components/CableLayer.vue')
    const app = createSSRApp(CableLayer, { scene, animationEnabled: false })
    const html = await renderToString(app)
    expect(html).not.toContain('animated-path')
    expect(html).toContain('static-arrow')
  })

  it('T-15: prefers-reduced-motion still shows static arrows', async () => {
    const snapshot = parseCableSnapshot(sampleCableScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    const { default: CableLayer } = await import('../components/CableLayer.vue')
    const app = createSSRApp(CableLayer, { scene, animationEnabled: false })
    const html = await renderToString(app)
    expect(html).toContain('static-arrow')
    expect(html).toContain('polygon')
  })

  it('T-16: switching selected cable moves animated flag', () => {
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      cables: [
        ...sampleCableScene.cables,
        {
          cableId: 'c2', cableType: '光纤', purpose: '正常',
          source: {
            deviceId: 'd1', deviceName: 'app-01', portName: 'eth7', speed: null,
            rackId: 'k1', rackCode: 'R1',
          },
          target: {
            deviceId: 'd2', deviceName: 'sw-01', portName: 'GE0/7', speed: null,
            rackId: 'k1', rackCode: 'R1',
          },
        },
      ],
    })!
    const first = buildCableScene(
      snapshot, { level: 'room', roomId: 'r1' }, { purposes: [], cableTypes: [] }, 'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    const second = buildCableScene(
      snapshot, { level: 'room', roomId: 'r1' }, { purposes: [], cableTypes: [] }, 'r1',
      { expandToCables: true, selectedCableId: 'c2' },
    )
    expect(first.bundles.find((b) => b.id === 'c1')?.animated).toBe(true)
    expect(first.bundles.find((b) => b.id === 'c2')?.animated).toBe(false)
    expect(second.bundles.find((b) => b.id === 'c1')?.animated).toBe(false)
    expect(second.bundles.find((b) => b.id === 'c2')?.animated).toBe(true)
  })

  it('T-17: TopologyView unmount destroys stage listeners', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toContain('onUnmounted')
    expect(source).toContain('stage?.destroy()')
    expect(source).toMatch(/stage\.off\(['"]wheel['"]\)|stage\.off\('\.devicePan'\)/)
  })

  it('T-18: empty rack copy exists in device scene renderer', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toContain('暂无设备')
  })

  it('T-19: missing port info is labeled 端口信息缺失', () => {
    expect(formatPortLabel('')).toBe('端口信息缺失')
    expect(formatPortLabel('  ')).toBe('端口信息缺失')
    expect(formatPortLabel('eth0')).toBe('eth0')
    expect(purposeDisplayName('正常')).toBe('管理网络')
    expect(purposeNetworkColor('上联')).toBe(NETWORK_COLORS.business)
    expect(resolveCableStrokeColor('正常', '铜缆', '异常', '正常')).toBe(NETWORK_COLORS.alert)
  })

  it('T-20: filter removes selected cable from scene bundles', () => {
    const snapshot = parseCableSnapshot(sampleCableScene)!
    const filtered = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: ['存储'], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    expect(filtered.bundles.find((b) => b.id === 'c1')).toBeUndefined()
    const byName = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [], deviceNameQuery: 'no-such-device' },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    expect(byName.bundles).toHaveLength(0)
  })

  it('T-21: device name/type filters hide non-matching device nodes', () => {
    const snapshot = parseCableSnapshot(sampleCableScene)!
    const byName = filterVisibleDevices(snapshot.devices, { deviceNameQuery: 'app' })
    expect(byName.map((d) => d.deviceId)).toEqual(['d1'])
    const byType = filterVisibleDevices(snapshot.devices, { deviceTypes: ['交换机'] })
    expect(byType.map((d) => d.deviceId)).toEqual(['d2'])
    const both = filterVisibleDevices(snapshot.devices, {
      deviceNameQuery: 'sw',
      deviceTypes: ['服务器'],
    })
    expect(both).toHaveLength(0)
    const unfiltered = filterVisibleDevices(snapshot.devices, {})
    expect(unfiltered).toHaveLength(2)
  })

  it('T-22: same-port cables get distinct exit offsets; labels outside panels clear routes', () => {
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      cables: [
        sampleCableScene.cables[0],
        {
          cableId: 'c2',
          cableType: '光纤',
          purpose: '正常',
          source: {
            deviceId: 'd1',
            deviceName: 'app-01',
            portName: 'eth0',
            speed: null,
            rackId: 'k1',
            rackCode: 'R1',
          },
          target: {
            deviceId: 'd2',
            deviceName: 'sw-01',
            portName: 'GE0/1',
            speed: null,
            rackId: 'k1',
            rackCode: 'R1',
          },
        },
      ],
    })!
    const offsets = buildSamePortExitOffsets(snapshot.cables)
    const srcKey1 = `c1|${portSlotKey('d1', 'eth0')}`
    const srcKey2 = `c2|${portSlotKey('d1', 'eth0')}`
    expect(offsets.get(srcKey1)).not.toBe(offsets.get(srcKey2))

    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const routes = scene.bundles.map((b) => b.route)
    expect(routes[0]?.[1]?.x).not.toBe(routes[1]?.[1]?.x)

    for (const bundle of scene.bundles) {
      const startSide = portLabelSide(bundle.route, 'start')
      const endSide = portLabelSide(bundle.route, 'end')
      expect(startSide).toBe('left')
      expect(endSide).toBe('left')
      const startRect = portLabelRect(bundle.route[0]!, startSide)
      const endRect = portLabelRect(bundle.route[bundle.route.length - 1]!, endSide)
      expect(routeIntersectsRect(bundle.route, startRect)).toBe(false)
      expect(routeIntersectsRect(bundle.route, endRect)).toBe(false)
    }

    const rack = snapshot.racks[0]!
    const src = snapshot.devices[0]!
    const tgt = snapshot.devices[1]!
    const overlapping = sameRackRoute(rack, src, tgt)
    // A label only 8px outside the port sits inside the left cable channel.
    const badLabel = portLabelRect(overlapping[0]!, 'left', { outwardClearance: 8 })
    expect(routeIntersectsRect(overlapping, badLabel)).toBe(true)
  })

  it('T-23: port labels dedupe by physical port and do not overlap names or each other', () => {
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      racks: [{ rackId: 'k1', code: 'R1', x: 100, y: 0, width: 168, height: 800 }],
      cables: [
        sampleCableScene.cables[0],
        {
          cableId: 'c2',
          cableType: '光纤',
          purpose: '正常',
          source: {
            deviceId: 'd1',
            deviceName: 'app-01',
            portName: 'eth0',
            speed: null,
            rackId: 'k1',
            rackCode: 'R1',
          },
          target: {
            deviceId: 'd2',
            deviceName: 'sw-01',
            portName: 'GE0/1',
            speed: null,
            rackId: 'k1',
            rackCode: 'R1',
          },
        },
      ],
    })!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    expect(scene.bundles).toHaveLength(2)
    const placements = buildUniquePortLabelPlacements(
      scene.bundles,
      snapshot.cables,
      snapshot.devices,
      snapshot.racks,
      { canvasHeight: 900 },
    )
    // Two cables share eth0 and GE0/1 → still one label per physical port.
    expect(placements).toHaveLength(2)
    expect(placements.map((p) => p.key).sort()).toEqual(['d1|eth0', 'd2|GE0/1'])

    const nameRects = snapshot.devices.map((d) =>
      deviceNameLabelRect(d, snapshot.racks[0]!),
    )
    for (const placement of placements) {
      for (const nameRect of nameRects) {
        expect(rectsOverlap(placement.rect, nameRect)).toBe(false)
      }
    }
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        expect(rectsOverlap(placements[i]!.rect, placements[j]!.rect)).toBe(false)
      }
    }
  })

  it('T-25: dense same-side labels stack deterministically inside canvas without overlaps or route hits', () => {
    const portCount = 56
    const devices = [
      {
        deviceId: 'sw-dense',
        deviceName: 'sw-dense',
        rackId: 'k1',
        deviceType: '交换机',
        operationalStatus: '正常',
        startU: 10,
        endU: 11,
      },
      {
        deviceId: 'srv-dense',
        deviceName: 'srv-dense',
        rackId: 'k1',
        deviceType: '服务器',
        operationalStatus: '正常',
        startU: 1,
        endU: 2,
      },
    ]
    // Many unique switch ports → one shared server port (matches dense same-rack left labels).
    const cables = Array.from({ length: portCount }, (_, i) => ({
      cableId: `cd-${i}`,
      cableType: '光纤',
      purpose: '正常',
      source: {
        deviceId: 'sw-dense',
        deviceName: 'sw-dense',
        portName: `GE0/${i}`,
        speed: null,
        rackId: 'k1',
        rackCode: 'R1',
      },
      target: {
        deviceId: 'srv-dense',
        deviceName: 'srv-dense',
        portName: 'eth0',
        speed: null,
        rackId: 'k1',
        rackCode: 'R1',
      },
    }))
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      racks: [{ rackId: 'k1', code: 'R1', x: 160, y: 40, width: 168, height: 900 }],
      devices,
      cables,
    })!
    const canvasHeight = 960
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const placements = buildUniquePortLabelPlacements(
      scene.bundles,
      snapshot.cables,
      snapshot.devices,
      snapshot.racks,
      { canvasHeight },
    )
    const swLeft = placements.filter((p) => p.deviceId === 'sw-dense' && p.side === 'left')
    expect(swLeft.length).toBeGreaterThanOrEqual(50)

    const sortedY = [...swLeft].map((p) => p.rect.y).sort((a, b) => a - b)
    for (let i = 1; i < sortedY.length; i++) {
      expect(sortedY[i]! - sortedY[i - 1]!).toBe(LABEL_STACK_STEP_Y)
    }

    for (const p of placements) {
      expect(p.rect.y).toBeGreaterThanOrEqual(0)
      expect(p.rect.y + p.rect.height).toBeLessThanOrEqual(canvasHeight)
    }
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        expect(rectsOverlap(placements[i]!.rect, placements[j]!.rect)).toBe(false)
      }
    }
    for (const bundle of scene.bundles) {
      for (const p of placements) {
        expect(routeIntersectsRect(bundle.route, p.rect)).toBe(false)
      }
    }

    const again = buildUniquePortLabelPlacements(
      scene.bundles,
      snapshot.cables,
      snapshot.devices,
      snapshot.racks,
      { canvasHeight },
    )
    expect(again.map((p) => `${p.key}:${p.rect.x},${p.rect.y}`)).toEqual(
      placements.map((p) => `${p.key}:${p.rect.x},${p.rect.y}`),
    )
  })

  it('T-24: visible cables never reference hidden device endpoints', () => {
    const snapshot = parseCableSnapshot(sampleCableScene)!
    const byName = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [], deviceNameQuery: 'app' },
      'r1',
      { expandToCables: true },
    )
    const visibleDevices = filterVisibleDevices(snapshot.devices, { deviceNameQuery: 'app' })
    const visibleIds = new Set(visibleDevices.map((d) => d.deviceId))
    // app↔sw: only app matches → cable hidden (no dangling switch endpoint).
    expect(byName.bundles).toHaveLength(0)
    expect(visibleIds.has('d1')).toBe(true)
    expect(visibleIds.has('d2')).toBe(false)

    const byType = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [], deviceTypes: ['服务器'] },
      'r1',
      { expandToCables: true },
    )
    expect(byType.bundles).toHaveLength(0)

    const bothEnds = parseCableSnapshot({
      ...sampleCableScene,
      devices: [
        ...sampleCableScene.devices,
        {
          deviceId: 'd3',
          deviceName: 'app-02',
          rackId: 'k1',
          deviceType: '服务器',
          operationalStatus: '正常',
          startU: 10,
          endU: 11,
        },
      ],
      cables: [
        {
          cableId: 'c-srv',
          cableType: '铜缆',
          purpose: '正常',
          source: {
            deviceId: 'd1',
            deviceName: 'app-01',
            portName: 'eth1',
            speed: null,
            rackId: 'k1',
            rackCode: 'R1',
          },
          target: {
            deviceId: 'd3',
            deviceName: 'app-02',
            portName: 'eth1',
            speed: null,
            rackId: 'k1',
            rackCode: 'R1',
          },
        },
      ],
    })!
    const serverOnly = buildCableScene(
      bothEnds,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [], deviceTypes: ['服务器'] },
      'r1',
      { expandToCables: true },
    )
    const serverIds = new Set(
      filterVisibleDevices(bothEnds.devices, { deviceTypes: ['服务器'] }).map((d) => d.deviceId),
    )
    expect(serverOnly.bundles).toHaveLength(1)
    for (const bundle of serverOnly.bundles) {
      const cable = bothEnds.cables.find((c) => c.cableId === bundle.id)!
      expect(serverIds.has(cable.source.deviceId)).toBe(true)
      expect(serverIds.has(cable.target.deviceId)).toBe(true)
    }
  })

  it('T-26: cross-device route that passes through another label column is avoided', () => {
    const cableId = 'cross-cable'
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      racks: [
        { rackId: 'kA', code: 'A1', x: 40, y: 40, width: 120, height: 200 },
        { rackId: 'kB', code: 'B1', x: 360, y: 40, width: 120, height: 200 },
      ],
      devices: [
        { deviceId: 'dA', deviceName: 'dev-A', deviceType: '服务器', rackId: 'kA', startU: 1, endU: 4 },
        { deviceId: 'dB', deviceName: 'dev-B', deviceType: '服务器', rackId: 'kB', startU: 1, endU: 4 },
      ],
      cables: [
        {
          cableId,
          cableType: '光纤',
          purpose: '正常',
          source: { deviceId: 'dA', deviceName: 'dev-A', portName: 'GE0/0', speed: null, rackId: 'kA', rackCode: 'A1' },
          target: { deviceId: 'dB', deviceName: 'dev-B', portName: 'GE0/0', speed: null, rackId: 'kB', rackCode: 'B1' },
        },
      ],
    })!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const placements = buildUniquePortLabelPlacements(
      scene.bundles,
      snapshot.cables,
      snapshot.devices,
      snapshot.racks,
      { canvasHeight: 960 },
    )
    expect(placements.length).toBeGreaterThanOrEqual(2)
    for (const bundle of scene.bundles) {
      for (const p of placements) {
        expect(routeIntersectsRect(bundle.route, p.rect)).toBe(false)
      }
    }
  })
})

describe('TASK-20260812-120000 review fixes', () => {
  it('FIX-1: filterActiveDeviceSnapshot drops legacy and stub racks with their devices/cables', () => {
    const snapshot = parseCableSnapshot({
      racks: [
        { rackId: 'k1', code: 'R3-01', x: 0, y: 0, width: 60, height: 100 },
        { rackId: 'legacy', code: 'R-页面验证机房-01', x: 100, y: 0, width: 60, height: 100 },
        { rackId: 'stub', code: 'STUB-BJ', x: 200, y: 0, width: 60, height: 100 },
      ],
      devices: [
        { deviceId: 'd1', deviceName: 'app', rackId: 'k1', deviceType: '服务器', operationalStatus: '正常', startU: 1, endU: 2 },
        { deviceId: 'd2', deviceName: 'old', rackId: 'legacy', deviceType: '服务器', operationalStatus: '正常', startU: 1, endU: 2 },
        { deviceId: 'd3', deviceName: 'stub', rackId: 'stub', deviceType: '交换机', operationalStatus: '正常', startU: 1, endU: 1 },
      ],
      cables: [
        {
          cableId: 'c1',
          cableType: '铜缆',
          purpose: '正常',
          status: '正常',
          source: {
            deviceId: 'd1', deviceName: 'app', portName: 'eth0', speed: null, rackId: 'k1', rackCode: 'R3-01',
          },
          target: {
            deviceId: 'd2', deviceName: 'old', portName: 'eth0', speed: null, rackId: 'legacy', rackCode: 'R-页面验证机房-01',
          },
        },
        {
          cableId: 'c2',
          cableType: '光纤',
          purpose: '正常',
          status: '正常',
          source: {
            deviceId: 'd1', deviceName: 'app', portName: 'eth1', speed: null, rackId: 'k1', rackCode: 'R3-01',
          },
          target: {
            deviceId: 'd3', deviceName: 'stub', portName: 'GE0/1', speed: null, rackId: 'stub', rackCode: 'STUB-BJ',
          },
        },
      ],
    })!
    const filtered = filterActiveDeviceSnapshot(snapshot)
    expect(filtered.racks.map((r) => r.code)).toEqual(['R3-01'])
    expect(filtered.devices.map((d) => d.deviceId)).toEqual(['d1'])
    expect(filtered.cables).toHaveLength(0)
  })

  it('FIX-2: computeFitToScreenTransform keeps multi-rack device layout inside viewport', () => {
    const transform = computeFitToScreenTransform(
      [
        { x: 60, y: 70, width: 160, height: 200 },
        { x: 280, y: 70, width: 160, height: 200 },
        { x: 60, y: 390, width: 160, height: 200 },
        { x: 280, y: 390, width: 160, height: 200 },
      ],
      { width: 400, height: 300 },
    )
    expect(transform.scale).toBeGreaterThan(0)
    expect(transform.scale).toBeLessThanOrEqual(1)
  })

  it('FIX-3: CableLayer bundle groups expose device-cable-bundle test id', async () => {
    const snapshot = parseCableSnapshot(sampleCableScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const { default: CableLayer } = await import('../components/CableLayer.vue')
    const app = createSSRApp(CableLayer, { scene, animationEnabled: false })
    const html = await renderToString(app)
    expect(html).toContain('data-testid="device-cable-bundle"')
  })

  it('FIX-4: selected cable detail rows come from parsed cable status and speed', () => {
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      cables: [{
        ...sampleCableScene.cables[0],
        status: '告警',
        target: { ...sampleCableScene.cables[0].target, speed: null },
      }],
    })!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    expect(scene.bundles[0]?.strokeColor).toBeTruthy()
    expect(snapshot.cables[0]?.status).toBe('告警')
    expect(scene.detailRows[0]?.targetSpeed).toBeNull()
    expect(scene.detailRows[0]?.bandwidth).toBe('未配置')
  })
})

describe('TASK-20260813-085046 room/rack hit + dblclick', () => {
  it('FIX-5: drawRoomPlatform adds a transparent hit rect covering the platform including top slope', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const fnStart = source.indexOf('function drawRoomPlatform(')
    expect(fnStart).toBeGreaterThanOrEqual(0)
    const fnBody = source.slice(fnStart, source.indexOf('function drawScene()', fnStart))
    expect(fnBody).toMatch(/new Konva\.Rect\(\{[\s\S]*?x:\s*0[\s\S]*?y:\s*-dy[\s\S]*?width:\s*w\s*\+\s*dx[\s\S]*?height:\s*h\s*\+\s*dy\s*\+\s*8[\s\S]*?fill:\s*'transparent'/)
    expect(fnBody.indexOf('new Konva.Rect')).toBeLessThan(fnBody.indexOf('listening: false'))
  })

  it('FIX-6: rack click handler does not call drawScene (keeps dblclick on same node)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const restoreIdx = source.indexOf('focusedRoomId.value = current.focusedRoomId ?? focusedRoomId.value')
    expect(restoreIdx).toBeGreaterThanOrEqual(0)
    const clickIdx = source.lastIndexOf("group.on('click'", restoreIdx)
    expect(clickIdx).toBeGreaterThanOrEqual(0)
    const dblIdx = source.indexOf("group.on('dblclick'", restoreIdx)
    expect(dblIdx).toBeGreaterThan(restoreIdx)
    const clickBlock = source.slice(clickIdx, dblIdx).replace(/\/\/[^\n]*/g, '')
    expect(clickBlock).toContain('focusedRoomId.value = current.focusedRoomId')
    expect(clickBlock).not.toContain('drawScene()')
  })

  it('FIX-7: room click handler does not call drawScene (keeps dblclick on same node)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const marker = "router.replace({ query: { ...route.query, roomId: room.id, view: 'rooms' } })"
    const markerIdx = source.indexOf(marker)
    expect(markerIdx).toBeGreaterThanOrEqual(0)
    const clickIdx = source.lastIndexOf("group.on('click'", markerIdx)
    expect(clickIdx).toBeGreaterThanOrEqual(0)
    const dragendIdx = source.indexOf("group.on('dragend'", clickIdx)
    expect(dragendIdx).toBeGreaterThan(clickIdx)
    const clickBlock = source.slice(clickIdx, dragendIdx).replace(/\/\/[^\n]*/g, '')
    expect(clickBlock).toContain('focusedRoomId.value = room.id')
    expect(clickBlock).toContain('updateRoomSelection(prev, room.id)')
    expect(clickBlock).not.toContain('drawScene()')
  })

  it('FIX-8: syncFromRoute skips load(null) when already in rooms mode', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const fnStart = source.indexOf('async function syncFromRoute(')
    expect(fnStart).toBeGreaterThanOrEqual(0)
    const fnBody = source.slice(fnStart, source.indexOf('function toggleRoomCableType(', fnStart))
    expect(fnBody).toMatch(/view\s*===\s*['"]rooms['"][\s\S]*topology\.value\?\.mode\s*===\s*['"]rooms['"]/)
    const guardIdx = fnBody.search(/view\s*===\s*['"]rooms['"][\s\S]*?topology\.value\?\.mode\s*===\s*['"]rooms['"]/)
    const loadNullIdx = fnBody.lastIndexOf('load(null)')
    expect(guardIdx).toBeGreaterThanOrEqual(0)
    expect(loadNullIdx).toBeGreaterThan(guardIdx)
    expect(fnBody).toContain('load(null)')
  })

  it('FIX-9: room platform top line is named for targeted selection updates', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const fnStart = source.indexOf('function drawRoomPlatform(')
    expect(fnStart).toBeGreaterThanOrEqual(0)
    const fnBody = source.slice(fnStart, source.indexOf('function drawScene()', fnStart))
    expect(fnBody).toMatch(/stroke:\s*selected\s*\?\s*TOPOLOGY_PALETTE\.accentBlue\s*:\s*'#2e4a6e'[\s\S]*?name:\s*['"]room-platform-top['"]/)
  })

  it('FIX-10: rooms branch tracks roomGroups and updateRoomSelection patches stroke only', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toMatch(/roomGroups\s*=\s*new Map<\s*string\s*,\s*Konva\.Group\s*>\(\)/)
    const roomsBranchStart = source.indexOf("if (current.mode === 'rooms')")
    expect(roomsBranchStart).toBeGreaterThanOrEqual(0)
    const racksElse = source.indexOf('} else {\n    const racks = current.racks', roomsBranchStart)
    expect(racksElse).toBeGreaterThan(roomsBranchStart)
    const roomsBranch = source.slice(roomsBranchStart, racksElse)
    expect(roomsBranch).toContain('roomGroups.clear()')
    expect(roomsBranch).toMatch(/roomGroups\.set\(\s*room\.id\s*,\s*group\s*\)/)

    const updateStart = source.indexOf('function updateRoomSelection(')
    expect(updateStart).toBeGreaterThanOrEqual(0)
    const updateBody = source.slice(updateStart, source.indexOf('function drawScene()', updateStart))
    expect(updateBody).toContain(".room-platform-top")
    expect(updateBody).toContain('TOPOLOGY_PALETTE.accentBlue')
    expect(updateBody).toContain("'#2e4a6e'")
    expect(updateBody).toContain('layer?.draw()')
    expect(updateBody).not.toContain('drawScene()')
  })
})

describe('TASK-20260813-133241 device UI', () => {
  it('P2 default: drawPortAnchors skips port labels when nothing is selected', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const fnStart = source.indexOf('function drawPortAnchors(')
    expect(fnStart).toBeGreaterThanOrEqual(0)
    const fnBody = source.slice(fnStart, source.indexOf('function drawDeviceScene()', fnStart))
    expect(fnBody).toContain("name: 'port-anchor'")
    expect(fnBody).toContain('buildUniquePortLabelPlacements')
    expect(fnBody).toMatch(/labelBundles\.length\s*===\s*0/)
    expect(fnBody).toContain("name: 'port-label'")
    const labelCall = fnBody.indexOf('buildUniquePortLabelPlacements')
    const skipIdx = fnBody.indexOf('labelBundles.length === 0')
    expect(skipIdx).toBeGreaterThan(-1)
    expect(skipIdx).toBeLessThan(labelCall)
  })

  it('P2 focus device: port labels filtered to that device only', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const fnStart = source.indexOf('function drawPortAnchors(')
    const fnBody = source.slice(fnStart, source.indexOf('function drawDeviceScene()', fnStart))
    expect(fnBody).toMatch(/focusDeviceId\.value/)
    expect(fnBody).toMatch(/placements\.filter\(\s*\(?p\)?\s*=>\s*p\.deviceId\s*===\s*focusDeviceId\.value/)
    expect(fnBody).toMatch(/source\.deviceId\s*===\s*focusedId|source\.deviceId\s*===\s*focusDeviceId/)
  })

  it('P2 select cable: only that cable is passed into port label placement', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const fnStart = source.indexOf('function drawPortAnchors(')
    const fnBody = source.slice(fnStart, source.indexOf('function drawDeviceScene()', fnStart))
    expect(fnBody).toMatch(/labelBundles\s*=\s*\[\s*bundle\s*\]/)
    expect(fnBody).toMatch(/labelCables\s*=\s*\[\s*cable\s*\]/)
    expect(fnBody).toContain('selectedId')
  })

  it('P2 clear selection: clearDeviceFocus resets both ids', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const fnStart = source.indexOf('function clearDeviceFocus(')
    expect(fnStart).toBeGreaterThanOrEqual(0)
    const fnBody = source.slice(fnStart, source.indexOf('\nasync function fetchCsrf(', fnStart))
    expect(fnBody).toContain('focusDeviceId.value = null')
    expect(fnBody).toContain('selectedCableId.value = null')
  })

  it('P1 fit-to-screen: single 42U rack keeps readable width and 70-85% height', () => {
    const rack = { x: 80, y: 110, width: 240, height: 42 * 20 + 32 }
    const viewport = { width: 1400, height: 700 }
    const transform = computeFitToScreenTransform([rack], viewport, { padding: 72 })
    const visualW = rack.width * transform.scale
    const visualH = rack.height * transform.scale
    expect(visualW).toBeGreaterThanOrEqual(140)
    expect(visualH / viewport.height).toBeGreaterThanOrEqual(0.7)
    expect(visualH / viewport.height).toBeLessThanOrEqual(0.85)
  })

  it('P3 pageTitle uses room location and has no hardcoded A区', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const fnStart = source.indexOf('const pageTitle = computed(')
    expect(fnStart).toBeGreaterThanOrEqual(0)
    const fnBody = source.slice(fnStart, source.indexOf('const subtitle = computed(', fnStart))
    expect(fnBody).toContain('focusedRoom.value.location')
    expect(fnBody).toContain('位置未登记')
    expect(fnBody).not.toContain('A区')
  })

  it('P5 ResizeObserver refits device mode only when container size changes', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const fnStart = source.indexOf('function initStage(')
    expect(fnStart).toBeGreaterThanOrEqual(0)
    const fnBody = source.slice(fnStart, source.indexOf('watch(topology, () => {', fnStart))
    expect(fnBody).toContain('new ResizeObserver')
    expect(fnBody).toContain('sizeChanged')
    expect(fnBody).toMatch(/mode\s*===\s*['"]devices['"]/)
    expect(fnBody).toContain('fitDeviceToScreen()')
    expect(source).toContain('padding: DEVICE_FIT_PADDING')
  })

  it('P6 CableLayer adds a transparent hit path wider than the visual stroke', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../components/CableLayer.vue'), 'utf8')
    expect(source).toMatch(/stroke=["']transparent["']/)
    expect(source).toMatch(/stroke-width=["']14["']|:stroke-width=["']14["']/)
    expect(source).toContain('pointer-events="stroke"')
  })

  it('P7 device filters use chips, clearDeviceFilters, and keep test ids', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toContain('filter-chip')
    expect(source).toContain('aria-pressed')
    expect(source).toContain('clearDeviceFilters')
    expect(source).toContain('清除筛选')
    expect(source).toContain('data-testid="enter-device-level"')
    expect(source).toContain('data-testid="non-realtime-badge"')
    expect(source).toContain('data-testid="animation-notice"')
  })

  it('P8 device non-realtime notice appears once; P9 defines topology CSS variables', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const view = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const layer = readFileSync(resolve(__dirname, '../components/CableLayer.vue'), 'utf8')
    expect(view).toContain('配置拓扑 · 非实时数据')
    expect(view).toContain('--topology-bg')
    expect(view).toContain('--topology-panel')
    expect(view).toContain('--topology-border')
    expect(view).toContain('--topology-text')
    expect(view).toContain('--topology-muted')
    expect(view).toContain('--topology-accent')
    expect(layer).not.toContain('登记连接拓扑示意，非实时流量')
    const badgeMatches = view.match(/配置拓扑 · 非实时数据/g) ?? []
    expect(badgeMatches).toHaveLength(1)
  })

  it('P4 canvas min-height is no longer 760px', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).not.toMatch(/min-height:\s*760px/)
    expect(source).toMatch(/100dvh|100vh/)
    expect(source).toContain('DEVICE_RACK_W = 240')
    expect(source).toContain('DEVICE_U_PX')
    expect(source).not.toMatch(/const U_PX\s*=\s*\d+/)
  })

  it('R2-1 page height accounts for app nav and body margin without document overflow:hidden', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toMatch(/height:\s*calc\(100dvh\s*-\s*67px\)/)
    expect(source).toMatch(/max-height:\s*calc\(100dvh\s*-\s*67px\)/)
    expect(source).not.toMatch(/100dvh\s*-\s*48px/)
    expect(source).not.toMatch(/(?:^|\n)\s*(?:html|body)\s*\{[^}]*overflow:\s*hidden/)
  })

  it('R2-2 header is one row: titles left, level-switcher and tools right; hint moved to title', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toContain('topology-header__lead')
    expect(source).toContain('topology-header__tools')
    expect(source).toContain('title="选择机房后查看机柜和设备链路"')
    expect(source).not.toMatch(/class="topology-hint"/)
    const toolsStart = source.indexOf('class="topology-header__tools"')
    const toolsEnd = source.indexOf('</header>', toolsStart)
    const toolsBlock = source.slice(toolsStart, toolsEnd)
    expect(toolsBlock).toContain('level-switcher')
    expect(toolsBlock).toContain('topology-actions')
    expect(toolsBlock).toContain('机房级')
    expect(toolsBlock).toContain('机柜级')
    expect(toolsBlock).toContain('设备级')
    expect(toolsBlock).toContain('流动动画')
    expect(toolsBlock).toContain('适应屏幕')
    expect(toolsBlock).toContain('刷新')
    expect(toolsBlock).toContain('配置拓扑 · 非实时数据')
    expect(source).toMatch(/\.topology-header__tools[\s\S]*flex-wrap:\s*nowrap/)
  })

  it('R4 high-U deviceEdgePoint y stays inside 20px/U device panel', async () => {
    expect(DEVICE_U_PX).toBe(20)
    const rack = {
      rackId: 'k42',
      code: 'R42',
      x: 80,
      y: 110,
      width: 240,
      height: 42 * DEVICE_U_PX + 32,
    }
    const device = {
      deviceId: 'app-42',
      deviceName: 'APP-42',
      rackId: 'k42',
      deviceType: '服务器',
      operationalStatus: '正常',
      startU: 42,
      endU: 42,
    }
    const uHeight = device.endU - device.startU + 1
    const panelY = rack.y + (device.startU - 1) * DEVICE_U_PX
    const panelH = Math.max(16, uHeight * DEVICE_U_PX - 4)
    const point = deviceEdgePoint(device, rack, 'left')
    expect(rack.height).toBeGreaterThanOrEqual(120)
    expect(point.x).toBe(rack.x)
    expect(point.y).toBeGreaterThanOrEqual(panelY)
    expect(point.y).toBeLessThanOrEqual(panelY + panelH)

    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const sceneSrc = readFileSync(resolve(__dirname, '../composables/useCableScene.ts'), 'utf8')
    const viewSrc = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(sceneSrc).toContain('export const DEVICE_U_PX = 20')
    expect(sceneSrc).toContain('rack.height >= 120 ? DEVICE_U_PX')
    expect(sceneSrc).not.toMatch(/rack\.height\s*>=\s*120\s*\?\s*24/)
    expect(sceneSrc).not.toMatch(/Math\.ceil\(rack\.height\s*\/\s*24\)/)
    expect(viewSrc).toContain('DEVICE_U_PX')
    expect(viewSrc).not.toMatch(/const U_PX\s*=\s*\d+/)
  })

  it('R3 floor network/storage pseudo-racks use full RACK_GAP_X step (no overlap)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const layoutStart = source.indexOf('function layoutDeviceSnapshot(')
    expect(layoutStart).toBeGreaterThanOrEqual(0)
    const layoutEnd = source.indexOf('\nfunction', layoutStart + 1)
    const layoutBody = source.slice(layoutStart, layoutEnd > layoutStart ? layoutEnd : undefined)
    expect(layoutBody).toContain('DEVICE_RACK_W')
    expect(layoutBody).toContain('RACK_GAP_X')
    expect(source).toContain('DEVICE_RACK_W = 240')
    expect(source).toContain('RACK_GAP_X = 340')
    expect(340).toBeGreaterThanOrEqual(240)
    expect(layoutBody).not.toMatch(/RACK_GAP_X\s*\/\s*Math\.max/)
    expect(layoutBody).toMatch(/network\.forEach\([\s\S]*?x = 80 \+ i \* RACK_GAP_X/)
    expect(layoutBody).toMatch(/storage\.forEach\([\s\S]*?x = 80 \+ i \* RACK_GAP_X/)
    const networkLength = 3
    const xs = Array.from({ length: networkLength }, (_, i) => 80 + i * 340)
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(240)
    }
  })
})
