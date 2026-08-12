# Current Task

- Status：IN_FIX（2026-08-12，TASK-20260812-120000 Codex Review Round 3）
- Branch：feature/TASK-20260810-000003-topology-map
- Backend：220 tests PASS
- Frontend：147 tests PASS

## 当前任务

| 任务 | 分支 | 状态 |
|------|------|------|
| TASK-000001: Room.Location + Rack.Status | main ✅ | 已完成并合并 |
| TASK-000002: 前端适配新字段 | main ✅ | 已完成并合并 |
| TASK-20260810-000003: 拓扑地图（CR-001 设备级） | feature/TASK-20260810-000003-topology-map | COMPLETED |
| TASK-20260812-070929: CR-002 修复（筛选+标签+截图） | feature/TASK-20260810-000003-topology-map | COMPLETED（已提交 2f20f8a） |
| TASK-20260812-120000: 2.5D 拓扑全链路实现 | feature/TASK-20260810-000003-topology-map | IN_FIX（Codex Round 3/3） |

## TASK-20260812-120000 2.5D 拓扑

详见 `.ai/TASK.md`

Codex Review 进度：
- Round 1: CHANGES_REQUESTED（5 findings：迁移默认值、旧数据混合、地板方向、动画未实现、截图坐标）
- Round 2: CHANGES_REQUESTED（4 findings：种子脚本数据一致性、地板仍未水平、截图假阳性、测试范围）
- Round 3: 修复中（修复后等待 Codex 复审）

## 数据概览

- 17 机房、33 机柜、395+ 服务器、800+ 线缆（含种子脚本新增验收数据）
- 管理员：admin / admin123
- 上海机房 ID：64D083F6-CFFB-408E-AE45-5EA0E1914A51
- 数据库：src/backend/Datacenter.Api/.data/datacenter-dev.db

## 启动命令

```bash
# 后端
export PATH="$HOME/.dotnet:$PATH"
cd /home/shy/code/datacenter/src/backend/Datacenter.Api/
ASPNETCORE_ENVIRONMENT=Development dotnet run --urls http://localhost:5142 \
  --BootstrapAdmin:Username=admin --BootstrapAdmin:Password=admin123 --BootstrapAdmin:Role=机房管理员

# 前端
cd /home/shy/code/datacenter/src/frontend && npm run dev

# 种子数据（幂等）
python3 scripts/seed-acceptance-data.py

# 截图
npx tsx scripts/screenshot-topology.ts
```
