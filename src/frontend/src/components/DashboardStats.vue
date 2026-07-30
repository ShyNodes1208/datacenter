<script setup lang="ts">
import type { DashboardStats } from '../composables/useDashboard'

defineProps<{
  stats: DashboardStats
}>()
</script>

<template>
  <div class="dash-stats">
    <div class="dash-stat-card">
      <div class="dash-stat-card__value">{{ stats.totalRooms }}</div>
      <div class="dash-stat-card__label">机房总数</div>
    </div>
    <div class="dash-stat-card">
      <div class="dash-stat-card__value">{{ stats.totalRacks }}</div>
      <div class="dash-stat-card__label">机柜总数</div>
    </div>
    <div class="dash-stat-card">
      <div class="dash-stat-card__value">{{ stats.usagePercent }}%</div>
      <div class="dash-stat-card__label">U位使用率</div>
      <div class="dash-stat-card__sub">{{ stats.occupiedU }} / {{ stats.totalU }}U</div>
    </div>
    <div class="dash-stat-card">
      <div class="dash-stat-card__value">{{ stats.rackedServers }}</div>
      <div class="dash-stat-card__label">在架服务器</div>
    </div>
  </div>
</template>

<style scoped>
.dash-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-md);
}

.dash-stat-card {
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius, 6px);
  padding: var(--space-md);
  box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,0.1));
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

.dash-stat-card__sub {
  font-size: 11px;
  color: var(--color-text-secondary, #888);
  margin-top: 2px;
}
</style>
