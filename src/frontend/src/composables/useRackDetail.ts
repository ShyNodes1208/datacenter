import { ref, computed } from 'vue'
import { useApi } from './useApi'
import type { USlot } from '../components/RackFrontPanel.vue'

interface RackInfo {
  id: string
  code: string
  roomId: string
  roomName: string
  heightU: number
  status: string
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

interface RackListItem {
  id: string
  status?: string
}

export function buildUSlotsFromOccupancy(
  occupancy: Map<number, { serverName: string; serverId?: string; deviceType: string; deviceHeight: number }>,
  heightU: number,
): USlot[] {
  if (heightU <= 0) return []

  const slots: USlot[] = []
  let u = heightU

  while (u >= 1) {
    const info = occupancy.get(u)
    if (info) {
      const topU = u
      let bottomU = u
      const mergeKey = info.serverId ?? info.serverName

      while (bottomU - 1 >= 1) {
        const below = occupancy.get(bottomU - 1)
        if (!below) break
        const belowKey = below.serverId ?? below.serverName
        if (belowKey !== mergeKey) break
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
      while (bottomU - 1 >= 1 && !occupancy.has(bottomU - 1)) {
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
}

export function buildUSlotsFromSummaryPositions(
  positions: Array<{ uNumber: number; occupied: boolean; serverName?: string; deviceType?: string; deviceHeight?: number }>,
  heightU: number,
): USlot[] {
  const map = new Map<number, { serverName: string; serverId?: string; deviceType: string; deviceHeight: number }>()
  for (const pos of positions) {
    if (pos.occupied && pos.serverName) {
      map.set(pos.uNumber, {
        serverName: pos.serverName,
        deviceType: pos.deviceType ?? '未知',
        deviceHeight: pos.deviceHeight ?? 1,
      })
    }
  }
  return buildUSlotsFromOccupancy(map, heightU)
}

export function findAvailableURanges(
  slots: USlot[],
  requiredU: number,
): Array<{ startU: number; endU: number; length: number }> {
  if (!Number.isInteger(requiredU) || requiredU <= 0) return []

  return slots
    .filter((slot) => !slot.occupied && slot.uCount >= requiredU)
    .map((slot) => ({
      startU: slot.startU,
      endU: slot.endU,
      length: slot.uCount,
    }))
}

export function useRackDetail(rackId: string) {
  const { request } = useApi()

  const rack = ref<RackInfo | null>(null)
  const error = ref('')
  const loading = ref(false)
  const serverOccupancy = ref<Map<number, { serverName: string; serverId: string; deviceType: string; deviceHeight: number }>>(new Map())

  const uSlots = computed<USlot[]>(() => {
    if (!rack.value) return []
    return buildUSlotsFromOccupancy(serverOccupancy.value, rack.value.heightU)
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

    const roomId = rackResult.data.rack.roomId
    let status = '未知'
    const listResult = await request<RackListItem[]>(
      `/api/racks?roomId=${encodeURIComponent(roomId)}`,
      { method: 'GET' },
    )
    if (listResult.ok && Array.isArray(listResult.data)) {
      const match = listResult.data.find((item) => item.id === rackId)
      if (match && typeof match.status === 'string') {
        status = match.status
      }
    }

    rack.value = {
      id: rackResult.data.rack.id,
      code: rackResult.data.rack.code,
      roomId,
      roomName: rackResult.data.rack.roomName,
      heightU: rackResult.data.rack.heightU,
      status,
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
