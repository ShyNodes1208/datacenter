# Current Task

- Status：READY_FOR_REVIEW（2026-08-28；TASK-20260828-134500 验收种子机柜数量调整）
- Branch：feature/TASK-20260828-134500-rack-seed-counts
- Owner：Cursor Developer；Reviewer：Codex Reviewer
- Requirement：验收种子脚本配置上海 100、北京 150、广州 80 个机柜；本任务不执行脚本。
- Spec：`tasks/TASK-20260828-134500-ACCEPTANCE-SEED-RACK-COUNTS.md`

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

- 当前任务：`TASK-20260828-134500` — 验收种子机柜数量调整。
- 状态：`READY_FOR_REVIEW`；Owner：Cursor Developer；独立 Reviewer：Codex Reviewer；产品/技术统筹：Codex + Terra。
- 范围：仅修改种子脚本与无数据库单元测试，配置上海 100、北京 150、广州 80 个机柜并同步汇总校验。
- 不做：不运行种子脚本；不修改数据库、API、迁移、设备、线缆、依赖或页面。
- 当前任务规格：`tasks/TASK-20260828-134500-ACCEPTANCE-SEED-RACK-COUNTS.md`。
- 验收命令：`python3 -m unittest scripts/test_seed_acceptance_data.py -v`、`python3 -m py_compile scripts/seed-acceptance-data.py scripts/test_seed_acceptance_data.py`、`git diff --check`；种子脚本不在验收中执行。

## 数据概览

- 17 机房、33 机柜、395+ 服务器、800+ 线缆（含种子脚本新增验收数据）
- 管理员：admin / admin123
