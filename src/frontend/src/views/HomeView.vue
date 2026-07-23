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
