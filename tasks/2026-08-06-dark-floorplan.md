# TASK-0021: 机房平面图深色工作台改造

> **Status:** READY
> **Requirement Source:** `zs.png` 参考图 + 用户裁决
> **Plan:** `/home/shy/.claude/plans/snoopy-bouncing-piglet.md`
> **Owner:** Cursor Frontend
> **Reviewer:** Codex Reviewer
> **Created:** 2026-08-06

## Scope

改造 `FloorplanView.vue` 页面为深色运维工作台布局。严格限定在该页面，不涉及全站换肤、不改后端 API、不新增依赖。

## Allowed Files

| 文件 | 操作 | 预计行数 |
|------|------|---------|
| `src/frontend/src/views/FloorplanView.vue` | 重写模板+样式 | ~450 |
| `src/frontend/src/components/FloorplanCanvas.vue` | 修改 Konva 颜色+搜索高亮 | ~30 |
| `src/frontend/src/components/CableLayer.vue` | 线缆颜色改用 CSS 变量 | ~10 |
| `src/frontend/src/components/CableLegend.vue` | 适配深色背景 | ~5 |

## Forbidden Files

- `src/frontend/src/styles/tokens.css` — 全局主题，不动
- `src/frontend/src/App.vue` — 全局顶栏，不动
- `src/frontend/src/router.ts` — 路由，不动
- `src/backend/` — 任何后端文件，不动
- 其他所有未列在 Allowed Files 中的文件

## Implementation Spec

### 1. FloorplanView.vue — 核心改造

**暗色 CSS 变量覆盖**（在 `<style scoped>` 顶层）：

```css
.floorplan-dark {
  --color-bg: #0d1117;
  --color-bg-card: #161b22;
  --color-border: #21262d;
  --color-text: #c9d1d9;
  --color-text-secondary: #8b949e;
  --color-primary: #58a6ff;
  --color-success: #3fb950;
  --color-warning: #d2991d;
  --color-danger: #f85149;
  --color-nav-bg: #0d1117;
  /* 暗色专用 */
  --color-accent: #39d2c0;
  --color-rack-fill: #1a3a5c;
  --color-rack-empty: #161b22;
  --color-grid-line: #1c2533;
  background: var(--color-bg);
  color: var(--color-text);
  min-height: 100vh;
}
```

**页面布局结构：**

```
.floorplan-dark
├── header.floorplan-toolbar (深色, ~54px)
│   ├── 左侧: 菜单图标 + "机房详情" + 机房名
│   ├── 中部: <input> 搜索框 (客户端过滤 racks/servers)
│   └── 右侧: 查看/编辑模式切换 + 用户信息
├── .floorplan-body (flex row, flex:1)
│   ├── nav.floorplan-sidebar (~200px)
│   │   ├── 导航: 机房(→/) | 机柜(当前,高亮) | 服务器(→/servers) | 操作记录(→#recent)
│   │   └── 机房信息: 机柜数/U位总数/状态
│   ├── main.floorplan-main (flex:1, flex column)
│   │   ├── .capacity-overview (统计卡条: 机柜数|总U位|已用U位|使用率%)
│   │   ├── .canvas-wrap (flex:1, FloorplanCanvas + CableLayer + Legend)
│   │   └── .recent-changes (底部, 条件显示)
│   └── aside.floorplan-inspector (~360px)
│       ├── 空状态: "点击机柜查看详情"
│       └── 机柜详情: 编号+状态+容量条+RackFrontPanel+操作按钮
└── NetworkPathDrawer (现有, 保留)
```

**客户端搜索实现：**

```typescript
const searchQuery = ref('')
const searchResults = computed(() => {
  if (!searchQuery.value.trim()) return []
  const q = searchQuery.value.toLowerCase()
  // 过滤 racks: 匹配 code
  // 过滤 servers (需要从 API 获取当前机房服务器列表或从现有数据提取)
  return racks.value.filter(r => 
    r.code.toLowerCase().includes(q)
    // 如果有 servers 数据: || servers.some(s => s.name.toLowerCase().includes(q))
  ).map(r => r.id)
})
// 搜索结果通过 highlightedRackIds prop 传给 FloorplanCanvas
```

**最近位置变更实现：**

```typescript
const recentChanges = ref<AuditRecord[]>([])
watch(selectedRackId, async (rackId) => {
  if (!rackId) { recentChanges.value = []; return }
  // 获取该机柜所有服务器 ID
  // 并发请求 GET /api/servers/{id}/audit-records
  // 合并、排序、取最近 5 条
})
```

### 2. FloorplanCanvas.vue — Konva 深色适配

- 背景色: `stage.container().style.background = '#0d1117'`
- 网格线: `#1c2533`
- 机柜填充: 已用(基于 occupiedU/heightU 比例)用 `#1a3a5c`，空闲用 `#161b22`
- 选中机柜边框: `#39d2c0` (青色)
- 搜索高亮: 对应 rackId 在 searchResults 中 → 青色边框或脉冲
- 标尺颜色适配暗色背景

### 3. CableLayer.vue — 颜色变量化

将硬编码颜色改为引用 CSS 变量:
- 正常: `var(--color-primary, #58a6ff)`
- 存储: `var(--color-warning, #d2991d)`
- 上联: `var(--color-success, #3fb950)`
- 高亮路径: `var(--color-accent, #39d2c0)`

### 4. CableLegend.vue — 深色适配

- 卡片背景: `var(--color-bg-card, #161b22)`
- 边框: `var(--color-border, #21262d)`
- 文字: `var(--color-text, #c9d1d9)`

## Verification

```bash
# 类型检查
cd src/frontend && npx vue-tsc --noEmit

# 生产构建
cd src/frontend && npm run build

# E2E 验证
# 1. 打开 http://localhost:5173 → 登录 → 进入机房平面图
# 2. 确认深色主题生效
# 3. 导航到其他页面 → 确认保持浅色
# 4. 搜索机柜编号 → 确认高亮
# 5. 点击机柜 → 确认右侧检查器更新
# 6. 缩放/平移/适应屏幕 → 正常
# 7. 查看/编辑模式切换 → 正常
# 8. 拖拽/撤销/重做 → 正常
# 9. 线缆链路 → 正常
```

## Acceptance Criteria

1. FloorplanView 深色工作台布局 (背景#0d1117, 卡片#161b22)
2. 其他页面保持原浅色主题
3. 页面布局: 顶栏 + 左侧导航 + 中(容量条+平面图+变更记录) + 右检查器
4. 容量统计来自真实 racks 数据, 无硬编码数字
5. 左侧导航链接到现有路由, 不新增页面
6. 搜索框客户端过滤 racks/servers, 结果高亮
7. 点击机柜 → 右侧检查器同步
8. 无选中机柜 → 空状态
9. 所有现有交互功能无回归
10. 未新增依赖/API/数据模型变更
11. vue-tsc + build 通过
12. 1920×1080 无遮挡
