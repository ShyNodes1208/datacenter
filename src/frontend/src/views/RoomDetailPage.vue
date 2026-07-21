<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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

const route = useRoute()
const router = useRouter()
const api = useApi()
const { user } = useAuth()

const room = ref<Room | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const editing = ref(false)
const editName = ref('')
const editLocation = ref('')
const editNotes = ref('')
const saveError = ref<string | null>(null)
const saving = ref(false)

const canEdit = computed(() =>
  user.value?.role === '机房管理员' || user.value?.role === '运维人员'
)

async function fetchRoom(): Promise<void> {
  loading.value = true
  error.value = null
  const id = route.params.id as string
  const result = await api.request<Room>(`/api/rooms/${id}`, { method: 'GET' })
  if (result.ok) {
    room.value = result.data
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

function startEdit(): void {
  if (!room.value) return
  editName.value = room.value.name
  editLocation.value = room.value.location ?? ''
  editNotes.value = room.value.notes ?? ''
  saveError.value = null
  editing.value = true
}

function cancelEdit(): void {
  editing.value = false
  saveError.value = null
}

async function save(): Promise<void> {
  if (saving.value || !room.value) return
  saving.value = true
  saveError.value = null

  const token = await getCsrfToken()
  if (!token) {
    saveError.value = 'Request failed.'
    saving.value = false
    return
  }

  const body: Record<string, string | null> = {
    name: editName.value || null,
    location: editLocation.value || null,
    notes: editNotes.value || null,
  }

  const result = await api.request<Room>(`/api/rooms/${room.value.id}`, {
    method: 'PUT',
    body,
    csrfToken: token,
  })

  if (result.ok) {
    room.value = result.data
    editing.value = false
  } else {
    saveError.value = result.error
  }

  saving.value = false
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

function goBack(): void {
  router.push('/rooms')
}

await fetchRoom()
</script>

<template>
  <div>
    <div v-if="error" role="alert">{{ error }}</div>

    <div v-else-if="loading">加载中...</div>

    <template v-else-if="room">
      <h1>{{ room.name }}</h1>

      <!-- View mode -->
      <dl v-if="!editing">
        <dt>名称</dt>
        <dd>{{ room.name }}</dd>
        <dt>位置</dt>
        <dd>{{ room.location || '—' }}</dd>
        <dt>备注</dt>
        <dd>{{ room.notes || '—' }}</dd>
        <dt>创建时间</dt>
        <dd>{{ formatDate(room.createdAt) }}</dd>
        <dt>更新时间</dt>
        <dd>{{ formatDate(room.updatedAt) }}</dd>
      </dl>

      <!-- Edit mode -->
      <form v-else @submit.prevent="save">
        <label>
          名称
          <input v-model="editName" type="text" required />
        </label>
        <label>
          位置
          <input v-model="editLocation" type="text" />
        </label>
        <label>
          备注
          <textarea v-model="editNotes"></textarea>
        </label>
        <div v-if="saveError" role="alert">{{ saveError }}</div>
        <button type="submit" :disabled="saving">保存</button>
        <button type="button" @click="cancelEdit">取消</button>
      </form>

      <button v-if="canEdit && !editing" type="button" @click="startEdit">编辑</button>
      <a @click.prevent="goBack" href="/rooms">← 返回列表</a>
    </template>
  </div>
</template>
