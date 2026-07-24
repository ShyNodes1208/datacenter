<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'

type ServerItem = {
  id: string
  name: string
  managementIP: string
  assetNumber: string | null
  deviceType: string
  deviceHeight: number
  operationalStatus: string
  positionStatus: string
  system: string | null
  owner: string | null
  notes: string | null
}

const EDIT_ROLES = ['机房管理员', '运维人员']

const router = useRouter()
const { user } = useAuth()
const { request } = useApi()

const canEdit = computed(() => {
  const role = user.value?.role
  return role !== undefined && EDIT_ROLES.includes(role)
})

const servers = ref<ServerItem[] | null>(null)
const error = ref('')

const searchName = ref('')
const searchIP = ref('')
const searchPositionStatus = ref('')
const searchOperationalStatus = ref('')

async function loadServers(): Promise<void> {
  error.value = ''

  const params = new URLSearchParams()
  if (searchName.value.trim()) params.set('name', searchName.value.trim())
  if (searchIP.value.trim()) params.set('ip', searchIP.value.trim())
  if (searchPositionStatus.value) params.set('positionStatus', searchPositionStatus.value)
  if (searchOperationalStatus.value) params.set('operationalStatus', searchOperationalStatus.value)

  const query = params.toString()
  const url = query ? `/api/servers?${query}` : '/api/servers'

  const result = await request<unknown>(url, { method: 'GET' })
  if (!result.ok) {
    servers.value = null
    error.value = result.error
    return
  }

  if (!Array.isArray(result.data)) {
    servers.value = null
    error.value = 'Request failed.'
    return
  }

  const parsed: ServerItem[] = []
  for (const item of result.data) {
    if (item === null || typeof item !== 'object') {
      servers.value = null
      error.value = 'Request failed.'
      return
    }
    const record = item as Record<string, unknown>
    if (
      typeof record.id !== 'string' ||
      typeof record.name !== 'string' ||
      typeof record.managementIP !== 'string' ||
      typeof record.deviceType !== 'string' ||
      typeof record.deviceHeight !== 'number' ||
      typeof record.operationalStatus !== 'string' ||
      typeof record.positionStatus !== 'string'
    ) {
      servers.value = null
      error.value = 'Request failed.'
      return
    }
    parsed.push({
      id: record.id,
      name: record.name,
      managementIP: record.managementIP,
      assetNumber: typeof record.assetNumber === 'string' ? record.assetNumber : null,
      deviceType: record.deviceType,
      deviceHeight: record.deviceHeight,
      operationalStatus: record.operationalStatus,
      positionStatus: record.positionStatus,
      system: typeof record.system === 'string' ? record.system : null,
      owner: typeof record.owner === 'string' ? record.owner : null,
      notes: typeof record.notes === 'string' ? record.notes : null,
    })
  }

  servers.value = parsed
}

function doSearch(): void {
  void loadServers()
}

function clearSearch(): void {
  searchName.value = ''
  searchIP.value = ''
  searchPositionStatus.value = ''
  searchOperationalStatus.value = ''
  void loadServers()
}

function goToDetail(id: string): void {
  router.push(`/servers/${id}`)
}

function goToNew(): void {
  router.push('/servers/new')
}

onMounted(() => {
  void loadServers()
})
</script>

<template>
  <div class="server-list">
    <div class="search-card">
      <label>
        名称
        <input v-model="searchName" type="text" placeholder="名称" />
      </label>
      <label>
        IP
        <input v-model="searchIP" type="text" placeholder="IP" />
      </label>
      <label>
        位置状态
        <select v-model="searchPositionStatus">
          <option value="">全部</option>
          <option value="在架">在架</option>
          <option value="未上架">未上架</option>
          <option value="已下架">已下架</option>
        </select>
      </label>
      <label>
        运行状态
        <select v-model="searchOperationalStatus">
          <option value="">全部</option>
          <option value="正常">正常</option>
          <option value="异常">异常</option>
          <option value="维护">维护</option>
        </select>
      </label>
      <button type="button" class="btn" @click="doSearch">搜索</button>
      <button type="button" class="btn btn--muted" @click="clearSearch">清空</button>
    </div>

    <button v-if="canEdit" type="button" class="btn btn--primary" @click="goToNew">
      新增服务器
    </button>

    <div v-if="error" class="error" role="alert" aria-live="polite">{{ error }}</div>

    <p v-else-if="servers === null">加载中...</p>

    <p v-else-if="servers.length === 0">暂无服务器</p>

    <table v-else class="data-table">
      <thead>
        <tr>
          <th style="width: 12%">名称</th>
          <th style="width: 16%">IP</th>
          <th style="width: 12%">设备类型</th>
          <th style="width: 10%">设备高度</th>
          <th style="width: 10%">位置状态</th>
          <th style="width: 25%">运行状态</th>
          <th style="width: 15%">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="server in servers" :key="server.id">
          <td class="ellipsis">
            <a href="#" @click.prevent="goToDetail(server.id)">{{ server.name }}</a>
          </td>
          <td class="ellipsis">{{ server.managementIP }}</td>
          <td>{{ server.deviceType }}</td>
          <td>{{ server.deviceHeight }}U</td>
          <td>{{ server.positionStatus }}</td>
          <td>{{ server.operationalStatus }}（人工维护）</td>
          <td>
            <button type="button" class="btn btn--small" @click="goToDetail(server.id)">查看</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.server-list {
  padding: var(--space-md);
  color: var(--color-text);
  font-size: var(--font-md);
}

.search-card {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
  margin-bottom: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.search-card label {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.search-card input,
.search-card select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: var(--font-md);
}

.btn {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: var(--font-md);
  cursor: pointer;
}

.btn--primary {
  margin-bottom: var(--space-md);
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.btn--muted {
  color: var(--color-text-secondary);
}

.btn--small {
  font-size: var(--font-sm);
  padding: 2px var(--space-sm);
}

.error {
  color: var(--color-danger);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
}

.data-table th {
  text-align: left;
  padding: var(--space-sm);
  background: var(--color-table-header);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-sm);
  color: var(--color-text-secondary);
}

.data-table td {
  padding: var(--space-sm);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-md);
}

.data-table tbody tr:nth-child(even) {
  background: var(--color-table-stripe);
}

.data-table tbody tr:hover {
  background: var(--color-table-hover);
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-table a {
  color: var(--color-primary);
  text-decoration: none;
}

.data-table a:hover {
  text-decoration: underline;
}
</style>
