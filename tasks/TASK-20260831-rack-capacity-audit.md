# TASK-20260831-rack-capacity-audit

> 遵守 `docs/architecture/AGENT-WORKFLOW.md`。

## 基本信息

- Status：IN_PROGRESS
- Owner：Cursor Developer
- Reviewer：Codex Reviewer
- Branch：`feature/TASK-20260831-rack-capacity-audit`
- Requirement Source：hangyu 于 2026-08-31 确认“按最小方案做”：补充找可用机柜和全局变更记录；Windows 安装包延后。
- Product Baseline：`docs/product/MVP-PRODUCT-BASELINE.md` §4.1（可查、可看、可追溯）
- Architecture Reference：`docs/architecture/MVP-ARCHITECTURE-BASELINE.md`

## 角色与前置条件

- Owner 与最终 Reviewer 不同：是。
- 产品范围与最小方案已获用户书面批准：是。
- 模块锁：Owner 开发前须检查 `tasks/MODULE-LOCKS.md`，无冲突后认领下列允许路径并转为 `IN_PROGRESS`。

## 允许修改

- `src/frontend/src/composables/useRackDetail.ts`
- `src/frontend/src/views/HomeView.vue`
- `src/frontend/src/views/AuditRecordsView.vue`（新增）
- `src/frontend/src/router.ts`
- `src/frontend/src/App.vue`
- `src/frontend/src/__tests__/rackDetail.test.ts`
- `src/frontend/src/__tests__/router-and-views.test.ts`
- `tests/backend/Datacenter.Api.Tests/IntegrationTests/ServerPositionIntegrationTests.cs`
- `src/backend/Datacenter.Api/Controllers/ServersController.cs`
- 本任务状态、锁和交接文件。

## 禁止修改

- 数据库模型、EF 迁移、现有审计记录格式或种子数据。
- 现有写入接口、权限模型、导入导出、实时监控、3D、报表导出和分页框架。
- 新第三方依赖。

## 功能要求

### FR-01：找可用机柜

1. 机房首页提供“需要 U 位”的正整数输入与“查找可用机柜”操作。
2. 复用已有 `GET /api/rooms/{id}/racks-summary` 与机柜状态数据，查找启用机柜中连续空闲且长度不少于输入值的 U 位区段。
3. 每条结果显示机房、机柜、连续空闲 U 位范围和该范围长度；点击结果进入对应机柜工作区。
4. 无输入、非正整数、无结果和加载失败均给出明确提示。

### FR-02：全局变更记录

1. 在既有 `AuditRecords` 数据上新增只读 `GET /api/servers/audit-records`。
2. 接口返回最新在前的记录，以及服务器名称、操作类型、变更前位置、变更后位置、操作人、操作时间和备注。
3. 接口支持可选的 `from`、`to`（日期，`to` 当天包含在内）、`operatorUsername`、`operationType`、`serverName` 筛选；空筛选返回全部记录。
4. 新增“变更记录”页面和导航入口，提供上述筛选控件、查询按钮和结果表；服务器名称可进入该服务器详情。

## 非功能要求

1. 保留现有认证：匿名访问全局审计接口必须为 `401`；所有已认证角色可只读访问。
2. 不改变数据库或现有每服务器审计接口的响应。
3. 只使用 Vue、ASP.NET Core 和 EF Core 既有能力；不新增依赖或抽象层。

## 范围与非目标

- 最小实现：客户端从现有机房机柜摘要计算连续空位；全局审计按已有字段查询和展示。
- 明确不实现：精确按历史机房/机柜筛选（记录未持久化这些 ID）、自动上架、导出、分页、审计编辑/删除。
- 推迟：Windows 安装包与一键启动。

## 需求追踪矩阵

| 实现项 | Requirement Source | 要求 | 验收标准 |
|---|---|---|---|
| 连续空闲 U 位检索 | 2026-08-31 用户确认 | FR-01 | AC-01、AC-02、AC-03 |
| 全局审计只读查询 | 2026-08-31 用户确认 | FR-02、NFR-01 | AC-04、AC-05、AC-06 |

## 复杂度预算

- 允许新增依赖：无。
- 允许新增抽象：无；只可在既有 `useRackDetail.ts` 加入可测的纯函数。
- 允许修改数据模型：无。
- 允许修改 API：仅新增 `GET /api/servers/audit-records`。
- 预计文件：9 个修改或新增业务/测试文件。

## 验收标准

- [ ] AC-01：输入 `4` 时，只列出启用且存在连续至少 `4U` 空位的机柜；结果准确显示机房、机柜、空闲范围与长度。
- [ ] AC-02：结果点击后打开对应 `/racks/{id}`；无可用区段、非法输入或摘要请求失败时有明确页面提示。
- [ ] AC-03：连续空位计算覆盖多个相邻空 U 位、被占用 U 位打断及不足所需 U 位三种情形。
- [ ] AC-04：已认证用户调用全局审计接口，可按时间、操作人、类型和服务器名称组合筛选，并按时间倒序获得完整字段；`to` 日期包含整天。
- [ ] AC-05：匿名调用全局审计接口返回 `401`；既有 `/api/servers/{id}/audit-records` 行为不变。
- [ ] AC-06：导航可进入“变更记录”页面；页面可查询、显示筛选结果，且服务器链接进入详情页。

## 验证命令

```bash
cd src/frontend && npm test -- --run && npm run typecheck && npm run build
dotnet test tests/backend/Datacenter.Api.Tests/ --no-restore
git diff --check
```

## 交接记录

| 时间 | 发起者 | 原状态 | 新状态 | 证据 |
|---|---|---|---|---|
| 2026-08-31 | Codex + Terra | DRAFT | READY | 用户确认最小方案；范围、验收、Owner、Reviewer 与验证命令完整。 |
| 2026-08-31 | Cursor Developer | READY | IN_PROGRESS | 无活跃模块锁与 Task 1 四个允许路径冲突；已登记 CLAIMED 锁。 |

## 防过度开发检查

- 未加入数据库迁移、历史位置筛选、导出、分页、自动上架或新依赖。
- 采用现有摘要接口和审计表，满足当前验收标准的最小实现。
