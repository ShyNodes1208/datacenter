<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'

type AuditRecord = {
  id: string
  serverId: string
  serverName: string
  operationType: string
  fromPosition: string | null
  toPosition: string | null
  operatorUsername: string
  operatedAt: string
  notes: string | null
}

const router = useRouter()
const { request } = useApi()

const from = ref('')
const to = ref('')
const operatorUsername = ref('')
const operationType = ref('')
const serverName = ref('')
const records = ref<AuditRecord[]>([])
const loading = ref(false)
const error = ref('')

async function loadRecords(): Promise<void> {
  error.value = ''
  loading.value = true
  const params = new URLSearchParams()
  if (from.value) params.set('from', from.value)
  if (to.value) params.set('to', to.value)
  if (operatorUsername.value.trim()) params.set('operatorUsername', operatorUsername.value.trim())
  if (operationType.value) params.set('operationType', operationType.value)
  if (serverName.value.trim()) params.set('serverName', serverName.value.trim())
  const query = params.toString()
  const result = await request<AuditRecord[]>(
    query ? `/api/servers/audit-records?${query}` : '/api/servers/audit-records',
    { method: 'GET' },
  )
  loading.value = false

  if (!result.ok || !Array.isArray(result.data)) {
    records.value = []
    error.value = result.ok ? 'Request failed.' : result.error
    return
  }
  records.value = result.data
}

function goToServer(serverId: string): void {
  router.push('/servers/' + encodeURIComponent(serverId))
}
</script>

<template>
  <main class="audit-records">
    <h1>变更记录</h1>
    <form class="filter-form" @submit.prevent="loadRecords">
      <label>开始日期 <input v-model="from" name="from" type="date" /></label>
      <label>结束日期 <input v-model="to" name="to" type="date" /></label>
      <label>操作人 <input v-model="operatorUsername" name="operatorUsername" type="text" /></label>
      <label>操作类型
        <select v-model="operationType" name="operationType">
          <option value="">全部</option>
          <option value="上架">上架</option>
          <option value="移动">移动</option>
          <option value="下架">下架</option>
        </select>
      </label>
      <label>服务器名称 <input v-model="serverName" name="serverName" type="text" /></label>
      <button type="submit" class="btn btn--primary" :disabled="loading">{{ loading ? '查询中...' : '查询' }}</button>
    </form>

    <p v-if="loading">加载中...</p>
    <div v-else-if="error" class="error" role="alert" aria-live="polite">{{ error }}</div>
    <p v-else-if="records.length === 0" class="muted">暂无变更记录</p>
    <table v-else class="data-table">
      <thead>
        <tr><th>服务器</th><th>操作类型</th><th>变更前位置</th><th>变更后位置</th><th>操作人</th><th>操作时间</th><th>备注</th></tr>
      </thead>
      <tbody>
        <tr v-for="record in records" :key="record.id">
          <td><a href="#" @click.prevent="goToServer(record.serverId)">{{ record.serverName }}</a></td>
          <td>{{ record.operationType }}</td>
          <td>{{ record.fromPosition ?? '-' }}</td>
          <td>{{ record.toPosition ?? '-' }}</td>
          <td>{{ record.operatorUsername }}</td>
          <td>{{ record.operatedAt }}</td>
          <td>{{ record.notes ?? '-' }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<style scoped>
.audit-records { padding: var(--space-md); color: var(--color-text); }
.filter-form { display: flex; flex-wrap: wrap; align-items: end; gap: var(--space-sm); margin-bottom: var(--space-md); }
.filter-form label { display: grid; gap: var(--space-xs); }
.filter-form input, .filter-form select { min-height: 32px; }
</style>
