# TASK-0023：服务器基础信息 CRUD（前端）

## 目标

实现服务器列表页、详情页、新增/编辑表单页。

## API 契约（后端 TASK-0022 实现中）

### GET /api/servers
查询参数（可选）：name, ip, assetNumber, positionStatus, operationalStatus, system

返回：
```json
[{ "id", "name", "managementIP", "assetNumber", "deviceType", "deviceHeight",
   "operationalStatus", "positionStatus", "system", "owner", "notes" }]
```

### GET /api/servers/{id}
返回单条服务器完整信息。

### POST /api/servers（机房管理员/运维人员）
CSRF 必须。Body: { name, managementIP, assetNumber?, deviceType, deviceHeight, system?, owner?, notes? }

### PUT /api/servers/{id}（机房管理员/运维人员）
CSRF 必须。Body: 同 POST。不可修改 positionStatus。

## 页面

### ServerListView（/servers）
- 顶部：搜索栏（名称/IP/位置状态/运行状态）+ 搜索按钮 + 清空按钮
- 搜索栏下方：「新增服务器」按钮（仅修改权限角色可见）
- 表格：名称、IP、设备类型、设备高度、位置状态、运行状态、操作
- 操作列：查看（→ /servers/:id）
- 点击名称 → /servers/:id
- 空数据提示：「暂无服务器」
- 运行状态列标注「人工维护」

### ServerDetailView（/servers/:id）
- 面包屑：服务器列表 > 服务器名称
- 信息区：名称、管理IP、资产编号、设备类型、设备高度(U)、运行状态、位置状态
- 当前位置区：机房名、机柜编号、U位范围（位置状态=未上架时显示「未上架」）
- 运行状态标注「人工维护」
- 编辑按钮 → /servers/:id/edit
- 返回按钮 → /servers

### ServerFormView（/servers/new, /servers/:id/edit）
- 标题：「新增服务器」或「编辑服务器」
- 表单字段：名称(text)、管理IP(text)、资产编号(text, 选填)、设备类型(text)、设备高度(number, >=1)、所属系统(text, 选填)、负责人(text, 选填)、备注(textarea, 选填)
- 新增时运行状态默认「正常」、位置状态默认「未上架」
- 编辑时不可修改位置状态（字段只读）
- 校验：名称/IP/设备类型/设备高度 必填，设备高度>=1
- 提交 → API → 成功跳转 /servers/:id
- 错误提示明确
- 取消按钮 → 返回

## 路由

| 路径 | 组件 |
|---|---|
| /servers | ServerListView |
| /servers/new | ServerFormView |
| /servers/:id | ServerDetailView |
| /servers/:id/edit | ServerFormView |

## 文件

新增：views/ServerListView.vue, views/ServerDetailView.vue, views/ServerFormView.vue
修改：router.ts

## 验收

1. 所有页面需登录，匿名跳转 /login
2. 只读角色不显示「新增服务器」按钮和「编辑」按钮
3. 运行状态页面标注「人工维护」
4. 表单校验生效
5. 空数据、加载、错误状态正确处理
6. npm run typecheck 通过
7. npm test 全部通过
8. npm run build 成功
