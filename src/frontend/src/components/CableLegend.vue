<script setup lang="ts">
import type { DetailRow, LegendItem } from '../composables/useCableScene'

defineProps<{
  legend: LegendItem[]
  detailRows: DetailRow[]
  animationEnabled: boolean
}>()

const emit = defineEmits<{
  'toggle-animation': []
}>()

const PURPOSE_LABELS: Record<string, string> = {
  正常: '正常连接',
  存储: '存储链路',
  上联: '交换机上联',
}

function dashArray(value: string): string | undefined {
  return value === 'none' ? undefined : value
}
</script>

<template>
  <aside class="cable-legend">
    <h4>图例</h4>
    <div class="legend-items">
      <div v-for="item in legend" :key="item.purpose + item.cableType" class="legend-item">
        <svg width="30" height="12" aria-hidden="true">
          <line
            x1="0"
            y1="6"
            x2="28"
            y2="6"
            :stroke="item.color"
            stroke-width="2"
            :stroke-dasharray="dashArray(item.dashArray)"
          />
        </svg>
        <span>{{ PURPOSE_LABELS[item.purpose] ?? item.purpose }} ({{ item.cableType }})</span>
        <span class="count">{{ item.count }}</span>
      </div>
    </div>

    <label class="animation-toggle">
      <input type="checkbox" :checked="animationEnabled" @change="emit('toggle-animation')" />
      方向动画
    </label>

    <details class="detail-panel">
      <summary>连接明细 ({{ detailRows.length }})</summary>
      <table class="detail-table">
        <thead>
          <tr>
            <th>源设备</th>
            <th>源端口</th>
            <th>目标设备</th>
            <th>目标端口</th>
            <th>类型</th>
            <th>用途</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in detailRows" :key="i">
            <td>
              {{ row.sourceDevice }}
              <span class="muted">[{{ row.sourceRack }}]</span>
            </td>
            <td>{{ row.sourcePort }}</td>
            <td>
              {{ row.targetDevice }}
              <span class="muted">[{{ row.targetRack }}]</span>
            </td>
            <td>{{ row.targetPort }}</td>
            <td>{{ row.cableType }}</td>
            <td>{{ row.purpose }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </aside>
</template>

<style scoped>
.cable-legend {
  padding: var(--space-sm);
  font-size: var(--font-sm);
  border: 1px solid var(--color-border, #21262d);
  border-radius: var(--radius);
  background: var(--color-bg-card, #161b22);
  color: var(--color-text, #c9d1d9);
}

.cable-legend h4 {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-md);
  color: var(--color-text, #c9d1d9);
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.count {
  color: var(--color-text-secondary, #8b949e);
  margin-left: 2px;
}

.animation-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: var(--space-sm);
  cursor: pointer;
}

.detail-panel {
  margin-top: var(--space-sm);
  overflow-x: auto;
}

.detail-panel summary {
  cursor: pointer;
  font-weight: 500;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: var(--space-sm);
  font-size: var(--font-sm);
}

.detail-table th,
.detail-table td {
  padding: 2px 6px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.muted {
  color: var(--color-text-secondary, #8b949e);
  font-size: var(--font-xs);
}
</style>
