# Current Task

- Status：开发中（2026-08-10）
- Branch：feature/TASK-20260810-000003-topology-map
- Backend：218 tests PASS
- Frontend：107 tests PASS, typecheck clean

## 今日完成

| 任务 | 分支 | 状态 |
|------|------|------|
| TASK-000001: Room.Location + Rack.Status | main ✅ | 已完成并合并 |
| TASK-000002: 前端适配新字段 | main ✅ | 已完成并合并 |
| TASK-000003: 拓扑地图 | feature/TASK-20260810-000003-topology-map | 进行中 |

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

## 明天待办

1. 验证拓扑地图页面交互（拖拽保存、hover tooltip、双击展开机柜级）
2. 决定是否合并 feature 分支到 main
3. 机柜编辑 UI（启用/停用）或后续需求
