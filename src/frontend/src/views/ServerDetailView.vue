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

type AuditRecordItem = {
  id: string
  operationType: string
  fromPosition: string | null
  toPosition: string | null
  operatorUsername: string
  operatedAt: string
  notes: string | null
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
const auditRecords = ref<AuditRecordItem[] | null>(null)

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

async function loadAuditRecords(): Promise<void> {
  const result = await request<AuditRecordItem[]>(
    `/api/servers/${serverId.value}/audit-records`,
    { method: 'GET' },
  )
  if (result.ok && Array.isArray(result.data)) {
    auditRecords.value = result.data
  } else {
    auditRecords.value = []
  }
}

function formatOperatedAt(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function opTypeClass(type: string): string {
  if (type === '上架') return 'tag tag--success'
  if (type === '移动') return 'tag tag--primary'
  if (type === '下架') return 'tag tag--warning'
  return 'tag'
}

onMounted(() => {
  void loadServer()
  void loadAuditRecords()
})
</script>

<template>
  <div class="server-detail">
    <p class="breadcrumb">
      <a href="#" @click.prevent="router.push('/servers')">服务器列表</a>
      &gt; {{ server?.name ?? '...' }}
    </p>

    <div v-if="error" class="error" role="alert" aria-live="polite">{{ error }}</div>

    <p v-else-if="server === null">加载中...</p>

    <div v-else class="detail-body">
      <section class="card">
        <h3 class="card__title">基本信息</h3>
        <dl class="kv-grid">
          <dt>名称</dt><dd>{{ server.name }}</dd>
          <dt>管理 IP</dt><dd>{{ server.managementIP }}</dd>
          <dt>资产编号</dt><dd>{{ server.assetNumber ?? '-' }}</dd>
          <dt>设备类型</dt><dd>{{ server.deviceType }}</dd>
          <dt>设备高度</dt><dd>{{ server.deviceHeight }}U</dd>
          <dt>运行状态</dt><dd>{{ server.operationalStatus }}（人工维护）</dd>
          <dt>位置状态</dt><dd>{{ server.positionStatus }}</dd>
          <template v-if="server.system">
            <dt>所属系统</dt><dd>{{ server.system }}</dd>
          </template>
          <template v-if="server.owner">
            <dt>负责人</dt><dd>{{ server.owner }}</dd>
          </template>
          <template v-if="server.notes">
            <dt>备注</dt><dd>{{ server.notes }}</dd>
          </template>
        </dl>
      </section>

      <section class="card">
        <h3 class="card__title">当前位置</h3>
        <template v-if="server.positionStatus === '未上架'">
          <p class="muted">未上架</p>
        </template>
        <template v-else>
          <p>机房：{{ server.roomName ?? '-' }}</p>
          <p>机柜：{{ server.rackCode ?? '-' }}</p>
          <p>U 位范围：{{ server.uRange ?? '-' }}</p>
        </template>
      </section>

      <section class="card">
        <h3 class="card__title">操作记录</h3>
        <p v-if="auditRecords === null" class="muted">加载中...</p>
        <p v-else-if="auditRecords.length === 0" class="muted">暂无操作记录</p>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>操作类型</th>
              <th>原位置</th>
              <th>新位置</th>
              <th>操作人</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in auditRecords" :key="r.id">
              <td><span :class="opTypeClass(r.operationType)">{{ r.operationType }}</span></td>
              <td class="muted">{{ r.fromPosition ?? '-' }}</td>
              <td class="muted">{{ r.toPosition ?? '-' }}</td>
              <td>{{ r.operatorUsername }}</td>
              <td class="nowrap">{{ formatOperatedAt(r.operatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="actions">
        <button v-if="canEdit" type="button" class="btn btn--primary" @click="goToEdit">编辑</button>
        <button type="button" class="btn" @click="goBack">返回</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.server-detail {
  padding: var(--space-md);
  color: var(--color-text);
  font-size: var(--font-md);
}

.breadcrumb {
  margin: 0 0 var(--space-md);
  color: var(--color-text-secondary);
  font-size: var(--font-sm);
}

.breadcrumb a {
  color: var(--color-primary);
  text-decoration: none;
}

.error {
  color: var(--color-danger);
}

.card {
  margin-bottom: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.card__title {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-lg);
}

.kv-grid {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: var(--space-sm) var(--space-md);
  margin: 0;
}

.kv-grid dt {
  font-weight: bold;
  color: var(--color-text-secondary);
}

.kv-grid dd {
  margin: 0;
}

.muted {
  color: var(--color-text-secondary);
  margin: 0;
}

.card p {
  margin: 0 0 var(--space-xs);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-sm);
}

.data-table th {
  text-align: left;
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-table-header);
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.data-table td {
  padding: var(--space-xs) var(--space-sm);
  border-bottom: 1px solid var(--color-border);
}

.data-table tbody tr:nth-child(even) {
  background: var(--color-table-stripe);
}

.tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: var(--radius);
  font-size: var(--font-sm);
  color: #fff;
  background: var(--color-text-secondary);
}

.tag--success {
  background: var(--color-success);
}

.tag--primary {
  background: var(--color-primary);
}

.tag--warning {
  background: var(--color-warning);
  color: var(--color-text);
}

.nowrap {
  white-space: nowrap;
}

.actions {
  display: flex;
  gap: var(--space-sm);
}

.btn {
  padding: var(--space-xs) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: var(--font-md);
  cursor: pointer;
}

.btn--primary {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}
</style>
