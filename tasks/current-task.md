# Current Task

- Status：READY_FOR_REVIEW（2026-08-27；TASK-20260827-172017 设备详情显示已连接设备的位置；`pwsh` 校验已批准 N/A）
- Branch：feature/TASK-20260810-000003-topology-map
- Backend Owner：Codex Backend；Frontend Owner：Cursor Frontend；Reviewer：Codex Reviewer
- Requirement：设备详情中显示对端设备、端口、机柜、U 位；对端未上架时显示“未上架”。
- Spec：`tasks/TASK-20260827-172017-DEVICE-CONNECTION-LOCATION.md`

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

- 当前任务：`TASK-20260827-172017` — 设备详情显示已连接设备的位置。
- 状态：`READY_FOR_REVIEW`；后端 Owner：Codex Backend；前端 Owner：Cursor Frontend；独立 Reviewer：Codex Reviewer；产品/技术统筹：Codex + Terra。
- 阶段证据：本轮后端 `ServerIntegrationTests` 44/44 通过；前端 221/221、typecheck、build、`git diff --check` 通过；四条阶段 A/B 锁已 `HANDED_OFF`。
- 工作流校验：用户于 2026-08-27 明确选择不安装 `pwsh`，已批准该脚本为本任务 N/A；未变更系统依赖。剩余门禁为用户提交与推送。
- 范围：扩展既有端口查询返回对端 U 位，并在现有设备详情页显示对端设备、端口、机柜和 U 位；未上架显示“未上架”。
- 当前任务规格：`.ai/TASK.md` 与 `tasks/TASK-20260827-172017-DEVICE-CONNECTION-LOCATION.md`。
- 不做：数据库、迁移、新端点、拓扑、线缆写操作、依赖或新页面。

## 数据概览

- 17 机房、33 机柜、395+ 服务器、800+ 线缆（含种子脚本新增验收数据）
- 管理员：admin / admin123
