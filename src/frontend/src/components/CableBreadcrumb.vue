<script setup lang="ts">
import type { BreadcrumbItem, CableFocus } from '../composables/useCableScene'

defineProps<{ items: BreadcrumbItem[] }>()
const emit = defineEmits<{ navigate: [level: CableFocus['level'], id: string] }>()
</script>

<template>
  <nav class="cable-breadcrumb" aria-label="线路层级导航">
    <template v-for="(item, i) in items" :key="`${item.level}-${item.id}`">
      <button
        type="button"
        class="crumb"
        :class="{ active: i === items.length - 1 }"
        :aria-current="i === items.length - 1 ? 'location' : undefined"
        @click="emit('navigate', item.level, item.id)"
      >
        {{ item.label }}
      </button>
      <span v-if="i < items.length - 1" class="separator" aria-hidden="true">&gt;</span>
    </template>
  </nav>
</template>

<style scoped>
.cable-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-sm);
}

.crumb {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-primary);
  cursor: pointer;
  font-size: inherit;
}

.crumb.active {
  color: var(--color-text);
  font-weight: 600;
  cursor: default;
}

.separator {
  color: var(--color-text-secondary);
}
</style>
