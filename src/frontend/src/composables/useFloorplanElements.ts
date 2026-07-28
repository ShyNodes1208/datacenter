import { ref } from 'vue'
import { useApi } from './useApi'

export interface WallItem {
  id: string
  roomId: string
  x1: number; y1: number; x2: number; y2: number
  color: string
  thickness: number
}

export interface ZoneItem {
  id: string
  roomId: string
  x: number; y: number; width: number; height: number
  name: string
  color: string
  zoneType: 'cold-aisle' | 'hot-aisle' | 'functional' | 'custom'
}

export interface LabelItem {
  id: string
  roomId: string
  x: number; y: number
  text: string
  fontSize: number
  color: string
}

export type FloorplanElement = WallItem | ZoneItem | LabelItem

const SCALE_FACTOR = 0.1

export function useFloorplanElements(roomId: string) {
  const { request } = useApi()
  const walls = ref<WallItem[]>([])
  const zones = ref<ZoneItem[]>([])
  const labels = ref<LabelItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function toCanvasX(dbMm: number): number { return dbMm * SCALE_FACTOR }
  function toCanvasY(dbMm: number): number { return dbMm * SCALE_FACTOR }
  function toDbX(px: number): number { return Math.round(px / SCALE_FACTOR) }
  function toDbY(px: number): number { return Math.round(px / SCALE_FACTOR) }

  async function fetchCsrfToken(): Promise<string | null> {
    const csrf = await request('/api/auth/csrf', { method: 'GET' })
    if (!csrf.ok) return null
    return csrf.headers.get('X-XSRF-TOKEN')
  }

  async function loadElements(): Promise<void> {
    loading.value = true
    error.value = null
    const result = await request<{ walls: WallItem[]; zones: ZoneItem[]; labels: LabelItem[] }>(
      `/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements`
    )
    if (result.ok) {
      walls.value = result.data.walls
      zones.value = result.data.zones
      labels.value = result.data.labels
    } else {
      error.value = result.error
    }
    loading.value = false
  }

  async function addWall(data: { x1: number; y1: number; x2: number; y2: number; color?: string; thickness?: number }): Promise<WallItem | null> {
    const token = await fetchCsrfToken()
    if (!token) return null
    const result = await request<WallItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/walls`, {
      method: 'POST', csrfToken: token, body: data,
    })
    if (result.ok) { walls.value.push(result.data); return result.data }
    error.value = result.error
    return null
  }

  async function updateWall(id: string, data: { x1: number; y1: number; x2: number; y2: number; color?: string; thickness?: number }): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request<WallItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/walls/${encodeURIComponent(id)}`, {
      method: 'PUT', csrfToken: token, body: data,
    })
    if (result.ok) {
      const idx = walls.value.findIndex(w => w.id === id)
      if (idx !== -1) walls.value[idx] = result.data
      return true
    }
    error.value = result.error
    return false
  }

  async function deleteWall(id: string): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/walls/${encodeURIComponent(id)}`, {
      method: 'DELETE', csrfToken: token,
    })
    if (result.ok) { walls.value = walls.value.filter(w => w.id !== id); return true }
    error.value = result.error
    return false
  }

  async function addZone(data: { x: number; y: number; width: number; height: number; name: string; color?: string; zoneType: string }): Promise<ZoneItem | null> {
    const token = await fetchCsrfToken()
    if (!token) return null
    const result = await request<ZoneItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/zones`, {
      method: 'POST', csrfToken: token, body: data,
    })
    if (result.ok) { zones.value.push(result.data); return result.data }
    error.value = result.error
    return null
  }

  async function updateZone(id: string, data: { x: number; y: number; width: number; height: number; name: string; color?: string; zoneType: string }): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request<ZoneItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/zones/${encodeURIComponent(id)}`, {
      method: 'PUT', csrfToken: token, body: data,
    })
    if (result.ok) {
      const idx = zones.value.findIndex(z => z.id === id)
      if (idx !== -1) zones.value[idx] = result.data
      return true
    }
    error.value = result.error
    return false
  }

  async function deleteZone(id: string): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/zones/${encodeURIComponent(id)}`, {
      method: 'DELETE', csrfToken: token,
    })
    if (result.ok) { zones.value = zones.value.filter(z => z.id !== id); return true }
    error.value = result.error
    return false
  }

  async function addLabel(data: { x: number; y: number; text: string; fontSize?: number; color?: string }): Promise<LabelItem | null> {
    const token = await fetchCsrfToken()
    if (!token) return null
    const result = await request<LabelItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/labels`, {
      method: 'POST', csrfToken: token, body: data,
    })
    if (result.ok) { labels.value.push(result.data); return result.data }
    error.value = result.error
    return null
  }

  async function updateLabel(id: string, data: { x: number; y: number; text: string; fontSize?: number; color?: string }): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request<LabelItem>(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/labels/${encodeURIComponent(id)}`, {
      method: 'PUT', csrfToken: token, body: data,
    })
    if (result.ok) {
      const idx = labels.value.findIndex(l => l.id === id)
      if (idx !== -1) labels.value[idx] = result.data
      return true
    }
    error.value = result.error
    return false
  }

  async function deleteLabel(id: string): Promise<boolean> {
    const token = await fetchCsrfToken()
    if (!token) return false
    const result = await request(`/api/rooms/${encodeURIComponent(roomId)}/floorplan-elements/labels/${encodeURIComponent(id)}`, {
      method: 'DELETE', csrfToken: token,
    })
    if (result.ok) { labels.value = labels.value.filter(l => l.id !== id); return true }
    error.value = result.error
    return false
  }

  return {
    walls, zones, labels, loading, error, loadElements,
    addWall, updateWall, deleteWall,
    addZone, updateZone, deleteZone,
    addLabel, updateLabel, deleteLabel,
    toCanvasX, toCanvasY, toDbX, toDbY,
  }
}
