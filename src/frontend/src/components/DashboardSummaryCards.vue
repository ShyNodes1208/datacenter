<script setup lang="ts">
export interface DashboardSummary {
  totalServers: number
  totalRacks: number
  totalCables: number
}

defineProps<{
  loading: boolean
  error: string
  summary: DashboardSummary | null
}>()
</script>

<template>
  <section class="dash-summary" aria-label="统计概览">
    <div v-if="loading" class="dash-stats">
      <div v-for="label in ['服务器', '机柜', '线缆']" :key="label" class="dash-stat-card dash-stat-card--skeleton">
        <div class="dash-stat-card__value dash-stat-card__shimmer" aria-hidden="true">&nbsp;</div>
        <div class="dash-stat-card__label">{{ label }}</div>
      </div>
    </div>
    <div v-else-if="error" class="dash-summary__error error" role="alert" aria-live="polite">
      {{ error }}
    </div>
    <div v-else-if="summary" class="dash-stats">
      <div class="dash-stat-card">
        <div class="dash-stat-card__value">{{ summary.totalServers }}</div>
        <div class="dash-stat-card__label">服务器</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-card__value">{{ summary.totalRacks }}</div>
        <div class="dash-stat-card__label">机柜</div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-card__value">{{ summary.totalCables }}</div>
        <div class="dash-stat-card__label">线缆</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dash-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.dash-stat-card {
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius, 6px);
  padding: var(--space-md);
  box-shadow: var(--shadow, 0 1px 3px rgba(0, 0, 0, 0.1));
  text-align: center;
}

.dash-stat-card__value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-primary, #4a90d9);
  line-height: 1.2;
}

.dash-stat-card__label {
  font-size: var(--font-sm, 12px);
  color: var(--color-text-secondary, #888);
  margin-top: 4px;
}

.dash-stat-card--skeleton .dash-stat-card__value {
  min-height: 34px;
}

.dash-stat-card__shimmer {
  background: linear-gradient(90deg, #ececec 25%, #f5f5f5 50%, #ececec 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
  border-radius: 4px;
}

.dash-summary__error {
  margin-bottom: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-error-bg, #fff5f5);
  border: 1px solid #f5c6cb;
  border-radius: var(--radius, 6px);
}

.error {
  color: var(--color-danger);
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
