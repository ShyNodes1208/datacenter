<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import { useAuth } from '../composables/useAuth'
import { getDeviceColor } from '../utils/deviceColors'

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
  roomId?: string | null
  roomName?: string | null
  rackId?: string | null
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

type PortItem = {
  id: string
  serverId: string
  portName: string
  portType: string
  speed: string | null
  notes: string | null
  connectedCableId: string | null
  connectedToPortName: string | null
  connectedToServerName: string | null
  connectedToServerId: string | null
  connectedToRackCode: string | null
  connectedToURange: string | null
}

type ConnectPortOption = {
  id: string
  label: string
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
const ports = ref<PortItem[]>([])
const portsLoading = ref(false)
const portFormVisible = ref(false)
const portFormError = ref('')
const newPortName = ref('')
const newPortType = ref('')
const newPortSpeed = ref('')

const connectFormVisible = ref(false)
const connectSourcePortId = ref('')
const connectTargetPortId = ref('')
const connectCableType = ref('铜缆')
const connectFormError = ref('')
const connectPortOptions = ref<ConnectPortOption[]>([])
const connectPortsLoading = ref(false)

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
    roomId: parseOptionalId(record.roomId),
    roomName: typeof record.roomName === 'string' ? record.roomName : null,
    rackId: parseOptionalId(record.rackId),
    rackCode: typeof record.rackCode === 'string' ? record.rackCode : null,
    uRange: typeof record.uRange === 'string' ? record.uRange : null,
  }
}

function parseOptionalId(value: unknown): string | null {
  if (typeof value !== 'string' || value === '' || value === '00000000-0000-0000-0000-000000000000') {
    return null
  }
  return value
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

function opStatusClass(status: string): string {
  if (status === '正常') return 'status-tag status-tag--success'
  if (status === '异常') return 'status-tag status-tag--danger'
  if (status === '维护') return 'status-tag status-tag--warning'
  return 'status-tag'
}

function posStatusClass(status: string): string {
  if (status === '在架') return 'status-tag status-tag--success'
  if (status === '已下架') return 'status-tag status-tag--warning'
  return 'status-tag status-tag--muted'
}

function deviceTagStyle(type: string): Record<string, string> {
  const c = getDeviceColor(type, 0)
  return { background: c.background, color: c.text }
}

function parseOptionalGuid(value: unknown): string | null {
  if (typeof value !== 'string' || value === '' || value === '00000000-0000-0000-0000-000000000000') {
    return null
  }
  return value
}

function parsePortItem(raw: unknown): PortItem | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.id !== 'string' ||
    typeof r.serverId !== 'string' ||
    typeof r.portName !== 'string' ||
    typeof r.portType !== 'string'
  ) return null
  return {
    id: r.id,
    serverId: r.serverId,
    portName: r.portName,
    portType: r.portType,
    speed: typeof r.speed === 'string' ? r.speed : null,
    notes: typeof r.notes === 'string' ? r.notes : null,
    connectedCableId: parseOptionalGuid(r.connectedCableId),
    connectedToPortName: typeof r.connectedToPortName === 'string' ? r.connectedToPortName : null,
    connectedToServerName: typeof r.connectedToServerName === 'string' ? r.connectedToServerName : null,
    connectedToServerId: parseOptionalGuid(r.connectedToServerId),
    connectedToRackCode: typeof r.connectedToRackCode === 'string' ? r.connectedToRackCode : null,
    connectedToURange: typeof r.connectedToURange === 'string' ? r.connectedToURange : null,
  }
}

async function getCsrfToken(): Promise<string | null> {
  const csrfResult = await request('/api/auth/csrf', { method: 'GET' })
  if (!csrfResult.ok) return null
  return csrfResult.headers.get('X-XSRF-TOKEN')
}

async function loadPorts(): Promise<void> {
  portsLoading.value = true
  const result = await request<unknown>(`/api/servers/${serverId.value}/ports`, { method: 'GET' })
  if (!result.ok || !Array.isArray(result.data)) {
    ports.value = []
    portsLoading.value = false
    return
  }
  const parsed: PortItem[] = []
  for (const item of result.data) {
    const port = parsePortItem(item)
    if (port) parsed.push(port)
  }
  ports.value = parsed
  portsLoading.value = false
}

async function createPort(): Promise<void> {
  portFormError.value = ''
  if (!newPortName.value.trim()) {
    portFormError.value = '端口名称不能为空'
    return
  }
  if (!newPortType.value) {
    portFormError.value = '请选择端口类型'
    return
  }
  const token = await getCsrfToken()
  if (!token) {
    portFormError.value = '无法获取防伪令牌'
    return
  }
  const result = await request(`/api/servers/${serverId.value}/ports`, {
    method: 'POST',
    body: {
      portName: newPortName.value.trim(),
      portType: newPortType.value,
      speed: newPortSpeed.value.trim() || null,
      notes: null,
    },
    csrfToken: token,
  })
  if (!result.ok) {
    portFormError.value = result.error
    return
  }
  newPortName.value = ''
  newPortType.value = ''
  newPortSpeed.value = ''
  portFormVisible.value = false
  await loadPorts()
}

async function deletePort(id: string): Promise<void> {
  if (!confirm('确定删除此端口？')) return
  const token = await getCsrfToken()
  if (!token) {
    portFormError.value = '无法获取防伪令牌'
    return
  }
  const result = await request(`/api/ports/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    csrfToken: token,
  })
  if (!result.ok) {
    portFormError.value = result.error
    return
  }
  await loadPorts()
}

async function loadConnectPortOptions(): Promise<void> {
  try {
    const result = await request<unknown>('/api/ports/available', { method: 'GET' })
    if (!result.ok || !Array.isArray(result.data)) return

    const options: ConnectPortOption[] = []
    for (const item of result.data) {
      if (item === null || typeof item !== 'object') continue
      const p = item as Record<string, unknown>
      if (typeof p.id !== 'string' || typeof p.portName !== 'string' || typeof p.serverName !== 'string') continue
      if (p.id === connectSourcePortId.value) continue
      const rack = typeof p.rackCode === 'string' ? p.rackCode : null
      const rackHint = rack ? ` [${rack}]` : ''
      options.push({
        id: p.id,
        label: `${p.serverName} / ${p.portName}${rackHint}`,
      })
    }
    connectPortOptions.value = options
  } finally {
    connectPortsLoading.value = false
  }
}

function openConnect(portId: string): void {
  connectSourcePortId.value = portId
  connectTargetPortId.value = ''
  connectCableType.value = '铜缆'
  connectFormError.value = ''
  connectPortOptions.value = []
  connectPortsLoading.value = true
  connectFormVisible.value = true
  void loadConnectPortOptions()
}

async function createConnection(): Promise<void> {
  connectFormError.value = ''
  if (!connectTargetPortId.value) {
    connectFormError.value = '请选择目标端口'
    return
  }
  const token = await getCsrfToken()
  if (!token) {
    connectFormError.value = '无法获取防伪令牌'
    return
  }
  const result = await request('/api/cables', {
    method: 'POST',
    body: {
      sourcePortId: connectSourcePortId.value,
      targetPortId: connectTargetPortId.value,
      cableType: connectCableType.value,
      color: null,
      length: null,
    },
    csrfToken: token,
  })
  if (!result.ok) {
    connectFormError.value = result.error
    return
  }
  connectFormVisible.value = false
  await loadPorts()
}

function goToServer(id: string | null): void {
  if (!id) return
  router.push(`/servers/${encodeURIComponent(id)}`)
}

function goToTrace(portId: string): void {
  router.push({ path: '/network-trace', query: { sourcePortId: portId } })
}

onMounted(() => {
  void loadServer()
  void loadAuditRecords()
  void loadPorts()
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
          <dt>设备类型</dt>
          <dd>
            <span class="device-tag" :style="deviceTagStyle(server.deviceType)">{{ server.deviceType }}</span>
          </dd>
          <dt>设备高度</dt><dd>{{ server.deviceHeight }}U</dd>
          <dt>运行状态</dt>
          <dd><span :class="opStatusClass(server.operationalStatus)">{{ server.operationalStatus }}</span></dd>
          <dt>位置状态</dt>
          <dd><span :class="posStatusClass(server.positionStatus)">{{ server.positionStatus }}</span></dd>
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
          <p><span class="status-tag status-tag--muted">未上架</span></p>
        </template>
        <template v-else-if="server.positionStatus === '已下架'">
          <p><span class="status-tag status-tag--warning">已下架</span></p>
          <p v-if="server.roomName">原机房：{{ server.roomName }}</p>
          <p v-if="server.rackCode">原机柜：{{ server.rackCode }}</p>
          <p v-if="server.uRange">原 U 位：{{ server.uRange }}</p>
        </template>
        <template v-else>
          <p><span class="status-tag status-tag--success">在架</span></p>
          <p>
            机房：
            <a
              v-if="server.roomId"
              href="#"
              @click.prevent="router.push(`/rooms/${server.roomId}/floorplan`)"
            >{{ server.roomName }}</a>
            <span v-else>{{ server.roomName ?? '-' }}</span>
          </p>
          <p>
            机柜：
            <a
              v-if="server.rackId"
              href="#"
              @click.prevent="router.push(`/racks/${encodeURIComponent(server.rackId)}`)"
            >{{ server.rackCode }}</a>
            <span v-else>{{ server.rackCode ?? '-' }}</span>
          </p>
          <p>U 位范围：{{ server.uRange ?? '-' }}</p>
        </template>
      </section>

      <section class="card">
        <h3 class="card__title">端口与连接</h3>
        <p v-if="portsLoading">加载中...</p>
        <p v-else-if="ports.length === 0" class="muted">暂无端口</p>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>端口名</th><th>类型</th><th>速率</th><th>连接状态</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="port in ports" :key="port.id">
              <td>{{ port.portName }}</td>
              <td>{{ port.portType }}</td>
              <td>{{ port.speed ?? '-' }}</td>
              <td>
                <span v-if="port.connectedToServerName" class="connected-link">
                  → <a href="#" @click.prevent="goToServer(port.connectedToServerId)">{{ port.connectedToServerName }}</a>
                  ({{ port.connectedToPortName }}) ·
                  <template v-if="port.connectedToRackCode && port.connectedToURange">
                    机柜 {{ port.connectedToRackCode }} · U{{ port.connectedToURange }}
                  </template>
                  <template v-else>未上架</template>
                </span>
                <span v-else class="muted">未连接</span>
              </td>
              <td>
                <button
                  v-if="port.connectedCableId"
                  type="button"
                  class="btn btn--small"
                  @click="goToTrace(port.id)"
                >线路追踪</button>
                <span v-else class="muted">未连接，无法追踪</span>
                <button v-if="canEdit && !port.connectedCableId" type="button" class="btn btn--small" @click="openConnect(port.id)">连接</button>
                <button v-if="canEdit && !port.connectedCableId" type="button" class="btn btn--small btn--danger" @click="deletePort(port.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="portFormError" class="error">{{ portFormError }}</p>
        <div v-if="canEdit && portFormVisible" class="port-form">
          <input v-model="newPortName" placeholder="端口名 (如 GE0/0/1)" />
          <select v-model="newPortType">
            <option value="">选择类型</option>
            <option>RJ45</option><option>SFP+</option><option>QSFP28</option><option>LC</option>
          </select>
          <input v-model="newPortSpeed" placeholder="速率 (如 10G)" />
          <button type="button" class="btn btn--primary btn--small" @click="createPort">添加</button>
          <button type="button" class="btn btn--small" @click="portFormVisible = false">取消</button>
        </div>
        <button v-if="canEdit && !portFormVisible" type="button" class="btn btn--small" @click="portFormVisible = true">+ 添加端口</button>

        <div v-if="connectFormVisible" class="connect-form">
          <h4>连接线缆</h4>
          <p v-if="connectFormError" class="error">{{ connectFormError }}</p>
          <select
            v-model="connectTargetPortId"
            class="connect-select"
            :disabled="connectPortsLoading"
          >
            <option value="">
              {{ connectPortsLoading ? '加载中...' : connectPortOptions.length === 0 ? '无可用端口' : '选择目标端口' }}
            </option>
            <option v-for="opt in connectPortOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
          </select>
          <select v-model="connectCableType" class="connect-select">
            <option value="铜缆">铜缆</option>
            <option value="光纤">光纤</option>
            <option value="DAC">DAC</option>
          </select>
          <div class="connect-actions">
            <button type="button" class="btn btn--primary btn--small" @click="createConnection">创建连接</button>
            <button type="button" class="btn btn--small" @click="connectFormVisible = false">取消</button>
          </div>
        </div>
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

.card a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.card a:hover {
  text-decoration: underline;
}

.status-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: var(--font-sm);
  font-weight: 500;
}

.status-tag--success {
  background: #e6f7e6;
  color: #2d8a2d;
}

.status-tag--danger {
  background: #fde8e8;
  color: #c0392b;
}

.status-tag--warning {
  background: #fef3e0;
  color: #b8731f;
}

.status-tag--muted {
  background: #eef1f5;
  color: #666;
}

.device-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: var(--font-sm);
  font-weight: 500;
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

.btn--small {
  font-size: var(--font-sm);
  padding: 2px var(--space-sm);
}

.btn--danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.port-form,
.connect-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  align-items: center;
}

.port-form input,
.port-form select,
.connect-select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: var(--font-sm);
}

.connect-form {
  flex-direction: column;
  align-items: stretch;
  padding: var(--space-sm);
  background: var(--color-bg);
  border-radius: var(--radius);
  margin-top: var(--space-md);
}

.connect-form h4 {
  margin: 0;
  font-size: var(--font-md);
}

.connect-actions {
  display: flex;
  gap: var(--space-sm);
}

.connected-link a {
  color: var(--color-primary);
  text-decoration: none;
}

.connected-link a:hover {
  text-decoration: underline;
}
</style>
