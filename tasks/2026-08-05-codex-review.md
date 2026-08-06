# Codex Review: Network Path Feature (Task 1-4)

## 概况

网络连接路径功能全部 4 个 Task 已完成，等待 Codex 审核。

## 改动的文件（5 个）

### 新增文件
1. `src/backend/Datacenter.Api/Controllers/NetworkPathController.cs` — BFS 路径计算端点
2. `src/frontend/src/components/NetworkPathDrawer.vue` — 路径查询抽屉组件

### 修改文件
3. `src/frontend/src/components/FloorplanCanvas.vue` — +高亮 prop 和渲染逻辑
4. `src/frontend/src/views/FloorplanView.vue` — +查询按钮、搜索函数、高亮集成
5. `src/frontend/src/views/RackDeviceView.vue` — +查询按钮、搜索函数、抽屉集成

## 审核重点

### 后端 (NetworkPathController.cs)
- BFS 算法正确性：中间节点只走网络设备、10 跳上限、cableId 确定性排序
- 边界条件：同设备 400、设备不存在 404、无路径正常返回
- 性能：全量加载 Port/Cable 到内存 + AsNoTracking
- 安全性：[Authorize] 认证、无防伪令牌（只读 GET 合理）

### 前端 (NetworkPathDrawer.vue)
- 全状态覆盖：设备选择/loading/error/无路径/有路径
- 设备下拉互斥（sourceOptions vs targetOptions)
- CABLE_COLORS 复用
- 设备名点击跳转、线缆类型色块

### 前端 (FloorplanCanvas.vue)
- highlightedRackIds 高亮逻辑是否正确插入到 renderRacks/drawCables
- watch 触发重绘是否合理
- 空数组/undefined 时不影响现有渲染

### 前端集成 (FloorplanView.vue, RackDeviceView.vue)
- rackCode→rackId 映射逻辑
- 关闭抽屉清空高亮
- 搜索前清空旧高亮
- 去重逻辑 (ids.includes)

## 验证方式

### 后端
```bash
cd src/backend/Datacenter.Api
dotnet build   # 应 0 Error 0 Warning
```

### 前端
```bash
cd src/frontend
npx vue-tsc --noEmit   # 类型检查应通过
npx vite build --logLevel error  # 构建应通过
```

### 手动测试
1. 启动后端 + 前端
2. 登录 admin/admin123
3. RackDeviceView: 工具栏"连接路径查询"按钮 → 选两台设备 → 查询
4. FloorplanView: 同上 → 查询成功后平面图机柜红色高亮

## 改动内容

未提交，可在 git 中查看 diff:
```bash
git diff src/frontend/src/components/FloorplanCanvas.vue
git diff src/frontend/src/views/FloorplanView.vue
git diff src/frontend/src/views/RackDeviceView.vue
git diff --stat  # 新文件
```
