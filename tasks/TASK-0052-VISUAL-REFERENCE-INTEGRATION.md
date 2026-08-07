# TASK-0052：机房与线缆可视参考接入

## 状态与角色

- Status: COMPLETED_FOR_REVIEW
- Branch: `codex/room-cable-visual-integration`
- Owner: Cursor Developer
- Reviewer: Codex Reviewer（独立只读）
- Requirement Source: 用户要求将确切的 V2 机房整体图稿和线缆连接可视化接入现有项目，并按 Coordinator → Cursor Developer → Codex Reviewer 交付。

## 用户可见目标

登录后访问 `/visual-reference`，看到独立的“视觉参考”页面：展示去除冷热通道后的 V2 机房 2.5D 图稿，并在受沙盒保护的 iframe 中展示线缆连接策略 HTML。两者只作产品说明/视觉参考，不替换现有 2D 平面图、机柜操作或线缆交互，也不伪装成实时业务数据。

## 最小实施方案

- 将 H 盘确切 V2 PNG 复制为 `src/frontend/public/visual-reference/room-overview.png`。
- 将 H 盘原始 `cable-connection-strategy.html` 复制为 `src/frontend/public/visual-reference/cable-connection-strategy.html`，内容保持字节级不变。
- 新增 `VisualReferencePanel.vue`，用两个语义卡片展示图片和 iframe；iframe 必须保留 `sandbox="allow-scripts"`、`referrerpolicy="no-referrer"`，并提供原始文件链接。
- 新增 `VisualReferenceView.vue` 作为独立认证路由，避免修改当前被 TASK-0020 HANDED_OFF 占用的 `HomeView.vue`，也不触碰 TASK-0021 的 Floorplan/Cable 锁定组件。
- 在 `src/frontend/src/router.ts` 增加 `/visual-reference` 路由。
- 不新增依赖、后端接口、数据库字段或业务状态。

## 明确不做

- 不修改 `HomeView.vue`、FloorplanView、FloorplanCanvas、CableLayer、CableLegend。
- 不把静态图稿接入实时容量、机柜、线缆数据。
- 不新增冷热通道、温湿度监控、AI 预测或 3D 漫游功能。
- 不修改原始图稿或 HTML 内部内容。

## 允许修改路径

- `src/frontend/public/visual-reference/room-overview.png`
- `src/frontend/public/visual-reference/cable-connection-strategy.html`
- `src/frontend/src/components/VisualReferencePanel.vue`
- `src/frontend/src/components/__tests__/VisualReferencePanel.test.ts`
- `src/frontend/src/views/VisualReferenceView.vue`
- `src/frontend/src/router.ts`
- `tasks/TASK-0052-VISUAL-REFERENCE-INTEGRATION.md`
- `tasks/current-task.md`
- `tasks/MODULE-LOCKS.md`
- `reviews/tasks/TASK-0052-VISUAL-REFERENCE-REVIEW.md`（仅 Reviewer）

## 验收标准

- AC-01：V2 PNG 可通过 `/visual-reference/room-overview.png` 加载，且 SHA-256 与 H 盘源文件一致。
- AC-02：线缆 HTML 可通过 `/visual-reference/cable-connection-strategy.html` 加载，且 SHA-256 与 H 盘源文件一致。
- AC-03：访问 `/visual-reference` 显示两个有标题、说明和准确 alt/title 的参考卡片。
- AC-04：线缆 iframe 保留 `sandbox="allow-scripts"` 与 `referrerpolicy="no-referrer"`；不执行未批准的跨域脚本或 API。
- AC-05：桌面双列、窄屏单列；图片和 iframe 可通过键盘访问，原始资源有明确链接。
- AC-06：不修改 TASK-0020/TASK-0021 活跃锁定路径，不新增依赖、后端改动或 API 变化。
- AC-07：组件测试、前端 typecheck、构建和 `git diff --check` 通过。

## 测试命令

```bash
npm test -- --run src/frontend/src/components/__tests__/VisualReferencePanel.test.ts
npm run typecheck
npm run build
git diff --check
```

## 交付门禁

Cursor Developer 完成实现、自测和交接后将任务置为 `READY_FOR_REVIEW`；独立 Codex Reviewer 只读审核并输出 PASS 或 CHANGES_REQUESTED。仅在 Reviewer PASS、Coordinator 最终检查、提交和推送完成后标记 COMPLETED。


## Completion record

- Cursor implementation: completed and self-tested.
- Independent Codex Reviewer: PASS; no blocker, major, or minor findings.
- Verified: component tests 3/3 PASS; typecheck PASS; build PASS; git diff --check exit 0.
- Resource hashes: room PNG FC5A6366B7FC65A341F30DAEB355155F7A78AA6FB11F42914AE11FB3142B9B45; cable HTML 7BE8319F6C2D931772FC0325866E2B3849A7E238D285FC23C11E20D9B4AC3057.
- Final coordinator action: commit and push this task branch; release TASK-0052 locks after commit.
