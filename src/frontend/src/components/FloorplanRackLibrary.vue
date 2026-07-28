<template>
  <div class="rack-library">
    <h4 class="rack-library-title">机柜库</h4>
    <p class="rack-library-hint">拖动机柜到画布上放置</p>
    <div class="rack-library-list">
      <div
        v-for="rack in racks"
        :key="rack.id"
        class="rack-library-item"
        draggable="true"
        @dragstart="onDragStart($event, rack.id)"
      >
        <span class="rack-item-code">{{ rack.code }}</span>
        <span class="rack-item-meta">{{ rack.heightU }}U · {{ rack.brand || '—' }}</span>
      </div>
    </div>
    <div v-if="racks.length === 0" class="rack-library-empty">无机柜</div>
    <button class="btn btn--small btn--primary rack-library-add" @click="$emit('rack-create')">
      + 新建机柜
    </button>
  </div>
</template>

<script setup lang="ts">
import type { RackItem } from '../composables/useFloorplan'

defineProps<{ racks: RackItem[] }>()

defineEmits<{
  'rack-drop': [payload: { rackId: string; clientX: number; clientY: number }]
  'rack-create': []
}>()

function onDragStart(e: DragEvent, rackId: string): void {
  e.dataTransfer!.effectAllowed = 'copy'
  e.dataTransfer!.setData('text/plain', rackId)
}
</script>

<style scoped>
.rack-library {
  width: 200px;
  border-left: 1px solid var(--color-border, #e0e0e0);
  background: var(--color-bg-card, #fff);
  padding: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  flex-shrink: 0;
  overflow-y: auto;
}
.rack-library-title { margin: 0; font-size: var(--font-sm); font-weight: 600; }
.rack-library-hint { font-size: var(--font-xs); color: #999; margin: 0; }
.rack-library-list { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.rack-library-item {
  padding: 6px 8px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius, 4px);
  cursor: grab;
  font-size: var(--font-xs);
  display: flex;
  justify-content: space-between;
  transition: background 0.15s;
}
.rack-library-item:hover { background: var(--color-bg-hover, #f0f2f5); }
.rack-library-item:active { cursor: grabbing; }
.rack-item-code { font-weight: 600; }
.rack-item-meta { color: #999; }
.rack-library-empty { font-size: var(--font-xs); color: #999; text-align: center; padding: var(--space-md); }
.rack-library-add { width: 100%; }
</style>
