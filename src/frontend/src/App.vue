<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from './composables/useAuth'

const route = useRoute()
const router = useRouter()
const { user, logout } = useAuth()

const isLoginPage = computed(() => route.path === '/login')

const submitting = ref(false)
const navError = ref('')

async function onLogout(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  navError.value = ''

  const result = await logout()
  if (result.ok) {
    await router.push('/login')
  } else {
    navError.value = result.error
  }
  submitting.value = false
}
</script>

<template>
  <div v-if="!isLoginPage" style="padding: 0.5em 1em; border-bottom: 1px solid #ccc; display: flex; align-items: center; gap: 1em; font-size: 14px">
    <a href="/" @click.prevent="router.push('/')" style="font-weight: bold; text-decoration: none; color: #333">机房列表</a>
    <a href="/servers" @click.prevent="router.push('/servers')" style="text-decoration: none; color: #333">服务器管理</a>

    <span style="margin-left: auto; color: #666">
      {{ user?.username }}（{{ user?.role }}）
    </span>
    <button type="button" :disabled="submitting" @click="onLogout" style="font-size: 12px">登出</button>
    <span v-if="navError" style="color: red; font-size: 12px">{{ navError }}</span>
  </div>

  <RouterView />
</template>
