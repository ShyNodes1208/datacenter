<template>
  <main class="visual-reference-view">
    <header class="visual-reference-view__header">
      <p class="visual-reference-view__eyebrow">参考资料</p>
      <h1>视觉参考</h1>
      <p>浏览机房空间与线缆连接的静态参考素材。该页面仅用于产品说明，不会替换现有平面图或业务数据。</p>
    </header>
    <VisualReferencePanel />
  </main>
</template>

<script setup lang="ts">
import VisualReferencePanel from '../components/VisualReferencePanel.vue'
</script>

<style scoped>
.visual-reference-view { max-width: 1440px; margin: 0 auto; padding: 2rem clamp(1rem, 3vw, 3rem) 3rem; }
.visual-reference-view__header { max-width: 50rem; margin-bottom: 1.75rem; }
.visual-reference-view__eyebrow { margin: 0 0 0.5rem; color: var(--color-text-muted, #64748b); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
.visual-reference-view h1 { margin: 0 0 0.5rem; color: var(--color-text, #0f172a); font-size: clamp(1.75rem, 4vw, 2.5rem); }
.visual-reference-view__header p:last-child { margin: 0; color: var(--color-text-muted, #475569); line-height: 1.6; }
</style>
