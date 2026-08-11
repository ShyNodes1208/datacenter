# Current Task

- Status：COMPLETED（2026-08-11，CR-001 设备级拓扑已实现并审核）
- Branch：feature/TASK-20260810-000003-topology-map
- Backend：220 tests PASS
- Frontend：117 tests PASS, typecheck clean

## 当前任务

| 任务 | 分支 | 状态 |
|------|------|------|
| TASK-000001: Room.Location + Rack.Status | main ✅ | 已完成并合并 |
| TASK-000002: 前端适配新字段 | main ✅ | 已完成并合并 |
| TASK-20260810-000003: 拓扑地图（含 CR-001 设备级） | feature/TASK-20260810-000003-topology-map | COMPLETED |

## CR-001：设备级拓扑

详见 [tasks/TASK-20260810-000003-CR-001-DEVICE-TOPOLOGY.md](TASK-20260810-000003-CR-001-DEVICE-TOPOLOGY.md)

**当前状态**：READY，可以派发 Cursor 实施。

## 今日完成（2026-08-10）

| 时间 | 内容 |
|------|------|
| 15:24 | .ai/ 加入 gitignore，更新 floorplan 测试断言 |
| 16:06 | Room.Location + Rack.Status 字段与验证 |
| 16:31 | TASK-000001 完成，释放模块锁 |
| 16:50 | 前端适配 Room.Location 和 Rack.Status |
| 16:52 | .playwright-cli/ 加入 gitignore |
| 17:42 | 线缆种子脚本，TASK-000002 完成 |
| 19:46 | 机房拓扑地图 — 跨机房线缆可视化 |
| 19:58 | Canvas 扩大 + 布局网格优化 |
| 20:04 | Canvas 自动扩展防裁剪 |
| 20:57 | 全拓扑种子（12机房 + 412线缆） |
| 21:34 | current-task.md 更新 |

## 今日完成（2026-08-11）

| 时间 | 内容 |
|------|------|
| — | 读取 DEVICE-TOPOLOGY-VISUAL-SPEC.md |
| — | 产品裁决：批准设备级拓扑作为 CR-001 |
| — | 写入产品基线附录 A |
| — | 创建正式任务文件 |

## 明天待办

1. Architect 确认 CR-001 技术影响
2. 更新 MODULE-LOCKS.md（如文件清单有变化）
3. 任务进入 READY 后，调用 Cursor 实施
4. Codex Reviewer 独立审核

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
