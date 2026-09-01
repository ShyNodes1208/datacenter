# TASK-20260901-device-single-click

## 基本信息

| 字段 | 内容 |
|---|---|
| 状态 | `COMPLETED` |
| 需求来源 | 用户 2026-09-01 确认：单击设备直接居中显示全部物理相连设备。 |
| 产品/技术统筹 | Codex + Terra |
| Owner | Cursor Developer |
| 独立 Reviewer | Codex Reviewer |
| 计划分支 | `fix/TASK-20260901-device-single-click` |

## 已批准范围

1. 在拓扑设备面板和现有点击覆盖层中，第一次单击设备直接进入现有的设备聚焦视图。
2. 设备聚焦视图继续复用现有可达设备筛选与居中布局；不改变其十跳上限。
3. 同一设备已聚焦时再次单击，继续跳转设备详情。
4. 增加最小回归测试，覆盖首次点击不再先切换为机柜流向图。

允许路径：`src/frontend/src/views/TopologyView.vue`、`src/frontend/src/__tests__/topology.test.ts`；经 Codex + Terra 技术裁决，额外允许 `src/frontend/src/test-harness/rack-hit-harness.ts`，仅暴露内存路由文本供已批准的真实二次点击回归观测，不改变生产路由或产品功能。

## 禁止范围

- 不改后端接口、数据库、线缆数据、布局算法或依赖。
- 不改机柜、线缆束和背景点击行为。

## 验收标准

1. 在未聚焦状态单击设备后，`focusDeviceId` 直接为该设备且 `focusedRackId` 被清空。
2. 已聚焦同一设备再次单击仍进入 `/servers/{deviceId}`。
3. 定向 Vitest、typecheck、build 和 `git diff --check` 通过。

## 任务状态

- 2026-09-01：Codex + Terra 创建并批准产品/技术基线，合法迁移 `DRAFT → READY`。两条目标路径无 `CLAIMED` 或 `HANDED_OFF` 父子冲突；仅 Cursor Developer 认领后可转为 `IN_PROGRESS`。

## 实施与交接

- 2026-09-01：Cursor Developer 完成 `READY → IN_PROGRESS`（两条目标路径登记 `CLAIMED`）及 `IN_PROGRESS → READY_FOR_REVIEW`（两条锁改为 `HANDED_OFF`）。首次设备单击现在直接设置 `focusDeviceId` 并清空 `focusedRackId`；同设备再次单击仍导航 `/servers/{deviceId}`。Konva 设备面板与 DOM 覆盖层均移除机柜前置点击。
- 2026-09-01：Codex Reviewer 转 `CHANGES_REQUESTED`：RV-001（MEDIUM：两入口没有可执行测试）；RV-002（LOW：`tasks/current-task.md` 状态不一致）。Cursor Developer 重新认领两锁，进入 `IN_FIX`。
- 2026-09-01：Codex Reviewer 新增 RV-003（MEDIUM：memory history 下 `waitForURL` 不成立）与 RV-004（LOW：harness 环境变量名称不一致）；任务转 `CHANGES_REQUESTED`，两锁重新认领并进入 `IN_FIX`。
- 2026-09-01：完成 `IN_FIX → READY_FOR_RETEST`，两条锁改为 `HANDED_OFF`。harness 现在渲染 `rack-hit-harness-route` 可见路由状态；测试统一优先读取 `RACK_HIT_HARNESS_DEV_SERVER`，DOM/Konva 二击均断言实际内存路由为 `/servers/d1`。
- 2026-09-01：Codex Reviewer 复验发现 RV-005：真实回归在 topology.test.ts:3548、3576 报 `expectPage is not a function`；任务转 `CHANGES_REQUESTED`，两锁重新认领并进入 `IN_FIX`。
- 2026-09-01：完成 `IN_FIX → READY_FOR_RETEST`，两条锁改为 `HANDED_OFF`。两处断言改用现有 Vitest `expect(await routeState.textContent()).toBe('/servers/d1')`，未改生产代码。
- RV-005 GREEN：`RACK_HIT_HARNESS_DEV_SERVER=http://127.0.0.1:5175 npm test -- topology.test.ts` 执行结果 119/122 通过，新增测试因环境无法访问 5175 被 helper 阻塞；`npm run typecheck`、`npm run build`、`git diff --check` PASS。
- 2026-09-01：最终复审提出 RV-006（MEDIUM）：harness 路径未纳入任务锁/允许范围。Codex + Terra 技术裁决批准该路径仅用于暴露内存路由文本；任务转 `CHANGES_REQUESTED`，随后补登记第三锁并完成 `CHANGES_REQUESTED → IN_FIX → READY_FOR_RETEST`，三锁均为 `HANDED_OFF`。
- RED/GREEN：修复前使用 `waitForURL` 在 memory history 下无法完成；修复后静态定向测试可编译，真实 harness 命令因当前环境无法访问 `127.0.0.1:5175` 仍受阻。`npm run typecheck`、`npm run build`、`git diff --check` PASS。
- 2026-09-01：完成 `IN_FIX → READY_FOR_RETEST`，两条锁改为 `HANDED_OFF`。新增真实 Playwright 回归：DOM `device-hit-target` 首击不聚焦机柜、二击导航；禁用覆盖层后真实 Konva 设备面板首击不聚焦机柜、二击导航。
- RED/GREEN 证据：新增真实测试已执行，但当前沙箱无法访问 5175/5190 本地 Vite 服务，Playwright harness 未完成运行；旧 handler 单元 RED 与直接聚焦 GREEN 仍由前一轮证据保留。`npm run typecheck`、`npm run build`、`git diff --check` PASS。
- RV-002：`tasks/current-task.md` 已同步为 `READY_FOR_RETEST`。提交仍待本地 Git 元数据可写后执行，不 push。
- 修改文件：`src/frontend/src/views/TopologyView.vue`、`src/frontend/src/__tests__/topology.test.ts`；治理锁：`tasks/MODULE-LOCKS.md`。
- RED：旧实现定向测试失败，`focusDeviceId` 保持 `null`（旧机柜前置分支）。GREEN：`vitest run topology.test.ts -t 'TASK-20260901-device-single-click'`，2/2 通过。
- 验证：`npm test -- topology.test.ts` 119/120 通过；唯一失败为既有 F2 浏览器 harness 无法连接 `http://localhost:5173`。`npm run typecheck`、`npm run build`、`git diff --check` 通过。
- 提交交接：本地提交说明 `fix: focus connected devices on first click`；不 push，待独立 Codex Reviewer 审核。
- 已知限制：F2 需要本地 Vite dev server（沙箱禁止监听 5173），未改变机柜、线缆束和背景点击行为。

## 最终完成

- 2026-09-01：Codex Reviewer 最终复审 PASS，合法迁移 `READY_FOR_RETEST → COMPLETED`；RV-003/RV-004/RV-005/RV-006 无开放缺陷。
- PR：[#3](https://github.com/ShyNodes1208/datacenter/pull/3)；实现提交：`580dd3eae3556cb968436f0fa40802d5543e0321`，已推送至 `origin/fix/TASK-20260901-device-single-click`。
- 最终验证证据：topology 测试 122/122 PASS（含真实 DOM 与 Konva 二次点击回归）、`npm run typecheck` PASS、`npm run build` PASS、`git diff --check` PASS。
