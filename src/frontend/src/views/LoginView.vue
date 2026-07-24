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
  <div class="login-page">
    <form class="login-card" @submit.prevent="onSubmit">
      <h1 class="login-card__title">机房服务器落位可视化系统</h1>
      <label class="login-card__field">
        用户名
        <input v-model="username" name="username" type="text" autocomplete="username" />
      </label>
      <label class="login-card__field">
        密码
        <input v-model="password" name="password" type="password" autocomplete="current-password" />
      </label>
      <button class="login-card__submit" type="submit" :disabled="submitting">登录</button>
      <div class="login-card__error" role="alert" aria-live="polite">{{ errorMessage }}</div>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  padding: var(--space-md);
}

.login-card {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--color-bg-card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  border: 1px solid var(--color-border);
}

.login-card__title {
  margin: 0;
  font-size: var(--font-lg);
  color: var(--color-text);
  text-align: center;
  line-height: 1.4;
}

.login-card__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--font-md);
  color: var(--color-text);
}

.login-card__field input {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: var(--font-md);
}

.login-card__submit {
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-sm);
  border: none;
  border-radius: var(--radius);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--font-md);
  cursor: pointer;
}

.login-card__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-card__error {
  color: var(--color-danger);
  font-size: var(--font-sm);
  text-align: center;
}
</style>
