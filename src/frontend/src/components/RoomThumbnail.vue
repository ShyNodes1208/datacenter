<script setup lang="ts">
defineProps<{
  roomName: string
  status: string
}>()
</script>

<template>
  <svg
    class="room-thumb"
    width="140"
    height="100"
    viewBox="0 0 140 100"
    role="img"
    :aria-label="`${roomName} 2.5D 缩略图`"
  >
    <!-- Ground shadow -->
    <polygon
      points="18,88 122,88 130,82 26,82"
      fill="rgba(0,0,0,0.35)"
    />
    <!-- Top face -->
    <polygon
      points="20,38 120,38 130,30 30,30"
      fill="#1a3354"
      stroke="#2e4a6e"
      stroke-width="0.5"
    />
    <!-- Grid on top -->
    <line x1="40" y1="38" x2="46" y2="30" stroke="rgba(91,118,152,0.3)" stroke-width="0.5" />
    <line x1="70" y1="38" x2="76" y2="30" stroke="rgba(91,118,152,0.3)" stroke-width="0.5" />
    <line x1="100" y1="38" x2="106" y2="30" stroke="rgba(91,118,152,0.3)" stroke-width="0.5" />
    <line x1="30" y1="34" x2="120" y2="34" stroke="rgba(91,118,152,0.15)" stroke-width="0.5" />
    <!-- Right side -->
    <polygon
      points="120,38 130,30 130,78 120,86"
      fill="#0c1a2e"
      stroke="#2e4a6e"
      stroke-width="0.5"
    />
    <!-- Front face -->
    <rect x="20" y="38" width="100" height="48" fill="#12253f" stroke="#2e4a6e" stroke-width="0.5" />
    <!-- Mini rack silhouettes on top -->
    <rect x="38" y="28" width="8" height="10" fill="#54d17a" opacity="0.85" />
    <rect x="58" y="26" width="8" height="12" fill="#54d17a" opacity="0.85" />
    <rect x="78" y="29" width="8" height="9" fill="#ff4d5f" opacity="0.85" />
    <!-- Status dot -->
    <circle
      :cx="108"
      :cy="46"
      r="4"
      :fill="status === '启用' ? '#54d17a' : '#8fa4bd'"
    />
    <!-- Room name below -->
    <text x="70" y="96" text-anchor="middle" fill="#8fa4bd" font-size="9">{{ roomName }}</text>
  </svg>
</template>

<style scoped>
.room-thumb {
  display: block;
  flex-shrink: 0;
}
</style>
