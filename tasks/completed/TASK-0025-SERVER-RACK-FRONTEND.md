# TASK-0025：服务器上架（前端）

## 目标

在 RackDeviceView（/racks/:id）上增加服务器上架交互。

## API 契约

### GET /api/racks/{id}/availability
返回每 U 位占用：`{ positions: [{ uNumber, occupied, serverName?, serverId? }] }`

### POST /api/servers/{id}/rack
Body: `{ rackId, startU }` → 201 + `{ serverPositionId, serverName, rackCode, startU, endU }`

### GET /api/servers（已有）
用于获取可上架服务器列表（positionStatus = 未上架 或 已下架）

## 改造 RackDeviceView

在现有 U 位视图上增加：

1. **上架按钮**（仅修改权限角色可见）：U 位视图上方或右侧新增「上架服务器」按钮
2. **上架对话框/面板**（点击按钮后显示）：
   - 服务器选择下拉：列出所有 未上架/已下架 的服务器（调 GET /api/servers?positionStatus=未上架&positionStatus=已下架）
   - 显示已选服务器的设备高度（如 "2U"）
   - 起始 U 位输入
   - 自动显示占用的 U 位范围（如 "U10-U11"）
   - 校验提示（超出范围、已被占用）
   - 确认/取消按钮
3. **上架后**：刷新 U 位视图，占用 U 位显示服务器名

## 交互细节

- 选择服务器后，自动显示其 DeviceHeight
- 输入 startU 后，实时计算 endU 并显示范围
- 点击确认时校验 + CSRF + POST
- 成功：关闭面板 + 刷新视图
- 失败：显示错误信息

## 文件

修改：src/frontend/src/views/RackDeviceView.vue

## 验收

1. 管理员/运维人员可见上架按钮，只读角色不可见
2. 服务器列表正确筛选（只显示未上架/已下架）
3. U 位范围自动计算正确
4. 冲突/超范围错误提示明确
5. 上架成功后 U 位视图更新
6. npm run typecheck + test + build 通过
