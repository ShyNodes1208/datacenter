import { ref, computed } from 'vue'
import { useApi } from './useApi'
import type { USlot } from '../components/RackFrontPanel.vue'

interface RackInfo {
  id: string
  code: string
  roomId: string
  roomName: string
  heightU: number
}

interface AvailabilityPosition {
  uNumber: number
  occupied: boolean
  serverName?: string
  serverId?: string
  deviceType?: string
  deviceHeight?: number
}

interface AvailabilityResponse {
  rackId: string
  rackCode: string
  heightU: number
  positions: AvailabilityPosition[]
}

interface DevicePositionsResponse {
  rack: {
    id: string
    code: string
    roomId: string
    roomName: string
    heightU: number
  }
}

export function useRackDetail(rackId: string) {
  const { request } = useApi()

  const rack = ref<RackInfo | null>(null)
  const error = ref('')
  const loading = ref(false)
  const serverOccupancy = ref<Map<number, { serverName: string; serverId: string; deviceType: string; deviceHeight: number }>>(new Map())

  const uSlots = computed<USlot[]>(() => {
    const positions = serverOccupancy.value
    if (!rack.value) return []

    const heightU = rack.value.heightU
    if (heightU <= 0) return []

    const slots: USlot[] = []
    let u = heightU

    while (u >= 1) {
      const info = positions.get(u)
      if (info) {
        const topU = u
        let bottomU = u

        while (bottomU - 1 >= 1 && positions.get(bottomU - 1)?.serverId === info.serverId) {
          bottomU--
        }

        const uCount = topU - bottomU + 1

        let ci = 0
        for (const prev of slots) {
          if (prev.occupied && prev.deviceType === info.deviceType) {
            ci++
          } else if (prev.occupied && prev.deviceType !== info.deviceType) {
            ci = 0
          }
        }

        slots.push({
          startU: topU,
          endU: bottomU,
          uCount,
          occupied: true,
          serverId: info.serverId,
          serverName: info.serverName,
          deviceType: info.deviceType,
          deviceHeight: info.deviceHeight,
          colorIndex: ci,
        })

        u = bottomU - 1
      } else {
        const topU = u
        let bottomU = u
        while (bottomU - 1 >= 1 && !positions.has(bottomU - 1)) {
          bottomU--
        }

        slots.push({
          startU: topU,
          endU: bottomU,
          uCount: topU - bottomU + 1,
          occupied: false,
          colorIndex: 0,
        })

        u = bottomU - 1
      }
    }

    return slots
  })

  const stats = computed(() => {
    if (!rack.value) return { total: 0, occupied: 0, empty: 0 }
    const total = rack.value.heightU
    let occupied = 0
    for (const slot of uSlots.value) {
      if (slot.occupied) occupied += slot.uCount
    }
    return { total, occupied, empty: total - occupied }
  })

  const rackedServerCount = computed(() => {
    const ids = new Set<string>()
    for (const info of serverOccupancy.value.values()) {
      ids.add(info.serverId)
    }
    return ids.size
  })

  async function loadData(): Promise<void> {
    error.value = ''
    loading.value = true

    const rackResult = await request<DevicePositionsResponse>(
      `/api/racks/${rackId}/device-positions`,
      { method: 'GET' },
    )
    if (!rackResult.ok) {
      error.value = rackResult.error
      loading.value = false
      return
    }

    rack.value = {
      id: rackResult.data.rack.id,
      code: rackResult.data.rack.code,
      roomId: rackResult.data.rack.roomId,
      roomName: rackResult.data.rack.roomName,
      heightU: rackResult.data.rack.heightU,
    }

    const availResult = await request<AvailabilityResponse>(
      `/api/racks/${rackId}/availability`,
      { method: 'GET' },
    )

    if (availResult.ok && availResult.data) {
      const map = new Map<number, { serverName: string; serverId: string; deviceType: string; deviceHeight: number }>()
      for (const pos of availResult.data.positions) {
        if (pos.occupied && pos.serverName && pos.serverId) {
          map.set(pos.uNumber, {
            serverName: pos.serverName,
            serverId: pos.serverId,
            deviceType: pos.deviceType ?? '未知',
            deviceHeight: pos.deviceHeight ?? 1,
          })
        }
      }
      serverOccupancy.value = map
    }

    loading.value = false
  }

  return {
    rack,
    uSlots,
    stats,
    loading,
    error,
    rackedServerCount,
    loadData,
  }
}
