<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'
import { useRackDetail } from '../composables/useRackDetail'
import RackFrontPanel from '../components/RackFrontPanel.vue'
import RackOperationDrawer from '../components/RackOperationDrawer.vue'
import SwitchPortDrawer from '../components/SwitchPortDrawer.vue'
import type { USlot } from '../components/RackFrontPanel.vue'
import type { SwitchPortItem } from '../components/SwitchPortDrawer.vue'

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

const { rack, uSlots, stats, loading, error: detailError, rackedServerCount, loadData } = useRackDetail(rackId.value)

const error = ref('')
watch(detailError, (val) => { if (val) error.value = val })

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

const switchDrawerVisible = ref(false)
const switchDrawerDeviceName = ref('')
const switchDrawerDeviceId = ref('')
const switchPorts = ref<SwitchPortItem[]>([])
const switchPortsLoading = ref(false)
const switchPortsError = ref('')

onMounted(() => {
  void loadData()
})

const usagePercent = computed(() => {
  if (stats.value.total === 0) return 0
  return Math.round((stats.value.occupied / stats.value.total) * 100)
})

const occupiedUNumbers = computed(() => {
  const occupied = new Set<number>()
  for (const slot of uSlots.value) {
    if (!slot.occupied) continue
    const lo = Math.min(slot.startU, slot.endU)
    const hi = Math.max(slot.startU, slot.endU)
    for (let u = lo; u <= hi; u++) occupied.add(u)
  }
  return occupied
})

function onEmptySlotClick(uNumber: number, _slot: USlot): void {
  rackStartU.value = uNumber
  void openRack()
}

function onServerClick(serverId: string): void {
  router.push(`/servers/${encodeURIComponent(serverId)}`)
}

function parseSwitchPortItem(raw: unknown): SwitchPortItem | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.portName !== 'string' || typeof r.portType !== 'string') return null
  return {
    id: r.id,
    portName: r.portName,
    portType: r.portType,
    speed: typeof r.speed === 'string' ? r.speed : null,
    cableType: typeof r.cableType === 'string' ? r.cableType : null,
    connectedToServerName: typeof r.connectedToServerName === 'string' ? r.connectedToServerName : null,
    connectedToServerId: typeof r.connectedToServerId === 'string' ? r.connectedToServerId : null,
    connectedToPortName: typeof r.connectedToPortName === 'string' ? r.connectedToPortName : null,
    connectedToRackCode: typeof r.connectedToRackCode === 'string' ? r.connectedToRackCode : null,
  }
}

async function openSwitchDrawer(serverId: string): Promise<void> {
  switchDrawerVisible.value = true
  switchDrawerDeviceId.value = serverId
  switchPortsLoading.value = true
  switchPortsError.value = ''
  switchPorts.value = []

  const slot = uSlots.value.find(s => s.serverId === serverId)
  switchDrawerDeviceName.value = slot?.serverName ?? ''

  const result = await request<unknown>(`/api/servers/${serverId}/ports`, { method: 'GET' })
  switchPortsLoading.value = false

  if (!result.ok) {
    switchPortsError.value = result.error
    return
  }
  if (!Array.isArray(result.data)) {
    switchPortsError.value = 'Request failed.'
    return
  }
  switchPorts.value = result.data.map(parseSwitchPortItem).filter(Boolean) as SwitchPortItem[]
}

function handleNavigate(serverId: string): void {
  switchDrawerVisible.value = false
  router.push(`/servers/${encodeURIComponent(serverId)}`)
}

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
  await loadAvailableServers()
}

function cancelRack(): void {
  rackVisible.value = false
  rackError.value = ''
  selectedServerId.value = ''
  rackStartU.value = null
  availableServers.value = []
}

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
  if (!server || start === null || start < 1 || !rack.value) return null

  const height = server.deviceHeight
  const rackHeight = rack.value.heightU
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

async function confirmRack(): Promise<void> {
  const server = selectedServer.value
  const start = rackStartU.value
  if (!server || start === null || start < 1 || !rack.value) return

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
    body: { rackId: rack.value.id, startU: start },
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
  const r = rackOptions.value.find(item => item.id === moveRackId.value)
  return r ? r.heightU : 0
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
  if (!rack.value || deleteRackSubmitting.value) return
  if (!window.confirm(`确认删除机柜「${rack.value.code}」？`)) return

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
    <div v-if="loading" class="status-msg">加载中...</div>
    <div v-else-if="error" class="error" role="alert" aria-live="polite">{{ error }}</div>

    <template v-else-if="rack">
      <div class="toolbar">
        <div class="toolbar__left">
          <p class="breadcrumb">
            <a href="/" @click.prevent="router.push('/')">机房列表</a>
            &gt; {{ rack.roomName }}
            <router-link :to="`/rooms/${rack.roomId}/floorplan`">平面图</router-link>
            &gt; {{ rack.code }}
          </p>
          <p class="toolbar__stats">
            U 位总数：{{ stats.total }} |
            已占用：{{ stats.occupied }} |
            空闲：{{ stats.empty }} |
            使用率：{{ usagePercent }}%
            <span class="muted"> | 在架服务器：{{ rackedServerCount }}</span>
          </p>
        </div>
        <div class="toolbar__actions">
          <button type="button" class="btn" @click="openImport">导入设备</button>
          <button v-if="canEdit" type="button" class="btn btn--primary" @click="openRack()">上架服务器</button>
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

      <div class="main-layout">
        <div class="rack-panel-wrapper">
          <RackFrontPanel
            :rack-code="rack.code"
            :height-u="rack.heightU"
            :u-slots="uSlots"
            :room-id="rack.roomId"
            @slot-click="onEmptySlotClick"
            @server-click="onServerClick"
            @move-click="openMove"
            @decommission-click="openDecommission"
            @port-view-click="openSwitchDrawer"
          />
        </div>
        <div class="usage-section">
          <div class="usage-bar-vertical">
            <div class="usage-bar-vertical__track">
              <div
                class="usage-bar-vertical__fill"
                :style="{ height: `${usagePercent}%` }"
              ></div>
            </div>
            <span class="usage-bar-vertical__label">{{ usagePercent }}%</span>
          </div>
        </div>
      </div>

      <RackOperationDrawer
        :visible="importVisible"
        title="导入设备"
        @close="cancelImport"
      >
        <div v-if="!importPreview && !importResult">
          <input type="file" accept=".xlsx" :disabled="importPreviewLoading" @change="handleFileChange" />
          <p v-if="importPreviewLoading">解析中...</p>
          <div v-if="importError" class="error" role="alert" aria-live="polite">{{ importError }}</div>
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
      </RackOperationDrawer>

      <RackOperationDrawer
        :visible="rackVisible"
        title="上架服务器"
        @close="cancelRack"
      >
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
              <input v-model.number="rackStartU" type="number" min="1" :max="rack.heightU" class="u-input" />
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
      </RackOperationDrawer>

      <RackOperationDrawer
        :visible="moveVisible"
        title="移动服务器"
        @close="cancelMove"
      >
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
      </RackOperationDrawer>

      <RackOperationDrawer
        :visible="decommissionVisible"
        title="下架服务器"
        @close="cancelDecommission"
      >
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
      </RackOperationDrawer>

      <SwitchPortDrawer
        :visible="switchDrawerVisible"
        :device-name="switchDrawerDeviceName"
        :device-id="switchDrawerDeviceId"
        :ports="switchPorts"
        :loading="switchPortsLoading"
        :error="switchPortsError"
        @close="switchDrawerVisible = false"
        @navigate="handleNavigate"
      />
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

.status-msg {
  padding: var(--space-lg);
  text-align: center;
  color: var(--color-text-secondary);
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
  gap: var(--space-md);
  align-items: flex-start;
}

.rack-panel-wrapper {
  flex: 1;
  max-width: 480px;
}

.usage-section {
  display: flex;
  align-items: center;
  padding-top: 48px;
}

.usage-bar-vertical {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.usage-bar-vertical__track {
  width: 12px;
  height: 320px;
  background: #eee;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.usage-bar-vertical__fill {
  width: 100%;
  position: absolute;
  bottom: 0;
  background: var(--color-primary);
  border-radius: 6px;
  transition: height 0.3s;
}

.usage-bar-vertical__label {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--color-primary);
}
</style>
