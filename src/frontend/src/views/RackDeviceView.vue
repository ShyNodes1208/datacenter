<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'

type RackInfo = {
  id: string
  code: string
  roomName: string
  heightU: number
  x: number
  y: number
  z: number
}

type UPosition = {
  uNumber: number
  label: string | null
  uHeight: number
}

type RackStats = {
  total: number
  occupied: number
  empty: number
}

type DevicePositionsData = {
  rack: RackInfo
  positions: UPosition[]
  stats: RackStats
}

type ImportResult = {
  rackId: string
  rackCode: string
  totalUPositions: number
  occupied: number
  empty: number
  errors?: string[]
}

type AvailableServer = {
  id: string
  name: string
  deviceHeight: number
  deviceType: string
}

type RackResult = {
  serverPositionId: string
  serverName: string
  rackCode: string
  startU: number
  endU: number
}

type ServerOccupancyItem = {
  uNumber: number
  occupied: boolean
  serverName?: string
  serverId?: string
}

type MoveResult = {
  serverPositionId: string
  serverName: string
  fromRackCode: string
  toRackCode: string
  startU: number
  endU: number
}

type RackOption = {
  id: string
  code: string
  roomName: string
  heightU: number
}

const EDIT_ROLES = ['机房管理员', '运维人员']

const route = useRoute()
const router = useRouter()
const { request } = useApi()
const { user } = useAuth()

const rackId = computed(() => route.params.id as string)

const canEdit = computed(() => {
  const role = user.value?.role
  return role !== undefined && EDIT_ROLES.includes(role)
})

const data = ref<DevicePositionsData | null>(null)
const error = ref('')
const importVisible = ref(false)
const importError = ref('')
const importResult = ref<ImportResult | null>(null)
const importSubmitting = ref(false)

const rackVisible = ref(false)
const rackError = ref('')
const rackSubmitting = ref(false)
const availableServers = ref<AvailableServer[]>([])
const selectedServerId = ref('')
const rackStartU = ref<number | null>(null)
const loadingServers = ref(false)

const serverOccupancy = ref<Map<number, { serverName: string; serverId: string }>>(new Map())

const moveVisible = ref(false)
const moveError = ref('')
const moveSubmitting = ref(false)
const movingServerId = ref('')
const movingServerName = ref('')
const movingServerHeight = ref(0)
const moveRackId = ref('')
const moveStartU = ref<number | null>(null)
const rackOptions = ref<RackOption[]>([])
const loadingRacks = ref(false)

const decommissionVisible = ref(false)
const decommissionError = ref('')
const decommissionSubmitting = ref(false)
const decommissioningServerId = ref('')
const decommissioningServerName = ref('')

const deleteRackSubmitting = ref(false)
const deleteRackError = ref('')

async function loadData(): Promise<void> {
  error.value = ''

  const result = await request<DevicePositionsData>(
    `/api/racks/${rackId.value}/device-positions`,
    { method: 'GET' },
  )

  if (!result.ok) {
    error.value = result.error
    return
  }

  data.value = result.data

  const availResult = await request<{ positions: ServerOccupancyItem[] }>(
    `/api/racks/${rackId.value}/availability`,
    { method: 'GET' },
  )

  if (availResult.ok && availResult.data) {
    const map = new Map<number, { serverName: string; serverId: string }>()
    for (const pos of availResult.data.positions) {
      if (pos.occupied && pos.serverName && pos.serverId) {
        map.set(pos.uNumber, { serverName: pos.serverName, serverId: pos.serverId })
      }
    }
    serverOccupancy.value = map
  }
}

onMounted(() => {
  void loadData()
})

function openImport(): void {
  importVisible.value = true
  importResult.value = null
  importError.value = ''
}

function cancelImport(): void {
  importVisible.value = false
  importResult.value = null
  importError.value = ''
}

async function handleFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importError.value = ''

  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) {
    importError.value = csrfResult.error
    return
  }
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) {
    importError.value = 'Request failed.'
    return
  }

  importSubmitting.value = true
  const formData = new FormData()
  formData.append('file', file)

  let response: Response
  try {
    response = await fetch(`/api/racks/${rackId.value}/device-positions/import`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': token },
      body: formData,
    })
  } catch {
    importError.value = 'Request failed.'
    importSubmitting.value = false
    return
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    importError.value = ((body as Record<string, unknown>).error as string) || '导入失败'
    importSubmitting.value = false
    return
  }

  importResult.value = (await response.json()) as ImportResult
  importSubmitting.value = false
  await loadData()
}

function closeResult(): void {
  importVisible.value = false
  importResult.value = null
}

async function loadAvailableServers(): Promise<void> {
  loadingServers.value = true
  availableServers.value = []

  const params = new URLSearchParams()
  params.set('positionStatus', '未上架')
  params.append('positionStatus', '已下架')

  const result = await request<unknown>(`/api/servers?${params.toString()}`, { method: 'GET' })
  loadingServers.value = false

  if (!result.ok) {
    rackError.value = result.error
    return
  }

  if (!Array.isArray(result.data)) {
    rackError.value = 'Request failed.'
    return
  }

  const parsed: AvailableServer[] = []
  for (const item of result.data) {
    if (item === null || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (
      typeof record.id === 'string' &&
      typeof record.name === 'string' &&
      typeof record.deviceHeight === 'number' &&
      typeof record.deviceType === 'string'
    ) {
      parsed.push({
        id: record.id,
        name: record.name,
        deviceHeight: record.deviceHeight,
        deviceType: record.deviceType,
      })
    }
  }
  availableServers.value = parsed
}

async function openRack(): Promise<void> {
  rackVisible.value = true
  rackError.value = ''
  selectedServerId.value = ''
  rackStartU.value = null
  await loadAvailableServers()
}

function cancelRack(): void {
  rackVisible.value = false
  rackError.value = ''
  selectedServerId.value = ''
  rackStartU.value = null
  availableServers.value = []
}

async function confirmRack(): Promise<void> {
  const server = selectedServer.value
  const start = rackStartU.value
  if (!server || start === null || start < 1 || !data.value) return

  const validation = rackValidation.value
  if (validation) {
    rackError.value = validation
    return
  }

  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) {
    rackError.value = csrfResult.error
    return
  }
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) {
    rackError.value = 'Request failed.'
    return
  }

  rackSubmitting.value = true
  rackError.value = ''

  const result = await request<RackResult>(`/api/servers/${server.id}/rack`, {
    method: 'POST',
    body: { rackId: data.value.rack.id, startU: start },
    csrfToken: token,
  })

  rackSubmitting.value = false

  if (!result.ok) {
    rackError.value = result.error
    return
  }

  rackVisible.value = false
  selectedServerId.value = ''
  rackStartU.value = null
  availableServers.value = []
  await loadData()
}

const usagePercent = computed(() => {
  if (!data.value || data.value.stats.total === 0) return 0
  return Math.round((data.value.stats.occupied / data.value.stats.total) * 100)
})

const occupiedUNumbers = computed(() => {
  if (!data.value) return new Set<number>()
  const occupied = new Set<number>()
  for (const pos of data.value.positions) {
    if (pos.label !== null) {
      if (pos.uHeight > 1) {
        const bottom = pos.uNumber - pos.uHeight + 1
        for (let u = bottom; u <= pos.uNumber; u++) {
          occupied.add(u)
        }
      } else {
        occupied.add(pos.uNumber)
      }
    }
  }
  return occupied
})

const selectedServer = computed(() => {
  if (!selectedServerId.value || !availableServers.value.length) return null
  return availableServers.value.find((s) => s.id === selectedServerId.value) ?? null
})

const computedEndU = computed(() => {
  const server = selectedServer.value
  const start = rackStartU.value
  if (!server || start === null || start < 1) return null
  return start + server.deviceHeight - 1
})

const rackValidation = computed(() => {
  const server = selectedServer.value
  const start = rackStartU.value
  if (!server || start === null || start < 1 || !data.value) return null

  const height = server.deviceHeight
  const rackHeight = data.value.rack.heightU
  const endU = start + height - 1

  if (start < 1) return '起始 U 位必须大于等于 1'
  if (endU > rackHeight) return `服务器高度 ${height}U 超出机柜范围（U${start}-U${endU} 超过 U${rackHeight}）`

  for (let u = start; u <= endU; u++) {
    if (occupiedUNumbers.value.has(u)) {
      return `U${u} 已被占用`
    }
  }

  return null
})

/**
 * Build visual groups for U44-at-top display.
 *
 * - Backend positions arrive descending (U44 → U1); merge and keep that order.
 * - startU is the higher U number, endU is the lower (merge convention).
 * - Display labels list each U descending (higher/top first) inside the block.
 * - Multi-U devices and same-server occupancy merge into one blue block.
 */
const mergedPositions = computed(() => {
  if (!data.value) return []
  const positions = data.value.positions
  if (positions.length === 0) return []

  const occupancy = serverOccupancy.value
  const merged: Array<{ startU: number; endU: number; label: string | null }> = []
  let i = 0

  while (i < positions.length) {
    const pos = positions[i]

    if (pos.uHeight > 1) {
      const topU = pos.uNumber
      const bottomU = pos.uNumber - pos.uHeight + 1
      merged.push({ startU: topU, endU: bottomU, label: pos.label })
      while (i + 1 < positions.length && positions[i + 1].uNumber >= bottomU) {
        i++
      }
      i++
    } else if (pos.label !== null) {
      let topU = pos.uNumber
      let bottomU = pos.uNumber
      const label = pos.label
      i++
      while (
        i < positions.length &&
        positions[i].label === label &&
        positions[i].uHeight === 1 &&
        positions[i].uNumber === bottomU - 1
      ) {
        bottomU = positions[i].uNumber
        i++
      }
      merged.push({ startU: topU, endU: bottomU, label })
    } else {
      const serverInfo = occupancy.get(pos.uNumber)
      if (serverInfo) {
        let topU = pos.uNumber
        let bottomU = pos.uNumber
        const serverId = serverInfo.serverId
        i++
        while (
          i < positions.length &&
          positions[i].label === null &&
          positions[i].uHeight === 1 &&
          positions[i].uNumber === bottomU - 1 &&
          occupancy.get(positions[i].uNumber)?.serverId === serverId
        ) {
          bottomU = positions[i].uNumber
          i++
        }
        merged.push({ startU: topU, endU: bottomU, label: serverInfo.serverName })
      } else {
        merged.push({ startU: pos.uNumber, endU: pos.uNumber, label: null })
        i++
      }
    }
  }

  // U44 at top of the rack view (backend descending order)
  return merged
})

/** U numbers in a merged block, top-to-bottom (U44 direction = descending). */
function groupUNumbers(group: { startU: number; endU: number }): number[] {
  const lo = Math.min(group.startU, group.endU)
  const hi = Math.max(group.startU, group.endU)
  const nums: number[] = []
  for (let u = hi; u >= lo; u--) {
    nums.push(u)
  }
  return nums
}

function groupUCount(group: { startU: number; endU: number }): number {
  return Math.abs(group.startU - group.endU) + 1
}

/**
 * Maps merged-group startU to racked-server actions.
 * Server name is already on the block label; this only supplies serverId
 * and whether move/decommission buttons should show (at the server's topU).
 */
const groupServerMap = computed(() => {
  const result = new Map<
    number,
    { serverId: string; serverName: string; showActions: boolean }
  >()
  if (!data.value) return result

  const serverTopU = new Map<string, number>()
  for (const [u, info] of serverOccupancy.value) {
    const current = serverTopU.get(info.serverId)
    if (current === undefined || u > current) {
      serverTopU.set(info.serverId, u)
    }
  }

  for (const group of mergedPositions.value) {
    const lo = Math.min(group.startU, group.endU)
    const hi = Math.max(group.startU, group.endU)
    for (let u = lo; u <= hi; u++) {
      const info = serverOccupancy.value.get(u)
      if (info) {
        const topU = serverTopU.get(info.serverId) ?? u
        result.set(group.startU, {
          serverId: info.serverId,
          serverName: info.serverName,
          showActions: topU >= lo && topU <= hi,
        })
        break
      }
    }
  }
  return result
})

const rackedServerCount = computed(() => {
  const ids = new Set<string>()
  for (const info of serverOccupancy.value.values()) {
    ids.add(info.serverId)
  }
  return ids.size
})

async function openMove(serverId: string, serverName: string): Promise<void> {
  moveVisible.value = true
  moveError.value = ''
  movingServerId.value = serverId
  movingServerName.value = serverName
  moveRackId.value = ''
  moveStartU.value = null
  movingServerHeight.value = 0
  rackOptions.value = []
  loadingRacks.value = true

  const racksResult = await request<RackOption[]>('/api/racks', { method: 'GET' })
  loadingRacks.value = false
  if (racksResult.ok && racksResult.data) {
    rackOptions.value = racksResult.data
  }

  const serverResult = await request<{ deviceHeight: number }>(`/api/servers/${serverId}`, { method: 'GET' })
  if (serverResult.ok && serverResult.data) {
    movingServerHeight.value = serverResult.data.deviceHeight
  }
}

function cancelMove(): void {
  moveVisible.value = false
  moveError.value = ''
  movingServerId.value = ''
  movingServerName.value = ''
  moveRackId.value = ''
  moveStartU.value = null
}

const moveEndU = computed(() => {
  if (moveStartU.value === null || moveStartU.value < 1 || movingServerHeight.value < 1) return null
  return moveStartU.value + movingServerHeight.value - 1
})

const selectedRackHeight = computed(() => {
  if (!moveRackId.value) return 0
  const rack = rackOptions.value.find(r => r.id === moveRackId.value)
  return rack ? rack.heightU : 0
})

const moveValidation = computed(() => {
  const start = moveStartU.value
  if (start === null || start < 1) return null
  if (!moveRackId.value) return null
  if (movingServerHeight.value < 1) return null

  const endU = start + movingServerHeight.value - 1
  const rackHeight = selectedRackHeight.value

  if (start < 1) return '起始 U 位必须大于等于 1'
  if (endU > rackHeight) return `服务器高度 ${movingServerHeight.value}U 超出机柜范围（U${start}-U${endU} 超过 U${rackHeight}）`

  return null
})

async function confirmMove(): Promise<void> {
  if (!movingServerId.value || !moveRackId.value || moveStartU.value === null || moveStartU.value < 1) return
  if (moveValidation.value) return

  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) {
    moveError.value = csrfResult.error
    return
  }
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) {
    moveError.value = 'Request failed.'
    return
  }

  moveSubmitting.value = true
  moveError.value = ''

  const result = await request<MoveResult>(`/api/servers/${movingServerId.value}/move`, {
    method: 'POST',
    body: { rackId: moveRackId.value, startU: moveStartU.value },
    csrfToken: token,
  })

  moveSubmitting.value = false

  if (!result.ok) {
    moveError.value = result.error
    return
  }

  moveVisible.value = false
  await loadData()
}

function openDecommission(serverId: string, serverName: string): void {
  decommissionVisible.value = true
  decommissionError.value = ''
  decommissioningServerId.value = serverId
  decommissioningServerName.value = serverName
}

function cancelDecommission(): void {
  decommissionVisible.value = false
  decommissionError.value = ''
  decommissioningServerId.value = ''
  decommissioningServerName.value = ''
}

async function confirmDecommission(): Promise<void> {
  if (!decommissioningServerId.value) return

  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) {
    decommissionError.value = csrfResult.error
    return
  }
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) {
    decommissionError.value = 'Request failed.'
    return
  }

  decommissionSubmitting.value = true
  decommissionError.value = ''

  const result = await request(`/api/servers/${decommissioningServerId.value}/decommission`, {
    method: 'POST',
    body: {},
    csrfToken: token,
  })

  decommissionSubmitting.value = false

  if (!result.ok) {
    decommissionError.value = result.error
    return
  }

  decommissionVisible.value = false
  await loadData()
}

async function deleteRack(): Promise<void> {
  if (!data.value || deleteRackSubmitting.value) return
  if (!window.confirm(`确认删除机柜「${data.value.rack.code}」？`)) return

  deleteRackSubmitting.value = true
  deleteRackError.value = ''

  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) {
    deleteRackError.value = csrfResult.error
    deleteRackSubmitting.value = false
    return
  }
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) {
    deleteRackError.value = 'Request failed.'
    deleteRackSubmitting.value = false
    return
  }

  const result = await request(`/api/racks/${rackId.value}`, {
    method: 'DELETE',
    csrfToken: token,
  })

  deleteRackSubmitting.value = false

  if (!result.ok) {
    deleteRackError.value = result.error
    return
  }

  await router.push('/')
}
</script>

<template>
  <div>
    <div v-if="error" role="alert" aria-live="polite">{{ error }}</div>

    <template v-if="data">
      <p>
        <a href="/" @click.prevent="router.push('/')">机房列表</a>
        &gt; {{ data.rack.roomName }} &gt; {{ data.rack.code }}
      </p>

      <p>
        U 位总数：{{ data.stats.total }} |
        已占用：{{ data.stats.occupied }} |
        空闲：{{ data.stats.empty }} |
        使用率：{{ usagePercent }}%
        <span style="color: #888; font-size: 0.85em"> | 在架服务器：{{ rackedServerCount }}</span>
      </p>

      <button type="button" @click="openImport">导入设备</button>
      <button v-if="canEdit" type="button" @click="openRack" style="margin-left: 0.5em">上架服务器</button>
      <button
        v-if="canEdit"
        type="button"
        :disabled="deleteRackSubmitting"
        @click="deleteRack"
        style="margin-left: 0.5em"
      >
        {{ deleteRackSubmitting ? '删除中...' : '删除机柜' }}
      </button>
      <div v-if="deleteRackError" role="alert" aria-live="polite" style="color: red; margin-top: 0.5em">
        {{ deleteRackError }}
      </div>

      <div v-if="importVisible" style="margin-top: 1em; padding: 1em; border: 1px solid #ccc">
        <template v-if="!importResult">
          <input type="file" accept=".xlsx" @change="handleFileChange" />
          <div v-if="importError" role="alert" aria-live="polite">{{ importError }}</div>
          <br />
          <button type="button" :disabled="importSubmitting" @click="cancelImport">取消</button>
        </template>
        <template v-else>
          <p>导入完成：{{ importResult.occupied }} 个 U 位有设备，{{ importResult.empty }} 个空闲</p>
          <div v-if="importResult.errors?.length">
            <p v-for="(err, i) in importResult.errors" :key="i" style="color: red">{{ err }}</p>
          </div>
          <button type="button" @click="closeResult">关闭</button>
        </template>
      </div>

      <div v-if="rackVisible" style="margin-top: 1em; padding: 1em; border: 1px solid #ccc">
        <h4 style="margin: 0 0 0.5em">上架服务器</h4>

        <div v-if="loadingServers">加载服务器列表...</div>

        <template v-else>
          <div style="margin-bottom: 0.5em">
            <label>
              选择服务器：
              <select v-model="selectedServerId">
                <option value="" disabled>请选择服务器</option>
                <option v-for="s in availableServers" :key="s.id" :value="s.id">
                  {{ s.name }} ({{ s.deviceType }} {{ s.deviceHeight }}U)
                </option>
              </select>
            </label>
            <span v-if="availableServers.length === 0 && !loadingServers" style="color: #999; margin-left: 0.5em">
              暂无可上架服务器
            </span>
          </div>

          <div v-if="selectedServer" style="margin-bottom: 0.5em">
            <p style="margin: 0.25em 0">设备类型：{{ selectedServer.deviceType }}</p>
            <p style="margin: 0.25em 0">设备高度：{{ selectedServer.deviceHeight }}U</p>
          </div>

          <div style="margin-bottom: 0.5em">
            <label>
              起始 U 位：
              <input v-model.number="rackStartU" type="number" min="1" :max="data.rack.heightU" style="width: 80px" />
            </label>
          </div>

          <div v-if="selectedServer && rackStartU !== null && rackStartU >= 1 && computedEndU !== null" style="margin-bottom: 0.5em">
            <p style="margin: 0.25em 0">
              占用范围：U{{ rackStartU }}-U{{ computedEndU }}（{{ selectedServer.deviceHeight }}U）
            </p>
          </div>

          <div v-if="rackValidation" style="color: red; margin-bottom: 0.5em" role="alert" aria-live="polite">
            {{ rackValidation }}
          </div>
          <div v-if="rackError" style="color: red; margin-bottom: 0.5em" role="alert" aria-live="polite">
            {{ rackError }}
          </div>

          <div>
            <button
              type="button"
              :disabled="rackSubmitting || !selectedServer || rackStartU === null || rackStartU < 1 || rackValidation !== null"
              @click="confirmRack"
            >
              {{ rackSubmitting ? '上架中...' : '确认上架' }}
            </button>
            <button type="button" :disabled="rackSubmitting" @click="cancelRack" style="margin-left: 0.5em">
              取消
            </button>
          </div>
        </template>
      </div>

      <div v-if="moveVisible" style="margin-top: 1em; padding: 1em; border: 1px solid #ccc">
        <h4 style="margin: 0 0 0.5em">移动服务器</h4>
        <p style="margin: 0.25em 0">服务器：{{ movingServerName }}</p>

        <div v-if="loadingRacks">加载机柜列表...</div>

        <template v-else>
          <div style="margin-bottom: 0.5em">
            <label>
              目标机柜：
              <select v-model="moveRackId">
                <option value="" disabled>请选择机柜</option>
                <option v-for="r in rackOptions" :key="r.id" :value="r.id">
                  {{ r.code }} ({{ r.roomName }} {{ r.heightU }}U)
                </option>
              </select>
            </label>
          </div>

          <div v-if="moveRackId" style="margin-bottom: 0.5em">
            <p style="margin: 0.25em 0">设备高度：{{ movingServerHeight }}U</p>
          </div>

          <div style="margin-bottom: 0.5em">
            <label>
              起始 U 位：
              <input v-model.number="moveStartU" type="number" min="1" :max="selectedRackHeight" style="width: 80px" />
            </label>
          </div>

          <div v-if="moveStartU !== null && moveStartU >= 1 && moveEndU !== null && moveRackId" style="margin-bottom: 0.5em">
            <p style="margin: 0.25em 0">
              占用范围：U{{ moveStartU }}-U{{ moveEndU }}（{{ movingServerHeight }}U）
            </p>
          </div>

          <div v-if="moveValidation" style="color: red; margin-bottom: 0.5em" role="alert" aria-live="polite">
            {{ moveValidation }}
          </div>
          <div v-if="moveError" style="color: red; margin-bottom: 0.5em" role="alert" aria-live="polite">
            {{ moveError }}
          </div>

          <div>
            <button
              type="button"
              :disabled="moveSubmitting || !moveRackId || moveStartU === null || moveStartU < 1 || moveValidation !== null"
              @click="confirmMove"
            >
              {{ moveSubmitting ? '移动中...' : '确认移动' }}
            </button>
            <button type="button" :disabled="moveSubmitting" @click="cancelMove" style="margin-left: 0.5em">
              取消
            </button>
          </div>
        </template>
      </div>

      <div v-if="decommissionVisible" style="margin-top: 1em; padding: 1em; border: 1px solid #ccc">
        <h4 style="margin: 0 0 0.5em">下架服务器</h4>
        <p style="margin: 0.25em 0">确认将服务器 <strong>{{ decommissioningServerName }}</strong> 下架？</p>
        <p style="margin: 0.25em 0; color: #666; font-size: 0.9em">下架后 U 位将释放，服务器记录保留。</p>

        <div v-if="decommissionError" style="color: red; margin-bottom: 0.5em" role="alert" aria-live="polite">
          {{ decommissionError }}
        </div>

        <div style="margin-top: 0.75em">
          <button
            type="button"
            :disabled="decommissionSubmitting"
            @click="confirmDecommission"
          >
            {{ decommissionSubmitting ? '下架中...' : '确认下架' }}
          </button>
          <button type="button" :disabled="decommissionSubmitting" @click="cancelDecommission" style="margin-left: 0.5em">
            取消
          </button>
        </div>
      </div>

      <div style="margin-top: 1em; display: flex; gap: 1em">
        <!-- U-position rack view (left) -->
        <div style="flex: 1; border: 2px solid #333; max-width: 400px">
          <div
            v-for="group in mergedPositions"
            :key="`${group.startU}-${group.endU}`"
            :style="{
              height: `${groupUCount(group) * 20}px`,
              backgroundColor: group.label ? '#b3d9ff' : '#e0ffe0',
              borderBottom: '1px solid #ccc',
              display: 'flex',
              alignItems: 'stretch',
              padding: '0 8px',
              fontSize: '12px',
              overflow: 'hidden',
            }"
          >
            <div style="display: flex; flex-direction: column; min-width: 40px; flex-shrink: 0">
              <span
                v-for="u in groupUNumbers(group)"
                :key="u"
                style="height: 20px; line-height: 20px; font-weight: bold"
              >U{{ u }}</span>
            </div>
            <span
              v-if="group.label"
              style="flex: 1; margin-left: 8px; display: flex; align-items: center; justify-content: center; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis"
            >
              {{ group.label }}
            </span>
            <div
              v-if="groupServerMap.has(group.startU) && groupServerMap.get(group.startU)!.showActions && canEdit"
              style="display: flex; align-self: flex-start; flex-shrink: 0; width: 72px; justify-content: flex-end; gap: 2px; padding-top: 1px"
            >
              <button
                type="button"
                @click.stop="openMove(groupServerMap.get(group.startU)!.serverId, groupServerMap.get(group.startU)!.serverName)"
                style="font-size: 10px; padding: 1px 4px"
              >移动</button>
              <button
                type="button"
                @click.stop="openDecommission(groupServerMap.get(group.startU)!.serverId, groupServerMap.get(group.startU)!.serverName)"
                style="font-size: 10px; padding: 1px 4px"
              >下架</button>
            </div>
          </div>
        </div>

        <!-- Stats panel (right) -->
        <div style="width: 200px; padding: 1em; border: 1px solid #ccc; align-self: flex-start">
          <h3>容量统计</h3>
          <p>U 位总数：{{ data.stats.total }}</p>
          <p>已占用：{{ data.stats.occupied }}</p>
          <p>空闲：{{ data.stats.empty }}</p>
          <p>使用率：{{ usagePercent }}%</p>
          <div style="background: #eee; height: 20px; border-radius: 4px; overflow: hidden">
            <div
              :style="{
                width: `${usagePercent}%`,
                height: '100%',
                backgroundColor: '#4a90d9',
                transition: 'width 0.3s',
              }"
            ></div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
