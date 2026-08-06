<script setup lang="ts">
import { computed } from 'vue'
import { getDeviceColor } from '../utils/deviceColors'

export interface USlot {
  startU: number
  endU: number
  uCount: number
  occupied: boolean
  serverId?: string
  serverName?: string
  deviceType?: string
  deviceHeight?: number
  colorIndex?: number
}

const props = defineProps<{
  rackCode: string
  heightU: number
  uSlots: USlot[]
  roomId: string
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'slot-click', uNumber: number, slot: USlot): void
  (e: 'server-click', serverId: string): void
  (e: 'move-click', serverId: string, serverName: string): void
  (e: 'decommission-click', serverId: string, serverName: string): void
  (e: 'port-view-click', serverId: string): void
}>()

const statsText = computed(() => {
  const occupied = props.uSlots.filter(s => s.occupied).reduce((sum, s) => sum + s.uCount, 0)
  return `${occupied}/${props.heightU}U`
})

interface RulerSlot {
  uNumber: number
  occupied: boolean
}

const rulerSlots = computed<RulerSlot[]>(() => {
  const result: RulerSlot[] = []
  for (const slot of props.uSlots) {
    const hi = Math.max(slot.startU, slot.endU)
    const lo = Math.min(slot.startU, slot.endU)
    for (let u = hi; u >= lo; u--) {
      result.push({ uNumber: u, occupied: slot.occupied })
    }
  }
  return result
})

interface DeviceBlock {
  slot: USlot
  startU: number
  endU: number
  uCount: number
  uLabel: string
  occupied: boolean
  serverId?: string
  serverName?: string
  deviceType?: string
  deviceHeight?: number
  colorIndex: number
  colors: ReturnType<typeof getDeviceColor>
  rowSpan: number
}

const deviceBlocks = computed<DeviceBlock[]>(() => {
  return props.uSlots.map((slot) => {
    const hi = Math.max(slot.startU, slot.endU)
    const lo = Math.min(slot.startU, slot.endU)
    const uCount = hi - lo + 1
    const idx = slot.colorIndex ?? 0
    return {
      slot,
      startU: hi,
      endU: lo,
      uCount,
      uLabel: `${slot.deviceHeight ?? uCount}U`,
      occupied: slot.occupied,
      serverId: slot.serverId,
      serverName: slot.serverName,
      deviceType: slot.deviceType,
      deviceHeight: slot.deviceHeight,
      colorIndex: idx,
      colors: getDeviceColor(slot.deviceType, idx),
      rowSpan: uCount,
    }
  })
})

function totalRows(count: number): string {
  const h = props.compact ? 4 : 24
  return `repeat(${count}, ${h}px)`
}

function onServerClick(e: MouseEvent, serverId: string): void {
  e.stopPropagation()
  emit('server-click', serverId)
}

function onEmptyBlockClick(block: DeviceBlock): void {
  if (!block.occupied) {
    const topU = Math.max(block.slot.startU, block.slot.endU)
    emit('slot-click', topU, block.slot)
  }
}

function isNetworkDevice(deviceType: string | undefined): boolean {
  if (!deviceType) return false
  const t = deviceType.toLowerCase()
  return ['交换', 'switch', '路由', 'router', '网络', 'network'].some(k => t.includes(k))
}
</script>

<template>
  <div
    class="rfp"
    :class="{ 'rfp--compact': compact }"
    :title="compact ? `${rackCode} ${statsText}` : undefined"
    :style="{
      display: 'grid',
      gridTemplateColumns: compact ? '1fr' : '48px 1fr',
      gridTemplateRows: 'auto 1fr',
      ...(compact ? { maxWidth: '60px', cursor: 'pointer' } : {}),
    }"
  >
    <div v-if="!compact" class="rfp__header-left"></div>
    <div class="rfp__header-right" :class="{ 'rfp__header-right--compact': compact }">
      <span class="rfp__rack-code">{{ rackCode }}</span>
    </div>

    <div
      v-if="!compact"
      class="rfp__ruler"
      :style="{ display: 'grid', gridTemplateRows: totalRows(heightU) }"
    >
      <div
        v-for="slot in rulerSlots"
        :key="'r' + slot.uNumber"
        class="rfp__ruler-mark"
        :class="{ 'rfp__ruler-mark--occupied': slot.occupied }"
      >
        {{ slot.uNumber }}
      </div>
    </div>

    <div
      class="rfp__devices"
      :style="{ display: 'grid', gridTemplateRows: totalRows(heightU) }"
    >
      <div
        v-for="block in deviceBlocks"
        :key="'b' + block.startU + '-' + block.endU"
        class="rfp__block"
        :class="{ 'rfp__block--empty': !block.occupied, 'rfp__block--occupied': block.occupied }"
        :style="{
          gridRow: `span ${block.rowSpan}`,
          background: block.occupied ? block.colors.background : undefined,
          cursor: block.occupied && block.serverId && !compact ? 'pointer' : !block.occupied && !compact ? 'pointer' : undefined,
        }"
        @click="!compact && block.occupied && block.serverId ? onServerClick($event, block.serverId) : !compact ? onEmptyBlockClick(block) : undefined"
      >
        <template v-if="block.occupied && block.serverName && !compact">
          <div class="rfp__block-content">
            <button
              v-if="isNetworkDevice(block.deviceType)"
              class="rfp__block-port-btn"
              title="查看端口连接"
              @click.stop="emit('port-view-click', block.serverId!)"
            >🔌</button>
            <div class="rfp__block-name">{{ block.serverName }}</div>
            <div class="rfp__block-meta">
              <span
                v-if="block.deviceType"
                class="rfp__block-tag"
                :style="{ background: block.colors.tagBg, color: block.colors.tagText }"
              >{{ block.deviceType }}</span>
              <span class="rfp__block-u">{{ block.uLabel }}</span>
            </div>
            <div v-if="block.serverId && block.serverName" class="rfp__block-actions">
              <button
                class="rfp__block-action-btn"
                title="移动"
                @click.stop="emit('move-click', block.serverId, block.serverName)"
              >↗</button>
              <button
                class="rfp__block-action-btn"
                title="下架"
                @click.stop="emit('decommission-click', block.serverId, block.serverName)"
              >↘</button>
            </div>
          </div>
        </template>
        <template v-else-if="block.occupied && compact">
          <!-- bare colored block -->
        </template>
        <template v-else-if="!block.occupied && !compact">
          <div class="rfp__block-empty-hint">空闲 {{ block.uCount }}U</div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rfp {
  border: 4px solid #2c3e50;
  border-radius: 6px;
  background: #1a252f;
  overflow: hidden;
  user-select: none;
}

.rfp--compact {
  border-width: 2px;
  border-radius: 4px;
}

.rfp__header-left {
  background: #243447;
  border-bottom: 1px solid #3d5266;
}

.rfp__header-right {
  background: #243447;
  border-bottom: 1px solid #3d5266;
  padding: 6px 12px;
  display: flex;
  align-items: center;
}

.rfp__header-right--compact {
  padding: 2px 4px;
  justify-content: center;
}

.rfp__rack-code {
  color: #c8d6e5;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.03em;
}

.rfp--compact .rfp__rack-code {
  font-size: 8px;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 52px;
}

.rfp__ruler {
  background: #111820;
}

.rfp__ruler-mark {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  font-size: 10px;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  color: #6b8299;
  border-bottom: 1px solid #1e2d3d;
  line-height: 24px;
  height: 24px;
}

.rfp__ruler-mark--occupied {
  color: #3d5266;
  background: #151d28;
}

.rfp__devices {
  position: relative;
}

.rfp__block {
  position: relative;
  border-bottom: 1px solid #2c3e50;
  box-sizing: border-box;
  transition: filter 0.1s ease;
}

.rfp--compact .rfp__block {
  border-bottom-width: 1px;
}

.rfp__block--empty {
  background: #1a252f;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rfp__block--empty:hover {
  background: #1e2d3d;
}

.rfp__block--occupied:hover {
  filter: brightness(1.12);
}

.rfp__block-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 2px 12px;
  overflow: hidden;
}

.rfp__block-port-btn {
  position: absolute;
  top: 4px;
  right: 6px;
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  opacity: 0.7;
  line-height: 1;
  padding: 1px;
  z-index: 1;
}

.rfp__block-port-btn:hover {
  opacity: 1;
}

.rfp__block-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: rgba(255,255,255,0.3);
  text-underline-offset: 2px;
}

.rfp__block-name:hover {
  text-decoration-color: rgba(255,255,255,0.8);
}

.rfp__block-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.rfp__block-tag {
  font-size: 11px;
  padding: 0px 6px;
  border-radius: 3px;
  white-space: nowrap;
  line-height: 18px;
}

.rfp__block-u {
  font-size: 11px;
  color: rgba(255,255,255,0.6);
  white-space: nowrap;
}

.rfp__block-actions {
  display: none;
  gap: 2px;
  margin-top: 1px;
}

.rfp__block--occupied:hover .rfp__block-actions {
  display: flex;
}

.rfp__block-action-btn {
  background: rgba(255,255,255,0.15);
  border: none;
  color: #fff;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  cursor: pointer;
  line-height: 16px;
}

.rfp__block-action-btn:hover {
  background: rgba(255,255,255,0.3);
}

.rfp__block-empty-hint {
  font-size: 11px;
  color: #4a6279;
}
</style>
