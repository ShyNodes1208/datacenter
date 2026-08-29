# Device-level Cable Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove device-topology SVG cable DOM churn by rendering its existing cable scene on one interactive native Canvas surface.

**Architecture:** `DeviceCableCanvas.vue` receives the existing `CableScene` and emits existing cable interaction events. `TopologyView.vue` uses it only for `mode === 'devices'`; shared SVG `CableLayer.vue` remains for floorplan and rack pages. Canvas drawing and route-distance hit testing use existing `CableBundle` data and helpers, with no API, model, routing, or dependency change.

**Tech Stack:** Vue 3 Composition API, TypeScript, Canvas 2D API, Vitest, Playwright, existing Konva stage.

**Spec:** `docs/superpowers/specs/2026-08-29-device-cable-canvas-design.md`

## Global Constraints

- Render Canvas only in device topology; `RackDeviceView.vue` and `FloorplanCanvas.vue` keep SVG `CableLayer.vue`.
- Preserve `CableScene`, filtering/routing, event payloads, visual semantics, overlay alignment, and reduced-motion behaviour.
- Add no dependency and make no API, database, model, or shared-`CableLayer` public-contract change.
- Restore the failed hidden-SVG-bundle experiment instead of retaining its 579–594-node update cost.
- Verify Beijing 2,850-device data at 1536x1024; record entry and both click-to-next-frame values.

---

### Task 1: Device-only Canvas component

**Files:**

- Create: `src/frontend/src/components/DeviceCableCanvas.vue`
- Modify: `src/frontend/src/__tests__/topology.test.ts`

**Interfaces:**

- Consumes: `scene: CableScene`, `animationEnabled: boolean` from `useCableScene.ts`.
- Produces: `bundle-click(bundleId: string)`, `bundle-hover({ bundleId, clientX, clientY })`, `bundle-leave()`, and `background-click()`.

- [ ] **Step 1: Write the failing Canvas structure and event-contract test**

Add a `TASK-20260829` test that reads `DeviceCableCanvas.vue` and asserts:

```ts
expect(source).toContain('data-testid="device-cable-canvas"')
expect(source).toContain("'bundle-click': [bundleId: string]")
expect(source).toContain("'bundle-hover': [payload: { bundleId: string; clientX: number; clientY: number }]")
expect(source).toContain('function bundleAtPoint(')
expect(source).toContain('function logicalPointFromEvent(')
expect(source).toContain('new ResizeObserver(')
expect(source).toContain('requestAnimationFrame(')
expect(source).not.toContain('v-for="bundle in')
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --run src/__tests__/topology.test.ts -t "device-only Canvas"`

Expected: FAIL because `DeviceCableCanvas.vue` does not yet exist.

- [ ] **Step 3: Implement the minimal Canvas renderer**

Create `DeviceCableCanvas.vue` with the same props/events as `CableLayer`. On mount, observe CSS size and set backing size to logical size times `window.devicePixelRatio`; create no SVG elements.

Use existing display helpers:

```ts
ctx.setLineDash(bundle.animated && shouldAnimate.value ? [8, 4] : dashForPurpose(bundle.purpose))
ctx.lineWidth = visualStrokeWidthForBundle(bundle)
ctx.strokeStyle = bundle.strokeColor
for (const arrow of staticArrowPositions(bundle.route)) drawArrow(ctx, arrow, bundle.direction)
```

Draw an aggregate count label and existing highlighted path label. Implement `bundleAtPoint(x, y)` by scanning visible bundles in reverse scene order, matching a route segment when squared point-to-segment distance is at most `7 * 7`. Convert pointer coordinates from the bounding rect:

```ts
const x = (event.clientX - rect.left) * logicalWidth / rect.width
const y = (event.clientY - rect.top) * logicalHeight / rect.height
```

Emit hover only on bundle transitions; emit leave on pointerleave; emit hit bundle ID or background click on click. Run a frame loop only while animation is requested and reduced motion is off; cancel it on unmount.

- [ ] **Step 4: Run focused Canvas test**

Run: `npm test -- --run src/__tests__/topology.test.ts -t "device-only Canvas"`

Expected: PASS; test proves one Canvas, compatible events, DPR sizing, transformed-coordinate conversion, route hit testing, and no per-bundle template loop.

- [ ] **Step 5: Commit the component test cycle**

Run: `git diff --check && git status --short`

Expected: only approved component, test, and governance files; no dependency or data/API file.

Commit: `feat(topology): render device cables on canvas`.

### Task 2: Device-only topology integration

**Files:**

- Modify: `src/frontend/src/views/TopologyView.vue:227-242, 496, 2977-3065`
- Modify: `src/frontend/src/components/CableLayer.vue`
- Modify: `src/frontend/src/__tests__/topology.test.ts`

**Interfaces:**

- Consumes: Task 1 props/events and existing `deviceCableScene`, `cableOverlayStyle`, `onCable*` handlers.
- Produces: unchanged selection, tooltip, background clear, zoom, pan, rack-first and device-second-click behaviour.

- [ ] **Step 1: Write failing device-only integration tests**

Assert that `TopologyView.vue` imports/renders `DeviceCableCanvas` in the device overlay with all four handlers, while the other two consumers retain SVG:

```ts
expect(topology).toContain("import DeviceCableCanvas from '../components/DeviceCableCanvas.vue'")
expect(topology).toContain('<DeviceCableCanvas')
expect(topology).toContain('@bundle-click="onCableBundleClick"')
expect(rackView).toContain("import CableLayer from '../components/CableLayer.vue'")
expect(floorplan).toContain("import CableLayer from './CableLayer.vue'")
```

- [ ] **Step 2: Run focused integration test and verify it fails**

Run: `npm test -- --run src/__tests__/topology.test.ts -t "Canvas integration"`

Expected: FAIL before `TopologyView.vue` imports the new component.

- [ ] **Step 3: Make the minimal integration change**

Replace only the device-topology overlay child:

```vue
<DeviceCableCanvas
  :scene="deviceCableScene"
  :animation-enabled="animationEnabled"
  @bundle-click="onCableBundleClick"
  @bundle-hover="onCableBundleHover"
  @bundle-leave="onCableBundleLeave"
  @background-click="onCableBackgroundClick"
/>
```

Keep `cable-overlay` transform/z-index. Restore `CableLayer.vue` to the pre-experiment `scene.bundles` loop: remove `renderedBundles`, `mergeRenderedBundles`, and `v-memo` caching.

- [ ] **Step 4: Run focused and full frontend tests**

Run: `npm test -- --run src/__tests__/topology.test.ts`

Expected: PASS, including existing shared-SVG `CableLayer` SSR tests and new Canvas integration tests.

Run: `npm test`

Expected: the full frontend suite passes.

- [ ] **Step 5: Run static gates and commit**

Run: `npm run typecheck && npm run build && git diff --check`

Expected: all exit 0.

Commit: `fix(topology): isolate device cable canvas`.

### Task 3: Browser measurement and handoff

**Files:**

- Modify: `tasks/TASK-20260829-device-topology-semantic-rendering.md`
- Modify: `tasks/current-task.md`
- Modify: `tasks/MODULE-LOCKS.md`

**Interfaces:**

- Consumes: Canvas implementation and local Vite/API acceptance environment.
- Produces: exact measurement evidence and `READY_FOR_REVIEW` only when all gates pass.

- [ ] **Step 1: Run the established browser measurement**

At 1536x1024 with Beijing 2,850-device acceptance data, record device-topology entry-to-interactive, rack click to next frame, device click to next frame, and device-canvas count. Record exact milliseconds and results against `<= 3000 ms`, `<= 200 ms`, `<= 200 ms`.

- [ ] **Step 2: Re-run all gates**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: all exit 0. If either click remains over 200 ms, change no additional layer: record the remaining measured bottleneck and return task to `BLOCKED`.

- [ ] **Step 3: Record handoff and state**

If gates and targets pass, record exact test and browser results, commits and limitations. Change implementation locks to `HANDED_OFF` and transition `IN_PROGRESS` to `READY_FOR_REVIEW`. Do not mark complete or push without the user's current confirmation.

- [ ] **Step 4: Commit task evidence**

Run: `git status --short`

Expected: only approved implementation and task-evidence files. Commit: `docs(task): record device cable canvas verification`.

## Self-Review

1. Spec coverage: Canvas scope, draw semantics, hit testing, reduced motion and overlay alignment are Task 1–2; 2,850-device measurement and no-extra-layer rule are Task 3.
2. Placeholder scan: each task specifies exact files, events, test commands, behaviour, and measurable outputs.
3. Type consistency: Task 1 emits the four names/payloads consumed in Task 2; existing `TopologyView` handler signatures do not change.
