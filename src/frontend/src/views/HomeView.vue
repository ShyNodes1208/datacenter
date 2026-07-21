<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { user, logout } = useAuth()

const errorMessage = ref('')
const submitting = ref(false)

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
  </div>
</template>
