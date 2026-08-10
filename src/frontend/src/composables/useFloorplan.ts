import { ref } from 'vue'
import { useApi } from './useApi'

export type RackItem = {
  id: string
  code: string
  roomId: string
  roomName: string
  heightU: number
  occupiedU?: number
  brand: string | null
  power: number | null
  notes: string | null
  x: number
  y: number
  z: number
  status?: string
}

export const SCALE_FACTOR = 0.1

export function useFloorplan(roomId: string) {
  const { request } = useApi()
  const racks = ref<RackItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function toCanvasX(dbMm: number): number { return dbMm * SCALE_FACTOR }
  function toCanvasY(dbMm: number): number { return dbMm * SCALE_FACTOR }
  function toDbX(px: number): number { return Math.round(px / SCALE_FACTOR) }
  function toDbY(px: number): number { return Math.round(px / SCALE_FACTOR) }

  async function loadRacks(): Promise<void> {
    loading.value = true
    error.value = null
    const result = await request<RackItem[]>(`/api/racks?roomId=${encodeURIComponent(roomId)}`)
    if (result.ok) { racks.value = result.data }
    else { error.value = result.error }
    loading.value = false
  }

  return { racks, loading, error, loadRacks, toCanvasX, toCanvasY, toDbX, toDbY, scaleFactor: SCALE_FACTOR }
}
