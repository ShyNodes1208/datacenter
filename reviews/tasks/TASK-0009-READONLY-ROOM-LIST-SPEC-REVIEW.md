# TASK-0009 首页只读机房列表规格审核

## 审核信息

- Reviewer：Codex Reviewer
- 审核时间：2026-07-21 23:19:43 +08:00（Asia/Shanghai）
- 审核类型：独立规格审核
- 当前分支：`feature/task-0009-readonly-room-list`
- 审核基线 HEAD：`d02399376ba37bf674e157ac3817532eb1f4d3c1`
- main 基线：`df4f601245098441a28f8a5ccdfddd92235fefeb`
- 任务状态：`DRAFT`
- Owner：Codex Architect
- Reviewer：Codex Reviewer
- 最终结论：`PASS`

## Git 前置门禁

PASS。已执行 `git fetch origin --prune`；当前分支正确；审核开始时本地 HEAD 与 `origin/feature/task-0009-readonly-room-list` 均为 `d02399376ba37bf674e157ac3817532eb1f4d3c1`；`origin/main` 为 `df4f601245098441a28f8a5ccdfddd92235fefeb`；工作区干净；暂存区为空。

相对 main 仅修改 `tasks/TASK-0009-READONLY-ROOM-LIST.md`、`tasks/current-task.md`、`tasks/MODULE-LOCKS.md`。`src/`、`tests/`、Migration、依赖和实施代码均无变化；`git diff --check origin/main...HEAD` 通过。

## 审核依据

完整读取：`AGENTS.md`、`docs/architecture/AGENT-WORKFLOW.md`、`docs/product/MVP-PRODUCT-BASELINE.md`、`tasks/TASK-TEMPLATE.md`、`tasks/current-task.md`、`tasks/MODULE-LOCKS.md`、TASK-0009 规格和 TASK-0008 规格。

只读检查：现有 `AppDbContext.cs`、`AuthController.cs`、`Program.cs`、`HomeView.vue`、`useApi.ts`、`router.ts`、`router-and-views.test.ts` 及后端测试项目中的现有源文件。未读取、比较、复制或参考归档分支 `archive/claude-room-management-unapproved-20260721`。

## 单一业务范围

PASS。规格只解决一个核心业务问题：所有已登录用户在现有首页 `/` 中只读查看全部机房的名称和状态。没有纳入创建、编辑、删除、详情页、独立 `/rooms` 路由、状态修改、搜索、排序、筛选、分页、菜单/导航、位置说明、备注、创建时间、机柜/服务器关联、统计、操作日志、生产种子数据、通用 CRUD、Repository、RoomService、新 composable、新依赖或未来功能预留。

## 验收标准

| AC | 审核结果 | 依据 |
|---|---|---|
| AC-01 | PASS | 所有已登录角色在现有首页用户信息和登出按钮下方看到只读列表 |
| AC-02 | PASS | 每条仅名称、状态，启用和停用均显示 |
| AC-03 | PASS | 空数据固定显示“暂无机房” |
| AC-04 | PASS | 失败显示错误且排除空态 |
| AC-05 | PASS | 沿用现有匿名访问路由守卫 |
| AC-06 | PASS | 排除项仅约束机房列表区域，不影响现有登出按钮 |

六条均可明确判断 PASS/FAIL。未把“加载中”文字设为强制 AC；未要求重写认证或路由守卫；未要求新增重复的“不触发 API 请求”守卫测试；AC 中不存在主观模糊词。

## API 与数据模型

PASS。唯一新端点为 `GET /api/rooms`：沿用现有 `[Authorize]` 默认策略，所有已登录角色可访问，无参数、无请求体，空数据为 `[]`，不定义顺序，不新增授权策略。成功响应元素仅含 `name`、`status`，明确排除 `id`、`createdAt`、`location`、`notes`，且不定义新的全局 500 格式。

Room 实体仅有 `Id`、`Name`、`Status`。约束仅为 Id 主键、Name 必填且全局唯一、Status 必填且仅“启用”或“停用”；Name 唯一和 Status 范围分别追踪到 TASK-0004 产品基线 BR-027 与 9.1 节，不作为未来能力预留。

## 架构与文件预算

PASS。规格选择 Controller 直接查询现有 AppDbContext、文件内最小投影；明确不创建 RoomService、Repository、独立 DTO、DI 服务、前端路由、composable、生产种子数据，也不修改登录跳转。

文件预算路径准确且为上限：新增最多 5 个、修改最多 4 个、总计最多 9 个。所有路径精确；Migration 的时间戳占位符合 EF 生成文件命名；没有模糊测试路径、预算外业务代码许可或“必须修改全部文件”的要求。

## 测试预算

PASS。后端仅覆盖：参数化的已认证角色访问及启用/停用数据与最小响应字段、空表 `[]`、未认证 401。前端仅覆盖：成功名称/状态、空态、失败与空态互斥、列表区域不存在 AC-06 排除入口和控件。

没有 RoomService 单元测试、顺序测试、重复路由守卫测试、覆盖率驱动测试、新测试框架或 fixture 抽象。

## 防过度设计与防过度开发专项判定

1. 是否只解决一个核心业务问题：是。
2. 是否存在 AC 未支撑的字段：否。
3. 是否存在 AC 未支撑的接口：否。
4. 是否存在未来功能预留：否。
5. 是否增加非必要抽象：否。
6. 是否增加非必要依赖：否。
7. 是否存在重复测试：否。
8. 是否可以进一步缩小文件范围：否；当前预算已是实体、Controller、单次 Migration、DbContext/Snapshot、现有首页及单个既有前端测试文件所需的最小上限。
9. 是否存在读取归档实现后反向编写规格的迹象：未发现；本次审核未访问归档分支。
10. 是否把规格批准错误等同于开发授权：否；规格明确 PASS 后仍须由 Architect 合法执行 `DRAFT → READY`，再由实施 Owner 认领精确实施锁。

防过度设计：PASS。防过度开发：PASS。

## Findings

无。

- BLOCKER：0
- MAJOR：0
- MINOR：0
- NOTE：0

## 状态与锁

依据 `docs/architecture/AGENT-WORKFLOW.md` 第 3.1、3.2、4、6 节，`DRAFT → READY` 的有权发起者是 Codex Architect，规格锁的 Owner 也是 Codex Architect。Reviewer 本轮仅创建审核记录，不代替 Architect 修改被审核规格、迁移 TASK/current-task 或释放 Architect 的规格锁。

审核后保持：TASK-0009 `DRAFT`；current-task `DRAFT`；Implementation Started `NO`；三项规格锁 `CLAIMED` by Codex Architect；实施锁 0。下一步仅允许 Codex Architect 在独立步骤记录本审核 PASS，合法执行 `DRAFT → READY` 并释放三项规格锁；不得直接实施。

## 最终结论与许可

- 最终规格审核结论：`PASS`
- Findings：0
- AC：6/6 PASS
- API 契约：PASS
- 数据模型：PASS
- 文件预算：PASS（新增上限 5、修改上限 4）
- 测试预算：PASS
- 防过度设计：PASS
- 防过度开发：PASS
- 允许由 Codex Architect 执行后续 READY 门禁：是
- 允许直接开始实现：否
- 本轮实施代码修改：无
- 本轮开发活动：无
