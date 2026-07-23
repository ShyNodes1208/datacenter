# TASK-0018：机房管理员新增机房

## 用户目标

机房管理员登录后，可以在首页登记一个机房，保存后立即在当前机房列表中看到它。

Requirement Source：项目负责人 2026-07-22 书面批准的“新增机房”范围；`docs/product/MVP-PRODUCT-BASELINE.md` FR-001；`docs/architecture/MVP-ARCHITECTURE-BASELINE.md` 机房资源边界；`docs/architecture/AGENT-WORKFLOW.md`。

## 当前范围

- 首页为机房管理员提供小型内联新增表单：名称、状态（默认“启用”）、保存按钮。
- 保存时按钮禁用；成功后清空并收起表单，重新 `GET /api/rooms` 并显示新机房。
- 重复名称或输入错误时保持表单展开并显示后端错误。
- 新增 `POST /api/rooms`，完成输入校验、角色授权、保存及唯一名称冲突处理。
- 保留现有用户名、角色、登出、认证、路由和只读列表行为。

## 明确不做

编辑、删除、详情、独立机房管理页面、弹窗组件、搜索、排序、筛选、分页、Excel、批量导入、审批、审计、机柜、服务器、U 位、拓扑、Repository、Service、新 UI 框架、新状态管理库、新表单库、新 Migration及未来功能预留。

## 角色

- Task Owner：Codex Architect
- Backend Owner：Codex Backend
- Frontend Owner：Cursor Frontend
- Reviewer：Codex Reviewer

## 文件范围

后端仅允许：

- `src/backend/Datacenter.Api/Controllers/RoomsController.cs`
- `tests/backend/Datacenter.Api.Tests/IntegrationTests/RoomIntegrationTests.cs`

前端仅允许：

- `src/frontend/src/views/HomeView.vue`
- `src/frontend/src/__tests__/router-and-views.test.ts`

现有 `useApi.request()` 已支持读取 CSRF 响应头并通过 `csrfToken` 选项发送携带 `X-XSRF-TOKEN` 的 POST；`HomeView.vue` 可先请求 `/api/auth/csrf` 再提交。因此不得修改 `useApi.ts`、`useAuth.ts` 或 `router.ts`。

## API 契约

- 端点：`POST /api/rooms`
- 请求：`{"name":"主机房","status":"启用"}`
- `name` 保存前执行 Trim，不得为空或全为空白；继续由现有数据库唯一索引保护；不增加长度限制。
- `status` 仅允许“启用”或“停用”；不增加其他字段。
- 成功：`201`，保存一条 Room，响应至少包含 `name`、`status`。
- 空名称：`400`，`{"error":"机房名称不能为空"}`。
- 非法状态：`400`，`{"error":"状态值无效"}`。
- 重复名称：`409`，`{"error":"机房名称已存在"}`。
- 重复名称同时处理正常预检查与数据库唯一约束竞争条件；数据库异常中只将 Name 唯一冲突转换为 `409`，其他异常不得伪装为重复名称。
- 未登录：`401`；无角色权限：`403`。

## 权限

- 机房管理员：允许。
- 运维人员、DBA/应用运维人员、只读查看人员：`403`。
- 未登录：`401`。
- 仅机房管理员显示“新增机房”入口，其他三个角色完全不显示。

## 验收标准

1. 机房管理员首页显示新增入口，其他三个角色不显示。
2. 机房管理员提交合法 name/status，返回 201。
3. 保存成功后数据库存在且只新增一条正确记录。
4. 前端保存成功后重新加载列表，并显示新机房。
5. 空或空白名称返回 400，并显示“机房名称不能为空”。
6. 非法 status 返回 400，并显示“状态值无效”。
7. 重复名称返回 409，数据库仍只有一条同名记录。
8. 未登录返回 401，非机房管理员返回 403。

## 测试要求

- 后端：管理员创建成功；空名称；空白名称；非法状态；重复名称；三种非管理员角色参数化 `403`；匿名 `401`；原有 GET 测试继续通过。
- 前端：管理员显示新增入口；其他角色不显示；保存成功后再次请求列表；成功后清空并收起；重复名称显示错误；空名称错误；提交中按钮禁用；原有只读列表和认证测试继续通过。
- 提交前：`git diff --check`；`pwsh -NoLogo -NoProfile -File ./scripts/validate-agent-workflow.ps1`，期望 `PASS=20`、`FAIL=0`、`TOTAL=20`。

## 状态

- Status：COMPLETED
- Implementation Started：YES
- Active Product Locks：0
- Blocker：无
- Branch：`feature/task-0018-create-room`

状态迁移：前序当前任务 `TASK-0009 COMPLETED → IDLE`；本任务 `IDLE → DRAFT → READY → IN_PROGRESS → READY_FOR_REVIEW → COMPLETED`。产品基线、角色、范围、API、验收标准和验证命令齐备；Owner 与 Reviewer 独立。Backend 2 项与 Frontend 2 项产品锁均已按 `CLAIMED → HANDED_OFF → RELEASED` 关闭。

## 下一动作

合入 `main`。

## 状态迁移记录

- 2026-07-22 22:24:12 +08:00：Codex Backend 确认目标路径无活跃父子冲突，认领 2 项后端产品锁；TASK-0018 `READY → IN_PROGRESS`，Implementation Started `NO → YES`。证据：`tasks/MODULE-LOCKS.md` 中 TASK-0018 两项 `CLAIMED` 记录。
- 2026-07-22 22:46:16 +08:00：Cursor Frontend 确认目标路径无活跃父子冲突，认领 2 项前端产品锁；在 `HomeView.vue` 实现管理员内联新增表单（CSRF + POST `/api/rooms` + 成功后重新 GET），并补充 `router-and-views.test.ts`；`npm test` / `typecheck` / `build` 与 workflow 验证通过。Active Product Locks `2 → 4`。TASK-0018 保持 `IN_PROGRESS`。
- 2026-07-23 08:00:40 +08:00：记录已完成的最终审核闭环；TASK-0018 `IN_PROGRESS → READY_FOR_REVIEW → COMPLETED`。Backend 2 项与 Frontend 2 项产品锁均 `CLAIMED → HANDED_OFF → RELEASED`，最终活跃产品锁 0。

## 审核与完成字段

- Final Product Review：AC-01～AC-08 全部 PASS。
- Initial Final Review：`TASK_0018_FINAL_CODE_REVIEW_NEEDS_CHANGES`。
- Finding：`T18-RV-001`；修复提交 `da8670266a3ecfd253d445c08cc8ced53f2d40aa`；复审 `TASK_0018_T18_RV_001_REVIEW_PASS`；最终状态 `FIXED`。
- 最终审核结论：PASS；BLOCKER 0 / MAJOR 0 / MINOR 0。
- 最终验证：后端 build PASS（0 warnings / 0 errors）、后端 test 44/44 PASS；前端 test 58/58 PASS、typecheck PASS、frontend build PASS；Workflow 20/20 PASS；`git diff --check` PASS。
- 范围外开发：无。
- Change Request：N/A：未发生范围变更。
- 已知限制：无。
- 最终结果：机房管理员可在首页新增机房，保存后重新加载并显示在机房列表中。
