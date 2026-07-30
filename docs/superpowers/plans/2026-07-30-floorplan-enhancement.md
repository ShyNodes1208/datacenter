# Floorplan Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the floorplan canvas with multi-level grid + rulers, zoom controls overlay, and richer rack visuals (capacity bar + hover tooltip).

**Architecture:** All changes are inside `FloorplanCanvas.vue`. Zero backend changes. The canvas gets three new visual layers: ruler layer (top/left), enhanced grid (major/minor lines), and zoom control overlay (HTML overlaid on canvas container). Rack groups gain a capacity bar and hover tooltip.

**Tech Stack:** Vue 3 + TypeScript + Konva 9.x + Vitest, no new dependencies.

## Global Constraints

- Zero backend changes
- No new npm dependencies
- Ruler follows zoom/pan — redrawn on viewport change
- Zoom controls: HTML overlay positioned absolute on canvas container (not Konva)
- Rack capacity bar: 4px tall fill bar at bottom of rack rect
- TypeScript strict, scoped CSS

---

### Task 1: Multi-level grid + ruler

**Files:**
- Modify: `src/frontend/src/components/FloorplanCanvas.vue`

**Changes:**

1. **Add ruler constants:**
```typescript
const RULER_SIZE = 24 // px
const GRID_MAJOR = 300 // every 5 minor cells = 1 major
```

2. **Add ruler layers** (top ruler + left ruler):

Add to `init()` after `gridLayer`:
```typescript
const rulerLayer = new Konva.Layer({ listening: false })
stage.add(rulerLayer)
```

Create `drawRulers()` function:
```typescript
function drawRulers(layer: Konva.Layer): void {
  if (!stage) return
  layer.destroyChildren()
  const scale = stage.scaleX()
  const pos = stage.position()
  const w = stage.width()
  const h = stage.height()

  // Top ruler background
  layer.add(new Konva.Rect({
    x: RULER_SIZE, y: 0, width: w - RULER_SIZE, height: RULER_SIZE,
    fill: '#f0f2f5', listening: false,
  }))
  // Left ruler background
  layer.add(new Konva.Rect({
    x: 0, y: RULER_SIZE, width: RULER_SIZE, height: h - RULER_SIZE,
    fill: '#f0f2f5', listening: false,
  }))
  // Corner
  layer.add(new Konva.Rect({
    x: 0, y: 0, width: RULER_SIZE, height: RULER_SIZE,
    fill: '#e0e0e0', listening: false,
  }))

  // Top ruler ticks
  const majorInterval = GRID_MAJOR * scale
  const minorInterval = GRID * scale
  const startX = pos.x % majorInterval
  for (let x = RULER_SIZE + startX; x < w; x += minorInterval) {
    const isMajor = Math.abs(((x - RULER_SIZE - startX) / minorInterval) % 5) < 0.01
    const tickH = isMajor ? 16 : 8
    layer.add(new Konva.Line({
      points: [x, 0, x, tickH],
      stroke: '#999', strokeWidth: 0.5, listening: false,
    }))
  }

  // Left ruler ticks
  const startY = pos.y % majorInterval
  for (let y = RULER_SIZE + startY; y < h; y += minorInterval) {
    const isMajor = Math.abs(((y - RULER_SIZE - startY) / minorInterval) % 5) < 0.01
    const tickW = isMajor ? 16 : 8
    layer.add(new Konva.Line({
      points: [0, y, tickW, y],
      stroke: '#999', strokeWidth: 0.5, listening: false,
    }))
  }

  layer.batchDraw()
}
```

3. **Enhance grid:** Replace simple dashed lines with major/minor grid:

```typescript
function drawGrid(layer: Konva.Layer, w: number, h: number): void {
  layer.destroyChildren()
  // Minor grid
  for (let x = 0; x <= w; x += GRID) {
    layer.add(new Konva.Line({
      points: [x, 0, x, h], stroke: '#eee', strokeWidth: 0.3,
      listening: false,
    }))
  }
  for (let y = 0; y <= h; y += GRID) {
    layer.add(new Konva.Line({
      points: [0, y, w, y], stroke: '#eee', strokeWidth: 0.3,
      listening: false,
    }))
  }
  // Major grid (every 5)
  for (let x = 0; x <= w; x += GRID_MAJOR) {
    layer.add(new Konva.Line({
      points: [x, 0, x, h], stroke: '#ddd', strokeWidth: 0.8,
      listening: false,
    }))
  }
  for (let y = 0; y <= h; y += GRID_MAJOR) {
    layer.add(new Konva.Line({
      points: [0, y, w, y], stroke: '#ddd', strokeWidth: 0.8,
      listening: false,
    }))
  }
}
```

4. **Redraw rulers on zoom/pan** — add `drawRulers(rulerLayer!)` calls at the end of the wheel handler and pan handlers.

5. **Offset canvas area** — The canvas drawing area should account for rulers. Shift rack positioning by `(RULER_SIZE, RULER_SIZE)` when rendering, or more simply, keep the stage at canvas size and draw rulers as overlay graphics at fixed positions. The latter approach is simpler:
   - The stage fills the container
   - Grid and racks are drawn offset by `(RULER_SIZE, RULER_SIZE)`  
   - Rulers are drawn at top/left edges, fixed in screen space
   - During zoom/pan, redraw rulers to update tick positions

   Actually, the simplest approach: **draw rulers in a separate Konva Layer that is NOT affected by zoom/pan**. Use `layer.scale()` and `layer.position()` separately. But Konva doesn't natively support per-layer transforms easily.

   **Alternative simpler approach:** Keep rulers as HTML overlay elements positioned with CSS, outside Konva entirely. This avoids complex per-layer transform management.

Let's go with the **HTML overlay** approach for rulers — it's simpler and more performant:

In the template, add ruler elements:
```html
<div class="floorplan-canvas-wrap">
  <div class="flp-ruler flp-ruler--top"></div>
  <div class="flp-ruler flp-ruler--left"></div>
  <div ref="containerRef" class="floorplan-canvas"></div>
</div>
```

The rulers can be drawn with CSS background (repeating gradients for ticks) or via a small canvas/div with computed styles based on zoom/pan state.

**Recommended approach:** Use Vue reactive state to track scale/position, then draw ruler ticks in the HTML rulers using computed styles. This keeps Konva focused on the main scene.

**Add to script:**
```typescript
const zoomLevel = ref(1)
const panX = ref(0)
const panY = ref(0)
```

Update wheel/pan handlers to set these refs. Then add template rulers with CSS that computes tick positions.

Actually, the simplest complete approach: **draw ruler on a Konva layer that uses the stage's transform but is redrawn on each viewport change with tick positions calculated to look "fixed".** This is the common approach. Let me just use this.

**Final approach for rulers:** Add a `rulerLayer` that sits on top of everything. In the draw loop, update ruler ticks. Call `drawRulers()` from the wheel handler and pan handlers. Rulers are redrawn each frame during interaction (not during idle — this is fine for performance).

Call `drawRulers(rulerLayer)` from:
- End of `init()`
- Wheel handler (after zoom)
- Pan handlers (after pan)
- ResizeObserver callback

- [ ] **Step 1: Make the changes**

- [ ] **Step 2: Verify**
```bash
cd src/frontend && npx vue-tsc --noEmit && npx vitest run
```
Expected: no type errors, all tests pass.

- [ ] **Step 3: Commit**
```bash
git add src/frontend/src/components/FloorplanCanvas.vue
git commit -m "feat: add multi-level grid and rulers to floorplan canvas"
```

---

### Task 2: Zoom controls

**Files:**
- Modify: `src/frontend/src/components/FloorplanCanvas.vue`

**Changes:**

Add zoom controls as HTML overlay inside the canvas container.

1. **Template** — add zoom controls div:
```html
<div ref="containerRef" class="floorplan-canvas">
  <div class="flp-zoom-controls">
    <button class="flp-zoom-btn" title="缩小" @click="zoomOut">−</button>
    <span class="flp-zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
    <button class="flp-zoom-btn" title="放大" @click="zoomIn">+</button>
    <button class="flp-zoom-btn flp-zoom-btn--fit" title="适应屏幕" @click="fitToScreen">⊡</button>
  </div>
</div>
```

2. **Script** — add `zoomLevel` ref and zoom functions:
```typescript
const zoomLevel = ref(1)

function updateZoomLevel(): void {
  if (stage) zoomLevel.value = stage.scaleX()
}

function zoomIn(): void {
  if (!stage) return
  const oldScale = stage.scaleX()
  const newScale = Math.min(3, oldScale * 1.25)
  const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 }
  stage.scale({ x: newScale, y: newScale })
  stage.position({
    x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
    y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale),
  })
  zoomLevel.value = newScale
  stage.batchDraw()
}

function zoomOut(): void {
  if (!stage) return
  const oldScale = stage.scaleX()
  const newScale = Math.max(0.3, oldScale / 1.25)
  const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 }
  stage.scale({ x: newScale, y: newScale })
  stage.position({
    x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
    y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale),
  })
  zoomLevel.value = newScale
  stage.batchDraw()
}

function fitToScreen(): void {
  if (!stage || !containerRef.value) return
  // Calculate bounds of all racks
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const rack of props.racks) {
    const cx = props.toCanvasX(rack.x)
    const cy = props.toCanvasY(rack.y)
    minX = Math.min(minX, cx); minY = Math.min(minY, cy)
    maxX = Math.max(maxX, cx + RACK_W); maxY = Math.max(maxY, cy + RACK_H)
  }
  if (!isFinite(minX)) { stage.scale({ x: 1, y: 1 }); stage.position({ x: 0, y: 0 }); zoomLevel.value = 1; stage.batchDraw(); return }

  const padding = 80
  const contentW = maxX - minX + padding * 2
  const contentH = maxY - minY + padding * 2
  const scaleX = (stage.width() - RULER_SIZE) / contentW
  const scaleY = (stage.height() - RULER_SIZE) / contentH
  const scale = Math.min(scaleX, scaleY, 2) // cap at 200%
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  stage.scale({ x: scale, y: scale })
  stage.position({
    x: (stage.width() - RULER_SIZE) / 2 - cx * scale + RULER_SIZE,
    y: (stage.height() - RULER_SIZE) / 2 - cy * scale + RULER_SIZE,
  })
  zoomLevel.value = scale
  stage.batchDraw()
}
```

3. **Update wheel handler** to call `updateZoomLevel()` after zoom.

4. **Keyboard shortcut:** Add to FloorplanView `onKeyDown`:
```typescript
if (e.key === '0' && e.ctrlKey) { e.preventDefault(); /* emit fit-to-screen */ }
```
Or expose `fitToScreen` via `defineExpose` and call from parent via template ref.

5. **CSS:**
```css
.flp-zoom-controls {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255,255,255,0.92);
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: var(--radius, 6px);
  padding: 4px 8px;
  box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,0.1));
}
.flp-zoom-btn {
  width: 24px; height: 24px;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 4px;
  background: var(--color-bg-card, #fff);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text, #333);
}
.flp-zoom-btn:hover { background: var(--color-bg-hover, #f0f2f5); }
.flp-zoom-level {
  min-width: 40px;
  text-align: center;
  font-size: 11px;
  color: var(--color-text-secondary, #888);
}
.flp-zoom-btn--fit {
  margin-left: 4px;
  font-size: 12px;
}

.floorplan-canvas {
  position: relative; /* for absolute positioning of zoom controls */
}
```

- [ ] **Step 1: Make the changes**

- [ ] **Step 2: Verify**
```bash
cd src/frontend && npx vue-tsc --noEmit && npx vitest run
```
Expected: no type errors, all tests pass.

- [ ] **Step 3: Commit**
```bash
git add src/frontend/src/components/FloorplanCanvas.vue
git commit -m "feat: add zoom controls with +/- buttons and fit-to-screen"
```

---

### Task 3: Enhanced rack visuals

**Files:**
- Modify: `src/frontend/src/components/FloorplanCanvas.vue`

**Changes:**

1. **Add capacity bar** inside each rack rect:

Modify `renderRacks()`. Inside the rack Group, after adding the rect and label, add a capacity bar:

```typescript
const capPct = rack.heightU > 0 ? (rack.occupiedU ?? 0) / rack.heightU : 0
const barColor = capPct > 0.8 ? '#e74c3c' : capPct >= 0.5 ? '#f0ad4e' : '#52c41a'
const barHeight = 4

// Capacity bar background
const capBarBg = new Konva.Rect({
  x: 0, y: RACK_H - barHeight,
  width: RACK_W, height: barHeight,
  fill: '#e0e0e0',
  listening: false, name: 'capBarBg',
})
// Capacity bar fill
const capBarFill = new Konva.Rect({
  x: 0, y: RACK_H - barHeight,
  width: RACK_W * capPct, height: barHeight,
  fill: barColor,
  listening: false, name: 'capBarFill',
})

group.add(capBarBg, capBarFill)
```

2. **Add tooltip on hover** (using Konva.Label):

Add to `renderRacks()`, inside the group setup:

```typescript
const tooltip = new Konva.Label({
  x: RACK_W + 8, y: 0,
  visible: false, listening: false,
  opacity: 0.92,
})
tooltip.add(new Konva.Tag({
  fill: '#2c3e50', cornerRadius: 4,
  pointerDirection: 'left', pointerWidth: 6, pointerHeight: 8,
}))
tooltip.add(new Konva.Text({
  text: `${rack.code}\n${rack.roomName ?? ''}\n${rack.occupiedU ?? 0}/${rack.heightU}U (${Math.round(capPct * 100)}%)`,
  fontSize: 11, fontFamily: 'sans-serif',
  fill: '#fff', padding: 6, lineHeight: 1.4,
}))

group.on('mouseenter', () => { tooltip.visible(true); rackLayer?.batchDraw() })
group.on('mouseleave', () => { tooltip.visible(false); rackLayer?.batchDraw() })

group.add(tooltip)
```

3. **Reduce label font** and add a second line for capacity:

Update the label to two-line text:
```typescript
const label = new Konva.Text({
  text: `${rack.code}\n${rack.occupiedU ?? 0}/${rack.heightU}U`,
  fontSize: 10, fontFamily: 'sans-serif',
  fill: '#2c3e50', align: 'center', verticalAlign: 'middle',
  width: RACK_W, height: RACK_H - 6, // room for capacity bar
  listening: false,
  lineHeight: 1.3,
})
```

4. **Update `occColor`** function — already exists, keep as is for rect fill.

- [ ] **Step 1: Make the changes**

- [ ] **Step 2: Verify**
```bash
cd src/frontend && npx vue-tsc --noEmit && npx vitest run
```
Expected: no type errors, all tests pass.

- [ ] **Step 3: Commit**
```bash
git add src/frontend/src/components/FloorplanCanvas.vue
git commit -m "feat: enhance rack visuals with capacity bar and hover tooltip"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start services**
```bash
cd src/backend/Datacenter.Api && dotnet run
cd src/frontend && npm run dev
```

- [ ] **Step 2: Verify floorplan**
1. Open `http://localhost:5173`, navigate to 机房A → 平面图
2. Grid: major lines visible at 300px, minor at 60px
3. Rulers: top and left with tick marks
4. Zoom controls: bottom-left, +/- buttons work, percentage updates
5. 适应屏幕 button: centers racks in view
6. Racks: capacity bar at bottom (green/orange/red), two-line label
7. Hover rack: tooltip shows code, room, occupancy
8. Drag/pan/zoom all still work

- [ ] **Step 5: Final commit if fixes needed**
