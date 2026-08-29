# Current Task

- Status：READY_FOR_REVIEW（2026-08-29 21:17:25 +08:00；TASK-20260829-device-topology-semantic-rendering）
- Branch：fix/TASK-20260829-device-topology-semantic-rendering
- Owner：Cursor Developer；Reviewer：Codex Reviewer
- Requirement：设备级拓扑在 2,850 台设备数据下保持可操作响应。
- Spec：`tasks/TASK-20260829-device-topology-semantic-rendering.md`

## 当前任务

| 任务 | 分支 | 状态 |
|------|------|------|
| TASK-000001: Room.Location + Rack.Status | main ✅ | 已完成并合并 |
| TASK-000002: 前端适配新字段 | main ✅ | 已完成并合并 |
| TASK-20260810-000003: 拓扑地图（CR-001 设备级） | feature/TASK-20260810-000003-topology-map | COMPLETED |
| TASK-20260812-070929: CR-002 修复（筛选+标签+截图） | feature/TASK-20260810-000003-topology-map | COMPLETED（已提交 2f20f8a） |
| TASK-20260812-120000: 2.5D 拓扑全链路实现 | feature/TASK-20260810-000003-topology-map | COMPLETED（2026-08-12 Codex PASS，已推送；锁已释放） |
| TASK-20260813-085046: 机房/机柜点击修复 | feature/TASK-20260810-000003-topology-map | COMPLETED（Codex PASS，875dc11 已推送；锁已释放） |
| TASK-20260813-133241: 设备级拓扑 UI 优化 | feature/TASK-20260813-133241-device-ui | COMPLETED（Codex PASS 复审 2 轮；待合并回 topology-map 分支） |
| TASK-20260813-153018: 1U 设备名称重叠修复 | feature/TASK-20260813-133241-device-ui | COMPLETED（Codex PASS 复审 2 轮） |
| TASK-20260814-101757: 设备级拓扑可读性修复（自适应布局+语义缩放+视口保持） | feature/TASK-20260810-000003-topology-map | COMPLETED（Codex PASS 2 轮；4f6f716 已推送；锁已释放） |
| TASK-20260814-120641: 设备级机柜间线路束聚合 | feature/TASK-20260810-000003-topology-map | COMPLETED（Codex PASS 1 轮；2990677 已推送；锁已释放） |
| TASK-20260814-140520: 走廊路由+机柜点击优先+聚焦聚合 | feature/TASK-20260810-000003-topology-map | COMPLETED（Codex PASS 第 5 轮；6128697 已推送；锁已释放） |

## 当前状态

- 当前任务：`TASK-20260829-device-topology-semantic-rendering` — 设备级拓扑分级渲染性能修复。
- 状态：`READY_FOR_REVIEW`；Owner：Cursor Developer；独立 Reviewer：Codex Reviewer；产品/技术统筹：Codex + Terra。
- 范围：空闲视图只显示机柜概览；聚焦机柜后才绘制该机柜设备；缓存布局、消除重复完整重绘，并将**设备级**线缆替换为单 Canvas（用户 2026-08-29 “确认方案”，CR-20260829-001 APPROVED）。
- 不做：不修改 API、数据库、数据模型、线缆业务规则、依赖或其他页面；房间/机柜视图继续使用共享 SVG `CableLayer`。
- 当前任务规格：`tasks/TASK-20260829-device-topology-semantic-rendering.md`。
- 验收命令：前端 test、typecheck、build、`git diff --check`；以北京 2,850 设备数据记录 Playwright 进入与点击响应测量。
- Owner 交接：北京 2,850 设备实测进入 483.1 ms、机柜点击 14.5 ms、设备点击 120.4 ms，均通过目标；设备 Canvas 1、SVG bundle 0；前端 234/234、typecheck、build、diff check 全部通过。三个实施锁已 `HANDED_OFF`，等待 Codex Reviewer 独立审核；未推送、不得标记 `COMPLETED`。

## 数据概览

- 17 机房、33 机柜、395+ 服务器、800+ 线缆（含种子脚本新增验收数据）
- 管理员：admin / admin123
