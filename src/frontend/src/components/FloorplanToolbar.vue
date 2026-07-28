<template>
  <div class="flp-toolbar">
    <div class="flp-toolbar-tools">
      <button
        v-for="t in tools"
        :key="t.id"
        :class="['flp-tool-btn', { active: activeTool === t.id }]"
        :title="t.label"
        @click="$emit('tool-change', t.id)"
      >
        <span class="flp-tool-icon">{{ t.icon }}</span>
        <span class="flp-tool-label">{{ t.label }}</span>
      </button>
    </div>
    <div class="flp-toolbar-actions">
      <button class="flp-tool-btn" title="撤销 Ctrl+Z" :disabled="!canUndo" @click="$emit('undo')">
        <span class="flp-tool-icon">&#8617;</span>
        <span class="flp-tool-label">撤销</span>
      </button>
      <button class="flp-tool-btn" title="重做 Ctrl+Y" :disabled="!canRedo" @click="$emit('redo')">
        <span class="flp-tool-icon">&#8618;</span>
        <span class="flp-tool-label">重做</span>
      </button>
      <button class="flp-tool-btn flp-tool-btn--export" title="导出 SVG" @click="$emit('export-svg')">
        <span class="flp-tool-icon">↓</span>
        <span class="flp-tool-label">导出</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
export type ToolType = 'select' | 'wall' | 'rack' | 'label' | 'zone' | 'delete'

defineProps<{
  activeTool: ToolType
  canUndo: boolean
  canRedo: boolean
  mode: 'view' | 'edit'
}>()

defineEmits<{
  'tool-change': [tool: ToolType]
  undo: []
  redo: []
  'export-svg': []
}>()

const tools: { id: ToolType; icon: string; label: string }[] = [
  { id: 'select', icon: '↕', label: '选择' },
  { id: 'wall', icon: '╬', label: '墙体' },
  { id: 'rack', icon: '⊞', label: '机柜' },
  { id: 'label', icon: 'T', label: '标签' },
  { id: 'zone', icon: '▢', label: '区域' },
  { id: 'delete', icon: '✕', label: '删除' },
]
</script>

<style scoped>
.flp-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm);
  background: var(--color-bg-card, #fff);
  border-right: 1px solid var(--color-border, #e0e0e0);
  width: 64px;
  flex-shrink: 0;
}
.flp-toolbar-tools {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.flp-toolbar-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid var(--color-border, #e0e0e0);
  padding-top: var(--space-xs);
}
.flp-tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 4px;
  border: 1px solid transparent;
  border-radius: var(--radius, 6px);
  background: transparent;
  cursor: pointer;
  font-size: var(--font-xs);
  color: var(--color-text, #333);
  transition: background 0.15s, border-color 0.15s;
}
.flp-tool-btn:hover:not(:disabled) { background: var(--color-bg-hover, #f0f2f5); }
.flp-tool-btn.active { background: var(--color-primary-light, #e8f0fe); border-color: var(--color-primary, #4a90d9); color: var(--color-primary, #4a90d9); }
.flp-tool-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.flp-tool-icon { font-size: 18px; line-height: 1; }
.flp-tool-label { font-size: 10px; }
.flp-tool-btn--export { margin-top: var(--space-xs); }
</style>
