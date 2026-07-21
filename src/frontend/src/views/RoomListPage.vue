<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'

interface Room {
  id: number
  name: string
  location: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

const router = useRouter()
const api = useApi()
const { user } = useAuth()

const rooms = ref<Room[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const showCreateForm = ref(false)
const createName = ref('')
const createLocation = ref('')
const createNotes = ref('')
const createError = ref<string | null>(null)
const creating = ref(false)

const canModify = computed(() =>
  user.value?.role === '机房管理员' || user.value?.role === '运维人员'
)

async function fetchRooms(): Promise<void> {
  loading.value = true
  error.value = null
  const result = await api.request<Room[]>('/api/rooms', { method: 'GET' })
  if (result.ok) {
    rooms.value = result.data
  } else {
    error.value = result.error
  }
  loading.value = false
}

async function getCsrfToken(): Promise<string | null> {
  const result = await api.request('/api/auth/csrf', { method: 'GET' })
  if (!result.ok) return null
  return result.headers.get('X-XSRF-TOKEN')
}

function openCreateForm(): void {
  createName.value = ''
  createLocation.value = ''
  createNotes.value = ''
  createError.value = null
  showCreateForm.value = true
}

function cancelCreate(): void {
  showCreateForm.value = false
  createName.value = ''
  createLocation.value = ''
  createNotes.value = ''
  createError.value = null
}

async function submitCreate(): Promise<void> {
  if (creating.value) return
  creating.value = true
  createError.value = null

  const token = await getCsrfToken()
  if (!token) {
    createError.value = 'Request failed.'
    creating.value = false
    return
  }

  const result = await api.request<Room>('/api/rooms', {
    method: 'POST',
    body: { name: createName.value, location: createLocation.value || null, notes: createNotes.value || null },
    csrfToken: token,
  })

  if (result.ok) {
    rooms.value.push(result.data)
    cancelCreate()
  } else {
    createError.value = result.error
  }

  creating.value = false
}

function goToDetail(id: number): void {
  router.push(`/rooms/${id}`)
}

await fetchRooms()
</script>

<template>
  <div>
    <h1>机房列表</h1>

    <div v-if="error" role="alert">{{ error }}</div>

    <div v-else-if="loading">加载中...</div>

    <div v-else-if="!rooms.length">
      <p>暂无机房，请创建第一个机房</p>
    </div>

    <table v-else>
      <thead>
        <tr>
          <th>名称</th>
          <th>位置</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="room in rooms" :key="room.id" @click="goToDetail(room.id)" style="cursor: pointer;">
          <td>{{ room.name }}</td>
          <td>{{ room.location || '—' }}</td>
        </tr>
      </tbody>
    </table>

    <button v-if="canModify && !showCreateForm" type="button" @click="openCreateForm">
      新建机房
    </button>

    <form v-if="showCreateForm" @submit.prevent="submitCreate">
      <h2>新建机房</h2>
      <label>
        名称
        <input v-model="createName" type="text" required />
      </label>
      <label>
        位置
        <input v-model="createLocation" type="text" />
      </label>
      <label>
        备注
        <textarea v-model="createNotes"></textarea>
      </label>
      <div v-if="createError" role="alert">{{ createError }}</div>
      <button type="submit" :disabled="creating">创建</button>
      <button type="button" @click="cancelCreate">取消</button>
    </form>
  </div>
</template>
