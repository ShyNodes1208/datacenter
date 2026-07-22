<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'

type RoomItem = {
  name: string
  status: string
}

const router = useRouter()
const { user, logout } = useAuth()
const { request } = useApi()

const errorMessage = ref('')
const submitting = ref(false)

/** null = not finished loading; empty array = loaded empty list */
const rooms = ref<RoomItem[] | null>(null)
const roomsError = ref('')

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
    if (typeof record.name !== 'string' || typeof record.status !== 'string') {
      rooms.value = null
      roomsError.value = 'Request failed.'
      return
    }
    parsed.push({ name: record.name, status: record.status })
  }

  rooms.value = parsed
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

    <section aria-label="机房列表">
      <div v-if="roomsError" role="alert" aria-live="polite">{{ roomsError }}</div>
      <p v-else-if="rooms !== null && rooms.length === 0">暂无机房</p>
      <ul v-else-if="rooms !== null">
        <li v-for="(room, index) in rooms" :key="index">
          <span>{{ room.name }}</span>
          <span>{{ room.status }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
