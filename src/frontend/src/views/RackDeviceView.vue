<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'

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

const route = useRoute()
const router = useRouter()
const { request } = useApi()

const rackId = computed(() => route.params.id as string)

const data = ref<DevicePositionsData | null>(null)
const error = ref('')
const importVisible = ref(false)
const importError = ref('')
const importResult = ref<ImportResult | null>(null)
const importSubmitting = ref(false)

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

const usagePercent = computed(() => {
  if (!data.value || data.value.stats.total === 0) return 0
  return Math.round((data.value.stats.occupied / data.value.stats.total) * 100)
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
