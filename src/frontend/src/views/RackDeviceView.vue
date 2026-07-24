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

type ImportPreviewPosition = {
  uNumber: number
  label: string
  uHeight: number
}

type ImportPreview = {
  rackId: string
  rackCode: string
  totalUPositions: number
  occupied: number
  empty: number
  positions: ImportPreviewPosition[]
  errors?: string[]
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
const importPreview = ref<ImportPreview | null>(null)
const importFile = ref<File | null>(null)
const importResult = ref<ImportResult | null>(null)
const importSubmitting = ref(false)
const importPreviewLoading = ref(false)

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
  importPreview.value = null
  importFile.value = null
  importResult.value = null
  importError.value = ''
}

function cancelImport(): void {
  importVisible.value = false
  importPreview.value = null
  importFile.value = null
  importResult.value = null
  importError.value = ''
}

async function fetchImportCsrfToken(): Promise<string | null> {
  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) {
    importError.value = csrfResult.error
    return null
  }
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) {
    importError.value = 'Request failed.'
    return null
  }
  return token
}

async function uploadPreview(file: File): Promise<void> {
  importError.value = ''
  importPreview.value = null
  importFile.value = null
  importPreviewLoading.value = true

  const token = await fetchImportCsrfToken()
  if (!token) {
    importPreviewLoading.value = false
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  let response: Response
  try {
    response = await fetch(`/api/racks/${rackId.value}/device-positions/import-preview`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': token },
      body: formData,
    })
  } catch {
    importError.value = 'Request failed.'
    importPreviewLoading.value = false
    return
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    importError.value = ((body as Record<string, unknown>).error as string) || '预览失败'
    importPreviewLoading.value = false
    return
  }

  importPreview.value = (await response.json()) as ImportPreview
  importFile.value = file
  importPreviewLoading.value = false
}

async function submitImport(): Promise<void> {
  if (!importFile.value || importSubmitting.value) return

  importSubmitting.value = true
  importError.value = ''

  const token = await fetchImportCsrfToken()
  if (!token) {
    importSubmitting.value = false
    return
  }

  const formData = new FormData()
  formData.append('file', importFile.value)

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
  importPreview.value = null
  importFile.value = null
  await loadData()
  importSubmitting.value = false
}

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void uploadPreview(file)
}

function closeResult(): void {
  importVisible.value = false
  importPreview.value = null
  importFile.value = null
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
  <div class="rack-page">
    <div v-if="error" class="error" role="alert" aria-live="polite">{{ error }}</div>

    <template v-if="data">
      <div class="toolbar">
        <div class="toolbar__left">
          <p class="breadcrumb">
            <a href="/" @click.prevent="router.push('/')">机房列表</a>
            &gt; {{ data.rack.roomName }} &gt; {{ data.rack.code }}
          </p>
          <p class="toolbar__stats">
            U 位总数：{{ data.stats.total }} |
            已占用：{{ data.stats.occupied }} |
            空闲：{{ data.stats.empty }} |
            使用率：{{ usagePercent }}%
            <span class="muted"> | 在架服务器：{{ rackedServerCount }}</span>
          </p>
        </div>
        <div class="toolbar__actions">
          <button type="button" class="btn" @click="openImport">导入设备</button>
          <button v-if="canEdit" type="button" class="btn btn--primary" @click="openRack">上架服务器</button>
          <button
            v-if="canEdit"
            type="button"
            class="btn btn--danger"
            :disabled="deleteRackSubmitting"
            @click="deleteRack"
          >
            {{ deleteRackSubmitting ? '删除中...' : '删除机柜' }}
          </button>
        </div>
      </div>
      <div v-if="deleteRackError" class="error" role="alert" aria-live="polite">
        {{ deleteRackError }}
      </div>

      <div v-if="importVisible" class="panel">
        <div class="panel__title">导入设备</div>
        <div class="panel__body">
          <div v-if="!importPreview && !importResult">
            <input type="file" accept=".xlsx" :disabled="importPreviewLoading" @change="handleFileChange" />
            <p v-if="importPreviewLoading">解析中...</p>
            <div v-if="importError" class="error" role="alert" aria-live="polite">{{ importError }}</div>
            <br />
            <button type="button" class="btn" :disabled="importPreviewLoading" @click="cancelImport">取消</button>
          </div>

          <div v-if="importPreview && !importResult">
            <p>
              预览：将覆盖当前机柜设备数据。共 {{ importPreview.occupied }} 个占用 U 位，{{ importPreview.empty }} 个空闲。
            </p>
            <div class="preview-scroll">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>U 位</th>
                    <th>设备标签</th>
                    <th>高度</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="pos in importPreview.positions" :key="pos.uNumber">
                    <td>U{{ pos.uNumber }}</td>
                    <td>{{ pos.label }}</td>
                    <td>{{ pos.uHeight }}U</td>
                  </tr>
                  <tr v-if="importPreview.positions.length === 0">
                    <td colspan="3" class="muted">无设备标签（导入后机柜将清空）</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="importPreview.errors?.length">
              <p v-for="(err, i) in importPreview.errors" :key="i" class="error">{{ err }}</p>
            </div>
            <div class="panel__actions">
              <button
                type="button"
                class="btn btn--primary"
                :disabled="importSubmitting"
                @click="submitImport"
              >
                {{ importSubmitting ? '导入中...' : '确认导入' }}
              </button>
              <button type="button" class="btn" :disabled="importSubmitting" @click="cancelImport">
                取消
              </button>
            </div>
            <div v-if="importError" class="error" role="alert" aria-live="polite">{{ importError }}</div>
          </div>

          <div v-if="importResult">
            <p v-if="importSubmitting">刷新中...</p>
            <template v-else>
              <p>导入完成：{{ importResult.occupied }} 个 U 位有设备，{{ importResult.empty }} 个空闲</p>
              <div v-if="importResult.errors?.length">
                <p v-for="(err, i) in importResult.errors" :key="i" class="error">{{ err }}</p>
              </div>
              <button type="button" class="btn" @click="closeResult">关闭</button>
            </template>
          </div>
        </div>
      </div>

      <div v-if="rackVisible" class="panel">
        <div class="panel__title">上架服务器</div>
        <div class="panel__body">
          <div v-if="loadingServers">加载服务器列表...</div>
          <template v-else>
            <div class="field">
              <label>
                选择服务器：
                <select v-model="selectedServerId">
                  <option value="" disabled>请选择服务器</option>
                  <option v-for="s in availableServers" :key="s.id" :value="s.id">
                    {{ s.name }} ({{ s.deviceType }} {{ s.deviceHeight }}U)
                  </option>
                </select>
              </label>
              <span v-if="availableServers.length === 0 && !loadingServers" class="muted">
                暂无可上架服务器
              </span>
            </div>

            <div v-if="selectedServer" class="field">
              <p>设备类型：{{ selectedServer.deviceType }}</p>
              <p>设备高度：{{ selectedServer.deviceHeight }}U</p>
            </div>

            <div class="field">
              <label>
                起始 U 位：
                <input v-model.number="rackStartU" type="number" min="1" :max="data.rack.heightU" class="u-input" />
              </label>
            </div>

            <div v-if="selectedServer && rackStartU !== null && rackStartU >= 1 && computedEndU !== null" class="field">
              <p>
                占用范围：U{{ rackStartU }}-U{{ computedEndU }}（{{ selectedServer.deviceHeight }}U）
              </p>
            </div>

            <div v-if="rackValidation" class="error" role="alert" aria-live="polite">
              {{ rackValidation }}
            </div>
            <div v-if="rackError" class="error" role="alert" aria-live="polite">
              {{ rackError }}
            </div>

            <div class="panel__actions">
              <button
                type="button"
                class="btn btn--primary"
                :disabled="rackSubmitting || !selectedServer || rackStartU === null || rackStartU < 1 || rackValidation !== null"
                @click="confirmRack"
              >
                {{ rackSubmitting ? '上架中...' : '确认上架' }}
              </button>
              <button type="button" class="btn" :disabled="rackSubmitting" @click="cancelRack">
                取消
              </button>
            </div>
          </template>
        </div>
      </div>

      <div v-if="moveVisible" class="panel">
        <div class="panel__title">移动服务器</div>
        <div class="panel__body">
          <p>服务器：{{ movingServerName }}</p>
          <div v-if="loadingRacks">加载机柜列表...</div>
          <template v-else>
            <div class="field">
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

            <div v-if="moveRackId" class="field">
              <p>设备高度：{{ movingServerHeight }}U</p>
            </div>

            <div class="field">
              <label>
                起始 U 位：
                <input v-model.number="moveStartU" type="number" min="1" :max="selectedRackHeight" class="u-input" />
              </label>
            </div>

            <div v-if="moveStartU !== null && moveStartU >= 1 && moveEndU !== null && moveRackId" class="field">
              <p>
                占用范围：U{{ moveStartU }}-U{{ moveEndU }}（{{ movingServerHeight }}U）
              </p>
            </div>

            <div v-if="moveValidation" class="error" role="alert" aria-live="polite">
              {{ moveValidation }}
            </div>
            <div v-if="moveError" class="error" role="alert" aria-live="polite">
              {{ moveError }}
            </div>

            <div class="panel__actions">
              <button
                type="button"
                class="btn btn--primary"
                :disabled="moveSubmitting || !moveRackId || moveStartU === null || moveStartU < 1 || moveValidation !== null"
                @click="confirmMove"
              >
                {{ moveSubmitting ? '移动中...' : '确认移动' }}
              </button>
              <button type="button" class="btn" :disabled="moveSubmitting" @click="cancelMove">
                取消
              </button>
            </div>
          </template>
        </div>
      </div>

      <div v-if="decommissionVisible" class="panel">
        <div class="panel__title">下架服务器</div>
        <div class="panel__body">
          <p>确认将服务器 <strong>{{ decommissioningServerName }}</strong> 下架？</p>
          <p class="muted">下架后 U 位将释放，服务器记录保留。</p>

          <div v-if="decommissionError" class="error" role="alert" aria-live="polite">
            {{ decommissionError }}
          </div>

          <div class="panel__actions">
            <button
              type="button"
              class="btn btn--danger"
              :disabled="decommissionSubmitting"
              @click="confirmDecommission"
            >
              {{ decommissionSubmitting ? '下架中...' : '确认下架' }}
            </button>
            <button type="button" class="btn" :disabled="decommissionSubmitting" @click="cancelDecommission">
              取消
            </button>
          </div>
        </div>
      </div>

      <div class="main-layout">
        <div class="stats-card">
          <h3>容量统计</h3>
          <p>U 位总数：{{ data.stats.total }}</p>
          <p>已占用：{{ data.stats.occupied }}</p>
          <p>空闲：{{ data.stats.empty }}</p>
          <p>使用率：{{ usagePercent }}%</p>
          <div class="usage-bar">
            <div
              class="usage-bar__fill"
              :style="{ width: `${usagePercent}%` }"
            ></div>
          </div>
        </div>

        <div class="rack-shell">
          <div
            v-for="group in mergedPositions"
            :key="`${group.startU}-${group.endU}`"
            class="u-group"
            :class="{ 'u-group--occupied': !!group.label }"
            :style="{
              display: 'grid',
              gridTemplateColumns: groupServerMap.has(group.startU) && groupServerMap.get(group.startU)!.showActions && canEdit
                ? '40px 1fr 72px'
                : '40px 1fr',
              gridTemplateRows: `repeat(${groupUCount(group)}, 20px)`,
            }"
          >
            <span
              v-for="(u, idx) in groupUNumbers(group)"
              :key="u"
              class="u-label"
              :style="{
                gridColumn: 1,
                gridRow: idx + 1,
              }"
            >U{{ u }}</span>
            <span
              v-if="group.label"
              class="u-name"
            >
              {{ group.label }}
            </span>
            <div
              v-if="groupServerMap.has(group.startU) && groupServerMap.get(group.startU)!.showActions && canEdit"
              class="u-actions"
            >
              <button
                type="button"
                class="btn btn--tiny"
                @click.stop="openMove(groupServerMap.get(group.startU)!.serverId, groupServerMap.get(group.startU)!.serverName)"
              >移动</button>
              <button
                type="button"
                class="btn btn--tiny"
                @click.stop="openDecommission(groupServerMap.get(group.startU)!.serverId, groupServerMap.get(group.startU)!.serverName)"
              >下架</button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rack-page {
  padding: var(--space-md);
  background: var(--color-bg);
  min-height: calc(100vh - 48px);
  color: var(--color-text);
  font-size: var(--font-md);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.breadcrumb {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.breadcrumb a {
  color: var(--color-primary);
  text-decoration: none;
}

.toolbar__stats {
  margin: 0;
}

.toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: flex-start;
}

.btn {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: var(--font-md);
  cursor: pointer;
}

.btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.btn--danger {
  color: var(--color-danger);
  border-color: #f5c6cb;
}

.btn--tiny {
  font-size: 10px;
  padding: 1px 4px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: var(--color-danger);
  margin: var(--space-xs) 0;
}

.muted {
  color: var(--color-text-secondary);
  font-size: var(--font-sm);
}

.panel {
  margin-bottom: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.panel__title {
  padding: var(--space-sm) var(--space-md);
  background: #f0f3f7;
  border-bottom: 1px solid var(--color-border);
  font-weight: bold;
}

.panel__body {
  padding: var(--space-md);
}

.panel__actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.field {
  margin-bottom: var(--space-sm);
}

.field p {
  margin: var(--space-xs) 0;
}

.u-input {
  width: 80px;
}

.preview-scroll {
  max-height: 320px;
  overflow: auto;
  margin-bottom: var(--space-sm);
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
}

.preview-table th,
.preview-table td {
  text-align: left;
  padding: 2px 8px;
  border-bottom: 1px solid var(--color-border);
}

.main-layout {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  align-items: flex-start;
}

.stats-card {
  width: 200px;
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.stats-card h3 {
  margin: 0 0 var(--space-sm);
}

.usage-bar {
  background: #eee;
  height: 20px;
  border-radius: var(--radius);
  overflow: hidden;
}

.usage-bar__fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s;
}

.rack-shell {
  flex: 1;
  max-width: 400px;
  border: 4px solid #2c3e50;
  border-radius: 4px;
  background: #1a252f;
  padding: 4px;
  box-shadow: var(--shadow);
}

.u-group {
  background: #e8f8e8;
  border-bottom: 1px solid var(--color-border);
  padding: 0 8px;
  font-size: var(--font-sm);
  overflow: hidden;
  box-sizing: border-box;
}

.u-group--occupied {
  background: var(--color-primary-light);
}

.u-label {
  line-height: 20px;
  font-weight: bold;
  border-bottom: none;
}

.u-name {
  grid-column: 2;
  grid-row: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-bottom: none;
}

.u-actions {
  grid-column: 3;
  grid-row: 1;
  display: flex;
  align-self: start;
  justify-content: flex-end;
  gap: 2px;
  padding-top: 1px;
}
</style>
