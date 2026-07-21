<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { login } = useAuth()

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const submitting = ref(false)

async function onSubmit(): Promise<void> {
  if (submitting.value) {
    return
  }

  submitting.value = true
  errorMessage.value = ''

  const result = await login(username.value, password.value)
  if (result.ok) {
    password.value = ''
    await router.push('/')
  } else {
    errorMessage.value = result.error
    password.value = ''
  }

  submitting.value = false
}
</script>

<template>
  <form @submit.prevent="onSubmit">
    <label>
      用户名
      <input v-model="username" name="username" type="text" autocomplete="username" />
    </label>
    <label>
      密码
      <input v-model="password" name="password" type="password" autocomplete="current-password" />
    </label>
    <button type="submit" :disabled="submitting">登录</button>
    <div role="alert" aria-live="polite">{{ errorMessage }}</div>
  </form>
</template>
