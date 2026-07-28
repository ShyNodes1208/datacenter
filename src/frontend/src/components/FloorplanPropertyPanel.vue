<template>
  <div v-if="selected" class="property-panel">
    <h4 class="property-panel-title">属性</h4>

    <template v-if="selected.type === 'wall'">
      <label class="property-field">
        颜色
        <input type="color" :value="selected.color" @input="emitUpdate({ color: ($event.target as HTMLInputElement).value })" />
      </label>
      <label class="property-field">
        粗细
        <input type="range" min="1" max="10" :value="selected.thickness" @input="emitUpdate({ thickness: Number(($event.target as HTMLInputElement).value) })" />
        <span>{{ selected.thickness }}px</span>
      </label>
    </template>

    <template v-if="selected.type === 'zone'">
      <label class="property-field">
        名称
        <input type="text" :value="selected.name" @input="emitUpdate({ name: ($event.target as HTMLInputElement).value })" />
      </label>
      <label class="property-field">
        类型
        <select :value="selected.zoneType" @change="emitUpdate({ zoneType: ($event.target as HTMLSelectElement).value })">
          <option value="cold-aisle">冷通道</option>
          <option value="hot-aisle">热通道</option>
          <option value="functional">功能区</option>
          <option value="custom">自定义</option>
        </select>
      </label>
      <label class="property-field">
        颜色
        <input type="color" :value="selected.color" @input="emitUpdate({ color: ($event.target as HTMLInputElement).value })" />
      </label>
    </template>

    <template v-if="selected.type === 'label'">
      <label class="property-field">
        文字
        <input type="text" :value="selected.text" @input="emitUpdate({ text: ($event.target as HTMLInputElement).value })" />
      </label>
      <label class="property-field">
        字号
        <input type="number" min="8" max="48" :value="selected.fontSize" @input="emitUpdate({ fontSize: Number(($event.target as HTMLInputElement).value) })" />
      </label>
      <label class="property-field">
        颜色
        <input type="color" :value="selected.color" @input="emitUpdate({ color: ($event.target as HTMLInputElement).value })" />
      </label>
    </template>

    <button class="btn btn--small btn--danger property-delete" @click="$emit('delete', selected.id, selected.type)">
      删除此元素
    </button>
  </div>
</template>

<script setup lang="ts">
import type { WallItem, ZoneItem, LabelItem } from '../composables/useFloorplanElements'

type SelectedElement = (WallItem & { type: 'wall' }) | (ZoneItem & { type: 'zone' }) | (LabelItem & { type: 'label' })

defineProps<{ selected: SelectedElement | null }>()

const emit = defineEmits<{
  update: [patch: Record<string, unknown>]
  delete: [id: string, type: string]
}>()

function emitUpdate(patch: Record<string, unknown>): void {
  emit('update', patch)
}
</script>

<style scoped>
.property-panel {
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
.property-panel-title { margin: 0; font-size: var(--font-sm); font-weight: 600; }
.property-field { display: flex; flex-direction: column; gap: 2px; font-size: var(--font-xs); }
.property-field input, .property-field select { font-size: var(--font-xs); padding: 4px; border: 1px solid var(--color-border); border-radius: 4px; }
.property-delete { margin-top: auto; }
</style>
