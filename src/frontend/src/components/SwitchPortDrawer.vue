<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

export interface SwitchPortItem {
  id: string
  portName: string
  portType: string
  speed: string | null
  cableType: string | null
  connectedToServerName: string | null
  connectedToServerId: string | null
  connectedToPortName: string | null
  connectedToRackCode: string | null
}

const props = defineProps<{
  visible: boolean
  deviceName: string
  deviceId: string
  ports: SwitchPortItem[]
  loading: boolean
  error: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'navigate', serverId: string): void
  (e: 'port-trace', portName: string): void
}>()

const CABLE_COLORS: Record<string, string> = {
  铜缆: '#e67e22',
  光纤: '#f1c40f',
  DAC: '#3498db',
}

function getCableColor(type: string | null): string {
  return type ? (CABLE_COLORS[type] ?? '#95a5a6') : '#95a5a6'
}

const isEmpty = computed(() => !props.loading && !props.error && props.ports.length === 0)
</script>

<template>
  <div
    v-if="visible"
    class="drawer-overlay"
    @click.self="emit('close')"
  >
    <div class="drawer-panel">
      <div class="drawer-header">
        <h3 class="drawer-title">{{ deviceName }} 端口连接</h3>
        <button class="drawer-close" aria-label="关闭" @click="emit('close')">✕</button>
      </div>

      <div class="drawer-body">
        <p v-if="loading">加载中...</p>
        <div v-else-if="error" class="error" role="alert">{{ error }}</div>
        <div v-else-if="isEmpty" class="empty-state">
          <p>该设备暂无端口定义</p>
          <RouterLink :to="`/servers/${deviceId}`" class="empty-link">去添加端口</RouterLink>
        </div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>端口名</th>
              <th>类型</th>
              <th>速率</th>
              <th>对端设备</th>
              <th>对端端口</th>
              <th>线缆</th>
              <th>机柜</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="port in ports" :key="port.id" :class="{ 'port-row--connected': !!port.connectedToServerId }">
              <td>
                <button
                  v-if="port.connectedToServerId"
                  type="button"
                  class="port-trace-btn"
                  title="追踪连接路径"
                  @click="emit('port-trace', port.portName)"
                >
                  🔗 {{ port.portName }}
                </button>
                <span v-else>{{ port.portName }}</span>
              </td>
              <td>{{ port.portType }}</td>
              <td>{{ port.speed ?? '—' }}</td>
              <td>
                <button
                  v-if="port.connectedToServerName && port.connectedToServerId"
                  type="button"
                  class="link-btn"
                  @click="emit('navigate', port.connectedToServerId)"
                >{{ port.connectedToServerName }}</button>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <span v-if="port.connectedToPortName">{{ port.connectedToPortName }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <span
                  v-if="port.cableType"
                  class="cable-tag"
                  :style="{ background: getCableColor(port.cableType), color: '#fff' }"
                >{{ port.cableType }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <span v-if="port.connectedToRackCode">{{ port.connectedToRackCode }}</span>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
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
  width: 520px;
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

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-sm, 12px);
}

.data-table th {
  text-align: left;
  padding: var(--space-xs, 4px) var(--space-sm, 8px);
  background: var(--color-table-header, #f5f7fa);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  color: var(--color-text-secondary, #888);
  white-space: nowrap;
}

.data-table td {
  padding: var(--space-xs, 4px) var(--space-sm, 8px);
  border-bottom: 1px solid var(--color-border, #e0e0e0);
  vertical-align: middle;
}

.data-table tbody tr:nth-child(even) {
  background: var(--color-table-stripe, #fafbfc);
}

.cable-tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: var(--font-sm, 12px);
  font-weight: 500;
  white-space: nowrap;
}

.muted {
  color: var(--color-text-secondary, #888);
}

.error {
  color: var(--color-danger, #e74c3c);
}

.empty-state {
  text-align: center;
  padding: var(--space-lg, 24px) 0;
  color: var(--color-text-secondary, #888);
}

.empty-state p {
  margin: 0 0 var(--space-sm, 8px);
}

.empty-link {
  color: var(--color-primary, #4a90d9);
  text-decoration: none;
  font-weight: 500;
}

.empty-link:hover {
  text-decoration: underline;
}

.link-btn {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-primary, #4a90d9);
  cursor: pointer;
  font-size: inherit;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.link-btn:hover {
  color: var(--color-primary-dark, #357abd);
}

.port-row--connected {
  background: rgba(59, 130, 246, 0.04);
}

.port-trace-btn {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-primary, #4a90d9);
  cursor: pointer;
  font-size: inherit;
  font-weight: 500;
}

.port-trace-btn:hover {
  text-decoration: underline;
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

.btn:hover {
  background: var(--color-bg-hover, #f0f2f5);
}
</style>
