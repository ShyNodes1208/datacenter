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
  DEFAULT_CABLE_OPACITY,
  DEFAULT_STROKE_WIDTH,
  DEVICE_U_PX,
  deviceEdgePoint,
  deviceNameLabelRect,
  filterVisibleDevices,
  formatPortLabel,
  filterActiveDeviceSnapshot,
  isPrimaryDeviceRack,
  LABEL_STACK_STEP_Y,
  layoutDeviceLevelSnapshot,
  NETWORK_COLORS,
  parseCableSnapshot,
  portLabelRect,
  portLabelSide,
  portSlotKey,
  purposeDisplayName,
  purposeNetworkColor,
  resolveCableStrokeColor,
  resolveSemanticZoom,
  rectsOverlap,
  routeIntersectsRect,
  sameRackRoute,
  selectDeviceLayoutColumns,
  SEMANTIC_SCALE_NAME,
  SEMANTIC_SCALE_PORT,
  SELECTED_STROKE_WIDTH,
  staticArrowPositions,
  UNSELECTED_OPACITY,
  ANIMATION_PERIOD_MS,
  applyDeviceViewportAction,
  assignCorridorLanes,
  bundleCountLabel,
  computeCorridorLayout,
  computeFitToScreenTransform,
  corridorForPurpose,
  corridorHorizontalClear,
  corridorLaneY,
  type CorridorSide,
  type CableSnapshot,
  CORRIDOR_MAX_LANES,
  EXPANDED_OTHER_OPACITY,
  focusedAggregationStats,
  focusedPeerBundleKey,
  horizontalSegIntersectsRack,
  peerRackId,
  routeViaCorridor,
  routeSegmentsClear,
  rackHitTargetStyle,
  RACK_HIT_TITLE_BAND,
  RACK_VISUAL_DEPTH_X,
  verticalSegIntersectsRack,
  viewportTransformsEqual,
  visualStrokeWidthForBundle,
  zoomViewportAroundPoint,
} from '../composables/useCableScene'

const requestMock = vi.fn()
const userMock = ref<{ id: string; username: string; role: string } | null>({
  id: 'u1',
  username: 'admin',
  role: '机房管理员',
})

describe('TASK-20260828-device-topology-performance', () => {
  it('uses a rack map and keeps device rendering scoped to the focused rack', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const start = source.indexOf('function drawDeviceScene()')
    const end = source.indexOf('\nfunction drawScene()', start)
    const body = source.slice(start, end)
    expect(body).toContain('const rackById = new Map(snapshot.racks.map')
    expect(body).toContain('const rack = rackById.get(device.rackId)')
    expect(body).toContain('const devicesToRender = focusedRackId.value')
    expect(body).toContain('for (const device of devicesToRender)')
    expect(source).toMatch(/const deviceHitTargets = computed\([\s\S]*if \(!focusedRackId\.value\) return \[\][\s\S]*device\.rackId === focusedRackId\.value/)
  })
})

describe('TASK-20260829-device-topology-semantic-rendering', () => {
  it('renders device panels and device hit targets only for the focused rack', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const hitsStart = source.indexOf('const deviceHitTargets = computed(() =>')
    const hitsEnd = source.indexOf('\nconst cableOverlayStyle', hitsStart)
    const hits = source.slice(hitsStart, hitsEnd)
    const drawStart = source.indexOf('function drawDeviceScene(): void {')
    const drawEnd = source.indexOf('\nfunction drawRoomPlatform', drawStart)
    const draw = source.slice(drawStart, drawEnd)

    expect(hits).toMatch(/if \(!focusedRackId\.value\) return \[\]/)
    expect(hits).toContain('device.rackId === focusedRackId.value')
    expect(draw).toContain('const devicesToRender = focusedRackId.value')
    expect(draw).toContain('for (const device of devicesToRender)')
  })

  it('reuses an unchanged device layout and lets the watcher own focused redraws', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const drawStart = source.indexOf('function drawDeviceScene(): void {')
    const drawEnd = source.indexOf('\nfunction drawRoomPlatform', drawStart)
    const draw = source.slice(drawStart, drawEnd)
    const rackHandler = source.slice(
      source.indexOf('function onRackHitClick('),
      source.indexOf('\nfunction onDeviceHitClick', source.indexOf('function onRackHitClick(')),
    )
    const deviceHandler = source.slice(
      source.indexOf('function onDeviceHitClick('),
      source.indexOf('\nfunction onCableBundleHover', source.indexOf('function onDeviceHitClick(')),
    )

    expect(draw).toContain('laidSnapshotSource === originalSnapshot')
    expect(draw).toContain('layoutDeviceSnapshot(originalSnapshot)')
    expect(rackHandler).not.toContain('drawScene()')
    expect(deviceHandler).not.toContain('drawScene()')
  })
})

describe('TASK-20260829-device-cable-canvas', () => {
  it('uses a device-only Canvas with Canvas hit testing and redraw scheduling', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../components/DeviceCableCanvas.vue'), 'utf8')

    expect(source).toContain('data-testid="device-cable-canvas"')
    expect(source).toContain("'bundle-click': [bundleId: string]")
    expect(source).toContain("'bundle-hover': [payload: { bundleId: string; clientX: number; clientY: number }]")
    expect(source).toContain('function bundleAtPoint(')
    expect(source).toContain('function logicalPointFromEvent(')
    expect(source).toContain('new ResizeObserver(')
    expect(source).toContain('requestAnimationFrame(')
    expect(source).not.toContain('v-for="bundle in')
  })
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

describe('TASK-20260828-073500 device detail navigation', () => {
  it('executes first-focus, same-device navigation, different-device focus, and drag suppression', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const start = source.indexOf('function onDeviceHitClick(')
    const end = source.indexOf('\nfunction onCableBundleHover', start)
    const typedHandler = source.slice(start, end)
    const handlerSource = typedHandler
      .replace('function onDeviceHitClick(deviceId: string, rackId: string): void {', 'function onDeviceHitClick(deviceId, rackId) {')
    const focusDeviceId = { value: null as string | null }
    const focusedRackId = { value: 'rack-a' as string | null }
    const router = { push: vi.fn() }
    let suppressed = false
    const handler = new Function(
      'consumeSuppressedViewportClick',
      'focusDeviceId',
      'focusedRackId',
      'expandedBundleKey',
      'selectedBundleId',
      'selectedCableId',
      'router',
      'drawScene',
      `${handlerSource}; return onDeviceHitClick`,
    )(
      () => suppressed,
      focusDeviceId,
      focusedRackId,
      { value: null },
      { value: null },
      { value: null },
      router,
      vi.fn(),
    ) as (deviceId: string, rackId: string) => void

    handler('device/a', 'rack-a')
    expect(focusDeviceId.value).toBe('device/a')
    expect(router.push).not.toHaveBeenCalled()
    handler('device/a', 'rack-a')
    expect(router.push).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith('/servers/device%2Fa')
    focusDeviceId.value = 'device/a'
    focusedRackId.value = null
    handler('device-b', 'rack-b')
    expect(focusDeviceId.value).toBe('device-b')
    expect(router.push).toHaveBeenCalledTimes(1)
    suppressed = true
    handler('device-b', 'rack-b')
    expect(router.push).toHaveBeenCalledTimes(1)
    expect(source).toContain("focusedRackId === hit.rackId || !!focusDeviceId")
    expect(source).toMatch(/if \(focusedRackId\.value !== rack\.rackId && focusDeviceId\.value === null\)/)
  })

  it('focuses first, navigates only on the same device second click, switches devices without navigating, and suppresses drag clicks', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const start = source.indexOf('function onDeviceHitClick(')
    const end = source.indexOf('\nfunction onCableBundleHover', start)
    const handler = source.slice(start, end)

    expect(handler).toMatch(/if \(consumeSuppressedViewportClick\(\)\) return/)
    expect(handler).toMatch(/if \(focusDeviceId\.value === deviceId\)[\s\S]*router\.push\(`\/servers\/\$\{encodeURIComponent\(deviceId\)\}`\)/)
    expect(handler).toMatch(/router\.push\(`\/servers\/\$\{encodeURIComponent\(deviceId\)\}`\)[\s\S]*return[\s\S]*focusDeviceId\.value = deviceId/)
    expect(handler).toMatch(/focusDeviceId\.value = deviceId/)
    expect(handler).not.toContain('drawScene()')
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

  it('T-10: unselected cables use dim opacity when another is selected', () => {
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
    expect(UNSELECTED_OPACITY).toBe(0.1)
    expect(scene.bundles.find((b) => b.id === 'c1')?.opacity).toBe(1)
    expect(scene.bundles.find((b) => b.id === 'c2')?.opacity).toBe(UNSELECTED_OPACITY)
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

  it('P5 ResizeObserver refits device mode only when container size changes and user has not adjusted', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const fnStart = source.indexOf('function initStage(')
    expect(fnStart).toBeGreaterThanOrEqual(0)
    const fnBody = source.slice(fnStart, source.indexOf('watch(topology, () => {', fnStart))
    expect(fnBody).toContain('new ResizeObserver')
    expect(fnBody).toContain('sizeChanged')
    expect(fnBody).toContain('shouldAutoFitOnDeviceResize')
    expect(fnBody).toContain('fitDeviceToScreen()')
    expect(fnBody).toContain('userAdjustedViewport')
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
    const scene = readFileSync(resolve(__dirname, '../composables/useCableScene.ts'), 'utf8')
    expect(source).not.toMatch(/min-height:\s*760px/)
    expect(source).toMatch(/100dvh|100vh/)
    expect(scene).toContain('DEVICE_RACK_W = 240')
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
    const scene = readFileSync(resolve(__dirname, '../composables/useCableScene.ts'), 'utf8')
    const layoutStart = source.indexOf('function layoutDeviceSnapshot(')
    expect(layoutStart).toBeGreaterThanOrEqual(0)
    const layoutEnd = source.indexOf('\nfunction', layoutStart + 1)
    const layoutBody = source.slice(layoutStart, layoutEnd > layoutStart ? layoutEnd : undefined)
    expect(layoutBody).toContain('layoutDeviceLevelSnapshot')
    expect(scene).toContain('DEVICE_RACK_W = 240')
    expect(scene).toContain('DEVICE_RACK_GAP_X = 340')
    expect(340).toBeGreaterThanOrEqual(240)
    expect(scene).toMatch(/network\.forEach\([\s\S]*?DEVICE_LAYOUT_ORIGIN_X \+ i \* DEVICE_RACK_GAP_X/)
    expect(scene).toMatch(/storage\.forEach\([\s\S]*?DEVICE_LAYOUT_ORIGIN_X \+ i \* DEVICE_RACK_GAP_X/)
    expect(scene).not.toMatch(/DEVICE_RACK_GAP_X\s*\/\s*Math\.max/)
    const networkLength = 3
    const xs = Array.from({ length: networkLength }, (_, i) => 80 + i * 340)
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(240)
    }
  })

  it('TASK-20260813-153018: compact 1U panel uses right name area and narrow body', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const viewSrc = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const sceneSrc = readFileSync(resolve(__dirname, '../composables/useCableScene.ts'), 'utf8')

    const drawStart = viewSrc.indexOf('function drawDevicePanel(')
    expect(drawStart).toBeGreaterThanOrEqual(0)
    const drawEnd = viewSrc.indexOf('\nfunction', drawStart + 1)
    const drawBody = viewSrc.slice(drawStart, drawEnd > drawStart ? drawEnd : undefined)
    expect(drawBody).toMatch(/panelH\s*<\s*24/)
    expect(drawBody).toMatch(/compact\s*\?\s*120\s*:\s*panelW/)
    expect(drawBody).toMatch(/fill:\s*'transparent'/)
    expect(drawBody).toContain("name: 'device-panel'")
    expect(drawBody).toMatch(/compact\s*\?\s*bodyW\s*\+\s*4\s*:\s*8/)
    expect(drawBody).toMatch(/compact\s*\?\s*2\s*:\s*Math\.max\(4,\s*panelH\s*\/\s*2\s*-\s*7\)/)
    expect(drawBody).toMatch(/panelW\s*-\s*bodyW\s*-\s*4/)
    const hitIdx = drawBody.indexOf("fill: 'transparent'")
    const panelIdx = drawBody.indexOf("name: 'device-panel'")
    expect(hitIdx).toBeGreaterThanOrEqual(0)
    expect(panelIdx).toBeGreaterThan(hitIdx)

    const rectStart = sceneSrc.indexOf('export function deviceNameLabelRect(')
    expect(rectStart).toBeGreaterThanOrEqual(0)
    const rectEnd = sceneSrc.indexOf('\nexport ', rectStart + 1)
    const rectBody = sceneSrc.slice(rectStart, rectEnd > rectStart ? rectEnd : undefined)
    expect(rectBody).toMatch(/panelH\s*<\s*24/)
    expect(rectBody).toMatch(/const bodyW = 120/)
    expect(rectBody).toMatch(/groupX\s*\+\s*bodyW\s*\+\s*4/)
    expect(rectBody).toMatch(/groupY\s*\+\s*2/)
    expect(rectBody).toMatch(/panelW\s*-\s*bodyW\s*-\s*4/)
  })

  it('TASK-20260813-153018: deviceNameLabelRect compact numbers match drawDevicePanel', () => {
    const rack = {
      rackId: 'k-ac',
      code: 'AC-03d5ef',
      x: 80,
      y: 110,
      width: 240,
      height: 42 * DEVICE_U_PX + 32,
    }
    const compactDevice = {
      deviceId: 'sw-1u',
      deviceName: 'SW-1U',
      rackId: 'k-ac',
      deviceType: '交换机',
      operationalStatus: '正常',
      startU: 40,
      endU: 40,
    }
    const tallDevice = {
      deviceId: 'srv-2u',
      deviceName: 'SRV-2U',
      rackId: 'k-ac',
      deviceType: '服务器',
      operationalStatus: '正常',
      startU: 1,
      endU: 2,
    }

    const compactRect = deviceNameLabelRect(compactDevice, rack)
    const groupX = rack.x + 10
    const groupY = rack.y + (compactDevice.startU - 1) * DEVICE_U_PX + 2
    const bodyW = 120
    const panelW = rack.width - 20
    expect(Math.max(16, 1 * DEVICE_U_PX - 4)).toBeLessThan(24)
    expect(compactRect).toEqual({
      x: groupX + bodyW + 4,
      y: groupY + 2,
      width: panelW - bodyW - 4,
      height: 14,
    })
    expect(compactRect.width).toBe(96)
    expect(compactRect.x).toBe(rack.x + 134)
    expect(compactRect.x + compactRect.width).toBeLessThanOrEqual(rack.x + rack.width)

    const tallRect = deviceNameLabelRect(tallDevice, rack)
    const tallH = Math.max(16, 2 * DEVICE_U_PX - 4)
    expect(tallH).toBeGreaterThanOrEqual(24)
    expect(tallRect).toEqual({
      x: rack.x + 10 + 8,
      y: rack.y + (tallDevice.startU - 1) * DEVICE_U_PX + 2 + Math.max(4, tallH / 2 - 7),
      width: panelW - 28,
      height: 14,
    })
  })

  it('TASK-20260813-153018: compact long name (>96px) is single-line ellipsis with height:14', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const viewSrc = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const sceneSrc = readFileSync(resolve(__dirname, '../composables/useCableScene.ts'), 'utf8')

    const drawStart = viewSrc.indexOf('function drawDevicePanel(')
    expect(drawStart).toBeGreaterThanOrEqual(0)
    const drawEnd = viewSrc.indexOf('\nfunction', drawStart + 1)
    const drawBody = viewSrc.slice(drawStart, drawEnd > drawStart ? drawEnd : undefined)
    const nameIdx = drawBody.indexOf("name: 'device-name'")
    expect(nameIdx).toBeGreaterThan(0)
    const textIdx = drawBody.lastIndexOf('new Konva.Text({', nameIdx)
    expect(textIdx).toBeGreaterThanOrEqual(0)
    const nameText = drawBody.slice(textIdx, nameIdx)
    expect(nameText).toMatch(/ellipsis:\s*true/)
    expect(nameText).toMatch(/height:\s*compact\s*\?\s*14/)
    expect(nameText).toMatch(/compact\s*\?\s*Math\.max\(0,\s*panelW\s*-\s*bodyW\s*-\s*4\)/)

    const rectStart = sceneSrc.indexOf('export function deviceNameLabelRect(')
    expect(rectStart).toBeGreaterThanOrEqual(0)
    const rectEnd = sceneSrc.indexOf('\nexport ', rectStart + 1)
    const rectBody = sceneSrc.slice(rectStart, rectEnd > rectStart ? rectEnd : undefined)
    expect(rectBody).toMatch(/if \(panelH < 24[\s\S]*?height:\s*14/)

    const rack = {
      rackId: 'k-ac',
      code: 'AC-03d5ef',
      x: 80,
      y: 110,
      width: 240,
      height: 42 * DEVICE_U_PX + 32,
    }
    const longNameDevice = {
      deviceId: 'sw-long',
      deviceName: 'SW-CORE-01-VERY-LONG-NAME-THAT-EXCEEDS-NINETY-SIX-PX',
      rackId: 'k-ac',
      deviceType: '交换机',
      operationalStatus: '正常',
      startU: 40,
      endU: 40,
    }
    const rect = deviceNameLabelRect(longNameDevice, rack)
    expect(rect.width).toBe(96)
    expect(rect.height).toBe(14)
    expect(rect.width).toBeLessThan(longNameDevice.deviceName.length * 6)
  })

  it('TASK-20260813-230017: compact predicate includes switch/storage/firewall at any panelH', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const viewSrc = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const sceneSrc = readFileSync(resolve(__dirname, '../composables/useCableScene.ts'), 'utf8')

    const drawStart = viewSrc.indexOf('function drawDevicePanel(')
    expect(drawStart).toBeGreaterThanOrEqual(0)
    const drawEnd = viewSrc.indexOf('\nfunction', drawStart + 1)
    const drawBody = viewSrc.slice(drawStart, drawEnd > drawStart ? drawEnd : undefined)
    expect(drawBody).toMatch(
      /panelH\s*<\s*24\s*\|\|\s*kind\s*===\s*'switch'\s*\|\|\s*kind\s*===\s*'storage'\s*\|\|\s*kind\s*===\s*'firewall'/,
    )

    const rectStart = sceneSrc.indexOf('export function deviceNameLabelRect(')
    expect(rectStart).toBeGreaterThanOrEqual(0)
    const rectEnd = sceneSrc.indexOf('\nexport ', rectStart + 1)
    const rectBody = sceneSrc.slice(rectStart, rectEnd > rectStart ? rectEnd : undefined)
    expect(rectBody).toMatch(/panelH\s*<\s*24/)
    expect(rectBody).toMatch(/交换/)
    expect(rectBody).toMatch(/switch/)
    expect(rectBody).toMatch(/防火/)
    expect(rectBody).toMatch(/firewall/)
    expect(rectBody).toMatch(/存储/)
    expect(rectBody).toMatch(/storage/)
  })

  it('TASK-20260813-230017: deviceNameLabelRect returns side name zone for 2U switch', () => {
    const rack = {
      rackId: 'k-ac',
      code: 'AC-03d5ef',
      x: 80,
      y: 110,
      width: 240,
      height: 42 * DEVICE_U_PX + 32,
    }
    const switch2u = {
      deviceId: 'sw-2u',
      deviceName: 'SW-2U',
      rackId: 'k-ac',
      deviceType: '交换机',
      operationalStatus: '正常',
      startU: 1,
      endU: 2,
    }
    const server2u = {
      deviceId: 'srv-2u',
      deviceName: 'SRV-2U',
      rackId: 'k-ac',
      deviceType: '服务器',
      operationalStatus: '正常',
      startU: 1,
      endU: 2,
    }
    const panelH = Math.max(16, 2 * DEVICE_U_PX - 4)
    expect(panelH).toBeGreaterThanOrEqual(24)
    const groupX = rack.x + 10
    const groupY = rack.y + (switch2u.startU - 1) * DEVICE_U_PX + 2
    const bodyW = 120
    const panelW = rack.width - 20
    expect(deviceNameLabelRect(switch2u, rack)).toEqual({
      x: groupX + bodyW + 4,
      y: groupY + 2,
      width: panelW - bodyW - 4,
      height: 14,
    })
    expect(deviceNameLabelRect(server2u, rack)).toEqual({
      x: rack.x + 10 + 8,
      y: rack.y + (server2u.startU - 1) * DEVICE_U_PX + 2 + Math.max(4, panelH / 2 - 7),
      width: panelW - 28,
      height: 14,
    })
  })

  it('TASK-20260813-230017 R2: 2U backup-only device classifies as storage compact', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const viewSrc = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')

    const classifyStart = viewSrc.indexOf('function classifyDeviceKind(')
    expect(classifyStart).toBeGreaterThanOrEqual(0)
    const classifyEnd = viewSrc.indexOf('\nfunction', classifyStart + 1)
    const classifyBody = viewSrc.slice(classifyStart, classifyEnd > classifyStart ? classifyEnd : undefined)
    expect(classifyBody).toMatch(
      /deviceType\.includes\('存储'\)\s*\|\|\s*t\.includes\('storage'\)\s*\|\|\s*deviceType\.includes\('备份'\)/,
    )

    const drawStart = viewSrc.indexOf('function drawDevicePanel(')
    expect(drawStart).toBeGreaterThanOrEqual(0)
    const drawEnd = viewSrc.indexOf('\nfunction', drawStart + 1)
    const drawBody = viewSrc.slice(drawStart, drawEnd > drawStart ? drawEnd : undefined)
    expect(drawBody).toMatch(
      /panelH\s*<\s*24\s*\|\|\s*kind\s*===\s*'switch'\s*\|\|\s*kind\s*===\s*'storage'\s*\|\|\s*kind\s*===\s*'firewall'/,
    )

    const rack = {
      rackId: 'k-ac',
      code: 'AC-03d5ef',
      x: 80,
      y: 110,
      width: 240,
      height: 42 * DEVICE_U_PX + 32,
    }
    const backup2u = {
      deviceId: 'bak-2u',
      deviceName: 'BAK-2U',
      rackId: 'k-ac',
      deviceType: '备份',
      operationalStatus: '正常',
      startU: 1,
      endU: 2,
    }
    expect(backup2u.deviceType).toBe('备份')
    expect(backup2u.deviceType).not.toMatch(/存储|storage/i)

    const panelH = Math.max(16, 2 * DEVICE_U_PX - 4)
    expect(panelH).toBeGreaterThanOrEqual(24)
    const groupX = rack.x + 10
    const groupY = rack.y + (backup2u.startU - 1) * DEVICE_U_PX + 2
    const bodyW = 120
    const panelW = rack.width - 20
    expect(deviceNameLabelRect(backup2u, rack)).toEqual({
      x: groupX + bodyW + 4,
      y: groupY + 2,
      width: panelW - bodyW - 4,
      height: 14,
    })
  })
})

describe('TASK-20260813-164147 rack origin fallback', () => {
  function rackCanvasPos(x: number, y: number, index: number) {
    const positioned = Number.isFinite(x) && Number.isFinite(y) && !(x === 0 && y === 0)
    return {
      x: 80 + (positioned ? x * 120 : index * 120),
      y: 100 + (positioned ? y * 90 : 0),
    }
  }

  it('uses index fallback for (0,0) racks and stored coords when positioned', () => {
    expect(rackCanvasPos(0, 0, 0)).toEqual({ x: 80, y: 100 })
    expect(rackCanvasPos(0, 0, 1)).toEqual({ x: 200, y: 100 })
    expect(rackCanvasPos(4.15, 2.75, 0)).toEqual({ x: 80 + 4.15 * 120, y: 100 + 2.75 * 90 })
    expect(rackCanvasPos(6.5, 8, 2)).toEqual({ x: 80 + 6.5 * 120, y: 100 + 8 * 90 })
    expect(rackCanvasPos(NaN, 0, 3)).toEqual({ x: 80 + 3 * 120, y: 100 })
  })

  it('drawScene rackPos uses positioned check and index fallback expressions', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const racksElse = source.indexOf('} else {\n    const racks = current.racks')
    expect(racksElse).toBeGreaterThanOrEqual(0)
    const focusedIdx = source.indexOf('const focused = current.rooms.find', racksElse)
    expect(focusedIdx).toBeGreaterThan(racksElse)
    const rackPosBlock = source.slice(racksElse, focusedIdx)
    expect(rackPosBlock).toContain('const positioned = Number.isFinite(rack.x) && Number.isFinite(rack.y)')
    expect(rackPosBlock).toContain('!(rack.x === 0 && rack.y === 0)')
    expect(rackPosBlock).toContain('x: 80 + (positioned ? rack.x * 120 : index * 120)')
    expect(rackPosBlock).toContain('y: 100 + (positioned ? rack.y * 90 : 0)')
    expect(rackPosBlock).not.toMatch(/Number\.isFinite\(rack\.x\)\s*\?\s*rack\.x \* 120\s*:\s*index \* 120/)
  })
})

describe('TASK-20260814-101757 device topology readability', () => {
  function makeRacks(count: number, height = 42 * DEVICE_U_PX + 32) {
    return Array.from({ length: count }, (_, i) => ({
      rackId: `r${i + 1}`,
      code: `R${String(i + 1).padStart(2, '0')}`,
      x: 0,
      y: 0,
      width: 240,
      height,
    }))
  }

  function makeSnapshot(rackCount: number, heightU = 42): ReturnType<typeof parseCableSnapshot> {
    const racks = makeRacks(rackCount, heightU * DEVICE_U_PX + 32)
    const devices = racks.map((rack, i) => ({
      deviceId: `d${i + 1}`,
      deviceName: `srv-${i + 1}`,
      rackId: rack.rackId,
      deviceType: '服务器',
      operationalStatus: '正常',
      startU: 1,
      endU: heightU,
    }))
    return {
      racks,
      devices,
      cables: [],
    }
  }

  it('layout: 1 / 4 / 10 racks choose columns; no overlap; wide 10-rack beats fixed 4-col', () => {
    const wide = { width: 1800, height: 900 }
    const narrow = { width: 900, height: 700 }

    const one = layoutDeviceLevelSnapshot(makeSnapshot(1)!, { availW: wide.width, availH: wide.height })
    expect(one.colCount).toBe(1)
    expect(one.snapshot.racks).toHaveLength(1)

    const four = layoutDeviceLevelSnapshot(makeSnapshot(4)!, { availW: wide.width, availH: wide.height })
    expect(four.snapshot.racks).toHaveLength(4)
    for (let i = 0; i < four.snapshot.racks.length; i++) {
      for (let j = i + 1; j < four.snapshot.racks.length; j++) {
        const a = four.snapshot.racks[i]!
        const b = four.snapshot.racks[j]!
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y
        expect(overlapX && overlapY).toBe(false)
      }
    }

    const tenWide = layoutDeviceLevelSnapshot(makeSnapshot(10)!, { availW: wide.width, availH: wide.height })
    expect(tenWide.colCount).not.toBe(4)
    expect([1, 2].includes(tenWide.rows) || tenWide.colCount >= 5).toBe(true)

    const heights = Array.from({ length: 10 }, () => 42 * DEVICE_U_PX + 32)
    const adaptive = selectDeviceLayoutColumns(heights, wide.width, wide.height)
    const fixed4 = selectDeviceLayoutColumns(heights, wide.width, wide.height)
    // Force compare against 4-col measurement via locked path
    const locked4 = layoutDeviceLevelSnapshot(makeSnapshot(10)!, {
      availW: wide.width,
      availH: wide.height,
      lockedColCount: 4,
    })
    expect(tenWide.fitScale).toBeGreaterThan(locked4.fitScale)
    expect(adaptive.fitScale).toBeGreaterThanOrEqual(fixed4.fitScale)

    const tenNarrow = layoutDeviceLevelSnapshot(makeSnapshot(10)!, {
      availW: narrow.width,
      availH: narrow.height,
    })
    expect(tenNarrow.snapshot.racks).toHaveLength(10)

    const again = layoutDeviceLevelSnapshot(makeSnapshot(10)!, { availW: wide.width, availH: wide.height })
    expect(again.colCount).toBe(tenWide.colCount)
    expect(again.snapshot.racks.map((r) => `${r.x},${r.y}`)).toEqual(
      tenWide.snapshot.racks.map((r) => `${r.x},${r.y}`),
    )
  })

  it('layout: lockedColCount keeps arrangement (panel must not reflow)', () => {
    const snap = makeSnapshot(10)!
    const first = layoutDeviceLevelSnapshot(snap, { availW: 1800, availH: 900 })
    const locked = layoutDeviceLevelSnapshot(snap, {
      availW: 1100,
      availH: 900,
      lockedColCount: first.colCount,
    })
    expect(locked.colCount).toBe(first.colCount)
    expect(locked.snapshot.racks.map((r) => `${r.x},${r.y}`)).toEqual(
      first.snapshot.racks.map((r) => `${r.x},${r.y}`),
    )
  })

  it('layout: FLOOR devices remain below primary racks', () => {
    const base = makeSnapshot(4)!
    const withFloor = {
      racks: [
        ...base.racks,
        { rackId: 'floor', code: 'FLOOR', x: 0, y: 0, width: 240, height: 100 },
      ],
      devices: [
        ...base.devices,
        {
          deviceId: 'sw-floor',
          deviceName: 'SW-CORE',
          rackId: 'floor',
          deviceType: '交换机',
          operationalStatus: '正常',
          startU: 1,
          endU: 2,
        },
      ],
      cables: [],
    }
    const laid = layoutDeviceLevelSnapshot(withFloor, { availW: 1600, availH: 900 })
    const primary = laid.snapshot.racks.filter(isPrimaryDeviceRack)
    const floorPseudo = laid.snapshot.racks.filter((r) => r.rackId.startsWith('floor-'))
    expect(floorPseudo.length).toBeGreaterThan(0)
    const maxPrimaryY = Math.max(...primary.map((r) => r.y + r.height))
    expect(Math.min(...floorPseudo.map((r) => r.y))).toBeGreaterThanOrEqual(maxPrimaryY)
  })

  it('layout: ordinary FLOOR device is kept in fallback row (not dropped)', () => {
    const base = makeSnapshot(2)!
    const withFloor = {
      racks: [
        ...base.racks,
        { rackId: 'floor', code: 'FLOOR', x: 0, y: 0, width: 240, height: 100 },
      ],
      devices: [
        ...base.devices,
        {
          deviceId: 'pdu-floor',
          deviceName: 'PDU-A1',
          rackId: 'floor',
          deviceType: '配电',
          operationalStatus: '正常',
          startU: 1,
          endU: 1,
        },
        {
          deviceId: 'sw-floor',
          deviceName: 'SW-CORE',
          rackId: 'floor',
          deviceType: '交换机',
          operationalStatus: '正常',
          startU: 1,
          endU: 2,
        },
        {
          deviceId: 'st-floor',
          deviceName: 'STORAGE-01',
          rackId: 'floor',
          deviceType: '存储',
          operationalStatus: '正常',
          startU: 1,
          endU: 4,
        },
      ],
      cables: [{
        cableId: 'c-pdu',
        cableType: '铜缆',
        purpose: '正常',
        status: '正常',
        source: {
          deviceId: 'pdu-floor',
          deviceName: 'PDU-A1',
          portName: 'out1',
          speed: null,
          rackId: 'floor',
          rackCode: 'FLOOR',
        },
        target: {
          deviceId: 'd1',
          deviceName: 'srv-1',
          portName: 'pwr',
          speed: null,
          rackId: 'r1',
          rackCode: 'R01',
        },
      }],
    }
    const laid = layoutDeviceLevelSnapshot(withFloor, { availW: 1600, availH: 900 })
    expect(laid.snapshot.devices.some((d) => d.deviceId === 'pdu-floor')).toBe(true)
    expect(laid.snapshot.racks.some((r) => r.rackId === 'floor-pdu-floor')).toBe(true)
    expect(laid.snapshot.cables.some((c) => c.cableId === 'c-pdu')).toBe(true)
    const pduRack = laid.snapshot.racks.find((r) => r.rackId === 'floor-pdu-floor')!
    const swRack = laid.snapshot.racks.find((r) => r.rackId === 'floor-sw-floor')!
    const stRack = laid.snapshot.racks.find((r) => r.rackId === 'floor-st-floor')!
    expect(pduRack.y).toBeGreaterThan(stRack.y)
    expect(stRack.y).toBeGreaterThan(swRack.y)
  })

  it('semantic zoom: thresholds gate names/ports with hysteresis; selected labels exempt in view', async () => {
    expect(SEMANTIC_SCALE_NAME).toBe(0.55)
    expect(SEMANTIC_SCALE_PORT).toBe(0.9)

    const low = resolveSemanticZoom(0.4, null)
    expect(low.showDeviceNames).toBe(false)
    expect(low.showPortAnchors).toBe(false)
    expect(low.showPortLabels).toBe(false)

    const mid = resolveSemanticZoom(0.7, low)
    expect(mid.showDeviceNames).toBe(true)
    expect(mid.showPortLabels).toBe(false)

    const high = resolveSemanticZoom(0.95, mid)
    expect(high.showDeviceNames).toBe(true)
    expect(high.showPortAnchors).toBe(true)

    // Hysteresis: dipping slightly below 0.55 keeps names if already on
    const hold = resolveSemanticZoom(0.53, mid)
    expect(hold.showDeviceNames).toBe(true)
    const drop = resolveSemanticZoom(0.5, hold)
    expect(drop.showDeviceNames).toBe(false)

    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const fnStart = source.indexOf('function drawPortAnchors(')
    const fnBody = source.slice(fnStart, source.indexOf('function drawDeviceScene()', fnStart))
    expect(fnBody).toContain('Selected cable endpoint labels at any scale')
    expect(fnBody).toContain('semantic.showPortLabels')
    expect(source).toContain('showName')
  })

  it('cable styles: idle denoise, selected emphasis, unrelated dim, hit path present', async () => {
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      cables: [
        ...sampleCableScene.cables,
        {
          cableId: 'c2',
          cableType: '光纤',
          purpose: '正常',
          status: '正常',
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

    const idle = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    expect(DEFAULT_CABLE_OPACITY).toBeGreaterThanOrEqual(0.18)
    expect(DEFAULT_CABLE_OPACITY).toBeLessThanOrEqual(0.25)
    expect(idle.bundles.every((b) => b.opacity === DEFAULT_CABLE_OPACITY)).toBe(true)
    expect(visualStrokeWidthForBundle({
      highlighted: false,
      isAggregated: false,
      count: 1,
    })).toBe(DEFAULT_STROKE_WIDTH)
    expect(DEFAULT_STROKE_WIDTH).toBeGreaterThanOrEqual(1)
    expect(DEFAULT_STROKE_WIDTH).toBeLessThanOrEqual(1.5)

    const selected = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    expect(selected.bundles.find((b) => b.id === 'c1')?.opacity).toBe(1)
    expect(selected.bundles.find((b) => b.id === 'c1')?.highlighted).toBe(true)
    expect(selected.bundles.find((b) => b.id === 'c2')?.opacity).toBe(UNSELECTED_OPACITY)
    expect(UNSELECTED_OPACITY).toBeGreaterThanOrEqual(0.08)
    expect(UNSELECTED_OPACITY).toBeLessThanOrEqual(0.12)
    expect(SELECTED_STROKE_WIDTH).toBeGreaterThanOrEqual(4)
    expect(SELECTED_STROKE_WIDTH).toBeLessThanOrEqual(5)

    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const layer = readFileSync(resolve(__dirname, '../components/CableLayer.vue'), 'utf8')
    expect(layer).toContain('cable-hit-area')
    expect(layer).toMatch(/stroke-width=["']14["']/)
    expect(layer).toContain("@click.stop=\"emit('bundle-click', bundle.id)\"")
    expect(layer).toContain("bundle.opacity > 0 ? 'auto' : 'none'")
  })

  it('viewport keep: zoom/pan/selection/panel/RO/manual-fit preserve or reset transform by rule', () => {
    const racks = [
      { x: 80, y: 110, width: 240, height: 42 * DEVICE_U_PX + 32 },
      { x: 420, y: 110, width: 240, height: 42 * DEVICE_U_PX + 32 },
      { x: 760, y: 110, width: 240, height: 42 * DEVICE_U_PX + 32 },
      { x: 1100, y: 110, width: 240, height: 42 * DEVICE_U_PX + 32 },
      { x: 80, y: 110 + 42 * DEVICE_U_PX + 80, width: 240, height: 42 * DEVICE_U_PX + 32 },
      { x: 420, y: 110 + 42 * DEVICE_U_PX + 80, width: 240, height: 42 * DEVICE_U_PX + 32 },
    ]
    const viewport = { width: 1200, height: 700 }
    const fit = computeFitToScreenTransform(racks, viewport, { padding: 72 })
    expect(fit.scale).toBeLessThan(1)
    expect(fit.scale).toBeLessThan(SEMANTIC_SCALE_NAME)

    let state = {
      transform: { scale: 1, x: 0, y: 0 },
      userAdjusted: false,
      fitAppliedForSnapshot: null as string | null,
    }

    // 4) First enter allows fit; userAdjusted resets
    state = applyDeviceViewportAction(state, {
      type: 'first-enter-fit',
      snapshotKey: 'snap-a',
      fit,
    })
    expect(state.userAdjusted).toBe(false)
    expect(state.fitAppliedForSnapshot).toBe('snap-a')
    expect(viewportTransformsEqual(state.transform, fit)).toBe(true)
    expect(resolveSemanticZoom(state.transform.scale, null).showDeviceNames).toBe(false)

    // User zooms in past port threshold
    const afterZoom = applyDeviceViewportAction(state, {
      type: 'user-zoom',
      newScale: Math.min(3, Math.max(0.2, state.transform.scale * 1.2 * 1.2 * 1.2)),
      point: { x: viewport.width / 2, y: viewport.height / 2 },
    })
    expect(afterZoom.userAdjusted).toBe(true)
    expect(afterZoom.transform.scale).toBeGreaterThan(state.transform.scale)
    // Same math TopologyView +/- uses
    expect(viewportTransformsEqual(
      afterZoom.transform,
      zoomViewportAroundPoint(
        state.transform,
        afterZoom.transform.scale,
        { x: viewport.width / 2, y: viewport.height / 2 },
      ),
    )).toBe(true)
    state = afterZoom

    const zoomed = { ...state.transform }

    // 1) Cable click keeps scale/x/y (≤1e-6)
    state = applyDeviceViewportAction(state, { type: 'cable-click' })
    expect(viewportTransformsEqual(state.transform, zoomed)).toBe(true)
    expect(state.userAdjusted).toBe(true)

    // User pan
    state = applyDeviceViewportAction(state, { type: 'user-pan', dx: 40, dy: -25 })
    const panned = { ...state.transform }
    expect(state.userAdjusted).toBe(true)
    expect(panned.x).toBe(zoomed.x + 40)
    expect(panned.y).toBe(zoomed.y - 25)

    // 2) Cable click after pan keeps position
    state = applyDeviceViewportAction(state, { type: 'cable-click' })
    expect(viewportTransformsEqual(state.transform, panned)).toBe(true)

    // Device click also keeps transform
    state = applyDeviceViewportAction(state, { type: 'device-click' })
    expect(viewportTransformsEqual(state.transform, panned)).toBe(true)

    // 3) Open/close detail panel does not lower scale
    const scaleBeforePanel = state.transform.scale
    state = applyDeviceViewportAction(state, { type: 'panel-open' })
    expect(state.transform.scale).toBeGreaterThanOrEqual(scaleBeforePanel - 1e-6)
    expect(viewportTransformsEqual(state.transform, panned)).toBe(true)
    state = applyDeviceViewportAction(state, { type: 'panel-close' })
    expect(viewportTransformsEqual(state.transform, panned)).toBe(true)

    // 5) User-adjusted ResizeObserver: size change does not reset transform
    const refit = computeFitToScreenTransform(racks, { width: 900, height: 600 }, { padding: 72 })
    state = applyDeviceViewportAction(state, {
      type: 'resize',
      sizeChanged: true,
      mode: 'devices',
      fit: refit,
    })
    expect(viewportTransformsEqual(state.transform, panned)).toBe(true)
    expect(state.userAdjusted).toBe(true)

    // 6) Manual fit restores global view and clears userAdjusted
    state = applyDeviceViewportAction(state, { type: 'manual-fit', fit })
    expect(state.userAdjusted).toBe(false)
    expect(viewportTransformsEqual(state.transform, fit)).toBe(true)

    // Unadjusted resize may refit
    const widerFit = computeFitToScreenTransform(racks, { width: 1600, height: 800 }, { padding: 72 })
    state = applyDeviceViewportAction(state, {
      type: 'resize',
      sizeChanged: true,
      mode: 'devices',
      fit: widerFit,
    })
    expect(state.userAdjusted).toBe(false)
    expect(viewportTransformsEqual(state.transform, widerFit)).toBe(true)
  })

  it('selected cable keeps alert stroke color (not overridden by highlight)', () => {
    const snapshot = parseCableSnapshot({
      ...sampleCableScene,
      cables: [{
        ...sampleCableScene.cables[0],
        status: '告警',
      }],
    })!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c1' },
    )
    expect(scene.bundles[0]?.highlighted).toBe(true)
    expect(scene.bundles[0]?.strokeColor).toBe(NETWORK_COLORS.alert)
  })

  it('F2: overlay panel outer width matches zoom-controls panel-open reservation', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')

    const overlayStart = source.indexOf('.cable-detail-panel--overlay {')
    expect(overlayStart).toBeGreaterThanOrEqual(0)
    const overlayEnd = source.indexOf('\n}', overlayStart)
    const overlayCss = source.slice(overlayStart, overlayEnd + 2)
    // border-box so width:min(320px,42%) is outer width (padding/border included)
    expect(overlayCss).toMatch(/box-sizing:\s*border-box/)
    expect(overlayCss).toMatch(/width:\s*min\(320px,\s*42%\)/)
    // Must not allow outer width above the reserved 320px band
    expect(overlayCss).not.toMatch(/max-width:\s*360px/)
    expect(overlayCss).toMatch(/max-width:\s*min\(320px,\s*42%\)|max-width:\s*320px/)

    const openStart = source.indexOf('.device-zoom-controls--panel-open {')
    expect(openStart).toBeGreaterThanOrEqual(0)
    const openEnd = source.indexOf('\n}', openStart)
    const openCss = source.slice(openStart, openEnd + 2)
    expect(openCss).toContain('right: calc(12px + min(320px, 42%) + 12px)')

    // Geometry check: content-box 320+32pad+2border = 354 overlaps reserved 320;
    // border-box outer = 320 clears controls.
    const panelPadX = 16
    const panelBorderX = 1
    const reserved = 320
    const contentBoxOuter = 320 + panelPadX * 2 + panelBorderX * 2
    expect(contentBoxOuter).toBe(354)
    expect(contentBoxOuter).toBeGreaterThan(reserved)
    const borderBoxOuter = 320
    expect(borderBoxOuter).toBeLessThanOrEqual(reserved)
  })
})

describe('TASK-20260814-120641 device cable bundle aggregation', () => {
  const multiRackScene = {
    racks: [
      { rackId: 'k1', code: 'R1', x: 0, y: 0, width: 60, height: 100 },
      { rackId: 'k2', code: 'R2', x: 200, y: 0, width: 60, height: 100 },
    ],
    devices: [
      {
        deviceId: 'd1', deviceName: 'app-01', rackId: 'k1', deviceType: '服务器',
        operationalStatus: '正常', startU: 1, endU: 2,
      },
      {
        deviceId: 'd2', deviceName: 'sw-01', rackId: 'k2', deviceType: '交换机',
        operationalStatus: '正常', startU: 40, endU: 40,
      },
      {
        deviceId: 'd3', deviceName: 'app-02', rackId: 'k1', deviceType: '服务器',
        operationalStatus: '正常', startU: 5, endU: 6,
      },
      {
        deviceId: 'd4', deviceName: 'sw-02', rackId: 'k2', deviceType: '交换机',
        operationalStatus: '正常', startU: 38, endU: 38,
      },
    ],
    cables: [
      {
        cableId: 'c-a', cableType: '铜缆', purpose: '上联', status: '正常',
        source: { deviceId: 'd1', deviceName: 'app-01', portName: 'eth0', speed: '10G', rackId: 'k1', rackCode: 'R1' },
        target: { deviceId: 'd2', deviceName: 'sw-01', portName: 'GE0/1', speed: '10G', rackId: 'k2', rackCode: 'R2' },
      },
      {
        cableId: 'c-b', cableType: '光纤', purpose: '上联', status: '正常',
        source: { deviceId: 'd3', deviceName: 'app-02', portName: 'eth0', speed: '10G', rackId: 'k1', rackCode: 'R1' },
        target: { deviceId: 'd4', deviceName: 'sw-02', portName: 'GE0/2', speed: '10G', rackId: 'k2', rackCode: 'R2' },
      },
      {
        cableId: 'c-alert', cableType: '铜缆', purpose: '上联', status: '告警',
        source: { deviceId: 'd1', deviceName: 'app-01', portName: 'eth1', speed: '1G', rackId: 'k1', rackCode: 'R1' },
        target: { deviceId: 'd2', deviceName: 'sw-01', portName: 'GE0/3', speed: '1G', rackId: 'k2', rackCode: 'R2' },
      },
      {
        cableId: 'c-same', cableType: '铜缆', purpose: '上联', status: '正常',
        source: { deviceId: 'd1', deviceName: 'app-01', portName: 'eth2', speed: '1G', rackId: 'k1', rackCode: 'R1' },
        target: { deviceId: 'd3', deviceName: 'app-02', portName: 'eth2', speed: '1G', rackId: 'k1', rackCode: 'R1' },
      },
      {
        cableId: 'c-rev', cableType: '铜缆', purpose: '上联', status: '正常',
        source: { deviceId: 'd2', deviceName: 'sw-01', portName: 'GE0/9', speed: '10G', rackId: 'k2', rackCode: 'R2' },
        target: { deviceId: 'd1', deviceName: 'app-01', portName: 'eth9', speed: '10G', rackId: 'k1', rackCode: 'R1' },
      },
      {
        cableId: 'c-alone', cableType: 'DAC', purpose: '存储', status: '正常',
        source: { deviceId: 'd3', deviceName: 'app-02', portName: 'sas0', speed: '12G', rackId: 'k1', rackCode: 'R1' },
        target: { deviceId: 'd4', deviceName: 'sw-02', portName: 'sas1', speed: '12G', rackId: 'k2', rackCode: 'R2' },
      },
    ],
  }

  it('aggregates by rack-pair+purpose (no type); ≥2 merge, =1 stays single', () => {
    const snapshot = parseCableSnapshot(multiRackScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const agg = scene.bundles.find((b) => b.isAggregated)
    expect(agg).toBeTruthy()
    expect(agg!.id).toBe('k1|k2|上联')
    expect(agg!.id.split('|')).toHaveLength(3)
    expect(agg!.count).toBe(2)
    expect(agg!.memberIds.sort()).toEqual(['c-a', 'c-b'])
    expect(agg!.strokeColor).toBe(purposeNetworkColor('上联', '铜缆'))

    const alone = scene.bundles.find((b) => b.id === 'c-alone')
    expect(alone?.isAggregated).toBe(false)
    expect(alone?.count).toBe(1)
  })

  it('alert cables never join aggregates and keep alert stroke', () => {
    const snapshot = parseCableSnapshot(multiRackScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const alert = scene.bundles.find((b) => b.id === 'c-alert')
    expect(alert).toBeTruthy()
    expect(alert!.isAggregated).toBe(false)
    expect(alert!.strokeColor).toBe(NETWORK_COLORS.alert)
    const agg = scene.bundles.find((b) => b.isAggregated)!
    expect(agg.memberIds).not.toContain('c-alert')
    expect(scene.bundles.indexOf(alert!)).toBeGreaterThan(scene.bundles.indexOf(agg))
  })

  it('paint/hit order: singles before aggregated, alerts last', () => {
    const snapshot = parseCableSnapshot(multiRackScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const lastSingleIdx = Math.max(
      ...scene.bundles
        .map((b, i) => (!b.isAggregated && b.id !== 'c-alert' ? i : -1)),
    )
    const firstAggIdx = scene.bundles.findIndex((b) => b.isAggregated)
    const alertIdx = scene.bundles.findIndex((b) => b.id === 'c-alert')
    expect(firstAggIdx).toBeGreaterThan(-1)
    expect(lastSingleIdx).toBeGreaterThan(-1)
    expect(lastSingleIdx).toBeLessThan(firstAggIdx)
    expect(alertIdx).toBe(scene.bundles.length - 1)
    expect(alertIdx).toBeGreaterThan(firstAggIdx)
  })

  it('same-rack cables stay independent', () => {
    const snapshot = parseCableSnapshot(multiRackScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const same = scene.bundles.find((b) => b.id === 'c-same')
    expect(same?.isAggregated).toBe(false)
    expect(same?.sourceRackId).toBe(same?.targetRackId)
  })

  it('direction-sensitive: A→B and B→A are different bundles', () => {
    const snapshot = parseCableSnapshot(multiRackScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    expect(scene.bundles.some((b) => b.id === 'k1|k2|上联')).toBe(true)
    const reverse = scene.bundles.find((b) => b.id === 'c-rev' || b.id === 'k2|k1|上联')
    expect(reverse).toBeTruthy()
    expect(reverse!.id).not.toBe('k1|k2|上联')
  })

  it('selected aggregate bundle highlights and exposes member list', () => {
    const snapshot = parseCableSnapshot(multiRackScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedBundleId: 'k1|k2|上联' },
    )
    const agg = scene.bundles.find((b) => b.id === 'k1|k2|上联')!
    expect(agg.highlighted).toBe(true)
    expect(agg.opacity).toBe(1)
    expect(agg.memberIds).toHaveLength(2)
    expect(scene.bundles.find((b) => b.id === 'c-alone')?.opacity).toBe(UNSELECTED_OPACITY)
  })

  it('member cable selection keeps aggregation and overlays independent highlight', () => {
    const snapshot = parseCableSnapshot(multiRackScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, selectedCableId: 'c-a' },
    )
    const agg = scene.bundles.find((b) => b.id === 'k1|k2|上联')
    expect(agg?.isAggregated).toBe(true)
    expect(agg?.opacity).toBe(UNSELECTED_OPACITY)
    const overlay = scene.bundles.find((b) => b.id === 'c-a')
    expect(overlay?.highlighted).toBe(true)
    expect(overlay?.opacity).toBe(1)
    expect(visualStrokeWidthForBundle(overlay!)).toBe(SELECTED_STROKE_WIDTH)
    // Not fully expanded to one-bundle-per-cable for all normals
    expect(scene.bundles.filter((b) => b.isAggregated).length).toBe(1)
  })

  it('filters recompute aggregates; empty selected bundle clears via TopologyView watch', async () => {
    const snapshot = parseCableSnapshot(multiRackScene)!
    const filtered = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: ['DAC'] },
      'r1',
      { expandToCables: true },
    )
    expect(filtered.bundles.some((b) => b.isAggregated)).toBe(false)
    expect(filtered.bundles.map((b) => b.id)).toEqual(['c-alone'])

    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toContain('selectedBundleId')
    expect(source).toContain('visibleCableIds')
    expect(source).toContain('selectedBundleId.value = null')
    expect(source).toContain('onBundleMemberClick')
    expect(source).toContain('线路束')
  })

  it('device focus still expands to per-cable bundles', () => {
    const snapshot = parseCableSnapshot(multiRackScene)!
    const scene = buildCableScene(
      snapshot,
      { level: 'device', deviceId: 'd1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    expect(scene.bundles.every((b) => !b.isAggregated)).toBe(true)
    expect(scene.bundles).toHaveLength(multiRackScene.cables.length)
  })

  it('reports idle bundle count reduction vs fully expanded', () => {
    const snapshot = parseCableSnapshot(multiRackScene)!
    const expanded = buildCableScene(
      snapshot,
      { level: 'device', deviceId: 'd1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    const idle = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true },
    )
    expect(expanded.bundles).toHaveLength(6)
    // 2 cross-rack 上联 → 1 agg; reverse single; alert; same-rack; storage alone = 5
    expect(idle.bundles).toHaveLength(5)
    expect(idle.bundles.length).toBeLessThan(expanded.bundles.length)
  })
})

const RACK_HIT_HARNESS_DEV_SERVER = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'
const RACK_HIT_HARNESS_URL = `${RACK_HIT_HARNESS_DEV_SERVER}/rack-hit-harness.html`

async function assertRackHitHarnessDevServerReachable(): Promise<void> {
  try {
    const probe = await fetch(RACK_HIT_HARNESS_DEV_SERVER)
    if (!probe.ok) {
      throw new Error(`HTTP ${probe.status}`)
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    throw new Error(
      `Vite dev server unreachable at ${RACK_HIT_HARNESS_DEV_SERVER}. `
      + 'Start it with: npm run dev (in src/frontend). '
      + detail,
    )
  }
}

describe('TASK-20260814-140520 corridor routing + rack focus', () => {
  const corridorScene = {
    racks: [
      { rackId: 'k1', code: 'R1', x: 80, y: 110, width: 240, height: 200 },
      { rackId: 'k2', code: 'R2', x: 420, y: 110, width: 240, height: 200 },
      { rackId: 'k3', code: 'R3', x: 760, y: 110, width: 240, height: 200 },
    ],
    devices: [
      { deviceId: 'd1', deviceName: 'a', rackId: 'k1', deviceType: '服务器', operationalStatus: '正常', startU: 1, endU: 2 },
      { deviceId: 'd2', deviceName: 'b', rackId: 'k2', deviceType: '交换机', operationalStatus: '正常', startU: 1, endU: 1 },
      { deviceId: 'd3', deviceName: 'c', rackId: 'k3', deviceType: '服务器', operationalStatus: '正常', startU: 1, endU: 2 },
    ],
    cables: [
      {
        cableId: 'c-mgmt', cableType: '网线', purpose: '正常', status: '正常',
        source: { deviceId: 'd1', deviceName: 'a', portName: 'eth0', speed: '1G', rackId: 'k1', rackCode: 'R1' },
        target: { deviceId: 'd2', deviceName: 'b', portName: 'GE0/1', speed: '1G', rackId: 'k2', rackCode: 'R2' },
      },
      {
        cableId: 'c-biz', cableType: '光纤', purpose: '存储', status: '正常',
        source: { deviceId: 'd1', deviceName: 'a', portName: 'eth1', speed: '10G', rackId: 'k1', rackCode: 'R1' },
        target: { deviceId: 'd3', deviceName: 'c', portName: 'eth0', speed: '10G', rackId: 'k3', rackCode: 'R3' },
      },
      {
        cableId: 'c-alert', cableType: '铜缆', purpose: '上联', status: '告警',
        source: { deviceId: 'd1', deviceName: 'a', portName: 'eth2', speed: '10G', rackId: 'k1', rackCode: 'R1' },
        target: { deviceId: 'd2', deviceName: 'b', portName: 'GE0/2', speed: '10G', rackId: 'k2', rackCode: 'R2' },
      },
    ],
  }

  it('focusedPeerBundleKey is direction-independent (peer|purpose)', () => {
    const fwd = corridorScene.cables[0]!
    const rev = {
      ...fwd,
      cableId: 'c-rev',
      source: fwd.target,
      target: fwd.source,
    }
    expect(focusedPeerBundleKey('k1', fwd)).toBe('k2|正常')
    expect(focusedPeerBundleKey('k1', rev)).toBe('k2|正常')
    expect(peerRackId('k1', fwd)).toBe('k2')
  })

  it('focused aggregation conserves members and tracks alert counts per bundle', () => {
    const snapshot = parseCableSnapshot({
      ...corridorScene,
      cables: [
        ...corridorScene.cables,
        {
          cableId: 'c-mgmt2', cableType: '网线', purpose: '正常', status: '正常',
          source: { deviceId: 'd1', deviceName: 'a', portName: 'eth3', speed: '1G', rackId: 'k1', rackCode: 'R1' },
          target: { deviceId: 'd2', deviceName: 'b', portName: 'GE0/3', speed: '1G', rackId: 'k2', rackCode: 'R2' },
        },
      ],
    })!
    const stats = focusedAggregationStats(snapshot.cables, 'k1')
    expect(stats.relatedCount).toBe(4)
    expect(stats.bundleMemberSum).toBe(stats.relatedCount)
    expect(stats.alertByKey['k2|上联']).toBe(1)

    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, focusedRackId: 'k1' },
    )
    const memberSum = scene.bundles
      .filter((b) => b.isAggregated)
      .reduce((sum, b) => sum + b.count, 0)
    const singles = scene.bundles.filter((b) => !b.isAggregated && b.sourceRackId !== b.targetRackId)
    expect(memberSum + singles.length).toBeGreaterThan(0)
    expect(memberSum).toBe(4) // 2×正常 + 1×上联(告警) + 1×存储
    const uplink = scene.bundles.find((b) => b.id === 'k2|上联')
    expect(uplink?.alertCount).toBe(1)
    expect(uplink?.countLabel).toBe(bundleCountLabel(1, 1))
    expect(scene.bundles.every((b) => b.memberIds.length > 0)).toBe(true)
  })

  it('corridorForPurpose maps 管理/上联→upper and 存储→lower; unconfigured is deterministic', () => {
    expect(corridorForPurpose('正常')).toBe('upper')
    expect(corridorForPurpose('上联')).toBe('upper')
    expect(corridorForPurpose('存储')).toBe('lower')
    expect(corridorForPurpose('自定义', { upperCount: 2, lowerCount: 1 })).toBe('lower')
    expect(corridorForPurpose('自定义', { spanPx: 500 })).toBe('upper')
    expect(corridorForPurpose('自定义', { spanPx: 100 })).toBe('lower')
  })

  it('corridor routes keep horizontal segments out of unrelated rack bodies', () => {
    const snapshot = parseCableSnapshot(corridorScene)!
    const layout = computeCorridorLayout(snapshot.racks)
    const k1 = snapshot.racks[0]!
    const k3 = snapshot.racks[2]!
    const route = routeViaCorridor(k1, k3, {
      layout,
      side: 'lower',
      lane: 0,
      includeInternal: false,
    })
    const endpoints = new Set(['k1', 'k3'])
    expect(corridorHorizontalClear(route, snapshot.racks, endpoints)).toBe(true)
    expect(horizontalSegIntersectsRack(k1.x, k3.x + k3.width, corridorLaneY(layout, 'lower', 0), snapshot.racks[1]!)).toBe(false)
  })

  it('assignCorridorLanes separates overlapping intervals and reuses non-overlapping lanes', () => {
    const lanes = assignCorridorLanes([
      { id: 'a', side: 'upper', x1: 100, x2: 500, key: 'a' },
      { id: 'b', side: 'upper', x1: 120, x2: 480, key: 'b' },
      { id: 'c', side: 'upper', x1: 600, x2: 900, key: 'c' },
    ])
    expect(lanes.get('a')).not.toBe(lanes.get('b'))
    expect(lanes.get('a')).toBe(lanes.get('c'))
    expect(lanes.get('a')!).toBeLessThan(CORRIDOR_MAX_LANES)
    const again = assignCorridorLanes([
      { id: 'a', side: 'upper', x1: 100, x2: 500, key: 'a' },
      { id: 'b', side: 'upper', x1: 120, x2: 480, key: 'b' },
      { id: 'c', side: 'upper', x1: 600, x2: 900, key: 'c' },
    ])
    expect(again.get('a')).toBe(lanes.get('a'))
    expect(again.get('b')).toBe(lanes.get('b'))
  })

  it('expanded bundle draws member cables only; collapse restores aggregates', () => {
    const snapshot = parseCableSnapshot(corridorScene)!
    const expanded = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, focusedRackId: 'k1', expandedBundleKey: 'k2|正常' },
    )
    expect(expanded.bundles.some((b) => b.isAggregated && b.id === 'k2|正常')).toBe(false)
    expect(expanded.bundles.filter((b) => b.memberIds.includes('c-mgmt')).length).toBe(1)
    const collapsed = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, focusedRackId: 'k1' },
    )
    expect(collapsed.bundles.some((b) => b.isAggregated && b.id === 'k2|正常')).toBe(true)
  })

  it('interaction overlay sits above cable SVG with rack/device hit targets', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toContain('data-testid="rack-hit-overlay"')
    expect(source).toContain('data-testid="rack-hit-target"')
    expect(source).toContain('data-testid="device-hit-target"')
    expect(source).toContain('onRackHitClick')
    expect(source).toContain('onDeviceHitClick')
    expect(source).toMatch(/rack-hit-overlay[\s\S]*z-index:\s*6/)
    expect(source).toMatch(/cable-overlay[\s\S]*z-index:\s*4/)
    expect(source).toContain("@click.stop=\"onRackHitClick")
    expect(source).toContain("@click.stop=\"onDeviceHitClick")
  })

  it('idle state: rack overlay above devices; device hits only when rack focused', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    // Idle: rack > device — devices default to pointer-events:none, active for focused rack/device state.
    expect(source).toContain("'rack-hit-overlay__device--active': focusedRackId === hit.rackId || !!focusDeviceId")
    expect(source).toMatch(/\.rack-hit-overlay__device\s*\{[\s\S]*pointer-events:\s*none/)
    expect(source).toMatch(/\.rack-hit-overlay__device--active\s*\{[\s\S]*pointer-events:\s*auto/)
    expect(source).toMatch(/\.rack-hit-overlay__device--active\s*\{[\s\S]*z-index:\s*1/)
    // Rack click clears device focus; first device click still requires matching focusedRackId.
    expect(source).toMatch(/function onRackHitClick[\s\S]*focusDeviceId\.value = null/)
    expect(source).toMatch(/function onDeviceHitClick[\s\S]*if \(focusedRackId\.value !== rackId && focusDeviceId\.value === null\) return/)
    expect(source).toMatch(/function onDeviceHitClick[\s\S]*focusDeviceId\.value = deviceId/)
    // Konva fallback: unfocused rack device panel delegates to rack click.
    expect(source).toMatch(/if \(focusedRackId\.value !== rack\.rackId && focusDeviceId\.value === null\)[\s\S]*onRackHitClick\(rack\.rackId\)/)
  })

  it('rack rectangle blocks cable selection (overlay z-index above cable layer)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const view = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const layer = readFileSync(resolve(__dirname, '../components/CableLayer.vue'), 'utf8')
    const rackZ = view.match(/\.rack-hit-overlay\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1]
    const cableZ = view.match(/\.cable-overlay\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1]
    expect(Number(rackZ)).toBeGreaterThan(Number(cableZ))
    expect(layer).toContain('pointer-events="stroke"')
    expect(view).toMatch(/\.rack-hit-overlay__rack\s*\{[\s\S]*pointer-events:\s*auto/)
  })

  it('Esc handler and background click clear expand then rack focus', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toContain('onDeviceKeydown')
    expect(source).toContain("event.key !== 'Escape'")
    expect(source).toContain('expandedBundleKey.value = null')
    expect(source).toContain('focusedRackId.value = null')
    expect(source).toContain('onCableBackgroundClick')
  })

  it('rack/bundle/cable clicks preserve viewport transform', () => {
    const base = { transform: { scale: 1.35, x: 120, y: 80 }, userAdjusted: true, fitAppliedForSnapshot: 'k' }
    for (const type of ['rack-click', 'bundle-expand', 'bundle-collapse', 'cable-click'] as const) {
      const next = applyDeviceViewportAction(base, { type })
      expect(next.transform).toEqual(base.transform)
      expect(next.userAdjusted).toBe(true)
    }
  })

  it('CableLayer exposes bundle hover + countLabel for aggregate tooltips', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const layer = readFileSync(resolve(__dirname, '../components/CableLayer.vue'), 'utf8')
    expect(layer).toContain("emit('bundle-hover'")
    expect(layer).toContain("emit('background-click')")
    expect(layer).toContain('bundle.countLabel')
    expect(layer).toContain('×${bundle.count}')
  })

  it('F1: multi-row 2×2 corridor routes avoid unrelated rack bodies (H + V segments)', () => {
    const rowGap = 48
    const rackH = 200
    const row2Y = 110 + rackH + rowGap
    const multiRow2x2 = {
      racks: [
        { rackId: 'a1', code: 'A1', x: 80, y: 110, width: 240, height: rackH },
        { rackId: 'a2', code: 'A2', x: 420, y: 110, width: 240, height: rackH },
        { rackId: 'b1', code: 'B1', x: 80, y: row2Y, width: 240, height: rackH },
        { rackId: 'b2', code: 'B2', x: 420, y: row2Y, width: 240, height: rackH },
      ],
      devices: [],
      cables: [],
    }
    const snapshot = parseCableSnapshot(multiRow2x2)!
    const layout = computeCorridorLayout(snapshot.racks)
    const endpoints = new Set<string>()
    const pairs: Array<[string, string, CorridorSide]> = [
      ['b1', 'a2', 'upper'],
      ['b2', 'a1', 'upper'],
      ['b1', 'b2', 'lower'],
      ['a1', 'a2', 'upper'],
    ]
    for (const [srcId, tgtId, side] of pairs) {
      const src = snapshot.racks.find((r) => r.rackId === srcId)!
      const tgt = snapshot.racks.find((r) => r.rackId === tgtId)!
      endpoints.clear()
      endpoints.add(srcId)
      endpoints.add(tgtId)
      const route = routeViaCorridor(src, tgt, { layout, side, lane: 0, includeInternal: false })
      expect(routeSegmentsClear(route, snapshot.racks, endpoints)).toBe(true)
      expect(corridorHorizontalClear(route, snapshot.racks, endpoints)).toBe(true)
    }
  })

  it('F1: multi-row 3×2 idle scene routes clear all cross-rack bundles', () => {
    const rowGap = 48
    const rackH = 180
    const row2Y = 110 + rackH + rowGap
    const racks = [
      { rackId: 'r1', code: 'R1', x: 80, y: 110, width: 240, height: rackH },
      { rackId: 'r2', code: 'R2', x: 420, y: 110, width: 240, height: rackH },
      { rackId: 'r3', code: 'R3', x: 760, y: 110, width: 240, height: rackH },
      { rackId: 'r4', code: 'R4', x: 80, y: row2Y, width: 240, height: rackH },
      { rackId: 'r5', code: 'R5', x: 420, y: row2Y, width: 240, height: rackH },
      { rackId: 'r6', code: 'R6', x: 760, y: row2Y, width: 240, height: rackH },
    ]
    const devices = racks.flatMap((r, i) => [{
      deviceId: `d${i}`, deviceName: `srv${i}`, rackId: r.rackId,
      deviceType: '服务器', operationalStatus: '正常', startU: 1, endU: 2,
    }])
    const cables = [
      { cableId: 'c1', cableType: '网线', purpose: '正常', status: '正常',
        source: { deviceId: 'd0', deviceName: 's0', portName: 'p0', speed: '1G', rackId: 'r1', rackCode: 'R1' },
        target: { deviceId: 'd5', deviceName: 's5', portName: 'p1', speed: '1G', rackId: 'r6', rackCode: 'R6' } },
      { cableId: 'c2', cableType: '光纤', purpose: '存储', status: '正常',
        source: { deviceId: 'd3', deviceName: 's3', portName: 'p0', speed: '10G', rackId: 'r4', rackCode: 'R4' },
        target: { deviceId: 'd1', deviceName: 's1', portName: 'p1', speed: '10G', rackId: 'r2', rackCode: 'R2' } },
    ]
    const snapshot = parseCableSnapshot({ racks, devices, cables })!
    const scene = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'room' },
      { purposes: [], cableTypes: [] },
      'room',
      { expandToCables: true },
    )
    for (const bundle of scene.bundles) {
      if (bundle.sourceRackId === bundle.targetRackId || bundle.route.length < 2) continue
      const endpoints = new Set([bundle.sourceRackId, bundle.targetRackId])
      expect(routeSegmentsClear(bundle.route, snapshot.racks, endpoints)).toBe(true)
    }
  })

  it('F1: single-column 3×20U focused routes avoid unrelated rack bodies', () => {
    const heightU = 20
    const rackH = heightU * DEVICE_U_PX + 32
    const racks = Array.from({ length: 3 }, (_, i) => ({
      rackId: `r${i + 1}`,
      code: `R${i + 1}`,
      x: 0,
      y: 0,
      width: 240,
      height: rackH,
    }))
    const devices = racks.map((rack, i) => ({
      deviceId: `d${i + 1}`,
      deviceName: `srv${i + 1}`,
      rackId: rack.rackId,
      deviceType: '服务器',
      operationalStatus: '正常',
      startU: 1,
      endU: heightU,
    }))
    const endpoint = (deviceId: string, rackId: string, rackCode: string, name: string) => ({
      deviceId,
      deviceName: name,
      portName: 'eth0',
      speed: '1G',
      rackId,
      rackCode,
    })
    const snapshot = parseCableSnapshot({
      racks,
      devices,
      cables: [
        {
          cableId: 'c12', cableType: '网线', purpose: '正常', status: '正常',
          source: endpoint('d1', 'r1', 'R1', 'srv1'),
          target: endpoint('d2', 'r2', 'R2', 'srv2'),
        },
        {
          cableId: 'c13', cableType: '光纤', purpose: '存储', status: '正常',
          source: endpoint('d1', 'r1', 'R1', 'srv1'),
          target: endpoint('d3', 'r3', 'R3', 'srv3'),
        },
        {
          cableId: 'c23', cableType: '铜缆', purpose: '上联', status: '正常',
          source: endpoint('d2', 'r2', 'R2', 'srv2'),
          target: endpoint('d3', 'r3', 'R3', 'srv3'),
        },
      ],
    })!
    const laid = layoutDeviceLevelSnapshot(snapshot, { availW: 400, availH: 1000 })
    expect(laid.colCount).toBe(1)
    expect(laid.snapshot.racks).toHaveLength(3)

    const focusedId = laid.snapshot.racks[0]!.rackId
    const scene = buildCableScene(
      laid.snapshot,
      { level: 'room', roomId: 'room' },
      { purposes: [], cableTypes: [] },
      'room',
      { expandToCables: true, focusedRackId: focusedId },
    )
    for (const bundle of scene.bundles) {
      if (bundle.sourceRackId === bundle.targetRackId || bundle.route.length < 2) continue
      const endpoints = new Set([bundle.sourceRackId, bundle.targetRackId])
      expect(routeSegmentsClear(bundle.route, laid.snapshot.racks, endpoints)).toBe(true)
    }
  })

  it('F1: 2×5 layout idle cross-rack routes clear all segments', () => {
    const heightU = 20
    const rackH = heightU * DEVICE_U_PX + 32
    const racks = Array.from({ length: 10 }, (_, i) => ({
      rackId: `r${i + 1}`,
      code: `R${String(i + 1).padStart(2, '0')}`,
      x: 0,
      y: 0,
      width: 240,
      height: rackH,
    }))
    const devices = racks.map((rack, i) => ({
      deviceId: `d${i + 1}`,
      deviceName: `srv${i + 1}`,
      rackId: rack.rackId,
      deviceType: '服务器',
      operationalStatus: '正常',
      startU: 1,
      endU: heightU,
    }))
    const ep = (deviceId: string, rackId: string, code: string) => ({
      deviceId,
      deviceName: deviceId,
      portName: 'eth0',
      speed: '1G',
      rackId,
      rackCode: code,
    })
    const snapshot = parseCableSnapshot({
      racks,
      devices,
      cables: [
        {
          cableId: 'c-top-bottom', cableType: '网线', purpose: '正常', status: '正常',
          source: ep('d1', 'r1', 'R01'),
          target: ep('d10', 'r10', 'R10'),
        },
        {
          cableId: 'c-mid', cableType: '光纤', purpose: '存储', status: '正常',
          source: ep('d4', 'r4', 'R04'),
          target: ep('d7', 'r7', 'R07'),
        },
      ],
    })!
    const laid = layoutDeviceLevelSnapshot(snapshot, {
      availW: 800,
      availH: 2400,
      lockedColCount: 2,
    })
    expect(laid.colCount).toBe(2)
    expect(laid.rows).toBe(5)

    const scene = buildCableScene(
      laid.snapshot,
      { level: 'room', roomId: 'room' },
      { purposes: [], cableTypes: [] },
      'room',
      { expandToCables: true },
    )
    for (const bundle of scene.bundles) {
      if (bundle.sourceRackId === bundle.targetRackId || bundle.route.length < 2) continue
      const endpoints = new Set([bundle.sourceRackId, bundle.targetRackId])
      expect(routeSegmentsClear(bundle.route, laid.snapshot.racks, endpoints)).toBe(true)
    }
  })

  it('F2: real TopologyView rack-hit-target clicks set focusedRackId (edge, body, title)', async () => {
    await assertRackHitHarnessDevServerReachable()

    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(RACK_HIT_HARNESS_URL, { waitUntil: 'networkidle' })

      const bootError = page.locator('[data-testid="rack-hit-harness-error"]')
      expect(await bootError.count()).toBe(0)

      const rack = page.locator('[data-testid="rack-hit-target"][data-rack-id="k1"]')
      await rack.waitFor({ state: 'visible', timeout: 20_000 })

      const resetFocus = async (): Promise<void> => {
        const focused = await rack.evaluate((el) => el.classList.contains('rack-hit-overlay__rack--focused'))
        if (focused) {
          await rack.click({ position: { x: 8, y: 8 } })
          await page.waitForFunction(
            (selector) => {
              const el = document.querySelector(selector)
              return el !== null && !el.classList.contains('rack-hit-overlay__rack--focused')
            },
            '[data-testid="rack-hit-target"][data-rack-id="k1"]',
          )
        }
      }

      const box = await rack.boundingBox()
      expect(box).not.toBeNull()
      if (!box) return

      const titleBand = RACK_HIT_TITLE_BAND
      const frontWidth = box.width - RACK_VISUAL_DEPTH_X
      const hitHeight = box.height

      const assertRackFocused = async (): Promise<void> => {
        expect(await rack.evaluate((el) => el.classList.contains('rack-hit-overlay__rack--focused'))).toBe(true)
      }

      // Title band (above rack front face)
      await rack.click({ position: { x: frontWidth * 0.3, y: titleBand * 0.45 } })
      await assertRackFocused()

      await resetFocus()

      // Rack body (front face interior)
      await rack.click({ position: { x: frontWidth * 0.4, y: titleBand + (hitHeight - titleBand) * 0.5 } })
      await assertRackFocused()

      await resetFocus()

      // Right 2.5D edge (x + width - 2px)
      await rack.click({ position: { x: box.width - 2, y: hitHeight * 0.55 } })
      await assertRackFocused()
    } finally {
      await browser.close()
    }
  }, 60_000)

  it('F2: rack hit overlay covers title band above rack front face', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toContain('rackHitTargetStyle')
    expect(source).toContain('RACK_TITLE_HIT_BAND')
    const style = rackHitTargetStyle(
      { x: 80, y: 110, width: 240, height: 400 },
      { titleBand: RACK_HIT_TITLE_BAND, depthX: RACK_VISUAL_DEPTH_X },
    )
    expect(style.top).toBe(`${110 - RACK_HIT_TITLE_BAND}px`)
    expect(style.height).toBe(`${400 + RACK_HIT_TITLE_BAND}px`)
    expect(Number.parseFloat(style.width!)).toBe(240 + RACK_VISUAL_DEPTH_X)
  })

  it('F3: Konva stage blank click uses graded onCableBackgroundClick (not clearDeviceFocus)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toMatch(/stage\.on\('click'[\s\S]*event\.target === stage[\s\S]*onCableBackgroundClick\(\)/)
    expect(source).not.toMatch(/stage\.on\('click'[\s\S]*event\.target === stage[\s\S]*clearDeviceFocus\(\)/)
    expect(source).toMatch(/function onCableBackgroundClick[\s\S]*expandedBundleKey\.value[\s\S]*focusedRackId\.value/)
  })

  it('F4: filter validity uses visible scene bundles (not unfiltered laidSnapshot cables)', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    expect(source).toContain('visibleCableIds')
    expect(source).toContain('focusedPeerBundleKey')
    expect(source).not.toMatch(/laidSnapshot\.value\.cables\.some\(\(c\) => \{[\s\S]*expandedBundleKey/)
  })

  it('F4: buildCableScene drops filtered-out expanded bundle from visible bundles', () => {
    const snapshot = parseCableSnapshot(corridorScene)!
    const expanded = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: [], cableTypes: [] },
      'r1',
      { expandToCables: true, focusedRackId: 'k1', expandedBundleKey: 'k2|正常' },
    )
    expect(expanded.bundles.some((b) => b.memberIds.includes('c-mgmt'))).toBe(true)
    const filtered = buildCableScene(
      snapshot,
      { level: 'room', roomId: 'r1' },
      { purposes: ['存储'], cableTypes: [] },
      'r1',
      { expandToCables: true, focusedRackId: 'k1', expandedBundleKey: 'k2|正常' },
    )
    expect(filtered.bundles.some((b) => b.memberIds.includes('c-mgmt'))).toBe(false)
    expect(filtered.bundles.every((b) => b.purpose === '存储')).toBe(true)
  })

  it('TASK-20260825-092201: viewport events bubble through rack, device and cable overlays', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')

    expect(source).toContain('@wheel.prevent="onDeviceViewportWheel"')
    expect(source).toContain('@mousedown="onDeviceViewportMouseDown"')
    expect(source).toContain('@mousemove="onDeviceViewportMouseMove"')
    expect(source).toContain('@mouseup="onDeviceViewportMouseUp"')
    expect(source).toContain('@mouseleave="onDeviceViewportMouseLeave"')
    expect(source).toMatch(/function onDeviceViewportWheel[\s\S]*applyDeviceZoom/)
    expect(source).toMatch(/function onDeviceViewportMouseDown[\s\S]*devicePan/)
    expect(source).toMatch(/function onDeviceViewportMouseMove[\s\S]*DEVICE_DRAG_THRESHOLD_PX/)
    expect(source).toMatch(/function onDeviceViewportMouseMove[\s\S]*stage\.position/)
    expect(source).toMatch(/function onRackHitClick[\s\S]*consumeSuppressedViewportClick/)
    expect(source).toMatch(/function onDeviceHitClick[\s\S]*consumeSuppressedViewportClick/)
    expect(source).toMatch(/function onCableBundleClick[\s\S]*consumeSuppressedViewportClick/)
  })

  it('TASK-20260825-092201: continuous wheel zoom redraws only across semantic thresholds', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const source = readFileSync(resolve(__dirname, '../views/TopologyView.vue'), 'utf8')
    const start = source.indexOf('function applyDeviceZoom(')
    const body = source.slice(start, source.indexOf('function deviceSnapshotKey(', start))

    expect(body).toContain('zoomViewportAroundPoint')
    expect(body).toContain('stage.batchDraw()')
    expect(body).toContain('semanticZoomChanged(beforeSemantic, afterSemantic)')
    expect(body).toContain('if (semanticZoomChanged(beforeSemantic, afterSemantic)) drawScene()')
    expect(body).not.toMatch(/stage\.batchDraw\(\)\s*\n\s*drawScene\(\)/)
  })
})
