<script setup lang="ts">
import { computed } from 'vue'
import {
  PURPOSE_DASH,
  staticArrowPositions,
  visualStrokeWidthForBundle,
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

function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const shouldAnimate = computed(() => props.animationEnabled && !readPrefersReducedMotion())

function bundleStroke(bundle: CableBundle): string {
  return bundle.strokeColor
}

function bundleDash(bundle: CableBundle): string | undefined {
  const dash = PURPOSE_DASH[bundle.purpose] ?? 'none'
  return dash === 'none' ? undefined : dash
}

function bundleAllowsAnimation(bundle: CableBundle): boolean {
  return shouldAnimate.value && bundle.animated
}

function bundleStrokeWidth(bundle: CableBundle): number {
  return visualStrokeWidthForBundle(bundle)
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

function arrowPolygon(x: number, y: number, angle: number, reverse = false): string {
  const dir = reverse ? angle + Math.PI : angle
  const size = 6
  const tipX = x + Math.cos(dir) * size
  const tipY = y + Math.sin(dir) * size
  const baseX = x - Math.cos(dir) * size
  const baseY = y - Math.sin(dir) * size
  const perpX = Math.sin(dir) * 3
  const perpY = -Math.cos(dir) * 3
  return `${tipX},${tipY} ${baseX + perpX},${baseY + perpY} ${baseX - perpX},${baseY - perpY}`
}

function arrowsForBundle(bundle: CableBundle): Array<{ points: string; key: string }> {
  if (bundle.route.length < 2) return []
  const markers = staticArrowPositions(bundle.route)
  const result: Array<{ points: string; key: string }> = []
  markers.forEach((m, index) => {
    result.push({
      points: arrowPolygon(m.x, m.y, m.angle, false),
      key: `${bundle.id}-f-${index}`,
    })
    if (bundle.direction === 'bidirectional') {
      result.push({
        points: arrowPolygon(m.x, m.y, m.angle, true),
        key: `${bundle.id}-r-${index}`,
      })
    }
  })
  return result
}

function routeLabelPosition(route: Point[]): { x: number; y: number } {
  if (route.length === 0) return { x: 0, y: 0 }
  if (route.length === 1) return { x: route[0].x, y: route[0].y }
  const markers = staticArrowPositions(route)
  if (markers[0]) return { x: markers[0].x, y: markers[0].y - 8 }
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
    <defs>
      <filter
        v-for="bundle in scene.bundles.filter((b) => b.highlighted)"
        :id="`glow-${bundle.id}`"
        :key="`glow-${bundle.id}`"
        x="-40%"
        y="-40%"
        width="180%"
        height="180%"
      >
        <feDropShadow
          dx="0"
          dy="0"
          stdDeviation="12"
          :flood-color="bundleStroke(bundle)"
          flood-opacity="0.85"
        />
      </filter>
    </defs>

    <g
      v-for="bundle in scene.bundles"
      :key="bundle.id"
      class="bundle-group"
      data-testid="device-cable-bundle"
      :class="{ 'bundle-group--hidden': bundle.opacity === 0 }"
      :opacity="bundle.opacity"
      :style="{ pointerEvents: bundle.opacity > 0 ? 'auto' : 'none' }"
      @click.stop="emit('bundle-click', bundle.id)"
    >
      <path
        v-if="bundle.route.length > 0"
        class="cable-hit-area"
        :d="routeD(bundle.route)"
        fill="none"
        stroke="transparent"
        stroke-width="14"
        pointer-events="stroke"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        v-if="bundle.route.length > 0"
        :d="routeD(bundle.route)"
        fill="none"
        :stroke="bundleStroke(bundle)"
        :stroke-width="bundleStrokeWidth(bundle)"
        :stroke-dasharray="bundleAllowsAnimation(bundle) ? '8,4' : bundleDash(bundle)"
        :class="{ 'animated-path': bundleAllowsAnimation(bundle) }"
        :filter="bundle.highlighted ? `url(#glow-${bundle.id})` : undefined"
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
        v-for="arrow in arrowsForBundle(bundle)"
        :key="arrow.key"
        class="static-arrow"
        :points="arrow.points"
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
  /* FR-VIS-11: decorative flow period fixed at 1400ms */
  animation: dash-flow 1400ms linear infinite;
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

.cable-hit-area {
  pointer-events: stroke;
}

.highlight-label {
  fill: var(--color-accent, #39d2c0);
}

.static-arrow {
  pointer-events: none;
}
</style>
