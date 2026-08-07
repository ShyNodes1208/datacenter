<template>
  <aside
    class="rack-detail-panel"
    :class="{ 'rack-detail-panel--open': !!rackId }"
    aria-label="机柜详情"
  >
    <div v-if="!rackId" class="rack-detail-panel__empty">
      <p>点击机柜查看详情</p>
      <span class="rack-detail-panel__hint">在平面图中选择机柜，右侧将显示 U 位与设备信息</span>
    </div>

    <template v-else>
      <header class="rack-detail-panel__header">
        <div>
          <h2 class="rack-detail-panel__title">{{ detail?.rack.code ?? '—' }}</h2>
          <span v-if="detail" class="rack-detail-panel__meta">{{ detail.rack.heightU }}U 机柜</span>
        </div>
        <button
          type="button"
          data-test="close-btn"
          class="rack-detail-panel__close"
          aria-label="关闭面板"
          @click="$emit('close')"
        >
          ×
        </button>
      </header>

      <div v-if="loading" class="rack-detail-panel__loading">加载中…</div>
      <div v-else-if="loadError" class="rack-detail-panel__error" role="alert">{{ loadError }}</div>

      <template v-else-if="detail">
        <section class="rack-detail-panel__section" aria-labelledby="rack-basic-heading">
          <h3 id="rack-basic-heading">基本信息</h3>
          <dl class="rack-detail-panel__dl">
            <dt>总容量</dt>
            <dd>{{ detail.rack.heightU }}U</dd>
            <dt>品牌</dt>
            <dd>{{ detail.rack.brand || '—' }}</dd>
            <dt>额定功率</dt>
            <dd>{{ detail.rack.power || '—' }}</dd>
          </dl>
        </section>

        <section class="rack-detail-panel__section" aria-labelledby="rack-occupancy-heading">
          <h3 id="rack-occupancy-heading">U 位占用</h3>
          <div class="rack-detail-panel__u-summary">
            <span>已用 {{ detail.occupancy.usedU }}U</span>
            <span>空闲 {{ detail.occupancy.freeU }}U</span>
          </div>
          <div
            class="rack-detail-panel__u-track"
            role="img"
            :aria-label="`U 位占用 ${detail.occupancy.usedU} / ${detail.occupancy.totalU}`"
          >
            <div
              class="rack-detail-panel__u-used"
              :style="{ width: occupancyPct + '%' }"
            />
          </div>
          <div class="rack-detail-panel__u-vertical" aria-hidden="true">
            <div
              v-for="slot in verticalSlots"
              :key="slot.u"
              class="rack-detail-panel__u-slot"
              :class="{ 'rack-detail-panel__u-slot--used': slot.used }"
              :title="slot.label"
            />
          </div>
        </section>

        <section class="rack-detail-panel__section" aria-labelledby="rack-devices-heading">
          <h3 id="rack-devices-heading">设备列表 ({{ detail.devices.length }})</h3>
          <table v-if="detail.devices.length" class="rack-detail-panel__table">
            <thead>
              <tr>
                <th scope="col">名称</th>
                <th scope="col">类型</th>
                <th scope="col">U 位</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="device in detail.devices" :key="device.id">
                <td>
                  <router-link :to="`/servers/${device.id}`" class="rack-detail-panel__link">
                    {{ device.name }}
                  </router-link>
                </td>
                <td>{{ device.deviceType }}</td>
                <td>{{ device.startU }}-{{ device.endU }} ({{ device.uHeight }}U)</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="rack-detail-panel__muted">无机架设备</p>
        </section>

        <section class="rack-detail-panel__section" aria-labelledby="rack-history-heading">
          <h3 id="rack-history-heading">位置变更记录</h3>
          <ul v-if="recentHistory.length" class="rack-detail-panel__timeline">
            <li
              v-for="(item, index) in recentHistory"
              :key="`${item.time}-${index}`"
              class="rack-detail-panel__timeline-item"
            >
              <span class="rack-detail-panel__timeline-time">{{ formatTime(item.time) }}</span>
              <span>{{ item.deviceName }}</span>
              <span class="rack-detail-panel__badge">{{ item.action }}</span>
              <span v-if="item.fromU !== null || item.toU !== null">
                {{ item.fromU ?? '—' }} → {{ item.toU ?? '—' }}U
              </span>
            </li>
          </ul>
          <p v-else class="rack-detail-panel__muted">无变更记录</p>
        </section>

        <section class="rack-detail-panel__section" aria-labelledby="rack-cables-heading">
          <h3 id="rack-cables-heading">关联线缆 ({{ detail.cables.length }})</h3>
          <ul v-if="detail.cables.length" class="rack-detail-panel__cable-list">
            <li v-for="cable in detail.cables" :key="cable.id">
              <router-link :to="`/cables`" class="rack-detail-panel__link">
                {{ cable.portName }} → {{ cable.remoteDevice }}@{{ cable.remoteRack }}
              </router-link>
            </li>
          </ul>
          <p v-else class="rack-detail-panel__muted">无关联线缆</p>
        </section>
      </template>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRackDetailPanel } from '../composables/useRackDetailPanel'

const props = defineProps<{ rackId: string | null }>()
defineEmits<{ close: [] }>()

const { detail, loading, loadError } = useRackDetailPanel(toRef(props, 'rackId'))

const occupancyPct = computed(() => {
  if (!detail.value || detail.value.occupancy.totalU <= 0) return 0
  return (detail.value.occupancy.usedU / detail.value.occupancy.totalU) * 100
})

const recentHistory = computed(() => detail.value?.positionHistory.slice(0, 10) ?? [])

const verticalSlots = computed(() => {
  if (!detail.value) return []
  const totalU = detail.value.rack.heightU
  const used = new Set<number>()
  for (const device of detail.value.devices) {
    for (let u = device.startU; u <= device.endU; u += 1) {
      used.add(u)
    }
  }
  return Array.from({ length: totalU }, (_, index) => {
    const u = totalU - index
    return {
      u,
      used: used.has(u),
      label: used.has(u) ? `U${u} 已用` : `U${u} 空闲`,
    }
  })
})

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN')
  } catch {
    return iso
  }
}
</script>

<style scoped>
.rack-detail-panel {
  width: 360px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 1rem;
  overflow-y: auto;
  color: var(--color-text, #e6edf3);
  background: var(--color-bg-card, #161b22);
  border-left: 1px solid var(--color-border, #30363d);
}

.rack-detail-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.5rem;
  text-align: center;
  color: var(--color-text-secondary, #8b949e);
}

.rack-detail-panel__hint {
  max-width: 240px;
  font-size: 0.75rem;
}

.rack-detail-panel__loading,
.rack-detail-panel__error {
  padding: 1rem 0;
  text-align: center;
  font-size: 0.875rem;
}

.rack-detail-panel__error {
  color: var(--color-danger, #f85149);
}

.rack-detail-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.rack-detail-panel__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}

.rack-detail-panel__meta {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #8b949e);
}

.rack-detail-panel__close {
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-secondary, #8b949e);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.rack-detail-panel__close:hover,
.rack-detail-panel__close:focus-visible {
  color: var(--color-danger, #f85149);
}

.rack-detail-panel__section {
  margin-bottom: 1.25rem;
}

.rack-detail-panel__section h3 {
  margin: 0 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary, #8b949e);
}

.rack-detail-panel__dl {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 4px 8px;
  margin: 0;
  font-size: 0.85rem;
}

.rack-detail-panel__dl dt {
  color: var(--color-text-secondary, #8b949e);
}

.rack-detail-panel__dl dd {
  margin: 0;
}

.rack-detail-panel__u-summary {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 0.8rem;
}

.rack-detail-panel__u-track {
  height: 8px;
  margin-bottom: 0.75rem;
  overflow: hidden;
  background: var(--color-bg, #0d1117);
  border-radius: 4px;
}

.rack-detail-panel__u-used {
  height: 100%;
  background: var(--color-accent, #39d2c0);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.rack-detail-panel__u-vertical {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 220px;
  padding: 4px;
  overflow-y: auto;
  background: var(--color-bg, #0d1117);
  border: 1px solid var(--color-border, #21262d);
  border-radius: 4px;
}

.rack-detail-panel__u-slot {
  flex-shrink: 0;
  height: 4px;
  background: #30363d;
  border-radius: 1px;
}

.rack-detail-panel__u-slot--used {
  background: var(--color-accent, #39d2c0);
}

.rack-detail-panel__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.rack-detail-panel__table th,
.rack-detail-panel__table td {
  padding: 6px 8px;
  text-align: left;
  border-bottom: 1px solid var(--color-border, #21262d);
}

.rack-detail-panel__table th {
  font-weight: 600;
  color: var(--color-text-secondary, #8b949e);
}

.rack-detail-panel__link {
  color: var(--color-primary, #58a6ff);
  text-decoration: none;
}

.rack-detail-panel__link:hover,
.rack-detail-panel__link:focus-visible {
  text-decoration: underline;
}

.rack-detail-panel__muted {
  margin: 0;
  font-size: 0.82rem;
  color: #484f58;
}

.rack-detail-panel__timeline {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.8rem;
}

.rack-detail-panel__timeline-item {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  padding: 4px 0;
  border-bottom: 1px solid var(--color-border, #21262d);
}

.rack-detail-panel__timeline-time {
  color: #484f58;
  white-space: nowrap;
}

.rack-detail-panel__badge {
  padding: 1px 6px;
  font-size: 0.72rem;
  background: #1c2333;
  border-radius: 4px;
}

.rack-detail-panel__cable-list {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.82rem;
}

.rack-detail-panel__cable-list li {
  padding: 3px 0;
  border-bottom: 1px solid var(--color-border, #21262d);
}

@media (max-width: 900px) {
  .rack-detail-panel {
    position: absolute;
    inset: 0;
    z-index: 30;
    width: 100%;
    border-left: none;
  }
}
</style>
