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
  <div v-if="!isLoginPage" class="app-nav">
    <a href="/" class="app-nav__link app-nav__link--brand" @click.prevent="router.push('/')">机房列表</a>
    <a href="/servers" class="app-nav__link" @click.prevent="router.push('/servers')">服务器管理</a>

    <span class="app-nav__user">
      {{ user?.username }}（{{ user?.role }}）
    </span>
    <button type="button" class="app-nav__logout" :disabled="submitting" @click="onLogout">登出</button>
    <span v-if="navError" class="app-nav__error">{{ navError }}</span>
  </div>

  <RouterView />
</template>

<style scoped>
.app-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-nav-bg);
  color: var(--color-text-inverse);
  font-size: var(--font-md);
}

.app-nav__link {
  color: var(--color-text-inverse);
  text-decoration: none;
  padding: var(--space-xs) 0;
}

.app-nav__link:hover {
  text-decoration: underline;
}

.app-nav__link--brand {
  font-weight: bold;
}

.app-nav__user {
  margin-left: auto;
  color: #b0b8c1;
  font-size: var(--font-sm);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-nav__logout {
  font-size: var(--font-sm);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: var(--radius);
  background: transparent;
  color: var(--color-text-inverse);
  cursor: pointer;
}

.app-nav__logout:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}

.app-nav__logout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-nav__error {
  color: var(--color-danger);
  font-size: var(--font-sm);
}
</style>
