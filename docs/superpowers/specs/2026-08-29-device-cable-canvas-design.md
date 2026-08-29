# Device-level Cable Canvas Design

## Decision

For `TASK-20260829-device-topology-semantic-rendering`, replace the SVG cable renderer **only in the device topology view** with a native Canvas renderer. `RackDeviceView.vue` and `FloorplanCanvas.vue` keep their existing `CableLayer.vue` SVG renderer.

This is the smallest change that removes the measured bottleneck: focus changes were mutating roughly 579–594 SVG cable bundle nodes. The retained-node SVG attempt regressed to 412.9 ms / 423.5 ms (rack/device), so keeping one DOM node per device-level cable bundle is no longer viable for the required response target.

User approval: 2026-08-29, “确认方案”.

## Scope and behaviour

- Create `DeviceCableCanvas.vue`, used only by `TopologyView.vue` when `topology.mode === 'devices'`.
- Consume the existing `CableScene` and preserve route, colour, width, dash pattern, opacity, aggregate count label, directional arrows, selected highlight, and reduced-motion behaviour.
- Preserve `bundle-click`, `bundle-hover`, `bundle-leave`, and `background-click` events with their existing payloads. Pointer hit testing uses the existing route points and a 14 px logical hit width.
- Redraw one canvas bitmap when scene, size, or visual animation state changes. Create no DOM node per cable bundle.
- Keep the existing transformed overlay so fit, zoom and pan remain aligned with Konva and rack/device HTML hit targets.

## Boundaries

- Do not change API contracts, data models, cable scene construction, line-routing rules, filters, database data, dependencies, or other pages.
- Do not change the shared `CableLayer.vue` public contract. Restore its uncommitted hidden-bundle cache experiment; it is a rejected optimization, not part of this design.
- Do not move device panels or ports out of the existing Konva detail layer in this change.
- Do not promise the 200 ms target before browser measurement. Canvas removes SVG DOM work; the remaining device-detail Konva redraw must be measured independently afterward.

## Rendering and interaction design

`DeviceCableCanvas.vue` owns one `<canvas data-testid="device-cable-canvas">` sized by `ResizeObserver` and `window.devicePixelRatio`. Each redraw resets the transform to the current pixel ratio, clears logical canvas bounds, then draws visible bundles in scene order.

Each bundle draws a route path, aggregate label, and directional arrows. A highlighted route uses the same accent stroke and label as SVG. When animation is enabled and reduced motion is not requested, a request-animation-frame loop changes only dash offset; otherwise no animation frame is scheduled.

Pointer coordinates are converted from `getBoundingClientRect()` to logical canvas coordinates, keeping hit testing correct after parent CSS translate/scale. The topmost visible bundle whose route is within 7 px is selected. Pointer move emits hover only when its bundle changes; unmatched click emits `background-click`.

## Acceptance additions

- Device topology renders one Canvas cable surface and zero SVG bundle groups; room/rack pages retain SVG `CableLayer` output.
- Canvas hit testing emits the current bundle ID for a route hit and existing background/leave events for misses.
- Existing cable display semantics and cable-detail interactions remain unchanged.
- Repeat the 2,850-device measurement and record entry, rack click-to-next-frame, and device click-to-next-frame. Targets remain <= 3 s, <= 200 ms, <= 200 ms. A remaining miss identifies the next measured layer; it does not authorize more scope.

## Change Request

| Field | Record |
| --- | --- |
| Change Request ID | CR-20260829-001 |
| Discoverer | Codex + Terra, browser performance profile |
| Original task | TASK-20260829-device-topology-semantic-rendering |
| Reason | SVG focus updates mutate 579–594 line bundle nodes and miss the click target after three in-scope attempts. |
| Product impact | No workflow change; cables remain visible, selectable and hoverable. |
| Technical impact | Add a device-only native Canvas component; keep shared SVG for other views. |
| File impact | Create `DeviceCableCanvas.vue`; modify `TopologyView.vue` and `topology.test.ts`; restore failed `CableLayer.vue` change. |
| Test impact | Add Canvas structure/interaction tests and repeat full frontend and 2,850-device browser verification. |
| Risk | Canvas hit testing and transformed coordinates can regress selection; focused tests and browser interaction checks cover both. |
| Product decision | User approved device-only Canvas on 2026-08-29. |
| Architect decision | Use one native Canvas, not one Konva node per cable, because strict click budget cannot afford a second retained scene graph. |
| Updated requirement source | User approval “确认方案”, 2026-08-29. |
| Approval status | APPROVED |
