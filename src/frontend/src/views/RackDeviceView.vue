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
  return start - server.deviceHeight + 1
})

const rackValidation = computed(() => {
  const server = selectedServer.value
  const start = rackStartU.value
  if (!server || start === null || start < 1 || !data.value) return null

  const height = server.deviceHeight
  const rackHeight = data.value.rack.heightU
  const endU = start - height + 1

  if (start > rackHeight) return `起始 U 位超出机柜范围（最大 U${rackHeight}）`
  if (endU < 1) return `服务器高度 ${height}U 超出机柜范围（U${start}-U${endU} 低于 U1）`

  for (let u = endU; u <= start; u++) {
    if (occupiedUNumbers.value.has(u)) {
      return `U${u} 已被占用`
    }
  }

  return null
})

/**
 * Build visual groups.
 *
 * - Positions arrive in descending U order (U42 → U1).
 * - startU is the higher U number (top of block), endU is the lower (bottom).
 * - A multi-U device (uHeight > 1) at uNumber N occupies [N-uHeight+1, N].
 *   Positions within that range (label=null) are skipped.
 * - Consecutive single-U positions with the same label merge into one block.
 * - Empty slots (label=null, not covered by any device) each appear as one row.
 */
const mergedPositions = computed(() => {
  if (!data.value) return []
  const positions = data.value.positions
  if (positions.length === 0) return []

  const merged: Array<{ startU: number; endU: number; label: string | null }> = []
  let i = 0

  while (i < positions.length) {
    const pos = positions[i]

    if (pos.uHeight > 1) {
      // Multi-U device spans [topU, bottomU]
      const topU = pos.uNumber
      const bottomU = pos.uNumber - pos.uHeight + 1
      merged.push({ startU: topU, endU: bottomU, label: pos.label })
      // Skip positions covered by this device (they have label=null)
      while (i + 1 < positions.length && positions[i + 1].uNumber >= bottomU) {
        i++
      }
      i++
    } else if (pos.label !== null) {
      // Single-U device: merge consecutive same-label positions
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
      // Empty U slot (not covered by any multi-U device)
      merged.push({ startU: pos.uNumber, endU: pos.uNumber, label: null })
      i++
    }
  }

  return merged
})
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
      </p>

      <button type="button" @click="openImport">导入设备</button>
      <button v-if="canEdit" type="button" @click="openRack" style="margin-left: 0.5em">上架服务器</button>

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

      <div style="margin-top: 1em; display: flex; gap: 1em">
        <!-- U-position rack view (left) -->
        <div style="flex: 1; border: 2px solid #333; max-width: 400px">
          <div
            v-for="group in mergedPositions"
            :key="`${group.startU}-${group.endU}`"
            :style="{
              height: `${(group.startU - group.endU + 1) * 20}px`,
              backgroundColor: group.label ? '#b3d9ff' : '#e0ffe0',
              borderBottom: '1px solid #ccc',
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              fontSize: '12px',
              overflow: 'hidden',
            }"
          >
            <span style="font-weight: bold; min-width: 40px; flex-shrink: 0">
              U{{ group.startU }}{{ group.startU !== group.endU ? `-U${group.endU}` : '' }}
            </span>
            <span v-if="group.label" style="margin-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
              {{ group.label }}
            </span>
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
