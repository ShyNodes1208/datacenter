<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'

type CableItem = {
  id: string
  sourcePortId: string
  sourcePortName: string
  sourceServerName: string
  sourceServerId: string
  sourceRackCode: string | null
  sourceRoomName: string | null
  targetPortId: string
  targetPortName: string
  targetServerName: string
  targetServerId: string
  targetRackCode: string | null
  targetRoomName: string | null
  cableType: string
  color: string | null
  length: string | null
  notes: string | null
}

type PortOption = {
  id: string
  serverId: string
  serverName: string
  portName: string
  label: string
}

type RoomOption = { id: string; name: string }

const EDIT_ROLES = ['机房管理员', '运维人员']
const CABLE_TYPES = ['铜缆', '光纤', 'DAC'] as const

const CABLE_COLORS: Record<string, string> = {
  铜缆: '#e67e22',
  光纤: '#f1c40f',
  DAC: '#3498db',
}

const { user } = useAuth()
const { request } = useApi()

const canEdit = computed(() => {
  const role = user.value?.role
  return role !== undefined && EDIT_ROLES.includes(role)
})

const cables = ref<CableItem[] | null>(null)
const portOptions = ref<PortOption[]>([])
const rooms = ref<RoomOption[]>([])
const error = ref('')
const formError = ref('')

const filterRoomId = ref('')
const filterCableType = ref('')
const drawerVisible = ref(false)

const importLoading = ref(false)
const importResult = ref<{ totalRows: number; successCount: number; errorCount: number; errors: { row: number; error: string }[] | null } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function triggerImport(): void {
  fileInput.value?.click()
}

async function handleImport(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importLoading.value = true
  importResult.value = null

  const token = await getCsrfToken()
  if (!token) {
    importResult.value = { totalRows: 0, successCount: 0, errorCount: 1, errors: [{ row: 0, error: '无法获取防伪令牌' }] }
    importLoading.value = false
    input.value = ''
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const headers = new Headers()
    headers.set('X-XSRF-TOKEN', token)

    const response = await fetch('/api/cables/import', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const errMsg = (body as Record<string, unknown>).error
      importResult.value = {
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ row: 0, error: typeof errMsg === 'string' ? errMsg : '导入失败' }],
      }
    } else {
      const data = await response.json() as Record<string, unknown>
      importResult.value = {
        totalRows: (data.totalRows as number) ?? 0,
        successCount: (data.successCount as number) ?? 0,
        errorCount: (data.errorCount as number) ?? 0,
        errors: Array.isArray(data.errors) ? (data.errors as Array<{ row: number; error: string }>) : null,
      }
      await loadCables()
    }
  } catch {
    importResult.value = { totalRows: 0, successCount: 0, errorCount: 1, errors: [{ row: 0, error: '网络错误' }] }
  } finally {
    importLoading.value = false
    input.value = ''
  }
}

const newSourcePortId = ref('')
const newTargetPortId = ref('')
const newCableType = ref('铜缆')
const newCableColor = ref('')
const newCableLength = ref('')

const availableSourcePorts = computed(() =>
  portOptions.value.filter(p => !occupiedPortIds.value.has(p.id)),
)
const availableTargetPorts = computed(() =>
  portOptions.value.filter(p => p.id !== newSourcePortId.value && !occupiedPortIds.value.has(p.id)),
)

const occupiedPortIds = computed(() => {
  const ids = new Set<string>()
  for (const c of cables.value ?? []) {
    ids.add(c.sourcePortId)
    ids.add(c.targetPortId)
  }
  return ids
})

function getCableColor(type: string): string {
  return CABLE_COLORS[type] ?? '#95a5a6'
}

function parseCableItem(raw: unknown): CableItem | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.id !== 'string' ||
    typeof r.sourcePortId !== 'string' ||
    typeof r.sourcePortName !== 'string' ||
    typeof r.sourceServerName !== 'string' ||
    typeof r.sourceServerId !== 'string' ||
    typeof r.targetPortId !== 'string' ||
    typeof r.targetPortName !== 'string' ||
    typeof r.targetServerName !== 'string' ||
    typeof r.targetServerId !== 'string' ||
    typeof r.cableType !== 'string'
  ) return null
  return {
    id: r.id,
    sourcePortId: r.sourcePortId,
    sourcePortName: r.sourcePortName,
    sourceServerName: r.sourceServerName,
    sourceServerId: r.sourceServerId,
    sourceRackCode: typeof r.sourceRackCode === 'string' ? r.sourceRackCode : null,
    sourceRoomName: typeof r.sourceRoomName === 'string' ? r.sourceRoomName : null,
    targetPortId: r.targetPortId,
    targetPortName: r.targetPortName,
    targetServerName: r.targetServerName,
    targetServerId: r.targetServerId,
    targetRackCode: typeof r.targetRackCode === 'string' ? r.targetRackCode : null,
    targetRoomName: typeof r.targetRoomName === 'string' ? r.targetRoomName : null,
    cableType: r.cableType,
    color: typeof r.color === 'string' ? r.color : null,
    length: typeof r.length === 'string' ? r.length : null,
    notes: typeof r.notes === 'string' ? r.notes : null,
  }
}

async function loadRooms(): Promise<void> {
  const result = await request<unknown>('/api/rooms', { method: 'GET' })
  if (!result.ok || !Array.isArray(result.data)) return
  rooms.value = result.data
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object')
    .filter(r => typeof r.id === 'string' && typeof r.name === 'string')
    .map(r => ({ id: r.id as string, name: r.name as string }))
}

async function loadCables(): Promise<void> {
  error.value = ''
  const params = new URLSearchParams()
  if (filterRoomId.value) params.set('roomId', filterRoomId.value)
  if (filterCableType.value) params.set('cableType', filterCableType.value)
  const query = params.toString()
  const url = query ? `/api/cables?${query}` : '/api/cables'

  const result = await request<unknown>(url, { method: 'GET' })
  if (!result.ok) {
    cables.value = null
    error.value = result.error
    return
  }
  if (!Array.isArray(result.data)) {
    cables.value = null
    error.value = 'Request failed.'
    return
  }
  const parsed: CableItem[] = []
  for (const item of result.data) {
    const cable = parseCableItem(item)
    if (!cable) {
      cables.value = null
      error.value = 'Request failed.'
      return
    }
    parsed.push(cable)
  }
  cables.value = parsed
}

async function loadPortOptions(): Promise<void> {
  const serversResult = await request<unknown>('/api/servers', { method: 'GET' })
  if (!serversResult.ok || !Array.isArray(serversResult.data)) return

  const options: PortOption[] = []
  for (const server of serversResult.data) {
    if (server === null || typeof server !== 'object') continue
    const s = server as Record<string, unknown>
    if (typeof s.id !== 'string' || typeof s.name !== 'string') continue

    const portsResult = await request<unknown>(`/api/servers/${s.id}/ports`, { method: 'GET' })
    if (!portsResult.ok || !Array.isArray(portsResult.data)) continue

    for (const port of portsResult.data) {
      if (port === null || typeof port !== 'object') continue
      const p = port as Record<string, unknown>
      if (typeof p.id !== 'string' || typeof p.portName !== 'string') continue
      options.push({
        id: p.id,
        serverId: s.id,
        serverName: s.name,
        portName: p.portName,
        label: `${s.name} / ${p.portName}`,
      })
    }
  }
  portOptions.value = options
}

async function getCsrfToken(): Promise<string | null> {
  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) return null
  return csrfResult.headers.get('X-XSRF-TOKEN')
}

function openDrawer(): void {
  formError.value = ''
  newSourcePortId.value = ''
  newTargetPortId.value = ''
  newCableType.value = '铜缆'
  newCableColor.value = ''
  newCableLength.value = ''
  drawerVisible.value = true
}

async function createCable(): Promise<void> {
  formError.value = ''
  if (!newSourcePortId.value || !newTargetPortId.value) {
    formError.value = '请选择源端口和目标端口'
    return
  }
  if (newSourcePortId.value === newTargetPortId.value) {
    formError.value = '源端口和目标端口不能相同'
    return
  }
  const token = await getCsrfToken()
  if (!token) {
    formError.value = '无法获取防伪令牌'
    return
  }
  const result = await request('/api/cables', {
    method: 'POST',
    body: {
      sourcePortId: newSourcePortId.value,
      targetPortId: newTargetPortId.value,
      cableType: newCableType.value,
      color: newCableColor.value.trim() || null,
      length: newCableLength.value.trim() || null,
    },
    csrfToken: token,
  })
  if (!result.ok) {
    formError.value = result.error
    return
  }
  drawerVisible.value = false
  await loadCables()
}

async function deleteCable(id: string): Promise<void> {
  if (!confirm('确定删除这条线缆？')) return
  const token = await getCsrfToken()
  if (!token) {
    error.value = '无法获取防伪令牌'
    return
  }
  const result = await request(`/api/cables/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    csrfToken: token,
  })
  if (!result.ok) {
    error.value = result.error
    return
  }
  await loadCables()
}

function doSearch(): void {
  void loadCables()
}

function clearFilters(): void {
  filterRoomId.value = ''
  filterCableType.value = ''
  void loadCables()
}

onMounted(() => {
  void loadRooms()
  void loadCables()
  void loadPortOptions()
})
</script>

<template>
  <div class="cable-list">
    <header class="page-header">
      <h2>线缆管理</h2>
      <button v-if="canEdit" type="button" class="btn btn--primary" @click="openDrawer">新增线缆</button>
    </header>

    <div class="filters">
      <select v-model="filterRoomId" class="filter-input">
        <option value="">全部机房</option>
        <option v-for="room in rooms" :key="room.id" :value="room.id">{{ room.name }}</option>
      </select>
      <select v-model="filterCableType" class="filter-input">
        <option value="">全部类型</option>
        <option v-for="t in CABLE_TYPES" :key="t" :value="t">{{ t }}</option>
      </select>
      <button type="button" class="btn btn--small" @click="doSearch">筛选</button>
      <button type="button" class="btn btn--small btn--muted" @click="clearFilters">重置</button>
      <input
        ref="fileInput"
        type="file"
        accept=".xlsx"
        style="display: none"
        @change="handleImport"
      />
      <button
        v-if="canEdit"
        type="button"
        class="btn btn--small"
        :disabled="importLoading"
        @click="triggerImport"
      >
        {{ importLoading ? '导入中...' : '📥 导入 Excel' }}
      </button>
    </div>

    <div v-if="importResult" class="import-result" :class="importResult.errorCount > 0 ? 'import-result--partial' : 'import-result--success'">
      <template v-if="importResult.errorCount === 0">
        ✅ 导入完成：{{ importResult.totalRows }} 行全部成功
      </template>
      <template v-else>
        ⚠ 导入完成：{{ importResult.successCount }}/{{ importResult.totalRows }} 行成功，{{ importResult.errorCount }} 行失败
        <details v-if="importResult.errors && importResult.errors.length > 0" class="import-errors">
          <summary>查看失败详情</summary>
          <ul>
            <li v-for="(e, i) in importResult.errors" :key="i">
              第 {{ e.row }} 行：{{ e.error }}
            </li>
          </ul>
        </details>
      </template>
    </div>

    <div v-if="error" class="error" role="alert">{{ error }}</div>
    <p v-else-if="cables === null">加载中...</p>
    <p v-else-if="cables.length === 0" class="muted">暂无线缆记录</p>

    <table v-else class="data-table">
      <thead>
        <tr>
          <th>源端</th>
          <th>目标端</th>
          <th>类型</th>
          <th>颜色</th>
          <th>长度</th>
          <th v-if="canEdit">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cable in cables" :key="cable.id">
          <td>
            <div class="endpoint">{{ cable.sourceServerName }} / {{ cable.sourcePortName }}</div>
            <div class="endpoint-sub">{{ cable.sourceRoomName ?? '-' }} · {{ cable.sourceRackCode ?? '-' }}</div>
          </td>
          <td>
            <div class="endpoint">{{ cable.targetServerName }} / {{ cable.targetPortName }}</div>
            <div class="endpoint-sub">{{ cable.targetRoomName ?? '-' }} · {{ cable.targetRackCode ?? '-' }}</div>
          </td>
          <td>
            <span class="cable-tag" :style="{ background: getCableColor(cable.cableType), color: '#fff' }">
              {{ cable.cableType }}
            </span>
          </td>
          <td>{{ cable.color ?? '-' }}</td>
          <td>{{ cable.length ?? '-' }}</td>
          <td v-if="canEdit">
            <button type="button" class="btn btn--small btn--danger" @click="deleteCable(cable.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="drawerVisible" class="drawer-overlay" @click.self="drawerVisible = false">
      <div class="drawer">
        <h3>新增线缆</h3>
        <div v-if="formError" class="error">{{ formError }}</div>
        <label class="form-field">
          <span>源端口</span>
          <select v-model="newSourcePortId" class="form-input">
            <option value="">选择源端口</option>
            <option v-for="p in availableSourcePorts" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
        </label>
        <label class="form-field">
          <span>目标端口</span>
          <select v-model="newTargetPortId" class="form-input">
            <option value="">选择目标端口</option>
            <option v-for="p in availableTargetPorts" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
        </label>
        <label class="form-field">
          <span>线缆类型</span>
          <select v-model="newCableType" class="form-input">
            <option v-for="t in CABLE_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <label class="form-field">
          <span>颜色</span>
          <input v-model="newCableColor" class="form-input" placeholder="如 蓝色" />
        </label>
        <label class="form-field">
          <span>长度</span>
          <input v-model="newCableLength" class="form-input" placeholder="如 3m" />
        </label>
        <div class="drawer-actions">
          <button type="button" class="btn btn--primary" @click="createCable">创建</button>
          <button type="button" class="btn" @click="drawerVisible = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cable-list {
  padding: var(--space-md);
  color: var(--color-text);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.page-header h2 {
  margin: 0;
  font-size: var(--font-xl);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.filter-input {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: var(--font-sm);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-sm);
}

.data-table th {
  text-align: left;
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-table-header);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.data-table td {
  padding: var(--space-xs) var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

.data-table tbody tr:nth-child(even) {
  background: var(--color-table-stripe);
}

.endpoint {
  font-weight: 500;
}

.endpoint-sub {
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.cable-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: var(--font-sm);
  font-weight: 500;
}

.error {
  color: var(--color-danger);
  margin-bottom: var(--space-sm);
}

.muted {
  color: var(--color-text-secondary);
}

.btn {
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: var(--font-md);
  cursor: pointer;
}

.btn--small {
  font-size: var(--font-sm);
  padding: 2px var(--space-sm);
}

.btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.btn--muted {
  color: var(--color-text-secondary);
}

.btn--danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.drawer {
  background: var(--color-bg-card);
  border-radius: var(--radius);
  padding: var(--space-md);
  width: min(420px, 90vw);
  box-shadow: var(--shadow);
}

.drawer h3 {
  margin: 0 0 var(--space-md);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
  font-size: var(--font-sm);
}

.form-input {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: var(--font-md);
}

.drawer-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.import-result {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius);
  font-size: var(--font-sm);
  margin-bottom: var(--space-md);
}

.import-result--success {
  background: #e6f7e6;
  color: #2d8a2d;
  border: 1px solid #b7e4b7;
}

.import-result--partial {
  background: #fef3e0;
  color: #b8731f;
  border: 1px solid #f5d698;
}

.import-errors {
  margin-top: var(--space-sm);
  font-size: var(--font-sm);
}

.import-errors summary {
  cursor: pointer;
  font-weight: 500;
}

.import-errors ul {
  margin: var(--space-xs) 0 0;
  padding-left: var(--space-md);
  list-style: disc;
}

.import-errors li {
  margin-bottom: 2px;
}
</style>
