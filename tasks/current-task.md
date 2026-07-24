# Current Task

- Current Task：FR-005（服务器移动）+ FR-006（服务器下架）
- Status：IMPLEMENTED & VERIFIED
- Branch：feature/task-0021-device-positions
- Backend：165 tests PASS
- Frontend：71 tests PASS, typecheck clean

## 本日进度总览

| FR | 内容 | 状态 |
|---|---|---|
| 设备落位图 | DevicePosition + UHeight + 合并单元格 | 已实现 |
| FR-003 | 服务器 CRUD | 已实现 |
| FR-004 | 服务器上架 + 审计记录 | 已实现 |
| FR-005 | 服务器移动 | 已实现 |
| FR-006 | 服务器下架 | 已实现 |
| NFR-005 | AuditRecord 模型 + 审计写入 | 已实现 |
| TASK-0026 | 修复多U服务器显示（名称每行显示，按钮仅顶部） | 已修复 |
| TASK-0027 | 手动上架服务器合并单元格+蓝色横条 | 已修复 |

## Bug 修复

- 前后端 U 位方向统一：前端 `endU = startU + height - 1`（向上延伸，与后端一致）
- 服务器显示匹配：从 `serverAtU`（精确 topU 匹配）改为 `groupServerMap`（U 范围重叠匹配）
- 多 U 服务器合并单元格：`mergedPositions` 将连续同 serverId 的空 U 位合并为蓝色 block

## 下一步

- 手动测试上架→移动→下架完整流程
- 继续 FR-010（操作记录查看页面）
