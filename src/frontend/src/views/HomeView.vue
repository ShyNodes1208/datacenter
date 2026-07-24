<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'

type RoomItem = {
  id: string
  name: string
  status: string
}

type RackItem = {
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
}

type ImportRowResult = {
  row: number
  code: string | null
  roomName: string | null
  roomId: string | null
  heightU: number | null
  brand: string | null
  power: number | null
  notes: string | null
  x: number | null
  y: number | null
  z: number | null
  errors: string[]
  duplicate: boolean
  existingRackId: string | null
  action: '' | 'create' | 'skip' | 'overwrite'
}

type ImportResponse = {
  created: number
  skipped: number
  overwritten: number
  failed: number
  errors: Array<{ row: number; error: string }>
}

const ROOM_ADMIN_ROLE = '机房管理员'

const router = useRouter()
const { user } = useAuth()
const { request } = useApi()

/** null = not finished loading; empty array = loaded empty list */
const rooms = ref<RoomItem[] | null>(null)
const roomsError = ref('')

const expandedRoomId = ref<string | null>(null)
const roomRacks = ref<Map<string, RackItem[]>>(new Map())
const racksLoading = ref<Set<string>>(new Set())

const createFormVisible = ref(false)
const roomName = ref('')
const roomStatus = ref('启用')
const createSubmitting = ref(false)
const createError = ref('')

const editingRoomId = ref<string | null>(null)
const editName = ref('')
const editStatus = ref('启用')
const editSubmitting = ref(false)
const editError = ref('')

const deleteSubmitting = ref(false)
const deleteError = ref('')
const deleteErrorRoomId = ref<string | null>(null)

const importVisible = ref(false)
const importPreview = ref<{
  rows: ImportRowResult[]
  totalRows: number
  validRows: number
  errorRows: number
  duplicateRows: number
} | null>(null)
const importSubmitting = ref(false)
const importError = ref('')
const importResult = ref<ImportResponse | null>(null)

const EDIT_ROLES = ['机房管理员', '运维人员']
const isRoomAdmin = computed(() => user.value?.role === ROOM_ADMIN_ROLE)
const canDeleteRoom = computed(() => {
  const role = user.value?.role
  return role !== undefined && EDIT_ROLES.includes(role)
})

async function loadRooms(): Promise<void> {
  roomsError.value = ''

  const result = await request<unknown>('/api/rooms', { method: 'GET' })
  if (!result.ok) {
    rooms.value = null
    roomsError.value = result.error
    return
  }

  if (!Array.isArray(result.data)) {
    rooms.value = null
    roomsError.value = 'Request failed.'
    return
  }

  const parsed: RoomItem[] = []
  for (const item of result.data) {
    if (item === null || typeof item !== 'object') {
      rooms.value = null
      roomsError.value = 'Request failed.'
      return
    }
    const record = item as Record<string, unknown>
    if (
      typeof record.id !== 'string' ||
      typeof record.name !== 'string' ||
      typeof record.status !== 'string'
    ) {
      rooms.value = null
      roomsError.value = 'Request failed.'
      return
    }
    parsed.push({ id: record.id, name: record.name, status: record.status })
  }

  rooms.value = parsed
}

function openCreateForm(): void {
  if (createFormVisible.value) {
    return
  }
  createFormVisible.value = true
  createError.value = ''
}

function cancelCreate(): void {
  createFormVisible.value = false
  roomName.value = ''
  roomStatus.value = '启用'
  createError.value = ''
}

function startEdit(room: RoomItem): void {
  editingRoomId.value = room.id
  editName.value = room.name
  editStatus.value = room.status
  editError.value = ''
}

function cancelEdit(): void {
  editingRoomId.value = null
  editName.value = ''
  editStatus.value = '启用'
  editError.value = ''
}

async function fetchEditCsrfToken(): Promise<string | null> {
  const result = await request('/api/auth/csrf', { method: 'GET' })
  if (!result.ok) {
    editError.value = result.error
    return null
  }
  const token = result.headers.get('X-XSRF-TOKEN')
  if (!token) {
    editError.value = 'Request failed.'
    return null
  }
  return token
}

async function saveEdit(room: RoomItem): Promise<void> {
  if (editSubmitting.value) return
  editSubmitting.value = true
  editError.value = ''

  const token = await fetchEditCsrfToken()
  if (token === null) {
    editSubmitting.value = false
    return
  }

  const result = await request(`/api/rooms/${room.id}`, {
    method: 'PUT',
    body: { name: editName.value, status: editStatus.value },
    csrfToken: token,
  })

  if (!result.ok) {
    editError.value = result.error
    editSubmitting.value = false
    return
  }

  editingRoomId.value = null
  editName.value = ''
  editStatus.value = '启用'
  editError.value = ''
  await loadRooms()
  editSubmitting.value = false
}

async function deleteRoom(room: RoomItem): Promise<void> {
  if (deleteSubmitting.value) return
  if (!window.confirm(`确认删除机房「${room.name}」？`)) return

  deleteSubmitting.value = true
  deleteError.value = ''
  deleteErrorRoomId.value = room.id

  const csrf = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrf.ok) {
    deleteError.value = csrf.error
    deleteSubmitting.value = false
    return
  }
  const token = csrf.headers.get('X-XSRF-TOKEN')
  if (!token) {
    deleteError.value = 'Request failed.'
    deleteSubmitting.value = false
    return
  }

  const result = await request(`/api/rooms/${room.id}`, {
    method: 'DELETE',
    csrfToken: token,
  })

  if (!result.ok) {
    deleteError.value = result.error
    deleteSubmitting.value = false
    return
  }

  if (expandedRoomId.value === room.id) {
    expandedRoomId.value = null
  }
  if (editingRoomId.value === room.id) {
    cancelEdit()
  }
  deleteErrorRoomId.value = null
  deleteSubmitting.value = false
  await loadRooms()
}

async function fetchCreateCsrfToken(): Promise<string | null> {
  const result = await request('/api/auth/csrf', { method: 'GET' })
  if (!result.ok) {
    createError.value = result.error
    return null
  }

  const token = result.headers.get('X-XSRF-TOKEN')
  if (!token) {
    createError.value = 'Request failed.'
    return null
  }

  return token
}

async function onCreateRoom(): Promise<void> {
  if (createSubmitting.value) {
    return
  }

  createSubmitting.value = true
  createError.value = ''

  const token = await fetchCreateCsrfToken()
  if (token === null) {
    createSubmitting.value = false
    return
  }

  const result = await request('/api/rooms', {
    method: 'POST',
    body: { name: roomName.value, status: roomStatus.value },
    csrfToken: token,
  })

  if (!result.ok) {
    createError.value = result.error
    createSubmitting.value = false
    return
  }

  createFormVisible.value = false
  roomName.value = ''
  roomStatus.value = '启用'
  createError.value = ''
  await loadRooms()
  createSubmitting.value = false
}

async function toggleRoom(roomId: string): Promise<void> {
  if (expandedRoomId.value === roomId) {
    expandedRoomId.value = null
    return
  }
  expandedRoomId.value = roomId

  // Load racks if not already cached
  if (!roomRacks.value.has(roomId)) {
    racksLoading.value.add(roomId)

    const result = await request<RackItem[]>(`/api/racks?roomId=${roomId}`, { method: 'GET' })
    if (result.ok && Array.isArray(result.data)) {
      const racks = new Map(roomRacks.value)
      racks.set(
        roomId,
        result.data.map((rack) => ({
          ...rack,
          occupiedU: typeof rack.occupiedU === 'number' ? rack.occupiedU : 0,
        })),
      )
      roomRacks.value = racks
    }

    racksLoading.value.delete(roomId)
  }
}

function goToRack(rackId: string): void {
  router.push(`/racks/${rackId}`)
}

onMounted(() => {
  void loadRooms()
})

function openImport(): void {
  importVisible.value = true
  importPreview.value = null
  importResult.value = null
  importError.value = ''
}

function cancelImport(): void {
  importVisible.value = false
  importPreview.value = null
  importResult.value = null
  importError.value = ''
}

async function uploadPreview(file: File): Promise<void> {
  importError.value = ''
  importPreview.value = null

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

  const formData = new FormData()
  formData.append('file', file)

  let response: Response
  try {
    response = await fetch('/api/racks/import-preview', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': token },
      body: formData,
    })
  } catch {
    importError.value = 'Request failed.'
    return
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    importError.value = ((body as Record<string, unknown>).error as string) || '上传失败'
    return
  }

  const data = (await response.json()) as {
    rows: ImportRowResult[]
    totalRows: number
    validRows: number
    errorRows: number
    duplicateRows: number
  }
  data.rows = data.rows.map((row) => ({
    ...row,
    action: row.duplicate && row.errors.length === 0 ? '' as const : 'create' as const,
  }))
  importPreview.value = data
}

async function submitImport(): Promise<void> {
  if (!importPreview.value || importSubmitting.value) return
  importSubmitting.value = true
  importError.value = ''

  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) {
    importError.value = csrfResult.error
    importSubmitting.value = false
    return
  }
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) {
    importError.value = 'Request failed.'
    importSubmitting.value = false
    return
  }

  const body = {
    rows: importPreview.value.rows
      .filter((row) => row.errors.length === 0)
      .map((row) => ({
        row: row.row,
        action: row.action,
        code: row.code,
        roomId: row.roomId,
        heightU: row.heightU,
        brand: row.brand,
        power: row.power,
        notes: row.notes,
        x: row.x,
        y: row.y,
        z: row.z,
        existingRackId: row.existingRackId,
      })),
  }

  const result = await request('/api/racks/import', {
    method: 'POST',
    body,
    csrfToken: token,
  })

  if (!result.ok) {
    importError.value = result.error
    importSubmitting.value = false
    return
  }

  importResult.value = result.data as ImportResponse
  importSubmitting.value = false
}

function closeResult(): void {
  importVisible.value = false
  importPreview.value = null
  importResult.value = null
}

// --- Batch device import ---

type BatchRackResult = {
  rackId: string
  rackCode: string
  totalUPositions: number
  occupied: number
  empty: number
  errors?: string[]
}

type BatchImportResult = {
  racks: BatchRackResult[]
  totalRacks: number
  totalOccupied: number
}

const batchImportVisible = ref(false)
const batchImportResult = ref<BatchImportResult | null>(null)
const batchImportError = ref('')
const batchImportSubmitting = ref(false)

function openBatchImport(): void {
  batchImportVisible.value = true
  batchImportResult.value = null
  batchImportError.value = ''
}

function cancelBatchImport(): void {
  batchImportVisible.value = false
  batchImportResult.value = null
  batchImportError.value = ''
}

function closeBatchResult(): void {
  batchImportVisible.value = false
  batchImportResult.value = null
  loadRooms()
}

async function handleBatchFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  batchImportError.value = ''
  batchImportSubmitting.value = true

  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) {
    batchImportError.value = csrfResult.error
    batchImportSubmitting.value = false
    return
  }
  const token = csrfResult.headers.get('X-XSRF-TOKEN')
  if (!token) {
    batchImportError.value = 'Request failed.'
    batchImportSubmitting.value = false
    return
  }

  const formData = new FormData()
  formData.append('file', file)

  let response: Response
  try {
    response = await fetch('/api/device-positions/import-batch', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': token },
      body: formData,
    })
  } catch {
    batchImportError.value = 'Request failed.'
    batchImportSubmitting.value = false
    return
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    batchImportError.value = ((body as Record<string, unknown>).error as string) || '导入失败'
    batchImportSubmitting.value = false
    return
  }

  batchImportResult.value = (await response.json()) as BatchImportResult
  batchImportSubmitting.value = false
}

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void uploadPreview(file)
}

</script>

<template>
  <div class="home-page">
    <div class="toolbar">
      <button type="button" class="btn btn--icon-import" @click="openImport">Excel 导入机柜</button>
      <button type="button" class="btn btn--icon-import" @click="openBatchImport">批量导入设备</button>
      <button
        v-if="isRoomAdmin && !createFormVisible && !editingRoomId"
        type="button"
        class="btn btn--primary btn--icon-add"
        @click="openCreateForm"
      >
        新增机房
      </button>
    </div>

    <div v-if="batchImportVisible" class="panel">
      <div v-if="!batchImportResult">
        <input type="file" accept=".xlsx" @change="handleBatchFileChange" />
        <div v-if="batchImportError" class="error" role="alert" aria-live="polite">{{ batchImportError }}</div>
        <p v-if="batchImportSubmitting">导入中...</p>
        <br />
        <button type="button" class="btn" :disabled="batchImportSubmitting" @click="cancelBatchImport">取消</button>
      </div>
      <div v-else>
        <p>导入完成：{{ batchImportResult.totalRacks }} 个机柜，共 {{ batchImportResult.totalOccupied }} 个设备</p>
        <div v-for="rack in batchImportResult.racks" :key="rack.rackId" class="panel-line">
          <strong>{{ rack.rackCode }}</strong>：
          {{ rack.totalUPositions }}U，占用 {{ rack.occupied }}U，空闲 {{ rack.empty }}U
          <span v-if="rack.errors?.length" class="error">
            （{{ rack.errors.join('、') }}）
          </span>
        </div>
        <button type="button" class="btn" @click="closeBatchResult">关闭</button>
      </div>
    </div>

    <div v-if="importVisible" class="panel">
      <div v-if="!importPreview && !importResult">
        <input type="file" accept=".xlsx" @change="handleFileChange" />
        <div v-if="importError" class="error" role="alert" aria-live="polite">{{ importError }}</div>
        <br />
        <button type="button" class="btn" @click="cancelImport">取消</button>
      </div>

      <div v-if="importPreview && !importResult">
        <table class="preview-table">
          <thead>
            <tr>
              <th>行</th><th>编号</th><th>机房</th><th>高度</th><th>品牌</th>
              <th>功率</th><th>备注</th><th>X</th><th>Y</th><th>Z</th>
              <th>状态</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in importPreview.rows"
              :key="row.row"
              :class="{ 'row-error': row.errors.length > 0, 'row-dup': row.duplicate && row.errors.length === 0 }"
            >
              <td>{{ row.row }}</td>
              <td>{{ row.code }}</td><td>{{ row.roomName }}</td><td>{{ row.heightU }}</td>
              <td>{{ row.brand }}</td><td>{{ row.power }}</td><td>{{ row.notes }}</td>
              <td>{{ row.x }}</td><td>{{ row.y }}</td><td>{{ row.z }}</td>
              <td>
                <span v-if="row.errors.length" class="error">{{ row.errors.join(', ') }}</span>
                <span v-else-if="row.duplicate">重复</span>
                <span v-else class="ok">正常</span>
              </td>
              <td>
                <select v-if="row.duplicate && row.errors.length === 0" v-model="row.action">
                  <option value="" disabled>请选择</option>
                  <option value="skip">跳过</option>
                  <option value="overwrite">覆盖</option>
                </select>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          共 {{ importPreview.totalRows }} 行，{{ importPreview.validRows }} 有效，{{ importPreview.errorRows }} 错误，{{ importPreview.duplicateRows }} 重复
        </p>
        <button type="button" class="btn btn--primary" :disabled="importSubmitting || importPreview.rows.some(r => r.action === '')" @click="submitImport">
          {{ importSubmitting ? '导入中...' : '确认导入' }}
        </button>
        <button type="button" class="btn" :disabled="importSubmitting" @click="cancelImport">取消</button>
        <div v-if="importError" class="error" role="alert" aria-live="polite">{{ importError }}</div>
      </div>

      <div v-if="importResult">
        <p>
          导入完成：新增 {{ importResult.created }}，跳过 {{ importResult.skipped }}，覆盖 {{ importResult.overwritten }}，失败 {{ importResult.failed }}
        </p>
        <div v-if="importResult.errors.length">
          <p v-for="item in importResult.errors" :key="item.row" class="error">行 {{ item.row }}：{{ item.error }}</p>
        </div>
        <button type="button" class="btn" @click="closeResult">关闭</button>
      </div>
    </div>

    <form v-if="isRoomAdmin && createFormVisible" class="panel create-form" @submit.prevent="onCreateRoom">
      <label>
        机房名称
        <input v-model="roomName" name="roomName" type="text" />
      </label>
      <label>
        状态
        <select v-model="roomStatus" name="roomStatus">
          <option value="启用">启用</option>
          <option value="停用">停用</option>
        </select>
      </label>
      <button type="submit" class="btn btn--primary" :disabled="createSubmitting">
        {{ createSubmitting ? '保存中...' : '保存' }}
      </button>
      <button type="button" class="btn" :disabled="createSubmitting" @click="cancelCreate">
        取消
      </button>
      <div class="error" role="alert" aria-live="polite">{{ createError }}</div>
    </form>

    <section class="room-list" aria-label="机房列表">
      <div v-if="roomsError" class="error" role="alert" aria-live="polite">{{ roomsError }}</div>
      <p v-else-if="rooms !== null && rooms.length === 0">暂无机房</p>
      <div v-else-if="rooms !== null" class="room-cards">
        <div v-for="room in rooms" :key="room.id" class="room-card">
          <div class="room-card__header" @click="toggleRoom(room.id)">
            <span class="room-card__arrow">{{ expandedRoomId === room.id ? '▼' : '▶' }}</span>
            <span class="room-card__name">{{ room.name }}</span>
            <span class="room-card__status" :class="room.status === '启用' ? 'is-on' : 'is-off'">{{ room.status }}</span>
            <template v-if="isRoomAdmin && !createFormVisible">
              <button
                v-if="editingRoomId !== room.id"
                type="button"
                class="btn btn--small btn--icon-edit"
                @click.stop="startEdit(room)"
              >
                编辑
              </button>
            </template>
            <button
              v-if="canDeleteRoom && editingRoomId !== room.id"
              type="button"
              class="btn btn--small btn--danger btn--icon-delete"
              :disabled="deleteSubmitting"
              @click.stop="deleteRoom(room)"
            >
              删除
            </button>
            <span v-if="racksLoading.has(room.id)" class="muted">加载中...</span>
          </div>

          <div
            v-if="deleteErrorRoomId === room.id && deleteError"
            class="error"
            role="alert"
            aria-live="polite"
          >
            {{ deleteError }}
          </div>

          <div v-if="editingRoomId === room.id" class="edit-form">
            <input v-model="editName" name="editName" type="text" />
            <select v-model="editStatus" name="editStatus">
              <option value="启用">启用</option>
              <option value="停用">停用</option>
            </select>
            <button type="button" class="btn btn--primary btn--small" :disabled="editSubmitting" @click="saveEdit(room)">
              {{ editSubmitting ? '保存中...' : '保存' }}
            </button>
            <button type="button" class="btn btn--small" :disabled="editSubmitting" @click="cancelEdit">取消</button>
            <div v-if="editError" class="error" role="alert" aria-live="polite">{{ editError }}</div>
          </div>

          <div v-if="expandedRoomId === room.id && roomRacks.has(room.id)" class="rack-grid">
            <div v-if="roomRacks.get(room.id)!.length === 0" class="muted">
              暂无导入的机柜
            </div>
            <div
              v-for="rack in roomRacks.get(room.id)!"
              :key="rack.id"
              class="rack-card"
              @click="goToRack(rack.id)"
            >
              <div class="rack-card__code">{{ rack.code }}</div>
                <div class="rack-card__stats">
                  已用 {{ rack.occupiedU ?? 0 }}/{{ rack.heightU }}U
                  ({{ rack.heightU > 0 ? Math.round(((rack.occupiedU ?? 0) / rack.heightU) * 100) : 0 }}%)
                </div>
              <div v-if="rack.brand" class="rack-card__brand">{{ rack.brand }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  padding: var(--space-md);
  background: var(--color-bg);
  min-height: calc(100vh - 48px);
  color: var(--color-text);
  font-size: var(--font-md);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
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

.btn--small {
  font-size: var(--font-sm);
  padding: 2px 8px;
}

.btn--icon-add::before {
  content: '✚ ';
}

.btn--icon-edit::before {
  content: '✎ ';
}

.btn--icon-delete::before {
  content: '✕ ';
}

.btn--icon-import::before {
  content: '↥ ';
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.panel {
  margin-bottom: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.panel-line {
  margin: var(--space-xs) 0;
}

.create-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: flex-end;
}

.create-form label {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--font-sm);
}

.error {
  color: var(--color-danger);
}

.ok {
  color: var(--color-success);
}

.muted {
  color: var(--color-text-secondary);
  font-size: var(--font-sm);
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-sm);
  margin-bottom: var(--space-sm);
}

.preview-table th,
.preview-table td {
  border: 1px solid var(--color-border);
  padding: 2px 6px;
  text-align: left;
}

.row-error {
  background: var(--color-error-bg);
}

.row-dup {
  background: #fff8e1;
}

.room-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.room-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.room-card__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: #f0f3f7;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border);
}

.room-card__arrow {
  color: var(--color-text-secondary);
  font-size: var(--font-sm);
  width: 1em;
}

.room-card__name {
  font-weight: bold;
  font-size: var(--font-lg);
}

.room-card__status.is-on {
  color: var(--color-success);
  font-size: var(--font-sm);
}

.room-card__status.is-off {
  color: var(--color-danger);
  font-size: var(--font-sm);
}

.edit-form {
  padding: var(--space-md);
  background: #fafbfc;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
}

.rack-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  padding: var(--space-md);
}

.rack-card {
  min-width: 160px;
  padding: var(--space-md);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.rack-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  border-color: var(--color-primary);
}

.rack-card__code {
  font-weight: bold;
  margin-bottom: var(--space-xs);
}

.rack-card__stats {
  font-size: var(--font-md);
  color: var(--color-primary);
  font-weight: 600;
}

.rack-card__brand {
  margin-top: var(--space-xs);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}
</style>
