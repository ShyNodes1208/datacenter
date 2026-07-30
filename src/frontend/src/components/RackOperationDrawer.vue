<script setup lang="ts">
defineProps<{
  visible: boolean
  title: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div
    v-if="visible"
    class="drawer-overlay"
    @click.self="emit('close')"
  >
    <div class="drawer-panel">
      <div class="drawer-header">
        <h3 class="drawer-title">{{ title }}</h3>
        <button class="drawer-close" @click="emit('close')" aria-label="关闭">✕</button>
      </div>
      <div class="drawer-body">
        <slot></slot>
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
  width: 420px;
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
</style>
