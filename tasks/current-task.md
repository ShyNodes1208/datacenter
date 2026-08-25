# Current Task

- Status：COMPLETED（2026-08-25；TASK-20260825-092201 设备级视口交互修复；最终治理记录已推送，本地/远端哈希已复核）
- Branch：feature/TASK-20260810-000003-topology-map
- Backend：220 tests PASS
- Frontend：195 tests PASS（vitest）

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

- 当前任务：`TASK-20260825-092201` — 设备级视口交互修复。
- 状态：`COMPLETED`；Owner：Cursor Frontend；独立 Reviewer：Codex Reviewer；产品/技术统筹：Codex + Terra。
- 范围：仅设备级拓扑的缩放、拖拽事件路径与相关前端测试；不改后端、API、数据库、种子数据或依赖。
- 当前任务规格：`.ai/TASK.md`。Cursor Frontend 已完成实现，Codex Reviewer 独立 PASS；两条允许路径已在 `tasks/MODULE-LOCKS.md` 释放。
- 提交与推送：实现提交 `53ea43e`、独立文档提交 `f0b16b1` 与最终治理记录均已推送；工作区干净，本地/远端哈希一致。
- 最终完成条件：全部满足——独立 Reviewer PASS、测试/类型检查/构建通过、模块锁已释放、提交已推送、工作区干净且本地/远端哈希一致。

## 数据概览

- 17 机房、33 机柜、395+ 服务器、800+ 线缆（含种子脚本新增验收数据）
- 管理员：admin / admin123
