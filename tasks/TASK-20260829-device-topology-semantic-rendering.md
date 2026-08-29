# TASK-20260829-device-topology-semantic-rendering

- Status：READY
- Requirement Source：用户于 2026-08-29 批准方案 A；同日浏览器诊断确认北京设备页为 2,850 台设备、150 个机柜、591 条线缆，浏览器渲染为主瓶颈。
- Owner：Cursor Developer；Reviewer：Codex Reviewer
- Branch：fix/TASK-20260829-device-topology-semantic-rendering

## Goal

让大规模设备拓扑在保持“首击机柜聚焦、次击设备进入详情”流程的前提下可流畅进入、缩放、拖拽、筛选和点击。

## Scope

1. 空闲设备视图只绘制机柜概览；不创建每台设备的 Konva 面板或 HTML 设备命中按钮。
2. 聚焦机柜后，只为该机柜中的设备创建面板和 HTML 命中按钮；保留当前设备聚焦、线缆选择、筛选、低语义缩放和二次点击详情行为。
3. 缓存设备布局快照；焦点与筛选状态变化不得无条件重新布局。
4. 单次机柜或设备状态操作只能触发一次完整 `drawScene()`；移除处理器与响应式监听器重复触发的完整重绘。
5. 更新现有前端测试，覆盖空闲/机柜聚焦的设备节点与 HTML 命中目标范围、一次操作一次完整重绘，以及既有首次聚焦/二次详情行为。

## Acceptance Criteria

- 北京机房 2,850 台设备数据下：未聚焦时 HTML 设备命中按钮数为 0，机柜命中按钮数为 150；聚焦机柜后设备命中按钮仅对应该机柜的设备。
- 首击任意机柜聚焦；已聚焦机柜中的设备首击聚焦，第二次点击同一设备仍进入设备详情。
- 缩放、拖拽、线缆选择、设备名称/类型筛选保持现有行为；低缩放仍隐藏非必要设备细节。
- 同一状态操作不会触发两次完整图层销毁/重建。
- 在现有本机 1536×1024 Playwright 环境与北京验收数据中，设备页进入可交互状态目标不超过 3 秒，设备点击至下一帧响应目标不超过 200 ms；记录实际测量值。
- `npm test`、`npm run typecheck`、`npm run build` 与 `git diff --check` 通过。

## File Scope

- `src/frontend/src/views/TopologyView.vue`
- `src/frontend/src/__tests__/topology.test.ts`

## Non-goals

- 不修改 API、数据库、种子数据、数据模型、线缆业务规则或 Konva/CableLayer 架构。
- 不新增依赖、页面、性能监控平台或通用虚拟列表框架。
- 不改变机柜优先于设备的交互规则。

## Verification

- Cursor Developer：测试先行，提供 2,850 设备浏览器测量命令和结果；交接前运行前端 test、typecheck、build、diff check。
- Codex Reviewer：独立重跑验证并审核无越界数据/API/依赖改动。
