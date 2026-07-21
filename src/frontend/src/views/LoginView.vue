<script setup lang="ts">
import { ref } from 'vue'

const username = ref('')
const password = ref('')
const errorMessage = ref('')
</script>

<template>
  <form @submit.prevent>
    <label>
      用户名
      <input v-model="username" name="username" type="text" autocomplete="username" />
    </label>
    <label>
      密码
      <input v-model="password" name="password" type="password" autocomplete="current-password" />
    </label>
    <button type="submit">登录</button>
    <div role="alert" aria-live="polite">{{ errorMessage }}</div>
  </form>
</template>
