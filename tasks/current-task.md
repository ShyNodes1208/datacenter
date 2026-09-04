# Current Task

- Status：REVIEW PASS → READY_FOR_USER_COMMIT（2026-09-04；TASK-20260904-room-force-delete）
- Branch：`fix/TASK-20260901-floorplan-path-centered-display`
- Owner：Cursor Developer；Reviewer：Codex Reviewer（PASS）；Orchestrator：Terra
- Requirement：机房强制删除
- Spec：`tasks/TASK-20260904-room-force-delete.md`
- Review：`.ai/REVIEW.md`

---

## 历史：TASK-20260828-device-topology-performance（COMPLETED）

- Status：COMPLETED（2026-08-29）
- Branch：fix/TASK-20260828-device-topology-performance
- Owner：Cursor Developer；Reviewer：Codex Reviewer
- Requirement：设备级拓扑在大规模设备数据下保持可操作响应。
- Spec：`tasks/TASK-20260828-device-topology-performance.md`

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

- 当前任务：`TASK-20260828-device-topology-performance` — 设备级拓扑性能修复。
- 状态：`COMPLETED`；Owner：Cursor Developer；独立 Reviewer：Codex Reviewer；产品/技术统筹：Codex + Terra。
- 范围：设备级拓扑使用 rack Map、低语义缩放减少设备细节绘制、HTML hit targets 仅按筛选后的可见设备生成；保留点击/聚焦/二次详情行为。
- 不做：不修改 API、数据库、数据模型、线缆业务规则、依赖或其他页面。
- 当前任务规格：`tasks/TASK-20260828-device-topology-performance.md`。
- 验收命令：前端 test、typecheck、build、`git diff --check`。
- 最终证据：独立 Reviewer 在本地 Vite 服务可访问的环境中复验：vitest 224/224 PASS、typecheck PASS、build PASS、`git diff --check` PASS；未修改数据库/API/依赖。实现提交 `198708f` 已包含于合并提交 `3af4702`，后者已推送至 `origin/feature/TASK-20260810-000003-topology-map`。

## 数据概览

- 17 机房、33 机柜、395+ 服务器、800+ 线缆（含种子脚本新增验收数据）
- 管理员：admin / admin123
