# Current Task

- Status：IN_PROGRESS（2026-08-12，CR-002 修复轮次）
- Branch：feature/TASK-20260810-000003-topology-map
- Backend：220 tests PASS
- Frontend：待修复后验证

## 当前任务

| 任务 | 分支 | 状态 |
|------|------|------|
| TASK-000001: Room.Location + Rack.Status | main ✅ | 已完成并合并 |
| TASK-000002: 前端适配新字段 | main ✅ | 已完成并合并 |
| TASK-20260810-000003: 拓扑地图（CR-001 设备级） | feature/TASK-20260810-000003-topology-map | COMPLETED |
| TASK-20260812-070929: CR-002 修复（筛选+标签+截图） | feature/TASK-20260810-000003-topology-map | IN_PROGRESS |

## CR-002 修复（TASK-20260812-070929）

详见 `.ai/TASK.md`

Codex Review 原 TASK-20260810-000003 CR-002 发现 5 个问题（REVIEW_ROUND 3/3 → BLOCKED）。
创建新 Task ID 重置 review round 为 0/3，修复 3 个代码/证据问题。

## 今日完成（2026-08-12）

| 时间 | 内容 |
|------|------|
| — | TASK-20260812-070929 创建，重置 review round |
| — | FIX-4: scripts/codex-review sandbox flag 独立提交 |

## 数据概览

- 12 机房、21 机柜、344 服务器、21 交换机、412 线缆
- 管理员：admin / admin123

## 启动命令

```bash
# 后端（需在 WSL 中）
export PATH="$HOME/.dotnet:$PATH"
cd /home/shy/code/datacenter/src/backend/Datacenter.Api/
ASPNETCORE_ENVIRONMENT=Development \
dotnet run --urls http://localhost:5142 \
  --BootstrapAdmin:Username=admin \
  --BootstrapAdmin:Password=admin123 \
  --BootstrapAdmin:Role=机房管理员

# 前端
cd /home/shy/code/datacenter/src/frontend
npm run dev
```

## 页面入口

| 页面 | URL | 说明 |
|------|-----|------|
| 首页/机房列表 | http://localhost:5173/ | 统计+机房管理 |
| 拓扑地图 | http://localhost:5173/topology | 跨机房线缆可视化 |
| 线缆管理 | http://localhost:5173/cables | 412条线缆CRUD |
| 服务器管理 | http://localhost:5173/servers | 344台服务器 |
| 平面图 | 点击机房"平面图"按钮 | 2D机柜U位视图 |
