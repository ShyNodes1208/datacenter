# TASK-20260828-device-topology-performance

- Status：COMPLETED（2026-08-29；Codex Reviewer final PASS）
- Owner：Cursor Developer；Reviewer：Codex Reviewer
- Branch：fix/TASK-20260828-device-topology-performance

## Implementation handoff

- 变更：设备绘制使用 rack Map；低语义缩放跳过类型细节和状态灯但保留设备面板及点击监听；HTML hit targets 继续从 `filterVisibleDevices` 生成。
- 测试：新增性能结构测试覆盖 Map、低缩放细节门控、设备点击监听和过滤可见设备集合。
- 验证阻塞：`npm test` 报 `vitest: not found`；主工作区 binary 因隔离 worktree 无法解析 `vite`/`@vitejs/plugin-vue`。未安装依赖。

## 目标
设备数量增长后，设备级拓扑页面的点击、聚焦和缩放保持可操作响应。

## 已定位问题
- `drawDeviceScene()` 在聚焦、筛选和语义缩放变化时销毁并重建整层。
- 每台设备同时创建 Konva 面板及 HTML hit button；北京规模约 2,850 台时会产生数千交互节点。
- 绘制循环对每台设备执行 `snapshot.racks.find(...)`，形成设备数×机柜数的重复查找。

## 实施范围（Cursor Developer）
1. 为设备绘制建立机柜 Map，消除逐设备线性查找。
2. 降低低语义缩放级别的设备绘制成本：保留设备可点击/聚焦，但避免不必要的细节图形；保持放大后现有详情视觉。
3. HTML hit target 只为当前可见设备生成，避免重复生成不可见/无效节点；不得破坏设备点击、键盘访问和首次聚焦/第二次详情交互。
4. 为上述行为增加或更新前端测试；不得修改 API 契约或扩大范围。

## 验收标准
- 设备级页面加载并显示 1,900+ 台设备时，点击设备仍能完成聚焦；再次点击可进入详情页。
- 缩放、拖拽、筛选功能保持现有行为。
- 设备级 DOM hit target 数量与当前可见设备一致，不随隐藏设备数量增长。
- 现有前端 typecheck、build、test 全部通过。
- 提交说明包含性能原因、修改点和测试结果。

## 非目标
- 不重写 Konva/CableLayer 架构。
- 不修改后端 API、数据库模型或线缆业务规则。

## Final review

- 2026-08-29 Codex Reviewer 独立复验：在临时本地 Vite 服务可访问的环境中，`npm test` 为 224/224 PASS，`npm run typecheck`、`npm run build`、`git diff --check` 均 PASS。
- 实现范围仅为 `TopologyView.vue` 和 `topology.test.ts`；审核未发现 API、数据库、依赖、数据模型或线缆业务规则变更。
- 实现提交 `198708f` 已通过合并提交 `3af4702` 推送至 `origin/feature/TASK-20260810-000003-topology-map`；任务锁已释放。
