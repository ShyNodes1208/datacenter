<script setup lang="ts">
import { computed } from 'vue'
import {
  PURPOSE_DASH,
  cableTypeSceneColor,
  type CableBundle,
  type CableScene,
  type Point,
} from '../composables/useCableScene'

const props = defineProps<{
  scene: CableScene
  animationEnabled: boolean
}>()

const emit = defineEmits<{
  'bundle-click': [bundleId: string]
  'background-click': []
}>()

const prefersReducedMotion = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const shouldAnimate = computed(() => props.animationEnabled && !prefersReducedMotion)

function bundleStroke(bundle: CableBundle): string {
  return cableTypeSceneColor(bundle.cableType)
}

function bundleDash(bundle: CableBundle): string | undefined {
  const dash = PURPOSE_DASH[bundle.purpose] ?? 'none'
  return dash === 'none' ? undefined : dash
}

function bundleAllowsAnimation(bundle: CableBundle): boolean {
  return shouldAnimate.value && bundle.animated
}

function routeD(route: Point[]): string {
  if (route.length === 0) return ''
  const start = route[0]
  let d = `M ${start.x} ${start.y}`
  for (let i = 1; i < route.length; i++) {
    d += ` L ${route[i].x} ${route[i].y}`
  }
  return d
}

function routeMidpoint(route: Point[]): { x: number; y: number; angle: number } | null {
  if (route.length < 2) return null

  let total = 0
  for (let i = 1; i < route.length; i++) {
    total += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y)
  }
  const half = total / 2
  let acc = 0
  for (let i = 1; i < route.length; i++) {
    const dx = route[i].x - route[i - 1].x
    const dy = route[i].y - route[i - 1].y
    const segLen = Math.hypot(dx, dy)
    if (acc + segLen >= half) {
      const t = segLen > 0 ? (half - acc) / segLen : 0
      return {
        x: route[i - 1].x + dx * t,
        y: route[i - 1].y + dy * t,
        angle: Math.atan2(dy, dx),
      }
    }
    acc += segLen
  }
  return null
}

function arrowPoints(bundle: CableBundle): string {
  const mid = routeMidpoint(bundle.route)
  if (!mid) return ''
  const size = 6
  const tipX = mid.x + Math.cos(mid.angle) * size
  const tipY = mid.y + Math.sin(mid.angle) * size
  const baseX = mid.x - Math.cos(mid.angle) * size
  const baseY = mid.y - Math.sin(mid.angle) * size
  const perpX = Math.sin(mid.angle) * 3
  const perpY = -Math.cos(mid.angle) * 3
  return `${tipX},${tipY} ${baseX + perpX},${baseY + perpY} ${baseX - perpX},${baseY - perpY}`
}

function routeLabelPosition(route: Point[]): { x: number; y: number } {
  if (route.length === 0) return { x: 0, y: 0 }
  if (route.length === 1) return { x: route[0].x, y: route[0].y }
  const mid = routeMidpoint(route)
  if (mid) return { x: mid.x, y: mid.y - 8 }
  const first = route[0]
  const last = route[route.length - 1]
  return { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 - 8 }
}

function highlightedRouteD(): string {
  const path = props.scene.highlightedPath
  if (!path) return ''
  return routeD(path.route)
}

function highlightedLabelPosition(): { x: number; y: number } {
  const path = props.scene.highlightedPath
  if (!path || path.route.length === 0) return { x: 0, y: 0 }
  const pos = routeLabelPosition(path.route)
  return { x: pos.x, y: pos.y - 4 }
}
</script>

<template>
  <svg class="cable-layer">
    <text x="10" y="14" class="disclaimer" font-size="10">
      登记连接拓扑示意，非实时流量；箭头为登记端点方向
    </text>

    <g
      v-for="bundle in scene.bundles"
      :key="bundle.id"
      class="bundle-group"
      :class="{ 'bundle-group--hidden': bundle.opacity === 0 }"
      :opacity="bundle.opacity"
      :style="{ pointerEvents: bundle.opacity > 0 ? 'auto' : 'none' }"
      @click.stop="emit('bundle-click', bundle.id)"
    >
      <path
        v-if="bundle.route.length > 0"
        :d="routeD(bundle.route)"
        fill="none"
        :stroke="bundleStroke(bundle)"
        :stroke-width="bundle.highlighted ? 3.5 : (bundle.isAggregated ? 3 + Math.min(bundle.count, 10) : 2)"
        :stroke-dasharray="bundleAllowsAnimation(bundle) ? '8,4' : bundleDash(bundle)"
        :class="{ 'animated-path': bundleAllowsAnimation(bundle) }"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <text
        v-if="bundle.isAggregated && bundle.route.length > 1"
        :x="routeLabelPosition(bundle.route).x"
        :y="routeLabelPosition(bundle.route).y"
        text-anchor="middle"
        font-size="11"
        :fill="bundleStroke(bundle)"
        font-weight="600"
      >
        ×{{ bundle.count }}
      </text>
      <polygon
        v-if="bundle.route.length >= 2"
        :points="arrowPoints(bundle)"
        :fill="bundleStroke(bundle)"
      />
    </g>

    <g
      v-if="scene.highlightedPath && scene.highlightedPath.route.length > 0"
      class="highlight-path"
    >
      <path
        :d="highlightedRouteD()"
        fill="none"
        stroke="var(--color-accent, #39d2c0)"
        stroke-width="3"
        :stroke-dasharray="shouldAnimate ? '8,4' : undefined"
        :class="{ 'animated-path': shouldAnimate }"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <text
        :x="highlightedLabelPosition().x"
        :y="highlightedLabelPosition().y"
        text-anchor="middle"
        font-size="10"
        class="highlight-label"
      >
        {{ scene.highlightedPath.sourceLabel }} → {{ scene.highlightedPath.targetLabel }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.cable-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.bundle-group {
  pointer-events: auto;
  cursor: pointer;
}

.bundle-group--hidden {
  pointer-events: none;
  cursor: default;
}

.highlight-path {
  pointer-events: none;
}

.cable-layer path {
  transition: opacity 0.25s ease, stroke-width 0.25s ease;
}

.animated-path {
  animation: dash-flow 1.5s linear infinite;
}

@keyframes dash-flow {
  to {
    stroke-dashoffset: -24;
  }
}

@media (prefers-reduced-motion: reduce) {
  .animated-path {
    animation: none;
  }
}

.disclaimer {
  fill: var(--color-text-secondary, #8b949e);
  user-select: none;
  pointer-events: none;
}

.highlight-label {
  fill: var(--color-accent, #39d2c0);
}
</style>
