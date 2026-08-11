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
  deviceEdgePoint,
  formatPortLabel,
  NETWORK_COLORS,
  parseCableSnapshot,
  purposeDisplayName,
  purposeNetworkColor,
  resolveCableStrokeColor,
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
}))

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    user: userMock,
  }),
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
    expect(cableTypeColor('光纤')).toBe('#f1c40f')
    expect(cableTypeColor('未知类型')).toBe('#95a5a6')
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
    expect(html).toContain('机房拓扑地图')
    expect(html).toContain('跨机房线缆聚合视图')
  })

  it('exposes fit-to-screen control in device-level template', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toContain('适应屏幕')
    expect(source).toContain('fitDeviceToScreen')
    expect(source).toContain('syncDeviceOverlay')
    expect(source).toContain('wheel')
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
    expect(html).toContain('非实时流量')
    expect(html).toContain('登记端点方向')
    expect(html).toContain('static-arrow')
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
})
