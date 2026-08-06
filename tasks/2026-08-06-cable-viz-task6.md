# Task 6: CableBreadcrumb + CableLegend 组件

> **Assigned to:** Cursor
> **Depends on:** Task 4 (需要类型定义)
> **Plan ref:** docs/superpowers/plans/2026-08-05-cable-visualization.md

## 目标

创建面包屑导航和图例面板两个辅助组件。

## 文件

| 文件 | 操作 |
|------|------|
| `src/frontend/src/components/CableBreadcrumb.vue` | 新建 |
| `src/frontend/src/components/CableLegend.vue` | 新建 |

---

## Part A: CableBreadcrumb.vue

### Props / Emits

```typescript
props: { items: BreadcrumbItem[] }
emits: { 'navigate': [level: CableFocus['level'], id: string] }
```

### 模板

面包屑导航，如: `机房总览 > 机柜 A01 > 交换机-Core-01`

- 每个 `<button>` 显示 `item.label`
- 最后一项高亮（当前层）
- 项之间 `>` 分隔符
- 点击触发 `navigate` 事件

---

## Part B: CableLegend.vue

### Props / Emits

```typescript
props: { legend: LegendItem[], detailRows: DetailRow[], animationEnabled: boolean }
emits: { 'toggle-animation': [], 'filter-change': [purposes: string[], cableTypes: string[]] }
```

### 模板

1. **图例区** — 遍历 `legend`，每项显示:
   - 颜色线段 (SVG `<line>`)
   - 用途标签 (正常连接/存储链路/交换机上联)
   - 线缆类型
   - 数量 badge

2. **动画开关** — `<input type="checkbox">` 绑定 `animationEnabled`

3. **连接明细表** — `<details>` 折叠面板:
   - 表格列: 源设备 | 源端口 | 目标设备 | 目标端口 | 类型 | 用途
   - 源/目标设备后显示 `[机柜编号]`

### 样式

- 卡片容器: `border: 1px solid var(--color-border); border-radius: var(--radius)`
- 使用项目 CSS 变量

完整代码参考: `docs/superpowers/plans/2026-08-05-cable-visualization.md` Task 6

## 编译验证

```bash
cd src/frontend && npx vue-tsc --noEmit
```

## Commit

```
feat: add CableBreadcrumb and CableLegend components
```
