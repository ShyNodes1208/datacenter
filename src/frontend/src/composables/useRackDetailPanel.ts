import { ref, watch, type Ref } from 'vue'
import { useApi } from './useApi'

export type DeviceOnRack = {
  id: string
  name: string
  deviceType: string
  startU: number
  endU: number
  uHeight: number
}

export type RackHistoryItem = {
  time: string
  deviceName: string
  action: string
  fromU: number | null
  toU: number | null
}

export type RackCableLink = {
  id: string
  portName: string
  remoteDevice: string
  remoteRack: string
}

export interface RackDetail {
  rack: { id: string; code: string; heightU: number; brand: string; power: string; notes: string }
  devices: DeviceOnRack[]
  occupancy: { usedU: number; freeU: number; totalU: number }
  positionHistory: RackHistoryItem[]
  cables: RackCableLink[]
}

export function useRackDetailPanel(rackId: Ref<string | null>) {
  const { request } = useApi()
  const detail = ref<RackDetail | null>(null)
  const loading = ref(false)
  const loadError = ref('')

  async function load(id: string): Promise<void> {
    loading.value = true
    loadError.value = ''
    detail.value = null

    const result = await request<RackDetail>(`/api/racks/${encodeURIComponent(id)}/detail`, {
      method: 'GET',
    })

    loading.value = false
    if (result.ok && result.data) {
      detail.value = result.data
      return
    }

    loadError.value = result.ok ? 'Request failed.' : result.error
  }

  watch(
    rackId,
    (id) => {
      if (!id) {
        detail.value = null
        loadError.value = ''
        return
      }
      void load(id)
    },
    { immediate: true },
  )

  return { detail, loading, loadError, load }
}
