import { ref, watch } from 'vue'
import { useApi } from './useApi'

export interface ConnectionEndpoint {
  deviceName: string
  portName: string
  rackCode: string
  roomName: string
}

export interface CableConnection {
  id: string
  source: ConnectionEndpoint
  target: ConnectionEndpoint
  cableType: string
  color: string | null
  status: string
  notes: string | null
}

export function cableTypeColor(type: string): string {
  const colors: Record<string, string> = {
    铜缆: '#e67e22',
    光纤: '#f1c40f',
    DAC: '#3498db',
  }
  return colors[type] ?? '#8b949e'
}

export function connectionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    normal: '正常',
    pending: '待确认',
    warning: '异常',
  }
  return labels[status] ?? status
}

export function useCableConnections(roomId: () => string | undefined, cableType: () => string | undefined) {
  const { request } = useApi()
  const connections = ref<CableConnection[]>([])
  const loading = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    const params = new URLSearchParams()
    const room = roomId()
    const type = cableType()
    if (room) params.set('roomId', room)
    if (type) params.set('cableType', type)
    const query = params.toString()
    const result = await request<{ connections: CableConnection[] }>(
      `/api/cables/connections${query ? `?${query}` : ''}`,
      { method: 'GET' },
    )
    connections.value = result.ok && result.data ? result.data.connections : []
    loading.value = false
  }

  watch(() => [roomId(), cableType()], () => { void load() }, { immediate: true })

  return { connections, loading, load }
}
