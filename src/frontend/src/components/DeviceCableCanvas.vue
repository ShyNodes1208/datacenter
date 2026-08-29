<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
  'bundle-hover': [payload: { bundleId: string; clientX: number; clientY: number }]
  'bundle-leave': []
  'background-click': []
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const logicalWidth = ref(0)
const logicalHeight = ref(0)
const prefersReducedMotion = ref(false)
const shouldAnimate = computed(() => props.animationEnabled && !prefersReducedMotion.value)

let resizeObserver: ResizeObserver | null = null
let redrawFrame: number | null = null
let animationFrame: number | null = null
let hoveredBundleId: string | null = null
let dashOffset = 0

function dashForPurpose(bundle: CableBundle): number[] {
  const dash = PURPOSE_DASH[bundle.purpose] ?? 'none'
  return dash === 'none' ? [] : dash.split(/[ ,]+/).map(Number)
}

function routeLabelPosition(route: Point[]): Point {
  if (route.length === 0) return { x: 0, y: 0 }
  if (route.length === 1) return route[0]
  const marker = staticArrowPositions(route)[0]
  if (marker) return { x: marker.x, y: marker.y - 8 }
  const first = route[0]
  const last = route[route.length - 1]
  return { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 - 8 }
}

function drawArrow(ctx: CanvasRenderingContext2D, arrow: { x: number; y: number; angle: number }, direction: CableBundle['direction']): void {
  const draw = (angle: number) => {
    const size = 6
    const tipX = arrow.x + Math.cos(angle) * size
    const tipY = arrow.y + Math.sin(angle) * size
    const baseX = arrow.x - Math.cos(angle) * size
    const baseY = arrow.y - Math.sin(angle) * size
    const perpendicularX = Math.sin(angle) * 3
    const perpendicularY = -Math.cos(angle) * 3
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(baseX + perpendicularX, baseY + perpendicularY)
    ctx.lineTo(baseX - perpendicularX, baseY - perpendicularY)
    ctx.closePath()
    ctx.fill()
  }

  draw(arrow.angle)
  if (direction === 'bidirectional') draw(arrow.angle + Math.PI)
}

function strokeRoute(ctx: CanvasRenderingContext2D, route: Point[]): void {
  if (route.length < 2) return
  ctx.beginPath()
  ctx.moveTo(route[0].x, route[0].y)
  for (let index = 1; index < route.length; index++) ctx.lineTo(route[index].x, route[index].y)
  ctx.stroke()
}

function drawScene(): void {
  const element = canvas.value
  const ctx = element?.getContext('2d')
  if (!element || !ctx || logicalWidth.value === 0 || logicalHeight.value === 0) return

  const pixelRatio = window.devicePixelRatio || 1
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.clearRect(0, 0, logicalWidth.value, logicalHeight.value)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const bundle of props.scene.bundles) {
    if (bundle.opacity <= 0 || bundle.route.length < 2) continue
    ctx.save()
    ctx.globalAlpha = bundle.opacity
    ctx.setLineDash(bundle.animated && shouldAnimate.value ? [8, 4] : dashForPurpose(bundle))
    ctx.lineDashOffset = bundle.animated && shouldAnimate.value ? dashOffset : 0
    ctx.lineWidth = visualStrokeWidthForBundle(bundle)
    ctx.strokeStyle = bundle.strokeColor
    strokeRoute(ctx, bundle.route)

    if (bundle.isAggregated) {
      const label = routeLabelPosition(bundle.route)
      ctx.fillStyle = bundle.strokeColor
      ctx.font = '600 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(bundle.countLabel ?? `×${bundle.count}`, label.x, label.y)
    }

    ctx.fillStyle = bundle.strokeColor
    for (const arrow of staticArrowPositions(bundle.route)) drawArrow(ctx, arrow, bundle.direction)
    ctx.restore()
  }

  const highlightedPath = props.scene.highlightedPath
  if (highlightedPath?.route.length && highlightedPath.route.length > 1) {
    ctx.save()
    ctx.strokeStyle = '#39d2c0'
    ctx.fillStyle = '#39d2c0'
    ctx.lineWidth = 3
    ctx.setLineDash(shouldAnimate.value ? [8, 4] : [])
    ctx.lineDashOffset = shouldAnimate.value ? dashOffset : 0
    strokeRoute(ctx, highlightedPath.route)
    const label = routeLabelPosition(highlightedPath.route)
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${highlightedPath.sourceLabel} → ${highlightedPath.targetLabel}`, label.x, label.y - 4)
    ctx.restore()
  }
}

function scheduleDraw(): void {
  if (redrawFrame !== null) return
  redrawFrame = requestAnimationFrame(() => {
    redrawFrame = null
    drawScene()
  })
}

function resizeCanvas(entries?: ResizeObserverEntry[]): void {
  const element = canvas.value
  if (!element) return
  const contentRect = entries?.[0]?.contentRect
  logicalWidth.value = contentRect?.width ?? element.clientWidth
  logicalHeight.value = contentRect?.height ?? element.clientHeight
  const pixelRatio = window.devicePixelRatio || 1
  element.width = Math.max(1, Math.round(logicalWidth.value * pixelRatio))
  element.height = Math.max(1, Math.round(logicalHeight.value * pixelRatio))
  scheduleDraw()
}

function distanceSquaredToSegment(point: Point, start: Point, end: Point): number {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  if (lengthSquared === 0) {
    const offsetX = point.x - start.x
    const offsetY = point.y - start.y
    return offsetX * offsetX + offsetY * offsetY
  }
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared))
  const offsetX = point.x - (start.x + projection * deltaX)
  const offsetY = point.y - (start.y + projection * deltaY)
  return offsetX * offsetX + offsetY * offsetY
}

function bundleAtPoint(x: number, y: number): CableBundle | null {
  const point = { x, y }
  for (let index = props.scene.bundles.length - 1; index >= 0; index--) {
    const bundle = props.scene.bundles[index]
    if (bundle.opacity <= 0) continue
    for (let routeIndex = 1; routeIndex < bundle.route.length; routeIndex++) {
      if (distanceSquaredToSegment(point, bundle.route[routeIndex - 1], bundle.route[routeIndex]) <= 7 * 7) return bundle
    }
  }
  return null
}

function logicalPointFromEvent(event: PointerEvent | MouseEvent): Point | null {
  const element = canvas.value
  if (!element || logicalWidth.value === 0 || logicalHeight.value === 0) return null
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  return {
    x: (event.clientX - rect.left) * logicalWidth.value / rect.width,
    y: (event.clientY - rect.top) * logicalHeight.value / rect.height,
  }
}

function onPointerMove(event: PointerEvent): void {
  const point = logicalPointFromEvent(event)
  const bundle = point ? bundleAtPoint(point.x, point.y) : null
  const nextBundleId = bundle?.id ?? null
  if (nextBundleId === hoveredBundleId) return
  hoveredBundleId = nextBundleId
  if (bundle) {
    emit('bundle-hover', { bundleId: bundle.id, clientX: event.clientX, clientY: event.clientY })
  } else {
    emit('bundle-leave')
  }
}

function onPointerLeave(): void {
  if (hoveredBundleId === null) return
  hoveredBundleId = null
  emit('bundle-leave')
}

function onCanvasClick(event: MouseEvent): void {
  const point = logicalPointFromEvent(event)
  const bundle = point ? bundleAtPoint(point.x, point.y) : null
  if (bundle) emit('bundle-click', bundle.id)
  else emit('background-click')
}

function stopAnimation(): void {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  animationFrame = null
}

function syncAnimation(): void {
  stopAnimation()
  if (!shouldAnimate.value || !props.scene.bundles.some((bundle) => bundle.animated)) return
  const animate = (timestamp: number) => {
    dashOffset = -(timestamp / 1400) * 24
    drawScene()
    animationFrame = requestAnimationFrame(animate)
  }
  animationFrame = requestAnimationFrame(animate)
}

watch(() => props.scene, () => {
  scheduleDraw()
  syncAnimation()
}, { deep: true })

watch(shouldAnimate, () => {
  scheduleDraw()
  syncAnimation()
})

onMounted(() => {
  prefersReducedMotion.value = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resizeObserver = new ResizeObserver(resizeCanvas)
  if (canvas.value) resizeObserver.observe(canvas.value)
  resizeCanvas()
  syncAnimation()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (redrawFrame !== null) cancelAnimationFrame(redrawFrame)
  stopAnimation()
})
</script>

<template>
  <canvas
    ref="canvas"
    class="device-cable-canvas"
    data-testid="device-cable-canvas"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @click="onCanvasClick"
  />
</template>

<style scoped>
.device-cable-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  cursor: pointer;
}
</style>
