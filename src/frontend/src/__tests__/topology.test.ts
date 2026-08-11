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
  cableTypeSceneColor,
  deviceEdgePoint,
  parseCableSnapshot,
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
    x() {
      return 0
    }
    y() {
      return 0
    }
    id() {
      return ''
    }
    destroy() {}
    draw() {}
    destroyChildren() {}
    width() {
      return 0
    }
    height() {
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
    expect(unrelated?.opacity).toBe(0.2)
    expect(unrelated?.animated).toBe(false)
  })

  it('builds legend with CableType colors and Purpose dash styles', () => {
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
      ],
    })!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    expect(scene.legend).toHaveLength(3)
    const copper = scene.legend.find((i) => i.cableType === '铜缆' && i.purpose === '上联')
    const fiber = scene.legend.find((i) => i.cableType === '光纤' && i.purpose === '上联')
    const dac = scene.legend.find((i) => i.cableType === 'DAC' && i.purpose === '正常')
    expect(copper?.color).toBe(cableTypeSceneColor('铜缆'))
    expect(fiber?.color).toBe(cableTypeSceneColor('光纤'))
    expect(dac?.color).toBe(cableTypeSceneColor('DAC'))
    expect(copper?.color).not.toBe(fiber?.color)
    expect(fiber?.dashArray).toBe('2,4')
    expect(dac?.dashArray).toBe('none')
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

})
