<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'
import {
  type NetworkPath,
  type ReachableNetworkPath,
  useNetworkTrace,
} from '../composables/useNetworkTrace'

type TargetServer = {
  id: string
  name: string
}

const route = useRoute()
const router = useRouter()
const { request } = useApi()
const { findPath, findReachable: requestReachable } = useNetworkTrace()

const sourcePortId = computed(() => {
  const value = route.query.sourcePortId
  return typeof value === 'string' ? value : ''
})
const mode = ref<'known' | 'reachable'>('known')
const searchName = ref('')
const targetCandidates = ref<TargetServer[]>([])
const selectedTarget = ref<TargetServer | null>(null)
const knownPath = ref<NetworkPath | null>(null)
const reachablePath = ref<ReachableNetworkPath | null>(null)
const maxHops = ref(4)
const error = ref('')
const loading = ref(false)

const activePath = computed(() => knownPath.value)

function parseTargetServer(value: unknown): TargetServer | null {
  if (value === null || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null
  return { id: record.id, name: record.name }
}

async function searchTargets(): Promise<void> {
  error.value = ''
  targetCandidates.value = []
  selectedTarget.value = null
  if (!searchName.value.trim()) return

  const params = new URLSearchParams({ name: searchName.value.trim() })
  const result = await request<unknown>(`/api/servers?${params.toString()}`, { method: 'GET' })
  if (!result.ok || !Array.isArray(result.data)) {
    error.value = result.ok ? 'Request failed.' : result.error
    return
  }
  targetCandidates.value = result.data.map(parseTargetServer).filter((target): target is TargetServer => target !== null)
}

function selectTarget(id: string): void {
  selectedTarget.value = targetCandidates.value.find(candidate => candidate.id === id) ?? null
}

async function findKnownPath(): Promise<void> {
  error.value = ''
  knownPath.value = null
  if (!sourcePortId.value) {
    error.value = '缺少起点端口'
    return
  }
  if (!selectedTarget.value) {
    error.value = '请选择目标设备'
    return
  }

  loading.value = true
  const result = await findPath(sourcePortId.value, selectedTarget.value.id)
  loading.value = false
  if (result.error) {
    error.value = result.error
    return
  }
  knownPath.value = result.data
}

async function findReachable(): Promise<void> {
  error.value = ''
  reachablePath.value = null
  if (!sourcePortId.value) {
    error.value = '缺少起点端口'
    return
  }

  loading.value = true
  const result = await requestReachable(sourcePortId.value, maxHops.value)
  loading.value = false
  if (result.error) {
    error.value = result.error
    return
  }
  reachablePath.value = result.data
}

async function selectEndpoint(deviceId: string): Promise<void> {
  const endpoint = reachablePath.value?.endpoints.find(item => item.deviceId === deviceId)
  if (!endpoint) return
  selectedTarget.value = { id: endpoint.deviceId, name: endpoint.deviceName }
  mode.value = 'known'
  await findKnownPath()
}

function goToServer(id: string): void {
  router.push(`/servers/${encodeURIComponent(id)}`)
}
</script>

<template>
  <main class="network-trace">
    <p class="breadcrumb"><a href="#" @click.prevent="router.back()">返回设备详情</a> &gt; 线路追踪</p>
    <h2>线路追踪</h2>
    <p class="notice">已登记物理连接，非实时数据。</p>
    <p v-if="!sourcePortId" class="error" role="alert">缺少起点端口</p>

    <div class="tabs" role="tablist" aria-label="追踪模式">
      <button type="button" :class="{ active: mode === 'known' }" @click="mode = 'known'">已知目标</button>
      <button type="button" :class="{ active: mode === 'reachable' }" @click="mode = 'reachable'">发现终点</button>
    </div>

    <section v-if="mode === 'known'" class="card">
      <label>
        目标设备名称
        <input v-model="searchName" type="search" placeholder="输入设备名称" @keyup.enter="searchTargets" />
      </label>
      <button type="button" class="btn" @click="searchTargets">搜索设备</button>
      <div v-if="targetCandidates.length" class="target-list">
        <button
          v-for="target in targetCandidates"
          :key="target.id"
          type="button"
          :class="{ selected: selectedTarget?.id === target.id }"
          @click="selectTarget(target.id)"
        >{{ target.name }}</button>
      </div>
      <p v-if="selectedTarget">目标：{{ selectedTarget.name }}</p>
      <button type="button" class="btn btn--primary" :disabled="loading" @click="findKnownPath">追踪路径</button>
    </section>

    <section v-else class="card">
      <label>
        最大跳数
        <input v-model.number="maxHops" type="number" min="1" max="10" />
      </label>
      <button type="button" class="btn btn--primary" :disabled="loading" @click="findReachable">发现终点</button>
      <p v-if="reachablePath" class="muted">
        已显示 {{ reachablePath.returnedEndpointCount }} / 共 {{ reachablePath.totalEndpointCount }} 个终点
      </p>
      <p v-if="reachablePath?.isTruncated" class="warning">结果已按 100 个终点截断。</p>
      <ul v-if="reachablePath?.endpoints.length" class="endpoint-list">
        <li v-for="endpoint in reachablePath.endpoints" :key="endpoint.portId">
          <button type="button" @click="selectEndpoint(endpoint.deviceId)">
            {{ endpoint.deviceName }} / {{ endpoint.portName }} · {{ endpoint.hopCount }} 跳
          </button>
        </li>
      </ul>
    </section>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="activePath?.warning" class="notice">{{ activePath.warning }}</p>
    <p v-if="activePath?.reason" class="warning">{{ activePath.reason }}</p>

    <section v-if="activePath?.pathFound" class="card path-result">
      <h3>物理路径</h3>
      <ol class="path-nodes">
        <li v-for="device in activePath.devices" :key="device.deviceId">
          <button type="button" @click="goToServer(device.deviceId)">{{ device.deviceName }}</button>
          <span>{{ device.deviceType }}{{ device.rackCode ? ` · ${device.rackCode}` : '' }}</span>
        </li>
      </ol>
      <ol class="hop-list">
        <li v-for="hop in activePath.hops" :key="hop.cableId">
          {{ hop.fromDeviceName }} / {{ hop.fromPortName }}
          → {{ hop.toDeviceName }} / {{ hop.toPortName }}
          · {{ hop.cableType }}
        </li>
      </ol>
    </section>
  </main>
</template>

<style scoped>
.network-trace { padding: var(--space-md); color: var(--color-text); }
.breadcrumb, .muted { color: var(--color-text-secondary); }
.breadcrumb a { color: var(--color-primary); text-decoration: none; }
.notice, .warning, .error { margin: var(--space-sm) 0; }
.notice { color: var(--color-text-secondary); }
.warning { color: #b8731f; }
.error { color: var(--color-danger); }
.tabs, .target-list { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin: var(--space-md) 0; }
.tabs button, .target-list button, .btn, .endpoint-list button, .path-nodes button { cursor: pointer; }
.tabs .active, .target-list .selected, .btn--primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.card { padding: var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-bg-card); }
.card label { display: inline-flex; gap: var(--space-sm); align-items: center; margin-right: var(--space-sm); }
.btn { padding: var(--space-xs) var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-bg-card); }
.endpoint-list, .path-nodes, .hop-list { display: grid; gap: var(--space-sm); padding-left: var(--space-lg); }
.path-nodes li { display: grid; gap: 2px; }
.path-nodes span { color: var(--color-text-secondary); font-size: var(--font-sm); }
.path-result { margin-top: var(--space-md); }
</style>
