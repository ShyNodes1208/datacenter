import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import {
  cableTypeColor,
  parseTopologyPayload,
  primaryCableType,
  useTopology,
} from '../composables/useTopology'

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
    },
  }
})

afterEach(() => {
  requestMock.mockReset()
  userMock.value = { id: 'u1', username: 'admin', role: '机房管理员' }
})

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
