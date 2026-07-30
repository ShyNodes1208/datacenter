import { ref } from 'vue'
import { useApi } from './useApi'

export interface DashboardStats {
  totalRooms: number
  totalRacks: number
  totalU: number
  occupiedU: number
  usagePercent: number
  rackedServers: number
}

export interface RoomItem {
  id: string
  name: string
  status: string
}

export function useDashboard() {
  const { request } = useApi()

  const stats = ref<DashboardStats | null>(null)
  const rooms = ref<RoomItem[] | null>(null)
  const loading = ref(false)
  const error = ref('')

  async function loadStats(): Promise<void> {
    const result = await request<DashboardStats>('/api/dashboard/stats', { method: 'GET' })
    if (!result.ok) {
      error.value = result.error
      stats.value = null
      return
    }
    const data = result.data
    if (
      data &&
      typeof data.totalRooms === 'number' &&
      typeof data.totalRacks === 'number' &&
      typeof data.usagePercent === 'number'
    ) {
      stats.value = data
    } else {
      stats.value = null
    }
  }

  async function loadRooms(): Promise<void> {
    error.value = ''
    const result = await request<unknown>('/api/rooms', { method: 'GET' })
    if (!result.ok) {
      error.value = result.error
      rooms.value = null
      return
    }
    if (!Array.isArray(result.data)) {
      error.value = 'Request failed.'
      rooms.value = null
      return
    }
    const parsed: RoomItem[] = []
    for (const item of result.data) {
      if (item === null || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      if (
        typeof record.id === 'string' &&
        typeof record.name === 'string' &&
        typeof record.status === 'string'
      ) {
        parsed.push({ id: record.id, name: record.name, status: record.status })
      }
    }
    rooms.value = parsed
  }

  return { stats, rooms, loading, error, loadStats, loadRooms }
}
