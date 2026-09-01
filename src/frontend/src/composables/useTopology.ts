import { ref } from 'vue'
import { useApi } from './useApi'
import {
  parseCableSnapshot,
  type CableSnapshot,
} from './useCableScene'

export interface TopologyCableDetail {
  cableId: string
  cableType: string
  sourceDevice: string
  sourcePort: string
  targetDevice: string
  targetPort: string
}

export interface TopologyRoom {
  id: string
  name: string
  status: string
  location: string | null
  topologyX: number
  topologyY: number
  rackCount: number
  serverCount: number
  cableCount: number
}

export interface TopologyRack {
  id: string
  code: string
  x: number
  y: number
}

export interface TopologyRoomConnection {
  sourceRoomId: string
  targetRoomId: string
  cableCount: number
  cableType: string
  purpose: string
  status: string
  types: string[]
  cables: TopologyCableDetail[]
}

export interface TopologyRackConnection {
  sourceRackId: string
  targetRackId: string
  cableCount: number
  types: string[]
  cables: TopologyCableDetail[]
}

export interface TopologyData {
  rooms: TopologyRoom[]
  racks: TopologyRack[]
  roomConnections: TopologyRoomConnection[]
  rackConnections: TopologyRackConnection[]
  mode: 'rooms' | 'racks' | 'devices'
  focusedRoomId: string | null
  cableSnapshot: CableSnapshot | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function parseCableDetail(value: unknown): TopologyCableDetail | null {
  const record = asRecord(value)
  if (!record) return null
  if (
    typeof record.cableId !== 'string'
    || typeof record.cableType !== 'string'
    || typeof record.sourceDevice !== 'string'
    || typeof record.sourcePort !== 'string'
    || typeof record.targetDevice !== 'string'
    || typeof record.targetPort !== 'string'
  ) {
    return null
  }
  return {
    cableId: record.cableId,
    cableType: record.cableType,
    sourceDevice: record.sourceDevice,
    sourcePort: record.sourcePort,
    targetDevice: record.targetDevice,
    targetPort: record.targetPort,
  }
}

function parseTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseCables(value: unknown): TopologyCableDetail[] {
  if (!Array.isArray(value)) return []
  const parsed: TopologyCableDetail[] = []
  for (const item of value) {
    const detail = parseCableDetail(item)
    if (detail) parsed.push(detail)
  }
  return parsed
}

function parseRoom(value: unknown): TopologyRoom | null {
  const record = asRecord(value)
  if (!record) return null
  if (
    typeof record.id !== 'string'
    || typeof record.name !== 'string'
    || typeof record.status !== 'string'
    || typeof record.topologyX !== 'number'
    || typeof record.topologyY !== 'number'
  ) {
    return null
  }
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    location: typeof record.location === 'string' ? record.location : null,
    topologyX: record.topologyX,
    topologyY: record.topologyY,
    rackCount: typeof record.rackCount === 'number' ? record.rackCount : 0,
    serverCount: typeof record.serverCount === 'number' ? record.serverCount : 0,
    cableCount: typeof record.cableCount === 'number' ? record.cableCount : 0,
  }
}

function parseRack(value: unknown): TopologyRack | null {
  const record = asRecord(value)
  if (!record) return null
  if (
    typeof record.id !== 'string'
    || typeof record.code !== 'string'
    || typeof record.x !== 'number'
    || typeof record.y !== 'number'
  ) {
    return null
  }
  return {
    id: record.id,
    code: record.code,
    x: record.x,
    y: record.y,
  }
}

export function parseTopologyPayload(data: unknown, focusedRoomId: string | null): TopologyData | null {
  const root = asRecord(data)
  if (!root || !Array.isArray(root.rooms) || !Array.isArray(root.connections)) {
    return null
  }

  const rooms: TopologyRoom[] = []
  for (const item of root.rooms) {
    const room = parseRoom(item)
    if (room) rooms.push(room)
  }

  if (focusedRoomId) {
    const racks: TopologyRack[] = []
    if (Array.isArray(root.racks)) {
      for (const item of root.racks) {
        const rack = parseRack(item)
        if (rack) racks.push(rack)
      }
    }
    const rackConnections: TopologyRackConnection[] = []
    for (const item of root.connections) {
      const record = asRecord(item)
      if (!record) continue
      if (
        typeof record.sourceRackId !== 'string'
        || typeof record.targetRackId !== 'string'
        || typeof record.cableCount !== 'number'
      ) {
        continue
      }
      rackConnections.push({
        sourceRackId: record.sourceRackId,
        targetRackId: record.targetRackId,
        cableCount: record.cableCount,
        types: parseTypes(record.types),
        cables: parseCables(record.cables),
      })
    }
    return {
      rooms,
      racks,
      roomConnections: [],
      rackConnections,
      mode: 'racks',
      focusedRoomId,
      cableSnapshot: null,
    }
  }

  const roomConnections: TopologyRoomConnection[] = []
  for (const item of root.connections) {
    const record = asRecord(item)
    if (!record) continue
    if (
      typeof record.sourceRoomId !== 'string'
      || typeof record.targetRoomId !== 'string'
      || typeof record.cableCount !== 'number'
    ) {
      continue
    }
    roomConnections.push({
      sourceRoomId: record.sourceRoomId,
      targetRoomId: record.targetRoomId,
      cableCount: record.cableCount,
      cableType: typeof record.cableType === 'string' ? record.cableType : primaryCableType(parseTypes(record.types)),
      purpose: typeof record.purpose === 'string' ? record.purpose : '正常',
      status: typeof record.status === 'string' ? record.status : '正常',
      types: parseTypes(record.types),
      cables: parseCables(record.cables),
    })
  }

  return {
    rooms,
    racks: [],
    roomConnections,
    rackConnections: [],
    mode: 'rooms',
    focusedRoomId: null,
    cableSnapshot: null,
  }
}

export function primaryCableType(types: string[]): string {
  return types[0] ?? '未知'
}

export const TOPOLOGY_PALETTE = {
  bgPage: '#06111f',
  bgTopology: '#071425',
  bgPanel: '#0b1c30',
  borderPanel: '#203750',
  textPrimary: '#e8f1ff',
  textSecondary: '#8fa4bd',
  accentBlue: '#3388ff',
  statusGreen: '#54d17a',
  alertOrange: '#ff9f32',
  alertRed: '#ff4d5f',
  mgmtCyan: '#35e6ff',
  bizPurple: '#9868ff',
  storageOrange: '#ffad3b',
} as const

export const SHANGHAI_ROOM_ID = '64D083F6-CFFB-408E-AE45-5EA0E1914A51'
export const SHANGHAI_ROOM_NAMES = ['上海机房', '页面验证机房'] as const

export function isShanghaiRoom(room: { id: string; name: string }): boolean {
  return room.id.toUpperCase() === SHANGHAI_ROOM_ID
    || SHANGHAI_ROOM_NAMES.includes(room.name as typeof SHANGHAI_ROOM_NAMES[number])
}

/** Map cable purpose (+ status) to stroke color per TASK palette. */
export function purposeLineColor(purpose: string, status?: string, cableType?: string): string {
  if (status === '告警') return TOPOLOGY_PALETTE.alertRed
  switch (purpose) {
    case '管理网络':
      return TOPOLOGY_PALETTE.mgmtCyan
    case '业务网络':
    case '上联':
      return TOPOLOGY_PALETTE.bizPurple
    case '存储网络':
    case '存储':
      return TOPOLOGY_PALETTE.storageOrange
    case '正常':
      return cableType === '网线' ? TOPOLOGY_PALETTE.mgmtCyan : TOPOLOGY_PALETTE.accentBlue
    default:
      return TOPOLOGY_PALETTE.accentBlue
  }
}

export function connectionBundleId(conn: TopologyRoomConnection): string {
  return [
    conn.sourceRoomId,
    conn.targetRoomId,
    conn.cableType,
    conn.purpose,
    conn.status,
  ].join('|')
}

export interface RoomGridPosition {
  roomId: string
  x: number
  y: number
}

/**
 * Data-driven grid layout for room nodes.
 * All rooms are placed on a fresh grid — saved topologyX/topologyY are ignored
 * for the default layout to prevent overlap. Admin drag-to-save is still supported
 * but the initial view always shows a clean, evenly-spaced grid.
 *
 * Column count adapts to room count and available canvas width (default 1536px).
 */
export function buildRoomGridLayout(
  rooms: TopologyRoom[],
  cellW = 320,
  cellH = 200,
  padding = 48,
  canvasWidth = 1536,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  if (rooms.length === 0) return positions

  // Dynamically pick columns so the grid fits the canvas without excessive scrolling.
  // Target: 3–6 columns, preferring wider grids for fewer rooms.
  const maxCols = Math.max(2, Math.floor((canvasWidth - padding * 2) / cellW))
  const idealCols = Math.ceil(Math.sqrt(rooms.length * (canvasWidth / (cellH * 4))))
  const cols = Math.min(maxCols, Math.max(2, idealCols))

  const sorted = [...rooms].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  sorted.forEach((room, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    positions.set(room.id, { x: padding + col * cellW, y: padding + row * cellH })
  })

  return positions
}

export interface Point2D {
  x: number
  y: number
}

export const ROOM_PLATFORM_W = 280
export const ROOM_PLATFORM_H = 150
export const ROOM_PLATFORM_DEPTH = 20

export type RoomEdge = 'left' | 'right' | 'top'

export function roomPlatformEdgePoint(
  pos: Point2D,
  edge: RoomEdge,
  slotIndex = 0,
  slotCount = 1,
): Point2D {
  const w = ROOM_PLATFORM_W
  const h = ROOM_PLATFORM_H
  const t = slotCount > 1 ? (slotIndex + 1) / (slotCount + 1) : 0.5
  switch (edge) {
    case 'left':
      return { x: pos.x, y: pos.y + h * t }
    case 'right':
      return { x: pos.x + w, y: pos.y + h * t }
    case 'top':
      return { x: pos.x + w * t, y: pos.y }
  }
}

/**
 * Route a cable between two room platform edge points through the corridor
 * BETWEEN rooms, avoiding the room bodies. Routes travel in the gaps.
 *
 * @param from   Start point on source room edge
 * @param to     End point on target room edge
 * @param srcPos Top-left corner of source room platform
 * @param tgtPos Top-left corner of target room platform
 */
export function routeRoomCable(
  from: Point2D,
  to: Point2D,
  srcPos?: Point2D,
  tgtPos?: Point2D,
): Point2D[] {
  if (!srcPos || !tgtPos) {
    // Fallback: simple orthogonal route
    const midX = (from.x + to.x) / 2
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to]
  }

  const w = ROOM_PLATFORM_W
  const h = ROOM_PLATFORM_H
  const gap = 40 // corridor padding outside room edges

  // Determine relative position
  const srcRight = from.x >= srcPos.x + w / 2
  const tgtRight = to.x >= tgtPos.x + w / 2
  const sameRow = Math.abs(srcPos.y - tgtPos.y) < h
  const sameCol = Math.abs(srcPos.x - tgtPos.x) < w

  if (sameRow) {
    // Horizontal neighbors — route through the vertical gap between them
    const corridorX = srcRight
      ? Math.min(srcPos.x + w, tgtPos.x) + gap / 2
      : Math.max(srcPos.x, tgtPos.x + w) - gap / 2
    const midY = (from.y + to.y) / 2
    return [
      from,
      { x: corridorX, y: from.y },
      { x: corridorX, y: midY },
      { x: corridorX, y: to.y },
      to,
    ]
  }

  if (sameCol) {
    // Vertical neighbors — route through the horizontal gap between them
    const srcBelow = from.y >= srcPos.y + h / 2
    const corridorY = srcBelow
      ? Math.min(srcPos.y + h, tgtPos.y) + gap / 2
      : Math.max(srcPos.y, tgtPos.y + h) - gap / 2
    const midX = (from.x + to.x) / 2
    return [
      from,
      { x: from.x, y: corridorY },
      { x: midX, y: corridorY },
      { x: to.x, y: corridorY },
      to,
    ]
  }

  // Diagonal: route through both horizontal and vertical corridors
  const corridorX = srcRight
    ? srcPos.x + w + gap
    : srcPos.x - gap
  const tgtCorridorY = tgtPos.y > srcPos.y
    ? tgtPos.y - gap
    : tgtPos.y + h + gap

  return [
    from,
    { x: corridorX, y: from.y },
    { x: corridorX, y: tgtCorridorY },
    { x: to.x, y: tgtCorridorY },
    to,
  ]
}

export function filterRoomConnections(
  connections: TopologyRoomConnection[],
  filters: { cableTypes?: string[]; purposes?: string[]; statuses?: string[] },
): TopologyRoomConnection[] {
  return connections.filter((conn) => {
    if (filters.cableTypes?.length && !filters.cableTypes.includes(conn.cableType)) return false
    if (filters.purposes?.length && !filters.purposes.includes(conn.purpose)) return false
    if (filters.statuses?.length && !filters.statuses.includes(conn.status)) return false
    return true
  })
}

export const CABLE_TYPE_COLORS: Record<string, string> = {
  铜缆: '#e67e22',
  光纤: TOPOLOGY_PALETTE.bizPurple,
  DAC: TOPOLOGY_PALETTE.storageOrange,
  网线: TOPOLOGY_PALETTE.mgmtCyan,
}

export function cableTypeColor(type: string): string {
  return CABLE_TYPE_COLORS[type] ?? '#95a5a6'
}

export function useTopology() {
  const { request } = useApi()
  const data = ref<TopologyData | null>(null)
  const error = ref('')
  const loading = ref(false)

  async function load(roomId?: string | null): Promise<void> {
    loading.value = true
    error.value = ''
    const path = roomId
      ? `/api/rooms/topology?roomId=${encodeURIComponent(roomId)}`
      : '/api/rooms/topology'
    const result = await request<unknown>(path, { method: 'GET' })
    if (!result.ok) {
      error.value = result.error
      data.value = null
      loading.value = false
      return
    }
    const parsed = parseTopologyPayload(result.data, roomId ?? null)
    if (!parsed) {
      error.value = 'Request failed.'
      data.value = null
      loading.value = false
      return
    }
    data.value = parsed
    loading.value = false
  }

  async function loadDevices(roomId: string): Promise<void> {
    loading.value = true
    error.value = ''
    const [topoResult, sceneResult] = await Promise.all([
      request<unknown>(`/api/rooms/topology?roomId=${encodeURIComponent(roomId)}`, { method: 'GET' }),
      request<unknown>(`/api/rooms/${encodeURIComponent(roomId)}/cable-scene`, { method: 'GET' }),
    ])
    if (!topoResult.ok) {
      error.value = topoResult.error
      data.value = null
      loading.value = false
      return
    }
    if (!sceneResult.ok) {
      error.value = sceneResult.error
      data.value = null
      loading.value = false
      return
    }
    const topo = parseTopologyPayload(topoResult.data, roomId)
    const snapshot = parseCableSnapshot(sceneResult.data)
    if (!topo || !snapshot) {
      error.value = 'Request failed.'
      data.value = null
      loading.value = false
      return
    }
    data.value = {
      ...topo,
      mode: 'devices',
      focusedRoomId: roomId,
      cableSnapshot: snapshot,
    }
    loading.value = false
  }

  async function saveRoomPosition(
    room: TopologyRoom,
    topologyX: number,
    topologyY: number,
    csrfToken: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const result = await request(`/api/rooms/${room.id}`, {
      method: 'PUT',
      body: {
        name: room.name,
        status: room.status,
        location: room.location,
        topologyX,
        topologyY,
      },
      csrfToken,
    })
    if (!result.ok) {
      return { ok: false, error: result.error }
    }
    return { ok: true }
  }

  return { data, error, loading, load, loadDevices, saveRoomPosition }
}
