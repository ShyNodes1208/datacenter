<template>
  <div class="cable-connection" aria-label="线缆连接策略">
    <div v-if="loading" class="cable-connection__loading">加载中…</div>
    <template v-else-if="connections.length">
      <div class="cable-connection__summary">
        共 <strong>{{ connections.length }}</strong> 条连接
        <span v-if="roomId"> — 当前机房</span>
      </div>
      <div class="cable-connection__list">
        <article
          v-for="connection in connections"
          :key="connection.id"
          class="cable-connection__item"
        >
          <div class="cable-connection__endpoint cable-connection__endpoint--source">
            <span class="cable-connection__device">{{ connection.source.deviceName }}</span>
            <span class="cable-connection__port">{{ connection.source.portName }}</span>
            <span class="cable-connection__rack">@{{ connection.source.rackCode }}</span>
          </div>
          <div class="cable-connection__arrow" aria-hidden="true">
            <span
              class="cable-connection__type"
              :style="{ background: typeColor(connection.cableType) }"
            >
              {{ connection.cableType }}
            </span>
            <span class="cable-connection__direction">→</span>
          </div>
          <div class="cable-connection__endpoint cable-connection__endpoint--target">
            <span class="cable-connection__device">{{ connection.target.deviceName }}</span>
            <span class="cable-connection__port">{{ connection.target.portName }}</span>
            <span class="cable-connection__rack">@{{ connection.target.rackCode }}</span>
          </div>
          <span class="cable-connection__status" :class="statusClass(connection.status)">
            {{ statusLabel(connection.status) }}
          </span>
        </article>
      </div>
    </template>
    <p v-else class="cable-connection__empty">暂无连接数据</p>
  </div>
</template>

<script setup lang="ts">
import {
  cableTypeColor,
  connectionStatusLabel,
  useCableConnections,
} from '../composables/useCableConnections'

const props = defineProps<{ roomId?: string; cableType?: string }>()

const { connections, loading } = useCableConnections(
  () => props.roomId,
  () => props.cableType,
)

function typeColor(type: string): string {
  return cableTypeColor(type)
}

function statusLabel(status: string): string {
  return connectionStatusLabel(status)
}

function statusClass(status: string): string {
  if (status === 'pending') return 'cable-connection__status--pending'
  if (status === 'warning') return 'cable-connection__status--warning'
  return 'cable-connection__status--normal'
}
</script>

<style scoped>
.cable-connection {
  color: var(--color-text, #e6edf3);
}

.cable-connection__loading,
.cable-connection__empty {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-secondary, #8b949e);
}

.cable-connection__summary {
  margin-bottom: 1rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary, #8b949e);
}

.cable-connection__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cable-connection__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  background: var(--color-bg, #0d1117);
  border: 1px solid var(--color-border, #21262d);
  border-radius: 8px;
}

.cable-connection__endpoint {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cable-connection__device {
  font-size: 0.9rem;
  font-weight: 600;
}

.cable-connection__port {
  font-size: 0.78rem;
  color: var(--color-text-secondary, #8b949e);
}

.cable-connection__rack {
  font-size: 0.75rem;
  color: var(--color-accent, #39d2c0);
}

.cable-connection__arrow {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  align-items: center;
}

.cable-connection__type {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.72rem;
  color: #fff;
  white-space: nowrap;
}

.cable-connection__direction {
  font-size: 1.2rem;
  color: #484f58;
}

.cable-connection__endpoint--target {
  text-align: right;
}

.cable-connection__status {
  grid-column: 1 / -1;
  justify-self: start;
  padding: 2px 8px;
  font-size: 0.72rem;
  border-radius: 999px;
}

.cable-connection__status--normal {
  color: #3fb950;
  background: rgb(63 185 80 / 12%);
}

.cable-connection__status--pending {
  color: #d29922;
  background: rgb(210 153 34 / 12%);
}

.cable-connection__status--warning {
  color: #f85149;
  background: rgb(248 81 73 / 12%);
}

@media (max-width: 640px) {
  .cable-connection__item {
    grid-template-columns: 1fr;
  }

  .cable-connection__endpoint--target {
    text-align: left;
  }
}
</style>
