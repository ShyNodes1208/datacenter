<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'

export interface PathDevice {
  deviceId: string
  deviceName: string
  deviceType: string
  rackCode: string | null
}

export interface PathHop {
  fromDeviceId: string
  fromDeviceName: string
  fromPortId: string
  fromPortName: string
  cableId: string
  cableType: string
  toDeviceId: string
  toDeviceName: string
  toPortId: string
  toPortName: string
}

export interface NetworkPathResult {
  pathFound: boolean
  warning: string
  reason?: string
  devices?: PathDevice[]
  hops?: PathHop[]
}

type ServerOption = {
  id: string
  name: string
  deviceType: string
  positionStatus: string
  rackCode: string | null
}

const props = defineProps<{
  visible: boolean
  loading: boolean
  error: string
  pathResult: NetworkPathResult | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'search', sourceId: string, targetId: string): void
}>()

const router = useRouter()
const { request } = useApi()

const CABLE_COLORS: Record<string, string> = {
  铜缆: '#e67e22',
  光纤: '#f1c40f',
  DAC: '#3498db',
}

const servers = ref<ServerOption[]>([])
const serversLoading = ref(false)
const serverSearch = ref('')
const sourceId = ref('')
const targetId = ref('')
const formError = ref('')

const showSelection = computed(() => !props.loading && !props.error && !props.pathResult)

const filteredServers = computed(() => {
  const q = serverSearch.value.trim().toLowerCase()
  if (!q) return servers.value
  return servers.value.filter(s =>
    s.name.toLowerCase().includes(q)
    || s.deviceType.toLowerCase().includes(q),
  )
})

const sourceOptions = computed(() =>
  filteredServers.value.filter(s => s.id !== targetId.value),
)

const targetOptions = computed(() =>
  filteredServers.value.filter(s => s.id !== sourceId.value),
)

function getCableColor(type: string): string {
  return CABLE_COLORS[type] ?? '#95a5a6'
}

function serverLabel(s: ServerOption): string {
  const rackHint = s.rackCode ? ` - ${s.rackCode}` : ' - 未上架'
  return `${s.name} (${s.deviceType})${rackHint}`
}

function rackLabel(rackCode: string | null | undefined): string {
  return rackCode ? `${rackCode} 机柜` : '未上架'
}

function goToDevice(deviceId: string): void {
  router.push(`/servers/${encodeURIComponent(deviceId)}`)
}

function parseServerOption(raw: unknown): ServerOption | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.deviceType !== 'string') {
    return null
  }
  return {
    id: r.id,
    name: r.name,
    deviceType: r.deviceType,
    positionStatus: typeof r.positionStatus === 'string' ? r.positionStatus : '未上架',
    rackCode: typeof r.rackCode === 'string' ? r.rackCode : null,
  }
}

async function loadServers(): Promise<void> {
  serversLoading.value = true
  const result = await request<unknown>('/api/servers', { method: 'GET' })
  serversLoading.value = false
  if (!result.ok || !Array.isArray(result.data)) {
    servers.value = []
    return
  }
  const parsed: ServerOption[] = []
  for (const item of result.data) {
    const opt = parseServerOption(item)
    if (opt) parsed.push(opt)
  }
  parsed.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  servers.value = parsed
}

function submitSearch(): void {
  formError.value = ''
  if (!sourceId.value || !targetId.value) {
    formError.value = '请选择源设备和目标设备'
    return
  }
  if (sourceId.value === targetId.value) {
    formError.value = '源设备和目标设备不能相同'
    return
  }
  emit('search', sourceId.value, targetId.value)
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      formError.value = ''
      void loadServers()
    }
  },
)
</script>

<template>
  <div
    v-if="visible"
    class="drawer-overlay"
    @click.self="emit('close')"
  >
    <div class="drawer-panel">
      <div class="drawer-header">
        <h3 class="drawer-title">连接路径查询</h3>
        <button class="drawer-close" aria-label="关闭" @click="emit('close')">✕</button>
      </div>

      <div class="drawer-body">
        <template v-if="showSelection">
          <p v-if="serversLoading" class="muted">加载设备列表...</p>
          <template v-else>
            <label class="form-field">
              <span>搜索设备</span>
              <input
                v-model="serverSearch"
                type="search"
                class="form-input"
                placeholder="按名称或类型筛选"
              />
            </label>
            <label class="form-field">
              <span>源设备</span>
              <select v-model="sourceId" class="form-input">
                <option value="">选择源设备</option>
                <option v-for="s in sourceOptions" :key="s.id" :value="s.id">
                  {{ serverLabel(s) }}
                </option>
              </select>
            </label>
            <label class="form-field">
              <span>目标设备</span>
              <select v-model="targetId" class="form-input">
                <option value="">选择目标设备</option>
                <option v-for="s in targetOptions" :key="s.id" :value="s.id">
                  {{ serverLabel(s) }}
                </option>
              </select>
            </label>
            <div v-if="formError" class="error" role="alert">{{ formError }}</div>
            <div class="form-actions">
              <button type="button" class="btn btn--primary" @click="submitSearch">查询</button>
              <button type="button" class="btn" @click="emit('close')">取消</button>
            </div>
          </template>
        </template>

        <p v-else-if="loading">正在计算连接路径...</p>

        <div v-else-if="error" class="error" role="alert">{{ error }}</div>

        <template v-else-if="pathResult">
          <div class="warning-banner" role="status">
            ⚠ {{ pathResult.warning }}
          </div>

          <div v-if="!pathResult.pathFound" class="no-path">
            <p>{{ pathResult.reason ?? '未找到已登记的连接路径' }}</p>
            <p class="muted">建议检查端口与线缆是否已在系统中登记。</p>
            <button type="button" class="btn btn--small" @click="emit('close')">重新选择</button>
          </div>

          <div
            v-else-if="pathResult.devices && pathResult.hops && pathResult.hops.length > 0"
            class="path-flow"
          >
            <template v-for="(hop, i) in pathResult.hops" :key="hop.cableId">
              <div v-if="i === 0" class="path-node">
                <button type="button" class="device-link" @click="goToDevice(pathResult.devices![0].deviceId)">
                  {{ pathResult.devices![0].deviceName }}
                </button>
                <span class="rack-tag">{{ rackLabel(pathResult.devices![0].rackCode) }}</span>
                <div class="port-name">{{ hop.fromPortName }}</div>
              </div>

              <div class="path-cable">
                <div class="cable-line">│</div>
                <span
                  class="cable-tag"
                  :style="{ background: getCableColor(hop.cableType), color: '#fff' }"
                >{{ hop.cableType }}</span>
                <div class="cable-arrow">▼</div>
              </div>

              <div class="path-node">
                <button type="button" class="device-link" @click="goToDevice(hop.toDeviceId)">
                  {{ hop.toDeviceName }}
                </button>
                <span class="rack-tag">{{ rackLabel(pathResult.devices![i + 1]?.rackCode) }}</span>
                <div v-if="i < pathResult.hops!.length - 1 && hop.toDeviceId === pathResult.hops![i + 1].fromDeviceId" class="port-name">
                  {{ hop.toPortName }} → {{ pathResult.hops![i + 1].fromPortName }}
                </div>
                <div v-else class="port-name">{{ hop.toPortName }}</div>
              </div>
            </template>
          </div>
        </template>
      </div>

      <div class="drawer-footer">
        <button type="button" class="btn" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 560px;
  max-width: 100vw;
  height: 100%;
  background: var(--color-bg-card, #fff);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  animation: slide-in 0.2s ease-out;
}

@keyframes slide-in {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  flex-shrink: 0;
}

.drawer-title {
  margin: 0;
  font-size: var(--font-lg, 16px);
  font-weight: 600;
}

.drawer-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--color-text-secondary, #888);
  padding: 0;
  line-height: 1;
}

.drawer-close:hover {
  color: var(--color-text, #333);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md);
}

.drawer-footer {
  padding: var(--space-md);
  border-top: 1px solid var(--color-border, #e0e0e0);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs, 4px);
  margin-bottom: var(--space-sm, 8px);
  font-size: var(--font-sm, 12px);
}

.form-input {
  padding: var(--space-xs, 4px) var(--space-sm, 8px);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius, 6px);
  font-size: var(--font-md, 14px);
}

.form-actions {
  display: flex;
  gap: var(--space-sm, 8px);
  margin-top: var(--space-md, 16px);
}

.warning-banner {
  background: #fef3e0;
  color: #8a6d3b;
  border: 1px solid #f0ad4e;
  border-radius: var(--radius, 6px);
  padding: var(--space-sm, 8px) var(--space-md, 16px);
  font-size: var(--font-sm, 12px);
  margin-bottom: var(--space-md, 16px);
}

.no-path {
  text-align: center;
  padding: var(--space-lg, 24px) 0;
}

.no-path p {
  margin: 0 0 var(--space-sm, 8px);
}

.path-flow {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs, 4px);
}

.path-node {
  padding: var(--space-sm, 8px) 0;
}

.device-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-primary, #4a90d9);
  cursor: pointer;
  font-size: var(--font-md, 14px);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.device-link:hover {
  color: var(--color-primary-dark, #357abd);
}

.rack-tag {
  margin-left: var(--space-xs, 4px);
  font-size: var(--font-sm, 12px);
  color: var(--color-text-secondary, #888);
}

.port-name {
  margin-top: var(--space-xs, 4px);
  padding-left: var(--space-md, 16px);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: var(--font-sm, 12px);
  color: var(--color-text-secondary, #666);
}

.path-cable {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-left: var(--space-md, 16px);
  gap: 2px;
}

.cable-line {
  color: var(--color-text-secondary, #999);
  font-family: monospace;
  line-height: 1;
}

.cable-arrow {
  color: var(--color-text-secondary, #999);
  font-size: 12px;
  line-height: 1;
}

.cable-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: var(--font-sm, 12px);
  font-weight: 500;
}

.error {
  color: var(--color-danger, #e74c3c);
}

.muted {
  color: var(--color-text-secondary, #888);
}

.btn {
  padding: var(--space-xs, 4px) var(--space-md, 16px);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius, 6px);
  background: var(--color-bg-card, #fff);
  color: var(--color-text, #333);
  font-size: var(--font-md, 14px);
  cursor: pointer;
}

.btn--small {
  font-size: var(--font-sm, 12px);
  padding: 2px var(--space-sm, 8px);
}

.btn--primary {
  border-color: var(--color-primary, #4a90d9);
  background: var(--color-primary, #4a90d9);
  color: #fff;
}

.btn:hover {
  background: var(--color-bg-hover, #f0f2f5);
}

.btn--primary:hover {
  filter: brightness(0.95);
}
</style>
