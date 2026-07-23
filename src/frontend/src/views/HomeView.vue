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
const { user, logout } = useAuth()
const { request } = useApi()

const errorMessage = ref('')
const submitting = ref(false)

/** null = not finished loading; empty array = loaded empty list */
const rooms = ref<RoomItem[] | null>(null)
const roomsError = ref('')

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

const isRoomAdmin = computed(() => user.value?.role === ROOM_ADMIN_ROLE)

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

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void uploadPreview(file)
}

async function onLogout(): Promise<void> {
  if (submitting.value) {
    return
  }

  submitting.value = true
  errorMessage.value = ''

  const result = await logout()
  if (result.ok) {
    await router.push('/login')
  } else {
    errorMessage.value = result.error
  }

  submitting.value = false
}
</script>

<template>
  <div>
    <p>{{ user?.username }}</p>
    <p>{{ user?.role }}</p>
    <button type="button" :disabled="submitting" @click="onLogout">登出</button>
    <div role="alert" aria-live="polite">{{ errorMessage }}</div>

    <button type="button" @click="openImport">Excel 导入机柜</button>

    <div v-if="importVisible" style="margin-top: 1em; padding: 1em; border: 1px solid #ccc">
      <div v-if="!importPreview && !importResult">
        <input type="file" accept=".xlsx" @change="handleFileChange" />
        <div v-if="importError" role="alert" aria-live="polite">{{ importError }}</div>
        <br />
        <button type="button" @click="cancelImport">取消</button>
      </div>

      <div v-if="importPreview && !importResult">
        <table style="border-collapse: collapse; width: 100%">
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
              :style="row.errors.length > 0 ? 'background:#fee' : row.duplicate ? 'background:#ffc' : ''"
            >
              <td>{{ row.row }}</td>
              <td>{{ row.code }}</td><td>{{ row.roomName }}</td><td>{{ row.heightU }}</td>
              <td>{{ row.brand }}</td><td>{{ row.power }}</td><td>{{ row.notes }}</td>
              <td>{{ row.x }}</td><td>{{ row.y }}</td><td>{{ row.z }}</td>
              <td>
                <span v-if="row.errors.length" style="color: red">{{ row.errors.join(', ') }}</span>
                <span v-else-if="row.duplicate">重复</span>
                <span v-else style="color: green">正常</span>
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
        <button type="button" :disabled="importSubmitting || importPreview.rows.some(r => r.action === '')" @click="submitImport">
          {{ importSubmitting ? '导入中...' : '确认导入' }}
        </button>
        <button type="button" :disabled="importSubmitting" @click="cancelImport">取消</button>
        <div v-if="importError" role="alert" aria-live="polite">{{ importError }}</div>
      </div>

      <div v-if="importResult">
        <p>
          导入完成：新增 {{ importResult.created }}，跳过 {{ importResult.skipped }}，覆盖 {{ importResult.overwritten }}，失败 {{ importResult.failed }}
        </p>
        <div v-if="importResult.errors.length">
          <p v-for="item in importResult.errors" :key="item.row">行 {{ item.row }}：{{ item.error }}</p>
        </div>
        <button type="button" @click="closeResult">关闭</button>
      </div>
    </div>

    <template v-if="isRoomAdmin">
      <button
        v-if="!createFormVisible && !editingRoomId"
        type="button"
        @click="openCreateForm"
      >
        新增机房
      </button>
      <form v-if="createFormVisible" @submit.prevent="onCreateRoom">
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
        <button type="submit" :disabled="createSubmitting">
          {{ createSubmitting ? '保存中...' : '保存' }}
        </button>
        <button type="button" :disabled="createSubmitting" @click="cancelCreate">
          取消
        </button>
        <div role="alert" aria-live="polite">{{ createError }}</div>
      </form>
    </template>

    <section aria-label="机房列表">
      <div v-if="roomsError" role="alert" aria-live="polite">{{ roomsError }}</div>
      <p v-else-if="rooms !== null && rooms.length === 0">暂无机房</p>
      <ul v-else-if="rooms !== null">
        <li v-for="room in rooms" :key="room.id">
          <template v-if="editingRoomId === room.id">
            <input v-model="editName" name="editName" type="text" />
            <select v-model="editStatus" name="editStatus">
              <option value="启用">启用</option>
              <option value="停用">停用</option>
            </select>
            <button type="button" :disabled="editSubmitting" @click="saveEdit(room)">
              {{ editSubmitting ? '保存中...' : '保存' }}
            </button>
            <button type="button" :disabled="editSubmitting" @click="cancelEdit">取消</button>
            <div v-if="editError" role="alert" aria-live="polite">{{ editError }}</div>
          </template>
          <template v-else>
            <span>{{ room.name }}</span>
            <span>{{ room.status }}</span>
            <button v-if="isRoomAdmin && !createFormVisible" type="button" @click="startEdit(room)">编辑</button>
          </template>
        </li>
      </ul>
    </section>
  </div>
</template>
