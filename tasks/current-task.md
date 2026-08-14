# Current Task

- Status：IDLE（2026-08-14，TASK-20260814-101757 COMPLETED，4f6f716 已推送）
- Branch：feature/TASK-20260813-133241-device-ui
- Backend：220 tests PASS
- Frontend：185 tests PASS（vitest）

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

## TASK-20260813-085046 机房/机柜点击修复

详见 `.ai/TASK.md`。两个根因（Playwright 浏览器证据）：

1. drawRoomPlatform 全部子图形 `listening: false` → 机房 Group 零命中区域 → 点击永不触发
2. click 处理器触发场景重建（直接 drawScene 或经 router→syncFromRoute→load）→ 销毁节点 → Konva dblclick 无法凑齐两次同节点点击

修复：透明命中矩形 + 定向选中高亮 + syncFromRoute rooms 模式守卫。
浏览器验收（Claude 独立执行）：单击选中/tab 启用 ✓、首次双击机房进设备级 ✓、双击机柜进设备级 ✓、单击机柜不误触 ✓。vitest 153/153。

## 数据概览

- 17 机房、33 机柜、395+ 服务器、800+ 线缆（含种子脚本新增验收数据）
- 管理员：admin / admin123
