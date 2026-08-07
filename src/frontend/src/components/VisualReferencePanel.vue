<template>
  <section class="visual-reference-panel" aria-label="视觉参考资源">
    <article class="visual-reference-card">
      <div class="visual-reference-card__header">
        <div>
          <p class="visual-reference-card__eyebrow">机房空间</p>
          <h2>机房整体图稿</h2>
        </div>
        <a class="visual-reference-card__link" :href="roomImageSrc" target="_blank" rel="noopener noreferrer">打开原始图片</a>
      </div>
      <p class="visual-reference-card__description">去除冷热通道后的 V2 机房 2.5D 视觉参考，用于空间布局说明。</p>
      <a class="visual-reference-media-link" :href="roomImageSrc" target="_blank" rel="noopener noreferrer">
        <img
          class="visual-reference-image"
          :src="roomImageSrc"
          alt="去除冷热通道后的 V2 机房整体 2.5D 视觉参考图"
          loading="lazy"
        />
      </a>
    </article>

    <article class="visual-reference-card">
      <div class="visual-reference-card__header">
        <div>
          <p class="visual-reference-card__eyebrow">线缆关系</p>
          <h2>线缆连接策略</h2>
        </div>
        <a class="visual-reference-card__link" :href="cableStrategySrc" target="_blank" rel="noopener noreferrer">打开原始 HTML</a>
      </div>
      <p class="visual-reference-card__description">在沙盒 iframe 中查看线缆连接策略示意，保持原始 HTML 内容不变。</p>
      <iframe class="visual-reference-frame" :src="cableStrategySrc" title="线缆连接策略可视化" sandbox="allow-scripts" referrerpolicy="no-referrer" />
    </article>
  </section>
</template>

<script setup lang="ts">
const roomImageSrc = '/visual-reference/room-overview.png'
const cableStrategySrc = '/visual-reference/cable-connection-strategy.html'
</script>

<style scoped>
.visual-reference-panel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem; }
.visual-reference-card { display: flex; flex-direction: column; min-width: 0; gap: 0.75rem; padding: 1.25rem; border: 1px solid var(--color-border, #d8dee9); border-radius: 0.75rem; background: var(--color-surface, #fff); box-shadow: 0 0.5rem 1.5rem rgb(15 23 42 / 7%); }
.visual-reference-card__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
.visual-reference-card__eyebrow { margin: 0 0 0.25rem; color: var(--color-text-muted, #64748b); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.visual-reference-card h2 { margin: 0; color: var(--color-text, #0f172a); font-size: 1.125rem; }
.visual-reference-card__description { margin: 0; color: var(--color-text-muted, #475569); line-height: 1.5; }
.visual-reference-card__link { flex-shrink: 0; color: var(--color-primary, #2563eb); font-size: 0.875rem; font-weight: 600; text-decoration: none; }
.visual-reference-card__link:hover, .visual-reference-card__link:focus-visible { text-decoration: underline; }
.visual-reference-media-link { display: block; overflow: hidden; border-radius: 0.5rem; outline-offset: 0.2rem; }
.visual-reference-image { display: block; width: 100%; height: auto; }
.visual-reference-frame { display: block; width: 100%; min-height: 34rem; flex: 1; border: 1px solid var(--color-border, #d8dee9); border-radius: 0.5rem; background: #fff; }
@media (max-width: 760px) { .visual-reference-panel { grid-template-columns: 1fr; } .visual-reference-frame { min-height: 28rem; } }
</style>
