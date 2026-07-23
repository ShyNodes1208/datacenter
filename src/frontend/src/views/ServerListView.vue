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
  <div>
    <div style="margin-bottom: 1em; display: flex; flex-wrap: wrap; gap: 0.5em; align-items: center">
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
        </select>
      </label>
      <button type="button" @click="doSearch">搜索</button>
      <button type="button" @click="clearSearch">清空</button>
    </div>

    <button v-if="canEdit" type="button" @click="goToNew" style="margin-bottom: 1em">
      新增服务器
    </button>

    <div v-if="error" role="alert" aria-live="polite">{{ error }}</div>

    <p v-else-if="servers === null">加载中...</p>

    <p v-else-if="servers.length === 0">暂无服务器</p>

    <table v-else style="border-collapse: collapse; width: 100%">
      <thead>
        <tr>
          <th>名称</th>
          <th>IP</th>
          <th>设备类型</th>
          <th>设备高度</th>
          <th>位置状态</th>
          <th>运行状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="server in servers" :key="server.id">
          <td>
            <a href="#" @click.prevent="goToDetail(server.id)">{{ server.name }}</a>
          </td>
          <td>{{ server.managementIP }}</td>
          <td>{{ server.deviceType }}</td>
          <td>{{ server.deviceHeight }}U</td>
          <td>{{ server.positionStatus }}</td>
          <td>{{ server.operationalStatus }}（人工维护）</td>
          <td>
            <a href="#" @click.prevent="goToDetail(server.id)">查看</a>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
