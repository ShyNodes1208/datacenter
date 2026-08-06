# Task 5: CableLayer SVG 渲染组件

> **Assigned to:** Cursor
> **Depends on:** Task 4
> **Plan ref:** docs/superpowers/plans/2026-08-05-cable-visualization.md

## 目标

创建 `<CableLayer>` 组件，用 SVG 渲染线束、高亮路径、方向箭头、聚合标签。

## 文件

| 文件 | 操作 |
|------|------|
| `src/frontend/src/components/CableLayer.vue` | 新建 |

## Props / Emits

```typescript
// Props
scene: CableScene
animationEnabled: boolean

// Emits
'bundle-click': [bundleId: string]
'background-click': []
```

## 功能要点

1. **SVG overlay** — `position: absolute; inset: 0; pointer-events: none`，子元素 `pointer-events: auto`
2. **免责声明** — 左上角灰色小字 "路径追踪效果，非实时流量"
3. **线束渲染** — 遍历 `scene.bundles`：
   - `<path>` 元素，`d` 属性由 `bundle.route` 生成
   - `stroke` 按 purpose 取色，`stroke-width` 按聚合数 (2~13px)
   - `stroke-dasharray` 按 purpose 区分线型
   - 聚合标签 `×N` 显示在线路中点上方
   - 方向箭头 `<polygon>` 在线路中点
4. **高亮路径** — `scene.highlightedPath` 存在时：
   - 红色路径 (#EF4444)，stroke-width=3
   - 路径标签 "源设备/端口 → 目标设备/端口"
5. **动画** — `.animated-path` CSS class：
   ```css
   @keyframes dash-flow { to { stroke-dashoffset: -24; } }
   ```
   - 当 `animationEnabled && !prefersReducedMotion && bundle.highlighted` 时启用
6. **prefers-reduced-motion** — 用 `window.matchMedia('(prefers-reduced-motion: reduce)')` 检测

## 样式要点

```css
.cable-layer { z-index: 10; }
.cable-layer path { transition: opacity 0.25s ease, stroke-width 0.25s ease; }
@media (prefers-reduced-motion: reduce) { .animated-path { animation: none; } }
```

完整模板参考: `docs/superpowers/plans/2026-08-05-cable-visualization.md` Task 5

## 编译验证

```bash
cd src/frontend && npx vue-tsc --noEmit
```

## Commit

```
feat: add CableLayer SVG component for cable bundle rendering
```
