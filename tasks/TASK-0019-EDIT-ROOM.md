# TASK-0019：机房管理员编辑机房名称和状态

## 任务信息

- Status：READY_FOR_REVIEW
- Implementation Started：YES
- Blocker：无
- Task Owner：Cursor Frontend
- Backend Owner：Codex Backend
- Frontend Owner：Cursor Frontend
- Reviewer：Codex Reviewer
- Requirement Source：用户 2026-07-23 书面批准的本任务范围；`docs/product/MVP-PRODUCT-BASELINE.md` FR-001、BR-027、NFR-007
- Architecture Reference：`docs/architecture/AGENT-WORKFLOW.md`；现有 Room、Controller、Cookie 认证与首页基线
- Dependency：TASK-0009、TASK-0018（均已 COMPLETED 并进入 main）
- Active Product Locks：4（后端 2 + 前端 2，全部 HANDED_OFF）

## 目标与最小范围

机房管理员在首页将任一机房行切换为编辑状态，修改已预填的名称和状态并保存；保存成功后重新请求列表并显示服务器最终结果。其他三个角色保持只读。仅复用现有页面、Controller、授权、Room 模型与 DbContext，不修改数据库结构、认证基础设施或依赖。

## API 契约

- `GET /api/rooms` 返回仅含 `id`、`name`、`status` 的数组；`id` 仅用于稳定定位且页面不显示，现有 `name/status` 语义不变。
- 新增 `PUT /api/rooms/{id}`，请求 `{ "name": "新名称", "status": "停用" }`；成功返回 HTTP 200 及 `{ "id": "guid", "name": "新名称", "status": "停用" }`。
- 机房管理员允许；运维人员、DBA/应用运维人员、只读查看人员返回 403；匿名返回 401。复用现有授权方式，优先端点级角色授权；401/403 响应体保持现状。
- `name` Trim 后不得为空并保存 Trim 值；继续全局唯一，重复检查排除当前 Room。`status` 仅允许“启用”或“停用”。
- 空或空白名称：400 `机房名称不能为空`；非法状态：400 `状态值无效`；不存在：404 `机房不存在`；与其他机房重名：409 `机房名称已存在`；保持自身原名称允许成功。
- 保存前排除自身检查重复；保存时只把可确定为 `Rooms.Name` 唯一约束的竞争冲突转换为 409，其他数据库异常不得伪装为重名。

## 前端交互

- 普通行：机房名称、状态、编辑；编辑行：预填的名称输入框、状态选择、保存、取消。
- 仅机房管理员显示编辑按钮；同一时间只编辑一行，点击另一行直接切换并放弃未保存输入。
- 保存期间按钮 disabled；失败时保留当前编辑行、输入并在行附近显示错误；成功时退出编辑并重新 `GET /api/rooms`，不得以手工修改本地数组作为最终结果。
- 取消不发送 PUT；页面不显示 id。
- 新增表单打开时不显示编辑按钮；编辑时不显示新增入口；不增加确认弹窗。

## 精确产品文件范围

后端仅允许修改：

1. `src/backend/Datacenter.Api/Controllers/RoomsController.cs`
2. `tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs`

前端仅允许修改：

3. `src/frontend/src/views/HomeView.vue`
4. `src/frontend/src/__tests__/router-and-views.test.ts`

只读核验、默认不修改：`useApi.ts`、`useAuth.ts`、`router.ts`、`Room.cs`、`AppDbContext.cs`、`Program.cs`。不创建新产品文件；只有 Controller 内出现直接重复时才允许最小整理，不强制提取私有校验方法。

## 验收标准（10 条）

1. 管理员看到编辑入口，三个非管理员角色看不到。
2. GET 返回 id/name/status，页面不显示 id。
3. 管理员点击编辑后，当前名称和状态正确预填。
4. PUT 路径使用正确 Guid id，请求包含 name/status。
5. 管理员可以修改名称，也可以只改变状态。
6. 保存成功后再次 GET，页面显示服务器最终结果。
7. 空或空白名称返回 400。
8. 非法状态返回 400；重复其他机房名称返回 409；保留自身名称不误判。
9. 不存在 id 返回 404。
10. 三个非管理员角色返回 403，匿名返回 401。

## 测试要求

### 后端（已实施，52/52 PASS）
- GET 三个字段、管理员完整更新、空名称 400、重复名称 409、不存在 id 404、三个非管理员参数化 403、匿名 401，并保持原 GET/POST 测试通过。
- **PM 范围裁决（2026-07-23）**：仅名称、仅状态、Trim、空白名称、非法状态、保持自身名称等场景的校验逻辑与 POST 完全相同，已在 POST 测试中充分覆盖。PUT 不重复编写同逻辑测试。此裁决为本文件正式组成部分。

### 前端（已实施，65/65 PASS）
- 复用现有 Vue SSR `renderToString`：覆盖管理员入口、三个非管理员隐藏、真实模板预填、正确 id 的 PUT、name/status 请求体、保存后再次 GET 与最终模板结果、重复错误保留状态和输入、保存 disabled、取消、新增/编辑互斥、编辑保存防重复 PUT，并保持原新增、列表、登录、退出测试通过。
- 不新增 jsdom、happy-dom、`@vue/test-utils` 或其他依赖。

## 明确不做

删除、批量编辑、独立管理页、编辑历史、审计、审批、乐观锁、RowVersion、Migration、新 Room 字段、机柜、服务器、U 位、搜索、排序、筛选、分页、Service、Repository、新依赖、新组件、未来功能预留。

## 实施与交接

- Workflow：`IDLE → DRAFT → READY → IN_PROGRESS → READY_FOR_REVIEW`
- Backend Handoff：2026-07-23 10:43:02 +08:00，两个后端锁 `CLAIMED → HANDED_OFF`；`dotnet test` 52/52 PASS。
- Frontend Handoff：2026-07-23，两个前端锁 `CLAIMED → HANDED_OFF`；`npx vitest run` 65/65 PASS；含 Reviewer 首次审核后新增的 2 个互斥/防重测试。
- 下一角色：Codex Reviewer。
- 下一动作：独立审核，审核通过后合入 main。
- 验证命令：`dotnet test`、`npx vitest run`、`pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`、`git diff --check`。
