<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'

type ServerDetail = {
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
  roomName?: string | null
  rackCode?: string | null
  uRange?: string | null
}

const EDIT_ROLES = ['机房管理员', '运维人员']

const route = useRoute()
const router = useRouter()
const { user } = useAuth()
const { request } = useApi()

const serverId = computed(() => route.params.id as string)

const canEdit = computed(() => {
  const role = user.value?.role
  return role !== undefined && EDIT_ROLES.includes(role)
})

const server = ref<ServerDetail | null>(null)
const error = ref('')

async function loadServer(): Promise<void> {
  error.value = ''

  const result = await request<unknown>(`/api/servers/${serverId.value}`, { method: 'GET' })
  if (!result.ok) {
    server.value = null
    error.value = result.error
    return
  }

  const data = result.data
  if (data === null || typeof data !== 'object') {
    server.value = null
    error.value = 'Request failed.'
    return
  }

  const record = data as Record<string, unknown>
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.managementIP !== 'string' ||
    typeof record.deviceType !== 'string' ||
    typeof record.deviceHeight !== 'number' ||
    typeof record.operationalStatus !== 'string' ||
    typeof record.positionStatus !== 'string'
  ) {
    server.value = null
    error.value = 'Request failed.'
    return
  }

  server.value = {
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
    roomName: typeof record.roomName === 'string' ? record.roomName : null,
    rackCode: typeof record.rackCode === 'string' ? record.rackCode : null,
    uRange: typeof record.uRange === 'string' ? record.uRange : null,
  }
}

function goToEdit(): void {
  router.push(`/servers/${serverId.value}/edit`)
}

function goBack(): void {
  router.push('/servers')
}

onMounted(() => {
  void loadServer()
})
</script>

<template>
  <div>
    <p>
      <a href="#" @click.prevent="router.push('/servers')">服务器列表</a>
      &gt; {{ server?.name ?? '...' }}
    </p>

    <div v-if="error" role="alert" aria-live="polite">{{ error }}</div>

    <p v-else-if="server === null">加载中...</p>

    <div v-else>
      <table style="border-collapse: collapse; margin-bottom: 1em">
        <tbody>
          <tr>
            <td style="font-weight: bold; padding: 0.3em 0.5em">名称</td>
            <td style="padding: 0.3em 0.5em">{{ server.name }}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 0.3em 0.5em">管理 IP</td>
            <td style="padding: 0.3em 0.5em">{{ server.managementIP }}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 0.3em 0.5em">资产编号</td>
            <td style="padding: 0.3em 0.5em">{{ server.assetNumber ?? '-' }}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 0.3em 0.5em">设备类型</td>
            <td style="padding: 0.3em 0.5em">{{ server.deviceType }}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 0.3em 0.5em">设备高度</td>
            <td style="padding: 0.3em 0.5em">{{ server.deviceHeight }}U</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 0.3em 0.5em">运行状态</td>
            <td style="padding: 0.3em 0.5em">{{ server.operationalStatus }}（人工维护）</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 0.3em 0.5em">位置状态</td>
            <td style="padding: 0.3em 0.5em">{{ server.positionStatus }}</td>
          </tr>
          <tr v-if="server.system">
            <td style="font-weight: bold; padding: 0.3em 0.5em">所属系统</td>
            <td style="padding: 0.3em 0.5em">{{ server.system }}</td>
          </tr>
          <tr v-if="server.owner">
            <td style="font-weight: bold; padding: 0.3em 0.5em">负责人</td>
            <td style="padding: 0.3em 0.5em">{{ server.owner }}</td>
          </tr>
          <tr v-if="server.notes">
            <td style="font-weight: bold; padding: 0.3em 0.5em">备注</td>
            <td style="padding: 0.3em 0.5em">{{ server.notes }}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-bottom: 1em; padding: 0.5em; border: 1px solid #ccc">
        <p style="font-weight: bold; margin: 0 0 0.5em 0">当前位置</p>
        <template v-if="server.positionStatus === '未上架'">
          <p style="margin: 0; color: #888">未上架</p>
        </template>
        <template v-else>
          <p style="margin: 0">机房：{{ server.roomName ?? '-' }}</p>
          <p style="margin: 0">机柜：{{ server.rackCode ?? '-' }}</p>
          <p style="margin: 0">U 位范围：{{ server.uRange ?? '-' }}</p>
        </template>
      </div>

      <div style="display: flex; gap: 0.5em">
        <button v-if="canEdit" type="button" @click="goToEdit">编辑</button>
        <button type="button" @click="goBack">返回</button>
      </div>
    </div>
  </div>
</template>
