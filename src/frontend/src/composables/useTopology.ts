import { ref } from 'vue'
import { useApi } from './useApi'

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
  mode: 'rooms' | 'racks'
  focusedRoomId: string | null
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
  }
}

export function primaryCableType(types: string[]): string {
  return types[0] ?? '未知'
}

export const CABLE_TYPE_COLORS: Record<string, string> = {
  铜缆: '#e67e22',
  光纤: '#f1c40f',
  DAC: '#3498db',
  网线: '#2ecc71',
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

  return { data, error, loading, load, saveRoomPosition }
}
